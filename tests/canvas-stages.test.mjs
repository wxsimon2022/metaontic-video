import {test} from 'node:test';
import assert from 'node:assert/strict';
import {api} from './module-test-api.mjs';

const facts=(patch={})=>({...api.stageFacts({subjectType:'scenery',duration:30,choice:'not_needed'},null,false,0),...patch});
const byKey=stages=>Object.fromEntries(stages.map(stage=>[stage.key,stage]));

test('阶段状态跟着创作项目走：没审核是待审核，审核过才算完成',()=>{
 const draft=byKey(api.stageSummary(facts({scriptDrafted:true}),{total:0,produced:0}));
 assert.equal(draft.requirement.state,'done');
 assert.equal(draft.script.state,'review');
 assert.equal(draft.script.text,'剧本：已同步\n审核：等待用户审核');
 assert.equal(draft.cost.state,'pending');
 assert.equal(draft.segments.state,'pending');
 assert.equal(draft.film.state,'pending');

 const approved=byKey(api.stageSummary(facts({scriptDrafted:true,scriptApproved:true,specApproved:true,segmentTotal:4,ratio:'9:16',resolution:'720p'}),{total:1,produced:0}));
 assert.equal(approved.script.state,'done');
 assert.equal(approved.cost.state,'active');
 assert.equal(approved.segments.state,'active');
 assert.equal(approved.segments.text,'制作段：4 段\n已完成：0 段');
 assert.equal(approved.film.state,'pending');
 assert.match(approved.requirement.text,/目标时长：30 秒/);
 // 机器码要写成人话，不能把 not_needed 这种内部取值端给用户。
 assert.match(approved.requirement.text,/角色图路线：不需要角色图/);
 assert.doesNotMatch(approved.requirement.text,/not_needed/);
});

test('分镜与素材两步跟画布内容走：没有分镜是未开始、切出镜头才算完成，素材按角色图路线判断',()=>{
 const base=facts({scriptDrafted:true,scriptApproved:true,ratio:'16:9',resolution:'720p'});
 const done=facts({scriptDrafted:true,scriptApproved:true,segmentTotal:2,ratio:'16:9',resolution:'720p'});
 const none=byKey(api.stageSummary(base,{total:0,produced:0,shots:0,assets:0}));
 assert.equal(none.storyboard.state,'active');
 assert.match(none.storyboard.text,/还没有分镜/);
 // 识别到分镜表：分镜完成；角色图路线不需要时素材也算就绪。
 const withShots=byKey(api.stageSummary(done,{total:2,produced:0,shots:2,assets:0}));
 assert.equal(withShots.storyboard.state,'done');
 assert.match(withShots.storyboard.text,/分镜：2 个镜头/);
 assert.equal(withShots.assets.state,'done','不需要角色图时素材这一步不挡流程');
 // 需要角色图但画布上还没有素材图：素材这一步标进行中，等用户准备。
 const needAssets=byKey(api.stageSummary(facts({choice:'generate_first',scriptDrafted:true,scriptApproved:true,segmentTotal:2}),{total:2,produced:0,shots:2,assets:0}));
 assert.equal(needAssets.assets.state,'active');
 assert.match(needAssets.assets.text,/素材图：0 张/);
 assert.match(needAssets.assets.text,/先生成角色图再制作/);
 const ready=byKey(api.stageSummary(facts({choice:'generate_first',scriptDrafted:true,scriptApproved:true,segmentTotal:2}),{total:2,produced:0,shots:2,assets:2}));
 assert.equal(ready.assets.state,'done');
 assert.match(ready.assets.text,/素材图：2 张/);
 // 没有分镜表时按句子切段：只要切出了制作段，分镜这一步也算完成。
 const bySentence=byKey(api.stageSummary(done,{total:3,produced:0,shots:0,assets:0}));
 assert.equal(bySentence.storyboard.state,'done');
 assert.match(bySentence.storyboard.text,/按场景与句子切段，共 3 段/);
});

test('画布内容侧统计：助手流程一张制作节点累积多段成果，手作流程一段一个节点',()=>{
 const assistant={nodes:{
  production:{id:'production',type:'video',data:{metaonticAssistantManaged:true}},
  r1:{id:'r1',type:'video',metaonticSourceNode:'production',metaonticCreatedAt:1,data:{assetId:'a1'}},
  r2:{id:'r2',type:'video',metaonticSourceNode:'production',metaonticCreatedAt:2,data:{assetId:'a2'}},
  gone:{id:'gone',type:'video',metaonticSourceNode:'production',metaonticCreatedAt:3,data:{}},
 }};
 assert.deepEqual(api.canvasSegmentStats(assistant),{total:1,produced:2,shots:0,assets:0,assetsBound:0,assetsOrphan:0,filmReady:false,filmCount:0});

 const manual={film:{assetId:'f1',count:2},nodes:{
  n1:{id:'n1',type:'video',data:{}},r1:{id:'r1',type:'video',metaonticSourceNode:'n1',data:{assetId:'a1'}},
  n2:{id:'n2',type:'video',data:{}},r2:{id:'r2',type:'video',metaonticSourceNode:'n2',metaonticCreatedAt:5,data:{metaonticVideoUrl:'https://x/2.mp4'}},
  img:{id:'img',type:'image',data:{assetId:'material'}},
 }};
 assert.deepEqual(api.canvasSegmentStats(manual),{total:2,produced:2,shots:0,assets:1,assetsBound:0,assetsOrphan:1,filmReady:true,filmCount:2});
});

test('回填与合成之后按画布内容刷新阶段条，用户改过的阶段卡不被覆盖',()=>{
 const prefix='mov_p',project={subjectType:'scenery',duration:30,choice:'not_needed',approved:{}};
 const base=api.stageFacts(project,null,true,2);
 const nodes={};
 api.stageSummary(base,{total:1,produced:0}).forEach((stage,index)=>{
  const spot=api.stageSpot(index);
  nodes[api.stageNodeId(prefix,stage.key)]={id:api.stageNodeId(prefix,stage.key),type:'text',x:spot.x,y:spot.y,w:spot.w,h:spot.h,
   data:{...api.sealedStageData(stage.key,stage.state,stage.text,base),metaonticProjectId:'p'}};
 });
 nodes.production={id:'production',type:'video',x:1040,y:60,w:360,h:300,data:{label:'视频制作',metaonticAssistantManaged:true}};
 const segmentsId=api.stageNodeId(prefix,'segments'),filmId=api.stageNodeId(prefix,'film');
 assert.ok(nodes[segmentsId]&&nodes[filmId]);
 assert.equal(nodes[segmentsId].data.metaonticStageState,'active');

 // 回填第一段：逐段制作变成进行中 1/2，合成成片仍是未开始。
 const one=api.refreshStageNodes({nodes:{...nodes,r1:{id:'r1',type:'video',metaonticSourceNode:'production',metaonticCreatedAt:1,x:1460,y:60,w:360,h:280,data:{assetId:'a1'}}}});
 assert.equal(one.changed.includes(segmentsId),true);
 assert.equal(one.nodes[segmentsId].data.metaonticStageState,'active');
 assert.match(one.nodes[segmentsId].data.text,/已完成：1 段/);
 assert.equal(one.nodes[filmId].data.metaonticStageState,'pending');

 // 用户在阶段卡上写了字：之后的重算跳过它，保留用户文本。
 const costId=api.stageNodeId(prefix,'cost');
 const edited={...one.nodes, [costId]:{...one.nodes[costId],data:{...one.nodes[costId].data,text:'我自己的备注'}}};
 const both=api.refreshStageNodes({nodes:{...edited,r2:{id:'r2',type:'video',metaonticSourceNode:'production',metaonticCreatedAt:2,x:1460,y:420,w:360,h:280,data:{assetId:'a2'}}}});
 assert.equal(both.nodes[costId].data.text,'我自己的备注');
 assert.equal(both.nodes[costId].data.metaonticStageState,'done');
 assert.equal(both.nodes[segmentsId].data.metaonticStageState,'done');
 assert.equal(both.nodes[segmentsId].data.text,'制作段：2 段\n已完成：2 段');

 // 合成成片：只更新合成阶段卡，逐段制作保持已完成。
 const filmed=api.refreshStageNodes({nodes:{...both.nodes,film:{assetId:'f1',count:2}}});
 assert.equal(filmed.nodes[filmId].data.metaonticStageState,'ready');
 assert.equal(filmed.nodes[segmentsId].data.metaonticStageState,'done');
});

test('阶段节点只有 seal 对得上才认作插件自己写的',()=>{
 const facts=api.stageFacts({subjectType:'scenery',duration:30},null,false,0);
 const data=api.sealedStageData('script','pending','剧本：未开始',facts);
 assert.equal(api.stageNodeOwned({data}),true);
 assert.equal(api.stageNodeOwned({data:{...data,text:'用户改过'}}),false);
 assert.equal(api.stageNodeOwned({data:{...data,metaonticStageState:'done'}}),false);
 assert.equal(api.stageNodeOwned({data:{label:'普通说明'}}),false);
});

test('阶段卡上的主行动：七个阶段各有一个入口，未定义的阶段不编按钮',()=>{
 const keys=api.STAGE_KEYS.map(key=>api.stageAction(key));
 assert.deepEqual(keys.map(action=>action.label),['填需求','看剧本','看分镜','准备素材','看估价','做这一段','合成成片']);
 for (const action of keys) { assert.ok(action.hint.length>10,`每个行动都要说明这一步做什么：${action.hint}`); assert.match(action.hint,/费用|计费|确认/,'行动说明要交代费用口径'); }
 assert.equal(api.stageAction('unknown'),null);
});

test('阶段卡的主行动跟对话顺序走：①需求先建、②先写脚本再审核，建好后就地改需求',()=>{
 // 还没需求：①给「填需求」，②还没有脚本不给按钮。
 const empty=api.stageFacts({},null,false,0);
 assert.equal(api.pendingStageAction('requirement',empty),null);
 assert.equal(api.stageAction('requirement').label,'填需求');
 assert.equal(api.pendingStageAction('script',empty).label,'写脚本');
 assert.equal(api.pendingStageAction('cost',empty),null);
 // 需求建好、脚本还没写：①改成「改需求」，②仍是「写脚本」。
 const drafted=api.stageFacts({subjectType:'scenery',duration:30,choice:'not_needed'},null,false,0);
 assert.equal(drafted.requirementSettled,true);
 assert.equal(api.pendingStageAction('requirement',drafted).label,'改需求');
 assert.equal(api.pendingStageAction('script',drafted).label,'写脚本');
 // 脚本写好、还没审核：②变「确认脚本」；审核通过后②回到「看剧本」（不再有 pending）。
 const waiting=api.stageFacts({subjectType:'scenery',duration:30},null,true,2);
 assert.equal(api.pendingStageAction('script',waiting).label,'确认脚本');
 const approved=api.stageFacts({subjectType:'scenery',duration:30,approved:{}},null,true,2);
 assert.equal(api.pendingStageAction('script',approved),null);
 assert.equal(api.stageAction('script').label,'看剧本');
 // ③ 分镜：脚本审核通过、还没切出镜头时给「生成分镜」，切出来就回到「看分镜」。
 assert.equal(api.pendingStageAction('storyboard',approved).label,'生成分镜');
 assert.equal(api.pendingStageAction('storyboard',{...approved,storyboardReady:true}),null);
 assert.equal(api.STAGE_STORYBOARD_ACTION.storyboard.label,'生成分镜');
 assert.match(api.STAGE_STORYBOARD_ACTION.storyboard.hint,/不产生视频费用/);
 // ④ 素材：对齐 LibTV 的「准备资产」，主行动是「准备素材」，说明里交代图片单独计费与审核。
 assert.equal(api.stageAction('storyboard').label,'看分镜');
 assert.equal(api.stageAction('assets').label,'准备素材');
 assert.match(api.stageAction('assets').hint,/单独计费|计费/);
 assert.match(api.stageAction('assets').hint,/审核/);
 // 每一步都要交代费用口径，别让用户以为点一下就扣费。
 for (const action of [api.STAGE_DRAFT_ACTION.script,api.STAGE_REVIEW_ACTION.script,api.STAGE_EDIT_ACTION.requirement])
  assert.match(action.hint,/费用|计费|不产生|不调用/,'行动说明要交代费用口径：'+action.hint);
});

test('需求节点与阶段前缀：第一步建需求带出想法与规格，第二步复用同一批阶段卡',()=>{
 const data=api.requirementNodeData('青旅天台的清晨',30,15,'9:16','720p');
 assert.equal(data.label,'需求');
 assert.equal(data.metaonticRequirement,true);
 assert.equal(data.metaonticRequirementBrief,'青旅天台的清晨');
 assert.deepEqual(data.metaonticRequirementSpec,{seconds:30,segmentSeconds:15,ratio:'9:16',resolution:'720p'});
 assert.match(data.text,/想拍什么：青旅天台的清晨/);
 assert.match(data.text,/目标总时长：30 秒/);
 assert.match(data.text,/清晰度：720P/);
 const doc={nodes:{[api.stageNodeId('mov_p','requirement')]:{id:api.stageNodeId('mov_p','requirement'),type:'text',data:{metaonticStage:'requirement'}},
  req:{id:'req',type:'text',data}}};
 assert.equal(api.requirementNodeOf(doc).id,'req');
 assert.equal(api.requirementNodeOf({nodes:{}}),null);
 assert.equal(api.stagePrefixOf(doc),'mov_p');
 assert.equal(api.stagePrefixOf({nodes:{}}),'');
});

test('画布上确认脚本：只重写插件自己的阶段卡，用户改过的不动，确认不被助手侧回退',()=>{
 const prefix='mov_c';
 const base=api.stageFacts({subjectType:'scenery',duration:30,choice:'not_needed'},null,true,2);
 const nodes={};
 api.stageSummary(base,{total:2,produced:0}).forEach((stage,index)=>{
  const spot=api.stageSpot(index);
  nodes[api.stageNodeId(prefix,stage.key)]={id:api.stageNodeId(prefix,stage.key),type:'text',x:spot.x,y:spot.y,w:spot.w,h:spot.h,
   data:api.sealedStageData(stage.key,stage.state,stage.text,base)};
 });
 const {nodes:rewritten,changed}=api.rewriteStageNodes({nodes},{scriptApproved:true});
 assert.equal(changed.length,api.STAGE_KEYS.length,'确认一次重写整条阶段卡');
 const scriptCard=rewritten[api.stageNodeId(prefix,'script')];
 assert.equal(scriptCard.data.metaonticStageState,'done');
 assert.equal(scriptCard.data.metaonticStageFacts.scriptApproved,true);
 assert.match(scriptCard.data.text,/审核：已通过/);
 assert.ok(api.stageNodeOwned(scriptCard),'重写后仍是插件自己写的卡（seal 完整）');
 assert.ok(api.stageNodeOwned(rewritten[api.stageNodeId(prefix,'requirement')]),'其它卡的内容不乱改');
 // 用户改过内容的卡（seal 对不上）不重写，也不因此挡住其它卡。
 const edited=api.stageNodeId(prefix,'film');
 nodes[edited]={...nodes[edited],data:{...nodes[edited].data,text:'我自己写的备注'}};
 const again=api.rewriteStageNodes({nodes},{scriptApproved:true});
 assert.ok(!again.changed.includes(edited),'用户改过的阶段卡保留原样');
 assert.equal(again.changed.length,api.STAGE_KEYS.length-1,'其它阶段卡仍然跟上事实');
 // 画布上确认过，助手侧还没审核时不回退；没确认过就照助手侧走。
 assert.equal(api.preserveCanvasConfirmations({scriptApproved:true},{scriptApproved:false}).scriptApproved,true);
 assert.equal(api.preserveCanvasConfirmations({scriptApproved:false},{scriptApproved:false}).scriptApproved,false);
 assert.equal(api.preserveCanvasConfirmations(undefined,{scriptApproved:false}).scriptApproved,false);
 assert.equal(api.preserveCanvasConfirmations({scriptApproved:true},{scriptApproved:true}).scriptApproved,true);
});

test('素材反绑到制作段：接上的算准备到位，没接上的单独列出来',()=>{
 const doc={edges:[
  {id:'e1',fromNode:'ref',toNode:'seg1',toPort:'ref'},
  {id:'e2',fromNode:'import1',toNode:'seg2',toPort:'frame'},
 ],nodes:{
  seg1:{id:'seg1',type:'video',data:{label:'第1段'}},
  seg2:{id:'seg2',type:'video',data:{label:'第2段'}},
  // 参考图节点是素材节点，不算制作段；它产出的图顺着它找下游的段。
  ref:{id:'ref',type:'image',data:{label:'参考图',[api.MATERIAL_MARK]:true,metaonticSegmentOf:'seg1'}},
  refOut:{id:'refOut',type:'image',metaonticSourceNode:'ref',data:{assetId:'a-ref'}},
  import1:{id:'import1',type:'image',data:{assetId:'a-import',metaonticSegmentOf:'seg2'}},
  lonely:{id:'lonely',type:'image',data:{assetId:'a-lonely'}},
 }};
 assert.deepEqual(api.canvasSegments(doc).map(node=>node.id),['seg1','seg2'],'素材节点与导入素材都不算制作段');
 const links=Object.fromEntries(api.canvasAssetLinks(doc).map(link=>[link.nodeId,link.segments]));
 assert.deepEqual(links,{refOut:['seg1'],import1:['seg2'],lonely:[]});
 const stats=api.canvasSegmentStats(doc);
 assert.equal(stats.total,2);
 assert.equal(stats.assets,3);
 assert.equal(stats.assetsBound,2);
 assert.equal(stats.assetsOrphan,1);
 // 阶段卡④把没接上的张数说清楚，但已有素材时不挡流程。
 const stages=byKey(api.stageSummary(facts({choice:'generate_first',scriptDrafted:true,scriptApproved:true,segmentTotal:2}),stats));
 assert.equal(stages.assets.state,'done');
 assert.match(stages.assets.text,/素材图：3 张（角色图 \/ 首帧 \/ 参考图），其中 1 张还没接到制作段/);
 // 没有 assetsBound 这个字段时退回旧文案，不凭空报「没接上」。
 assert.match(byKey(api.stageSummary(facts({choice:'generate_first'}),{total:2,produced:0,shots:0,assets:2})).assets.text,/素材图：2 张（角色图 \/ 首帧 \/ 参考图）$/);
});

test('就绪度体检：缺成果的段、没接上的素材、断链与成片对不上都列出来',()=>{
 const clean={nodes:{seg1:{id:'seg1',type:'video',data:{label:'第1段'}},ok:{id:'ok',type:'video',metaonticSourceNode:'seg1',data:{assetId:'a1'}}}};
 assert.deepEqual(api.canvasReadiness(clean),[]);

 const doc={film:{assetId:'f1',count:2},edges:[
  {id:'e1',fromNode:'seg1',toNode:'ghost',toPort:'out'},
 ],nodes:{
  seg1:{id:'seg1',type:'video',data:{label:'第1段'}},
  seg2:{id:'seg2',type:'video',data:{label:'第2段'}},
  ok:{id:'ok',type:'video',metaonticSourceNode:'seg1',metaonticCreatedAt:1,data:{assetId:'a1'}},
  lonely:{id:'lonely',type:'image',data:{assetId:'a-lonely',label:'角色图'}},
 }};
 const issues=api.canvasReadiness(doc);
 const codes=issues.map(item=>item.code);
 assert.deepEqual(codes,['DANGLING_EDGE','SEGMENT_MISSING_OUTPUT','ORPHAN_ASSET','FILM_STALE']);
 assert.equal(issues[0].severity,'error');
 assert.match(issues[0].suggestedAction,/断开|重新连/);
 assert.match(issues[1].message,/制作段「第2段」还没有成果/);
 assert.match(issues[1].suggestedAction,/确认费用/);
 assert.match(issues[2].message,/素材图「角色图」还没接到任何制作段/);
 assert.match(issues[3].message,/已合成的成片是 2 段，画布上现在的视频成果有 1 段/);
 // 成片段数跟已有视频成果一致时不再提示；没有成片也不提示。
 assert.equal(api.canvasReadiness({nodes:{seg1:{id:'seg1',type:'video',data:{}},ok:{id:'ok',type:'video',metaonticSourceNode:'seg1',data:{assetId:'a1'}}}}).length,0);
});

test('画面节点：走流程、不算制作段，出图前体检提醒先出图',()=>{
 const doc={nodes:{
  frame:{id:'frame',type:'image',data:{label:'第1段 · 画面',prompt:'海边日出',[api.FRAME_MARK]:'v1'}},
  v1:{id:'v1',type:'video',data:{label:'第1段 · 15秒'}},
 },edges:[{id:'e1',fromNode:'frame',toPort:'out',toNode:'v1',toPort:'frame'}]};
 assert.deepEqual(api.flowAuthors(doc).map(node=>node.id),['frame','v1'],'画面节点跟着创作流程走');
 assert.deepEqual(api.canvasSegments(doc).map(node=>node.id),['v1'],'画面节点不算制作段');
 const missing=api.canvasReadiness(doc);
 assert.deepEqual(missing.map(item=>item.code),['SEGMENT_MISSING_OUTPUT','FRAME_MISSING_IMAGE']);
 const frameItem=missing.find(item=>item.code==='FRAME_MISSING_IMAGE');
 assert.equal(frameItem.severity,'warning');
 assert.match(frameItem.message,/画面「第1段 · 画面」还没有出图/);
 assert.match(frameItem.suggestedAction,/先点这个画面节点的「制作」出一张图/);
 assert.match(frameItem.suggestedAction,/单独计费并要审核/);
 // 画面出图后：画面节点自己不再提示，成果作为素材接给这一段。
 const made={...doc,nodes:{...doc.nodes,
  frameOut:{id:'frameOut',type:'image',metaonticSourceNode:'frame',data:{assetId:'a-frame',label:'MetaOntic · 第1段画面'}}}};
 assert.deepEqual(api.canvasReadiness(made).map(item=>item.code),['SEGMENT_MISSING_OUTPUT'],'画面出图后只等视频段成果');
 assert.deepEqual(api.canvasAssetLinks(made).map(link=>[link.nodeId,link.segments]),[['frameOut',['v1']]],'画面成果反绑到它服务的段');
});

test('素材反绑与体检都不碰费用口径：只读画布内容，不产生计费动作',()=>{
 const doc={nodes:{seg1:{id:'seg1',type:'video',data:{label:'第1段'}},
  lonely:{id:'lonely',type:'image',data:{assetId:'a-lonely'}}}};
 const list=[...api.canvasReadiness(doc),...api.canvasAssetLinks(doc)];
 assert.deepEqual(list.map(item=>item.code||'segments'),['SEGMENT_MISSING_OUTPUT','ORPHAN_ASSET','segments']);
 for(const item of api.canvasReadiness(doc)) assert.doesNotMatch(String(item.suggestedAction),/扣费|自动生成|自动开始/);
});

test('体检不漏报：来源节点已删的视频成果要被点名，成片与空画布的建议不能互相矛盾',()=>{
 // 整段被删后留下的视频成果：既不算制作段，也进不了成片，得单独说出来。
 const orphan=api.canvasReadiness({nodes:{r1:{id:'r1',type:'video',metaonticSourceNode:'gone',data:{assetId:'a1',label:'第2段成果'}}}});
 assert.deepEqual(orphan.map(item=>item.code),['ORPHAN_RESULT']);
 assert.equal(orphan[0].severity,'info');
 assert.match(orphan[0].message,/成果「第2段成果」对应的制作段已被删除/);
 assert.match(orphan[0].suggestedAction,/不会进入成片/);
 // 图片成果交给 ORPHAN_ASSET，不重复报。
 assert.deepEqual(api.canvasReadiness({nodes:{i:{id:'i',type:'image',metaonticSourceNode:'gone',data:{assetId:'a1',label:'角色图'}}}}).map(item=>item.code),['ORPHAN_ASSET']);
 // 成果的来源节点还在时不报。
 assert.deepEqual(api.canvasReadiness({nodes:{v1:{id:'v1',type:'video',data:{}},r1:{id:'r1',type:'video',metaonticSourceNode:'v1',data:{assetId:'a1'}}}}),[]);

 // 成片还在但视频段已经全没了：不能再劝用户「每段都出成果后重新合成」，那样合并没有输入会直接报错。
 const empty=api.canvasReadiness({film:{assetId:'f1',count:2},nodes:{}});
 assert.deepEqual(empty.map(item=>item.code),['FILM_STALE']);
 assert.match(empty[0].suggestedAction,/已经没有视频制作段/);
 assert.doesNotMatch(empty[0].suggestedAction,/每段都出成果后重新点/);
 // 还留着段但成果不全：给的是重新合成的建议。
 const partial=api.canvasReadiness({film:{assetId:'f1',count:2},nodes:{v1:{id:'v1',type:'video',data:{label:'第1段'}}}});
 assert.match(partial.find(item=>item.code==='FILM_STALE').suggestedAction,/重新点「合成成片」/);
});

test('走完整条流程的画布不误报：素材接到段、每段有成果、成片段数对得上',()=>{
 const doc={film:{assetId:'f1',count:2},edges:[
  {id:'e1',fromNode:'ref',toNode:'v1',toPort:'ref'},
  {id:'e2',fromNode:'imp',toNode:'v2',toPort:'frame'},
 ],nodes:{
  ref:{id:'ref',type:'image',data:{label:'参考图',metaonticMaterial:true,metaonticSegmentOf:'v1'}},
  refOut:{id:'refOut',type:'image',metaonticSourceNode:'ref',data:{assetId:'a-ref'}},
  imp:{id:'imp',type:'image',data:{label:'角色图.png',assetId:'a-imp',metaonticSegmentOf:'v2'}},
  board:{id:'board',type:'storyboard',data:{shots:[{index:1},{index:2}]}},
  v1:{id:'v1',type:'video',data:{label:'第1段'}},v2:{id:'v2',type:'video',data:{label:'第2段'}},
  r1:{id:'r1',type:'video',metaonticSourceNode:'v1',metaonticCreatedAt:1,data:{assetId:'a1'}},
  r2:{id:'r2',type:'video',metaonticSourceNode:'v2',metaonticCreatedAt:2,data:{assetId:'a2'}},
 }};
 assert.deepEqual(api.canvasReadiness(doc),[],'走完流程的画布不该有任何体检项');
 const stats=api.canvasSegmentStats(doc);
 assert.equal(stats.total,2,'素材节点不算制作段');
 assert.equal(stats.produced,2);
 assert.equal(stats.shots,2);
 assert.equal(stats.assets,2);
 assert.equal(stats.assetsBound,2);
 assert.equal(stats.assetsOrphan,0);
 // 删掉第2段成果：只剩缺成果与成片对不上这两条。
 const cut={...doc,nodes:{...doc.nodes}};delete cut.nodes.r2;
 assert.deepEqual(api.canvasReadiness(cut).map(item=>item.code),['SEGMENT_MISSING_OUTPUT','FILM_STALE']);
});
