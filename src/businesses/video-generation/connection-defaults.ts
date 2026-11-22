/** 保存端与运行端共用的非敏感连接默认值：具体写死值统一放在 src/shared/constants/plugin.ts。 */
import {
  IMAGE_MODEL,
  RELAY,
  RETIRED_IMAGE_MODELS,
  RETIRED_TEXT_MODELS,
  TEXT_MODEL,
  TEXT_MODELS,
  VIDEO_MODEL,
  VOLCENGINE,
} from '../../shared/constants/plugin.js';

export { IMAGE_MODEL, RETIRED_IMAGE_MODELS, RETIRED_TEXT_MODELS, TEXT_MODEL, TEXT_MODELS };

export const METAONTIC_BASE_URL = RELAY.baseUrl;

/**
 * C 火山引擎直连方式开关。
 *
 * true：设置页正常提供该方式；false（当前）时只在设置页隐藏：下拉里选不到它，
 * 已经有该配置的安装继续按原值调用，不会被静默换成别的渠道，也不会丢 API密钥。
 * 恢复时把这一行改回 true，并把 settings.ts 的 SELECTS 候选一起补齐即可。
 */
export const VOLCENGINE_MODE_AVAILABLE = VOLCENGINE.modeAvailable;

/**
 * 图片（Seedream）模型：5.0 的旧型号已下线，当前只在售 pro 版（见 hardcoded-config）。
 *
 * 旧配置里存着下线型号时，读取（保存端与运行端）就归一到在售型号：下线型号上游不再接受，
 * 保持原值只会让图片任务直接失败。归一只改生效值，不写回磁盘，用户不动它也不会丢配置。
 */

/**
 * 文本模型（写脚本、分镜与逐段提示词）：与视频模型同一中转站、同一个 API密钥，按 /v1/chat/completions 调用。
 *
 * 设置页先提供离线默认候选，验证连接后再合并中转站返回的完整模型清单。
 * 这里给出默认值与旧型号归一：留空、或存着已下线型号时按默认值生效，避免提交已下线型号。
 */
export function resolveImageModel(value) {
  const model = String(value ?? '').trim();
  if (!model || RETIRED_IMAGE_MODELS.includes(model)) return IMAGE_MODEL;
  return model;
}
export function normalizeTextModel(value) {
  const model = String(value ?? '').trim();
  if (!model || RETIRED_TEXT_MODELS.includes(model)) return TEXT_MODEL;
  return model;
}

/** /v1/models 会返回令牌可见的多模态型号；文本选择器排除视频、图片及非对话专用型号。 */
export function isTextModelCandidate(value) {
  const model = String(value ?? '').trim();
  if (!model) return false;
  return !/(seedance|seedream|(?:^|[-_.\s])(?:video|image|veo|sora|kling|runway|vidu|wanx?|t2v|i2v|embedding|rerank|tts|asr|speech|music)(?:$|[-_.\s]))/i.test(model);
}

export function connectionDefaults(values) {
  const text = (key, fallback) => String(values[key] ?? '').trim() || fallback;
  const volc = values.connectionMode === 'volcengine';
  return {
    ...(volc ? { baseUrl: VOLCENGINE.baseUrl }
      : { baseUrl: text('baseUrl', METAONTIC_BASE_URL).replace(/\/+$/, '') }),
    submitPath: volc ? VOLCENGINE.submitPath : text('submitPath', RELAY.submitPath),
    queryPath: volc ? VOLCENGINE.queryPath : text('queryPath', RELAY.queryPath),
    model: text('model', VIDEO_MODEL),
    imageModel: resolveImageModel(text('imageModel', IMAGE_MODEL)),
    textModel: normalizeTextModel(text('textModel', TEXT_MODEL)),
    imageUseVideoKey: values.imageUseVideoKey !== false,
  };
}
