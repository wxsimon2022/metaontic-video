/**
 * MetaOnticVideo 插件的浏览器半侧：在侧栏「插件」页里给本插件加一张配置卡片，
 * 直接编辑 Host 侧的配置（写进 profile 的 cordis.patch.yml）。
 *
 * 数据通道用宿主客户端的 `configForms` 服务（`dsh-client-ui-settings` 提供）：
 *   - `ctx.configForms.get('<entry id>')` 取得该条目的表单控制器；
 *   - `form.getSnapshot()` 读当前值/修订号，`form.subscribe()` 订阅变化；
 *   - `form.set(field, value)` / `form.unset(field)` 排队写入，修订号由宿主校验。
 * 页面注册进插件页的 `plugins.bundle.config` 槽位，key 为本包名 metaontic-video；
 * 卡片底部还有「注册并填写」按钮：向注册服务申请一个中转站密钥（新 API Key），
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
      summaryEmpty: '未配置：到插件设置页点「注册并填写」领一把密钥。',
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
      registerUser: '用户名（就是这把 API 的名字）',
      registerTitle: '没有 API Key？',
      registerHint: '先填用户名——它就是你领到的 API 名称，填谁的名字后台就显示谁，方便认领；'
        + '填好点按钮即可，成功后自动写好上游、Key、地址与模型。默认额度 ¥0.01。',
      registerUserPlaceholder: '你的名字 / 昵称',
      registerNeedUser: '先填用户名，再点注册。',
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
      register: '注册并填写',
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
      registerUser: 'User name (this becomes the API name)',
      registerTitle: 'No API key yet?',
      registerHint: 'Type your name first — it becomes the API name you receive, so it is easy to claim later; '
        + 'then use the button. Provider, key, base URL and model are filled in for you. Default quota ¥0.01.',
      registerUserPlaceholder: 'Your name / nickname',
      registerNeedUser: 'Type a user name before registering.',
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
        const [registerUser, setRegisterUser] = React.useState(
          () => String((form.getSnapshot().value || {}).registerUser || ''),
        );
        // 额度：设置页展示这把 Key 的剩余 / 已用
        const [quota, setQuota] = React.useState(null);
        const [quotaStatus, setQuotaStatus] = React.useState('idle');
        const [quotaMessage, setQuotaMessage] = React.useState('');
        const [quotaAt, setQuotaAt] = React.useState('');

        // 打开设置页时，若本机还没配 Key，就先问服务端要回自己那把（设备绑定过就能取回）
        const restoreTried = React.useRef(false);
        React.useEffect(() => {
          if (restoreTried.current) return;
          restoreTried.current = true;
          const snap = form.getSnapshot() || {};
          if (snap.secrets?.apiKey || (snap.value || {}).apiKey) {
            loadQuota().catch(() => {});
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
          const nav = () => window.navigator || {};
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

        /** 取注册服务的 JSON：后端是 {code, data, message} 信封，这里拆开并统一抛错。 */
        async function callRegister(url, init) {
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
            const failure = new Error(
              (body && (body.message || body.detail)) || text.slice(0, 200) || `HTTP ${response.status}`,
            );
            failure.status = response.status;
            throw failure;
          }
          return payload || {};
        }

        /** 把服务端给的那把密钥写回配置（注册、取回都走这里）。 */
        async function applyRegistration(result, fallbackBase) {
          const writes = [
            ['apiKey', result.api_key],
            ['baseUrl', result.base_url || fallbackBase || DEFAULT_REGISTER_API],
          ];
          // 服务端会保证中转站里的密钥名唯一（撞名时带 -2 这类后缀）；
          // 这里存用户自己填的原名，映射关系由服务端保管。
          const displayName = result.display_name || result.name;
          if (displayName) writes.push(['registerUser', displayName]);
          if (result.model) writes.push(['model', result.model]);
          let ok = true;
          for (const [key, next] of writes) {
            const accepted = await form.set(key, next);
            if (accepted) clear(key);
            else ok = false;
          }
          setRegisterStatus(ok ? 'ok' : 'partial');
          loadQuota().catch(() => {});
          return ok;
        }

        /** 本机取回：只有设备标识 + 设备密钥都对上，服务端才把注册信息给你。 */
        async function lookupOwnKey() {
          const device = deviceIdentity();
          const result = await callRegister(`${DEFAULT_REGISTER_API}/api/v1/register/lookup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ device_id: device.id, device_secret: device.secret }),
          });
          if (!result.api_key) throw new Error(t('registerNoKey'));
          await applyRegistration(result, null);
          setRegisterStatus('restored');
          return result;
        }

        async function register() {
          const root = DEFAULT_REGISTER_API;
          const username = registerUser.trim();
          if (!username) {
            setRegisterStatus('failed');
            setRegisterMessage(t('registerNeedUser'));
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
                name: username,
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
            await applyRegistration(result, status.base_url || root);
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
            const result = await callRegister(`${DEFAULT_REGISTER_API}/api/v1/register/quota`, {
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
        // 一个设备 / 一个用户名只发一把：已经配好 Key 的（注册过的或手填的）整块注册区直接隐藏，
        // 连「已经领到 Key 了」这类说明也不显示；要换 Key 只能找管理员。
        const registerText = registerStatus === 'ok'
          ? t('registerOk')
          : (registerStatus === 'partial'
            ? t('registerPartial')
            : (registerStatus === 'restored'
              ? t('registerRestored')
              : registerMessage));
        // 金额按服务端给的币种符号展示（当前服务端是中转站口径的人民币 ¥）；
        // 老服务端只回 *_usd 字段时退回 $，两边都能看清是多少钱。
        const quotaSymbol = quota && quota.currency_symbol
          ? quota.currency_symbol
          : (quota && quota.remain_amount !== undefined ? '¥' : '$');
        const money = (field, legacyField) => {
          const raw = quota ? (quota[field] ?? quota[legacyField]) : 0;
          return `${quotaSymbol}${(Number(raw) || 0).toFixed(4)}`;
        };
        const quotaReady = quotaStatus === 'ok' && quota;
        const quotaText = quotaReady
          ? `${t('quotaSummary', {
            remain: quota.unlimited_quota ? t('quotaUnlimited') : money('remain_amount', 'remain_usd'),
            used: money('used_amount', 'used_usd'),
            total: money('total_amount', 'total_usd'),
          })} · ${t('quotaUpdatedAt', { time: quotaAt })}`
          : (keyReady ? t('quotaLoading') : t('quotaNoKey'));
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
            key: 'user',
            'data-field': 'registerUser',
            type: 'text',
            value: registerUser,
            placeholder: t('registerUserPlaceholder'),
            'aria-label': t('registerUser'),
            onChange: (event) => setRegisterUser(event.target.value),
            style: { ...inputStyle, flex: '0 1 180px', width: 'auto' },
          }),
          h('button', {
            key: 'button',
            'data-action': 'register',
            type: 'button',
            disabled: registerStatus === 'working' || !registerUser.trim() || snapshot.writable === false,
            onClick: register,
            style: { padding: '6px 14px', borderRadius: 6, border: 'none', background: TOKENS.primaryFill, color: '#fff', cursor: 'pointer' },
          }, registerStatus === 'working' ? t('registerWorking') : t('register')),
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
          notice && !snapshot.value ? null : registerBox,
          notice && !snapshot.value ? null : quotaBox,
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
