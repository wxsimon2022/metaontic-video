/** 确定性部分只检查证据齐备和可执行预算，不把艺术偏好作为事实错误。 */
export function narrativeDiagnostics(script:any) {
 return (script?.scenes||[]).flatMap(scene=>{
  const lines=(script.dialogue||[]).filter(d=>d.scene_id===scene.scene_id);
  const chars=lines.reduce((n,d)=>n+Array.from(String(d.exact_text||'').replace(/[\s，。！？、；：,.!?]/g,'')).length,0);
  const estimate=Math.ceil(chars/4*1000);
  return estimate>scene.duration_ms?[{category:'SPEECH_BUDGET_RISK',scene_id:scene.scene_id,speech_estimate_ms:estimate,duration_ms:scene.duration_ms,kind:'WARNING',reason:'按每秒约4字初估已超过场次预算，需结合语速、动作与停顿人工复核。'}]:[];
 });
}
export function validateContentEvidence(stage:string,value:any,state:any) {
 if(state.quality_policy!=='evidence_v1')return;
 const text=(v:any)=>typeof v==='string'&&!!v.trim();
 if(stage==='creative')for(const section of value.structure||[]) {
  if(!text(section.purpose)||!(text(section.visual_evidence)||Array.isArray(section.visual_evidence)&&section.visual_evidence.some(text)))throw Error('CREATIVE_VISIBLE_EVIDENCE_REQUIRED');
 }
 if(stage==='script')for(const scene of value.scenes||[]) {
  if(!['scene_goal','entry_state','exit_state'].every(k=>text(scene[k]))||!Array.isArray(scene.key_actions)||!scene.key_actions.length||!scene.key_actions.every(text))throw Error('SCENE_ACTION_EVIDENCE_REQUIRED');
 }
 if(stage==='review'&&['PASS','PASS_WITH_WARNINGS'].includes(value.review_status)) {
  for(const [key,score] of Object.entries(value.scores||{}))if(score!==null&&!text(value.score_evidence?.[key]))throw Error('REVIEW_SCORE_EVIDENCE_REQUIRED:'+key);
  const scenes=state.artifacts.script.data.scenes;
  if(!Array.isArray(value.theme_evidence)||!value.theme_evidence.length||value.theme_evidence.some(e=>!scenes.some(s=>s.scene_id===e.scene_id)||!text(e.evidence)))throw Error('THEME_EVIDENCE_REQUIRED');
  const warnings=narrativeDiagnostics(state.artifacts.script.data);
  for(const warning of warnings)if(!value.budget_checks?.some(c=>c.scene_id===warning.scene_id&&['ACCEPTED_WITH_REASON','REVISED'].includes(c.status)&&text(c.evidence)))throw Error('SPEECH_BUDGET_REVIEW_REQUIRED:'+warning.scene_id);
 }
}
