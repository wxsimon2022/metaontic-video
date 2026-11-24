/** workflow/storyboard-shots：从脚本正文里解析真实分镜表。
 *  只认表头里同时有「镜号/镜头」与「画面」的 Markdown 表；没有就返回空，不编造镜头或秒数。
 *  渲染分镜示意图使用这一份解析。 */
/** 提取真实剧本分镜表；没有明确的镜头/画面列时不编造镜头或秒数。 */
export function scriptStoryboardShots(script: string) {
  const lines = script.split(/\r?\n/), shots = [];
  const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(s => s.trim().replace(/\\\|/g, '|'));
  let fenced = false;
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) { fenced = !fenced; continue; }
    if (fenced || !lines[i].includes('|')) continue;
    const header = cells(lines[i]), separator = cells(lines[i + 1]);
    if (separator.length !== header.length || !separator.every(x => /^:?-{3,}:?$/.test(x))) continue;
    const titleAt = header.findIndex(x => /镜号|镜头|shot/i.test(x));
    const visualAt = header.findIndex(x => /画面|visual|详情|描述/i.test(x));
    if (titleAt < 0 || visualAt < 0 || titleAt === visualAt) continue;
    const timeAt = header.findIndex(x => /时间|时长|time|duration/i.test(x));
    // 镜别、视角与运镜分成多列时都要保留，按表头顺序拼成一段镜头说明；
    // 一列里若同时写了景别与运镜（如「景别及运镜」），同一列只算一次，不重复拼。
    const framingAt = header.findIndex(x => /景别|镜别|shot\s*size/i.test(x));
    const viewAt = header.findIndex(x => /视角|机位角度|view\s*angle|angle|perspective/i.test(x));
    const moveAt = header.findIndex(x => /运镜|camera|movement/i.test(x));
    const cameraAt = [...new Set([framingAt, viewAt, moveAt].filter(j => j >= 0))].sort((a, b) => a - b);
    const soundAt = header.findIndex(x => /声音|音效|sound|sfx/i.test(x));
    const dialogueAt = header.findIndex(x => /台词|对白|dialogue/i.test(x));
    for (i += 2; i < lines.length && lines[i].includes('|') && lines[i].trim(); i++) {
      const row = cells(lines[i]);
      if (row.length !== header.length || !row[visualAt]) continue;
      const time = row[timeAt] || '', range = time.match(/(\d+(?:\.\d+)?)\s*(?:秒|s)?\s*[–—~～至-]\s*(\d+(?:\.\d+)?)/i);
      const explicit = time.match(/^(\d+(?:\.\d+)?)\s*(?:秒|s)$/i);
      const duration = range ? Number(range[2]) - Number(range[1]) : explicit ? Number(explicit[1]) : null;
      shots.push({ title: row[titleAt], visual: header.map((h, j) => `${h}：${row[j]}`).join('\n'),
        camera: cameraAt.map(j => row[j]).filter(Boolean).join(' · '), sfx: row[soundAt] || '',
        dialogue: row[dialogueAt] ? [{ role: '剧本对白', line: row[dialogueAt] }] : [],
        ...(duration > 0 ? { duration } : {}), metaonticTime: time });
    }
    i--;
  }
  return shots;
}
