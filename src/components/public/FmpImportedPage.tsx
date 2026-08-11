import Link from 'next/link';

import { SectionList } from './SectionRenderer';
import { SectionContainer, SectionIntro } from './SectionContainer';
import { PAGE_GUTTER, PAGE_INNER } from '@/lib/public/layout';
import type { MappedSection } from '@/lib/fmp/mapSections';

const FMP_URL = 'https://app.financialmodelerpro.com';

/**
 * Renders a page whose content came from FMP, inside PMBC's own section
 * renderers, navbar and footer.
 *
 * The imported sections are mapped into PMBC's vocabulary and then rendered by
 * exactly the same components that render PMBC's own pages, so the result is
 * PMBC's markup and PMBC's visual system rather than an embed or an iframe.
 * That is what makes the content PMBC's for SEO.
 *
 * Two outcomes, and neither is an error page: sections to render, or a short
 * standing notice with a link out. The caller decides which by mapping first,
 * so an outage, a cold cache and a page whose sections were all skipped all
 * arrive here as an empty list.
 *
 * TAKES MAPPED SECTIONS, NOT THE RAW PAYLOAD, AND THAT IS DELIBERATE.
 * Passing `FmpFetchResult` in meant the raw feed response crossed a component
 * boundary, and React serialises what crosses one into the RSC flight payload
 * embedded in the page. In development that put the entire untouched FMP
 * response into the page source, including the `_dynamic` placeholder sections
 * this site drops and the `_visible` flags it honours. Production did not do
 * it, but the exposure existed because the raw data was handed over at all.
 * Mapping before this boundary means only what actually renders can ever be
 * serialised.
 */
export function FmpImportedPage({
  sections,
  title,
  intro,
  fmpPath,
}: {
  /** Already mapped into PMBC's vocabulary. Empty means nothing to show. */
  sections: MappedSection[];
  title: string;
  intro: string;
  /** Where this page lives on FMP, for the link out. */
  fmpPath: string;
}) {
  if (sections.length === 0) {
    return <Unavailable title={title} intro={intro} fmpPath={fmpPath} />;
  }

  return (
    <>
      <SectionList sections={sections} />
      <Attribution fmpPath={fmpPath} />
    </>
  );
}

/**
 * A standing note that the page describes FMP, with the link out.
 *
 * Rendered on every imported page, not only on the fallback: a visitor reading
 * platform copy on the advisory firm's site should always have one obvious way
 * to reach the platform itself.
 */
function Attribution({ fmpPath }: { fmpPath: string }) {
  return (
    <section className={`relative ${PAGE_GUTTER} py-16`} style={{ background: '#FAF7F2' }}>
      <div className={PAGE_INNER}>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <p className="max-w-[640px] text-[15px] leading-[1.65]" style={{ color: '#4A5568' }}>
            Financial Modeler Pro is the platform arm of PaceMakers Business
            Consultants. This page describes the platform. The platform itself,
            including registration and the live modules, is on the Financial
            Modeler Pro site.
          </p>
          <a
            href={`${FMP_URL}${fmpPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center border border-[#1B3A5F] bg-[#1B3A5F] px-7 py-3 text-[12px] font-semibold uppercase text-[#E8DDC4] transition duration-200 hover:border-[#C69C3E] hover:bg-[#C69C3E] hover:text-[#14304F]"
            style={{ letterSpacing: '0.12em' }}
          >
            Open on Financial Modeler Pro
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * The cold-cache case: FMP is unreachable and PMBC has never stored a copy.
 *
 * Deliberately not a 404 and not an error boundary. The URL is a real PMBC
 * page that is temporarily thin, so it keeps its navbar, footer and metadata,
 * says plainly that the detail lives on FMP, and links there. A visitor gets
 * somewhere useful and a crawler gets a 200 with real content rather than an
 * error it might treat as a dead URL.
 */
function Unavailable({
  title,
  intro,
  fmpPath,
}: {
  title: string;
  intro: string;
  fmpPath: string;
}) {
  return (
    <>
      <SectionContainer variant="navy_deep">
        <SectionIntro eyebrow="Financial Modeler Pro" headline={title} intro={intro} variant="navy_deep" />
        <div className="mt-10 flex justify-center">
          <a
            href={`${FMP_URL}${fmpPath}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center border border-[#C69C3E] bg-[#C69C3E] px-8 py-3.5 text-[12px] font-semibold uppercase text-[#14304F] transition duration-200 hover:bg-transparent hover:text-[#C69C3E]"
            style={{ letterSpacing: '0.12em' }}
          >
            View this on Financial Modeler Pro
          </a>
        </div>
      </SectionContainer>
      <SectionContainer variant="cream" size="compact">
        <div className="mx-auto max-w-[720px] text-center">
          <p className="text-[15px] leading-[1.7]" style={{ color: '#4A5568' }}>
            The full detail for this page is served from the Financial Modeler
            Pro platform and is not reachable at the moment. It will return here
            automatically. In the meantime the platform itself is unaffected.
          </p>
          <p className="mt-6 text-[14px]">
            <Link
              href="/fmp"
              className="font-semibold uppercase text-[#1B3A5F] underline decoration-[#C69C3E] underline-offset-4"
              style={{ letterSpacing: '0.1em' }}
            >
              Back to the platform overview
            </Link>
          </p>
        </div>
      </SectionContainer>
    </>
  );
}
