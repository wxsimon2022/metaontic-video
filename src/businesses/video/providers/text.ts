/** providers/text：写脚本用的文本模型。走与视频同一个中转站的 OpenAI 兼容 /v1/chat/completions，
 *  同一把 API密钥；只负责把一段想法写成剧本与分镜表，不参与视频/图片生成，也不代替分镜解析。 */
import { assertConfigured, resolveApiKey, resolveBaseUrl, resolveTextModel, textConfig } from './connection.js';
import { MAX_TOTAL_SECONDS } from '../config.js';

/** 一次写脚本最多等多久：文本模型比视频快，但中转站慢起来也得兜住。 */
const TEXT_TIMEOUT_MS = 120000;
const MAX_BRIEF_CHARS = 4000;

/** 去掉模型偶尔包上的整段代码块围栏，返回 Markdown 正文。 */
export function stripFence(text: any) {
  const raw = String(text ?? '').trim();
  const fenced = raw.match(/^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n?```$/);
  return (fenced ? fenced[1] : raw).trim();
}

/** 分镜表是解析分段的唯一依据，所以提示词把表头、列名与行数都写死。 */
export function scriptPrompt(brief: any) {
  const total = Number(brief?.totalSeconds) || 15, segments = Math.max(1, Number(brief?.segments) || 1);
  const segmentSeconds = Number(brief?.segmentSeconds) || 15;
  const ratio = String(brief?.ratio || '16:9');
  const idea = String(brief?.idea ?? '').trim().slice(0, MAX_BRIEF_CHARS);
  if (!idea) throw new Error('请先写下想拍什么，再让文本模型写脚本。');
  return [
    '你是短视频编剧兼分镜师。请把下面的想法写成一份可直接开拍的短片剧本（Markdown）。',
    '',
    `【想法】${idea}`,
    `【画幅】${ratio}`,
    `【总时长】${Math.min(total, MAX_TOTAL_SECONDS)} 秒，分成 ${segments} 段，每段 ${segmentSeconds} 秒`,
    '',
    '要求：',
    `1. 第一行是「# 」开头的片名，第二段用一句话写清主题与整体基调。`,
    `2. 必须输出一个 Markdown 分镜表，表头固定为 | 镜头 | 画面 | 时长 | 台词 |，分割行是 | --- | --- | --- | --- |。`,
    `3. 分镜表必须正好 ${segments} 行，每行对应一段：镜头列写序号，时长列写该段秒数（合计 ${Math.min(total, MAX_TOTAL_SECONDS)} 秒）。`,
    '4. 画面列写这一段要拍的画面：主体、动作、镜头运动、光线与氛围，一句话讲完，不要出现「同上」「承接上段」这类指代。',
    '5. 台词列没有对白就写「—」。',
    '6. 表后另起一节「## 制作说明」，用 2–4 条短句写清楚衔接、音乐与需要注意的细节。',
    '只输出这份 Markdown，不要解释、不要额外寒暄、不要用代码块包起来。',
  ].join('\n');
}

export function textEndpoint(config: any) {
  const base = resolveBaseUrl(config).replace(/\/+$/, '');
  return /\/v\d+$/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

/** 写脚本：返回 Markdown 剧本正文；失败时抛出可直接展示的原因，不伪造脚本。 */
export async function writeScript(config: any, brief: any, options: any = {}) {
  // 关了共用密钥时文本模型用自己那把：这里就决定密钥与地址，缺密钥直接停下来让用户补。
  const cfg = options.textConfig ? options.textConfig(config) : textConfig(config);
  const apiKey = resolveApiKey(cfg);
  assertConfigured(cfg, apiKey);
  const model = resolveTextModel(cfg);
  if (!model) throw new Error('请在设置页填写文本模型，再让文本模型写脚本。');
  const fetcher = options.fetcher || fetch;
  const signal = options.signal || AbortSignal.timeout(TEXT_TIMEOUT_MS);
  let response;
  try {
    response = await fetcher(textEndpoint(cfg), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.6, messages: [
        { role: 'system', content: '你只输出 Markdown 剧本正文，不解释过程，不使用代码块。' },
        { role: 'user', content: scriptPrompt(brief) },
      ] }),
      signal,
    });
  } catch (error: any) {
    throw new Error(`文本模型没有返回结果：${String(error?.message || '请求失败').slice(0, 120)}`);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.error) throw new Error(`文本模型调用失败：${String(body?.error?.message || body?.error || response.status).slice(0, 200)}`);
  const content = body?.choices?.[0]?.message?.content;
  const script = stripFence(Array.isArray(content) ? content.map((part: any) => part?.text || '').join('') : content);
  if (!script) throw new Error('文本模型返回了空脚本，请重试或换个文本模型。');
  return { script, model: String(body?.model || model), usage: { promptTokens: Number(body?.usage?.prompt_tokens) || 0, completionTokens: Number(body?.usage?.completion_tokens) || 0 } };
}
