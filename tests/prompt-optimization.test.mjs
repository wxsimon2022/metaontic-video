import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const api=vm.createContext({structuredClone,FORWARD_TRANSITION:'FORWARD_DEFAULT',CLOSEUP_TRANSITION:'CLOSEUP_DEFAULT',CONTINUOUS_TRANSITION:'CONTINUOUS_DEFAULT',isOmniExtendModel:()=>false});
vm.runInContext(sourceOf('app/prompt-scope','businesses/film-production/contracts/fields','businesses/film-production/roles/runtime-contract','businesses/film-production/prompts/guidance','businesses/video-generation/prompts/generation')+'\nObject.assign(globalThis,{createPromptScope,submissionContract,runtimeContract,FILM_WORKFLOW_GUIDANCE,buildExtensionPrompt,buildGenerationPrompt});',api);
test('角色和提交契约不向创意、编剧注入资产字段或审核评分规则',()=>{
 for(const role of ['creative','screenwriter','storyboard','prompt-engineer'])assert.doesNotMatch(api.runtimeContract(role),/终审scores每个|score_evidence|assets 顶层必须/);
 for(const stage of ['creative','script','review'])assert.doesNotMatch(api.submissionContract(stage).instructions,/五个数组|分镜 costume_ids/);
 assert.match(api.runtimeContract('creative'),/structure每段含purpose和visual_evidence/);
 assert.match(api.runtimeContract('screenwriter'),/每场含scene_goal/);
 assert.match(api.runtimeContract('reviewer'),/score_evidence/);
 assert.match(api.submissionContract('assets').instructions,/五个数组/);
 assert.match(api.submissionContract('shots').instructions,/costume_ids/);
});
test('章节和正文来源按项目策略决定，不要求章节项目重提整片',()=>{
 assert.match(api.FILM_WORKFLOW_GUIDANCE,/canonical_v1.*screenplay由工具渲染、可以省略/);
 assert.match(api.FILM_WORKFLOW_GUIDANCE,/达到600秒.*chapter_submit.*不重新submit整片聚合对象/);
 assert.match(api.FILM_WORKFLOW_GUIDANCE,/历史非章节项目沿其submit契约/);
 assert.doesNotMatch(api.FILM_WORKFLOW_GUIDANCE,/分批创作但按当前工具提交完整阶段聚合对象/);
});
for(const direction of ['forward','backward'])test(`${direction}续拍：保留批准内容，静音不带对白执行要求`,()=>{
 const prompt='女孩说{明天见。}【无字幕】';
 const text=api.buildExtensionPrompt({prompt,seconds:15,mode:'continuous',direction,generateAudio:false});
 assert.ok(text.includes(prompt));assert.match(text,/关闭音频，不生成对白、环境声或配乐/);
 assert.doesNotMatch(text,/一人说完另一人再接|保持角色音色一致|【对白执行】/);
 assert.equal((text.match(/【过渡画面】/g)||[]).length,1);
 assert.ok(text.length<800,'默认规则长度受控，不在多个段落重复声音要求');
});
test('空镜使用简短声音约束，含对白时加载完整发音契约且保留原文',()=>{
 const plain=api.buildGenerationPrompt({prompt:'沙漠日落，无对白',seconds:15});
 assert.doesNotMatch(plain,/一人说完另一人再接|发音文本映射/);
 assert.match(plain,/无对白时不新增人声/);
 const prompt='她说{欢迎来到吃龙山。}字幕为〖欢迎来到螭龙山。〗';
 const voiced=api.buildGenerationPrompt({prompt,seconds:15});
 assert.ok(voiced.includes(prompt));assert.match(voiced,/发音文本映射|一人说完另一人再接/);
 const unmarked=api.buildGenerationPrompt({prompt:'男人轻声说：明天见。',seconds:15});
 assert.match(unmarked,/一人说完另一人再接/,'未使用花括号的自然语言对白仍保留执行约束');
 const silent=api.buildGenerationPrompt({prompt,seconds:15,generateAudio:false});
 assert.ok(silent.includes(prompt));assert.doesNotMatch(silent,/【对白执行】/);
});
test('会话阶段只由成功的工具结果更新，兼容header.id和匿名会话',()=>{
 const scope=api.createPromptScope();const current={agent:{session:{header:{id:'a'}}}};
 scope.observe('film_project',{action:'create'},{project_id:'one'},current);
 assert.equal(scope.read({agent:{session:{header:{id:'a'}}}}),'creation');
 assert.equal(scope.read({agent:{session:{id:'b'}}}),'production');
 scope.observe('video_project',{action:'prepare'},{status:'blocked'},current);
 assert.equal(scope.read(current),'creation');
 scope.observe('film_project',{action:'compile'},{production:{videoProjectId:'video-one'}},current);
 assert.equal(scope.read(current),'production');
 const anonymous={agent:{session:{}}};scope.observe('film_project',{action:'read'},{revision:1},anonymous);
 assert.equal(scope.read(anonymous),'creation');
});

 test('默认短片走完整方案一次审核，专业旧项目与独立终审保持明确边界',()=>{
 assert.match(api.FILM_WORKFLOW_GUIDANCE,/新建15–60秒短片默认用video_project直接制作/);
 assert.match(api.FILM_WORKFLOW_GUIDANCE,/超过60秒.*专业分阶段或独立终审.*已有film_project/);
 assert.match(api.FILM_WORKFLOW_GUIDANCE,/不将旧项目静默切换或自动批准/);
 assert.doesNotMatch(api.FILM_WORKFLOW_GUIDANCE,/目标15–3600秒时优先使用film_project/);
 });
