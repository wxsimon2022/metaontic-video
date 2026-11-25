import { approvalMaterial } from './approvals/approval.presenter.js';
/** 仅压缩工具返回，完整材料仍原样持久化；下一阶段输入不截断。 */
export function projectResponse(state:any,nextTask:any,mode:string='full',extra:any={}) {
 const continuation = nextTask?.action==='submit' && nextTask?.stage==='script'
  ? {project_id:state.project_id,expected_revision:state.revision,action:'WRITE_AND_SUBMIT_SCRIPT',instructions:'创意已批准，完整输入见nextTask。完成剧本后先用本project_id和expected_revision提交script；提交成功后先在独立聊天正文完整展示返回的approval_material.markdown，再单独调用film_project approve(stage:"script")；只给摘要或说已保存不算展示。不要重复创意审批，不新建项目，不以准备开始结束本轮。中断恢复时沿用此状态。'}
  : nextTask?.action==='approve'
  ? {project_id:state.project_id,expected_revision:state.revision,action:'REQUEST_NATIVE_APPROVAL',instructions:nextTask.stage==='creative'?'先在用户可见正文完整展示approval_material.markdown中的本版创意方案，必须原样保留文字与标点；工具已完成排版，不另写或润色一版，不先展示自行整理稿。已展示同版则不重复。随后单独调用film_project approve，由原生卡片确认本版，不重复展示创意正文，也不要先用ask_user_question重复询问是否批准。':'先在用户可见正文完整展示approval_material.markdown中的当前已保存剧本，再单独调用film_project approve发起唯一人工审批；未展示全文不得请求批准，不要先用ask_user_question重复询问是否批准。'}
  : undefined;
 const material = nextTask?.action==='approve' ? approvalMaterial(nextTask.stage,state.artifacts?.[nextTask.stage]) : {};
 if(mode!=='compact')return {...state,...extra,...material,...(continuation?{continuation}:{}),nextTask};
 return {
  ...material,
  response_mode:'compact',project_id:state.project_id,title:state.title,schema_version:state.schema_version,
  revision:state.revision,status:state.status,duration_ms:state.duration_ms,project_spec:state.project_spec,
  approvals:state.approvals,last_change:state.last_change,
  artifact_summary:Object.fromEntries(Object.entries(state.artifacts||{}).map(([stage,a]:[string,any])=>[stage,{
   artifact_ref:`project.json#/artifacts/${stage}`,revision:a.revision,stale:a.stale===true,source_revisions:a.source_revisions,
  }])),
  task_summary:(state.tasks||[]).map(t=>({key:t.key,task_id:t.task_id,stage:t.stage,status:t.status,attempts:t.attempts,error_code:t.error_code})),
  ...(state.production?{production:state.production,production_stale:state.production.source_revision!==state.revision}:{}),
  ...(continuation?{continuation}:{}),
  ...(extra.sha256?{sha256:extra.sha256}:{}),...(extra.reused?{reused:true}:{}),nextTask,
  read_hint:'完整材料已保存。nextTask 含本阶段完整所需输入，可直接继续，不必再 next/read。补查单个产物用 read + stage；需要全部历史时用 read + responseMode:"full"。',
 };
}
