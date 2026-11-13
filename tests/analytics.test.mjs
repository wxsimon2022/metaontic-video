import assert from 'node:assert/strict';
import {test} from 'node:test';
import {setImmediate as tick} from 'node:timers/promises';
import {api} from './module-test-api.mjs';
const id='42acda42-69d1-49d9-b60a-955ba8da12b4';
function fixture(request=async()=>({ok:true}),extra={}){
 return api.createAnalyticsReporter({}, {enabled:()=>true,identity:async()=>id,delayMs:100000,timeoutMs:15,request,started:new Set(),device:()=>({arch:'arm64',osRelease:'25.1.0',memoryGb:16,harnessVersion:'0.2.0'}),...extra});
}
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
