// Stand-in for next/link when a verifier renders a section to static markup
// outside Next. Renders a plain anchor with the same props.
import { createElement } from 'react';

export default function Link({ href, children, prefetch: _prefetch, ...rest }) {
  void _prefetch;
  return createElement('a', { href: String(href), ...rest }, children);
}
