import Script from 'next/script';

const CALENDLY_SCRIPT_SRC = 'https://assets.calendly.com/assets/external/widget.js';

/**
 * Calendly inline booking widget.
 *
 * Renders the standard `.calendly-inline-widget` container that Calendly's
 * script hydrates in place, then loads that script through `next/script` with
 * the `lazyOnload` strategy. The container is server-rendered, so the page has
 * its final layout before any third-party code runs; the widget itself fills in
 * once the browser is idle.
 *
 * This is a server component on purpose. `next/script` handles the client-side
 * injection, so nothing here needs to ship as a client bundle, and the empty-URL
 * case is decided during the server render rather than after hydration.
 *
 * `url` is the full Calendly event URL and comes from `site_settings.booking_url`
 * so it is admin-editable. When it is empty this renders nothing, which lets the
 * caller show a fallback panel instead of an empty white box.
 */
export function CalendlyEmbed({
  url,
  minHeight = 700,
}: {
  url: string;
  /** Desktop floor in px. The widget grows on narrow viewports where Calendly stacks its steps. */
  minHeight?: number;
}) {
  if (!url) return null;

  return (
    <>
      <div
        className="calendly-inline-widget"
        data-url={url}
        style={{
          minWidth: 320,
          width: '100%',
          minHeight,
          height: `clamp(${minHeight}px, 90vh, 1100px)`,
          background: '#FFFFFF',
          border: '1px solid #E8E2D6',
          overflow: 'hidden',
        }}
      />
      <Script src={CALENDLY_SCRIPT_SRC} strategy="lazyOnload" />
    </>
  );
}
