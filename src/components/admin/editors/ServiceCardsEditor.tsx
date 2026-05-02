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

import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonIcon,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

type Card = {
  id: string;
  number: string;
  title: string;
  description: string;
  link: string;
};

let nextId = 0;
const nid = () => `card_${++nextId}_${Date.now()}`;

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickCards(c: Record<string, unknown>): Card[] {
  const raw =
    (Array.isArray(c.cards) && (c.cards as unknown[])) ||
    (Array.isArray(c.items) && (c.items as unknown[])) ||
    [];
  return raw.map((row) => {
    if (!row || typeof row !== 'object') {
      return { id: nid(), number: '', title: '', description: '', link: '' };
    }
    const o = row as Record<string, unknown>;
    return {
      id: typeof o.id === 'string' ? o.id : nid(),
      number: s(o.number),
      title: s(o.title),
      description: s(o.description),
      link: s(o.link),
    };
  });
}

export function ServiceCardsEditor({ content, onChange }: SectionEditorProps) {
  const intro = s(content.intro);
  const cards = pickCards(content);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const writeBack = (next: { intro?: string; cards?: Card[] }) => {
    const finalIntro = next.intro ?? intro;
    const finalCards = (next.cards ?? cards).map(({ id: _id, ...rest }) => {
      void _id;
      return rest;
    });
    onChange({ ...content, intro: finalIntro, cards: finalCards });
  };

  const update = (id: string, patch: Partial<Card>) =>
    writeBack({ cards: cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const addCard = () =>
    writeBack({
      cards: [
        ...cards,
        { id: nid(), number: '', title: '', description: '', link: '' },
      ],
    });

  const removeCard = (id: string) =>
    writeBack({ cards: cards.filter((c) => c.id !== id) });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const newIndex = cards.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    writeBack({ cards: arrayMove(cards, oldIndex, newIndex) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <label style={{ display: 'block' }}>
        <span style={adminLabel}>Intro (optional)</span>
        <textarea
          value={intro}
          onChange={(e) => writeBack({ intro: e.target.value })}
          rows={2}
          style={adminTextarea}
        />
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
          <button type="button" onClick={addCard} style={adminButtonGhost}>
            <Plus size={13} /> Add card
          </button>
        </div>

        {cards.length === 0 ? (
          <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>No cards yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={cards.map((c) => c.id)}
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
                {cards.map((card) => (
                  <SortableCard
                    key={card.id}
                    card={card}
                    onUpdate={(patch) => update(card.id, patch)}
                    onRemove={() => removeCard(card.id)}
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

function SortableCard({
  card,
  onUpdate,
  onRemove,
}: {
  card: Card;
  onUpdate: (patch: Partial<Card>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

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
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '80px 1fr',
            gap: 8,
          }}
        >
          <input
            type="text"
            value={card.number}
            onChange={(e) => onUpdate({ number: e.target.value })}
            placeholder="01"
            style={{
              ...adminInput,
              textAlign: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          />
          <input
            type="text"
            value={card.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Title"
            style={adminInput}
          />
          <div />
          <textarea
            value={card.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={2}
            placeholder="Description"
            style={adminTextarea}
          />
          <div />
          <input
            type="text"
            value={card.link}
            onChange={(e) => onUpdate({ link: e.target.value })}
            placeholder="/services/financial-modeling"
            style={adminInput}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove card"
          style={adminButtonIcon}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}
