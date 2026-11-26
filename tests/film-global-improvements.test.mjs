import './no-network-analytics.mjs';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile,mkdir,readdir} from 'node:fs/promises';
import {tmpdir,hostname} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {workflowApi} from './workflow-test-api.mjs';
const dir=await mkdtemp(path.join(tmpdir(),'全局改进 中文 '));
after(()=>rm(dir,{recursive:true,force:true}));
await build({stdin:{contents:`
export * from './src/businesses/film-production/production.binding.ts';
export * from './src/businesses/film-production/projects/project.repository.ts';
export * from './src/businesses/film-production/validation/content.validator.ts';
export * from './src/businesses/film-production/projects/project.service.ts';
export * from './src/businesses/film-production/artifacts/artifact.service.ts';
export * from './src/businesses/film-production/workflows/workflow.engine.ts';
export * from './src/businesses/film-production/artifacts/artifact.version.ts';
export * from './src/businesses/video-generation/providers/capabilities.ts';
export * from './src/businesses/video-generation/workflow/planning.ts';
export * from './src/businesses/video-generation/workflow/shot-materials.ts';
export {createProject,writeProject,scriptDigest} from './src/businesses/video-generation/workflow/project.ts';
export * from './src/businesses/video-generation/tools/video-estimate.ts';
export {filmDirectorBusiness} from './src/businesses/film-production/index.ts';
`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:path.join(dir,'api.mjs')});
const api=await import(pathToFileURL(path.join(dir,'api.mjs')));
const model='doubao-seedance-2-0-mini-260615';
const spec={prompt:'批准的开场',segmentPrompts:['开场动作','第二地点新动作'],duration:15,ratio:'16:9',resolution:'480p',productionStrategy:'independent_shots',shotDurations:[7,8]};
test('compiled source binds prompts, strategy, durations and specs while allowing reviewed references',()=>{
 const source={revision:7,production:{source_revision:7,videoProjectId:'v',specification:spec}};
 const project={id:'v',filmSource:{revision:7,plan_digest:api.productionDigest(spec)}};
 api.assertCompiledProduction(project,source,{...spec,referenceImages:['approved.png']});
 assert.throws(()=>api.assertCompiledProduction({...project,filmSource:{...project.filmSource,model_name:model}},source,spec,'changed-model'),/MODEL_MISMATCH/);
 for(const change of [{prompt:'替换'},{segmentPrompts:['换台词','第二段']},{shotDurations:[8,7]},{ratio:'9:16'},{mode:'closeup'},{transitionDescription:'增加新剧情'},{productionStrategy:'continuous_segments'}])assert.throws(()=>api.assertCompiledProduction(project,source,{...spec,...change}),/PLAN_MISMATCH/);
 assert.throws(()=>api.assertCompiledProduction(project,{...source,revision:8},spec),/已改稿/);
 assert.throws(()=>api.assertCompiledProduction({...project,filmSource:{revision:7}},source,spec),/PLAN_REQUIRED/);
});
test('independent plan has separate generation and billing, default stays continuous',()=>{
 const config={model};
 assert.deepEqual(api.resolveTargetPlan(config,spec).plan,[{kind:'generate',seconds:7},{kind:'generate',seconds:8}]);
 for(const shotDurations of [[3,12],[16],[7,7],[],[7.5,7.5]])assert.throws(()=>api.resolveTargetPlan(config,{...spec,shotDurations}),/INDEPENDENT/);
 assert.deepEqual(api.resolveTargetPlan(config,{duration:30}).plan.map(s=>s.kind),['generate','extend']);
});
test('cost comparison counts no previous video for independent shots',async()=>{
 const tool=api.estimateTool({connectionMode:'metaontic',model});
 const result=await tool.execute(spec,{});
 assert.deepEqual(result.plugin.segments.map(s=>s.inputSeconds),[0,0]);
 assert.deepEqual(result.official.segments.map(s=>s.inputSeconds),[0,0]);
});
test('adapter capability shares aliases and leaves unknown fields unverified',()=>{
 assert.equal(api.videoCapabilities(model).supported_durations_ms.max,15000);
 assert.equal(api.videoCapabilities('seedance-2.5').supported_durations_ms.max,30000);
 assert.equal(api.videoCapabilities('future-model').supported_durations_ms,null);
 assert.equal(api.videoCapabilities(model).verified_at,null);
});
test('quality gate requires action and theme evidence, speech budget is a reviewed warning',()=>{
 const state={quality_policy:'evidence_v1',artifacts:{script:{data:{scenes:[{scene_id:'s',duration_ms:1000}],dialogue:[{scene_id:'s',exact_text:'这句话的长度肯定超过一秒钟能够自然讲完的时间'}]}}}};
 assert.throws(()=>api.validateContentEvidence('creative',{structure:[{purpose:'主题'}]},state),/VISIBLE/);
 assert.throws(()=>api.validateContentEvidence('script',{scenes:[{scene_goal:'看水'}]},state),/ACTION/);
 const report={review_status:'PASS',scores:{narrative_quality:90}};
 assert.throws(()=>api.validateContentEvidence('review',report,state),/SCORE_EVIDENCE/);
 report.score_evidence={narrative_quality:'场景s由递杯行动转为接受，关系变化'};
 assert.throws(()=>api.validateContentEvidence('review',report,state),/THEME/);
 report.theme_evidence=[{scene_id:'s',evidence:'递杯后停顿回应'}];
 assert.throws(()=>api.validateContentEvidence('review',report,state),/SPEECH_BUDGET/);
 report.budget_checks=[{scene_id:'s',status:'ACCEPTED_WITH_REASON',evidence:'对白作为跨场旁白，下一场仍有发声预算，需导演确认'}];
 api.validateContentEvidence('review',report,state);
 api.validateContentEvidence('script',{scenes:[{}]},{quality_policy:'legacy'});
 assert.equal(api.narrativeDiagnostics(state.artifacts.script.data)[0].kind,'WARNING');
});
test('lock recovery refuses active owners and permits positively identified exited process',async()=>{
 const folder=await mkdtemp(path.join(dir,'锁 '));const release=await api.acquireProjectLock(folder);
 assert.equal((await api.inspectProjectLock(folder)).status,'active');
 await assert.rejects(api.recoverProjectLock(folder),/UNSAFE/);await release();
 const child=spawn(process.execPath,['-e','process.exit(0)']);await once(child,'exit');
 await writeFile(path.join(folder,'.write.lock'),JSON.stringify({pid:child.pid,host:hostname()}));
 assert.equal((await api.inspectProjectLock(folder)).recoverable,true);
 assert.equal((await api.recoverProjectLock(folder)).status,'recovered');
 await writeFile(path.join(folder,'.write.lock'),'broken');
 await assert.rejects(api.recoverProjectLock(folder),/UNSAFE/);
});
test('snapshots retain approved and current dependencies, bound obsolete versions',async()=>{
 const folder=await mkdtemp(path.join(dir,'快照 '));await mkdir(path.join(folder,'snapshots'));
 for(let n=0;n<40;n++)await writeFile(path.join(folder,'snapshots',`${n}-abcdef.json`),JSON.stringify({revision:n}));
 await api.pruneProjectSnapshots(folder,{revision:40,approvals:{creative:0},artifacts:{script:{revision:5,source_revisions:{creative:1}}}},5);
 const names=await readdir(path.join(folder,'snapshots'));
 for(const n of [0,1,5])assert.ok(names.includes(`${n}-abcdef.json`));
 assert.ok(names.length<=8);
});
function legacyFilm() {
 const data={creative:{theme:'互相关照',logline:'递杯'},script:{screenplay:'完整剧本',chapters:[{chapter_id:'c',duration_ms:15000}],scenes:[{scene_id:'s1',chapter_id:'c',duration_ms:7000},{scene_id:'s2',chapter_id:'c',duration_ms:8000}]},assets:{characters:[],scenes:[{scene_id:'s1',location_id:'l1',scene_state_id:'t1'},{scene_id:'s2',location_id:'l2',scene_state_id:'t2'}],locations:[{location_id:'l1'},{location_id:'l2'}],scene_states:[{scene_state_id:'t1',location_id:'l1'},{scene_state_id:'t2',location_id:'l2'}],props:[{prop_id:'p'}]},shots:{shots:[{shot_id:'h1',scene_id:'s1',location_id:'l1',scene_state_id:'t1',character_ids:[],prop_ids:['p'],start_ms:0,end_ms:7000,duration_ms:7000},{shot_id:'h2',scene_id:'s2',location_id:'l2',scene_state_id:'t2',character_ids:[],prop_ids:[],start_ms:7000,end_ms:15000,duration_ms:8000}]},prompts:{prompts:[{shot_id:'h1',prompt:'递杯'},{shot_id:'h2',prompt:'接受'}]},review:{score:90,passed:true,issues:[]}};
 return {project_id:'f',duration_ms:15000,revision:7,approvals:{creative:1,script:1},artifacts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{revision:1,stale:false,data:v}]))};
}
test('compiler maps independent shots across locations without adding video inputs',()=>{
 const state=legacyFilm();state.project_spec={production_strategy:'independent_shots',target_model:model};
 const result=api.compileProduction(state,[{kind:'generate',seconds:15}],'16:9','480p');
 assert.deepEqual(result.specification.shotDurations,[7,8]);assert.equal(result.strategy,'independent_shots');
});
test('prop and location revisions target affected shots, preserving script and unrelated objects',()=>{
 for(const [collection,entity,affected] of [['props',{prop_id:'p',color:'blue'},['h1']],['locations',{location_id:'l2',material:'wood'},['h2']],['scene_states',{scene_state_id:'t1',location_id:'l1',weather:'clear'},['h1']]]) {
  const state=legacyFilm();const before=structuredClone(state.artifacts.script);
  const revised=api.reviseEntities(state,'assets',[{collection,entity}],7);
  assert.deepEqual(revised.artifacts.shots.stale_entity_ids,affected);assert.deepEqual(revised.artifacts.script,before);
  assert.equal(revised.artifacts.review.stale,true);
 }
});
test('independent real executor pauses, resumes exactly once and creates no reference_video',async()=>{
 const home=await mkdtemp(path.join(dir,'执行 '));const prior=process.env.DSH_HOME,fetchBefore=globalThis.fetch;process.env.DSH_HOME=home;
 const bodies=[];
 globalThis.fetch=async(url,opts={})=>{
  if(opts.method==='POST'){bodies.push(JSON.parse(opts.body));return Response.json({id:'independent-'+bodies.length});}
  return Response.json({status:'succeeded',content:{video_url:'https://mock.invalid/shot.mp4'}});
 };
 try {
  const config={connectionMode:'metaontic',metaonticApiKey:'offline',baseUrl:'https://mock.invalid',model,outputDir:home};
  const tool=workflowApi.lowLevelVideo('video_generate',config,{});
  const first=await tool.execute({...spec,merge:false},{});
  assert.equal(first.paused,true);assert.equal(bodies.length,1);
  await assert.rejects(()=>tool.execute({resume:first.resumeDir,shotDurations:[8,7]},{}),/PLAN_CHANGE/);
  const second=await tool.execute({resume:first.resumeDir},{});
  assert.equal(bodies.length,2);assert.equal(second.segments.length,2);assert.equal(second.mode,'independent_shots');
  for(const b of bodies)assert.ok(!JSON.stringify(b).includes('video_url'));
  assert.match(JSON.stringify(bodies[1]),/第二地点新动作/);assert.ok(!JSON.stringify(bodies[1]).includes('这是首段'));
  const third=await tool.execute({resume:first.resumeDir},{});assert.equal(bodies.length,2);assert.equal(third.segments.length,2);
 }finally{globalThis.fetch=fetchBefore;if(prior===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=prior;}
});
test('new professional project completes approved evidence chain and persists compiled binding; reads remain available during approval',async()=>{
 const home=await mkdtemp(path.join(dir,'项目 '));const prior=process.env.DSH_HOME;process.env.DSH_HOME=home;
 let tool,observe,unlock,asked;
 const waiting=new Promise(r=>asked=r);
 const fetchBefore=globalThis.fetch;
 const runtime={config:{model,connectionMode:'metaontic',metaonticApiKey:'mock-only',baseUrl:'https://review.invalid'},tools:{register(_,t){tool=t;}},ctx:{on(_event,listener){observe=listener;},get(){return {ask:async()=>{asked();await new Promise(r=>unlock=r);return {answers:[{id:'film_approval',selected:['批准本版']}]};}};}}};
 const exec={agent:{session:{id:'global-project'}}};api.filmDirectorBusiness.apply(runtime);
 try {
  let state=await tool.execute({action:'create',title:'递杯',sourceBrief:'两个地点的一次关照',durationSeconds:15,projectSpec:JSON.stringify({genre:'drama',target_model:model,production_strategy:'independent_shots'})},exec);
  const projectId=state.project_id;
  const submit=async(stage,data)=>{state=await tool.execute({action:'submit',projectId,expectedRevision:state.revision,stage,content:JSON.stringify(data)},exec);};
  await submit('creative',{theme:'关照',logline:'递杯再接受',structure:[{section_id:'s',purpose:'递杯表达关照',visual_evidence:['杯子被接受'],duration_ms:15000}],must_preserve:[],assumptions:[]});
  observe(exec.agent.session,{type:'assistant/message',data:{message:{content:[{type:'text',text:state.approval_material.markdown}]}}});
  const pending=tool.execute({action:'approve',projectId,stage:'creative',expectedRevision:state.revision},exec);
  await waiting;
  assert.equal((await tool.execute({action:'diagnose',projectId},exec)).lock.status,'active');
  assert.equal((await tool.execute({action:'read',projectId,stage:'creative'},exec)).artifact.revision,state.revision);
  unlock();state=await pending;
  // Later approval can return immediately.
  runtime.ctx.get=()=>({ask:async()=>({answers:[{id:'film_approval',selected:['批准本版']}]})});
  const data=legacyFilm().artifacts;
  const script={...data.script.data,characters:[],dialogue:[],scenes:data.script.data.scenes.map(s=>({...s,scene_goal:'观察杯子',entry_state:'杯子在桌上',exit_state:'杯子被移动',key_actions:['杯子沿桌面移动']}))};
  await submit('script',script);
  observe(exec.agent.session,{type:'assistant/message',data:{message:{content:[{type:'text',text:state.approval_material.markdown}]}}});
  state=await tool.execute({action:'approve',projectId,stage:'script',expectedRevision:state.revision},exec);
  await submit('assets',data.assets.data);
  await submit('shots',{shots:data.shots.data.shots.map(s=>({...s,chapter_id:'c',narrative_purpose:'呈现杯子的移动',costume_ids:[],dialogue_refs:[]}))});
  const shots=state.nextTask.inputs.shots.data.shots;
  await submit('prompts',{prompts:data.prompts.data.prompts.map((p,i)=>({...p,location_id:shots[i].location_id,scene_state_id:shots[i].scene_state_id,duration_ms:shots[i].duration_ms,generation_mode:'TEXT_TO_VIDEO',dialogue_refs:[]}))});
  const revisions=state.nextTask.input_revisions;
  const scores={requirement_fidelity:90,narrative_quality:90,character_consistency:null,scene_consistency:90,cinematic_quality:90,temporal_consistency:90,prompt_executability:90,structural_completeness:90};
  const report={review_id:'r',review_stage:'FINAL_REVIEW',review_scope:Object.keys(revisions),reviewed_revisions:revisions,unverified_items:[],scores,score_evidence:Object.fromEntries(Object.keys(scores).map(k=>[k,'s1递杯，s2接受，关照通过动作呈现'])),theme_evidence:[{scene_id:'s1',evidence:'杯子沿桌面递出'}],issues:[],review_status:'PASS',delivery_allowed:true,dimension_review:{profile_revision:'1',checks:[{dimension:'genre',profile_id:'drama',status:'PASS',evidence:'动作和接受建立因果'}]},story_assessment:{reviewer:'isolated_mock',criteria:['theme_expression','causal_progression','character_credibility','dialogue_function','visual_specificity','ending_payoff'].map(id=>({id,status:'PASS',evidence:[{scene_id:'s1',reason:'杯子移动后被接住，关照通过行为体现'}]}))}};
  let reviewCalls=0;
  globalThis.fetch=async (_url,options)=>{reviewCalls++;const body=JSON.parse(options.body);assert.equal(body.messages.length,2);return {ok:true,headers:{get:()=> 'application/json'},json:async()=>({model:'mock-review',choices:[{message:{content:JSON.stringify(report)}}],usage:{prompt_tokens:100,completion_tokens:50}})};};
  runtime.ctx.get=()=>({ask:async()=>{throw new Error('文本审核不应再弹独立费用审批');}});
  state=await tool.execute({action:'independent_review',projectId,expectedRevision:state.revision},exec);
  assert.equal(reviewCalls,1);assert.equal(state.nextTask.action,'compile');
  const journal=await tool.execute({action:'review_requests',projectId},exec);
  assert.equal(journal.requests.length,1);assert.equal(journal.requests[0].status,'response_saved');
  runtime.ctx.get=()=>({ask:async()=>{throw new Error('文本审核重试不得弹确认窗');}});
  const authorized=await tool.execute({action:'retry_review',projectId,expectedRevision:state.revision,requestKey:journal.requests[0].key},exec);
  assert.equal(authorized.status,'prepared');assert.equal(reviewCalls,1);
  state=await tool.execute({action:'independent_review',projectId,expectedRevision:state.revision},exec);
  assert.equal(reviewCalls,2);

  state=await tool.execute({action:'compile',projectId,expectedRevision:state.revision,ratio:'16:9',resolution:'480p'},exec);
  assert.equal(state.production.strategy,'independent_shots');
  const video=await workflowApi.readProject(state.production.videoProjectId,exec);
  assert.equal(video.filmSource.plan_digest,api.productionDigest(state.production.specification));
  const source=JSON.parse(await readFile(video.filmSource.path,'utf8'));
  api.assertCompiledProduction(video,source,state.production.specification);
  const before=(await readdir(path.join(path.dirname(video.filmSource.path),'snapshots'))).length;
  await tool.execute({action:'compile',projectId,expectedRevision:state.revision,ratio:'16:9',resolution:'480p'},exec);
  assert.equal((await readdir(path.join(path.dirname(video.filmSource.path),'snapshots'))).length,before);
  const logDays=await readdir(path.join(home,'logs','metaontic-video'));
  const logs=(await readFile(path.join(home,'logs','metaontic-video',logDays[0],'requests.jsonl'),'utf8')).trim().split('\n').map(l=>JSON.parse(l)).filter(l=>l.event==='film_stage_finished');
  assert.ok(logs.some(l=>l.action==='compile'&&l.responseBytes>0));
  assert.ok(!JSON.stringify(logs).includes('两个地点的一次关照'));
  assert.ok(logs.every(l=>typeof l.elapsedMs==='number'&&!Object.hasOwn(l,'content')));
 }finally{globalThis.fetch=fetchBefore;if(prior===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=prior;}
});

test('visual-only changes preserve story approvals while narrative tone requires approval',()=>{
 const state=legacyFilm();state.project_spec={visual_style:'生活摄影',tone:'平静'};
 for(const change of [{visual_style:'DV颗粒'},{tone:'冷色、低饱和',change_scope:'visual_only'}]) {
  const next=api.configureProfile(state,change,7);
  assert.deepEqual(next.approvals,state.approvals);
  assert.equal(next.artifacts.creative.stale,false);assert.equal(next.artifacts.script.stale,false);
  for(const stage of ['assets','shots','prompts','review'])assert.equal(next.artifacts[stage].stale,true);
 }
 for(const change of [{tone:'悲剧'},{visual_style:'DV颗粒',change_scope:'story'}])assert.deepEqual(api.configureProfile(state,change,7).approvals,{});
 assert.throws(()=>api.configureProfile(state,{genre:'comedy',change_scope:'visual_only'},7),/VISUAL_SCOPE_CONFLICT/);
 assert.deepEqual(api.configureProfile(state,{visual_style:'生活摄影'},7),state);
});
test('independent frames stay on their own shots and survive resumed execution',async()=>{
 const home=await mkdtemp(path.join(dir,'逐镜素材 '));const prior=process.env.DSH_HOME,fetchBefore=globalThis.fetch;process.env.DSH_HOME=home;
 const bodies=[];globalThis.fetch=async(_url,opts={})=>opts.method==='POST'?(bodies.push(JSON.parse(opts.body)),Response.json({id:'frames-'+bodies.length})):Response.json({status:'succeeded',content:{video_url:'https://mock.invalid/shot.mp4'}});
 try {
  const args={...spec,merge:false,firstFrameUrl:'https://mock.invalid/start.png',lastFrameUrl:'https://mock.invalid/end.png',shotFrames:[{}, {firstFrameUrl:'https://mock.invalid/location-two.png'}]};
  const tool=workflowApi.lowLevelVideo('video_generate',{connectionMode:'metaontic',metaonticApiKey:'offline',baseUrl:'https://mock.invalid',model,outputDir:home},{});
  const first=await tool.execute(args,{});await tool.execute({resume:first.resumeDir},{});
  assert.equal(bodies.length,2);
  const a=JSON.stringify(bodies[0]),b=JSON.stringify(bodies[1]);
  assert.match(a,/start.png/);assert.doesNotMatch(a,/end.png|location-two.png/);
  assert.match(b,/location-two.png/);assert.match(b,/end.png/);assert.doesNotMatch(b,/start.png/);
  const plain={...spec,firstFrameUrl:'start',lastFrameUrl:'end'};
  assert.equal(api.shotMaterials(plain,1,3).firstFrameUrl,undefined);assert.equal(api.shotMaterials(plain,1,3).lastFrameUrl,undefined);
  for(const shotFrames of [[{}],[{}, {unknown:'x'}],[{}, {firstFrameUrl:''}]])assert.throws(()=>api.resolveTargetPlan({model},{...spec,shotFrames}),/INVALID_SHOT_FRAMES/);
  assert.throws(()=>api.resolveTargetPlan({model},{duration:15,shotFrames:[{}]}),/INVALID_SHOT_FRAMES/);
 }finally{globalThis.fetch=fetchBefore;if(prior===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=prior;}
});
test('recovery interrupted during another recovery can itself be recovered; live or unknown guards stay protected',async()=>{
 const folder=await mkdtemp(path.join(dir,'恢复中断 '));const child=spawn(process.execPath,['-e','process.exit(0)']);await once(child,'exit');
 const record=()=>({pid:child.pid,host:hostname(),token:randomUUID()});
 const guard=record(),claim=record();
 await writeFile(path.join(folder,'.write.lock'),JSON.stringify(record()));
 await writeFile(path.join(folder,'.recovery.lock'),JSON.stringify(guard));
 await writeFile(path.join(folder,`.recovery.lock.reclaim-${guard.token}`),JSON.stringify(claim));
 assert.equal((await api.inspectProjectLock(folder)).recovery.status,'interrupted');
 assert.equal((await api.recoverProjectLock(folder)).status,'recovered');
 assert.equal((await api.inspectProjectLock(folder)).recovery.status,'unlocked');
 await writeFile(path.join(folder,'.recovery.lock'),JSON.stringify({pid:process.pid,host:hostname(),token:randomUUID()}));
 await assert.rejects(api.recoverProjectLock(folder),/RECOVERY_LOCK_UNSAFE/);
 await writeFile(path.join(folder,'.recovery.lock'),'');
 assert.equal((await api.inspectProjectLock(folder)).recovery.status,'unknown');
 await assert.rejects(api.recoverProjectLock(folder),/RECOVERY_LOCK_UNSAFE/);
});
test('video project status reports stale source or model despite unchanged local approved script',async()=>{
 const home=await mkdtemp(path.join(dir,'审核状态 '));const prior=process.env.DSH_HOME;process.env.DSH_HOME=home;
 try {
  const exec={agent:{session:{id:'stale-source'}}},config={model};
  const video=await api.createProject(exec,'scenery');
  const sourcePath=path.join(home,'film.json'),scriptPath=path.join(home,'script.md');await writeFile(scriptPath,'批准的完整剧本');
  const source={revision:7,production:{source_revision:7,videoProjectId:video.id,specification:spec}};
  await writeFile(sourcePath,JSON.stringify(source));
  video.filmSource={path:sourcePath,revision:7,plan_digest:api.productionDigest(spec),model_name:model};
  video.approved={name:'video_generate',specification:spec,scriptPath,scriptHash:await api.scriptDigest(scriptPath),fingerprint:workflowApi.productionFingerprint(config,'video_generate',spec)};
  await api.writeProject(video);
  const tool=workflowApi.projectTool(config,{}, {},{},{});
  assert.equal((await tool.execute({action:'status',projectId:video.id},exec)).status,'approved');
  await writeFile(sourcePath,JSON.stringify({...source,revision:8}));
  const stale=await tool.execute({action:'status',projectId:video.id},exec);assert.equal(stale.status,'draft');assert.equal(stale.approval_stale,true);
  await writeFile(sourcePath,JSON.stringify(source));
  assert.equal((await workflowApi.projectTool({model:'changed-model'}, {},{},{},{}).execute({action:'status',projectId:video.id},exec)).approval_stale,true);
  video.choice='not_needed';video.duration=15;
  const boardPath=path.join(home,'storyboard.svg');await writeFile(boardPath,'<svg/>');
  video.storyboard={projectId:video.id,path:boardPath,scriptPath,scriptHash:await api.scriptDigest(scriptPath),imageHash:await api.scriptDigest(boardPath),version:1};
  await api.writeProject(video);
  const [generation,extension]=workflowApi.properties(config);
  const reviewer=workflowApi.projectTool(config,{get:()=>({ask:async()=>{await writeFile(sourcePath,JSON.stringify({...source,revision:8}));return {answers:[{id:'script_review',selected:['脚本通过']}]};}})},{gate:async()=>null},generation,extension);
  await assert.rejects(reviewer.execute({action:'review',projectId:video.id,toolName:'video_generate',scriptPath,specification:spec},exec),/已改稿/);
  assert.equal((await workflowApi.readProject(video.id,exec)).approved,null);

 }finally{if(prior===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=prior;}
});

test('concurrent recovery never removes an active replacement lock',async()=>{
 const folder=await mkdtemp(path.join(dir,'并发恢复 '));const child=spawn(process.execPath,['-e','process.exit(0)']);await once(child,'exit');
 const dead={pid:child.pid,host:hostname(),token:randomUUID()};
 await writeFile(path.join(folder,'.write.lock'),JSON.stringify(dead));await writeFile(path.join(folder,'.recovery.lock'),JSON.stringify({...dead,token:randomUUID()}));
 const results=await Promise.allSettled(Array.from({length:8},()=>api.recoverProjectLock(folder)));
 assert.ok(results.some(r=>r.status==='fulfilled'));
 const release=await api.acquireProjectLock(folder);
 try{await assert.rejects(api.recoverProjectLock(folder),/UNSAFE/);assert.equal((await api.inspectProjectLock(folder)).status,'active');}
 finally{await release();}
});
