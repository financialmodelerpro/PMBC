'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * HTML5 video for a CMS media slot.
 *
 * A client component for one reason only: `prefers-reduced-motion` cannot stop
 * an autoplaying video from CSS, so the decision has to be made in the browser.
 *
 * How the reduced-motion path works, and why it is not just `pause()`: pausing
 * leaves whatever frame the clip had reached on screen, which is usually a
 * meaningless mid-motion still. Calling `load()` afterwards resets the element
 * to its poster, which is the frame the operator chose. Controls are also
 * revealed in that state, so a viewer who suppressed motion globally can still
 * choose to watch this one clip.
 *
 * The initial render matches the server output (motion allowed), and the effect
 * corrects it after mount. That ordering avoids a hydration mismatch, at the
 * cost of a frame or two of playback for reduced-motion users before the effect
 * runs. Rendering the suppressed state first instead would mean the server
 * would have to know a per-user preference it cannot see.
 */
export function VideoMedia({
  src,
  alt,
  posterUrl = '',
  autoplay = true,
  loop = true,
  controls = false,
  fill = false,
  width,
  height,
  className = '',
  style,
}: {
  src: string;
  alt: string;
  posterUrl?: string;
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  /** Merged over the fill defaults, so a caller can set a height ceiling. */
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');

    const apply = () => {
      setReduced(mq.matches);
      const el = ref.current;
      if (!el) return;
      if (mq.matches) {
        el.pause();
        // Restores the poster frame. Without this the clip freezes wherever it
        // happened to be when the effect ran.
        el.load();
      }
    };

    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const fillClass = fill ? 'absolute inset-0 h-full w-full' : '';
  const combined = [fillClass, className].filter(Boolean).join(' ');
  const combinedStyle: React.CSSProperties | undefined =
    fill || style ? { ...(fill ? { objectFit: 'cover' as const } : null), ...style } : undefined;

  // A video that cannot load falls back to its poster, then to a neutral
  // panel. A broken media element with no fallback would leave a hole in the
  // layout on exactly the pages that most need to look finished.
  if (failed) {
    if (posterUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt={alt} className={combined} style={combinedStyle} />
      );
    }
    return (
      <div
        aria-label={alt || undefined}
        role={alt ? 'img' : undefined}
        className={combined}
        style={{ background: '#E8E2D6' }}
      />
    );
  }

  return (
    <video
      ref={ref}
      src={src}
      poster={posterUrl || undefined}
      // Muted is not optional: browsers refuse to autoplay audible video, so an
      // unmuted autoplay clip would simply never start.
      muted
      playsInline
      autoPlay={autoplay && !reduced}
      loop={loop}
      controls={controls || reduced}
      preload={posterUrl ? 'metadata' : 'auto'}
      aria-label={alt || undefined}
      className={combined}
      style={combinedStyle}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      onError={() => setFailed(true)}
    />
  );
}
