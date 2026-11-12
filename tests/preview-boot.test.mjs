import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreviewHost } from '../preview/host.mjs';

/** 设置快照桩：流程画布入口跟着「流程画布」开关走，关掉要立刻消失。 */
function switchForm(value = {}) {
  const listeners = new Set();
  let current = { ...value };
  return {
    getSnapshot: () => ({ status: 'ready', value: { ...current }, writable: true, revision: 1 }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    set(key, next) { current = { ...current, [key]: next }; for (const listener of listeners) listener(); },
  };
}

function boot(form) {
  let entry;
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(value) { entry = value; } } },
  });
  const plugin = entry.factory(() => ({ createElement() {} }));
  const components = {}, dictionaries = {};
  const host = createPreviewHost({ form, components, dictionaries, getLocale: () => 'zh', onUpdate() {} });
  for (const service of plugin.inject) assert.ok(host[service], service);
  assert.doesNotThrow(() => plugin.apply(host));
  return { host, components, dictionaries };
}

test('流程画布开关关掉后左侧栏不再注册画布入口，打开立刻回来', () => {
  const form = switchForm({ autoCreateCanvas: false });
  const off = boot(form);
  assert.equal(off.components['sidebar.panellist:metaontic-video-canvas'], undefined, '关闭时不该有画布图标');
  assert.equal(off.components['main:metaontic-video-canvas'], undefined, '关闭时不该有画布页');
  // 视频创作入口不受影响。
  assert.equal(typeof off.components['sidebar.panellist:metaontic-video'], 'function', '视频创作入口照旧');
  form.set('autoCreateCanvas', true);
  assert.equal(typeof off.components['sidebar.panellist:metaontic-video-canvas'], 'function', '打开后画布图标回来');
  assert.equal(typeof off.components['main:metaontic-video-canvas'], 'function', '打开后画布页回来');
  form.set('autoCreateCanvas', false);
  assert.equal(off.components['sidebar.panellist:metaontic-video-canvas'], undefined, '再关掉又消失');
});

test('standalone preview host mounts the real client and registers settings and progress views', () => {
  // 把 slot 注册项按 名称:key 存下来，便于分别断言设置页、进度视图与左侧栏面板。
  const { host, components, dictionaries } = boot(switchForm({ autoCreateCanvas: true }));
  for (const key of ['metaontic-video', 'video_generate', 'video_extend', 'video_status', 'metaontic-video-progress']) {
    assert.equal(typeof components[key], 'function', key);
  }
  assert.equal(host.locale.bind('settings.metaonticVideo')('save'), '保存');
  assert.equal(host.locale.bind('settings.metaonticVideo')('panelTitle'), '视频创作');
  assert.equal(typeof components['plugins.bundle.config:metaontic-video'], 'function', '设置页');
  assert.equal(typeof components['tool.call.toolview:video_generate'], 'function', '工具卡片');
  assert.equal(typeof components['conversation.input.dock:metaontic-video-progress'], 'function', '输入框进度');
  assert.equal(typeof components['sidebar.panellist:metaontic-video'], 'function', '左侧栏图标');
  assert.equal(typeof components['main:metaontic-video'], 'function', '左侧栏面板本体');
  // 流程画布是插件自己的独立页面：单独的左侧栏入口与 main 键位槽。
  assert.equal(typeof components['sidebar.panellist:metaontic-video-canvas'], 'function', '画布页图标');
  // 左侧栏那一行的名字：带上产品名，方便在图标列表里认出来。
  assert.equal(host.locale.bind('settings.metaonticVideo')('canvasPanelLabel'), 'MetaOnticVideo流程画布');
  assert.equal(typeof components['main:metaontic-video-canvas'], 'function', '流程画布页面');
  const panel = components['main:metaontic-video:props']();
  panel.startSession();
  const started = host.calls.at(-1);
  assert.equal(started.action, 'startSession');
  assert.equal(started.workspaceId, undefined);
  assert.equal(started.options.agentPreset, 'video-director');
  panel.openSettings();
  const opened = host.calls.at(-1);
  assert.equal(opened.action, 'openBundle');
  assert.equal(opened.bundle, 'metaontic-video');
  // 流程画布只在独立页面：视频创作面板不再内嵌，也不再有跳转入口。
  assert.equal(panel.openCanvasPage, undefined, '面板不再提供 openCanvasPage');
  assert.equal(components['main:metaontic-video-canvas:props'], undefined, '画布页不需要宿主注入动作');
});
