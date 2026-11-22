import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validateNpmBundle } from './npm-bundle.mjs';
const mirror = 'https://registry.npmmirror.com';
const currentPackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).name;

/** 同步任务成功不代表镜像可安装；必须核对 latest、声明、成品和完整性。 */
export async function syncNpmMirror({ name, version, request = fetch, attempts = 12, delayMs = 5000, wait = ms => new Promise(r => setTimeout(r,ms)), log = console.log }) {
  if (name !== currentPackage) throw Error(`Only the current package ${currentPackage} is synced to the China mirror; legacy package ${name || '(missing)'} is not updated`);
  if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(name || '')) throw Error('Invalid npm package name');
  const escaped = encodeURIComponent(name);
  async function metadata(host) {
    const response = await request(`${host}/${escaped}/latest?check=${Date.now()}`, {headers:{accept:'application/json','cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error(`Registry metadata HTTP ${response.status}`);
    return response.json();
  }
  const official = await metadata('https://registry.npmjs.org');
  version ||= official.version;
  if (!/^\d+\.\d+\.\d+$/.test(version || '') || official.version !== version || !official.dsh?.bundle || official.stub) throw Error('npm latest is not the expected installable stable bundle');
  const sourceUrl = new URL(official.dist?.tarball);
  if (sourceUrl.protocol !== 'https:' || sourceUrl.hostname !== 'registry.npmjs.org') throw Error('Unexpected npm archive host');
  const sourceResponse = await request(sourceUrl,{signal:AbortSignal.timeout(60000)});
  if (!sourceResponse.ok) throw Error(`npm archive not publicly downloadable: HTTP ${sourceResponse.status}; do not report mirror ready`);
  const source = Buffer.from(await sourceResponse.arrayBuffer());
  validateNpmBundle(source,{name,version});
  const checksum = createHash('sha512').update(source).digest('hex');
  const trigger = async () => {
    const response = await request(`${mirror}/-/package/${escaped}/syncs`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({syncUpstream:true,skipDependencies:true}),signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error(`Mirror sync HTTP ${response.status}`);
  };
  await trigger();
  let failure = 'mirror metadata has not caught up';
  for(let index=0;index<attempts;index++) {
    try {
      const current = await metadata(mirror);
      if (current.version !== version || current.stub || !current.dsh?.bundle) throw Error('mirror latest still points to an old or placeholder package');
      const url = new URL(current.dist?.tarball);
      if (url.protocol !== 'https:' || !['registry.npmmirror.com','cdn.npmmirror.com'].includes(url.hostname)) throw Error('Unexpected mirror archive host');
      const response = await request(url,{signal:AbortSignal.timeout(60000)});
      if (!response.ok) throw Error(`Mirror archive HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      validateNpmBundle(bytes,{name,version});
      if (createHash('sha512').update(bytes).digest('hex') !== checksum) throw Error('Mirror archive differs from npm original');
      log(`国内镜像已验证：${name}@${version}，dsh.bundle 及成品完整性正确`);
      return {name,version,verified:true};
    } catch(error) { failure = error.message; }
    if (index + 1 < attempts) {
      if (index === 3) await trigger();
      await wait(delayMs);
    }
  }
  throw Error(`npm published, mirror not ready: ${failure}. Retry node scripts/sync-npm-mirror.mjs ${name} ${version}; do not republish the same version`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) syncNpmMirror({name:process.argv[2],version:process.argv[3]}).catch(error=>{console.error(error.message);process.exitCode=1;});
