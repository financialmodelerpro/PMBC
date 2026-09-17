/**
 * The Business Valuation lead submission: validate, recompute, filter, save.
 *
 * Written against injected dependencies (`LeadStore`, the clock, who is asking)
 * rather than against Supabase and a Request, so `npm run verify-tool-lead-api`
 * can prove every rule with an in-memory store. The route in
 * `src/app/api/tools/[slug]/lead/route.ts` supplies the real ones.
 *
 * THE RULES
 *   1. A Hidden tool is a 404 unless the caller is signed-in staff, whose
 *      submissions are saved with is_test true.
 *   2. The body is validated to the same limits the form applies, then the
 *      valuation is recomputed with the shared engine. Nothing the browser says
 *      about results is read; the schema has no field for it.
 *   3. Honeypot filled, or submitted under the minimum fill time: the visitor is
 *      shown results exactly as normal and nothing is saved. A bot told it was
 *      blocked changes tactics; a bot told it succeeded stops.
 *   4. More than RATE_LIMIT.perHour or RATE_LIMIT.perDay leads from the same
 *      hashed IP: results as normal, nothing saved. Staff are exempt.
 *   5. A save that fails (including the table not existing yet) still returns
 *      results. Saving is for the firm; results are for the visitor.
 */

import { z } from 'zod';

import { BELOW_MINIMUM_BAND, DEAL_BANDS_SAR, DEAL_BAND_UNSURE, PURPOSES, VALUATION_DATA_VERSION } from '../valuation/data';
import { INPUT_SCHEMA_VERSION, isoDate, runValuation, TOTAL_YEARS, type ValuationInputs, type ValuationResult } from '../valuation/engine';
import { cleanProfile } from '../valuation/profile';
import { serializeResult } from '../valuation/serialize';
import { CONSENT_TEXT, FOLLOW_UP_TEXT } from '../consent';

export const MIN_FILL_MS = 3000;
export const RATE_LIMIT = { perHour: 5, perDay: 20 } as const;

/* ------------------------------------------------------------------------ */
/* Schema                                                                    */
/* ------------------------------------------------------------------------ */

/** A number a person could plausibly type, or blank. Bounds only stop absurd payloads. */
const cell = z.number().finite().gte(-1e12).lte(1e12).nullable();
const line = z.array(cell).length(TOTAL_YEARS);

const inputsSchema = z.object({
  industry: z.string().max(100),
  country: z.string().max(100),
  financialYear: z.number().int().nullable(),
  netDebt: cell,
  // Version 4: borrowings and cash (below) are entered separately and the engine derives net debt from them.
  debt: cell.optional(),
  financials: z.object({ rev: line, ebitda: line, da: line, capex: line, nwc: line }),
  wacc: z.object({
    rf: cell, erp: cell, crp: cell, bu: cell, de: cell, sp: cell, ds: cell, cs: cell, tax: cell,
    inflationLocal: cell, inflationUs: cell,
  }),
  growth: cell,
  exitMultiple: cell,
  midYear: z.boolean(),
  peers: z
    .array(z.object({ name: z.string().max(120), evEbitda: cell, evRevenue: cell }))
    .max(25),
  privateDiscount: cell,
  dcfWeight: cell,
  // Version 2. Every block is optional: a version 1 body is still valid, and
  // the engine fills anything absent with its neutral default.
  schemaVersion: z.number().int().min(1).max(99).optional(),
  normalisation: z.object({ oneOff: cell, ownerCosts: cell, carryOwnerCosts: z.boolean() }).optional(),
  bridge: z.object({ eosb: cell, leases: cell, minorityInterest: cell, surplusAssets: cell }).optional(),
  stake: z
    .object({
      percent: cell,
      adjustment: z.enum(['none', 'control_premium', 'minority_discount']),
      controlPremium: cell,
      minorityDiscount: cell,
    })
    .optional(),
  scenarios: z
    .object({
      upsideGrowth: cell, upsideMargin: cell, downsideGrowth: cell, downsideMargin: cell,
      weightDownside: cell, weightBase: cell, weightUpside: cell,
    })
    .optional(),
  investedCapital: cell.optional(),
  waccAdjustment: z.number().finite().gte(-10).lte(10).nullable().optional(),
  // Visitor text for the report. Cleaned here, so every endpoint stores and
  // renders the same plain text. The raw caps only refuse absurd payloads; the
  // real limits are applied by cleanProfile.
  profile: z
    .object({ companyName: z.string().max(1000).nullable().optional(), description: z.string().max(10000).nullable().optional() })
    .optional()
    .transform((p) => cleanProfile(p)),
  // Version 3. The valuation date is accepted for shape only: the server always
  // replaces it with its own date (`stampServerFields`).
  gccOwnership: cell.optional(),
  cash: cell.optional(),
  raiseAmount: cell.optional(),
  purpose: z.string().max(40).nullable().optional(),
  valuationDate: z.string().max(20).nullable().optional(),
});

export type SubmittedInputs = z.infer<typeof inputsSchema>;

/**
 * What the server decides rather than the browser: the schema version, and the
 * valuation date, which is the day the server computes the valuation.
 */
export function stampServerFields<T extends SubmittedInputs>(inputs: T, now: Date): T {
  // A page from before version 4 (still open in a browser across a deploy) sends
  // net debt with no borrowings: it is stamped version 3 and valued as entered.
  const version = inputs.debt === null || inputs.debt === undefined ? Math.min(INPUT_SCHEMA_VERSION, 3) : INPUT_SCHEMA_VERSION;
  return { ...inputs, schemaVersion: version, valuationDate: isoDate(now) };
}

/** Validates and recomputes inputs alone. Shared by the lead, version and PDF endpoints. */
export function recomputeInputs(
  raw: unknown,
  now: Date = new Date(),
): { ok: true; inputs: SubmittedInputs; result: ValuationResult } | { ok: false; issues: { path: string; message: string }[] } {
  const parsed = inputsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => ({ path: `inputs.${i.path.join('.')}`, message: i.message })) };
  }
  const stamped = stampServerFields(parsed.data, now);
  const outcome = runValuation(stamped as ValuationInputs);
  if (!outcome.ok) {
    const errors = outcome.errors;
    return {
      ok: false,
      issues:
        typeof errors === 'string'
          ? [{ path: `step${outcome.step + 1}`, message: errors }]
          : Object.entries(errors).map(([path, message]) => ({ path: `inputs.${path}`, message })),
    };
  }
  return { ok: true, inputs: stamped, result: outcome.result };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const dealValues: [string, ...string[]] = [DEAL_BAND_UNSURE, ...DEAL_BANDS_SAR.map((b) => b.value as string)];
const purposeValues: [string, ...string[]] = [PURPOSES[0].value, ...PURPOSES.slice(1).map((p) => p.value as string)];
const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => z.string().trim().max(max).optional().nullable();

export const submissionSchema = z.object({
  inputs: inputsSchema,
  gate: z.object({
    name: text(120).refine((v) => v.length >= 2, 'Enter your full name.'),
    email: text(200).refine((v) => EMAIL_RE.test(v), 'Enter a valid email address, for example name@company.com.'),
    company: optional(160),
    purpose: z.enum(purposeValues, { message: 'Select what the valuation is for.' }),
    dealSize: z.enum(dealValues, { message: 'Select a transaction size range.' }),
    consent: z.literal(true, { message: 'Tick the box to agree before we show your results.' }),
    followUp: z.boolean(),
  }),
  attribution: z
    .object({
      utm_source: optional(200),
      utm_medium: optional(200),
      utm_campaign: optional(200),
      utm_term: optional(200),
      utm_content: optional(200),
      referrer: optional(500),
      landing_path: optional(300),
    })
    .partial()
    .optional(),
  /** Honeypot. */
  website: z.string().max(500).optional(),
  /** Milliseconds from the tool appearing to the gate being submitted. */
  elapsedMs: z.number().optional(),
});

export type Submission = z.infer<typeof submissionSchema>;

/* ------------------------------------------------------------------------ */
/* Dependencies                                                              */
/* ------------------------------------------------------------------------ */

export type LeadInsert = Record<string, unknown> & { access_token: string };

export type LeadStore = {
  /** Leads from this IP hash since the given instant. `null` when the count could not be read. */
  countSince(ipHash: string, sinceIso: string): Promise<number | null>;
  insert(row: LeadInsert): Promise<{ ok: true; id: string } | { ok: false; reason: 'missing_table' | 'error'; message?: string }>;
};

export type SubmissionContext = {
  now: Date;
  toolSlug: string;
  toolLive: boolean;
  isStaff: boolean;
  ipHash: string | null;
  userAgent: string | null;
  newToken: () => string;
};

export type SavedLead = { id: string; accessToken: string; row: LeadInsert };

export type SubmissionOutcome =
  | { kind: 'not_found'; status: 404; body: { error: string } }
  | { kind: 'invalid'; status: 400; body: { error: string; issues: { path: string; message: string }[] } }
  | {
      kind: 'saved' | 'honeypot' | 'too_fast' | 'rate_limited' | 'save_failed';
      status: 200;
      /** What the browser receives. Identical in shape for every kind, so a bot cannot tell them apart. */
      body: { ok: true; result: unknown; lead: { token: string } | null };
      result: ValuationResult;
      saved: SavedLead | null;
      detail?: string;
    };

/* ------------------------------------------------------------------------ */

export async function processValuationSubmission(
  raw: unknown,
  ctx: SubmissionContext,
  store: LeadStore,
): Promise<SubmissionOutcome> {
  if (!ctx.toolLive && !ctx.isStaff) {
    return { kind: 'not_found', status: 404, body: { error: 'Not found' } };
  }

  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      kind: 'invalid',
      status: 400,
      body: {
        error: 'Validation failed',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    };
  }
  const data = parsed.data;
  // The purpose is the gate's, and a raise amount means something only when raising equity.
  const inputs = stampServerFields(
    {
      ...data.inputs,
      purpose: data.gate.purpose,
      raiseAmount: data.gate.purpose === 'raise' ? (data.inputs.raiseAmount ?? null) : null,
    },
    ctx.now,
  );

  const outcome = runValuation(inputs as ValuationInputs);
  if (!outcome.ok) {
    const errors = outcome.errors;
    const issues =
      typeof errors === 'string'
        ? [{ path: `step${outcome.step + 1}`, message: errors }]
        : Object.entries(errors).map(([path, message]) => ({ path: `inputs.${path}`, message }));
    return { kind: 'invalid', status: 400, body: { error: 'Validation failed', issues } };
  }
  const result = outcome.result;
  const serialized = serializeResult(result);
  const respond = (
    kind: 'saved' | 'honeypot' | 'too_fast' | 'rate_limited' | 'save_failed',
    saved: SavedLead | null,
    detail?: string,
  ): SubmissionOutcome => ({
    kind,
    status: 200,
    body: { ok: true, result: serialized, lead: saved ? { token: saved.accessToken } : null },
    result,
    saved,
    detail,
  });

  if ((data.website ?? '').trim() !== '') return respond('honeypot', null);
  if (typeof data.elapsedMs === 'number' && data.elapsedMs < MIN_FILL_MS) {
    return respond('too_fast', null, `${data.elapsedMs}ms`);
  }

  if (!ctx.isStaff && ctx.ipHash) {
    const hourAgo = new Date(ctx.now.getTime() - 3600_000).toISOString();
    const dayAgo = new Date(ctx.now.getTime() - 86_400_000).toISOString();
    const [perHour, perDay] = await Promise.all([store.countSince(ctx.ipHash, hourAgo), store.countSince(ctx.ipHash, dayAgo)]);
    if ((perHour ?? 0) >= RATE_LIMIT.perHour || (perDay ?? 0) >= RATE_LIMIT.perDay) {
      return respond('rate_limited', null, `hour ${perHour}, day ${perDay}`);
    }
  }

  const g = data.gate;
  const nowIso = ctx.now.toISOString();
  const a = data.attribution ?? {};
  const row: LeadInsert = {
    tool_slug: ctx.toolSlug,
    is_test: ctx.isStaff,
    data_version: VALUATION_DATA_VERSION,
    name: g.name,
    email: g.email.toLowerCase(),
    company: g.company || inputs.profile?.companyName || null,
    purpose: g.purpose,
    deal_size_band: g.dealSize,
    below_minimum: g.dealSize === BELOW_MINIMUM_BAND,
    country: inputs.country,
    currency: result.currency.code,
    industry: inputs.industry,
    inputs,
    results: serialized,
    equity_low: result.equityDisplay[0],
    equity_mid: result.equityDisplay[1],
    equity_high: result.equityDisplay[2],
    wacc: Number.isFinite(result.wacc.wacc) ? result.wacc.wacc : null,
    consent_given: true,
    consent_at: nowIso,
    consent_text: CONSENT_TEXT,
    follow_up_consent: g.followUp,
    follow_up_consent_at: g.followUp ? nowIso : null,
    utm_source: a.utm_source || null,
    utm_medium: a.utm_medium || null,
    utm_campaign: a.utm_campaign || null,
    utm_term: a.utm_term || null,
    utm_content: a.utm_content || null,
    referrer: a.referrer || null,
    landing_path: a.landing_path || null,
    ip_hash: ctx.ipHash,
    user_agent: ctx.userAgent ? ctx.userAgent.slice(0, 400) : null,
    access_token: ctx.newToken(),
    email_status: 'pending',
    alert_status: 'pending',
  };

  const inserted = await store.insert(row);
  if (!inserted.ok) return respond('save_failed', null, inserted.reason + (inserted.message ? `: ${inserted.message}` : ''));
  return respond('saved', { id: inserted.id, accessToken: row.access_token, row });
}

/** The follow-up wording, exported beside CONSENT_TEXT for the admin detail view. */
export { FOLLOW_UP_TEXT };
