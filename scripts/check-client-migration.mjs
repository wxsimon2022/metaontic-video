/** Real bundled client + React render contract against a temporary package-manager adapter.
 * This is automatic coverage, not a real Harness desktop session.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPreviewHost } from '../preview/host.mjs';

export async function checkClientMigration(installed, manager) {
  let entry;
  vm.runInNewContext(await readFile(path.join(installed, 'dist/client.js'), 'utf8'), {
    AbortController, setTimeout, clearTimeout,
    window: { __ModuleLoader__: { load(value) { entry = value; } } },
  });
  assert.equal(entry.id, 'dsh-metaontic-video');
  let consent;
  const actions = {}, components = {}, dictionaries = {}, cleanups = [];
  const react = { ...React, createElement(type, props, ...children) {
    if (type === 'input' && props?.['data-migration-consent']) consent = props.onChange;
    if (type === 'button' && props?.['data-migration-action']) actions[props['data-migration-action']] = props.onClick;
    return React.createElement(type, props, ...children);
  } };
  const plugin = entry.factory(name => { assert.equal(name, 'react'); return react; });
  const host = createPreviewHost({
    form: { getSnapshot: () => ({ status: 'ready', writable: true, value: { connectionMode: 'metaontic' } }), subscribe: () => () => {} },
    components, dictionaries, getLocale: () => 'zh', onUpdate() {},
  });
  const get = host.get.bind(host), effect = host.effect;
  host.get = name => name === 'remote.pluginManager' ? manager : get(name);
  host.effect = fn => { const off = effect(fn); if (typeof off === 'function') cleanups.push(off); return off; };
  const render = () => {
    const Page = components['plugins.bundle.config:dsh-metaontic-video'];
    assert.equal(typeof Page, 'function', 'Migration settings must remain visible');
    return renderToStaticMarkup(React.createElement(Page));
  };
  try {
    await plugin.apply(host);
    assert.match(render(), /同时启用/);
    assert.equal(components['sidebar.panellist:metaontic-video'], undefined, 'Do not mount shared UI before resolving conflict');
    await actions.cleanup();
    assert.ok((await manager.listBundles()).some(row => row.name === 'metaontic-video' && row.enabled), 'No migration before consent');
    consent({ target: { checked: true } });
    render();
    const first = actions.cleanup(), second = actions.cleanup();
    assert.equal(first, second, 'Repeated clicks share one migration');
    await first;
    assert.match(render(), /API/);
    assert.doesNotMatch(render(), /data-metaontic-migration/);
    assert.equal(typeof components['sidebar.panellist:metaontic-video'], 'function');
    const rows = await manager.listBundles();
    assert.ok(!rows.some(row => row.name === 'metaontic-video' && row.installed), 'Legacy package must actually be removed');
    assert.ok(rows.some(row => row.name === 'dsh-metaontic-video' && row.installed && row.enabled));
  } finally {
    for (const off of cleanups.reverse()) off();
  }
}
