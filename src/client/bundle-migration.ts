import { PLUGIN_PACKAGE } from '../core/hardcoded-config.js';

export function migrationManager(ctx: any) {
  try { return ctx.get?.('remote.pluginManager') || ctx.get?.('remote')?.pluginManager; }
  catch { return null; }
}

/** Both package identities can be installed, but their shared entry IDs must never mount together. */
export { hasLegacyBundleConflict, bundleRows, disableLegacyBundle } from '../core/installation/bundle-identity.js';
import { hasLegacyBundleConflict, bundleRows, disableLegacyBundle } from '../core/installation/bundle-identity.js';

/** A conflict must expose a working settings page before any shared locale, panel or tool-view registration. */
export async function mountBundleAwareClient(ctx: any, React: any, mount: () => any) {
  const manager = migrationManager(ctx);
  if (!manager || typeof manager.listBundles !== 'function') return mount();
  let alive = true, status = 'checking', running: Promise<any> | null = null;
  const listeners = new Set<() => void>();
  const set = (next: string) => { if (!alive) return; status = next; for (const listener of listeners) listener(); };
  ctx.effect(() => () => { alive = false; listeners.clear(); }, 'video: migration lifetime');
  const ns = 'settings.metaonticVideoMigration';
  ctx.effect(() => ctx.locale.register(ns, {
    zh: { title: '插件迁移', checking: '正在检查插件安装状态…', conflict: '旧版和新版同时启用，可能导致设置页与工具冲突。请先等待视频任务结束，再切换到新版。', action: '停用旧版并切换', working: '正在切换…', loadFailed: '插件界面加载失败，请在插件管理中核对启用状态。配置和任务未删除。', failed: '切换未完成，请核对插件管理状态后重试。原配置、任务和安装文件均保留。', blocked: '无法核实插件安装状态，请检查插件管理服务后重试。', restart: '宿主要求重启以完成切换。请先保存工作，再重启 Harness。', retry: '重新检查', preserved: '仅停用旧插件，不卸载、不删除 API密钥、任务或素材。' },
    en: { title: 'Plugin migration', checking: 'Checking installed plugins…', conflict: 'The old and new plugins are both enabled and share component IDs. Wait for active video tasks to finish before switching.', action: 'Disable old plugin and switch', working: 'Switching…', loadFailed: 'The plugin UI could not load. Check enabled plugins; settings and tasks are preserved.', failed: 'Switching was not completed. Check plugin management and retry. Settings, tasks and installed files are preserved.', blocked: 'Plugin inventory could not be verified. Check plugin management and retry.', restart: 'Harness requires a restart to finish switching. Save your work before restarting.', retry: 'Check again', preserved: 'Only disables the old plugin. No uninstall or deletion of credentials, tasks or assets.' },
  }), 'video: migration messages');
  const t = ctx.locale.bind(ns), h = React.createElement;
  const start = () => {
    if (running) return running;
    set('working');
    running = disableLegacyBundle(manager).then(result => {
      if (!alive) return;
      if (result === 'restart-required') { set('restart'); return; }
      return activate();
    }).catch(() => set('failed')).finally(() => { running = null; });
    return running;
  };
  const check = async () => {
    set('checking');
    try {
      const rows = bundleRows(await manager.listBundles());
      if (!alive) return;
      if (hasLegacyBundleConflict(rows)) { set('conflict'); return; }
      return activate();
    } catch { set('blocked'); }
  };
  function Page() {
    const state = React.useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => status, () => status);
    return h('section', { style: { padding: 20, maxWidth: 640 }, 'data-metaontic-migration': state },
      h('h3', null, t('title')), h('p', { role: state === 'failed' || state === 'blocked' ? 'alert' : 'status' }, t(state)),
      h('p', null, t('preserved')),
      state === 'conflict' || state === 'failed' ? h('button', { type: 'button', onClick: start }, t('action')) : null,
      state === 'blocked' ? h('button', { type: 'button', onClick: check }, t('retry')) : null);
  }
  const registerPage = () => ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: PLUGIN_PACKAGE, locale: ns }, Page)), 'video: migration settings');
  let off = registerPage();
  let activated = false;
  function activate() {
    if (!alive || activated) return;
    activated = true;
    if (typeof off === 'function') off();
    try { return mount(); }
    catch { off = registerPage(); set('loadFailed'); }
  }
  return check();
}
