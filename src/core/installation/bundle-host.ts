import { bundleRows, hasLegacyBundleConflict } from './bundle-identity.js';

/** Leave the legacy tools in service until migration removes its bundle layer. */
export function mountBundleAwareHost(ctx: any, mount: () => (() => void)) {
  let manager: any;
  try { manager = ctx.get?.('pluginManager'); } catch { /* Host without package management. */ }
  if (!manager || typeof manager.listBundles !== 'function') return mount();
  let alive = true, mounted = false, dispose: (() => void) | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  const check = async () => {
    try {
      const conflict = hasLegacyBundleConflict(bundleRows(await manager.listBundles()));
      if (!alive) return;
      if (!conflict) { mounted = true; dispose = mount(); return; }
    } catch {
      if (mounted) { ctx.logger?.warn?.('视频插件加载失败，请在插件管理中检查组件状态。'); return; }
    }
    if (alive) timer = setTimeout(check, 1000);
  };
  void check();
  return () => { alive = false; if (timer) clearTimeout(timer); dispose?.(); };
}
