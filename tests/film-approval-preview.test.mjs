import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/businesses/film-production/approvals/approval.presenter.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {approvalPreview}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
test('创意审批包含嵌套内容、风险和全部结尾，不显示原始JSON和运行元数据',()=>{
 const artifact={revision:7,data:{creative_id:'c1',theme:'放下比较',logline:'一个选择',structure:[{section_id:'sec1',duration_ms:15000,beats:['先观察','再决定'],visual_evidence:['手指松开存折'],emotion:'释然'}],must_preserve:['保留结局'],assumptions:[],feasibility_risks:['口型待验证'],approval_questions:['是否保留原对白？'],recommended_direction:'完整保留最后的选择'}};
 const before=structuredClone(artifact);const text=approvalPreview('creative',artifact);
 for(const content of ['修订 7','放下比较','15 秒','先观察','再决定','手指松开存折','保留结局','口型待验证','是否保留原对白？','完整保留最后的选择'])assert.ok(text.includes(content),content);
 assert.ok(!text.includes('creative_id'));assert.ok(!text.includes('"structure"'));assert.deepEqual(artifact,before);
});
test('剧本审批展示完整正文与时间资料，不用摘要代替待批准全文',()=>{
 const screenplay='# 河岸\n\n'+ '人物停下手中的动作。'.repeat(1000)+'\n角色：我们回家吧。';
 const text=approvalPreview('script',{revision:9,data:{screenplay,chapters:[{chapter_id:'CHAPTER_001',duration_ms:30000}],research_flags:['地名待核实']}});
 assert.ok(text.includes(screenplay));assert.ok(text.includes('30 秒'));assert.ok(text.includes('地名待核实'));assert.ok(!text.includes('"screenplay":'));
});
