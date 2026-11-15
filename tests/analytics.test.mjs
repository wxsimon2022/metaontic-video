import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate as tick} from 'node:timers/promises';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {api} from './module-test-api.mjs';
const id='42acda42-69d1-49d9-b60a-955ba8da12b4';
function fixture(request=async()=>({ok:true}),extra={}){
 return api.createAnalyticsReporter({}, {enabled:()=>true,identity:async()=>id,delayMs:100000,timeoutMs:15,request,started:new Set(),device:()=>({arch:'arm64',osRelease:'25.1.0',memoryGb:16,harnessVersion:'0.2.0'}),...extra});
}
const UUID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** 匿名身份的两个落盘位置：主文件 + 冗余锚点。测试全部走真实实现，不注入 identity。 */
const identityDir = (home) => path.join(home, 'state', 'metaontic-video');
const identityPath = (home, name = 'analytics-id.json') => path.join(identityDir(home), name);
const readIdentityFile = async (file) => JSON.parse(await readFile(file, 'utf8'));
async function withHome(fn) {
 const root = await mkdtemp(path.join(os.tmpdir(), '统计 身份 ')), old = process.env.DSH_HOME;
 process.env.DSH_HOME = root;
 try { return await fn(root); }
 finally { if (old === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = old; await rm(root, { recursive: true, force: true }); }
}
test('匿名安装标识同机只发一份：重复与并发调用都是同一个 ID，两个落盘文件内容一致', async () => {
 await withHome(async (root) => {
  const first = await api.analyticsIdentity();
  assert.match(first, UUID_RE);
  assert.equal(await api.analyticsIdentity(), first, '同一进程重复调用不换身份');
  const concurrent = await Promise.all([api.analyticsIdentity(), api.analyticsIdentity(), api.analyticsIdentity()]);
  assert.deepEqual(concurrent, [first, first, first], '并发调用也只有一个身份');
  assert.equal((await readIdentityFile(identityPath(root))).installationId, first);
  assert.equal((await readIdentityFile(identityPath(root, 'analytics-anchor.json'))).installationId, first, '锚点与主文件同源');
 });
});
test('只有一个文件留下时仍用同一个身份：主文件丢了用锚点补回来，锚点丢了用主文件补回来', async () => {
 await withHome(async (root) => {
  const id = await api.analyticsIdentity();
  // 主文件被删（手删或清状态），锚点还在：换一个宿主目录模拟「同一个锚点、没有主文件」。
  const mirrorOnly = path.join(root, '镜像 宿主');
  await mkdir(identityDir(mirrorOnly), { recursive: true });
  await copyFile(identityPath(root, 'analytics-anchor.json'), identityPath(mirrorOnly, 'analytics-anchor.json'));
  process.env.DSH_HOME = mirrorOnly;
  assert.equal(await api.analyticsIdentity(), id, '主文件没了也不是新设备');
  assert.equal((await readIdentityFile(identityPath(mirrorOnly))).installationId, id, '主文件被补回来');
  // 反过来：锚点被删，主文件还在。
  const primaryOnly = path.join(root, '另一 宿主');
  await mkdir(identityDir(primaryOnly), { recursive: true });
  await copyFile(identityPath(root), identityPath(primaryOnly));
  process.env.DSH_HOME = primaryOnly;
  assert.equal(await api.analyticsIdentity(), id);
  assert.equal((await readIdentityFile(identityPath(primaryOnly, 'analytics-anchor.json'))).installationId, id, '锚点被补回来');
 });
});
test('身份文件坏掉或对不上时按主文件为准并自愈，两边都读不出才重新分配', async () => {
 await withHome(async (root) => {
  const dir = identityDir(root);
  await mkdir(dir, { recursive: true });
  const good = '42acda42-69d1-49d9-b60a-955ba8da12b4', other = '11111111-2222-3333-4444-555555555555';
  // 锚点有效、主文件是垃圾：回落到锚点，并把主文件改写成有效值。
  await writeFile(identityPath(root, 'analytics-anchor.json'), JSON.stringify({ installationId: good }));
  await writeFile(identityPath(root), 'not json at all');
  assert.equal(await api.analyticsIdentity(), good);
  assert.equal((await readIdentityFile(identityPath(root))).installationId, good);
  // 两个文件对不上（备份还原 / 手改）：主文件为准，锚点被对齐。
  const clash = path.join(root, '冲突 宿主');
  await mkdir(identityDir(clash), { recursive: true });
  await writeFile(identityPath(clash), JSON.stringify({ installationId: good }));
  await writeFile(identityPath(clash, 'analytics-anchor.json'), JSON.stringify({ installationId: other }));
  process.env.DSH_HOME = clash;
  assert.equal(await api.analyticsIdentity(), good, '主文件优先，身份不被锚点带走');
  assert.equal((await readIdentityFile(identityPath(clash, 'analytics-anchor.json'))).installationId, good);
  // 两边都不是合法 UUID：当作首次启用，重新分配并覆盖。
  const broken = path.join(root, '损坏 宿主');
  await mkdir(identityDir(broken), { recursive: true });
  await writeFile(identityPath(broken), JSON.stringify({ installationId: 'nope' }));
  await writeFile(identityPath(broken, 'analytics-anchor.json'), JSON.stringify({ installationId: '' }));
  process.env.DSH_HOME = broken;
  const fresh = await api.analyticsIdentity();
  assert.match(fresh, UUID_RE);
  assert.equal((await readIdentityFile(identityPath(broken))).installationId, fresh);
  assert.equal((await readIdentityFile(identityPath(broken, 'analytics-anchor.json'))).installationId, fresh);
 });
});
test('analytics payload contains only allowlisted metadata and approved basic device fields',async()=>{
 let body;const r=fixture(async(_url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.deepEqual(Object.keys(options.headers),['Content-Type']);body=JSON.parse(options.body);return{ok:true};});
 try{r.record('tool_finished',{tool:'video_generate',mode:'promo-video',status:'succeeded',durationMs:12,prompt:'private story',apiKey:'secret',videoUrl:'private-url',hostname:'private-host',errorCode:'unknown private details'});await r.flush();
 assert.equal(body.installationId,id);assert.equal(body.device.arch,'arm64');assert.equal(body.events[0].errorCode,'other');
 assert.doesNotMatch(JSON.stringify(body),/private|secret/);assert.equal(body.events[0].attempts,undefined);
 }finally{r.dispose();}
});
test('service 500, offline and a transport ignoring abort have bounded attempts and cannot throw into callers',async()=>{
 for(const failure of ['500','offline','hung']){
  let calls=0;const r=fixture(async()=>{calls++;if(failure==='hung')return new Promise(()=>{});if(failure==='offline')throw Error('offline');return{ok:false};});
  const alive=setTimeout(()=>{},1000);
  try{r.record('tool_started',{tool:'video_generate'});for(let n=0;n<3;n++)await r.flush();assert.equal(calls,3);assert.equal(r.pending(),0);}finally{clearTimeout(alive);r.dispose();}
 }
});
test('bounded queue, disabled reporting, disposal and broken local identity never start a main-flow dependency',async()=>{
 let enabled=true,calls=0;const r=fixture(async()=>{calls++;return{ok:true};},{maxQueue:5,enabled:()=>enabled});
 for(let n=0;n<100;n++)r.record('tool_started',{tool:'video_status'});
 assert.equal(r.pending(),5);enabled=false;await r.flush();assert.equal(calls,0);assert.equal(r.pending(),0);
 enabled=true;r.dispose();r.record('plugin_started');await r.flush();assert.equal(calls,0);
 const bad=fixture(async()=>{calls++;return{ok:true};},{identity:async()=>{throw Error('disk unavailable');}});
 try{bad.start();bad.record('plugin_started');await bad.flush();assert.equal(calls,0);}finally{bad.dispose();}
});
test('main tool result and original errors are preserved even when stats or identity are unavailable',async()=>{
 const expected={status:'succeeded',videoPath:'/existing.mp4'};const failure=Error('original tool error');
 for(const execute of [async()=>expected,async()=>{throw failure;}]){
  const wrapped=api.withUsageAnalytics({name:'video_generate',execute},{record(){throw Error('stats broken');}});
  if(execute===undefined)throw Error('fixture');
  try{assert.equal(await wrapped.execute({},{}),expected);}catch(error){assert.equal(error,failure);}
 }
 const r=fixture(async()=>new Promise(()=>{}),{identity:()=>new Promise(()=>{})});
 try{const wrapped=api.withUsageAnalytics({name:'video_generate',execute:async()=>expected},r);assert.equal(await wrapped.execute({},{}),expected);}finally{r.dispose();}
});
test('hot reload startup dedupes within one process and task IDs are hashed, stable and never sent',async()=>{
 const started=new Set();const bodies=[];const options={started};
 const r=fixture(async(_u,o)=>{bodies.push(JSON.parse(o.body));return{ok:true};},options);
 const next=fixture(async()=>({ok:true}),options);
 try{r.start();next.start();await tick();assert.equal(r.pending()+next.pending(),1);
 r.record('video_task_created',{tool:'video_generate'},'private-task-id');r.record('video_task_created',{tool:'video_generate'},'private-task-id');
 await tick();await r.flush();const events=bodies[0].events.filter(x=>x.name==='video_task_created');assert.equal(events.length,2);assert.equal(events[0].eventId,events[1].eventId);assert.match(events[0].eventId,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(bodies),/private-task-id/);
 }finally{r.dispose();next.dispose();}
});
test('unsupported business tools cannot poison an otherwise valid analytics batch',async()=>{
 let body;const r=fixture(async(_u,o)=>{body=JSON.parse(o.body);return{ok:true};});
 try{r.record('tool_started',{tool:'writing_outline',mode:'writer'});r.record('tool_started',{tool:'video_generate',mode:'video-director'});await r.flush();assert.equal(body.events.length,1);assert.equal(body.events[0].tool,'video_generate');}finally{r.dispose();}
});
test('every registered business tool reports, including the canvas and hyperframes tools',async()=>{
 let body;const r=fixture(async(_u,o)=>{body=JSON.parse(o.body);return{ok:true};});
 try{for(const tool of ['video_canvas','video_hyperframes'])r.record('tool_finished',{tool,status:'succeeded',durationMs:30});
 await r.flush();assert.deepEqual(body.events.map(x=>x.tool),['video_canvas','video_hyperframes']);}finally{r.dispose();}
});
test('device fields never carry characters the ingest whitelist rejects',async()=>{
 let body;const r=fixture(async(_u,o)=>{body=JSON.parse(o.body);return{ok:true};},{device:undefined});
 try{r.record('tool_started',{tool:'video_generate'});await r.flush();
 assert.match(body.device.osRelease,/^[a-zA-Z0-9.+_ -]{1,64}$/);assert.match(body.device.harnessVersion,/^[a-zA-Z0-9.+_-]{1,64}$/);
 }finally{r.dispose();}
});
test('test builds and unversioned dev builds never report anything',async()=>{
 for(const version of ['3.24.1','v3.24.1'])assert.equal(api.isReleaseVersion(version),true);
 for(const version of ['3.22.9-test.2','3.24.1-rc.1','3.24.1+build.5','','dev','3.24'])assert.equal(api.isReleaseVersion(version),false);
 let calls=0;const r=fixture(async()=>{calls++;return{ok:true};},{releaseBuild:()=>false});
 try{r.start();r.record('plugin_started');r.record('tool_finished',{tool:'video_generate',status:'succeeded'});await r.flush();
 assert.equal(calls,0);assert.equal(r.pending(),0);}finally{r.dispose();}
});
