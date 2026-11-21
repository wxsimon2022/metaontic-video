import { narrativeDiagnostics } from '../validation/content.validator.js';
export const STORY_CRITERIA=['theme_expression','causal_progression','character_credibility','dialogue_function','visual_specificity','ending_payoff'] as const;
/** 自动项只陈述可复算事实；主题、内涵等语义结论必须由明确的评阅者给证据。 */
export function evaluateStory(script:any,assessment?:any) {
 const scenes=script.scenes||[],dialogue=script.dialogue||[];
 const repeated=(items:string[])=>[...new Set(items.filter((text,index)=>text.trim()&&items.indexOf(text)!==index))];
 const facts={scene_count:scenes.length,dialogue_count:dialogue.length,
  repeated_dialogue:repeated(dialogue.map(d=>String(d.exact_text||''))),
  repeated_actions:repeated(scenes.flatMap(s=>s.key_actions||[])),
  unchanged_scene_states:scenes.filter(s=>s.entry_state===s.exit_state).map(s=>s.scene_id),
  speech_warnings:narrativeDiagnostics(script)};
 if(!assessment)return {automated_facts:facts,artistic_status:'NOT_EVALUATED',criteria:STORY_CRITERIA.map(id=>({id,status:'NOT_EVALUATED',evidence:[]}))};
 if(typeof assessment.reviewer!=='string'||!assessment.reviewer.trim()||!Array.isArray(assessment.criteria))throw Error('EVALUATOR_REQUIRED');
 const ids=new Set(scenes.map(s=>s.scene_id));
 for(const id of STORY_CRITERIA) {
  const items=assessment.criteria.filter(c=>c.id===id);
  if(items.length!==1||!['PASS','CONCERN','NOT_EVALUATED'].includes(items[0].status))throw Error('EVALUATION_COVERAGE:'+id);
  if(items[0].status!=='NOT_EVALUATED'&&(!Array.isArray(items[0].evidence)||!items[0].evidence.length||items[0].evidence.some(e=>!ids.has(e.scene_id)||typeof e.reason!=='string'||!e.reason.trim())))throw Error('EVALUATION_EVIDENCE:'+id);
 }
 return {automated_facts:facts,reviewer:assessment.reviewer,artistic_status:assessment.criteria.some(c=>c.status==='NOT_EVALUATED')?'PARTIAL':assessment.criteria.some(c=>c.status==='CONCERN')?'CONCERNS':'PASS',criteria:assessment.criteria};
}
