import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {sourceOf} from './source.mjs';
const {followConfiguredEntries}=vm.runInNewContext(`${sourceOf('ui/components/configured-entries')}\n({followConfiguredEntries})`);

test('侧栏默认开启，保存关闭时卸载，重新开启且不重复注册，销毁后忽略通知',()=>{
 let value={},listener,registered=0,removed=0;
 const form={getSnapshot:()=>({value}),subscribe:fn=>{listener=fn;return ()=>{};}};
 const stop=followConfiguredEntries(form,'enabled',[()=>{registered++;return ()=>removed++;},()=>{registered++;return ()=>removed++;}]);
 assert.equal(registered,2);
 listener();assert.equal(registered,2);
 value={enabled:false};listener();assert.equal(removed,2);
 value={enabled:true};listener();assert.equal(registered,4);
 stop();assert.equal(removed,4);
 listener();assert.equal(registered,4);
});
test('已保存关闭状态不装载；部分注册失败释放已创建入口',()=>{
 let count=0;
 const stop=followConfiguredEntries({getSnapshot:()=>({value:{enabled:false}})},'enabled',[()=>{count++;}]);
 assert.equal(count,0);stop();
 assert.throws(()=>followConfiguredEntries({},'enabled',[()=>()=>count++,()=>{throw Error('failed');}]),/failed/);
 assert.equal(count,1);
});
