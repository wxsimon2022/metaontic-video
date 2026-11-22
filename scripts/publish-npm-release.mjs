import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { main as publishNpm } from './publish-npm.mjs';
import { syncNpmMirror } from './sync-npm-mirror.mjs';
const currentPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name;

/** 续跑不覆盖 npm 版本；已存在时核对原字节，再验证中国镜像同步。 */
export async function publishNpmRelease({name,version,archive,request=fetch,publish=publishNpm,sync=syncNpmMirror}) {
  if (name !== currentPackage) throw Error(`Only ${currentPackage} is published and mirrored by this release workflow; legacy package ${name || '(missing)'} is disabled`);
  const response=await request(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`,{signal:AbortSignal.timeout(15000)});
  if(response.status===404) { await publish([version]);return; }
  if(!response.ok)throw Error(`npm 版本查询失败：HTTP ${response.status}；保留已完成的仓库发行版，使用 --all --resume 续跑`);
  const manifest=await response.json();
  if(manifest.name!==name||manifest.version!==version||!manifest.dsh?.bundle?.patch)throw Error('npm 已存在版本不是预期组合包，禁止覆盖');
  const url=new URL(manifest.dist?.tarball);
  if(url.protocol!=='https:'||url.hostname!=='registry.npmjs.org')throw Error('npm 成品地址不可信');
  const download=await request(url,{signal:AbortSignal.timeout(60000)});
  if(!download.ok)throw Error(`npm 成品下载失败：HTTP ${download.status}`);
  const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
  if(digest(Buffer.from(await download.arrayBuffer()))!==digest(readFileSync(archive)))throw Error('npm 已存在版本与已发布成品不同，禁止覆盖或宣称三端一致');
  await sync({name,version});
}
