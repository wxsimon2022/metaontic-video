/** 只检查明确声明的待确认章节，风险/建议不自动变成人工审批。 */
export function pendingScriptQuestions(script: string): string[] {
  const questions: string[] = [];
  let active = false;
  let depth = 0;
  for (const line of script.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line.trim());
    if (heading) {
      if (active && heading[1].length <= depth) active = false;
      if (/^(?:[一二三四五六七八九十\d]+[、.．）)]\s*)?(?:用户)?待确认(?:问题|事项)?(?:\s*[（(:：]|\s*$)/.test(heading[2])) {
        active = true;
        depth = heading[1].length;
      }
      continue;
    }
    if (!active) continue;
    const value = line.trim().replace(/^(?:[-*+]\s+|\d+[.、）)]\s*)/, '').trim();
    if (!value || /^(?:无|暂无|无待确认(?:事项|问题)?|无需确认|均已确认|已全部确认)[。.!！]?$/.test(value)) continue;
    questions.push(value);
  }
  return [...new Set(questions)];
}
