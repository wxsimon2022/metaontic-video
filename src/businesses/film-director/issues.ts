import { sourceRevisions, revisionsEqual } from './contracts.js';
/** 问题生命周期保存在运行时，报告不能通过删除问题或自标VERIFIED放行。 */
export function validateIssueLifecycle(report:any,state:any) {
  if(state.schema_version!=='3.1.0')return;
  const registry=state.issue_registry || {};
  const incoming=new Map((report.issues || []).map(i=>[i.issue_id,i]));
  for(const previous of Object.values(registry) as any[]) {
    if(['CRITICAL','MAJOR'].includes(previous.severity)&&(previous.status!=='VERIFIED'||!revisionsEqual(previous.verification?.source_revisions,sourceRevisions(state,'review')))&&!incoming.has(previous.issue_id))throw Error('UNRESOLVED_ISSUE_OMITTED');
  }
  for(const issue of report.issues || []) {
    const previous=Object.hasOwn(registry,issue.issue_id)?registry[issue.issue_id]:undefined;
    if(previous && previous.responsible_agent!==issue.responsible_agent)throw Error('ISSUE_OWNER_CHANGE_REQUIRES_DIRECTOR');
    if(!previous && ['RESOLVED','VERIFIED'].includes(issue.status))throw Error('ISSUE_INITIAL_STATUS_REQUIRED');
    if(issue.status==='RESOLVED') {
      const ownerStage={creative:'creative',screenwriter:'script',character:'assets',scene:'assets',storyboard:'shots','prompt-engineer':'prompts'}[issue.responsible_agent];
      const origin=previous?.reported_source_revisions;
      const current=sourceRevisions(state,'review');
      if(!origin || (ownerStage ? origin[ownerStage]===current[ownerStage] : revisionsEqual(origin,current))) throw Error('ISSUE_REPAIR_ARTIFACT_REQUIRED');
    }
    if(issue.status==='VERIFIED' && (!previous?.verification||previous.status!=='VERIFIED'||!revisionsEqual(previous.verification.source_revisions,sourceRevisions(state,'review'))))throw Error('ISSUE_RECHECK_REQUIRED');
    if(previous && (previous.severity==='CRITICAL'||previous.severity==='MAJOR') && !['CRITICAL','MAJOR'].includes(issue.severity))throw Error('ISSUE_SEVERITY_DOWNGRADE');
  }
}
export function updateIssueRegistry(state:any,report:any) {
  state.issue_registry ||= {};
  for(const issue of report.issues || []) {
    const previous=state.issue_registry[issue.issue_id];
    Object.defineProperty(state.issue_registry,issue.issue_id,{enumerable:true,configurable:true,writable:true,value:{...structuredClone(issue),reported_source_revisions:previous?.reported_source_revisions || sourceRevisions(state,'review'),first_seen_revision:previous?.first_seen_revision || state.revision,last_report_revision:state.revision,...(previous?.verification?{verification:previous.verification}:{})}});
  }
}
/** 复审登记：核对已保存的修复报告和精确版本；语义复审仍由Reviewer执行。 */
export function verifyIssue(state:any,id:string,evidence:any) {
  const issue=state.issue_registry?.[id];
  const review=state.artifacts.review;
  if(!issue||issue.status!=='RESOLVED'||!review||review.stale)throw Error('ISSUE_NOT_RESOLVED');
  if(!evidence || typeof evidence.evidence!=='string'||!evidence.evidence.trim()||evidence.review_revision!==review.revision||!revisionsEqual(evidence.source_revisions,sourceRevisions(state,'review')))throw Error('INVALID_RECHECK_EVIDENCE');
  issue.status='VERIFIED';
  issue.verification={evidence:evidence.evidence,review_revision:review.revision,source_revisions:sourceRevisions(state,'review'),verified_at:new Date().toISOString()};
  state.revision++;
  return issue;
}
