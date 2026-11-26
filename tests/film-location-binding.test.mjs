import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {validateReferences} from './src/businesses/film-production/validation/continuity.validator.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {validateReferences}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const state=()=>({artifacts:{script:{data:{dialogue:[],scenes:[{scene_id:'s1',chapter_id:'c'},{scene_id:'s2',chapter_id:'c'}]}},assets:{data:{characters:[],scenes:[{scene_id:'s1',location_id:'grass',scene_state_id:'primary'},{scene_id:'s2',location_id:'temple',scene_state_id:'other'}],locations:[{location_id:'grass'},{location_id:'wall'},{location_id:'temple'}],scene_states:[{scene_state_id:'primary',location_id:'grass',scene_id:'s1'},{scene_state_id:'wallState',location_id:'wall',scene_id:'s1'},{scene_state_id:'other',location_id:'temple',scene_id:'s2'}]}}}});
const shot=(location_id,scene_state_id)=>({shots:[{shot_id:'k1',scene_id:'s1',chapter_id:'c',location_id,scene_state_id,character_ids:[]}]});
test('同场次已登记的不同地点状态可用于镜头，原主地点保持兼容',()=>{
 const s=state(),before=structuredClone(s);
 assert.doesNotThrow(()=>validateReferences('shots',shot('wall','wallState'),s));
 assert.doesNotThrow(()=>validateReferences('shots',shot('grass','primary'),s));
 assert.deepEqual(s,before);
});
test('不同场次、未绑定及地点状态冲突仍拒绝，错误指出镜头与场次',()=>{
 const s=state();
 assert.throws(()=>validateReferences('shots',shot('temple','other'),s),/SHOT_SCENE_STATE_MISMATCH.*k1.*s1/);
 assert.throws(()=>validateReferences('shots',shot('wall','primary'),s),/INVALID_REFERENCE:scene_state/);
 delete s.artifacts.assets.data.scene_states[1].scene_id;
 assert.throws(()=>validateReferences('shots',shot('wall','wallState'),s),/SHOT_LOCATION_MISMATCH.*k1.*wall.*s1/);
 s.artifacts.assets.data.scene_states[0].scene_id='missing';
 assert.throws(()=>validateReferences('assets',s.artifacts.assets.data,s),/INVALID_REFERENCE:scene_state_scene/);
});
