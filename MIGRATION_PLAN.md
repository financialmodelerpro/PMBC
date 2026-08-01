# PMBC Consolidation and Migration Plan

**Status:** Phases A and B executed 2026-08-01 (see the status update below). Phases C to F remain proposed.
**Author:** Prepared for Ahmad Din, PaceMakers Business Consultants LLP.
**Date:** 2026-08-01
**Scope:** Consolidate the untracked `PMBC from FMP/` tree into the main PMBC application, remove redundancy, close feature parity gaps, retune branding, and establish governance.

> **STATUS UPDATE 2026-08-01.** Two phases of this plan are done, delivered alongside the FMP admin-parity work rather than as a separate programme:
>
> - **Phase A (decommission): COMPLETE.** `PMBC from FMP/` was extracted (29 files staged outside the repo with sha256 manifests), archived as parentless commit `5926e49` under tag `fmp-cms-archive-2026-08-01` (59 files), then deleted. The `tsconfig` exclude added as a stopgap was removed. `tsc --noEmit` went from **107 errors to 0** from a clean tree with no exclusions. The allowlist in Appendix A was extended first: as written it would have discarded the reference source for parity phases 3 to 8, including the two rich-text components parity 6 exists to port.
> - **Phase B (security baseline): COMPLETE.** `sanitize-html` installed and `src/lib/cms/sanitize.ts` shipped with three allowlists (inline, rich, email). All 10 `dangerouslySetInnerHTML` sites route through it. The render diff described in risk R3 was run and came back **14 of 14 public routes byte-identical**, so the risk did not materialise. A hostile payload test confirmed 0 markers reach the DOM. The `normalizeExternalUrl` port (P7) was **not** done; link safety is instead enforced by the sanitiser's scheme allowlist and by Tiptap's protocol config.
>
> Phases C to F (the Articles schema and editor work, P2 to P6 and P8) remain outstanding and are still accurately described below.

---

## 0. Executive summary, and one correction to the brief

The brief asks to "migrate all content and structure into the new PMBC-based CMS framework." Before planning that, I inspected both trees. The finding changes the shape of the work, so it is stated first.

**`PMBC from FMP/` contains no content.** It is an admin-only scaffold, copied out of Financial Modeler Pro, that has never been connected to a database. Its own README states this plainly: *"Nothing has been run against a real database, because the PaceMakers Supabase project does not exist yet."* It ships exactly one SQL file (`001_cms_schema.sql`, DDL only, zero `INSERT` statements), its public home page is a hardcoded placeholder that says the site has not been built, and it has no seed scripts.

Meanwhile the main application at the repo root is the mature system: 28 applied migrations, seeded content for every page, a complete public site (14 routes), a complete admin console (20 destinations), auth, email, SEO, OG images, and RLS.

So the direction implied by the brief is inverted. There is no content to move from the nested tree into the main one. What actually exists is:

1. **A redundant duplicate tree** that should be deleted, not migrated. It is a second Next.js app (Next 16, React 19.2.3, webpack) living inside the root of the first (Next 15.5, React 19.1, Turbopack), with its own `node_modules`, its own lockfile, and its own `.next` build output.
2. **A short list of genuine feature gaps** where the FMP-derived copy is ahead of the main app. These are worth porting. There are nine of them, listed in section 3.
3. **One security gap** that the nested tree gets right and the main app does not: rich-text sanitization. The main app renders CMS-authored HTML through `dangerouslySetInnerHTML` in eight places with no sanitizer installed. This is the highest-priority item in the whole plan.

Accordingly the "content mapping matrix" in section 4 is a **schema-to-schema and capability-to-capability** matrix rather than a row-level content matrix, because there are no rows. That is the honest version of the deliverable. A row-level matrix would be fabricated.

The branding work in section 8 is unaffected by the above and proceeds as asked. It is grounded in measured WCAG contrast ratios, and it surfaces a **live accessibility defect**: the muted gold currently used for eyebrow and label text on light backgrounds measures 3.46:1, which fails WCAG AA for normal text.

---

## 1. Current state, as measured

### 1.1 The two trees

| | Main app (`/`) | Nested tree (`/PMBC from FMP/`) |
|---|---|---|
| Package name | `pmbc-site` | `pacemakers-site` |
| Next.js | 15.5.15, Turbopack | 16.2.1, webpack |
| React | 19.1.0 | 19.2.3 |
| TipTap | 3.22.5 | 2.27.2 |
| Auth | NextAuth 4 + bcrypt + `admin_users` + `audit_log` | Single shared `ADMIN_PASSWORD`, HMAC cookie |
| Public site | 14 routes, 13 section renderers | One placeholder page |
| Admin console | 20 destinations | 14 pages, 10 API routes |
| Migrations | 28, applied | 1, never applied |
| Content | Seeded (migrations 010 to 020) | None |
| Validation | zod throughout | Ad hoc |
| Sanitization | **None** | `sanitize-html` 2.17.5 |
| Git status | Tracked | **Untracked**, 1.1 MB excluding `node_modules` |
| Verified against a DB | Yes | **No** |

### 1.2 Diagnosed issues

Ordered by severity.

**S1. Unsanitized CMS HTML reaches the browser in eight places.** No sanitizer is installed in the main app. Every one of these renders operator-authored HTML directly:

```
src/app/(public)/case-studies/[slug]/page.tsx:113   study.body
src/app/(public)/insights/[slug]/page.tsx:83        article.body
src/app/(public)/team/page.tsx:94                   m.bio
src/components/public/sections/FmpIntro.tsx:107     c.description_html
src/components/public/sections/FounderBlock.tsx:154 c.bio_html
src/components/public/sections/Paragraphs.tsx:27    html
src/components/public/sections/ServiceDetail.tsx:94 c.full_description_html
src/components/public/sections/TextImage.tsx:138    c.body_html
```

Two admin previews in `EmailBrandingForm.tsx` do the same. Today the only author is a trusted admin, so this is not an active compromise. It becomes one the moment a second editor account exists, which section 9 proposes. Treat it as a prerequisite for multi-editor governance, not as an optional hardening pass.

**S2. Schema collision risk on `contact_submissions`.** The nested `001_cms_schema.sql` defines `contact_submissions` as `(name, email, subject, message, read, created_at)`. The main app's migration 004 defines it as `(name, email, company, phone, country, service_interest, message, source_page, status, notes, created_at, read_at, responded_at)`. The nested file is `CREATE TABLE IF NOT EXISTS` throughout. If anyone runs it against the live PMBC Supabase project, **every statement silently no-ops** and the operator is told nothing is wrong, while believing a schema was applied. The same trap applies to `page_sections`, `cms_pages`, `cms_content`, `site_pages`, `articles`, and `testimonials`, all of which already exist with different shapes.

Mitigation: the nested SQL file must never be run. Deleting the tree (section 5) removes the hazard at the root.

**S3. Article scheduling is a dead state in the source.** `src/shared/cms/scheduling.ts` is well-designed and its reasoning is sound, but it depends on `/api/cron/publish-scheduled-articles`, which **does not exist anywhere in the nested tree**, and there is no `vercel.json`. An article saved as `status='scheduled'` in that codebase would never publish. Separately, `CLAUDE.md` section 2 lists cron jobs as explicitly excluded from PMBC v1.

Recommendation: port the scheduling **intent** but not the cron. Filter at read time instead. `src/lib/cms/collections.ts` currently filters on `.eq('status', 'published')` alone; adding `.lte('published_at', new Date().toISOString())` gives correct scheduled publishing with no scheduler, no Vercel plan constraint, and no drift between a cron and an editor tab. This is strictly better for PMBC than the source design.

**S4. Nested `node_modules` inside a Next.js project root.** A second lockfile and a second `node_modules` under the app root can confuse Next.js workspace-root inference and Vercel's build detection. Low probability, high annoyance, and it disappears with the deletion in section 5.

**S5. `PMBC from FMP/.env.example` is not git-ignored.** The root `.gitignore` has `!.env*.example`, which un-ignores it. Verified with `git check-ignore`. Its contents are placeholders only (`eyJ...`, `choose-a-long-random-password`), so **no secret is exposed**. Noted so it is not mistaken for a leak during the deletion review.

**S6. Vocabulary leakage from FMP.** The nested schema names the article-author table `instructors` and exposes `/api/admin/instructors`, because the parent site taught courses. PMBC has no instructors. Porting the name would import a concept that does not exist in the business. Rename to `authors` on the way in.

**S7. Pre-existing launch blockers, unchanged.** Documented in `CLAUDE.md`. Production env vars on Vercel, rotation of the `Admin@2026` debug password, DNS and SSL, and counsel review of `/privacy` and `/terms`. Also, **two contact submissions remain unread**, one of which (2026-06-21, Leslie Merricroft, Al-Mashrea Law Firm) appears genuine and is now roughly six weeks unanswered. That is a same-day action, independent of this plan.

---

## 2. Target architecture

Single Next.js application, single Supabase project, single Vercel project. No second app, no shared infrastructure with FMP.

```
                              PUBLIC INTERNET
                                     |
                     +---------------+---------------+
                     |                               |
              pacemakersglobal.com          /admin/* (gated)
                     |                               |
        =============v===============================v=============
        |            VERCEL  (project: pmbc, Next.js 15 App Router) |
        |                                                           |
        |  (public) route group          admin route group          |
        |  +---------------------+       +----------------------+   |
        |  | / /services /about  |       | Dashboard            |   |
        |  | /sectors /approach  |       | Content:             |   |
        |  | /network /contact   |       |   Page Builder       |   |
        |  | /insights/[slug]    |       |   Header Settings    |   |
        |  | /case-studies/[slug]|       |   Branding           |   |
        |  | /team /privacy      |       |   Page Content       |   |
        |  | /terms  /financial- |       |   Pages & Nav        |   |
        |  |         modeler-pro |       |   Insights (+ NEW    |   |
        |  +----------+----------+       |     categories,      |   |
        |             |                  |     series, authors) |   |
        |    SectionRenderer              |   Testimonials       |   |
        |    (13 section types,           |   Media Library      |   |
        |     3 background variants)      |   OG Previews        |   |
        |             |                  | Collections:         |   |
        |    +--------v---------+        |   Services           |   |
        |    | NEW: sanitizeCms |        |   Case Studies       |   |
        |    | (allowlist HTML) |        |   Team & Advisors    |   |
        |    +--------+---------+        | Leads / Email / Sys  |   |
        |             |                  +----------+-----------+   |
        |             |                             |               |
        |   lib/cms/* fetchers            /api/admin/* routes        |
        |   (read, degrade to empty)      (session-gate -> zod ->    |
        |             |                    mutate -> audit_log)      |
        =============|=============================|=================
                     |                             |
                     |  service-role key           |  service-role key
                     v                             v
        ==========================================================
        |                  SUPABASE (PMBC project)                |
        |  RLS enabled, DEFAULT DENY on every table.              |
        |  Service role bypasses RLS. Anon key reads nothing.     |
        |                                                          |
        |  Content:   cms_pages, page_sections, cms_content,       |
        |             site_pages                                   |
        |  Collections: services, case_studies, team_members,      |
        |             articles, testimonials                       |
        |  NEW:       categories, article_categories,              |
        |             article_series, authors                      |
        |  Identity:  admin_users, audit_log                       |
        |  Leads:     contact_submissions                          |
        |  Config:    branding_config, site_settings,              |
        |             email_branding, email_templates              |
        |  Storage:   cms-assets, article-covers,                  |
        |             case-study-images, team-photos               |
        ==========================================================
                     |
                     v
        ==========================================================
        |  RESEND: contact notification + acknowledgement          |
        |  (degrades gracefully when RESEND_API_KEY is absent:     |
        |   the submission still persists, no email is sent)       |
        ==========================================================

  OUTBOUND LINKS ONLY (no data flow, no shared DB, no shared auth):
        pacemakersglobal.com  <------ hyperlinks ------>  financialmodelerpro.com
```

### Data flow, read path

Browser request, then Next.js server component, then `lib/cms/*` fetcher using the service-role key, then Supabase (RLS bypassed by service role), then rows returned, then `sanitizeCmsHtml()` on any HTML field, then `SectionRenderer` resolves the background variant, then rendered HTML. On fetch failure the fetcher returns empty and the page degrades rather than breaking.

### Data flow, write path

Admin browser, then `/api/admin/*` route, then `getAdminSession()` (401 if absent), then zod validation, then Supabase mutation via service role, then `audit_log` insert, then `{ row }` or `{ error }` response.

### Migration flow

Author `supabase/migrations/0XX_*.sql`, then review, then apply to a Supabase branch, then verify, then apply to production, then regenerate `src/types/database.ts`, then typecheck, then deploy. Migrations are never edited after being applied.

---

## 3. Feature parity gaps, and the disposition of each

These are the only things in `PMBC from FMP/` worth carrying across. Everything else in that tree is either already present in the main app or is a regression against it.

| # | Capability in nested tree | Main app today | Disposition | Effort |
|---|---|---|---|---|
| P1 | `sanitize-html` on rich text | Absent, 8 unsanitized render sites | **Port, highest priority.** Central `lib/cms/sanitize.ts` allowlist | S |
| P2 | `categories` + `article_categories` many-to-many | Single free-text `category` column | **Port.** Backfill existing values | M |
| P3 | `article_series` + `series_order` ("Part 2 of 5") | Absent | **Port.** Enables multi-part insights | M |
| P4 | `instructors` table + byline snapshot fields | `author_id` to `admin_users` | **Port, renamed to `authors`.** Snapshot preserves historical bylines | M |
| P5 | Article media fields: `mid_image_url`, `mid_image_caption`, `og_image_url`, `tags[]`, `hero_before_content` | Absent | **Port.** Cheap columns, real editorial value | S |
| P6 | Scheduled publishing (`scheduled_at`, `resolveSchedule`) | Absent | **Port the rule, not the cron.** Read-time filter, see S3 | M |
| P7 | `normalizeExternalUrl` / `normalizeLinkedInUrl` | Absent | **Port verbatim.** Blocks `javascript:` hrefs, fixes scheme-less URLs | S |
| P8 | Slug uniqueness check endpoint | Absent, collisions surface as a save error | **Port.** Small editor quality win | S |
| P9 | Schema-tolerant writes (retry without a missing column) | Absent | **Do not port.** It is a workaround for an unverified schema. PMBC's migrations are applied and typed. Adopting it would hide real errors | n/a |

### Explicitly not ported, to avoid regression

| Item | Reason |
|---|---|
| Shared-password auth (`adminAuth.ts`) | Main app has NextAuth, bcrypt, per-user identity, and an audit trail. Single shared password is strictly weaker and defeats governance in section 9 |
| Nested `CmsAdminNav.tsx` | Main app's version is further along: collapse persistence, `matchPaths`, off-canvas drawer, FMP-parity grouping |
| Nested `RichTextEditor.tsx` | TipTap 2.x. Main app is on TipTap 3.x. Not copy-paste compatible |
| Nested `001_cms_schema.sql` | Collides silently with the live schema. See S2 |
| Nested `contact_submissions` shape | Main app's is a strict superset |
| Nested `app/page.tsx` placeholder | Main app has a real home page |

**Carry forward the fail-closed principle from `adminAuth.ts` even though the file itself is not ported.** Its documented lesson (an unset secret must mean denied, never allowed) is a correct and hard-won rule. Adopt it as a governance standard in section 9 and enforce it as a CI check in section 10.

---

## 4. Content and structure mapping matrix

Direction is `PMBC from FMP/` to main app. As established in section 0, the source has no rows, so **every "Data to move" cell is `None`**. The matrix maps structure and capability.

### 4.1 Database objects

| Source object | Source shape | Target in main app | Data to move | Action | Migration |
|---|---|---|---|---|---|
| `page_sections` | id, page_slug, section_type, content, display_order, visible, styles | Exists, migration 002. Equivalent | None | No-op | none |
| `cms_pages` | adds `seo_title`, `seo_description`, `is_system` | Exists, uses `meta_title`, `meta_description`, no `is_system` | None | Keep target naming. `is_system` not needed | none |
| `cms_content` | section, key, value | Exists, migration 002. Equivalent | None | No-op | none |
| `site_pages` | label, href, visible, display_order, `can_toggle` | Exists, migration 027 | None | Evaluate `can_toggle` for pinning Home and Contact | 029 (optional) |
| `articles` | 24 columns | Exists, migration 024, 14 columns | None | **Add 10 columns** (P3, P5, P6) | 031 |
| `categories` | id, name, slug | Absent | None | **Create** (P2) | 029 |
| `article_categories` | article_id, category_id | Absent | None | **Create** (P2) | 029 |
| `article_series` | id, title, slug, description | Absent | None | **Create** (P3) | 029 |
| `instructors` | name, title, photo_url, bio, profile_url, is_default | Absent | None | **Create as `authors`** (P4, S6) | 030 |
| `testimonials` | adds `source` | Exists, migration 025. Superset otherwise (`testimonial_type`, `video_url`, `show_on_landing`) | None | Optionally add `source` | 032 |
| `contact_submissions` | 6 columns | Exists, migration 004, 13 columns | None | **Discard source shape.** Collision hazard, see S2 | none |
| `cms-assets` bucket | public read | Exists, migration 026, plus 3 more buckets | None | No-op | none |

### 4.2 Admin screens

| Source screen | Target | Action |
|---|---|---|
| `/admin/cms` (launcher) | `/admin` dashboard | Discard. Target dashboard has live KPIs, recent inquiries, quick actions |
| `/admin/page-builder` (+ `[slug]`) | Same route, three-pane with live preview | Discard source. Target is ahead |
| `/admin/header-settings` | Same | Discard source |
| `/admin/content` | Same, with service-detail grouping | Discard source |
| `/admin/pages` | Pages & Nav over `site_pages` | Discard source |
| `/admin/articles` (+ new, `[id]`, categories, series) | `/admin/articles`, `CollectionManager` with 11 flat fields | **Rebuild as a bespoke editor.** The single biggest port. See 4.3 |
| `/admin/testimonials` | Same, via `CollectionManager` | Discard source |
| `/admin/media` | Same, plus 4 buckets | Discard source |
| `/admin/login` | NextAuth login | Discard source |

### 4.3 Article editor field mapping, the one substantial port

| Source field or component | Target treatment |
|---|---|
| `ArticleBodyEditor` (TipTap 2) | Reimplement on the existing TipTap 3 `RichTextEditor` |
| `CategoryMultiSelect` | Port. Rewire to `article_categories` join |
| `ArticleSeriesField` | Port. Rewire to `article_series` |
| `InstructorPicker` | Port, rename to `AuthorPicker`, point at `authors` |
| `ArticleWriterField`, `ArticleAuthorAboutFields` | Port. These write the byline snapshot |
| `ArticleScheduleField` | Port UI. Replace cron copy with the read-time-filter guarantee |
| `ArticleExtraFields` (mid image, tags, og image) | Port |
| `LocalDateTime` | Port. Small utility, no dependencies |
| `RichTextarea` | Evaluate. Likely redundant against `RichTextEditor` |
| `DeleteArticleButton` | Discard. Use the existing `ConfirmDialog` |
| `slug-check` route | Port to `/api/admin/articles/slug-check` |

---

## 5. Migration plan, steps, dependencies, rollback

### Phase A. Decommission the duplicate (day 1, blocks everything else)

Do not delete before extracting. The tree is untracked, so deletion is unrecoverable.

1. Snapshot the tree to a location outside the repo, excluding `node_modules` and `.next`. Roughly 1.1 MB.
2. Optionally preserve it as a git object for provenance:
   `git checkout --orphan fmp-cms-archive`, commit the tree, tag `fmp-cms-archive-2026-08-01`, return to `main`. Never merge that branch.
3. Copy the nine port candidates from section 3 into a staging directory.
4. Delete `PMBC from FMP/` from the working tree.
5. Add a `.gitignore` guard so a stray copy cannot be committed again.
6. Verify: `npm run typecheck` and `npm run build` at the root still pass, and no import resolves into the deleted path.

**Rollback:** restore from the snapshot or the archive tag. No database state is touched in this phase, so rollback is total.

### Phase B. Security baseline (days 2 to 4, blocks Phase D and section 9)

1. `npm i sanitize-html @types/sanitize-html`.
2. Create `src/lib/cms/sanitize.ts` exporting `sanitizeCmsHtml()` with an explicit allowlist. Permit the tags TipTap 3 emits (`p`, `h2`, `h3`, `h4`, `ul`, `ol`, `li`, `strong`, `em`, `u`, `a`, `blockquote`, `img`, `br`, `hr`, `figure`, `figcaption`). Permit `href`, `src`, `alt`, `title`, `target`, `rel`. Restrict schemes to `http`, `https`, `mailto`. Force `rel="noopener noreferrer"` on any `target="_blank"`.
3. Apply at all eight public render sites and both admin preview sites.
4. Port `normalizeExternalUrl` and `normalizeLinkedInUrl` to `src/lib/utils/externalUrl.ts` (P7) and apply to every operator-supplied href.
5. Add a CI guard that fails on any new `dangerouslySetInnerHTML` not routed through the sanitizer or `JSON.stringify` for JSON-LD.

**Rollback:** revert the commit. Sanitization is render-time only and writes nothing, so there is no data to unwind. Risk of over-restriction is real: if the allowlist is too tight, existing content loses formatting. Mitigate by diffing rendered output on all 14 public routes before and after, in staging.

### Phase C. Schema extension (days 5 to 8, depends on A)

Migrations 029 to 032, each one logical change, applied in order, never edited after application.

| Migration | Contents |
|---|---|
| `029_article_taxonomy.sql` | `categories`, `article_categories`, `article_series`. RLS enabled, default deny, per the 013 pattern. Indexes on the join table both ways |
| `030_article_authors.sql` | `authors` table (P4, renamed from `instructors`), plus `articles.writer_id`, `writer_name`, `writer_title`, `writer_avatar_url`, `author_bio`, `author_profile_url`. RLS default deny |
| `031_article_fields.sql` | `articles`: `series_id` (FK to `article_series`, `ON DELETE SET NULL`), `series_order`, `tags text[]`, `mid_image_url`, `mid_image_caption`, `og_image_url`, `hero_before_content`, `scheduled_at`. Widen the `status` check to include `scheduled` |
| `032_backfill_categories.sql` | Read distinct non-null `articles.category`, insert into `categories`, populate `article_categories`. Idempotent. Leaves the legacy column in place |

Every migration ships with a paired `0XX_rollback.sql`. Supabase has no down-migration runner, so these are run manually.

**Sequencing constraint:** 031's FK requires 029. 032 requires both.

**Rollback:** run the paired rollback file, which drops added columns and tables in reverse dependency order. Because 029 to 031 are purely additive (no drops, no renames, no type changes on existing columns), the running application is unaffected until code reads the new columns. That is deliberate: schema lands first, code lands second, so a rollback in this phase cannot break production. Take a Supabase PITR snapshot before 032, which is the only one that writes rows.

### Phase D. Editor rebuild (days 9 to 16, depends on B and C)

1. Regenerate `src/types/database.ts` from the new schema. Run `npm run typecheck`.
2. Build `/api/admin/{categories,series,authors}` using the existing `createCollectionApi` factory in `src/lib/admin/collectionApi.ts`. It already gives session gating, zod validation, audit logging, and auto-slugify.
3. Extend `/api/admin/articles` for the join table and the schedule rule. Port `resolveSchedule` into `src/lib/cms/scheduling.ts`, **stripping the cron references** and re-documenting the guarantee as read-time filtering.
4. Replace the flat `CollectionManager` on `/admin/articles` with the bespoke editor. Add `/admin/articles/categories` and `/admin/articles/series`.
5. Add `slug-check` (P8).
6. Update `CmsAdminNav`: Categories and Series belong under Content, near Insights.

**Rollback:** the admin console is behind auth and has no public surface, so a revert affects only the operator. Keep the previous `CollectionManager`-based page for one release so a revert is a single-file swap.

### Phase E. Public rendering (days 17 to 20, depends on C and D)

1. `lib/cms/collections.ts`: add `.lte('published_at', now)` to the article fetchers so scheduling works without a cron (S3).
2. `/insights` filters by category. `/insights/[slug]` renders the byline snapshot, the mid-article image, and series navigation ("Part 2 of 5").
3. Route article `og_image_url` through the existing `buildPageMetadata` helper.
4. Extend `sitemap.ts` with category and series index routes.

**Rollback:** revert the commit. Public routes return to their current behaviour. No data is touched.

### Phase F. Branding and accessibility (days 21 to 25, independent of A to E, can run in parallel)

See section 8.

### Cross-cutting rollback strategy

| Layer | Mechanism | Recovery time |
|---|---|---|
| Code | `git revert`, Vercel instant rollback to the prior deployment | Under 5 minutes |
| Schema, additive (029 to 031) | Paired rollback SQL. Additive changes are inert until code reads them | Under 15 minutes |
| Schema, data-writing (032) | Supabase PITR snapshot taken immediately before | Under 60 minutes |
| Content | `page_sections` and `cms_content` are not touched by this plan | n/a |
| Full stop | Phases are independently revertible and ordered so no later phase is required to make an earlier one safe | n/a |

**The single irreversible step in this plan is the Phase A deletion.** It is gated on the snapshot in A1 and the archive tag in A2. Nothing else destroys state.

---

## 6. Code and data migration script outline

No credentials, no personal data, no live values. Every script reads configuration from the environment and refuses to run if it is absent.

### 6.1 Extraction, Phase A

```
scripts/extract-fmp-ports.mjs
  Purpose: copy the nine port candidates out of the doomed tree, once.
  Input:   SOURCE_DIR (default "PMBC from FMP"), STAGING_DIR
  Steps:
    1. Assert SOURCE_DIR exists. Exit 0 with a message if already deleted.
    2. Copy the explicit allowlist of files. Never copy a whole directory:
         src/shared/utils/externalUrl.ts
         src/shared/cms/scheduling.ts
         src/components/admin/{CategoryMultiSelect,ArticleSeriesField,
           InstructorPicker,ArticleWriterField,ArticleAuthorAboutFields,
           ArticleScheduleField,ArticleExtraFields,LocalDateTime}.tsx
         app/api/admin/articles/slug-check/route.ts
    3. Write a manifest (source path, sha256, destination) to STAGING_DIR.
    4. Print the files NOT copied, so the operator confirms nothing was missed
       before the delete.
  Writes: filesystem only. Never touches the database.
```

### 6.2 Category backfill, Phase C

Prefer SQL in `032_backfill_categories.sql`. A Node equivalent is given because it is easier to dry-run.

```
scripts/backfill-article-categories.mjs
  Purpose: turn the free-text articles.category column into rows in
           categories + article_categories.
  Env:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required, no defaults,
           fail closed and exit non-zero if either is absent)
  Flags:   --dry-run (default true). Writes only when --commit is passed.
  Steps:
    1. Assert both env vars are present. Exit 1 otherwise. Never assume a
       missing secret means "skip the check". See the fail-closed rule in
       section 9.
    2. SELECT id, category FROM articles WHERE category IS NOT NULL
       AND category <> ''
    3. Build the distinct set. Slugify each with the existing
       lib/admin/slugify.ts so slugs match the rest of the system.
    4. Upsert into categories ON CONFLICT (slug) DO NOTHING.
    5. Insert (article_id, category_id) ON CONFLICT DO NOTHING.
       The composite primary key makes re-runs safe.
    6. Print a table: category name, slug, article count, action taken.
    7. Under --dry-run, print steps 4 and 5 as intended statements and stop.
  Idempotent: yes. Re-running changes nothing.
  Rollback:  DELETE FROM article_categories; DELETE FROM categories;
             The legacy articles.category column is never modified, so the
             source of truth survives a failed backfill intact.
```

### 6.3 Verification, after every phase

```
scripts/verify-migration.mjs
  Purpose: prove the migration did what it claimed. Read-only.
  Env:     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SITE_URL
  Checks:
    1. Every expected table exists and RLS is enabled on it.
    2. Every table has zero permissive policies (default deny, per 013).
    3. Article count before equals article count after.
    4. Every distinct legacy articles.category has a matching categories row.
    5. No article references a series_id that does not exist.
    6. All 14 public routes return 200.
    7. All 20 admin routes return 307 to login when unauthenticated.
    8. Rendered HTML on all 14 public routes contains no em dash (U+2014)
       and no en dash (U+2013) outside numeric ranges.
    9. Rendered HTML contains no retired colour value.
  Output:  a pass/fail table. Exit non-zero on any failure, so CI can gate.
  Reuses:  the existing scripts/smoke-admin.mjs and smoke-builder.mjs patterns.
```

---

## 7. Milestones and timeline

Five weeks of working time. Calendar dates assume a start of Monday 2026-08-03 and a five-day week. Content population and the launch blockers in S7 run in parallel and are not on this critical path.

| M | Milestone | Phase | Target date | Exit criteria | Sign-off |
|---|---|---|---|---|---|
| M0 | Plan approved | none | 2026-08-04 | This document accepted. Archive strategy for the nested tree agreed | Product Owner |
| M1 | Duplicate decommissioned | A | 2026-08-07 | Tree archived and deleted. Root build and typecheck green. Ports staged with manifest | Tech Lead |
| M2 | Security baseline | B | 2026-08-12 | Sanitizer live at all 10 sites. URL normalizer live. CI guard active. Rendered output diffed with no unintended formatting loss | Tech Lead, Security reviewer |
| M3 | Schema extended | C | 2026-08-18 | 029 to 032 applied. Types regenerated. Typecheck green. Backfill verified. RLS default deny confirmed on all new tables | Data Owner, Tech Lead |
| M4 | Editor rebuilt | D | 2026-08-28 | Categories, series, authors, scheduling, slug-check all functional. Full CRUD round trip with audit rows written | Tech Lead, Content Lead |
| M5 | Public rendering | E | 2026-09-03 | Category filtering, series navigation, byline, scheduled publishing all live. Sitemap extended | Tech Lead, Product Owner |
| M6 | Branding and accessibility | F | 2026-09-08 | Palette retuned. Zero WCAG AA text failures. Dark-section ratio reduced. Axe clean on all 14 routes | Design Owner, Accessibility reviewer |
| M7 | Consolidation complete | all | 2026-09-10 | All quality gates green. Governance in section 9 in force | Product Owner |

Phase F is schedule-independent of B to E and can be pulled forward if design capacity frees up. M2 is the only hard prerequisite for the multi-editor governance model, so if the timeline compresses, protect M2 and defer M4.

---

## 8. Branding, applied

Requested direction: gold minimal, PMBC green for accents, navy for light backgrounds, avoid excessive dark tones, corporate-level look, accessible.

### 8.1 Two measured findings

**Finding 1: the green is defined but never used.** `--pmbc-secondary: #3FA663` exists in `globals.css`, is mirrored in `tokens.ts`, and is editable in the branding admin. It is consumed by **zero** public renderers. Grep across `src/` returns only the token declaration, the admin colour-picker form, and the zod validator. The "green accents" instruction is therefore net-new work, not a retune.

**Finding 2: the palette has a live WCAG AA failure.** Measured contrast ratios, computed against WCAG 2.1 relative luminance:

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| Muted gold `#A88530` | White `#FFFFFF` | **3.46** | **Fails AA for normal text** |
| Muted gold `#A88530` | Cream `#FAF7F2` | **3.24** | **Fails AA for normal text** |
| Gold `#C69C3E` | White | 2.55 | Fails. Non-text use only |
| Gold `#C69C3E` | Cream | 2.39 | Fails. Non-text use only |
| Green `#3FA663` | White | 3.07 | Fails for normal text |
| Green `#3FA663` | Cream | 2.87 | Fails |
| Gold `#C69C3E` | Navy deep `#14304F` | 5.25 | Passes AA |
| Cream text `#E8DDC4` | Navy deep | 9.95 | Passes AAA |
| Body `#0F1B2D` | Cream | 16.17 | Passes AAA |
| Navy `#1B3A5F` | White | 11.56 | Passes AAA |

Muted gold is not decorative. `variantStyles()` assigns it as `eyebrow` for both the `cream` and `white` variants, and eyebrows render as small uppercase labels, which is normal text under WCAG, not large text. **Every eyebrow on every light section of the site currently fails AA.** This is a real defect, present in the palette shipped in Phase 11.

### 8.2 Proposed token changes, all verified

| Token | Current | Proposed | Rationale |
|---|---|---|---|
| `--pmbc-accent-muted` | `#A88530` (3.46) | **`#8A6D26`** (4.89 white, 4.57 cream) | Fixes the AA failure on eyebrow text. Visually still gold |
| `--pmbc-secondary` | `#3FA663`, unused | **Keep as the brand green**, non-text only | Preserves the logo green for fills, dots, rules |
| `--pmbc-secondary-text` | absent | **`#2E7D4F`** (5.05 white, 4.72 cream) | New. The green that is legal as text or as an icon on light |
| `--pmbc-accent` | `#C69C3E` | Unchanged, **restricted to non-text on light** | 5.25 on navy, so gold text stays legal on dark sections only |

Rule of thumb to encode in the tokens file: **on light backgrounds, gold draws lines and green draws marks, but navy does the talking.** That satisfies "gold minimal", introduces the green as a genuine accent, and makes navy the primary ink on light surfaces, which is how the brief reads.

### 8.3 Reducing dark tone

Five of thirteen section types currently default to `navy_deep`: `hero`, `process_steps`, `cta_block`, `fmp_intro`, plus `SectionRenderer`'s rhythm nudge, which can promote more. On a long page this produces repeated full-bleed dark bands.

Proposal: reduce the navy defaults to **two** (`hero` and `cta_block`, which are the two that earn it, one opening and one closing). Move `process_steps` and `fmp_intro` to `cream`, and give them navy numerals with a gold hairline connector so they keep their structure and gravity without the full dark background. Adjust the rhythm resolver so it alternates `white` and `cream` by default and only escalates to `navy_deep` when the author sets it explicitly.

This is a `DEFAULT_VARIANT` map change plus two renderer adjustments. No schema change, no content change, and any page that has an explicit `styles.background_variant` is unaffected.

### 8.4 Accessibility and responsiveness checklist

Applies to all 14 public routes and all 20 admin destinations.

**Colour and contrast**
- [ ] Normal text meets 4.5:1. Large text (18.66px bold or 24px regular) meets 3:1
- [ ] UI component and graphical boundaries meet 3:1
- [ ] No information conveyed by colour alone. Status badges carry a text label, not just a hue
- [ ] Verified in both the `cream` and `white` variants, not only on white
- [ ] Gold is never used for text on a light background
- [ ] Focus ring meets 3:1 against both the component and the page background

**Semantics and keyboard**
- [ ] One `h1` per page. Heading levels do not skip
- [ ] Every interactive element is reachable and operable by keyboard, in a sensible order
- [ ] Visible focus indicator on every focusable element. Never `outline: none` without a replacement
- [ ] The page builder's drag-and-drop reorder has a keyboard alternative
- [ ] Modals trap focus, close on Escape, and restore focus to the trigger
- [ ] Skip-to-content link as the first focusable element
- [ ] Landmarks present: `header`, `nav`, `main`, `footer`
- [ ] Form inputs have associated `label` elements. Errors are announced, not only coloured

**Content**
- [ ] Every meaningful image has a real `alt`. Decorative images use `alt=""`
- [ ] Link text is meaningful out of context. No bare "read more"
- [ ] External links carry `rel="noopener noreferrer"` and are announced as opening a new tab
- [ ] `lang="en"` on `html`
- [ ] Sanitized rich text still produces valid nesting after the allowlist pass

**Responsiveness**
- [ ] Renders correctly at 320, 375, 768, 1024, 1280, 1536, and 1920 px
- [ ] No horizontal scroll at any width
- [ ] Reflows at 320px width without loss of content or function
- [ ] Usable at 200% browser zoom, and at 400% per WCAG 1.4.10
- [ ] Touch targets at least 44 by 44 px
- [ ] Hero type scales fluidly and does not overflow at 320px
- [ ] The 13 section renderers each verified at mobile, tablet, and desktop
- [ ] Admin sidebar off-canvas drawer works below 768px, with body-scroll lock
- [ ] Tables scroll inside their own container rather than forcing page scroll
- [ ] `prefers-reduced-motion` respected by scroll chevron and any transition

**Verification**
- [ ] axe DevTools clean on all 14 public routes
- [ ] Lighthouse accessibility at least 95 on every public route
- [ ] Keyboard-only pass on the full contact-form flow
- [ ] Screen-reader pass (NVDA on Windows) on home, one service detail, one insight, and contact

---

## 9. Roles and governance

### 9.1 An honest note on scale

`CLAUDE.md` records this as a self-built project with one admin user, and the brief asks for a full team structure. Both can be true: the structure below defines **hats, not headcount**. On a solo build one person wears all of them, and the value is that each decision still has a named owner and a written standard rather than being made implicitly. Where a hat cannot be genuinely independent with one person (notably QA sign-off on one's own work), that is called out rather than papered over.

### 9.2 Roles

| Role | Owns | Decides | Consulted on |
|---|---|---|---|
| **Product Owner** (Ahmad Din) | Scope, priority, launch go/no-go, brand positioning | Whether a milestone ships. Trade-offs between scope and date | Everything |
| **Tech Lead** | Architecture, migration sequencing, code review, rollback calls | Schema design, port versus discard, when to revert | Timeline, risk |
| **Data Owner** | Supabase schema, migration discipline, RLS posture, backups | Whether a migration may be applied to production | Any schema-touching PR |
| **Frontend Developer** | Section renderers, public routes, responsiveness | Component structure | Design, accessibility |
| **CMS / Admin Developer** | Admin console, API routes, editors | Editor UX within the design system | Content workflow |
| **QA / Verification** | Test plan, quality gates, the verification script | Whether exit criteria are met | Acceptance criteria |
| **Accessibility Reviewer** | The section 8.4 checklist, axe and Lighthouse runs | Whether a route is accessible enough to ship | Palette, typography |
| **Design Owner** | Palette, typography, layout tokens, brand consistency | Token values, section rhythm | Renderer changes |
| **Content Lead / Editor** | Copy, service write-ups, insights, case studies, testimonials | Editorial voice, publish timing | Field structure |
| **Security Reviewer** | Auth posture, sanitization, secret handling, RLS audit | Whether a change is safe to expose publicly | API routes, env vars |
| **Release Manager** | Deploys, env vars, DNS, rollback execution | When to promote to production | Timeline |

### 9.3 RACI for the phases

`R` responsible, `A` accountable, `C` consulted, `I` informed.

| Activity | PO | Tech Lead | Data | FE | CMS | QA | A11y | Design | Content | Sec | Rel |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Approve plan | **A** | R | C | I | I | C | C | C | C | C | I |
| Phase A, decommission | I | **A/R** | C | I | I | C | I | I | I | C | I |
| Phase B, sanitization | I | A | I | R | R | C | I | I | I | **R** | I |
| Phase C, schema | I | A | **R** | I | C | C | I | I | I | C | I |
| Phase D, editor | I | A | C | I | **R** | C | C | C | C | I | I |
| Phase E, public | I | A | I | **R** | C | C | C | C | C | I | I |
| Phase F, branding | C | C | I | R | R | C | **R** | **A** | C | I | I |
| Production deploy | **A** | C | C | I | I | R | I | I | I | C | **R** |

### 9.4 Standing governance rules

These outlive the migration.

1. **Migrations are immutable once applied.** A mistake is corrected by a new numbered migration, never by editing history. Already the practice here, per `CLAUDE.md`.
2. **Every migration ships with a rollback file** and a note on whether it is additive (safe) or data-writing (needs a PITR snapshot).
3. **Fail closed, always.** A missing secret means denied, never skipped. This is adopted directly from the lesson documented in the nested tree's `adminAuth.ts`, where an unset webhook secret in the parent codebase caused an endpoint to accept anonymous requests for months because the check was written as `if (secret) { ... }`. Enforced by a CI grep, see section 10.
4. **RLS default deny on every new table.** No permissive policy without a written justification in the migration's header comment.
5. **All admin mutations are audit-logged.** No exceptions, and no direct table writes that bypass `/api/admin/*`.
6. **No unsanitized HTML reaches a browser.** Enforced by CI.
7. **The content style rules in `CLAUDE.md` are enforced mechanically,** not by memory. No em dash, no en dash in prose, in any string a human can see.
8. **Token values live in exactly two files** (`globals.css` and `tokens.ts`) and are changed together. A CI check asserts they agree.
9. **Content editors never touch the schema.** New content shapes go through the Data Owner.
10. **Quarterly review:** RLS posture, Supabase Security Advisor, dependency audit, and an accessibility spot check.

### 9.5 Prerequisite for multi-editor governance

The roles above assume more than one person can log in. Today there is one shared admin credential (`Admin@2026`, a documented debug password). Before a second editor exists, three things must land: **M2** (sanitization, because a second author is a second source of HTML), **per-user accounts** in `admin_users` rather than a shared login, and the **credential rotation** already listed as a launch blocker. Until then, the governance model is aspirational rather than enforced, and it should be described that way.

---

## 10. Quality gates

### 10.1 CI checks, all blocking

| Gate | Command | Fails when |
|---|---|---|
| Typecheck | `npm run typecheck` | Any TS error. Catches stale `database.ts` after a migration |
| Build | `npm run build` | Build breaks, including non-route exports in route files, a real past failure here |
| Lint | `npm run lint` | Lint errors |
| **Em dash guard** | grep for U+2014 and U+2013 in `src/`, `supabase/migrations/`, `*.md` | Any occurrence outside an allowlisted numeric range. Enforces rule 7 |
| **Sanitizer guard** | grep for `dangerouslySetInnerHTML` | Any occurrence not routed through `sanitizeCmsHtml` or `JSON.stringify` |
| **Fail-closed guard** | grep for `if (process.env.` used as an authorization condition | A secret is checked in a way that skips validation when unset. Enforces rule 3 |
| **Migration immutability** | `git diff` against `main` on `supabase/migrations/` | Any modification to an already-applied migration file |
| **Token sync** | compare `globals.css` and `tokens.ts` | The two disagree on any token |
| **Contrast** | contrast script over the token pairs | Any text pair below 4.5:1, or any UI pair below 3:1 |
| Route smoke | `scripts/verify-migration.mjs` | Any public route not 200, any admin route not 307 unauthenticated |
| RLS audit | part of the same script | Any table without RLS, or with an unjustified permissive policy |

### 10.2 Test coverage to add

There is no test runner in the project today. The migration is the right moment to add one, scoped narrowly rather than aiming for broad coverage.

| Area | Type | Why it earns a test |
|---|---|---|
| `resolveSchedule` | Unit | Pure, injectable clock, and the boundary conditions (past date, absent date, unparseable date) are exactly where scheduling bugs hide |
| `normalizeExternalUrl` | Unit | Security relevant. Must reject `javascript:`, `data:`, `vbscript:`, `file:` |
| `sanitizeCmsHtml` | Unit | Security relevant. Assert that a script tag, an `onerror` attribute, and a `javascript:` href are all stripped |
| `slugify` | Unit | Collisions and unicode |
| Category backfill | Integration, against a Supabase branch | Idempotency: running twice must produce the same rows |
| Article CRUD round trip | Integration | Create, publish, schedule, and confirm an `audit_log` row is written |
| Public route rendering | Smoke | 14 routes, 200 and no unsanitized markup |

### 10.3 Acceptance criteria for the consolidation

Binary. Every one must be demonstrable, not asserted.

1. `PMBC from FMP/` no longer exists in the working tree, and its contents are recoverable from the archive tag.
2. Exactly one `package.json`, one lockfile, and one `node_modules` at the repo root.
3. `npm run typecheck` and `npm run build` pass from a clean checkout.
4. All 14 public routes return 200. All 20 admin destinations return 307 to login when unauthenticated, and 200 when authenticated.
5. No `dangerouslySetInnerHTML` renders unsanitized content. Verified by the CI guard and by manual injection of a `<script>` tag through the admin editor.
6. An article can be assigned multiple categories, placed in a series, given a byline, and scheduled. Each is visible on the public site.
7. A scheduled article is invisible before its time and visible after, with no cron running.
8. The article count before the migration equals the count after, and every legacy `category` value has a matching `categories` row.
9. RLS is enabled with zero permissive policies on every table, including the four new ones.
10. Zero WCAG AA text-contrast failures across all 14 public routes.
11. Zero em dashes and zero en dashes in rendered HTML.
12. Every admin mutation during acceptance testing produced an `audit_log` row.
13. A rollback rehearsal has been performed on a Supabase branch for migrations 029 to 032.

---

## 11. Risk register

Probability and impact are High, Medium, Low. Score is the combination, used only for ordering.

| ID | Risk | P | I | Score | Mitigation | Owner | Trigger to escalate |
|---|---|---|---|---|---|---|---|
| R1 | Nested `001_cms_schema.sql` is run against the live PMBC database. `CREATE TABLE IF NOT EXISTS` no-ops silently, the operator believes it applied, and later debugging chases a phantom | L | **H** | **High** | Delete the tree in Phase A. Never execute that file. Document the trap here so it survives the deletion | Data Owner | Any unexplained schema mismatch |
| R2 | Deleting the untracked tree loses something not yet identified as needed | M | **H** | **High** | Snapshot outside the repo, plus an orphan-branch archive tag, both before deletion. Manifest with checksums | Tech Lead | Any missing import after A |
| R3 | Sanitizer allowlist is too strict and silently strips formatting from existing published content | **M** | M | **Medium** | Diff rendered output on all 14 routes before and after, in staging. Start permissive within safety, tighten with evidence | Frontend Dev | Any visual regression in staging |
| R4 | Sanitizer allowlist is too loose and lets an attribute through | L | **H** | **Medium** | Unit tests asserting script tags, `onerror`, and `javascript:` hrefs are stripped. Security review at M2 | Security Reviewer | Any test failure |
| R5 | TipTap 2 to 3 incompatibility makes the ported editor components more work than estimated | **M** | M | **Medium** | Do not copy the source editor. Rebuild on the existing TipTap 3 `RichTextEditor`. Port only the field wrappers, which are version-independent | CMS Dev | Effort exceeds estimate by 50% |
| R6 | Category backfill produces duplicates or orphans | L | M | Low | Idempotent upserts, composite primary key, dry-run default, PITR snapshot first. Legacy column never modified | Data Owner | Row-count mismatch |
| R7 | Palette retune degrades the intended premium look while chasing contrast | **M** | M | **Medium** | Change only the tokens listed in 8.2. Keep `#C69C3E` for non-text gold, which is where the premium signal actually lives. Design Owner signs off before merge | Design Owner | Product Owner objects on review |
| R8 | Scheduled publishing appears to work in dev but not production because read-time filtering was applied to some fetchers and not others | **M** | M | **Medium** | Single shared fetcher helper. Acceptance criterion 7 tests the boundary explicitly | Frontend Dev | Any article visible before its time |
| R9 | Regenerating `database.ts` after migrations introduces a wave of type errors that stalls the phase | **M** | L | Low | Regenerate immediately after each migration, not once at the end. Typecheck is a blocking gate | Tech Lead | More than a day spent on type churn |
| R10 | Solo-build reality means QA and Accessibility sign-offs are self-review, so defects pass | **H** | M | **High** | Make the gates mechanical. axe, Lighthouse, the contrast script, and the verification script do not care who wrote the code. Reserve human review for judgment calls | QA | A defect reaches production |
| R11 | Launch blockers in S7 (env vars, DNS, credential rotation, counsel review) slip and gate the whole release | **M** | **H** | **High** | These are independent of this plan. Start them in parallel at M0. Most need the Product Owner, not developer time | Product Owner | Any blocker still open at M5 |
| R12 | The genuine unread inquiry from 2026-06-21 goes unanswered further | **H** | M | **High** | Not a migration risk, an operational one. Answer today. Add an inbox check to the weekly routine | Product Owner | Already triggered |
| R13 | Scope creep: the article editor becomes a general CMS rebuild | **M** | M | **Medium** | Section 3 is a closed list of nine items. Anything else is a separate phase, decided by the Product Owner | Product Owner | Any work item not traceable to P1 to P9 |
| R14 | Vercel build fails from the second lockfile before Phase A completes | L | M | Low | Phase A is first for this reason. Until it lands, do not deploy | Release Manager | Any build-time workspace-root warning |

---

## 12. Sprint 1, a concrete two-week plan

**Dates:** Monday 2026-08-03 to Friday 2026-08-14.
**Theme:** Remove the duplicate and close the security gap. Nothing user-visible changes.

**Why this scope.** Phase A unblocks everything and is the only irreversible step, so it goes first while attention is highest. Phase B is the highest-severity finding and is a hard prerequisite for the multi-editor governance model. Both are self-contained, both are fully revertible after A's archive exists, and neither depends on schema work. Deliberately excluded: any schema change, any editor work, any visible redesign.

### Sprint goal

The repository contains exactly one application, and no CMS-authored HTML reaches a browser unsanitized.

### Week 1, decommission

| Day | Work | Deliverable |
|---|---|---|
| Mon | Approve plan. Confirm archive strategy. Start launch blockers in parallel (R11). **Answer the 2026-06-21 inquiry (R12)** | M0 sign-off. Inquiry answered |
| Tue | Write and run `extract-fmp-ports.mjs`. Review the not-copied list line by line | Staging directory plus checksum manifest |
| Wed | Snapshot outside the repo. Create the `fmp-cms-archive-2026-08-01` tag on an orphan branch. Verify the archive is restorable | Archive verified restorable |
| Thu | Delete `PMBC from FMP/`. Add the `.gitignore` guard. Clean install at root | Tree deleted. Build and typecheck green |
| Fri | Verify: no import resolves into the deleted path, one lockfile, one `node_modules`. Deploy to preview | **M1 complete** |

### Week 2, security baseline

| Day | Work | Deliverable |
|---|---|---|
| Mon | Install `sanitize-html`. Write `lib/cms/sanitize.ts` with the allowlist. Write its unit tests first | Sanitizer plus passing tests |
| Tue | Apply at all 8 public render sites and both admin preview sites | 10 call sites converted |
| Wed | Port `externalUrl.ts` (P7) with unit tests. Apply to every operator-supplied href | Normalizer live |
| Thu | Add the three CI guards: sanitizer, em dash, fail-closed. Wire the contrast script | CI gates active and blocking |
| Fri | Render-diff all 14 public routes, before against after. Injection test through the admin editor. Security review | **M2 complete** |

### Sprint deliverables

1. `PMBC from FMP/` deleted, archived, and restorable.
2. Extraction script plus manifest, committed.
3. `src/lib/cms/sanitize.ts` with unit tests, applied at 10 sites.
4. `src/lib/utils/externalUrl.ts` with unit tests.
5. A test runner configured, with the first four unit-test files.
6. Four CI gates active and blocking: sanitizer, em dash, fail-closed, contrast.
7. A render diff report showing no unintended formatting loss.
8. This document updated with what was actually done.

### Success criteria

Every one is demonstrable.

- [ ] Exactly one `package.json`, one lockfile, one `node_modules` at the repo root
- [ ] `npm run typecheck` and `npm run build` pass from a clean checkout
- [ ] The archive tag restores the deleted tree byte for byte
- [ ] A `<script>alert(1)</script>` saved through the admin editor renders as inert text, not as script
- [ ] `javascript:alert(1)` in any URL field renders no href
- [ ] All 14 public routes return 200, visually unchanged apart from intended sanitization
- [ ] All four CI gates fail a deliberately bad commit, then pass on the real one
- [ ] Unit tests pass for sanitize, externalUrl, slugify, resolveSchedule
- [ ] Zero new em dashes or en dashes introduced
- [ ] The 2026-06-21 inquiry has been answered

### Explicitly out of scope for Sprint 1

Schema changes (Phase C), the article editor (Phase D), public rendering (Phase E), the palette retune (Phase F), and the launch blockers in S7, which run in parallel and are owned by the Product Owner rather than by this sprint.

### Definition of done

Merged to `main`, deployed to preview, all gates green, acceptance criteria 1 through 5 demonstrated, and this document updated to record what actually shipped.

---

## Appendix A. Files staged for extraction before deletion

Copy only these. Everything else in `PMBC from FMP/` is discarded per section 3.

```
src/shared/utils/externalUrl.ts                    -> src/lib/utils/externalUrl.ts
src/shared/cms/scheduling.ts                       -> src/lib/cms/scheduling.ts  (strip cron references)
src/components/admin/CategoryMultiSelect.tsx       -> rewire to article_categories
src/components/admin/ArticleSeriesField.tsx        -> rewire to article_series
src/components/admin/InstructorPicker.tsx          -> rename to AuthorPicker, point at authors
src/components/admin/ArticleWriterField.tsx        -> byline snapshot
src/components/admin/ArticleAuthorAboutFields.tsx  -> byline snapshot
src/components/admin/ArticleScheduleField.tsx      -> re-document the guarantee
src/components/admin/ArticleExtraFields.tsx        -> mid image, tags, og image
src/components/admin/LocalDateTime.tsx             -> as is
app/api/admin/articles/slug-check/route.ts         -> src/app/api/admin/articles/slug-check/route.ts
supabase/migrations/001_cms_schema.sql             -> REFERENCE ONLY. Never execute. See R1
```

## Appendix B. Open questions for the Product Owner

1. Should `/insights` category and series pages appear in the public top navigation, or remain reachable only from article pages? They can be added through Pages & Nav either way.
2. Is a second editor account expected within the next quarter? The answer changes the priority of per-user accounts in section 9.5.
3. Should the legacy free-text `articles.category` column be dropped after the backfill is verified, or retained indefinitely as a fallback? The plan retains it.
4. Does the palette retune in 8.2 need a visual review before merge, or is passing the contrast gate sufficient authority to proceed?
