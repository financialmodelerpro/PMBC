# Design reference

Moved verbatim from `CLAUDE.md` on 2026-09-22 (original kept at `docs/archive/CLAUDE.md.bak-2026-09-22`). Contradictions found in the split were resolved to the current behaviour; each such line is noted in `docs/HISTORY.md` under 2026-09-22.

**Read this before:** changing colours, type, layout tokens, rich text styling, section copy fallbacks, or replacing the logo.

## 9. Branding and Design

### Color Palette

Derived from the PMBC logo (navy + green + thin gold accent):

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#1B3A5F` | Navy. Primary background, headers, hero. |
| `--color-primary-deep` | `#14304F` | Deeper navy for contrast layers, footers, panels. |
| `--color-secondary` | `#3FA663` | Green. Accent for CTAs, success states, highlights. |
| `--color-accent` | `#C69C3E` | Gold. Sparingly used for premium accent: borders, dividers, badges. |
| `--color-accent-muted` | `#A88530` | Muted gold for uppercase eyebrow text and secondary accents. |

**Live token values are in `src/app/globals.css` (`--pmbc-*`) and mirrored in `src/lib/public/tokens.ts`. Keep the two in sync.** Phase 11 retuned the palette: primary navy `#153D64` to `#1B3A5F` (warmer, less black), deep navy `#0F2F4F` to `#14304F`, gold `#D4A93A` to `#C69C3E` (richer, less bright), muted gold `#B89530` to `#A88530`. Cream `#FAF7F2` unchanged. The hero radial gradient was re-anchored on these tokens (`#1F4269` / `#1B3A5F` / `#14304F`); its old stops bottomed out at `#0C2741`, which was the main reason the hero read as too dark.
| `--color-text-primary` | `#0F1B2D` | Body text on light. |
| `--color-text-on-dark` | `#E8EEF5` | Body text on navy. |
| `--color-muted` | `#6B7280` | Secondary text, captions. |
| `--color-surface` | `#FFFFFF` | Default light surface. |
| `--color-surface-alt` | `#F7F9FC` | Alternate light surface for section separation. |

Critical positioning point: PMBC's design language should feel **distinct from FMP**. FMP is approachable and modern (a learning platform). PMBC is institutional and senior (a credibility document for family offices). Both can share base colors but the way they're used should differ. PMBC leans more on:

- Heavier use of navy (deeper, more authoritative)
- More whitespace
- Larger type sizes
- More serif accents (consider Source Serif Pro or similar for headlines, paired with Inter for body)
- Less green (FMP uses green liberally; PMBC uses it sparingly as a credibility accent)
- Gold thread used minimally for premium signaling

### Empty is not absent

**A section's copy is read through `sectionCopy` in `src/lib/public/sectionCopy.ts`, never with `||`.** The two states mean different things and a truthiness check collapses them:

- **Key absent**: the section predates the field, or was added by hand in the builder. Fall back to the wording the page shipped with, so an older row still renders a complete page.
- **Key present and empty**: an operator cleared the field and saved. That is an instruction to remove the line, and the renderer renders nothing.

This was a real bug, twice. `form_response_note` was cleared on `/contact` in migration 065 and came back on every request; the booking callout's three fields were cleared in the builder on 2026-08-16 and did the same. In both cases the save succeeded, the row held empty strings, and the page put the defaults back, which from the operator's side is indistinguishable from a save that failed.

Composite blocks drop whole when every field in them is cleared, rather than leaving a frame around nothing: the `/contact` booking callout, the `/contact` founder card, and the `/book` alternatives block.

### Rich text (`.pmbc-prose`)

**This project does not install `@tailwindcss/typography`, and must not start using `prose` classes.** Tailwind's preflight resets everything to `margin: 0`, so before 2026-08-02 every `prose` / `prose-neutral` / `prose-invert` class in the codebase was a no-op and all CMS body copy rendered with zero spacing between paragraphs, site-wide. The replacement is a hand-written `.pmbc-prose` layer at the end of `src/app/globals.css`: paragraph and list spacing, serif headings on PMBC's scale, gold list markers and blockquote rule, gold-underlined links, and a `p:empty` rule so a deliberate blank line from the editor survives.

- Use `pmbc-prose` on any element rendering operator HTML. Add `pmbc-prose-invert` on navy sections.
- `PROSE_MEASURE` (780px) in `src/lib/public/prose.ts` is the shared column width for long-form copy, roughly 70 characters at the 17px body size. Section backgrounds still span the full 1200px container; only the text column narrows.
- `paragraphs` sections carry an optional `align` (`left` default, plus `center` / `right` / `justify`). Justified copy also gets `pmbc-prose-justify`, which turns on automatic hyphenation.
- Inline `margin` is deliberately **not** allowlisted in the sanitiser. Paragraph rhythm is a stylesheet concern; letting one operator edit set arbitrary margins would break the vertical rhythm unpredictably. `text-align`, `color` and `font-size` are allowlisted.
- **Empty paragraphs are removed, not styled.** Word, Google Docs and TipTap all express a blank line between paragraphs as an empty `<p></p>`, which is redundant here because `.pmbc-prose p` already carries a bottom margin. Left in, they double or triple the gap, and since authors are inconsistent about inserting them the column loses its rhythm. `collapseEmptyParagraphs` in `src/lib/cms/richText.ts` drops them, and it runs in three places: inside `sanitizeRichHtml` at render (so existing content is correct with no admin work), on the `page_sections` save path (so stored content matches what renders), and as a one-off backfill in migration 036. A paragraph containing only an image or other void element is **not** treated as empty. **Never give `p:empty` height in CSS**, which was tried once and stacked a full line box on top of both adjoining margins.
- Normalisation happens at the save boundary, never in the editor's `onChange`: stripping an empty paragraph mid-keystroke would delete the one the author just created by pressing Enter, and fight the cursor.

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Hero headline | Source Serif Pro / Playfair Display | 56-72px | 600 |
| Section headline | Source Serif Pro / Playfair Display | 36-48px | 600 |
| Subheadline | Inter | 18-22px | 400 |
| Body | Inter | 16-18px | 400 |
| Caption / label | Inter | 12-14px | 500 (uppercase, tracked) |

Decision pending on serif choice: present both during build phase. Both load via Google Fonts with `next/font`.

### Layout Tokens

- Max content width: 1200px everywhere, via `PAGE_GUTTER` + `PAGE_INNER` in `src/lib/public/layout.ts`. **Use those two constants rather than a fresh `max-w-[...]` literal.** The navbar and footer previously carried their own `max-w-[1280px] px-6 lg:px-8` while sections used `max-w-[1200px]` inside a `px-6` wrapper, so the logo sat 32px left of the content beneath it at 1440px. Matching the numbers alone would not have fixed it: a single element carrying both `max-w` and `px` puts padding *inside* the max width under `box-sizing: border-box`, while the section pattern puts it outside. Both halves are exported so every surface uses the same two-element structure. Heroes keep a narrower 1100px inner box on purpose; their text is centred, so that box is not a left-edge reference.

  **Check this by measuring, not by reading.** `npm run verify-container-widths` drives headless Chrome over `/`, `/team`, `/services`, `/contact`, `/fmp`, `/sectors` and `/network` at 1440 and 1920, and asserts that every container in the header, the sections and the footer reports the same left edge and the same width. Which constants a file imports does not settle where the pixels land. It also asserts that the desktop nav does not close up against the CTA: the header container is capped at 1200px, so the room the nav has is fixed above 1248px, and adding one nav item too many silently spends it. Adding Team on 2026-08-15 left a 1px gap, which is why the nav gap went from `gap-9` to `gap-6` and the actions group gained `md:ml-6` as a floor. There is now 43px.

  **A flush container does not guarantee a flush logo.** The brand box can start exactly on the container edge while the mark still looks indented, because the padding is inside the PNG and CSS cannot see transparent pixels. That is what was actually wrong: the two logo files carried roughly 490px of transparent margin down their left edges and were only 52.5% ink vertically, which put 22px of dead space before the mark. **Migration 060 fixed it at the source**, and the rule it leaves behind is that a logo file must be trimmed before it is uploaded.

  **If the logo is ever replaced, five numbers move with it.** Every surface sizes this asset by height and lets the width follow, so a new file with a different aspect ratio silently resizes the mark everywhere. `logo_height_px` and `header_height_px` in Header Settings, `footer_logo_height_px` in the footer, the `width`/`height` pair in `src/app/api/og/route.tsx`, and the `height` attribute plus `max-height` in `src/lib/email/templates/_base.ts`. The email needs both halves because Outlook honours the attribute and ignores much of the style. `npm run seed-logo-trim` re-inspects the live files and reports what it would remove, so it is also the quickest way to check whether a newly uploaded logo carries padding.
- Section vertical padding: 96px desktop, 80px tablet, 64px mobile, via `SECTION_PADDING` in `src/lib/public/layout.ts`. The shipped value had drifted to `lg:py-32` (128px) and was brought back to the documented 96px in Phase 38. Heroes are separate: `HERO_FRAME` in the same file, 70vh with `py-16`, shared by `hero`, `PageHeroFallback` and `founder_hero`
- Inner block padding: 32px
- Card radius: 8px (less rounded than FMP's 12-16px to feel more institutional)

---
