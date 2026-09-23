import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { LinkAllToolLeads, LinkToolLead } from '@/components/admin/growth/conversations/ConversationActions';
import { ADMIN_COLORS, adminBadge, adminCard, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { requireGrowthSession } from '@/lib/growth/access';
import { day } from '@/lib/growth/format';
import { listToolLeads } from '@/lib/growth/valuationLink';

export const metadata: Metadata = { title: 'Valuation tool leads | Growth | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ValuationLeadsPage() {
  await requireGrowthSession();
  const { rows, error } = await listToolLeads();
  return (
    <>
      <AdminPageHeader
        eyebrow="Growth Engine"
        title="Valuation tool leads"
        description="People who used the business valuation tool. Read only: the tool's records are never changed. Only those who gave follow-up consent and are not suppressed can be linked to a Growth lead."
        actions={<Link href="/admin/growth/conversations">Conversations</Link>}
      />
      {error && <p style={{ color: ADMIN_COLORS.danger, fontSize: 13 }}>Could not read the valuation leads: {error}</p>}
      <section style={{ ...adminCard, marginBottom: 16 }}>
        <LinkAllToolLeads />
      </section>
      <section style={{ ...adminCard, padding: 0 }}>
        {rows.length === 0 ? (
          <p style={{ padding: 20, margin: 0, fontSize: 13, color: ADMIN_COLORS.textMuted }}>No valuation leads yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Date</th>
                  <th style={adminTh}>Person</th>
                  <th style={adminTh}>Deal size band</th>
                  <th style={adminTh}>Consent</th>
                  <th style={adminTh}>Growth</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...adminTd, fontSize: 12, whiteSpace: 'nowrap' }}>{day(r.created_at)}</td>
                    <td style={{ ...adminTd, fontSize: 13 }}>
                      {r.name}
                      <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>{[r.company, r.email].filter(Boolean).join(', ')}</div>
                    </td>
                    <td style={{ ...adminTd, fontSize: 12 }}>
                      {r.deal_size_band ?? ''} {r.below_minimum && <span style={adminBadge('danger')}>Below minimum</span>}
                    </td>
                    <td style={adminTd}>{r.follow_up_consent ? <span style={adminBadge('success')}>Follow-up consent</span> : <span style={adminBadge('neutral')}>None</span>}</td>
                    <td style={adminTd}>{r.linkedLeadId ? <Link href={`/admin/growth/pipeline/${r.linkedLeadId}`}>Linked lead</Link> : <LinkToolLead id={r.id} disabled={!r.follow_up_consent} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
