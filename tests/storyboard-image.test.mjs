import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api } from './module-test-api.mjs';

const SCRIPT = [
  '# 青旅晨光',
  '',
  '清晨的天台，镜头缓慢推近，光线由冷转暖。',
  '',
  '## 分镜表',
  '',
  '| 镜号 | 镜别 | 视角 | 运镜 | 画面 | 时长 | 台词 |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  '| 1 | 远景 | 高角度俯拍 | 缓慢推近 | 清晨天台的城市天际线，薄雾里亮起第一盏灯 | 5秒 | — |',
  '| 2 | 近景 | 过肩 | 固定 | 前台接待与行李特写<把手上的划痕与微笑 | 5秒 | 欢迎回来 |',
].join('\n');

test('分镜示意图由插件按分镜表渲染：镜头、景别运镜、画面与时长都进图', () => {
  const shots = api.scriptStoryboardShots(SCRIPT);
  assert.equal(shots.length, 2);
  const svg = api.renderStoryboardSvg(SCRIPT, { version: 2 });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, '输出是可直接内嵌的 SVG');
  assert.ok(svg.includes('青旅晨光'), '片名取脚本第一行标题');
  assert.ok(svg.includes('2 个镜头') && svg.includes('第 2 版'), '标清镜头数与版本');
  assert.ok(svg.includes('镜头 1') && svg.includes('远景'), '每个镜头都有镜号与景别');
  assert.ok(svg.includes('缓慢推近') && svg.includes('清晨天台的城市天际线'), '运镜与画面详情都要进图');
  assert.ok(svg.includes('高角度俯拍') && svg.includes('过肩'), '视角与镜别、运镜一起进图');
  assert.ok(svg.includes('5 秒'), '时长进图');
  assert.ok(svg.includes('台词：欢迎回来'), '有台词的镜头写出台词');
  assert.ok(svg.includes('示意，非实际生成画面'), '标明只是示意，不是实际生成画面');
  assert.ok(svg.includes('&lt;把手上的划痕'), '特殊字符按 XML 转义，不破坏 SVG');
  assert.ok(!svg.includes('<把手上的划痕'), '原文的尖括号不会写成标签');
});

test('没有分镜表时不编造镜头：只画一句提示，仍然是合法 SVG', () => {
  const svg = api.renderStoryboardSvg('# 只有标题\n\n一句话脚本。');
  assert.ok(svg.includes('脚本里还没有可分镜的表格'), '没有分镜表就直说');
  assert.ok(svg.endsWith('</svg>'));
  assert.equal(api.scriptStoryboardShots('没有表格的脚本').length, 0);
});

test('版本号按已有分镜图递增，命名与旧的手绘图同一套', () => {
  assert.equal(api.storyboardFileName(3), 'storyboard-v3.svg');
  assert.equal(api.nextStoryboardVersion([]), 1);
  assert.equal(api.nextStoryboardVersion(['script.md', 'storyboard-v1.png']), 2, '认旧的手绘图版本');
  assert.equal(api.nextStoryboardVersion(['storyboard-v2.svg', 'storyboard-v7.png']), 8, '取最大的那一版再加一');
  assert.equal(api.nextStoryboardVersion(['storyboard.svg', '分镜示意.png']), 1, '没有版本号的按第 1 版起');
});

test('断行按显示宽度：中文算一个字宽，长句收成省略号，不丢整段', () => {
  assert.ok(Math.abs(api.displayWidth('中文ab') - 3.1) < 1e-9, '中文一个字宽、英文按 0.55');
  const lines = api.wrapText('一'.repeat(20), 8, 2);
  assert.equal(lines.length, 2);
  assert.equal(api.displayWidth(lines[0]), 8);
  assert.ok(lines[1].endsWith('…'), '超出上限时末行用省略号收口');
  assert.deepEqual(api.wrapText('   ', 8), [], '空内容不产出行');
});

test('真实分镜有对应主体草图，未知主体明确留白，不把符号当实拍预览', () => {
  const visuals = ['铜奔马蹄下飞鸟', '天梯山石窟大佛侧脸，晨光', '文庙红墙', '鼓手击鼓', '面碗热气', '倒酒入夜光杯', '城门夜景', '未知物件<独特外形>'];
  const svg = api.renderStoryboardSvg('# 武威\n画幅：16:9', { shots: visuals.map(visual => ({ visual, camera: '近景', duration: 4 })) });
  assert.deepEqual([...svg.matchAll(/data-sketch="([^"]+)"/g)].map(m => m[1]), ['horse', 'statue', 'architecture', 'drum', 'bowl', 'cup', 'architecture', 'unknown']);
  assert.ok(svg.includes('主体待细化') && svg.includes('符号示意，非精确构图'));
  assert.ok(svg.includes('&lt;独特外形&gt;'));
  assert.doesNotMatch(svg, /<script|<image|foreignObject|href=/);
});

test('画框遵循明确规格，竖屏不画成横屏，长对白与运镜仍在卡片内', () => {
  const shots = [{ visual: '人物站在画面左侧', camera: '高角度俯拍 · 缓慢推近'.repeat(14), dialogue: [{ line: '对白'.repeat(45) }], sfx: '音乐'.repeat(45), duration: 5 }];
  for (const [ratio, expected] of [['9:16', [185.625, 330]], ['16:9', [330 * 16 / 9, 330]], ['1:1', [330, 330]]]) {
    const svg = api.renderStoryboardSvg(`# 测试\n画幅：${ratio}`, { shots });
    const frame = /<svg x="[^"]+" y="[^"]+" width="([^"]+)" height="([^"]+)"[^>]*data-sketch/.exec(svg);
    assert.ok(frame);
    assert.ok(Math.abs(Number(frame[1]) - expected[0]) < 1e-9);
    assert.ok(Math.abs(Number(frame[2]) - expected[1]) < 1e-9);
    const card = /<rect x="44" y="132" width="1472" height="(\d+)"/.exec(svg);
    const ys = [...svg.matchAll(/<text x="768" y="(\d+)"/g)].map(m => Number(m[1]));
    assert.ok(ys.length > 3 && Math.max(...ys) < 132 + Number(card[1]));
  }
  const override = api.renderStoryboardSvg('画幅：9:16', { shots, ratio: '16:9' });
  const frame = /<svg x="[^"]+" y="[^"]+" width="([^"]+)" height="([^"]+)"[^>]*data-sketch/.exec(override);
  assert.ok(Math.abs(Number(frame[1]) / Number(frame[2]) - 16 / 9) < 1e-9);
});
