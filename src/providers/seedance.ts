/** providers/seedance：从宿主入口拆出的独立职责模块。 */
import { resolveModel, parseExtraParams, isOmniExtendModel, isVolcengine } from './connection.js';
import { clampInteger } from '../utils/validation.js';
import { MIN_SEGMENT_SECONDS, ref, FIXED_RESOLUTION } from '../config.js';
import { modelMaxSeconds } from '../workflow/planning.js';
import { buildExtensionPrompt, buildGenerationPrompt } from '../prompts/generation.js';
import { validateImageRoles, canvasSize, resolveImageInput } from '../media/references.js';
import { type TaskResult } from './types.js';
import { createTask, waitForCompletion } from './transport.js';
import { extractTaskId } from './response.js';
import { appendRequestLog } from '../utils/logging.js';

/** 中转站要能直接拉取参考视频，本地路径与内网地址没有意义。 */
export function normalizeReferenceUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) throw new Error('参考视频 URL 不能为空。');
  if (/^asset:\/\/[A-Za-z0-9_-]+$/.test(url)) return url;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('参考视频必须是 https:// 或 http:// 开头的公网 URL（不能用本地文件路径）。');
  }
  return url;
}

export function buildRequestBody(config, args, referenceVideoUrl) {
  const model = resolveModel(config);
  const seconds = clampInteger(
    args.duration,
    MIN_SEGMENT_SECONDS,
    modelMaxSeconds(config),
    modelMaxSeconds(config),
  );
  const mode = args.mode || ref(config, 'mode', 'continuous');
  const prompt = String(args.prompt ?? '').trim();
  const startAt = args.startAt == null ? null : Math.max(0, Math.round(Number(args.startAt)));
  const direction = args.direction === 'forward' ? 'forward' : 'backward';
  const wording = args.wording === 'after' ? 'after' : 'extend';

  const content = [
    { type: 'text', text: buildExtensionPrompt({ prompt, seconds, startAt, mode, direction, wording }) },
    { type: 'video_url', video_url: { url: referenceVideoUrl }, role: 'reference_video' },
  ];

  const body = { ...parseExtraParams(config) };
  body.model = model;
  body.content = content;
  body.duration = seconds;
  body.ratio = args.ratio || ref(config, 'ratio', 'adaptive');

  body.resolution = FIXED_RESOLUTION;

  const generateAudio = args.generateAudio ?? ref(config, 'generateAudio', true);
  if (typeof generateAudio === 'boolean') body.generate_audio = generateAudio;

  const watermark = args.watermark ?? ref(config, 'watermark', false);
  if (typeof watermark === 'boolean') body.watermark = watermark;

  if (args.user) body.safety_identifier = String(args.user);
  if (typeof args.returnLastFrame === 'boolean') body.return_last_frame = args.returnLastFrame;
  if (args.seed != null && Number.isFinite(Number(args.seed))) body.seed = Number(args.seed);

  if (isOmniExtendModel(model)) {
    body.ratio = 'adaptive';
    body.omni_reference_task_type = 'extend';
  }
  return { body, seconds };
}

export async function buildGenerationBody(config, args, seconds, options: { signal?: AbortSignal } = {}) {
  const { refs } = validateImageRoles(args, resolveModel(config));
  const prompt = String(args.prompt ?? '').trim();
  const ratio = args.ratio || ref(config, 'ratio', 'adaptive');
  const canvas = canvasSize(ratio);
  const fit = canvas ? { size: canvas, config, signal: options.signal } : null;

  // 文本项 + 可选图片，形状由上游决定，这里只保证顺序与字段名
  const content: Array<Record<string, unknown>> = [
    { type: 'text', text: buildGenerationPrompt({ prompt, seconds, model: resolveModel(config) }) },
  ];
  const images = [];
  const notes: string[] = [];

  const addImage = async (value, role, label) => {
    const resolved = isVolcengine(config) && /^asset:\/\//.test(String(value))
      ? { url: String(value), source: 'asset' }
      : await resolveImageInput(value, label, fit);
    content.push({
      type: 'image_url',
      image_url: { url: resolved.url },
      role,
    });
    images.push({ role, ...resolved });
  };

  const firstFrame = String(args.firstFrameUrl ?? '').trim();
  if (firstFrame) await addImage(firstFrame, 'first_frame', '首帧图');

  const lastFrame = String(args.lastFrameUrl ?? '').trim();
  if (lastFrame) await addImage(lastFrame, 'last_frame', '尾帧图');

  // 一至多张参考图都显式标记角色，不按数量猜首尾帧、不截断或重排。
  for (const [index, reference] of refs.entries()) {
    await addImage(reference.trim(), 'reference_image', `参考图 ${index + 1}`);
  }

  const body = { ...parseExtraParams(config) };
  body.model = resolveModel(config);
  body.content = content;
  body.duration = seconds;
  body.ratio = isOmniExtendModel(body.model) && content.some((item) => item.role === 'first_frame' || item.role === 'last_frame') ? 'adaptive' : ratio;

  body.resolution = FIXED_RESOLUTION;

  const generateAudio = args.generateAudio ?? ref(config, 'generateAudio', true);
  if (typeof generateAudio === 'boolean') body.generate_audio = generateAudio;

  const watermark = args.watermark ?? ref(config, 'watermark', false);
  if (typeof watermark === 'boolean') body.watermark = watermark;

  if (args.user) body.safety_identifier = String(args.user);
  if (typeof args.returnLastFrame === 'boolean') body.return_last_frame = args.returnLastFrame;
  if (args.seed != null && Number.isFinite(Number(args.seed))) body.seed = Number(args.seed);

  return { body, seconds, images, notes };
}

/** 创建任务并等到结束；超时、取消、失败都归一化成同一形状。 */
export async function runTask(config, body, signal): Promise<TaskResult> {
  const created = await createTask(config, body, signal);
  const taskId = extractTaskId(created);
  await appendRequestLog({ event: 'task_created', taskId, model: body?.model, duration: body?.duration });
  if (!taskId) throw new Error('创建任务失败：响应中缺少任务 ID。');
  try {
    const final = await waitForCompletion(config, taskId, signal);
    await appendRequestLog({ event: 'task_finished', taskId, status: final.status, errorCode: final.errorCode });
    return { ...final, taskId };
  } catch (failure) {
    if (failure?.code === 'ABORTED') throw failure;
    // 任务已经建好，这里只说明「查询没拿到结果」，不能说成「这一段没生成」：
    // 标成 unknown 并保留 taskId，让结果能引导用 video_status 事后补拉。
    return {
      taskId,
      status: 'unknown',
      errorCode: failure?.code || 'provider_poll_error',
      error: `任务已提交（${taskId}），但查询状态失败：${failure?.message || String(failure)}。`
        + '任务可能仍在生成，可用 video_status 按这个 ID 再查，不要重复提交。',
    };
  }
}
