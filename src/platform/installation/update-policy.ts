import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { dshHome } from '../../shared/paths/index.js';
import { DATA_DIR } from '../../shared/constants/plugin.js';
import { PLUGIN_VERSION } from '../../shared/constants/version.js';
import { createUpdatePolicy, needsSupportedVersion } from '../../shared/updates/policy.js';

export function createVersionGuard() {
  const file = path.join(dshHome(), 'state', DATA_DIR, 'update-policy.json');
  const policy = createUpdatePolicy({ version: PLUGIN_VERSION,
    read: async () => JSON.parse(await readFile(file, 'utf8')),
    write: async value => {
      await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const temporary = `${file}.${randomUUID()}.tmp`;
      try { await writeFile(temporary, JSON.stringify(value), { mode: 0o600 }); await rename(temporary, file); }
      finally { await unlink(temporary).catch(() => {}); }
    },
  });
  return async (name: string, args: any) => {
    if (!needsSupportedVersion(name, args)) return;
    const state = await policy.refresh();
    if (state.required) throw Object.assign(new Error(`当前插件 v${PLUGIN_VERSION} 已低于最低支持版本 v${state.minimum}。请打开插件设置，检查更新并确认升级到最新正式版后继续。已有任务请用 video_status 查询，图片任务可按原 taskId 取件；不会自动重提任务或产生新费用。`), { code: 'PLUGIN_UPDATE_REQUIRED' });
  };
}
