import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './module-test-api.mjs';
const doc = { nodes: { selected: {}, upstream: {} } };
const rpcFor = (projects, docs) => async (method, args) => method === 'projectsList' ? projects : docs[`${args.id}/${args.canvasId || ''}`] || { nodes: {} };
test('选中节点按完整可见集合定位，兼容默认画布和子画布', async () => {
  const projects = [{ id: 'first', nodeIds: ['selected'] }, { id: 'p', nodeIds: [], canvases: [{ id: 'child' }] }];
  assert.deepEqual(await api.resolveCanvasSelection('selected', ['selected', 'upstream'], rpcFor(projects, { 'p/child': doc })), { projectId: 'p', canvasId: 'child', nodeId: 'selected' });
  assert.deepEqual(await api.resolveCanvasSelection('selected', ['selected', 'upstream'], rpcFor([{id:'p'}], {'p/':doc})), {projectId:'p', nodeId:'selected'});
});
test('同节点多归属、未保存、读取失败和非法标识都停住，不猜第一项', async () => {
  await assert.rejects(api.resolveCanvasSelection('selected', ['selected'], rpcFor([{id:'a'}, {id:'b'}], {'a/':doc,'b/':doc})), /多个画布/);
  await assert.rejects(api.resolveCanvasSelection('selected', ['selected'], rpcFor([{id:'a'}], {})), /尚未同步/);
  await assert.rejects(api.resolveCanvasSelection('../wrong', ['../wrong'], () => assert.fail()), /先选中/);
  await assert.rejects(api.resolveCanvasSelection('selected', ['selected'], async method => { if(method==='projectsList') return [{id:'p'}]; throw Error('offline'); }), /offline/);
});
test('自动填入指定预设草稿，保留已有草稿，不发送或生成', async () => {
  const calls = [];
  await api.launchCanvasSelection({nodeId:'selected', visibleIds:['selected'], rpc:rpcFor([{id:'p'}], {'p/':doc}), isCurrent:()=>true,
    workspace:{startSession:async (...args)=>calls.push(args)},returnToChat:()=>calls.push('chat')});
  assert.equal(calls.length,2); const options=calls[0][1];
  assert.equal(options.agentPreset,'video-director'); assert.equal(options.whenDraftExists,'append');
  assert.match(options.prompt,/"projectId":"p"/); assert.match(options.prompt,/"nodeId":"selected"/);
  assert.match(options.prompt,/video_canvas\(action:read\)/); assert.match(options.prompt,/未确认前付费生成/);
  assert.equal(calls[1],'chat');
});
test('选择在读取期间变化或宿主服务缺失时不启动会话', async () => {
  let calls=0;
  await assert.rejects(api.launchCanvasSelection({nodeId:'selected',visibleIds:['selected'],rpc:rpcFor([{id:'p'}],{'p/':doc}),isCurrent:()=>false,workspace:{startSession:()=>calls++}}), /已改变/);
  await assert.rejects(api.launchCanvasSelection({workspace:{}}), /当前宿主/); assert.equal(calls,0);
});
test('画布请求只准只读方法，HTML/HTTP/错误回包失败关闭', async () => {
  await assert.rejects(api.canvasReadRpc('projectsPut', {}, ()=>assert.fail()), /不支持/);
  let payload;
  assert.deepEqual(await api.canvasReadRpc('projectsList', {}, async (url,options)=>{ assert.equal(url,'/infinite-canvas/api/rpc'); payload=JSON.parse(options.body); return {ok:true,json:async()=>[]}; }), []);
  assert.equal(payload.method,'projectsList');
  for(const response of [{ok:false,json:async()=>({})},{ok:true,json:async()=>({error:'private'})},{ok:true,json:async()=>{throw Error('html');}}]) await assert.rejects(api.canvasReadRpc('projectsList',{},async()=>response), /画布/);
});
