import { createConnectionCheckController } from './connection-check.js';
import { createSettingsActions } from './settings-actions.js';
import { VOLCENGINE_MODE_AVAILABLE } from '../connection-defaults.js';
import { createUpdateActions, renderUpdateNotice, formatReleaseTime } from '../../../ui/updates/update.service.js';
/** 浏览器端 settings：由入口注入宿主 React 与共享依赖。 */
import packageInfo from '../../../../package.json';
import { RELAY } from '../../../shared/constants/plugin.js';
/** 设置页工厂：入口注入宿主 React、配置表单及更新服务。 */
export function createSettingsPage(deps: any) {
  const {
    useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS,
    persistBatch, PLUGIN_VERSION, useVersionPolicy = () => ({ required: false, minimum: '' }),
    UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, SELECTS, inputStyle, optionLabel,
    FIELD_BY_KEY, SECTIONS, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS,
    isNewerVersion, updateBell, PAGE_CSS, NotificationBanner,
  } = deps;
function makePage({ form, t, manager }) {
      return function ConfigPage(props) {
        const snapshot = useSnapshot(form);
        const value = snapshot.value || {};
        const [draft, setDraft] = React.useState({});
        const selectedMode = draft.connectionMode ?? value.connectionMode ?? 'metaontic';
        const directMode = selectedMode === 'volcengine';
        const [visibleKey, setVisibleKey] = React.useState('');
        React.useEffect(() => { setVisibleKey(''); }, [selectedMode]);
        const [status, setStatus] = React.useState('idle');
        const [saveError, setSaveError] = React.useState('');
        const [connectionCheck,setConnectionCheck]=React.useState({status:'idle',checks:[],textModels:[]});
        const checkController=React.useRef(null);
        if(!checkController.current)checkController.current=createConnectionCheckController({setState:setConnectionCheck,readSnapshot:()=>form.getSnapshot()});
        React.useEffect(()=>{checkController.current.invalidate();return ()=>checkController.current.dispose();},[snapshot.revision]);

        // 「已保存」这类反馈过几秒自动收起：收起后操作条跟着消失，页面回到「没有改动」的样子
        const statusTimer = React.useRef(null);
        const connectionBusy = React.useRef(false);
        const saveInFlight = React.useRef(false);
        // 更新检查只读取正式发行版，实际安装前再次确认。
        const [updateStatus, setUpdateStatus] = React.useState('idle');
        const [updateMessage, setUpdateMessage] = React.useState('');
        const [checkedLatest, setUpdateLatest] = React.useState('');
        const versionPolicy = useVersionPolicy();
        const updateLatest = versionPolicy.required && (!checkedLatest || isNewerVersion(versionPolicy.minimum, checkedLatest)) ? versionPolicy.minimum : checkedLatest;
        const updateRequest = React.useRef(0);
        // 更新说明固定使用本机包内内容，不受远端版本和检查缓存影响。
        const releaseNotes = packageInfo.releaseNotes;
        const [updateAt, setUpdateAt] = React.useState('');
        // 一键在线更新：第一下把按钮转成「确认更新」，第二下才真的重装本插件
        const [updateConfirm, setUpdateConfirm] = React.useState(false);
        const [updateDeferred, setUpdateDeferred] = React.useState(() => {
          try { return window.localStorage.getItem(`${UPDATE_CACHE_KEY}.deferred`) || ''; }
          catch { return ''; }
        });

        const { readUpdateCache, checkForUpdate, runOnlineUpdate, deferUpdate } = createUpdateActions({
          get UPDATE_CACHE_KEY() { return UPDATE_CACHE_KEY; },
          get PLUGIN_VERSION() { return PLUGIN_VERSION; },
          get isNewerVersion() { return isNewerVersion; },
          get updateRequest() { return updateRequest; },
          get UPDATE_MAX_AGE_MS() { return UPDATE_MAX_AGE_MS; },
          get setUpdateStatus() { return setUpdateStatus; },
          get setUpdateMessage() { return setUpdateMessage; },
          get fetchLatestVersion() { return fetchLatestVersion; },
          get setUpdateLatest() { return setUpdateLatest; },
          get setUpdateAt() { return setUpdateAt; },
          get t() { return t; },
          get setUpdateConfirm() { return setUpdateConfirm; },
          get manager() { return manager; },
          get PLUGIN_PACKAGE() { return PLUGIN_PACKAGE; },
          get updateLatest() { return updateLatest; },
          get updateConfirm() { return updateConfirm; },
          get setUpdateDeferred() { return setUpdateDeferred; },
          get UPDATE_SPEC() { return UPDATE_SPEC; },
          get UPDATE_ATTEMPTS() { return UPDATE_ATTEMPTS; },
        });

        // 进入完整设置页先显示缓存，同时后台检查；摘要视图不触发检查。
        const updateTried = React.useRef(false);
        React.useEffect(() => {
          if (props?.view === 'summary') { updateTried.current = false; return; }
          if (updateTried.current) return;
          updateTried.current = true;
          setUpdateLatest(''); setUpdateConfirm(false); setUpdateAt(''); setUpdateStatus('idle'); setUpdateMessage('');
          try { setUpdateDeferred(window.localStorage.getItem(`${UPDATE_CACHE_KEY}.deferred`) || ''); } catch { setUpdateDeferred(''); }
          const cached = readUpdateCache();
          if (cached.latest) {
            setUpdateLatest(cached.latest);
            if (cached.at) setUpdateAt(new Date(cached.at).toLocaleTimeString());
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
          // 仅连接方式、地址、密钥或共用密钥开关变化时清空模型清单；其它设置改动不影响候选。
          const connectionChanged = ['connectionMode', 'baseUrl', 'metaonticApiKey', 'volcengineApiKey', 'textApiKey', 'imageUseVideoKey'].includes(key);
          checkController.current.invalidate(connectionChanged);
          clearStatusTimer();
          setStatus((current) => (current === 'idle' ? current : 'idle'));
          setDraft((current) => ({ ...current, [key]: next }));
        };
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
          return ['unknownConnection', 'atomicUnsupported', 'atomicRejected', 'settingsUnavailable', 'settingsConflict', 'settingsTransport', 'readOnly', 'invalidWait', 'invalidSeam'].includes(message) ? t(message) : message;
        }

        const { save, reset, control } = createSettingsActions({
          saveInFlight, connectionBusy, setSaveError, setStatus, form, draft, same,
          validateSettings, persistConnection, persistBatch, setDraft, flashStatus, settingsError,
          t, snapshot, PLUGIN_OWNED_KEYS, setVisibleKey, value, h,
          SELECTS: { ...SELECTS, textModel: [...new Set([...(SELECTS.textModel || []), ...(connectionCheck.textModels || [])])] }, inputStyle,
          optionLabel, edit, visibleKey, renderKeyAction: field => showsSharedValidation(field) ? connectionButton() : null, confirm: message => window.confirm(message),
        });

        // 少数需要解释的字段：模型选哪个（mini 便宜 / fast 贵一些）
        const hints = {
          sidebarAssistantEnabled: t('sidebarAssistantEnabledHint'),
          connectionMode: selectedMode === 'metaontic'
            ? [t('connectionMetaonticHint'), ' ', h('a', { key: 'metaontic-register', href: RELAY.signupUrl, target: '_blank', rel: 'noopener noreferrer', style: { textDecoration: 'underline' } }, t('connectionMetaonticRegister'))]
              : directMode && !VOLCENGINE_MODE_AVAILABLE ? t('connectionVolcengineUnavailable') : t('connectionModeHint'),
          metaonticApiKey: t('metaonticKeyHint'),
          volcengineApiKey: t('volcengineKeyHint'),
          model: t('modelHint'),
          imageModel: t('imageModelHint'),
          textModel: t('textModelHint'),
          seamTrimSeconds: t('seamTrimSecondsHint'),
          maxWaitMs: t('waitSecondsHint'),
        };

        function showsSharedValidation(field) {
          const shared = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
          return !directMode && ((field.key === 'metaonticApiKey' && shared) || (field.key === 'textApiKey' && !shared));
        }

        /** 一个可编辑字段：标签 + 控件（开关自带标签，就不重复画）。 */
        function fieldCell(field) {
          const classes = ['mov-field'];
          // 开关没有标签行，靠底对齐才能跟旁边输入框/下拉框的控制线齐平
          if (field.kind === 'switch') classes.push('mov-field-switch');
          if (field.wide) classes.push('mov-field-wide');
          return h('div', { key: field.key, className: classes.join(' ') }, [
            field.kind === 'switch'
              ? null
              : h('label', { key: 'label', className: 'mov-label', htmlFor: `metaontic-video-${field.key}` }, t(['metaonticApiKey', 'volcengineApiKey'].includes(field.key) ? (!directMode && ((draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false) ? 'sharedModelKey' : 'videoModelKey') : field.key)),
            control(field),
            showsSharedValidation(field) ? connectionFeedback() : null,
            hints[field.key] ? h('span', { key: 'hint', className: 'mov-hint', style: { marginTop: 4 } }, hints[field.key]) : null,
          ]);
        }

        // 配置区分成几节，每节一个标题 + 一个自适应网格。
        const renderGrid = (section) => {
          if (section.key === 'sectionConnection') return h('a', {
            key: 'apply-key', href: RELAY.signupUrl, target: '_blank', rel: 'noopener noreferrer',
            className: 'mov-apply-key',
          }, [t('connectionMetaonticRegister'), h('span', { key: 'arrow', 'aria-hidden': true }, ' ↗')]);
          if (section.key === 'sectionModels') {
            const shared = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
            const common = !directMode
              ? [fieldCell(FIELD_BY_KEY.imageUseVideoKey), ...(shared ? [fieldCell(FIELD_BY_KEY.metaonticApiKey)] : [])] : [];
            // 文本模型独立占满一行，完整显示长模型 ID；关闭共用密钥时同时显示文本 API密钥。
            const videoFields = ['model', ...((directMode || !shared) ? [directMode ? 'volcengineApiKey' : 'metaonticApiKey'] : [])];
            const imageFields = ['imageModel', ...(!shared ? ['imageApiKey'] : [])];
            const textFields = !directMode ? ['textModel', ...(!shared ? ['textApiKey'] : [])] : [];
            return h('div', { key: section.key, className: 'mov-model-settings' }, [
              ...common,
              h('div', { key: 'models', className: `mov-model-grid${directMode ? ' mov-model-grid-single' : ''}` }, [
                h('div', { key: 'video', className: 'mov-model-card', 'data-group': 'video-model' }, videoFields.map(key => fieldCell(FIELD_BY_KEY[key]))),
                !directMode ? h('div', { key: 'image', className: 'mov-model-card', 'data-group': 'image-model' }, imageFields.map(key => fieldCell(FIELD_BY_KEY[key]))) : null,
              ]),
              !directMode && textFields.length ? h('div', { key: 'text', className: 'mov-model-card', 'data-group': 'text-model' }, [
                ...textFields.map(key => fieldCell(FIELD_BY_KEY[key])),
              ]) : null,
            ]);
          }
          if (section.key === 'sectionVideo') {
            return h('div', { key: section.key, className: 'mov-av-grid' }, [
              h('div', { key: 'picture', className: 'mov-av-card' }, [
                fieldCell(FIELD_BY_KEY.ratio),
                h('span', { key: 'hint', className: 'mov-hint' }, t('ratioLayoutHint')),
              ]),
              h('div', { key: 'audio', className: 'mov-av-card mov-av-audio' }, [
                h('span', { key: 'label', className: 'mov-label' }, t('audioSettings')),
                control(FIELD_BY_KEY.generateAudio),
                h('span', { key: 'hint', className: 'mov-hint' }, t('audioLayoutHint')),
              ]),
            ]);
          }
          const shared = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
          const videoKey = directMode ? 'volcengineApiKey' : 'metaonticApiKey';
          const fields = section.key === 'sectionModels'
            ? directMode ? ['model', videoKey]
              : shared ? ['imageUseVideoKey', videoKey, 'model', 'imageModel']
                : ['imageUseVideoKey', 'model', videoKey, 'imageModel', 'imageApiKey']
            : section.fields;
          return h('div', { key: section.key, className: 'mov-grid' },
          fields.filter((key) => (key !== 'volcengineApiKey' || directMode)
            && (!['imageModel', 'imageUseVideoKey', 'imageApiKey'].includes(key) || !directMode)
            && (key !== 'imageApiKey' || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) === false)
            && (key !== 'metaonticApiKey' || selectedMode === 'metaontic')
            )
            .map((key) => fieldCell(FIELD_BY_KEY[key])).filter(Boolean));
        };
        function connectionButton() {
          return h('button', { key: 'verify', type: 'button', className: 'mov-btn mov-key-verify',
            'data-action': 'check-connection',
            disabled: pending.length > 0 || status === 'saving' || snapshot.status !== 'ready' || connectionCheck.status === 'working',
            onClick: () => checkController.current.run(!pending.length && status !== 'saving' && form.getSnapshot()?.status === 'ready'),
          }, t(connectionCheck.status === 'working' ? 'connectionChecking' : 'connectionCheckButton'));
        }
        function connectionFeedback() {
          return h('div', { key: 'connection-feedback', role: 'status', 'aria-live': 'polite' },
            pending.length ? h('p', { className: 'mov-hint' }, t('connectionCheckSaveFirst')) : null,
            connectionCheck.status === 'failed'
              ? h('p', { style: { color: TOKENS.error } }, t('connectionCheckFailed'))
              : connectionCheck.checks.map((check: any) => h('p', { key: check.target, style: { margin: '4px 0', fontSize: 12, color: check.level === 'error' ? TOKENS.error : check.level === 'success' ? TOKENS.success : TOKENS.muted } }, `${t('connectionTarget_' + check.target)}：${t('connectionResult_' + check.code)}`)));
        }
        const settingsRows = () => [
          h('div', { key: 'generation', className: 'mov-section' }, [
            h('div', { key: 'title', className: 'mov-section-title' }, t('sectionGeneration')),
            ...SECTIONS.filter(section => !['sectionInterface', 'sectionVideo'].includes(section.key)).map(section =>
              h('div', { key: section.key, className: 'mov-parameter-group' }, [
                section.key !== 'sectionConnection' ? h('div', { key: 'heading', className: 'mov-parameter-heading' }, t(section.key)) : null,
                renderGrid(section),
              ])),
          ]),
          h('details', { key: 'advanced', className: 'mov-section mov-advanced' }, [
            h('summary', { key: 'toggle', className: 'mov-advanced-toggle' }, [
              h('span', { key: 'title' }, t('sectionCombined')),
              h('span', { key: 'hint', className: 'mov-hint' }, t('sectionCombinedHint')),
            ]),
            h('div', { key: 'body', className: 'mov-advanced-body' }, [
              h('div', { key: 'sectionVideo', className: 'mov-advanced-group', 'data-group': 'sectionVideo' }, [
                h('div', { key: 'title', className: 'mov-parameter-heading' }, t('sectionVideo')),
                renderGrid(SECTIONS.find(section => section.key === 'sectionVideo')),
              ]),
              ...[
                { key: 'advancedPicture', fields: ['watermark'] },
                { key: 'advancedMerge', fields: ['mergeMode', 'seamTrimSeconds'], hint: 'segmentsRetained' },
                { key: 'advancedWait', fields: ['pollIntervalMs', 'maxWaitMs'] },
                { key: 'advancedTools', fields: ['ffmpegBinary', 'ffprobeBinary'], hint: 'toolsHint' },
                { key: 'advancedStats', fields: ['usageStatsEnabled'], hint: 'usageStatsHint' },
              ].map(group => h('div', { key: group.key, className: `mov-advanced-group${group.key === 'advancedTools' ? ' mov-advanced-tools' : ''}`, 'data-group': group.key }, [
                h('div', { key: 'title', className: 'mov-parameter-heading' }, t(group.key)),
                renderGrid(group),
                group.hint ? h('p', { key: 'hint', className: 'mov-hint', style: { margin: 0 } }, t(group.hint)) : null,
              ])),
            ]),
          ]),
          h('div', { key: 'interface', className: 'mov-section mov-interface', 'data-group': 'interface' }, [
            h('div', { key: 'title', className: 'mov-section-title' }, t('sectionInterface')),
            renderGrid(SECTIONS.find(section => section.key === 'sectionInterface')),
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

        // 版本卡片：当前版本是构建时注入的常量，最新版本来自所选渠道已发布的 Release。
        // 有新版本时给出升级命令——用 git 源装的插件不会出现在「已安装」里的更新按钮上。
        const updateAvailable = Boolean(updateLatest) && Boolean(PLUGIN_VERSION)
          && isNewerVersion(updateLatest, PLUGIN_VERSION);
        const updateText = updateStatus === 'working'
          ? t('versionChecking')
          : (updateStatus === 'failed'
            ? updateMessage
            : (updateStatus === 'installing'
              ? t('versionUpdating')
              : ((updateStatus === 'restart' || updateStatus === 'applied' || updateStatus === 'pending')
                ? updateMessage
                : (updateStatus === 'ok'
                  ? (updateAvailable ? t('versionNew', { version: updateLatest }) : t('versionLatest'))
                  : ''))));
        // 失败红、成功绿（更新完/有新版本），其余用灰度文字
        const updateTone = updateStatus === 'failed'
          ? TOKENS.error
          : (updateStatus === 'restart' || updateStatus === 'applied' || updateAvailable ? TOKENS.success : TOKENS.muted);
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
            h('a', { key: 'history', className: 'mov-hint', href: '${CHANGELOG_URL}', target: '_blank', rel: 'noopener noreferrer' }, t('versionHistory')),
            h('button', {
              key: 'check',
              'data-action': 'update-check',
              type: 'button',
              className: 'mov-btn mov-btn-sm mov-trailing',
              disabled: updateStatus === 'working' || updateStatus === 'installing',
              onClick: () => { checkForUpdate(false).catch(() => {}); },
            }, updateStatus === 'working' ? t('versionChecking') : t('versionCheck')),
          ]),
          releaseNotes?.items?.length ? h('details', { key: 'release-notes', 'data-field': 'releaseNotes' }, [
            h('summary', { key: 'heading', style: { cursor: 'pointer' } }, [
              h('span', { key: 'title', className: 'mov-card-title' }, `${releaseNotes.version} · ${t('releaseNotesTitle')}`),
              formatReleaseTime(releaseNotes.publishedAt) ? h('span', { key: 'published-at', 'data-field': 'releasePublishedAt', className: 'mov-foot-note' }, t('releaseUpdatedAt', { time: formatReleaseTime(releaseNotes.publishedAt) })) : null,
            ]),
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

        let notice = null;
        if (snapshot.status === 'loading') notice = t('loading');
        else if (snapshot.value === undefined) notice = t('unavailable');
        else if (snapshot.writable === false) notice = t('readOnly');

        // 配置读不出来（没有表单 / 不可写）时只显示提示，配置项与卡片一律不渲染。
        const blobs = notice && !snapshot.value
          ? []
          : [versionBox, footer, resetRow];

        return h('div', { className: 'mov-page' }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 mov- 前缀）。
          h('style', { key: 'styles' }, PAGE_CSS + `
.mov-apply-key { display:inline-flex; align-items:center; gap:4px; width:fit-content; color:${TOKENS.primaryFill}; font-size:13px; line-height:1.6; text-decoration:none; border-radius:4px; padding:3px 0; }
.mov-apply-key:hover { text-decoration:underline; text-underline-offset:3px; }
.mov-apply-key:focus-visible { outline:2px solid ${TOKENS.primaryFill}; outline-offset:4px; }
`),
          !notice || snapshot.value ? renderUpdateNotice({
            h, t, available: updateAvailable, latest: updateLatest, deferred: updateDeferred,
            mandatory: versionPolicy.required, minimum: versionPolicy.minimum,
            status: updateStatus, confirmed: updateConfirm,
            onUpdate: () => { if (updateConfirm) runOnlineUpdate().catch(() => {}); else setUpdateConfirm(true); },
            onLater: deferUpdate,
          }) : null,
          NotificationBanner ? h(NotificationBanner, { key: 'activity-notice', multiple: true }) : null,
          notice ? h('p', { key: 'notice', className: 'mov-notice' }, notice) : null,
          ...(notice && !snapshot.value ? [] : settingsRows()),
          ...blobs,
        ]);
      };
    }
  return { makePage };
}
