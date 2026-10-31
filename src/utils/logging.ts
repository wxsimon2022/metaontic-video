/** utils/logging：从宿主入口拆出的独立职责模块。 */
import { AsyncLocalStorage } from 'node:async_hooks';
import path from 'node:path';
import { dshHome } from '../media/references.js';
import { mkdir, appendFile } from 'node:fs/promises';
import { PLUGIN_VERSION } from '../config.js';

/** 日志仅包含白名单字段；每日一个JSONL文件，不写请求体、鉴权头或输出URL。 */
export const requestLogContext = new AsyncLocalStorage<Record<string, unknown>>();

export function requestLogPath() {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return path.join(dshHome(), 'logs', 'metaontic-video', date, 'requests.jsonl');
}

export async function appendRequestLog(record) {
  try {
    const file = requestLogPath();
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await appendFile(file, JSON.stringify({ time: new Date().toISOString(), pluginVersion: PLUGIN_VERSION, ...requestLogContext.getStore(), ...record }) + '\n', { mode: 0o600 });
  } catch {
    // 日志不可写不能改变生成结果，也不能因此重提付费请求。
  }
}
