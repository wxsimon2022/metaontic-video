/** 中转站异步图片协议：提交 → 轮询 → 取件，不使用同步备选。 */
import { ref, FAILED_STATES, SUCCESS_STATES } from '../config.js';
import { resolveBaseUrl } from './connection.js';
import { relayRequest, sleep } from './transport.js';

export async function generateSeedreamImage(config, body, signal, existingTaskId?: string) {
  // 视频配置通常保存站址；也兼容用户保存了以 /v1 结尾的地址。
  const prefix = /\/v1$/i.test(resolveBaseUrl(config)) ? '' : '/v1';
  let taskId = String(existingTaskId || '').trim();
  if (!taskId) {
    const submitted = await relayRequest(config, `${prefix}/tasks/doubao`, { method: 'POST', body, signal });
    taskId = String(submitted?.task_id || submitted?.id || '').trim();
    if (!taskId) throw new Error('图片提交响应缺少 task_id，无法确认是否创建成功；请检查调用记录，不要重复提交。');
  }
  const taskPath = `${prefix}/tasks/${encodeURIComponent(taskId)}`;
  const timeoutMs = Math.max(1000, Number(ref(config, 'imageMaxWaitMs', 300000)) || 300000);
  const deadline = Date.now() + timeoutMs;
  const budgetSignal = AbortSignal.timeout(timeoutMs);
  const waitSignal = signal ? AbortSignal.any([signal, budgetSignal]) : budgetSignal;
  try {
    for (;;) {
      const task = await relayRequest(config, taskPath, { signal: waitSignal });
      const status = String(task?.status || '').toLowerCase();
      if (FAILED_STATES.has(status)) {
        throw Object.assign(new Error(`图片生成失败：${task?.fail_reason || task?.error?.message || status}`), { terminal: true });
      }
      if (SUCCESS_STATES.has(status)) break;
      if (Date.now() >= deadline) throw new Error('图片生成等待超时');
      await sleep(Math.min(3000, deadline - Date.now()), waitSignal);
    }
    const result = await relayRequest(config, `${taskPath}/artifacts`, { signal: waitSignal });
    const item = (result?.artifacts || []).find((item) => /image/i.test(String(item?.type || '')) && /^https?:\/\//i.test(String(item?.content_url || '')));
    if (!item) throw new Error('任务已完成但没有可用图片产物');
    return { imageUrl: String(item.content_url), taskId };
  } catch (error) {
    throw Object.assign(new Error(`${error?.message || error}（图片 task_id=${taskId}）。${error?.terminal ? '任务已失败，未重试。' : '已停止等待，不重复提交；可用 video_prepare_image 的 taskId 查询此图片任务。'}`), { taskId, code: error?.code || 'image_task_error' });
  }
}
