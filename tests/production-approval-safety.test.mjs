import './no-network-analytics.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir, hostname } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { api } from './module-test-api.mjs';
import { planCleanup, applyCleanup } from '../scripts/clean-releases.mjs';

test('effective defaults match but real audio, watermark and strategy changes require review', () => {
 const spec={prompt:'河边',duration:15,ratio:'16:9',resolution:'720p'};
 const normalized=api.normalizeProductionSpec({},'video_generate',spec);
 assert.equal(api.productionFingerprint({},'video_generate',spec),api.productionFingerprint({},'video_generate',normalized));
 for(const delta of [{generateAudio:false},{watermark:true},{productionStrategy:'independent_shots'}])
  assert.notEqual(api.productionFingerprint({},'video_generate',spec),api.productionFingerprint({},'video_generate',{...spec,...delta}));
});
test('questions survive deletion and reload; only actual answers applied to a revised script clear them', () => {
 for(const heading of ['## 用户确认事项','**待用户确认的问题**','## 待确认问题']) assert.deepEqual(api.pendingScriptQuestions(`${heading}\n- 结尾保留吗？`),['结尾保留吗？']);
 let p={};const pending=api.syncScriptQuestions(p,['结尾保留吗？'],'h1');
 p=JSON.parse(JSON.stringify(p));assert.equal(api.syncScriptQuestions(p,[],'h2').length,1);
 api.recordQuestionAnswers(p.clarifications,pending,{answers:[{id:'script_review',custom:'通过'}]},'h2',false);
 assert.equal(p.clarifications[0].status,'PENDING');
 api.recordQuestionAnswers(p.clarifications,pending,{answers:[{id:pending[0].id,custom:'保留原结尾'}]},'h2',true);
 assert.equal(p.clarifications[0].status,'PENDING');
 api.recordQuestionAnswers(p.clarifications,pending,{answers:[{id:pending[0].id,custom:'保留原结尾'}]},'h2',false);
 assert.equal(api.syncScriptQuestions(p,[],'h2').length,1);
 assert.equal(api.syncScriptQuestions(p,[],'h3').length,0);
 assert.equal(p.clarifications[0].answer,'保留原结尾');
});
test('very old active locks and foreign or malformed locks cannot be stolen; dead local locks recover',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'安全锁 中文 '));t.after(()=>rm(dir,{recursive:true,force:true}));const file=join(dir,'resume.lock');
 for(const record of [{pid:process.pid,host:hostname(),created_at:'2000-01-01'}, {pid:process.pid,host:'another-machine'},null]) {
  const text=record?JSON.stringify(record):'invalid';await writeFile(file,text);
  await assert.rejects(api.acquireFileLock(file,{recoverDead:true}));assert.equal(await readFile(file,'utf8'),text);
 }
 const child=spawn(process.execPath,['-e','process.exit(0)']);await once(child,'exit');
 await writeFile(file,JSON.stringify({pid:child.pid,host:hostname()}));
 const release=await api.acquireFileLock(file,{recoverDead:true});await release();
});
test('project storyboard requires its own exact script and image bytes across turns', async t=>{
 const dir=await mkdtemp(join(tmpdir(),'分镜绑定 '));t.after(()=>rm(dir,{recursive:true,force:true}));
 const script=join(dir,'script.md'),image=join(dir,'storyboard.svg');await writeFile(script,'完整脚本正文');await writeFile(image,'<svg/>');
 const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
 const binding={projectId:'p',path:image,scriptPath:script,scriptHash:await hash(script),imageHash:await hash(image)};
 const guard=api.createStoryboardReviewGuard({log:async()=>{}}),session={header:{cwd:dir}};
 guard.observe(session,{type:'assistant/message',data:{turn:1,message:{content:[{type:'text',text:`完整脚本正文\n![分镜示意图](<${image}>)`}]}}});
 const exec={name:'ask_user_question',agent:{session},arguments:{requireStoryboard:true,requiredProjectId:'p',requiredScriptPath:script,requiredScriptHash:binding.scriptHash,requiredStoryboard:binding,requiredScriptText:'完整脚本正文',questions:[{id:'script_review'}]}};
 assert.equal(await guard.gate(exec),null);
 guard.observe(session,{type:'tool/call',data:{turn:2,name:'video_project'}});assert.equal(await guard.gate(exec),null);
 exec.arguments.requiredProjectId='other';assert.equal((await guard.gate(exec)).kind,'deny');exec.arguments.requiredProjectId='p';
 await writeFile(image,'changed');assert.equal((await guard.gate(exec)).kind,'deny');
});
test('retention is per repository and release deletion failure preserves its tag',async()=>{
 const release=tag=>({tag,id:tag,draft:false,prerelease:false,assets:[]});
 const plan=planCleanup({tags:[],tagsByHost:{github:['v1.0.0','v1.0.1'],gitee:['v2.0.0','v2.0.1']},releases:{github:['v1.0.0','v1.0.1'].map(release),gitee:['v2.0.0','v2.0.1'].map(release)},patterns:['v*'],keep:2,keepTags:2});
 assert.deepEqual(plan.remove,[]);
 const calls=[];const bad=planCleanup({tags:['v1.0.0','v1.0.1'],releases:{github:['v1.0.0','v1.0.1'].map(release)},patterns:['v*'],keep:1,keepTags:1});
 await assert.rejects(applyCleanup({plan:bad,github:{slug:'owner/repo',listReleases:async()=>[],remove:async path=>{calls.push(path);throw Error('failed');}},local:{deleteTag:()=>assert.fail('local tag must remain')},log:()=>{}}));
 assert.ok(!calls.some(p=>p.includes('/git/refs/tags/')));
});
