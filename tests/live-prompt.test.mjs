import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('an existing prompt registration reads current configuration on each request', () => {
  const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const start = source.indexOf('const promptCleanup = ctx.inject(');
  const end = source.indexOf('\n  for (const dispose', start);
  assert.ok(start >= 0 && end > start);
  let section;
  const config = { model: 'first-model' };
  vm.runInNewContext(source.slice(start, end), {
    config,
    buildPromptGuidance: current => `Current video model: ${current.model}`,
    ctx: { inject(_services, install) { return install({ systemPrompt: { section(value) { section = value; return () => {}; } } }); } },
  });
  assert.equal(typeof section.text, 'function');
  assert.equal(section.text({}), 'Current video model: first-model');
  config.model = 'updated-model';
  assert.equal(section.text({}), 'Current video model: updated-model');
});
