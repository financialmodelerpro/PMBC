import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { toolPath, type ToolEntry } from '@/config/tools';
import { PAGE_GUTTER, SECTION_PADDING_COMPACT } from '@/lib/public/layout';
import type { PageSection } from '@/lib/cms/pages';

/**
 * A Live tool promoting itself on its service page, between the service detail
 * and the closing enquiry band. Navy, the same treatment as the CMS CTA block,
 * so it separates the two white sections around it.
 *
 * Rendered by the service route only for tools `serviceCtasFor` returns, so its
 * visibility is the tool's and nothing else's.
 */
export function ToolServiceCta({ tool }: { tool: ToolEntry }) {
  const cta = tool.serviceCta;
  if (!cta) return null;
  return (
    <section className={`${PAGE_GUTTER} ${SECTION_PADDING_COMPACT}`} style={{ background: '#14304F' }}>
      <div className="mx-auto max-w-[860px] text-center">
        <div aria-hidden className="mx-auto h-px w-[60px]" style={{ background: '#C69C3E' }} />
        <p className="mt-5 text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.18em', color: '#C69C3E' }}>
          {cta.eyebrow}
        </p>
        <h2 className="pmbc-display mt-4 text-[32px] leading-[1.12] text-white sm:text-[40px]">{cta.headline}</h2>
        <p className="mx-auto mt-4 max-w-[640px] text-[17px] leading-[1.7]" style={{ color: '#E8DDC4' }}>
          {cta.body}
        </p>
        <Link
          href={toolPath(tool.slug)}
          className="mt-8 inline-flex items-center gap-2 border border-[#C69C3E] bg-[#C69C3E] px-8 py-3.5 text-[12px] font-semibold uppercase text-[#14304F] transition-colors duration-200 hover:bg-transparent hover:text-white"
          style={{ letterSpacing: '0.12em' }}
        >
          {cta.label}
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

/**
 * Drops any page-builder section that links into a tool.
 *
 * Migration 075 created one, and 079 removes it, but a database that has not
 * run 079 still holds it, and an operator could switch it back on in the page
 * builder. Either way it would be a second switch for a promise the tool's own
 * visibility already governs, so the service route never renders it.
 */
export function withoutToolLinkSections(sections: PageSection[]): PageSection[] {
  return sections.filter((s) => {
    if (s.section_type !== 'cta_block') return true;
    const c = (s.content ?? {}) as Record<string, unknown>;
    const href = typeof c.cta_primary_href === 'string' ? c.cta_primary_href.trim() : '';
    return !(href === '/tools' || href.startsWith('/tools/'));
  });
}
