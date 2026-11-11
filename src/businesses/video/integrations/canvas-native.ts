/** 画布内制作入口：独立的方案/费用/结果审核，不创建或伪造助手会话。 */
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { dshHome } from '../../../core/paths.js';
import { loadCanvasAdapter, readCanvasInput, publishCanvasResult, resolveCanvasAdapter } from './canvas.js';
import { snapshotConfig, imageConfig, resolveApiKey, assertConfigured, resolveModel, resolveTextModel, isVolcengine, connectionLabel } from '../providers/connection.js';
import { buildGenerationBody, buildRequestBody, runTask } from '../providers/seedance.js';
import { generateSeedreamImage } from '../providers/seedream.js';
import { waitForCompletion } from '../providers/transport.js';
import { finishKnownTask } from '../providers/submissions.js';
import { resolveImageInput } from '../media/references.js';
import { IMAGE_MODEL } from '../connection-defaults.js';
import { modelMaxSeconds, planVideoSegments, resolveSegmentSeconds } from '../workflow/planning.js';
import { estimateSegmentCosts } from '../tools/video-estimate.js';
import { writeScript } from '../providers/text.js';
import { canvasScriptPreview, scriptStoryboardShots } from './canvas-project.js';
import { clampInteger } from '../../../core/utils/validation.js';
import { MIN_SECONDS, MIN_SEGMENT_SECONDS, MAX_TOTAL_SECONDS } from '../config.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validToken = value => /^[a-f0-9-]{36}$/.test(String(value || ''));
const terminal = new Set(['succeeded', 'failed', 'cancelled']);

/** 把条目尽量均匀地分成 count 组：按字符数配平，并保证每组至少一条。 */
function splitEvenly(items: string[], count: number) {
  const groups: string[][] = [];
  const total = items.reduce((sum, item) => sum + item.length, 0);
  let index = 0, used = 0;
  for (let group = 0; group < count; group += 1) {
    const target = total * (group + 1) / count;
    const current: string[] = [];
    while (index < items.length && items.length - index >= count - group && (current.length === 0 || used < target)) {
      current.push(items[index]); used += items[index].length; index += 1;
    }
    groups.push(current);
  }
  while (index < items.length) groups[count - 1].push(items[index++]);
  return groups;
}

/** 写脚本 → 逐段提示词：有分镜表就按画面列切，否则按句子/段落按字数均分。
 *  只做切分，不编造内容；内容不够拆成这么多段时直接报错，让用户补脚本或缩短时长。 */
/** 分镜行的「画面」列就是要拍的镜头；没有画面列时才退回整行文本。 */
export function shotPrompt(shot: any) {
  const visual = String(shot?.visual || shot?.title || '').trim();
  const line = visual.split(/\r?\n/).map(part => part.trim()).find(part => /^(?:画面|visual)[:：]/.test(part));
  return (line ? line.replace(/^(?:画面|visual)[:：]\s*/, '') : visual).trim();
}

export function splitScriptPrompts(script: any, count: any, shots: any[] = []) {
  const raw = String(script ?? '').trim();
  if (!raw) throw new Error('请先写下脚本内容，再生成制作节点。');
  if (!Number.isInteger(count) || count < 1) throw new Error('分段数量无效。');
  const visuals = (Array.isArray(shots) ? shots : []).map(shotPrompt).filter(Boolean);
  if (visuals.length >= count && count > 1) return splitEvenly(visuals, count).map(group => group.join('\n'));
  const body = canvasScriptPreview(raw);
  if (!body) throw new Error('脚本里没有可用于制作的正文，请补充内容。');
  if (count === 1) return [body];
  const sentences = body.split(/(?<=[。！？!?；;])\s*|\s*\n+/).map(part => part.trim()).filter(Boolean);
  if (sentences.length < count) throw new Error(`脚本正文只够拆成 ${sentences.length} 段，请补充脚本或缩短目标时长。`);
  return splitEvenly(sentences, count).map(group => group.join(''));
}

/** 连拍顺序：待制作的视频节点按连线从上游排到下游；成果节点与已产出节点不参与。
 *  与画布界面 flowSteps 同一套规则，保证「制作「…」」的顺序和连拍一致。 */
export function pendingVideoOrder(doc: any) {
  const nodes: any[] = Object.values(doc?.nodes || {});
  const author = nodes.filter(n => n?.type === 'video' && !n?.metaonticSourceNode && !n?.data?.assetId);
  const byId = new Map(author.map(n => [n.id, n]));
  const inbound = new Map(author.map(n => [n.id, [] as string[]]));
  for (const edge of doc?.edges || []) {
    if (edge?.metaonticResult) continue;
    if (byId.has(edge?.toNode) && byId.has(edge?.fromNode)) inbound.get(edge.toNode)!.push(edge.fromNode);
  }
  const ordered: any[] = [], seen = new Set<string>();
  const visit = (node: any) => { if (!node || seen.has(node.id)) return; seen.add(node.id); for (const up of inbound.get(node.id) || []) visit(byId.get(up)); ordered.push(node); };
  for (const node of author) visit(node);
  return ordered.map(node => ({ id: node.id, label: String(node?.data?.label || '视频节点'), prompt: String(node?.data?.prompt || ''),
    transition: String(node?.data?.transition || '').trim(), duration: node?.data?.duration ?? null,
    ratio: String(node?.data?.ratio || ''), resolution: String(node?.data?.resolution || '').toLowerCase(), generateAudio: node?.data?.generateAudio === true }));
}

/** 端口语义无法无损表达时停止，不能把尾帧/音频/视频当普通参考图。 */
export function planCanvasNative(input, config, operation = 'generate', draft: any = {}, carry: any = null) {
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
  if (/@[^@\n]+@/.test(prompt)) throw new Error('请先把@设定引用展开为明确描述，直接制作暂不自动解析设定引用。');
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
    // 连拍时上段成果还在内存记录里（成果节点是刚刚回填出来的），用 carry 传进来，语义与节点字段完全一致。
    const from = carry?.videoUrl ? { videoUrl: String(carry.videoUrl), seconds: Number(carry.seconds) } : null;
    if (from ? !from.videoUrl || !Number.isFinite(from.seconds) || from.seconds <= 0
      : !node.metaonticTaskId || !node.metaonticVideoUrl || !Number.isFinite(node.metaonticSeconds) || node.metaonticSeconds <= 0) throw new Error('续拍需选中本插件直接制作并已审核的视频成果节点。');
    args.videoUrl = from ? from.videoUrl : node.metaonticVideoUrl; args.inputVideoSeconds = from ? from.seconds : node.metaonticSeconds;
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
  // 画布适配器按项目标识解析：内置画布文档走插件自己的存储，注入的加载器优先（自动化检查）。
  const adapterFor = link => options.resolve ? options.resolve(link) : resolveCanvasAdapter(link?.projectId, load);
  const directory = options.directory || path.join(dshHome(), 'metaontic-video', 'canvas-native');
  const snapshots = new Map<string, any>(), running = new Map<string, AbortController>(), locks = new Set<string>();
  const proposals = new Map<string, any>();
  // 连拍记录与待确认方案分开存：一条画布同时只允许一条在跑的连拍。
  const chainDirectory = options.chainDirectory || path.join(directory, 'chains');
  let disposed = false;
  const file = id => { if (!validToken(id)) throw new Error('制作记录标识无效。'); return path.join(directory, `${id}.json`); };
  const pointer = link => path.join(directory, `node-${hash([link.projectId, link.canvasId || '', link.nodeId])}.json`);
  async function save(job) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const dest = file(job.id), temp = `${dest}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(job), { mode: 0o600, flag: 'wx' }); await rename(temp, dest);
  }
  const read = async id => JSON.parse(await readFile(file(id), 'utf8'));
  const chainFile = id => { if (!validToken(id)) throw new Error('连拍记录标识无效。'); return path.join(chainDirectory, `${id}.json`); };
  const chainPointer = link => path.join(chainDirectory, `canvas-${hash([link.projectId, link.canvasId || ''])}.json`);
  async function saveChain(chain) {
    await mkdir(chainDirectory, { recursive: true, mode: 0o700 });
    const dest = chainFile(chain.id), temp = `${dest}.${randomUUID()}.tmp`;
    await writeFile(temp, JSON.stringify(chain), { mode: 0o600, flag: 'wx' }); await rename(temp, dest);
  }
  const readChain = async id => JSON.parse(await readFile(chainFile(id), 'utf8'));
  async function previousChain(link) {
    let id;
    try { id = JSON.parse(await readFile(chainPointer(link), 'utf8')).id; } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    return readChain(id);
  }
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
      job.sync = await (options.publish || publishCanvasResult)(await resolveCanvasAdapter(job.canvas?.projectId, load), { id: job.id, canvas: job.canvas, media: job.media, ratio: job.plan.args.ratio, phase: 'result_review', createdAt: job.createdAt,
        native: { taskId: job.taskId, videoUrl: job.media[0]?.kind === 'video' ? job.media[0].url : '', seconds: job.plan.args.duration, resolution: job.plan.args.resolution, prompt: job.plan.args.prompt } });
    } catch { job.sync = { status: 'pending' }; }
    await save(job);
  }
  /** 连拍计划：逐段排方案。第 1 段直出，其余以上一段成果续拍；只算方案与估价，不提交。
   *  续拍的输入视频在真正开跑时才有，所以计划阶段用占位地址，方案里的时长/画幅/提示词是最终值。 */
  async function chainPlan(adapter, projectId, config) {
    const doc = await adapter.rpc.projectsGet({ id: projectId });
    if (!doc?.nodes) throw new Error('画布不存在或已删除。');
    const order = pendingVideoOrder(doc);
    if (!order.length) throw new Error('画布上没有待制作的视频节点：先点「写脚本…」铺开，或新建一个视频节点。');
    const segments: any[] = [];
    let carry = null;
    for (const [index, node] of order.entries()) {
      const link = { projectId, nodeId: node.id };
      const input = await readCanvasInput(adapter, link);
      const operation = index === 0 ? 'generate' : 'extend';
      const draft: any = { prompt: node.prompt, duration: node.duration, resolution: node.resolution, ratio: node.ratio, generateAudio: node.generateAudio };
      if (operation === 'extend') draft.transitionDescription = node.transition || node.prompt;
      const plan = planCanvasNative(input, config, operation, draft, carry);
      const segment = { index, nodeId: node.id, label: node.label, operation, prompt: String(plan.args.prompt), transition: String(plan.args.transitionDescription || ''),
        seconds: plan.args.duration, ratio: plan.args.ratio, resolution: plan.args.resolution, cny: plan.estimate?.cny ?? null, priceDate: plan.estimate?.priceDate ?? null,
        fingerprint: input.canvas.fingerprint, snapshot: { prompt: node.prompt, duration: node.duration, ratio: node.ratio, resolution: node.resolution } };
      segments.push(segment);
      carry = { videoUrl: 'pending-previous-segment', seconds: plan.args.duration };
    }
    return segments;
  }

  /** 按当前记录里的字段重新核对节点：对得上才允许提交，避免花的是没核对过的那一版。 */
  function assertSegmentMatches(node, segment) {
    const same = node && node.prompt === segment.snapshot.prompt && (node.duration ?? null) === segment.snapshot.duration
      && node.ratio === segment.snapshot.ratio && String(node.resolution).toLowerCase() === segment.snapshot.resolution;
    if (!same) throw new Error(`第 ${segment.index + 1} 段内容或参数已改动，请重新预览连拍方案再开始。`);
  }

  async function planChainSegment(adapter, projectId, segment, carry, config) {
    const input = await readCanvasInput(adapter, { projectId, nodeId: segment.nodeId });
    const node = input.nodes.find(n => n.id === segment.nodeId);
    assertSegmentMatches(node, segment);
    const draft: any = { prompt: segment.prompt, duration: segment.seconds, resolution: segment.resolution, ratio: segment.ratio };
    if (segment.operation === 'extend') draft.transitionDescription = segment.transition || segment.prompt;
    return { canvas: input.canvas, plan: planCanvasNative(input, config, segment.operation, draft, carry) };
  }

  /** 真正提交一段：与单节点「确认并开始」共用同一套落盘、指针与互斥。 */
  async function launchSegment(chain, segment, planned, config) {
    const { canvas, plan } = planned;
    const key = pointer(canvas);
    if (locks.has(key)) throw new Error('此节点正在确认制作。');
    locks.add(key);
    try {
      const old = await previous(canvas);
      if (old && (!terminal.has(old.state) || (old.media?.length && !old.reviewed) || old.sync?.status === 'pending')) return old;
      const job: any = { version: 1, id: randomUUID(), canvas, plan, identity: chain.identity, createdAt: Date.now(), state: 'running', reviewed: false, chain: chain.id };
      await save(job);
      const temp = `${key}.${randomUUID()}.tmp`; await writeFile(temp, JSON.stringify({ id: job.id }), { mode: 0o600, flag: 'wx' }); await rename(temp, key);
      snapshots.set(job.id, config);
      void perform(job, config).catch(() => {});
      return job;
    } finally { locks.delete(key); }
  }

  async function runChainSegment(chain, config) {
    const segment = chain.segments[chain.index];
    if (!segment) throw new Error('连拍段位越界，请重新预览方案。');
    const adapter = await adapterFor({ projectId: chain.projectId, ...(chain.canvasId ? { canvasId: chain.canvasId } : {}) });
    const carry = chain.index > 0 ? chain.carry : null;
    const planned = await planChainSegment(adapter, chain.projectId, segment, carry, config);
    const job = await launchSegment(chain, segment, planned, config);
    chain.jobs[chain.index] = job.id;
    chain.state = 'running';
    chain.message = '';
    await saveChain(chain);
    return job;
  }

  /** 连拍当前段的制作记录：刚开跑时可能还没落盘，读不到就是 null。 */
  async function currentJob(chain) {
    const id = chain?.jobs?.[chain.index];
    if (!id) return null;
    return read(id).catch(() => null);
  }

  /** 连拍对外状态：记录状态 + 当前段的状态合成一个，界面只认这一个。 */
  function chainStateOf(chain, job) {
    if (!chain) return 'none';
    if (chain.state === 'done' || chain.state === 'stopped' || chain.state === 'stale') return chain.state;
    if (!job) return 'running';
    if (job.state === 'running') return 'running';
    // 只有拿到成果的分段才谈得上审核；失败、待确认、中断都停下来让用户处理当前段。
    if (job.state === 'succeeded' && job.media?.length) return 'review';
    return 'stopped';
  }

  function chainView(chain, job) {
    if (!chain) return null;
    const state = chainStateOf(chain, job);
    const done = chain.segments.slice(0, chain.index).length;
    return { id: chain.id, projectId: chain.projectId, state, message: chain.message || '', index: chain.index, total: chain.segments.length, done,
      segments: chain.segments.map(segment => ({ index: segment.index, label: segment.label, nodeId: segment.nodeId, operation: segment.operation, seconds: segment.seconds,
        ratio: segment.ratio, resolution: segment.resolution, prompt: segment.prompt, cny: segment.cny })),
      cny: chain.segments.every((x: any) => x.cny !== null) ? chain.segments.reduce((sum: number, x: any) => sum + x.cny, 0) : null,
      priceDate: chain.segments[0]?.priceDate || null, job: job ? view(job) : null };
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
      let textModel = '', textReady = false;
      try { textModel = resolveTextModel(config); textReady = Boolean(resolveApiKey(config)); } catch { /* 接入方式未配好 */ }
      return { channel: connectionLabel(config), videoModel: resolveModel(config), imageModel: IMAGE_MODEL, videoReady: Boolean(resolveApiKey(config)), imageReady, singleMax: modelMaxSeconds(config), textModel, textReady };
    }
    // 连拍：一次确认整条链路的方案与总费用，之后逐段生成，每段结果仍要人工审核才继续。
    if (args.action === 'chainPlan') {
      const config = snapshotConfig(liveConfig);
      assertConfigured(config, resolveApiKey(config));
      const adapter = await adapterFor({ projectId: args.projectId });
      const segments = await chainPlan(adapter, args.projectId, config);
      const active = await previousChain({ projectId: args.projectId, ...(args.canvasId ? { canvasId: args.canvasId } : {}) }).catch(() => null);
      const alive = active && ['running', 'review'].includes(chainStateOf(active, await currentJob(active))) ? chainView(active, await currentJob(active)) : null;
      return { segments, cny: segments.every(x => x.cny !== null) ? segments.reduce((sum, x) => sum + x.cny, 0) : null,
        priceDate: segments[0]?.priceDate || null, identity: hash(config), active: alive };
    }
    // 开始连拍：确认一次方案与费用，之后按段推进；每段生成完停下来等用户审核。
    if (args.action === 'chainStart') {
      const config = snapshotConfig(liveConfig);
      if (args.confirmPlan !== true || args.confirmCost !== true) throw new Error('请先分别确认整条连拍的制作方案与费用。');
      if (args.identity && args.identity !== hash(config)) throw new Error('插件配置已变，请重新预览连拍方案。');
      const link = { projectId: args.projectId, ...(args.canvasId ? { canvasId: args.canvasId } : {}) };
      const adapter = await adapterFor(link);
      const existing = await previousChain(link);
      if (existing && ['running', 'review'].includes(chainStateOf(existing, await currentJob(existing)))) return { chain: chainView(existing, await currentJob(existing)) };
      const segments = await chainPlan(adapter, args.projectId, config);
      const chain: any = { version: 1, id: randomUUID(), projectId: args.projectId, ...(args.canvasId ? { canvasId: args.canvasId } : {}),
        identity: hash(config), createdAt: Date.now(), index: 0, jobs: [], carry: null, state: 'running', message: '', segments };
      await saveChain(chain);
      await mkdir(chainDirectory, { recursive: true, mode: 0o700 });
      const temp = `${chainPointer(link)}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify({ id: chain.id }), { mode: 0o600, flag: 'wx' }); await rename(temp, chainPointer(link));
      try { await runChainSegment(chain, config); }
      catch (error: any) { chain.state = 'stale'; chain.message = String(error?.message || '连拍未开始。'); await saveChain(chain); throw error; }
      return { chain: chainView(chain, await currentJob(chain)) };
    }
    if (args.action === 'chainStatus') {
      const chain = args.id ? await readChain(args.id) : await previousChain({ projectId: args.projectId, ...(args.canvasId ? { canvasId: args.canvasId } : {}) });
      if (!chain) return { chain: null };
      const job = await currentJob(chain);
      return { chain: chainView(chain, job), job: job ? view(job) : null };
    }
    if (args.action === 'chainNext') {
      const chain = await readChain(args.id);
      const job = await currentJob(chain);
      if (chain.state !== 'running' && chain.state !== 'review') throw new Error('这条连拍已经结束，请重新预览方案。');
      if (args.accept !== true) { chain.state = 'stopped'; chain.message = '已停止连拍；已生成的分段成果保留。'; await saveChain(chain); return { chain: chainView(chain, job) }; }
      if (!job) throw new Error('没有正在推进的连拍分段。');
      if (job.state !== 'succeeded' || !job.media?.length) throw new Error('这一段还没有可审核的成果，先查询原任务或重新生成。');
      if (job.sync?.status === 'pending' || !job.sync) throw new Error('这一段成果还没回填到画布，先点「补回填画布」。');
      const accepted = await read(job.id).catch(() => null);
      if (accepted && accepted.reviewed !== true) { accepted.reviewed = true; await save(accepted); }
      const config = snapshotConfig(liveConfig);
      if (hash(config) !== chain.identity) throw new Error('插件配置已变，请重新预览连拍方案。');
      chain.carry = { videoUrl: job.media[0].url, seconds: job.plan.args.duration };
      chain.index += 1;
      if (chain.index >= chain.segments.length) { chain.state = 'done'; chain.message = '全部段落都已有成果。'; await saveChain(chain); return { chain: chainView(chain, null), job: null }; }
      try { await runChainSegment(chain, config); }
      catch (error: any) { chain.state = 'stale'; chain.message = String(error?.message || '下一段未能开始。'); await saveChain(chain); throw error; }
      return { chain: chainView(chain, await currentJob(chain)) };
    }
    if (args.action === 'chainStop') {
      const chain = await readChain(args.id);
      chain.state = 'stopped';
      chain.message = '已停止连拍；已提交的那一段仍会跑完并回填。';
      await saveChain(chain);
      return { chain: chainView(chain, await currentJob(chain)) };
    }
    // 文本模型写脚本：一次调用，返回 Markdown 剧本；不建节点、不碰视频模型。
    if (args.action === 'write') {
      const config = snapshotConfig(liveConfig);
      const singleMax = modelMaxSeconds(config);
      const totalSeconds = clampInteger(args.totalSeconds, MIN_SECONDS, MAX_TOTAL_SECONDS, Math.min(15, singleMax));
      const segmentSeconds = resolveSegmentSeconds(config, args.segmentSeconds);
      const count = planVideoSegments(totalSeconds, singleMax, segmentSeconds).length;
      assertConfigured(config, resolveApiKey(config));
      const writer = options.writeScript || writeScript;
      const result = await writer(config, { idea: args.idea, totalSeconds, segmentSeconds, segments: count, ratio: args.ratio || '16:9' }, {});
      return { script: result.script, model: result.model, usage: result.usage, totalSeconds, segmentSeconds, segments: count };
    }
    // 写脚本 → 分段计划：只算方案，不建节点、不接触模型费用。
    if (args.action === 'plan') {
      const config = snapshotConfig(liveConfig);
      const singleMax = modelMaxSeconds(config);
      const totalSeconds = clampInteger(args.totalSeconds, MIN_SECONDS, MAX_TOTAL_SECONDS, Math.min(15, singleMax));
      const segmentSeconds = resolveSegmentSeconds(config, args.segmentSeconds);
      const steps = planVideoSegments(totalSeconds, singleMax, segmentSeconds);
      const script = String(args.script ?? '');
      const shots = scriptStoryboardShots(script);
      const prompts = splitScriptPrompts(script, steps.length, shots);
      return { videoReady: Boolean(resolveApiKey(config)), videoModel: resolveModel(config), singleMax, totalSeconds, segmentSeconds,
        segments: steps.map((step, index) => ({ kind: step.kind, seconds: step.seconds, prompt: prompts[index] })),
        shots: shots.slice(0, 60).map((shot, index) => ({ index: index + 1, visual: String(shot?.visual || shot?.title || ''), camera: shot?.camera || '', sfx: shot?.sfx || '', ...(shot?.duration ? { duration: shot.duration } : {}) })) };
    }
    if (args.action === 'prepare') {
      const adapter = await adapterFor(args), input = await readCanvasInput(adapter, args);
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
    if (args.action === 'latest') { const input = await readCanvasInput(await resolveCanvasAdapter(args?.projectId, load), args); const job = await previous(input.canvas); return { job: job ? view(job) : null }; }
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
        const input = await readCanvasInput(await adapterFor(p.canvas), p.canvas);
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
