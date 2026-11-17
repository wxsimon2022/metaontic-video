import { createHash } from 'node:crypto';
import { STAGES } from './project.js';
/** 清单绑定实际存储对象；不是虚构的独立导出文件路径。 */
export function artifactManifest(state: any) {
  return STAGES.filter(s=>state.artifacts[s]).map(stage=>{
    const artifact=state.artifacts[stage];
    return {stage,artifact_ref:`project.json#/artifacts/${stage}`,revision:artifact.revision,source_revisions:artifact.source_revisions || {},...(artifact.profile_ref?{profile_ref:artifact.profile_ref}:{}),...(artifact.dimension_profile_ref?{dimension_profile_ref:artifact.dimension_profile_ref}:{}),stale:artifact.stale,sha256:createHash('sha256').update(JSON.stringify(artifact.data)).digest('hex')};
  });
}
function printable(value: any): string {
  if(value===null||value===undefined) return '—';
  if(typeof value!=='object') return String(value);
  if(Array.isArray(value)) return value.length?value.map(v=>typeof v==='object'?printable(v):`- ${v}`).join('\n\n'):'无';
  return Object.entries(value).map(([key,v])=>typeof v==='object'?`**${key}**\n\n${printable(v)}`:`**${key}**：${printable(v)}`).join('\n\n');
}
export function renderDeliverables(state: any) {
  const names={creative:'创意提案',script:'正式剧本',assets:'人物与场景档案',shots:'导演分镜',prompts:'视频生成提示词',review:'质量审核'};
  return `# ${state.title}\n\n项目：${state.project_id} · 修订：${state.revision}\n\n`+STAGES.filter(s=>state.artifacts[s]).map(stage=>{
    const a=state.artifacts[stage];
    const data={...a.data};
    const screenplay=stage==='script'&&typeof data.screenplay==='string'?data.screenplay:'';
    if(screenplay) delete data.screenplay;
    return `## ${names[stage]}（修订 ${a.revision}${a.stale?'，已失效，待更新':''}）\n\n${screenplay?screenplay+'\n\n':''}${printable(data)}`;
  }).join('\n\n');
}
