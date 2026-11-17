import { WORK_TYPES, NARRATIVE_MODES, profileRevision, resolveProfile } from './profiles/index.js';
const FIELDS=['genre','aspect_ratio','resolution','language','visual_style','target_audience','distribution_channel','target_model','work_type','narrative_mode'];
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
  return {title,original_idea:idea,target_duration_ms:duration,...Object.fromEntries(FIELDS.map(k=>[k,input[k] || null])),profile_revision:input.work_type?profileRevision(input.work_type):null,hard_constraints:input.hard_constraints || [],soft_preferences:input.soft_preferences || [],references:input.references || [],provenance:{title:'USER_SPECIFIED',original_idea:'USER_SPECIFIED',target_duration_ms:'USER_SPECIFIED',...Object.fromEntries(FIELDS.map(k=>[k,input[k]?'USER_SPECIFIED':'UNKNOWN']))}};
}

/** 类型变更保留材料但使其失效，清除旧批准并增加修订；不会付费或重做视频。 */
export function configureProfile(state:any,input:any,expected:number) {
  if(state.revision!==expected)throw Error('REVISION_CONFLICT');
  if(state.status==='STOPPED')throw Error('PROJECT_STOPPED');
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['work_type','narrative_mode'].includes(k))||!WORK_TYPES.includes(input.work_type))throw Error('INVALID_PROFILE_SELECTION');
  if(input.narrative_mode!==undefined&&!NARRATIVE_MODES.includes(input.narrative_mode))throw Error('UNKNOWN_NARRATIVE_MODE');
  const old=state.project_spec || {};
  const mode=input.narrative_mode ?? old.narrative_mode ?? null;
  const revision=profileRevision(input.work_type);
  if(old.work_type===input.work_type&&old.narrative_mode===mode&&old.profile_revision===revision)return structuredClone(state);
  const next=structuredClone(state);
  next.project_spec={...old,work_type:input.work_type,narrative_mode:mode,profile_revision:revision,provenance:{...old.provenance,work_type:'USER_SPECIFIED',narrative_mode:input.narrative_mode?'USER_SPECIFIED':old.provenance?.narrative_mode || 'UNKNOWN'}};
  resolveProfile(next.project_spec);
  next.revision++;
  for(const artifact of Object.values(next.artifacts) as any[])artifact.stale=true;
  next.approvals={};next.status='REQUIREMENT_ANALYSIS';
  next.last_change={stage:'project_spec',changed_fields:['work_type','narrative_mode','profile_revision'],previous_profile:{work_type:old.work_type || null,profile_revision:old.profile_revision || null},affected_artifacts:Object.keys(next.artifacts),approval_impact:'REAPPROVE_CREATIVE_AND_SCRIPT'};
  return next;
}
