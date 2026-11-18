import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPreviewHost } from '../preview/host.mjs';

const legacy = {name:'metaontic-video',installed:true,enabled:true};
const current = {name:'dsh-metaontic-video',installed:true,enabled:true};
function setup({rows=[legacy,current], reject=false, restart=false, wrapper=false, unavailable=false, queryTimeoutMs=8000}={}) {
  rows=rows.map(row=>({...row}));
  let entry, consent;const actions={};const calls=[];const components={},dictionaries={},cleanups=[];
  vm.runInNewContext(readFileSync(new URL('../client.js',import.meta.url),'utf8'),{AbortController,setTimeout:(fn,delay,...args)=>setTimeout(fn,delay===8000?queryTimeoutMs:delay,...args),clearTimeout,window:{__ModuleLoader__:{load(x){entry=x;}}}});
  const react={...React,createElement(type,props,...children){if(type==='button' && props?.['data-migration-action'])actions[props['data-migration-action']]=props.onClick;if(type==='input' && props?.['data-migration-consent'])consent=props.onChange;return React.createElement(type,props,...children);}};
  const plugin=entry.factory(name=>{assert.equal(name,'react');return react;});
  const host=createPreviewHost({form:{getSnapshot:()=>({status:'ready',value:{connectionMode:'metaontic'},writable:true}),subscribe:()=>()=>{}},components,dictionaries,getLocale:()=> 'zh',onUpdate(){}});
  const manager={
    async listBundles(){if(unavailable)throw Error('unavailable');return wrapper?{ok:true,value:rows}:rows;},
    async setBundleEnabled(name,enabled){calls.push([name,enabled]);if(reject)return {ok:false,error:{message:'rejected'}};rows.find(row=>row.name===name).enabled=enabled;return {ok:true,value:{application:restart?'restart-required':'applied'}};},
    async removeBundle(name){calls.push(['remove',name]);const row=rows.find(row=>row.name===name);assert.equal(row.enabled,false);row.installed=false;return {ok:true,value:{application:'applied'}};},
    installBundle(){assert.fail('must not reinstall');},
  };
  const get=host.get.bind(host);host.get=name=>name==='remote.pluginManager'?manager:get(name);
  const effect=host.effect;host.effect=fn=>{const off=effect(fn);if(typeof off==='function')cleanups.push(off);return off;};
  return {host,plugin,manager,calls,components,rows,cleanups,render(){const Page=components['plugins.bundle.config:dsh-metaontic-video'];assert.equal(typeof Page,'function');return renderToStaticMarkup(React.createElement(Page));},click:(kind='switch')=>actions[kind](),confirm:()=>consent({target:{checked:true}})};
}

test('both installed packages show migration settings before shared UI registration; one switch preserves the old dependency',async()=>{
 const state=setup({wrapper:true});await state.plugin.apply(state.host);
 assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined,'do not collide with the running legacy sidebar');
 assert.match(state.render(),/同时启用/g);
 assert.match(state.render(),/仅停用旧版并切换/);
 const first=state.click(),second=state.click();assert.equal(first,second,'double click shares one operation');await first;
 assert.deepEqual(state.calls,[['metaontic-video',false]]);
 assert.equal(state.rows[0].installed,true);assert.equal(state.rows[0].enabled,false);
 assert.equal(typeof state.components['sidebar.panellist:metaontic-video'],'function');
 assert.doesNotMatch(state.render(),/同时启用/g,'normal settings restored after verified deactivation');
 assert.match(state.render(),/API/);
});

test('old installed but disabled is not a conflict; fresh installs mount normal settings',async()=>{
 for(const rows of [[current],[{...legacy,enabled:false},current]]){
  const state=setup({rows});await state.plugin.apply(state.host);
  assert.equal(typeof state.components['sidebar.panellist:metaontic-video'],'function');
  assert.match(state.render(),/API/);assert.deepEqual(state.calls,[]);
 }
});

test('rejected migration keeps a visible settings page, preserves conflict and permits retry',async()=>{
 const state=setup({reject:true});await state.plugin.apply(state.host);state.render();await state.click();
 assert.match(state.render(),/迁移未完成/);assert.equal(state.rows[0].enabled,true);
 assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
});

test('only an explicit host restart-required result requests restart and does not mount duplicate UI',async()=>{
 const state=setup({restart:true});await state.plugin.apply(state.host);state.render();await state.click();
 assert.match(state.render(),/宿主要求重启/);assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
});

test('unavailable inventory remains visible and cannot silently mount duplicate UI',async()=>{
 const state=setup({unavailable:true});await state.plugin.apply(state.host);
 assert.match(state.render(),/无法核实安装状态/);assert.deepEqual(state.calls,[]);
 assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
});


test('a success response alone cannot pass migration while the old bundle is still enabled',async()=>{
 const state=setup();state.manager.setBundleEnabled=async()=>({ok:true,value:{application:'applied'}});
 await state.plugin.apply(state.host);state.render();await state.click();
 assert.match(state.render(),/迁移未完成/);assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
});

test('disposing while inventory is pending never registers late settings or shared components',async()=>{
 const state=setup();let complete;state.manager.listBundles=()=>new Promise(resolve=>{complete=resolve;});
 const pending=state.plugin.apply(state.host);assert.match(state.render(),/正在检查/);
 for(const off of state.cleanups.toReversed())off();complete([current]);await pending;
 assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
 assert.equal(state.components['plugins.bundle.config:dsh-metaontic-video'],undefined);
});

test('Host waits for the legacy bundle to stop before registering tools, and disposes the new tools',async()=>{
 const {api}=await import('./module-test-api.mjs');
 let enabled=true,mounts=0,disposals=0;
 const dispose=api.mountBundleAwareHost({get:()=>({listBundles:async()=>[{...legacy,enabled},current]})},()=>{mounts++;assert.equal(enabled,false,'must not register a duplicate tool set');return()=>disposals++;});
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(mounts,0);
 enabled=false;
 for(let attempt=0;attempt<40 && !mounts;attempt++)await new Promise(resolve=>setTimeout(resolve,50));
 assert.equal(mounts,1);dispose();assert.equal(disposals,1);
});

test('Host disposal during inventory loading prevents a late tool registration',async()=>{
 const {api}=await import('./module-test-api.mjs');let complete;
 const dispose=api.mountBundleAwareHost({get:()=>({listBundles:()=>new Promise(resolve=>{complete=resolve;})})},()=>assert.fail('late mount'));
 dispose();complete([current]);await new Promise(resolve=>setTimeout(resolve,0));
});


test('cleanup requires task-finished consent and removes only the disabled old package',async()=>{
 const state=setup();await state.plugin.apply(state.host);state.render();
 await state.click('cleanup');assert.deepEqual(state.calls,[]);
 state.confirm();state.render();const first=state.click('cleanup'),second=state.click('cleanup');assert.equal(first,second);await first;
 assert.deepEqual(state.calls,[['metaontic-video',false],['remove','metaontic-video']]);
 assert.equal(state.rows[0].installed,false);assert.equal(state.rows[1].installed,true);assert.equal(state.rows[1].enabled,true);
 assert.match(state.render(),/API/);assert.doesNotMatch(state.render(),/data-metaontic-migration/);
});

test('an already disabled old package remains discoverable for cleanup alongside normal settings',async()=>{
 const state=setup({rows:[{...legacy,enabled:false},current]});await state.plugin.apply(state.host);
 assert.match(state.render(),/旧包仍在已安装列表/);assert.match(state.render(),/API/);
 state.confirm();await state.click('cleanup');assert.deepEqual(state.calls,[['remove','metaontic-video']]);assert.equal(state.rows[0].installed,false);
});

test('uninstall failure retains normal settings and provides cleanup retry',async()=>{
 const state=setup();state.manager.removeBundle=async()=>({ok:false,error:{code:'failure'}});
 await state.plugin.apply(state.host);state.render();state.confirm();await state.click('cleanup');
 assert.match(state.render(),/旧包清理尚未完成/);assert.match(state.render(),/API/);assert.equal(state.rows[0].enabled,false);assert.equal(state.rows[0].installed,true);
 state.manager.removeBundle=async()=>{state.rows[0].installed=false;return {ok:true,value:{application:'applied'}};};
 await state.click('cleanup');assert.doesNotMatch(state.render(),/data-metaontic-migration/);
});

test('Host stop-profile refusal explains manual removal while keeping new settings usable',async()=>{
 const state=setup();state.manager.removeBundle=async()=>({ok:true,value:{error:{code:'stop-profile'}}});
 await state.plugin.apply(state.host);state.render();state.confirm();await state.click('cleanup');
 assert.match(state.render(),/先退出当前运行环境才能卸载/);assert.match(state.render(),/API/);assert.equal(state.rows[0].enabled,false);
});

test('missing uninstall capability does not block use of the new plugin or claim removal',async()=>{
 const state=setup();delete state.manager.removeBundle;
 await state.plugin.apply(state.host);state.render();state.confirm();await state.click('cleanup');
 assert.match(state.render(),/当前宿主不支持/);assert.match(state.render(),/API/);assert.equal(state.rows[0].installed,true);
});

test('successful uninstall response is verified against actual inventory',async()=>{
 const state=setup();state.manager.removeBundle=async()=>({ok:true,value:{application:'applied'}});
 await state.plugin.apply(state.host);state.render();state.confirm();await state.click('cleanup');
 assert.match(state.render(),/旧包清理尚未完成/);assert.match(state.render(),/API/);
});

test('disposing during old bundle deactivation never starts uninstall',async()=>{
 const state=setup();let finish;
 state.manager.setBundleEnabled=()=>new Promise(resolve=>{finish=resolve;});
 await state.plugin.apply(state.host);state.render();state.confirm();const pending=state.click('cleanup');
 await new Promise(resolve=>setTimeout(resolve,0));for(const off of state.cleanups.toReversed())off();
 state.rows[0].enabled=false;finish({ok:true,value:{application:'applied'}});await pending;
 assert.equal(state.rows[0].installed,true);assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
});

test('remote property fallback is used even if full-name lookup throws',async()=>{
 const state=setup({rows:[current]});const get=state.host.get.bind(state.host);
 state.host.remote={pluginManager:state.manager};state.host.get=name=>{if(name==='remote.pluginManager')throw Error('unsupported');return get(name);};
 await state.plugin.apply(state.host);assert.match(state.render(),/API/);
});


test('disposing during the cleanup inventory query prevents the subsequent uninstall',async()=>{
 const state=setup({rows:[{...legacy,enabled:false},current]});
 await state.plugin.apply(state.host);state.render();state.confirm();
 let finish,calls=0;const original=state.manager.listBundles;
 state.manager.listBundles=async()=>++calls===2?new Promise(resolve=>{finish=resolve;}):original();
 const pending=state.click('cleanup');
 while(!finish)await new Promise(resolve=>setTimeout(resolve,0));
 for(const off of state.cleanups.toReversed())off();finish(state.rows);await pending;
 assert.deepEqual(state.calls,[]);assert.equal(state.rows[0].installed,true);
});

test('disposing during the pre-disable inventory query prevents any mutation',async()=>{
 const state=setup();await state.plugin.apply(state.host);state.render();state.confirm();let finish;
 state.manager.listBundles=()=>new Promise(resolve=>{finish=resolve;});
 const pending=state.click('cleanup');for(const off of state.cleanups.toReversed())off();finish(state.rows);await pending;
 assert.deepEqual(state.calls,[]);assert.equal(state.rows[0].enabled,true);
});

test('client inventory timeout exposes retry and ignores late results',async()=>{
 const state=setup({queryTimeoutMs:15});let finish;
 state.manager.listBundles=()=>new Promise(resolve=>{finish=resolve;});
 await state.plugin.apply(state.host);assert.match(state.render(),/查询超时/);assert.match(state.render(),/重新检查/);
 finish([current]);await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
 state.manager.listBundles=async()=>[current];await state.click('check');assert.match(state.render(),/API/);
 assert.deepEqual(state.calls,[]);
});

test('concurrent client rechecks share one inventory request',async()=>{
 const state=setup({unavailable:true});await state.plugin.apply(state.host);state.render();let finish,count=0;
 state.manager.listBundles=()=>{count++;return new Promise(resolve=>{finish=resolve;});};
 const a=state.click('check'),b=state.click('check');assert.equal(a,b);assert.equal(count,1);
 finish([current]);await a;assert.match(state.render(),/API/);
});

test('cleanup query timeout cannot trigger a late uninstall',async()=>{
 const state=setup({rows:[{...legacy,enabled:false},current],queryTimeoutMs:15});
 await state.plugin.apply(state.host);state.render();state.confirm();let finish,count=0;
 state.manager.listBundles=async()=>++count===2?new Promise(resolve=>{finish=resolve;}):state.rows;
 await state.click('cleanup');assert.match(state.render(),/查询超时/);assert.match(state.render(),/API/);
 finish(state.rows);await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(state.calls,[]);
});

test('inventory cancellation and timeout release timers and reject late results',async()=>{
 const {api}=await import('./module-test-api.mjs');
 let finish;const controller=new AbortController();
 const pending=api.readBundleInventory({listBundles:()=>new Promise(resolve=>{finish=resolve;})},{signal:controller.signal,timeoutMs:1000});
 controller.abort();await assert.rejects(pending,e=>e.code==='aborted');finish([current]);
 await assert.rejects(api.readBundleInventory({listBundles:()=>new Promise(()=>{})},{timeoutMs:5}),e=>e.code==='timeout');
});

test('Host query timeouts back off, report fixed diagnostics once and recover',async(t)=>{
 const {api}=await import('./module-test-api.mjs');const original=setTimeout,delays=[],warnings=[],infos=[];
 t.mock.method(globalThis,'setTimeout',(fn,delay,...args)=>{delays.push(delay);return original(fn,delay,...args);});
 let available=false,mounts=0;
 const off=api.mountBundleAwareHost({get:()=>({listBundles:()=>available?Promise.resolve([current]):new Promise(()=>{})}),logger:{warn:x=>warnings.push(x),info:x=>infos.push(x)}},()=>{mounts++;return()=>{};},{timeoutMs:5,retryMs:7,maxRetryMs:28});
 t.after(off);
 await new Promise(resolve=>original(resolve,80));
 assert.equal(mounts,0);assert.equal(warnings.length,1);assert.match(warnings[0],/超时/);
 assert.ok(delays.includes(7)&&delays.includes(14)&&delays.includes(28),'bounded exponential backoff');
 available=true;await new Promise(resolve=>original(resolve,60));assert.equal(mounts,1);assert.equal(infos.length,1);
});
