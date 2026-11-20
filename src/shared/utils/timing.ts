/** 阶段计时只写固定字段，不记录输入、响应正文或错误消息。 */
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { appendRequestLog, requestLogContext } from './logging.js';

/** 仅从固定错误码/类型归类，不记录 error.message 或请求内容。 */
export function diagnosticError(error) {
  const message = String(error?.message || '');
  const raw = typeof error?.code === 'string' ? error.code : message.split(':')[0];
  const known = /^(?:provider_[a-z_]+|INVALID_[A-Z_]+|[A-Z_]+_CONFLICT|ABORTED|EACCES|EPERM|ENOSPC|ENOENT|ETIMEDOUT|ECONNRESET|resume_locked|submission_unknown|MODEL_NOT_FOUND|CONFIG_MISSING|TIMEOUT)$/;
  const inferred = /model not found|unknown model|模型不存在/i.test(message) ? 'MODEL_NOT_FOUND' : /未配置|请.*填写.*(?:模型|密钥)|关闭模型共用/.test(message) ? 'CONFIG_MISSING' : /没有输出|timeout|timed out/i.test(message) ? 'TIMEOUT' : '';
  const errorCode = known.test(raw) ? raw : inferred || (error?.name === 'AbortError' ? 'ABORTED' : error?.name === 'SyntaxError' ? 'INVALID_JSON' : 'INTERNAL_ERROR');
  const errorCategory = /ABORT/.test(errorCode) ? 'cancelled' : /auth/.test(errorCode) ? 'authentication' : /network|TIMEOUT|TIMEDOUT|CONN/.test(errorCode) ? 'network' : /INVALID|CONFIG_MISSING|Syntax/.test(errorCode) ? 'validation' : /CONFLICT|locked/.test(errorCode) ? 'conflict' : /provider_|MODEL_NOT_FOUND/.test(errorCode) ? 'provider' : /EACCES|EPERM|ENOSPC|ENOENT/.test(errorCode) ? 'filesystem' : 'internal';
  return { errorCode, errorCategory };
}

export async function timedStage<T = any>(stage: string, operation: () => T | Promise<T>): Promise<T> {
  const spanId = randomUUID();
  const startedAt = new Date().toISOString();
  const start = performance.now();
  await appendRequestLog({ event: 'stage_started', stage, spanId, startedAt });
  let outcome = 'error';
  let failure = {};
  try {
    const result = await requestLogContext.run({ ...requestLogContext.getStore(), parentSpanId: spanId }, operation);
    const metadata = result as any;
    outcome = ['failed', 'unknown', 'timeout', 'cancelled', 'pending', 'review_required', 'blocked', 'submission_unknown', 'partial', 'paused'].includes(metadata?.status) ? metadata.status : 'success';
    if (metadata?.errorCode) failure = diagnosticError({code:metadata.errorCode});
    else if (['blocked','review_required'].includes(outcome)) failure = {errorCategory:'approval'};
    return result;
  } catch (error) {
    failure = diagnosticError(error);
    outcome = error?.name === 'AbortError' || error?.code === 'ABORTED' ? 'cancelled' : 'error';
    throw error;
  } finally {
    await appendRequestLog({ event: 'stage_finished', stage, spanId, startedAt,
      finishedAt: new Date().toISOString(), elapsedMs: Math.round((performance.now() - start) * 1000) / 1000, outcome, ...failure });
  }
}

export function withStageTiming(tool) {
  return { ...tool, async execute(args, exec) {
    const context = { ...requestLogContext.getStore(), callId: exec?.callId || requestLogContext.getStore()?.callId || randomUUID(), tool: tool.name,
      sessionId: exec?.agent?.session?.id, projectId: args?.projectId, taskId: args?.taskId, index: args?.index };
    return requestLogContext.run(context, () => timedStage(`tool:${tool.name}`, () => tool.execute(args, exec)));
  } };
}
