import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/businesses/film-production/artifacts/artifact.service.ts'; export * from './src/businesses/film-production/workflows/workflow.engine.ts'; export * from './src/businesses/film-production/roles/index.ts'; export * from './src/businesses/film-production/artifacts/artifact.version.ts'; export * from './src/businesses/film-production/artifacts/artifact.repository.ts'; export * from './src/businesses/film-production/approvals/approval.service.ts'; export * from './src/businesses/film-production/reviews/issue.service.ts'; export * from './src/businesses/film-production/projects/project.service.ts'; export * from './src/businesses/film-production/projects/project.repository.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const api=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const initial=()=>({revision:0,duration_ms:15000,artifacts:{},approvals:{}});
test('创意未批准阻止剧本，旧版本不能覆盖，改稿失效下游',()=>{
 let state=api.commitArtifact(initial(),'creative',{theme:'主题',logline:'故事'},0);
 assert.throws(()=>api.commitArtifact(state,'script',{screenplay:'正文',chapters:[{duration_ms:15000}]},1),/APPROVAL_REQUIRED/);
 state.approvals.creative=1;
 state=api.commitArtifact(state,'script',{screenplay:'正文',chapters:[{duration_ms:15000}]},1);
 assert.throws(()=>api.commitArtifact(state,'creative',{theme:'新主题',logline:'故事'},1),/REVISION_CONFLICT/);
 state=api.commitArtifact(state,'creative',{theme:'新主题',logline:'故事'},2);
 assert.equal(state.artifacts.script.stale,true);assert.equal(state.approvals.creative,undefined);
});
test('相同创意或剧本重复提交不新增版本，也不清除已批准状态',()=>{
 let state=api.commitArtifact(initial(),'creative',{theme:'主题',logline:'故事'},0);
 state.approvals.creative=state.artifacts.creative.revision;
 const creativeRevision=state.revision;
 state=api.commitArtifact(state,'creative',{logline:'故事',theme:'主题'},state.revision);
 assert.equal(state.revision,creativeRevision);assert.equal(state.approvals.creative,state.artifacts.creative.revision);
 state=api.commitArtifact(state,'script',{screenplay:'正文',chapters:[{duration_ms:15000}]},state.revision);
 state.approvals.script=state.artifacts.script.revision;
 const scriptRevision=state.revision,scriptArtifactRevision=state.artifacts.script.revision;
 state=api.commitArtifact(state,'script',{chapters:[{duration_ms:15000}],screenplay:'正文'},state.revision);
 assert.equal(state.revision,scriptRevision);assert.equal(state.artifacts.script.revision,scriptArtifactRevision);assert.equal(state.approvals.script,scriptArtifactRevision);
 state=api.commitArtifact(state,'script',{screenplay:'正文有改动',chapters:[{duration_ms:15000}]},state.revision);
 assert.equal(state.revision,scriptRevision+1);assert.equal(state.approvals.script,undefined);
});
test('时间轴拒绝缺口、重复镜号与总时长错误',()=>{
 api.validateTimeline([{shot_id:'s1',start_ms:0,end_ms:15000}],15000);
 assert.throws(()=>api.validateTimeline([{shot_id:'s1',start_ms:200,end_ms:15000}],15000),/GAP_OR_OVERLAP/);
 assert.throws(()=>api.validateTimeline([{shot_id:'s1',start_ms:0,end_ms:10},{shot_id:'s1',start_ms:10,end_ms:20}],20),/ID/);
 assert.throws(()=>api.validateTimeline([{shot_id:'s1',start_ms:0,end_ms:10}],20),/DURATION/);
});
test('提示词覆盖与审核阻断由程序检查',()=>{
 const state={artifacts:{shots:{data:{shots:[{shot_id:'s1'}]}}}};
 assert.throws(()=>api.validateArtifact('prompts',{prompts:[]},state),/COVERAGE/);
 assert.throws(()=>api.validateArtifact('review',{score:99,passed:true,issues:[{severity:'BLOCKER'}]},state),/REVIEW_BLOCKED/);
});

test('编排只返回当前角色所需依赖，批准前不可越阶段',()=>{
 const state=api.commitArtifact(initial(),'creative',{theme:'a',logline:'b'},0);
 assert.equal(api.nextTask(state).action,'approve');
 state.approvals.creative=1;
 const task=api.nextTask(state);assert.equal(task.role,'screenwriter');assert.deepEqual(Object.keys(task.inputs),['creative']);
});
test('生成编译映射跨段镜头，拒绝旧素材和未确认规格',()=>{
 const state=initial();state.project_id='film';state.revision=6;
 const data={creative:{theme:'a',logline:'b'},script:{screenplay:'剧本',chapters:[{duration_ms:15000}]},assets:{characters:[],scenes:[{scene_id:'loc'}]},shots:{shots:[{shot_id:'s',scene_id:'loc',character_ids:[],start_ms:0,end_ms:15000}]},prompts:{prompts:[{shot_id:'s',prompt:'动作'}]},review:{score:90,passed:true,issues:[]}};
 for(const stage of api.STAGES)state.artifacts[stage]={revision:1,stale:false,data:data[stage]};state.approvals={creative:1,script:1};
 const plan=api.compileProduction(state,[{seconds:10},{seconds:5}],'16:9','720p');
 assert.equal(plan.segments.length,2);assert.deepEqual(plan.segments[1].shot_ids,['s']);assert.equal(plan.specification.duration,15);
 assert.throws(()=>api.compileProduction(state,[{seconds:15}],'bad','720p'),/SPEC/);
 state.artifacts.shots.stale=true;assert.throws(()=>api.compileProduction(state,[{seconds:15}],'16:9','720p'),/STALE/);
});

test('八个角色独立提示词与全部意图均可路由，不改写项目',()=>{
 const state=initial();const before=JSON.stringify(state);
 assert.equal(Object.keys(api.ROLE_PROMPTS).length,8);
 for(const intent of api.INTENTS){const r=api.routeIntent(state,intent);assert.ok(api.ROLE_PROMPTS[r.role]);assert.ok(r.instructions.includes('共同约束'));}
 assert.equal(JSON.stringify(state),before);
 for(const [intent,role] of [['revise_dialogue','screenwriter'],['revise_camera','storyboard'],['revise_character','character'],['revise_scene','scene'],['adapt_model','prompt-engineer'],['verify_facts','reviewer']])assert.equal(api.routeIntent(state,intent).role,role);
});
test('意图路由不绕过批准，局部修改缺目标需澄清，非法实体拒绝',()=>{
 const state=initial();state.artifacts.creative={revision:1,data:{theme:'a',logline:'b'}};
 assert.equal(api.routeIntent(state,'write_script').status,'needs_input');
 state.approvals.creative=1;
 assert.equal(api.routeIntent(state,'write_script').status,'ready');
 assert.equal(api.routeIntent(state,'revise_camera').scope_required,true);
 state.artifacts.shots={revision:2,data:{shots:[{shot_id:'s1'}]}};
 assert.throws(()=>api.routeIntent(state,'revise_camera',['s9']),/UNKNOWN_ENTITY/);
 assert.throws(()=>api.routeIntent(state,'approve_everything'),/UNKNOWN_INTENT/);
});
test('创意V3拒绝时长不守恒、重复段落和过量确认，兼容旧稿',()=>{
 const state=initial();const draft={theme:'主题',logline:'故事',structure:[{section_id:'sec1',duration_ms:15000}],approval_questions:[]};
 api.validateArtifact('creative',draft,state);
 assert.throws(()=>api.validateArtifact('creative',{...draft,structure:[{section_id:'sec1',duration_ms:14000}]},state),/CREATIVE_DURATION_MISMATCH/);
 assert.throws(()=>api.validateArtifact('creative',{...draft,structure:[{section_id:'sec1',duration_ms:7500},{section_id:'sec1',duration_ms:7500}]},state),/INVALID_SECTION_ID/);
 assert.throws(()=>api.validateArtifact('creative',{...draft,approval_questions:['a','b','c','d']},state),/TOO_MANY/);
 api.validateArtifact('creative',{theme:'旧主题',logline:'旧故事'},state);
});
test('编剧V3.1绑定创意版本与场景时长和引用',()=>{
 const state=initial();state.approvals.creative=2;
 const script={screenplay:'正文',approved_creative_revision:2,chapters:[{chapter_id:'c1',duration_ms:15000,scene_ids:['sc1']}],scenes:[{scene_id:'sc1',chapter_id:'c1',duration_ms:15000}],dialogue:[{speaker_id:'ch1',scene_id:'sc1',text:'你好'}]};
 api.validateArtifact('script',script,state);
 assert.throws(()=>api.validateArtifact('script',{...script,approved_creative_revision:1},state),/CREATIVE_REVISION_MISMATCH/);
 assert.throws(()=>api.validateArtifact('script',{...script,scenes:[{...script.scenes[0],duration_ms:14000}]},state),/SCENE_DURATION_MISMATCH/);
 assert.throws(()=>api.validateArtifact('script',{...script,dialogue:[{speaker_id:'',scene_id:'sc1'}]},state),/INVALID_DIALOGUE_REF/);
});
test('新版审核保存失败报告但不放行，评分和阻断数不能伪造',()=>{
 const state=initial();
 const report={review_status:'REVISE_REQUIRED',scores:{requirement_fidelity:95,narrative_quality:90,character_consistency:90,scene_consistency:90,cinematic_quality:90,temporal_consistency:90,prompt_executability:90,structural_completeness:90},issues:[{severity:'MAJOR',status:'OPEN'}],blocking_issue_count:1,delivery_allowed:false};
 api.validateArtifact('review',report,state);
 assert.throws(()=>api.validateArtifact('review',{...report,review_status:'PASS',delivery_allowed:true},state),/REVIEW/);
 assert.throws(()=>api.validateArtifact('review',{...report,blocking_issue_count:0},state),/MISMATCH/);
 api.validateArtifact('review',{...report,review_status:'PASS',issues:[],blocking_issue_count:0,delivery_allowed:true},state);
});
test('全部角色使用已提供的完整版本且职责独立',()=>{
 const blocks=[...readFileSync('Agent_Prompts.md','utf8').matchAll(/```markdown\n([\s\S]*?)\n```/g)].map(m=>m[1]);
 assert.equal(blocks.length,9);
 for(const [i,role] of ['director','creative','screenwriter','character','scene','storyboard','prompt-engineer','reviewer'].entries()) {
  assert.ok(api.ROLE_PROMPTS[role].startsWith(blocks[i+1]));
  assert.ok(api.ROLE_PROMPTS[role].includes(blocks[0]));
  assert.match(api.ROLE_PROMPTS[role],/当前工具数据适配/);
 }
 assert.match(api.ROLE_PROMPTS.character,/IDENTITY_LOCK/);
 assert.match(api.ROLE_PROMPTS.scene,/location_id/);
 assert.match(api.ROLE_PROMPTS.storyboard,/action_start/);
 assert.match(api.ROLE_PROMPTS['prompt-engineer'],/一条批准shot_id/);
 assert.match(api.ROLE_PROMPTS.reviewer,/NOT_EVALUATED/);
});

function v31Project(duration=15000) {
 const state={...initial(),schema_version:'3.1.0',title:'专业短片',project_id:'p',duration_ms:duration};
 const data={
  creative:{theme:'选择',logline:'老人决定去见朋友',structure:[{section_id:'sec',duration_ms:duration}],must_preserve:[],assumptions:[]},
  script:{screenplay:'老人合上存折，说：“走吧。”',chapters:[{chapter_id:'c',duration_ms:duration,scene_ids:['sc']}],scenes:[{scene_id:'sc',chapter_id:'c',duration_ms:duration}],characters:[{character_id:'ch'}],dialogue:[{dialogue_id:'d',scene_id:'sc',speaker_id:'ch',exact_text:'走吧。'}]},
  assets:{characters:[{character_id:'ch',costumes:[{costume_id:'co',character_id:'ch'}]}],scenes:[{scene_id:'sc',location_id:'loc',scene_state_id:'st'}],locations:[{location_id:'loc'}],scene_states:[{scene_state_id:'st',location_id:'loc'}],props:[{prop_id:'pr'}]},
  shots:{shots:[{shot_id:'sh',chapter_id:'c',scene_id:'sc',location_id:'loc',scene_state_id:'st',character_ids:['ch'],costume_ids:['co'],prop_ids:['pr'],dialogue_refs:['d'],start_ms:0,end_ms:duration,duration_ms:duration,narrative_purpose:'作出决定'}]},
  prompts:{prompts:[{shot_id:'sh',location_id:'loc',scene_state_id:'st',duration_ms:duration,generation_mode:'TEXT_TO_VIDEO',dialogue_refs:['d'],prompt:'老人合上存折，轻声说：“走吧。”'}]},
 };
 let current=state;
 for(const stage of ['creative','script','assets','shots','prompts']) {
  current=api.commitArtifact(current,stage,data[stage],current.revision);
  if(['creative','script'].includes(stage))current.approvals[stage]=current.artifacts[stage].revision;
 }
 return current;
}
test('V3.1完整链路校验地点状态道具服装与对白原文',()=>{
 const state=v31Project();
 for(const [key,bad] of [['location_id','missing'],['scene_state_id','missing'],['prop_ids',['missing']],['costume_ids',['missing']]]) {
  const data=structuredClone(state.artifacts.shots.data);data.shots[0][key]=bad;
  assert.throws(()=>api.validateArtifact('shots',data,state),/REFERENCE|MISMATCH/);
 }
 const prompts=structuredClone(state.artifacts.prompts.data);prompts.prompts[0].prompt='老人说“出发吧”。';
 assert.throws(()=>api.validateArtifact('prompts',prompts,state),/DIALOGUE_TEXT_MISMATCH/);
 const shots=structuredClone(state.artifacts.shots.data);shots.shots[0].dialogue_refs=[];
 assert.throws(()=>api.validateArtifact('shots',shots,state),/DIALOGUE_COVERAGE_GAP/);
});
test('V3.1新稿强制结构与来源，旧项目保持可读',()=>{
 const state=v31Project();
 assert.deepEqual(state.artifacts.prompts.source_revisions,{script:2,assets:3,shots:4});
 const data=structuredClone(state.artifacts.prompts.data);data.source_revisions={script:1,assets:3,shots:4};
 assert.throws(()=>api.validateArtifact('prompts',data,state),/SOURCE_REVISION_MISMATCH/);
 assert.throws(()=>api.validateArtifact('creative',{theme:'a',logline:'b'},state),/SCHEMA_REQUIRED/);
 api.validateArtifact('creative',{theme:'a',logline:'b'},initial());
});
test('任务自称完成无产物被拒绝，真实提交后记录产物和校验',()=>{
 let state=initial();state.project_id='p';
 const task=api.scheduleTask(state,api.nextTask(state));
 assert.equal(api.scheduleTask(state,api.nextTask(state)),task);
 assert.throws(()=>api.taskResult(state,task.key,'completed'),/TASK_OUTPUT_REQUIRED/);
 api.taskResult(state,task.key,'running');
 state=api.commitArtifact(state,'creative',{theme:'a',logline:'b'},0);
 const completed=api.taskResult(state,task.key,'completed');
 assert.equal(completed.validation.status,'PASS');assert.equal(completed.output_refs[0].revision,1);
});
test('版本清单反映真实对象校验值，可读导出保留完整剧本',()=>{
 const state=v31Project();
 const before=api.artifactManifest(state);const markdown=api.renderDeliverables(state);
 assert.match(markdown,/正式剧本/);assert.match(markdown,/老人合上存折/);assert.doesNotMatch(markdown,/```json/);
 state.artifacts.prompts.data.prompts[0].prompt+='固定镜头';
 const after=api.artifactManifest(state);
 assert.notEqual(before.at(-1).sha256,after.at(-1).sha256);
 assert.equal(before[0].sha256,after[0].sha256);
});
test('30分钟分章预算闭合，局部服装修改保留剧本并标记下游',()=>{
 const state=v31Project(1800000);
 const original=JSON.stringify(state.artifacts.script);
 const next=api.reviseEntities(state,'assets',[{collection:'characters',entity:{...state.artifacts.assets.data.characters[0],costumes:[{costume_id:'co',character_id:'ch',description:'蓝色外套'}]}}],state.revision);
 assert.equal(JSON.stringify(next.artifacts.script),original);
 assert.deepEqual(next.artifacts.shots.stale_entity_ids,['sh']);assert.equal(next.artifacts.prompts.stale,true);
 const script=structuredClone(state.artifacts.script.data);script.chapters=[{chapter_id:'c1',duration_ms:900000,scene_ids:['sc1']},{chapter_id:'c2',duration_ms:900000,scene_ids:['sc2']}];script.scenes=[{scene_id:'sc1',chapter_id:'c1',duration_ms:900000},{scene_id:'sc2',chapter_id:'c2',duration_ms:900000}];script.dialogue=[];
 api.validateArtifact('script',script,state);
 script.scenes[1].duration_ms--;
 assert.throws(()=>api.validateArtifact('script',script,state),/SCENE_DURATION_MISMATCH/);
});
test('审批修改与拒绝持久记录，拒绝后禁止继续提交制作',()=>{
 const state=api.commitArtifact(initial(),'creative',{theme:'a',logline:'b'},0);
 const revise=api.recordApprovalDecision(state,'creative','REVISE',1);
 assert.equal(api.nextTask(revise).action,'submit');assert.equal(revise.decisions[0].decision,'REVISE');assert.equal(revise.approvals.creative,undefined);
 const rejected=api.recordApprovalDecision(state,'creative','REJECTED',1);
 assert.equal(api.nextTask(rejected).action,'stop');
 assert.throws(()=>api.commitArtifact(rejected,'creative',{theme:'a',logline:'b'},2),/PROJECT_STOPPED/);
 const approved=api.recordApprovalDecision(state,'creative','APPROVED',1);
 assert.equal(approved.approvals.creative,1);assert.equal(approved.decisions[0].artifact_revision,1);assert.ok(approved.decisions[0].decision_time);
});
function finalReview(state,overrides={}) {
 return {review_id:'rev',review_stage:'FINAL_REVIEW',review_scope:['creative','script','assets','shots','prompts'],unverified_items:[],reviewed_revisions:Object.fromEntries(['creative','script','assets','shots','prompts'].map(s=>[s,state.artifacts[s].revision])),review_status:'PASS',scores:{requirement_fidelity:90,narrative_quality:90,character_consistency:90,scene_consistency:90,cinematic_quality:90,temporal_consistency:90,prompt_executability:90,structural_completeness:90},issues:[],delivery_allowed:true,blocking_issue_count:0,...overrides};
}
const critical=(status='OPEN')=>({issue_id:'ISSUE_001',severity:'CRITICAL',status,description:'原话错误',evidence:'剧本与提示词对比',location:'sh',responsible_agent:'prompt-engineer',recheck_criteria:'核对原文与说话人'});
test('恢复任务自包含原始需求、目标时长、批准和统一依赖',()=>{
 const state=v31Project();state.source_brief='两个老人河边钓鱼，原话不得更改';state.project_spec=api.createProjectSpec('作品',state.source_brief,15000,{aspect_ratio:'16:9',hard_constraints:['只许两个人']});
 delete state.artifacts.prompts;
 const task=api.nextTask(state);const route=api.routeIntent(state,'write_prompts');
 assert.equal(task.original_idea,state.source_brief);assert.equal(task.target_duration_ms,15000);assert.deepEqual(task.project_spec.hard_constraints,['只许两个人']);
 assert.deepEqual(Object.keys(task.inputs),['script','assets','shots']);assert.deepEqual(task.input_revisions,route.input_revisions);
 const blank={...initial(),source_brief:'原始想法',duration_ms:60000};assert.equal(api.nextTask(blank).original_idea,'原始想法');assert.equal(api.nextTask(blank).target_duration_ms,60000);
});
test('终审禁止只审提示词或只评一项，不能自标VERIFIED',()=>{
 const state=v31Project();const report=finalReview(state);
 assert.throws(()=>api.validateArtifact('review',{...report,review_stage:'PROMPT_REVIEW'},state),/FINAL_REVIEW_REQUIRED/);
 assert.throws(()=>api.validateArtifact('review',{...report,review_scope:['prompts']},state),/SCOPE_INCOMPLETE/);
 assert.throws(()=>api.validateArtifact('review',{...report,scores:{...report.scores,narrative_quality:null}},state),/NOT_EVALUATED/);
 assert.throws(()=>api.validateArtifact('review',{...report,issues:[critical('VERIFIED')]},state),/ISSUE_INITIAL_STATUS_REQUIRED|ISSUE_RECHECK_REQUIRED/);
});
test('重大问题不可消失降级，修复报告与复审登记绑定实际版本',()=>{
 let state=v31Project();
 const failed=finalReview(state,{review_status:'REVISE_REQUIRED',issues:[critical()],delivery_allowed:false,blocking_issue_count:1});
 state=api.commitArtifact(state,'review',failed,state.revision);
 assert.throws(()=>api.commitArtifact(state,'review',finalReview(state),state.revision),/UNRESOLVED_ISSUE_OMITTED/);
 assert.throws(()=>api.commitArtifact(state,'review',finalReview(state,{issues:[{...critical(),severity:'MINOR'}]}),state.revision),/ISSUE_SEVERITY_DOWNGRADE/);
 assert.throws(()=>api.verifyIssue(state,'ISSUE_001',{evidence:'通过'}),/NOT_RESOLVED/);
 assert.throws(()=>api.commitArtifact(state,'review',{...failed,issues:[critical('RESOLVED')]},state.revision),/ISSUE_REPAIR_ARTIFACT_REQUIRED/);
 state=api.commitArtifact(state,'prompts',{prompts:state.artifacts.prompts.data.prompts.map(p=>({...p,prompt:p.prompt+' 保持原台词与角色。'}))},state.revision);
 state=api.commitArtifact(state,'review',finalReview(state,{review_status:'REVISE_REQUIRED',issues:[critical('RESOLVED')],delivery_allowed:false,blocking_issue_count:1}),state.revision);
 assert.equal(api.nextTask(state).action,'recheck');
 const source_revisions=finalReview(state).reviewed_revisions;
 assert.throws(()=>api.verifyIssue(state,'ISSUE_001',{evidence:'逐字对照',review_revision:0,source_revisions}),/INVALID_RECHECK/);
 api.verifyIssue(state,'ISSUE_001',{evidence:'逐字对照当前d原文，sh说话人一致',review_revision:state.artifacts.review.revision,source_revisions});
 state=api.commitArtifact(state,'review',finalReview(state,{issues:[critical('VERIFIED')]}),state.revision);
 api.validateCurrent(state);
 state=api.commitArtifact(state,'prompts',state.artifacts.prompts.data,state.revision);
 assert.throws(()=>api.commitArtifact(state,'review',finalReview(state,{issues:[critical('VERIFIED')]}),state.revision),/ISSUE_RECHECK_REQUIRED/);
 assert.throws(()=>api.commitArtifact(state,'review',finalReview(state),state.revision),/UNRESOLVED_ISSUE_OMITTED/);
});
test('制作编译禁止把完整镜头与对白切在两次生成中',()=>{
 let state=v31Project();state=api.commitArtifact(state,'review',finalReview(state),state.revision);
 assert.throws(()=>api.compileProduction(state,[{seconds:10},{seconds:5}],'16:9','720p'),/SHOT_SPLIT_REQUIRES/);
 assert.equal(api.compileProduction(state,[{seconds:15}],'16:9','720p').segments.length,1);
 state.project_spec=api.createProjectSpec('作品','故事',15000,{aspect_ratio:'9:16',resolution:'720p'});
 assert.throws(()=>api.compileProduction(state,[{seconds:15}],'16:9','720p'),/PROJECT_SPEC_MISMATCH/);
});
test('磁盘排他锁阻止其他进程写同一项目，释放后可恢复',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const path=await import('node:path');const {spawnSync}=await import('node:child_process');
 const dir=await mkdtemp(path.join(tmpdir(),'film-lock-'));
 try {
  const release=await api.acquireProjectLock(dir);
  const child=spawnSync(process.execPath,['--input-type=module','-e',"import{open}from'node:fs/promises';try{await open(process.argv[1],'wx');process.exitCode=1;}catch(e){process.exitCode=e.code==='EEXIST'?0:2;}",path.join(dir,'.write.lock')]);
  assert.equal(child.status,0);await assert.rejects(()=>api.acquireProjectLock(dir),/PROJECT_LOCKED/);
  await release();const releaseAgain=await api.acquireProjectLock(dir);await releaseAgain();
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('短视频角色专项随当前角色加载，长片不误套短视频时长规则',()=>{
 const markers={director:'【总导演专项】',creative:'【创意专项】',screenwriter:'【编剧专项】',character:'【人物专项】',scene:'【美术专项】',storyboard:'【分镜专项】','prompt-engineer':'【执行提示词专项】',reviewer:'【监制专项】'};
 for(const [role,marker] of Object.entries(markers)){
  const short=api.roleInstructions(initial(),role);
  assert.ok(short.includes(marker),role);
  for(const [other,otherMarker] of Object.entries(markers))if(other!==role)assert.ok(!short.includes(otherMarker),role+' leaked '+other);
  assert.ok(!api.roleInstructions({...initial(),duration_ms:60001},role).includes(marker));
  assert.ok(api.roleInstructions({...initial(),duration_ms:60000},role).includes(marker));
 }
});
