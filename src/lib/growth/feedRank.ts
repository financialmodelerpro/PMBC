/**
 * Ranking the signal feed's candidates (2026-10-29). Pure: the verifier runs
 * it directly.
 *
 * Why: the first real run kept the first ten candidates it found, which were
 * a regulator, market commentary, an airline office and global contractors,
 * while the per-run limit cut Arada's USD 3.8bn Riyadh project, a SAR 14bn
 * master plan, ROSHN and Diriyah. Now, in order:
 *
 *   1. Not a prospect is dropped before ranking: regulators and government
 *      bodies acting as regulators, exchanges and index news, and market or
 *      sector commentary with no named company. Government-linked developers
 *      and giga-project owners are buyers and stay in.
 *   2. Every other candidate is scored with the Prospect Score itself
 *      (`scoreProspect`, with the weights and sector tiers from Settings), so
 *      the feed and the scoring agree: geography, sector tier (real estate
 *      highest), project or funding trigger, size against the SAR 50 million
 *      minimum, and recency. No contact is known yet, so that factor is left
 *      out, as the score does for any unknown.
 *   3. Candidates the model judges would never buy financial modelling,
 *      valuation, due diligence or fundraising support (global contractors,
 *      equipment suppliers), and any with a known size under SAR 50 million,
 *      rank after every other candidate, whatever their score.
 *   4. The highest ranked are kept, up to the limit. The rest are counted as
 *      below rank (they were in the last group) or over the limit (prospects
 *      cut only by the limit).
 */

import type { ScoringWeights, SectorTiers } from './engineSettingsModel';
import { PROSPECT_FITS, type ProspectFit } from './feedModel';
import { MINIMUM_DEAL_SIZE_SAR, type TriggerType } from './model';
import { scoreProspect } from './scoring/prospect';

export { PROSPECT_FITS, type ProspectFit };

/** What the ranker needs from a candidate. */
export type RankInput = {
  company_name: string;
  trigger_type: TriggerType;
  signal_date: string;
  summary: string;
  /** Where the company or project is, as the source says; empty when unknown. */
  location?: string | null;
  /** The company's sector in a few words; empty when unknown. */
  company_sector?: string | null;
  /** Project or deal size in SAR as the source states it, 0 when not stated. */
  size_sar?: number | null;
  prospect_fit?: ProspectFit | null;
  fit_reason?: string | null;
};

/**
 * Names that are never a buyer, whatever the model says: market regulators,
 * exchanges and central banks. Government developers and giga-project owners
 * (ROSHN, Diriyah, NEOM, the Royal Commissions) are not matched.
 */
const REGULATOR_NAME = /\b(capital market authority|CMA|saudi exchange|tadawul|stock exchange|securities and commodities authority|central bank|SAMA|ministry of finance|ministry of economy|ministry of investment|MSCI|FTSE|S&P)\b/i;
/** A "company" that is really a market, sector or economy: commentary, not a named company. */
const COMMENTARY_NAME = /\b(market|markets|sector|industry|economy|index|indices)\s*$/i;

/** Why a candidate is not a prospect at all, or null when it may be one. */
export function notAProspectReason(c: RankInput): string | null {
  if (REGULATOR_NAME.test(c.company_name)) return 'a regulator, exchange or index, not a buyer';
  if (COMMENTARY_NAME.test(c.company_name.trim())) return 'market or sector commentary with no named company';
  if (c.prospect_fit === 'not_a_prospect') return c.fit_reason?.trim() ? c.fit_reason.trim() : 'not a prospect';
  return null;
}

export type Ranked<T> = {
  candidate: T;
  rank: number;
  score: number;
  /** 0: ranked on score; 1: ranked last (unlikely buyer, or a known size under the minimum). */
  tier: 0 | 1;
  /** Why it ranks where it does, in one line. */
  basis: string;
};

const sar = (n: number) => (n >= 1_000_000_000 ? `SAR ${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} billion` : `SAR ${Math.round(n / 1_000_000)} million`);

/** Scores and orders the candidates, best first. Pure. */
export function rankCandidates<T extends RankInput>(candidates: T[], opts: { today: string; weights?: ScoringWeights | null; sectorTiers?: SectorTiers | null }): Ranked<T>[] {
  const now = new Date(`${opts.today}T12:00:00Z`);
  const scored = candidates.map((c, i) => {
    const size = typeof c.size_sar === 'number' && Number.isFinite(c.size_sar) && c.size_sar > 0 ? c.size_sar : null;
    const s = scoreProspect({
      company: { country: c.location?.trim() || null, city: null, sector: c.company_sector?.trim() || null, scale_sar: size },
      leads: [],
      contacts: [],
      signals: [{ trigger_type: c.trigger_type, signal_date: c.signal_date, status: 'new' }],
      weights: opts.weights ?? null,
      sectorTiers: opts.sectorTiers ?? null,
      now,
    });
    const unlikely = c.prospect_fit === 'unlikely_buyer';
    const below = size !== null && size < MINIMUM_DEAL_SIZE_SAR;
    const tier: 0 | 1 = unlikely || below ? 1 : 0;
    const strengths = s.factors
      .filter((f) => f.known && f.share > 0 && f.factor !== 'decision_maker')
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((f) => f.note);
    const last = unlikely ? `ranked last: ${c.fit_reason?.trim() || 'unlikely to buy advisory'}` : below && size !== null ? `ranked last: ${sar(size)} is under the SAR 50 million minimum` : '';
    const basis = [`score ${s.score}`, strengths.length ? strengths.join(', ') : 'little known yet', last].filter(Boolean).join('; ');
    return { candidate: c, score: s.score, tier, basis, order: i };
  });
  scored.sort((a, b) => a.tier - b.tier || b.score - a.score || (b.candidate.signal_date > a.candidate.signal_date ? 1 : b.candidate.signal_date < a.candidate.signal_date ? -1 : 0) || a.order - b.order);
  return scored.map((s, i) => ({ candidate: s.candidate, rank: i + 1, score: s.score, tier: s.tier, basis: s.basis }));
}

export type KeepPlan<T> = {
  keep: Ranked<T>[];
  /** Not kept and in the last group: unlikely buyers and sizes under the minimum. */
  belowRank: Ranked<T>[];
  /** Not kept, prospects cut only by the limit. */
  overLimit: Ranked<T>[];
};

/** Splits the ranked list at the limit. Pure. */
export function planKeeps<T>(ranked: Ranked<T>[], max: number): KeepPlan<T> {
  const keep = ranked.slice(0, Math.max(0, max));
  const rest = ranked.slice(keep.length);
  return { keep, belowRank: rest.filter((r) => r.tier === 1), overLimit: rest.filter((r) => r.tier === 0) };
}

/** The line stored on a kept signal: why it was kept and where it ranked. */
export function keptReason(r: Ranked<unknown>, total: number): string {
  return `Kept: rank ${r.rank} of ${total}; ${r.basis}.`;
}
