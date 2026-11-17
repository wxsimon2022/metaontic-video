import { sourceRevisions, GENERIC_MODEL_PROFILE } from './contracts.js';
import { evaluateReview } from './review.js';
import { ROLE_PROMPTS } from './roles/index.js';
import { STAGES, validateArtifact } from './project.js';
/** 程序选择下一许可动作；角色仅读取直接依赖，不重复加载全项目。 */
export function nextTask(state: any) {
  for (const stage of STAGES) {
    const artifact = state.artifacts[stage];
    if (!artifact || artifact.stale) {
      const roles = {creative:'creative',script:'screenwriter',assets:'character + scene',shots:'storyboard',prompts:'prompt-engineer',review:'reviewer'};
      const dependencies = {creative:[],script:['creative'],assets:['script'],shots:['script','assets'],prompts:['assets','shots'],review:[...STAGES.slice(0,5)]};
      return { action:'submit', project_id:state.project_id, input_revisions:sourceRevisions(state,stage), revision_scope:artifact?.stale_entity_ids || [], model_profile:GENERIC_MODEL_PROFILE, stage, role:roles[stage], inputs:Object.fromEntries(dependencies[stage].map(s => [s,state.artifacts[s]])), instructions:ROLE_INSTRUCTIONS[stage],expectedRevision:state.revision };
    }
    if (['creative','script'].includes(stage) && state.approvals[stage] !== artifact.revision) return {action:'approve',stage,expectedRevision:state.revision};
  }
  const report=state.artifacts.review.data;
  if(report.review_status && !evaluateReview(report).passed) return {action:'repair',stage:'review',role:'director',issues:report.issues,expectedRevision:state.revision};
  return {action:'compile',expectedRevision:state.revision};
}
export function validateCurrent(state: any) {
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
  const shots=state.artifacts.shots.data.shots;
  const prompts=state.artifacts.prompts.data.prompts;
  let start=0;
  const segments=plan.map((part,index)=>{
    const end=start+part.seconds*1000;
    const covered=shots.filter(s=>s.start_ms<end && s.end_ms>start);
    const prompt=covered.map(s=>`[${Math.max(start,s.start_ms)-start}–${Math.min(end,s.end_ms)-start}ms] ${prompts.find(p=>p.shot_id===s.shot_id).prompt}`).join('\n');
    const result={index:index+1,start_ms:start,end_ms:end,shot_ids:covered.map(s=>s.shot_id),prompt};start=end;return result;
  });
  if (start!==state.duration_ms || segments.some(s=>!s.prompt)) throw Error('PRODUCTION_DURATION_MISMATCH');
  return {source_project_id:state.project_id,source_revision:state.revision,ratio,resolution,segments,specification:{prompt:segments[0].prompt,segmentPrompts:segments.map(s=>s.prompt),duration:state.duration_ms/1000,ratio,resolution}};
}

const ROLE_INSTRUCTIONS = {
 creative:ROLE_PROMPTS.creative,script:ROLE_PROMPTS.screenwriter,
 assets:ROLE_PROMPTS.character+'\n\n'+ROLE_PROMPTS.scene,
 shots:ROLE_PROMPTS.storyboard,prompts:ROLE_PROMPTS['prompt-engineer'],review:ROLE_PROMPTS.reviewer,
};
