/**
 * A `ValuationResult` to and from JSON.
 *
 * The engine uses NaN for "not meaningful" (an exit multiple value with
 * negative terminal EBITDA, a sensitivity cell where growth meets WACC), and
 * JSON has no NaN: `JSON.stringify` silently turns it into null, which then
 * multiplies as zero. So the conversion is explicit in both directions. Every
 * non-finite number is stored as null, and every null is read back as NaN,
 * except `compsEbitda`, whose null means "not used" rather than "not a number".
 */

import type { ValuationResult } from './engine';

export function serializeResult(result: ValuationResult): unknown {
  return JSON.parse(
    JSON.stringify(result, (_key, value) => (typeof value === 'number' && !Number.isFinite(value) ? null : value)),
  );
}

export function reviveResult(stored: unknown): ValuationResult {
  const walk = (value: unknown, key: string): unknown => {
    if (value === null) return key === 'compsEbitda' ? null : NaN;
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
