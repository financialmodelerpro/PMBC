/**
 * Nurture through Brevo (Units 6.1 and 6.2, 2026-09-23). Server only.
 *
 * Only opted-in contacts are nurtured: a subscription needs consent status
 * "opted in" (a database constraint), and every send checks suppression first.
 *
 * Real or mock: nurture is real only with BREVO_API_KEY, EMAIL_FROM_DEFAULT
 * and GROWTH_BREVO_LIST_ID set, and nothing is sent or synced unless
 * `nurture_enabled` is on in Settings (default off). BREVO_API_KEY already
 * sends the site's transactional mail; GROWTH_BREVO_LIST_ID is the deliberate
 * extra switch for marketing mail. In mock mode a sync or a run is a preview:
 * nothing is sent, synced or advanced.
 *
 * 6.1 Sync: subscribed contacts go to the Growth list with SECTOR,
 * SERVICE_INTEREST, STAGE and COMPANY attributes for segments; unsubscribed or
 * suppressed ones are removed from it.
 * 6.2 Sequence: approved steps, each a set number of days after the last;
 * lead magnets sent on request to opted-in contacts. Every email carries an
 * opt-out link. Brevo events (opens, clicks, unsubscribes, bounces,
 * complaints) update the message, the contact and the suppression list.
 */

import { z } from 'zod';

import { SITE_HREF } from '@/lib/brand/letterhead';
import { sendEmail } from '@/lib/email/send';
import { normaliseEvent } from '@/lib/tools/webhook';

import { logActivity } from './activity';
import type { WriteResult } from './api';
import { growthDb, tableExists } from './db';
import { getEngineSettings, pendingMigration } from './engineSettings';
import type { Actor } from './kb';
import { createLinks } from './links';
import { normaliseEmail, type GrowthContact } from './model';
import { buildEmail, optOutUrl, unresolvedPlaceholders } from './outreachModel';
import { addSuppression, checkSuppression } from './suppression';

export const NURTURE_ENV = ['BREVO_API_KEY', 'EMAIL_FROM_DEFAULT', 'GROWTH_BREVO_LIST_ID'] as const;

export function nurtureConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return NURTURE_ENV.every((k) => Boolean(env[k]?.trim())) && /^\d+$/.test(env.GROWTH_BREVO_LIST_ID?.trim() ?? '');
}

export type NurtureStep = { id: string; step: number; delay_days: number; subject: string; body: string; link_path: string | null; status: 'draft' | 'approved' | 'archived'; approved_at: string | null; approved_by_name: string | null; is_test: boolean };
export type LeadMagnet = { id: string; title: string; description: string | null; url: string; email_subject: string; email_body: string; status: 'draft' | 'approved' | 'archived'; approved_at: string | null; is_test: boolean };
type NurtureContact = GrowthContact & { nurture_status?: string; nurture_step?: number; nurture_next_at?: string | null; service_interest?: string[]; brevo_synced_at?: string | null };

const NOT_READY = 'Nurture needs 092_growth_nurture_partners.sql applied first.';

export async function nurtureReady(): Promise<boolean> {
  return tableExists('growth_nurture_steps');
}

async function enabled(): Promise<{ on: boolean; why: string | null }> {
  const engine = await getEngineSettings();
  const pending = pendingMigration(engine, ['nurture_enabled']);
  if (pending) return { on: false, why: NOT_READY };
  if (!engine.values.nurture_enabled) return { on: false, why: 'Nurture is off in Settings.' };
  return { on: true, why: null };
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function setSubscription(contactId: string, subscribe: boolean, actor: Actor | null, reason?: string): Promise<WriteResult<NurtureContact>> {
  const { data } = await growthDb().from('growth_contacts').select('*').eq('id', contactId).maybeSingle();
  const c = data as NurtureContact | null;
  if (!c) return { ok: false, status: 404, error: 'Contact not found' };
  if (!('nurture_status' in c)) return { ok: false, status: 503, error: NOT_READY };
  if (subscribe) {
    if (c.consent_status !== 'opted_in') return { ok: false, status: 409, code: 'no_opt_in', error: 'Only a contact who has opted in can be subscribed' };
    if (!c.email) return { ok: false, status: 422, error: 'The contact has no email address' };
    if ((await checkSuppression(c.email)).suppressed) return { ok: false, status: 409, code: 'suppressed', error: `${c.email} is suppressed` };
  }
  const now = new Date().toISOString();
  const patch = subscribe ? { nurture_status: 'subscribed', nurture_changed_at: now, nurture_step: 0, nurture_next_at: now } : { nurture_status: 'unsubscribed', nurture_changed_at: now, nurture_next_at: null };
  const { data: after, error } = await growthDb().from('growth_contacts').update(patch).eq('id', contactId).select('*').single();
  if (error || !after) return { ok: false, status: error?.code === '23514' ? 409 : 500, error: error?.code === '23514' ? 'Only a contact who has opted in can be subscribed' : error?.message ?? 'Save failed' };
  await logActivity({ actorType: actor ? 'admin' : 'system', actorId: actor?.id ?? 'nurture', action: subscribe ? 'nurture.subscribed' : 'nurture.unsubscribed', summary: subscribe ? 'Subscribed to the nurture sequence' : `Unsubscribed from nurture${reason ? `: ${reason}` : ''}`, contactId, companyId: c.company_id, isTest: c.is_test });
  return { ok: true, value: after as NurtureContact };
}

// ---------------------------------------------------------------------------
// Steps and lead magnets
// ---------------------------------------------------------------------------

export const stepSchema = z.object({
  step: z.number().int().min(1).max(24),
  delay_days: z.number().int().min(0).max(365),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20).max(6000),
  link_path: z.string().trim().regex(/^\/[^/\s][^\s]*$/, 'A site path such as /services/refm').nullable().optional().or(z.literal('')),
});

export const magnetSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  url: z.string().trim().refine((u) => /^https:\/\/\S+$/i.test(u) || /^\/[^/\s]/.test(u), 'An https link or a site path'),
  email_subject: z.string().trim().min(1).max(200),
  email_body: z.string().trim().min(20).max(6000),
});

export async function listSteps(includeTest = false): Promise<NurtureStep[]> {
  let q = growthDb().from('growth_nurture_steps').select('*').neq('status', 'archived').order('step');
  if (!includeTest) q = q.eq('is_test', false);
  const { data } = await q;
  return (data ?? []) as NurtureStep[];
}

export async function listMagnets(includeTest = false): Promise<LeadMagnet[]> {
  let q = growthDb().from('growth_lead_magnets').select('*').neq('status', 'archived').order('created_at');
  if (!includeTest) q = q.eq('is_test', false);
  const { data } = await q;
  return (data ?? []) as LeadMagnet[];
}

/** Saves a step's working text. Any edit returns it to draft for approval again. */
export async function saveStep(id: string | null, input: z.infer<typeof stepSchema>, actor: Actor, opts: { isTest?: boolean } = {}): Promise<WriteResult<NurtureStep>> {
  const row = { ...input, link_path: input.link_path || null, status: 'draft', approved_at: null, approved_by_name: null, updated_by_name: actor.name };
  const q = id ? growthDb().from('growth_nurture_steps').update(row).eq('id', id) : growthDb().from('growth_nurture_steps').insert({ ...row, is_test: Boolean(opts.isTest) });
  const { data, error } = await q.select('*').single();
  if (error || !data) return { ok: false, status: error?.code === '23505' ? 409 : 500, error: error?.code === '23505' ? `Step ${input.step} already exists` : error?.message ?? 'Save failed' };
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'nurture.step_saved', summary: `Nurture step ${input.step} saved as a draft`, isTest: (data as NurtureStep).is_test });
  return { ok: true, value: data as NurtureStep };
}

export async function saveMagnet(id: string | null, input: z.infer<typeof magnetSchema>, actor: Actor, opts: { isTest?: boolean } = {}): Promise<WriteResult<LeadMagnet>> {
  const row = { ...input, status: 'draft', approved_at: null, approved_by_name: null };
  const q = id ? growthDb().from('growth_lead_magnets').update(row).eq('id', id) : growthDb().from('growth_lead_magnets').insert({ ...row, is_test: Boolean(opts.isTest) });
  const { data, error } = await q.select('*').single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? 'Save failed' };
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'nurture.magnet_saved', summary: `Lead magnet "${input.title}" saved as a draft`, isTest: (data as LeadMagnet).is_test });
  return { ok: true, value: data as LeadMagnet };
}

/** Approves or archives a step or lead magnet. Approval refuses text that still holds a placeholder. */
export async function actOnContent(table: 'growth_nurture_steps' | 'growth_lead_magnets', id: string, action: 'approve' | 'archive', actor: Actor): Promise<WriteResult<{ id: string; status: string }>> {
  const { data } = await growthDb().from(table).select('*').eq('id', id).maybeSingle();
  if (!data) return { ok: false, status: 404, error: 'Not found' };
  const row = data as Record<string, string>;
  if (action === 'approve') {
    const text = table === 'growth_nurture_steps' ? `${row.subject}\n${row.body}` : `${row.email_subject}\n${row.email_body}`;
    const left = unresolvedPlaceholders(text.replace(/\[First name\]/g, ''));
    if (left.length) return { ok: false, status: 422, error: `Replace these first: ${left.join(', ')} ([First name] and [Link] are filled when sent)` };
  }
  const patch = action === 'approve' ? { status: 'approved', approved_at: new Date().toISOString(), approved_by_name: actor.name } : { status: 'archived' };
  const { error } = await growthDb().from(table).update(patch).eq('id', id);
  if (error) return { ok: false, status: 500, error: error.message };
  await logActivity({ actorType: 'admin', actorId: actor.id, action: `nurture.${action}d`, summary: `${table === 'growth_nurture_steps' ? `Nurture step ${row.step}` : `Lead magnet "${row.title}"`} ${action}d`, isTest: Boolean(row.is_test) });
  return { ok: true, value: { id, status: patch.status } };
}

// ---------------------------------------------------------------------------
// Sending (sequence and lead magnets)
// ---------------------------------------------------------------------------

async function sendOne(c: NurtureContact, input: { subject: string; body: string; linkPath: string | null; kind: 'nurture' | 'lead_magnet'; step: number; magnetId?: string | null; actor: Actor | null }): Promise<WriteResult<{ messageId: string }>> {
  if (!c.email) return { ok: false, status: 422, error: 'No email address' };
  const sup = await checkSuppression(c.email);
  if (sup.suppressed) return { ok: false, status: 409, code: 'suppressed', error: `Suppressed: ${sup.reasons.map((r) => r.reason).join('; ')}` };
  const first = c.full_name.split(/\s+/)[0] ?? '';
  const body = input.body.split('[First name]').join(first);
  const { data: msg, error } = await growthDb()
    .from('growth_messages')
    .insert({ is_test: c.is_test, contact_id: c.id, company_id: c.company_id, channel: 'email', kind: input.kind, sequence_step: Math.min(input.step, 10), subject: input.subject, body, link_path: input.linkPath, status: 'approved', approved_at: new Date().toISOString(), approved_by_name: 'Approved content', lead_magnet_id: input.magnetId ?? null })
    .select('id')
    .single();
  if (error || !msg) return { ok: false, status: 500, error: error?.message ?? 'Could not record the message' };
  const id = (msg as { id: string }).id;
  const links = await createLinks({ leadId: null, contactId: c.id, messageId: id, targetPath: input.linkPath && input.linkPath.startsWith('/') ? input.linkPath : null, isTest: c.is_test });
  if ('error' in links) {
    await growthDb().from('growth_messages').update({ status: 'failed', error: links.error }).eq('id', id);
    return { ok: false, status: 500, error: links.error };
  }
  const linkUrl = input.linkPath ? (input.linkPath.startsWith('/') && links.link ? `${SITE_HREF}/api/growth/l/${links.link.token}` : input.linkPath) : null;
  const email = buildEmail({ body, linkUrl, optOutUrl: optOutUrl(links.optOut.token) });
  const res = await sendEmail({ to: c.email, subject: input.subject, html: email.html, tags: ['growth-nurture'], headers: { 'X-Mailin-custom': `growth:${id}` } });
  if (!res.ok) {
    await growthDb().from('growth_messages').update({ status: 'failed', error: res.message ?? res.reason }).eq('id', id);
    return { ok: false, status: 502, error: res.message ?? res.reason };
  }
  await growthDb().from('growth_messages').update({ status: 'sent', sent_at: new Date().toISOString(), send_mode: 'brevo', provider_message_id: res.id }).eq('id', id);
  return { ok: true, value: { messageId: id } };
}

export type RunPreview = { contact: string; email: string | null; step: number; subject: string };
export type RunResult = { mode: 'real' | 'mock_preview' | 'off'; sent: number; skipped: number; preview: RunPreview[]; message: string };

/** Sends each subscribed contact's next approved step when it is due. */
export async function runSequence(now: Date = new Date()): Promise<RunResult> {
  if (!(await nurtureReady())) return { mode: 'off', sent: 0, skipped: 0, preview: [], message: NOT_READY };
  const state = await enabled();
  const real = nurtureConfigured();
  const steps = (await listSteps()).filter((s) => s.status === 'approved');
  const { data } = await growthDb().from('growth_contacts').select('*').eq('nurture_status', 'subscribed').eq('is_test', false).lte('nurture_next_at', now.toISOString()).limit(200);
  const due = (data ?? []) as NurtureContact[];
  const plan = due.map((c) => ({ c, step: steps.find((s) => s.step === (c.nurture_step ?? 0) + 1) ?? null }));
  const preview = plan.filter((p) => p.step).map((p) => ({ contact: p.c.full_name, email: p.c.email, step: p.step!.step, subject: p.step!.subject }));
  if (!state.on) return { mode: 'off', sent: 0, skipped: 0, preview, message: `${state.why} ${preview.length} emails would be due.` };
  if (!real) return { mode: 'mock_preview', sent: 0, skipped: 0, preview, message: `Mock mode: GROWTH_BREVO_LIST_ID is not set, so nothing was sent. ${preview.length} emails would go.` };
  let sent = 0;
  let skipped = 0;
  for (const p of plan) {
    if (!p.step) {
      await growthDb().from('growth_contacts').update({ nurture_next_at: null }).eq('id', p.c.id);
      skipped++;
      continue;
    }
    const r = await sendOne(p.c, { subject: p.step.subject, body: p.step.body, linkPath: p.step.link_path, kind: 'nurture', step: p.step.step, actor: null });
    if (!r.ok) {
      skipped++;
      if (r.code === 'suppressed') await setSubscription(p.c.id, false, null, 'suppressed');
      continue;
    }
    sent++;
    const next = steps.find((s) => s.step === p.step!.step + 1);
    await growthDb().from('growth_contacts').update({ nurture_step: p.step.step, nurture_next_at: next ? new Date(now.getTime() + next.delay_days * 86_400_000).toISOString() : null }).eq('id', p.c.id);
    await logActivity({ actorType: 'system', actorId: 'nurture', action: 'nurture.sent', summary: `Nurture step ${p.step.step} sent: ${p.step.subject}`, contactId: p.c.id, companyId: p.c.company_id, metadata: { message_id: r.value.messageId } });
  }
  return { mode: 'real', sent, skipped, preview: [], message: `${sent} nurture emails sent, ${skipped} skipped.` };
}

/** Sends an approved lead magnet to an opted-in contact. */
export async function sendLeadMagnet(contactId: string, magnetId: string, actor: Actor): Promise<WriteResult<{ mode: 'real' | 'mock_preview'; messageId: string | null; preview: string }>> {
  if (!(await nurtureReady())) return { ok: false, status: 503, error: NOT_READY };
  const [{ data: c }, { data: m }] = await Promise.all([growthDb().from('growth_contacts').select('*').eq('id', contactId).maybeSingle(), growthDb().from('growth_lead_magnets').select('*').eq('id', magnetId).maybeSingle()]);
  const contact = c as NurtureContact | null;
  const magnet = m as LeadMagnet | null;
  if (!contact || !magnet) return { ok: false, status: 404, error: 'Contact or lead magnet not found' };
  if (magnet.status !== 'approved') return { ok: false, status: 409, error: 'Approve the lead magnet first' };
  if (contact.consent_status !== 'opted_in') return { ok: false, status: 409, code: 'no_opt_in', error: 'Only an opted-in contact can be sent a lead magnet' };
  const body = magnet.email_body.includes('[Link]') ? magnet.email_body : `${magnet.email_body}\n\n[Link]`;
  const state = await enabled();
  if (!state.on || !nurtureConfigured()) return { ok: true, value: { mode: 'mock_preview', messageId: null, preview: `${state.on ? 'Mock mode: GROWTH_BREVO_LIST_ID is not set' : state.why}. Nothing was sent. It would send "${magnet.email_subject}" to ${contact.email}.` } };
  const r = await sendOne(contact, { subject: magnet.email_subject, body, linkPath: magnet.url, kind: 'lead_magnet', step: 0, magnetId: magnet.id, actor });
  if (!r.ok) return r;
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'nurture.magnet_sent', summary: `Lead magnet sent: ${magnet.title}`, contactId, companyId: contact.company_id, metadata: { message_id: r.value.messageId } });
  return { ok: true, value: { mode: 'real', messageId: r.value.messageId, preview: 'Sent.' } };
}

// ---------------------------------------------------------------------------
// Brevo sync
// ---------------------------------------------------------------------------

async function brevo(path: string, body: unknown): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`https://api.brevo.com/v3${path}`, { method: 'POST', headers: { 'api-key': process.env.BREVO_API_KEY as string, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  return { ok: res.ok, status: res.status, text: (await res.text()).slice(0, 300) };
}

export async function syncToBrevo(): Promise<{ mode: 'real' | 'mock_preview' | 'off'; synced: number; removed: number; failed: number; message: string }> {
  if (!(await nurtureReady())) return { mode: 'off', synced: 0, removed: 0, failed: 0, message: NOT_READY };
  const state = await enabled();
  const { data: subs } = await growthDb().from('growth_contacts').select('*').eq('nurture_status', 'subscribed').eq('is_test', false).limit(5000);
  const { data: unsubs } = await growthDb().from('growth_contacts').select('id, email').eq('nurture_status', 'unsubscribed').eq('is_test', false).not('brevo_synced_at', 'is', null).limit(5000);
  const list = (subs ?? []) as NurtureContact[];
  if (!state.on) return { mode: 'off', synced: 0, removed: 0, failed: 0, message: `${state.why} ${list.length} subscribed contacts would sync.` };
  if (!nurtureConfigured()) return { mode: 'mock_preview', synced: 0, removed: 0, failed: 0, message: `Mock mode: GROWTH_BREVO_LIST_ID is not set. ${list.length} subscribed contacts would sync to Brevo, segmented by sector, service interest and stage.` };
  const listId = Number(process.env.GROWTH_BREVO_LIST_ID);
  let synced = 0;
  let failed = 0;
  const companyIds = [...new Set(list.map((c) => c.company_id).filter((x): x is string => Boolean(x)))];
  const { data: cos } = companyIds.length ? await growthDb().from('growth_companies').select('id, name, sector').in('id', companyIds) : { data: [] };
  const C = new Map(((cos ?? []) as { id: string; name: string; sector: string | null }[]).map((c) => [c.id, c]));
  for (const c of list) {
    if (!c.email || (await checkSuppression(c.email)).suppressed) continue;
    const { data: lead } = await growthDb().from('growth_leads').select('stage').eq('contact_id', c.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    const company = c.company_id ? C.get(c.company_id) : undefined;
    const [first, ...rest] = c.full_name.split(/\s+/);
    const r = await brevo('/contacts', { email: c.email, updateEnabled: true, listIds: [listId], attributes: { FIRSTNAME: first, LASTNAME: rest.join(' '), COMPANY: company?.name ?? '', SECTOR: company?.sector ?? '', SERVICE_INTEREST: (c.service_interest ?? []).join(', '), STAGE: (lead as { stage: string } | null)?.stage ?? '' } });
    await growthDb().from('growth_contacts').update(r.ok ? { brevo_synced_at: new Date().toISOString(), brevo_sync_error: null } : { brevo_sync_error: `${r.status}: ${r.text}` }).eq('id', c.id);
    if (r.ok) synced++;
    else failed++;
  }
  const removeEmails = ((unsubs ?? []) as { email: string | null }[]).map((u) => u.email).filter((e): e is string => Boolean(e));
  let removed = 0;
  for (let k = 0; k < removeEmails.length; k += 150) {
    const r = await brevo(`/contacts/lists/${listId}/contacts/remove`, { emails: removeEmails.slice(k, k + 150) });
    if (r.ok || r.status === 400) removed += Math.min(150, removeEmails.length - k);
  }
  return { mode: 'real', synced, removed, failed, message: `${synced} contacts synced to Brevo, ${removed} removed, ${failed} failed.` };
}

// ---------------------------------------------------------------------------
// Brevo events
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The Growth message an event belongs to, from the X-Mailin-custom header "growth:<id>". */
export function growthMessageId(raw: Record<string, unknown>): string | null {
  const v = raw['X-Mailin-custom'] ?? raw['x-mailin-custom'];
  if (typeof v !== 'string') return null;
  const m = v.match(/(?:^|\|)growth:([0-9a-f-]{36})(?:\||$)/i);
  return m && UUID.test(m[1]) ? m[1] : null;
}

export type EventOutcome = 'applied' | 'duplicate' | 'ignored';

/** Applies one Brevo event once: opens and clicks to the message, stops to the contact and suppression list. */
export async function handleBrevoEvent(raw: Record<string, unknown>): Promise<EventOutcome> {
  const ev = normaliseEvent(raw);
  const messageId = growthMessageId(raw);
  const email = normaliseEmail(ev.email);
  if (!ev.type || (!messageId && !email)) return 'ignored';
  const { data: msgRow } = messageId ? await growthDb().from('growth_messages').select('id, contact_id, company_id, lead_id, is_test, opened_at, clicked_at').eq('id', messageId).maybeSingle() : { data: null };
  const msg = msgRow as { id: string; contact_id: string | null; company_id: string | null; lead_id: string | null; is_test: boolean; opened_at: string | null; clicked_at: string | null } | null;
  let contactId = msg?.contact_id ?? null;
  if (!contactId && email) {
    const { data: c } = await growthDb().from('growth_contacts').select('id').eq('email', email).maybeSingle();
    contactId = (c as { id: string } | null)?.id ?? null;
  }
  if (!msg && !contactId) return 'ignored';
  const isTest = msg?.is_test ?? false;
  const { error } = await growthDb().from('growth_brevo_events').insert({ event: ev.brevoEvent, email, message_id: msg?.id ?? null, contact_id: contactId, dedupe_key: ev.dedupeKey, payload: raw, is_test: isTest });
  if (error) return error.code === '23505' ? 'duplicate' : 'ignored';
  const at = ev.occurredAt;
  if (msg && ev.type === 'opened' && !msg.opened_at) await growthDb().from('growth_messages').update({ opened_at: at }).eq('id', msg.id);
  if (msg && ev.type === 'clicked' && !msg.clicked_at) await growthDb().from('growth_messages').update({ clicked_at: at }).eq('id', msg.id);
  const stop = ev.type === 'unsubscribed' || ev.type === 'complaint' || ev.type === 'bounced';
  if (stop && email) {
    const reason = ev.type === 'unsubscribed' ? 'Unsubscribed from a Growth email (Brevo)' : ev.type === 'complaint' ? 'Marked a Growth email as spam (Brevo)' : 'Email hard bounced (Brevo)';
    await addSuppression({ kind: 'email', value: email, reason, source: 'growth_contact', sourceRef: contactId }, null, { isTest });
    if (contactId) {
      await growthDb().from('growth_contacts').update({ nurture_status: 'unsubscribed', nurture_changed_at: at, nurture_next_at: null, ...(ev.type !== 'bounced' ? { consent_status: 'opted_out', consent_source: reason, consent_at: at } : {}) }).eq('id', contactId);
    }
  }
  await logActivity({
    actorType: 'system',
    actorId: 'brevo',
    action: `nurture.${ev.type}`,
    summary: `Email ${ev.type === 'clicked' ? 'link clicked' : ev.type}${stop ? ': suppressed for good' : ''}`,
    contactId,
    companyId: msg?.company_id ?? null,
    leadId: msg?.lead_id ?? null,
    isTest,
    metadata: { message_id: msg?.id ?? null, brevo_event: ev.brevoEvent, link: ev.link },
  });
  if (msg?.lead_id && (ev.type === 'clicked' || ev.type === 'opened')) {
    const { rescoreLead } = await import('./leadScore');
    await rescoreLead(msg.lead_id);
  }
  return 'applied';
}
