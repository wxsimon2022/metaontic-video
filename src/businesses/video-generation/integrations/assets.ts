import { AssetError, resolveAssetWorkspace, saveLibraryUpload, listLibraryUploads } from '../assets/storage.js';
/** 本机接口沿用宿主认证；只操作已登记工作区的专用素材目录。 */
export function registerLibraryAssets(ctx: any) {
  return ctx.inject(['webServer'], scope => {
    if (typeof scope.webServer?.register !== 'function') return;
    return scope.webServer.register({ kind: 'exact', path: '/metaontic-video/assets', async handler(req, res) {
      res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'no-store');
      try {
        if (!['GET', 'POST'].includes(req.method)) throw new AssetError(405, 'method_not_allowed');
        const origin = req.headers.origin;
        if (req.headers['sec-fetch-site'] === 'cross-site' && origin !== 'dsh-app://app' || origin && origin !== 'dsh-app://app' && new URL(origin).host !== req.headers.host) throw new AssetError(403, 'invalid_origin');
        const query = new URL(req.url, 'http://localhost').searchParams;
        const project = await resolveAssetWorkspace(ctx, query.get('project') || '');
        if (req.method === 'GET') { res.end(JSON.stringify({ assets: await listLibraryUploads(project) })); return; }
        if (String(req.headers['content-type'] || '').split(';')[0] !== 'application/octet-stream') throw new AssetError(415, 'unsupported_media');
        const item = await saveLibraryUpload(project, query.get('name') || '素材', req, Number(req.headers['content-length']) || 0);
        res.statusCode = 201; res.end(JSON.stringify({ asset: item }));
      } catch (error) {
        res.statusCode = error instanceof AssetError ? error.status : 500;
        res.end(JSON.stringify({ error: error instanceof AssetError ? error.code : 'asset_operation_failed' }));
      }
    } });
  });
}
