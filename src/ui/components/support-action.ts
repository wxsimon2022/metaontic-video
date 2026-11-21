import { PLUGIN_PACKAGE, SUPPORT_URL } from '../../shared/constants/plugin.js';

/** Official Host action slot keeps support on the same row as uninstall. */
export function createSupportAction({ React, t, PAGE_CSS }: any) {
  const h = React.createElement;
  return function SupportAction({ subject }: any) {
    const [open, setOpen] = React.useState(false);
    const dialog = React.useRef(null);
    const ownBundle = subject?.kind === 'bundle' && subject.pkg?.name === PLUGIN_PACKAGE;
    React.useEffect(() => { setOpen(false); }, [ownBundle]);
    React.useEffect(() => {
      if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    }, [open]);
    if (!ownBundle) return null;
    return h(React.Fragment, null,
      h('style', null, PAGE_CSS),
      h('button', { type: 'button', className: 'mov-btn mov-support-action', 'data-action': 'contact-support',
        icon: h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true },
          h('path', { d: 'M4 13v-1a8 8 0 0 1 16 0v1M4 12H3v6h4v-6H4Zm16 0h1v6h-4v-6h3Zm0 6v1a2 2 0 0 1-2 2h-6' })),
        style: { alignSelf: 'center', whiteSpace: 'nowrap' }, 'aria-haspopup': 'dialog', 'aria-expanded': open,
        onClick: () => setOpen(true),
      }, t('supportContact')),
      open ? h('dialog', { ref: dialog, className: 'mov-support-dialog', 'aria-labelledby': 'mov-support-title',
        onCancel: () => setOpen(false), onClose: () => setOpen(false),
        onClick: (event: any) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false); } },
      }, h('div', { className: 'mov-support-content' },
        h('div', { className: 'mov-card-head' },
          h('strong', { id: 'mov-support-title' }, t('supportContact')),
          h('button', { type: 'button', className: 'mov-btn mov-btn-sm mov-trailing', 'aria-label': t('supportClose'), onClick: () => setOpen(false) }, t('supportClose'))),
        h('p', { className: 'mov-hint' }, t('supportScan')),
        h('iframe', { className: 'mov-support-frame', title: t('supportContact'), src: SUPPORT_URL, referrerPolicy: 'no-referrer' }),
        h('a', { href: SUPPORT_URL, target: '_blank', rel: 'noopener noreferrer' }, t('supportOpenPage')),
      )) : null);
  };
}
