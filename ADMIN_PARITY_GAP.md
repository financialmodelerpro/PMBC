# PMBC vs FMP Admin: Parity Gap Report

**Purpose:** Establish what would have to change for PMBC's admin console to match FMP's, so switching between the two projects requires no re-learning.
**Status:** Original audit, retained as written. Phases 1 to 7 have since been implemented (see the status update below).
**Date:** 2026-08-01
**Scope:** Admin only. Public content and public routes are out of scope and untouched.

> **STATUS UPDATE 2026-08-01: phases 1 to 7 are implemented and shipped.** This document is kept as the original audit, so the findings below describe the state *before* the work, not the state now. What changed:
>
> | Item | Then | Now |
> |---|---|---|
> | Header Settings | LAYOUT and DATA MODEL both MISSING | Consolidated, seven cards, one Save All |
> | Page Builder list | No create, no delete | New Page modal with 5 templates, delete guarded by `is_system` |
> | Page Builder save | One global Save | Per-section Save with per-section dirty tracking |
> | StyleEditor | MISSING | Shipped, layered over the variant system |
> | RichTextEditor | Half the toolbar | Colour, size, link, image, alignment, H1 to H3 |
> | RichTextarea | MISSING | Shipped, wired into 7 short fields |
> | AuditLogViewer | MISSING | Shipped with filters, paging and before/after diffs |
> | Save button colour | Navy | Green `#2EAA4A`, semantics only (palette option C) |
> | Unsanitised HTML (S1) | 8 sites | 0. All 10 sites routed through `lib/cms/sanitize.ts` |
>
> **Still outstanding:** parity 8 (Testimonials approval workflow, Pages & Nav inline edit), and the two items in section 6 deliberately left alone (per-field `VF`/`ItemVF` wrappers, and section-type parity, both judged wrong for PMBC). See `SESSION_LOG.md` for the per-phase record.

---

## 0. Method and source caveats

Three sources, in descending order of reliability:

1. **PMBC's actual code**, read directly. Fully reliable.
2. **`PMBC from FMP/`**, which contains FMP's real admin components copied verbatim (`CmsAdminNav.tsx`, `MediaPicker.tsx`, `RichTextEditor.tsx`, `RichTextarea.tsx`). Reliable for the components it carries.
3. **`CMS_REFERENCE.md`**, FMP's written spec. Used for everything the copied tree does not carry.

Two caveats that affect how hard to lean on source 3:

- Its own header says **"Reference only, no behavioral contract."**
- It is a **snapshot dated 2026-05-02**, roughly three months stale. FMP has almost certainly moved since.

Where the doc is the only source for a behaviour, the finding is marked **[doc-only]** and should be confirmed against FMP's live code before any fix is built on it.

**One structural fact that limits "exact" matching:** FMP's admin has 40 nav destinations across Dashboard, Content, Modeling Hub, Training Hub, and System. Modeling Hub and Training Hub (24 destinations: courses, students, certificates, cohorts, live sessions, assessments, pricing, analytics) have **no PMBC counterpart and never will**, because PMBC sells advisory, not training. Conversely PMBC has Collections, Leads, and Email groups that FMP has no equivalent for. Exact sidebar parity is not achievable; **structural and behavioural parity is.**

---

## 1. Summary matrix

`MATCH` = same behaviour. `PARTIAL` = present but differs. `MISSING` = not present.

| # | Page | Route | Layout | Save | Data model | Styling |
|---|---|---|---|---|---|---|
| 1 | Dashboard | **PARTIAL** | **PARTIAL** | MATCH | **PARTIAL** | MATCH |
| 2 | Page Builder list | MATCH | **PARTIAL** | **MISSING** | MATCH | MATCH |
| 3 | Page Builder editor | MATCH | **PARTIAL** | **PARTIAL** | **PARTIAL** | MATCH |
| 4 | Header Settings | MATCH | **MISSING** | **PARTIAL** | **MISSING** | MATCH |
| 5 | Page Content | MATCH | **PARTIAL** | MATCH | MATCH | MATCH |
| 6 | Pages & Nav | MATCH | **PARTIAL** | **PARTIAL** | MATCH | MATCH |
| 7 | Articles list + editor | **PARTIAL** | **MISSING** | **PARTIAL** | **PARTIAL** | MATCH |
| 8 | Testimonials | MATCH | **PARTIAL** | **PARTIAL** | **PARTIAL** | MATCH |
| 9 | Media Library | MATCH | MATCH | MATCH | **PARTIAL** | MATCH |
| 10 | Site Settings | MATCH | **PARTIAL** | MATCH | MATCH | MATCH |
| 11 | Audit Log | MATCH | **PARTIAL** | MATCH | **PARTIAL** | MATCH |
| 12 | Sidebar | MATCH | MATCH | n/a | n/a | **PARTIAL** |

Counting cells: 17 MATCH, 26 PARTIAL, 5 MISSING (route column excluded from the tally where n/a).

**The five MISSING cells are the real work:** Page Builder list has no create-page flow, Header Settings has lost its entire branding surface to a separate page, and the Articles editor is a generic drawer rather than a full-page form.

---

## 2. Page-by-page detail

### 1. Dashboard

FMP `/admin/cms` · PMBC `/admin`

| Dimension | Verdict | Detail |
|---|---|---|
| Route | **PARTIAL** | FMP's dashboard is at `/admin/cms`; `/admin` is FMP's login. PMBC inverts this: `/admin` is the dashboard, `/admin/login` is login |
| Layout | **PARTIAL** | FMP: 4 KPI cards (auto-fit 200px grid), then Quick Actions row, then Recent Sign-ups table. PMBC: 5 lead KPIs, then Recent Inquiries table, then Quick Actions, then a Collections counts row. Same vocabulary, different order and count |
| Save | MATCH | Both read-only |
| Data model | **PARTIAL** | FMP reads `users`, `articles`, `courses`, `projects`. PMBC reads `contact_submissions`, `cms_pages`, `page_sections`, plus the five collections. The tables differ because the businesses differ. Both degrade to `0`/`null` on failure rather than throwing, which is the behaviour that actually matters |
| Styling | MATCH | KPI card 20px/24px padding, radius 12, 36×36 icon tile, 32px/800 value. Matches §7.3 |

**To match:** move the dashboard to `/admin/cms` and add a `/admin` redirect, then reorder the body to KPIs, Quick Actions, recent-activity table. The KPI *subjects* should stay PMBC's (leads, not sign-ups); matching those would mean inventing metrics PMBC does not have.

---

### 2. Page Builder list

`/admin/page-builder` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Fixed in Phase 11. Identical path |
| Layout | **PARTIAL** | Both are a table of pages. FMP columns: slug, title, status, system flag, created. PMBC columns: title, slug, status, section count, Builder link. PMBC shows section count (FMP does not) and omits `is_system` and `created` |
| Save | **MISSING** | **FMP has a "New Page" modal with 5 templates** (`blank`, `landing`, `about`, `services`, `contact`), each seeding a starter section list via `POST { action: 'create_page' }`. **PMBC has no create-page flow at all.** Pages can only be created by SQL. There is also no delete |
| Data model | MATCH | Both read `cms_pages`. PMBC additionally counts `page_sections` per slug |
| Styling | MATCH | `adminTable` matches §7.3 table spec: `#F9FAFB` thead, uppercase 11px/700 th, 13px td |

**To match:** add the New Page modal with the 5 templates and `action:'create_page'` on `/api/admin/page-sections`, add `is_system` and `created` columns, and add delete that blocks system pages. Slug validation `/^[a-z0-9-]+$/`. This is the single largest functional gap in the list view.

---

### 3. Page Builder editor

`/admin/page-builder/[slug]` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Identical |
| Layout | **PARTIAL** | **FMP is two-pane** (320px draggable rail + right editor pane), with `Preview ↗` opening the public route in a new tab, explicitly **no iframe**. **PMBC is three-pane**: 280px rail, editor column, and a live **iframe preview** pane that re-keys after every save. PMBC also has an "Open preview" link. Rail width differs (280 vs 320) |
| Save | **PARTIAL** | Reorder auto-saves on drag release in both: **MATCH**. But FMP has a **per-section Save button**; PMBC has **one global Save** that POSTs every section at once. Visibility toggle: FMP is local-only until you open that section and save; **PMBC persists it immediately** via `action:'set_visibility'`. PMBC adds a `beforeunload` guard and an "Unsaved changes" pill, which FMP does not have |
| Data model | **PARTIAL** | Same tables (`cms_pages` + `page_sections`, `content`/`styles` JSONB). But **FMP has 21 section types; PMBC has 13**, and they barely overlap by name (FMP `cards`/`columns`/`faq`/`pricing_table`/`timeline`/`logo_grid`/`countdown`/`video`/`embed`/`spacer`/`banner` vs PMBC `sector_grid`/`process_steps`/`network_partners`/`founder_block`/`fmp_intro`/`service_detail`). DnD library differs: `@hello-pangea/dnd` vs `@dnd-kit` |
| Styling | MATCH | Sticky white header bar, `#F4F7FC` editor column, card radius 12 / padding 20. Consistent with §7 |

**Three sub-gaps worth separating:**

**3a. StyleEditor: MISSING.** FMP renders a `StyleEditor` under *every* section, editing the `styles` JSONB: background colour, background image with overlay, text colour, padding T/R/B/L, max-width, border radius, animation (`none`/`fade-in`/`slide-up`), custom CSS class. **PMBC has no styles UI whatsoever.** `SectionEditorPanel` receives only `content`; `styles` is round-tripped but never editable. PMBC's renderers read exactly one style key (`background_variant`), set only by SQL today.

**3b. Per-field visibility wrappers: MISSING.** FMP wraps every editor field in `VF` / `ItemVF` / `ItemBar`, writing `{field}_visible`, `{field}_width`, `{field}_align` into the content JSONB, plus per-array-item `visible` and delete. Grepping PMBC's 13 editors for `_visible`, `_align`, `_width` returns **zero hits**. This is the deepest behavioural difference in the whole comparison: in FMP an admin can hide or realign any individual field on any block without touching code. In PMBC they cannot.

**3c. SEO panel: MISSING.** FMP's builder header has an SEO toggle opening a yellow-banner panel with its own Save, writing `cms_pages.seo_title` / `seo_description`. PMBC has no SEO editing in the builder; the nearest equivalent is `/admin/og-preview`, which only sets `og_image_url`.

**To match:** (a) build a `StyleEditor` and wire `styles` through `SectionEditorPanel`; (b) build the `VF`/`ItemVF`/`ItemBar` wrappers and retrofit all 13 editors, plus teach every public renderer to honour the new keys (this is the expensive one, it touches both halves of the app); (c) add the SEO panel; (d) switch to per-section Save and make the visibility toggle local-until-save; (e) decide on the preview question below. Section-type parity is *not* recommended, see §6.

---

### 4. Header Settings

`/admin/header-settings` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Identical path |
| Layout | **MISSING** | **The biggest divergence in the report.** FMP: single column, max-width 680px, five white cards, Brand Colors · Logo · Branding Text · Header Icon · Header Layout. **PMBC: two cards, "Call to action" and "Mobile", four fields total.** PMBC moved all branding to a *separate* `/admin/branding` page in Phase 11 |
| Save | **PARTIAL** | Both use a single Save. But FMP's is **"Save All" at the top**, issuing `Promise.all([17 × PATCH /api/admin/content, 1 × PATCH /api/branding])`. PMBC's is **one button at the bottom** posting 4 fields to `/api/admin/header-settings` |
| Data model | **MISSING** | FMP: 17 `cms_content` rows under `section='header_settings'` **plus** `branding_config.config.{primaryColor,secondaryColor}`. PMBC: 4 discrete `cms_content` keys (`cta_label`, `cta_href`, `show_cta`, `mobile_menu_enabled`); everything else lives in the `branding_config` **table columns** (not a JSONB `config` blob) edited at `/admin/branding` |
| Styling | MATCH | `adminCard` is `#fff` / 1px `#E5E7EB` / radius 12 / padding 24, matching §7.3 exactly |

**Note the sidebar evidence:** FMP's nav gives Header Settings `matchPaths: ['/admin/branding']`, meaning FMP treats branding as *part of* header settings. PMBC has **two separate nav items** ("Header Settings" and "Header & Branding"). So this gap is visible in the sidebar too.

**To match:** merge `/admin/branding` back into `/admin/header-settings` as five cards, move the Save button to the top and make it Save All, add `MediaPickerButton` next to the logo URL with a live preview on a dark background, add the RichTextEditor tagline field, and add the colour-swatch + hex-input pairs with `/^#[0-9A-Fa-f]{0,6}$/` validation while typing. Then collapse the two nav items into one with `matchPaths: ['/admin/branding']`. This is roughly a full page rewrite.

---

### 5. Page Content

`/admin/content` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Identical |
| Layout | **PARTIAL** | **FMP uses tabs**, grouped by page (`Global (All Pages)`, `Landing Page`, `Training`, `Other Pages`), colour-coded per group, each tab its own form. **PMBC uses collapsible accordion sections**, grouped by raw `cms_content.section` name, alphabetically, all open by default |
| Save | MATCH | FMP: per-tab "Save Changes" firing `Promise.all(rows.map(PATCH))`. PMBC: per-section Save doing the same. **Granularity and mechanism both match** |
| Data model | MATCH | Both `cms_content` only, both via `PATCH /api/admin/content` with upsert semantics |
| Styling | MATCH | Same card, input, and label treatment. Toast placement matches |

**One direction where PMBC is ahead:** PMBC's editor lets you **add and delete arbitrary keys** with `/^[a-zA-Z0-9_.-]+$/` validation, auto-detecting multiline when a value exceeds 80 characters or contains a newline. FMP's page is a fixed curated form over known keys.

**To match:** replace accordions with colour-coded tabs and introduce a curated page grouping (a section-name to tab-group map) instead of showing raw section names. **[doc-only]** on the exact tab labels, which are FMP-specific and would need PMBC equivalents anyway (Global / Home / Services / Legal / Other).

---

### 6. Pages & Nav

`/admin/pages` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Identical, both distinct from `cms_pages` |
| Layout | **PARTIAL** | FMP: "table list with inline edit". PMBC: `CollectionManager` list plus a **slide-in drawer** editor. So FMP edits in place, PMBC edits in a drawer |
| Save | **PARTIAL** | FMP: inline save per row **[doc-only, not specified further]**. PMBC: drawer Save, POST for create / PATCH for update, plus arrow-button reorder that PATCHes two rows at once |
| Data model | MATCH | Both `site_pages` driving the navbar. PMBC fields: `label`, `href`, `display_order`, `visible`. FMP adds `slug` and `can_toggle` |
| Styling | MATCH | Shared `CollectionManager` styling built on the same tokens |

**To match:** convert to inline row editing, and add `can_toggle` so Home and Contact can be pinned as non-hideable. Low value relative to cost; the drawer is arguably better UX. Confirm FMP's actual save behaviour before building.

---

### 7. Articles list + editor

`/admin/articles` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | **PARTIAL** | FMP has **three routes**: `/admin/articles` (list), `/admin/articles/new`, `/admin/articles/[id]`. **PMBC has one**: `/admin/articles`, with create and edit both in a drawer. FMP also has `/admin/articles/categories` and `/admin/articles/series` |
| Layout | **MISSING** | FMP: list with status badge, then a **full-page form**. PMBC: `CollectionManager` list plus a **drawer** with 11 flat fields. No full-page article form exists |
| Save | **PARTIAL** | Both explicit save. FMP saves a whole article from its own page; PMBC saves from the drawer. FMP's copied editor also carries a 60s auto-save (visible in the `scheduling.ts` comments), which PMBC has no equivalent of |
| Data model | **PARTIAL** | Both write `articles`. **FMP has 24 columns; PMBC has 14.** PMBC lacks `tags[]`, `mid_image_url`, `mid_image_caption`, `og_image_url`, `hero_before_content`, `scheduled_at`, `series_id`, `series_order`, and the six writer/author snapshot fields. PMBC has **no** `categories`, `article_categories`, `article_series`, or `instructors`/`authors` tables. Note FMP's spec says `body_html` and `cover_image_url` where the copied FMP schema says `body` and `cover_url`; **PMBC matches the copied code, not the doc** |
| Styling | MATCH | Same tokens, same badge treatment |

**To match:** this is the same work already scoped as items P2 to P6 and P8 in `MIGRATION_PLAN.md` §3, plus splitting the drawer into `/new` and `/[id]` full-page routes. The two documents describe the same gap from different angles: the migration plan frames it as feature parity, this report frames it as UX parity. Do it once.

---

### 8. Testimonials

`/admin/testimonials` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Identical |
| Layout | **PARTIAL** | FMP: "table + per-row edit form". PMBC: `CollectionManager` list + drawer |
| Save | **PARTIAL** | Same list-versus-drawer difference as Pages & Nav |
| Data model | **PARTIAL** | Overlap on `name`, `role`, `company`, `rating`, `status`, `is_featured`, `display_order`. **FMP has** `linkedin_url`, `profile_photo_url`, `hub`, `video_url`, `visible`, and calls the body `quote`. **PMBC has** `text` (not `quote`), `testimonial_type`, `video_url`, `show_on_landing`. `hub` is FMP-only by design (Training vs Modeling) and must not be ported |
| Styling | MATCH | Shared `CollectionManager` |

**To match:** add `linkedin_url` and `profile_photo_url` (both useful for PMBC credibility), skip `hub`. Renaming `text` to `quote` is a migration plus a public-renderer change for zero user-visible benefit; **not recommended**.

---

### 9. Media Library

`/admin/media` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Identical |
| Layout | MATCH | Both a tile grid of uploaded files with an upload control |
| Save | MATCH | Both multipart `POST /api/admin/media`, immediate effect, no save button |
| Data model | **PARTIAL** | FMP: **one bucket**, `cms-assets`. PMBC: **four buckets** with a selector, `cms-assets` / `article-covers` / `case-study-images` / `team-photos`. PMBC is a superset |
| Styling | MATCH | Same card and button treatment |

**To match:** nothing required. PMBC's multi-bucket selector is additive and does not change the core interaction. If strict parity matters, default the selector to `cms-assets` so the first-load view is identical, which it already is.

---

### 10. Site Settings

`/admin/settings` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Identical |
| Layout | **PARTIAL** | FMP: "misc flags" over `site_settings` rows **[doc-only, §2.13 is a one-liner]**. PMBC: grouped cards over a single `settings` JSONB blob. Cannot be compared properly without FMP's live code |
| Save | MATCH | PMBC uses **Save All at the top**, and the code comments say it deliberately mirrors FMP's header-settings pattern. This is the one place PMBC already copied FMP's save idiom on purpose |
| Data model | MATCH | Both `site_settings`. FMP is `key`/`value` JSONB rows, PMBC is one JSONB blob on a single row. Different granularity, same table and same purpose |
| Styling | MATCH | PMBC has its own local `Toast` here rather than the shared `SaveStatus`, but it renders to the same §7.3 spec |

**To match:** confirm FMP's live layout first. The doc is too thin to act on. Low priority either way.

---

### 11. Audit Log

`/admin/audit` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Identical |
| Layout | **PARTIAL** | FMP: time-sorted list with action · admin · target · **reason** · **before/after JSON diff popovers**, rendered by a shared `AuditLogViewer` component. PMBC: a flat 5-column table (when · who · action · entity · reference) rendered inline in the page. **No diff, no reason, no target** |
| Save | MATCH | Both read-only |
| Data model | **PARTIAL** | FMP `admin_audit_log`: `admin_id`, `target_user_id`, `action`, `before_value`, `after_value`, `reason`. PMBC `audit_log`: `admin_id`, `action`, `entity_type`, `entity_id`, `metadata` JSONB. **PMBC has no before/after or reason columns.** Pagination: FMP paginates via `GET /api/admin/audit-log` at 100/req capped at 500; **PMBC has no API route and a hard `limit(200)` server-side** |
| Styling | MATCH | Local `th`/`td` constants render to the §7.3 table spec |

**To match:** add `before_value`, `after_value`, `reason`, and `target_id` columns via migration; write `/api/admin/audit-log` with `?limit=`/`?offset=`; extract an `AuditLogViewer` component with pagination and JSON-diff popovers. Note the coverage inversion in §6 before deciding.

---

### 12. Sidebar

`CmsAdminNav.tsx` on both

| Dimension | Verdict | Detail |
|---|---|---|
| Route | MATCH | Same component name, same file path |
| Layout / behaviour | MATCH | **Every behaviour matches**: 240px expanded / 64px collapsed, `localStorage` collapse persistence, `sessionStorage['admin_sidebar_scroll']` restored on pathname change, off-canvas drawer below 768px with backdrop-click close, active state by exact match **or** `matchPaths` prefix, 3px accent left border. Phase 11 clearly built this against §1 |
| Save | n/a | |
| Data model | n/a | |
| Styling | **PARTIAL** | Structure identical, **colours differ**. Sidebar bg `#0D2E5A` (FMP) vs `#0F2540` (PMBC). Active bg `#1B4F8A` vs `#1B3A5F`. **Active left border `#2EAA4A` green (FMP) vs `#C69C3E` gold (PMBC).** `localStorage` key differs (`adminSidebarCollapsed` vs `pmbcAdminSidebarCollapsed`), which is harmless since the two apps never share a browser origin |

**Two structural differences:**

- **Groups.** FMP: Content · Modeling Hub · Training Hub · System. PMBC: Content · Collections · Leads · Email · System. Only Content and System are shared. Not fixable, and should not be.
- **External links.** FMP has three at the bottom (View Live Site / Training Site / Modeling Hub). PMBC has two (View Live Site / Visit FMP). Correct as-is.
- **Mounting.** FMP renders `<CmsAdminNav active="/admin/foo" />` **manually on every page**. PMBC renders it **once in `admin/layout.tsx`** and derives active state from `usePathname()`. PMBC's approach is better and invisible to the user; see §6.

**To match:** colour values only, and only if the palette decision in §5 goes that way.

---

## 3. Shared components

| Component | FMP | PMBC | Verdict | To match |
|---|---|---|---|---|
| `CmsAdminNav` | Yes, `active` + `badges` props | Yes, `adminName` + `adminEmail` props, self-deriving active | **MATCH** on behaviour | PMBC has no `badges` prop (FMP shows counts on nav items). Add if lead counts on "Inquiries" are wanted |
| `MediaPicker` / `MediaPickerButton` | Both exported | `MediaPickerButton` + `MediaModal` | **MATCH** | Naming differs (`MediaModal` vs `MediaPicker`); the modal is not exported standalone under FMP's name. Rename for cross-project familiarity, or leave |
| `RichTextEditor` | Full Tiptap 2: headings, bold, italic, **text colour**, **font size**, **image + upload**, **link**, **alignment** | Tiptap 3: paragraph, H2, bold, italic, bullet list, numbered list, undo, redo | **PARTIAL** | **Add colour, font size, link, image upload, and alignment.** PMBC's is roughly half the toolbar. Note the version gap: Tiptap 2 versus 3, so extensions cannot be copied directly |
| `RichTextarea` | Yes, compact inline editor, bold/italic/link only, no toolbar, used for short Page Builder fields | **None** | **MISSING** | Build it. FMP uses it throughout the Page Builder for subtitles, quotes, and item descriptions; without it PMBC either has no rich text on short fields or over-uses the heavy editor |
| `AuditLogViewer` | Yes, shared, paginated, JSON diff | **None**, inlined into the page | **MISSING** | Extract, add pagination and diff popovers. Depends on the schema columns in §2.11 |
| `AdminPageHeader` | **None**, each page hand-rolls its header | Yes, shared, eyebrow + h1 + description + actions | **PMBC ahead** | Do not remove. §6 |
| `SaveStatus` | **None** | Yes, shared idle/saving/saved/error | **PMBC ahead** | Do not remove. §6 |
| `ConfirmDialog` | **None**, native `confirm()` | Yes, shared, destructive variant | **PMBC ahead** | Do not remove. §6 |
| `CollectionManager` | **None** | Yes, field-driven list + drawer + reorder, powers 6 pages | **PMBC-only** | This is the reason 4 of the 12 pages are "drawer instead of inline". Replacing it to match FMP would delete PMBC's single most leveraged admin component |
| `InstructorPicker` | Yes | **None** | **MISSING** | Only relevant once article authors exist. Covered by `MIGRATION_PLAN.md` P4 |
| `ProjectsBrowser`, `LaunchStatusCard`, `SystemHealth`, `LiveSessionAssessmentEditor` | Yes | **None** | n/a | FMP-domain only. `SystemHealth` is the one worth considering later; PMBC has no `/admin/health` |

---

## 4. Design language

**Approach: MATCH.** Both use **inline styles, not Tailwind**, in the admin, for the same stated reason (isolation from the public design system). PMBC centralises them in `src/lib/admin/styles.ts`; FMP repeats them per page. PMBC's `styles.ts` comments cite `CMS_REFERENCE.md` §7.1 directly, so this was deliberate.

**Colours: 10 of 16 match, 6 differ.**

| Token | FMP §7.1 | PMBC `ADMIN_COLORS` | |
|---|---|---|---|
| Page background | `#F4F7FC` | `#F4F7FC` | MATCH |
| Card background | `#FFFFFF` | `#FFFFFF` | MATCH |
| Text body | `#374151` | `#374151` | MATCH |
| Text muted | `#6B7280` | `#6B7280` | MATCH |
| Text micro | `#9CA3AF` | `#9CA3AF` | MATCH |
| Border default | `#D1D5DB` | `#D1D5DB` | MATCH |
| Border light | `#E5E7EB` | `#E5E7EB` | MATCH |
| Input amber tint | `#FFFBEB` | `#FFFBEB` | MATCH |
| Danger | `#DC2626` on `#FEE2E2` | same | MATCH |
| Warning | `#92400E` on `#FEF3C7` | same | MATCH |
| **Primary navy** | `#1B4F8A` | `#1B3A5F` | **DIFF** |
| **Deep navy / h1** | `#1B3A6B` | `#0F1B2D` | **DIFF** |
| **Sidebar navy** | `#0D2E5A` | `#0F2540` | **DIFF** |
| **Accent** | `#2EAA4A` green | `#C69C3E` gold | **DIFF** |
| **Soft tint** | `#E8F0FB` blue | `#E8EEF5` | **DIFF** |
| **Toast success** | `#1A7A30` | `#1B6B3F` | **DIFF** |

Every matching value is a **neutral**. Every differing value is a **brand identity** colour. That is not coincidence: Phase 11 deliberately retuned PMBC's admin accent from `#D4A93A` to `#C69C3E` *in step with the public gold*, per `CLAUDE.md`.

**One behavioural consequence of the accent difference:** in FMP, green `#2EAA4A` marks *save* actions (the Page Builder per-section Save button is green, §7.3 "Button save success variant"). **PMBC has no green save-button variant at all.** So even setting the sidebar border aside, an FMP user looking for "the green save button" will not find one in PMBC.

**Typography: MATCH.** Inter throughout, h1 24px/800, card label 11px/700 at `0.05em` uppercase, body input 13px, hint 10 to 11px. PMBC's `AdminPageHeader` matches §7.2 exactly and adds an eyebrow line FMP does not have.

**Layout: MATCH.** `padding: 40` on main, card radius 12 / padding 24, input `8px 12px` radius 7, primary button `9px 22px` radius 8 at 13px/700. All within FMP's stated ranges. Form max-width: FMP caps forms at 680 and tables at 960; PMBC uses 1100 for table pages, slightly wider.

**Responsiveness: MATCH,** including the shared limitation. Both collapse the sidebar below 768px and both leave `grid-template-columns: 1fr 1fr` forms unstacked (desktop-first by design). Both Page Builders break below ~1024px; PMBC's is arguably worse, since a three-column grid with a 380px minimum preview pane needs more width than FMP's two-pane.

---

## 5. The palette decision, which needs Ahmad

"Match FMP exactly" and PMBC's own brand decision are in direct conflict on six colour values, and this cannot be resolved technically.

- **Option A, exact match.** Admin becomes FMP-blue `#1B4F8A` with green `#2EAA4A` save buttons and a green active sidebar border. Zero re-learning on colour. But PMBC's admin **abandons the gold**, which Phase 11 deliberately aligned with the public site, and Ahmad's admin console stops looking like his own brand.
- **Option B, structural match only.** Keep PMBC's navy and gold. Every layout, save behaviour, component, and interaction matches; only the hue differs. Muscle memory transfers (the active item is still a 3px left border in the same place, the save button is still top-right), but colour recognition does not.
- **Option C, split.** Match FMP on **semantic** colours (green for save, because green-means-save is the muscle memory that actually matters) and keep PMBC navy and gold for **identity** (sidebar, active states, headings).

**Recommendation: Option C.** It buys most of the "no re-learning" benefit at the smallest brand cost. The thing an admin re-learns is *"which button commits my work"*, not *"what shade is the sidebar"*. Worth one decision from Ahmad before any styling work starts, because it changes the token file that everything else depends on.

---

## 6. Where matching exactly would make PMBC worse

Five places where PMBC currently diverges because it is **ahead**, not behind. Flagging these so "match FMP exactly" does not quietly delete them.

1. **Shared `AdminPageHeader`, `SaveStatus`, `ConfirmDialog`.** `CMS_REFERENCE.md` §6 explicitly says of FMP: *"there is no shared `SaveStatus`, `ConfirmDialog`, `AdminPageHeader`, or `AdminCard` component. Each page renders its own header / save button / toast / `confirm(...)`. If you mirror this onto a new project, this is the first thing worth extracting."* **PMBC already did that extraction.** FMP's own documentation recommends against copying FMP here.

2. **Audit coverage.** §5.5: FMP audit-logs user mutations but content edits **do not** write audit rows. PMBC audit-logs **every** admin write through `createCollectionApi`. Matching FMP would mean *removing* audit coverage, which also undercuts the governance model in `MIGRATION_PLAN.md` §9.

3. **Sidebar mounting.** FMP requires every page to render `<CmsAdminNav active="/admin/foo" />` and hand-pass its own active path. PMBC mounts it once in `layout.tsx` and derives active from `usePathname()`. Identical to the user, less error-prone (an FMP page with a wrong `active` string highlights the wrong item).

4. **`beforeunload` guard and "Unsaved changes" pill** in the Page Builder. Pure gain, no FMP equivalent.

5. **Media Library multi-bucket.** PMBC has four buckets to FMP's one. Additive.

**Also do not port:** the `hub` column on testimonials, the 8 FMP-only section types tied to training and pricing, and the `instructors` naming (PMBC has no instructors, see `MIGRATION_PLAN.md` S6).

---

## 7. Gaps ranked by cost-to-value

Not a plan, just an ordering to argue about.

| Rank | Gap | Effort | Value | Note |
|---|---|---|---|---|
| 1 | Header Settings merge (branding back into one page) | M | **High** | Biggest single "where did it go" moment when switching projects |
| 2 | Page Builder: per-section Save + local-until-save visibility | S | **High** | Core muscle memory. Cheap |
| 3 | New Page modal with 5 templates | M | **High** | PMBC currently cannot create a page without SQL |
| 4 | Green save buttons (Option C in §5) | S | **High** | One token plus a button variant |
| 5 | `RichTextarea` component | S | Medium | Unlocks rich text on short fields |
| 6 | `RichTextEditor` toolbar parity (colour, size, link, image, align) | M | Medium | Half the toolbar is absent |
| 7 | Page Content: tabs instead of accordions | M | Medium | Visible but shallow |
| 8 | Articles full-page editor + `/new` + `/[id]` | L | Medium | Overlaps `MIGRATION_PLAN.md` P2 to P8. Do once |
| 9 | `StyleEditor` on sections | L | Medium | Real capability gain; large surface |
| 10 | Per-field `VF`/`ItemVF`/`ItemBar` visibility | **XL** | Medium | Touches all 13 editors **and** all 13 public renderers |
| 11 | Audit before/after + reason + pagination | M | Low | Needs a migration. Weigh against §6 item 2 |
| 12 | Dashboard route move to `/admin/cms` | S | Low | Churn for a redirect |
| 13 | Inline row editing on Pages & Nav / Testimonials | L | **Low** | Would mean abandoning `CollectionManager`. Recommend against |
| 14 | Section-type parity (21 vs 13) | **XL** | **Negative** | The section types encode what each business sells. Do not |

---

## 8. Open questions

1. **§5 palette decision.** A, B, or C? Blocks all styling work.
2. **Page Builder preview:** keep PMBC's live iframe, or drop to FMP's new-tab link? The iframe is a genuine PMBC improvement, but it is also the reason the layouts differ (three-pane vs two-pane). Matching layout means losing it.
3. **Per-field visibility (item 10):** worth the XL cost, or is it FMP-specific complexity that a 13-section advisory site does not need?
4. **How stale is `CMS_REFERENCE.md`?** Six findings rest on doc-only claims. If FMP has moved since 2026-05-02, refreshing the snapshot should precede any build work.
5. **Should this run before, after, or interleaved with `MIGRATION_PLAN.md`?** Item 8 above overlaps that plan's Phase D directly. Doing them separately would mean building the article editor twice.
