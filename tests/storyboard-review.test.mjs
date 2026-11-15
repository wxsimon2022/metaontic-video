import {sourceOf} from './source.mjs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import path from 'node:path';
import {mkdtemp,writeFile,readdir,stat,rm,utimes} from 'node:fs/promises';
import os from 'node:os';
const dir=await mkdtemp(path.join(os.tmpdir(),'storyboard-review-'));
const image=path.join(dir,'storyboard v1.png');await writeFile(image,'fixture');after(()=>rm(dir,{recursive:true,force:true}));
function setup(logged=[]){
 const ctx=vm.createContext({path,readdir,stat,process,appendRequestLog:async entry=>{logged.push(entry);}});vm.runInContext(sourceOf('businesses/video/workflow/storyboard-review'),ctx);
 const guard=ctx.createStoryboardReviewGuard({log:async entry=>{logged.push(entry);}}),session={header:{cwd:dir}};
 const observe=(type,data)=>guard.observe(session,{type,data:{turn:1,...data}});
 const exec={name:'ask_user_question',agent:{session},arguments:{questions:[{id:'script_review_v1',question:'这版脚本可以吗？'}]}};
 observe('tool/call',{name:'video_estimate'});
 const present=()=>observe('deliverables/presented',{files:[{path:image}]});
 const body=(text,type='text')=>observe('assistant/message',{message:{content:[{type,text}]}});
 // 模块顶层 const/function 不挂在 vm 全局对象上，只能在同一 context 里求值取回。
 const coverage=vm.runInContext('scriptCoverage',ctx),minCoverage=vm.runInContext('SCRIPT_COVERAGE_MIN',ctx);
 return {guard,session,exec,observe,present,body,logged,ctx,coverage,minCoverage};
}
/** 本版脚本与助手实际发出去的展示版：只差排版（标题整理、加「· 第 1 版」、少一处括注）。 */
const SCRIPT = [
 '# 民勤·沙线（45 秒宣传短片）',
 '**一句话钩子**：风把沙推成流动的墙，镜头落下来——一条绿线正把沙海缝住。',
 '## 一、故事方案（在原有创意上完善的细节）',
 '- **看点（0–3 秒）**：满屏流沙贴着沙脊跑；第 3 秒镜头落到沙面，出现一双沾沙的手。',
 '## 二、规格、风格与声音',
 '| 项目 | 内容 |',
 '| --- | --- |',
 '| 总时长 | 45 秒（3 段 × 15 秒续拍，连贯推进） |',
 '| 画幅 | 16:9 横屏 |',
 '| 清晰度 | 480P |',
 '| 画面风格 | 电影质感：低饱和调色，暖金沙色与冷青绿对比 |',
 '## 三、分镜表',
 '| 镜头 | 时间 | 景别 / 运镜 | 画面 |',
 '| --- | --- | --- | --- |',
 '| 1 | 0–3 秒 | 大远景 / 低角度横移 | 清晨侧逆光，沙粒贴着沙丘脊线流成一道流沙雾 |',
 '| 2 | 3–6 秒 | 微距—近景 / 固定 | 治沙人蹲着挖浅坑，双手把梭梭苗放进坑里 |',
 '| 3 | 6–9 秒 | 近景 / 固定、浅景深 | 双手把湿沙按实再浇水，沙面陷出一处深色圆点 |',
 '## 四、逐段提示词',
 '第 1 段：清晨沙丘，一双沾沙的手把梭梭苗按进沙里并浇水，镜头缓慢上升。',
 '第 2 段：承接上一段结尾，镜头拉远露出成片草方格与成排林带连成一条绿线。',
 '第 3 段：承接上一段结尾，越过林带升起，黄昏的青土湖、芦苇与水鸟，收在治沙人背影。',
 '## 五、费用预估',
 '火山官方方案与 MetaOnticVideo 方案约 ¥3.6，续拍含上一段完整视频输入，按渠道账单结算。',
].join('\n');
const POLISHED = SCRIPT
 .replace('# 民勤·沙线（45 秒宣传短片）', '# 民勤·沙线（45 秒宣传短片）· 第 1 版')
 .replace('（在原有创意上完善的细节）', '')
 .replace(/^\| --- \| --- \|$/gm, '')
 .replace('出现一双沾沙的手。', '出现一双沾沙的手——最荒的地方在做最细的活。')
 + '\n本版按 3 段续拍，共 3 次生成，每次 15 秒，合计 45 秒；上方费用为预估值，实际以账单为准。';
function withScript(text, opts={}) {
 const h=setup();
 h.present();
 h.body(`${text}\n![分镜](<${image}>)`);
 h.reviewArguments={questions:[{id:'script_review_v1',question:'这版脚本可以吗？'}],requireStoryboard:true,requiredScriptText:SCRIPT,...opts};
 return h;
}
test('助手整理排版后的展示版仍算「已完整展示」：不再误拦审核（真实事故回归）',async()=>{
 const h=withScript(POLISHED);
 const coverage=h.coverage(SCRIPT,POLISHED);
 assert.ok(coverage>=h.minCoverage,`整理版覆盖率应达标，实际 ${coverage}`);
 assert.equal(await h.guard.gate({...h.exec,arguments:h.reviewArguments}),null);
});
test('只展示分镜表或摘要仍被拦下，理由带上覆盖率并记进请求日志',async()=>{
 const section=SCRIPT.split('## 三、分镜表')[1].split('## 四')[0];
 for (const [text,label] of [[`## 三、分镜表${section}`,'只有分镜表'],['本版脚本要点：沙、苗、草方格、林带、青土湖，详情见 script.md。','只有摘要']]) {
  const h=withScript(text);
  const decision=await h.guard.gate({...h.exec,arguments:h.reviewArguments});
  assert.equal(decision.kind,'deny',`${label}不该放行`);
  assert.match(decision.reason,/只在本轮用户可见正文里出现 \d+%/);
  assert.match(decision.reason,/不要改写措辞、删段/);
  const blocked=h.logged.filter(entry=>entry.event==='storyboard_review_blocked');
  assert.equal(blocked.at(-1).reason,'script_text_mismatch');
  assert.ok(blocked.at(-1).coverage<h.minCoverage);
 }
});
test('覆盖率只看用户读到的字：排版与解说都不算差异，空脚本不拦',()=>{
 const h=setup();
 const cov=h.coverage;
 assert.equal(cov('','什么都没展示'),1);
 assert.equal(cov(SCRIPT,`# 标题\n\n${SCRIPT}`),1,'多出标题与空行不影响');
 assert.ok(cov(SCRIPT,SCRIPT.replace(/[*#|]/g,''))>=h.minCoverage,'去掉 Markdown 标记不影响');
 assert.ok(cov(SCRIPT,`${SCRIPT}\n${'另外补充一句解说，按账单结算。'.repeat(20)}`)>=h.minCoverage,'补解说反而更全');
 assert.ok(cov(SCRIPT,SCRIPT.slice(0,120))<h.minCoverage,'只贴开头要拦');
});
test('present success without inline body blocks review (actual incident sequence)',async()=>{
 const h=setup();h.present();h.body('分镜示意图已画好：8 个镜头与三段过渡都标在图上。');
 const decision=await h.guard.gate(h.exec);assert.equal(decision.kind,'deny');assert.match(decision.reason,/正文里内嵌展示/);
});
test('missing present blocks review even if image is mentioned in plain text',async()=>{
 const h=setup();h.body(image);assert.equal((await h.guard.gate(h.exec)).kind,'deny');
});
test('reasoning and tool image reads do not prove the user saw the image',async()=>{
 const h=setup();h.present();h.body(`![图](<${image}>)`,'reasoning');assert.equal((await h.guard.gate(h.exec)).kind,'deny');
});
test('present followed by actual visible inline Markdown allows review',async()=>{
 const h=setup();h.present();h.body(`![分镜](<${image}>)\n[打开原图](<${image}>)`);assert.equal(await h.guard.gate(h.exec),null);
});
test('改稿后只展示旧版分镜图会被拦下（同目录已有更新的图）',async()=>{
 const sub=await mkdtemp(path.join(os.tmpdir(),'storyboard-stale-'));
 const old=path.join(sub,'storyboard v1.png');await writeFile(old,'fixture');
 const newer=path.join(sub,'storyboard v2.png');await writeFile(newer,'fixture');
 const later=new Date(Date.now()+5000);await utimes(newer,later,later);
 const logged=[];
 const ctx=vm.createContext({path,readdir,stat,process,appendRequestLog:async entry=>{logged.push(entry);}});
 vm.runInContext(sourceOf('businesses/video/workflow/storyboard-review'),ctx);
 const guard=ctx.createStoryboardReviewGuard({log:async entry=>{logged.push(entry);}}),session={header:{cwd:sub}};
 const observe=(type,data)=>guard.observe(session,{type,data:{turn:1,...data}});
 observe('tool/call',{name:'video_estimate'});
 observe('assistant/message',{message:{content:[{type:'text',text:`![分镜](<${old}>)`}]}});
 const exec={name:'ask_user_question',agent:{session},arguments:{questions:[{id:'script_review_v1',question:'这版脚本可以吗？'}]}};
 const decision=await guard.gate(exec);
 assert.equal(decision.kind,'deny');
 assert.match(decision.reason,/新版分镜图还没展示/);
 assert.ok(decision.reason.includes(newer));
 await rm(sub,{recursive:true,force:true});
});
test('old turns and other sessions cannot satisfy the current review',async()=>{
 const h=setup();h.present();h.body(`![图](<${image}>)`);
 h.observe('tool/call',{turn:2,name:'video_estimate'});assert.equal((await h.guard.gate(h.exec)).kind,'deny');
 const another={...h.exec,agent:{session:{}}};assert.equal(await h.guard.gate(another),null);
});
test('ordinary questions and video production confirmation remain unaffected',async()=>{
 const h=setup();h.present();
 assert.equal(await h.guard.gate({...h.exec,arguments:{questions:[{question:'选择480P还是720P？'}]}}),null);
 assert.equal(await h.guard.gate({...h.exec,name:'video_generate'}),null);
});

test('turn ending right after the script body is logged as a missing review ask',async()=>{
 const h=setup();h.present();h.body(`![分镜](<${image}>)`);
 h.observe('turn/end',{});
 assert.deepEqual(h.logged.map(entry=>entry.event),['storyboard_review_missing']);
});
test('review asked in the same turn is not reported missing',async()=>{
 const h=setup();h.present();h.body(`![分镜](<${image}>)`);
 assert.equal(await h.guard.gate(h.exec),null);
 h.observe('turn/end',{});
 assert.equal(h.logged.some(entry=>entry.event==='storyboard_review_missing'),false);
});
test('next turn without review ask is reported missing too',async()=>{
 const h=setup();h.body(`![分镜](<${image}>)`);
 h.observe('tool/call',{turn:2,name:'video_estimate'});
 assert.deepEqual(h.logged.map(entry=>entry.event),['storyboard_review_missing']);
});
