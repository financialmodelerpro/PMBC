/**
 * Outreach Studio and sending (Units 3.1 to 3.3, 2026-09-23). Server only.
 *
 * Drafting: the outreach-writer agent drafts an email or LinkedIn message
 * for a lead. Every draft cites a real trigger (the company's latest live
 * signal with a real evidence link, or it is refused) and links to a relevant
 * site page. Nothing sends without Ahmad's approval, and approval is refused
 * while a draft still holds a placeholder such as [First name].
 *
 * Sending (email only; LinkedIn is copied by hand and marked sent): Settings
 * readable and sending not paused; the contact's address passes
 * checkSuppression; inside the sending window, or it is scheduled for the next
 * window; under the daily cold email cap, or it waits for the next day. Every
 * email carries a tracked link and an opt-out link. With Microsoft Graph
 * configured it goes from Ahmad's mailbox; without it the send is recorded as
 * mock, labelled, and nothing is delivered. A draft written by the mock AI can
 * never be sent for real (and the database refuses it too).
 *
 * Follow-ups: due by the Settings spacing after the first send, each drafted
 * for approval. A reply (found through Graph, or marked by hand) stops the
 * sequence, cancels anything waiting and moves the lead to Replied; a reply
 * asking to stop is treated as an opt-out.
 */

import { logActivity } from './activity';
import { runAi } from './ai/run';
import type { WriteResult } from './api';
import { growthDb, tableExists } from './db';
import { getEngineSettings, pendingMigration } from './engineSettings';
import { graphMailConfigured, graphRepliesInConversation, graphSendMail } from './graph';
import { extractJsonObject, knowledgeText, stripEmails } from './agents/json';
import { getApprovedKnowledge, type Actor } from './kb';
import { createLinks, stopForContact } from './links';
import { GROWTH_SERVICES, isGrowthService, type GrowthContact, type GrowthLead, type GrowthSignal } from './model';
import {
  COLD_KINDS,
  LINK_PLACEHOLDER,
  OPT_OUT_REPLY,
  buildEmail,
  followUpDue,
  optOutUrl,
  riyadhDayBounds,
  sendDecision,
  trackedUrl,
  unresolvedPlaceholders,
  type MessageAction,
  type MessageChannel,
  type MessageKind,
  type MessageStatus,
} from './outreachModel';
import { getCompany, getLead, updateLead } from './prospects';
import type { ProspectCompany } from './prospectsModel';
import { getGrowthSettings } from './settings';
import { isRealEvidenceUrl } from './signalsModel';
import { addSuppression, checkSuppression } from './suppression';

export const OUTREACH_AGENT = 'outreach-writer';

/** Em and en dashes, built from code points so this file holds neither: the house style removes them from drafts. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]`, 'g');

export type Message = {
  id: string;
  created_at: string;
  updated_at: string;
  is_test: boolean;
  lead_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  signal_id: string | null;
  meeting_id?: string | null;
  channel: MessageChannel;
  kind: MessageKind;
  sequence_step: number;
  subject: string | null;
  body: string;
  link_path: string | null;
  is_mock_ai: boolean;
  ai_usage_id: string | null;
  edited: boolean;
  status: MessageStatus;
  approved_at: string | null;
  approved_by_name: string | null;
  rejected_reason: string | null;
  cancelled_reason: string | null;
  scheduled_for: string | null;
  sent_at: string | null;
  send_mode: 'graph' | 'mock' | 'manual' | 'brevo' | null;
  provider_message_id: string | null;
  provider_conversation_id: string | null;
  error: string | null;
  replied_at: string | null;
};

type SeqLead = GrowthLead & { sequence_status?: string; sequence_started_at?: string | null; next_follow_up_at?: string | null; last_reply_at?: string | null; meeting_requested?: boolean };

const NOT_READY = 'Outreach needs 089_growth_outreach.sql applied first. Nothing was drafted or sent.';

export async function outreachReady(): Promise<boolean> {
  return tableExists('growth_messages');
}

export async function getMessage(id: string): Promise<Message | null> {
  const { data } = await growthDb().from('growth_messages').select('*').eq('id', id).maybeSingle();
  return (data as Message | null) ?? null;
}

/** The company's latest live signal with a real evidence link: the trigger a draft must cite. */
export async function citableSignal(companyId: string | null, leadId: string | null): Promise<GrowthSignal | null> {
  if (!companyId && !leadId) return null;
  let q = growthDb().from('growth_signals').select('*').neq('status', 'dismissed').order('signal_date', { ascending: false }).limit(20);
  q = companyId ? q.eq('company_id', companyId) : q.eq('lead_id', leadId as string);
  const { data } = await q;
  return ((data ?? []) as GrowthSignal[]).find((s) => isRealEvidenceUrl(s.evidence_url)) ?? null;
}

/** The page a message links to: the lead's service, else the company's likely service, else the services page. */
export function relevantPath(lead: Pick<GrowthLead, 'recommended_service'>, company: Pick<ProspectCompany, 'likely_service'> | null): string {
  const slug = [lead.recommended_service, company?.likely_service].find((s) => s && isGrowthService(s));
  return slug ? `/services/${slug}` : '/services';
}

export type Candidate = { lead: SeqLead; company: ProspectCompany | null; contact: GrowthContact | null; signal: GrowthSignal | null; suppressed: boolean; blockers: string[]; score: number; freshness: string | null };

/**
 * Leads ready for a first message, sorted by Prospect Score then how fresh the
 * trigger is. Each lists what blocks it (no contact, no email, suppressed, no
 * citable trigger), so Ahmad sees why a lead cannot be drafted.
 */
export async function outreachCandidates(opts: { includeTest?: boolean; limit?: number } = {}): Promise<Candidate[]> {
  let q = growthDb().from('growth_leads').select('*').in('stage', ['prospect', 'contacted']).order('prospect_score', { ascending: false, nullsFirst: false }).limit(opts.limit ?? 60);
  if (!opts.includeTest) q = q.eq('is_test', false);
  const { data } = await q;
  const leads = ((data ?? []) as SeqLead[]).filter((l) => !l.sequence_status || l.sequence_status === 'none');
  if (!leads.length) return [];
  const { data: pending } = await growthDb().from('growth_messages').select('lead_id').in('lead_id', leads.map((l) => l.id)).in('status', ['draft', 'approved', 'scheduled']);
  const busy = new Set(((pending ?? []) as { lead_id: string }[]).map((p) => p.lead_id));
  const out: Candidate[] = [];
  for (const lead of leads.filter((l) => !busy.has(l.id))) {
    const [company, contactRow, signal] = await Promise.all([
      lead.company_id ? getCompany(lead.company_id) : Promise.resolve(null),
      lead.contact_id ? growthDb().from('growth_contacts').select('*').eq('id', lead.contact_id).maybeSingle() : Promise.resolve({ data: null }),
      citableSignal(lead.company_id, lead.id),
    ]);
    const contact = (contactRow.data as GrowthContact | null) ?? null;
    const blockers: string[] = [];
    let suppressed = false;
    if (!contact) blockers.push('no contact on the lead');
    else if (!contact.email) blockers.push('no email (LinkedIn only)');
    if (contact?.email) suppressed = (await checkSuppression(contact.email)).suppressed;
    if (contact && ['opted_out', 'do_not_contact'].includes(contact.consent_status)) suppressed = true;
    if (suppressed) blockers.push('suppressed: never contactable');
    if (!signal) blockers.push('no trigger with a real evidence link');
    out.push({ lead, company, contact, signal, suppressed, blockers, score: company?.prospect_score ?? lead.prospect_score ?? 0, freshness: signal?.signal_date ?? null });
  }
  return out.sort((a, b) => b.score - a.score || (b.freshness ?? '').localeCompare(a.freshness ?? ''));
}

function firstName(full: string | null | undefined): string {
  const parts = (full ?? '').trim().split(/\s+/).filter((p) => !/^(mr|mrs|ms|dr|eng|sheikh|prof)\.?$/i.test(p));
  return parts[0] ?? '';
}

/** Fills the placeholders the draft can know; the rest stay for Ahmad to fill before approval. */
export function fillKnown(text: string, v: { firstName: string; company: string }): string {
  let t = text;
  if (v.firstName) t = t.replace(/\[(First name|Name|first name)\]/g, v.firstName);
  if (v.company) t = t.replace(/\[(Company|Company name)\]/g, v.company);
  return t.replace(/\[Sender\]/g, 'Ahmad Din');
}

type DraftContext = { lead: SeqLead; company: ProspectCompany | null; contact: GrowthContact; signal: GrowthSignal; linkPath: string };

async function draftContext(leadId: string, channel: MessageChannel): Promise<WriteResult<DraftContext>> {
  const lead = (await getLead(leadId)) as SeqLead | null;
  if (!lead) return { ok: false, status: 404, error: 'Lead not found' };
  const company = lead.company_id ? await getCompany(lead.company_id) : null;
  if (!lead.contact_id) return { ok: false, status: 422, error: 'Add a contact to the lead first' };
  const { data: c } = await growthDb().from('growth_contacts').select('*').eq('id', lead.contact_id).maybeSingle();
  const contact = c as GrowthContact | null;
  if (!contact) return { ok: false, status: 422, error: 'The lead contact no longer exists' };
  if (['opted_out', 'do_not_contact'].includes(contact.consent_status)) return { ok: false, status: 409, code: 'suppressed', error: `${contact.full_name} has opted out or is marked do not contact` };
  if (channel === 'email') {
    if (!contact.email) return { ok: false, status: 422, error: 'The contact has no email address. Use LinkedIn, or add the email.' };
    const s = await checkSuppression(contact.email);
    if (s.suppressed) return { ok: false, status: 409, code: 'suppressed', error: `${contact.email} is suppressed: ${s.reasons.map((r) => r.reason).join('; ')}` };
  }
  const signal = await citableSignal(lead.company_id, lead.id);
  if (!signal) return { ok: false, status: 422, code: 'no_trigger', error: 'No trigger with a real evidence link for this company. Add or attach a signal first: every draft must cite one.' };
  return { ok: true, value: { lead, company, contact, signal, linkPath: relevantPath(lead, company) } };
}

async function writeDraft(ctx: DraftContext, opts: { channel: MessageChannel; kind: MessageKind; step: number; previous?: Message | null; actor: Actor | null; isTest: boolean }): Promise<WriteResult<Message>> {
  const kb = await getApprovedKnowledge({ includeTest: opts.isTest });
  const service = GROWTH_SERVICES.find((s) => `/services/${s.value}` === ctx.linkPath);
  const serviceKb = kb.service.filter((s) => !service || s.key === service.value);
  const system = [
    'You write short, specific first-contact messages for Ahmad Din, partner at PaceMakers Business Consultants, a corporate finance and transaction advisory firm serving KSA and the GCC.',
    'Tone: senior, considered and calm. Plain words. No hype, no flattery, no exclamation marks, no emojis, no em dashes.',
    'The message must refer to the trigger below by what the source says, and must not add facts that are not in it.',
    `Include the placeholder ${LINK_PLACEHOLDER} exactly once where a link to the relevant page belongs; it becomes a tracked link.`,
    'Never give prices, fees, guarantees or client names. Never claim results. Sign off as Ahmad Din.',
    opts.channel === 'linkedin' ? 'This is a LinkedIn message: at most 600 characters, no subject.' : 'This is an email: a subject line under 70 characters and a body of 70 to 140 words.',
    opts.kind === 'follow_up' ? 'This is a polite follow-up to the earlier message below: shorter, adds one useful point, no pressure.' : '',
    '',
    'Approved messaging:',
    knowledgeText(kb.messaging),
    '',
    'Never say:',
    kb.disallowed.map((d) => `- ${d.title}: ${String(d.content.detail ?? '')}`).join('\n'),
    '',
    'Relevant service:',
    knowledgeText(serviceKb.slice(0, 2)) || service?.label || 'Corporate finance advisory',
    '',
    'Answer with one JSON object and nothing else: {"subject": string, "body": string}',
  ]
    .filter((l) => l !== '')
    .join('\n');
  const user = [
    `Recipient: ${ctx.contact.full_name}${ctx.contact.role_title ? `, ${ctx.contact.role_title}` : ''}`,
    `Company: ${ctx.company?.name ?? 'unknown'}${ctx.company?.city ? `, ${ctx.company.city}` : ''}`,
    `Trigger (${ctx.signal.signal_date}): ${ctx.signal.summary}`,
    `Source: ${ctx.signal.evidence_url}`,
    `Link goes to: ${ctx.linkPath}`,
    opts.previous ? `Earlier message:\nSubject: ${opts.previous.subject ?? ''}\n${opts.previous.body}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const purpose = opts.kind === 'follow_up' ? 'outreach_follow_up' : opts.channel === 'linkedin' ? 'outreach_linkedin' : 'outreach_email';
  const ai = await runAi({ agent: OUTREACH_AGENT, purpose, system, messages: [{ role: 'user', content: user }], maxTokens: 1500, requireKnowledgeKinds: ['messaging', 'disallowed'], related: { companyId: ctx.lead.company_id, leadId: ctx.lead.id }, isTest: opts.isTest });
  if (!ai.ok) return { ok: false, status: ai.reason === 'provider_error' ? 502 : 409, code: ai.reason, error: ai.message };
  const parsed = extractJsonObject(ai.text) as { subject?: unknown; body?: unknown } | null;
  if (!parsed || typeof parsed.body !== 'string' || !parsed.body.trim()) return { ok: false, status: 502, code: 'unreadable', error: 'The draft could not be read. Try again.' };
  const fill = { firstName: firstName(ctx.contact.full_name), company: ctx.company?.name ?? '' };
  let body = fillKnown(stripEmails(parsed.body.trim()), fill).replace(DASHES, ',');
  if (!body.includes(LINK_PLACEHOLDER)) body = `${body}\n\n${LINK_PLACEHOLDER}`;
  const subject = opts.channel === 'email' ? fillKnown(stripEmails(String(parsed.subject ?? '').trim()), fill).replace(DASHES, ',').slice(0, 200) : null;
  const { data, error } = await growthDb()
    .from('growth_messages')
    .insert({
      is_test: opts.isTest,
      lead_id: ctx.lead.id,
      company_id: ctx.lead.company_id,
      contact_id: ctx.contact.id,
      signal_id: ctx.signal.id,
      channel: opts.channel,
      kind: opts.kind,
      sequence_step: opts.step,
      subject,
      body: body.slice(0, 6000),
      link_path: ctx.linkPath,
      is_mock_ai: ai.mock,
      ai_usage_id: ai.usageId,
      status: 'draft',
    })
    .select('*')
    .single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? 'The draft could not be saved' };
  return { ok: true, value: data as Message };
}

export async function draftOutreach(leadId: string, channel: MessageChannel, actor: Actor | null, opts: { isTest?: boolean } = {}): Promise<WriteResult<Message>> {
  if (!(await outreachReady())) return { ok: false, status: 503, error: NOT_READY };
  const ctx = await draftContext(leadId, channel);
  if (!ctx.ok) return ctx;
  const { data: pending } = await growthDb().from('growth_messages').select('id').eq('lead_id', leadId).in('status', ['draft', 'approved', 'scheduled']).limit(1);
  if (pending?.length) return { ok: false, status: 409, error: 'This lead already has a message waiting. Approve, send or reject it first.' };
  return writeDraft(ctx.value, { channel, kind: 'initial', step: 0, actor, isTest: Boolean(opts.isTest || ctx.value.lead.is_test) });
}

/** Edits a draft or an approved message. Editing an approved message returns it to draft for approval again. */
export async function editMessage(id: string, input: { subject?: string | null; body: string }, actor: Actor): Promise<WriteResult<Message>> {
  const m = await getMessage(id);
  if (!m) return { ok: false, status: 404, error: 'Message not found' };
  if (!['draft', 'approved', 'scheduled'].includes(m.status)) return { ok: false, status: 409, error: `A ${m.status} message cannot be edited` };
  const patch = { subject: m.channel === 'email' ? input.subject ?? m.subject : null, body: input.body.replace(DASHES, ','), edited: true, status: 'draft', approved_at: null, approved_by_name: null, scheduled_for: null };
  const { data, error } = await growthDb().from('growth_messages').update(patch).eq('id', id).select('*').single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? 'Save failed' };
  await logActivity({ actorType: 'admin', actorId: actor.id, action: 'outreach.edited', summary: `${m.channel === 'email' ? 'Email' : 'LinkedIn message'} edited${m.status !== 'draft' ? '; it needs approving again' : ''}`, companyId: m.company_id, contactId: m.contact_id, leadId: m.lead_id, isTest: m.is_test, metadata: { message_id: id } });
  return { ok: true, value: data as Message };
}

async function contactOf(m: Message): Promise<GrowthContact | null> {
  if (!m.contact_id) return null;
  const { data } = await growthDb().from('growth_contacts').select('*').eq('id', m.contact_id).maybeSingle();
  return (data as GrowthContact | null) ?? null;
}

async function setStatus(id: string, patch: Record<string, unknown>): Promise<WriteResult<Message>> {
  const { data, error } = await growthDb().from('growth_messages').update(patch).eq('id', id).select('*').single();
  if (error || !data) return { ok: false, status: error?.code === '23514' ? 422 : 500, error: error?.code === '23514' ? 'The database refused that change' : error?.message ?? 'Save failed' };
  return { ok: true, value: data as Message };
}

export async function actOnMessage(id: string, a: MessageAction, actor: Actor): Promise<WriteResult<Message>> {
  const m = await getMessage(id);
  if (!m) return { ok: false, status: 404, error: 'Message not found' };
  if (a.action === 'approve') {
    if (m.status !== 'draft') return { ok: false, status: 409, error: `Only a draft can be approved (this one is ${m.status})` };
    const left = unresolvedPlaceholders(`${m.subject ?? ''}\n${m.body}`);
    if (left.length) return { ok: false, status: 422, code: 'placeholders', error: `Fill these in first: ${left.join(', ')}` };
    if (m.channel === 'email' && !m.subject?.trim()) return { ok: false, status: 422, error: 'The email needs a subject' };
    const contact = await contactOf(m);
    if (m.channel === 'email' && contact?.email && (await checkSuppression(contact.email)).suppressed) return { ok: false, status: 409, code: 'suppressed', error: `${contact.email} is suppressed: it can never be sent` };
    return setStatus(id, { status: 'approved', approved_at: new Date().toISOString(), approved_by_name: actor.name });
  }
  if (a.action === 'reject') {
    if (!['draft', 'approved', 'scheduled'].includes(m.status)) return { ok: false, status: 409, error: `A ${m.status} message cannot be rejected` };
    return setStatus(id, { status: 'rejected', rejected_reason: a.reason, scheduled_for: null });
  }
  if (a.action === 'cancel') {
    if (!['draft', 'approved', 'scheduled'].includes(m.status)) return { ok: false, status: 409, error: `A ${m.status} message cannot be cancelled` };
    return setStatus(id, { status: 'cancelled', cancelled_reason: a.reason, scheduled_for: null });
  }
  if (a.action === 'send') {
    if (m.channel !== 'email') return { ok: false, status: 422, error: 'LinkedIn messages are sent by hand: copy it, send it on LinkedIn, then mark it sent' };
    return sendMessage(id, { actor });
  }
  if (a.action === 'mark_sent') {
    if (m.channel !== 'linkedin') return { ok: false, status: 422, error: 'Only a LinkedIn message is marked sent by hand' };
    if (m.status !== 'approved') return { ok: false, status: 409, error: 'Approve the message before marking it sent' };
    const r = await setStatus(id, { status: 'sent', sent_at: new Date().toISOString(), send_mode: 'manual' });
    if (r.ok) await afterSend(r.value, 'manual', actor);
    return r;
  }
  if (m.status !== 'sent') return { ok: false, status: 409, error: 'Only a sent message can have a reply' };
  await recordReply(m, { preview: a.note ?? null, at: new Date().toISOString(), from: null, by: actor });
  return { ok: true, value: (await getMessage(id)) ?? m };
}

/** Sends one approved (or scheduled) email now, or schedules it, by the rules in the file header. */
export async function sendMessage(id: string, opts: { actor?: Actor | null; now?: Date } = {}): Promise<WriteResult<Message>> {
  const now = opts.now ?? new Date();
  const m = await getMessage(id);
  if (!m) return { ok: false, status: 404, error: 'Message not found' };
  if (m.channel !== 'email') return { ok: false, status: 422, error: 'Only email is sent by the system' };
  if (!['approved', 'scheduled'].includes(m.status) || !m.approved_at) return { ok: false, status: 409, error: 'Only an approved email can be sent' };
  const [settings, engine] = await Promise.all([getGrowthSettings(), getEngineSettings()]);
  if (settings.source !== 'database') return { ok: false, status: 503, error: 'Growth Settings cannot be read, so nothing is sent' };
  const pending = pendingMigration(engine, ['outreach_sending_paused']);
  if (pending) return { ok: false, status: 503, error: `Sending needs ${pending} applied first` };
  const contact = await contactOf(m);
  if (!contact?.email) return setStatus(id, { status: 'failed', error: 'The contact has no email address' });
  const sup = await checkSuppression(contact.email);
  if (sup.suppressed) return setStatus(id, { status: 'cancelled', cancelled_reason: `Suppressed: ${sup.reasons.map((r) => r.reason).join('; ')}`, scheduled_for: null });

  const counts = COLD_KINDS.includes(m.kind);
  const day = riyadhDayBounds(now);
  const { count } = await growthDb()
    .from('growth_messages')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'sent')
    .eq('channel', 'email')
    .eq('is_test', m.is_test)
    .in('kind', COLD_KINDS as string[])
    .gte('sent_at', day.start.toISOString())
    .lt('sent_at', day.end.toISOString());
  const decision = sendDecision(settings.settings, count ?? 0, now, { paused: engine.values.outreach_sending_paused, counts });
  if (decision.action === 'refuse') return { ok: false, status: 409, code: 'paused', error: decision.why };
  if (decision.action === 'schedule') {
    const r = await setStatus(id, { status: 'scheduled', scheduled_for: decision.at.toISOString() });
    return r.ok ? { ok: true, value: r.value } : r;
  }

  const real = graphMailConfigured();
  if (real && m.is_mock_ai) return { ok: false, status: 409, code: 'mock_draft', error: 'This draft was written by the mock AI and can never be sent for real. Draft it again now that the Anthropic key is set.' };
  const links = await createLinks({ leadId: m.lead_id, contactId: m.contact_id, messageId: m.id, targetPath: m.link_path, isTest: m.is_test });
  if ('error' in links) return setStatus(id, { status: 'failed', error: `Links not created: ${links.error}` });
  const email = buildEmail({ body: m.body, linkUrl: links.link ? trackedUrl(links.link.token) : null, optOutUrl: optOutUrl(links.optOut.token) });
  const sentAt = new Date().toISOString();
  if (!real) {
    const r = await setStatus(id, { status: 'sent', sent_at: sentAt, send_mode: 'mock', scheduled_for: null });
    if (r.ok) await afterSend(r.value, 'mock', opts.actor ?? null);
    return r;
  }
  const res = await graphSendMail({ to: contact.email, toName: contact.full_name, subject: m.subject ?? '', html: email.html });
  if (!res.ok) return setStatus(id, { status: 'failed', error: res.error, scheduled_for: null });
  const r = await setStatus(id, { status: 'sent', sent_at: sentAt, send_mode: 'graph', provider_message_id: res.messageId, provider_conversation_id: res.conversationId, scheduled_for: null });
  if (r.ok) await afterSend(r.value, 'graph', opts.actor ?? null);
  return r;
}

/**
 * After a send: the sequence moves on. A real or hand send also marks the lead
 * Contacted and dates the contact. A mock send advances only the sequence, so
 * follow-ups can be tried out, and changes nothing that claims contact was made.
 */
async function afterSend(m: Message, mode: 'graph' | 'mock' | 'manual', actor: Actor | null): Promise<void> {
  if (!m.lead_id) return;
  const lead = (await getLead(m.lead_id)) as SeqLead | null;
  if (!lead) return;
  const settings = await getGrowthSettings();
  if (mode !== 'mock') {
    if (lead.stage === 'prospect') await updateLead(lead.id, { stage: 'contacted' }, actor, { system: !actor });
    if (m.contact_id) await growthDb().from('growth_contacts').update({ last_contacted_at: m.sent_at }).eq('id', m.contact_id);
  }
  if (!COLD_KINDS.includes(m.kind)) return;
  const started = m.kind === 'initial' ? m.sent_at! : lead.sequence_started_at ?? m.sent_at!;
  const next = followUpDue(started, m.sequence_step + 1, settings.settings);
  await growthDb()
    .from('growth_leads')
    .update({ sequence_status: next ? 'active' : 'completed', sequence_started_at: started, next_follow_up_at: next?.toISOString() ?? null })
    .eq('id', lead.id);
}

/** Records a reply: stops the sequence, cancels what is waiting, moves the lead on, and honours a request to stop. */
export async function recordReply(m: Message, r: { preview: string | null; at: string; from: string | null; by: Actor | null }): Promise<void> {
  await growthDb().from('growth_messages').update({ replied_at: r.at }).eq('id', m.id).is('replied_at', null);
  if (m.lead_id) {
    await growthDb().from('growth_messages').update({ status: 'cancelled', cancelled_reason: 'The contact replied' }).eq('lead_id', m.lead_id).in('status', ['draft', 'approved', 'scheduled']).eq('kind', 'follow_up');
    await growthDb().from('growth_leads').update({ sequence_status: 'stopped', sequence_stopped_reason: 'replied', next_follow_up_at: null, last_reply_at: r.at }).eq('id', m.lead_id);
    const lead = await getLead(m.lead_id);
    if (lead && ['prospect', 'contacted'].includes(lead.stage)) await updateLead(lead.id, { stage: 'replied' }, r.by, { system: !r.by });
  }
  await logActivity({ actorType: r.by ? 'admin' : 'system', actorId: r.by?.id ?? 'reply-check', action: 'outreach.reply', summary: `Reply received${r.preview ? `: "${r.preview.slice(0, 160)}"` : ''}${r.by ? ' (marked by hand)' : ''}`, companyId: m.company_id, contactId: m.contact_id, leadId: m.lead_id, isTest: m.is_test, metadata: { message_id: m.id, from: r.from } });
  if (r.preview && OPT_OUT_REPLY.test(r.preview) && m.contact_id) {
    const contact = await contactOf(m);
    if (contact?.email) await addSuppression({ kind: 'email', value: contact.email, reason: 'Asked to stop in a reply', source: 'growth_contact', sourceRef: contact.id }, null, { isTest: m.is_test });
    await growthDb().from('growth_contacts').update({ consent_status: 'opted_out', consent_source: 'Asked to stop in a reply', consent_at: new Date().toISOString() }).eq('id', m.contact_id);
    await stopForContact(m.contact_id, 'asked to stop in a reply');
    await logActivity({ actorType: 'system', actorId: 'reply-check', action: 'outreach.opt_out', summary: 'The reply asked to stop: suppressed for good', companyId: m.company_id, contactId: m.contact_id, leadId: m.lead_id, isTest: m.is_test });
  }
  if (m.lead_id) {
    const { rescoreLead } = await import('./leadScore');
    await rescoreLead(m.lead_id);
  }
}

/** Looks for replies to sent Graph emails. In mock mode replies are marked by hand. */
export async function checkReplies(): Promise<string> {
  if (!(await outreachReady())) return NOT_READY;
  if (!graphMailConfigured()) return 'Mock mode: Microsoft Graph is not configured, so replies are marked by hand.';
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const { data } = await growthDb().from('growth_messages').select('*').eq('status', 'sent').eq('send_mode', 'graph').is('replied_at', null).not('provider_conversation_id', 'is', null).gte('sent_at', since).limit(200);
  let found = 0;
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const m of (data ?? []) as Message[]) {
    if (!m.provider_conversation_id || seen.has(m.provider_conversation_id)) continue;
    seen.add(m.provider_conversation_id);
    const res = await graphRepliesInConversation(m.provider_conversation_id, m.sent_at!);
    if (!res.ok) {
      errors.push(res.error);
      continue;
    }
    if (res.replies.length) {
      found++;
      const first = res.replies.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))[0];
      await recordReply(m, { preview: first.preview, at: first.receivedAt, from: first.from, by: null });
    }
  }
  return `Checked ${seen.size} conversations: ${found} replies found${errors.length ? `, ${errors.length} could not be read (${errors[0]})` : ''}.`;
}

/** Drafts every follow-up now due, for approval. Nothing is sent. */
export async function draftDueFollowUps(now: Date = new Date()): Promise<string> {
  if (!(await outreachReady())) return NOT_READY;
  const settings = await getGrowthSettings();
  if (settings.source !== 'database') return 'Growth Settings cannot be read, so no follow-ups are drafted.';
  const { data } = await growthDb().from('growth_leads').select('*').eq('sequence_status', 'active').lte('next_follow_up_at', now.toISOString()).limit(100);
  let drafted = 0;
  const problems: string[] = [];
  for (const lead of (data ?? []) as SeqLead[]) {
    const { data: msgs } = await growthDb().from('growth_messages').select('*').eq('lead_id', lead.id).in('kind', COLD_KINDS as string[]).order('sequence_step', { ascending: false });
    const list = (msgs ?? []) as Message[];
    if (list.some((x) => ['draft', 'approved', 'scheduled'].includes(x.status))) continue;
    const last = list.find((x) => x.status === 'sent');
    if (!last) continue;
    const step = last.sequence_step + 1;
    if (step > settings.settings.max_follow_ups) {
      await growthDb().from('growth_leads').update({ sequence_status: 'completed', next_follow_up_at: null }).eq('id', lead.id);
      continue;
    }
    const ctx = await draftContext(lead.id, last.channel);
    if (!ctx.ok) {
      if (ctx.code === 'suppressed') await growthDb().from('growth_leads').update({ sequence_status: 'stopped', sequence_stopped_reason: 'suppressed', next_follow_up_at: null }).eq('id', lead.id);
      problems.push(`${lead.title}: ${ctx.error}`);
      continue;
    }
    const r = await writeDraft(ctx.value, { channel: last.channel, kind: 'follow_up', step, previous: last, actor: null, isTest: lead.is_test });
    if (r.ok) drafted++;
    else problems.push(`${lead.title}: ${r.error}`);
  }
  return `${drafted} follow-ups drafted for approval${problems.length ? `; ${problems.length} could not be drafted (${problems[0]})` : ''}.`;
}

/** Sends every scheduled email whose time has come, within the window and the cap. */
export async function sendDue(now: Date = new Date()): Promise<string> {
  if (!(await outreachReady())) return NOT_READY;
  const { data } = await growthDb().from('growth_messages').select('id').eq('status', 'scheduled').eq('channel', 'email').lte('scheduled_for', now.toISOString()).order('scheduled_for').limit(200);
  let sent = 0;
  let waiting = 0;
  const errors: string[] = [];
  for (const { id } of (data ?? []) as { id: string }[]) {
    const r = await sendMessage(id, { now });
    if (!r.ok) errors.push(r.error);
    else if (r.value.status === 'sent') sent++;
    else waiting++;
  }
  return `${sent} scheduled emails sent, ${waiting} still waiting for the window or the cap${errors.length ? `, ${errors.length} refused (${errors[0]})` : ''}.`;
}

export type MessageRow = Message & { leadTitle: string | null; companyName: string | null; contactName: string | null; contactEmail: string | null; signalSummary: string | null; signalUrl: string | null };

export async function listMessages(statuses: MessageStatus[], opts: { includeTest?: boolean; limit?: number; leadId?: string } = {}): Promise<MessageRow[]> {
  let q = growthDb().from('growth_messages').select('*').in('status', statuses).order('created_at', { ascending: false }).limit(opts.limit ?? 100);
  if (!opts.includeTest) q = q.eq('is_test', false);
  if (opts.leadId) q = q.eq('lead_id', opts.leadId);
  const { data } = await q;
  const rows = (data ?? []) as Message[];
  const ids = (k: 'lead_id' | 'company_id' | 'contact_id' | 'signal_id') => [...new Set(rows.map((r) => r[k]).filter((x): x is string => Boolean(x)))];
  const [leads, companies, contacts, signals] = await Promise.all([
    ids('lead_id').length ? growthDb().from('growth_leads').select('id, title').in('id', ids('lead_id')) : Promise.resolve({ data: [] }),
    ids('company_id').length ? growthDb().from('growth_companies').select('id, name').in('id', ids('company_id')) : Promise.resolve({ data: [] }),
    ids('contact_id').length ? growthDb().from('growth_contacts').select('id, full_name, email').in('id', ids('contact_id')) : Promise.resolve({ data: [] }),
    ids('signal_id').length ? growthDb().from('growth_signals').select('id, summary, evidence_url').in('id', ids('signal_id')) : Promise.resolve({ data: [] }),
  ]);
  const map = <T extends { id: string }>(d: unknown) => new Map(((d ?? []) as T[]).map((x) => [x.id, x]));
  const L = map<{ id: string; title: string }>(leads.data);
  const C = map<{ id: string; name: string }>(companies.data);
  const P = map<{ id: string; full_name: string; email: string | null }>(contacts.data);
  const S = map<{ id: string; summary: string; evidence_url: string }>(signals.data);
  return rows.map((r) => ({
    ...r,
    leadTitle: (r.lead_id && L.get(r.lead_id)?.title) || null,
    companyName: (r.company_id && C.get(r.company_id)?.name) || null,
    contactName: (r.contact_id && P.get(r.contact_id)?.full_name) || null,
    contactEmail: (r.contact_id && P.get(r.contact_id)?.email) || null,
    signalSummary: (r.signal_id && S.get(r.signal_id)?.summary) || null,
    signalUrl: (r.signal_id && S.get(r.signal_id)?.evidence_url) || null,
  }));
}
