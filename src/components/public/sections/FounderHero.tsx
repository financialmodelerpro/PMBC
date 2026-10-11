import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';

import { SectionContainer } from '../SectionContainer';
import { ProfilePhoto } from '../ProfilePhoto';
import { readMediaValue } from '@/lib/media';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import { MultilineText } from '../MultilineText';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

type FounderHeroContent = {
  eyebrow: string;
  name: string;
  title_primary: string;
  title_accent: string;
  credentials_line: string;
  intro: string;
  photo_url: string;
  cta_primary_label: string;
  cta_primary_href: string;
  cta_secondary_label: string;
  cta_secondary_href: string;
};

function pick(c: Record<string, unknown>): FounderHeroContent {
  return {
    eyebrow: s(c.eyebrow),
    name: s(c.name),
    title_primary: s(c.title_primary),
    title_accent: s(c.title_accent),
    credentials_line: s(c.credentials_line),
    intro: s(c.intro),
    photo_url: s(c.photo_url),
    cta_primary_label: s(c.cta_primary_label),
    cta_primary_href: s(c.cta_primary_href),
    cta_secondary_label: s(c.cta_secondary_label),
    cta_secondary_href: s(c.cta_secondary_href),
  };
}

/**
 * The contact row's three links, each dropped when its field is empty or does
 * not look like what it claims to be. Clearing a field in the page builder
 * removes that item; clearing all three removes the row.
 */
type ContactItem = {
  key: string;
  href: string;
  label: string;
  icon: React.ReactNode;
  external: boolean;
};

/**
 * The hero's contact fields that pass validation, each null when empty or
 * malformed. Shared with the profile pages' Person JSON-LD, so a field cleared
 * in the page builder leaves the page and the structured data together.
 */
export function heroContacts(content: Record<string, unknown>): {
  email: string | null;
  phone: string | null;
  dial: string | null;
  linkedin: string | null;
} {
  const email = s(content.contact_email).trim();
  const phone = s(content.contact_phone).trim();
  const linkedin = s(content.contact_linkedin).trim();
  const dial = phone.replace(/[^\d+]/g, '');
  const phoneOk = /^\+?\d{6,15}$/.test(dial);
  return {
    email: /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) ? email : null,
    phone: phoneOk ? phone : null,
    dial: phoneOk ? dial : null,
    linkedin: /^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/[^\s<>"]*$/i.test(linkedin) ? linkedin : null,
  };
}

/** Email and phone. LinkedIn is not in the row: it is the hero's lead button. */
function contactItems(content: Record<string, unknown>): ContactItem[] {
  const { email, phone, dial } = heroContacts(content);
  const items: ContactItem[] = [];
  if (email) {
    items.push({
      key: 'email',
      href: `mailto:${email}`,
      label: email,
      icon: <Mail size={15} aria-hidden />,
      external: false,
    });
  }
  if (phone && dial) {
    items.push({
      key: 'phone',
      href: `tel:${dial}`,
      label: phone,
      icon: <Phone size={15} aria-hidden />,
      external: false,
    });
  }
  return items;
}

/**
 * The hero's buttons, in one standard order for every profile: "Connect on
 * LinkedIn" first, drawn from the LinkedIn field, then the two CTAs. A CTA
 * pointing at that same LinkedIn profile is dropped rather than shown twice,
 * which covers a hero still carrying LinkedIn in its primary CTA. Only the
 * first button takes the gold style.
 */
type HeroButton = { key: string; href: string; label: string };

function heroButtons(c: FounderHeroContent, content: Record<string, unknown>): HeroButton[] {
  const { linkedin } = heroContacts(content);
  const same = (href: string) =>
    !!linkedin && href.replace(/\/+$/, '').toLowerCase() === linkedin.replace(/\/+$/, '').toLowerCase();
  const buttons: HeroButton[] = [];
  if (linkedin) buttons.push({ key: 'linkedin', href: linkedin, label: 'Connect on LinkedIn' });
  for (const [key, label, href] of [
    ['primary', c.cta_primary_label, c.cta_primary_href],
    ['secondary', c.cta_secondary_label, c.cta_secondary_href],
  ] as const) {
    if (label && href && !same(href)) buttons.push({ key, href, label });
  }
  return buttons;
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/** Outward-pointing arrow, shown on links that leave the site. */
function ExternalIcon() {
  return (
    <svg
      aria-hidden
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 1.5h6v6" />
      <path d="M10.5 1.5 5 7" />
      <path d="M9 7.5v3h-7.5V3h3" />
    </svg>
  );
}

/**
 * The identity block at the top of the founder profile page.
 *
 * Distinct from `founder_block`, which is a mid-page card summarising the
 * founder on the home and about pages. This is the page's own hero: it carries
 * the two-line title treatment (role in light navy text, specialism in gold),
 * the credentials line, an optional contact row (email, phone, LinkedIn) and
 * the outbound CTAs.
 *
 * The portrait is the shared `ProfilePhoto` frame every team profile uses
 * (gold hairline, accent corner, square corners, monogram fallback when no
 * photo is set), so the page is presentable before a portrait is uploaded.
 */
export function FounderHero({
  content,
  styles,
  variant = 'navy_deep',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const c = pick(content ?? {});
  const media = readMediaValue(content ?? {}, 'photo_url');
  if (!c.name && !c.intro && !c.eyebrow) return null;
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  const bodyColor = dark ? '#E8DDC4' : v.textMuted;
  const titleColor = dark ? '#B7CBE0' : '#1B3A5F';
  const contacts = contactItems(content ?? {});
  const buttons = heroButtons(c, content ?? {});

  return (
    // `size="hero"` rather than the default rhythm: this is the block a visitor
    // lands on, so it takes the same 70vh every other page-leading hero does
    // instead of being sized by its portrait.
    <SectionContainer variant={variant} styles={styles} size="hero">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(240px,340px)_minmax(0,1fr)] lg:gap-16">
        <div>
          <ProfilePhoto
            name={c.name}
            src={c.photo_url ? media.url : null}
            alt={c.name || 'Portrait'}
            accent={dark ? 'gold' : 'navy'}
            sizes="(min-width: 1024px) 400px, 90vw"
            priority
            media={media}
          />
        </div>

        <div>
          <div aria-hidden className="h-px w-[60px]" style={{ background: v.eyebrow }} />
          {c.eyebrow && (
            <p
              className="mt-5 text-[11px] font-semibold uppercase"
              style={{ letterSpacing: '0.18em', color: v.eyebrow }}
            >
              {c.eyebrow}
            </p>
          )}
          {c.name && (
            <h1
              className="pmbc-display mt-4 text-[40px] leading-[1.1] sm:text-[52px] lg:text-[60px]"
              style={{ color: v.text }}
            >
              {c.name}
            </h1>
          )}
          {c.title_primary && (
            <p className="mt-4 text-[17px] leading-[1.5] sm:text-[19px]" style={{ color: titleColor }}>
              {c.title_primary}
            </p>
          )}
          {c.title_accent && (
            <p
              className="mt-1 text-[17px] font-semibold sm:text-[19px]"
              style={{ color: '#C69C3E' }}
            >
              {c.title_accent}
            </p>
          )}
          {c.credentials_line && (
            <p
              className="mt-6 text-[11px] font-semibold uppercase"
              style={{ letterSpacing: '0.16em', color: dark ? 'rgba(232,221,196,0.75)' : v.textMuted }}
            >
              {c.credentials_line}
            </p>
          )}
          {c.intro && (
            <p className="mt-7 max-w-[620px] text-[17px] leading-[1.75]" style={{ color: bodyColor }}>
              <MultilineText text={c.intro} />
            </p>
          )}

          {contacts.length > 0 && (
            <ul className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 text-[15px]">
              {contacts.map((item) => (
                <li key={item.key}>
                  <a
                    href={item.href}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
                    style={{ color: dark ? '#E8DDC4' : '#1B3A5F' }}
                  >
                    <span style={{ color: '#C69C3E' }}>{item.icon}</span>
                    {item.label}
                    {item.external && <ExternalIcon />}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* A CTA renders only when both a label and an href are set. A
              profile is a credibility document, so a button that goes nowhere
              is worse than no button. */}
          {buttons.length > 0 && (
            <div className="mt-9 flex flex-wrap items-center gap-4">
              {buttons.map((b, i) => (
                <CtaLink key={b.key} href={b.href} label={b.label} primary={i === 0} dark={dark} />
              ))}
            </div>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}

function CtaLink({
  href,
  label,
  primary = false,
  dark,
}: {
  href: string;
  label: string;
  primary?: boolean;
  dark: boolean;
}) {
  const external = isExternal(href);
  const className =
    'inline-flex items-center gap-2 border px-6 py-3 text-[12px] font-semibold uppercase transition';
  const style: React.CSSProperties = primary
    ? {
        letterSpacing: '0.14em',
        borderColor: '#C69C3E',
        background: '#C69C3E',
        color: '#14304F',
      }
    : {
        letterSpacing: '0.14em',
        borderColor: dark ? 'rgba(232,221,196,0.35)' : '#1B3A5F',
        background: 'transparent',
        color: dark ? '#E8DDC4' : '#1B3A5F',
      };

  const inner = (
    <>
      {label}
      {external && <ExternalIcon />}
    </>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style}>
      {inner}
    </Link>
  );
}
