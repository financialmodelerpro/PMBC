import { Media } from './Media';
import { PORTRAIT_OBJECT_POSITION } from '@/lib/public/portrait';

/** Up to two initials. Words after a comma ("Muhammad Shahjahan, ACMA") are a suffix, not a name. */
export function profileInitials(name: string): string {
  const parts = name.split(',')[0].trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * The one portrait frame every team profile uses: the profile page heroes, the
 * founding partner's card on /team and every member card.
 *
 * A 4:5 photo with square corners, filling the frame (object-fit cover, so no
 * gap or edge line at any width), inside a thin gold hairline offset 8px, with
 * a solid accent square over the bottom-right corner. With no photo, a navy
 * panel carries the member's initials in gold, so a profile without a portrait
 * is presentable rather than unfinished.
 *
 * `accent` picks the corner colour for the background the frame sits on: gold
 * on navy sections, navy on white and cream ones. Everything else is fixed, so
 * every member renders to the same standard. Nothing in here rounds a corner;
 * keep it that way.
 */
export function ProfilePhoto({
  name,
  src,
  alt,
  accent,
  sizes,
  priority = false,
  media,
}: {
  name: string;
  src: string | null | undefined;
  alt?: string;
  accent: 'gold' | 'navy';
  sizes: string;
  priority?: boolean;
  /** Stored media settings, for a hero whose portrait slot holds a video. */
  media?: {
    mediaType?: unknown;
    posterUrl?: string;
    autoplay?: boolean;
    loop?: boolean;
    controls?: boolean;
  };
}) {
  return (
    <div className="relative aspect-[4/5] w-full">
      <div aria-hidden className="absolute -inset-2 border border-[#C69C3E]" />
      <div
        aria-hidden
        className="absolute -right-2 -bottom-2 h-8 w-8"
        style={{ background: accent === 'gold' ? '#C69C3E' : '#1B3A5F' }}
      />
      <div className="relative aspect-[4/5] w-full overflow-hidden" style={{ background: '#1B3A5F' }}>
        {src ? (
          <Media
            src={src}
            alt={alt || name || 'Portrait'}
            mediaType={media?.mediaType}
            posterUrl={media?.posterUrl}
            autoplay={media?.autoplay}
            loop={media?.loop}
            controls={media?.controls}
            fill
            priority={priority}
            sizes={sizes}
            className="object-cover"
            style={{ objectPosition: PORTRAIT_OBJECT_POSITION }}
          />
        ) : (
          // The panel is a size container so the initials scale with the frame:
          // 80px in a profile hero, smaller on a member card.
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center [container-type:inline-size]"
          >
            <span className="pmbc-display text-[clamp(40px,24cqw,80px)] tracking-tight text-[#C69C3E]">
              {profileInitials(name)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
