/** 本地诊断日志：固定字段、有限容量、失败不改变制作结果。 */
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { dshHome } from '../paths/index.js';
import { mkdir, appendFile, readdir, lstat, unlink, rmdir } from 'node:fs/promises';
import { PLUGIN_VERSION } from '../constants/version.js';
import { DATA_DIR } from '../constants/plugin.js';

export const requestLogContext = new AsyncLocalStorage<Record<string, unknown>>();
export const LOG_POLICY = { retentionDays: 30, totalBytes: 50 * 1024 * 1024, dailyBytes: 5 * 1024 * 1024, queueLimit: 256 };
const fields = new Set(('event callId sessionId projectId jobId taskId tool stage spanId parentSpanId startedAt finishedAt elapsedMs outcome errorCode errorCategory httpStatus upstreamRequestId requestId operation method provider model duration resolution imageCount videoCount taskStatus completionTokens index actualSeconds plannedCumulative mode segmentCount sourceCount segmentSeconds done resuming paused cancelled truncated characters chunks bytes responseBytes instructionBytes inputBytes promptTokens turn version closedSpanId closedElapsedMs coverage action status source reason').split(' '));
const pathFields = new Set('path sourcePath videoPath previewPath resumeDir segmentsDir'.split(' '));
const listFields = new Set(['files', 'inputPaths']);
const preparedDirs = new Set<string>();
const health = { written: 0, dropped: 0, failures: 0, cleanupFailures: 0, lastErrorCode: '', lastFailureAt: '', lastSuccessAt: '' };
let pending = 0;
let queue: Promise<void> = Promise.resolve();
const maintenance = new Map<string, number>();

export function logDiagnostics() { return { ...health, pending, policy: { ...LOG_POLICY } }; }
function safeString(value: string) {
  return value.replace(/https?:\/\/[^\s<>]+/gi, '[url]')
    .replace(/\b(?:Bearer\s+[^\s,;]+|sk-[a-z0-9_-]+)\b/gi, '[redacted]')
    .replace(/((?:api[_-]?key|access[_-]?token|authorization|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, 256);
}
/** 不递归序列化调用方对象，未知字段、正文、URL和原始错误一律不落盘。 */
export function sanitizeLogRecord(record: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record || {})) {
    if (key === 'cuts' && Array.isArray(value)) {
      clean.cuts = value.slice(0, 100).map(item => Object.fromEntries(['index','seconds','tailSeconds'].filter(k => typeof item?.[k] === 'number' && Number.isFinite(item[k])).map(k => [k, item[k]])));
    } else if (pathFields.has(key) && typeof value === 'string') {
      // 保留文件名供定位，不写用户目录、签名地址或查询参数。
      clean[key] = safeString(value.split(/[?#]/)[0].split(/[\\/]/).pop() || '');
    } else if (listFields.has(key) && Array.isArray(value)) {
      clean[key] = value.slice(0, 20).filter(v => typeof v === 'string').map(v => safeString(v.split(/[?#]/)[0].split(/[\\/]/).pop() || ''));
    } else if (fields.has(key)) {
      if (typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean') clean[key] = value;
      else if (typeof value === 'string') {
        // reason 只接受固定分类；旧调用点的自由错误消息不可写入。
        if (key === 'reason' && !/^[a-z][a-z0-9_]{0,79}$/.test(value)) continue;
        clean[key] = safeString(value);
      }
    }
  }
  return clean;
}
function requestLogPath() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return path.join(dshHome(), 'logs', DATA_DIR, date, 'requests.jsonl');
}

/** 只管理自己的日期目录和普通 requests.jsonl；不跟随链接、不递归删除用户文件。 */
export async function pruneRequestLogs(root: string, current: string, now = Date.now()) {
  const files: { file: string; dir: string; size: number; day: number }[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!/^\d{8}$/.test(entry.name) || !entry.isDirectory() || entry.isSymbolicLink()) continue;
    const dir = path.join(root, entry.name);
    const file = path.join(dir, 'requests.jsonl');
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink()) continue;
      const day = new Date(`${entry.name.slice(0,4)}-${entry.name.slice(4,6)}-${entry.name.slice(6,8)}T00:00:00`).getTime();
      if (Number.isFinite(day)) files.push({ file, dir, size: info.size, day });
    } catch (error) { if (error?.code !== 'ENOENT') throw error; }
  }
  files.sort((a,b) => a.day - b.day);
  let total = files.reduce((sum,item) => sum + item.size, 0);
  for (const item of files) {
    if (item.file === current) continue;
    if (item.day >= now - LOG_POLICY.retentionDays * 86400000 && total <= LOG_POLICY.totalBytes) continue;
    await unlink(item.file); total -= item.size;
    preparedDirs.delete(item.dir);
    try { await rmdir(item.dir); } catch (error) { if (!['ENOTEMPTY','EEXIST','ENOENT'].includes(error?.code)) throw error; }
  }
}
export async function appendRequestLog(record) {
  // node --test 默认不写用户目录；集成测试显式指定临时 DSH_HOME 时可验证真实落盘。
  if (typeof process !== 'undefined' && process.env?.NODE_TEST_CONTEXT && !process.env?.DSH_HOME) return;
  if (pending >= LOG_POLICY.queueLimit) { health.dropped++; return; }
  const file = requestLogPath();
  let payload;
  try { payload = { ...sanitizeLogRecord(requestLogContext.getStore() || {}), ...sanitizeLogRecord(record), time: new Date().toISOString(), pluginVersion: PLUGIN_VERSION, logSchemaVersion: 1 }; }
  catch { health.failures++; health.lastErrorCode = 'INVALID_LOG_RECORD'; health.lastFailureAt = new Date().toISOString(); return; }
  pending++;
  const write = queue.then(async () => {
    try {
      const dir = path.dirname(file), root = path.dirname(dir);
      if (!preparedDirs.has(dir)) {
        await mkdir(dir, { recursive: true, mode: 0o700 });
        for (const target of [root, dir]) {
          const info = await lstat(target);
          if (!info.isDirectory() || info.isSymbolicLink()) throw Object.assign(Error(), {code:'UNSAFE_LOG_FILE'});
        }
        if (preparedDirs.size > 32) preparedDirs.clear();
        preparedDirs.add(dir);
      }
      if (Date.now() - (maintenance.get(root) || 0) > 3600000) {
        try { await pruneRequestLogs(root, file); if (maintenance.size > 32) maintenance.clear(); maintenance.set(root, Date.now()); }
        catch { health.cleanupFailures++; maintenance.set(root, Date.now() - 3540000); }
      }
      let size = 0;
      try { const info = await lstat(file); if (!info.isFile() || info.isSymbolicLink()) throw Object.assign(Error(), {code:'UNSAFE_LOG_FILE'}); size = info.size; }
      catch (error) { if (error?.code !== 'ENOENT') throw error; }
      const text = JSON.stringify(payload) + '\n';
      if (size + new TextEncoder().encode(text).length > LOG_POLICY.dailyBytes) { health.dropped++; health.lastErrorCode = 'DAILY_LIMIT'; return; }
      await appendFile(file, text, { mode: 0o600 });
      health.written++; health.lastSuccessAt = new Date().toISOString();
    } catch (error) {
      preparedDirs.delete(path.dirname(file));
      health.failures++; health.lastFailureAt = new Date().toISOString();
      health.lastErrorCode = ['ENOENT','EACCES','EPERM','ENOSPC','UNSAFE_LOG_FILE'].includes(error?.code) ? error.code : 'LOG_WRITE_FAILED';
    } finally { pending--; }
  });
  queue = write.catch(() => {});
  await queue;
}
