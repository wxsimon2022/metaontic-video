import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './module-test-api.mjs';
const installed = { name: api.CANVAS_PACKAGE, installed: true, enabled: true, source: 'link:/keep/my/canvas' };
test('画布安装检测兼容宿主两种回包，异常失败关闭', () => {
  assert.deepEqual(api.canvasBundleState([]), { installed: false, available: false });
  assert.equal(api.canvasBundleState({ ok: true, value: [installed] }).available, true);
  assert.equal(api.canvasBundleState([{ ...installed, enabled: false }]).available, false);
  assert.equal(api.canvasBundleState([{ ...installed, error: 'load' }]).available, false);
  assert.equal(api.canvasBundleState([{ ...installed, availability: 'missing' }]).available, false);
  assert.throws(() => api.canvasBundleState({ ok: false }));
});
test('画布适配接受0.20.1起的0.20.x（原版自带升级会推到0.20.2），拒绝更早或无效版本', () => {
  assert.equal(api.canvasVersionSupported('0.20.1'), true);
  assert.equal(api.canvasVersionSupported('0.20.2'), true);
  assert.equal(api.canvasVersionSupported('0.20.17'), true);
  assert.equal(api.canvasVersionSupported('0.21.0'), true);
  assert.equal(api.canvasVersionSupported('1.0.0'), true);
  assert.equal(api.canvasVersionSupported('0.20.0'), false);
  assert.equal(api.canvasVersionSupported('0.19.9'), false);
  assert.equal(api.canvasVersionSupported(''), false);
  assert.equal(api.canvasVersionSupported(undefined), false);
  assert.equal(api.canvasVersionSupported('v0.20.2'), false);
});
test('已有原版画布不重装，不覆盖目录链接或升级已有版本', async () => {
  let installs = 0;
  const result = await api.installCanvas({ listBundles: async () => [installed], installBundle: async () => installs++ });
  assert.equal(result.existing, true); assert.equal(installs, 0);
});
test('安装仅调用固定正式npm包一次，成功后重新核对状态', async () => {
  let calls = 0, installedNow = false;
  const result = await api.installCanvas({ listBundles: async () => installedNow ? [installed] : [], installBundle: async (spec, options) => {
    calls++; assert.equal(spec, '@ninkch/dsh-infinite-canvas@0.20.1'); assert.equal(options.enabled, true);
    installedNow = true; return { ok: true, value: { application: 'applied' } };
  } });
  assert.equal(result.available, true); assert.equal(result.restartRequired, false); assert.equal(calls, 1);
});
test('只有明确restart-required才提示重启，安装失败不重试', async () => {
  let calls = 0;
  const manager = { listBundles: async () => [], installBundle: async () => { calls++; return { ok: true, value: { application: 'restart-required' } }; } };
  assert.equal((await api.installCanvas(manager)).restartRequired, true);
  manager.installBundle = async () => { calls++; return { ok: true, value: { application: 'failed' } }; };
  await assert.rejects(api.installCanvas(manager), /安装未完成/); assert.equal(calls, 2);
  await assert.rejects(api.installCanvas({}), /当前宿主无法安装/);
});

test('安装取消、被覆盖和未知回包均不误报成功', async () => {
  for (const application of ['cancelled', 'overridden', undefined]) {
    await assert.rejects(api.installCanvas({ listBundles: async () => [], installBundle: async () => ({ok: true, value: {application}}) }), /安装未完成/);
  }
});
