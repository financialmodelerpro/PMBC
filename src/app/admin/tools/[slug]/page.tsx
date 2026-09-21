import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { MigrationNotice } from '@/components/admin/tools/MigrationNotice';
import { VisibilityToggle } from '@/components/admin/tools/VisibilityToggle';
import { toolPath } from '@/config/tools';
import { ADMIN_COLORS, adminButtonGhost, adminCard, adminPageMain, adminTable, adminTd, adminTh, adminThead } from '@/lib/admin/styles';
import { leadCountsBySlug, visibilityHistory } from '@/lib/tools/admin';
import { fetchToolVisibility, findToolIn } from '@/lib/tools/visibility';

export const metadata: Metadata = { title: 'Tool | PMBC Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default async function AdminToolDetailPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const snapshot = await fetchToolVisibility();
  const tool = findToolIn(snapshot, slug);
  if (!tool) notFound();

  const [history, { counts, missingTable }] = await Promise.all([visibilityHistory(slug), leadCountsBySlug([slug])]);
  const c = counts[slug] ?? { total: 0, last30: 0, projects: 0 };

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <p style={{ margin: '0 0 12px', fontSize: 13 }}>
          <Link href="/admin/tools" style={{ color: ADMIN_COLORS.primary }}>
            All tools
          </Link>
        </p>
        <AdminPageHeader eyebrow="Free tool" title={tool.name} description={tool.summary} />
        {snapshot.problem === 'missing_table' && (
          <MigrationNotice migration="076_tool_visibility.sql" table="tool_visibility" effect="This tool is Hidden until it is applied." />
        )}
        {missingTable && <MigrationNotice migration="077_tool_leads.sql" table="tool_leads" effect="No leads can be saved until it is applied." />}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
          <section style={adminCard}>
            <h2 style={{ margin: '0 0 12px', fontSize: 15, color: ADMIN_COLORS.textHeading }}>Visibility</h2>
            <VisibilityToggle
              slug={tool.slug}
              name={tool.name}
              live={tool.live}
              canToggle={tool.build === 'ready' && snapshot.problem === null}
              disabledReason={tool.build !== 'ready' ? 'This tool is still in development.' : 'Apply migration 076 first.'}
            />
            <p style={{ fontSize: 13, color: ADMIN_COLORS.textMuted, lineHeight: 1.55, margin: '12px 0 0' }}>
              {tool.live
                ? 'Public. Listed on /tools, in the sitemap, linked from the footer and its service page.'
                : 'Hidden. The public page returns 404. Signed-in staff can open it in Admin preview, and anything submitted there is saved as a test lead.'}
            </p>
          </section>
          <section style={adminCard}>
            <h2 style={{ margin: '0 0 12px', fontSize: 15, color: ADMIN_COLORS.textHeading }}>Open</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <a href={toolPath(tool.slug)} target="_blank" rel="noopener noreferrer" style={adminButtonGhost}>
                {tool.live ? 'Public page' : 'Admin preview'}
              </a>
              <a href="/tools" target="_blank" rel="noopener noreferrer" style={adminButtonGhost}>
                Tools hub
              </a>
              {tool.serviceCta && (
                <a href={`/services/${tool.serviceCta.serviceSlug}`} target="_blank" rel="noopener noreferrer" style={adminButtonGhost}>
                  Service page
                </a>
              )}
            </div>
            <p style={{ fontSize: 13, color: ADMIN_COLORS.textMuted, lineHeight: 1.55, margin: '12px 0 0' }}>
              {tool.live
                ? 'Staff viewing the public page still submit test leads.'
                : 'The preview opens because you are signed in. Logged out, the same address is a 404.'}
            </p>
          </section>
          <section style={adminCard}>
            <h2 style={{ margin: '0 0 12px', fontSize: 15, color: ADMIN_COLORS.textHeading }}>Leads</h2>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>{c.total}</p>
            <p style={{ margin: '2px 0 12px', fontSize: 13, color: ADMIN_COLORS.textMuted }}>{c.last30} in the last 30 days, excluding test leads. One lead per email: {c.projects} valuations in all.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Link href={`/admin/tool-leads?tool=${tool.slug}`} style={adminButtonGhost}>
                View leads
              </Link>
              <Link href={`/admin/tool-leads?tool=${tool.slug}&test=1`} style={adminButtonGhost}>
                Including test leads
              </Link>
            </div>
          </section>
        </div>

        <section style={{ ...adminCard, padding: 0 }}>
          <h2 style={{ margin: 0, padding: '16px 20px', fontSize: 15, color: ADMIN_COLORS.textHeading }}>Visibility history</h2>
          {history.length === 0 ? (
            <p style={{ margin: 0, padding: '0 20px 20px', fontSize: 13, color: ADMIN_COLORS.textMuted }}>
              No changes recorded. The tool has been Hidden since it was added.
            </p>
          ) : (
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>When</th>
                  <th style={adminTh}>Admin</th>
                  <th style={adminTh}>Change</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td style={{ ...adminTd, fontSize: 13 }}>{when(h.created_at)}</td>
                    <td style={{ ...adminTd, fontSize: 13 }}>{h.admin}</td>
                    <td style={{ ...adminTd, fontSize: 13 }}>
                      {(h.from ?? 'hidden').replace(/^./, (x) => x.toUpperCase())} to {(h.to ?? '').replace(/^./, (x) => x.toUpperCase())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
