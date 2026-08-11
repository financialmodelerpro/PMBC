import type { Metadata } from 'next';

import { FmpImportedPage } from '@/components/public/FmpImportedPage';
import { fetchFmpPage } from '@/lib/fmp/client';
import { mapFmpSections } from '@/lib/fmp/mapSections';
import { buildFmpPageMetadata, FMP_PAGES } from '@/lib/fmp/pages';

const SLUG = 'modeling-hub' as const;

/**
 * Content for this page is fetched from FMP's public feed and rendered through
 * PMBC's own section renderers, so the markup, the navbar, the footer and the
 * visual system are PMBC's.
 *
 * ISR rather than force-dynamic, which the rest of the public site uses: this
 * page depends on a third party, and revalidating on a timer means a visitor
 * waits on FMP at most once per window instead of on every request.
 */
// A literal, not the imported constant: Next requires route segment config to
// be statically analyzable. Kept in step with FMP_REVALIDATE_SECONDS in
// lib/fmp/client, which the verification asserts.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return buildFmpPageMetadata(SLUG);
}

export default async function Page() {
  const result = await fetchFmpPage(SLUG);
  const config = FMP_PAGES[SLUG];
  // Mapped here rather than inside the component, so the raw feed response
  // never crosses a component boundary and cannot reach the RSC payload.
  const sections = result.ok ? mapFmpSections(result.payload.sections, SLUG).sections : [];
  return (
    <FmpImportedPage
      sections={sections}
      title={config.title}
      intro={config.intro}
      fmpPath={config.fmpPath}
    />
  );
}
