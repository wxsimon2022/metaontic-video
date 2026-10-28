/**
 * MetaOnticVideo —— Seedance 短视频生成 + 视频延长（向后续拍）Host plugin.
 *
 * 注册的工具：
 *   - `video_generate`  生成一段完整视频：总时长不超过单段上限（默认 15 秒）时直接生成；
 *                       更长时先直出首段，再逐段延长，最后用 ffmpeg 合并成一个本地成片
 *   - `video_extend`    以一段公网视频为输入素材，向前或向后延长指定秒数；可一次连续延长多段
 *   - `video_status`    按任务 ID 查询任务的状态
 *   - `video_config`    读取/写回本插件自己的配置（走宿主的 settings 服务，
 *                             写进 profile 的 cordis.patch.yml；配置字段都是 .volatile()，
 *                             宿主重载后立即生效，不必手改 YAML）
 *
 * 接口与火山方舟 contents-generation 任务一致，既可直接用官方地址，也可走 New API 中转站：
 *   POST {baseUrl}{submitPath}
 *   GET  {baseUrl}{queryPath}
 * 只走 New API 中转站（火山官方接口已移除）：baseUrl 填中转站站址，路径按中转站的模型分流走。
 *
 * 请求体沿用火山方舟 contents-generation 的原生延长语义：
 *   - 提示词以「向后延长视频1」/「向前延长视频1」开头，用「视频1」指代输入素材，
 *     并写清延长方向、剧情发展、主体状态、镜头运动、声音延续
 *   - content 传入 {"type":"video_url","video_url":{"url":...},"role":"reference_video"}
 *   - seedance 2.5 追加 ratio=adaptive 与 omni_reference_task_type=extend
 *
 * 响应解析兼容中转站：状态别名（success/completed…）、任务 ID 字段（id/task_id/taskId）、
 * 深层取件（data.content.video_url），并跳过 cover/首尾帧等图片字段。
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import z from '@deepseek-ai/schemastery';

export const inject = ['tools'];

export const Config = z.object({
  entryId: z.string()
    .default('metaontic-video')
    .description('本插件在 profile patch 里的条目 id；配置工具用它把改动写回')
    .volatile(),
  apiKey: z.string()
    .default('')
    .description('API Key；留空时读环境变量 NEWAPI_API_KEY（也可以直接用设置页的「注册」按钮领一把）')
    .volatile(),
  baseUrl: z.string()
    .default('')
    .description(
      '基础地址（中转站站址）；留空时读环境变量 NEWAPI_VIDEO_BASE_URL / NEWAPI_BASE_URL。'
      + '示例 https://ai.bileego.com（不要带 /v1，也不要重复 /api/v3）',
    )
    .volatile(),
  submitPath: z.string()
    .default('')
    .description('创建任务路径；留空用中转站默认值 /doubao/api/v3/contents/generations/tasks')
    .volatile(),
  queryPath: z.string()
    .default('')
    .description('查询任务路径，{task_id} 会被任务 ID 替换；留空用中转站默认值')
    .volatile(),
  model: z.string()
    .default('')
    .description('支持视频延长的模型 ID（seedance 2.0 / 2.5 系列）；留空读 NEWAPI_VIDEO_MODEL 或内置默认值')
    .volatile(),
  registerUser: z.string()
    .default('')
    .description('（已废弃）历史上注册时填的用户名；现在领 Key 用邮箱验证码，见 registerEmail')
    .volatile(),
  registerEmail: z.string()
    .default('')
    .description('领 Key 用的邮箱（账号）：中转站里的密钥名由服务端生成唯一串，与这个邮箱绑定')
    .volatile(),
  registerToken: z.string()
    .default('metaontic-video-register-v1')
    .description('注册请求头 X-Register-Token 的值，要与服务端 REGISTER_CLIENT_TOKEN 一致；页面不显示')
    .volatile(),
  duration: z.number().step(1).min(4).max(15)
    .default(5)
    .description(
      '每段延长出来的秒数（不含视频1本身），4-15 的整数，例如 5/8/10/14；'
      + '建议 ≤14，刚好卡 15 秒容易因封装略超被上游拒绝',
    )
    .volatile(),
  singleMaxSeconds: z.number().step(1).min(4).max(15)
    .default(15)
    .description('单次直出上限：不超过它就一次生成，超过它就先直出这一段再逐段延长（4-15）')
    .volatile(),
  mergeMode: z.union(['copy', 'reencode'])
    .default('copy')
    .description('合并方式：copy=先无损拼接（参数不一致时自动回退重编码）；reencode=统一重编码')
    .volatile(),
  outputDir: z.string()
    .default('')
    .description('成片输出目录；留空用会话工作目录下的 metaontic-video/')
    .volatile(),
  keepSegments: z.boolean()
    .default(false)
    .description('合并后是否保留分段原片')
    .volatile(),
  ffmpegBinary: z.string()
    .default('ffmpeg')
    .description('ffmpeg 可执行文件；PATH 里没有时填绝对路径')
    .volatile(),
  ffprobeBinary: z.string()
    .default('ffprobe')
    .description('ffprobe 可执行文件；PATH 里没有时填绝对路径')
    .volatile(),
  mode: z.union(['continuous', 'closeup'])
    .default('continuous')
    .description('continuous=同机位连续续拍；closeup=在台词结束处切近景续拍')
    .volatile(),
  resolution: z.union(['480p', '720p', '1080p'])
    .default('720p')
    .description('分辨率')
    .volatile(),
  ratio: z.union(['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'])
    .default('adaptive')
    .description('画面比例；seedance 2.5 延长时固定改用 adaptive')
    .volatile(),
  generateAudio: z.boolean()
    .default(true)
    .description('是否生成音频')
    .volatile(),
  watermark: z.boolean()
    .default(false)
    .description('是否添加水印；部分中转站只接受 true')
    .volatile(),
  extraParams: z.string()
    .default('')
    .description('JSON 对象字符串，合并进请求体，用于中转站的特有字段')
    .volatile(),
  pollIntervalMs: z.natural().min(1000)
    .default(5000)
    .description('轮询任务状态的间隔（毫秒）')
    .volatile(),
  maxWaitMs: z.natural().min(1000)
    .default(600000)
    .description('单次调用最长等待时间（毫秒）')
    .volatile(),
});

const DEFAULT_MODEL = 'doubao-seedance-2-0-mini-260615';
const MAX_SEGMENTS = 10;
const MIN_SECONDS = 4;
const MIN_SEGMENT_SECONDS = 4;
/** 单段延长（续拍）的秒数上限：Seedance 原生延长只接受 4-15 秒。 */
const MAX_SEGMENT_SECONDS = 15;
/** Seedance 单段最长 15 秒：不超过它一次直出，超过它才需要延长。 */
const MAX_DIRECT_SECONDS = 15;
/** 输出目录的默认子目录名。 */
const DEFAULT_OUTPUT_DIR = 'metaontic-video';
/** 判断「上游返回的是累计成片」的容差：累计时长的 25%，且至少 1.5 秒。 */
const CUMULATIVE_TOLERANCE_RATIO = 0.25;
const CUMULATIVE_TOLERANCE_MIN_SECONDS = 1.5;

/** provider 预设：字段留空时按这里的顺序回退到环境变量，再回退到预设默认值。 */
const RELAY_PRESET = {
    baseUrl: '',
    submitPath: '/doubao/api/v3/contents/generations/tasks',
    queryPath: '/doubao/api/v3/contents/generations/tasks/{task_id}',
    model: DEFAULT_MODEL,
    keyEnv: ['NEWAPI_API_KEY'],
    baseEnv: ['NEWAPI_VIDEO_BASE_URL', 'NEWAPI_BASE_URL'],
  modelEnv: ['NEWAPI_VIDEO_MODEL'],
};

const SUCCESS_STATES = new Set(['succeeded', 'success', 'completed', 'complete', 'done', 'finished']);
const FAILED_STATES = new Set(['failed', 'failure', 'error', 'cancelled', 'canceled']);
const CANCEL_STATES = new Set(['cancelled', 'canceled']);

const QUOTA_HINTS = ['quota', 'insufficient', 'balance', '预扣费', '剩余额度'];
const PRICE_HINTS = ['model_price_error', '阶梯计价', 'u("input_images")'];
const CONTENT_HINTS = [
  'real person', 'privacyinformation', 'privacy information', 'content policy',
  'content_policy', 'contentpolicy', 'content safety', 'safety policy',
  'sensitive', '违规', '敏感', '涉政',
];

const VIDEO_URL_KEYS = [
  'video_url', 'videourl', 'download_url', 'play_url', 'result_url', 'output_url',
];
const GENERIC_URL_KEYS = new Set(['url', 'output', 'video', 'file']);
const IMAGE_KEY_TOKENS = ['cover', 'image', 'thumb', 'poster', 'frame', 'snapshot', 'preview'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'];

const CONTINUOUS_TRANSITION =
  '本段第一帧必须紧接视频1最后一帧，保持同一构图、人物大小、左右位置、'
  + '头部朝向、视线、手部位置和动作阶段。动作保持原有方向和速度，'
  + '不重复前段动作、不定格等待、不从画面另一侧重新入场；不擅自切镜或重新居中。';

const FORWARD_TRANSITION =
  '向前延长时，本段最后一帧必须紧接视频1第一帧，保持同一构图、人物大小、左右位置、'
  + '头部朝向、视线、手部位置和动作阶段。动作朝向视频1的开场动作发展，'
  + '不重复前段动作、不定格等待、不从画面另一侧重新入场；不擅自切镜或重新居中。';

const CLOSEUP_TRANSITION =
  '镜头衔接建议（仅在本段未明确指定运镜或切镜安排时采用）：在完整台词结束处自然切到'
  + '下一位说话人的近景或听话人的反应近景，再继续本段剧情。保持轴线、视线方向、'
  + '左右人物关系、服装和音色，不交换角色；只改变景别，不新增场景。';

const CONTENT_REJECTION_HINT =
  '参考视频被上游内容审核拒绝，延长已停止。Seedance 含人脸续拍需使用同一上游账号的'
  + '受信原始视频或授权素材；请确认中转站透传了原始 video_url 与 reference_video，'
  + '且前后请求使用同一上游账号。不会自动去掉参考视频生成，以免人物不一致。';

/**
 * 读取一个配置字段。`.volatile()` 声明的字段由宿主包装成引用（`.get()` 取快照，
 * 改动后无需重启即可生效），未声明的普通配置是普通值；两种形态都能读。
 */
function ref(config, key, fallback) {
  const raw = config?.[key];
  const value = raw && typeof raw.get === 'function' ? raw.get() : raw;
  return value === undefined || value === null || value === '' ? fallback : value;
}

function relayPreset() {
  // 只走 New API 中转站（火山官方已移除），路径/模型都取这一份预设。
  return RELAY_PRESET;
}

function envValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function resolveApiKey(config) {
  return String(ref(config, 'apiKey', '')).trim() || envValue(relayPreset().keyEnv);
}

function resolveBaseUrl(config) {
  const preset = relayPreset();
  return (String(ref(config, 'baseUrl', '')).trim() || envValue(preset.baseEnv) || preset.baseUrl)
    .replace(/\/+$/, '');
}

function resolveSubmitPath(config) {
  return String(ref(config, 'submitPath', '')).trim() || relayPreset().submitPath;
}

function resolveQueryPath(config, taskId) {
  const path = String(ref(config, 'queryPath', '')).trim() || relayPreset().queryPath;
  return path.replace('{task_id}', encodeURIComponent(taskId));
}

function resolveModel(config) {
  const preset = relayPreset();
  return String(ref(config, 'model', '')).trim() || envValue(preset.modelEnv) || preset.model;
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

/** seedance 2.5 的延长走 omni 参考模式，需要固定 ratio 与任务类型。 */
function isOmniExtendModel(model) {
  const lowered = String(model).toLowerCase();
  return lowered.includes('seedance-2-5') || lowered.includes('seedance-2.5');
}

function parseExtraParams(config) {
  const raw = String(ref(config, 'extraParams', '')).trim();
  if (!raw) return {};
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('配置 extraParams 不是合法 JSON 对象字符串。');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('配置 extraParams 必须是 JSON 对象。');
  }
  return value;
}

function assertConfigured(config, apiKey) {
  if (!apiKey) {
    throw new Error(
      '未配置 API Key：请在插件设置页点「激活」领一把，或在插件 config 里填 apiKey，'
      + '或设置环境变量 NEWAPI_API_KEY。',
    );
  }
  if (!resolveBaseUrl(config)) {
    throw new Error(
      '未配置 baseUrl：用中转站时填中转站地址（如 https://ai.bileego.com），'
      + '或设置环境变量 NEWAPI_VIDEO_BASE_URL / NEWAPI_BASE_URL。',
    );
  }
}

/**
 * 延长提示词。开头用「向后延长视频1」/「向前延长视频1」这类显式说法，
 * 并用「视频1」指代输入素材——写成「参考视频1」容易被上游当成「参考生视频」而不是延长。
 * 正文分五块写清，减少衔接断层：延长方向、剧情发展、主体状态、镜头运动、声音延续。
 */
function buildExtensionPrompt({
  prompt, seconds, startAt, mode, direction = 'backward', wording = 'extend',
}) {
  const forward = direction === 'forward';
  const head = forward
    ? '向前延长视频1。'
    : (wording === 'after' ? '生成视频1之后的内容：' : '向后延长视频1。');
  const span = forward
    ? (startAt == null
      ? `生成 ${seconds} 秒前置画面，接在视频1第一帧之前。`
      : `生成 ${seconds} 秒前置画面，对应整片第 ${Math.max(0, startAt - seconds)}–${startAt} 秒，紧接在视频1之前。`)
    : (startAt == null
      ? `生成 ${seconds} 秒续拍画面，接在视频1最后一帧之后。`
      : `生成 ${seconds} 秒续拍画面，对应整片第 ${startAt}–${startAt + seconds} 秒，接在视频1之后。`);
  const transition = forward
    ? FORWARD_TRANSITION
    : (mode === 'closeup' ? CLOSEUP_TRANSITION : CONTINUOUS_TRANSITION);
  return [
    `${head}${span}`,
    `【延长方向】${forward ? '向前延长（前置剧情，放在视频1之前）' : '向后延长（续拍剧情，接在视频1之后）'}。`,
    `【剧情发展】${endWithPunctuation(prompt)}${forward
      ? '只演视频1之前发生的前置剧情，不复述视频1里的情节。'
      : '只演视频1之后发生的新剧情，不重复视频1里的情节、不重新开场。'}`,
    '【主体状态】' + (forward
      ? '本段收尾的人物面貌、体型、服装、姿态、手部位置和动作阶段必须能直接接到视频1第一帧；'
      : '沿用视频1结尾的人物面貌、体型、服装、姿态、手部位置和动作阶段；')
      + '同一角色保持音色、口音、语速和当前情绪，不换人、不换装，不改变年龄与外貌特征。',
    '【镜头运动】保持视频1' + (forward ? '开头的' : '结尾的')
      + '机位、景别、焦段、运镜方向与速度，锁定曝光、白平衡、光源方向和背景布局，'
      + '不渐暗渐亮、不改变景深、不重建背景。',
    '【声音延续】保持对白、环境声与背景音乐连续，每句台词完整说完，不添加片头片尾、不复述已说台词。',
    transition,
    '本段明确指定的运镜和切镜优先，上面的衔接建议不得覆盖已确认的镜头安排。',
  ].join('\n');
}

/** 中转站要能直接拉取参考视频，本地路径与内网地址没有意义。 */
function normalizeReferenceUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) throw new Error('参考视频 URL 不能为空。');
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('参考视频必须是 https:// 或 http:// 开头的公网 URL（不能用本地文件路径）。');
  }
  return url;
}

function buildRequestBody(config, args, referenceVideoUrl) {
  const model = resolveModel(config);
  const seconds = clampInteger(
    args.duration,
    MIN_SEGMENT_SECONDS,
    MAX_SEGMENT_SECONDS,
    ref(config, 'duration', 5),
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

  const resolution = args.resolution ?? ref(config, 'resolution', '720p');
  if (resolution) body.resolution = resolution;

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

/* ---------------- 时长规划：不超上限就直出，超过就延长 ---------------- */

/** 单次直出上限；Seedance 单段最长 15 秒，所以配置只在 4-15 之间生效。 */
function resolveSingleMax(config) {
  return clampInteger(
    ref(config, 'singleMaxSeconds', MAX_DIRECT_SECONDS),
    MIN_SECONDS,
    MAX_DIRECT_SECONDS,
    MAX_DIRECT_SECONDS,
  );
}

/** 每次延长出来的秒数（不含视频1本身）：4-15 的整数，实际使用建议 ≤14。 */
function resolveSegmentSeconds(config, requested) {
  const fallback = ref(config, 'duration', 5);
  return clampInteger(requested ?? fallback, MIN_SEGMENT_SECONDS, MAX_SEGMENT_SECONDS, fallback);
}

/**
 * 把目标总时长拆成执行计划：
 * 不超过单段上限 → **只生成一段**（这是硬规则：≤ 单段上限的视频禁止拆分）；超过 → 先直出上限长度，
 * 再按每段秒数延长，最多 MAX_SEGMENTS 段（那是同一条视频的续拍段，不是多镜拼接）。
 */
function planVideoSegments(totalSeconds, singleMax, segmentSeconds) {
  // ≤ 单段上限：一次直出，绝不拆段（回归测试见 tests/：15 → '15'）
  if (totalSeconds <= singleMax) return [{ kind: 'generate', seconds: totalSeconds }];

  // 尾段不足最小分段秒数（4 秒）时先把首段缩短一点，避免拆出 1-3 秒的非法分段。
  let base = singleMax;
  let remaining = totalSeconds - base;
  if (remaining < MIN_SEGMENT_SECONDS) {
    const trimmed = MIN_SEGMENT_SECONDS - remaining;
    if (base - trimmed >= MIN_SEGMENT_SECONDS) {
      base -= trimmed;
      remaining = totalSeconds - base;
    }
  }

  // 剩余时长按段数尽量均分（25 秒、每段上限 14 秒 → 15+10，而不是 15+5+5）。
  const slots = MAX_SEGMENTS - 1;
  const count = Math.min(slots, Math.max(1, Math.ceil(remaining / segmentSeconds)));
  const sizes = [];
  let left = remaining;
  for (let index = count; index > 0 && left > 0; index -= 1) {
    let size = Math.min(segmentSeconds, Math.ceil(left / index));
    if (size < MIN_SEGMENT_SECONDS) size = Math.min(segmentSeconds, MIN_SEGMENT_SECONDS);
    sizes.push(size);
    left -= size;
  }

  const plan = [{ kind: 'generate', seconds: base }];
  for (const seconds of sizes) {
    if (plan.length >= MAX_SEGMENTS) break;
    plan.push({ kind: 'extend', seconds });
  }
  return plan;
}

/** 直出用的提示词：和延长不同，这里不引用任何参考视频。 */
function buildGenerationPrompt({ prompt, seconds }) {
  return (
    `生成 ${seconds} 秒视频。${prompt}`
    + '保持人物面貌、体型、服装和音色一致，场景光线、色调与镜头运动连贯；'
    + '每句台词完整说完，环境声与背景音乐连续；'
    + '不要片头片尾、不要字幕、不要水印，不从画面外侧重新入场。'
  );
}

/** 把用户给的剧情描述接成完整句子时补个句号，避免两句粘在一起。 */
function endWithPunctuation(text) {
  const value = String(text ?? '').trim();
  if (!value) return '';
  return /[。．.!！?？;；~～:：,，]$/.test(value) ? value : `${value}。`;
}

function normalizeImageUrl(value, label) {
  const url = String(value ?? '').trim();
  if (!url) throw new Error(`${label} 不能为空。`);
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`${label} 必须是 https:// 或 http:// 开头的公网 URL（不能用本地文件路径）。`);
  }
  return url;
}

/** 直出请求体：文本 + 可选首帧/尾帧图，沿用火山 contents-generation 的原生格式。 */
function buildGenerationBody(config, args, seconds) {
  const prompt = String(args.prompt ?? '').trim();
  const content = [{ type: 'text', text: buildGenerationPrompt({ prompt, seconds }) }];

  const firstFrame = String(args.firstFrameUrl ?? '').trim();
  if (firstFrame) {
    content.push({
      type: 'image_url',
      image_url: { url: normalizeImageUrl(firstFrame, '首帧图 URL') },
      role: 'first_frame',
    });
  }
  const lastFrame = String(args.lastFrameUrl ?? '').trim();
  if (lastFrame) {
    content.push({
      type: 'image_url',
      image_url: { url: normalizeImageUrl(lastFrame, '尾帧图 URL') },
      role: 'last_frame',
    });
  }

  const body = { ...parseExtraParams(config) };
  body.model = resolveModel(config);
  body.content = content;
  body.duration = seconds;
  body.ratio = args.ratio || ref(config, 'ratio', 'adaptive');

  const resolution = args.resolution ?? ref(config, 'resolution', '720p');
  if (resolution) body.resolution = resolution;

  const generateAudio = args.generateAudio ?? ref(config, 'generateAudio', true);
  if (typeof generateAudio === 'boolean') body.generate_audio = generateAudio;

  const watermark = args.watermark ?? ref(config, 'watermark', false);
  if (typeof watermark === 'boolean') body.watermark = watermark;

  if (args.user) body.safety_identifier = String(args.user);
  if (typeof args.returnLastFrame === 'boolean') body.return_last_frame = args.returnLastFrame;
  if (args.seed != null && Number.isFinite(Number(args.seed))) body.seed = Number(args.seed);

  return { body, seconds };
}

/** 创建任务并等到结束；超时、取消、失败都归一化成同一形状。 */
async function runTask(config, body, signal) {
  const created = await createTask(config, body);
  const taskId = extractTaskId(created);
  if (!taskId) throw new Error('创建任务失败：响应中缺少任务 ID。');
  try {
    const final = await waitForCompletion(config, taskId, signal);
    return { ...final, taskId };
  } catch (failure) {
    if (failure?.code === 'ABORTED') throw failure;
    if (failure?.code && failure.code !== 'provider_failed') {
      return { taskId, status: 'failed', error: failure.message, errorCode: failure.code };
    }
    return { taskId, status: 'failed', error: failure?.message || String(failure) };
  }
}

/* ---------------- 分段下载与 ffmpeg 合并 ---------------- */

function resolveBinary(config, key, fallback) {
  return String(ref(config, key, '')).trim() || fallback;
}

function formatSeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? '');
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function fileStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * 宿主要求工具返回值是「无损 JSON」：只要出现 undefined、NaN/Infinity/-0、
 * 非纯对象（Error/Date 实例等）或循环引用，整条结果就会被丢弃并报
 * 「value is not lossless JSON」。这里统一清洗成严格 JSON。
 */
function toJsonSafe(value, seen = new Set()) {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') {
    return Number.isFinite(value) && !Object.is(value, -0) ? value : String(value);
  }
  if (type === 'bigint') return value.toString();
  if (type === 'undefined' || type === 'function' || type === 'symbol') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return value.message ? `${value.name}: ${value.message}` : value.name;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return Array.from(value, (item) => toJsonSafe(item, seen) ?? null);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return String(value);
    const plain = {};
    for (const [key, item] of Object.entries(value)) {
      const safe = toJsonSafe(item, seen);
      if (safe !== undefined) plain[key] = safe;
    }
    return plain;
  } finally {
    seen.delete(value);
  }
}

/** 把工具 execute 的返回值清洗成宿主接受的无损 JSON，避免整条结果被丢弃。 */
function jsonSafeTool(tool) {
  return {
    ...tool,
    async execute(...args) {
      return toJsonSafe(await tool.execute(...args));
    },
  };
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** 跑一个子进程并收全输出；找不到可执行文件时归一化成 ffmpeg_missing。 */
async function runProcess(binary, args, { signal, timeoutMs = 1800000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      reject(Object.assign(new Error(`${binary} 无法启动：${error?.message || error}`), {
        code: 'ffmpeg_missing',
      }));
      return;
    }

    let stdout = '';
    let stderr = '';
    let done = false;

    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    function settle(error, value) {
      if (done) return;
      done = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    }
    function onAbort() {
      child.kill('SIGKILL');
      settle(abortError());
    }

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      settle(Object.assign(new Error(`${binary} 执行超时。`), { code: 'ffmpeg_timeout' }));
    }, timeoutMs);

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    child.on('error', (error) => settle(Object.assign(
      new Error(`${binary} 无法启动：${error.message}`),
      { code: error.code === 'ENOENT' ? 'ffmpeg_missing' : 'ffmpeg_failed' },
    )));
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => settle(null, { code, stdout, stderr }));
  });
}

/** 探测分段的时长/尺寸；ffprobe 缺失或失败都返回 null，不影响主流程。 */
async function probeMedia(file, config, signal) {
  try {
    const { code, stdout } = await runProcess(resolveBinary(config, 'ffprobeBinary', 'ffprobe'), [
      '-v', 'error',
      '-show_entries', 'format=duration:stream=codec_type,width,height,r_frame_rate,duration',
      '-of', 'json',
      file,
    ], { signal, timeoutMs: 60000 });
    if (code !== 0) return null;
    const parsed = JSON.parse(stdout);
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
    const video = streams.find((stream) => stream.codec_type === 'video') || {};
    const audio = streams.find((stream) => stream.codec_type === 'audio') || {};
    const [num, den] = String(video.r_frame_rate || '').split('/').map(Number);
    const duration = Number(parsed?.format?.duration);
    const videoDuration = Number(video.duration);
    const audioDuration = Number(audio.duration);
    return {
      durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : 0,
      videoDurationSeconds: Number.isFinite(videoDuration) && videoDuration > 0 ? videoDuration : 0,
      audioDurationSeconds: Number.isFinite(audioDuration) && audioDuration > 0 ? audioDuration : 0,
      width: Number(video.width) || 0,
      height: Number(video.height) || 0,
      fps: Number.isFinite(num) && Number.isFinite(den) && den > 0 ? num / den : 0,
      hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
    };
  } catch {
    return null;
  }
}

async function downloadFile(url, destPath, { signal } = {}) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw Object.assign(new Error(`下载分段失败（HTTP ${response.status}）：${url}`), {
      code: 'download_failed',
    });
  }
  if (!response.body) {
    throw Object.assign(new Error(`下载分段失败：响应没有内容（${url}）。`), {
      code: 'download_failed',
    });
  }
  await mkdir(path.dirname(destPath), { recursive: true });
  const partial = `${destPath}.part`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  await rename(partial, destPath);
  return destPath;
}

function evenNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  const rounded = Math.round(number);
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

/**
 * 把分段合并成一个文件：先试无损拼接，需要时统一重编码（带音频，失败再退回只并视频）。
 */
/** 分段的音频比视频长出这么多帧时，认为封装补白会在接缝处留下空洞。 */
const AUDIO_PADDING_TOLERANCE_FRAMES = 1;

/**
 * 上游分段的音频常比视频长几十毫秒（封装补白）：concat 会按容器时长偏移，
 * 接缝处就留下 1-2 帧没有画面的空洞（看起来「缺了一小段」），重编码路径还会让音画逐段错位。
 * 这里把「非末段」的音频裁到与视频等长：视频轨保持 -c copy，只重编音频。
 * @returns 对齐后的文件列表、需要清理的临时文件、被裁齐的分段信息。
 */
async function alignSegmentAudio(config, files, probed, outPath, { signal, binary } = {}) {
  const temps = [];
  const trimmed = [];
  const aligned = [];
  for (const [index, file] of files.entries()) {
    const media = probed?.[index];
    const fps = Math.max(1, Math.round(media?.fps || 30));
    const videoSeconds = Number(media?.videoDurationSeconds) || 0;
    const audioSeconds = Number(media?.audioDurationSeconds) || 0;
    const padding = audioSeconds - videoSeconds;
    const isLast = index === files.length - 1;
    if (isLast || !media?.hasAudio || videoSeconds <= 0
      || padding <= AUDIO_PADDING_TOLERANCE_FRAMES / fps) {
      aligned.push(file);
      continue;
    }
    const temp = `${outPath}.align${index + 1}.mp4`;
    const { code } = await runProcess(
      binary || resolveBinary(config, 'ffmpegBinary', 'ffmpeg'),
      [
        '-y', '-i', file, '-map', '0:v', '-map', '0:a',
        '-c:v', 'copy', '-c:a', 'aac',
        '-af', `atrim=0:${videoSeconds.toFixed(3)}`,
        '-movflags', '+faststart', temp,
      ],
      { signal },
    );
    if (code === 0 && await exists(temp)) {
      temps.push(temp);
      trimmed.push({ index: index + 1, paddingSeconds: Number(padding.toFixed(3)) });
      aligned.push(temp);
    } else {
      await rm(temp, { force: true });
      aligned.push(file);
    }
  }
  return { files: aligned, temps, trimmed };
}

/** 合并结束后清理音频对齐用的临时分段。 */
async function cleanupSegmentTemps(temps) {
  for (const temp of temps || []) await rm(temp, { force: true });
}

async function mergeClips(config, files, outPath, { signal } = {}) {
  const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
  await mkdir(path.dirname(outPath), { recursive: true });
  await rm(outPath, { force: true });
  let copyError = '';
  let audioError = '';

  const probed = [];
  for (const file of files) probed.push(await probeMedia(file, config, signal));
  const videos = probed.filter((media) => media && media.width && media.height);
  // 分辨率/尺寸不一致时无损拼接会得到坏文件，直接走重编码。
  const paramsMatch = videos.length !== probed.length
    || videos.every((media) => media.width === videos[0].width && media.height === videos[0].height);

  // 先裁齐音频，接缝才不会有空洞；后面的拼接统一用对齐后的分段。
  const { files: aligned, temps, trimmed } = await alignSegmentAudio(
    config, files, probed, outPath, { signal, binary },
  );
  files = aligned;
  try {

    if (ref(config, 'mergeMode', 'copy') !== 'reencode' && paramsMatch) {
      const listPath = `${outPath}.concat.txt`;
      const lines = files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
      await writeFile(listPath, `${lines}\n`, 'utf8');
      try {
        const { code, stderr } = await runProcess(binary, [
          '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
          '-c', 'copy', '-movflags', '+faststart', outPath,
        ], { signal });
        if (code === 0 && await exists(outPath)) return { path: outPath, mode: 'copy', trimmed };
        copyError = stderr.trim().slice(-400);
      } finally {
        await rm(listPath, { force: true });
      }
    } else if (!paramsMatch) {
      copyError = '分段分辨率不一致，跳过无损拼接。';
    }

    const first = probed.find((media) => media && media.width && media.height) || {};
    const width = evenNumber(first.width, 1280);
    const height = evenNumber(first.height, 720);
    const fps = Math.min(60, Math.max(24, Math.round(first.fps || 30)));
    const withAudio = probed.length > 0 && probed.every((media) => media?.hasAudio);

    const videoParts = files.map((_, index) => (
      `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,`
      + `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${index}]`
    ));
    const videoInputs = files.map((_, index) => `[v${index}]`).join('');

    async function encode(filter, maps, withAudioTrack) {
      await rm(outPath, { force: true });
      const args = ['-y'];
      for (const file of files) args.push('-i', file);
      args.push('-filter_complex', filter, ...maps, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p');
      if (withAudioTrack) args.push('-c:a', 'aac', '-b:a', '192k');
      args.push('-movflags', '+faststart', outPath);
      return runProcess(binary, args, { signal });
    }

    if (withAudio) {
      // concat 的输入按 (视频, 音频) 成对排列：v0,a0,v1,a1…
      const audioParts = files.map((_, index) => (
        `[${index}:a]aresample=48000,`
        + 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo'
        + `[a${index}]`
      ));
      const pairedInputs = files.map((_, index) => `[v${index}][a${index}]`).join('');
      const filter = [
        ...videoParts,
        ...audioParts,
        `${pairedInputs}concat=n=${files.length}:v=1:a=1[v][a]`,
      ].join(';');
      const { code, stderr } = await encode(filter, ['-map', '[v]', '-map', '[a]'], true);
      if (code === 0 && await exists(outPath)) return { path: outPath, mode: 'reencode', trimmed };
      audioError = stderr.trim().slice(-400);
    }

    const filter = [...videoParts, `${videoInputs}concat=n=${files.length}:v=1:a=0[v]`].join(';');
    const { code, stderr } = await encode(filter, ['-map', '[v]'], false);
    if (code === 0 && await exists(outPath)) {
      return { path: outPath, mode: withAudio ? 'reencode-video-only' : 'reencode', trimmed };
    }
    const detail = [copyError, audioError, stderr.trim().slice(-400)].filter(Boolean).join(' | ');
    throw Object.assign(new Error(`ffmpeg 合并失败：${detail || '未知错误'}`), { code: 'ffmpeg_failed' });
  } finally {
    await cleanupSegmentTemps(temps);
  }
}

/** 成片目录：配置优先，否则用会话工作目录下的 metaontic-video/。 */
async function resolveOutputDir(config, exec, deps) {
  const configured = String(ref(config, 'outputDir', '')).trim();
  if (configured) return path.resolve(configured);
  let cwd = '';
  if (deps?.workdir && exec?.agent) {
    try {
      cwd = (await deps.workdir.ensure(exec.agent, exec.signal)) || '';
    } catch {
      cwd = '';
    }
  }
  return path.join(cwd || process.cwd(), DEFAULT_OUTPUT_DIR);
}

/* ---------------- 响应解析：兼容官方与中转站的不同形状 ---------------- */

function findKey(payload, keys) {
  if (payload && typeof payload === 'object') {
    if (!Array.isArray(payload)) {
      for (const key of keys) {
        const value = payload[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
    }
    for (const value of Array.isArray(payload) ? payload : Object.values(payload)) {
      const found = findKey(value, keys);
      if (found !== undefined && found !== null && found !== '') return found;
    }
  }
  return undefined;
}

function collectUrls(payload, path = [], found = []) {
  if (typeof payload === 'string') {
    if (/^https?:\/\//i.test(payload)) found.push([path, payload]);
  } else if (Array.isArray(payload)) {
    for (const item of payload) collectUrls(item, path, found);
  } else if (payload && typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload)) {
      collectUrls(value, [...path, key], found);
    }
  }
  return found;
}

function isImageKey(key) {
  const lowered = String(key || '').toLowerCase();
  return IMAGE_KEY_TOKENS.some((token) => lowered.includes(token));
}

function looksLikeImageUrl(url) {
  return IMAGE_EXTENSIONS.some((ext) => url.split('?')[0].toLowerCase().endsWith(ext));
}

function extractTaskId(payload) {
  const value = findKey(payload, ['id', 'task_id', 'taskId', 'request_id']);
  return typeof value === 'string' && value ? value : undefined;
}

function extractVideoUrl(payload) {
  const candidates = collectUrls(payload).filter(
    ([path, url]) => !looksLikeImageUrl(url) && !path.some(isImageKey),
  );
  if (!candidates.length) return undefined;
  for (const wanted of VIDEO_URL_KEYS) {
    for (const [path, url] of candidates) {
      if (path.length && String(path.at(-1)).toLowerCase() === wanted) return url;
    }
  }
  for (const [path, url] of candidates) {
    if (path.length && GENERIC_URL_KEYS.has(String(path.at(-1)).toLowerCase())) return url;
  }
  return candidates[0][1];
}

function extractImageUrl(payload) {
  const found = collectUrls(payload).find(
    ([path, url]) => looksLikeImageUrl(url) || path.some(isImageKey),
  );
  return found?.[1];
}

function extractStatus(payload) {
  const value = findKey(payload, ['status', 'state', 'task_status']);
  return typeof value === 'string' ? value.toLowerCase() : undefined;
}

function upstreamMessage(data) {
  if (data && typeof data === 'object') {
    const error = data.error;
    if (error && typeof error === 'object') {
      const message = String(error.message || '').trim();
      const code = String(error.code || '').trim();
      if (message) return code ? `${message}（${code}）` : message;
    } else if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }
    for (const key of ['message', 'detail', 'msg', 'fail_reason']) {
      const value = data[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  const text = typeof data === 'string' ? data : JSON.stringify(data ?? {});
  return text || '上游未返回错误详情';
}

function quotaDetail(text) {
  const parts = [];
  const remain = /(?:remain(?:ing)? quota|剩余额度)\D{0,6}([¥$]?\d[\d.,]*)/i.exec(text);
  const need = /(?:need quota|需要预扣费额度|需要额度)\D{0,6}([¥$]?\d[\d.,]*)/i.exec(text);
  if (remain) parts.push(`剩余 ${remain[1]}`);
  if (need) parts.push(`需要 ${need[1]}`);
  return parts.length ? `（${parts.join('，')}）` : '';
}

/** 把上游报错（HTTP 错误或任务失败详情）归类成可读的 code + message。 */
function classifyError(statusCode, data) {
  const raw = upstreamMessage(data);
  const lowered = raw.toLowerCase();
  if (
    statusCode === 402
    || QUOTA_HINTS.some((hint) => lowered.includes(hint))
    || lowered.includes('quota_exceeded')
  ) {
    return {
      code: 'provider_quota_exceeded',
      message: `中转站额度不足${quotaDetail(raw)}，请充值后再试：${raw}`,
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return { code: 'provider_auth', message: `中转站鉴权失败（${statusCode}）：${raw}` };
  }
  if (statusCode === 429) {
    return { code: 'provider_rate_limited', message: `中转站限流（429）：${raw}` };
  }
  if (CONTENT_HINTS.some((hint) => lowered.includes(hint))) {
    return { code: 'content_rejected', message: raw };
  }
  if (PRICE_HINTS.some((hint) => lowered.includes(hint))) {
    return {
      code: 'provider_price_config_error',
      message:
        `中转站该模型的计价配置异常，与本次请求参数无关，重试也不会成功：${raw}。`
        + '请在插件 config 里换用其它可用模型。',
    };
  }
  return { code: 'provider_failed', message: raw };
}

function isContentRejection(text) {
  const lowered = String(text || '').toLowerCase();
  return CONTENT_HINTS.some((hint) => lowered.includes(hint));
}

/* ---------------- 请求与轮询 ---------------- */

async function relayRequest(config, path, { method = 'GET', body } = {}) {
  const url = `${resolveBaseUrl(config)}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${resolveApiKey(config)}`,
        'Content-Type': 'application/json',
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw Object.assign(new Error(`中转站请求失败：${error?.message || error}`), {
      code: 'provider_network_error',
    });
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  const upstreamError = data && typeof data === 'object' && data.error;
  if (!response.ok || upstreamError) {
    const classified = classifyError(
      response.status >= 400 ? response.status : 400,
      data,
    );
    throw Object.assign(new Error(classified.message), { code: classified.code });
  }
  return data;
}

function abortError() {
  const error = new Error('已取消');
  error.code = 'ABORTED';
  return error;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function createTask(config, body) {
  return relayRequest(config, resolveSubmitPath(config), { method: 'POST', body });
}

function getTask(config, taskId) {
  return relayRequest(config, resolveQueryPath(config, taskId));
}

/**
 * 轮询直到任务成功、失败、取消，或等待预算耗尽。
 * 中转站的状态字段可能是 success/completed 等别名，这里统一归一化。
 */
async function waitForCompletion(config, taskId, signal) {
  const deadline = Date.now() + ref(config, 'maxWaitMs', 600000);

  for (;;) {
    if (signal?.aborted) throw abortError();

    const task = await getTask(config, taskId);
    const status = extractStatus(task) || 'unknown';
    const model = findKey(task, ['model']) || resolveModel(config);

    if (SUCCESS_STATES.has(status)) {
      const videoUrl = extractVideoUrl(task);
      if (videoUrl) return { taskId, status: 'succeeded', model, videoUrl };
      const imageUrl = extractImageUrl(task);
      return {
        taskId,
        status: 'failed',
        model,
        errorCode: 'provider_bad_response',
        error: imageUrl
          ? `上游返回的是图片而不是视频（${imageUrl.split('?')[0].slice(-60)}），`
            + '可能是中转站把视频请求路由到了图片渠道。'
          : '上游报告成功但没有返回视频地址。',
      };
    }
    if (FAILED_STATES.has(status)) {
      const data = findKey(task, ['error', 'fail_reason', 'message', 'detail']);
      const classified = classifyError(400, typeof data === 'string' ? { message: data } : (data || task));
      return {
        taskId,
        status: CANCEL_STATES.has(status) ? 'cancelled' : 'failed',
        model,
        errorCode: classified.code,
        error: classified.message,
      };
    }
    if (Date.now() > deadline) {
      return { taskId, status: 'timeout' };
    }
    await sleep(ref(config, 'pollIntervalMs', 5000), signal);
  }
}

function renderResult(value) {
  const { status, segments = [], videoUrl, error } = value || {};
  const lines = segments.map((segment) => {
    const head = `第 ${segment.index} 段：+${segment.seconds}s（任务 ${segment.taskId}）`;
    return segment.status === 'succeeded' && segment.videoUrl
      ? `${head} → ${segment.videoUrl}`
      : `${head} → ${segment.status}${segment.error ? `：${segment.error}` : ''}`;
  });

  if (status === 'succeeded') {
    return [
      {
        type: 'text',
        text: [
          '视频延长成功。',
          ...lines,
          `最终视频链接（约 24 小时内有效）：${videoUrl || '（无）'}`,
        ].join('\n'),
      },
    ];
  }
  if (status === 'timeout') {
    return [
      {
        type: 'text',
        text: [
          '延长任务仍在生成中（已超出单次等待时间）。',
          ...lines,
          `可用 video_status 查询任务 ${
            segments.at(-1)?.taskId || '（未知）'
          } 的状态与视频链接。`,
        ].join('\n'),
      },
    ];
  }
  if (status === 'cancelled') {
    return [{ type: 'text', text: `延长任务已取消。\n${lines.join('\n')}` }];
  }
  return [
    {
      type: 'text',
      text: [
        `视频延长失败${error ? `：${error}` : ''}。`,
        ...lines,
        videoUrl ? `已完成部分的视频链接：${videoUrl}` : '',
      ].filter(Boolean).join('\n'),
    },
  ];
}

const SEGMENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'integer' },
    seconds: { type: 'integer' },
    taskId: { type: 'string' },
    status: { type: 'string' },
    videoUrl: { type: 'string' },
    error: { type: 'string' },
  },
};

function extendTool(config) {
  return {
    name: 'video_extend',
    description:
      '把一段已有的视频向前或向后延长：以公网视频 URL 作为输入素材，调用 Seedance 生成衔接片段，'
      + '保持人物、服装、场景光线和声音连续；可一次连续延长多段，每段都用上一段的结果继续延长。'
      + '提示词规则：以「向后延长视频1」或「向前延长视频1」开头（也可写「生成视频1之后的内容：」），'
      + '全程用「视频1」指代输入素材，不要写成「参考视频1」（会被当成参考生视频，不是延长）；'
      + '内容写清延长方向、剧情发展、主体状态、镜头运动和声音延续，减少接缝。'
      + '每段 4-15 秒，建议 ≤14 秒（刚好 15 秒有时会因封装略超被上游拒绝）。'
      + '返回每段的任务 ID 和最终视频下载链接（约 24 小时内有效）；生成通常需要几分钟，'
      + '单次调用返回 timeout 时用 video_status 继续等，不要重复提交同一段。',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: '本段要续拍的剧情内容与人物设定；不要在提示词里重复已发生的情节。',
        },
        videoUrl: {
          type: 'string',
          description: '参考视频的公网 URL（https:// 或 http://）。与 taskId 二选一。',
        },
        taskId: {
          type: 'string',
          description:
            '已有的 video_generate / video_extend 任务 ID，用它的成片作为输入素材。与 videoUrl 二选一。',
        },
        duration: {
          type: 'integer',
          minimum: 4,
          maximum: 15,
          description:
            '每段新增的秒数，4-15 的整数（如 5/8/10/14）；建议 ≤14，'
            + '刚好卡 15 秒容易因封装略超被上游拒绝。省略时使用配置默认值。',
        },
        direction: {
          type: 'string',
          enum: ['backward', 'forward'],
          description:
            'backward=向后延长，续拍视频1之后的内容（默认）；forward=向前延长，生成视频1之前的前置剧情。',
        },
        wording: {
          type: 'string',
          enum: ['extend', 'after'],
          description:
            '提示词开头写法：extend=「向后延长视频1」/「向前延长视频1」（默认）；'
            + 'after=「生成视频1之后的内容：」（仅向后延长）。',
        },
        segments: {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          description: '连续延长几段，默认 1；每段都引用上一段的结果，适合做出更长的成片。',
        },
        mode: {
          type: 'string',
          enum: ['continuous', 'closeup'],
          description:
            'continuous=同机位连续续拍（默认）；closeup=在完整台词结束处自然切到近景或反应镜头。',
        },
        startAt: {
          type: 'number',
          minimum: 0,
          description:
            '视频1已有的秒数；给了就按「整片第 X–Y 秒」描述本段。'
            + '向后延长时逐段累加，向前延长时逐段前移。',
        },
        resolution: {
          type: 'string',
          enum: ['480p', '720p', '1080p'],
          description: '分辨率，默认沿用配置。',
        },
        ratio: {
          type: 'string',
          enum: ['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'],
          description: '画面比例；seedance 2.5 延长时会自动改用 adaptive。',
        },
        generateAudio: {
          type: 'boolean',
          description: '是否生成音频，默认 true。',
        },
        watermark: {
          type: 'boolean',
          description: '是否添加水印，默认 false。',
        },
      },
      required: ['prompt'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          videoUrl: { type: 'string' },
          totalSeconds: { type: 'integer' },
          error: { type: 'string' },
          errorCode: { type: 'string' },
          segments: { type: 'array', items: SEGMENT_OUTPUT_SCHEMA },
        },
      },
      render(_args, value) {
        return renderResult(value);
      },
    },
    timeoutMs: 1800000,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);

      const prompt = String(args?.prompt ?? '').trim();
      if (!prompt) throw new Error('提示词 prompt 不能为空。');

      const direction = args?.direction === 'forward' ? 'forward' : 'backward';
      const requestedSegments = clampInteger(args?.segments, 1, MAX_SEGMENTS, 1);
      const secondsPerSegment = clampInteger(
        args?.duration ?? ref(config, 'duration', 5),
        MIN_SECONDS,
        MAX_SEGMENT_SECONDS,
        ref(config, 'duration', 5),
      );

      let referenceUrl = String(args?.videoUrl ?? '').trim();
      if (!referenceUrl && args?.taskId) {
        const source = await getTask(config, String(args.taskId).trim());
        referenceUrl = extractVideoUrl(source) || '';
        if (!referenceUrl) {
          throw new Error(
            `任务 ${args.taskId} 没有可用的视频链接（状态：${
              extractStatus(source) || '未知'
            }）。`,
          );
        }
      }
      referenceUrl = normalizeReferenceUrl(referenceUrl);

      let cursor = args?.startAt == null ? null : Math.max(0, Math.round(Number(args.startAt)));
      const segments = [];
      let status = 'succeeded';
      let error;
      let errorCode;

      for (let index = 1; index <= requestedSegments; index += 1) {
        if (exec?.signal?.aborted) throw abortError();

        const { body, seconds } = buildRequestBody(
          config,
          { ...args, prompt, duration: secondsPerSegment, startAt: cursor },
          referenceUrl,
        );
        const final = await runTask(config, body, exec?.signal);
        const taskId = final.taskId;

        segments.push({
          index,
          seconds,
          taskId,
          status: final.status,
          videoUrl: final.videoUrl,
          error:
            final.errorCode === 'content_rejected'
              ? `${CONTENT_REJECTION_HINT}上游详情：${final.error || ''}`
              : final.error,
        });

        if (final.status !== 'succeeded' || !final.videoUrl) {
          status = final.status;
          errorCode = final.errorCode;
          error =
            final.errorCode === 'content_rejected'
              ? `${CONTENT_REJECTION_HINT}上游详情：${final.error || ''}`
              : final.error;
          break;
        }
        referenceUrl = normalizeReferenceUrl(final.videoUrl);
        if (cursor != null) {
          cursor = direction === 'forward' ? cursor - seconds : cursor + seconds;
          if (cursor < 0) cursor = null;
        }
      }

      return {
        status,
        error,
        errorCode,
        segments,
        videoUrl: segments.filter((segment) => segment.videoUrl).at(-1)?.videoUrl,
        totalSeconds: segments.filter((segment) => segment.status === 'succeeded').length
          * secondsPerSegment,
      };
    },
  };
}

const VIDEO_SEGMENT_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'integer' },
    kind: { type: 'string' },
    seconds: { type: 'integer' },
    taskId: { type: 'string' },
    status: { type: 'string' },
    videoUrl: { type: 'string' },
    localPath: { type: 'string' },
    durationSeconds: { type: 'number' },
    error: { type: 'string' },
  },
};

function renderVideoResult(value) {
  const {
    status, mode, segments = [], videoUrl, videoPath, merged, mergeMode, note, error,
  } = value || {};
  const lines = segments.map((segment) => {
    const label = segment.kind === 'extend' ? `延长 +${segment.seconds}s` : `直出 ${segment.seconds}s`;
    const head = `第 ${segment.index} 段：${label}（任务 ${segment.taskId}）`;
    return segment.status === 'succeeded' && segment.videoUrl
      ? `${head} → ${segment.videoUrl}`
      : `${head} → ${segment.status}${segment.error ? `：${segment.error}` : ''}`;
  });

  const parts = [];
  if (status === 'succeeded') {
    parts.push(mode === 'extended'
      ? `视频生成成功：先直出 ${formatSeconds(segments[0]?.seconds)} 秒，再延长 ${segments.length - 1} 段。`
      : `视频生成成功：一次直出 ${formatSeconds(segments[0]?.seconds)} 秒，没有超过单段上限，不需要延长。`);
  } else if (status === 'timeout') {
    parts.push('任务仍在生成中（已超出单次等待时间）。');
  } else if (status === 'cancelled') {
    parts.push('任务已取消。');
  } else {
    parts.push(`视频生成失败${error ? `：${error}` : ''}。`);
  }
  parts.push(...lines);

  if (status === 'succeeded') {
    if (videoPath) {
      const how = mergeMode === 'copy'
        ? '无损拼接'
        : (mergeMode === 'single' ? '一段直出，无需拼接' : '重编码拼接');
      parts.push(`成片（本地文件）：${videoPath}（${how}）`);
    } else {
      parts.push('没有生成合并文件，请按上面的上游链接自行下载分段。');
    }
  }
  if (videoUrl) parts.push(`最后一段上游链接（约 24 小时内有效）：${videoUrl}`);
  if (note) parts.push(note);
  if (status === 'timeout') {
    parts.push(`可用 video_status 查询任务 ${segments.at(-1)?.taskId || '（未知）'} 的状态。`);
  }
  return [{ type: 'text', text: parts.filter(Boolean).join('\n') }];
}

function videoTool(config, deps) {
  return {
    name: 'video_generate',
    description:
      '生成一段完整视频，duration 是目标总秒数：不超过单段上限（默认 15 秒）时一次直出；'
      + '**硬规则：总时长 ≤ 单段上限的视频必须一次直出，禁止拆成多段 / 多镜 / 多次调用再拼接**'
      + '（例如「15 秒」不许拆成 8+7）；多镜只在用户明确要求多镜时才用。'
      + '更长时先直出首段，再把剩余时长按段均分逐段续拍（每段 4-15 秒，建议 ≤14 秒）——'
      + '这是同一个镜头的续拍延长，也不是多镜拼接，'
      + '最后用 ffmpeg 合并成一个本地成片文件，默认落在会话工作目录下的 metaontic-video/，'
      + '文件名形如 20261027-201530-25s.mp4。20 秒、25 秒这类目标不用拆成多个任务：'
      + '直接传 duration=20 即可（20 秒 → 15+5，25 秒 → 15+10）。'
      + '返回每段任务 ID、上游链接和成片路径。生成通常需要几分钟（每段单独生成），'
      + '单次调用返回 timeout 时用 video_status 继续等，不要重复提交新任务。'
      + '合并需要本机有 ffmpeg；没有也不会失败，只是保留分段不合并。',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: '要生成的内容、人物设定与台词；超过单段上限时它同时决定后续每段续拍什么。',
        },
        duration: {
          type: 'integer',
          minimum: 4,
          maximum: 285,
          description:
            '目标总时长（秒）。不超过单段上限（默认 15）时就一次直出（整条视频只生成一次，'
            + '禁止拆成多段/多镜再拼）；超过就先直出上限长度再逐段延长，最后合并。',
        },
        firstFrameUrl: {
          type: 'string',
          description: '可选：首帧图公网 URL，作为生成的首帧参考。',
        },
        lastFrameUrl: {
          type: 'string',
          description: '可选：尾帧图公网 URL，作为生成的尾帧参考。',
        },
        segmentSeconds: {
          type: 'integer',
          minimum: 4,
          maximum: 15,
          description:
            '仅在超过单段上限时才用：每段延长多少秒，默认用配置里的每段秒数；'
            + '4-15 的整数（如 5/8/10/14），建议 ≤14 以免刚好卡 15 秒被上游拒绝。',
        },
        mode: {
          type: 'string',
          enum: ['continuous', 'closeup'],
          description: '延长时的衔接方式：continuous=同机位连续（默认）；closeup=在台词结束处切近景。',
        },
        resolution: {
          type: 'string',
          enum: ['480p', '720p', '1080p'],
          description: '分辨率，默认沿用配置。',
        },
        ratio: {
          type: 'string',
          enum: ['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'],
          description: '画面比例；seedance 2.5 延长时会自动改用 adaptive。',
        },
        generateAudio: {
          type: 'boolean',
          description: '是否生成音频，默认 true。',
        },
        watermark: {
          type: 'boolean',
          description: '是否添加水印，默认 false。',
        },
        merge: {
          type: 'boolean',
          description: '是否下载分段并用 ffmpeg 合并成一个本地成片，默认 true。',
        },
        keepSegments: {
          type: 'boolean',
          description: '合并后是否保留分段原片，默认 false（合并成功后删除分段）。',
        },
      },
      required: ['prompt'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          mode: { type: 'string' },
          plannedSeconds: { type: 'integer' },
          totalSeconds: { type: 'integer' },
          videoUrl: { type: 'string' },
          videoPath: { type: 'string' },
          merged: { type: 'boolean' },
          mergeMode: { type: 'string' },
          segmentsDir: { type: 'string' },
          note: { type: 'string' },
          error: { type: 'string' },
          errorCode: { type: 'string' },
          segments: { type: 'array', items: VIDEO_SEGMENT_OUTPUT_SCHEMA },
        },
      },
      render(_args, value) {
        return renderVideoResult(value);
      },
    },
    timeoutMs: 3600000,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);

      const prompt = String(args?.prompt ?? '').trim();
      if (!prompt) throw new Error('提示词 prompt 不能为空。');

      const singleMax = resolveSingleMax(config);
      const segmentSeconds = resolveSegmentSeconds(config, args?.segmentSeconds);
      const total = clampInteger(
        args?.duration ?? singleMax,
        MIN_SECONDS,
        singleMax + (MAX_SEGMENTS - 1) * MAX_SEGMENT_SECONDS,
        singleMax,
      );
      const plan = planVideoSegments(total, singleMax, segmentSeconds);
      const plannedTotal = plan.reduce((sum, step) => sum + step.seconds, 0);

      const notes = [];
      if (plannedTotal < total) {
        notes.push(
          `目标 ${total} 秒超过单次最多 ${MAX_SEGMENTS} 段的上限，本次按 ${plannedTotal} 秒执行。`,
        );
      } else if (plannedTotal > total) {
        notes.push(
          `目标 ${total} 秒拆不出完全等长的分段（每段 4-15 秒），本次按 ${plannedTotal} 秒执行。`,
        );
      }

      const segments = [];
      let status = 'succeeded';
      let error;
      let errorCode;
      let referenceUrl = '';
      let cursor = 0;

      for (const [index, step] of plan.entries()) {
        if (exec?.signal?.aborted) throw abortError();

        const stepArgs = {
          ...args,
          prompt,
          duration: step.seconds,
          // 这条流程是「先直出再向后续拍」，分段的拼接顺序固定为向后延长。
          direction: 'backward',
          startAt: step.kind === 'extend' ? cursor : undefined,
        };
        const { body, seconds } = step.kind === 'generate'
          ? buildGenerationBody(config, stepArgs, step.seconds)
          : buildRequestBody(config, stepArgs, referenceUrl);

        const final = await runTask(config, body, exec?.signal);
        const detail = final.errorCode === 'content_rejected'
          ? `${CONTENT_REJECTION_HINT}上游详情：${final.error || ''}`
          : final.error;

        segments.push({
          index: index + 1,
          kind: step.kind,
          seconds,
          taskId: final.taskId,
          status: final.status,
          videoUrl: final.videoUrl,
          error: detail,
        });

        if (final.status !== 'succeeded' || !final.videoUrl) {
          status = final.status;
          errorCode = final.errorCode;
          error = detail;
          break;
        }
        referenceUrl = normalizeReferenceUrl(final.videoUrl);
        cursor += seconds;
      }

      const completed = segments.filter((segment) => segment.status === 'succeeded' && segment.videoUrl);
      const result = {
        status,
        mode: plan.length > 1 ? 'extended' : 'direct',
        plannedSeconds: plannedTotal,
        totalSeconds: completed.reduce((sum, segment) => sum + segment.seconds, 0),
        segments,
        videoUrl: completed.at(-1)?.videoUrl,
        error,
        errorCode,
      };
      if (status !== 'succeeded' || !completed.length) return result;

      if (args?.merge === false) {
        result.note = [...notes, '按参数要求只返回上游链接，没有下载合并。'].join('\n');
        return result;
      }

      const stamp = fileStamp();
      const outDir = await resolveOutputDir(config, exec, deps);
      const segmentsDir = path.join(outDir, 'segments', stamp);
      const files = [];
      let probeWarned = false;

      try {
        for (const [index, segment] of completed.entries()) {
          const dest = path.join(
            segmentsDir,
            `${String(segment.index).padStart(2, '0')}-${segment.kind}.mp4`,
          );
          await downloadFile(segment.videoUrl, dest, { signal: exec?.signal });
          segment.localPath = dest;

          const media = await probeMedia(dest, config, exec?.signal);
          if (media?.durationSeconds) {
            segment.durationSeconds = Number(media.durationSeconds.toFixed(2));
            const cumulative = completed.slice(0, index + 1)
              .reduce((sum, item) => sum + item.seconds, 0);
            const tolerance = Math.max(
              CUMULATIVE_TOLERANCE_MIN_SECONDS,
              cumulative * CUMULATIVE_TOLERANCE_RATIO,
            );
            const looksCumulative = files.length > 0
              && Math.abs(media.durationSeconds - cumulative) <= tolerance
              && Math.abs(media.durationSeconds - segment.seconds) > tolerance;
            if (looksCumulative) {
              files.length = 0;
              notes.push(
                `第 ${segment.index} 段实测 ${formatSeconds(media.durationSeconds)} 秒，`
                + `接近累计时长 ${cumulative} 秒，按「上游返回的是累计成片」处理。`,
              );
            }
          } else if (!probeWarned) {
            probeWarned = true;
            notes.push('没有可用的 ffprobe，无法探测分段时长，按「每段都是增量片段」直接拼接。');
          }
          files.push(dest);
        }
      } catch (failure) {
        if (failure?.code === 'ABORTED') throw failure;
        result.note = [...notes, `分段已生成，但下载失败：${failure?.message || failure}`].join('\n');
        return result;
      }

      if (!files.length) return result;

      const finalPath = path.join(outDir, `${stamp}-${plannedTotal}s.mp4`);
      try {
        if (files.length === 1) {
          await rm(finalPath, { force: true });
          await rename(files[0], finalPath);
          result.mergeMode = 'single';
        } else {
          const merged = await mergeClips(config, files, finalPath, { signal: exec?.signal });
          result.mergeMode = merged.mode;
          if (merged.trimmed?.length) {
            notes.push(
              `第 ${merged.trimmed.map((item) => item.index).join('、')} 段的音频比视频长`
              + `（最长 ${Math.max(...merged.trimmed.map((item) => item.paddingSeconds))} 秒），`
              + '已裁齐后再拼接，避免接缝处缺一小段画面。',
            );
          }
        }
        result.merged = true;
        result.videoPath = finalPath;
      } catch (failure) {
        if (failure?.code === 'ABORTED') throw failure;
        const reason = failure?.code === 'ffmpeg_missing'
          ? `没有找到 ${resolveBinary(config, 'ffmpegBinary', 'ffmpeg')}，分段已保留但没有合并成一个文件；`
            + '在插件配置里填 ffmpegBinary，或把 ffmpeg 装进 PATH 后重试。'
          : `分段已生成，但合并失败：${failure?.message || failure}`;
        result.segmentsDir = segmentsDir;
        result.note = [...notes, reason].join('\n');
        return result;
      }

      if (args?.keepSegments ?? ref(config, 'keepSegments', false)) {
        result.segmentsDir = segmentsDir;
      } else {
        await rm(segmentsDir, { recursive: true, force: true });
      }
      if (notes.length) result.note = notes.join('\n');
      return result;
    },
  };
}

function taskTool(config) {
  return {
    name: 'video_status',
    description:
      '按任务 ID 查询 Seedance 视频任务（生成、延长与合并）的状态；'
      + '任务完成（status 为 succeeded）时返回视频下载链接（约 24 小时内有效）。'
      + 'video_generate / video_extend 返回 timeout 时，用它们给出的 taskId 在这里继续等，'
      + '不要在同一个会话里重复提交同一段任务。',
    parameters: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: '由 video_generate / video_extend 返回的任务 ID。',
        },
      },
      required: ['taskId'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          status: { type: 'string' },
          model: { type: 'string' },
          videoUrl: { type: 'string' },
          error: { type: 'string' },
          errorCode: { type: 'string' },
        },
      },
      render(_args, value) {
        const { taskId, status, videoUrl, error, model } = value || {};
        if (status === 'succeeded') {
          return [
            {
              type: 'text',
              text: [
                '延长任务已完成。',
                `任务 ID：${taskId}`,
                `模型：${model || '-'}`,
                `视频链接（约 24 小时内有效）：${videoUrl || '（无）'}`,
              ].join('\n'),
            },
          ];
        }
        if (status === 'failed') {
          return [{ type: 'text', text: `延长任务失败（任务 ${taskId}）：${error || '未知错误'}` }];
        }
        return [{ type: 'text', text: `任务 ${taskId} 当前状态：${status || '未知'}。` }];
      },
    },
    timeoutMs: 60000,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);

      const taskId = String(args?.taskId ?? '').trim();
      if (!taskId) throw new Error('taskId 不能为空。');

      const task = await getTask(config, taskId);
      const status = extractStatus(task) || 'unknown';
      const model = findKey(task, ['model']) || resolveModel(config);
      const videoUrl = extractVideoUrl(task);

      if (SUCCESS_STATES.has(status) && videoUrl) {
        return { taskId, status: 'succeeded', model, videoUrl };
      }
      if (FAILED_STATES.has(status)) {
        const detail = findKey(task, ['error', 'fail_reason', 'message', 'detail']);
        const classified = classifyError(
          400,
          typeof detail === 'string' ? { message: detail } : (detail || task),
        );
        const raw = status === 'cancelled' || status === 'canceled' ? 'cancelled' : 'failed';
        return {
          taskId,
          status: raw,
          model,
          errorCode: classified.code,
          error: isContentRejection(classified.message)
            ? `${CONTENT_REJECTION_HINT}上游详情：${classified.message}`
            : classified.message,
        };
      }
      return { taskId, status, model, videoUrl };
    },
  };
}

/** 用户可在插件内改的配置字段。 */
const CONFIG_FIELDS = [
  'apiKey', 'baseUrl', 'submitPath', 'queryPath', 'model',
  'duration', 'singleMaxSeconds', 'mode', 'resolution', 'ratio', 'generateAudio', 'watermark',
  'extraParams', 'pollIntervalMs', 'maxWaitMs',
  'mergeMode', 'outputDir', 'keepSegments', 'ffmpegBinary', 'ffprobeBinary',
  'registerUser', 'registerEmail',
];

function maskSecrets(view) {
  return { ...view, apiKey: view.apiKey ? '（已配置）' : '' };
}

/** 当前配置：stored 是写进 profile patch 的值，effective 是实际生效（含预设与环境变量）。 */
function configView(config) {
  const stored = {};
  for (const key of CONFIG_FIELDS) stored[key] = ref(config, key, undefined);
  return {
    stored: maskSecrets(stored),
    effective: {
      baseUrl: resolveBaseUrl(config),
      submitPath: resolveSubmitPath(config),
      queryPath: String(ref(config, 'queryPath', '')).trim() || relayPreset().queryPath,
      model: resolveModel(config),
      apiKeySource: ref(config, 'apiKey', '')
        ? 'config'
        : (resolveApiKey(config) ? 'env' : 'missing'),
    },
  };
}

/** 把字段改动合并进本插件在 profile patch 里的那条条目。 */
async function writeProfileConfig(settings, config, patch) {
  const entryId = String(ref(config, 'entryId', 'metaontic-video')).trim();
  const descriptors = settings.describe({ redactSecrets: true });
  const entry = descriptors.find((item) => item.ns === entryId);
  if (!entry) {
    throw new Error(
      `profile patch 里没有可编辑的 ${entryId} 条目，无法写回配置。`
      + '请先在 profile 的 cordis.patch.yml 里加一条覆盖项：\n'
      + `- id: ${entryId}\n  name: 'metaontic-video'\n  config: { apiKey: 'sk-...', baseUrl: '...', model: '...' }\n`
      + '（也可以让 Agent 代写这一条。）',
    );
  }
  await settings.update(entryId, patch, entry.revision);
  return entryId;
}

function configTool(config, settings) {
  return {
    name: 'video_config',
    description:
      '读取或修改 MetaOnticVideo 插件自己的配置（apiKey、baseUrl、submitPath、'
      + 'queryPath、model、duration、singleMaxSeconds、mode、resolution、ratio、generateAudio、'
      + 'watermark、extraParams、pollIntervalMs、maxWaitMs、mergeMode、outputDir、keepSegments、'
      + 'ffmpegBinary、ffprobeBinary、registerEmail）。改动写进 profile 的 cordis.patch.yml，'
      + '宿主重载后生效。'
      + '用户说「把中转站地址/模型/时长改成 X」时用 action=set，看当前值用 action=get；'
      + 'duration 是每段新增秒数（4-15，建议 ≤14），singleMaxSeconds 是单次直出上限（默认 15）。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set'],
          description: 'get=查看当前配置；set=修改配置（至少给一个要改的字段）。',
        },
        apiKey: { type: 'string', description: 'API Key（配置里留空时自动读环境变量）。' },
        baseUrl: { type: 'string', description: '基础地址，例如 https://ai.bileego.com（中转站）或官方地址。' },
        registerEmail: { type: 'string', description: '领 Key 用的邮箱（账号）；注册要邮箱验证码，一个邮箱只发一把。' },
        submitPath: { type: 'string', description: '创建任务路径，例如 /doubao/api/v3/contents/generations/tasks。' },
        queryPath: { type: 'string', description: '查询任务路径，{task_id} 会被替换。' },
        model: { type: 'string', description: '模型 ID，例如 doubao-seedance-2-0-mini-260615。' },
        duration: { type: 'integer', minimum: 4, maximum: 15, description: '每段新增秒数（4-15 的整数，建议 ≤14）。' },
        mode: { type: 'string', enum: ['continuous', 'closeup'], description: '续拍方式。' },
        resolution: { type: 'string', enum: ['480p', '720p', '1080p'], description: '分辨率。' },
        ratio: {
          type: 'string',
          enum: ['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'],
          description: '画面比例。',
        },
        generateAudio: { type: 'boolean', description: '是否生成音频。' },
        watermark: { type: 'boolean', description: '是否加水印。' },
        extraParams: { type: 'string', description: '额外请求参数（JSON 对象字符串）。' },
        pollIntervalMs: { type: 'integer', minimum: 1000, description: '轮询间隔（毫秒）。' },
        maxWaitMs: { type: 'integer', minimum: 1000, description: '单次调用最长等待（毫秒）。' },
        singleMaxSeconds: {
          type: 'integer',
          minimum: 4,
          maximum: 15,
          description: '单次直出上限（秒）：不超过它一次生成，超过它才分段延长。',
        },
        mergeMode: {
          type: 'string',
          enum: ['copy', 'reencode'],
          description: '合并方式：copy=先无损拼接（失败自动重编码）；reencode=统一重编码。',
        },
        outputDir: { type: 'string', description: '成片输出目录；留空用会话工作目录下的 metaontic-video/。' },
        keepSegments: { type: 'boolean', description: '合并后是否保留分段原片。' },
        ffmpegBinary: { type: 'string', description: 'ffmpeg 可执行文件路径。' },
        ffprobeBinary: { type: 'string', description: 'ffprobe 可执行文件路径。' },
      },
      required: ['action'],
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          entryId: { type: 'string' },
          editable: { type: 'boolean' },
          patchPath: { type: 'string' },
          stored: { type: 'object' },
          effective: { type: 'object' },
          patch: { type: 'object' },
          error: { type: 'string' },
        },
      },
      render(_args, value) {
        const { action, stored, effective, entryId, patchPath, patch, error } = value || {};
        if (error) return [{ type: 'text', text: error }];
        const lines = [
          action === 'set' ? `已写入 profile patch（条目 ${entryId}）` : '当前配置：',
          ...Object.entries(stored || {})
            .filter(([, field]) => field !== undefined && field !== '')
            .map(([key, field]) => `  ${key}: ${typeof field === 'object' ? JSON.stringify(field) : field}`),
          `生效值：baseUrl=${effective?.baseUrl} model=${effective?.model}`,
          `  submitPath=${effective?.submitPath}`,
          `  apiKey 来源：${effective?.apiKeySource}`,
          patchPath ? `配置文件：${patchPath}` : '',
          patch && Object.keys(patch).length ? '改动会在宿主重载配置后生效。' : '',
        ].filter(Boolean);
        return [{ type: 'text', text: lines.join('\n') }];
      },
    },
    timeoutMs: 30000,
    isConcurrencySafe() {
      return false;
    },
    async execute(args) {
      const action = args?.action;
      const view = configView(config);
      const patchPath = settings?.documentPath;

      if (action === 'get') {
        return { action, ...view, editable: Boolean(settings), patchPath };
      }
      if (action !== 'set') {
        throw new Error('action 只能是 get 或 set。');
      }
      const patch = {};
      for (const key of CONFIG_FIELDS) {
        if (args?.[key] !== undefined) patch[key] = args[key];
      }
      if (!Object.keys(patch).length) {
        throw new Error('set 需要至少一个要修改的字段（如 baseUrl、model、duration）。');
      }
      if (!settings) {
        throw new Error(
          '宿主没有提供 settings 服务，无法写回配置。请手动编辑 profile 的 cordis.patch.yml 里 '
          + "metaontic-video 那一条的 config（见插件 README）。",
        );
      }
      const entryId = await writeProfileConfig(settings, config, patch);
      return { action, entryId, patchPath, patch, ...view };
    },
  };
}

/**
 * 每个新对话都会带上的一段插件说明：宿主提供 systemPrompt 服务时注册成提示词段落，
 * 换会话、换 Agent 都不需要用户再解释一遍这个插件怎么用。
 */
function buildPromptGuidance(config) {
  const singleMax = resolveSingleMax(config);
  const segmentSeconds = resolveSegmentSeconds(config);
  return [
    'MetaOnticVideo（Seedance 视频插件）：需要生成视频、给视频加减时长时优先用它。',
    `· 新视频用 video_generate，duration 传目标总秒数。**硬规则：总时长 ≤ ${singleMax} 秒（单段上限）的整条`
      + '视频必须一次直出，禁止拆成多镜 / 多段 / 多次 video_generate 再拼接**——'
      + `例如「15 秒」就是一次 15 秒，不许拆成 8+7；也不要为了「中间切一刀更好看」而分镜，`
      + '分镜只在用户明确要求多镜时使用。'
      + '超过上限时（如 20 秒）会自动拆成首段 + 若干延长段并合并——那是同一条视频的续拍延长，不是多镜拼接。'
      + '所以「20 秒视频」直接传 duration=20，不用拆成多个任务；'
      + '成片默认落在会话工作目录下的 metaontic-video/。',
    '· 给已有视频接长用 video_extend，输入必须是公网 URL；提示词以「向后延长视频1」或「向前延长视频1」开头，'
      + '全程用「视频1」指代素材，不要写「参考视频1」；写清延长方向、剧情发展、主体状态、镜头运动、声音延续；'
      + '每段 4-15 秒，建议不超过 14 秒。',
    '· 生成通常要几分钟：单次调用返回 timeout 不等于失败，用 video_status 加 taskId 继续查'
      + '（上游链接约 24 小时内有效），不要重复提交同一段。',
    '· 换中转站、模型、时长等配置用 video_config（写进 profile，宿主重载后生效）；'
      + '合并需要本机有 ffmpeg，缺了会保留分段但不合并。',
    `· 当前配置：直出上限 ${singleMax} 秒、每段延长 ${segmentSeconds} 秒。`,
    '· 没有 API Key：让用户在插件设置页点「激活」，会向注册服务申请一个密钥并自动填好；'
      + '注册时填的用户名就是这把 API 的名称，默认额度 0.01 美元。',
  ].join('\n');
}

export function apply(ctx, config = {}) {
  const deps = {};
  const disposers = [
    ctx.tools.register(jsonSafeTool(videoTool(config, deps))),
    ctx.tools.register(jsonSafeTool(extendTool(config))),
    ctx.tools.register(jsonSafeTool(taskTool(config))),
  ];
  // 配置工具依赖宿主的 settings 服务；没有该服务时插件其余功能照常可用。
  const cleanup = ctx.inject(['settings'], (settingsCtx) => {
    disposers.push(settingsCtx.tools.register(jsonSafeTool(configTool(config, settingsCtx.settings))));
  });
  if (typeof cleanup === 'function') disposers.push(cleanup);
  // 新对话自带的使用说明：宿主没有 systemPrompt 服务时跳过，其余功能不受影响。
  const promptCleanup = ctx.inject(['systemPrompt'], (promptCtx) => promptCtx.systemPrompt.section({
    name: 'plugin:metaontic-video',
    order: 5200,
    text: buildPromptGuidance(config),
  }));
  if (typeof promptCleanup === 'function') disposers.push(promptCleanup);
  // 会话工作目录也是可选的：宿主不提供时合并结果落在进程 cwd 下。
  const workdirCleanup = ctx.inject(['workingDirectory'], (workdirCtx) => {
    deps.workdir = workdirCtx.workingDirectory;
    return () => { deps.workdir = undefined; };
  });
  if (typeof workdirCleanup === 'function') disposers.push(workdirCleanup);
  return () => {
    for (const dispose of disposers) dispose();
  };
}
