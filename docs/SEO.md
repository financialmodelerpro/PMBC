# SEO and OG reference

Moved verbatim from `CLAUDE.md` on 2026-09-22 (original kept at `docs/archive/CLAUDE.md.bak-2026-09-22`). Contradictions found in the split were resolved to the current behaviour; each such line is noted in `docs/HISTORY.md` under 2026-09-22.

**Read this before:** changing metadata, OG images, the sitemap, robots or structured data.

## 8. SEO and OG

### Metadata

Per-page metadata via Next.js `generateMetadata`. Read from `cms_pages` (meta_title, meta_description, og_image_url) with sensible defaults from `site_settings`.

### OG Image Route

`/api/og/route.tsx` generates a dynamic OG card using `next/og` (satori). Default content reads from page_sections of the home page hero, falling back to cms_content, falling back to hardcoded brand defaults. Logo is fetched from branding_config.logo_url, converted SVG → PNG via sharp if needed, and embedded as base64.

Pattern matches FMP's `/api/og/main`. Image is 1200x630, navy background, white text, logo top-left, headline center, tagline below.

### Sitemap and Robots

`src/app/sitemap.ts` is rendered per request (`dynamic = 'force-dynamic'`) so the tool visibility switch and a collection's first row reach crawlers without a redeploy. It lists home, `/services`, `/sectors`, `/network`, `/about/ahmad-din`, `/fmp`, `/contact`, `/book`, `/privacy`, `/terms`, `/confidentiality`, the nine service pages, `/tools` and each Live tool (`toolSitemapPaths`), and `/team`, `/case-studies` and `/insights` (with their detail pages) only while their collection has rows. `/approach`, `/about` (301 to home), `/financial-modeler-pro` (301 to `/fmp`) and its three sub-pages are deliberately absent. The base URL is `NEXT_PUBLIC_SITE_URL`, falling back to `https://pacemakersglobal.com`.

`src/app/robots.ts` allows `/` and disallows `/admin`, `/api` and `/b/` (the booking short links), with the sitemap at `<base>/sitemap.xml`.

(Replaced on 2026-09-22 a snippet that still listed `/about` and `/financial-modeler-pro` and said the sitemap carried 19 URLs.)


### Structured Data

Add JSON-LD organization schema in root layout:

```typescript
const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'FinancialService',
  name: 'PaceMakers Business Consultants',
  url: 'https://pacemakersglobal.com',
  logo: 'https://pacemakersglobal.com/logo.png',
  description: 'Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates.',
  areaServed: ['Saudi Arabia', 'GCC', 'Worldwide'],
  // ... contact, address etc. from site_settings
};
```

---
