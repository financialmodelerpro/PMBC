import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchPages } from '@/lib/cms/pages';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  ADMIN_COLORS,
  adminBadge,
  adminPageMain,
  adminTable,
  adminTd,
  adminTh,
  adminThead,
} from '@/lib/admin/styles';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pages — PMBC Admin',
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function PagesAdminPage() {
  const pages = await fetchPages();

  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase.from('page_sections').select('page_slug');
  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    counts.set(r.page_slug, (counts.get(r.page_slug) ?? 0) + 1);
  }

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Admin"
          title="Pages"
          description="Every CMS-managed page. Open the page builder to edit sections, reorder, or change visibility."
        />

        {pages.length === 0 ? (
          <div
            style={{
              background: ADMIN_COLORS.warningBg,
              border: '1px solid #FBBF24',
              borderRadius: 12,
              padding: 18,
              fontSize: 13,
              color: ADMIN_COLORS.warning,
            }}
          >
            No cms_pages rows. Run migration 005.
          </div>
        ) : (
          <div
            style={{
              background: '#FFFFFF',
              border: `1px solid ${ADMIN_COLORS.border}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <table style={adminTable}>
              <thead style={adminThead}>
                <tr>
                  <th style={adminTh}>Slug</th>
                  <th style={adminTh}>Title</th>
                  <th style={adminTh}>Status</th>
                  <th style={adminTh}>Sections</th>
                  <th style={adminTh}>Last updated</th>
                  <th style={{ ...adminTh, textAlign: 'right' }}>Open</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p, i) => {
                  const last = i === pages.length - 1;
                  const cellStyle = last
                    ? { ...adminTd, borderBottom: 'none' }
                    : adminTd;
                  return (
                    <tr key={p.id}>
                      <td
                        style={{
                          ...cellStyle,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          color: ADMIN_COLORS.textHeading,
                        }}
                      >
                        {p.slug}
                      </td>
                      <td style={{ ...cellStyle, color: ADMIN_COLORS.textHeading }}>
                        {p.title}
                      </td>
                      <td style={cellStyle}>
                        <span
                          style={
                            p.status === 'published'
                              ? adminBadge('success')
                              : adminBadge('neutral')
                          }
                        >
                          {p.status}
                        </span>
                      </td>
                      <td style={cellStyle}>{counts.get(p.slug) ?? 0}</td>
                      <td style={cellStyle}>{formatDate(p.updated_at)}</td>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>
                        <Link
                          href={`/admin/page-builder/${p.slug}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 12px',
                            border: `1px solid ${ADMIN_COLORS.border}`,
                            borderRadius: 7,
                            fontSize: 12,
                            fontWeight: 600,
                            color: ADMIN_COLORS.primaryDeep,
                            textDecoration: 'none',
                          }}
                        >
                          Builder
                          <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
