import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

import { sanitizeRichHtml } from '@/lib/cms/sanitize';
import { fetchVisibleTeam, type TeamMemberRow } from '@/lib/cms/collections';
import {
  FOUNDER_PAGE_SLUG,
  fetchMemberProfiles,
  isFounder,
  profileFor,
  type FounderProfile,
} from '@/lib/cms/founderProfile';
import {
  fetchCardHighlights,
  memberCredentialsLine,
  memberProfileSlug,
} from '@/lib/cms/teamProfiles';
import { publicPathForPageSlug } from '@/lib/cms/pageRoutes';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { fetchPage, fetchPageSections } from '@/lib/cms/pages';
import { teamCardsPerRow } from '@/lib/cms/teamSettings';
import { FirmPageBody } from '@/components/public/FirmPageBody';
import { ProfilePhoto } from '@/components/public/ProfilePhoto';

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

/** How many highlights a card shows before migration 109, from the member's own list. */
const LEGACY_CARD_HIGHLIGHTS = 3;

/** A list column as trimmed, non-empty strings. Absent or malformed reads as empty. */
function items(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim()).filter(Boolean)
    : [];
}

/** Role, then the credentials line, on the founding partner's card. */
function Attribution({ member }: { member: TeamMemberRow }) {
  const line = memberCredentialsLine(member);
  return (
    <>
      {member.role && (
        <p className="mt-3 text-[15px] font-semibold text-[color:var(--pmbc-accent-muted)]">
          {member.role}
        </p>
      )}
      {line && (
        <p
          className="mt-3 text-[12px] font-semibold uppercase text-[color:var(--pmbc-muted)]"
          style={{ letterSpacing: '0.14em' }}
        >
          {line}
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
 * this page and /team/ahmad-din do not read as duplicate content.
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
      <div className="mx-auto w-full max-w-[300px]">
        <ProfilePhoto
          name={member.name}
          src={member.photo}
          accent="navy"
          sizes="300px"
        />
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
        {profilePath && <ProfileLink href={profilePath} className="mt-7" />}
      </div>
    </article>
  );
}

/** The link through to a member's full profile. Shared by both card treatments. */
function ProfileLink({ href, className }: { href: string; className: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-1.5 text-[13px] font-semibold text-[color:var(--pmbc-primary)] ${className}`}
    >
      Read the full profile
      <ArrowUpRight
        size={15}
        className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </Link>
  );
}

/**
 * Every other member, in the three-up grid the collection pages share. One
 * small standard card for all of them, so the row reads as a set: a small
 * framed portrait beside the name, role and one credentials line
 * (qualification | years of experience | location), up to three key
 * highlights, and the link through to the profile page pinned to the foot.
 * The highlights are the first items of the profile list marked "Show on team
 * card", so they are written once, on the profile.
 *
 * The bio and "Expertise" are deliberately not on the card: they belong to the
 * profile page, which carries everything. Each part of the line and the list
 * render only when filled, and a member without a profile page has no link.
 */
function MemberCard({
  member,
  profilePath,
  highlights,
}: {
  member: TeamMemberRow;
  profilePath: string | null;
  highlights: string[];
}) {
  // The same line, and the same treatment, as the founding partner's
  // "ACCA | FMVA | 12+ Years Experience".
  const line = memberCredentialsLine(member);

  return (
    <li className="flex h-full flex-col rounded-[2px] border border-[color:var(--pmbc-border-warm)] bg-white p-7">
      <div className="flex items-center gap-6">
        <div className="w-[96px] shrink-0">
          <ProfilePhoto name={member.name} src={member.photo} accent="navy" sizes="96px" />
        </div>
        <div className="min-w-0">
          <h3 className="font-serif text-[19px] font-semibold leading-tight text-[color:var(--pmbc-text)]">
            {member.name}
          </h3>
          {member.role && (
            <p className="mt-2 text-[13px] font-semibold leading-snug text-[color:var(--pmbc-accent-muted)]">
              {member.role}
            </p>
          )}
          {line && (
            <p
              className="mt-2 text-[11px] font-semibold uppercase leading-[1.6] text-[color:var(--pmbc-muted)]"
              style={{ letterSpacing: '0.14em' }}
            >
              {line}
            </p>
          )}
        </div>
      </div>

      {highlights.length > 0 && (
        <ul className="mt-7 grid gap-2 border-t border-[color:var(--pmbc-border-warm)] pt-5">
          {highlights.map((item) => (
            <li
              key={item}
              className="flex gap-3 text-[13.5px] leading-[1.55] text-[color:var(--pmbc-muted)]"
            >
              <span aria-hidden className="mt-[8px] h-1.5 w-1.5 shrink-0 bg-[#C69C3E]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}

      {profilePath && <ProfileLink href={profilePath} className="mt-auto self-start pt-6" />}
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
  isLead: (m: TeamMemberRow) => boolean,
): { lead: TeamMemberRow | null; rest: TeamMemberRow[] } {
  const index = team.findIndex(isLead);
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

  const [team, sections, perRow] = await Promise.all([
    fetchVisibleTeam(),
    fetchPageSections('team', { onlyVisible: !isPreview }),
    teamCardsPerRow(),
  ]);

  // Since migration 109 each member names their own profile page
  // (`profile_slug`), and the card's highlights come from that page. Before it,
  // fall back to matching profiles by name and to the member's own list.
  const linked = team.some((m) => memberProfileSlug(m) !== null);
  let pathFor: (m: TeamMemberRow) => string | null;
  let highlightsFor: (m: TeamMemberRow) => string[];
  let isLead: (m: TeamMemberRow) => boolean;
  if (linked) {
    const slugs = team.map(memberProfileSlug).filter((s): s is string => s !== null);
    const highlights = await fetchCardHighlights(slugs);
    pathFor = (m) => {
      const slug = memberProfileSlug(m);
      return slug ? publicPathForPageSlug(slug) : null;
    };
    highlightsFor = (m) => highlights.get(memberProfileSlug(m) ?? '') ?? [];
    isLead = (m) => memberProfileSlug(m) === FOUNDER_PAGE_SLUG;
  } else {
    const profiles = await fetchMemberProfiles();
    const founder: FounderProfile | null =
      profiles.find((p) => p.slug === FOUNDER_PAGE_SLUG) ?? null;
    pathFor = (m) => profileFor(m.name, profiles)?.path ?? null;
    highlightsFor = (m) => items(m.experience_items).slice(0, LEGACY_CARD_HIGHLIGHTS);
    isLead = (m) => isFounder(m.name, founder);
  }
  const { lead, rest } = partition(team, isLead);

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
              {lead && <FoundingPartnerCard member={lead} profilePath={pathFor(lead)} />}
              {rest.length > 0 && (
                <ul
                  className={`grid gap-6 sm:grid-cols-2 ${perRow === 3 ? 'lg:grid-cols-3' : ''} ${lead ? 'mt-8' : ''}`}
                >
                  {rest.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      profilePath={pathFor(m)}
                      highlights={highlightsFor(m)}
                    />
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
