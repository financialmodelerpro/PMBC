/**
 * Storing the Lead Score (Unit 3.5, 2026-09-23). Server only.
 *
 * `rescoreLead` gathers the lead's engagement (replies, tracked-link clicks,
 * chats from Phase 4, meetings from Phase 5), scores it with the weights from
 * Settings and stores the score, temperature and reasons once the lead has
 * engaged. A move in temperature is logged. Tables a later migration adds are
 * simply counted as zero until they exist.
 */

import { logActivity } from './activity';
import { growthDb } from './db';
import { getEngineSettings } from './engineSettings';
import type { GrowthLead } from './model';
import { targetingRules } from './prospects';
import { scoreLead, type LeadScoreResult } from './scoring/lead';

/** A count that is zero when its table does not exist yet. */
async function safeCount(run: () => PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  try {
    const { count, error } = await run();
    return error ? 0 : count ?? 0;
  } catch {
    return 0;
  }
}

export async function computeLeadScore(leadId: string): Promise<{ lead: GrowthLead; result: LeadScoreResult } | null> {
  const { data } = await growthDb().from('growth_leads').select('*').eq('id', leadId).maybeSingle();
  const lead = data as (GrowthLead & { meeting_requested?: boolean; last_reply_at?: string | null }) | null;
  if (!lead) return null;
  const [company, contact, clicks, chats, meetings, replies, engine, targeting] = await Promise.all([
    lead.company_id ? growthDb().from('growth_companies').select('*').eq('id', lead.company_id).maybeSingle() : Promise.resolve({ data: null }),
    lead.contact_id ? growthDb().from('growth_contacts').select('is_decision_maker, role_title').eq('id', lead.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    growthDb().from('growth_tracked_links').select('click_count').eq('lead_id', leadId).eq('kind', 'link'),
    safeCount(() => growthDb().from('growth_conversations').select('id', { count: 'exact', head: true }).eq('lead_id', leadId)),
    safeCount(() => growthDb().from('growth_meetings').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).in('status', ['scheduled', 'rescheduled', 'completed'])),
    safeCount(() => growthDb().from('growth_messages').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).not('replied_at', 'is', null)),
    getEngineSettings(),
    targetingRules(lead.is_test),
  ]);
  const clickTotal = ((clicks.data ?? []) as { click_count: number }[]).reduce((a, r) => a + (r.click_count ?? 0), 0);
  const result = scoreLead({
    lead,
    company: company.data as LeadScoreInputCompany,
    contact: contact.data as { is_decision_maker: boolean; role_title: string | null } | null,
    engagement: { replied: replies > 0 || Boolean(lead.last_reply_at), clicks: clickTotal, chats, meetings },
    weights: engine.values.lead_scoring_weights,
    decisionMakerTitles: targeting.decisionMakerTitles,
  });
  return { lead, result };
}

type LeadScoreInputCompany = { country: string | null; city: string | null; sector: string | null; scale_sar?: number | string | null } | null;

/** Stores the Lead Score once the lead has engaged. Returns the result either way. */
export async function rescoreLead(leadId: string): Promise<LeadScoreResult | null> {
  const computed = await computeLeadScore(leadId);
  if (!computed) return null;
  const { lead, result } = computed;
  if (!result.engaged) return result;
  const patch: Record<string, unknown> = { lead_score: result.score, lead_temperature: result.temperature, score_reasons: result.reasons, lead_scored_at: new Date().toISOString() };
  let { error } = await growthDb().from('growth_leads').update(patch).eq('id', leadId);
  if (error && /lead_scored_at/.test(error.message ?? '')) {
    // Before 089: store the score without its timestamp.
    delete patch.lead_scored_at;
    ({ error } = await growthDb().from('growth_leads').update(patch).eq('id', leadId));
  }
  if (!error && (lead.lead_temperature !== result.temperature || lead.lead_score !== result.score)) {
    await logActivity({
      actorType: 'system',
      actorId: 'lead-score',
      action: 'pipeline.lead_scored',
      summary: `Lead Score ${lead.lead_score ?? 'none'} to ${result.score} (${result.temperature})`,
      companyId: lead.company_id,
      leadId,
      isTest: lead.is_test,
      metadata: { score: result.score, temperature: result.temperature, reasons: result.reasons, factors: result.factors },
    });
  }
  return result;
}
