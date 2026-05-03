-- 010_seed_service_detail_content.sql
-- Seed cms_content rows for each of the 9 service detail pages. Uses the
-- namespace pattern `section = 'service_<slug>'` with discrete keys per field
-- (matches the existing namespace convention in CLAUDE.md §4 — discrete keys
-- preferred over bundled JSON blobs). The exception is `deliverables`, which
-- is naturally a list and is stored as a JSON array; the route renderer parses
-- it robustly (JSON first, falls back to newline-split).
--
-- Idempotent via ON CONFLICT (section, key) DO NOTHING — re-running this
-- migration after admin edits will NOT overwrite their content.

INSERT INTO cms_content (section, key, value) VALUES
  -- 01 · Financial Modeling
  ('service_financial-modeling', 'full_description', '<p>Institutional-grade financial models built for board, lender, and investor scrutiny. Three-statement, project-finance, and scenario models calibrated to the decision the model is meant to inform — not to a generic template.</p><p>Every workbook ships with a written methodology note, a transparent assumption sheet, and the live sensitivities a sophisticated reviewer will ask for.</p>'),
  ('service_financial-modeling', 'deliverables', '["Three-statement integrated model", "Scenario and sensitivity layer", "Documented assumption sheet", "Methodology note", "Driver-based summary outputs", "Live model walk-through with the team"]'),
  ('service_financial-modeling', 'timeline_text', 'Typical engagement: 4–6 weeks for an institutional model, depending on data-room readiness and review cycles.'),
  ('service_financial-modeling', 'target_audience_text', 'Family offices, corporates, and lenders who need a model that survives diligence and supports a real decision — not a polished spreadsheet.'),

  -- 02 · Business Valuation
  ('service_business-valuation', 'full_description', '<p>Independent business valuations for transactions, fairness opinions, dispute settings, shareholder buyouts, and strategic planning. Every valuation triangulates DCF with comparable transactions and trading multiples — and explains, in writing, where the methods agree and disagree.</p><p>Reports are written for a board, lender, or court audience. Methodology is defensible. Assumptions are sourced. Sensitivities are real.</p>'),
  ('service_business-valuation', 'deliverables', '["Three-method valuation with reconciliation", "Standalone written report (board-ready)", "Underlying DCF and comparables workbooks", "Sensitivity tornado and scenario tables", "Q&A support during negotiation or review"]'),
  ('service_business-valuation', 'timeline_text', 'Typical engagement: 3–5 weeks from kickoff, depending on data-room readiness and review cycles.'),
  ('service_business-valuation', 'target_audience_text', 'Family offices, corporates, and lenders requiring an independent, defensible value conclusion.'),

  -- 03 · Financial Due Diligence
  ('service_financial-due-diligence', 'full_description', '<p>Buy-side and sell-side quality-of-earnings, working-capital, and net-debt analyses. We go beyond reconciling the trial balance to the audited statements — we surface the accounting treatments, one-off items, and run-rate adjustments that actually change the deal price.</p><p>Findings are written for the deal team. No filler. No 200-page decks no one reads.</p>'),
  ('service_financial-due-diligence', 'deliverables', '["Quality-of-earnings analysis with adjustments", "Working capital normalisation", "Net debt and debt-like items schedule", "Customer / revenue concentration analysis", "Findings memo focused on price and structure"]'),
  ('service_financial-due-diligence', 'timeline_text', 'Typical engagement: 4–8 weeks, scaled to data-room volume and target complexity.'),
  ('service_financial-due-diligence', 'target_audience_text', 'Buy-side acquirers, sell-side sponsors, and lenders evaluating credit quality of an underwriting target.'),

  -- 04 · Transaction Advisory
  ('service_transaction-advisory', 'full_description', '<p>End-to-end deal support from screening through close. We sit on the deal team — not adjacent to it — and own the analytical workstream from term sheet through definitive documents.</p><p>This is the engagement clients return for: senior involvement at every step, no hand-offs to junior teams, and a single accountable advisor through closing.</p>'),
  ('service_transaction-advisory', 'deliverables', '["Target screening and prioritisation", "Indicative bid modelling and structuring", "Deal-team analytical support through diligence", "Negotiation support on price and terms", "Close-mechanics modelling (working capital, leakage)"]'),
  ('service_transaction-advisory', 'timeline_text', 'Engagement length tracks the deal — typically 3–9 months from mandate to close.'),
  ('service_transaction-advisory', 'target_audience_text', 'Family offices, corporates, and sponsors who want a senior advisor embedded in the deal — not a vendor running a process at arm''s length.'),

  -- 05 · M&A Advisory
  ('service_mergers-acquisitions', 'full_description', '<p>Sell-side mandates, buy-side searches, and strategic combinations across the GCC and worldwide. We run focused, well-prepared processes — not auctions optimised for headline volume.</p><p>For sellers: a defensible information memorandum, a curated buyer list, and disciplined process management. For buyers: targeted searches calibrated to a specific investment thesis.</p>'),
  ('service_mergers-acquisitions', 'deliverables', '["Information memorandum or buyer thesis document", "Curated counterparty list", "Process management through term sheet and SPA", "Negotiation support on price, structure, and reps", "Closing coordination with legal and tax advisors"]'),
  ('service_mergers-acquisitions', 'timeline_text', 'Sell-side: 6–12 months from mandate to close. Buy-side searches: 3–9 months to first qualified term sheet.'),
  ('service_mergers-acquisitions', 'target_audience_text', 'Owners considering an exit, corporates pursuing strategic acquisitions, and family offices building or rationalising portfolios.'),

  -- 06 · Real Estate Modeling
  ('service_real-estate-modeling', 'full_description', '<p>Hospitality, residential, mixed-use, and master-plan models with phased construction draws, IRR waterfalls, and exit scenarios. Built to the standard a sophisticated lender or institutional partner will accept without rework.</p><p>Includes residual land valuation, development feasibility, and portfolio cash-flow models for owners and operators across the GCC.</p>'),
  ('service_real-estate-modeling', 'deliverables', '["Development cash-flow model with phased draws", "Equity / debt waterfall and IRR distribution", "Residual land valuation (where applicable)", "Sensitivities on cost, sales pace, and exit cap", "Lender and partner-ready output summary"]'),
  ('service_real-estate-modeling', 'timeline_text', 'Typical engagement: 3–6 weeks per asset, longer for master-plans and portfolio rollups.'),
  ('service_real-estate-modeling', 'target_audience_text', 'Real estate developers, family-office principals, and institutional investors underwriting GCC real estate.'),

  -- 07 · Project Finance
  ('service_project-finance', 'full_description', '<p>Bankable models for infrastructure, energy, and industrial projects, structured for senior-debt sizing, DSCR covenants, and reserve accounts. Built to lender-modelling standards from day one — not converted from a corporate template.</p><p>Includes construction draw scheduling, debt service waterfalls, and the covenant testing lenders require during credit-committee review.</p>'),
  ('service_project-finance', 'deliverables', '["Bankable project finance model", "Senior-debt sizing and DSCR sculpting", "Reserve account and waterfall mechanics", "Lender Q&A support through credit committee", "Sensitivity and stress testing per lender requirements"]'),
  ('service_project-finance', 'timeline_text', 'Typical engagement: 6–10 weeks to first bankable draft, plus iteration through lender diligence.'),
  ('service_project-finance', 'target_audience_text', 'Project sponsors, developers, and lenders underwriting infrastructure, energy, and industrial projects across the GCC.'),

  -- 08 · Investment Memorandums
  ('service_investment-memorandums', 'full_description', '<p>Information memoranda, teasers, and pitch decks calibrated to family offices, strategics, and institutional capital. Written by people who have been on the receiving end — we know what gets read, what gets skipped, and what raises a flag.</p><p>Each document is built backward from the questions a sophisticated investor will ask in the first thirty minutes.</p>'),
  ('service_investment-memorandums', 'deliverables', '["Investor-ready information memorandum", "One-page teaser for outreach", "Management presentation deck", "Q&A document anticipating diligence questions", "Distribution and outreach support"]'),
  ('service_investment-memorandums', 'timeline_text', 'Typical engagement: 4–8 weeks depending on the depth of supporting materials and management availability.'),
  ('service_investment-memorandums', 'target_audience_text', 'Founders, owners, and CFOs raising capital or running a sale process who need credible, investor-ready materials.'),

  -- 09 · CFO Advisory
  ('service_cfo-advisory', 'full_description', '<p>Fractional CFO engagements covering FP&amp;A, treasury, capital structure, and board reporting for growth-stage companies and family-office portfolio assets. Senior involvement on the cadence the business actually needs — not a templated weekly checklist.</p><p>Engagements typically run on a multi-quarter retainer with clearly scoped deliverables and review cadence.</p>'),
  ('service_cfo-advisory', 'deliverables', '["Monthly board pack and KPI dashboard", "Rolling 12-month forecast and cash management", "Capital structure and debt facility review", "Audit and statutory reporting coordination", "Strategic finance input on key decisions"]'),
  ('service_cfo-advisory', 'timeline_text', 'Multi-quarter retainer; typical engagements run 6–18 months with quarterly review cycles.'),
  ('service_cfo-advisory', 'target_audience_text', 'Growth-stage companies and family-office portfolio assets that need senior finance leadership without a full-time hire.')
ON CONFLICT (section, key) DO NOTHING;
