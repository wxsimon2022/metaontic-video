/**
 * MetaOnticVideo 插件的浏览器半侧：在侧栏「插件」页里给本插件加一张配置卡片，
 * 直接编辑 Host 侧的配置（写进 profile 的 cordis.patch.yml）。
 *
 * 数据通道用宿主客户端的 `configForms` 服务（`dsh-client-ui-settings` 提供）：
 *   - `ctx.configForms.get('<entry id>')` 取得该条目的表单控制器；
 *   - `form.getSnapshot()` 读当前值/修订号，`form.subscribe()` 订阅变化；
 *   - `form.set(field, value)` / `form.unset(field)` 排队写入，修订号由宿主校验。
 * 页面注册进插件页的 `plugins.bundle.config` 槽位，key 为本包名 metaontic-video；
 * 卡片底部还有「激活」按钮：向注册服务申请一个中转站密钥（新 API Key），
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
      summaryEmpty: '未配置：到插件设置页点「激活」领一把密钥。',
      summary: '{provider} · {model} · 每段 {duration}s',
      providerNewapi: 'New API 中转站',
      apiKeyConfigured: '已配置，留空表示保持原值',
      model: '模型',
      duration: '每段秒数',
      singleMaxSeconds: '直出上限（秒）',
      mergeMode: '合并方式',
      mergeModeCopy: '无损拼接',
      mergeModeReencode: '重编码拼接',
      outputDir: '输出目录',
      keepSegments: '保留分段',
      ffmpegBinary: 'ffmpeg 路径',
      ffprobeBinary: 'ffprobe 路径',
      ffmpegTitle: '长视频合并需要 ffmpeg',
      ffmpegBody: '生成超过单段上限的长视频（比如 20 秒、25 秒）时，插件会在本机把多段合并成一条，'
        + '这一步用的是 ffmpeg。没装也能生成，只是只给分段列表、不合成整条。',
      ffmpegInstallFor: '按你的系统装一下（点右边按钮复制命令）：',
      ffmpegCopy: '复制',
      ffmpegCopied: '已复制',
      ffmpegMore: '其他系统',
      ffmpegLess: '收起其他系统',
      ffmpegAfter: '装好后重跑一次就会自动合并（不用重新生成）；ffmpeg 装在非默认位置的话，'
        + '把绝对路径填到上面的「ffmpeg 路径」也一样管用。安装包自带 ffprobe，分段时长探测会一起解决。',
      ffmpegManual: '想自己装：macOS 用 Homebrew，Windows 用 winget，Linux 用系统包管理器；'
        + '装完确认命令行里能跑 ffmpeg -version 就行。',
      registerEmail: '邮箱（账号）',
      registerTitle: '没有 API Key？',
      registerHint: '用邮箱领：填邮箱 → 点「获取验证码」→ 把邮件里的数字填进来 → 点「激活」。'
        + '邮箱就是你的账号，一个邮箱只发一把 Key；成功后自动写好上游、Key、地址与模型，默认额度 ¥0.01。',
      registerEmailPlaceholder: '你的邮箱，例如 name@example.com',
      registerCode: '验证码',
      registerCodePlaceholder: '邮件里的数字',
      registerCodeSend: '获取验证码',
      registerCodeSending: '发送中…',
      registerCodeCooldown: '{seconds} 秒后重发',
      registerCodeSent: '验证码已发到 {email}：5 分钟内有效，填进来点右边的按钮即可。',
      registerEmailLocked: '验证码刚发到上面这个邮箱：等倒计时结束才能改。',
      registerNeedEmail: '先填邮箱，再点「获取验证码」。',
      registerNeedCode: '先填邮件里收到的验证码。',
      registerRestored: '已找回本机密钥：这台设备之前领过的那把帮你填好了，点「保存」即可。',
      quotaTitle: '额度（当前这把 Key）',
      quotaSummary: '剩余 {remain} · 已用 {used} · 总量 {total}',
      quotaUnlimited: '不限额度',
      quotaLoading: '读取额度中…',
      quotaRefresh: '刷新额度',
      quotaNoKey: '还没有密钥：注册后这里会显示剩余 / 已用额度。',
      quotaNotRegistered: '服务端没有这台设备的注册记录（换过设备 / 清过数据）：请联系管理员处理后重新领取。',
      quotaFailed: '读取额度失败：{message}',
      quotaUpdatedAt: '更新于 {time}',
      usageTitle: '使用记录（最近 {days} 天）',
      usageSummary: '{count} 条 · 费用合计 {amount}',
      usageColTime: '时间',
      usageColKind: '类型',
      usageColResolution: '分辨率',
      usageColCost: '费用',
      usageColStatus: '结果',
      usageEmpty: '还没有记录：生成或续拍过视频后，这里会按时间列出最近几次。',
      usageLoading: '读取使用记录中…',
      usageRefresh: '刷新记录',
      usageFailed: '读取使用记录失败：{message}',
      usageMore: '时间窗内还有更早的记录，这里只显示最近的 {count} 条。',
      usageKeyMissing: '还没有密钥：领到 Key 之后，这里会显示用它出片的记录。',
      usageStatusOk: '成功',
      usageStatusFailed: '失败',
      register: '激活',
      registerWorking: '注册中…',
      registerOk: '注册成功：上游 / Key / 地址 / 模型都写好了，宿主重载配置后生效。',
      registerPartial: '已拿到密钥，但有字段宿主没接受，请检查后手动保存。',
      registerFailed: '注册失败：{message}',
      registerDisabled: '注册服务不可用：{message}',
      registerNoKey: '注册服务没有返回密钥（后端中转站配置可能有问题）。',
      mode: '续拍方式',
      modeContinuous: '同机位连续',
      modeCloseup: '切近景',
      resolution: '分辨率',
      ratio: '画面比例',
      generateAudio: '生成音频',
      watermark: '加水印',
      extraParams: '额外参数（JSON）',
      pollIntervalMs: '轮询间隔（毫秒）',
      maxWaitMs: '单次最长等待（毫秒）',
      save: '保存',
      reset: '恢复默认',
      saving: '保存中…',
      saved: '已保存，宿主重载配置后生效。',
      saveFailed: '宿主拒绝了这次写入，请检查字段取值。',
      dirty: '有未保存的改动',
      clean: '没有改动',
      loading: '读取配置中…',
      unavailable: '宿主还没有把本条目当作可编辑设置项提供服务（配置命名空间 metaontic-video 未就绪）。若 profile 的 cordis.patch.yml 里已有该条目，请重启 Harness 让宿主重新加载；重启后仍是这句话，就是宿主版本与插件的设置接口不匹配。',
      readOnly: '当前 profile 不接受表单写入。',
    };
    const en = {
      summaryEmpty: 'Not configured: open the plugin settings and click "Register & fill in".',
      summary: '{provider} · {model} · {duration}s per segment',
      providerNewapi: 'New API relay',
      apiKeyConfigured: 'Configured; leave empty to keep it',
      model: 'Model',
      duration: 'Seconds per segment',
      singleMaxSeconds: 'Direct generation limit (s)',
      mergeMode: 'Merge mode',
      mergeModeCopy: 'Stream copy',
      mergeModeReencode: 'Re-encode',
      outputDir: 'Output directory',
      keepSegments: 'Keep segments',
      ffmpegBinary: 'ffmpeg path',
      ffprobeBinary: 'ffprobe path',
      ffmpegTitle: 'Merging long videos needs ffmpeg',
      ffmpegBody: 'For videos longer than one segment (say 20s or 25s) the plugin merges the pieces '
        + 'on this machine, which needs ffmpeg. Without it you still get the video — just as separate '
        + 'segments, not one file.',
      ffmpegInstallFor: 'Install it for your OS (click the button to copy the command):',
      ffmpegCopy: 'Copy',
      ffmpegCopied: 'Copied',
      ffmpegMore: 'Other systems',
      ffmpegLess: 'Hide other systems',
      ffmpegAfter: 'Re-run the generation once it is installed and the merge happens automatically '
        + '(no need to regenerate). Installed somewhere unusual? Put the absolute path in the "ffmpeg path" '
        + 'field above. The package ships ffprobe too, so segment probing is fixed at the same time.',
      ffmpegManual: 'Installing by hand: Homebrew on macOS, winget on Windows, your distro package '
        + 'manager on Linux — you are set once `ffmpeg -version` works in a terminal.',
      registerEmail: 'Email (this is your account)',
      registerTitle: 'No API key yet?',
      registerHint: 'Register with your email: type it, click "Send code", then paste the number from the mail '
        + 'and click "Register & fill in". One email gets one key. Provider, key, base URL and model are filled '
        + 'in for you. Default quota ¥0.01.',
      registerEmailPlaceholder: 'you@example.com',
      registerCode: 'Verification code',
      registerCodePlaceholder: 'code from the mail',
      registerCodeSend: 'Send code',
      registerCodeSending: 'Sending…',
      registerCodeCooldown: 'Resend in {seconds}s',
      registerCodeSent: 'Code sent to {email} — valid for 5 minutes.',
      registerEmailLocked: 'Code just went to this address — edit it after the countdown.',
      registerNeedEmail: 'Type your email before requesting a code.',
      registerNeedCode: 'Type the code from the email first.',
      registerRestored: 'Restored the key issued to this device; click Save to apply.',
      quotaTitle: 'Quota (current key)',
      quotaSummary: 'Remaining {remain} · used {used} · total {total}',
      quotaUnlimited: 'Unlimited',
      quotaLoading: 'Reading quota…',
      quotaRefresh: 'Refresh quota',
      quotaNoKey: 'No key yet — remaining / used quota shows here after registration.',
      quotaNotRegistered: 'The service has no registration for this device (new device or cleared data) — ask an admin to reset it.',
      quotaFailed: 'Failed to read quota: {message}',
      quotaUpdatedAt: 'updated {time}',
      register: 'Register & fill in',
      registerWorking: 'Registering…',
      registerOk: 'Registered: provider, key, base URL and model written; applies after the config reload.',
      registerPartial: 'Key received, but some fields were rejected; please review and save manually.',
      registerFailed: 'Registration failed: {message}',
      registerDisabled: 'Register service unavailable: {message}',
      registerNoKey: 'The register service returned no key (check the relay configuration).',
      mode: 'Continuation',
      modeContinuous: 'Same camera',
      modeCloseup: 'Cut to close-up',
      resolution: 'Resolution',
      ratio: 'Aspect ratio',
      generateAudio: 'Generate audio',
      watermark: 'Watermark',
      extraParams: 'Extra params (JSON)',
      pollIntervalMs: 'Poll interval (ms)',
      maxWaitMs: 'Max wait (ms)',
      save: 'Save',
      reset: 'Reset to defaults',
      saving: 'Saving…',
      saved: 'Saved; the Host applies it after the config reload.',
      saveFailed: 'The Host rejected this write; check the field values.',
      dirty: 'Unsaved changes',
      clean: 'No changes',
      loading: 'Reading configuration…',
      unavailable: 'This Host does not serve this entry as an editable setting yet (namespace metaontic-video is not ready). If the row already exists in the profile cordis.patch.yml, restart Harness so the Host reloads it; if the message persists, the Host version and the plugin settings interface do not match.',
      readOnly: 'This profile does not accept form writes.',
    };

    /** 可编辑字段；kind 决定控件，标注 secret 的字段宿主只会告知是否已配置。 */
    const SELECTS = {
      mode: ['continuous', 'closeup'],
      resolution: ['480p', '720p', '1080p'],
      ratio: ['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'],
      mergeMode: ['copy', 'reencode'],
    };
    const FIELDS = [
      { key: 'model', kind: 'text' },
      { key: 'duration', kind: 'number' },
      { key: 'singleMaxSeconds', kind: 'number' },
      { key: 'mode', kind: 'select' },
      { key: 'resolution', kind: 'select' },
      { key: 'ratio', kind: 'select' },
      { key: 'generateAudio', kind: 'switch' },
      { key: 'watermark', kind: 'switch' },
      { key: 'extraParams', kind: 'text' },
      { key: 'pollIntervalMs', kind: 'number' },
      { key: 'maxWaitMs', kind: 'number' },
      { key: 'mergeMode', kind: 'select' },
      { key: 'outputDir', kind: 'text' },
      { key: 'keepSegments', kind: 'switch' },
      { key: 'ffmpegBinary', kind: 'text' },
      { key: 'ffprobeBinary', kind: 'text' },
    ];

    /** 插件设置页「注册」按钮调用的服务地址：固定这个，不显示也不允许改。 */
    const DEFAULT_REGISTER_API = 'https://video.mybfs.cn';
    /** 注册接口的握手请求头 X-Register-Token：与服务端 REGISTER_CLIENT_TOKEN 一致。 */
    const DEFAULT_REGISTER_TOKEN = 'metaontic-video-register-v1';

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

    const inputStyle = {
      width: '100%',
      boxSizing: 'border-box',
      padding: '6px 8px',
      borderRadius: 6,
      border: `1px solid ${TOKENS.border}`,
      background: TOKENS.controlFill,
      color: TOKENS.text,
      font: 'inherit',
    };
    const labelStyle = { display: 'block', fontSize: 12, color: TOKENS.muted, marginBottom: 4 };
    const cellStyle = { display: 'flex', flexDirection: 'column', minWidth: 180 };

    function optionLabel(t, key, option) {
      if (key === 'mode') return option === 'closeup' ? t('modeCloseup') : t('modeContinuous');
      if (key === 'mergeMode') return option === 'reencode' ? t('mergeModeReencode') : t('mergeModeCopy');
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

    function makePage({ form, t }) {
      return function ConfigPage(props) {
        const snapshot = useSnapshot(form);
        const value = snapshot.value || {};
        const [draft, setDraft] = React.useState({});
        const [status, setStatus] = React.useState('idle');
        const [registerStatus, setRegisterStatus] = React.useState('idle');
        const [registerMessage, setRegisterMessage] = React.useState('');
        // 注册用「邮箱（账号）+ 邮件验证码」：邮箱一次只发一把 Key
        const [registerEmail, setRegisterEmail] = React.useState(() => {
          const saved = form.getSnapshot().value || {};
          return String(saved.registerEmail || saved.registerUser || '');
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
        // ffmpeg 安装引导：默认只展示当前系统那条，可展开看其他系统；复制过的命令给个「已复制」反馈
        const [showAllFfmpeg, setShowAllFfmpeg] = React.useState(false);
        const [copiedFfmpeg, setCopiedFfmpeg] = React.useState('');

        // 打开设置页时，若本机还没配 Key，就先问服务端要回自己那把（设备绑定过就能取回）
        const restoreTried = React.useRef(false);
        React.useEffect(() => {
          if (restoreTried.current) return;
          restoreTried.current = true;
          // 设备凭据同步进配置：主进程要在调用模型前拿它查余额
          syncDeviceIdentity().catch(() => {});
          const snap = form.getSnapshot() || {};
          if (snap.secrets?.apiKey || (snap.value || {}).apiKey) {
            loadQuota().catch(() => {});
            loadUsage().catch(() => {});
            return;
          }
          lookupOwnKey().catch(() => {});
        }, []);

        if (props && props.view === 'summary') {
          const configured = Boolean(value.model) || Boolean(snapshot.secrets?.apiKey);
          const text = configured
            ? t('summary', { provider: t('providerNewapi'), model: value.model || '-', duration: value.duration ?? '-' })
            : t('summaryEmpty');
          return h('span', { style: { color: TOKENS.muted } }, text);
        }

        const pending = Object.entries(draft).filter(([key, next]) => !same(value[key], next));
        const edit = (key, next) => setDraft((current) => ({ ...current, [key]: next }));
        const clear = (key) => setDraft((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });

        async function save() {
          // 没改动也允许点：至少给个「已保存」的反馈，不要按钮点了没反应。
          setStatus('saving');
          let ok = true;
          for (const [key, next] of pending) {
            const accepted = await form.set(key, next);
            if (accepted) clear(key);
            else ok = false;
          }
          setStatus(ok ? 'saved' : 'failed');
        }

        async function reset() {
          const overridden = Object.keys(snapshot.user || {});
          if (!overridden.length) return;
          setStatus('saving');
          for (const key of overridden) await form.unset(key);
          setDraft({});
          setStatus('saved');
        }

        /** 服务地址：配置里有就用配置的（老版本固定写死，这里保留兜底）。 */
        function registerApiRoot() {
          const configured = String(value.registerApi || '').trim();
          return (configured || DEFAULT_REGISTER_API).replace(/\/+$/, '');
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
          try {
            for (const [key, next] of deviceWrites()) {
              const accepted = await form.set(key, next);
              if (accepted) clear(key);
            }
          } catch {
            // 写不进配置不影响注册与查额度，只是调用前没法自动校验余额
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
          const writes = [
            ['apiKey', result.api_key],
            ['baseUrl', result.base_url || fallbackBase || registerApiRoot()],
            ...await deviceWrites(device),
          ];
          // 邮箱是账号：存回本地，方便下次认出「这台机器绑的是哪个邮箱」；
          // 中转站里的密钥名由服务端生成唯一串，与邮箱的绑定关系在服务端。
          const account = result.email || result.display_name || '';
          if (account) writes.push(['registerEmail', account]);
          if (result.model) writes.push(['model', result.model]);
          let ok = true;
          for (const [key, next] of writes) {
            const accepted = await form.set(key, next);
            if (accepted) clear(key);
            else ok = false;
          }
          setRegisterStatus(ok ? 'ok' : 'partial');
          loadQuota().catch(() => {});
          loadUsage().catch(() => {});
          return ok;
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
          await applyRegistration(result, null, device);
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
          const device = deviceIdentity();
          setQuotaStatus('working');
          setQuotaMessage('');
          try {
            const result = await callRegister(`${registerApiRoot()}/api/v1/register/quota`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ device_id: device.id, device_secret: device.secret }),
            });
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
            setUsage(result);
            setUsageStatus('ok');
            return result;
          } catch (error) {
            setUsage(null);
            setUsageStatus('failed');
            setUsageMessage(error?.status === 404
              ? t('quotaNotRegistered')
              : t('usageFailed', { message: error?.message || String(error) }));
            throw error;
          }
        }

        function control(field) {
          const current = draft[field.key] !== undefined ? draft[field.key] : value[field.key];
          const id = `metaontic-video-${field.key}`;
          if (field.kind === 'switch') {
            return h('label', { htmlFor: id, style: { display: 'flex', alignItems: 'center', gap: 6, color: TOKENS.text } },
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
            return h('select', {
              id,
              'data-field': field.key,
              style: inputStyle,
              value: current ?? '',
              onChange: (event) => edit(field.key, event.target.value),
            }, (SELECTS[field.key] || []).map((option) => h('option', { key: option, value: option }, optionLabel(t, field.key, option))));
          }
          return h('input', {
            id,
            'data-field': field.key,
            style: inputStyle,
            type: field.kind === 'number' ? 'number' : (field.secret ? 'password' : 'text'),
            value: current ?? '',
            placeholder: field.secret && snapshot.secrets?.apiKey ? t('apiKeyConfigured') : '',
            onChange: (event) => edit(
              field.key,
              field.kind === 'number' && event.target.value !== ''
                ? Number(event.target.value)
                : event.target.value,
            ),
          });
        }

        const hints = {};

        const rows = FIELDS.map((field) => h('div', { key: field.key, style: cellStyle }, [
          field.kind === 'switch'
            ? null
            : h('label', { key: 'label', style: labelStyle, htmlFor: `metaontic-video-${field.key}` }, t(field.key)),
          control(field),
          hints[field.key] ? h('span', { key: 'hint', style: { ...labelStyle, marginTop: 4 } }, hints[field.key]) : null,
        ]));

        const footer = h('div', { key: 'footer', style: { display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 } }, [
          h('button', {
            key: 'save',
            'data-action': 'save',
            type: 'button',
            disabled: status === 'saving' || snapshot.writable === false,
            onClick: save,
            style: { padding: '6px 14px', borderRadius: 6, border: 'none', background: TOKENS.primaryFill, color: '#fff', cursor: 'pointer' },
          }, status === 'saving' ? t('saving') : t('save')),
          h('button', {
            key: 'reset',
            'data-action': 'reset',
            type: 'button',
            disabled: !Object.keys(snapshot.user || {}).length,
            onClick: reset,
            style: { padding: '6px 12px', borderRadius: 6, border: `1px solid ${TOKENS.border}`, background: 'transparent', color: TOKENS.text, cursor: 'pointer' },
          }, t('reset')),
          h('span', {
            key: 'status',
            style: {
              color: status === 'failed' ? TOKENS.error : (status === 'saved' ? TOKENS.success : TOKENS.muted),
            },
          }, status === 'saved'
            ? t('saved')
            : (status === 'failed' ? t('saveFailed') : (pending.length ? t('dirty') : t('clean')))),
        ]);

        const registerMessageColors = {
          ok: TOKENS.success,
          restored: TOKENS.success,
          partial: TOKENS.success,
          disabled: TOKENS.error,
          failed: TOKENS.error,
        };
        // 上游 / 地址 / Key 现在由注册流程写入，页面上不让手填。
        const keyReady = Boolean(snapshot.secrets?.apiKey || value.apiKey);
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
        const quotaText = quotaReady
          ? `${t('quotaSummary', {
            remain: quota.unlimited_quota ? t('quotaUnlimited') : money('remain_amount'),
            used: money('used_amount'),
            total: money('total_amount'),
          })} · ${t('quotaUpdatedAt', { time: quotaAt })}`
          : (keyReady ? t('quotaLoading') : t('quotaNoKey'));
        // ffmpeg 引导卡片：合并长视频要用它，缺了就照着命令装一个。
        const os = currentOs();
        const primaryInstall = FFMPEG_INSTALLS[os] || FFMPEG_INSTALLS.macos;
        const installRows = showAllFfmpeg ? FFMPEG_ALL : [primaryInstall];
        const ffmpegBox = h('div', {
          key: 'ffmpeg',
          'data-field': 'ffmpeg',
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.cardFill,
          },
        }, [
          h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } }, [
            h('span', { key: 'title', style: { fontSize: 13, color: TOKENS.text } }, t('ffmpegTitle')),
            h('button', {
              key: 'toggle',
              'data-action': 'ffmpeg-systems',
              type: 'button',
              onClick: () => setShowAllFfmpeg((current) => !current),
              style: { marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, border: `1px solid ${TOKENS.border}`, background: 'transparent', color: TOKENS.muted, cursor: 'pointer', fontSize: 12 },
            }, showAllFfmpeg ? t('ffmpegLess') : t('ffmpegMore')),
          ]),
          h('span', { key: 'body', style: labelStyle }, t('ffmpegBody')),
          h('span', { key: 'for', style: labelStyle }, t('ffmpegInstallFor')),
          ...installRows.map((item, index) => h('div', {
            key: `install-${index}`,
            'data-field': 'ffmpegInstall',
            style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
          }, [
            h('span', { key: 'label', style: { fontSize: 12, color: TOKENS.muted, flex: '0 0 auto' } }, item.label),
            h('code', {
              key: 'command',
              'data-field': 'ffmpegCommand',
              style: {
                flex: '1 1 240px',
                padding: '4px 8px',
                borderRadius: 6,
                border: `1px solid ${TOKENS.border}`,
                background: TOKENS.controlFill,
                color: TOKENS.text,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              },
            }, item.command),
            h('button', {
              key: 'copy',
              'data-action': 'ffmpeg-copy',
              type: 'button',
              onClick: () => copyCommand(item.command),
              style: { padding: '4px 10px', borderRadius: 6, border: `1px solid ${TOKENS.border}`, background: 'transparent', color: TOKENS.muted, cursor: 'pointer', fontSize: 12 },
            }, copiedFfmpeg === item.command ? t('ffmpegCopied') : t('ffmpegCopy')),
          ])),
          h('span', { key: 'after', style: labelStyle }, t('ffmpegAfter')),
        ]);

        const quotaBox = h('div', {
          key: 'quota',
          'data-field': 'quota',
          style: {
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.cardFill,
          },
        }, [
          h('div', { key: 'text', style: { display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 220px' } }, [
            h('span', { key: 'title', style: { fontSize: 13, color: TOKENS.text } }, t('quotaTitle')),
            h('span', {
              key: 'value',
              'data-field': 'quotaValue',
              style: { fontSize: 12, color: quotaReady ? TOKENS.success : TOKENS.muted },
            }, quotaText),
            quotaMessage ? h('span', { key: 'message', style: labelStyle }, quotaMessage) : null,
          ]),
          keyReady
            ? h('button', {
              key: 'refresh',
              'data-action': 'quota-refresh',
              type: 'button',
              disabled: quotaStatus === 'working',
              onClick: () => { loadQuota().catch(() => {}); },
              style: { padding: '4px 10px', borderRadius: 6, border: `1px solid ${TOKENS.border}`, background: 'transparent', color: TOKENS.muted, cursor: 'pointer', fontSize: 12 },
            }, t('quotaRefresh'))
            : null,
        ]);

        /** 复制 ffmpeg 安装命令；剪贴板不可用就什么都不做，用户照样能照着敲。 */
        function copyCommand(command) {
          try {
            const result = window.navigator?.clipboard?.writeText(command);
            if (result && typeof result.then === 'function') {
              result.then(() => {
                setCopiedFfmpeg(command);
                window.setTimeout(() => setCopiedFfmpeg(''), 2000);
              }, () => {});
            }
          } catch {
            // 复制失败不影响照着命令自己装
          }
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
        const usageBox = keyReady ? h('div', {
          key: 'usage',
          'data-field': 'usage',
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.cardFill,
          },
        }, [
          h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } }, [
            h('span', { key: 'title', style: { fontSize: 13, color: TOKENS.text } },
              t('usageTitle', { days: usage ? usage.window_days : 7 })),
            h('span', {
              key: 'summary',
              'data-field': 'usageSummary',
              style: { fontSize: 12, color: TOKENS.muted, flex: '1 1 200px' },
            }, usageSummaryText),
            h('button', {
              key: 'refresh',
              'data-action': 'usage-refresh',
              type: 'button',
              disabled: usageStatus === 'working',
              onClick: () => { loadUsage().catch(() => {}); },
              style: { padding: '4px 10px', borderRadius: 6, border: `1px solid ${TOKENS.border}`, background: 'transparent', color: TOKENS.muted, cursor: 'pointer', fontSize: 12 },
            }, t('usageRefresh')),
          ]),
          usageRows.length ? h('div', {
            key: 'head-row',
            'data-field': 'usage-head',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              fontSize: 11,
              color: TOKENS.muted,
              paddingTop: 6,
              borderTop: `1px solid ${TOKENS.border}`,
            },
          }, [
            h('span', { key: 'time', style: { width: 96 } }, t('usageColTime')),
            h('span', { key: 'kind', style: { width: 76 } }, t('usageColKind')),
            h('span', { key: 'resolution', style: { width: 56 } }, t('usageColResolution')),
            h('span', { key: 'cost', style: { width: 86 } }, t('usageColCost')),
            h('span', { key: 'status' }, t('usageColStatus')),
          ]) : null,
          ...usageRows.map((row, index) => h('div', {
            key: `${row.id}-${index}`,
            'data-field': 'usage-row',
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              fontSize: 12,
              color: TOKENS.text,
              paddingTop: 6,
              borderTop: `1px solid ${TOKENS.border}`,
            },
          }, [
            h('span', { key: 'time', style: { color: TOKENS.muted, width: 96 } },
              usageTime(row.created_at)),
            h('span', { key: 'kind', style: { width: 76 } }, row.kind_label || ''),
            h('span', { key: 'resolution', style: { color: TOKENS.muted, width: 56 } },
              row.resolution || ''),
            h('span', {
              key: 'amount',
              'data-field': 'usage-amount',
              style: { color: row.status === 'succeeded' ? TOKENS.success : TOKENS.muted, width: 86 },
            }, `${usageSymbol}${formatMoney(row.amount)}`),
            h('span', {
              key: 'status',
              style: { color: row.status === 'succeeded' ? TOKENS.success : TOKENS.error },
            }, row.status === 'succeeded' ? t('usageStatusOk') : t('usageStatusFailed')),
          ])),
          usageMessage ? h('span', { key: 'message', style: labelStyle }, usageMessage) : null,
        ]) : null;

        // 有 Key 就整块不渲染（连标题、提示文字都没有），页面上只剩配置项 + 额度卡片。
        const registerBox = keyReady ? null : h('div', {
          key: 'register',
          style: {
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${TOKENS.border}`,
            background: TOKENS.cardFill,
          },
        }, [
          h('div', { key: 'text', style: { display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 220px' } }, [
            h('span', { key: 'title', style: { fontSize: 13, color: TOKENS.text } },
              t('registerTitle')),
            h('span', { key: 'hint', style: labelStyle }, t('registerHint')),
          ]),
          h('input', {
            key: 'email',
            'data-field': 'registerEmail',
            type: 'text',
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
              flex: '0 1 180px',
              width: 'auto',
              opacity: emailLocked ? 0.6 : 1,
              cursor: emailLocked ? 'not-allowed' : 'text',
            },
          }),
          h('button', {
            key: 'code',
            'data-action': 'send-code',
            type: 'button',
            disabled: codeStatus === 'working' || codeCooldown > 0 || !registerEmail.trim(),
            onClick: () => { sendEmailCode().catch(() => {}); },
            style: { padding: '6px 12px', borderRadius: 6, border: `1px solid ${TOKENS.border}`, background: 'transparent', color: TOKENS.text, cursor: 'pointer' },
          }, codeCooldown > 0
            ? t('registerCodeCooldown', { seconds: codeCooldown })
            : (codeStatus === 'working' ? t('registerCodeSending') : t('registerCodeSend'))),
          h('input', {
            key: 'code-input',
            'data-field': 'registerCode',
            type: 'text',
            inputMode: 'numeric',
            value: registerCode,
            placeholder: t('registerCodePlaceholder'),
            'aria-label': t('registerCode'),
            onChange: (event) => setRegisterCode(event.target.value),
            style: { ...inputStyle, flex: '0 1 110px', width: 'auto' },
          }),
          h('button', {
            key: 'button',
            'data-action': 'register',
            type: 'button',
            disabled: registerStatus === 'working'
              || !registerEmail.trim()
              || !registerCode.trim()
              || snapshot.writable === false,
            onClick: register,
            style: { padding: '6px 14px', borderRadius: 6, border: 'none', background: TOKENS.primaryFill, color: '#fff', cursor: 'pointer' },
          }, registerStatus === 'working' ? t('registerWorking') : t('register')),
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

        return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0', color: TOKENS.text } }, [
          notice ? h('p', { key: 'notice', style: { margin: 0, color: TOKENS.muted } }, notice) : null,
          notice && !snapshot.value ? null : h('div', {
            key: 'grid',
            style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 },
          }, rows),
          notice && !snapshot.value ? null : ffmpegBox,
          notice && !snapshot.value ? null : registerBox,
          notice && !snapshot.value ? null : quotaBox,
          notice && !snapshot.value ? null : usageBox,
          notice && !snapshot.value ? null : footer,
        ]);
      };
    }

    return {
      inject: ['slots', 'locale', 'configForms'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'metaontic-video: dictionaries');
        const form = ctx.configForms.get(NAMESPACE);
        const Page = makePage({ form, t });
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
