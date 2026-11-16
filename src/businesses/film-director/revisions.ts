import { commitArtifact, STAGES } from './project.js';
/** 局部修订保留无关实体；全局时间或结构变化仍使整个相关阶段失效。 */
export function reviseEntities(state: any, stage: string, replacements: any[], expected: number) {
  const fields={assets:['characters','scenes'],shots:['shots'],prompts:['prompts']};
  const keys={characters:'character_id',scenes:'scene_id',shots:'shot_id',prompts:'shot_id'};
  if (!fields[stage] || !Array.isArray(replacements) || !replacements.length) throw Error('INVALID_REVISION_SCOPE');
  const artifact=state.artifacts[stage];
  if (!artifact || artifact.stale) throw Error('UPSTREAM_REQUIRED');
  const data=structuredClone(artifact.data);
  const changed=new Set<string>();
  for (const replacement of replacements) {
    if (!fields[stage].includes(replacement.collection)) throw Error('INVALID_COLLECTION');
    const key=keys[replacement.collection];const id=replacement.entity?.[key];
    const index=data[replacement.collection].findIndex(v=>v[key]===id);
    if (index<0 || changed.has(id)) throw Error('UNKNOWN_OR_DUPLICATE_ENTITY');
    data[replacement.collection][index]=replacement.entity;changed.add(id);
  }
  const next=commitArtifact(state,stage,data,expected);
  const affected=stage==='assets' ? state.artifacts.shots?.data.shots.filter(s=>changed.has(s.scene_id)||s.character_ids.some(id=>changed.has(id))).map(s=>s.shot_id) || [] : [...changed];
  // 仍将阶段标stale以阻止制作，但保留明确的实体集合供定向重写与重审。
  for (const downstream of STAGES.slice(STAGES.indexOf(stage as any)+1)) {
    if (next.artifacts[downstream]) next.artifacts[downstream].stale_entity_ids=affected;
  }
  next.last_change={stage,entity_ids:[...changed],affected_shot_ids:affected};
  return next;
}
/** 创建可恢复任务；幂等键绑定阶段与输入版本，重复调度返回同一任务。 */
export function scheduleTask(state: any, task: any) {
  const key=`${task.action}:${task.stage || 'production'}:${state.revision}`;
  const tasks=state.tasks || [];
  const existing=tasks.find(t=>t.key===key);
  if(existing)return existing;
  const result={key,status:'ready',attempts:0,source_revision:state.revision,...task};
  state.tasks=[...tasks,result];return result;
}
export function taskResult(state: any,key: string,status: string,errorCode?: string) {
  const task=state.tasks?.find(t=>t.key===key);
  if(!task || task.source_revision!==state.revision)throw Error('STALE_TASK');
  if(!['running','completed','failed'].includes(status))throw Error('INVALID_TASK_STATUS');
  if(task.status==='completed')return task;
  if(status==='running') {
    if(task.attempts>=3)throw Error('RETRY_EXHAUSTED');
    task.attempts++;
  }
  task.status=status;task.error_code=errorCode || null;return task;
}
