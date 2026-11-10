/** 原版宿主的 projectsPut 不产生「Agent 改动了项目文档」信号：打开的画布只按缺失节点逐个补，
 *  不会合并 edges（mergeHostDoc 才会），于是插件建好的节点会出现在画布上、连线一条都没有。
 *  这里对文档里已存在的连线做一次幂等确认来触发该信号：canvasConnect 遇到同一条线直接返回，不改内容。 */
export async function markCanvasChanged(adapter: any, projectId: string, candidates: any[] = []) {
  // canvasConnect 不在宿主浏览器 RPC 表里，只有模块内部接口；adapter.connect 来自 _internals。
  const connect = adapter?.connect;
  if (typeof connect !== 'function') return false;
  for (const edge of candidates) {
    if (!edge?.fromNode || !edge?.toNode) continue;
    try {
      const result = await connect({ projectId, fromNode: edge.fromNode, toNode: edge.toNode,
        ...(edge.fromPort ? { fromPort: edge.fromPort } : {}), ...(edge.toPort ? { toPort: edge.toPort } : {}) });
      if (result?.ok !== false) return true;
    } catch { /* 端口规则不满足等：换下一条候选，不阻断同步或回填 */ }
  }
  return false;
}

/** 与原版画布0.20.1起互操作（含原版自更新到的0.20.x）；生成始终经过既有工具及宿主审批。 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, copyFile, stat, open } from 'node:fs/promises';
import path from 'node:path';
import { dshHome } from '../../../core/paths.js';
import { readProject, sessionOwner } from '../workflow/project.js';
import { mediaPreviewMeta } from '../workflow/media-preview.js';
import { videoResultState } from '../workflow/result-state.js';
import { downloadFile } from '../media/download.js';
import { ref } from '../config.js';
import { resumeDirOf, readPauseFile } from '../workflow/resume.js';

export const canvasLinkSchema = { type: 'object', properties: {
  projectId: { type: 'string' }, canvasId: { type: 'string' }, nodeId: { type: 'string' }, fingerprint: { type: 'string' },
}, required: ['projectId', 'nodeId', 'fingerprint'], description: 'video_canvas(action:read)返回的原版画布定位与内容摘要；原样传入，不猜测。' };
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
function location(link) {
  if (!validId(link?.projectId) || !validId(link?.nodeId) || (link.canvasId && !validId(link.canvasId))) throw new Error('画布项目或节点标识无效');
  return { id: link.projectId, ...(link.canvasId ? { canvasId: link.canvasId } : {}) };
}
/** 原版画布自带的升级入口会把它推到更高的0.20.x；锁死单版本会让已安装的0.20.2直接不可用。
 *  版本仍设下限（0.20.1，私有接口首个核对版本），真正的开关是下面的 rpc/_internals 能力核对。 */
export function canvasVersionSupported(version: any) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version ?? '').trim());
  if (!match) return false;
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (major !== 0) return major > 0;
  return minor > 20 || (minor === 20 && patch >= 1);
}
export async function loadCanvasAdapter() {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require('@ninkch/dsh-infinite-canvas/package.json');
    if (!canvasVersionSupported(pkg.version)) throw new Error('version');
    const module = await import(pathToFileURL(require.resolve('@ninkch/dsh-infinite-canvas')).href);
    const internal = module._internals;
    const rpc = internal?.rpcMethods?.();
    if (!rpc?.projectsGet || !rpc?.projectsPut || !rpc?.assetsGet || !rpc?.assetCreate || !rpc?.projectDirGet || !rpc?.dataRootGet || !rpc?.projectsList) throw new Error('not-ready');
    return { rpc, assetPath: (root, asset) => asset.sha ? internal.objectAbsFor(root, asset.sha) : path.resolve(root, internal.physicalRel(asset.rel)),
      ...(typeof internal.canvasConnect === 'function' ? { connect: (args: any) => internal.canvasConnect(args) } : {}) };
  } catch { throw new Error('画布联动需要已启用的原版 @ninkch/dsh-infinite-canvas 0.20.1 或更新版本；请在插件详情核对安装和启用状态，不会改写画布配置。'); }
}
/** 有向上游、原顺序和端口一并保留；只输出创作字段，不读取原版供应商配置。 */
export async function readCanvasInput(adapter, link) {
  const doc = await adapter.rpc.projectsGet(location(link));
  if (!doc?.nodes?.[link.nodeId]) throw new Error('画布节点不存在，请重新选择。');
  const ids = new Set<string>(), visit = id => {
    if (ids.has(id)) return; ids.add(id);
    if (ids.size > 100) throw new Error('节点上游超过100项，请缩小制作范围。');
    for (const e of doc.edges || []) if (e.toNode === id && doc.nodes[e.fromNode]) visit(e.fromNode);
  };
  visit(link.nodeId);
  const nodes = [...ids].map(id => {
    const n = doc.nodes[id], d = n.data || {};
    return { id, type: n.type, label: d.label || '', text: d.text || '', prompt: d.prompt || '', idea: d.idea || '', output: d.output || '', script: d.script || '', requirement: d.requirement || '', shots: d.shots || [], assetId: d.assetId || '', ratio: d.ratio || '', duration: d.duration ?? null, resolution: d.resolution || '', refOrder: d.refOrder || [],
      imageCount: d.imageCount ?? 1, imgExtra: d.imgExtra || '', vidExtra: d.vidExtra || '', frameMode: d.frameMode || 'auto', segShotFrom: d.segShotFrom ?? null, segShotTo: d.segShotTo ?? null,
      metaonticTaskId: d.metaonticTaskId || '', metaonticVideoUrl: d.metaonticVideoUrl || '', metaonticSeconds: d.metaonticSeconds ?? null };
  });
  const edges = (doc.edges || []).filter(e => ids.has(e.fromNode) && ids.has(e.toNode)).map(e => ({ id: e.id, fromNode: e.fromNode, toNode: e.toNode, fromPort: e.fromPort, toPort: e.toPort, ...(e.metaonticResult ? { metaonticResult: true } : {}) }));
  const assets = nodes.filter(n => n.assetId).map(n => n.assetId);
  const records = assets.length ? (await adapter.rpc.assetsGet({ ids: assets })).items || [] : [];
  const root = (await adapter.rpc.dataRootGet()).dataRoot;
  if (!root) throw new Error('请先在无限画布设置数据根目录，确保参考素材和回填成果可持久保存。');
  const references = [];
  for (const node of nodes.filter(n => n.assetId)) {
    const a = records.find(a => a.id === node.assetId);
    if (!a || !['image', 'video'].includes(a.kind) || (!a.rel && !a.sha)) throw new Error('上游媒体资产未落盘，请先在画布中保存素材。');
    const file = adapter.assetPath(root, a);
    if (!(await stat(file)).isFile()) throw new Error('画布参考素材文件不存在。');
    const info = await stat(file);
    references.push({ nodeId: node.id, assetId: a.id, kind: a.kind, path: file, size: info.size, modified: info.mtimeMs });
  }
  const b = doc.bible || {};
  const bible = { world: b.world || '', style: b.style || '', characters: b.characters || [], scenes: b.scenes || [], props: b.props || [] };
  const fingerprint = digest({ nodes, edges, references, bible });
  return { canvas: { projectId: link.projectId, ...(link.canvasId ? { canvasId: link.canvasId } : {}), nodeId: link.nodeId, fingerprint }, nodes, edges, references, bible,
    instruction: '按端口、refOrder和原连线核对参考图及首尾帧/参考视频角色，不把所有素材一律当参考图。不得默认时长或清晰度。正文展示脚本/分镜后走video_project审核，生成工具传入canvas。不要调用canvas_run_node或canvas_generate_node代替本插件生成。' };
}

function resultFile(token) {
  if (!/^[a-f0-9-]{36}$/.test(String(token || ''))) throw new Error('回填记录标识无效');
  return path.join(dshHome(), 'metaontic-video', 'canvas-results', `${token}.json`);
}
async function saveRecord(record) {
  const file = resultFile(record.id); await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(record), { mode: 0o600, flag: 'wx' }); await rename(temp, file);
}
/** 只新增成果节点，按记录和媒体路径生成稳定id，失败重试不重生成、不重复建点。 */
export async function publishCanvasResult(adapter, record) {
  const loc = location(record.canvas);
  let doc = await adapter.rpc.projectsGet(loc);
  const source = doc.nodes?.[record.canvas.nodeId];
  if (!source) throw new Error('源节点已删除，成果仍保留在本插件；不会重建已删除节点。');
  const dir = await adapter.rpc.projectDirGet({ projectId: record.canvas.projectId });
  if (!dir?.ok || !dir.abs || !dir.dataRoot) throw new Error('画布数据目录不可用');
  const publications = [];
  for (const [index, media] of record.media.entries()) {
    const id = `mov_${digest({ canvas: record.canvas, media }).slice(0, 24)}`;
    const extension = media.kind === 'image' ? '.png' : '.mp4';
    let dest = path.join(dir.abs, media.kind, `${id}${extension}`);
    let rel = `projects/${record.canvas.projectId}/${media.kind}/${id}${extension}`;
    if (media.kind === 'image') {
      for (const suffix of ['.jpg', '.webp']) {
        const existing = dest.replace(/\.png$/, suffix);
        if ((await stat(existing).catch(() => null))?.isFile()) { dest = existing; rel = rel.replace(/\.png$/, suffix); break; }
      }
    }
    if (!(await stat(dest).catch(() => null))?.isFile()) {
      await mkdir(path.dirname(dest), { recursive: true });
      if (media.localPath) {
        const tmp = `${dest}.${randomUUID()}.tmp`; await copyFile(media.localPath, tmp); await rename(tmp, dest);
      } else {
        const url = new URL(media.url);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('成果URL格式无效');
        await downloadFile(media.url, dest, { signal: AbortSignal.timeout(60000) });
      }
    }
    let mime = media.kind === 'image' ? 'image/png' : 'video/mp4';
    if (media.kind === 'image') {
      const handle = await open(dest, 'r');
      try {
        const head = Buffer.alloc(12); await handle.read(head, 0, 12, 0);
        if (head[0] === 0xff && head[1] === 0xd8) mime = 'image/jpeg';
        else if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') mime = 'image/webp';
        else if (head.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('未知图片格式，保留原成果');
      } finally { await handle.close(); }
    }
    if (dest.endsWith('.png') && (mime === 'image/jpeg' || mime === 'image/webp')) {
      const suffix = mime === 'image/jpeg' ? '.jpg' : '.webp';
      const corrected = dest.replace(/\.png$/, suffix); await rename(dest, corrected); dest = corrected;
      rel = rel.replace(/\.png$/, suffix);
    }
    const created = await adapter.rpc.assetCreate({ projectName: doc.name || '', asset: { id, projectId: record.canvas.projectId, kind: media.kind, mime, name: media.label, rel, size: (await stat(dest)).size, createdAt: record.createdAt, stored: 'disk', source: 'metaontic-video' } });
    if (created?.ok === false) throw new Error('画布资产登记失败');
    publications.push({ id, media, index });
  }
  // 媒体复制期间用户可能改图；重读后只追加，不回写旧快照。
  doc = await adapter.rpc.projectsGet(loc);
  if (!doc.nodes?.[record.canvas.nodeId]) throw new Error('源节点已删除，成果不回填');
  const nodes = { ...doc.nodes }, edges = [...(doc.edges || [])];
  for (const { id, media, index } of publications) {
    if (doc.tombstones?.includes(id)) continue; // 用户主动删除的成果不复活。
    let resultY = Number(source.y) || 0;
    const resultX = (Number(source.x) || 0) + (Number(source.w) || 360) + 120;
    while (Object.values(nodes).some((n: any) => resultX < n.x + (n.w || 360) + 40 && resultX + 400 > n.x && resultY < n.y + (n.h || 280) + 40 && resultY + 320 > n.y)) resultY += 340;
    if (!nodes[id]) nodes[id] = { id, metaonticSourceNode: source.id, metaonticCreatedAt: record.createdAt, type: media.kind, x: resultX, y: resultY, w: 360, h: 280,
      data: { label: `MetaOntic · ${media.label}`, status: 'done', assetId: id, prompt: '', ratio: record.ratio || '16:9', demo: false, metaonticPhase: record.phase,
        ...(record.native ? { metaonticNativeJob: record.id, metaonticTaskId: record.native.taskId || '', metaonticVideoUrl: record.native.videoUrl || '', metaonticSeconds: record.native.seconds ?? null, duration: record.native.seconds ?? null, resolution: record.native.resolution || '', prompt: record.native.prompt || '' } : {}) } };
    const edgeId = `mov_edge_${id}`;
    if (['text', 'script', 'storyboard', 'shot'].includes(source.type) && !edges.some(e => e.id === edgeId) && !doc.edgeTombstones?.includes(edgeId)) edges.push({ id: edgeId, fromNode: source.id, fromPort: 'out', toNode: id, toPort: 'prompt', ...(record.native ? { metaonticResult: true } : {}) });
  }
  // 媒体之间没有兼容的提示词端口，清理旧版本创建的成果关系线；同时记墓碑，让画布端删掉缓存里的旧线。
  const removedEdges: string[] = [];
  for (let i = edges.length - 1; i >= 0; i--) if (edges[i].fromNode === source.id && edges[i].id.startsWith('mov_edge_') && ['image', 'video'].includes(source.type)) { removedEdges.push(edges[i].id); edges.splice(i, 1); }
  const saved = await adapter.rpc.projectsPut({ ...loc, name: doc.name, doc: { ...doc, nodes, edges, ts: Date.now(),
    ...(removedEdges.length ? { edgeTombstones: [...new Set([...(doc.edgeTombstones || []), ...removedEdges])] } : {}) } });
  if (saved?.ok === false || saved?.deleted) throw new Error('画布已删除或回填失败');
  await markCanvasChanged(adapter, loc.id, [...edges.filter((e: any) => e.id.startsWith('mov_edge_')), ...edges]);
  return { status: 'synced', token: record.id, count: publications.length, phase: record.phase };
}

export function createCanvasBridge(load = loadCanvasAdapter, config: any = {}) {
  const busy = new Set<string>();
  async function sync(token, exec) {
    if (busy.has(token)) throw new Error('此成果正在回填，请稍后查询。');
    busy.add(token);
    try {
      const record = JSON.parse(await readFile(resultFile(token), 'utf8'));
      if (record.owner !== sessionOwner(exec)) throw new Error('此成果不属于当前会话');
      return await publishCanvasResult(await load(), record);
    } finally { busy.delete(token); }
  }
  function wrap(tool) {
    return { ...tool, output: { ...tool.output, render(args, value) {
      const blocks = tool.output?.render?.(args, value) || [];
      return value?.canvasSync ? [...blocks, { type: 'text', text: `画布回填：${JSON.stringify(value.canvasSync)}` }] : blocks;
    } }, parameters: { ...tool.parameters, properties: { ...tool.parameters.properties, canvas: canvasLinkSchema } }, async execute(args, exec) {
      // 自动绑定仅用于投影，不修改已审核的生成参数及其摘要。
      let canvas = args.canvas;
      const resumeDir = resumeDirOf(args.resume);
      const saved = !canvas && resumeDir ? await readPauseFile(resumeDir) : null;
      const projectId = args.projectId || saved?.options?.projectId;
      canvas ||= saved?.options?.canvas;
      if (!canvas && projectId && ref(config, 'autoCreateCanvas', true) !== false) {
        const project = await readProject(projectId, exec);
        canvas = project.canvasAuto?.canvas;
      }
      if (canvas) {
        sessionOwner(exec);
        const input = await readCanvasInput(await load(), canvas);
        if (input.canvas.fingerprint !== canvas.fingerprint) throw new Error('画布内容或参考素材已修改，请重新读取并审核；未提交生成任务。');
      }
      const showState = async (text) => {
        if (!canvas || !['video_generate', 'video_extend'].includes(tool.name)) return;
        try {
          const adapter = await load(), loc = location(canvas), doc = await adapter.rpc.projectsGet(loc);
          const source = doc.nodes?.[canvas.nodeId], id = `${canvas.nodeId}_state`;
          if (!source?.data?.metaonticAssistantManaged || doc.tombstones?.includes(id)) return;
          const previous = doc.nodes[id];
          if (previous && previous.data?.text !== previous.metaonticStateText) return;
          const node = { ...(previous || { id, type: 'text', x: source.x, y: source.y + (source.h || 280) + 80, w: 360, h: 180 }), metaonticStateText: text, data: { label: '制作状态', text } };
          await adapter.rpc.projectsPut({ ...loc, name: doc.name, doc: { ...doc, nodes: { ...doc.nodes, [id]: node }, ts: Date.now() } });
          await markCanvasChanged(adapter, loc.id, doc.edges || []);
        } catch { /* 状态投影失败不影响生成与成果 */ }
      };
      await showState('正在执行制作流程；是否已提交以工具进度为准。');
      let result;
      try { result = await tool.execute(args, exec); }
      catch (error) { await showState('本次制作流程中断，请查看会话中的工具结果。'); throw error; }
      const phase = videoResultState(result).phase;
      await showState(({ complete: '制作完成', generated: '生成成功', segment_review: '本段完成，等待结果审核', task_pending: '任务状态待确认', delivery_pending: '生成结果待交付', partial: '部分完成', failed: '制作失败', reference_review: '等待参考图审核' })[phase] || '本轮流程已结束，请查看会话结果。');
      if (!canvas || !result || typeof result !== 'object') return result;
      const media = mediaPreviewMeta(result, tool.name).media;
      if (!media.length) return { ...result, canvasSync: { status: 'no_media', reason: '尚无成功素材，未回填虚构成果。' } };
      const record = { id: randomUUID(), owner: sessionOwner(exec), canvas, media, ratio: args.ratio, phase: tool.name === 'video_prepare_image' ? 'reference_review' : videoResultState(result).phase, createdAt: Date.now() };
      try { await saveRecord(record); }
      catch { return { ...result, canvasSync: { status: 'failed', reason: '回填记录保存失败；生成成果已保留，请勿重新生成。' } }; }
      try { return { ...result, canvasSync: await sync(record.id, exec) }; }
      catch { return { ...result, canvasSync: { status: 'pending', token: record.id, reason: '画布回填未完成，成果已保留；调用video_canvas(action:sync,token)补传，不重新生成。' } }; }
    } };
  }
  const tool = { name: 'video_canvas', description: '与已启用的原版无限画布联动。list列出项目；read读取指定节点及上游脚本/分镜/素材并返回canvas定位和摘要，不生成不收费。之后按既有video_project审核与生成工具费用审批，video_generate/video_extend/video_prepare_image传canvas即自动回填成果节点。sync只补传此前失败的回填，不新增任务。严禁用画布自带生成工具绕过本插件审批。',
    parameters: { type: 'object', properties: { action: { type: 'string', enum: ['list','read','sync'] }, projectId: { type: 'string' }, canvasId: { type: 'string' }, nodeId: { type: 'string' }, token: { type: 'string' } }, required: ['action'] },
    output: { schema: { type: 'object' }, render(_args, value) { return [{ type: 'text', text: JSON.stringify(value) }]; } },
    timeoutMs: 600000, isConcurrencySafe() { return false; }, async execute(args, exec) {
      if (args.action === 'sync') return sync(args.token, exec);
      const adapter = await load();
      if (args.action === 'list') {
        const listed = await adapter.rpc.projectsList();
        return { projects: (Array.isArray(listed) ? listed : listed?.projects || listed?.items || []).map(p => ({ id: p.id, name: p.name, canvases: p.canvases, nodeIds: p.nodeIds })) };
      }
      if (args.action === 'read') return readCanvasInput(adapter, args);
      throw new Error('未知画布操作');
    } };
  return { wrap, tool };
}
