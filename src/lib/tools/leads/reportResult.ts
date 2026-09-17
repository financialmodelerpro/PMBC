/**
 * The result a stored lead's report and resent email are built from.
 *
 * A lead saved from version 3 on (2026-09-17) stores the full result, which is
 * used as stored: the visitor receives the numbers they were shown.
 *
 * A lead saved before then stores a result without the blocks the report now
 * reads (the forecast lines, the terminal build, the checks). Its inputs are
 * run again with the method they were valued under: the reference's terminal
 * cash flow, no loss carry-forward, no stub period and corporate tax alone.
 * That reproduces the stored figures, which is checked here; a mismatch is
 * logged and the stored equity range is what the lead view keeps showing.
 */

import { REFERENCE_METHOD, isCanonicalResult, runValuation, type ValuationInputs, type ValuationResult } from '../valuation/engine';
import { reviveResult } from '../valuation/serialize';

export function resultForReport(lead: { id?: string; inputs: unknown; results: unknown }): ValuationResult {
  const stored = reviveResult(lead.results);
  if (isCanonicalResult(stored)) return stored;
  const inputs = lead.inputs as ValuationInputs;
  const outcome = runValuation({ ...inputs, valuationDate: null, gccOwnership: null, purpose: inputs.purpose ?? null }, REFERENCE_METHOD);
  if (!outcome.ok) return stored;
  const same = outcome.result.equity.every((v, k) => Math.abs(v - stored.equity[k]) < 0.05);
  if (!same) {
    console.error('[tool-leads] stored result not reproduced for report', lead.id, stored.equity, outcome.result.equity);
  }
  return outcome.result;
}
