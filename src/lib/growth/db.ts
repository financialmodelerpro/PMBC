/**
 * Database access for the Growth Engine tables (migration 083), and the one
 * question every Growth screen asks first: is the data layer there yet?
 *
 * The tables are hand-run DDL and are not in the generated
 * `src/types/database.ts`, so they are reached through the untyped server
 * client, as the free tools tables are, and given their shapes in `model.ts`.
 * Server only: the client carries the service-role key.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isMissingSchema } from '@/lib/tools/db';

export function growthDb(): SupabaseClient {
  return createSupabaseServerClient() as unknown as SupabaseClient;
}

/** Every Growth table, in dependency order, with the migration that creates it. */
export const GROWTH_TABLE_MIGRATIONS = {
  growth_companies: '083_growth_core.sql',
  growth_contacts: '083_growth_core.sql',
  growth_leads: '083_growth_core.sql',
  growth_signals: '083_growth_core.sql',
  growth_activity: '083_growth_core.sql',
  growth_kb_items: '084_growth_knowledge_base.sql',
  growth_settings: '085_growth_settings.sql',
  growth_suppressions: '085_growth_settings.sql',
  growth_ai_usage: '087_growth_ai_usage.sql',
  growth_ai_alerts: '087_growth_ai_usage.sql',
  growth_feed_runs: '088_growth_prospecting.sql',
  growth_imports: '088_growth_prospecting.sql',
  growth_research_briefs: '088_growth_prospecting.sql',
} as const;
export type GrowthTable = keyof typeof GROWTH_TABLE_MIGRATIONS;
export const GROWTH_TABLES = Object.keys(GROWTH_TABLE_MIGRATIONS) as GrowthTable[];

/** Whether one Growth table exists. False on any read failure, so a screen shows its migration notice. */
export async function tableExists(table: GrowthTable): Promise<boolean> {
  try {
    const { error } = await growthDb().from(table).select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/** The migrations still to apply for the tables that are missing, in order. */
export function migrationsFor(missing: GrowthTable[]): string[] {
  return [...new Set(missing.map((t) => GROWTH_TABLE_MIGRATIONS[t]))].sort();
}

export type TableStatus = { table: GrowthTable; state: 'ready' | 'missing' | 'error'; rows: number | null; detail: string | null };
export type DataLayerStatus = { ready: boolean; tables: TableStatus[]; missing: GrowthTable[] };

/** Reads one count per table. Never throws: a failure is reported against its table. */
export async function growthDataLayerStatus(): Promise<DataLayerStatus> {
  let db: SupabaseClient | null = null;
  try {
    db = growthDb();
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'no database client';
    const tables = GROWTH_TABLES.map((table) => ({ table, state: 'error' as const, rows: null, detail }));
    return { ready: false, tables, missing: [] };
  }
  const tables = await Promise.all(
    GROWTH_TABLES.map(async (table): Promise<TableStatus> => {
      try {
        // A GET rather than a HEAD count: a HEAD error carries no body, so a missing
        // table could not be told apart from any other failure.
        const { count, error } = await db.from(table).select('id', { count: 'exact' }).limit(1);
        if (!error) return { table, state: 'ready', rows: count ?? 0, detail: null };
        if (isMissingSchema(error)) return { table, state: 'missing', rows: null, detail: null };
        return { table, state: 'error', rows: null, detail: error.message ?? 'read failed' };
      } catch (err) {
        return { table, state: 'error', rows: null, detail: err instanceof Error ? err.message : 'read failed' };
      }
    }),
  );
  return { ready: tables.every((t) => t.state === 'ready'), tables, missing: tables.filter((t) => t.state === 'missing').map((t) => t.table) };
}
