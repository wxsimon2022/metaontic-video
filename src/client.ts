import packageInfo from '../package.json';
/**
 * MetaOnticVideo 插件的浏览器半侧：在侧栏「插件」页里给本插件加一张配置卡片，
 * 直接编辑 Host 侧的配置（写进 profile 的 cordis.patch.yml）。
 *
 * 数据通道用宿主客户端的 `configForms` 服务（`dsh-client-ui-settings` 提供）：
 *   - `ctx.configForms.get('<entry id>')` 取得该条目的表单控制器；
 *   - `form.getSnapshot()` 读当前值/修订号，`form.subscribe()` 订阅变化；
 *   - `form.set(field, value)` / `form.unset(field)` 排队写入，修订号由宿主校验。
 * 页面注册进插件页的 `plugins.bundle.config` 槽位，key 为本包名 metaontic-video；
 * 卡片底部还有「登录」按钮：向注册服务申请一个中转站密钥（新 API Key），
 * 成功后自动写回 provider/apiKey/baseUrl/model，用户点「保存」即可用。
 *
 * 样式只用宿主主题 token（`--dsw-alias-*`），并都带兜底值；不 import 任何
 * Harness 客户端包，控件是本模块自己实现的。
 */
window.__ModuleLoader__.load({
  id: 'metaontic-video',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    /** Host 侧条目的 id，与 cordis.patch.yml 里那条覆盖项一致。 */
    const NAMESPACE = 'metaontic-video';
    /** 本模块自己的界面字典命名空间。 */
    const NS = 'settings.metaonticVideo';

    const zh = {
      summaryEmpty: '请选择接入方式，登录或填写 API Key 后保存。',
      summary: '{provider} · {model}',
      apiKeyConfigured: '已配置，留空保留现有密钥',
      connectionMode: '接入方式',
      connectionModeHint: '邮箱登录领取密钥，或使用自己的 MetaOntic AI、火山引擎密钥。切换后保存生效。',
      volcengineKeyHint: '填写火山方舟控制台的 API Key 后保存，无需邮箱登录。费用由火山引擎账户承担。',
      metaontic: 'B · MetaOntic AI',
      metaonticApiKey: 'MetaOntic AI API Key',
      showKey: '显示密钥',
      hideKey: '隐藏密钥',
      metaonticKeyHint: '填写 API Key 后保存，无需邮箱登录。按实际调用计费，费用与用量请在渠道平台查看。',
      volcengineApiKey: '火山引擎 API Key',
      service: 'A · MetaOnticVideo',
      volcengine: 'C · 火山引擎直连',
      seamTrimSeconds: '接缝裁剪秒数（如 0.5,0）',
      modelHiddenCurrent: '当前模型（暂不提供选择）',
      releaseNotesTitle: '更新内容',
      resetConfirm: '确定重置插件吗？这会清除本插件保存的配置、API Key 和登录状态，需要重新配置。已生成的视频不会删除。',
      model: '模型',
      modelHint: 'mini 侧重成本，fast 侧重生成速度。实际价格以所选渠道为准。',
      mergeMode: '合并方式',
      mergeModeSeamless: '直接拼接（旧配置兼容）',
      mergeModeCopy: '无损拼接',
      mergeModeReencode: '重编码拼接',
      ffmpegBinary: 'ffmpeg 路径',
      ffprobeBinary: 'ffprobe 路径',
      ffmpegTitle: '长视频合并需要 ffmpeg',
      ffmpegBody: '视频超过模型单次上限（2.0 为 15 秒、2.5 为 30 秒）时会拆成几段分别生成、再在本机合并成一条——合并这一步用的是 ffmpeg。'
        + '没装也能生成，只是只给分段列表、不合成整条。',
      ffmpegInstallFor: '按你的系统装一下（点右边按钮复制命令）：',
      ffmpegCopy: '复制',
      ffmpegCopied: '已复制',
      ffmpegMore: '其他系统',
      ffmpegLess: '收起其他系统',
      ffmpegAfter: '不想自己敲命令的话，直接在对话里说「帮我装 ffmpeg」——插件会执行安装（命令会先让你确认）；'
        + '装好后重跑一次就会自动合并（不用重新生成）。ffmpeg 装在非默认位置的话，'
        + '把绝对路径填到上面的「ffmpeg 路径」也一样管用。安装包自带 ffprobe，分段时长探测会一起解决。',
      ffmpegManual: '想自己装：macOS 用 Homebrew，Windows 用 winget，Linux 用系统包管理器；'
        + '装完确认命令行里能跑 ffmpeg -version 就行。',
      registerEmail: '邮箱',
      registerTitle: '邮箱登录',
      registerHint: '使用邮箱验证码登录，首次登录自动注册并领取密钥。',
      registerEmailPlaceholder: '你的邮箱，例如 name@example.com',
      registerCode: '验证码',
      registerCodePlaceholder: '验证码',
      registerCodeSend: '获取验证码',
      registerCodeSending: '发送中…',
      registerCodeCooldown: '{seconds} 秒后重发',
      registerCodeSent: '验证码已发送至 {email}，5 分钟内有效。',
      registerEmailLocked: '倒计时结束后可修改邮箱。',
      registerNeedEmail: '请先填写邮箱，再获取验证码。',
      registerNeedCode: '请输入邮件中的验证码。',
      registerRestored: '已恢复本机密钥并保存连接配置。',
      quotaTitle: '额度',
      quotaRemain: '剩余',
      quotaUsed: '已用',
      quotaTotal: '总额度',
      quotaUnlimited: '不限额度',
      quotaLoading: '读取额度中…',
      quotaRefresh: '刷新额度',
      quotaNoKey: '登录后可查看剩余额度与已用额度。',
      quotaNotRegistered: '未找到本机的登录记录，请联系管理员处理后重新登录。',
      quotaFailed: '读取额度失败：{message}',
      quotaUpdatedAt: '更新于 {time}',
      usageTitle: '使用记录（最近 {days} 天）',
      usageSummary: '{count} 条 · 费用合计 {amount}',
      usageColTime: '时间',
      usageColKind: '类型',
      usageColModel: '模型',
      usageColCost: '费用',
      usageColStatus: '结果',
      usageEmpty: '暂无使用记录，生成或续拍视频后可在此查看。',
      usageLoading: '读取使用记录中…',
      usageRefresh: '刷新记录',
      usageFailed: '读取使用记录失败：{message}',
      usageMore: '仅显示最近 {count} 条记录。',
      usageKeyMissing: '登录后可查看此密钥的使用记录。',
      usageStatusOk: '成功',
      usageStatusFailed: '失败',
      versionTitle: '插件版本',
      versionCurrent: '当前版本 v{version}',
      versionCheck: '检查更新',
      versionChecking: '检查中…',
      versionLatest: '已是最新版本',
      versionNew: '有新版本 v{version}',
      versionFailed: '检查更新失败：{message}',
      versionUpdate: '立即更新',
      versionUpdateConfirm: '确认更新到 v{version}',
      versionUpdateConfirmHint: '更新期间设置页可能短暂关闭，现有配置与密钥会保留。',
      versionUpdating: '更新中…',
      versionUpdateDone: '已更新到 v{version}，正在重新加载…',
      versionUpdateRestart: '新版本 v{version} 已装好：重启 Harness 后生效。',
      versionUpdateCancelled: '更新已取消。',
      versionUpdateRetry: '更新未完成，正在重试（{attempt}/{total}）…',
      versionUpdateFailed: '在线更新失败：{message}',
      versionUpdateRemoved: '插件已卸载，但重新安装失败。请到「插件」页重新添加。',
      versionUpdateRateLimited: 'Gitee 请求过于频繁，请稍后重试。现有配置与密钥会保留。',
      versionUpdateUnavailable: '当前 Harness 不支持在线更新，请到「插件」页卸载后重新添加。',
      versionHint: '可在此检查并安装新版本，现有配置与密钥会保留。',
      versionCheckedAt: '检查于 {time}',
      sectionGeneration: '生成参数',
      sectionCombined: '更多设置',
      sectionCombinedHint: '画面 · 合并 · 等待 · 本地工具',
      toolsHint: '通常无需填写；已安装但无法自动识别时，可指定可执行文件路径。',
      segmentsRetained: '所有原始分段自动保留，便于预览、续做和重新剪辑。',
      register: '登录',
      registerWorking: '登录中…',
      registerOk: '登录成功，密钥与连接配置已保存。',
      registerPartial: '已获取密钥，但部分设置保存失败，请检查后重试。',
      registerFailed: '登录失败：{message}',
      registerDisabled: '登录服务暂不可用：{message}',
      registerNoKey: '登录服务未返回密钥，请稍后重试或联系管理员。',
      mode: '续拍方式',
      modeContinuous: '同机位连续',
      modeCloseup: '切近景',
      ratio: '画面比例',
      generateAudio: '生成音频',
      watermark: '添加水印',
      pollIntervalMs: '状态查询间隔（秒）',
      maxWaitMs: '单个任务最长等待时间（秒）',
      save: '保存',
      reset: '重置插件',
      resetHint: '清除本机保存的密钥与自定义设置，恢复默认配置。',
      saving: '保存中…',
      saved: '设置已保存，配置重新加载后生效。',
      saveFailed: '保存失败，请检查设置后重试。',
      dirty: '有未保存的改动',
      loading: '读取配置中…',
      unavailable: '暂时无法加载插件设置，请重启 Harness 后重试；若仍无法加载，请检查 Harness 与插件的版本是否兼容。',
      readOnly: '当前配置为只读，无法保存修改。',
      seamTrimSecondsHint: '分别裁剪第 2、3…段开头，例如 0.5,0。留空使用模型默认值，填 0 关闭；每项为 0–3 秒。',
      waitSecondsHint: '至少 1 秒，支持小数。最长等待时间不得小于查询间隔。',
      versionHistory: '历史更新',
      unknownConnection: '未知接入方式，请重新选择。',
      atomicUnsupported: '当前 Harness 不支持批量保存，请更新 Harness 后重试。',
      atomicRejected: '设置未保存，请重新打开设置页后重试；若仍失败，请重启 Harness。',
      invalidWait: '等待时间须为至少 1 秒的有效数值，且最长等待时间不得小于查询间隔。',
      invalidSeam: '接缝裁剪须为逗号分隔的 0–3 秒数值，例如 0.5,0。',
      resetDone: '已清除本机配置，恢复默认设置。',
      resetFailed: '重置失败：{message}',
    };

    const en = {
      summaryEmpty: 'Choose a connection method, then log in or enter an API key and save.',
      summary: '{provider} · {model}',
      apiKeyConfigured: 'Configured; leave blank to keep the current key',
      connectionMode: 'Connection',
      connectionModeHint: 'Log in by email to receive a key, or use your own MetaOntic AI or Volcano Engine key. Save to apply a change.',
      volcengineKeyHint: 'Enter an API key from the Volcano Ark console and save. No email login required. Billed to your Volcano Engine account.',
      metaontic: 'B · MetaOntic AI',
      metaonticApiKey: 'MetaOntic AI API Key',
      showKey: 'Show key',
      hideKey: 'Hide key',
      metaonticKeyHint: 'Enter an API key and save. No email login required. Check actual charges and usage on your provider platform.',
      volcengineApiKey: 'Volcano Engine API Key',
      service: 'A · MetaOnticVideo',
      volcengine: 'C · Volcano Engine',
      seamTrimSeconds: 'Seam head trims (e.g. 0.5,0)',
      modelHiddenCurrent: 'Current model (selection unavailable)',
      releaseNotesTitle: 'Release notes',
      resetConfirm: 'Reset this plugin? Saved settings, API keys and login state will be cleared. Generated videos will be kept.',
      model: 'Model',
      modelHint: 'mini focuses on cost; fast focuses on generation speed. Actual prices depend on your provider.',
      mergeMode: 'Merge mode',
      mergeModeSeamless: 'Direct concat (legacy setting)',
      mergeModeCopy: 'Stream copy',
      mergeModeReencode: 'Re-encode',
      ffmpegBinary: 'ffmpeg path',
      ffprobeBinary: 'ffprobe path',
      ffmpegTitle: 'Merging long videos needs ffmpeg',
      ffmpegBody: 'Videos exceeding the model limit (15s for 2.0, 30s for 2.5) are generated as several shots and merged into one file on '
        + 'this machine — that merge needs ffmpeg. Without it you still get the video, just as separate '
        + 'segments instead of one file.',
      ffmpegInstallFor: 'Install it for your OS (click the button to copy the command):',
      ffmpegCopy: 'Copy',
      ffmpegCopied: 'Copied',
      ffmpegMore: 'Other systems',
      ffmpegLess: 'Hide other systems',
      ffmpegAfter: 'Rather not touch a terminal? Just say "帮我装 ffmpeg" in the chat and the plugin '
        + 'runs the install for you (it asks you to confirm the command first). Re-run the generation '
        + 'afterwards and the merge happens automatically — no need to regenerate. Installed somewhere '
        + 'unusual? Put the absolute path in the "ffmpeg path" field above. The package ships ffprobe '
        + 'too, so segment probing is fixed at the same time.',
      ffmpegManual: 'Installing by hand: Homebrew on macOS, winget on Windows, your distro package '
        + 'manager on Linux — you are set once `ffmpeg -version` works in a terminal.',
      registerEmail: 'Email',
      registerTitle: 'Email login',
      registerHint: 'Log in with an email verification code. Your first login creates an account and issues a key.',
      registerEmailPlaceholder: 'you@example.com',
      registerCode: 'Verification code',
      registerCodePlaceholder: 'verification code',
      registerCodeSend: 'Send code',
      registerCodeSending: 'Sending…',
      registerCodeCooldown: 'Resend in {seconds}s',
      registerCodeSent: 'Code sent to {email} — valid for 5 minutes.',
      registerEmailLocked: 'You can change the email after the countdown.',
      registerNeedEmail: 'Type your email before requesting a code.',
      registerNeedCode: 'Type the code from the email first.',
      registerRestored: 'Device key restored and connection settings saved.',
      quotaTitle: 'Quota',
      quotaRemain: 'Remaining',
      quotaUsed: 'Used',
      quotaTotal: 'Total',
      quotaUnlimited: 'Unlimited',
      quotaLoading: 'Reading quota…',
      quotaRefresh: 'Refresh quota',
      quotaNoKey: 'Log in to view remaining and used quota.',
      quotaNotRegistered: 'No login record found for this device. Contact an administrator before logging in again.',
      quotaFailed: 'Failed to read quota: {message}',
      quotaUpdatedAt: 'updated {time}',
      versionTitle: 'Plugin version',
      versionCurrent: 'Installed v{version}',
      versionCheck: 'Check for updates',
      versionChecking: 'Checking…',
      versionLatest: 'Up to date',
      versionNew: 'v{version} is available',
      versionFailed: 'Update check failed: {message}',
      versionUpdate: 'Update now',
      versionUpdateConfirm: 'Confirm update to v{version}',
      versionUpdateConfirmHint: 'The settings page may briefly close during the update. Your settings and keys will be kept.',
      versionUpdating: 'Updating…',
      versionUpdateDone: 'Updated to v{version}, reloading…',
      versionUpdateRestart: 'v{version} installed; restart Harness to apply it.',
      versionUpdateCancelled: 'Update cancelled.',
      versionUpdateRetry: 'Update incomplete. Retrying ({attempt}/{total})…',
      versionUpdateFailed: 'Online update failed: {message}',
      versionUpdateRemoved: 'The plugin was uninstalled but could not be reinstalled. Add it again from the Plugins page.',
      versionUpdateRateLimited: 'Gitee is limiting requests. Try again later. Your settings and keys will be kept.',
      versionUpdateUnavailable: 'This version of Harness does not support online updates. Uninstall and re-add the plugin from the Plugins page.',
      versionHint: 'Check for and install updates here. Your settings and keys will be kept.',
      versionCheckedAt: 'checked {time}',
      register: 'Log in',
      registerWorking: 'Logging in…',
      registerOk: 'Logged in. Your key and connection settings have been saved.',
      registerPartial: 'Key received, but some settings could not be saved. Review them and try again.',
      registerFailed: 'Log in failed: {message}',
      registerDisabled: 'Login service unavailable: {message}',
      registerNoKey: 'The login service returned no key. Try again later or contact an administrator.',
      sectionGeneration: 'Generation',
      sectionCombined: 'More settings',
      sectionCombinedHint: 'Appearance, merging, runtime and local tools',
      toolsHint: 'Usually leave blank. Set executable paths only if installed tools are not detected.',
      segmentsRetained: 'Original segments are always retained for preview, resume and editing.',
      mode: 'Continuation',
      modeContinuous: 'Same camera',
      modeCloseup: 'Cut to close-up',
      ratio: 'Aspect ratio',
      generateAudio: 'Generate audio',
      watermark: 'Add watermark',
      pollIntervalMs: 'Status check interval (seconds)',
      maxWaitMs: 'Maximum wait per task (seconds)',
      save: 'Save',
      reset: 'Reset plugin',
      resetHint: 'Clear locally saved keys and custom settings to restore defaults.',
      saving: 'Saving…',
      saved: 'Settings saved. Changes apply after configuration reloads.',
      saveFailed: 'Could not save. Check your settings and try again.',
      dirty: 'Unsaved changes',
      loading: 'Reading configuration…',
      unavailable: 'Plugin settings could not be loaded. Restart Harness and try again. If this continues, check that your Harness and plugin versions are compatible.',
      readOnly: 'These settings are read-only and cannot be changed.',
      seamTrimSecondsHint: 'Trim the start of segments 2, 3, etc., e.g. 0.5,0. Leave blank for model defaults; use 0 to disable. Each value: 0–3 seconds.',
      waitSecondsHint: 'At least 1 second; decimals allowed. Maximum wait must be at least the check interval.',
      versionHistory: 'Update history',
      unknownConnection: 'Unknown connection method. Select one again.',
      atomicUnsupported: 'This version of Harness does not support batch saving. Update Harness and try again.',
      atomicRejected: 'Settings were not saved. Reopen this page and try again; restart Harness if the problem continues.',
      invalidWait: 'Enter valid times of at least 1 second. Maximum wait must be at least the check interval.',
      invalidSeam: 'Enter comma-separated trim values from 0 to 3 seconds, e.g. 0.5,0.',
      resetDone: 'Local settings cleared and defaults restored.',
      resetFailed: 'Reset failed: {message}',
    };

    /**
     * 模型下拉的候选：中转站当前上架的 seedance 视频型号。
     * 两个都在插件的预估价目表里，所以换着选也不会把「预估费用」算歪；
     * 服务端下发的型号如果比这张表新，会照原样补进下拉，不会被静默换掉。
     */
    const MODEL_OPTIONS = [
      'doubao-seedance-2-0-mini-260615',
      'doubao-seedance-2-0-fast-260128',
    ];
    /** 可编辑字段；kind 决定控件，标注 secret 的字段宿主只会告知是否已配置。 */
    const SELECTS = {
      connectionMode: ['service', 'metaontic', 'volcengine'],
      model: MODEL_OPTIONS,
      mode: ['continuous', 'closeup'],
      ratio: ['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'],
      mergeMode: ['copy', 'reencode'],
    };
    // 字段按用途分组，页面用分节标题隔开——字段铺一格太糊，分了组一眼能扫到自己要改的那项。
    // 注：singleMaxSeconds（单次直出上限）与 duration（每段延长秒数）不进设置页：
    // 前者由模型决定（2.0 为 15 秒、2.5 为 30 秒），调小只会把一条视频拆得更碎；
    // 后者默认按模型上限规划，段数最少，调小只会多出接缝。两者都作为旧配置保留，
    // 只有「上游对卡满 15 秒的延长段敏感」这种少数情况才需要改成 14。
    const SECTIONS = [
      { key: 'sectionGeneration', fields: ['connectionMode', 'metaonticApiKey', 'volcengineApiKey', 'model', 'mode', 'ratio', 'generateAudio'] },
    ];
    const FIELDS = [
      { key: 'connectionMode', kind: 'select', wide: true },
      { key: 'metaonticApiKey', kind: 'text', secret: true, wide: true },
      { key: 'volcengineApiKey', kind: 'text', secret: true, wide: true },
      // 模型用下拉选（候选见 MODEL_OPTIONS），占一整行显示完整型号
      { key: 'model', kind: 'select', wide: true },
      { key: 'mode', kind: 'select' },
      { key: 'ratio', kind: 'select' },
      { key: 'generateAudio', kind: 'switch' },
      { key: 'watermark', kind: 'switch' },
      { key: 'seamTrimSeconds', kind: 'text' },
      { key: 'mergeMode', kind: 'select', wide: true },
      { key: 'pollIntervalMs', kind: 'number' },
      { key: 'maxWaitMs', kind: 'number' },
      { key: 'ffmpegBinary', kind: 'text', mono: true },
      { key: 'ffprobeBinary', kind: 'text', mono: true },
    ];
    const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((field) => [field.key, field]));

    /** 插件设置页「注册」按钮调用的服务地址：固定这个，不显示也不允许改。 */
    const DEFAULT_REGISTER_API = 'https://video.mybfs.cn';
    /** 本机「已登出」标记：点过「重置插件」后置上，登录成功时清掉。 */
    const LOGGED_OUT_KEY = 'metaontic-video.logged-out';
    /** 插件自己会写进配置的项：重置时兜底一起清，免得宿主没把它们列进 user。 */
    const PLUGIN_OWNED_KEYS = [
      'connectionMode', 'metaonticApiKey', 'volcengineApiKey', 'apiKey', 'keyOrigin', 'baseUrl', 'registerEmail', 'deviceId', 'deviceSecret', 'model',
    ];
    /** 注册接口的握手请求头 X-Register-Token：与服务端 REGISTER_CLIENT_TOKEN 一致。 */
    const DEFAULT_REGISTER_TOKEN = 'metaontic-video-register-v1';

    /** 「检查更新」的数据源：Gitee 镜像仓库（Gitee 的 API 带 CORS 头，浏览器半侧能直接读）。 */
    const UPDATE_PROJECT = 'hackloop/metaontic-video';
    const UPDATE_FILE_API = `https://gitee.com/api/v5/repos/${UPDATE_PROJECT}/contents/package.json`;
    /** 本包在 profile 里的包名，以及能重装自己的那条依赖 spec——在线更新直接复用这两样。 */
    const PLUGIN_PACKAGE = 'metaontic-video';
    const UPDATE_SPEC = 'git+https://gitee.com/hackloop/metaontic-video.git';
    /**
     * Gitee 的 API 会被 WAF 限流（403 Rate Limit Exceeded），「检查更新」不该因此变瞎。
     * 兜底分两级：
     *   1) jsDelivr 的**数据接口**（不是文件 CDN）：给的是这个仓库的 tag 列表，不经过 CDN 缓存，
     *      拿到的就是最新版号——而且 tag 正好是更新 spec 要用的后缀；
     *   2) 文件镜像：同一仓库的 GitHub 副本，走 jsDelivr 的备用域名（`cdn.jsdelivr.net` 在国内常被墙，
     *      所以用 `fastly` / `gcore`）。分支内容是 CDN 缓存的，可能比最新版滞后十几小时，只当最后一路兜底。
     */
    const UPDATE_TAGS_API = 'https://data.jsdelivr.com/v1/packages/gh/wxsimon2022/metaontic-video';
    const UPDATE_MIRROR_FILES = [
      'https://fastly.jsdelivr.net/gh/wxsimon2022/metaontic-video@master/package.json',
      'https://gcore.jsdelivr.net/gh/wxsimon2022/metaontic-video@master/package.json',
    ];
    /** 默认分支，以及「默认分支最新提交」的 Gitee API：在线更新要拿它当 spec 的 committish。 */
    const UPDATE_BRANCH = 'master';
    const UPDATE_COMMIT_API = `https://gitee.com/api/v5/repos/${UPDATE_PROJECT}/commits`
      + `?sha=${UPDATE_BRANCH}&per_page=1`;
    /** 在线更新最多试几次：Gitee 的匿名 HTTPS 克隆会排队，429 一般过一会儿就好。 */
    const UPDATE_ATTEMPTS = 3;
    /** 版本检查结果的本地缓存与节流：6 小时内不重复联网，打开设置页先用缓存显示。 */
    const UPDATE_CACHE_KEY = 'metaontic-video.update-check-v2';
    const UPDATE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
    /** 构建时由 esbuild --define 注入的版本号；从源码直接跑（没注入）时为空串。 */
    const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string'
      ? __PLUGIN_VERSION__.trim().replace(/^v/i, '')
      : '';

    /** 这台机器的系统（浏览器半侧只能这么看）：用来挑默认展示的 ffmpeg 安装命令。 */
    function currentOs() {
      const nav: any = window.navigator || {};
      const raw = String(
        nav.userAgentData?.platform || nav.platform || nav.userAgent || '',
      ).toLowerCase();
      if (/mac|darwin|iphone|ipad/.test(raw)) return 'macos';
      if (/win/.test(raw)) return 'windows';
      return 'linux';
    }

    /** 各系统的 ffmpeg 安装命令：主推一条，其余的折叠在「其他系统」里。 */
    const FFMPEG_INSTALLS = {
      macos: { label: 'macOS（Homebrew）', command: 'brew install ffmpeg' },
      windows: { label: 'Windows（winget）', command: 'winget install --id Gyan.FFmpeg -e' },
      linux: { label: 'Linux（Debian / Ubuntu）', command: 'sudo apt update && sudo apt install -y ffmpeg' },
    };
    const FFMPEG_ALL = [
      { os: 'macos', label: 'macOS（Homebrew）', command: 'brew install ffmpeg' },
      {
        os: 'macos',
        label: 'macOS（还没装 Homebrew）',
        command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      },
      { os: 'windows', label: 'Windows（winget）', command: 'winget install --id Gyan.FFmpeg -e' },
      { os: 'windows', label: 'Windows（Chocolatey）', command: 'choco install ffmpeg' },
      { os: 'linux', label: 'Linux（Debian / Ubuntu）', command: 'sudo apt update && sudo apt install -y ffmpeg' },
      { os: 'linux', label: 'Linux（Fedora / RHEL / CentOS）', command: 'sudo dnf install -y ffmpeg' },
    ];

    /** 金额显示与中转站一致：|x| ≥ 1 保留 2 位小数，否则保留 4 位，末尾多余的 0 去掉。 */
    function formatMoney(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return '0';
      const text = number.toFixed(Math.abs(number) >= 1 ? 2 : 4);
      return text.includes('.') ? text.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') : text;
    }

    /** 比较 x.y.z：远端确实比本地新才返回 true；任一边认不出来就当作没有更新。 */
    function isNewerVersion(remote, local) {
      const parse = (text) => {
        const match = /(\d+)\.(\d+)\.(\d+)/.exec(String(text || ''));
        return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
      };
      const next = parse(remote);
      const current = parse(local);
      if (!next || !current) return false;
      for (let index = 0; index < 3; index += 1) {
        if (next[index] !== current[index]) return next[index] > current[index];
      }
      return false;
    }

    function updateBell(t, latest, current) {
      if (!isNewerVersion(latest, current)) return null;
      const label = t('versionNew', { version: latest });
      return h('span', { className: 'mov-update-bell', 'data-field': 'update-bell', role: 'img', 'aria-label': label, title: label },
        h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, [
          h('path', { key: 'body', d: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9' }),
          h('path', { key: 'clapper', d: 'M10 21h4M12 2V1' }),
        ]));
    }

    /** Gitee 返回的文件内容是 base64：先还原成字节，再按 UTF-8 解出文本。 */
    function decodeBase64Text(raw) {
      if (typeof atob !== 'function') return '';
      const binary = atob(String(raw || '').replace(/\s+/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return typeof TextDecoder === 'function' ? new TextDecoder().decode(bytes) : binary;
    }

    /** 带超时的 GET（检查更新只读公开文件，不带任何本机凭据）。 */
    async function fetchUpdateSource(url, ms = 12000) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), ms) : null;
      try {
        const response = await fetch(url, {
          headers: { accept: 'application/json' },
          signal: controller ? controller.signal : undefined,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { json: async () => data };
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    }

    /** 版本号校验：Gitee API 给的是 base64 的 contents 回包，镜像源给的是裸 JSON。 */
    function versionFromFile(body) {
      const version = String((body || {}).version || '').trim().replace(/^v/i, '');
      if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('invalid version');
      return version;
    }

    /** 从 jsDelivr 的 tag 列表里挑版本最高的那个（非 semver 的 tag 直接跳过）。 */
    function versionFromTags(body) {
      const versions = Array.isArray(body?.versions) ? body.versions : [];
      let best = '';
      for (const entry of versions) {
        const version = String((entry && entry.version) || '').trim().replace(/^v/i, '');
        if (!/^\d+\.\d+\.\d+$/.test(version)) continue;
        if (!best || isNewerVersion(version, best)) best = version;
      }
      if (!best) throw new Error('no tags');
      return best;
    }

    /**
     * 读默认分支的 package.json，只用里面的 version 判断有没有新版本。
     * 不走 npm 源也不用管理端凭据：谁都能查，查不到就只报「检查失败」，不影响生成。
     *
     * 顺序：Gitee API（权威、带 CORS）→ jsDelivr 的 tag 列表（不走 CDN 缓存，最新）→ 文件镜像。
     * 之所以要兜底：Gitee 的 API 会 WAF 限流，一限就是一段时间，而「检查更新」是打开设置页就会跑的。
     */
    async function fetchLatestVersion() {
      const github = 'https://api.github.com/repos/wxsimon2022/metaontic-video/contents/package.json?ref=master';
      const requests = [UPDATE_FILE_API, github].map(async (url) => {
        const body = await (await fetchUpdateSource(url, 6000)).json();
        return versionFromFile(JSON.parse(decodeBase64Text(body.content)));
      });
      requests.push((async () => versionFromTags(await (await fetchUpdateSource(UPDATE_TAGS_API, 6000)).json()))());
      for (const url of UPDATE_MIRROR_FILES) {
        requests.push((async () => versionFromFile(await (await fetchUpdateSource(url, 6000)).json()))());
      }
      const results = await Promise.allSettled(requests);
      let best = '';
      for (const result of results) {
        if (result.status === 'fulfilled' && (!best || isNewerVersion(result.value, best))) best = result.value;
      }
      if (!best) throw new Error(results.filter((item) => item.status === 'rejected')
        .map((item: any) => item.reason?.message || String(item.reason)).join('；'));
      return best;
    }

    /**
     * 默认分支最新提交的完整 sha。
     *
     * 在线更新为什么不直接装 `UPDATE_SPEC`：宿主对「同一个 spec 再装一遍」是直接拒绝的
     * （already-installed），想绕开就得先卸载——而卸载之后一旦装不上（Gitee 429、断网），
     * 插件就没了。改成带上当前最新提交号，spec 跟已装的永远不同，宿主当新依赖处理、
     * 直接原地覆盖安装，装失败也不会动现有版本。
     */
    async function fetchLatestCommit() {
      const body = await (await fetchUpdateSource(UPDATE_COMMIT_API)).json();
      const sha = String((Array.isArray(body) ? body[0]?.sha : '') || '').trim();
      if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('no commit');
      return sha;
    }

    const TOKENS = {
      text: 'var(--dsw-alias-label-primary, inherit)',
      muted: 'var(--dsw-alias-label-caption, #8886)',
      border: 'var(--dsw-alias-border-l2, #8884)',
      cardFill: 'var(--dsw-alias-settings-card-fill, transparent)',
      controlFill: 'var(--dsw-specific-input-major, transparent)',
      primaryFill: 'var(--dsw-alias-button-primary-fill, #247bbf)',
      error: 'var(--dsw-alias-state-error-primary, #d9534f)',
      success: 'var(--dsw-alias-state-success-primary, #2e9e5b)',
    };

    // 控件的外观（边框 / 圆角 / 高度 / 聚焦圈）统一放进 PAGE_CSS 的 .mov-input，
    // 内联样式只留布局（宽度），免得改一处样式要在两处同步。
    const inputStyle = { width: '100%', boxSizing: 'border-box' };

    /**
     * 页面静态样式：能 hover / focus 的效果（按钮、表格行、输入聚焦圈）内联样式表达不了，
     * 所以集中在这张表里；class 统一 mov- 前缀，避免和宿主其他插件串味。
     */
    const PAGE_CSS = `
      /* 整页纵向排布：块与块之间统一 16px，比一整片表单好扫 */
      .mov-page { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; color: ${TOKENS.text}; }
      /* 分组卡片：16 个字段摊在一格里太糊，按用途各装一张卡 */
      .mov-section { display: flex; flex-direction: column; gap: 14px; padding: 14px 16px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-advanced { display: block; }
      .mov-advanced-toggle { cursor: pointer; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-advanced-toggle .mov-hint { display: block; margin: 5px 0 0 16px; font-weight: 400; }
      .mov-advanced-toggle:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 5px; border-radius: 4px; }
      .mov-advanced-body { display: flex; flex-direction: column; gap: 12px; border-top: 1px solid ${TOKENS.border}; margin-top: 14px; padding-top: 16px; }
      .mov-advanced-body .mov-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; align-items: start; }
      .mov-advanced-body .mov-field-wide { grid-column: auto; }
      @container (max-width: 480px) { .mov-advanced-body .mov-grid { grid-template-columns: minmax(0, 1fr); } }
      .mov-advanced { container-type: inline-size; }
      .mov-section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      /* 标题左边一道主色竖条，代替纯文字分组标题 */
      .mov-section-title::before { content: ""; flex: 0 0 auto; width: 3px; height: 13px; border-radius: 2px; background: ${TOKENS.primaryFill}; }
      .mov-section-title::after { content: ""; flex: 1 1 auto; height: 1px; background: ${TOKENS.border}; }
      /* 两列自适应：单列至少 240px，窄面板自动落成一列 */
      .mov-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 14px 18px; }
      .mov-field { display: flex; flex-direction: column; min-width: 0; }
      /* 开关没有标签行，靠底对齐才能跟旁边输入框的控制线齐平 */
      .mov-field-switch { justify-content: flex-end; }
      .mov-field-wide { grid-column: 1 / -1; }
      .mov-label { display: block; font-size: 12px; color: ${TOKENS.muted}; margin-bottom: 6px; }
      .mov-input { padding: 8px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; color: ${TOKENS.text}; font: inherit; font-size: 13px; height: 36px; }
      .mov-key-control { position: relative; min-width: 0; }
      .mov-key-control .mov-input { padding-right: 40px; }
      .mov-key-eye { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 30px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: ${TOKENS.muted}; cursor: pointer; }
      .mov-key-eye:hover { color: ${TOKENS.text}; background: ${TOKENS.border}; }
      .mov-key-eye:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 1px; }
      .mov-input:focus, .mov-input:focus-visible { outline: none; border-color: ${TOKENS.primaryFill}; box-shadow: 0 0 0 3px rgba(36, 123, 191, .18); }
      /* 模型 ID 与可执行文件路径很长：等宽字体 + 省略，不把整行撑变形 */
      .mov-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
      /* 开关做成跟输入框同高的小方块，和周围控件一条线 */
      .mov-switch { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 36px; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: ${TOKENS.controlFill}; font-size: 13px; color: ${TOKENS.text}; cursor: pointer; }
      .mov-switch:hover { border-color: ${TOKENS.primaryFill}; }
      .mov-switch input { width: 15px; height: 15px; accent-color: ${TOKENS.primaryFill}; cursor: pointer; }
      .mov-card { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-current-version { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 120px; }
      .mov-update-bell { display: inline-flex; flex: 0 0 auto; color: ${TOKENS.primaryFill}; transform-origin: 50% 10%; animation: mov-bell-swing 1.6s ease-in-out infinite; }
      @keyframes mov-bell-swing { 0%, 60%, 100% { transform: rotate(0deg); } 10%, 30% { transform: rotate(-18deg); } 20%, 40% { transform: rotate(18deg); } 50% { transform: rotate(-8deg); } }
      @media (prefers-reduced-motion: reduce) { .mov-update-bell { animation: none; } }
      .mov-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-card-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
      .mov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; flex: 0 0 120px; width: 120px; min-width: 120px; height: 36px; min-height: 36px; padding: 4px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; line-height: 1.2; text-align: center; cursor: pointer; white-space: normal; overflow-wrap: anywhere; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
      .mov-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
      .mov-btn:disabled { opacity: .5; cursor: default; }
      .mov-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
      .mov-btn-primary:hover:not(:disabled) { color: #fff; opacity: .88; }
      .mov-trailing { margin-left: auto; }
      /* 额度：三个数字块，一眼分清剩余 / 已用 / 总额度 */
      .mov-quota-compact { padding: 8px 12px; gap: 14px; flex-direction: row; align-items: center; flex-wrap: nowrap; overflow-x: auto; }
      .mov-quota-compact .mov-card-head { min-height: 24px; flex: 0 0 auto; gap: 8px; }
      .mov-quota-compact .mov-stats { display: flex; flex: 1 0 auto; gap: 16px; }
      .mov-quota-compact .mov-stat { flex-direction: row; align-items: baseline; justify-content: space-between; gap: 6px; padding: 0; border: 0; border-radius: 0; white-space: nowrap; }
      .mov-quota-compact .mov-stat-label { font-size: 11px; white-space: nowrap; }
      .mov-quota-compact .mov-stat-value { font-size: 14px; }
      .mov-quota-compact .mov-foot-note { font-size: 10px; white-space: nowrap; flex: 0 0 auto; }
      .mov-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
      .mov-stat { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid ${TOKENS.border}; }
      .mov-stat-label { font-size: 11.5px; color: ${TOKENS.muted}; }
      .mov-stat-value { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .mov-foot-note { font-size: 11.5px; color: ${TOKENS.muted}; }
      /* ffmpeg 安装命令：一行等宽、可复制，不用撑满整行 */
      .mov-cmd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-tag { flex: 0 0 auto; min-width: 132px; font-size: 12px; color: ${TOKENS.muted}; }
      .mov-code { flex: 0 0 auto; max-width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
      /* 使用记录：斑马纹 + 细表头，模型列吃掉剩余宽度 */
      /* 面板很窄时表格横向滚动，也不把「时间」挤成两行 */
      .mov-table { display: flex; flex-direction: column; margin: 0 -6px; overflow-x: auto; }
      .mov-table-head, .mov-table-row { display: grid; grid-template-columns: 106px 78px minmax(72px, 1fr) 84px 60px; align-items: center; gap: 10px; padding: 8px 10px; }
      .mov-table-head > :nth-child(1), .mov-table-row > :nth-child(1) { white-space: nowrap; }
      .mov-table-head { font-size: 11px; letter-spacing: .03em; color: ${TOKENS.muted}; border-bottom: 1px solid ${TOKENS.border}; }
      .mov-table-row { font-size: 12.5px; border-radius: 8px; }
      .mov-table-row:nth-child(even) { background: rgba(127, 127, 127, .05); }
      .mov-table-row:hover { background: rgba(127, 127, 127, .1); }
      /* 费用与结果两列右对齐，数字竖着对得齐 */
      .mov-table-head > :nth-child(4), .mov-table-row > :nth-child(4),
      .mov-table-head > :nth-child(5), .mov-table-row > :nth-child(5) { text-align: right; }
      .mov-model { min-width: 0; overflow: hidden; color: ${TOKENS.muted}; white-space: nowrap; text-overflow: ellipsis; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
      .mov-num { font-variant-numeric: tabular-nums; }
      /* 结果用胶囊标签，比裸文字更容易一眼扫到 */
      .mov-chip { display: inline-flex; align-items: center; justify-content: center; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; line-height: 1.7; }
      .mov-chip-ok { color: ${TOKENS.success}; background: rgba(46, 158, 91, .12); }
      .mov-chip-bad { color: ${TOKENS.error}; background: rgba(217, 83, 79, .12); }
      /* 注册表单：输入框吃掉多余宽度，两个按钮不换行 */
      .mov-register-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      /* 底部操作条：上边线把「保存」和配置内容分开 */
      .mov-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 2px 2px; border-top: 1px solid ${TOKENS.border}; }
      .mov-notice { margin: 0; font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
    `;

    function optionLabel(t, key, option) {
      if (key === 'connectionMode') return t(option);
      if (key === 'mode') return option === 'closeup' ? t('modeCloseup') : t('modeContinuous');
      if (key === 'mergeMode') {
        if (option === 'reencode') return t('mergeModeReencode');
        return option === 'copy' ? t('mergeModeCopy') : t('mergeModeSeamless');
      }
      return option;
    }

    /** 订阅表单快照：宿主每次推送新值都会重渲染。 */
    function useSnapshot(form) {
      const [revision, bump] = React.useState(0);
      React.useEffect(() => form.subscribe(() => bump((value) => value + 1)), [form, revision]);
      return form.getSnapshot();
    }

    function same(a, b) {
      return a === b || (a === undefined && b === '') || (a === '' && b === undefined);
    }

    async function persistBatch(form, ops) {
      if (typeof form.mutate !== 'function') throw new Error('atomicUnsupported');
      if (!await form.mutate(ops)) throw new Error('atomicRejected');
    }

    function validateSettings(values) {
      const interval = Number(values.pollIntervalMs ?? 5000);
      const wait = Number(values.maxWaitMs ?? 600000);
      if (![interval, wait].every((n) => Number.isSafeInteger(n) && n >= 1000) || wait < interval) {
        throw new Error('invalidWait');
      }
      const trim = String(values.seamTrimSeconds ?? '').trim();
      if (trim && !trim.split(',').every((part) => part.trim() !== '' && Number.isFinite(Number(part)) && Number(part) >= 0 && Number(part) <= 3)) {
        throw new Error('invalidSeam');
      }
    }

    // 先写当前 Key、清空其他渠道凭据，最后提交模式。空值覆盖继承配置，避免 unset 后旧 Key 回流。
    async function persistConnection(form, pending, nextMode) {
      if (!['service', 'metaontic', 'volcengine'].includes(nextMode)) throw new Error('unknownConnection');
      const inactiveKeys = nextMode === 'volcengine'
        ? ['metaonticApiKey', 'apiKey', 'keyOrigin', 'baseUrl', 'submitPath', 'queryPath',
          'registerEmail', 'deviceId', 'deviceSecret', 'registerApi', 'registerToken']
        : nextMode === 'metaontic'
          ? ['volcengineApiKey', 'apiKey', 'keyOrigin', 'registerEmail', 'deviceId', 'deviceSecret', 'registerApi', 'registerToken']
          : ['volcengineApiKey', 'metaonticApiKey'];
      const ops = pending.filter(([key]) => key !== 'connectionMode' && !inactiveKeys.includes(key))
        .map(([key, next]) => ({ op: 'set', path: [key], value: next }));
      for (const key of inactiveKeys) ops.push({ op: 'set', path: [key], value: '' });
      ops.push({ op: 'set', path: ['connectionMode'], value: nextMode });
      // 成功响应代表宿主已接受整批写入；插件可能已重载，旧控制器的快照不再更新。
      await persistBatch(form, ops);
    }

    function makePage({ form, t, manager }) {
      return function ConfigPage(props) {
        const snapshot = useSnapshot(form);
        const value = snapshot.value || {};
        const [draft, setDraft] = React.useState({});
        const selectedMode = draft.connectionMode ?? value.connectionMode ?? 'service';
        const directMode = selectedMode === 'volcengine';
        const serviceMode = selectedMode === 'service';
        const [visibleKey, setVisibleKey] = React.useState('');
        React.useEffect(() => { setVisibleKey(''); }, [selectedMode]);
        const [status, setStatus] = React.useState('idle');
        const [saveError, setSaveError] = React.useState('');
        // 「已保存」这类反馈过几秒自动收起：收起后操作条跟着消失，页面回到「没有改动」的样子
        const statusTimer = React.useRef(null);
        const connectionBusy = React.useRef(false);
        function serviceActive() {
          return !connectionBusy.current && (form.getSnapshot().value?.connectionMode || 'service') === 'service';
        }
        const [registerStatus, setRegisterStatus] = React.useState('idle');
        const [registerMessage, setRegisterMessage] = React.useState('');
        // 注册用「邮箱（账号）+ 邮件验证码」：邮箱一次只发一把 Key
        const [registerEmail, setRegisterEmail] = React.useState(() => {
          const saved = form.getSnapshot().value || {};
          return String(saved.registerEmail || '');
        });
        const [registerCode, setRegisterCode] = React.useState('');
        const [codeStatus, setCodeStatus] = React.useState('idle');
        const [codeMessage, setCodeMessage] = React.useState('');
        const [codeCooldown, setCodeCooldown] = React.useState(0);
        // 发过码之后的冷却期里邮箱置灰（倒计时结束就放开，可以改邮箱重发）
        const emailLocked = codeCooldown > 0;
        // 额度：设置页展示这把 Key 的剩余 / 已用
        const [quota, setQuota] = React.useState(null);
        const [quotaStatus, setQuotaStatus] = React.useState('idle');
        const [quotaMessage, setQuotaMessage] = React.useState('');
        const [quotaAt, setQuotaAt] = React.useState('');
        // 使用记录：本机那把 Key 最近几次出片（服务端按设备认人，只给自己的）
        const [usage, setUsage] = React.useState(null);
        const [usageStatus, setUsageStatus] = React.useState('idle');
        const [usageMessage, setUsageMessage] = React.useState('');
        const usageInFlight = React.useRef(false);
        const [usageAt, setUsageAt] = React.useState('');
        // ffmpeg 安装引导：默认只展示当前系统那条，可展开看其他系统；复制过的命令给个「已复制」反馈
        const [showAllFfmpeg, setShowAllFfmpeg] = React.useState(false);
        const [copiedFfmpeg, setCopiedFfmpeg] = React.useState('');
        // 版本 / 检查更新：只读 Gitee 默认分支的 package.json，跟本包版本比大小
        const [updateStatus, setUpdateStatus] = React.useState('idle');
        const [updateMessage, setUpdateMessage] = React.useState('');
        const [updateLatest, setUpdateLatest] = React.useState('');
        // 更新说明固定使用本机包内内容，不受远端版本和检查缓存影响。
        const releaseNotes = packageInfo.releaseNotes;
        const [updateAt, setUpdateAt] = React.useState('');
        // 上次看到的默认分支提交号：在线更新拿它当 spec 后缀用（取不到再联网取一次）
        const updateCommit = React.useRef('');
        // 一键在线更新：第一下把按钮转成「确认更新」，第二下才真的重装本插件
        const [updateConfirm, setUpdateConfirm] = React.useState(false);

        // 打开设置页时，若本机还没配 Key，就先问服务端要回自己那把（设备绑定过就能取回）；
        // 但刚点过「重置插件」的不算——那时要保持未登录，等用户自己再点「登录」。
        const restoreTried = React.useRef(false);
        React.useEffect(() => {
          if (restoreTried.current) return;
          restoreTried.current = true;
          const snap = form.getSnapshot() || {};
          if (((snap.value || {}).connectionMode || 'service') !== 'service') return;
          if (loggedOut()) {
            setRegisterStatus('idle');
            return;
          }
          // 设备凭据同步进配置：主进程要在调用模型前拿它查余额
          syncDeviceIdentity().catch(() => {});
          if (snap.secrets?.apiKey || (snap.value || {}).apiKey) {
            loadQuota().catch(() => {});
            loadUsage().catch(() => {});
            return;
          }
          lookupOwnKey().catch(() => {});
        }, []);

        // 页面可见时定时拉取，重新聚焦时立即刷新；火山直连不查询服务端记录。
        React.useEffect(() => {
          if (!serviceMode || props?.view === 'summary'
            || !(snapshot.secrets?.apiKey || value.apiKey)) return;
          const refresh = () => {
            if (window.document?.visibilityState === 'hidden') return;
            loadUsage().catch(() => {});
          };
          refresh();
          const timer = window.setInterval(refresh, 60000);
          window.addEventListener('focus', refresh);
          window.document?.addEventListener('visibilitychange', refresh);
          return () => {
            window.clearInterval(timer);
            window.removeEventListener('focus', refresh);
            window.document?.removeEventListener('visibilitychange', refresh);
          };
        }, [serviceMode, Boolean(snapshot.secrets?.apiKey || value.apiKey), value.deviceId, props?.view]);

        // 进入完整设置页先显示缓存，同时后台检查；摘要视图不触发检查。
        const updateTried = React.useRef(false);
        React.useEffect(() => {
          if (props?.view === 'summary') { updateTried.current = false; return; }
          if (updateTried.current) return;
          updateTried.current = true;
          const cached = readUpdateCache();
          if (cached.latest) {
            setUpdateLatest(cached.latest);
            if (cached.at) setUpdateAt(new Date(cached.at).toLocaleTimeString());
            if (cached.commit) updateCommit.current = cached.commit;
            setUpdateStatus('ok');
          }
          checkForUpdate(true).catch(() => {});
        }, [props?.view]);

        if (props && props.view === 'summary') {
          const configured = Boolean(value.model) || Boolean(snapshot.secrets?.apiKey);
          const text = configured
            ? t('summary', { provider: t(selectedMode), model: value.model || '-' })
            : t('summaryEmpty');
          return h('span', { style: { color: TOKENS.muted } }, text);
        }

        const pending = Object.entries(draft).filter(([key, next]) => !same(value[key], next));
        // 一有新的改动就把上一条「已保存」收起来，免得看着像这次的改动也存过了
        const edit = (key, next) => {
          clearStatusTimer();
          setStatus((current) => (current === 'idle' ? current : 'idle'));
          setDraft((current) => ({ ...current, [key]: next }));
        };
        const clear = (key) => setDraft((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });

        /** 收起定时器：改动、重新保存前都要清掉，免得旧定时器把新反馈提前收掉。 */
        function clearStatusTimer() {
          if (statusTimer.current) {
            window.clearTimeout(statusTimer.current);
            statusTimer.current = null;
          }
        }

        /** 成功反馈：显示几秒后自动回到 idle（页面就只剩「没有改动」的样子）。 */
        function flashStatus(next, holdMs = 2500) {
          clearStatusTimer();
          setStatus(next);
          statusTimer.current = window.setTimeout(() => {
            statusTimer.current = null;
            setStatus('idle');
          }, holdMs);
        }

        function settingsError(error) {
          const message = error?.message || String(error);
          return ['unknownConnection', 'atomicUnsupported', 'atomicRejected', 'invalidWait', 'invalidSeam'].includes(message) ? t(message) : message;
        }

        async function save() {
          if (connectionBusy.current) return;
          connectionBusy.current = true;
          setSaveError('');
          setStatus('saving');
          const nextMode = draft.connectionMode ?? value.connectionMode ?? 'service';
          try {
            validateSettings({ ...value, ...draft });
            await persistConnection(form, pending, nextMode);
            if (nextMode !== 'service') {
              forgetDevice();
              setRegisterEmail('');
              setRegisterCode('');
              setRegisterStatus('idle');
              setRegisterMessage('');
              setQuota(null);
            }
            setDraft({});
            flashStatus('saved');
          } catch (error) {
            setSaveError(settingsError(error));
            setStatus('failed');
          } finally {
            connectionBusy.current = false;
          }
        }

        /**
         * 重置插件 = 回到「刚装上」的样子：
         * ① 把配置里这台机器写过的项全部移除（Key、来源标记、上游地址、邮箱、设备凭据、模型…），
         *    宿主重载配置后就退回插件默认值；
         * ② 抹掉本机设备凭据，并打上「已登出」标记——否则重开设置页会自动向服务端取回那把 Key，
         *    看着就像重置没生效（这个标记在下次登录成功时清掉）。
         */
        async function reset() {
          if (connectionBusy.current) return;
          if (!window.confirm(t('resetConfirm'))) return;
          connectionBusy.current = true;
          setSaveError('');
          setStatus('saving');
          try {
            const targets = new Set([...Object.keys(snapshot.user || {}), ...PLUGIN_OWNED_KEYS]);
            await persistBatch(form, [...targets].map((key) => ({ op: 'unset', path: [key] })));
            forgetDevice();
            setDraft({});
            setVisibleKey('');
            setRegisterEmail('');
            setRegisterStatus('idle');
            setRegisterMessage('');
            setRegisterCode('');
            setQuota(null);
            flashStatus('reset');
          } catch (error) {
            setSaveError(t('resetFailed', { message: settingsError(error) }));
            setStatus('failed');
          } finally {
            connectionBusy.current = false;
          }
        }

        /** 服务地址：配置里有就用配置的（老版本固定写死，这里保留兜底）。 */
        function registerApiRoot() {
          const configured = String(value.registerApi || '').trim();
          return (configured || DEFAULT_REGISTER_API).replace(/\/+$/, '');
        }

        /** 「已登出」标记：重置后置上，登录成功后清掉；期间不自动找回密钥。 */
        function loggedOut() {
          try {
            return window.localStorage.getItem(LOGGED_OUT_KEY) === '1';
          } catch {
            return false;
          }
        }

        function setLoggedOut() {
          try {
            window.localStorage.setItem(LOGGED_OUT_KEY, '1');
          } catch {
            // 存不住也不影响本次会话的行为
          }
        }

        function clearLoggedOut() {
          try {
            window.localStorage.removeItem(LOGGED_OUT_KEY);
          } catch {
            // 同上
          }
        }

        /** 重置时抹掉本机设备凭据：下次登录会重新生成一对，重新绑定到同一个邮箱。 */
        function forgetDevice() {
          try {
            window.localStorage.removeItem('metaontic-video.device-id');
            window.localStorage.removeItem('metaontic-video.device-secret');
          } catch {
            // 抹不掉只是下次还能取回，不影响重置本身
          }
          setLoggedOut();
        }

        /** 本机身份：本地持久化的设备标识 + 设备密钥，注册时一起交给服务端做绑定。 */
        function deviceIdentity() {
          const ID_KEY = 'metaontic-video.device-id';
          const SECRET_KEY = 'metaontic-video.device-secret';
          const rand = () => Math.random().toString(36).slice(2, 10);
          let id = `dsh-${rand()}${Date.now().toString(36)}`;
          let secret = `dsk-${rand()}${rand()}${rand()}`;
          try {
            const savedId = window.localStorage.getItem(ID_KEY);
            const savedSecret = window.localStorage.getItem(SECRET_KEY);
            if (savedId) id = savedId;
            else window.localStorage.setItem(ID_KEY, id);
            if (savedSecret) secret = savedSecret;
            else window.localStorage.setItem(SECRET_KEY, secret);
          } catch {
            // 存不住就退化成「本次会话内有效」，至少不会把注册弄崩
          }
          return { id, secret };
        }

        /** 设备指纹：只做登记，让后台看得出这把 Key 是哪台机器领的。 */
        function deviceFingerprint() {
          const pick = (read) => {
            try {
              const value = read();
              return value ? String(value).slice(0, 120) : undefined;
            } catch {
              return undefined;
            }
          };
          const nav = (): Navigator => window.navigator;
          const info = {
            app: 'Harness',
            plugin: 'metaontic-video',
            platform: pick(() => nav().userAgentData?.platform || nav().platform),
            os: pick(() => nav().userAgentData?.platform || nav().platform),
            language: pick(() => nav().language),
            timezone: pick(() => window.Intl?.DateTimeFormat().resolvedOptions().timeZone),
            screen: pick(() => `${window.screen?.width}x${window.screen?.height}`),
            agent: pick(() => nav().userAgent),
          };
          return Object.fromEntries(Object.entries(info).filter(([, v]) => v !== undefined));
        }

        function deviceLabel(info) {
          const platform = info?.platform || info?.os;
          return platform ? `Harness-${platform}` : 'Harness';
        }

        /**
         * 设备凭据（设备标识 + 设备密钥）要同步进插件配置。
         *
         * 生成视频前，主进程那侧的工具会拿它去服务端查这把 Key 的剩余额度
         * （额度不够就禁止调用），而设备凭据平时只存在浏览器 localStorage 里，
         * 主进程读不到，所以这里写一份到配置里。值与配置一致时不重复写。
         */
        function deviceWrites(device = undefined) {
          const identity = device || deviceIdentity();
          const current = form.getSnapshot().value || {};
          const writes: Array<[string, string]> = [];
          if (!same(current.deviceId, identity.id)) writes.push(['deviceId', identity.id]);
          if (!same(current.deviceSecret, identity.secret)) {
            writes.push(['deviceSecret', identity.secret]);
          }
          return writes;
        }

        /** 进设置页时补一次设备凭据（老版本没存过，注册过的人不用重新领 Key）。 */
        async function syncDeviceIdentity() {
          if (!serviceActive()) return;
          const writes = deviceWrites();
          if (!writes.length) return;
          connectionBusy.current = true;
          try {
            await persistBatch(form, writes.map(([key, next]) => ({ op: 'set', path: [key], value: next })));
            for (const [key] of writes) clear(key);
          } catch {
            // 后续登录仍可重新保存设备凭据。
          } finally {
            connectionBusy.current = false;
          }
        }

        /** 取注册服务的 JSON：后端是 {code, data, message} 信封，这里拆开并统一抛错。 */
        async function callRegister(url: string, init: RequestInit = {}) {
          const controller = typeof AbortController === 'function' ? new AbortController() : null;
          const timer = controller ? window.setTimeout(() => controller.abort(), 90000) : null;
          const token = String(value.registerToken || DEFAULT_REGISTER_TOKEN);
          const options = { ...(init || {}) };
          options.headers = {
            accept: 'application/json',
            'x-register-token': token,
            // 本插件版本：服务端会记进请求日志，便于回溯「这版有没有问题」
            ...(PLUGIN_VERSION ? { 'x-plugin-version': PLUGIN_VERSION } : {}),
            ...((init && init.headers) || {}),
          };
          let response;
          try {
            response = await fetch(url, {
              signal: controller ? controller.signal : undefined,
              ...options,
            });
          } finally {
            if (timer) window.clearTimeout(timer);
          }
          const text = await response.text();
          let body = null;
          try {
            body = text ? JSON.parse(text) : null;
          } catch {
            body = null;
          }
          const payload = body && typeof body === 'object' && 'data' in body ? body.data : body;
          if (!response.ok || (body && typeof body === 'object' && body.code)) {
            const failure: any = new Error(
              (body && (body.message || body.detail)) || text.slice(0, 200) || `HTTP ${response.status}`,
            );
            failure.status = response.status;
            throw failure;
          }
          return payload || {};
        }

        /** 把服务端给的那把密钥写回配置（注册、取回都走这里）。 */
        async function applyRegistration(result, fallbackBase, device) {
          // keyOrigin 是给宿主那侧看的标记：只有带这个标记（或早期版本的设备凭据 + 邮箱）
          // 的 Key 才被当成「服务端下发的」，手填的一律拒绝调用。
          if (!serviceActive()) return;
          const writes = [
            ['apiKey', result.api_key],
            ['keyOrigin', 'register'],
            ['baseUrl', result.base_url || fallbackBase || registerApiRoot()],
            ...await deviceWrites(device),
          ];
          // 邮箱是账号：存回本地，方便下次认出「这台机器绑的是哪个邮箱」；
          // 中转站里的密钥名由服务端生成唯一串，与邮箱的绑定关系在服务端。
          const account = result.email || result.display_name || '';
          if (account) writes.push(['registerEmail', account]);
          if (result.model) writes.push(['model', result.model]);
          if (!serviceActive()) return false;
          connectionBusy.current = true;
          try {
            await persistConnection(form, writes, 'service');
            clearLoggedOut();
            for (const [key] of writes) clear(key);
            setRegisterStatus('ok');
          } catch (error) {
            throw new Error(settingsError(error));
          } finally {
            connectionBusy.current = false;
          }
          loadQuota().catch(() => {});
          loadUsage().catch(() => {});
          return true;
        }

        /** 本机取回：只有设备标识 + 设备密钥都对上，服务端才把注册信息给你。 */
        async function lookupOwnKey() {
          const device = deviceIdentity();
          const result = await callRegister(`${registerApiRoot()}/api/v1/register/lookup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ device_id: device.id, device_secret: device.secret }),
          });
          if (!result.api_key) throw new Error(t('registerNoKey'));
          if (!await applyRegistration(result, null, device)) return;
          setRegisterStatus('restored');
          return result;
        }

        /** 倒计时：同一个邮箱 60 秒才能再发一封，按钮上直接显示还剩几秒。 */
        function startCooldown(seconds) {
          const total = Math.max(Math.round(Number(seconds) || 0), 0);
          if (!total) return;
          setCodeCooldown(total);
          const tick = (left) => {
            if (left <= 0) {
              setCodeCooldown(0);
              return;
            }
            setCodeCooldown(left);
            window.setTimeout(() => tick(left - 1), 1000);
          };
          window.setTimeout(() => tick(total - 1), 1000);
        }

        /** 获取验证码：邮箱是账号，服务端把验证码发到这个邮箱。 */
        async function sendEmailCode() {
          const account = registerEmail.trim();
          if (!account) {
            setCodeStatus('failed');
            setCodeMessage(t('registerNeedEmail'));
            return;
          }
          setCodeStatus('working');
          setCodeMessage('');
          try {
            const status = await callRegister(`${registerApiRoot()}/api/v1/register/status`);
            if (!status.enabled) {
              setCodeStatus('failed');
              setCodeMessage(t('registerDisabled', { message: status.hint || '-' }));
              return;
            }
            const result = await callRegister(`${registerApiRoot()}/api/v1/register/email/code`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ email: account }),
            });
            setCodeStatus('sent');
            setCodeMessage(t('registerCodeSent', { email: result.email || account }));
            startCooldown(result.retry_after ?? 60);
            setRegisterStatus('idle');
            setRegisterMessage('');
          } catch (error) {
            setCodeStatus('failed');
            setCodeMessage(error?.message || String(error));
          }
        }

        async function register() {
          const root = registerApiRoot();
          const account = registerEmail.trim();
          const code = registerCode.trim();
          if (!account) {
            setRegisterStatus('failed');
            setRegisterMessage(t('registerNeedEmail'));
            return;
          }
          if (!code) {
            setRegisterStatus('failed');
            setRegisterMessage(t('registerNeedCode'));
            return;
          }
          setRegisterStatus('working');
          setRegisterMessage('');
          const device = deviceIdentity();
          const fingerprint = deviceFingerprint();
          try {
            const status = await callRegister(`${root}/api/v1/register/status`);
            if (!status.enabled) {
              setRegisterStatus('disabled');
              setRegisterMessage(t('registerDisabled', { message: status.hint || '-' }));
              return;
            }
            const result = await callRegister(`${root}/api/v1/register`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({
                email: account,
                code,
                device_id: device.id,
                device_secret: device.secret,
                device_info: fingerprint,
                note: `Harness 插件设置页注册（${deviceLabel(fingerprint)}）`,
              }),
            });
            if (!result.api_key) {
              setRegisterStatus('failed');
              setRegisterMessage(t('registerNoKey'));
              return;
            }
            await applyRegistration(result, status.base_url || root, device);
          } catch (error) {
            // 本机早就领过了（或本地密钥丢了）：直接把自己那把取回来
            if (error?.status === 409 || error?.status === 404) {
              try {
                await lookupOwnKey();
                return;
              } catch {
                // 取不回来说明不是本机领的，照原样报错
              }
            }
            setRegisterStatus('failed');
            setRegisterMessage(t('registerFailed', { message: error?.message || String(error) }));
          }
        }

        /**
         * 额度：服务端拿管理端凭据去中转站读这把 Key 的用量。
         * 只有本机（设备标识 + 设备密钥都对上）才拿得到，展示的必然是自己那把。
         */
        async function loadQuota() {
          if (!serviceMode || !serviceActive()) return;
          const device = deviceIdentity();
          setQuotaStatus('working');
          setQuotaMessage('');
          try {
            const result = await callRegister(`${registerApiRoot()}/api/v1/register/quota`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ device_id: device.id, device_secret: device.secret }),
            });
            if (!serviceActive()) return;
            setQuota(result);
            setQuotaAt(new Date().toLocaleTimeString());
            setQuotaStatus('ok');
            return result;
          } catch (error) {
            setQuota(null);
            setQuotaStatus('failed');
            setQuotaMessage(error?.status === 404
              ? t('quotaNotRegistered')
              : t('quotaFailed', { message: error?.message || String(error) }));
            throw error;
          }
        }

        /**
         * 使用记录：服务端按「设备标识 + 设备密钥」认出是本机那把 Key，
         * 再去读它的调用日志（谁什么时候出了片、消耗多少），一次任务只显示一行。
         */
        async function loadUsage() {
          if (!serviceMode || !serviceActive() || usageInFlight.current) return;
          usageInFlight.current = true;
          const device = deviceIdentity();
          setUsageStatus('working');
          setUsageMessage('');
          try {
            const result = await callRegister(`${registerApiRoot()}/api/v1/usage/list`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({
                device_id: device.id,
                device_secret: device.secret,
                limit: 10,
              }),
            });
            if (!serviceActive()) return;
            setUsage(result);
            setUsageAt(new Date().toLocaleTimeString());
            setUsageStatus('ok');
            return result;
          } catch (error) {
            setUsageStatus('failed');
            setUsageMessage(error?.status === 404
              ? t('quotaNotRegistered')
              : t('usageFailed', { message: error?.message || String(error) }));
            throw error;
          } finally {
            usageInFlight.current = false;
          }
        }

        /**
         * 上次的版本检查结果（存在浏览器本地）：`fresh` 表示还没过期，
         * 先用缓存显示结果；进入完整设置页仍会后台刷新，失败时保留缓存。
         */
        function readUpdateCache() {
          try {
            const raw = window.localStorage.getItem(UPDATE_CACHE_KEY);
            const saved = raw ? JSON.parse(raw) : null;
            if (!saved || typeof saved !== 'object') {
              return { latest: '', commit: '', at: 0, fresh: false };
            }
            const at = Number(saved.at) || 0;
            return {
              latest: String(saved.latest || ''),
              commit: String(saved.commit || ''),
              at,
              fresh: Boolean(at) && Date.now() - at < UPDATE_MAX_AGE_MS,
            };
          } catch {
            return { latest: '', commit: '', at: 0, fresh: false };
          }
        }

        /** 缓存里带上默认分支的提交号：在线更新要用它拼 spec 后缀，省一次联网。 */
        function rememberUpdateCheck(latest, commit) {
          try {
            window.localStorage.setItem(
              UPDATE_CACHE_KEY,
              JSON.stringify({ at: Date.now(), latest, commit: commit || '' }),
            );
          } catch {
            // 存不住只是下次打开会再查一遍，不影响这次的显示
          }
        }

        /** 更新成功后清掉缓存：新版本这次启动就该重新比对一次，不然还挂着「有新版本」。 */
        function forgetUpdateCheck() {
          try {
            window.localStorage.removeItem(UPDATE_CACHE_KEY);
          } catch {
            // 清不掉只是下次打开可能还显示旧结果，不影响更新本身
          }
        }

        /**
         * 检查更新：比 Gitee 上默认分支的版本号与本包版本。
         * silent 用于打开设置页时的自动检查——失败不打扰用户，页面上还是上次的结果。
         */
        async function checkForUpdate(silent = false) {
          if (!silent) {
            setUpdateStatus('working');
            setUpdateMessage('');
          }
          try {
            const latest = await fetchLatestVersion();
            // 提交号仅服务于安装，不阻塞版本检测结果。
            fetchLatestCommit().then((commit) => { updateCommit.current = commit; }).catch(() => {});
            setUpdateLatest(latest);
            setUpdateAt(new Date().toLocaleTimeString());
            setUpdateStatus('ok');
            rememberUpdateCheck(latest, updateCommit.current);
            return latest;
          } catch (error) {
            if (silent) return '';
            setUpdateStatus('failed');
            setUpdateMessage(t('versionFailed', { message: error?.message || String(error) }));
            return '';
          }
        }

        function control(field) {
          const current = draft[field.key] !== undefined ? draft[field.key] : value[field.key] ?? (field.key === 'pollIntervalMs' ? 5000 : field.key === 'maxWaitMs' ? 600000 : undefined);
          const secondsField = field.key === 'pollIntervalMs' || field.key === 'maxWaitMs';
          const displayed = secondsField && current !== undefined && current !== '' ? Number(current) / 1000 : current;
          const id = `metaontic-video-${field.key}`;
          if (field.kind === 'switch') {
            return h('label', { htmlFor: id, className: 'mov-switch' },
              h('input', {
                id,
                'data-field': field.key,
                type: 'checkbox',
                checked: Boolean(current),
                onChange: (event) => edit(field.key, event.target.checked),
              }),
              h('span', null, t(field.key)));
          }
          if (field.kind === 'select') {
            const options = SELECTS[field.key] || [];
            // 当前值不在候选表里（例如服务端刚换的型号）就把它补进去，避免下拉里看不到自己现在的取值
            const hiddenModel = field.key === 'model' && /seedance-2(?:-5|\.5)/i.test(String(current || ''));
            const legacyMerge = field.key === 'mergeMode' && current === 'seamless';
            const list = current && !options.includes(current) && !hiddenModel && !legacyMerge ? [...options, current] : options;
            return h('select', {
              id,
              'data-field': field.key,
              className: `mov-input${field.mono ? ' mov-mono' : ''}`,
              style: inputStyle,
              value: legacyMerge ? 'copy' : current ?? '',
              onChange: (event) => edit(field.key, event.target.value),
            }, [
              hiddenModel ? h('option', { key: 'hidden-current', value: current, hidden: true }, t('modelHiddenCurrent')) : null,
              ...list.map((option) => h('option', { key: option, value: option }, optionLabel(t, field.key, option))),
            ]);
          }
          const canReveal = field.key === 'metaonticApiKey' || field.key === 'volcengineApiKey';
          const revealed = canReveal && visibleKey === field.key;
          const input = h('input', {
            id,
            'data-field': field.key,
            className: `mov-input${field.mono ? ' mov-mono' : ''}`,
            style: inputStyle,
            type: field.kind === 'number' ? 'number' : (field.secret && !revealed ? 'password' : 'text'),
            value: displayed ?? '',
            min: secondsField ? 1 : undefined,
            step: secondsField ? 0.001 : undefined,
            placeholder: field.secret && (snapshot.secrets?.[field.key] || value[field.key]) ? t('apiKeyConfigured') : '',
            onChange: (event) => edit(
              field.key,
              field.kind === 'number' && event.target.value !== ''
                ? (secondsField ? Math.round(Number(event.target.value) * 1000) : Number(event.target.value))
                : event.target.value,
            ),
          });
          if (!canReveal) return input;
          return h('div', { className: 'mov-key-control' }, [
            input,
            h('button', {
              type: 'button', className: 'mov-key-eye',
              'aria-label': t(revealed ? 'hideKey' : 'showKey'),
              title: t(revealed ? 'hideKey' : 'showKey'),
              'data-action': `toggle-${field.key}`,
              'aria-controls': id, 'aria-pressed': revealed,
              onClick: () => setVisibleKey(revealed ? '' : field.key),
            }, h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, [
              h('path', { key: 'eye', d: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z' }),
              h('circle', { key: 'pupil', cx: 12, cy: 12, r: 3 }),
              revealed ? h('path', { key: 'slash', d: 'M3 3l18 18' }) : null,
            ])),
          ]);
        }

        // 少数需要解释的字段：模型选哪个（mini 便宜 / fast 贵一些）
        const hints = {
          connectionMode: t('connectionModeHint'),
          metaonticApiKey: t('metaonticKeyHint'),
          volcengineApiKey: t('volcengineKeyHint'),
          model: t('modelHint'),
          seamTrimSeconds: t('seamTrimSecondsHint'),
          maxWaitMs: t('waitSecondsHint'),
        };

        /** 一个可编辑字段：标签 + 控件（开关自带标签，就不重复画）。 */
        function fieldCell(field) {
          const classes = ['mov-field'];
          // 开关没有标签行，靠底对齐才能跟旁边输入框/下拉框的控制线齐平
          if (field.kind === 'switch') classes.push('mov-field-switch');
          if (field.wide) classes.push('mov-field-wide');
          return h('div', { key: field.key, className: classes.join(' ') }, [
            field.kind === 'switch'
              ? null
              : h('label', { key: 'label', className: 'mov-label', htmlFor: `metaontic-video-${field.key}` }, t(field.key)),
            control(field),
            hints[field.key] ? h('span', { key: 'hint', className: 'mov-hint', style: { marginTop: 4 } }, hints[field.key]) : null,
          ]);
        }

        // 配置区分成几节，每节一个标题 + 一个自适应网格。
        const renderGrid = (section) => h('div', { key: section.key, className: 'mov-grid' },
          section.fields.filter((key) => (key !== 'volcengineApiKey' || directMode)
            && (key !== 'metaonticApiKey' || selectedMode === 'metaontic'))
            .map((key) => fieldCell(FIELD_BY_KEY[key])).filter(Boolean));
        const rows = [
          h('div', { key: 'generation', className: 'mov-section' }, [
            h('div', { key: 'title', className: 'mov-section-title' }, t('sectionGeneration')),
            renderGrid(SECTIONS[0]),
          ]),
          h('details', { key: 'advanced', className: 'mov-section mov-advanced' }, [
            h('summary', { key: 'toggle', className: 'mov-advanced-toggle' }, [
              h('span', { key: 'title' }, t('sectionCombined')),
              h('span', { key: 'hint', className: 'mov-hint' }, t('sectionCombinedHint')),
            ]),
            h('div', { key: 'body', className: 'mov-advanced-body' }, [
              renderGrid({ key: 'advancedFields', fields: ['mergeMode', 'watermark', 'seamTrimSeconds', 'pollIntervalMs', 'maxWaitMs', 'ffmpegBinary', 'ffprobeBinary'] }),
              h('p', { key: 'toolsHint', className: 'mov-hint', style: { margin: 0 } }, t('toolsHint')),
              h('p', { key: 'retained', className: 'mov-hint', style: { margin: 0 } }, t('segmentsRetained')),
            ]),
          ]),
        ];

        // 操作条只在「有改动 / 正要给反馈」时出现：没有改动就没有「保存」按钮，
        // 页面干干净净，也不会有空点一下的疑问（「重置插件」不在这儿，它沉在页面最底部）。
        const overrides = Object.keys(snapshot.user || {});
        const footerMessage = status === 'saved'
          ? t('saved')
          : (status === 'reset' ? t('resetDone') : status === 'failed'
            ? (saveError || t('saveFailed'))
            : (pending.length ? t('dirty') : ''));
        const footer = (pending.length || status !== 'idle')
          ? h('div', { key: 'footer', className: 'mov-footer' }, [
            footerMessage
              ? h('span', {
                key: 'status',
                style: {
                  fontSize: 12,
                  color: status === 'failed' ? TOKENS.error : (status === 'saved' || status === 'reset' ? TOKENS.success : TOKENS.muted),
                },
              }, footerMessage)
              : null,
          ])
          : null;

        // 底部操作区：保存位于重置左侧；即使尚无覆盖配置，有草稿时也显示。
        const resetRow = overrides.length || pending.length
          ? h('div', { key: 'reset-row', className: 'mov-footer mov-reset-row' }, [
            h('span', { key: 'hint', className: 'mov-hint', style: { flex: '1 1 200px' } }, t('resetHint')),
            pending.length
              ? h('button', {
                key: 'save',
                'data-action': 'save',
                type: 'button',
                className: 'mov-btn mov-btn-primary',
                disabled: status === 'saving' || snapshot.writable === false,
                onClick: save,
              }, status === 'saving' ? t('saving') : t('save'))
              : null,
            h('button', {
              key: 'reset',
              'data-action': 'reset',
              type: 'button',
              className: 'mov-btn',
              disabled: status === 'saving' || snapshot.writable === false,
              onClick: reset,
            }, t('reset')),
          ])
          : null;

        const registerMessageColors = {
          ok: TOKENS.success,
          restored: TOKENS.success,
          partial: TOKENS.success,
          disabled: TOKENS.error,
          failed: TOKENS.error,
        };
        // 上游 / 地址 / Key 现在由注册流程写入，页面上不让手填。
        // 只有「服务端下发的」才算配好：手改到配置里的 Key 拿不到额度、调用也会被拒，
        // 这种情况要把注册区露出来，让用户点「登录」换回自己那把。
        const serverIssuedKey = value.keyOrigin === 'register'
          || Boolean(value.deviceId && value.deviceSecret && value.registerEmail);
        const keyReady = serviceMode && Boolean(snapshot.secrets?.apiKey || value.apiKey) && serverIssuedKey;
        // 邮箱是唯一标识，只发一把：已经配好 Key 的（注册过的或手填的）整块注册区直接隐藏，
        // 连「已经领到 Key 了」这类说明也不显示；要换 Key 只能找管理员。
        const registerText = registerStatus === 'ok'
          ? t('registerOk')
          : (registerStatus === 'partial'
            ? t('registerPartial')
            : (registerStatus === 'restored'
              ? t('registerRestored')
              : registerMessage));
        // 额度一律显示人民币：服务端已经按中转站的口径换算好（额度 / 500000 × 7.3），
        // 这里只负责拼符号与位数（与中转站一致：够 1 元保留 2 位，不到保留 4 位）。
        const quotaSymbol = quota && quota.currency_symbol ? quota.currency_symbol : '¥';
        const money = (field) => `${quotaSymbol}${formatMoney(quota ? quota[field] : 0)}`;
        const quotaReady = quotaStatus === 'ok' && quota;
        // 没读到额度时还是给一句话（读取中 / 还没领 Key），读到了就摊成三个数字块。
        const quotaFallback = keyReady ? t('quotaLoading') : t('quotaNoKey');
        const quotaStats = quotaReady
          ? [
            {
              key: 'remain',
              label: t('quotaRemain'),
              value: quota.unlimited_quota ? t('quotaUnlimited') : money('remain_amount'),
              color: TOKENS.success,
            },
            { key: 'used', label: t('quotaUsed'), value: money('used_amount'), color: TOKENS.text },
            { key: 'total', label: t('quotaTotal'), value: money('total_amount'), color: TOKENS.muted },
          ]
          : null;
        // 没登录就没有额度可言：整块不渲染（跟使用记录一个规矩）
        const quotaBox = serviceMode && keyReady ? h('div', {
          key: 'quota',
          'data-field': 'quota',
          className: 'mov-card mov-quota-compact',
        }, [
          h('div', { key: 'head', className: 'mov-card-head' }, [
            h('span', { key: 'title', className: 'mov-card-title' }, t('quotaTitle')),
          ]),
          quotaStats
            ? h('div', { key: 'text', 'data-field': 'quotaValue', className: 'mov-stats' },
              quotaStats.map((item) => h('div', { key: item.key, className: 'mov-stat' }, [
                h('span', { key: 'label', className: 'mov-stat-label' }, item.label),
                h('span', {
                  key: 'value',
                  className: 'mov-stat-value',
                  style: { color: item.color },
                }, item.value),
              ])))
            : h('span', {
              key: 'text',
              'data-field': 'quotaValue',
              className: 'mov-hint',
            }, quotaFallback),
          quotaReady
            ? h('span', { key: 'at', className: 'mov-foot-note' }, t('quotaUpdatedAt', { time: quotaAt }))
            : null,
          quotaMessage ? h('span', { key: 'message', className: 'mov-hint' }, quotaMessage) : null,
            keyReady
              ? h('button', {
                key: 'refresh',
                'data-action': 'quota-refresh',
                type: 'button',
                className: 'mov-btn mov-btn-sm mov-trailing',
                disabled: quotaStatus === 'working',
                onClick: () => { loadQuota().catch(() => {}); },
              }, t('quotaRefresh'))
              : null,

        ]) : null;

        /** 复制一段文本；剪贴板不可用就什么都不做，用户照样能照着敲。 */
        function copyText(text, mark) {
          try {
            const result = window.navigator?.clipboard?.writeText(text);
            if (result && typeof result.then === 'function') {
              result.then(() => {
                mark(text);
                window.setTimeout(() => mark(''), 2000);
              }, () => {});
            }
          } catch {
            // 复制失败不影响照着命令自己装 / 自己更新
          }
        }

        /** 复制 ffmpeg 安装命令。 */
        function copyCommand(command) {
          copyText(command, setCopiedFfmpeg);
        }

        /**
         * 一键在线更新：让宿主的插件管理服务把本插件重装一遍。
         *
         * 关键点是**先装、不卸载**：宿主对「同一个 spec 重复安装」直接拒绝（already-installed），
         * 所以 spec 带上默认分支当前最新的提交号——跟 profile 里记的那条永远不同，宿主当一条新依赖
         * 处理，pnpm 原地覆盖安装。这样装到一半失败（Gitee 限流、断网）时，手上这份插件还在；
         * 旧做法「先卸载再安装」一旦装不上，插件就没了。
         *
         * 期间本插件的客户端模块会被宿主换掉，这张设置页会短暂消失：属正常现象，
         * 更新完（或重启 Harness 后）再回来就是新版本。所以引用要提前取好。
         */
        async function runOnlineUpdate() {
          setUpdateConfirm(false);
          // 先把「更新中」摆上：重装会把本插件的客户端模块换掉，页面随时可能消失，
          // 用户至少要立刻看到按钮/文案变了，而不是以为点了没反应。
          setUpdateStatus('installing');
          setUpdateMessage('');
          const probe = manager ? manager() : { manager: null, tried: ['未注入'] };
          const pluginManager = probe.manager;
          if (!pluginManager || typeof pluginManager.installBundle !== 'function') {
            setUpdateStatus('failed');
            setUpdateMessage(t('versionUpdateUnavailable', { detail: probe.tried.join('，') }));
            return;
          }
          const requestId = `${PLUGIN_PACKAGE}-update-${Date.now()}`;
          const install = async (spec) => {
            try {
              return await pluginManager.installBundle(spec, { enabled: true, requestId });
            } catch (error) {
              return { ok: false, error: { message: error?.message || String(error) } };
            }
          };
          // 卸载只在「同 spec 已在 profile 里」这条兜底路上用（正常更新用不到）：
          // 卸载失败也继续装——没有 HMR 的宿主会报 stop-profile，安装会直接盖过去。
          const remove = async () => {
            if (typeof pluginManager.removeBundle !== 'function') return null;
            try {
              return await pluginManager.removeBundle(PLUGIN_PACKAGE);
            } catch (error) {
              return { ok: false, error: { message: error?.message || String(error) } };
            }
          };
          /** 宿主两种失败回包（调用失败 / 安装阶段失败）里那句可以给人看的话。 */
          const failureText = (result) => String(
            result?.error?.message
              ?? result?.value?.error?.diagnostic
              ?? result?.value?.error?.code
              ?? 'unknown',
          );
          /** 过一会儿可能就好的失败：Gitee 排队（429）、超时、连接被掐。 */
          const worthRetrying = (text) => /429|queue overflowed|timed out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|unable to access|network|fetch/i.test(text);

          /**
           * spec 的候选顺序（越靠前越准）：
           *   1) `#<默认分支最新提交号>`——Gitee API 活着时用这个；
           *   2) `#v<版本号>`——Gitee API 被限流（403）时退到 tag；每次发版都会打 tag（见 README「发版」）；
           *   3) 不带后缀的老 spec——前两条都解析不出来时的退路（只有这条路才可能要卸载）。
           * 带后缀的意义：spec 跟 profile 里记的那条不同，宿主才当新依赖原地覆盖安装，装失败也不会丢插件。
           */
          let commit = updateCommit.current || '';
          if (commit) updateCommit.current = commit;
          const candidates = [];
          if (updateLatest) candidates.push(`${UPDATE_SPEC}#v${updateLatest}`);
          if (commit) candidates.push(`${UPDATE_SPEC}#${commit}`);
          candidates.push(UPDATE_SPEC);

          /** 这条 spec 装不上时值不值得换下一条：只有「这个 committish 解析不出来」才换。 */
          const specUnresolvable = (text) => /Could not resolve|No matching version|ERR_PNPM_NO_MATCHING_VERSION/i.test(text);

          let removed = false;
          /** 装一条 spec：限流/超时自动重试，already-installed 走一次「卸了再装」的兜底。 */
          const trySpec = async (spec) => {
            for (let round = 1; round <= UPDATE_ATTEMPTS; round += 1) {
              let result = await install(spec);
              if (result?.ok === true && result.value?.error?.code === 'already-installed') {
                // profile 里已经记着这条 spec（上次刚好装到同一个提交）：卸载再装，强制刷一遍。
                removed = true;
                await remove();
                result = await install(spec);
              }
              if (result?.ok === true && result.value?.application !== 'failed') {
                return { outcome: result.value || {} };
              }
              const text = failureText(result);
              const transient = worthRetrying(text);
              if (transient && round < UPDATE_ATTEMPTS) {
                setUpdateMessage(t('versionUpdateRetry', { attempt: round + 1, total: UPDATE_ATTEMPTS }));
                await new Promise((resolve) => window.setTimeout(resolve, round * 1200));
                continue;
              }
              return { failure: text, next: !transient && specUnresolvable(text) };
            }
            return { failure: 'unknown' };
          };

          let outcome = null;
          let failure = '';
          for (const spec of candidates) {
            const attempt = await trySpec(spec);
            if (attempt.outcome) {
              outcome = attempt.outcome;
              break;
            }
            failure = attempt.failure || failure;
            // 换 spec 也没用的失败（限流、断网、权限）就停在这里，别把同一套错误在候选之间跑一遍
            if (!attempt.next) break;
          }

          if (!outcome) {
            setUpdateStatus('failed');
            setUpdateMessage([
              t('versionUpdateFailed', { message: failure }),
              removed ? t('versionUpdateRemoved') : '',
              worthRetrying(failure) || /429|queue overflowed/i.test(failure)
                ? t('versionUpdateRateLimited')
                : '',
            ].filter(Boolean).join(' '));
            return;
          }
          if (outcome.application === 'cancelled') {
            setUpdateStatus('ok');
            setUpdateMessage(t('versionUpdateCancelled'));
            return;
          }
          // 装好了：缓存作废，卡片不再是「有新版本」，只报更新结果
          forgetUpdateCheck();
          const version = outcome.version || updateLatest;
          setUpdateLatest('');
          setUpdateStatus('restart');
          setUpdateMessage(outcome.application === 'restart-required'
            ? t('versionUpdateRestart', { version })
            : t('versionUpdateDone', { version }));
        }

        /** 一条记录里的时间：只到分钟，够看清「什么时候出的片」。 */
        function usageTime(value) {
          if (!value) return '-';
          const at = new Date(value);
          if (Number.isNaN(at.getTime())) return '-';
          return at.toLocaleString(undefined, {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
        }

        // 使用记录：本机那把 Key 最近几次出片（一次任务一行，含消耗多少钱）。
        const usageRows = usage && Array.isArray(usage.items) ? usage.items : [];
        const usageSymbol = usage && usage.currency_symbol ? usage.currency_symbol : '¥';
        const usageSummaryText = usage
          ? (usageRows.length
            ? `${t('usageSummary', {
              count: usage.count,
              amount: `${usageSymbol}${formatMoney(usage.amount_sum)}`,
            })}${usage.truncated ? ` · ${t('usageMore', { count: usage.count })}` : ''}`
            : t('usageEmpty'))
          : (usageStatus === 'working' ? t('usageLoading') : t('usageKeyMissing'));
        const usageBox = serviceMode && keyReady ? h('div', {
          key: 'usage',
          'data-field': 'usage',
          className: 'mov-card',
        }, [
          h('div', { key: 'head', className: 'mov-card-head' }, [
            h('span', { key: 'title', className: 'mov-card-title' },
              t('usageTitle', { days: usage ? usage.window_days : 7 })),
            h('span', {
              key: 'summary',
              'data-field': 'usageSummary',
              className: 'mov-hint',
              style: { flex: '1 1 160px' },
            }, usageSummaryText),
            h('button', {
              key: 'refresh',
              'data-action': 'usage-refresh',
              type: 'button',
              className: 'mov-btn mov-btn-sm',
              disabled: usageStatus === 'working',
              onClick: () => { loadUsage().catch(() => {}); },
            }, t('usageRefresh')),
          ]),
          usageRows.length ? h('div', {
            key: 'table',
            className: 'mov-table',
          }, [
            h('div', {
              key: 'head-row',
            'data-field': 'usage-head',
              className: 'mov-table-head',
            }, [
              h('span', { key: 'time' }, t('usageColTime')),
              h('span', { key: 'kind' }, t('usageColKind')),
              h('span', { key: 'model' }, t('usageColModel')),
              h('span', { key: 'cost' }, t('usageColCost')),
              h('span', { key: 'status' }, t('usageColStatus')),
            ]),
            ...usageRows.map((row, index) => h('div', {
              key: `${row.id}-${index}`,
              'data-field': 'usage-row',
              className: 'mov-table-row',
            }, [
              h('span', { key: 'time', className: 'mov-num', style: { color: TOKENS.muted } },
                usageTime(row.created_at)),
              h('span', { key: 'kind' }, row.kind_label || ''),
              // 模型 ID 是这一行最有用的信息之一（换过模型一眼能看出来是哪次用的哪个）
              h('span', {
                key: 'model',
                className: 'mov-model',
                title: row.model || '',
              }, row.model || '—'),
              h('span', {
                key: 'amount',
                'data-field': 'usage-amount',
                className: 'mov-num',
                style: { color: row.status === 'succeeded' ? TOKENS.success : TOKENS.muted },
              }, `${usageSymbol}${formatMoney(row.amount)}`),
              h('span', { key: 'status' },
                h('span', {
                  key: 'chip',
                  className: `mov-chip ${row.status === 'succeeded' ? 'mov-chip-ok' : 'mov-chip-bad'}`,
                }, row.status === 'succeeded' ? t('usageStatusOk') : t('usageStatusFailed'))),
            ])),
          ]) : null,
          usageAt ? h('span', { key: 'updated-at', className: 'mov-foot-note' }, t('quotaUpdatedAt', { time: usageAt })) : null,
          usageMessage ? h('span', { key: 'message', className: 'mov-hint' }, usageMessage) : null,
        ]) : null;

        // 版本卡片：当前版本是构建时注入的常量，最新版本来自 Gitee 默认分支的 package.json。
        // 有新版本时给出升级命令——用 git 源装的插件不会出现在「已安装」里的更新按钮上。
        const updateAvailable = Boolean(updateLatest) && Boolean(PLUGIN_VERSION)
          && isNewerVersion(updateLatest, PLUGIN_VERSION);
        const updateText = updateStatus === 'working'
          ? t('versionChecking')
          : (updateStatus === 'failed'
            ? updateMessage
            : (updateStatus === 'installing'
              ? t('versionUpdating')
              : (updateStatus === 'restart'
                ? updateMessage
                : (updateStatus === 'ok'
                  ? (updateAvailable ? t('versionNew', { version: updateLatest }) : t('versionLatest'))
                  : ''))));
        // 失败红、成功绿（更新完/有新版本），其余用灰度文字
        const updateTone = updateStatus === 'failed'
          ? TOKENS.error
          : (updateStatus === 'restart' || updateAvailable ? TOKENS.success : TOKENS.muted);
        const versionBox = h('div', {
          key: 'version',
          'data-field': 'version',
          className: 'mov-card',
        }, [
          h('div', { key: 'head', className: 'mov-card-head' }, [
            h('span', { key: 'title', className: 'mov-card-title' }, t('versionTitle')),
            h('span', {
              key: 'current',
              'data-field': 'versionCurrent',
              className: 'mov-hint mov-current-version',
            }, [
              h('span', { key: 'label' }, PLUGIN_VERSION ? t('versionCurrent', { version: PLUGIN_VERSION }) : ''),
              updateBell(t, updateLatest, PLUGIN_VERSION),
            ]),
            h('a', { key: 'history', className: 'mov-hint', href: 'https://github.com/wxsimon2022/metaontic-video/blob/master/CHANGELOG.md', target: '_blank', rel: 'noopener noreferrer' }, t('versionHistory')),
            h('button', {
              key: 'check',
              'data-action': 'update-check',
              type: 'button',
              className: 'mov-btn mov-btn-sm mov-trailing',
              disabled: updateStatus === 'working' || updateStatus === 'installing',
              onClick: () => { checkForUpdate(false).catch(() => {}); },
            }, updateStatus === 'working' ? t('versionChecking') : t('versionCheck')),
          ]),
          releaseNotes?.items?.length ? h('div', { key: 'release-notes', 'data-field': 'releaseNotes' }, [
            h('span', { key: 'title', className: 'mov-card-title' }, `${releaseNotes.version} · ${t('releaseNotesTitle')}`),
            h('ul', { key: 'items', style: { margin: '8px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: TOKENS.muted } },
              releaseNotes.items.map((item, index) => h('li', { key: index }, item))),
          ]) : null,
          updateText
            ? h('span', {
              key: 'state',
              'data-field': 'versionState',
              className: 'mov-hint',
              style: { color: updateTone },
            }, updateText)
            : null,
          updateAvailable
            ? h('div', { key: 'command', className: 'mov-cmd-row' }, [
              // 点一下转成「确认更新」，再点一下让宿主重装本插件
              h('button', {
                key: 'online',
                'data-action': 'update-online',
                type: 'button',
                className: 'mov-btn mov-btn-sm mov-btn-primary',
                disabled: updateStatus === 'installing',
                onClick: () => {
                  if (updateConfirm) runOnlineUpdate().catch(() => {});
                  else setUpdateConfirm(true);
                },
              }, updateStatus === 'installing'
                ? t('versionUpdating')
                : (updateConfirm
                  ? t('versionUpdateConfirm', { version: updateLatest })
                  : t('versionUpdate'))),
            ])
            : null,
          updateAvailable && updateConfirm
            ? h('span', {
              key: 'confirm-hint',
              'data-field': 'updateConfirmHint',
              className: 'mov-hint',
            }, t('versionUpdateConfirmHint'))
            : null,
          updateAvailable ? h('span', { key: 'hint', className: 'mov-hint' }, t('versionHint')) : null,
          (updateStatus === 'ok' && updateAt)
            ? h('span', { key: 'at', className: 'mov-foot-note' }, t('versionCheckedAt', { time: updateAt }))
            : null,
        ]);

        // 有 Key 就整块不渲染（连标题、提示文字都没有），页面上只剩配置项 + 额度卡片。
        const registerBox = keyReady || !serviceMode ? null : h('div', {
          key: 'register',
          className: 'mov-card',
          style: { gap: 10 },
        }, [
          h('div', { key: 'text', style: { display: 'flex', flexDirection: 'column', gap: 4 } }, [
            h('span', { key: 'title', className: 'mov-card-title' },
              t('registerTitle')),
            h('span', { key: 'hint', className: 'mov-hint' }, t('registerHint')),
          ]),
          h('div', { key: 'form', className: 'mov-register-form' }, [
          h('input', {
            key: 'email',
            'data-field': 'registerEmail',
            type: 'text',
            className: 'mov-input',
            value: registerEmail,
            placeholder: t('registerEmailPlaceholder'),
            'aria-label': t('registerEmail'),
            // 验证码已经发出去了：冷却期内不让改邮箱，免得「码发到 A、注册填 B」
            disabled: emailLocked,
            'data-locked': emailLocked ? 'true' : 'false',
            title: emailLocked ? t('registerEmailLocked') : undefined,
            onChange: (event) => setRegisterEmail(event.target.value),
            style: {
              ...inputStyle,
              flex: '1 1 220px',
              width: 'auto',
              opacity: emailLocked ? 0.6 : 1,
              cursor: emailLocked ? 'not-allowed' : 'text',
            },
          }),
          h('button', {
            key: 'code',
            'data-action': 'send-code',
            type: 'button',
            className: 'mov-btn',
            disabled: codeStatus === 'working' || codeCooldown > 0 || !registerEmail.trim(),
            onClick: () => { sendEmailCode().catch(() => {}); },
          }, codeCooldown > 0
            ? t('registerCodeCooldown', { seconds: codeCooldown })
            : (codeStatus === 'working' ? t('registerCodeSending') : t('registerCodeSend'))),
          h('input', {
            key: 'code-input',
            'data-field': 'registerCode',
            type: 'text',
            inputMode: 'numeric',
            className: 'mov-input',
            value: registerCode,
            placeholder: t('registerCodePlaceholder'),
            'aria-label': t('registerCode'),
            onChange: (event) => setRegisterCode(event.target.value),
            style: { ...inputStyle, flex: '0 1 130px', width: 'auto' },
          }),
          h('button', {
            key: 'button',
            'data-action': 'register',
            type: 'button',
            className: 'mov-btn mov-btn-primary',
            disabled: registerStatus === 'working'
              || !registerEmail.trim()
              || !registerCode.trim()
              || snapshot.writable === false,
            onClick: register,
          }, registerStatus === 'working' ? t('registerWorking') : t('register')),
          ]),
          codeMessage
            ? h('span', {
              key: 'code-message',
              'data-field': 'codeMessage',
              style: {
                flex: '1 1 100%',
                fontSize: 12,
                color: codeStatus === 'failed' ? TOKENS.error : TOKENS.success,
              },
            }, codeMessage)
            : null,
          registerText
            ? h('span', {
              key: 'message',
              style: { flex: '1 1 100%', fontSize: 12, color: registerMessageColors[registerStatus] || TOKENS.muted },
            }, registerText)
            : null,
        ]);

        let notice = null;
        if (snapshot.status === 'loading') notice = t('loading');
        else if (snapshot.value === undefined) notice = t('unavailable');
        else if (snapshot.writable === false) notice = t('readOnly');

        // 配置读不出来（没有表单 / 不可写）时只显示提示，配置项与卡片一律不渲染。
        const blobs = notice && !snapshot.value
          ? []
          : [registerBox, footer, resetRow, ...(serviceMode ? [quotaBox, usageBox] : []), versionBox];

        return h('div', { className: 'mov-page' }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 mov- 前缀）。
          h('style', { key: 'styles' }, PAGE_CSS),
          notice ? h('p', { key: 'notice', className: 'mov-notice' }, notice) : null,
          ...(notice && !snapshot.value ? [] : rows),
          ...blobs,
        ]);
      };
    }

    function estimatedVideoProgress(elapsed, succeeded) {
      if (succeeded) return 100;
      const seconds = Math.max(0, Number(elapsed) || 0);
      // 按三分钟匀速推进；实际结果返回前始终停在 99%。
      return Math.min(99, Math.max(1, Math.floor(seconds / 180 * 99)));
    }

    /** 宿主工具卡片：仅消费实际运行状态，等待动画不代表百分比进度。 */
    function VideoTaskProgress({ block = {}, toolName = 'video_generate', callId }: { block?: any; toolName?: string; callId?: string }) {
      const done = 'kind' in block;
      const [elapsed, setElapsed] = React.useState(0);
      const began = React.useRef(Date.now());
      React.useEffect(() => {
        if (done) return;
        const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - began.current) / 1000)), 1000);
        return () => window.clearInterval(timer);
      }, [done, callId]);
      const failed = Boolean(block.isError || block.error);
      const status = done ? (failed ? '执行失败或已停止' : '本次任务已返回')
        : block.phase === 'preparing' ? '准备参数 / 等待授权' : '正在执行 · 等待生成结果';
      const output = Array.isArray(block.content) ? block.content
        .filter((part) => part.type === 'text').map((part) => part.text).join('\n') : '';
      const succeeded = done && !failed && /视频生成成功|视频延长成功|已生成并交付|已延长并交付|succeeded/.test(output);
      const progress = estimatedVideoProgress(elapsed, succeeded);
      const waitingDots = '.'.repeat((elapsed % 3) + 1);
      const duration = block.args?.duration;
      const title = toolName === 'video_extend' ? '视频续拍' : toolName === 'video_status' ? '查询视频状态' : '视频生成';
      return h('div', { className: 'mov-task', 'data-field': 'video-task-progress' }, [
        h('style', { key: 'style' }, `
          @keyframes mov-task-spin { to { transform: rotate(360deg); } }
          @keyframes mov-task-flow { from { background-position:0 0; } to { background-position:32px 0; } }
          @keyframes mov-task-shimmer { from { transform:translateX(-120%); } to { transform:translateX(420%); } }
          @keyframes mov-task-pulse { 0%,100% { opacity:.45; } 50% { opacity:1; } }
          .mov-task { border:1px solid ${TOKENS.border}; border-radius:10px; padding:12px 14px; color:${TOKENS.text}; margin:6px 0; }
          .mov-task-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13px; }
          .mov-task-spinner { width:14px; height:14px; border:2px solid ${TOKENS.border}; border-top-color:${TOKENS.primaryFill}; border-radius:50%; animation:mov-task-spin .9s linear infinite; }
          .mov-task-note { font-size:12px; color:${TOKENS.muted}; margin-top:8px; }
          .mov-task-track { height:5px; border-radius:999px; overflow:hidden; background:${TOKENS.border}; margin-top:10px; }
          .mov-task-fill { height:100%; border-radius:999px; background:${TOKENS.primaryFill}; transition:width 1s ease; position:relative; overflow:hidden; }
          .mov-task-active .mov-task-fill { background-image:repeating-linear-gradient(110deg,transparent 0px,transparent 12px,rgba(255,255,255,.22) 12px,rgba(255,255,255,.22) 22px,transparent 22px,transparent 32px); background-size:32px 100%; animation:mov-task-flow 1s linear infinite; }
          .mov-task-active .mov-task-fill::after { content:''; position:absolute; inset:0; width:30%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent); animation:mov-task-shimmer 2s linear infinite; }
          .mov-task-live { display:inline-block; width:6px; height:6px; border-radius:50%; background:${TOKENS.primaryFill}; margin-right:6px; animation:mov-task-pulse 1.4s ease-in-out infinite; }
          .mov-task-dots { display:inline-block; width:18px; text-align:left; }
          .mov-task-output { white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; max-height:320px; overflow:auto; }
          @media(prefers-reduced-motion:reduce) { .mov-task-spinner, .mov-task-live, .mov-task-active .mov-task-fill, .mov-task-active .mov-task-fill::after { animation:none; } }
        `),
        h('div', { key: 'head', className: 'mov-task-head' }, [
          !done ? h('span', { key: 'spinner', className: 'mov-task-spinner', 'aria-hidden': true }) : null,
          h('strong', { key: 'title' }, title),
          h('span', { key: 'status', role: 'status' }, [status, !done ? h('span', { key: 'dots', className: 'mov-task-dots', 'aria-hidden': true }, waitingDots) : null]),
          !done ? h('span', { key: 'elapsed', style: { marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' } },
            `已等待 ${Math.floor(elapsed / 60)}分${String(elapsed % 60).padStart(2, '0')}秒`) : null,
        ]),
        h('div', { key: 'progress', className: `mov-task-track${!done ? ' mov-task-active' : ''}`, role: 'progressbar', 'aria-label': '估算进度', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progress },
          h('div', { className: 'mov-task-fill', style: { width: `${progress}%`, background: failed ? TOKENS.error : undefined } })),
        h('div', { key: 'percent', className: 'mov-task-note' }, `${progress}%${succeeded ? ' · 本次生成完成' : ' · 估算进度'}${failed ? ' · 执行失败或已停止' : ''}`),
        !done ? h('div', { key: 'note', className: 'mov-task-note' },
          [
            h('span', { key: 'live', className: 'mov-task-live', 'aria-hidden': true }),
            `${duration ? `目标 ${duration} 秒 · ` : ''}${progress >= 99 ? '任务仍在等待结果，进度停在99%不表示失败。' : '任务处理中，完成后自动显示结果。'}请勿重复提交。`,
          ]) : null,
        done && output ? h('details', { key: 'output', open: failed }, [
          h('summary', { key: 'toggle', className: 'mov-task-note' }, failed ? '查看错误详情' : '查看视频结果与文件路径'),
          h('pre', { key: 'text', className: 'mov-task-output' }, output),
        ]) : null,
      ]);
    }

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'metaontic-video: dictionaries');
        const form = ctx.configForms.get(NAMESPACE);
        ctx.effect(() => ctx.slots.inject('tool.call.toolview', function* () {
          for (const tool of ['video_generate', 'video_extend', 'video_status']) {
            yield ctx.slots.register({ name: 'tool.call.toolview', key: tool, locale: NS }, VideoTaskProgress);
          }
        }), 'metaontic-video: video task progress');
        // 在线更新要用宿主的插件管理服务。它不是一个 `remote` 上的属性，而是宿主远程层按
        // 「命名空间服务」注册的独立服务，名字就是带点的 `remote.pluginManager`（cordis 的
        // `ctx.get()` 认这种名字）；所以先按全名取，取不到再退回属性写法，两条都记下来，
        // 失败时把结果写进提示里，省得又变成「点了没反应」。
        // 包一层 getter：点击时才取，重装过程里本插件马上会被卸掉，引用要赶在卸载之前拿到。
        const pluginManager = () => {
          const tried = [];
          const shape = (value) => (value === undefined ? 'undefined' : (value === null ? 'null' : typeof value));
          try {
            const direct = typeof ctx.get === 'function' ? ctx.get('remote.pluginManager') : undefined;
            if (direct && typeof direct.installBundle === 'function') return { manager: direct, tried };
            tried.push(`remote.pluginManager=${shape(direct)}`);
          } catch (error) {
            tried.push(`remote.pluginManager 抛错：${error && error.message ? error.message : String(error)}`);
          }
          try {
            const remote = typeof ctx.get === 'function' ? ctx.get('remote') : undefined;
            const nested = remote && remote.pluginManager;
            if (nested && typeof nested.installBundle === 'function') return { manager: nested, tried };
            tried.push(`remote=${shape(remote)}`);
          } catch (error) {
            tried.push(`remote 抛错：${error && error.message ? error.message : String(error)}`);
          }
          return { manager: null, tried };
        };
        const Page = makePage({ form, t, manager: pluginManager });
        // 第三方 bundle 的配置页注册到 plugins.bundle.config，以 npm 包名为 key；
        // 打开「已安装插件」里的 metaontic-video 详情页时显示在描述与组件行之间。
        ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: NAMESPACE,
          locale: NS,
        }, Page)), 'metaontic-video: configuration page');
      },
    };
  },
});
