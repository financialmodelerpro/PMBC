import Link from 'next/link';

/** An absolute http(s) URL leaves the site. Anything else is an internal route. */
export function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * A CTA link that knows whether it is leaving the site.
 *
 * Off-site links open in a new tab with `rel="noopener noreferrer"`; internal
 * ones stay in `next/link` and keep client-side navigation. Both are needed:
 * `next/link` does not add a target for an absolute URL, so an operator who
 * pastes an FMP address into a CTA field gets a button that silently drops the
 * reader out of the site, while wrapping an internal route in a plain anchor
 * would give up the prefetch and the client transition.
 *
 * FeatureCards, FounderHero and FounderBlock already inline this same rule.
 * They are not converted here because their behaviour is already correct and
 * the change would be churn; move them onto this when next editing them.
 */
export function SectionLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} style={style}>
      {children}
    </Link>
  );
}
