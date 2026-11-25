import './no-network-analytics.mjs';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { test } from 'node:test';
import * as plugin from '../dist/index.js';

// Harness only accepts scalar type strings; nullable unions must use oneOf.
function assertScalarSchemaTypes(schema) {
  if (!schema || typeof schema !== 'object') return;
  if (Object.hasOwn(schema, 'type')) assert.equal(typeof schema.type, 'string', 'Harness rejects type arrays');
  for (const child of Object.values(schema.properties || {})) assertScalarSchemaTypes(child);
  if (schema.items) assertScalarSchemaTypes(schema.items);
  for (const child of schema.oneOf || []) assertScalarSchemaTypes(child);
}

function harness(config, directory) {
  const tools = new Map();
  let prompt, gate; const observers = [];
  let disposed = 0;
  const ctx = {
    tools: { register(tool) { assertScalarSchemaTypes(tool.output?.schema); tools.set(tool.name, tool); return () => { disposed++; }; } },
    inject(names, install) {
      const services = {
        settings: {},
        workingDirectory: { ensure: async () => directory },
        systemPrompt: { section(value) { prompt = value; return () => {}; } },
      };
      return install({ ...ctx, ...services });
    },
    get(name) { return name === 'userQuestions' ? { ask: async () => ({answers:[{id:'script_review',selected:['脚本通过']},{id:'segment_result_review',selected:['效果可以，继续下一段']}]}) } : undefined; },
    on(event, listener) { if (event === 'session/event') observers.push(listener); else gate = listener; return () => {}; },
  };
  const dispose = plugin.apply(ctx, config);
  return { tools, observe: (session, event) => Promise.all(observers.map(f => f(session, event))), prompt: () => prompt.text({agent:{session:{header:{agentPreset:'video-director'}}}}), gate: (...args) => gate(...args), dispose, disposed: () => disposed };
}

test('published host preserves schema, tool registration, live configuration and cleanup', async () => {
  assert.deepEqual(Object.keys(plugin).sort(), ['Config', 'apply', 'inject']);
  assert.ok(plugin.Config);
  const config = { connectionMode: 'metaontic', metaonticApiKey: 'test', model: 'seedance-2-0' };
  const host = harness(config, '/tmp');
  assert.deepEqual([...host.tools.keys()].sort(), ['film_project', 'media_submission', 'video_config', 'video_estimate', 'video_extend', 'video_generate', 'video_prepare_image', 'video_project', 'video_script', 'video_setup', 'video_stage', 'video_status']);
  for (const [name, tool] of host.tools) {
    const view = tool.presentCall({});
    assert.equal(view?.card, 'generic', name);
    assert.match(view.title, /[\u4e00-\u9fff]/, `Missing Chinese call title: ${name}`);
    assert.ok(!view.title.includes(name), `Wire name leaked into title: ${name}`);
  }
  const film=host.tools.get('film_project');
  for(const action of film.parameters.properties.action.enum) {
    const title=film.presentCall({action}).title;
    assert.notEqual(title,'专业创作项目',`Missing action title: ${action}`);
  }
  assert.match(host.tools.get('film_project').description, /不另弹文本费用审批/);
  assert.doesNotMatch(host.tools.get('film_project').description, /弹窗确认文本费用/);
  assert.match(host.tools.get('video_script').description, /不弹文本调用审批/);
  assert.match(host.prompt(), /直出上限 15 秒/);
  config.model = 'seedance-2-5';
  assert.match(host.prompt(), /直出上限 30 秒/);
  const decision = await host.gate({ name: 'video_generate', arguments: { duration: 5, referenceImages: ['https://media.invalid/approved.png'] } });
  assert.equal(decision.kind, 'deny');
  assert.match(decision.reason, /projectId/);
  host.dispose();
  assert.equal(host.disposed(), 12);
});

test('conversation stays inside video creation and configuration is read-only in chat', async () => {
  const host = harness({ connectionMode: 'metaontic', metaonticApiKey: 'test' }, '/tmp');
  const prompt = host.prompt();
  assert.match(prompt, /本对话只做视频创作/);
  assert.match(prompt, /与视频创作无关的话题/);
  assert.match(prompt, /只能在插件设置页里改/);
  const tool = host.tools.get('video_config');
  assert.equal(Array.from(tool.parameters.properties.action.enum).join(','), 'get');
  const view = await tool.execute({ action: 'get' });
  assert.equal(view.action, 'get');
  assert.ok(view.stored);
  for (const args of [{ action: 'set', model: 'doubao-seedance-2-0-mini-260615' }, { action: 'set', baseUrl: 'https://example.invalid' }, { action: 'set' }]) {
    await assert.rejects(tool.execute(args), /插件配置不能在对话里改/);
  }
  host.dispose();
});

test('refine guidance asks for a richer pass instead of rewording the same idea', async () => {
  const host = harness({ connectionMode: 'metaontic', metaonticApiKey: 'test' }, '/tmp');
  const prompt = host.prompt();
  for (const needle of ['需求澄清只收集当前缺失信息', '完善仅补原意细节与可拍性', '不改人物关系、核心情节', '不连续弹窗', '按当前展示契约交付']) {
    assert.ok(prompt.includes(needle), needle);
  }
  assert.ok(prompt.includes('不改人物关系、核心情节、结尾、关键对白或增加付费分段'), '丰富不等于加人物或支线');
  assert.ok(prompt.includes('不机械规定切镜次数'), '丰富仍不许硬加视角');
  const skill = await readFile(new URL('../skills/video-director/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /完善要够丰富/, '技能里同样写明完善要够丰富');
  assert.match(skill, /不靠加镜头数代替丰富度|不借完善加人物、支线或付费分段/);
  const reference = await readFile(new URL('../skills/video-director/references/scriptwriting.md', import.meta.url), 'utf8');
  for (const needle of ['完善时怎么算够丰富', '画面层次', '事件节奏', '靠加镜头或拆更多付费分段凑丰富']) {
    assert.ok(reference.includes(needle), needle);
  }
  host.dispose();
});

test('script guidance keeps visuals from going monotone without adding paid work', async () => {
  const host = harness({ connectionMode: 'metaontic', metaonticApiKey: 'test' }, '/tmp');
  const prompt = host.prompt();
  for (const needle of [
    '画面内容与节奏检查', '每个镜头有明确叙事目的', '不机械规定切镜次数', '固定机位、一镜到底和必要留白可以成立', '不额外增加付费调用',
  ]) assert.ok(prompt.includes(needle), needle);
  assert.ok(!prompt.includes('整段只有固定中景加缓慢推近即为不合格脚本'));
  const skill = await readFile(new URL('../skills/video-director/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /阶段技能参考入口/);
  assert.match(skill, /不机械规定切镜次数/);
  const reference = await readFile(new URL('../skills/video-director/references/scriptwriting.md', import.meta.url), 'utf8');
  for (const needle of ['### 画面内容与节奏检查', '前景遮挡后的揭示', '不拆更多付费分段']) assert.ok(reference.includes(needle), needle);
  const playbook = await readFile(new URL('../skills/video-director/references/prompt-playbook.md', import.meta.url), 'utf8');
  assert.ok(playbook.includes('不靠增加镜头数、付费调用或更多分段'));
  host.dispose();
});

test('style guidance asks only when the idea has no style, then refines along the choice', async () => {
  const host = harness({ connectionMode: 'metaontic', metaonticApiKey: 'test' }, '/tmp');
  const prompt = host.prompt();
  for (const needle of ['style-library.md', '没有指定画面风格', '已经说清风格', '不重复推荐', '写入 script.md 的规格']) {
    assert.ok(prompt.includes(needle), needle);
  }
  const skill = await readFile(new URL('../skills/video-director/SKILL.md', import.meta.url), 'utf8');
  const library = await readFile(new URL('../skills/video-director/references/style-library.md', import.meta.url), 'utf8');
  assert.match(skill, /\[画面风格库\]\(references\/style-library\.md\)/);
  assert.match(skill, /已经说清风格/);
  assert.match(library, /没有指定画面风格/);
  host.dispose();
});

for (const mode of ['metaontic', 'volcengine']) test(`${mode}: bundled tools submit, query, pause, resume and extend through split modules`, async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mv-integration-'));
  const previousFetch = globalThis.fetch;
  const previousHome = process.env.DSH_HOME;
  const submissions = [];
  let count = 0;
  process.env.DSH_HOME = directory;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    if (url.startsWith('https://media.invalid/')) return new Response('test media bytes', { headers: { 'content-type': 'video/mp4' } });
    assert.match(url, /\/contents\/generations\/tasks/);
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    if (options.method === 'POST') {
      submissions.push(JSON.parse(options.body));
      return Response.json({ id: `task-${++count}` });
    }
    const id = url.split('/').at(-1);
    return Response.json({ id, status: 'succeeded', content: { video_url: `https://media.invalid/${id}.mp4` } });
  };
  try {
    const config = {
      connectionMode: mode, apiKey: 'test-key', keyOrigin: 'register',
      metaonticApiKey: 'test-key', volcengineApiKey: 'test-key',
      baseUrl: 'https://api.invalid', model: 'doubao-seedance-2-0-mini-260615',
      outputDir: directory, ffmpegBinary: '/missing/ffmpeg', ffprobeBinary: '/missing/ffprobe',
    };
    const host = harness(config, directory);
    const exec = { callId: 'test-call', agent: {session:{id:'integration',header:{cwd:directory}}} };
    async function reviewed(name, supplied) {
      const spec = {ratio:'9:16',resolution:'720p',...supplied};
      const project = await host.tools.get('video_project').execute({action:'prepare',subjectType:'scenery',duration:spec.duration*(name==='video_extend'?(spec.segments||1):1)},exec);
      const scriptPath=path.join(directory,project.projectId+'.md');
      const body='Script '+spec.prompt+'\n| 镜头 | 时间 | 画面 |\n| --- | --- | --- |\n| 1 | 0–5秒 | 海边 |';
      await writeFile(scriptPath,body);
      const board=await host.tools.get('video_project').execute({action:'storyboard',projectId:project.projectId,scriptPath},exec);
      const image=board.path;
      await host.observe(exec.agent.session,{type:'tool/call',data:{turn:1,name:'video_project'}});
      await host.observe(exec.agent.session,{type:'assistant/message',data:{turn:1,message:{content:[{type:'text',text:`${body}\n![分镜](<${image}>)`}]}}});
      const review=await host.tools.get('video_project').execute({action:'review',projectId:project.projectId,scriptPath,specification:spec,toolName:name},exec);
      assert.equal(review.status,'approved');
      return host.tools.get(name).execute({...spec,projectId:project.projectId},exec);
    }
    const generated = await reviewed('video_generate', { prompt: 'A title', duration: 5 });
    assert.equal(generated.status, 'succeeded');
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].duration, 5);
    assert.equal(submissions[0].resolution, '720p');
    assert.ok((await stat(generated.videoPath)).size);
    const queried = await host.tools.get('video_status').execute({ taskId: 'task-1' }, exec);
    assert.equal(queried.status, 'succeeded');
    assert.equal(submissions.length, 1);

    const first = await reviewed('video_generate', {
      prompt: 'Continuous story', duration: 20, segmentPrompts: ['First part', 'Second part'], merge: false,
    });
    assert.equal(first.paused, true);
    assert.equal(submissions.length, 2);
    const record = JSON.parse(await readFile(path.join(first.resumeDir, 'paused-plan.json'), 'utf8'));
    assert.equal(record.done, 1);
    // 每段确认接在 resume 入口：点「继续」后、提交下一段前，由代码弹一次说得清的确认，
    // 而不是只靠提示词让模型自己问。
    const unreviewed = await host.gate({ ...exec, name: 'video_generate', arguments: {resume:first.resumeDir,merge:false} });
    assert.equal(unreviewed.kind,'deny');assert.match(unreviewed.reason,/结果审核/);
    await assert.rejects(host.tools.get('video_generate').execute({resume:first.resumeDir,merge:false},exec),/结果审核/);
    assert.equal(submissions.length,2);
    await host.observe(exec.agent.session,{type:'assistant/message',data:{turn:2,message:{content:[{type:'text',text:`[观看第一段](<${first.segments[0].videoUrl}>)`}]}}});
    const segmentReview=await host.tools.get('video_project').execute({action:'review_segment',resume:first.resumeDir},exec);
    assert.equal(segmentReview.status,'approved');
    const resumeGate = await host.gate({
      name: 'video_generate',
      agent: exec.agent, arguments: { resume: first.resumeDir, merge: false },
    });
    assert.equal(resumeGate.kind, 'ask');
    assert.match(resumeGate.displayReason.zh, /第 1 段（15 秒）已经生成好/);
    assert.match(resumeGate.displayReason.zh, /接下来生成第 2 段（5 秒）/);
    assert.match(resumeGate.displayReason.zh, /整条还差 5 秒/);
    assert.match(resumeGate.displayReason.zh, /拒绝/);
    // 不是续做的调用不该出现续做说明
    const freshGate = await host.gate({
      name: 'video_generate',
      arguments: { duration: 5, referenceImages: ['https://media.invalid/approved.png'] },
    });
    assert.equal(freshGate.kind, 'deny');
    assert.match(freshGate.reason, /projectId/);
    const continued = await host.tools.get('video_generate').execute({ resume: first.resumeDir, merge: false }, exec);
    assert.equal(continued.status, 'succeeded');
    assert.equal(continued.paused, undefined);
    assert.equal(submissions.length, 3);
    assert.equal(submissions[2].duration, 5);
    assert.equal(submissions[2].content.find(part => part.type === 'video_url').video_url.url, 'https://media.invalid/task-2.mp4');
    await assert.rejects(stat(path.join(first.resumeDir, 'resume.lock')), { code: 'ENOENT' });

    const extended = await reviewed('video_extend', {
      videoUrl: 'https://media.invalid/task-1.mp4', prompt: 'Continue walking', duration: 5, merge: false,
    });
    assert.equal(extended.status, 'succeeded');
    assert.equal(submissions.length, 4);
    assert.equal(submissions[3].content.find(part => part.type === 'video_url').video_url.url, 'https://media.invalid/task-1.mp4');
    host.dispose();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    await rm(directory, { recursive: true, force: true });
  }
});

// 服务端方式（service）恢复提供：确认框不再以「方式不可用」直接拒绝，
// 而是照常进入角色参考图等正常流程卡口（这里没有可交互会话，所以停在提问前）。
test('service: bundled host serves the server method again instead of refusing it', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'mv-integration-service-'));
  const previousFetch = globalThis.fetch;
  const previousHome = process.env.DSH_HOME;
  let requests = 0;
  process.env.DSH_HOME = directory;
  globalThis.fetch = async () => { requests++; return Response.json({}); };
  try {
    const config = {
      connectionMode: 'service', apiKey: 'test-key', keyOrigin: 'register', deviceId: 'd', deviceSecret: 's', registerEmail: 'a@b.c',
      deviceFingerprint: 'f', model: 'doubao-seedance-2-0-mini-260615', outputDir: directory,
      ffmpegBinary: '/missing/ffmpeg', ffprobeBinary: '/missing/ffprobe',
    };
    const host = harness(config, directory);
    const decision = await host.gate({ name: 'video_generate', arguments: { duration: 5 } });
    assert.doesNotMatch(String(decision.reason || ''), /暂时不可用/);
    assert.equal(decision.kind, 'deny');
    assert.match(decision.reason, /projectId/);
    assert.ok(host.tools.has('video_config'));
    assert.equal(requests, 0);
    host.dispose();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousHome;
    await rm(directory, { recursive: true, force: true });
  }
});

test('script writing starts from a director pass instead of a checklist', async () => {
  const host = harness({ connectionMode: 'metaontic', metaonticApiKey: 'test' }, '/tmp');
  const prompt = host.prompt();
  for (const needle of ['导演工作法', 'scriptwriting.md', '只加载本阶段所需', '不展示内部推演']) {
    assert.ok(prompt.includes(needle), needle);
  }
  const skill = await readFile(new URL('../skills/video-director/SKILL.md', import.meta.url), 'utf8');
  assert.match(skill, /导演工作法/, '技能写脚本一步指向导演工作法');
  const reference = await readFile(new URL('../skills/video-director/references/scriptwriting.md', import.meta.url), 'utf8');
  for (const needle of ['## 导演工作法（动笔前先想一遍）', '观众与记忆点', '情绪曲线', '视觉母题', '一条主线']) {
    assert.ok(reference.includes(needle), needle);
  }
  host.dispose();
});

test('removed canvas ignores legacy config and ordinary projects work without it',async()=>{
 const previous=process.env.DSH_HOME;const home=await mkdtemp(path.join(os.tmpdir(),'hidden-canvas-'));process.env.DSH_HOME=home;
 const config={canvasEnabled:true,autoCreateCanvas:true,connectionMode:'metaontic'};
 const host=harness(config,home);
 try {
  assert.equal(host.tools.has('video_canvas'),false);
  const view=await host.tools.get('video_config').execute({action:'get'});
  assert.equal(view.stored.canvasEnabled,undefined);assert.equal(view.effective.canvasEnabled,undefined);assert.equal(view.effective.autoCreateCanvas,undefined);
  const result=await host.tools.get('video_project').execute({action:'prepare',subjectType:'scenery',duration:15},{agent:{session:{id:'hidden-canvas',header:{cwd:home}}}});
  assert.equal(result.status,'prepared');assert.equal(result.canvasProject,undefined);
  assert.equal(host.tools.get('video_generate').parameters.properties.canvas,undefined);
  assert.equal(config.canvasEnabled,true);assert.equal(config.autoCreateCanvas,true);
  assert.doesNotMatch(host.prompt(),/先在插件设置页打开「流程画布」|工具会自动建流程画布项目/);
 }finally{host.dispose();if(previous===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=previous;await rm(home,{recursive:true,force:true});}
});

// 这些断言检查实际注入的流程契约；不把静态检查当成模型行为实测。
for (const [scenario, rules] of [
  ['已给30秒竖屏720P不重复问规格', ['已确认的时长、画幅和清晰度不重复问', '禁止省略已确认值导致工具重复提问']],
  ['批准后推进已有nextTask', ['批准成功→按返回nextTask继续', '没有nextTask才next']],
  ['先交付片段再审核', ['视频返回paused→先给真实片段链接，再单独review_segment']],
  ['提交不明禁止重放', ['submission_unknown/查询超时/状态不明', '禁止重新付费提交']],
  ['局部修改保留范围', ['局部修改→route定位稳定ID，只更新受影响材料']],
  ['静态机位不强加切镜', ['固定机位、一镜到底和必要留白可以成立']],
  ['普通专业不重复生成', ['普通流程调用video_script', '不额外调用video_script生成第二份剧本']],
  ['无对白与无音频区别', ['只要求无对白时不添加人声，环境声和配乐仍按已批准方案']],
]) test(`提示词场景契约：${scenario}`, () => {
  const host = harness({connectionMode:'metaontic',metaonticApiKey:'test'}, '/tmp');
  try { for(const rule of rules) assert.ok(host.prompt().includes(rule), rule); } finally { host.dispose(); }
});
