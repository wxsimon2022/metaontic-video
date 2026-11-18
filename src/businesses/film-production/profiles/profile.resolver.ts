/** 可组合的四维创作策略；不从用户自由文本风格推断类型。 */
import type { Dimension } from './profile.definition.js';
import { PROFILE_REGISTRY as REGISTRY } from './profile.registry.js';

export const DIMENSION_FIELDS = ['genre','format','purpose','style_profile','tone'] as const;
export function availableDimensions() {
 return Object.fromEntries(Object.entries(REGISTRY).map(([dim,items])=>[dim,Object.entries(items).map(([id,v])=>({id,label:v.label,revision:'1'}))]));
}
export function resolveDimensions(spec:any={}) {
 const profiles:any={};const warnings:string[]=[];
 if(spec.dimension_profile_revision!=null&&spec.dimension_profile_revision!=='1')throw Error('UNSUPPORTED_DIMENSION_PROFILE_REVISION');
 for(const dim of Object.keys(REGISTRY) as Dimension[]) {
  const id=spec[dim];if(id==null)continue;
  if(typeof id!=='string'||!id.trim())throw Error(`INVALID_PROFILE_DIMENSION:${dim}`);
  if(!Object.hasOwn(REGISTRY[dim],id)) {
   // 历史 genre 是自由文本，保留其元数据，不冒充已解析策略。
   if(dim==='genre'&&!spec.dimension_profile_revision){warnings.push('LEGACY_GENRE_UNRESOLVED');continue;}
   throw Error(`UNKNOWN_PROFILE_DIMENSION:${dim}`);
  }
  const selected=REGISTRY[dim][id];
  profiles[dim]={id,revision:'1',label:selected.label,criterion:selected.criterion};
 }
 const conflicts:string[]=[];
 const fact=profiles.genre?.id==='documentary'||profiles.format?.id==='interview'||spec.work_type==='DOCUMENTARY';
 if(fact&&spec.narrative_mode==='FICTION')conflicts.push('纪录或真实访谈不能将虚构材料标为真实事实；重现请明确标注并选择 MIXED。');
 if(profiles.style_profile?.id==='stylized_animation'&&profiles.genre?.id==='documentary')warnings.push('动画重现必须标 DRAMATIZATION，不能声称为真实拍摄。');
 return {status:conflicts.length?'PROFILE_CONFLICT':Object.keys(profiles).length?'RESOLVED':'UNSELECTED',revision:'1',profiles,tone:spec.tone||null,visual_style:spec.visual_style||null,warnings,conflicts,fact_provenance_required:fact,available_profiles:availableDimensions()};
}
export function assertDimensions(spec:any) {
 const resolved=resolveDimensions(spec);
 if(resolved.conflicts.length)throw Error('PROFILE_CONFLICT:'+resolved.conflicts.join('；'));
 return resolved;
}
export function hasContentProfile(spec:any) {
 const r=assertDimensions(spec);
 return !!spec?.work_type||['genre','format','purpose'].some(k=>r.profiles[k]);
}
export { dimensionInstructions } from './profile.composer.js';
export function validateDimensionReview(value:any,spec:any) {
 const r=assertDimensions(spec);const selected=Object.entries(r.profiles);
 if(!selected.length)return;
 const review=value.dimension_review;
 if(!review||review.profile_revision!=='1'||!Array.isArray(review.checks))throw Error('DIMENSION_REVIEW_REQUIRED');
 if(review.checks.length!==selected.length)throw Error('DIMENSION_REVIEW_COVERAGE');
 for(const [dim,p] of selected as [string,any][]) {
  const checks=review.checks.filter(c=>c.dimension===dim&&c.profile_id===p.id);
  if(checks.length!==1||!['PASS','CONCERN','NOT_EVALUATED'].includes(checks[0].status)||typeof checks[0].evidence!=='string'||!checks[0].evidence.trim())throw Error('DIMENSION_REVIEW_COVERAGE');
  const check=checks[0];
  if(check.status==='CONCERN'&&!value.issues?.some(i=>i.issue_id===check.issue_id))throw Error('DIMENSION_REVIEW_ISSUE_REQUIRED');
  if(check.status==='NOT_EVALUATED'&&['PASS','PASS_WITH_WARNINGS'].includes(value.review_status))throw Error('DIMENSION_REVIEW_NOT_EVALUATED');
 }
}
