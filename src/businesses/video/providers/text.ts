/** providers/text：写脚本用的文本模型。走与视频同一个中转站的 OpenAI 兼容 /v1/chat/completions，
 *  同一把 API密钥；只负责把一段想法写成剧本与分镜表，不参与视频/图片生成，也不代替分镜解析。 */
import { assertConfigured, resolveApiKey, resolveBaseUrl, resolveTextModel, textConfig } from './connection.js';
import { MAX_TOTAL_SECONDS } from '../config.js';

/** 一次写脚本最多等多久：文本模型比视频快，但中转站慢起来也得兜住。 */
export const TEXT_TIMEOUT_MS = 120000;
/** 两次增量之间的上限：真卡住时 30 秒就报错，不必干等到总上限；正常写脚本增量是连续的。 */
export const TEXT_IDLE_TIMEOUT_MS = 30000;
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
    `2. 必须输出一个 Markdown 分镜表，表头固定为 | 镜号 | 镜别 | 运镜 | 画面 | 时长 | 台词 |，分割行是 | --- | --- | --- | --- | --- | --- |。`,
    `3. 分镜表必须正好 ${segments} 行，每行对应一段：镜号列从 1 顺写，时长列写该段秒数（合计 ${Math.min(total, MAX_TOTAL_SECONDS)} 秒）。`,
    '4. 镜别列只填一个标准景别词：远景、全景、中景、近景、特写或大特写。',
    '5. 运镜列写清这一段镜头怎么动：固定镜头，或推、拉、摇、移、跟、升降、环绕中的一种，并注明方向与速度，例如「缓慢推近」「平稳右摇」。',
    '6. 画面列是这一段要拍的详情，写全：主体与 2–3 个稳定特征、正在做的动作及起止状态、所处环境与背景道具、光线方向与色调、整体氛围；一句话写完整，不用「同上」「承接上段」这类指代。',
    '7. 台词列写这一段实际说出的原话并标明说话人；没有对白就写「—」。',
    '8. 每个单元格只占一行，不要换行，列之间用半角竖线分隔。',
    '9. 表后另起一节「## 制作说明」，用 2–4 条短句写清楚衔接、音乐与需要注意的细节。',
    '只输出这份 Markdown，不要解释、不要额外寒暄、不要用代码块包起来。',
  ].join('\n');
}

export function textEndpoint(config: any) {
  const base = resolveBaseUrl(config).replace(/\/+$/, '');
  return /\/v\d+$/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

/** 输出上限：分镜表按段展开，段数越多正文越长；给足空间又封顶，避免跑飞与长时间空转。 */
export function textMaxTokens(segments: any) {
  const count = Math.max(1, Math.min(60, Number(segments) || 1));
  return Math.min(8000, 1600 + count * 800);
}

function tokenUsage(usage: any) {
  return { promptTokens: Number(usage?.prompt_tokens) || 0, completionTokens: Number(usage?.completion_tokens) || 0 };
}

function contentOf(message: any) {
  const content = message?.content;
  return Array.isArray(content) ? content.map((part: any) => part?.text || '').join('') : String(content ?? '');
}

/** 流式收口：SSE 增量边收边拼，顺手攒 usage、结束原因与上游错误。
 *  每收到一段就重置「卡住」计时器，所以连接假死能在 idle 上限内报错，而不是等满总超时。 */
async function readStream(response: any, bump: any, onProgress: any) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', content = '', usage: any = null, model = '', truncated = false, failure = '', chunks = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bump();
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, cut).replace(/\r$/, ''); buffer = buffer.slice(cut + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let part: any = null;
      try { part = JSON.parse(payload); } catch { continue; }
      if (part?.error) { failure = String(part.error?.message || part.error); continue; }
      if (part?.model) model = String(part.model);
      if (part?.usage) usage = tokenUsage(part.usage);
      const choice = part?.choices?.[0];
      const piece = contentOf({ content: choice?.delta?.content ?? choice?.message?.content });
      if (piece) { content += piece; chunks += 1; }
      if (choice?.finish_reason === 'length') truncated = true;
    }
    if (chunks) onProgress?.({ characters: content.length, chunks });
  }
  return { content, usage, model, truncated, failure };
}

/** 写脚本：返回 Markdown 剧本正文；失败时抛出可直接展示的原因，不伪造脚本。
 *  默认走流式：能报进度、能快速发现卡死、也能拿到真实结束原因（被输出上限截断时回报 truncated）。 */
export async function writeScript(config: any, brief: any, options: any = {}) {
  // 关了共用密钥时文本模型用自己那把：这里就决定密钥与地址，缺密钥直接停下来让用户补。
  const cfg = options.textConfig ? options.textConfig(config) : textConfig(config);
  const apiKey = resolveApiKey(cfg);
  assertConfigured(cfg, apiKey);
  const model = resolveTextModel(cfg);
  if (!model) throw new Error('请在设置页填写文本模型，再让文本模型写脚本。');
  const fetcher = options.fetcher || fetch;
  const idleMs = Number(options.idleTimeoutMs) > 0 ? Number(options.idleTimeoutMs) : TEXT_IDLE_TIMEOUT_MS;
  const idleSeconds = Math.max(1, Math.round(idleMs / 1000));
  const controller = new AbortController();
  const outer = options.signal || AbortSignal.timeout(TEXT_TIMEOUT_MS);
  let idleAborted = false;
  let timer: any = null;
  const bump = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { idleAborted = true; controller.abort(new Error(`文本模型 ${idleSeconds} 秒没有输出`)); }, idleMs);
  };
  const relay = () => { try { controller.abort(outer.reason); } catch { /* 外层已经中止，保持原样 */ } };
  if (outer.aborted) relay(); else outer.addEventListener?.('abort', relay, { once: true });
  const stop = () => { if (timer) clearTimeout(timer); outer.removeEventListener?.('abort', relay); };
  const stream = options.stream !== false;
  bump();
  let response;
  try {
    response = await fetcher(textEndpoint(cfg), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.6, max_tokens: textMaxTokens(brief?.segments),
        ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}), messages: [
        { role: 'system', content: '你只输出 Markdown 剧本正文，不解释过程，不使用代码块。' },
        { role: 'user', content: scriptPrompt(brief) },
      ] }),
      signal: controller.signal,
    });
  } catch (error: any) {
    stop();
    if (idleAborted) throw new Error(`文本模型 ${idleSeconds} 秒没有输出，已中止本次写脚本：可以重试，或在设置页换一个文本模型。`);
    throw new Error(`文本模型没有返回结果：${String(error?.message || '请求失败').slice(0, 120)}`);
  }
  const type = String(response.headers?.get?.('content-type') || '');
  const incremental = Boolean(stream && response.body && typeof response.body.getReader === 'function' && (!type || type.includes('event-stream')));
  let content = '', usage: any = null, spoken = '', truncated = false;
  try {
    if (incremental) {
      const read = await readStream(response, bump, options.onProgress);
      if (read.failure) throw new Error(`文本模型调用失败：${read.failure.slice(0, 200)}`);
      if (!response.ok) throw new Error(`文本模型调用失败：${response.status}`);
      content = read.content; usage = read.usage; spoken = read.model; truncated = read.truncated;
    } else {
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.error) throw new Error(`文本模型调用失败：${String(body?.error?.message || body?.error || response.status).slice(0, 200)}`);
      content = contentOf(body?.choices?.[0]?.message); usage = body?.usage ? tokenUsage(body.usage) : null;
      spoken = String(body?.model || ''); truncated = body?.choices?.[0]?.finish_reason === 'length';
    }
  } catch (error: any) {
    if (idleAborted) throw new Error(`文本模型 ${idleSeconds} 秒没有输出，已中止本次写脚本：可以重试，或在设置页换一个文本模型。`);
    const message = String(error?.message || '请求失败');
    throw new Error(message.startsWith('文本模型') ? message : `文本模型写脚本失败：${message.slice(0, 160)}`);
  } finally { stop(); }
  const script = stripFence(content);
  if (!script) throw new Error('文本模型返回了空脚本，请重试或换个文本模型。');
  return { script, model: spoken || model, usage: usage || { promptTokens: 0, completionTokens: 0 }, truncated, characters: script.length };
}
