/**
 * 客户端（浏览器半侧）用到、但 TypeScript 标准库还没声明的宿主注入项。
 */

/** Harness 客户端的模块加载器：插件用它在插件页里注册自己。 */
interface Window {
  __ModuleLoader__: {
    load(module: {
      id: string;
      factory(require: (name: string) => any): unknown;
    }): void;
  };
}

/** NavigatorUAData（Chrome 独有，标准库未收录），插件只读 platform。 */
interface Navigator {
  userAgentData?: { platform?: string };
}
