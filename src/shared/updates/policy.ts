import { GITEE, GITHUB, PLUGIN_PACKAGE } from '../constants/plugin.js';

export const UPDATE_POLICY_URLS = [
  `${GITEE.api}/contents/config/update-policy.json?ref=master`,
  `${GITHUB.api}/contents/config/update-policy.json?ref=master`,
];
export const UPDATE_POLICY_INTERVAL_MS = 5 * 60 * 1000;
export const UPDATE_POLICY_CACHE_KEY = 'metaontic-video.minimum-version-v1';
export interface UpdatePolicy {
  schema_version: 1;
  package_name: string;
  revision: number;
  minimum_version: string;
}
const stable = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) && value.split('.').every(n => Number.isSafeInteger(Number(n)));
export function versionBelow(current: string, minimum: string) {
  // 测试包按同核心号的正式版之前处理；未知版本不据此锁死客户端。
  const match = /^(\d+\.\d+\.\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(current);
  if (!match || !stable(match[1]) || !stable(minimum)) return false;
  const a = match[1].split('.').map(Number), b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return Boolean(match[2]);
}
export function parseUpdatePolicy(value: any): UpdatePolicy | null {
  if (value?.schema_version !== 1 || value.package_name !== PLUGIN_PACKAGE ||
      !Number.isSafeInteger(value.revision) || value.revision < 1 || !stable(value.minimum_version)) return null;
  return { schema_version: 1, package_name: PLUGIN_PACKAGE, revision: value.revision, minimum_version: value.minimum_version };
}

export function repositoryUpdatePolicy(value: any): UpdatePolicy | null {
  // 仓库 contents API 返回 base64，避免 raw 地址跨域重定向及下载域名不可达。
  if (value?.type !== 'file' || value.encoding !== 'base64' || typeof value.content !== 'string' || value.content.length > 32 * 1024) return null;
  try {
    const bytes = Uint8Array.from(atob(value.content.replace(/\s/g, '')), char => char.charCodeAt(0));
    return parseUpdatePolicy(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { return null; }
}

/** 公开只读请求，不携带本机凭据；即使网络替身不响应 abort，等待也有上限。 */
export async function policyJson(url: string, request: typeof fetch = fetch, timeoutMs = 4000) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      (async () => {
        const response = await request(url, { signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store', headers: { accept: 'application/json' } });
        if (!response.ok) throw Error('UPDATE_POLICY_HTTP_ERROR');
        const text = await response.text();
        if (text.length > 64 * 1024) throw Error('UPDATE_POLICY_TOO_LARGE');
        return JSON.parse(text);
      })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('UPDATE_POLICY_TIMEOUT')); }, timeoutMs); }),
    ]);
  } finally { clearTimeout(timer!); }
}

/** 提高门槛之前，至少一个发布渠道必须有对应正式版及可安装成品。 */
export async function publishedPolicyVersion(version: string, request: typeof fetch = fetch) {
  if (!stable(version)) return false;
  const release = async (channel: typeof GITEE) => {
    const data = await policyJson(`${channel.api}/releases/tags/v${version}`, request);
    return data.tag_name === `v${version}` && data.draft !== true && data.prerelease !== true &&
      Array.isArray(data.assets?.links || data.assets) && (data.assets?.links || data.assets).some((asset: any) =>
        asset.name === `metaontic-video-${version}.tgz` &&
        typeof (asset.browser_download_url || asset.direct_asset_url) === 'string' &&
        (asset.browser_download_url || asset.direct_asset_url).startsWith(`${channel.web}/releases/`));
  };
  const results = await Promise.allSettled([release(GITEE), release(GITHUB)]);
  return results.some(result => result.status === 'fulfilled' && result.value === true);
}

/** 主进程与界面复用协议。缓存已验证策略，断网不解除已知限制；首次离线不凭空封禁。 */
export function createUpdatePolicy({ version, request = (input, init) => globalThis.fetch(input, init), read = async () => null, write = async (_value: any) => {}, now = Date.now, intervalMs = UPDATE_POLICY_INTERVAL_MS, verify = (v: string) => publishedPolicyVersion(v, request) }: {
  version: string; request?: typeof fetch; read?: () => Promise<any>; write?: (value: any) => Promise<void>;
  now?: () => number; intervalMs?: number; verify?: (version: string) => Promise<boolean>;
}) {
  let policy: UpdatePolicy | null = null, persistedRevision = 0, checkedAt = 0, attempted = false, loading: Promise<any> | null = null, hydrated = false;
  const listeners = new Set<() => void>();
  const snapshot = () => ({ policy, required: Boolean(policy && versionBelow(version, policy.minimum_version)), minimum: policy?.minimum_version || '', checkedAt });
  const emit = () => { for (const listener of listeners) { try { listener(); } catch { /* 单个界面不影响守卫 */ } } };
  async function refresh(force = false) {
    if (loading) return loading;
    if (!force && attempted && now() - checkedAt >= 0 && now() - checkedAt < intervalMs) return snapshot();
    loading = (async () => {
      if (!hydrated) {
        try { policy = parseUpdatePolicy((await read())?.policy); persistedRevision = policy?.revision || 0; } catch { /* 缓存不可读仍检查线上 */ }
        hydrated = true;
        emit();
      }
      try {
        const results = await Promise.allSettled(UPDATE_POLICY_URLS.map(url => policyJson(url, request)));
        const candidates = results.flatMap(result => {
          const parsed = result.status === 'fulfilled' ? repositoryUpdatePolicy(result.value) : null;
          return parsed ? [parsed] : [];
        }).sort((a, b) => b.revision - a.revision);
        const next = candidates[0];
        const conflict = next && candidates.some(p => p.revision === next.revision && p.minimum_version !== next.minimum_version);
        if (next && !conflict && (!policy || next.revision > policy.revision) && await verify(next.minimum_version)) {
          policy = next;
        }
      } catch { /* 保留最后验证成功的策略 */ }
      if (policy && persistedRevision < policy.revision) {
        try { await write({ policy }); persistedRevision = policy.revision; } catch { /* 本轮仍执行限制，下轮重试保存 */ }
      }
      checkedAt = now(); attempted = true; emit();
      return snapshot();
    })();
    try { return await loading; } finally { loading = null; }
  }
  return { snapshot, refresh, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}

/** 只读、已有上游任务取件及本地成果处理不受限制；续拍会新增付费任务，不能借 resume 绕过。 */
export function needsSupportedVersion(name: string, args: any = {}) {
  if (['video_generate', 'video_extend'].includes(name)) return true;
  if (name === 'video_prepare_image') return !String(args?.taskId || '').trim();
  if (name === 'video_project') return ['prepare', 'review', 'storyboard'].includes(args?.action);
  if (name === 'film_project') return !['read', 'next', 'route', 'validate', 'export', 'diagnose', 'review_context', 'capabilities', 'recover_lock', 'task_result'].includes(args?.action);
  return false;
}
