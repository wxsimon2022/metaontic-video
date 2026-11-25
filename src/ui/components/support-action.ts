import { PLUGIN_PACKAGE, RELAY, SUPPORT_URL } from '../../shared/constants/plugin.js';
import communityQr from '../../assets/support/wecom-community.jpg';
import sponsorLogo from '../../assets/sponsors/metaontic-ai.png';

const SPONSOR_LINKS = [
  { id: 'metaontic-ai', href: RELAY.signupUrl, logo: sponsorLogo, tooltip: '多模型聚合平台', ariaLabel: '多模型聚合平台' },
];

/** Official Host action slot keeps support on the same row as uninstall. */
export function createSupportAction({ React, t, PAGE_CSS }: any) {
  const h = React.createElement;
  return function SupportAction({ subject }: any) {
    const [open, setOpen] = React.useState(null);
    const dialog = React.useRef(null);
    const ownBundle = subject?.kind === 'bundle' && subject.pkg?.name === PLUGIN_PACKAGE;
    React.useEffect(() => { setOpen(null); }, [ownBundle]);
    React.useEffect(() => {
      if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    }, [open]);
    if (!ownBundle) return null;
    return h(React.Fragment, null,
      h('style', null, PAGE_CSS),
      h('button', { type: 'button', className: 'mov-btn mov-support-action', 'data-action': 'contact-support',
        style: { alignSelf: 'center', whiteSpace: 'nowrap' }, 'aria-haspopup': 'dialog', 'aria-expanded': open === 'support',
        onClick: () => setOpen('support'),
      }, h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true },
        h('path', { d: 'M4 13v-1a8 8 0 0 1 16 0v1M4 12H3v6h4v-6H4Zm16 0h1v6h-4v-6h3Zm0 6v1a2 2 0 0 1-2 2h-6' })), t('supportContact')),
      h('button', { type: 'button', className: 'mov-btn mov-support-action', 'data-action': 'join-community',
        style: { alignSelf: 'center', whiteSpace: 'nowrap' }, 'aria-haspopup': 'dialog', 'aria-expanded': open === 'community',
        onClick: () => setOpen('community'),
      }, t('communityContact')),
      h('a', { className: 'mov-btn mov-support-action', 'data-action': 'submit-feedback', href: 'https://gitee.com/hackloop/metaontic-video/issues/new', target: '_blank', rel: 'noopener noreferrer', style: { alignSelf: 'center', whiteSpace: 'nowrap', textDecoration: 'none' } }, t('submitFeedback')),
      h('div', { className: 'mov-sponsor-group', style: { alignSelf: 'center' } },
        h('span', { className: 'mov-sponsor-label' }, t('sponsor')),
        ...SPONSOR_LINKS.map((sponsor) => h('a', { key: sponsor.id, className: 'mov-sponsor-logo', href: sponsor.href,
          target: '_blank', rel: 'noopener noreferrer', 'data-tooltip': sponsor.tooltip, 'aria-label': sponsor.ariaLabel,
        }, h('img', { src: sponsor.logo, alt: '', 'aria-hidden': true })))),
      open ? h('dialog', { ref: dialog, className: 'mov-support-dialog', 'aria-labelledby': 'mov-support-title',
        onCancel: () => setOpen(null), onClose: () => setOpen(null),
        onClick: (event: any) => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(null); } },
      }, h('div', { className: 'mov-support-content' },
        h('div', { className: 'mov-card-head' },
          h('strong', { id: 'mov-support-title' }, t(open === 'community' ? 'communityContact' : 'supportContact')),
          h('button', { type: 'button', className: 'mov-btn mov-btn-sm mov-trailing', 'aria-label': t('supportClose'), onClick: () => setOpen(null) }, t('supportClose'))),
        open === 'community' ? h(React.Fragment, null,
          h('p', { className: 'mov-hint' }, t('communityScan')),
          h('img', { className: 'mov-community-qr', src: communityQr, alt: t('communityQrAlt'), width: 396, height: 396 }),
        ) : h(React.Fragment, null,
          h('p', { className: 'mov-hint' }, t('supportScan')),
          h('iframe', { className: 'mov-support-frame', title: t('supportContact'), src: SUPPORT_URL, referrerPolicy: 'no-referrer' }),
          h('a', { href: SUPPORT_URL, target: '_blank', rel: 'noopener noreferrer' }, t('supportOpenPage'))),
      )) : null);
  };
}
