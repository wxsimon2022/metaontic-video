import { filmDirectorBusiness } from './businesses/film-director/index.js';
/** Harness 稳定入口：只组合公共框架、业务模块与 Agent 清单。 */
import { mountBundleAwareHost } from './core/installation/bundle-host.js';
import { createPluginRuntime } from './core/runtime.js';
import { agents } from './agents/index.js';
import { videoBusiness } from './businesses/video/index.js';
export { Config } from './config.js';
export const inject = ['tools'];
const mount = createPluginRuntime({ agents, businesses: [videoBusiness, filmDirectorBusiness] });
export const apply = (ctx: DshContext, config: any = {}) => mountBundleAwareHost(ctx, () => mount(ctx, config));
