# Database reference

Moved verbatim from `CLAUDE.md` on 2026-09-22 (original kept at `docs/archive/CLAUDE.md.bak-2026-09-22`). Contradictions found in the split were resolved to the current behaviour; each such line is noted in `docs/HISTORY.md` under 2026-09-22.

**Read this before:** writing a migration, changing a table, or rebuilding the database.

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

**`branding_config.accent_color` still defaults to the original 003 value.**
Migration 028 retunes the live row to `#C69C3E` (see section 9), so a fresh setup
that runs 003 then 028 lands on the current palette. The column default is left
alone deliberately: applied migrations are never edited.

### Migration Order

Every migration's own header carries the full reasoning: what was wrong, what was
chosen instead, and why. **Read the file before re-running one.** The list below
is an index, not a substitute.

Three flags matter when rebuilding:
- **DDL** migrations (031, 032, 033, 072, 076, 077, 082, 083, 084, 085, 086, 087) use `ALTER TABLE`, which supabase-js cannot
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
072  testimonial_submissions **DDL, HAND-RUN.** Six columns on `testimonials` plus the `testimonial_links` table, for client-submitted testimonials
073  place_testimonial_sections  the form on /contact and home, the quotes on home between the founder card and the network line, all shipped hidden
074  tools_pages               cms_pages rows and hero sections for /tools and /tools/business-valuation (`npm run seed-tools-pages`)
075  tools_links               a footer link and a service page CTA into the tools. Applied early by hand, hidden the same day, retired by 079
076  tool_visibility           **DDL.** Per-tool Hidden or Live, seeded Hidden. Missing table means every tool Hidden
077  tool_leads                **DDL.** tool_leads and tool_lead_events. Missing tables mean results still shown, nothing saved
078  tool_email_templates      the results email and lead alert rows in email_templates. Code carries the same defaults
079  retire_tools_link_rows    removes 075's two rows; the footer link and CTA are now rendered from the visibility switch
080  tool_hero_promise         DML, safe any time. The valuation hero subtitle becomes the one-line promise, only if still 074's wording
081  tools_nav_item            DML, safe any time. A hidden "Tools" row in Pages & Nav after Financial Modeler Pro, only if no /tools row exists
082  tool_lead_phone           **DDL, HAND-RUN.** phone and contact_country on tool_leads, plus an index on lower(email). Applied 2026-09-21. Missing columns: leads save without them
083  growth_core               **DDL, HAND-RUN.** Growth Engine: growth_companies, growth_contacts, growth_leads, growth_signals, growth_activity. RLS on, anon and authenticated revoked, is_test on every table. Applied 2026-09-22
084  growth_knowledge_base   **DDL, HAND-RUN.** growth_kb_items (working and approved copy, activity logged by trigger) and ten empty starter drafts; growth_activity gains clock_timestamp() created_at, a seq identity and kb_item_id. Applied 2026-09-22
085  growth_settings         **DDL, HAND-RUN.** growth_settings (one row, typed limits checked by the database, every change logged with old and new values) and growth_suppressions (never deleted, removal needs a reason, logged). Applied 2026-09-22
086  growth_nine_services    **DDL, HAND-RUN.** Growth services become the site's nine (companies, leads, Knowledge Base; five drafts converted, Feasibility Studies archived, four added, all logged), offers gain related_service_slugs, settings gain priority_services. Applied 2026-09-22
087  growth_ai_usage         **DDL, HAND-RUN.** growth_ai_usage (every AI call, logged with actor ai; mock calls free by constraint) and growth_ai_alerts (one budget alert per Riyadh month by unique key); growth_settings may hold one test row, id 2. Applied 2026-09-22
088  growth_prospecting      **DDL, HAND-RUN.** Phase 2: signal origin, evidence key, duplicate flag and triage record; company source, scale and Prospect Score columns (override needs a reason); growth_research_briefs (mock briefs never accepted), growth_feed_runs (scheduled run once a Riyadh day), growth_imports; settings for signal keywords, the feed, scoring weights (sum 100, checked) and per-agent models. Applied 2026-09-23.
089  growth_outreach         **DDL, HAND-RUN.** Phase 3: growth_messages (approval, scheduling, sends, replies; mock drafts never sent for real by constraint; status changes logged by trigger), growth_tracked_links and growth_link_clicks (site paths only), growth_opportunities (lost needs a reason), growth_tasks; lead sequence, reply and meeting-request columns; settings outreach_sending_paused and lead_scoring_weights (sum 100, checked). Applied 2026-09-23. Later Growth migrations: see docs/PENDING_MIGRATIONS.md
```

**Every migration from 076 on states when it is safe to apply** in a `SAFE TO APPLY:` line in its header: before or after which deploy, and what the site does in the gap. 075 is why: it was applied before the routes it linked to were deployed, and previews share the production database, so the live footer linked to a 404.

After running migrations, manually insert one admin_users row via SQL with a bcrypt hash for the password.

**DDL migrations must be run by hand.** 031, 032, 033, 072, 076, 077, 082, 083, 084, 085, 086 and 087 use `ALTER TABLE` or `CREATE TABLE`, which supabase-js cannot execute. The Supabase CLI is not installed and `.env.local` carries no direct Postgres connection string, so the seed-script pattern used for 029 does not work for them. Paste them into the Supabase SQL editor. Every consumer of those columns degrades safely if the migration has not run: the page list treats a missing `is_system` as "system" so nothing is deletable, `writeAudit` retries without the diff columns rather than failing the mutation, and `/api/admin/site-pages` replays a write with `can_toggle` stripped when Postgres rejects the column (so Pages & Nav keeps working, minus pinning).

### Rebuilding this database

Run every migration in order, and remember that **031, 032, 033, 072, 076, 077, 082, 083, 084, 085, 086 and 087 are DDL and
need the Supabase SQL editor**: supabase-js cannot execute `ALTER TABLE` and this
repository has no direct Postgres connection string. All twelve are applied and
verified live on the current database. Everything that reads those columns
degrades safely when they are absent, which is what let Pages & Nav keep working
before 033 was run.
