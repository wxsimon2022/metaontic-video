import { previewMediaFromBlock, remoteMediaUrl } from '../client/media-preview.js';

export interface LibraryAsset {
  id: string;
  kind: 'image' | 'video';
  category: 'reference' | 'image' | 'segment' | 'film';
  label: string;
  name: string;
  localPath?: string;
  url?: string;
  attachment?: any;
  creation?: { toolName: string; round: number };
  order: number;
}
const TOOLS = new Set(['video_generate', 'video_extend', 'video_status', 'video_prepare_image', 'video_project', 'film_project']);
/** 浏览器端解析路径，保留 Windows 盘符；仅解析会话明确引用，不扫描目录。 */
export function assetPath(value: unknown, cwd = '') {
  if (typeof value !== 'string') return '';
  let file = value.trim().replace(/^@/, '').replace(/^(["'])(.*)\1$/, '$2');
  if (!file || /[\u0000-\u001f\u007f]/.test(file) || /^[a-z][a-z\d+.-]*:/i.test(file) && !/^[a-z]:[/\\]/i.test(file) || /^[/\\]{2}/.test(file)) return '';
  file = file.replace(/\\/g, '/');
  if (!/^(?:\/|[a-z]:\/)/i.test(file)) {
    if (!/^(?:\/(?!\/)|[a-z]:[/\\])/i.test(cwd)) return '';
    file = cwd.replace(/\\/g, '/').replace(/\/$/, '') + '/' + file;
  }
  const drive = /^[a-z]:/i.exec(file)?.[0] || '';
  const parts: string[] = [];
  for (const part of file.slice(drive.length).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop(); else parts.push(part);
  }
  return drive + '/' + parts.join('/');
}
function filename(value: string) {
  try { return decodeURIComponent(value.split(/[?#]/)[0].split(/[/\\]/).pop() || ''); } catch { return '素材'; }
}
/** 每次从当前会话快照重建；不保留跨会话缓存，不把请求配置带入资产数据。 */
export function collectLibraryAssets(chat: any, cwd = ''): LibraryAsset[] {
  const result: LibraryAsset[] = [], aliases = new Map<string, LibraryAsset>();
  let order = 0, round = 0;
  function add(input: any, category: LibraryAsset['category']) {
    const localPath = assetPath(input.localPath, cwd);
    const url = remoteMediaUrl(input.url);
    const attachment = input.attachment;
    const keys = [localPath && (/^[a-z]:/i.test(localPath) ? localPath.toLowerCase() : localPath), url,
      attachment?.attachmentId && `attachment:${attachment.attachmentId}`].filter(Boolean);
    if (!keys.length || !['image', 'video'].includes(input.kind)) return;
    const matches = [...new Set(keys.map(key => aliases.get(key)).filter(Boolean))];
    let item = matches[0];
    // A later result can bridge a URL-only record and a local-only record.
    for (const duplicate of matches.slice(1)) {
      Object.assign(item, { ...duplicate, ...item });
      result.splice(result.indexOf(duplicate), 1);
      for (const [key, value] of aliases) if (value === duplicate) aliases.set(key, item);
    }
    const label = String(input.label || (input.kind === 'image' ? '图片' : '视频')).slice(0, 180);
    if (!item) {
      item = { id: keys[0], kind: input.kind, category, label, name: filename(localPath || url) || String(attachment?.name || '参考图'), order: order++ };
      result.push(item);
    }
    if (localPath) item.localPath = localPath;
    if (url) item.url = url;
    if (attachment) item.attachment = attachment;
    if (category !== 'reference') { item.category = category; item.label = label; }
    if (input.creation) item.creation = input.creation;
    for (const key of keys) aliases.set(key, item);
  }
  function reference(value: any, label: string, kind: 'image' | 'video' = 'image') {
    for (const entry of Array.isArray(value) ? value : [value]) {
      if (typeof entry !== 'string' || entry.trim() === 'latest') continue;
      const url = remoteMediaUrl(entry);
      // 不把内联图片、asset:// 或任意协议当本地文件。
      add({ kind, label, ...(url ? { url } : { localPath: entry }) }, 'reference');
    }
  }
  const seen = new Set();
  function visit(block: any) {
    if (!block || typeof block !== 'object' || seen.has(block)) return;
    seen.add(block);
    const name = block.call?.name || block.name;
    if (TOOLS.has(name)) {
      let args: any = block.args || {};
      const raw = block.call?.argsRaw || block.argsRaw;
      if (typeof raw === 'string') { try { args = JSON.parse(raw); } catch { args = {}; } }
      else if (typeof args.value === 'function') {
        const view = args; args = {};
        for (const key of ['specification', 'referenceImages', 'characterReferenceImages', 'shotFrames']) args[key] = view.value(key);
        for (const key of ['firstFrameUrl', 'lastFrameUrl', 'videoUrl', 'image']) args[key] = view.text(key);
      }
      const spec = args.specification || args;
      reference(spec.firstFrameUrl, '首帧参考'); reference(spec.lastFrameUrl, '尾帧参考');
      reference(spec.referenceImages, '参考图'); reference(spec.characterReferenceImages, '角色参考图');
      reference(spec.videoUrl, '参考视频', 'video');
      if (name === 'video_prepare_image') reference(args.image, '转换前参考图');
      for (const frame of Array.isArray(spec.shotFrames) ? spec.shotFrames : []) {
        reference(frame.firstFrameUrl, '镜头首帧'); reference(frame.lastFrameUrl, '镜头尾帧');
      }
      for (const item of previewMediaFromBlock(block, name)) {
        const category = item.kind === 'image' ? 'image' : /合并|完整|成片/.test(item.label || '') ? 'film' : 'segment';
        add({ ...item, ...(['video_generate', 'video_extend', 'video_prepare_image'].includes(name) ? { creation: { toolName: name, round } } : {}) }, category);
      }
    }
    for (const child of block.subCalls || []) visit(child);
  }
  const nodes = chat?.nodes?.values?.() ?? [];
  for (const node of nodes) {
    if (node?.kind === 'user' || node?.kind === 'steering') {
      round++;
      for (const part of Array.isArray(node.data?.content) ? node.data.content : []) {
        if (part.type === 'image' && part.attachment?.attachmentId) add({ kind: 'image', label: '上传参考图', attachment: part.attachment }, 'reference');
      }
    }
    if (node?.kind === 'tool-call') visit(node.data?.root);
  }
  return result.reverse();
}
export function filterLibraryAssets(items: LibraryAsset[], kind: string, search: string) {
  const query = search.trim().toLocaleLowerCase();
  return items.filter(item => (kind === 'all' || (kind === 'image' || kind === 'video' ? item.kind === kind : item.category === kind))
    && (!query || `${item.label} ${item.name}`.toLocaleLowerCase().includes(query)));
}
