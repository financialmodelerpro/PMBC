import { NextResponse } from 'next/server';

import { getAdminSession } from '@/lib/auth/requireAdmin';
import { bookingLinkFor } from '@/lib/tools/leads/bookingLinkStore';
import { getLead } from '@/lib/tools/leads/store';
import { renderValuationReport, reportFileName } from '@/lib/tools/pdf/ValuationReport';
import { fetchReportBranding } from '@/lib/tools/brand/fetch';
import { resultForReport } from '@/lib/tools/leads/reportResult';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** The lead's PDF report, rendered from its stored results. Staff only. */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await props.params;

  const { lead } = await getLead(id);
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

  const created = new Date(lead.created_at);
  const pdf = await renderValuationReport(resultForReport(lead), {
    preparedFor: lead.name,
    company: lead.company,
    industry: lead.industry ?? '',
    country: lead.country ?? '',
    purpose: lead.purpose,
    generatedAt: created,
    dataVersion: lead.data_version,
    bookingHref: await bookingLinkFor(lead, 'pdf'),
    branding: await fetchReportBranding(),
    description: (lead.inputs as { profile?: { description?: string | null } } | null)?.profile?.description ?? null,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${reportFileName(lead.company, lead.name, created)}"`,
      'cache-control': 'no-store',
    },
  });
}
