/**
 * Running and deciding a scoring review (Unit 7.3, 2026-09-23). Server only.
 *
 * Prospect Score: every scored company with a real outcome. Positive when one
 * of its leads reached Meeting Booked or better (or it had a call); negative
 * when its leads were all lost, or its outreach sequence finished with no
 * reply. Lead Score: every engaged lead that reached Meeting Booked or better
 * (positive) or was lost (negative). Each sample's factor shares come from
 * scoring it today with the current rules.
 *
 * Also reports how each Prospect band converted, so a band that does not
 * separate outcomes is visible. The suggestion is saved as pending; the
 * weights change only when Ahmad approves it.
 */

import { logActivity } from './activity';
import type { WriteResult } from './api';
import { growthDb, tableExists } from './db';
import { getEngineSettings, updateEngineSettings } from './engineSettings';
import type { Actor } from './kb';
import { computeLeadScore } from './leadScore';
import { computeCompanyScore } from './prospects';
import { suggestWeights, type Sample, type Suggestion } from './scoring/review';

const RANK: Record<string, number> = { prospect: 0, contacted: 1, replied: 2, qualified: 3, meeting_booked: 4, opportunity: 5, proposal: 6, won: 7 };
const MAX_SAMPLES = 300;

export type ReviewRun = { kind: 'prospect' | 'lead'; current: Record<string, number>; suggestion: Suggestion; bands: { band: string; total: number; positive: number }[]; saved: string | null };

type L = { id: string; stage: string; company_id: string | null; sequence_status?: string; last_reply_at?: string | null; lead_temperature: string | null };

export async function runReview(kind: 'prospect' | 'lead', actor: Actor): Promise<WriteResult<ReviewRun>> {
  const engine = await getEngineSettings();
  const current = (kind === 'prospect' ? engine.values.scoring_weights : engine.values.lead_scoring_weights) as Record<string, number>;
  const { data } = await growthDb().from('growth_leads').select('*').eq('is_test', false).limit(5000);
  const leads = (data ?? []) as L[];
  const { data: mt } = await growthDb().from('growth_meetings').select('lead_id').eq('is_test', false).neq('status', 'cancelled');
  const met = new Set(((mt ?? []) as { lead_id: string | null }[]).map((m) => m.lead_id));
  const isPositive = (l: L) => (RANK[l.stage] ?? -1) >= RANK.meeting_booked || met.has(l.id);
  const samples: Sample[] = [];
  const bandCounts = new Map<string, { total: number; positive: number }>();

  if (kind === 'prospect') {
    const byCompany = new Map<string, L[]>();
    for (const l of leads) if (l.company_id) byCompany.set(l.company_id, [...(byCompany.get(l.company_id) ?? []), l]);
    for (const [companyId, list] of [...byCompany.entries()].slice(0, MAX_SAMPLES)) {
      const positive = list.some(isPositive);
      const negative = !positive && (list.every((l) => l.stage === 'lost') || list.some((l) => l.sequence_status === 'completed' && !l.last_reply_at));
      if (!positive && !negative) continue;
      const s = await computeCompanyScore(companyId);
      if (!s) continue;
      samples.push({ positive, shares: Object.fromEntries(s.factors.map((f) => [f.factor, f.share])) });
      const b = bandCounts.get(s.band) ?? { total: 0, positive: 0 };
      b.total++;
      if (positive) b.positive++;
      bandCounts.set(s.band, b);
    }
  } else {
    for (const l of leads.filter((x) => x.lead_temperature || isPositive(x) || x.stage === 'lost').slice(0, MAX_SAMPLES)) {
      const positive = isPositive(l);
      if (!positive && l.stage !== 'lost') continue;
      const s = await computeLeadScore(l.id);
      if (!s) continue;
      samples.push({ positive, shares: Object.fromEntries(s.result.factors.map((f) => [f.factor, f.share])) });
      const b = bandCounts.get(s.result.temperature) ?? { total: 0, positive: 0 };
      b.total++;
      if (positive) b.positive++;
      bandCounts.set(s.result.temperature, b);
    }
  }

  const suggestion = suggestWeights(current, samples);
  const bands = [...bandCounts.entries()].map(([band, v]) => ({ band, ...v }));
  let saved: string | null = null;
  if (suggestion.ok && (await tableExists('growth_scoring_reviews'))) {
    const { data: row } = await growthDb()
      .from('growth_scoring_reviews')
      .insert({ kind, sample_size: samples.length, positives: suggestion.positives, negatives: suggestion.negatives, current_weights: current, suggested_weights: suggestion.suggested, analysis: { factors: suggestion.factors, bands }, created_by_name: actor.name })
      .select('id')
      .single();
    saved = (row as { id: string } | null)?.id ?? null;
  }
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'scoring.review', summary: `${kind === 'prospect' ? 'Prospect' : 'Lead'} Score review on ${samples.length} outcomes: ${suggestion.ok ? 'new weights suggested for approval' : suggestion.reason}`, metadata: { review_id: saved } });
  return { ok: true, value: { kind, current, suggestion, bands, saved } };
}

export type ReviewRow = { id: string; created_at: string; kind: 'prospect' | 'lead'; sample_size: number; positives: number; negatives: number; current_weights: Record<string, number>; suggested_weights: Record<string, number>; analysis: { factors?: { factor: string; lift: number; meanPositive: number; meanNegative: number }[]; bands?: { band: string; total: number; positive: number }[] }; status: string; decided_at: string | null; decided_by_name: string | null; decision_note: string | null; is_test: boolean };

export async function listReviews(): Promise<ReviewRow[]> {
  const { data } = await growthDb().from('growth_scoring_reviews').select('*').order('created_at', { ascending: false }).limit(30);
  return (data ?? []) as ReviewRow[];
}

/** Approving applies the suggested weights (the settings trigger logs old and new); rejecting needs a note. */
export async function decideReview(id: string, decision: 'approve' | 'reject', note: string | null, actor: Actor): Promise<WriteResult<ReviewRow>> {
  const { data } = await growthDb().from('growth_scoring_reviews').select('*').eq('id', id).maybeSingle();
  const r = data as ReviewRow | null;
  if (!r) return { ok: false, status: 404, error: 'Review not found' };
  if (r.status !== 'pending') return { ok: false, status: 409, error: `This review is already ${r.status}` };
  if (decision === 'reject' && !note?.trim()) return { ok: false, status: 422, error: 'Say why it is rejected' };
  if (decision === 'approve') {
    const w = await updateEngineSettings(r.kind === 'prospect' ? { scoring_weights: r.suggested_weights as never } : { lead_scoring_weights: r.suggested_weights as never }, actor, { isTest: r.is_test, rowId: r.is_test ? 2 : 1 });
    if (!w.ok) return w;
  }
  const { data: after, error } = await growthDb().from('growth_scoring_reviews').update({ status: decision === 'approve' ? 'approved' : 'rejected', decided_at: new Date().toISOString(), decided_by_name: actor.name, decision_note: note?.trim() || null }).eq('id', id).select('*').single();
  if (error || !after) return { ok: false, status: 500, error: error?.message ?? 'Save failed' };
  await logActivity({ actorType: 'admin', actorId: actor.id, action: `scoring.${decision}d`, summary: `${r.kind === 'prospect' ? 'Prospect' : 'Lead'} Score weights ${decision === 'approve' ? 'changed as suggested' : `kept: ${note}`}`, isTest: r.is_test, metadata: { review_id: id, weights: r.suggested_weights } });
  return { ok: true, value: after as ReviewRow };
}
