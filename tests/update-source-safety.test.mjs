import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {sourceOf} from './source.mjs';
import {hostUpdateResult} from './update-host-fixture.mjs';
function setup(options={}) {
 const state={calls:[],status:'',message:'',reads:0};
 const row={name:'dsh-metaontic-video',installed:true,source:'dsh-metaontic-video@4.4.0',version:'4.4.0',...options.row};
 const manager={
  listBundles:async()=>{state.reads++;if(options.list)return options.list(state.reads);return [row];},
  updateBundle:async(...args)=>{state.calls.push(args);return options.update?options.update():hostUpdateResult({application:'applied',version:'4.4.1'});},
  installBundle:()=>assert.fail('Existing package must never use installBundle'),
  removeBundle:()=>assert.fail('Client must never remove a bundle'),
 };
 if(options.unsupported) delete manager.updateBundle;
 const sandbox=vm.createContext({window:{localStorage:{removeItem(){}}}});
 vm.runInContext(sourceOf('ui/updates/update.service'),sandbox);
 const context={PLUGIN_PACKAGE:'dsh-metaontic-video',PLUGIN_VERSION:'4.4.0',updateLatest:'4.4.1',updateConfirm:true,availableVersions:['4.4.1'],manager:()=>({manager,tried:['native']}),isNewerVersion:(a,b)=>a.localeCompare(b,undefined,{numeric:true})>0,verifyRuntime:async()=>options.live!==false,setUpdateConfirm(){},setUpdateLatest(){},setUpdateStatus:v=>state.status=v,setUpdateMessage:v=>state.message=v,t:(key,args)=>key+(args?.message?':'+args.message:''),...options.context};
 return {state,run:()=>sandbox.createUpdateActions(context).runOnlineUpdate()};
}
test('已安装npm包只调用原生updateBundle，固定包名和版本，不调用新增安装或卸载',async()=>{
 const h=setup();await h.run();assert.equal(h.state.status,'applied');assert.equal(h.state.calls.length,1);assert.equal(h.state.calls[0][0],'dsh-metaontic-video');assert.equal(h.state.calls[0][1],'4.4.1');assert.match(h.state.calls[0][2].requestId,/dsh-metaontic-video-update-/);
});
for(const source of ['link:D:\\software\\package','D:\\software\\package','file:D:/software/package','file:///D:/software/package','\\\\server\\share\\package','/Users/name/package','link:/tmp/test.tgz','dsh-metaontic-video@file:D:\\software\\package']){
 test(`目录链接保留原状: ${source}`,async()=>{const h=setup({row:{source}});await h.run();assert.equal(h.state.calls.length,0);assert.equal(h.state.status,'failed');assert.match(h.state.message,/本地目录链接/);});
}
for(const source of ['file:D:\\软件 路径\\plugin.tgz','C:\\Downloads\\plugin.tar.gz','file:/tmp/中文 空格/plugin.tgz','https://example.com/plugin.tgz','git+https://gitee.com/hackloop/metaontic-video.git']){
 test(`旧成品来源不误走新增安装，给出迁移指引: ${source}`,async()=>{const h=setup({row:{source}});await h.run();assert.equal(h.state.calls.length,0);assert.match(h.state.message,/尚未迁移为npm包/);assert.match(h.state.message,/不要先卸载/);});
}
for(const row of [{source:''},{error:'ENOENT'},{meta:{error:'unreadable'}}]){
 test('无法核实安装来源时不执行替换',async()=>{const h=setup({row});await h.run();assert.equal(h.state.calls.length,0);assert.match(h.state.message,/无法核实/);});
}
test('旧宿主缺少更新接口时停止，不回退新增安装',async()=>{const h=setup({unsupported:true});await h.run();assert.equal(h.state.calls.length,0);assert.equal(h.state.status,'failed');});
for(const live of [true,false]){
 test(`目标已安装，只核对运行状态 live=${live}`,async()=>{const h=setup({row:{version:'4.4.1'},live});await h.run();assert.equal(h.state.calls.length,0);assert.equal(h.state.status,live?'applied':'pending');});
}
test('已安装更高版本不降级',async()=>{const h=setup({row:{version:'4.4.2'}});await h.run();assert.equal(h.state.calls.length,0);assert.match(h.state.message,/不高于/);});
test('already-installed竞态重新核实目标版本，不能仅凭错误当作成功',async()=>{
 for(const installed of ['4.4.0','4.4.1']){
  const h=setup({update:()=>({ok:false,error:{code:'already-installed'}}),list:n=>[{name:'dsh-metaontic-video',installed:true,source:'dsh-metaontic-video@4.4.0',version:n>1?installed:'4.4.0'}]});
  await h.run();assert.equal(h.state.calls.length,1);assert.equal(h.state.status,installed==='4.4.1'?'applied':'failed');
 }
});
test('更新通信结果不明不自动重放',async()=>{const h=setup({update:()=>{throw Error('network timeout');}});await h.run();assert.equal(h.state.calls.length,1);assert.match(h.state.message,/通信结果未确认/);});
test('原生更新失败和回滚失败均不报告成功，缺integrity返回针对性说明',async()=>{
 for(const failedRestore of [false,true]){
  const h=setup({update:()=>hostUpdateResult({application:'failed',error:{code:'operation-error',diagnostic:'ERR_PNPM_MISSING_TARBALL_INTEGRITY'}},{restore:{application:failedRestore?'failed':'applied'}})});
  await h.run();assert.equal(h.state.calls.length,1);assert.equal(h.state.status,'failed');assert.match(h.state.message,/versionUpdateLockfile/);assert.equal(h.state.message.includes('原版本恢复未完成'),failedRestore);
 }
});
test('宿主返回错误版本或只完成移除阶段，均不得报告更新成功',async()=>{
 for(const result of [hostUpdateResult({application:'applied',version:'4.4.0'}),hostUpdateResult({application:'applied',version:'4.4.1'},{step:'remove'})]){
  const h=setup({update:()=>result});await h.run();assert.equal(h.state.status,'failed');
 }
});
