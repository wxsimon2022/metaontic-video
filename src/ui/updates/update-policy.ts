import { createUpdatePolicy, UPDATE_POLICY_CACHE_KEY, UPDATE_POLICY_INTERVAL_MS } from '../../shared/updates/policy.js';

export function createPolicyHook(React: any, version: string) {
  const policy = createUpdatePolicy({ version,
    read: async () => JSON.parse(window.localStorage.getItem(UPDATE_POLICY_CACHE_KEY) || 'null'),
    write: async value => { window.localStorage.setItem(UPDATE_POLICY_CACHE_KEY, JSON.stringify(value)); },
  });
  return function useVersionPolicy() {
    const [state, setState] = React.useState(() => policy.snapshot());
    React.useEffect(() => {
      const unsubscribe = policy.subscribe(() => setState(policy.snapshot()));
      void policy.refresh();
      const timer = typeof window.setInterval === 'function' ? window.setInterval(() => { void policy.refresh(); }, UPDATE_POLICY_INTERVAL_MS) : null;
      return () => { unsubscribe(); if (timer !== null) window.clearInterval(timer); };
    }, []);
    return state;
  };
}
