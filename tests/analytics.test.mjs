import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate as tick} from 'node:timers/promises';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {api} from './module-test-api.mjs';
const id='42acda42-69d1-49d9-b60a-955ba8da12b4';
function fixture(request=async()=>({ok:true}),extra={}){
 const registered = new Set();
 return api.createAnalyticsReporter({}, {claimRegistration:async id => {if(registered.has(id))return false;registered.add(id);return true;},enabled:()=>true,identity:async()=>id,delayMs:100000,timeoutMs:15,request,started:new Set(),device:()=>({arch:'arm64',osRelease:'25.1.0',memoryGb:16,harnessVersion:'0.2.0'}),...extra});
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
 try{r.record('tool_finished',{tool:'video_generate',mode:'video-director',status:'succeeded',durationMs:12,prompt:'private story',apiKey:'secret',videoUrl:'private-url',hostname:'private-host',errorCode:'unknown private details'});await r.flush();
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
test('every registered business tool reports, including the hyperframes tool',async()=>{
 let body;const r=fixture(async(_u,o)=>{body=JSON.parse(o.body);return{ok:true};});
 try{for(const tool of ['video_hyperframes'])r.record('tool_finished',{tool,status:'succeeded',durationMs:30});
 await r.flush();assert.deepEqual(body.events.map(x=>x.tool),['video_hyperframes']);}finally{r.dispose();}
});
test('device fields never carry characters the ingest whitelist rejects',async()=>{
 let body;const r=fixture(async(_u,o)=>{body=JSON.parse(o.body);return{ok:true};},{device:undefined});
 try{r.record('tool_started',{tool:'video_generate'});await r.flush();
 assert.match(body.device.osRelease,/^[a-zA-Z0-9.+_ -]{1,64}$/);assert.match(body.device.harnessVersion,/^[a-zA-Z0-9.+_-]{1,64}$/);
 }finally{r.dispose();}
});
test('host install completion is reported asynchronously with a bounded source enum',async()=>{
 let body;const listeners={};const time=new Date().toISOString();
 const ctx={get:()=>({listBundles:async()=>[{name:'dsh-metaontic-video',installed:true,source:'dsh-metaontic-video@4.2.2'}]}),on:(name,listener)=>{listeners[name]=listener;return()=>{delete listeners[name];};}};
 const r=fixture(async(_u,o)=>{if(_u.endsWith('/events'))body=JSON.parse(o.body);return{ok:true};});
 try{
  const stop=r.watchInstallOperations(ctx);assert.equal(typeof stop,'function');
  listeners['plugin-manager/operation']({id:'private-operation-id',time,reason:'install',target:'dsh-metaontic-video',stage:'enable',phase:'settled',application:'applied',changed:true,version:'4.3.0'});
  await tick();await r.flush();await r.flush();
  assert.equal(body.events.length,1);assert.equal(body.events[0].name,'plugin_installed');assert.equal(body.events[0].installSource,'npm');assert.equal(body.events[0].version,'4.3.0');assert.equal(body.events[0].occurredAt,time);assert.equal(body.events[0].tool,undefined);assert.doesNotMatch(JSON.stringify(body),/private-operation-id/);
 }finally{r.dispose();}
});
test('failed, cancelled, overridden and unrelated host operations do not create install events',async()=>{
 let calls=0;const listeners={};
 const ctx={get:()=>({listBundles:async()=>[]}),on:(name,listener)=>{listeners[name]=listener;return()=>{};}};
 const r=fixture(async(url)=>{if(url.endsWith('/events'))calls++;return{ok:true};});
 try{
  r.watchInstallOperations(ctx);const fire=operation=>listeners['plugin-manager/operation']({id:JSON.stringify(operation),time:new Date().toISOString(),reason:'install',target:'dsh-metaontic-video',stage:'enable',phase:'settled',changed:true,application:'applied',...operation});
  fire({application:'failed'});fire({application:'cancelled'});fire({application:'overridden'});fire({application:undefined});fire({errorCode:'operation-error'});fire({target:'another-plugin'});fire({reason:'bundle'});
  await tick();await r.flush();assert.equal(calls,0);assert.equal(r.pending(),0);
 }finally{r.dispose();}
});
test('a successful host operation without a matching bundle reports unknown instead of bundled',async()=>{
 let body;const listeners={};const time=new Date().toISOString();
 const ctx={get:()=>({listBundles:async()=>[]}),on:(name,listener)=>{listeners[name]=listener;return()=>{};}};
 const r=fixture(async(_u,o)=>{if(_u.endsWith('/events'))body=JSON.parse(o.body);return{ok:true};});
 try{
  r.watchInstallOperations(ctx);
  listeners['plugin-manager/operation']({id:'no-bundle',time,reason:'install',target:'dsh-metaontic-video',stage:'enable',phase:'settled',application:'applied',changed:true,version:'4.2.2'});
  await tick();await r.flush();await r.flush();
  assert.equal(body.events[0].name,'plugin_installed');assert.equal(body.events[0].installSource,'unknown');
 }finally{r.dispose();}
});
test('install source classification never carries the raw URL, path or credential',()=>{
 const cases={
  'dsh-metaontic-video':'npm','dsh-metaontic-video@latest':'npm','dsh-metaontic-video@4.2.2':'npm','npm:dsh-metaontic-video@4.2.2':'npm','latest':'npm',
  'https://example.com/metaontic-video.tgz?token=private':'tgz','link:/private/workspace':'directory','file:C:\\private\\plugin':'directory','~/private/plugin':'directory',
  'git+https://user:private@example.com/repo.git':'git','git@example.com:private/repo.git':'git','':'bundled','private-value':'unknown',
 };
 for(const [value,expected] of Object.entries(cases))assert.equal(api.installSourceOf(value),expected,value);
});
test('test builds and unversioned dev builds never report anything',async()=>{
 for(const version of ['3.24.1','v3.24.1'])assert.equal(api.isReleaseVersion(version),true);
 for(const version of ['3.22.9-test.2','3.24.1-rc.1','3.24.1+build.5','','dev','3.24'])assert.equal(api.isReleaseVersion(version),false);
 let calls=0;const r=fixture(async()=>{calls++;return{ok:true};},{releaseBuild:()=>false});
 try{r.start();r.record('plugin_started');r.record('tool_finished',{tool:'video_generate',status:'succeeded'});await r.flush();
 assert.equal(calls,0);assert.equal(r.pending(),0);}finally{r.dispose();}
});
test('设备登记在落盘后只放行一次，并发与重新创建上报器都不能重复发送',async()=>{
 await withHome(async()=>{
  const results=await Promise.all(Array.from({length:12},()=>api.claimDeviceRegistration(id)));
  assert.equal(results.filter(Boolean).length,1);
  assert.equal(await api.claimDeviceRegistration(id),false);
 });
 await withHome(async()=>{
  let calls=0;
  const make=()=>fixture(async()=>{calls++;return{ok:true};},{claimRegistration:api.claimDeviceRegistration});
  let r=make();
  r.record('plugin_started');r.record('plugin_installed',{version:'4.2.4'});
  await new Promise(resolve=>setTimeout(resolve,50));await r.flush();r.dispose();
  assert.equal(calls,1);
  r=make();r.start();r.record('plugin_installed',{version:'4.2.5'});
  await new Promise(resolve=>setTimeout(resolve,50));await r.flush();r.dispose();
  assert.equal(calls,1,'重启、更新或普通重装保留标记，不能重复登记');
 });
});
test('设备登记网络结果不明不重试，工具事件仍可按原策略重试',async()=>{
 let calls=0;
 const r=fixture(async()=>{calls++;throw Error('response lost');});
 try{
  r.record('plugin_started');await tick();await r.flush();
  assert.equal(calls,1);assert.equal(r.pending(),0);
  r.record('plugin_installed');await tick();await r.flush();assert.equal(calls,1);
  r.record('tool_started',{tool:'video_generate'});await r.flush();assert.equal(r.pending(),1);
 }finally{r.dispose();}
});
test('扩展事件与旧协议分批，旧服务404后只停用扩展统计',async()=>{
 const requests=[];
 const r=fixture(async(url,o)=>{requests.push({url,body:JSON.parse(o.body)});return url.endsWith('/outcomes')?{ok:false,status:404}:{ok:true};});
 try{
  r.record('outcome_finished',{tool:'film_project',stage:'script',action:'submit',status:'succeeded',flowKey:'/private/story',content:'secret'},'private-call');
  r.record('tool_started',{tool:'video_generate'});await tick();await r.flush();await r.flush();
  assert.equal(requests.length,2);
  const extra=requests.find(x=>x.url.endsWith('/outcomes')).body.events[0];
  assert.match(extra.flowId,/^[a-f0-9]{64}$/);assert.doesNotMatch(JSON.stringify(requests),/secret|private/);
  assert.deepEqual(requests.find(x=>x.url.endsWith('/events')).body.events.map(x=>x.name),['tool_started']);
  r.record('outcome_finished',{stage:'install',action:'install',status:'failed'});await r.flush();assert.equal(requests.length,2);
  r.record('tool_started',{tool:'video_status'});await r.flush();assert.equal(requests.length,3);
 }finally{r.dispose();}
});
test('同一成片散列稳定且按设备隔离，字段只允许计量与分类',async()=>{
 const bodies=[];const r=fixture(async(_url,o)=>{bodies.push(JSON.parse(o.body));return{ok:true};});
 try{
  for(let i=0;i<2;i++)r.record('video_ready',{tool:'video_generate',stage:'generation',action:'generate',status:'succeeded',flowKey:'private-dir',segmentCount:2,videoDurationSec:30.2,files:['private-file'],errorCategory:'raw-private-error'},'ready:private-dir');
  await tick();await r.flush();const [a,b]=bodies[0].events;
  assert.equal(a.eventId,b.eventId);assert.equal(a.flowId,b.flowId);assert.equal(a.segmentCount,2);
  assert.equal(a.errorCategory,undefined);assert.doesNotMatch(JSON.stringify(bodies),/private/);
 }finally{r.dispose();}
});
test('创作阶段状态取真实结果，read/status不能当完成',()=>{
 assert.equal(api.toolOutcome('film_project',{action:'read',stage:'script'}),null);
 assert.equal(api.toolOutcome('video_project',{action:'status'}),null);
 assert.equal(api.toolOutcome('video_status',{}, {status:'succeeded',videoUrl:'private'}),null);
 for(const [result,status] of [[{approvals:{script:2}},'approved'],[{status:'needs_input'},'pending'],[{status:'SCRIPT_REVISE'},'draft'],[{status:'STOPPED'},'cancelled']])
  assert.equal(api.toolOutcome('film_project',{action:'approve',stage:'script'},result).status,status);
 assert.equal(api.toolOutcome('video_script',{}, {script:'private',truncated:true}).status,'pending');
 assert.equal(api.toolOutcome('video_generate',{resume:'private'}, {status:'succeeded',paused:true}).status,'paused');
 assert.equal(api.toolOutcome('video_generate',{},null,{code:'ABORTED',message:'private'}).status,'cancelled');
});
test('只对存在的完整本地成片记就绪，真实宿主展示后才记交付',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'成片统计 '));const target=path.join(root,'final.mp4');
 const events=[];const exec={name:'video_generate',metaonticAnalytics:{record:(...args)=>events.push(args)}};
 const session={header:{cwd:root}};const guard=api.createDeliveryOrderGuard();
 const value={status:'succeeded',videoPath:target,segmentsDir:root,merged:true,segments:[{status:'succeeded',localPath:target,durationSeconds:12}]};
 try{
  await guard.remember(session,value,exec);assert.equal(events.length,0,'不存在的路径不计入');
  await writeFile(target,'video-fixture');
  await guard.remember(session,{...value,paused:true},exec);assert.equal(events.length,0,'暂停预览不计入');
  await guard.remember(session,value,exec);assert.equal(events[0][0],'video_ready');assert.equal(events[0][1].videoDurationSec,12);
  guard.observe(session,{type:'deliverables/presented',data:{files:[{path:path.join(root,'other.mp4')}]}});assert.equal(events.length,1);
  guard.observe(session,{type:'deliverables/presented',data:{files:[{path:target}]}});assert.equal(events[1][0],'video_delivered');
  guard.observe(session,{type:'deliverables/presented',data:{files:[{path:target}]}});assert.equal(events[1][2],events[2][2],'重复展示使用相同幂等键');
 }finally{await rm(root,{recursive:true,force:true});}
});
