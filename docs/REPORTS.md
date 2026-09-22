# Report theme reference

Moved verbatim from `CLAUDE.md` on 2026-09-22 (original kept at `docs/archive/CLAUDE.md.bak-2026-09-22`). Contradictions found in the split were resolved to the current behaviour; each such line is noted in `docs/HISTORY.md` under 2026-09-22.

**Read this before:** changing any tool PDF report's look, the letterhead, logos, or adding a new tool report.

### Report theme

Added 2026-09-17 (`feat/report-brand-theme`). **Every tool PDF report uses one
shared theme**, so the Investor Readiness Scorecard and any later report look
like the valuation report without copying it.

| What | Where |
|---|---|
| Letterhead colours and the legal line, shared with the tool emails | `src/lib/brand/letterhead.ts` |
| Report colours (`RC`), chart palette (`REPORT_CHART_PALETTE`), type scale, page geometry, fonts, letterhead geometry, branding types | `src/lib/tools/pdf/theme.ts` |
| Cover, inner page, closing page, footer, section heading, tables, KPI tiles, partner block, services, booking panel | `src/lib/tools/pdf/components.tsx` |
| The source letterhead | `reference/brand/PMBC Letterhead 09172026.pdf` (the header layout since 2026-09-17; colours unchanged from `PMBC_Letterhead.pdf`) |

**Colours, sampled from the letterhead** (vector fills and a 3x render, matching
the Header Settings logo file): navy `#153D64`, green `#2E8B3A`, deep green
`#1E5825`, gold `#C9A227`, grey `#595959`. The website keeps its own tokens;
the results dashboard charts use `SITE_CHART_PALETTE` (the default in
`charts.ts`) and are unchanged, while reports pass `REPORT_CHART_PALETTE`.

- **Navy is primary**: headings, rules, table headers, actual years in charts.
- **Green is the accent**: forecast series, free cash flow, positive indicators, section markers, small accent shapes, the booking button.
- **Gold is minimal**: the tagline, the base case marker, at most one small highlight on a page. No gold fills, no large gold text.
- White pages, light neutral table shading, warnings in `#B3412F`.

**Pages.**
- **Cover** (`ReportCover`): the letterhead header, measured from the letterhead PDF's vector paths and a 3x render (`LETTERHEAD` in `theme.ts`): a navy bar at the very top edge, the green swoosh (three copies of one shape, two shaded and one solid) hanging from it on the right, and the logo on the left below the bar, drawn 22% smaller than the letterhead's (31.7pt tall), as the owner chose. **No tagline in the header** on any page: the tagline appears in the footer only (the letterhead file prints one below the swoosh; reports deliberately do not). Everything is scaled by the same factor in both directions, so the swoosh is never stretched or cut off. **The bar and the swoosh are drawn 1.5pt past the top and right edges** (`HEADER_BLEED`, since 2026-09-21): the layout grid is 595pt but A4 is 595.28pt, and a header ending at the grid left a white hairline down the right at zoom. `verify-tool-email-pdf` reads the drawing operators on the cover, an inner page and the closing page and fails on any gap. Then company, report title, headline range and date, and the report footer.
- **Inner pages** (`ReportPage`): `InnerHeader`, a thin navy bar at the top edge with a small copy of the same swoosh on the right (scale 0.42). No logo or tagline in the header; content starts high; the footer.
- **Footer**, the same on every page, cover and closing page included (no page carries the letterhead's footer band): small logo, "PaceMakers Business Consultants LLP" and the tagline on the left; tool name, company, date and "Page X of Y" on the right; the same navy rule with a green accent above it. Long company names are shortened.
- **Closing page** (`ClosingPage`): the letterhead header, the closing content, the **legal line and contact details, stated once in the report** (`LegalAndContact`), and the report footer. The contact details come from Site Settings (advisory email, site, office location); the letterhead's phone number is not in Site Settings and is not printed.
- **Logos**: `BrandLogo` uses the colour file on white and the white file on a dark background, **the original Header Settings files exactly as stored** (not resized, trimmed, traced, flattened or recoloured; since 2026-09-17, after reduced copies looked blurry), drawn at each file's own proportions (`imageRatio`). react-pdf embeds the file once however many pages draw it, so the report stays under 400 KB. Bundled byte-for-byte copies in `src/lib/tools/pdf/brand/` are the fallback, and the tool emails use byte-for-byte copies in `public/email/` (`pacemakers-logo.png` colour, `pacemakers-logo-on-navy.png` white), drawn at 22px high with explicit width and height attributes. **Replace all four copies when Header Settings changes the logo.** The PDF copies are traced into the PDF routes next to the fonts (`next.config.ts`).
- **Branding is never silently missing**: `renderValuationReport` fetches branding itself when `meta.branding` is left out, so a render without it still has the logo, the founder block and the contact details; pass `null` only to render deliberately without them. The website address is always `SITE_ADDRESS`, printed in full as `https://www.pacemakersglobal.com` (since 2026-09-21), never the environment, so a local render cannot print localhost. Every absolute link a PDF or tool email carries (booking links and their QR code, the alert's dashboard link, the email footers) is built on `SITE_HREF` for the same reason. The cover's market data label is the one for the data behind the figures (`result.meta.dataVersion`).
- An absolutely positioned block that reaches into the page's bottom padding must be `fixed`, or react-pdf keeps moving it to a new page and never finishes the render.

**Adding a tool report.**
1. Fetch branding with `fetchReportBranding()` and resolve it with `withBrandDefaults`.
2. Build a `ReportDetails` (tool name from the registry, company or person, date).
3. Compose `ReportCover`, then `ReportPage`s, then `ClosingPage` with `PartnerBlock`, `ServicesGrid` and `BookingPanel`, from `Section`, `DataTable`, `KeyValues`, `Tiles`, `KpiRow`, `Callout` and `PdfChart` with `REPORT_CHART_PALETTE`. No colours or page chrome in the tool's own file.
4. Emails: `baseLayoutBranded(body, { variant: 'report' })` gives the letterhead shell (the original colour logo `public/email/pacemakers-logo.png`, green and navy accent, legal line). The contact, password and testimonial emails keep the site shell, and `email_branding` overrides apply to the site shell only.
5. Add the footer, colour and logo checks for the new report, as `verify-tool-email-pdf` does for the valuation report.

The letterhead's legal line reads "LLP Act, 2007"; reports use the Act's actual year, 2017, as the site's legal pages do.
