import { DIMENSION_FIELDS, assertDimensions } from '../profiles/dimensions.js';
import { WORK_TYPES, NARRATIVE_MODES, profileRevision, resolveProfile } from '../profiles/index.js';
const FIELDS=['genre','aspect_ratio','resolution','language','visual_style','target_audience','distribution_channel','target_model','work_type','narrative_mode','format','purpose','style_profile','tone'];
/** 原始需求永远保留；未指定规格明确为UNKNOWN，不能替用户确认。 */
export function createProjectSpec(title:string,idea:string,duration:number,input:any={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_PROJECT_SPEC');
  if(Object.keys(input).some(k=>!FIELDS.includes(k)&&!['hard_constraints','soft_preferences','references'].includes(k)))throw Error('UNKNOWN_PROJECT_SPEC_FIELD');
  for(const key of FIELDS)if(input[key]!==undefined&&(typeof input[key]!=='string'||!input[key].trim()))throw Error(`INVALID_PROJECT_SPEC:${key}`);
  if(input.aspect_ratio && !['16:9','9:16'].includes(input.aspect_ratio))throw Error('INVALID_PROJECT_SPEC:aspect_ratio');
  if(input.resolution && !['480p','720p'].includes(input.resolution))throw Error('INVALID_PROJECT_SPEC:resolution');
  if(input.work_type && !WORK_TYPES.includes(input.work_type))throw Error('UNKNOWN_WORK_TYPE');
  if(input.narrative_mode && !NARRATIVE_MODES.includes(input.narrative_mode))throw Error('UNKNOWN_NARRATIVE_MODE');
  for(const key of ['hard_constraints','soft_preferences','references'])if(input[key]!==undefined&&(!Array.isArray(input[key])||input[key].some(v=>typeof v!=='string'||!v.trim())))throw Error(`INVALID_PROJECT_SPEC:${key}`);
  const dimensionSelected=['genre','format','purpose','style_profile'].some(k=>input[k]!==undefined);
  assertDimensions({...input,dimension_profile_revision:dimensionSelected?'1':null});
  return {dimension_profile_revision:dimensionSelected?'1':null,title,original_idea:idea,target_duration_ms:duration,...Object.fromEntries(FIELDS.map(k=>[k,input[k] || null])),profile_revision:input.work_type?profileRevision(input.work_type):null,hard_constraints:input.hard_constraints || [],soft_preferences:input.soft_preferences || [],references:input.references || [],provenance:{title:'USER_SPECIFIED',original_idea:'USER_SPECIFIED',target_duration_ms:'USER_SPECIFIED',...Object.fromEntries(FIELDS.map(k=>[k,input[k]?'USER_SPECIFIED':'UNKNOWN']))}};
}

/** 类型变更保留材料但使其失效，清除旧批准并增加修订；不会付费或重做视频。 */
export function configureProfile(state:any,input:any,expected:number) {
  if(state.revision!==expected)throw Error('REVISION_CONFLICT');
  if(state.status==='STOPPED')throw Error('PROJECT_STOPPED');
  const allowed=['work_type','narrative_mode','visual_style',...DIMENSION_FIELDS];
  if(!input||typeof input!=='object'||Array.isArray(input)||!Object.keys(input).length||Object.keys(input).some(k=>!allowed.includes(k)))throw Error('INVALID_PROFILE_SELECTION');
  if(input.work_type!==undefined&&!WORK_TYPES.includes(input.work_type))throw Error('INVALID_PROFILE_SELECTION');
  if(input.narrative_mode!==undefined&&!NARRATIVE_MODES.includes(input.narrative_mode))throw Error('UNKNOWN_NARRATIVE_MODE');
  for(const [key,value] of Object.entries(input))if(!(value===null&&[...DIMENSION_FIELDS,'visual_style'].includes(key as any))&&(typeof value!=='string'||!value.trim()))throw Error(`INVALID_PROJECT_SPEC:${key}`);
  const old=state.project_spec || {};
  const spec={...old,...input};
  spec.profile_revision=spec.work_type?profileRevision(spec.work_type):null;
  if(DIMENSION_FIELDS.some(k=>Object.hasOwn(input,k)&&k!=='tone'))spec.dimension_profile_revision='1';
  resolveProfile(spec);assertDimensions(spec);
  const changed=Object.keys(input).filter(k=>old[k]!==spec[k]);
  if(old.profile_revision!==spec.profile_revision)changed.push('profile_revision');
  if(old.dimension_profile_revision!==spec.dimension_profile_revision)changed.push('dimension_profile_revision');
  if(!changed.length)return structuredClone(state);
  const next=structuredClone(state);
  next.project_spec={...spec,provenance:{...old.provenance,...Object.fromEntries(Object.keys(input).map(k=>[k,'USER_SPECIFIED']))}};
  next.revision++;
  for(const artifact of Object.values(next.artifacts) as any[])artifact.stale=true;
  next.approvals={};next.status='REQUIREMENT_ANALYSIS';
  next.last_change={stage:'project_spec',changed_fields:changed,previous_profile:{work_type:old.work_type || null,profile_revision:old.profile_revision || null},affected_artifacts:Object.keys(next.artifacts),approval_impact:'REAPPROVE_CREATIVE_AND_SCRIPT'};
  return next;
}
