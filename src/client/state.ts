/** 浏览器端 state：由入口注入宿主 React 与共享依赖。 */
export function createSettingsState({ React }: any) {
/** 订阅表单快照：宿主每次推送新值都会重渲染。 */
    function useSnapshot(form) {
      const [revision, bump] = React.useState(0);
      React.useEffect(() => form.subscribe(() => bump((value) => value + 1)), [form, revision]);
      return form.getSnapshot();
    }

    function same(a, b) {
      return a === b || (a === undefined && b === '') || (a === '' && b === undefined);
    }

    async function persistBatch(form, ops) {
      if (typeof form.mutate !== 'function') throw new Error('atomicUnsupported');
      if (!await form.mutate(ops)) throw new Error('atomicRejected');
    }

    function validateSettings(values) {
      const interval = Number(values.pollIntervalMs ?? 5000);
      const wait = Number(values.maxWaitMs ?? 600000);
      if (![interval, wait].every((n) => Number.isSafeInteger(n) && n >= 1000) || wait < interval) {
        throw new Error('invalidWait');
      }
      const trim = String(values.seamTrimSeconds ?? '').trim();
      if (trim && !trim.split(',').every((part) => part.trim() !== '' && Number.isFinite(Number(part)) && Number(part) >= 0 && Number(part) <= 3)) {
        throw new Error('invalidSeam');
      }
    }

    // 先写当前 Key、清空其他渠道凭据，最后提交模式。空值覆盖继承配置，避免 unset 后旧 Key 回流。
    async function persistConnection(form, pending, nextMode) {
      if (!['service', 'metaontic', 'volcengine'].includes(nextMode)) throw new Error('unknownConnection');
      const inactiveKeys = nextMode === 'volcengine'
        ? ['metaonticApiKey', 'apiKey', 'keyOrigin', 'baseUrl', 'submitPath', 'queryPath',
          'registerEmail', 'deviceId', 'deviceSecret', 'registerApi', 'registerToken']
        : nextMode === 'metaontic'
          ? ['volcengineApiKey', 'apiKey', 'keyOrigin', 'registerEmail', 'deviceId', 'deviceSecret', 'registerApi', 'registerToken']
          : ['volcengineApiKey', 'metaonticApiKey'];
      const ops = pending.filter(([key]) => key !== 'connectionMode' && !inactiveKeys.includes(key))
        .map(([key, next]) => ({ op: 'set', path: [key], value: next }));
      for (const key of inactiveKeys) ops.push({ op: 'set', path: [key], value: '' });
      ops.push({ op: 'set', path: ['connectionMode'], value: nextMode });
      // 成功响应代表宿主已接受整批写入；插件可能已重载，旧控制器的快照不再更新。
      await persistBatch(form, ops);
    }
  return { useSnapshot, same, validateSettings, persistConnection, persistBatch };
}
