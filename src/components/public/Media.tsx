import Image from 'next/image';

import {
  resolveMediaType,
  shouldBypassOptimizer,
  type MediaType,
} from '@/lib/media';

import { VideoMedia } from './VideoMedia';

export type MediaProps = {
  src: string;
  alt: string;
  /** Stored `*_media_type`. Omit to sniff from the URL. */
  mediaType?: unknown;
  /** Still frame shown before a video plays, and whenever motion is suppressed. */
  posterUrl?: string;
  autoplay?: boolean;
  loop?: boolean;
  controls?: boolean;
  /** Fill the nearest positioned ancestor, as `next/image`'s `fill` does. */
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  /**
   * Inline style for the media element itself. Exists for values a utility
   * class cannot carry because they are operator-set at runtime, such as the
   * CMS max-height ceiling.
   */
  style?: React.CSSProperties;
  priority?: boolean;
};

/**
 * One media slot on the public site, rendered according to what it actually is.
 *
 *  - image  `next/image`
 *  - gif    `next/image` with the optimizer bypassed, since re-encoding an
 *           animated file returns a single frozen frame
 *  - video  HTML5 `<video>`, muted and inline by default
 *
 * Callers keep their own framing (aspect box, gold border, object-cover) and
 * pass `fill` exactly as they would to `next/image`, so swapping a still for a
 * clip does not change any layout around it.
 */
export function Media({
  src,
  alt,
  mediaType,
  posterUrl = '',
  autoplay = true,
  loop = true,
  controls = false,
  fill = false,
  width,
  height,
  sizes,
  className = '',
  style,
  priority = false,
}: MediaProps) {
  if (!src) return null;

  const type: MediaType = resolveMediaType(src, mediaType);

  if (type === 'video') {
    return (
      <VideoMedia
        src={src}
        alt={alt}
        posterUrl={posterUrl}
        autoplay={autoplay}
        loop={loop}
        controls={controls}
        fill={fill}
        width={width}
        height={height}
        className={className}
        style={style}
      />
    );
  }

  const unoptimized = shouldBypassOptimizer(src, type);

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={className}
        style={style}
        priority={priority}
        unoptimized={unoptimized}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? 800}
      height={height ?? 600}
      sizes={sizes}
      className={className}
      style={style}
      priority={priority}
      unoptimized={unoptimized}
    />
  );
}
