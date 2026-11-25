import { draftMediaReferences } from './asset-actions.js';
import { localMediaUrl, remoteMediaUrl } from './media-preview.js';

export function createComposerMedia({ React, h, t }: any) {
  function Preview({ useInput, useSessions, sessionId }: any) {
    const draft = useInput((snapshot: any) => snapshot.draft) || '';
    const cwd = useSessions?.((snapshot: any) => snapshot.byId?.[sessionId]?.cwd) || '';
    const items = React.useMemo(() => draftMediaReferences(draft, cwd), [draft, cwd]);
    if (!items.length) return null;
    return h('aside', { className: 'mov-composer-media', 'aria-label': t('assetDraftPreview'), 'data-field': 'draft-media-preview' },
      h('style', null, `.mov-composer-media{box-sizing:border-box;display:flex;gap:8px;overflow-x:auto;padding:6px 0;max-width:var(--dsh-composer-card-max-width,100%);width:calc(100% - var(--dsh-composer-side-clearance,0px)*2);margin:0 auto}.mov-composer-media a{display:flex;flex:none;flex-direction:column;width:76px;color:var(--dsw-alias-label-caption,inherit);text-decoration:none;font-size:11px;gap:4px}.mov-composer-media img,.mov-composer-media video{width:76px;height:54px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:7px;background:var(--dsw-specific-input-major,transparent)}.mov-composer-media span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mov-composer-media a:focus-visible{outline:2px solid var(--dsw-alias-link,#247bbf);outline-offset:2px}`),
      ...items.map(item => {
        const source = localMediaUrl(item.localPath, document.baseURI) || remoteMediaUrl(item.url);
        return h('a', { key: item.id, href: source, target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer', title: item.name, 'aria-label': t('assetPreviewReference', { name: item.name }) },
          item.kind === 'image' ? h('img', { src: source, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' })
            : h('video', { src: source, preload: 'metadata', muted: true, playsInline: true, 'aria-hidden': true,
              onLoadedMetadata: (event: any) => { const video = event.currentTarget; if (Number.isFinite(video.duration) && video.duration > 0.01) video.currentTime = 0.01; } }),
          h('span', null, item.name));
      }));
  }
  return function ComposerMedia(props: any) {
    return typeof props.useInput === 'function' ? h(Preview, { ...props, key: props.sessionId }) : null;
  };
}
