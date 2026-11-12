import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {api} from './module-test-api.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64');

/** 内置流程画布：不依赖任何第三方画布插件，创作项目照样建图、命名、读回与回填。 */
test('没有原版画布也能建流程画布：创建、命名、连线、读回、回填全走插件自己的存储',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'内置画布 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const exec={agent:{session:{id:'builtin-canvas',header:{cwd:root}}}};
  const project=await api.createProject(exec,'scenery');project.duration=20;project.choice='not_needed';await api.writeProject(project);
  const scriptPath=path.join(root,'剧本.md');await writeFile(scriptPath,'# 完整剧本\n| 镜头 | 画面 |\n| --- | --- |\n| 一 | 厨房追逐 |');
  const saved=await api.readProject(project.id,exec);
  saved.approved={scriptPath,specification:{prompt:'猫和老鼠厨房追逐',segmentPrompts:['上半段','下半段'],duration:20,ratio:'16:9',resolution:'480p'}};
  await api.writeProject(saved);
  // 流程画布自带适配器：不需要任何第三方画布插件在场。
  const builtin=await api.loadCanvasAdapter();
  assert.equal(typeof builtin.rpc.projectsList,'function');
  const title='猫和老鼠20秒搞笑动画';
  const sync=api.createCanvasProjectSync(undefined,{autoCreateCanvas:true}, {get:()=>({title})});
  const result=await sync.sync(project.id,exec);
  assert.equal(result.status,'synced');
  assert.match(result.projectId,/^[A-Za-z0-9_-]{1,100}$/);
  // 内置画布是左侧栏页面，工具不能代开：不能回「已打开」骗助手和用户。
  assert.equal(result.openRequested,false,'内置画布不应谎报已打开');
  const record=await api.readProject(project.id,exec);
  assert.equal(record.canvasAuto.backend,'builtin');
  assert.equal(record.canvasAuto.appliedName,title);
  const adapter=await api.resolveCanvasAdapter(result.projectId);
  const doc=await adapter.rpc.projectsGet({id:result.projectId});
  assert.equal(doc.name,title);                       // 画布名跟随会话标题，不含创作项目 id
  assert.equal(doc.defaultCanvasName,title);
  assert.ok(!doc.name.includes(project.id)&&!doc.defaultCanvasName.includes(project.id),'画布名不应出现创作项目 id');
  const types=Object.values(doc.nodes).map(n=>n.type);
  assert.deepEqual([...new Set(types)].sort(),['script','storyboard','text','video']);
  assert.equal(doc.edges.length,2);
  for(const edge of doc.edges){ assert.ok(doc.nodes[edge.fromNode]&&doc.nodes[edge.toNode],'连线两端必须在场'); }
  // 幂等：重复同步不新建项目、不重复节点；补发的连线确认也不新增。
  const again=await sync.sync(project.id,exec);
  assert.equal(again.projectId,result.projectId);
  const second=await adapter.rpc.projectsGet({id:result.projectId});
  assert.deepEqual(Object.keys(second.nodes).sort(),Object.keys(doc.nodes).sort());
  assert.deepEqual(second.edges,doc.edges);
  // 标题事件补名：跟标题走；用户手动改名后不再被覆盖。
  await sync.followTitle(exec.agent.session,{type:'session/title',data:{title:'改过的标题'}});
  assert.equal((await adapter.rpc.projectsGet({id:result.projectId})).name,'改过的标题');
  await adapter.rpc.canvasRename({projectId:result.projectId,name:'我的话布'});
  await sync.followTitle(exec.agent.session,{type:'session/title',data:{title:'又一次'}});
  assert.equal((await adapter.rpc.projectsGet({id:result.projectId})).name,'我的话布');
  // 读回：助手按项目读画布内容与定位信息，不需要原版在场。
  const production=Object.values(second.nodes).find(n=>n.type==='video');
  const input=await api.readCanvasInput(adapter,{projectId:result.projectId,nodeId:production.id});
  assert.equal(input.canvas.nodeId,production.id);
  assert.ok(input.nodes.some(n=>n.type==='script'));
  // 回填：成果落到插件自己的数据目录，并在画布上新增成果节点。
  const media=path.join(root,'result.png');await writeFile(media,png);
  const token='11111111-1111-4111-8111-111111111111';
  const published=await api.publishCanvasResult(adapter,{id:token,owner:'owner',canvas:input.canvas,ratio:'16:9',phase:'complete',createdAt:Date.now(),
   media:[{kind:'image',label:'第1段成果',localPath:media}]});
  assert.equal(published.status,'synced');
  const filled=await adapter.rpc.projectsGet({id:result.projectId});
  const added=Object.values(filled.nodes).filter(n=>n.data?.assetId);
  assert.equal(added.length,1);
  assert.equal(added[0].metaonticSourceNode,production.id);
  const assets=(await adapter.rpc.assetsGet({ids:[added[0].data.assetId]})).items;
  assert.equal(assets.length,1);
  const root2=(await adapter.rpc.dataRootGet()).dataRoot;
  assert.equal((await stat(path.join(root2,assets[0].rel))).isFile(),true);
  assert.ok(root2.startsWith(root),'素材必须落在插件自己的数据根');
 } finally { if(old===undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME=old; await rm(root,{recursive:true,force:true}); }
});

/** 画布内的编辑动作走同一份内置文档：新建/编辑节点、连线、断开、删除，不碰第三方插件。 */
test('内置画布支持节点编辑、连线与删除，删除不复活且自动线记墓碑',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'内置画布编辑 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const {canvas:created}=await api.builtinCanvasHandle({method:'list'}).then(async list=>{
   const made=await api.builtinRpc().canvasCreateProject({name:'编辑用画布'});
   return api.builtinCanvasHandle({method:'get',args:{projectId:made.projectId}});
  });
  const projectId=created.projectId;
  const saved=await api.builtinCanvasHandle({method:'nodeSave',args:{projectId,node:{id:'usr_text',type:'text',x:10,y:20,w:360,h:200,data:{label:'说明',text:'第一版'}}}});
  assert.equal(saved.canvas.node.data.text,'第一版');
  const video=await api.builtinCanvasHandle({method:'nodeSave',args:{projectId,node:{id:'usr_video',type:'video',x:500,y:20,data:{label:'视频节点',prompt:'海面日出',ratio:'16:9',duration:5,resolution:'720p'}}}});
  assert.equal(video.canvas.node.type,'video');
  // 只接受能编辑的字段：成果标识等既有数据不能被界面覆盖成空。
  await api.builtinRpc().projectsPut({id:projectId,name:'编辑用画布',doc:{nodes:{
   usr_text:{id:'usr_text',type:'text',x:10,y:20,data:{label:'说明',text:'第一版'}},
   usr_video:{id:'usr_video',type:'video',x:500,y:20,data:{prompt:'海面日出',metaonticTaskId:'keep-me'}}}}});
  const kept=await api.builtinCanvasHandle({method:'nodeSave',args:{projectId,node:{id:'usr_video',type:'video',data:{prompt:'改成夜景'}}}});
  assert.equal(kept.canvas.node.data.metaonticTaskId,'keep-me');
  const edge=await api.builtinCanvasHandle({method:'edgeAdd',args:{projectId,fromNode:'usr_text',toNode:'usr_video',fromPort:'out',toPort:'prompt'}});
  assert.equal(edge.canvas.edge.toPort,'prompt');
  const again=await api.builtinCanvasHandle({method:'edgeAdd',args:{projectId,fromNode:'usr_text',toNode:'usr_video',fromPort:'out',toPort:'prompt'}});
  assert.equal(again.canvas.already,true);
  const doc=await api.builtinRpc().projectsGet({id:projectId});
  assert.equal(doc.edges.length,1);
  await api.builtinCanvasHandle({method:'edgeDelete',args:{projectId,edgeId:doc.edges[0].id}});
  const afterEdge=await api.builtinRpc().projectsGet({id:projectId});
  assert.equal(afterEdge.edges.length,0);
  assert.ok(afterEdge.edgeTombstones.includes(doc.edges[0].id),'删掉的连线要记墓碑，避免同步加回来');
  await api.builtinCanvasHandle({method:'nodeDelete',args:{projectId,nodeId:'usr_text'}});
  const afterDelete=await api.builtinRpc().projectsGet({id:projectId});
  assert.ok(!afterDelete.nodes.usr_text);
  assert.ok(afterDelete.tombstones.includes('usr_text'));
  await assert.rejects(api.builtinCanvasHandle({method:'nodeSave',args:{projectId,node:{id:'usr_text',type:'text'}}}),/不自动复活/);
  await assert.rejects(api.builtinCanvasHandle({method:'edgeAdd',args:{projectId,fromNode:'usr_text',toNode:'usr_video'}}),/两端节点必须在场/);
  await assert.rejects(api.builtinCanvasHandle({method:'edgeDelete',args:{projectId,edgeId:'nope'}}),/不存在/);
 } finally { if(old===undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME=old; await rm(root,{recursive:true,force:true}); }
});

/** 内置画布也能跑「生成→费用确认→审核」，不需要第三方画布插件在场。 */
test('内置画布节点可直接制作：按项目解析适配器，成果回填到插件自己的存储',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'内置画布制作 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  // 整条链路从面板的「新建画布（必须命名）」开始。
  const made=(await api.builtinCanvasHandle({method:'create',args:{name:'制作画布'}})).canvas;
  const projectId=made.projectId;
  assert.deepEqual(made.nodes,{});assert.deepEqual(made.edges,[]);
  await api.builtinCanvasHandle({method:'nodeSave',args:{projectId,node:{id:'usr_video',type:'video',x:0,y:0,data:{label:'视频节点',prompt:'海面日出',ratio:'9:16',duration:5,resolution:'720p'}}}});
  const directory=path.join(root,'native');
  // 生成结果只可能来自渠道URL；测试用本地成品代替下载，回填路径与线上一致（只新增成果节点）。
  const local=path.join(root,'本段.mp4');await writeFile(local,'mock-mp4');
  let calls=0,publications=0;
  const service=api.createCanvasNativeService({connectionMode:'metaontic',metaonticApiKey:'k',baseUrl:'https://example.invalid',model:'doubao-seedance-2-0',imageUseVideoKey:true},{
   directory,
   video:async(_cfg,_body,_signal,progress)=>{calls++;await progress.onCreated('task-9');return {status:'succeeded',taskId:'task-9',videoUrl:'https://example.invalid/a.mp4'};},
   publish:async(adapter,record)=>{publications++;return api.publishCanvasResult(adapter,{...record,media:record.media.map(m=>({...m,localPath:local}))});},
  });
  try {
   const {proposal}=await service.handle({action:'prepare',projectId,nodeId:'usr_video'});
   assert.equal(calls,0);
   assert.equal(proposal.operation,'generate');
   await service.handle({action:'start',id:proposal.id,confirmPlan:true,confirmCost:true,textOnly:true});
   let job;
   // 终态与回填记录分两次落盘：等到状态结束并且回填记录已经可见，避免读到中间快照。
   for(let n=0;n<200;n++){
    ({job}=await service.handle({action:'status',id:proposal.id}));
    if(job.state!=='running'&&(job.sync||!job.media?.length)) break;
    await new Promise(r=>setTimeout(r,10));
   }
   assert.equal(job.state,'succeeded');assert.equal(calls,1);assert.equal(publications,1);
   assert.equal(job.sync.status,'synced');
   const doc=await api.builtinRpc().projectsGet({id:projectId});
   const result=Object.values(doc.nodes).find(n=>n.data?.assetId);
   assert.ok(result,'成果节点要回填到内置画布');
   assert.equal(result.data.metaonticTaskId,'task-9');
   assert.equal(result.data.metaonticVideoUrl,'https://example.invalid/a.mp4');
   // 审核前不允许续拍：审核事实保存在插件自己的记录里。
   await assert.rejects(service.handle({action:'prepare',projectId,nodeId:result.id,operation:'extend'}),/审核上一段/);
   const {job:reviewed}=await service.handle({action:'review',id:proposal.id,accept:true});
   assert.equal(reviewed.reviewed,true);
   // 审核通过后再续拍：方案仍然只针对本段，费用单独确认（这里只准备方案，不提交付费）。
   const extended=await service.handle({action:'prepare',projectId,nodeId:result.id,operation:'extend',draft:{transitionDescription:'镜头推近，海鸥掠过画面',duration:4}});
   assert.equal(extended.proposal.operation,'extend');
   assert.equal(extended.proposal.duration,4);
   // 链路收尾：改名、列表可见、删除后不再列出且不能再用。
   assert.equal((await api.builtinCanvasHandle({method:'rename',args:{projectId,name:'制作画布（定稿）'}})).canvas.name,'制作画布（定稿）');
   const listed=await api.builtinCanvasHandle({method:'list'});
   assert.ok(listed.canvases.some(c=>c.projectId===projectId&&c.name==='制作画布（定稿）'));
   await api.builtinCanvasHandle({method:'delete',args:{projectId}});
   assert.equal((await api.builtinCanvasHandle({method:'list'})).canvases.some(c=>c.projectId===projectId),false);
   await assert.rejects(api.builtinCanvasHandle({method:'get',args:{projectId}}),/不存在或已删除/);
   await assert.rejects(api.builtinCanvasHandle({method:'rename',args:{projectId,name:'改不回去'}}),/不存在或已删除/);
  } finally { service.dispose(); }
 } finally { if(old===undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME=old; await rm(root,{recursive:true,force:true}); }
});

/** 面板「新建画布」：每次新建一份空白文档；必须命名，且不能和已有画布重名（对照原版口径）。 */
test('新建画布总是新建空白文档，必须命名且不重名',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'内置画布新建 ')),old=process.env.DSH_HOME;
 process.env.DSH_HOME=root;
 try {
  const first=await api.builtinCanvasHandle({method:'create',args:{name:'宣传片 A'}});
  const second=await api.builtinCanvasHandle({method:'create',args:{name:'宣传片 B'}});
  assert.notEqual(first.canvas.projectId,second.canvas.projectId,'每次都是新文档，不复用');
  for(const made of [first,second]){
   assert.deepEqual(made.canvas.nodes,{});assert.deepEqual(made.canvas.edges,[]);
   assert.ok(made.canvas.dataRoot.startsWith(root),'画布数据根指向插件自己的目录');
  }
  assert.deepEqual((await api.builtinCanvasHandle({method:'list'})).canvases.map(c=>c.name).sort(),['宣传片 A','宣传片 B']);
  // 重名与空名都拒绝，并且不产生多余文档。
  await assert.rejects(api.builtinCanvasHandle({method:'create',args:{name:'宣传片 A'}}),/同名画布已存在/);
  await assert.rejects(api.builtinCanvasHandle({method:'create',args:{name:'   '}}),/画布名不能为空/);
  assert.equal((await api.builtinCanvasHandle({method:'list'})).canvases.length,2);
  await assert.rejects(api.builtinCanvasHandle({method:'create',args:{}}),/画布名不能为空/);
  const made=await api.builtinCanvasHandle({method:'create',args:{name:'新建流程画布'}});
  assert.equal(made.canvas.name,'新建流程画布');
  // 改名同样必须命名且不重名；改成自己原来的名字是幂等的。
  await assert.rejects(api.builtinCanvasHandle({method:'rename',args:{projectId:made.canvas.projectId,name:'宣传片 A'}}),/同名画布已存在/);
  await assert.rejects(api.builtinCanvasHandle({method:'rename',args:{projectId:made.canvas.projectId,name:''}}),/画布名不能为空/);
  assert.equal((await api.builtinCanvasHandle({method:'rename',args:{projectId:made.canvas.projectId,name:'新建流程画布'}})).canvas.name,'新建流程画布');
  assert.equal((await api.builtinCanvasHandle({method:'rename',args:{projectId:made.canvas.projectId,name:'正片'}})).canvas.name,'正片');
  const renamed=await api.builtinCanvasHandle({method:'get',args:{projectId:made.canvas.projectId}});
  assert.equal(renamed.canvas.name,'正片');
 } finally { if(old===undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME=old; await rm(root,{recursive:true,force:true}); }
});

/** 复制节点只带可编辑内容：成果素材与任务标识不会被复制成“别人的成果”。 */
test('复制节点payload不带成果素材、任务标识与来源关系',()=>{
 const node={id:'seg_1',type:'video',data:{label:'视频制作',prompt:'海面日出',ratio:'16:9',duration:8,resolution:'720p',
  assetId:'a1',metaonticNativeJob:'22222222-2222-4222-8222-222222222222',metaonticTaskId:'task-1',metaonticVideoUrl:'https://example.invalid/a.mp4',metaonticSeconds:5,metaonticSourceNode:'seg_1',status:'done'}};
 const payload=api.duplicateNodePayload(node,{x:100,y:200,w:360,h:300});
 assert.equal(payload.type,'video');assert.equal(payload.x,140);assert.equal(payload.y,240);
 assert.deepEqual(Object.keys(payload.data).sort(),['duration','label','prompt','ratio','resolution']);
 assert.equal(payload.data.assetId,undefined);assert.equal(payload.data.metaonticTaskId,undefined);
 assert.equal(payload.data.metaonticNativeJob,undefined);assert.equal(payload.data.metaonticVideoUrl,undefined);
 assert.equal(JSON.stringify(payload).includes('https://example.invalid'),false);
});
