import { SectionContainer, SectionIntro } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export type CredentialsDisplay = 'numbered' | 'pills' | 'cards';

type CredentialsContent = {
  heading: string;
  intro: string;
  display: CredentialsDisplay;
  items: string[];
};

function pick(c: Record<string, unknown>): CredentialsContent {
  const raw = Array.isArray(c.items) ? c.items : [];
  const items = raw.map((i) => (typeof i === 'string' ? i : '')).filter(Boolean);
  const d = c.display;
  const display: CredentialsDisplay =
    d === 'pills' || d === 'cards' || d === 'numbered' ? d : 'numbered';
  return {
    heading: s(c.heading),
    intro: s(c.intro),
    display,
    items,
  };
}

/**
 * A heading plus a list of short strings, in one of three presentations.
 *
 * The founder profile needs three list-shaped blocks that differ only in how
 * they look: Experience and Background (numbered), Expertise Areas (pills),
 * and Industry Focus (cards). They share a data shape exactly, so this is one
 * section type with a `display` discriminator rather than three near-identical
 * types cluttering the section picker.
 */
export function FounderCredentials({
  content,
  styles,
  variant = 'white',
  media = null,
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
  media?: SectionMediaValue | null;
}) {
  const c = pick(content ?? {});
  if (c.items.length === 0) return null;
  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';
  const bodyColor = dark ? '#E8DDC4' : v.text;

  return (
    <SectionContainer variant={variant} styles={styles} size="compact" media={media}>
      <div className="mx-auto max-w-[820px]">
        <SectionIntro
          eyebrow=""
          headline={c.heading}
          intro={c.intro}
          variant={variant}
          align="left"
        />

        <div className="mt-10">
          {c.display === 'numbered' && (
            <ol className="flex flex-col gap-5">
              {c.items.map((item, i) => (
                <li key={item} className="flex items-baseline gap-5">
                  <span
                    aria-hidden
                    className="pmbc-display shrink-0 text-[20px] leading-none tabular-nums"
                    style={{ color: '#C69C3E', minWidth: 32 }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[16.5px] leading-[1.65]" style={{ color: bodyColor }}>
                    {item}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {c.display === 'pills' && (
            <ul className="flex flex-wrap gap-3">
              {c.items.map((item) => (
                <li
                  key={item}
                  className="rounded-[2px] border px-4 py-2.5 text-[14px]"
                  style={{
                    borderColor: v.cardBorder,
                    background: v.cardBg,
                    color: bodyColor,
                  }}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}

          {c.display === 'cards' && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {c.items.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-[2px] border px-5 py-4"
                  style={{
                    borderColor: v.cardBorder,
                    background: v.cardBg,
                  }}
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: '#C69C3E' }}
                  />
                  <span className="text-[15px] leading-[1.5]" style={{ color: bodyColor }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </SectionContainer>
  );
}
