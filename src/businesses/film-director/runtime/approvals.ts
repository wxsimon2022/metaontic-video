/** 仅供真实用户问题服务的结果调用，不能由模型直接传入批准决定。 */
export function recordApprovalDecision(state:any, stage:string, decision:string, expected:number) {
  const artifact=state.artifacts[stage];
  if(!['creative','script'].includes(stage)||!artifact||artifact.stale||state.revision!==expected)throw Error('INVALID_APPROVAL_REVISION');
  if(!['APPROVED','REVISE','REJECTED'].includes(decision))throw Error('INVALID_APPROVAL_DECISION');
  if(decision==='APPROVED'&&stage==='creative'&&state.project_spec&&Object.hasOwn(state.project_spec,'work_type')&&!state.project_spec.work_type)throw Error('WORK_TYPE_REQUIRED_BEFORE_APPROVAL');
  const next=structuredClone(state);
  next.decisions ||= [];
  next.decisions.push({approval_id:`APPROVAL_${next.decisions.length+1}`,project_id:state.project_id,gate:stage.toUpperCase(),stage,artifact_ref:`project.json#/artifacts/${stage}`,artifact_revision:artifact.revision,revision:artifact.revision,work_type:state.project_spec?.work_type || null,profile_revision:state.project_spec?.profile_revision || null,decision,decided_by:'USER',decision_time:new Date().toISOString()});
  next.revision++;
  if(decision==='APPROVED') {
    next.approvals[stage]=artifact.revision;
    next.status=stage==='creative'?'SCRIPT_WRITING':'ASSET_DESIGN';
  } else {
    delete next.approvals[stage];
    next.status=decision==='REJECTED'?'STOPPED':`${stage.toUpperCase()}_REVISE`;
  }
  return next;
}
