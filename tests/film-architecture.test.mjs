import './no-network-analytics.mjs';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const folder=await mkdtemp(path.join(tmpdir(),'film 架构 '));
after(()=>rm(folder,{recursive:true,force:true}));
await build({stdin:{resolveDir:process.cwd(),contents:`
export * from './src/businesses/film-production/scripts/script.document.ts';
export * from './src/businesses/film-production/chapters/chapter.service.ts';
export * from './src/businesses/film-production/artifacts/artifact.service.ts';
export * from './src/businesses/film-production/artifacts/artifact.version.ts';
export * from './src/businesses/film-production/reviews/independent-review.ts';
export * from './src/businesses/film-production/reviews/review.provenance.ts';
export * from './src/businesses/film-production/evaluation/story-evaluation.ts';
export * from './src/businesses/film-production/roles/index.ts';
export * from './src/businesses/film-production/roles/context.composer.ts';
export * from './src/businesses/film-production/contracts/index.ts';
export * from './src/businesses/video-generation/providers/capabilities.ts';
export * from './src/businesses/video-generation/providers/capability-observations.ts';
`},outfile:path.join(folder,'api.mjs'),bundle:true,platform:'node',format:'esm'});
const api=await import(pathToFileURL(path.join(folder,'api.mjs')));
const chapter=(id)=>({chapter_id:id,duration_ms:15000,scene_ids:['s'+id]});
const scene=(id)=>({scene_id:'s'+id,chapter_id:id,duration_ms:15000,scene_goal:'修好椅子',entry_state:'椅子摇晃',exit_state:'椅子不再摇晃',key_actions:['拧紧螺丝'],location:'院中',time_of_day:'午后'});
const piece=(id)=>({characters:[],chapters:[chapter(id)],scenes:[scene(id)],dialogue:[]});
const continuity={established_facts:['螺丝已拧紧'],unresolved_threads:[],character_state:{}};
function state(){return {revision:1,title:'修椅子',duration_ms:30000,script_policy:'canonical_v1',chapter_policy:'chapter_v1',status:'SCRIPT_WRITING',approvals:{creative:1},artifacts:{creative:{revision:1,data:{theme:'协作',logline:'父女修椅子'},stale:false}}};}
function ready(){const s=state();s.review_policy='isolated_v1';s.artifacts.script={revision:2,stale:false,data:{...piece('1'),screenplay:'作者正文',self_review:{secret:'AUTHOR_SCORE'},scores:{narrative:100}}};s.approvals.script=2;for(const [i,k]of ['assets','shots','prompts'].entries())s.artifacts[k]={revision:i+3,stale:false,data:k==='assets'?{characters:[],scenes:[],locations:[],props:[],scene_states:[]}:k==='shots'?{shots:[]}:{prompts:[]}};s.chat_history='NEVER_SHARE_CHAT';return s;}
function report(s){return {review_id:'r',review_stage:'FINAL_REVIEW',review_scope:['creative','script','assets','shots','prompts'],reviewed_revisions:api.sourceRevisions(s,'review'),unverified_items:[],review_status:'PASS',delivery_allowed:true,scores:Object.fromEntries(['requirement_fidelity','narrative_quality','character_consistency','scene_consistency','cinematic_quality','temporal_consistency','prompt_executability','structural_completeness'].map(k=>[k,90])),issues:[],story_assessment:{reviewer:'mock-isolated',criteria:api.STORY_CRITERIA.map(id=>({id,status:'PASS',evidence:[{scene_id:'s1',reason:'修理行为使椅子从摇晃变为稳定'}]}))}};}
test('结构化节拍决定动作与对白顺序，独立正文被重新渲染',()=>{
 const data=piece('1');data.characters=[{character_id:'c',name:'父亲'}];data.dialogue=[{dialogue_id:'d',speaker_id:'c',scene_id:'s1',exact_text:'先别坐。'}];data.scenes[0].beats=[{action:'扶住椅背'},{dialogue_ref:'d'},{action:'拧紧螺丝'}];data.screenplay='错误的另一份故事';
 const normalized=api.normalizeScript(state(),'script',data);
 assert.ok(!normalized.screenplay.includes('错误'));assert.ok(normalized.screenplay.indexOf('扶住')<normalized.screenplay.indexOf('先别坐'));assert.ok(normalized.screenplay.indexOf('先别坐')<normalized.screenplay.indexOf('拧紧'));
 assert.deepEqual(normalized.scenes[0].key_actions,['扶住椅背','拧紧螺丝']);assert.equal(data.screenplay,'错误的另一份故事');
 data.scenes[0].beats=[{action:'扶住椅背'}];assert.throws(()=>api.renderScript(data),/BEAT_DIALOGUE_COVERAGE/);
 data.scenes[0].beats=[{dialogue_ref:'d'},{dialogue_ref:'d'}];assert.throws(()=>api.renderScript(data),/INVALID_BEAT_DIALOGUE/);
});
test('逐章保存不冒充整片完成，恢复指向未写章，汇总后才允许剧本审批',()=>{
 let s=api.defineChapters(state(),[chapter('1'),chapter('2')],1);
 s=api.submitChapter(s,'script','1',piece('1'),continuity,s.revision);
 assert.equal(s.status,'SCRIPT_PARTIAL');assert.equal(s.artifacts.script,undefined);assert.equal(s.approvals.script,undefined);
 const task=api.chapterTask(s,{stage:'script',action:'submit',instructions:'写作'});assert.equal(task.chapter.chapter_id,'2');assert.deepEqual(task.previous_chapters[0].continuity,continuity);
 s=api.submitChapter(s,'script','2',piece('2'),continuity,s.revision);
 assert.equal(s.artifacts.script.data.scenes.length,2);assert.equal(s.artifacts.script.data.chapters.reduce((n,c)=>n+c.duration_ms,0),30000);assert.match(s.artifacts.script.data.screenplay,/s1/);assert.match(s.artifacts.script.data.screenplay,/s2/);assert.equal(s.approvals.script,undefined);
});
test('章节预算、连续性、错章与旧版本均阻断',()=>{
 assert.throws(()=>api.defineChapters(state(),[chapter('1')],1),/INVALID_CHAPTER_PLAN/);
 const s=api.defineChapters(state(),[chapter('1'),chapter('2')],1);
 assert.throws(()=>api.submitChapter(s,'script','1',piece('2'),continuity,s.revision),/CHAPTER_SCENE_MISMATCH/);
 assert.throws(()=>api.submitChapter(s,'script','1',piece('1'),{},s.revision),/CONTINUITY_REQUIRED/);
 const stale=structuredClone(s);stale.approvals.creative=99;assert.throws(()=>api.submitChapter(stale,'script','1',piece('1'),continuity,stale.revision),/STALE/);
 assert.throws(()=>api.submitChapter(s,'script','1',piece('1'),continuity,0),/REVISION_CONFLICT/);
});
test('局部剧本修改重新渲染，仅替换目标实体并失效批准和下游',()=>{
 let s=api.defineChapters(state(),[chapter('1'),chapter('2')],1);for(const id of ['1','2'])s=api.submitChapter(s,'script',id,piece(id),continuity,s.revision);
 s.approvals.script=s.artifacts.script.revision;s.artifacts.assets={revision:99,data:{},stale:false};
 const untouched=structuredClone(s.artifacts.script.data.scenes[1]);
 const next=api.reviseEntities(s,'script',[{collection:'scenes',entity:{...s.artifacts.script.data.scenes[0],key_actions:['重新拧紧椅腿螺丝']}}],s.revision);
 assert.deepEqual(next.artifacts.script.data.scenes[1],untouched);assert.match(next.artifacts.script.data.screenplay,/重新拧紧/);assert.equal(next.approvals.script,undefined);assert.equal(next.artifacts.assets.stale,true);
});
test('独立审核不带聊天、作者自评与旧审核，输入摘要绑定当前版本',()=>{
 const s=ready();const a=api.independentReviewInput(s);assert.ok(!JSON.stringify(a).includes('NEVER_SHARE_CHAT'));assert.ok(!JSON.stringify(a).includes('AUTHOR_SCORE'));assert.equal(a.input.inputs.script.data.scores,undefined);
 s.artifacts.script.revision++;s.approvals.script=s.artifacts.script.revision;assert.notEqual(a.digest,api.independentReviewInput(s).digest);
 s.approvals.creative=0;assert.throws(()=>api.independentReviewInput(s),/APPROVAL_REQUIRED/);
});
test('实际独立请求支持断点复用；伪造执行标记不能提交审核',async()=>{
 const s=ready(),r=report(s),cache={};let calls=0;
 const options={cache,complete:async(_config,_brief,opts)=>{calls++;assert.equal(opts.taskMessages.length,2);assert.ok(!opts.taskMessages[1].content.includes('NEVER_SHARE_CHAT'));return {script:JSON.stringify(r),model:'mock',usage:{promptTokens:4}};},onCheckpoint:async(k,v)=>{cache[k]=v;}};
 const cfg={connectionMode:'metaontic',baseUrl:'https://mock.invalid',metaonticApiKey:'not-real'};
 const result=await api.runIndependentReview(cfg,s,options);assert.equal(calls,1);assert.equal(result.execution_provenance.requests,1);
 const reused=await api.runIndependentReview(cfg,s,options);assert.equal(calls,1);assert.equal(reused.execution_provenance.reused_requests,1);
 assert.throws(()=>api.validateReviewProvenance(s,reused),/INDEPENDENT_REVIEW_REQUIRED/);
 s.independent_review_receipt={input_revisions:api.sourceRevisions(s,'review'),report_digest:api.reportDigest(reused)};api.validateReviewProvenance(s,reused);
 reused.scores.narrative_quality=100;assert.throws(()=>api.validateReviewProvenance(s,reused),/INDEPENDENT_REVIEW_REQUIRED/);
});
test('审核输出截断、无效JSON或没有六维创作证据均不能通过',async()=>{
 const s=ready();for(const result of [{script:'{}',truncated:true},{script:'不是JSON'},{script:JSON.stringify({...report(s),story_assessment:undefined})}])await assert.rejects(()=>api.runIndependentReview({},s,{complete:async()=>result}),/TRUNCATED|INVALID_|NOT_EVALUATED/);
});
test('自动评测报告重复事实，但不会将艺术质量冒充自动通过',()=>{
 const script=piece('1');script.scenes.push({...scene('2'),key_actions:['拧紧螺丝']});
 const result=api.evaluateStory(script);assert.equal(result.artistic_status,'NOT_EVALUATED');assert.deepEqual(result.automated_facts.repeated_actions,['拧紧螺丝']);
 const assessment=report(ready()).story_assessment;assert.equal(api.evaluateStory(piece('1'),assessment).artistic_status,'PASS');assessment.criteria[0].evidence[0].scene_id='absent';assert.throws(()=>api.evaluateStory(piece('1'),assessment),/EVALUATION_EVIDENCE/);
});
test('六类评测题覆盖事实边界、短片与长片，不通过流量词硬判艺术分',async()=>{
 const cases=JSON.parse(await readFile('tests/fixtures/story-evaluation/cases.json','utf8'));assert.equal(new Set(cases.map(c=>c.id)).size,6);assert.ok(cases.some(c=>c.genre==='documentary'));assert.ok(cases.some(c=>c.duration_ms>=600000));assert.ok(cases.every(c=>c.must_preserve.length&&c.review_focus.length));
});
test('角色按阶段组合上下文，记录明确标注的估算成本，局部镜头只带相关场次',()=>{
 const s=ready();const instructions=api.roleInstructions(s,'screenwriter');assert.ok(Buffer.byteLength(instructions)<12000);assert.doesNotMatch(instructions,/# COMMON_CONTRACT V4.0/);
 s.artifacts.script.data={characters:[],chapters:[chapter('1'),chapter('2')],scenes:[scene('1'),scene('2')],dialogue:[],screenplay:'WHOLE_SCRIPT'};
 s.artifacts.shots.data.shots=[{shot_id:'a',scene_id:'s1',character_ids:[]},{shot_id:'b',scene_id:'s2',character_ids:[]}];
 const input=api.scopedInputs(s,'shots','storyboard',['a']);assert.equal(input.shots.data.shots.length,1);assert.equal(input.script.data.scenes.length,1);assert.ok(!JSON.stringify(input).includes('WHOLE_SCRIPT'));
 const m=api.promptMetrics(instructions,input);assert.ok(m.input_bytes>0);assert.match(m.token_estimate_method,/not_provider_usage/);
});
test('渠道与地址隔离样本，仅真实成功任务写入，不推断音频与时长上限',async()=>{
 const prior=process.env.DSH_HOME;process.env.DSH_HOME=path.join(folder,'样本');
 try{
 const a={connectionMode:'metaontic',baseUrl:'https://a.invalid',metaonticApiKey:'NEVER_STORE_KEY'},b={...a,baseUrl:'https://b.invalid'};
 assert.notEqual(api.capabilityChannel(a),api.capabilityChannel(b));
 const body={model:'doubao-seedance-2-0-mini-260615',duration:5,prompt:'NEVER_STORE_PROMPT'};
 await api.recordCapabilityObservation(a,body,{status:'failed',taskId:'failed'});assert.deepEqual(await api.readCapabilityObservations(),[]);
 await api.recordCapabilityObservation(a,body,{status:'succeeded',taskId:'task'});
 const samples=await api.readCapabilityObservations();assert.equal(samples.length,1);assert.ok(!JSON.stringify(samples).includes('NEVER_STORE'));
 const profile=api.channelCapabilities(body.model,api.capabilityChannel(a),samples);assert.equal(profile.verification_scope,'OBSERVED_TASKS_ONLY');assert.equal(profile.supported_durations_ms.max,15000);assert.equal(api.channelCapabilities(body.model,api.capabilityChannel(b),samples).verified_at,null);
 assert.equal(api.channelCapabilities(body.model,'unknown',samples).native_audio_supported,null);
 const files=await readdir(path.join(process.env.DSH_HOME,'state','metaontic-video','capability-observations'));assert.equal(files.length,1);
 }finally{if(prior===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=prior;}
});
test('长稿逐章审核不截正文，合并报告覆盖全片场次并保持输入不变',async()=>{
 const s=ready();s.artifacts.script.data={characters:[],chapters:[chapter('1'),chapter('2')],scenes:[{...scene('1'),screenplay_detail:'甲'.repeat(45000)},{...scene('2'),screenplay_detail:'乙'.repeat(45000)}],dialogue:[]};
 const original=JSON.stringify(s);const batches=api.reviewBatches(s);assert.equal(batches.length,2);assert.equal(batches[0].input.inputs.script.data.scenes.length,1);assert.equal(batches[0].input.inputs.script.data.scenes[0].screenplay_detail.length,45000);
 let calls=0;const cache={};const r=await api.runIndependentReview({},s,{cache,onCheckpoint:async(key,value)=>{cache[key]=value;},complete:async(_cfg,_brief,opts)=>{calls++;const input=JSON.parse(opts.taskMessages[1].content);if(input.review_scope==='CROSS_CHAPTER_STRUCTURE')return {script:JSON.stringify({status:'PASS',checks:['causal_progression','character_arc','continuity','setup_payoff','requirements'].map(id=>({id,status:'PASS',evidence:[{scene_id:'s1',reason:'前章动作'},{scene_id:'s2',reason:'后章回收'}]}))}),model:'mock'};const result=report(s);for(const c of result.story_assessment.criteria)c.evidence[0].scene_id=input.inputs.script.data.scenes[0].scene_id;return {script:JSON.stringify(result),model:'mock'};}});
 assert.equal(calls,3);assert.equal(r.global_review.status,'PASS');assert.equal(r.chapter_reviews.length,2);const replay=await api.runIndependentReview({},s,{cache,complete:async()=>{throw Error('不得重放成功审核');}});assert.equal(replay.execution_provenance.requests,0);assert.equal(replay.execution_provenance.reused_requests,3);assert.deepEqual(new Set(r.story_assessment.criteria[0].evidence.map(e=>e.scene_id)),new Set(['s1','s2']));assert.equal(JSON.stringify(s),original);
});
test('前章修改会使后章连续性草稿失效，禁止带旧输入继续汇总',()=>{
 let s=api.defineChapters(state(),[{chapter_id:'1',duration_ms:10000},{chapter_id:'2',duration_ms:10000},{chapter_id:'3',duration_ms:10000}],1);
 const part=id=>{const p=piece(id);p.chapters[0].duration_ms=10000;p.scenes[0].duration_ms=10000;return p;};
 s=api.submitChapter(s,'script','1',part('1'),continuity,s.revision);s=api.submitChapter(s,'script','2',part('2'),continuity,s.revision);assert.ok(s.chapter_workbench.entries['2'].script);
 s=api.submitChapter(s,'script','1',part('1'),{...continuity,established_facts:['改为更换螺丝']},s.revision);assert.equal(s.chapter_workbench.entries['2'].script,undefined);assert.equal(api.chapterTask(s,{stage:'script',action:'submit',instructions:''}).chapter.chapter_id,'2');
});
test('场景局部上下文通过地点引用找到场次；没有人物出场证据时不丢掉全稿',()=>{
 const s=ready();s.artifacts.script.data={characters:[{character_id:'c'}],chapters:[chapter('1'),chapter('2')],scenes:[scene('1'),scene('2')],dialogue:[]};s.artifacts.assets.data.scenes=[{scene_id:'s1',location_id:'loc1'},{scene_id:'s2',location_id:'loc2'}];
 const input=api.scopedInputs(s,'assets','scene',['loc2']);assert.deepEqual(input.script.data.scenes.map(s=>s.scene_id),['s2']);assert.equal(input.script.data.characters.length,1);
 const unknown=api.scopedInputs(s,'assets','character',['c']);assert.equal(unknown.script.data.scenes.length,2);
});

test('单章审核超限在调用前阻断，不能截断正文或产生请求',async()=>{
 const s=ready();s.artifacts.script.data.scenes[0].key_actions=['完整正文'.repeat(25000)];let calls=0;
 await assert.rejects(()=>api.runIndependentReview({},s,{complete:async()=>{calls++;}}),/REVIEW_CONTEXT_BUDGET_EXCEEDED|CHAPTER_REVIEW_CONTEXT_TOO_LARGE/);assert.equal(calls,0);
});
