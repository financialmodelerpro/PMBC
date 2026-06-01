# PaceMakers Business Consultants — Technical Handoff

This document is the source of truth for building the PMBC website. It is written for Claude Code to use as project context. Drop this file at the root of the repository as `CLAUDE.md` and Claude Code will read it on every session.

The patterns below mirror Financial Modeler Pro (FMP) where they make sense, but PMBC is a fully separate codebase, separate Supabase project, and separate Vercel deployment. There is no shared infrastructure between PMBC and FMP. The two sites are linked only by hyperlinks in their public content.

---

## 1. Project Identity

| Item | Value |
|------|-------|
| Project | PaceMakers Business Consultants website |
| Parent entity | PaceMakers Business Consultants LLP |
| Domain | pacemakersglobal.com |
| GitHub | financialmodelerpro/PMBC |
| Vercel project | pmbc |
| Hosting | Vercel |
| Database | Supabase (new project, separate from FMP) |
| Email | Resend (new sender domain or shared with FMP, decision pending) |
| Tagline | Advisory from Structure to Exit |
| Positioning | Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates |
| Primary audience | Family offices, investment offices, real estate developers, corporates running M&A or valuation mandates |
| Build path | Self-built by Ahmad Din using Claude Code |

PMBC is the parent entity. Financial Modeler Pro is its flagship platform. The website's job is to convert referred prospects into conversations. It is a credibility document, not an inbound lead engine. Volume is not the metric. Quality of inbound is.

---

## Content Style Rules

These rules apply to **all** PMBC content: public copy, admin-facing strings, fallback text, error messages, email templates, migrations seeding `cms_content` or `page_sections`, button labels, hero subtitles, every JSONB blob. Anything a human reader could see, in either the public site or the admin console.

1. **No em dashes (—).** Do not use the em dash anywhere. Replace with a comma, parenthesis, period, or colon depending on the relationship being expressed:
   - **Pause / aside** (where you'd reach for an em dash): use a comma or parentheses. *"Senior-led, analytically grounded."* not *"Senior-led — analytically grounded."*
   - **Strong break / new clause:** start a new sentence. *"We model. We advise."* not *"We model — we advise."*
   - **List intro / explanation:** use a colon. *"Three things matter: clarity, rigor, judgment."* not *"Three things matter — clarity, rigor, judgment."*
   - **Range** (where en dashes are sometimes used): write out the range words. *"4 to 6 weeks"* not *"4–6 weeks"* — and never *"4 — 6 weeks"*.

   This applies to drafts you write yourself, content you generate during admin/page-builder workflows, fallback copy in route files, error pages (`not-found.tsx`, `error.tsx`), email subject and body templates, admin UI labels, badge text, captions, and alt text. Every string you author. When you find an em dash in *existing* content while doing other work, fix it as part of that work; don't carve out separate em-dash-only PRs.

2. **No en dashes (–) in prose.** Same fix as em dash. Acceptable only inside numeric date ranges where the format requires it (rare in PMBC content), or inside copy the user explicitly hands over verbatim.

Why this matters: PMBC is intentionally institutional, considered, calm. The em dash reads as energetic and digital-marketing-flavored, which is exactly the tone we are NOT going for. The substitutions above produce copy that scans as deliberate and senior. If a sentence feels like it *needs* an em dash, the sentence is usually doing too much; split it.

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Scaffold + DB | ✅ Complete (2026-04-30) | Next.js 15 + Supabase migrations 001-008 applied. |
| Phase 2 — Auth + Admin Shell | ✅ Complete (2026-05-02) | NextAuth credentials provider, middleware, login page, admin layout + sidebar, empty dashboard. Login verified end-to-end. |
| Phase 3 — CMS Foundations | ✅ Complete (2026-05-02) | Six admin editors (branding, content, header settings, site settings, email branding, email templates), six API routes (all session-gated, all audit-logged). |
| Phase 4 — Page Builder | ✅ Complete (2026-05-02) | `/admin/pages`, three-pane `/admin/page-builder/[slug]` with dnd reorder + visibility + delete, four section editors (hero, paragraphs, stats_block, service_cards), public `/[slug]` route + home wired up. |
| Phase 4.5 — Admin Refactor (FMP alignment) | ✅ Complete (2026-05-02) | New `CmsAdminNav` (240/64 collapse, off-canvas, gold-accent active border, matchPaths, external links to live site + FMP). Tailwind→inline styles across all admin pages with shared tokens at `src/lib/admin/styles.ts`. API routes accept both `PATCH` and `POST`; `cms_content` GET added; branding mutations return `{ row }`. `(header_settings, config)` JSON blob split into discrete keys via migration 009. |
| Phase 5 — Public Pages (core) | ✅ Complete (2026-05-03) | Public root layout with CMS-driven Navbar + Footer, fonts (Inter + Source Serif 4) wired via `next/font`, services overview with config-driven 9-card grid, contact page + form + `/api/contact` route, Resend wrapper with graceful fallback, branded email shell, hardcoded Privacy + Terms. |
| Phase 6 — Remaining Section Types | ✅ Complete (2026-05-03) | Public renderers + admin editors for the 9 outstanding types: sector_grid, process_steps, network_partners, founder_block, text_image, cta_block, quote, fmp_intro, service_detail. Curated 21-icon lucide registry shared between sector editor + renderer. `SECTION_TYPES` now has `implemented: true` for all 13 types. |
| Phase 7 — Remaining Pages | ✅ Complete (2026-05-03) | Bespoke routes for /about, /sectors, /approach, /network, /financial-modeler-pro replace the catch-all `[slug]`. New `/services/[slug]` route renders all 9 service details from `cms_content` namespace `service_<slug>`. Migration 010 seeds 36 rows (4 fields × 9 services). `/admin/content` groups the service-prefixed sections into a "Service detail content" block. `sitemap.ts` lists all 19 public URLs; `robots.ts` blocks /admin and /api. `title: { absolute }` fix removes doubled brand suffix from `<title>` across bespoke pages. `/contact?service=<slug>` pre-selects the service dropdown at SSR. |
| Phase 8 — SEO & Polish | ✅ Complete (2026-05-03) | Dynamic OG image route at `/api/og` (navy/gold satori card with branding-driven logo + tagline). Shared `buildPageMetadata` helper drives unique `<title>` / canonical / OG / twitter meta on every public page, auto-routing OG images to `/api/og?title=…&subtitle=…` when no override is set. Schema.org `@graph` with FinancialService + Organization + WebSite mounted in the public layout; per-service `Service` JSON-LD on `/services/[slug]` with `provider: { @id: '#organization' }`. Branded 404 (both `(public)` and root) and `error.tsx` boundary. Privacy + Terms fleshed out with named processors and "Subject to legal review" badge. `next.config.ts` adds Supabase + Cloudinary `remotePatterns` and `poweredByHeader: false`. `/admin/og-preview` admin tool shows live previews for every page with per-page override-URL save. |
| Phase 9 — Content Population & Launch | 🟡 In progress | Page content COMPLETE (2026-06-01). Home (2026-05-03) + about, sectors, approach, network, financial-modeler-pro, services overview, contact all seeded via migrations 014-020 (+ companion `scripts/seed-<page>-page.mjs`). 9 service-detail pages kept their substantive migration-010 copy (verified rendering). All 19 public routes 200, 0 em dashes. Remaining is launch ops only: `/admin/contact-submissions` inbox, DNS + SSL on Vercel, production env vars, sitemap to Search Console, counsel review of Privacy/Terms, rotate `Admin@2026`. See SESSION_LOG.md 2026-06-01 entry. |
| Phase 9.5 — Visual Polish (boutique private bank aesthetic) | ✅ Complete (2026-05-06) | Refined design tokens (#153D64 primary navy, #0F2F4F deep navy, #FAF7F2 cream surface, #D4A93A gold, #B89530 muted gold, #E8DDC4 cream-on-navy text). New `src/lib/public/tokens.ts` + `SectionContainer` / `SectionIntro` primitives. All 13 section renderers redesigned around three background variants (`navy_deep` / `cream` / `white`); SectionRenderer extended with sequence-aware variant resolution so home page rhythm is automatic without DB changes. Hero is 88vh navy_deep with radial gradient, gold hairline, 80px serif headline, gold-bordered CTAs, scroll chevron. FounderBlock has gold-framed photo + navy accent corner + monogram fallback. StatsBlock uses 72px serif numbers with gold dividers. Process steps render in deep navy with gold connectors. Quote is editorial italic serif with 80px gold quote mark. Navbar refined with gold underline-on-hover and PM monogram fallback; Footer reframed at #0F2F4F with small-caps gold column headlines and italic-serif tagline. No content schema changes; all 11 public routes verified 200 in dev, build + typecheck clean. |

**Working admin login (local dev):** `meetahmadch@gmail.com` / `Admin@2026`. This is a debug-only password — must be rotated to a strong production credential before launch. Use `npm run seed-admin` (after editing `ADMIN_PASSWORD` in `scripts/seed-admin.mjs`) to rotate.

---

## 2. Architecture Overview

Single Next.js application, single domain (pacemakersglobal.com), no subdomain routing. Public marketing site plus admin CMS. No student auth, no public registration, no payment flows, no third-party integrations beyond Resend and Supabase.

### Stack

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | Next.js (App Router) | ^15 | Latest stable. Match FMP's discipline but no need for v16 features. |
| Language | TypeScript strict | ^5 | strict mode on |
| Styling | Tailwind CSS 4 | ^4 | Same as FMP |
| State | Zustand | ^5 | Only if needed; most pages are server components |
| Database | Supabase (@supabase/supabase-js) | ^2 | New project, separate from FMP |
| Auth | NextAuth.js (JWT, admin-only) | ^4 | Single admin role, no public users |
| Email | Resend | ^6 | Contact form notifications |
| Image | sharp | ^0.34 | OG image logo conversion |
| OG Images | next/og (satori ImageResponse) | built-in | Dynamic OG cards |
| Icons | lucide-react | ^1 | Lucide moved to a 1.x major in 2024. v1.x is current and correct — do **not** "downgrade" to 0.x. |
| Forms | react-hook-form + zod | latest | Contact form validation |
| Rich Text | @tiptap/react | latest | Admin content editing |
| Captcha | @hcaptcha/react-hcaptcha | ^2 | Contact form spam protection |
| Passwords | bcryptjs | ^3 | Admin password hashing |

### Explicitly NOT Used in v1

The following are in FMP but NOT in PMBC v1. Do not install them. They add maintenance burden without value for a credibility site.

| Excluded | Reason |
|----------|--------|
| Google Apps Script | No external roster system |
| pdf-lib, @react-pdf/renderer | No certificate generation |
| exceljs | No spreadsheet export |
| Recharts | No data visualizations |
| @anthropic-ai/sdk | No AI features in v1 |
| YouTube API | No video integration |
| @auth/supabase-adapter for student auth | Admin-only auth |
| Stripe or any payment SDK | No commerce |
| Cron jobs | Nothing to run on schedule |

### Folder Structure

```
src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx                    # Home
│   │   ├── services/page.tsx           # Services overview
│   │   ├── services/[slug]/page.tsx    # Individual service detail
│   │   ├── sectors/page.tsx            # Sector coverage
│   │   ├── approach/page.tsx           # Engagement methodology
│   │   ├── network/page.tsx            # Sky Gulf, Lynkers
│   │   ├── about/page.tsx              # Firm and founder
│   │   ├── contact/page.tsx            # Contact form
│   │   ├── financial-modeler-pro/page.tsx   # FMP introduction page
│   │   ├── privacy/page.tsx            # Privacy policy
│   │   └── terms/page.tsx              # Terms of engagement
│   ├── admin/
│   │   ├── login/page.tsx
│   │   ├── page.tsx                    # Dashboard
│   │   ├── pages/page.tsx              # List all CMS pages
│   │   ├── page-builder/[slug]/page.tsx
│   │   ├── content/page.tsx            # Key-value CMS editor
│   │   ├── branding/page.tsx           # Logo, colors, footer
│   │   ├── header-settings/page.tsx
│   │   ├── contact-submissions/page.tsx
│   │   ├── email-branding/page.tsx
│   │   ├── email-templates/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── contact/route.ts
│   │   ├── og/route.tsx
│   │   ├── admin/
│   │   │   ├── pages/route.ts
│   │   │   ├── page-sections/route.ts
│   │   │   ├── content/route.ts
│   │   │   ├── branding/route.ts
│   │   │   ├── contact-submissions/route.ts
│   │   │   └── ...
│   ├── layout.tsx                      # Root layout
│   ├── globals.css
│   └── not-found.tsx
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── NavbarServer.tsx
│   │   ├── Footer.tsx
│   │   └── FooterServer.tsx
│   ├── public/
│   │   ├── Hero.tsx
│   │   ├── StatsBlock.tsx
│   │   ├── ServiceCards.tsx
│   │   ├── SectorGrid.tsx
│   │   ├── ProcessSteps.tsx
│   │   ├── NetworkPartners.tsx
│   │   ├── FounderBlock.tsx
│   │   ├── TextImage.tsx
│   │   ├── ContactForm.tsx
│   │   └── ...
│   ├── admin/
│   │   ├── PageBuilder.tsx
│   │   ├── SectionEditor.tsx
│   │   ├── editors/
│   │   │   ├── HeroEditor.tsx
│   │   │   ├── StatsEditor.tsx
│   │   │   ├── ServiceCardsEditor.tsx
│   │   │   ├── SectorGridEditor.tsx
│   │   │   ├── ProcessStepsEditor.tsx
│   │   │   ├── NetworkPartnersEditor.tsx
│   │   │   ├── FounderEditor.tsx
│   │   │   ├── TextImageEditor.tsx
│   │   │   └── ParagraphsEditor.tsx
│   │   ├── ContactSubmissionsTable.tsx
│   │   └── ...
│   └── ui/                             # Shared primitives
├── lib/
│   ├── supabase/
│   │   ├── server.ts                   # Server client factory
│   │   └── client.ts                   # Browser client (rare use)
│   ├── auth/
│   │   ├── config.ts                   # NextAuth config
│   │   └── middleware.ts               # Admin route protection
│   ├── cms/
│   │   ├── content.ts                  # cms_content fetchers
│   │   ├── pages.ts                    # page_sections fetchers
│   │   └── branding.ts                 # branding_config fetcher
│   ├── email/
│   │   ├── send.ts                     # Resend wrapper
│   │   ├── templates/
│   │   │   ├── _base.ts                # baseLayoutBranded()
│   │   │   ├── contactNotification.ts
│   │   │   └── contactAcknowledgement.ts
│   │   └── branding.ts
│   ├── og/
│   │   └── logo.ts                     # SVG to PNG via sharp
│   └── utils/
│       ├── slugify.ts
│       ├── format.ts
│       └── seo.ts
├── config/
│   ├── site.ts                         # Static config (URLs, defaults)
│   ├── navigation.ts                   # Default nav items
│   └── services.ts                     # Service definitions (slug, title, summary)
├── types/
│   ├── cms.ts
│   ├── pages.ts
│   ├── auth.ts
│   └── database.ts                     # Generated Supabase types
└── middleware.ts                       # Admin route protection
```

---

## 3. Database Schema

PMBC uses a single Supabase project. All tables below live in the `public` schema. Migrations are numbered starting at 001 and applied in order via the Supabase dashboard SQL editor or CLI.

### Migration Numbering

Match FMP's pattern: three-digit prefix (`001_initial_schema.sql`, `002_admin_users.sql`, etc.), each migration is one logical change, never edit a migration after it's been applied. Keep all migrations in `supabase/migrations/`.

### Tables

#### Admin and Auth

**admin_users**
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

Single admin user for v1 (Ahmad). The role column exists for future use (editor, viewer) but only `admin` is implemented. Seed one row manually via SQL after running migrations.

**audit_log**
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_admin_id ON audit_log(admin_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
```

#### CMS

**cms_content**
```sql
CREATE TABLE cms_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section, key)
);

CREATE INDEX idx_cms_content_section ON cms_content(section);
```

Key-value store for global content that doesn't belong to a specific page section. Sections include `header_settings`, `footer_settings`, `branding`, `contact_info`, `seo_defaults`. All values are stored as TEXT; JSON is stored as stringified JSON.

**cms_pages**
```sql
CREATE TABLE cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  og_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Page metadata. One row per CMS-managed page (home, services, sectors, approach, network, about, contact, financial-modeler-pro). Status values: `draft`, `published`.

**page_sections**
```sql
CREATE TABLE page_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug TEXT NOT NULL,
  section_type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  styles JSONB DEFAULT '{}',
  display_order INTEGER NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_page_sections_page_slug ON page_sections(page_slug, display_order);
CREATE INDEX idx_page_sections_visible ON page_sections(page_slug, visible, display_order);
```

The page builder. One row per section on a page. `section_type` determines which renderer is used. `content` holds the section data as JSONB. `styles` holds optional layout overrides.

**Section types for v1:**
- `hero` — main page hero with badge, headline, subtitle, CTA
- `stats_block` — large number callouts (100+, SAR 20B+, etc.)
- `service_cards` — grid of service cards with number, title, description, link
- `service_detail` — full detail block for a single service (used on /services/[slug])
- `sector_grid` — sector coverage grid
- `process_steps` — numbered methodology steps
- `network_partners` — Sky Gulf and Lynkers blocks
- `founder_block` — founder photo, name, credentials, bio
- `text_image` — alternating text-image rows
- `paragraphs` — rich text paragraphs (Tiptap-rendered HTML)
- `cta_block` — single call-to-action panel
- `quote` — pull quote with attribution
- `fmp_intro` — Financial Modeler Pro introduction block (one specific section type for the FMP page)

#### Branding and Settings

**branding_config**
```sql
CREATE TABLE branding_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_url TEXT,
  logo_dark_url TEXT,
  favicon_url TEXT,
  brand_name TEXT NOT NULL DEFAULT 'PaceMakers Business Consultants',
  short_name TEXT NOT NULL DEFAULT 'PaceMakers',
  tagline TEXT NOT NULL DEFAULT 'Advisory from Structure to Exit',
  primary_color TEXT NOT NULL DEFAULT '#1B3A5F',
  secondary_color TEXT NOT NULL DEFAULT '#3FA663',
  accent_color TEXT NOT NULL DEFAULT '#D4A93A',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO branding_config (id) VALUES (1);
```

Single-row table. The `CHECK (id = 1)` guarantees only one row ever exists. Edit via admin panel.

**site_settings**
```sql
CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (id, settings) VALUES (1, '{}');
```

Catch-all for global settings: contact email, WhatsApp number, social URLs, default OG image, GTM/analytics IDs, etc. Stored as a single JSONB blob to avoid migration churn.

#### Forms and Communication

**contact_submissions**
```sql
CREATE TABLE contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  country TEXT,
  service_interest TEXT,
  message TEXT NOT NULL,
  source_page TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_contact_submissions_status ON contact_submissions(status, created_at DESC);
CREATE INDEX idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
```

Status values: `new`, `read`, `responded`, `archived`. Notes field is admin-only for tracking follow-ups.

**email_branding**
```sql
CREATE TABLE email_branding (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#1B3A5F',
  signature_html TEXT,
  footer_html TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO email_branding (id) VALUES (1);
```

**email_templates**
```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

For v1, only two template_key rows are needed: `contact_notification` (sent to admin when someone submits the contact form) and `contact_acknowledgement` (sent to the person who submitted). Both editable via admin panel.

### Migration Order

```
001_initial_schema.sql            -- admin_users, audit_log
002_cms_tables.sql                -- cms_content, cms_pages, page_sections
003_branding_settings.sql         -- branding_config, site_settings
004_contact_email.sql             -- contact_submissions, email_branding, email_templates
005_seed_default_pages.sql        -- INSERT cms_pages rows for all v1 pages
006_seed_default_content.sql      -- INSERT cms_content rows for header/footer/contact
007_seed_default_sections.sql     -- INSERT page_sections placeholders
008_seed_email_templates.sql      -- INSERT email template rows
009_split_header_settings.sql     -- Split (header_settings, config) JSON blob into
                                  --   (header_settings, nav_items)            JSON array
                                  --   (header_settings, cta_label / cta_href) text
                                  --   (header_settings, show_cta)             text bool
                                  --   (header_settings, mobile_menu_enabled)  text bool
                                  -- Idempotent. Migrates any existing blob, then drops it.
```

After running migrations, manually insert one admin_users row via SQL with a bcrypt hash for the password.

---

## 4. CMS Architecture

### Two-Layer Pattern

PMBC uses the same two-layer CMS pattern as FMP:

**Layer 1: cms_content (key-value)** — for content that doesn't belong to a specific page or section. Logo URLs, brand name, contact email, footer copyright, default SEO description, social URLs. Section + key + value structure. Read once, cached for the request.

**Namespace convention:** one row per atomic key. JSON-array values (e.g. `(header_settings, nav_items)`) are allowed when the value is naturally a list, but discrete keys are preferred over bundled JSON blobs — `(header_settings, cta_label)`, `(header_settings, show_cta)`, etc., not a single `config` row that contains all of them. Migration 009 splits the legacy `config` blob accordingly.

**Layer 2: page_sections (block-based)** — for the main body content of each page. One row per content block, ordered by `display_order`, rendered through a section-type registry. Editable via drag-and-drop page builder.

### Section Renderer Pattern

```typescript
// src/components/public/SectionRenderer.tsx
import { Hero } from './Hero';
import { StatsBlock } from './StatsBlock';
import { ServiceCards } from './ServiceCards';
// ... other section components

const SECTION_REGISTRY = {
  hero: Hero,
  stats_block: StatsBlock,
  service_cards: ServiceCards,
  sector_grid: SectorGrid,
  process_steps: ProcessSteps,
  network_partners: NetworkPartners,
  founder_block: FounderBlock,
  text_image: TextImage,
  paragraphs: Paragraphs,
  cta_block: CtaBlock,
  quote: Quote,
  fmp_intro: FmpIntro,
};

export function SectionRenderer({ section }) {
  const Component = SECTION_REGISTRY[section.section_type];
  if (!Component) return null;
  return <Component content={section.content} styles={section.styles} />;
}
```

### Page Renderer Pattern

```typescript
// src/app/(public)/services/page.tsx
import { fetchPageSections } from '@/lib/cms/pages';
import { SectionRenderer } from '@/components/public/SectionRenderer';

export default async function ServicesPage() {
  const sections = await fetchPageSections('services');
  return (
    <main>
      {sections.map(s => <SectionRenderer key={s.id} section={s} />)}
    </main>
  );
}
```

### CMS Fetchers

```typescript
// src/lib/cms/pages.ts
export async function fetchPageSections(slug: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('page_sections')
    .select('*')
    .eq('page_slug', slug)
    .eq('visible', true)
    .order('display_order', { ascending: true });
  return data || [];
}

// src/lib/cms/content.ts
export async function fetchContentBySection(section: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cms_content')
    .select('key, value')
    .eq('section', section);
  return Object.fromEntries((data || []).map(r => [r.key, r.value]));
}
```

### Editor Pattern

Each section type has a corresponding editor component in `src/components/admin/editors/`. The page-builder admin page renders the list of sections for a given page slug, allows reordering via drag-and-drop, and opens the appropriate editor when a section is clicked.

Editors should:
- Accept a `content` JSONB blob and an `onChange` callback
- Validate input client-side with zod schemas
- Auto-save every 2 seconds of inactivity, OR on explicit Save button (FMP uses both patterns; pick one and stay consistent)
- Show a preview of the rendered section beneath the form

---

## 5. Public Pages

### Sitemap

| URL | Page slug | Purpose |
|-----|-----------|---------|
| `/` | home | Firm overview, what PMBC does, headline credentials, CTA to services and contact |
| `/services` | services | Overview of all 9 services with cards linking to detail pages |
| `/services/[slug]` | service-{slug} | Detail page for one service. Slugs from config/services.ts |
| `/sectors` | sectors | Sector coverage grid with descriptions |
| `/approach` | approach | Engagement methodology (Understand → Analyse → Model → Advise) |
| `/network` | network | Sky Gulf and Lynkers detail. Why the network matters. |
| `/about` | about | The firm. Founder section. Link out to FMP for full Ahmad bio. |
| `/financial-modeler-pro` | financial-modeler-pro | Full page introducing FMP, ending in CTA to visit FMP |
| `/contact` | contact | Contact form, direct contact info |
| `/privacy` | privacy | Privacy policy (static, hardcoded for v1) |
| `/terms` | terms | Terms of engagement (static, hardcoded for v1) |

### Service Slugs

```typescript
// src/config/services.ts
export const SERVICES = [
  { slug: 'financial-modeling', number: '01', title: 'Financial Modeling' },
  { slug: 'business-valuation', number: '02', title: 'Business Valuation' },
  { slug: 'financial-due-diligence', number: '03', title: 'Financial Due Diligence' },
  { slug: 'transaction-advisory', number: '04', title: 'Transaction Advisory' },
  { slug: 'mergers-acquisitions', number: '05', title: 'M&A Advisory' },
  { slug: 'real-estate-modeling', number: '06', title: 'Real Estate Modeling' },
  { slug: 'project-finance', number: '07', title: 'Project Finance' },
  { slug: 'investment-memorandums', number: '08', title: 'Investment Memorandums' },
  { slug: 'cfo-advisory', number: '09', title: 'CFO Advisory' },
];
```

### Navigation

Top nav (desktop): Services · Sectors · Approach · Network · About · Contact
Top nav (mobile): hamburger menu with same items
Persistent CTA in nav: "Start a Conversation" → links to /contact

Footer columns:
- **About**: short PMBC description, tagline
- **Services**: links to all 9 service pages
- **Firm**: Approach, Network, About, FMP page, Contact
- **Contact**: email, WhatsApp, location strip
- **Legal**: Privacy, Terms

---

## 6. Admin Panel

### Auth

NextAuth credentials provider, JWT sessions (1 hour), single admin role. Login at `/admin/login`. All `/admin/*` routes (except login) protected by middleware that checks for valid session with `role=admin`.

```typescript
// src/middleware.ts
export const config = {
  matcher: ['/admin/:path*'],
};

export default async function middleware(req) {
  if (req.nextUrl.pathname === '/admin/login') return NextResponse.next();
  const token = await getToken({ req });
  if (!token || token.role !== 'admin') {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
}
```

### Admin Pages

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard: recent contact submissions, page count, last updated timestamps |
| `/admin/pages` | List all CMS pages with edit links |
| `/admin/page-builder/[slug]` | Drag-and-drop section editor for one page |
| `/admin/content` | Key-value editor for cms_content (grouped by section) |
| `/admin/branding` | Logo, brand name, tagline, color tokens |
| `/admin/header-settings` | Header-specific settings |
| `/admin/contact-submissions` | List and view contact form submissions, change status, add notes |
| `/admin/email-branding` | Email logo, signature, footer |
| `/admin/email-templates` | Edit email subject and body for the two templates |
| `/admin/settings` | Misc site settings (analytics IDs, social URLs, etc.) |

### Sidebar (`src/components/admin/CmsAdminNav.tsx`)

Single component handling both desktop and mobile chrome (no separate `AdminSidebar` / `AdminMobileNav` / `LogoutButton` components — those were collapsed into this one in Phase 4.5).

- 240px expanded · 64px collapsed (icons only)
- Collapse persisted to `localStorage['pmbcAdminSidebarCollapsed']`
- Scroll position persisted to `sessionStorage['admin_sidebar_scroll']`, restored on `pathname` change
- Off-canvas drawer below 768px viewport with hamburger button + body-scroll lock + click-backdrop-to-close
- Active state by exact-match OR prefix-match against per-item `matchPaths` (e.g. "Pages" stays highlighted while inside `/admin/page-builder/...`)
- Active item gets `#1B3A5F` background + **3px gold (`#D4A93A`) left border**
- Group dividers labeled `Content` / `Inbox` / `Email` / `System`
- Footer: external links to `https://www.pacemakersglobal.com` (View Live Site) and `https://www.financialmodelerpro.com` (Visit FMP), both `target="_blank"`. Sign-out lives below those.

### Admin styling

All admin pages use **inline styles**, not Tailwind utility classes. Shared design tokens live in `src/lib/admin/styles.ts` — colors, layout constants, and ready-made `CSSProperties` presets (`adminCard`, `adminInput`, `adminButtonPrimary`, etc.). This intentionally isolates the admin console from the public-site theme so future public-site work can't accidentally restyle the dashboard. The PMBC palette (deep navy `#0F2540` sidebar, navy `#1B3A5F` primary, gold `#D4A93A` accent, page bg `#F4F7FC`) is anchored here.

### Admin API conventions

- All `/api/admin/*` routes session-gate via `getAdminSession()` (401 if absent), zod-validate the body, and write an `audit_log` row on success.
- Mutations accept both `PATCH` (FMP-style) and `POST` (legacy alias) on `/api/admin/{content,branding,settings,email-branding,email-templates,header-settings}`.
- `/api/admin/content` GET returns `{ rows: [...] }`; PATCH does upsert (try update, then insert) on `(section, key)` pairs.
- `/api/admin/branding` GET returns `{ row: ... }`; mutations return the updated row in `{ row: ... }`.
- Errors always: `{ error: string }` + non-2xx status.

### Page Builder

Three-pane layout matching FMP's pattern:
- **Left pane**: list of sections on the current page with drag handles, visibility toggle, delete button, and "Add Section" button at bottom
- **Center pane**: editor for the currently selected section (the appropriate editor component from `editors/`)
- **Right pane**: live preview iframe pointed at the page (with `?preview=1` query to bypass cache). PMBC kept the iframe rather than FMP's "open in new tab" — preview re-keys after every Save / Add / Delete.

Save button at the top right. **Explicit-save** model for v1 (no auto-save).

---

## 7. Email System

### Resend Setup

One Resend account, one verified sending domain. Decision: either reuse FMP's existing Resend account with a new sender (e.g., `noreply@pacemakersglobal.com`) or create a new Resend account specifically for PMBC. Recommendation: separate account for clean separation of analytics and reputation.

Domain verification (SPF, DKIM, DMARC) follows Resend's standard flow. Use `pacemakersglobal.com` as the sender domain.

### Templates

For v1, only two templates exist. Both are stored in `email_templates` table and editable via admin.

**contact_notification**: sent to admin when contact form submitted. Recipient: configured admin email from `site_settings.admin_email`. Variables: name, email, company, phone, country, service_interest, message, source_page, submission_id.

**contact_acknowledgement**: sent to the person who submitted the form. Recipient: their email. Variables: name. Body confirms receipt and sets a 1-2 business day response expectation.

### Base Layout

```typescript
// src/lib/email/templates/_base.ts
export async function baseLayoutBranded(content: string): Promise<string> {
  const branding = await fetchEmailBranding();
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${branding.primary_color}; padding: 20px; text-align: center;">
        ${branding.logo_url ? `<img src="${branding.logo_url}" alt="PaceMakers" height="40" />` : '<h1 style="color: white;">PaceMakers</h1>'}
      </div>
      <div style="padding: 30px 20px;">
        ${content}
      </div>
      <div style="border-top: 1px solid #eee; padding: 20px; font-size: 12px; color: #666;">
        ${branding.footer_html || ''}
      </div>
    </body>
    </html>
  `;
}
```

### Send Wrapper

```typescript
// src/lib/email/send.ts
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, html, from }: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  return resend.emails.send({
    from: from || process.env.EMAIL_FROM_DEFAULT!,
    to,
    subject,
    html,
  });
}
```

---

## 8. SEO and OG

### Metadata

Per-page metadata via Next.js `generateMetadata`. Read from `cms_pages` (meta_title, meta_description, og_image_url) with sensible defaults from `site_settings`.

### OG Image Route

`/api/og/route.tsx` generates a dynamic OG card using `next/og` (satori). Default content reads from page_sections of the home page hero, falling back to cms_content, falling back to hardcoded brand defaults. Logo is fetched from branding_config.logo_url, converted SVG → PNG via sharp if needed, and embedded as base64.

Pattern matches FMP's `/api/og/main`. Image is 1200x630, navy background, white text, logo top-left, headline center, tagline below.

### Sitemap and Robots

```typescript
// src/app/sitemap.ts
export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pacemakersglobal.com';
  const services = SERVICES.map(s => ({ url: `${baseUrl}/services/${s.slug}`, lastModified: new Date() }));
  return [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/services`, lastModified: new Date() },
    ...services,
    { url: `${baseUrl}/sectors`, lastModified: new Date() },
    { url: `${baseUrl}/approach`, lastModified: new Date() },
    { url: `${baseUrl}/network`, lastModified: new Date() },
    { url: `${baseUrl}/about`, lastModified: new Date() },
    { url: `${baseUrl}/financial-modeler-pro`, lastModified: new Date() },
    { url: `${baseUrl}/contact`, lastModified: new Date() },
  ];
}

// src/app/robots.ts
export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL}/sitemap.xml`,
  };
}
```

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

## 9. Branding and Design

### Color Palette

Derived from the PMBC logo (navy + green + thin gold accent):

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#1B3A5F` | Navy. Primary background, headers, hero. |
| `--color-primary-deep` | `#0F2540` | Deeper navy for contrast layers. |
| `--color-secondary` | `#3FA663` | Green. Accent for CTAs, success states, highlights. |
| `--color-accent` | `#D4A93A` | Gold. Sparingly used for premium accent — borders, dividers, badges. |
| `--color-text-primary` | `#0F1B2D` | Body text on light. |
| `--color-text-on-dark` | `#E8EEF5` | Body text on navy. |
| `--color-muted` | `#6B7280` | Secondary text, captions. |
| `--color-surface` | `#FFFFFF` | Default light surface. |
| `--color-surface-alt` | `#F7F9FC` | Alternate light surface for section separation. |

Critical positioning point: PMBC's design language should feel **distinct from FMP**. FMP is approachable and modern (a learning platform). PMBC is institutional and senior (a credibility document for family offices). Both can share base colors but the way they're used should differ. PMBC leans more on:

- Heavier use of navy (deeper, more authoritative)
- More whitespace
- Larger type sizes
- More serif accents (consider Source Serif Pro or similar for headlines, paired with Inter for body)
- Less green (FMP uses green liberally; PMBC uses it sparingly as a credibility accent)
- Gold thread used minimally for premium signaling

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Hero headline | Source Serif Pro / Playfair Display | 56-72px | 600 |
| Section headline | Source Serif Pro / Playfair Display | 36-48px | 600 |
| Subheadline | Inter | 18-22px | 400 |
| Body | Inter | 16-18px | 400 |
| Caption / label | Inter | 12-14px | 500 (uppercase, tracked) |

Decision pending on serif choice — present both during build phase. Both load via Google Fonts with `next/font`.

### Layout Tokens

- Max content width: 1200px (1280px for hero sections)
- Section vertical padding: 96px desktop, 64px mobile
- Inner block padding: 32px
- Card radius: 8px (less rounded than FMP's 12-16px to feel more institutional)

---

## 10. Environment Variables

```bash
# Supabase (new project, separate from FMP)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# NextAuth
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://pacemakersglobal.com
NEXT_PUBLIC_SITE_URL=https://pacemakersglobal.com

# Resend
RESEND_API_KEY=
EMAIL_FROM_DEFAULT=noreply@pacemakersglobal.com
EMAIL_FROM_CONTACT=info@pacemakersglobal.com
EMAIL_TO_ADMIN=ahmad.din@pacemakersglobal.com

# hCaptcha
HCAPTCHA_SECRET_KEY=
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=

# Optional
NEXT_PUBLIC_GA_ID=
```

---

## 11. Build Sequence

Follow this order. Don't skip ahead. Each phase is testable on its own.

### Phase 1: Scaffold and Database (Day 1) — ✅ Complete (2026-04-30)
1. `npx create-next-app@latest` with TypeScript, Tailwind, App Router, src/ directory, Turbopack
2. Install dependencies (see Section 2)
3. Set up Supabase project, get keys, populate `.env.local`
4. Run migrations 001-008
5. Insert one admin user via SQL with bcrypt hash
6. Verify Supabase connection from a server component

### Phase 2: Auth and Admin Shell (Day 1-2) — ✅ Complete (2026-05-02)
1. NextAuth config with credentials provider hitting admin_users
2. Middleware protecting `/admin/*`
3. Admin login page
4. Admin layout (sidebar nav, header with logout)
5. Empty admin dashboard

### Phase 3: CMS Foundations (Day 2-3) — ✅ Complete (2026-05-02)
1. cms_content key-value editor at `/admin/content`
2. Branding admin at `/admin/branding`
3. Site settings at `/admin/settings`
4. Email branding and templates admin

### Phase 4: Page Builder (Day 3-5) — ✅ Complete (2026-05-02)
1. `/admin/pages` listing
2. `/admin/page-builder/[slug]` three-pane layout
3. Section editors for: hero, paragraphs, stats_block, service_cards (start with these four)
4. Drag-and-drop reorder
5. Save and visibility toggle

### Phase 5: Public Pages — Core (Day 5-7)
1. Root layout with Navbar + Footer (CMS-driven)
2. Section renderer with the four section types built so far
3. Home page rendering from page_sections
4. Services overview page
5. Contact page with form, contact API route, email templates wired up

### Phase 6: Remaining Section Types (Day 7-9) — ✅ Complete (2026-05-03)
Editors + public renderers shipped for the 9 outstanding types: `sector_grid`, `process_steps`, `network_partners`, `founder_block`, `text_image`, `cta_block`, `quote`, `fmp_intro`, `service_detail`. All marked `implemented: true` in `SECTION_TYPES`; `SectionRenderer` and `SectionEditorPanel` registries cover all 13 types. Shared 21-icon lucide registry at `src/lib/cms/sectorIcons.tsx` powers both the sector-grid editor dropdown and the public renderer.

### Phase 7: Remaining Pages (Day 9-11) — ✅ Complete (2026-05-03)
Bespoke routes shipped at `src/app/(public)/{about,sectors,approach,network,financial-modeler-pro}/page.tsx`, plus `src/app/(public)/services/[slug]/page.tsx` for the 9 service detail pages. The catch-all `(public)/[slug]/page.tsx` was deleted — all CMS-managed pages now have explicit routes; missing pages 404 explicitly rather than silently rendering an unconfigured slug. Service-detail content lives in `cms_content` under namespace `service_<slug>` (migration 010); the route renderer parses `deliverables` robustly (JSON first, newline-split fallback). `src/app/sitemap.ts` and `src/app/robots.ts` shipped alongside.

### Phase 8: SEO and Polish (Day 11-13) — ✅ Complete (2026-05-03)
Dynamic OG image route at `/api/og` (`next/og` ImageResponse, 1200×630, navy + gold, branding-driven). Shared `src/lib/seo/metadata.ts` `buildPageMetadata()` helper drives unique title / canonical / OG / twitter on every public page, auto-routing OG images to `/api/og?…` when no override is set. Schema.org `@graph` (FinancialService + Organization + WebSite) mounted in the public layout via `OrganizationJsonLd`; per-service `Service` schema on `/services/[slug]` linked back via `@id`. Branded 404 in both `(public)/not-found.tsx` (in-group `notFound()`) and root `not-found.tsx` (unmatched URLs); root `error.tsx` client boundary logs digest and offers retry. Privacy + Terms fleshed out with named processors (Vercel, Supabase, Resend, hCaptcha, Google Fonts) and "Subject to legal review" badge. `next.config.ts` adds Supabase + Cloudinary `remotePatterns` and `poweredByHeader: false`. `/admin/og-preview` admin tool with live previews + per-page override-URL save (writes to `cms_pages.og_image_url`). Sitemap and robots already shipped in Phase 7.

### Phase 9: Content Population and Launch (Day 13-15)
1. Populate all cms_content rows with real copy
2. Populate page_sections for all pages with real content
3. Configure DNS at Vercel
4. SSL provisioning verification
5. Final QA pass on all pages
6. Submit sitemap to Google Search Console

---

## 12. What's NOT in v1 (Phase 2 Backlog)

Document this list at project kickoff so you don't accidentally build any of it. Each item should be revisited only when there's a real need or a real piece of content to support it.

- **Articles / Blog**: Articles will be published on FMP. PMBC will eventually mirror or syndicate them, but not in v1. Decide later whether to: (a) iframe FMP's articles index, (b) build a separate articles section that pulls from a shared content source, (c) cross-post manually.
- **Newsletter subscriber list**: No email capture for marketing in v1. Contact form only.
- **Case study detail pages**: Need anonymized case studies written first. Once written, build a `case_studies` table and detail page template.
- **Multi-language (Arabic)**: Add `/ar/*` routes only if KSA market response demands it. Significant content work.
- **Client portal**: Probably never. PMBC clients get deliverables via email/secure file transfer.
- **Booking integration**: Direct Calendly or Microsoft Bookings link in contact section is enough. No embedded booking widget.
- **AI features**: No content suggestions, no chatbot, no AI-generated services pages.
- **Search**: Site is small enough that nav suffices.
- **Comments / community features**: No.
- **Pricing pages**: PMBC engagements are bespoke. No published pricing.

---

## 13. Cross-Property Content (PMBC ↔ FMP)

PMBC and FMP are fully separate codebases and Supabase projects. They do not share data. They are linked only by hyperlinks.

### From PMBC to FMP

- The `/financial-modeler-pro` page on PMBC introduces FMP and ends with a primary CTA "Visit Financial Modeler Pro" → links to `https://financialmodelerpro.com`
- Footer column "Platform" includes a link to FMP
- The About / Founder block on PMBC mentions FMP as Ahmad's platform and links to the founder page on FMP for the full bio: `https://financialmodelerpro.com/about/ahmad-din`

### From FMP to PMBC

(Already exists.) FMP's home page has a "Powered by PaceMakers Business Consultants" section with a "Visit PaceMakers" button → links to `https://pacemakersglobal.com`.

### Articles (Phase 2)

When articles are added: they live on FMP (which already has the articles infrastructure). PMBC will either link to FMP article pages directly, or syndicate selected articles by manual cross-posting. Decision deferred until there's actual published content.

---

## 14. Code Patterns and Conventions

### Server vs Client Components

Default to server components. Use `'use client'` only for:
- Forms with user interaction (contact form, admin editors)
- Components with browser-only APIs (Tiptap, drag-and-drop)
- Interactive UI primitives (modal, dropdown)

### Data Fetching

All public page data fetched in server components via `lib/cms/*` helpers. No client-side fetching for content. Admin pages may use client-side mutations via API routes.

### Error Handling

Public pages: graceful degradation. If CMS fetch fails, show fallback content from `config/site.ts`. Never break the page.

Admin pages: surface errors clearly with toast notifications (use a small custom toast or `sonner`).

API routes: structured error responses `{ error: string, code?: string }` with appropriate HTTP status codes.

### Type Safety

Generate Supabase types: `npx supabase gen types typescript --project-id <id> > src/types/database.ts`. Re-run after every migration. Use `Database` type for all Supabase queries.

### File Naming

- Components: PascalCase (`Hero.tsx`, `ServiceCards.tsx`)
- Utilities: camelCase (`slugify.ts`, `formatDate.ts`)
- Routes: kebab-case folders (`page-builder`, `contact-submissions`)
- API routes: kebab-case (`/api/contact-submissions`)

### Commit Messages

Conventional Commits style: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. Keep scope concise. Example: `feat(admin): add contact submissions table`.

---

## 15. Critical Reminders

1. **PMBC is a credibility document, not a lead engine.** Every decision should be evaluated against this. Heavy SEO content and lead magnets are not v1.
2. **Design feels institutional, not modern-startup.** No gradient backgrounds, no animated icons, no playful microcopy. Senior, considered, calm.
3. **Honest credentials only.** PMBC's track record (biofuel, oil & gas, waste management, data center, construction, industrial services). Ahmad's broader career is attributed to him as a professional, with reference to firms where appropriate (per the FMP profile pattern).
4. **No duplication of FMP's founder content.** Link out to FMP for the deep professional bio.
5. **Pakistan is operational headquarters, not the marketing-front geography.** Lead with KSA and GCC. Lahore is mentioned only as where the analytical work happens.
6. **CMS-first.** Every public page section should be editable from the admin panel. If something is hardcoded, it should be a deliberate exception (privacy/terms only).
7. **One admin user.** Ahmad. Don't build user management, role hierarchies, or invite flows in v1.
8. **Match FMP's quality bar, not its complexity.** Clean migration discipline, typed Supabase queries, server-first rendering, branded emails, OG images. But no Apps Script, no dual auth, no quizzes, no certificates.

---

End of technical handoff. Read this in full before starting any new task. Update this file as architectural decisions are made or change.

---

## Session Log

The full chronological session log has moved to [`SESSION_LOG.md`](./SESSION_LOG.md) to keep this file lean (`CLAUDE.md` is loaded into context every session). Read `SESSION_LOG.md` when you need the detailed build history, decisions, and lessons from prior phases. The **Current Status** table near the top of this file is the quick-reference summary of phase progress.
