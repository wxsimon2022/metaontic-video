import { readable, scriptContent } from '../approvals/approval.presenter.js';
import { createHash } from 'node:crypto';
import { STAGES } from './artifact.service.js';
/** 清单绑定实际存储对象；不是虚构的独立导出文件路径。 */
export function artifactManifest(state: any) {
  return STAGES.filter(s=>state.artifacts[s]).map(stage=>{
    const artifact=state.artifacts[stage];
    return {stage,artifact_ref:`project.json#/artifacts/${stage}`,revision:artifact.revision,source_revisions:artifact.source_revisions || {},...(artifact.profile_ref?{profile_ref:artifact.profile_ref}:{}),...(artifact.dimension_profile_ref?{dimension_profile_ref:artifact.dimension_profile_ref}:{}),stale:artifact.stale,sha256:createHash('sha256').update(JSON.stringify(artifact.data)).digest('hex')};
  });
}
export function renderDeliverables(state: any) {
  const names={creative:'创意提案',script:'正式剧本',assets:'人物与场景档案',shots:'导演分镜',prompts:'视频生成提示词',review:'质量审核'};
  return `# ${state.title}\n\n项目：${state.project_id} · 修订：${state.revision}\n\n`+STAGES.filter(s=>state.artifacts[s]).map(stage=>{
    const a=state.artifacts[stage];
    return `## ${names[stage]}（修订 ${a.revision}${a.stale?'，已失效，待更新':''}）\n\n${stage==='script'?scriptContent(a.data):readable(a.data)}`;
  }).join('\n\n');
}
