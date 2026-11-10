/** 内置流程画布：本插件自己实现项目/资产接口，不依赖任何第三方画布插件。
 *  存储：~/.dsh/metaontic-video/canvas/projects/<id>.json（节点/连线/视图）与 canvas/data（素材）。
 *  读写接口与 readCanvasInput / publishCanvasResult / markCanvasChanged 的既有形状一致，直接复用。 */
import { mkdir, readFile, writeFile, rename, readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { dshHome } from '../../../core/paths.js';

export const BUILTIN_BACKEND = 'builtin';
const validId = (value: any) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const storeDir = () => path.join(dshHome(), 'metaontic-video', 'canvas');
const docsDir = () => path.join(storeDir(), 'projects');
const dataRootOf = () => path.join(storeDir(), 'data');
const assetsFile = () => path.join(storeDir(), 'assets.json');
const docFile = (id: any) => {
  if (!validId(id)) throw new Error('画布项目标识无效');
  return path.join(docsDir(), `${id}.json`);
};
async function readJson(file: string, fallback: any = null) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file: string, value: any) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  await rename(temp, file);
}
export async function builtinCanvasExists(projectId: any) {
  if (!validId(projectId)) return false;
  return Boolean(await readJson(docFile(projectId)));
}
async function readDoc(id: any) { return readJson(docFile(id)); }
async function writeDoc(id: any, doc: any) { await writeJson(docFile(id), doc); }
async function allDocs() {
  const names = await readdir(docsDir()).catch(() => []);
  const docs = [];
  for (const name of names) if (name.endsWith('.json')) {
    const doc = await readJson(path.join(docsDir(), name));
    if (doc?.id) docs.push(doc);
  }
  return docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
async function readAssets() { return (await readJson(assetsFile(), {})) || {}; }
async function writeAssets(assets: any) { await writeJson(assetsFile(), assets); }
const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** 同一份文档形状：nodes/edges/view/name/assets 分开存，name 与 defaultCanvasName 都给画布用。 */
function mergeDoc(id: string, prev: any, args: any) {
  const incoming = args?.doc || {};
  const tombstones = [...new Set([...(prev?.tombstones || []), ...(incoming.tombstones || [])])];
  const edgeTombstones = [...new Set([...(prev?.edgeTombstones || []), ...(incoming.edgeTombstones || [])])];
  const nodes: any = { ...(incoming.nodes !== undefined ? incoming.nodes : (prev?.nodes || {})) };
  const edges: any[] = [...(incoming.edges !== undefined ? incoming.edges : (prev?.edges || []))];
  for (const gone of tombstones) delete nodes[gone];
  const kept = edges.filter(edge => edge?.id && !edgeTombstones.includes(edge.id) && nodes[edge.fromNode] && nodes[edge.toNode]);
  return { id, createdAt: prev?.createdAt || incoming.createdAt || Date.now(), updatedAt: Date.now(),
    name: String(args?.name || prev?.name || id).slice(0, 80),
    ...(args?.defaultCanvasName !== undefined ? { defaultCanvasName: String(args.defaultCanvasName).slice(0, 80) }
      : prev?.defaultCanvasName !== undefined ? { defaultCanvasName: prev.defaultCanvasName } : {}),
    ...(incoming.bible !== undefined ? { bible: incoming.bible } : prev?.bible !== undefined ? { bible: prev.bible } : {}),
    nodes, edges, view: incoming.view || prev?.view || { x: 60, y: 40, scale: 1 },
    assets: { ...(prev?.assets || {}), ...(incoming.assets || {}) },
    tombstones, edgeTombstones, rev: (prev?.rev || 0) + 1, ...(incoming.ts ? { ts: incoming.ts } : {}) };
}

/** 只读/写入接口；不需要版本门，也不读写任何第三方插件配置。 */
export function builtinRpc() {
  return {
    async projectsGet(args: any) {
      const doc = await readDoc(args?.id);
      if (!doc) return { id: args?.id, nodes: {}, edges: [], missing: true };
      return { ...doc, nodeIds: Object.keys(doc.nodes || {}) };
    },
    async projectsPut(args: any) {
      const id = String(args?.id || '');
      const prev = await readDoc(id);
      const next = mergeDoc(id, prev, args);
      next.assets = { ...(prev?.assets || {}) };
      await writeDoc(id, next);
      return { ok: true, id, rev: next.rev };
    },
    async projectsList() {
      return (await allDocs()).map(doc => ({ id: doc.id, name: doc.name, updatedAt: doc.updatedAt, nodeIds: Object.keys(doc.nodes || {}), nodeCount: Object.keys(doc.nodes || {}).length }));
    },
    async projectsDelete(args: any) { await writeDoc(String(args?.id || ''), { id: args?.id, deleted: true, nodes: {}, edges: [], updatedAt: Date.now() }); return { ok: true, deleted: true }; },
    async assetsGet(args: any) {
      const assets = await readAssets();
      return { items: (args?.ids || []).map((id: string) => assets[id]).filter(Boolean) };
    },
    async assetCreate(args: any) {
      const asset = args?.asset;
      if (!asset?.id) throw new Error('画布资产标识无效');
      const assets = await readAssets();
      assets[asset.id] = { ...asset, projectName: args?.projectName || '' };
      await writeAssets(assets);
      const doc = await readDoc(asset.projectId);
      if (doc) { doc.assets = { ...(doc.assets || {}), [asset.id]: assets[asset.id] }; await writeDoc(doc.id, doc); }
      return { ok: true, id: asset.id };
    },
    async dataRootGet() { return { dataRoot: dataRootOf(), exists: true, store: 'builtin' }; },
    async projectDirGet(args: any) {
      const id = String(args?.projectId || '');
      if (!validId(id)) return { ok: false };
      return { ok: true, dataRoot: dataRootOf(), abs: path.join(dataRootOf(), 'projects', id) };
    },
    async canvasCreateProject(args: any) {
      const name = String(args?.name || '').trim().slice(0, 80) || 'MetaOntic 创作画布';
      const empty = (await allDocs()).find(doc => doc.name === name && !Object.keys(doc.nodes || {}).length && !doc.claimedBy);
      if (empty) return { ok: true, projectId: empty.id, name, reused: true };
      const id = newId();
      await writeDoc(id, { id, createdAt: Date.now(), updatedAt: Date.now(), name, nodes: {}, edges: [], view: { x: 60, y: 40, scale: 1 }, rev: 1 });
      return { ok: true, projectId: id, name };
    },
    async canvasRename(args: any) {
      const doc = await readDoc(args?.projectId);
      if (!doc) return { ok: false };
      doc.name = String(args?.name || doc.name).slice(0, 80); doc.updatedAt = Date.now(); doc.rev = (doc.rev || 0) + 1;
      await writeDoc(doc.id, doc);
      return { ok: true, id: doc.id, name: doc.name };
    },
    async canvasOpen() { return { ok: true }; },
  };
}

/** 幂等连线：同一条线已存在就原样返回，不重复、不改节点。 */
export function createBuiltinConnect() {
  return async (args: any) => {
    const id = String(args?.projectId || '');
    const doc = await readDoc(id);
    if (!doc?.nodes) return { ok: false };
    const from = String(args?.fromNode || ''), to = String(args?.toNode || '');
    if (!doc.nodes[from] || !doc.nodes[to]) return { ok: false };
    if ((doc.edges || []).some(edge => edge.fromNode === from && edge.toNode === to)) return { ok: true, already: true };
    const edge = { id: `mov_conn_${randomUUID().replaceAll('-', '').slice(0, 16)}`, fromNode: from, toNode: to,
      ...(args?.fromPort ? { fromPort: args.fromPort } : {}), ...(args?.toPort ? { toPort: args.toPort } : {}) };
    doc.edges = [...(doc.edges || []), edge]; doc.updatedAt = Date.now(); doc.rev = (doc.rev || 0) + 1;
    await writeDoc(id, doc);
    return { ok: true, id: edge.id };
  };
}

export function builtinCanvasAdapter() {
  const rpc: any = builtinRpc();
  return { backend: BUILTIN_BACKEND, rpc, assetPath: (root: string, asset: any) => path.resolve(root, String(asset?.rel || '')), connect: createBuiltinConnect() };
}

/** 画布列表给助手与面板共用：名字、更新时间与节点数。 */
export async function builtinCanvasList() {
  return (await allDocs()).map(doc => ({ projectId: doc.id, name: doc.name, updatedAt: doc.updatedAt || 0, nodeCount: Object.keys(doc.nodes || {}).length }));
}

/** 读取必须存在的画布文档；不存在或已删除就停住，不静默新建。 */
async function requireDoc(projectId: any) {
  const doc = await readDoc(projectId);
  if (!doc || doc.deleted) throw new Error('画布不存在或已删除。');
  return doc;
}
/** 面板读取/编辑用的接口：只暴露内置画布自己的文档，不碰其他插件的存储与配置。 */
export async function builtinCanvasHandle(args: any) {
  const method = String(args?.method || '');
  const params = args?.args || {};
  if (method === 'list') return { canvases: await builtinCanvasList() };
  if (method === 'get') {
    const doc = await readDoc(params.projectId);
    if (!doc || doc.deleted) throw new Error('画布不存在或已删除。');
    return { canvas: { projectId: doc.id, name: doc.name, updatedAt: doc.updatedAt || 0, view: doc.view || { x: 60, y: 40, scale: 1 },
      nodes: doc.nodes || {}, edges: doc.edges || [], dataRoot: dataRootOf() } };
  }
  if (method === 'rename') {
    const doc = await readDoc(params.projectId);
    if (!doc) throw new Error('画布不存在或已删除。');
    const name = String(params.name || '').trim().slice(0, 80);
    if (!name) throw new Error('画布名不能为空。');
    doc.name = name; doc.updatedAt = Date.now(); doc.rev = (doc.rev || 0) + 1;
    await writeDoc(doc.id, doc);
    return { canvas: { projectId: doc.id, name: doc.name } };
  }
  if (method === 'nodeSave') {
    const doc = await requireDoc(params.projectId);
    const incoming = params.node || {};
    const id = String(incoming.id || '');
    if (!validId(id)) throw new Error('节点标识无效。');
    if (doc.tombstones?.includes(id)) throw new Error('该节点已删除，不自动复活；请新建节点。');
    const prev = doc.nodes?.[id];
    const type = String(incoming.type || prev?.type || 'text');
    if (!['text', 'script', 'storyboard', 'shot', 'image', 'video'].includes(type)) throw new Error('节点类型不支持。');
    // 只接受界面能编辑的创作字段，其余（成果标识、来源关系等）沿用原值，避免误伤回填与投影。
    const data = { ...(prev?.data || {}), ...(incoming.data || {}) };
    for (const key of ['label', 'prompt', 'text', 'output', 'script', 'requirement', 'ratio', 'resolution'] ) {
      if (incoming.data && key in incoming.data) data[key] = String(incoming.data[key] ?? '');
    }
    if (incoming.data && 'duration' in incoming.data) {
      const duration = Number(incoming.data.duration);
      data.duration = Number.isFinite(duration) && duration > 0 ? duration : null;
    }
    const node = { id, type, x: Number.isFinite(Number(incoming.x)) ? Number(incoming.x) : Number(prev?.x) || 0,
      y: Number.isFinite(Number(incoming.y)) ? Number(incoming.y) : Number(prev?.y) || 0,
      w: Number(incoming.w) || Number(prev?.w) || 360, h: Number(incoming.h) || Number(prev?.h) || 280, data };
    doc.nodes = { ...(doc.nodes || {}), [id]: node }; doc.updatedAt = Date.now(); doc.rev = (doc.rev || 0) + 1;
    await writeDoc(doc.id, doc);
    return { canvas: { projectId: doc.id, node, rev: doc.rev } };
  }
  if (method === 'nodeDelete') {
    const doc = await requireDoc(params.projectId);
    const id = String(params.nodeId || '');
    if (!doc.nodes?.[id]) throw new Error('节点不存在或已删除。');
    const nodes = { ...doc.nodes }; delete nodes[id];
    const edges = (doc.edges || []).filter(edge => edge.fromNode !== id && edge.toNode !== id);
    const goneEdges = (doc.edges || []).filter(edge => edge.fromNode === id || edge.toNode === id).map(edge => edge.id);
    doc.nodes = nodes; doc.edges = edges;
    doc.tombstones = [...new Set([...(doc.tombstones || []), id])];
    doc.edgeTombstones = [...new Set([...(doc.edgeTombstones || []), ...goneEdges])];
    doc.updatedAt = Date.now(); doc.rev = (doc.rev || 0) + 1;
    await writeDoc(doc.id, doc);
    return { canvas: { projectId: doc.id, removed: id, rev: doc.rev } };
  }
  if (method === 'edgeAdd') {
    const doc = await requireDoc(params.projectId);
    const from = String(params.fromNode || ''), to = String(params.toNode || '');
    if (!doc.nodes?.[from] || !doc.nodes?.[to]) throw new Error('连线两端节点必须在场。');
    if (from === to) throw new Error('不能连接同一个节点。');
    const existing = (doc.edges || []).find(edge => edge.fromNode === from && edge.toNode === to);
    if (existing) return { canvas: { projectId: doc.id, edge: existing, already: true } };
    const edge = { id: `mov_connect_${randomUUID().replaceAll('-', '').slice(0, 16)}`, fromNode: from, toNode: to,
      fromPort: String(params.fromPort || 'out').slice(0, 24), toPort: String(params.toPort || 'prompt').slice(0, 24) };
    doc.edges = [...(doc.edges || []), edge];
    if (doc.edgeTombstones?.includes(edge.id)) doc.edgeTombstones = doc.edgeTombstones.filter(x => x !== edge.id);
    doc.updatedAt = Date.now(); doc.rev = (doc.rev || 0) + 1;
    await writeDoc(doc.id, doc);
    return { canvas: { projectId: doc.id, edge, rev: doc.rev } };
  }
  if (method === 'edgeDelete') {
    const doc = await requireDoc(params.projectId);
    const id = String(params.edgeId || '');
    const edge = (doc.edges || []).find(item => item.id === id);
    if (!edge) throw new Error('连线不存在或已删除。');
    doc.edges = (doc.edges || []).filter(item => item.id !== id);
    // 记墓碑，避免同步或回填把用户删掉的自动线又加回来。
    if (id.startsWith('mov_connect_') || id.startsWith('mov_edge_') || id.includes('_edge_')) doc.edgeTombstones = [...new Set([...(doc.edgeTombstones || []), id])];
    doc.updatedAt = Date.now(); doc.rev = (doc.rev || 0) + 1;
    await writeDoc(doc.id, doc);
    return { canvas: { projectId: doc.id, removed: id, rev: doc.rev } };
  }
  throw new Error('未知画布操作。');
}

/** 浏览器端访问；统一限定同源 POST 与 JSON。 */
export function registerBuiltinCanvas(ctx) {
  return ctx.inject(['webServer'], scope => {
    if (typeof scope.webServer?.register !== 'function') return;
    // 成果素材回看：只允许读内置画布数据根里的已登记资产，路径校验后原样流出。
    const removeMedia = scope.webServer.register({ kind: 'exact', path: '/metaontic-video/canvas-media', async handler(req, res) {
      try {
        if (req.method !== 'GET') throw new Error('仅接受GET。');
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        if (req.headers['sec-fetch-site'] === 'cross-site') throw new Error('请求来源无效。');
        const assets = await readAssets();
        const asset = assets[String(url.searchParams.get('assetId') || '')];
        const root = dataRootOf();
        if (!asset?.rel) throw new Error('素材不存在。');
        const file = path.resolve(root, String(asset.rel));
        if (!file.startsWith(root + path.sep)) throw new Error('素材路径无效。');
        const info = await stat(file);
        if (!info.isFile()) throw new Error('素材不存在。');
        res.setHeader('content-type', asset.mime || 'application/octet-stream');
        res.setHeader('content-length', String(info.size));
        res.setHeader('cache-control', 'private, max-age=300');
        createReadStream(file).pipe(res);
      } catch (e: any) { res.statusCode = 404; res.end(); }
    } });
    const remove = scope.webServer.register({ kind: 'exact', path: '/metaontic-video/canvas', async handler(req, res) {
      res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store');
      try {
        if (req.method !== 'POST') throw new Error('仅接受POST。');
        if (req.headers['sec-fetch-site'] === 'cross-site' || (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)) throw new Error('请求来源无效。');
        if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('请求类型无效。');
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 200000) throw new Error('请求过大。'); }
        res.end(JSON.stringify(await builtinCanvasHandle(JSON.parse(raw))));
      } catch (e: any) { res.statusCode = 400; res.end(JSON.stringify({ error: String(e?.message || '画布操作未完成。') })); }
    } });
    return () => { if (typeof remove === 'function') remove(); if (typeof removeMedia === 'function') removeMedia(); };
  });
}
