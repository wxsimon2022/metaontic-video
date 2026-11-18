import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createPreviewHost } from '../preview/host.mjs';

const legacy = {name:'metaontic-video',installed:true,enabled:true};
const current = {name:'dsh-metaontic-video',installed:true,enabled:true};
function setup({rows=[legacy,current], reject=false, restart=false, wrapper=false, unavailable=false}={}) {
  rows=rows.map(row=>({...row}));
  let entry, consent;const actions={};const calls=[];const components={},dictionaries={},cleanups=[];
  vm.runInNewContext(readFileSync(new URL('../client.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load(x){entry=x;}}}});
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
 assert.match(state.render(),/切换未完成/);assert.equal(state.rows[0].enabled,true);
 assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
});

test('only an explicit host restart-required result requests restart and does not mount duplicate UI',async()=>{
 const state=setup({restart:true});await state.plugin.apply(state.host);state.render();await state.click();
 assert.match(state.render(),/宿主要求重启/);assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
});

test('unavailable inventory remains visible and cannot silently mount duplicate UI',async()=>{
 const state=setup({unavailable:true});await state.plugin.apply(state.host);
 assert.match(state.render(),/无法核实插件安装状态/);assert.deepEqual(state.calls,[]);
 assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
});


test('a success response alone cannot pass migration while the old bundle is still enabled',async()=>{
 const state=setup();state.manager.setBundleEnabled=async()=>({ok:true,value:{application:'applied'}});
 await state.plugin.apply(state.host);state.render();await state.click();
 assert.match(state.render(),/切换未完成/);assert.equal(state.components['sidebar.panellist:metaontic-video'],undefined);
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
