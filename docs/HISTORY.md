# History

Dated records moved out of `CLAUDE.md` on 2026-09-22, newest first. Session-by-session narrative is in `SESSION_LOG.md` and the per-phase record in `PHASE_HISTORY.md`, both at the repository root. **Record new session recaps, build logs and task history here or in `SESSION_LOG.md`, never in `CLAUDE.md`.**

## Open items

- **Business valuation tool Live since 2026-09-16 while the privacy policy update is still pending with counsel. Must be closed.** (`PRIVACY_TOOLS_DRAFT.md`; the rule was "settle it before switching a tool Live", see the 2026-09-16 section below.)
- ~~**Replace hardcoded admin password fallback in seed-admin.mjs and the four smoke/verify scripts with an environment variable.**~~ The four are `rotate-admin-password.mjs`, `smoke-admin.mjs`, `smoke-builder.mjs` and `verify-parity8.mjs`. The value is the retired password, dead since 2026-08-02; it was removed on 2026-09-22 from every markdown file (the backup `docs/archive/CLAUDE.md.bak-2026-09-22` in a follow-up the same day), and three saved permission rules carrying password values were removed from `.claude/settings.local.json`. It remains in git history. **Closed 2026-09-22:** the four scripts require `ADMIN_PASSWORD` with no fallback, and the rotation script holds the retired value only as a SHA-256 digest.
- The tool open items listed in the handoff at the top of `SESSION_LOG.md`.

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
