import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
function extract(name) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start >= 0, name);
  // Bundled functions end at the same indentation as their declaration.
  const indent = source.slice(source.lastIndexOf('\n', start) + 1, start);
  const end = source.indexOf('\n' + indent + '}', start);
  return source.slice(start, end + indent.length + 2);
}
function setup(fail = false) {
  const state = { connectionMode: 'service', apiKey: 'previous', deviceSecret: 'device', model: 'model' };
  const events = []; let calls = 0;
  const ctx = vm.createContext({
    form: { async mutate(ops) { calls++; if (fail) return false; for (const op of ops) { if (op.op === 'unset') delete state[op.path[0]]; else state[op.path[0]] = op.value; } return true; } },
    connectionBusy: { current: false }, window: { confirm: () => true }, snapshot: { user: { ...state } },
    PLUGIN_OWNED_KEYS: Object.keys(state), serviceActive: () => true,
    clearLoggedOut: () => events.push('logged-in'), forgetDevice: () => events.push('forgot-device'),
    deviceWrites: () => [['deviceId', 'new-device'], ['deviceSecret', 'new-secret']],
    registerApiRoot: () => 'https://example.invalid',
    clear: () => {}, setSaveError: x => events.push(['error', x]),
    setStatus: x => events.push(['status', x]), setRegisterStatus: x => events.push(['register', x]),
    setDraft: () => {}, setVisibleKey: () => {}, setRegisterEmail: () => {}, setRegisterMessage: () => {}, setRegisterCode: () => {}, setQuota: () => {},
    flashStatus: x => events.push(['flash', x]),
    settingsError: e => e.message, t: (key, args) => args ? `${key}: ${args.message}` : key,
    loadQuota: async () => {}, loadUsage: async () => {},
  });
  for (const name of ['persistBatch', 'persistConnection', 'validateSettings', 'reset', 'applyRegistration']) vm.runInContext(extract(name), ctx);
  return { ctx, state, events, calls: () => calls };
}
test('login writes credentials together and only marks login after acceptance', async () => {
  const h = setup();
  assert.equal(await h.ctx.applyRegistration({ api_key: 'new', email: 'test@example.invalid', model: 'new-model' }), true);
  assert.equal(h.calls(), 1); assert.equal(h.state.apiKey, 'new'); assert.equal(h.state.deviceSecret, 'new-secret');
  assert.equal(h.state.metaonticApiKey, ''); assert.ok(h.events.includes('logged-in'));
  const rejected = setup(true);
  await assert.rejects(rejected.ctx.applyRegistration({ api_key: 'new' }), /atomicRejected/);
  assert.equal(rejected.calls(), 1); assert.equal(rejected.state.apiKey, 'previous'); assert.ok(!rejected.events.includes('logged-in'));
  assert.equal(rejected.ctx.connectionBusy.current, false);
});
test('reset clears in one operation and preserves local identity if rejected', async () => {
  const h = setup(); await h.ctx.reset();
  assert.equal(h.calls(), 1); assert.deepEqual(h.state, {}); assert.ok(h.events.includes('forgot-device'));
  assert.ok(h.events.some(e => Array.isArray(e) && e[0] === 'flash' && e[1] === 'reset'));
  const rejected = setup(true); await rejected.ctx.reset();
  assert.equal(rejected.calls(), 1); assert.equal(rejected.state.apiKey, 'previous'); assert.ok(!rejected.events.includes('forgot-device'));
  assert.ok(rejected.events.some(e => Array.isArray(e) && e[0] === 'error' && /resetFailed/.test(e[1])));
  assert.equal(rejected.ctx.connectionBusy.current, false);
});
test('wait and seam validation accepts defaults and rejects invalid combinations', () => {
  const { ctx } = setup();
  assert.doesNotThrow(() => ctx.validateSettings({}));
  assert.doesNotThrow(() => ctx.validateSettings({ pollIntervalMs: 1500, maxWaitMs: 2000, seamTrimSeconds: '0.5,0' }));
  for (const args of [{ pollIntervalMs: '' }, { pollIntervalMs: 500 }, { maxWaitMs: 1000 }, { maxWaitMs: Infinity }, { pollIntervalMs: 1000.5 }]) assert.throws(() => ctx.validateSettings(args), /invalidWait/);
  for (const seamTrimSeconds of ['0.5,', '-1', '3.1', 'bad']) assert.throws(() => ctx.validateSettings({ seamTrimSeconds }), /invalidSeam/);
});
test('wait controls show seconds, retain millisecond precision and preserve an empty draft', () => {
  const ctx = vm.createContext({
    draft: {}, value: { pollIntervalMs: 5500, maxWaitMs: 600000 }, snapshot: {}, SELECTS: {}, visibleKey: '', inputStyle: {},
    h: (tag, props, ...children) => ({ tag, props, children }),
    edit: (key, value) => { ctx.draft[key] = value; },
  });
  vm.runInContext(extract('control'), ctx);
  const field = { key: 'pollIntervalMs', kind: 'number' };
  let input = ctx.control(field); assert.equal(input.props.value, 5.5); assert.equal(input.props.min, 1);
  input.props.onChange({ target: { value: '1.125' } }); assert.equal(ctx.draft.pollIntervalMs, 1125);
  input = ctx.control(field); assert.equal(input.props.value, 1.125);
  input.props.onChange({ target: { value: '' } }); assert.equal(ctx.control(field).props.value, '');
  delete ctx.value.maxWaitMs; assert.equal(ctx.control({ key: 'maxWaitMs', kind: 'number' }).props.value, 600);
});
test('update bell only appears for newer versions and names the available version', () => {
  const ctx = vm.createContext({ h: (tag, props, ...children) => ({ tag, props, children }) });
  vm.runInContext(extract('isNewerVersion'), ctx);
  vm.runInContext(extract('updateBell'), ctx);
  const t = (_key, args) => `New version ${args.version}`;
  assert.equal(ctx.updateBell(t, '3.2.2', '3.2.2'), null);
  assert.equal(ctx.updateBell(t, '3.2.1', '3.2.2'), null);
  assert.equal(ctx.updateBell(t, '', '3.2.2'), null);
  const bell = ctx.updateBell(t, '3.2.3', '3.2.2');
  assert.equal(bell.props['data-field'], 'update-bell');
  assert.equal(bell.props['aria-label'], 'New version 3.2.3');
});
test('automatic update failures do not change page status; manual failures remain visible', async () => {
  const events = [];
  const ctx = vm.createContext({
    fetchLatestVersion: async () => { throw new Error('offline'); },
    setUpdateStatus: value => events.push(value), setUpdateMessage: value => events.push(value),
    t: (_key, args) => args.message,
  });
  vm.runInContext(extract('checkForUpdate'), ctx);
  assert.equal(await ctx.checkForUpdate(true), '');
  assert.deepEqual(events, []);
  assert.equal(await ctx.checkForUpdate(false), '');
  assert.ok(events.includes('failed')); assert.ok(events.includes('offline'));
});
