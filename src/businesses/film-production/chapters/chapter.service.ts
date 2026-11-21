import { sourceRevisions, revisionsEqual } from '../contracts/index.js';
import { commitArtifact, validateArtifact } from '../artifacts/artifact.service.js';
import { validateV31 } from '../validation/schema.validator.js';
import { validateReferences } from '../validation/continuity.validator.js';
import { validateTimeline } from '../validation/timeline.validator.js';
import { renderScript } from '../scripts/script.document.js';
import { promptMetrics } from '../roles/context.composer.js';
const STAGES=['script','shots','prompts'];
export function defineChapters(state:any,plan:any[],expected:number) {
 if(state.revision!==expected)throw Error('REVISION_CONFLICT');
 if(state.status==='STOPPED')throw Error('PROJECT_STOPPED');
 if(!state.artifacts.creative||state.artifacts.creative.stale||state.approvals.creative!==state.artifacts.creative.revision)throw Error('APPROVAL_REQUIRED');
 if(!Array.isArray(plan)||!plan.length||plan.some(c=>!c||typeof c.chapter_id!=='string'||!c.chapter_id.trim()||!Number.isSafeInteger(c.duration_ms)||c.duration_ms<=0)||new Set(plan.map(c=>c.chapter_id)).size!==plan.length||plan.reduce((n,c)=>n+c.duration_ms,0)!==state.duration_ms)throw Error('INVALID_CHAPTER_PLAN');
 if(state.artifacts.script&&!state.artifacts.script.stale)throw Error('CHAPTER_PLAN_REQUIRES_SCRIPT_REVISION');
 const next=structuredClone(state);next.revision++;next.script_policy='canonical_v1';
 let cursor=0;
 next.chapter_workbench={creative_revision:state.approvals.creative,plan:plan.map(c=>{const result={chapter_id:c.chapter_id,title:c.title||c.chapter_id,duration_ms:c.duration_ms,start_ms:cursor,end_ms:cursor+c.duration_ms};cursor+=c.duration_ms;return result;}),entries:{}};
 return next;
}
function workbench(state:any) {
 const work=state.chapter_workbench;
 if(!work||work.creative_revision!==state.approvals.creative||state.artifacts.creative?.stale)throw Error('CHAPTER_PLAN_STALE_OR_MISSING');
 return work;
}
function current(entry:any,state:any,stage:string) {return entry&&revisionsEqual(entry.input_revisions,sourceRevisions(state,stage));}
export function chapterTask(state:any,task:any) {
 if(!STAGES.includes(task.stage)||task.action!=='submit'||!state.chapter_workbench)return task;
 let work:any;
 try{work=workbench(state);}catch{return {...task,action:'chapter_plan',instructions:'创意版本已变化，先重新确认章节预算并提交chapter_plan，旧章节不可冒充当前版本。'};}
 const chapter=work.plan.find(c=>!current(work.entries[c.chapter_id]?.[task.stage],state,task.stage));
 if(!chapter)return task;
 const index=work.plan.indexOf(chapter);
 const entries=work.entries[chapter.chapter_id]||{};
 const inputs:any={creative:state.artifacts.creative};
 if(task.stage!=='script') {
  if(state.approvals.script!==state.artifacts.script?.revision)throw Error('APPROVAL_REQUIRED');
  const script=state.artifacts.script.data;
  const scenes=script.scenes.filter(s=>s.chapter_id===chapter.chapter_id);
  const sceneIds=new Set(scenes.map(s=>s.scene_id));
  const dialogue=script.dialogue.filter(d=>sceneIds.has(d.scene_id));
  const characters=script.characters;
  inputs.script={...state.artifacts.script,data:{...script,screenplay:undefined,chapters:script.chapters.filter(c=>c.chapter_id===chapter.chapter_id),scenes,dialogue,characters}};
  inputs.assets=state.artifacts.assets;
  if(task.stage==='prompts')inputs.shots={...state.artifacts.shots,data:{shots:state.artifacts.shots.data.shots.filter(s=>sceneIds.has(s.scene_id))}};
 }
 const previous=work.plan.slice(0,index).map(c=>({chapter_id:c.chapter_id,continuity:work.entries[c.chapter_id]?.[task.stage]?.continuity||null}));
 const instructions=task.instructions+'\n章节任务：只提交当前章。script 包含当前章完整场次/对白/人物；shots 使用全片累计毫秒时间轴；prompts覆盖本章镜头。continuity记录已确立事实、人物状态及未回收线索，不编造前章信息。整片未汇总与批准前不能进入受保护下游。';
 return {...task,action:'chapter_submit',chapter,completed_chapters:work.plan.slice(0,index).map(c=>c.chapter_id),inputs,previous_chapters:previous,existing_chapter:entries[task.stage]||null,instructions,context_metrics:promptMetrics(instructions,{inputs,previous})};
}
function mergeUnique(parts:any[],field:string,id:string) {
 const map=new Map();
 for(const part of parts)for(const item of part[field]||[]) {
  const previous=map.get(item[id]);
  if(previous&&JSON.stringify(previous)!==JSON.stringify(item))throw Error('CHAPTER_ENTITY_CONFLICT:'+item[id]);
  map.set(item[id],item);
 }
 return [...map.values()];
}
export function submitChapter(state:any,stage:string,chapterId:string,data:any,continuity:any,expected:number) {
 if(state.revision!==expected)throw Error('REVISION_CONFLICT');
 if(state.status==='STOPPED')throw Error('PROJECT_STOPPED');
 if(!STAGES.includes(stage))throw Error('INVALID_CHAPTER_STAGE');
 const work=workbench(state),chapter=work.plan.find(c=>c.chapter_id===chapterId);
 if(!chapter)throw Error('UNKNOWN_CHAPTER');
 if(state.approvals.creative!==state.artifacts.creative?.revision)throw Error('APPROVAL_REQUIRED');
 if(stage!=='script'&&(state.approvals.script!==state.artifacts.script?.revision||state.artifacts.script.stale))throw Error('APPROVAL_REQUIRED');
 if(stage==='script'&&state.artifacts.script&&!state.artifacts.script.stale)throw Error('CHAPTER_REQUIRES_SCRIPT_REVISION');
 if(!continuity||typeof continuity!=='object'||Array.isArray(continuity)||!Array.isArray(continuity.established_facts)||!Array.isArray(continuity.unresolved_threads)||!continuity.character_state||typeof continuity.character_state!=='object'||Array.isArray(continuity.character_state))throw Error('CHAPTER_CONTINUITY_REQUIRED');
 const scoped=structuredClone(state);scoped.duration_ms=chapter.duration_ms;
 if(stage==='script') {
  data={...data,chapters:[{chapter_id:chapter.chapter_id,title:chapter.title,duration_ms:chapter.duration_ms,scene_ids:(data.scenes||[]).map(s=>s.scene_id)}]};
  if(!Array.isArray(data.scenes)||data.scenes.some(s=>s.chapter_id!==chapterId))throw Error('CHAPTER_SCENE_MISMATCH');
  data.screenplay=renderScript(data,state.title);validateArtifact('script',data,scoped);
 } else {
  const sceneIds=new Set(state.artifacts.script.data.scenes.filter(s=>s.chapter_id===chapterId).map(s=>s.scene_id));
  if(!state.artifacts.assets||state.artifacts.assets.stale)throw Error('UPSTREAM_REQUIRED');
  if(stage==='shots') {
   if(!Array.isArray(data.shots)||data.shots.some(s=>!sceneIds.has(s.scene_id)||s.chapter_id!==chapterId))throw Error('CHAPTER_SHOT_MISMATCH');
   validateTimeline(data.shots.map(s=>({...s,start_ms:s.start_ms-chapter.start_ms,end_ms:s.end_ms-chapter.start_ms})),chapter.duration_ms);
   scoped.artifacts.script.data.scenes=scoped.artifacts.script.data.scenes.filter(s=>sceneIds.has(s.scene_id));
   scoped.artifacts.script.data.dialogue=scoped.artifacts.script.data.dialogue.filter(d=>sceneIds.has(d.scene_id));
   delete scoped.artifacts.script.data.dialogue_lines;
   validateReferences('shots',data,scoped);
   validateV31('shots',data,state);
  } else {
   if(!state.artifacts.shots||state.artifacts.shots.stale)throw Error('UPSTREAM_REQUIRED');
   scoped.artifacts.shots.data.shots=state.artifacts.shots.data.shots.filter(s=>sceneIds.has(s.scene_id));
   validateArtifact('prompts',data,scoped);
  }
 }
 const next=structuredClone(state);next.revision++;
 const entries=next.chapter_workbench.entries;
 entries[chapterId] ||= {};
 entries[chapterId][stage]={data:structuredClone(data),continuity:structuredClone(continuity),revision:next.revision,input_revisions:sourceRevisions(state,stage)};
 // 同阶段前章变化使其后的章失效，避免沿用旧连续性；下游阶段由全片产物重提交后版本失效。
 const index=work.plan.findIndex(c=>c.chapter_id===chapterId);
 for(const later of work.plan.slice(index+1))delete entries[later.chapter_id]?.[stage];
 const complete=work.plan.every(c=>current(entries[c.chapter_id]?.[stage],state,stage));
 if(!complete){next.status=`${stage.toUpperCase()}_PARTIAL`;return next;}
 const parts=work.plan.map(c=>entries[c.chapter_id][stage].data);
 let merged:any;
 if(stage==='script') {
  const first=parts[0];
  merged={...first,approved_creative_revision:state.approvals.creative,characters:mergeUnique(parts,'characters','character_id'),chapters:parts.flatMap(p=>p.chapters),scenes:mergeUnique(parts,'scenes','scene_id'),dialogue:mergeUnique(parts,'dialogue','dialogue_id'),continuity_state:work.plan.map(c=>({chapter_id:c.chapter_id,...entries[c.chapter_id][stage].continuity}))};
 }else merged=stage==='shots'?{shots:parts.flatMap(p=>p.shots)}:{prompts:parts.flatMap(p=>p.prompts)};
 return commitArtifact(next,stage,merged,next.revision);
}
