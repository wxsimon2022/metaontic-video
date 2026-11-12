import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {api} from './module-test-api.mjs';

test('创作项目自动建图、恢复审核材料、自动回填且不改变审核参数；保护用户编辑',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'自动画布 中文 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'auto-canvas',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';await api.writeProject(project);
  let creates=0,doc={name:'自动创作',nodes:{},edges:[]};const connects=[];
  const adapter={connect:async(args)=>{connects.push(args);return {ok:true,already:true};},rpc:{
   canvasCreateProject:async()=>{creates++;return {ok:true,projectId:'auto'};},
   projectsGet:async()=>structuredClone(doc),
   projectsPut:async({doc:next})=>{doc=structuredClone(next);return {ok:true};},
   dataRootGet:async()=>({dataRoot:root}),assetsGet:async()=>({items:[]}),
   projectDirGet:async()=>({ok:true,abs:path.join(root,'projects','auto'),dataRoot:root}),
   assetCreate:async()=>({ok:true}),canvasOpen:async()=>({ok:true}),
  }};
  const sync=api.createCanvasProjectSync(async()=>adapter,{autoCreateCanvas:true});
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
  // 宿主 projectsPut 不产生「文档已变更」信号（画布端只补节点、不补连线）→ 保存后必须补一次幂等连线确认。
  assert.ok(connects.length>=1);
  assert.deepEqual(connects[0],{projectId:'auto',fromNode:doc.edges[0].fromNode,fromPort:'out',toNode:doc.edges[0].toNode,toPort:doc.edges[0].toPort});
  for(const edge of doc.edges){
   const target=doc.nodes[edge.toNode];
   assert.ok((target.type==='storyboard'&&edge.toPort==='script')||(target.type==='video'&&edge.toPort==='prompt'));
   assert.equal(edge.fromPort,'out');
  }
  const file=path.join(root,'成片.mp4');await writeFile(file,'mock');
  let calls=0;const bridge=api.createCanvasBridge(async()=>adapter,{autoCreateCanvas:true});
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

test('画布项目名跟随会话标题，用户改过的画布名不被覆盖',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'自动画布 命名 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'auto-canvas-name',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';await api.writeProject(project);
  let doc={name:'',nodes:{},edges:[]},created='';const puts=[];
  const adapter={connect:async()=>({ok:true,already:true}),rpc:{
   canvasCreateProject:async(args)=>{created=args.name;doc={name:args.name,nodes:{},edges:[],defaultCanvasName:'默认画布'};return {ok:true,projectId:'pname'};},
   projectsGet:async()=>structuredClone(doc),
   projectsPut:async(args)=>{puts.push({name:args.name,canvas:args.defaultCanvasName,doc:Boolean(args.doc)});if(args.name)doc.name=args.name;if(args.defaultCanvasName)doc.defaultCanvasName=args.defaultCanvasName;if(args.doc)doc={...structuredClone(args.doc),name:doc.name,defaultCanvasName:doc.defaultCanvasName};return {ok:true};},
   dataRootGet:async()=>({dataRoot:root}),assetsGet:async()=>({items:[]}),
   projectDirGet:async()=>({ok:true,abs:path.join(root,'projects','pname'),dataRoot:root}),
   assetCreate:async()=>({ok:true}),canvasOpen:async()=>({ok:true}),
  }};
  let title='民勤蜜瓜独白短视频';
  const sync=api.createCanvasProjectSync(async()=>adapter,{autoCreateCanvas:true}, {get:()=>({title})});
  await sync.sync(project.id,exec);
  // 画布名与会话标题同源，不带创作项目 id；重试仍靠原版同名幂等复用。
  assert.equal(created,title);
  assert.ok(!created.includes(project.id));
  assert.equal(doc.name,title);
  // 画布端把项目名当本地字段，却把默认画布名当 Host 权威：两处都写，界面上才稳定显示会话名。
  assert.equal(doc.defaultCanvasName,title);
  assert.equal((await api.readProject(project.id,exec)).canvasAuto.appliedName,title);
  assert.equal((await api.readProject(project.id,exec)).canvasAuto.appliedCanvasName,title);
  const nodes=Object.keys(doc.nodes).length;
  // 会话改名：标题事件把画布名一起改过来，且不重写图。
  title='蜜瓜短视频';
  await sync.followTitle(exec.agent.session,{type:'session/title',data:{title}});
  assert.equal(doc.name,title);
  assert.equal(doc.defaultCanvasName,title);
  assert.equal(Object.keys(doc.nodes).length,nodes);
  assert.equal(puts.at(-1).doc,false);
  assert.equal((await api.readProject(project.id,exec)).canvasAuto.appliedName,title);
  // 用户手动改过的画布名：标题事件与同步都不覆盖。
  // 画布端把自己的项目名缓存推回来（这里直接改回来模拟）：同步不再跟着来回改，画布名照旧跟随标题。
  doc.name=`MetaOntic 创作画布`;
  await sync.sync(project.id,exec);
  assert.equal(doc.name,'MetaOntic 创作画布');
  assert.equal(doc.defaultCanvasName,title);
  doc.name='我的话布';doc.defaultCanvasName='我的第一集';
  await sync.followTitle(exec.agent.session,{type:'session/title',data:{title:'又一次改名'}});
  assert.equal(doc.name,'我的话布');
  assert.equal(doc.defaultCanvasName,'我的第一集');
  await sync.sync(project.id,exec);
  assert.equal(doc.name,'我的话布');
  assert.equal(doc.defaultCanvasName,'我的第一集');
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(root,{recursive:true,force:true});}
});

test('首轮还没有会话标题时先建画布，标题落定后补名；非标题事件与其他会话不动',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'自动画布 补名 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'auto-canvas-late',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';await api.writeProject(project);
  let doc={name:'',nodes:{},edges:[]};
  const adapter={connect:async()=>({ok:true,already:true}),rpc:{
   canvasCreateProject:async(args)=>{doc={name:args.name,nodes:{},edges:[],defaultCanvasName:'默认画布'};return {ok:true,projectId:'plate'};},
   projectsGet:async()=>structuredClone(doc),
   projectsPut:async(args)=>{if(args.name)doc.name=args.name;if(args.defaultCanvasName)doc.defaultCanvasName=args.defaultCanvasName;if(args.doc)doc={...structuredClone(args.doc),name:doc.name,defaultCanvasName:doc.defaultCanvasName};return {ok:true};},
   dataRootGet:async()=>({dataRoot:root}),assetsGet:async()=>({items:[]}),
   projectDirGet:async()=>({ok:true,abs:path.join(root,'projects','plate'),dataRoot:root}),
   assetCreate:async()=>({ok:true}),canvasOpen:async()=>({ok:true}),
  }};
  const sync=api.createCanvasProjectSync(async()=>adapter,{autoCreateCanvas:true}, {get:()=>null});
  await sync.sync(project.id,exec);
  assert.equal(doc.name,'MetaOntic 创作画布');
  assert.ok(!doc.name.includes(project.id));
  await sync.followTitle(exec.agent.session,{type:'turn/end',data:{title:'不算标题'}});
  await sync.followTitle(exec.agent.session,{type:'session/title',data:{title:'   '}});
  await sync.followTitle({id:'other-session'},{type:'session/title',data:{title:'别的会话'}});
  assert.equal(doc.name,'MetaOntic 创作画布');
  await sync.followTitle(exec.agent.session,{type:'session/title',data:{title:'15秒小孩与父母搞笑视频'}});
  assert.equal(doc.name,'15秒小孩与父母搞笑视频');
  assert.equal(doc.defaultCanvasName,'15秒小孩与父母搞笑视频');
  const again=await api.readProject(project.id,exec);
  assert.equal(again.canvasAuto.appliedName,'15秒小孩与父母搞笑视频');
  assert.equal(again.canvasAuto.name,'MetaOntic 创作画布');
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(root,{recursive:true,force:true});}
});

test('画布名归属判定只认插件写过的名字',()=>{
 const binding={name:'MetaOntic 创作 abc-123'};
 assert.equal(api.pluginNamedCanvas(binding,'MetaOntic 创作 abc-123'),true);
 assert.equal(api.pluginNamedCanvas(binding,'MetaOntic 创作 9ebc517d'),true);
 assert.equal(api.pluginNamedCanvas({appliedName:'民勤蜜瓜独白短视频'},'民勤蜜瓜独白短视频'),true);
 // 交付过名字之后，画布端推回来的创建名不再算插件可写，避免两边来回改。
 assert.equal(api.pluginNamedCanvas({name:'MetaOntic 创作画布',appliedName:'民勤蜜瓜独白短视频'},'MetaOntic 创作画布'),false);
 assert.equal(api.pluginNamedCanvas(binding,'我的话布'),false);
 assert.equal(api.pluginNamedCanvas(binding,''),false);
 // 老版本只写过标题、没记归属：名字正好等于当前标题时按插件写过处理。
 assert.equal(api.pluginNamedCanvas(binding,'生成武威30秒宣传片','生成武威30秒宣传片'),true);
 assert.equal(api.pluginNamedCanvas(binding,'生成武威30秒宣传片','另一个标题'),false);
 // 默认画布名：原版缺省名、上次应用的名字、当前标题算插件写过；用户自己起的名字不算。
 assert.equal(api.pluginNamedCanvasName(binding,'默认画布','民勤蜜瓜独白短视频'),true);
 assert.equal(api.pluginNamedCanvasName({appliedCanvasName:'民勤蜜瓜独白短视频'},'民勤蜜瓜独白短视频'),true);
 assert.equal(api.pluginNamedCanvasName(binding,'我的第一集','民勤蜜瓜独白短视频'),false);
 // 原版 projectsGet 不带该字段时视为缺省「默认画布」，仍算插件可写。
 assert.equal(api.pluginNamedCanvasName(binding,'','民勤蜜瓜独白短视频'),true);
});

test('同名画布已被别的创作项目占用时另起带序号的名字，不写进别人的画布',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'自动画布 重名 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'auto-canvas-dup',header:{cwd:root}}}};
  const first=await api.createProject(exec,'scenery');first.duration=30;first.choice='not_needed';
  first.canvasAuto={version:1,name:'民勤蜜瓜独白短视频',projectId:'pother',nodes:{},links:{}};
  await api.writeProject(first);
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';await api.writeProject(project);
  const docs=new Map([['pother',{name:'民勤蜜瓜独白短视频',nodes:{},edges:[],defaultCanvasName:'默认画布'}]]);
  const attempted=[];
  const adapter={connect:async()=>({ok:true,already:true}),rpc:{
   canvasCreateProject:async(args)=>{attempted.push(args.name);
    if(args.name==='民勤蜜瓜独白短视频')return {ok:true,projectId:'pother',name:args.name,reused:true};
    docs.set('p2',{name:args.name,nodes:{},edges:[],defaultCanvasName:'默认画布'});return {ok:true,projectId:'p2',name:args.name};},
   projectsGet:async({id})=>structuredClone(docs.get(id)),
   projectsPut:async({id,name,defaultCanvasName})=>{const d=docs.get(id);if(name)d.name=name;if(defaultCanvasName)d.defaultCanvasName=defaultCanvasName;return {ok:true};},
   dataRootGet:async()=>({dataRoot:root}),assetsGet:async()=>({items:[]}),
   projectDirGet:async()=>({ok:true,abs:path.join(root,'projects','p2'),dataRoot:root}),
   assetCreate:async()=>({ok:true}),canvasOpen:async()=>({ok:true}),
  }};
  const sync=api.createCanvasProjectSync(async()=>adapter,{autoCreateCanvas:true}, {get:()=>({title:'民勤蜜瓜独白短视频'})});
  const result=await sync.sync(project.id,exec);
  assert.deepEqual(attempted,['民勤蜜瓜独白短视频','民勤蜜瓜独白短视频 2']);
  assert.equal(result.projectId,'p2');
  assert.equal((await api.readProject(project.id,exec)).canvasAuto.name,'民勤蜜瓜独白短视频 2');
  assert.equal(docs.get('pother').name,'民勤蜜瓜独白短视频');
  assert.equal(docs.get('p2').name,'民勤蜜瓜独白短视频');
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(root,{recursive:true,force:true});}
});

test('同名画布已有内容（不是本创作项目的）时也不占用',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'自动画布 占名 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'auto-canvas-taken',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';await api.writeProject(project);
  const docs=new Map([['puser',{name:'民勤蜜瓜独白短视频',nodes:{n1:{id:'n1',type:'text',x:0,y:0,w:360,h:280,data:{label:'用户自己的节点'}}},edges:[],defaultCanvasName:'默认画布'}]]);
  const attempted=[];
  const adapter={connect:async()=>({ok:true,already:true}),rpc:{
   canvasCreateProject:async(args)=>{attempted.push(args.name);
    if(args.name==='民勤蜜瓜独白短视频')return {ok:true,projectId:'puser',name:args.name,reused:true};
    docs.set('pmine',{name:args.name,nodes:{},edges:[],defaultCanvasName:'默认画布'});return {ok:true,projectId:'pmine',name:args.name};},
   projectsGet:async({id})=>structuredClone(docs.get(id)),
   projectsPut:async({id,name,defaultCanvasName})=>{const d=docs.get(id);if(name)d.name=name;if(defaultCanvasName)d.defaultCanvasName=defaultCanvasName;return {ok:true};},
   dataRootGet:async()=>({dataRoot:root}),assetsGet:async()=>({items:[]}),
   projectDirGet:async()=>({ok:true,abs:path.join(root,'projects','pmine'),dataRoot:root}),
   assetCreate:async()=>({ok:true}),canvasOpen:async()=>({ok:true}),
  }};
  const sync=api.createCanvasProjectSync(async()=>adapter,{autoCreateCanvas:true}, {get:()=>({title:'民勤蜜瓜独白短视频'})});
  const result=await sync.sync(project.id,exec);
  assert.deepEqual(attempted,['民勤蜜瓜独白短视频','民勤蜜瓜独白短视频 2']);
  assert.equal(result.projectId,'pmine');
  assert.deepEqual(Object.keys(docs.get('puser').nodes),['n1']);
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(root,{recursive:true,force:true});}
});

test('旧记录里带创作项目 id 的创建名不再沿用',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'自动画布 旧名 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'auto-canvas-oldname',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';
  project.canvasAuto={version:1,name:`MetaOntic 创作 ${project.id}`,nodes:{},links:{}};
  await api.writeProject(project);
  let created='';
  const adapter={connect:async()=>({ok:true,already:true}),rpc:{
   canvasCreateProject:async(args)=>{created=args.name;return {ok:true,projectId:'pold'};},
   projectsGet:async()=>({name:'MetaOntic 创作画布',nodes:{},edges:[],defaultCanvasName:'默认画布'}),
   projectsPut:async()=>({ok:true}),
   dataRootGet:async()=>({dataRoot:root}),assetsGet:async()=>({items:[]}),
   projectDirGet:async()=>({ok:true,abs:path.join(root,'projects','pold'),dataRoot:root}),
   assetCreate:async()=>({ok:true}),canvasOpen:async()=>({ok:true}),
  }};
  const sync=api.createCanvasProjectSync(async()=>adapter,{autoCreateCanvas:true}, {get:()=>null});
  await sync.sync(project.id,exec);
  assert.equal(created,'MetaOntic 创作画布');
  assert.ok(!created.includes(project.id));
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(root,{recursive:true,force:true});}
});

test('老版本只写过标题名的画布补记归属，以后跟着会话改名',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'自动画布 归属 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'auto-canvas-legacy',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';
  project.canvasAuto={version:1,name:`MetaOntic 创作 ${project.id}`,projectId:'legacy',nodes:{},links:{}};
  await api.writeProject(project);
  let doc={name:'沙葱宣传片',nodes:{},edges:[]};
  const adapter={connect:async()=>({ok:true,already:true}),rpc:{
   canvasCreateProject:async()=>({ok:true,projectId:'legacy'}),
   projectsGet:async()=>structuredClone(doc),
   projectsPut:async(args)=>{if(args.name)doc.name=args.name;if(args.doc)doc={...structuredClone(args.doc),name:doc.name};return {ok:true};},
   dataRootGet:async()=>({dataRoot:root}),assetsGet:async()=>({items:[]}),
   projectDirGet:async()=>({ok:true,abs:path.join(root,'projects','legacy'),dataRoot:root}),
   assetCreate:async()=>({ok:true}),canvasOpen:async()=>({ok:true}),
  }};
  let title='沙葱宣传片';
  const sync=api.createCanvasProjectSync(async()=>adapter,{autoCreateCanvas:true}, {get:()=>({title})});
  await sync.sync(project.id,exec);
  assert.equal(doc.name,'沙葱宣传片');
  assert.equal((await api.readProject(project.id,exec)).canvasAuto.appliedName,'沙葱宣传片');
  title='沙葱15秒宣传片';
  await sync.followTitle(exec.agent.session,{type:'session/title',data:{title}});
  assert.equal(doc.name,'沙葱15秒宣传片');
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
  const adapter={connect:async(args)=>{connects.push(args);return {ok:true,already:true};},rpc:{canvasCreateProject:async()=>({ok:true,projectId:'pre'}),projectsGet:async()=>structuredClone(doc),projectsPut:async({doc:next})=>{doc=next;return {ok:true};},dataRootGet:async()=>({dataRoot:root})}};
  const sync=api.createCanvasProjectSync(async()=>adapter,{autoCreateCanvas:true});
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

test('旧版无效文本连线被清理并记墓碑，画布端能删掉缓存里的旧线',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'自动画布 墓碑 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'auto-canvas-tomb',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=30;project.choice='not_needed';await api.writeProject(project);
  let doc={name:'自动创作',nodes:{},edges:[]};const connects=[];
  const adapter={connect:async(args)=>{connects.push(args);return {ok:true,already:true};},rpc:{
   canvasCreateProject:async()=>({ok:true,projectId:'auto'}),
   projectsGet:async()=>structuredClone(doc),
   projectsPut:async({doc:next})=>{doc=structuredClone(next);return {ok:true};},
   dataRootGet:async()=>({dataRoot:root}),assetsGet:async()=>({items:[]}),
   projectDirGet:async()=>({ok:true,abs:path.join(root,'projects','auto'),dataRoot:root}),
   assetCreate:async()=>({ok:true}),canvasOpen:async()=>({ok:true}),
  }};
  const sync=api.createCanvasProjectSync(async()=>adapter,{autoCreateCanvas:true});
  const scriptPath=path.join(root,'剧本.md');await writeFile(scriptPath,'# 剧本');
  const spec={prompt:'日出',segmentPrompts:['日出'],duration:30,ratio:'9:16',resolution:'720p'};
  const saved=await api.readProject(project.id,exec);saved.approved={scriptPath,specification:spec};await api.writeProject(saved);
  await sync.sync(project.id,exec);
  // 旧版本记录过的自动连线：指向没有输入端口的文本节点，画布端本来就不该保留。
  const prefix=`mov_${project.id.replaceAll('-','')}`;
  const legacy={id:`${prefix}_edge_project_script`,fromNode:`${prefix}_project`,toNode:`${prefix}_script`,fromPort:'out',toPort:'prompt'};
  const again=await api.readProject(project.id,exec);
  again.canvasAuto.links[legacy.id]=createHash('sha256').update(JSON.stringify(legacy)).digest('hex');
  await api.writeProject(again);
  doc.edges.push(legacy);
  await sync.sync(project.id,exec);
  assert.ok(!doc.edges.some(e=>e.id===legacy.id));
  assert.ok((doc.edgeTombstones||[]).includes(legacy.id));
  assert.equal(connects.length,2);
 }finally{if(old===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=old;await rm(root,{recursive:true,force:true});}
});

test('自动创建流程画布默认关闭：没配过时不建图不同步，video_config 也只读成关闭', async () => {
  const sync = api.createCanvasProjectSync(async () => { throw new Error('默认关闭时不该去碰画布'); }, {});
  const disabled = await sync.sync('any-project', { agent: { session: { id: 's', header: { cwd: os.tmpdir() } } } });
  assert.equal(disabled.status, 'disabled');
  assert.match(disabled.reason, /默认关闭/);
  const { Config } = await import('../index.js');
  assert.equal(Config.dict.autoCreateCanvas.meta.default, false, 'schema 默认值就是关闭（设置页没配过时按它走）');
});

test('默认关闭不谎报：助手口径不承诺自动建图、摘要卡不印 disabled、内置画布不报已打开', async () => {
  const off = api.buildPromptGuidance({});
  assert.match(off, /左侧栏「MetaOnticVideo流程画布」/, '提示词按现在的侧边栏名字指路');
  assert.match(off, /当前开关关闭/);
  assert.doesNotMatch(off, /工具自动建流程画布项目/, '默认关闭时不能还说工具会自动建图');
  assert.match(off, /无法代开/, '内置画布开不了要说清楚');
  const on = api.buildPromptGuidance({ autoCreateCanvas: true });
  assert.match(on, /工具会自动建流程画布项目/);
  assert.doesNotMatch(on, /当前开关关闭/);

  // 摘要卡：未开启自动投影是常态，不占一行，也不把内部状态码印给用户。
  const rows = (canvasStatus) => api.toolSummary('video_project', {
    kind: 'tool_use',
    content: [{ type: 'text', text: JSON.stringify({ status: 'approved', projectId: 'p', canvasProject: { status: canvasStatus } }) }],
  }).rows;
  assert.ok(!rows('disabled').some(([key]) => key === '画布同步'), '默认关闭不占卡片行');
  assert.deepEqual(rows('synced').find(([key]) => key === '画布同步'), ['画布同步', '已同步']);
  assert.deepEqual(rows('pending').find(([key]) => key === '画布同步'), ['画布同步', '待补传（用video_canvas补传，不重新生成）']);

  const { rpc } = api.builtinCanvasAdapter();
  const opened = await rpc.canvasOpen({ projectId: 'p1' });
  assert.equal(opened.ok, false);
  assert.match(opened.reason, /左侧栏/);
});
