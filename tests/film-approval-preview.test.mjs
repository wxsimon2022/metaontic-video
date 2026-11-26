import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/businesses/film-production/approvals/approval.presenter.ts';",resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {approvalPreview,approvalMaterial}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
test('创意审批卡片只确认版本，不重复渲染已在聊天展示的提案',()=>{
 const artifact={revision:7,data:{creative_id:'c1',theme:'放下比较',logline:'一个选择',structure:[{section_id:'sec1',duration_ms:15000,beats:['先观察','再决定'],visual_evidence:['手指松开存折'],emotion:'释然'}],must_preserve:['保留结局'],assumptions:[],feasibility_risks:['口型待验证'],approval_questions:['是否保留原对白？'],recommended_direction:'完整保留最后的选择'}};
 const before=structuredClone(artifact);const text=approvalPreview('creative',artifact);
 for(const content of ['修订 7','完整方案应已在当前对话正文展示','回看并按该版本作出决定','先由助手补充展示','不重复渲染提案'])assert.ok(text.includes(content),content);
 for(const content of ['放下比较','先观察','手指松开存折','口型待验证','完整保留最后的选择','creative_id','"structure"'])assert.ok(!text.includes(content),content);
 assert.deepEqual(artifact,before);
});
test('剧本审批展示完整正文与时间资料，不用摘要代替待批准全文',()=>{
 const screenplay='# 河岸\n\n'+ '人物停下手中的动作。'.repeat(1000)+'\n角色：我们回家吧。';
 const artifact={revision:9,data:{screenplay,chapters:[{chapter_id:'CHAPTER_001',duration_ms:30000}],research_flags:['地名待核实']}};
 const text=approvalMaterial('script',artifact).approval_material.markdown;
 assert.ok(!approvalPreview('script',artifact).includes(screenplay),'审批卡不再次放入完整剧本');
 assert.ok(text.includes(screenplay));assert.ok(text.includes('30 秒'));assert.ok(text.includes('地名待核实'));assert.ok(!text.includes('"screenplay":'));
});
