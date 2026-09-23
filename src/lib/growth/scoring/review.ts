/**
 * The scoring review (Unit 7.3, 2026-09-23). Pure: the arithmetic behind a
 * suggested change of weights, shared by the review and the verifier.
 *
 * Each sample is a scored record with a real outcome: positive (it reached a
 * meeting or better) or negative (lost, or never replied). For every factor,
 * the average share it earned among positives is compared with the average
 * among negatives. A factor that separates them (positives earn more of it)
 * gains weight; one that does not, or points the wrong way, loses weight.
 *
 * Deliberately conservative: nothing is suggested below MIN_EACH positives
 * and negatives; each move is damped and capped at MAX_MOVE points; the result
 * always sums to 100. Weights change only when Ahmad approves.
 */

export const MIN_EACH = 5;
export const DAMPING = 0.5;
export const MAX_MOVE = 10;

export type Sample = { shares: Record<string, number>; positive: boolean };
export type FactorAnalysis = { factor: string; current: number; suggested: number; meanPositive: number; meanNegative: number; lift: number };
export type Suggestion = { ok: true; suggested: Record<string, number>; factors: FactorAnalysis[]; positives: number; negatives: number } | { ok: false; reason: string; positives: number; negatives: number };

/** Rounds shares of 100 to whole numbers that still add up to exactly 100 (largest remainder). */
export function toHundred(raw: Record<string, number>): Record<string, number> {
  const keys = Object.keys(raw);
  const total = keys.reduce((a, k) => a + Math.max(0, raw[k]), 0);
  if (total <= 0) return Object.fromEntries(keys.map((k, i) => [k, i === 0 ? 100 : 0]));
  const exact = keys.map((k) => ({ k, v: (Math.max(0, raw[k]) / total) * 100 }));
  const floors = exact.map((e) => ({ ...e, f: Math.floor(e.v) }));
  let left = 100 - floors.reduce((a, e) => a + e.f, 0);
  floors.sort((a, b) => b.v - b.f - (a.v - a.f));
  for (const e of floors) {
    if (left <= 0) break;
    e.f++;
    left--;
  }
  return Object.fromEntries(keys.map((k) => [k, floors.find((e) => e.k === k)!.f]));
}

export function suggestWeights(current: Record<string, number>, samples: Sample[]): Suggestion {
  const pos = samples.filter((s) => s.positive);
  const neg = samples.filter((s) => !s.positive);
  if (pos.length < MIN_EACH || neg.length < MIN_EACH) {
    return { ok: false, reason: `Needs at least ${MIN_EACH} positive and ${MIN_EACH} negative outcomes; there are ${pos.length} and ${neg.length}.`, positives: pos.length, negatives: neg.length };
  }
  const mean = (list: Sample[], f: string) => list.reduce((a, s) => a + (s.shares[f] ?? 0), 0) / list.length;
  const raw: Record<string, number> = {};
  const lifts: Record<string, { p: number; n: number; lift: number }> = {};
  for (const f of Object.keys(current)) {
    const p = mean(pos, f);
    const n = mean(neg, f);
    const lift = p - n;
    lifts[f] = { p, n, lift };
    const moved = current[f] * (1 + DAMPING * lift);
    raw[f] = Math.min(current[f] + MAX_MOVE, Math.max(current[f] - MAX_MOVE, moved));
  }
  const suggested = toHundred(raw);
  const factors = Object.keys(current).map((f) => ({ factor: f, current: current[f], suggested: suggested[f], meanPositive: Math.round(lifts[f].p * 100) / 100, meanNegative: Math.round(lifts[f].n * 100) / 100, lift: Math.round(lifts[f].lift * 100) / 100 }));
  return { ok: true, suggested, factors, positives: pos.length, negatives: neg.length };
}
