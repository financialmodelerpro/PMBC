import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { sanitizeRichHtml } from '@/lib/cms/sanitize';
import { fetchVisibleTeam, type TeamMemberRow } from '@/lib/cms/collections';
import { fetchFounderProfile, isFounder, type FounderProfile } from '@/lib/cms/founderProfile';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { FirmPageBody } from '@/components/public/FirmPageBody';

export const dynamic = 'force-dynamic';

/** The hero copy this page ships with, and its fallback when no section exists. */
const FALLBACK_HERO = {
  eyebrow: 'Team',
  headline: 'The people behind the work',
  tagline:
    'PaceMakers is senior by design. Every mandate is partner-led, supported by a focused analytical bench.',
};

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata({
    path: '/team',
    cmsPage: await fetchPage('team'),
    fallback: {
      title: 'Team | PaceMakers Business Consultants',
      description:
        'The people behind PaceMakers. Senior practitioners who lead every mandate directly.',
      ogSubtitle: 'Senior practitioners, partner-led mandates.',
    },
  });
}

/** Up to two initials, for a member with no portrait uploaded. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * The navy monogram panel that stands in for a missing portrait.
 *
 * Deliberate rather than unfinished, and the same choice the carousel cards
 * make: there is no stock imagery in this repository, and an invented headshot
 * would be worse than an honest placeholder.
 */
function Portrait({ member, className }: { member: TeamMemberRow; className: string }) {
  if (member.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={member.photo} alt={member.name} className={`${className} object-cover`} />
    );
  }
  return (
    <div
      className={`${className} flex items-center justify-center`}
      style={{ background: '#1B3A5F' }}
      aria-hidden
    >
      <span className="font-serif text-[44px] font-semibold tracking-tight text-[#C69C3E]">
        {initials(member.name)}
      </span>
    </div>
  );
}

/** Role, then the qualifications line. Shared by both card treatments. */
function Attribution({ member, tight }: { member: TeamMemberRow; tight?: boolean }) {
  return (
    <>
      {member.role && (
        <p
          className={`${tight ? 'mt-2 text-[13px]' : 'mt-3 text-[15px]'} font-semibold text-[color:var(--pmbc-accent-muted)]`}
        >
          {member.role}
        </p>
      )}
      {member.credentials && (
        <p
          className={`${tight ? 'mt-2 text-[11px]' : 'mt-3 text-[12px]'} font-semibold uppercase text-[color:var(--pmbc-muted)]`}
          style={{ letterSpacing: '0.14em' }}
        >
          {member.credentials}
        </p>
      )}
    </>
  );
}

/**
 * The founding partner, leading the page.
 *
 * Wider than the cards below it and given the gold-framed portrait the home
 * founder card uses, because this is the person who wins and leads every
 * mandate. The experience paragraph here is a short one on purpose: the card
 * links through to the full profile rather than repeating it, which is also why
 * this page and /about/ahmad-din do not read as duplicate content.
 */
function FoundingPartnerCard({
  member,
  profilePath,
}: {
  member: TeamMemberRow;
  profilePath: string | null;
}) {
  return (
    <article className="grid items-center gap-10 rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white p-8 sm:p-10 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-14">
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[300px]">
        {/* The same gold frame and navy corner as the home founder card. */}
        <div aria-hidden className="absolute -inset-2 border border-[#C69C3E]" />
        <div
          aria-hidden
          className="absolute -right-2 -bottom-2 h-8 w-8"
          style={{ background: '#1B3A5F' }}
        />
        <Portrait member={member} className="relative aspect-[4/5] w-full overflow-hidden" />
      </div>

      <div>
        <h2 className="pmbc-display text-[30px] font-semibold leading-tight text-[color:var(--pmbc-text)] sm:text-[36px]">
          {member.name}
        </h2>
        <Attribution member={member} />
        {member.bio && (
          <div
            className="pmbc-prose mt-6 text-[16px] leading-[1.75] text-[color:var(--pmbc-muted)]"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(member.bio) }}
          />
        )}
        {profilePath && (
          <Link
            href={profilePath}
            className="group mt-7 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--pmbc-primary)]"
          >
            Read the full profile
            <ArrowUpRight
              size={15}
              className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>
        )}
      </div>
    </article>
  );
}

/** Every other member, in the three-up grid the collection pages share. */
function MemberCard({ member }: { member: TeamMemberRow }) {
  return (
    <li className="flex h-full flex-col overflow-hidden rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white">
      <Portrait member={member} className="h-52 w-full" />
      <div className="flex flex-1 flex-col p-7">
        <h3 className="font-serif text-[21px] font-semibold leading-tight text-[color:var(--pmbc-text)]">
          {member.name}
        </h3>
        <Attribution member={member} tight />
        {member.bio && (
          <div
            className="pmbc-prose mt-4 flex-1 text-[15px] leading-[1.7] text-[color:var(--pmbc-muted)]"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(member.bio) }}
          />
        )}
      </div>
    </li>
  );
}

/**
 * Splits the founding partner out of the list.
 *
 * Ordering the rest is left to `display_order`, but the founder leads the page
 * regardless of it. That is not the renderer overruling the operator for its own
 * sake: his card is a different shape from the others and links somewhere they
 * do not, so it could not sit third in a grid even if the numbers said so. The
 * admin hint on Display order says as much.
 */
function partition(
  team: TeamMemberRow[],
  founder: FounderProfile | null,
): { lead: TeamMemberRow | null; rest: TeamMemberRow[] } {
  const index = team.findIndex((m) => isFounder(m.name, founder));
  if (index === -1) return { lead: null, rest: team };
  return {
    lead: team[index],
    rest: team.filter((_, i) => i !== index),
  };
}

export default async function TeamPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await props.searchParams;
  const isPreview = search.preview === '1';

  const [team, founder, sections] = await Promise.all([
    fetchVisibleTeam(),
    fetchFounderProfile(),
    fetchPageSections('team', { onlyVisible: !isPreview }),
  ]);
  const { lead, rest } = partition(team, founder);

  return (
    <main>
      {/* The hero is a CMS section since migration 070, so its three strings are
          edited in the page builder like every other page's. `FirmPageBody`
          keeps the shipped copy as a fallback for a database without that
          section, which is the same guarantee the five firm pages have.

          The cards below are not section content. They come from the
          `team_members` collection. */}
      <FirmPageBody sections={sections} fallbackHero={FALLBACK_HERO} />

      <section className="bg-[color:var(--pmbc-surface-cream)] px-6 py-20 lg:py-28">
        {/* The row count is published so the sitemap check can ask the page
            whether this collection has anything in it, rather than matching the
            empty-state wording, which is copy and will change. */}
        <div className="mx-auto max-w-[1200px]" data-collection-count={team.length}>
          {team.length === 0 ? (
            <p className="text-center text-[16px] text-[color:var(--pmbc-muted)]">
              Profiles are being prepared and will appear here shortly.
            </p>
          ) : (
            <>
              {lead && <FoundingPartnerCard member={lead} profilePath={founder?.path ?? null} />}
              {rest.length > 0 && (
                <ul
                  className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 ${lead ? 'mt-8' : ''}`}
                >
                  {rest.map((m) => (
                    <MemberCard key={m.id} member={m} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
