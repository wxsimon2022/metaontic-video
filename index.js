import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import z from "@deepseek-ai/schemastery";
const inject = ["tools"];
const Config = z.object({
  entryId: z.string().default("metaontic-video").description("\u672C\u63D2\u4EF6\u5728 profile patch \u91CC\u7684\u6761\u76EE id\uFF1B\u914D\u7F6E\u5DE5\u5177\u7528\u5B83\u628A\u6539\u52A8\u5199\u56DE").volatile(),
  apiKey: z.string().default("").description(
    "API Key\uFF1A\u53EA\u5728\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D\u65F6\u7531\u670D\u52A1\u7AEF\u4E0B\u53D1\u5E76\u76F4\u63A5\u5199\u8FDB\u914D\u7F6E\uFF0C\u4E0D\u652F\u6301\u624B\u586B\u3001\u4E5F\u4E0D\u8BFB\u73AF\u5883\u53D8\u91CF\uFF1B\u624B\u6539\u8FD9\u91CC\u7684\u503C\u4F1A\u88AB\u62D2\u7EDD\u8C03\u7528"
  ).volatile(),
  keyOrigin: z.string().default("").description("\u5BC6\u94A5\u6765\u6E90\u6807\u8BB0\uFF1A\u8BBE\u7F6E\u9875\u300C\u767B\u5F55\u300D\u6210\u529F\u540E\u5199\u5165 'register'\uFF0C\u63D2\u4EF6\u53EA\u8BA4\u670D\u52A1\u7AEF\u4E0B\u53D1\u7684 Key").volatile(),
  baseUrl: z.string().default("").description(
    "\u57FA\u7840\u5730\u5740\uFF08\u4E2D\u8F6C\u7AD9\u7AD9\u5740\uFF09\uFF1B\u7559\u7A7A\u65F6\u8BFB\u73AF\u5883\u53D8\u91CF NEWAPI_VIDEO_BASE_URL / NEWAPI_BASE_URL\u3002\u793A\u4F8B https://ai.bileego.com\uFF08\u4E0D\u8981\u5E26 /v1\uFF0C\u4E5F\u4E0D\u8981\u91CD\u590D /api/v3\uFF09"
  ).volatile(),
  submitPath: z.string().default("").description("\u521B\u5EFA\u4EFB\u52A1\u8DEF\u5F84\uFF1B\u7559\u7A7A\u7528\u4E2D\u8F6C\u7AD9\u9ED8\u8BA4\u503C /doubao/api/v3/contents/generations/tasks").volatile(),
  queryPath: z.string().default("").description("\u67E5\u8BE2\u4EFB\u52A1\u8DEF\u5F84\uFF0C{task_id} \u4F1A\u88AB\u4EFB\u52A1 ID \u66FF\u6362\uFF1B\u7559\u7A7A\u7528\u4E2D\u8F6C\u7AD9\u9ED8\u8BA4\u503C").volatile(),
  model: z.string().default("").description("\u89C6\u9891\u751F\u6210\u7528\u7684\u6A21\u578B ID\uFF08seedance 2.0 / 2.5 \u7CFB\u5217\uFF09\uFF1B\u7559\u7A7A\u8BFB NEWAPI_VIDEO_MODEL \u6216\u5185\u7F6E\u9ED8\u8BA4\u503C").volatile(),
  registerUser: z.string().default("").description("\uFF08\u5DF2\u5E9F\u5F03\uFF09\u5386\u53F2\u4E0A\u6CE8\u518C\u65F6\u586B\u7684\u7528\u6237\u540D\uFF1B\u73B0\u5728\u9886 Key \u7528\u90AE\u7BB1\u9A8C\u8BC1\u7801\uFF0C\u89C1 registerEmail").volatile(),
  registerEmail: z.string().default("").description("\u9886 Key \u7528\u7684\u90AE\u7BB1\uFF08\u8D26\u53F7\uFF09\uFF1A\u4E2D\u8F6C\u7AD9\u91CC\u7684\u5BC6\u94A5\u540D\u7531\u670D\u52A1\u7AEF\u751F\u6210\u552F\u4E00\u4E32\uFF0C\u4E0E\u8FD9\u4E2A\u90AE\u7BB1\u7ED1\u5B9A").volatile(),
  registerToken: z.string().default("metaontic-video-register-v1").description("\u6CE8\u518C\u8BF7\u6C42\u5934 X-Register-Token \u7684\u503C\uFF0C\u8981\u4E0E\u670D\u52A1\u7AEF REGISTER_CLIENT_TOKEN \u4E00\u81F4\uFF1B\u9875\u9762\u4E0D\u663E\u793A").volatile(),
  registerApi: z.string().default("").description("\u63D2\u4EF6\u670D\u52A1\u5730\u5740\uFF08\u9886 Key / \u67E5\u989D\u5EA6 / \u4F7F\u7528\u8BB0\u5F55\uFF09\uFF1B\u7559\u7A7A\u7528\u5185\u7F6E\u7684\u89C6\u9891\u670D\u52A1\u57DF\u540D").volatile(),
  deviceId: z.string().default("").description("\u672C\u673A\u8BBE\u5907\u6807\u8BC6\uFF1A\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D\u65F6\u5199\u5165\uFF0C\u7528\u6765\u67E5\u8FD9\u628A Key \u7684\u5269\u4F59\u989D\u5EA6").volatile(),
  deviceSecret: z.string().default("").description("\u672C\u673A\u8BBE\u5907\u5BC6\u94A5\uFF1A\u4E0E\u8BBE\u5907\u6807\u8BC6\u4E00\u8D77\u7ED1\u5B9A\u5F52\u5C5E\uFF1B\u9875\u9762\u4E0D\u663E\u793A").volatile(),
  estimateGroupRatio: z.number().min(0).max(10).default(0.8).description("\u9884\u4F30\u8D39\u7528\u7528\u7684\u5206\u7EC4\u6298\u6263\uFF08\u4E2D\u8F6C\u7AD9 group_ratio\uFF1Avideosvip=0.8\u3001default=1\uFF09").volatile(),
  duration: z.number().step(1).min(4).max(15).default(15).description(
    "\u6BCF\u6BB5\u5EF6\u957F\u51FA\u6765\u7684\u79D2\u6570\u4E0A\u9650\uFF08\u4E0D\u542B\u89C6\u98911\u672C\u8EAB\uFF09\uFF0C4-15 \u7684\u6574\u6570\uFF0C\u9ED8\u8BA4 15\uFF1A\u6309\u4E0A\u9650\u62C6\uFF0C\u6BB5\u6570\u6700\u5C11\uFF0830 \u79D2 \u2192 15+15\uFF0C\u800C\u4E0D\u662F 15+5+5+5\uFF09\uFF1B\u8C03\u5C0F\u5B83\u4F1A\u62C6\u51FA\u66F4\u591A\u6BB5\uFF0825 \u79D2\u3001\u4E0A\u9650 10 \u2192 15+10\uFF0C\u4E0A\u9650 5 \u2192 15+5+5\uFF09\uFF1B\u5982\u679C\u4E0A\u6E38\u5BF9\u5361\u6EE1 15 \u79D2\u7684\u5EF6\u957F\u6BB5\u654F\u611F\uFF0C\u53EF\u4EE5\u8BBE\u6210 14\u3002\u8BBE\u7F6E\u9875\u4E0D\u663E\u793A\u8FD9\u4E00\u9879\uFF1A\u9ED8\u8BA4\u503C 15 \u5C31\u662F\u6BB5\u6570\u6700\u5C11\u7684\u89E3\u6CD5\uFF0C\u8C03\u5C0F\u53EA\u4F1A\u591A\u51FA\u63A5\u7F1D\u3002"
  ).volatile(),
  singleMaxSeconds: z.number().step(1).min(4).max(15).default(15).description(
    "\u5355\u6B21\u76F4\u51FA\u4E0A\u9650\uFF1A\u4E0D\u8D85\u8FC7\u5B83\u5C31\u4E00\u6B21\u751F\u6210\uFF0C\u8D85\u8FC7\u5B83\u5C31\u5148\u76F4\u51FA\u8FD9\u4E00\u6BB5\u518D\u9010\u6BB5\u5EF6\u957F\uFF084-15\uFF09\u3002\u8BBE\u7F6E\u9875\u4E0D\u663E\u793A\u8FD9\u4E00\u9879\uFF1A\u5B83\u5C31\u662F Seedance \u5355\u6BB5 15 \u79D2\u7684\u80FD\u529B\u503C\uFF0C\u8C03\u5C0F\u53EA\u4F1A\u628A\u4E00\u6761\u89C6\u9891\u62C6\u5F97\u66F4\u788E\u3002"
  ).volatile(),
  mergeMode: z.union(["seamless", "copy", "reencode"]).default("seamless").description(
    "\u5408\u5E76\u65B9\u5F0F\uFF1Aseamless=\u628A\u540E\u6BB5\u5BF9\u5230\u524D\u6BB5\u7ED3\u5C3E\u7684\u4EAE\u5EA6/\u97F3\u91CF\uFF0C\u518D\u7528\u77ED\u4EA4\u53C9\u6DE1\u5316\u63A5\u4E0A\uFF08\u9ED8\u8BA4\uFF0C\u63A5\u7F1D\u770B\u4E0D\u51FA\u6362\u6BB5\uFF09\uFF1Bcopy=\u65E0\u635F\u62FC\u63A5\uFF08\u5FEB\uFF0C\u4F46\u63A5\u7F1D\u662F\u786C\u5207\uFF0C\u4E24\u6B21\u751F\u6210\u7684\u8272\u8C03\u4F1A\u5DEE 2-3 \u7EA7\uFF09\uFF1Breencode=\u7EDF\u4E00\u91CD\u7F16\u7801"
  ).volatile(),
  outputDir: z.string().default("").description("\u6210\u7247\u8F93\u51FA\u76EE\u5F55\uFF1B\u7559\u7A7A\u7528\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u7684 metaontic-video/").volatile(),
  keepSegments: z.boolean().default(false).description("\u5408\u5E76\u540E\u662F\u5426\u4FDD\u7559\u5206\u6BB5\u539F\u7247").volatile(),
  ffmpegBinary: z.string().default("ffmpeg").description("ffmpeg \u53EF\u6267\u884C\u6587\u4EF6\uFF1BPATH \u91CC\u6CA1\u6709\u65F6\u586B\u7EDD\u5BF9\u8DEF\u5F84").volatile(),
  ffprobeBinary: z.string().default("ffprobe").description("ffprobe \u53EF\u6267\u884C\u6587\u4EF6\uFF1BPATH \u91CC\u6CA1\u6709\u65F6\u586B\u7EDD\u5BF9\u8DEF\u5F84").volatile(),
  mode: z.union(["continuous", "closeup"]).default("continuous").description("continuous=\u540C\u673A\u4F4D\u8FDE\u7EED\u7EED\u62CD\uFF1Bcloseup=\u5728\u53F0\u8BCD\u7ED3\u675F\u5904\u5207\u8FD1\u666F\u7EED\u62CD").volatile(),
  ratio: z.union(["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"]).default("adaptive").description("\u753B\u9762\u6BD4\u4F8B\uFF1Bseedance 2.5 \u5EF6\u957F\u65F6\u56FA\u5B9A\u6539\u7528 adaptive").volatile(),
  generateAudio: z.boolean().default(true).description("\u662F\u5426\u751F\u6210\u97F3\u9891").volatile(),
  watermark: z.boolean().default(false).description("\u662F\u5426\u6DFB\u52A0\u6C34\u5370\uFF1B\u90E8\u5206\u4E2D\u8F6C\u7AD9\u53EA\u63A5\u53D7 true").volatile(),
  extraParams: z.string().default("").description("JSON \u5BF9\u8C61\u5B57\u7B26\u4E32\uFF0C\u5408\u5E76\u8FDB\u8BF7\u6C42\u4F53\uFF0C\u7528\u4E8E\u4E2D\u8F6C\u7AD9\u7684\u7279\u6709\u5B57\u6BB5").volatile(),
  pollIntervalMs: z.natural().min(1e3).default(5e3).description("\u8F6E\u8BE2\u4EFB\u52A1\u72B6\u6001\u7684\u95F4\u9694\uFF08\u6BEB\u79D2\uFF09").volatile(),
  maxWaitMs: z.natural().min(1e3).default(6e5).description("\u5355\u6B21\u8C03\u7528\u6700\u957F\u7B49\u5F85\u65F6\u95F4\uFF08\u6BEB\u79D2\uFF09").volatile()
});
const DEFAULT_MODEL = "doubao-seedance-2-0-mini-260615";
const MAX_SEGMENTS = 10;
const MIN_SECONDS = 4;
const MIN_SEGMENT_SECONDS = 4;
const MAX_SEGMENT_SECONDS = 15;
const MAX_DIRECT_SECONDS = 15;
const FIXED_RESOLUTION = "720p";
const DEFAULT_OUTPUT_DIR = "metaontic-video";
const CUMULATIVE_TOLERANCE_RATIO = 0.25;
const CUMULATIVE_TOLERANCE_MIN_SECONDS = 1.5;
const DEFAULT_REGISTER_API = "https://video.mybfs.cn";
const DEFAULT_REGISTER_TOKEN = "metaontic-video-register-v1";
const KEY_ORIGIN_REGISTER = "register";
const DEFAULT_QUOTA_PER_UNIT = 5e5;
const DEFAULT_USD_EXCHANGE_RATE = 7.3;
const GATED_TOOLS = ["video_generate", "video_extend", "video_setup"];
const ESTIMATE_PIXELS = { "480p": [854, 480], "720p": [1280, 720], "1080p": [1920, 1080] };
const ESTIMATE_FPS = 24;
const ESTIMATE_TOKEN_DIVISOR = 1024;
const ESTIMATE_RATES = [
  ["doubao-seedance-2-0-mini", { none: 3.150684931507, video: 1.917808219178 }],
  ["doubao-seedance-2-0-fast", { none: 5.068493150685, video: 3.013698630137 }]
];
const RELAY_PRESET = {
  baseUrl: "",
  submitPath: "/doubao/api/v3/contents/generations/tasks",
  queryPath: "/doubao/api/v3/contents/generations/tasks/{task_id}",
  model: DEFAULT_MODEL,
  baseEnv: ["NEWAPI_VIDEO_BASE_URL", "NEWAPI_BASE_URL"],
  modelEnv: ["NEWAPI_VIDEO_MODEL"]
};
const SUCCESS_STATES = /* @__PURE__ */ new Set(["succeeded", "success", "completed", "complete", "done", "finished"]);
const FAILED_STATES = /* @__PURE__ */ new Set(["failed", "failure", "error", "cancelled", "canceled"]);
const CANCEL_STATES = /* @__PURE__ */ new Set(["cancelled", "canceled"]);
const QUOTA_HINTS = ["quota", "insufficient", "balance", "\u9884\u6263\u8D39", "\u5269\u4F59\u989D\u5EA6"];
const PRICE_HINTS = ["model_price_error", "\u9636\u68AF\u8BA1\u4EF7", 'u("input_images")'];
const CONTENT_HINTS = [
  "real person",
  "privacyinformation",
  "privacy information",
  "content policy",
  "content_policy",
  "contentpolicy",
  "content safety",
  "safety policy",
  "sensitive",
  "\u8FDD\u89C4",
  "\u654F\u611F",
  "\u6D89\u653F"
];
const VIDEO_URL_KEYS = [
  "video_url",
  "videourl",
  "download_url",
  "play_url",
  "result_url",
  "output_url"
];
const GENERIC_URL_KEYS = /* @__PURE__ */ new Set(["url", "output", "video", "file"]);
const IMAGE_KEY_TOKENS = ["cover", "image", "thumb", "poster", "frame", "snapshot", "preview"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"];
const CONTINUOUS_TRANSITION = "\u672C\u6BB5\u7B2C\u4E00\u5E27\u5FC5\u987B\u7D27\u63A5\u89C6\u98911\u6700\u540E\u4E00\u5E27\uFF0C\u4FDD\u6301\u540C\u4E00\u6784\u56FE\u3001\u4EBA\u7269\u5927\u5C0F\u3001\u5DE6\u53F3\u4F4D\u7F6E\u3001\u5934\u90E8\u671D\u5411\u3001\u89C6\u7EBF\u3001\u624B\u90E8\u4F4D\u7F6E\u548C\u52A8\u4F5C\u9636\u6BB5\u3002\u52A8\u4F5C\u4FDD\u6301\u539F\u6709\u65B9\u5411\u548C\u901F\u5EA6\uFF0C\u4E0D\u91CD\u590D\u524D\u6BB5\u52A8\u4F5C\u3001\u4E0D\u5B9A\u683C\u7B49\u5F85\u3001\u4E0D\u4ECE\u753B\u9762\u53E6\u4E00\u4FA7\u91CD\u65B0\u5165\u573A\uFF1B\u4E0D\u64C5\u81EA\u5207\u955C\u6216\u91CD\u65B0\u5C45\u4E2D\u3002";
const FORWARD_TRANSITION = "\u5411\u524D\u5EF6\u957F\u65F6\uFF0C\u672C\u6BB5\u6700\u540E\u4E00\u5E27\u5FC5\u987B\u7D27\u63A5\u89C6\u98911\u7B2C\u4E00\u5E27\uFF0C\u4FDD\u6301\u540C\u4E00\u6784\u56FE\u3001\u4EBA\u7269\u5927\u5C0F\u3001\u5DE6\u53F3\u4F4D\u7F6E\u3001\u5934\u90E8\u671D\u5411\u3001\u89C6\u7EBF\u3001\u624B\u90E8\u4F4D\u7F6E\u548C\u52A8\u4F5C\u9636\u6BB5\u3002\u52A8\u4F5C\u671D\u5411\u89C6\u98911\u7684\u5F00\u573A\u52A8\u4F5C\u53D1\u5C55\uFF0C\u4E0D\u91CD\u590D\u524D\u6BB5\u52A8\u4F5C\u3001\u4E0D\u5B9A\u683C\u7B49\u5F85\u3001\u4E0D\u4ECE\u753B\u9762\u53E6\u4E00\u4FA7\u91CD\u65B0\u5165\u573A\uFF1B\u4E0D\u64C5\u81EA\u5207\u955C\u6216\u91CD\u65B0\u5C45\u4E2D\u3002";
const CLOSEUP_TRANSITION = "\u955C\u5934\u8854\u63A5\u5EFA\u8BAE\uFF08\u4EC5\u5728\u672C\u6BB5\u672A\u660E\u786E\u6307\u5B9A\u8FD0\u955C\u6216\u5207\u955C\u5B89\u6392\u65F6\u91C7\u7528\uFF09\uFF1A\u5728\u5B8C\u6574\u53F0\u8BCD\u7ED3\u675F\u5904\u81EA\u7136\u5207\u5230\u4E0B\u4E00\u4F4D\u8BF4\u8BDD\u4EBA\u7684\u8FD1\u666F\u6216\u542C\u8BDD\u4EBA\u7684\u53CD\u5E94\u8FD1\u666F\uFF0C\u518D\u7EE7\u7EED\u672C\u6BB5\u5267\u60C5\u3002\u4FDD\u6301\u8F74\u7EBF\u3001\u89C6\u7EBF\u65B9\u5411\u3001\u5DE6\u53F3\u4EBA\u7269\u5173\u7CFB\u3001\u670D\u88C5\u548C\u97F3\u8272\uFF0C\u4E0D\u4EA4\u6362\u89D2\u8272\uFF1B\u53EA\u6539\u53D8\u666F\u522B\uFF0C\u4E0D\u65B0\u589E\u573A\u666F\u3002";
const CONTENT_REJECTION_HINT = "\u53C2\u8003\u89C6\u9891\u88AB\u4E0A\u6E38\u5185\u5BB9\u5BA1\u6838\u62D2\u7EDD\uFF0C\u5EF6\u957F\u5DF2\u505C\u6B62\u3002Seedance \u542B\u4EBA\u8138\u7EED\u62CD\u9700\u4F7F\u7528\u540C\u4E00\u4E0A\u6E38\u8D26\u53F7\u7684\u53D7\u4FE1\u539F\u59CB\u89C6\u9891\u6216\u6388\u6743\u7D20\u6750\uFF1B\u8BF7\u786E\u8BA4\u4E2D\u8F6C\u7AD9\u900F\u4F20\u4E86\u539F\u59CB video_url \u4E0E reference_video\uFF0C\u4E14\u524D\u540E\u8BF7\u6C42\u4F7F\u7528\u540C\u4E00\u4E0A\u6E38\u8D26\u53F7\u3002\u4E0D\u4F1A\u81EA\u52A8\u53BB\u6389\u53C2\u8003\u89C6\u9891\u751F\u6210\uFF0C\u4EE5\u514D\u4EBA\u7269\u4E0D\u4E00\u81F4\u3002";
function ref(config, key, fallback) {
  const raw = config?.[key];
  const value = raw && typeof raw.get === "function" ? raw.get() : raw;
  return value === void 0 || value === null || value === "" ? fallback : value;
}
function relayPreset() {
  return RELAY_PRESET;
}
function envValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
function resolveApiKey(config) {
  return String(ref(config, "apiKey", "")).trim();
}
function isServerIssuedKey(config) {
  if (String(ref(config, "keyOrigin", "")).trim() === KEY_ORIGIN_REGISTER) return true;
  return Boolean(String(ref(config, "deviceId", "")).trim()) && Boolean(String(ref(config, "deviceSecret", "")).trim()) && Boolean(String(ref(config, "registerEmail", "")).trim());
}
function resolveBaseUrl(config) {
  const preset = relayPreset();
  return (String(ref(config, "baseUrl", "")).trim() || envValue(preset.baseEnv) || preset.baseUrl).replace(/\/+$/, "");
}
function resolveSubmitPath(config) {
  return String(ref(config, "submitPath", "")).trim() || relayPreset().submitPath;
}
function resolveQueryPath(config, taskId) {
  const path2 = String(ref(config, "queryPath", "")).trim() || relayPreset().queryPath;
  return path2.replace("{task_id}", encodeURIComponent(taskId));
}
function resolveModel(config) {
  const preset = relayPreset();
  return String(ref(config, "model", "")).trim() || envValue(preset.modelEnv) || preset.model;
}
function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}
function isOmniExtendModel(model) {
  const lowered = String(model).toLowerCase();
  return lowered.includes("seedance-2-5") || lowered.includes("seedance-2.5");
}
function parseExtraParams(config) {
  const raw = String(ref(config, "extraParams", "")).trim();
  if (!raw) return {};
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("\u914D\u7F6E extraParams \u4E0D\u662F\u5408\u6CD5 JSON \u5BF9\u8C61\u5B57\u7B26\u4E32\u3002");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("\u914D\u7F6E extraParams \u5FC5\u987B\u662F JSON \u5BF9\u8C61\u3002");
  }
  return value;
}
function assertConfigured(config, apiKey) {
  if (!apiKey) {
    throw new Error(
      "\u672A\u914D\u7F6E API Key\uFF1A\u6253\u5F00\u300C\u63D2\u4EF6 \u2192 \u5DF2\u5B89\u88C5\u63D2\u4EF6 \u2192 MetaOnticVideo \u2192 \u67E5\u770B\u300D\uFF0C\u70B9\u300C\u767B\u5F55\u300D\u9886\u4E00\u628A\u2014\u2014\u670D\u52A1\u7AEF\u4F1A\u628A Key\u3001\u4E0A\u6E38\u5730\u5740\u548C\u6A21\u578B\u76F4\u63A5\u5199\u8FDB\u914D\u7F6E\uFF0C\u4E0D\u7528\u624B\u586B\u3002"
    );
  }
  if (!isServerIssuedKey(config)) {
    throw new Error(
      "\u5F53\u524D apiKey \u4E0D\u662F\u670D\u52A1\u7AEF\u4E0B\u53D1\u7684\uFF0C\u63D2\u4EF6\u62D2\u7EDD\u8C03\u7528\uFF1A\u5BC6\u94A5\u53EA\u80FD\u5728\u63D2\u4EF6\u8BE6\u60C5\u9875\u70B9\u300C\u767B\u5F55\u300D\u7531\u670D\u52A1\u7AEF\u4E0B\u53D1\u3002\u540C\u4E00\u4E2A\u90AE\u7BB1\u518D\u767B\u5F55\u4E00\u6B21\u4F1A\u628A\u539F\u6765\u90A3\u628A\u8FD8\u7ED9\u4F60\uFF0C\u4E0D\u4F1A\u591A\u5F00\u4E00\u628A\u3002"
    );
  }
  if (!resolveBaseUrl(config)) {
    throw new Error(
      "\u672A\u914D\u7F6E baseUrl\uFF1A\u6B63\u5E38\u7531\u300C\u767B\u5F55\u300D\u65F6\u670D\u52A1\u7AEF\u4E0B\u53D1\u4E2D\u8F6C\u7AD9\u5730\u5740\uFF1B\u7F3A\u5931\u65F6\u8BF7\u91CD\u65B0\u767B\u5F55\uFF0C\u6216\u68C0\u67E5\u8BBE\u7F6E\u9875\u91CC\u7684\u4E0A\u6E38\u5730\u5740\u3002"
    );
  }
}
function buildExtensionPrompt({
  prompt,
  seconds,
  startAt,
  mode,
  direction = "backward",
  wording = "extend"
}) {
  const forward = direction === "forward";
  const head = forward ? "\u5411\u524D\u5EF6\u957F\u89C6\u98911\u3002" : wording === "after" ? "\u751F\u6210\u89C6\u98911\u4E4B\u540E\u7684\u5185\u5BB9\uFF1A" : "\u5411\u540E\u5EF6\u957F\u89C6\u98911\u3002";
  const span = forward ? startAt == null ? `\u751F\u6210 ${seconds} \u79D2\u524D\u7F6E\u753B\u9762\uFF0C\u63A5\u5728\u89C6\u98911\u7B2C\u4E00\u5E27\u4E4B\u524D\u3002` : `\u751F\u6210 ${seconds} \u79D2\u524D\u7F6E\u753B\u9762\uFF0C\u5BF9\u5E94\u6574\u7247\u7B2C ${Math.max(0, startAt - seconds)}\u2013${startAt} \u79D2\uFF0C\u7D27\u63A5\u5728\u89C6\u98911\u4E4B\u524D\u3002` : startAt == null ? `\u751F\u6210 ${seconds} \u79D2\u7EED\u62CD\u753B\u9762\uFF0C\u63A5\u5728\u89C6\u98911\u6700\u540E\u4E00\u5E27\u4E4B\u540E\u3002` : `\u751F\u6210 ${seconds} \u79D2\u7EED\u62CD\u753B\u9762\uFF0C\u5BF9\u5E94\u6574\u7247\u7B2C ${startAt}\u2013${startAt + seconds} \u79D2\uFF0C\u63A5\u5728\u89C6\u98911\u4E4B\u540E\u3002`;
  const transition = forward ? FORWARD_TRANSITION : mode === "closeup" ? CLOSEUP_TRANSITION : CONTINUOUS_TRANSITION;
  return [
    `${head}${span}`,
    `\u3010\u5EF6\u957F\u65B9\u5411\u3011${forward ? "\u5411\u524D\u5EF6\u957F\uFF08\u524D\u7F6E\u5267\u60C5\uFF0C\u653E\u5728\u89C6\u98911\u4E4B\u524D\uFF09" : "\u5411\u540E\u5EF6\u957F\uFF08\u7EED\u62CD\u5267\u60C5\uFF0C\u63A5\u5728\u89C6\u98911\u4E4B\u540E\uFF09"}\u3002`,
    `\u3010\u5267\u60C5\u53D1\u5C55\u3011${endWithPunctuation(prompt)}${forward ? "\u53EA\u6F14\u89C6\u98911\u4E4B\u524D\u53D1\u751F\u7684\u524D\u7F6E\u5267\u60C5\uFF0C\u4E0D\u590D\u8FF0\u89C6\u98911\u91CC\u7684\u60C5\u8282\u3002" : "\u53EA\u6F14\u89C6\u98911\u4E4B\u540E\u53D1\u751F\u7684\u65B0\u5267\u60C5\uFF0C\u4E0D\u91CD\u590D\u89C6\u98911\u91CC\u7684\u60C5\u8282\u3001\u4E0D\u91CD\u65B0\u5F00\u573A\u3002"}`,
    "\u3010\u4E3B\u4F53\u72B6\u6001\u3011" + (forward ? "\u672C\u6BB5\u6536\u5C3E\u7684\u4EBA\u7269\u9762\u8C8C\u3001\u4F53\u578B\u3001\u670D\u88C5\u3001\u59FF\u6001\u3001\u624B\u90E8\u4F4D\u7F6E\u548C\u52A8\u4F5C\u9636\u6BB5\u5FC5\u987B\u80FD\u76F4\u63A5\u63A5\u5230\u89C6\u98911\u7B2C\u4E00\u5E27\uFF1B" : "\u6CBF\u7528\u89C6\u98911\u7ED3\u5C3E\u7684\u4EBA\u7269\u9762\u8C8C\u3001\u4F53\u578B\u3001\u670D\u88C5\u3001\u59FF\u6001\u3001\u624B\u90E8\u4F4D\u7F6E\u548C\u52A8\u4F5C\u9636\u6BB5\uFF1B") + "\u540C\u4E00\u89D2\u8272\u4FDD\u6301\u97F3\u8272\u3001\u53E3\u97F3\u3001\u8BED\u901F\u548C\u5F53\u524D\u60C5\u7EEA\uFF0C\u4E0D\u6362\u4EBA\u3001\u4E0D\u6362\u88C5\uFF0C\u4E0D\u6539\u53D8\u5E74\u9F84\u4E0E\u5916\u8C8C\u7279\u5F81\u3002",
    "\u3010\u955C\u5934\u8FD0\u52A8\u3011\u4FDD\u6301\u89C6\u98911" + (forward ? "\u5F00\u5934\u7684" : "\u7ED3\u5C3E\u7684") + "\u673A\u4F4D\u3001\u666F\u522B\u3001\u7126\u6BB5\u3001\u8FD0\u955C\u65B9\u5411\u4E0E\u901F\u5EA6\uFF0C\u9501\u5B9A\u66DD\u5149\u3001\u767D\u5E73\u8861\u3001\u5149\u6E90\u65B9\u5411\u548C\u80CC\u666F\u5E03\u5C40\uFF0C\u4E0D\u6E10\u6697\u6E10\u4EAE\u3001\u4E0D\u6539\u53D8\u666F\u6DF1\u3001\u4E0D\u91CD\u5EFA\u80CC\u666F\uFF1B\u6574\u6BB5\u4EAE\u5EA6\u4E0E\u8272\u8C03\u5FC5\u987B\u4E0E\u89C6\u98911" + (forward ? "\u5F00\u5934" : "\u7ED3\u5C3E") + "\u4E00\u81F4\uFF0C\u4E0D\u8981\u6574\u4F53\u538B\u6697\u6216\u504F\u8272\u3002",
    "\u3010\u58F0\u97F3\u5EF6\u7EED\u3011\u4FDD\u6301\u5BF9\u767D\u3001\u73AF\u5883\u58F0\u4E0E\u80CC\u666F\u97F3\u4E50\u8FDE\u7EED\uFF0C\u6BCF\u53E5\u53F0\u8BCD\u5B8C\u6574\u8BF4\u5B8C\uFF0C\u4E0D\u6DFB\u52A0\u7247\u5934\u7247\u5C3E\u3001\u4E0D\u590D\u8FF0\u5DF2\u8BF4\u53F0\u8BCD\u3002",
    transition,
    "\u672C\u6BB5\u660E\u786E\u6307\u5B9A\u7684\u8FD0\u955C\u548C\u5207\u955C\u4F18\u5148\uFF0C\u4E0A\u9762\u7684\u8854\u63A5\u5EFA\u8BAE\u4E0D\u5F97\u8986\u76D6\u5DF2\u786E\u8BA4\u7684\u955C\u5934\u5B89\u6392\u3002"
  ].join("\n");
}
function normalizeReferenceUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) throw new Error("\u53C2\u8003\u89C6\u9891 URL \u4E0D\u80FD\u4E3A\u7A7A\u3002");
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("\u53C2\u8003\u89C6\u9891\u5FC5\u987B\u662F https:// \u6216 http:// \u5F00\u5934\u7684\u516C\u7F51 URL\uFF08\u4E0D\u80FD\u7528\u672C\u5730\u6587\u4EF6\u8DEF\u5F84\uFF09\u3002");
  }
  return url;
}
function buildRequestBody(config, args, referenceVideoUrl) {
  const model = resolveModel(config);
  const seconds = clampInteger(
    args.duration,
    MIN_SEGMENT_SECONDS,
    MAX_SEGMENT_SECONDS,
    ref(config, "duration", 5)
  );
  const mode = args.mode || ref(config, "mode", "continuous");
  const prompt = String(args.prompt ?? "").trim();
  const startAt = args.startAt == null ? null : Math.max(0, Math.round(Number(args.startAt)));
  const direction = args.direction === "forward" ? "forward" : "backward";
  const wording = args.wording === "after" ? "after" : "extend";
  const content = [
    { type: "text", text: buildExtensionPrompt({ prompt, seconds, startAt, mode, direction, wording }) },
    { type: "video_url", video_url: { url: referenceVideoUrl }, role: "reference_video" }
  ];
  const body = { ...parseExtraParams(config) };
  body.model = model;
  body.content = content;
  body.duration = seconds;
  body.ratio = args.ratio || ref(config, "ratio", "adaptive");
  body.resolution = FIXED_RESOLUTION;
  const generateAudio = args.generateAudio ?? ref(config, "generateAudio", true);
  if (typeof generateAudio === "boolean") body.generate_audio = generateAudio;
  const watermark = args.watermark ?? ref(config, "watermark", false);
  if (typeof watermark === "boolean") body.watermark = watermark;
  if (args.user) body.safety_identifier = String(args.user);
  if (typeof args.returnLastFrame === "boolean") body.return_last_frame = args.returnLastFrame;
  if (args.seed != null && Number.isFinite(Number(args.seed))) body.seed = Number(args.seed);
  if (isOmniExtendModel(model)) {
    body.ratio = "adaptive";
    body.omni_reference_task_type = "extend";
  }
  return { body, seconds };
}
function resolveSingleMax(config) {
  return clampInteger(
    ref(config, "singleMaxSeconds", MAX_DIRECT_SECONDS),
    MIN_SECONDS,
    MAX_DIRECT_SECONDS,
    MAX_DIRECT_SECONDS
  );
}
function resolveSegmentSeconds(config, requested = void 0) {
  const fallback = ref(config, "duration", 5);
  return clampInteger(requested ?? fallback, MIN_SEGMENT_SECONDS, MAX_SEGMENT_SECONDS, fallback);
}
function planVideoSegments(totalSeconds, singleMax, segmentSeconds) {
  if (totalSeconds <= singleMax) return [{ kind: "generate", seconds: totalSeconds }];
  let base = singleMax;
  let remaining = totalSeconds - base;
  if (remaining < MIN_SEGMENT_SECONDS) {
    const trimmed = MIN_SEGMENT_SECONDS - remaining;
    if (base - trimmed >= MIN_SEGMENT_SECONDS) {
      base -= trimmed;
      remaining = totalSeconds - base;
    }
  }
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
  const plan = [{ kind: "generate", seconds: base }];
  for (const seconds of sizes) {
    if (plan.length >= MAX_SEGMENTS) break;
    plan.push({ kind: "extend", seconds });
  }
  return plan;
}
function buildGenerationPrompt({ prompt, seconds }) {
  return `\u751F\u6210 ${seconds} \u79D2\u89C6\u9891\u3002${prompt}\u4FDD\u6301\u4EBA\u7269\u9762\u8C8C\u3001\u4F53\u578B\u3001\u670D\u88C5\u548C\u97F3\u8272\u4E00\u81F4\uFF0C\u573A\u666F\u5149\u7EBF\u3001\u8272\u8C03\u4E0E\u955C\u5934\u8FD0\u52A8\u8FDE\u8D2F\uFF1B\u6BCF\u53E5\u53F0\u8BCD\u5B8C\u6574\u8BF4\u5B8C\uFF0C\u73AF\u5883\u58F0\u4E0E\u80CC\u666F\u97F3\u4E50\u8FDE\u7EED\uFF1B\u4E0D\u8981\u7247\u5934\u7247\u5C3E\u3001\u4E0D\u8981\u5B57\u5E55\u3001\u4E0D\u8981\u6C34\u5370\uFF0C\u4E0D\u4ECE\u753B\u9762\u5916\u4FA7\u91CD\u65B0\u5165\u573A\u3002`;
}
function endWithPunctuation(text) {
  const value = String(text ?? "").trim();
  if (!value) return "";
  return /[。．.!！?？;；~～:：,，]$/.test(value) ? value : `${value}\u3002`;
}
function normalizeImageUrl(value, label) {
  const url = String(value ?? "").trim();
  if (!url) throw new Error(`${label} \u4E0D\u80FD\u4E3A\u7A7A\u3002`);
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`${label} \u5FC5\u987B\u662F https:// \u6216 http:// \u5F00\u5934\u7684\u516C\u7F51 URL\uFF08\u4E0D\u80FD\u7528\u672C\u5730\u6587\u4EF6\u8DEF\u5F84\uFF09\u3002`);
  }
  return url;
}
function buildGenerationBody(config, args, seconds) {
  const prompt = String(args.prompt ?? "").trim();
  const content = [
    { type: "text", text: buildGenerationPrompt({ prompt, seconds }) }
  ];
  const firstFrame = String(args.firstFrameUrl ?? "").trim();
  if (firstFrame) {
    content.push({
      type: "image_url",
      image_url: { url: normalizeImageUrl(firstFrame, "\u9996\u5E27\u56FE URL") },
      role: "first_frame"
    });
  }
  const lastFrame = String(args.lastFrameUrl ?? "").trim();
  if (lastFrame) {
    content.push({
      type: "image_url",
      image_url: { url: normalizeImageUrl(lastFrame, "\u5C3E\u5E27\u56FE URL") },
      role: "last_frame"
    });
  }
  const body = { ...parseExtraParams(config) };
  body.model = resolveModel(config);
  body.content = content;
  body.duration = seconds;
  body.ratio = args.ratio || ref(config, "ratio", "adaptive");
  body.resolution = FIXED_RESOLUTION;
  const generateAudio = args.generateAudio ?? ref(config, "generateAudio", true);
  if (typeof generateAudio === "boolean") body.generate_audio = generateAudio;
  const watermark = args.watermark ?? ref(config, "watermark", false);
  if (typeof watermark === "boolean") body.watermark = watermark;
  if (args.user) body.safety_identifier = String(args.user);
  if (typeof args.returnLastFrame === "boolean") body.return_last_frame = args.returnLastFrame;
  if (args.seed != null && Number.isFinite(Number(args.seed))) body.seed = Number(args.seed);
  return { body, seconds };
}
async function runTask(config, body, signal) {
  const created = await createTask(config, body);
  const taskId = extractTaskId(created);
  if (!taskId) throw new Error("\u521B\u5EFA\u4EFB\u52A1\u5931\u8D25\uFF1A\u54CD\u5E94\u4E2D\u7F3A\u5C11\u4EFB\u52A1 ID\u3002");
  try {
    const final = await waitForCompletion(config, taskId, signal);
    return { ...final, taskId };
  } catch (failure) {
    if (failure?.code === "ABORTED") throw failure;
    if (failure?.code && failure.code !== "provider_failed") {
      return { taskId, status: "failed", error: failure.message, errorCode: failure.code };
    }
    return { taskId, status: "failed", error: failure?.message || String(failure) };
  }
}
function resolveBinary(config, key, fallback) {
  return String(ref(config, key, "")).trim() || fallback;
}
function tail(text, limit = 600) {
  const clean = String(text || "").trim();
  return clean.length > limit ? `\u2026${clean.slice(-limit)}` : clean;
}
function formatSeconds(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "");
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}
function fileStamp(date = /* @__PURE__ */ new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
function toJsonSafe(value, seen = /* @__PURE__ */ new Set()) {
  if (value === null) return null;
  const type = typeof value;
  if (type === "string" || type === "boolean") return value;
  if (type === "number") {
    return Number.isFinite(value) && !Object.is(value, -0) ? value : String(value);
  }
  if (type === "bigint") return value.toString();
  if (type === "undefined" || type === "function" || type === "symbol") return void 0;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return value.message ? `${value.name}: ${value.message}` : value.name;
  if (seen.has(value)) return "[circular]";
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
      if (safe !== void 0) plain[key] = safe;
    }
    return plain;
  } finally {
    seen.delete(value);
  }
}
function jsonSafeTool(tool) {
  return {
    ...tool,
    async execute(...args) {
      return toJsonSafe(await tool.execute(...args));
    }
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
async function runProcess(binary, args, { signal, timeoutMs = 18e5, shell = false } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"], ...shell ? { shell: true } : {} });
    } catch (error) {
      reject(Object.assign(new Error(`${binary} \u65E0\u6CD5\u542F\u52A8\uFF1A${error?.message || error}`), {
        code: "ffmpeg_missing"
      }));
      return;
    }
    let stdout = "";
    let stderr = "";
    let done = false;
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    function settle(error = null, value = void 0) {
      if (done) return;
      done = true;
      cleanup();
      if (error) reject(error);
      else resolve(value);
    }
    function onAbort() {
      child.kill("SIGKILL");
      settle(abortError());
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(Object.assign(new Error(`${binary} \u6267\u884C\u8D85\u65F6\u3002`), { code: "ffmpeg_timeout" }));
    }, timeoutMs);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", (error) => settle(Object.assign(
      new Error(`${binary} \u65E0\u6CD5\u542F\u52A8\uFF1A${error.message}`),
      { code: error.code === "ENOENT" ? "ffmpeg_missing" : "ffmpeg_failed" }
    )));
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => settle(null, { code, stdout, stderr }));
  });
}
async function hasFfmpeg(config, signal) {
  const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
  try {
    const { code } = await runProcess(binary, ["-version"], { signal, timeoutMs: 2e4 });
    return code === 0;
  } catch {
    return false;
  }
}
function currentPlatform() {
  try {
    return typeof process !== "undefined" && process.platform || "linux";
  } catch {
    return "linux";
  }
}
const HOMEBREW_BOOTSTRAP = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
function ffmpegInstallOptions(platform = currentPlatform()) {
  if (platform === "darwin") {
    return {
      os: "macOS",
      installs: [
        { label: "macOS\uFF08Homebrew\uFF09", command: "brew install ffmpeg" },
        {
          label: "macOS\uFF08\u8FD8\u6CA1\u88C5 Homebrew \u5C31\u5148\u88C5\u5B83\uFF09",
          command: HOMEBREW_BOOTSTRAP
        }
      ],
      // 连包管理器都没有时的前置步骤（macOS 才有）
      bootstrap: { label: "macOS\uFF08\u5148\u88C5 Homebrew\uFF09", command: HOMEBREW_BOOTSTRAP }
    };
  }
  if (platform === "win32") {
    return {
      os: "Windows",
      installs: [
        { label: "Windows\uFF08winget\uFF09", command: "winget install --id Gyan.FFmpeg -e" },
        { label: "Windows\uFF08Chocolatey\uFF09", command: "choco install ffmpeg" }
      ],
      bootstrap: null
    };
  }
  return {
    os: "Linux",
    installs: [
      {
        label: "Linux\uFF08Debian / Ubuntu\uFF09",
        command: "sudo apt update && sudo apt install -y ffmpeg"
      },
      { label: "Linux\uFF08Fedora / RHEL / CentOS\uFF09", command: "sudo dnf install -y ffmpeg" }
    ],
    bootstrap: null
  };
}
function commonFfmpegPaths(platform = currentPlatform()) {
  if (platform === "darwin") return ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"];
  if (platform === "win32") return [];
  return ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/snap/bin/ffmpeg"];
}
async function probeBinaryVersion(binary, signal) {
  try {
    const { code, stdout, stderr } = await runProcess(binary, ["-version"], { signal, timeoutMs: 2e4 });
    if (code !== 0) return null;
    const line = String(stdout || stderr).split("\n").map((item) => item.trim()).filter(Boolean)[0];
    return line || "ok";
  } catch {
    return null;
  }
}
async function findInstalledFfmpeg(signal) {
  for (const candidate of commonFfmpegPaths()) {
    if (await probeBinaryVersion(candidate, signal)) return candidate;
  }
  return null;
}
function ffmpegInstallHint(config) {
  const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
  const { os, installs } = ffmpegInstallOptions();
  const lines = [
    `\u672C\u673A\u6CA1\u6709\u627E\u5230\u53EF\u7528\u7684 ffmpeg\uFF08${binary}\uFF09\uFF0C\u6240\u4EE5\u300C\u628A\u591A\u6BB5\u5408\u5E76\u6210\u4E00\u6761\u300D\u8FD9\u6B65\u6682\u65F6\u6CA1\u505A\uFF0C\u5206\u6BB5\u6587\u4EF6\u90FD\u5728\uFF0C\u4E00\u6761\u90FD\u4E0D\u5C11\u3002`,
    `\u88C5\u4E00\u4E0B ffmpeg \u5C31\u80FD\u5408\u5E76\uFF08\u4F60\u5F53\u524D\u662F ${os}\uFF09\uFF1A`,
    ...installs.map((item) => `  \xB7 ${item.label}\uFF1A${item.command}`),
    "\u88C5\u597D\u540E\u91CD\u8DD1\u8FD9\u6B21\u751F\u6210\uFF0C\u5206\u6BB5\u4F1A\u81EA\u52A8\u5408\u5E76\u6210\u4E00\u6761\uFF0C\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF1B\u5982\u679C ffmpeg \u5DF2\u7ECF\u88C5\u4E86\u4F46\u4E0D\u5728\u9ED8\u8BA4\u4F4D\u7F6E\uFF0C\u628A\u5B83\u7684\u7EDD\u5BF9\u8DEF\u5F84\u586B\u5230\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u4E5F\u4E00\u6837\u7BA1\u7528\u3002",
    "ffmpeg \u7684\u5B89\u88C5\u5305\u91CC\u81EA\u5E26 ffprobe\uFF0C\u88C5\u5B8C\u5206\u6BB5\u63A2\u6D4B\u4E5F\u4E00\u8D77\u597D\u4E86\u3002",
    "\u60F3\u8BA9\u6211\u6765\u88C5\u5C31\u8BF4\u4E00\u58F0 \u2014\u2014 \u6211\u4F1A\u7528 video_setup \u6267\u884C\u5B89\u88C5\uFF08\u6267\u884C\u524D\u5BBF\u4E3B\u4F1A\u5148\u8BA9\u4F60\u786E\u8BA4\u547D\u4EE4\uFF09\u3002"
  ];
  return { binary, os, installs, hint: lines.join("\n") };
}
async function probeMedia(file, config, signal) {
  try {
    const { code, stdout } = await runProcess(resolveBinary(config, "ffprobeBinary", "ffprobe"), [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height,r_frame_rate,duration",
      "-of",
      "json",
      file
    ], { signal, timeoutMs: 6e4 });
    if (code !== 0) return null;
    const parsed = JSON.parse(stdout);
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
    const video = streams.find((stream) => stream.codec_type === "video") || {};
    const audio = streams.find((stream) => stream.codec_type === "audio") || {};
    const [num, den] = String(video.r_frame_rate || "").split("/").map(Number);
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
      hasAudio: streams.some((stream) => stream.codec_type === "audio")
    };
  } catch {
    return null;
  }
}
async function downloadFile(url, destPath, { signal } = {}) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw Object.assign(new Error(`\u4E0B\u8F7D\u5206\u6BB5\u5931\u8D25\uFF08HTTP ${response.status}\uFF09\uFF1A${url}`), {
      code: "download_failed"
    });
  }
  if (!response.body) {
    throw Object.assign(new Error(`\u4E0B\u8F7D\u5206\u6BB5\u5931\u8D25\uFF1A\u54CD\u5E94\u6CA1\u6709\u5185\u5BB9\uFF08${url}\uFF09\u3002`), {
      code: "download_failed"
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
const AUDIO_PADDING_TOLERANCE_FRAMES = 1;
const SEAM_FADE_SECONDS = 0.25;
const SEAM_WINDOW_SECONDS = 0.5;
const SEAM_MAX_LUMA_SHIFT = 12;
const SEAM_MAX_AUDIO_GAIN_DB = 4;
async function measureAverageLuma(file, atSeconds, windowSeconds, config, signal) {
  try {
    const { code, stderr } = await runProcess(resolveBinary(config, "ffmpegBinary", "ffmpeg"), [
      "-hide_banner",
      "-nostats",
      "-ss",
      Math.max(0, atSeconds).toFixed(3),
      "-t",
      Math.max(0.05, windowSeconds).toFixed(3),
      "-i",
      file,
      "-vf",
      "signalstats,metadata=print:key=lavfi.signalstats.YAVG",
      "-f",
      "null",
      "-"
    ], { signal, timeoutMs: 12e4 });
    if (code !== 0) return null;
    const values = [...String(stderr).matchAll(/lavfi\.signalstats\.YAVG=(-?[\d.]+)/g)].map((match) => Number(match[1])).filter((value) => Number.isFinite(value));
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  } catch {
    return null;
  }
}
async function measureLoudness(file, atSeconds, windowSeconds, config, signal) {
  try {
    const { code, stderr } = await runProcess(resolveBinary(config, "ffmpegBinary", "ffmpeg"), [
      "-hide_banner",
      "-nostats",
      "-ss",
      Math.max(0, atSeconds).toFixed(3),
      "-t",
      Math.max(0.05, windowSeconds).toFixed(3),
      "-i",
      file,
      "-af",
      "volumedetect",
      "-f",
      "null",
      "-"
    ], { signal, timeoutMs: 12e4 });
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
        clampNumber(prevLuma - nextLuma, -SEAM_MAX_LUMA_SHIFT, SEAM_MAX_LUMA_SHIFT).toFixed(2)
      );
    }
    const prevLoud = await measureLoudness(files[index - 1], prevAt, window, config, signal);
    const nextLoud = await measureLoudness(files[index], 0, window, config, signal);
    if (prevLoud != null && nextLoud != null) {
      seam.audioGainDb = Number(
        clampNumber(prevLoud - nextLoud, -SEAM_MAX_AUDIO_GAIN_DB, SEAM_MAX_AUDIO_GAIN_DB).toFixed(2)
      );
    }
    seams.push(seam);
  }
  return seams;
}
async function mergeClipsSeamless(config, files, probed, outPath, { signal, binary }) {
  const durations = files.map((_, index) => {
    const media = probed[index] || {};
    return Number(media.videoDurationSeconds) || Number(media.durationSeconds) || 0;
  });
  if (durations.some((value) => !(value > 0))) return null;
  const shortest = Math.min(...durations);
  const fade = Number(Math.min(SEAM_FADE_SECONDS, shortest / 4).toFixed(3));
  if (!(fade >= 0.05)) return null;
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
    const shift = seam && Math.abs(seam.lumaDelta) >= 0.5 ? `lut=y='clip(val${seam.lumaDelta > 0 ? "+" : ""}${seam.lumaDelta},0,255)',` : "";
    videoParts.push(
      `[${index}:v]${shift}scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${index}]`
    );
    const gain = seam && Math.abs(seam.audioGainDb) >= 0.2 ? `volume=${seam.audioGainDb}dB,` : "";
    audioParts.push(
      `[${index}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,${gain}asetpts=PTS-STARTPTS[a${index}]`
    );
  }
  const videoChain = [];
  const audioChain = [];
  let offset = durations[0] - fade;
  let lastVideo = "[v0]";
  let lastAudio = "[a0]";
  for (let index = 1; index < files.length; index += 1) {
    const outVideo = `[x${index}]`;
    videoChain.push(
      `${lastVideo}[v${index}]xfade=transition=fade:duration=${fade}:offset=${offset.toFixed(3)}${outVideo}`
    );
    lastVideo = outVideo;
    if (withAudio) {
      const outAudio = `[y${index}]`;
      audioChain.push(`${lastAudio}[a${index}]acrossfade=d=${fade}:c1=tri:c2=tri${outAudio}`);
      lastAudio = outAudio;
    }
    offset += durations[index] - fade;
  }
  const filter = [
    ...videoParts,
    ...withAudio ? audioParts : [],
    ...videoChain,
    ...audioChain
  ].join(";");
  await rm(outPath, { force: true });
  const args = ["-y"];
  for (const file of files) args.push("-i", file);
  args.push("-filter_complex", filter, "-map", lastVideo);
  if (withAudio) args.push("-map", lastAudio);
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    ...withAudio ? ["-c:a", "aac", "-b:a", "192k"] : [],
    "-movflags",
    "+faststart",
    outPath
  );
  const { code, stderr } = await runProcess(binary, args, { signal });
  if (code !== 0 || !await exists(outPath)) {
    await rm(outPath, { force: true });
    return { path: null, mode: "seamless", seams, error: String(stderr).trim().slice(-400) };
  }
  return { path: outPath, mode: "seamless", seams, fade };
}
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
    if (isLast || !media?.hasAudio || videoSeconds <= 0 || padding <= AUDIO_PADDING_TOLERANCE_FRAMES / fps) {
      aligned.push(file);
      continue;
    }
    const temp = `${outPath}.align${index + 1}.mp4`;
    const { code } = await runProcess(
      binary || resolveBinary(config, "ffmpegBinary", "ffmpeg"),
      [
        "-y",
        "-i",
        file,
        "-map",
        "0:v",
        "-map",
        "0:a",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-af",
        `atrim=0:${videoSeconds.toFixed(3)}`,
        "-movflags",
        "+faststart",
        temp
      ],
      { signal }
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
async function cleanupSegmentTemps(temps) {
  for (const temp of temps || []) await rm(temp, { force: true });
}
async function mergeClips(config, files, outPath, { signal } = {}) {
  const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
  await mkdir(path.dirname(outPath), { recursive: true });
  await rm(outPath, { force: true });
  let copyError = "";
  let audioError = "";
  const probed = [];
  for (const file of files) probed.push(await probeMedia(file, config, signal));
  const videos = probed.filter((media) => media && media.width && media.height);
  const paramsMatch = videos.length !== probed.length || videos.every((media) => media.width === videos[0].width && media.height === videos[0].height);
  const { files: aligned, temps, trimmed } = await alignSegmentAudio(
    config,
    files,
    probed,
    outPath,
    { signal, binary }
  );
  files = aligned;
  try {
    const mergeMode = ref(config, "mergeMode", "seamless");
    if (mergeMode === "seamless" && files.length > 1) {
      const seamless = await mergeClipsSeamless(config, files, probed, outPath, { signal, binary });
      if (seamless?.path) {
        return { path: seamless.path, mode: "seamless", trimmed, seams: seamless.seams, fade: seamless.fade };
      }
      if (seamless?.error) copyError = seamless.error;
    }
    if (mergeMode !== "reencode" && paramsMatch) {
      const listPath = `${outPath}.concat.txt`;
      const lines = files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n");
      await writeFile(listPath, `${lines}
`, "utf8");
      try {
        const { code: code2, stderr: stderr2 } = await runProcess(binary, [
          "-y",
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          listPath,
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          outPath
        ], { signal });
        if (code2 === 0 && await exists(outPath)) return { path: outPath, mode: "copy", trimmed };
        copyError = stderr2.trim().slice(-400);
      } finally {
        await rm(listPath, { force: true });
      }
    } else if (!paramsMatch) {
      copyError = "\u5206\u6BB5\u5206\u8FA8\u7387\u4E0D\u4E00\u81F4\uFF0C\u8DF3\u8FC7\u65E0\u635F\u62FC\u63A5\u3002";
    }
    const first = probed.find((media) => media && media.width && media.height) || {};
    const width = evenNumber(first.width, 1280);
    const height = evenNumber(first.height, 720);
    const fps = Math.min(60, Math.max(24, Math.round(first.fps || 30)));
    const withAudio = probed.length > 0 && probed.every((media) => media?.hasAudio);
    const videoParts = files.map((_, index) => `[${index}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v${index}]`);
    const videoInputs = files.map((_, index) => `[v${index}]`).join("");
    async function encode(filter2, maps, withAudioTrack) {
      await rm(outPath, { force: true });
      const args = ["-y"];
      for (const file of files) args.push("-i", file);
      args.push("-filter_complex", filter2, ...maps, "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p");
      if (withAudioTrack) args.push("-c:a", "aac", "-b:a", "192k");
      args.push("-movflags", "+faststart", outPath);
      return runProcess(binary, args, { signal });
    }
    if (withAudio) {
      const audioParts = files.map((_, index) => `[${index}:a]aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${index}]`);
      const pairedInputs = files.map((_, index) => `[v${index}][a${index}]`).join("");
      const filter2 = [
        ...videoParts,
        ...audioParts,
        `${pairedInputs}concat=n=${files.length}:v=1:a=1[v][a]`
      ].join(";");
      const { code: code2, stderr: stderr2 } = await encode(filter2, ["-map", "[v]", "-map", "[a]"], true);
      if (code2 === 0 && await exists(outPath)) return { path: outPath, mode: "reencode", trimmed };
      audioError = stderr2.trim().slice(-400);
    }
    const filter = [...videoParts, `${videoInputs}concat=n=${files.length}:v=1:a=0[v]`].join(";");
    const { code, stderr } = await encode(filter, ["-map", "[v]"], false);
    if (code === 0 && await exists(outPath)) {
      return { path: outPath, mode: withAudio ? "reencode-video-only" : "reencode", trimmed };
    }
    const detail = [copyError, audioError, stderr.trim().slice(-400)].filter(Boolean).join(" | ");
    throw Object.assign(new Error(`ffmpeg \u5408\u5E76\u5931\u8D25\uFF1A${detail || "\u672A\u77E5\u9519\u8BEF"}`), { code: "ffmpeg_failed" });
  } finally {
    await cleanupSegmentTemps(temps);
  }
}
async function resolveOutputDir(config, exec, deps) {
  const configured = String(ref(config, "outputDir", "")).trim();
  if (configured) return path.resolve(configured);
  let cwd = "";
  if (deps?.workdir && exec?.agent) {
    try {
      cwd = await deps.workdir.ensure(exec.agent, exec.signal) || "";
    } catch {
      cwd = "";
    }
  }
  return path.join(cwd || process.cwd(), DEFAULT_OUTPUT_DIR);
}
function findKey(payload, keys) {
  if (payload && typeof payload === "object") {
    if (!Array.isArray(payload)) {
      for (const key of keys) {
        const value = payload[key];
        if (value !== void 0 && value !== null && value !== "") return value;
      }
    }
    for (const value of Array.isArray(payload) ? payload : Object.values(payload)) {
      const found = findKey(value, keys);
      if (found !== void 0 && found !== null && found !== "") return found;
    }
  }
  return void 0;
}
function collectUrls(payload, path2 = [], found = []) {
  if (typeof payload === "string") {
    if (/^https?:\/\//i.test(payload)) found.push([path2, payload]);
  } else if (Array.isArray(payload)) {
    for (const item of payload) collectUrls(item, path2, found);
  } else if (payload && typeof payload === "object") {
    for (const [key, value] of Object.entries(payload)) {
      collectUrls(value, [...path2, key], found);
    }
  }
  return found;
}
function isImageKey(key) {
  const lowered = String(key || "").toLowerCase();
  return IMAGE_KEY_TOKENS.some((token) => lowered.includes(token));
}
function looksLikeImageUrl(url) {
  return IMAGE_EXTENSIONS.some((ext) => url.split("?")[0].toLowerCase().endsWith(ext));
}
function extractTaskId(payload) {
  const value = findKey(payload, ["id", "task_id", "taskId", "request_id"]);
  return typeof value === "string" && value ? value : void 0;
}
function extractVideoUrl(payload) {
  const candidates = collectUrls(payload).filter(
    ([path2, url]) => !looksLikeImageUrl(url) && !path2.some(isImageKey)
  );
  if (!candidates.length) return void 0;
  for (const wanted of VIDEO_URL_KEYS) {
    for (const [path2, url] of candidates) {
      if (path2.length && String(path2.at(-1)).toLowerCase() === wanted) return url;
    }
  }
  for (const [path2, url] of candidates) {
    if (path2.length && GENERIC_URL_KEYS.has(String(path2.at(-1)).toLowerCase())) return url;
  }
  return candidates[0][1];
}
function extractImageUrl(payload) {
  const found = collectUrls(payload).find(
    ([path2, url]) => looksLikeImageUrl(url) || path2.some(isImageKey)
  );
  return found?.[1];
}
function extractStatus(payload) {
  const value = findKey(payload, ["status", "state", "task_status"]);
  return typeof value === "string" ? value.toLowerCase() : void 0;
}
function upstreamMessage(data) {
  if (data && typeof data === "object") {
    const error = data.error;
    if (error && typeof error === "object") {
      const message = String(error.message || "").trim();
      const code = String(error.code || "").trim();
      if (message) return code ? `${message}\uFF08${code}\uFF09` : message;
    } else if (typeof error === "string" && error.trim()) {
      return error.trim();
    }
    for (const key of ["message", "detail", "msg", "fail_reason"]) {
      const value = data[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  const text = typeof data === "string" ? data : JSON.stringify(data ?? {});
  return text || "\u4E0A\u6E38\u672A\u8FD4\u56DE\u9519\u8BEF\u8BE6\u60C5";
}
function quotaDetail(text) {
  const parts = [];
  const remain = /(?:remain(?:ing)? quota|剩余额度)\D{0,6}([¥$]?\d[\d.,]*)/i.exec(text);
  const need = /(?:need quota|需要预扣费额度|需要额度)\D{0,6}([¥$]?\d[\d.,]*)/i.exec(text);
  if (remain) parts.push(`\u5269\u4F59 ${remain[1]}`);
  if (need) parts.push(`\u9700\u8981 ${need[1]}`);
  return parts.length ? `\uFF08${parts.join("\uFF0C")}\uFF09` : "";
}
function classifyError(statusCode, data) {
  const raw = upstreamMessage(data);
  const lowered = raw.toLowerCase();
  if (statusCode === 402 || QUOTA_HINTS.some((hint) => lowered.includes(hint)) || lowered.includes("quota_exceeded")) {
    return {
      code: "provider_quota_exceeded",
      message: `\u4E2D\u8F6C\u7AD9\u989D\u5EA6\u4E0D\u8DB3${quotaDetail(raw)}\uFF0C\u8BF7\u5145\u503C\u540E\u518D\u8BD5\uFF1A${raw}`
    };
  }
  if (statusCode === 401 || statusCode === 403) {
    return { code: "provider_auth", message: `\u4E2D\u8F6C\u7AD9\u9274\u6743\u5931\u8D25\uFF08${statusCode}\uFF09\uFF1A${raw}` };
  }
  if (statusCode === 429) {
    return { code: "provider_rate_limited", message: `\u4E2D\u8F6C\u7AD9\u9650\u6D41\uFF08429\uFF09\uFF1A${raw}` };
  }
  if (CONTENT_HINTS.some((hint) => lowered.includes(hint))) {
    return { code: "content_rejected", message: raw };
  }
  if (PRICE_HINTS.some((hint) => lowered.includes(hint))) {
    return {
      code: "provider_price_config_error",
      message: `\u4E2D\u8F6C\u7AD9\u8BE5\u6A21\u578B\u7684\u8BA1\u4EF7\u914D\u7F6E\u5F02\u5E38\uFF0C\u4E0E\u672C\u6B21\u8BF7\u6C42\u53C2\u6570\u65E0\u5173\uFF0C\u91CD\u8BD5\u4E5F\u4E0D\u4F1A\u6210\u529F\uFF1A${raw}\u3002\u8BF7\u5728\u63D2\u4EF6 config \u91CC\u6362\u7528\u5176\u5B83\u53EF\u7528\u6A21\u578B\u3002`
    };
  }
  return { code: "provider_failed", message: raw };
}
function isContentRejection(text) {
  const lowered = String(text || "").toLowerCase();
  return CONTENT_HINTS.some((hint) => lowered.includes(hint));
}
function formatAmount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  const text = number.toFixed(Math.abs(number) >= 1 ? 2 : 4);
  return text.includes(".") ? text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : text;
}
function formatMoney(value, symbol = "\xA5") {
  return `${symbol}${formatAmount(value)}`;
}
function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function estimateRate(model, usesReference) {
  const id = String(model || "").toLowerCase();
  const hit = ESTIMATE_RATES.find(([prefix]) => id.startsWith(prefix));
  const table = hit ? hit[1] : ESTIMATE_RATES[0][1];
  return usesReference ? table.video : table.none;
}
function estimatePlan(config, toolName, args) {
  if (toolName === "video_extend") {
    const count = clampInteger(args?.segments, 1, MAX_SEGMENTS, 1);
    const fallback = ref(config, "duration", 5);
    const seconds = clampInteger(
      args?.duration ?? fallback,
      MIN_SECONDS,
      MAX_SEGMENT_SECONDS,
      fallback
    );
    return Array.from({ length: count }, () => ({ kind: "extend", seconds }));
  }
  const singleMax = resolveSingleMax(config);
  const total = clampInteger(
    args?.duration ?? singleMax,
    MIN_SECONDS,
    singleMax + (MAX_SEGMENTS - 1) * MAX_SEGMENT_SECONDS,
    singleMax
  );
  return planVideoSegments(total, singleMax, resolveSegmentSeconds(config, args?.segmentSeconds));
}
function estimateUsage(config, toolName, args) {
  const plan = estimatePlan(config, toolName, args);
  const resolution = FIXED_RESOLUTION;
  const pixels = ESTIMATE_PIXELS[resolution] || ESTIMATE_PIXELS[FIXED_RESOLUTION];
  const tokensPerSecond = pixels[0] * pixels[1] * ESTIMATE_FPS / ESTIMATE_TOKEN_DIVISOR;
  const hasFrame = Boolean(
    String(args?.firstFrameUrl ?? "").trim() || String(args?.lastFrameUrl ?? "").trim()
  );
  const model = resolveModel(config);
  const groupRatio = finiteNumber(ref(config, "estimateGroupRatio", 0.8)) ?? 1;
  const segments = plan.map((step, index) => {
    const usesReference = step.kind === "extend" || hasFrame;
    const tokens = Math.round(tokensPerSecond * step.seconds);
    return {
      index: index + 1,
      kind: step.kind,
      seconds: step.seconds,
      tokens,
      usesReference,
      usd: tokens * estimateRate(model, usesReference) / 1e6
    };
  });
  const usd = segments.reduce((sum, item) => sum + item.usd, 0) * groupRatio;
  return {
    model,
    resolution,
    segments,
    seconds: segments.reduce((sum, item) => sum + item.seconds, 0),
    tokens: segments.reduce((sum, item) => sum + item.tokens, 0),
    usd: Math.round(usd * 1e6) / 1e6
  };
}
function resolveRegisterApi(config) {
  return (String(ref(config, "registerApi", "")).trim() || DEFAULT_REGISTER_API).replace(/\/+$/, "");
}
async function fetchDeviceQuota(config, signal) {
  const api = resolveRegisterApi(config);
  const deviceId = String(ref(config, "deviceId", "")).trim();
  const deviceSecret = String(ref(config, "deviceSecret", "")).trim();
  if (!deviceId || !deviceSecret) {
    return {
      status: "unknown",
      reason: "\u63D2\u4EF6\u91CC\u6CA1\u6709\u672C\u673A\u8BBE\u5907\u51ED\u636E\uFF08\u5728\u8BBE\u7F6E\u9875\u70B9\u4E00\u6B21\u300C\u767B\u5F55\u300D\u4F1A\u5199\u8FDB\u6765\uFF0C\u4E4B\u540E\u5C31\u80FD\u81EA\u52A8\u6821\u9A8C\u989D\u5EA6\uFF09"
    };
  }
  try {
    const response = await fetch(`${api}/api/v1/register/quota`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "X-Register-Token": String(ref(config, "registerToken", "")).trim() || DEFAULT_REGISTER_TOKEN
      },
      body: JSON.stringify({ device_id: deviceId, device_secret: deviceSecret }),
      ...signal ? { signal } : {}
    });
    const text = await response.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text.slice(0, 200) };
      }
    }
    if (!response.ok || body && typeof body === "object" && body.code) {
      return {
        status: "unknown",
        reason: body && (body.message || body.detail) || `HTTP ${response.status}`
      };
    }
    return { status: "ok", data: body && body.data || body || {} };
  } catch (error) {
    return { status: "unknown", reason: error?.message || String(error) };
  }
}
function approvalPolicy(ctx, exec) {
  try {
    const approval = ctx.get("approval");
    if (!approval) return "missing";
    const session = exec?.agent?.session;
    const override = session && typeof approval.overrideOf === "function" ? approval.overrideOf(session) : void 0;
    return override || approval.config?.policy || "ask";
  } catch {
    return "ask";
  }
}
function planSummary(estimate) {
  if (!estimate) return "\u65F6\u957F\u672A\u77E5";
  const sizes = estimate.segments.map((item) => `${item.seconds}s`).join(" + ");
  return `${estimate.segments.length} \u6BB5\uFF08${sizes}\uFF09\u5171 ${estimate.seconds} \u79D2`;
}
function setupGate(ctx, exec) {
  const args = exec.arguments && typeof exec.arguments === "object" ? exec.arguments : {};
  if (args?.install !== true) return { kind: "allow" };
  const { os, installs, bootstrap } = ffmpegInstallOptions();
  const command = String(args?.target || "ffmpeg") === "package-manager" && bootstrap ? bootstrap.command : installs[0].command;
  if (approvalPolicy(ctx, exec) === "never") {
    return {
      kind: "deny",
      reason: `\u5F53\u524D\u6743\u9650\u6A21\u5F0F\u5173\u95ED\u4E86\u5BA1\u6279\u63D0\u793A\uFF08\u5B8C\u5168\u8BBF\u95EE\uFF09\uFF0C\u88C5\u73AF\u5883\u8FD9\u79CD\u4F1A\u5728\u672C\u673A\u8DD1\u547D\u4EE4\u7684\u64CD\u4F5C\u6CA1\u6CD5\u786E\u8BA4\uFF0C\u5DF2\u505C\u6B62\u3002\u628A\u6743\u9650\u5207\u5230\u300C\u5DE5\u4F5C\u533A\u5199\u5165\u300D\u6216\u300C\u53EA\u8BFB\u300D\u540E\u518D\u8BA9\u6211\u88C5\uFF1B\u4E5F\u53EF\u4EE5\u7167\u7740\u8FD9\u6761\u547D\u4EE4\u81EA\u5DF1\u5728\u7EC8\u7AEF\u6267\u884C\uFF1A${command}\uFF08${os}\uFF09\u3002`
    };
  }
  return {
    kind: "ask",
    reason: `\u4EBA\u5DE5\u786E\u8BA4\uFF1A\u5728 ${os} \u4E0A\u6267\u884C\u5B89\u88C5\u547D\u4EE4\u300C${command}\u300D\u3002`,
    displayReason: {
      zh: `\u51C6\u5907\u5728\u8FD9\u53F0\u7535\u8111\u4E0A\u88C5 ffmpeg\uFF1A${command}\uFF08${os}\uFF09\u3002\u70B9\u4E86\u300C\u5141\u8BB8\u300D\u624D\u4F1A\u6267\u884C\uFF0C\u88C5\u5B8C\u4F1A\u81EA\u52A8\u63A5\u7740\u628A\u89C6\u9891\u751F\u6210\u51FA\u6765\u3002`,
      en: `About to install ffmpeg on this machine: ${command} (${os}). It runs only after you allow it; the video generation continues right after.`
    }
  };
}
async function ffmpegConsentGate(config, exec, args) {
  if (exec.name !== "video_generate") return null;
  if (args?.merge === false) return null;
  let plan = null;
  try {
    plan = estimatePlan(config, exec.name, args);
  } catch {
    plan = null;
  }
  if (!plan || plan.length < 2) return null;
  if (await hasFfmpeg(config, exec.signal)) return null;
  const { os, installs } = ffmpegInstallOptions();
  const command = installs[0].command;
  const sizes = plan.map((step) => `${step.seconds}s`).join(" + ");
  const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
  const lines = [
    `\u672C\u673A\u6CA1\u6709 ${binary}\uFF0C\u8FD9\u6B21\u8981\u751F\u6210 ${plan.reduce((sum, step) => sum + step.seconds, 0)} \u79D2\uFF08\u4F1A\u62C6\u6210 ${plan.length} \u6BB5\uFF1A${sizes}\uFF09\uFF0C\u6CA1\u6709 ffmpeg \u5C31\u6CA1\u6CD5\u5408\u5E76\u6210\u4E00\u6761\uFF0C\u6240\u4EE5\u5148\u505C\u4E0B\u6765\u4E86\uFF0C\u8FD8\u6CA1\u6709\u8C03\u7528\u6A21\u578B\u3001\u6CA1\u6709\u4EA7\u751F\u8D39\u7528\u3002`,
    "\u8BF7\u5728\u5BF9\u8BDD\u6846\u91CC\u5148\u548C\u7528\u6237\u786E\u8BA4\uFF0C\u4E0D\u8981\u81EA\u5DF1\u7ED5\u8FC7\u8FD9\u4E00\u6B65\uFF1A",
    `1) \u95EE\u7528\u6237\u8981\u4E0D\u8981\u73B0\u5728\u88C5 ffmpeg \u2014\u2014 \u8BF4\u6E05\u4ED6\u7684\u7CFB\u7EDF\uFF08${os}\uFF09\u548C\u547D\u4EE4\uFF1A${command}`,
    "   \uFF08\u88C5\u597D\u540E\u91CD\u8DD1\u8FD9\u6B21\u751F\u6210\u5C31\u4F1A\u81EA\u52A8\u5408\u5E76\u6210\u4E00\u6761\uFF0C\u5206\u6BB5\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF09\u3002",
    '2) \u7528\u6237\u540C\u610F\u5B89\u88C5\uFF1A\u8C03\u7528 video_setup\uFF08install:true\uFF09\u2014\u2014\u63D2\u4EF6\u4F1A\u6267\u884C\u4E0A\u9762\u7684\u547D\u4EE4\uFF0C\u5BBF\u4E3B\u4F1A\u5148\u628A\u8FD9\u6761\u547D\u4EE4\u62FF\u7ED9\u7528\u6237\u786E\u8BA4\uFF1B\u88C5\u5B8C\u5B83\u4F1A\u81EA\u5DF1\u9A8C\u8BC1\uFF0C\u6210\u529F\u540E\u4F60\u6309\u539F duration \u91CD\u65B0\u8C03\u7528 video_generate \u7EE7\u7EED\u751F\u6210\u5373\u53EF\uFF08\u4E00\u822C\u662F\u5148\u88C5\u5305\u7BA1\u7406\u5668\uFF1A\u672C\u673A\u8FDE brew \u90FD\u6CA1\u6709\u65F6\uFF0Cvideo_setup \u4F1A\u8FD4\u56DE nextStep\uFF0C\u7528 target:"package-manager" \u518D\u88C5\u4E00\u6B21\uFF09\u3002',
    "3) \u7528\u6237\u4E0D\u60F3\u88C5\u3001\u6216\u8005\u88C5\u4E0D\u4E86\uFF1A\u5E26 `merge:false` \u91CD\u65B0\u8C03\u7528 video_generate\uFF0C\u63D2\u4EF6\u5C31\u53EA\u751F\u6210\u5E76\u8FD4\u56DE\u5206\u6BB5\u5217\u8868\uFF08\u6BCF\u6BB5\u94FE\u63A5 + \u672C\u5730\u6587\u4EF6\uFF09\uFF0C\u8FD9\u6B21\u4E0D\u4F1A\u518D\u62E6\u3002",
    "\u5DF2\u7ECF\u88C5\u8FC7\u4F46\u4E0D\u5728\u9ED8\u8BA4\u4F4D\u7F6E\u7684\u8BDD\uFF0C\u628A\u7EDD\u5BF9\u8DEF\u5F84\u586B\u8FDB\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u4E5F\u4E00\u6837\u7BA1\u7528\uFF1B\u5B89\u88C5\u5305\u81EA\u5E26 ffprobe\uFF0C\u5206\u6BB5\u65F6\u957F\u63A2\u6D4B\u4F1A\u4E00\u8D77\u89E3\u51B3\u3002"
  ];
  return {
    kind: "deny",
    reason: lines.join("\n"),
    info: { ffmpegMissing: true, os, command, segments: plan.length }
  };
}
async function preflightGate(ctx, config, exec) {
  if (exec.name === "video_setup") return setupGate(ctx, exec);
  if (approvalPolicy(ctx, exec) === "never") {
    return {
      kind: "deny",
      reason: "\u5F53\u524D\u6743\u9650\u6A21\u5F0F\u5173\u95ED\u4E86\u5BA1\u6279\u63D0\u793A\uFF08\u5B8C\u5168\u8BBF\u95EE\uFF09\uFF0C\u65E0\u6CD5\u505A\u4EBA\u5DE5\u786E\u8BA4\uFF0C\u5DF2\u505C\u6B62\u8C03\u7528\u3002\u628A\u6743\u9650\u5207\u5230\u300C\u5DE5\u4F5C\u533A\u5199\u5165\u300D\u6216\u300C\u53EA\u8BFB\u300D\u540E\u518D\u751F\u6210\u89C6\u9891\u3002"
    };
  }
  const args = exec.arguments && typeof exec.arguments === "object" ? exec.arguments : {};
  const consent = await ffmpegConsentGate(config, exec, args);
  if (consent) return consent;
  let estimate = null;
  try {
    estimate = estimateUsage(config, exec.name, args);
  } catch {
    estimate = null;
  }
  const quota = await fetchDeviceQuota(config, exec.signal);
  const data = quota.status === "ok" ? quota.data : {};
  const symbol = String(data.currency_symbol || "\xA5");
  const perUnit = finiteNumber(data.quota_per_unit) ?? DEFAULT_QUOTA_PER_UNIT;
  const exchange = finiteNumber(data.usd_exchange_rate) ?? DEFAULT_USD_EXCHANGE_RATE;
  const needQuota = estimate ? Math.round(estimate.usd * perUnit) : null;
  const needMoney = estimate ? formatMoney(estimate.usd * exchange, symbol) : null;
  const remainQuota = finiteNumber(data.remain_quota);
  const remainAmount = finiteNumber(data.remain_amount);
  const costText = needMoney === null ? "\u8FD9\u6B21\u8C03\u7528\u7684\u8D39\u7528\u6CA1\u6CD5\u9884\u4F30" : `\u9884\u4F30 ${needMoney}`;
  const remainMoneyText = `${formatMoney(remainAmount === null ? 0 : remainAmount, symbol)}`;
  const remainZh = remainQuota === null ? `\u672C\u673A Key \u7684\u989D\u5EA6\u8BFB\u4E0D\u5230\uFF08${quota.reason || "\u670D\u52A1\u7AEF\u6CA1\u56DE\u989D\u5EA6"}\uFF09` : `\u672C\u673A Key \u5269\u4F59 ${remainMoneyText}`;
  const remainEn = remainQuota === null ? `this key's quota could not be read (${quota.reason || "the service returned none"})` : `this key has ${remainMoneyText} left`;
  if (needQuota !== null && remainQuota !== null && remainQuota < needQuota) {
    return {
      kind: "deny",
      reason: `\u989D\u5EA6\u4E0D\u8DB3\uFF0C\u5DF2\u505C\u6B62\u8C03\u7528\uFF1A\u672C\u6B21\u9884\u4F30\u9700\u8981 ${needMoney ?? "\u65E0\u6CD5\u9884\u4F30"}\uFF0C\u8FD9\u628A Key \u53EA\u5269 ${remainMoneyText}\u3002\u8BF7\u5145\u503C\u6216\u627E\u7BA1\u7406\u5458\u6362\u4E00\u628A\u989D\u5EA6\u591F\u7684 Key \u540E\u91CD\u8BD5\u3002`
    };
  }
  const total = estimate ? `${estimate.model} \xB7 ${estimate.resolution} \xB7 ${planSummary(estimate)}` : `${resolveModel(config)} \xB7 ${FIXED_RESOLUTION}`;
  const auditTax = estimate ? `\u9884\u4F30\u6D88\u8017 ${estimate.tokens.toLocaleString("en-US")} token \u2248 ${needMoney ?? "\u65E0\u6CD5\u9884\u4F30"}\uFF08${needQuota === null ? "\u989D\u5EA6\u672A\u77E5" : `${needQuota.toLocaleString("en-US")} \u989D\u5EA6`}\uFF09` : "\u8FD9\u6B21\u8C03\u7528\u7684\u8D39\u7528\u65E0\u6CD5\u9884\u4F30";
  return {
    kind: "ask",
    reason: `\u4EBA\u5DE5\u786E\u8BA4\uFF1A\u8C03\u7528\u89C6\u9891\u6A21\u578B\uFF08${total}\uFF09\u3002${auditTax}\uFF1B\u672C\u673A Key \u5269\u4F59 ${remainQuota === null ? "\u989D\u5EA6\u8BFB\u4E0D\u5230" : `${remainMoneyText} / ${remainQuota.toLocaleString("en-US")} \u989D\u5EA6`}\u3002`,
    displayReason: {
      zh: `\u672C\u6B21\u4F1A\u8C03\u7528\u89C6\u9891\u6A21\u578B\uFF1A${total}\uFF1B${costText}\uFF0C${remainZh}\u3002\u70B9\u4E86\u300C\u5141\u8BB8\u300D\u624D\u4F1A\u771F\u6B63\u8C03\u7528\u3002`,
      en: `This will call the video model: ${total}. Estimated cost ${needMoney === null ? "unknown" : needMoney}; ${remainEn}. The call runs only after you allow it.`
    }
  };
}
async function relayRequest(config, path2, { method = "GET", body } = {}) {
  const url = `${resolveBaseUrl(config)}${path2}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${resolveApiKey(config)}`,
        "Content-Type": "application/json"
      },
      ...body !== void 0 ? { body: JSON.stringify(body) } : {}
    });
  } catch (error) {
    throw Object.assign(new Error(`\u4E2D\u8F6C\u7AD9\u8BF7\u6C42\u5931\u8D25\uFF1A${error?.message || error}`), {
      code: "provider_network_error"
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
  const upstreamError = data && typeof data === "object" && data.error;
  if (!response.ok || upstreamError) {
    const classified = classifyError(
      response.status >= 400 ? response.status : 400,
      data
    );
    throw Object.assign(new Error(classified.message), { code: classified.code });
  }
  return data;
}
function abortError() {
  const error = new Error("\u5DF2\u53D6\u6D88");
  error.code = "ABORTED";
  return error;
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
function createTask(config, body) {
  return relayRequest(config, resolveSubmitPath(config), { method: "POST", body });
}
function getTask(config, taskId) {
  return relayRequest(config, resolveQueryPath(config, taskId));
}
async function waitForCompletion(config, taskId, signal) {
  const deadline = Date.now() + ref(config, "maxWaitMs", 6e5);
  for (; ; ) {
    if (signal?.aborted) throw abortError();
    const task = await getTask(config, taskId);
    const status = extractStatus(task) || "unknown";
    const model = findKey(task, ["model"]) || resolveModel(config);
    if (SUCCESS_STATES.has(status)) {
      const videoUrl = extractVideoUrl(task);
      if (videoUrl) return { taskId, status: "succeeded", model, videoUrl };
      const imageUrl = extractImageUrl(task);
      return {
        taskId,
        status: "failed",
        model,
        errorCode: "provider_bad_response",
        error: imageUrl ? `\u4E0A\u6E38\u8FD4\u56DE\u7684\u662F\u56FE\u7247\u800C\u4E0D\u662F\u89C6\u9891\uFF08${imageUrl.split("?")[0].slice(-60)}\uFF09\uFF0C\u53EF\u80FD\u662F\u4E2D\u8F6C\u7AD9\u628A\u89C6\u9891\u8BF7\u6C42\u8DEF\u7531\u5230\u4E86\u56FE\u7247\u6E20\u9053\u3002` : "\u4E0A\u6E38\u62A5\u544A\u6210\u529F\u4F46\u6CA1\u6709\u8FD4\u56DE\u89C6\u9891\u5730\u5740\u3002"
      };
    }
    if (FAILED_STATES.has(status)) {
      const data = findKey(task, ["error", "fail_reason", "message", "detail"]);
      const classified = classifyError(400, typeof data === "string" ? { message: data } : data || task);
      return {
        taskId,
        status: CANCEL_STATES.has(status) ? "cancelled" : "failed",
        model,
        errorCode: classified.code,
        error: classified.message
      };
    }
    if (Date.now() > deadline) {
      return { taskId, status: "timeout" };
    }
    await sleep(ref(config, "pollIntervalMs", 5e3), signal);
  }
}
function renderResult(value) {
  const { status, segments = [], videoUrl, error } = value || {};
  const lines = segments.map((segment) => {
    const head = `\u7B2C ${segment.index} \u6BB5\uFF1A+${segment.seconds}s\uFF08\u4EFB\u52A1 ${segment.taskId}\uFF09`;
    return segment.status === "succeeded" && segment.videoUrl ? `${head} \u2192 ${segment.videoUrl}` : `${head} \u2192 ${segment.status}${segment.error ? `\uFF1A${segment.error}` : ""}`;
  });
  if (status === "succeeded") {
    return [
      {
        type: "text",
        text: [
          "\u89C6\u9891\u5EF6\u957F\u6210\u529F\u3002",
          ...lines,
          `\u6700\u7EC8\u89C6\u9891\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF1A${videoUrl || "\uFF08\u65E0\uFF09"}`
        ].join("\n")
      }
    ];
  }
  if (status === "timeout") {
    return [
      {
        type: "text",
        text: [
          "\u5EF6\u957F\u4EFB\u52A1\u4ECD\u5728\u751F\u6210\u4E2D\uFF08\u5DF2\u8D85\u51FA\u5355\u6B21\u7B49\u5F85\u65F6\u95F4\uFF09\u3002",
          ...lines,
          `\u53EF\u7528 video_status \u67E5\u8BE2\u4EFB\u52A1 ${segments.at(-1)?.taskId || "\uFF08\u672A\u77E5\uFF09"} \u7684\u72B6\u6001\u4E0E\u89C6\u9891\u94FE\u63A5\u3002`
        ].join("\n")
      }
    ];
  }
  if (status === "cancelled") {
    return [{ type: "text", text: `\u5EF6\u957F\u4EFB\u52A1\u5DF2\u53D6\u6D88\u3002
${lines.join("\n")}` }];
  }
  return [
    {
      type: "text",
      text: [
        `\u89C6\u9891\u5EF6\u957F\u5931\u8D25${error ? `\uFF1A${error}` : ""}\u3002`,
        ...lines,
        videoUrl ? `\u5DF2\u5B8C\u6210\u90E8\u5206\u7684\u89C6\u9891\u94FE\u63A5\uFF1A${videoUrl}` : ""
      ].filter(Boolean).join("\n")
    }
  ];
}
const SEGMENT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    index: { type: "integer" },
    seconds: { type: "integer" },
    taskId: { type: "string" },
    status: { type: "string" },
    videoUrl: { type: "string" },
    error: { type: "string" }
  }
};
function extendTool(config) {
  return {
    name: "video_extend",
    description: "\u628A\u4E00\u6BB5\u5DF2\u6709\u7684\u89C6\u9891\u5411\u524D\u6216\u5411\u540E\u5EF6\u957F\uFF1A\u4EE5\u516C\u7F51\u89C6\u9891 URL \u4F5C\u4E3A\u8F93\u5165\u7D20\u6750\uFF0C\u8C03\u7528 Seedance \u751F\u6210\u8854\u63A5\u7247\u6BB5\uFF0C\u4FDD\u6301\u4EBA\u7269\u3001\u670D\u88C5\u3001\u573A\u666F\u5149\u7EBF\u548C\u58F0\u97F3\u8FDE\u7EED\uFF1B\u53EF\u4E00\u6B21\u8FDE\u7EED\u5EF6\u957F\u591A\u6BB5\uFF0C\u6BCF\u6BB5\u90FD\u7528\u4E0A\u4E00\u6BB5\u7684\u7ED3\u679C\u7EE7\u7EED\u5EF6\u957F\u3002\u63D0\u793A\u8BCD\u89C4\u5219\uFF1A\u4EE5\u300C\u5411\u540E\u5EF6\u957F\u89C6\u98911\u300D\u6216\u300C\u5411\u524D\u5EF6\u957F\u89C6\u98911\u300D\u5F00\u5934\uFF08\u4E5F\u53EF\u5199\u300C\u751F\u6210\u89C6\u98911\u4E4B\u540E\u7684\u5185\u5BB9\uFF1A\u300D\uFF09\uFF0C\u5168\u7A0B\u7528\u300C\u89C6\u98911\u300D\u6307\u4EE3\u8F93\u5165\u7D20\u6750\uFF0C\u4E0D\u8981\u5199\u6210\u300C\u53C2\u8003\u89C6\u98911\u300D\uFF08\u4F1A\u88AB\u5F53\u6210\u53C2\u8003\u751F\u89C6\u9891\uFF0C\u4E0D\u662F\u5EF6\u957F\uFF09\uFF1B\u5185\u5BB9\u5199\u6E05\u5EF6\u957F\u65B9\u5411\u3001\u5267\u60C5\u53D1\u5C55\u3001\u4E3B\u4F53\u72B6\u6001\u3001\u955C\u5934\u8FD0\u52A8\u548C\u58F0\u97F3\u5EF6\u7EED\uFF0C\u51CF\u5C11\u63A5\u7F1D\u3002\u6BCF\u6BB5 4-15 \u79D2\uFF0C\u9ED8\u8BA4\u6309 15 \u79D2\u4E0A\u9650\u62C6\u3001\u6BB5\u6570\u6700\u5C11\uFF1B\u4E0A\u6E38\u5BF9\u5361\u6EE1 15 \u79D2\u654F\u611F\u65F6\u518D\u8C03\u5C0F\u3002\u8FD4\u56DE\u6BCF\u6BB5\u7684\u4EFB\u52A1 ID \u548C\u6700\u7EC8\u89C6\u9891\u4E0B\u8F7D\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF1B\u751F\u6210\u901A\u5E38\u9700\u8981\u51E0\u5206\u949F\uFF0C\u5355\u6B21\u8C03\u7528\u8FD4\u56DE timeout \u65F6\u7528 video_status \u7EE7\u7EED\u7B49\uFF0C\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u540C\u4E00\u6BB5\u3002",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "\u672C\u6BB5\u8981\u7EED\u62CD\u7684\u5267\u60C5\u5185\u5BB9\u4E0E\u4EBA\u7269\u8BBE\u5B9A\uFF1B\u4E0D\u8981\u5728\u63D0\u793A\u8BCD\u91CC\u91CD\u590D\u5DF2\u53D1\u751F\u7684\u60C5\u8282\u3002"
        },
        videoUrl: {
          type: "string",
          description: "\u53C2\u8003\u89C6\u9891\u7684\u516C\u7F51 URL\uFF08https:// \u6216 http://\uFF09\u3002\u4E0E taskId \u4E8C\u9009\u4E00\u3002"
        },
        taskId: {
          type: "string",
          description: "\u5DF2\u6709\u7684 video_generate / video_extend \u4EFB\u52A1 ID\uFF0C\u7528\u5B83\u7684\u6210\u7247\u4F5C\u4E3A\u8F93\u5165\u7D20\u6750\u3002\u4E0E videoUrl \u4E8C\u9009\u4E00\u3002"
        },
        duration: {
          type: "integer",
          minimum: 4,
          maximum: 15,
          description: "\u6BCF\u6BB5\u65B0\u589E\u7684\u79D2\u6570\u4E0A\u9650\uFF0C4-15 \u7684\u6574\u6570\uFF08\u5982 5/8/10/14\uFF0C\u9ED8\u8BA4 15\uFF09\uFF1B\u521A\u597D\u5361 15 \u79D2\u5BB9\u6613\u56E0\u5C01\u88C5\u7565\u8D85\u88AB\u4E0A\u6E38\u62D2\u7EDD\u3002\u7701\u7565\u65F6\u4F7F\u7528\u914D\u7F6E\u9ED8\u8BA4\u503C\u3002"
        },
        direction: {
          type: "string",
          enum: ["backward", "forward"],
          description: "backward=\u5411\u540E\u5EF6\u957F\uFF0C\u7EED\u62CD\u89C6\u98911\u4E4B\u540E\u7684\u5185\u5BB9\uFF08\u9ED8\u8BA4\uFF09\uFF1Bforward=\u5411\u524D\u5EF6\u957F\uFF0C\u751F\u6210\u89C6\u98911\u4E4B\u524D\u7684\u524D\u7F6E\u5267\u60C5\u3002"
        },
        wording: {
          type: "string",
          enum: ["extend", "after"],
          description: "\u63D0\u793A\u8BCD\u5F00\u5934\u5199\u6CD5\uFF1Aextend=\u300C\u5411\u540E\u5EF6\u957F\u89C6\u98911\u300D/\u300C\u5411\u524D\u5EF6\u957F\u89C6\u98911\u300D\uFF08\u9ED8\u8BA4\uFF09\uFF1Bafter=\u300C\u751F\u6210\u89C6\u98911\u4E4B\u540E\u7684\u5185\u5BB9\uFF1A\u300D\uFF08\u4EC5\u5411\u540E\u5EF6\u957F\uFF09\u3002"
        },
        segments: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "\u8FDE\u7EED\u5EF6\u957F\u51E0\u6BB5\uFF0C\u9ED8\u8BA4 1\uFF1B\u6BCF\u6BB5\u90FD\u5F15\u7528\u4E0A\u4E00\u6BB5\u7684\u7ED3\u679C\uFF0C\u9002\u5408\u505A\u51FA\u66F4\u957F\u7684\u6210\u7247\u3002"
        },
        mode: {
          type: "string",
          enum: ["continuous", "closeup"],
          description: "continuous=\u540C\u673A\u4F4D\u8FDE\u7EED\u7EED\u62CD\uFF08\u9ED8\u8BA4\uFF09\uFF1Bcloseup=\u5728\u5B8C\u6574\u53F0\u8BCD\u7ED3\u675F\u5904\u81EA\u7136\u5207\u5230\u8FD1\u666F\u6216\u53CD\u5E94\u955C\u5934\u3002"
        },
        startAt: {
          type: "number",
          minimum: 0,
          description: "\u89C6\u98911\u5DF2\u6709\u7684\u79D2\u6570\uFF1B\u7ED9\u4E86\u5C31\u6309\u300C\u6574\u7247\u7B2C X\u2013Y \u79D2\u300D\u63CF\u8FF0\u672C\u6BB5\u3002\u5411\u540E\u5EF6\u957F\u65F6\u9010\u6BB5\u7D2F\u52A0\uFF0C\u5411\u524D\u5EF6\u957F\u65F6\u9010\u6BB5\u524D\u79FB\u3002"
        },
        ratio: {
          type: "string",
          enum: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
          description: "\u753B\u9762\u6BD4\u4F8B\uFF1Bseedance 2.5 \u5EF6\u957F\u65F6\u4F1A\u81EA\u52A8\u6539\u7528 adaptive\u3002"
        },
        generateAudio: {
          type: "boolean",
          description: "\u662F\u5426\u751F\u6210\u97F3\u9891\uFF0C\u9ED8\u8BA4 true\u3002"
        },
        watermark: {
          type: "boolean",
          description: "\u662F\u5426\u6DFB\u52A0\u6C34\u5370\uFF0C\u9ED8\u8BA4 false\u3002"
        }
      },
      required: ["prompt"]
    },
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string" },
          videoUrl: { type: "string" },
          totalSeconds: { type: "integer" },
          error: { type: "string" },
          errorCode: { type: "string" },
          segments: { type: "array", items: SEGMENT_OUTPUT_SCHEMA }
        }
      },
      render(_args, value) {
        return renderResult(value);
      }
    },
    timeoutMs: 18e5,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);
      const prompt = String(args?.prompt ?? "").trim();
      if (!prompt) throw new Error("\u63D0\u793A\u8BCD prompt \u4E0D\u80FD\u4E3A\u7A7A\u3002");
      const direction = args?.direction === "forward" ? "forward" : "backward";
      const requestedSegments = clampInteger(args?.segments, 1, MAX_SEGMENTS, 1);
      const secondsPerSegment = clampInteger(
        args?.duration ?? ref(config, "duration", 5),
        MIN_SECONDS,
        MAX_SEGMENT_SECONDS,
        ref(config, "duration", 5)
      );
      let referenceUrl = String(args?.videoUrl ?? "").trim();
      if (!referenceUrl && args?.taskId) {
        const source = await getTask(config, String(args.taskId).trim());
        referenceUrl = extractVideoUrl(source) || "";
        if (!referenceUrl) {
          throw new Error(
            `\u4EFB\u52A1 ${args.taskId} \u6CA1\u6709\u53EF\u7528\u7684\u89C6\u9891\u94FE\u63A5\uFF08\u72B6\u6001\uFF1A${extractStatus(source) || "\u672A\u77E5"}\uFF09\u3002`
          );
        }
      }
      referenceUrl = normalizeReferenceUrl(referenceUrl);
      let cursor = args?.startAt == null ? null : Math.max(0, Math.round(Number(args.startAt)));
      const segments = [];
      let status = "succeeded";
      let error;
      let errorCode;
      for (let index = 1; index <= requestedSegments; index += 1) {
        if (exec?.signal?.aborted) throw abortError();
        const { body, seconds } = buildRequestBody(
          config,
          { ...args, prompt, duration: secondsPerSegment, startAt: cursor },
          referenceUrl
        );
        const final = await runTask(config, body, exec?.signal);
        const taskId = final.taskId;
        segments.push({
          index,
          seconds,
          taskId,
          status: final.status,
          videoUrl: final.videoUrl,
          error: final.errorCode === "content_rejected" ? `${CONTENT_REJECTION_HINT}\u4E0A\u6E38\u8BE6\u60C5\uFF1A${final.error || ""}` : final.error
        });
        if (final.status !== "succeeded" || !final.videoUrl) {
          status = final.status;
          errorCode = final.errorCode;
          error = final.errorCode === "content_rejected" ? `${CONTENT_REJECTION_HINT}\u4E0A\u6E38\u8BE6\u60C5\uFF1A${final.error || ""}` : final.error;
          break;
        }
        referenceUrl = normalizeReferenceUrl(final.videoUrl);
        if (cursor != null) {
          cursor = direction === "forward" ? cursor - seconds : cursor + seconds;
          if (cursor < 0) cursor = null;
        }
      }
      return {
        status,
        error,
        errorCode,
        segments,
        videoUrl: segments.filter((segment) => segment.videoUrl).at(-1)?.videoUrl,
        totalSeconds: segments.filter((segment) => segment.status === "succeeded").length * secondsPerSegment
      };
    }
  };
}
const VIDEO_SEGMENT_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    index: { type: "integer" },
    kind: { type: "string" },
    seconds: { type: "integer" },
    taskId: { type: "string" },
    status: { type: "string" },
    videoUrl: { type: "string" },
    localPath: { type: "string" },
    durationSeconds: { type: "number" },
    error: { type: "string" }
  }
};
function renderVideoResult(value) {
  const {
    status,
    mode,
    segments = [],
    videoUrl,
    videoPath,
    mergeMode,
    segmentsDir,
    note,
    error
  } = value || {};
  const lines = segments.map((segment) => {
    const label = segment.kind === "extend" ? `\u5EF6\u957F +${segment.seconds}s` : `\u76F4\u51FA ${segment.seconds}s`;
    const head = `\u7B2C ${segment.index} \u6BB5\uFF1A${label}\uFF08\u4EFB\u52A1 ${segment.taskId}\uFF09`;
    if (segment.status !== "succeeded" || !segment.videoUrl) {
      return `${head} \u2192 ${segment.status}${segment.error ? `\uFF1A${segment.error}` : ""}`;
    }
    return segment.localPath ? `${head} \u2192 ${segment.videoUrl}
    \u672C\u5730\u6587\u4EF6\uFF1A${segment.localPath}` : `${head} \u2192 ${segment.videoUrl}`;
  });
  const parts = [];
  if (status === "succeeded") {
    parts.push(mode === "extended" ? `\u89C6\u9891\u751F\u6210\u6210\u529F\uFF1A\u5148\u76F4\u51FA ${formatSeconds(segments[0]?.seconds)} \u79D2\uFF0C\u518D\u5EF6\u957F ${segments.length - 1} \u6BB5\u3002` : `\u89C6\u9891\u751F\u6210\u6210\u529F\uFF1A\u4E00\u6B21\u76F4\u51FA ${formatSeconds(segments[0]?.seconds)} \u79D2\uFF0C\u6CA1\u6709\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\uFF0C\u4E0D\u9700\u8981\u5EF6\u957F\u3002`);
  } else if (status === "timeout") {
    parts.push("\u4EFB\u52A1\u4ECD\u5728\u751F\u6210\u4E2D\uFF08\u5DF2\u8D85\u51FA\u5355\u6B21\u7B49\u5F85\u65F6\u95F4\uFF09\u3002");
  } else if (status === "cancelled") {
    parts.push("\u4EFB\u52A1\u5DF2\u53D6\u6D88\u3002");
  } else {
    parts.push(`\u89C6\u9891\u751F\u6210\u5931\u8D25${error ? `\uFF1A${error}` : ""}\u3002`);
  }
  parts.push(...lines);
  if (status === "succeeded") {
    if (videoPath) {
      const how = mergeMode === "copy" ? "\u65E0\u635F\u62FC\u63A5" : mergeMode === "single" ? "\u4E00\u6BB5\u76F4\u51FA\uFF0C\u65E0\u9700\u62FC\u63A5" : mergeMode === "seamless" ? "\u65E0\u7F1D\u62FC\u63A5\uFF08\u5BF9\u9F50\u63A5\u7F1D + \u4EA4\u53C9\u6DE1\u5316\uFF09" : "\u91CD\u7F16\u7801\u62FC\u63A5";
      parts.push(`\u6210\u7247\uFF08\u672C\u5730\u6587\u4EF6\uFF09\uFF1A${videoPath}\uFF08${how}\uFF09`);
    } else if (segmentsDir) {
      parts.push(`\u6CA1\u6709\u5408\u5E76\u6210\u4E00\u6761\uFF1A\u5206\u6BB5\u6587\u4EF6\u90FD\u5728 ${segmentsDir}\uFF08\u6BCF\u6BB5\u8DEF\u5F84\u89C1\u4E0A\u9762\u7684\u5217\u8868\uFF09\u3002`);
    } else {
      parts.push("\u6CA1\u6709\u751F\u6210\u5408\u5E76\u6587\u4EF6\uFF0C\u8BF7\u6309\u4E0A\u9762\u7684\u4E0A\u6E38\u94FE\u63A5\u81EA\u884C\u4E0B\u8F7D\u5206\u6BB5\u3002");
    }
  }
  if (videoUrl) parts.push(`\u6700\u540E\u4E00\u6BB5\u4E0A\u6E38\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF1A${videoUrl}`);
  if (note) parts.push(note);
  if (status === "timeout") {
    parts.push(`\u53EF\u7528 video_status \u67E5\u8BE2\u4EFB\u52A1 ${segments.at(-1)?.taskId || "\uFF08\u672A\u77E5\uFF09"} \u7684\u72B6\u6001\u3002`);
  }
  return [{ type: "text", text: parts.filter(Boolean).join("\n") }];
}
function videoTool(config, deps) {
  return {
    name: "video_generate",
    description: "\u751F\u6210\u4E00\u6BB5\u5B8C\u6574\u89C6\u9891\uFF08\u89C6\u9891\u751F\u6210\u7684\u9996\u9009\u5DE5\u5177\uFF09\uFF0Cduration \u662F\u76EE\u6807\u603B\u79D2\u6570\uFF1A\u4E0D\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\uFF08\u9ED8\u8BA4 15 \u79D2\uFF09\u65F6\u4E00\u6B21\u76F4\u51FA\uFF1B**\u786C\u89C4\u5219\uFF1A\u603B\u65F6\u957F \u2264 \u5355\u6BB5\u4E0A\u9650\u7684\u89C6\u9891\u5FC5\u987B\u4E00\u6B21\u76F4\u51FA\uFF0C\u7981\u6B62\u62C6\u6210\u591A\u6BB5 / \u591A\u955C / \u591A\u6B21\u8C03\u7528\u518D\u62FC\u63A5**\uFF08\u4F8B\u5982\u300C15 \u79D2\u300D\u4E0D\u8BB8\u62C6\u6210 8+7\uFF09\uFF1B\u591A\u955C\u53EA\u5728\u7528\u6237\u660E\u786E\u8981\u6C42\u591A\u955C\u65F6\u624D\u7528\u3002\u66F4\u957F\u65F6\u5148\u76F4\u51FA\u9996\u6BB5\uFF0C\u518D\u628A\u5269\u4F59\u65F6\u957F\u6309 4-15 \u79D2\u5747\u5206\u9010\u6BB5\u7EED\u62CD\uFF08\u9ED8\u8BA4\u5403\u6EE1\u4E0A\u9650\u3001\u6BB5\u6570\u6700\u5C11\uFF09\u2014\u2014\u8FD9\u662F\u540C\u4E00\u4E2A\u955C\u5934\u7684\u7EED\u62CD\u5EF6\u957F\uFF0C\u4E5F\u4E0D\u662F\u591A\u955C\u62FC\u63A5\uFF0C\u6700\u540E\u7528 ffmpeg \u5408\u5E76\u6210\u4E00\u4E2A\u672C\u5730\u6210\u7247\u6587\u4EF6\uFF0C\u9ED8\u8BA4\u843D\u5728\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u7684 metaontic-video/\uFF0C\u6587\u4EF6\u540D\u5F62\u5982 20261027-201530-25s.mp4\u300220 \u79D2\u300125 \u79D2\u8FD9\u7C7B\u76EE\u6807\u4E0D\u7528\u62C6\u6210\u591A\u4E2A\u4EFB\u52A1\uFF1A\u76F4\u63A5\u4F20 duration=20 \u5373\u53EF\uFF0820 \u79D2 \u2192 15+5\uFF0C25 \u79D2 \u2192 15+10\uFF09\u3002\u8FD4\u56DE\u6BCF\u6BB5\u4EFB\u52A1 ID\u3001\u4E0A\u6E38\u94FE\u63A5\u548C\u6210\u7247\u8DEF\u5F84\u3002\u751F\u6210\u901A\u5E38\u9700\u8981\u51E0\u5206\u949F\uFF08\u6BCF\u6BB5\u5355\u72EC\u751F\u6210\uFF09\uFF0C\u5355\u6B21\u8C03\u7528\u8FD4\u56DE timeout \u65F6\u7528 video_status \u7EE7\u7EED\u7B49\uFF0C\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u65B0\u4EFB\u52A1\u3002\u5408\u5E76\u9700\u8981\u672C\u673A\u6709 ffmpeg\u3002\u672C\u673A\u6CA1\u88C5 ffmpeg \u65F6\uFF0C\u63D2\u4EF6\u4F1A**\u5148\u628A\u8FD9\u6B21\u8C03\u7528\u62E6\u56DE\u6765\uFF08\u4E0D\u4F1A\u8C03\u7528\u6A21\u578B\u3001\u4E0D\u4EA7\u751F\u8D39\u7528\uFF09**\uFF0C\u8FD4\u56DE\u7684\u8BF4\u660E\u91CC\u5E26\u7740\u6309\u7CFB\u7EDF\u7ED9\u7684\u5B89\u88C5\u547D\u4EE4 \u2014\u2014\u8FD9\u65F6\u8981\u5728\u5BF9\u8BDD\u6846\u91CC\u548C\u7528\u6237\u786E\u8BA4\uFF1A\u95EE\u4ED6\u8981\u4E0D\u8981\u73B0\u5728\u88C5 ffmpeg\uFF08\u7ED9\u51FA\u4ED6\u7CFB\u7EDF\u7684\u547D\u4EE4\uFF0C\u8BF4\u660E\u88C5\u597D\u91CD\u8DD1\u5C31\u4F1A\u81EA\u52A8\u5408\u5E76\u3001\u5206\u6BB5\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF09\uFF0C\u540C\u610F\u5C31\u7528\u7EC8\u7AEF\u5DE5\u5177\u88C5\u4E0A\uFF08\u5BBF\u4E3B\u4F1A\u8BA9\u4ED6\u786E\u8BA4\uFF09\u5E76 `ffmpeg -version` \u9A8C\u8BC1\uFF0C\u7136\u540E\u6309\u540C\u6837\u7684 duration \u91CD\u53D1\uFF1B\u7528\u6237\u4E0D\u60F3\u88C5\u5C31\u5E26 merge:false \u91CD\u53D1\uFF0C\u63D2\u4EF6\u53EA\u8FD4\u56DE\u5206\u6BB5\u5217\u8868\uFF08\u6BCF\u6BB5\u4E0A\u6E38\u94FE\u63A5 + \u672C\u5730\u6587\u4EF6\uFF09\u3002\u62FF\u5230 ffmpegMissing=true \u7684\u7ED3\u679C\u65F6\u4E5F\u8981\u7167 installHint \u5F15\u5BFC\u5B89\u88C5\uFF0C\u522B\u53EA\u4E22\u4E00\u53E5\u300C\u5DF2\u8DF3\u8FC7\u5408\u5E76\u300D\u3002",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "\u8981\u751F\u6210\u7684\u5185\u5BB9\u3001\u4EBA\u7269\u8BBE\u5B9A\u4E0E\u53F0\u8BCD\uFF1B\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\u65F6\u5B83\u540C\u65F6\u51B3\u5B9A\u540E\u7EED\u6BCF\u6BB5\u7EED\u62CD\u4EC0\u4E48\u3002"
        },
        duration: {
          type: "integer",
          minimum: 4,
          maximum: 285,
          description: "\u76EE\u6807\u603B\u65F6\u957F\uFF08\u79D2\uFF09\u3002\u4E0D\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\uFF08\u9ED8\u8BA4 15\uFF09\u65F6\u5C31\u4E00\u6B21\u76F4\u51FA\uFF08\u6574\u6761\u89C6\u9891\u53EA\u751F\u6210\u4E00\u6B21\uFF0C\u7981\u6B62\u62C6\u6210\u591A\u6BB5/\u591A\u955C\u518D\u62FC\uFF09\uFF1B\u8D85\u8FC7\u5C31\u5148\u76F4\u51FA\u4E0A\u9650\u957F\u5EA6\u518D\u9010\u6BB5\u5EF6\u957F\uFF0C\u6700\u540E\u5408\u5E76\u3002"
        },
        firstFrameUrl: {
          type: "string",
          description: "\u53EF\u9009\uFF1A\u9996\u5E27\u56FE\u516C\u7F51 URL\uFF0C\u4F5C\u4E3A\u751F\u6210\u7684\u9996\u5E27\u53C2\u8003\u3002"
        },
        lastFrameUrl: {
          type: "string",
          description: "\u53EF\u9009\uFF1A\u5C3E\u5E27\u56FE\u516C\u7F51 URL\uFF0C\u4F5C\u4E3A\u751F\u6210\u7684\u5C3E\u5E27\u53C2\u8003\u3002"
        },
        segmentSeconds: {
          type: "integer",
          minimum: 4,
          maximum: 15,
          description: "\u4EC5\u5728\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\u65F6\u624D\u7528\uFF1A\u6BCF\u6BB5\u5EF6\u957F\u591A\u5C11\u79D2\uFF0C\u9ED8\u8BA4\u7528\u914D\u7F6E\u91CC\u7684\u6BCF\u6BB5\u79D2\u6570\uFF1B4-15 \u7684\u6574\u6570\uFF08\u5982 5/8/10/14\uFF09\uFF0C\u9ED8\u8BA4 15\uFF1A\u6309\u4E0A\u9650\u62C6\u3001\u6BB5\u6570\u6700\u5C11\u3002"
        },
        mode: {
          type: "string",
          enum: ["continuous", "closeup"],
          description: "\u5EF6\u957F\u65F6\u7684\u8854\u63A5\u65B9\u5F0F\uFF1Acontinuous=\u540C\u673A\u4F4D\u8FDE\u7EED\uFF08\u9ED8\u8BA4\uFF09\uFF1Bcloseup=\u5728\u53F0\u8BCD\u7ED3\u675F\u5904\u5207\u8FD1\u666F\u3002"
        },
        ratio: {
          type: "string",
          enum: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
          description: "\u753B\u9762\u6BD4\u4F8B\uFF1Bseedance 2.5 \u5EF6\u957F\u65F6\u4F1A\u81EA\u52A8\u6539\u7528 adaptive\u3002"
        },
        generateAudio: {
          type: "boolean",
          description: "\u662F\u5426\u751F\u6210\u97F3\u9891\uFF0C\u9ED8\u8BA4 true\u3002"
        },
        watermark: {
          type: "boolean",
          description: "\u662F\u5426\u6DFB\u52A0\u6C34\u5370\uFF0C\u9ED8\u8BA4 false\u3002"
        },
        merge: {
          type: "boolean",
          description: "\u662F\u5426\u4E0B\u8F7D\u5206\u6BB5\u5E76\u7528 ffmpeg \u5408\u5E76\u6210\u4E00\u4E2A\u672C\u5730\u6210\u7247\uFF0C\u9ED8\u8BA4 true\uFF1B\u672C\u673A\u6CA1\u6709 ffmpeg \u65F6\uFF0C\u957F\u89C6\u9891\u4F1A\u88AB\u5148\u62E6\u56DE\u6765\u8BA9\u7528\u6237\u51B3\u5B9A\u8981\u4E0D\u8981\u88C5\uFF08\u89C1 description\uFF09\uFF1B\u663E\u5F0F\u4F20 false \u8868\u793A\u53EA\u8FD4\u56DE\u5206\u6BB5\u5217\u8868\uFF0C\u4E0D\u518D\u62E6\u3002"
        },
        keepSegments: {
          type: "boolean",
          description: "\u5408\u5E76\u540E\u662F\u5426\u4FDD\u7559\u5206\u6BB5\u539F\u7247\uFF0C\u9ED8\u8BA4 false\uFF08\u5408\u5E76\u6210\u529F\u540E\u5220\u9664\u5206\u6BB5\uFF09\u3002"
        }
      },
      required: ["prompt"]
    },
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string" },
          mode: { type: "string" },
          plannedSeconds: { type: "integer" },
          totalSeconds: { type: "integer" },
          videoUrl: { type: "string" },
          videoPath: { type: "string" },
          merged: { type: "boolean" },
          mergeMode: { type: "string" },
          segmentsDir: { type: "string" },
          ffmpegMissing: { type: "boolean" },
          installHint: { type: "string" },
          note: { type: "string" },
          error: { type: "string" },
          errorCode: { type: "string" },
          segments: { type: "array", items: VIDEO_SEGMENT_OUTPUT_SCHEMA }
        }
      },
      render(_args, value) {
        return renderVideoResult(value);
      }
    },
    timeoutMs: 36e5,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);
      const prompt = String(args?.prompt ?? "").trim();
      if (!prompt) throw new Error("\u63D0\u793A\u8BCD prompt \u4E0D\u80FD\u4E3A\u7A7A\u3002");
      const singleMax = resolveSingleMax(config);
      const segmentSeconds = resolveSegmentSeconds(config, args?.segmentSeconds);
      const total = clampInteger(
        args?.duration ?? singleMax,
        MIN_SECONDS,
        singleMax + (MAX_SEGMENTS - 1) * MAX_SEGMENT_SECONDS,
        singleMax
      );
      const plan = planVideoSegments(total, singleMax, segmentSeconds);
      const plannedTotal = plan.reduce((sum, step) => sum + step.seconds, 0);
      const notes = [];
      if (plannedTotal < total) {
        notes.push(
          `\u76EE\u6807 ${total} \u79D2\u8D85\u8FC7\u5355\u6B21\u6700\u591A ${MAX_SEGMENTS} \u6BB5\u7684\u4E0A\u9650\uFF0C\u672C\u6B21\u6309 ${plannedTotal} \u79D2\u6267\u884C\u3002`
        );
      } else if (plannedTotal > total) {
        notes.push(
          `\u76EE\u6807 ${total} \u79D2\u62C6\u4E0D\u51FA\u5B8C\u5168\u7B49\u957F\u7684\u5206\u6BB5\uFF08\u6BCF\u6BB5 4-15 \u79D2\uFF09\uFF0C\u672C\u6B21\u6309 ${plannedTotal} \u79D2\u6267\u884C\u3002`
        );
      }
      const segments = [];
      let status = "succeeded";
      let error;
      let errorCode;
      let referenceUrl = "";
      let cursor = 0;
      for (const [index, step] of plan.entries()) {
        if (exec?.signal?.aborted) throw abortError();
        const stepArgs = {
          ...args,
          prompt,
          duration: step.seconds,
          // 这条流程是「先直出再向后续拍」，分段的拼接顺序固定为向后延长。
          direction: "backward",
          startAt: step.kind === "extend" ? cursor : void 0
        };
        const { body, seconds } = step.kind === "generate" ? buildGenerationBody(config, stepArgs, step.seconds) : buildRequestBody(config, stepArgs, referenceUrl);
        const final = await runTask(config, body, exec?.signal);
        const detail = final.errorCode === "content_rejected" ? `${CONTENT_REJECTION_HINT}\u4E0A\u6E38\u8BE6\u60C5\uFF1A${final.error || ""}` : final.error;
        segments.push({
          index: index + 1,
          kind: step.kind,
          seconds,
          taskId: final.taskId,
          status: final.status,
          videoUrl: final.videoUrl,
          error: detail
        });
        if (final.status !== "succeeded" || !final.videoUrl) {
          status = final.status;
          errorCode = final.errorCode;
          error = detail;
          break;
        }
        referenceUrl = normalizeReferenceUrl(final.videoUrl);
        cursor += seconds;
      }
      const completed = segments.filter((segment) => segment.status === "succeeded" && segment.videoUrl);
      const result = {
        status,
        mode: plan.length > 1 ? "extended" : "direct",
        plannedSeconds: plannedTotal,
        totalSeconds: completed.reduce((sum, segment) => sum + segment.seconds, 0),
        segments,
        videoUrl: completed.at(-1)?.videoUrl,
        error,
        errorCode
      };
      if (status !== "succeeded" || !completed.length) return result;
      if (args?.merge === false) {
        result.note = [...notes, "\u6309\u53C2\u6570\u8981\u6C42\u53EA\u8FD4\u56DE\u4E0A\u6E38\u94FE\u63A5\uFF0C\u6CA1\u6709\u4E0B\u8F7D\u5408\u5E76\u3002"].join("\n");
        return result;
      }
      const ffmpegReady = completed.length > 1 ? await hasFfmpeg(config, exec?.signal) : true;
      const stamp = fileStamp();
      const outDir = await resolveOutputDir(config, exec, deps);
      const segmentsDir = path.join(outDir, "segments", stamp);
      const files = [];
      let probeWarned = false;
      try {
        for (const [index, segment] of completed.entries()) {
          const dest = path.join(
            segmentsDir,
            `${String(segment.index).padStart(2, "0")}-${segment.kind}.mp4`
          );
          await downloadFile(segment.videoUrl, dest, { signal: exec?.signal });
          segment.localPath = dest;
          const media = await probeMedia(dest, config, exec?.signal);
          if (media?.durationSeconds) {
            segment.durationSeconds = Number(media.durationSeconds.toFixed(2));
            const cumulative = completed.slice(0, index + 1).reduce((sum, item) => sum + item.seconds, 0);
            const tolerance = Math.max(
              CUMULATIVE_TOLERANCE_MIN_SECONDS,
              cumulative * CUMULATIVE_TOLERANCE_RATIO
            );
            const looksCumulative = files.length > 0 && Math.abs(media.durationSeconds - cumulative) <= tolerance && Math.abs(media.durationSeconds - segment.seconds) > tolerance;
            if (looksCumulative) {
              files.length = 0;
              notes.push(
                `\u7B2C ${segment.index} \u6BB5\u5B9E\u6D4B ${formatSeconds(media.durationSeconds)} \u79D2\uFF0C\u63A5\u8FD1\u7D2F\u8BA1\u65F6\u957F ${cumulative} \u79D2\uFF0C\u6309\u300C\u4E0A\u6E38\u8FD4\u56DE\u7684\u662F\u7D2F\u8BA1\u6210\u7247\u300D\u5904\u7406\u3002`
              );
            }
          } else if (!probeWarned) {
            probeWarned = true;
            notes.push("\u6CA1\u6709\u53EF\u7528\u7684 ffprobe\uFF0C\u65E0\u6CD5\u63A2\u6D4B\u5206\u6BB5\u65F6\u957F\uFF0C\u6309\u300C\u6BCF\u6BB5\u90FD\u662F\u589E\u91CF\u7247\u6BB5\u300D\u76F4\u63A5\u62FC\u63A5\u3002");
          }
          files.push(dest);
        }
      } catch (failure) {
        if (failure?.code === "ABORTED") throw failure;
        result.note = [...notes, `\u5206\u6BB5\u5DF2\u751F\u6210\uFF0C\u4F46\u4E0B\u8F7D\u5931\u8D25\uFF1A${failure?.message || failure}`].join("\n");
        return result;
      }
      if (!files.length) return result;
      if (!ffmpegReady && files.length > 1) {
        const guide = ffmpegInstallHint(config);
        result.segmentsDir = segmentsDir;
        result.merged = false;
        result.ffmpegMissing = true;
        result.installHint = guide.hint;
        notes.push(`\u5206\u6BB5\u6587\u4EF6\u90FD\u5DF2\u4E0B\u8F7D\u5230 ${segmentsDir}\u3002`);
        notes.push(guide.hint);
        result.note = notes.join("\n");
        return result;
      }
      const finalPath = path.join(outDir, `${stamp}-${plannedTotal}s.mp4`);
      try {
        if (files.length === 1) {
          await rm(finalPath, { force: true });
          await rename(files[0], finalPath);
          result.mergeMode = "single";
        } else {
          const merged = await mergeClips(config, files, finalPath, { signal: exec?.signal });
          result.mergeMode = merged.mode;
          if (merged.trimmed?.length) {
            notes.push(
              `\u7B2C ${merged.trimmed.map((item) => item.index).join("\u3001")} \u6BB5\u7684\u97F3\u9891\u6BD4\u89C6\u9891\u957F\uFF08\u6700\u957F ${Math.max(...merged.trimmed.map((item) => item.paddingSeconds))} \u79D2\uFF09\uFF0C\u5DF2\u88C1\u9F50\u540E\u518D\u62FC\u63A5\uFF0C\u907F\u514D\u63A5\u7F1D\u5904\u7F3A\u4E00\u5C0F\u6BB5\u753B\u9762\u3002`
            );
          }
          if (merged.mode === "seamless") {
            const fixed = (merged.seams || []).filter((seam) => Math.abs(seam.lumaDelta) >= 0.5 || Math.abs(seam.audioGainDb) >= 0.2).map((seam) => `\u7B2C ${seam.index} \u6BB5\u63A5\u7F1D\uFF1A\u753B\u9762 ${seam.lumaDelta >= 0 ? "+" : ""}${seam.lumaDelta.toFixed(1)} \u7EA7\u3001\u97F3\u91CF ${seam.audioGainDb >= 0 ? "+" : ""}${seam.audioGainDb.toFixed(1)} dB`);
            notes.push(
              `\u5408\u5E76\u65B9\u5F0F\uFF1A\u65E0\u7F1D\u62FC\u63A5\uFF08\u63A5\u7F1D ${merged.fade} \u79D2\u4EA4\u53C9\u6DE1\u5316${fixed.length ? `\uFF0C\u5E76\u5DF2\u5BF9\u9F50${fixed.join("\uFF1B")}` : ""}\uFF09\u3002`
            );
          }
        }
        result.merged = true;
        result.videoPath = finalPath;
      } catch (failure) {
        if (failure?.code === "ABORTED") throw failure;
        let reason = `\u5206\u6BB5\u5DF2\u751F\u6210\uFF0C\u4F46\u5408\u5E76\u5931\u8D25\uFF1A${failure?.message || failure}`;
        if (failure?.code === "ffmpeg_missing") {
          const guide = ffmpegInstallHint(config);
          result.ffmpegMissing = true;
          result.installHint = guide.hint;
          reason = guide.hint;
        }
        result.segmentsDir = segmentsDir;
        result.note = [...notes, reason].join("\n");
        return result;
      }
      if (args?.keepSegments ?? ref(config, "keepSegments", false)) {
        result.segmentsDir = segmentsDir;
      } else {
        await rm(segmentsDir, { recursive: true, force: true });
      }
      if (notes.length) result.note = notes.join("\n");
      return result;
    }
  };
}
function setupTool(config) {
  return {
    name: "video_setup",
    description: "\u68C0\u67E5\u672C\u673A\u6709\u6CA1\u6709 ffmpeg\uFF08\u751F\u6210\u8D85\u8FC7 15 \u79D2\u7684\u89C6\u9891\u65F6\uFF0C\u5408\u5E76\u6210\u4E00\u6761\u8981\u7528\u5B83\uFF09\uFF0C\u7F3A\u4E86\u5C31\u88C5\u3002install=true \u8868\u793A\u300C\u7528\u6237\u5DF2\u7ECF\u540C\u610F\u5B89\u88C5\u300D\uFF0C\u63D2\u4EF6\u4F1A\u6267\u884C\u5B89\u88C5\u547D\u4EE4\u5E76\u9A8C\u8BC1\u2014\u2014\u547D\u4EE4\u4F1A\u5148\u62FF\u7ED9\u7528\u6237\u786E\u8BA4\uFF0C\u7528\u6237\u70B9\u4E86\u5141\u8BB8\u624D\u6267\u884C\u3002\u88C5\u4E0D\u4E0A\uFF08\u4F8B\u5982\u672C\u673A\u8FDE\u5305\u7BA1\u7406\u5668\u90FD\u6CA1\u6709\uFF09\u4F1A\u8FD4\u56DE\u624B\u52A8\u5B89\u88C5\u6B65\u9AA4\u548C\u4E00\u4E2A nextStep\u3002\u7528\u6237\u8BF4\u300C\u5E2E\u6211\u88C5 ffmpeg\u300D\u300C\u68C0\u67E5\u4E00\u4E0B\u73AF\u5883\u300D\u65F6\u7528\u5B83\uFF1B\u53EA\u6709\u786E\u5B9E\u8981\u88C5\u624D\u4F20 install=true\u3002",
    parameters: {
      type: "object",
      properties: {
        install: {
          type: "boolean",
          description: "\u662F\u5426\u6267\u884C\u5B89\u88C5\uFF0C\u9ED8\u8BA4 false\uFF08\u53EA\u68C0\u67E5\u3001\u53EA\u6C47\u62A5\uFF0C\u4E0D\u52A8\u672C\u673A\uFF09\u3002"
        },
        target: {
          type: "string",
          enum: ["ffmpeg", "package-manager"],
          description: "install=true \u65F6\u88C5\u4EC0\u4E48\uFF1Affmpeg\uFF08\u9ED8\u8BA4\uFF09\u6216\u5148\u88C5\u5305\u7BA1\u7406\u5668\uFF08macOS \u7684 Homebrew\uFF09\u3002"
        }
      }
    },
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "string" },
          os: { type: "string" },
          ffmpegVersion: { type: "string" },
          ffmpegPath: { type: "string" },
          ffprobeVersion: { type: "string" },
          installCommand: { type: "string" },
          manualSteps: { type: "array", items: { type: "string" } },
          output: { type: "string" },
          note: { type: "string" }
        }
      },
      render(_args, value) {
        const {
          status,
          os,
          ffmpegVersion,
          ffmpegPath,
          ffprobeVersion,
          installCommand,
          output,
          note
        } = value || {};
        const lines = [];
        if (status === "ready") {
          lines.push("\u672C\u673A\u73AF\u5883\u6CA1\u95EE\u9898\uFF1Affmpeg \u5DF2\u7ECF\u80FD\u7528\u4E86\uFF0C\u957F\u89C6\u9891\u53EF\u4EE5\u76F4\u63A5\u5408\u5E76\u6210\u4E00\u6761\u3002");
        } else if (status === "installed") {
          lines.push("ffmpeg \u88C5\u597D\u4E86\uFF0C\u957F\u89C6\u9891\u73B0\u5728\u53EF\u4EE5\u5408\u5E76\u6210\u4E00\u6761\u3002");
        } else if (status === "missing") {
          lines.push("\u672C\u673A\u8FD8\u6CA1\u6709 ffmpeg\uFF1A\u751F\u6210\u8D85\u8FC7 15 \u79D2\u7684\u89C6\u9891\u65F6\u53EA\u80FD\u7ED9\u5206\u6BB5\uFF0C\u6CA1\u6CD5\u5408\u5E76\u6210\u4E00\u6761\u3002");
          lines.push(`\u88C5\u4E00\u4E0B\u5C31\u597D\uFF08${os || "\u5F53\u524D\u7CFB\u7EDF"}\uFF09\uFF1A${installCommand || ""}`);
          lines.push("\u7528\u6237\u540C\u610F\u7684\u8BDD\uFF0C\u6211\u53EF\u4EE5\u7528 video_setup\uFF08install=true\uFF09\u76F4\u63A5\u5E2E\u4ED6\u88C5\u3002");
        } else if (status === "failed") {
          lines.push("ffmpeg \u6CA1\u88C5\u6210\u529F\uFF0C\u5F97\u624B\u52A8\u88C5\u4E00\u4E0B\u3002");
          lines.push(`\u624B\u52A8\u6B65\u9AA4\uFF1A${note || installCommand || ""}`);
        } else {
          lines.push(`\u73AF\u5883\u68C0\u67E5\u7ED3\u679C\uFF1A${status || "\u672A\u77E5"}\u3002`);
        }
        if (ffmpegVersion) lines.push(`ffmpeg\uFF1A${ffmpegVersion}`);
        if (ffmpegPath) lines.push(`ffmpeg \u8DEF\u5F84\uFF1A${ffmpegPath}\uFF08\u53EF\u4EE5\u586B\u8FDB\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\uFF09`);
        if (ffprobeVersion) lines.push(`ffprobe\uFF1A${ffprobeVersion}`);
        if (status !== "ready" && status !== "installed" && installCommand && status === "failed") {
          lines.push(`\u547D\u4EE4\uFF1A${installCommand}`);
        }
        if (output) lines.push(`\u5B89\u88C5\u8F93\u51FA\uFF08\u672B\u5C3E\uFF09\uFF1A${output}`);
        if (note) lines.push(note);
        return [{ type: "text", text: lines.filter(Boolean).join("\n") }];
      }
    },
    // 装 ffmpeg 可能要下载几十 MB，给足时间；装完还要再验证一次。
    timeoutMs: 20 * 60 * 1e3,
    isConcurrencySafe() {
      return false;
    },
    async execute(args, exec) {
      const signal = exec?.signal;
      const binary = resolveBinary(config, "ffmpegBinary", "ffmpeg");
      const probeBinary = resolveBinary(config, "ffprobeBinary", "ffprobe");
      const { os, installs, bootstrap } = ffmpegInstallOptions();
      const wantsInstall = args?.install === true;
      const target = String(args?.target || "ffmpeg");
      const manualSteps = installs.map((item) => `${item.label}\uFF1A${item.command}`);
      const installCommand = target === "package-manager" && bootstrap ? bootstrap.command : installs[0].command;
      const ffmpegVersion = await probeBinaryVersion(binary, signal);
      const ffprobeVersion = await probeBinaryVersion(probeBinary, signal);
      const base = { os, installCommand, manualSteps, ffmpegVersion, ffprobeVersion };
      if (ffmpegVersion) {
        const note = ffprobeVersion ? "ffmpeg \u4E0E ffprobe \u90FD\u53EF\u7528\uFF0C\u957F\u89C6\u9891\u4F1A\u6B63\u5E38\u5408\u5E76\u6210\u4E00\u6761\u3002" : "ffmpeg \u53EF\u7528\uFF1B\u6CA1\u6709 ffprobe\uFF0C\u5206\u6BB5\u65F6\u957F\u63A2\u6D4B\u4F1A\u88AB\u8DF3\u8FC7\uFF08\u4E0D\u5F71\u54CD\u5408\u5E76\uFF09\u3002";
        return { status: "ready", ...base, ffmpegPath: binary, note };
      }
      if (!wantsInstall) {
        return {
          status: "missing",
          ...base,
          note: `\u672C\u673A ${binary} \u8DD1\u4E0D\u8D77\u6765\u3002\u7528\u6237\u540C\u610F\u540E\u53EF\u4EE5 install=true \u8BA9\u6211\u6765\u88C5\uFF1B\u4E5F\u6709\u53EF\u80FD\u662F\u8DEF\u5F84\u4E0D\u5BF9\uFF1A\u5DF2\u7ECF\u88C5\u8FC7\u5C31\u628A\u7EDD\u5BF9\u8DEF\u5F84\u586B\u8FDB\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u3002`
        };
      }
      let output = "";
      try {
        const shellCommand = target === "package-manager" && bootstrap ? bootstrap.command : target === "package-manager" && !bootstrap ? null : installs[0].command;
        if (!shellCommand) {
          return {
            status: "failed",
            ...base,
            note: `${os} \u4E0D\u9700\u8981\u53E6\u5916\u88C5\u5305\u7BA1\u7406\u5668\uFF0C\u76F4\u63A5\u7528\u7CFB\u7EDF\u81EA\u5E26\u7684\u5305\u7BA1\u7406\u5668\u88C5 ffmpeg \u5C31\u884C\u3002`
          };
        }
        const result = await runProcess(shellCommand, [], {
          signal,
          shell: true,
          timeoutMs: 18 * 60 * 1e3
        });
        output = tail(String(result.stdout || "") + String(result.stderr || ""), 800);
      } catch (error) {
        output = tail(error?.message || String(error), 800);
      }
      const afterVersion = await probeBinaryVersion(binary, signal);
      if (afterVersion) {
        return {
          status: "installed",
          ...base,
          ffmpegVersion: afterVersion,
          ffmpegPath: binary,
          output,
          note: "\u88C5\u597D\u4E86\uFF1A\u76F4\u63A5\u91CD\u8DD1\u521A\u624D\u90A3\u6B21\u751F\u6210\u5C31\u4F1A\u81EA\u52A8\u5408\u5E76\u6210\u4E00\u6761\uFF08\u5206\u6BB5\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF09\u3002"
        };
      }
      const found = await findInstalledFfmpeg(signal);
      if (found) {
        return {
          status: "installed",
          ...base,
          ffmpegVersion: await probeBinaryVersion(found, signal),
          ffmpegPath: found,
          output,
          note: `\u88C5\u597D\u4E86\uFF0C\u4F46\u6CA1\u8FDB PATH\uFF1A\u628A ${found} \u586B\u8FDB\u63D2\u4EF6\u8BBE\u7F6E\u91CC\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\uFF08\u6216\u8005\u91CD\u5F00\u4E00\u4E2A\u7EC8\u7AEF\u518D\u91CD\u8DD1\u4E00\u6B21\u751F\u6210\uFF09\u3002`
        };
      }
      const needsBootstrap = Boolean(bootstrap) && !ffmpegVersion && /command not found|not found|不是内部或外部命令|未找到/i.test(output);
      return {
        status: "failed",
        ...base,
        installCommand: needsBootstrap ? bootstrap.command : installs[0].command,
        manualSteps: needsBootstrap ? [`\u5148\u88C5\u5305\u7BA1\u7406\u5668\uFF1A${bootstrap.command}`, ...manualSteps] : manualSteps,
        output,
        note: needsBootstrap ? `\u672C\u673A\u6CA1\u6709 ${os} \u7684\u5305\u7BA1\u7406\u5668\uFF0C\u5F97\u5148\u88C5\u5B83\uFF1A${bootstrap.command}\uFF1B\u88C5\u597D\u4E4B\u540E\u518D\u88C5 ffmpeg\u3002\u8FD9\u4E24\u6B65\u90FD\u53EF\u4EE5\u8BA9\u6211\u6765\u505A \u2014\u2014 \u8BF4\u4E00\u58F0\u5C31\u884C\u3002` : "\u5B89\u88C5\u547D\u4EE4\u6CA1\u6210\u529F\uFF08\u53EF\u80FD\u662F\u6CA1\u6743\u9650\u3001\u6CA1\u8054\u7F51\u6216\u88AB\u5B89\u5168\u7B56\u7565\u62E6\u4E0B\uFF09\u3002\u4E0A\u9762\u662F\u624B\u52A8\u6B65\u9AA4\uFF0C\u7167\u7740\u5728\u7EC8\u7AEF\u91CC\u8DD1\u4E00\u904D\u5373\u53EF\u3002"
      };
    }
  };
}
function taskTool(config) {
  return {
    name: "video_status",
    description: "\u6309\u4EFB\u52A1 ID \u67E5\u8BE2 Seedance \u89C6\u9891\u4EFB\u52A1\uFF08\u751F\u6210\u3001\u5EF6\u957F\u4E0E\u5408\u5E76\uFF09\u7684\u72B6\u6001\uFF1B\u4EFB\u52A1\u5B8C\u6210\uFF08status \u4E3A succeeded\uFF09\u65F6\u8FD4\u56DE\u89C6\u9891\u4E0B\u8F7D\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\u3002video_generate / video_extend \u8FD4\u56DE timeout \u65F6\uFF0C\u7528\u5B83\u4EEC\u7ED9\u51FA\u7684 taskId \u5728\u8FD9\u91CC\u7EE7\u7EED\u7B49\uFF0C\u4E0D\u8981\u5728\u540C\u4E00\u4E2A\u4F1A\u8BDD\u91CC\u91CD\u590D\u63D0\u4EA4\u540C\u4E00\u6BB5\u4EFB\u52A1\u3002",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "\u7531 video_generate / video_extend \u8FD4\u56DE\u7684\u4EFB\u52A1 ID\u3002"
        }
      },
      required: ["taskId"]
    },
    output: {
      schema: {
        type: "object",
        properties: {
          taskId: { type: "string" },
          status: { type: "string" },
          model: { type: "string" },
          videoUrl: { type: "string" },
          error: { type: "string" },
          errorCode: { type: "string" }
        }
      },
      render(_args, value) {
        const { taskId, status, videoUrl, error, model } = value || {};
        if (status === "succeeded") {
          return [
            {
              type: "text",
              text: [
                "\u5EF6\u957F\u4EFB\u52A1\u5DF2\u5B8C\u6210\u3002",
                `\u4EFB\u52A1 ID\uFF1A${taskId}`,
                `\u6A21\u578B\uFF1A${model || "-"}`,
                `\u89C6\u9891\u94FE\u63A5\uFF08\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF1A${videoUrl || "\uFF08\u65E0\uFF09"}`
              ].join("\n")
            }
          ];
        }
        if (status === "failed") {
          return [{ type: "text", text: `\u5EF6\u957F\u4EFB\u52A1\u5931\u8D25\uFF08\u4EFB\u52A1 ${taskId}\uFF09\uFF1A${error || "\u672A\u77E5\u9519\u8BEF"}` }];
        }
        return [{ type: "text", text: `\u4EFB\u52A1 ${taskId} \u5F53\u524D\u72B6\u6001\uFF1A${status || "\u672A\u77E5"}\u3002` }];
      }
    },
    timeoutMs: 6e4,
    isConcurrencySafe() {
      return true;
    },
    async execute(args, exec) {
      const apiKey = resolveApiKey(config);
      assertConfigured(config, apiKey);
      const taskId = String(args?.taskId ?? "").trim();
      if (!taskId) throw new Error("taskId \u4E0D\u80FD\u4E3A\u7A7A\u3002");
      const task = await getTask(config, taskId);
      const status = extractStatus(task) || "unknown";
      const model = findKey(task, ["model"]) || resolveModel(config);
      const videoUrl = extractVideoUrl(task);
      if (SUCCESS_STATES.has(status) && videoUrl) {
        return { taskId, status: "succeeded", model, videoUrl };
      }
      if (FAILED_STATES.has(status)) {
        const detail = findKey(task, ["error", "fail_reason", "message", "detail"]);
        const classified = classifyError(
          400,
          typeof detail === "string" ? { message: detail } : detail || task
        );
        const raw = status === "cancelled" || status === "canceled" ? "cancelled" : "failed";
        return {
          taskId,
          status: raw,
          model,
          errorCode: classified.code,
          error: isContentRejection(classified.message) ? `${CONTENT_REJECTION_HINT}\u4E0A\u6E38\u8BE6\u60C5\uFF1A${classified.message}` : classified.message
        };
      }
      return { taskId, status, model, videoUrl };
    }
  };
}
const CONFIG_FIELDS = [
  "apiKey",
  "baseUrl",
  "submitPath",
  "queryPath",
  "model",
  "duration",
  "singleMaxSeconds",
  "mode",
  "ratio",
  "generateAudio",
  "watermark",
  "extraParams",
  "pollIntervalMs",
  "maxWaitMs",
  "mergeMode",
  "outputDir",
  "keepSegments",
  "ffmpegBinary",
  "ffprobeBinary",
  "registerUser",
  "registerEmail",
  "registerApi",
  "deviceId",
  "estimateGroupRatio"
];
const READ_ONLY_CONFIG_FIELDS = /* @__PURE__ */ new Set(["apiKey", "keyOrigin", "deviceId", "deviceSecret"]);
function maskSecrets(view) {
  return {
    ...view,
    apiKey: view.apiKey ? "\uFF08\u5DF2\u914D\u7F6E\uFF09" : "",
    deviceSecret: view.deviceSecret ? "\uFF08\u5DF2\u914D\u7F6E\uFF09" : ""
  };
}
function configView(config) {
  const stored = {};
  for (const key of CONFIG_FIELDS) stored[key] = ref(config, key, void 0);
  return {
    stored: maskSecrets(stored),
    effective: {
      baseUrl: resolveBaseUrl(config),
      submitPath: resolveSubmitPath(config),
      queryPath: String(ref(config, "queryPath", "")).trim() || relayPreset().queryPath,
      model: resolveModel(config),
      // 密钥只有一种合法来源：设置页「登录」时服务端下发
      apiKeySource: ref(config, "apiKey", "") ? isServerIssuedKey(config) ? "register" : "unverified" : "missing"
    }
  };
}
async function writeProfileConfig(settings, config, patch) {
  const entryId = String(ref(config, "entryId", "metaontic-video")).trim();
  const descriptors = settings.describe({ redactSecrets: true });
  const entry = descriptors.find((item) => item.ns === entryId);
  if (!entry) {
    throw new Error(
      `profile patch \u91CC\u6CA1\u6709\u53EF\u7F16\u8F91\u7684 ${entryId} \u6761\u76EE\uFF0C\u65E0\u6CD5\u5199\u56DE\u914D\u7F6E\u3002\u8BF7\u5148\u5728 profile \u7684 cordis.patch.yml \u91CC\u52A0\u4E00\u6761\u8986\u76D6\u9879\uFF1A
- id: ${entryId}
  name: 'metaontic-video'
  config: { apiKey: 'sk-...', baseUrl: '...', model: '...' }
\uFF08\u4E5F\u53EF\u4EE5\u8BA9 Agent \u4EE3\u5199\u8FD9\u4E00\u6761\u3002\uFF09`
    );
  }
  await settings.update(entryId, patch, entry.revision);
  return entryId;
}
function configTool(config, settings) {
  return {
    name: "video_config",
    description: "\u8BFB\u53D6\u6216\u4FEE\u6539 MetaOnticVideo \u63D2\u4EF6\u81EA\u5DF1\u7684\u914D\u7F6E\uFF08baseUrl\u3001submitPath\u3001queryPath\u3001model\u3001duration\u3001singleMaxSeconds\u3001mode\u3001ratio\u3001generateAudio\u3001watermark\u3001extraParams\u3001pollIntervalMs\u3001maxWaitMs\u3001mergeMode\u3001outputDir\u3001keepSegments\u3001ffmpegBinary\u3001ffprobeBinary\u3001registerEmail\u3001registerApi\u3001estimateGroupRatio\uFF09\u3002apiKey \u53EA\u80FD\u7531\u8BBE\u7F6E\u9875\u300C\u767B\u5F55\u300D\u65F6\u670D\u52A1\u7AEF\u4E0B\u53D1\uFF0C\u8FD9\u91CC\u53EA\u80FD\u770B\u3001\u4E0D\u80FD\u6539\uFF1B\u7528\u6237\u8981\u6362 Key \u5C31\u8BA9\u4ED6\u53BB\u63D2\u4EF6\u8BE6\u60C5\u9875\u70B9\u300C\u767B\u5F55\u300D\u3002\u6539\u52A8\u5199\u8FDB profile \u7684 cordis.patch.yml\uFF0C\u5BBF\u4E3B\u91CD\u8F7D\u540E\u751F\u6548\u3002\u7528\u6237\u8BF4\u300C\u628A\u4E2D\u8F6C\u7AD9\u5730\u5740/\u6A21\u578B/\u65F6\u957F\u6539\u6210 X\u300D\u65F6\u7528 action=set\uFF0C\u770B\u5F53\u524D\u503C\u7528 action=get\uFF1Bduration \u662F\u6BCF\u6BB5\u65B0\u589E\u79D2\u6570\u4E0A\u9650\uFF084-15\uFF0C\u9ED8\u8BA4 15\u3001\u6BB5\u6570\u6700\u5C11\uFF09\uFF0CsingleMaxSeconds \u662F\u5355\u6B21\u76F4\u51FA\u4E0A\u9650\uFF08\u9ED8\u8BA4 15\uFF09\u3002",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "set"],
          description: "get=\u67E5\u770B\u5F53\u524D\u914D\u7F6E\uFF1Bset=\u4FEE\u6539\u914D\u7F6E\uFF08\u81F3\u5C11\u7ED9\u4E00\u4E2A\u8981\u6539\u7684\u5B57\u6BB5\uFF09\u3002"
        },
        baseUrl: { type: "string", description: "\u57FA\u7840\u5730\u5740\uFF0C\u4F8B\u5982 https://ai.bileego.com\uFF08\u4E2D\u8F6C\u7AD9\uFF09\u6216\u5B98\u65B9\u5730\u5740\u3002" },
        registerEmail: { type: "string", description: "\u9886 Key \u7528\u7684\u90AE\u7BB1\uFF08\u8D26\u53F7\uFF09\uFF1B\u6CE8\u518C\u8981\u90AE\u7BB1\u9A8C\u8BC1\u7801\uFF0C\u4E00\u4E2A\u90AE\u7BB1\u53EA\u53D1\u4E00\u628A\u3002" },
        registerApi: { type: "string", description: "\u63D2\u4EF6\u670D\u52A1\u5730\u5740\uFF08\u9886 Key / \u67E5\u989D\u5EA6 / \u4F7F\u7528\u8BB0\u5F55\uFF09\uFF1B\u7559\u7A7A\u7528\u5185\u7F6E\u57DF\u540D\u3002" },
        estimateGroupRatio: { type: "number", description: "\u9884\u4F30\u8D39\u7528\u7528\u7684\u5206\u7EC4\u6298\u6263\uFF08\u4E2D\u8F6C\u7AD9 group_ratio\uFF1A\u9ED8\u8BA4 0.8\uFF09\u3002" },
        submitPath: { type: "string", description: "\u521B\u5EFA\u4EFB\u52A1\u8DEF\u5F84\uFF0C\u4F8B\u5982 /doubao/api/v3/contents/generations/tasks\u3002" },
        queryPath: { type: "string", description: "\u67E5\u8BE2\u4EFB\u52A1\u8DEF\u5F84\uFF0C{task_id} \u4F1A\u88AB\u66FF\u6362\u3002" },
        model: { type: "string", description: "\u6A21\u578B ID\uFF0C\u4F8B\u5982 doubao-seedance-2-0-mini-260615\u3002" },
        duration: { type: "integer", minimum: 4, maximum: 15, description: "\u6BCF\u6BB5\u65B0\u589E\u79D2\u6570\u4E0A\u9650\uFF084-15 \u7684\u6574\u6570\uFF0C\u9ED8\u8BA4 15\u3001\u6BB5\u6570\u6700\u5C11\uFF09\u3002" },
        mode: { type: "string", enum: ["continuous", "closeup"], description: "\u7EED\u62CD\u65B9\u5F0F\u3002" },
        ratio: {
          type: "string",
          enum: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
          description: "\u753B\u9762\u6BD4\u4F8B\u3002"
        },
        generateAudio: { type: "boolean", description: "\u662F\u5426\u751F\u6210\u97F3\u9891\u3002" },
        watermark: { type: "boolean", description: "\u662F\u5426\u52A0\u6C34\u5370\u3002" },
        extraParams: { type: "string", description: "\u989D\u5916\u8BF7\u6C42\u53C2\u6570\uFF08JSON \u5BF9\u8C61\u5B57\u7B26\u4E32\uFF09\u3002" },
        pollIntervalMs: { type: "integer", minimum: 1e3, description: "\u8F6E\u8BE2\u95F4\u9694\uFF08\u6BEB\u79D2\uFF09\u3002" },
        maxWaitMs: { type: "integer", minimum: 1e3, description: "\u5355\u6B21\u8C03\u7528\u6700\u957F\u7B49\u5F85\uFF08\u6BEB\u79D2\uFF09\u3002" },
        singleMaxSeconds: {
          type: "integer",
          minimum: 4,
          maximum: 15,
          description: "\u5355\u6B21\u76F4\u51FA\u4E0A\u9650\uFF08\u79D2\uFF09\uFF1A\u4E0D\u8D85\u8FC7\u5B83\u4E00\u6B21\u751F\u6210\uFF0C\u8D85\u8FC7\u5B83\u624D\u5206\u6BB5\u5EF6\u957F\u3002"
        },
        mergeMode: {
          type: "string",
          enum: ["seamless", "copy", "reencode"],
          description: "\u5408\u5E76\u65B9\u5F0F\uFF1Aseamless=\u6309\u63A5\u7F1D\u5B9E\u6D4B\u628A\u540E\u6BB5\u7684\u4EAE\u5EA6/\u97F3\u91CF\u5BF9\u9F50\uFF0C\u518D\u7528 0.25 \u79D2\u4EA4\u53C9\u6DE1\u5316\u63A5\u4E0A\uFF08\u9ED8\u8BA4\uFF0C\u63A5\u7F1D\u770B\u4E0D\u51FA\u6362\u6BB5\uFF09\uFF1Bcopy=\u65E0\u635F\u62FC\u63A5\uFF08\u5FEB\uFF0C\u4F46\u63A5\u7F1D\u662F\u786C\u5207\uFF09\uFF1Breencode=\u7EDF\u4E00\u91CD\u7F16\u7801\u3002"
        },
        outputDir: { type: "string", description: "\u6210\u7247\u8F93\u51FA\u76EE\u5F55\uFF1B\u7559\u7A7A\u7528\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u7684 metaontic-video/\u3002" },
        keepSegments: { type: "boolean", description: "\u5408\u5E76\u540E\u662F\u5426\u4FDD\u7559\u5206\u6BB5\u539F\u7247\u3002" },
        ffmpegBinary: { type: "string", description: "ffmpeg \u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u3002" },
        ffprobeBinary: { type: "string", description: "ffprobe \u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u3002" }
      },
      required: ["action"]
    },
    output: {
      schema: {
        type: "object",
        properties: {
          action: { type: "string" },
          entryId: { type: "string" },
          editable: { type: "boolean" },
          patchPath: { type: "string" },
          stored: { type: "object" },
          effective: { type: "object" },
          patch: { type: "object" },
          error: { type: "string" }
        }
      },
      render(_args, value) {
        const { action, stored, effective, entryId, patchPath, patch, error } = value || {};
        if (error) return [{ type: "text", text: error }];
        const lines = [
          action === "set" ? `\u5DF2\u5199\u5165 profile patch\uFF08\u6761\u76EE ${entryId}\uFF09` : "\u5F53\u524D\u914D\u7F6E\uFF1A",
          ...Object.entries(stored || {}).filter(([, field]) => field !== void 0 && field !== "").map(([key, field]) => `  ${key}: ${typeof field === "object" ? JSON.stringify(field) : field}`),
          `\u751F\u6548\u503C\uFF1AbaseUrl=${effective?.baseUrl} model=${effective?.model}`,
          `  submitPath=${effective?.submitPath}`,
          `  apiKey \u6765\u6E90\uFF1A${{
            register: "\u670D\u52A1\u7AEF\u4E0B\u53D1\uFF08\u767B\u5F55\u5199\u5165\uFF09",
            unverified: "\u975E\u670D\u52A1\u7AEF\u4E0B\u53D1\u2014\u2014\u8C03\u7528\u4F1A\u88AB\u62D2\u7EDD\uFF0C\u8BF7\u5230\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D",
            missing: "\u672A\u914D\u7F6E\u2014\u2014\u8BF7\u5230\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D"
          }[effective?.apiKeySource] || effective?.apiKeySource}`,
          patchPath ? `\u914D\u7F6E\u6587\u4EF6\uFF1A${patchPath}` : "",
          patch && Object.keys(patch).length ? "\u6539\u52A8\u4F1A\u5728\u5BBF\u4E3B\u91CD\u8F7D\u914D\u7F6E\u540E\u751F\u6548\u3002" : ""
        ].filter(Boolean);
        return [{ type: "text", text: lines.join("\n") }];
      }
    },
    timeoutMs: 3e4,
    isConcurrencySafe() {
      return false;
    },
    async execute(args) {
      const action = args?.action;
      const view = configView(config);
      const patchPath = settings?.documentPath;
      if (action === "get") {
        return { action, ...view, editable: Boolean(settings), patchPath };
      }
      if (action !== "set") {
        throw new Error("action \u53EA\u80FD\u662F get \u6216 set\u3002");
      }
      const readonly = Object.keys(args || {}).filter((key) => READ_ONLY_CONFIG_FIELDS.has(key));
      if (readonly.length) {
        throw new Error(
          `${readonly.join("\u3001")} \u7531\u670D\u52A1\u7AEF\u5728\u300C\u767B\u5F55\u300D\u65F6\u4E0B\u53D1\uFF0C\u4E0D\u80FD\u624B\u52A8\u6539\uFF1B\u8981\u6362 Key \u8BF7\u5728\u300C\u63D2\u4EF6 \u2192 \u5DF2\u5B89\u88C5\u63D2\u4EF6 \u2192 MetaOnticVideo \u2192 \u67E5\u770B\u300D\u70B9\u300C\u767B\u5F55\u300D\u91CD\u65B0\u9886\u53D6\u3002`
        );
      }
      const patch = {};
      for (const key of CONFIG_FIELDS) {
        if (args?.[key] !== void 0 && !READ_ONLY_CONFIG_FIELDS.has(key)) patch[key] = args[key];
      }
      if (!Object.keys(patch).length) {
        throw new Error("set \u9700\u8981\u81F3\u5C11\u4E00\u4E2A\u8981\u4FEE\u6539\u7684\u5B57\u6BB5\uFF08\u5982 baseUrl\u3001model\u3001duration\uFF09\u3002");
      }
      if (!settings) {
        throw new Error(
          "\u5BBF\u4E3B\u6CA1\u6709\u63D0\u4F9B settings \u670D\u52A1\uFF0C\u65E0\u6CD5\u5199\u56DE\u914D\u7F6E\u3002\u8BF7\u624B\u52A8\u7F16\u8F91 profile \u7684 cordis.patch.yml \u91CC metaontic-video \u90A3\u4E00\u6761\u7684 config\uFF08\u89C1\u63D2\u4EF6 README\uFF09\u3002"
        );
      }
      const entryId = await writeProfileConfig(settings, config, patch);
      return { action, entryId, patchPath, patch, ...view };
    }
  };
}
function buildPromptGuidance(config) {
  const singleMax = resolveSingleMax(config);
  const segmentSeconds = resolveSegmentSeconds(config);
  return [
    "MetaOnticVideo\uFF08Seedance \u89C6\u9891\u751F\u6210\u63D2\u4EF6\uFF09\uFF1A\u9700\u8981\u751F\u6210\u89C6\u9891\u3001\u7ED9\u89C6\u9891\u52A0\u957F\u65F6\u4F18\u5148\u7528\u5B83\uFF1B\u7528\u6237\u53EA\u8981\u8BF4\u60F3\u8981\u591A\u957F\uFF08duration\uFF09\uFF0C\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\u7684\u90E8\u5206\u63D2\u4EF6\u81EA\u5DF1\u5206\u6BB5\u7EED\u62CD\u518D\u5408\u5E76\uFF0C\u4E0D\u7528\u7528\u6237\u81EA\u5DF1\u62C6\u4EFB\u52A1\u3002",
    `\xB7 \u65B0\u89C6\u9891\u7528 video_generate\uFF0Cduration \u4F20\u76EE\u6807\u603B\u79D2\u6570\u3002**\u786C\u89C4\u5219\uFF1A\u603B\u65F6\u957F \u2264 ${singleMax} \u79D2\uFF08\u5355\u6BB5\u4E0A\u9650\uFF09\u7684\u6574\u6761\u89C6\u9891\u5FC5\u987B\u4E00\u6B21\u76F4\u51FA\uFF0C\u7981\u6B62\u62C6\u6210\u591A\u955C / \u591A\u6BB5 / \u591A\u6B21 video_generate \u518D\u62FC\u63A5**\u2014\u2014\u4F8B\u5982\u300C15 \u79D2\u300D\u5C31\u662F\u4E00\u6B21 15 \u79D2\uFF0C\u4E0D\u8BB8\u62C6\u6210 8+7\uFF1B\u4E5F\u4E0D\u8981\u4E3A\u4E86\u300C\u4E2D\u95F4\u5207\u4E00\u5200\u66F4\u597D\u770B\u300D\u800C\u5206\u955C\uFF0C\u5206\u955C\u53EA\u5728\u7528\u6237\u660E\u786E\u8981\u6C42\u591A\u955C\u65F6\u4F7F\u7528\u3002\u8D85\u8FC7\u4E0A\u9650\u65F6\uFF08\u5982 20 \u79D2\uFF09\u4F1A\u81EA\u52A8\u62C6\u6210\u9996\u6BB5 + \u82E5\u5E72\u7EED\u62CD\u6BB5\u518D\u5408\u5E76\u2014\u2014\u90A3\u662F\u540C\u4E00\u6761\u89C6\u9891\u5F80\u4E0B\u7EED\u62CD\uFF0C\u4E0D\u662F\u591A\u955C\u62FC\u63A5\u3002\u6240\u4EE5\u300C20 \u79D2\u89C6\u9891\u300D\u76F4\u63A5\u4F20 duration=20\uFF0C\u4E0D\u7528\u62C6\u6210\u591A\u4E2A\u4EFB\u52A1\uFF0C\u4E5F\u4E0D\u7528\u8DDF\u7528\u6237\u89E3\u91CA\u300C\u6A21\u578B\u4E00\u6B21\u53EA\u80FD\u51FA 15 \u79D2\u300D\uFF1B\u6210\u7247\u9ED8\u8BA4\u843D\u5728\u4F1A\u8BDD\u5DE5\u4F5C\u76EE\u5F55\u4E0B\u7684 metaontic-video/\u3002`,
    "\xB7 \u7ED9\u5DF2\u6709\u89C6\u9891\u63A5\u957F\u7528 video_extend\uFF0C\u8F93\u5165\u5FC5\u987B\u662F\u516C\u7F51 URL\uFF1B\u63D0\u793A\u8BCD\u4EE5\u300C\u5411\u540E\u5EF6\u957F\u89C6\u98911\u300D\u6216\u300C\u5411\u524D\u5EF6\u957F\u89C6\u98911\u300D\u5F00\u5934\uFF0C\u5168\u7A0B\u7528\u300C\u89C6\u98911\u300D\u6307\u4EE3\u7D20\u6750\uFF0C\u4E0D\u8981\u5199\u300C\u53C2\u8003\u89C6\u98911\u300D\uFF1B\u5199\u6E05\u5EF6\u957F\u65B9\u5411\u3001\u5267\u60C5\u53D1\u5C55\u3001\u4E3B\u4F53\u72B6\u6001\u3001\u955C\u5934\u8FD0\u52A8\u3001\u58F0\u97F3\u5EF6\u7EED\uFF1B\u6BCF\u6BB5 4-15 \u79D2\uFF0C\u9ED8\u8BA4\u6309\u4E0A\u9650\u62C6\u3001\u6BB5\u6570\u6700\u5C11\u3002",
    "\xB7 \u751F\u6210\u901A\u5E38\u8981\u51E0\u5206\u949F\uFF1A\u5355\u6B21\u8C03\u7528\u8FD4\u56DE timeout \u4E0D\u7B49\u4E8E\u5931\u8D25\uFF0C\u7528 video_status \u52A0 taskId \u7EE7\u7EED\u67E5\uFF08\u4E0A\u6E38\u94FE\u63A5\u7EA6 24 \u5C0F\u65F6\u5185\u6709\u6548\uFF09\uFF0C\u4E0D\u8981\u91CD\u590D\u63D0\u4EA4\u540C\u4E00\u6BB5\u3002",
    "\xB7 \u73AF\u5883\u6709\u95EE\u9898\uFF08\u7F3A ffmpeg \u88C5\u4E0D\u4E0A\u3001\u60F3\u786E\u8BA4\u80FD\u4E0D\u80FD\u5408\u5E76\uFF09\u7528 video_setup\uFF1A\u9ED8\u8BA4\u53EA\u68C0\u67E5\uFF0Cinstall:true \u624D\u4F1A\u771F\u88C5\uFF1B\u88C5\u547D\u4EE4\u4F1A\u5148\u7ED9\u7528\u6237\u786E\u8BA4\uFF0C\u88C5\u5B8C\u81EA\u52A8\u9A8C\u8BC1\u3002\u7528\u6237\u8BF4\u300C\u5E2E\u6211\u88C5 ffmpeg\u300D\u65F6\u5C31\u7528\u5B83\uFF0C\u522B\u81EA\u5DF1\u62FC\u547D\u4EE4\u884C\u3002",
    "\xB7 \u6362\u6A21\u578B\u3001\u65F6\u957F\u7B49\u914D\u7F6E\u7528 video_config\uFF08\u5199\u8FDB profile\uFF0C\u5BBF\u4E3B\u91CD\u8F7D\u540E\u751F\u6548\uFF09\uFF1B\u4F46 apiKey \u4F8B\u5916\uFF1A\u5B83\u53EA\u80FD\u7531\u670D\u52A1\u7AEF\u5728\u300C\u767B\u5F55\u300D\u65F6\u4E0B\u53D1\uFF0C\u4E0D\u8981\u624B\u586B\u3001\u4E5F\u4E0D\u8981\u8BA9\u7528\u6237\u624B\u586B\uFF0C\u7F3A Key \u6216\u63D0\u793A\u300C\u4E0D\u662F\u670D\u52A1\u7AEF\u4E0B\u53D1\u7684\u300D\u65F6\uFF0C\u5C31\u5F15\u5BFC\u7528\u6237\u53BB\u63D2\u4EF6\u8BE6\u60C5\u9875\u70B9\u300C\u767B\u5F55\u300D\u3002\u957F\u89C6\u9891\u8981\u5728\u672C\u673A\u5408\u5E76\uFF0C\u9700\u8981 ffmpeg\uFF1A\u672C\u673A\u6CA1\u88C5\u65F6\uFF0C\u63D2\u4EF6\u4F1A\u5148\u628A\u8FD9\u6B21\u751F\u6210\u62E6\u56DE\u6765\uFF08\u4E0D\u4EA7\u751F\u8D39\u7528\uFF09\uFF0C\u8FD9\u65F6\u8981\u5728\u5BF9\u8BDD\u6846\u91CC\u95EE\u7528\u6237\u300C\u8981\u4E0D\u8981\u6388\u6743\u6211\u88C5 ffmpeg\u300D\u2014\u2014\u6309\u8FD4\u56DE\u7684\u8BF4\u660E\u8BF4\u6E05\u4ED6\u7684\u7CFB\u7EDF\u4E0E\u547D\u4EE4\uFF0C\u7528\u6237\u540C\u610F\u5C31\u8C03\u7528 video_setup\uFF08install:true\uFF09\u7531\u63D2\u4EF6\u6765\u88C5\uFF08\u5BBF\u4E3B\u4F1A\u5148\u8BA9\u4ED6\u786E\u8BA4\u90A3\u6761\u547D\u4EE4\uFF09\uFF0C\u88C5\u5B8C\u5B83\u4F1A\u81EA\u5DF1\u9A8C\u8BC1\uFF0C\u518D\u6309\u539F duration \u91CD\u53D1\uFF1B\u7528\u6237\u4E0D\u60F3\u88C5\u5C31\u5E26 merge:false \u91CD\u53D1\uFF0C\u63D2\u4EF6\u53EA\u8FD4\u56DE\u5206\u6BB5\u5217\u8868\uFF08\u6BCF\u6BB5\u94FE\u63A5 + \u672C\u5730\u6587\u4EF6\uFF09\uFF0C\u7ED3\u679C\u91CC\u4F1A\u5E26 ffmpegMissing=true \u4E0E installHint\uFF0C\u7167\u5B83\u5F15\u5BFC\u5B89\u88C5\u5373\u53EF\u3002",
    `\xB7 \u5F53\u524D\u914D\u7F6E\uFF1A\u76F4\u51FA\u4E0A\u9650 ${singleMax} \u79D2\u3001\u6BCF\u6BB5\u5EF6\u957F ${segmentSeconds} \u79D2\u3002`,
    "\xB7 \u6CA1\u6709 API Key\uFF1A\u8BA9\u7528\u6237\u5728\u63D2\u4EF6\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D\uFF0C\u7528\u90AE\u7BB1\u6536\u9A8C\u8BC1\u7801\u9886\u4E00\u628A\uFF08\u4E00\u4E2A\u90AE\u7BB1\u53EA\u53D1\u4E00\u628A\uFF0C\u9ED8\u8BA4\u989D\u5EA6 \xA50.01\uFF09\uFF0C\u6210\u529F\u540E\u4E0A\u6E38 / Key / \u5730\u5740 / \u6A21\u578B\u4F1A\u81EA\u52A8\u586B\u597D\uFF1B\u8BBE\u7F6E\u9875\u8FD8\u80FD\u770B\u5230\u8FD9\u628A Key \u7684\u5269\u4F59 / \u5DF2\u7528\u989D\u5EA6\u548C\u6700\u8FD1\u51E0\u6B21\u51FA\u7247\u7684\u4F7F\u7528\u8BB0\u5F55\u3002"
  ].join("\n");
}
function asDisposer(value) {
  return typeof value === "function" ? value : void 0;
}
function apply(ctx, config = {}) {
  const deps = {};
  const disposers = [
    ctx.tools.register(jsonSafeTool(videoTool(config, deps))),
    ctx.tools.register(jsonSafeTool(extendTool(config))),
    ctx.tools.register(jsonSafeTool(taskTool(config))),
    ctx.tools.register(jsonSafeTool(setupTool(config)))
  ];
  const cleanup = ctx.inject(["settings"], (settingsCtx) => {
    disposers.push(settingsCtx.tools.register(jsonSafeTool(configTool(config, settingsCtx.settings))));
  });
  for (const dispose of [asDisposer(cleanup)]) if (dispose) disposers.push(dispose);
  const promptCleanup = ctx.inject(["systemPrompt"], (promptCtx) => promptCtx.systemPrompt.section({
    name: "plugin:metaontic-video",
    order: 5200,
    text: buildPromptGuidance(config)
  }));
  for (const dispose of [asDisposer(promptCleanup)]) if (dispose) disposers.push(dispose);
  const workdirCleanup = ctx.inject(["workingDirectory"], (workdirCtx) => {
    deps.workdir = workdirCtx.workingDirectory;
    return () => {
      deps.workdir = void 0;
    };
  });
  for (const dispose of [asDisposer(workdirCleanup)]) if (dispose) disposers.push(dispose);
  let gateCleanup;
  try {
    gateCleanup = ctx.on("tools/pre-execute", async (exec, next) => {
      if (!GATED_TOOLS.includes(exec.name)) return next();
      try {
        return await preflightGate(ctx, config, exec);
      } catch (error) {
        const message = error?.message || String(error);
        if (exec.name === "video_setup") {
          const command = ffmpegInstallOptions().installs[0].command;
          return {
            kind: "ask",
            reason: `\u4EBA\u5DE5\u786E\u8BA4\uFF1A\u51C6\u5907\u6267\u884C\u5B89\u88C5\u547D\u4EE4\u300C${command}\u300D\uFF08\u9884\u68C0\u672C\u8EAB\u51FA\u9519\uFF1A${message}\uFF09\u3002`,
            displayReason: {
              zh: `\u51C6\u5907\u5728\u8FD9\u53F0\u7535\u8111\u4E0A\u88C5 ffmpeg\uFF1A${command}\u3002\u70B9\u4E86\u300C\u5141\u8BB8\u300D\u624D\u4F1A\u6267\u884C\u3002`,
              en: `About to install ffmpeg on this machine: ${command}. It runs only after you allow it.`
            }
          };
        }
        return {
          kind: "ask",
          reason: `\u4EBA\u5DE5\u786E\u8BA4\uFF1A\u8C03\u7528\u89C6\u9891\u6A21\u578B\uFF08\u9884\u4F30\u8D39\u7528\u6CA1\u7B97\u51FA\u6765\uFF1A${message}\uFF09\u3002`,
          displayReason: {
            zh: `\u672C\u6B21\u4F1A\u8C03\u7528\u89C6\u9891\u6A21\u578B\uFF0C\u4F46\u9884\u4F30\u8D39\u7528\u6CA1\u7B97\u51FA\u6765\uFF08${message}\uFF09\u3002\u70B9\u4E86\u300C\u5141\u8BB8\u300D\u624D\u4F1A\u771F\u6B63\u8C03\u7528\u3002`,
            en: "This will call the video model, but the cost estimate failed. The call runs only after you allow it."
          }
        };
      }
    });
  } catch (error) {
    ctx.logger?.warn?.(
      `metaontic-video: \u8C03\u7528\u524D\u7684\u4EBA\u5DE5\u786E\u8BA4\u5361\u53E3\u6CE8\u518C\u5931\u8D25\uFF1A${error?.message || error}`
    );
  }
  if (typeof gateCleanup === "function") disposers.push(gateCleanup);
  return () => {
    for (const dispose of disposers) dispose();
  };
}
export {
  Config,
  apply,
  inject
};
