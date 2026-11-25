import { collectLibraryAssets, filterLibraryAssets } from '../assets/catalog.js';
import { appendAssetDraft, assetReferenceRequest, assetRemakeRequest } from './asset-actions.js';

const LIBRARY_CSS = `
.mov-library{box-sizing:border-box;width:100%;height:100%;min-height:0;overflow:auto;padding:24px;color:var(--dsw-alias-label-primary,inherit);background:var(--dsw-alias-bg-base,transparent)}
[data-conversation-scroll]:has([data-metaontic-assets]) > [data-composer-seat]{display:none}
.mov-library *{box-sizing:border-box}.mov-library-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.mov-library h2{margin:0;font-size:20px}.mov-library-hint{color:var(--dsw-alias-label-caption,#737b8b);font-size:13px;line-height:1.7;margin:8px 0 20px}.mov-library-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:18px}.mov-library-search{min-width:0;flex:1 1 180px;padding:9px 12px;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:8px;background:var(--dsw-specific-input-major,transparent);color:inherit;font:inherit;font-size:13px}.mov-library-tabs{display:flex;gap:6px;flex-wrap:wrap}.mov-library button{cursor:pointer;font:inherit;font-size:12px;padding:7px 12px;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:8px}.mov-library button[aria-pressed=true]{color:var(--dsw-alias-link,#247bbf);border-color:currentColor;background:var(--dsw-specific-input-major,transparent)}.mov-library button:disabled{cursor:default;opacity:.5}.mov-library button:focus-visible,.mov-library input:focus-visible{outline:2px solid var(--dsw-alias-link,#247bbf);outline-offset:2px}.mov-library-empty{padding:56px 16px;text-align:center;border:1px dashed var(--dsw-alias-border-l2,#dfe3eb);border-radius:12px}.mov-library-empty strong{display:block;font-size:15px;margin-bottom:8px}.mov-library .mov-media-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))}.mov-library .mov-media-surface{height:210px;display:flex;align-items:center;justify-content:center}.mov-library .mov-media-image-button{height:100%}.mov-library .mov-media-image,.mov-library .mov-media-video{height:210px;max-height:210px;object-fit:contain}.mov-library .mov-media-caption{font-size:12px;font-weight:500}.mov-library-footer{display:flex;justify-content:center;margin:20px 0}.mov-library-note{font-size:12px;color:var(--dsw-alias-label-caption,#737b8b)}
@media(max-width:540px){.mov-library{padding:16px}.mov-library h2{font-size:18px}}
`;

export function createAssetLibrary({ React, h, MediaPreview, t }: any) {
  function Library({ useChat, useSessions, useSession, useInput, inputActions, openView, sessionId, loadImage, loadEarlier }: any) {
    const chat = useChat((snapshot: any) => snapshot);
    const cwd = useSessions?.((snapshot: any) => snapshot.byId?.[sessionId]?.cwd) || '';
    const draft = useInput?.((snapshot: any) => snapshot.draft) || '';
    const phase = useInput?.((snapshot: any) => snapshot.phase);
    const canWrite = typeof inputActions?.setDraft === 'function' && !['adjudicating', 'submitting', 'sending'].includes(phase);
    const hasMore = useSession?.((snapshot: any) => snapshot.hasMore);
    const [kind, setKind] = React.useState('all');
    const [search, setSearch] = React.useState('');
    const [limit, setLimit] = React.useState(24);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState(false);
    const request = React.useRef(0);
    const picker = React.useRef(null);
    const uploadRequest = React.useRef(0);
    const controller = React.useRef(null);
    const [stored, setStored] = React.useState({ project: '', items: [] });
    const [busy, setBusy] = React.useState(false);
    const [uploadError, setUploadError] = React.useState('');
    const [notice, setNotice] = React.useState('');
    const [refresh, setRefresh] = React.useState(0);
    const [scope, setScope] = React.useState('all');
    const [selected, setSelected] = React.useState([] as string[]);
    const [remake, setRemake] = React.useState(null as any);
    const [note, setNote] = React.useState('');
    const remakeDialog = React.useRef(null);
    React.useEffect(() => { if (remake && remakeDialog.current && !remakeDialog.current.open) remakeDialog.current.showModal(); }, [remake]);
    React.useEffect(() => { setSelected([]); setRemake(null); setNote(''); setScope('all'); }, [sessionId, cwd]);
    React.useEffect(() => {
      const abort = new AbortController(); controller.current = abort; const id = ++uploadRequest.current;
      setStored({ project: cwd, items: [] }); setBusy(false); setUploadError(''); setNotice('');
      if (cwd) fetch(`/metaontic-video/assets?project=${encodeURIComponent(cwd)}`, { signal: abort.signal }).then(async response => {
        const data = await response.json(); if (!response.ok) throw Error(data.error || 'asset_operation_failed');
        if (id === uploadRequest.current) setStored({ project: cwd, items: Array.isArray(data.assets) ? data.assets : [] });
      }).catch(error => { if (id === uploadRequest.current && !abort.signal.aborted) setUploadError(error.message); });
      return () => { abort.abort(); uploadRequest.current++; };
    }, [sessionId, cwd, refresh]);
    async function upload(files: File[]) {
      if (busy || !cwd || !files.length) return;
      const id = uploadRequest.current, signal = controller.current?.signal;
      setBusy(true); setUploadError(''); setNotice(''); let uploaded = 0;
      try {
        for (const file of files.slice(0, 20)) {
          if (signal?.aborted || id !== uploadRequest.current) return;
          if (file.size > (/\.(png|jpe?g|gif|webp)$/i.test(file.name) ? 20 : 100) * 1024 * 1024) throw Error('asset_too_large');
          const response = await fetch(`/metaontic-video/assets?project=${encodeURIComponent(cwd)}&name=${encodeURIComponent(file.name)}`, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: file, signal });
          const data = await response.json(); if (!response.ok) throw Error(data.error || 'asset_operation_failed');
          if (id !== uploadRequest.current) return;
          const item = data.asset; if (!item?.localPath || !['image', 'video'].includes(item.kind)) throw Error('asset_operation_failed');
          setStored((current: any) => ({ project: cwd, items: [item, ...current.items.filter((old: any) => old.id !== item.id)] })); uploaded++;
        }
        if (files.length > 20) setUploadError('batch_too_large');
      } catch (error) { if (id === uploadRequest.current && !signal?.aborted) setUploadError(error.message); }
      finally { if (id === uploadRequest.current) { setBusy(false); if (uploaded) setNotice(t('assetUploaded', { count: uploaded })); } }
    }
    function useAsset(item: any) {
      if (!item.localPath || !canWrite) return;
      const reference = '@' + JSON.stringify(item.localPath);
      inputActions.setDraft(draft ? draft + ' ' + reference : reference);
      inputActions.persistDraft?.(); openView?.('chat');
    }
    function writeRequest(text: string) {
      if (!canWrite || !text) return;
      inputActions.setDraft(appendAssetDraft(draft, text)); inputActions.persistDraft?.();
      setRemake(null); setNote(''); openView?.('chat');
    }
    function actions(item: any) {
      if (!canWrite || !item.localPath && !item.url) return null;
      const isSelected = selected.includes(item.id);
      return h('details', { className: 'mov-asset-actions', key: 'actions' },
        h('summary', null, t('assetMoreActions')),
        h('div', { className: 'mov-library-tabs' },
          item.kind === 'image' ? ['first', 'last'].map(role => h('button', { key: role, type: 'button', onClick: () => writeRequest(assetReferenceRequest(item, role)) }, t(`assetUse_${role}`))) : null,
          h('button', { type: 'button', onClick: () => writeRequest(assetReferenceRequest(item)) }, t(item.kind === 'video' ? 'assetUse_video' : 'assetUse_reference')),
          h('button', { type: 'button', 'aria-pressed': isSelected, onClick: () => setSelected(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]) }, t(isSelected ? 'assetDeselect' : 'assetSelect')),
          assetRemakeRequest(item) ? [false, true].map(changes => h('button', { key: String(changes), type: 'button', onClick: () => { setNote(''); setRemake({ item, changes }); } }, t(changes ? 'assetRemakeChange' : 'assetRemake'))) : null));
    }
    React.useEffect(() => { setKind('all'); setSearch(''); setLimit(24); setError(false); setLoading(false); request.current++; return () => { request.current++; }; }, [sessionId]);
    const assets = React.useMemo(() => {
      const uploads = stored.project === cwd ? stored.items : [];
      const generated = collectLibraryAssets(chat, cwd);
      const key = (value: any) => /^[a-z]:/i.test(value || '') ? value.replace(/\\/g, '/').toLowerCase() : value;
      const recorded = new Set(generated.map(item => key(item.localPath)).filter(Boolean));
      return [...uploads.filter((item: any) => !recorded.has(key(item.localPath))), ...generated];
    }, [chat, cwd, stored]);
    const latestRound = assets.reduce((latest, item) => Math.max(latest, item.creation?.round ?? -1), -1);
    const filtered = React.useMemo(() => filterLibraryAssets(scope === 'latest' ? assets.filter(item => item.creation?.round === latestRound) : assets, kind, search), [assets, kind, search, scope, latestRound]);
    const selection = assets.filter(item => selected.includes(item.id));
    const visible = filtered.slice(0, limit).map(item => ({ ...item, label: `${t(`assetCategory_${item.category}`)} · ${item.name}` }));
    async function older() {
      if (loading || !loadEarlier) return;
      const id = ++request.current; setLoading(true); setError(false);
      try { await loadEarlier(); } catch { if (id === request.current) setError(true); }
      finally { if (id === request.current) setLoading(false); }
    }
    return h('section', { className: 'mov-library', 'data-metaontic-assets': '', 'data-conversation-composer-overlay': '', 'aria-label': t('assetLibrary') },
      h('style', null, LIBRARY_CSS),
      h('header', { className: 'mov-library-head' }, h('h2', null, t('assetLibrary')),
        h('span', { className: 'mov-library-note', role: 'status' }, t('assetCount', { count: assets.length })),
        h('div', { className: 'mov-library-tabs' },
          h('button', { type: 'button', disabled: busy || !cwd, onClick: () => picker.current?.click() }, t(busy ? 'assetUploading' : 'assetUpload')),
          h('button', { type: 'button', disabled: busy || !cwd, onClick: () => setRefresh(refresh + 1) }, t('assetRefresh'))),
        h('input', { ref: picker, type: 'file', hidden: true, multiple: true, accept: '.png,.jpg,.jpeg,.webp,.gif,.mp4,.mov,.webm', 'aria-label': t('assetUpload'), onChange: (event: any) => { const files = Array.from(event.target.files || []) as File[]; event.target.value = ''; void upload(files); } })),
      h('p', { className: 'mov-library-hint' }, t('assetLibraryHint')),
      h('p', { className: 'mov-library-note' }, t('assetUploadHint')),
      notice ? h('p', { role: 'status', className: 'mov-library-note' }, notice) : null,
      uploadError ? h('p', { role: 'alert', className: 'mov-library-note' }, t(['workspace_required','workspace_unavailable','workspace_not_registered','asset_too_large','unsupported_media','batch_too_large'].includes(uploadError) ? `assetError_${uploadError}` : 'assetUploadFailed')) : null,
      h('div', { className: 'mov-library-controls' },
        h('div', { className: 'mov-library-tabs', role: 'group', 'aria-label': t('assetScope') },
          ...['all', 'latest'].map(value => h('button', { key: value, type: 'button', disabled: value === 'latest' && latestRound < 0, 'aria-pressed': scope === value, onClick: () => { setScope(value); setLimit(24); } }, t(`assetScope_${value}`)))),
        h('div', { className: 'mov-library-tabs', role: 'group', 'aria-label': t('assetFilter') },
          ...['all', 'image', 'video', 'reference', 'film'].map(value => h('button', { key: value, type: 'button', 'aria-pressed': kind === value, onClick: () => { setKind(value); setLimit(24); } }, t(`assetFilter_${value}`)))),
        h('input', { className: 'mov-library-search', type: 'search', value: search, placeholder: t('assetSearch'), 'aria-label': t('assetSearch'), onChange: (event: any) => { setSearch(event.target.value); setLimit(24); } })),
      selection.length && canWrite ? h('div', { className: 'mov-library-controls' },
        h('span', { className: 'mov-library-note' }, t('assetSelectedCount', { count: selection.length })),
        h('button', { type: 'button', onClick: () => { writeRequest(t('assetConfirmReferenceDraft') + '\n' + selection.map(item => assetReferenceRequest(item)).filter(Boolean).join('\n')); setSelected([]); } }, t('assetConfirmReferences')),
        h('button', { type: 'button', onClick: () => setSelected([]) }, t('assetClearSelection'))) : null,
      filtered.length ? h(MediaPreview, { key: sessionId, items: visible, initialLimit: 24, loadImage, onUse: canWrite ? useAsset : undefined, renderActions: actions }) :
        h('div', { className: 'mov-library-empty', role: 'status' }, h('strong', null, t(assets.length ? 'assetNoMatch' : 'assetEmpty')), h('p', { className: 'mov-library-hint' }, t(assets.length ? 'assetNoMatchHint' : 'assetEmptyHint'))),
      filtered.length > limit ? h('div', { className: 'mov-library-footer' }, h('button', { type: 'button', onClick: () => setLimit(limit + 24) }, t('assetShowMore'))) : null,
      hasMore && loadEarlier ? h('div', { className: 'mov-library-footer' }, h('button', { type: 'button', disabled: loading, onClick: older }, t(loading ? 'assetLoading' : 'assetLoadEarlier'))) : null,
      error ? h('p', { role: 'alert', className: 'mov-library-note' }, t('assetLoadError')) : null,
      h('p', { className: 'mov-library-note' }, t('assetLocalHint')),
      h('style', null, `.mov-asset-actions{padding:0 12px 10px;font-size:12px}.mov-asset-actions summary{cursor:pointer;padding:8px 0}.mov-remake-dialog{box-sizing:border-box;max-width:min(92vw,520px);width:520px;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:12px;background:var(--dsw-alias-bg-base,#fff);color:inherit;padding:20px}.mov-remake-dialog::backdrop{background:rgba(0,0,0,.5)}.mov-remake-dialog textarea{box-sizing:border-box;width:100%;min-height:100px;font:inherit;padding:10px;background:transparent;color:inherit;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:8px}.mov-remake-dialog h3{margin-top:0}.mov-remake-dialog p{overflow-wrap:anywhere}`),
      remake ? h('dialog', { ref: remakeDialog, className: 'mov-remake-dialog', 'aria-label': t(remake.changes ? 'assetRemakeChange' : 'assetRemake'), onCancel: () => setRemake(null), onClose: () => setRemake(null) },
        h('form', { onSubmit: (event: any) => { event.preventDefault(); if (!remake.changes || note.trim()) writeRequest(assetRemakeRequest(remake.item, note)); } },
          h('h3', null, t(remake.changes ? 'assetRemakeChange' : 'assetRemake')),
          h('p', null, remake.item.name),
          h('p', { className: 'mov-library-note' }, t('assetRemakeHint')),
          remake.changes ? h('textarea', { value: note, maxLength: 2000, required: true, autoFocus: true, 'aria-label': t('assetChangeNote'), placeholder: t('assetChangeNote'), onChange: (event: any) => setNote(event.target.value) }) : null,
          h('div', { className: 'mov-library-tabs' }, h('button', { type: 'button', onClick: () => setRemake(null) }, t('assetCancel')), h('button', { type: 'submit', disabled: !canWrite || remake.changes && !note.trim() }, t('assetAddToDraft'))))) : null);
  }
  return function AssetLibrary(props: any) {
    if (typeof props.useChat !== 'function') return h('p', { role: 'status' }, t('assetUnavailable'));
    return h(Library, { ...props, key: props.sessionId });
  };
}

/** 会话槽由宿主注入 useChat；历史附件通过宿主缓存读取，避免新增文件服务。 */
export function registerAssetLibrary(ctx: any, Component: any, t: any) {
  return ctx.slots.register({ name: 'conversation.view', id: 'metaontic-video-assets', order: 12, label: () => t('assetLibrary'),
    inject: (sessionId: string) => {
      const sessions = ctx.get?.('sessions');
      const conversation = ctx.get?.('uiConversation');
      const session = sessions?.binding?.(sessionId)?.session;
      return {
        ...(typeof conversation?.imageUrl === 'function' ? { loadImage: (attachment: any) => conversation.imageUrl(sessionId, attachment) } : {}),
        ...(typeof session?.loadOlder === 'function' ? { loadEarlier: async () => { await session.loadOlder({ deferConsumption: true }); await session.consumeOlder(); } } : {}),
      };
    },
  }, Component);
}

