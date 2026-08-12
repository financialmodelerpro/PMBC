'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { SectionContainer, SectionIntro } from '../SectionContainer';
import { Media } from '../Media';
import { RichText } from '@/components/public/RichText';
import { visibleListItems } from '@/lib/public/itemVisibility';
import { variantStyles, type PmbcVariant } from '@/lib/public/tokens';
import type { SectionMediaValue } from '@/lib/cms/sectionMedia';

/**
 * One audience at a time, on a card wide enough to carry an image beside the
 * copy.
 *
 * Replaces the three-across `service_cards` grid the "Who we serve" block used,
 * where each card was roughly 380px and had room for a title and four lines.
 * A single card takes the whole 1200px container, so each audience gets an
 * image and a paragraph that can actually describe the work.
 *
 * A client component, for two reasons that cannot be met in CSS: the timer that
 * advances the track, and `prefers-reduced-motion`, which has to suppress both
 * the automatic advance and the slide transition rather than merely slow them.
 * With motion reduced the arrows still work and the slide swaps instantly, so
 * the content stays fully reachable.
 *
 * Movement is right to left: the next card enters from the right edge, which is
 * the direction the eye is already travelling in this reading order.
 */

type Slide = {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
};

function s(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function pickSlides(raw: unknown): Slide[] {
  return visibleListItems(raw)
    .map((row) => {
      if (!row || typeof row !== 'object') return null;
      const o = row as Record<string, unknown>;
      const title = s(o.title);
      const description = s(o.description);
      if (!title && !description) return null;
      return {
        title,
        description,
        imageUrl: s(o.image_url),
        imageAlt: s(o.image_alt),
      };
    })
    .filter((x): x is Slide => x !== null);
}

/** Seconds between automatic advances, bounded so a stored 0 cannot busy-loop. */
function readInterval(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(s(raw));
  if (!Number.isFinite(n) || n <= 0) return 6;
  return Math.min(Math.max(n, 3), 30);
}

function initials(title: string): string {
  const parts = title.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AudienceCarousel({
  content,
  styles,
  variant = 'cream',
  media = null,
}: {
  content: Record<string, unknown>;
  styles: Record<string, unknown>;
  variant: PmbcVariant;
  media?: SectionMediaValue | null;
}) {
  const c = content ?? {};
  const eyebrow = s(c.eyebrow);
  const headline = s(c.headline);
  const intro = s(c.intro);
  const slides = pickSlides(c.items ?? c.cards);
  const intervalMs = readInterval(c.autoplay_seconds) * 1000;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const trackId = useId();
  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    // Motion reduced, hovered, focused, or nothing to advance to: no timer at
    // all rather than a timer whose callback returns early, so the tab is not
    // woken every few seconds for nothing.
    if (reduced || paused || count < 2) return;
    // Keyed on `index`, so a manual move restarts the wait rather than leaving
    // the next automatic advance a fraction of a second away.
    const id = window.setTimeout(() => go(index + 1), intervalMs);
    return () => window.clearTimeout(id);
  }, [reduced, paused, count, index, intervalMs, go]);

  if (count === 0 && !headline && !eyebrow) return null;

  const v = variantStyles(variant);
  const dark = variant === 'navy_deep';
  const arrowBase =
    'inline-flex h-11 w-11 items-center justify-center border transition duration-200';

  return (
    <SectionContainer variant={variant} styles={styles} media={media}>
      <SectionIntro
        eyebrow={eyebrow}
        headline={headline}
        intro={intro}
        variant={variant}
      />

      {count > 0 && (
        <div
          className={headline || eyebrow || intro ? 'mt-12' : ''}
          role="group"
          aria-roledescription="carousel"
          aria-label={headline || 'Who we serve'}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          // Focus anywhere inside also pauses: a keyboard user tabbing through
          // a card's link should not have it slide away mid-read.
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div className="overflow-hidden">
            <div
              id={trackId}
              // Stable hooks for scripts/verify-page-rhythm.mjs, which has to
              // find the track and the slides by something other than their
              // nesting depth: an extra wrapper would silently make it measure
              // the wrong element and report a pass.
              data-carousel-track=""
              className="flex"
              style={{
                transform: `translateX(-${index * 100}%)`,
                transition: reduced ? 'none' : 'transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {slides.map((slide, i) => (
                <div
                  key={i}
                  data-carousel-slide={i}
                  className="w-full shrink-0"
                  aria-hidden={i !== index}
                  // Off-screen slides keep their box but leave the tab order,
                  // so Tab does not travel into a card nobody can see.
                  inert={i !== index}
                >
                  <article
                    className="grid h-full items-stretch gap-0 md:grid-cols-[45fr_55fr]"
                    style={{
                      background: v.cardBg,
                      border: `1px solid ${v.cardBorder}`,
                      color: v.text,
                    }}
                  >
                    <div className="relative order-1 min-h-[200px] overflow-hidden md:min-h-[340px]">
                      {slide.imageUrl ? (
                        <Media
                          src={slide.imageUrl}
                          alt={slide.imageAlt || slide.title}
                          fill
                          sizes="(min-width: 768px) 540px, 100vw"
                          className="object-cover"
                        />
                      ) : (
                        // A card with no image yet is a monogram panel rather
                        // than a gap, so an unfinished slide still looks like
                        // part of the set.
                        <div
                          className="flex h-full w-full items-center justify-center"
                          style={{
                            background:
                              'radial-gradient(ellipse at 50% 35%, #1F4269 0%, #1B3A5F 60%, #14304F 100%)',
                          }}
                        >
                          <span
                            className="pmbc-display text-[44px]"
                            style={{ color: '#C69C3E' }}
                          >
                            {initials(slide.title)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="order-2 flex flex-col justify-center p-8 lg:p-12">
                      <div
                        aria-hidden
                        className="h-px w-[60px]"
                        style={{ background: dark ? '#C69C3E' : '#A88530' }}
                      />
                      {slide.title && (
                        <h3
                          className="pmbc-display mt-6 text-[26px] leading-[1.15] sm:text-[32px]"
                          style={{ color: v.text }}
                        >
                          {slide.title}
                        </h3>
                      )}
                      {slide.description && (
                        <p
                          className="mt-5 text-[16px] leading-[1.75] sm:text-[17px]"
                          style={{ color: v.textMuted }}
                        >
                          <RichText html={slide.description} as="span" />
                        </p>
                      )}
                    </div>
                  </article>
                </div>
              ))}
            </div>
          </div>

          {count > 1 && (
            <div className="mt-7 flex items-center justify-between gap-6">
              <div className="flex items-center gap-2" aria-hidden>
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className="h-px transition-all duration-300"
                    style={{
                      width: i === index ? 34 : 16,
                      background:
                        i === index
                          ? dark
                            ? '#C69C3E'
                            : '#A88530'
                          : dark
                            ? 'rgba(232,221,196,0.3)'
                            : 'rgba(27,58,95,0.22)',
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <p
                  className="text-[11px] font-semibold uppercase"
                  style={{
                    letterSpacing: '0.16em',
                    color: dark ? 'rgba(232,221,196,0.7)' : v.textMuted,
                  }}
                >
                  {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
                </p>
                <button
                  type="button"
                  aria-label="Previous"
                  aria-controls={trackId}
                  onClick={() => go(index - 1)}
                  className={
                    arrowBase +
                    (dark
                      ? ' border-[#E8DDC4]/35 text-[#E8DDC4] hover:border-[#C69C3E] hover:text-[#C69C3E]'
                      : ' border-[#1B3A5F]/25 text-[#1B3A5F] hover:border-[#1B3A5F] hover:bg-[#1B3A5F] hover:text-white')
                  }
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  aria-controls={trackId}
                  onClick={() => go(index + 1)}
                  className={
                    arrowBase +
                    (dark
                      ? ' border-[#E8DDC4]/35 text-[#E8DDC4] hover:border-[#C69C3E] hover:text-[#C69C3E]'
                      : ' border-[#1B3A5F]/25 text-[#1B3A5F] hover:border-[#1B3A5F] hover:bg-[#1B3A5F] hover:text-white')
                  }
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </SectionContainer>
  );
}
