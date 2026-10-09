// Stand-in for next/image when a verifier renders a section to static markup
// outside Next. Keeps the props a layout assertion reads (src, alt, class and
// the fill positioning) and drops the optimiser.
import { createElement } from 'react';

export default function Image({ src, alt, fill, className, style, width, height }) {
  const fillStyle = fill
    ? { position: 'absolute', height: '100%', width: '100%', inset: 0, ...style }
    : style;
  return createElement('img', {
    src: String(src),
    alt,
    className,
    style: fillStyle,
    width: fill ? undefined : width,
    height: fill ? undefined : height,
    'data-fill': fill ? 'true' : undefined,
  });
}
