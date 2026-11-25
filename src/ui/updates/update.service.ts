/** 浏览器端 updates：由入口注入宿主 React 与共享依赖。 */
import {
  GITEE,
  GITHUB,
  PLUGIN_PACKAGE,
  UPDATE_ATTEMPTS,
  UPDATE_CACHE_KEY,
  UPDATE_MAX_AGE_MS,
  UPDATE_SPEC,
  releaseDownloadUrl,
} from '../../shared/constants/plugin.js';
export function createUpdates({ h, fetchSource }: any) {
    // 仓库地址、缓存键与重试次数统一写在 src/shared/constants/plugin.ts。
    /** 构建时由 esbuild --define 注入的版本号；从源码直接跑（没注入）时为空串。 */
    const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string'
      ? __PLUGIN_VERSION__.trim().replace(/^v/i, '')
      : '';

    /** 比较 x.y.z：远端确实比本地新才返回 true；任一边认不出来就当作没有更新。 */
    function isNewerVersion(remote, local) {
      const parse = (text) => {
        const m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(String(text || ''));
        return m ? { core: m.slice(1,4).map(Number), pre: m[4]?.split('.') || [] } : null;
      };
      const next = parse(remote), current = parse(local);
      if (!next || !current) return false;
      for (let i = 0; i < 3; i++) if (next.core[i] !== current.core[i]) return next.core[i] > current.core[i];
      if (!next.pre.length || !current.pre.length) return !next.pre.length && Boolean(current.pre.length);
      for (let i = 0; i < Math.max(next.pre.length, current.pre.length); i++) {
        const a = next.pre[i], b = current.pre[i];
        if (a === b) continue;
        if (a === undefined || b === undefined) return b === undefined;
        const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
        if (an && bn) return Number(a) > Number(b);
        if (an !== bn) return !an;
        return a > b;
      }
      return false;
    }

    function updateBell(t, latest, current) {
      if (!isNewerVersion(latest, current)) return null;
      const label = t('versionNew', { version: latest });
      return h('span', { key: 'update-bell', className: 'mov-update-bell', 'data-field': 'update-bell', role: 'img', 'aria-label': label, title: label },
        h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, [
          h('path', { key: 'body', d: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9' }),
          h('path', { key: 'clapper', d: 'M10 21h4M12 2V1' }),
        ]));
    }

    /** 带超时的 GET（检查更新只读公开文件，不带任何本机凭据）。 */
    async function fetchUpdateSource(url, ms = 12000) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), ms) : null;
      try {
        const response = await fetch(url, {
          headers: { accept: 'application/json' },
          signal: controller ? controller.signal : undefined,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { json: async () => data };
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    }

    /** 版本检查只读取正式版仓库，不请求 npm 中国镜像。 */
    async function fetchRecentVersions() {
      const urls = [
        `${GITEE.api}/releases?per_page=100`,
        `${GITHUB.api}/releases?per_page=100`,
      ];
      const results = await Promise.allSettled(urls.map(async url => {
        const body = await (await (fetchSource || fetchUpdateSource)(url, 6000)).json();
        if (!Array.isArray(body)) throw new Error('invalid releases');
        return body.filter(r => !r.draft && !r.prerelease)
          .map(r => String(r.tag_name || '').replace(/^v/, ''))
          .filter(version => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version));
      }));
      const versions = [...new Set(results.flatMap(r => r.status === 'fulfilled' ? r.value : []))]
        .sort((a,b) => isNewerVersion(a,b) ? -1 : isNewerVersion(b,a) ? 1 : 0).slice(0,3);
      // Release API 可能因匿名限流或跨域故障同时不可用；用仓库主分支的正式包清单兜底。
      // 仅接受 package.version 与 releaseNotes.version 一致且明确标记为正式版的清单。
      if (!versions.length) {
        const manifests = [
          `${GITEE.web}/raw/master/package.json`,
          `https://raw.githubusercontent.com/${GITHUB.slug}/master/package.json`,
        ];
        const fallback = await Promise.allSettled(manifests.map(async url => {
          const manifest = await (await (fetchSource || fetchUpdateSource)(url, 6000)).json();
          const version = String(manifest?.version || '');
          if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)
            || manifest?.releaseNotes?.version !== version
            || manifest?.releaseNotes?.prerelease !== false) throw new Error('invalid stable manifest');
          return version;
        }));
        versions.push(...new Set(fallback.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])));
      }
      if (!versions.length) throw new Error('no published stable releases available; release APIs and manifest fallbacks are unavailable');
      versions.sort((a,b) => isNewerVersion(a,b) ? -1 : isNewerVersion(b,a) ? 1 : 0);
      return versions;
    }
    async function fetchLatestVersion() {
      return (await fetchRecentVersions())[0];
    }

  const PLUGIN_BUILD_ID=typeof __PLUGIN_BUILD_ID__==='string'?__PLUGIN_BUILD_ID__:'';
  return { PLUGIN_BUILD_ID, PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, fetchRecentVersions, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell };
}

/** Only a live response matching both installed version and build identity proves activation. */
export async function verifyRuntimeInstallation(version:string,options:any={}) {
 const get=options.fetcher||(typeof fetch==='function'?fetch:null);
 if(!get)return false;
 for(let i=0;i<(options.attempts??3);i++){
  let timer:any;
  const controller=typeof AbortController==='function'?new AbortController():null;
  try{
   const result:any=await Promise.race([
    (async()=>{const response=await get('/metaontic-video/runtime-version',{cache:'no-store',credentials:'same-origin',signal:controller?.signal});return response.ok?await response.json():null;})(),
    new Promise(resolve=>{timer=setTimeout(()=>{controller?.abort();resolve(null);},options.timeoutMs??1500);}),
   ]);
   const running=result?.running,installed=result?.installed;
   if(running?.version===version&&installed?.version===version&&/^[a-f0-9]{64}$/.test(running?.buildId||'')&&running.buildId===installed.buildId)return true;
  }catch{}finally{if(timer!==undefined)clearTimeout(timer);}
  if(i+1<(options.attempts??3))await (options.wait?options.wait():new Promise(resolve=>setTimeout(resolve,400)));
 }
 return false;
}

export function createUpdateActions(context: any) {
/**
 * 上次的版本检查结果（存在浏览器本地）：`fresh` 表示还没过期，
 * 先用缓存显示结果；进入完整设置页仍会后台刷新，失败时保留缓存。
 */
function readUpdateCache() {
    try {
        const raw = window.localStorage.getItem(context.UPDATE_CACHE_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (!saved || typeof saved !== 'object') {
            return { latest: '', versions: [], at: 0, fresh: false };
        }
        const at = Number(saved.at) || 0;
        return {
            latest: String(saved.latest || ''),
            versions: Array.isArray(saved.versions) ? saved.versions.filter(v => /^\d+\.\d+\.\d+$/.test(v)).slice(0,3) : [],
            at,
            fresh: Boolean(at) && Date.now() - at < context.UPDATE_MAX_AGE_MS,
        };
    }
    catch {
        return { latest: '', versions: [], at: 0, fresh: false };
    }
}

/** 最近三个正式版本及检测时间，旧渠道缓存不再读取。 */
function rememberUpdateCheck(latest, versions = []) {
    try {
        window.localStorage.setItem(context.UPDATE_CACHE_KEY, JSON.stringify({ at: Date.now(), latest, versions }));
    }
    catch {
        // 存不住只是下次打开会再查一遍，不影响这次的显示
    }
}

/** 更新成功后清掉缓存：新版本这次启动就该重新比对一次，不然还挂着「有新版本」。 */
function forgetUpdateCheck() {
    try {
        window.localStorage.removeItem(context.UPDATE_CACHE_KEY);
    }
    catch {
        // 清不掉只是下次打开可能还显示旧结果，不影响更新本身
    }
}

/**
 * 检查更新：读取最近三个已发布正式版本。
 * silent 用于打开设置页时的自动检查——失败不打扰用户，页面上还是上次的结果。
 */
async function checkForUpdate(silent = false) {
    if (!silent) {
        context.setUpdateDeferred?.('');
        try { window.localStorage.removeItem(`${context.UPDATE_CACHE_KEY}.deferred`); } catch {}
        context.setUpdateStatus('working');
        context.setUpdateMessage('');
    }
    const request = context.updateRequest ? ++context.updateRequest.current : 0;
    try {
        const versions = context.fetchRecentVersions ? await context.fetchRecentVersions() : [await context.fetchLatestVersion()];
        const latest = versions[0];
        if (context.updateRequest && request !== context.updateRequest.current) return '';
        context.setUpdateConfirm?.(false);
        context.setUpdateLatest(latest);
        context.setUpdateAt(new Date().toLocaleTimeString());
        context.setUpdateStatus('ok');
        rememberUpdateCheck(latest, versions);
        return latest;
    }
    catch (error) {
        if (context.updateRequest && request !== context.updateRequest.current) return '';
        if (silent)
            return '';
        context.setUpdateStatus('failed');
        context.setUpdateMessage(context.t('versionFailed', { message: error?.message || String(error) }));
        return '';
    }
}

/** 仅在用户二次确认后安装已发布标签，保留当前插件作为失败退路。 */
async function runOnlineUpdate() {
    if (context.updateConfirm !== true) return;
    context.setUpdateConfirm(false);
    if (context.PLUGIN_VERSION && context.isNewerVersion?.(context.updateLatest, context.PLUGIN_VERSION) !== true) {
        context.setUpdateStatus('ok');
        context.setUpdateMessage(context.t('versionLatest'));
        return;
    }
    // 先把「更新中」摆上：重装会把本插件的客户端模块换掉，页面随时可能消失，
    // 用户至少要立刻看到按钮/文案变了，而不是以为点了没反应。
    context.setUpdateStatus('installing');
    context.setUpdateMessage('');
    const probe = context.manager ? context.manager() : { manager: null, tried: ['未注入'] };
    const pluginManager = probe.manager;
    if (!pluginManager || typeof pluginManager.installBundle !== 'function') {
        context.setUpdateStatus('failed');
        context.setUpdateMessage(context.t('versionUpdateUnavailable', { detail: probe.tried.join('，') }));
        return;
    }
    // Local directory links/junctions must never be replaced in-place by pnpm.
    // Inspect the actual recorded source, not navigator.platform or the UI version.
    try {
        if (typeof pluginManager.listBundles !== 'function') throw new Error('source-unavailable');
        const listed = await pluginManager.listBundles();
        const bundles = Array.isArray(listed) ? listed : listed?.ok === true && Array.isArray(listed.value) ? listed.value : null;
        const bundle = bundles?.find(item => item?.name === context.PLUGIN_PACKAGE && item.installed === true);
        let source = typeof bundle?.source === 'string' ? bundle.source.trim() : '';
        if (source.startsWith(`${context.PLUGIN_PACKAGE}@`)) source = source.slice(context.PLUGIN_PACKAGE.length + 1);
        if (!source) throw new Error('source-unavailable');
        const linked = /^link:/i.test(source);
        const local = /^(?:file:|[a-z]:[\\/]|[\\/]|~[\\/])/i.test(source);
        if (linked || (local && !/\.(?:tgz|tar\.gz)(?:[?#].*)?$/i.test(source))) {
            context.setUpdateStatus('failed');
            context.setUpdateMessage('当前为本地目录链接安装，已停止在线更新，未执行替换。目录链接切换为成品包存在文件被清空或仍加载旧目录的风险。请先备份并保留原目录，使用成品包迁移流程；若目录已空，先恢复完整package。不要重置 API密钥或直接卸载。');
            return;
        }
        if (bundle.error || bundle.meta?.error) throw new Error('metadata-unavailable');
    } catch {
        context.setUpdateStatus('failed');
        context.setUpdateMessage('无法核实插件安装来源或元信息，已停止更新，未执行替换。请保留现有配置和安装目录，核对安装状态后再处理；不要重置 API密钥或先卸载。');
        return;
    }
    const requestId = `${context.PLUGIN_PACKAGE}-update-${Date.now()}`;
    const install = async (spec) => {
        try {
            return await pluginManager.installBundle(spec, { enabled: true, requestId });
        }
        catch (error) {
            return { ok: false, error: { message: error?.message || String(error) } };
        }
    };
    /** 宿主两种失败回包（调用失败 / 安装阶段失败）里那句可以给人看的话。 */
    const failureText = (result) => String(result?.error?.message
        ?? result?.value?.error?.diagnostic
        ?? result?.value?.error?.code
        ?? 'unknown');
    /** 过一会儿可能就好的失败：Gitee 排队（429）、超时、连接被掐。 */
    const worthRetrying = (text) => /429|queue overflowed|timed out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|unable to access|network|fetch/i.test(text);
    /** 安装目录锁文件里留着缺 integrity 的记录：换地址、换版本都没用，必须先清掉那条记录。 */
    const lockfileUnverifiable = (text) => /MISSING_TARBALL_INTEGRITY/i.test(text);
    // 使用最新正式版固定成品地址，按已检查版本隔离缓存；禁止回退 master。
    if (!/^\d+\.\d+\.\d+$/.test(context.updateLatest || '')
        || (context.availableVersions && !context.availableVersions.includes(context.updateLatest))) {
        context.setUpdateStatus('failed');
        context.setUpdateMessage(context.t('versionCheckFirst'));
        return;
    }
    const candidates = [
      releaseDownloadUrl(context.updateLatest, 'gitee'),
      releaseDownloadUrl(context.updateLatest, 'github'),
    ];
    /** 这条 spec 装不上时值不值得换下一条：只有「这个 committish 解析不出来」才换。 */
    const specUnresolvable = (text) => /Could not resolve|No matching version|ERR_PNPM_NO_MATCHING_VERSION|ERR_PNPM_FETCH_40[34]|HTTP[ :]+40[34]|404 Not Found|403 Forbidden/i.test(text);
    /** 限流/超时有界重试；已安装不先卸载，保留本地配置。 */
    const trySpec = async (spec) => {
        for (let round = 1; round <= context.UPDATE_ATTEMPTS; round += 1) {
            let result = await install(spec);
            if (result?.ok === true && result.value?.error?.code === 'already-installed') {
                // 同一版本已安装时保持现状，不卸载。
                return { failure: failureText(result), next: false };
            }
            if (result?.ok === true && result.value?.application !== 'failed') {
                return { outcome: result.value || {} };
            }
            const text = failureText(result);
            // 安装目录锁文件里残留了缺 integrity 的记录时，pnpm 在解析前就会拒绝整份锁文件：换镜像地址、
            // 换版本、原地重试都是同样的失败。插件每 2 秒会清掉本插件那条坏记录，这里等它清完再重试，
            // 用户不必自己数着秒再点一次；始终清不掉时才停下并给出针对性提示。
            if (lockfileUnverifiable(text)) {
                if (round < context.UPDATE_ATTEMPTS) {
                    context.setUpdateMessage(context.t('versionUpdateRetry', { attempt: round + 1, total: context.UPDATE_ATTEMPTS }));
                    await new Promise((resolve) => window.setTimeout(resolve, 5000));
                    continue;
                }
                return { failure: text, next: false, lockfile: true };
            }
            const transient = worthRetrying(text);
            if (transient && round < context.UPDATE_ATTEMPTS) {
                context.setUpdateMessage(context.t('versionUpdateRetry', { attempt: round + 1, total: context.UPDATE_ATTEMPTS }));
                await new Promise((resolve) => window.setTimeout(resolve, round * 1200));
                continue;
            }
            return { failure: text, next: !transient && specUnresolvable(text) };
        }
        return { failure: 'unknown' };
    };
    let outcome = null;
    let failure = '';
    for (const spec of candidates) {
        const attempt = await trySpec(spec);
        if (attempt.outcome) {
            outcome = attempt.outcome;
            break;
        }
        failure = attempt.failure || failure;
        // 换 spec 也没用的失败（限流、断网、权限）就停在这里，别把同一套错误在候选之间跑一遍
        if (!attempt.next)
            break;
    }
    if (!outcome) {
        context.setUpdateStatus('failed');
        context.setUpdateMessage([
            lockfileUnverifiable(failure) ? context.t('versionUpdateLockfile') : '',
            context.t('versionUpdateFailed', { message: failure }),
            worthRetrying(failure) || /429|queue overflowed/i.test(failure)
                ? context.t('versionUpdateRateLimited')
                : '',
        ].filter(Boolean).join(' '));
        return;
    }
    if (outcome.application === 'cancelled') {
        context.setUpdateStatus('ok');
        context.setUpdateMessage(context.t('versionUpdateCancelled'));
        return;
    }
    if (outcome.version && outcome.version !== context.updateLatest) {
        forgetUpdateCheck();
        context.setUpdateStatus('failed');
        context.setUpdateMessage(`下载包版本为 ${outcome.version}，与已确认的 ${context.updateLatest} 不一致。请重新检查最新版本；配置与任务保留。`);
        return;
    }
    // 装好了：缓存作废，卡片不再是「有新版本」，只报更新结果
    forgetUpdateCheck();
    const version = outcome.version || context.updateLatest;
    context.setUpdateLatest('');
    const applied=outcome.application==='applied' && await (context.verifyRuntime||verifyRuntimeInstallation)(version);
    context.setUpdateStatus(outcome.application === 'restart-required' ? 'restart' : applied ? 'applied' : 'pending');
    context.setUpdateMessage(outcome.application === 'restart-required'
        ? context.t('versionUpdateRestart', { version })
        : context.t(applied ? 'versionUpdateDone' : 'versionUpdatePending', { version }));
}
function deferUpdate() {
    context.setUpdateConfirm(false);
    context.setUpdateDeferred(context.updateLatest);
    try { window.localStorage.setItem(`${context.UPDATE_CACHE_KEY}.deferred`, context.updateLatest); } catch {}
}
  return { deferUpdate, readUpdateCache, rememberUpdateCheck, forgetUpdateCheck, checkForUpdate, runOnlineUpdate };
}

/** Ordinary updates are optional: checking and dismissing never install anything. */
export function renderUpdateNotice({ h, t, available, latest, deferred, status, confirmed, onUpdate, onLater, mandatory = false, minimum = '' }) {
  if ((!available && !mandatory) || (!mandatory && deferred === latest) || status === 'installing') return null;
  return h('div', { key: 'update-notice', className: 'mov-notice', role: 'status', 'data-field': 'update-notice' }, [
    h('strong', { key: 'title' }, t('versionNew', { version: latest })),
    h('p', { key: 'optional' }, mandatory ? t('versionRequired', { version: minimum }) : t('versionOptional')),
    confirmed ? h('p', { key: 'confirm' }, t('versionUpdateConfirmHint')) : null,
    h('div', { key: 'actions', className: 'mov-cmd-row' }, [
      h('button', { key: 'update', type: 'button', className: 'mov-btn mov-btn-sm mov-btn-primary',
        'data-action': confirmed ? 'update-notice-confirm' : 'update-notice-open', onClick: onUpdate },
        confirmed ? t('versionUpdateConfirm', { version: latest }) : t('versionUpdate')),
      mandatory ? null : h('button', { key: 'later', type: 'button', className: 'mov-btn mov-btn-sm', 'data-action': 'update-later', onClick: onLater }, t('versionLater')),
    ]),
  ]);
}

/** 已安装版本的发布时间，固定北京时间；不是检查时间或本地构建时间。 */
export function formatReleaseTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace('T', ' ');
}
