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
