import type { ScriptData } from '../contracts/types.js';
/** 正文由结构化场次/节拍/对白渲染；不保留第二份独立可编辑的剧情。 */
export function renderScript(data:ScriptData,title='影视剧本') {
 const names=new Map(data.characters.map(c=>[c.character_id,c.name||c.character_id]));
 const lines=new Map(data.dialogue.map(d=>[d.dialogue_id,d]));
 const dialogue=(id:string)=>{const line=lines.get(id);if(!line)throw Error('UNKNOWN_BEAT_DIALOGUE:'+id);return `${names.get(line.speaker_id)||line.speaker_id}：${line.exact_text}`;};
 return [`# ${title}`,data.synopsis||'',...data.chapters.flatMap(chapter=>[
  `## ${chapter.title||chapter.chapter_id}`,
  ...data.scenes.filter(s=>s.chapter_id===chapter.chapter_id).map(scene=>{
   const sceneLines=data.dialogue.filter(d=>d.scene_id===scene.scene_id);
   const seen=new Set<string>();
   const beats=scene.beats?.length?scene.beats.map(beat=>{
    if(beat.dialogue_ref){if(seen.has(beat.dialogue_ref)||!sceneLines.some(d=>d.dialogue_id===beat.dialogue_ref))throw Error('INVALID_BEAT_DIALOGUE:'+beat.dialogue_ref);seen.add(beat.dialogue_ref);}
    return [beat.action||'',beat.dialogue_ref?dialogue(beat.dialogue_ref):''].filter(Boolean).join('\n\n');
   }):scene.key_actions;
   if(scene.beats?.length&&sceneLines.some(d=>!seen.has(d.dialogue_id)))throw Error('BEAT_DIALOGUE_COVERAGE:'+scene.scene_id);
   return [`### ${scene.scene_id} · ${scene.location||'地点待细化'} · ${scene.time_of_day||'时间待细化'}`,`时长：${scene.duration_ms/1000}秒`,...beats,...(!scene.beats?.length?sceneLines.map(d=>dialogue(d.dialogue_id)):[]),`场景结果：${scene.exit_state}`].join('\n\n');
  }),
 ])].filter(Boolean).join('\n\n');
}
export function normalizeScript(state:any,stage:string,value:any) {
 if(stage!=='script'||state.script_policy!=='canonical_v1')return value;
 if(!value||!Array.isArray(value.characters)||!Array.isArray(value.chapters)||!Array.isArray(value.scenes)||!Array.isArray(value.dialogue))return value;
 const next:ScriptData&{document_source?:string}=structuredClone(value);
 for(const scene of next.scenes)if(scene.beats?.length)scene.key_actions=scene.beats.map(b=>b.action).filter((a):a is string=>typeof a==='string'&&!!a.trim());
 next.screenplay=renderScript(next,state.title);
 next.document_source='structured_script_v1';
 return next;
}
