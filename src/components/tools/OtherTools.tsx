import Link from 'next/link';

import { PAGE_GUTTER, PAGE_INNER, SECTION_PADDING } from '@/lib/public/layout';
import type { ToolWithVisibility } from '@/lib/tools/visibility';

import { ToolCard } from './ToolCard';

/**
 * "Try our other free tools", below a tool. Lists the tools `otherToolsFor`
 * returns and renders nothing when there are none. See
 * `src/lib/tools/otherTools.ts` for who sees what.
 */
export function OtherTools({ tools, preview }: { tools: ToolWithVisibility[]; preview: boolean }) {
  if (tools.length === 0) return null;
  return (
    <section aria-labelledby="other-tools-heading" className={`bg-white ${PAGE_GUTTER} ${SECTION_PADDING}`} data-other-tools="">
      <div className={PAGE_INNER}>
        <p className="text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]" style={{ letterSpacing: '0.18em' }}>
          Free tools
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <h2 id="other-tools-heading" className="pmbc-display text-[30px] leading-[1.15] text-[color:var(--pmbc-text)] sm:text-[36px]">
            Try our other free tools
          </h2>
          <Link href="/tools" className="text-[13px] font-semibold text-[color:var(--pmbc-primary)] underline decoration-[#C69C3E] underline-offset-4">
            See all free tools
          </Link>
        </div>
        <ul className="mt-8 grid gap-6 md:grid-cols-2">
          {tools.map((t) => (
            <li key={t.slug}>
              <ToolCard tool={t} showHidden={preview} headingLevel="h3" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
