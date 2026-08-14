'use client';

import { Plus, Trash2 } from 'lucide-react';

import { MediaField } from '@/components/admin/MediaField';
import { MediaHeightControl } from '@/components/admin/MediaHeightControl';
import { ADMIN_COLORS, adminButtonGhost, adminFieldHint, adminInput, adminLabel } from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

/**
 * A card is a loose record rather than a fixed shape, because the media slot
 * writes six keys (`media_url` plus its type, poster and three playback flags)
 * and they travel with the card. Naming them here would mean naming them again
 * in the renderer and in `lib/media.ts`, which is three places for one list.
 */
type Card = Record<string, unknown> & {
  title: string;
  code: string;
  description: string;
  meta: string[];
  bullets: string[];
  cta_label: string;
  cta_href: string;
  note: string;
  media_alt: string;
};

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function lines(raw: unknown): string {
  return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').join('\n') : '';
}

function readCards(raw: unknown): Card[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      // Unknown keys are carried through rather than dropped: the media slot's
      // six keys live on the card, and rebuilding the object from a fixed field
      // list would silently discard them on the next edit to any other field.
      ...o,
      title: s(o.title),
      code: s(o.code),
      description: s(o.description),
      meta: Array.isArray(o.meta) ? (o.meta as string[]) : [],
      bullets: Array.isArray(o.bullets) ? (o.bullets as string[]) : [],
      cta_label: s(o.cta_label),
      cta_href: s(o.cta_href),
      note: s(o.note),
      media_alt: s(o.media_alt),
    };
  });
}

export function FeatureCardsEditor({ content, onChange }: SectionEditorProps) {
  const cards = readCards(content.cards);
  const patch = (p: Record<string, unknown>) => onChange({ ...content, ...p });
  const setCards = (next: Card[]) => patch({ cards: next });
  const update = (i: number, p: Partial<Card>) => {
    const next = [...cards];
    next[i] = { ...cards[i], ...p };
    setCards(next);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {(['eyebrow', 'heading', 'intro'] as const).map((field) => (
        <div key={field}>
          <label style={adminLabel}>
            {field === 'intro' ? 'Intro (optional)' : field === 'eyebrow' ? 'Eyebrow (optional)' : 'Heading'}
          </label>
          <input
            type="text"
            value={s(content[field])}
            onChange={(e) => patch({ [field]: e.target.value })}
            style={adminInput}
          />
        </div>
      ))}

      <div>
        <label style={adminLabel}>Layout</label>
        <select
          value={content.layout === 'rows' ? 'rows' : 'cards'}
          onChange={(e) => patch({ layout: e.target.value })}
          style={adminInput}
        >
          <option value="cards">Cards side by side</option>
          <option value="rows">Full-width rows, media alternating sides</option>
        </select>
        <p style={adminFieldHint}>
          Rows give each entry the full width and put its media on the opposite
          side to the one above it, starting with the media on the right. Rows
          also remove the uneven heights two side-by-side cards get when one has
          fewer bullets than the other.
        </p>
      </div>

      <div>
        <p style={adminLabel}>Cards</p>
        <p style={adminFieldHint}>
          Two cards render side by side, three or more in a grid. A CTA whose link
          starts with http opens in a new tab.
        </p>
        <div style={{ display: 'grid', gap: 14, marginTop: 8 }}>
          {cards.map((card, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${ADMIN_COLORS.border}`,
                borderRadius: 10,
                padding: 14,
                display: 'grid',
                gap: 10,
                background: '#FCFDFE',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
                  Card {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setCards(cards.filter((_, j) => j !== i))}
                  style={{ ...adminButtonGhost, color: ADMIN_COLORS.danger }}
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>

              <label>
                <span style={adminLabel}>Title</span>
                <input
                  type="text"
                  value={card.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  style={adminInput}
                />
              </label>

              <label>
                <span style={adminLabel}>Code or eyebrow (optional)</span>
                <input
                  type="text"
                  value={card.code}
                  placeholder="e.g. 3SFM"
                  onChange={(e) => update(i, { code: e.target.value })}
                  style={adminInput}
                />
              </label>

              <label>
                <span style={adminLabel}>Description</span>
                <textarea
                  value={card.description}
                  rows={3}
                  onChange={(e) => update(i, { description: e.target.value })}
                  style={{ ...adminInput, resize: 'vertical' }}
                />
              </label>

              <label>
                <span style={adminLabel}>Metadata chips, one per line</span>
                <textarea
                  value={lines(card.meta)}
                  rows={3}
                  placeholder={'17 Sessions\n6 Hours\nBeginner'}
                  onChange={(e) =>
                    update(i, { meta: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })
                  }
                  style={{ ...adminInput, resize: 'vertical' }}
                />
              </label>

              <label>
                <span style={adminLabel}>Bullets, one per line</span>
                <textarea
                  value={lines(card.bullets)}
                  rows={6}
                  onChange={(e) =>
                    update(i, { bullets: e.target.value.split('\n').map((l) => l.trim()).filter(Boolean) })
                  }
                  style={{ ...adminInput, resize: 'vertical' }}
                />
              </label>

              <label>
                <span style={adminLabel}>Note under the bullets (optional)</span>
                <input
                  type="text"
                  value={card.note}
                  onChange={(e) => update(i, { note: e.target.value })}
                  style={adminInput}
                />
              </label>

              {/* Only meaningful in the rows layout, and shown regardless: an
                  operator switching to rows should find the asset already set,
                  not discover a control that appeared after the switch. */}
              <div>
                <MediaField
                  content={card}
                  urlKey="media_url"
                  onChange={(p) => update(i, p as Partial<Card>)}
                  label="Media, used by the rows layout"
                  hint="Image, GIF or video, framed in the gold hairline used everywhere else on the site. Empty renders a monogram panel, so the row keeps its shape until you upload."
                />
                <label>
                  <span style={adminLabel}>Media alt text</span>
                  <input
                    type="text"
                    value={s(card.media_alt)}
                    placeholder="Defaults to the card title"
                    onChange={(e) => update(i, { media_alt: e.target.value })}
                    style={adminInput}
                  />
                </label>
                {/* One ceiling per card, not one for the section. Two rows hold
                    two different assets, and a single number would be a ceiling
                    for whichever of them happens to be taller. */}
                <div style={{ marginTop: 10 }}>
                  <MediaHeightControl
                    content={card}
                    onChange={(p) => update(i, p as Partial<Card>)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' }}>
                <label>
                  <span style={adminLabel}>CTA label</span>
                  <input
                    type="text"
                    value={card.cta_label}
                    onChange={(e) => update(i, { cta_label: e.target.value })}
                    style={adminInput}
                  />
                </label>
                <label>
                  <span style={adminLabel}>CTA link</span>
                  <input
                    type="text"
                    value={card.cta_href}
                    onChange={(e) => update(i, { cta_href: e.target.value })}
                    style={adminInput}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setCards([
              ...cards,
              {
                title: '',
                code: '',
                description: '',
                meta: [],
                bullets: [],
                cta_label: '',
                cta_href: '',
                note: '',
                media_alt: '',
              },
            ])
          }
          style={{ ...adminButtonGhost, marginTop: 10 }}
        >
          <Plus size={13} /> Add card
        </button>
      </div>
    </div>
  );
}
