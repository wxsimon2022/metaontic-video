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
    return response({ model: 'deepseek v4.1 flash', choices: [{ message: { content: '```markdown\n# 青旅的清晨\n\n| 镜头 | 画面 | 时长 | 台词 |\n| --- | --- | --- | --- |\n| 1 | 天台晨光 | 15秒 | — |\n| 2 | 前台接待 | 15秒 | — |\n```' } }], usage: { prompt_tokens: 120, completion_tokens: 300 } });
  };
  const result = await api.writeScript(config, { idea: '青旅天台的清晨', totalSeconds: 30, segmentSeconds: 15, segments: 2, ratio: '9:16' }, { fetcher });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://relay.invalid/v1/chat/completions');
  assert.equal(calls[0].options.headers.authorization, 'Bearer secret-never-persist');
  assert.equal(calls[0].body.model, api.resolveTextModel(config));
  const prompt = calls[0].body.messages[1].content;
  assert.ok(prompt.includes('青旅天台的清晨') && prompt.includes('9:16'), prompt.slice(0, 80));
  assert.ok(prompt.includes('| 镜头 | 画面 | 时长 | 台词 |'), '把分镜表表头写死，分段解析才有依据');
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
