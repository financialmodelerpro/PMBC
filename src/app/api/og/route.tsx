import { ImageResponse } from 'next/og';

import { fetchBranding } from '@/lib/cms/branding';
import { loadGoogleFont } from '@/lib/og/fonts';

export const runtime = 'nodejs';
// OG cards are dynamic — driven by query params and branding config.
export const dynamic = 'force-dynamic';

const WIDTH = 1200;
const HEIGHT = 630;

const FALLBACK_NAVY = '#0F2540';
const FALLBACK_GOLD = '#D4A93A';
const FALLBACK_BRAND = 'PaceMakers Business Consultants';
const FALLBACK_TAGLINE = 'Advisory from Structure to Exit';

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

async function loadLogoAsDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') ?? '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());

    if (ct.includes('svg') || /\.svg(\?|$)/i.test(url)) {
      // Convert SVG → PNG via sharp so satori can rasterize it. sharp is
      // already a dependency for OG/logo work per the stack list.
      const sharp = (await import('sharp')).default;
      const png = await sharp(buf).resize({ height: 80 }).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    }

    const mime = ct.includes('png')
      ? 'image/png'
      : ct.includes('jpeg') || ct.includes('jpg')
        ? 'image/jpeg'
        : ct.includes('webp')
          ? 'image/webp'
          : 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const titleQ = searchParams.get('title') ?? '';
  const subtitleQ = searchParams.get('subtitle') ?? '';

  // Pull branding for colors + brand name + logo. If the DB read fails
  // (unconfigured / network / etc.), fall through to hardcoded defaults so
  // the OG card always renders something on-brand.
  let primary = FALLBACK_NAVY;
  let accent = FALLBACK_GOLD;
  let brandName = FALLBACK_BRAND;
  let tagline = FALLBACK_TAGLINE;
  let logoUrl: string | null = null;

  try {
    const branding = await fetchBranding();
    if (branding) {
      // Use the deeper navy if primary is the lighter brand navy — gives
      // OG cards more contrast than the in-page primary.
      primary = branding.primary_color || FALLBACK_NAVY;
      if (primary.toLowerCase() === '#1b3a5f') primary = '#0F2540';
      accent = branding.accent_color || FALLBACK_GOLD;
      brandName = branding.brand_name || FALLBACK_BRAND;
      tagline = branding.tagline || FALLBACK_TAGLINE;
      logoUrl = branding.logo_dark_url || branding.logo_url || null;
    }
  } catch {
    // Ignore — use fallbacks.
  }

  const title = clamp(titleQ || brandName, 90);
  const subtitle = clamp(subtitleQ || tagline, 140);

  const logoDataUrl = await loadLogoAsDataUrl(logoUrl);

  // Fonts (parallel fetch).
  const [serif600, serif700, sans400, sans600] = await Promise.all([
    loadGoogleFont('Source Serif 4', 600),
    loadGoogleFont('Source Serif 4', 700),
    loadGoogleFont('Inter', 400),
    loadGoogleFont('Inter', 600),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          background: primary,
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Inter',
          position: 'relative',
        }}
      >
        {/* Gold hairline along the top */}
        <div
          style={{
            height: 6,
            width: '100%',
            background: accent,
            display: 'flex',
          }}
        />

        {/* Inner padding */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px 72px 56px 72px',
          }}
        >
          {/* Top row — logo or wordmark */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoDataUrl}
                alt={brandName}
                width={200}
                height={48}
                style={{ height: 48, objectFit: 'contain' }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Source Serif 4',
                  fontWeight: 700,
                  fontSize: 30,
                  letterSpacing: '-0.01em',
                }}
              >
                {brandName}
              </div>
            )}
          </div>

          {/* Center — eyebrow + headline + subtitle */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 980,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: accent,
                marginBottom: 22,
              }}
            >
              PaceMakers Business Consultants
            </div>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Source Serif 4',
                fontWeight: 700,
                fontSize: title.length > 50 ? 60 : title.length > 30 ? 72 : 84,
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
                color: '#FFFFFF',
              }}
            >
              {title}
            </div>
            {subtitle && (
              <div
                style={{
                  display: 'flex',
                  marginTop: 24,
                  fontSize: subtitle.length > 90 ? 24 : 28,
                  lineHeight: 1.35,
                  color: '#E8EEF5',
                  maxWidth: 880,
                  fontWeight: 400,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>

          {/* Bottom row — tagline + URL */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: `1px solid rgba(255,255,255,0.12)`,
              paddingTop: 28,
            }}
          >
            <div
              style={{
                display: 'flex',
                fontFamily: 'Source Serif 4',
                fontStyle: 'italic',
                fontWeight: 600,
                fontSize: 22,
                color: accent,
              }}
            >
              {tagline}
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 18,
                color: '#E8EEF5',
                letterSpacing: '0.04em',
              }}
            >
              pacemakersglobal.com
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: 'Source Serif 4', data: serif600, weight: 600, style: 'normal' },
        { name: 'Source Serif 4', data: serif700, weight: 700, style: 'normal' },
        { name: 'Inter', data: sans400, weight: 400, style: 'normal' },
        { name: 'Inter', data: sans600, weight: 600, style: 'normal' },
      ],
    },
  );
}
