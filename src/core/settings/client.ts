/** 同一插件配置槽可组合多个业务设置，避免后注册的页面覆盖前一个。 */
export function createSettingsPages(h: any, decorate: (Page: any) => any = Page => Page) {
  const pages = new Map<string, { id: string; namespace: string; locale?: string; Page: any }[]>();
  return {
    register(page: { id: string; namespace: string; locale?: string; Page: any }) {
      const group = pages.get(page.namespace) || [];
      if (group.some(existing => existing.id === page.id)) throw new Error(`重复的设置页：${page.id}`);
      group.push(page);
      pages.set(page.namespace, group);
    },
    mount(ctx: any) {
      for (const [namespace, group] of pages) {
        const Content = group.length === 1 ? group[0].Page : props => h('div', {}, ...group.map(page => h(page.Page, { ...props, key: page.id })));
        const Page = decorate(Content);
        ctx.effect(() => ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config', key: namespace, locale: group[0].locale,
        }, Page)), `${namespace}: configuration page`);
      }
    },
  };
}
