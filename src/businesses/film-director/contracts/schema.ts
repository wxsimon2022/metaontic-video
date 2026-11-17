import { ITEM_ARRAYS, STAGE_ARRAYS } from './fields.js';
/** 新项目使用严格协议；历史项目保持兼容，不把缺少旧字段自动认定为新稿。 */
export function validateV31(stage: string, value: any, state: any) {
  if(state.schema_version!=='3.1.0') return;
  const array=(object:any,key:string)=>{if(!Array.isArray(object[key])) throw Error(`SCHEMA_REQUIRED_ARRAY:${key}`);};
  const text=(object:any,key:string)=>{if(typeof object[key]!=='string'||!object[key].trim())throw Error(`SCHEMA_REQUIRED_TEXT:${key}`);};
  const positive=(object:any,key:string)=>{if(!Number.isSafeInteger(object[key])||object[key]<=0)throw Error(`SCHEMA_REQUIRED_DURATION:${key}`);};
  if(stage==='creative') {array(value,'structure');array(value,'must_preserve');array(value,'assumptions');}
  if(stage==='script') {
    array(value,'scenes');array(value,'characters');array(value,'dialogue');
    for(const line of value.dialogue){text(line,'dialogue_id');text(line,'exact_text');text(line,'speaker_id');text(line,'scene_id');}
  }
  if(stage==='assets') {
    for(const key of STAGE_ARRAYS.assets) array(value,key);
    for(const scene of value.scenes){text(scene,'location_id');text(scene,'scene_state_id');}
    for(const current of value.scene_states)text(current,'location_id');
  }
  if(stage==='shots') for(const shot of value.shots || []) {
    for(const key of ['chapter_id','scene_id','location_id','scene_state_id','narrative_purpose'])text(shot,key);
    positive(shot,'duration_ms');
    for(const key of ITEM_ARRAYS.shots.shots)array(shot,key);
  }
  if(stage==='prompts') for(const prompt of value.prompts || []) {
    for(const key of ['location_id','scene_state_id','generation_mode'])text(prompt,key);
    positive(prompt,'duration_ms');for(const key of ITEM_ARRAYS.prompts.prompts)array(prompt,key);
  }
  if(stage==='review') {
    text(value,'review_status');text(value,'review_id');text(value,'review_stage');
    array(value,'review_scope');array(value,'unverified_items');
    if(!value.reviewed_revisions||typeof value.reviewed_revisions!=='object')throw Error('MISSING_REVIEWED_REVISIONS');
    for(const stage of ['creative','script','assets','shots','prompts']) if(value.reviewed_revisions[stage]!==state.artifacts[stage]?.revision)throw Error(`REVIEW_REVISION_MISMATCH:${stage}`);
    const final=value.review_status==='PASS'||value.review_status==='PASS_WITH_WARNINGS';
    if(final) {
      if(value.review_stage!=='FINAL_REVIEW')throw Error('FINAL_REVIEW_REQUIRED');
      if(['creative','script','assets','shots','prompts'].some(s=>!value.review_scope.includes(s)))throw Error('FINAL_REVIEW_SCOPE_INCOMPLETE');
      const required=['requirement_fidelity','narrative_quality','cinematic_quality','temporal_consistency','prompt_executability','structural_completeness'];
      if(state.artifacts.assets?.data.characters?.length)required.push('character_consistency');
      if(state.artifacts.assets?.data.scenes?.length)required.push('scene_consistency');
      if(required.some(k=>typeof value.scores?.[k]!=='number'))throw Error('FINAL_REVIEW_SCORE_NOT_EVALUATED');
    }
    const ids=new Set();
    for(const issue of value.issues || []) {
      for(const key of ['issue_id','description','evidence','location','responsible_agent','recheck_criteria'])text(issue,key);
      if(!['director','creative','screenwriter','character','scene','storyboard','prompt-engineer','reviewer'].includes(issue.responsible_agent))throw Error('INVALID_ISSUE_OWNER');
      if(ids.has(issue.issue_id))throw Error('DUPLICATE_ISSUE_ID');ids.add(issue.issue_id);
    }
  }
}
