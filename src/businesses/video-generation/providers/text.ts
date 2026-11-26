import { writingProfileInstructions } from '../../film-production/profiles/index.js';
import { SCRIPT_GENERATION_GUIDANCE } from '../prompts/script-generation.js';
/** providers/text：写脚本用的文本模型。走与视频同一个中转站的 OpenAI 兼容 /v1/chat/completions，
 *  同一把 API密钥；只负责把一段想法写成剧本与分镜表，不参与视频/图片生成，也不代替分镜解析。 */
import { assertConfigured, resolveApiKey, resolveBaseUrl, resolveTextModel, textConfig } from './connection.js';
import { MAX_SEGMENTS, MAX_TOTAL_SECONDS } from '../config.js';

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

/** 按作品时长组装专用写作规则，避免重复加载整套多角色指导。 */
export function scriptPrompt(brief: any) {
  const total = Number(brief?.totalSeconds) || 15, segments = Math.max(1, Number(brief?.segments) || 1);
  const segmentSeconds = Number(brief?.segmentSeconds) || 15;
  const ratio = String(brief?.ratio || '16:9');
  const idea = String(brief?.idea ?? '').trim().slice(0, MAX_BRIEF_CHARS);
  if (!idea) throw new Error('请先写下想拍什么，再让文本模型写脚本。');
  const seconds = Math.min(total, MAX_TOTAL_SECONDS);
  const durationPlan = seconds <= 15
    ? '聚焦一个核心事件和一个情绪落点，不加支线。'
    : seconds <= 60
      ? '围绕一条主线递进；每段带来新信息、行动或观察，不为段数强行换地点。'
      : '按章节和场次推进；每章有独立进展，跟踪人物、道具、时间和未解决事项，不重复事件填时长。';
  return [
    SCRIPT_GENERATION_GUIDANCE,
    writingProfileInstructions(brief?.work_type),
    '本入口只输出完整 Markdown 剧本与制作分镜；不调用 film_project，不输出 JSON、任务信封或“文件已保存”等声明。',
    `【想法】${idea}`,
    `【画幅】${ratio}`,
    `【时长】${seconds} 秒；${segments} 段，每段约 ${segmentSeconds} 秒。${durationPlan}`,
    '',
    '先简要列出片名、核心表达、内容主线、结尾变化和整体基调，不展示内部推演。随后输出「## 故事与场景剧本」，按场次写地点/时间、人物行动、反馈、反应、结果、对白和必要停顿。观察或知识内容须注明事实依据或待核实项。',
    `随后输出固定表头的 Markdown 分镜表：| 镜号 | 镜别 | 视角 | 运镜 | 画面 | 时长 | 台词 |。分隔行为 | --- | --- | --- | --- | --- | --- | --- |。必须恰好 ${segments} 行，每行对应一个生成段；镜号从1递增，时长合计 ${seconds} 秒。段内可有多个叙事镜头，不因切镜增加生成段。`,
    `景别每格只选远景、全景、中景、近景、特写或大特写之一；视角只选平视、俯视、仰视、主观、过肩、窥视、低角度、高角度、荷兰角、纵深、跟随、环绕、穿越、镜像、微观或广角贴近之一。默认平视和固定机位，仅在有表达理由时变化；不组合互斥视角或添加不存在的机位条件。`,
    '画面写清主体与必要稳定特征、位置/朝向/持物、动作起点→过程→环境或道具反馈→结束状态，以及必要的光线、构图和声音。用“先、随后、最后”说明段内推进；不写“同上”，不堆形容词，不重复展示同一信息。',
    '台词写原话并标明说话人；无对白写“—”。对白自然、完整，不解释画面。预算包括发声、停顿、动作与反应；音画并行不重复计时。环境声、动作声和音乐按需安排，不默认铺满配乐。',
    '开头尽快建立具体动作、问题或观察；结尾以结果、反应或前文细节回收。表后写「## 制作说明」，用2–4条短句交代段间衔接、声音连续性和主要制作风险。',
    '交稿前检查主题是否能从事件看出、每段是否有新内容、动作和对白是否放得进时长、剧本与分镜是否一致、总时长是否闭合。若长度超出本次输出能力，保持故事完整并提示分章续写，不用重复内容填充。',
    '只输出 Markdown，不解释过程、不寒暄、不用代码块包裹。',
  ].join('\n');
}

export function textEndpoint(config: any) {
  const base = resolveBaseUrl(config).replace(/\/+$/, '');
  return /\/v\d+$/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
}

/** 输出上限：分镜表按段展开，段数越多正文越长；给足空间又封顶，避免跑飞与长时间空转。 */
export function textMaxTokens(segments: any, modelProfile?: any) {
  const count = Math.max(1, Math.min(MAX_SEGMENTS, Number(segments) || 1));
  const planned = Math.min(16000, 4000 + count * 1000);
  const modelLimit = Number(modelProfile?.max_output_tokens ?? modelProfile?.maxOutputTokens);
  return Number.isFinite(modelLimit) && modelLimit > 0 ? Math.min(planned, Math.floor(modelLimit)) : planned;
}

function tokenUsage(usage: any) {
  return { promptTokens: Number(usage?.prompt_tokens) || 0, completionTokens: Number(usage?.completion_tokens) || 0 };
}

function contentOf(message: any) {
  const content = message?.content;
  return Array.isArray(content) ? content.map((part: any) => part?.text || '').join('') : String(content ?? '');
}

/** DeepSeek 可切换思考的型号直接请求正文，避免默认推理占满输出预算。未知模型不附加专有参数。 */
export function textGenerationPolicy(model:string) {
  return /(?:^|\/)deepseek[\s_-]*(?:v4(?:\.\d+)?(?:[\s_-]*(?:flash|pro))?|flash|chat)$/i.test(model.trim())
    ? { thinking: { type: 'disabled' } } : {};
}

/** 流式收口：SSE 增量边收边拼，顺手攒 usage、结束原因与上游错误。
 *  每收到一段就重置「卡住」计时器，所以连接假死能在 idle 上限内报错，而不是等满总超时。 */
async function readStream(response: any, bump: any, onProgress: any) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', content = '', usage: any = null, model = '', truncated = false, failure = '', chunks = 0;
  let reasoningOnly = false, finishReason = '';
  const accept = (line:string) => {
    if (!line.startsWith('data:')) return;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') return;
    let part: any;
    try { part = JSON.parse(payload); } catch { return; }
    if (part?.error) { failure = String(part.error?.message || part.error); return; }
    if (part?.model) model = String(part.model);
    if (part?.usage) usage = tokenUsage(part.usage);
    const choice = part?.choices?.[0];
    const message = choice?.delta || choice?.message;
    const piece = contentOf({content:choice?.delta?.content ?? choice?.message?.content});
    if (piece) { content += piece; chunks += 1; }
    if (message?.reasoning_content || message?.reasoning) reasoningOnly = true;
    if (choice?.finish_reason) finishReason = String(choice.finish_reason);
    if (finishReason === 'length') truncated = true;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bump();
      buffer += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buffer.indexOf('\n')) >= 0) {
        accept(buffer.slice(0, cut).replace(/\r$/, '')); buffer = buffer.slice(cut + 1);
      }
      if (chunks) onProgress?.({ characters: content.length, chunks });
    }
    // Some compatible relays close the final data line without a newline.
    buffer += decoder.decode();
    if (buffer.trim()) accept(buffer.replace(/\r$/, ''));
  } finally { reader.releaseLock(); }
  return { content, usage, model, truncated, failure, reasoningOnly, finishReason };
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
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : TEXT_TIMEOUT_MS;
  const timeoutSeconds = Math.max(1, Math.round(timeoutMs / 1000));
  const controller = new AbortController();
  const timeout = AbortSignal.timeout(timeoutMs);
  const outer = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
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
      body: JSON.stringify({ model, temperature: 0.6, ...textGenerationPolicy(model), max_tokens: (() => {
        const requested = options.taskMaxTokens ? Math.min(16000, Math.max(1000, options.taskMaxTokens)) : textMaxTokens(brief?.segments);
        const modelLimit = Number(options.modelProfile?.max_output_tokens ?? options.modelProfile?.maxOutputTokens);
        return Number.isFinite(modelLimit) && modelLimit > 0 ? Math.min(requested, Math.floor(modelLimit)) : requested;
      })(),
        ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}), messages: options.taskMessages || [
        { role: 'system', content: '你只输出 Markdown 剧本正文，不解释过程，不使用代码块。' },
        { role: 'user', content: scriptPrompt(brief) },
      ] }),
      signal: controller.signal,
    });
  } catch (error: any) {
    stop();
    if (idleAborted) throw new Error(`文本模型 ${idleSeconds} 秒没有输出，已中止本次写脚本：可以重试，或在设置页换一个文本模型。`);
    if (options.signal?.aborted) throw new Error('文本模型调用已取消。');
    if (timeout.aborted) throw new Error(`文本模型 ${timeoutSeconds} 秒内没有完成，已中止本次请求：可以重试，或在设置页换一个文本模型。`);
    throw new Error(`文本模型没有返回结果：${String(error?.message || '请求失败').slice(0, 120)}`);
  }
  const type = String(response.headers?.get?.('content-type') || '');
  const incremental = Boolean(stream && response.body && typeof response.body.getReader === 'function' && (!type || type.includes('event-stream')));
  let content = '', usage: any = null, spoken = '', truncated = false, reasoningOnly = false, finishReason = '';
  try {
    if (incremental) {
      const read = await readStream(response, bump, options.onProgress);
      if (read.failure) throw new Error(`文本模型调用失败：${read.failure.slice(0, 200)}`);
      if (!response.ok) throw new Error(`文本模型调用失败：${response.status}`);
      content = read.content; usage = read.usage; spoken = read.model; truncated = read.truncated; reasoningOnly = read.reasoningOnly; finishReason = read.finishReason;
    } else {
      const body = await response.json().catch(() => null);
      if (!response.ok || body?.error) throw new Error(`文本模型调用失败：${String(body?.error?.message || body?.error || response.status).slice(0, 200)}`);
      content = contentOf(body?.choices?.[0]?.message); usage = body?.usage ? tokenUsage(body.usage) : null;
      spoken = String(body?.model || ''); finishReason = String(body?.choices?.[0]?.finish_reason || ''); truncated = finishReason === 'length';
      reasoningOnly = !!(body?.choices?.[0]?.message?.reasoning_content || body?.choices?.[0]?.message?.reasoning);
    }
  } catch (error: any) {
    if (idleAborted) throw new Error(`文本模型 ${idleSeconds} 秒没有输出，已中止本次写脚本：可以重试，或在设置页换一个文本模型。`);
    if (options.signal?.aborted) throw new Error('文本模型调用已取消。');
    if (timeout.aborted) throw new Error(`文本模型 ${timeoutSeconds} 秒内没有完成，已中止本次请求：可以重试，或在设置页换一个文本模型。`);
    const message = String(error?.message || '请求失败');
    throw new Error(message.startsWith('文本模型') ? message : `文本模型写脚本失败：${message.slice(0, 160)}`);
  } finally { stop(); }
  const script = stripFence(content);
  if (!script) {
    const reason = finishReason === 'content_filter' ? '正文被上游内容策略拦截'
      : truncated ? '已达到输出上限，但尚未返回正文'
      : reasoningOnly ? '只返回了推理过程，没有返回正文' : '未返回可用正文';
    throw new Error(`文本模型${reason}（空脚本）。本次未取得可用文本，已有项目与稿件保持不变。请检查文本模型的输出上限及渠道响应；需要时重新请求，不自动切换模型或重复调用。`);
  }
  return { script, model: spoken || model, usage: usage || { promptTokens: 0, completionTokens: 0 }, truncated, characters: script.length };
}
