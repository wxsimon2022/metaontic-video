import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),folder=await mkdtemp(path.join(tmpdir(),'agent-architecture-'));
const modules=['approvals/presentation.guard','approvals/approval.presenter','projects/operation.repository','contracts/commands','projects/project.service','roles/context.composer','reviews/global-review','evaluation/benchmark','workflows/compile.handler'];
await build({stdin:{contents:modules.map(m=>`export * from '${root}/src/businesses/film-production/${m}.ts';`).join('\n'),resolveDir:root},outfile:path.join(folder,'api.mjs'),bundle:true,platform:'node',format:'esm'});
const api=await import(pathToFileURL(path.join(folder,'api.mjs')).href);
after(()=>rm(folder,{recursive:true,force:true}));
const artifact=(revision=1)=>({revision,data:{theme:'等待之后伸出手',logline:'女孩放下工具，将椅子递给父亲。'}});
const visible=text=>({type:'assistant/message',data:{message:{content:[{type:'text',text}]}}});
test('审批只认同会话、当前版本的真实助手正文，工具与推理不算展示',()=>{
 const g=api.createFilmPresentationGuard(),session={},other={},a=artifact(),state={project_id:'p',artifacts:{creative:a}};
 g.remember(session,state);const text=api.approvalMaterial('creative',a).approval_material.markdown;
 g.observe(session,{type:'tool/result',data:{message:{content:[{type:'text',text}]}}});
 g.observe(session,{type:'assistant/message',data:{message:{content:[{type:'reasoning',text}]}}});
 g.observe(other,visible(text));g.observe(session,visible('已完成创意，请批准'));
 assert.equal(g.shown(session,'p','creative',a),false);
 g.observe(session,visible(text));assert.equal(g.shown(session,'p','creative',a),true);
 const revised=artifact(2);assert.equal(g.shown(session,'p','creative',revised),false);
 g.observe(session,visible(text));assert.equal(g.shown(session,'p','creative',revised),false);
});
test('长稿分页不丢字且必须依次展示全部页面',()=>{
 const g=api.createFilmPresentationGuard(),session={},a={revision:8,data:{theme:'长稿',logline:'甲'.repeat(17000)+'乙'.repeat(17000)+'丙'.repeat(17000)}};
 const full=api.approvalMaterial('creative',a).approval_material.markdown,pages=api.approvalChunks(full);
 assert.equal(pages.join(''),full);assert.ok(pages.length>2);
 g.remember(session,{project_id:'p',artifacts:{creative:a}});
 g.observe(session,visible(pages.at(-1)));assert.equal(g.shown(session,'p','creative',a),false);
 for(const text of pages.slice(0,-1))g.observe(session,visible(text));assert.equal(g.shown(session,'p','creative',a),false);
 g.observe(session,visible(pages.at(-1)));assert.equal(g.shown(session,'p','creative',a),true);
});
test('创建标识按会话、需求和显式操作号稳定隔离',()=>{
 const args={title:'椅子',sourceBrief:'修椅子',durationSeconds:30,projectSpec:'{"genre":"comedy","tone":"安静"}'};
 assert.deepEqual(api.creationIdentity('one',args),api.creationIdentity('one',{...args,projectSpec:'{"tone":"安静","genre":"comedy"}'}));
 assert.notEqual(api.creationIdentity('one',args).id,api.creationIdentity('two',args).id);
 assert.notEqual(api.creationIdentity('one',args).id,api.creationIdentity('one',{...args,operationId:'another'}).id);
 const explicit={...args,operationId:'stable'};
 assert.equal(api.creationIdentity('one',explicit).id,api.creationIdentity('one',{...explicit,sourceBrief:'changed'}).id);
 assert.notEqual(api.creationIdentity('one',explicit).digest,api.creationIdentity('one',{...explicit,sourceBrief:'changed'}).digest);
});
test('审核未知结果不会自动重放；确认重试后仅重试该请求',async()=>{
 const file=path.join(folder,'uncertain.json'),key='a'.repeat(64);let calls=0;
 const complete=async()=>{calls++;throw Error('socket closed');};
 await assert.rejects(()=>api.journaledReview(file,key,complete),/socket closed/);
 await assert.rejects(()=>api.journaledReview(file,key,complete),/REVIEW_REQUEST_UNCERTAIN/);assert.equal(calls,1);
 await api.authorizeReviewRetry(file,key);
 const result=await api.journaledReview(file,key,async()=>{calls++;return {script:'private response'};});
 assert.equal(result.script,'private response');assert.equal(calls,2);
 await api.journaledReview(file,key,complete);assert.equal(calls,2);
 assert.ok(!JSON.stringify(await api.reviewRequestSummary(file)).includes('private response'));
});
test('原始无效回包先保存，解析失败后恢复不会再次请求',async()=>{
 const file=path.join(folder,'invalid-review.json'),key='b'.repeat(64);let calls=0;
 const complete=async()=>{calls++;return {script:'not json'};};
 const first=await api.journaledReview(file,key,complete);assert.throws(()=>JSON.parse(first.script));
 assert.deepEqual(await api.journaledReview(file,key,complete),first);assert.equal(calls,1);
});
test('请求登记无法落盘时，不执行付费请求',async()=>{
 let calls=0;await assert.rejects(()=>api.journaledReview(path.join(folder,'missing','requests.json'),'c'.repeat(64),async()=>{calls++;}));assert.equal(calls,0);
});
test('超预算任务返回缩小范围指引，不把巨大正文塞回输出',()=>{
 const task={stage:'script',inputs:{script:{data:{scenes:[{scene_id:'s1',text:'secret'.repeat(20000)}]}}}};
 const original=JSON.stringify(task),bounded=api.boundedTask(task);
 assert.equal(bounded.action,'scope_required');assert.ok(JSON.stringify(bounded).length<3000);assert.ok(!JSON.stringify(bounded).includes('secret'));assert.equal(JSON.stringify(task),original);
 assert.throws(()=>api.assertReviewBudget('system',task),/REVIEW_CONTEXT_BUDGET_EXCEEDED/);
});
const checks=()=>api.GLOBAL_CHECKS.map(id=>({id,status:'PASS',evidence:[{scene_id:'s1',reason:'前章铺垫'},{scene_id:'s2',reason:'后章回收'}]}));
const globalState={artifacts:{script:{revision:2,data:{scenes:[{scene_id:'s1',chapter_id:'c1'},{scene_id:'s2',chapter_id:'c2'}]}}},issue_registry:{}};
test('全片审核要求跨章证据，各章通过也不能绕过全片问题',()=>{
 const combined={issues:[],review_status:'PASS',delivery_allowed:true};
 const global={status:'PASS',checks:checks()};
 assert.equal(api.applyGlobalReview(combined,global,globalState).delivery_allowed,true);
 global.checks[0].status='CONCERN';global.status='REVISE_REQUIRED';
 const blocked=api.applyGlobalReview(combined,global,globalState);assert.equal(blocked.delivery_allowed,false);assert.equal(blocked.blocking_issue_count,1);assert.equal(blocked.issues[0].severity,'MAJOR');
 global.checks[0].evidence=[{scene_id:'s1',reason:'只看前章'}];assert.throws(()=>api.applyGlobalReview(combined,global,globalState),/GLOBAL_REVIEW_CROSS_CHAPTER_REQUIRED/);
 assert.deepEqual(combined.issues,[]);
});
test('按动作校验参数，保留validate的结构化错误入口',()=>{
 const id='12345678-1234-1234-1234-123456789abc';
 assert.throws(()=>api.parseFilmCommand({action:'submit',projectId:id,stage:'script',content:'{}'}),/EXPECTED_REVISION_REQUIRED/);
 assert.throws(()=>api.parseFilmCommand({action:'submit',projectId:id,stage:'script',expectedRevision:0,content:'bad'}),/INVALID_ARTIFACT_JSON/);
 assert.equal(api.parseFilmCommand({action:'validate',projectId:id,stage:'script',content:'bad'}).content,'bad');
 assert.throws(()=>api.parseFilmCommand({action:'retry_review',projectId:id,expectedRevision:0,requestKey:'bad'}),/INVALID_REVIEW_REQUEST_KEY/);
 assert.throws(()=>api.parseFilmCommand({action:'read',projectId:id,materialPart:0}),/INVALID_MATERIAL_PART/);
});
test('离线基线比较保持未知项，成本差值需要同币种记录',()=>{
 const cases=[{id:'one',duration_ms:1000,must_preserve:['原始约束']}];
 const record={case_id:'one',script:{scenes:[{scene_id:'s1',duration_ms:1000,key_actions:['递杯'],entry_state:'杯在桌上',exit_state:'杯被接住'}],dialogue:[]}};
 const compare=api.compareBenchmarks(cases,[record],[record]);
 assert.equal(compare.cases[0].candidate.quality.artistic_status,'NOT_EVALUATED');assert.equal(compare.cases[0].candidate.constraints[0].status,'UNKNOWN');assert.equal(compare.cases[0].delta.cost,null);assert.equal(compare.cases[0].preference,null);
 const measured={...record,measurements:{source:'recorded',tool_calls:4,revision_rounds:2,cost:2,currency:'CNY'}};
 const reduced={...record,measurements:{source:'recorded',tool_calls:3,revision_rounds:1,cost:1,currency:'CNY'}};
 assert.equal(api.compareBenchmarks(cases,[measured],[reduced]).cases[0].delta.cost,-1);
 assert.throws(()=>api.evaluateBenchmark(cases,[{...record,constraints:{reviewer:'test',items:[{constraint:'原始约束',status:'PRESERVED',evidence:[]}]}}]),/CONSTRAINT_EVALUATION_EVIDENCE/);
});
test('编译中断恢复复用同一目标，保留已写制作审批，不重复建项目',async()=>{
 const home=path.join(folder,'compile-home');await mkdir(home);const previous=process.env.DSH_HOME;process.env.DSH_HOME=home;
 try{
 const state={project_id:'professional',revision:7,duration_ms:15000,artifacts:{assets:{data:{characters:[]}}}},plan={specification:{ratio:'16:9',duration:15}},exec={agent:{session:{id:'compile-session'}}};
 const first=await api.bindCompiledProject(state,plan,exec,path.join(home,'source.json'),'model');
 const files=path.join(home,'metaontic-video','projects'),file=path.join(files,first.videoProjectId+'.json');
 const project=JSON.parse(await readFile(file,'utf8'));project.approved={revision:1};await api.atomicJson(file,project);
 const resumed=await api.bindCompiledProject(state,plan,exec,path.join(home,'source.json'),'model');assert.equal(resumed.videoProjectId,first.videoProjectId);assert.deepEqual(JSON.parse(await readFile(file,'utf8')).approved,{revision:1});
 project.filmSource.plan_digest='corrupt';await api.atomicJson(file,project);await assert.rejects(()=>api.bindCompiledProject(state,plan,exec,path.join(home,'source.json'),'model'),/COMPILE_RECOVERY_CONFLICT/);
 }finally{if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;}
});

test('创意改写或漏项只补缺失栏目，不重贴已展示正文，补齐前仍不能审批',()=>{
 const g=api.createFilmPresentationGuard(),session={},a={revision:4,data:{theme:'黄沙中的鲜果',logline:'一颗果实从枝头来到饭桌。',assumptions:['只出现手部，依据是聚焦果实，不虚构人物身份。']}};
 g.remember(session,{project_id:'p',artifacts:{creative:a}});
 const full=api.approvalMaterial('creative',a).approval_material.markdown;
 const prefix=full.slice(0,full.indexOf('### 一句话故事'));
 g.observe(session,visible(prefix+'\n### 一句话故事\n一颗果实来到餐桌。\n\n### 创作假设\n只出现手部。'));
 assert.equal(g.shown(session,'p','creative',a),false);
 const repair=g.repair(session,'p','creative',a).approval_material;
 assert.equal(repair.partial,true);assert.equal(repair.revision,4);
 assert.ok(!repair.markdown.includes('黄沙中的鲜果'));
 assert.ok(repair.markdown.includes(a.data.logline));assert.ok(repair.markdown.includes(a.data.assumptions[0]));
 g.observe(session,visible(repair.markdown));assert.equal(g.shown(session,'p','creative',a),true);
 assert.deepEqual(g.repair(session,'p','creative',a),{});
 const revised={...a,revision:5,data:{...a.data,logline:'修改后，果实留在枝头。'}};
 g.remember(session,{project_id:'p',artifacts:{creative:revised}});
 g.observe(session,visible(full));assert.equal(g.shown(session,'p','creative',revised),false);
 assert.ok(g.repair(session,'p','creative',revised).approval_material.markdown.includes(revised.data.logline));
});

test('长创意补展示从未完成页继续，不重发已展示页且不允许跳页',()=>{
 const g=api.createFilmPresentationGuard(),session={},a={revision:6,data:{theme:'完整长稿',logline:'甲'.repeat(18000)+'乙'.repeat(18000)}};
 const full=api.approvalMaterial('creative',a).approval_material.markdown,pages=api.approvalChunks(full);
 g.remember(session,{project_id:'p',artifacts:{creative:a}});g.observe(session,visible(pages[0]));
 const repair=g.repair(session,'p','creative',a).approval_material;
 assert.equal(repair.part,2);assert.equal(repair.markdown,pages[1]);
 g.observe(session,visible(pages.at(-1)));assert.equal(g.shown(session,'p','creative',a),false);
 for(const page of pages.slice(1))g.observe(session,visible(page));
 assert.equal(g.shown(session,'p','creative',a),true);
});

test('项目规格数组错误给出正确形状，不静默拆分用户硬约束',()=>{
 for(const key of ['hard_constraints','soft_preferences','references']) {
  const input={[key]:'保留历史；保留文化'};const before=structuredClone(input);
  assert.throws(()=>api.createProjectSpec('武威','城市介绍',45000,input),/INVALID_PROJECT_SPEC:.*字符串数组/);
  assert.deepEqual(input,before);
  const values=['保留历史；保留文化'];const spec=api.createProjectSpec('武威','城市介绍',45000,{[key]:values});
  assert.deepEqual(spec[key],values);
 }
});
test('所有项目动作均要求外层ID，内容内ID不补填，版本与内容形状给出修正指引',()=>{
 const id='12345678-1234-1234-1234-123456789abc';
 for(const action of api.FILM_ACTIONS.filter(a=>a!=='create')) {
  assert.throws(()=>api.parseFilmCommand({action,content:JSON.stringify({project_id:id})}),/INVALID_PROJECT_ID:.*顶层传projectId/);
 }
 const input={action:'submit',projectId:id,stage:'creative',expectedRevision:0,content:'{"theme":"原始内容"}'};
 assert.equal(api.parseFilmCommand(input).projectId,id);assert.equal(api.parseFilmCommand(input).content,input.content);
 for(const action of ['revise','chapter_plan'])assert.throws(()=>api.parseFilmCommand({...input,action,content:'{}'}),/必须是JSON数组/);
 assert.throws(()=>api.parseFilmCommand({...input,content:'[]'}),/必须是JSON对象/);
 assert.throws(()=>api.parseFilmCommand({...input,expectedRevision:undefined}),/EXPECTED_REVISION_REQUIRED:.*项目revision/);
});
test('章节连续性在入口校验，无效形状不进入持久化',()=>{
 const args={action:'chapter_submit',projectId:'12345678-1234-1234-1234-123456789abc',stage:'script',chapterId:'one',expectedRevision:0,content:'{}'};
 for(const continuity of [undefined,'null','[]','{}','{"established_facts":[],"unresolved_threads":[],"character_state":[]}'])assert.throws(()=>api.parseFilmCommand({...args,continuity}),/CHAPTER_CONTINUITY_REQUIRED/);
 const continuity=JSON.stringify({established_facts:[],unresolved_threads:[],character_state:{}});
 assert.equal(api.parseFilmCommand({...args,continuity}).continuity,continuity);
});
