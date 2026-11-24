import { diagnosticError } from '../../shared/utils/timing.js';

/** 业务只传固定分类和计量；关联值仅在 reporter 内参与设备隔离散列。 */
export function reportOutcome(exec: any, name: string, fields: any, key = '') {
  try { exec?.metaonticAnalytics?.record(name, {
    tool: exec?.name, mode: exec?.metaonticMode, ...fields,
  }, key); } catch { /* 统计不能改变创作结果 */ }
}

export function outcomeError(error: any) {
  try { return error?.code === 'FFMPEG_MISSING' ? 'missing_dependency' : diagnosticError(error).errorCategory; }
  catch { return 'other'; }
}

/** read/status/next 不算完成创作；审批必须有真实批准结果。 */
export function toolOutcome(tool: string, args: any, result?: any, error?: any) {
  let stage: string, action: string;
  if (tool === 'film_project' && ['submit', 'approve', 'independent_review'].includes(args?.action)) {
    stage = args.action === 'independent_review' ? 'review' : args.stage;
    action = args.action;
    if (!['creative', 'script', 'assets', 'shots', 'prompts', 'review'].includes(stage)) return null;
  } else if (tool === 'video_script') { stage = 'script'; action = 'create'; }
  else if (tool === 'video_project' && ['review', 'review_segment'].includes(args?.action)) { stage = 'review'; action = 'approve'; }
  else if (['video_generate', 'video_extend'].includes(tool) && args?.resume) { stage = 'resume'; action = 'resume'; }
  else if (tool === 'video_status') { stage = 'retrieve'; action = 'retrieve'; }
  else return null;
  let status = 'unknown';
  if (error) status = error?.code === 'ABORTED' ? 'cancelled' : 'failed';
  else if (result) {
    if (tool === 'film_project' && action === 'approve') {
      status = result.approvals?.[stage] != null ? 'approved'
        : result.status === 'STOPPED' ? 'cancelled' : String(result.status || '').endsWith('_REVISE') ? 'draft' : 'pending';
    } else if (tool === 'video_script') status = result.truncated ? 'pending' : result.script ? 'succeeded' : 'unknown';
    else if (result.deliveryError || result.ffmpegMissing) status = 'failed';
    else if (result.paused) status = 'paused';
    else if (['succeeded', 'failed', 'cancelled', 'unknown', 'timeout', 'approved', 'pending', 'draft', 'blocked', 'review_required'].includes(result.status)) status = result.status;
    else if (tool === 'film_project' && action === 'submit') status = result.artifacts?.[stage] || result.artifact_summary?.[stage] ? 'succeeded' : 'unknown';
  }
  return { stage, action, status, errorCategory: error ? outcomeError(error) : undefined,
    flowKey: args?.projectId || result?.project_id || result?.projectId || args?.resume || undefined };
}
