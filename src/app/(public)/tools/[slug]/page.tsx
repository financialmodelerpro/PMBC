import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findTool, toolPageSlug, toolPath } from '@/config/tools';
import { AdminPreviewBanner } from '@/components/tools/AdminPreviewBanner';
import { ToolHero } from '@/components/tools/ToolHero';
import { ToolJsonLd } from '@/components/seo/ToolJsonLd';
import { TOOL_COMPONENTS } from '@/components/tools/toolComponents';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { PAGE_GUTTER } from '@/lib/public/layout';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchToolVisibility, findToolIn } from '@/lib/tools/visibility';
import { TOOL_DISCLAIMER } from '@/lib/tools/valuation/format';

// Rendered per request, never prerendered: the visibility switch at
// /admin/tools must take effect on the next request, not the next deploy.
export const dynamic = 'force-dynamic';

type Params = { slug: string };

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await props.params;
  const tool = findToolIn(await fetchToolVisibility(), slug);
  if (!tool?.live) {
    // Hidden, draft or unknown. The page 404s for the public and is a preview
    // for staff; neither should ever be indexed.
    return { title: 'Not found', robots: { index: false, follow: false } };
  }
  return buildPageMetadata({
    path: toolPath(slug),
    cmsPage: await fetchPage(toolPageSlug(slug)),
    fallback: {
      title: `${tool.name} Tool | PaceMakers Business Consultants`,
      description: tool.summary,
      ogSubtitle: tool.summary,
    },
  });
}

/**
 * One route for every tool. The compact hero is the tool's CMS page
 * (`tool-<slug>`), edited in the page builder; the calculator below it is code,
 * since its copy is tied to its logic.
 *
 * A Hidden tool is a 404 to the public. Signed-in staff get the page with an
 * Admin preview banner, and anything they submit is saved as a test lead.
 */
export default async function ToolPage(props: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  const registered = findTool(slug);
  const Component = registered ? TOOL_COMPONENTS[registered.slug] : undefined;
  if (!registered || !Component) notFound();

  const snapshot = await fetchToolVisibility();
  const tool = findToolIn(snapshot, slug);
  const live = Boolean(tool?.live);
  // Only asked when it matters, so a public request to a Live tool never
  // touches the session.
  const staff = live ? null : await getAdminSession().catch(() => null);
  if (!live && !staff) notFound();
  const preview = !live;

  const [sections, settings] = await Promise.all([
    fetchPageSections(toolPageSlug(slug), { onlyVisible: search.preview !== '1' }),
    fetchSiteSettings().catch(() => ({ booking_url: '' })),
  ]);

  return (
    <main>
      {live && <ToolJsonLd tool={registered} />}
      {preview && (
        <AdminPreviewBanner
          reason={
            registered.build === 'draft'
              ? 'This tool is still in development and cannot be switched Live.'
              : snapshot.problem === 'missing_table'
                ? 'The tool visibility migration has not been applied, so every tool is Hidden.'
                : 'This tool is Hidden. The public gets a 404.'
          }
          manageHref={`/admin/tools/${slug}`}
        />
      )}
      <ToolHero sections={sections} fallback={registered.hero} />
      <section className={`bg-[color:var(--pmbc-surface-cream)] ${PAGE_GUTTER} py-10 sm:py-14 lg:py-16`}>
        <Component bookingUrl={(settings.booking_url ?? '').trim()} preview={preview} />
        <p className="mx-auto mt-10 max-w-[900px] border-t border-[color:var(--pmbc-border-warm)] pt-6 text-[13px] leading-[1.6] text-[color:var(--pmbc-muted)]">
          {TOOL_DISCLAIMER}
        </p>
      </section>
    </main>
  );
}
