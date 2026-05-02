import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { fetchPages } from '@/lib/cms/pages';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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

  // Pull section counts in one round trip.
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from('page_sections')
    .select('page_slug');
  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    counts.set(r.page_slug, (counts.get(r.page_slug) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        eyebrow="Admin"
        title="Pages"
        description="Every CMS-managed page. Open the page builder to edit sections, reorder, or change visibility."
      />

      {pages.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          No cms_pages rows. Run migration 005.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] font-medium tracking-[0.16em] uppercase text-neutral-500">
              <tr>
                <th className="px-5 py-3">Slug</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Sections</th>
                <th className="px-5 py-3">Last updated</th>
                <th className="px-5 py-3 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => {
                const builderHref = `/admin/page-builder/${p.slug}`;
                return (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="px-5 py-3 font-mono text-[13px] text-[#0F1B2D]">{p.slug}</td>
                    <td className="px-5 py-3 text-[#0F1B2D]">{p.title}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3 text-neutral-600">
                      {counts.get(p.slug) ?? 0}
                    </td>
                    <td className="px-5 py-3 text-neutral-600">
                      {formatDate(p.updated_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={builderHref}
                        className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-[#0F2540] hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
                      >
                        Builder
                        <ArrowUpRight className="h-3.5 w-3.5" />
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
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'published'
      ? 'bg-[#E5F1EA] text-[#1B6B3F]'
      : 'bg-neutral-100 text-neutral-600';
  return (
    <span
      className={
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ' +
        tone
      }
    >
      {status}
    </span>
  );
}
