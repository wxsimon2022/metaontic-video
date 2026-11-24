import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/businesses/film-production/production.responses.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {projectResponse}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
test('精简响应保留下一阶段完整依赖、修订与批准，不再重复整部历史材料',()=>{
 const state={project_id:'p',revision:5,status:'SHOTS_READY',approvals:{creative:1,script:2},artifacts:{creative:{revision:1,data:{premise:'历史创意'.repeat(1000)}},script:{revision:2,data:{screenplay:'完整剧本'.repeat(1000)}},shots:{revision:5,data:{shots:[{shot_id:'s1',description:'批准动作'}]}}},tasks:[{key:'t',task_id:'TASK_001',status:'completed',inputs:{creative:'历史任务输入'.repeat(1000)}}]};
 const next={action:'submit',stage:'prompts',inputs:{script:state.artifacts.script,shots:state.artifacts.shots},instructions:'本阶段指令'};
 const before=structuredClone(state);const full=projectResponse(state,next);const compact=projectResponse(state,next,'compact');
 assert.deepEqual(compact.nextTask.inputs,next.inputs);assert.equal(compact.revision,5);assert.deepEqual(compact.approvals,state.approvals);
 assert.equal(compact.artifact_summary.creative.artifact_ref,'project.json#/artifacts/creative');assert.equal(compact.artifacts,undefined);assert.equal(compact.task_summary[0].inputs,undefined);
 assert.equal(full.artifacts.creative.data.premise,state.artifacts.creative.data.premise);assert.deepEqual(state,before);
 assert.ok(Buffer.byteLength(JSON.stringify(compact))<Buffer.byteLength(JSON.stringify(full))/2);
});
test('剧本待批准响应携带同版本完整正文，并要求先展示再批准',()=>{
 const screenplay='第一场：清晨递杯。\n对白：慢慢来。\n'+ '完整场次内容\n'.repeat(400);
 const state={project_id:'p',revision:8,artifacts:{script:{revision:7,data:{screenplay,dialogue:[{exact_text:'慢慢来。'}]}}}};
 for(const mode of ['compact','full']) {
  const response=projectResponse(state,{action:'approve',stage:'script'},mode);
  assert.equal(response.approval_material.revision,7);
  assert.ok(response.approval_material.markdown.includes(screenplay));
  assert.match(response.continuation.instructions,/先在用户可见正文完整展示/);
  assert.match(response.continuation.instructions,/再单独调用film_project approve/);
 }
 assert.equal(projectResponse(state,{action:'submit',stage:'assets'},'compact').approval_material,undefined);
});

test('创意待批准返回完整可读正文，过期材料不作为审批正文返回',()=>{
 const state={project_id:'p',revision:3,artifacts:{creative:{revision:3,data:{theme:'看见身边人',logline:'伸手接住掉落的杯子',structure:[{beats:['先倾斜','再接住']}],must_preserve:['结局不变']}}}};
 const result=projectResponse(state,{action:'approve',stage:'creative'},'compact');
 for(const text of ['看见身边人','先倾斜','再接住','结局不变']) assert.ok(result.approval_material.markdown.includes(text));
 assert.equal(result.approval_material.revision,3);
 state.artifacts.creative.stale=true;
 assert.equal(projectResponse(state,{action:'approve',stage:'creative'},'compact').approval_material,undefined);
});
