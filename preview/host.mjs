/** Standalone preview adapter for the host services consumed by the real client. */
export function createPreviewHost({ form, components, dictionaries, getLocale, onUpdate }) {
  return {
    locale: {
      register(ns, dictionary) { dictionaries[ns] = dictionary; },
      bind(ns) {
        return (key, args = {}) => String(dictionaries[ns]?.[getLocale()]?.[key] ?? key)
          .replace(/\{(\w+)\}/g, (_, name) => args[name] ?? `{${name}}`);
      },
    },
    configForms: { get: () => form },
    // The preview supplies startedAt directly to progress cards and has no real session.
    uiSession: { provide() { return () => {}; } },
    effect(fn) { return fn(); },
    slots: {
      register(spec, component) {
        const key = spec.key || spec.id;
        components[key] = component;
        return () => { delete components[key]; };
      },
      inject(_slot, callback) {
        const result = callback();
        if (result?.next) for (const _ of result) {}
        return () => {};
      },
    },
    get() { return { installBundle: async () => { onUpdate(); return {}; } }; },
  };
}
