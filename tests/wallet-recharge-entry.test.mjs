import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceOf } from './source.mjs';
test('plugin no longer includes account, quota or recharge operations', () => {
  assert.doesNotMatch(sourceOf('businesses/video-generation/client/settings', 'businesses/video-generation/workflow/approval'), /api\/v1\/(register|wallet)|createAccountActions|rechargeEntryVisible/);
});
