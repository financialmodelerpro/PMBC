import { NextResponse, after } from 'next/server';

import { findTool } from '@/config/tools';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { toolsDb, type ToolLeadRow } from '@/lib/tools/db';
import { sendResultsEmail } from '@/lib/tools/leads/deliver';
import { getLead, getLeadByToken, insertLeadEvent } from '@/lib/tools/leads/store';
import { processVersionUpdate, type VersionStore } from '@/lib/tools/leads/version';
import { fetchToolVisibility, findToolIn } from '@/lib/tools/visibility';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const store: VersionStore = {
  async findByToken(token) {
    const lead = await getLeadByToken(token);
    return lead
      ? { id: lead.id, tool_slug: lead.tool_slug, is_test: lead.is_test, inputs: lead.inputs, results: lead.results, data_version: lead.data_version, purpose: lead.purpose }
      : null;
  },
  async countVersionsSince(leadId, sinceIso) {
    try {
      const { count, error } = await toolsDb()
        .from('tool_lead_events')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', leadId)
        .eq('event_type', 'version_saved')
        .gte('occurred_at', sinceIso);
      return error ? null : (count ?? 0);
    } catch {
      return null;
    }
  },
  async saveVersion(lead, next) {
    const recorded = await insertLeadEvent({
      lead_id: lead.id,
      event_type: 'version_saved',
      source: 'results',
      detail: 'Visitor emailed an updated version. The payload is the version it replaced.',
      payload: { previous: { inputs: lead.inputs, results: lead.results, data_version: lead.data_version } },
    });
    if (recorded === 'failed') return false;
    const { error } = await toolsDb().from('tool_leads').update(next).eq('id', lead.id);
    if (error) console.error('[tool-leads] version update failed:', error.message);
    return !error;
  },
};

/**
 * "Email me this version". See `processVersionUpdate` for the rules. The
 * results email with the new report is sent after the response.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  if (!findTool(slug) || slug !== 'business-valuation') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const [snapshot, session] = await Promise.all([fetchToolVisibility(), getAdminSession().catch(() => null)]);
  const outcome = await processVersionUpdate(
    body,
    { now: new Date(), toolLive: Boolean(findToolIn(snapshot, slug)?.live), isStaff: Boolean(session) },
    store,
  );

  if (outcome.kind === 'saved' && outcome.lead) {
    const leadId = outcome.lead.id;
    const result = outcome.result;
    after(async () => {
      const { lead } = await getLead(leadId);
      if (lead) await sendResultsEmail(lead as ToolLeadRow, result, { resend: true, source: 'results' }).catch((err) => console.error('[tool-leads] version email failed:', err));
    });
  }
  return NextResponse.json(outcome.body, { status: outcome.status });
}
