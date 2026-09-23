/**
 * Browser helpers for the Growth admin screens (from Phase 2, 2026-09-23).
 * Every Growth API route answers `{ error: string, code?: string }` on failure.
 */

export class GrowthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function sendJson<T = Record<string, unknown>>(method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new GrowthRequestError(typeof data.error === 'string' ? data.error : `Request failed (${res.status})`, res.status, typeof data.code === 'string' ? data.code : undefined);
  return data as T;
}

/** Numbers typed by hand: "450,000,000" or "450m" or "1.2bn" to a number; blank to null; nonsense to NaN. */
export function parseAmount(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/,/g, '').replace(/^sar\s*/, '');
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(k|m|mn|million|b|bn|billion)?$/);
  if (!m) return Number.NaN;
  const mult = { k: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9 }[m[2] as 'k'] ?? 1;
  return Math.round(Number(m[1]) * mult);
}
