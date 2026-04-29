# PMBC Project — Build Handoff Summary

**Project:** PaceMakers Business Consultants website
**Repo:** github.com/financialmodelerpro/PMBC
**Domain:** pacemakersglobal.com
**Vercel project:** pmbc (already created, domain attached)
**Build path:** Self-built using Claude Code
**Status:** Pre-development. Repo created fresh. Vercel project linked. No code committed yet.

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

1. Scaffold Next.js, install dependencies, set up Supabase, run migrations
2. Auth + admin shell (NextAuth, middleware, login, dashboard)
3. CMS foundations (cms_content editor, branding admin, settings)
4. Page builder (admin pages list, three-pane editor, first 4 section types)
5. Public pages — core (home, services overview, contact form with email)
6. Remaining section types (sector_grid, process_steps, network_partners, founder_block, text_image, cta_block, quote, fmp_intro, service_detail)
7. Remaining pages (sectors, approach, network, about, FMP page, service detail)
8. SEO and polish (OG, metadata, sitemap, structured data, 404)
9. Content population and launch

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

## Decisions Still Open

| Open question | Notes |
|----------------|-------|
| Headline serif font | Source Serif Pro vs Playfair Display. Decide during Phase 5 polish. |
| Resend account | Reuse FMP's account with new sender, or create new account for PMBC. Recommendation: separate account. |
| Color tokens — exact hex values | Starting palette in CLAUDE.md is a draft. Refine against logo and brand once first pages render. |
| Auto-save vs explicit save in page builder | Pick one and stay consistent. |
| Founder photo on About page | Use the existing FMP profile photo, or shoot new institutional photography. |
| Direct booking link | Microsoft Bookings (already used by FMP) vs Calendly vs WhatsApp-only. |

## Content Sources

The deck (`Presentation1_3_03242026.pptx`) is the structural source for service descriptions, sector coverage, the engagement methodology, and the network positioning. It is **not** the source for credentials. Specifically:

- **PMBC's own track record** (sectors PMBC has delivered as the contracted advisor): biofuel, oil & gas tank cleaning, waste management, data center, construction projects, industrial services.
- **Ahmad's broader experience** (mandates led in his role at Synergistic and prior firms): Dallah Investments (Healthcare, Hospitality, Real Estate), ACWA Power (FP&A for Central Asia renewables), PPP electric bus frameworks for Government of Punjab and Sindh, biofuel feasibility for Wa'ed (Saudi Aramco entrepreneurship arm).

The website framing should attribute Ahmad's broader career to him as a professional (with firm context where appropriate, matching how FMP's `/about/ahmad-din` page already does this), and PMBC's own delivered work to PMBC. Both are honest; both are credible. Mixing them would create real exposure given Ahmad's current role at Synergistic.

The FMP founder page (`financialmodelerpro.com/about/ahmad-din`) is the canonical source for Ahmad's bio. PMBC's About page should write a shorter firm-focused founder section and link out to FMP for the deep career detail rather than duplicating it.

## What Happens Next

1. **You** delete and recreate the GitHub repo if not already done. (Done.) Confirm Vercel relink. (Done.)
2. **You** scaffold the Next.js project locally and push the initial commit.
3. **You** run through Phase 1 of the build sequence (database setup, migrations, admin user seeding).
4. **Claude (in chat)** drafts content for each page when you reach Phase 9 — section angles confirmed first, then full copy written, per your stated working preference.
5. **Claude Code** handles all coding, scaffolding, and feature implementation against this handoff document.

## How to Use These Files

- **CLAUDE.md** — drop this at the root of the repo. Claude Code reads it on every session and uses it as project context. It contains all the patterns, schema, and conventions needed to build the site without re-explaining context.
- **PROJECT_HANDOFF.md** — drop this at the root or in a `/docs` folder. It is the human-readable summary of the project for orientation. Claude Code can read it but doesn't need to as often as CLAUDE.md.

When you start the next development session with Claude Code, the first prompt should be: *"Read CLAUDE.md, then begin Phase 1 of the build sequence."*

---

End of project handoff summary.
