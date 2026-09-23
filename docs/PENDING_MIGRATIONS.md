# Growth Engine migrations: applied and pending

Every Growth migration is DDL and is pasted into the Supabase SQL editor by hand, in order. Each one is idempotent and carries a `SAFE TO APPLY` line in its header. The code builds and runs whether or not a migration is applied: screens that need it show a notice naming it, and anything that would send, spend or show something public refuses until it is there.

Tell the build session "088 applied" (or whichever) and it re-runs the live checks that were pending.

| # | File | What it does | Status |
|---|---|---|---|
| 083 | `083_growth_core.sql` | Companies, contacts, leads, signals, append-only activity | Applied 2026-09-22 |
| 084 | `084_growth_knowledge_base.sql` | Knowledge Base with working and approved copies | Applied 2026-09-22 |
| 085 | `085_growth_settings.sql` | Settings row and the suppression list | Applied 2026-09-22 |
| 086 | `086_growth_nine_services.sql` | The site's nine services on companies, leads and the Knowledge Base | Applied 2026-09-22 |
| 087 | `087_growth_ai_usage.sql` | AI usage records, monthly budget alert, test settings row | Applied 2026-09-22 |
| 088 | `088_growth_prospecting.sql` | Phase 2: signal origin, evidence key, duplicate flag, triage record; company source, scale and Prospect Score with override; research briefs (mock never accepted); feed runs (scheduled once a Riyadh day); imports; settings for keywords, feed, scoring weights, agent models | Applied (found applied 2026-09-23 when verifying Phase 2) |
