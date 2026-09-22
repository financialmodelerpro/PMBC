# Business Valuation reference

Moved verbatim from `CLAUDE.md` on 2026-09-22 (original kept at `docs/archive/CLAUDE.md.bak-2026-09-22`). Contradictions found in the split were resolved to the current behaviour; each such line is noted in `docs/HISTORY.md` under 2026-09-22.

**Read this before:** changing the valuation engine, its inputs, checks, formats, the results page, or the valuation report content.

### Business Valuation version 2

Everything below is on by default in a neutral state, so a visitor who touches
none of it gets exactly the version 1 figures, and `verify-valuation-engine`
still matches the reference at 518 checks.

**The page.** Navy hero with the promise and three chips (registry `chips`), a
numbered step bar where reached steps are clickable, Back on every step and the
gate, and a sticky live summary beside the form on large screens (a compact
expanding bar below 1024px). The summary unlocks the range once the gate is
passed. Results are a dashboard: count-up range card, tiles, exploration
sliders, and six tabs (Summary, DCF, Comparables, Scenarios, Sensitivity,
Assumptions), then "Who you will work with" and the booking call to action.

**What the engine added** (`engine.ts`, all optional inputs):

| Feature | Rule |
|---|---|
| Private company discount | Applies to the exit multiple as well as the comparables (`exitMultipleApplied`). Defaults to 20% once two or more peers are in use (`syncPrivateDiscount`), 0 otherwise; a typed value (`discountTouched`) is kept. |
| Scenarios | Upside and downside move every forecast year's revenue growth and EBITDA margin by points (`scenarioFinancials`), each valued in full. Weights must total 100. `weightedEquity` is the weighted midpoint. |
| Normalised EBITDA | One-off costs and owner costs above market are added back to the last actual year for comparables and the LTM multiple. Owner costs, and only those, can be carried into the forecast, which changes the DCF. |
| Bridge items | End of service benefits, leases, minority interest (deducted) and surplus assets (added), beyond net debt. With none entered the reference's `ev - netDebt` is kept exactly. |
| Stake | Percent of equity, with a minority discount on the DCF part of the blend only, or a control premium on the comparables part only (since 2026-09-21). Shown only when not 100% with no adjustment. **A stake of 50% or less defaults to a minority discount** (`syncStakeAdjustment`, until the visitor picks one); a control premium chosen for it is kept, used, and warned about. |
| WACC adjustment | Points added by the exploration slider. Zero keeps the reference WACC bit for bit. |
| Company profile (`inputs.profile`) | A company name (120 characters) and one or two paragraphs about the business (1,000 characters), typed on step 1. **Never read by the engine.** Cleaned to plain text by the API schema itself (control characters, whitespace, two paragraphs, the caps), so every endpoint stores and renders the same text. The name fills the gate's company field and the results headline; the description goes on the PDF cover, marked as the visitor's words and not reviewed by the firm. Optional, so it did not bump the input schema version. |

**Warning rules** (`WARNING_RULES` in `data.ts`, text in `format.ts`):
terminal value above 75% of the DCF; perpetual growth above the currency's
`growthCeiling` (4.0 for the GCC currencies, 9.0 for PKR); exit multiple after
the discount more than 30% from the multiple implied by perpetuity growth;
negative free cash flow in the final forecast year; a first forecast year margin
more than 10 points from the last actual (normalised); ROIC below WACC; and
growth more than 2 points from reinvestment rate times ROIC (these two need
invested capital); terminal growth more than 1 point below or 2 points above
expected local inflation (the inflation entered on step 3, or long-run US
inflation, `MARKET.usInflationLongRun`, for the pegged currencies); and a control
premium on a stake of 50% or less. Each is proved triggering and silent,
including at its edges, by `verify-valuation-v2`.

**Numbers quoted in prose come from the table they refer to.** The cost of
capital lever ("What would increase your value") is read from the sensitivity
grid by `waccLeverFromSensitivity`: the centre cell and one point lower WACC at
the same growth. It once used the flexed range, which also moved growth half a
point, and quoted a figure the table on the same report did not show. The
executive summary says the forecast carries most of the answer only when the DCF
weight is above 50%.

**Input schema versioning.** Stored inputs carry `schemaVersion`
(`INPUT_SCHEMA_VERSION`, now 4) inside the `inputs` JSONB, stamped by the server
whatever the browser sends. No migration: every version 2 block is optional and
`resolveExtras` fills an absent one with its neutral default, so a version 1
lead revives and formats unchanged. Bump the version when a stored input changes
meaning, and branch on it in `resolveExtras`, never by guessing from shape.
Version 3: Saudi / GCC ownership is required for Saudi Arabia with no default
(the example company fills it); older inputs without it mean 0% (corporate tax,
as they were valued). Version 4: borrowings (`debt`) and cash are entered
separately, both required (0 allowed) in every country, and the engine derives
net debt as borrowings less cash on every run (`withNetDebtFromBalances`), so
a net debt figure the browser sends is ignored; cash also adds to the Saudi
zakat base. The server stamps version 4 only when borrowings are sent, so a
page from before the change still saves, as version 3 with net debt as entered.
`balancesFromInputs` splits version 3 inputs into borrowings and cash with the
same net debt and zakat cash.

Added 2026-09-17, all optional and neutral when unused (no schema bump):
**zakat rate** (`zakatRate`, Saudi Arabia only, 2.5% by default via
`TAX.zakatRate`, 0 to `TAX.maxZakatRate` 10%; notes and assumptions state the
rate used); **invested capital in two parts** (`investedCapitalParts`: working
capital, blank meaning the last actual year's net working capital, plus net
fixed assets; `withDerivedInputs` sums them, overriding a single
`investedCapital`, which stored inputs and verifiers may still use); and
**EV / EBIT from peers** (`Peer.evEbit`, at least two needed, on last actual
EBIT after the private company discount), a reference row in value by method
and on the results page that never enters the blend. The PDF keeps it off page
6, the tightest page.

### Business Valuation version 3

Shipped 2026-09-17 (`feat/valuation-engine-report-v3`). Input schema version 3 at ship; 4 since borrowings and cash were split (see "Input schema versioning" under version 2).

**One result object.** `engine.ts` returns a canonical `ValuationResult`
(`forecast`, `terminal`, `dcfBlock`, `comparables`, `blend`, `bridge`,
`scenarios`, `raise`, `checks`, `recommendations`, `tax`, `meta`) and the
results page, PDF, emails, admin view and verifiers all read it. Nothing
downstream computes a value; rounding happens only in `format.ts`.

**Method changes from the reference** (all marked CHANGED in `engine.ts`):

| Area | Rule |
|---|---|
| Terminal value | Perpetuity on a normalised terminal cash flow (`terminalCashFlow`): NOPAT at g, net capex scaled to g over final year growth, working capital at g. **Reinvestment is at least NOPAT x g / RONIC** (since 2026-09-21), RONIC the WACC of each run plus `TERMINAL.ronicPremiumPoints` (0), so growth beyond the forecast adds no value it has not paid for; the scaled capex alone implied returns of 40% to 50% on new capital. A business whose own figures imply more reinvestment keeps them; the top-up is added to net capex. Implied terminal multiple, reinvestment rate and implied terminal ROIC (g over reinvestment rate) are reported. |
| Valuation date | The server's date. Year one keeps (1 - f) of its cash flow, periods (1 - f) / 2 then (i - 0.5) - f, terminal at N - f (`stubPeriod`). A last actual year 12 months or more old is refused. Financial years end on the last day of the month chosen on step 1 (`fyEndMonth`, December by default, since 2026-09-21); the report says "assumed to end on 31 December" only for December (`financialYearEndNote`). |
| Net debt | Borrowings less cash at the year end (both entered, from input version 4), rolled forward to the valuation date: less the elapsed year one forecast cash flow, plus after-tax interest on positive net debt at the pre-tax cost of debt. One figure for every scenario. |
| Tax and zakat | Saudi / GCC ownership is required for Saudi Arabia, no default (the example company fills 100%). Income tax on the non-GCC share only; zakat 2.5% of an approximate base, working capital plus optional year end cash (`zakatBase`, cash held flat, floored at zero), disclosed as possibly understated when cash is blank. The same income tax rate is used for FCFF, terminal NOPAT, cost of debt and beta relevering. |
| Losses | Carried forward from the actual years, offset capped per country (`lossOffsetCap`: Saudi Arabia 25%, UAE 75%, else 100%). |
| Raise | Optional amount when raising equity: pre-money, post-money, investor stake. |
| Market data | Treasury 5.00% dated 15 September 2026 (`usTreasury10yAsOf`), implied ERP 4.14% as at 1 September 2026 (`IMPLIED_ERP_BY_MONTH`), data version 2026-09-17, footer "Market data: Damodaran 2026, risk-free 15 September 2026". |

`REFERENCE_METHOD` (old terminal cash flow, no loss carry-forward) exists only
for `verify-valuation-engine`, run with no valuation date and 0% ownership.

**Checks** (`checks.ts`) run on every result and report Pass or Warning: DCF
against comparables, terminal value methods, terminal value share, comparable
companies, capital structure, year one margin, EBITDA normalisation, last actual
EBITDA, growth ceiling, growth against inflation, terminal cash flow, terminal
returns against WACC (whenever implied terminal ROIC is measurable), and, with
invested capital, returns against WACC and growth against reinvestment; a
control premium check only when one is chosen. Thresholds are `WARNING_RULES`.
**Recommendations** (`recommendations.ts`) are chosen by rule and worded in
`format.ts`, never promising a higher value.

**Reconciliation.** `reconcile.ts` runs before every PDF render: headline and
bridge equity, blend, equity bridge for blended, DCF and each scenario,
probability weighting, sensitivity centre, terminal value share, implied EV /
LTM EBITDA, discount factors, and output hygiene. Throws outside production, logs
in production.

**Stored leads from before version 3** get their PDF and resend through
`leads/reportResult.ts`, which reruns their inputs under `REFERENCE_METHOD` and
so reproduces the figures they were sent.

**Pages.** The PDF is eight pages (below). Amounts print in thousands when
enterprise value and revenue are both under 10 million (`amountUnit`).
**Amounts in words are short** (`fmtBig`, since 2026-09-17): "SAR 450k", "SAR 12.5m",
"SAR 245m", "SAR 1.25bn", on the results page, in the emails and in the report,
which share the formatter, **in headlines, KPI tiles and sentences only**.
**A table cell prints the full figure** (`fmtTableAmount`, `headline().table`, since
2026-09-21): "SAR 385.2 million", or thousands for a small business as the other
tables. That covers the email summary tables, the stake tables on the results page
and in the report, and the admin lead list and version history.
`verify-tool-email-pdf` fails on a short amount in an email table cell.
`verify-valuation-engine` converts the reference's words ("million") before
comparing, so every figure is still matched exactly.

**Every run from the form is a new lead** (since 2026-09-21, replacing a same-day
rule that saved later runs in the tab under the first lead, which filed a second
company's valuation under the first company). Run valuation always shows the name
and email step, prefilled from `sessionStorage` (`pmbcValuationGate`: name, email,
purpose, deal size, follow-up and raise amount only, never a token, a company or
consent). The gate's company is step 1's name, or blank after a saved lead;
consent is ticked again for each lead. Submitting clears the previous token
first, so Email me this version and the PDF only ever reach the valuation on
screen. **Only the results page updates a valuation**: the sliders, and Email me
this version, which uses that lead's name and company and the current inputs.
**Start a new valuation** on the results page clears the form. The retired key
`pmbcValuationLead` is removed on load. The version route still accepts
`sendEmail: false` and its separate limit, which the page sends only for a run from a resumed valuation (`saveResumedRun` in `submit.ts`); an ordinary run never does.
`verify-valuation-dashboard` runs, at each width: a second run (prefilled gate, a
new lead, Email me this version on the new token), two companies in one session
via Load an example company after a real valuation, and a blank company twice.

**Report file name** (`src/lib/tools/pdf/fileName.ts`, one rule for the results
download, the email attachment and admin): "Acme Clinics - Indicative Business
Valuation - 21 Sep 2026.pdf", or "Indicative Business Valuation - Jane Smith -
21 Sep 2026.pdf" without a company, sent with a UTF-8 `filename*` so an Arabic
name survives. The company is the gate's, else step 1's. **Without a company the
report title and footer read "Your business"**, not the person's name.

**Every country Damodaran covers** (since 2026-09-22): 173 countries in `COUNTRIES`, the seven first unchanged, the rest generated from his January 2026 `ctryprem.xlsx` (rated and frontier tables) and `countrytaxrates.xlsx`. Left out: the three emirates he lists apart from the UAE, and North Korea and Somalia, which his tax file lacks. Each has its own currency and an indicative rate to SAR as at `FX_AS_OF` (size bands only). `pegged` is true only for dollar pegs and dollar users; every other currency takes the Pakistan inflation conversion, with a long-term inflation default set by PaceMakers. The country search pins the GCC and Pakistan (`PINNED_VALUATION_COUNTRIES`) above the rest and matches currency codes and common names ("UAE", "UK"). Cost of debt: the local benchmark where one was set (the seven), else the BIS central bank policy rate (60 countries, euro members on the ECB's), else built from risk-free plus default spread plus the margin, which `builtCostOfDebtNote` states in the sources. `Currency.country` identifies the country behind a shared currency such as EUR. Zakat stays Saudi Arabia only.

**Since 2026-09-23:** a benchmark rate more than 5 points above the country's inflation default (`ASSUMPTIONS.maxBenchmarkAboveInflationPoints`, `benchmarkStatus`) is not used and the cost of debt is built from the spreads, with the reason in the sources (Brazil, Colombia, Iceland, Russia, Turkey; Pakistan at 4.75 keeps KIBOR). Expected inflation of 15% or more, entered or default (`highInflationPercent`, `highInflationWarning`), puts a "Highly uncertain result" notice above the tiles on the results page and under the figures on the report cover. Exchange rates to SAR: ExchangeRate-API (open.er-api.com) mid rates as at `FX_AS_OF`, PKR included (0.0135), GCC at their pegs, with their own line in the report sources. `verify-valuation-engine` passes the current `sarPerUnit` values into the reference, as it does the market data.

**Cost of debt by country** (since 2026-09-21). Choosing a country fills the cost of
debt on step 3 with its local lending base rate plus the 2.0% margin
(`defaultCostOfDebt`), with the base rate, date and source in the field's hint and
in the report's sources. It stays editable; a typed rate is replaced when the
country changes, since it is in that country's currency; clearing it builds the
cost of debt from the spreads as before. `verify-valuation-engine` clears it, as
the reference tool only knows the spread build, and so does the v2 regression case.
**For a currency not pegged to the dollar the entered rate is converted once**:
to dollars by the inflation gap, blended with the dollar cost of equity, and the
blended WACC converted back once. `verify-valuation-v2` section 17 proves it: the
PKR equivalent of the spread-built cost of debt reproduces the spread-built WACC
exactly. The Saudi rate was rechecked on 2026-09-21: 27 August 2026 (Argaam) is
still the latest public 3-month fixing found; SAMA raised rates in mid-September,
so replace it when a later fixing is published.

**Control premium on the comparables part only** (since 2026-09-21). The DCF
values the company's own cash flows, so it already reflects control; trading
multiples are minority prices. Stake value = stake x (blended equity +
comparables weight x premium x comparables equity). **A minority discount
reduces the DCF part only** (same day): stake x (blended equity - DCF weight x
discount x DCF equity). `StakeResult.premiumBasis` and `discountBasis` mark the
new bases, the stake label says "on the comparables part" or "on the DCF part",
and `stakeBasisNote` explains why on the results page (not in the PDF, whose
page 5 has no line to spare). Results stored before keep the old basis.

**Normalisation against the forecast** (`normalisation_forecast`, since
2026-09-21): owner cost add-backs marked to continue are in every forecast year
(`normalisedFinancials`); owner costs not carried leave the DCF on reported
earnings, which is a warning. One-off costs never carry. **Add-backs above 20%
of reported EBITDA** (`addbacks_large`, `WARNING_RULES.addBackShare`) warn.
**Year one margin** warns both ways, against the last actual (normalised) margin.
Gaps read "within X%" rounded up (`fmtWithinPct`) and "differ by X%" rounded,
never 0%.

**Pages 6 and 7 flow; only the assumption tables are kept whole** (since
2026-09-21). Page 6 starts with the terminal value and comparables tables, then
the tax and balance sheet block (`PairedColumns keepTogether`, so "EBITDA,
normalised" never leaves its table), both of bounded height. Everything after
them breaks between rows or paragraphs: the check rows are direct children of
the page (a container of unsplittable rows was moved whole, which left page 6
half empty and gave nine pages), the methodology keeps only its title, heading
and first paragraph together, and "Important" breaks between paragraphs. The
timing rows sit in the shorter column when that is shorter ("Tax, zakat and
timing"). **`npm run verify-report-layout`** renders a matrix of country, stake,
normalisation, bridge items, peers, invested capital and margin (a spread of 120
by default, `LAYOUT_FULL=1` for all 973, about an hour) and requires eight pages,
page 6 at least 80% full, the block whole on page 6 and "Important" on page 7.
The reported case (Pakistan, 35% minority, owner costs not carried, EOSB and
leases) is first; it failed on the old layout.

**Check rows stay on one page where they fit** (`checksFitOnPage6`, since
2026-09-21): before drawing, the report estimates where the list lands (about
173pt plus 12.6pt per table row, calibrated against renders, residuals within
7pt) and its height (14.5pt a row, 25pt when the label or message may wrap), with
a 12pt margin. When it fits, heading and rows are kept whole; when it may not,
the rows break across pages 6 and 7 as before, so a gap never returns.
`verify-report-layout` checks every case the estimate keeps whole really is on
one page, and reports how many are (80 of 109 in the default sample; the rest are
the densest cases, whose list is taller than what page 6 has left).

**The revenue and EBITDA chart** (`revenueMarginSeriesChart`, report page 2, the
results page and the financials step) labels every year's EBITDA as well as
revenue since 2026-09-21: above the bar, or for a loss in brackets just above the
zero line.

**The cover tile** reads "Implied EV / LTM EBITDA (normalised)" when EBITDA is
normalised (`ltmMultipleLabel`), as the results tile and the check do. The
Discounting row reads "Mid-year", and unadjusted EBITDA "As reported", so neither
wraps in the report's narrow value column.

**The implied multiple check** measures against reported EBITDA when owner cost
add-backs are not carried into the forecast, since the DCF then values reported
earnings; otherwise normalised. **Growth and reinvestment** is worded in plain
English, in the direction of the gap.

**Implied multiple against comparables** (`multiple_vs_peers`, since 2026-09-21):
warns when the implied EV / LTM EBITDA is above the highest comparable EV / EBITDA
before the private company discount (the top of the preset range without peers).

**The company description** is on the cover's lower half and the results page's
Summary tab, as well as the admin lead view.

**Cost of capital working** (since 2026-09-21). `waccSteps` in `format.ts` works
the WACC through: levered beta, cost of equity, pre-tax and after-tax cost of
debt, weights, WACC, and for a currency not pegged to the dollar the conversion.
For those currencies the build runs in US dollars and every dollar line says so,
which is why a PKR WACC can sit above both component rates. Shown on step 3, on
the results page and on report page 5. **The company's own borrowing rate**
(`wacc.kd`, optional, in the valuation currency, above 0% and below 50%) replaces
the spread build; for an unpegged currency it is taken to dollar terms by the same
inflation gap. Blank keeps every earlier figure bit for bit.

**Exploration and versions.** The sliders recompute in the browser and save
nothing. **Email me this version** posts the explored inputs; the server
recomputes, keeps the replaced inputs and results as a `version_saved` event,
overwrites the lead, and resends the results email with a new report, limited
to 5 an hour and 20 a day per lead (staff exempt). The emailed version becomes
the new base, so Reset to base returns to it. **Download PDF** renders what is on
screen and writes nothing. Both need the lead's access token. The admin lead
detail shows the version 2 inputs, the warnings the visitor saw, and the version
history.

**The PDF is eight pages** (`REPORT_PAGE_TITLES`): valuation at a glance (cover with
range bar and KPI row), executive summary with financial profile, valuation
summary (value by method, bridge, pre and post-money when raising), FCFF with
the terminal column and sensitivity, scenarios and the factors that could
support a higher valuation, then checks and key assumptions flowing into
methodology, sources and disclaimer (pages 6 and 7 are one flowing section, so a
long check list moves text rather than adding a page), and working with
PaceMakers. Amounts print in thousands when enterprise value and revenue are
both under 10 million (`amountUnit`). Every serif style sets
`fontFeatureSettings: NO_LIGATURES`; a unitless `lineHeight` needs `fontSize` on
the same element. The logo and partner card come through `meta.branding`,
optional at every point. `npm run render-valuation-qa -- <dir>` renders ten test
cases and rasterises every page to PNG for inspection.

**Adding a scenario input or a bridge item.**
1. The type and its neutral default in `engine.ts` (`BridgeInputs` or `ScenarioInputs`, `defaultExtras`) and, for defaults a person tunes, `V2_DEFAULTS` in `data.ts`.
2. Validation in `validateCompany` or `validateTerminal`, and the arithmetic in `compute`, keeping the no-input path identical to today.
3. The zod schema in `leads/valuation.ts` (optional), the form field and `toInputs`/`stateFromInputs` in `state.ts`.
4. The rows in `format.ts` (`bridgeTable`, `bridgeSteps`, `scenariosTable`), which the page, the PDF, the email and the admin detail all read.
5. Checks in `verify-valuation-v2` for the item on its own and absent, then `verify-valuation-engine` to prove the neutral path.

**Verifiers.** `verify-valuation-engine` (518: 514 reference parity plus 4 on the market data passed into the reference),
`verify-valuation-v2` (875), `verify-tool-lead-api` (146), `verify-tool-followup` (48), `verify-report-layout` (see above),
`verify-valuation-dashboard` (453, the results page end to end, with the phone field lined up with the fields above it, the year end month, P/E and the resume link, at 1440, 1024 and 390, including the partner portrait's 4:5 frame and source ratio,
against a local `next start`, every /api/ request intercepted so nothing is
written), `verify-tool-email-pdf` (414, pdfjs text and operator list, including the report theme's footer, colour and logo rules, so a ligature glyph is
caught even though extracted text maps it back to letters),
`verify-tools-visibility` (97), `verify-brevo-webhook` (168), `verify-booking-links` (61) and
`verify-production-guard` (34). Each was
break-tested. `npm run render-valuation-examples -- <dir>` renders the minimal and
full-feature reports for review, reading the logo and partner read-only.
