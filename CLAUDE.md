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

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Scaffold + DB | ✅ Complete (2026-04-30) | Next.js 15 + Supabase migrations 001-008 applied. |
| Phase 2 — Auth + Admin Shell | ✅ Complete (2026-05-02) | NextAuth credentials provider, middleware, login page, admin layout + sidebar, empty dashboard. Login verified end-to-end. |
| Phase 3 — CMS Foundations | ✅ Complete (2026-05-02) | Six admin editors (branding, content, header settings, site settings, email branding, email templates), six API routes (all session-gated, all audit-logged). |
| Phase 4 — Page Builder | ✅ Complete (2026-05-02) | `/admin/pages`, three-pane `/admin/page-builder/[slug]` with dnd reorder + visibility + delete, four section editors (hero, paragraphs, stats_block, service_cards), public `/[slug]` route + home wired up. |
| Phase 5 — Public Pages (core) | ⬜ Next | Root layout with CMS-driven Navbar + Footer, contact form + API route + email templates wired up. |

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
```

After running migrations, manually insert one admin_users row via SQL with a bcrypt hash for the password.

---

## 4. CMS Architecture

### Two-Layer Pattern

PMBC uses the same two-layer CMS pattern as FMP:

**Layer 1: cms_content (key-value)** — for content that doesn't belong to a specific page or section. Logo URLs, brand name, contact email, footer copyright, default SEO description, social URLs. Section + key + value structure. Read once, cached for the request.

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

### Page Builder

Three-pane layout matching FMP's pattern:
- **Left pane**: list of sections on the current page with drag handles, visibility toggle, delete button, and "Add Section" button at bottom
- **Center pane**: editor for the currently selected section (the appropriate editor component from `editors/`)
- **Right pane**: live preview iframe pointed at the page (with `?preview=1` query to bypass cache)

Save button at the top right. Auto-save toggle in admin settings (default off for v1).

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

### Phase 6: Remaining Section Types (Day 7-9)
Add editors and renderers for: sector_grid, process_steps, network_partners, founder_block, text_image, cta_block, quote, fmp_intro, service_detail.

### Phase 7: Remaining Pages (Day 9-11)
Sectors, Approach, Network, About, Financial Modeler Pro, individual service detail pages.

### Phase 8: SEO and Polish (Day 11-13)
1. OG image route
2. Per-page metadata
3. Sitemap and robots
4. JSON-LD structured data
5. 404 page
6. Privacy and Terms pages (hardcoded)

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

### 2026-05-02 — Phase 2: Auth + Admin Shell

**Built**
- `src/lib/auth/config.ts` — NextAuth options. Credentials provider, JWT strategy (1h `maxAge` on session and JWT), bcrypt compare against `admin_users.password_hash`. On success: stamps `last_login_at`, inserts `audit_log` row (`action='login'`). JWT/session callbacks expose `id` and `role`.
- `src/types/next-auth.d.ts` — module augmentation so `session.user.role` and `token.role` are typed.
- `src/app/api/auth/[...nextauth]/route.ts` — App Router NextAuth handler.
- `src/middleware.ts` — matches `/admin/:path*`, lets `/admin/login` through, requires `token.role === 'admin'`. Forwards `x-pathname` header to RSC so the layout can detect the login route.
- `src/app/admin/login/page.tsx` + `LoginForm.tsx` — react-hook-form + zod, generic "Invalid email or password" error, redirects to `callbackUrl` (default `/admin`) on success. Form wrapped in `Suspense` (uses `useSearchParams`).
- `src/app/admin/layout.tsx` — server component. Reads `x-pathname`, renders bare for `/admin/login`, otherwise enforces session via `getServerSession` (defense-in-depth alongside middleware) and renders the chrome.
- `src/components/admin/AdminSidebar.tsx`, `AdminMobileNav.tsx`, `LogoutButton.tsx` — sidebar with active-route highlighting, mobile drawer, signOut button.
- `src/app/admin/page.tsx` — dashboard with four stat cards backed by real `count: 'exact', head: true` queries.
- `scripts/seed-admin.mjs` + `npm run seed-admin` — hashes a known password in JS (no shell escaping), upserts `admin_users` row for `meetahmadch@gmail.com`, reads back, and verifies via `bcrypt.compareSync`.

**Verified end-to-end**
- `npm run typecheck` clean. `npm run build` clean (5 routes, middleware compiled).
- `/admin` while logged out → middleware redirects to `/admin/login`.
- Sign in → lands on `/admin` dashboard. `audit_log` row created with `action='login'`.
- Sign out from top bar → back to `/admin/login`.

**Notable detours / lessons**
- First login attempts 401'd because `.env.local` did not exist. Fix: created it from `npx supabase projects api-keys --project-ref yackrfoesinnothbltlc -o env` plus a generated `NEXTAUTH_SECRET`. The `[next-auth][warn][NEXTAUTH_URL]` and `[NO_SECRET]` warnings in dev output are reliable signals that env loading is broken.
- Hydration warning on `<body>` was caused by Grammarly browser extension (`data-new-gr-c-s-check-loaded`). Fixed with `suppressHydrationWarning` on `<body>` in `src/app/layout.tsx`.
- `lucide-react@^1` is **current** (Lucide moved to a 1.x major in 2024). Do not "downgrade" to 0.x.

**Open items for next session — Phase 3: CMS Foundations**
1. `/admin/content` — key-value editor for `cms_content` (grouped by section).
2. `/admin/branding` — logo, brand name, tagline, color tokens (single-row `branding_config`).
3. `/admin/settings` — JSONB `site_settings` editor (admin email, social URLs, GA ID, etc.).
4. `/admin/email-branding` and `/admin/email-templates` — single-row `email_branding`, two seeded `email_templates` rows.
5. Decide: auto-save vs explicit Save button (CLAUDE.md §4 says pick one and stay consistent — recommend explicit Save for v1, auto-save in a later phase).
6. Rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-02 (PM) — Phase 3: CMS Foundations

**Built**
- Six admin editors, all explicit-Save (no auto-save in v1):
  - `/admin/branding` (`BrandingForm.tsx`) — all `branding_config` fields, three color pickers, live brand-preview panel.
  - `/admin/content` (`ContentEditor.tsx`) — `cms_content` rows grouped into accordions per `section`. Per-row text/textarea toggle, add/delete with confirmation modal, batch save per section. Header `config` key hidden (managed under Header Settings).
  - `/admin/header-settings` (`HeaderSettingsForm.tsx`) — nav items with `@dnd-kit` drag-reorder, CTA label/href/visibility, mobile menu toggle. Stored as JSON in `cms_content` (`section='header_settings'`, `key='config'`).
  - `/admin/settings` (`SettingsForm.tsx`) — JSONB `site_settings` blob: contact_email, admin_email, whatsapp/phone, office text, LinkedIn/X URLs, default OG image, GA ID.
  - `/admin/email-branding` (`EmailBrandingForm.tsx`) — logo URL, primary color, signature/footer Tiptap editors, live email-preview panel.
  - `/admin/email-templates` (`EmailTemplatesEditor.tsx`) — sidebar of templates → subject + Tiptap body. Per-template enabled toggle. Right rail lists `{{variables}}` with one-click copy.
- Six API routes (`/api/admin/{branding,content,header-settings,settings,email-branding,email-templates}`) — each gated by `getAdminSession()` (401 if absent), validated with zod, writes `audit_log` row on success.
- Shared infra: `src/lib/auth/requireAdmin.ts`, `src/lib/audit.ts`, `src/lib/cms/*` typed fetchers, `src/components/admin/RichTextEditor.tsx` (Tiptap StarterKit toolbar wrapper), `SaveStatus.tsx`, `ConfirmDialog.tsx`, `AdminPageHeader.tsx`.
- Installed `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (header nav reorder).

**Verified**
- `npm run typecheck` clean. `npm run build` clean — 6 admin pages + 6 API routes + login + dashboard + middleware all compiled (11 routes total).
- All six admin pages return 200 in dev under an authenticated session. Branding `POST /api/admin/branding` returned 200; persistence + audit confirmed by smoke test.
- 404s for `/admin/pages`, `/admin/page-builder`, `/admin/contact-submissions` are expected — those sidebar links are placeholders for Phase 4+.

**Notable choices**
- **Explicit Save over auto-save** for v1 (per CLAUDE.md §4 instruction to pick one). Auto-save can come later.
- **Tiptap StarterKit v3 does not include the Link mark.** Removed the link button from `RichTextEditor.tsx` to avoid runtime errors. Add `@tiptap/extension-link` and re-enable when needed.
- **Header Settings is the only `cms_content` row whose value is JSON.** Edited via its dedicated drag-and-drop UI; the generic Content editor explicitly hides this row to avoid double-editing.

**Open items for next session — Phase 4: Page Builder**
1. `/admin/pages` — list all CMS pages with edit links.
2. `/admin/page-builder/[slug]` — three-pane layout (sections list / editor / live preview).
3. Section editors for: `hero`, `paragraphs`, `stats_block`, `service_cards` (start with these four).
4. Drag-and-drop section reorder (already have `@dnd-kit` installed).
5. Visibility toggle and per-section save.
6. Still pending: rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-02 (evening) — Phase 4: Page Builder

**Built**
- `src/lib/cms/sectionTypes.ts` — registry of all 13 section types: `label`, `description`, `implemented` flag (true for hero/paragraphs/stats_block/service_cards, false for the other 9), and `defaultContent` blob used by `/create`.
- `src/lib/cms/pages.ts` — `fetchPages()`, `fetchPage(slug)`, `fetchPageSections(slug, { onlyVisible })`.
- `src/lib/cms/serializers.ts` — `LocalSection` type + `sectionFromRow(row)`. **Server-safe** module so both `page.tsx` (server) and `PageBuilder.tsx` (client) can import.
- API routes (all session-gated, zod-validated, audit-logged):
  - `POST /api/admin/page-sections` — batch upsert; bumps `cms_pages.updated_at`.
  - `POST /api/admin/page-sections/create` — inserts empty section of given type at `max(display_order) + 10`.
  - `DELETE /api/admin/page-sections/[id]` — deletes one section.
- Public renderer at `src/components/public/SectionRenderer.tsx` + four section components (`Hero`, `Paragraphs`, `StatsBlock`, `ServiceCards`) + dashed `Placeholder` for the 9 not-yet-implemented types.
- Public route `src/app/(public)/[slug]/page.tsx` — fetches page + sections, supports `?preview=1` (shows hidden sections + draft pages).
- `src/app/page.tsx` updated so the home (`/`) renders sections for slug `home`, with placeholder fallback if none exist. Same `?preview=1` semantics as the catch-all route.
- `src/app/admin/pages/page.tsx` — table of every `cms_pages` row with section count + status badge + "Builder" link.
- Section editors at `src/components/admin/editors/{HeroEditor,ParagraphsEditor,StatsBlockEditor,ServiceCardsEditor}.tsx` plus shared `types.ts`.
- Three-pane `src/app/admin/page-builder/[slug]/{page,PageBuilder,SectionEditorPanel,SectionPickerDialog}.tsx`. Top bar: title + status + "Unsaved changes" pill + Save (disabled when not dirty). Left: dnd section list + visibility eye + delete + "Add section". Center: editor for the selected type (raw-JSON inspector for unimplemented types). Right: iframe at `/[slug]?preview=1` (or `/?preview=1` for home) with Refresh button; iframe re-keys after every save / add / delete.
- `beforeunload` warning on dirty navigation.
- `scripts/smoke-builder.mjs` — programmatically logs in via NextAuth credentials and GETs each `/admin/page-builder/<slug>` route; used to verify the `fromServerRow` regression fix end-to-end.

**Verified**
- `npm run typecheck` clean. `npm run build` clean (23 routes total).
- Smoke script: 7 distinct slugs (`home`, `about`, `services`, `sectors`, `contact`, `financial-modeler-pro`, `service-business-valuation`) + `/admin/pages` all returned HTTP 200 with an authenticated session.

**Notable detours / lessons**
- **Don't export non-component functions from a `'use client'` module that a server component imports.** First version of `PageBuilder.tsx` exported a `fromServerRow` helper that was called from the server `page.tsx`. Next.js threw `Attempted to call fromServerRow() from the server but fromServerRow is on the client`. Fix: move the helper to `src/lib/cms/serializers.ts` (no `'use client'`). Type-only exports from client modules are fine — types are erased at build.
- **Don't run `npm run build` while `npm run dev` is also running on the same project** — Turbopack and the production build both write to `.next/` and clobber each other (`ENOENT _buildManifest.js.tmp.*` cascade). Recovery: stop dev, `rm -rf .next`, restart dev.
- **Field-name compat for hero seeds**: existing seeded hero rows use `badge` (not `badge_text` from spec). Renderer + editor read both keys; editor writes the canonical `badge_text` going forward. Same pattern for `service_cards` seed using `items` vs spec `cards`.
- **No draft preview state in v1**: the iframe shows the last *saved* state, not unsaved edits. Amber strip in preview pane reminds the user of this when dirty.
- **Add section creates immediately on the server** (so it has a stable id for editing). That's why "Add section" doesn't mark the page dirty — the row is already persisted.

**Open items for next session — Phase 5: Public Pages (core)**
1. Root layout with CMS-driven Navbar + Footer (read from `cms_content` `header_settings`/`footer_settings` and the new `header_settings.config` JSON blob).
2. Contact page form + `/api/contact` route + email templates wired up via Resend.
3. Per-page metadata pulling from `cms_pages` (`meta_title` already wired in `(public)/[slug]/page.tsx`; needs root layout title template + the home slug variant).
4. Still pending: rotate `Admin@2026` to a strong production password before any deploy.

