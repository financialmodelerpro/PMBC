# PMBC Session Log

Chronological build history for the PMBC website. Split out of `CLAUDE.md` to keep that file lean: `CLAUDE.md` is loaded into context every session, whereas this log is reference material to read on demand. For the quick phase-progress summary, see the **Current Status** table in `CLAUDE.md`.

---

### 2026-08-01 - FMP Admin Parity, Phase 7: AuditLogViewer

Closes the last PARTIAL row in the gap report for the audit page. PMBC had a flat inlined table with a hard 200-row limit, no filters, no pagination and no diff.

**ACTION REQUIRED: migration 032 must be run by hand,** like 031. It is DDL (`ALTER TABLE audit_log ADD COLUMN`), and supabase-js cannot execute DDL, the CLI is not installed, and there is no direct Postgres connection string in `.env.local`. Run `supabase/migrations/032_audit_log_diff_columns.sql` in the Supabase SQL editor.

**Built**
- `supabase/migrations/032_audit_log_diff_columns.sql`. Adds `before_value` and `after_value` as JSONB and `reason` as text, all nullable. JSONB rather than text so a future query can filter on a field inside a diff. Also adds two composite indexes, `(action, created_at DESC)` and `(admin_id, created_at DESC)`, so the filtered views do not degrade to a sequential scan as the table grows. Additive and idempotent, with rollback in the footer.
- `lib/audit.ts` extended: `AuditEntry` gains `beforeValue`, `afterValue` and `reason`. Two new helpers, `snapshotRow` (reads a row for use as a before-value, returns null on any failure so it can be inlined without a try/catch) and `forDiff` (strips `updated_at`, which changes on every write and would otherwise make every diff show a difference and train the reader to ignore them).
- `GET /api/admin/audit-log` with `limit` (default 100, clamped to 500), `offset`, `admin_id`, repeatable `action`, `from_date` and `to_date`. Returns `{ entries, total, limit, offset, diffColumnsAvailable }`, joining `admin_users` so the viewer shows a name rather than a UUID. `POST` on the same route returns filter options (admins, distinct actions) and mutates nothing.
- `components/admin/AuditLogViewer.tsx`. Filters row, 100-row pages with Previous and Next, "Showing X to Y of Z", and a side-by-side before/after JSON dialog per row. Rows with no diff recorded show "none" rather than an empty object, since those are different facts.
- `/admin/audit` reduced to a shell that renders the viewer.

**Write paths now capturing diffs.** `collectionApi.ts` was the highest-leverage target: one factory serves Services, Case Studies, Team, Insights, Testimonials and Pages & Nav, so wiring create, update and delete there covers six admin sections at once. Update and delete snapshot the row first, because after the mutation the old values are gone. Also wired: branding, site settings (where the existing blob was already read to build the merge, so the before-value is free), page section delete (the case where the diff matters most, since the audit row becomes the only remaining copy), and page create and delete.

**Two deliberate design choices**
1. **The audit API is read-only.** There is no PATCH or DELETE. An audit log the admin console can edit is not an audit log. Rows are written only by `lib/audit.ts`, server side, as a side effect of a real mutation.
2. **Audit failures never block a mutation.** `writeAudit` swallows errors and, if the insert is rejected because the diff columns do not exist, retries without them. An audit row records work that already happened, so failing the request because the record could not be written would turn a logging problem into a data problem.

**Verified, all with migration 032 still unapplied, which also proves the degradation paths**
- Typecheck and build clean (35 routes, up from 34 with the new endpoint).
- API returns 87 entries with `diffColumnsAvailable: false` via the legacy column fallback, rather than erroring.
- Filters: unfiltered 87, `action=update` 36, `action=create` 7, multi-select create plus delete 13 (7 + 6, so the `in` clause is correct), real admin id 87, nonexistent admin 0, today 41, far-past range 0.
- Pagination at limit 10: offsets 0, 10 and 80 return 10, 10 and 7 rows with correctly descending timestamps and a stable total of 87.
- `limit=99999` clamps to 500. Unauthenticated GET and POST both 401.
- `/admin/audit` renders 200, and the viewer strings (empty state, "Showing", "All admins", "Clear filters", the migration banner, pagination) are all present in the client bundle.
- **The write fallback works:** a settings PATCH returned 200 and still produced an audit row (88 total), proving a pre-032 database keeps auditing rather than failing the mutation.

**Migration 032 applied by the user the same day. The three outstanding items are closed, and the verification found a separate pre-existing bug.**

**Diff semantics confirmed against a real create, update and delete cycle** on a throwaway testimonial:

| Operation | before_value | after_value |
|---|---|---|
| create | null | the new row |
| update | the old row | the new row |
| delete | the last state | null |

The update correctly chains from the create (its before-value equals the create's after-value), `updated_at` is stripped from every diff by `forDiff`, and `reason` is null as designed since no caller supplies one yet.

API now reports `diffColumnsAvailable: true` across 92 rows, the `admin_users` join renders `{"name":"Ahmad Din","email":"..."}` rather than a UUID, action filters pick up the new rows (create 8, update 38, delete 7), and the migration banner is gone from `/admin/audit`. Historical rows correctly keep null in all three columns and render as "none" rather than an empty object.

**Pre-existing bug found and fixed: the Testimonials admin section could never create or update a row.** `testimonials` (migration 025) is the only collection table with no `updated_at` column; its time columns are `created_at` and `approved_at`. `createCollectionApi` defaults `touchUpdatedAt = true`, so every create and update returned 400 with "Could not find the 'updated_at' column of 'testimonials' in the schema cache". This predates the parity work and dates to the Phase 10 collections build in June. Fixed with `touchUpdatedAt: false` on that one route, no migration needed. Checked the other five collection tables: `services`, `case_studies`, `team_members`, `articles` and `site_pages` all have `updated_at`, so testimonials was the only one affected.

That bug is also why Testimonials was still empty. It was not only that nobody had written any, it is that the form could not save one.

Test data cleaned up: 0 testimonials remain. The 92 audit rows are kept deliberately, since the log is append-only and deleting entries to tidy a test would defeat its purpose.

Em dashes 0, en dashes 0.

One incidental note: the dev server threw a transient Turbopack error resolving the next/font module right after a `.next` clear. It is a bundler cache fault, not code, and cleared on restart. The production build passed throughout.

---

### 2026-08-01 - Phase 6.5: sanitise the remaining 10 rich-text render sites

Closes S1, the highest-severity finding in `ADMIN_PARITY_GAP.md` and Phase B of `MIGRATION_PLAN.md`. Phase 6 built the sanitiser and used it for the 7 newly rich fields. This routes everything else through it, so no operator HTML reaches a browser unsanitised.

**Converted (10)**
- Public (8), all via `sanitizeRichHtml`: case study body, article body, team bio, `fmp_intro.description_html`, `founder_block.bio_html`, `paragraphs.html`, `service_detail.full_description_html`, `text_image.body_html`.
- Admin (2): the email signature and footer previews in `EmailBrandingForm`.

**Deliberately NOT converted:** the two JSON-LD blocks in `components/seo/`. They interpolate `JSON.stringify` of an object we build ourselves, never operator HTML, and running structured data through an HTML sanitiser would corrupt it.

**A new allowlist was needed for the email previews.** Transactional email HTML relies on table layout and inline styles for client compatibility. Applying the strict body allowlist would have stripped markup the real email keeps, so the preview would have been lying about what actually gets sent. `sanitizeEmailHtml` permits table markup and broad inline styles while still removing scripts, event handlers and unsafe URL schemes, which is what protects the admin viewing the preview. Note it sanitises the preview only: the stored value is still sent as authored, which is the right split, since the sanitiser exists to protect a browser and an email client is not this codebase's browser.

**Render diff, the gate this phase existed to pass (risk R3).** Captured all 14 public routes before and after, with every route warmed first so nothing was caught mid-compile. Result: **14 of 14 byte-identical** once script tags are excluded. The sanitiser strips nothing from existing safe content.

Two false alarms worth recording, both capture artefacts rather than content changes:
- A first attempt showed `/services/financial-modeling` differing. The capture had caught it at 560 bytes during a cold dev compile; the settled page is about 164 KB. Fixed by warming every route before capturing.
- After restoring the hostile-test data, the same route differed again by exactly `<template id="B:1"></template>`, a React streaming boundary marker. The first 10,167 characters of `<main>` are byte-identical.

**Hostile payload test.** Injected `<script>`, `<img onerror onload>`, a `javascript:` href, `<iframe>`, `<object>`, `<embed>` and an `onclick` div into all 8 public fields, inserting throwaway `case_studies`, `articles` and `team_members` rows since those tables are empty. Result across 6 affected routes: **0 hostile markers reach the DOM**, safe content preserved everywhere.

The raw strings do still appear inside `<script>` tags, in the RSC flight payload that serialises the row. That is JSON-escaped, inert, and is operator-authored public CMS content rather than anything private, but it is worth knowing that the stored value is visible in view-source even though nothing reaches the DOM. The same was true of the StyleEditor values in Phase 5.

All test data restored afterwards: throwaway rows deleted, sections and `cms_content` returned to their prior values, counts verified back at 36 sections and 17 pages with zero rows still holding the test marker.

**Em dash gate: 0.** One pre-existing em dash in a `FounderBlock` comment was caught by the gate and fixed, which is the gate doing its job on a file this phase touched. En dashes: 0. Typecheck and build clean (34/34).

---

### 2026-08-01 - FMP Admin Parity, Phase 6: RichTextEditor upgrades and new RichTextarea

**Content style rule strengthened.** The no-em-dash rule is now universal: code, comments, commit messages, migrations, docs, UI strings, and replies to the user. The previous carve-out for technical docs and code comments is revoked. Persisted to project memory. A phase is not complete if the character appears anywhere in its changes.

**Task 1: RichTextEditor upgraded.** Added text colour, font size, link (add, edit, remove), image insert via the media library, alignment (left, center, right), and H1 plus H3 alongside the existing H2. Kept paragraph, bold, italic, both lists, undo and redo.

**Task 2: RichTextarea created.** Compact bold, italic and link only. Styled to match a normal admin input (same border, radius, font size and amber tint) so a form does not change shape when a textarea is swapped for one. Normalises the empty case: Tiptap serialises an empty document as an empty paragraph, which is reported back as an empty string so downstream "is this set" checks keep working.

**Dependency notes**
- Tiptap pins exact peer versions. Installing the extensions at `^3.22.5` resolved to 3.29.2 and failed the peer graph against the 3.22.5 core that starter-kit pins. All `@tiptap/*` entries are now pinned exactly, which also stops a future clean install from silently re-breaking.
- `@tiptap/extension-text-style` 3.22.5 already exports `Color`, `FontSize` and `TextStyle`, so no custom font-size extension was needed. FMP had to hand-roll one on its older version.
- StarterKit 3.22.5 already bundles `link` and `underline`. The separately installed link package was removed, since registering it again would duplicate the extension. Link is configured through StarterKit instead, with the protocol allowlist set to http, https and mailto.

**A blocker the brief implied but did not state.** Every target field (hero subtitle, quote text, CTA subhead, stats intro, card and sector and step descriptions) rendered as a plain **text node** on the public site. Storing rich HTML in them would have displayed literal tags. Making them rich required converting those renderers to HTML output, which would have grown the unsanitised `dangerouslySetInnerHTML` surface from 8 sites to about 17, with no sanitiser installed. That is S1 in `MIGRATION_PLAN.md`, the highest-severity finding in the audit.

Resolution: pulled the sanitiser forward rather than knowingly widening the hole. `sanitize-html` installed and `src/lib/cms/sanitize.ts` added, the helper already specified in `MIGRATION_PLAN.md` Phase B. It offers `sanitizeInlineHtml` (short fields) and `sanitizeRichHtml` (long-form), with an allowlist covering safe link schemes and only the colour, font-size and text-align inline styles the editors can produce, plus a transform that forces `rel="noopener noreferrer"` on any link opening a new tab. A shared `RichText` component routes the 7 converted render sites through it.

**The 8 pre-existing unsanitised sites are deliberately NOT converted here.** Doing so needs the before-and-after render diff described in risk R3, and burying that check inside this phase would make it unreviewable. They remain Phase B work.

**Two of the nine listed editors were not wired, on purpose.** `ServiceDetailEditor` deliverables and `FmpIntroEditor` feature points are single-line `<input>` elements inside drag-reorder rows, not textareas. Fitting a toolbar above each bullet would break the row layout and add roughly 30px of chrome per item in a list. Flagged rather than forced; happy to do them if the tradeoff is acceptable.

**Wired (7):** hero subtitle, quote text, CTA subhead, stats intro, service card descriptions, sector descriptions, process step descriptions.

**Verified**
- Typecheck and build clean (34/34).
- All six new control groups present in the client bundle. The toolbar does not appear in server HTML because Tiptap runs with `immediatelyRender: false`, so the bundle is the correct place to assert.
- **Backwards compatible:** the existing plain-text hero subtitle still renders unchanged, since sanitising a tag-free string returns it verbatim.
- **Round trip with a hostile payload.** Saved bold, italic, a target-blank link, a coloured span, `<script>alert(1)</script>` and `<img src=x onerror=alert(2)>`. Rendered output kept the bold, italic, link and colour, **stripped both the script and the img**, auto-added `rel="noopener noreferrer"`, and flattened the wrapping paragraph so a `<p>` is never nested inside the renderer's own `<p>`.
- Baseline restored afterwards. All 13 public routes and all 8 page-builder routes 200.
- **Em dash gate: 0 across all 20 changed files.**

---

### 2026-08-01 - FMP Admin Parity, Phase 5: StyleEditor

Per-section presentation control (`CMS_REFERENCE.md` section 2.3a), the largest item in the gap report at **L effort**, because it needed both an admin editor and every public renderer taught to honour it.

**How it composes with the Phase 9.5 variant system.** The variant still decides each section's default background, text and eyebrow colours, and the sequence-aware rhythm in `SectionRenderer` is untouched. The StyleEditor sits **on top**: the variant is applied first and overrides second, per CSS property. Any field left blank falls through, so a section with `styles = {}` renders byte-identically to before. `background_variant` and the legacy `background_style` are deliberately not editable in this panel and every write preserves unknown keys.

**Built**
- `src/lib/public/sectionStyles.ts`. Parser and style builders, shared by the container and Hero so the two cannot drift. Every field is validated on the way out rather than trusted: hex regex for colours, numeric ranges (padding 0 to 200, radius 0 to 24, max width 320 to 2400, overlay 0 to 100), an animation enum, a conservative `[A-Za-z0-9_ -]` class rule, and image URLs restricted to `http(s)` or root-relative with quote/paren/backslash characters refused so nothing can break out of `url("...")`.
- `src/components/admin/StyleEditor.tsx`. Collapsed by default, since these are overrides and the common case should need no intervention. Grouped Background / Text / Spacing / Layout / Advanced, a "customised" badge when anything is set, per-field range validation, and a Reset that clears only the presentation keys and leaves `background_variant` alone.
- `SectionContainer` takes an optional `styles` prop and applies outer style, inner max-width and extra classes.
- `styles` threaded into the 12 renderers that use `SectionContainer`. **Hero is the exception**: it owns an 88vh layout and a radial gradient rather than using the container, so it applies the overrides itself through the same helpers.
- Animation keyframes in `globals.css`. They run once on load rather than on scroll, because the public site is server-rendered with no client observer and a scroll-triggered version would mean shipping JS to every page for a decorative effect. Fully disabled under `prefers-reduced-motion`, and the reduced-motion rule resets opacity and transform so the section stays visible rather than being stuck at its start frame.
- Wired through `updateSection`, so a style change marks that section dirty and is committed by its own Save (Phase 3 model). No new save path.

**Verified**
- Typecheck and build clean (34/34).
- StyleEditor renders on all 8 CMS pages, and is available for every section type including ones whose content editor is a placeholder, because styles live on the row rather than in the type-specific content shape.
- **Every field applied**, confirmed in rendered HTML on the home quote section: `background:#FF0000`, `color:#00FF00`, `padding-top:137px` / `right:19px` / `bottom:41px` / `left:23px`, `border-radius:12px`, class list gained `pmbc-anim-fade-in pmbc-style-probe`, and the inner wrapper got `max-width:640px` over the 1200px default.
- Background image with a 60% overlay produced `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.6)), url("...")` plus cover / center / no-repeat and the fallback colour beneath.
- **Hostile input test.** Sent `padding_top: 9999`, `bg_color: 'red; background:url(javascript:alert(1))'`, `css_class: 'evil" onload="alert(1)'`, `bg_image_url: 'javascript:alert(1)'`, `border_radius: -5`, `animation: 'explode'`, `max_width: 10`. The rendered section came back as `style="background:#FAF7F2;color:#0F1B2D"`, variant defaults only: every value rejected. The strings do appear in the RSC flight payload as JSON-escaped data (the serialized row), where they are inert and cannot break out of the script context, and they are operator-authored public CMS content rather than anything private.
- Restoring `styles` to `{}` returned the section to `background:#FFFFFF`, confirming the empty case still falls through to the variant.
- Variant rhythm on home still spans navy `#14304F` / `#1B3A5F`, cream `#FAF7F2` and white `#FFFFFF`. All 13 public routes 200.

Also fixed a cosmetic double space in the section class list that the first pass introduced.

---

### 2026-08-01 - FMP Admin Parity, Phase 4: create and delete pages with templates

PMBC had no way to create or delete a CMS page from the admin: pages existed only via SQL migrations. FMP's Page Builder list has a New Page modal with template seeds and a per-row delete guarded by `is_system` (`CMS_REFERENCE.md` section 2.2).

**ACTION REQUIRED: migration 031 must be run by hand.** It is the first migration in this run that needs DDL (`ALTER TABLE cms_pages ADD COLUMN is_system`). supabase-js cannot execute DDL, the Supabase CLI is not installed, and no direct Postgres connection string exists in `.env.local`, so it could not be applied from here. Run `supabase/migrations/031_cms_pages_is_system.sql` in the Supabase SQL editor.

**Two findings that changed the design**

1. **`cms_pages` had no `is_system` column at all.** PMBC's migration 002 never defined one; the brief assumed it existed. Migration 031 adds it.

2. **All 17 pages are system pages, not the 8 in the brief.** The 8 firm pages obviously back bespoke routes. The 9 `service-*` rows look like inert metadata, but `src/app/(public)/services/[slug]/page.tsx` calls `fetchPage('service-' + slug)` inside `generateMetadata` and passes it to `buildPageMetadata`, so each one supplies the meta title, description and OG image for a live public service page. Deleting one would not break the page (it falls back to config defaults) but would silently downgrade its SEO. Marking only 8 would have left a delete button that quietly degrades live pages, so all 17 are locked. New pages default to `is_system = false` and are freely deletable, which is the point of the feature.

**Built**
- `supabase/migrations/031_cms_pages_is_system.sql`. Additive, idempotent, `UPDATE` scoped by `created_at` so a re-run cannot re-lock a page created later and deliberately left unlocked.
- `src/lib/cms/pageTemplates.ts`. Five templates (blank / landing / about / services / contact). Sections compose `defaultContentFor`, the same source the Add-section picker uses, so a templated section and a hand-added one start identical. `display_order` in 10s. The contact template overrides the generic `text_image` default so the block reads as contact details on first render. Also exports `SLUG_RX` and `slugFromTitle`, shared by the form and the API so the two cannot disagree on what a valid slug is.
- `POST /api/admin/page-sections` gains `action: 'create_page'`, and a new `DELETE` handler takes `action: 'delete_page'`. FMP puts both on the same endpoint behind an action discriminator rather than sub-routes (sections 2.2 and 5.3), so PMBC matches.
- `src/app/admin/page-builder/PageListClient.tsx`. New Page button (green, Phase 2 `SaveButton`), modal with title, live-derived slug, and five radio-style template cards. Per-row trash for deletable pages, lock icon for system pages. Delete goes through the shared `ConfirmDialog` and names the section count.
- `is_system` hand-added to `src/types/database.ts` (Row / Insert / Update).

**Correctness details worth recording**
- Slug auto-fills from the title until the admin edits it, then stops overwriting.
- Uniqueness is pre-checked for a friendly error, but the UNIQUE index is still the real guard: two simultaneous creates would race past the check, so the insert also maps Postgres `23505` to a 409.
- If seeding template sections fails, the just-created `cms_pages` row is deleted again. A page with a half-applied template is worse than no page, because the admin cannot tell which sections are missing.
- Delete removes `page_sections` first. `page_sections.page_slug` is a slug reference, not a real foreign key, so nothing cascades on its own and the sections would otherwise be orphaned.
- The system-page check is enforced **server-side** (403), not only by hiding the button. The UI is not the security boundary.
- **Everything fails closed while 031 is pending:** the list retries its query without `is_system` and treats every page as system, so the worst case is "nothing is deletable" rather than "everything is". The DELETE endpoint returns 409 with a message naming the migration. A warning banner on the list says the same. Create still works, because the insert omits `is_system` and relies on the column default.

**Verified**
- Typecheck and build clean (34/34).
- List renders 17 rows, 17 lock icons, 0 trash buttons, 1 green New Page button, and the migration-pending banner.
- Validation: invalid slug `Test Page!` 422 with the regex message; duplicate `home` 409; unknown template 422; empty title 422.
- Created "Test Page" with the landing template: 201, 4 sections at display_order 10/20/30/40, all visible, content populated from the type defaults, page status `draft`, and an audit row carrying `page_slug`, `template`, `section_count` and `status`.
- Builder route loaded 200 for the new page.
- Delete refused with 409 pre-migration (fails closed) and 401 unauthenticated.
- Test page removed afterwards; database back to 17 pages / 36 sections. Public routes including `/services/financial-modeling` all 200.

**Migration 031 applied by the user later the same day, and the three outstanding flows were closed out:**
- Column present, 17/17 rows flagged system, 0 unflagged. Migration-pending banner gone.
- `DELETE` on `home` returned **403** with `"Home" is a system page and cannot be deleted`, proving the guard is server-side rather than just a hidden button.
- Created a throwaway page on the `about` template: 201, `is_system: false` returned (the column default applied), 5 sections at 10/20/30/40/50 (hero, founder_block, text_image, quote, cta_block).
- List then showed **18 rows, 17 locks, 1 trash**, and the single trash was labelled `Delete Phase 4 Smoke Test`. The trash-versus-lock split is driven by real data, not a guess.
- Deleted it: 200 with `deleted_sections: 5`. The `cms_pages` row is gone, **zero orphaned `page_sections`** (the manual cascade works, which matters because `page_slug` is not a foreign key), and totals returned to the pre-test baseline of 17 pages / 36 sections exactly.
- Audit trail carries both halves: `create` with `template` and `section_count`, `delete` with `section_count`.
- List refreshed to 17 rows / 17 locks / 0 trash. The deleted page now 404s in the builder. All public routes including `/services/financial-modeling` still 200.

Phase 4 is fully verified. Nothing outstanding.

---

### 2026-08-01 - FMP Admin Parity, Phase 3: Page Builder per-section save

The Page Builder had one global Save that POSTed every section at once, and a visibility toggle that persisted immediately. FMP gives each section its own Save and keeps visibility pending until that section is saved (`CMS_REFERENCE.md` section 2.3).

**Checked first, because it would have been destructive:** `POST /api/admin/page-sections` updates by id and never deletes rows missing from the payload, so sending a single-section body is safe. Had it been a replace-style endpoint, per-section save would have silently deleted the other eight sections on every click. Confirmed by test, not by reading alone (see below).

**Persistence model now, matching FMP**

| Operation | When it persists |
|---|---|
| Reorder (drag) | Immediately on drop. Unchanged |
| Add section | Immediately, server-side, so the row has a stable id to edit against. Unchanged |
| Delete section | Immediately, behind the confirm dialog. Unchanged |
| Content edit | Pending until that section's Save |
| Visibility toggle | Pending until that section's Save. **Changed**, was immediate |

**Built**
- `PageBuilder.tsx` rewritten around per-section state: `dirtyIds: Set<string>`, `saveStates: Record<id, SaveState>`, `saveErrs`. A page-level dirty flag would have let one section's Save flush another's half-finished edit, which is the whole reason FMP works this way.
- `saveSection(id)` POSTs exactly one section.
- Structural operations (reorder, add, delete) report through a separate `structuralState` in the top bar, because they are not tied to whichever section is open.
- Global Save button **removed** from the top bar. The top bar now shows only the unsaved count, structural status, and Open preview.
- Left rail: amber dot (`#D97706`) plus a visually-hidden "Unsaved changes" label on any section with pending edits. Amber, not the Phase 2 green, because it means "not yet committed", the opposite of a successful save.
- Top bar shows "N sections unsaved" rather than a single flag.
- `SectionEditorPanel.tsx` now owns the section's Save header: label, a "Hidden" pill when `visible` is false, `SaveStatus`, and a green `SaveButton` reading "Save section", disabled and grey until that section is dirty. The editor-registry switch moved into an inner `SectionEditorBody` so the panel keeps one job per component.
- `beforeunload` now fires on `dirtyIds.size > 0` rather than a single page flag.
- Delete clears that id's dirty and save state, otherwise the unload guard would warn about edits to a row that no longer exists.

**One deviation corrected mid-implementation.** The visibility toggle initially also selected the section, so its Save button would be immediately to hand. Removed: FMP requires the admin to open the row themselves, and auto-selecting would yank the centre pane away from whatever they were editing. The dot plus the top-bar count are what make the pending change discoverable.

**Verified**
- Typecheck and build clean (34/34).
- **Isolation test, the important one:** captured hero and stats content, POSTed a changed hero **alone**, then confirmed hero updated, `stats.content` byte-identical, and all 9 rows still present. A single-section save does not touch its siblings.
- Visibility through the save path: hid the quote section via POST, confirmed `visible=false` in the database and zero quote markers in the rendered public home page, then restored.
- Reorder PATCH still 200 both directions; display_order returned to 10..90.
- Rendered page builder: zero occurrences of the old global `>Save<`, exactly one "Save section" button, and it renders disabled with the grey `#D1D5DB` background on load (nothing dirty yet).
- Public routes `/`, `/about`, `/services` all 200.

**Not machine-verified.** The Chrome extension was not connected this session, so the click-through transitions (dot appears on edit, button grey to green, dot clears after save, iframe re-key) were verified by reading the state transitions rather than by driving the browser. Every handler was audited for which ones call `markDirty` / `clearDirty`: content edit and visibility mark dirty; reorder, add and delete do not; save clears. Worth a visual pass on staging.

---

### 2026-08-01 - FMP Admin Parity, Phase 2: semantic green save buttons

Decision 1 (Palette B) in effect: PMBC keeps navy and gold for identity, and adopts FMP's green for save semantics only. The muscle memory that matters when switching consoles is "the green button commits my work", not the shade of the sidebar.

**Tokens** (`lib/admin/styles.ts`), the only green in the admin palette:
- `save: '#2EAA4A'` (FMP accent green), `saveHover: '#24913E'`, `toastSuccessBg: '#1A7A30'` (FMP toast green).
- `adminButtonSave` and `adminButtonSaveDisabled` presets. Disabled is grey `#D1D5DB` on `#6B7280`, never a faded green, so "nothing to save" reads at a glance.

**`SaveButton` component (new).** Built as a component rather than a bare preset because the admin is inline-styled by design and an inline style cannot express `:hover`. Without it, all nine call sites would have repeated their own `onMouseEnter`/`onMouseLeave` pair. Carries `saving` and `disabled` separately, plus `aria-busy`, and a `style` escape hatch for the one call site that needs compact padding.

**`SaveStatus` upgraded.** "Saved" was green *text* on the page background; it is now a solid green pill (`#1A7A30`, white text, checkmark) so success reads from across the screen the way FMP's does. Error keeps `#DC2626`, which already matched. Added `role="status"` and `role="alert"`.

**Nine call sites converted:** Page Content (Save section), Email Branding, Email Templates, Header Settings (Save All), Site Settings, OG Previews, Page Builder, Contact Submissions, and the CollectionManager drawer (which powers Testimonials, Services, Team, Case Studies, Insights, and Pages and Nav).

**Four buttons deliberately NOT greened**, because they do not commit work:
- `LoginForm` "Sign in" (authentication)
- `media/page.tsx` "Upload files" and `MediaPicker` "Upload" (upload is not a save; also outside the stated scope)
- `CollectionManager` "New entry" (opens the drawer; only the drawer's own button commits)
- `ConfirmDialog` (generic confirm, frequently destructive)

One judgment call: the CollectionManager drawer button is green in **both** states, whether it reads "Create" or "Save changes". It is the single control that commits the drawer, and splitting it by colour would break the exact recognition this phase exists to build.

**Cleanup.** `adminButtonPrimary` / `adminButtonPrimaryDisabled` imports left orphaned by the conversion were removed from all eight affected files. `SettingsForm`'s local floating `Toast` already used `#1A7A30` and `#DC2626` correctly from an earlier phase; it now reads the tokens instead of hardcoding them, so the values live in one place.

**Verified**
- Typecheck and build clean (34/34).
- Green save button present on Header Settings, Page Content (13, one per section), Site Settings, Email Branding, Email Templates, OG Previews (17, one per page row).
- Drawer and detail-pane saves do not appear in SSR HTML because they render on interaction; `#2EAA4A` confirmed present in the client chunk for `/admin/testimonials`, and both call sites confirmed at source.
- Save path 200, validation error 422, so both toast states are reachable.
- **No bleed:** sidebar active border still gold `3px solid #C69C3E` with zero green, sidebar background still `#0F2540`, and `/`, `/about`, `/services`, `/contact` return zero hits for `2eaa4a` or `1a7a30`.
- `git diff --name-only` touches only `src/app/admin/**`, `src/components/admin/**`, and `src/lib/admin/styles.ts`.

**Note for Phase 3.** Page Builder's Save is currently one global button, so it is one green button for the whole page. Phase 3 converts it to per-section save, which is where FMP's green save button actually lives (`CMS_REFERENCE.md` section 7.3 cites the Page Builder per-section save as the canonical use). Expect the count on that page to go from 1 to N.

---

### 2026-08-01 - Wire header presentation fields to the public Navbar, archive and delete the FMP scaffold

Two tasks between parity Phase 1 and Phase 2. Task A closes the "stored but inert" gap Phase 1 left open. Task B executes `MIGRATION_PLAN.md` Phase A / milestone M1.

#### Task A: Navbar wiring

**Field-name reconciliation.** The request named five fields, three of which did not match what Phase 1 created. Mapped rather than duplicated, because a second row per concept is the dual-source problem migration 027 exists to prevent:

| Requested | Actual key | Resolution |
|---|---|---|
| `header_height_px` | `header_height_px` | already existed |
| `logo_height_px` | `logo_height_px` | already existed |
| `logo_max_width_px` | `logo_width_px` | mapped to the existing key |
| `logo_position` | `logo_position` | already existed |
| `header_icon_url` | `icon_url` | mapped to the existing key |
| `header_layout` | none | genuinely new, migration 030 |

Also corrected: the brief said the navbar height was "hardcoded 40". It was `h-[80px]` on the header row; 40 was the logo height (`h-10`). Both are now driven, separately.

**Built**
- `supabase/migrations/030_header_layout_key.sql` - the one new key, `header_layout` in `default` / `centered` / `spread`. Additive, idempotent, rollback in the footer. Explicitly noted as a PMBC addition, not one of FMP's 17.
- `src/lib/cms/headerSettings.ts` - `HeaderLayout` type, `parseLayout` falling back to `default` on any unrecognised value.
- `src/app/api/admin/header-settings/route.ts` - `header_layout` added as an optional enum.
- `src/app/admin/header-settings/HeaderSettingsForm.tsx` - "Nav alignment" select in the Header layout card, with a hint that it is desktop only.
- `src/components/layout/NavbarServer.tsx` - passes a `presentation` object. A local `px()` helper treats blank, non-numeric and zero as "unset", so a cleared admin field can never render a zero-height header. `icon_in_header` gates `icon_url`, matching the admin toggle.
- `src/components/layout/Navbar.tsx` - `NavbarPresentation` type plus `PRESENTATION_DEFAULTS` holding the values the navbar shipped with. Settings merge **per field with `??`**, not a plain spread, because a spread would let an explicit `null` win over the default. Drives header min-height and padding, logo height and max-width, the monogram fallback (which now scales with `logo_height_px`), an optional icon slot, brand-name and tagline toggles, brand placement via flex `order` plus auto margins, and nav distribution via `flex`/`justify-content`.

Wired 13 keys, not just the 5 requested. The neighbours (`logo_enabled`, `icon_in_header`, `icon_size_px`, `show_brand_name`, `show_tagline`, the two padding keys) share the same component, and leaving half the card inert would have reproduced the exact problem this task was raised to fix.

**Verified live, each field changed then observed in rendered HTML**
- `header_height_px` 80 to 120 to 140: `min-height` tracked each change.
- `logo_height_px` 40 to 64: logo `height:64px;object-fit:contain`.
- `logo_position` right: `order:3` on brand. Center: `order:2;margin-left:auto;margin-right:auto`.
- `icon_url` with `icon_in_header` **false**: 0 occurrences in HTML. Set **true**: renders at `height:28px` with `alt="" aria-hidden`.
- `header_layout`: `default` gives bare `order:2`; `centered` adds `flex:1;justify-content:center`; `spread` adds `justify-content:space-around`. `"diagonal"` rejected 422.
- **Fallback**: every field cleared to blank returned the navbar to `min-height:80px` and `height:40px`, not zero.

#### Task B: archive and delete `PMBC from FMP/`

**Extraction.** `scripts/extract-fmp-ports.mjs` written per `MIGRATION_PLAN.md` Appendix A: explicit allowlist (never a recursive copy), sha256 manifest, and a printed list of everything NOT copied so the delete decision is informed.

**The allowlist was extended before deleting.** Appendix A was written for the Articles migration and lists 12 files. The not-copied report showed it would have discarded the reference source for parity Phases 3 to 8, including `RichTextarea.tsx` and `RichTextEditor.tsx`, which parity Phase 6 exists to port. 17 reference files were added, marked REFERENCE rather than "port verbatim" (they are Next 16 / TipTap 2 and cannot be copied directly). 29/29 copied to `D:/PMBC/_fmp-ports-2026-08-01`.

**Archive.** Built with git plumbing (`write-tree` + `commit-tree` against a temp `GIT_INDEX_FILE`) rather than `git checkout --orphan`, because the working tree held uncommitted Task A changes that an orphan checkout would have carried onto the archive branch. Verified afterwards that main's HEAD and all Task A edits were untouched.

- Commit `5926e49`, parentless (`rev-list --count` = 1), 59 files, zero `node_modules` (the nested `.gitignore` did the filtering; the 2-file gap versus the 61 on disk is `tsbuildinfo` and `next-env.d.ts`, correctly ignored).
- Branch `fmp-cms-archive` and tag `fmp-cms-archive-2026-08-01` both point at it. **Do not merge.**
- Retrieval verified: `git show "fmp-cms-archive-2026-08-01:PMBC from FMP/src/components/admin/RichTextarea.tsx"` returns the file.

**Deleted**, then the `tsconfig.json` exclude added in Phase 1 was removed, since it no longer has anything to exclude.

**Result:** `tsc --noEmit` reports **0 errors from a clean tree with no exclusions**, down from 107. One `package.json`, one lockfile, one `node_modules` at the root.

**One false alarm worth recording.** After deletion, four routes returned 500 with `Could not find the module ... next-devtools/userspace/app/segment-explorer-node.js#SegmentViewNode in the React Client Manifest`. That is a stale `.next` dev cache, not a code fault: the production build passed 34/34 throughout. Clearing `.next` fixed it. A second confusion followed: `pkill -f "next dev"` does not reliably kill Next on Windows, so the old server kept port 3000 with the corrupt cache while the new one silently moved to 3003, making it look as though every route had broken. Killed by PID. On Windows, verify the port in the dev log before trusting a smoke test.

**Verified after deletion:** typecheck 0 errors, build clean (34/34), all 13 public routes 200, and the wired fields still take effect live.

---

### 2026-08-01 - FMP Admin Parity, Phase 1: Header Settings consolidation

Context: `ADMIN_PARITY_GAP.md` scored `/admin/header-settings` as the worst gap in the console (LAYOUT and DATA MODEL both MISSING). FMP has one page owning brand colours, logo, branding text, header icon and header layout; PMBC had split branding onto a separate `/admin/branding` and left header-settings with four fields. This phase merges them.

Decisions in force: **Palette B** (keep PMBC navy + gold, adopt green only for Save semantics, deferred to Phase 2) and **Behavior B** (match FMP structure, keep PMBC's shared components, zod validation, audit coverage, RLS).

**Verified against FMP source, not the doc**
`CMS_REFERENCE.md` is a 2026-05-02 snapshot marked "no behavioral contract", so its "17 keys" claim was checked against the real FMP page carried in `PMBC from FMP/app/admin/header-settings/page.tsx`. The doc was accurate: 17 keys, five cards, `Promise.all` Save All, hex guard `/^#[0-9A-Fa-f]{0,6}$/` while typing.

**Built**
- `supabase/migrations/029_header_settings_keys.sql` - seeds the 13 header presentation keys. Additive, idempotent (`ON CONFLICT DO NOTHING`), rollback SQL in the file footer.
- `scripts/seed-header-settings-keys.mjs` - JS equivalent for dev, `--dry-run` default reporting, fails closed if either Supabase env var is absent.
- `src/app/admin/header-settings/HeaderSettingsForm.tsx` - rewritten. Seven cards: Brand colours, Logo, Branding text, Header icon, Header layout, Call to action, Mobile. Sticky **Save All at the top**, matching FMP.
- `src/app/admin/header-settings/page.tsx` - now loads `fetchHeaderConfig()` and `fetchBranding()` in parallel, mirroring FMP's paired fetch. Max-width 760 (FMP uses 680; PMBC's colour row is three columns because it has an accent token FMP lacks).
- `src/app/admin/branding/page.tsx` - replaced with a `redirect()` to `/admin/header-settings`. `BrandingForm.tsx` deleted.
- `src/lib/cms/headerSettings.ts` - `HeaderConfig` extended to all 17 keys, each with a `DEFAULT_HEADER_CONFIG` fallback so an un-migrated database still renders sane values.
- `src/app/api/admin/header-settings/route.ts` - zod schema extended. New keys are **optional** so an older client sending only the four CTA fields still validates. `putIf` skips undefined fields, so a partial PATCH cannot blank a key it did not send. Pixel fields validate as `/^\d*$/` (TEXT, because blank means auto).
- `src/components/admin/CmsAdminNav.tsx` - "Header & Branding" removed; "Header Settings" gains `matchPaths: ['/admin/branding']`, exactly as FMP's own sidebar does. Unused `Palette` import dropped from the nav.
- `src/app/admin/page.tsx` - dashboard quick-action retargeted to `/admin/header-settings`.
- `tsconfig.json` - excludes `PMBC from FMP`. See below.

**Two deliberate deviations from FMP**
1. **Tagline stays a plain text input.** FMP uses a `RichTextEditor` here. PMBC cannot: `branding_config.tagline` is consumed by `/api/og` (satori, which takes text nodes, not HTML) and by `Footer.tsx` as a text node, so stored markup would render as escaped tags on the OG share card and in the footer. A hint on the field says so.
2. **Identity fields stay in `branding_config`, not `cms_content`.** FMP keeps `logo_url` / `brand_name` / `tagline` as `cms_content` rows. PMBC's public Navbar, Footer, `/api/og` and `buildPageMetadata` already read them from the `branding_config` table; duplicating them would recreate the dual-source-of-truth problem migration 027 fixed for nav items. The page still presents them as one form, so the admin UX matches; only the storage differs.

Also not ported: FMP's `achievement_card_logo_height`, which sizes the logo on a training achievement share card. PMBC has no such card, so the key would be dead config.

**One efficiency change vs FMP**: FMP's Save All fires 17 separate `PATCH /api/admin/content` calls. PMBC sends one request to `/api/admin/header-settings`, which already upserts the batch and writes a single audit row. Seventeen round trips would produce seventeen audit entries per click. Verified: one Save All produced exactly one `audit_log` row.

**Verified**
- `npm run typecheck` clean, `npm run build` clean (34/34 static pages).
- Migration applied to Supabase. Dry-run first (13 missing), applied, re-run reported "nothing to do", confirming idempotency. Discovered en route that `mobile_menu_enabled` had never existed as a row and was running on the code fallback; it now exists.
- `header_settings` holds exactly **17 rows**.
- Unauthenticated: `/admin/header-settings`, `/admin/branding`, `/admin/pages` all 307. `PATCH /api/admin/header-settings` 401.
- Authenticated: all three 200. `/admin/branding` 307 to `/admin/header-settings`.
- All seven card headings render, with live brand values (`#1B3A5F` / `#3FA663` / `#C69C3E`) read from the database.
- Full 17-key write round trip persisted correctly, then restored to defaults.
- zod rejects `header_height_px: "72px"` and `logo_position: "diagonal"` with 422.
- Public routes `/`, `/about`, `/services`, `/contact` all 200, unchanged.

**Incidental fix (blocking the verification gate)**
The untracked `PMBC from FMP/` tree was contributing **107 TypeScript errors** to the root `tsc --noEmit`, because the root `tsconfig.json` globbed `**/*.ts(x)`. Zero came from this phase's changes. This is the hazard already logged as S4/R14 in `MIGRATION_PLAN.md`. Rather than delete the tree (that is Phase A of the separate migration plan, and the tree is untracked and unarchived), `tsconfig.json` now excludes it. Reversible in one line, and it makes the typecheck gate meaningful again.

**Deferred, not done**
The 13 new presentation keys are **stored but not yet read by the public site**. `Navbar.tsx` still hardcodes `height={40}` and does not consult logo sizing, position, the header icon, or header layout. That is public-renderer work, and this brief scoped the phase to admin only. Setting header height today changes the stored value and nothing visible. Wiring it is a follow-up.

---

### 2026-05-02, Phase 2: Auth + Admin Shell

**Built**
- `src/lib/auth/config.ts`: NextAuth options. Credentials provider, JWT strategy (1h `maxAge` on session and JWT), bcrypt compare against `admin_users.password_hash`. On success: stamps `last_login_at`, inserts `audit_log` row (`action='login'`). JWT/session callbacks expose `id` and `role`.
- `src/types/next-auth.d.ts`: module augmentation so `session.user.role` and `token.role` are typed.
- `src/app/api/auth/[...nextauth]/route.ts`: App Router NextAuth handler.
- `src/middleware.ts`: matches `/admin/:path*`, lets `/admin/login` through, requires `token.role === 'admin'`. Forwards `x-pathname` header to RSC so the layout can detect the login route.
- `src/app/admin/login/page.tsx` + `LoginForm.tsx`: react-hook-form + zod, generic "Invalid email or password" error, redirects to `callbackUrl` (default `/admin`) on success. Form wrapped in `Suspense` (uses `useSearchParams`).
- `src/app/admin/layout.tsx`: server component. Reads `x-pathname`, renders bare for `/admin/login`, otherwise enforces session via `getServerSession` (defense-in-depth alongside middleware) and renders the chrome.
- `src/components/admin/AdminSidebar.tsx`, `AdminMobileNav.tsx`, `LogoutButton.tsx`: sidebar with active-route highlighting, mobile drawer, signOut button.
- `src/app/admin/page.tsx`: dashboard with four stat cards backed by real `count: 'exact', head: true` queries.
- `scripts/seed-admin.mjs` + `npm run seed-admin`: hashes a known password in JS (no shell escaping), upserts `admin_users` row for `meetahmadch@gmail.com`, reads back, and verifies via `bcrypt.compareSync`.

**Verified end-to-end**
- `npm run typecheck` clean. `npm run build` clean (5 routes, middleware compiled).
- `/admin` while logged out → middleware redirects to `/admin/login`.
- Sign in → lands on `/admin` dashboard. `audit_log` row created with `action='login'`.
- Sign out from top bar → back to `/admin/login`.

**Notable detours / lessons**
- First login attempts 401'd because `.env.local` did not exist. Fix: created it from `npx supabase projects api-keys --project-ref yackrfoesinnothbltlc -o env` plus a generated `NEXTAUTH_SECRET`. The `[next-auth][warn][NEXTAUTH_URL]` and `[NO_SECRET]` warnings in dev output are reliable signals that env loading is broken.
- Hydration warning on `<body>` was caused by Grammarly browser extension (`data-new-gr-c-s-check-loaded`). Fixed with `suppressHydrationWarning` on `<body>` in `src/app/layout.tsx`.
- `lucide-react@^1` is **current** (Lucide moved to a 1.x major in 2024). Do not "downgrade" to 0.x.

**Open items for next session: Phase 3: CMS Foundations**
1. `/admin/content`: key-value editor for `cms_content` (grouped by section).
2. `/admin/branding`: logo, brand name, tagline, color tokens (single-row `branding_config`).
3. `/admin/settings`: JSONB `site_settings` editor (admin email, social URLs, GA ID, etc.).
4. `/admin/email-branding` and `/admin/email-templates`: single-row `email_branding`, two seeded `email_templates` rows.
5. Decide: auto-save vs explicit Save button (CLAUDE.md §4 says pick one and stay consistent: recommend explicit Save for v1, auto-save in a later phase).
6. Rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-02 (PM), Phase 3: CMS Foundations

**Built**
- Six admin editors, all explicit-Save (no auto-save in v1):
  - `/admin/branding` (`BrandingForm.tsx`): all `branding_config` fields, three color pickers, live brand-preview panel.
  - `/admin/content` (`ContentEditor.tsx`): `cms_content` rows grouped into accordions per `section`. Per-row text/textarea toggle, add/delete with confirmation modal, batch save per section. Header `config` key hidden (managed under Header Settings).
  - `/admin/header-settings` (`HeaderSettingsForm.tsx`): nav items with `@dnd-kit` drag-reorder, CTA label/href/visibility, mobile menu toggle. Stored as JSON in `cms_content` (`section='header_settings'`, `key='config'`).
  - `/admin/settings` (`SettingsForm.tsx`): JSONB `site_settings` blob: contact_email, admin_email, whatsapp/phone, office text, LinkedIn/X URLs, default OG image, GA ID.
  - `/admin/email-branding` (`EmailBrandingForm.tsx`): logo URL, primary color, signature/footer Tiptap editors, live email-preview panel.
  - `/admin/email-templates` (`EmailTemplatesEditor.tsx`): sidebar of templates → subject + Tiptap body. Per-template enabled toggle. Right rail lists `{{variables}}` with one-click copy.
- Six API routes (`/api/admin/{branding,content,header-settings,settings,email-branding,email-templates}`): each gated by `getAdminSession()` (401 if absent), validated with zod, writes `audit_log` row on success.
- Shared infra: `src/lib/auth/requireAdmin.ts`, `src/lib/audit.ts`, `src/lib/cms/*` typed fetchers, `src/components/admin/RichTextEditor.tsx` (Tiptap StarterKit toolbar wrapper), `SaveStatus.tsx`, `ConfirmDialog.tsx`, `AdminPageHeader.tsx`.
- Installed `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (header nav reorder).

**Verified**
- `npm run typecheck` clean. `npm run build` clean: 6 admin pages + 6 API routes + login + dashboard + middleware all compiled (11 routes total).
- All six admin pages return 200 in dev under an authenticated session. Branding `POST /api/admin/branding` returned 200; persistence + audit confirmed by smoke test.
- 404s for `/admin/pages`, `/admin/page-builder`, `/admin/contact-submissions` are expected: those sidebar links are placeholders for Phase 4+.

**Notable choices**
- **Explicit Save over auto-save** for v1 (per CLAUDE.md §4 instruction to pick one). Auto-save can come later.
- **Tiptap StarterKit v3 does not include the Link mark.** Removed the link button from `RichTextEditor.tsx` to avoid runtime errors. Add `@tiptap/extension-link` and re-enable when needed.
- **Header Settings is the only `cms_content` row whose value is JSON.** Edited via its dedicated drag-and-drop UI; the generic Content editor explicitly hides this row to avoid double-editing.

**Open items for next session: Phase 4: Page Builder**
1. `/admin/pages`: list all CMS pages with edit links.
2. `/admin/page-builder/[slug]`: three-pane layout (sections list / editor / live preview).
3. Section editors for: `hero`, `paragraphs`, `stats_block`, `service_cards` (start with these four).
4. Drag-and-drop section reorder (already have `@dnd-kit` installed).
5. Visibility toggle and per-section save.
6. Still pending: rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-02 (evening), Phase 4: Page Builder

**Built**
- `src/lib/cms/sectionTypes.ts`: registry of all 13 section types: `label`, `description`, `implemented` flag (true for hero/paragraphs/stats_block/service_cards, false for the other 9), and `defaultContent` blob used by `/create`.
- `src/lib/cms/pages.ts`: `fetchPages()`, `fetchPage(slug)`, `fetchPageSections(slug, { onlyVisible })`.
- `src/lib/cms/serializers.ts`: `LocalSection` type + `sectionFromRow(row)`. **Server-safe** module so both `page.tsx` (server) and `PageBuilder.tsx` (client) can import.
- API routes (all session-gated, zod-validated, audit-logged):
  - `POST /api/admin/page-sections`: batch upsert; bumps `cms_pages.updated_at`.
  - `POST /api/admin/page-sections/create`: inserts empty section of given type at `max(display_order) + 10`.
  - `DELETE /api/admin/page-sections/[id]`: deletes one section.
- Public renderer at `src/components/public/SectionRenderer.tsx` + four section components (`Hero`, `Paragraphs`, `StatsBlock`, `ServiceCards`) + dashed `Placeholder` for the 9 not-yet-implemented types.
- Public route `src/app/(public)/[slug]/page.tsx`: fetches page + sections, supports `?preview=1` (shows hidden sections + draft pages).
- `src/app/page.tsx` updated so the home (`/`) renders sections for slug `home`, with placeholder fallback if none exist. Same `?preview=1` semantics as the catch-all route.
- `src/app/admin/pages/page.tsx`: table of every `cms_pages` row with section count + status badge + "Builder" link.
- Section editors at `src/components/admin/editors/{HeroEditor,ParagraphsEditor,StatsBlockEditor,ServiceCardsEditor}.tsx` plus shared `types.ts`.
- Three-pane `src/app/admin/page-builder/[slug]/{page,PageBuilder,SectionEditorPanel,SectionPickerDialog}.tsx`. Top bar: title + status + "Unsaved changes" pill + Save (disabled when not dirty). Left: dnd section list + visibility eye + delete + "Add section". Center: editor for the selected type (raw-JSON inspector for unimplemented types). Right: iframe at `/[slug]?preview=1` (or `/?preview=1` for home) with Refresh button; iframe re-keys after every save / add / delete.
- `beforeunload` warning on dirty navigation.
- `scripts/smoke-builder.mjs`: programmatically logs in via NextAuth credentials and GETs each `/admin/page-builder/<slug>` route; used to verify the `fromServerRow` regression fix end-to-end.

**Verified**
- `npm run typecheck` clean. `npm run build` clean (23 routes total).
- Smoke script: 7 distinct slugs (`home`, `about`, `services`, `sectors`, `contact`, `financial-modeler-pro`, `service-business-valuation`) + `/admin/pages` all returned HTTP 200 with an authenticated session.

**Notable detours / lessons**
- **Don't export non-component functions from a `'use client'` module that a server component imports.** First version of `PageBuilder.tsx` exported a `fromServerRow` helper that was called from the server `page.tsx`. Next.js threw `Attempted to call fromServerRow() from the server but fromServerRow is on the client`. Fix: move the helper to `src/lib/cms/serializers.ts` (no `'use client'`). Type-only exports from client modules are fine: types are erased at build.
- **Don't run `npm run build` while `npm run dev` is also running on the same project**: Turbopack and the production build both write to `.next/` and clobber each other (`ENOENT _buildManifest.js.tmp.*` cascade). Recovery: stop dev, `rm -rf .next`, restart dev.
- **Field-name compat for hero seeds**: existing seeded hero rows use `badge` (not `badge_text` from spec). Renderer + editor read both keys; editor writes the canonical `badge_text` going forward. Same pattern for `service_cards` seed using `items` vs spec `cards`.
- **No draft preview state in v1**: the iframe shows the last *saved* state, not unsaved edits. Amber strip in preview pane reminds the user of this when dirty.
- **Add section creates immediately on the server** (so it has a stable id for editing). That's why "Add section" doesn't mark the page dirty: the row is already persisted.

**Open items for next session: Phase 5: Public Pages (core)**
1. Root layout with CMS-driven Navbar + Footer (read from `cms_content` `header_settings`/`footer_settings` discrete keys per the 009 split).
2. Contact page form + `/api/contact` route + email templates wired up via Resend.
3. Per-page metadata pulling from `cms_pages` (`meta_title` already wired in `(public)/[slug]/page.tsx`; needs root layout title template + the home slug variant).
4. Still pending: rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-02 (late), Phase 4.5: Admin Refactor (FMP alignment)

Aligned the admin CMS structurally with FMP's patterns (per `CMS_REFERENCE.md` placed at the repo root) while keeping PMBC's distinct institutional palette and skipping FMP features PMBC doesn't need.

**New files**
- `src/components/admin/CmsAdminNav.tsx`: single sidebar component handling desktop + mobile (240/64 collapse with `localStorage['pmbcAdminSidebarCollapsed']`, `sessionStorage['admin_sidebar_scroll']` restore-on-pathname-change, off-canvas drawer below 768px with body-scroll lock + backdrop-click-to-close, active state by exact match OR `matchPaths` prefix, **3px gold (`#D4A93A`) left border** on active item, group dividers, bottom external links to the public site + FMP, sign-out folded into footer).
- `src/lib/admin/styles.ts`: shared admin design tokens (`ADMIN_COLORS`, `ADMIN_LAYOUT`) + ready-made `CSSProperties` presets (`adminCard`, `adminInput`, `adminButtonPrimary`, `adminButtonGhost`, `adminTable`, `adminBadge`, etc.).
- `supabase/migrations/009_split_header_settings.sql`: splits the legacy `(header_settings, config)` JSON blob into discrete keys: `nav_items` (JSON array), `cta_label`, `cta_href`, `show_cta`, `mobile_menu_enabled`. Idempotent: pulls values from any existing blob, inserts discrete rows with `ON CONFLICT DO NOTHING`, drops the legacy row last.
- `scripts/smoke-admin.mjs`: extends the existing builder smoke script to hit every top-level admin route (10 pages) post-login.
- `CMS_REFERENCE.md`: the FMP admin CMS reference doc placed at the repo root for future contextual reads. Treat as frozen spec, not behavioral contract.

**Deleted (folded into `CmsAdminNav.tsx`)**
- `src/components/admin/AdminSidebar.tsx`
- `src/components/admin/AdminMobileNav.tsx`
- `src/components/admin/LogoutButton.tsx`

**Modified**
- All admin pages converted from Tailwind utility classes to inline styles using the new `src/lib/admin/styles.ts` tokens: `src/app/admin/{page,layout}.tsx`, `login/{page,LoginForm}.tsx`, `branding/{page,BrandingForm}.tsx`, `content/{page,ContentEditor}.tsx`, `header-settings/{page,HeaderSettingsForm}.tsx`, `settings/{page,SettingsForm}.tsx`, `email-branding/{page,EmailBrandingForm}.tsx`, `email-templates/{page,EmailTemplatesEditor}.tsx`, `pages/page.tsx`, `page-builder/[slug]/{page,PageBuilder,SectionEditorPanel,SectionPickerDialog}.tsx`.
- All four section editors converted: `src/components/admin/editors/{HeroEditor,ParagraphsEditor,StatsBlockEditor,ServiceCardsEditor}.tsx`.
- Shared admin components converted: `AdminPageHeader.tsx`, `SaveStatus.tsx`, `ConfirmDialog.tsx`, `RichTextEditor.tsx`.
- `src/lib/cms/headerSettings.ts`: fetcher now reads discrete cms_content rows under `header_settings` with backwards-compat fallback to legacy `config` JSON for unmigrated databases.
- API routes: `/api/admin/content` adds `GET` (returns `{ rows: [...] }`) and `PATCH` (upsert; `POST` kept as legacy alias). `/api/admin/branding` adds `GET` (returns `{ row }`) and now returns `{ row }` from mutations. `/api/admin/{settings,email-branding,email-templates,header-settings}` accept both `PATCH` and `POST`. `/api/admin/header-settings` writes discrete `cms_content` rows per the 009 namespace split.

**No new packages.** No new tables or migrations beyond 009. No new public-facing routes.

**Verified**
- `npm run typecheck` clean.
- `npm run build` clean: 12 admin routes + 9 admin API routes compiled.
- `node scripts/smoke-admin.mjs` against `npm run dev`: 10/10 admin pages returned HTTP 200 under an authenticated session (`/admin/contact-submissions` returned 404 as expected: Phase 5 placeholder).

**Notable choices**
- **Kept iframe preview** in the page builder rather than FMP's "open in new tab" pattern; iframe re-keys after every Save / Add / Delete.
- **Kept `SaveStatus` / `ConfirmDialog` / `AdminPageHeader`** as shared primitives: FMP's CMS_REFERENCE flagged the absence of these as "the first thing worth extracting" if mirrored.
- **Skipped per-field VF / ItemVF / ItemBar visibility wrappers** for v1: section editors take a flat `content` blob.
- **Skipped Media Library and Smart Routing for column types**: neither is justified by current PMBC scope.

**Open items for next session: Phase 5: Public Pages (core)**
1. Apply migration 009 against the Supabase project (the fetcher tolerates the unmigrated state in dev, but production needs the discrete rows).
2. Root layout with CMS-driven Navbar + Footer reading the post-009 discrete `header_settings` keys.
3. Contact page form + `/api/contact` route + email templates wired up via Resend.
4. Still pending: rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-03, Phase 5: Public Pages (core)

**Built**
- `src/app/(public)/layout.tsx`: public route group layout: `<NavbarServer />` + `<main>` + `<FooterServer />`. Home moved from `src/app/page.tsx` → `src/app/(public)/page.tsx` so it inherits the same chrome.
- `src/app/layout.tsx`: loads Inter (body) + Source Serif 4 (headings) via `next/font/google`, exposes them as `--font-inter` / `--font-source-serif` CSS variables on `<html>`. Added a `{ default, template: '%s | …' }` title.
- `src/app/globals.css`: registers PMBC brand tokens (`--pmbc-primary`, `--pmbc-primary-deep`, `--pmbc-secondary`, `--pmbc-accent`, `--pmbc-text`, `--pmbc-text-on-dark`, `--pmbc-muted`, `--pmbc-surface`, `--pmbc-surface-alt`, `--pmbc-border`) plus a Tailwind 4 `@theme inline` block that maps `--font-serif` / `--font-sans` and `--color-pmbc-*` for utility-class consumption. `.font-serif` opt-in helper.
- `src/components/layout/{NavbarServer,Navbar}.tsx`: server fetches `branding_config` + post-009 `header_settings`, client renders sticky 72px bar (subtle shadow on scroll past 8px), logo→home, desktop nav with active-route highlighting, primary CTA on the right, mobile hamburger with slide-down menu, body-scroll lock while open, auto-close on `pathname` change.
- `src/components/layout/{FooterServer,Footer}.tsx`: server fetches `branding_config` + `cms_content` section `footer_settings` + `site_settings`. Deep-navy bg with gold hairline. Four columns (Brand+tagline / Services from `src/config/services.ts` / Firm / Contact) + bottom strip with `{year}`-replaced copyright + Privacy/Terms links. Inline LinkedIn SVG (lucide-react 1.x ships no brand icons).
- `src/config/services.ts`: all 9 services with `slug` / `number` / `title` / hardcoded `summary`. Single source of truth for the services grid + footer column + form dropdown.
- `src/app/(public)/services/page.tsx`: renders any CMS sections for slug `services`, then a fixed 3-col grid of all 9 services from config. Each card → `/services/{slug}` (detail routes are still Phase 7).
- `src/app/(public)/contact/page.tsx`: CMS sections + two-column layout (form left, direct contact info right). Reads `site_settings` for email/WhatsApp/office display.
- `src/components/public/ContactForm.tsx`: react-hook-form, all `contact_submissions` fields, Country dropdown (KSA/UAE/QA/KW/BH/OM/Other), Service dropdown from config, **hCaptcha gated behind `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` presence** (renders only if env present), POSTs JSON to `/api/contact`, inline success/error states, captcha auto-resets after submit.
- `src/app/api/contact/route.ts`: zod-validates body, server-side hCaptcha verify (no-op if `HCAPTCHA_SECRET_KEY` unset), inserts into `contact_submissions`, fires both emails in parallel. Email failures logged but do NOT 500 the request: the submission is already saved and visible to the admin inbox once Phase 5+ adds it.
- `src/lib/email/send.ts`: Resend wrapper with **graceful fallback**: missing `RESEND_API_KEY`/`EMAIL_FROM_DEFAULT` → log + return `{ ok: false, reason: 'not_configured' }`, never throws. Caches the `Resend` client.
- `src/lib/email/templates/_base.ts`: `baseLayoutBranded(content)` reads `email_branding`, builds a 600px branded shell (header logo-or-wordmark on primary color, body, signature, footer) using table-based markup for email-client safety.
- `src/lib/email/render.ts`: `{{var}}` substitution. `renderTemplate` HTML-escapes values (used for body); `renderSubject` does not. Unknown vars are left in place.
- `src/app/(public)/{privacy,terms}/page.tsx`: hardcoded with "to be reviewed by counsel" placeholder. PMBC-specific copy (LLP wording, engagement-letter-governs-mandates clause, etc.).

**Verified**
- `npm run typecheck` clean.
- `npm run build` clean: 28 routes total: home, `/[slug]`, `/services`, `/contact`, `/privacy`, `/terms`, all admin routes, `/api/contact`, all admin API routes. `/privacy` and `/terms` correctly statically prerendered (○); home + services + `/[slug]` + contact dynamic (ƒ) due to CMS reads.

**Notable detours / lessons**
- **`lucide-react@1.x` ships no brand icons.** Imported `Linkedin` from `lucide-react` and got `TS2305: Module '"lucide-react"' has no exported member 'Linkedin'`. Fix: inline a 24×24 path-only SVG component. (Confirmed via `Object.keys(require('lucide-react')).filter(s => /linke/i.test(s))` → 0 matches.) Memory note already says lucide 1.x is current: don't try to "downgrade" past that as a workaround.
- **Stale `.next/types/validator.ts`** kept failing typecheck with `Cannot find module '../../src/app/page.js'` after moving `page.tsx` into the `(public)` group. Fix: `rm -rf .next` then re-run `npm run typecheck`. Don't run `npm run build` while `npm run dev` is active on the same project (already documented above).
- **Home page belongs in the route group.** Initial `src/app/page.tsx` lived OUTSIDE `(public)` so it would NOT have inherited `(public)/layout.tsx`. Moving it to `src/app/(public)/page.tsx` keeps `/` mapped correctly and gives it the navbar/footer chrome.
- **CSS-vars-as-Tailwind-arbitrary-values** (`bg-[color:var(--pmbc-primary)]`) is the cleanest way to consume the brand tokens from inside Tailwind utility-class strings without juggling a parallel Tailwind theme file.
- **Form-vs-API HTML escaping.** Body templates pass through `renderTemplate` (escaped) so the user-supplied `message` field can't inject HTML into the admin notification email; subject lines pass through `renderSubject` (raw) since email clients do not render HTML in subjects.

**Open items for next session: Phase 6: Remaining Section Types + admin contact inbox**
1. Section editors + public renderers for `sector_grid`, `process_steps`, `network_partners`, `founder_block`, `text_image`, `cta_block`, `quote`, `fmp_intro`, `service_detail`. Update `SECTION_REGISTRY` in `src/components/public/SectionRenderer.tsx` and `sectionTypes.ts` (`implemented: true`).
2. Add `/admin/contact-submissions` (currently a 404 sidebar placeholder): list + view + status change + notes for the rows the contact form is now writing.
3. Detail pages for individual services at `/services/[slug]` (currently `.gitkeep` only).
4. Resend domain verification + `RESEND_API_KEY` / `EMAIL_FROM_DEFAULT` / `EMAIL_FROM_CONTACT` / `EMAIL_TO_ADMIN` populated in `.env.local` so the contact form actually emails.
5. Apply migration 009 against the production Supabase project (still pending from Phase 4.5).
6. Still pending: rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-03 (PM), Phase 6: Remaining Section Types

**Built**
- 9 public renderers in `src/components/public/sections/`: `SectorGrid`, `ProcessSteps`, `NetworkPartners`, `FounderBlock`, `TextImage`, `CtaBlock`, `Quote`, `FmpIntro`, `ServiceDetail`. Tailwind classes, brand tokens (`#1B3A5F`/`#0F2540`/`#D4A93A`/`#3FA663`), serif headlines (`font-serif`), Inter body, mobile-responsive throughout. All renderers tolerate empty/legacy fields and fall back gracefully (e.g. neutral-tinted placeholder boxes when `image_url` is empty so layouts can be verified pre-asset-upload).
- 9 admin editors in `src/components/admin/editors/`: `SectorGridEditor`, `ProcessStepsEditor`, `NetworkPartnersEditor`, `FounderEditor`, `TextImageEditor`, `CtaBlockEditor`, `QuoteEditor`, `FmpIntroEditor`, `ServiceDetailEditor`. Inline-styles (per `src/lib/admin/styles.ts` tokens), explicit-save, Tiptap for rich text (founder bio, text-image body, FMP description, service full-description), `@dnd-kit` for array reorder (sectors, steps, partners, FMP feature points, deliverables), discrete dropdowns for icon picker / service picker / layout / image-position / background-style / alignment buttons. Each editor reads legacy field aliases (`bio` → `bio_html`, `body` → `body_html`, `description` → `full_description_html`, `quote` → `quote_text`, etc.) so any pre-existing `defaultContent` or hand-written rows continue to render.
- Shared `src/lib/cms/sectorIcons.tsx`: curated 21-icon lucide registry (`Building2`, `Factory`, `Zap`, `Hospital`, `ShoppingBag`, `Plane`, `Hammer`, `Server`, `Droplet`, `Trees`, `Truck`, `Wheat`, `Cpu`, `Banknote`, `GraduationCap`, `HeartPulse`, `Hotel`, `Mountain`, `Ship`, `Wrench`, `Building`) with `SectorIconKey` type, `SECTOR_ICONS` array (used by editor dropdown), and `resolveSectorIcon(key)` helper (used by the public renderer). Module is `.tsx` so server components can import the resolved component directly.
- Registries wired:
  - `src/lib/cms/sectionTypes.ts`: all 13 types now `implemented: true`. Process-steps `defaultContent` seeded with the canonical 4-step `Understand → Analyse → Model → Advise` scaffold so a freshly-added section already shows the firm's methodology.
  - `src/components/public/SectionRenderer.tsx`: `REGISTRY` maps all 13 section types; the dashed `Placeholder` is now only reachable for unknown/legacy types.
  - `src/app/admin/page-builder/[slug]/SectionEditorPanel.tsx`: `EDITORS` maps all 13 types; raw-JSON inspector fallback retained for unknown types.
- `scripts/seed-phase6-sections.mjs` + `npm run seed-phase6`: idempotent smoke-test seed. Tags every inserted row with `styles.smoke = 'phase6'`, deletes prior phase-6 rows via `.filter('styles->>smoke', 'eq', 'phase6')` before re-inserting. Spreads the 9 new section types across 6 existing CMS pages: `/approach` (process_steps + quote + cta_block), `/sectors` (sector_grid), `/network` (network_partners), `/about` (founder_block + text_image), `/financial-modeler-pro` (fmp_intro), `/service-business-valuation` (service_detail). Display order starts at 1000 so seeded rows sort after any pre-existing real sections.

**Verified**
- `npm run typecheck` clean. `npm run build` clean: 27 routes total.
- `npm run seed-phase6` ran clean, inserted 9 rows across 6 page slugs.

**Notable choices**
- **Dropdown icon picker, not a search modal.** With only ~21 curated sector-relevant icons in scope, a labelled `<select>` is faster and clearer than a fuzzy-search picker. Each option pairs the lucide icon's natural name with a sector-specific label (e.g. `building2 → "Real estate"`, `droplet → "Oil, gas & water"`).
- **`fmp_intro` and CTA defaults** point to `https://www.financialmodelerpro.com` (with the `www.` prefix) so cross-site links match the canonical FMP host.
- **`service_detail` stays renderer-only for now**: it does NOT itself produce a route. Phase 7 will wire `/services/[slug]` to read `cms_pages` row `service-{slug}` and render its sections, at which point the seeded `/service-business-valuation` data becomes the smoke test for the route too.
- **Image-bearing renderers (`NetworkPartners`, `FounderBlock`, `TextImage`, `Quote`, `FmpIntro`) use `next/image`.** Seeded rows leave the URLs empty for now: `next.config.ts` has no `images.remotePatterns` configured yet, so loading remote images would fail. Add hosts to `next.config.ts` before populating real photo/logo URLs via the admin editors.
- **Layout buttons over selects** for binary/ternary visual choices (image_left/right, alignment, background_style): matches the existing `HeroEditor` pattern and keeps the editor visually compact.

**Open items for next session: Phase 7: Remaining Pages**
1. `/services/[slug]` route: read `cms_pages` row keyed `service-{slug}` and render its `page_sections`. The `service_detail` renderer is already registry-ready.
2. Populate page sections for sectors, approach, network, about, financial-modeler-pro, and the 9 service-detail pages with real content via the page builder (the smoke-seed rows can be deleted by re-running `seed-phase6` with an emptied `SEEDS` array, or kept as starter content).
3. Add `images.remotePatterns` to `next.config.ts` for the host(s) where partner logos and founder/team photos will live, so the image-bearing renderers can load real assets.
4. Still pending: `/admin/contact-submissions` inbox · apply migration 009 against production Supabase · rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-03 (late), Phase 7: Remaining Pages

**Approach decision: service-detail content lives in `cms_content`, not `page_sections`.** The Phase 6 `service_detail` *section type* (which reads from a `page_sections.content` blob) stays in place for any page builder use, but `/services/[slug]` does NOT use it. Instead each service has its own `cms_content` namespace `service_<slug>` with discrete keys (`full_description`, `deliverables`, `timeline_text`, `target_audience_text`). This keeps service detail content editable from the existing `/admin/content` UI without forcing the admin to find a `service_detail` block on a hidden CMS page. Discrete keys also match the namespace convention from CLAUDE.md §4 ("discrete keys preferred over bundled JSON blobs"). The exception is `deliverables`, which is naturally a list and is stored as a JSON array; `parseDeliverables` in `src/lib/cms/serviceContent.ts` tries `JSON.parse` first and falls back to newline-split, so an admin can also edit it as a plain newline-separated list and the page still renders.

**Built**
- 5 bespoke firm-page routes: `src/app/(public)/{about,sectors,approach,network,financial-modeler-pro}/page.tsx`. Each is a server component with its own `generateMetadata` (reads `cms_pages` for `meta_title` / `meta_description` / `og_image_url`), supports `?preview=1` (passes through to `fetchPageSections({ onlyVisible: !isPreview })`), and uses the shared `FirmPageBody` helper to render sections: prepending a `PageHeroFallback` only when the first section is not a `hero`. Page-specific fallback hero copy is hard-coded in each route file (e.g. /sectors → "Where we deliver depth, not breadth"); when an admin adds a hero block via the page builder, that block takes over and the fallback is no longer rendered.
- `src/app/(public)/services/[slug]/page.tsx`: service detail route. `generateStaticParams` returns all 9 slugs from `src/config/services.ts`; `notFound()` for unknown slugs (acceptance: `/services/bogus-slug` → 404). Calls `fetchServiceDetailFields(slug)` which reads `cms_content` rows for `section = service_<slug>`, builds a content blob, and reuses the existing `ServiceDetail` renderer. Appends a navy CTA panel linking to `/contact?service=<slug>`. `dynamic = 'force-dynamic'` on the route: Next 15's build output marks the route SSG with the 9 enumerated paths, but at request time `force-dynamic` re-fetches; verified empirically by writing an `EDIT-MARKER-…` value to `cms_content` and re-curling the page.
- `src/components/public/PageHeroFallback.tsx` and `src/components/public/FirmPageBody.tsx`: shared primitives for the firm-page routes.
- `src/lib/cms/serviceContent.ts`: `serviceContentSection(slug)`, `findService(slug)`, `fetchServiceDetailFields(slug)`, plus the robust `parseDeliverables` parser.
- `src/app/sitemap.ts`: Next.js Metadata Route returning 19 URLs (10 firm + 9 service detail). Uses `NEXT_PUBLIC_SITE_URL` with a `https://pacemakersglobal.com` fallback. Serves at `/sitemap.xml`.
- `src/app/robots.ts`: allow `/`, disallow `/admin` and `/api`, points to `/sitemap.xml`.
- `supabase/migrations/010_seed_service_detail_content.sql`: 36 rows (4 fields × 9 services). Idempotent via `ON CONFLICT (section, key) DO NOTHING`.
- `scripts/seed-service-content.mjs` + `npm run seed-service-content`: JS-side equivalent of migration 010 for dev runs without touching the SQL editor. Idempotent by default; pass `--force` to delete-and-reinsert (used during the live-edit acceptance test to restore originals).

**Modified**
- `src/components/public/ContactForm.tsx`: accepts optional `defaultServiceTitle` prop. Set as `defaultValue` on the `<select>` so SSR HTML carries `selected="…"` and the dropdown is pre-selected at first paint (no hydration flicker). Also dropped the redundant hardcoded `defaultValue=""` on the select since react-hook-form already manages defaults via `useForm({ defaultValues })`.
- `src/app/(public)/contact/page.tsx`: reads `?service=<slug>` from `searchParams`, maps slug → service title via `SERVICES`, passes `defaultServiceTitle` to `ContactForm`.
- `src/app/admin/content/page.tsx`: splits cms_content rows into "General" and "Service detail content" groups by section-name prefix (`service_*`). Each group is rendered by its own `ContentEditor` instance under a labelled divider so the 9 service accordions don't visually drown the small set of header / footer / SEO sections.
- All bespoke pages (plus `/services` and `/contact` for consistency): `generateMetadata` now uses `title: { absolute: page.meta_title }` to bypass the root layout's `'%s | PaceMakers Business Consultants'` template. Without this, every cms_pages-driven `meta_title` (which already ends in ",  PaceMakers Business Consultants") rendered as a doubled "X: PaceMakers Business Consultants | PaceMakers Business Consultants" `<title>`. Fixed.
- `package.json`: adds `seed-service-content` script.

**Deleted**
- `src/app/(public)/[slug]/page.tsx`: the catch-all is gone. **Decision**: every CMS-managed page now needs an explicit route, which means missing pages 404 explicitly (instead of silently rendering an unconfigured slug if someone seeds a stray `cms_pages` row). The CMS isn't designed to spawn arbitrary URLs from the admin UI anyway: pages are seeded in migrations and need a route file, so the catch-all was paying an ambiguity cost without earning a real benefit.
- `src/app/(public)/services/[slug]/.gitkeep`: replaced by `page.tsx`.

**Stranded data: Phase 6 smoke seed for `/service-business-valuation`**
The Phase 6 `seed-phase6-sections.mjs` placed a `service_detail` `page_sections` row on the `service-business-valuation` *page slug*, which the deleted catch-all served at `/service-business-valuation` (note: no `/services/` prefix). After Phase 7 that URL is unreachable: there's no route matching it. The row remains in `page_sections` but renders nowhere. Harmless. Cleanup query when desired: `DELETE FROM page_sections WHERE styles->>'smoke' = 'phase6' AND page_slug = 'service-business-valuation';`. The other smoke seeds (on /approach, /sectors, /network, /about, /financial-modeler-pro) are still reachable via the new bespoke routes and serve as starter content.

**Verified**
- `npm run typecheck` clean. `npm run build` clean: 35 routes total, including 9 SSG-enumerated `/services/[slug]` paths plus `/sitemap.xml` and `/robots.txt`.
- All 16 valid public routes returned 200; `/services/bogus-slug` returned 404; sitemap.xml + robots.txt both 200.
- Titles unique per page (verified with `curl | grep <title>`); brand suffix appears once now.
- Live-edit acceptance: updated `service_cfo-advisory.full_description` to `<p>EDIT-MARKER-…</p>` via supabase-js → `curl /services/cfo-advisory` reflected the marker on the next request → restored originals via `npm run seed-service-content -- --force`.
- `/contact?service=cfo-advisory` SSR HTML: `<option value="CFO Advisory" selected="">CFO Advisory</option>`.
- `/sitemap.xml` returns 19 `<loc>` entries.

**Notable detours / lessons**
- **Stale `.next/types/validator.ts` after deleting a route.** First typecheck after removing the catch-all errored with `Cannot find module '../../src/app/(public)/[slug]/page.js'`. Fix is the same as the Phase 5 entry: `rm -rf .next` and re-run. Documented at the top-level pattern level here so future work on route deletion doesn't have to re-discover it.
- **Doubled `<title>` from cms_pages × root template.** `cms_pages.meta_title` already includes ",  PaceMakers Business Consultants"; the root layout's `metadata.title.template = '%s | PaceMakers Business Consultants'` doubles it. Fix is `title: { absolute: page.meta_title }`. Applied across the new bespoke routes plus the existing `/services` and `/contact` for consistency.
- **`force-dynamic` + `generateStaticParams` in Next 15.** The build output marks `/services/[slug]` as `●` (SSG) and lists the 9 enumerated paths, but at request time the route still hits the database: confirmed by the live-edit test. The two annotations don't conflict here; `generateStaticParams` is providing the slug list (used for build-time validation and as a 404 hint), while `force-dynamic` ensures fresh data each request.
- **react-hook-form pre-fill needs `defaultValue` on the element, not just `defaultValues` on the form.** With only `useForm({ defaultValues: { service_interest: 'CFO Advisory' } })`, the SSR HTML rendered the select with no `selected` option: RHF sets the value via ref imperatively after mount, which would cause a brief hydration flicker. Adding `defaultValue={defaultServiceTitle ?? ''}` on the `<select>` itself fixes the SSR.

**Open items for next session: Phase 8: SEO & Polish**
1. OG image route at `/api/og` (Next.js `next/og` ImageResponse). 1200×630, navy background, white text, logo top-left, headline center, tagline below. Pattern matches FMP's `/api/og/main`. Hook into `cms_pages.og_image_url` so admins can override per-page.
2. JSON-LD organization schema in the root layout (`@type: FinancialService`).
3. 404 page (`src/app/not-found.tsx`) with proper PMBC chrome instead of the default Next 404.
4. Decide and apply: add a `production` cms_pages row update for the `service-{slug}` titles to drop the brand suffix (so the absolute-title fix gives consistent results across both data shapes), OR keep current data and rely on the title-absolute approach unchanged. Either is fine.
5. Still pending: `/admin/contact-submissions` inbox · apply migrations 009 & 010 against production Supabase · `images.remotePatterns` in `next.config.ts` · rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-03 (night), Phase 8: SEO & Polish

**Built**
- **Dynamic OG image route** at `src/app/api/og/route.tsx`: `next/og` `ImageResponse`, 1200×630, navy bg, gold hairline top, large Source Serif headline center-left, subtitle in Inter below, gold tagline + URL bottom row. Reads `?title=` and `?subtitle=`; defaults pull from `branding_config.brand_name` / `tagline`. Logo loader (`loadLogoAsDataUrl`) fetches `branding_config.logo_url`, runs SVG content through `sharp` to convert to PNG, embeds as base64 data URL. Falls back to a wordmark when no logo is configured or fetch/decode fails. Auto-bumps the navy from primary `#1B3A5F` → deeper `#0F2540` for OG card contrast. `runtime = 'nodejs'` so `sharp` is available.
- **Font loader** at `src/lib/og/fonts.ts`: fetches Google Fonts CSS with an IE 9 User-Agent so the response carries woff/truetype/opentype rather than woff2 (satori only accepts the older formats). Module-scope `Map` cache keyed `family:weight` so the first request per warm instance fetches and subsequent requests reuse. Accepts any of `format('woff'|'truetype'|'opentype')` after testing what Google actually returns for each family: Inter, Source Serif 4, Source Sans 3, and Open Sans all came back as `format('woff')` for the IE UA on the css2 endpoint. Final regex matches all three formats then falls back to "any url(…)" so a future format change doesn't break the route.
- **Per-page metadata helper** at `src/lib/seo/metadata.ts`: `siteUrl()`, `ogImageFor({title, subtitle})`, and `buildPageMetadata({path, cmsPage, fallback, ogSubtitleOverride?})`. Single source of truth for every public route's `<title>` / canonical / OG / twitter. Pulls `meta_title` / `meta_description` / `og_image_url` from the `cms_pages` row and falls through to the route-supplied defaults. When `og_image_url` is null, builds an absolute `/api/og?…` URL so every page automatically gets a unique OG card. Uses `title: { absolute }` to bypass the root layout's `'%s | …'` template (cms_pages.meta_title already includes the brand suffix). Strips the brand suffix from the OG title so the OG card itself doesn't duplicate the wordmark already drawn on the card.
- **Root layout uplift**: `src/app/layout.tsx` now sets `metadataBase`, default `openGraph` with site name + type + default OG image (`/api/og?title=Advisory%20from%20Structure%20to%20Exit&subtitle=…`), default `twitter` summary_large_image card.
- **JSON-LD** , 
  - `src/components/seo/OrganizationJsonLd.tsx` (server component, mounted in `(public)/layout.tsx`) emits a single `<script type="application/ld+json">` containing a schema.org `@graph` with `FinancialService`, `Organization`, and `WebSite` nodes. Nodes share `@id` references so they cross-link. Reads `branding_config` (logo, name) + `site_settings` (contact email, social URLs, office). `foundingDate: '2017'`, `areaServed: ['Saudi Arabia', 'GCC', 'Worldwide']`. Safely degrades to defaults if either DB read fails.
  - `src/components/seo/ServiceJsonLd.tsx` mounted on `/services/[slug]` emits a per-service `Service` schema with `provider: { '@id': '<base>#organization' }` linking back to the organization graph.
- **Branded 404**: `src/app/(public)/not-found.tsx` (catches `notFound()` thrown from inside the public group, e.g. `/services/bogus-slug`) and `src/app/not-found.tsx` (catches unmatched URLs site-wide; manually mounts `NavbarServer` + `FooterServer` since it sits outside the public layout). Both use the same content: gold accent eyebrow, serif "We couldn't find that page" headline, three buttons (back to home / services / contact).
- **Branded error boundary**: `src/app/error.tsx` (client component; required for error boundaries). Logs `error.digest` to console, surfaces it to the user as a "Reference: …" line, offers `reset()` retry plus home/contact links.
- **Privacy + Terms**: fleshed out from the Phase 5 placeholders:
  - `privacy/page.tsx`: 11 numbered sections including named processors (Vercel, Supabase, Resend, hCaptcha, Google Fonts) with what each handles, international transfers note, retention, your-rights, security, governing-law placeholder, last-updated stamp.
  - `terms/page.tsx`: 13 numbered sections including no-advisor-relationship-from-website-use, engagement-letter-governs-mandates, IP, "as-is" disclaimers, third-party links, acceptable-use, privacy-policy reference, governing-law placeholder, last-updated stamp.
  - Both pages display a prominent "Subject to legal review: to be finalised by counsel before launch" badge at the top.
- **`next.config.ts`**: `poweredByHeader: false`. `images.remotePatterns` includes the project's Supabase host (parsed from `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`), a wildcard `*.supabase.co/storage/v1/object/public/**` for preview projects, and `res.cloudinary.com` as a common admin choice. Function-derived host avoids the "edit config when Supabase project changes" gotcha.
- **`/admin/og-preview`**: server page enumerates firm pages (in sitemap order) and service-detail pages (per `SERVICES`). The client `OgPreviewBoard` shows an `<img src="/api/og?…">` live preview for each, the auto-generated title/subtitle the route would use, an optional override URL field, plus Save / Clear-override / Refresh / View-page actions. Save calls `PATCH /api/admin/pages/og-image` (also `POST` alias) which upserts `cms_pages.og_image_url` for the slug: session-gated, zod-validated (URL or null/empty → null), audit-logged. New "OG Previews" item added to `CmsAdminNav` under Content (lucide `Image` icon).

**Modified: every public page picks up the new metadata helper**
- `src/app/(public)/page.tsx` (home), `about/page.tsx`, `sectors/page.tsx`, `approach/page.tsx`, `network/page.tsx`, `financial-modeler-pro/page.tsx`, `services/page.tsx`, `services/[slug]/page.tsx`, `contact/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`: `generateMetadata` now calls `buildPageMetadata({path, cmsPage, fallback, ogSubtitleOverride?})`. Each route supplies its own `path` for the canonical and a `fallback` block (used when the cms_pages row is missing). The previous `title: { absolute }` fix from Phase 7 is preserved through the helper.
- `src/app/(public)/layout.tsx` mounts `<OrganizationJsonLd />` above the navbar.
- `src/app/(public)/services/[slug]/page.tsx` mounts `<ServiceJsonLd … />` and computes the canonical URL once via `siteUrl()`.
- `src/components/admin/CmsAdminNav.tsx` adds the OG Previews link.

**Verified**
- `npm run typecheck` clean. `npm run build` clean: 38 routes total (added `/api/og`, `/api/admin/pages/og-image`, `/admin/og-preview`).
- `/api/og?title=Test%20Card&subtitle=Advisory%20from%20Structure%20to%20Exit` returns a valid 1200×630 PNG (~33 KB). Visual inspection confirmed the navy/gold layout with wordmark fallback (no logo configured in dev branding row).
- All 17 valid public routes returned 200; `/services/bogus-slug` (in-group) and `/not-a-page` (root) both returned 404 with the branded 404 page (`<title>Page not found | …</title>`, gold eyebrow, three-button action panel).
- View-source on `/`: unique title, canonical, og:title/og:description/og:url/og:image/og:image:width/og:image:height/og:image:alt, twitter:*: plus a `<script type="application/ld+json">` with `@graph` containing `FinancialService` + `Organization` + `WebSite` cross-linked by `@id`.
- View-source on `/services/cfo-advisory`: organization graph + an additional Service node with `provider: { '@id': 'http://localhost:3000#organization' }`.
- `/sitemap.xml` returns 19 URLs (unchanged from Phase 7); `/robots.txt` rules + sitemap pointer.
- After `UPDATE branding_config SET brand_name = TRIM(brand_name) WHERE id = 1` the JSON-LD `name` field no longer carries a trailing space.

**Notable detours / lessons**
- **Google Fonts via the IE UA returns WOFF, not TTF, for these families.** Initial `fonts.ts` only accepted `format('truetype')` and the route 500'd with `Could not parse TTF URL for Inter:400`. Tested four candidates by curling `fonts.googleapis.com/css2` with the IE 9 UA: `Inter`, `Source Serif 4`, `Source Sans 3`, and `Open Sans` all return `format('woff')`. WOFF is satori-compatible, so widening the regex to `(?:woff|truetype|opentype)` plus a permissive any-`url(…)` fallback is the right fix: no font swap needed.
- **`title: { absolute }` is mandatory** when `cms_pages.meta_title` already includes the brand suffix. Any helper or page that returns `title: 'X: PaceMakers Business Consultants'` would otherwise get `…X: PaceMakers Business Consultants | PaceMakers Business Consultants…` from the root template. Phase 7 fixed this on the bespoke pages; Phase 8 cements it via `buildPageMetadata`.
- **JSON-LD outside `<head>` is fine.** Schema.org / Google docs allow it anywhere in the document. Mounting `<OrganizationJsonLd />` directly in the public layout (as a server component returning a `<script>`) is simpler than threading it through `metadata.other` or a custom `<head>` insertion.
- **Two not-found files, one error boundary.** `(public)/not-found.tsx` only fires for `notFound()` calls thrown from inside that route group: needed it for `/services/bogus-slug`. The root `not-found.tsx` covers unmatched URLs anywhere on the site, including ones outside `(public)`: needed it for `/not-a-page`. The root file has to mount `NavbarServer` + `FooterServer` manually because it sits outside the public layout. The error boundary at `src/app/error.tsx` covers both groups since errors propagate up the layout tree.
- **`branding_config.brand_name` had a trailing space.** Surfaced as a cosmetic JSON-LD issue (`"name":"PaceMakers Business Consultants "`). Fixed by `UPDATE branding_config SET brand_name = TRIM(brand_name) WHERE id = 1`. Worth a `CHECK (brand_name = TRIM(brand_name))` constraint in a future migration if this happens elsewhere.

**Open items for next session: Phase 9: Content Population & Launch**
1. Populate real copy across all `cms_content` rows (header, footer, contact info, SEO defaults, the 9 service detail namespaces) and `page_sections` (hero, sector_grid, process_steps, network_partners, founder_block content for the 5 firm pages and home).
2. Configure DNS at Vercel (apex + `www` redirect), SSL provisioning verification, set production env vars (`NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `EMAIL_FROM_*`, `EMAIL_TO_ADMIN`, `HCAPTCHA_*`, Supabase service role).
3. Submit `https://pacemakersglobal.com/sitemap.xml` to Google Search Console; verify ownership via DNS TXT.
4. Apply migrations 009 (header_settings split) and 010 (service detail content) against the production Supabase project.
5. Final QA pass on every public route; confirm OG cards render correctly via the LinkedIn / Twitter card debuggers.
6. Counsel review of `/privacy` and `/terms`; remove the "Subject to legal review" badge once approved.
7. Build `/admin/contact-submissions` inbox so admin can triage form submissions.
8. Rotate `Admin@2026` to a strong production password before any deploy.

### 2026-05-03 (overnight), Phase 9 part 1: Home page production content

**Shipped**
- `supabase/migrations/011_seed_home_page_content.sql`: wraps a `BEGIN;…COMMIT;` around `DELETE FROM page_sections WHERE page_slug='home'` plus 9 INSERTs at `display_order` 10/20/30/40/50/60/70/80/90: `hero` → `founder_block` → `stats_block` → `service_cards` (What we do, 6 capabilities) → `service_cards` (Who we serve, 4 audiences) → `process_steps` (Understand/Analyse/Model/Advise) → `text_image` (Strategic Network) → `quote` (founder pull quote) → `cta_block` (Have a mandate?). Migration also bumps `cms_pages.updated_at` for `home` and merges `site_settings.settings` with `contact_email`/`admin_email`/`office_location_text` via `||` JSONB concat (preserves existing keys).
- `scripts/seed-home-page.mjs` + `node scripts/seed-home-page.mjs`: JS-side equivalent so the migration can be applied against the shared dev/prod Supabase without the SQL editor. Idempotent (DELETE-then-INSERT). Already executed: 2 placeholder rows deleted, 9 production rows inserted, site_settings merged.

**Renderer extensions: additive, preserves existing seeded content**
The user's content schema introduced fields the existing renderers didn't read (eyebrows, section-level headlines on grids, footer CTAs under sections, nested CTA shapes). Rather than dropping content, the 5 affected renderers were extended additively. Existing seeded rows continue to render unchanged because the new fields default to empty.
- `ServiceCards.tsx`: now renders `eyebrow`, section `headline`, and `footer_cta_label`/`footer_cta_href` button (centered above intro / below cards respectively).
- `ProcessSteps.tsx`: adds `eyebrow` (above heading), aliases `headline` → `heading`, adds `footer_cta_label`/`footer_cta_href` button (below steps).
- `TextImage.tsx`: adds `eyebrow` above heading; aliases nested `cta: {label, href}` → flat `cta_label`/`cta_href`.
- `FounderBlock.tsx`: adds optional centered preamble (`eyebrow` + section `headline`) above the founder card; founder `name` demoted from `<h2>` to `<h3>` so the section headline owns the h2 slot. Aliases nested `cta_primary: {label, href}` and `cta_secondary: {label, href}`.
- `CtaBlock.tsx`: aliases nested `primary_cta`/`secondary_cta` AND `cta_primary`/`cta_secondary` shapes.

**Migration's JSONB writes the canonical flat shape** (since renderer aliases now exist): `heading` (not `headline`) for process_steps; flat `cta_*_label`/`cta_*_href` for founder_block, text_image, cta_block. Future admin-edits via the page builder will read/write the canonical shape.

**Verified: same Supabase backs dev and prod**
- Migration applied: 9 rows at display_order 10..90 returned by `SELECT display_order, section_type FROM page_sections WHERE page_slug='home' ORDER BY display_order`.
- `npm run typecheck` clean.
- `curl http://localhost:3002/` → HTTP 200, ~195KB. All 9 sections present in rendered HTML (verified by string match for each section's signature copy: "PACEMAKERS BUSINESS CONSULTANTS", "LED BY THE FOUNDER", "ACCA Member (UK)", "100+", "SAR 20B+", "WHAT WE DO", "Built for transactions that need", "WHO WE SERVE", "Family Offices", "HOW WE WORK", "four-step engagement model", "STRATEGIC NETWORK", "focused network across the Gulf", "Sky Gulf", "Lynkers", "good financial model is not just", "Have a mandate to discuss").
- All 7 CTA hrefs verified: `/contact`, `/services` (×2), `/about`, `/approach`, `/network`, `mailto:info@pacemakersglobal.com`. (`Start a Conversation`→`/contact` appears 3×: navbar + hero + final cta_block.)
- Dev server log clean, no errors/warnings during home render.

**Notable choice**
- **Extending renderers vs. flattening JSONB.** User's note said "fix field name mismatches in the migration before applying," but several of the user's fields had no flat-renderer equivalent at all (eyebrows, section-level headlines on grids, footer CTAs). Dropping them would have lost real visual intent. So I extended renderers additively for the genuinely new visual primitives, and used the new aliases only as bridges where the user's nested CTA shapes carried identical info to the flat keys: meaning the migration writes the canonical flat shape (no content lost, future admin-edits stay consistent). The renderer aliases also pay forward: they're permissive against several common content shapes editors might write.

**Asset gaps for later**
- `home.founder_block.photo_url` is empty: section renders a neutral grey placeholder. Drop in a portrait when ready.
- `home.text_image.image_url` is empty: same fallback. A network/region image would lift section 70 substantially.

**Remaining Phase 9 page-content work (7 firm pages + 9 service-detail pages)**
1. `/about`: page_sections (founder bio in detail, credentials, career, philosophy)
2. `/sectors`: page_sections (sector_grid + supporting copy)
3. `/approach`: page_sections (process_steps in depth, principles, deliverables)
4. `/network`: page_sections (network_partners cards for Sky Gulf + Lynkers, why-the-network rationale)
5. `/financial-modeler-pro`: page_sections (fmp_intro + value-prop blocks + cross-link CTA)
6. `/services`: overview page_sections (intro + sector context above the config-driven 9-card grid)
7. `/contact`: page_sections (intro/eyebrow + commitment-to-respond copy above the form)
8. `/services/[slug]` × 9: `cms_content` rows under `section='service_<slug>'` keys `full_description`, `deliverables`, `timeline_text`, `target_audience_text`. Migration 010 already seeded placeholder copy; replace with the production write-up per service.

After page content: `/admin/contact-submissions` inbox · DNS+SSL on Vercel · production env vars · sitemap to Search Console · counsel review of Privacy/Terms · rotate `Admin@2026`.

### 2026-05-04, End-of-session checkpoint

**Recap of this multi-session sprint (2026-05-03 → 2026-05-04)**
- Phase 5: Public Pages (core): public root layout with CMS-driven Navbar + Footer, fonts via `next/font`, services overview with 9-card config grid, contact form + `/api/contact`, Resend wrapper with graceful fallback, branded email shell, hardcoded Privacy + Terms.
- Phase 6: Section Types: public renderers + admin editors for the 9 outstanding section types. All 13 types now `implemented: true`.
- Phase 7: Pages: bespoke routes for /about, /sectors, /approach, /network, /financial-modeler-pro replacing the catch-all; `/services/[slug]` for the 9 service detail pages reading `cms_content` namespace `service_<slug>`; sitemap.ts + robots.ts.
- Phase 8: SEO & Polish: dynamic OG image route, shared `buildPageMetadata` helper, Schema.org `@graph` JSON-LD, branded 404 + error.tsx, fleshed-out Privacy + Terms with named processors, `next.config.ts` remotePatterns, `/admin/og-preview` admin tool.
- Phase 9 part 1: Home page production content: migration 011 + JS seed script applied to Supabase; renderers extended additively for eyebrow / section-headline / footer-CTA / nested-CTA shapes. Live page renders all 9 sections cleanly with all 7 CTAs wired correctly.
- New: **Content Style Rules** section added at top of this file (no em dashes anywhere in PMBC content). Memory note saved so it persists across future sessions.

**Open items for the next session**
1. **Review the home page on the live site** at `https://www.pacemakersglobal.com` and the `www.` apex (whichever DNS resolves) to confirm the production-Supabase data is rendering correctly through Vercel's deploy pipeline. Flag any visual issues that came from the renderer extensions.
2. **Continue Phase 9 page-by-page content population**, in order:
   1. `/about`: page_sections
   2. `/sectors`: page_sections
   3. `/approach`: page_sections
   4. `/network`: page_sections
   5. `/financial-modeler-pro`: page_sections
   6. `/services`: overview page_sections (intro/eyebrow above the config-driven 9-card grid)
   7. `/services/[slug]` × 9: replace migration 010 placeholders in `cms_content` namespace `service_<slug>` with production copy
   8. `/contact`: page_sections (intro/eyebrow + commitment-to-respond copy above the form)
3. After all page content: `/admin/contact-submissions` inbox, DNS+SSL on Vercel, production env vars, sitemap to Search Console, counsel review of Privacy/Terms, rotate `Admin@2026`.

**Style reminder for next session.** Every string drafted from now on must follow the **Content Style Rules** at the top of this file: no em dashes, no en dashes in prose. When generating section JSONB or fallback copy, scan once before saving.

**Dev server.** Stopped cleanly at end of session.

### 2026-05-04 (later), Content Style Rule enforcement (em-dash cleanup)

Single-purpose session: applied the new **Content Style Rules** retroactively across the codebase and the live database, then pushed to main.

**Database (migration 012, applied to Supabase via JS apply script that mirrors the SQL exactly)**
- `cms_pages.meta_title` × 16: `: PaceMakers Business Consultants` brand suffix replaced with ` | PaceMakers Business Consultants`. Plus the special-case home title (`PaceMakers Business Consultants: Advisory from Structure to Exit` → ` | `, em dash mid-string rather than as suffix).
- `email_templates.subject` × 2: `New contact submission: {{name}}` → `New contact submission: {{name}}`; `Thank you for reaching out: PaceMakers Business Consultants` → ` | `.
- `cms_content` × 11 across the 9 `service_<slug>` namespaces: targeted per-key `REPLACE` for the em-dash phrases in `full_description`, `target_audience_text`, and one `timeline_text`. En dashes in numeric ranges (`3–9 months`, `4–6 weeks`, etc.) preserved per the rule's number-range exception.
- `page_sections` (page_slug='home') × 7: per-section JSONB rewrites cast to text and back. Covers founder bio, service-cards "What we do" (intro + 3 card descriptions), service-cards "Who we serve" (Investment Offices), process_steps (Understand + Advise), text_image (Strategic Network), quote, and cta_block subhead.
- `page_sections` Phase 6 smoke-seed rows × 6 (tagged `styles->>smoke = 'phase6'`): em dashes stripped from /approach process_steps, /sectors sector_grid, /about founder_block + text_image, /financial-modeler-pro fmp_intro, and /service-business-valuation service_detail.

Final verification: zero em dashes remain in any content row across `cms_pages`, `cms_content`, `page_sections`, `email_templates`, and `site_settings`.

**Source files** (every place a human reader would see the string)
- Privacy + Terms hardcoded body copy: `<strong>Label</strong>: body` patterns rewritten to `<strong>Label:</strong> body`; "Subject to legal review: to be finalised" → ". To be finalised"; the parenthetical "engagement letter: and not this Website: governs" rewritten with parentheses.
- `error.tsx`: "Try again: and if the issue persists" → "Try again. If the issue persists".
- All 11 public-route `generateMetadata` `fallback.title` values: `: PaceMakers Business Consultants` → ` | `.
- All 11 admin route `metadata.title` values: `: PMBC Admin` → ` | PMBC Admin`. Plus the dynamic page-builder title (`${slug}: Page Builder` → ` | `) and admin login title.
- Fallback hero taglines on /approach and /financial-modeler-pro that contained an em dash mid-sentence.
- `EmailTemplatesEditor` `TEMPLATE_LABELS`: `Contact form: admin notification` → `Contact form: admin notification` (and acknowledgement counterpart).
- `ServiceDetailEditor`: `',  Select a service , '` → `'Select a service'`.
- Null-value placeholders rendered to admins as `', '` (admin dashboard fmt, pages-list `formatDate`, contact notification email field defaults) → `'-'` (ASCII hyphen).
- `seo/metadata.ts` and `og-preview/page.tsx` `stripBrandSuffix` regexes widened from `[, -]` to `[, |-]` so the OG title strip continues to work for legacy data and for the new `|` separator.
- Comments, JSDoc, console.warn strings, and the regex char-class itself were intentionally left alone (not user-visible).

**Seed scripts updated in lockstep with the database** so a future `node scripts/seed-…` run does not reintroduce em dashes:
- `scripts/seed-home-page.mjs`: 9 em-dash phrases rewritten to match the live home page rows exactly.
- `scripts/seed-service-content.mjs`: 11 em-dash phrases rewritten across the 9 service namespaces (mirrors migration 010 + the cleanup).
- `scripts/seed-phase6-sections.mjs`: 6 em-dash phrases rewritten in the smoke-seed rows.

**Migration file shipped, apply scripts deleted.** Migration 012 (`supabase/migrations/012_strip_em_dashes.sql`) is the source of truth. The temporary JS apply / verify / residual-patch helpers were deleted from `scripts/` after the data was applied: keeping them around would just add noise (the work is one-time and the SQL captures the full operation for any fresh project setup).

**Commit + push**
- `190a305 chore: strip em dashes from content per style rule + checkpoint CLAUDE.md`: 33 files (all source + scripts + migration 012). Bundles the previously-uncommitted CLAUDE.md additions (Content Style Rules + Phase 9 part 1 + 2026-05-04 end-of-session checkpoint) and the PROJECT_HANDOFF.md edits, since they were the last "checkpoint" content from the prior session and made sense to ship together with the cleanup.
- Pushed to `origin/main`. Vercel deploy expected to follow.

**Decision notes worth keeping**
- **Separator choice for titles**: ` | ` chosen as the brand-suffix separator. Aligns with the `template: '%s | PaceMakers Business Consultants'` already in the root layout, so all titles render with one consistent separator regardless of whether they came through the template or the absolute-title bypass.
- **Number ranges kept with en dash** (`3–5 weeks`, `4–6 weeks`, `1–2 business days`). User explicitly granted this exception ("keep them in number ranges and similar formatting use") even though CLAUDE.md's stricter form would write them out as words. The user's instruction wins for live content.
- **Why per-row REPLACE in the migration, not blanket regex**: em dashes in PMBC's content carry different roles in different sentences (mid-clause pause → comma; explanation → colon; strong break → period; parenthetical pair → parentheses). A blanket `': '` → `, ` would produce wrong copy in roughly half the cases. So each row was hand-rewritten.

**Open items for the next session**
1. **Review the home page on the live site** at https://www.pacemakersglobal.com once Vercel finishes the deploy of `190a305`. Confirm:
   - No em dashes anywhere on the rendered page (compare against the local server which already verified clean).
   - Browser tab shows `PaceMakers Business Consultants | Advisory from Structure to Exit` (the new `|` separator).
   - All 7 CTAs still resolve correctly.
   - OG card auto-generated at `/api/og?…` reflects the cleaned-up title.
2. **Continue Phase 9 page-by-page content population, starting with `/about`**: page_sections for the firm bio, founder section detail (already partially seeded as Phase 6 smoke content; replace with production copy), credentials, philosophy. Same pattern as the home page seed: write a `supabase/migrations/013_seed_about_page_content.sql` + companion `scripts/seed-about-page.mjs`, apply via the JS script, verify on `/about`.
3. After /about, the remaining Phase 9 order: /sectors, /approach, /network, /financial-modeler-pro, /services overview, /services/[slug] × 9 (replace migration 010 placeholders), /contact intro section.
4. Still pending: `/admin/contact-submissions` inbox · DNS+SSL on Vercel · production env vars · sitemap to Search Console · counsel review of Privacy/Terms · rotate `Admin@2026`.

**Style reminder, doubled down.** From here forward, every string drafted, every JSONB blob, every fallback copy line in a route file must be em-dash-free at the moment of authoring. The cleanup migration is now in the repo as both a backstop and a record, but the discipline is to never need it again.

### 2026-05-06, Migration 013: enable RLS with default-deny on all public tables

Single-purpose session triggered by Supabase's Security Advisor flagging 10 RLS-disabled errors (one per public-schema table). Resolved by enabling RLS on every table with no policies, which is Postgres default-deny. The `service_role` has BYPASSRLS, so every server-side query through `createSupabaseServerClient()` keeps working unchanged; the anon key gets locked out of all 10 tables.

**Pre-migration audit confirmed the leak was real.** Anon key was reading `admin_users` (with bcrypt password hashes), `audit_log`, and 7 other tables in full. `contact_submissions` happened to return 0 rows only because no submissions had been kept around, not because of any access control. The Security Advisor was correct.

**Source-side audit confirmed default-deny is safe to enable.** Every Supabase call in `src/` goes through `createSupabaseServerClient()` (service-role key). The browser-side helper `src/lib/supabase/client.ts` is defined but has zero call sites. The only browser-originating database write is the contact form, which POSTs JSON to `/api/contact` and the server then inserts via service role. NextAuth's session/CSRF flows do not read these tables. So locking out the anon key breaks nothing.

**Built**
- `supabase/migrations/013_enable_rls_default_deny.sql`: `BEGIN; ALTER TABLE … ENABLE ROW LEVEL SECURITY; COMMIT;` for the 10 tables: `admin_users`, `audit_log`, `cms_content`, `cms_pages`, `page_sections`, `branding_config`, `site_settings`, `contact_submissions`, `email_branding`, `email_templates`. No policies created. Idempotent (the `ENABLE` is a no-op if RLS is already on).

**Apply path: SQL editor only, not JS.** Migrations 010, 011, and 012 were applied via JS scripts that call supabase-js. Those worked because the operations were INSERT/UPDATE/DELETE (DML), which PostgREST exposes. `ALTER TABLE … ENABLE RLS` is DDL, which PostgREST does not expose. With only the service-role key in `.env.local` (no Personal Access Token, no Postgres connection string), the SQL editor in the dashboard is the only path. User pasted and ran. Temporary verifier scripts (`scripts/verify-013-rls.mjs` and `scripts/verify-013-app-writes.mjs`) were written, used, and then deleted, matching the precedent set in the 012 cleanup. Migration 013 is the single source of truth in the repo.

**Verified**
- Behavioural RLS test (anon vs service_role probes against all 10 tables): pre-migration showed anon reading 49 cms_content rows, 17 cms_pages, 31 page_sections, 10 audit_log rows, 1 admin_users row (with hash), and so on. Post-migration: anon returns 0 rows from every table; service_role still reads all 10 tables.
- App-level smoke checks against the dev server post-migration:
  - `GET /` HTTP 200, all 9 home page section signature strings present.
  - `POST /api/contact` HTTP 200, returned `{ ok: true, id: '150a894e-…' }`. Confirmed the row landed in `contact_submissions`. Cleaned up.
  - NextAuth credentials login through `scripts/smoke-admin.mjs`: login OK (admin_users SELECT + last_login_at UPDATE + audit_log INSERT all worked under service role); 10/10 reachable admin pages HTTP 200; the only 404 is `/admin/contact-submissions`, the known unimplemented placeholder.

**Commits + push**
- `a7f72e7 fix: enable RLS with default-deny on all public tables (service role bypass)`: 1 file (the migration). Pushed to `origin/main`.
- `202ad89 docs: session log update (em-dash cleanup checkpoint)`: bundles the previously-uncommitted CLAUDE.md additions describing the 2026-05-04 em-dash cleanup that landed in `190a305`. Separate commit so the RLS commit stays scoped.

**Important note for the next session: migration 013 is now the RLS migration, not the about-page seed.** The Phase 9 part 1 close-out previously suggested `013_seed_about_page_content.sql` as the next migration. That naming is no longer available. Use `014_seed_about_page_content.sql` for the next page-content seed and continue from there.

**Operational note: writing new admin users now requires server-side execution.** With RLS on, the dashboard's table-editor UI cannot insert into `admin_users` (it talks through PostgREST as the authenticated dashboard user, not service role). Use `npm run seed-admin` (after editing `ADMIN_PASSWORD` in `scripts/seed-admin.mjs`) for the password rotation that is still pending before launch. The script uses the service-role key from `.env.local`, which bypasses RLS.

**Open items for next session**
1. **Refresh Supabase Security Advisor in the dashboard and confirm the 10 RLS errors are cleared.** This is a UI step the assistant cannot do.
2. Resume Phase 9 page-by-page content population, starting with `/about` (now under migration filename `014_seed_about_page_content.sql`). After /about: /sectors, /approach, /network, /financial-modeler-pro, /services overview, /services/[slug] × 9, /contact intro section.
3. Still pending pre-launch: `/admin/contact-submissions` inbox, DNS + SSL on Vercel, production env vars, sitemap to Search Console, counsel review of Privacy + Terms, rotate `Admin@2026` via `npm run seed-admin`.

### 2026-05-06 (later), Phase 9.5: Visual Polish (boutique private bank aesthetic)

Single-purpose visual pass after the user reviewed the home page on the live site and asked for it to feel meaningfully more premium, closer to Lombard Odier / Pictet / Rothschild than a default template. Goal: institutional, considered, calm, with deliberate gold accents and editorial typography. No content schema changes; all 13 section types refactored around a unified three-variant background system.

**New design-token layer**
- `src/app/globals.css`: refreshed token palette. Primary navy is now `#153D64` (kept warm; the user explicitly rejected anything darker like `#0E2742` as too cold/blackish). Deep navy `#0F2F4F` for footers and dark sections. Cream surface `#FAF7F2` for warm alternating sections. Gold `#D4A93A` (logo gold) for hairlines and dividers. Muted gold `#B89530` for eyebrow uppercase text and secondary accents. Cream-on-navy text `#E8DDC4`. Warm border `#E8E2D6` for cream sections. New `.pmbc-display` helper class for serif display headlines (Source Serif 4, weight 600, letter-spacing -0.02em, ss01 ligatures). New `.pmbc-link-underline` for the gold underline-on-hover animation used on navbar items.
- `src/lib/public/tokens.ts` (new): `PMBC` constant + `variantStyles(variant)` helper returning `bg / text / textMuted / eyebrow / border / cardBg / cardBorder` for `'navy_deep' | 'cream' | 'white'`. Single source of truth read by every renderer.
- `src/components/public/SectionContainer.tsx` (new): shared `<SectionContainer>` (owns padding rhythm: 96-128px desktop, 64-80px tablet, 56-64px mobile; centered max-width 1200px) and `<SectionIntro>` (gold hairline + uppercase eyebrow + serif headline + body intro). Every renderer uses this instead of its own padding/heading boilerplate.

**Sequence-aware variant resolution**
- `src/components/public/SectionRenderer.tsx`: renderer signature widened to `(content, styles, variant)`. Authors can set `styles.background_variant` per section to one of three variants. New `<SectionList>` export resolves variants in sequence: when an author has not set an explicit variant and the section's default would repeat the previous one, it nudges to a contrasting variant. Hero stays `navy_deep` regardless. Per-section-type defaults: hero=`navy_deep`, founder_block=`cream`, stats_block=`white`, service_cards=`cream`, sector_grid=`white`, process_steps=`navy_deep`, network_partners=`cream`, text_image=`cream`, cta_block=`navy_deep`, quote=`white`, fmp_intro=`navy_deep`. The home page's two consecutive `service_cards` blocks ("What we do" and "Who we serve") therefore alternate cream/white automatically without DB edits.
- `src/components/public/FirmPageBody.tsx`, `src/app/(public)/{page,services/page,contact/page}.tsx`: all switched from `SectionRenderer` map to `SectionList` so firm pages benefit from the same rhythm logic.

**Section renderers (all 13 redesigned)**
- `Hero.tsx`: 88vh min-height, deep-navy radial gradient (`#173E63 → #102E4C → #0C2741`) with a 4%-opacity diagonal gold pattern overlay, 80px gold hairline above eyebrow, 72-80px desktop serif headline (40-48px mobile) at -0.02em tracking, 720px-max cream subtitle, gold-bordered CTAs that fill with gold on hover, muted-gold `ChevronDown` scroll indicator anchored bottom-center.
- `FounderBlock.tsx`: cream variant by default, photo wrapped in a thin gold border frame with an 8×8 navy accent corner at the bottom-right; when no photo is set, falls back to a tinted card with the founder's serif initials at 80px (computed from the name) instead of an empty grey rectangle. Primary CTA is now a text-link with a permanent gold underline + hover gold-arrow rather than a filled button, secondary CTA demoted to an uppercase text link.
- `StatsBlock.tsx`: 56-72px serif stat values, 40px gold hairline below each value, label in 11px small-caps below. Vertical 1px gold separators between stats on desktop (4-up grid). Variant-aware so the same renderer lights correctly on white, cream, or navy.
- `ServiceCards.tsx`: variant-aware (cream/white/navy) cards with a 2px gold top accent that thickens to 3px on hover, 28px serif gold number, 22px serif title, 15px body at 1.7 line-height, 36px (`p-9`) padding inside cards, hover lifts -2px with a 12px shadow. New section-level `eyebrow / headline / footer_cta` slots all wired through `SectionIntro`.
- `ProcessSteps.tsx`: defaults to navy_deep. 56-64px gold serif step numbers, 40px gold hairline below each, 22px white serif title, cream descriptions. Gold 1px connector line between adjacent steps on desktop (positioned at the level of the number row).
- `Quote.tsx`: 80px gold opening serif quote mark, 28px italic serif quote body at 1.5 line-height (Source Serif 4 italic), attribution block prefixed with a 40px gold hairline + small-caps name + small-caps role beneath.
- `NetworkPartners.tsx`: cream variant by default. Cards have a 2px gold top accent + thin navy side/bottom borders. Role tags are now small uppercase pills with a 1px gold border and muted-gold text instead of the earlier filled gold-tint pill. Logo placeholders show the partner name in small caps when no logo URL is set.
- `CtaBlock.tsx`: defaults to navy_deep. Editorial layout: 60px gold hairline, optional gold eyebrow, 36-52px cream serif headline, 17-18px muted-cream subhead, gold-bordered primary CTA that fills with gold on hover. New `eyebrow` field exposed.
- `TextImage.tsx`: image wrapped in the same thin-gold-border frame as `FounderBlock`. Body adopts the same 60px hairline + uppercase eyebrow + serif heading layout as other sections.
- `SectorGrid.tsx`, `FmpIntro.tsx`, `ServiceDetail.tsx`, `Paragraphs.tsx`, `Placeholder.tsx`: all converted to the variant system. `FmpIntro` and `ServiceDetail` now use the gold-top-accent card treatment for the deliverables / timeline / target-audience boxes. `ServiceDetail` headline bumped to 40-60px serif. `Placeholder` now uses dashed-gold border on a faint gold tint instead of grey-on-grey.

**Layout chrome**
- `src/components/layout/Navbar.tsx`: 80px tall (was 72), white with a faint gold-tint border that appears on scroll past 8px (`rgba(212,169,58,0.18)`), max-width 1280. Brand fallback when no logo URL is set: a 40×40 navy tile with a serif gold "PM" monogram + a serif wordmark next to it. Desktop nav uses the new `pmbc-link-underline` class so a 1px gold rule animates in beneath each item on hover. The active item gets the same rule painted permanently. CTA is navy text on white background by default; on hover it shifts to deep-navy bg with a gold border ring (handled via inline `onMouseEnter/Leave` since the navbar is a client component). Mobile drawer reflows to cream `#FAF7F2` with a 2px gold left-border on the active item.
- `src/components/layout/Footer.tsx`: moved to `#0F2F4F` deep navy. Top hairline kept and bumped to `rgba(212,169,58,0.45)`. Brand block: monogram tile + serif wordmark + 14px cream description + 40px gold hairline + italic serif tagline (Source Serif 4 italic) replacing the previous all-caps line. Column headlines in 11px small-caps gold (was white). Links cream `rgba(232,221,196,0.85)` with hover-to-white. Bottom strip border softened to `rgba(232,221,196,0.12)`; copyright in muted gold `rgba(184,149,48,0.85)`.
- `src/components/public/PageHeroFallback.tsx`: rebuilt to mirror the new hero treatment (navy_deep radial gradient, 80px gold hairline, scroll chevron, 64-72px serif headline, cream subtitle). Used by all 5 firm-page routes when the page has no `hero` section yet.

**Inline-page updates**
- `src/app/(public)/services/page.tsx`: cream-variant intro with gold hairline + muted-gold eyebrow + 48px serif headline. Service cards in the static grid now have a 2px gold top border, 28px serif gold number, 22px serif title, 36px padding, hover lift.
- `src/app/(public)/services/[slug]/page.tsx`: final navy CTA panel rebuilt to use the same radial-gradient navy hero treatment with gold-bordered primary CTA (Tailwind hover utilities, not inline `onMouseEnter`: see lessons below).

**Verified**
- `npm run typecheck` clean. `npm run build` clean: 26 routes, 9 SSG-enumerated `/services/[slug]` paths, no warnings.
- All 11 public routes returned HTTP 200 in dev (`/`, `/about`, `/sectors`, `/approach`, `/network`, `/financial-modeler-pro`, `/services`, `/services/cfo-advisory`, `/contact`, `/privacy`, `/terms`).
- Home page: all 16 content signature strings still present (no content regressions). Token density on home: gold `#D4A93A`=105 occurrences, muted gold `#B89530`=46, cream-on-navy `#E8DDC4`=29, cream surface `#FAF7F2`=14, deep navy `#0F2F4F`=15, `pmbc-display` class=33, `min-h-[88vh]` (hero)=2.
- Zero em dashes in rendered HTML on home, about, sectors, approach, network, contact (style rule preserved through every new string in the redesign).

**Notable detours / lessons**
- **Inline `onMouseEnter` / `onMouseLeave` cannot cross the server-component boundary.** The first version of the `/services/[slug]` final CTA used inline JS handlers to swap background and color on hover. That works in a client component (the navbar already uses this pattern) but throws `Error: Event handlers cannot be passed to Client Component props` on a server-rendered page. Two fixes are valid: (a) carve out a tiny client component for the button, (b) use Tailwind hover utilities instead. Picked (b): `hover:bg-[#D4A93A] hover:text-[#0F2F4F]` reads cleanly and avoids spawning a one-off client component for a styling concern. Filed away as a recurring pattern: server components, use Tailwind `hover:` classes; client components, inline handlers are fine.
- **Sequence-aware nudge logic, not blanket "alternate everything."** First instinct was to alternate cream/white/navy mechanically across every section regardless of type. That broke the intent for sections like `process_steps` (which the user wants in deep navy regardless of position) and `cta_block` (always navy). The right rule turned out to be: each section type has a default, and the resolver only nudges when an author hasn't set an explicit variant AND the default repeats the previous section. This preserved per-type intent while still producing visible rhythm. The two consecutive `service_cards` on the home page are the only place the nudge fires today.
- **Don't change the database when the renderer can do it.** The user's brief listed a per-section background variant scheme. The path of least resistance was to write a migration that bulk-updated every `page_sections.styles.background_variant`. But the renderer can pick a sensible default per section type, and the page builder UI doesn't yet expose `background_variant` as an editable field: so a DB write would (a) be invisible to the admin and (b) become divergent the moment the editor learns the field. Keeping defaults in `SectionRenderer.tsx` means the visual rhythm is automatic everywhere, immediately, and there's a single place to override later when the page builder adds the control.
- **Logo missing → monogram fallback, not a grey box.** `branding_config.logo_url` is empty in dev. Old navbar/footer rendered a serif wordmark only. The redesign adds a small navy-with-gold-PM monogram tile alongside the wordmark so the brand block has visual weight even before the real logo is uploaded. Same idea for `FounderBlock` (serif initials in a tinted card): placeholder content should still feel composed.
- **`min-h-[88vh]` over `100vh` for the hero.** A full viewport hero on a credibility site reads as marketing, not advisory. 88vh keeps the hero dominant but lets a sliver of the founder block peek above the fold, signalling "there's substance below." The scroll chevron at the bottom-center reinforces that.
- **Why `#153D64` and not `#0E2742`.** User explicitly said the darker option reads as blackish/cold and rejected it. `#153D64` keeps the warmth that pairs correctly with the gold and cream tokens. `#0F2F4F` (the deep variant for footer / hero gradient edges) is only one notch deeper, not the cold near-black.

**Status**
- Not committed at end of session. Working tree has 26 modified files + 2 new files (`src/lib/public/tokens.ts`, `src/components/public/SectionContainer.tsx`). User asked to review the changes and a list of test URLs before committing. No content schema changes; all existing seed data still renders.

**Open items for next session**
1. **Review the changes on the live site** after deploy. Confirm the home page rhythm is visible (alternating cream/white/navy bands), gold accents read as subtle but present, hero is dominant without feeling marketing-y, no template-default sections.
2. **Commit when satisfied.** Suggested message: `feat: Phase 9.5 visual polish (boutique private bank aesthetic)`. Bundle the CLAUDE.md + PROJECT_HANDOFF.md updates in the same commit since they describe the visual work.
3. **Asset gaps**: `branding_config.logo_url` (real PMBC logo, currently rendering monogram fallback in navbar/footer), `home.founder_block.photo_url` (Ahmad portrait, currently rendering serif-initials fallback), `home.text_image.image_url` (network/region image), `network` page partner logos. The renderers handle each absence gracefully but adding the real assets is the obvious next visual upgrade. Add the host(s) to `next.config.ts` `images.remotePatterns` if uploading to a domain not already configured (Supabase host + cloudinary already there).
4. **Resume Phase 9 page-by-page content population**, starting with `/about` (migration `014_seed_about_page_content.sql`).
5. **Optional follow-up**: expose `background_variant` as a per-section field in the page builder UI (`SectionEditorPanel`) so admins can override the default rhythm if needed. Not required for launch: the defaults are sensible and the resolver fills in the gaps.
6. Still pending pre-launch: `/admin/contact-submissions` inbox, DNS + SSL on Vercel, production env vars, sitemap to Search Console, counsel review of Privacy + Terms, rotate `Admin@2026` via `npm run seed-admin`.

### 2026-06-01, Docs: split session log out of CLAUDE.md

Single small change to cut recurring context cost. `CLAUDE.md` (loaded into context every session) had grown to 1,547 lines, roughly a third of it the chronological Session Log. Moved the entire Session Log verbatim into this file (`SESSION_LOG.md`, not auto-loaded) and left a short pointer under the `## Session Log` heading in `CLAUDE.md`. No content lost: `CLAUDE.md` dropped to ~1,026 lines and now holds only the architectural source-of-truth (sections 1 to 15, Current Status table, Content Style Rules). New session-log entries (like this one and the one below) are appended here, not to `CLAUDE.md`.

### 2026-06-01, Phase 9: firm-page + intro content population (about, sectors, approach, network, FMP, services, contact)

Continued Phase 9 page-by-page content population from where the prior session left off (home page was already done). Shipped production `page_sections` content for the seven remaining CMS-driven pages, and verified the nine service-detail pages render from their existing migration-010 content.

**Pattern (unchanged from the home/about seeds):** each page gets a numbered migration `supabase/migrations/0NN_seed_<page>_page_content.sql` plus a companion `scripts/seed-<page>-page.mjs`. The migration is the source of truth for fresh project setup; the JS script is what actually applied the rows against the shared Supabase (only the service-role key is in `.env.local`, and these are DML INSERT/UPDATE/DELETE which PostgREST exposes, so no SQL-editor step needed). All scripts are idempotent (DELETE all rows for the slug, then INSERT). Each script bumps `cms_pages.updated_at`.

**Migrations + scripts shipped**
- `014_seed_about_page_content.sql` / `seed-about-page.mjs`: 7 sections: hero, text_image (the firm), stats_block, founder_block (Ahmad Din, detailed bio, links out to FMP full bio), quote, text_image (network reach), cta_block. Replaced the 4 prior rows (Phase 6 smoke founder_block + text_image among them).
- `015_seed_sectors_page_content.sql` / `seed-sectors-page.mjs`: 4 sections: hero, sector_grid (9 sectors mapped to the track record in CLAUDE.md §15 #3 plus the family-office audience), text_image (why sector depth matters), cta_block. `icon_name` values are keys from `src/lib/cms/sectorIcons.tsx`.
- `016_seed_approach_page_content.sql` / `seed-approach-page.mjs`: 5 sections: hero, process_steps (Understand / Analyse / Model / Advise, deeper than the home version), text_image (what stays constant), quote, cta_block. "Analyse" keeps the British spelling used for the canonical methodology repo-wide.
- `017_seed_network_page_content.sql` / `seed-network-page.mjs`: 4 sections: hero, network_partners (Sky Gulf in Al Khobar as "Execution Partner", Lynkers in Manama as "Equity Shareholder"), text_image (why the network matters), cta_block. Partner website URLs are unknown, so `link` and `logo_url` left empty rather than fabricated.
- `018_seed_fmp_page_content.sql` / `seed-fmp-page.mjs`: 4 sections: hero, fmp_intro, text_image (the PMBC / FMP relationship), cta_block. Per the cross-property rule (CLAUDE.md §13), primary CTAs link to `https://www.financialmodelerpro.com` (4 outbound links on the page).
- `019_seed_services_page_content.sql` / `seed-services-page.mjs`: 1 section: hero only. The `/services` route renders CMS sections ABOVE a static, config-driven "Practice Areas" 9-card grid that carries its own heading, so a hero is the only fitting CMS section (a trailing cta_block would render in the wrong place, before the grid).
- `020_seed_contact_page_content.sql` / `seed-contact-page.mjs`: 1 section: hero only, CTA buttons intentionally omitted because the static form sits directly below the hero. Same above-the-static-section structure as `/services`.

**Service-detail pages (`/services/[slug]` x 9): kept existing content, not rewritten.** The copy seeded by migration 010 (full_description / deliverables / timeline_text / target_audience_text per `service_<slug>` namespace) is already substantive, accurate, production-grade writing, not lorem placeholder. Rewriting all nine would risk inventing specifics for marginal gain, so I left it and verified instead: all 9 render with the deliverables / timeline / who-it's-for panels, and `/services/bogus-slug` 404s. The en dashes in timeline ranges (`4-6 weeks` style) are the explicitly-allowed number-range exception, not a style violation.

**Content discipline**
- Every new string is em-dash and en-dash free per the Content Style Rules (verified: 0 em dashes in the rendered HTML of all seven new pages and all nine service pages).
- No invented credentials. All founder / firm / track-record claims (ACCA Member UK, FMVA-certified, 12+ years, founded 2017, the ACWA Power Central Asia / Saudi Aramco / multi-billion riyal real estate mandates, the SAR stat figures, Sky Gulf / Lynkers) are reused verbatim from facts already in the repo (home-page founder block, `OrganizationJsonLd`, network seed). Full professional bio linked out to FMP, not duplicated (CLAUDE.md §4 / §13).
- Asset gaps unchanged and handled by graceful fallbacks: founder photo, text_image / network images, partner logos all empty, rendering monogram / initials / framed-placeholder fallbacks.

**Verified**
- All 19 public routes return HTTP 200 (home, about, sectors, approach, network, financial-modeler-pro, services, the 9 service details, contact, privacy, terms).
- 0 em dashes across every new page's rendered HTML.
- Per-page signature-string checks passed; CTA hrefs resolve; FMP cross-links and founder-bio outbound link correct.
- Verification done against the local dev server (`npm run dev`, port 3000) by curling each route. No `.tsx`/`.ts` source changed this session (only `.mjs` seed scripts and `.sql` migrations), so typecheck / build baseline is unchanged from Phase 9.5.

**Decisions worth keeping**
- **Renderer-shape-first content.** Before writing each page I read the matching renderer (`Hero`, `TextImage`, `StatsBlock`, `FounderBlock`, `Quote`, `CtaBlock`, `SectorGrid`, `ProcessSteps`, `NetworkPartners`, `FmpIntro`, `ServiceDetail`) and wrote the canonical flat field shape each expects (e.g. `heading` not `headline` for process/sector grids, flat `cta_primary_label` / `cta_primary_href` for founder/cta). The renderers still alias legacy shapes, but seeding canonical keeps future admin-edits consistent.
- **One hero for `/services` and `/contact`, nothing more.** Those two routes append their own static section after the CMS `SectionList`, so any CMS section renders above it. Only a header (hero) belongs there; a closing CTA would land mid-page. Documented in both migration headers.
- **Kept the dev server convention:** verified via curl against `npm run dev`, did not run `npm run build` while dev was live (the documented `.next` clobber hazard).

**Open items for next session**
1. **Review the new firm-page copy on the live site after deploy**, especially the `/about` founder bio and the reused track-record claims now also on `/sectors`. They describe a real person and firm; confirm accuracy. If any service-detail write-up should be refreshed, name it and it can be rewritten.
2. **Migrations 014 to 020 were applied via the JS seed scripts against the shared Supabase.** The SQL files are the source of truth for a fresh project setup. Nothing further to apply for the current database.
3. Phase 9 launch operations still pending (not content): `/admin/contact-submissions` inbox, DNS + SSL on Vercel, production env vars, submit sitemap to Search Console, counsel review of Privacy + Terms, rotate `Admin@2026` via `npm run seed-admin`.
4. Asset uploads remain the obvious next visual upgrade: real PMBC logo (`branding_config.logo_url`), Ahmad portrait (`home`/`about` founder photo), network/region images, partner logos. Add hosts to `next.config.ts` `images.remotePatterns` if not Supabase/Cloudinary.

### 2026-06-01, Admin contact-submissions inbox (last buildable Phase 9 feature)

Built the `/admin/contact-submissions` inbox, the only remaining unbuilt feature in the spec. The public contact form has written to `contact_submissions` since Phase 5, but the admin route was a 404 placeholder, so submissions had no triage UI. CLAUDE.md §6 scope: list, view, change status (`new` / `read` / `responded` / `archived`), add internal notes.

**Built**
- `src/app/api/admin/contact-submissions/route.ts`: session-gated (`getAdminSession`, 401 if absent). GET lists rows (optional `?status=` filter, newest first), returns `{ rows }`. PATCH (with POST alias, matching the other admin routes) updates one submission by id: zod-validated body `{ id (uuid), status?, notes? }`, refined to require at least one of status/notes. Reads the current row first (404 if missing), then computes first-touch timestamps: `read_at` stamped once when status leaves `new`, `responded_at` stamped once when status becomes `responded`; neither is ever overwritten. Blank/whitespace notes are stored as `null`. Writes an `audit_log` row (`entity_type='contact_submission'`, with status_from/status_to/notes_changed metadata). Returns `{ row }`.
- `src/app/admin/contact-submissions/page.tsx`: server component, `force-dynamic`, robots noindex. Loads all submissions server-side (graceful try/catch into `{ rows, error }`), computes the new-count for the header, renders `AdminPageHeader` + the client component.
- `src/components/admin/ContactSubmissionsClient.tsx`: `'use client'` master-detail. Status filter tabs (All / New / Read / Responded / Archived) with per-status counts, a Refresh button (re-fetches the list), and a transient toast. Left pane is a scrollable list (name, email, 2-line message clamp, status badge, date; new rows bold with a gold left-border when selected). Right pane is the detail: all fields in a responsive grid, full message in a pre-wrap block, a status `<select>`, the first-read / responded timestamps, an internal-notes textarea, and a "Save changes" button (disabled until dirty). A "Reply by email" `mailto:` link prefills the subject. Selecting a `new` submission auto-marks it read (fires a PATCH on open; non-fatal if it fails). Responsive via flex-wrap (no media queries), all styling from `src/lib/admin/styles.ts` inline tokens.
- `src/app/admin/page.tsx`: dashboard "Recent Contact Submissions" card had a stale "will be wired up in a later phase" line. Replaced with a live new-count message + an "Open inbox" link to the new route.

The sidebar already carried the "Contact Submissions" link (`CmsAdminNav.tsx`), so no nav change was needed; its prefix-match activation lights it on this route automatically.

**Verified**
- `npm run typecheck` clean (twice: after the feature, and after the dashboard edit).
- Unauthenticated gating: `/admin/contact-submissions` -> 307 redirect to login; API GET and PATCH -> 401.
- Full authenticated end-to-end via a temporary smoke script (login via NextAuth credentials, seed a submission with the service-role client, then exercise the live API), all passed then cleaned up: authenticated page renders 200; list GET 200 and includes the seeded row; `?status=new` filter returns only new; PATCH to `responded` sets status, stamps both `read_at` and `responded_at`, and saves notes; blank notes store as `null`; an empty patch (no status/notes) is rejected 422; `audit_log` rows are written. Temp script deleted after use, per the repo precedent for one-off verifiers.

**Decisions worth keeping**
- **Read-then-update in the API** so first-touch timestamps are stamped exactly once and never overwritten, and so a missing id returns a clean 404. Returning the updated row lets the client patch its local state without a refetch.
- **Auto-mark-read on open** (not on hover/scroll) keeps the `new` count meaningful as a real "needs first attention" signal, and is the natural use of `read_at`. Kept non-fatal so a failed PATCH never blocks reading the message.
- **Service-role bypass is the whole reason this works under RLS** (migration 013). All reads/writes go through `createSupabaseServerClient()`; the anon key cannot touch `contact_submissions`.

**This closes the buildable side of Phase 9.** Everything still open is ops/review only: production env vars on Vercel (so the contact form actually emails via Resend), DNS + SSL, submit sitemap to Search Console, counsel review of Privacy + Terms, refresh Supabase Security Advisor, rotate `Admin@2026` via `npm run seed-admin`, and the copy/asset review noted above.

### 2026-06-01, Checkpoint: pausing here, launch to-do captured in CLAUDE.md

Pausing the session with all buildable Phase 9 work done (page content + contact inbox). Recorded the remaining launch tasks as a **"Remaining Before Launch (next to do)"** checklist directly in `CLAUDE.md` (right under the Current Status table), so the next session sees it without having to open this log. Each item is tagged with who owns it (user / assistant). Also updated the Phase 9 status row to mark the inbox complete.

**Next-session pickup order (full detail in the CLAUDE.md checklist):**
1. Production env vars on Vercel (Resend, hCaptcha, NextAuth, Supabase, site URL): without Resend the inbox still captures submissions but no emails send.
2. Rotate `Admin@2026` via `npm run seed-admin` (assistant can set the password in the script first).
3. DNS + SSL for `pacemakersglobal.com`.
4. Counsel review of `/privacy` + `/terms`, then remove the "Subject to legal review" badge.
5. Post-deploy: submit sitemap to Search Console, refresh Supabase Security Advisor (migration 013), verify OG cards, review live copy (`/about` bio + `/sectors` claims).
6. Asset uploads (logo, founder photo, network image, partner logos) with `next.config.ts` host additions if needed.

No code or schema changed in this checkpoint; docs only (`CLAUDE.md` + this entry).

### 2026-07-30, Phase 11: FMP-parity admin structure, route fixes, palette retune

> **Log gap note:** the two 2026-06-10 sessions (Phase 10 advisory collections, and the page-builder auto-save + FMP-parity settings fix) were never written up here; they are captured in the `CLAUDE.md` Current Status table and in commits `d9bf27f` and `1488250`. This entry resumes the log.

Started as a status check, became a structural fix. Three things were wrong or divergent from FMP, plus a palette that read badly on the live site.

**Route fixes (the actual bug)**
`/admin/page-builder` returned 404: the folder contained only `[slug]/`, no `page.tsx`. The sidebar's own "Page Builder" entry therefore pointed at a dead route, and the CMS pages list lived at `/admin/pages` instead. Fixed by mirroring FMP's split:
- `src/app/admin/page-builder/page.tsx` (new). The CMS pages list: slug, title, status, section count, last updated, Builder button per row. Same table markup that was at `/admin/pages`.
- `src/app/admin/pages/page.tsx` (rewritten). **Pages & Nav**, a navigation-menu editor only. Built on the existing `CollectionManager` so it inherits the field-driven list, reorder, and drawer editor from the Phase 10 collections rather than hand-rolling a fourth nav editor.
- `src/app/api/admin/site-pages/route.ts` (new): session-gated, zod-validated, audit-logged CRUD through `createCollectionApi`.
- `src/app/admin/leads/page.tsx` (new): redirect to `/admin/contact-submissions`, so the `/admin/leads` alias in the sidebar's `matchPaths` resolves instead of being dead config.
- `supabase/migrations/027_site_pages_nav.sql` (new): `site_pages` (label, href, display_order, visible), RLS default-deny per the 013 pattern, seeded from the existing `(header_settings, nav_items)` JSON array via `jsonb_array_elements ... WITH ORDINALITY` so order is preserved, with a hardcoded six-item fallback. Seed guarded by `WHERE NOT EXISTS`, so re-running is a no-op.

**Navbar source of truth**
PMBC drove the navbar from a single `cms_content` row edited at `/admin/header-settings`. Promoting the nav to `site_pages` without touching that editor would have given the navbar two writers, so:
- `fetchHeaderConfig()` now reads `site_pages` first, then the legacy JSON row, then `DEFAULT_HEADER_CONFIG`. The legacy row is deliberately **left in place, not dropped**. A partially-applied migration can never produce a navbar with no links.
- The nav-item editor (dnd-kit list, ~120 lines) was removed from `HeaderSettingsForm`, which now owns only the header CTA and the mobile toggle. That matches FMP, where header-settings is branding/header and Pages & Nav owns `site_pages` (`CMS_REFERENCE.md` §1, rows 32 and 34). Both pages cross-link so the split is discoverable.
- `nav_items` became **optional** in `/api/admin/header-settings` rather than being deleted, and is only written when supplied, so an older client or a manual call can still refresh the fallback row.

**Sidebar regrouped** to FMP order: Dashboard, then Content (Page Builder, Header Settings, Header & Branding, Page Content, Pages & Nav, Insights, Testimonials, Media Library, OG Previews), Collections, Leads, Email, System. Removed the stale `matchPaths: ['/admin/page-builder']` from Pages & Nav (it now has its own item), added `/admin/leads` to Inquiries, and gave OG Previews its own icon (it shared `ImageIcon` with Media Library).

**Palette retune** (§9): primary navy `#153D64` to `#1B3A5F`, deep navy `#0F2F4F` to `#14304F`, gold `#D4A93A` to `#C69C3E`, muted gold `#B89530` to `#A88530`, cream unchanged. Applied across `globals.css`, `tokens.ts`, all 13 section renderers, Navbar/Footer/PageHeroFallback, the public pages, `/api/og`, and `branding_config` + `email_branding` (migration 028). 32 files, ~164 hex occurrences.

**Verified**
- `npm run typecheck` and `npm run build` both clean; `/admin/page-builder`, `/admin/pages`, `/admin/leads`, `/api/admin/site-pages` all registered.
- All **20 sidebar destinations 200** authenticated, zero 404s. All **14 public routes 200**. Navbar renders the same six items, now from `site_pages`.
- Full CRUD round-trip on a throwaway row: 401 unauth, 422 invalid, create, update, **confirmed the new item reached the live public navbar**, delete. `site_pages` restored to exactly 6 rows, 3 `audit_log` entries written.
- Post-migration re-verify (user applied 027 + 028 in the Supabase dashboard): 6 rows no duplicates, anon key returns 0 rows so RLS is enforced, `branding_config` matches 028.
- Rendered HTML: **0 old colour values, 0 em dashes**; OG card 200.

**Decisions worth keeping**
- **Reuse `CollectionManager` for the nav editor.** A nav menu is a reorderable list of rows, which is exactly what the Phase 10 collection infrastructure already does. Writing a bespoke editor would have been a fourth implementation of drag-reorder in this repo.
- **Fallback chain over a hard cutover.** Repointing the navbar at a brand-new table is the kind of change that silently empties a header in production. Reading `site_pages` then the old row then the hardcoded default means the worst case is stale nav, never no nav.
- **The hero gradient was the real "too dark" complaint.** Its stops were `#173E63` / `#102E4C` / `#0C2741`, the darkest well below even the old primary, so swapping only the four named tokens would not have fixed the impression. Re-anchored to `#1F4269` / `#1B3A5F` / `#14304F`. Flagged separately at review time because it exceeded the literal request.
- **`rgba()` equivalents must be swapped alongside the hex.** The golds also appear as `rgba(212,169,58,…)` and `rgba(184,149,48,…)` in 14 places; a hex-only find/replace would have left half the accents on the old colour.
- **Kept the admin console's structural palette isolated but updated its accent gold.** `CLAUDE.md` isolates admin styling from the public theme, but the gold *is* the brand accent, so leaving the sidebar on `#D4A93A` would have visibly diverged. Sidebar navy `#0F2540` and `#1B4F8A` untouched.
- **Kept a Collections group the brief omitted.** The requested sidebar order listed no Services / Case Studies / Team & Advisors; those are PMBC-only Phase 10 pages with no FMP counterpart (FMP has Modeling Hub / Training Hub there). Dropping them would have orphaned three working pages, so they were grouped rather than deleted.

**Environment note:** a second checkout at `D:\PMBC - Cursor\PMBC-site` was running a dev server on port 3000 that hung mid-session; verification ran on a separate server on port 3100 from `D:\PMBC\PMBC-site`. The hung process was killed at end of session. Both checkouts were at the same commit.

**Still open (unchanged by this session):** production env vars on Vercel, rotate `Admin@2026`, DNS + SSL, counsel review of `/privacy` + `/terms`, submit sitemap to Search Console, refresh the Supabase Security Advisor, real assets (logo, founder photo, network image, partner logos), and content for the four empty Phase 10 collections. Two inquiries are still sitting unread in `/admin/contact-submissions`, one of which looks genuine (dated 2026-06-21).

### 2026-07-30, Checkpoint: closing for the day

Phase 11 shipped and pushed (`e6105ab`), then a documentation sweep to clear staleness the refactor exposed.

**Docs corrected this pass**
- `CLAUDE.md` §6 admin route table: `/admin/pages` was still documented as "List all CMS pages with edit links", which was the bug Phase 11 fixed. Now lists `/admin/page-builder` as the pages list and `/admin/pages` as Pages & Nav.
- `CLAUDE.md` admin-styling section: still claimed gold `#D4A93A`. Corrected to `#C69C3E`, with a note that the admin/public isolation rule is about structural colors, not the shared brand accent.
- `CLAUDE.md` `branding_config` DDL block: added a note that the `#D4A93A` column default is the original 003 value and migration 028 retunes the live row, so a fresh 003-then-028 run lands on the current palette. The default itself is left alone because applied migrations are never edited.
- `CLAUDE.md` Phase 9.5 status row: marked its palette values superseded by Phase 11 while noting the structure it introduced still stands. History kept, not rewritten.
- `CLAUDE.md` launch checklist: re-dated to 2026-07-30 and added the unread-inquiries item.
- `PROJECT_HANDOFF.md`: the status paragraph was badly stale, claiming "Phases 1 through 8 complete; Phase 9 in progress" as of 2026-05-06, listing the old palette, and listing work as remaining that has since shipped (all page content, the contact inbox). Rewritten to cover Phases 1 to 11 and the real remaining list.
- `SESSION_LOG.md`: historical colour references in the Phase 9.5 and earlier entries were deliberately **left as-is**. They are an accurate record of what those sessions did; only forward-looking documents were updated.

**State at close**
- `main` clean and pushed, local and remote HEAD equal.
- Typecheck and build clean; 20 admin routes and 14 public routes verified 200 earlier in the session.
- Migrations 027 and 028 applied to Supabase by the user and re-verified: `site_pages` at exactly 6 rows with no duplicates, anon key blocked by RLS, `branding_config` on the new palette.
- The hung dev server on port 3000 (the `D:\PMBC - Cursor` checkout) was killed; both 3000 and 3100 are free.

**Two Phase 11 choices left open for review** (both shipped, both a small revert if unwanted):
1. The **Collections sidebar group** (Services, Case Studies, Team & Advisors) was kept even though the brief's sidebar order omitted it, because deleting it would orphan three working Phase 10 pages that have no FMP counterpart.
2. The **hero gradient re-anchor** (`#1F4269` / `#1B3A5F` / `#14304F`) exceeded the four named tokens. It was the actual cause of the "renders too dark" complaint, since the old stops bottomed out at `#0C2741`, but it is a judgement call best confirmed by eye on the deployed site.

**Next session pickup:** the launch checklist in `CLAUDE.md`, in order. Nothing in the codebase is blocking. First code-touching item is likely removing the "Subject to legal review" badge once counsel signs off, or wiring real assets once provided.
