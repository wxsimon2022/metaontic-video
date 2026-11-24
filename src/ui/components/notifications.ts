import { NOTIFICATIONS_URL } from '../../shared/constants/plugin.js';

export type PluginNotice = { id: string; title: string; content: string; action_url: string };
const CACHE_KEY = 'metaontic-video.notifications.v1';
const DISMISS_KEY = 'metaontic-video.dismissed-notifications.v1';
export const NOTICE_POLL_MS = 5 * 60 * 1000;

/** 只允许用户主动打开普通网页，拒绝脚本、文件与带凭据地址。 */
export function safeNoticeLink(value: unknown): string {
  if (typeof value !== 'string' || value.length > 1000 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return '';
  try {
    const url = new URL(value);
    return /^https?:\/\//i.test(value) && ['https:', 'http:'].includes(url.protocol) &&
      !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

/** 只接收有界纯文字；异常数据不渲染，不执行远端 HTML。 */
export function parseNotices(value: any): PluginNotice[] {
  if (!Array.isArray(value?.items)) return [];
  const result: PluginNotice[] = [];
  const ids = new Set();
  for (const row of value.items.slice(0, 50)) {
    if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(row.id) || ids.has(row.id)) continue;
    if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 80 ||
        typeof row.content !== 'string' || !row.content.trim() || row.content.length > 1000) continue;
    if (row.enabled !== true) continue;
    ids.add(row.id);
    result.push({ id: row.id, title: row.title, content: row.content, action_url: safeNoticeLink(row.action_url) });
  }
  return result;
}

/** 两个入口共用状态与关闭记录；不传账户、密钥或设备标识。 */
export function createNoticeStore({ request = globalThis.fetch, storage = () => globalThis.localStorage,
  now = Date.now, timeoutMs = 5000 }: any = {}) {
  let rows: PluginNotice[] = [], dismissed = new Set<string>(), pending: Promise<void> | null = null;
  let checked = -Infinity;
  const listeners = new Set<() => void>();
  function readDismissed() {
    try {
      const saved = JSON.parse(storage()?.getItem(DISMISS_KEY) || '[]');
      if (Array.isArray(saved)) for (const id of saved) if (typeof id === 'string') dismissed.add(id);
    } catch { /* 存储不可用时保留当前窗口状态 */ }
  }
  readDismissed();
  try { rows = parseNotices(JSON.parse(storage()?.getItem(CACHE_KEY) || 'null')); }
  catch { /* 没有缓存时等待首次同步 */ }
  function emit() { for (const listener of listeners) listener(); }
  function current() {
    readDismissed();
    // 消息仅缓存在插件本机；关闭记录不回传服务端。
    return parseNotices({ items: rows.map(row => ({ ...row, enabled: true })) })
      .find(row => !dismissed.has(row.id)) || null;
  }
  function dismiss(id: string) {
    readDismissed(); dismissed.add(id);
    try { storage()?.setItem(DISMISS_KEY, JSON.stringify([...dismissed])); } catch { /* 会话内仍生效 */ }
    emit();
  }
  async function refresh() {
    if (pending) return pending;
    if (now() - checked < NOTICE_POLL_MS) { emit(); return; }
    checked = now();
    pending = (async () => {
      const controller = new AbortController();
      let timer: any;
      try {
        const body: any = await Promise.race([
          (async () => {
            const response = await request(NOTIFICATIONS_URL, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
            if (!response.ok) throw new Error('unavailable');
            return response.json();
          })(),
          new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('timeout')); }, timeoutMs); }),
        ]);
        if (body?.code !== 0 || !Array.isArray(body.data?.items)) throw new Error('invalid');
        rows = parseNotices(body.data);
        try { storage()?.setItem(CACHE_KEY, JSON.stringify({ items: rows.map(row => ({ ...row, enabled: true })) })); }
        catch { /* 存储失败不影响当前窗口展示 */ }
      } catch { /* 离线保留本地消息；下次成功同步才移除已下架的通知 */ }
      finally { clearTimeout(timer); emit(); }
    })();
    try { await pending; } finally { pending = null; }
  }
  return { current, dismiss, refresh, subscribe(fn: () => void) { listeners.add(fn); return () => listeners.delete(fn); } };
}

export function createNotificationBanner({ React, h, TOKENS, store = createNoticeStore() }: any) {
  return function NotificationBanner() {
    const [, redraw] = React.useState(0);
    React.useEffect(() => {
      const off = store.subscribe(() => redraw((value: number) => value + 1));
      void store.refresh();
      const timer = setInterval(() => { void store.refresh(); }, NOTICE_POLL_MS);
      const onFocus = () => { void store.refresh(); };
      const onStorage = () => redraw((value: number) => value + 1);
      globalThis.addEventListener?.('focus', onFocus);
      globalThis.addEventListener?.('storage', onStorage);
      return () => {
        off(); clearInterval(timer);
        globalThis.removeEventListener?.('focus', onFocus);
        globalThis.removeEventListener?.('storage', onStorage);
      };
    }, []);
    const row = store.current();
    if (!row) return null;
    const english = typeof document !== 'undefined' && document.documentElement.lang?.startsWith('en');
    return h('aside', { 'aria-label': english ? 'Announcements' : '活动通知', style: {
      position: 'relative', border: `1px solid ${TOKENS.border}`, borderRadius: 12,
      background: TOKENS.cardFill, color: TOKENS.text, overflowWrap: 'anywhere',
    } }, [
      // 关闭按钮与链接是同级元素；关闭不触发导航，链接可用键盘聚焦。
      h(row.action_url ? 'a' : 'div', { key: 'message',
        ...(row.action_url ? { href: row.action_url, target: '_blank', rel: 'noopener noreferrer',
          title: english ? 'Open link' : '点击查看详情' } : {}),
        style: { display: 'block', padding: '14px 44px 14px 16px', color: 'inherit',
          textDecoration: 'none', borderRadius: 12, cursor: row.action_url ? 'pointer' : 'default' },
      }, [
        h('strong', { key: 'title', style: { fontSize: 13 } }, row.title,
          row.action_url ? h('span', { 'aria-hidden': true, style: { marginLeft: 6, color: TOKENS.primaryFill } }, '↗') : null),
        h('p', { key: 'body', style: { margin: '7px 0 0', whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.6, color: TOKENS.muted } }, row.content),
      ]),
      h('button', { key: 'close', type: 'button', onClick: () => store.dismiss(row.id),
        'aria-label': english ? 'Dismiss announcement' : '关闭此通知', title: english ? 'Dismiss' : '关闭后不再提醒',
        style: { position: 'absolute', top: 10, right: 10, cursor: 'pointer', color: TOKENS.muted,
          background: 'transparent', border: 0, padding: '4px 6px', fontSize: 18, lineHeight: 1 } }, '×'),
    ]);
  };
}
