# PMBC AI Growth Engine: status and handover

**Read this first in any Growth Engine session.** Last updated 2026-09-22, at the end of Phase 1. Production runs `main` at the commit that added this file; `/api/health` reports the live sha.

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

## Migrations 083 to 087 (all applied 2026-09-22)

All are DDL, hand-run in the Supabase SQL editor, safe to re-run, and carry a `SAFE TO APPLY` line.

| Migration | What it did |
|---|---|
| 083 `growth_core` | growth_companies, growth_contacts, growth_leads, growth_signals, growth_activity. Normalised domain and email uniqueness, evidence link required on signals, generated `below_minimum` against SAR 50 million, append-only activity. |
| 084 `growth_knowledge_base` | growth_kb_items with working and approved copies, logging by trigger, the starter drafts; activity gains `clock_timestamp()`, a `seq` identity and `kb_item_id`. |
| 085 `growth_settings` | growth_settings (one row, every limit checked by the database, every change logged with old and new values) and growth_suppressions (never deleted; removal needs a reason). |
| 086 `growth_nine_services` | The nine site services on companies, leads and the Knowledge Base; five drafts converted, Feasibility Studies archived, four added; offer `related_service_slugs`; settings `priority_services`. |
| 087 `growth_ai_usage` | growth_ai_usage (every AI call, logged with actor `ai`, mock calls free by constraint), growth_ai_alerts (one per Riyadh month), and a single test settings row, id 2, for verifiers. |

Every Growth table has RLS on with no policies and every privilege revoked from `anon` and `authenticated`. The next migration is **088**; follow the same pattern and extend `GROWTH_TABLE_MIGRATIONS` in `src/lib/growth/db.ts`.

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

## Verifiers

Each runs offline and read-only by default; `-- --write-test-rows` adds the live phase, which writes only `is_test` rows to Growth tables and removes them.

| Command | What it proves |
|---|---|
| `npm run verify-growth-data` | The data model matches the migrations, admin-only access in all three places, and (live) records can be created, linked and read back, the below-minimum flag, de-duplication and validation rules, append-only activity, anon refused. |
| `npm run verify-growth-kb` | Knowledge Base kinds and rules, the nine services and offer links, and (live) create, approve, edit while approved (agents keep the approved copy), archive and restore, the log with who and when, activity order, anon refused. |
| `npm run verify-growth-settings` | Defaults and limits in app and database, suppression rules including a later opt-out caught live, retention preview read-only, audit filters, integration status never showing values; the real settings row checked untouched field for field. |
| `npm run verify-growth-ai` | Prices, Riyadh months, budget and mock rules, and (live) a mock call labelled and free and in the audit log, every refusal and failure recorded, the budget alert once a month and retried after a failed send, shared domains needing confirmation. |

Also run `npm run typecheck`, `npm run build`, the other verifiers (`verify-production-guard`, `verify-tools-visibility`, `verify-tool-followup`, `verify-brevo-webhook`, `verify-booking-links`) and the dash gate before merging.

## Open items for Ahmad

- **Set the monthly AI budget** in Growth Settings. Until then every AI call is refused, mock or real.
- **Approve Knowledge Base items**, at least the services, messaging, disallowed content and targeting rules. Agents will refuse to run until the kinds they need have approved items. Map nothing: services already link to their site pages.
- **Add signal keywords** once Phase 2 builds that setting.
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

**Phase 2 (Prospecting), Units 2.1 to 2.6.** The brief will be provided in the next session. Agents built there call `runAi` with a `purpose` the mock already answers (`signal_research`, `prospect_brief`, `outreach_draft`, `qualification`, `meeting_brief`), name the Knowledge Base kinds they need in `requireKnowledgeKinds`, return a real evidence link for every signal, and read targeting rules and priority services rather than hardcoding them.
