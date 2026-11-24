import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const built = await build({ entryPoints: ['src/ui/components/notifications.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { createNoticeStore, parseNotices, NOTICE_POLL_MS } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const notice = (extra = {}) => ({ id: 'activity-1', title: '活动', content: '活动正文', enabled: true, ...extra });
function fixture() {
  const data = new Map();
  const storage = () => ({getItem: key => data.get(key), setItem: (key, value) => data.set(key, value)});
  let at = Date.parse('2026-11-24T00:00:00Z');
  let items = [notice()], calls = [], fail = false;
  const options = {storage, now: () => at, request: async (url, options) => {
    calls.push({url, options}); if (fail) throw Error('offline');
    return {ok: true, json: async () => ({code: 0, data: {items}})};
  }};
  return {options, calls, advance() {at += NOTICE_POLL_MS;}, setItems(value) {items = value;}, offline() {fail = true;}, online() {fail = false;}};
}
test('通知只接收有界纯文字，过滤损坏、未发布与重复消息', () => {
  assert.equal(parseNotices({items: [notice({enabled: false}), notice({title: ''}), notice({content: 'x'.repeat(1001)})]}).length, 0);
  const rows = parseNotices({items: [notice({content: '<script>test</script>'}), notice()]});
  assert.equal(rows.length, 1); assert.equal(rows[0].content, '<script>test</script>');
});
test('同一通知关闭后跨页面与重开保持关闭，内容编辑不重新提醒', async () => {
  const f = fixture(), store = createNoticeStore(f.options);
  await Promise.all([store.refresh(), store.refresh()]);
  assert.equal(f.calls.length, 1); assert.equal(store.current().id, 'activity-1');
  store.dismiss('activity-1'); assert.equal(store.current(), null);
  f.setItems([notice({title: '更新的标题', revision: 2})]); f.advance(); await store.refresh();
  assert.equal(store.current(), null);
  const reopened = createNoticeStore(f.options); assert.equal(reopened.current(), null);
  await reopened.refresh(); assert.equal(reopened.current(), null);
  assert.equal(f.calls[0].options.credentials, 'omit'); assert.equal(f.calls[0].options.body, undefined);
});
test('消息只存本地，离线重开仍展示，联网下架移除', async () => {
  const f = fixture(), store = createNoticeStore(f.options); await store.refresh();
  f.offline();
  const reopened = createNoticeStore(f.options); assert.equal(reopened.current().title, '活动');
  await reopened.refresh(); assert.equal(reopened.current().title, '活动');
  f.online(); f.setItems([]); f.advance(); await reopened.refresh(); assert.equal(reopened.current(), null);
  assert.equal(createNoticeStore(f.options).current(), null);

});
test('请求及响应体超时均不阻塞，保留本地缓存，无存储时仍可关闭', async () => {
  const f = fixture(), store = createNoticeStore(f.options); await store.refresh();
  const stuck = createNoticeStore({...f.options, timeoutMs: 5, request: async () => ({ok: true, json: () => new Promise(() => {})})});
  await stuck.refresh(); assert.ok(stuck.current());
  const ephemeral = createNoticeStore({...f.options, storage: () => {throw Error('blocked');}});
  await ephemeral.refresh(); ephemeral.dismiss('activity-1'); assert.equal(ephemeral.current(), null);
});
test('HTTP错误、异常业务响应、损坏JSON与连接挂起均静默，不影响本地关闭操作', async () => {
  const f = fixture();
  const saved = createNoticeStore(f.options); await saved.refresh();
  for (const request of [
    async () => ({ok: false, status: 500}),
    async () => ({ok: true, json: async () => ({code: 500, message: 'error'})}),
    async () => ({ok: true, json: async () => {throw Error('invalid json');}}),
    () => new Promise(() => {}),
  ]) {
    const store = createNoticeStore({...f.options, request, timeoutMs: 5});
    await assert.doesNotReject(store.refresh());
    assert.equal(store.current().id, 'activity-1');
    const empty = createNoticeStore({...f.options, request, timeoutMs: 5, storage: () => null});
    await assert.doesNotReject(empty.refresh()); assert.equal(empty.current(), null);
  }
});
