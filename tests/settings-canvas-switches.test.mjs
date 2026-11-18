import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPreviewHost } from '../preview/host.mjs';

/**
 * 设置页两个画布开关的显示联动：总开关「流程画布」关着时不该出现「自动创建画布」，
 * 打开后立刻出现，再关掉又隐藏。用真实客户端组件做服务端渲染，不连宿主、不写配置。
 */
function bootSettings(initial) {
  globalThis.window = {
    navigator: { userAgent: 'node' },
    setTimeout, clearTimeout,
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    confirm: () => true,
  };
  globalThis.window.__ModuleLoader__ = { load(entry) { globalThis.__entry = entry; } };
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), { window: globalThis.window });
  const plugin = globalThis.__entry.factory((name) => {
    if (name === 'react') return React;
    throw new Error(`未注入的宿主依赖：${name}`);
  });
  const listeners = new Set();
  let value = { connectionMode: 'metaontic', ...initial };
  const form = {
    getSnapshot: () => ({ status: 'ready', value: { ...value }, writable: true, revision: 1, user: {} }),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async mutate() { return true; },
    set(key, next) { value = { ...value, [key]: next }; for (const listener of listeners) listener(); },
  };
  const components = {}, dictionaries = {};
  const host = createPreviewHost({ form, components, dictionaries, getLocale: () => 'zh', onUpdate() {} });
  plugin.apply(host);
  const Page = components['plugins.bundle.config:dsh-metaontic-video'];
  assert.equal(typeof Page, 'function', '设置页组件已注册');
  const render = () => renderToStaticMarkup(React.createElement(Page, { view: 'full' }));
  return { render, form };
}

/** 只看开关本身：用各自提示语结尾判断，避免命中更新说明里的同名字样。 */
const hasAutoCreateSwitch = (html) => html.includes('流程画布打开后有效');
const hasCanvasSwitch = (html) => html.includes('关闭时左侧栏不出现');

test('设置页隐藏全部画布开关，旧的开启配置也不重新显示', () => {
  const { render, form } = bootSettings({ canvasEnabled: false });
  const off = render();
  assert.ok(!hasCanvasSwitch(off), '总开关隐藏');
  assert.ok(!hasAutoCreateSwitch(off), '总开关关着时不该出现自动创建画布');
  form.set('canvasEnabled', true);
  const on = render();
  assert.ok(!hasCanvasSwitch(on));
  assert.ok(!hasAutoCreateSwitch(on), '旧的开启配置也不显示自动创建');
  form.set('canvasEnabled', false);
  assert.ok(!hasAutoCreateSwitch(render()), '再关掉总开关又隐藏');
});
