import { NextResponse } from 'next/server';

import { findTool } from '@/config/tools';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { bookingRedirectUrl } from '@/lib/tools/leads/deliver';
import { getLeadByToken } from '@/lib/tools/leads/store';
import { recomputeInputs } from '@/lib/tools/leads/valuation';
import { fetchReportBranding } from '@/lib/tools/brand/fetch';
import { renderValuationReport, reportFileName } from '@/lib/tools/pdf/ValuationReport';
import { VALUATION_DATA_VERSION } from '@/lib/tools/valuation/data';
import { fetchToolVisibility, findToolIn } from '@/lib/tools/visibility';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * "Download PDF" from the results dashboard: the report for the inputs on
 * screen, recomputed here, for a visitor who has already given their details.
 *
 * Needs the lead's access token, so the report can carry their name and the
 * tracked booking link, and so this is not an anonymous PDF renderer. Writes
 * nothing: the download is not a new version. "Email me this version" is.
 */
export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  if (!findTool(slug) || slug !== 'business-valuation') return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: { token?: unknown; inputs?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const [snapshot, session] = await Promise.all([fetchToolVisibility(), getAdminSession().catch(() => null)]);
  if (!findToolIn(snapshot, slug)?.live && !session) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const lead = typeof body.token === 'string' ? await getLeadByToken(body.token) : null;
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const recomputed = recomputeInputs(body.inputs);
  if (!recomputed.ok) return NextResponse.json({ error: 'Validation failed', issues: recomputed.issues }, { status: 400 });

  const now = new Date();
  const pdf = await renderValuationReport(recomputed.result, {
    preparedFor: lead.name,
    company: lead.company,
    industry: recomputed.inputs.industry,
    country: recomputed.inputs.country,
    purpose: lead.purpose,
    generatedAt: now,
    dataVersion: VALUATION_DATA_VERSION,
    bookingHref: bookingRedirectUrl(lead.access_token, 'pdf'),
    branding: await fetchReportBranding(),
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${reportFileName(lead.company, lead.name, now)}"`,
      'cache-control': 'no-store',
    },
  });
}
