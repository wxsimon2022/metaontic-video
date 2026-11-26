import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { sourceOf } from './source.mjs';

function setup(manager) {
  const state={calls:0,status:'',message:''};
  const sandbox=vm.createContext({window:{localStorage:{removeItem(){}}}});
  vm.runInContext(sourceOf('ui/updates/update.service'),sandbox);
  const api={...manager,installBundle:async()=>{state.calls++;return {ok:true,value:{application:'applied',version:'3.13.2'}};}};
  const context={verifyRuntime:async()=>true,updateConfirm:true,PLUGIN_VERSION:'3.13.1',updateLatest:'3.13.2',availableVersions:['3.13.2'],
    PLUGIN_PACKAGE:'metaontic-video',UPDATE_ATTEMPTS:1,UPDATE_CACHE_KEY:'test',
    manager:()=>({manager:api}),isNewerVersion:()=>true,setUpdateConfirm(){},setUpdateLatest(){},
    setUpdateStatus:v=>{state.status=v;},setUpdateMessage:v=>{state.message=v;},setUpdateAt(){},t:key=>key};
  return {actions:sandbox.createUpdateActions(context),state};
}
for(const source of ['link:D:\\software\\package','D:\\software\\package','file:D:/software/package','file:///D:/software/package',
 '\\\\server\\share\\package','/Users/name/package','file:/Users/name/package','link:/tmp/test.tgz','metaontic-video@file:D:\\software\\package']) {
 test(`directory source blocks replacement before installer: ${source}`,async()=>{
  const h=setup({listBundles:async()=>({ok:true,value:[{name:'metaontic-video',installed:true,source}]})});
  await h.actions.runOnlineUpdate();assert.equal(h.state.calls,0);assert.equal(h.state.status,'failed');assert.match(h.state.message,/本地目录链接/);
 });
}
for(const source of ['file:D:\\软件 路径\\plugin.tgz','C:\\Downloads\\plugin.tar.gz','file:/tmp/中文 空格/plugin.tgz',
 'https://example.com/plugin.tgz','git+https://gitee.com/hackloop/metaontic-video.git','metaontic-video@3.13.1']) {
 test(`managed or repository source permits confirmed update: ${source}`,async()=>{
  const h=setup({listBundles:async()=>[{name:'metaontic-video',installed:true,source}]});
  await h.actions.runOnlineUpdate();assert.equal(h.state.calls,1);assert.equal(h.state.status,'applied');
 });
}
for(const manager of [{},{listBundles:async()=>{throw Error('transport');}},{listBundles:async()=>({ok:false})},
 {listBundles:async()=>[]},{listBundles:async()=>[{name:'other',installed:true,source:'https://example.com/pkg.tgz'}]},
 {listBundles:async()=>[{name:'metaontic-video',installed:true}]},
 {listBundles:async()=>[{name:'metaontic-video',installed:true,source:'https://example.com/pkg.tgz',meta:{error:'ENOENT'}}]}]) {
 test('unverified installation state fails closed without installer call',async()=>{
  const h=setup(manager);await h.actions.runOnlineUpdate();assert.equal(h.state.calls,0);assert.equal(h.state.status,'failed');assert.match(h.state.message,/无法核实/);
 });
}
test('local source block preserves real directory content across repeated clicks',async()=>{
 const temp=await mkdtemp(path.join(tmpdir(),'meta-update-safety-'));
 try {
  await mkdir(path.join(temp,'locale'));await writeFile(path.join(temp,'locale/en.json'),'original metadata');
  const h=setup({listBundles:async()=>[{name:'metaontic-video',installed:true,source:`link:${temp}`}]});
  await h.actions.runOnlineUpdate();await h.actions.runOnlineUpdate();
  assert.equal(h.state.calls,0);assert.equal(await readFile(path.join(temp,'locale/en.json'),'utf8'),'original metadata');
  assert.deepEqual(await readdir(temp),['locale']);
 }finally{await rm(temp,{recursive:true,force:true});}
});

test('lockfile integrity failure waits for the background cleanup and retries, never switches mirror',async()=>{
  const state={calls:0,status:'',message:'',waits:0};
  // 插件的后台清理每 2 秒扫一次锁文件：客户端命中该错误时应当等清理完成再试，而不是让用户自己数秒重按。
  const sandbox=vm.createContext({window:{localStorage:{removeItem(){}},setTimeout:(fn)=>{state.waits+=1;fn();return 0;}}});
  vm.runInContext(sourceOf('ui/updates/update.service'),sandbox);
  const diagnostic='ERR_PNPM_MISSING_TARBALL_INTEGRITY Cannot install package "metaontic-video@https://gitee.com/x.tgz": its lockfile entry has no "integrity" field';
  const api={listBundles:async()=>[{name:'metaontic-video',installed:true,source:'https://gitee.com/hackloop/metaontic-video/releases/download/v3.13.10/metaontic-video-3.13.10.tgz'}],
    installBundle:async()=>{state.calls+=1;return {ok:true,value:{application:'failed',error:{code:'operation-error',diagnostic}}};}};
  const context={updateConfirm:true,PLUGIN_VERSION:'3.13.9',updateLatest:'3.13.10',availableVersions:['3.13.10'],
    PLUGIN_PACKAGE:'metaontic-video',UPDATE_ATTEMPTS:3,UPDATE_CACHE_KEY:'test',
    manager:()=>({manager:api}),isNewerVersion:()=>true,setUpdateConfirm(){},setUpdateLatest(){},
    setUpdateStatus:v=>{state.status=v;},setUpdateMessage:v=>{state.message=v;},setUpdateAt(){},t:key=>key};
  await sandbox.createUpdateActions(context).runOnlineUpdate();
  assert.equal(state.calls,3);                       // 只在同一个npm版本上等清理后重试，不切换来源
  assert.equal(state.waits,2);                       // 前两次之间各等一次后台清理，第三次才收尾
  assert.equal(state.status,'failed');
  assert.match(state.message,/^versionUpdateLockfile/);
});

test('更新统一固定npm包名与正式版本，旧tgz来源可迁移，缺包不回退下载链接', async () => {
 for (const failed of [false, true]) {
  const calls = [], state = {};
  const sandbox = vm.createContext({window:{localStorage:{removeItem(){}}}});
  vm.runInContext(sourceOf('ui/updates/update.service'), sandbox);
  const manager = {
   listBundles: async () => [{name:'dsh-metaontic-video',installed:true,source:'https://gitee.com/example/old.tgz'}],
   installBundle: async (spec, options) => {
    calls.push({spec, options});
    return failed ? {ok:false,error:{message:'ERR_PNPM_NO_MATCHING_VERSION 404 Not Found'}} : {ok:true,value:{application:'applied',version:'4.3.2'}};
   },
  };
  const context = {updateConfirm:true,PLUGIN_VERSION:'4.3.1',updateLatest:'4.3.2',availableVersions:['4.3.2'],PLUGIN_PACKAGE:'dsh-metaontic-video',UPDATE_ATTEMPTS:3,UPDATE_CACHE_KEY:'test',manager:()=>({manager}),isNewerVersion:()=>true,verifyRuntime:async()=>true,setUpdateConfirm(){},setUpdateLatest(){},setUpdateStatus:v=>state.status=v,setUpdateMessage:v=>state.message=v,setUpdateAt(){},t:key=>key};
  await sandbox.createUpdateActions(context).runOnlineUpdate();
  assert.equal(calls.length,1);
  assert.equal(calls[0].spec,'dsh-metaontic-video@4.3.2');
  assert.equal(calls[0].options.enabled,true);
  assert.equal(state.status,failed?'failed':'applied');
 }
});

test('updates use fixed latest assets with a version-specific cache key on both mirrors', () => {
  const sandbox = vm.createContext({});
  vm.runInContext(sourceOf('shared/constants/plugin'), sandbox);
  assert.equal(vm.runInContext("releaseDownloadUrl('4.0.8')", sandbox), 'https://gitee.com/hackloop/metaontic-video/releases/download/latest/metaontic-video.tgz?version=4.0.8');
  assert.equal(vm.runInContext("releaseDownloadUrl('4.0.8','github')", sandbox), 'https://github.com/wxsimon2022/metaontic-video/releases/latest/download/metaontic-video.tgz?version=4.0.8');
});

test('cached latest asset with a different installed version is not reported as success', async () => {
  const state = {};
  const sandbox = vm.createContext({window:{localStorage:{removeItem(){}}}});
  vm.runInContext(sourceOf('ui/updates/update.service'), sandbox);
  const manager = {listBundles:async()=>[{name:'metaontic-video',installed:true,source:'https://example.com/pkg.tgz'}],
    installBundle:async()=>({ok:true,value:{application:'applied',version:'4.0.6'}})};
  const context = {updateConfirm:true,PLUGIN_VERSION:'4.0.6',updateLatest:'4.0.7',availableVersions:['4.0.7'],
    PLUGIN_PACKAGE:'metaontic-video',UPDATE_ATTEMPTS:1,UPDATE_CACHE_KEY:'test',manager:()=>({manager}),isNewerVersion:()=>true,
    setUpdateConfirm(){},setUpdateLatest(){},setUpdateStatus:v=>{state.status=v},setUpdateMessage:v=>{state.message=v},setUpdateAt(){},t:key=>key};
  await sandbox.createUpdateActions(context).runOnlineUpdate();
  assert.equal(state.status, 'failed');
  assert.match(state.message, /4\.0\.6.*4\.0\.7.*不一致/);
});

test('host applied without live activation proof stays pending; verified runtime permits success',async()=>{
 for(const verified of [false,true]){
  const state={};const sandbox=vm.createContext({window:{localStorage:{removeItem(){}}}});
  vm.runInContext(sourceOf('ui/updates/update.service'),sandbox);
  const manager={listBundles:async()=>[{name:'metaontic-video',installed:true,source:'https://example.com/pkg.tgz'}],installBundle:async()=>({ok:true,value:{application:'applied',version:'4.2.6'}})};
  await sandbox.createUpdateActions({updateConfirm:true,PLUGIN_VERSION:'4.2.5',updateLatest:'4.2.6',PLUGIN_PACKAGE:'metaontic-video',UPDATE_ATTEMPTS:1,UPDATE_CACHE_KEY:'test',manager:()=>({manager}),isNewerVersion:()=>true,verifyRuntime:async()=>verified,setUpdateConfirm(){},setUpdateLatest(){},setUpdateStatus:value=>state.status=value,setUpdateMessage:value=>state.message=value,t:key=>key}).runOnlineUpdate();
  assert.equal(state.status,verified?'applied':'pending');assert.equal(state.message,verified?'versionUpdateDone':'versionUpdatePending');
 }
});
