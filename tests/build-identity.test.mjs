import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {sourceIdentity,verifyBuild,BUILD_OUTPUTS,digest} from '../scripts/build-identity.mjs';
test('stale source/version and tampered artifacts cannot be packed as current',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'plugin-build-'));
 try{
  for(const folder of ['src','skills','locale/presets','scripts','dist/presets','dist/locale'])await mkdir(path.join(root,folder),{recursive:true});
  for(const file of ['package.json','package-lock.json','LICENSE','THIRD_PARTY_NOTICES.md','cordis.patch.yml','plugin-detail.md','scripts/build.mjs','scripts/build-identity.mjs','scripts/package-description.mjs','src/index.ts'])await writeFile(path.join(root,file),file==='package.json'?'{"version":"1.0.0"}':'original');
  for(const file of BUILD_OUTPUTS)await writeFile(path.join(root,file),file);
  const buildId=await sourceIdentity(root);
  assert.equal(await sourceIdentity(root),buildId);
  const files=Object.fromEntries(await Promise.all(BUILD_OUTPUTS.map(async f=>[f,digest(await readFile(path.join(root,f)))])));
  await writeFile(path.join(root,'dist/build-info.json'),JSON.stringify({version:'1.0.0',buildId,files}));
  assert.equal((await verifyBuild(root)).buildId,buildId);
  await writeFile(path.join(root,'src/index.ts'),'updated');
  assert.notEqual(await sourceIdentity(root),buildId);
  await assert.rejects(verifyBuild(root),/STALE_BUILD/);
  await writeFile(path.join(root,'src/index.ts'),'original');
  await writeFile(path.join(root,'package.json'),'{"version":"1.0.1"}');
  await assert.rejects(verifyBuild(root),/STALE_BUILD/);
  await writeFile(path.join(root,'package.json'),'{"version":"1.0.0"}');
  await writeFile(path.join(root,'dist/client.js'),'old cached client');
  await assert.rejects(verifyBuild(root),/BUILD_OUTPUT_MISMATCH/);
 }finally{await rm(root,{recursive:true,force:true});}
});
