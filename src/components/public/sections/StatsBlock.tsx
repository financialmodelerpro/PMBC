import { SectionContainer } from '../SectionContainer';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';

type Stat = { value: string; label: string };

function pickStats(content: Record<string, unknown>): { intro: string; stats: Stat[] } {
  const intro = typeof content?.intro === 'string' ? content.intro : '';
  const raw = Array.isArray(content?.stats) ? (content.stats as unknown[]) : [];
  const stats: Stat[] = raw
    .map((s) => {
      if (!s || typeof s !== 'object') return null;
      const o = s as Record<string, unknown>;
      const value = typeof o.value === 'string' ? o.value : '';
      const label = typeof o.label === 'string' ? o.label : '';
      if (!value && !label) return null;
      return { value, label };
    })
    .filter((s): s is Stat => s !== null);
  return { intro, stats };
}

export function StatsBlock({
  content,
  variant = 'white',
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
}) {
  const { intro, stats } = pickStats(content ?? {});
  if (stats.length === 0 && !intro) return null;

  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';

  return (
    <SectionContainer variant={variant} size="compact">
      {intro && (
        <p
          className="mx-auto max-w-2xl text-center text-[17px] leading-[1.7]"
          style={{ color: v.textMuted }}
        >
          {intro}
        </p>
      )}
      {stats.length > 0 && (
        <dl
          className={
            'mt-12 grid gap-y-12 ' +
            (stats.length >= 4
              ? 'grid-cols-2 lg:grid-cols-4'
              : stats.length === 3
                ? 'grid-cols-1 sm:grid-cols-3'
                : stats.length === 2
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1')
          }
        >
          {stats.map((s, i) => {
            const isLast = i === stats.length - 1;
            return (
              <div
                key={i}
                className={
                  'relative px-4 text-center sm:px-8 ' +
                  (isLast ? '' : 'lg:after:content-[""] lg:after:absolute lg:after:right-0 lg:after:top-2 lg:after:bottom-2 lg:after:w-px')
                }
                style={
                  !isLast
                    ? ({
                        ['--sep' as never]: dark
                          ? 'rgba(212, 169, 58, 0.35)'
                          : 'rgba(184, 149, 48, 0.35)',
                      } as React.CSSProperties)
                    : undefined
                }
              >
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute top-2 right-0 bottom-2 hidden w-px lg:block"
                    style={{
                      background: dark
                        ? 'rgba(212, 169, 58, 0.35)'
                        : 'rgba(184, 149, 48, 0.35)',
                    }}
                  />
                )}
                <dd
                  className="pmbc-display text-[56px] leading-[1] sm:text-[64px] lg:text-[72px]"
                  style={{ color: dark ? '#FFFFFF' : '#0F1B2D' }}
                >
                  {s.value}
                </dd>
                <div
                  aria-hidden
                  className="mx-auto mt-5 h-px w-[40px]"
                  style={{ background: dark ? '#D4A93A' : '#B89530' }}
                />
                <dt
                  className="mt-5 text-[11px] font-semibold uppercase"
                  style={{
                    letterSpacing: '0.18em',
                    color: dark ? v.textMuted : '#52606B',
                  }}
                >
                  {s.label}
                </dt>
              </div>
            );
          })}
        </dl>
      )}
    </SectionContainer>
  );
}
