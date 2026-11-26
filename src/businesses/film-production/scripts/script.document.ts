import type { ScriptData } from '../contracts/types.js';
/** 正文由结构化场次/节拍/对白渲染；不保留第二份独立可编辑的剧情。 */
export function renderScript(data:ScriptData,title='影视剧本') {
 const names=new Map(data.characters.map(c=>[c.character_id,c.name||c.character_id]));
 const lines=new Map(data.dialogue.map(d=>[d.dialogue_id,d]));
 const dialogue=(id:string)=>{const line=lines.get(id);if(!line)throw Error('UNKNOWN_BEAT_DIALOGUE:'+id);return `**${names.get(line.speaker_id)||'说话人待确认'}**：${line.exact_text}`;};
 let elapsed=0;
 let sceneIndex=0;
 const total=data.chapters.reduce((sum,chapter)=>sum+chapter.duration_ms,0);
 return [`# ${title}`,`> ${total/1000} 秒 · ${data.chapters.length} 个章节 · ${data.scenes.length} 个场景`,data.synopsis||'',...data.chapters.flatMap((chapter,index)=>{
  const chapterStart=elapsed;
  const scenes=data.scenes.filter(s=>s.chapter_id===chapter.chapter_id).map(scene=>{
   const start=elapsed;elapsed+=scene.duration_ms;sceneIndex++;
   const sceneLines=data.dialogue.filter(d=>d.scene_id===scene.scene_id);
   const seen=new Set<string>();
   const beats=scene.beats?.length?scene.beats.map(beat=>{
    if(beat.dialogue_ref){if(seen.has(beat.dialogue_ref)||!sceneLines.some(d=>d.dialogue_id===beat.dialogue_ref))throw Error('INVALID_BEAT_DIALOGUE:'+beat.dialogue_ref);seen.add(beat.dialogue_ref);}
    return [beat.action?`- ${beat.action}`:'',beat.dialogue_ref?`- ${dialogue(beat.dialogue_ref)}`:''].filter(Boolean).join('\n');
   }):scene.key_actions.map(action=>`- ${action}`);
   if(scene.beats?.length&&sceneLines.some(d=>!seen.has(d.dialogue_id)))throw Error('BEAT_DIALOGUE_COVERAGE:'+scene.scene_id);
   const context=[scene.location,scene.time_of_day||scene.time].filter(Boolean).join(' · ');
   return [`### 场景 ${sceneIndex}${scene.title||scene.location?' · '+(scene.title||scene.location):''}｜${start/1000}–${elapsed/1000} 秒`,context?`**环境**：${context}`:'',beats.join('\n'),...(!scene.beats?.length?sceneLines.map(d=>dialogue(d.dialogue_id)):[]),`**收束画面**：${scene.exit_state}`].filter(Boolean).join('\n\n');
  });
  return [`## ${chapter.title||'第'+(index+1)+'章'}｜${chapterStart/1000}–${elapsed/1000} 秒`,...scenes];
 })].filter(Boolean).join('\n\n');
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
