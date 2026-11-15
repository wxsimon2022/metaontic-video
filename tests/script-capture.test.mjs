import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './module-test-api.mjs';

const SCRIPT = ['# 青旅晨光（15 秒宣传短片）', '', '清晨的天台，镜头缓慢推近，光线由冷转暖。', '',
  '## 一、规格与风格', '', '| 项目 | 内容 |', '| --- | --- |', '| 总时长 | 15 秒 |', '| 画幅 | 16:9 横屏 |', '',
  '## 二、分镜表', '', '| 镜号 | 画面 | 时长 |', '| --- | --- | --- |', '| 1 | 清晨天台的城市天际线 | 5秒 |', '',
  '## 三、费用预估', '', '火山官方方案与 MetaOnticVideo 方案约 ¥3.6，续拍含上一段完整视频输入，按渠道账单结算。'].join('\n');

test('脚本只在正文写一次：从标题起截出脚本，寒暄、示意图与链接都不写进 script.md', () => {
  const body = `项目已建好，脚本、分镜和费用都准备好了。\n\n---\n\n${SCRIPT}\n\n![分镜示意图](</tmp/storyboard-v1.svg>)\n[打开原图](</tmp/storyboard-v1.svg>)`;
  const captured = api.captureScriptBody(body);
  assert.equal(captured, SCRIPT, '只留脚本本体，标题前的寒暄与结尾的图/链接都丢掉');
});

test('尾部只贴图片或链接也不影响截取；正文里没有完整脚本时返回空交给调用方报错', () => {
  assert.equal(api.captureScriptBody(`${SCRIPT}\n\n![](/tmp/a.png)`), SCRIPT);
  assert.equal(api.captureScriptBody('本版要点：沙、苗、草方格、林带，详情见 script.md，按渠道账单结算，图片单独计费。'), '', '摘要不算脚本');
  assert.equal(api.captureScriptBody('[script.md](</tmp/script.md>)'), '', '只给链接不算脚本');
  assert.equal(api.captureScriptBody(SCRIPT.slice(0, 80)), '', '太短不算完整脚本');
  assert.equal(api.captureScriptBody(''), '');
});

test('CRLF 不影响截取，脚本里的表格与结尾说明原样保留', () => {
  const captured = api.captureScriptBody(`开场白。\r\n${SCRIPT.replace(/\n/g, '\r\n')}\r\n`);
  assert.ok(captured.startsWith('# 青旅晨光'));
  assert.ok(captured.includes('| 1 | 清晨天台的城市天际线 | 5秒 |'), '分镜表原样保留');
  assert.ok(captured.endsWith('按渠道账单结算。'), '结尾的费用说明不丢');
});
