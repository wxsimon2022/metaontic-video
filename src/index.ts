import { filmDirectorBusiness } from './businesses/film-production/index.js';
/** Harness 稳定入口：只组合公共框架、业务模块与 Agent 清单。 */
import { mountBundleAwareHost } from './platform/migration/bundle-host.js';
import { createPluginRuntime } from './app/bootstrap.js';
import { agents } from './agents/index.js';
import { videoBusiness } from './businesses/video-generation/index.js';
export { Config } from './app/config/config-composer.js';
export const inject = ['tools'];
const mount = createPluginRuntime({ agents, businesses: [videoBusiness, filmDirectorBusiness] });
export const apply = (ctx: DshContext, config: any = {}) => mountBundleAwareHost(ctx, () => mount(ctx, config));
