# History

Dated records moved out of `CLAUDE.md` on 2026-09-22, newest first. Session-by-session narrative is in `SESSION_LOG.md` and the per-phase record in `PHASE_HISTORY.md`, both at the repository root. **Record new session recaps, build logs and task history here or in `SESSION_LOG.md`, never in `CLAUDE.md`.**

## Open items

- **Business valuation tool Live since 2026-09-16 while the privacy policy update is still pending with counsel. Must be closed.** (`PRIVACY_TOOLS_DRAFT.md`; the rule was "settle it before switching a tool Live", see the 2026-09-16 section below.)
- ~~**Replace hardcoded admin password fallback in seed-admin.mjs and the four smoke/verify scripts with an environment variable.**~~ The four are `rotate-admin-password.mjs`, `smoke-admin.mjs`, `smoke-builder.mjs` and `verify-parity8.mjs`. The value is the retired password, dead since 2026-08-02; it was removed on 2026-09-22 from every markdown file (the backup `docs/archive/CLAUDE.md.bak-2026-09-22` in a follow-up the same day), and three saved permission rules carrying password values were removed from `.claude/settings.local.json`. It remains in git history. **Closed 2026-09-22:** the four scripts require `ADMIN_PASSWORD` with no fallback, and the rotation script holds the retired value only as a SHA-256 digest.
- The tool open items listed in the handoff at the top of `SESSION_LOG.md`.

## 2026-10-12: One card shape for the team

On the owner's instruction every team member other than the founding partner has the same card on /team: portrait, name, role, qualifications line, short bio, two "Key highlights" (the first two `experience_items`) and "Read the full profile" pinned to the foot. Muhammad Shahjahan, the compact card until now, gets a profile page at `/team/muhammad-shahjahan` (four sections from his approved copy) and turns full; Kaleem Farooq's card gains two highlight lines condensed from his profile's Career highlights. Migration 107 (DML, hand-run). The compact treatment stays in the code for a future member without a page. The founder card is unchanged.

## 2026-10-11: Hero background image on the service pages

The owner could not find the hero background setting on the nine service pages. Their hero is not a `hero` section: it is `PageHeroFallback`, drawn from `config/services.ts` ("Service 0n", title, summary), so the builder had nothing to attach the image to. The three background keys now live on each page's `service_detail` block, edited under "Page hero background", and the route passes them to the hero, which draws the image under the navy overlay exactly as `hero` does and drops the diagonal pattern over a photograph. With no image the hero renders as before. No migration: absent keys mean no image. `verify-hero-background` gained eight checks (67, break-tested).

## 2026-10-11: Service groups without colour coding, equal card heights

The owner's revision of the grouped /services layout below: the per-group colours are gone. Every header is primary navy with cream text, and every card is white with one warm hairline and a navy top rule. From 1024px each card row is `1fr`, so all nine cards share the tallest card's height and the three columns align, text top-aligned. Before this, cards matched within a row but rows differed in height. Grouping, order, numbering, copy and links unchanged. `verify-service-groups` asserts the uniform styling and the `1fr` rows (break-tested).

## 2026-10-11: Services in three practice groups

On the owner's instruction, matching the firm profile deck: Modeling and Valuation (01 Financial Modeling, 02 Real Estate Financial Modeling, 03 Business Valuation), Transactions (04 Transaction Advisory, 05 M&A Advisory, 06 Financial Due Diligence), Capital and Finance (07 Project Finance, 08 Investment Memoranda, 09 CFO Advisory). Slugs unchanged; "Investment Memorandums" is now "Investment Memoranda" as a display name only. /services lays the groups out as three columns from 1024px, each a coloured header (primary navy, deep navy, gold with navy text) with the name and "3 services" over its cards on a light tint, stacked below 1024px. Related services on a detail page are now the two group siblings and the next group's first service. The navbar dropdown, the contact dropdown, the sitemap, the JSON-LD, the admin service picker and the valuation report's services page all follow the config or the table, so none needed its own change. The home page has had no service cards since migration 051. Migration 106 (DML, hand-run) sets the table, the page title, the group names and the KB order. `npm run verify-service-groups`, break-tested.

## 2026-10-11: Admin session renews while in use

The owner's hero image saved on the home page at 11:05 UTC, then every save on /services and the other pages failed with "Unauthorized". Cause: the admin session is a one-hour NextAuth JWT and nothing renewed it, so it expired at 11:13, an hour after the 10:13 sign-in, while the page builder stayed open. `AdminSessionKeeper` now renews the cookie every five minutes during activity (so the hour counts from last use) and shows a clear "session expired" banner with a sign-in link that opens in a new tab, keeping unsaved edits. Checked against a local build with minted tokens: a token with ten minutes left came back renewed to sixty, and a token two minutes past expiry got the same 401 the owner saw.

## 2026-10-11: Hero background images

Every hero section (`hero` on the page heroes, `founder_hero` on the profiles) gained an optional background image in the page builder: the image from the Media Library, a navy overlay opacity slider (35 to 100, default 60) and a focal point (Centre, Top, Bottom). Rendered by `HeroBackground` through `next/image` with `priority`, covering the hero under the overlay, decorative (empty alt); the Supabase storage domain was already allowed. Height, text and buttons are unchanged, and with no image a hero renders exactly as before: all 16 page heroes rendered byte-identical markup to production at 1440 x 900 before the deploy. Migration 105 (DML, hand-run) backfills the defaults and sets no image. `npm run verify-hero-background` (59 checks, break-tested). Recommended image size and the measured hero geometry are in DESIGN.md.

## 2026-10-11: Team profiles under /team, US spelling site-wide

- **URLs.** On the owner's instruction every team profile lives at `/team/<name>`: `/team/ahmad-din` and `/team/kaleem-farooq`. The routes moved, `pageRoutes.ts` maps the unchanged CMS slugs (`about-ahmad-din`, `about-kaleem-farooq`) to the new paths, and `next.config.ts` 301s the old `/about/...` paths, which keeps FMP's links to the founder profile working. The sitemap, the canonical and JSON-LD URLs, the tool reports' profile link, the fallback navbar and the chat opening lines follow (the founder's line now matches `/team/ahmad-din`; Kaleem's profile takes the general team line). Migration 104 repointed the two stored links (the Founder navbar item, the home founder card) after the deploy.
- **Spelling.** With the owner's approval, "modelling" became "modeling" in the remaining public copy (migration 104: /services/refm, /services/project-finance, /services/transaction-advisory twice, /fmp, the /insights hero) and in code (the /insights fallback, a Growth mock sample, a comment). The FMP content cache is overwritten from FMP's feed and has to be fixed in FMP.
- **Kaleem's card.** His "Read the full profile" link now sits right under his bio rather than at the foot of a card stretched to the compact card beside it.

## 2026-10-11: Compact team profiles, Muhammad Shahjahan, one portrait frame

- **Compact profiles.** Only Ahmad Din and Kaleem Farooq have full profile pages; other members get a compact card carrying the short bio, "Selected experience" and "Expertise". Migration 101 (DDL, hand-run by the owner) added `profile_type`, `experience_items` and `expertise_items` to `team_members`; /admin/team edits all three, and new members default to compact.
- **Muhammad Shahjahan, ACMA** (Senior Associate, Corporate Finance, Lahore) added as the first compact profile, display order 2, no photo, no contact details, the owner's content verbatim (migration 102). The CLAUDE.md delivery-model rule "never name individual analysts" became "name a team member only when the owner has approved them for /team", on the owner's approval. His deal record is his, not a firm statistic.
- **US spelling.** "modelling" became "modeling" on Kaleem Farooq's profile (two credential lists, the Person JSON-LD and the seed record). Eight other occurrences were reported to the owner and left until approved: /services/real-estate-financial-modeling, /services/project-finance (one each), /services/transaction-advisory (two), /fmp, the /insights hero and its code fallback, and the FMP content cache (fix in FMP).
- **Portrait frame.** The green line and rounded corners on the founder's portrait were in the image file (a 10px green band and cut top corners), not the CSS. Migration 103 uploaded a cropped copy and repointed its three fields; the original is kept. Every team portrait now renders through one `ProfilePhoto` component (DESIGN.md), and member cards on /team carry the framed 4:5 portrait instead of a banner. Measured at 1440px and 390px: every frame 4:5, zero border radius inside it, the photo filling the box exactly.

## 2026-10-11: One LinkedIn button standard for every profile

The owner asked for the same LinkedIn CTA on every profile: Kaleem's had none, because a LinkedIn URL had been typed into the primary CTA's label with no link, so it never rendered. The `founder_hero` now draws a gold "Connect on LinkedIn" button from `contact_linkedin`, always first; the two CTAs follow in outline style (the first CTA takes gold only when no LinkedIn is set), and a CTA pointing at the same LinkedIn profile is dropped, so a hero still carrying LinkedIn in its primary CTA (Ahmad's) renders exactly as before. LinkedIn left the contact row, which is now email and phone. The tool reports' partner card reads `contact_linkedin` first and falls back to the primary CTA (`partner.ts`, check added to `verify-tool-email-pdf`). No data changed.

Then, with the owner's approval, both heroes were moved onto the standard (migration 100, `npm run seed-profile-linkedin-field`): LinkedIn in `contact_linkedin`, the secondary CTA up to primary. Ahmad's hero was found already in that state when the script ran, with no audit log row and an unchanged `updated_at`, so some other direct database write did it between the dry run and the apply; the cause is unknown. Kaleem's was moved by the script (the owner had corrected his CTA in the admin at 09:35 UTC, so the planned label clean-up was dropped). Neither page changed on screen. Kaleem's phone was removed by the owner on purpose, for now.

## 2026-10-11: Contact details on Kaleem Farooq's profile

The `founder_hero` section gained three optional fields, `contact_email`, `contact_phone` and `contact_linkedin`, rendered as a contact row under the intro (mail, tap to call, LinkedIn in a new tab) and edited in the page builder. Each item shows only when filled and valid; clearing one removes it, and clearing all three removes the row. The Kaleem profile's Person JSON-LD reads the same fields, so the page and the schema stay in step. /about/ahmad-din is unchanged, since its hero has none of the keys. Values set by migration 099 (DML, `npm run seed-kaleem-contact`). His /team card does not show contact details.

## 2026-10-10: Kaleem Farooq added to the team

Kaleem Farooq (Business Development, Saudi Arabia) added as a team card and a full profile at `/about/kaleem-farooq`, from the owner's copy with "PMBC" replaced by "PaceMakers". The profile is a CMS page built from the same section types as the founder's; the card is a `team_members` row at display order 1. Member cards now link to a profile page when one exists (`fetchMemberProfiles` in `src/lib/cms/founderProfile.ts`), so no column was added. Migration 098 (DML, `npm run seed-kaleem-farooq`). No photo or email yet: the monogram renders until a portrait is set in /admin/team and the page builder.

## 2026-10-09: Paragraph breaks, body alignment, partner logo size

Three public-site fixes, diagnosed and approved before building.

- **Paragraph breaks.** The /network partner descriptions were stored with blank lines (`\n\n\n`) but rendered as one block: the plain textarea value went straight into a `<p>` with no `white-space` rule. Twenty-two plain fields across twelve section types had the same pattern, and eight short rich text fields had a worse one, two paragraphs glued with no space ("First.Second."), because the inline sanitiser drops `<p>` and keeps its text. Fixed in the renderers (`MultilineText`, `RichText`) rather than by converting fields to rich text, so no stored value changed. Rendering all 64 live sections with the old and new code: 63 byte-identical, /network the only difference, and no section's text changed.
- **Alignment.** Paragraphs already had a four-way "Text alignment". The five other rich text bodies gained Left or Justified (`body_align`, default Left). No published block changed alignment: computed `text-align` matched production on nine pages.
- **Partner logos.** Both logos were already capped at 56px high; Sky Gulf read larger because its mark is wide, solid and coloured. A per-partner "Logo size" (Standard 56px, Smaller 44px) was added, with `object-scale-down` so no logo is enlarged; migration 097 sets Sky Gulf to Smaller.

## 2026-09-22: CLAUDE.md split

`CLAUDE.md` (149,271 characters) was split into standing rules plus the `docs/` reference files. Fifteen contradictions were resolved to the current behaviour while moving: migrations applied to 082 (not 081); the DDL list is 031, 032, 033, 072, 076, 077, 082; hCaptcha is dormant and the forms use a honeypot; `verify-valuation-engine` is 518 checks (not 493); two admin roles, admin and editor (Auth snippet and "one admin user" retired); input schema version 4; the sitemap snippet replaced with current behaviour; the per-section Save model replaces the old autosave editor pattern; admin primary colour `#1B3A5F`; the privacy rule recorded as an open item above; `/book` embeds Calendly inline; articles live on PMBC; the footer has three columns; Tools is in the navbar; resumed valuation runs send `sendEmail: false`. A third-party enquirer's name was removed from the 2026-08-16 checklist below.

## 2026-09-16: Free tools go-live

### Go-live record

**2026-09-16.** Business Valuation version 2 and the Tools nav item went live.

| Item | State at go-live |
|---|---|
| Code | `feat/tools-v2` merged to main as `f7bf9ce`, then `fix/verifier-prod-guard` as `4e1e03a`; `/api/health` matched HEAD each time |
| Business Valuation | Live, switched by the owner at /admin/tools (13:55 UTC) |
| Tools nav item | `site_pages` row "Tools", `/tools`, order 25 after Financial Modeler Pro, visible; Contact moved to 26 |
| Migrations | 080 applied. **081 did not reach this database**: both runs went to another Supabase project (the first failed on an `updated_at` column this table has, the second changed nothing here). The row it describes was written directly, with the owner's approval, to the same effect. Check the Financial Modeler Pro project's `site_pages` for a stray hidden Tools row |
| Leads | All 7 tool leads and their 46 events deleted with approval: every one was testing, including one created by a verifier posting to production after the tool went Live. `contact_submissions` untouched (7) |
| Logged-out checks | Navbar and phone menu show Tools; footer shows Free Tools; /tools lists Business Valuation; the tool page loads on desktop and phone with no console errors; service page CTA; sitemap lists /tools and /tools/business-valuation; WebApplication JSON-LD present; webhook refuses a missing or wrong token (401); visibility verifier over HTTP 103 of 103 |

### Privacy (the rule as written at go-live)

### Privacy

`PRIVACY_TOOLS_DRAFT.md` holds proposed policy wording and open questions for
counsel (retention period, tracking consent). The live `/privacy` was not
changed. Settle it before switching a tool Live.

## Status as of 2026-09-21 (was "Current Status")

**Development is complete.** Every phase is done bar Phase 9, and what remains
in Phase 9 is review rather than code: read the deployed site end to end, send one
real contact submission, check the OG cards, clear the Supabase advisor. The
public site renders on nineteen routes, every page's copy is editable in the page
builder, and migrations to 082 are applied. **Free tools are live since 2026-09-16**: Business Valuation is Live and Tools is in the navbar; see "Go-live record" in section 7b. **Engine version 3 and the eight page report shipped 2026-09-17** (see "Business Valuation version 3" in section 7b). **On 2026-09-21** the tool gained leads grouped by email, phone and country, day 7 and 14 reminders, save and return links, a financial year end month and P/E (see "Leads by person, reminders and save and return" in section 7b).

**Open items for the tool are listed in the handoff at the top of [`SESSION_LOG.md`](./SESSION_LOG.md)**: the privacy update for counsel, the founder report highlights, the SAIBOR refresh, stopping reminders on any booking by the same email, reminder wording in the template editor, and an Arabic version.

**The per-phase summary index moved to [`PHASE_HISTORY.md`](./PHASE_HISTORY.md) on 2026-08-16**,
along with the detailed rows that were already there. This file states where the
project is, not how it got here. Read the history when you need to know **why**
something is the way it is before changing it.

**Full detail for every phase, including the reasoning and the things that went wrong, is in [`PHASE_HISTORY.md`](./PHASE_HISTORY.md).** It was split out of this file on 2026-08-13 for the reason stated at the top of it: this file is loaded into context at the start of every session, and that table had grown to 75KB.

**Two verification scripts were renamed on 2026-08-16** because their names were one character apart and drove different things: `verify-fmp-page` is now **`verify-fmp-parent`** (the `/fmp` page itself) and `verify-fmp-pages` is now **`verify-fmp-subpages`** (the three pages fed from FMP's API). `verify-rename-refm` was retired the same day: it verified migration 047, a one-off rename completed on 2026-08-11. `PHASE_HISTORY.md` and `SESSION_LOG.md` still use the old names, correctly, since they record what was run at the time.

## 2026-08-16: Launch checklist (was "Remaining Before Launch")

## Remaining Before Launch

Updated 2026-08-16 at close of session. **Development is complete. What is left
is review.**

Every phase is done bar Phase 9, and Phase 9 no longer contains code. The public
site renders on nineteen routes, every page's copy is editable in the page
builder, the admin console is at parity with FMP and past it in three places
(roles, page metadata, testimonial collection), and migrations to 082 are applied.

Ordered by what stops a launch, not by when it was added.

### Closed today

Recorded here rather than deleted, because "was this done" is a question that
gets asked again a week later.

- ~~**DNS and SSL.**~~ Records moved to Vercel's current set, apex and `www`.
- ~~**Google Search Console.**~~ Sitemap submitted and ownership verified.
- ~~**Brevo.**~~ Moved to its own account, separate from FMP's, so a key rotation
  on one property cannot take out the other's mail. The key is fresh rather than
  one that has been through a chat transcript, which closes that rotation too.
- ~~**hCaptcha.**~~ Replaced by a honeypot and a timing floor, so
  `HCAPTCHA_SECRET_KEY` and `NEXT_PUBLIC_HCAPTCHA_SITE_KEY` are **no longer
  needed on Vercel**. The hCaptcha path is still wired and dormant: setting both
  keys turns it back on with no code change.
- ~~**Counsel review of the three legal statements.**~~ Badge removed, all three
  dated 16 August 2026, governing law and forum stated plainly.
- ~~**Content pass over the whole site.**~~ Every page read end to end and
  corrected.
- ~~**Carousel images, the `/fmp` platform rows, migrations 072 and 073.**~~

### Review, which is all that is left

1. **Read the site as a visitor on the deployed build**, on a phone as well as a
   laptop. Everything below the surface has been measured; what has not been done
   is one person reading the whole thing in order, on the real domain, with fresh
   eyes.

2. **Send one real contact submission and read both emails.** The templates, the
   shell and the send wrapper are each verified separately, but the assembled
   HTML has never been sent, because sending it writes a row into the live
   enquiry list and mails the advisory inbox. Worth doing once now that Brevo is
   its own account. [user]

3. **Verify the OG cards** through the LinkedIn and Twitter debuggers, now the
   domain resolves. [user]

4. **Refresh the Supabase Security Advisor** and confirm the 10 RLS errors from
   migration 013 are cleared. [user, Supabase dashboard]

5. *(An enquiry from 2026-06-21 with no reply recorded; details removed on 2026-09-22. See `/admin/contact-submissions`.)*

### Content that can arrive whenever

None of this blocks a launch, and each degrades gracefully today.

6. **Case Studies and Insights have no rows**, so both are out of the sitemap and
   their footer links are hidden. **Both reverse themselves as content arrives,
   but not the same way.** The sitemap is derived from the row count, so the
   first entry puts a page back with no code change. The footer link is a switch
   in **Footer Links**. The routes are untouched and still return 200. `/team`
   is the pattern to copy if either is turned on: one line each in
   `fetchSuppressedNavHrefs`, and the footer link can then ship visible.

7. **Testimonials has no rows either**, but it is now the collection most likely
   to fill on its own: the submission form is placed on `/contact` and home and
   needs only the switch under Testimonials turned on, or a private link sent to
   a specific client. Both section placements ship hidden as well, so turning the
   switch on is two steps rather than one.

8. **`/team` is live but thin**, holding the founding partner alone. Adding the
   analytical bench is content work, not code.

9. **Partner logos** on `/network`. The page degrades without them. A new image
   host needs a line in `next.config.ts` `images.remotePatterns`; Supabase and
   Cloudinary are already allowed. [user provides; assistant wires]

### Credential rotations

10. Two left, neither blocking. The Brevo key closed itself when the account
    moved.
    - **FMP API key.** Pasted into a chat transcript on 2026-08-11, live in
      `.env.local`, and needed on Vercel. Read-only content feed, so the blast
      radius is small. Rotate on FMP, update both places.
    - **Admin password.** Rotated 2026-08-02 and verified dead against the old
      value, but the replacement was typed into a chat transcript. The console now
      has a **Change Password** screen with an emailed code, so this no longer
      needs `npm run rotate-admin-password` or a terminal at all.

### Decisions, not gaps

11. **Two nav rows are hidden.** `site_pages` carries **Approach** and **Founder**
    with `visible = false`. `/approach` is unreferenced everywhere, so it renders
    only for someone holding the URL: it should either be restored to the
    navigation or retired properly. `/about/ahmad-din` is different, since the
    home founder card still links to it, which is a content link rather than
    navigation. Restoring either is one switch in Pages & Nav plus one line in
    `sitemap.ts`.

12. **LinkedIn on the home founder card.** The URL is live on the
    `/about/ahmad-din` hero and the company URL is in the footer. The home card's
    secondary slot carries "Book a Meeting". Decide whether it should carry
    LinkedIn as well as, or instead of, booking. One line either way.

### Not ours

13. **FMP edge caching.** FMP's public feed sets `Cache-Control: public,
    max-age=60` on an authenticated endpoint, and Vercel's edge cache key does
    not vary on `x-api-key`. For up to 60 seconds after any legitimate fetch,
    that URL is served from the edge to anyone, with no key or a wrong one.
    Verified: with a cache-busting query string the endpoint correctly returns
    401, so the auth logic is right and only the caching header is at fault.
    `s-maxage=0`, `private` or `Vary: x-api-key` closes it. **Does not affect
    PMBC.** [user, FMP repo]

## 2026-04-30 to 2026-05-03: Build sequence

## 11. Build Sequence

**Complete.** Phases 1 to 8 shipped between 2026-04-30 and 2026-05-03, and every
phase since has been an improvement on a working site rather than a step in the
original plan. Phase 9 is the only one still open, and everything left in it is
operational: see the launch checklist above.

The original nine-phase plan, including what each phase was scoped to deliver,
moved to [`PHASE_HISTORY.md`](./PHASE_HISTORY.md) on 2026-08-16.
