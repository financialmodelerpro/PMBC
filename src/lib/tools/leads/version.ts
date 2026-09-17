/**
 * "Email me this version": the visitor changes inputs after seeing results
 * (including the exploration sliders) and asks for the new figures.
 *
 * The same lead is updated rather than a new one created, so one person is one
 * lead. What it held before is kept as a `version_saved` event whose payload is
 * the previous inputs and results, which is the version history the admin
 * detail view shows. The results email is then sent again with the new report.
 *
 * RULES
 *   1. The lead is found by its access token only. An unknown token is a 404.
 *   2. The tool must be Live, unless the caller is signed-in staff.
 *   3. Inputs are validated and recomputed exactly as a first submission is.
 *   4. At most RATE_LIMIT.perHour new versions per lead in an hour and
 *      RATE_LIMIT.perDay in a day. Over the limit: 429, nothing changes,
 *      and the browser keeps showing the results it computed.
 *   5. The honeypot applies, answered with the same 200 a real update gets.
 *
 * Pure against an injected `VersionStore`, so `verify-tool-lead-api` proves it
 * with an in-memory store.
 */

import { z } from 'zod';

import { VALUATION_DATA_VERSION } from '../valuation/data';
import type { ValuationResult } from '../valuation/engine';
import { serializeResult } from '../valuation/serialize';
import { recomputeInputs } from './valuation';

export const VERSION_RATE_LIMIT = { perHour: 5, perDay: 20 } as const;

const bodySchema = z.object({
  token: z.string().min(20).max(200),
  inputs: z.unknown(),
  website: z.string().max(500).optional(),
});

export type VersionLead = {
  id: string;
  tool_slug: string;
  is_test: boolean;
  inputs: unknown;
  results: unknown;
  data_version: string;
};

export type VersionStore = {
  findByToken(token: string): Promise<VersionLead | null>;
  countVersionsSince(leadId: string, sinceIso: string): Promise<number | null>;
  /** Records the previous version as an event, then writes the new one onto the lead. */
  saveVersion(
    lead: VersionLead,
    next: { inputs: unknown; results: unknown; equity_low: number; equity_mid: number; equity_high: number; wacc: number | null; data_version: string },
  ): Promise<boolean>;
};

export type VersionOutcome =
  | { kind: 'invalid' | 'not_found' | 'rate_limited' | 'save_failed'; status: 400 | 404 | 429 | 500; body: Record<string, unknown>; lead: null; result: null }
  | { kind: 'saved' | 'honeypot'; status: 200; body: { ok: true; result: unknown }; lead: VersionLead | null; result: ValuationResult };

export async function processVersionUpdate(
  raw: unknown,
  ctx: { now: Date; toolLive: boolean; isStaff: boolean },
  store: VersionStore,
): Promise<VersionOutcome> {
  const fail = (kind: 'invalid' | 'not_found' | 'rate_limited' | 'save_failed', status: 400 | 404 | 429 | 500, body: Record<string, unknown>): VersionOutcome => ({
    kind, status, body, lead: null, result: null,
  });

  if (!ctx.toolLive && !ctx.isStaff) return fail('not_found', 404, { error: 'Not found' });
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return fail('invalid', 400, { error: 'Validation failed' });

  const recomputed = recomputeInputs(parsed.data.inputs, ctx.now);
  if (!recomputed.ok) return fail('invalid', 400, { error: 'Validation failed', issues: recomputed.issues });
  const result = recomputed.result;
  const serialized = serializeResult(result);

  if ((parsed.data.website ?? '').trim() !== '') {
    return { kind: 'honeypot', status: 200, body: { ok: true, result: serialized }, lead: null, result };
  }

  const lead = await store.findByToken(parsed.data.token);
  if (!lead) return fail('not_found', 404, { error: 'Not found' });

  if (!ctx.isStaff) {
    const hourAgo = new Date(ctx.now.getTime() - 3600_000).toISOString();
    const dayAgo = new Date(ctx.now.getTime() - 86_400_000).toISOString();
    const [hour, day] = await Promise.all([store.countVersionsSince(lead.id, hourAgo), store.countVersionsSince(lead.id, dayAgo)]);
    if ((hour ?? 0) >= VERSION_RATE_LIMIT.perHour || (day ?? 0) >= VERSION_RATE_LIMIT.perDay) {
      return fail('rate_limited', 429, {
        error: 'You have updated this valuation several times recently. Please try again later.',
        result: serialized,
      });
    }
  }

  const ok = await store.saveVersion(lead, {
    inputs: recomputed.inputs,
    results: serialized,
    equity_low: result.equityDisplay[0],
    equity_mid: result.equityDisplay[1],
    equity_high: result.equityDisplay[2],
    wacc: Number.isFinite(result.wacc.wacc) ? result.wacc.wacc : null,
    data_version: VALUATION_DATA_VERSION,
  });
  if (!ok) return fail('save_failed', 500, { error: 'Could not save this version', result: serialized });
  return { kind: 'saved', status: 200, body: { ok: true, result: serialized }, lead, result };
}
