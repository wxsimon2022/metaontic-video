import { readBundleInventory, assertMigrationActive, type InventoryOptions } from './bundle-inventory.js';
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

/** Disable through Host, preserving credentials, task files and the installed package. */
export async function disableLegacyBundle(manager: any, options: InventoryOptions = {}) {
  if (!hasLegacyBundleConflict(await readBundleInventory(manager, options))) return 'ready';
  if (typeof manager.setBundleEnabled !== 'function') throw new Error('Bundle migration unavailable');
  assertMigrationActive(options);
  const answer = await manager.setBundleEnabled(PLUGIN_ID, false);
  assertMigrationActive(options);
  const value = answer?.ok === true ? answer.value : answer;
  if (answer?.ok === false || value?.error || !value) throw new Error('Bundle migration rejected');
  if (value.application === 'restart-required') return 'restart-required';
  const rows = await readBundleInventory(manager, options);
  if (rows.some(row => row.name === PLUGIN_ID && row.enabled === true)
    || !rows.some(row => row.name === PLUGIN_PACKAGE && row.enabled === true)) throw new Error('Bundle migration not applied');
  return 'ready';
}


export function hasLegacyBundle(rows: any[]) {
  return rows.some(row => row.name === PLUGIN_ID && row.installed === true);
}

/** Remove only the disabled legacy package through Host; never touch project/config files. */
export async function cleanupLegacyBundle(manager: any, options: InventoryOptions = {}) {
  const rows = await readBundleInventory(manager, options);
  if (!hasLegacyBundle(rows)) return 'ready';
  const current = rows.find(row => row.name === PLUGIN_PACKAGE);
  const legacy = rows.find(row => row.name === PLUGIN_ID);
  if (current?.installed !== true || current?.enabled !== true || legacy?.enabled !== false) return 'retained';
  if (legacy.removable === false || typeof manager.removeBundle !== 'function') return 'manual';
  let answer: any;
  assertMigrationActive(options);
  try { answer = await manager.removeBundle(PLUGIN_ID); } catch { return 'retained'; }
  assertMigrationActive(options);
  const value = answer?.ok === true ? answer.value : answer;
  if (value?.error?.code === 'stop-profile') return 'stop-profile';
  if (value?.application === 'restart-required') return 'restart-required';
  if (answer?.ok === false || value?.error || !value) return 'retained';
  const after = await readBundleInventory(manager, options);
  if (hasLegacyBundle(after)) return 'retained';
  if (!after.some(row => row.name === PLUGIN_PACKAGE && row.installed === true && row.enabled === true)) throw new Error('Current bundle unavailable');
  return 'ready';
}
