import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { findLiveTool, liveTools, toolPageSlug, toolPath } from '@/config/tools';
import { ToolHero } from '@/components/tools/ToolHero';
import { ToolJsonLd } from '@/components/seo/ToolJsonLd';
import { TOOL_COMPONENTS } from '@/components/tools/toolComponents';
import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { fetchSiteSettings } from '@/lib/cms/settings';
import { PAGE_GUTTER } from '@/lib/public/layout';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { TOOL_DISCLAIMER } from '@/lib/tools/valuation/format';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return liveTools().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await props.params;
  const tool = findLiveTool(slug);
  if (!tool) return { title: 'Tool' };
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
 * One route for every tool. The compact hero is the tool's CMS page (`tool-<slug>`),
 * edited in the page builder; the calculator below it is code, since its copy
 * is tied to its logic.
 */
export default async function ToolPage(props: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  const tool = findLiveTool(slug);
  const Component = tool ? TOOL_COMPONENTS[tool.slug] : undefined;
  if (!tool || !Component) notFound();

  const [sections, settings] = await Promise.all([
    fetchPageSections(toolPageSlug(slug), { onlyVisible: search.preview !== '1' }),
    fetchSiteSettings().catch(() => ({ booking_url: '' })),
  ]);

  return (
    <main>
      <ToolJsonLd tool={tool} />
      <ToolHero sections={sections} fallback={tool.hero} />
      <section className={`bg-[color:var(--pmbc-surface-cream)] ${PAGE_GUTTER} py-10 sm:py-14 lg:py-16`}>
        <Component bookingUrl={(settings.booking_url ?? '').trim()} />
        <p className="mx-auto mt-10 max-w-[900px] border-t border-[color:var(--pmbc-border-warm)] pt-6 text-[13px] leading-[1.6] text-[color:var(--pmbc-muted)]">
          {TOOL_DISCLAIMER}
        </p>
      </section>
    </main>
  );
}
