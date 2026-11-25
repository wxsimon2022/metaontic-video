import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { sourceOf } from './source.mjs';

function fixture() {
 const events=[];
 const context=vm.createContext({
  reportOutcome:(_exec,...args)=>events.push(args),
  runTask:async()=>({status:'succeeded',videoUrl:'https://media.invalid/result',taskId:'private-task'}),
  approvedCharacterReferences:refs=>refs,normalizeReferenceUrl:value=>value,
 });
 vm.runInContext(sourceOf('businesses/video-generation/workflow/segment-run','businesses/video-generation/workflow/segment-executor'),context);
 const options={config:{},ctx:{},exec:{},args:{},plan:[{kind:'generate',seconds:12}],doneBefore:0,segments:[],segmentsDir:'private-flow',operationState:{},notes:[],initial:{characterReferences:[],cursor:0},save:async()=>{},buildStep:async()=>({body:{},seconds:12})};
 return {events,context,options};
}
test('首次生成记录流程开始与首段完整等待，原任务续查不冒充首次等待',async()=>{
 const fresh=fixture();await fresh.context.executeSegmentPlan(fresh.options);
 assert.deepEqual(fresh.events.map(x=>x[0]),['outcome_started','first_segment_ready']);
 assert.equal(fresh.events[0][1].flowKey,fresh.events[1][1].flowKey);
 assert.ok(fresh.events[1][1].durationMs>=0);
 const resumed=fixture();resumed.options.args={resume:'private-flow'};
 resumed.options.initial.pendingTask={taskId:'private-task'};
 await resumed.context.executeSegmentPlan(resumed.options);assert.equal(resumed.events.length,0);
 const cached=fixture();cached.options.args={resume:'private-flow'};
 cached.options.operationState={0:{originalTaskId:'private-task'}};
 await cached.context.executeSegmentPlan(cached.options);assert.equal(cached.events.length,0);
});
test('未知和失败的首段不记录成功等待样本',async()=>{
 for(const status of ['failed','unknown','timeout']){
  const f=fixture();f.context.runTask=async()=>({status,taskId:'private-task'});
  await f.context.executeSegmentPlan(f.options);
  assert.deepEqual(f.events.map(x=>x[0]),['outcome_started']);
 }
});
