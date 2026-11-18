import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/businesses/film-production/contracts/submission.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {checkSubmission}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const state=()=>({revision:5,schema_version:'3.1.0',duration_ms:15000,artifacts:{script:{data:{characters:[],scenes:[],dialogue:[]}}},approvals:{script:2}});
test('多余字符与缺失资产数组在预检集中返回，不改变状态或猜测道具',()=>{
 const s=state(),before=structuredClone(s);
 assert.equal(checkSubmission(s,'assets','{}x').error_code,'INVALID_ARTIFACT_JSON');
 const check=checkSubmission(s,'assets','{"characters":[],"scenes":[]}');
 assert.deepEqual(check.issues.map(i=>i.path),['locations','scene_states','props']);
 const missing={characters:[],scenes:[],locations:[],scene_states:[]};
 assert.equal(checkSubmission(s,'assets',JSON.stringify(missing)).issues[0].path,'props');
 assert.equal(missing.props,undefined);
 assert.deepEqual(s,before);
});
test('显式空道具可通过，错误引用仍被拦截，预检不代表保存批准',()=>{
 const s=state();const data={characters:[],scenes:[],locations:[],scene_states:[],props:[]};
 const good=checkSubmission(s,'assets',JSON.stringify(data));assert.equal(good.valid,true);assert.equal(good.expectedRevision,5);
 assert.equal(s.artifacts.assets,undefined);assert.equal(s.revision,5);
 const bad={...data,scene_states:[{scene_state_id:'STATE_001',location_id:'missing'}]};
 assert.equal(checkSubmission(s,'assets',JSON.stringify(bad)).valid,false);
});
test('一次报告所有镜头缺少的服装和对白引用，不逐字段试错或自动清空',()=>{
 const s=state();const before=structuredClone(s);
 const candidate={shots:[{shot_id:'SHOT_001',character_ids:['CHAR_001'],prop_ids:[]},{shot_id:'SHOT_002',character_ids:[],prop_ids:[],costume_ids:[]}]};
 const result=checkSubmission(s,'shots',JSON.stringify(candidate));
 assert.equal(result.valid,false);
 assert.deepEqual(result.issues.map(i=>i.path),['shots[0].costume_ids','shots[0].dialogue_refs','shots[1].dialogue_refs']);
 assert.equal(candidate.shots[0].costume_ids,undefined);assert.deepEqual(s,before);
});
test('提示词对白引用和非法镜头对象也会在提交前报告',()=>{
 const s=state();
 assert.equal(checkSubmission(s,'prompts','{"prompts":[{}]}').issues[0].path,'prompts[0].dialogue_refs');
 assert.equal(checkSubmission(s,'shots','{"shots":[null]}').issues[0].path,'shots[0]');
});
