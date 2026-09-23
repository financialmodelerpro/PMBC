/**
 * Meetings (Units 5.1 to 5.3, 2026-09-23). Server only.
 *
 * 5.1 Bookings: with Microsoft Bookings configured (the four MS_GRAPH_*
 * variables and MS_BOOKINGS_BUSINESS_ID), the daily run and the Sync button
 * read appointments from a week back to two months ahead. A new appointment is
 * matched to a lead by the attendee's email (the contact's latest open lead),
 * or a contact and lead are created; the lead moves to Meeting Booked and
 * Ahmad is alerted. A moved appointment is marked rescheduled with its old
 * time; a cancelled one, cancelled. Without the variables the sync is a
 * labelled preview that saves nothing, and calls can be added by hand.
 *
 * 5.2 Briefs: before each call the meeting-brief agent writes the company,
 * trigger, activity so far, requirement and size, likely services, open
 * questions and a recommended next action, from the CRM record only. Made for
 * calls in the next two days by the daily run, or on demand.
 *
 * 5.3 After the call: notes and outcome; the lead moves on. A recap email is
 * drafted for approval; a no-show gets a rebooking draft with the booking
 * link. Both go through the normal approval and sending rules.
 */

import { SITE_HREF } from '@/lib/brand/letterhead';
import { sendEmail } from '@/lib/email/send';

import { logActivity } from './activity';
import { runAi } from './ai/run';
import { extractJsonObject, knowledgeText, stripEmails } from './agents/json';
import type { WriteResult } from './api';
import { growthDb, tableExists } from './db';
import { getEngineSettings } from './engineSettings';
import { graphBookingAppointments, graphBookingsConfigured, type BookingAppointment } from './graph';
import { getApprovedKnowledge, type Actor } from './kb';
import { GROWTH_SERVICES, isGrowthService, normaliseEmail, type GrowthContact, type GrowthLead, type GrowthSignal } from './model';
import { fillKnown, type Message } from './outreach';
import { contactByEmail, createContact, createLead, getCompany, getLead, updateLead } from './prospects';

export const BRIEF_AGENT = 'meeting-brief';
export const RECAP_AGENT = 'meeting-recap';

export type MeetingStatus = 'scheduled' | 'rescheduled' | 'cancelled' | 'completed' | 'no_show';
export type MeetingOutcome = 'positive' | 'proposal_requested' | 'needs_follow_up' | 'not_a_fit' | 'other';

export const MEETING_OUTCOMES: { value: MeetingOutcome; label: string; stage: string | null }[] = [
  { value: 'positive', label: 'Positive: next step agreed', stage: 'opportunity' },
  { value: 'proposal_requested', label: 'Proposal requested', stage: 'proposal' },
  { value: 'needs_follow_up', label: 'Needs a follow-up', stage: 'qualified' },
  { value: 'not_a_fit', label: 'Not a fit', stage: 'lost' },
  { value: 'other', label: 'Other', stage: null },
];

export type Brief = { company: string; trigger: string; activity: string; requirement: string; likely_services: string[]; open_questions: string[]; next_action: string };

export type Meeting = {
  id: string;
  created_at: string;
  is_test: boolean;
  is_mock: boolean;
  source: 'bookings' | 'manual';
  external_id: string | null;
  lead_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  starts_at: string;
  ends_at: string | null;
  previous_starts_at: string | null;
  status: MeetingStatus;
  service_name: string | null;
  join_url: string | null;
  customer_notes: string | null;
  brief: Brief | null;
  brief_is_mock: boolean;
  brief_at: string | null;
  notes: string | null;
  outcome: MeetingOutcome | null;
  outcome_at: string | null;
  synced_at: string | null;
  created_by_name: string | null;
};

const NOT_READY = 'Meetings need 091_growth_meetings.sql applied first.';

export async function meetingsReady(): Promise<boolean> {
  return tableExists('growth_meetings');
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const { data } = await growthDb().from('growth_meetings').select('*').eq('id', id).maybeSingle();
  return (data as Meeting | null) ?? null;
}

export async function listMeetings(opts: { includeTest?: boolean; from?: Date; to?: Date; limit?: number } = {}): Promise<Meeting[]> {
  let q = growthDb().from('growth_meetings').select('*').order('starts_at', { ascending: true }).limit(opts.limit ?? 300);
  if (!opts.includeTest) q = q.eq('is_test', false);
  if (opts.from) q = q.gte('starts_at', opts.from.toISOString());
  if (opts.to) q = q.lt('starts_at', opts.to.toISOString());
  const { data } = await q;
  return (data ?? []) as Meeting[];
}

async function alertEmail(): Promise<string> {
  const engine = await getEngineSettings();
  return engine.values.lead_alert_email;
}

async function alert(m: Meeting, subject: string, line: string): Promise<void> {
  if (m.is_test || m.is_mock) return;
  const res = await sendEmail({
    to: await alertEmail(),
    subject,
    html: `<p>${line.replace(/</g, '&lt;')}</p><p>${new Date(m.starts_at).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', dateStyle: 'full', timeStyle: 'short' })} Riyadh time.</p><p><a href="${SITE_HREF}/admin/growth/meetings/${m.id}">Open the meeting</a></p>`,
  });
  await logActivity({ actorType: 'system', actorId: 'meetings', action: 'meeting.alert', summary: `${subject}: alert ${res.ok ? 'sent' : 'not sent'}`, leadId: m.lead_id, contactId: m.contact_id, companyId: m.company_id, isTest: m.is_test, metadata: { meeting_id: m.id } });
}

/** The attendee's lead: their contact's latest open lead, or a new contact and lead. Moves it to Meeting Booked. */
async function matchLead(input: { email: string | null; name: string | null; isTest: boolean; actor: Actor | null }): Promise<{ contactId: string | null; leadId: string | null; companyId: string | null }> {
  const email = normaliseEmail(input.email);
  let contact: GrowthContact | null = email ? await contactByEmail(email) : null;
  if (!contact && (email || input.name)) {
    const ct = await createContact(null, { full_name: input.name || (email ? email.split('@')[0] : 'Meeting attendee'), email, consent_status: 'legitimate_interest', consent_source: 'Booked a call with Ahmad' }, input.actor, { isTest: input.isTest, system: !input.actor });
    if (ct.ok) contact = ct.value;
  }
  if (!contact) return { contactId: null, leadId: null, companyId: null };
  const { data: leads } = await growthDb().from('growth_leads').select('*').eq('contact_id', contact.id).not('stage', 'in', '(won,lost)').order('updated_at', { ascending: false }).limit(1);
  let lead = ((leads ?? []) as GrowthLead[])[0] ?? null;
  if (!lead) {
    const l = await createLead(contact.company_id, { title: `${contact.full_name}: booked call`, contact_id: contact.id, source: 'website', source_ref: 'bookings', stage: 'meeting_booked' }, input.actor, { isTest: input.isTest, system: !input.actor });
    if (l.ok) lead = l.value;
  } else if (['prospect', 'contacted', 'replied', 'qualified', 'nurture'].includes(lead.stage)) {
    await updateLead(lead.id, { stage: 'meeting_booked' }, input.actor, { system: !input.actor });
  }
  return { contactId: contact.id, leadId: lead?.id ?? null, companyId: lead?.company_id ?? contact.company_id };
}

export type SyncResult = { mode: 'real' | 'mock_preview'; created: number; rescheduled: number; cancelled: number; unchanged: number; preview: BookingAppointment[]; message: string };

/** Mock appointments: shown as a labelled preview, never saved. */
function sampleAppointments(now: Date): BookingAppointment[] {
  const day = (d: number, h: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d, h - 3)).toISOString();
  return [
    { id: 'sample-1', start: day(2, 11), end: day(2, 12), customerName: 'Sample Attendee (made up)', customerEmail: 'sample.attendee@example.invalid', serviceName: 'Discovery call (sample)', joinUrl: null, cancelled: false, notes: 'Sample booking from the mock preview' },
    { id: 'sample-2', start: day(5, 14), end: day(5, 15), customerName: 'Another Sample (made up)', customerEmail: 'another.sample@example.invalid', serviceName: 'Discovery call (sample)', joinUrl: null, cancelled: true, notes: null },
  ];
}

export async function syncBookings(opts: { actor?: Actor | null; now?: Date } = {}): Promise<WriteResult<SyncResult>> {
  const now = opts.now ?? new Date();
  const empty = { created: 0, rescheduled: 0, cancelled: 0, unchanged: 0 };
  if (!graphBookingsConfigured()) {
    return { ok: true, value: { mode: 'mock_preview', ...empty, preview: sampleAppointments(now), message: 'Mock mode: Microsoft Bookings is not configured. These sample bookings are a preview and were not saved. Add calls by hand meanwhile.' } };
  }
  if (!(await meetingsReady())) return { ok: false, status: 503, error: NOT_READY };
  const res = await graphBookingAppointments(new Date(now.getTime() - 7 * 86_400_000), new Date(now.getTime() + 60 * 86_400_000));
  if (!res.ok) return { ok: false, status: 502, error: res.error };
  const out = { ...empty };
  for (const a of res.appointments) {
    if (!a.id || !a.start) continue;
    const { data: existingRow } = await growthDb().from('growth_meetings').select('*').eq('external_id', a.id).maybeSingle();
    const existing = existingRow as Meeting | null;
    const synced = new Date().toISOString();
    if (!existing) {
      if (a.cancelled) continue;
      const match = await matchLead({ email: a.customerEmail, name: a.customerName, isTest: false, actor: null });
      const { data, error } = await growthDb()
        .from('growth_meetings')
        .insert({ source: 'bookings', external_id: a.id, lead_id: match.leadId, contact_id: match.contactId, company_id: match.companyId, attendee_name: a.customerName, attendee_email: normaliseEmail(a.customerEmail), starts_at: a.start, ends_at: a.end || null, service_name: a.serviceName, join_url: a.joinUrl && /^https:\/\//i.test(a.joinUrl) ? a.joinUrl : null, customer_notes: a.notes, synced_at: synced, created_by_name: 'Bookings sync' })
        .select('*')
        .single();
      if (error || !data) continue;
      out.created++;
      const m = data as Meeting;
      await logActivity({ actorType: 'system', actorId: 'bookings-sync', action: 'meeting.booked', summary: `Call booked for ${new Date(m.starts_at).toISOString().slice(0, 16).replace('T', ' ')} UTC through Microsoft Bookings`, leadId: m.lead_id, contactId: m.contact_id, companyId: m.company_id, metadata: { meeting_id: m.id } });
      await alert(m, `New booking: ${m.attendee_name ?? m.attendee_email ?? 'a visitor'}`, `${m.attendee_name ?? ''} ${m.attendee_email ? `<${m.attendee_email}>` : ''} booked ${m.service_name ?? 'a call'}.`);
      continue;
    }
    if (a.cancelled && existing.status !== 'cancelled') {
      await growthDb().from('growth_meetings').update({ status: 'cancelled', synced_at: synced }).eq('id', existing.id);
      out.cancelled++;
      await logActivity({ actorType: 'system', actorId: 'bookings-sync', action: 'meeting.cancelled', summary: 'The booked call was cancelled in Microsoft Bookings', leadId: existing.lead_id, contactId: existing.contact_id, companyId: existing.company_id, metadata: { meeting_id: existing.id } });
      await alert(existing, `Booking cancelled: ${existing.attendee_name ?? existing.attendee_email ?? 'a visitor'}`, 'The call was cancelled in Microsoft Bookings.');
    } else if (!a.cancelled && Date.parse(a.start) !== Date.parse(existing.starts_at) && ['scheduled', 'rescheduled'].includes(existing.status)) {
      await growthDb().from('growth_meetings').update({ status: 'rescheduled', previous_starts_at: existing.starts_at, starts_at: a.start, ends_at: a.end || null, synced_at: synced, brief: null, brief_at: null }).eq('id', existing.id);
      out.rescheduled++;
      await logActivity({ actorType: 'system', actorId: 'bookings-sync', action: 'meeting.rescheduled', summary: 'The booked call was moved in Microsoft Bookings', leadId: existing.lead_id, contactId: existing.contact_id, companyId: existing.company_id, metadata: { meeting_id: existing.id, from: existing.starts_at, to: a.start } });
      await alert({ ...existing, starts_at: a.start }, `Booking moved: ${existing.attendee_name ?? existing.attendee_email ?? 'a visitor'}`, 'The call was moved in Microsoft Bookings.');
    } else {
      await growthDb().from('growth_meetings').update({ synced_at: synced }).eq('id', existing.id);
      out.unchanged++;
    }
  }
  return { ok: true, value: { mode: 'real', ...out, preview: [], message: `${out.created} new, ${out.rescheduled} moved, ${out.cancelled} cancelled, ${out.unchanged} unchanged.` } };
}

export async function createManualMeeting(input: { lead_id?: string | null; attendee_name?: string | null; attendee_email?: string | null; starts_at: string; ends_at?: string | null; join_url?: string | null }, actor: Actor, opts: { isTest?: boolean } = {}): Promise<WriteResult<Meeting>> {
  if (!(await meetingsReady())) return { ok: false, status: 503, error: NOT_READY };
  let leadId = input.lead_id ?? null;
  let contactId: string | null = null;
  let companyId: string | null = null;
  let isTest = Boolean(opts.isTest);
  if (leadId) {
    const lead = await getLead(leadId);
    if (!lead) return { ok: false, status: 404, error: 'Lead not found' };
    contactId = lead.contact_id;
    companyId = lead.company_id;
    isTest = isTest || lead.is_test;
    if (['prospect', 'contacted', 'replied', 'qualified', 'nurture'].includes(lead.stage)) await updateLead(lead.id, { stage: 'meeting_booked' }, actor);
  } else {
    const m = await matchLead({ email: input.attendee_email ?? null, name: input.attendee_name ?? null, isTest, actor });
    leadId = m.leadId;
    contactId = m.contactId;
    companyId = m.companyId;
  }
  let name = input.attendee_name ?? null;
  let email = normaliseEmail(input.attendee_email);
  if (contactId && (!name || !email)) {
    const { data } = await growthDb().from('growth_contacts').select('full_name, email').eq('id', contactId).maybeSingle();
    name = name ?? (data as { full_name: string } | null)?.full_name ?? null;
    email = email ?? (data as { email: string | null } | null)?.email ?? null;
  }
  const { data, error } = await growthDb()
    .from('growth_meetings')
    .insert({ source: 'manual', is_test: isTest, lead_id: leadId, contact_id: contactId, company_id: companyId, attendee_name: name, attendee_email: email, starts_at: input.starts_at, ends_at: input.ends_at ?? null, join_url: input.join_url || null, created_by_name: actor.name })
    .select('*')
    .single();
  if (error || !data) return { ok: false, status: error?.code === '23514' ? 422 : 500, error: error?.code === '23514' ? 'Check the times and the join link (https only)' : error?.message ?? 'Save failed' };
  const m = data as Meeting;
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'meeting.booked', summary: `Call added by hand for ${m.starts_at.slice(0, 16).replace('T', ' ')} UTC`, leadId, contactId, companyId, isTest, metadata: { meeting_id: m.id } });
  if (leadId) {
    const { rescoreLead } = await import('./leadScore');
    await rescoreLead(leadId);
  }
  return { ok: true, value: m };
}

/** Everything the CRM knows about the call's lead, for the brief. No outside facts. */
async function briefContext(m: Meeting): Promise<string> {
  const lead = m.lead_id ? await getLead(m.lead_id) : null;
  const company = m.company_id ? await getCompany(m.company_id) : lead?.company_id ? await getCompany(lead.company_id) : null;
  const [signals, messages, convs, acts] = await Promise.all([
    company ? growthDb().from('growth_signals').select('*').eq('company_id', company.id).neq('status', 'dismissed').order('signal_date', { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
    m.lead_id ? growthDb().from('growth_messages').select('channel, kind, status, subject, body, sent_at, replied_at').eq('lead_id', m.lead_id).in('status', ['sent']).order('sent_at').limit(10) : Promise.resolve({ data: [] }),
    m.lead_id ? growthDb().from('growth_conversations').select('qualification, route, first_page').eq('lead_id', m.lead_id).limit(3) : Promise.resolve({ data: [] }),
    m.lead_id ? growthDb().from('growth_activity').select('created_at, summary').eq('lead_id', m.lead_id).order('created_at', { ascending: false }).limit(15) : Promise.resolve({ data: [] }),
  ]);
  return [
    `Attendee: ${m.attendee_name ?? 'unknown'}${m.service_name ? `, booked "${m.service_name}"` : ''}${m.customer_notes ? `. Their note: ${m.customer_notes}` : ''}`,
    company ? `Company: ${company.name}; sector ${company.sector ?? 'unknown'}; ${[company.city, company.country].filter(Boolean).join(', ')}; ${company.description ?? ''}; Prospect Score ${company.prospect_score ?? 'none'}` : 'Company: unknown',
    lead ? `Lead: ${lead.title}; stage ${lead.stage}; service ${lead.recommended_service ?? 'unknown'}; size ${lead.deal_size_sar ?? 'unknown'} SAR; timeline ${lead.timeline ?? 'unknown'}; requirement ${lead.requirement ?? 'unknown'}` : 'Lead: none',
    `Signals: ${((signals.data ?? []) as GrowthSignal[]).map((s) => `${s.signal_date}: ${s.summary}`).join(' | ') || 'none'}`,
    `Messages sent: ${((messages.data ?? []) as Pick<Message, 'channel' | 'kind' | 'subject' | 'sent_at' | 'replied_at'>[]).map((x) => `${x.sent_at?.slice(0, 10)} ${x.channel} ${x.kind}${x.replied_at ? ' (replied)' : ''}: ${x.subject ?? ''}`).join(' | ') || 'none'}`,
    `Website chat qualification: ${JSON.stringify(((convs.data ?? []) as { qualification: unknown }[]).map((c) => c.qualification))}`,
    `Recent activity: ${((acts.data ?? []) as { created_at: string; summary: string | null }[]).map((a) => `${a.created_at.slice(0, 10)} ${a.summary ?? ''}`).join(' | ')}`,
  ].join('\n');
}

export async function generateBrief(meetingId: string, opts: { actor?: Actor | null } = {}): Promise<WriteResult<Meeting>> {
  const m = await getMeeting(meetingId);
  if (!m) return { ok: false, status: 404, error: 'Meeting not found' };
  const kb = await getApprovedKnowledge({ includeTest: m.is_test });
  const system = [
    'You prepare a short brief for Ahmad Din, partner at PaceMakers Business Consultants, before a call with a prospect. Use only the CRM record given; do not add outside facts. Unknown stays unknown.',
    `Likely services must be site service slugs: ${GROWTH_SERVICES.map((s) => s.value).join(', ')}.`,
    'Approved services:',
    knowledgeText(kb.service.map((s) => ({ title: `${s.title} (${s.key})`, content: s.content }))),
    'Answer with one JSON object and nothing else: {"company": string, "trigger": string, "activity": string, "requirement": string, "likely_services": [slug], "open_questions": [string], "next_action": string}',
    'Plain words. No em dashes.',
  ].join('\n');
  const ai = await runAi({ agent: BRIEF_AGENT, purpose: 'meeting_brief', system, messages: [{ role: 'user', content: await briefContext(m) }], maxTokens: 1500, requireKnowledgeKinds: ['service'], related: { leadId: m.lead_id, companyId: m.company_id }, isTest: m.is_test });
  if (!ai.ok) return { ok: false, status: ai.reason === 'provider_error' ? 502 : 409, code: ai.reason, error: ai.message };
  const raw = (extractJsonObject(ai.text) ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max = 1000) => (typeof v === 'string' ? stripEmails(v).trim().slice(0, max) : '');
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.map((x) => str(x, 300)).filter(Boolean).slice(0, max) : []);
  const brief: Brief = {
    company: str(raw.company),
    trigger: str(raw.trigger),
    activity: str(raw.activity),
    requirement: str(raw.requirement),
    likely_services: list(raw.likely_services, 4).filter((s) => isGrowthService(s)),
    open_questions: list(raw.open_questions, 8),
    next_action: str(raw.next_action, 500),
  };
  const { data, error } = await growthDb().from('growth_meetings').update({ brief, brief_is_mock: ai.mock, brief_usage_id: ai.usageId, brief_at: new Date().toISOString() }).eq('id', m.id).select('*').single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? 'The brief could not be saved' };
  await logActivity({ actorType: 'ai', actorId: BRIEF_AGENT, action: 'meeting.brief', summary: `${ai.mock ? 'Mock meeting brief' : 'Meeting brief'} prepared`, leadId: m.lead_id, companyId: m.company_id, contactId: m.contact_id, isTest: m.is_test, metadata: { meeting_id: m.id, mock: ai.mock } });
  return { ok: true, value: data as Meeting };
}

/** Briefs for calls in the next two days that do not have one yet. */
export async function briefUpcoming(now: Date = new Date()): Promise<string> {
  if (!(await meetingsReady())) return NOT_READY;
  const { data } = await growthDb().from('growth_meetings').select('id').in('status', ['scheduled', 'rescheduled']).is('brief', null).eq('is_test', false).gte('starts_at', now.toISOString()).lt('starts_at', new Date(now.getTime() + 2 * 86_400_000).toISOString()).limit(20);
  let made = 0;
  const problems: string[] = [];
  for (const { id } of (data ?? []) as { id: string }[]) {
    const r = await generateBrief(id);
    if (r.ok) made++;
    else problems.push(r.error);
  }
  return `${made} meeting briefs prepared${problems.length ? `; ${problems.length} could not be (${problems[0]})` : ''}.`;
}

export async function recordOutcome(meetingId: string, input: { status: 'completed' | 'no_show' | 'cancelled'; notes?: string | null; outcome?: MeetingOutcome | null; lost_reason?: string | null }, actor: Actor): Promise<WriteResult<Meeting>> {
  const m = await getMeeting(meetingId);
  if (!m) return { ok: false, status: 404, error: 'Meeting not found' };
  if (input.status === 'completed' && !input.outcome) return { ok: false, status: 422, error: 'Choose the outcome' };
  if (input.outcome === 'not_a_fit' && !input.lost_reason?.trim() && !input.notes?.trim()) return { ok: false, status: 422, error: 'Say why it is not a fit' };
  const patch = { status: input.status, notes: input.notes ?? m.notes, outcome: input.status === 'completed' ? input.outcome : null, outcome_at: input.status === 'completed' ? new Date().toISOString() : null };
  const { data, error } = await growthDb().from('growth_meetings').update(patch).eq('id', m.id).select('*').single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? 'Save failed' };
  const after = data as Meeting;
  const label = input.status === 'completed' ? MEETING_OUTCOMES.find((o) => o.value === input.outcome)?.label : input.status === 'no_show' ? 'No show' : 'Cancelled';
  await logActivity({ actorType: 'admin', actorId: actor.id, action: `meeting.${input.status}`, summary: `Call ${input.status === 'completed' ? 'held' : input.status === 'no_show' ? 'missed' : 'cancelled'}: ${label}${input.notes ? `. ${input.notes.slice(0, 200)}` : ''}`, leadId: m.lead_id, companyId: m.company_id, contactId: m.contact_id, isTest: m.is_test, metadata: { meeting_id: m.id, outcome: input.outcome ?? null } });
  if (m.lead_id && input.status === 'completed') {
    const stage = MEETING_OUTCOMES.find((o) => o.value === input.outcome)?.stage;
    if (stage) await updateLead(m.lead_id, stage === 'lost' ? { stage, lost_reason: input.lost_reason?.trim() || input.notes?.slice(0, 500) || 'Not a fit after the call' } : { stage }, actor);
  }
  return { ok: true, value: after };
}

/** A recap or no-show rebooking email, drafted for approval. */
export async function draftMeetingEmail(meetingId: string, kind: 'recap' | 'no_show', actor: Actor): Promise<WriteResult<Message>> {
  const m = await getMeeting(meetingId);
  if (!m) return { ok: false, status: 404, error: 'Meeting not found' };
  if (kind === 'recap' && m.status !== 'completed') return { ok: false, status: 409, error: 'Record the call as held first' };
  if (kind === 'no_show' && m.status !== 'no_show') return { ok: false, status: 409, error: 'Mark the call as a no-show first' };
  if (!m.contact_id) return { ok: false, status: 422, error: 'The meeting has no contact to write to' };
  const { data: pending } = await growthDb().from('growth_messages').select('id').eq('meeting_id', m.id).eq('kind', kind).in('status', ['draft', 'approved', 'scheduled']).limit(1);
  if (pending?.length) return { ok: false, status: 409, error: 'A draft is already waiting for this meeting' };
  const engine = await getEngineSettings();
  const booking = (!engine.missing.includes('bookings_url') && engine.values.bookings_url) || `${SITE_HREF}/book`;
  const kb = await getApprovedKnowledge({ includeTest: m.is_test });
  const system = [
    kind === 'recap'
      ? 'Write a short recap email from Ahmad Din after a call: thank them, restate what was discussed and the agreed next step, using only the notes given. No prices, no guarantees, no client names.'
      : `Write a short, gracious email from Ahmad Din to someone who missed a booked call, offering to find another time with the placeholder [Booking link]. No pressure.`,
    'Approved messaging:',
    knowledgeText(kb.messaging),
    'Style: senior, calm, plain. 60 to 120 words. No em dashes. Sign off as Ahmad Din.',
    'Answer with one JSON object and nothing else: {"subject": string, "body": string}',
  ].join('\n');
  const context = `Attendee: ${m.attendee_name ?? ''}\nCall time: ${m.starts_at}\nNotes: ${m.notes ?? 'none'}\nOutcome: ${m.outcome ?? ''}\nBrief next action: ${m.brief?.next_action ?? ''}`;
  const ai = await runAi({ agent: RECAP_AGENT, purpose: kind === 'recap' ? 'meeting_recap' : 'no_show', system, messages: [{ role: 'user', content: context }], maxTokens: 1000, requireKnowledgeKinds: ['messaging', 'disallowed'], related: { leadId: m.lead_id, companyId: m.company_id }, isTest: m.is_test });
  if (!ai.ok) return { ok: false, status: ai.reason === 'provider_error' ? 502 : 409, code: ai.reason, error: ai.message };
  const parsed = (extractJsonObject(ai.text) ?? {}) as { subject?: unknown; body?: unknown };
  if (typeof parsed.body !== 'string' || !parsed.body.trim()) return { ok: false, status: 502, error: 'The draft could not be read. Try again.' };
  const company = m.company_id ? await getCompany(m.company_id) : null;
  const first = (m.attendee_name ?? '').split(/\s+/)[0] ?? '';
  const fill = (t: string) => fillKnown(stripEmails(t), { firstName: first, company: company?.name ?? '' }).split('[Booking link]').join(booking).replace(new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`, 'g'), ',');
  const { data, error } = await growthDb()
    .from('growth_messages')
    .insert({ is_test: m.is_test, lead_id: m.lead_id, company_id: m.company_id, contact_id: m.contact_id, meeting_id: m.id, channel: 'email', kind, sequence_step: 0, subject: fill(String(parsed.subject ?? (kind === 'recap' ? 'Thank you for your time' : 'Finding another time'))).slice(0, 200), body: fill(parsed.body).slice(0, 6000), is_mock_ai: ai.mock, ai_usage_id: ai.usageId, status: 'draft' })
    .select('*')
    .single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? 'The draft could not be saved' };
  await logActivity({ actorType: 'admin', actorId: actor.id, action: `meeting.${kind}_drafted`, summary: `${kind === 'recap' ? 'Recap' : 'No-show rebooking'} email drafted for approval`, leadId: m.lead_id, companyId: m.company_id, contactId: m.contact_id, isTest: m.is_test, metadata: { meeting_id: m.id, message_id: (data as Message).id } });
  return { ok: true, value: data as Message };
}
