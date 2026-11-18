import { PLUGIN_ID, PLUGIN_PACKAGE } from '../hardcoded-config.js';

export function hasLegacyBundleConflict(rows: any[]) {
  return rows.some(row => row.name === PLUGIN_ID && row.installed === true && row.enabled === true)
    && rows.some(row => row.name === PLUGIN_PACKAGE && row.installed === true && row.enabled === true);
}

export function bundleRows(result: any) {
  const rows = Array.isArray(result) ? result : result?.ok === true ? result.value : null;
  if (!Array.isArray(rows)) throw new Error('Bundle inventory unavailable');
  return rows;
}

/** Use the official Host API; never remove a dependency, edit credentials or clear task files. */
export async function disableLegacyBundle(manager: any) {
  if (!hasLegacyBundleConflict(bundleRows(await manager.listBundles()))) return 'ready';
  if (typeof manager.setBundleEnabled !== 'function') throw new Error('Bundle migration unavailable');
  const answer = await manager.setBundleEnabled(PLUGIN_ID, false);
  const value = answer?.ok === true ? answer.value : answer;
  if (answer?.ok === false || value?.error || !value) throw new Error('Bundle migration rejected');
  if (value.application === 'restart-required') return 'restart-required';
  const rows = bundleRows(await manager.listBundles());
  if (rows.some(row => row.name === PLUGIN_ID && row.enabled === true)
    || !rows.some(row => row.name === PLUGIN_PACKAGE && row.enabled === true)) throw new Error('Bundle migration not applied');
  return 'ready';
}

