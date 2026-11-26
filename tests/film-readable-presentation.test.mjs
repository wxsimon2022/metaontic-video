import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
const result=await build({stdin:{contents:"export * from './src/businesses/film-production/approvals/approval.presenter.ts';export * from './src/businesses/film-production/artifacts/artifact.repository.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {readable,approvalMaterial,renderDeliverables}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
test('六类创作要点均使用中文标签，正文与机器数据保持原样',async()=>{
 for(const profile of ['drama','comedy','lifestyle','documentary','commercial','promotional']){
  const source=await readFile(`src/businesses/film-production/profiles/legacy/${profile}.ts`,'utf8');
  for(const group of ['creative_fields','script_fields']){
   const fields=JSON.parse('{'+source.match(new RegExp('"'+group+'": \\{([^}]+)\\}'))[1]+'}');
   const data={type_details:Object.fromEntries(Object.keys(fields).map(key=>[key,'沙葱的鲜，落在家常饭桌上。']))};
   const before=structuredClone(data);const text=readable(data);
   for(const key of Object.keys(fields))assert.ok(!text.includes(key)&&!text.includes('补充说明'),key);
   assert.ok(text.includes('沙葱的鲜，落在家常饭桌上。'));assert.deepEqual(data,before);
  }
 }
});
test('正文、审批、导出统一中文排版；扩展字段内容不丢失，引用和原文不误译',()=>{
 const data={type_details:{recognizable_identity:'黄沙与翠绿',emotional_anchor:'家常饭桌'},scenes:[{scene_id:'SC_01',scene_goal:'展示鲜嫩',duration_ms:5000,key_actions:['掐断沙葱']}],review_status:'PASS_WITH_WARNINGS',scores:{narrative_quality:8},issues:[{severity:'MAJOR',status:'OPEN',description:'核实地名'}],custom_note:'保留扩展说明',prompt:'OPEN / https://example.com',exact_text:'PASS'};
 const original=structuredClone(data);
 const approval=approvalMaterial('creative',{revision:1,data}).approval_material.markdown;
 const exported=renderDeliverables({title:'沙葱',project_id:'p1',revision:1,artifacts:{creative:{revision:1,data}}});
 for(const output of [approval,exported]){
  for(const key of ['recognizable_identity','emotional_anchor','scene_goal','narrative_quality','PASS_WITH_WARNINGS','custom_note'])assert.ok(!output.includes(key),key);
  for(const text of ['### 类型创作要点','**辨识特征**：黄沙与翠绿','**情绪落点**：家常饭桌','5 秒','核实地名','保留扩展说明','SC_01','OPEN / https://example.com','PASS'])assert.ok(output.includes(text),text);
 }
 assert.deepEqual(data,original);
});

test('故事结构按累计时间和标题分段，完整保留剧情与依据，未知时长不编造时间轴',()=>{
 const structure=[{section_id:'S1',title:'沙与绿洲',duration_ms:4000,purpose:'交代产地反差',beats:['风推起薄沙','横移到温室'],visual_evidence:'沙丘与温室同框',emotion:'好奇',transition_logic:'沿水管进入植株',custom_note:'保持缓慢横移'},
  {section_id:'S2',title:'晨光里的果',duration_ms:5500,beats:['托住果实']},{section_id:'S3',title:'时长未定',beats:['留在枝头']},{section_id:'S4',title:'后续段落',duration_ms:1000,beats:['光线落在叶片上']}];
 const data={structure},before=structuredClone(data);const markdown=readable(data);
 for(const text of ['### 故事结构','#### 1. 沙与绿洲｜0–4 秒','#### 2. 晨光里的果｜4–9.5 秒','#### 3. 时长未定｜时长待确认','#### 4. 后续段落｜1 秒','**发生什么**','风推起薄沙','横移到温室','**这一段的作用**：交代产地反差','**观众能看到**：沙丘与温室同框','**情绪变化**：好奇','**如何接下一段**：沿水管进入植株','保持缓慢横移'])assert.ok(markdown.includes(text),text);
 for(const text of ['**标题**','**段落 1**','**时长**','段落编号：S1'])assert.ok(!markdown.includes(text),text);
 assert.deepEqual(data,before);
});

test('结构化剧本按中文场景和累计时间展示，核对资料不重复正文，历史正文仍兼容',()=>{
 const data={document_source:'structured_script_v1',screenplay:'# 修椅子\n\n旧版排版',synopsis:'父女一起修好椅子。',characters:[{character_id:'CHAR_1',name:'父亲',age:'五十岁'}],chapters:[{chapter_id:'CH_1',title:'修好再坐',duration_ms:15000,scene_ids:['SC_1']}],scenes:[{scene_id:'SC_1',chapter_id:'CH_1',location_id:'LOC_1',title:'院里的旧椅子',duration_ms:15000,scene_goal:'修稳椅子',entry_state:'椅子摇晃',exit_state:'椅子稳住',key_actions:['扶住椅背','拧紧螺丝'],beats:[{action:'扶住椅背'},{dialogue_ref:'D_1'},{action:'拧紧螺丝'}],custom_note:'保留手部特写的拍摄提醒'}],dialogue:[{dialogue_id:'D_1',scene_id:'SC_1',speaker_id:'CHAR_1',exact_text:'先别坐。'}],research_flags:['旧木椅结构待核实']};
 const before=structuredClone(data);const artifact={revision:3,data};
 const text=approvalMaterial('script',artifact).approval_material.markdown;
 assert.match(text,/场景 1 · 院里的旧椅子｜0–15 秒/);assert.match(text,/15 秒 · 1 个章节 · 1 个场景/);
 for(const content of ['扶住椅背','先别坐。','拧紧螺丝'])assert.equal(text.split(content).length-1,1,content+'只展示一次');
 assert.ok(text.indexOf('扶住椅背')<text.indexOf('先别坐。'));assert.ok(text.indexOf('先别坐。')<text.indexOf('拧紧螺丝'));
 for(const content of ['修稳椅子','椅子摇晃','椅子稳住','保留手部特写的拍摄提醒','旧木椅结构待核实','五十岁'])assert.ok(text.includes(content),content);
 assert.doesNotMatch(text,/SC_1|CH_1|LOC_1|CHAR_1|地点待细化|旧版排版|剧本核对资料/);
 assert.ok(renderDeliverables({title:'修椅子',revision:3,project_id:'p',artifacts:{script:artifact}}).includes('场景 1 · 院里的旧椅子'));
 assert.deepEqual(data,before);
});

 test('最新兰州稿的历史字段别名不泄露编号，列表紧凑且保留补充资料',()=>{
 const data={document_source:'structured_script_v1',screenplay:'# 兰州清晨',characters:[{character_id:'char_laoren',name:'老人'}],chapters:[{chapter_id:'ch01',title:'清晨',duration_ms:5000,scene_ids:['sc01']}],scenes:[{scene_id:'sc01',chapter_id:'ch01',loc_id:'loc_01',time:'清晨',characters:['char_laoren'],duration_ms:5000,scene_goal:'触摸历史',entry_state:'老人走上桥头',exit_state:'手掌离开铁桥',key_actions:['抬手触桥','继续前行']}],dialogue:[]};
 const before=structuredClone(data),text=approvalMaterial('script',{revision:1,data}).approval_material.markdown;
 assert.match(text,/场景 1｜0–5 秒/);assert.match(text,/环境.*清晨/);assert.match(text,/- 老人/);
 assert.doesNotMatch(text,/loc_01|char_laoren|画面与行动|补充说明.*清晨/);
 assert.ok(text.includes('触摸历史'));assert.ok(text.includes('老人走上桥头'));assert.deepEqual(data,before);
 assert.equal(readable(['第一项','第二项']),'- 第一项\n- 第二项');
 });
