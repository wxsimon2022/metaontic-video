/** Read-only queries may time out; mutations must never be retried based on a timeout. */
export type InventoryOptions = { signal?: AbortSignal; timeoutMs?: number };
export class BundleInventoryError extends Error {
  constructor(readonly code: 'timeout' | 'aborted' | 'unavailable') {
    super(`Bundle inventory ${code}`);
  }
}
export function assertMigrationActive(options: InventoryOptions) {
  if (options.signal?.aborted) throw new BundleInventoryError('aborted');
}
export function readBundleInventory(manager: any, options: InventoryOptions = {}): Promise<any[]> {
  assertMigrationActive(options);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, rows?: any[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      error ? reject(error) : resolve(rows!);
    };
    const abort = () => finish(new BundleInventoryError('aborted'));
    const timer = setTimeout(() => finish(new BundleInventoryError('timeout')), options.timeoutMs ?? 8000);
    options.signal?.addEventListener('abort', abort, { once: true });
    // The remote request cannot always be cancelled. Late results are read-only and ignored.
    let request: any;
    try { assertMigrationActive(options); request = manager.listBundles(); }
    catch { finish(new BundleInventoryError(options.signal?.aborted ? 'aborted' : 'unavailable')); return; }
    Promise.resolve(request).then(result => {
      const rows = Array.isArray(result) ? result : result?.ok === true ? result.value : null;
      if (!Array.isArray(rows)) finish(new BundleInventoryError('unavailable'));
      else finish(undefined, rows);
    }, () => finish(new BundleInventoryError(options.signal?.aborted ? 'aborted' : 'unavailable')));
  });
}
