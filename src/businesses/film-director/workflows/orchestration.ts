import { sourceRevisions, GENERIC_MODEL_PROFILE, STAGE_DEPS, projectContext, modelProfile } from '../contracts/index.js';
import { evaluateReview } from '../quality/review.js';
import { roleInstructions } from '../roles/index.js';
import { profileContext } from '../profiles/index.js';
import { STAGES, validateArtifact } from '../runtime/project.js';
/** 程序选择下一许可动作；角色仅读取直接依赖，不重复加载全项目。 */
export function nextTask(state: any) {
  if(state.status==='STOPPED') return {action:'stop',status:'STOPPED',expectedRevision:state.revision};
  for (const stage of STAGES) {
    const artifact = state.artifacts[stage];
    if (!artifact || artifact.stale || state.status===`${stage.toUpperCase()}_REVISE`) {
      const roles = {creative:'creative',script:'screenwriter',assets:'character + scene',shots:'storyboard',prompts:'prompt-engineer',review:'reviewer'};
      const dependencies = STAGE_DEPS;
      const roleIds={creative:['creative'],script:['screenwriter'],assets:['character','scene'],shots:['storyboard'],prompts:['prompt-engineer'],review:['reviewer']};
      return { action:'submit', ...projectContext(state), work_profile:profileContext(state), input_revisions:sourceRevisions(state,stage), revision_scope:artifact?.stale_entity_ids || [], model_profile:modelProfile(state), stage, role:roles[stage], inputs:Object.fromEntries(dependencies[stage].map(s => [s,state.artifacts[s]])), instructions:roleIds[stage].map(role=>roleInstructions(state,role)).join('\n\n'),expectedRevision:state.revision };
    }
    if (['creative','script'].includes(stage) && state.approvals[stage] !== artifact.revision) {
      if(stage==='creative'&&profileContext(state).status==='UNSELECTED')return {action:'configure_profile',role:'director',...projectContext(state),work_profile:profileContext(state),expectedRevision:state.revision,instructions:'创意批准前确认作品类型，用configure_profile保存选择；保存会使当前草稿失效，需按类型更新后重新提交。不得把未回答当作同意。'};
      return {action:'approve',stage,work_profile:profileContext(state),expectedRevision:state.revision};
    }
  }
  const report=state.artifacts.review.data;
  if(report.review_status && !evaluateReview(report).passed && Object.values(state.issue_registry || {}).some((i:any)=>i.status==='RESOLVED')) return {action:'recheck',role:'reviewer',stage:'review',...projectContext(state),work_profile:profileContext(state),issues:Object.values(state.issue_registry).filter((i:any)=>i.status==='RESOLVED'),input_revisions:sourceRevisions(state,'review'),review_revision:state.artifacts.review.revision,expectedRevision:state.revision,instructions:roleInstructions(state,'reviewer')+'\n逐项按recheck_criteria对照当前版本实际复审；通过后调用verify_issue登记证据，不通过返回责任角色。登记后重新提交完整最终审核报告，禁止仅靠自称VERIFIED。'};
  if(report.review_status && !evaluateReview(report).passed) return {action:'repair',stage:'review',role:'director',issues:report.issues,expectedRevision:state.revision};
  return {action:'compile',...projectContext(state),expectedRevision:state.revision};
}
export function validateCurrent(state: any) {
  if(state.status==='STOPPED') throw Error('PROJECT_STOPPED');
  for (const stage of STAGES) {
    const artifact=state.artifacts[stage];
    if (!artifact || artifact.stale) throw Error(`STALE_OR_MISSING:${stage}`);
    if (['creative','script'].includes(stage) && state.approvals[stage]!==artifact.revision) throw Error('APPROVAL_REQUIRED');
    validateArtifact(stage,artifact.data,state);
    if(stage==='review' && artifact.data.review_status && !evaluateReview(artifact.data).passed) throw Error('REVIEW_BLOCKED');
  }
}
/** 编译不付费；显式使用现有视频分段算法，镜头边界不改变调用次数。 */
export function compileProduction(state: any, plan: any[], ratio: string, resolution: string) {
  validateCurrent(state);
  if (!['16:9','9:16'].includes(ratio) || !['480p','720p'].includes(resolution)) throw Error('CONFIRMED_SPEC_REQUIRED');
  if (!Number.isSafeInteger(state.duration_ms) || state.duration_ms < 15000 || state.duration_ms > 3600000) throw Error('INVALID_PROJECT_DURATION');
  const spec=state.project_spec;
  if(spec?.aspect_ratio && spec.aspect_ratio!==ratio) throw Error('PROJECT_SPEC_MISMATCH:aspect_ratio');
  if(spec?.resolution && spec.resolution!==resolution) throw Error('PROJECT_SPEC_MISMATCH:resolution');
  const shots=state.artifacts.shots.data.shots;
  const prompts=state.artifacts.prompts.data.prompts;
  let start=0;
  const segments=plan.map((part,index)=>{
    const end=start+part.seconds*1000;
    const covered=shots.filter(s=>s.start_ms<end && s.end_ms>start);
    if(state.schema_version==='3.1.0' && covered.some(s=>s.start_ms<start||s.end_ms>end)) throw Error('SHOT_SPLIT_REQUIRES_STORYBOARD_REVISION');
    if(state.schema_version==='3.1.0' && new Set(covered.map(s=>s.location_id)).size>1) throw Error('MULTI_LOCATION_SEGMENT_REQUIRES_REPLAN');
    const prompt=covered.map(s=>`[${Math.max(start,s.start_ms)-start}–${Math.min(end,s.end_ms)-start}ms] ${prompts.find(p=>p.shot_id===s.shot_id).prompt}`).join('\n');
    const result={index:index+1,start_ms:start,end_ms:end,shot_ids:covered.map(s=>s.shot_id),prompt};start=end;return result;
  });
  if (start!==state.duration_ms || segments.some(s=>!s.prompt)) throw Error('PRODUCTION_DURATION_MISMATCH');
  return {source_project_id:state.project_id,source_revision:state.revision,ratio,resolution,segments,specification:{prompt:segments[0].prompt,segmentPrompts:segments.map(s=>s.prompt),duration:state.duration_ms/1000,ratio,resolution}};
}
