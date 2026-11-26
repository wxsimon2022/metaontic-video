import { videoCapabilities, channelCapabilities } from '../../video-generation/providers/capabilities.js';
import { resolveDimensions } from '../profiles/profile.resolver.js';
export const STAGE_DEPS = {creative:[],script:['creative'],assets:['script'],shots:['script','assets'],prompts:['script','assets','shots'],review:['creative','script','assets','shots','prompts']};
export function sourceRevisions(state: any, stage: string) {
  return Object.fromEntries((STAGE_DEPS[stage] || []).filter(s=>state.artifacts[s]).map(s=>[s,state.artifacts[s].revision]));
}
/** 每个任务都携带原始要求与规格，不依赖上一轮聊天记忆。 */
export function projectContext(state:any) {
  return {resolved_profiles:resolveDimensions(state.project_spec),project_id:state.project_id,original_idea:state.source_brief || '',target_duration_ms:state.duration_ms,project_spec:state.project_spec || {title:state.title,target_duration_ms:state.duration_ms,aspect_ratio:null,language:null,visual_style:null,target_model:null,hard_constraints:[],provenance:'LEGACY_UNKNOWN'},quality_policy:state.quality_policy || 'legacy',approved_revisions:{...state.approvals}};
}
export function revisionsEqual(a:any,b:any) {
  return !!a&&!!b&&typeof a==='object'&&typeof b==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>Object.hasOwn(b,k)&&b[k]===v);
}
export function modelProfile(state:any) {
  return state.capability_channel ? channelCapabilities(state.project_spec?.target_model || 'generic',state.capability_channel,state.capability_observations||[]) : videoCapabilities(state.project_spec?.target_model || 'generic');
}
