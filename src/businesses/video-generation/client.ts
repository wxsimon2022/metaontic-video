import { createSupportAction } from '../../ui/components/support-action.js';
import { registerAuthNotice } from '../../ui/components/auth-notice.js';
import { createToolResultView } from './client/tool-result.js';
import { createMediaPreview } from './client/media-preview.js';
/** Harness 浏览器入口：装配设置页、进度视图和宿主服务。 */
import { createTheme } from '../../ui/components/theme.js';
import { createVideoProgress } from './client/progress.js';
import { createClientConfig } from './client/config.js';
import { createDictionaries } from './client/locale.js';
import { createSettingsState } from './client/state.js';
import { createUpdates } from '../../ui/updates/update.service.js';
import { createSettingsPage } from './client/settings.js';
import { createUpdateHint, createUpdateHintView, ensureUpdateHintStyles } from '../../ui/updates/update-notice.js';
import { createSidebarPanel } from './client/panel.js';
import { createCanvasView } from './client/canvas-view.js';
import iconMark from '../../../icon.svg';

import { PLUGIN_PACKAGE, FLOW_CANVAS_AVAILABLE, CANVAS_PANEL_ID, GUIDE_URL, PANEL_ID } from '../../shared/constants/plugin.js';

export function createVideoClient(require) {
    const React = require('react');
    const h = React.createElement;
    const { TOKENS, inputStyle, PAGE_CSS } = createTheme();
    const { MediaPreview } = createMediaPreview({ React, h });
    const { videoExecutionSource, VideoTaskProgress, VideoProgressDock } = createVideoProgress({ React, h, TOKENS });
    const { ToolResultView } = createToolResultView({ h, MediaPreview, VideoTaskProgress });
    const { PLUGIN_OWNED_KEYS, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE } = createClientConfig();
    const { zh, en } = createDictionaries();
    const { useSnapshot, same, validateSettings, persistConnection, persistBatch } = createSettingsState({ React });
    const { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, fetchRecentVersions, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell } = createUpdates({ h });
    // 设置页的依赖统一走一个对象：宿主 React（React/h/useSnapshot）、主题与字段
    // （TOKENS/inputStyle/SELECTS/optionLabel/FIELD_BY_KEY/SECTIONS/formatMoney/PAGE_CSS）、
    // 设置状态（same/validateSettings/persistConnection/persistBatch/PLUGIN_OWNED_KEYS）、
    const { makePage } = createSettingsPage({ useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS, persistBatch, PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, SELECTS, inputStyle, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell, PAGE_CSS });
    return {
      inject: ['slots', 'locale', 'configForms', 'uiSession'],
      apply(ctx, { settings }) {
        ctx.effect(() => ctx.uiSession.provide({
          hooks: ['videoExecutions'],
          resolve: (binding) => ({ hooks: { videoExecutions: videoExecutionSource(binding.eventSource) } }),
        }), 'metaontic-video: actual video execution');
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'metaontic-video: dictionaries');
        const SupportAction = createSupportAction({ React, t, PAGE_CSS });
        ctx.effect(() => ctx.slots.inject('plugins.detail.actions', () => ctx.slots.register({
          name: 'plugins.detail.actions', id: 'metaontic-video-support', locale: NS,
        }, SupportAction)), 'metaontic-video: support action');
        ctx.effect(() => ctx.slots.inject('conversation.chat.node', () => registerAuthNotice(ctx, h, t)), 'metaontic-video: friendly service authentication notice');
        const form = ctx.configForms.get(NAMESPACE);
        for (const tool of ['video_generate', 'video_extend', 'video_status', 'video_prepare_image', 'video_project', 'video_estimate']) {
          ctx.effect(() => ctx.slots.inject('tool.call.toolview', () =>
            ctx.slots.register({ name: 'tool.call.toolview', key: tool, locale: NS }, ToolResultView)),
          `metaontic-video: ${tool} progress`);
        }
        ctx.effect(() => ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register({ name: 'conversation.input.dock', id: 'metaontic-video-progress', order: -20 },
            VideoProgressDock)), 'metaontic-video: visible video progress');
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
        settings.register({ id: 'video', namespace: PLUGIN_PACKAGE, locale: NS, Page });
        // 面板组件要用当前配置快照与界面字典（form/t 在 apply 里才有），所以在这里构造。
        // 流程画布只做独立页面：左侧栏有单独入口，视频创作面板里不再内嵌画布。
        const FlowCanvasPage = FLOW_CANVAS_AVAILABLE ? createCanvasView({ React, h, TOKENS, PAGE_CSS }).FlowCanvas : null;
        const { PanelIcon, VideoPanel } = createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID, GUIDE_URL, LOGO_SVG: iconMark });
        // 有更新时只在入口那一行点一个红点：展开时贴在这行右端（原来写「有更新」的位置），收起时落在图标角上，
        // 入口名字本身不带文字。状态放在 update-hint 的轻量 store 里：宿主渲染那一行，拿不到设置页的 state。
        ensureUpdateHintStyles();
        const updateHint = createUpdateHint({ version: PLUGIN_VERSION, isNewerVersion, fetchRecentVersions, cacheKey: UPDATE_CACHE_KEY, maxAge: UPDATE_MAX_AGE_MS });
        const { UpdateHintDot, UpdateHintBanner } = createUpdateHintView({
          React, h, t, hint: updateHint, version: PLUGIN_VERSION, isNewerVersion, manager: pluginManager,
          pluginPackage: PLUGIN_PACKAGE, updateSpec: UPDATE_SPEC, updateAttempts: UPDATE_ATTEMPTS,
          cacheKey: UPDATE_CACHE_KEY, maxAge: UPDATE_MAX_AGE_MS,
        });
        const railIcon = (props: any) => h('span', { className: 'mov-rail-hint' },
          [h(PanelIcon, props), h(UpdateHintDot, { key: 'dot' })]);
        // 左侧栏入口与面板本体是宿主 root 作用域的两个 slot，用同一个 id 关联：
        // sidebar.panellist 只放一行图标（收到 {size, active}），点它切到 main 里同 id 的面板。
        // 老版本宿主没有这两个 slot 时 inject 不会触发，其余界面与工具不受影响。
        ctx.effect(() => {
          const off = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 30,
            locale: NS,
            // 左侧那一行显示的名字，比面板标题更完整，方便在图标列表里认出来；有更新只加红点，不改文字。
            label: () => t('panelSidebarLabel'),
          }, railIcon));
          // 开工时静默查一次：查到新版本由圆点自己重渲染，不需要重注册这一行。
          void updateHint.refresh(false);
          return () => off?.();
        }, 'metaontic-video: sidebar entry');
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          // 面板要的两个动作都按需取服务：老宿主没有这些服务时按钮自然失效，不报错。
          inject: () => ({
            startSession: () => ctx.get('uiWorkspace')?.startSession(undefined, { agentPreset: 'video-director' }),
            openSettings: () => ctx.get('pluginNavigation')?.openBundle(PLUGIN_PACKAGE),
            manager: pluginManager,
            // 面板顶部的更新入口：与设置页同一套两步确认，点左侧栏的「有更新」进来就能更新。
            updateBanner: () => h(UpdateHintBanner, { key: 'update-hint' }),
          }),
        }, VideoPanel)), 'metaontic-video: sidebar panel');
        // 流程画布是可开关的组件：设置页「流程画布」总开关打开时才注册左侧栏入口与画布页。
        // 关闭后左侧栏不再出现画布入口，已有画布与成果仍留在插件数据目录；开关改动实时生效，不必重开 Harness。
        const canvasSwitchOn = () => {
          try { return FLOW_CANVAS_AVAILABLE && form?.getSnapshot?.()?.value?.canvasEnabled === true; } catch { return false; }
        };
        const canvasSlots = [
          () => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
            name: 'sidebar.panellist',
            id: CANVAS_PANEL_ID,
            order: 31,
            locale: NS,
            label: () => t('canvasPanelLabel'),
            // 更新入口在视频创作面板顶部，画布这一行不加圆点：点了也看不到更新，会误导。
          }, PanelIcon)),
          () => ctx.slots.inject('main', () => ctx.slots.register({
            name: 'main',
            key: CANVAS_PANEL_ID,
            locale: NS,
          }, FlowCanvasPage)),
        ];
        ctx.effect(() => {
          let active = false;
          let disposers: any[] = [];
          const close = () => { for (const off of disposers) off(); disposers = []; active = false; };
          const sync = () => {
            const wanted = canvasSwitchOn();
            if (wanted === active) return;
            if (!wanted) { close(); return; }
            disposers = canvasSlots.map((register: any) => register()).filter((off: any) => typeof off === 'function');
            active = true;
          };
          sync();
          // 订阅设置快照：用户在设置页关掉开关，左侧栏入口与画布页立刻消失。
          let unsubscribe: any;
          try { unsubscribe = form?.subscribe?.(sync); } catch { unsubscribe = undefined; }
          return () => { if (typeof unsubscribe === 'function') unsubscribe(); close(); };
        }, 'metaontic-video: canvas entry follows the canvas switch');
      },
    };
}
