import { CREATIVE_GUIDANCE } from '../../film-production/prompts/guidance.js';
import { writingProfileInstructions } from '../../film-production/profiles/index.js';
/** providers/text：写脚本用的文本模型。走与视频同一个中转站的 OpenAI 兼容 /v1/chat/completions，
 *  同一把 API密钥；只负责把一段想法写成剧本与分镜表，不参与视频/图片生成，也不代替分镜解析。 */
import { assertConfigured, resolveApiKey, resolveBaseUrl, resolveTextModel, textConfig } from './connection.js';
import { MAX_TOTAL_SECONDS } from '../config.js';

/** 一次写脚本最多等多久：文本模型比视频快，但中转站慢起来也得兜住。 */
export const TEXT_TIMEOUT_MS = 120000;
/** 两次增量之间的上限：真卡住时 30 秒就报错，不必干等到总上限；正常写脚本增量是连续的。 */
export const TEXT_IDLE_TIMEOUT_MS = 30000;
const MAX_BRIEF_CHARS = 4000;

/** 分镜表「视角」列的标准词表：按「这个视角要让观众感到什么」分组，每一行只选一个。 */
export const VIEW_ANGLES: Record<string, string> = {
  常规: '平视、俯视、仰视',
  主观代入: '第一人称主观（POV）、过肩、窥视（前景遮挡）',
  空间与几何: '低角度仰拍、高角度俯拍、荷兰角（倾斜）、纵深引导线',
  运动: '跟随、环绕、穿越',
  特殊表达: '镜像、微观特写、广角贴近',
};

/** 去掉模型偶尔包上的整段代码块围栏，返回 Markdown 正文。 */
export function stripFence(text: any) {
  const raw = String(text ?? '').trim();
  const fenced = raw.match(/^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n?```$/);
  return (fenced ? fenced[1] : raw).trim();
}

/** 分镜表是解析分段的唯一依据，所以提示词把表头、列名与行数都写死。
 *  画布上的「写脚本」不走技能文件，这一份就是它全部的创作口径，因此按专业导演来写：
 *  先给导演前置（观众与记忆点、情绪曲线、视觉母题、一条主线），再给可以直接开拍的硬要求。 */
export function scriptPrompt(brief: any) {
  const total = Number(brief?.totalSeconds) || 15, segments = Math.max(1, Number(brief?.segments) || 1);
  const segmentSeconds = Number(brief?.segmentSeconds) || 15;
  const ratio = String(brief?.ratio || '16:9');
  const idea = String(brief?.idea ?? '').trim().slice(0, MAX_BRIEF_CHARS);
  if (!idea) throw new Error('请先写下想拍什么，再让文本模型写脚本。');
  const seconds = Math.min(total, MAX_TOTAL_SECONDS);
  return [
    CREATIVE_GUIDANCE,
    writingProfileInstructions(brief?.work_type),
    '你负责把想法发展成完整故事与场景剧本，再整理为可执行的制作分镜（Markdown）。先讲清发生的事，摄影设计服务已经成立的内容。',
    '',
    `【想法】${idea}`,
    `【画幅】${ratio}`,
    `【总时长】${seconds} 秒，分成 ${segments} 段，每段 ${segmentSeconds} 秒`,
    '',
    '本入口只输出当前Markdown脚本，不调用film_project，不输出任务信封或假称文件已保存。下面的固定分镜表按实际生成段聚合，每行内可含多个叙事镜头；不把逐镜提示词要求误解为增加表格行或付费调用。',
    '导演前置（先想清楚，不要单独输出成章节）：',
    '- 观众与记忆点：这条片子给谁看，看完应该记住哪一个画面或哪一句话。',
    '- 情绪曲线：情绪怎么起、怎么推、落在哪儿，不要从头到尾一个音量。',
    '- 视觉母题：有没有能反复出现的东西（道具、颜色、光线、一个习惯动作）；有就用它把段落串起来，没有不要硬造。',
    '- 一条主线：只讲一件事，不塞支线和多余的说明。',
    '',
    '画面描述采用参考级细致程度：主体姿态/朝向与持物→主动作过程→环境或物体反馈→表情反应和结束状态，配合必要的光线、构图与声音。共同风格在开头统一，画面列保留本段具体细节；时间分配服务动作和停顿。',
    '内容先于技巧：每段画面列写出本段新事件/发现、人物反应和结束状态，前后具有因果或信息递进。不要把同一主体换景别反复展示当内容。表格格式与行数保持下面约定；段内变化在画面列写清。',
    '要求：',
    `1. 第一行是「# 」开头的片名，随后简洁写明「核心表达」「内容主线」「结尾变化」与整体基调，表达具体到本片的事件或观察，不仅是题材名称。`,
    `2. 先输出「## 故事与场景剧本」：按场次写地点与时间、完整动作过程、人物回应、原文对白和必要停顿；没有剧情时写观察过程及事实依据，不能用梗概替代完整正文。之后必须输出一个 Markdown 分镜表，表头固定为 | 镜号 | 镜别 | 视角 | 运镜 | 画面 | 时长 | 台词 |，分割行是 | --- | --- | --- | --- | --- | --- | --- |。`,
    `3. 分镜表必须正好 ${segments} 行，每行对应一段：镜号列从 1 顺写，时长列写该段秒数（合计 ${seconds} 秒）。`,
    '4. 镜别列只填一个标准景别词：远景、全景、中景、近景、特写或大特写。',
    `5. 视角列只填一个标准视角词：${Object.entries(VIEW_ANGLES).map(([group, words]) => `${group}用${words}`).join('；')}。`,
    '6. 视角由这一段的内容和场景决定，不要硬加：平视是默认，只有在能说清「这个视角让观众感到什么」（压迫、亲密、不安、自由或渺小）时才换；场景里没有相应条件就不写（封闭室内不写航拍、没有门缝窗框不写窥视、水下不写跟拍），也不为求变化硬换视角、堆叠互不相容的组合（例如第一人称主观配环绕）。',
    '7. 运镜列写这一段镜头怎么动：固定镜头，或推、拉、摇、移、跟、升降、环绕中的一种，并注明方向与速度，例如「缓慢推近」「平稳右摇」；运镜服从这一段要表达的情绪，不要每段都用同一种。一行就是一次生成，所以运镜列只写这一段的主运动，段内的小变化写进画面列。',
    '8. 画面列是这一段要拍的详情，写全：主体与 2–3 个稳定特征、正在做的动作及起止状态、所处环境与背景道具、光线方向与色调、整体氛围、前后景层次；用「先…随后…最后…」把这一段里看得见的推进写完整（一段要切镜或改变景别就在这里写清楚），不用「同上」「承接上段」这类指代、不写成同一件事的重复描述。',
    '9. 每段必须推进一件事、提供新证据或带来细节发现；不机械规定切镜次数、相邻景别变化或声音层数。固定机位、一镜到底和必要留白可以成立；不得用重复的微笑、远眺、风景或摄影术语填时长。',
    '10. 台词列写这一段实际说出的原话并标明说话人；没有对白就写「—」。台词要像这个人会说的话，每句只表达一个意思、接得上前一句或上一个动作，一句完整说完；按每秒 3–4 字估时长，留出开口前的反应、句内停顿和收尾；不写口号、解释画面的独白和重复信息。',
    '11. 表演与情绪：画面里写清人物当下想要什么、什么态度，以及眼神、手、呼吸、姿态上的具体反应；情绪靠动作和反应演出来，不用旁白或字幕替观众解释。',
    '12. 声音必须和画面一起设计：写清同期声、环境声与动作音效，并说明要不要音乐；声音层次按内容需要选择，留出安静的留白，不用音乐从头铺到尾。',
    '13. 开场和结尾都要具体：开场用具体动作、反常细节或动作中途切入，不用「某人正在某地做某事」的平铺；结尾用看得见的反应或变化收束，不用旁白总结、不硬塞金句。',
    '14. 每个单元格只占一行，不要换行，列之间用半角竖线分隔。',
    '15. 表后另起一节「## 制作说明」，用 2–4 条短句写清楚段与段之间怎么接、声音与音乐怎么走、拍摄上最需要注意的是哪一点。',
    '16. 不要写：抽象空词（「高级感」「氛围感」这类没法执行的形容）、场景条件不具备的镜头、互不相容的组合、只换景别而没有新事件、信息或细节；也不要虚构价格、销量、评价或用户没给的任何数据。',
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
  return Math.min(16000, 4000 + count * 1000);
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
