import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {api} from './module-test-api.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==','base64');

/** 内置流程画布：原版插件完全不存在时，创作项目照样建图、命名、读回与回填。 */
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
  // 原版插件不在场：默认加载器必须失败，流程画布不受影响。
  await assert.rejects(api.loadCanvasAdapter());
  const title='猫和老鼠20秒搞笑动画';
  const sync=api.createCanvasProjectSync(undefined,{}, {get:()=>({title})});
  const result=await sync.sync(project.id,exec);
  assert.equal(result.status,'synced');
  assert.match(result.projectId,/^[A-Za-z0-9_-]{1,100}$/);
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
