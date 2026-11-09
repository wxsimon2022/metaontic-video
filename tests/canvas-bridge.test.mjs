import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { api } from './module-test-api.mjs';
const temp = await mkdtemp(path.join(os.tmpdir(), '画布 联动 '));
after(() => rm(temp, {recursive:true,force:true}));
const exec = {agent:{session:{id:'canvas-test'}}};
function fixture() {
 let doc = { name:'test',nodes:{s:{id:'s',type:'script',x:0,y:0,data:{output:'已写剧本'}},v:{id:'v',type:'video',x:400,y:0,data:{prompt:'海边日出',ratio:'9:16',duration:30}}},edges:[{id:'e',fromNode:'s',fromPort:'out',toNode:'v',toPort:'prompt'}]};
 const assets=new Map();let puts=0,connects=0;
 const rpc={
  projectsGet:async()=>structuredClone(doc),
  projectsList:async()=>[{id:'p',name:'test'}],
  dataRootGet:async()=>({dataRoot:temp}),
  projectDirGet:async()=>({ok:true,abs:path.join(temp,'projects','test'),dataRoot:temp}),
  assetsGet:async({ids})=>({items:ids.map(id=>assets.get(id)).filter(Boolean)}),
  assetCreate:async({asset})=>{assets.set(asset.id,asset);return {ok:true};},
  projectsPut:async({doc:next})=>{puts++;doc=structuredClone(next);return {ok:true};},
 };
 return {adapter:{rpc,connect:async()=>{connects++;return {ok:true,already:true};},assetPath:(_,a)=>a.path},assets,doc:()=>doc,puts:()=>puts,connects:()=>connects, change:fn=>fn(doc)};
}
test('读取上游文本及边，返回摘要，不读供应商配置或执行画布生成',async()=>{
 const f=fixture();f.change(d=>d.settings={apiKey:'not-to-project'});
 const read=await api.readCanvasInput(f.adapter,{projectId:'p',nodeId:'v'});
 assert.equal(read.nodes.length,2);assert.equal(read.edges[0].toPort,'prompt');
 assert.equal(read.nodes.find(n=>n.id==='s').output,'已写剧本');
 assert.ok(read.canvas.fingerprint);assert.ok(!JSON.stringify(read).includes('not-to-project'));
 assert.equal(f.puts(),0);
});
test('编辑节点后摘要变化，生成入口拒绝陈旧审核且不调用底层工具',async()=>{
 const f=fixture(),bridge=api.createCanvasBridge(async()=>f.adapter);
 const read=await bridge.tool.execute({action:'read',projectId:'p',nodeId:'v'},exec);
 f.change(d=>d.nodes.v.data.prompt='新稿');let calls=0;
 const tool=bridge.wrap({name:'video_generate',parameters:{properties:{}},execute:async()=>{calls++;}});
 await assert.rejects(tool.execute({canvas:read.canvas},exec),/重新读取并审核/);
 assert.equal(calls,0);assert.equal(f.puts(),0);
});
test('读取素材保留连线端口和顺序，素材缺失停止',async()=>{
 const f=fixture(),image=path.join(temp,'参考图.png');await writeFile(image,'image');
 f.assets.set('a',{id:'a',kind:'image',rel:'image/a.png',path:image});
 f.change(d=>{d.nodes.i={id:'i',type:'image',data:{assetId:'a'}};d.edges.unshift({id:'r',fromNode:'i',fromPort:'out',toNode:'v',toPort:'frame'});});
 const read=await api.readCanvasInput(f.adapter,{projectId:'p',nodeId:'v'});
 assert.equal(read.references[0].path,image);assert.equal(read.edges[0].toPort,'frame');
 f.assets.clear();await assert.rejects(api.readCanvasInput(f.adapter,{projectId:'p',nodeId:'v'}),/未落盘/);
});
test('回填新增实际视频节点，重复补传不重复节点，不覆盖源稿',async()=>{
 const f=fixture(),file=path.join(temp,'第一段.mp4');await writeFile(file,'mock-mp4');
 const record={id:'test-result',canvas:{projectId:'p',nodeId:'v'},createdAt:1,phase:'segment_review',ratio:'9:16',media:[{kind:'video',label:'第1段',localPath:file}]};
 await api.publishCanvasResult(f.adapter,record);await api.publishCanvasResult(f.adapter,record);
 assert.equal(Object.keys(f.doc().nodes).length,3);assert.equal(f.doc().nodes.v.data.prompt,'海边日出');
 const added=Object.values(f.doc().nodes).find(n=>n.id.startsWith('mov_'));
 assert.equal(added.data.metaonticPhase,'segment_review');assert.equal(added.data.ratio,'9:16');
 assert.ok(f.connects()>=1); // projectsPut 无「文档已变更」信号 → 回填后必须补一次幂等连线确认
 assert.equal(f.assets.size,1);const a=[...f.assets.values()][0];
 assert.equal(await readFile(path.join(temp,'projects','test','video',`${a.id}.mp4`),'utf8'),'mock-mp4');
});
test('删除源节点后停止回填，不复活节点',async()=>{
 const f=fixture();f.change(d=>delete d.nodes.v);
 await assert.rejects(api.publishCanvasResult(f.adapter,{canvas:{projectId:'p',nodeId:'v'},media:[]}),/已删除/);
 assert.equal(f.puts(),0);
});
test('无成功素材不虚构回填；未绑定调用不加载画布',async()=>{
 let loads=0;const bridge=api.createCanvasBridge(async()=>{loads++;throw Error('not-installed');});
 const tool=bridge.wrap({name:'video_generate',parameters:{properties:{}},execute:async()=>({status:'failed'})});
 assert.deepEqual(await tool.execute({},exec),{status:'failed'});assert.equal(loads,0);
});

test('回填异常保留真实生成结果，补传只回填且拒绝跨会话',async()=>{
 const previous=process.env.DSH_HOME;process.env.DSH_HOME=path.join(temp,'home');
 try {
  const f=fixture();let loads=0,calls=0,failSync=true;
  const bridge=api.createCanvasBridge(async()=>{loads++;if(loads>1&&failSync)throw Error('offline');return f.adapter;});
  const input=await api.readCanvasInput(f.adapter,{projectId:'p',nodeId:'v'});
  const localPath=path.join(temp,'result.mp4');await writeFile(localPath,'video');
  const tool=bridge.wrap({name:'video_generate',parameters:{properties:{}},execute:async()=>{calls++;return {status:'succeeded',paused:true,segments:[{index:1,status:'succeeded',localPath}]};}});
  const result=await tool.execute({canvas:input.canvas},exec);
  assert.equal(result.status,'succeeded');assert.equal(result.paused,true);assert.equal(result.canvasSync.status,'pending');
  failSync=false;
  await assert.rejects(bridge.tool.execute({action:'sync',token:result.canvasSync.token},{agent:{session:{id:'other'}}}),/不属于/);
  const synced=await bridge.tool.execute({action:'sync',token:result.canvasSync.token},exec);
  assert.equal(synced.status,'synced');assert.equal(calls,1);assert.equal(synced.phase,'segment_review');
 }finally {if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;}
});
