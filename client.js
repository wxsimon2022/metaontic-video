/**
 * MetaOnticVideo 插件的浏览器半侧：在侧栏「插件」页里给本插件加一张配置卡片，
 * 直接编辑 Host 侧的配置（写进 profile 的 cordis.patch.yml）。
 *
 * 数据通道用宿主客户端的 `configForms` 服务（`dsh-client-ui-settings` 提供）：
 *   - `ctx.configForms.get('<entry id>')` 取得该条目的表单控制器；
 *   - `form.getSnapshot()` 读当前值/修订号，`form.subscribe()` 订阅变化；
 *   - `form.set(field, value)` / `form.unset(field)` 排队写入，修订号由宿主校验。
 * 页面注册进插件页的 `plugins.item` 槽位，只有宿主确实提供该命名空间时才出现。
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
      summaryEmpty: '未配置：先在中转站/官方之间选一个上游并填好密钥。',
      summary: (provider, model, duration) => `${provider} · ${model} · 每段 ${duration}s`,
      provider: '上游',
      providerNewapi: 'New API 中转站',
      providerArk: '火山方舟官方',
      apiKey: 'API Key',
      apiKeyConfigured: '已配置，留空表示保持原值',
      apiKeyEnvHint: '留空时按上游读环境变量（中转站 NEWAPI_API_KEY / 官方 ARK_API_KEY）',
      baseUrl: '基础地址',
      baseUrlHint: '中转站填站址，例如 https://ai.bileego.com（不要带 /v1）',
      submitPath: '提交路径',
      queryPath: '查询路径',
      model: '模型',
      duration: '每段秒数',
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
      unavailable: '宿主还没有把本插件列为可编辑条目：请先在 profile 的 cordis.patch.yml 里加一条 id 为 metaontic-video 的覆盖项。',
      readOnly: '当前 profile 不接受表单写入。',
    };
    const en = {
      title: 'MetaOnticVideo',
      summaryEmpty: 'Not configured: pick New API or Volcano Ark and set the key.',
      summary: (provider, model, duration) => `${provider} · ${model} · ${duration}s per segment`,
      provider: 'Provider',
      providerNewapi: 'New API relay',
      providerArk: 'Volcano Ark',
      apiKey: 'API Key',
      apiKeyConfigured: 'Configured; leave empty to keep it',
      apiKeyEnvHint: 'Empty falls back to an environment variable (NEWAPI_API_KEY / ARK_API_KEY)',
      baseUrl: 'Base URL',
      baseUrlHint: 'Relay origin, e.g. https://ai.bileego.com (no /v1)',
      submitPath: 'Submit path',
      queryPath: 'Query path',
      model: 'Model',
      duration: 'Seconds per segment',
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
      unavailable: 'This Host does not expose the plugin as an editable entry yet: add an override row with id metaontic-video to the profile cordis.patch.yml first.',
      readOnly: 'This profile does not accept form writes.',
    };

    /** 可编辑字段；kind 决定控件，标注 secret 的字段宿主只会告知是否已配置。 */
    const SELECTS = {
      provider: ['newapi', 'ark'],
      mode: ['continuous', 'closeup'],
      resolution: ['480p', '720p', '1080p'],
      ratio: ['16:9', '9:16', '4:3', '3:4', '1:1', 'adaptive'],
    };
    const FIELDS = [
      { key: 'provider', kind: 'select' },
      { key: 'apiKey', kind: 'text', secret: true },
      { key: 'baseUrl', kind: 'text' },
      { key: 'model', kind: 'text' },
      { key: 'duration', kind: 'number' },
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
    ];

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
      if (key === 'provider') return option === 'ark' ? t('providerArk') : t('providerNewapi');
      if (key === 'mode') return option === 'closeup' ? t('modeCloseup') : t('modeContinuous');
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

        if (props && props.view === 'summary') {
          const configured = Boolean(value.model) || Boolean(snapshot.secrets?.apiKey);
          const text = configured
            ? t('summary', value.provider === 'ark' ? t('providerArk') : t('providerNewapi'), value.model || '-', value.duration ?? '-')
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
          if (!pending.length) return;
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

        const hints = {
          apiKey: t('apiKeyEnvHint'),
          baseUrl: t('baseUrlHint'),
        };

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
            disabled: !pending.length || status === 'saving' || snapshot.writable === false,
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
        ctx.effect(() => ctx.configForms.whileServed([NAMESPACE], () => ctx.slots.inject('plugins.item', () => ctx.slots.register({
          name: 'plugins.item',
          id: NAMESPACE,
          order: 30,
          label: () => t('title'),
          locale: NS,
        }, Page))), 'metaontic-video: configuration page');
      },
    };
  },
});
