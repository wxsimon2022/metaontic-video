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
 for(const text of ['### 故事结构','#### 1. 沙与绿洲｜0–4 秒','#### 2. 晨光里的果｜4–9.5 秒','#### 3. 时长未定｜时长待确认','#### 4. 后续段落｜1 秒','**发生什么**','风推起薄沙','横移到温室','**这一段的作用**：交代产地反差','**观众能看到**：沙丘与温室同框','**情绪变化**：好奇','**如何接下一段**：沿水管进入植株','保持缓慢横移','段落编号：S1'])assert.ok(markdown.includes(text),text);
 for(const text of ['**标题**','**段落 1**','**时长**'])assert.ok(!markdown.includes(text),text);
 assert.deepEqual(data,before);
});
