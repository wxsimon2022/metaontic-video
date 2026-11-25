import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, realpath, lstat, readdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dshHome } from '../media/references.js';

const LIMIT = 100 * 1024 * 1024;
export class AssetError extends Error { constructor(public status: number, public code: string) { super(code); } }
/** 只接受已登记的工作区；无法获取清单时拒绝，不退回任意目录。 */
export async function resolveAssetWorkspace(ctx: any, requested: string) {
  if (!requested || !path.isAbsolute(requested) || /[\u0000-\u001f]/.test(requested)) throw new AssetError(400, 'workspace_required');
  let roots: string[] = [];
  try {
    const registry = ctx.get?.('workspaceRegistry');
    const rows = await registry?.list?.();
    if (Array.isArray(rows)) roots = rows.map(row => typeof row === 'string' ? row : row?.path).filter(value => typeof value === 'string');
  } catch { /* Fall back to the host's persisted workspace registry. */ }
  if (!roots.length) {
    try {
      const doc = JSON.parse(await readFile(path.join(dshHome(), 'storages', 'workspace.json'), 'utf8'));
      roots = Object.values(doc?.tables?.workspaces || {}).map((row: any) => row?.path).filter(value => typeof value === 'string');
    } catch { /* Fail closed below. */ }
  }
  const target = await realpath(requested).catch(() => { throw new AssetError(400, 'workspace_unavailable'); });
  const compare = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;
  for (const root of roots) {
    const canonical = await realpath(root).catch(() => '');
    if (canonical && compare(canonical) === compare(target)) return target;
  }
  throw new AssetError(403, 'workspace_not_registered');
}
async function assetFolder(project: string, create = false) {
  let current = project;
  for (const part of ['metaontic-video', 'assets']) {
    current = path.join(current, part);
    if (create) await mkdir(current, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const info = await lstat(current).catch(error => { if (!create && error.code === 'ENOENT') return null; throw error; });
    if (!info) return null;
    if (!info.isDirectory() || info.isSymbolicLink()) throw new AssetError(403, 'asset_directory_invalid');
  }
  return current;
}
function mediaType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { ext: 'png', kind: 'image' };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { ext: 'jpg', kind: 'image' };
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'))) return { ext: 'gif', kind: 'image' };
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return { ext: 'webp', kind: 'image' };
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString() === 'ftyp' && /^(isom|iso[2-9]|mp4[12]|avc1|M4V |qt  |MSNV|dash)$/.test(bytes.subarray(8, 12).toString())) return { ext: bytes.subarray(8, 12).toString() === 'qt  ' ? 'mov' : 'mp4', kind: 'video' };
  if (bytes.subarray(0, 4).equals(Buffer.from([26,69,223,163]))) return { ext: 'webm', kind: 'video' };
  throw new AssetError(415, 'unsupported_media');
}
function displayName(value: string) {
  return String(value || '素材').replace(/\\/g, '/').split('/').pop()!.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160) || '素材';
}
export async function saveLibraryUpload(project: string, name: string, input: AsyncIterable<Buffer>, declaredSize = 0) {
  if (declaredSize > LIMIT) throw new AssetError(413, 'asset_too_large');
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of input) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > LIMIT) throw new AssetError(413, 'asset_too_large'); chunks.push(bytes); }
  const bytes = Buffer.concat(chunks), type = mediaType(bytes);
  if (type.kind === 'image' && size > 20 * 1024 * 1024) throw new AssetError(413, 'asset_too_large');
  const folder = await assetFolder(project, true);
  const id = createHash('sha256').update(bytes).digest('hex');
  const filename = `${id}.${type.ext}`, localPath = path.join(folder!, filename);
  const metadata = { id, name: displayName(name), kind: type.kind, filename, size, createdAt: new Date().toISOString() };
  // 独立内容寻址文件，无共享JSON台账；临时文件写完再原子替换。
  const temp = path.join(folder!, `.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, bytes, { flag: 'wx', mode: 0o600 });
    const existing = await lstat(localPath).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (existing?.isSymbolicLink() || existing && !existing.isFile()) throw new AssetError(403, 'asset_file_invalid');
    if (existing) {
      if (createHash('sha256').update(await readFile(localPath)).digest('hex') !== id) throw new AssetError(409, 'asset_content_changed');
    } else await rename(temp, localPath);
    const metaPath = path.join(folder!, `${id}.json`);
    await writeFile(metaPath, JSON.stringify(metadata), { flag: 'wx', mode: 0o600 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
  } finally { await rm(temp, { force: true }).catch(() => {}); }
  return { ...metadata, localPath, category: 'reference', label: metadata.name };
}
export async function listLibraryUploads(project: string) {
  const folder = await assetFolder(project);
  if (!folder) return [];
  const items = [];
  const names = (await readdir(folder)).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).sort();
  for (const name of names.slice(0, 1000)) {
    try {
      const metaPath = path.join(folder, name);
      if (!(await lstat(metaPath)).isFile() || (await lstat(metaPath)).isSymbolicLink()) continue;
      const meta = JSON.parse(await readFile(metaPath, 'utf8'));
      if (!new RegExp(`^${name.slice(0,-5)}\\.(png|jpg|gif|webp|mp4|mov|webm)$`).test(meta.filename)) continue;
      const localPath = path.join(folder, meta.filename), info = await lstat(localPath);
      if (!info.isFile() || info.isSymbolicLink()) continue;
      items.push({ id: name.slice(0,-5), kind: /\.(mp4|mov|webm)$/.test(meta.filename) ? 'video' : 'image', name: displayName(meta.name), localPath, category: 'reference', label: displayName(meta.name), size: info.size, createdAt: String(meta.createdAt || '') });
    } catch { /* Missing or malformed entries do not hide other materials. */ }
  }
  return items.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
