# PaceMakers Business Consultants: standing rules

This file holds only what must be true in every session. Detail, examples and history live in the reference files below and are read on demand. PMBC is a separate codebase, Supabase project and Vercel deployment from Financial Modeler Pro (FMP); the two share no infrastructure and are linked only by hyperlinks in public content.

## Reference files

| File | Read it before |
|------|----------------|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Changing the stack, folder layout, admin roles, auth, admin routes, the sidebar, the page builder, the Growth Engine and its Knowledge Base, or PMBC and FMP cross-links |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Writing a migration, changing a table, or rebuilding the database (table index, migration order 001 to 082) |
| [`docs/CMS.md`](./docs/CMS.md) | Adding or changing a section type, a public page, the navigation, the footer, or service slugs |
| [`docs/EMAIL.md`](./docs/EMAIL.md) | Changing the Brevo wrapper, email templates, the email shell, or the Brevo webhook |
| [`docs/TOOLS.md`](./docs/TOOLS.md) | Any free tools work: visibility, the Tools nav item, leads, emails, reminders, booking and resume links, the Damodaran refresh, adding a tool |
| [`docs/VALUATION.md`](./docs/VALUATION.md) | Changing the Business Valuation engine, inputs, checks, formats, results page or report content |
| [`docs/REPORTS.md`](./docs/REPORTS.md) | Changing any tool PDF report's look, the letterhead or logos, or adding a tool report |
| [`docs/SEO.md`](./docs/SEO.md) | Changing metadata, OG images, the sitemap, robots or structured data |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | Changing colours, type, layout tokens, rich text, section copy fallbacks, or replacing the logo |
| [`docs/HISTORY.md`](./docs/HISTORY.md) | Checking open items, or why something is the way it is (dated records, newest first) |
| [`SESSION_LOG.md`](./SESSION_LOG.md) | Picking up mid-thread: session narrative, and the current handoff at its top |
| [`PHASE_HISTORY.md`](./PHASE_HISTORY.md) | Understanding why a phase went the way it did before changing it |

## Rules for this file and for commits

- **Never append session recaps, build logs or task history to CLAUDE.md.** Record them in `docs/HISTORY.md` (or `SESSION_LOG.md` for session narrative).
- **Only edit CLAUDE.md when a standing rule is added, changed or removed, and keep it under 25,000 characters.**
- **Before a task touching an area covered by a `docs/` reference file, read that file first.** When an architectural decision is made or changes, update the reference file that covers it.
- **Commit and push in the same step.** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`) with a concise scope, e.g. `feat(admin): add contact submissions table`.

## 1. Project identity

PaceMakers Business Consultants LLP (parent entity), `pacemakersglobal.com`, GitHub `financialmodelerpro/PMBC`, Vercel project `pmbc`, its own Supabase project, and Brevo for transactional email from `pacemakersglobal.com` on **its own Brevo account, separate from FMP's**, so a key rotation on one cannot take out the other's mail. Tagline: *Advisory from Structure to Exit*. A boutique corporate finance and transaction advisory firm for KSA, GCC and worldwide mandates; the audience is family offices, investment offices, real estate developers and corporates running M&A or valuation mandates. Self-built by Ahmad Din with Claude Code. PMBC is the parent entity and FMP its flagship platform.

The site converts referred prospects into conversations. It is a credibility document first, and quality of inbound outranks volume.

## 2. Content style rules

**Universal, with no carve-outs:** public copy, admin UI strings, fallback text, badge and button labels, alt text, source comments and JSDoc, commit messages and PR bodies, SQL migrations and their headers, this file and every repo markdown doc, replies to the user in chat, seeded JSONB, placeholder and hint text, validation and error messages, test fixtures. The earlier exemption for technical docs, comments and commits is revoked.

1. **No em dashes (U+2014).** Replace by relationship: pause or aside, a comma or parentheses; strong break, a new sentence; list intro or explanation, a colon; range, words ("4 to 6 weeks").
2. **No en dashes (U+2013) in prose.** Allowed only inside a numeric range whose format genuinely requires it, or in copy the user hands over verbatim.

**Enforcement is a release gate.** Before finishing any phase, grep every touched file; it must return zero. On Windows Git Bash use the escape form:

```sh
for f in $(git status --porcelain | awk '{print $NF}'); do
  n=$(grep -oP '\x{2014}' "$f" 2>/dev/null | wc -l)
  [ "$n" -gt 0 ] && echo "VIOLATION $f : $n"
done
```

When you find an em dash in existing content during other work, fix it as part of that work; do not raise em-dash-only PRs. Why: PMBC is institutional, considered and calm, and the em dash reads as energetic and digital-marketing-flavoured. If a sentence seems to need one, split it.

**Known pre-rule content, fix when next touching, not proactively:** `CMS_REFERENCE.md` and `PACEMAKERS_ADMIN_CMS_SPEC.md` are inherited references and exempt. Migrations 005, 008, 010, 011 and 014 to 020 are applied and never edited, so fix the rendered content instead; also the three `not-found`/`error` files and the email templates seeded in 008. `/privacy` and `/terms` measure zero.

## 3. Admin credentials

- Admin login `meetahmadch@gmail.com`. **The password is never recorded in this repository, in any file, terminal output or log.** Writing the previous one down is what made it worthless. The retired one is verified dead and remains in git history, which is deliberately not rewritten.
- **Rotate with `npm run rotate-admin-password`** or the console's Change Password screen (emailed code), **never `npm run seed-admin`**. Rotation reads a hidden prompt twice, enforces a strength floor, hashes at bcrypt cost 12 and verifies the stored hash and a real NextAuth login. `seed-admin.mjs` sets the password from `ADMIN_PASSWORD` and exits before any database call when it is missing or empty; it refuses to overwrite a row whose hash no longer matches (override `ADMIN_SEED_FORCE=1`), so a stray run cannot downgrade the live credential. If the password is lost, `rotate-admin-password` sets a new one with the service-role key, so there is no lockout risk.
- `seed-admin`, `smoke-admin`, `smoke-builder` and `verify-parity8` **require `ADMIN_PASSWORD`** and exit with code 1, naming the variable, when it is missing or empty; there is no fallback. `export ADMIN_PASSWORD=...` before running them. **Never put it in `.env.local`**, which the seed scripts load.

## 4. Stack and architecture

Single Next.js App Router application (^15), one domain, no subdomain routing: the public site plus an admin CMS. No public registration, payments or third-party integrations beyond Brevo, Supabase and the FMP content feed. TypeScript strict, Tailwind CSS 4, `@supabase/supabase-js` ^2, NextAuth ^4 (JWT), Brevo v3 REST with plain `fetch` and no SDK, sharp, `next/og`, lucide-react, react-hook-form with zod, TipTap, bcryptjs, Zustand only if needed, and `@react-pdf/renderer` ^4 for the free tools' PDFs (kept out of the bundle via `serverExternalPackages`, fonts traced with `outputFileTracingIncludes`). hCaptcha is wired but dormant; the forms use a honeypot and a timing floor.

- **lucide-react 1.x is the current major.** Never "downgrade" to 0.x.
- **Do not install:** Google Apps Script, pdf-lib (one PDF library is enough), exceljs, Recharts, `@anthropic-ai/sdk`, the YouTube API, `@auth/supabase-adapter`, Stripe or any payment SDK. **No cron jobs** except the one Vercel cron for the free tools' reminders (`vercel.json`).
- Code lives in `src/app/(public)`, `src/app/admin`, `src/app/api`, `src/components/{layout,public,admin,tools}`, `src/lib`, `src/config` and `src/types`; the full tree is in ARCHITECTURE.md.

## 5. Database and migrations

- Migrations live in `supabase/migrations/`, three-digit prefix, one logical change each. **Never edit a migration after it has been applied.** Read a migration's header before re-running it.
- **DDL migrations (031, 032, 033, 072, 076, 077, 082, 083, 084) must be pasted into the Supabase SQL editor by hand**: supabase-js cannot run DDL and there is no direct Postgres connection string. Everything else is DML applied by its `npm run` script, most with `--dry-run`.
- **034, 048 and 049 are destructive on re-run** (they delete and reinsert).
- **Every migration from 076 on states a `SAFE TO APPLY:` line** in its header: before or after which deploy, and what the site does in the gap. Previews share the production database, so applying early can publish links to routes not yet deployed (075 did exactly that).
- **Code that reads new columns or tables degrades safely when the migration has not run.** Keep that true for every new one.
- Single-row tables enforce `CHECK (id = 1)`; `site_settings` is one JSONB blob on purpose. Regenerate `src/types/database.ts` after a migration.

## 6. CMS

- **Two layers.** `cms_content` (key-value, unique on `(section, key)`) holds global content only: header, footer, contact details, SEO defaults. Prefer one row per atomic key over bundled JSON blobs; a JSON array is fine when the value is naturally a list. `page_sections` holds page body content, one row per block, rendered through `SECTION_REGISTRY` in `src/components/public/SectionRenderer.tsx`. Page copy belongs in sections, not `cms_content`.
- **CMS first.** Every public page section is editable in the admin. Deliberate exceptions: `/privacy`, `/terms` and `/confidentiality` (counsel-settled statements), and tool calculators (code).
- **Empty is not absent.** Read section copy through `sectionCopy` (`src/lib/public/sectionCopy.ts`), never `||`. Key absent: fall back to the shipped wording. Key present and empty: the operator cleared it, so render nothing. Composite blocks drop whole when every field is cleared.
- **Slug is not the URL.** Use `publicPathForPageSlug` / `previewPathForPageSlug` (`src/lib/cms/pageRoutes.ts`), never `` `/${slug}` ``. A new nested page needs a line there.
- A route out of the nav should be linked or retired properly. `/approach` is unreferenced everywhere, and `scripts/verify-page-rhythm.mjs` asserts that. `/book` is deliberately not in the top nav.

## 7. Admin console

- **Roles: `admin` and `editor`.** The line is deletion: an editor can create, edit and hide anything, but cannot delete, and cannot open Site Settings, Header Settings, Footer Links, Users, the Audit Log or the Growth Engine. Keep it to these two roles; no role hierarchies or invite flows.
- **Only the route check counts.** The middleware and the admin layout redirect (from `ADMIN_ONLY_PREFIXES` in `src/lib/auth/adminAccess.ts`) and the UI hides controls via `AdminRoleProvider`, but every API route checks for itself. **`getAdminSession` means any signed-in staff member**: an admin-only route uses `requireOwner` (403, not 401), and delete paths use `canDelete`.
- Every `/api/admin/*` route: session gate (401 when absent), zod-validated body, an `audit_log` row on success. Errors are `{ error: string }` with a non-2xx status. The settings-style routes accept `PATCH` and a legacy `POST`.
- **Admin pages use inline styles from `src/lib/admin/styles.ts`, not Tailwind**, so public-site work cannot restyle the console.
- **Page builder save model:** each section owns its Save, there is no global Save, and dirty state is per section id. Reorder, add and delete persist immediately; content and visibility wait for that section's Save.

## 8. Email

`src/lib/email/send.ts` posts to Brevo with plain `fetch`; keep its exported surface (`sendEmail`, `SendEmailArgs`, `SendEmailResult`). A missing `BREVO_API_KEY` or sender logs a warning and returns `{ ok: false, reason: 'not_configured' }` without throwing, so the contact form still saves. Email previews in the admin are sanitised through `sanitizeEmailHtml`. Brevo domain authentication (SPF, DKIM, DMARC) must stay complete or mail lands in spam.

## 9. Free tools

Free tools partly reverse the original "credibility document, not a lead engine" rule, by explicit instruction on 2026-09-16. The detail is in TOOLS.md, VALUATION.md and REPORTS.md.

- **Every tool ships Hidden, and only the owner switches one Live**, at `/admin/tools` (admin only, confirmed, audited). A tool is Live only when the registry says `build: 'ready'` **and** its `tool_visibility` row says `live`; a missing row, a missing table or a failed read means Hidden. That one answer, read only through `src/lib/tools/visibility.ts`, decides the page, the hub, the sitemap, the JSON-LD and the service CTA.
- **No production writes without the owner's approval.** That includes local runs, which use the production database, and anything that toggles visibility, submits a lead or sends email. Use `TOOLS_VISIBILITY_OVERRIDE` / `TOOLS_NAV_OVERRIDE` on a local `next start` instead of flipping switches (both are ignored when `VERCEL` is set).
- **Scripts that write never run against production.** Every script sending POST, PUT, PATCH or DELETE calls `refuseWritesAgainstProduction` and exits 2 against `pacemakersglobal.com` or any `*.vercel.app`; there is no override. Production checks are GET only.
- **Every tunable number lives in `src/lib/tools/valuation/data.ts`**, and nowhere else. The engine (`engine.ts`) is pure. **Nothing downstream computes a value**: the page, PDF, emails and admin read one `ValuationResult`, and rounding happens only in `format.ts`.
- **Never edit `reference/tools/business-valuation.html`**: it stays exactly as ported, and the verifier injects the current market data.
- **The form cannot accept what the server refuses**: text and list limits live in `src/lib/tools/valuation/limits.ts`, read by both. The server recomputes every result.
- **A nullable result field must be listed in `NULL_MEANS_ABSENT`** (`serialize.ts`). Stored results are never recomputed; bump `INPUT_SCHEMA_VERSION` when a stored input changes meaning, and branch on it in `resolveExtras`, never by guessing from shape.
- **Email status writes are conditional, never read-then-write** (`setEmailStatusIf`).
- **A booking short link only opens `/book`** and is never accepted where the access token is. Booking always goes to `/book`, never to Calendly directly.
- **Reports:** no colours or page chrome in a tool's own report file (use the shared theme); every absolute link in a PDF or tool email is built on `SITE_HREF`; replace all four logo copies when Header Settings changes the logo.

## 10. Design system

Institutional, not modern-startup: no gradient backgrounds, no animated icons, no playful microcopy. Heavier navy, more whitespace, larger type, serif headlines with Inter body, green sparingly as a credibility accent, gold minimally. Distinct from FMP's approachable style.

- **Tokens live in `src/app/globals.css` (`--pmbc-*`) and are mirrored in `src/lib/public/tokens.ts`. Keep the two in sync.** Primary navy `#1B3A5F`, deep navy `#14304F`, green `#3FA663`, gold `#C69C3E`, muted gold `#A88530`, cream `#FAF7F2`, text `#0F1B2D`, on-dark `#E8EEF5`, muted `#6B7280`. Card radius 8px.
- **Layout:** 1200px max width via `PAGE_GUTTER` + `PAGE_INNER` (`src/lib/public/layout.ts`), never a fresh `max-w-[...]` literal. Section padding `SECTION_PADDING` (96/80/64px), heroes `HERO_FRAME`. Check alignment by measuring with `npm run verify-container-widths`, not by reading.
- **A logo file must be trimmed before upload.** If the logo is replaced, the five sizes listed in DESIGN.md move with it.
- **Rich text:** never install `@tailwindcss/typography` or use `prose` classes. Use `.pmbc-prose` (plus `pmbc-prose-invert` on navy) and `PROSE_MEASURE`. Inline `margin` is not allowlisted in the sanitiser. Empty paragraphs are removed by `collapseEmptyParagraphs` at render and on save, never in the editor's `onChange`; **never give `p:empty` height in CSS.**

## 11. Environment variables

Names only: values never go in the repository, a commit, a log or a chat reply. `.env.local` is loaded by the seed scripts. The non-secret defaults are in ARCHITECTURE.md, "Environment defaults".

**Never pass a password, key or token as a literal in a shell command. Read it from an environment variable or prompt for it interactively.**

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `BREVO_API_KEY`, `EMAIL_FROM_DEFAULT`, `EMAIL_FROM_NAME`, `EMAIL_TO_ADMIN`, `EMAIL_FROM_CONTACT` (optional, the From on the acknowledgement), `FMP_API_URL`, `FMP_API_KEY` (server only; FMP fails closed, and PMBC then serves its stored copy), `HCAPTCHA_SECRET_KEY` and `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` (not required; setting both re-enables hCaptcha), `TOOL_LEAD_IP_SALT` (IP hashing, falls back to `NEXTAUTH_SECRET`), `BREVO_WEBHOOK_TOKEN` (unset, the webhook answers 503), `CRON_SECRET` (unset, the reminder cron answers 503), `NEXT_PUBLIC_GA_ID` (optional).

## 12. Not in scope

Do not build without a real need or real content: a newsletter list, a client portal, AI features (content suggestions, chatbot, generated pages), search, comments or community features, pricing pages, or Arabic `/ar/*` routes (only if KSA demand requires it). Articles (`/insights`) and case studies are built as managed collections and render empty until content arrives. Booking is `/book`, with a Calendly inline embed reading `site_settings.booking_url`.

## 13. Code conventions

- **Server components by default.** `'use client'` only for interactive forms, browser-only APIs (TipTap, drag and drop) and interactive primitives.
- Public page data is fetched in server components through `lib/cms/*`; no client-side content fetching. Admin mutations go through API routes.
- **Public pages degrade gracefully**: a failed CMS fetch falls back to `config/site.ts` content and never breaks the page. Admin surfaces errors clearly. API errors are `{ error: string, code?: string }` with a fitting status.
- Type Supabase queries with the generated `Database` type.
- Naming: components PascalCase, utilities camelCase, route folders and API routes kebab-case.

## 14. Critical reminders

0. **"PMBC" never appears in public copy.** The firm is PaceMakers to a reader. Composed copy needs care: use `withIndefiniteArticle` (`src/lib/public/grammar.ts`) rather than a hardcoded "a", and never lowercase a proper title.
1. **Credibility first.** Free tools are allowed (2026-09-16), but a tool is published only when it is good enough to carry the firm's name, and each lead records deal size and a below-minimum flag. Heavy SEO content stays out of scope.
2. **Design feels institutional**: senior, considered, calm.
3. **Honest credentials only, and the firm's are not the partner's.** The firm: 30+ mandates since 2017 across biofuel, oil and gas, waste management, data centers, construction and industrial services. Ahmad's career (200+ engagements, 200+ valuations, SAR 20B+ real estate NAV, SAR 300M+ deployed via equity research, ACWA Power, Saudi Aramco-backed projects) is attributed to him and lives in his credentials, never in a firm statistic.
3b. **Delivery model:** the partner wins and leads every mandate and reviews all work personally; analysts and associates are engaged per engagement; no permanent pyramid and no junior handoff. **Never name individual analysts.** Sky Gulf and Lynkers are referral, origination and market-access relationships only and do not execute mandates (never "Execution Partner").
4. **PMBC hosts its own founder profile** at `/about/ahmad-din` (reversed 2026-08-02). It stays deliberately different from FMP's page of the same path ("Why PaceMakers", and no Notable Projects or booking-led CTAs). If the two converge on identical copy, revisit and consider a canonical pointing at PMBC.
5. **Lead with KSA and GCC.** Pakistan is operational headquarters, not the marketing geography; Lahore is mentioned only as where the analytical work happens.
6. **CMS first**, with the exceptions in section 6.
7. **Two admin roles, admin and editor**, as in section 7. No public accounts or invite flows.
8. **Match FMP's quality bar, not its complexity**: clean migration discipline, typed queries, server-first rendering, branded emails, OG images; no Apps Script, dual auth, quizzes or certificates.

## 15. Deploy, test and verify

- Vercel deploys `main` on push. After a deploy, confirm `/api/health` reports the new commit sha before checking the live site.
- Before committing: `npx tsc --noEmit -p .`, `npm run build`, the verifiers for the area touched (named in the reference files, e.g. `verify-valuation-engine`, `verify-tool-followup`, `verify-tools-visibility`), and the em dash gate. Every verifier check is break-tested.
- **Verify against production with GET requests only** (`VERIFY_BASE=https://www.pacemakersglobal.com`). Never write to production data, send email or delete anything there without the owner's explicit approval.
