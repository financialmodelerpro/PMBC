// scripts/verify-text-breaks.mjs
//
// Verifies three public rendering rules by rendering the real section
// components to static markup from fixtures. No server, no network and no
// database: it reads nothing live and writes nothing anywhere.
//
//   A. Paragraph breaks. A blank line in a plain textarea field renders as a
//      new paragraph and a single newline as a line break, in every section
//      field that is a plain textarea. A short rich text field (the Bold,
//      Italic and Link box) keeps its paragraphs apart instead of gluing them
//      together. A value with no break renders exactly as it did before.
//   B. Text alignment on the rich text bodies of Text + image, Founder, FMP
//      intro, Prose + checklist and Service detail: absent or Left adds
//      nothing, Justified adds text-align and the hyphenation class, and any
//      other value reads as Left. Paragraphs keeps its own four-way control.
//   C. Partner logo size on Network partners: Standard (the default) caps the
//      logo at 56px, Smaller at 44px, inside the unchanged 144 by 56 slot,
//      scaled down to fit and never up.
//
//   node scripts/verify-text-breaks.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, {
  alias: {
    '@': path.join(root, 'src'),
    // next/link and next/image do not resolve as components outside Next, so
    // they are stood in for. Nothing asserted here is about either of them.
    'next/link': path.join(root, 'scripts/lib/next-stubs/link.mjs'),
    'next/image': path.join(root, 'scripts/lib/next-stubs/image.mjs'),
  },
  jsx: { runtime: 'automatic' },
  nativeModules: ['react', 'react-dom'],
});

const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');

const sec = (file) => jiti.import(path.join(root, 'src/components/public/sections', file + '.tsx'));
const { splitPlainParagraphs, MultilineText } = await jiti.import(
  path.join(root, 'src/components/public/MultilineText.tsx'),
);
const { RichText, splitHtmlParagraphs } = await jiti.import(
  path.join(root, 'src/components/public/RichText.tsx'),
);
const { sanitizeInlineHtml } = await jiti.import(path.join(root, 'src/lib/cms/sanitize.ts'));

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failures.push(name + (detail ? `\n    ${detail}` : ''));
}

function render(Component, content, context = {}, variant = 'white') {
  return renderToStaticMarkup(
    React.createElement(Component, { content, styles: {}, variant, context }),
  );
}

const ONE = 'Alpha paragraph here.';
const TWO = 'Beta paragraph here.';
const TWO_PARAS = `${ONE}\n\n${TWO}`;
const FIRST_SPAN = `<span class="block">${ONE}</span>`;
const SECOND_SPAN = `<span class="block" style="margin-top:0.85em">${TWO}</span>`;

// ---------------------------------------------------------------------------
// A1. The splitter itself.
// ---------------------------------------------------------------------------

const split = (t) => JSON.stringify(splitPlainParagraphs(t));
check('split: blank line makes two paragraphs', split('a\n\nb') === '[["a"],["b"]]', split('a\n\nb'));
check('split: three newlines read as one blank line', split('a\n\n\nb') === '[["a"],["b"]]', split('a\n\n\nb'));
check('split: Windows line endings', split('a\r\n\r\nb') === '[["a"],["b"]]', split('a\r\n\r\nb'));
check('split: spaces on the blank line', split('a\n  \nb') === '[["a"],["b"]]', split('a\n  \nb'));
check('split: single newline is a line inside one paragraph', split('a\nb') === '[["a","b"]]', split('a\nb'));
check('split: leading and trailing blank lines dropped', split('\n\na\n\n') === '[["a"]]', split('\n\na\n\n'));

const mt = (t) => renderToStaticMarkup(React.createElement('p', null, React.createElement(MultilineText, { text: t })));
check('MultilineText: no newline renders the bare string', mt(ONE) === `<p>${ONE}</p>`, mt(ONE));
check(
  'MultilineText: two paragraphs render as two block spans',
  mt(TWO_PARAS) === `<p>${FIRST_SPAN}${SECOND_SPAN}</p>`,
  mt(TWO_PARAS),
);
check(
  'MultilineText: single newline renders a <br>',
  mt('Line one\nLine two') === '<p><span class="block">Line one<br/>Line two</span></p>',
  mt('Line one\nLine two'),
);
check('MultilineText: text is escaped, not parsed', mt('a <b>x</b>\n\nb').includes('&lt;b&gt;'), mt('a <b>x</b>\n\nb'));

// ---------------------------------------------------------------------------
// A2. Every plain textarea field, in its own section.
// ---------------------------------------------------------------------------

const network = (await sec('NetworkPartners')).NetworkPartners;
const PLAIN_FIELDS = [
  ['network_partners.intro', network, (v) => ({ intro: v })],
  ['network_partners.partners[].description', network, (v) => ({ partners: [{ name: 'P', description: v }] })],
  ['process_steps.intro', (await sec('ProcessSteps')).ProcessSteps, (v) => ({ intro: v, steps: [] })],
  ['sector_grid.intro', (await sec('SectorGrid')).SectorGrid, (v) => ({ intro: v, sectors: [] })],
  ['service_cards.intro', (await sec('ServiceCards')).ServiceCards, (v) => ({ intro: v, cards: [] })],
  ['audience_carousel.intro', (await sec('AudienceCarousel')).AudienceCarousel, (v) => ({ intro: v, items: [{ title: 'T', description: 'd' }] })],
  ['feature_cards.intro', (await sec('FeatureCards')).FeatureCards, (v) => ({ intro: v, cards: [{ title: 'Card', description: 'd' }] })],
  [
    'feature_cards.cards[].description (cards layout)',
    (await sec('FeatureCards')).FeatureCards,
    (v) => ({ cards: [{ title: 'Card', description: v }] }),
  ],
  [
    'feature_cards.cards[].description (rows layout)',
    (await sec('FeatureCards')).FeatureCards,
    (v) => ({ layout: 'rows', cards: [{ title: 'Card', description: v }] }),
  ],
  ['founder_hero.intro', (await sec('FounderHero')).FounderHero, (v) => ({ name: 'N', intro: v })],
  [
    'service_detail.timeline_text',
    (await sec('ServiceDetail')).ServiceDetail,
    (v) => ({ full_description_html: '<p>x</p>', timeline_text: v }),
  ],
  [
    'service_detail.target_audience_text',
    (await sec('ServiceDetail')).ServiceDetail,
    (v) => ({ full_description_html: '<p>x</p>', target_audience_text: v }),
  ],
  ['service_grid.intro', (await sec('ServiceGrid')).ServiceGrid, (v) => ({ heading: 'H', intro: v })],
  ['contact_body.form_response_note', (await sec('ContactBody')).ContactBody, (v) => ({ form_response_note: v })],
  ['contact_body.booking_body', (await sec('ContactBody')).ContactBody, (v) => ({ booking_body: v })],
  ['contact_body.direct_intro', (await sec('ContactBody')).ContactBody, (v) => ({ direct_intro: v })],
  ['contact_body.founder_body', (await sec('ContactBody')).ContactBody, (v) => ({ founder_body: v })],
  ['booking_body.empty_body', (await sec('BookingBody')).BookingBody, (v) => ({ empty_body: v })],
  ['booking_body.alternatives_text', (await sec('BookingBody')).BookingBody, (v) => ({ alternatives_text: v })],
  ['testimonial_form.intro', (await sec('TestimonialForm')).TestimonialForm, (v) => ({ intro: v })],
  ['testimonial_form.consent_label', (await sec('TestimonialForm')).TestimonialForm, (v) => ({ consent_label: v })],
];
const CONTEXT = { testimonialFormPublic: true, settings: {} };

for (const [name, Component, make] of PLAIN_FIELDS) {
  const broken = render(Component, make(TWO_PARAS), CONTEXT);
  check(`${name}: blank line renders two paragraphs`, broken.includes(FIRST_SPAN) && broken.includes(SECOND_SPAN));
  const single = render(Component, make(ONE), CONTEXT);
  check(
    `${name}: no break renders the bare string`,
    single.includes(`>${ONE}<`) && !single.includes(`<span class="block">${ONE}`),
  );
}

// The success message only renders after a submit, so its wrapping is checked
// at the source rather than in markup.
const fs = await import('node:fs');
const formFields = fs.readFileSync(path.join(root, 'src/components/public/TestimonialFormFields.tsx'), 'utf8');
check(
  'testimonial_form.success_message: rendered through MultilineText',
  formFields.includes('<MultilineText text={successMessage} />'),
);

// ---------------------------------------------------------------------------
// A3. Short rich text fields (RichTextarea values).
// ---------------------------------------------------------------------------

const rt = (html) => renderToStaticMarkup(React.createElement(RichText, { html, as: 'span' }));
const RICH_TWO = `<p>${ONE}</p><p>${TWO}</p>`;
check('RichText: two paragraphs are not glued', !rt(RICH_TWO).includes(ONE + TWO), rt(RICH_TWO));
check(
  'RichText: two paragraphs render as two block spans',
  rt(RICH_TWO) === `<span>${FIRST_SPAN}${SECOND_SPAN}</span>`,
  rt(RICH_TWO),
);
check(
  'RichText: a single paragraph renders exactly as before',
  rt(`<p>${ONE} <strong>bold</strong></p>`) ===
    `<span>${sanitizeInlineHtml(`<p>${ONE} <strong>bold</strong></p>`)}</span>`,
  rt(`<p>${ONE} <strong>bold</strong></p>`),
);
check('RichText: legacy plain value renders exactly as before', rt(ONE) === `<span>${ONE}</span>`, rt(ONE));
check(
  'RichText: empty paragraphs from a double Enter are dropped',
  splitHtmlParagraphs(`<p>${ONE}</p><p></p><p>${TWO}</p>`).length === 2,
);
check('RichText: formatting survives inside a paragraph', rt(`<p>${ONE}</p><p><em>${TWO}</em></p>`).includes(`<em>${TWO}</em>`));
check('RichText: blocked tags still removed per paragraph', !rt(`<p>${ONE}</p><p><script>x</script>${TWO}</p>`).includes('<script'));

const RICH_FIELDS = [
  ['hero.subtitle', (await sec('Hero')).Hero, (v) => ({ headline: 'H', subtitle: v })],
  ['stats_block.intro', (await sec('StatsBlock')).StatsBlock, (v) => ({ intro: v, stats: [{ value: '1', label: 'x' }] })],
  ['service_cards.cards[].description', (await sec('ServiceCards')).ServiceCards, (v) => ({ cards: [{ title: 'T', description: v }] })],
  ['sector_grid.sectors[].description', (await sec('SectorGrid')).SectorGrid, (v) => ({ sectors: [{ name: 'S', description: v }] })],
  ['process_steps.steps[].description', (await sec('ProcessSteps')).ProcessSteps, (v) => ({ steps: [{ number: '01', title: 'T', description: v }] })],
  ['cta_block.subhead', (await sec('CtaBlock')).CtaBlock, (v) => ({ headline: 'H', subhead: v })],
  ['quote.quote_text', (await sec('Quote')).Quote, (v) => ({ quote_text: v })],
  ['audience_carousel.items[].description', (await sec('AudienceCarousel')).AudienceCarousel, (v) => ({ items: [{ title: 'T', description: v }] })],
];
for (const [name, Component, make] of RICH_FIELDS) {
  const out = render(Component, make(RICH_TWO));
  check(`${name}: paragraphs kept apart`, out.includes(FIRST_SPAN) && out.includes(SECOND_SPAN) && !out.includes(ONE + TWO));
}

// ---------------------------------------------------------------------------
// B. Text alignment on the rich text bodies.
// ---------------------------------------------------------------------------

const BODIES = [
  ['text_image', (await sec('TextImage')).TextImage, { body_html: '<p>Body</p>' }],
  ['founder_block', (await sec('FounderBlock')).FounderBlock, { name: 'N', bio_html: '<p>Body</p>' }],
  ['fmp_intro', (await sec('FmpIntro')).FmpIntro, { heading: 'H', description_html: '<p>Body</p>' }],
  ['prose_checklist', (await sec('ProseChecklist')).ProseChecklist, { html: '<p>Body</p>' }],
  ['service_detail', (await sec('ServiceDetail')).ServiceDetail, { full_description_html: '<p>Body</p>' }],
];
for (const [name, Component, content] of BODIES) {
  const base = render(Component, content);
  const left = render(Component, { ...content, body_align: 'left' });
  const justified = render(Component, { ...content, body_align: 'justify' });
  const bogus = render(Component, { ...content, body_align: 'center' });
  check(`${name}: absent alignment adds nothing`, !base.includes('text-align') && !base.includes('pmbc-prose-justify'));
  check(`${name}: Left renders identically to absent`, left === base);
  check(`${name}: an unknown value reads as Left`, bogus === base);
  check(
    `${name}: Justified adds text-align and hyphenation`,
    justified.includes('text-align:justify') && justified.includes('pmbc-prose-justify'),
  );
}
const paragraphs = (await sec('Paragraphs')).Paragraphs;
check(
  'paragraphs: its own Justified still applies',
  render(paragraphs, { html: '<p>Body</p>', align: 'justify' }).includes('text-align:justify'),
);
check(
  'paragraphs: body_align is not read by Paragraphs',
  !render(paragraphs, { html: '<p>Body</p>', body_align: 'justify' }).includes('pmbc-prose-justify'),
);

// ---------------------------------------------------------------------------
// C. Partner logo size.
// ---------------------------------------------------------------------------

const logo = (extra) =>
  render(network, { partners: [{ name: 'P', logo_url: 'https://example.supabase.co/a.png', ...extra }] });
const SLOT = '<div class="flex h-14 w-36 flex-shrink-0 items-center">';
check('logo: slot keeps the 144 by 56 size', logo({}).includes(SLOT));
check('logo: absent size is Standard, 56px', logo({}).includes('style="height:56px"'));
check('logo: Smaller is 44px', logo({ logo_size: 'smaller' }).includes('style="height:44px"'));
check('logo: an unknown size reads as Standard', logo({ logo_size: 'huge' }).includes('style="height:56px"'));
check(
  'logo: scaled down to fit, never up, aspect ratio kept',
  logo({}).includes('class="object-scale-down object-left"') && !logo({}).includes('object-contain'),
);

// ---------------------------------------------------------------------------

console.log(`${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log('FAIL ' + f);
  process.exit(1);
}
