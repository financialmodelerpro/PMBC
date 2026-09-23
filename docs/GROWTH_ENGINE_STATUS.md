# PMBC AI Growth Engine: status and handover

**Read this first in any Growth Engine session.** Last updated 2026-09-23, during the Phase 2 to 7 build. Production runs `main`; `/api/health` reports the live sha. Also read `docs/GROWTH_BUILD_LOG.md` (one line per unit) and `docs/PENDING_MIGRATIONS.md` (every migration and whether it is applied).

**Resume point:** Phases 2 and 3 are complete and merged (088 and 089 applied). Next is Phase 4 (Website AI, built disabled), starting with migration 090 and Unit 4.1.

The Growth Engine is an in-house lead generation and CRM system inside the admin at `/admin/growth`. It is admin-only. Detail on each part is in `docs/ARCHITECTURE.md` (the Growth rows) and `docs/DATABASE.md` (migrations 083 to 087); this file is the summary and the rules.

## Built and live (Phase 1)

| Unit | What it delivered |
|---|---|
| 1.1 | The Growth section shell at `/admin/growth`: sidebar entry, sub-navigation, eleven pages (Home, Signals, Prospects, Outreach, Pipeline, Conversations, Meetings, Partners, Knowledge Base, Analytics, Settings). |
| 1.2 | Admin-only access, and the core data layer: companies, contacts, signals, leads, and an append-only activity log. Growth Home shows whether every table is in place. |
| 1.3 | The Knowledge Base: ten kinds of approved content, each with a working copy and an approved copy; AI reads only the approved copy, through `getApprovedKnowledge()`. Activity ordering fixed. |
| 1.3b | Growth services are the site's nine services, read from `src/config/services.ts`; each service links to its own site page; offers link to related services; outreach priority services are a setting. |
| 1.4 | Settings (send limits, AI budget, retention), the suppression list with the `checkSuppression` send check, opt-out import, a read-only retention preview, integration status, and the audit log view. |
| 1.5 | The AI layer: `runAi` with budget cap, Riyadh-month spend, a once-a-month budget alert, every call recorded and logged with actor `ai`, and a labelled mock provider until `ANTHROPIC_API_KEY` is set. Shared email domains need confirming before they can be suppressed. |

Live data today: one settings row with the defaults and **no AI budget set**; fourteen Knowledge Base items (nine service drafts, the archived Feasibility Studies service, four offer drafts), all unapproved and empty; no companies, contacts, leads, signals, suppressions or AI calls yet.

## Built (Phase 2, Prospecting, 2026-09-23)

| Unit | What it delivered |
|---|---|
| 2.1 | Signal Inbox at `/admin/growth/signals`: add a signal by hand (trigger, date, summary, a required real evidence link), triage into convert (company created or chosen, plus a lead), attach (company and optional lead) or dismiss with a reason; reopen; duplicates flagged (same evidence link, or same company and trigger within 14 days), never blocked; filters by status, trigger, origin, date, text, duplicates. `signals.ts`, `signalsModel.ts`. |
| 2.2 | Prospects at `/admin/growth/prospects` and a company page: profile, contacts (suppressed ones flagged as never contactable), leads, signals, research briefs, score with reasons and factor table, and the full timeline oldest first. Manual create and edit of companies, contacts and leads; every change logged. `prospects.ts`, `prospectsModel.ts`, `activity.ts`. |
| 2.3 | Prospect Score (`scoring/prospect.ts`, pure): geography 10, sector 15 (real estate highest), project signal 20, funding or transaction signal 20, scale 15, decision-maker 10, recency 10; bands Priority 80+, Good 60 to 79, Watch 40 to 59, Low under 40; a known size under SAR 50 million is Low regardless; unknown size scores zero; two or three reasons. Override with a required reason; rescoring on every change; weights in Settings (database checks they sum to 100). Targeting titles and excluded work come from the approved Knowledge Base. |
| 2.4 | Research Agent (`agents/research.ts`): web search (Sonnet 5 by default), every fact must cite a URL the search actually returned or it is dropped and listed; emails removed; likely service limited to the nine, entry offer to approved offers. Briefs kept as history; Ahmad accepts chosen fields (description, sector, city, service, scale, decision-makers as contacts, triggers as signals). Mock briefs are labelled and can never be accepted (database constraint). |
| 2.5 | Pilot CSV import at `/admin/growth/prospects/import`: upload, map columns (guessed from headers), preview with validation, duplicate detection in the file and against the database, bulk suppression check (fails closed), dry run, then import as source Pilot; past outreach becomes a dated activity; suppressed emails imported as do not contact. |
| 2.6 | Daily signal feed (`feed.ts`) inside the one Growth cron `/api/cron/growth-daily` (09:00 Riyadh): keywords from Settings, evidence link required and checked against the search, stale or undated dropped, duplicates skipped, at most N per run, pausable, runnable by hand; mock mode is a labelled preview that saves nothing, and the scheduled run does not run in mock mode. Growth Home shows new signals, prospects by band, open leads and recent activity. |

Also in Phase 2: `runAi` now takes `webSearch` (priced at USD 0.01 a search) and returns the source URLs; the default model is **Claude Sonnet 5**, and each agent's model can be changed in Settings (`ai/agents.ts`). Engine settings (all phases) live in `engineSettingsModel.ts` / `engineSettings.ts` and are edited on the Settings tab "Signals, scoring, website and AI". Writes that carry columns from a later migration retry without them (`tolerant.ts`).

## Built (Phase 3, Outreach and Pipeline, 2026-09-23)

| Unit | What it delivered |
|---|---|
| 3.1 | Outreach Studio at `/admin/growth/outreach`: a queue of leads ready for a first message (highest Prospect Score, then freshest trigger), each showing what blocks it; AI drafts (`outreach-writer`, Sonnet 5) for email or LinkedIn that must cite the company's latest live signal with a real evidence link and link a relevant service page; edit, approve (refused while a placeholder such as [First name] is left), reject with a reason. LinkedIn drafts are copied (link filled) and marked sent by hand. `outreach.ts`, `outreachModel.ts`. |
| 3.2 | Sending (`sendMessage`): Settings readable and not paused, `checkSuppression` on every send, inside the sending window (else scheduled for the next one), under the daily cold cap (else the next day). Every email carries a tracked link and an opt-out link on the site's domain (`/api/growth/l/[token]`, `/api/growth/o/[token]`, new routes, no public page touched). Microsoft Graph (`graph.ts`, plain fetch, client credentials) sends from `MS_GRAPH_SENDER` once all four `MS_GRAPH_*` variables are set; until then sends are recorded as mock, labelled, nothing delivered, and the lead is not marked contacted. A mock draft can never be sent for real (code and database). |
| 3.3 | Follow-ups: due by `follow_up_days` after the first send, up to `max_follow_ups`, each drafted for approval. Replies found through Graph (by conversation) or marked by hand stop the sequence, cancel waiting follow-ups, move the lead to Replied and rescore it; a reply asking to stop is an opt-out. The daily cron runs reply check, follow-up drafts, scheduled sends, in that order. |
| 3.4 | Pipeline at `/admin/growth/pipeline`: board and table by stage with filters; lead page `/admin/growth/pipeline/[id]` with stage moves (lost asks why), meeting-request flag, opportunities (service, fee band, expected close, won or lost with reason), tasks with due dates, all messages and the full timeline. `pipeline.ts`. |
| 3.5 | Lead Score (`scoring/lead.ts`, `leadScore.ts`): ICP fit 25, clear need 20, scale 15, timeline 15, authority 10, engagement 10, meeting intent 5 (weights in Settings, sum 100 checked); Hot 71+, Warm 41 to 70, Cold 40 and under; a meeting request is always Hot; under SAR 50 million caps at Cold and wins over a meeting request; stored once the lead engages (reply, click, chat, meeting, meeting request). |

## Migrations 083 to 087 (all applied 2026-09-22)

All are DDL, hand-run in the Supabase SQL editor, safe to re-run, and carry a `SAFE TO APPLY` line.

| Migration | What it did |
|---|---|
| 083 `growth_core` | growth_companies, growth_contacts, growth_leads, growth_signals, growth_activity. Normalised domain and email uniqueness, evidence link required on signals, generated `below_minimum` against SAR 50 million, append-only activity. |
| 084 `growth_knowledge_base` | growth_kb_items with working and approved copies, logging by trigger, the starter drafts; activity gains `clock_timestamp()`, a `seq` identity and `kb_item_id`. |
| 085 `growth_settings` | growth_settings (one row, every limit checked by the database, every change logged with old and new values) and growth_suppressions (never deleted; removal needs a reason). |
| 086 `growth_nine_services` | The nine site services on companies, leads and the Knowledge Base; five drafts converted, Feasibility Studies archived, four added; offer `related_service_slugs`; settings `priority_services`. |
| 087 `growth_ai_usage` | growth_ai_usage (every AI call, logged with actor `ai`, mock calls free by constraint), growth_ai_alerts (one per Riyadh month), and a single test settings row, id 2, for verifiers. |

Every Growth table has RLS on with no policies and every privilege revoked from `anon` and `authenticated`. **088 (Phase 2) and 089 (Phase 3) are applied.** The next migration is **090**; follow the same pattern and extend `GROWTH_TABLE_MIGRATIONS` in `src/lib/growth/db.ts`. `docs/PENDING_MIGRATIONS.md` is the list of record.

## Standing rules

1. **Admin only.** `/admin/growth` is in `ADMIN_ONLY_PREFIXES`; every Growth page calls `requireGrowthSession()`; every Growth API route calls `requireOwner()`.
2. **Every AI call goes through `runAi`** (`src/lib/growth/ai/run.ts`). No agent imports a provider or the Anthropic SDK; only `ai/anthropic.ts` does.
3. **`checkSuppression` before any send** (`src/lib/growth/suppression.ts`). Send only when it returns not suppressed; it fails closed.
4. **Limits come from settings, never hardcoded**, read through `getGrowthSettings()`. Nothing sends or spends when settings cannot be read or the budget is empty.
5. **One service list**, `src/config/services.ts`, read through `GROWTH_SERVICES`. Never keep a second list.
6. **Test rows only in verification.** Test data carries `is_test = true`, every delete a verifier sends is filtered on it, and settings tests use the test row (id 2), never the real row.
7. **Mock mode until `ANTHROPIC_API_KEY` is set.** Mock output is labelled in its text and with a Mock badge, and must stay labelled wherever it is shown.
8. **Auto-merge when every check passes**, then confirm the production deploy through `/api/health`, then start the next unit given.
9. **Stop only for migrations** Ahmad must apply by hand (wait for "applied"), a failed check, or a decision that is his.
10. **No em or en dashes** anywhere: code, comments, commits, migrations, docs, UI text, replies. The dash gate in `CLAUDE.md` must return zero.
11. **The public website does not change** (Phase 2 to 7 brief). Growth admin work stays under `/admin/growth`; public-facing pieces are built disabled by a setting that defaults to off and add nothing to a page while off. `publicChanges()` in `scripts/lib/growthVerify.mjs` fails a verifier on any public file changed since 93c3e98.
12. **Never stop for a migration** (Phase 2 to 7 brief): write it, list it in `docs/PENDING_MIGRATIONS.md`, keep building; verifier checks that need it report PENDING.
13. **Mock output is never saved as real data**: mock briefs cannot be accepted, the mock feed saves no signals, and later phases keep the mock flag on anything they store.

## Verifiers

Each runs offline and read-only by default; `-- --write-test-rows` adds the live phase, which writes only `is_test` rows to Growth tables and removes them.

| Command | What it proves |
|---|---|
| `npm run verify-growth-data` | The data model matches the migrations, admin-only access in all three places, and (live) records can be created, linked and read back, the below-minimum flag, de-duplication and validation rules, append-only activity, anon refused. |
| `npm run verify-growth-kb` | Knowledge Base kinds and rules, the nine services and offer links, and (live) create, approve, edit while approved (agents keep the approved copy), archive and restore, the log with who and when, activity order, anon refused. |
| `npm run verify-growth-settings` | Defaults and limits in app and database, suppression rules including a later opt-out caught live, retention preview read-only, audit filters, integration status never showing values; the real settings row checked untouched field for field. |
| `npm run verify-growth-ai` | Prices, Riyadh months, budget and mock rules, and (live) a mock call labelled and free and in the audit log, every refusal and failure recorded, the budget alert once a month and retried after a failed send, shared domains needing confirmation. |
| `npm run verify-growth-outreach` | Phase 3: window and cap in Riyadh time, follow-up timing, placeholders, email body with tracked and opt-out links, safe redirects, the Lead Score rules, migration 089, gates; (live) approve, schedule, mock send, suppression refusal, database refusal of a mock draft sent for real, click, reply, opt-out, opportunity and tasks. 86 checks, all passing 2026-09-23. |
| `npm run verify-growth-prospecting` | Phase 2: score rules and bands, the SAR 50 million rule, evidence and duplicate rules, the research source check, the feed screen, CSV plan, migration 088, admin-only gates, no dashes, public site untouched; (live) signals, duplicates, triage, stored scores, overrides, a refused research run, a dry run and an import. 97 checks, all passing 2026-09-23. |

Also run `npm run typecheck`, `npm run build`, the other verifiers (`verify-production-guard`, `verify-tools-visibility`, `verify-tool-followup`, `verify-brevo-webhook`, `verify-booking-links`) and the dash gate before merging.

## Open items for Ahmad

- **Set the monthly AI budget** in Growth Settings. Until then every AI call is refused, mock or real.
- **Approve Knowledge Base items**, at least the services, messaging, disallowed content and targeting rules. Agents will refuse to run until the kinds they need have approved items. Map nothing: services already link to their site pages.
- **Add signal keywords** in Growth Settings, tab "Signals, scoring, website and AI". The morning feed does nothing without them.
- **Approve the targeting rules** (decision-maker titles, excluded work): the Prospect Score reads them.
- **Approve messaging and disallowed content** in the Knowledge Base: the outreach writer refuses to draft without them.
- **Microsoft Graph for sending** (when ready): an Entra app registration with Mail.Send and Mail.Read application permissions (ideally limited to your mailbox by an application access policy), then set `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET` and `MS_GRAPH_SENDER` on Vercel (Production). Until then outreach is mock: nothing is delivered.
- **Add the Anthropic API key** later: set `ANTHROPIC_API_KEY` on Vercel (Production) and redeploy. The real Claude API takes over with no code change.

## Known risks carried forward

- The budget can be overshot by the last call of a month: a call is refused only once spend has reached the budget. Agents should set sensible `maxTokens`.
- AI prices are in `src/lib/growth/ai/pricing.ts`; update them when Anthropic's prices change.
- The nine service slugs are also in database constraints: adding or renaming a site service needs a migration as well as a config change (the verifiers flag drift).
- Previews and local runs use the production database: keep `is_test` on anything created while testing. Content created through the admin UI on a preview is real.
- A domain suppression covers every address under it; shared providers need confirming, but any other broad domain does not.
- The retention preview relies on lead stages until outreach tracks replies.
- Changing the SAR 50 million minimum needs a migration (the flag is computed in the database).

## Next up

Phase 4 (Website AI, built disabled): migration 090, then 4.1 chat backend (Knowledge Base answers, qualification, consent, routing, guards, rate limits), 4.2 the widget mounted behind the chat_widget_enabled setting (off by default, nothing added to a page while off), 4.3 Conversations screen and valuation tool lead links. Then Phases 5 to 7 per the brief.
