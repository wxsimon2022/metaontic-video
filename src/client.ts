/** 浏览器宿主入口：新增业务界面只需加入模块清单。 */
import { createClientRuntime } from './client/runtime.js';
import { createVideoClient } from './businesses/video/client.js';
import { mountBundleAwareClient } from './client/bundle-migration.js';
import { PLUGIN_PACKAGE } from './core/hardcoded-config.js';
window.__ModuleLoader__.load({
  id: PLUGIN_PACKAGE,
  factory: require => {
    const runtime = createClientRuntime(require, [{ id: 'video', create: createVideoClient }]);
    return { ...runtime, apply: ctx => mountBundleAwareClient(ctx, require('react'), decorateSettings => runtime.apply(ctx, { decorateSettings })) };
  },
});
