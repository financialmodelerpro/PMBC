# PMBC Project — Build Handoff Summary

**Project:** PaceMakers Business Consultants website
**Repo:** github.com/financialmodelerpro/PMBC
**Domain:** pacemakersglobal.com
**Vercel project:** pmbc (already created, domain attached)
**Build path:** Self-built using Claude Code
**Status:** Phases 1 through 8 complete; Phase 9 in progress; Phase 9.5 visual polish complete (as of 2026-05-06). Home page production content shipped (migration 011); all 13 section types implemented with editors and renderers; bespoke routes for every public page; dynamic OG images and Schema.org JSON-LD; branded 404 and error boundaries; Privacy and Terms drafted with named processors. Content style rule (no em dashes) applied retroactively across the codebase and live database (migration 012). Supabase RLS hardened with default-deny on all 10 public tables (migration 013) after Security Advisor flagged the issue. Phase 9.5 — boutique private bank visual polish — refreshed design tokens (warm navy `#153D64`, deep navy `#0F2F4F`, cream `#FAF7F2`, gold `#D4A93A`, muted gold `#B89530`, cream-on-navy `#E8DDC4`); built shared `SectionContainer` + `variantStyles` token layer; redesigned all 13 section renderers around three background variants (`navy_deep` / `cream` / `white`) with sequence-aware variant resolution so home rhythm is automatic; refined navbar (gold underline-on-hover, monogram fallback) and footer (deep navy, small-caps gold headlines, italic serif tagline). No content schema changes. Remaining: about, sectors, approach, network, financial-modeler-pro, services overview, contact intro, and 9 service-detail pages of production content; real logo / founder photo / partner logo asset uploads; admin contact-submissions inbox; DNS + SSL configuration; counsel review of Privacy and Terms; rotate the dev admin password.

---

## What This Project Is

A standalone marketing website for PaceMakers Business Consultants LLP — the parent firm under which Financial Modeler Pro operates. The website's job is to convert referred prospects into conversations. It is a credibility document for KSA and GCC family offices, investment offices, real estate investors, developers, and corporates running M&A, valuation, or modeling mandates.

It is **not** an inbound SEO engine, **not** a lead-magnet funnel, and **not** a self-service portal. It is a small, high-quality site that needs to feel institutional and trustworthy to a sophisticated buyer.

## What's In Scope (v1)

A complete content management system identical in pattern to FMP (key-value CMS plus block-based page builder), backed by Supabase, served by a single Next.js application deployed to Vercel.

**Public pages (all CMS-editable):**
- Home
- Services overview + 9 individual service detail pages (Financial Modeling, Business Valuation, Financial Due Diligence, Transaction Advisory, M&A, Real Estate Modeling, Project Finance, Investment Memorandums, CFO Advisory)
- Sector Coverage
- Engagement Approach
- Strategic Network (Sky Gulf, Lynkers)
- About / Firm
- Financial Modeler Pro (introduction page with CTA out to FMP)
- Contact

**Static pages (hardcoded):** Privacy policy, Terms of engagement.

**Admin panel:**
- NextAuth authentication (admin role only)
- Page builder with drag-and-drop section reordering
- Per-section content editors (12 section types)
- Branding admin (logo, colors, brand name, tagline)
- Header / footer / global content editor
- Contact submissions inbox with status tracking
- Email branding and template editor
- Site settings

**Email system:**
- Resend integration
- Two transactional templates (admin notification on contact form submission, acknowledgement to the person who submitted)
- Branded HTML base layout

**SEO and discoverability:**
- Per-page metadata
- Dynamic OG image generation
- Sitemap, robots.txt
- JSON-LD organization schema

## What's Out of Scope (v1)

Everything below is deferred to phase 2 or later. Don't accidentally build any of it.

- Articles / blog (will syndicate from FMP eventually)
- Newsletter subscriber capture
- Case study detail pages
- Multi-language / Arabic
- Client portal or document sharing
- Booking widget (use direct Microsoft Bookings or Calendly link)
- AI features
- On-site search
- Comments or community features
- Public pricing

## What's Different from FMP

FMP is a learning and modeling platform with student auth, course content, quizzes, certificates, live sessions, video tracking, and Google Apps Script integration. PMBC is a credibility website. The complexity gap is intentional.

**PMBC inherits from FMP:**
- Tech stack (Next.js, TypeScript, Tailwind, Supabase, Vercel, Resend)
- CMS pattern (key-value + block-based page sections)
- Page builder admin UX
- Branded email pattern
- OG image generation pattern
- Migration discipline

**PMBC does NOT inherit from FMP:**
- Apps Script and Google Sheets integration
- Student / public user authentication
- Quiz, assessment, or certification logic
- Live sessions, RSVP, watch tracking
- Subdomain routing (single domain)
- PDF or Excel generation
- Cron jobs
- Recharts or any data visualization library
- Anthropic SDK or AI features
- Any payment or pricing infrastructure

## Brand Direction

**Identity:** Boutique corporate finance and transaction advisory firm. Established 2017, restructured as LLP in 2023. Headquartered in Lahore, primary market KSA and GCC.

**Tagline:** Advisory from Structure to Exit

**Positioning:** Senior-led, analytically grounded, commercially focused. Founder Ahmad Din leads every mandate directly. Network of partners (Sky Gulf in Al Khobar, Lynkers in Manama as equity shareholder) extends GCC reach.

**Visual language:** Distinct from FMP. Where FMP is approachable, modern, and educational, PMBC is institutional, considered, and senior. Same base color family (navy, green, gold accent from logo) but used differently — heavier navy, sparing green, gold thread for premium signaling. Serif headlines paired with Inter body. Less rounded corners. More whitespace. Larger type.

## Build Sequence

A 13-15 day full build, broken into 9 testable phases. Each phase is independently reviewable.

1. Scaffold Next.js, install dependencies, set up Supabase, run migrations ✅
2. Auth + admin shell (NextAuth, middleware, login, dashboard) ✅
3. CMS foundations (cms_content editor, branding admin, settings) ✅
4. Page builder (admin pages list, three-pane editor, first 4 section types) ✅
4.5. Admin refactor, FMP-aligned sidebar, inline-styled admin chrome, `cms_content` namespace split, `PATCH`/`POST` API parity ✅
5. Public pages, core (home, services overview, contact form with email) ✅
6. Remaining section types (sector_grid, process_steps, network_partners, founder_block, text_image, cta_block, quote, fmp_intro, service_detail) ✅
7. Remaining pages (sectors, approach, network, about, FMP page, 9 service-detail routes) ✅
8. SEO and polish (dynamic OG, metadata helper, sitemap, robots, JSON-LD, branded 404, error boundary, OG-preview admin tool) ✅
9. Content population and launch ⬅ in progress (home shipped; about next)

Two single-purpose work streams have also landed since Phase 8:
- Content style rule enforcement (migration 012, no em dashes anywhere) ✅
- Supabase RLS hardening with default-deny on all public tables (migration 013) ✅

## Decisions Already Made

| Decision | Choice |
|----------|--------|
| Architecture | Fully separate from FMP. No shared code, database, or deploy. |
| Domain | pacemakersglobal.com (already attached to Vercel) |
| Repo | financialmodelerpro/PMBC (fresh, empty) |
| Vercel project | pmbc (existing, domain configured) |
| Build path | Self-built with Claude Code |
| v1 scope | Lean. Marketing site + CMS + admin + contact form only. |
| Articles | Not in v1. Will live on FMP, syndicated to PMBC later. |
| Multi-language | Not in v1. English only. |
| Auth | Admin-only. No public users. |
| Stack versions | Next.js 15, TypeScript 5, Tailwind 4, Supabase JS 2, NextAuth 4 |
| Admin save model | Explicit Save (not auto-save). Confirmed in Phase 3, validated in Phase 4 page builder. |
| Admin styling | Inline styles with shared tokens at `src/lib/admin/styles.ts`. Public-site Tailwind stays isolated from admin chrome. |

## Decisions Still Open

| Open question | Notes |
|----------------|-------|
| Headline serif font | Source Serif Pro vs Playfair Display. Decide during Phase 5 polish. |
| Resend account | Reuse FMP's account with new sender, or create new account for PMBC. Recommendation: separate account. |
| Color tokens — exact hex values | Starting palette in CLAUDE.md is a draft. Refine against logo and brand once first pages render. |
| Founder photo on About page | Use the existing FMP profile photo, or shoot new institutional photography. |
| Direct booking link | Microsoft Bookings (already used by FMP) vs Calendly vs WhatsApp-only. |

## Content Sources

The deck (`Presentation1_3_03242026.pptx`) is the structural source for service descriptions, sector coverage, the engagement methodology, and the network positioning. It is **not** the source for credentials. Specifically:

- **PMBC's own track record** (sectors PMBC has delivered as the contracted advisor): biofuel, oil & gas tank cleaning, waste management, data center, construction projects, industrial services.
- **Ahmad's broader experience** (mandates led in his role at Synergistic and prior firms): Dallah Investments (Healthcare, Hospitality, Real Estate), ACWA Power (FP&A for Central Asia renewables), PPP electric bus frameworks for Government of Punjab and Sindh, biofuel feasibility for Wa'ed (Saudi Aramco entrepreneurship arm).

The website framing should attribute Ahmad's broader career to him as a professional (with firm context where appropriate, matching how FMP's `/about/ahmad-din` page already does this), and PMBC's own delivered work to PMBC. Both are honest; both are credible. Mixing them would create real exposure given Ahmad's current role at Synergistic.

The FMP founder page (`financialmodelerpro.com/about/ahmad-din`) is the canonical source for Ahmad's bio. PMBC's About page should write a shorter firm-focused founder section and link out to FMP for the deep career detail rather than duplicating it.

## What Happens Next

1. **Phase 9 page-by-page content population**, in order: about, sectors, approach, network, financial-modeler-pro, services overview, contact intro, and the 9 service-detail pages (replacing migration 010 placeholders). Each page follows the home-page seed pattern: a numbered migration plus a companion `scripts/seed-<page>-page.mjs` JS apply script. The next migration filename is `014_seed_about_page_content.sql` (migration 013 was used for the RLS hardening, not the about-page seed as previously sketched).
2. **Build the `/admin/contact-submissions` inbox** so the contact-form rows are triageable in the admin console. Currently the only sidebar route returning 404.
3. **Claude (in chat)** drafts content for each page as Phase 9 progresses, section angles confirmed first, then full copy written, per stated working preference.
4. **Claude Code** continues all coding, scaffolding, and feature implementation against `CLAUDE.md`.
5. **Before launch:**
   - Rotate `Admin@2026` (the dev seed password for `meetahmadch@gmail.com`) to a strong production credential via `npm run seed-admin`. With RLS now on `admin_users`, the dashboard table editor cannot insert; the seed script (which uses the service-role key) is the right path.
   - DNS + SSL on Vercel for the apex and `www`.
   - Production env vars populated (`NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM_*`, `EMAIL_TO_ADMIN`, `HCAPTCHA_*`, Supabase service role key).
   - Sitemap submitted to Google Search Console.
   - Counsel review of `/privacy` and `/terms`; remove the "Subject to legal review" badge once approved.
   - Refresh Supabase Security Advisor in the dashboard; confirm the 10 RLS errors are cleared.

## How to Use These Files

- **CLAUDE.md** — drop this at the root of the repo. Claude Code reads it on every session and uses it as project context. It contains all the patterns, schema, and conventions needed to build the site without re-explaining context.
- **PROJECT_HANDOFF.md** — drop this at the root or in a `/docs` folder. It is the human-readable summary of the project for orientation. Claude Code can read it but doesn't need to as often as CLAUDE.md.

When you start the next development session with Claude Code, the first prompt should be: *"Read CLAUDE.md, then begin Phase 1 of the build sequence."*

---

End of project handoff summary.
