/** 旁路匿名统计：调用方不等待网络；队列、超时、重试与退出均有界。 */
import { randomUUID, createHash } from 'node:crypto';
import { acquireFileLock } from '../../shared/utils/file-lock.js';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { dshHome } from '../../shared/paths/index.js';
import { PLUGIN_VERSION } from '../../shared/constants/version.js';
import { ref } from '../settings/value.js';
import { ANALYTICS_URL, DATA_DIR, PLUGIN_ID, PLUGIN_PACKAGE } from '../../shared/constants/plugin.js';

export { ANALYTICS_URL } from '../../shared/constants/plugin.js';
const STATE = Symbol.for(`${PLUGIN_ID}.analytics.process`);
const EVENTS = new Set(['plugin_started', 'plugin_installed', 'tool_started', 'tool_finished', 'video_task_created', 'video_task_finished']);
const TOOLS = new Set(['video_generate', 'video_extend', 'video_status', 'video_project', 'video_prepare_image', 'video_estimate', 'video_script', 'video_config', 'video_setup', 'video_stage', 'media_submission', 'video_hyperframes']);
const STATUSES = new Set(['succeeded', 'failed', 'cancelled', 'unknown', 'timeout', 'approved', 'pending', 'paused', 'prepared', 'draft', 'blocked', 'review_required', 'submission_unknown', 'ok']);
const ERRORS = new Set(['provider_auth', 'provider_failed', 'provider_network_error', 'provider_rate_limited', 'provider_quota_exceeded', 'provider_price_config_error', 'provider_bad_response', 'content_rejected', 'real_person_rejected', 'submission_unknown', 'waiting_stopped', 'ABORTED']);
const INSTALL_SOURCES = new Set(['npm', 'tgz', 'directory', 'git', 'bundled', 'unknown']);
function processState() {
  const owner = globalThis as any;
  return owner[STATE] ||= { identities: new Map(), started: new Set() };
}
/** 匿名安装标识的两个落盘位置：主文件与冗余锚点，同一目录、同一身份。
 *  只丢一个文件不算新设备：删掉主文件就用锚点把身份补回来，主文件还在就顺手把锚点补齐。
 *  做不到的边界见 docs/engineering/analytics.md（整个状态目录被清掉、或整份宿主数据目录被复制到另一台机器）。 */
function identityFiles() {
  const dir = path.join(dshHome(), 'state', DATA_DIR);
  return { dir, files: [path.join(dir, 'analytics-id.json'), path.join(dir, 'analytics-anchor.json')] };
}
export async function analyticsIdentity() {
  const { dir, files } = identityFiles();
  const state = processState();
  // 一个进程只解析一次；键用目录而不是单个文件，因为身份现在有两个落盘位置。
  if (!state.identities.has(dir)) state.identities.set(dir, (async () => {
    const parse = raw => { try { const id = JSON.parse(raw).installationId; return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) ? id : null; } catch { return null; } };
    await mkdir(dir, { recursive: true, mode: 0o700 });
    let release;
    // 初始化在后台进行。只等待有界时间，不抢活跃进程的锁；失败后下次上报再试。
    for (let attempt = 0; attempt < 40; attempt++) {
      try { release = await acquireFileLock(path.join(dir, 'analytics-identity.lock'), { recoverDead: true }); break; }
      catch (error) {
        if (error?.code !== 'EEXIST' && ! /^(?:PROJECT_LOCKED|LOCK_RECOVERY_UNSAFE|RECOVERY_LOCK_UNSAFE):/.test(String(error?.message || ''))) throw error;
        if (attempt === 39) throw error;
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    try {
      // 必须在拿锁后重新读取，避免多个进程各自缓存不同身份。
      const present = [];
      for (const file of files) {
        try { present.push(parse(await readFile(file, 'utf8'))); }
        catch (error) { if (error?.code !== 'ENOENT') throw error; present.push(null); }
      }
      const id = present[0] || present[1] || randomUUID();
      for (const [index, file] of files.entries()) {
        if (present[index] === id) continue;
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, JSON.stringify({ installationId: id }), { mode: 0o600, flag: 'wx' });
          await rename(temporary, file);
        } finally { await unlink(temporary).catch(() => {}); }
      }
      return id;
    } finally { await release?.(); }
  })().catch(() => { state.identities.delete(dir); return null; }));
  return state.identities.get(dir);
}
/** 先独占落盘再排队：结果未知也不重报，跨进程/更新/普通重装复用标记。 */
export async function claimDeviceRegistration(id: string) {
  if (!/^[a-f0-9-]{36}$/i.test(id)) return false;
  const { dir } = identityFiles();
  try {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    const key = createHash('sha256').update(id).digest('hex');
    await writeFile(path.join(dir, `registered-${key}.json`), JSON.stringify({ registered: true }), { flag: 'wx', mode: 0o600 });
    return true;
  } catch { return false; } // 无法确认是否登记过时宁可少报，不解锁重试。
}
/** 上报数据只允许固定枚举和有界数值，禁止透传执行参数/异常/提示词。 */
export function analyticsFields(input: any = {}) {
  const value: any = {};
  if (TOOLS.has(input.tool)) value.tool = input.tool;
  if (INSTALL_SOURCES.has(input.installSource)) value.installSource = input.installSource;
  if (['video-director', 'standard'].includes(input.mode)) value.mode = input.mode;
  if (STATUSES.has(input.status)) value.status = input.status;
  if (typeof input.durationMs === 'number' && Number.isFinite(input.durationMs)) value.durationMs = Math.round(Math.max(0, Math.min(86400000, input.durationMs)));
  if (typeof input.errorCode === 'string') value.errorCode = ERRORS.has(input.errorCode) ? input.errorCode : 'other';
  return value;
}
/** 安装来源只保留固定枚举；完整 URL、路径与凭据永远不进入上报字段。 */
export function installSourceOf(source: unknown) {
  const value = typeof source === 'string' ? source.trim() : '';
  if (!value) return 'bundled';
  if (/^link:|^file:|^[a-z]:[\\/]|^[\\/]|^~[\\/]/i.test(value)) return 'directory';
  if (/\.(?:tgz|tar\.gz)(?:[?#].*)?$/i.test(value)) return 'tgz';
  if (/^(?:git\+|git:|ssh:|git@)/i.test(value) || /\.git(?:[?#].*)?$/i.test(value)) return 'git';
  if (/^npm:/i.test(value) || value === PLUGIN_PACKAGE
    || /^dsh-metaontic-video@(?:latest|next|\^|~|>=?|\*)$/i.test(value)
    || /@\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(value)
    || /^(?:latest|next|\^|~|>=?|\*)/i.test(value)) return 'npm';
  return 'unknown';
}
/** 读取宿主安装记录时失败就返回 unknown；调用方永远不会等待它完成。 */
async function currentInstallSource(ctx: any, timeoutMs = 1000) {
  let timer: any;
  try {
    const manager = ctx?.get?.('pluginManager') || ctx?.get?.('remote.pluginManager')
      || ctx?.get?.('remote')?.pluginManager || ctx?.remote?.pluginManager;
    if (!manager || typeof manager.listBundles !== 'function') return 'unknown';
    const listed = await Promise.race([
      Promise.resolve(manager.listBundles()),
      new Promise(resolve => { timer = setTimeout(() => resolve(undefined), timeoutMs); timer.unref?.(); }),
    ]);
    const rows = Array.isArray(listed) ? listed : listed?.ok === true && Array.isArray(listed.value) ? listed.value : [];
    const bundle = rows.find((item: any) => item?.name === PLUGIN_PACKAGE && item?.installed === true);
    return bundle ? installSourceOf(bundle.source) : 'unknown';
  } catch { return 'unknown'; }
  finally { clearTimeout(timer); }
}
/** 设备字段只保留服务端白名单允许的字符；清空后回退 unknown，避免一条越界字段让整批 422 被拒。 */
function deviceText(value: unknown, allowSpace: boolean) {
  return String(value ?? '').replace(allowSpace ? /[^a-zA-Z0-9.+_ -]/g : /[^a-zA-Z0-9.+_-]/g, '').slice(0, 64) || 'unknown';
}
/** 只有正式版 X.Y.Z 计入统计：测试版（如 3.22.9-test.2）与未注入版本号的开发构建一律不上报。 */
export function isReleaseVersion(version: unknown) {
  return /^\d+\.\d+\.\d+$/.test(String(version ?? '').trim().replace(/^v/i, ''));
}
export function createAnalyticsReporter(config, options: any = {}) {
  const releaseBuild = options.releaseBuild || (() => isReleaseVersion(PLUGIN_VERSION));
  // 测试版连匿名身份文件都不写、定时器也不起，统计流量完全为零。
  if (!releaseBuild()) return { record() {}, start() {}, watchInstallOperations: () => () => {}, dispose() {}, flush: async () => {}, pending: () => 0 };
  const enabled = options.enabled || (() => process.env.METAONTIC_VIDEO_ANALYTICS_DISABLED !== '1' && ref(config, 'usageStatsEnabled', true) !== false);
  const request = options.request || ((...args) => (globalThis.fetch as any)(...args));
  const identity = options.identity || analyticsIdentity;
  const claimRegistration = options.claimRegistration || claimDeviceRegistration;
  const device = options.device || (() => ({
    arch: ['arm64', 'x64', 'ia32', 'arm'].includes(os.arch()) ? os.arch() : 'other',
    osRelease: deviceText(os.release(), true),
    memoryGb: Math.max(1, Math.min(4096, Math.round(os.totalmem() / 1024 ** 3))),
    harnessVersion: deviceText(process.env.DSH_CLIENT_VERSION || process.env.DSH_APP_VERSION, false),
  }));
  const delay = options.delayMs ?? 1000;
  const timeout = options.timeoutMs ?? 1500;
  const maxQueue = options.maxQueue ?? 200;
  let queue: any[] = [], timer: any, controller: AbortController | null = null;
  let disposed = false, sending = false;
  const allowed = () => { try { return !disposed && enabled(); } catch { return false; } };
  function schedule(ms = delay) {
    if (!allowed() || timer || sending || !queue.length) return;
    timer = setTimeout(() => { timer = null; void flush(); }, ms);
    timer.unref?.();
  }
  async function flush() {
    if (!allowed()) { queue = []; return; }
    if (sending || !queue.length) return;
    sending = true;
    const batch = queue.splice(0, 20);
    let watchdog: any;
    try {
      const installationId = await identity();
      if (!installationId || !allowed()) return;
      controller = new AbortController();
      // 即使替身/网络不响应abort，也在本地结束等待，不占用后续队列。
      const abort = new Promise((_, reject) => {
        watchdog = setTimeout(() => { controller?.abort(); reject(new Error('analytics timeout')); }, timeout);
        watchdog.unref?.();
      });
      const response: any = await Promise.race([Promise.resolve().then(() => request(ANALYTICS_URL, {
        method: 'POST', redirect: 'error', credentials: 'omit',
        headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ installationId, device: device(), events: batch.map(({ attempts, ...event }) => event) }),
      })), abort]);
      try { void response?.body?.cancel()?.catch(() => {}); } catch { /* optional response body */ }
      if (!response?.ok) throw new Error('analytics rejected');
    } catch {
      if (allowed()) {
        const retry = batch.filter(event => !['plugin_started', 'plugin_installed'].includes(event.name)).map(event => ({ ...event, attempts: event.attempts + 1 })).filter(event => event.attempts < 3);
        queue = [...retry, ...queue].slice(-maxQueue);
      }
    } finally {
      clearTimeout(watchdog); controller = null; sending = false;
      if (allowed() && queue.length) schedule(queue[0].attempts ? Math.min(30000, 1000 * 5 ** queue[0].attempts) : delay);
    }
  }
  function record(name, input: any = {}, dedupeKey = '') {
    try {
      if (!allowed()) { queue = []; return; }
      if (!EVENTS.has(name)) return;
      // 服务端事件契约尚未声明的新业务工具不混入批次，避免一条未知事件拖累整批。
      const fields = analyticsFields(input);
      if (!['plugin_started', 'plugin_installed'].includes(name) && !fields.tool) return;
      const rawTime = Date.parse(String(input.occurredAt || ''));
      const occurredAt = Number.isFinite(rawTime) && rawTime <= Date.now() + 300000 && rawTime >= Date.now() - 30 * 86400000
        ? new Date(rawTime).toISOString() : new Date().toISOString();
      // 更新安装时监听器仍运行在旧版本；安装事件应记录宿主操作实际装上的版本。
      const installedVersion = name === 'plugin_installed' ? String(input.version || '').trim().replace(/^v/i, '') : '';
      const version = /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(installedVersion) ? installedVersion : PLUGIN_VERSION;
      const event = { eventId: randomUUID(), name, occurredAt, version,
        platform: ['darwin', 'win32', 'linux'].includes(process.platform) ? process.platform : 'other',
        ...fields, attempts: 0 };
      if (['plugin_started', 'plugin_installed'].includes(name)) {
        void Promise.resolve().then(() => identity()).then(async id => {
          if (!id || !allowed() || !await claimRegistration(id) || !allowed()) return;
          // 两种登记入口共用同一事件ID，避免客户端旧状态或重复接收导致重复计数。
          event.eventId = createHash('sha256').update(`${id}:device_registration`).digest('hex');
          queue.push(event); queue = queue.slice(-maxQueue); schedule();
        }).catch(() => {});
        return;
      }
      // taskId只在本地参与散列，服务端不接收原任务ID。
      if (dedupeKey) {
        void Promise.resolve().then(() => identity()).then(id => {
          if (!id || !allowed()) return;
          event.eventId = createHash('sha256').update(`${id}:${name}:${dedupeKey}`).digest('hex');
          queue.push(event); queue = queue.slice(-maxQueue); schedule();
        }).catch(() => {});
      } else { queue.push(event); queue = queue.slice(-maxQueue); schedule(); }
    } catch { /* 统计失败绝不改变工具行为 */ }
  }
  function start() {
    // 身份读写也在后台，apply/工具入口不await。
    void Promise.resolve().then(() => allowed() ? identity() : null).then(id => {
      if (!id || !allowed()) return;
      const starts = options.started || processState().started;
      if (!starts.has(id)) { starts.add(id); record('plugin_started'); }
    }).catch(() => {});
  }
  /** 宿主的真实安装结果在插件激活后发出；这里只旁路监听，不参与安装与加载。 */
  function watchInstallOperations(ctx: any) {
    try {
      if (!ctx || typeof ctx.on !== 'function') return () => {};
      return ctx.on('plugin-manager/operation', (operation: any) => {
        try {
          if (!operation || operation.phase !== 'settled' || operation.reason !== 'install'
            || operation.target !== PLUGIN_PACKAGE || operation.stage !== 'enable' || operation.changed !== true
            || operation.errorCode || !['applied', 'restart-required'].includes(operation.application)) return;
          const key = String(operation.id || `${operation.time || ''}:${operation.version || ''}`);
          void currentInstallSource(ctx).then(installSource => {
            try { record('plugin_installed', { installSource, occurredAt: operation.time, version: operation.version }, key); }
            catch { /* 安装统计失败不影响插件 */ }
          }).catch(() => {});
        } catch { /* 监听器自身失败不影响宿主安装流程 */ }
      });
    } catch { return () => {}; }
  }
  function dispose() { disposed = true; queue = []; clearTimeout(timer); controller?.abort(); }
  return { record, start, watchInstallOperations, dispose, flush, pending: () => queue.length };
}
export function reportUsage(exec, name, fields, key = '') {
  try { exec?.metaonticAnalytics?.record(name, fields, key); } catch { /* optional */ }
}
export function withUsageAnalytics(tool, reporter, mode = (_exec) => 'standard') {
  return { ...tool, async execute(args, exec) {
    const started = Date.now();
    let selected = 'standard';
    try { selected = mode(exec); } catch { /* optional preset registry */ }
    try { reporter.record('tool_started', { tool: tool.name, mode: selected }); } catch { /* isolated */ }
    try {
      const result = await tool.execute(args, { ...exec, name: tool.name, metaonticAnalytics: reporter, metaonticMode: selected });
      try { reporter.record('tool_finished', { tool: tool.name, mode: selected, status: result?.status || 'ok', durationMs: Date.now() - started, errorCode: result?.errorCode }); } catch { /* isolated */ }
      return result;
    } catch (error) {
      try { reporter.record('tool_finished', { tool: tool.name, mode: selected, status: 'failed', durationMs: Date.now() - started, errorCode: error?.code || 'other' }); } catch { /* isolated */ }
      throw error;
    }
  } };
}
