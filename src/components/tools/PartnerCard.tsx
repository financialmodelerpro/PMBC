import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { PARTNER_RECORD_NOTE, type PartnerCard as PartnerCardData } from '@/lib/tools/brand/partner';

/**
 * "Who you will work with", shown on a tool's results beside the booking call
 * to action, and the same card the PDF report closes with. Content from the
 * founder profile (`src/lib/tools/brand/partner.ts`). Renders nothing without a
 * partner card, so a missing profile never leaves an empty frame.
 */
export function PartnerCard({ partner }: { partner: PartnerCardData | null }) {
  if (!partner) return null;
  return (
    <section aria-labelledby="partner-card-name" className="rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-7">
        {partner.photoUrl && (
          <div className="relative aspect-[4/5] w-[120px] shrink-0 overflow-hidden rounded-[2px] border border-[#C69C3E]/40 bg-[#F6F1E6] sm:w-[150px]">
            <Image src={partner.photoUrl} alt={`${partner.name}, ${partner.role}`} fill sizes="150px" className="object-cover object-top" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-[#A88530]" style={{ letterSpacing: '0.16em' }}>
            Who you will work with
          </p>
          <h3 id="partner-card-name" className="pmbc-display mt-1.5 text-[24px] leading-tight text-[color:var(--pmbc-text)]">
            {partner.name}
          </h3>
          <p className="mt-1 text-[14px] text-[color:var(--pmbc-text)]">{[partner.role, partner.title].filter(Boolean).join(', ')}</p>
          {partner.credentialsLine && <p className="mt-1 text-[13px] font-semibold text-[#A88530]">{partner.credentialsLine}</p>}
          {partner.intro && <p className="mt-3 max-w-[70ch] text-[14.5px] leading-[1.65] text-[#3B4A59]">{partner.intro}</p>}
          {partner.highlights.length > 0 && (
            <>
              <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-[13.5px] text-[color:var(--pmbc-text)] md:grid-cols-2">
                {partner.highlights.map((h) => (
                  <li key={h} className="flex gap-2.5">
                    <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-[#C69C3E]" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-[color:var(--pmbc-muted)]">{PARTNER_RECORD_NOTE}</p>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-semibold">
            <Link href={partner.profilePath} className="text-[#1B3A5F] underline decoration-[#C69C3E] underline-offset-4 hover:text-[#14304F]">
              Read the full profile
            </Link>
            {partner.linkedinUrl && (
              <a href={partner.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1B3A5F] underline decoration-[#C69C3E] underline-offset-4 hover:text-[#14304F]">
                LinkedIn
                <ArrowUpRight aria-hidden size={13} />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
