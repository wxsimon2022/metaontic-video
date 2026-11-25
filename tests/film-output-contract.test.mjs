import './no-network-analytics.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { api as workflow } from './module-test-api.mjs';
const bundle=await build({stdin:{contents:"export {filmDirectorBusiness} from './src/businesses/film-production/production.service.ts'; export {filmOutput} from './src/businesses/film-production/validation/budget.validator.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const api=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function lossless(value){assert.deepEqual(value,JSON.parse(JSON.stringify(value)));}
test('actual professional create/read/next/route/export outputs are lossless JSON',async()=>{
 const home=await mkdtemp(path.join(tmpdir(),'film output ')),old=process.env.DSH_HOME;process.env.DSH_HOME=home;
 try{
  let tool;api.filmDirectorBusiness.apply({config:{},tools:{register(_owner,t){tool=t;}},ctx:{get(){}}});
  const exec={agent:{session:{id:'output-check'}}};
  const created=await tool.execute({action:'create',title:'河岸观察',sourceBrief:'看水波',durationSeconds:15,projectSpec:JSON.stringify({work_type:'LIFESTYLE'}),responseMode:'compact'},exec);
  lossless(created);assert.equal(created.revision,0);assert.ok(created.nextTask.instructions);
  for(const args of [{action:'read'},{action:'read',responseMode:'compact'},{action:'next'},{action:'route',intent:'develop_idea'},{action:'export'},{action:'validate',stage:'creative',content:'{}x'}])lossless(await tool.execute({...args,projectId:created.project_id},exec));
  assert.equal((await tool.execute({action:'read',projectId:created.project_id},exec)).project_id,created.project_id);
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(home,{recursive:true,force:true});}
});
test('optional undefined values are omitted without changing real values or null; nonfinite output is rejected',()=>{
 assert.deepEqual(api.filmOutput({id:'p',optional:undefined,next:{absent:undefined,unknown:null},items:[{value:0}]}),{id:'p',next:{unknown:null},items:[{value:0}]});
 assert.throws(()=>api.filmOutput({n:NaN}),/INVALID_FILM_OUTPUT/);
});
test('review blockage supplies canonical saved text and original bound image; repair succeeds without a new project',async()=>{
 const home=await mkdtemp(path.join(tmpdir(),'review repair ')),old=process.env.DSH_HOME;process.env.DSH_HOME=home;
 try{
  const exec={agent:{session:{id:'repair',header:{cwd:home}}}};
  const project=await workflow.createProject(exec,'scenery');project.duration=15;project.choice='not_needed';await workflow.writeProject(project);
  const guard=workflow.createStoryboardReviewGuard({log:async()=>{}});
  const spec={prompt:'河边',duration:15,ratio:'16:9',resolution:'720p'};
  let asks=0;const tool=workflow.projectTool({},{get:()=>({ask:async()=>{asks++;return {answers:[{id:'script_review',selected:['脚本通过']}]};}})},guard,Object.fromEntries(Object.keys(spec).map(k=>[k,{}])),{});
  const file=path.join(home,'script.md'),body='# 河岸观察\n项目ID：本项目\n作品名称：河岸\n| 镜头 | 时间 | 画面 |\n| --- | --- | --- |\n| 1 | 0–15秒 | 河面水波 |';await writeFile(file,body);
  const board=await tool.execute({action:'storyboard',projectId:project.id,scriptPath:file},exec);
  guard.observe(exec.agent.session,{type:'assistant/message',data:{turn:1,message:{content:[{type:'text',text:'# 河岸观察\n| 1 | 0–15秒 | 河面水波 |'}]}}});
  const args={action:'review',projectId:project.id,scriptPath:file,specification:spec};
  const denied=await tool.execute(args,exec);assert.equal(denied.status,'blocked');assert.equal(asks,0);
  assert.equal(denied.repairAction,'present_current_materials');assert.ok(denied.presentation.markdown.includes(body));assert.ok(denied.presentation.markdown.includes(board.path));
  assert.deepEqual(denied.presentation.missingMaterials,['script','storyboard']);
  // Reproduce the latest dialogue: current script was fully shown, but an unbound PNG was embedded.
  guard.observe(exec.agent.session,{type:'assistant/message',data:{turn:2,message:{content:[{type:'text',text:body}]}}});
  const png=path.join(home,'storyboard-converted.png');await writeFile(png,'converted preview');
  guard.observe(exec.agent.session,{type:'assistant/message',data:{turn:2,message:{content:[{type:'text',text:`![分镜](<${png}>)`}]}}});
  const missingImage=await tool.execute(args,exec);
  assert.equal(missingImage.status,'blocked');assert.deepEqual(missingImage.presentation.missingMaterials,['storyboard']);
  assert.ok(!missingImage.presentation.markdown.includes(body));assert.ok(missingImage.presentation.markdown.includes(board.path));
  assert.match(missingImage.nextAction,/不要重复贴剧本/);assert.equal(asks,0);
  guard.observe(exec.agent.session,{type:'assistant/message',data:{turn:3,message:{content:[{type:'text',text:missingImage.presentation.markdown}]}}});
  assert.equal((await tool.execute(args,exec)).status,'approved');assert.equal(asks,1);assert.equal(await readFile(file,'utf8'),body);
  // New script versions cannot borrow the old display fact; only the missing new script is returned.
  const updated=body+'\n新版本：水鸟掠过水面，留下一条涟漪。';await writeFile(file,updated);
  const newBoard=await tool.execute({action:'storyboard',projectId:project.id,scriptPath:file},exec);
  guard.observe(exec.agent.session,{type:'assistant/message',data:{turn:4,message:{content:[{type:'text',text:`![分镜](<${newBoard.path}>)`}]}}});
  const missingScript=await tool.execute(args,exec);
  assert.equal(missingScript.status,'blocked');assert.deepEqual(missingScript.presentation.missingMaterials,['script']);
  assert.equal(missingScript.presentation.markdown,updated);assert.equal(asks,1);
  guard.observe(exec.agent.session,{type:'assistant/message',data:{turn:4,message:{content:[{type:'text',text:missingScript.presentation.markdown}]}}});
  assert.equal((await tool.execute(args,exec)).status,'approved');assert.equal(asks,2);
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(home,{recursive:true,force:true});}
});
