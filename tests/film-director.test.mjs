import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/businesses/film-director/project.ts'; export * from './src/businesses/film-director/orchestration.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
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
