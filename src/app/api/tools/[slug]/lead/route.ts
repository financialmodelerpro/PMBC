import { NextResponse, after } from 'next/server';

import { findTool } from '@/config/tools';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { deliverNewLead } from '@/lib/tools/leads/deliver';
import { issueBookingLink } from '@/lib/tools/leads/bookingLinkStore';
import { clientIp, hashIp, newAccessToken } from '@/lib/tools/leads/request';
import { supabaseLeadStore } from '@/lib/tools/leads/store';
import { processValuationSubmission } from '@/lib/tools/leads/valuation';
import { fetchToolVisibility, findToolIn } from '@/lib/tools/visibility';
import type { ToolLeadRow } from '@/lib/tools/db';

export const dynamic = 'force-dynamic';
// The PDF render and two Brevo calls run after the response, inside this budget.
export const maxDuration = 60;

/**
 * A tool's lead submission. The browser shows whatever `result` this returns,
 * which the server recomputed; see `processValuationSubmission` for the rules.
 *
 * Emails are scheduled with `after`, so the response goes back as soon as the
 * lead is saved and the visitor never waits on the PDF or on Brevo.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const tool = findTool(slug);
  // One processor today. A second tool adds its own here.
  if (!tool || slug !== 'business-valuation') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const [snapshot, session] = await Promise.all([fetchToolVisibility(), getAdminSession().catch(() => null)]);
  const live = Boolean(findToolIn(snapshot, slug)?.live);

  const outcome = await processValuationSubmission(
    body,
    {
      now: new Date(),
      toolSlug: slug,
      toolLive: live,
      // Staff on a Hidden tool are in Admin preview. Staff on a Live tool are
      // also marked test: a lead Ahmad submits himself is never a real lead.
      isStaff: Boolean(session),
      ipHash: hashIp(clientIp(req.headers)),
      userAgent: req.headers.get('user-agent'),
      newToken: newAccessToken,
    },
    supabaseLeadStore,
  );

  if (outcome.status === 200 && outcome.kind !== 'saved') {
    console.warn(`[tool-leads] ${slug}: not saved (${outcome.kind}${outcome.detail ? `, ${outcome.detail}` : ''})`);
  }

  if (outcome.status === 200 && outcome.saved) {
    const { id, row } = outcome.saved;
    const result = outcome.result;
    // The short booking link for this lead, issued before the emails so they carry it.
    const booking = await issueBookingLink(id);
    after(() =>
      deliverNewLead({ ...(row as unknown as ToolLeadRow), id }, result).catch((err) =>
        console.error('[tool-leads] delivery failed:', err),
      ),
    );
    if (outcome.body.lead) {
      return NextResponse.json({ ...outcome.body, lead: { ...outcome.body.lead, booking } }, { status: outcome.status });
    }
  }

  return NextResponse.json(outcome.body, { status: outcome.status });
}
