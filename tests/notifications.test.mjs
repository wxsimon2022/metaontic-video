import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
const built = await build({ entryPoints: ['src/ui/components/notifications.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
const { createNoticeStore, createNotificationBanner, parseNotices, safeNoticeLink, NOTICE_POLL_MS } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
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

test('消息链接校验：只允许完整网页地址，非法链接退回普通消息', () => {
  for (const value of ['javascript:alert(1)', 'file:///tmp/a', '//example.com',
    'https://u:p@example.com', 'https://example.com:bad', 'https://example.com/a b',
    'https://example.com/\\evil', 'data:text/html,test']) assert.equal(safeNoticeLink(value), '');
  assert.equal(safeNoticeLink('https://example.com/event'), 'https://example.com/event');
  assert.equal(safeNoticeLink('http://example.com/event'), 'http://example.com/event');
  const [row] = parseNotices({items: [notice({action_url: 'javascript:alert(1)'})]});
  assert.equal(row.action_url, '');
});
test('配置链接则整条消息可跳转，未配置不跳转；关闭按钮独立且不会导航', () => {
  const h = (type, props, ...children) => ({type, props: props || {}, children: children.flat()});
  const React = {useState: () => [0, () => {}], useEffect: () => {}};
  const dismissed = [];
  for (const url of ['', 'https://example.com/event']) {
    const store = {current: () => ({...notice(), action_url: url}), dismiss: id => dismissed.push(id)};
    const Banner = createNotificationBanner({React, h, TOKENS: {}, store});
    const rendered = Banner();
    const [message, close] = rendered.children;
    assert.equal(message.type, url ? 'a' : 'div');
    assert.equal(message.props.href, url || undefined);
    if (url) { assert.equal(message.props.target, '_blank'); assert.equal(message.props.rel, 'noopener noreferrer'); }
    assert.equal(close.type, 'button'); assert.equal(close.props.href, undefined);
    assert.equal(message.children.some(child => child?.type === 'button'), false);
    close.props.onClick();
  }
  assert.deepEqual(dismissed, ['activity-1', 'activity-1']);
});
test('链接随消息缓存在本地，旧版无链接缓存继续显示', async () => {
  const f = fixture();
  f.setItems([notice({action_url: 'https://example.com/event'})]);
  await createNoticeStore(f.options).refresh();
  f.offline();
  const reopened = createNoticeStore(f.options);
  assert.equal(reopened.current().action_url, 'https://example.com/event');
  await reopened.refresh(); assert.equal(reopened.current().action_url, 'https://example.com/event');
  assert.equal(parseNotices({items: [notice()]})[0].action_url, '');
});

test('设置页同时展示多条通知，关闭只移除对应一条并持久化；首页仍展示最新一条', async () => {
  const f = fixture();
  f.setItems([notice({id:'newest',title:'最新活动',action_url:'https://example.com/new'}),notice({id:'second',title:'第二条'}),notice({id:'third',title:'第三条'})]);
  const store = createNoticeStore(f.options);await store.refresh();
  const h = (type, props, ...children) => ({type,props:props||{},children:children.flat()});
  const React = {useState:()=>[0,()=>{}],useEffect:()=>{}};
  const Banner = createNotificationBanner({React,h,TOKENS:{},store});
  let list=Banner({multiple:true});assert.equal(list.type,'section');assert.equal(list.children.length,3);
  assert.equal(list.props.style.overflowY,'auto');
  assert.deepEqual(list.children.map(row=>row.props.key),['newest','second','third']);
  assert.equal(list.children[0].children[0].type,'a');assert.equal(list.children[1].children[0].type,'div');
  list.children[1].children[1].props.onClick();
  list=Banner({multiple:true});assert.deepEqual(list.children.map(row=>row.props.key),['newest','third']);
  assert.deepEqual(createNoticeStore(f.options).visible().map(row=>row.id),['newest','third']);
  assert.equal(Banner().type,'aside');assert.equal(Banner().props.key,'newest');
  list.children[0].children[1].props.onClick();assert.equal(Banner().props.key,'third');
  Banner({multiple:true}).children[0].children[1].props.onClick();assert.equal(Banner({multiple:true}),null);
});
test('多条通知离线重开保留顺序，下架后仅移除下架项且仍复用已关闭记录',async()=>{
 const f=fixture();f.setItems([notice({id:'first'}),notice({id:'second'}),notice({id:'third'})]);
 const store=createNoticeStore(f.options);await store.refresh();store.dismiss('second');f.offline();
 const reopened=createNoticeStore(f.options);await reopened.refresh();assert.deepEqual(reopened.visible().map(row=>row.id),['first','third']);
 f.online();f.setItems([notice({id:'second'}),notice({id:'third'})]);f.advance();await reopened.refresh();
 assert.deepEqual(reopened.visible().map(row=>row.id),['third']);
});
