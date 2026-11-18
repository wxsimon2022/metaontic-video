import { hasLegacyBundleConflict } from './bundle-identity.js';
import { readBundleInventory, BundleInventoryError } from './bundle-inventory.js';

/** Leave legacy tools in service while waiting; never bypass unknown installation state. */
export function mountBundleAwareHost(ctx: any, mount: () => (() => void), options: { timeoutMs?: number; retryMs?: number; maxRetryMs?: number } = {}) {
  let manager: any;
  try { manager = ctx.get?.('pluginManager'); } catch { /* Host without package management. */ }
  if (!manager || typeof manager.listBundles !== 'function') return mount();
  const abort = new AbortController();
  let alive = true, mounted = false, dispose: (() => void) | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let delay = options.retryMs ?? 1000, diagnostic = '';
  const report = (code: string) => {
    if (!alive || diagnostic === code) return;
    diagnostic = code;
    const message = code === 'conflict' ? '检测到新旧视频插件同时启用，请在新版设置中完成迁移；等待期间不会重复注册工具。'
      : code === 'timeout' ? '视频插件安装状态查询超时，正在退避重试；可在新版设置中重新检查。'
      : '视频插件安装状态暂不可用，正在退避重试；请检查宿主插件管理服务。';
    ctx.logger?.warn?.(message);
  };
  const check = async () => {
    try {
      const rows = await readBundleInventory(manager, { signal: abort.signal, timeoutMs: options.timeoutMs });
      if (!alive) return;
      if (!hasLegacyBundleConflict(rows)) {
        mounted = true;
        dispose = mount();
        if (diagnostic) ctx.logger?.info?.('视频插件安装状态已恢复，新版工具已加载。');
        return;
      }
      report('conflict');
    } catch (error) {
      if (!alive) return;
      if (mounted) { ctx.logger?.warn?.('视频插件加载失败，请在插件管理中检查组件状态。'); return; }
      report(error instanceof BundleInventoryError ? error.code : 'unavailable');
    }
    if (alive) {
      timer = setTimeout(check, delay);
      timer.unref?.();
      delay = Math.min(delay * 2, options.maxRetryMs ?? 30000);
    }
  };
  void check();
  return () => { alive = false; abort.abort(); if (timer) clearTimeout(timer); dispose?.(); };
}
