import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { TOOLS_HUB_HERO, toolPath } from '@/config/tools';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { ToolsHubJsonLd } from '@/components/seo/ToolJsonLd';
import { AdminPreviewBanner } from '@/components/tools/AdminPreviewBanner';
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
                <Link
                  href={toolPath(t.slug)}
                  className="group flex h-full flex-col rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white p-8 transition-colors duration-200 hover:border-[#C69C3E] sm:p-10"
                >
                  <div aria-hidden className="h-px w-[48px]" style={{ background: '#C69C3E' }} />
                  <p
                    className="mt-5 text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]"
                    style={{ letterSpacing: '0.18em' }}
                  >
                    {t.eyebrow}
                    {preview && !t.live && <span className="ml-2 text-[#92400E]">Hidden</span>}
                  </p>
                  <h2 className="pmbc-display mt-3 text-[28px] leading-[1.15] text-[color:var(--pmbc-text)] sm:text-[32px]">
                    {t.name}
                  </h2>
                  <p className="mt-4 flex-1 text-[16px] leading-[1.7] text-[#52606B]">{t.summary}</p>
                  <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[13px] text-[color:var(--pmbc-muted)]">{t.duration}, free</span>
                    <span
                      className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase text-[color:var(--pmbc-primary)]"
                      style={{ letterSpacing: '0.12em' }}
                    >
                      Open the tool
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
