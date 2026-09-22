# CMS and public pages reference

Moved verbatim from `CLAUDE.md` on 2026-09-22 (original kept at `docs/archive/CLAUDE.md.bak-2026-09-22`). Contradictions found in the split were resolved to the current behaviour; each such line is noted in `docs/HISTORY.md` under 2026-09-22.

**Read this before:** adding or changing a section type, a public page, the navigation or the footer.

## 4. CMS Architecture

### Two-Layer Pattern

PMBC uses the same two-layer CMS pattern as FMP:

**Layer 1: cms_content (key-value)**: for content that doesn't belong to a specific page or section. Logo URLs, brand name, contact email, footer copyright, default SEO description, social URLs. Section + key + value structure. Read once, cached for the request.

**Namespace convention:** one row per atomic key. JSON-array values (e.g. `(header_settings, nav_items)`) are allowed when the value is naturally a list, but discrete keys are preferred over bundled JSON blobs: `(header_settings, cta_label)`, `(header_settings, show_cta)`, etc., not a single `config` row that contains all of them. Migration 009 splits the legacy `config` blob accordingly.

**Layer 2: page_sections (block-based)**: for the main body content of each page. One row per content block, ordered by `display_order`, rendered through a section-type registry. Editable via drag-and-drop page builder.

### Section registry

The live registry is `SECTION_REGISTRY` in `src/components/public/SectionRenderer.tsx`, one entry per section type below. (The illustrative snippet that used to stand here listed 12 types and was removed as stale on 2026-09-22.) A section type is added in three places: the component in the registry, its editor in `src/components/admin/editors/`, and its entry in the page builder's section list.

### Section types

- `hero`: main page hero with badge, headline, subtitle, CTA
- `stats_block`: large number callouts (100+, SAR 20B+, etc.)
- `service_cards`: grid of service cards with number, title, description, link
- `service_detail`: full detail block for a single service (used on /services/[slug]). Carries `show_header`, which is **false on all nine service pages** because the hero above already prints the number, title and summary, and true anywhere else so a detail block dropped onto another page still says which service it describes. It began as a route prop and moved into the row in migration 067, when these pages started rendering through the section registry, which passes nothing beyond the row
- `sector_grid`: sector coverage grid
- `process_steps`: numbered methodology steps
- `network_partners`: Sky Gulf and Lynkers blocks
- `founder_block`: founder photo, name, credentials, bio
- `text_image`: alternating text-image rows
- `paragraphs`: rich text paragraphs (Tiptap-rendered HTML), with an optional heading and, since 2026-08-16, an optional eyebrow above it. Both are opt-in on the same contract: a section carrying neither key renders exactly as it did before the key existed
- `cta_block`: single call-to-action panel
- `quote`: pull quote with attribution
- `fmp_intro`: Financial Modeler Pro introduction block (one specific section type for the FMP page)
- `founder_hero`: page-leading founder identity (portrait, name, two-line title, credentials, CTAs). Added 2026-08-02 for `/about/ahmad-din`. Distinct from `founder_block`, which is the mid-page summary card on home and about. **Each stores its own `photo_url`**, and there is no shared founder-photo source in `branding_config`, `site_settings` or `team_members`. That is by design (a section owns its content, and a card may want a different crop), but it means uploading a portrait in the page builder sets it on one section only. `npm run sync-founder-photo` copies it onto any card still empty without touching one deliberately given a different image
- `founder_credentials`: heading plus a list of short strings, rendered as `numbered`, `pills`, or `cards` per a `display` key. One type rather than three, because the three founder-profile list blocks differ only in presentation
- `feature_cards`: large cards carrying a code, metadata chips, a description, a bullet list, a note and a per-card CTA. `service_cards` has none of the last four. A `layout` key chooses between `cards` (side by side, the default) and `rows` (added 2026-08-13: full width, stacked, each card's media on the opposite side to the one above it, starting with the media on the right). Rows carry a per-card media slot on the same key set every other media field uses, including `media_max_height`, which is read per card because two rows hold two different assets. The slot wears the shared gold frame (`MediaFrameChrome`, split out of `SectionMediaFrame` on 2026-08-14 so the two cannot drift), takes the asset's own proportions, and letterboxes under a ceiling rather than cropping. A blank slot renders a navy monogram panel in a 4:3 box rather than collapsing the row
- `audience_carousel`: one wide card at a time, each with an image beside its copy, advancing on a timer with arrows for manual control. Added 2026-08-12 for the home "Who we serve" block, which had been a three-across `service_cards` grid with no room for imagery. Holds on hover and on keyboard focus; with `prefers-reduced-motion` it neither advances nor animates, and the arrows still work. Off-screen slides are `inert`. A card with no `image_url` renders a navy monogram panel rather than a gap
- `testimonial_form`: lets a client submit their own testimonial, placeable on any page. **Two locks, both of which must be open**: the section must be visible, and the site-wide switch under Testimonials must be on. A `?t=TOKEN` in the URL overrides the switch, because the point of sending a client a private link is that it works whether or not the firm is soliciting publicly. The gate is a client component (`TestimonialFormGate`), since only the browser knows the URL by the time a section renders. Added 2026-08-16. Collects name, role, company, the testimonial, an optional LinkedIn URL and an optional photo, behind an **unticked consent box the form cannot be submitted without**, because `/confidentiality` commits the firm to not publishing a client's involvement without agreement and the `consent_given` column is what makes that checkable later. Carries the same honeypot and three-second floor as the contact form. **Everything arrives `pending`**; nothing it collects can reach a public page without approval. A `?t=TOKEN` on whatever page carries it stamps the submission with the private link it came through
- `testimonials`: approved client quotes under an editable eyebrow and heading, addable to any page. `max_items` caps how many show, blank meaning all of them; home is set to two, since it is a proof point inside a long page rather than the page's subject. Registered 2026-08-16; the component had existed since Phase 10 and rendered nowhere, because the public half was never put in the registry. **The quotes are not section content**: they come from the `testimonials` table so `/admin/testimonials` stays the one place a quote is approved, ordered or withdrawn. An `only_landing` switch narrows it to the quotes flagged for the homepage, which is how a short selection goes on one page and the full set on another. With nothing approved it renders **nothing at all**, not an empty band under a heading. **This is the one section type whose data `SectionList` fetches itself**, rather than the route supplying it through the context: the block can be added to any page, and a route that forgot to pass the quotes would render it as silence. The fetch only runs when the page actually carries one
- `service_grid`: the nine service cards on `/services`, under an editable eyebrow, heading and standfirst. Added 2026-08-16 by migration 068. **The cards are not section content**: they come from the managed Services collection, falling back to `config/services.ts`, because the same nine feed each detail page's related-services cards, the contact form's dropdown, the sitemap and the JSON-LD
- `contact_body`: the `/contact` enquiry form panel and the direct-contact column beside it, including the booking callout inside the panel and the founder card under the addresses. Added 2026-08-16 by migration 066, which moved thirteen `cms_content` rows into it. **One section rather than one per visual block**, because the two columns are one grid: split into a section each they would render as stacked bands, which would have been a layout rewrite rather than a move. Carries no addresses: those are the firm's rather than the page's, the footer publishes the same values, and they stay in Site Settings
- `booking_body`: the `/book` calendar band and the direct routes under it, from eight `cms_content` rows. The Calendly URL is not part of it and stays in Site Settings, since one URL serves every booking surface. That setting also decides which of the section's two states renders: **the empty state is reached only while the URL is blank**, so it is not a widget-failure fallback and should be worded for a calendar that is switched off rather than one that failed to load
- `media`: one image, GIF or video standing on its own in the page order, with an optional eyebrow, heading and a `width` of `full` / `wide` / `narrow` (1200 / 960 / 720px). Added 2026-08-11. Distinct from the shared media panel every other section carries: that panel attaches an asset **to** a section, so it moves when that section is reordered, whereas this is an asset that belongs to the **page** and can be dragged between any two sections. Reuses the same `media_url` key set, so it is excluded from the shared panel via `SECTION_TYPES_WITH_OWN_MEDIA`. Blank `media_url` renders nothing at all, not an empty frame. `width` caps the frame; `media_max_height` (added 2026-08-12, shared with the panel) caps the asset inside it, letterboxing rather than cropping

### Page Renderer Pattern

```typescript
// src/app/(public)/services/page.tsx
import { fetchPageSections } from '@/lib/cms/pages';
import { SectionRenderer } from '@/components/public/SectionRenderer';

export default async function ServicesPage() {
  const sections = await fetchPageSections('services');
  return (
    <main>
      {sections.map(s => <SectionRenderer key={s.id} section={s} />)}
    </main>
  );
}
```

### CMS Fetchers

```typescript
// src/lib/cms/pages.ts
export async function fetchPageSections(slug: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('page_sections')
    .select('*')
    .eq('page_slug', slug)
    .eq('visible', true)
    .order('display_order', { ascending: true });
  return data || [];
}

// src/lib/cms/content.ts
export async function fetchContentBySection(section: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from('cms_content')
    .select('key, value')
    .eq('section', section);
  return Object.fromEntries((data || []).map(r => [r.key, r.value]));
}
```

## 5. Public Pages

### Sitemap

| URL | Page slug | Purpose |
|-----|-----------|---------|
| `/` | home | The firm in full: hero, firm introduction, firm track record, what we do (a short statement linking to /services, not a card grid), who we serve (an `audience_carousel`), delivery approach, founder card, a three sentence network mention linking to /network, quote, CTA. Resequenced by migration 051, network block cut by 053. **/about was merged into this page and now 301s here** (migration 045). The founder card is the full `founder_block` treatment (portrait, credentials line, bio, proof points, both CTAs), restored by migration 046 after 045 had briefly reduced it to a one-line mention. |
| `/services` | services | Overview of all 9 services: hero, video, the nine cards, how an engagement runs, closing CTA. **The grid is a `service_grid` section since migration 068**, so its place on the page is its row in the builder; before that it was written into the route file and always rendered last, which put a closing CTA above it. The nine cards themselves come from the Services collection, not from the section. The engagement block (migration 069) is a `paragraphs` section at order 27. |
| `/services/[slug]` | service-{slug} | Detail page for one service. Slugs from config/services.ts. **Body content is a `service_detail` section on the `service-{slug}` page since migration 067**, edited in the page builder like every other page, and sections added after it render after it. The number, title and summary still come from `config/services.ts`, since the same three drive the /services grid, the related-services cards, the contact form dropdown, `generateStaticParams`, the sitemap and the JSON-LD. |
| `/sectors` | sectors | Sector coverage grid with descriptions |
| `/approach` | approach | Engagement methodology (Understand, Analyse, Model, Advise). **Unreferenced since 2026-08-12**: the nav item was hidden in Pages & Nav, and migration 052 removed the five remaining internal links (home firm introduction, home delivery approach CTA, /network and /sectors CTAs, /services secondary hero CTA), along with the footer link and the sitemap entry. The page, its route and its content are untouched and it still returns 200; restoring the nav item and the sitemap line brings it back. |
| `/network` | network | Sky Gulf and Lynkers detail. Why the network matters. |
| `/about/ahmad-din` | about-ahmad-din | Founder profile. Nine CMS sections mirroring the structure of FMP's page of the same path. |
| `/fmp` | financial-modeler-pro | The platform arm in full: hero with capability tags, what FMP is, who it is for (an `audience_carousel` since migration 053), the Modeling and Training Hubs, CTA. Five sections since migration 063 cut the certification block: it restated the Training Hub card immediately above it, bullet for bullet, down to the same CTA to the same page, and the one thing it added ("assessed rather than attendance-based") folded into that card. Migration 055 had already reduced it once, removing the band that named 3SFM and BVM, since their session counts, hour counts and course UUIDs are facts about FMP's catalogue that this page cannot track. **The intro answers why an advisory firm carries a platform**, which was previously left to the closing block at the bottom of the page. **Moved from `/financial-modeler-pro`, which 301s here** (migration 049). The three sub-pages beneath the old path are retained, unlinked and out of the sitemap. |
| `/team` | team | The firm's people. **The hero is a CMS section since migration 070**; the cards below it are fed entirely by the `team_members` table rather than by `page_sections`. The founding partner leads the page in a wider card carrying the gold-framed portrait, and links through to `/about/ahmad-din` rather than repeating the bio that already lives there; everyone else follows in the three-up card grid the other collection pages use. Which member is the founder is not hardcoded: `src/lib/cms/founderProfile.ts` asks the profile page's own `founder_hero` section for the name, so a rename in the page builder moves the match with it. **Offered in the navbar and footer only while a member is published** (see `src/lib/public/collectionGates.ts`), the same row-count test the sitemap has used since 2026-08-13. |
| `/contact` | contact | Contact form, direct contact info. **Two sections since migration 066**: the CMS hero, then a `contact_body` carrying every string on the page. The three published addresses stay in Site Settings, since the footer publishes the same ones. |
| `/book` | book | Booking page. CMS hero plus a `booking_body` section (migration 066) around a Calendly inline embed reading `site_settings.booking_url`. Deliberately not in the top nav (footer and CTAs only). |
| `/privacy` | privacy | Privacy policy (static, hardcoded for v1) |
| `/terms` | terms | Terms of engagement (static, hardcoded for v1) |
| `/tools` | tools | The free tools hub. **404 while no tool is Live.** Hero is a CMS section (074); the cards come from the registry and the visibility switch. See section 7b. |
| `/tools/[slug]` | tool-{slug} | One free tool. **404 and noindex while Hidden**, Admin preview for signed-in staff. Compact hero from the CMS page; the calculator is code. |
| `/confidentiality` | confidentiality | How information shared before, during and after an engagement is treated. Static and hardcoded, for the same reason as the two above: a statement settled by counsel should not be editable from an admin console afterwards. |

### Service Slugs

```typescript
// src/config/services.ts
export const SERVICES = [
  { slug: 'financial-modeling', number: '01', title: 'Financial Modeling' },
  { slug: 'business-valuation', number: '02', title: 'Business Valuation' },
  { slug: 'financial-due-diligence', number: '03', title: 'Financial Due Diligence' },
  { slug: 'transaction-advisory', number: '04', title: 'Transaction Advisory' },
  { slug: 'mergers-acquisitions', number: '05', title: 'M&A Advisory' },
  { slug: 'refm', number: '06', title: 'Real Estate Financial Modeling' },
  { slug: 'project-finance', number: '07', title: 'Project Finance' },
  { slug: 'investment-memorandums', number: '08', title: 'Investment Memorandums' },
  { slug: 'cfo-advisory', number: '09', title: 'CFO Advisory' },
];
```

### Navigation

Top nav (desktop), as live: Services, Sectors, Network, Financial Modeler Pro, Team, Contact, plus **Tools** (order 25, after Financial Modeler Pro, visible since 2026-09-16; see TOOLS.md). **Team is conditional**: its `site_pages` row is visible, but `NavbarServer` drops it while no team member is published, so it appears and disappears with the collection rather than with an operator's memory. **Services opens a dropdown** listing all nine service pages in two columns (`NavDropdown`, added 2026-08-12); the parent still links to /services, and below the navbar breakpoint the nine are listed under it inside the mobile menu. The **Approach** and **Founder** rows are still in `site_pages` with `visible = false`, so both are one switch from returning.
Top nav (mobile): hamburger menu with same items
Persistent CTA in nav: "Book a Meeting", linking to /book (repointed by migration 039).

`/book` is deliberately kept out of the top nav. It is reached from the navbar CTA, the founder profile, the contact page, and the footer.

`/approach` is a different case: it is out of the nav AND out of everything else. Nothing on the site links to it, it is absent from the sitemap, and `scripts/verify-page-rhythm.mjs` asserts that on every page. A route in that state should either be linked or retired, so if it stays unreferenced for long, retiring it properly is the tidier end.

Footer columns, three since 2026-08-13:
- **Brand**: short PMBC description, tagline
- **Firm**: every link is a row in `(footer_settings, links)` and is editable at `/admin/footer-links`, including whether it renders. Shipped visible: Services, Network, Sectors, Financial Modeler Pro, Team, Contact. Shipped hidden: Case Studies and Insights, since both collections are empty and a link onto an empty state is a weaker impression than no link. **Team ships visible but is gated**, so it is withheld while `team_members` has no published row and returns on its own; setting it hidden in Footer Links still wins, because the gate can only subtract. The nine service pages used to have a column of their own and are now one Services link, because `/services` lists all nine with a summary each. Approach and Founder were removed on 2026-08-12 when their nav rows were hidden, and are absent from the seeded list rather than hidden in it.
- **Contact**: email, WhatsApp, location, LinkedIn, then any link whose `column` is `contact`. Book a Meeting is seeded there: it is a way of reaching the firm, like the address above it, rather than another page in the Firm list.
- **Legal**, in the bottom strip: Privacy, Terms, Confidentiality. Not editable in Footer Links, by design: a switch that can hide a privacy policy by accident is a switch worth not having.

---
