/**
 * Inbox cleanup (2026-11-02). Pure: the Signals screen and the verifier use it.
 *
 * The inbox filled with signals from runs made before the feed's filters and
 * event matching existed: office openings, regulator and market news, and one
 * event saved twice under different wording. This re-applies today's rules to
 * every new signal and proposes what to dismiss, each with its reason. Nothing
 * is dismissed until Ahmad ticks and confirms; the screen sends the ticked ones
 * to the bulk dismiss route, which dismisses only signals still new.
 *
 * Two rules, in order:
 *  1. Not a prospect: the feed's own name and summary rules (`notAProspectReason`):
 *     regulators, exchanges and index providers, market commentary with no
 *     named company, and a company opening an office. The model's judgement is
 *     not stored on a signal, so only these rules can be re-applied.
 *  2. The same event twice (`sameEvent`): of each group, the better version is
 *     kept (an article link over a homepage, then the fuller summary, then the
 *     older), and the others are proposed with the one kept named.
 */

import { notAProspectReason } from './feedRank';
import type { TriggerType } from './model';
import { sameEvent, signalQuality } from './signalsModel';

export type CleanupSignal = {
  id: string;
  created_at: string;
  status: string;
  company_id?: string | null;
  company_name: string | null;
  trigger_type: TriggerType;
  signal_date: string;
  summary: string;
  evidence_url: string;
  evidence_key?: string | null;
};

export type CleanupProposal = {
  id: string;
  company_name: string | null;
  signal_date: string;
  summary: string;
  kind: 'not_a_prospect' | 'duplicate';
  /** The reason the dismissal records. */
  reason: string;
  /** For a duplicate: the signal kept in its place. */
  keep_id?: string;
};

/** Every new signal today's rules would turn away, with the reason each dismissal records. */
export function planInboxCleanup(signals: CleanupSignal[]): CleanupProposal[] {
  const fresh = signals.filter((s) => s.status === 'new').sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const out: CleanupProposal[] = [];
  const remaining: CleanupSignal[] = [];
  for (const s of fresh) {
    const why = notAProspectReason({ company_name: s.company_name ?? '', trigger_type: s.trigger_type, signal_date: s.signal_date, summary: s.summary, prospect_fit: null, fit_reason: null });
    if (why) out.push({ id: s.id, company_name: s.company_name, signal_date: s.signal_date, summary: s.summary, kind: 'not_a_prospect', reason: `Inbox cleanup: ${why}` });
    else remaining.push(s);
  }
  const clusters: CleanupSignal[][] = [];
  for (const s of remaining) {
    const hit = clusters.find((cl) => cl.some((m) => sameEvent(s, m)));
    if (hit) hit.push(s);
    else clusters.push([s]);
  }
  for (const cl of clusters) {
    if (cl.length < 2) continue;
    // The oldest wins a tie: the list is oldest first and only a strictly better version replaces it.
    const keep = cl.reduce((a, b) => (signalQuality(b) > signalQuality(a) ? b : a));
    for (const s of cl) {
      if (s === keep) continue;
      out.push({ id: s.id, company_name: s.company_name, signal_date: s.signal_date, summary: s.summary, kind: 'duplicate', keep_id: keep.id, reason: `Inbox cleanup: the same event as "${keep.company_name ?? 'another signal'}" (${keep.signal_date}), kept in its place as the better version` });
    }
  }
  return out;
}
