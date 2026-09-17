import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TOOLS_HUB_HERO } from '@/config/tools';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { ToolsHubJsonLd } from '@/components/seo/ToolJsonLd';
import { AdminPreviewBanner } from '@/components/tools/AdminPreviewBanner';
import { ToolCard } from '@/components/tools/ToolCard';
import { getAdminSession } from '@/lib/auth/requireAdmin';
import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { PAGE_GUTTER, PAGE_INNER, SECTION_PADDING } from '@/lib/public/layout';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchToolVisibility, liveToolsFrom } from '@/lib/tools/visibility';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const live = liveToolsFrom(await fetchToolVisibility());
  if (live.length === 0) return { title: 'Not found', robots: { index: false, follow: false } };
  return buildPageMetadata({
    path: '/tools',
    cmsPage: await fetchPage('tools'),
    fallback: {
      title: 'Free Tools | PaceMakers Business Consultants',
      description:
        'Free corporate finance tools from PaceMakers. Indicative business valuation and investor readiness, built on the methods we use on mandates.',
      ogSubtitle: 'Indicative results in minutes, built on the methods we use on mandates.',
    },
  });
}

/**
 * The free tools hub.
 *
 * Lists Live tools only. With none Live it is a 404 to the public, since a hub
 * with no cards is an empty promise; signed-in staff see every ready tool with
 * an Admin preview banner. The hero is a CMS section (migration 074).
 */
export default async function ToolsHubPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const snapshot = await fetchToolVisibility();
  const live = liveToolsFrom(snapshot);
  const staff = live.length === 0 ? await getAdminSession().catch(() => null) : null;
  if (live.length === 0 && !staff) notFound();
  const preview = live.length === 0;
  const cards = preview ? snapshot.tools.filter((t) => t.build === 'ready') : live;

  const sections = await fetchPageSections('tools', { onlyVisible: search.preview !== '1' });

  return (
    <main>
      {!preview && <ToolsHubJsonLd tools={live} />}
      {preview && (
        <AdminPreviewBanner
          reason="No tool is Live, so this page is a 404 for the public. Hidden tools are listed here for staff only."
          manageHref="/admin/tools"
        />
      )}
      <FirmPageBody sections={sections} fallbackHero={TOOLS_HUB_HERO} />

      <section className={`bg-[color:var(--pmbc-surface-cream)] ${PAGE_GUTTER} ${SECTION_PADDING}`}>
        <div className={PAGE_INNER}>
          <ul className="grid gap-6 md:grid-cols-2">
            {cards.map((t) => (
              <li key={t.slug}>
                <ToolCard tool={t} showHidden={preview} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
