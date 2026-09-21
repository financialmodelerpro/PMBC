import { NextResponse } from 'next/server';

import { findTool } from '@/config/tools';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { linkIdForLead } from '@/lib/tools/leads/bookingLinkStore';
import { leadIdForResume } from '@/lib/tools/leads/resumeLinks';
import { getLead } from '@/lib/tools/leads/store';
import { fetchToolVisibility, findToolIn } from '@/lib/tools/visibility';

export const dynamic = 'force-dynamic';

/**
 * Save and return (since 2026-09-21): the page opened with `?resume=<id>` asks here for the saved
 * valuation, loads its inputs into the form, and holds the project's token so running it again
 * saves a new version of the same project. Reads only. An unknown or malformed id is a 404, the same
 * answer as a Hidden tool, so the route says nothing about which ids exist.
 */
export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  if (!findTool(slug) || slug !== 'business-valuation') return notFound();

  const [snapshot, session] = await Promise.all([fetchToolVisibility(), getAdminSession().catch(() => null)]);
  if (!findToolIn(snapshot, slug)?.live && !session) return notFound();

  const id = new URL(req.url).searchParams.get('r') ?? '';
  const leadId = await leadIdForResume(id);
  if (!leadId) return notFound();
  const { lead } = await getLead(leadId);
  if (!lead || lead.tool_slug !== slug) return notFound();

  const inputs = lead.inputs as { raiseAmount?: number | null } | null;
  return NextResponse.json(
    {
      ok: true,
      inputs: lead.inputs,
      lead: { name: lead.name, email: lead.email, token: lead.access_token, booking: await linkIdForLead(lead.id) },
      gate: {
        name: lead.name,
        email: lead.email,
        company: lead.company ?? '',
        purpose: lead.purpose ?? '',
        dealSize: lead.deal_size_band ?? '',
        raiseAmount: inputs?.raiseAmount === null || inputs?.raiseAmount === undefined ? '' : String(inputs.raiseAmount),
        contactCountry: lead.contact_country ?? '',
        phone: lead.phone ?? '',
      },
      project: lead.company || null,
    },
    { headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } },
  );
}
