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
      title: 'MetaOnticVideo',
      summaryEmpty: '未配置：到插件设置页点「注册并填写」领一把密钥。',
      summary: '{provider} · {model} · 每段 {duration}s',
      providerNewapi: 'New API 中转站',
      apiKey: 'API Key',
      apiKeyConfigured: '已配置，留空表示保持原值',
      apiKeyEnvHint: '留空时按上游读环境变量（中转站 NEWAPI_API_KEY / 官方 ARK_API_KEY）',
      baseUrl: '基础地址',
      baseUrlHint: '中转站填站址，例如 https://ai.bileego.com（不要带 /v1）',
      submitPath: '提交路径',
      queryPath: '查询路径',
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
        + '填好点按钮即可，成功后自动写好上游、Key、地址与模型。默认额度 0.01 美元。',
      registerUserPlaceholder: '你的名字 / 昵称',
      registerNeedUser: '先填用户名，再点注册。',
      registerDone: '已经领到 Key 了，不用再填。',
      registerAgain: '重新领一把',
      registerCurrent: '当前连接：{value}',
      registerNoKey: '密钥未配置——点右边按钮领一个',
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
      title: 'MetaOnticVideo',
      summaryEmpty: 'Not configured: open the plugin settings and click "Register & fill in".',
      summary: '{provider} · {model} · {duration}s per segment',
      providerNewapi: 'New API relay',
      apiKey: 'API Key',
      apiKeyConfigured: 'Configured; leave empty to keep it',
      apiKeyEnvHint: 'Empty falls back to an environment variable (NEWAPI_API_KEY / ARK_API_KEY)',
      baseUrl: 'Base URL',
      baseUrlHint: 'Relay origin, e.g. https://ai.bileego.com (no /v1)',
      submitPath: 'Submit path',
      queryPath: 'Query path',
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
        + 'then use the button. Provider, key, base URL and model are filled in for you. Default quota US$0.01.',
      registerUserPlaceholder: 'Your name / nickname',
      registerNeedUser: 'Type a user name before registering.',
      registerDone: 'A key is already configured — nothing to fill in.',
      registerAgain: 'Issue a new one',
      registerCurrent: 'Current: {value}',
      registerNoKey: 'No key yet — use the button to get one',
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
      { key: 'submitPath', kind: 'text' },
      { key: 'queryPath', kind: 'text' },
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
        // 重新领一把：点小字后才会再显示用户名输入框
        const [reRegister, setReRegister] = React.useState(false);

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

        /** 认识一下这台机器：注册时作为备注，方便在中转站后台认出是哪个插件实例。 */
        function deviceInfo() {
          const KEY = 'metaontic-video.device-id';
          let id = '';
          try {
            id = window.localStorage.getItem(KEY) || '';
            if (!id) {
              id = `dsh-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
              window.localStorage.setItem(KEY, id);
            }
          } catch {
            id = '';
          }
          let label = 'Harness';
          try {
            const platform = window.navigator?.userAgentData?.platform || window.navigator?.platform;
            if (platform) label = `Harness-${platform}`;
          } catch {
            label = 'Harness';
          }
          return { id, label };
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
            throw new Error(
              (body && (body.message || body.detail)) || text.slice(0, 200) || `HTTP ${response.status}`,
            );
          }
          return payload || {};
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
          try {
            const status = await callRegister(`${root}/api/v1/register/status`);
            if (!status.enabled) {
              setRegisterStatus('disabled');
              setRegisterMessage(t('registerDisabled', { message: status.hint || '-' }));
              return;
            }
            const device = deviceInfo();
            const result = await callRegister(`${root}/api/v1/register`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({
                name: username,
                device_id: device.id || undefined,
                note: `Harness 插件设置页注册（${device.label}）`,
              }),
            });
            if (!result.api_key) {
              setRegisterStatus('failed');
              setRegisterMessage(t('registerNoKey'));
              return;
            }
            const writes = [
              ['provider', 'newapi'],
              ['apiKey', result.api_key],
              ['baseUrl', result.base_url || status.base_url || root],
              ['registerUser', username],
            ];
            const model = result.model || status.model;
            if (model) writes.push(['model', model]);
            let ok = true;
            for (const [key, next] of writes) {
              const accepted = await form.set(key, next);
              if (accepted) clear(key);
              else ok = false;
            }
            setRegisterStatus(ok ? 'ok' : 'partial');
            setReRegister(false);
          } catch (error) {
            setRegisterStatus('failed');
            setRegisterMessage(t('registerFailed', { message: error?.message || String(error) }));
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
          partial: TOKENS.success,
          disabled: TOKENS.error,
          failed: TOKENS.error,
        };
        // 上游 / 地址 / Key 现在由注册流程写入，这里只展示当前连接，不让手填。
        const keyReady = Boolean(snapshot.secrets?.apiKey || value.apiKey);
        const connection = keyReady
          ? `${t('providerNewapi')} · ${value.baseUrl || '-'} · ${value.model || '-'}`
          : t('registerNoKey');
        // 已经配好 Key 的（注册过的或手填的）就不用再填一遍，只展示当前连接，
        // 想换一把时点「重新领一把」再把输入框放出来。
        const alreadyRegistered = keyReady && !reRegister;
        const registerSucceeded = registerStatus === 'ok' || registerStatus === 'partial';
        const registerText = registerStatus === 'ok'
          ? t('registerOk')
          : (registerStatus === 'partial'
            ? t('registerPartial')
            : (alreadyRegistered && !registerSucceeded ? '' : registerMessage));
        const registerBox = h('div', {
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
              alreadyRegistered ? t('registerDone') : t('registerTitle')),
            alreadyRegistered
              ? null
              : h('span', { key: 'hint', style: labelStyle }, t('registerHint')),
            h('span', {
              key: 'current',
              'data-field': 'registerCurrent',
              style: { fontSize: 12, color: keyReady ? TOKENS.success : TOKENS.muted },
            }, t('registerCurrent', {
              value: keyReady && registerUser ? `${registerUser} · ${connection}` : connection,
            })),
          ]),
          alreadyRegistered
            ? null
            : h('input', {
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
            disabled: alreadyRegistered
              ? false
              : (registerStatus === 'working' || !registerUser.trim() || snapshot.writable === false),
            onClick: alreadyRegistered ? () => { setReRegister(true); setRegisterStatus('idle'); setRegisterMessage(''); } : register,
            style: alreadyRegistered
              ? { padding: '4px 10px', borderRadius: 6, border: `1px solid ${TOKENS.border}`, background: 'transparent', color: TOKENS.muted, cursor: 'pointer', fontSize: 12 }
              : { padding: '6px 14px', borderRadius: 6, border: 'none', background: TOKENS.primaryFill, color: '#fff', cursor: 'pointer' },
          }, alreadyRegistered ? t('registerAgain') : (registerStatus === 'working' ? t('registerWorking') : t('register'))),
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
