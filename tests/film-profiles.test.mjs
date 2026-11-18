import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const result=await build({stdin:{contents:`export * from './src/businesses/film-director/profiles/index.ts';
export * from './src/businesses/film-director/runtime/spec.ts';
export {filmDirectorBusiness} from './src/businesses/film-director/index.ts';
export * from './src/businesses/film-director/roles/index.ts';
export * from './src/businesses/film-director/workflows/orchestration.ts';
export * from './src/businesses/film-director/runtime/project.ts';
export * from './src/businesses/film-director/runtime/approvals.ts';
export * from './src/businesses/video/providers/text.ts';
export * from './src/businesses/video/integrations/canvas-stages.ts';`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const api=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const state=(type)=>({revision:0,status:'REQUIREMENT_ANALYSIS',source_brief:'安静河岸的观察',duration_ms:15000,project_spec:api.createProjectSpec('作品','安静河岸的观察',15000,type?{work_type:type,visual_style:'千禧MiniDV',narrative_mode:'OBSERVATIONAL'}:{}),artifacts:{},approvals:{},decisions:[]});
const creative=(p)=>({theme:'细节发现',logline:'一次观察',type_details:Object.fromEntries(Object.keys(p.creative_fields).map(k=>[k,'河面细小变化与观察回应']))});

test('六类配置分别加载策略和八角色规则，类型风格叙事方式独立保存',()=>{
 assert.equal(api.WORK_TYPES.length,6);
 for(const type of api.WORK_TYPES){
  const s=state(type);const profile=api.resolveProfile(s.project_spec);
  assert.equal(profile.id,type);assert.equal(s.project_spec.visual_style,'千禧MiniDV');
  assert.equal(s.project_spec.narrative_mode,'OBSERVATIONAL');assert.equal(s.project_spec.profile_revision,'1');
  const next=api.nextTask(s);assert.equal(next.work_profile.profile.id,type);
  assert.ok(next.instructions.includes(profile.strategy));
  for(const role of Object.keys(api.ROLE_PROMPTS))assert.ok(api.roleInstructions(s,role).includes(`作品类型 ${type}`));
  const route=api.routeIntent(s,'develop_idea');assert.equal(route.work_profile.profile.id,type);
  assert.ok(route.instructions.includes(profile.strategy));
 }
 const a=api.resolveProfile(state('COMEDY').project_spec);a.strategy='被修改';
 assert.notEqual(api.resolveProfile(state('COMEDY').project_spec).strategy,a.strategy);
});
test('未知类型、叙事模式、配置修订被拒绝，不静默回退剧情配置',()=>{
 assert.throws(()=>state('MiniDV'),/UNKNOWN_WORK_TYPE/);
 assert.throws(()=>api.createProjectSpec('x','y',15000,{narrative_mode:'IMAGE_TO_VIDEO'}),/UNKNOWN_NARRATIVE_MODE/);
 assert.throws(()=>api.resolveProfile({work_type:'COMEDY',profile_revision:'999'}),/PROFILE_REVISION/);
 assert.throws(()=>api.profileRevision('__proto__'),/UNKNOWN_WORK_TYPE/);
});
test('缺失类型保留未选择状态，新项目批准前需选择；旧项目不强迁移',()=>{
 let s=state();assert.equal(api.profileContext(s).status,'UNSELECTED');
 s=api.commitArtifact(s,'creative',{theme:'x',logline:'y'},0);
 assert.equal(api.nextTask(s).action,'configure_profile');
 assert.throws(()=>api.recordApprovalDecision(s,'creative','APPROVED',s.revision),/WORK_TYPE_REQUIRED/);
 const old={revision:1,artifacts:{creative:{revision:1,data:{theme:'x',logline:'y'}}},approvals:{}};
 assert.equal(api.profileContext(old).status,'LEGACY_GENERIC');
 assert.equal(api.recordApprovalDecision(old,'creative','APPROVED',1).approvals.creative,1);
});
test('类型变更保留原材料、失效全部产物及批准，使旧制作绑定过期',()=>{
 let s=state('DRAMA');s.revision=8;s.approvals={creative:1,script:2};
 s.artifacts={creative:{revision:1,data:{theme:'原主题'}},script:{revision:2,data:{screenplay:'原文'}}};
 s.production={source_revision:8,videoProjectId:'old'};
 const next=api.configureProfile(s,{work_type:'LIFESTYLE'},8);
 assert.equal(next.revision,9);assert.deepEqual(next.approvals,{});
 assert.equal(next.project_spec.work_type,'LIFESTYLE');assert.equal(next.project_spec.visual_style,'千禧MiniDV');
 assert.equal(next.artifacts.script.data.screenplay,'原文');assert.equal(next.artifacts.script.stale,true);
 assert.equal(next.artifacts.creative.stale,true);assert.notEqual(next.production.source_revision,next.revision);
 assert.equal(s.artifacts.script.stale,undefined);
 assert.throws(()=>api.configureProfile(next,{work_type:'COMEDY'},8),/REVISION_CONFLICT/);
 assert.equal(api.configureProfile(next,{work_type:'COMEDY',visual_style:'x'},9).project_spec.visual_style,'x');
 assert.throws(()=>api.configureProfile(next,{work_type:'COMEDY',unknown:'x'},9),/INVALID_PROFILE/);
 assert.deepEqual(api.configureProfile(next,{work_type:'LIFESTYLE'},9),next);
 assert.throws(()=>api.recordApprovalDecision(next,'creative','APPROVED',9),/INVALID_APPROVAL/);
});
test('类型产物扩展在真实提交中校验，审批记录绑定类型修订',()=>{
 for(const type of api.WORK_TYPES){
  let s=state(type);const p=api.resolveProfile(s.project_spec);
  assert.throws(()=>api.commitArtifact(s,'creative',{theme:'x',logline:'y'},0),/TYPE_DETAIL_REQUIRED/);
  s=api.commitArtifact(s,'creative',creative(p),0);
  assert.deepEqual(s.artifacts.creative.profile_ref,{work_type:type,profile_revision:'1'});
  s=api.recordApprovalDecision(s,'creative','APPROVED',s.revision);
  assert.equal(s.decisions[0].work_type,type);assert.equal(s.decisions[0].profile_revision,'1');
  const script={screenplay:'完整场景',chapters:[{duration_ms:15000}]};
  assert.throws(()=>api.commitArtifact(s,'script',script,s.revision),/TYPE_DETAIL_REQUIRED/);
  script.type_details=Object.fromEntries(Object.keys(p.script_fields).map(k=>[k,'具体材料与待核实说明']));
  assert.equal(api.commitArtifact(s,'script',script,s.revision).artifacts.script.data.screenplay,'完整场景');
 }
});
test('类型终审覆盖、版本、证据和未评估状态有确定性卡口，艺术建议关联问题',()=>{
 const s=state('LIFESTYLE');const p=api.resolveProfile(s.project_spec);
 const report={review_status:'PASS',issues:[],type_review:{work_type:p.id,profile_revision:p.revision,checks:p.review_criteria.map(c=>({criterion_id:c.id,status:'PASS',evidence:'SHOT_001浮漂轻动，SHOT_002人物注意到变化'}))}};
 api.validateProfileArtifact('review',report,s);
 assert.throws(()=>api.validateProfileArtifact('review',{...report,type_review:{...report.type_review,checks:[]}},s),/COVERAGE/);
 assert.throws(()=>api.validateProfileArtifact('review',{...report,type_review:{...report.type_review,profile_revision:'0'}},s),/TYPE_REVIEW_REQUIRED/);
 report.type_review.checks[0].status='NOT_EVALUATED';
 assert.throws(()=>api.validateProfileArtifact('review',report,s),/NOT_EVALUATED/);
 report.type_review.checks[0].status='CONCERN';
 assert.throws(()=>api.validateProfileArtifact('review',report,s),/ISSUE_REQUIRED/);
 report.type_review.checks[0].issue_id='I1';report.issues=[{issue_id:'I1',severity:'MINOR'}];report.review_status='PASS_WITH_WARNINGS';
 api.validateProfileArtifact('review',report,s);
});
test('画布需求恢复所选类型，写作采用同一类型策略并保持Markdown和分段契约',()=>{
 const data=api.requirementNodeData('河岸观察',30,15,'16:9','720p','LIFESTYLE');
 const node=api.requirementNodeOf({nodes:{n:{id:'n',data}}});
 assert.equal(node.data.metaonticRequirementSpec.work_type,'LIFESTYLE');
 const prompt=api.scriptPrompt({idea:'河岸观察',totalSeconds:30,segments:2,work_type:node.data.metaonticRequirementSpec.work_type});
 assert.ok(prompt.includes(api.resolveProfile(state('LIFESTYLE').project_spec).strategy));
 assert.ok(prompt.includes('正好 2 行'));assert.ok(prompt.includes('不输出type_details或审核JSON'));
 assert.throws(()=>api.scriptPrompt({idea:'x',work_type:'INVALID'}),/UNKNOWN_WORK_TYPE/);
 assert.equal(api.requirementNodeData('x',15,15,'16:9','720p').metaonticRequirementSpec.work_type,undefined);
});
test('真实工具创建、审批、改类型及重读保存一致，旧批准与产物不能继续用',async()=>{
 const home=await mkdtemp(path.join(tmpdir(),'film-type-中文 '));const prior=process.env.DSH_HOME;
 process.env.DSH_HOME=home;
 let tool,questions=0,approvalText='';
 const runtime={config:{},tools:{register(_business,value){tool=value;}},ctx:{get(){return {ask:async(request)=>{questions++;approvalText=request.questions[0].question;return {answers:[{id:'film_approval',selected:['批准本版']}]};}};}}};
 const exec={agent:{session:{id:'film-profile-test'}}};
 try{
  api.filmDirectorBusiness.apply(runtime);
  let s=await tool.execute({action:'create',title:'河岸观察',sourceBrief:'只看水波',durationSeconds:15,projectSpec:JSON.stringify({work_type:'LIFESTYLE'})},exec);
  const id=s.project_id;const p=api.resolveProfile(s.project_spec);
  const invalid=await tool.execute({action:'validate',projectId:id,stage:'creative',content:'{}x'},exec);
  assert.equal(invalid.valid,false);assert.equal(invalid.error_code,'INVALID_ARTIFACT_JSON');
  assert.equal((await tool.execute({action:'read',projectId:id},exec)).revision,s.revision);
  assert.equal(questions,0);
  await assert.rejects(()=>tool.execute({action:'submit',projectId:id,stage:'creative',expectedRevision:s.revision,content:'{}x'},exec),/INVALID_ARTIFACT_JSON/);
  const unchanged=await tool.execute({action:'read',projectId:id,responseMode:'compact'},exec);
  assert.equal(unchanged.revision,s.revision);assert.equal(unchanged.artifacts,undefined);
  assert.equal(unchanged.nextTask.stage,'creative');
  const single=await tool.execute({action:'read',projectId:id,stage:'creative'},exec);assert.equal(single.artifact,null);
  const data={...creative(p),structure:[{section_id:'S1',purpose:'观察水面变化',visual_evidence:'风吹动水纹',duration_ms:15000}],must_preserve:[],assumptions:[]};
  s=await tool.execute({action:'submit',projectId:id,stage:'creative',expectedRevision:s.revision,content:JSON.stringify(data)},exec);
  assert.equal(s.response_mode,'compact');assert.equal(s.artifacts,undefined);
  assert.equal(s.artifact_summary.creative.revision,s.revision);
  const full=await tool.execute({action:'read',projectId:id,responseMode:'full'},exec);assert.deepEqual(full.artifacts.creative.data,data);
  const saved=await tool.execute({action:'read',projectId:id,stage:'creative'},exec);
  assert.deepEqual(saved.artifact.data,data);
  s=await tool.execute({action:'approve',projectId:id,stage:'creative',expectedRevision:s.revision},exec);
  assert.equal(questions,1);assert.equal(s.approvals.creative,1);
  assert.match(approvalText,/创意方案（修订 1）/);
  assert.match(approvalText,/核心表达：细节发现/);
  assert.match(approvalText,/15 秒/);
  assert.ok(!approvalText.includes(JSON.stringify(data)));
  assert.ok(!approvalText.includes('"duration_ms"'));
  await assert.rejects(()=>tool.execute({action:'configure_profile',projectId:id,expectedRevision:0,projectSpec:JSON.stringify({work_type:'COMEDY'})},exec),/REVISION_CONFLICT/);
  const oldRevision=s.revision;
  s=await tool.execute({action:'configure_profile',projectId:id,expectedRevision:oldRevision,projectSpec:JSON.stringify({work_type:'COMEDY'})},exec);
  const read=await tool.execute({action:'read',projectId:id},exec);
  assert.equal(read.project_spec.work_type,'COMEDY');assert.equal(read.artifacts.creative.stale,true);
  assert.equal(read.approvals.creative,undefined);assert.equal(read.nextTask.work_profile.profile.id,'COMEDY');
  await assert.rejects(()=>tool.execute({action:'approve',projectId:id,stage:'creative',expectedRevision:s.revision},exec),/INVALID_APPROVAL/);
  assert.equal(questions,1);
  const dimensionSpec={genre:'comedy',format:'skit',purpose:'entertainment',style_profile:'minidv'};
  s=await tool.execute({action:'configure_profile',projectId:id,expectedRevision:s.revision,projectSpec:JSON.stringify(dimensionSpec)},exec);
  const combined=await tool.execute({action:'read',projectId:id},exec);
  assert.equal(combined.work_profile.resolved_profiles.profiles.style_profile.id,'minidv');
  assert.equal(combined.project_spec.format,'skit');
  assert.match(combined.nextTask.instructions,/四维 Profile/);
  const revision=s.revision;
  await assert.rejects(()=>tool.execute({action:'configure_profile',projectId:id,expectedRevision:revision,projectSpec:JSON.stringify({format:'missing'})},exec),/UNKNOWN_PROFILE_DIMENSION/);
  assert.equal((await tool.execute({action:'read',projectId:id},exec)).revision,revision);
 }finally{if(prior===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=prior;await rm(home,{recursive:true,force:true});}
});

test('四维配置独立组合、按角色注入，未选项不推断且返回真实注册选项',()=>{
 const s=state();s.project_spec=api.createProjectSpec('访谈','记录河岸生活',15000,{genre:'documentary',format:'interview',purpose:'education',style_profile:'minidv',tone:'克制',visual_style:'午后自然光'});
 const r=api.resolveDimensions(s.project_spec);
 assert.equal(r.status,'RESOLVED');assert.equal(r.fact_provenance_required,true);
 assert.deepEqual(Object.keys(r.profiles),['genre','format','purpose','style_profile']);
 assert.ok(r.available_profiles.genre.some(p=>p.id==='animation'));
 assert.equal(api.profileContext(s).status,'SELECTED');
 assert.equal(api.nextTask(s).resolved_profiles.profiles.format.id,'interview');
 for(const role of Object.keys(api.ROLE_PROMPTS))assert.match(api.roleInstructions(s,role),/四维 Profile/);
 assert.match(api.roleInstructions(s,'screenwriter'),/采访问题/);
 assert.match(api.roleInstructions(s,'reviewer'),/dimension_review/);
 const partial=api.resolveDimensions({genre:'romance'});assert.deepEqual(Object.keys(partial.profiles),['genre']);
 r.profiles.genre.label='修改副本';assert.notEqual(api.resolveDimensions(s.project_spec).profiles.genre.label,'修改副本');
 assert.equal(r.profiles.genre.rules,undefined); // 上下文不携带其他角色的写作规则。
 const draft=api.commitArtifact(s,'creative',{theme:'观察',logline:'河岸访谈',structure:[{section_id:'sec',duration_ms:15000}],must_preserve:[],assumptions:[]},0);
 assert.equal(api.nextTask(draft).action,'approve');
 assert.equal(api.recordApprovalDecision(draft,'creative','APPROVED',1).approvals.creative,1);
});
test('四维冲突、未知配置与修订拒绝，历史自由题材保留但不冒充解析',()=>{
 assert.throws(()=>api.createProjectSpec('x','y',15000,{genre:'documentary',narrative_mode:'FICTION'}),/PROFILE_CONFLICT/);
 assert.throws(()=>api.createProjectSpec('x','y',15000,{format:'unknown'}),/UNKNOWN_PROFILE_DIMENSION/);
 assert.throws(()=>api.resolveDimensions({genre:'comedy',dimension_profile_revision:'99'}),/PROFILE_REVISION/);
 assert.throws(()=>api.createProjectSpec('x','y',15000,{purpose:'__proto__'}),/UNKNOWN_PROFILE_DIMENSION/);
 const legacy=api.resolveDimensions({genre:'旧自由文本题材'});assert.deepEqual(legacy.profiles,{});assert.ok(legacy.warnings.includes('LEGACY_GENRE_UNRESOLVED'));
});
test('增量修改四维保留材料并失效批准，重复配置无操作，允许清除维度',()=>{
 const s=state('DRAMA');s.revision=8;s.approvals={creative:1,script:2};s.artifacts={script:{revision:2,data:{screenplay:'原稿'}}};
 const next=api.configureProfile(s,{genre:'romance',format:'short_film',purpose:'entertainment',style_profile:'cinematic_realism'},8);
 assert.equal(next.project_spec.work_type,'DRAMA');assert.equal(next.project_spec.genre,'romance');
 assert.equal(next.artifacts.script.data.screenplay,'原稿');assert.equal(next.artifacts.script.stale,true);assert.deepEqual(next.approvals,{});
 assert.equal(next.revision,9);assert.deepEqual(s.approvals,{creative:1,script:2});
 assert.equal(api.configureProfile(next,{genre:'romance'},9).revision,9);
 const clear=api.configureProfile(next,{style_profile:null},9);assert.equal(clear.project_spec.style_profile,null);assert.equal(clear.revision,10);
 assert.throws(()=>api.configureProfile(next,{genre:'documentary',narrative_mode:'FICTION'},9),/PROFILE_CONFLICT/);
 assert.throws(()=>api.configureProfile(next,{purpose:'education'},8),/REVISION_CONFLICT/);
});
test('四维终审要求逐维证据，未检查与缺失问题引用不能放行',()=>{
 const s=state();s.project_spec=api.createProjectSpec('x','y',15000,{genre:'animation',purpose:'education'});
 const r={review_status:'PASS',issues:[],dimension_review:{profile_revision:'1',checks:[{dimension:'genre',profile_id:'animation',status:'PASS',evidence:'SC001 世界规则与动作一致'},{dimension:'purpose',profile_id:'education',status:'PASS',evidence:'SC001 演示有事实依据'}]}};
 api.validateProfileArtifact('review',r,s);
 assert.throws(()=>api.validateProfileArtifact('review',{...r,dimension_review:undefined},s),/DIMENSION_REVIEW_REQUIRED/);
 const bad=structuredClone(r);bad.dimension_review.checks[0].status='NOT_EVALUATED';assert.throws(()=>api.validateProfileArtifact('review',bad,s),/NOT_EVALUATED/);
 bad.dimension_review.checks[0].status='CONCERN';assert.throws(()=>api.validateProfileArtifact('review',bad,s),/ISSUE_REQUIRED/);
 bad.dimension_review.checks[0].issue_id='i1';bad.issues=[{issue_id:'i1'}];api.validateProfileArtifact('review',bad,s);
 bad.dimension_review.checks.push(bad.dimension_review.checks[0]);assert.throws(()=>api.validateProfileArtifact('review',bad,s),/COVERAGE/);
});
test('分镜路由显式提供与预检相同的镜头字段契约',()=>{
 const task=api.routeIntent(state('DRAMA'),'design_shots');
 assert.deepEqual(task.submission_contract.required_arrays,['shots']);
 assert.deepEqual(task.submission_contract.item_required_arrays.shots,['character_ids','prop_ids','costume_ids','dialogue_refs']);
 assert.match(task.submission_contract.instructions,/无对白才为空/);
});
test('模型占位值提交前拒绝，旧模型可通过正式入口修订且保留创意剧本批准',()=>{
 for(const target_model of ['占位文字','placeholder','MODEL_ID','unknown'])assert.throws(()=>api.createProjectSpec('x','y',15000,{target_model}),/INVALID_TARGET_MODEL/);
 const s=state('DRAMA');s.revision=8;s.project_spec.target_model='旧占位文字';s.approvals={creative:1,script:2};
 s.artifacts={creative:{revision:1,data:{}},script:{revision:2,data:{}},assets:{revision:3,data:{}},shots:{revision:4,data:{}},prompts:{revision:5,data:{}},review:{revision:6,data:{}}};
 const next=api.configureProfile(s,{target_model:'real-model-2.0'},8);
 assert.equal(next.project_spec.target_model,'real-model-2.0');assert.equal(next.revision,9);
 assert.deepEqual(next.approvals,s.approvals);assert.equal(next.artifacts.creative.stale,undefined);assert.equal(next.artifacts.script.stale,undefined);
 for(const stage of ['assets','shots','prompts','review'])assert.equal(next.artifacts[stage].stale,true);
 assert.equal(s.project_spec.target_model,'旧占位文字');assert.equal(api.configureProfile(next,{target_model:'real-model-2.0'},9).revision,9);
 assert.throws(()=>api.configureProfile(next,{target_model:'占位文字'},9),/INVALID_TARGET_MODEL/);
 assert.throws(()=>api.configureProfile(next,{target_model:'real-model-3'},8),/REVISION_CONFLICT/);
});
