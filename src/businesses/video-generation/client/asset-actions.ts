import { assetPath } from '../assets/catalog.js';
import { remoteMediaUrl } from './media-preview.js';

/** Only explicit @ mentions in the unsent draft; never inspect other sessions or files. */
export function draftMediaReferences(draft: string, cwd = '') {
  const result: any[] = [], seen = new Set<string>();
  const pattern = /@(?:"((?:\\.|[^"\\])*)"|'([^']*)'|([^\s@]+))/g;
  for (const match of String(draft || '').matchAll(pattern)) {
    if (match.index && !/[\s([{（，,]/.test(draft[match.index - 1])) continue;
    let value = match[2] ?? match[3] ?? '';
    if (match[1] !== undefined) {
      try { value = JSON.parse('"' + match[1] + '"'); } catch { value = match[1]; }
    }
    const url = remoteMediaUrl(value), localPath = url ? '' : assetPath(value, cwd);
    let pathname = localPath;
    if (url) pathname = new URL(url).pathname;
    const kind = /\.(?:png|jpe?g|webp|gif|avif)$/i.test(pathname) ? 'image'
      : /\.(?:mp4|mov|webm|m4v)$/i.test(pathname) ? 'video' : '';
    if (!kind || !url && !localPath) continue;
    const key = /^[a-z]:/i.test(localPath) ? localPath.toLowerCase() : localPath || url;
    if (seen.has(key)) continue;
    seen.add(key);
    let name = pathname.split('/').pop() || '素材';
    try { name = decodeURIComponent(name); } catch { /* display original basename */ }
    result.push({ id: key, kind, name, label: name, localPath, url, start: match.index, end: match.index + match[0].length });
    if (result.length === 20) break;
  }
  return result;
}

export function assetReferenceRequest(item: any, role = 'reference') {
  const source = assetPath(item.localPath) || remoteMediaUrl(item.url);
  if (!source) return '';
  const labels = { first: '首帧', last: '尾帧', reference: item.kind === 'video' ? '参考视频' : '参考图' };
  if (!labels[role] || item.kind !== 'image' && role !== 'reference') return '';
  return `使用 @${JSON.stringify(source)} 作为${labels[role]}。`;
}

export function assetRemakeRequest(item: any, note = '') {
  if (item.kind !== 'video' || item.category !== 'segment' || !item.creation
      || !['video_generate', 'video_extend'].includes(item.creation.toolName)) return '';
  const source = assetPath(item.localPath) || remoteMediaUrl(item.url);
  if (!source) return '';
  const change = note.trim().slice(0, 2000);
  return `请${change ? '按以下修改需求' : '沿用原参数'}重做 @${JSON.stringify(source)} 对应的镜头或分段。`
    + (change ? `\n修改需求：${change}` : '')
    + '\n先核对原任务、已批准脚本与参考素材，只重做选中的镜头或分段，保留其他已完成结果。'
    + '无法准确定位或无法单独重做时，先让我确认方案。沿用现有脚本审核及制作费用确认流程。';
}

export function appendAssetDraft(draft: string, request: string) {
  return request ? (draft ? draft + '\n\n' + request : request) : draft;
}
