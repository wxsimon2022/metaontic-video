const FIELDS=['genre','aspect_ratio','resolution','language','visual_style','target_audience','distribution_channel','target_model'];
/** 原始需求永远保留；未指定规格明确为UNKNOWN，不能替用户确认。 */
export function createProjectSpec(title:string,idea:string,duration:number,input:any={}) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('INVALID_PROJECT_SPEC');
  if(Object.keys(input).some(k=>!FIELDS.includes(k)&&!['hard_constraints','soft_preferences','references'].includes(k)))throw Error('UNKNOWN_PROJECT_SPEC_FIELD');
  for(const key of FIELDS)if(input[key]!==undefined&&(typeof input[key]!=='string'||!input[key].trim()))throw Error(`INVALID_PROJECT_SPEC:${key}`);
  if(input.aspect_ratio && !['16:9','9:16'].includes(input.aspect_ratio))throw Error('INVALID_PROJECT_SPEC:aspect_ratio');
  if(input.resolution && !['480p','720p'].includes(input.resolution))throw Error('INVALID_PROJECT_SPEC:resolution');
  for(const key of ['hard_constraints','soft_preferences','references'])if(input[key]!==undefined&&(!Array.isArray(input[key])||input[key].some(v=>typeof v!=='string'||!v.trim())))throw Error(`INVALID_PROJECT_SPEC:${key}`);
  return {title,original_idea:idea,target_duration_ms:duration,...Object.fromEntries(FIELDS.map(k=>[k,input[k] || null])),hard_constraints:input.hard_constraints || [],soft_preferences:input.soft_preferences || [],references:input.references || [],provenance:{title:'USER_SPECIFIED',original_idea:'USER_SPECIFIED',target_duration_ms:'USER_SPECIFIED',...Object.fromEntries(FIELDS.map(k=>[k,input[k]?'USER_SPECIFIED':'UNKNOWN']))}};
}
