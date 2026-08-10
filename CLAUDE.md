# PaceMakers Business Consultants: Technical Handoff

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
| Email | Brevo (transactional, sender domain `pacemakersglobal.com`). Migrated from Resend 2026-08-10. |
| Tagline | Advisory from Structure to Exit |
| Positioning | Boutique corporate finance and transaction advisory firm serving KSA, GCC, and worldwide mandates |
| Primary audience | Family offices, investment offices, real estate developers, corporates running M&A or valuation mandates |
| Build path | Self-built by Ahmad Din using Claude Code |

PMBC is the parent entity. Financial Modeler Pro is its flagship platform. The website's job is to convert referred prospects into conversations. It is a credibility document, not an inbound lead engine. Volume is not the metric. Quality of inbound is.

---

## Content Style Rules

**Scope is universal, strengthened 2026-08-01.** These rules apply to everything written in a PMBC session, with no carve-outs:

- public site copy, admin UI strings, fallback text, badge and button labels, alt text
- **source code comments and JSDoc**
- **git commit messages and PR bodies**
- **SQL migration files, including their comment headers**
- **this file, SESSION_LOG.md, and every other repo markdown doc**
- **replies to the user in chat**
- seeded JSONB, placeholder and hint text, validation and error messages, test fixtures

An earlier version of this section exempted technical docs, code comments and commit messages. That exemption is revoked.

1. **No em dashes (U+2014).** Replace with a comma, parentheses, a period, or a colon depending on the relationship being expressed:
   - **Pause or aside:** comma or parentheses. *"Senior-led, analytically grounded."*
   - **Strong break:** start a new sentence. *"We model. We advise."*
   - **List intro or explanation:** colon. *"Three things matter: clarity, rigor, judgment."*
   - **Range:** write the words. *"4 to 6 weeks"*.

2. **No en dashes (U+2013) in prose.** Same fix. Acceptable only inside a numeric range where the format genuinely requires it, or inside copy the user hands over verbatim.

**Enforcement.** Before finishing any phase, grep every touched file for the em dash character. It must return zero. Treat this as a release gate, not an afterthought. On Windows Git Bash a bare `grep -r` on the literal character can misbehave depending on shell encoding, so prefer the escape form:

```sh
for f in $(git status --porcelain | awk '{print $NF}'); do
  n=$(grep -oP '\x{2014}' "$f" 2>/dev/null | wc -l)
  [ "$n" -gt 0 ] && echo "VIOLATION $f : $n"
done
```

When you find an em dash in *existing* content while doing other work, fix it as part of that work. Do not raise em-dash-only PRs.

**Why this matters:** PMBC is intentionally institutional, considered, calm. The em dash reads as energetic and digital-marketing-flavored, which is exactly the tone we are not going for. The substitutions above scan as deliberate and senior. If a sentence feels like it needs an em dash, the sentence is usually doing too much. Split it.

**Known pre-rule content that still contains em dashes.** Fix when next touching, not proactively, since a bulk rewrite would bury real diffs:
`CMS_REFERENCE.md` (65) and `PACEMAKERS_ADMIN_CMS_SPEC.md` (30) are both inherited reference documents and are exempt. Live content: migrations 005, 008, 010, 011, 014 to 020 (all applied, so never edit them; fix the rendered content instead), `(public)/privacy` and `terms` (fix at counsel review), the three `not-found`/`error` files, and the email templates seeded in migration 008.

---

## Current Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 : Scaffold + DB | ✅ Complete (2026-04-30) | Next.js 15 + Supabase migrations 001-008 applied. |
| Phase 2 : Auth + Admin Shell | ✅ Complete (2026-05-02) | NextAuth credentials provider, middleware, login page, admin layout + sidebar, empty dashboard. Login verified end-to-end. |
| Phase 3 : CMS Foundations | ✅ Complete (2026-05-02) | Six admin editors (branding, content, header settings, site settings, email branding, email templates), six API routes (all session-gated, all audit-logged). |
| Phase 4 : Page Builder | ✅ Complete (2026-05-02) | `/admin/pages`, three-pane `/admin/page-builder/[slug]` with dnd reorder + visibility + delete, four section editors (hero, paragraphs, stats_block, service_cards), public `/[slug]` route + home wired up. |
| Phase 4.5 : Admin Refactor (FMP alignment) | ✅ Complete (2026-05-02) | New `CmsAdminNav` (240/64 collapse, off-canvas, gold-accent active border, matchPaths, external links to live site + FMP). Tailwind→inline styles across all admin pages with shared tokens at `src/lib/admin/styles.ts`. API routes accept both `PATCH` and `POST`; `cms_content` GET added; branding mutations return `{ row }`. `(header_settings, config)` JSON blob split into discrete keys via migration 009. |
| Phase 5 : Public Pages (core) | ✅ Complete (2026-05-03) | Public root layout with CMS-driven Navbar + Footer, fonts (Inter + Source Serif 4) wired via `next/font`, services overview with config-driven 9-card grid, contact page + form + `/api/contact` route, Resend wrapper with graceful fallback, branded email shell, hardcoded Privacy + Terms. |
| Phase 6 : Remaining Section Types | ✅ Complete (2026-05-03) | Public renderers + admin editors for the 9 outstanding types: sector_grid, process_steps, network_partners, founder_block, text_image, cta_block, quote, fmp_intro, service_detail. Curated 21-icon lucide registry shared between sector editor + renderer. `SECTION_TYPES` now has `implemented: true` for all 13 types. |
| Phase 7 : Remaining Pages | ✅ Complete (2026-05-03) | Bespoke routes for /about, /sectors, /approach, /network, /financial-modeler-pro replace the catch-all `[slug]`. New `/services/[slug]` route renders all 9 service details from `cms_content` namespace `service_<slug>`. Migration 010 seeds 36 rows (4 fields × 9 services). `/admin/content` groups the service-prefixed sections into a "Service detail content" block. `sitemap.ts` lists all 19 public URLs; `robots.ts` blocks /admin and /api. `title: { absolute }` fix removes doubled brand suffix from `<title>` across bespoke pages. `/contact?service=<slug>` pre-selects the service dropdown at SSR. |
| Phase 8 : SEO & Polish | ✅ Complete (2026-05-03) | Dynamic OG image route at `/api/og` (navy/gold satori card with branding-driven logo + tagline). Shared `buildPageMetadata` helper drives unique `<title>` / canonical / OG / twitter meta on every public page, auto-routing OG images to `/api/og?title=…&subtitle=…` when no override is set. Schema.org `@graph` with FinancialService + Organization + WebSite mounted in the public layout; per-service `Service` JSON-LD on `/services/[slug]` with `provider: { @id: '#organization' }`. Branded 404 (both `(public)` and root) and `error.tsx` boundary. Privacy + Terms fleshed out with named processors and "Subject to legal review" badge. `next.config.ts` adds Supabase + Cloudinary `remotePatterns` and `poweredByHeader: false`. `/admin/og-preview` admin tool shows live previews for every page with per-page override-URL save. |
| Phase 9 : Content Population & Launch | 🟡 In progress | Page content COMPLETE + `/admin/contact-submissions` inbox COMPLETE (2026-06-01). Home (2026-05-03) + about, sectors, approach, network, financial-modeler-pro, services overview, contact all seeded via migrations 014-020 (+ companion `scripts/seed-<page>-page.mjs`); 9 service-detail pages kept their migration-010 copy (verified). Contact inbox: session-gated GET/PATCH API + master-detail admin UI (status, notes, audit, first-touch timestamps). All buildable work is now done; everything remaining is ops/review. See the "Remaining Before Launch" checklist below and the SESSION_LOG.md 2026-06-01 entries. |
| Phase 9.5 : Visual Polish (boutique private bank aesthetic) | ✅ Complete (2026-05-06) | **Palette values in this row were superseded by Phase 11; the structure it introduced (tokens layer, three background variants, shared primitives) still stands.** Refined design tokens (#153D64 primary navy, #0F2F4F deep navy, #FAF7F2 cream surface, #D4A93A gold, #B89530 muted gold, #E8DDC4 cream-on-navy text). New `src/lib/public/tokens.ts` + `SectionContainer` / `SectionIntro` primitives. All 13 section renderers redesigned around three background variants (`navy_deep` / `cream` / `white`); SectionRenderer extended with sequence-aware variant resolution so home page rhythm is automatic without DB changes. Hero is 88vh navy_deep with radial gradient, gold hairline, 80px serif headline, gold-bordered CTAs, scroll chevron. FounderBlock has gold-framed photo + navy accent corner + monogram fallback. StatsBlock uses 72px serif numbers with gold dividers. Process steps render in deep navy with gold connectors. Quote is editorial italic serif with 80px gold quote mark. Navbar refined with gold underline-on-hover and PM monogram fallback; Footer reframed at #0F2F4F with small-caps gold column headlines and italic-serif tagline. No content schema changes; all 11 public routes verified 200 in dev, build + typecheck clean. |
| Phase 10 : Advisory Collections CMS (per `PACEMAKERS_ADMIN_CMS_SPEC.md`) | ✅ Complete (2026-06-10) | Five new managed collections as first-class admin sections + DB tables: **Services**, **Case Studies**, **Team & Advisors**, **Insights/Articles**, **Testimonials**. Migrations 021-026 (each table RLS-enabled default-deny per the 013 pattern; 021 seeds the 9 service lines published; 026 adds four public-read storage buckets `cms-assets` / `article-covers` / `case-study-images` / `team-photos` + a public-read storage policy). New table types hand-added to `src/types/database.ts`. Shared infra: `lib/admin/collectionApi.ts` (session-gated, zod-validated, audit-logged CRUD route factory with auto-slugify; operates through a loosely-typed client since the table name is dynamic), `lib/admin/slugify.ts`, `components/admin/CollectionManager.tsx` (one field-driven list + drag-reorder + drawer editor powering all five; field types text/textarea/richtext/media/select/number/checkbox/stringList/kvList), `components/admin/MediaPicker.tsx` (image field + library modal). Reuses the existing TipTap `RichTextEditor`. Thin API routes at `/api/admin/{services,case-studies,team,articles,testimonials}` + `/api/admin/media` (multipart upload/list/delete via service role). Admin pages at `/admin/{services,case-studies,team,articles,testimonials,media,audit}` (audit = read-only `audit_log` viewer). **Dashboard fully rebuilt** (spec §5.1): live KPI grid (leads new/month/total, services, pages, sections) + Recent Inquiries table + Quick Actions + Collections counts row, all resilient to missing tables. `CmsAdminNav` regrouped: Leads / Collections / Content / Email / System. Public: new `/case-studies`(+`[slug]`), `/team`, `/insights`(+`[slug]`); `/services` grid now reads the `services` table (config fallback); `/about` renders team grid + approved testimonials; `TestimonialsBlock` component; footer + dynamic `sitemap.xml` include the new routes. All public collection fetchers (`lib/cms/collections.ts`) degrade to empty on error. Existing `/services/[slug]` detail pages kept their richer migration-010 `cms_content` copy (table drives admin + grid only). Migrations applied to Supabase 2026-06-10; verified live: public routes 200, `/services` renders seeded rows, admin APIs 401 unauth, admin pages 307→login, build + typecheck clean. Also fixed a pre-existing `next build` blocker (non-route `STATUSES` export in the contact-submissions API route). |
| Phase 11 : FMP-parity admin structure + palette retune | ✅ Complete (2026-07-30) | **Route fix:** `/admin/page-builder` was a 404 (the folder only held `[slug]/`) while the pages list sat at `/admin/pages`, so the sidebar's own "Page Builder" link was broken. The list moved to `/admin/page-builder/page.tsx`; `/admin/pages` was rebuilt as **Pages & Nav**, a navbar-menu editor over the new `site_pages` table (migration 027, RLS default-deny, seeded from `(header_settings, nav_items)`). New `/api/admin/site-pages` via the existing `createCollectionApi` factory; `/admin/leads` added as a redirect alias to the inquiries inbox. **Single source of truth for the navbar:** `fetchHeaderConfig()` now reads `site_pages`, falling back to the legacy `cms_content` JSON row and then `DEFAULT_HEADER_CONFIG`, so a partial migration can never render an empty navbar. The nav-item editor was **removed from `/admin/header-settings`** (which now owns only the header CTA + mobile toggle, matching FMP per `CMS_REFERENCE.md` §1); `nav_items` is optional in that API rather than deleted. **Sidebar regrouped** to FMP order: Dashboard, Content (Page Builder, Header Settings, Header & Branding, Page Content, Pages & Nav, Insights, Testimonials, Media Library, OG Previews), Collections (Services, Case Studies, Team & Advisors), Leads, Email, System. **Palette retuned** (see §9) across `globals.css`, `tokens.ts`, all 13 renderers, layout chrome, public pages, `/api/og`, and `branding_config` (migration 028). Verified: typecheck + build clean, all 20 sidebar destinations 200 authenticated with zero 404s, all 14 public routes 200, navbar renders the same 6 items from `site_pages`, full CRUD round-trip on a throwaway nav row (create to public-navbar to delete) with audit rows written and data restored, zero old colour values and zero em dashes in rendered HTML. |
| Phase 12 (parity 1) : Header Settings consolidation | Complete (2026-08-01) | Branding merged into `/admin/header-settings` as seven cards with a sticky **Save All** at the top, matching FMP. `/admin/branding` is now a redirect; `BrandingForm` deleted; sidebar has one entry with `matchPaths: ['/admin/branding']`. Migration 029 seeds 13 header presentation keys (17 total under `header_settings`). Two deliberate deviations from FMP: tagline stays plain text (it feeds `/api/og` via satori and the footer as text nodes, so markup would render as escaped tags), and brand identity fields stay in the `branding_config` table rather than moving to `cms_content`, because the public Navbar, Footer, `/api/og` and `buildPageMetadata` already read them there. Save All sends one batched request, so one click writes one audit row instead of seventeen. |
| Phase 12 (parity 1b) : Navbar wiring + FMP scaffold removed | Complete (2026-08-01) | The 13 presentation keys are now read by the public Navbar: header height and padding, logo height/width/position, the optional header icon, brand-name and tagline toggles, and nav alignment (migration 030 adds `header_layout`). Settings merge over shipped defaults per field with `??`, so a cleared field can never render a zero-height header. Separately, the untracked `PMBC from FMP/` tree was archived (orphan commit `5926e49`, tag `fmp-cms-archive-2026-08-01`, 59 files) and deleted; 29 reference files were staged outside the repo first. That tree had been contributing **107 TypeScript errors** to the root typecheck. |
| Phase 13 (parity 2) : Semantic green save buttons | Complete (2026-08-01) | Palette decision B: PMBC keeps navy and gold for identity and adopts FMP's green for save semantics only. Tokens `save #2EAA4A`, `saveHover #24913E`, `toastSuccessBg #1A7A30`. New shared `SaveButton` (a component rather than a preset, because inline styles cannot express `:hover`). `SaveStatus` "Saved" became a solid green pill with a checkmark. Nine save surfaces converted. Sign in, Upload, "New entry" and ConfirmDialog stay navy, because they do not commit work. |
| Phase 14 (parity 3) : Page Builder per-section save | Complete (2026-08-01) | Global Save removed. Each section owns its Save, dirty state is tracked per section id (a page-level flag would let one section's Save flush another's pending edit), and the visibility toggle is now local until that section is saved. Reorder, add and delete still persist immediately. Left rail shows an amber dot on sections with pending edits. Verified by isolation test: saving one section leaves its siblings byte-identical. |
| Phase 15 (parity 4) : Create and delete pages | Complete (2026-08-01) | New Page modal with five templates (blank, landing, about, services, contact) seeding canonical section lists via `defaultContentFor`. Per-row delete for non-system pages, lock icon for system pages, enforced **server side** with a 403. Migration 031 adds `cms_pages.is_system`. All 17 existing pages are marked system, not the 8 first assumed: the 9 `service-*` rows supply meta title, description and OG image to live `/services/[slug]` pages via `generateMetadata`, so deleting one would silently downgrade real SEO. |
| Phase 16 (parity 5) : StyleEditor | Complete (2026-08-01) | Per-section presentation control over `page_sections.styles`: background colour and image with overlay, text colour, four paddings, max width, radius, animation, custom class. Collapsed by default. Composes with the Phase 9.5 variant system rather than replacing it: variant first, overrides per CSS property on top, so `styles = {}` renders byte-identically to before. `lib/public/sectionStyles.ts` re-validates every field at render, so a hostile stored value is rejected rather than trusted. |
| Phase 17 (parity 6) : RichTextEditor upgrades + RichTextarea | Complete (2026-08-01) | Editor gains colour, font size, link, image insert, alignment and H1/H3. New compact `RichTextarea` (bold, italic, link) wired into 7 short fields. All `@tiptap/*` deps pinned exactly, since `^3.22.5` resolves to 3.29 and breaks the peer graph. Blocked on a hidden dependency: those fields rendered as plain text nodes, so making them rich required converting the renderers to HTML, which would have widened the unsanitised surface. The sanitiser was pulled forward rather than doing that. |
| Phase 17.5 (parity 6.5) : Sanitise all rich-text output | Complete (2026-08-01) | **Closes S1**, the highest-severity finding in `ADMIN_PARITY_GAP.md` and Phase B of `MIGRATION_PLAN.md`. All 10 remaining `dangerouslySetInnerHTML` sites routed through `lib/cms/sanitize.ts` (8 public plus the 2 email previews). The two JSON-LD blocks are deliberately excluded, since they serialise objects we build ourselves. Email previews got their own wider allowlist so the preview does not lie about what the real email sends. Render diff: **14 of 14 public routes byte-identical**. Hostile payload test: 0 markers reach the DOM. |
| Phase 18 (parity 7) : AuditLogViewer | Complete (2026-08-01) | Shared `AuditLogViewer` with filters (admin, action multi-select, date range), 100-row paging capped at 500 per fetch, and a side-by-side before/after JSON dialog. New read-only `GET/POST /api/admin/audit-log`. Migration 032 adds `before_value`, `after_value`, `reason` plus two composite indexes. `writeAudit` gains diff support and never blocks a mutation, falling back if the columns are absent. Diff capture wired into `collectionApi` (six sections at once), branding, settings, and page/section deletes. Verified against a real create/update/delete cycle. |
| Phase 20 : Founder profile page `/about/ahmad-din` | Complete (2026-08-02) | Mirrors the structure of FMP's page of the same path (read from the real source at `D:/FMP/financial-modeler-pro/app/about/ahmad-din/page.tsx`, not from a description), translated into PMBC's Phase 9.5 visual system. Nine CMS sections, all editable in the page builder: founder hero, Background, Why PaceMakers, Experience & Background (numbered), Expertise Areas (pills), Industry Focus (cards), Market Focus, Modeling Philosophy (quote), Personal. Two new section types, `founder_hero` and `founder_credentials`, plus optional `heading` on the existing `paragraphs` and `quote` (backward compatible: sections without the key render exactly as before). Home `founder_block` gained a proof-point list matching FMP's home card, and its CTA now reads "Read Full Profile" pointing at the new page. Seeded by migration 034 / `npm run seed-founder-profile`. `Person` JSON-LD linked to the existing Organization node. **This reverses Critical Reminder 4** (see the note there). Verified: 44 content and SEO assertions, 0 failures; 16 public routes and 3 admin builder routes 200; zero em dashes in rendered HTML. |
| Phase 19 (parity 8) : Testimonials approval workflow + Pages & Nav inline edit | Complete (2026-08-02) | **Closes the FMP admin-parity programme.** Testimonials is now a moderation queue, not a generic list: status filter tabs with counts, per-row Approve and Reject, Revoke and Reconsider, inline Featured and Show-on-homepage switches, and checkbox bulk approve/reject. `approved_at` is server-owned (absent from the route's zod schemas) and only moves on a real status change, so editing an approved quote's wording does not reset its approval date. Pages & Nav dropped the drawer for an inline table: label and href pend until that row's Save, while visibility, pinning and reorder save immediately, with a new-item row at the bottom. `createCollectionApi` gained `transformWrite`, `guardWrite` and `guardDelete`; the PATCH handler now snapshots the pre-write row before shaping the patch, since both hooks need it. Migration 033 adds `site_pages.can_toggle` (**DDL, run by hand; applied 2026-08-02**), enforced server side for both hide and delete. Everything degrades on a pre-033 database: the UI hides the Pinned control when no row carries the column, and the route replays a write with `can_toggle` stripped if Postgres rejects it, narrowly enough that a 403 guard and a 422 zod failure still pass through. Verified by `scripts/verify-parity8.mjs` in **both** states: 36 of 36 with 033 unapplied (which is what exercised the degradation path), then 39 of 39 once applied. `/contact` is pinned by the migration's seed. |

| Phase 21 : Booking page `/book` | Complete (2026-08-10) | Mirrors FMP's `/book-a-meeting`: one Calendly inline embed, one admin-editable URL, direct contact routes underneath. The Calendly event is the same one FMP books against, read from FMP's live `page_sections` rather than trusting the example URL in its source comments (the repo hardcodes it nowhere). **One deliberate divergence from FMP:** FMP stores its booking URL inside the home page's founder section content, coupling a site-wide setting to one section on one page. PMBC keeps it in `site_settings.booking_url`, edited under Site Settings, so any page can read it and one edit repoints every booking surface. `CalendlyEmbed` is a server component: the widget container is server-rendered so layout is final before third-party code runs, and `next/script` with `lazyOnload` injects the script once the browser is idle. Empty URL is a supported state and renders a panel plus the direct contact routes instead of an empty frame. CTAs wired via migration 038: the founder profile's secondary CTA already read "Book a Meeting" but carried an empty href, so `FounderHero` had been suppressing the button entirely. Not added to the navbar, by instruction. Footer (Firm column) and `sitemap.ts` both carry it. Verified: hero, embed container, `data-url`, fallback link and metadata all present in the server HTML, 200 on `/book`, typecheck plus build clean, zero em dashes. |

| Phase 21.5 : Booking CTA prominence | Complete (2026-08-10) | Four changes, all content-driven via migration 039. **Navbar CTA** now reads "Book a Meeting" pointing at `/book`, resolving a redundancy where both the Contact nav item and the "Start a Conversation" button led to `/contact`. The nav item is untouched and `/book` is still absent from `site_pages`, so it remains a CTA rather than a seventh nav entry. **Contact page** gained a proper booking callout above the form (cream, 3px gold left border, calendar icon, navy button) replacing the subtle strip, plus a founder direct-discussion card in the right column whose portrait is read from the `founder_hero` section via the new `fetchFounderPhotoUrl()` rather than hardcoded, so a page-builder upload flows through. **Home founder card** gained a second CTA: the dormant `cta_secondary` pair (label "Connect on LinkedIn", empty href, so nothing rendered) was repurposed for "Book a Meeting" at `/book`, and `FounderBlock`'s secondary CTA became a solid navy button so the two CTAs read as a hierarchy. **That restyle also applies to `/about`'s founder card**, whose secondary CTA ("Start a Conversation") is likewise an action and now renders as a button. 039 also deletes the `(booking, contact_link_label)` row that 038 seeded, since the callout that replaced the strip no longer reads it and a live-looking admin key controlling nothing is worse than no key. |

| Phase 22 : Direct media upload, video and GIF, dark-background logo | Complete (2026-08-10) | **No migration; code only.** New `src/lib/media.ts` is the single vocabulary both sides share (type detection, MIME lists, size ceilings, companion-key naming). New `MediaField` (drag and drop, upload, library picker, collapsed Paste URL, clear) replaces the bare URL inputs in all seven media slots: `text_image`, `founder_block`, `founder_hero`, `network_partners` (per partner), `fmp_intro`, `quote`, plus the StyleEditor background and the three header-settings logo fields. `/api/admin/media` now accepts `video/mp4` and `video/webm` at a 25 MB ceiling while images stay at 10 MB, and checks type before size so an unsupported file reports the real problem. New public `Media` picks the renderer: `next/image` for stills, **optimizer bypassed for GIF and SVG** (re-encoding an animated file returns one frozen frame, and the optimizer refuses SVG without `dangerouslyAllowSVG`), and `VideoMedia` for clips. `VideoMedia` is the only client component added, because `prefers-reduced-motion` cannot stop autoplay from CSS: on reduce it pauses, calls `load()` to restore the poster frame (pausing alone leaves a meaningless mid-motion still), and reveals controls so the viewer can still opt in. Playback settings travel with the URL as `<base>_media_type` / `_poster_url` / `_autoplay` / `_loop` / `_controls`, derived from the URL key rather than a bare `media_type`, since `network_partners` holds one media slot per partner. `logo_dark_url` needed no schema work (it already existed in 003 and both `Footer` and `/api/og` already preferred it); what was missing was any way to set it, so it is now a labelled MediaField. Verified against real Supabase Storage: png, animated gif and mp4 uploaded, rendered, asserted, then removed; 22 assertions, 0 failures. |

| Phase 23 : Footer logo sizing | Complete (2026-08-10) | The footer logo was pinned to a hardcoded Tailwind `h-11` (44px) with no control, while the header has had `logo_height_px` / `logo_width_px` since 029. Migration 040 adds three keys to the existing `footer_settings` section: `footer_logo_height_px` (48, bounded 24 to 120), `footer_logo_width_px` (blank means auto by aspect ratio), `footer_logo_enabled`. New `/admin/header-settings` **Footer card** holds all footer branding together, including `logo_dark_url` **moved out of the Logo card**, since the footer is the only surface that uses it and splitting the asset from its sizing made neither obvious. The card carries a live preview on the real `#14304F` background. New `/api/admin/footer-settings` (a separate route because the header route writes every key into the `header_settings` section unconditionally) joins the same Save All batch. **Validation lives in `lib/cms/footerSettings.ts`, not the route**, so the API bounds and the read-path clamp share one pair of constants, and because a Next route file may only export route handlers. Defence in depth on the read path: blank, non-numeric, zero and out-of-range all resolve to a usable height, because a zero-height logo is invisible with no error anywhere. Verified: 15 render assertions (48, 72, explicit width, disabled, blank, garbage, out-of-range both directions, and no keys at all) plus 24 schema cases. |

| Phase 24 : Favicon wired to the CMS | Complete (2026-08-10) | **Two independent faults, both live.** The root layout's `metadata` was a static object with no `icons` key at all, so `branding_config.favicon_url` was stored, editable and read by nothing. Separately, `src/app/favicon.ico` was still the untouched create-next-app default (25931 bytes, added by the Phase 1 scaffold commit and never opened), so the public site was serving **the Next.js logo** as its browser-tab icon. That file is deleted, and the root layout now exports an async `generateMetadata` that resolves the icon through `lib/cms/favicon.ts`. Resolution order: `branding_config.favicon_url`, then `header_settings.icon_url` **only when `icon_as_favicon` is true** (that toggle existed in admin and was read by nothing either, a third dead control), then `branding_config.logo_url`, then no `icons` at all rather than a broken href. `resolveFaviconUrl` cannot throw, because it runs for every page including at build time, where an error would fail the whole build rather than lose an icon. Emits `icon` (with a `type` inferred from the extension), `shortcut` and `apple-touch-icon`. **Caveat:** `/privacy`, `/terms` and the 9 `/services/[slug]` pages are prerendered, so they bake the icon at build time and need a redeploy to pick up a change; every other page is `force-dynamic` and updates immediately. Verified by view-source on 9 routes plus the full fallback chain. |

| Phase 25 : Container alignment + hero refinements | Complete (2026-08-10) | **Alignment:** navbar, footer and sections had three independent container literals that had drifted, and two different box models (see §9). New `src/lib/public/layout.ts` exports `PAGE_GUTTER` + `PAGE_INNER`; navbar, footer and `SectionContainer` all use the same two-element structure. Measured in headless Chrome over CDP: navbar brand and every content container now start at exactly 112.5px at 1440, 352.5px at 1920, 24px at 390, on home, about and services. **Hero:** min-height 88vh to 70vh (`PageHeroFallback` 72vh to 70vh to match), xl headline 80px to 72px plus `text-wrap: balance` so "Advisory from Structure to Exit" fits one line instead of orphaning "Exit", subtitle max-width 720px to 820px plus `text-wrap: pretty`. Eyebrow moved off the brand name via migration 041. **The subtitle width went up, not down as the brief asked**, because measuring the real line breaks showed every width from 780px down still breaks after "family"; only 800px and above ends line one on the comma after "family offices,". Hero changes apply to `/contact` and `/book` too, which were equally tall. |

| Phase 26 : Brevo email migration + three contact addresses | Complete (2026-08-10) | `resend` uninstalled; `src/lib/email/send.ts` rewritten against Brevo's v3 REST API with plain `fetch` and hand-written types (see section 7 for why no SDK). Exported surface unchanged, so no caller was edited, and the graceful fallback is preserved. `from` parses both bare addresses and `Name <addr>`, since the Resend setup used the angled form. **Verified end to end against the live API:** a real contact submission produced both emails, Brevo reports `requests` then `delivered` for each, and the delivered bodies were fetched back from `/v3/smtp/emails/{uuid}` and asserted to carry the branded shell with every `{{variable}}` resolved. **/contact now publishes three addresses** (advisory@, info@, ahmad.din@) with editable labels, stored in `site_settings` via migration 042. That migration **also repoints `admin_email` from the personal Gmail to advisory@**, which was necessary rather than cosmetic: the contact route prefers `site_settings.admin_email` over `EMAIL_TO_ADMIN`, so setting the env var alone would have had no effect. Privacy page sub-processor disclosure updated from Resend, Inc. (US) to Brevo SAS (France, EU). |

| Phase 27 : Optional media on every section type | Complete (2026-08-10) | Any section can now carry an optional image, GIF or video on a fixed key set (`media_url`, `media_type`, `media_poster_url`, `media_position`, `media_caption`, plus the three playback flags). **The contract is the null case:** blank `media_url` renders `children` with no wrapper, no grid and no margin, so every existing page is unchanged. New `lib/cms/sectionMedia.ts` owns the vocabulary and the exclusion set; `SectionMediaLayout` handles the four positions and the gold-framed, small-caps-captioned frame; `SectionContainer` and `Hero` each render children through it. `SectionRenderer` resolves the media once and passes it down, so the exclusion rule lives in one place. **The six types with a dedicated media field are excluded** (`text_image`, `founder_block`, `founder_hero`, `network_partners`, `fmp_intro`, `quote`): two competing image fields with no way to tell which wins would be worse than none. Admin side is a single collapsible **Media** panel mounted beside the StyleEditor, so no section editor was touched. The 9 service detail pages are `cms_content`-driven rather than `page_sections`, so migration 043 seeds their five keys blank to make them visible in `/admin/content`. Frames carry `data-section-media` because `figure` alone cannot distinguish a media frame from `quote`'s pull-quote figure. Verified in headless Chrome: image, video and GIF set on three different section types, exactly 3 frames rendered, exactly 3 section heights moved, every other section unchanged to within 2px, and `/about` plus a service page render zero frames. |

**Admin login:** `meetahmadch@gmail.com`. **The password was rotated on 2026-08-02 and is deliberately not recorded here or anywhere else in this repository.** Writing it down is what made the previous one worthless. Ahmad holds it; if it is lost, `npm run rotate-admin-password` sets a new one using the service-role key in `.env.local`, so there is no lockout risk.

The retired `Admin@2026` remains in this file's git history and in older `SESSION_LOG.md` entries. That history is left intact on purpose: rewriting it would not un-publish the string, and the password no longer opens anything. It is verified dead, not merely replaced (see the rotation entry in `SESSION_LOG.md`).

**Rotate with `npm run rotate-admin-password`, not `npm run seed-admin`.** The rotation script reads the new password from a hidden prompt (no echo, entered twice to catch typos), never writes it to the repo, the terminal or any log, enforces a strength floor, hashes at bcrypt cost 12, then verifies both the stored hash and a real end-to-end NextAuth login. `seed-admin.mjs` hardcodes its password in the file, which is fine for creating a throwaway debug login and wrong for a production one; since the rotation it also refuses to overwrite a row whose hash no longer matches, so a stray run cannot silently downgrade the live credential back to the debug value (override with `ADMIN_SEED_FORCE=1`).

The verification scripts (`smoke-admin`, `smoke-builder`, `verify-parity8`) read `process.env.ADMIN_PASSWORD` and fall back to the debug value, so **after rotation you must `export ADMIN_PASSWORD=...` before running them.** Do not put it in `.env.local`; that file is loaded by the seed scripts and would put the live credential back on disk.

---

## Remaining Before Launch (next to do)

All buildable features are done as of 2026-08-02. **The FMP admin-parity programme is complete**: all eight phases of `ADMIN_PARITY_GAP.md` are closed. Page content is seeded, the public site renders, and the admin console is complete. What is left is operational, content-population, and review work, most of which lives outside the codebase. Pick up here next session.

**Three DDL migrations were applied by hand** (031 `cms_pages.is_system` and 032 `audit_log` diff columns on 2026-08-01, 033 `site_pages.can_toggle` on 2026-08-02). All three are verified live: 033 was confirmed by re-running `scripts/verify-parity8.mjs` (39 of 39 assertions, up from 36 once the three pinning checks stopped being skipped) plus a direct check that the real `/contact` nav row refuses both hide and delete with a 403 while still accepting an ordinary save. If you rebuild this database from scratch, run every migration in order and remember that 031, 032 and 033 need the SQL editor.

**Waiting on a human, not on code:** there are **two unread submissions in `/admin/contact-submissions`**, both `status='new'` with `read_at` never set. The 2026-07-02 one is spam; the **2026-06-21 one (Leslie Merricroft, Al-Mashrea Law Firm) looks genuine and has now gone unanswered for six weeks.** The inbox works correctly; nobody has opened it. This is the single most overdue item on the list.

**Content population for the Phase 10 collections (not blockers; pages degrade gracefully to empty):** the 9 Services are seeded and published; **Case Studies, Insights, Testimonials, and Team are empty** and need real entries via their admin sections before they render publicly. Upload imagery through `/admin/media` first, then reference it in each collection editor. If you want Case Studies / Insights / Team in the public top nav, add them via **Pages & Nav** (they are already in the footer).

> **Correction to a long-standing assumption.** Testimonials was not empty only because nobody had written any. **The form could not save one.** `testimonials` is the only collection table without an `updated_at` column, while `createCollectionApi` stamps one by default, so every create and update returned a 400. That dates to the Phase 10 collections build in June and was found and fixed on 2026-08-01 (parity 7 verification). Testimonials is genuinely writable now. The other four collections were never blocked, so those really are just unwritten.

**Blockers (site is not launch-ready until these are done):**
1. **Production env vars on Vercel.** Set `BREVO_API_KEY`, `EMAIL_FROM_DEFAULT`, `EMAIL_FROM_NAME`, `EMAIL_TO_ADMIN`, `HCAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, and the Supabase keys. `EMAIL_FROM_CONTACT` is optional. Until Brevo is configured the contact form still saves to the inbox but sends no notification or acknowledgement email (the send wrapper degrades gracefully). [user, Vercel dashboard]
2. ~~**Rotate `Admin@2026`**~~ **Done 2026-08-02.** Rotated via `npm run rotate-admin-password`, bcrypt cost 12. Verified independently of the script's own report: the stored hash no longer matches `Admin@2026`, the new password logs in and reaches `/admin` (HTTP 200), and the old one is refused with no session issued. **One caveat: the replacement password was typed into a chat transcript, so it is not fully private.** It is a large improvement on a password published to GitHub, but rotating once more to a value that has never been transcribed is worth doing before launch, and now costs one command.
3. **DNS + SSL** for `pacemakersglobal.com` (apex + `www`) on Vercel, then verify SSL provisioning. [user]
4. **Counsel review of `/privacy` and `/terms`.** After sign-off, remove the "Subject to legal review" badge (hardcoded in both page files). [user reviews; assistant removes badge]

**Post-deploy / verification:**
5. **Submit `https://pacemakersglobal.com/sitemap.xml`** to Google Search Console; verify ownership via DNS TXT.
6. **Refresh the Supabase Security Advisor** and confirm the 10 RLS errors from migration 013 are cleared. [user, Supabase dashboard]
7. **Verify OG cards** render via the LinkedIn / Twitter card debuggers once the domain is live.
8. **Copy review on the live site**, especially the `/about` founder bio and the track-record claims reused on `/sectors` (they describe a real person/firm). If any of the 9 service-detail write-ups should be refreshed, name it and it can be rewritten.

**Asset uploads (visual upgrade, not blockers; renderers fall back gracefully today):**
9. Real PMBC logo (`branding_config.logo_url`, currently a monogram fallback in navbar/footer), Ahmad portrait (`home` and `about` founder_block `photo_url`), network/region image (`home`/`about` text_image), and partner logos (`network` page). Add any new image host to `next.config.ts` `images.remotePatterns` (Supabase + Cloudinary already allowed). [user provides assets; assistant wires them]

---

## 2. Architecture Overview

Single Next.js application, single domain (pacemakersglobal.com), no subdomain routing. Public marketing site plus admin CMS. No student auth, no public registration, no payment flows, no third-party integrations beyond Brevo and Supabase.

### Stack

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Framework | Next.js (App Router) | ^15 | Latest stable. Match FMP's discipline but no need for v16 features. |
| Language | TypeScript strict | ^5 | strict mode on |
| Styling | Tailwind CSS 4 | ^4 | Same as FMP |
| State | Zustand | ^5 | Only if needed; most pages are server components |
| Database | Supabase (@supabase/supabase-js) | ^2 | New project, separate from FMP |
| Auth | NextAuth.js (JWT, admin-only) | ^4 | Single admin role, no public users |
| Email | Brevo v3 REST API | no SDK | Contact form notifications. Plain `fetch`, see section 7. |
| Image | sharp | ^0.34 | OG image logo conversion |
| OG Images | next/og (satori ImageResponse) | built-in | Dynamic OG cards |
| Icons | lucide-react | ^1 | Lucide moved to a 1.x major in 2024. v1.x is current and correct : do **not** "downgrade" to 0.x. |
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
│   │   ├── page-builder/page.tsx       # List all CMS pages (Builder button per row)
│   │   ├── page-builder/[slug]/page.tsx
│   │   ├── pages/page.tsx              # Pages & Nav: navbar menu items (site_pages)
│   │   ├── leads/page.tsx              # Redirect alias to contact-submissions
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
│   │   ├── send.ts                     # Brevo wrapper
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
- `hero`: main page hero with badge, headline, subtitle, CTA
- `stats_block`: large number callouts (100+, SAR 20B+, etc.)
- `service_cards`: grid of service cards with number, title, description, link
- `service_detail`: full detail block for a single service (used on /services/[slug])
- `sector_grid`: sector coverage grid
- `process_steps`: numbered methodology steps
- `network_partners`: Sky Gulf and Lynkers blocks
- `founder_block`: founder photo, name, credentials, bio
- `text_image`: alternating text-image rows
- `paragraphs`: rich text paragraphs (Tiptap-rendered HTML)
- `cta_block`: single call-to-action panel
- `quote`: pull quote with attribution
- `fmp_intro`: Financial Modeler Pro introduction block (one specific section type for the FMP page)
- `founder_hero`: page-leading founder identity (portrait, name, two-line title, credentials, CTAs). Added 2026-08-02 for `/about/ahmad-din`. Distinct from `founder_block`, which is the mid-page summary card on home and about. **Each stores its own `photo_url`**, and there is no shared founder-photo source in `branding_config`, `site_settings` or `team_members`. That is by design (a section owns its content, and a card may want a different crop), but it means uploading a portrait in the page builder sets it on one section only. `npm run sync-founder-photo` copies it onto any card still empty without touching one deliberately given a different image
- `founder_credentials`: heading plus a list of short strings, rendered as `numbered`, `pills`, or `cards` per a `display` key. One type rather than three, because the three founder-profile list blocks differ only in presentation

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

The `accent_color` default above is the original 003 value. Migration 028 retunes the live row to `#C69C3E` (see §9), so a fresh setup that runs 003 then 028 ends up on the current palette. The column default is intentionally left alone: applied migrations are never edited.

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
010-020                           -- Content seeds (service details, home, then the
                                  --   six firm pages + services/contact intros).
021-026                           -- Phase 10 advisory collections + storage buckets.
027_site_pages_nav.sql            -- site_pages table (navbar menu items), RLS default-deny,
                                  --   seeded from (header_settings, nav_items). Source of
                                  --   truth for the navbar; edited at /admin/pages.
028_retune_brand_colors.sql       -- branding_config + email_branding colour retune
                                  --   (accent_color -> #C69C3E). Idempotent.
029_header_settings_keys.sql      -- 13 header presentation keys under
                                  --   (header_settings, *). Seeds only, additive.
030_header_layout_key.sql         -- header_layout (default|centered|spread). PMBC
                                  --   addition, not one of FMP's 17 keys.
031_cms_pages_is_system.sql       -- cms_pages.is_system. DDL. Marks all 17 existing
                                  --   pages as system so the admin delete button
                                  --   cannot remove a page backing a live route.
032_audit_log_diff_columns.sql    -- audit_log before_value / after_value / reason
                                  --   (JSONB, JSONB, TEXT) + two composite indexes
                                  --   for the viewer's filter paths. DDL.
033_site_pages_can_toggle.sql     -- site_pages.can_toggle. DDL. False pins a nav
                                  --   item: /api/admin/site-pages refuses to hide
                                  --   or delete it, and the admin locks its
                                  --   Visible switch. Pins /contact by default.
034_seed_founder_profile.sql      -- !! DESTRUCTIVE ON RE-RUN, see the file header.
                                  --   DELETEs every section on /about/ahmad-din
                                  --   and reinserts the ORIGINAL seed copy, so
                                  --   re-applying it discards admin edits to that
                                  --   page. Run only to rebuild from scratch.
                                  -- Founder profile /about/ahmad-din: cms_pages row
                                  --   + 9 page_sections, plus the home founder_block
                                  --   CTA repoint and proof points. DML only, so
                                  --   `npm run seed-founder-profile` applies it.
                                  --   Idempotent (deletes this page's sections first).
035_founder_prose_alignment.sql   -- Sets align='justify' on the two long-form
                                  --   founder prose blocks (20, 30). DML only,
                                  --   `npm run seed-founder-alignment`. Short
                                  --   blocks stay left. Idempotent.
036_strip_empty_paragraphs.sql    -- Removes stored empty paragraphs from
                                  --   page_sections content. DML only,
                                  --   `npm run strip-empty-paragraphs`
                                  --   (supports --dry-run). Rendering already
                                  --   strips them, so this is about making the
                                  --   stored value match. Idempotent.
037_sync_founder_photo.sql        -- Copies the portrait from the founder_hero on
                                  --   /about/ahmad-din onto every founder_block
                                  --   card whose photo_url is empty. Reads the URL
                                  --   from the DB rather than hardcoding it, so a
                                  --   rebuild on another Supabase project is safe.
                                  --   DML only, `npm run sync-founder-photo`
                                  --   (supports --dry-run). Idempotent.
038_booking_page.sql              -- Booking page /book: site_settings.booking_url
                                  --   (the Calendly event, site-wide and admin
                                  --   editable), the cms_pages row (is_system),
                                  --   its hero section, the founder profile's
                                  --   booking CTA, and 10 cms_content rows under
                                  --   a new `booking` section. DML only,
                                  --   `npm run seed-booking-page` (supports
                                  --   --dry-run). Idempotent AND non-destructive:
                                  --   every statement is guarded, so unlike 034
                                  --   a re-run cannot overwrite admin edits.
040_footer_logo_sizing.sql        -- Three footer logo presentation keys under
                                  --   the existing footer_settings section:
                                  --   footer_logo_height_px (48, bounded 24 to
                                  --   120), footer_logo_width_px (blank = auto),
                                  --   footer_logo_enabled (true). DML only,
                                  --   `npm run seed-footer-logo-sizing`
                                  --   (supports --dry-run). Idempotent,
                                  --   ON CONFLICT DO NOTHING.
043_service_media_keys.sql        -- Five shared media keys, seeded BLANK, for
                                  --   each of the 9 `service_<slug>` cms_content
                                  --   namespaces (45 rows). Those pages are not
                                  --   page_sections rows, and /admin/content only
                                  --   lists keys that exist, so without this an
                                  --   operator would have to add each by hand.
                                  --   Blank media_url is the "no media" state, so
                                  --   nothing renders differently. DML only,
                                  --   `npm run seed-service-media-keys`
                                  --   (supports --dry-run). ON CONFLICT DO NOTHING.
042_contact_addresses.sql         -- Three published contact addresses plus their
                                  --   labels in site_settings (advisory@, info@,
                                  --   ahmad.din@). ALSO repoints admin_email from
                                  --   the personal Gmail to advisory@, because
                                  --   the contact route prefers that key over the
                                  --   EMAIL_TO_ADMIN env var. DML only,
                                  --   `npm run seed-contact-addresses` (supports
                                  --   --dry-run). Each key written only when
                                  --   blank; admin_email guarded on the old value.
041_home_hero_eyebrow.sql         -- Home hero eyebrow from the brand name (which
                                  --   the logo above already says) to
                                  --   "CORPORATE FINANCE AND TRANSACTION
                                  --   ADVISORY". DML only, `npm run
                                  --   seed-home-hero-eyebrow` (supports
                                  --   --dry-run). Guarded on the old value, so a
                                  --   re-run never overwrites an operator edit.
039_booking_cta_prominence.sql    -- Booking CTA prominence: navbar CTA repointed
                                  --   (header_settings cta_label / cta_href ->
                                  --   Book a Meeting, /book), contact callout +
                                  --   founder card copy (cms_content `booking`
                                  --   and `contact`), and the home founder_block
                                  --   second CTA. Also DELETEs the now-orphaned
                                  --   (booking, contact_link_label) that 038
                                  --   seeded. DML only, `npm run seed-booking-cta`
                                  --   (supports --dry-run). Idempotent; the
                                  --   navbar CTA only moves while it still holds
                                  --   the old /contact value.
```

After running migrations, manually insert one admin_users row via SQL with a bcrypt hash for the password.

**DDL migrations must be run by hand.** 031, 032 and 033 use `ALTER TABLE`, which supabase-js cannot execute. The Supabase CLI is not installed and `.env.local` carries no direct Postgres connection string, so the seed-script pattern used for 029 does not work for them. Paste them into the Supabase SQL editor. Every consumer of those columns degrades safely if the migration has not run: the page list treats a missing `is_system` as "system" so nothing is deletable, `writeAudit` retries without the diff columns rather than failing the mutation, and `/api/admin/site-pages` replays a write with `can_toggle` stripped when Postgres rejects the column (so Pages & Nav keeps working, minus pinning).

---

## 4. CMS Architecture

### Two-Layer Pattern

PMBC uses the same two-layer CMS pattern as FMP:

**Layer 1: cms_content (key-value)**: for content that doesn't belong to a specific page or section. Logo URLs, brand name, contact email, footer copyright, default SEO description, social URLs. Section + key + value structure. Read once, cached for the request.

**Namespace convention:** one row per atomic key. JSON-array values (e.g. `(header_settings, nav_items)`) are allowed when the value is naturally a list, but discrete keys are preferred over bundled JSON blobs: `(header_settings, cta_label)`, `(header_settings, show_cta)`, etc., not a single `config` row that contains all of them. Migration 009 splits the legacy `config` blob accordingly.

**Layer 2: page_sections (block-based)**: for the main body content of each page. One row per content block, ordered by `display_order`, rendered through a section-type registry. Editable via drag-and-drop page builder.

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
| `/about` | about | The firm. Founder summary card linking to the full profile. |
| `/about/ahmad-din` | about-ahmad-din | Founder profile. Nine CMS sections mirroring the structure of FMP's page of the same path. |
| `/financial-modeler-pro` | financial-modeler-pro | Full page introducing FMP, ending in CTA to visit FMP |
| `/contact` | contact | Contact form, direct contact info |
| `/book` | book | Booking page. CMS hero plus a Calendly inline embed reading `site_settings.booking_url`. Deliberately not in the top nav (footer and CTAs only). |
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

`/book` is deliberately kept out of the top nav. It is reached from the founder profile CTA, the contact page, and the footer, so the nav stays at six items.

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
| `/admin/page-builder` | Pages list, with a Builder button per row, a **New Page** modal (five templates) and per-row delete for non-system pages |
| `/admin/page-builder/[slug]` | Three-pane section editor. **Per-section Save** since parity 3, plus a StyleEditor per section since parity 5 |
| `/admin/pages` | Pages & Nav: the navigation menu that drives the public navbar (`site_pages` rows). Nav links only, not page content. **Inline-edit table** since parity 8: label and href pend until that row's Save; visibility, pinning and reorder save immediately |
| `/admin/testimonials` | Testimonials moderation queue: status filter tabs, per-row Approve and Reject, Revoke and Reconsider, inline Featured and Show-on-homepage switches, checkbox bulk actions. Drawer editor for the wording |
| `/admin/content` | Key-value editor for cms_content (grouped by section) |
| `/admin/branding` | **Redirect to `/admin/header-settings`** since parity 1. Kept for older bookmarks |
| `/admin/header-settings` | Brand colours, logo, branding text, header icon, header layout, CTA and mobile. Seven cards, one Save All. Owns the 17 `header_settings` keys plus the `branding_config` row |
| `/admin/contact-submissions` | List and view contact form submissions, change status, add notes |
| `/admin/email-branding` | Email logo, signature, footer. Previews are sanitised through `sanitizeEmailHtml` |
| `/admin/email-templates` | Edit email subject and body for the two templates |
| `/admin/audit` | Audit log viewer: filters (admin, action, date range), 100-row paging, before/after JSON diff |
| `/admin/settings` | Misc site settings (analytics IDs, social URLs, etc.) |

### Sidebar (`src/components/admin/CmsAdminNav.tsx`)

Single component handling both desktop and mobile chrome (no separate `AdminSidebar` / `AdminMobileNav` / `LogoutButton` components: those were collapsed into this one in Phase 4.5).

- 240px expanded · 64px collapsed (icons only)
- Collapse persisted to `localStorage['pmbcAdminSidebarCollapsed']`
- Scroll position persisted to `sessionStorage['admin_sidebar_scroll']`, restored on `pathname` change
- Off-canvas drawer below 768px viewport with hamburger button + body-scroll lock + click-backdrop-to-close
- Active state by exact-match OR prefix-match against per-item `matchPaths` (e.g. "Page Builder" stays highlighted while inside `/admin/page-builder/...`, "Inquiries" also matches `/admin/leads`)
- Active item gets `#1B3A5F` background + **3px gold (`#C69C3E`) left border**
- Group dividers labeled `Content` / `Collections` / `Leads` / `Email` / `System` (FMP-parity order set in Phase 11). `Collections` holds the PMBC-only Phase 10 tables that have no FMP counterpart.
- Footer: external links to `https://www.pacemakersglobal.com` (View Live Site) and `https://www.financialmodelerpro.com` (Visit FMP), both `target="_blank"`. Sign-out lives below those.

### Admin styling

All admin pages use **inline styles**, not Tailwind utility classes. Shared design tokens live in `src/lib/admin/styles.ts`: colors, layout constants, and ready-made `CSSProperties` presets (`adminCard`, `adminInput`, `adminButtonPrimary`, etc.). This intentionally isolates the admin console from the public-site theme so future public-site work can't accidentally restyle the dashboard. The PMBC palette (deep navy `#0F2540` sidebar, navy `#1B3A5F` primary, gold `#C69C3E` accent, page bg `#F4F7FC`) is anchored here. Note the isolation is about structure, not the brand accent: Phase 11 moved the admin gold in step with the public gold (`#D4A93A` to `#C69C3E`) so the console does not visibly diverge from the site, while the structural colors (sidebar `#0F2540`, primary `#1B4F8A`) stay independent.

### Admin API conventions

- All `/api/admin/*` routes session-gate via `getAdminSession()` (401 if absent), zod-validate the body, and write an `audit_log` row on success.
- Mutations accept both `PATCH` (FMP-style) and `POST` (legacy alias) on `/api/admin/{content,branding,settings,email-branding,email-templates,header-settings}`.
- `/api/admin/content` GET returns `{ rows: [...] }`; PATCH does upsert (try update, then insert) on `(section, key)` pairs.
- `/api/admin/branding` GET returns `{ row: ... }`; mutations return the updated row in `{ row: ... }`.
- Errors always: `{ error: string }` + non-2xx status.

### Page Builder

Three-pane layout matching FMP's pattern:
- **Left pane**: list of sections on the current page with drag handles, visibility toggle, delete button, and "Add Section" button at bottom
- **Center pane**: editor for the currently selected section (the appropriate editor component from `editors/`), with that section's own Save header above it and a collapsible **StyleEditor** below it
- **Right pane**: live preview iframe pointed at the page (with `?preview=1` so hidden sections still render). **Hidden by default since 2026-08-02**, behind a "Preview" toggle in the top bar; the preference persists in `localStorage['pmbcPageBuilderPreviewVisible']`. Open, the centre splits 60/40 editor/preview; closed, the editor takes the full column. The pane unmounts rather than hiding with CSS, so a closed preview costs no page load. It still re-keys after every Save / Add / Delete / reorder. The "Open preview" link (new tab) stays regardless.

**Slug is not the URL.** `cms_pages.slug` and the public route diverged in Phase 7, when the catch-all `(public)/[slug]` was replaced by bespoke routes. Use `publicPathForPageSlug` / `previewPathForPageSlug` from `src/lib/cms/pageRoutes.ts`, never `` `/${slug}` ``. The exceptions are `home` to `/`, `service-<x>` to `/services/<x>` (9 pages), and `about-ahmad-din` to `/about/ahmad-din`. Both the page-builder preview and `/admin/og-preview` had hardcoded `` `/${slug}` `` and were pointing at 404s. A new nested page needs a line in that file.

**Save model (parity 3, matching FMP).** Each section owns its own Save. There is no global Save button. Dirty state is tracked per section id, never per page, so saving one section cannot flush another section's half-finished edit.

| Operation | Persists |
|---|---|
| Reorder (drag) | Immediately on drop |
| Add section | Immediately, server side, so the row has a stable id to edit against |
| Delete section | Immediately, behind the confirm dialog |
| Content edit | Pending until that section's Save |
| Visibility toggle | Pending until that section's Save |

Sections with pending edits show an amber dot in the left rail, and the top bar shows a count. A `beforeunload` guard fires while anything is unsaved.

---

## 7. Email System

### Brevo Setup

**Migrated from Resend to Brevo on 2026-08-10.** One Brevo account, one authenticated sending domain (`pacemakersglobal.com`). Create the API key under **SMTP & API, then API Keys**. Domain authentication (SPF, DKIM, DMARC) follows Brevo's standard flow and must be completed or mail lands in spam.

No SDK. `src/lib/email/send.ts` posts to `https://api.brevo.com/v3/smtp/email` with plain `fetch`. Sending is a single POST to a single endpoint, so `@getbrevo/brevo` buys nothing while costing loose OpenAPI-generated types, a transitive HTTP stack, and CJS/ESM friction inside the Next server bundle. The request and response are typed by hand in that file.

The exported surface (`sendEmail`, `SendEmailArgs`, `SendEmailResult`) is unchanged from the Resend implementation, so no caller was edited. The graceful fallback is unchanged too: a missing `BREVO_API_KEY` or sender logs a warning and returns `{ ok: false, reason: 'not_configured' }` without throwing, so the contact form still saves to the admin inbox on a deployment where email is not wired up.

`from` accepts either a bare address or `Name <addr@example.com>`; Brevo needs the two parts separately, and the old Resend setup used the angled form, so both are parsed. `EMAIL_FROM_NAME` supplies the display name when the address carries none.

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
// src/lib/email/send.ts (shape only, see the file for the real implementation)
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = parseAddress(args.from || process.env.EMAIL_FROM_DEFAULT || '');
  if (!apiKey || !sender) return { ok: false, reason: 'not_configured' };

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender,
      to: recipients(args.to),
      subject: args.subject,
      htmlContent: args.html,
    }),
  });
  // ... error handling, returns { ok: true, id } on success
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
| `--color-primary-deep` | `#14304F` | Deeper navy for contrast layers, footers, panels. |
| `--color-secondary` | `#3FA663` | Green. Accent for CTAs, success states, highlights. |
| `--color-accent` | `#C69C3E` | Gold. Sparingly used for premium accent: borders, dividers, badges. |
| `--color-accent-muted` | `#A88530` | Muted gold for uppercase eyebrow text and secondary accents. |

**Live token values are in `src/app/globals.css` (`--pmbc-*`) and mirrored in `src/lib/public/tokens.ts`. Keep the two in sync.** Phase 11 retuned the palette: primary navy `#153D64` to `#1B3A5F` (warmer, less black), deep navy `#0F2F4F` to `#14304F`, gold `#D4A93A` to `#C69C3E` (richer, less bright), muted gold `#B89530` to `#A88530`. Cream `#FAF7F2` unchanged. The hero radial gradient was re-anchored on these tokens (`#1F4269` / `#1B3A5F` / `#14304F`); its old stops bottomed out at `#0C2741`, which was the main reason the hero read as too dark.
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

### Rich text (`.pmbc-prose`)

**This project does not install `@tailwindcss/typography`, and must not start using `prose` classes.** Tailwind's preflight resets everything to `margin: 0`, so before 2026-08-02 every `prose` / `prose-neutral` / `prose-invert` class in the codebase was a no-op and all CMS body copy rendered with zero spacing between paragraphs, site-wide. The replacement is a hand-written `.pmbc-prose` layer at the end of `src/app/globals.css`: paragraph and list spacing, serif headings on PMBC's scale, gold list markers and blockquote rule, gold-underlined links, and a `p:empty` rule so a deliberate blank line from the editor survives.

- Use `pmbc-prose` on any element rendering operator HTML. Add `pmbc-prose-invert` on navy sections.
- `PROSE_MEASURE` (780px) in `src/lib/public/prose.ts` is the shared column width for long-form copy, roughly 70 characters at the 17px body size. Section backgrounds still span the full 1200px container; only the text column narrows.
- `paragraphs` sections carry an optional `align` (`left` default, plus `center` / `right` / `justify`). Justified copy also gets `pmbc-prose-justify`, which turns on automatic hyphenation.
- Inline `margin` is deliberately **not** allowlisted in the sanitiser. Paragraph rhythm is a stylesheet concern; letting one operator edit set arbitrary margins would break the vertical rhythm unpredictably. `text-align`, `color` and `font-size` are allowlisted.
- **Empty paragraphs are removed, not styled.** Word, Google Docs and TipTap all express a blank line between paragraphs as an empty `<p></p>`, which is redundant here because `.pmbc-prose p` already carries a bottom margin. Left in, they double or triple the gap, and since authors are inconsistent about inserting them the column loses its rhythm. `collapseEmptyParagraphs` in `src/lib/cms/richText.ts` drops them, and it runs in three places: inside `sanitizeRichHtml` at render (so existing content is correct with no admin work), on the `page_sections` save path (so stored content matches what renders), and as a one-off backfill in migration 036. A paragraph containing only an image or other void element is **not** treated as empty. **Never give `p:empty` height in CSS**, which was tried once and stacked a full line box on top of both adjoining margins.
- Normalisation happens at the save boundary, never in the editor's `onChange`: stripping an empty paragraph mid-keystroke would delete the one the author just created by pressing Enter, and fight the cursor.

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Hero headline | Source Serif Pro / Playfair Display | 56-72px | 600 |
| Section headline | Source Serif Pro / Playfair Display | 36-48px | 600 |
| Subheadline | Inter | 18-22px | 400 |
| Body | Inter | 16-18px | 400 |
| Caption / label | Inter | 12-14px | 500 (uppercase, tracked) |

Decision pending on serif choice: present both during build phase. Both load via Google Fonts with `next/font`.

### Layout Tokens

- Max content width: 1200px everywhere, via `PAGE_GUTTER` + `PAGE_INNER` in `src/lib/public/layout.ts`. **Use those two constants rather than a fresh `max-w-[...]` literal.** The navbar and footer previously carried their own `max-w-[1280px] px-6 lg:px-8` while sections used `max-w-[1200px]` inside a `px-6` wrapper, so the logo sat 32px left of the content beneath it at 1440px. Matching the numbers alone would not have fixed it: a single element carrying both `max-w` and `px` puts padding *inside* the max width under `box-sizing: border-box`, while the section pattern puts it outside. Both halves are exported so every surface uses the same two-element structure. Heroes keep a narrower 1100px inner box on purpose; their text is centred, so that box is not a left-edge reference.
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

# Brevo (transactional email)
BREVO_API_KEY=
EMAIL_FROM_DEFAULT=info@pacemakersglobal.com
EMAIL_FROM_NAME=PaceMakers Business Consultants
EMAIL_TO_ADMIN=advisory@pacemakersglobal.com
# Optional, overrides the From on the acknowledgement to the enquirer.
EMAIL_FROM_CONTACT=

# hCaptcha
HCAPTCHA_SECRET_KEY=
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=

# Optional
NEXT_PUBLIC_GA_ID=
```

---

## 11. Build Sequence

Follow this order. Don't skip ahead. Each phase is testable on its own.

### Phase 1: Scaffold and Database (Day 1): ✅ Complete (2026-04-30)
1. `npx create-next-app@latest` with TypeScript, Tailwind, App Router, src/ directory, Turbopack
2. Install dependencies (see Section 2)
3. Set up Supabase project, get keys, populate `.env.local`
4. Run migrations 001-008
5. Insert one admin user via SQL with bcrypt hash
6. Verify Supabase connection from a server component

### Phase 2: Auth and Admin Shell (Day 1-2): ✅ Complete (2026-05-02)
1. NextAuth config with credentials provider hitting admin_users
2. Middleware protecting `/admin/*`
3. Admin login page
4. Admin layout (sidebar nav, header with logout)
5. Empty admin dashboard

### Phase 3: CMS Foundations (Day 2-3): ✅ Complete (2026-05-02)
1. cms_content key-value editor at `/admin/content`
2. Branding admin at `/admin/branding`
3. Site settings at `/admin/settings`
4. Email branding and templates admin

### Phase 4: Page Builder (Day 3-5): ✅ Complete (2026-05-02)
1. `/admin/pages` listing
2. `/admin/page-builder/[slug]` three-pane layout
3. Section editors for: hero, paragraphs, stats_block, service_cards (start with these four)
4. Drag-and-drop reorder
5. Save and visibility toggle

### Phase 5: Public Pages: Core (Day 5-7)
1. Root layout with Navbar + Footer (CMS-driven)
2. Section renderer with the four section types built so far
3. Home page rendering from page_sections
4. Services overview page
5. Contact page with form, contact API route, email templates wired up

### Phase 6: Remaining Section Types (Day 7-9): ✅ Complete (2026-05-03)
Editors + public renderers shipped for the 9 outstanding types: `sector_grid`, `process_steps`, `network_partners`, `founder_block`, `text_image`, `cta_block`, `quote`, `fmp_intro`, `service_detail`. All marked `implemented: true` in `SECTION_TYPES`; `SectionRenderer` and `SectionEditorPanel` registries cover all 13 types. Shared 21-icon lucide registry at `src/lib/cms/sectorIcons.tsx` powers both the sector-grid editor dropdown and the public renderer.

### Phase 7: Remaining Pages (Day 9-11): ✅ Complete (2026-05-03)
Bespoke routes shipped at `src/app/(public)/{about,sectors,approach,network,financial-modeler-pro}/page.tsx`, plus `src/app/(public)/services/[slug]/page.tsx` for the 9 service detail pages. The catch-all `(public)/[slug]/page.tsx` was deleted: all CMS-managed pages now have explicit routes; missing pages 404 explicitly rather than silently rendering an unconfigured slug. Service-detail content lives in `cms_content` under namespace `service_<slug>` (migration 010); the route renderer parses `deliverables` robustly (JSON first, newline-split fallback). `src/app/sitemap.ts` and `src/app/robots.ts` shipped alongside.

### Phase 8: SEO and Polish (Day 11-13): ✅ Complete (2026-05-03)
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

> **Update (Phase 10, 2026-06-10):** Articles/Insights and Case Studies are now BUILT (see the Phase 10 status row); `PACEMAKERS_ADMIN_CMS_SPEC.md` re-scoped them in as managed collections. The two bullets marked **(BUILT Phase 10)** below are retained for history; they render empty/graceful until real content is added.

- **Articles / Blog (BUILT Phase 10)**: now a managed `articles` table, admin at `/admin/articles`, public `/insights` + `/insights/[slug]`. The original deferral (mirror/syndicate from FMP) is superseded; PMBC now authors its own insights. Cross-posting from FMP remains an option but is not wired.
- **Newsletter subscriber list**: No email capture for marketing in v1. Contact form only.
- **Case study detail pages (BUILT Phase 10)**: `case_studies` table, admin at `/admin/case-studies`, public `/case-studies` + `/case-studies/[slug]` with a headline-metrics (`metrics` JSONB) block. Still needs real anonymized write-ups before anything renders publicly.
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
- The About / Founder block on PMBC mentions FMP as Ahmad's platform. **Since 2026-08-02 the full bio lives on PMBC's own `/about/ahmad-din`,** not on FMP. The home founder card links there ("Read Full Profile"). See the reversal note under Critical Reminder 4.

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
4. ~~**No duplication of FMP's founder content.** Link out to FMP for the deep professional bio.~~ **Reversed 2026-08-02 by explicit instruction.** PMBC now hosts its own founder profile at `/about/ahmad-din`, mirroring the structure of FMP's page of the same path. The reasoning for the original rule still deserves a hearing, so it is recorded rather than deleted: two near-identical bios on two domains is duplicate content, and it splits the SEO signal for "Ahmad Din" between them. The counter-argument that won: PMBC is the parent entity and the credibility document for family offices, and sending a prospective client off-site to a training platform to find out who is leading their mandate is worse than the SEO cost. **The two pages are deliberately not identical**: PMBC's carries "Why PaceMakers" (advisory positioning) where FMP's carries "Why Financial Modeler Pro" (platform positioning), and PMBC omits FMP's Notable Projects and booking-led CTAs. If both pages ever converge on identical copy, revisit this, and consider a canonical pointing at PMBC as the parent entity.
5. **Pakistan is operational headquarters, not the marketing-front geography.** Lead with KSA and GCC. Lahore is mentioned only as where the analytical work happens.
6. **CMS-first.** Every public page section should be editable from the admin panel. If something is hardcoded, it should be a deliberate exception (privacy/terms only).
7. **One admin user.** Ahmad. Don't build user management, role hierarchies, or invite flows in v1.
8. **Match FMP's quality bar, not its complexity.** Clean migration discipline, typed Supabase queries, server-first rendering, branded emails, OG images. But no Apps Script, no dual auth, no quizzes, no certificates.

---

End of technical handoff. Read this in full before starting any new task. Update this file as architectural decisions are made or change.

---

## Session Log

The full chronological session log has moved to [`SESSION_LOG.md`](./SESSION_LOG.md) to keep this file lean (`CLAUDE.md` is loaded into context every session). Read `SESSION_LOG.md` when you need the detailed build history, decisions, and lessons from prior phases. The **Current Status** table near the top of this file is the quick-reference summary of phase progress.
