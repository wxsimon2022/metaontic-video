import { snapshotConfig, resolveTextApiKey, resolveTextModel } from '../providers/connection.js';
import { writeScript } from '../providers/text.js';
import { MAX_TOTAL_SECONDS, MIN_SECONDS } from '../config.js';
import { clampInteger } from '../../../shared/utils/validation.js';
import { appendRequestLog } from '../../../shared/utils/logging.js';
import { diagnosticError } from '../../../shared/utils/timing.js';

/** 使用插件设置的文本模型生成脚本；文本调用按渠道实际用量计费，不单独弹费用审批。 */
export function scriptTool(config: any) {
  return {
    name: 'video_script',
    description: '调用插件设置页选定的文本模型生成视频脚本与分镜草稿，不弹文本调用审批；普通对话仍由当前会话模型处理。按文本模型渠道实际用量计费。只生成草稿，不代表脚本已审核或允许生成视频。',
    parameters: { type: 'object', properties: {
      idea: { type: 'string', minLength: 1, maxLength: 4000, description: '用户确认后的创意与约束' },
      totalSeconds: { type: 'integer', minimum: MIN_SECONDS, maximum: MAX_TOTAL_SECONDS },
      segmentSeconds: { type: 'integer', minimum: 4, maximum: 30 },
      ratio: { type: 'string', enum: ['16:9', '9:16'] },
      workType: { type: 'string', description: '已解析的作品类型/创作 profile 标识' },
    }, required: ['idea', 'totalSeconds', 'ratio'] },
    output: {
      schema: { type: 'object' },
      render(_args: any, value: any) {
        const header = [`文本模型：${String(value?.model || '未注明')}`, `目标时长：${Number(value?.totalSeconds) || 0} 秒`];
        if (value?.truncated === true) header.push('警告：模型输出可能被截断，请先检查并补齐脚本。');
        return [{ type: 'text', text: `${header.join('\n')}\n\n${String(value?.script || '')}` }];
      },
    },
    isConcurrencySafe() { return false; },
    async execute(args: any, exec: any) {
      const live = snapshotConfig(config);
      const model = resolveTextModel(live);
      if (!resolveTextApiKey(live)) throw new Error('插件设置里的文本模型 API密钥未配置，请先到设置页填写并保存。');
      const totalSeconds = clampInteger(args.totalSeconds, MIN_SECONDS, MAX_TOTAL_SECONDS, 0);
      if (totalSeconds < MIN_SECONDS) throw new Error(`视频时长须为${MIN_SECONDS}–${MAX_TOTAL_SECONDS}秒整数。`);
      if (!['16:9', '9:16'].includes(args.ratio)) throw new Error('画幅仅支持16:9或9:16。');
      const segmentSeconds = clampInteger(args.segmentSeconds, 4, 30, 15);
      const startedAt = Date.now();
      try {
        const result = await writeScript(live, {
          idea: args.idea,
          totalSeconds,
          segmentSeconds,
          segments: Math.max(1, Math.ceil(totalSeconds / segmentSeconds)),
          ratio: args.ratio,
          ...(args.workType ? { work_type: args.workType } : {}),
        }, { signal: exec?.signal });
        await appendRequestLog({ event: 'text_model_done', action: 'conversation_script', model: result.model || model,
          elapsedMs: Date.now() - startedAt, characters: result.characters, truncated: result.truncated === true }).catch(() => {});
        return { script: result.script, model: result.model || model, usage: result.usage,
          totalSeconds, segmentSeconds, segments: Math.max(1, Math.ceil(totalSeconds / segmentSeconds)), truncated: result.truncated === true };
      } catch (error) {
        await appendRequestLog({ event: 'text_model_failed', action: 'conversation_script', model,
          elapsedMs: Date.now() - startedAt, ...diagnosticError(error) }).catch(() => {});
        throw error;
      }
    },
  };
}
