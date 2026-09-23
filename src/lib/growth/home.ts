/**
 * Growth Home figures (Unit 2.6, 2026-09-23). Server only, read only.
 * Real rows only: test rows are never counted.
 */

import { growthDb } from './db';
import { PROSPECT_BANDS } from './model';

export type HomeCounts = {
  newSignals: number | null;
  duplicateSignals: number | null;
  bands: { value: string; label: string; count: number }[];
  unscored: number;
  companies: number | null;
  openLeads: number | null;
  recent: { id: string; created_at: string; actor_type: string; summary: string | null; action: string; company_id: string | null }[];
};

export async function homeCounts(): Promise<HomeCounts> {
  const db = growthDb();
  const [signals, dups, companies, leads, recent] = await Promise.all([
    db.from('growth_signals').select('id', { count: 'exact', head: true }).eq('status', 'new').eq('is_test', false),
    db.from('growth_signals').select('id', { count: 'exact', head: true }).eq('status', 'new').eq('is_test', false).not('duplicate_of', 'is', null),
    db.from('growth_companies').select('*').eq('is_test', false).neq('status', 'archived').limit(20000),
    db.from('growth_leads').select('id', { count: 'exact', head: true }).eq('is_test', false).not('stage', 'in', '(won,lost)'),
    db.from('growth_activity').select('id, created_at, actor_type, summary, action, company_id').eq('is_test', false).order('created_at', { ascending: false }).order('seq', { ascending: false }).limit(15),
  ]);
  const rows = (companies.data ?? []) as { prospect_band?: string | null }[];
  const bands = PROSPECT_BANDS.map((b) => ({ value: b.value, label: b.label, count: rows.filter((r) => r.prospect_band === b.value).length }));
  return {
    newSignals: signals.error ? null : signals.count ?? 0,
    duplicateSignals: dups.error ? null : dups.count ?? 0,
    bands,
    unscored: rows.filter((r) => !r.prospect_band).length,
    companies: companies.error ? null : rows.length,
    openLeads: leads.error ? null : leads.count ?? 0,
    recent: (recent.data ?? []) as HomeCounts['recent'],
  };
}
