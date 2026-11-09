/** 画布内制作入口：独立的方案/费用/结果审核，不创建或伪造助手会话。 */
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dshHome } from '../../../core/paths.js';
import { loadCanvasAdapter, readCanvasInput, publishCanvasResult } from './canvas.js';
import { snapshotConfig, imageConfig, resolveApiKey, assertConfigured, resolveModel, isVolcengine, connectionLabel } from '../providers/connection.js';
import { buildGenerationBody, buildRequestBody, runTask } from '../providers/seedance.js';
import { generateSeedreamImage } from '../providers/seedream.js';
import { waitForCompletion } from '../providers/transport.js';
import { finishKnownTask } from '../providers/submissions.js';
import { resolveImageInput } from '../media/references.js';
import { IMAGE_MODEL } from '../connection-defaults.js';
import { modelMaxSeconds } from '../workflow/planning.js';
import { estimateSegmentCosts } from '../tools/video-estimate.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validToken = value => /^[a-f0-9-]{36}$/.test(String(value || ''));
const terminal = new Set(['succeeded', 'failed', 'cancelled']);

/** 端口语义无法无损表达时停止，不能把尾帧/音频/视频当普通参考图。 */
export function planCanvasNative(input, config, operation = 'generate', draft: any = {}) {
  if (!['generate', 'extend'].includes(operation)) throw new Error('不支持的画布制作操作。');
  const node = input.nodes.find(n => n.id === input.canvas.nodeId);
  if (!node || !['image', 'video'].includes(node.type)) throw new Error('直接制作目前支持图片和视频节点。');
  if (node.imgExtra || node.vidExtra) throw new Error('直接制作暂不支持节点扩展参数，请清空后再试；不会静默忽略。');
  if (node.type === 'image' && node.imageCount !== 1) throw new Error('当前每次制作一张图片，请将节点张数设为1。');
  const incoming = input.edges.filter(e => e.toNode === node.id && !e.metaonticResult);
  const texts = incoming.filter(e => e.toPort === 'prompt').map(e => input.nodes.find(n => n.id === e.fromNode));
  if (texts.some(n => !n || !['text', 'script', 'storyboard'].includes(n.type))) throw new Error('提示词端口连接的节点类型暂不支持。');
  let shots = texts.flatMap(n => n.shots || []);
  if (node.segShotFrom != null || node.segShotTo != null) {
    if (!Number.isInteger(node.segShotFrom) || !Number.isInteger(node.segShotTo) || node.segShotFrom < 0 || node.segShotTo < node.segShotFrom || node.segShotTo >= shots.length) throw new Error('分镜切段范围无效。');
    shots = shots.slice(node.segShotFrom, node.segShotTo + 1);
  }
  const prompt = String(draft.prompt ?? [node.prompt, ...texts.map(n => n.type === 'storyboard' ? '' : n.text || n.output || n.script || n.requirement), shots.length ? JSON.stringify(shots) : ''].filter(Boolean).join('\n')).trim();
  if (!prompt) throw new Error('请先在节点填写本次要生成的画面或续拍内容。');
  if (prompt.length > 20000) throw new Error('提示词过长，请缩小本节点的制作范围。');
  if (/@[^@\n]+@/.test(prompt)) throw new Error('请先把@设定引用展开为明确描述，直接制作暂不自动解析原版设定引用。');
  const ratio = draft.ratio ?? node.ratio;
  if (!['16:9', '9:16', '1:1', '4:3', '3:4'].includes(ratio)) throw new Error('请在节点明确选择画幅后再制作。');
  const refs = incoming.filter(e => e.toPort !== 'prompt');
  const order = node.refOrder || [];
  refs.sort((a, b) => { const ai = order.indexOf(a.id), bi = order.indexOf(b.id); return (ai < 0 ? order.length : ai) - (bi < 0 ? order.length : bi); });
  const images = refs.map(e => {
    if (!['ref', 'frame'].includes(e.toPort) || e.fromPort !== 'out') throw new Error('当前仅支持图片out连接ref/首帧口；尾帧选取等连接请先导出为图片节点。');
    const media = input.references.find(r => r.nodeId === e.fromNode);
    if (!media || media.kind !== 'image') throw new Error('参考端口需要已保存的图片素材。');
    return { port: e.toPort, path: media.path, nodeId: e.fromNode };
  });
  if (node.frameMode === 'off' && images.some(x => x.port === 'frame')) throw new Error('首帧端口已连接但节点关闭了首帧，请先统一设置。');
  if (images.filter(x => x.port === 'frame').length > 1) throw new Error('一个视频节点只能绑定一张首帧。');
  if (images.some(x => x.port === 'frame') && images.some(x => x.port === 'ref')) throw new Error('当前模型不能同时使用首帧和普通参考图，请调整连接。');
  const args: any = { prompt, ratio, generateAudio: draft.generateAudio === true };
  if (node.type === 'image') {
    if (operation !== 'generate') throw new Error('图片节点不能续拍。');
    if (isVolcengine(config)) throw new Error('图片直接制作需要在插件设置选择MetaOntic AI。');
    return { kind: 'image', operation, args, images, model: IMAGE_MODEL, notes: ['按一次图片调用单独计费，图片为2048×2048；本版图片暂不支持其他画幅。'] };
  }
  const duration = draft.duration ?? (shots.length ? shots.reduce((sum, s) => sum + Number(s.duration || 0), 0) : node.duration);
  if (!Number.isInteger(duration) || duration < 4 || duration > modelMaxSeconds(config)) throw new Error(`每个节点本次制作4–${modelMaxSeconds(config)}秒，请调整时长；长视频审核后逐节点续拍。`);
  args.duration = duration;
  args.resolution = String(draft.resolution ?? node.resolution).toLowerCase();
  if (!['480p', '720p'].includes(args.resolution)) throw new Error('请在节点明确选择480P或720P。');
  if (operation === 'extend') {
    if (!node.metaonticTaskId || !node.metaonticVideoUrl || !Number.isFinite(node.metaonticSeconds) || node.metaonticSeconds <= 0) throw new Error('续拍需选中本插件直接制作并已审核的视频成果节点。');
    args.videoUrl = node.metaonticVideoUrl; args.inputVideoSeconds = node.metaonticSeconds;
    args.transitionDescription = String(draft.transitionDescription || '').trim();
    if (!args.transitionDescription) throw new Error('请填写上一段结尾到本段动作、镜头与声音的衔接描述。');
    if (images.some(x => x.port === 'frame')) throw new Error('续拍以视频为输入，请移除首帧连接。');
  } else {
    args.firstFrameUrl = images.find(x => x.port === 'frame')?.path;
    args.referenceImages = images.filter(x => x.port === 'ref').map(x => x.path);
  }
  let estimate = null;
  try { estimate = estimateSegmentCosts(config, args, [{ kind: operation, seconds: duration, inputSeconds: args.inputVideoSeconds }]); } catch { /* 未知价目不编造金额 */ }
  return { kind: 'video', operation, args, images, model: resolveModel(config), estimate, notes: ['只执行当前这一段，不自动生成角色图或重做。续拍需要先审核上一段效果。', '估价为基础公式，实际按渠道账单结算；未知价目只确认按实际调用计费。'] };
}

export function createCanvasNativeService(liveConfig, options: any = {}) {
  const load = options.load || loadCanvasAdapter;
  const directory = options.directory || path.join(dshHome(), 'metaontic-video', 'canvas-native');
  const snapshots = new Map<string, any>(), running = new Map<string, AbortController>(), locks = new Set<string>();
  const proposals = new Map<string, any>();
  let disposed = false;
  const file = id => { if (!validToken(id)) throw new Error('制作记录标识无效。'); return path.join(directory, `${id}.json`); };
  const pointer = link => path.join(directory, `node-${hash([link.projectId, link.canvasId || '', link.nodeId])}.json`);
  async function save(job) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const dest = file(job.id), temp = `${dest}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(job), { mode: 0o600, flag: 'wx' }); await rename(temp, dest);
  }
  const read = async id => JSON.parse(await readFile(file(id), 'utf8'));
  async function previous(link) {
    let id;
    try { id = JSON.parse(await readFile(pointer(link), 'utf8')).id; } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    return read(id);
  }
  const view = job => ({ id: job.id, state: job.state === 'running' && !running.has(job.id) ? 'interrupted' : job.state, taskId: job.taskId,
    media: job.media || [], reviewed: job.reviewed === true, sync: job.sync, message: job.message || '', operation: job.plan.operation });
  async function sync(job) {
    if (!job.media?.length) throw new Error('没有可回填的成果。');
    try {
      job.sync = await (options.publish || publishCanvasResult)(await load(), { id: job.id, canvas: job.canvas, media: job.media, ratio: job.plan.args.ratio, phase: 'result_review', createdAt: job.createdAt,
        native: { taskId: job.taskId, videoUrl: job.media[0]?.kind === 'video' ? job.media[0].url : '', seconds: job.plan.args.duration, resolution: job.plan.args.resolution, prompt: job.plan.args.prompt } });
    } catch { job.sync = { status: 'pending' }; }
    await save(job);
  }
  async function perform(job, config, query = false) {
    const ctl = new AbortController(); running.set(job.id, ctl);
    try {
      const created = async taskId => { job.taskId = taskId; await save(job); };
      let result;
      if (job.plan.kind === 'image') {
        const imageCfg = imageConfig(config);
        const body: any = { model: IMAGE_MODEL, prompt: job.plan.args.prompt, size: '2048x2048', n: 1, response_format: 'url', watermark: false };
        if (!query && job.plan.images.length) body.image = await Promise.all(job.plan.images.map(async x => String((await resolveImageInput(x.path, '画布参考图')).url)));
        result = await (options.image || generateSeedreamImage)(imageCfg, query ? undefined : body, ctl.signal, query ? job.taskId : undefined, { scope: job.id, onCreated: created });
        job.media = [{ kind: 'image', label: '图片', url: result.imageUrl }]; job.state = 'succeeded';
      } else {
        let body;
        if (query) body = { model: job.plan.model }; // 已有taskId时只查询，不构造或提交新请求。
        else if (job.plan.operation === 'extend') {
          const characterReferences = await Promise.all(job.plan.images.map(async x => ({ type: 'image_url', role: 'reference_image', image_url: { url: (await resolveImageInput(x.path, '画布参考图')).url } })));
          body = buildRequestBody(config, { ...job.plan.args, characterReferences }, job.plan.args.videoUrl).body;
        } else body = (await buildGenerationBody(config, job.plan.args, job.plan.args.duration, { signal: ctl.signal })).body;
        result = query ? await (options.query || waitForCompletion)(config, job.taskId, ctl.signal) : await (options.video || runTask)(config, body, ctl.signal, { scope: job.id, onCreated: created });
        if (query && terminal.has(result.status)) await finishKnownTask(config, job.taskId);
        job.state = result.status;
        if (result.status === 'succeeded' && result.videoUrl) job.media = [{ kind: 'video', label: job.plan.operation === 'extend' ? '续拍视频' : '视频', url: result.videoUrl }];
        if (!job.media?.length) job.message = terminal.has(result.status) ? '任务未成功，未自动重试。' : '状态尚未确认；只查询原任务，不重复提交。';
      }
      if (job.media?.length) { await save(job); await sync(job); }
      else await save(job);
    } catch (e) {
      if (e?.taskId) job.taskId = e.taskId;
      job.state = e?.terminal ? 'failed' : job.taskId ? 'unknown' : 'submission_unknown';
      job.message = job.taskId ? '已保存原任务，只查询原任务；未重复提交。' : '提交结果未确认，请核对渠道调用记录，不要重新生成。';
      await save(job);
    } finally { running.delete(job.id); }
  }
  async function handle(args) {
    if (disposed) throw new Error('画布制作服务正在卸载，请稍后查询原任务。');
    if (args.action === 'info') {
      const config = snapshotConfig(liveConfig);
      let imageReady = false;
      try { const c = imageConfig(config); imageReady = !isVolcengine(c) && Boolean(resolveApiKey(c)); } catch { /* 缺少独立图片密钥 */ }
      return { channel: connectionLabel(config), videoModel: resolveModel(config), imageModel: IMAGE_MODEL, videoReady: Boolean(resolveApiKey(config)), imageReady, singleMax: modelMaxSeconds(config) };
    }
    if (args.action === 'prepare') {
      const adapter = await load(), input = await readCanvasInput(adapter, args);
      const old = await previous(input.canvas);
      if (old && (!terminal.has(old.state) || (old.media?.length && !old.reviewed) || old.sync?.status === 'pending')) return { job: view(old) };
      if (args.operation === 'extend') {
        const source = input.nodes.find(n => n.id === input.canvas.nodeId);
        const sourceJobs = options.sourceReviewed || (async () => {
          // 成果节点的稳定id对应制作记录，审核事实保存在本插件，不能信任节点上的approved字段。
          const doc = await adapter.rpc.projectsGet({ id: input.canvas.projectId, ...(input.canvas.canvasId ? { canvasId: input.canvas.canvasId } : {}) });
          const id = doc.nodes?.[input.canvas.nodeId]?.data?.metaonticNativeJob;
          if (!validToken(id)) return false;
          const saved = await read(id);
          return saved.reviewed === true && saved.canvas.projectId === input.canvas.projectId && (saved.canvas.canvasId || '') === (input.canvas.canvasId || '') && saved.taskId === source.metaonticTaskId && saved.media?.[0]?.url === source.metaonticVideoUrl;
        });
        if (!await sourceJobs(input)) throw new Error('请先打开原制作记录审核上一段视频效果，再续拍。');
      }
      const config = snapshotConfig(liveConfig), plan = planCanvasNative(input, config, args.operation || 'generate', args.draft || {});
      if (plan.kind === 'image' && plan.args.ratio !== '1:1') throw new Error('本版图片直接制作仅支持1:1，请先修改节点画幅。');
      assertConfigured(plan.kind === 'image' ? imageConfig(config) : config, resolveApiKey(plan.kind === 'image' ? imageConfig(config) : config));
      const id = randomUUID(), proposal = { id, canvas: input.canvas, plan, config, identity: hash(config), expires: Date.now() + 10 * 60000 };
      for (const [key, p] of proposals) if (p.expires < Date.now()) proposals.delete(key);
      if (proposals.size >= 100) throw new Error('待确认方案过多，请先处理已有方案。');
      proposals.set(id, proposal);
      return { proposal: { id, kind: plan.kind, operation: plan.operation, prompt: plan.args.prompt, ratio: plan.args.ratio, duration: plan.args.duration, resolution: plan.args.resolution, generateAudio: plan.args.generateAudio, model: plan.model,
        references: plan.images.map(x => ({ port: x.port, nodeId: x.nodeId })), estimate: plan.estimate, notes: plan.notes } };
    }
    if (args.action === 'latest') { const input = await readCanvasInput(await load(), args); const job = await previous(input.canvas); return { job: job ? view(job) : null }; }
    if (args.action === 'start') {
      const existing = await read(args.id).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
      if (existing) return { job: view(existing) }; // 重复点击/响应丢失不再提交。
      const p = proposals.get(args.id);
      if (!p || p.expires < Date.now()) throw new Error('制作方案已失效，请重新核对。');
      const key = pointer(p.canvas);
      if (locks.has(key)) throw new Error('此节点正在确认制作。');
      locks.add(key);
      try {
        if (args.confirmPlan !== true || args.confirmCost !== true || (p.plan.kind === 'video' && !p.plan.images.length && p.plan.operation === 'generate' && args.textOnly !== true)) throw new Error('请分别确认制作方案、费用及纯文生选择。');
        if (hash(snapshotConfig(liveConfig)) !== p.identity) throw new Error('插件配置已变，请重新确认。');
        const input = await readCanvasInput(await load(), p.canvas);
        if (input.canvas.fingerprint !== p.canvas.fingerprint) throw new Error('节点或上游素材已变化，请重新核对方案。');
        const old = await previous(p.canvas);
        if (old && (!terminal.has(old.state) || (old.media?.length && !old.reviewed) || old.sync?.status === 'pending')) return { job: view(old) };
        const job: any = { version: 1, id: p.id, canvas: p.canvas, plan: p.plan, identity: p.identity, createdAt: Date.now(), state: 'running', reviewed: false };
        await save(job);
        // 先落盘节点互斥记录，再允许付费提交；Windows也通过同目录临时文件原子替换。
        const temp = `${key}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify({ id: job.id }), { mode: 0o600, flag: 'wx' }); await rename(temp, key);
        proposals.delete(p.id); snapshots.set(job.id, p.config);
        void perform(job, p.config).catch(() => {});
        return { job: view(job) };
      } finally { locks.delete(key); }
    }
    const job = await read(args.id);
    if (args.action === 'status') return { job: view(job) };
    if (running.has(job.id)) return { job: view(job) };
    if (locks.has(job.id)) throw new Error('此制作记录正在处理。');
    locks.add(job.id);
    try {
      if (args.action === 'review') {
        if (!job.media?.length || args.accept !== true) throw new Error('未通过结果审核，已保留成果，不继续制作。');
        job.reviewed = true; await save(job);
      } else if (args.action === 'sync') await sync(job);
      else if (args.action === 'query') {
        if (!job.taskId || terminal.has(job.state)) throw new Error('没有需要补查的原任务；不重新生成。');
        const config = snapshots.get(job.id) || snapshotConfig(liveConfig);
        if (hash(config) !== job.identity) throw new Error('连接配置已改变，请恢复原配置后查询原任务。');
        job.state = 'running'; await save(job); void perform(job, config, true).catch(() => {});
      } else throw new Error('未知画布制作操作。');
      return { job: view(job) };
    } finally { locks.delete(job.id); }
  }
  return { handle, dispose() { disposed = true; for (const ctl of running.values()) ctl.abort(); proposals.clear(); snapshots.clear(); } };
}

export function registerCanvasNative(ctx, config) {
  return ctx.inject(['webServer'], scope => {
    if (typeof scope.webServer?.register !== 'function') return;
    const service = createCanvasNativeService(config);
    const remove = scope.webServer.register({ kind: 'exact', path: '/metaontic-video/canvas-native', async handler(req, res) {
      res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store');
      try {
        if (req.method !== 'POST') throw new Error('仅接受POST。');
        if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) throw new Error('请求来源无效。');
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('请求类型无效。');
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 100000) throw new Error('请求过大。'); }
        res.end(JSON.stringify(await service.handle(JSON.parse(raw))));
      } catch (e) { res.statusCode = 400; res.end(JSON.stringify({ error: String(e.message || '画布制作未完成。') })); }
    } });
    return () => { service.dispose(); if (typeof remove === 'function') remove(); };
  });
}
