/**
 * Reading and saving the Growth settings added from Phase 2 onwards. Server only.
 *
 * `getEngineSettings` reads the whole settings row with `select('*')`, so a
 * column whose migration has not run is simply absent: it is reported in
 * `missing` and given its default for display. A caller that sends, spends or
 * shows something public must check `missing` (or `usable`) and refuse rather
 * than act on a default.
 */

import { isMissingSchema } from '@/lib/tools/db';

import { growthDb } from './db';
import {
  DEFAULT_ENGINE_SETTINGS,
  ENGINE_SETTING_COLUMNS,
  ENGINE_SETTING_KEYS,
  readEngineValue,
  type EngineSettingKey,
  type EngineSettings,
} from './engineSettingsModel';
import type { Actor } from './kb';
import { REAL_SETTINGS_ROW } from './settings';

export type EngineSettingsRead = {
  values: EngineSettings;
  /** Settings whose column does not exist yet. */
  missing: EngineSettingKey[];
  source: 'database' | 'missing' | 'error';
  error: string | null;
};

export async function getEngineSettings(rowId: number = REAL_SETTINGS_ROW): Promise<EngineSettingsRead> {
  try {
    const { data, error } = await growthDb().from('growth_settings').select('*').eq('id', rowId).maybeSingle();
    if (error) return { values: DEFAULT_ENGINE_SETTINGS, missing: [...ENGINE_SETTING_KEYS], source: isMissingSchema(error) ? 'missing' : 'error', error: error.message ?? null };
    if (!data) return { values: DEFAULT_ENGINE_SETTINGS, missing: [...ENGINE_SETTING_KEYS], source: 'missing', error: 'The settings row is missing' };
    const row = data as Record<string, unknown>;
    const values = { ...DEFAULT_ENGINE_SETTINGS } as Record<EngineSettingKey, unknown>;
    const missing: EngineSettingKey[] = [];
    for (const key of ENGINE_SETTING_KEYS) {
      if (key in row) values[key] = readEngineValue(key, row[key]);
      else missing.push(key);
    }
    return { values: values as EngineSettings, missing, source: 'database', error: null };
  } catch (err) {
    return { values: DEFAULT_ENGINE_SETTINGS, missing: [...ENGINE_SETTING_KEYS], source: 'error', error: err instanceof Error ? err.message : 'read failed' };
  }
}

/** True when the row was read and every named setting has its column. */
export function usable(read: EngineSettingsRead, keys: EngineSettingKey[]): boolean {
  return read.source === 'database' && keys.every((k) => !read.missing.includes(k));
}

/** The migration a set of settings waits for, or null when all are present. */
export function pendingMigration(read: EngineSettingsRead, keys: EngineSettingKey[]): string | null {
  const miss = keys.filter((k) => read.missing.includes(k));
  if (!miss.length) return null;
  return [...new Set(miss.map((k) => ENGINE_SETTING_COLUMNS[k].migration))].sort().join(', ');
}

export type EngineWrite = { ok: true; values: EngineSettings } | { ok: false; status: number; error: string };

/**
 * Saves some engine settings. Only the given columns are written; the
 * database checks each value and the settings trigger logs the change.
 */
export async function updateEngineSettings(patch: Partial<EngineSettings>, actor: Actor, opts: { isTest?: boolean; rowId?: number } = {}): Promise<EngineWrite> {
  const rowId = opts.rowId ?? REAL_SETTINGS_ROW;
  const current = await getEngineSettings(rowId);
  const keys = Object.keys(patch) as EngineSettingKey[];
  const pending = pendingMigration(current, keys);
  if (current.source !== 'database') return { ok: false, status: 503, error: current.error ?? 'The settings row cannot be read' };
  if (pending) return { ok: false, status: 503, error: `These settings need ${pending} applied first.` };
  const { error } = await growthDb()
    .from('growth_settings')
    .update({ ...patch, updated_by: actor.id, updated_by_name: actor.name, last_change_is_test: Boolean(opts.isTest) })
    .eq('id', rowId);
  if (error) {
    if (error.code === '23514') return { ok: false, status: 422, error: 'The database refused a value outside its limits' };
    return { ok: false, status: 500, error: error.message ?? 'Save failed' };
  }
  const after = await getEngineSettings(rowId);
  return { ok: true, values: after.values };
}
