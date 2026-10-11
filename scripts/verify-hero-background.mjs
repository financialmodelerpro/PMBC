// scripts/verify-hero-background.mjs
//
// Verifies the hero background image (2026-10-11) by rendering the real `hero`
// and `founder_hero` sections to static markup, offline:
//
//   A. No image means no change. A hero with no background keys, with the
//      migration 105 defaults, or with an unusable URL renders byte-identical
//      markup to the hero before the feature: the same output either way.
//   B. With an image: a decorative next/image (empty alt, covering, priority)
//      under a navy overlay at the chosen opacity, drawn before the content so
//      the text paints above it, the focal point mapped to object-position.
//   C. The overlay is clamped to 35..100 and defaults to 60; the focal point
//      defaults to centre.
//   D. The editor, the section defaults and migration 105 agree with the code.
//
//   node scripts/verify-hero-background.mjs
//   npm run verify-hero-background

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jiti = createJiti(import.meta.url, {
  alias: {
    '@': path.join(root, 'src'),
    'next/link': path.join(root, 'scripts/lib/next-stubs/link.mjs'),
    'next/image': path.join(root, 'scripts/lib/next-stubs/image.mjs'),
  },
  jsx: { runtime: 'automatic' },
  nativeModules: ['react', 'react-dom'],
});

const React = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { Hero } = await jiti.import(path.join(root, 'src/components/public/sections/Hero.tsx'));
const { FounderHero } = await jiti.import(path.join(root, 'src/components/public/sections/FounderHero.tsx'));
const bgModule = await jiti.import(path.join(root, 'src/components/public/HeroBackground.tsx'));

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) passed++;
  else failures.push(name + (detail ? `\n    ${detail}` : ''));
}
const render = (Component, content, variant = 'navy_deep') =>
  renderToStaticMarkup(React.createElement(Component, { content, styles: {}, variant }));

const IMG = 'https://example.supabase.co/storage/v1/object/public/cms-assets/hero.jpg';
const DEFAULTS = { hero_bg_image: '', hero_bg_overlay: 60, hero_bg_focal: 'center' };
const HERO = { badge_text: 'Advisory', headline: 'Advisory from Structure to Exit', subtitle: 'For family offices.', cta_label: 'Talk', cta_href: '/contact' };
const PROFILE = { eyebrow: 'Team', name: 'Test Person', title_primary: 'Partner', intro: 'An introduction.' };

for (const [label, Component, base] of [['hero', Hero, HERO], ['founder_hero', FounderHero, PROFILE]]) {
  const before = render(Component, base);

  // A. Unchanged without an image.
  check(`${label}: no keys renders no image`, !before.includes('alt=""'));
  check(`${label}: migration 105 defaults render identically`, render(Component, { ...base, ...DEFAULTS }) === before);
  for (const bad of ['javascript:alert(1)', 'http://insecure.example/x.jpg', 'https://example.com/clip.mp4', '   ']) {
    check(`${label}: unusable image "${bad.trim() || 'blank'}" is ignored`, render(Component, { ...base, hero_bg_image: bad }) === before);
  }
  check(`${label}: overlay and focal alone change nothing`, render(Component, { ...base, hero_bg_overlay: 90, hero_bg_focal: 'top' }) === before);

  // B. With an image.
  const withImg = render(Component, { ...base, hero_bg_image: IMG });
  const imgTag = withImg.match(/<img[^>]*>/)?.[0] ?? '';
  check(`${label}: image renders`, imgTag.includes(`src="${IMG}"`), imgTag);
  check(`${label}: image is decorative (empty alt, aria-hidden layer)`, imgTag.includes('alt=""') && /<div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden"><img/.test(withImg));
  check(`${label}: image covers and fills`, imgTag.includes('object-cover') && imgTag.includes('data-fill="true"'));
  check(`${label}: default focal is centre`, imgTag.includes('object-position:50% 50%'), imgTag);
  check(`${label}: default overlay is navy at 60%`, withImg.includes('background:#14304F;opacity:0.6'));
  check(`${label}: overlay comes after the image, content after both`, (() => {
    const i = withImg.indexOf('<img'), o = withImg.indexOf('opacity:0.6'), t = withImg.indexOf(label === 'hero' ? HERO.headline : PROFILE.name);
    return i > -1 && i < o && o < t;
  })());
  check(`${label}: the content above it is positioned`, label === 'hero'
    ? withImg.includes('class="relative mx-auto w-full max-w-[1100px] text-center"')
    : /class="relative mx-auto/.test(withImg) || /class="relative [^"]*max-w/.test(withImg));
  check(`${label}: hero height classes unchanged`, (before.match(/min-h-\[70vh\]/g) ?? []).length === (withImg.match(/min-h-\[70vh\]/g) ?? []).length);
  // Strip the image layer, and on the hero the pattern it replaces, or on the
  // profile hero the `relative` its inner box gains: what is left is the plain
  // hero, so text and buttons are untouched.
  {
    const layer = /<div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden"><img[^>]*\/?><div class="absolute inset-0" style="[^"]*"><\/div><\/div>/;
    const pattern = /<div aria-hidden="true" class="pointer-events-none absolute inset-0 opacity-\[0\.04\]" style="[^"]*"><\/div>/;
    // React hoists a preload link for an eager image; that is the image too.
    const stripped = withImg.replace(layer, '').replace(`<link rel="preload" as="image" href="${IMG}"/>`, '');
    const plain = label === 'hero' ? before.replace(pattern, '') : before;
    const normalised = label === 'hero' ? stripped : stripped.replace('class="relative mx-auto', 'class="mx-auto');
    check(`${label}: text and buttons unchanged apart from the layer`, layer.test(withImg) && normalised === plain, `${normalised.length} vs ${plain.length}`);
  }
  check(`${label}: focal top`, render(Component, { ...base, hero_bg_image: IMG, hero_bg_focal: 'top' }).includes('object-position:50% 0%'));
  check(`${label}: focal bottom`, render(Component, { ...base, hero_bg_image: IMG, hero_bg_focal: 'bottom' }).includes('object-position:50% 100%'));
  check(`${label}: overlay 80 renders 0.8`, render(Component, { ...base, hero_bg_image: IMG, hero_bg_overlay: 80 }).includes('opacity:0.8'));
  check(`${label}: overlay below 35 is held at 35`, render(Component, { ...base, hero_bg_image: IMG, hero_bg_overlay: 0 }).includes('opacity:0.35'));
  check(`${label}: overlay above 100 is held at 100`, render(Component, { ...base, hero_bg_image: IMG, hero_bg_overlay: 250 }).includes('background:#14304F;opacity:1"'));
  check(`${label}: a light variant with an image takes navy text colours`, render(Component, { ...base, hero_bg_image: IMG }, 'cream') === withImg);
}

// The hero's subtle diagonal pattern is not drawn over a photograph.
check('hero: pattern drawn without an image', render(Hero, HERO).includes('repeating-linear-gradient'));
check('hero: pattern omitted over an image', !render(Hero, { ...HERO, hero_bg_image: IMG }).includes('repeating-linear-gradient'));

// C. The value helpers.
const pct = bgModule.heroOverlayPercent;
check('overlay: absent is 60', pct(undefined) === 60 && pct('') === 60 && pct('abc') === 60);
check('overlay: clamped to 35..100', pct(10) === 35 && pct(35) === 35 && pct(100) === 100 && pct(140) === 100);
check('overlay: numeric strings read', pct('72') === 72);
check('focal: unknown is centre', bgModule.heroFocal('left') === 'center' && bgModule.heroFocal(undefined) === 'center');
check('focal: options are Centre, Top, Bottom', JSON.stringify(bgModule.HERO_FOCAL_OPTIONS.map((o) => o.label)) === '["Centre","Top","Bottom"]');

// D. Source agreement.
const src = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const bgSrc = src('src/components/public/HeroBackground.tsx');
check('next/image with priority and empty alt', bgSrc.includes("from 'next/image'") && /<Image[\s\S]*?\bpriority\b[\s\S]*?\/>/.test(bgSrc) && bgSrc.includes('alt=""'));
const fields = src('src/components/admin/editors/HeroBackgroundFields.tsx');
check('editor: Media Library field, images only', fields.includes('<MediaField') && fields.includes('urlKey="hero_bg_image"') && fields.includes('imagesOnly'));
check('editor: slider bounded by the shared constants', fields.includes('type="range"') && fields.includes('min={HERO_OVERLAY_MIN}') && fields.includes('max={HERO_OVERLAY_MAX}'));
check('editor: used by both hero editors', src('src/components/admin/editors/HeroEditor.tsx').includes('<HeroBackgroundFields') && src('src/components/admin/editors/FounderHeroEditor.tsx').includes('<HeroBackgroundFields'));
const types = src('src/lib/cms/sectionTypes.ts');
check('section defaults carry the three keys for both types', (types.match(/hero_bg_image: '',\s*hero_bg_overlay: 60,\s*hero_bg_focal: 'center',/g) ?? []).length === 2);
const mig = src('supabase/migrations/105_hero_background_fields.sql');
check('migration 105: same defaults, both types, existing values win', mig.includes("'hero_bg_image', ''") && mig.includes("'hero_bg_overlay', 60") && mig.includes("'hero_bg_focal', 'center'") && mig.includes("IN ('hero', 'founder_hero')") && /\)\s*\|\|\s*content/.test(mig));
check('migration 105 sets no image', !/hero_bg_image',\s*'[^']/.test(mig));
check('storage domain allowed for next/image', src('next.config.ts').includes("hostname: '*.supabase.co'"));

const total = passed + failures.length;
for (const f of failures) console.log('  FAIL  ' + f);
console.log(`\nverify-hero-background: ${passed} of ${total} checks passed.`);
if (failures.length) process.exitCode = 1;
