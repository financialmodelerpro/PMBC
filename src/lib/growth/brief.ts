/**
 * The Daily Brief (Unit 7.1, 2026-09-23). Server only, read only.
 *
 * What needs Ahmad today, each item with a recommended next action and the
 * reason for it: leads needing attention (Hot and untouched, overdue next
 * actions and tasks), drafts to approve, replies waiting, meetings today,
 * stale deals, escalated chats, new signals and partner check-ins due.
 *
 * Built by rules from the CRM, not by AI: it costs nothing, is the same every
 * time it is read, and every reason can be traced to a record. Real rows
 * only; a table a later migration adds is simply skipped until it exists.
 */

import { growthDb } from './db';
import { riyadhDate } from './format';
import { riyadhDayBounds } from './outreachModel';

export type BriefItem = {
  kind: 'hot_lead' | 'overdue' | 'task' | 'draft' | 'reply' | 'meeting' | 'stale' | 'escalation' | 'signals' | 'checkin' | 'brief_missing';
  priority: number;
  title: string;
  action: string;
  reason: string;
  href: string;
};

const STALE_DAYS = 14;
const QUIET_DAYS = 3;

async function rows<T>(run: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await run();
    return error ? [] : ((data ?? []) as T[]);
  } catch {
    return [];
  }
}

export async function dailyBrief(now: Date = new Date()): Promise<{ date: string; items: BriefItem[]; counts: Record<string, number> }> {
  const db = growthDb();
  const today = riyadhDate(now);
  const day = riyadhDayBounds(now);
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const items: BriefItem[] = [];

  type L = { id: string; title: string; stage: string; lead_temperature: string | null; lead_score: number | null; next_action: string | null; next_action_due: string | null; stage_changed_at: string; updated_at: string; company_id: string | null };
  const [hot, overdue, tasks, drafts, replied, meetings, stale, escalated, signals, checkins] = await Promise.all([
    rows<L>(() => db.from('growth_leads').select('*').eq('is_test', false).eq('lead_temperature', 'hot').not('stage', 'in', '(meeting_booked,opportunity,proposal,won,lost)').limit(50)),
    rows<L>(() => db.from('growth_leads').select('*').eq('is_test', false).lte('next_action_due', today).not('stage', 'in', '(won,lost)').limit(50)),
    rows<{ id: string; title: string; due_date: string; lead_id: string | null }>(() => db.from('growth_tasks').select('id, title, due_date, lead_id').eq('is_test', false).is('done_at', null).lte('due_date', today).order('due_date').limit(50)),
    rows<{ id: string; lead_id: string | null; channel: string; kind: string }>(() => db.from('growth_messages').select('id, lead_id, channel, kind').eq('is_test', false).eq('status', 'draft').limit(200)),
    rows<L>(() => db.from('growth_leads').select('*').eq('is_test', false).eq('stage', 'replied').limit(50)),
    rows<{ id: string; starts_at: string; attendee_name: string | null; brief: unknown }>(() => db.from('growth_meetings').select('id, starts_at, attendee_name, brief').eq('is_test', false).in('status', ['scheduled', 'rescheduled']).gte('starts_at', day.start.toISOString()).lt('starts_at', new Date(day.end.getTime() + 86_400_000).toISOString()).order('starts_at')),
    rows<L>(() => db.from('growth_leads').select('*').eq('is_test', false).in('stage', ['opportunity', 'proposal']).lt('updated_at', ago(STALE_DAYS)).limit(50)),
    rows<{ id: string; escalation_reason: string | null; visitor_name: string | null; created_at: string }>(() => db.from('growth_conversations').select('id, escalation_reason, visitor_name, created_at').eq('is_test', false).eq('status', 'escalated').limit(50)),
    rows<{ id: string }>(() => db.from('growth_signals').select('id').eq('is_test', false).eq('status', 'new').limit(500)),
    rows<{ id: string; name: string; next_checkin_due: string }>(() => db.from('growth_partners').select('id, name, next_checkin_due').eq('is_test', false).eq('status', 'active').lte('next_checkin_due', today).limit(50)),
  ]);

  const lastActivity = async (leadId: string): Promise<string | null> => {
    const r = await rows<{ created_at: string }>(() => db.from('growth_activity').select('created_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1));
    return r[0]?.created_at ?? null;
  };

  for (const l of hot) {
    const last = await lastActivity(l.id);
    if (last && last > ago(QUIET_DAYS)) continue;
    items.push({ kind: 'hot_lead', priority: 1, title: l.title, action: 'Call or write today and offer a meeting', reason: `Hot (Lead Score ${l.lead_score ?? ''}) with nothing recorded for ${last ? `${Math.floor((now.getTime() - Date.parse(last)) / 86_400_000)} days` : 'a while'}`, href: `/admin/growth/pipeline/${l.id}` });
  }
  for (const m of meetings) {
    const isToday = m.starts_at < day.end.toISOString();
    items.push({
      kind: m.brief ? 'meeting' : 'brief_missing',
      priority: isToday ? 1 : 3,
      title: `${isToday ? 'Today' : 'Tomorrow'}: call with ${m.attendee_name ?? 'a prospect'}`,
      action: m.brief ? 'Read the brief before the call' : 'Prepare the brief',
      reason: `Booked for ${new Date(m.starts_at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' })} Riyadh time${m.brief ? '' : '; no brief yet'}`,
      href: `/admin/growth/meetings/${m.id}`,
    });
  }
  for (const l of replied) {
    items.push({ kind: 'reply', priority: 2, title: l.title, action: 'Answer the reply and propose a call', reason: `Replied ${Math.floor((now.getTime() - Date.parse(l.stage_changed_at)) / 86_400_000)} days ago and not yet qualified`, href: `/admin/growth/pipeline/${l.id}` });
  }
  for (const c of escalated) {
    items.push({ kind: 'escalation', priority: 2, title: `Website chat: ${c.visitor_name ?? 'a visitor'}`, action: 'Reply personally', reason: c.escalation_reason ?? 'Escalated to you', href: `/admin/growth/conversations/${c.id}` });
  }
  const draftLeads = new Set(drafts.map((d) => d.lead_id));
  if (drafts.length) items.push({ kind: 'draft', priority: 2, title: `${drafts.length} draft${drafts.length === 1 ? '' : 's'} to approve`, action: 'Approve, edit or reject them', reason: `Nothing is sent without your approval; ${draftLeads.size} lead${draftLeads.size === 1 ? ' is' : 's are'} waiting`, href: '/admin/growth/outreach' });
  for (const l of overdue) {
    items.push({ kind: 'overdue', priority: 2, title: l.title, action: l.next_action ?? 'Take the next step', reason: `Next action was due ${l.next_action_due}`, href: `/admin/growth/pipeline/${l.id}` });
  }
  for (const t of tasks) {
    items.push({ kind: 'task', priority: 3, title: t.title, action: 'Do it or move the date', reason: `Task due ${t.due_date}`, href: t.lead_id ? `/admin/growth/pipeline/${t.lead_id}` : '/admin/growth/pipeline' });
  }
  for (const l of stale) {
    items.push({ kind: 'stale', priority: 3, title: l.title, action: l.stage === 'proposal' ? 'Follow up on the proposal' : 'Agree the next step or close it', reason: `At ${l.stage} with no change for ${Math.floor((now.getTime() - Date.parse(l.updated_at)) / 86_400_000)} days`, href: `/admin/growth/pipeline/${l.id}` });
  }
  if (signals.length) items.push({ kind: 'signals', priority: 4, title: `${signals.length} new signal${signals.length === 1 ? '' : 's'}`, action: 'Convert, attach or dismiss them', reason: 'Fresh triggers lose value quickly', href: '/admin/growth/signals' });
  for (const p of checkins) items.push({ kind: 'checkin', priority: 4, title: `Check in with ${p.name}`, action: 'Call or message, then log it', reason: `Check-in due ${p.next_checkin_due}`, href: `/admin/growth/partners/${p.id}` });

  items.sort((a, b) => a.priority - b.priority);
  const counts = items.reduce<Record<string, number>>((acc, i) => ((acc[i.kind] = (acc[i.kind] ?? 0) + 1), acc), {});
  return { date: today, items, counts };
}
