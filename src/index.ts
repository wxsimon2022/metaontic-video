/**
 * MetaOnticVideo —— Seedance 视频生成 Host plugin（含长视频的分段生成与合并）。
 *
 * 本职就是「生成视频」：文生视频、图生视频，目标时长直接给（20 秒、25 秒也行）。
 * 因为 Seedance 单次最多生成 15 秒，超过单段上限的部分由插件自己衔接：
 * 先直出首段，再用 Seedance 原生的视频延长能力逐段续拍，最后 ffmpeg 合并成一条；
 * 给已有视频「接长」也是同一套能力（video_extend）。
 *
 * 注册的工具：
 *   - `video_generate`  生成一段完整视频：目标总时长不超过模型单段上限（2.0 为 15 秒、2.5 为 30 秒）时一次直出；
 *                       更长时先直出首段，再把剩余时长按 4 至模型上限（2.0 为 15、2.5 为 30） 秒逐段延长续拍，
 *                       最后用 ffmpeg 合并成一个本地成片
 *                       （本机没有 ffmpeg 就不合成，只返回分段列表，并附上按系统给的安装命令）
 *   - `video_extend`    以一段公网视频为输入素材，向前或向后延长指定秒数；可一次连续延长多段
 *   - `video_status`    按任务 ID 查询任务的状态
 *   - `video_config`    读取/写回本插件自己的配置（走宿主的 settings 服务，
 *                             写进 profile 的 cordis.patch.yml；配置字段都是 .volatile()，
 *                             宿主重载后立即生效，不必手改 YAML）
 *
 * 走 New API 中转站（接口沿用 contents-generation 任务格式）：
 *   POST {baseUrl}{submitPath}
 *   GET  {baseUrl}{queryPath}
 * baseUrl 填中转站站址，路径按中转站的模型分流走。
 *
 * 请求体沿用 contents-generation 的原生延长语义：
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
import { appendFile, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import z from '@deepseek-ai/schemastery';

export const inject = ['tools'];

export const Config = z.object({
  connectionMode: z.union(['service', 'volcengine']).default('service').description('接入方式：A 服务端领 Key；B 火山引擎直连').volatile(),
  volcengineApiKey: z.string().default('').description('B 模式火山引擎 API Key').volatile(),
  entryId: z.string()
    .default('metaontic-video')
    .description('本插件在 profile patch 里的条目 id；配置工具用它把改动写回')
    .volatile(),
  apiKey: z.string()
    .default('')
    .description(
      'API Key：只在设置页点「登录」时由服务端下发并直接写进配置，不支持手填、'
      + '也不读环境变量；手改这里的值会被拒绝调用',
    )
    .volatile(),
  keyOrigin: z.string()
    .default('')
    .description("密钥来源标记：设置页「登录」成功后写入 'register'，插件只认服务端下发的 Key")
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
    .description('视频生成用的模型 ID（seedance 2.0 / 2.5 系列）；留空读 NEWAPI_VIDEO_MODEL 或内置默认值')
    .volatile(),
  registerEmail: z.string()
    .default('')
    .description('领 Key 用的邮箱（账号）：中转站里的密钥名由服务端生成唯一串，与这个邮箱绑定')
    .volatile(),
  registerToken: z.string()
    .default('metaontic-video-register-v1')
    .description('注册请求头 X-Register-Token 的值，要与服务端 REGISTER_CLIENT_TOKEN 一致；页面不显示')
    .volatile(),
  registerApi: z.string()
    .default('')
    .description('插件服务地址（领 Key / 查额度 / 使用记录）；留空用内置的视频服务域名')
    .volatile(),
  deviceId: z.string()
    .default('')
    .description('本机设备标识：设置页点「登录」时写入，用来查这把 Key 的剩余额度')
    .volatile(),
  deviceSecret: z.string()
    .default('')
    .description('本机设备密钥：与设备标识一起绑定归属；页面不显示')
    .volatile(),
  estimateGroupRatio: z.number().min(0).max(10)
    .default(0.8)
    .description('预估费用用的分组折扣（中转站 group_ratio：videosvip=0.8、default=1）')
    .volatile(),
  duration: z.number().step(1).min(4).max(30)
    .default(15)
    .description('兼容旧配置；分段默认按模型上限映射：2.0 为 15 秒、2.5 为 30 秒。需缩短分段时在工具调用中指定。')
    .volatile(),
  singleMaxSeconds: z.number().step(1).min(4).max(30)
    .default(15)
    .description('兼容旧配置；单次直出上限由模型决定：2.0 为 15 秒、2.5 为 30 秒。')
    .volatile(),
  seamTrimSeconds: z.string().default('').description('2.0 默认每接缝裁前段尾6帧、后段头1帧；填0关闭。覆盖为手动裁剪：逗号分隔秒数，对应第2、3…段开头，0–3秒；默认不裁。先预览确认，避免切断对白。').volatile(),
  mergeMode: z.union(['seamless', 'copy', 'reencode'])
    .default('seamless')
    .description(
      '合并方式：seamless=把后段对到前段结尾的亮度/音量，再用短交叉淡化接上（默认，接缝看不出换段）；'
      + 'copy=无损拼接（快，但接缝是硬切，两次生成的色调会差 2-3 级）；reencode=统一重编码',
    )
    .volatile(),
  bgmFadeSeconds: z.number().min(0).max(3)
    .default(0.8)
    .description(
      '合并时音频接缝的交叉淡化秒数（0-3，默认 0.8，0=关）：'
      + '上游每段是各自生成的，续拍段的背景音乐会从头再来，0.25 秒的画面淡化盖不住；'
      + '音频单独拉长淡化盖住音乐重启，画面淡化仍是 0.25 秒（不至于看起来像转场）。',
    )
    .volatile(),
  outputDir: z.string()
    .default('')
    .description('成片输出目录；留空用会话工作目录下的 metaontic-video/')
    .volatile(),
  keepSegments: z.boolean()
    .default(false)
    .description('合并后是否保留分段原片')
    .volatile(),
  resumeLockStaleMinutes: z.number().min(0)
    .default(60)
    .description(
      '暂停目录的「续做锁」超过多少分钟算过期残留（默认 60，0=永不过期）。'
      + '同一份暂停进度同时只能有一次 resume 在跑，否则剩下的段会被提交两遍、重复扣费；'
      + '上一次被强杀 / 宿主放弃调用时锁文件会留下，超过这个时间才允许后来者抢过来。',
    )
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
  pollErrorRetries: z.natural().min(1).max(60)
    .default(5)
    .description(
      '轮询期间「查询失败」的容忍次数：网络抖动、中转站限流、Key 中途被判无效都会让查询报错，'
      + '但任务在上游照常生成——连续失败到这个次数才放弃等待。'
      + '放弃时任务 ID 仍保留，可用 video_status 事后补查，不会把「查不到」当成「没生成」。'
      + '设置页不显示这一项：默认值 5 够用。',
    )
    .volatile(),
});

const DEFAULT_MODEL = 'doubao-seedance-2-0-mini-260615';
const MAX_SEGMENTS = 10;
const MIN_SECONDS = 4;
const MIN_SEGMENT_SECONDS = 4;
/** 单段延长（续拍）的秒数上限：Seedance 原生延长只接受 4 至模型上限（2.0 为 15、2.5 为 30） 秒。 */
const MAX_SEGMENT_SECONDS = 15;
/** Seedance 单段最长 15 秒：不超过它一次直出，超过它才需要延长。 */
const MAX_DIRECT_SECONDS = 15;
/**
 * 单条成片的目标时长上限：段数上限内排得出来的最长时长，先按 120 秒卡住。
 * 段数越少接缝越少，但一条片子拖太长可用的质检/重跑余地也小，所以这里封顶 120 秒。
 */
const MAX_TOTAL_SECONDS = 120;
/**
 * 分辨率写死 720P：中转站这条线路就按 720P 出货，开放给用户调只会
 * 选出一个和实际产出对不上的值（预估价、确认框也会跟着偏），所以不加配置项、
 * 也不接受工具入参——extraParams 里写 resolution 也会被这里覆盖掉。
 */
const FIXED_RESOLUTION = '720p';
/** 输出目录的默认子目录名。 */
const DEFAULT_OUTPUT_DIR = 'metaontic-video';
/** 判断「上游返回的是累计成片」的容差：累计时长的 25%，且至少 1.5 秒。 */
const CUMULATIVE_TOLERANCE_RATIO = 0.25;
const CUMULATIVE_TOLERANCE_MIN_SECONDS = 1.5;

/** 插件服务地址（领 Key、查额度、使用记录）：配置留空时用这个固定域名。 */
const DEFAULT_REGISTER_API = 'https://video.mybfs.cn';
/** 服务端握手头的兜底值（与服务端 REGISTER_CLIENT_TOKEN 对齐）。 */
const DEFAULT_REGISTER_TOKEN = 'metaontic-video-register-v1';
/** 密钥来源标记：设置页「登录」成功后写进配置，表示这把 Key 是服务端下发的。 */
const KEY_ORIGIN_REGISTER = 'register';
/** 额度/汇率兜底：服务端会回真实值，只有拿不到时才用这两个。 */
const DEFAULT_QUOTA_PER_UNIT = 500000;
const DEFAULT_USD_EXCHANGE_RATE = 7.3;
/** 会真正调用视频模型、因而必须人工确认的工具。 */
const GATED_TOOLS = ['video_generate', 'video_extend', 'video_setup'];

/**
 * 预估费用的价目表：照抄中转站 /api/pricing 里 seedance 的 billing_expr。
 *
 * 中转站按 token 计费：``tokens = 宽 × 高 × 帧率 × 秒数 ÷ 1024``
 * （720p/24fps 正好 21600 token/秒），再乘「每 100 万 token 的美元价」得到美元。
 * 实测 15 秒 720p 直出 = 324000 token → 408329 额度，与中转站日志里的预扣费一致，
 * 所以这套算法够用来做「够不够、大概多少钱」的预检。实际以中转站结算为准。
 */
const ESTIMATE_PIXELS = { '480p': [854, 480], '720p': [1280, 720], '1080p': [1920, 1080] };
const ESTIMATE_FPS = 24;
const ESTIMATE_TOKEN_DIVISOR = 1024;
/** 每 100 万 token 的美元价：none = 没有参考素材，video = 带参考图 / 参考视频。 */
const ESTIMATE_RATES: Array<[string, { none: number; video: number }]> = [
  ['doubao-seedance-2-0-mini', { none: 3.150684931507, video: 1.917808219178 }],
  ['doubao-seedance-2-0-fast', { none: 5.068493150685, video: 3.013698630137 }],
];

/** provider 预设：字段留空时按这里的顺序回退到环境变量，再回退到预设默认值。 */
const RELAY_PRESET = {
    baseUrl: '',
    submitPath: '/doubao/api/v3/contents/generations/tasks',
    queryPath: '/doubao/api/v3/contents/generations/tasks/{task_id}',
    model: DEFAULT_MODEL,
    baseEnv: ['NEWAPI_VIDEO_BASE_URL', 'NEWAPI_BASE_URL'],
  modelEnv: ['NEWAPI_VIDEO_MODEL'],
};

const SUCCESS_STATES = new Set(['succeeded', 'success', 'completed', 'complete', 'done', 'finished']);
const FAILED_STATES = new Set(['failed', 'failure', 'error', 'cancelled', 'canceled', 'expired']);
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
  // 只走 New API 中转站，路径/模型都取这一份预设。
  return RELAY_PRESET;
}

function envValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function isVolcengine(config) {
  return ref(config, 'connectionMode', 'service') === 'volcengine';
}

function resolveApiKey(config) {
  if (isVolcengine(config)) return String(ref(config, 'volcengineApiKey', '')).trim();
  // 只认配置里那一把——它只能由设置页「登录」时服务端下发写入，
  // 不读环境变量、也不认手填，避免用到没绑设备 / 没额度的野 Key。
  return String(ref(config, 'apiKey', '')).trim();
}

/**
 * 这把 Key 是不是服务端下发的。
 *
 * 登录成功后设置页会写 keyOrigin=register；更早的版本没写这个标记，
 * 用「设备凭据 + 邮箱」兜底认出来（这两项也只有登录流程会写）。
 */
function isServerIssuedKey(config) {
  if (String(ref(config, 'keyOrigin', '')).trim() === KEY_ORIGIN_REGISTER) return true;
  return Boolean(String(ref(config, 'deviceId', '')).trim())
    && Boolean(String(ref(config, 'deviceSecret', '')).trim())
    && Boolean(String(ref(config, 'registerEmail', '')).trim());
}

function resolveBaseUrl(config) {
  if (isVolcengine(config)) return 'https://ark.cn-beijing.volces.com';
  const preset = relayPreset();
  return (String(ref(config, 'baseUrl', '')).trim() || envValue(preset.baseEnv) || preset.baseUrl)
    .replace(/\/+$/, '');
}

function resolveSubmitPath(config) {
  if (isVolcengine(config)) return '/api/v3/contents/generations/tasks';
  return String(ref(config, 'submitPath', '')).trim() || relayPreset().submitPath;
}

function resolveQueryPath(config, taskId) {
  if (isVolcengine(config)) return `/api/v3/contents/generations/tasks/${encodeURIComponent(taskId)}`;
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
  if (isVolcengine(config)) {
    if (!apiKey) throw new Error('请在 B 火山引擎模式中配置火山 API Key。');
    return;
  }
  if (!apiKey) {
    throw new Error(
      '未配置 API Key：打开「插件 → 已安装插件 → MetaOnticVideo → 查看」，点「登录」领一把——'
      + '服务端会把 Key、上游地址和模型直接写进配置，不用手填。',
    );
  }
  if (!isServerIssuedKey(config)) {
    throw new Error(
      '当前 apiKey 不是服务端下发的，插件拒绝调用：密钥只能在插件详情页点「登录」由服务端下发。'
      + '同一个邮箱再登录一次会把原来那把还给你，不会多开一把。',
    );
  }
  if (!resolveBaseUrl(config)) {
    throw new Error(
      '未配置 baseUrl：正常由「登录」时服务端下发中转站地址；'
      + '缺失时请重新登录，或检查设置页里的上游地址。',
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
    '【镜头运动】在接缝处匹配视频1' + (forward ? '开头的' : '结尾的')
      + '机位、景别、焦段、运镜方向与速度；接缝之外按本段脚本自然运镜或切镜。保持曝光、白平衡、光源方向和场景布局连贯，'
      + '避免无剧情依据的亮度跳变或背景重建；'
      // 两次生成是各自曝光的：不写死这条，接缝处常整体偏暗 2-3 级，看起来像换了一段
      + '整段亮度与色调必须与视频1' + (forward ? '开头' : '结尾') + '一致，不要整体压暗或偏色。',
    '【声音延续】' + (forward
      ? '本段声音在结尾自然衔接视频1开头，台词只讲前置剧情。'
      : '本段声音接续视频1结尾，台词只讲后续剧情。')
      + '保持角色音色与环境底噪一致，每句台词完整说完，不复述原台词。'
      + '原视频有配乐时保持曲目与节奏连贯；原视频无配乐时不新增配乐。',
    forward
      ? '【输出边界】仅输出新增前置片段；原视频开头只用于衔接，不复制原视频画面或已出现的台词。'
      : '【输出边界】仅输出新增续拍片段；参考视频末尾只用于理解当前状态，不把末尾几秒再次输出。起始即推进下一动作，不重做拿起、放下、递手机等已完成动作；不重复上一句对白或其尾音。',
    transition,
    '本段明确指定的运镜和切镜优先，上面的衔接建议不得覆盖已确认的镜头安排。',
  ].join('\n');
}

/**
 * 子进程 / 下载 / 合并这几个辅助函数共用的可选参数。
 * 用显式类型（而不是 `{}` 默认值）才能让 `signal` 这类可选字段被认出来。
 */
interface RunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  binary?: string;
  /** 走 shell 执行（安装命令要在 shell 里展开 PATH、参数与管道）。 */
  shell?: boolean;
}

/** 一次任务跑完的结果（上游是动态 JSON，这里只声明我们会读的字段）。 */
interface TaskResult {
  taskId?: string;
  status: string;
  videoUrl?: string;
  error?: string;
  errorCode?: string;
  model?: string;
}

/** 中转站要能直接拉取参考视频，本地路径与内网地址没有意义。 */
function normalizeReferenceUrl(value) {
  const url = String(value ?? '').trim();
  if (!url) throw new Error('参考视频 URL 不能为空。');
  if (/^asset:\/\/[A-Za-z0-9_-]+$/.test(url)) return url;
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

/* ---------------- 时长规划：不超上限就直出，超过就延长 ---------------- */

/** 模型能力决定单次生成上限，避免旧配置的 15 秒限制影响 2.5。 */
function modelMaxSeconds(config) {
  return isOmniExtendModel(resolveModel(config)) ? 30 : 15;
}

function resolveSingleMax(config) {
  return modelMaxSeconds(config);
}

/** 默认按模型上限续拍；调用方可显式请求更短的分段。 */
function resolveSegmentSeconds(config, requested = undefined) {
  const max = modelMaxSeconds(config);
  return clampInteger(requested, MIN_SEGMENT_SECONDS, max, max);
}

/**
 * 本次配置能排出的最长时长：120 秒与「首段上限 + 每段上限 ×（最大段数-1）」取小。
 * 注意用的是**本次每段秒数**：每段上限调小时，能排出的总长也跟着变短。
 */
function maxTargetSeconds(singleMax, segmentSeconds) {
  return Math.min(MAX_TOTAL_SECONDS, singleMax + (MAX_SEGMENTS - 1) * segmentSeconds);
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

  // 段数取「每段装满上限」所需的最少段数：25 秒 → 15+10，30 秒 → 15+15，
  // 而不是按固定 5 秒切成一堆小段（15+5+5+5）。然后在这几段之间均分，
  // 既保证段数最少，也不会切出 1-3 秒的碎段。
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
/** 在提交前验证逐段提示词，防止将全片剧本重复交给模型。 */
function resolveSegmentPrompts(prompts, planLength) {
  if (prompts === undefined && planLength === 1) return null;
  if (!Array.isArray(prompts) || prompts.length !== planLength
    || prompts.some((value) => typeof value !== 'string' || !value.trim())) {
    throw new Error(`请按完整生成计划提供 segmentPrompts：${planLength} 条非空的逐段提示词，每条仅含本段动作与对白。先补齐提示词再提交，不要重新生成已完成分段。`);
  }
  return prompts.map((value) => value.trim());
}

function buildGenerationPrompt({ prompt, seconds, model = '' }) {
  const timing = isOmniExtendModel(model)
    ? '按本段事件顺序推进；如有时间区间，以本段0秒为起点，区间连续，不遗漏停顿与反应时间。'
    : '按本段事件顺序自然推进，以镜头序号或先后阶段组织内容，不依赖精确时间戳，不为追逐秒点压缩动作或对白。';
  return [
    `生成 ${seconds} 秒视频。`,
    String(prompt).trim(),
    timing,
    '人物身份、服装、场景与光线保持连贯；每句台词完整说完。未明确要求时不新增字幕、水印、片头片尾或配乐。',
  ].join('\n');
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
  if (/^asset:\/\/[A-Za-z0-9_-]+$/.test(url)) return url;
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`${label} 必须是 https:// 或 http:// 开头的公网 URL（不能用本地文件路径）。`);
  }
  return url;
}

/** 允许上传的图片类型：扩展名 → MIME。 */
const IMAGE_EXT_TO_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};
/** 单张图片上限：内联成 base64 后请求体会涨约 1/3，压在这个大小比较稳。 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** 用文件头认图片，避免把改了扩展名的非图片文件读进去发走。 */
function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 6 && (buffer.subarray(0, 6).toString('latin1') === 'GIF87a' || buffer.subarray(0, 6).toString('latin1') === 'GIF89a')) return 'image/gif';
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (buffer.length >= 4 && ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a) || (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00))) return 'image/tiff';
  return null;
}

/**
 * 目标画幅的像素尺寸：ratio + 720P 算出来，参考图适配画幅时用。
 * adaptive 表示「让模型按参考图自己决定画幅」，没有固定目标，不参与适配。
 */
const CANVAS_SIZES: Record<string, [number, number]> = {
  '16:9': [1280, 720],
  '9:16': [720, 1280],
  '4:3': [960, 720],
  '3:4': [720, 960],
  '1:1': [720, 720],
};

function canvasSize(ratio) {
  return CANVAS_SIZES[String(ratio ?? '').trim()] || null;
}

/** 适配后的参考图放这里：同一张图反复提交时不必每次重跑 ffmpeg。 */
function referenceCacheDir() {
  return path.join(os.tmpdir(), 'metaontic-video-reference');
}

/**
 * 把本机参考图先适配到目标画幅再提交。
 *
 * i2v 会按参考图的比例出片：竖版定妆照配 16:9 的请求，拿回来的还是竖版。
 * 这里沿用 videoflow-ai 的做法——原图等比缩到目标画幅做模糊底、居中叠上原图，
 * 既不裁掉主体也不留黑边；尺寸本来就对得上就直接用原图。
 * 只有本机文件能这么处理（公网 URL 交给上游自己取），ffmpeg 缺失或适配失败
 * 都退回原图，不阻塞生成。
 */
/**
 * 缓存文件是不是「完整的、画幅也对」。
 * 以前只判断 `exists`：并发调用里另一个正在写同一个文件时，会命中写到一半的 jpg
 * （base64 发上去就是坏图）。这里要求文件存在且非空；探得出尺寸时再核对画幅。
 * 没有可用的 ffprobe 时只能按「存在且非空」放行，否则缓存永远命不中。
 */
async function isUsableFit(dest, width, height, config, signal) {
  const info = await stat(dest).catch(() => null);
  if (!info?.isFile() || info.size <= 0) return false;
  const media = await probeMedia(dest, config, signal);
  if (!media?.width || !media?.height) return true;
  return media.width === width && media.height === height;
}

/** 同一张图的适配任务：并发调用共用同一个 Promise，避免同时开 N 个 ffmpeg 写同一个文件。 */
const fitInFlight = new Map();

async function fitImageToCanvas(absPath, size, config, signal) {
  const [width, height] = size;
  const media = await probeMedia(absPath, config, signal);
  if (media?.width === width && media?.height === height) return absPath;
  const info = await stat(absPath).catch(() => null);
  const key = `${path.basename(absPath, path.extname(absPath))}-${info?.size ?? 0}`
    + `-${Math.round(info?.mtimeMs ?? 0)}-${width}x${height}.jpg`;
  const dest = path.join(referenceCacheDir(), key);
  if (await isUsableFit(dest, width, height, config, signal)) return dest;

  // 已经有一次适配在跑（并发调用同一张图）：等它，而不是再跑一遍 ffmpeg 写同一个文件。
  const running = fitInFlight.get(dest);
  if (running) {
    await running.catch(() => {});
    if (await isUsableFit(dest, width, height, config, signal)) return dest;
    // 那一次没成（比如它的调用被中断了）：自己再试一次；这次也被取消就直接用原图。
    if (signal?.aborted) return absPath;
  }

  const task = (async () => {
    await mkdir(referenceCacheDir(), { recursive: true });
    const graph = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,`
      + `crop=${width}:${height},gblur=sigma=24[bg];`
      + `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease[fg];`
      + `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`;
    // 先写唯一的临时文件、验过画幅再 rename 顶上：并发读者永远看不到写了一半的 jpg。
    // 尾巴要留在扩展名前面——ffmpeg 按扩展名挑封装器，`.jpg.fit-…` 这种名字它会直接报错。
    const temp = `${dest.replace(/\.jpg$/, '')}.${uniqueSuffix('fit')}.jpg`;
    try {
      const { code } = await runProcess(resolveBinary(config, 'ffmpegBinary', 'ffmpeg'), [
        '-y', '-i', absPath, '-filter_complex', graph, '-frames:v', '1', '-q:v', '2', temp,
      ], { signal, timeoutMs: 120000 });
      if (code !== 0) return;
      const fitted = await probeMedia(temp, config, signal);
      if (fitted?.width === width && fitted?.height === height) await rename(temp, dest);
    } catch {
      // 没装 ffmpeg、或这张图 ffmpeg 处理不了：按原图提交
    } finally {
      await rm(temp, { force: true }).catch(() => {});
    }
  })();
  fitInFlight.set(dest, task);
  try {
    await task;
  } finally {
    fitInFlight.delete(dest);
  }
  return (await isUsableFit(dest, width, height, config, signal)) ? dest : absPath;
}

/** 用户说「我刚上传的那张图」时的简写：latest / latest:2（第 2 新的）等。 */
const UPLOAD_ALIAS_PATTERN = /^(?:latest|newest|recent|最近上传(?:的图片)?|最新上传(?:的图片)?|刚上传(?:的图片)?|最新图片|刚拖进来的图片)$/i;
/** 「最近上传」只看这个时间窗内的附件：窗口太长容易挑到无关的旧图。 */
const UPLOAD_WINDOW_MS = 2 * 60 * 60 * 1000;

/** DSH 主目录（`DSH_HOME`，默认 `~/.dsh`）。 */
function dshHome() {
  const fromEnv = String((typeof process !== 'undefined' && process.env?.DSH_HOME) || '').trim();
  return fromEnv || path.join(os.homedir(), '.dsh');
}

/** Harness 的对话附件库：内容寻址存的是原始图片字节（无扩展名）。 */
function attachmentObjectsDir() {
  return path.join(dshHome(), 'attachments', 'v1', 'objects');
}

/** 只读文件头认图片，附件库里的对象没有扩展名，只能靠文件头。 */
async function sniffFileImage(file) {
  let handle;
  try {
    handle = await open(file, 'r');
    const head = Buffer.alloc(32);
    const { bytesRead } = await handle.read(head, 0, head.length, 0);
    return sniffImageMime(head.subarray(0, bytesRead));
  } catch {
    return null;
  } finally {
    await handle?.close().catch(() => {});
  }
}

/**
 * 找出用户在对话里最近上传的图片，按上传时间从新到旧排。
 *
 * 用户把图片拖进对话框时，Harness 会先把原始字节收进附件库
 * （`$DSH_HOME/attachments/v1/objects/<xx>/<sha256>`）——**即使当前模型不支持图片、
 * 消息被 `MODEL_DOES_NOT_SUPPORT_IMAGES` 拦下来，文件也已经落盘了**。
 * 所以插件可以直接按时间从这里面取图，用户不必再自己找路径：模型看不看得见图都不影响出片。
 */
async function findRecentUploadedImages(windowMs = UPLOAD_WINDOW_MS) {
  const root = attachmentObjectsDir();
  const shards = await readdir(root, { withFileTypes: true }).catch(() => []);
  const cutoff = Date.now() - windowMs;
  const found = [];
  for (const shard of shards) {
    if (!shard.isDirectory()) continue;
    const dir = path.join(root, shard.name);
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const abs = path.join(dir, entry.name);
      const info = await stat(abs).catch(() => null);
      if (!info || info.mtimeMs < cutoff) continue;
      const mime = await sniffFileImage(abs);
      if (mime) found.push({ abs, mime, bytes: info.size, mtimeMs: info.mtimeMs });
    }
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * 报错里回显用户输入时截断：base64 动辄几十万字符，原样带进错误信息会把结果撑爆。
 */
function brief(value, limit = 80) {
  const text = String(value ?? '');
  return text.length > limit ? `${text.slice(0, limit)}…（共 ${text.length} 字符）` : text;
}

/**
 * 纯 base64（不带 `data:` 前缀）也认：
 * - 解开能认出图片头 → 补 `data:` 前缀内联；
 * - 明显是一大坨 base64 但解出来不是图片 → 直接报错，别退回「当路径」让人一头雾水；
 * - 短的、或不像 base64 的 → 返回 null，交给路径那条分支。
 */
function inlineBase64Image(raw, label) {
  const compact = String(raw ?? '').replace(/\s+/g, '');
  if (compact.length < 64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  const buffer = Buffer.from(compact, 'base64');
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(
      `${label} 解出来有 ${(buffer.length / 1048576).toFixed(1)} MB，`
      + `请压到 ${MAX_IMAGE_BYTES / 1048576} MB 以内再传。`,
    );
  }
  const mime = sniffImageMime(buffer);
  if (mime) return { url: `data:${mime};base64,${compact}`, source: 'inline', bytes: buffer.length };
  // 长到不可能是文件名的长度，还解不出图片头：按「base64 传错了」报，不退回路径
  if (compact.length >= 256) {
    throw new Error(
      `${label} 看着是 base64，但解出来的内容不是图片（只认 jpg/png/webp/bmp/gif/tiff 的文件头）。`,
    );
  }
  return null;
}

/**
 * 把用户给的图片统一成请求里能用的 `image_url.url`，四种入参都收：
 * - `https://` / `http://`：照原样用（上游自己取图，最省事）；
 * - `data:image/...;base64,...`：原样内联；
 * - 纯 base64：认出图片头就补上 `data:` 前缀内联（`Buffer` 能解、文件头是图片才算）；
 * - 本机路径（含对话里 @ 引用的上传文件、`~` 开头的路径）：读进来内联成
 *   `data:<mime>;base64,...`——上游取不到本机地址，这是这条线路上唯一可行的形态
 *   （videoflow-ai 的 `image_ref_to_payload` 也这么干，中转站的图片接口同样把上传文件
 *   在网关侧转成同名 data URI）。
 * 本机图片在确定画幅（ratio 不是 adaptive）时会先适配画幅再内联；URL / base64 已经是字节流，原样交给上游。
 */
async function resolveImageInput(value, label, fit = null) {
  const raw = String(value ?? '').trim().replace(/^@/, '');
  if (!raw) throw new Error(`${label} 不能为空。`);
  if (/^https?:\/\//i.test(raw)) return { url: raw, source: 'url' };
  if (/^data:image\//i.test(raw)) return { url: raw, source: 'inline' };
  const inlined = inlineBase64Image(raw, label);
  if (inlined) return inlined;

  let abs;
  let info;
  let upload = null;
  // 「我刚上传的那张图」：latest / latest:2（第 2 新的）/ 最近上传 等简写
  const aliasParts = /^([^\s:]+)(?::(\d+))?$/.exec(raw);
  const aliasName = aliasParts ? aliasParts[1] : '';
  const uploadIndex = aliasParts && aliasParts[2] ? Math.max(1, Number(aliasParts[2])) : 1;
  if (UPLOAD_ALIAS_PATTERN.test(aliasName)) {
    const index = uploadIndex;
    const uploads = await findRecentUploadedImages();
    const picked = uploads[index - 1];
    if (!picked) {
      throw new Error(
        `${label} 写的是「最近上传的图片」${index > 1 ? `（第 ${index} 新）` : ''}，但 Harness 附件库里`
        + `最近 ${UPLOAD_WINDOW_MS / 3600000} 小时只有 ${uploads.length} 张图片，取不到。`
        + '请直接把图片路径或公网 URL 发过来。',
      );
    }
    abs = picked.abs;
    info = { size: picked.bytes };
    upload = {
      uploadedAt: new Date(picked.mtimeMs).toISOString(),
      recentUploads: uploads.length,
      uploadIndex: index,
    };
  } else {
    abs = path.resolve(raw.startsWith('~/') || raw === '~' ? path.join(os.homedir(), raw.slice(1)) : raw);
    const ext = path.extname(abs).toLowerCase();
    if (!IMAGE_EXT_TO_MIME[ext]) {
      throw new Error(
        `${label} 既不是 http(s) 链接、base64，也不是支持的图片文件：${brief(raw)}。`
        + `本机图片请用 ${Object.keys(IMAGE_EXT_TO_MIME).join(' / ')} 之一，`
        + '用户刚在对话里上传的图直接写 latest。',
      );
    }
    info = await stat(abs).catch(() => null);
    if (!info?.isFile()) {
      throw new Error(`${label} 找不到文件：${abs}（用户刚在对话里上传的图可以直接写 latest）`);
    }
  }

  // 先适配画幅，再按「真正要发出去的那张图」做大小与格式校验
  const submitPath = fit?.size
    ? await fitImageToCanvas(abs, fit.size, fit.config, fit.signal)
    : abs;
  let size = info.size;
  if (submitPath !== abs) {
    const fittedInfo = await stat(submitPath).catch(() => null);
    if (!fittedInfo?.isFile()) throw new Error(`${label} 读不出来：${abs}`);
    size = fittedInfo.size;
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new Error(
      `${label} 太大（${(size / 1048576).toFixed(1)} MB），请压到 `
      + `${MAX_IMAGE_BYTES / 1048576} MB 以内再传：${abs}`,
    );
  }
  const buffer = await readFile(submitPath);
  const mime = sniffImageMime(buffer);
  if (!mime) throw new Error(`${label} 不是有效的图片文件（读到的内容不是 jpg/png/webp/bmp/gif/tiff）：${abs}`);
  const resolved: Record<string, unknown> = {
    url: `data:${mime};base64,${buffer.toString('base64')}`,
    source: upload ? 'upload' : 'file',
    localPath: submitPath,
    bytes: buffer.length,
    ...(upload || {}),
  };
  if (submitPath !== abs) {
    resolved.originalPath = abs;
    resolved.fittedTo = `${fit.size[0]}x${fit.size[1]}`;
  }
  return resolved;
}

/**
 * 直出请求体：文本 + 可选参考图（首帧 / 尾帧 / 人物形象参考），沿用 contents-generation 的原生格式。
 *
 * 火山直连遵循官方多图与任务互斥限制；服务端模式保留单参考图兼容策略。
 */
/** 官方图片任务互斥校验在读取或转换素材之前执行。 */
function validateImageRoles(args, direct, model) {
  const refs = Array.isArray(args.referenceImages) ? args.referenceImages
    : (args.referenceImages ? [args.referenceImages] : []);
  if (args.lastFrameUrl && !args.firstFrameUrl) throw new Error('尾帧必须与首帧一起传入。');
  if (direct && refs.length && (args.firstFrameUrl || args.lastFrameUrl)) {
    throw new Error('火山接口的首尾帧与参考图模式互斥，请选择一种；如需组合，用参考图模式并在提示词指定首尾画面。');
  }
  const limit = direct ? (isOmniExtendModel(model) ? 30 : 9) : 1;
  if (direct && refs.length > limit) throw new Error(`当前模型最多支持 ${limit} 张参考图。`);
  if (refs.some((value) => typeof value !== 'string' || !value.trim())) throw new Error('每张参考图必须是非空字符串。');
  return { refs, limit };
}

async function buildGenerationBody(config, args, seconds, options: { signal?: AbortSignal } = {}) {
  validateImageRoles(args, isVolcengine(config), resolveModel(config));
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

  // 人物形象 / 主体参考图：只发第一张（上游每个角色位只认一张）
  const rawReferences = Array.isArray(args.referenceImages)
    ? args.referenceImages
    : (args.referenceImages ? [args.referenceImages] : []);
  const references = rawReferences.map((item) => String(item ?? '').trim()).filter(Boolean);
  if (rawReferences.length && !references.length) {
    throw new Error('参考图（referenceImages）不能是空字符串。');
  }
  if (isVolcengine(config)) {
    for (const [index, reference] of references.entries()) {
      await addImage(reference, 'reference_image', `参考图 ${index + 1}`);
    }
  } else if (references.length) {
    if (references.length > 1) notes.push(`A 模式中转兼容限制：只使用第1张参考图，其余 ${references.length - 1} 张未提交。需要多图时请使用火山直连。`);
    await addImage(references[0], 'reference_image', '参考图 1');
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
async function runTask(config, body, signal): Promise<TaskResult> {
  const created = await createTask(config, body, signal);
  const taskId = extractTaskId(created);
  if (!taskId) throw new Error('创建任务失败：响应中缺少任务 ID。');
  try {
    const final = await waitForCompletion(config, taskId, signal);
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

/* ---------------- 分段下载与 ffmpeg 合并 ---------------- */

function resolveBinary(config, key, fallback) {
  return String(ref(config, key, '')).trim() || fallback;
}

/** 命令输出的末尾若干字符：安装日志很长，只留最后一截给用户看。 */
function tail(text, limit = 600) {
  const clean = String(text || '').trim();
  return clean.length > limit ? `…${clean.slice(-limit)}` : clean;
}

function formatSeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? '');
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

/**
 * 临时文件名用的唯一尾巴：进程号 + 自增序号 + 随机串。
 * 插件对宿主声明「并发安全」，同一个会话里可能同时跑多次调用（多镜并行、用户连点两次「继续」）；
 * 固定的临时名（`x.mp4.part`、`x.align1.mp4`、`x.work.mp4`）会让并发调用互相踩——
 * 一边还在写、另一边已经 rename/读取，拿到的就是半截文件。所有中间产物都带这个尾巴。
 */
let tempSequence = 0;
function uniqueSuffix(prefix = 'tmp') {
  tempSequence = (tempSequence + 1) % 1000000000;
  return `${prefix}-${process.pid}-${tempSequence}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
    + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

/**
 * 给这次生成占一个唯一的「时间戳」：它同时用作分段目录名和成片文件名前缀。
 * 光靠秒级时间戳会撞：工具是并发安全的、多镜也会并行发起，同一秒里的两次调用会
 * 写同一批分段文件、成片互相覆盖（关掉 keepSegments 时还会把对方正在用的分段删掉）。
 * 用 `mkdir` 原子占位来确定唯一后缀，避免「先查后建」之间的竞态。
 */
async function allocateStamp(outDir: string, base: string) {
  const parent = path.join(outDir, 'segments');
  await mkdir(parent, { recursive: true });
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const stamp = attempt === 1 ? base : `${base}-${attempt}`;
    const dir = path.join(parent, stamp);
    try {
      await mkdir(dir);
      return { stamp, segmentsDir: dir };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }
  throw new Error(`无法在 ${parent} 下分配唯一的分段目录（同名太多）。`);
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
async function runProcess(
  binary: string,
  args: string[],
  { signal, timeoutMs = 1800000, shell = false }: RunOptions = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], ...(shell ? { shell: true } : {}) });
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
    function settle(error: Error | null = null, value: any = undefined) {
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

/**
 * 本机能不能调用 ffmpeg：不能就不要去合成，直接返回分段列表。
 * 只做一次轻量 `-version`，不缓存结果——用户装好 ffmpeg 后重跑应立即生效。
 */
async function hasFfmpeg(config, signal) {
  const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
  try {
    const { code } = await runProcess(binary, ['-version'], { signal, timeoutMs: 20000 });
    return code === 0;
  } catch {
    return false;
  }
}

/** 本机操作系统名，只用来挑安装命令；取不到就按 Linux 处理。 */
function currentPlatform(): string {
  try {
    return (typeof process !== 'undefined' && process.platform) || 'linux';
  } catch {
    return 'linux';
  }
}

/** macOS 上连 Homebrew 都没有时的第一步。 */
const HOMEBREW_BOOTSTRAP = '/bin/bash -c "$(curl -fsSL '
  + 'https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';

/**
 * 按操作系统给出 ffmpeg 的安装方式。
 * 只给「装一次就完事」的官方渠道：macOS 走 Homebrew，Windows 走 winget（备选 choco），
 * Linux 同时给 Debian 系与 Fedora 系——用户照着抄一行就行。
 */
function ffmpegInstallOptions(platform = currentPlatform()) {
  if (platform === 'darwin') {
    return {
      os: 'macOS',
      installs: [
        { label: 'macOS（Homebrew）', command: 'brew install ffmpeg' },
        {
          label: 'macOS（还没装 Homebrew 就先装它）',
          command: HOMEBREW_BOOTSTRAP,
        },
      ],
      // 连包管理器都没有时的前置步骤（macOS 才有）
      bootstrap: { label: 'macOS（先装 Homebrew）', command: HOMEBREW_BOOTSTRAP },
    };
  }
  if (platform === 'win32') {
    return {
      os: 'Windows',
      installs: [
        { label: 'Windows（winget）', command: 'winget install --id Gyan.FFmpeg -e' },
        { label: 'Windows（Chocolatey）', command: 'choco install ffmpeg' },
      ],
      bootstrap: null,
    };
  }
  return {
    os: 'Linux',
    installs: [
      {
        label: 'Linux（Debian / Ubuntu）',
        command: 'sudo apt update && sudo apt install -y ffmpeg',
      },
      { label: 'Linux（Fedora / RHEL / CentOS）', command: 'sudo dnf install -y ffmpeg' },
    ],
    bootstrap: null,
  };
}

/** ffmpeg 装完常常不立刻进 PATH；这几个常见位置也找一遍，好让用户直接填进 ffmpegBinary。 */
function commonFfmpegPaths(platform = currentPlatform()) {
  if (platform === 'darwin') return ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
  if (platform === 'win32') return [];
  return ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/snap/bin/ffmpeg'];
}

/** 探一次可执行文件版本，返回首行（拿不到返回 null）。 */
async function probeBinaryVersion(binary, signal) {
  try {
    const { code, stdout, stderr } = await runProcess(binary, ['-version'], { signal, timeoutMs: 20000 });
    if (code !== 0) return null;
    const line = String(stdout || stderr).split('\n').map((item) => item.trim()).filter(Boolean)[0];
    return line || 'ok';
  } catch {
    return null;
  }
}

/** 装完之后在常见位置里找一次 ffmpeg：找到就把绝对路径交出去。 */
async function findInstalledFfmpeg(signal) {
  for (const candidate of commonFfmpegPaths()) {
    if (await probeBinaryVersion(candidate, signal)) return candidate;
  }
  return null;
}

/**
 * ffmpeg 缺失时给用户看的引导：为什么需要它、现在该怎么装、装完怎么让合并生效。
 * 结果里的 installHint 会原样带进工具返回值，让模型照着念给用户听，
 * 不是只说一句「已跳过合并」——这一步的目的就是把人引到安装上。
 */
function ffmpegInstallHint(config) {
  const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
  const { os, installs } = ffmpegInstallOptions();
  const lines = [
    `本机没有找到可用的 ffmpeg（${binary}），所以「把多段合并成一条」这步暂时没做，`
      + '分段文件都在，一条都不少。',
    `装一下 ffmpeg 就能合并（你当前是 ${os}）：`,
    ...installs.map((item) => `  · ${item.label}：${item.command}`),
    '装好后重跑这次生成，分段会自动合并成一条，不用重新生成；'
      + '如果 ffmpeg 已经装了但不在默认位置，把它的绝对路径填到插件设置里的「ffmpeg 路径」也一样管用。',
    'ffmpeg 的安装包里自带 ffprobe，装完分段探测也一起好了。',
    '想让我来装就说一声 —— 我会用 video_setup 执行安装（执行前宿主会先让你确认命令）。',
  ];
  return { binary, os, installs, hint: lines.join('\n') };
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

/** 单段下载的超时（毫秒）：成片也就几十 MB，卡住的连接不该一直挂着。 */
const DOWNLOAD_TIMEOUT_MS = 15 * 60 * 1000;

async function downloadFile(url: string, destPath: string, { signal }: RunOptions = {}) {
  await mkdir(path.dirname(destPath), { recursive: true });
  // 同名 dest 可能被并发下载（尤其是两次 resume 补同一段）：.part 必须带唯一尾巴，
  // 否则一个在写、另一个 rename 走，落盘的就是半截文件。
  const partial = `${destPath}.${uniqueSuffix('part')}`;
  const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(url, { signal: requestSignal });
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
    await pipeline(Readable.fromWeb(response.body as any), createWriteStream(partial));
    await rename(partial, destPath);
    return destPath;
  } catch (error) {
    // 下载中断时清掉半截文件，别在分段目录里留下 *.part
    await rm(partial, { force: true }).catch(() => {});
    if (error?.code === 'download_failed') throw error;
    if (signal?.aborted) throw abortError();
    throw Object.assign(new Error(`下载分段失败：${error?.message || error}（${url}）`), {
      code: 'download_failed',
    });
  }
}

function evenNumber(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  const rounded = Math.round(number);
  const even = rounded % 2 === 0 ? rounded : rounded - 1;
  // 极小（1 这种）或异常值会算出 0，scale=0 会让 ffmpeg 直接失败，兜底成 2。
  return even >= 2 ? even : 2;
}

/**
 * 把分段合并成一个文件：先试无损拼接，需要时统一重编码（带音频，失败再退回只并视频）。
 */
/** 分段的音频比视频长出这么多帧时，认为封装补白会在接缝处留下空洞。 */
const AUDIO_PADDING_TOLERANCE_FRAMES = 1;

/**
 * 接缝交叉淡化的时长（秒）：够盖住两次生成之间的微小差异，又不至于看起来像“转场”。
 */
const SEAM_FADE_SECONDS = 0.25;
/**
 * 音频接缝的默认淡化时长（秒）：画面 0.25 秒够用，但续拍段的背景音乐是重新起奏的，
 * 0.25 秒盖不住「音乐从头开始」；音频单独拉长到 0.8 秒（配置项 `bgmFadeSeconds`）。
 */
const BGM_FADE_SECONDS = 0.8;
/** 量接缝两侧水平的取样窗口（秒）：太短会被单帧噪声带偏，太长会把整段色调带进来。 */
const SEAM_WINDOW_SECONDS = 0.5;
/** 接缝补正的上下限：数据异常时兜底，避免把画面整体提亮/削暗、音量抬爆。 */
const SEAM_MAX_LUMA_SHIFT = 12;
const SEAM_MAX_AUDIO_GAIN_DB = 4;

/**
 * 量一个时间窗的平均亮度（YAVG，限程 Y 0-255）。
 * signalstats 的结果走 ffmpeg 的日志（stderr），所以这里不能用 `-v error`。
 * @returns 平均亮度；取不到（没 ffmpeg / 探测失败）返回 null。
 */
async function measureAverageLuma(file, atSeconds, windowSeconds, config, signal) {
  try {
    const { code, stderr } = await runProcess(resolveBinary(config, 'ffmpegBinary', 'ffmpeg'), [
      '-hide_banner', '-nostats',
      '-ss', Math.max(0, atSeconds).toFixed(3),
      '-t', Math.max(0.05, windowSeconds).toFixed(3),
      '-i', file,
      '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG',
      '-f', 'null', '-',
    ], { signal, timeoutMs: 120000 });
    if (code !== 0) return null;
    const values = [...String(stderr).matchAll(/lavfi\.signalstats\.YAVG=(-?[\d.]+)/g)]
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  } catch {
    return null;
  }
}

/** 量一个时间窗的平均响度（mean_volume，dBFS）；没有音轨或取不到时返回 null。 */
async function measureLoudness(file, atSeconds, windowSeconds, config, signal) {
  try {
    const { code, stderr } = await runProcess(resolveBinary(config, 'ffmpegBinary', 'ffmpeg'), [
      '-hide_banner', '-nostats',
      '-ss', Math.max(0, atSeconds).toFixed(3),
      '-t', Math.max(0.05, windowSeconds).toFixed(3),
      '-i', file,
      '-af', 'volumedetect',
      '-f', 'null', '-',
    ], { signal, timeoutMs: 120000 });
    if (code !== 0) return null;
    const match = String(stderr).match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) && value > -99 ? value : null;
  } catch {
    return null;
  }
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 量每个接缝两侧的水平：前段结尾的亮度/响度 vs 后段开头的亮度/响度。
 * 后段整段按差值修正——两次生成各自曝光不同，接缝的台阶就出在这里。
 */
async function measureSeams(config, files, durations, { signal, binary }) {
  const window = SEAM_WINDOW_SECONDS;
  const seams = [];
  for (let index = 1; index < files.length; index += 1) {
    const prevLength = durations[index - 1];
    const seam = { index: index + 1, lumaDelta: 0, audioGainDb: 0 };
    const prevAt = Math.max(0, prevLength - window);
    const prevLuma = await measureAverageLuma(files[index - 1], prevAt, window, config, signal);
    const nextLuma = await measureAverageLuma(files[index], 0, window, config, signal);
    if (prevLuma != null && nextLuma != null) {
      seam.lumaDelta = Number(
        clampNumber(prevLuma - nextLuma, -SEAM_MAX_LUMA_SHIFT, SEAM_MAX_LUMA_SHIFT).toFixed(2),
      );
    }
    const prevLoud = await measureLoudness(files[index - 1], prevAt, window, config, signal);
    const nextLoud = await measureLoudness(files[index], 0, window, config, signal);
    if (prevLoud != null && nextLoud != null) {
      seam.audioGainDb = Number(
        clampNumber(prevLoud - nextLoud, -SEAM_MAX_AUDIO_GAIN_DB, SEAM_MAX_AUDIO_GAIN_DB).toFixed(2),
      );
    }
    seams.push(seam);
  }
  return seams;
}

/**
 * 无缝合并：分段是两次独立生成，实测接缝处画面会暗 2-3 级、音量小 1 dB 左右，
 * 直接 concat 就是一次硬切，看起来像「另拍一段贴上去」，而不是接着往下演。
 *
 * 这里做三件事：按接缝实测值把后段整段对齐（亮度用 `lut=y=val+Δ`，实测 `eq` 在小偏移上会取整出错），
 * 画面用 xfade 做 0.25 秒交叉淡化盖住切口，音频再用 acrossfade 做更长的淡化——
 * 续拍段的背景音乐是重新起奏的（见 `bgmFadeSeconds`），画面淡化盖不住音乐重启。
 * @returns 合并结果；任何一步不适合做无缝（分段太短、量不到数据）就返回 null 交给调用方回退。
 */
async function mergeClipsSeamless(config, files, probed, outPath, { signal, binary }) {
  const durations = files.map((_, index) => {
    const media = probed[index] || {};
    return Number(media.videoDurationSeconds) || Number(media.durationSeconds) || 0;
  });
  if (durations.some((value) => !(value > 0))) return null;
  const shortest = Math.min(...durations);
  // xfade 的偏移必须为正：整体时长比淡化时长短时根本放不下过渡。
  const fade = Number(Math.min(SEAM_FADE_SECONDS, shortest / 4).toFixed(3));
  if (!(fade >= 0.05)) return null;
  // 上游每段各自配乐：续拍段的背景音乐常从头再来，0.25 秒的音频淡化盖不住音乐重启，
  // 所以音频单独用更长的淡化（默认 0.8 秒），画面仍用 fade，避免看起来像转场。
  const bgmFade = clampNumber(Number(ref(config, 'bgmFadeSeconds', BGM_FADE_SECONDS)) || 0, 0, 3);
  const audioFade = bgmFade > 0
    ? Number(Math.min(Math.max(bgmFade, fade), shortest / 3).toFixed(3))
    : fade;
  // 音频和视频的淡化时长不同会长短不一：按视频的总时长把音频补齐/裁齐，避免尾部对不上。
  const videoTotal = Number(
    (durations.reduce((sum, value) => sum + value, 0) - (files.length - 1) * fade).toFixed(3),
  );

  const seams = await measureSeams(config, files, durations, { signal, binary });
  const withAudio = probed.length > 0 && probed.every((media) => media?.hasAudio);

  const first = probed.find((media) => media && media.width && media.height) || {};
  const width = evenNumber(first.width, 1280);
  const height = evenNumber(first.height, 720);
  const fps = Math.min(60, Math.max(24, Math.round(first.fps || 30)));

  const videoParts = [];
  const audioParts = [];
  for (const [index, file] of files.entries()) {
    const seam = seams.find((item) => item.index === index + 1);
    const shift = seam && Math.abs(seam.lumaDelta) >= 0.5
      ? `lut=y='clip(val${seam.lumaDelta > 0 ? '+' : ''}${seam.lumaDelta},0,255)',`
      : '';
    videoParts.push(
      `[${index}:v]${shift}scale=${width}:${height}:force_original_aspect_ratio=decrease,`
      + `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},`
      // 这里不要再加 settb / setpts：xfade 要求输入是恒定帧率，被它们改过之后会报
      // 「inputs needs to be a constant frame rate; current rate of 1/0」直接失败。
      + `format=yuv420p[v${index}]`,
    );
    const gain = seam && Math.abs(seam.audioGainDb) >= 0.2 ? `volume=${seam.audioGainDb}dB,` : '';
    audioParts.push(
      `[${index}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,`
      + `${gain}asetpts=PTS-STARTPTS[a${index}]`,
    );
  }

  // xfade / acrossfade 只能两两相接，所以按顺序链式串起来；偏移要把前面累计的淡化时长扣掉。
  const videoChain = [];
  const audioChain = [];
  let offset = durations[0] - fade;
  let lastVideo = '[v0]';
  let lastAudio = '[a0]';
  for (let index = 1; index < files.length; index += 1) {
    const outVideo = `[x${index}]`;
    videoChain.push(
      `${lastVideo}[v${index}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}${outVideo}`,
    );
    lastVideo = outVideo;
    if (withAudio) {
      const outAudio = `[y${index}]`;
      audioChain.push(`${lastAudio}[a${index}]acrossfade=d=${audioFade}:c1=tri:c2=tri${outAudio}`);
      lastAudio = outAudio;
    }
    offset += durations[index] - fade;
  }
  if (withAudio) {
    // acrossfade 会把两端叠在一起，音频总长比视频短 (段数-1) × (audioFade - fade)；
    // 尾部补静音再裁到视频总长，两条轨就等长，不会在片尾留下画面缺失或静音尾巴。
    const outAudio = '[afinal]';
    audioChain.push(
      `${lastAudio}apad=whole_dur=${videoTotal},atrim=0:${videoTotal},asetpts=PTS-STARTPTS${outAudio}`,
    );
    lastAudio = outAudio;
  }

  const filter = [
    ...videoParts,
    ...(withAudio ? audioParts : []),
    ...videoChain,
    ...audioChain,
  ].join(';');

  await rm(outPath, { force: true });
  const args = ['-y'];
  for (const file of files) args.push('-i', file);
  args.push('-filter_complex', filter, '-map', lastVideo);
  if (withAudio) args.push('-map', lastAudio);
  args.push(
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    ...(withAudio ? ['-c:a', 'aac', '-b:a', '192k'] : []),
    '-movflags', '+faststart', outPath,
  );
  const { code, stderr } = await runProcess(binary, args, { signal });
  if (code !== 0 || !(await exists(outPath))) {
    await rm(outPath, { force: true });
    return { path: null, mode: 'seamless', seams, error: String(stderr).trim().slice(-400) };
  }
  return { path: outPath, mode: 'seamless', seams, fade, audioFade };
}

/**
 * 上游分段的音频常比视频长几十毫秒（封装补白）：concat 会按容器时长偏移，
 * 接缝处就留下 1-2 帧没有画面的空洞（看起来「缺了一小段」），重编码路径还会让音画逐段错位。
 * 这里把「非末段」的音频裁到与视频等长：视频轨保持 -c copy，只重编音频。
 * @returns 对齐后的文件列表、需要清理的临时文件、被裁齐的分段信息。
 */
async function alignSegmentAudio(
  config,
  files,
  probed,
  outPath,
  { signal, binary }: RunOptions = {},
) {
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
    // 文件名带唯一尾巴：并发的两次合并（比如同时 resume 同一个目录）不会互相覆盖中间产物。
    const temp = `${outPath}.${uniqueSuffix(`align${index + 1}`)}.mp4`;
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

async function mergeClips(config, files: string[], outPath: string, { signal }: RunOptions = {}) {
  const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
  await mkdir(path.dirname(outPath), { recursive: true });
  await rm(outPath, { force: true });
  // 所有 ffmpeg 产物先写这个唯一的工作文件，成功后再原子 rename 到 outPath：
  // 并发合并同一个目标路径时，读者要么看到旧文件、要么看到完整的新文件，不会拿到半截 mp4。
  const work = `${outPath}.${uniqueSuffix('work')}.mp4`;
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
    config, files, probed, work, { signal, binary },
  );
  files = aligned;
  try {

    const mergeMode = ref(config, 'mergeMode', 'seamless');

    // 默认走无缝：分段是两次独立生成，色调/响度本来就有台阶，硬切一眼能看出是两段。
    // 任何一步不满足条件（分段太短、量不到数据、编码失败）都退回到后面的常规拼接。
    if (mergeMode === 'seamless' && files.length > 1) {
      const seamless = await mergeClipsSeamless(config, files, probed, work, { signal, binary });
      if (seamless?.path) {
        await rename(work, outPath);
        return {
          path: seamless.path, mode: 'seamless', trimmed,
          seams: seamless.seams, fade: seamless.fade, audioFade: seamless.audioFade,
        };
      }
      if (seamless?.error) copyError = seamless.error;
    }

    if (mergeMode !== 'reencode' && paramsMatch) {
      const listPath = `${work}.concat.txt`;
      const lines = files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
      await writeFile(listPath, `${lines}\n`, 'utf8');
      try {
        const { code, stderr } = await runProcess(binary, [
          '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
          '-c', 'copy', '-movflags', '+faststart', work,
        ], { signal });
        if (code === 0 && await exists(work)) {
          await rename(work, outPath);
          return { path: outPath, mode: 'copy', trimmed };
        }
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
      await rm(work, { force: true });
      const args = ['-y'];
      for (const file of files) args.push('-i', file);
      args.push('-filter_complex', filter, ...maps, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p');
      if (withAudioTrack) args.push('-c:a', 'aac', '-b:a', '192k');
      args.push('-movflags', '+faststart', work);
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
      if (code === 0 && await exists(work)) {
        await rename(work, outPath);
        return { path: outPath, mode: 'reencode', trimmed };
      }
      audioError = stderr.trim().slice(-400);
    }

    const filter = [...videoParts, `${videoInputs}concat=n=${files.length}:v=1:a=0[v]`].join(';');
    const { code, stderr } = await encode(filter, ['-map', '[v]'], false);
    if (code === 0 && await exists(work)) {
      await rename(work, outPath);
      return { path: outPath, mode: withAudio ? 'reencode-video-only' : 'reencode', trimmed };
    }
    const detail = [copyError, audioError, stderr.trim().slice(-400)].filter(Boolean).join(' | ');
    throw Object.assign(new Error(`ffmpeg 合并失败：${detail || '未知错误'}`), { code: 'ffmpeg_failed' });
  } finally {
    await cleanupSegmentTemps([...temps, work]);
  }
}

/** 显式接缝裁剪：按各续拍段开头分别设置秒数，默认不裁，不覆盖原始分段。 */
async function prepareSeamTrims(config, files, outPath, { signal }: RunOptions = {}) {
  const requested = ref(config, 'seamTrimSeconds', '');
  const trims = String(requested || '').trim()
    ? String(requested).split(',').map((value) => Number(value.trim())) : [];
  if (trims.some((value) => !Number.isFinite(value) || value < 0 || value > 3)) {
    throw new Error('seamTrimSeconds 必须为逗号分隔的 0–3 秒数值，例如 0.5,0；分别对应第 2、3 段开头。');
  }
  const prepared = [...files];
  const temps = [];
  const cuts = [];
  try {
    for (let index = 0; index < files.length; index++) {
      // 官方 2.0 接缝建议：前段尾部 6 帧、后段头部 1 帧。2.5 不套用该经验值。
      const official = !isOmniExtendModel(resolveModel(config)) && files.length > 1 && !trims.length;
      const secondsRequested = index > 0 ? trims[index - 1] || 0 : 0;
      if (!official && !secondsRequested) continue;
      const media = await probeMedia(files[index], config, signal);
      const duration = Number(media?.videoDurationSeconds || media?.durationSeconds);
      const fps = Number(media?.fps) || 24;
      const seconds = official ? (index > 0 ? 1 / fps : 0) : secondsRequested;
      const tailSeconds = official && index < files.length - 1 ? 6 / fps : 0;
      const keptSeconds = duration - seconds - tailSeconds;
      if (!(keptSeconds > 0.5)) throw new Error(`第 ${index + 1} 段裁剪后不足 0.5 秒，已停止合并。`);
      const temp = `${outPath}.${uniqueSuffix(`cut${index + 1}`)}.mp4`;
      temps.push(temp);
      // 输出端 seek 重编码，避免关键帧 seek 保留重复画面；音视频一起裁剪并从零计时。
      const result = await runProcess(resolveBinary(config, 'ffmpegBinary', 'ffmpeg'), [
        '-y', '-i', files[index], '-ss', String(seconds), '-t', String(keptSeconds),
        '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast',
        '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', temp,
      ], { signal });
      if (result.code !== 0) throw new Error(`第 ${index + 1} 段接缝裁剪失败：${tail(result.stderr)}`);
      prepared[index] = temp;
      cuts.push({ index: index + 1, seconds, tailSeconds });
    }
    return { files: prepared, temps, cuts };
  } catch (error) {
    await cleanupSegmentTemps(temps);
    throw error;
  }
}

/**
 * 下载分段 + 合并成一条成片（video_generate 与 video_extend 共用）。
 * 只负责「把已经生成好的段落盘、再拼成一条」；暂停 / 保留分段 / 写暂停记录这些策略由调用方决定。
 * @param notes - 调用方的说明数组，函数会往里追加接缝、音频裁齐、缺 ffmpeg 之类的提示。
 * @param keepSingleFile - 只有一段时不要把它改名搬走（暂停时那段还要留着续做）。
 * @param signal - 下载/合并用的信号；中断收尾时可以传 undefined，让收尾不被中断打断。
 * @returns files / segmentsDir / deliveredSeconds，以及下面几种结果之一：
 *   error（下载或合并失败，说明已写进 notes）、ffmpegMissing + installHint（缺 ffmpeg 且不止一段）、
 *   merged + videoPath + mergeMode（成功）。
 */
async function downloadSegmentsAndMerge(config, {
  segments, segmentsDir, outDir, stamp, notes = [], keepSingleFile = false, signal,
}) {
  const files = [];
  const deliveredSeconds = segments.reduce((sum, item) => sum + (item.seconds || 0), 0);
  // 多段才需要合成；本机没有 ffmpeg 就早点说清楚，别白跑一遍合并再报错。
  const ffmpegReady = segments.length > 1 ? await hasFfmpeg(config, signal) : true;
  let probeWarned = false;

  for (const [index, segment] of segments.entries()) {
    const dest = path.join(
      segmentsDir,
      `${String(segment.index).padStart(2, '0')}-${segment.kind}.mp4`,
    );
    try {
      // 已经下过的分段（接着做时复用）直接用现成文件：上游链接可能已经过期。
      if (!(await exists(dest))) {
        await downloadFile(segment.videoUrl, dest, { signal });
      }
    } catch (failure) {
      if (failure?.code === 'ABORTED') throw failure;
      const reason = `分段已生成，但下载失败：${failure?.message || failure}`;
      notes.push(reason);
      return { files, segmentsDir, deliveredSeconds, error: reason };
    }
    segment.localPath = dest;

    const media = await probeMedia(dest, config, signal);
    if (media?.durationSeconds) {
      segment.durationSeconds = Number(media.durationSeconds.toFixed(2));
      const cumulative = segments.slice(0, index + 1)
        .reduce((sum, item) => sum + (item.seconds || 0), 0);
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

  if (!files.length) return { files, segmentsDir, deliveredSeconds };

  if (!ffmpegReady && files.length > 1) {
    // 缺 ffmpeg 不是失败：分段照样交付，但必须把「怎么装」交出去。
    const guide = ffmpegInstallHint(config);
    notes.push(`分段文件都已下载到 ${segmentsDir}。`);
    notes.push(guide.hint);
    return {
      files, segmentsDir, deliveredSeconds, merged: false,
      ffmpegMissing: true, installHint: guide.hint,
    };
  }

  const finalPath = path.join(outDir, `${stamp}-${deliveredSeconds}s.mp4`);
  try {
    if (files.length === 1 && keepSingleFile) {
      return { files, segmentsDir, deliveredSeconds, merged: true, mergeMode: 'segment', videoPath: files[0] };
    }
    if (files.length === 1) {
      await mkdir(path.dirname(finalPath), { recursive: true });
      await rm(finalPath, { force: true });
      await rename(files[0], finalPath);
      return { files, segmentsDir, deliveredSeconds, merged: true, mergeMode: 'single', videoPath: finalPath };
    }
    const prepared = await prepareSeamTrims(config, files, finalPath, { signal });
    let merged;
    try {
      merged = await mergeClips(prepared.cuts.length ? { ...config, mergeMode: 'copy' } : config, prepared.files, finalPath, { signal });
    } finally {
      await cleanupSegmentTemps(prepared.temps);
    }
    if (prepared.cuts.length) {
      notes.push(`已按确认的裁剪量移除续拍段开头：${prepared.cuts.map((cut) => `第 ${cut.index} 段：头部 ${cut.seconds.toFixed(3)} 秒、尾部 ${cut.tailSeconds.toFixed(3)} 秒`).join('；')}。原始分段未改动；实际成片会缩短，不补帧凑时长。`);
    }
    const actual = await probeMedia(finalPath, config, signal);
    if (merged.trimmed?.length) {
      notes.push(
        `第 ${merged.trimmed.map((item) => item.index).join('、')} 段的音频比视频长`
        + `（最长 ${Math.max(...merged.trimmed.map((item) => item.paddingSeconds))} 秒），`
        + '已裁齐后再拼接，避免接缝处缺一小段画面。',
      );
    }
    if (merged.mode === 'seamless') {
      // 把接缝补正的实测值写在结果里，用户/模型能看出「不是硬切上去的」
      const fixed = (merged.seams || [])
        .filter((seam) => Math.abs(seam.lumaDelta) >= 0.5 || Math.abs(seam.audioGainDb) >= 0.2)
        .map((seam) => `第 ${seam.index} 段接缝：画面 ${seam.lumaDelta >= 0 ? '+' : ''}`
          + `${seam.lumaDelta.toFixed(1)} 级、音量 ${seam.audioGainDb >= 0 ? '+' : ''}`
          + `${seam.audioGainDb.toFixed(1)} dB`);
      notes.push(
        `合并方式：无缝拼接（接缝 ${merged.fade} 秒交叉淡化`
        + `${fixed.length ? `，并已对齐${fixed.join('；')}` : ''}）。`,
      );
    }
    return { files, segmentsDir, deliveredSeconds, merged: true, mergeMode: merged.mode, videoPath: finalPath, seamCuts: prepared.cuts, actualSeconds: actual?.durationSeconds };
  } catch (failure) {
    if (failure?.code === 'ABORTED') throw failure;
    let reason = `分段已生成，但合并失败：${failure?.message || failure}`;
    let installHint;
    if (failure?.code === 'ffmpeg_missing') {
      const guide = ffmpegInstallHint(config);
      installHint = guide.hint;
      reason = guide.hint;
    }
    notes.push(reason);
    return { files, segmentsDir, deliveredSeconds, error: reason, ffmpegMissing: Boolean(installHint), installHint };
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

/* ---------------- 响应解析：兼容中转站的不同响应形状 ---------------- */

function findKey(payload, keys, depth = Infinity) {
  if (payload && typeof payload === 'object') {
    if (!Array.isArray(payload)) {
      for (const key of keys) {
        const value = payload[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
    }
    if (depth <= 0) return undefined;
    for (const value of Array.isArray(payload) ? payload : Object.values(payload)) {
      const found = findKey(value, keys, depth - 1);
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
  // 只搜前 4 层：够拿到 {id} 与 {data:{output:{id}}} 这类形状，又不会把响应里
  // 更深处的、不相干的 id / request_id 误当成任务 ID。
  const value = findKey(payload, ['id', 'task_id', 'taskId', 'request_id'], 4);
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

/* ---------------- 调用前预检：预估费用 + 人工确认 + 额度是否够 ---------------- */

/** 金额显示与中转站一致：|x| ≥ 1 保留 2 位小数，否则保留 4 位，末尾多余的 0 去掉。 */
function formatAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  const text = number.toFixed(Math.abs(number) >= 1 ? 2 : 4);
  return text.includes('.') ? text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : text;
}

function formatMoney(value, symbol = '¥') {
  return `${symbol}${formatAmount(value)}`;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** 每 100 万 token 的美元价：带参考素材（参考图 / 参考视频）时更便宜。 */
function estimateRate(model, usesReference) {
  const id = String(model || '').toLowerCase();
  const hit = ESTIMATE_RATES.find(([prefix]) => id.startsWith(prefix));
  const table = hit ? hit[1] : ESTIMATE_RATES[0][1];
  return usesReference ? table.video : table.none;
}

/** 这次调用会拆几段：和真正执行用的是同一套规划（直出 + 逐段延长）。 */
function estimatePlan(config, toolName, args) {
  if (toolName === 'video_extend') {
    const count = clampInteger(args?.segments, 1, MAX_SEGMENTS, 1);
    const fallback = modelMaxSeconds(config);
    const seconds = clampInteger(
      args?.duration ?? fallback,
      MIN_SECONDS,
      modelMaxSeconds(config),
      fallback,
    );
    return Array.from({ length: count }, () => ({ kind: 'extend', seconds }));
  }
  return resolveTargetPlan(config, args).plan;
}

/**
 * 本次调用的时长规划（估算与真正生成共用，保证确认框里的段数与实际执行一致）：
 * 目标秒数先夹到「单条成片上限」内，再按单段上限 / 每段上限拆段。
 * 上限之外的请求不会被静默砍掉——调用方把 `asked - total` 写进备注里告诉用户。
 */
function resolveTargetPlan(config, args) {
  const singleMax = resolveSingleMax(config);
  const segmentSeconds = resolveSegmentSeconds(config, args?.segmentSeconds);
  const cap = maxTargetSeconds(singleMax, segmentSeconds);
  const asked = clampInteger(
    args?.duration ?? singleMax,
    MIN_SECONDS,
    Number.MAX_SAFE_INTEGER,
    singleMax,
  );
  const total = Math.min(asked, cap);
  return {
    plan: planVideoSegments(total, singleMax, segmentSeconds),
    singleMax,
    segmentSeconds,
    cap,
    asked,
    total,
  };
}

/**
 * 每段的预估用量（token / 美元）。全量估算和「还要生成几段」的确认框共用这一套价目，
 * 两边算出来的数字才不会打架。
 * @param steps - 每段要有 seconds / kind，以及 usesReference（是否带参考素材）。
 */
function estimateSteps(config, steps) {
  const resolution = FIXED_RESOLUTION;
  const pixels = ESTIMATE_PIXELS[resolution] || ESTIMATE_PIXELS[FIXED_RESOLUTION];
  const tokensPerSecond = (pixels[0] * pixels[1] * ESTIMATE_FPS) / ESTIMATE_TOKEN_DIVISOR;
  const model = resolveModel(config);
  return {
    model,
    resolution,
    segments: steps.map((step, index) => {
      const usesReference = step.usesReference === true;
      const tokens = Math.round(tokensPerSecond * step.seconds);
      return {
        index: index + 1,
        kind: step.kind,
        seconds: step.seconds,
        tokens,
        usesReference,
        usd: (tokens * estimateRate(model, usesReference)) / 1e6,
      };
    }),
  };
}

/**
 * 调用模型前的估算：拆几段、多少 token、大概多少美元。
 * 只按价目表与分辨率算，实际以中转站结算为准（确认框里写的是「预估」）。
 */
function estimateUsage(config, toolName, args) {
  const plan = estimatePlan(config, toolName, args);
  // 有首/尾帧或参考图，就算「带参考素材」，价目表里视频一档更便宜。
  const referenceImages = Array.isArray(args?.referenceImages)
    ? args.referenceImages
    : (args?.referenceImages ? [args.referenceImages] : []);
  const hasFrame = Boolean(
    String(args?.firstFrameUrl ?? '').trim()
    || String(args?.lastFrameUrl ?? '').trim()
    || referenceImages.length,
  );
  const groupRatio = finiteNumber(ref(config, 'estimateGroupRatio', 0.8)) ?? 1;
  // 延长段一定带参考视频；直出段只有给了首/尾帧才算「有参考素材」
  const { model, resolution, segments } = estimateSteps(
    config,
    plan.map((step) => ({ ...step, usesReference: step.kind === 'extend' || hasFrame })),
  );
  const usd = segments.reduce((sum, item) => sum + item.usd, 0) * groupRatio;
  return {
    model,
    resolution,
    segments,
    seconds: segments.reduce((sum, item) => sum + item.seconds, 0),
    tokens: segments.reduce((sum, item) => sum + item.tokens, 0),
    usd: Math.round(usd * 1e6) / 1e6,
  };
}

/* ---------------- 长视频的循环迭代：分段之间的人工确认 + 暂停后接着做 ---------------- */

/**
 * 暂停记录文件名。长视频是「先直出、再逐段延长」，每段生成完都先问用户要不要继续；
 * 用户点了「先不继续」就把「已经生成到哪一步」写进这个文件，随时能用 resume 接着做。
 */
const PAUSE_FILE = 'paused-plan.json';

/** resume 参数：目录路径字符串，或上次结果里那个 resumeDir 对象。 */
function resumeDirOf(value) {
  const raw = typeof value === 'string'
    ? value
    : (value?.dir ?? value?.path ?? value?.resumeDir ?? value?.token ?? '');
  const dir = String(raw ?? '').trim();
  return dir ? path.resolve(dir) : '';
}

async function readPauseFile(dir) {
  const file = path.join(dir, PAUSE_FILE);
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    throw new Error(
      `没有找到暂停记录：${file}。resume 要传上一次结果里的 resumeDir`
      + '（用户选择先不继续时，结果里给的那个分段目录），不要自己拼路径。',
    );
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`暂停记录不是合法 JSON：${file}。`);
  }
  if (data?.plugin !== 'metaontic-video' || !Array.isArray(data.plan) || !data.plan.length) {
    throw new Error(`暂停记录内容不对（不是本插件写的）：${file}。`);
  }
  return data;
}

/* ---------------- 暂停目录的「续做锁」：同一份进度只能有一次 resume 在跑 ---------------- */

const RESUME_LOCK = 'resume.lock';

/** 锁过期时间：0 / 负数表示永不过期（配置成 0 的人就是不想让后来者抢）。 */
function resumeLockStaleMs(config) {
  const minutes = Number(ref(config, 'resumeLockStaleMinutes', 60));
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return minutes * 60 * 1000;
}

/** 锁文件是不是「过期残留」（进程被杀 / 宿主放弃调用，没来得及删）：只有过期才允许抢过来。 */
async function resumeLockExpired(file, staleMs) {
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (raw === null) return true;              // 刚好被删掉：当成可以重试
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return true;                              // 内容坏了（崩在写锁中途）：当过期
  }
  const started = Date.parse(String(data?.startedAt || ''));
  if (!Number.isFinite(started)) return true;
  if (!staleMs) return false;
  return Date.now() - started > staleMs;
}

/** 读锁文件里「谁拿着」，只用来写一句清楚的报错。 */
async function describeResumeLock(file) {
  const raw = await readFile(file, 'utf8').catch(() => null);
  if (!raw) return '';
  try {
    const data = JSON.parse(raw);
    const bits = [data?.tool, data?.startedAt && `${data.startedAt} 开始`, data?.pid && `pid ${data.pid}`]
      .filter(Boolean);
    return bits.length ? `（${bits.join('，')}）` : '';
  } catch {
    return '';
  }
}

/**
 * 拿到「续做锁」：用 `wx` 独占创建锁文件，这个操作是原子的，同进程 / 跨进程都拦得住。
 * 用户连点两次「继续」、或两个会话同时去续做同一份暂停进度时，只有第一个能进，
 * 第二个直接报错——否则双方各自把剩下的段提交一遍，同样的段生成两遍、钱花两遍。
 * @returns { file, release } —— release 只删自己写的那把锁（目录可能已经换人用了）。
 */
async function acquireResumeLock(dir, { toolName, callId, staleMs }) {
  const empty = { file: null, async release() {} };
  const file = path.join(dir, RESUME_LOCK);
  const token = uniqueSuffix('lock');
  const record = {
    tool: toolName,
    callId: callId || null,
    pid: process.pid,
    host: os.hostname(),
    startedAt: new Date().toISOString(),
    token,
  };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(file, 'wx');
      try {
        await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
      } finally {
        await handle.close();
      }
      return {
        file,
        async release() {
          const raw = await readFile(file, 'utf8').catch(() => null);
          if (raw) {
            try {
              if (JSON.parse(raw)?.token !== token) return;   // 已经被别人接手了，别删
            } catch {
              return;
            }
          }
          await rm(file, { force: true }).catch(() => {});
        },
      };
    } catch (failure) {
      // 目录都还没有（resume 传错路径）：不拦，交给下面「没找到暂停记录」的提示去说清楚
      if (failure?.code === 'ENOENT') return empty;
      if (failure?.code !== 'EEXIST') throw failure;
      if (attempt === 0 && await resumeLockExpired(file, staleMs)) {
        await rm(file, { force: true }).catch(() => {});
        continue;
      }
      const holder = await describeResumeLock(file);
      const minutes = staleMs ? Math.round(staleMs / 60000) : 0;
      throw Object.assign(new Error(
        `这份暂停进度已经有一次「继续」在跑了${holder}，先别同时续做：两份请求会把剩下的段各提交一遍、`
        + '重复扣费。等它跑完再用 resume（结果里会说完成片在哪）。'
        + (minutes
          ? `如果确认那一次已经中断了，等 ${minutes} 分钟锁会自动过期，也可以把 ${file} 删掉再试。`
          : `确认那一次已经中断了就删掉 ${file} 再试。`),
      ), { code: 'resume_locked' });
    }
  }
  throw new Error(`拿不到 ${file} 的锁（同名文件一直被抢），稍后重试。`);
}

/**
 * 给会「接着暂停进度继续」的工具加一层互斥：只有传了 resume 的调用才需要锁，
 * 普通生成 / 延长之间互不影响（本来就是并发安全的）。
 */
function withResumeLock(tool, toolName, config) {
  return {
    ...tool,
    async execute(args, exec) {
      const dir = resumeDirOf(args?.resume);
      if (!dir) return tool.execute(args, exec);
      const lock = await acquireResumeLock(dir, {
        toolName,
        callId: exec?.callId,
        staleMs: resumeLockStaleMs(config),
      });
      try {
        return await tool.execute(args, exec);
      } finally {
        await lock.release();
      }
    },
  };
}

async function writePauseFile(dir, data) {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, PAUSE_FILE);
  // 先写唯一的临时文件、再原子 rename 顶上：并发读（另一次 resume）不会读到写到一半的 JSON。
  const temp = `${file}.${uniqueSuffix('part')}`;
  try {
    await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await rename(temp, file);
  } catch (failure) {
    await rm(temp, { force: true }).catch(() => {});
    throw failure;
  }
}

function sumStepSeconds(steps) {
  return (steps || []).reduce((sum, step) => sum + (Number(step?.seconds) || 0), 0);
}

/**
 * 接着跑：默认沿用原计划剩下的段；这次传了更大的 duration 就按每段上限往后补延伸段。
 * @returns fullPlan 整条视频从头到尾的计划（暂停时写回记录用）、plan 这次要跑的部分、
 *   cursor 已经生成好的秒数、total 整条的总秒数。
 */
function resumePlanFrom(data, { askedTotal, segmentSeconds }) {
  const done = Number(data.done) || 0;
  const cursor = Number(data.cursor) || 0;
  const fullPlan = (data.plan || []).map((step) => ({ ...step }));
  const remaining = fullPlan.slice(done).map((step) => ({ ...step }));
  const wanted = Number.isFinite(askedTotal) ? askedTotal : 0;
  const cap = segmentSeconds > 0 ? segmentSeconds : MAX_SEGMENT_SECONDS;
  let total = cursor + sumStepSeconds(remaining);
  while (wanted > total && fullPlan.length < MAX_SEGMENTS && total + MIN_SECONDS <= wanted) {
    const seconds = Math.max(MIN_SECONDS, Math.min(cap, wanted - total));
    fullPlan.push({ kind: 'extend', seconds });
    remaining.push({ kind: 'extend', seconds });
    total += seconds;
  }
  return { fullPlan, plan: remaining, cursor, total };
}

/** 续做时要沿用的参数：调用方只传 resume 时，靠这份记录还原上次的口径。 */
function pickResumeOptions(args) {
  const keys = [
    'mode', 'ratio', 'generateAudio', 'watermark', 'segmentPrompts',
    // 这几个是 video_extend 的口径（延长方向、提示词写法、整片时间轴位置）
    'direction', 'wording', 'startAt',
  ];
  const options = {};
  for (const key of keys) {
    if (args?.[key] !== undefined) options[key] = args[key];
  }
  return options;
}

/** 暂停时写进分段目录的记录：接着做时照它恢复计划、进度和最后一段的链接。 */
function pauseRecordAt({ stamp, prompt, fullPlan, done, cursor, lastVideoUrl, options, segments }) {
  return {
    plugin: 'metaontic-video',
    kind: 'paused-plan',
    version: 1,
    createdAt: new Date().toISOString(),
    stamp,
    prompt,
    plan: fullPlan,
    done,
    cursor,
    lastVideoUrl,
    options,
    steps: segments.map((segment) => ({
      index: segment.index,
      kind: segment.kind,
      seconds: segment.seconds,
      taskId: segment.taskId,
      videoUrl: segment.videoUrl,
    })),
  };
}

/** 暂停后怎么接着做：这段说明会交到模型手里，正是「循环迭代」的续做入口。 */
function resumeHint(dir, remainingSeconds, toolName = 'video_generate') {
  return `要接着做就把 resume="${dir}" 再调一次 ${toolName}（prompt 可以省略，其余参数照旧）：`
    + `插件会接着已经生成的分段继续，剩下的 ${remainingSeconds} 秒不用重头生成、不会重复扣费。`;
}

/** 剩下这几段的预估费用文案（确认框里给用户看钱）。 */
async function remainingCostText(config, exec, remainingSteps) {
  if (isVolcengine(config)) return { cost: '火山按实际调用计费，插件不预估费用或判断余额', remain: '' };
  try {
    const estimated = estimateSteps(
      config,
      remainingSteps.map((step) => ({ ...step, usesReference: true })),
    );
    const groupRatio = finiteNumber(ref(config, 'estimateGroupRatio', 0.8)) ?? 1;
    const usd = estimated.segments.reduce((sum, item) => sum + item.usd, 0) * groupRatio;
    const quota = await fetchDeviceQuota(config, exec?.signal);
    const data = quota.status === 'ok' ? quota.data : {};
    const symbol = String(data.currency_symbol || '¥');
    const exchange = finiteNumber(data.usd_exchange_rate) ?? DEFAULT_USD_EXCHANGE_RATE;
    const remainAmount = finiteNumber(data.remain_amount);
    return {
      cost: `预估 ${formatMoney(usd * exchange, symbol)}`,
      remain: remainAmount === null ? '' : `本机 Key 剩余 ${formatMoney(remainAmount, symbol)}`,
    };
  } catch (error) {
    return { cost: `预估费用没算出来（${error?.message || error}）`, remain: '' };
  }
}

/**
 * 分段之间的人工确认：拿到第 N 段的结果后，先问用户要不要继续生成第 N+1 段。
 * 结果口径：
 *   allowed-once —— 用户同意，继续生成；
 *   rejected / cancelled —— 用户先不继续：停下来，把已经生成的部分交付，之后可以 resume；
 *   unavailable —— 没有可用的确认通道（没有审批服务 / 没有会话 / 提问失败）：
 *     这次调用在动手前已经确认过费用，就不把生成堵在这里，按继续处理并在 note 里说明。
 */
async function confirmNextSegment(ctx, config, exec, {
  done, finished, nextSeconds, remainingSteps, toolName = 'video_generate',
}) {
  const approval = ctx?.get?.('approval');
  const agent = exec?.agent;
  if (!approval || typeof approval.request !== 'function' || !agent) {
    return { outcome: 'unavailable', reason: '没有可用的审批服务' };
  }
  if (approvalPolicy(ctx, exec) === 'never') {
    return { outcome: 'unavailable', reason: '当前权限模式关闭了审批提示' };
  }
  const rest = sumStepSeconds(remainingSteps);
  const { cost, remain } = await remainingCostText(config, exec, remainingSteps);
  const lastSeconds = finished?.[done - 1]?.seconds ?? 0;
  const alreadyDone = `第 ${done} 段（${lastSeconds} 秒）已经生成好`;
  try {
    const outcome = await approval.request({
      agent,
      toolName,
      ...(exec?.callId ? { callId: exec.callId } : {}),
      ...(exec?.signal ? { signal: exec.signal } : {}),
      reason: `人工确认：继续生成第 ${done + 1} 段视频（${nextSeconds} 秒）。`
        + `${alreadyDone}，整条还差 ${rest} 秒（${cost}${remain ? `；${remain}` : ''}）。`,
      displayReason: {
        zh: `${alreadyDone}。接下来生成第 ${done + 1} 段（${nextSeconds} 秒），整条还差 ${rest} 秒，`
          + `${cost}${remain ? `，${remain}` : ''}。`
          + '点「允许」继续往下生成；点「拒绝」就先把已经生成的部分交付给你，之后随时可以接着做（不用重头再来）。',
        en: `Segment ${done} (${lastSeconds}s) is ready. Next up: segment ${done + 1} `
          + `(${nextSeconds}s); ${rest}s left in total, ${cost}${remain ? `, ${remain}` : ''}. `
          + 'Allow to keep generating; reject to receive what is already done and continue later.',
      },
    });
    return { outcome: String(outcome) };
  } catch (error) {
    return { outcome: 'unavailable', reason: error?.message || String(error) };
  }
}

/** 插件服务地址：配置优先，留空用固定域名。 */
function resolveRegisterApi(config) {
  return (String(ref(config, 'registerApi', '')).trim() || DEFAULT_REGISTER_API).replace(/\/+$/, '');
}

/** 本插件版本：构建时由 esbuild --define 从 package.json 注入，跟着请求带给服务端。 */
const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string'
  ? __PLUGIN_VERSION__.trim().replace(/^v/i, '')
  : '';

/**
 * 问插件服务要「本机这把 Key 还剩多少额度」。
 * 服务端按设备凭据去中转站读密钥详情，只回剩余 / 已用额度。
 * 拿不到（没设备凭据、服务不可用）就回 unknown，由调用方决定怎么写进确认框。
 */
async function fetchDeviceQuota(config, signal) {
  if (isVolcengine(config)) return { status: 'unknown', reason: '火山直连费用和余额请在火山控制台查看' };
  const api = resolveRegisterApi(config);
  const deviceId = String(ref(config, 'deviceId', '')).trim();
  const deviceSecret = String(ref(config, 'deviceSecret', '')).trim();
  if (!deviceId || !deviceSecret) {
    return {
      status: 'unknown',
      reason: '插件里没有本机设备凭据（在设置页点一次「登录」会写进来，之后就能自动校验额度）',
    };
  }
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const response = await fetch(`${api}/api/v1/register/quota`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-Register-Token': String(ref(config, 'registerToken', '')).trim() || DEFAULT_REGISTER_TOKEN,
        ...(PLUGIN_VERSION ? { 'X-Plugin-Version': PLUGIN_VERSION } : {}),
      },
      body: JSON.stringify({ device_id: deviceId, device_secret: deviceSecret }),
      signal: requestSignal,
    });
    const text = await response.text();
    let body: any = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 200) };
      }
    }
    if (!response.ok || (body && typeof body === 'object' && body.code)) {
      return {
        status: 'unknown',
        reason: (body && (body.message || body.detail)) || `HTTP ${response.status}`,
      };
    }
    return { status: 'ok', data: (body && body.data) || body || {} };
  } catch (error) {
    return { status: 'unknown', reason: error?.message || String(error) };
  }
}

/** 宿主当前的审批策略：never 表示「审批提示被关掉」，这时候没法人工确认。 */
function approvalPolicy(ctx, exec) {
  try {
    const approval = ctx.get('approval');
    if (!approval) return 'missing';
    const session = exec?.agent?.session;
    const override = session && typeof approval.overrideOf === 'function'
      ? approval.overrideOf(session)
      : undefined;
    return override || approval.config?.policy || 'ask';
  } catch {
    return 'ask';
  }
}

/** 把秒数列表写成「15s + 5s」这样的紧凑形式，确认框只有一行文字，不能换行。 */
function planSummary(estimate) {
  if (!estimate) return '时长未知';
  const sizes = estimate.segments.map((item) => `${item.seconds}s`).join(' + ');
  return `${estimate.segments.length} 段（${sizes}）共 ${estimate.seconds} 秒`;
}

/**
 * 装 ffmpeg 前的确认：安装命令要在本机跑，必须让用户先看清楚是什么、再决定装不装。
 * （只检查不安装的调用直接放行，不用打扰用户。）
 */
function setupGate(ctx, exec) {
  const args = exec.arguments && typeof exec.arguments === 'object' ? exec.arguments : {};
  if (args?.install !== true) return { kind: 'allow' };

  const { os, installs, bootstrap } = ffmpegInstallOptions();
  const command = String(args?.target || 'ffmpeg') === 'package-manager' && bootstrap
    ? bootstrap.command
    : installs[0].command;

  if (approvalPolicy(ctx, exec) === 'never') {
    return {
      kind: 'deny',
      reason: '当前权限模式关闭了审批提示（完全访问），装环境这种会在本机跑命令的操作没法确认，已停止。'
        + '把权限切到「工作区写入」或「只读」后再让我装；也可以照着这条命令自己在终端执行：'
        + `${command}（${os}）。`,
    };
  }

  return {
    kind: 'ask',
    reason: `人工确认：在 ${os} 上执行安装命令「${command}」。`,
    displayReason: {
      zh: `准备在这台电脑上装 ffmpeg：${command}（${os}）。`
        + '点了「允许」才会执行，装完会自动接着把视频生成出来。',
      en: `About to install ffmpeg on this machine: ${command} (${os}). `
        + 'It runs only after you allow it; the video generation continues right after.',
    },
  };
}

/**
 * 要合并的长视频遇上「本机没有 ffmpeg」：不往下走，把这次调用退回去，
 * 让模型在对话框里和用户确认「要不要现在装 ffmpeg」——同意就装（宿主会弹审批），
 * 不想装就带 merge:false 重发，只拿分段列表。
 *
 * 返回 null 表示不用拦（不需要合并、或本机已经能跑 ffmpeg）。
 */
async function ffmpegConsentGate(config, exec, args) {
  if (exec.name !== 'video_generate' && exec.name !== 'video_extend') return null;
  // 用户已经明确说要「只返回分段」，就别再拦了。
  if (args?.merge === false) return null;

  let plan = null;
  // 续做时：合并的文件数 = 已经生成好的段 + 这次要跑的段，所以两边都要算进来。
  let doneSteps = [];
  try {
    const gateArgs = await estimateArgsFor(config, exec.name, args);
    plan = estimatePlan(config, exec.name, gateArgs);
    const dir = resumeDirOf(args?.resume);
    if (dir) {
      const data = await readPauseFile(dir);
      doneSteps = (data.steps || []).map((step) => ({ kind: step.kind, seconds: step.seconds }));
    }
  } catch {
    plan = null;
  }
  const allSteps = [...doneSteps, ...(plan || [])];
  if (!plan || allSteps.length < 2) return null;
  if (await hasFfmpeg(config, exec.signal)) return null;

  const { os, installs } = ffmpegInstallOptions();
  const command = installs[0].command;
  const sizes = allSteps.map((step) => `${step.seconds}s`).join(' + ');
  const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
  const lines = [
    `本机没有 ${binary}，这条成片是 ${allSteps.reduce((sum, step) => sum + step.seconds, 0)} 秒`
      + `（会拆成 ${allSteps.length} 段：${sizes}），没有 ffmpeg 就没法合并成一条，所以先停下来了，`
      + '还没有调用模型、没有产生费用。',
    '请在对话框里先和用户确认，不要自己绕过这一步：',
    `1) 问用户要不要现在装 ffmpeg —— 说清他的系统（${os}）和命令：${command}`,
    '   （装好后重跑这次生成就会自动合并成一条，分段不用重新生成）。',
    '2) 用户同意安装：调用 video_setup（install:true）——插件会执行上面的命令，'
      + '宿主会先把这条命令拿给用户确认；装完它会自己验证，成功后你按原 duration 重新调用 '
      + 'video_generate 继续生成即可（一般是先装包管理器：本机连 brew 都没有时，'
      + 'video_setup 会返回 nextStep，用 target:"package-manager" 再装一次）。',
    '3) 用户不想装、或者装不了：带 `merge:false` 重新调用 video_generate，'
      + '插件就只生成并返回分段列表（每段链接 + 本地文件），这次不会再拦。',
    '已经装过但不在默认位置的话，把绝对路径填进插件设置里的「ffmpeg 路径」也一样管用；'
      + '安装包自带 ffprobe，分段时长探测会一起解决。',
  ];
  return {
    kind: 'deny',
    reason: lines.join('\n'),
    info: { ffmpegMissing: true, os, command, segments: allSteps.length },
  };
}

/**
 * 真正调用模型前的卡口：先人工确认，再确认额度够不够。
 *
 * - 审批提示被关掉（完全访问模式）：拒绝，并说明怎么打开；
 * - 预估费用超过这把 Key 的剩余额度：直接拒绝，不去调用（避免白扣 / 报错）；
 * - 读不到剩余额度：照常弹确认框，但把「读不到额度」的原因写清楚；
 * - 其余情况：返回 ask，宿主弹审批面板给用户看预估费用，点「允许」才会执行。
 */
/**
 * 确认框要估的是「这次真会花的钱」。接着上一次暂停继续时只生成剩下的几段，
 * 所以按暂停记录里剩下的计划估算，而不是按 args.duration（续做时可能压根没传）。
 */
async function estimateArgsFor(config, toolName, args) {
  if (toolName !== 'video_generate') return args;
  const dir = resumeDirOf(args?.resume);
  if (!dir) return args;
  try {
    const data = await readPauseFile(dir);
    const restarted = resumePlanFrom(data, {
      askedTotal: args?.duration == null
        ? null
        : clampInteger(args.duration, MIN_SECONDS, Number.MAX_SAFE_INTEGER, 0),
      segmentSeconds: resolveSegmentSeconds(config, args?.segmentSeconds),
    });
    const seconds = sumStepSeconds(restarted.plan);
    if (!(seconds > 0)) return args;
    return { ...args, duration: seconds, referenceImages: [] };
  } catch {
    return args;
  }
}

async function preflightGate(ctx, config, exec) {
  // 装环境：只有真要装的时候才拦（让用户先看到命令）；纯检查放行。
  if (exec.name === 'video_setup') return setupGate(ctx, exec);

  if (approvalPolicy(ctx, exec) === 'never') {
    return {
      kind: 'deny',
      reason: '当前权限模式关闭了审批提示（完全访问），无法做人工确认，已停止调用。'
        + '把权限切到「工作区写入」或「只读」后再生成视频。',
    };
  }

  const args = exec.arguments && typeof exec.arguments === 'object' ? exec.arguments : {};

  // 长视频要在本机合并，缺 ffmpeg 就先停下来：把这次调用退回去，
  // 让模型在对话框里问用户「要不要授权我装 ffmpeg」，而不是闷头生成再丢一堆分段。
  const consent = await ffmpegConsentGate(config, exec, args);
  if (consent) return consent;
  if (isVolcengine(config)) {
    assertConfigured(config, resolveApiKey(config));
    return {
      kind: 'ask',
      reason: `调用火山引擎 ${resolveModel(config)}，按火山账户实际用量计费。`,
      displayReason: { zh: '本次将直连火山引擎生成视频，费用从你的火山账户扣除，具体价格和余额以火山控制台为准。确认后开始。', en: 'Generate via Volcano Engine, billed to your Volcano account. Confirm to continue.' },
    };
  }
  let estimate = null;
  try {
    estimate = estimateUsage(config, exec.name, await estimateArgsFor(config, exec.name, args));
  } catch {
    estimate = null;
  }

  const quota = await fetchDeviceQuota(config, exec.signal);
  const data = quota.status === 'ok' ? quota.data : {};
  const symbol = String(data.currency_symbol || '¥');
  const perUnit = finiteNumber(data.quota_per_unit) ?? DEFAULT_QUOTA_PER_UNIT;
  const exchange = finiteNumber(data.usd_exchange_rate) ?? DEFAULT_USD_EXCHANGE_RATE;

  const needQuota = estimate ? Math.round(estimate.usd * perUnit) : null;
  const needMoney = estimate ? formatMoney(estimate.usd * exchange, symbol) : null;

  const remainQuota = finiteNumber(data.remain_quota);
  const remainAmount = finiteNumber(data.remain_amount);

  // 用户看到的只有钱：额度数字（「约 65.7 万额度」这种）是内部口径，确认框里不显示。
  const costText = needMoney === null ? '这次调用的费用没法预估' : `预估 ${needMoney}`;
  const remainMoneyText = `${formatMoney(remainAmount === null ? 0 : remainAmount, symbol)}`;
  // 用户看的只有钱；额度数字只留在下面那条审计文本里
  const remainZh = remainQuota === null
    ? `本机 Key 的额度读不到（${quota.reason || '服务端没回额度'}）`
    : `本机 Key 剩余 ${remainMoneyText}`;
  const remainEn = remainQuota === null
    ? `this key's quota could not be read (${quota.reason || 'the service returned none'})`
    : `this key has ${remainMoneyText} left`;

  // 额度不够就别调用：中转站也会拒，但那样只会白等一轮还看不到原因。
  if (needQuota !== null && remainQuota !== null && remainQuota < needQuota) {
    return {
      kind: 'deny',
      reason: `额度不足，已停止调用：本次预估需要 ${needMoney ?? '无法预估'}，这把 Key 只剩 `
        + `${remainMoneyText}。请充值或找管理员换一把额度够的 Key 后重试。`,
    };
  }

  const total = estimate
    ? `${estimate.model} · ${estimate.resolution} · ${planSummary(estimate)}`
    : `${resolveModel(config)} · ${FIXED_RESOLUTION}`;
  // 审计那条（模型看）保留 token / 额度这类内部口径，方便对着中转站日志核对
  const auditTax = estimate
    ? `预估消耗 ${estimate.tokens.toLocaleString('en-US')} token ≈ ${needMoney ?? '无法预估'}`
      + `（${needQuota === null ? '额度未知' : `${needQuota.toLocaleString('en-US')} 额度`}）`
    : '这次调用的费用无法预估';
  return {
    kind: 'ask',
    reason: `人工确认：调用视频模型（${total}）。${auditTax}；本机 Key 剩余 `
      + `${remainQuota === null ? '额度读不到' : `${remainMoneyText} / `
        + `${remainQuota.toLocaleString('en-US')} 额度`}。`,
    displayReason: {
      zh: `本次会调用视频模型：${total}；${costText}，${remainZh}。点了「允许」才会真正调用。`,
      en: `This will call the video model: ${total}. Estimated cost `
        + `${needMoney === null ? 'unknown' : needMoney}; ${remainEn}. `
        + 'The call runs only after you allow it.',
    },
  };
}

/* ---------------- 请求与轮询 ---------------- */

/** 中转站单次请求的超时（毫秒）：卡住的连接不要拖到宿主工具超时才结束。 */
const RELAY_TIMEOUT_MS = 120000;

/** 日志仅包含白名单字段；每日一个JSONL文件，不写请求体、鉴权头或输出URL。 */
function requestLogPath() {
  return path.join(dshHome(), 'logs', 'metaontic-video', `${new Date().toISOString().slice(0, 10)}.jsonl`);
}

async function appendRequestLog(record) {
  try {
    const file = requestLogPath();
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await appendFile(file, JSON.stringify({ time: new Date().toISOString(), ...record }) + '\n', { mode: 0o600 });
  } catch {
    // 日志不可写不能改变生成结果，也不能因此重提付费请求。
  }
}

async function relayRequest(config, requestPath, options: { method?: string; body?: any; signal?: AbortSignal } = {}) {
  const method = options.method || 'GET';
  const requestId = uniqueSuffix('request');
  const started = Date.now();
  const trace: Record<string, any> = {};
  const body = options.body;
  const operation = method === 'POST' ? 'create_task' : 'query_task';
  const info: Record<string, any> = {
    requestId, operation, method,
    provider: isVolcengine(config) ? 'volcengine' : 'service',
    model: body?.model || resolveModel(config),
    ...(method === 'POST' ? {
      duration: body?.duration, resolution: body?.resolution,
      imageCount: Array.isArray(body?.content) ? body.content.filter((item) => item.type === 'image_url').length : 0,
      videoCount: Array.isArray(body?.content) ? body.content.filter((item) => item.type === 'video_url').length : 0,
    } : { taskId: String(requestPath).split('?')[0].split('/').at(-1) }),
  };
  await appendRequestLog({ ...info, event: 'request_started' });
  try {
    const data = await relayRequestCore(config, requestPath, options, trace);
    await appendRequestLog({ ...info, ...trace, event: 'request_completed', elapsedMs: Date.now() - started,
      taskId: extractTaskId(data) || info.taskId, taskStatus: extractStatus(data),
      completionTokens: finiteNumber(data?.usage?.completion_tokens),
    });
    return data;
  } catch (error) {
    await appendRequestLog({ ...info, ...trace, event: 'request_failed', elapsedMs: Date.now() - started,
      errorCode: String(error?.code || 'request_error'), cancelled: Boolean(options.signal?.aborted),
    });
    throw error;
  }
}

async function relayRequestCore(
  config,
  path,
  { method = 'GET', body, signal }: { method?: string; body?: unknown; signal?: AbortSignal } = {},
  trace: Record<string, any> = {},
): Promise<any> {
  const url = `${resolveBaseUrl(config)}${path}`;
  const timeout = AbortSignal.timeout(RELAY_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const serialized = body === undefined ? undefined : JSON.stringify(body);
  if (isVolcengine(config) && serialized && Buffer.byteLength(serialized, 'utf8') > 64 * 1024 * 1024) {
    throw Object.assign(new Error('火山请求体超过64 MB，请减少内联图片或改用公网 URL / asset:// 素材。'), { code: 'request_too_large' });
  }
  let response;
  let text: string;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${resolveApiKey(config)}`,
        'Content-Type': 'application/json',
      },
      ...(serialized !== undefined ? { body: serialized } : {}),
      signal: requestSignal,
    });
    trace.httpStatus = response.status;
    trace.upstreamRequestId = response.headers.get('x-request-id') || response.headers.get('x-tt-logid') || undefined;
    text = await response.text();
  } catch (error) {
    if (signal?.aborted) throw abortError();
    throw Object.assign(new Error(`中转站请求失败：${error?.message || error}`), {
      code: 'provider_network_error',
    });
  }

  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  const upstreamError = data && typeof data === 'object' && data.error;
  if (!response.ok || upstreamError) {
    const httpStatus = response.status >= 400 ? response.status : 400;
    const classified = classifyError(
      httpStatus,
      data,
    );
    // 带上 HTTP 状态：轮询用得上——5xx / 429 / 401 这类要重试，400 这类是终局。
    throw Object.assign(new Error(classified.message), {
      code: classified.code,
      status: httpStatus,
    });
  }
  return data;
}

/** 归一化后的错误：统一带一个 code，调用方按 code 分流。 */
interface CodedError extends Error {
  code?: string;
}

function abortError(): CodedError {
  const error: CodedError = new Error('已取消');
  error.code = 'ABORTED';
  return error;
}

function sleep(ms, signal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(abortError()); return; }
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

function createTask(config, body, signal) {
  return relayRequest(config, resolveSubmitPath(config), { method: 'POST', body, signal });
}

function getTask(config, taskId, signal) {
  return relayRequest(config, resolveQueryPath(config, taskId), { signal });
}

/**
 * 轮询查询失败里哪些值得重试：网络中断、超时、5xx、限流、以及最像「Key 抖了一下」的 401/403。
 * 4xx 里那些明确的请求错误（比如路径不对、任务 ID 非法）重试也没用，重试只是白等。
 */
function isRetryablePollError(failure): boolean {
  if (!failure || failure.code === 'ABORTED') return false;
  const status = Number(failure.status);
  if (!Number.isFinite(status)) return true;
  if (status >= 500) return true;
  return status === 401 || status === 403 || status === 408 || status === 429;
}

/**
 * 轮询直到任务成功、失败、取消，或等待预算耗尽。
 * 中转站的状态字段可能是 success/completed 等别名，这里统一归一化。
 *
 * 关键点：**查询失败 ≠ 任务失败**。任务已经建好，网络抖动、中转站限流、
 * Key 在生成途中被判无效都会让查询报错，但任务在上游照常跑完。所以这里对查询错误
 * 做有限次重试（`pollErrorRetries`，默认 5）——连续失败到上限才放弃，
 * 放弃时返回 `unknown`（不是 `failed`），任务 ID 由调用方保留，
 * 交给 `video_status` 事后补拉，绝不把「没查到」当成「没生成」。
 */
async function waitForCompletion(config, taskId, signal): Promise<TaskResult> {
  const deadline = Date.now() + ref(config, 'maxWaitMs', 600000);
  const maxPollErrors = Math.max(1, Math.round(ref(config, 'pollErrorRetries', 5)));
  let pollErrors = 0;

  for (;;) {
    if (signal?.aborted) throw abortError();

    let task;
    try {
      task = await getTask(config, taskId, signal);
      pollErrors = 0;
    } catch (failure) {
      if (failure?.code === 'ABORTED') throw failure;
      // 明确是请求本身的问题（不是网络抖动）：别白等 5 轮，直接按「查询返回失败」结束，
      // 但任务 ID 照样保留——上游报的是这次查询失败，不是「没生成」。
      if (!isRetryablePollError(failure)) {
        return {
          taskId,
          status: 'unknown',
          errorCode: failure?.code || 'provider_poll_error',
          error: `任务已提交（${taskId}），查询返回失败：${failure?.message || failure}。`
            + '可用 video_status 按这个 ID 复查确认。',
        };
      }
      pollErrors += 1;
      if (pollErrors >= maxPollErrors || Date.now() > deadline) {
        return {
          taskId,
          status: 'unknown',
          errorCode: failure?.code || 'provider_poll_error',
          error: `任务已提交（${taskId}），但连续 ${pollErrors} 次查询状态失败：${
            failure?.message || failure
          }。任务可能仍在生成，可用 video_status 按这个 ID 再查，不要重复提交。`,
        };
      }
      await sleep(ref(config, 'pollIntervalMs', 5000), signal);
      continue;
    }

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
  const {
    status, segments = [], videoUrl, error, videoPath, mergeMode, segmentsDir,
    paused, resumeDir, remainingSeconds, note,
  } = value || {};
  const lines = segments.map((segment) => {
    const head = `第 ${segment.index} 段：+${segment.seconds}s（任务 ${segment.taskId}）`;
    if (segment.status !== 'succeeded' || !segment.videoUrl) {
      return `${head} → ${segment.status}${segment.error ? `：${segment.error}` : ''}`;
    }
    return segment.localPath
      ? `${head} → ${segment.videoUrl}\n    本地文件：${segment.localPath}`
      : `${head} → ${segment.videoUrl}`;
  });

  if (status === 'succeeded') {
    const parts = [];
    if (paused) {
      parts.push(
        `已延长并交付前 ${segments.length} 段（共 ${formatSeconds(segments.reduce(
          (sum, item) => sum + (item.seconds || 0), 0,
        ))} 秒）：每段延长完都会问一次要不要继续；这次先交付到这里`
        + '（用户选了先不继续，或这一轮被停止 / 等超时了）。',
      );
    } else {
      parts.push('视频延长成功。');
    }
    parts.push(...lines);
    if (videoPath) parts.push(`成片（本地文件）：${videoPath}（${mergeModeLabel(mergeMode)}）`);
    if (paused && resumeDir) {
      parts.push(
        `还没生成的部分：还剩 ${formatSeconds(remainingSeconds)} 秒。`
        + `要接着做就把 resume="${resumeDir}" 传回 video_extend（prompt 可以省略，其余参数照旧）：`
        + '前面几段不会重新生成、不会重复扣费。',
      );
    }
    parts.push(`最终视频链接（约 24 小时内有效）：${videoUrl || '（无）'}`);
    if (note) parts.push(note);
    return [{ type: 'text', text: parts.filter(Boolean).join('\n') }];
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
  if (status === 'unknown') {
    return [
      {
        type: 'text',
        text: [
          '没能确认这段延长任务的状态（查询失败，不是任务失败）。任务已经提交，可能仍在生成；'
          + '用 video_status 按任务 ID 复查，不要重新提交。',
          ...lines,
          `可用 video_status 查询任务 ${segments.at(-1)?.taskId || '（未知）'} 的状态与视频链接。`,
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

function extendTool(config, deps, ctx) {
  const TOOL_NAME = 'video_extend';
  return {
    name: 'video_extend',
    description:
      '把一段已有的视频向前或向后延长：以公网视频 URL 作为输入素材，调用 Seedance 生成衔接片段，'
      + '保持人物、服装、场景光线和声音连续；可一次连续延长多段，每段都用上一段的结果继续延长。'
      + '提示词规则：以「向后延长视频1」或「向前延长视频1」开头（也可写「生成视频1之后的内容：」），'
      + '全程用「视频1」指代输入素材，不要写成「参考视频1」（会被当成参考生视频，不是延长）；'
      + '内容写清延长方向、剧情发展、主体状态、镜头运动和声音延续'
      + '（背景音乐要接着视频1结尾往下走，禁止从头播放/换曲），减少接缝。'
      + '每段 4 至模型上限（2.0 为 15、2.5 为 30） 秒，默认按所选模型上限拆、段数最少；上游对卡满 15 秒敏感时再调小。'
      + '返回每段的任务 ID 和最终视频下载链接（约 24 小时内有效）；生成通常需要几分钟，'
      + '单次调用返回 timeout、或某段返回 unknown（查询失败、任务其实已提交）时，'
      + '都用返回的任务 ID 走 video_status 继续等，不要重复提交同一段。'
      + '每段延长完都会先弹一次确认框问用户要不要继续：点「拒绝」就先交付已经延长好的部分，'
      + '结果里带 paused=true、resumeDir、remainingSeconds；之后用户说「继续」时把 resumeDir '
      + '原样传给 video_extend 的 resume 参数接着做（前面几段不重新生成、不重复扣费）。'
      + '多段默认会下载分段并在本机合并成一条成片（需要 ffmpeg）：没有 ffmpeg 时会先拦下来问用户，'
      + '结果里也会带 ffmpegMissing 与安装引导。'
      + '中途被停止 / 等超时同理：已经延长好的段先交付，剩下的用 resume 接着做。',
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
          maximum: modelMaxSeconds(config),
          description:
            '每段新增的秒数上限，4 至模型上限（2.0 为 15、2.5 为 30） 的整数（如 5/8/10/14，默认按模型上限）；'
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
        resume: {
          type: 'string',
          description:
            '接着上一次暂停的延长继续：传上一次结果里的 resumeDir。'
            + '插件会沿用暂停记录里的提示词、延长方向和剩下的段数，只把没做的部分生成完再合并；'
            + 'prompt / videoUrl / direction 都可以省略。'
            + '想顺手多延长几段就再传 segments（表示在剩下的基础上「再加」几段）。'
            + '同一份暂停进度同时只允许一次 resume 在跑：已经有别的调用在续做时会直接报错，'
            + '等它跑完再继续，别重复发（重复会把剩下的段提交两遍、重复扣费）。',
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
          videoPath: { type: 'string' },
          actualSeconds: { type: 'number' },
          seamCuts: { type: 'array', items: { type: 'object', properties: { index: { type: 'integer' }, seconds: { type: 'number' }, tailSeconds: { type: 'number' } } } },
          merged: { type: 'boolean' },
          seamTrimSeconds: { type: 'string', description: '预览确认后裁剪各接缝：如 0.5,0 表示仅裁第2段开头0.5秒；默认不裁，音视频同步裁剪，实际时长缩短。' },
        mergeMode: { type: 'string' },
          segmentsDir: { type: 'string' },
          ffmpegMissing: { type: 'boolean' },
          installHint: { type: 'string' },
          partial: { type: 'boolean' },
          paused: { type: 'boolean' },
          resumeDir: { type: 'string' },
          remainingSeconds: { type: 'integer' },
          totalSeconds: { type: 'integer' },
          error: { type: 'string' },
          errorCode: { type: 'string' },
          note: { type: 'string' },
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

      // 接着上一次暂停的延长继续（长视频循环迭代的第二轮起）
      const resumeDir = resumeDirOf(args?.resume);
      const resume = resumeDir ? await readPauseFile(resumeDir) : null;

      const prompt = String(args?.prompt ?? '').trim() || String(resume?.prompt ?? '').trim();
      if (!prompt) {
        throw new Error(resumeDir
          ? '这次是接着上一次暂停的延长继续，但暂停记录里没有提示词：请把 prompt 补上。'
          : '提示词 prompt 不能为空。');
      }

      const lastOptions = resume ? (resume.options || {}) : {};
      const direction = (args?.direction ?? lastOptions.direction) === 'forward' ? 'forward' : 'backward';
      const wording = (args?.wording ?? lastOptions.wording) === 'after' ? 'after' : 'extend';
      const requestedSegments = clampInteger(args?.segments, 1, MAX_SEGMENTS, 1);
      const secondsPerSegment = clampInteger(
        args?.duration ?? modelMaxSeconds(config),
        MIN_SECONDS,
        modelMaxSeconds(config),
        modelMaxSeconds(config),
      );

      let referenceUrl = String(args?.videoUrl ?? '').trim();
      if (!referenceUrl && args?.taskId) {
        const sourceId = String(args.taskId).trim();
        let source;
        try {
          source = await getTask(config, sourceId, exec?.signal);
        } catch (failure) {
          if (failure?.code === 'ABORTED') throw failure;
          // 查不到源视频 ≠ 源任务没生成：给一个明确的说法，别抛原始 401。
          throw new Error(
            `读取参考视频任务 ${sourceId} 失败：${failure?.message || failure}。`
            + '这不代表该任务没有生成——稍后重试，或直接把成片的公网链接用 videoUrl 传进来。',
          );
        }
        referenceUrl = extractVideoUrl(source) || '';
        if (!referenceUrl) {
          throw new Error(
            `任务 ${args.taskId} 没有可用的视频链接（状态：${
              extractStatus(source) || '未知'
            }）。`,
          );
        }
      }
      // 接着做时，参考视频是上次最后一段的链接（暂停记录里有）
      if (!referenceUrl && resume) referenceUrl = String(resume.lastVideoUrl ?? '').trim();
      referenceUrl = normalizeReferenceUrl(referenceUrl);

      // 计划：续做时先把暂停记录里剩下的段跑完；再传 segments 就是「再追加这么多段」
      const doneBefore = resume ? (Number(resume.done) || 0) : 0;
      const fullPlan = resume ? (resume.plan || []).map((step) => ({ ...step })) : [];
      if (!resume) {
        for (let index = 0; index < requestedSegments; index += 1) {
          fullPlan.push({ kind: 'extend', seconds: secondsPerSegment });
        }
      } else if (args?.segments != null) {
        for (let index = 0; index < requestedSegments && fullPlan.length < MAX_SEGMENTS; index += 1) {
          fullPlan.push({ kind: 'extend', seconds: secondsPerSegment });
        }
      }
      const plan = fullPlan.slice(doneBefore);
      const plannedSeconds = plan.reduce((sum, step) => sum + step.seconds, 0);

      let cursor = resume
        ? (resume.cursor ?? null)
        : (args?.startAt == null ? null : Math.max(0, Math.round(Number(args.startAt))));
      const notes = [];
      const segments = [];
      if (resume) {
        // 上次暂停前生成好的延长段：文件就在同样的分段目录里（序号 + extend 就是文件名）
        for (const step of (resume.steps || [])) {
          segments.push({
            index: step.index,
            kind: 'extend',
            seconds: step.seconds,
            taskId: step.taskId,
            status: 'succeeded',
            videoUrl: step.videoUrl,
          });
        }
      }
      let status = 'succeeded';
      let error;
      let errorCode;
      // 用户选择先不继续（确认框里点了拒绝/取消）：先把已经延长好的部分交付
      let paused = false;
      let confirmWarned = false;

      // 被停止 / 超时也一样：已经延长好的部分先交付，留暂停记录给 resume。
      let interrupted = false;
      try {
      for (const [offset, step] of plan.entries()) {
        if (exec?.signal?.aborted) throw abortError();
        const position = doneBefore + offset;

        const { body, seconds } = buildRequestBody(
          config,
          {
            ...lastOptions,
            ...args,
            prompt,
            duration: step.seconds,
            startAt: cursor,
            direction,
            wording,
          },
          referenceUrl,
        );
        const final = await runTask(config, body, exec?.signal);
        const taskId = final.taskId;

        segments.push({
          index: position + 1,
          kind: 'extend',
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

        // 先结束本次调用并交付视频，让助手展示成果后再询问是否继续。
        // 工具内部阻塞在审批框时，宿主尚拿不到输出，无法展示刚完成的分段。
        if (plan[offset + 1]) {
          paused = true;
          notes.push('本段已完成：请先展示本次视频成果，让用户预览；用户确认继续后再用 resume 接着生成下一段。');
          break;
        }
      }
      } catch (failure) {
        const doneYet = segments.some((segment) => segment.status === 'succeeded' && segment.videoUrl);
        if (failure?.code !== 'ABORTED' || !doneYet) throw failure;
        interrupted = true;
        paused = true;
        notes.push(
          '这次调用被中断了（用户点了停止，或者等超时了）：已经延长好的部分会先下载、合并、交付，'
          + '剩下的段不用重头再来——用 resume 就能接着做。',
        );
      }

      const completed = segments.filter((segment) => segment.status === 'succeeded' && segment.videoUrl);
      const deliveredSeconds = completed.reduce((sum, segment) => sum + (segment.seconds || 0), 0);
      const result: Record<string, any> = {
        status,
        error,
        errorCode,
        segments,
        videoUrl: completed.at(-1)?.videoUrl,
        totalSeconds: deliveredSeconds,
      };
      if (!completed.length) {
        if (notes.length) result.note = notes.join('\n');
        return result;
      }
      if (status !== 'succeeded') {
        notes.push(`已把成功的 ${completed.length} 段（${deliveredSeconds} 秒）交付，可作为残片使用。`);
        result.partial = true;
      }
      if (resume) {
        notes.push(
          `接着上一次暂停的进度继续：前面 ${doneBefore} 段（${formatSeconds(resume.cursor ?? 0)}）不重新生成，`
          + `这次还要延长 ${plan.length} 段共 ${plannedSeconds} 秒。`,
        );
      }

      const outDir = await resolveOutputDir(config, exec, deps);
      const { stamp, segmentsDir } = resume
        ? { stamp: String(resume.stamp || fileStamp()), segmentsDir: resumeDir }
        : await allocateStamp(outDir, fileStamp());

      const delivery = await downloadSegmentsAndMerge(config, {
        segments: completed,
        segmentsDir,
        outDir,
        stamp,
        notes,
        keepSingleFile: paused,
        // 被中断时请求信号已经 abort：收尾（下载 + 合并）不能被它打断，否则等于白生成。
        signal: interrupted ? undefined : exec?.signal,
      });
      if (delivery.error) {
        result.segmentsDir = delivery.segmentsDir;
        result.note = notes.join('\n');
        return result;
      }
      if (delivery.ffmpegMissing) {
        result.segmentsDir = delivery.segmentsDir;
        result.merged = false;
        result.ffmpegMissing = true;
        result.installHint = delivery.installHint;
        result.note = notes.join('\n');
        return result;
      }
      if (!delivery.files.length) {
        result.note = notes.join('\n');
        return result;
      }
      if (delivery.merged) {
        result.merged = true;
        result.videoPath = delivery.videoPath;
        result.mergeMode = delivery.mergeMode;
        if (delivery.actualSeconds) result.actualSeconds = delivery.actualSeconds;
        if (delivery.seamCuts?.length) result.seamCuts = delivery.seamCuts;
      }

      if (paused) {
        // 暂停：延长好的分段留着（接着做时要复用），并写下「延长到哪一步」的记录
        result.segmentsDir = segmentsDir;
        result.resumeDir = segmentsDir;
        result.paused = true;
        result.remainingSeconds = Math.max(0, fullPlan.reduce((sum, step) => sum + step.seconds, 0) - deliveredSeconds);
        try {
          await writePauseFile(segmentsDir, pauseRecordAt({
            stamp,
            prompt,
            fullPlan,
            done: segments.length,
            cursor,
            lastVideoUrl: referenceUrl,
            options: { ...pickResumeOptions(args), direction, wording, startAt: cursor },
            segments,
          }));
        } catch (failure) {
          notes.push(`暂停记录没写成（${failure?.message || failure}）：要接着做只能用上面的链接重新延长。`);
        }
        notes.push(`已交付的成片是到第 ${segments.length} 段，分段仍保留在 ${segmentsDir}。`);
        notes.push(resumeHint(segmentsDir, result.remainingSeconds, TOOL_NAME));
        result.note = notes.join('\n');
        return result;
      }

      // 所有生成分段永久保留；合并、裁剪仅使用副本。
      result.segmentsDir = segmentsDir;
      if (notes.length) result.note = notes.join('\n');
      return result;
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

/** 合并方式的说法（两个工具的结果里都用它）。 */
function mergeModeLabel(mergeMode) {
  if (mergeMode === 'copy') return '无损拼接';
  if (mergeMode === 'segment') return '这一段暂时按原始分段交付（续做时再和后面的段合并）';
  if (mergeMode === 'single') return '一段直出，无需拼接';
  if (mergeMode === 'seamless') return '无缝拼接（对齐接缝 + 画面/音频交叉淡化，音乐接缝已淡化）';
  return '重编码拼接';
}

function renderVideoResult(value) {
  const {
    status, mode, segments = [], videoUrl, videoPath, mergeMode, segmentsDir, note, error,
    pendingTaskId, paused, resumeDir, remainingSeconds,
  } = value || {};
  const lines = segments.map((segment) => {
    const label = segment.kind === 'extend' ? `延长 +${segment.seconds}s` : `直出 ${segment.seconds}s`;
    const head = `第 ${segment.index} 段：${label}（任务 ${segment.taskId}）`;
    if (segment.status !== 'succeeded' || !segment.videoUrl) {
      return `${head} → ${segment.status}${segment.error ? `：${segment.error}` : ''}`;
    }
    return segment.localPath
      ? `${head} → ${segment.videoUrl}\n    本地文件：${segment.localPath}`
      : `${head} → ${segment.videoUrl}`;
  });

  const parts = [];
  if (status === 'succeeded') {
    if (paused) {
      parts.push(
        `已生成并交付前 ${segments.length} 段（共 ${formatSeconds(segments.length
          ? segments.reduce((sum, item) => sum + (item.seconds || 0), 0) : 0)} 秒）：`
        + '每段生成完都会问一次要不要继续；这次先交付到这里'
        + '（用户选了先不继续，或这一轮被停止 / 等超时了）。',
      );
    } else if (mode === 'extended') {
      parts.push(`视频生成成功：先直出 ${formatSeconds(segments[0]?.seconds)} 秒，再延长 ${segments.length - 1} 段。`);
    } else {
      parts.push(`视频生成成功：一次直出 ${formatSeconds(segments[0]?.seconds)} 秒，没有超过单段上限，不需要延长。`);
    }
  } else if (status === 'timeout') {
    parts.push('任务仍在生成中（已超出单次等待时间）。');
  } else if (status === 'unknown') {
    parts.push(
      '没能确认任务状态（查询失败，不是任务失败）。任务已经提交，可能仍在生成；'
      + '用 video_status 按下面的任务 ID 复查，不要重新提交。',
    );
  } else if (status === 'cancelled') {
    parts.push('任务已取消。');
  } else {
    parts.push(`视频生成失败${error ? `：${error}` : ''}。`);
  }
  parts.push(...lines);

  if (status === 'succeeded') {
    if (videoPath) {
      parts.push(`成片（本地文件）：${videoPath}（${mergeModeLabel(mergeMode)}）`);
    } else if (segmentsDir) {
      parts.push(`没有合并成一条：分段文件都在 ${segmentsDir}（每段路径见上面的列表）。`);
    } else {
      parts.push('没有生成合并文件，请按上面的上游链接自行下载分段。');
    }
  }
  if (paused && resumeDir) {
    parts.push(
      `还没生成的部分：还剩 ${formatSeconds(remainingSeconds)} 秒。`
      + `要接着做就把 resume 原样传回 video_generate（resume="${resumeDir}"），`
      + '插件会接着已有的分段往下生成，前面几段不会重新生成、也不会重复扣费。',
    );
  }
  if (videoUrl) parts.push(`最后一段上游链接（约 24 小时内有效）：${videoUrl}`);
  if (note) parts.push(note);
  if (status === 'timeout' || status === 'unknown') {
    const taskId = pendingTaskId || segments.at(-1)?.taskId || '（未知）';
    parts.push(`可用 video_status 查询任务 ${taskId} 的状态与视频链接。`);
  }
  return [{ type: 'text', text: parts.filter(Boolean).join('\n') }];
}

function videoTool(config, deps, ctx) {
  // 结果里的「接着做要调哪个工具」和确认框里的工具名都用它
  const TOOL_NAME = 'video_generate';
  return {
    name: 'video_generate',
    description:
      '生成一段完整视频（视频生成的首选工具），duration 是目标总秒数：'
      + '不超过模型单段上限（2.0 为 15 秒、2.5 为 30 秒）时一次直出；'
      + '**硬规则：总时长 ≤ 单段上限的视频必须一次直出，禁止拆成多段 / 多镜 / 多次调用再拼接**'
      + '（例如「15 秒」不许拆成 8+7）；多镜只在用户明确要求多镜时才用。'
      + `更长时先直出首段，再把剩余时长按 4 至模型上限（2.0 为 15、2.5 为 30） 秒均分逐段续拍（默认吃满上限、段数最少，最长 `
      + `${MAX_TOTAL_SECONDS} 秒）——`
      + '这是同一个镜头的续拍延长，也不是多镜拼接，'
      + '最后用 ffmpeg 合并成一个本地成片文件，默认落在会话工作目录下的 metaontic-video/，'
      + '文件名形如 20261027-201530-25s.mp4。20 秒、25 秒这类目标不用拆成多个任务：'
      + '直接传 duration=20 即可（20 秒 → 15+5，25 秒 → 15+10）。'
      + '**每段生成完都会先弹一次确认框问用户要不要继续**（循环迭代）：用户点「拒绝」就停下，'
      + '先把已经生成的部分交付，结果里带 paused=true、resumeDir 和 remainingSeconds；'
      + '之后用户说「继续」时，把 resumeDir 原样传给 video_generate 的 resume 参数接着做'
      + '（前面几段不重新生成、不重复扣费），不要从头再生成一遍、也不要改用 video_extend 拼。'
      + '没有可用确认通道时不会卡住，会按已确认的计划继续并在 note 里说明。'
      + '返回每段任务 ID、上游链接和成片路径。生成通常需要几分钟（每段单独生成），'
      + '单次调用返回 timeout、或某段返回 unknown（查询失败、任务其实已提交）时，'
      + '都用返回的任务 ID 走 video_status 继续等，不要重复提交新任务——'
      + '重复提交会重复扣费，查询失败不代表没有生成。'
      + '**调用前必须先让用户审核过脚本、并确认开始制作**（两道确认缺一不可），不要跳过脚本直接生成。'
      + '合并需要本机有 ffmpeg。本机没装 ffmpeg 时，插件会**先把这次调用拦回来（不会调用模型、'
      + '不产生费用）**，返回的说明里带着按系统给的安装命令 ——这时要在对话框里和用户确认：'
      + '问他要不要现在装 ffmpeg（给出他系统的命令，说明装好重跑就会自动合并、分段不用重新生成），'
      + '同意就用终端工具装上（宿主会让他确认）并 `ffmpeg -version` 验证，然后按同样的 duration 重发；'
      + '用户不想装就带 merge:false 重发，插件只返回分段列表（每段上游链接 + 本地文件）。'
      + '拿到 ffmpegMissing=true 的结果时也要照 installHint 引导安装，别只丢一句「已跳过合并」。'
      + '**人物形象 / 参考图**：公网图片 URL、base64（data URI 或纯 base64）、本机图片路径，'
      + '或简写 `latest` 都支持——要固定人物长相、服装、场景时传 referenceImages（一次只认第一张）；'
      + '首帧 / 尾帧用 firstFrameUrl / lastFrameUrl 传。公网 URL 直接交给中转站取图；本地图片由插件读进来'
      + '（按 ratio 先适配画幅）内联成 image_url 发给中转站，用户不需要自己找图床。'
      + '**用户说「就用我刚上传/刚拖进来的那张图」时直接传 `latest`**（`latest:2` 取第 2 新的）：'
      + '插件会去 Harness 附件库里找最近 2 小时上传的图片——哪怕当前聊天模型不支持图片、'
      + '附件被 `MODEL_DOES_NOT_SUPPORT_IMAGES` 拦下，图片本身也已经落盘，照样能用。'
      + '别在这时说「我看不到图片」，也别让用户自己去找路径。',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: '精简的本段内容或全片创意概要，不传完整剧本。超过模型上限时必须另传segmentPrompts，每段分别写新动作与对白。',
        },
        duration: {
          type: 'integer',
          minimum: 4,
          maximum: 120,
          description:
            '目标总时长（秒）。不超过模型单段上限（2.0 为 15、2.5 为 30）时就一次直出（整条视频只生成一次，'
            + '禁止拆成多段/多镜再拼）；超过就先直出上限长度再逐段延长，最后合并。'
            + `单条成片最长 ${MAX_TOTAL_SECONDS} 秒（最多 ${MAX_SEGMENTS} 段），更长的目标按 `
            + `${MAX_TOTAL_SECONDS} 秒执行并在 note 里说明，不要反复重试更大的时长。`,
        },
        firstFrameUrl: {
          type: 'string',
          description: '可选：首帧图，公网 URL、base64 或本机图片路径（含对话里 @ 引用的上传文件）都行，'
            + '作为生成的首帧参考；本机图片会按 ratio 先适配到目标画幅再提交。',
        },
        lastFrameUrl: {
          type: 'string',
          description: '可选：尾帧图，公网 URL、base64 或本机图片路径都行，作为生成的尾帧参考。',
        },
        segmentPrompts: {
          type: 'array', items: { type: 'string', minLength: 1 },
          description: '多段生成必须提供：按完整计划顺序，每段一条独立提示词，含稳定主体标签、动作起止状态、本段新对白和运镜。2.0按事件顺序；2.5可用本段从0秒起的连续时间区间。续做默认沿用原数组，不传整份剧本替代每段。',
        },
        referenceImages: {
          type: 'array',
          items: { type: 'string' },
          description:
            '可选：人物形象 / 主体参考图（每项是公网 URL、base64（data URI 或纯 base64）、本机图片路径，'
            + '或 `latest` / `latest:2` 这种「用户最近上传的图片」简写）。'
            + '想把某个人的长相、发型、服装固定下来时用它，图片以 role=reference_image 传给上游。'
            + 'B火山直连：2.0最多9张、2.5最多30张，不能与首尾帧混用，支持asset://素材。A服务端中转仅提交第一张。'
            + '本地图片单张不超过 8 MB，支持 jpg/jpeg/png/webp/bmp/gif/tiff。',
        },
        segmentSeconds: {
          type: 'integer',
          minimum: 4,
          maximum: modelMaxSeconds(config),
          description:
            '仅在超过单段上限时才用：每段延长多少秒，默认用配置里的每段秒数；'
            + '4 至模型上限（2.0 为 15、2.5 为 30） 的整数（如 5/8/10/14），默认按模型上限：按上限拆、段数最少。',
        },
        mode: {
          type: 'string',
          enum: ['continuous', 'closeup'],
          description: '延长时的衔接方式：continuous=同机位连续（默认）；closeup=在台词结束处切近景。',
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
        resume: {
          type: 'string',
          description:
            '接着上一次暂停的长视频继续生成：传上一次结果里的 resumeDir（那个分段目录）。'
            + '插件会沿用暂停记录里的提示词、分段计划和已经生成好的前几段，只把剩下的秒数生成完再合并；'
            + 'prompt 可以省略（要改剧情再传），duration 传更大的数可以顺手把总时长加长。'
            + '同一份暂停进度同时只允许一次 resume 在跑：已经有别的调用在续做时会直接报错，'
            + '等它跑完再继续，别重复发（重复会把剩下的段提交两遍、重复扣费）。',
        },
        merge: {
          type: 'boolean',
          description: '是否下载分段并用 ffmpeg 合并成一个本地成片，默认 true；'
            + '本机没有 ffmpeg 时，长视频会被先拦回来让用户决定要不要装（见 description）；'
            + '显式传 false 表示只返回分段列表，不再拦。',
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
          actualSeconds: { type: 'number' },
          seamCuts: { type: 'array', items: { type: 'object', properties: { index: { type: 'integer' }, seconds: { type: 'number' }, tailSeconds: { type: 'number' } } } },
          merged: { type: 'boolean' },
          seamTrimSeconds: { type: 'string', description: '预览确认后裁剪各接缝：如 0.5,0 表示仅裁第2段开头0.5秒；默认不裁，音视频同步裁剪，实际时长缩短。' },
        mergeMode: { type: 'string' },
          segmentsDir: { type: 'string' },
          ffmpegMissing: { type: 'boolean' },
          installHint: { type: 'string' },
          partial: { type: 'boolean' },
          paused: { type: 'boolean' },
          resumeDir: { type: 'string' },
          remainingSeconds: { type: 'integer' },
          pendingTaskId: { type: 'string' },
          images: { type: 'array' },
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

      // 接着上一次暂停的进度继续做（循环迭代的第二轮起）：计划、游标、参考视频都从暂停记录里来。
      const resumeDir = resumeDirOf(args?.resume);
      const resume = resumeDir ? await readPauseFile(resumeDir) : null;

      const prompt = String(args?.prompt ?? '').trim() || String(resume?.prompt ?? '').trim();
      if (!prompt) {
        throw new Error(resumeDir
          ? '这次是接着上一次暂停的视频继续，但暂停记录里没有提示词：请把 prompt 补上。'
          : '提示词 prompt 不能为空。');
      }

      const target = resolveTargetPlan(config, args);
      const { singleMax, segmentSeconds, cap, asked } = target;
      const restarted = resume
        ? resumePlanFrom(resume, {
          askedTotal: args?.duration == null ? null : asked,
          segmentSeconds,
        })
        : null;
      const plan = restarted ? restarted.plan : target.plan;
      const fullPlan = restarted ? restarted.fullPlan : target.plan;
      const total = restarted ? restarted.total : target.total;
      const doneBefore = restarted ? (Number(resume.done) || 0) : 0;
      const plannedTotal = plan.reduce((sum, step) => sum + step.seconds, 0);

      const notes = [];
      if (restarted) {
        notes.push(
          `接着上一次暂停的进度继续：前面 ${doneBefore} 段（${restarted.cursor} 秒）不重新生成，`
          + `这次还要生成 ${plan.length} 段共 ${plannedTotal} 秒。`,
        );
      } else if (asked > total) {
        notes.push(
          `目标 ${asked} 秒超过单条成片上限 ${cap} 秒（首段最长 ${singleMax} 秒 + 每段最多 `
          + `${segmentSeconds} 秒 × ${MAX_SEGMENTS - 1}），本次按 ${total} 秒执行。`,
        );
      }
      if (!restarted && plannedTotal < total) {
        notes.push(
          `目标 ${total} 秒排不满（每段上限 ${segmentSeconds} 秒 × ${MAX_SEGMENTS} 段），`
          + `本次按 ${plannedTotal} 秒执行。`,
        );
      } else if (!restarted && plannedTotal > total) {
        notes.push(
          `目标 ${total} 秒拆不出完全等长的分段（每段 4 至模型上限（2.0 为 15、2.5 为 30） 秒），本次按 ${plannedTotal} 秒执行。`,
        );
      }

      const segments = [];
      if (restarted) {
        // 上一次暂停前生成好的段：文件就在同样的分段目录里（序号 + 类型就是文件名），
        // 放进结果里，续做后的时间线、合并、成片时长才是完整的。
        for (const step of (resume.steps || [])) {
          segments.push({
            index: step.index,
            kind: step.kind,
            seconds: step.seconds,
            taskId: step.taskId,
            status: 'succeeded',
            videoUrl: step.videoUrl,
          });
        }
      }
      const resultImages = [];
      let status = 'succeeded';
      let error;
      let errorCode;
      let referenceUrl = restarted ? String(resume.lastVideoUrl || '') : '';
      let cursor = restarted ? restarted.cursor : 0;
      // 用户选择先不继续（确认框里点了拒绝/取消）：先交付已经生成的部分。
      let paused = false;
      let confirmWarned = false;
      // 上次那轮用的参数（续做时调用方可以只传 resume）
      const resumeOptions = restarted ? (resume.options || {}) : {};
      const suppliedPrompts = resolveSegmentPrompts(
        args?.segmentPrompts ?? resumeOptions.segmentPrompts, fullPlan.length,
      );

      // 被用户停止 / 宿主超时时，别把已经生成好的分段丢掉：按「暂停」收尾，留暂停记录给 resume。
      let interrupted = false;
      try {
      for (const [offset, step] of plan.entries()) {
        if (exec?.signal?.aborted) throw abortError();
        const position = doneBefore + offset;

        const focusedPrompt = suppliedPrompts
          ? `【本段内容】${suppliedPrompts[position]}\n`
            + (step.kind === 'extend' ? '从视频1结束后的下一事件继续，仅输出本段新增动作与对白。' : '')
          : prompt;
        const stepArgs = {
          ...resumeOptions,
          ...args,
          prompt: focusedPrompt,
          duration: step.seconds,
          // 这条流程是「先直出再向后续拍」，分段的拼接顺序固定为向后延长。
          direction: 'backward',
          startAt: step.kind === 'extend' && isOmniExtendModel(resolveModel(config)) ? cursor : undefined,
        };
        let body;
        let seconds;
        if (step.kind === 'generate') {
          const generated = await buildGenerationBody(config, stepArgs, step.seconds, {
            signal: exec?.signal,
          });
          body = generated.body;
          seconds = generated.seconds;
          if (generated.images?.length) resultImages.push(...generated.images);
          if (generated.notes?.length) notes.push(...generated.notes);
        } else {
          ({ body, seconds } = buildRequestBody(config, stepArgs, referenceUrl));
        }

        const final = await runTask(config, body, exec?.signal);
        const detail = final.errorCode === 'content_rejected'
          ? `${CONTENT_REJECTION_HINT}上游详情：${final.error || ''}`
          : final.error;

        segments.push({
          index: position + 1,
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

        // 先结束本次调用并交付视频，让助手展示成果后再询问是否继续。
        // 工具内部阻塞在审批框时，宿主尚拿不到输出，无法展示刚完成的分段。
        if (plan[offset + 1]) {
          paused = true;
          notes.push('本段已完成：请先展示本次视频成果，让用户预览；用户确认继续后再用 resume 接着生成下一段。');
          break;
        }
      }
      } catch (failure) {
        const doneYet = segments.some((segment) => segment.status === 'succeeded' && segment.videoUrl);
        if (failure?.code !== 'ABORTED' || !doneYet) throw failure;
        // 中断/超时：已经生成的部分照常下载合并交付，剩下的交给 resume。
        interrupted = true;
        paused = true;
        notes.push(
          '这次调用被中断了（用户点了停止，或者等超时了）：已经生成好的部分会先下载、合并、交付，'
          + '剩下的秒数不用重头再来——用 resume 就能接着做。',
        );
      }

      const completed = segments.filter((segment) => segment.status === 'succeeded' && segment.videoUrl);
      // 结果字段随流程追加（合并信息、备注等），显式声明成可扩展对象
      const result: Record<string, any> = {
        status,
        mode: fullPlan.length > 1 ? 'extended' : 'direct',
        plannedSeconds: restarted ? total : plannedTotal,
        totalSeconds: completed.reduce((sum, segment) => sum + segment.seconds, 0),
        segments,
        videoUrl: completed.at(-1)?.videoUrl,
        error,
        errorCode,
      };
      if (resultImages.length) {
        // 只回「用了哪些图、来自哪里」，不回 base64 正文（太长）
        result.images = resultImages.map((item) => ({
          role: item.role,
          source: item.source,
          localPath: item.localPath,
          bytes: item.bytes,
          originalPath: item.originalPath,
          fittedTo: item.fittedTo,
          uploadedAt: item.uploadedAt,
          recentUploads: item.recentUploads,
        }));
      }

      const deliveredSeconds = completed.reduce((sum, segment) => sum + segment.seconds, 0);
      // 没成功的那一段：区分「确实失败」和「只是没查到」。后者任务已经提交、大概率还在生成，
      // 必须把任务 ID 交给用户/模型，用 video_status 事后补拉，而不是当成没生成。
      if (status !== 'succeeded') {
        const last = segments.at(-1) || {};
        if (status === 'unknown' || status === 'timeout') {
          result.pendingTaskId = last.taskId;
          notes.push(
            `第 ${last.index ?? segments.length} 段的查询没拿到结果（${status}），但任务已提交：`
            + `${last.taskId || '（无任务 ID）'}。它可能仍在生成——用 video_status 按这个 ID 复查，`
            + '拿到链接就能补上这一段，不用重新提交、不会重复扣费。',
          );
        } else {
          notes.push(`第 ${last.index ?? segments.length} 段没有成功（${status}）。`);
        }
        if (completed.length) {
          notes.push(
            `已把成功的 ${completed.length} 段（${deliveredSeconds} 秒）下载并合并交付，可作为残片使用。`,
          );
          result.partial = true;
        } else {
          result.note = notes.join('\n');
          return result;
        }
      }

      if (args?.merge === false) {
        if (paused) {
          // 没下载分段也要留暂停记录：接着做时按记录里的上游链接重新拉。
          const pauseOutDir = await resolveOutputDir(config, exec, deps);
          const allocated = await allocateStamp(pauseOutDir, fileStamp());
          await writePauseFile(allocated.segmentsDir, pauseRecordAt({
            stamp: allocated.stamp,
            prompt,
            fullPlan,
            done: segments.length,
            cursor,
            lastVideoUrl: referenceUrl,
            options: pickResumeOptions(args),
            segments,
          }));
          result.segmentsDir = allocated.segmentsDir;
          result.resumeDir = allocated.segmentsDir;
          result.paused = true;
          result.remainingSeconds = Math.max(0, total - deliveredSeconds);
          notes.push('按参数要求只返回上游链接，没有下载分段（resume 时会按链接重新拉）。');
          notes.push(resumeHint(allocated.segmentsDir, result.remainingSeconds));
        }
        result.note = [...notes, '按参数要求只返回上游链接，没有下载合并。'].join('\n');
        return result;
      }

      const outDir = await resolveOutputDir(config, exec, deps);
      // 原子占位，拿到本次唯一的 stamp（分段目录 + 成片名前缀），避免并发调用撞名。
      // 接着做时沿用上一次的分段目录与 stamp：前面几段就在里面，合并时一起拼。
      const { stamp, segmentsDir } = restarted
        ? { stamp: String(resume.stamp || fileStamp()), segmentsDir: resumeDir }
        : await allocateStamp(outDir, fileStamp());
      const delivery = await downloadSegmentsAndMerge(config, {
        segments: completed,
        segmentsDir,
        outDir,
        stamp,
        notes,
        // 暂停时只有一段的话，这一段的文件要留在分段目录里给之后续做用。
        keepSingleFile: paused,
        // 被中断时请求信号已经 abort：收尾（下载 + 合并）不能被它打断，否则等于白生成。
        signal: interrupted ? undefined : exec?.signal,
      });
      if (delivery.error) {
        result.segmentsDir = delivery.segmentsDir;
        result.note = [...notes, delivery.error].join('\n');
        return result;
      }
      if (delivery.ffmpegMissing) {
        result.segmentsDir = delivery.segmentsDir;
        result.merged = false;
        result.ffmpegMissing = true;
        result.installHint = delivery.installHint;
        result.note = notes.join('\n');
        return result;
      }
      if (!delivery.files.length) return result;
      if (delivery.merged) {
        result.merged = true;
        result.videoPath = delivery.videoPath;
        result.mergeMode = delivery.mergeMode;
        if (delivery.actualSeconds) result.actualSeconds = delivery.actualSeconds;
        if (delivery.seamCuts?.length) result.seamCuts = delivery.seamCuts;
      }

      if (paused) {
        // 暂停：分段要留着（接着做时当前几段用），并写下「生成到哪一步」的暂停记录。
        result.segmentsDir = segmentsDir;
        result.resumeDir = segmentsDir;
        result.paused = true;
        result.remainingSeconds = Math.max(0, total - deliveredSeconds);
        try {
          await writePauseFile(segmentsDir, pauseRecordAt({
            stamp,
            prompt,
            fullPlan,
            done: segments.length,
            cursor,
            lastVideoUrl: referenceUrl,
            options: pickResumeOptions(args),
            segments,
          }));
        } catch (failure) {
          notes.push(`暂停记录没写成（${failure?.message || failure}）：要接着做只能用上面的链接走 video_extend。`);
        }
        notes.push(`已交付的成片是从头到第 ${segments.length} 段，分段仍保留在 ${segmentsDir}。`);
        notes.push(resumeHint(segmentsDir, result.remainingSeconds, TOOL_NAME));
        result.note = notes.join('\n');
        return result;
      }

      // 所有生成分段永久保留；合并、裁剪仅使用副本。
      result.segmentsDir = segmentsDir;
      if (notes.length) result.note = notes.join('\n');
      return result;
    },
  };
}

/**
 * `video_setup` —— 检查本机跑不跑得动 ffmpeg，缺了就由插件来装。
 *
 * 存在的意义：长视频合并要 ffmpeg，而「在对话框里问一句要不要装」光靠模型没法落地
 * （模型不一定有终端工具、也不一定敢自己跑安装命令）。所以给一个工具：
 * 用户同意后由插件执行安装（install=true 会走审批卡口，让用户先看到完整命令），
 * 装完自己再验证一次，并告诉模型「现在重跑生成就会自动合并」。
 */
function setupTool(config) {
  return {
    name: 'video_setup',
    description:
      '检查本机有没有 ffmpeg（生成超过模型单次上限的视频时，合并成一条要用它），缺了就装。'
      + 'install=true 表示「用户已经同意安装」，插件会执行安装命令并验证——'
      + '命令会先拿给用户确认，用户点了允许才执行。'
      + '装不上（例如本机连包管理器都没有）会返回手动安装步骤和一个 nextStep。'
      + '用户说「帮我装 ffmpeg」「检查一下环境」时用它；只有确实要装才传 install=true。',
    parameters: {
      type: 'object',
      properties: {
        install: {
          type: 'boolean',
          description: '是否执行安装，默认 false（只检查、只汇报，不动本机）。',
        },
        target: {
          type: 'string',
          enum: ['ffmpeg', 'package-manager'],
          description: 'install=true 时装什么：ffmpeg（默认）或先装包管理器（macOS 的 Homebrew）。',
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          os: { type: 'string' },
          ffmpegVersion: { type: 'string' },
          ffmpegPath: { type: 'string' },
          ffprobeVersion: { type: 'string' },
          installCommand: { type: 'string' },
          manualSteps: { type: 'array', items: { type: 'string' } },
          output: { type: 'string' },
          note: { type: 'string' },
        },
      },
      render(_args, value) {
        const {
          status, os, ffmpegVersion, ffmpegPath, ffprobeVersion, installCommand, output, note,
        } = value || {};
        const lines = [];
        if (status === 'ready') {
          lines.push('本机环境没问题：ffmpeg 已经能用了，长视频可以直接合并成一条。');
        } else if (status === 'installed') {
          lines.push('ffmpeg 装好了，长视频现在可以合并成一条。');
        } else if (status === 'missing') {
          lines.push('本机还没有 ffmpeg：生成超过模型单次上限的视频时只能给分段，没法合并成一条。');
          lines.push(`装一下就好（${os || '当前系统'}）：${installCommand || ''}`);
          lines.push('用户同意的话，我可以用 video_setup（install=true）直接帮他装。');
        } else if (status === 'failed') {
          lines.push('ffmpeg 没装成功，得手动装一下。');
          lines.push(`手动步骤：${note || installCommand || ''}`);
        } else {
          lines.push(`环境检查结果：${status || '未知'}。`);
        }
        if (ffmpegVersion) lines.push(`ffmpeg：${ffmpegVersion}`);
        if (ffmpegPath) lines.push(`ffmpeg 路径：${ffmpegPath}（可以填进插件设置里的「ffmpeg 路径」）`);
        if (ffprobeVersion) lines.push(`ffprobe：${ffprobeVersion}`);
        if (status !== 'ready' && status !== 'installed' && installCommand && status === 'failed') {
          lines.push(`命令：${installCommand}`);
        }
        if (output) lines.push(`安装输出（末尾）：${output}`);
        if (note) lines.push(note);
        return [{ type: 'text', text: lines.filter(Boolean).join('\n') }];
      },
    },
    // 装 ffmpeg 可能要下载几十 MB，给足时间；装完还要再验证一次。
    timeoutMs: 20 * 60 * 1000,
    isConcurrencySafe() {
      return false;
    },
    async execute(args, exec) {
      const signal = exec?.signal;
      const binary = resolveBinary(config, 'ffmpegBinary', 'ffmpeg');
      const probeBinary = resolveBinary(config, 'ffprobeBinary', 'ffprobe');
      const { os, installs, bootstrap } = ffmpegInstallOptions();
      const wantsInstall = args?.install === true;
      const target = String(args?.target || 'ffmpeg');
      const manualSteps = installs.map((item) => `${item.label}：${item.command}`);
      const installCommand = target === 'package-manager' && bootstrap
        ? bootstrap.command
        : installs[0].command;

      const ffmpegVersion = await probeBinaryVersion(binary, signal);
      const ffprobeVersion = await probeBinaryVersion(probeBinary, signal);
      const base = { os, installCommand, manualSteps, ffmpegVersion, ffprobeVersion };

      // 已经能用了：只汇报，顺便提醒 ffprobe 的情况（分段时长探测用它）
      if (ffmpegVersion) {
        const note = ffprobeVersion
          ? 'ffmpeg 与 ffprobe 都可用，长视频会正常合并成一条。'
          : 'ffmpeg 可用；没有 ffprobe，分段时长探测会被跳过（不影响合并）。';
        return { status: 'ready', ...base, ffmpegPath: binary, note };
      }

      // 只检查：把安装方式交出去，等用户点头
      if (!wantsInstall) {
        return {
          status: 'missing',
          ...base,
          note: `本机 ${binary} 跑不起来。用户同意后可以 install=true 让我来装；`
            + '也有可能是路径不对：已经装过就把绝对路径填进插件设置里的「ffmpeg 路径」。',
        };
      }

      // 用户已经同意：真的执行安装命令，跑完再验证一次
      let output = '';
      try {
        const shellCommand = target === 'package-manager' && bootstrap
          ? bootstrap.command
          : (target === 'package-manager' && !bootstrap
            ? null
            : installs[0].command);
        if (!shellCommand) {
          return {
            status: 'failed',
            ...base,
            note: `${os} 不需要另外装包管理器，直接用系统自带的包管理器装 ffmpeg 就行。`,
          };
        }
        const result = await runProcess(shellCommand, [], {
          signal,
          shell: true,
          timeoutMs: 18 * 60 * 1000,
        });
        output = tail(String(result.stdout || '') + String(result.stderr || ''), 800);
      } catch (error) {
        output = tail(error?.message || String(error), 800);
      }

      const afterVersion = await probeBinaryVersion(binary, signal);
      if (afterVersion) {
        return {
          status: 'installed',
          ...base,
          ffmpegVersion: afterVersion,
          ffmpegPath: binary,
          output,
          note: '装好了：直接重跑刚才那次生成就会自动合并成一条（分段不用重新生成）。',
        };
      }

      // PATH 还没刷新时，ffmpeg 往往已经落在常见位置里，找出来让用户填配置
      const found = await findInstalledFfmpeg(signal);
      if (found) {
        return {
          status: 'installed',
          ...base,
          ffmpegVersion: await probeBinaryVersion(found, signal),
          ffmpegPath: found,
          output,
          note: `装好了，但没进 PATH：把 ${found} 填进插件设置里的「ffmpeg 路径」`
            + '（或者重开一个终端再重跑一次生成）。',
        };
      }

      const needsBootstrap = Boolean(bootstrap) && !ffmpegVersion
        && /command not found|not found|不是内部或外部命令|未找到/i.test(output);
      return {
        status: 'failed',
        ...base,
        installCommand: needsBootstrap ? bootstrap.command : installs[0].command,
        manualSteps: needsBootstrap
          ? [`先装包管理器：${bootstrap.command}`, ...manualSteps]
          : manualSteps,
        output,
        note: needsBootstrap
          ? `本机没有 ${os} 的包管理器，得先装它：${bootstrap.command}；装好之后再装 ffmpeg。`
            + '这两步都可以让我来做 —— 说一声就行。'
          : '安装命令没成功（可能是没权限、没联网或被安全策略拦下）。'
            + '上面是手动步骤，照着在终端里跑一遍即可。',
      };
    },
  };
}

function taskTool(config) {
  return {
    name: 'video_status',
    description:
      '按任务 ID 查询 Seedance 视频任务（生成、延长与合并）的状态；'
      + '任务完成（status 为 succeeded）时返回视频下载链接（约 24 小时内有效）。'
      + 'video_generate / video_extend 返回 timeout 或某段 unknown（查询失败、任务已提交）时，'
      + '用它们给出的 taskId 在这里继续等——unknown 只表示「没查到」，任务很可能还在生成，'
      + '不要因此重新提交同一段任务。',
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
        if (status === 'unknown') {
          const detail = String(error || '查询失败').replace(/。+$/, '');
          return [
            {
              type: 'text',
              text: `任务 ${taskId} 这次没查到状态：${detail}。`
                + '这不代表任务没有生成——稍后重试，或检查 Key / 额度后再查一次，不要重新提交。',
            },
          ];
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

      // 查询失败（401、限流、网络抖动）只说明「这次没查到」，不代表任务没生成：
      // 返回 unknown + 提示，让用户/模型稍后重试，而不是弹一个看起来像「任务失败」的报错。
      let task;
      try {
        task = await getTask(config, taskId, exec?.signal);
      } catch (failure) {
        return {
          taskId,
          status: 'unknown',
          errorCode: failure?.code || 'provider_poll_error',
          error: `查询失败：${failure?.message || failure}`,
        };
      }
      const status = extractStatus(task) || 'unknown';
      const model = findKey(task, ['model']) || resolveModel(config);
      const videoUrl = extractVideoUrl(task);

      if (SUCCESS_STATES.has(status) && videoUrl) {
        return { taskId, status: 'succeeded', model, videoUrl };
      }
      // 上游说成功、但没有可下载的视频链接：当成失败并说明原因，别让 render 显示「已完成 /（无）」。
      if (SUCCESS_STATES.has(status) && !videoUrl) {
        const imageUrl = extractImageUrl(task);
        return {
          taskId,
          status: 'failed',
          model,
          errorCode: 'provider_bad_response',
          error: imageUrl
            ? `上游返回的是图片而不是视频（${imageUrl.split('?')[0].slice(-60)}）。`
            : '上游报告成功但没有返回视频地址。',
        };
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
  'connectionMode', 'volcengineApiKey', 'apiKey', 'baseUrl', 'submitPath', 'queryPath', 'model',
  'duration', 'singleMaxSeconds', 'mode', 'ratio', 'generateAudio', 'watermark',
  'extraParams', 'pollIntervalMs', 'maxWaitMs',
  'pollErrorRetries',
  'seamTrimSeconds', 'mergeMode', 'bgmFadeSeconds', 'outputDir', 'keepSegments', 'resumeLockStaleMinutes',
  'ffmpegBinary', 'ffprobeBinary',
  'registerEmail', 'registerApi', 'deviceId', 'estimateGroupRatio',
];

/**
 * 只读字段：密钥一律由服务端在「登录」时下发写入，页面和工具都不许改，
 * 免得手填一把没绑设备、查不到额度的 Key 出去瞎调。
 */
const READ_ONLY_CONFIG_FIELDS = new Set(['apiKey', 'keyOrigin', 'deviceId', 'deviceSecret']);

function maskSecrets(view) {
  return {
    ...view,
    volcengineApiKey: view.volcengineApiKey ? '（已配置）' : '',
    apiKey: view.apiKey ? '（已配置）' : '',
    deviceSecret: view.deviceSecret ? '（已配置）' : '',
  };
}

/** 当前配置：stored 是写进 profile patch 的值，effective 是实际生效（含预设与环境变量）。 */
function configView(config) {
  const stored = {};
  for (const key of CONFIG_FIELDS) stored[key] = ref(config, key, undefined);
  return {
    stored: maskSecrets(stored),
    effective: {
      connectionMode: isVolcengine(config) ? 'volcengine' : 'service',
      baseUrl: resolveBaseUrl(config),
      submitPath: resolveSubmitPath(config),
      queryPath: String(ref(config, 'queryPath', '')).trim() || relayPreset().queryPath,
      model: resolveModel(config),
      // 密钥只有一种合法来源：设置页「登录」时服务端下发
      apiKeySource: isVolcengine(config) ? (resolveApiKey(config) ? 'volcengine' : 'missing') : ref(config, 'apiKey', '')
        ? (isServerIssuedKey(config) ? 'register' : 'unverified')
        : 'missing',
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
      '读取或修改 MetaOnticVideo 插件自己的配置（baseUrl、submitPath、queryPath、model、'
      + 'duration、singleMaxSeconds、mode、ratio、generateAudio、'
      + 'watermark、extraParams、pollIntervalMs、maxWaitMs、mergeMode、bgmFadeSeconds、'
      + 'outputDir、keepSegments、resumeLockStaleMinutes、'
      + 'ffmpegBinary、ffprobeBinary、registerEmail、registerApi、estimateGroupRatio）。'
      + 'apiKey 只能由设置页「登录」时服务端下发，这里只能看、不能改；'
      + '用户要换 Key 就让他去插件详情页点「登录」。'
      + '改动写进 profile 的 cordis.patch.yml，'
      + '宿主重载后生效。'
      + '用户说「把中转站地址/模型/时长改成 X」时用 action=set，看当前值用 action=get；'
      + 'duration 是每段新增秒数上限（4 至模型上限（2.0 为 15、2.5 为 30），默认按模型上限、段数最少），singleMaxSeconds 为兼容旧配置保留，直出上限由模型映射。',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set'],
          description: 'get=查看当前配置；set=修改配置（至少给一个要改的字段）。',
        },
        connectionMode: { type: 'string', enum: ['service', 'volcengine'], description: 'A 服务端 / B 火山直连' },
        volcengineApiKey: { type: 'string', description: 'B 模式火山 API Key' },
        baseUrl: { type: 'string', description: '基础地址，即中转站站址，例如 https://ai.bileego.com。' },
        registerEmail: { type: 'string', description: '领 Key 用的邮箱（账号）；注册要邮箱验证码，一个邮箱只发一把。' },
        registerApi: { type: 'string', description: '插件服务地址（领 Key / 查额度 / 使用记录）；留空用内置域名。' },
        estimateGroupRatio: { type: 'number', description: '预估费用用的分组折扣（中转站 group_ratio：默认 0.8）。' },
        submitPath: { type: 'string', description: '创建任务路径，例如 /doubao/api/v3/contents/generations/tasks。' },
        queryPath: { type: 'string', description: '查询任务路径，{task_id} 会被替换。' },
        model: { type: 'string', description: '模型 ID，例如 doubao-seedance-2-0-mini-260615。' },
        duration: { type: 'integer', minimum: 4, maximum: modelMaxSeconds(config), description: '每段新增秒数上限（4 至模型上限（2.0 为 15、2.5 为 30） 的整数，默认按模型上限、段数最少）。' },
        mode: { type: 'string', enum: ['continuous', 'closeup'], description: '续拍方式。' },
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
        pollErrorRetries: {
          type: 'integer',
          minimum: 1,
          maximum: 60,
          description: '轮询「查询失败」的容忍次数（默认 5）：连续失败这么多次才放弃等待；'
            + '放弃时任务 ID 仍保留，可用 video_status 补查。',
        },
        singleMaxSeconds: {
          type: 'integer',
          minimum: 4,
          maximum: modelMaxSeconds(config),
          description: '单次直出上限（秒）：不超过它一次生成，超过它才分段延长。',
        },
        seamTrimSeconds: { type: 'string', description: '预览确认后裁剪各接缝：如 0.5,0 表示仅裁第2段开头0.5秒；默认不裁，音视频同步裁剪，实际时长缩短。' },
        mergeMode: {
          type: 'string',
          enum: ['seamless', 'copy', 'reencode'],
          description: '合并方式：seamless=按接缝实测把后段的亮度/音量对齐，再用 0.25 秒交叉淡化接上'
            + '（默认，接缝看不出换段）；copy=无损拼接（快，但接缝是硬切）；reencode=统一重编码。',
        },
        outputDir: { type: 'string', description: '成片输出目录；留空用会话工作目录下的 metaontic-video/。' },
        keepSegments: { type: 'boolean', description: '合并后是否保留分段原片。' },
        resumeLockStaleMinutes: {
          type: 'number',
          minimum: 0,
          description: '暂停目录的续做锁多久算过期（分钟，默认 60，0=永不过期）。',
        },
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
          `  apiKey 来源：${{
            register: '服务端下发（登录写入）',
            unverified: '非服务端下发——调用会被拒绝，请到设置页点「登录」',
            missing: '未配置——请到设置页点「登录」',
          }[effective?.apiKeySource] || effective?.apiKeySource}`,
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
      const readonly = Object.keys(args || {}).filter((key) => READ_ONLY_CONFIG_FIELDS.has(key));
      if (readonly.length) {
        throw new Error(
          `${readonly.join('、')} 由服务端在「登录」时下发，不能手动改；`
          + '要换 Key 请在「插件 → 已安装插件 → MetaOnticVideo → 查看」点「登录」重新领取。',
        );
      }
      const patch = {};
      for (const key of CONFIG_FIELDS) {
        if (args?.[key] !== undefined && !READ_ONLY_CONFIG_FIELDS.has(key)) patch[key] = args[key];
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
    '提示词遵循火山进阶原则：先定义主体的2–3个稳定特征并固定标签，再写有承接关系的动作、场景光线、运镜和音频；少写重复限制。多段时必须准备segmentPrompts，每段仅含新增事件和对白。2.0按事件顺序自然节奏，2.5可用连续秒级区间；完整剧本留在script.md，不直接反复发给模型。',
    isVolcengine(config) ? '当前为 B 火山直连：使用 volcengineApiKey，无需服务端登录；不查询或判断余额、不套用中转站估价。仅按创建任务与查询任务接口的实际结果报告状态；创建成功不代表视频已生成，必须查询至succeeded且有视频地址。下述服务端领 Key 要求仅适用于 A 模式。' : '当前为 A 服务端模式：在设置页登录领取 Key。',
    'MetaOnticVideo（Seedance 视频生成插件）：需要生成视频、给视频加长时优先用它；'
      + '用户只要说想要多长（duration），超过单段上限的部分插件自己分段续拍再合并，不用用户自己拆任务。',
    '· **生成一条新视频必须先过两道确认，缺一不可**：'
      + '① 先把**视频脚本**写出来交给用户**审核**（脚本要含：画面风格、人物形象、分镜——逐镜的镜头 / 时间 / 画面、'
      + '对白——有对话就逐句写清谁在几秒说什么）；'
      + '② 脚本审核通过后，**再单独问一次要不要开始做**（说清会消耗额度与预估费用），用户点头了才调用 video_generate。'
      + '脚本一改，两道确认全部作废，要重新走。用户说「直接生成」也要先走这两步，不要跳过。'
      + '给已有视频接长（video_extend）不需要脚本，但同样要先确认再调用。',
    `· 新视频用 video_generate，duration 传目标总秒数。**硬规则：总时长 ≤ ${singleMax} 秒（单段上限）的整条`
      + '视频必须一次直出，默认一镜到底，禁止拆成多次 video_generate 再拼接**——'
      + `例如「15 秒」就是一次 15 秒，不许拆成 8+7；也不要为了「中间切一刀更好看」而分镜，`
      + '用户明确要求切镜时，在同一次生成的提示词中安排镜头切换。'
      + '超过上限时（如 20 秒）会自动拆成首段 + 若干续拍段再合并——那是同一条视频往下续拍，不是多镜拼接。'
      + '所以「20 秒视频」直接传 duration=20，不用拆成多个任务，也不用跟用户解释「模型一次只能出 15 秒」；'
      + '**超过单段上限的成片是「循环迭代」的：每段生成完先返回视频成果供展示，用户预览并确认后再用 resume 继续，'
      + '不要绕过它、也不要自己拆成多次生成**；'
      + '分段交付时结果里带 paused=true、resumeDir、remainingSeconds——'
      + '这时先把已经生成的部分交付给他，等他说「继续」再把 resumeDir 原样传给 video_generate 的 resume 参数'
      + '（插件接着已有的分段往下做，前面几段不重新生成、不重复扣费），不要从头再来一遍；'
      + '同一份暂停进度（resumeDir）同一时间只允许一次 resume 在跑：如果结果说「已经有一次『继续』在跑」，'
      + '就让用户等那一次跑完（或确认它已中断、锁过期）再继续，不要重复发 resume——重复会把剩下的段提交两遍、重复扣费；'
      + '用户中途点了「停止」或这一轮等超时也一样：已经生成好的段会先下载、合并、交付'
      + '（结果里同样是 paused=true + 成片 + resumeDir），不要把那几段丢掉重来；'
      + `单条成片最长 ${MAX_TOTAL_SECONDS} 秒（最多 ${MAX_SEGMENTS} 段），用户要更长的就按 `
      + `${MAX_TOTAL_SECONDS} 秒生成并说明这是插件当前的上限，不要反复加大 duration；`
      + '成片默认落在会话工作目录下的 metaontic-video/。',
    '· 给已有视频接长用 video_extend，输入必须是公网 URL；提示词以「向后延长视频1」或「向前延长视频1」开头，'
      + '全程用「视频1」指代素材，不要写「参考视频1」；写清延长方向、剧情发展、主体状态、镜头运动、'
      + '声音延续（背景音乐接在视频1结尾处、不要从头播放，环境声和对白也要连续）；'
      + '每段 4 至模型上限（2.0 为 15、2.5 为 30） 秒，默认按上限拆、段数最少；连着延长多段时每段完成先交付预览，用户确认后用 resume 继续，'
      + '并默认下载分段在本机合并成一条成片（缺 ffmpeg 会先拦下来问）；'
      + '用户点「拒绝」或中途被停止时，已经延长好的部分照样先交付（paused=true + resumeDir），'
      + '之后把 resumeDir 传给 video_extend 的 resume 参数接着做即可，不重复生成、不重复扣费。',
    '· 生成通常要几分钟：单次调用返回 timeout 不等于失败，用 video_status 加 taskId 继续查'
      + '（上游链接约 24 小时内有效），不要重复提交同一段。',
    '· 环境有问题（缺 ffmpeg 装不上、想确认能不能合并）用 video_setup：默认只检查，'
      + 'install:true 才会真装；装命令会先给用户确认，装完自动验证。'
      + '用户说「帮我装 ffmpeg」时就用它，别自己拼命令行。',
    '· 换模型、时长等配置用 video_config（写进 profile，宿主重载后生效）；'
      + '但 apiKey 例外：它只能由服务端在「登录」时下发，不要手填、也不要让用户手填，'
      + '缺 Key 或提示「不是服务端下发的」时，就引导用户去插件详情页点「登录」。'
      + '长视频要在本机合并，需要 ffmpeg：本机没装时，插件会先把这次生成拦回来（不产生费用），'
      + '这时要在对话框里问用户「要不要授权我装 ffmpeg」——按返回的说明说清他的系统与命令，'
      + '用户同意就调用 video_setup（install:true）由插件来装（宿主会先让他确认那条命令），'
      + '装完它会自己验证，再按原 duration 重发；'
      + '用户不想装就带 merge:false 重发，插件只返回分段列表（每段链接 + 本地文件），'
      + '结果里会带 ffmpegMissing=true 与 installHint，照它引导安装即可。',
    `· 当前配置：直出上限 ${singleMax} 秒、每段延长 ${segmentSeconds} 秒。`,
    '· 没有 API Key：让用户在插件设置页点「登录」，用邮箱收验证码领一把（一个邮箱只发一把，'
      + '默认额度 ¥0.01），成功后上游 / Key / 地址 / 模型会自动填好；'
      + '设置页还能看到这把 Key 的剩余 / 已用额度和最近几次出片的使用记录。',
  ].join('\n');
}

/**
 * 宿主注入回调的清理函数：只有真的是函数才挂到 disposers 上。
 * （宿主没有那项服务时 inject 不跑回调，返回值可能是 undefined。）
 */
function asDisposer(value: unknown): (() => void) | undefined {
  return typeof value === 'function' ? (value as () => void) : undefined;
}

export function apply(ctx: DshContext, config: any = {}) {
  // 可选服务的宿主对象（会话工作目录等），拿到就放进来
  const deps: Record<string, any> = {};
  const disposers = [
    ctx.tools.register(withResumeLock(jsonSafeTool(videoTool(config, deps, ctx)), 'video_generate', config)),
    ctx.tools.register(withResumeLock(jsonSafeTool(extendTool(config, deps, ctx)), 'video_extend', config)),
    ctx.tools.register(jsonSafeTool(taskTool(config))),
    ctx.tools.register(jsonSafeTool(setupTool(config))),
  ];
  // 配置工具依赖宿主的 settings 服务；没有该服务时插件其余功能照常可用。
  const cleanup = ctx.inject(['settings'], (settingsCtx) => {
    disposers.push(settingsCtx.tools.register(jsonSafeTool(configTool(config, settingsCtx.settings))));
  });
  for (const dispose of [asDisposer(cleanup)]) if (dispose) disposers.push(dispose);
  // 新对话自带的使用说明：宿主没有 systemPrompt 服务时跳过，其余功能不受影响。
  const promptCleanup = ctx.inject(['systemPrompt'], (promptCtx) => promptCtx.systemPrompt.section({
    name: 'plugin:metaontic-video',
    order: 5200,
    text: buildPromptGuidance(config),
  }));
  for (const dispose of [asDisposer(promptCleanup)]) if (dispose) disposers.push(dispose);
  // 会话工作目录也是可选的：宿主不提供时合并结果落在进程 cwd 下。
  const workdirCleanup = ctx.inject(['workingDirectory'], (workdirCtx) => {
    deps.workdir = workdirCtx.workingDirectory;
    return () => { deps.workdir = undefined; };
  });
  for (const dispose of [asDisposer(workdirCleanup)]) if (dispose) disposers.push(dispose);
  // 每次真正调用视频模型前卡一道：宿主弹人工确认（含预估费用），额度不够直接拒绝。
  // 注册或预检本身出问题都不该把生成堵死：那样退回「没有预估数字」的人工确认。
  let gateCleanup;
  try {
    gateCleanup = ctx.on('tools/pre-execute', async (exec, next) => {
      if (!GATED_TOOLS.includes(exec.name)) return next();
      try {
        return await preflightGate(ctx, config, exec);
      } catch (error) {
        const message = error?.message || String(error);
        if (exec.name === 'video_setup') {
          const command = ffmpegInstallOptions().installs[0].command;
          return {
            kind: 'ask',
            reason: `人工确认：准备执行安装命令「${command}」（预检本身出错：${message}）。`,
            displayReason: {
              zh: `准备在这台电脑上装 ffmpeg：${command}。点了「允许」才会执行。`,
              en: `About to install ffmpeg on this machine: ${command}. It runs only after you allow it.`,
            },
          };
        }
        return {
          kind: 'ask',
          reason: `人工确认：调用视频模型（预估费用没算出来：${message}）。`,
          displayReason: {
            zh: `本次会调用视频模型，但预估费用没算出来（${message}）。`
              + '点了「允许」才会真正调用。',
            en: 'This will call the video model, but the cost estimate failed. '
              + 'The call runs only after you allow it.',
          },
        };
      }
    });
  } catch (error) {
    ctx.logger?.warn?.(
      `metaontic-video: 调用前的人工确认卡口注册失败：${error?.message || error}`,
    );
  }
  if (typeof gateCleanup === 'function') disposers.push(gateCleanup);
  return () => {
    for (const dispose of disposers) dispose();
  };
}
