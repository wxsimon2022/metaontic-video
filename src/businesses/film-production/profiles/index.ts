import { resolveDimensions, assertDimensions, hasContentProfile, dimensionInstructions, validateDimensionReview } from './profile.resolver.js';
export { availableDimensions, resolveDimensions, hasContentProfile } from './profile.resolver.js';
import drama from './legacy/drama.js';
import comedy from './legacy/comedy.js';
import lifestyle from './legacy/lifestyle.js';
import documentary from './legacy/documentary.js';
import commercial from './legacy/commercial.js';
import promotional from './legacy/promotional.js';
import type { FilmProfile } from './types.js';

const REGISTRY: Record<string,FilmProfile> = Object.fromEntries([drama,comedy,lifestyle,documentary,commercial,promotional].map(p=>[p.id,p]));
export const WORK_TYPES = Object.keys(REGISTRY);
export const NARRATIVE_MODES = ['FICTION','OBSERVATIONAL','EXPLANATORY','DEMONSTRATION','POETIC','MIXED'];
export function availableProfiles() {return Object.values(REGISTRY).map(p=>({work_type:p.id,label:p.label,profile_revision:p.revision,strategy:p.strategy}));}
export function resolveProfile(spec:any): FilmProfile | null {
  if(!spec?.work_type) return null;
  if(!Object.hasOwn(REGISTRY,spec.work_type))throw Error('UNKNOWN_WORK_TYPE');
  const profile=REGISTRY[spec.work_type];
  if(spec.profile_revision!==profile.revision)throw Error('UNSUPPORTED_PROFILE_REVISION');
  return structuredClone(profile);
}
export function profileRevision(workType:string) {
  if(!Object.hasOwn(REGISTRY,workType))throw Error('UNKNOWN_WORK_TYPE');
  return REGISTRY[workType].revision;
}
/** 画布写作仍交Markdown；复用同一配置，不冒充专业项目的审批和JSON提交。 */
export function writingProfileInstructions(workType?:string) {
  if(!workType)return '作品类型未指定：尊重想法中的内容形式，不默认剧情、强加人物冲突或反转。';
  const p=resolveProfile({work_type:workType,profile_revision:profileRevision(workType)});
  return `【作品类型 ${p.id}】${p.label}：${p.strategy}。${p.boundary}\n${p.role_rules.screenwriter}\n${p.role_rules.storyboard}\n制作说明中简洁说明本类型要点：${Object.values(p.script_fields).join('；')}。仍按当前入口的Markdown格式交稿，不输出type_details或审核JSON，不调用项目工具。`;
}
export function profileContext(state:any) {
  const profile=resolveProfile(state.project_spec);
  return {resolved_profiles:resolveDimensions(state.project_spec),status:hasContentProfile(state.project_spec)?'SELECTED':state.project_spec&&Object.hasOwn(state.project_spec,'work_type')?'UNSELECTED':'LEGACY_GENERIC',profile,available_profiles:profile?[]:availableProfiles()};
}
export function profileInstructions(state:any,role:string) {return legacyProfileInstructions(state,role)+dimensionInstructions(state.project_spec,role);}
function legacyProfileInstructions(state:any,role:string) {
  const p=resolveProfile(state.project_spec);
  if(!p&&hasContentProfile(state.project_spec))return '\n【组合类型】以已解析的四维 Profile 为创作和审核依据，不强制另选旧作品类型。';
  if(!p)return '\n【作品类型待确认】不得默认所有作品都是剧情片；根据原意推荐一个作品类型，明确后用configure_profile保存。旧项目允许沿用已有通用流程，不擅自迁移。风格、叙事方式与生成模式不是作品类型。';
  const fields=role==='creative'?p.creative_fields:role==='screenwriter'?p.script_fields:null;
  const roleRule=p.role_rules[role] || ({director:'按本类型组织角色与审批，类型变更使原创意及下游失效，需重新审批。',creative:'将策略转为可审批的内容蓝图，不提前写正式剧本。',character:'只设计已批准主体；无人像内容允许characters为空，不强加人物。',scene:'环境和道具服务本类型的内容推进，不更改已批准地点与事件。','prompt-engineer':'将本类型的已批准镜头忠实转为独立提示词，未知能力标待验证，不新添情节。',reviewer:'共同时间轴、引用、版本、对白和硬约束检查始终适用；艺术判断按本类型评估，不以缺少冲突、反转或对白判所有作品失败。'}[role] || '按当前阶段职责执行。');
  return `\n【作品类型 ${p.id} · 配置 ${p.revision}】${p.label}\n内容结构：${p.strategy}。${p.boundary}\n当前职责：${roleRule}\n叙事方式：${state.project_spec.narrative_mode || '未指定'}；视觉风格：${state.project_spec.visual_style || '未指定'}。二者独立，不从风格推断类型或生成方式。\n`
    +(fields?`本阶段额外输出type_details对象：${JSON.stringify(fields)}。字段为非空文本，记录具体内容而非规则复述。\n`:'')
    +(role==='reviewer'?`报告增加type_review：work_type=${p.id}、profile_revision=${p.revision}、checks数组。每项含criterion_id、status（PASS/CONCERN/NOT_EVALUATED）、evidence（具体材料位置与依据）。必须覆盖${JSON.stringify(p.review_criteria)}。CONCERN必须关联issues中的MINOR/INFO艺术建议或有客观证据的CRITICAL/MAJOR；NOT_EVALUATED不能通过终审。不能把类型评分当实际媒体效果验证。\n`:'')
    +'用户硬约束和批准内容优先。类型策略只在本类型适用，不强制每片都有冲突、对白、笑点或反转；新增关键内容仍需创意审批。';
}
/** 类型检查不替代通用契约与艺术判断；只对显式选择类型的项目启用扩展。 */
export function validateProfileArtifact(stage:string,value:any,state:any) {
  assertDimensions(state.project_spec);
  if(stage==='review')validateDimensionReview(value,state.project_spec);
  const p=resolveProfile(state.project_spec);if(!p)return;
  const fields=stage==='creative'?p.creative_fields:stage==='script'?p.script_fields:null;
  if(fields)for(const key of Object.keys(fields))if(typeof value.type_details?.[key]!=='string'||!value.type_details[key].trim())throw Error(`TYPE_DETAIL_REQUIRED:${key}`);
  if(stage!=='review')return;
  const r=value.type_review;
  if(r?.work_type!==p.id||r?.profile_revision!==p.revision||!Array.isArray(r.checks))throw Error('TYPE_REVIEW_REQUIRED');
  const ids=r.checks.map(c=>c?.criterion_id);
  if(ids.length!==p.review_criteria.length||new Set(ids).size!==ids.length||p.review_criteria.some(c=>!ids.includes(c.id)))throw Error('TYPE_REVIEW_COVERAGE');
  for(const check of r.checks) {
    if(!['PASS','CONCERN','NOT_EVALUATED'].includes(check.status)||typeof check.evidence!=='string'||!check.evidence.trim())throw Error('INVALID_TYPE_REVIEW_CHECK');
    if(check.status==='CONCERN'&&(!check.issue_id||!value.issues?.some(i=>i.issue_id===check.issue_id)))throw Error('TYPE_REVIEW_ISSUE_REQUIRED');
  }
  if(['PASS','PASS_WITH_WARNINGS'].includes(value.review_status)&&r.checks.some(c=>c.status==='NOT_EVALUATED'))throw Error('TYPE_REVIEW_NOT_EVALUATED');
}
