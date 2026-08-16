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
`CMS_REFERENCE.md` (65) and `PACEMAKERS_ADMIN_CMS_SPEC.md` (30) are both inherited reference documents and are exempt. Live content: migrations 005, 008, 010, 011, 014 to 020 (all applied, so never edit them; fix the rendered content instead), the three `not-found`/`error` files, and the email templates seeded in migration 008. **`(public)/privacy` and `terms` are off this list**: both were measured on 2026-08-16 while their counsel-review edits were made, and both return zero, so whatever was there had already gone.

---

## Current Status

**All 48 phases are complete except Phase 9, and everything remaining in Phase 9 is operational rather than code**: content population, counsel review, DNS, production environment variables. The public site renders on sixteen routes, the admin console is complete and at parity with FMP, and 63 migrations are applied.

**The per-phase summary index moved to [`PHASE_HISTORY.md`](./PHASE_HISTORY.md) on 2026-08-16**,
along with the detailed rows that were already there. This file states where the
project is, not how it got here. Read the history when you need to know **why**
something is the way it is before changing it.

**Full detail for every phase, including the reasoning and the things that went wrong, is in [`PHASE_HISTORY.md`](./PHASE_HISTORY.md).** It was split out of this file on 2026-08-13 for the reason stated at the top of it: this file is loaded into context at the start of every session, and that table had grown to 75KB.

**Admin login:** `meetahmadch@gmail.com`. **The password was rotated on 2026-08-02 and is deliberately not recorded here or anywhere else in this repository.** Writing it down is what made the previous one worthless. Ahmad holds it; if it is lost, `npm run rotate-admin-password` sets a new one using the service-role key in `.env.local`, so there is no lockout risk.

The retired `Admin@2026` remains in this file's git history and in older `SESSION_LOG.md` entries. That history is left intact on purpose: rewriting it would not un-publish the string, and the password no longer opens anything. It is verified dead, not merely replaced (see the rotation entry in `SESSION_LOG.md`).

**Rotate with `npm run rotate-admin-password`, not `npm run seed-admin`.** The rotation script reads the new password from a hidden prompt (no echo, entered twice to catch typos), never writes it to the repo, the terminal or any log, enforces a strength floor, hashes at bcrypt cost 12, then verifies both the stored hash and a real end-to-end NextAuth login. `seed-admin.mjs` hardcodes its password in the file, which is fine for creating a throwaway debug login and wrong for a production one; since the rotation it also refuses to overwrite a row whose hash no longer matches, so a stray run cannot silently downgrade the live credential back to the debug value (override with `ADMIN_SEED_FORCE=1`).

The verification scripts (`smoke-admin`, `smoke-builder`, `verify-parity8`) read `process.env.ADMIN_PASSWORD` and fall back to the debug value, so **after rotation you must `export ADMIN_PASSWORD=...` before running them.** Do not put it in `.env.local`; that file is loaded by the seed scripts and would put the live credential back on disk.

**Two verification scripts were renamed on 2026-08-16** because their names were one character apart and drove different things: `verify-fmp-page` is now **`verify-fmp-parent`** (the `/fmp` page itself) and `verify-fmp-pages` is now **`verify-fmp-subpages`** (the three pages fed from FMP's API). `verify-rename-refm` was retired the same day: it verified migration 047, a one-off rename completed on 2026-08-11. `PHASE_HISTORY.md` and `SESSION_LOG.md` still use the old names, correctly, since they record what was run at the time.

---

## Remaining Before Launch

Updated 2026-08-16. **No code work is blocking launch.** Every phase is complete
bar Phase 9, the public site renders on nineteen routes with every page's copy
editable in the page builder, and the admin console is at parity with FMP.
Everything below is operational, content, review or asset work, and most of it
lives outside this repository.

Ordered by what stops a launch, not by when it was added.

### Blocking

1. **Production environment variables on Vercel.** `BREVO_API_KEY`,
   `EMAIL_FROM_DEFAULT`, `EMAIL_FROM_NAME`, `EMAIL_TO_ADMIN`,
   `HCAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`, `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `FMP_API_URL`, `FMP_API_KEY` and the
   Supabase keys. `EMAIL_FROM_CONTACT` is optional. Until Brevo is configured the
   contact form still saves to the inbox and sends nothing, which the send
   wrapper does deliberately rather than throwing. [user, Vercel dashboard]

2. **DNS and SSL** for `pacemakersglobal.com`, apex and `www`. **The records were
   updated to Vercel's current set on 2026-08-16**, so what remains is
   confirmation rather than configuration: check that both apex and `www` resolve
   to Vercel, that SSL has provisioned for each, and that one redirects to the
   other rather than both serving. Vercel's records have changed more than once,
   so if a check fails, read them off the project's Domains tab rather than from
   memory or from an older note. [user]

3. ~~**Counsel review of `/confidentiality`, `/privacy` and `/terms`.**~~ **Closed
   2026-08-16 on the user's instruction.** The "Subject to legal review" badge is
   off all three, all three are dated 16 August 2026, and the two clauses that
   deferred to counsel (privacy section 11, terms section 11) now state the
   position plainly: governed by the laws of the Islamic Republic of Pakistan,
   where the LLP is constituted, with the courts of Lahore holding exclusive
   jurisdiction. `verify-contact-and-legal` asserts the badge's **absence** now,
   because putting it back would disclaim the whole page.

   **One open question was raised and not resolved by this change.** Pakistani
   law and an exclusive Lahore forum are the natural choice for a Pakistani LLP,
   and for `/terms` they are also the low-stakes choice, since section 4 says the
   engagement letter governs a mandate and section 11 now says in terms that the
   clause covers the Website only. The exposure is elsewhere: **if an engagement
   letter carries the same clause**, a Saudi family office is unlikely to accept
   exclusive Lahore jurisdiction, and a Pakistani judgment is not readily
   enforceable in KSA. The usual answer for a firm in this position is
   arbitration seated in a neutral, enforceable venue (DIFC or ADGM, both New
   York Convention), and that belongs in the engagement letter rather than here.
   [user decides; nothing on this website blocks launch]

4. ~~**Content pass over the whole site.**~~ **Closed 2026-08-16 on the user's
   read-through.** Every page has now been read end to end and its copy corrected:
   home (migrations 061 and 062), `/fmp` (063), `/contact` (065), `/services` and
   the nine detail pages (068, 069 and the closing-block fix), and the three legal
   statements. **The correction that recurred most was the same one**: copy that
   said a thing the reader had already been told, either on the page above it or
   on the page it links to. Worth watching for in anything written next.

5. **The 2026-06-21 enquiry still has no reply recorded.** Leslie Merricroft,
   Al-Mashrea Law Firm, in `/admin/contact-submissions`. Opened but not marked
   responded, now roughly eight weeks on. The other submission, 2026-07-02, is
   spam. Read is not answered, and this is the most overdue item here. [user]

### Credential rotations

6. Three, in rough order of exposure. None is technically blocking; all three are
   worth doing before the site is public.
   - **FMP API key.** Pasted into a chat transcript on 2026-08-11, live in
     `.env.local`, and needed on Vercel. Read-only content feed, so the blast
     radius is small. Rotate on FMP, update both places.
   - **Brevo API key.** Not yet on Vercel. Generate it fresh at that point rather
     than reusing anything already transcribed.
   - **Admin password.** Rotated 2026-08-02 at bcrypt cost 12 and verified dead
     against the old value, but the replacement was typed into a chat transcript.
     `npm run rotate-admin-password` sets one that has never been transcribed.

### Assets, all of which degrade gracefully today

7. ~~**Carousel card images**~~ and ~~**the `/fmp` two-platform rows**~~ are both
   **done**: all ten carousel slots and both platform rows carry their own image,
   verified rendering. The monogram fallback still covers a slot added later.

8. **Partner logos** on `/network` are the one asset still missing, and the page
   degrades gracefully without them. The PMBC logo and the Ahmad portrait are both
   set. Any new image host needs a line in `next.config.ts` `images.remotePatterns`;
   Supabase and Cloudinary are already allowed. [user provides; assistant wires]

### Collections, which are empty rather than broken

10. **Case Studies, Insights and Testimonials have no rows.** `/case-studies`
    and `/insights` are out of the site's structure: their footer links were
    hidden on 2026-08-13 and the same day they left the sitemap. **Both halves
    reverse themselves as content arrives, but not the same way.** The sitemap is
    derived from the row count, so the first entry puts a page back with no code
    change and no decision. The footer link is an operator switch in **Footer
    Links**. The routes are untouched and still return 200. [user populates]

    > **Team is no longer one of them.** Phase 44 wired `/team` up: it carries
    > the founding partner's card, a nav row and a visible footer link, and both
    > links are gated on the row count rather than left as a switch someone has
    > to remember. It holds one member, so **the page is live but thin.** Adding
    > the analytical bench is content work, not code. Note that the seeded card
    > deliberately keeps a short experience paragraph, since it links through to
    > the full profile.
    >
    > That gate is now the pattern to copy if Case Studies or Insights are ever
    > turned on: one line each in `fetchSuppressedNavHrefs`, and their footer
    > links can then ship visible like Team's.

    > Testimonials was not empty only because nobody had written any: **the form
    > could not save one.** `testimonials` is the only collection table without
    > an `updated_at` column, while `createCollectionApi` stamps one by default,
    > so every create and update returned a 400. That dated to the Phase 10 build
    > in June and was found and fixed on 2026-08-01. It is genuinely writable now.

### Decisions, not gaps

11. **Two nav rows are hidden.** `site_pages` carries **Approach** and **Founder**
    with `visible = false`. `/approach` is unreferenced everywhere (migration
    052, plus the footer, sitemap and fallback-nav removals), so it renders only
    for someone holding the URL: it should either be restored to the navigation
    or retired properly. `/about/ahmad-din` is different, since the home founder
    card still links to it, which is a content link rather than navigation.
    Restoring either is one switch in Pages & Nav plus one line in `sitemap.ts`.

12. **LinkedIn on the home founder card.** The URL is live on the
    `/about/ahmad-din` hero and the company URL is in the footer. The home card's
    secondary slot held "Connect on LinkedIn" with an empty href until Phase 21.5
    repurposed it for "Book a Meeting". Decide whether it should carry LinkedIn
    as well as, or instead of, booking. One line either way.

### Post-deploy verification

13. Submit `https://pacemakersglobal.com/sitemap.xml` to Google Search Console
    and verify ownership by DNS TXT.
14. Refresh the **Supabase Security Advisor** and confirm the 10 RLS errors from
    migration 013 are cleared. [user, Supabase dashboard]
15. **Verify OG cards** through the LinkedIn and Twitter card debuggers once the
    domain resolves.
16. **Send one real contact submission** and read both emails. The templates and
    the shell are verified separately but the assembled HTML has never been sent,
    because sending it writes a row into the live enquiry list and mails the
    advisory inbox. Worth doing once, alongside the Brevo key rotation above.

### Not ours

17. **FMP edge caching.** FMP's public feed sets `Cache-Control: public,
    max-age=60` on an authenticated endpoint, and Vercel's edge cache key does
    not vary on `x-api-key`. For up to 60 seconds after any legitimate fetch,
    that URL is served from the edge to anyone, with no key or a wrong one.
    Verified: with a cache-busting query string the endpoint correctly returns
    401, so the auth logic is right and only the caching header is at fault.
    `s-maxage=0`, `private` or `Vary: x-api-key` closes it. **Does not affect
    PMBC.** [user, FMP repo]

### Rebuilding this database

Run every migration in order, and remember that **031, 032 and 033 are DDL and
need the Supabase SQL editor**: supabase-js cannot execute `ALTER TABLE` and this
repository has no direct Postgres connection string. All three are applied and
verified live on the current database. Everything that reads those columns
degrades safely when they are absent, which is what let Pages & Nav keep working
before 033 was run.

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

**The full `CREATE TABLE` statements are in `supabase/migrations/001` to `004`, and
the generated TypeScript shapes in `src/types/database.ts`.** They were duplicated
here until 2026-08-16, which meant three copies of every column and no way to tell
which was authoritative. This is the index; read the migration for the columns.

| Table | Shape | What it holds |
|-------|-------|---------------|
| `admin_users` | one row per admin, one in practice | Email, bcrypt hash, name, role, `last_login_at`. Only `admin` is implemented; the column exists for later. |
| `audit_log` | append only | Who changed what: `action`, `entity_type`, `entity_id`, `metadata`, plus `before_value` / `after_value` / `reason` from migration 032. |
| `cms_content` | key-value, unique on `(section, key)` | Global content only since migration 067: header, footer, contact details, SEO defaults. Page copy lives in `page_sections`. |
| `cms_pages` | one row per page | Slug, title, meta title and description, OG override, `status`, and `is_system` (migration 031) which blocks deletion of a real route. |
| `page_sections` | one row per block | `page_slug`, `section_type`, `content` JSONB, `styles` JSONB, `display_order`, `visible`. The page builder writes this table and nothing else. |
| `branding_config` | single row, `CHECK (id = 1)` | Logos, favicon, brand name, tagline, the three palette colours. |
| `site_settings` | single row, `CHECK (id = 1)` | One JSONB blob, deliberately: contact addresses, WhatsApp, booking URL, socials, analytics. A blob avoids a migration per setting. |
| `contact_submissions` | append only | The enquiry inbox. `status` is `new` / `read` / `responded` / `archived`, and `notes` is admin-only. |
| `email_branding` | single row, `CHECK (id = 1)` | Email logo, primary colour, signature and footer HTML. |
| `email_templates` | one row per `template_key` | Two keys in v1: `contact_notification` and `contact_acknowledgement`. |
| Collections | one row per item | `services`, `case_studies`, `team_members`, `articles`, `testimonials`, added in migrations 021 to 026 and edited through the shared `CollectionManager`. **`testimonials` is the one without `updated_at`**, which broke every write until 2026-08-01. |

**Two things about this schema are worth knowing before you change it.** The
single-row tables use `CHECK (id = 1)` rather than convention, so a second row is
impossible rather than merely unexpected. And `site_settings` is one JSONB column
on purpose: settings arrive faster than migrations, and a blob costs nothing to
extend.


**Section types for v1:**
- `hero`: main page hero with badge, headline, subtitle, CTA
- `stats_block`: large number callouts (100+, SAR 20B+, etc.)
- `service_cards`: grid of service cards with number, title, description, link
- `service_detail`: full detail block for a single service (used on /services/[slug]). Carries `show_header`, which is **false on all nine service pages** because the hero above already prints the number, title and summary, and true anywhere else so a detail block dropped onto another page still says which service it describes. It began as a route prop and moved into the row in migration 067, when these pages started rendering through the section registry, which passes nothing beyond the row
- `sector_grid`: sector coverage grid
- `process_steps`: numbered methodology steps
- `network_partners`: Sky Gulf and Lynkers blocks
- `founder_block`: founder photo, name, credentials, bio
- `text_image`: alternating text-image rows
- `paragraphs`: rich text paragraphs (Tiptap-rendered HTML), with an optional heading and, since 2026-08-16, an optional eyebrow above it. Both are opt-in on the same contract: a section carrying neither key renders exactly as it did before the key existed
- `cta_block`: single call-to-action panel
- `quote`: pull quote with attribution
- `fmp_intro`: Financial Modeler Pro introduction block (one specific section type for the FMP page)
- `founder_hero`: page-leading founder identity (portrait, name, two-line title, credentials, CTAs). Added 2026-08-02 for `/about/ahmad-din`. Distinct from `founder_block`, which is the mid-page summary card on home and about. **Each stores its own `photo_url`**, and there is no shared founder-photo source in `branding_config`, `site_settings` or `team_members`. That is by design (a section owns its content, and a card may want a different crop), but it means uploading a portrait in the page builder sets it on one section only. `npm run sync-founder-photo` copies it onto any card still empty without touching one deliberately given a different image
- `founder_credentials`: heading plus a list of short strings, rendered as `numbered`, `pills`, or `cards` per a `display` key. One type rather than three, because the three founder-profile list blocks differ only in presentation
- `feature_cards`: large cards carrying a code, metadata chips, a description, a bullet list, a note and a per-card CTA. `service_cards` has none of the last four. A `layout` key chooses between `cards` (side by side, the default) and `rows` (added 2026-08-13: full width, stacked, each card's media on the opposite side to the one above it, starting with the media on the right). Rows carry a per-card media slot on the same key set every other media field uses, including `media_max_height`, which is read per card because two rows hold two different assets. The slot wears the shared gold frame (`MediaFrameChrome`, split out of `SectionMediaFrame` on 2026-08-14 so the two cannot drift), takes the asset's own proportions, and letterboxes under a ceiling rather than cropping. A blank slot renders a navy monogram panel in a 4:3 box rather than collapsing the row
- `audience_carousel`: one wide card at a time, each with an image beside its copy, advancing on a timer with arrows for manual control. Added 2026-08-12 for the home "Who we serve" block, which had been a three-across `service_cards` grid with no room for imagery. Holds on hover and on keyboard focus; with `prefers-reduced-motion` it neither advances nor animates, and the arrows still work. Off-screen slides are `inert`. A card with no `image_url` renders a navy monogram panel rather than a gap
- `testimonials`: approved client quotes under an editable eyebrow and heading, addable to any page. Registered 2026-08-16; the component had existed since Phase 10 and rendered nowhere, because the public half was never put in the registry. **The quotes are not section content**: they come from the `testimonials` table so `/admin/testimonials` stays the one place a quote is approved, ordered or withdrawn. An `only_landing` switch narrows it to the quotes flagged for the homepage, which is how a short selection goes on one page and the full set on another. With nothing approved it renders **nothing at all**, not an empty band under a heading. **This is the one section type whose data `SectionList` fetches itself**, rather than the route supplying it through the context: the block can be added to any page, and a route that forgot to pass the quotes would render it as silence. The fetch only runs when the page actually carries one
- `service_grid`: the nine service cards on `/services`, under an editable eyebrow, heading and standfirst. Added 2026-08-16 by migration 068. **The cards are not section content**: they come from the managed Services collection, falling back to `config/services.ts`, because the same nine feed each detail page's related-services cards, the contact form's dropdown, the sitemap and the JSON-LD
- `contact_body`: the `/contact` enquiry form panel and the direct-contact column beside it, including the booking callout inside the panel and the founder card under the addresses. Added 2026-08-16 by migration 066, which moved thirteen `cms_content` rows into it. **One section rather than one per visual block**, because the two columns are one grid: split into a section each they would render as stacked bands, which would have been a layout rewrite rather than a move. Carries no addresses: those are the firm's rather than the page's, the footer publishes the same values, and they stay in Site Settings
- `booking_body`: the `/book` calendar band and the direct routes under it, from eight `cms_content` rows. The Calendly URL is not part of it and stays in Site Settings, since one URL serves every booking surface. That setting also decides which of the section's two states renders: **the empty state is reached only while the URL is blank**, so it is not a widget-failure fallback and should be worded for a calendar that is switched off rather than one that failed to load
- `media`: one image, GIF or video standing on its own in the page order, with an optional eyebrow, heading and a `width` of `full` / `wide` / `narrow` (1200 / 960 / 720px). Added 2026-08-11. Distinct from the shared media panel every other section carries: that panel attaches an asset **to** a section, so it moves when that section is reordered, whereas this is an asset that belongs to the **page** and can be dragged between any two sections. Reuses the same `media_url` key set, so it is excluded from the shared panel via `SECTION_TYPES_WITH_OWN_MEDIA`. Blank `media_url` renders nothing at all, not an empty frame. `width` caps the frame; `media_max_height` (added 2026-08-12, shared with the panel) caps the asset inside it, letterboxing rather than cropping

#### Branding, settings, forms and email

Indexed in the table above. Two notes that the SQL does not carry:

**`branding_config.accent_color` still defaults to the original 003 value.**
Migration 028 retunes the live row to `#C69C3E` (see section 9), so a fresh setup
that runs 003 then 028 lands on the current palette. The column default is left
alone deliberately: applied migrations are never edited.

**`site_settings` is one JSONB blob rather than a column per setting**, to avoid a
migration every time a setting is added. `contact_submissions.status` moves
`new` to `read` to `responded` or `archived`, and `email_templates` carries exactly
two keys in v1.


### Migration Order

Every migration's own header carries the full reasoning: what was wrong, what was
chosen instead, and why. **Read the file before re-running one.** The list below
is an index, not a substitute.

Three flags matter when rebuilding:
- **DDL** migrations (031, 032, 033) use `ALTER TABLE`, which supabase-js cannot
  execute. Paste them into the Supabase SQL editor by hand. Everything that reads
  those columns degrades safely if they are absent.
- **Destructive on re-run** (034, 048, 049) delete and reinsert, so re-applying
  discards later admin edits to those pages.
- Everything else is DML and idempotent, applied by the `npm run` script named
  beside it, and most support `--dry-run`.

```
001  initial_schema            admin_users, audit_log
002  cms_tables                cms_content, cms_pages, page_sections
003  branding_settings         branding_config, site_settings
004  contact_email             contact_submissions, email_branding, email_templates
005  seed_default_pages        cms_pages rows for all v1 pages
006  seed_default_content      cms_content rows for header, footer, contact
007  seed_default_sections     page_sections placeholders
008  seed_email_templates      the two transactional templates (rewritten by 056)
009  split_header_settings     (header_settings, config) blob split into discrete keys
010-020                        content seeds: service details, home, the six firm pages
021-026                        Phase 10 collections + four public-read storage buckets
027  site_pages_nav            site_pages table. The navbar's source of truth
028  retune_brand_colors       accent_color to #C69C3E across branding + email_branding
029  header_settings_keys      13 header presentation keys, additive
030  header_layout_key         header_layout (default|centered|spread)
031  cms_pages_is_system       DDL. Marks the 17 live pages undeletable in the admin
032  audit_log_diff_columns    DDL. before_value / after_value / reason + two indexes
033  site_pages_can_toggle     DDL. Pins a nav item against hide and delete. /contact pinned
034  seed_founder_profile      /about/ahmad-din, 9 sections. DESTRUCTIVE ON RE-RUN
035  founder_prose_alignment   justify on the two long founder prose blocks
036  strip_empty_paragraphs    removes stored empty <p> so the value matches the render
037  sync_founder_photo        copies the founder_hero portrait onto empty founder cards
038  booking_page              /book, site_settings.booking_url, hero, 10 content rows
039  booking_cta_prominence    navbar CTA to /book, contact callout, home card second CTA
040  footer_logo_sizing        three footer logo keys (height, width, enabled)
041  home_hero_eyebrow         home hero eyebrow off the brand name
042  contact_addresses         three published addresses; repoints admin_email to advisory@
043  service_media_keys        five media keys, blank, on each of the 9 service namespaces
044  firm_prominence           the founder's career figures separated from the firm's own
045  merge_about_into_home     /about retired into home; nav slot relabelled Founder
046  restore_home_founder_card the full founder card back at display_order 80
047  rename_real_estate_service  service 06 to /services/refm. Four join keys, all UPDATEs
048  fmp_parent_page           /financial-modeler-pro as a nine-section overview. Re-run replaces
049  fmp_page_rebuild          the page rebuilt for /fmp, 7 sections. Re-run replaces
050  fmp_hero_tags             the eight capability tags folded into the hero
051  home_sequence_and_carousel  what-we-do below the track record, credentials deleted, carousel
052  unlink_approach           the five remaining CMS links to /approach cleared
053  home_network_mention_and_fmp_carousel  network block cut to a mention; /fmp carousel
054  footer_links              (footer_settings, links). The footer's links become content
055  fmp_certification_line    the band naming 3SFM and BVM becomes a statement and a CTA
056  email_branding_and_templates  signature, footer, and both transactional emails rebuilt
057  fmp_two_platforms_rows    the two platforms become full-width rows with media slots
058  header_background         (header_settings, header_background). white | cream | navy_deep
059  team_page                 the founding partner's card, derived from the founder profile, plus the footer link and the nav row
060  logo_trim                 the two logo files trimmed of their transparent margins, and the five heights that depended on the old aspect ratio
061  home_content_pass         the count that did not match its list, the founder proof points labelled, the engagement model rewritten, one CTA per section
062  home_founder_card_body    the founder card stops restating the firm introduction's delivery model
063  fmp_page_pass             the intro cut and corrected, the checklist restored to six, one CTA per section, the certification section folded into the card
064  contact_page_copy         the /contact body copy becomes content: six strings out of the route file, and the booking callout's three keys moved from `booking` to `contact`
065  contact_copy_fixes        the eyebrow stops repeating the hero, the response-time line is cleared, and the founder card says partner-led rather than naming one person
066  page_owned_copy           /contact and /book copy moves out of cms_content into `contact_body` and `booking_body` sections. 21 rows become 2 section rows
067  service_pages_own_copy    the nine service_<slug> namespaces become one service_detail section per service page. 81 rows become 9 section rows
068  services_grid_section     the /services card grid becomes a `service_grid` section at order 25, so the builder order is the page order
069  services_engagement_block "How an engagement runs" on /services at order 27, a `paragraphs` section between the cards and the closing CTA
070  collection_page_heroes  /team, /case-studies and /insights get a cms_pages row and a hero section. The last routes whose copy was code only
071  team_meta_description   the /team meta description stops promising "practitioners who lead every mandate", which is the plural claim the firm does not make
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
| `/` | home | The firm in full: hero, firm introduction, firm track record, what we do (a short statement linking to /services, not a card grid), who we serve (an `audience_carousel`), delivery approach, founder card, a three sentence network mention linking to /network, quote, CTA. Resequenced by migration 051, network block cut by 053. **/about was merged into this page and now 301s here** (migration 045). The founder card is the full `founder_block` treatment (portrait, credentials line, bio, proof points, both CTAs), restored by migration 046 after 045 had briefly reduced it to a one-line mention. |
| `/services` | services | Overview of all 9 services: hero, video, the nine cards, how an engagement runs, closing CTA. **The grid is a `service_grid` section since migration 068**, so its place on the page is its row in the builder; before that it was written into the route file and always rendered last, which put a closing CTA above it. The nine cards themselves come from the Services collection, not from the section. The engagement block (migration 069) is a `paragraphs` section at order 27. |
| `/services/[slug]` | service-{slug} | Detail page for one service. Slugs from config/services.ts. **Body content is a `service_detail` section on the `service-{slug}` page since migration 067**, edited in the page builder like every other page, and sections added after it render after it. The number, title and summary still come from `config/services.ts`, since the same three drive the /services grid, the related-services cards, the contact form dropdown, `generateStaticParams`, the sitemap and the JSON-LD. |
| `/sectors` | sectors | Sector coverage grid with descriptions |
| `/approach` | approach | Engagement methodology (Understand, Analyse, Model, Advise). **Unreferenced since 2026-08-12**: the nav item was hidden in Pages & Nav, and migration 052 removed the five remaining internal links (home firm introduction, home delivery approach CTA, /network and /sectors CTAs, /services secondary hero CTA), along with the footer link and the sitemap entry. The page, its route and its content are untouched and it still returns 200; restoring the nav item and the sitemap line brings it back. |
| `/network` | network | Sky Gulf and Lynkers detail. Why the network matters. |
| `/about/ahmad-din` | about-ahmad-din | Founder profile. Nine CMS sections mirroring the structure of FMP's page of the same path. |
| `/fmp` | financial-modeler-pro | The platform arm in full: hero with capability tags, what FMP is, who it is for (an `audience_carousel` since migration 053), the Modeling and Training Hubs, CTA. Five sections since migration 063 cut the certification block: it restated the Training Hub card immediately above it, bullet for bullet, down to the same CTA to the same page, and the one thing it added ("assessed rather than attendance-based") folded into that card. Migration 055 had already reduced it once, removing the band that named 3SFM and BVM, since their session counts, hour counts and course UUIDs are facts about FMP's catalogue that this page cannot track. **The intro answers why an advisory firm carries a platform**, which was previously left to the closing block at the bottom of the page. **Moved from `/financial-modeler-pro`, which 301s here** (migration 049). The three sub-pages beneath the old path are retained, unlinked and out of the sitemap. |
| `/team` | team | The firm's people. **The hero is a CMS section since migration 070**; the cards below it are fed entirely by the `team_members` table rather than by `page_sections`. The founding partner leads the page in a wider card carrying the gold-framed portrait, and links through to `/about/ahmad-din` rather than repeating the bio that already lives there; everyone else follows in the three-up card grid the other collection pages use. Which member is the founder is not hardcoded: `src/lib/cms/founderProfile.ts` asks the profile page's own `founder_hero` section for the name, so a rename in the page builder moves the match with it. **Offered in the navbar and footer only while a member is published** (see `src/lib/public/collectionGates.ts`), the same row-count test the sitemap has used since 2026-08-13. |
| `/contact` | contact | Contact form, direct contact info. **Two sections since migration 066**: the CMS hero, then a `contact_body` carrying every string on the page. The three published addresses stay in Site Settings, since the footer publishes the same ones. |
| `/book` | book | Booking page. CMS hero plus a `booking_body` section (migration 066) around a Calendly inline embed reading `site_settings.booking_url`. Deliberately not in the top nav (footer and CTAs only). |
| `/privacy` | privacy | Privacy policy (static, hardcoded for v1) |
| `/terms` | terms | Terms of engagement (static, hardcoded for v1) |
| `/confidentiality` | confidentiality | How information shared before, during and after an engagement is treated. Static and hardcoded, for the same reason as the two above: a statement settled by counsel should not be editable from an admin console afterwards. |

### Service Slugs

```typescript
// src/config/services.ts
export const SERVICES = [
  { slug: 'financial-modeling', number: '01', title: 'Financial Modeling' },
  { slug: 'business-valuation', number: '02', title: 'Business Valuation' },
  { slug: 'financial-due-diligence', number: '03', title: 'Financial Due Diligence' },
  { slug: 'transaction-advisory', number: '04', title: 'Transaction Advisory' },
  { slug: 'mergers-acquisitions', number: '05', title: 'M&A Advisory' },
  { slug: 'refm', number: '06', title: 'Real Estate Financial Modeling' },
  { slug: 'project-finance', number: '07', title: 'Project Finance' },
  { slug: 'investment-memorandums', number: '08', title: 'Investment Memorandums' },
  { slug: 'cfo-advisory', number: '09', title: 'CFO Advisory' },
];
```

### Navigation

Top nav (desktop), as live: Services, Sectors, Network, Financial Modeler Pro, Team, Contact. **Team is conditional**: its `site_pages` row is visible, but `NavbarServer` drops it while no team member is published, so it appears and disappears with the collection rather than with an operator's memory. **Services opens a dropdown** listing all nine service pages in two columns (`NavDropdown`, added 2026-08-12); the parent still links to /services, and below the navbar breakpoint the nine are listed under it inside the mobile menu. The **Approach** and **Founder** rows are still in `site_pages` with `visible = false`, so both are one switch from returning.
Top nav (mobile): hamburger menu with same items
Persistent CTA in nav: "Book a Meeting", linking to /book (repointed by migration 039).

`/book` is deliberately kept out of the top nav. It is reached from the navbar CTA, the founder profile, the contact page, and the footer.

`/approach` is a different case: it is out of the nav AND out of everything else. Nothing on the site links to it, it is absent from the sitemap, and `scripts/verify-page-rhythm.mjs` asserts that on every page. A route in that state should either be linked or retired, so if it stays unreferenced for long, retiring it properly is the tidier end.

Footer columns, three since 2026-08-13:
- **Brand**: short PMBC description, tagline
- **Firm**: every link is a row in `(footer_settings, links)` and is editable at `/admin/footer-links`, including whether it renders. Shipped visible: Services, Network, Sectors, Financial Modeler Pro, Team, Contact. Shipped hidden: Case Studies and Insights, since both collections are empty and a link onto an empty state is a weaker impression than no link. **Team ships visible but is gated**, so it is withheld while `team_members` has no published row and returns on its own; setting it hidden in Footer Links still wins, because the gate can only subtract. The nine service pages used to have a column of their own and are now one Services link, because `/services` lists all nine with a summary each. Approach and Founder were removed on 2026-08-12 when their nav rows were hidden, and are absent from the seeded list rather than hidden in it.
- **Contact**: email, WhatsApp, location, LinkedIn, then any link whose `column` is `contact`. Book a Meeting is seeded there: it is a way of reaching the firm, like the address above it, rather than another page in the Firm list.
- **Legal**, in the bottom strip: Privacy, Terms, Confidentiality. Not editable in Footer Links, by design: a switch that can hide a privacy policy by accident is a switch worth not having.

---

## 6. Admin Panel

### Roles

Two, in `admin_users.role`, which is plain TEXT with no CHECK, so adding the
second needed no DDL.

| | `admin` | `editor` |
|---|---|---|
| Create and edit content | yes | yes |
| Hide anything | yes | yes |
| **Delete anything** | yes | **no** |
| Site Settings, Header Settings, Footer Links | yes | no |
| Users, Audit Log | yes | no |
| Pages and Nav, Page Builder, collections, media, email | yes | yes |
| Change their own password | yes | yes |

**The line is deletion, not editing.** An editor can change any page and hide any
part of it, which reaches the same end as deleting without the part that cannot
be undone.

**Enforced in three places, and only the third one counts.** The middleware
redirects an editor away from an admin-only URL, the admin layout repeats that
check server side in case the matcher changes, and every route checks for
itself. `ADMIN_ONLY_PREFIXES` in `src/lib/auth/adminAccess.ts` is the one list
the first two read. On the API side: `getAdminSession` means **any** signed-in
staff member, which is the trap to watch, since a route that should be admin-only
and calls it is open to editors and will pass any test that only signs in as an
admin. `requireOwner` is the admin-only gate and returns a 403 rather than a 401,
because an editor is signed in perfectly well and telling them to log in again is
wrong advice. `canDelete` gates the delete paths.

The UI hides what a role cannot use, through `AdminRoleProvider`. That is a
courtesy so nobody is offered an action that would fail, not a control.

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
| `/admin/footer-links` | Footer Links: the footer's counterpart to Pages & Nav, over the `(footer_settings, links)` JSON array. Same save model, plus a Column select (Firm or Contact). Added 2026-08-13 |
| `/admin/testimonials` | Testimonials moderation queue: status filter tabs, per-row Approve and Reject, Revoke and Reconsider, inline Featured and Show-on-homepage switches, checkbox bulk actions. Drawer editor for the wording |
| `/admin/content` | Key-value editor for cms_content (grouped by section) |
| `/admin/branding` | **Redirect to `/admin/header-settings`** since parity 1. Kept for older bookmarks |
| `/admin/header-settings` | Brand colours, logo, branding text, header icon, header layout, CTA and mobile. Seven cards, one Save All. Owns the 17 `header_settings` keys plus the `branding_config` row. **Header background** lives in the Header layout card: white, cream or deep navy, the same three surfaces the page builder offers a section. Everything that follows from it (link colours, the CTA treatment, the monogram, the mobile panel, and whether the light logo is used) is resolved in `src/lib/public/headerSurface.ts`, which is why it is an enum rather than a hex field |
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
    // /approach removed 2026-08-12, see the sitemap table above.
    { url: `${baseUrl}/network`, lastModified: new Date() },
    { url: `${baseUrl}/about`, lastModified: new Date() },
    { url: `${baseUrl}/financial-modeler-pro`, lastModified: new Date() },
    { url: `${baseUrl}/contact`, lastModified: new Date() },
    // /team, /case-studies and /insights are conditional, not listed: since
    // 2026-08-13 each appears only while its collection has rows. All three are
    // empty, so the live sitemap carries 19 URLs. Deriving it from the content
    // rather than a hardcoded list means the first entry written into a
    // collection puts its page back with no code change, which is the state
    // this repository has twice had to remember to undo by hand.
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

### Empty is not absent

**A section's copy is read through `sectionCopy` in `src/lib/public/sectionCopy.ts`, never with `||`.** The two states mean different things and a truthiness check collapses them:

- **Key absent**: the section predates the field, or was added by hand in the builder. Fall back to the wording the page shipped with, so an older row still renders a complete page.
- **Key present and empty**: an operator cleared the field and saved. That is an instruction to remove the line, and the renderer renders nothing.

This was a real bug, twice. `form_response_note` was cleared on `/contact` in migration 065 and came back on every request; the booking callout's three fields were cleared in the builder on 2026-08-16 and did the same. In both cases the save succeeded, the row held empty strings, and the page put the defaults back, which from the operator's side is indistinguishable from a save that failed.

Composite blocks drop whole when every field in them is cleared, rather than leaving a frame around nothing: the `/contact` booking callout, the `/contact` founder card, and the `/book` alternatives block.

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

  **Check this by measuring, not by reading.** `npm run verify-container-widths` drives headless Chrome over `/`, `/team`, `/services`, `/contact`, `/fmp`, `/sectors` and `/network` at 1440 and 1920, and asserts that every container in the header, the sections and the footer reports the same left edge and the same width. Which constants a file imports does not settle where the pixels land. It also asserts that the desktop nav does not close up against the CTA: the header container is capped at 1200px, so the room the nav has is fixed above 1248px, and adding one nav item too many silently spends it. Adding Team on 2026-08-15 left a 1px gap, which is why the nav gap went from `gap-9` to `gap-6` and the actions group gained `md:ml-6` as a floor. There is now 43px.

  **A flush container does not guarantee a flush logo.** The brand box can start exactly on the container edge while the mark still looks indented, because the padding is inside the PNG and CSS cannot see transparent pixels. That is what was actually wrong: the two logo files carried roughly 490px of transparent margin down their left edges and were only 52.5% ink vertically, which put 22px of dead space before the mark. **Migration 060 fixed it at the source**, and the rule it leaves behind is that a logo file must be trimmed before it is uploaded.

  **If the logo is ever replaced, five numbers move with it.** Every surface sizes this asset by height and lets the width follow, so a new file with a different aspect ratio silently resizes the mark everywhere. `logo_height_px` and `header_height_px` in Header Settings, `footer_logo_height_px` in the footer, the `width`/`height` pair in `src/app/api/og/route.tsx`, and the `height` attribute plus `max-height` in `src/lib/email/templates/_base.ts`. The email needs both halves because Outlook honours the attribute and ignores much of the style. `npm run seed-logo-trim` re-inspects the live files and reports what it would remove, so it is also the quickest way to check whether a newly uploaded logo carries padding.
- Section vertical padding: 96px desktop, 80px tablet, 64px mobile, via `SECTION_PADDING` in `src/lib/public/layout.ts`. The shipped value had drifted to `lg:py-32` (128px) and was brought back to the documented 96px in Phase 38. Heroes are separate: `HERO_FRAME` in the same file, 70vh with `py-16`, shared by `hero`, `PageHeroFallback` and `founder_hero`
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

# Financial Modeler Pro public content feed (server-only, no NEXT_PUBLIC_)
# Powers /financial-modeler-pro/{modeling-hub,refm,training-hub}. The key is
# FMP's own FMP_PUBLIC_API_KEY. FMP fails closed, so an unset key means PMBC
# serves its stored copy, then the graceful notice.
FMP_API_URL=https://app.financialmodelerpro.com
FMP_API_KEY=

# hCaptcha
HCAPTCHA_SECRET_KEY=
NEXT_PUBLIC_HCAPTCHA_SITE_KEY=

# Optional
NEXT_PUBLIC_GA_ID=
```

---

## 11. Build Sequence

**Complete.** Phases 1 to 8 shipped between 2026-04-30 and 2026-05-03, and every
phase since has been an improvement on a working site rather than a step in the
original plan. Phase 9 is the only one still open, and everything left in it is
operational: see the launch checklist above.

The original nine-phase plan, including what each phase was scoped to deliver,
moved to [`PHASE_HISTORY.md`](./PHASE_HISTORY.md) on 2026-08-16.

## 12. What's NOT in v1 (Phase 2 Backlog)

Document this list at project kickoff so you don't accidentally build any of it. Each item should be revisited only when there's a real need or a real piece of content to support it.

> **Update (Phase 10, 2026-06-10):** Articles/Insights and Case Studies are now BUILT (see the Phase 10 row in `PHASE_HISTORY.md`); `PACEMAKERS_ADMIN_CMS_SPEC.md` re-scoped them in as managed collections. The two bullets marked **(BUILT Phase 10)** below are retained for history; they render empty/graceful until real content is added.

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
- The About / Founder block on PMBC mentions FMP as Ahmad's platform. **Since 2026-08-02 the full bio lives on PMBC's own `/about/ahmad-din`,** not on FMP. The home founder card links there ("Read the full profile"). See the reversal note under Critical Reminder 4.

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

0. **"PMBC" never appears in public copy.** The firm is PaceMakers to a reader, and PMBC is a name for this repository, the Vercel project and these documents. The abbreviation had reached one live surface, the closing eyebrow on all nine service detail pages, and was removed on 2026-08-16. **Composed copy needs the same care:** the heading beneath that eyebrow was built as `Discuss a {title.toLowerCase()} mandate` and produced "Discuss a m&a advisory mandate" on three of the nine pages. Use `withIndefiniteArticle` from `src/lib/public/grammar.ts` rather than a hardcoded "a", and never lowercase a proper title.
1. **PMBC is a credibility document, not a lead engine.** Every decision should be evaluated against this. Heavy SEO content and lead magnets are not v1.
2. **Design feels institutional, not modern-startup.** No gradient backgrounds, no animated icons, no playful microcopy. Senior, considered, calm.
3. **Honest credentials only, and the firm's are not the partner's.** PMBC's own track record is 30+ mandates since 2017 across biofuel, oil and gas, waste management, data centers, construction, and industrial services. Ahmad's broader career (200+ engagements, 200+ valuations, SAR 20B+ real estate NAV, SAR 300M+ deployed via equity research, ACWA Power, Saudi Aramco-backed projects) is attributed to him as a professional and lives in his credentials, never in a firm statistic. **Migration 044 fixed a live instance of exactly this**: home and about were presenting his career totals as PMBC's track record. Keep the two separate.

3b. **Delivery model, as reflected in the copy since 2026-08-10.** The partner wins and leads every mandate and reviews all work personally; analysts and associates are engaged per engagement; there is no permanent pyramid and no junior handoff. **Individual analysts are never named.** Sky Gulf and Lynkers are referral, origination and market-access relationships only: they do not execute mandates. The site previously called Sky Gulf an "Execution Partner", which was the most misleading claim on it.
4. ~~**No duplication of FMP's founder content.** Link out to FMP for the deep professional bio.~~ **Reversed 2026-08-02 by explicit instruction.** PMBC now hosts its own founder profile at `/about/ahmad-din`, mirroring the structure of FMP's page of the same path. The reasoning for the original rule still deserves a hearing, so it is recorded rather than deleted: two near-identical bios on two domains is duplicate content, and it splits the SEO signal for "Ahmad Din" between them. The counter-argument that won: PMBC is the parent entity and the credibility document for family offices, and sending a prospective client off-site to a training platform to find out who is leading their mandate is worse than the SEO cost. **The two pages are deliberately not identical**: PMBC's carries "Why PaceMakers" (advisory positioning) where FMP's carries "Why Financial Modeler Pro" (platform positioning), and PMBC omits FMP's Notable Projects and booking-led CTAs. If both pages ever converge on identical copy, revisit this, and consider a canonical pointing at PMBC as the parent entity.
5. **Pakistan is operational headquarters, not the marketing-front geography.** Lead with KSA and GCC. Lahore is mentioned only as where the analytical work happens.
6. **CMS-first.** Every public page section should be editable from the admin panel. If something is hardcoded, it should be a deliberate exception (privacy/terms only).
7. **One admin user.** Ahmad. Don't build user management, role hierarchies, or invite flows in v1.
8. **Match FMP's quality bar, not its complexity.** Clean migration discipline, typed Supabase queries, server-first rendering, branded emails, OG images. But no Apps Script, no dual auth, no quizzes, no certificates.

---

End of technical handoff. Read this in full before starting any new task. Update this file as architectural decisions are made or change.

---

## Where the rest of the history lives

This file is loaded into context at the start of every session, so it carries the
current state and nothing else. Two companion files carry the past, and both were
split out for that reason:

| File | What it holds | Read it when |
|------|---------------|--------------|
| [`PHASE_HISTORY.md`](./PHASE_HISTORY.md) | One row per phase, as written at the time: what was wrong, what was chosen instead, and what the verification measured. | You need to know **why** something is the way it is before changing it. |
| [`SESSION_LOG.md`](./SESSION_LOG.md) | The chronological account of each working session, including what was tried and abandoned. | You are picking up mid-thread, or want the reasoning behind a decision in narrative form. |

Neither was edited on the way across. A claim about what was true in June stays a
claim about June, which is the point of keeping them.

**Keep this file current, and keep it short.** When a phase lands, add one line to
the status table here and the full row to `PHASE_HISTORY.md`. On 2026-08-13 this
file was 177KB, of which 75KB was a phase table nobody needed in full on most
sessions and 25KB was migration rationale that already lived in the migration
files' own headers. It is now under half that.
