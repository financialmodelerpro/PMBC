/**
 * Growth Analytics (Unit 7.2, 2026-09-23). Server only, read only.
 *
 * For a period: prospects added, messages sent, reply rate, chats,
 * qualification rate, meetings, proposals and wins; the same funnel broken
 * down by source, sector, trigger, contact title, service, entry offer and
 * city; and AI cost with cost per qualified lead.
 *
 * Real rows only. Mock sends are not counted as sent (nothing was
 * delivered). A lead "reached" a stage if it is there now or its stage
 * history shows it passed through (lead.stage_changed activity).
 */

import { growthDb } from './db';
import { growthServiceLabel, TRIGGER_TYPES } from './model';
import { SECTOR_SHARES } from './scoring/prospect';

export const PERIODS = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
] as const;

export const DIMENSIONS = [
  { value: 'source', label: 'Source' },
  { value: 'sector', label: 'Sector' },
  { value: 'trigger', label: 'Trigger' },
  { value: 'title', label: 'Contact title' },
  { value: 'service', label: 'Service' },
  { value: 'offer', label: 'Entry offer' },
  { value: 'city', label: 'City' },
] as const;
export type Dimension = (typeof DIMENSIONS)[number]['value'];

const RANK: Record<string, number> = { prospect: 0, contacted: 1, replied: 2, qualified: 3, meeting_booked: 4, opportunity: 5, proposal: 6, won: 7 };

export type FunnelRow = { key: string; leads: number; contacted: number; replied: number; qualified: number; meetings: number; proposals: number; won: number };

export type Analytics = {
  since: string | null;
  totals: { prospectsAdded: number; leads: number; messagesSent: number; replies: number; replyRate: number | null; chats: number; qualifiedChats: number; qualificationRate: number | null; meetings: number; proposals: number; wins: number; aiCostUsd: number; aiCalls: number; qualifiedLeads: number; costPerQualifiedLead: number | null; mockSends: number };
  funnel: FunnelRow;
  breakdowns: Record<Dimension, FunnelRow[]>;
};

/** A job title in a few comparable groups. */
export function titleGroup(title: string | null | undefined): string {
  const t = (title ?? '').toLowerCase();
  if (!t) return 'Unknown';
  if (/\b(cfo|chief financial|finance director|head of finance|vp finance)\b/.test(t)) return 'Finance head';
  if (/\b(ceo|chief executive|managing director|md|president|founder|owner|chair)\b/.test(t)) return 'Chief executive or owner';
  if (/\b(investments?|strategy|development|m&a|corporate finance)\b/.test(t)) return 'Investment or strategy';
  if (/\b(director|head|vp|vice president|partner|general manager)\b/.test(t)) return 'Other senior';
  return 'Other';
}

export function sectorGroup(sector: string | null | undefined): string {
  if (!sector?.trim()) return 'Unknown';
  return SECTOR_SHARES.find((s) => s.pattern.test(sector))?.label ?? 'Other';
}

async function all<T>(run: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  try {
    const { data, error } = await run();
    return error ? [] : ((data ?? []) as T[]);
  } catch {
    return [];
  }
}

const inChunks = async <T>(ids: string[], fn: (chunk: string[]) => Promise<T[]>): Promise<T[]> => {
  const out: T[] = [];
  for (let k = 0; k < ids.length; k += 200) out.push(...(await fn(ids.slice(k, k + 200))));
  return out;
};

export async function analytics(period: string): Promise<Analytics> {
  const db = growthDb();
  const since = period === 'all' ? null : new Date(Date.now() - Number(period || 90) * 86_400_000).toISOString();
  const after = <Q extends { gte: (c: string, v: string) => Q }>(q: Q, col = 'created_at') => (since ? q.gte(col, since) : q);

  type Lead = { id: string; stage: string; source: string; recommended_service: string | null; company_id: string | null; contact_id: string | null; created_at: string };
  const [companies, leads, sent, convs, meetingsRows, usage] = await Promise.all([
    all<{ id: string }>(() => after(db.from('growth_companies').select('id').eq('is_test', false))),
    all<Lead>(() => after(db.from('growth_leads').select('id, stage, source, recommended_service, company_id, contact_id, created_at').eq('is_test', false).limit(20000))),
    all<{ id: string; send_mode: string; replied_at: string | null; kind: string; lead_id: string | null }>(() => after(db.from('growth_messages').select('id, send_mode, replied_at, kind, lead_id').eq('is_test', false).eq('status', 'sent').limit(20000), 'sent_at')),
    all<{ id: string; route: string; lead_id: string | null }>(() => after(db.from('growth_conversations').select('id, route, lead_id').eq('is_test', false).limit(20000))),
    all<{ id: string; lead_id: string | null; status: string }>(() => after(db.from('growth_meetings').select('id, lead_id, status').eq('is_test', false).neq('status', 'cancelled').limit(20000))),
    all<{ cost_usd: number | string }>(() => after(db.from('growth_ai_usage').select('cost_usd').eq('is_test', false).limit(50000))),
  ]);

  const leadIds = leads.map((l) => l.id);
  const history = await inChunks(leadIds, (chunk) => all<{ lead_id: string; metadata: { to?: string } }>(() => db.from('growth_activity').select('lead_id, metadata').eq('action', 'lead.stage_changed').in('lead_id', chunk)));
  const maxRank = new Map<string, number>();
  for (const l of leads) maxRank.set(l.id, RANK[l.stage] ?? -1);
  for (const h of history) {
    const r = RANK[h.metadata?.to ?? ''] ?? -1;
    if (r > (maxRank.get(h.lead_id) ?? -1)) maxRank.set(h.lead_id, r);
  }
  const realSent = sent.filter((m) => m.send_mode !== 'mock');
  const contactedLeads = new Set(realSent.map((m) => m.lead_id).filter(Boolean) as string[]);
  const meetingLeads = new Set(meetingsRows.map((m) => m.lead_id).filter(Boolean) as string[]);
  const reached = (id: string, stage: string) => (maxRank.get(id) ?? -1) >= RANK[stage];

  const companyIds = [...new Set(leads.map((l) => l.company_id).filter((x): x is string => Boolean(x)))];
  const contactIds = [...new Set(leads.map((l) => l.contact_id).filter((x): x is string => Boolean(x)))];
  const [cos, cts, sigs, briefs] = await Promise.all([
    inChunks(companyIds, (c) => all<{ id: string; sector: string | null; city: string | null }>(() => db.from('growth_companies').select('id, sector, city').in('id', c))),
    inChunks(contactIds, (c) => all<{ id: string; role_title: string | null }>(() => db.from('growth_contacts').select('id, role_title').in('id', c))),
    inChunks(companyIds, (c) => all<{ company_id: string; lead_id: string | null; trigger_type: string; signal_date: string }>(() => db.from('growth_signals').select('company_id, lead_id, trigger_type, signal_date').in('company_id', c).neq('status', 'dismissed'))),
    inChunks(companyIds, (c) => all<{ company_id: string; content: { entry_offer?: { value?: string | null } }; created_at: string; is_mock: boolean }>(() => db.from('growth_research_briefs').select('company_id, content, created_at, is_mock').in('company_id', c).eq('is_mock', false))),
  ]);
  const C = new Map(cos.map((c) => [c.id, c]));
  const P = new Map(cts.map((c) => [c.id, c]));
  const trig = new Map<string, string>();
  for (const s of [...sigs].sort((a, b) => a.signal_date.localeCompare(b.signal_date))) trig.set(s.lead_id ?? `c:${s.company_id}`, s.trigger_type);
  const offer = new Map<string, string>();
  for (const b of [...briefs].sort((a, b) => a.created_at.localeCompare(b.created_at))) if (b.content?.entry_offer?.value) offer.set(b.company_id, b.content.entry_offer.value);

  const keyFor = (l: Lead, d: Dimension): string => {
    const co = l.company_id ? C.get(l.company_id) : undefined;
    switch (d) {
      case 'source':
        return l.source;
      case 'sector':
        return sectorGroup(co?.sector);
      case 'trigger': {
        const t = trig.get(l.id) ?? (l.company_id ? trig.get(`c:${l.company_id}`) : undefined);
        return t ? TRIGGER_TYPES.find((x) => x.value === t)?.label ?? t : 'No signal';
      }
      case 'title':
        return titleGroup(l.contact_id ? P.get(l.contact_id)?.role_title : null);
      case 'service':
        return l.recommended_service ? growthServiceLabel(l.recommended_service) : 'Not set';
      case 'offer':
        return (l.company_id && offer.get(l.company_id)?.replace(/_/g, ' ')) || 'None suggested';
      case 'city':
        return co?.city?.trim() || 'Unknown';
    }
  };

  const row = (key: string, list: Lead[]): FunnelRow => ({
    key,
    leads: list.length,
    contacted: list.filter((l) => contactedLeads.has(l.id) || reached(l.id, 'contacted')).length,
    replied: list.filter((l) => reached(l.id, 'replied')).length,
    qualified: list.filter((l) => reached(l.id, 'qualified')).length,
    meetings: list.filter((l) => meetingLeads.has(l.id) || reached(l.id, 'meeting_booked')).length,
    proposals: list.filter((l) => reached(l.id, 'proposal')).length,
    won: list.filter((l) => l.stage === 'won').length,
  });

  const breakdowns = Object.fromEntries(
    DIMENSIONS.map((d) => {
      const groups = new Map<string, Lead[]>();
      for (const l of leads) {
        const k = keyFor(l, d.value);
        groups.set(k, [...(groups.get(k) ?? []), l]);
      }
      return [d.value, [...groups.entries()].map(([k, list]) => row(k, list)).sort((a, b) => b.leads - a.leads)];
    }),
  ) as Record<Dimension, FunnelRow[]>;

  const funnel = row('All leads', leads);
  const replies = realSent.filter((m) => m.replied_at).length;
  const qualifiedChats = convs.filter((c) => ['hot', 'warm'].includes(c.route)).length;
  const aiCost = Math.round(usage.reduce((a, u) => a + Number(u.cost_usd), 0) * 100) / 100;
  return {
    since,
    totals: {
      prospectsAdded: companies.length,
      leads: leads.length,
      messagesSent: realSent.length,
      replies,
      replyRate: realSent.length ? replies / realSent.length : null,
      chats: convs.length,
      qualifiedChats,
      qualificationRate: convs.length ? qualifiedChats / convs.length : null,
      meetings: meetingsRows.length,
      proposals: funnel.proposals,
      wins: funnel.won,
      aiCostUsd: aiCost,
      aiCalls: usage.length,
      qualifiedLeads: funnel.qualified,
      costPerQualifiedLead: funnel.qualified ? Math.round((aiCost / funnel.qualified) * 100) / 100 : null,
      mockSends: sent.length - realSent.length,
    },
    funnel,
    breakdowns,
  };
}
