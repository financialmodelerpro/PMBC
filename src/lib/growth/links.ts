/**
 * Tracked links and opt-out links (Unit 3.2, 2026-09-23). Server only.
 *
 * Every outreach email carries two unguessable tokens: one per link to a site
 * page, and one opt-out link. A tracked link logs the click, remembers the
 * visitor in a first-party cookie (read by the website chat in Phase 4) and
 * redirects to a path on this site only. An opt-out link adds the address to
 * the suppression list, marks the contact opted out, stops the sequence and
 * cancels anything waiting to send. Suppression always wins after that.
 */

import { randomBytes } from 'node:crypto';

import { hashIp } from '@/lib/tools/leads/request';

import { logActivity } from './activity';
import { growthDb } from './db';
import { addSuppression } from './suppression';

export const TRACK_COOKIE = 'pmbc_gt';
export const TRACK_COOKIE_DAYS = 60;

export const newToken = () => randomBytes(24).toString('base64url');

export type LinkRow = { id: string; token: string; kind: 'link' | 'opt_out'; lead_id: string | null; contact_id: string | null; message_id: string | null; target_path: string; is_test: boolean; click_count: number };

/** A site path, never another origin: "//evil.com" and "https://..." are refused. */
export function safeSitePath(path: string | null | undefined): string {
  const p = (path ?? '/').trim();
  return /^\/(?!\/)[^\s\\]*$/.test(p) ? p : '/';
}

export async function createLinks(input: { leadId: string | null; contactId: string | null; messageId: string; targetPath: string | null; isTest: boolean }): Promise<{ link: LinkRow | null; optOut: LinkRow } | { error: string }> {
  const base = { lead_id: input.leadId, contact_id: input.contactId, message_id: input.messageId, is_test: input.isTest };
  const rows = [
    ...(input.targetPath ? [{ ...base, token: newToken(), kind: 'link', target_path: safeSitePath(input.targetPath) }] : []),
    { ...base, token: newToken(), kind: 'opt_out', target_path: '/' },
  ];
  const { data, error } = await growthDb().from('growth_tracked_links').insert(rows).select('*');
  if (error || !data) return { error: error?.message ?? 'links not created' };
  const list = data as LinkRow[];
  const optOut = list.find((l) => l.kind === 'opt_out');
  if (!optOut) return { error: 'opt-out link not created' };
  return { link: list.find((l) => l.kind === 'link') ?? null, optOut };
}

export async function linkByToken(token: string): Promise<LinkRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  try {
    const { data } = await growthDb().from('growth_tracked_links').select('*').eq('token', token).maybeSingle();
    return (data as LinkRow | null) ?? null;
  } catch {
    return null;
  }
}

/** Records a click and returns where to send the visitor. Unknown tokens go to the home page. */
export async function recordClick(token: string, headers: Headers): Promise<{ path: string; link: LinkRow | null }> {
  const link = await linkByToken(token);
  if (!link || link.kind !== 'link') return { path: '/', link: null };
  const ip = (headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || headers.get('x-real-ip');
  await growthDb().from('growth_link_clicks').insert({ link_id: link.id, is_test: link.is_test, ip_hash: hashIp(ip ?? null), user_agent: (headers.get('user-agent') ?? '').slice(0, 300) || null });
  await growthDb().from('growth_tracked_links').update({ click_count: link.click_count + 1, last_clicked_at: new Date().toISOString() }).eq('id', link.id);
  const { data: lead } = link.lead_id ? await growthDb().from('growth_leads').select('company_id').eq('id', link.lead_id).maybeSingle() : { data: null };
  await logActivity({ actorType: 'system', actorId: 'tracked-link', action: 'outreach.click', summary: `Clicked the link to ${link.target_path}`, companyId: (lead as { company_id: string | null } | null)?.company_id ?? null, contactId: link.contact_id, leadId: link.lead_id, isTest: link.is_test, metadata: { link_id: link.id, message_id: link.message_id } });
  if (link.lead_id) {
    const { rescoreLead } = await import('./leadScore');
    await rescoreLead(link.lead_id);
  }
  return { path: safeSitePath(link.target_path), link };
}

export type OptOutResult = { ok: true; email: string | null } | { ok: false; error: string };

/** Opts the link's contact out of all outreach, for good. */
export async function optOut(token: string): Promise<OptOutResult> {
  const link = await linkByToken(token);
  if (!link || link.kind !== 'opt_out' || !link.contact_id) return { ok: false, error: 'This link is not valid.' };
  const { data: c } = await growthDb().from('growth_contacts').select('id, email, company_id, consent_status').eq('id', link.contact_id).maybeSingle();
  const contact = c as { id: string; email: string | null; company_id: string | null; consent_status: string } | null;
  if (!contact) return { ok: false, error: 'This link is not valid.' };
  if (contact.email) {
    const r = await addSuppression({ kind: 'email', value: contact.email, reason: 'Opted out from an outreach email', source: 'growth_contact', sourceRef: contact.id }, null, { isTest: link.is_test });
    if (!r.ok && r.status !== 409) return { ok: false, error: 'Something went wrong. Please reply to the email instead and we will remove you.' };
  }
  await growthDb().from('growth_contacts').update({ consent_status: 'opted_out', consent_source: 'Opt-out link in an outreach email', consent_at: new Date().toISOString() }).eq('id', contact.id);
  await stopForContact(contact.id, 'opted out');
  await logActivity({ actorType: 'system', actorId: 'opt-out', action: 'outreach.opt_out', summary: 'Opted out using the link in an email: suppressed for good', companyId: contact.company_id, contactId: contact.id, leadId: link.lead_id, isTest: link.is_test });
  return { ok: true, email: contact.email };
}

/** Stops every active sequence for a contact and cancels anything waiting to send. */
export async function stopForContact(contactId: string, reason: string): Promise<void> {
  await growthDb().from('growth_messages').update({ status: 'cancelled', cancelled_reason: `Contact ${reason}` }).eq('contact_id', contactId).in('status', ['draft', 'approved', 'scheduled']);
  await growthDb().from('growth_leads').update({ sequence_status: 'stopped', sequence_stopped_reason: reason, next_follow_up_at: null }).eq('contact_id', contactId).eq('sequence_status', 'active');
}
