import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {api} from './module-test-api.mjs';

test('创作项目自动建图、恢复审核材料、自动回填且不改变审核参数；保护用户编辑',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'自动画布 中文 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'auto-canvas',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';await api.writeProject(project);
  let creates=0,doc={name:'自动创作',nodes:{},edges:[]};
  const adapter={rpc:{
   canvasCreateProject:async()=>{creates++;return {ok:true,projectId:'auto'};},
   projectsGet:async()=>structuredClone(doc),
   projectsPut:async({doc:next})=>{doc=structuredClone(next);return {ok:true};},
   dataRootGet:async()=>({dataRoot:root}),assetsGet:async()=>({items:[]}),
   projectDirGet:async()=>({ok:true,abs:path.join(root,'projects','auto'),dataRoot:root}),
   assetCreate:async()=>({ok:true}),canvasOpen:async()=>({ok:true}),
  }};
  const sync=api.createCanvasProjectSync(async()=>adapter);
  const wrapped=sync.wrapProject({execute:async()=>({projectId:project.id,status:'prepared'})});
  assert.equal((await wrapped.execute({action:'prepare'},exec)).canvasProject.status,'synced');
  const spec={prompt:'日出到黄昏',segmentPrompts:['日出','黄昏'],duration:30,ratio:'9:16',resolution:'720p'};
  const scriptPath=path.join(root,'剧本.md');await writeFile(scriptPath,'# 完整剧本\n| 镜头 | 时间 | 画面 | 声音 |\n| --- | --- | --- | --- |\n| 镜头1 | 0–7秒 | 日出 | 海浪 |\n| 镜头2 | 7–15秒 | 船 | 风声 |\n| 镜头3 | 15–22秒 | 沙滩 | 脚步 |\n| 镜头4 | 22–30秒 | 黄昏 | 海浪 |');
  const saved=await api.readProject(project.id,exec);saved.approved={scriptPath,specification:spec};await api.writeProject(saved);
  await sync.sync(project.id,exec);
  assert.equal(creates,1);assert.equal(Object.values(doc.nodes).filter(n=>n.type==='storyboard').length,1);
  assert.equal(Object.values(doc.nodes).find(n=>n.type==='storyboard').data.shots.length,4);
  await sync.sync(project.id,exec);assert.equal(creates,1);
  assert.equal(doc.edges.length,2);
  for(const edge of doc.edges){
   const target=doc.nodes[edge.toNode];
   assert.ok((target.type==='storyboard'&&edge.toPort==='script')||(target.type==='video'&&edge.toPort==='prompt'));
   assert.equal(edge.fromPort,'out');
  }
  const file=path.join(root,'成片.mp4');await writeFile(file,'mock');
  let calls=0;const bridge=api.createCanvasBridge(async()=>adapter);
  const tool=bridge.wrap({name:'video_generate',parameters:{properties:{}},execute:async(args)=>{
   calls++;assert.equal(args.canvas,undefined);return {status:'succeeded',videoPath:file};
  }});
  const args={...spec,projectId:project.id};
  const result=await tool.execute(args,exec);
  assert.equal(result.canvasSync.status,'synced');assert.equal(calls,1);assert.equal(args.canvas,undefined);
  const source=Object.values(doc.nodes).find(n=>n.type==='video'&&n.data.metaonticAssistantManaged);
  source.data.prompt='用户新稿';
  await assert.rejects(tool.execute(args,exec),/重新读取并审核/);assert.equal(calls,1);
  await assert.rejects(sync.sync(project.id,exec),/保留你的编辑/);
  assert.equal(source.data.prompt,'用户新稿');
  await assert.rejects(sync.sync(project.id,{agent:{session:{id:'other'}}}),/不属于当前会话/);
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(root,{recursive:true,force:true});}
});

test('真实分镜独立于制作段，保留时间、镜头、声音和对白，不解析代码示例',()=>{
 const shots=api.scriptStoryboardShots('```\n| 镜头 | 画面 |\n| --- | --- |\n| 假镜头 | 不同步 |\n```\n| 镜头 | 时间 | 景别及运镜 | 画面 | 台词 | 声音 |\n| --- | --- | --- | --- | --- | --- |\n| 一 | 0—7秒 | 远景推进 | 日出\\|船影 | 你好 | 海浪 |\n| 二 | 7秒至15秒 | 近景 | 水面 | 无 | 风声 |');
 assert.equal(shots.length,2);assert.equal(shots[0].duration,7);assert.equal(shots[1].duration,8);
 assert.ok(shots[0].visual.includes('日出|船影'));assert.equal(shots[0].camera,'远景推进');assert.equal(shots[0].sfx,'海浪');
 assert.deepEqual(api.scriptStoryboardShots('只有完整剧本，没有表格'),[]);
});

test('review在用户答复前同步已验证草稿，取消审核保留画布及草稿绑定',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'审核前画布 ')),old=process.env.DSH_HOME;process.env.DSH_HOME=root;
 try{
  const exec={agent:{session:{id:'pre-review',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';await api.writeProject(project);
  const scriptPath=path.join(root,'剧本.md');await writeFile(scriptPath,'# 正文\n| 镜头 | 时间 | 画面 |\n| --- | --- | --- |\n| 一 | 0–30秒 | 海边 |');
  const spec={prompt:'海边',segmentPrompts:['清晨','黄昏'],duration:30,ratio:'9:16',resolution:'720p'};
  let doc={nodes:{},edges:[]},askCalled=false,answer;
  const adapter={rpc:{canvasCreateProject:async()=>({ok:true,projectId:'pre'}),projectsGet:async()=>structuredClone(doc),projectsPut:async({doc:next})=>{doc=next;return {ok:true};},dataRootGet:async()=>({dataRoot:root})}};
  const sync=api.createCanvasProjectSync(async()=>adapter);
  const ctx={get:n=>n==='userQuestions'?{ask:async()=>{
   askCalled=true;assert.ok(Object.values(doc.nodes).some(n=>n.type==='storyboard'&&n.data.shots.length===1));
   return new Promise(r=>answer=r);
  }}:null};
  const properties=Object.fromEntries(Object.keys(spec).map(k=>[k,{}]));
  const tool=api.projectTool({},ctx,{gate:async()=>null},properties,properties,null,sync.sync);
  const running=tool.execute({action:'review',projectId:project.id,scriptPath,specification:spec},exec);
  while(!askCalled) await new Promise(r=>setTimeout(r,5));
  assert.equal(Object.values(doc.nodes).filter(n=>n.type==='video').length,1);
  const during=await api.readProject(project.id,exec);assert.ok(during.canvasAuto.projectId);assert.equal(during.approved,null);
  answer({answers:[]});const result=await running;assert.equal(result.status,'draft');assert.equal(result.canvasProject.status,'synced');
  const saved=await api.readProject(project.id,exec);assert.ok(saved.canvasAuto.canvas);assert.deepEqual(saved.canvasDraft.specification,spec);assert.equal(saved.approved,null);
  await sync.sync(project.id,exec);assert.ok(Object.values(doc.nodes).some(n=>n.type==='storyboard'&&n.data.shots.length===1));
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(root,{recursive:true,force:true});}
});

test('画布展示去除脚本元数据与Markdown外观，保留实际内容',()=>{
 const source='---\n状态: 草稿\n---\n# 完整剧本\n**清晨**\n| 镜头 | 画面 |\n| --- | --- |\n| 一 | 草原 |';
 const preview=api.canvasScriptPreview(source);
 assert.ok(!preview.includes('状态:'));
 assert.ok(!preview.includes('---'));
 assert.ok(preview.includes('完整剧本\n清晨'));
 assert.ok(preview.includes('一 · 草原'));
 assert.equal(api.scriptStoryboardShots(source).length,1);
});
