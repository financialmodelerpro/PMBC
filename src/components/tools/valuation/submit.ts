/**
 * Browser side of the lead submission: attribution capture and the POST.
 *
 * Nothing here can stop a visitor seeing results. `submitLead` resolves to
 * null on any failure (network, timeout, a 4xx or 5xx, an unreadable body), and
 * the tool then shows the result it computed in the browser.
 */

import { reviveResult } from '@/lib/tools/valuation/serialize';
import type { ValuationResult } from '@/lib/tools/valuation/engine';

const ATTRIBUTION_KEY = 'pmbcToolAttribution';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export type Attribution = Partial<Record<(typeof UTM_KEYS)[number] | 'referrer' | 'landing_path', string>>;

/**
 * First touch within the browser session: the UTM tags, referrer and landing
 * path from when the visitor arrived, kept if they then move around the site
 * before using the tool. A later visit with new UTM tags replaces them.
 */
export function captureAttribution(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const hasUtm = UTM_KEYS.some((k) => params.get(k));
    const existing = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (existing && !hasUtm) return;
    const a: Attribution = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) a[k] = v.slice(0, 200);
    }
    if (document.referrer && !document.referrer.startsWith(window.location.origin)) a.referrer = document.referrer.slice(0, 500);
    a.landing_path = window.location.pathname.slice(0, 300);
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(a));
  } catch {
    // Storage blocked: attribution is a nicety, not a requirement.
  }
}

export function readAttribution(): Attribution {
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (raw) return JSON.parse(raw) as Attribution;
  } catch {
    // fall through
  }
  return { landing_path: typeof window !== 'undefined' ? window.location.pathname : undefined };
}

export async function submitLead(body: unknown): Promise<{ result: ValuationResult; token: string | null; booking: string | null } | null> {
  try {
    const res = await fetch('/api/tools/business-valuation/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error('[valuation] lead API responded', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as { ok?: boolean; result?: unknown; lead?: { token?: string; booking?: string | null } | null };
    if (!data.ok || !data.result) return null;
    return { result: reviveResult(data.result), token: data.lead?.token ?? null, booking: data.lead?.booking ?? null };
  } catch (err) {
    console.error('[valuation] lead API request failed', err);
    return null;
  }
}

/* ------------------------------------------------------------------------ */
/* The gate's prefill                                                        */
/* ------------------------------------------------------------------------ */

/**
 * The person's details from the last valuation in this tab, so the name and email step is quick the
 * next time. Only these: never a lead token, a company or consent, because every run from the form is
 * a new lead (since 2026-09-21). Until then the tab kept the lead itself (pmbcValuationLead) and a
 * second valuation was saved under the first; that key is removed on read, so a browser still
 * holding it from before is released.
 */
const PREFILL_KEY = 'pmbcValuationGate';
const RETIRED_LEAD_KEY = 'pmbcValuationLead';

export type GatePrefill = { name: string; email: string; purpose: string; dealSize: string; followUp: boolean; raiseAmount: string };

export function readGatePrefill(): Partial<GatePrefill> | null {
  try {
    window.sessionStorage.removeItem(RETIRED_LEAD_KEY);
    const raw = window.sessionStorage.getItem(PREFILL_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<GatePrefill>;
    const out: Partial<GatePrefill> = {};
    for (const k of ['name', 'email', 'purpose', 'dealSize', 'raiseAmount'] as const) if (typeof v[k] === 'string') out[k] = v[k];
    if (typeof v.followUp === 'boolean') out.followUp = v.followUp;
    return out;
  } catch {
    return null;
  }
}

export function storeGatePrefill(v: GatePrefill): void {
  try {
    window.sessionStorage.setItem(PREFILL_KEY, JSON.stringify(v));
  } catch {
    // Storage can be unavailable (private windows): the gate is simply not prefilled.
  }
}
