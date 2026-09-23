/**
 * Writes that survive a migration not yet applied (from Phase 2, 2026-09-23).
 * Server only.
 *
 * A Growth write may carry columns a later migration adds. PostgREST refuses
 * an unknown column before touching any row, so the write is retried once
 * without the columns listed as optional. The core record is still saved; the
 * optional detail waits for the migration. `dropped` tells the caller which
 * columns were left out.
 */

import type { PostgrestError } from '@supabase/supabase-js';

import { growthDb } from './db';

export function isMissingColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  return /column .* (does not exist|of .* in the schema cache)|could not find the '.*' column/i.test(error.message ?? '');
}

type Result<T> = { data: T | null; error: PostgrestError | null; dropped: string[] };

const strip = (row: Record<string, unknown>, keys: readonly string[]) => Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)));

export async function insertTolerant<T = Record<string, unknown>>(table: string, row: Record<string, unknown>, optional: readonly string[], select = '*'): Promise<Result<T>> {
  let { data, error } = await growthDb().from(table).insert(row).select(select).single();
  if (isMissingColumn(error)) {
    const dropped = optional.filter((k) => k in row);
    ({ data, error } = await growthDb().from(table).insert(strip(row, optional)).select(select).single());
    return { data: data as T | null, error, dropped };
  }
  return { data: data as T | null, error, dropped: [] };
}

export async function updateTolerant<T = Record<string, unknown>>(table: string, id: string, patch: Record<string, unknown>, optional: readonly string[], select = '*'): Promise<Result<T>> {
  let { data, error } = await growthDb().from(table).update(patch).eq('id', id).select(select).maybeSingle();
  if (isMissingColumn(error)) {
    const dropped = optional.filter((k) => k in patch);
    const rest = strip(patch, optional);
    if (!Object.keys(rest).length) {
      ({ data, error } = await growthDb().from(table).select(select).eq('id', id).maybeSingle());
    } else {
      ({ data, error } = await growthDb().from(table).update(rest).eq('id', id).select(select).maybeSingle());
    }
    return { data: data as T | null, error, dropped };
  }
  return { data: data as T | null, error, dropped: [] };
}
