import type { Metadata } from 'next';

import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ADMIN_COLORS, adminPageMain } from '@/lib/admin/styles';

import { PageListClient, type PageRow } from './PageListClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Page Builder | PMBC Admin',
  robots: { index: false, follow: false },
};

/**
 * Reads cms_pages directly rather than through fetchPages(), because the list
 * needs `is_system` to decide between a delete button and a lock, and the shared
 * fetcher does not select it.
 */
async function loadPages(): Promise<{
  rows: PageRow[];
  error: string | null;
  migrationPending: boolean;
}> {
  try {
    const supabase = createSupabaseServerClient();
    const [pagesRes, sectionsRes] = await Promise.all([
      supabase
        .from('cms_pages')
        .select('id, slug, title, status, is_system, updated_at')
        .order('slug', { ascending: true }),
      supabase.from('page_sections').select('page_slug'),
    ]);

    // Migration 031 adds `is_system`. Until it is applied the select above
    // fails, so retry without the column and treat every page as system.
    // Failing closed here means the worst case is "nothing is deletable",
    // never "everything is deletable".
    if (pagesRes.error) {
      const retry = await supabase
        .from('cms_pages')
        .select('id, slug, title, status, updated_at')
        .order('slug', { ascending: true });
      if (retry.error) return { rows: [], error: retry.error.message, migrationPending: false };

      const counts = new Map<string, number>();
      for (const r of sectionsRes.data ?? []) {
        counts.set(r.page_slug, (counts.get(r.page_slug) ?? 0) + 1);
      }
      return {
        rows: (retry.data ?? []).map((p) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          status: p.status,
          is_system: true,
          updated_at: p.updated_at,
          section_count: counts.get(p.slug) ?? 0,
        })),
        error: null,
        migrationPending: true,
      };
    }

    const counts = new Map<string, number>();
    for (const r of sectionsRes.data ?? []) {
      counts.set(r.page_slug, (counts.get(r.page_slug) ?? 0) + 1);
    }

    const rows: PageRow[] = (pagesRes.data ?? []).map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      status: p.status,
      // Defensive: if migration 031 has not been applied the column is absent
      // and this reads undefined. Treating that as "system" fails safe, since a
      // missing flag must not make every page look deletable.
      is_system: p.is_system ?? true,
      updated_at: p.updated_at,
      section_count: counts.get(p.slug) ?? 0,
    }));

    return { rows, error: null, migrationPending: false };
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : 'Failed to load pages',
      migrationPending: false,
    };
  }
}

export default async function PageBuilderListPage() {
  const { rows, error, migrationPending } = await loadPages();

  return (
    <div style={adminPageMain}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <AdminPageHeader
          eyebrow="Content"
          title="Page Builder"
          description="Every CMS-managed page. Open the builder to edit sections, reorder, or change visibility. To edit the navigation menu, use Pages and Nav."
        />

        {error && (
          <div
            style={{
              background: ADMIN_COLORS.dangerBg,
              border: `1px solid ${ADMIN_COLORS.danger}`,
              borderRadius: 12,
              padding: 18,
              fontSize: 13,
              color: ADMIN_COLORS.danger,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        {migrationPending && (
          <div
            style={{
              background: ADMIN_COLORS.warningBg,
              border: '1px solid #FBBF24',
              borderRadius: 12,
              padding: '14px 18px',
              fontSize: 12.5,
              lineHeight: 1.6,
              color: ADMIN_COLORS.warning,
              marginBottom: 14,
            }}
          >
            Migration 031 has not been applied, so <code>cms_pages.is_system</code> does not
            exist yet. Every page is shown as locked and none can be deleted, which is the
            safe default. Run{' '}
            <code>supabase/migrations/031_cms_pages_is_system.sql</code> in the Supabase SQL
            editor to enable deleting pages you create here.
          </div>
        )}

        {rows.length === 0 && !error ? (
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
          <PageListClient pages={rows} />
        )}
      </div>
    </div>
  );
}
