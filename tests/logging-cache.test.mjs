import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { AsyncLocalStorage } from 'node:async_hooks';
import { sourceOf } from './source.mjs';

function harness({ mkdir } = {}) {
  const state = { dirs: [], writes: [], failDir: false, failWrite: false };
  const context = vm.createContext({
    AsyncLocalStorage, path, TextEncoder, readdir: async()=>[], lstat:async file=>{if(!file.endsWith('requests.jsonl'))return {isDirectory:()=>true,isSymbolicLink:()=>false};throw Object.assign(Error(),{code:'ENOENT'})}, PLUGIN_VERSION: 'test',
    dshHome: () => '/home/.dsh',
    mkdir: async (dir, options) => {
      state.dirs.push(dir);
      if (state.failDir) throw new Error('read-only');
      return mkdir ? mkdir(dir, options) : undefined;
    },
    appendFile: async (file, text, options) => {
      state.writes.push({ file, text, options });
      if (state.failWrite) throw new Error('read-only');
    },
  });
  vm.runInContext(`${sourceOf('shared/utils/logging')}\nObject.assign(globalThis,{appendRequestLog,requestLogPath,logDiagnostics,requestLogContext});`, context);
  return { context, state };
}

test('日志目录每天只建一次，正文仍逐条追加', async () => {
  const { context, state } = harness();
  await context.appendRequestLog({ event: 'a' });
  await context.appendRequestLog({ event: 'b' });
  await context.appendRequestLog({ event: 'c' });
  assert.equal(state.dirs.length, 1, '同一目录不该反复 mkdir');
  assert.equal(state.dirs[0], path.dirname(context.requestLogPath()));
  assert.equal(state.writes.length, 3);
  assert.deepEqual(state.writes.map(({ options }) => options.mode), [0o600, 0o600, 0o600]);
  assert.match(state.writes[0].text, /"event":"a"/);
});

test('日志写不进去不抛错，且下次仍会重试建目录', async () => {
  const { context, state } = harness();
  state.failDir = true;
  await context.appendRequestLog({ event: 'a' });
  assert.equal(state.writes.length, 0);
  state.failDir = false;
  await context.appendRequestLog({ event: 'b' });
  assert.equal(state.dirs.length, 2, '建目录失败后不能记住成功状态');
  assert.equal(state.writes.length, 1);
  state.failWrite = true;
  await context.appendRequestLog({ event: 'c' });
});

test('日志白名单阻止正文和敏感字段，保留脱敏诊断信息', async () => {
  const {context,state} = harness();
  await context.appendRequestLog({event:'request_failed',apiKey:'private-key',body:{prompt:'private-script'},
    error:'raw-secret',reason:'upstream says private-script',model:'Bearer private-token',
    path:'C:\\Users\\private-name\\script.md',httpStatus:403,time:'fake',pluginVersion:'fake'});
  const record=JSON.parse(state.writes[0].text);
  assert.equal(record.httpStatus,403);assert.equal(record.path,'script.md');
  assert.equal(record.model,'[redacted]');assert.equal(record.reason,undefined);
  assert.equal(record.pluginVersion,'test');assert.notEqual(record.time,'fake');
  assert.doesNotMatch(state.writes[0].text,/private|raw-secret|fake/);
});

test('日志写入失败可诊断，恢复后继续写，不改变业务结果',async()=>{
 const {context,state}=harness();state.failWrite=true;
 await context.appendRequestLog({event:'failed'});
 const first=context.logDiagnostics();assert.equal(first.failures,1);assert.equal(first.lastErrorCode,'LOG_WRITE_FAILED');
 state.failWrite=false;await context.appendRequestLog({event:'recovered'});
 assert.equal(context.logDiagnostics().written,1);assert.ok(context.logDiagnostics().lastSuccessAt);
});

test('node test 未显式指定隔离目录时不写用户日志',async()=>{
 const {context,state}=harness();context.process={env:{NODE_TEST_CONTEXT:'child-v8'}};
 await context.appendRequestLog({event:'test'});assert.equal(state.writes.length,0);assert.equal(state.dirs.length,0);
});

test('单日日志达到容量上限时停止增长且状态可查询',async()=>{
 const {context,state}=harness();vm.runInContext('LOG_POLICY.dailyBytes=1',context);
 await context.appendRequestLog({event:'test'});assert.equal(state.writes.length,0);
 assert.equal(context.logDiagnostics().dropped,1);assert.equal(context.logDiagnostics().lastErrorCode,'DAILY_LIMIT');
});

test('并发调用保留各自上下文，不混用项目或调用编号',async()=>{
 const {context,state}=harness();
 await Promise.all(['a','b'].map(id=>context.requestLogContext.run({callId:id,projectId:`project-${id}`},()=>context.appendRequestLog({event:'test'}))));
 const rows=state.writes.map(x=>JSON.parse(x.text));assert.deepEqual(rows.map(x=>[x.callId,x.projectId]),[['a','project-a'],['b','project-b']]);
});

test('队列有上限，拥塞时只丢弃日志，不阻断业务或无限积压',async()=>{
 let unblock;const gate=new Promise(resolve=>{unblock=resolve});
 const {context,state}=harness({mkdir:()=>gate});
 vm.runInContext('LOG_POLICY.queueLimit=2',context);
 const first=context.appendRequestLog({event:'first'}),second=context.appendRequestLog({event:'second'});
 await context.appendRequestLog({event:'overflow'});
 assert.equal(context.logDiagnostics().pending,2);assert.equal(context.logDiagnostics().dropped,1);
 unblock();await Promise.all([first,second]);assert.equal(state.writes.length,2);assert.equal(context.logDiagnostics().pending,0);
});

test('未知嵌套对象、循环引用和超长消息不会写入正文或破坏JSONL',async()=>{
 const {context,state}=harness();const circular={};circular.self=circular;
 await context.appendRequestLog({event:'test',body:circular,model:'x'.repeat(1000),elapsedMs:NaN,cuts:[{index:1,seconds:0.5,tailSeconds:0,secret:'hidden'}]});
 const record=JSON.parse(state.writes[0].text);assert.equal(record.model.length,256);assert.equal(record.elapsedMs,undefined);
 assert.deepEqual(record.cuts,[{index:1,seconds:0.5,tailSeconds:0}]);assert.equal(record.body,undefined);
});
