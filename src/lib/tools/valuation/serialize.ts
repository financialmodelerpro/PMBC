/**
 * A `ValuationResult` to and from JSON.
 *
 * The engine uses NaN for "not meaningful" (an exit multiple value with
 * negative terminal EBITDA, a sensitivity cell where growth meets WACC), and
 * JSON has no NaN: `JSON.stringify` silently turns it into null, which then
 * multiplies as zero. So the conversion is explicit in both directions. Every
 * non-finite number is stored as null, and every null is read back as NaN,
 * except the fields in `NULL_MEANS_ABSENT`, whose null means "not used" or
 * "not given" rather than "not a number".
 */

import type { ValuationResult } from './engine';

/**
 * Keys whose null means "not entered" or "not used". A result field that can be
 * null must be listed here, or a stored null comes back as NaN, which passes a
 * `!== null` test and prints "n/a" (it did for borrowings, cash and invested
 * capital, added 2026-09-17, until 2026-09-21). `workingCapital` is also a
 * number inside `zakatBaseLtm`, which is never NaN, so listing it is safe.
 */
const NULL_MEANS_ABSENT = new Set([
  'compsEbitda', 'exit', 'ebitdaValue', 'raise', 'valuationDate', 'company', 'purpose',
  'debt', 'cash', 'investedCapital', 'workingCapital', 'fixedAssets', 'zakatBaseLtm',
  'ebitMultiplesPre', 'ebitMultiplesPost', 'ebitValue',
]);

export function serializeResult(result: ValuationResult): unknown {
  return JSON.parse(
    JSON.stringify(result, (_key, value) => (typeof value === 'number' && !Number.isFinite(value) ? null : value)),
  );
}

export function reviveResult(stored: unknown): ValuationResult {
  const walk = (value: unknown, key: string): unknown => {
    if (value === null) return NULL_MEANS_ABSENT.has(key) ? null : NaN;
    if (Array.isArray(value)) return value.map((v) => walk(v, ''));
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = walk(v, k);
      return out;
    }
    return value;
  };
  return walk(stored, '') as ValuationResult;
}
