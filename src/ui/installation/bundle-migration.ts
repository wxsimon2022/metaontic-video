import { readBundleInventory, BundleInventoryError } from '../../platform/migration/bundle-inventory.js';
import { PLUGIN_PACKAGE } from '../../shared/constants/plugin.js';
import { hasLegacyBundleConflict, hasLegacyBundle, disableLegacyBundle, cleanupLegacyBundle } from '../../platform/migration/bundle-identity.js';
export { hasLegacyBundleConflict, bundleRows, disableLegacyBundle } from '../../platform/migration/bundle-identity.js';

export function migrationManager(ctx: any) {
  for (const read of [() => ctx.get?.('remote.pluginManager'), () => ctx.get?.('remote')?.pluginManager, () => ctx.remote?.pluginManager]) {
    try { const manager = read(); if (typeof manager?.listBundles === 'function') return manager; } catch { /* Try the next supported Host shape. */ }
  }
  return null;
}

/** Keep cleanup visible alongside normal settings after the old package has been disabled. */
export async function mountBundleAwareClient(ctx: any, React: any, mount: (decorateSettings?: (Page: any) => any) => any) {
  const manager = migrationManager(ctx);
  if (!manager) return mount();
  const abort = new AbortController();
  const inventory = { signal: abort.signal };
  let checking: Promise<any> | null = null;
  let alive = true, status = 'checking', confirmed = false, running: Promise<any> | null = null;
  const listeners = new Set<() => void>();
  const notify = () => { if (alive) for (const listener of listeners) listener(); };
  const set = (next: string) => { if (alive) { status = next; notify(); } };
  ctx.effect(() => () => { alive = false; abort.abort(); listeners.clear(); }, 'video: migration lifetime');
  const ns = 'settings.metaonticVideoMigration';
  ctx.effect(() => ctx.locale.register(ns, {
    zh: {
      title: '旧版插件迁移', checking: '正在检查插件安装状态…',
      conflict: '旧版 metaontic-video 和新版 dsh-metaontic-video 同时启用。更新或重启不会自动移除旧包，请完成迁移。',
      retained: '新版已可使用，但旧包仍在已安装列表中。可清理旧包，避免再次误启用。',
      ready: '迁移完成：已移除旧包，保留新版。', action: '切换并清理旧版', cleanup: '清理旧版安装包',
      switchOnly: '仅停用旧版并切换', working: '正在处理，请勿重复操作…',
      consent: '我已结束所有视频任务，同意停用并卸载旧包 metaontic-video。',
      preserved: '配置、API密钥、历史任务和素材继续保留；仅处理旧安装包。',
      failed: '迁移未完成，请重新检查。不会自动删除配置或重装插件。',
      blocked: '无法核实安装状态，请重新检查；暂不清理旧包。',
      timeout: '安装状态查询超时，请点击重新检查。暂不执行停用或卸载，迟到的查询结果不会继续操作。',
      restart: '宿主要求重启以完成切换。请先保存工作，重启后回到此处检查并继续清理。',
      stop: '新版已可使用，旧包已停用；宿主要求先退出当前运行环境才能卸载。请在插件管理中完成旧包卸载，不要删除配置或任务目录。',
      manual: '新版已可使用；当前宿主不支持在这里卸载旧包，请到插件管理中卸载 metaontic-video。',
      cleanupFailed: '新版已可使用，旧包清理尚未完成。请重新检查后重试，勿再次启用旧版。',
      loadFailed: '插件界面加载失败，请在插件管理中核对启用状态。配置和任务未删除。', retry: '重新检查',
    },
    en: {
      title: 'Legacy plugin migration', checking: 'Checking installed plugins…',
      conflict: 'metaontic-video and dsh-metaontic-video are both enabled. Updating or restarting does not remove the old package.',
      retained: 'The new plugin is ready. Remove the disabled old package to avoid enabling it again.',
      ready: 'Migration complete. The old package was removed; the new plugin is retained.', action: 'Switch and remove old package', cleanup: 'Remove old package',
      switchOnly: 'Disable old plugin and switch only', working: 'Working…',
      consent: 'All video tasks have finished. I agree to disable and uninstall metaontic-video.',
      preserved: 'Settings, API credentials, task history and assets are retained. Only the old installation package is removed.',
      failed: 'Migration was not completed. Check again. Settings will not be deleted and no reinstall is attempted.',
      blocked: 'Installation state could not be verified. Check again before cleanup.',
      timeout: 'Installation check timed out. Check again; no disable or uninstall will follow a late response.',
      restart: 'Harness requires a restart. Save your work, restart and return here to finish cleanup.',
      stop: 'The new plugin is ready and the old plugin is disabled. Harness requires the running profile to stop before uninstalling. Finish removal in plugin management; keep settings and task directories.',
      manual: 'The new plugin is ready. Use plugin management to uninstall metaontic-video; this Host cannot remove it here.',
      cleanupFailed: 'The new plugin is ready, but cleanup is incomplete. Check and retry; do not enable the old package again.',
      loadFailed: 'The plugin UI could not load. Check enabled plugins; settings and tasks are preserved.', retry: 'Check again',
    },
  }), 'video: migration messages');
  const t = ctx.locale.bind(ns), h = React.createElement;
  let activated = false;
  const check = () => {
    if (!alive) return Promise.resolve();
    if (checking) return checking;
    if (running) return running;
    set('checking');
    checking = (async () => {
      try {
        const rows = await readBundleInventory(manager, inventory);
        if (!alive) return;
        if (hasLegacyBundleConflict(rows)) { set('conflict'); return; }
        set(hasLegacyBundle(rows) ? 'retained' : 'ready');
        return activate();
      } catch (error) {
        if (alive) set(error instanceof BundleInventoryError && error.code === 'timeout' ? 'timeout' : 'blocked');
      }
    })().finally(() => { checking = null; });
    return checking;
  };
  const start = (cleanup: boolean) => {
    if (!alive || (cleanup && !confirmed)) return Promise.resolve();
    if (running) return running;
    set('working');
    running = (async () => {
      try {
        const result = await disableLegacyBundle(manager, inventory);
        if (!alive) return;
        if (result === 'restart-required') { set('restart'); return; }
        if (cleanup) {
          const outcome = await cleanupLegacyBundle(manager, inventory);
          if (!alive) return;
          set(outcome === 'ready' ? 'ready' : outcome === 'stop-profile' ? 'stop' : outcome === 'restart-required' ? 'restart' : outcome === 'manual' ? 'manual' : 'cleanupFailed');
        } else {
          const rows = await readBundleInventory(manager, inventory);
          set(hasLegacyBundle(rows) ? 'retained' : 'ready');
        }
        return activate();
      } catch (error) {
        if (!alive) return;
        if (error instanceof BundleInventoryError && error.code === 'timeout') { set('timeout'); return; }
        // Never let a failed cleanup hide the working settings of an already migrated plugin.
        try {
          const rows = await readBundleInventory(manager, inventory);
          if (!hasLegacyBundleConflict(rows)) { set('cleanupFailed'); return activate(); }
        } catch { /* Keep the diagnostic page if inventory cannot be verified. */ }
        set('failed');
      }
    })().finally(() => { running = null; });
    return running;
  };
  function Notice() {
    const snapshot = React.useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => `${status}:${confirmed}`, () => `${status}:${confirmed}`);
    const state = snapshot.split(':')[0];
    if (state === 'ready') return null;
    const cleanupAllowed = ['conflict', 'retained', 'failed', 'cleanupFailed'].includes(state);
    return h('section', { style: { padding: 20, maxWidth: 680 }, 'data-metaontic-migration': state },
      h('h3', null, t('title')), h('p', { role: ['failed', 'blocked', 'timeout', 'cleanupFailed'].includes(state) ? 'alert' : 'status' }, t(state)),
      h('p', null, t('preserved')),
      cleanupAllowed ? h('label', null, h('input', { type: 'checkbox', checked: confirmed, 'data-migration-consent': true, onChange: (event: any) => { confirmed = event.target.checked === true; notify(); } }), t('consent')) : null,
      cleanupAllowed ? h('button', { type: 'button', disabled: !confirmed, 'data-migration-action': 'cleanup', onClick: () => start(true) }, t(state === 'conflict' ? 'action' : 'cleanup')) : null,
      state === 'conflict' || state === 'failed' ? h('button', { type: 'button', 'data-migration-action': 'switch', onClick: () => start(false) }, t('switchOnly')) : null,
      state !== 'working' && state !== 'checking' ? h('button', { type: 'button', 'data-migration-action': 'check', onClick: () => running || check() }, t('retry')) : null);
  }
  const registerPage = () => ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: PLUGIN_PACKAGE, locale: ns }, Notice)), 'video: migration settings');
  let off = registerPage();
  function activate() {
    if (!alive || activated) return;
    activated = true;
    if (typeof off === 'function') off();
    try { return mount(Page => props => h('div', null, h(Notice), h(Page, props))); }
    catch { activated = false; off = registerPage(); set('loadFailed'); }
  }
  return check();
}
