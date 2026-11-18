/** workflow/script-capture：脚本只在用户可见正文里生成一次，插件据此落 script.md。
 *  以前助手先用写文件工具把脚本写一遍、再在正文里重贴一遍，同一段内容要模型输出两次（实测多花 10–25 秒
 *  和等量 token）。现在正文就是唯一来源：这里从正文里截出脚本本体，去掉寒暄、分镜图与链接。 */

const IMAGE_OR_LINK = /^!?\[[^\]]*\]\([^)]*\)$/;
const ONLY_TARGET = /^<[^>]+>$/;
const RULE = /^([-*_]\s*){3,}$/;

/** 只截脚本本体：从第一个「# 」标题起，到末尾；结尾的图片、链接、分隔线与空行丢掉，寒暄不会写进脚本。 */
export function captureScriptBody(text: any) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex(line => /^#\s+\S/.test(line));
  if (start < 0) return '';
  const kept = lines.slice(start);
  while (kept.length) {
    const line = kept[kept.length - 1].trim();
    if (!line || RULE.test(line) || IMAGE_OR_LINK.test(line) || ONLY_TARGET.test(line)) { kept.pop(); continue; }
    break;
  }
  const body = kept.join('\n').trim();
  // 太短说明正文里没有完整脚本（只给了摘要或链接），交给调用方报错，不伪造脚本。
  return body.length >= 200 ? body : '';
}
