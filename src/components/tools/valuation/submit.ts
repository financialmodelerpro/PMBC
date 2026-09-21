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
/* Running again in the same session                                         */
/* ------------------------------------------------------------------------ */

/**
 * The lead this browser session created, so running the valuation again, even
 * after a reload in the same tab, updates it as a new version instead of
 * creating a second lead with a second admin alert. Session storage only: it
 * ends with the tab, and holds nothing the page did not already hold.
 */
const SESSION_LEAD_KEY = 'pmbcValuationLead';

export type SessionLead = {
  lead: { name: string; email: string; token: string; booking: string | null };
  /** The gate as submitted, less the honeypot. Its purpose and raise amount travel with each re-run. */
  gate: { name: string; email: string; company: string; purpose: string; dealSize: string; consent: boolean; followUp: boolean; raiseAmount: string };
};

export function readSessionLead(): SessionLead | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_LEAD_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as SessionLead;
    return typeof v?.lead?.token === 'string' && v.lead.token.length >= 20 ? v : null;
  } catch {
    return null;
  }
}

export function storeSessionLead(v: SessionLead | null): void {
  try {
    if (v) window.sessionStorage.setItem(SESSION_LEAD_KEY, JSON.stringify(v));
    else window.sessionStorage.removeItem(SESSION_LEAD_KEY);
  } catch {
    // Storage can be unavailable (private windows). The session still works until a reload.
  }
}

/**
 * A re-run: saves the inputs to the existing lead as a new version and sends
 * nothing (`sendEmail: false`). `unknown` means the lead no longer answers to
 * the token, so the caller starts a new lead through the gate. Any other
 * failure resolves to null and the page shows its own result.
 */
export async function saveRerun(token: string, inputs: unknown): Promise<{ result: ValuationResult } | 'unknown' | null> {
  try {
    const res = await fetch('/api/tools/business-valuation/lead/version', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, inputs, sendEmail: false }),
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 404) return 'unknown';
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: unknown };
    // A 429 still carries the recomputed result; it simply was not saved.
    if (data.result) return { result: reviveResult(data.result) };
    console.error('[valuation] re-run responded', res.status);
    return null;
  } catch (err) {
    console.error('[valuation] re-run request failed', err);
    return null;
  }
}
