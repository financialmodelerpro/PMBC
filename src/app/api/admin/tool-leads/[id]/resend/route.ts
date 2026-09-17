import { NextResponse } from 'next/server';

import { writeAudit } from '@/lib/audit';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendResultsEmail } from '@/lib/tools/leads/deliver';
import { getLead } from '@/lib/tools/leads/store';
import { resultForReport } from '@/lib/tools/leads/reportResult';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Sends the results email again, with a freshly rendered report, from the
 * results stored on the lead (see `resultForReport`): the visitor receives the same
 * numbers they were shown, even if the market data has been refreshed since.
 */
export async function POST(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await props.params;

  const { lead, missingTable } = await getLead(id);
  if (!lead) return NextResponse.json({ error: missingTable ? 'Migration 077 not applied' : 'Lead not found' }, { status: 404 });

  const sent = await sendResultsEmail(lead, resultForReport(lead), { resend: true, adminId: session.user.id });
  await writeAudit(createSupabaseServerClient(), {
    adminId: session.user.id,
    action: 'resend_results_email',
    entityType: 'tool_leads',
    entityId: id,
    metadata: { ok: sent.ok, to: lead.email },
  });
  if (!sent.ok) {
    return NextResponse.json({ error: sent.message ?? sent.reason, reason: sent.reason }, { status: 502 });
  }
  return NextResponse.json({ ok: true, messageId: sent.id });
}
