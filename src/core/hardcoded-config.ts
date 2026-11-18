/**
 * 写死的固定配置：地址、仓库、模型、标识与目录集中在这里，后续要改只改这一个文件。
 *
 * 区分两类配置：
 *  - 用户能在插件设置页改的（会写进 profile patch，见 src/businesses/video/config.ts）；
 *  - 改不了、要重新出包才生效的固定值——就是本文件。
 *
 * 服务端与浏览器端共用：只放可公开的值，不放任何密钥。
 */

/** 持久化标识不随 npm 包名改变；配置命名空间与面板 id 保持稳定。 */
export const PLUGIN_ID = 'metaontic-video';
export const PLUGIN_PACKAGE = 'dsh-metaontic-video';
export const PLUGIN_NAMESPACE = PLUGIN_ID;
export const PLUGIN_NAME = 'MetaOnticVideo';
export const PANEL_ID = PLUGIN_ID;
/** 暂隐藏流程画布：保留历史数据和内部恢复实现，不开放创作入口。 */
export const FLOW_CANVAS_AVAILABLE = false;
export const CANVAS_PANEL_ID = `${PLUGIN_ID}-canvas`;

/** 线上地址：使用说明、匿名统计、客服、更新日志。 */
export const GUIDE_URL = 'https://ai.mybfs.cn';
export const ANALYTICS_URL = 'https://video.mybfs.cn/api/v1/analytics/events';
export const SUPPORT_URL = 'https://work.weixin.qq.com/kfid/kfcd6fc4ca793eeac18';

/** 发布仓库：Gitee 是主发布渠道，GitHub 是镜像。 */
export const GITEE = {
  slug: 'hackloop/metaontic-video',
  web: 'https://gitee.com/hackloop/metaontic-video',
  api: 'https://gitee.com/api/v5/repos/hackloop/metaontic-video',
  transport: 'git@gitee.com:hackloop/metaontic-video.git',
};
export const GITHUB = {
  slug: 'wxsimon2022/metaontic-video',
  web: 'https://github.com/wxsimon2022/metaontic-video',
  api: 'https://api.github.com/repos/wxsimon2022/metaontic-video',
  transport: 'git@ssh.github.com:wxsimon2022/metaontic-video.git',
};
export const CHANGELOG_URL = `${GITHUB.web}/blob/master/CHANGELOG.md`;

/** 在线更新：检查地址、缓存与重试策略。 */
export const UPDATE_SPEC = `git+${GITEE.web}.git`;
export const UPDATE_CACHE_KEY = `${PLUGIN_ID}.update-check-v3`;
export const UPDATE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const UPDATE_ATTEMPTS = 3;
/** 正式版成品包名与下载地址（安装框只填这个 tgz 地址）。 */
export const releaseArchiveName = (version) => `${PLUGIN_ID}-${version}.tgz`;
export const releaseDownloadUrl = (version, channel = 'gitee') =>
  `${(channel === 'github' ? GITHUB : GITEE).web}/releases/download/v${version}/${releaseArchiveName(version)}`;

/** 中转站（MetaOntic AI）：留空时按这里的默认值调用。 */
export const RELAY = {
  baseUrl: 'https://ai.bileego.com',
  //signupUrl: 'https://ai.bileego.com/sign-up?aff=VzYr',
  signupUrl: 'https://ai.bileego.com',
  pricingUrl: 'https://ai.bileego.com/pricing',
  submitPath: '/doubao/api/v3/contents/generations/tasks',
  queryPath: '/doubao/api/v3/contents/generations/tasks/{task_id}',
  baseEnv: ['NEWAPI_VIDEO_BASE_URL', 'NEWAPI_BASE_URL'],
  modelEnv: ['NEWAPI_VIDEO_MODEL'],
  textModelEnv: ['NEWAPI_TEXT_MODEL'],
};

/** 火山引擎直连（当前设置页隐藏，modeAvailable 改回 true 才提供选择）。 */
export const VOLCENGINE = {
  modeAvailable: false,
  baseUrl: 'https://ark.cn-beijing.volces.com',
  submitPath: '/api/v3/contents/generations/tasks',
  queryPath: '/api/v3/contents/generations/tasks/{task_id}',
  pricingUrl: 'https://docs.volcengine.com/docs/ark/model-pricing',
};

/** 模型：视频默认型号与可选型号、图片型号、文本型号，以及已下线的旧型号。 */
export const VIDEO_MODEL = 'doubao-seedance-2-0-mini-260615';
export const VIDEO_MODEL_OPTIONS = [
  'doubao-seedance-2-0-mini-260615',
  'doubao-seedance-2-0-fast-260128',
];
export const IMAGE_MODEL = 'doubao-seedream-5-0-pro-260628';
export const RETIRED_IMAGE_MODELS = ['doubao-seedream-5-0-260128'];
export const TEXT_MODELS = ['deepseek v4.1 flash', 'deepseekv4pro'];
export const TEXT_MODEL = TEXT_MODELS[0];
export const RETIRED_TEXT_MODELS = ['doubao-seed-1-6-250615'];

/** 本地目录：插件数据目录名（~/.dsh/<DATA_DIR>）与默认成片子目录。 */
export const DATA_DIR = PLUGIN_ID;
export const DEFAULT_OUTPUT_DIR = PLUGIN_ID;
export const REFERENCE_TMP_DIR = `${PLUGIN_ID}-reference`;

/** ffmpeg 安装引导：按系统给出「装一次就完事」的命令。 */
export const FFMPEG_INSTALLS = {
  macos: { label: 'macOS（Homebrew）', command: 'brew install ffmpeg' },
  macosBootstrap: {
    label: 'macOS（还没装 Homebrew）',
    command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
  },
  windows: { label: 'Windows（winget）', command: 'winget install --id Gyan.FFmpeg -e' },
  windowsChoco: { label: 'Windows（Chocolatey）', command: 'choco install ffmpeg' },
  linux: { label: 'Linux（Debian / Ubuntu）', command: 'sudo apt update && sudo apt install -y ffmpeg' },
  linuxDnf: { label: 'Linux（Fedora / RHEL / CentOS）', command: 'sudo dnf install -y ffmpeg' },
};
