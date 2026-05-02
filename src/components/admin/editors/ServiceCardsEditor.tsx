'use client';

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

import type { SectionEditorProps } from './types';

type Card = {
  id: string;
  number: string;
  title: string;
  description: string;
  link: string;
};

const inputCls =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15';

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
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-[#0F2540]">
          Intro (optional)
        </span>
        <textarea
          value={intro}
          onChange={(e) => writeBack({ intro: e.target.value })}
          rows={2}
          className={inputCls + ' resize-y'}
        />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-[#0F2540]">Cards</p>
          <button
            type="button"
            onClick={addCard}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-xs font-medium text-[#0F2540] hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add card
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="text-xs text-neutral-500">No cards yet.</p>
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
              <ul className="space-y-2">
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-md border border-neutral-200 bg-white p-3"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="mt-1 inline-flex h-7 w-6 cursor-grab items-center justify-center text-neutral-400 hover:text-[#0F2540] active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="grid flex-1 grid-cols-[80px_1fr] gap-2">
          <input
            type="text"
            value={card.number}
            onChange={(e) => onUpdate({ number: e.target.value })}
            placeholder="01"
            className={inputCls + ' text-center font-mono'}
          />
          <input
            type="text"
            value={card.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Title"
            className={inputCls}
          />
          <div />
          <textarea
            value={card.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={2}
            placeholder="Description"
            className={inputCls + ' resize-y'}
          />
          <div />
          <input
            type="text"
            value={card.link}
            onChange={(e) => onUpdate({ link: e.target.value })}
            placeholder="/services/financial-modeling"
            className={inputCls}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove card"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
