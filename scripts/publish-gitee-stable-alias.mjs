import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const GITEE_STABLE_URL = 'https://gitee.com/hackloop/metaontic-video/releases/download/latest/metaontic-video.tgz';
const root = 'https://gitee.com/hackloop/metaontic-video';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// 从已公开版本包复制原字节，避免本机与流水线重复打包造成两份不同成品。
export async function publishGiteeStableAlias({ token, tag, request = fetch, log = console.log }) {
  if (!token) throw new Error('Missing GITEE_TOKEN.');
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error('A stable version tag is required.');
  async function api(path, body) {
    const url = new URL(`${root.replace('gitee.com/', 'gitee.com/api/v5/repos/')}${path}`);
    if (!body) url.searchParams.set('access_token', token);
    const response = await request(url, { method: body ? 'POST' : 'GET', body, signal: AbortSignal.timeout(body ? 300000 : 60000) });
    if (!response.ok) throw new Error(`Gitee stable asset: HTTP ${response.status}`);
    return response.json();
  }
  async function download(name) {
    const response = await request(`${root}/releases/download/${tag}/${name}`, { signal: AbortSignal.timeout(300000), cache: 'no-store' });
    if (!response.ok) throw new Error(`Gitee download ${name}: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error('Gitee attachment is not gzip.');
    return bytes;
  }
  const release = await api(`/releases/tags/${tag}`);
  if (!release?.id || release.prerelease || release.draft) throw new Error('A published stable release is required.');
  const path = `/releases/${release.id}/attach_files`;
  const list = await api(path);
  if (!Array.isArray(list)) throw new Error('Invalid Gitee attachment list.');
  const sourceName = `metaontic-video-${tag.slice(1)}.tgz`;
  if (!list.some(item => (item.name || item.file_name) === sourceName)) throw new Error('Published version package is missing.');
  const source = await download(sourceName);
  const sha256 = digest(source);
  if (!list.some(item => (item.name || item.file_name) === 'metaontic-video.tgz')) {
    const form = new FormData();
    form.set('access_token', token);
    form.set('file', new Blob([source]), 'metaontic-video.tgz');
    try { await api(path, form); }
    catch (error) {
      // 上传结果不明先复查，不盲目重放上传；并发发布同名文件也只接受原成品。
      const current = await api(path);
      if (!Array.isArray(current) || !current.some(item => (item.name || item.file_name) === 'metaontic-video.tgz')) throw error;
    }
  }
  if (digest(await download('metaontic-video.tgz')) !== sha256) throw new Error('Gitee stable asset checksum mismatch; existing asset was not overwritten.');
  log(`Gitee ${tag} fixed asset verified: ${sha256}`);
  return { tag, sha256, url: GITEE_STABLE_URL };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  publishGiteeStableAlias({ token: process.env.GITEE_TOKEN, tag: process.argv[2] }).then(result => console.log(result.url)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
