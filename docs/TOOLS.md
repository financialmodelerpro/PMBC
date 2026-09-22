# Free tools reference

Moved verbatim from `CLAUDE.md` on 2026-09-22 (original kept at `docs/archive/CLAUDE.md.bak-2026-09-22`). Contradictions found in the split were resolved to the current behaviour; each such line is noted in `docs/HISTORY.md` under 2026-09-22.

**Read this before:** any work on the free tools: visibility, the Tools nav item, leads, emails, reminders, booking links, the Damodaran refresh, or adding a tool. Valuation engine and report detail are in VALUATION.md and REPORTS.md.

## 7b. Free Tools

Added 2026-09-16. Free calculators at `/tools`, first the Business Valuation
tool (DCF and comparables) at `/tools/business-valuation`, ported from
`reference/tools/business-valuation.html`. See Critical Reminder 1 for the
recorded reversal that allows them.

### Where things live

| What | Where |
|------|-------|
| Which tools exist, their copy, their service page CTA | `src/config/tools.ts` (the registry) |
| Each tool's component | `src/components/tools/toolComponents.ts`, then `src/components/tools/<tool>/` |
| Form state and every form transition (defaults, peer sync, inputs out) | `src/components/tools/valuation/state.ts`, plain functions the verifiers drive |
| Chart geometry, drawn by both the page (`ChartSvg`) and the PDF (`PdfChart`) | `src/lib/tools/valuation/charts.ts` |
| Warning thresholds, version 2 defaults, growth ceilings, the market data label | `src/lib/tools/valuation/data.ts` (`WARNING_RULES`, `V2_DEFAULTS`, `growthCeiling`, `DATA_VERSION_LABELS`) |
| Email me this version | `src/lib/tools/leads/version.ts` (pure), route `src/app/api/tools/[slug]/lead/version/route.ts` |
| Download PDF for what is on screen | `src/app/api/tools/[slug]/pdf/route.ts`, writes nothing |
| Company name and description a visitor adds to their report | `src/lib/tools/valuation/profile.ts` (cleaning and limits, shared by the form, the API and the PDF) |
| Logo and partner card in the report and on the results | `src/lib/tools/brand/partner.ts` (pure), `src/lib/tools/brand/fetch.ts` (server), `src/components/tools/PartnerCard.tsx`. **The partner card reads only the founder profile's `founder_hero`**; its career highlights are that section's **Report highlights** field (one per line, up to five), which the profile page itself does not show and which ships empty. Home's founder card is never read, so editing it cannot change a report. Reports draw the Header Settings colour logo on white and its white logo on any dark background (trimmed and resized, never recoloured), with the brand name, tagline and Site Settings contact details (`fetchReportBranding`). **The founder portrait is framed by one rule everywhere** (home founder card, profile hero, results partner card, PDF): `src/lib/public/portrait.ts`, a fixed 4:5 frame with the image cropped to cover it at a face-anchored focus (50% 30%), never stretched. On the results card the frame carries `self-start`: in a flex row it otherwise stretches to the text beside it, which drew the portrait as a 150 by 244 strip until 2026-09-17 |
| Booking link | `src/lib/tools/booking.ts` (always the site's `/book`), short links and attribution in `src/lib/tools/bookingLinks.ts`, redirect rules in `bookingRedirect.ts`, storage and click recording in `src/lib/tools/leads/bookingLinkStore.ts`, routes `src/app/b/[slug]/route.ts` and `src/app/api/tools/book/route.ts` |
| **Every tunable number** (Damodaran data, FX, market rates, presets, deal bands) | `src/lib/tools/valuation/data.ts`, and nowhere else |
| The valuation arithmetic | `src/lib/tools/valuation/engine.ts`, pure, no UI |
| Every sentence and number format shown about a result | `src/lib/tools/valuation/format.ts`, shared by the page, the PDF and the emails |
| Whether a tool is public | `tool_visibility` table, switched at `/admin/tools`, read only through `src/lib/tools/visibility.ts` |
| Lead submission rules | `src/lib/tools/leads/valuation.ts` (pure), route `src/app/api/tools/[slug]/lead/route.ts` |
| Results email and alert | `src/lib/tools/email/templates.ts`, sent by `src/lib/tools/leads/deliver.ts`, editable at `/admin/email-templates` |
| PDF report | `src/lib/tools/pdf/ValuationReport.tsx` (content only), on the shared report theme `src/lib/tools/pdf/theme.ts` and `components.tsx` (see "Report theme"), fonts in `src/lib/tools/pdf/fonts/` |
| Brevo webhook | `src/lib/tools/webhook.ts` (pure), route `src/app/api/webhooks/brevo/route.ts` |
| Booking click tracking | `src/app/api/tools/book/route.ts`, redirecting to `/book` |
| Admin | `/admin/tools`, `/admin/tools/[slug]`, `/admin/tool-leads`, `/admin/tool-leads/[id]` |

### Visibility: one switch per tool

A tool is Live only when the registry marks it `build: 'ready'` **and** its
`tool_visibility` row says `live`. Everything else is Hidden, including a
missing row, a missing table and a failed read. That one answer decides, and
nothing else may decide:

- `/tools/[slug]`: 404 and noindex when Hidden. Signed-in staff see the page with an amber **Admin preview** banner.
- `/tools`: 404 while no tool is Live. Lists Live tools only.
- `sitemap.xml`: `/tools` and each Live tool. The sitemap is rendered per request.
- `WebApplication` JSON-LD: only on a Live tool's public page.
- Service page CTA and each tool page: the tool's own Live or Hidden status only.

### Tools in the navbar: Pages & Nav decides

**Since 2026-09-16 the Tools nav item is an ordinary Pages & Nav row** (`site_pages`, link `/tools`, seeded hidden by migration 081). The operator sets its label, its place in the order and whether it is on, like any other page. Nothing adds it automatically any more. Two switches, each with one job:

| Switch | Where | Decides |
|---|---|---|
| Tools row Visible | Pages & Nav | Whether Tools is offered in the navbar, and the footer "Free Tools" link with it |
| Tool Live or Hidden | Tools | Whether each tool page is public, and so whether the hub has anything to show |

The rules, in `src/lib/tools/navSetting.ts` (pure, shared by the navbar, Pages & Nav and the verifier):

- **Row off:** no Tools link and no Free Tools link, for anyone.
- **Row on, nothing Live:** the public sees no link (the hub would 404). Signed-in staff see the link with a **Hidden** badge so they can check it, and Pages & Nav shows a warning beside the row with a link to Tools. The session is only read in this one case.
- **Row on, a tool Live:** the public sees Tools under the operator's label and position, the footer shows Free Tools after Financial Modeler Pro, and the hub lists the Live tools.
- `/tools` itself is unchanged: a 404 to the public while nothing is Live, the hub with the Admin preview banner for signed-in staff.

"Free Tools" is still not a Footer Links row: any stored `/tools` footer link is removed, so there is never a third switch. Pages & Nav has no footer placement control; the link sits after Financial Modeler Pro in the Firm column.
- Service page CTA: the tool's `serviceCta`, while it is Live. **Not** a page builder section.
- Lead API: refuses a Hidden tool unless the caller is staff.

Switching is admin only (not editors), confirms first, and writes an audit entry
(`entity_type` `tool`, action `tool_visibility`) that is the history on the tool
detail page. `npm run verify-tools-visibility` proves all of this; with
`VERIFY_BASE` it checks a running site as a logged-out visitor.

**Local verification without touching the switch.** Local builds read the
production database, so flipping a tool to check a Hidden or Live page would
change the public site. `TOOLS_VISIBILITY_OVERRIDE=hidden` or `=live` on a local
`next start` makes that server behave as if every tool were Hidden or Live. It
is **ignored whenever `VERCEL` is set**, which Vercel sets on every deployment,
and the verifier asserts that. `TOOLS_NAV_OVERRIDE=on` or `=off` does the same for
the Pages & Nav Tools row, with the same guard.

**Any submission by signed-in staff is a test lead** (`is_test`), on a Hidden or
a Live tool, and test leads are excluded from counts and from the lead list by
default.

### Adding a tool

1. Registry entry in `src/config/tools.ts` with `build: 'draft'`. It is now listed at `/admin/tools` as In development and cannot be switched Live.
2. Data and engine under `src/lib/tools/<slug>/`, pure, with every tunable value in a data module.
3. Component under `src/components/tools/<slug>/`, registered in `toolComponents.ts`.
4. A lead processor like `leads/valuation.ts`, added to the `slug` check in the lead route, and its email and PDF if it sends them.
5. A `cms_pages` row `tool-<slug>` with a hero section, by migration, stating when it is safe to apply.
6. A verifier against whatever the tool was specified from.
7. `build: 'ready'`, deploy, preview it signed in, then switch it Live at `/admin/tools`.

**Other tools on each tool page.** Below every tool, "Try our other free tools" lists the other Live tools as the same cards the hub uses (`ToolCard`), in registry order, so a new tool is offered on every tool page the moment it is switched Live, with no code change. Staff previews also show ready tools that are still Hidden, marked Hidden; drafts never appear. With nothing to offer the section renders nothing, which is the state while Business Valuation is the only Live tool. Rules in `src/lib/tools/otherTools.ts`, proved by `verify-tools-visibility`.

### Refreshing the Damodaran data each January

Damodaran publishes his annual update in early January. All values are in
`src/lib/tools/valuation/data.ts`, and its header lists these steps too.

1. Country risk premiums, default spreads and marginal tax rates for each country in `COUNTRIES`.
2. Unlevered beta (corrected for cash) and market debt to equity for each industry in `INDUSTRIES`, from the global datasets.
3. `MARKET.matureErp` (implied ERP) and `MARKET.usDefaultSpread`.
4. `MARKET.usTreasury10y` on the day of the refresh.
5. FX to SAR (`sarPerUnit`) and the inflation expectations for non-pegged currencies. Review the preset multiples and size premium bands while there.
6. Update every `asOf` in `SOURCE_NOTES` and the `WACC_SOURCE_SENTENCE`, and bump `VALUATION_DATA_VERSION`.
7. **Local lending rates** (`LENDING_RATES`, since 2026-09-21): the base rate for each country with its source and date, refreshed at the same time and whenever a central bank moves. The default pre-tax cost of debt is that rate plus `ASSUMPTIONS.companyCreditSpread`; no published typical bank margin exists for these markets, so the margin is the firm's. `lendingSourceNote` prints the line in the sources.
8. `npm run verify-valuation-engine`. **Do not edit `reference/tools/business-valuation.html`**: it stays exactly as ported, and the verifier writes the current Treasury yield, default spread and implied ERP from `marketDataInUse` into its CONFIG before each case. Add a `DATA_VERSION_LABELS` line for the new version (it is printed in the report footer, so keep it short).

Old leads keep the results they were given: `results` is stored as computed and
never recomputed, and each lead records its `data_version`. **A result field that
can be null must be listed in `NULL_MEANS_ABSENT`** (`serialize.ts`), or a stored
null revives as NaN, passes a `!== null` test and prints "n/a". Borrowings, cash,
invested capital and EV / EBIT did that from 2026-09-17 to 2026-09-21.

**The form cannot accept what the server refuses.** Text and list limits (peer
names, peer count, the gate's name, email and company) live in
`src/lib/tools/valuation/limits.ts`, read by both the zod schema and the form. A
refused save shows the visitor local results with no lead, no email and no PDF,
and no message, so a mismatch here loses the lead silently. The same goes for the
date: the form's `todayIso` is UTC, as the server's is. A financial year that has
not started is refused; the year still running is allowed and takes no stub.

### Leads, email and tracking

- **The server recomputes.** The browser posts inputs and gate details; the API validates to the form's limits, reruns the engine, and stores and returns its own result. The page shows the server's result, or its own if the request fails, so a visitor always sees results.
- **Spam:** honeypot field, a 3 second minimum from page load, and 5 per hour or 20 per day per hashed IP (staff exempt). All three answer exactly as a real save does and store nothing.
- **Emails run after the response** (`after()`), so a slow PDF or Brevo never delays results. Outcomes are written to the lead (`email_status`, `alert_status`, errors) and as events. Staff can resend and download the PDF from the lead.
- **The alert** goes to `site_settings.admin_email`, then `EMAIL_TO_ADMIN`.
- **Tracking:** every tool email carries `X-Mailin-custom: lead:<id>|kind:<results|alert>` and Brevo tags. The webhook records delivered, opened, clicked, bounced, blocked, deferred and complaint events against the lead. `email_status` only moves to stronger evidence (complaint > bounced > blocked > clicked > opened > delivered > deferred > sent). **Opens are a weak signal**; clicks and booking clicks are the real one.
- **Booking clicks** from the results page, the email, the PDF and its QR code go through a **short link, `/b/<id><channel>`** (since 2026-09-17): 12 random characters from a 56 character alphabet (about 70 bits), issued when the lead is saved and stored as one `booking_link` event whose unique `dedupe_key` is the lookup (no new table), then one letter for the channel (`r` results, `e` email, `p` PDF). **A short link only opens the booking page**: it is not the access token, is never accepted where the token is (lead versions, the PDF download, the lead API), and an unknown or malformed id redirects to `/book` recording nothing. A known one records the click once and sets the first-party **`pmbc_booking`** cookie (30 days: `utm_source=pacemakersglobal`, `utm_medium=free-tool`, `utm_campaign=<slug>`, `utm_content=<channel>` and `ref=<link id>`; never a name, email or token), then redirects to **`/book` with no query string**. The long links already sent (`/api/tools/book?t=<access_token>&src=...`) behave the same way, issuing a short id for an older lead so its cookie can carry a reference. On `/book`, tracking parameters from any source (utm tags, `ref`, click ids) are stored in the same cookie and cleared from the address bar without a reload (`BookingUrlCleaner`); the page passes the attribution to the calendar as utm tags, with the lead reference as `utm_term=ref-<id>`, and prefills name and email from the lead the reference points to. Leads saved before short links keep their long links in the admin PDF until a click issues one. `npm run verify-booking-links` (61 with `VERIFY_BASE`, GET only and unknown ids only, so safe against production). The cookie is described in `PRIVACY_TOOLS_DRAFT.md` with a question for counsel. **Never to Calendly directly**: `/book` passes the known keys into the embedded calendar (`withBookingPrefill`), so the visitor stays on the site and the booking is still attributed. Email security scanners can open links, so check the user agent on an email-sourced click.
- **What counts as engagement** (`src/lib/tools/engagement.ts`). The internal alert never does: it has its own Brevo tag (`tool-lead-alert`) and `kind:alert` in the custom header, and an event that cannot be matched to either email (header, tags, message ids, recipient, in that order) is treated as the alert. A click on the results email **within 60 seconds of delivery** (or of the recorded send, before a delivered event arrives), or on a results email that **bounced or was blocked**, is likely a mail scanner: it is kept in the lead's history with `pmbc_engagement.likely_automated` and the reason in its payload, never moves `email_status`, and a booking click from the email link on those terms is recorded without adding to `booking_clicks`. Results page and PDF booking clicks are never judged. The lead detail badges each flagged event, labels alert events as not visitor engagement, and states how many clicks were not counted. Events stored before this rule shipped (2026-09-16) were not rewritten.
- **Status writes are conditional, never read-then-write.** Brevo sends events as separate requests within the same second, and a fast bounce can arrive before the send has recorded `sent`. The first real lead bounced and stayed `sent` that way. `setEmailStatusIf` is one UPDATE that applies only where the stored status is weaker (`weakerStatuses`), the send records `sent` only from `pending`, and a resend resets to `pending` first. Brevo's `reason` is kept as the event detail only on bounces, blocks, deferrals, errors and complaints; a delivered event carries the reason "sent", which read as a fault.

### Leads by person, reminders and save and return

Added 2026-09-21 (`feat/valuation-crm`). Proved by `npm run verify-tool-followup` (48; 53 with `VERIFY_BASE`, GET only).

- **One person is one email.** `/admin/tool-leads` lists people (`listPeople`, `groupLeadsByEmail` in `src/lib/tools/admin.ts`, matched case-insensitively), each valuation a **project** under them, named by its company or "Your business". Lead counts count each email once (`countPeople`); `/admin/tools` shows valuations beside them. Existing rows group the same way with no migration: nothing is merged in the database.
- **Phone and country** (migration 082), both optional, on the name and email step. **The phone field is the contact form's own component** (`src/components/public/PhoneField.tsx`: the searchable country picker above the number, joined by `composePhone`, at most 40 characters as on the contact form), shared by both forms since 2026-09-21. The contact form keeps its own field style; the valuation step passes its `inputClass` (`inputClassName`) so the two boxes match its other fields. The country list is `src/lib/tools/contactCountries.ts`, GCC and Pakistan first; choosing one sets the phone picker (`isoForContactCountry`). Stored as `+966 50 123 4567`. Shown on the lead and in the internal alert. `contact_country` is the person's own country, not the company's country of operations.
- **Reminders**, `src/lib/tools/leads/reminders.ts` (pure) and `runReminders.ts`: two only, day 7 and day 14 after the person's **latest** valuation, each only inside its own week, only when the follow-up box was ticked on it, never after an unsubscribe or a booked meeting. Sent by the Vercel cron (`vercel.json`, daily 06:00 UTC) calling `/api/cron/tool-reminders`, which needs `Authorization: Bearer $CRON_SECRET` and answers 503 while `CRON_SECRET` is unset, **which is why it is set on Vercel Production (since 2026-09-22)**. Each send is claimed by a `reminder_sent` event with a unique dedupe key per email and number; a failed send releases it. The wording is in code (`buildReminderEmail`), not the template editor. Report email shell, booking button, edit link, signed unsubscribe link and a one-click `List-Unsubscribe` header. Brevo events carry `kind:reminder` and are not visitor engagement.
- **Unsubscribe**: `/api/tools/unsubscribe?e=&s=`, an HMAC over the email (`TOOL_LEAD_IP_SALT`, else `NEXTAUTH_SECRET`). GET only shows a confirm button, so a mail scanner cannot unsubscribe anyone; the POST turns off follow-up on every lead with that email and records `reminders_unsubscribed`.
- **Booked**: `CalendlyBookedListener` on `/book` posts Calendly's `event_scheduled` message to `/api/tools/book/scheduled`, which records `booking_scheduled` against the lead in the `pmbc_booking` cookie. A booking made without that cookie is not seen, so that person may still get a reminder.
- **Save and return**: every results email (and reminder) carries an **Edit and rerun** link, `/tools/<slug>?resume=<id>`, 16 characters, stored as a `resume_link` event (`resumeLinks.ts`). The page loads the project's inputs from `/api/tools/<slug>/resume` (GET, 404 for unknown ids or a Hidden tool), drops the id from the address bar, and a run saves a new version of **that** project through the version route with `sendEmail: false` (no gate, no email; Email me this version still sends one). The link grants edit access to the project, like the access token, and the email says not to forward it.
- **Deleting leads** (since 2026-09-22): `DELETE /api/admin/tool-leads` with `emails` (a whole person, every valuation under the email, whatever the list's filters show) and or `ids` (single valuations), at most 200 each, admins only (`canDelete`). Events cascade with the lead (077's foreign key), and reminders need no row: with no valuation left the run finds nobody. **Deleting one valuation while others remain first moves the person's `reminder_sent`, `reminders_unsubscribed` and `booking_scheduled` events to their newest remaining valuation** (`planLeadDeletion` in `src/lib/tools/leads/deleteLeads.ts`), or the next run could resend a reminder or restart them after an unsubscribe. One audit row per valuation (`tool_leads`, `delete`), holding the row without results, access token or IP hash, with the scope and events removed in `metadata`.
- **Net income and P/E**: optional net income (last actual year) on step 2 and a P/E column for peers. With two or more peer P/Es and positive net income, P/E gives equity (after the private company discount), shown plus net debt and claims as a reference row in value by method and the comparables table. Never blended. Kept off page 6.

### Production guard

**Scripts that write never run against production.** Every script that sends
POST, PUT, PATCH or DELETE calls `refuseWritesAgainstProduction`
(`scripts/lib/productionGuard.mjs`) and exits 2 against pacemakersglobal.com or a
`*.vercel.app` deployment, which shares the production database. There is no
override. `npm run verify-production-guard` proves it without sending a request.
Production checks are GET only: `VERIFY_BASE=https://www.pacemakersglobal.com
EXPECT_LIVE=business-valuation EXPECT_TOOLS_NAV=on npm run verify-tools-visibility`.
