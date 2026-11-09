/** 原版无限画布的伴随插件入口，不复制其源码或读写其私有数据。 */
export const CANVAS_PACKAGE = '@ninkch/dsh-infinite-canvas';
// 使用核对过的正式成品，避免 Git 默认分支及开发依赖安装。
export const CANVAS_SPEC = `${CANVAS_PACKAGE}@0.20.1`;
export function canvasBundleState(result: any) {
  const bundles = Array.isArray(result) ? result : result?.ok === true && Array.isArray(result.value) ? result.value : null;
  if (!bundles) throw new Error('无法读取插件列表，请到 Harness 插件管理检查安装状态。');
  const bundle = bundles.find(b => b?.name === CANVAS_PACKAGE && b.installed === true);
  return bundle ? { installed: true, available: !bundle.error && !bundle.meta?.error && bundle.availability !== 'missing' && bundle.enabled !== false } : { installed: false, available: false };
}
export async function installCanvas(manager: any) {
  if (typeof manager?.listBundles !== 'function' || typeof manager?.installBundle !== 'function') throw new Error('当前宿主无法安装插件，请在 Harness 插件管理中搜索 @ninkch/dsh-infinite-canvas。');
  // 点击安装后再次核对，绝不覆盖已有目录链接或升级他人已安装的版本。
  const current = canvasBundleState(await manager.listBundles());
  if (current.installed) return { existing: true, ...current };
  const result = await manager.installBundle(CANVAS_SPEC, { enabled: true, saveExact: true, requestId: `metaontic-canvas-${Date.now()}` });
  if (result?.ok !== true || !['applied', 'restart-required'].includes(result.value?.application) || result.value?.error) throw new Error('无限画布安装未完成，请到 Harness 插件管理查看详细原因；保留现有插件与配置。');
  if (result.value?.application === 'restart-required') return { installed: true, available: false, restartRequired: true };
  return { ...canvasBundleState(await manager.listBundles()), restartRequired: false };
}
export function createCanvasCompanion({ React, h }: any) {
  function CanvasCompanion({ manager, openCanvas, openCanvasSettings, startSession }: any) {
    const [state, setState] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const running = React.useRef(false);
    const alive = React.useRef(true);
    React.useEffect(() => {
      alive.current = true;
      let cancelled = false;
      Promise.resolve().then(async () => {
        const service = manager?.().manager;
        if (typeof service?.listBundles !== 'function') throw new Error('请在 Harness 插件管理中安装 @ninkch/dsh-infinite-canvas。');
        return canvasBundleState(await service.listBundles());
      }).then(value => { if (!cancelled) setState(value); }).catch(e => { if (!cancelled) setMessage(e.message); });
      return () => { cancelled = true; alive.current = false; };
    }, []);
    const install = async () => {
      if (running.current) return;
      running.current = true; setBusy(true); setMessage('正在安装原版无限画布…');
      try {
        const result = await installCanvas(manager?.().manager);
        if (!alive.current) return;
        if (result.restartRequired) setMessage('宿主返回 restart-required，请重启 Harness 后打开无限画布。');
        else {
          setState({ installed: result.installed, available: result.available });
          setMessage(result.available ? '无限画布已安装，可点击打开。' : '请到无限画布插件详情核对启用与加载状态。');
        }
      } catch (e) { if (alive.current) setMessage(e.message); }
      finally { running.current = false; if (alive.current) setBusy(false); }
    };
    const open = async () => {
      try { if (!openCanvas) throw new Error(); await openCanvas(); }
      catch { setMessage('请从 Harness 左侧栏「无限画布」打开，或在插件管理核对启用状态。'); }
    };
    return h('section', { className: 'mov-section', 'aria-label': '无限画布' }, [
      h('div', { key: 'title', className: 'mov-section-title' }, '流程画布 · Infinite Canvas'),
      h('p', { key: 'desc', style: { margin: 0, fontSize: 13, lineHeight: 1.65 } }, '接入原版 dsh-infinite-canvas。在图片或视频节点内点击生成，直接在画布中确认制作方案和费用、查看并审核成果，无需跳转聊天。API密钥沿用本插件设置。每个视频节点制作一段，审核后可选中成果继续续拍；图片暂支持1:1单张。原版批量运行、右键运行及其他生成工具仍使用原版配置。'),
      h('div', { key: 'actions', className: 'mov-panel-actions' }, [
        state?.available ? h('button', { key: 'open', type: 'button', className: 'mov-btn', onClick: open }, '打开无限画布') :
          state?.installed ? h('button', { key: 'settings', type: 'button', className: 'mov-btn', onClick: openCanvasSettings }, '查看画布插件') :
            h('button', { key: 'install', type: 'button', className: 'mov-btn', disabled: busy || !state, onClick: install }, busy ? '安装中…' : '安装原版无限画布'),
        startSession && h('button', { key: 'session', type: 'button', className: 'mov-btn', onClick: startSession }, '新建联动创作会话'),
        h('a', { key: 'docs', className: 'mov-panel-link', href: 'https://github.com/NINKCH/dsh-infinite_canvas', target: '_blank', rel: 'noopener noreferrer' }, '画布项目与使用文档'),
      ]),
      message && h('p', { key: 'status', role: 'status', style: { margin: 0, fontSize: 12 } }, message),
    ]);
  }
  return { CanvasCompanion };
}
