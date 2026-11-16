import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { api } from './module-test-api.mjs';
import { sourceOf } from './source.mjs';

const config = { connectionMode: 'metaontic', metaonticApiKey: 'secret-never-persist', baseUrl: 'https://relay.invalid', model: 'doubao-seedance-2-0-mini-260615' };

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

test('文本模型写脚本：请求走同一中转站的 chat 接口，提示词把分镜表列名与段数写死', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return response({ model: 'deepseek v4.1 flash', choices: [{ message: { content: '```markdown\n# 青旅的清晨\n\n| 镜号 | 镜别 | 视角 | 运镜 | 画面 | 时长 | 台词 |\n| --- | --- | --- | --- | --- | --- | --- |\n| 1 | 远景 | 平视 | 固定镜头 | 天台晨光 | 15秒 | — |\n| 2 | 中景 | 过肩 | 缓慢推近 | 前台接待 | 15秒 | — |\n```' } }], usage: { prompt_tokens: 120, completion_tokens: 300 } });
  };
  const result = await api.writeScript(config, { idea: '青旅天台的清晨', totalSeconds: 30, segmentSeconds: 15, segments: 2, ratio: '9:16' }, { fetcher });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://relay.invalid/v1/chat/completions');
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret-never-persist');
  assert.equal(calls[0].body.model, api.resolveTextModel(config));
  const prompt = calls[0].body.messages[1].content;
  assert.ok(prompt.includes('青旅天台的清晨') && prompt.includes('9:16'), prompt.slice(0, 80));
  assert.ok(prompt.includes('| 镜号 | 镜别 | 视角 | 运镜 | 画面 | 时长 | 台词 |'), '把分镜表表头写死，分段解析才有依据');
  assert.ok(prompt.includes('镜别列只填一个标准景别词'), '镜别单独成列，不能用运镜代替');
  assert.ok(prompt.includes('视角列只填一个标准视角词') && prompt.includes('第一人称主观（POV）') && prompt.includes('过肩') && prompt.includes('荷兰角（倾斜）'), '视角单独成列，并给出标准视角词表');
  assert.ok(prompt.includes('视角由这一段的内容和场景决定，不要硬加') && prompt.includes('平视是默认'), '视角要符合场景，不为变化硬加');
  assert.ok(prompt.includes('封闭室内不写航拍'), '场景里没有的条件不许写');
  assert.ok(prompt.includes('运镜列写清这一段镜头怎么动'), '运镜写清方式、方向与速度');
  assert.ok(prompt.includes('画面列是这一段要拍的详情'), '画面列要求写全主体、动作、环境、光线与氛围');
  assert.ok(prompt.includes('整片要有变化') && prompt.includes('相邻两段的镜别与视角不要连着用同一组'), '整片要有变化，避免每个镜头都用同一组景别与视角');
  assert.ok(prompt.includes('不为变化硬换'), '要求变化仍要符合场景，不是硬凑');
  assert.ok(prompt.includes('正好 2 行'), '段数写死');
  assert.equal(result.script.startsWith('# 青旅的清晨'), true, '去掉代码块围栏');
  assert.equal(result.script.includes('```'), false);
  assert.equal(result.model, 'deepseek v4.1 flash');
  assert.deepEqual(result.usage, { promptTokens: 120, completionTokens: 300 });
});

test('文本模型写脚本：空想法、缺密钥、上游报错与空正文都直接报错，不伪造脚本', async () => {
  await assert.rejects(() => api.writeScript(config, { idea: '   ', totalSeconds: 15 }, { fetcher: async () => response({}) }), /请先写下想拍什么/);
  await assert.rejects(() => api.writeScript({ ...config, metaonticApiKey: '' }, { idea: 'x' }, { fetcher: async () => response({}) }), /API密钥/);
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: async () => response({ error: { message: 'model not found' } }, false, 404) }), /model not found/);
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: async () => response({ choices: [{ message: { content: '   ' } }] }) }), /空脚本/);
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: async () => { throw new Error('socket hang up'); } }), /socket hang up/);
});

function sseResponse(chunks, { status = 200, headers = { 'content-type': 'text/event-stream' } } = {}) {
  const payload = chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n';
  return new Response(payload, { status, headers });
}

test('文本模型写脚本：默认流式增量收正文，按段数给输出上限，被截断时回报 truncated', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(JSON.parse(options.body));
    return sseResponse([
      { model: 'deepseek v4.1 flash', choices: [{ delta: { content: '# 青旅的清晨\n\n' } }] },
      { choices: [{ delta: { content: '| 镜号 | 镜别 | 视角 | 运镜 | 画面 | 时长 | 台词 |\n' } }] },
      { choices: [{ delta: { content: '| 1 | 远景 | 平视 | 固定镜头 | 天台晨光 | 15秒 | — |' } }], usage: { prompt_tokens: 12, completion_tokens: 34 } },
      { choices: [{ delta: {}, finish_reason: 'length' }] },
    ]);
  };
  const seen = [];
  const result = await api.writeScript(config, { idea: '青旅天台的清晨', totalSeconds: 30, segments: 2, ratio: '9:16' },
    { fetcher, onProgress: (progress) => seen.push(progress.characters) });
  assert.equal(calls[0].stream, true, '默认流式：能报进度，也能尽早发现连接假死');
  assert.deepEqual(calls[0].stream_options, { include_usage: true }, '流式里也要 usage，费用与用量才可核对');
  assert.equal(calls[0].max_tokens, api.textMaxTokens(2), '按段数给输出上限，既够长又有封顶');
  assert.ok(calls[0].max_tokens >= 3000, `上限要装得下带分镜表的整份脚本：${calls[0].max_tokens}`);
  assert.equal(result.script, '# 青旅的清晨\n\n| 镜号 | 镜别 | 视角 | 运镜 | 画面 | 时长 | 台词 |\n| 1 | 远景 | 平视 | 固定镜头 | 天台晨光 | 15秒 | — |', '把增量按顺序拼回正文');
  assert.equal(result.model, 'deepseek v4.1 flash');
  assert.deepEqual(result.usage, { promptTokens: 12, completionTokens: 34 });
  assert.equal(result.truncated, true, '写到输出上限要回报，客户端据此提醒用户补写而不是当完整脚本用');
  assert.ok(seen.length >= 1 && seen.every((count) => count > 0), `读到增量就要报进度：${seen.join(',')}`);
  assert.ok(seen.every((count, index) => index === 0 || count > seen[index - 1]), `进度只增不减：${seen.join(',')}`);
  assert.ok(seen[seen.length - 1] >= result.script.length, '最后一次进度就是正文长度');
  assert.equal(result.characters, result.script.length);
});

test('文本模型写脚本：流式里上游报错、空正文、写不满一半就断都要报错，不伪造脚本', async () => {
  const failing = async () => sseResponse([{ error: { message: 'rate limit exceeded' } }]);
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: failing }), /rate limit exceeded/);
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: async () => sseResponse([{ choices: [{ delta: { content: '   ' } }] }]) }), /空脚本/);
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: async () => sseResponse([{ choices: [{ delta: {} }] }]) }), /空脚本/);
  const bad = async () => sseResponse([], { status: 502 });
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: bad }), /文本模型调用失败：502/);
});

test('文本模型写脚本：连接假死按增量上限提前报错，不必等满总超时', async () => {
  assert.ok(api.TEXT_IDLE_TIMEOUT_MS < api.TEXT_TIMEOUT_MS, '增量上限要严于总上限，否则等于没兜住');
  // 真实 fetch 在 signal 中止时会打断 body；桩里照做，否则挂住的流永远读不完。
  const stalled = async (url, options) => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: '));
      options.signal.addEventListener('abort', () => controller.error(new Error('文本模型连接被中止')), { once: true });
    },
  }), { headers: { 'content-type': 'text/event-stream' } });
  const started = Date.now();
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: stalled, idleTimeoutMs: 80 }), /没有输出/);
  assert.ok(Date.now() - started < 5000, '卡住时按增量上限立刻报错');
});

test('文本模型默认值：设置页选的型号优先，其次环境变量，最后内置默认值', () => {
  assert.equal(api.resolveTextModel({ ...config, textModel: 'my-relay-model' }), 'my-relay-model');
  assert.equal(api.resolveTextModel(config), 'deepseek v4.1 flash');
  assert.equal(api.textEndpoint({ ...config, baseUrl: 'https://relay.invalid/' }), 'https://relay.invalid/v1/chat/completions');
  assert.equal(api.textEndpoint({ ...config, baseUrl: 'https://relay.invalid/v1' }), 'https://relay.invalid/v1/chat/completions');
  assert.equal(api.stripFence('正文'), '正文');
});

test('文本模型候选与中转站在售一致：设置页下拉可选，已下线的旧默认值读到就归一到默认项', () => {
  const ctx = vm.createContext({});
  vm.runInContext(sourceOf('businesses/video/connection-defaults', 'businesses/video/client/config') + '\nObject.assign(globalThis, createClientConfig());\nObject.assign(globalThis, { TEXT_MODELS, TEXT_MODEL, normalizeTextModel, connectionDefaults });', ctx);
  assert.deepEqual(Array.from(ctx.TEXT_MODELS), ['deepseek v4.1 flash', 'deepseekv4pro'], '候选就是中转站在售的文本模型');
  assert.deepEqual(Array.from(ctx.SELECTS.textModel), Array.from(ctx.TEXT_MODELS), '设置页按同一份候选做下拉');
  assert.equal(ctx.FIELD_BY_KEY.textModel.kind, 'select', '文本模型和视频/图片模型一样用下拉选择');
  assert.equal(ctx.SECTIONS.find((section) => section.key === 'sectionModels').fields.includes('textModel'), true);
  assert.equal(ctx.normalizeTextModel(''), ctx.TEXT_MODEL);
  assert.equal(ctx.normalizeTextModel('   '), ctx.TEXT_MODEL);
  assert.equal(ctx.normalizeTextModel('doubao-seed-1-6-250615'), ctx.TEXT_MODEL, '已下线的旧默认值归一到默认项');
  assert.equal(ctx.normalizeTextModel('deepseekv4pro'), 'deepseekv4pro', '候选里的型号原样保留');
  assert.equal(ctx.connectionDefaults({ textModel: 'doubao-seed-1-6-250615' }).textModel, ctx.TEXT_MODEL);
  assert.equal(ctx.connectionDefaults({}).textModel, ctx.TEXT_MODEL);
});

test('设置页文本模型是下拉：候选就是视频/图片模型那种在售列表，旧默认值显示成默认项', () => {
  const scope = vm.createContext({});
  vm.runInContext(sourceOf('businesses/video/connection-defaults', 'businesses/video/client/config', 'businesses/video/client/settings-actions')
    + '\nObject.assign(globalThis, createClientConfig());\nObject.assign(globalThis, { createSettingsActions });', scope);
  const h = (type, props, children) => ({ type, props: props || {}, children: Array.isArray(children) ? children.filter(Boolean) : children === undefined ? [] : [children] });
  const context = {
    draft: {}, value: {}, h, SELECTS: scope.SELECTS, inputStyle: {}, t: (key) => key, snapshot: { secrets: {} },
    visibleKey: '', setVisibleKey: () => {}, edit: () => {}, optionLabel: scope.optionLabel,
  };
  const { control } = scope.createSettingsActions(context);
  const field = scope.FIELD_BY_KEY.textModel;
  assert.equal(field.kind, 'select', '文本模型跟视频/图片模型一样是下拉，不是自由填写');
  const rendered = control(field);
  assert.equal(rendered.type, 'select');
  assert.deepEqual([...rendered.children].map((option) => option.props.value), ['deepseek v4.1 flash', 'deepseekv4pro'], '下拉里只有在售候选');
  assert.equal(rendered.props.value, 'deepseek v4.1 flash', '没配过时下拉就落在默认项上');
  const stored = { ...context, value: { textModel: 'doubao-seed-1-6-250615' } };
  const withRetired = scope.createSettingsActions(stored).control(field);
  assert.deepEqual([...withRetired.children].map((option) => option.props.value), ['deepseek v4.1 flash', 'deepseekv4pro'], '已下线的旧型号不再作为候选出现');
  assert.equal(withRetired.props.value, 'deepseek v4.1 flash', '存量旧型号按实际生效的默认项显示');
  const custom = { ...context, value: { textModel: 'my-relay-model' } };
  const withCustom = scope.createSettingsActions(custom).control(field);
  assert.ok([...withCustom.children].map((option) => option.props.value).includes('my-relay-model'), '手填过的其它型号仍在下拉里看得到，不会被静默换掉');
});

test('关了共用密钥以后文本模型用自己那把 API密钥，没填就停下来提示补填', async () => {
  const own = { ...config, imageUseVideoKey: false, textApiKey: 'text-key' };
  assert.equal(api.resolveTextApiKey(config), 'secret-never-persist', '共用时仍用视频模型那把');
  assert.equal(api.resolveTextApiKey(own), 'text-key');
  assert.equal(api.resolveApiKey(api.textConfig(own)), 'text-key', '文本调用的连接快照换成文本密钥');
  assert.equal(api.textConfig(own).metaonticApiKey, 'text-key');
  assert.equal(api.textConfig(own).baseUrl, 'https://relay.invalid', '地址仍沿用当前 MetaOntic AI 连接');
  const blank = { ...config, imageUseVideoKey: false, textApiKey: '  ' };
  assert.equal(api.resolveTextApiKey(blank), '', '没填时不会退回视频密钥');
  assert.throws(() => api.textConfig(blank), /单独填写文本模型 API密钥/);
  await assert.rejects(() => api.writeScript(blank, { idea: 'x' }, { fetcher: async () => response({}) }), /文本模型 API密钥/);

  // 真调用时请求头里带的就是文本模型那把密钥。
  const calls = [];
  const fetcher = async (url, options) => { calls.push(options.headers.authorization); return response({ choices: [{ message: { content: '# 片名' } }] }); };
  await api.writeScript(own, { idea: '青旅天台的清晨' }, { fetcher });
  assert.deepEqual(calls, ['Bearer text-key']);
});
