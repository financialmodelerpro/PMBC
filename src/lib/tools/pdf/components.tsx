/**
 * Shared components for every tool PDF report, drawn with the report theme
 * (`theme.ts`). A tool report supplies only its content and its
 * `ReportDetails`; the page frame, the cover, the closing page, the footer,
 * headings, tables, tiles and the booking panel all come from here, so the
 * Business Valuation report and the Investor Readiness Scorecard cannot drift.
 *
 * THE THREE PAGE KINDS
 *   ReportCover    the letterhead header (colour logo top left, gold tagline
 *                  top right, green swoosh over a navy rule), the tool's cover
 *                  content, and the report footer.
 *   ReportPage     every inner page: a thin navy rule with a small green accent
 *                  at the top, content starting high, and the report footer.
 *   ClosingPage    the letterhead header, the closing content, the legal line
 *                  and contact details (stated once in the report), and the
 *                  report footer.
 * The footer is the same on every page. No page carries the letterhead's
 * footer band.
 *
 * LOGOS. `BrandLogo` picks the colour logo on white and the white logo on any
 * dark background. Both come from Header Settings, with bundled copies of the
 * same files as the fallback (`withBrandDefaults`), so the logo is drawn even
 * when the live files cannot be fetched. The letterhead geometry is measured from the letterhead PDF, see
 * `LETTERHEAD` in the theme.
 *
 * Relative imports only, so the verifiers can load this file outside Next.
 */

import type { ReactNode } from 'react';
import { Defs, Image, Link, LinearGradient, Page, Path, Rect, Stop, Svg, Text, View } from '@react-pdf/renderer';

import type { Table } from '../valuation/format';
import { PORTRAIT_RATIO } from '../../public/portrait';
import { PARTNER_RECORD_NOTE, type PartnerCard } from '../brand/partner';
import { QrCode } from './QrCode';
import { LETTERHEAD, LEGAL_LINE, LH_SCALE, LOGO_RATIO, NO_LIGATURES, PAGE, RC, TYPE, s, type ReportDetails, type ResolvedBrand } from './theme';

const serif = { fontFamily: 'SourceSerif', fontFeatureSettings: NO_LIGATURES, fontWeight: 600 } as const;

/* ------------------------------------------------------------------------ */
/* Brand marks                                                               */
/* ------------------------------------------------------------------------ */

/** The logo at a given height: colour on white, white on dark, a wordmark when no file is available. */
export function BrandLogo({ brand, height, onDark = false }: { brand: ResolvedBrand; height: number; onDark?: boolean }) {
  const file = onDark ? brand.logoOnDark : brand.logo;
  if (file) {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <Image src={{ data: file, format: 'png' }} style={{ height, width: height * LOGO_RATIO }} />;
  }
  return (
    <View style={{ height, justifyContent: 'center' }}>
      <Text style={{ ...serif, fontSize: height * 0.42, color: onDark ? RC.white : RC.navy }}>{brand.brandName}</Text>
    </View>
  );
}

/** A thin navy rule with a short green accent at its start, the inner page mark. */
export function AccentRule({ width = PAGE.contentWidth }: { width?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', width }}>
      <View style={{ width: 36, height: 2.2, backgroundColor: RC.green }} />
      <View style={{ flex: 1, height: 0.75, backgroundColor: RC.navy }} />
    </View>
  );
}

const pt = (u: number) => u * LH_SCALE;

function swooshPoints(edge: number, baseline: number, direction: 1 | -1): string {
  // direction 1: the header, rising from the bottom point up and to the right.
  // direction -1: the footer, the same curve turned half a circle.
  return LETTERHEAD.curve.map(([dx, dy]) => `L${edge + direction * dx} ${baseline + direction * dy}`).join(' ');
}

/** The letterhead header: colour logo top left, gold tagline top right, green swoosh over the navy rule. */
export function LetterheadHeader({ brand }: { brand: ResolvedBrand }) {
  const L = LETTERHEAD;
  const top = L.bandTop - 0.16;
  const [a, b, solid] = L.headerShapes;
  const shape = (x0: number) => `M${x0} ${L.bandBottom} ${swooshPoints(x0, L.bandBottom, 1)} L${L.width} ${top} L${L.width} ${L.bandBottom} Z`;
  return (
    <View fixed style={{ position: 'absolute', top: 0, left: 0, width: PAGE.width, height: pt(L.bandBottom) }}>
      <View style={{ position: 'absolute', left: pt(L.logo.x), top: pt(L.logo.y) }}>
        <BrandLogo brand={brand} height={pt(L.logo.height)} />
      </View>
      <Text
        style={{
          position: 'absolute',
          right: pt(L.width - L.tagline.right),
          top: pt(L.tagline.baseline) - pt(L.tagline.size) * 0.95,
          fontSize: pt(L.tagline.size),
          fontWeight: 600,
          color: RC.gold,
        }}
      >
        {brand.tagline}
      </Text>
      <Svg width={PAGE.width} height={pt(L.bandBottom - top)} viewBox={`0 ${top} ${L.width} ${L.bandBottom - top}`} style={{ position: 'absolute', left: 0, top: pt(top) }}>
        <Defs>
          <LinearGradient id="lhShadeA" x1="0" y1="0" x2="0.3" y2="0">
            <Stop offset="0" stopColor={RC.green} />
            <Stop offset="1" stopColor={L.shade} />
          </LinearGradient>
          <LinearGradient id="lhShadeB" x1="0" y1="0" x2="0.35" y2="0">
            <Stop offset="0" stopColor={RC.green} />
            <Stop offset="1" stopColor={L.shade} />
          </LinearGradient>
        </Defs>
        <Path d={shape(a)} fill="url(#lhShadeA)" />
        <Path d={shape(b)} fill="url(#lhShadeB)" />
        <Path d={shape(solid)} fill={RC.green} />
        <Rect x={0} y={L.ruleTop} width={L.width} height={L.bandBottom - L.ruleTop} fill={RC.navy} />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------------ */
/* Page frames                                                               */
/* ------------------------------------------------------------------------ */

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text);

/** The firm's legal name, for the footer: the brand name with LLP, never twice. */
export const legalName = (brandName: string) => (/LLP$/.test(brandName) ? brandName : `${brandName} LLP`);

/** Tool name, company and date, joined for a footer line. Long company names are shortened. */
export function detailsLine(d: ReportDetails): string {
  return [d.toolName, clip(d.subject, 34), d.dateLabel].filter(Boolean).join('  |  ');
}

/**
 * The inner page footer: the brand on the left like the website footer (small
 * logo, the LLP name and the tagline), the report details and page number on
 * the right, under a navy rule with a green accent.
 */
export function ReportFooter({ brand, details }: { brand: ResolvedBrand; details: ReportDetails }) {
  return (
    <View fixed style={{ position: 'absolute', left: PAGE.marginX, right: PAGE.marginX, bottom: PAGE.footerBottom }}>
      <AccentRule />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0, paddingRight: 16 }}>
          {brand.logo ? (
            <View style={{ marginRight: 8 }}>
              <BrandLogo brand={brand} height={13} />
            </View>
          ) : null}
          <View style={{ paddingLeft: brand.logo ? 8 : 0, borderLeftWidth: brand.logo ? 0.5 : 0, borderLeftColor: RC.border }}>
            <Text style={{ fontSize: 7, fontWeight: 600, color: RC.navy }}>{legalName(brand.brandName)}</Text>
            <Text style={{ fontSize: 6.8, color: RC.gold, marginTop: 1.5 }}>{brand.tagline}</Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
          <Text style={{ fontSize: 7, color: RC.muted, textAlign: 'right' }}>{detailsLine(details)}</Text>
          <Text style={{ fontSize: 7, fontWeight: 600, color: RC.navy, marginTop: 1.5 }} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </View>
    </View>
  );
}

/** Every inner page: a thin top rule, the page title, the content, the footer. */
export function ReportPage({ title, brand, details, children }: { title?: string; brand: ResolvedBrand; details: ReportDetails; children: ReactNode }) {
  return (
    <Page size="A4" style={s.page}>
      <View fixed style={{ position: 'absolute', top: PAGE.ruleTop, left: PAGE.marginX }}>
        <AccentRule />
      </View>
      {title ? <PageTitle>{title}</PageTitle> : null}
      {children}
      <ReportFooter brand={brand} details={details} />
    </Page>
  );
}

/** Where cover content starts: under the letterhead header, with room to breathe. */
export const COVER_CONTENT_TOP = Math.round(pt(LETTERHEAD.bandBottom)) + 44;

/** The cover: the letterhead header over a clean white page, and the report footer. */
export function ReportCover({ brand, details, children }: { brand: ResolvedBrand; details: ReportDetails; children: ReactNode }) {
  return (
    <Page size="A4" style={{ ...s.page, paddingTop: COVER_CONTENT_TOP, paddingHorizontal: 56 }}>
      <LetterheadHeader brand={brand} />
      {children}
      <ReportFooter brand={brand} details={details} />
    </Page>
  );
}

/** The legal line and the contact details from Site Settings, stated once in a report, on its closing page. */
export function LegalAndContact({ brand }: { brand: ResolvedBrand }) {
  const email = brand.contact.advisoryEmail || brand.contact.email;
  const contact: [string, string][] = [
    ...(email ? ([['Email', email]] as [string, string][]) : []),
    ['Web', brand.contact.website],
    ...(brand.contact.location ? ([['Office', brand.contact.location]] as [string, string][]) : []),
  ];
  return (
    <View wrap={false} style={{ marginTop: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: RC.border }}>
      <Text style={{ fontSize: TYPE.small, color: RC.grey, lineHeight: 1.5 }}>
        {contact.map(([k, v], i) => (
          <Text key={k}>
            {i ? '    ' : ''}
            <Text style={{ fontWeight: 600, color: RC.navy }}>{k}: </Text>
            {v}
          </Text>
        ))}
      </Text>
      <Text style={{ fontSize: TYPE.caption, color: RC.grey, lineHeight: 1.45, marginTop: 4 }}>{LEGAL_LINE}</Text>
    </View>
  );
}

/**
 * The closing page: the letterhead header, the closing content, the legal line
 * and contact details, and the same report footer as every other page.
 */
export function ClosingPage({ title, brand, details, children }: { title: string; brand: ResolvedBrand; details: ReportDetails; children: ReactNode }) {
  return (
    <Page size="A4" style={{ ...s.page, paddingTop: Math.round(pt(LETTERHEAD.bandBottom)) + 30 }}>
      <LetterheadHeader brand={brand} />
      <PageTitle>{title}</PageTitle>
      {children}
      <LegalAndContact brand={brand} />
      <ReportFooter brand={brand} details={details} />
    </Page>
  );
}

/* ------------------------------------------------------------------------ */
/* Headings and text                                                         */
/* ------------------------------------------------------------------------ */

export function PageTitle({ children }: { children: ReactNode }) {
  return <Text style={s.pageTitle}>{children}</Text>;
}

/** The section marker: a short green bar above a navy serif heading. */
export function SectionMarker() {
  return <View style={{ height: 2, width: 22, backgroundColor: RC.green, marginBottom: 4 }} />;
}

export function SectionHeading({ title, sub }: { title: string; sub?: string | null }) {
  return (
    <View>
      <SectionMarker />
      <Text style={s.h2}>{title}</Text>
      {sub ? <Text style={s.sub}>{sub}</Text> : null}
    </View>
  );
}

/** A section kept whole on its page. */
export function Section({ title, sub, children, gap = 14 }: { title: string; sub?: string; children: ReactNode; gap?: number }) {
  return (
    <View style={{ marginBottom: gap }} wrap={false}>
      <SectionHeading title={title} sub={sub} />
      {children}
    </View>
  );
}

export function SubHead({ children }: { children: ReactNode }) {
  return <Text style={{ ...serif, fontSize: TYPE.subHead, color: RC.navy, marginBottom: 2, marginTop: 6 }}>{children}</Text>;
}

export function Eyebrow({ children, color = RC.green }: { children: ReactNode; color?: string }) {
  return <Text style={[s.eyebrow, { color }]}>{children}</Text>;
}

export function Note({ children }: { children: ReactNode }) {
  return <Text style={[s.note, { fontSize: TYPE.small, marginTop: 4 }]}>{children}</Text>;
}

/** A boxed remark: a navy rule on the left over a pale navy tint. */
export function Callout({ children }: { children: ReactNode }) {
  return <View style={{ borderLeftWidth: 2, borderLeftColor: RC.navy, backgroundColor: RC.navyTint, padding: 6, marginTop: 5 }}>{children}</View>;
}

/* ------------------------------------------------------------------------ */
/* Tables and figures                                                        */
/* ------------------------------------------------------------------------ */

/** A table from `format.ts`: navy header text over a navy rule, light neutral shading, strong rows ruled in navy. */
export function DataTable({ table, firstColWidth = 34, colWidths }: { table: Table; firstColWidth?: number; colWidths?: number[] }) {
  const cols = table.head.length - 1;
  const widths = colWidths ?? [firstColWidth, ...new Array<number>(cols).fill((100 - firstColWidth) / cols)];
  const cell = (i: number, align: 'left' | 'right') => ({ width: `${widths[i]}%`, paddingVertical: 2.6, paddingHorizontal: 4, textAlign: align });
  return (
    <View style={{ borderWidth: 0.5, borderColor: RC.border }}>
      <View style={{ flexDirection: 'row', backgroundColor: RC.shade, borderBottomWidth: 0.9, borderBottomColor: RC.navy }}>
        {table.head.map((h, i) => (
          <Text key={i} style={[cell(i, i === 0 ? 'left' : 'right'), { fontSize: TYPE.tableHead, fontWeight: 600, color: RC.navy }]}>
            {h}
          </Text>
        ))}
      </View>
      {table.rows.map((row, ri) => {
        const strong = row.tone === 'strong';
        const muted = row.tone === 'muted';
        const color = muted ? RC.muted : strong ? RC.navy : RC.text;
        return (
          <View key={ri} style={{ flexDirection: 'row', borderTopWidth: strong ? 0.9 : ri ? 0.5 : 0, borderTopColor: strong ? RC.navy : RC.border, backgroundColor: strong ? RC.shade : RC.white }}>
            <Text style={[cell(0, 'left'), { fontSize: TYPE.table, fontWeight: strong ? 600 : 400, color }]}>{row.label}</Text>
            {row.values.map((v, ci) => (
              <Text key={ci} style={[cell(ci + 1, 'right'), { fontSize: TYPE.table, fontWeight: strong ? 600 : 400, color }]}>
                {v}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function KeyValues({ rows, labelWidth = '56%' }: { rows: [string, string][]; labelWidth?: string }) {
  return (
    <View>
      {rows.map(([k, v], i) => (
        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5, borderBottomWidth: 0.5, borderBottomColor: RC.border }}>
          <Text style={{ color: RC.muted, fontSize: TYPE.table, width: labelWidth, paddingRight: 4 }}>{k}</Text>
          <Text style={{ fontWeight: 500, fontSize: TYPE.table, flex: 1, textAlign: 'right' }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Two key-value columns laid out row by row, so the block can break between
 * rows across a page instead of moving whole.
 */
export function PairedColumns({ left, right, leftLabelWidth = '50%', rightLabelWidth = '50%' }: {
  left: { title: string; rows: [string, string][]; note?: string | null };
  right: { title: string; rows: [string, string][] };
  leftLabelWidth?: string;
  rightLabelWidth?: string;
}) {
  const count = Math.max(left.rows.length, right.rows.length);
  const cell = (row: [string, string] | undefined, labelWidth: string, side: 'left' | 'right') => (
    <View style={{ width: '50%', paddingRight: side === 'left' ? 10 : 0, paddingLeft: side === 'right' ? 10 : 0 }}>
      {row && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5, borderBottomWidth: 0.5, borderBottomColor: RC.border }}>
          <Text style={{ color: RC.muted, fontSize: TYPE.table, width: labelWidth, paddingRight: 4 }}>{row[0]}</Text>
          <Text style={{ fontWeight: 500, fontSize: TYPE.table, flex: 1, textAlign: 'right' }}>{row[1]}</Text>
        </View>
      )}
    </View>
  );
  return (
    <View>
      <View style={{ flexDirection: 'row' }} minPresenceAhead={60}>
        <View style={{ width: '50%', paddingRight: 10 }}>
          <SubHead>{left.title}</SubHead>
        </View>
        <View style={{ width: '50%', paddingLeft: 10 }}>
          <SubHead>{right.title}</SubHead>
        </View>
      </View>
      {Array.from({ length: count }, (_, k) => (
        <View key={k} style={{ flexDirection: 'row' }} wrap={false}>
          {cell(left.rows[k], leftLabelWidth, 'left')}
          {cell(right.rows[k], rightLabelWidth, 'right')}
        </View>
      ))}
      {left.note && <Note>{left.note}</Note>}
    </View>
  );
}

/** KPI tiles: muted label over a navy figure, in a light grid. */
export function Tiles({ items, columns }: { items: [string, string][]; columns?: number }) {
  const per = columns ?? items.length;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: RC.border }}>
      {items.map(([k, v]) => (
        <View key={k} style={{ width: `${100 / per}%`, paddingVertical: 5, paddingHorizontal: 7, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: RC.border }}>
          <Text style={{ fontSize: TYPE.caption, color: RC.muted }}>{k}</Text>
          <Text style={{ fontSize: 10.5, fontWeight: 600, color: RC.navy, marginTop: 2 }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

/** A KPI row for the cover: uppercase labels over navy figures, divided by hairlines. */
export function KpiRow({ items }: { items: [string, string][] }) {
  return (
    <View style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: RC.border }}>
      {items.map(([label, value], i) => (
        <View key={label} style={{ flex: 1, paddingTop: 9, paddingLeft: i ? 10 : 0, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: RC.border }}>
          <Text style={{ fontSize: 6.8, color: RC.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</Text>
          <Text style={{ fontSize: 12, fontWeight: 600, color: RC.navy, marginTop: 4 }}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------------ */
/* Closing page blocks                                                       */
/* ------------------------------------------------------------------------ */

/** "Who you will work with": the partner card from the founder profile, with the 4:5 portrait. */
export function PartnerBlock({ partner, photo }: { partner: PartnerCard; photo: Buffer | null }) {
  return (
    <View style={{ borderWidth: 0.75, borderColor: RC.border, borderTopWidth: 2, borderTopColor: RC.navy, padding: 14, marginBottom: 14, flexDirection: 'row' }} wrap={false}>
      {photo && (
        // eslint-disable-next-line jsx-a11y/alt-text
        <Image src={{ data: photo, format: 'jpg' }} style={{ width: 76, height: 76 / PORTRAIT_RATIO, marginRight: 14, objectFit: 'cover' }} />
      )}
      <View style={{ flex: 1 }}>
        <Eyebrow>Who you will work with</Eyebrow>
        <Text style={{ ...serif, fontSize: 14, color: RC.navy, marginTop: 3 }}>{partner.name}</Text>
        <Text style={{ fontSize: TYPE.small, color: RC.text, marginTop: 1 }}>{[partner.role, partner.title].filter(Boolean).join(', ')}</Text>
        {partner.credentialsLine ? <Text style={{ fontSize: TYPE.small, color: RC.green, fontWeight: 600, marginTop: 3 }}>{partner.credentialsLine}</Text> : null}
        {partner.intro ? <Text style={{ fontSize: TYPE.small, color: RC.text, lineHeight: 1.5, marginTop: 6 }}>{partner.intro}</Text> : null}
        {partner.highlights.length > 0 && (
          <View style={{ marginTop: 6 }}>
            {partner.highlights.map((hl) => (
              <View key={hl} style={{ flexDirection: 'row', marginTop: 2 }}>
                <View style={{ width: 3.5, height: 3.5, backgroundColor: RC.green, marginTop: 3.6, marginRight: 5.5 }} />
                <Text style={{ fontSize: TYPE.small, color: RC.text, flex: 1, lineHeight: 1.4 }}>{hl}</Text>
              </View>
            ))}
            <Text style={{ fontSize: TYPE.caption, color: RC.muted, marginTop: 3 }}>{PARTNER_RECORD_NOTE}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** The firm's services as a numbered grid: three columns beside a partner card, two with summaries without one. */
export function ServicesGrid({ services, compact }: { services: { slug: string; number: string; title: string; summary?: string }[]; compact: boolean }) {
  return (
    <View>
      <Eyebrow>Services</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginBottom: 14 }} wrap={false}>
        {services.map((svc) => (
          <View key={svc.slug} style={{ width: compact ? '33.33%' : '50%', paddingRight: 10, marginBottom: compact ? 5 : 9 }}>
            <Text style={{ fontSize: compact ? TYPE.small : 9.5, fontWeight: 600, color: RC.text }}>
              <Text style={{ color: RC.green }}>{svc.number}  </Text>
              {svc.title}
            </Text>
            {!compact && svc.summary ? <Text style={{ fontSize: TYPE.small, color: RC.muted, lineHeight: 1.4, marginTop: 1 }}>{svc.summary}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The booking call to action: a navy panel, a green button and a QR code for the same tracked link. */
export function BookingPanel({ href, heading, text, label = 'BOOK A FREE CALL' }: { href: string; heading: string; text: string; label?: string }) {
  return (
    <View style={{ backgroundColor: RC.navy, padding: 18, flexDirection: 'row', alignItems: 'center' }} wrap={false}>
      <View style={{ flex: 1, paddingRight: 16 }}>
        <Text style={{ ...serif, fontSize: 15, color: RC.white }}>{heading}</Text>
        {/* A unitless line height needs the font size set on the same element: react-pdf resolves it against its 18pt default otherwise. */}
        <Text style={{ color: '#DCE6F0', marginTop: 5, fontSize: 10.5, lineHeight: 1.5 }}>{text}</Text>
        <Link src={href} style={{ marginTop: 10, textDecoration: 'none' }}>
          <View style={{ backgroundColor: RC.green, paddingVertical: 7, paddingHorizontal: 14, alignSelf: 'flex-start' }}>
            <Text style={{ color: RC.white, fontWeight: 600, fontSize: 9, letterSpacing: 1 }}>{label}</Text>
          </View>
        </Link>
      </View>
      <View style={{ alignItems: 'center' }}>
        <QrCode text={href} size={92} />
        <Text style={{ fontSize: TYPE.caption, color: '#DCE6F0', marginTop: 4 }}>Scan to book</Text>
      </View>
    </View>
  );
}

export { PAGE, RC, TYPE, s };
