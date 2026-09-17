/**
 * Factors that could support a higher valuation, chosen by rule from a result.
 *
 * Only the choice and the figures behind it are made here; the wording is in
 * `format.ts` (`recommendationText`). Ordered by materiality: the cost of capital
 * first when it moves value most, then earnings quality, then cash, then the
 * forecast, and diligence readiness last, which is always eligible.
 *
 * Relative imports only, so the verifiers can load this file outside Next.
 */

import { RECOMMENDATION_RULES } from './data';
import type { Recommendation, ValuationResult } from './engine';

const R = RECOMMENDATION_RULES;

/**
 * The sensitivity cells behind the cost of capital point: the centre (WACC and
 * growth as used) and one point lower WACC at the same growth. Read from the
 * table itself, so the report can never quote a figure the table does not show.
 */
export function waccLeverCells(r: ValuationResult): { from: number; to: number; uplift: number } | null {
  const s = r.sensitivity;
  if (!s) return null;
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  const gi = s.growths.findIndex((g) => close(g, r.growth));
  const wi = s.waccs.findIndex((w) => close(w, r.wacc.wacc));
  const wl = s.waccs.findIndex((w) => close(w, r.wacc.wacc - 0.01));
  if (gi < 0 || wi < 0 || wl < 0) return null;
  const from = s.grid[wi][gi], to = s.grid[wl][gi];
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(to > from)) return null;
  return { from, to, uplift: to - from };
}

export function buildRecommendations(r: ValuationResult): Recommendation[] {
  const out: Recommendation[] = [];
  const warned = new Set(r.checks.filter((c) => c.status === 'warning').map((c) => c.id));
  const q = r.ratios;

  const lever = waccLeverCells(r);
  if (lever && lever.from > 0 && lever.uplift / lever.from > R.waccSensitivityMaterial) {
    out.push({ id: 'reduce_risk', values: { from: lever.from, to: lever.to, uplift: lever.uplift, share: lever.uplift / lever.from } });
  }
  if (warned.has('no_normalisation')) out.push({ id: 'review_normalisation', values: {} });
  else if (r.normalisation.used) out.push({ id: 'evidence_normalisation', values: { reported: r.ltmEbitdaReported, normalised: r.ltmEbitda } });
  if (Number.isFinite(q.fcfConversion) && q.fcfConversion < R.fcfConversionBelow) {
    out.push({ id: 'cash_conversion', values: { conversion: q.fcfConversion, threshold: R.fcfConversionBelow } });
  }
  if (warned.has('margin_step') || warned.has('growth_ceiling') || warned.has('tv_share')) out.push({ id: 'forecast_credibility', values: {} });
  if (warned.has('roic_below_wacc')) out.push({ id: 'returns', values: { roic: q.roic, wacc: r.wacc.wacc } });
  if (Number.isFinite(q.ebitdaMarginTerminal) && q.ebitdaMarginTerminal < R.terminalMarginBelow) {
    out.push({ id: 'margin', values: { margin: q.ebitdaMarginTerminal } });
  }
  return [...out.slice(0, R.maxItems - 1), { id: 'diligence', values: {} }];
}
