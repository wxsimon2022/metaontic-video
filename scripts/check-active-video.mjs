/** 构建/热替换前只读检查宿主的视频执行记录；不停止任务或清理记录。 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const states = new Map();
function scan(value) {
  if (Array.isArray(value)) { for (const item of value) scan(item); return; }
  if (!value || typeof value !== 'object') return;
  if (value.callId && ['start', 'end'].includes(value.phase)) states.set(value.callId, value.phase);
  for (const item of Object.values(value)) scan(item);
}
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.endsWith('.jsonl')) {
      for (const line of (await readFile(file, 'utf8')).split('\n')) {
        if (!line.includes('plugin:metaontic-video/execution')) continue;
        try { scan(JSON.parse(line)); }
        catch { throw new Error(`无法解析视频执行记录：${file}；请先核对任务状态。`); }
      }
    }
  }
}
await walk(path.join(home, 'sessions'));
const active = [...states.values()].filter(value => value === 'start').length;
console.log(`未闭合视频执行记录：${active}`);
if (active) { console.error('先核对任务是否执行中；任务结束前不构建或热替换。'); process.exitCode = 2; }
