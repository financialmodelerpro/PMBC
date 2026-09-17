import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { toolPath } from '@/config/tools';
import type { ToolWithVisibility } from '@/lib/tools/visibility';

/**
 * One free tool as a card: the /tools hub and the "other tools" section on each
 * tool page draw the same card, so the two never drift. `showHidden` marks a
 * Hidden tool for staff previews.
 */
export function ToolCard({ tool, showHidden = false, headingLevel = 'h2' }: { tool: ToolWithVisibility; showHidden?: boolean; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <Link
      href={toolPath(tool.slug)}
      className="group flex h-full flex-col rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white p-8 transition-colors duration-200 hover:border-[#C69C3E] sm:p-10"
    >
      <div aria-hidden className="h-px w-[48px]" style={{ background: '#C69C3E' }} />
      <p className="mt-5 text-[11px] font-semibold uppercase text-[color:var(--pmbc-accent-muted)]" style={{ letterSpacing: '0.18em' }}>
        {tool.eyebrow}
        {showHidden && !tool.live && <span className="ml-2 text-[#92400E]">Hidden</span>}
      </p>
      <Heading className="pmbc-display mt-3 text-[28px] leading-[1.15] text-[color:var(--pmbc-text)] sm:text-[32px]">{tool.name}</Heading>
      <p className="mt-4 flex-1 text-[16px] leading-[1.7] text-[#52606B]">{tool.summary}</p>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-[color:var(--pmbc-muted)]">{tool.duration}, free</span>
        <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase text-[color:var(--pmbc-primary)]" style={{ letterSpacing: '0.12em' }}>
          Open the tool
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
