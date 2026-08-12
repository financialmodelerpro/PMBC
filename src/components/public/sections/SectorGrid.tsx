import { RichText } from '@/components/public/RichText';
import { resolveSectorIcon } from '@/lib/cms/sectorIcons';

import { SectionContainer, SectionIntro } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';
import { visibleListItems } from '@/lib/public/itemVisibility';

type Sector = { icon_name: string; title: string; description: string };

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickSectors(c: Record<string, unknown>): {
  intro: string;
  heading: string;
  eyebrow: string;
  sectors: Sector[];
} {
  const intro = s(c.intro);
  const heading = s(c.heading) || s(c.headline);
  const eyebrow = s(c.eyebrow);
  const raw = visibleListItems(
    (Array.isArray(c.sectors) && c.sectors) || (Array.isArray(c.items) && c.items) || [],
  );
  const sectors: Sector[] = raw
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const title = s(o.title);
      const description = s(o.description);
      const icon_name = s(o.icon_name);
      if (!title && !description) return null;
      return { icon_name, title, description };
    })
    .filter((s): s is Sector => s !== null);
  return { intro, heading, eyebrow, sectors };
}

export function SectorGrid({
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
  const { intro, heading, eyebrow, sectors } = pickSectors(content ?? {});
  if (sectors.length === 0 && !heading && !intro) return null;

  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant} styles={styles} media={media}>
      <SectionIntro
        eyebrow={eyebrow}
        headline={heading}
        intro={intro}
        variant={variant}
      />

      {sectors.length > 0 && (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((sector, i) => {
            const Icon = resolveSectorIcon(sector.icon_name);
            return (
              <div
                key={i}
                className="group p-8 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(15,37,64,0.08)]"
                style={{
                  background: v.cardBg,
                  border: `1px solid ${v.cardBorder}`,
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center"
                  style={{
                    background: dark ? 'rgba(198, 156, 62, 0.12)' : 'rgba(168, 133, 48, 0.10)',
                    color: dark ? '#C69C3E' : '#A88530',
                  }}
                >
                  <Icon size={22} strokeWidth={1.5} />
                </div>
                {sector.title && (
                  <h3
                    className="mt-6 font-serif text-[20px] font-semibold leading-tight"
                    style={{ color: dark ? '#FFFFFF' : v.text }}
                  >
                    {sector.title}
                  </h3>
                )}
                {sector.description && (
                  <p
                    className="mt-3 text-[15px] leading-[1.7]"
                    style={{ color: dark ? v.textMuted : '#52606B' }}
                  >
                    <RichText html={sector.description} as="span" />
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionContainer>
  );
}
