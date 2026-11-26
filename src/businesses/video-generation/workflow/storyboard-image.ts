/** workflow/storyboard-image：按脚本分镜表本地渲染分镜示意图。
 *  以前这一步要模型手写绘图程序或 SVG（实测 30–45 秒才出一张，还常画坏），现在插件直接渲染：
 *  秒级、确定性、与 script.md 的分镜表逐行对应，只作示意、不是实际生成画面，也不调用任何付费出图模型。 */
import { scriptStoryboardShots } from './storyboard-shots.js';
import { storyboardSketch } from './storyboard-sketch.js';

const FONT = "-apple-system,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escapeXml = (value: any) => String(value ?? '').replace(/[&<>"']/g, char => ESCAPES[char]);

/** 分镜示意图的命名：与旧的手绘图 storyboard-v1.png 同一套，审核守卫按文件名找本版分镜图。 */
export const STORYBOARD_PREFIX = 'storyboard-v';
export const storyboardFileName = (version: number) => `${STORYBOARD_PREFIX}${version}.svg`;
/** 目录里已有第几版：改稿渲染出新版本，守卫的「新版分镜图还没展示」判断据此生效。 */
export function nextStoryboardVersion(entries: any[] = []) {
  let max = 0;
  for (const entry of entries || []) {
    const matched = /^storyboard[-_]?v?(\d+)\.[a-z0-9]+$/i.exec(String(entry || ''));
    if (matched) max = Math.max(max, Number(matched[1]));
  }
  return max + 1;
}

/** 中英混排的显示宽度：CJK 记 1，其余记 0.55，用来断行。 */
export function displayWidth(value: any) {
  let width = 0;
  for (const char of String(value ?? '')) width += /[\u2e80-\uffff]/.test(char) ? 1 : 0.55;
  return width;
}

/** 按显示宽度断行；超出 maxLines 时在末行收成省略号，不把整段画面描述丢掉只剩半句。 */
export function wrapText(value: any, maxUnits: number, maxLines = 4) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  const lines: string[] = [];
  let current = '';
  for (const char of text) {
    if (current && displayWidth(current + char) > maxUnits) {
      lines.push(current);
      current = char;
      if (lines.length >= maxLines) break;
      continue;
    }
    current += char;
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.join('').length < text.length && lines.length) lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
  return lines;
}

/** 画面列就是要拍的镜头；镜别与运镜已单独抽到 camera，这里只留画面详情。 */
function visualOf(shot: any) {
  const fields = String(shot?.visual || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const wanted = /^(?:画面|视觉|visual|详情|描述)\s*[:：]/i;
  const hit = fields.find(line => wanted.test(line));
  const body = (hit ? hit.replace(wanted, '') : fields.join(' ')).trim();
  return body || String(shot?.visual || '').replace(/^[^：:]*[：:]\s*/, '').trim();
}

/** 片名取脚本第一行「# 」标题；取不到才退回默认名。 */
function titleOf(script: any) {
  for (const line of String(script ?? '').split(/\r?\n/)) {
    const matched = /^#\s+(\S.*)$/.exec(line.trim());
    if (matched) return matched[1].trim();
    if (line.trim()) break;
  }
  return '';
}

const dialogueOf = (shot: any) => (Array.isArray(shot?.dialogue) ? shot.dialogue : [])
  .map((line: any) => String(line?.line || line?.text || '').trim()).filter(Boolean).join(' / ');

/** 分镜示意图：片名 + 规格 + 每镜头一张卡（镜号、景别视角运镜、画面、时长、台词）。只画解析到的镜头。 */
export function renderStoryboardSvg(script: any, options: any = {}) {
  const shots = Array.isArray(options.shots) ? options.shots : scriptStoryboardShots(String(script ?? ''));
  const title = String(options.title || '').trim() || titleOf(script) || '分镜示意图';
  const version = Number(options.version) || 1;
  const ratio = String(options.ratio || '').trim() || /(?:画幅|比例|ratio)\s*[:：]?\s*(\d+\s*[:：]\s*\d+)/i.exec(String(script).slice(0, 1600))?.[1]?.replace(/\s/g, '').replace('：', ':') || '';
  const parts = ratio.split(':').map(Number);
  const aspect = parts.length === 2 && parts.every(n => Number.isFinite(n) && n > 0) ? parts[0] / parts[1] : 16 / 9;
  const frameWidth = Math.min(640, 330 * aspect), frameHeight = frameWidth / aspect;
  const total = Number(options.seconds) || shots.reduce((sum: number, shot: any) => sum + (Number(shot?.duration) || 0), 0);
  const width = 1560, pad = 44, cardWidth = width - pad * 2, inner = 34;
  const meta = [ratio, total ? `全片约 ${total} 秒` : '', `${shots.length} 个镜头`, `第 ${version} 版`].filter(Boolean).join(' · ');
  const headHeight = 132;

  const cards = shots.map((shot: any, index: number) => {
    const visual = wrapText(visualOf(shot), 35, 8);
    const dialogue = wrapText(dialogueOf(shot), 32, 3);
    const sound = wrapText(String(shot?.sfx || '').trim(), 32, 3);
    const seconds = Number(shot?.duration) > 0 ? `${Number(shot.duration)} 秒` : String(shot?.metaonticTime || '').trim();
    const heading = wrapText([`镜头 ${String(shot?.title || index + 1).trim()}`, String(shot?.camera || '').trim(), seconds,
      String(shot?.metaonticTime || '').trim() !== seconds ? String(shot?.metaonticTime || '').trim() : ''].filter(Boolean).join('　·　'), 98, 3);
    return { index, shot, visual, dialogue, sound, seconds, heading,
      height: heading.length * 29 + Math.max(400, visual.length * 30 + (dialogue.length + sound.length) * 26 + 72) };
  });
  const bodyHeight = cards.reduce((sum: number, card: any) => sum + card.height + 18, 0);
  const height = headHeight + bodyHeight + 78;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}">`);
  out.push(`<rect width="${width}" height="${height}" fill="#f7f5f0"/>`);
  out.push(`<text x="${pad}" y="58" font-size="34" font-weight="600" fill="#2b2b2b">${escapeXml(title)}</text>`);
  out.push(`<text x="${pad}" y="94" font-size="20" fill="#6e6c68">${escapeXml(meta)}</text>`);
  out.push(`<text x="${pad}" y="122" font-size="17" fill="#8a8880">分镜示意，非实际生成画面；左侧为符号草图，人物、文物与场景外观以参考素材为准。</text>`);
  if (!cards.length) {
    out.push(`<text x="${pad}" y="${headHeight + 40}" font-size="22" fill="#8a8880">脚本里还没有可分镜的表格：先补一个带「镜号 / 镜别 / 视角 / 运镜 / 画面 / 时长」的分镜表。</text>`);
  }
  let y = headHeight;
  for (const card of cards) {
    out.push(`<g><rect x="${pad}" y="${y}" width="${cardWidth}" height="${card.height}" rx="14" fill="#ffffff" stroke="#e2ded6"/>`);
    out.push(`<rect x="${pad}" y="${y}" width="6" height="${card.height}" rx="3" fill="#c9a26a"/>`);
    for (const [i, line] of card.heading.entries()) out.push(`<text x="${pad + inner}" y="${y + 34 + i * 29}" font-size="21" font-weight="600" fill="#3a3a38">${escapeXml(line)}</text>`);
    const top = y + 30 + card.heading.length * 29;
    const sketch = storyboardSketch(visualOf(card.shot), String(card.shot?.camera || ''));
    const fx = pad + inner + (640 - frameWidth) / 2, fy = top + (330 - frameHeight) / 2;
    out.push(`<svg x="${fx}" y="${fy}" width="${frameWidth}" height="${frameHeight}" viewBox="0 0 ${frameWidth} ${frameHeight}" overflow="hidden" data-sketch="${sketch.kind}"><rect width="100%" height="100%" fill="#edf1f2"/><path d="M${frameWidth / 3} 0V${frameHeight} M${frameWidth * 2 / 3} 0V${frameHeight} M0 ${frameHeight / 3}H${frameWidth} M0 ${frameHeight * 2 / 3}H${frameWidth}" stroke="#d9e1e3" stroke-dasharray="5 7"/><svg width="100%" height="100%" viewBox="0 0 320 220">${sketch.markup}</svg></svg>`);
    out.push(`<text x="${pad + inner}" y="${top + 360}" font-size="18" fill="#6e6c68">${escapeXml(sketch.label)} · ${escapeXml(ratio || '画幅未指定')} · 符号示意，非精确构图</text>`);
    const textX = pad + inner + 690;
    let cursor = top + 24;
    for (const text of card.visual) { out.push(`<text x="${textX}" y="${cursor}" font-size="20" fill="#2b2b2b">${escapeXml(text)}</text>`); cursor += 30; }
    cursor += 4;
    for (const [label, lines] of [['台词', card.dialogue], ['声音', card.sound]] as any[]) {
      if (!lines.length) continue;
      for (const [i, text] of lines.entries()) {
        out.push(`<text x="${textX}" y="${cursor}" font-size="18" fill="#7d7a72">${escapeXml(`${i === 0 ? `${label}：` : ''}${text}`)}</text>`);
        cursor += 26;
      }
    }
    out.push('</g>');
    y += card.height + 18;
  }
  out.push(`<text x="${pad}" y="${height - 32}" font-size="17" fill="#8a8880">由 MetaOnticVideo 本地渲染，不调用付费出图模型；实际画面以逐段生成结果为准。</text>`);
  out.push('</svg>');
  return out.join('\n');
}
