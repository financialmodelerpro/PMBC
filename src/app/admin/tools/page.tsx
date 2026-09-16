import type { Metadata } from 'next';
import Link from 'next/link';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { VisibilityToggle } from '@/components/admin/tools/VisibilityToggle';
import { ADMIN_COLORS, adminBadge, adminCard, adminPageMain, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { leadCountsBySlug } from '@/lib/tools/admin';
import { fetchToolVisibility } from '@/lib/tools/visibility';

export const metadata: Metadata = { title: 'Tools | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function when(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function AdminToolsPage() {
  const snapshot = await fetchToolVisibility();
  const { counts, missingTable: leadsMissing } = await leadCountsBySlug(snapshot.tools.map((t) => t.slug));

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Free tools"
          title="Tools"
          description="Each tool is Hidden until switched Live here. One switch controls its page, its listing on /tools, the sitemap, its structured data, its service page call to action and the footer Free Tools link."
        />
        {snapshot.problem === 'missing_table' && (
          <MigrationNotice
            migration="076_tool_visibility.sql"
            table="tool_visibility"
            effect="Until then every tool is Hidden and cannot be switched Live."
          />
        )}
        {snapshot.problem === 'error' && (
          <MigrationNotice migration="076_tool_visibility.sql" table="tool_visibility" effect="The table could not be read, so every tool is treated as Hidden." />
        )}
        {leadsMissing && (
          <MigrationNotice migration="077_tool_leads.sql" table="tool_leads" effect="Lead counts show zero and submissions are not saved until it is applied." />
        )}

        <div style={{ ...adminCard, padding: 0, overflowX: 'auto' }}>
          <table style={adminTable}>
            <thead style={adminThead}>
              <tr>
                <th style={adminTh}>Tool</th>
                <th style={adminTh}>Status</th>
                <th style={adminTh}>Last changed</th>
                <th style={{ ...adminTh, textAlign: 'right' }}>Leads</th>
                <th style={{ ...adminTh, textAlign: 'right' }}>Last 30 days</th>
                <th style={adminTh} />
              </tr>
            </thead>
            <tbody>
              {snapshot.tools.map((t) => (
                <tr key={t.slug}>
                  <td style={adminTd}>
                    <Link href={`/admin/tools/${t.slug}`} style={{ fontWeight: 600, color: ADMIN_COLORS.primary, textDecoration: 'none' }}>
                      {t.name}
                    </Link>
                    <div style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, fontFamily: 'ui-monospace, monospace' }}>{t.slug}</div>
                    {t.build === 'draft' && <span style={{ ...adminBadge('warning'), marginTop: 4 }}>In development</span>}
                  </td>
                  <td style={adminTd}>
                    <VisibilityToggle
                      slug={t.slug}
                      name={t.name}
                      live={t.live}
                      canToggle={t.build === 'ready' && snapshot.problem === null}
                      disabledReason={
                        t.build !== 'ready'
                          ? 'This tool is still in development.'
                          : 'Apply migration 076 before switching tools Live.'
                      }
                    />
                  </td>
                  <td style={{ ...adminTd, fontSize: 13 }}>{when(t.updatedAt)}</td>
                  <td style={{ ...adminTd, textAlign: 'right' }}>{counts[t.slug]?.total ?? 0}</td>
                  <td style={{ ...adminTd, textAlign: 'right' }}>{counts[t.slug]?.last30 ?? 0}</td>
                  <td style={{ ...adminTd, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link href={`/admin/tools/${t.slug}`} style={{ fontSize: 13, color: ADMIN_COLORS.primary }}>
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted, marginTop: 12 }}>
          Lead counts exclude test leads, which are submissions made by signed-in staff.
        </p>
      </div>
    </div>
  );
}
