# Growth Engine build log

One line per unit: status, commit, pending items. Newest last. Detail is in `docs/GROWTH_ENGINE_STATUS.md`.

| Unit | What | Status | Commit | Pending |
|---|---|---|---|---|
| 1.1 to 1.5 | Phase 1 foundation (shell, data layer, Knowledge Base, settings, suppression, AI layer) | Live | 93c3e98 | None |
| 2.1 | Signal Inbox: manual signals with required evidence, triage (convert, attach, dismiss with reason, reopen), duplicate flagging, filters | Merged | see git log `feat(growth): signal inbox` | None (088 applied) |
| 2.2 | Prospects list and company page: profile, contacts, leads, signals, briefs, score, timeline; manual create and edit | Merged | `feat(growth): prospects` | None |
| 2.3 | Prospect Score: seven weighted factors, bands, SAR 50 million rule, reasons, override with reason, automatic rescoring, weights in Settings | Merged | `feat(growth): prospect score` | None |
| 2.4 | Research Agent: web search, every fact sourced and checked against what the search returned, briefs kept, accept chosen fields; per-agent models, Sonnet 5 default | Merged | `feat(growth): research agent` | Real runs need an Anthropic key, a budget and approved services and offers |
| 2.5 | Pilot CSV import: map, preview, dry run, import as Pilot, past outreach as dated activity, suppressed emails flagged | Merged | `feat(growth): pilot import` | None |
| 2.6 | Daily signal feed (09:00 Riyadh cron, keywords in Settings, evidence required, duplicates skipped, pausable, manual run, mock preview only) and Growth Home counts | Merged | `feat(growth): signal feed and home` | Real runs need an Anthropic key, a budget and keywords |
