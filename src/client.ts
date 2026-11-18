/** 浏览器宿主入口：新增业务界面只需加入模块清单。 */
import { createClientRuntime } from './app/composition/client.composer.js';
import { createVideoClient } from './businesses/video-generation/client.js';
import { mountBundleAwareClient } from './ui/installation/bundle-migration.js';
import { PLUGIN_PACKAGE } from './shared/constants/plugin.js';
window.__ModuleLoader__.load({
  id: PLUGIN_PACKAGE,
  factory: require => {
    const runtime = createClientRuntime(require, [{ id: 'video', create: createVideoClient }]);
    return { ...runtime, apply: ctx => mountBundleAwareClient(ctx, require('react'), decorateSettings => runtime.apply(ctx, { decorateSettings })) };
  },
});
