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
| 089 | `089_growth_outreach.sql` | Phase 3: messages with approval, scheduling, sends and replies (mock drafts can never be sent for real, by constraint; status changes logged by trigger); tracked links and clicks (site paths only); opportunities (lost needs a reason); tasks; lead sequence, reply and meeting-request columns; settings for pausing outreach and Lead Score weights | Applied (found applied 2026-09-23 when verifying Phase 3) |
| 090 | `090_growth_website_chat.sql` | Phase 4: conversations and chat messages (contact details only with consent, consent wording and time recorded, by constraint), chat settings with the widget OFF by default, one Growth lead per valuation tool lead | Applied (found applied 2026-09-23 when verifying Phase 4) |
| 091 | `091_growth_meetings.sql` | Phase 5: meetings from Microsoft Bookings or added by hand (unique per appointment, outcome only after the call is held, mock rows never Bookings rows), briefs, notes and outcomes; `growth_messages.meeting_id`; settings `bookings_url` (https or empty) | Applied (found applied 2026-09-23 when verifying Phase 5) |
| 092 | `092_growth_nurture_partners.sql` | Phase 6: nurture subscription on contacts (needs opted-in consent, by constraint), sequence steps and lead magnets (approval recorded), message opens and clicks, Brevo events once each, partners, check-ins, introductions, referral partner and source on leads, settings `nurture_enabled` (default off) and `partner_checkin_days` | Applied (found applied 2026-09-23 when verifying Phase 6) |
| 093 | `093_growth_intelligence.sql` | Phase 7: growth_scoring_reviews, the record of each scoring review and its decision (suggested weights checked to sum to 100, a rejection needs a note). The Daily Brief and Analytics need no migration | **Pending.** Until applied, reviews can be run and read but not saved or approved; `verify-growth-intelligence -- --write-test-rows` reports its live checks as pending |
