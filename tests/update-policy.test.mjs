import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { sourceOf } from './source.mjs';
import { build } from 'esbuild';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

function setup() {
  const api = vm.createContext({ AbortController, TextDecoder, atob, setTimeout, clearTimeout, fetch: async () => { throw Error('offline'); } });
  vm.runInContext(sourceOf('shared/updates/policy'), api);
  return api;
}
const policy = (minimum = '4.1.1', revision = 1) => ({ schema_version: 1, package_name: 'dsh-metaontic-video', revision, minimum_version: minimum });
const response = value => ({ ok: true, text: async () => JSON.stringify(value) });
const document = value => response({type:'file',encoding:'base64',content:Buffer.from(JSON.stringify(value)).toString('base64')});

test('minimum version uses numeric comparison, preserves supported releases and rejects invalid policy', () => {
  const api = setup();
  assert.equal(api.versionBelow('4.0.11', '4.1.0'), true);
  assert.equal(api.versionBelow('4.1.0', '4.1.0'), false);
  assert.equal(api.versionBelow('4.10.0', '4.9.0'), false);
  assert.equal(api.versionBelow('4.1.0-test.1', '4.1.0'), true);
  assert.equal(api.versionBelow('unknown', '4.1.0'), false);
  assert.equal(api.repositoryUpdatePolicy({type:'file',encoding:'base64',content:'invalid'}), null);
  assert.equal(api.repositoryUpdatePolicy({type:'dir',encoding:'base64',content:''}), null);
  for (const bad of [{...policy(), minimum_version:'4.2.0-beta'}, {...policy(), revision:0}, {...policy(), package_name:'other'}, {...policy(), minimum_version:'04.1.1'}]) assert.equal(api.parseUpdatePolicy(bad), null);
});

test('refresh coalesces requests and retains verified restriction through outages and restart', async () => {
  const api = setup();
  let calls = 0, offline = false, saved, clock = 1000;
  const request = async () => { calls++; if (offline) throw Error('offline'); return document(policy()); };
  const store = api.createUpdatePolicy({ version:'4.1.0', request, write:async value => { saved=value; }, now:()=>clock, intervalMs:100, verify:async()=>true });
  await Promise.all([store.refresh(),store.refresh(),store.refresh()]);
  assert.equal(calls,2);
  assert.equal(store.snapshot().required,true);
  await store.refresh(); assert.equal(calls,2);
  offline=true; clock+=101;
  await store.refresh(); assert.equal(store.snapshot().required,true);
  const restarted = api.createUpdatePolicy({version:'4.1.0',request,read:async()=>saved});
  await restarted.refresh(); assert.equal(restarted.snapshot().required,true);
  const firstOffline = api.createUpdatePolicy({version:'4.1.0',request});
  await firstOffline.refresh(); assert.equal(firstOffline.snapshot().required,false);
});

test('unpublished versions cannot lock clients; lower revision cannot replace cached policy; explicit rollback can', async () => {
  const api = setup();
  let next = policy('4.1.1',2), published = false;
  const store = api.createUpdatePolicy({version:'4.1.0',request:async()=>document(next),verify:async()=>published});
  await store.refresh(); assert.equal(store.snapshot().required,false);
  published=true; await store.refresh(true); assert.equal(store.snapshot().required,true);
  next=policy('4.1.0',1); await store.refresh(true); assert.equal(store.snapshot().required,true);
  next=policy('4.1.0',3); await store.refresh(true); assert.equal(store.snapshot().required,false);
});

test('conflicting mirror policies are rejected and failed cache writes never bypass a restriction', async () => {
  const api=setup();
  const conflict=api.createUpdatePolicy({version:'4.1.0',request:async url=>document(policy(url.includes('gitee')?'4.1.1':'4.1.2')),verify:async()=>true});
  await conflict.refresh(); assert.equal(conflict.snapshot().required,false);
  const full=api.createUpdatePolicy({version:'4.1.0',request:async()=>document(policy()),write:async()=>{throw Error('disk full');},verify:async()=>true});
  await full.refresh(); assert.equal(full.snapshot().required,true);
});

test('published-version verification rejects drafts, wrong packages and missing archives', async () => {
  const api=setup();
  assert.equal(await api.publishedPolicyVersion('4.1.1',async()=>response({tag_name:'v4.1.1',prerelease:false,assets:[]})),false);
  assert.equal(await api.publishedPolicyVersion('4.1.1',async()=>response({name:'other',version:'4.1.1',dsh:{bundle:{patch:'index.js'}}})),false);
  assert.equal(await api.publishedPolicyVersion('4.1.1',async url=>response(url.includes('api.github.com')?{
    tag_name:'v4.1.1',draft:false,prerelease:false,assets:[{name:'metaontic-video-4.1.1.tgz',browser_download_url:'https://github.com/wxsimon2022/metaontic-video/releases/download/v4.1.1/metaontic-video-4.1.1.tgz'}]
  }:{})),true);
});

test('a nonresponsive request has a bounded wait even if it ignores abort', async () => {
  const api=setup();
  await assert.rejects(api.policyJson('https://example.invalid',()=>new Promise(()=>{}),10),/UPDATE_POLICY_TIMEOUT/);
});

test('paid continuation cannot bypass policy, existing tasks and local results remain accessible', () => {
  const api=setup();
  for (const [name,args] of [['video_generate',{resume:'/saved'}],['video_extend',{resume:'/saved'}],['video_prepare_image',{}],['film_project',{action:'independent_review'}],['film_project',{action:'create'}],['video_project',{action:'prepare'}]]) assert.equal(api.needsSupportedVersion(name,args),true);
  for (const [name,args] of [['video_status',{}],['video_prepare_image',{taskId:'original-task'}],['media_submission',{action:'reconcile'}],['video_project',{action:'review_segment'}],['film_project',{action:'task_result',taskStatus:'completed'}],['film_project',{action:'export'}],['film_project',{action:'read'}],['video_config',{}],['video_estimate',{}]]) assert.equal(api.needsSupportedVersion(name,args),false);
});

test('tool registry checks version before executing the underlying business', async () => {
  const api=vm.createContext({withUsageAnalytics:tool=>tool,withStageTiming:tool=>tool});
  vm.runInContext(sourceOf('platform/dsh/tool.adapter'),api);
  let registered, executed=false;
  const registry=api.createToolRegistry({tools:{register(tool){registered=tool;}}},{resolve:()=>null},null,()=>{},async()=>{throw Error('PLUGIN_UPDATE_REQUIRED');});
  registry.register('video',{name:'video_generate',execute:async()=>{executed=true;}});
  await assert.rejects(registered.execute({},{}),/PLUGIN_UPDATE_REQUIRED/);
  assert.equal(executed,false);
});

test('real host guard retains cached minimum on restart without blocking retrieval or modifying project data', async () => {
  const directory=await mkdtemp(path.join(os.tmpdir(),'最低版本 policy '));
  const oldHome=process.env.DSH_HOME, originalFetch=globalThis.fetch;
  try {
    await build({entryPoints:['src/platform/installation/update-policy.ts'],bundle:true,platform:'node',format:'esm',define:{__PLUGIN_VERSION__:JSON.stringify('4.1.0')},outfile:path.join(directory,'guard.mjs')});
    process.env.DSH_HOME=directory;
    const state=path.join(directory,'state','metaontic-video');
    await mkdir(state,{recursive:true});
    await writeFile(path.join(state,'update-policy.json'),JSON.stringify({policy:policy()}));
    const project=path.join(directory,'project.json');
    await writeFile(project,'{"taskId":"existing-task"}');
    let requests=0;
    globalThis.fetch=async()=>{requests++;throw Error('offline');};
    const {createVersionGuard}=await import(pathToFileURL(path.join(directory,'guard.mjs')));
    const guard=createVersionGuard();
    await guard('video_status',{taskId:'existing-task'});
    await guard('video_prepare_image',{taskId:'existing-image'});
    assert.equal(requests,0);
    await assert.rejects(guard('video_generate',{resume:state}),error=>error.code==='PLUGIN_UPDATE_REQUIRED'&&/4.1.1/.test(error.message));
    assert.equal(requests,2);
    await assert.rejects(guard('film_project',{action:'create'}),{code:'PLUGIN_UPDATE_REQUIRED'});
    assert.equal(requests,2,'后续调用共用检查结果');
    assert.equal(await readFile(project,'utf8'),'{"taskId":"existing-task"}');
  } finally {
    globalThis.fetch=originalFetch;
    if(oldHome===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=oldHome;
    await rm(directory,{recursive:true,force:true});
  }
});
