'use client';

import { type CSSProperties } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';

import { MediaField } from '@/components/admin/MediaField';
import { RichTextarea } from '@/components/admin/RichTextarea';
import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonIcon,
  adminFieldHint,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

type Slide = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  image_alt: string;
};

let nextId = 0;
const nid = () => `slide_${++nextId}_${Date.now()}`;

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickSlides(c: Record<string, unknown>): Slide[] {
  const raw =
    (Array.isArray(c.items) && (c.items as unknown[])) ||
    (Array.isArray(c.cards) && (c.cards as unknown[])) ||
    [];
  return raw.map((row) => {
    if (!row || typeof row !== 'object') {
      return { id: nid(), title: '', description: '', image_url: '', image_alt: '' };
    }
    const o = row as Record<string, unknown>;
    return {
      id: typeof o.id === 'string' ? o.id : nid(),
      title: s(o.title),
      description: s(o.description),
      image_url: s(o.image_url),
      image_alt: s(o.image_alt),
    };
  });
}

function readSeconds(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(s(raw));
  if (!Number.isFinite(n) || n <= 0) return 6;
  return Math.min(Math.max(n, 3), 30);
}

/**
 * Editor for the audience carousel: the section intro, how long each card is
 * held, and a reorderable list of cards.
 *
 * The image sits in the same `MediaField` every other media slot uses, so an
 * operator uploads a card image exactly the way they upload a section image,
 * and a card left without one still renders (as a monogram panel) rather than
 * blocking the section.
 */
export function AudienceCarouselEditor({ content, onChange }: SectionEditorProps) {
  const eyebrow = s(content.eyebrow);
  const headline = s(content.headline);
  const intro = s(content.intro);
  const seconds = readSeconds(content.autoplay_seconds);
  const slides = pickSlides(content);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const writeBack = (next: Partial<Record<string, unknown>> & { slides?: Slide[] }) => {
    const { slides: nextSlides, ...rest } = next;
    const items = (nextSlides ?? slides).map(({ id: _id, ...row }) => {
      void _id;
      return row;
    });
    onChange({ ...content, ...rest, items });
  };

  const update = (id: string, patch: Partial<Slide>) =>
    writeBack({ slides: slides.map((x) => (x.id === id ? { ...x, ...patch } : x)) });

  const addSlide = () =>
    writeBack({
      slides: [
        ...slides,
        { id: nid(), title: '', description: '', image_url: '', image_alt: '' },
      ],
    });

  const removeSlide = (id: string) =>
    writeBack({ slides: slides.filter((x) => x.id !== id) });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = slides.findIndex((x) => x.id === active.id);
    const to = slides.findIndex((x) => x.id === over.id);
    if (from === -1 || to === -1) return;
    writeBack({ slides: arrayMove(slides, from, to) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <label style={{ display: 'block' }}>
        <span style={adminLabel}>Eyebrow</span>
        <input
          type="text"
          value={eyebrow}
          placeholder="WHO WE SERVE"
          onChange={(e) => writeBack({ eyebrow: e.target.value })}
          style={adminInput}
        />
      </label>

      <label style={{ display: 'block' }}>
        <span style={adminLabel}>Headline</span>
        <input
          type="text"
          value={headline}
          onChange={(e) => writeBack({ headline: e.target.value })}
          style={adminInput}
        />
      </label>

      <label style={{ display: 'block' }}>
        <span style={adminLabel}>Intro (optional)</span>
        <textarea
          value={intro}
          rows={2}
          onChange={(e) => writeBack({ intro: e.target.value })}
          style={adminTextarea}
        />
      </label>

      <label style={{ display: 'block' }}>
        <span style={adminLabel}>Seconds per card</span>
        <input
          type="number"
          min={3}
          max={30}
          step={1}
          value={seconds}
          onChange={(e) => writeBack({ autoplay_seconds: readSeconds(e.target.value) })}
          style={{ ...adminInput, maxWidth: 160 }}
        />
        <p style={adminFieldHint}>
          Between 3 and 30. The carousel holds on hover, on keyboard focus, and
          for anyone whose system asks for reduced motion. The arrows work in
          every one of those states.
        </p>
      </label>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <p style={{ ...adminLabel, marginBottom: 0 }}>Cards</p>
          <button type="button" onClick={addSlide} style={adminButtonGhost}>
            <Plus size={13} /> Add card
          </button>
        </div>

        {slides.length === 0 ? (
          <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
            No cards yet. The section renders nothing until at least one is added.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={slides.map((x) => x.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {slides.map((slide, i) => (
                  <SortableSlide
                    key={slide.id}
                    position={i + 1}
                    slide={slide}
                    onUpdate={(patch) => update(slide.id, patch)}
                    onRemove={() => removeSlide(slide.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function SortableSlide({
  slide,
  position,
  onUpdate,
  onRemove,
}: {
  slide: Slide;
  position: number;
  onUpdate: (patch: Partial<Slide>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: '#FFFFFF',
    border: `1px solid ${ADMIN_COLORS.border}`,
    borderRadius: 10,
    padding: 12,
  };

  const dragBtn: CSSProperties = {
    width: 26,
    height: 28,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: ADMIN_COLORS.textMicro,
    cursor: 'grab',
    marginTop: 4,
  };

  return (
    <li style={style} ref={setNodeRef}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          style={dragBtn}
        >
          <GripVertical size={15} />
        </button>

        <div style={{ flex: 1, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: ADMIN_COLORS.textMicro }}>
              {String(position).padStart(2, '0')}
            </span>
            <input
              type="text"
              value={slide.title}
              placeholder="Card title"
              onChange={(e) => onUpdate({ title: e.target.value })}
              style={{ ...adminInput, flex: 1 }}
            />
          </div>

          <RichTextarea
            value={slide.description}
            onChange={(html) => onUpdate({ description: html })}
            placeholder="A short paragraph describing this audience."
          />

          <MediaField
            content={{ image_url: slide.image_url }}
            urlKey="image_url"
            onChange={(patch) => onUpdate({ image_url: s(patch.image_url) })}
            label="Card image"
            hint="Fills the left half of the card. A card with none shows a monogram panel."
          />

          <label style={{ display: 'block' }}>
            <span style={{ ...adminLabel, fontSize: 11 }}>Image alt text</span>
            <input
              type="text"
              value={slide.image_alt}
              placeholder="Falls back to the card title"
              onChange={(e) => onUpdate({ image_alt: e.target.value })}
              style={adminInput}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove card"
          style={adminButtonIcon}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}
