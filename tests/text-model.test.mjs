import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './module-test-api.mjs';

const config = { connectionMode: 'metaontic', metaonticApiKey: 'secret-never-persist', baseUrl: 'https://relay.invalid', model: 'doubao-seedance-2-0-mini-260615' };

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

test('文本模型写脚本：请求走同一中转站的 chat 接口，提示词把分镜表列名与段数写死', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return response({ model: 'doubao-seed-1-6-250615', choices: [{ message: { content: '```markdown\n# 青旅的清晨\n\n| 镜头 | 画面 | 时长 | 台词 |\n| --- | --- | --- | --- |\n| 1 | 天台晨光 | 15秒 | — |\n| 2 | 前台接待 | 15秒 | — |\n```' } }], usage: { prompt_tokens: 120, completion_tokens: 300 } });
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
  assert.equal(result.model, 'doubao-seed-1-6-250615');
  assert.deepEqual(result.usage, { promptTokens: 120, completionTokens: 300 });
});

test('文本模型写脚本：空想法、缺密钥、上游报错与空正文都直接报错，不伪造脚本', async () => {
  await assert.rejects(() => api.writeScript(config, { idea: '   ', totalSeconds: 15 }, { fetcher: async () => response({}) }), /请先写下想拍什么/);
  await assert.rejects(() => api.writeScript({ ...config, metaonticApiKey: '' }, { idea: 'x' }, { fetcher: async () => response({}) }), /API密钥/);
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: async () => response({ error: { message: 'model not found' } }, false, 404) }), /model not found/);
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: async () => response({ choices: [{ message: { content: '   ' } }] }) }), /空脚本/);
  await assert.rejects(() => api.writeScript(config, { idea: 'x' }, { fetcher: async () => { throw new Error('socket hang up'); } }), /socket hang up/);
});

test('文本模型默认值：设置页填的型号优先，其次环境变量，最后内置默认值', () => {
  assert.equal(api.resolveTextModel({ ...config, textModel: 'my-relay-model' }), 'my-relay-model');
  assert.equal(api.resolveTextModel(config).startsWith('doubao-'), true);
  assert.equal(api.textEndpoint({ ...config, baseUrl: 'https://relay.invalid/' }), 'https://relay.invalid/v1/chat/completions');
  assert.equal(api.textEndpoint({ ...config, baseUrl: 'https://relay.invalid/v1' }), 'https://relay.invalid/v1/chat/completions');
  assert.equal(api.stripFence('正文'), '正文');
});
