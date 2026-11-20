import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const root=await mkdtemp(path.join(os.tmpdir(),'统计 并发 '));
const moduleFile=path.join(root,'identity.mjs');
await build({stdin:{contents:"export { analyticsIdentity } from './src/platform/telemetry/reporter.ts';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:moduleFile});
const moduleUrl=pathToFileURL(moduleFile).href;
const api=await import(moduleUrl);
after(()=>rm(root,{recursive:true,force:true}));
const child=async(home)=>{
 const {stdout}=await exec(process.execPath,['--input-type=module','-e',`import {analyticsIdentity} from ${JSON.stringify(moduleUrl)}; console.log(await analyticsIdentity());`],{env:{...process.env,DSH_HOME:home,METAONTIC_VIDEO_ANALYTICS_DISABLED:'1'},timeout:15000});
 return stdout.trim();
};
test('真实多进程首次启动只产生一个匿名身份，原子落盘且无残留锁',async()=>{
 const home=path.join(root,'same device');
 const ids=await Promise.all(Array.from({length:12},()=>child(home)));
 assert.match(ids[0],/^[a-f0-9-]{36}$/);assert.equal(new Set(ids).size,1);
 const dir=path.join(home,'state','metaontic-video');
 for(const name of ['analytics-id.json','analytics-anchor.json'])assert.equal(JSON.parse(await readFile(path.join(dir,name),'utf8')).installationId,ids[0]);
 await assert.rejects(readFile(path.join(dir,'analytics-identity.lock')),{code:'ENOENT'});
 await unlink(path.join(dir,'analytics-id.json'));assert.equal(await child(home),ids[0]);
});
test('首次读写失败不永久缓存 null，目录恢复后可再次初始化',async()=>{
 const home=path.join(root,'blocked-home');await writeFile(home,'blocked');
 const old=process.env.DSH_HOME;process.env.DSH_HOME=home;
 try{
  assert.equal(await api.analyticsIdentity(),null);
  await unlink(home);await mkdir(home);
  assert.match(await api.analyticsIdentity(),/^[a-f0-9-]{36}$/);
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;}
});

test('活跃进程锁不被超时夺取，解锁后下次调用可以继续',async()=>{
 const home=path.join(root,'active-lock');const dir=path.join(home,'state','metaontic-video');await mkdir(dir,{recursive:true});
 const lock=path.join(dir,'analytics-identity.lock');
 const record={pid:process.pid,host:os.hostname(),token:'12345678-1234-1234-1234-123456789abc'};
 await writeFile(lock,JSON.stringify(record));assert.equal(await child(home),'null');
 assert.equal(JSON.parse(await readFile(lock,'utf8')).token,record.token);
 await unlink(lock);assert.match(await child(home),/^[a-f0-9-]{36}$/);
});
