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

import { RichTextEditor } from '@/components/admin/RichTextEditor';
import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminInput,
  adminLabel,
  adminTextarea,
} from '@/lib/admin/styles';
import { SERVICES } from '@/config/services';

import type { SectionEditorProps } from './types';

type Deliverable = { id: string; text: string };

let nextId = 0;
const nid = () => `deliv_${++nextId}_${Date.now()}`;

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickDeliverables(c: Record<string, unknown>): Deliverable[] {
  const raw = Array.isArray(c.deliverables) ? (c.deliverables as unknown[]) : [];
  return raw
    .map((p) => (typeof p === 'string' ? p : null))
    .filter((p): p is string => p !== null)
    .map((text) => ({ id: nid(), text }));
}

export function ServiceDetailEditor({ content, onChange }: SectionEditorProps) {
  const service_slug = s(content.service_slug);
  const full_description_html = s(content.full_description_html) || s(content.description);
  const timeline_text = s(content.timeline_text);
  const target_audience_text = s(content.target_audience_text);
  const deliverables = pickDeliverables(content);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const writeBack = (next: {
    service_slug?: string;
    full_description_html?: string;
    timeline_text?: string;
    target_audience_text?: string;
    deliverables?: Deliverable[];
  }) => {
    const finalDeliverables = (next.deliverables ?? deliverables).map((d) => d.text);
    const { description: _legacy, ...rest } = content;
    void _legacy;
    onChange({
      ...rest,
      service_slug: next.service_slug ?? service_slug,
      full_description_html: next.full_description_html ?? full_description_html,
      timeline_text: next.timeline_text ?? timeline_text,
      target_audience_text: next.target_audience_text ?? target_audience_text,
      deliverables: finalDeliverables,
    });
  };

  const updateDeliverable = (id: string, text: string) =>
    writeBack({ deliverables: deliverables.map((d) => (d.id === id ? { ...d, text } : d)) });

  const addDeliverable = () =>
    writeBack({ deliverables: [...deliverables, { id: nid(), text: '' }] });

  const removeDeliverable = (id: string) =>
    writeBack({ deliverables: deliverables.filter((d) => d.id !== id) });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = deliverables.findIndex((d) => d.id === active.id);
    const newIndex = deliverables.findIndex((d) => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    writeBack({ deliverables: arrayMove(deliverables, oldIndex, newIndex) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field
        label="Service"
        hint="Pulls number, title, and summary from src/config/services.ts"
      >
        <select
          value={service_slug}
          onChange={(e) => writeBack({ service_slug: e.target.value })}
          style={adminInput}
        >
          <option value="">— Select a service —</option>
          {SERVICES.map((sv) => (
            <option key={sv.slug} value={sv.slug}>
              {sv.number} · {sv.title}
            </option>
          ))}
        </select>
      </Field>

      <div>
        <p style={adminLabel}>Full description</p>
        <RichTextEditor
          value={full_description_html}
          onChange={(html) => writeBack({ full_description_html: html })}
          ariaLabel="Service full description editor"
          minHeight={220}
        />
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <p style={{ ...adminLabel, marginBottom: 0 }}>Key deliverables</p>
          <button type="button" onClick={addDeliverable} style={adminButtonGhost}>
            <Plus size={13} /> Add deliverable
          </button>
        </div>
        {deliverables.length === 0 ? (
          <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>No deliverables yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={deliverables.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {deliverables.map((d) => (
                  <SortableDeliverable
                    key={d.id}
                    deliverable={d}
                    onUpdate={(text) => updateDeliverable(d.id, text)}
                    onRemove={() => removeDeliverable(d.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Field label="Typical timeline">
        <textarea
          value={timeline_text}
          onChange={(e) => writeBack({ timeline_text: e.target.value })}
          rows={2}
          placeholder="e.g., 4-6 weeks for an institutional model"
          style={adminTextarea}
        />
      </Field>

      <Field label="Who it's for">
        <textarea
          value={target_audience_text}
          onChange={(e) => writeBack({ target_audience_text: e.target.value })}
          rows={2}
          placeholder="e.g., Family offices and corporates evaluating acquisition targets"
          style={adminTextarea}
        />
      </Field>
    </div>
  );
}

function SortableDeliverable({
  deliverable,
  onUpdate,
  onRemove,
}: {
  deliverable: Deliverable;
  onUpdate: (text: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deliverable.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: '#FFFFFF',
    border: `1px solid ${ADMIN_COLORS.border}`,
    borderRadius: 8,
    padding: 6,
  };

  return (
    <li style={style} ref={setNodeRef}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{
          width: 24,
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          color: ADMIN_COLORS.textMicro,
          cursor: 'grab',
        }}
      >
        <GripVertical size={14} />
      </button>
      <input
        type="text"
        value={deliverable.text}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder="Deliverable"
        style={{ ...adminInput, padding: '6px 10px' }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove deliverable"
        style={{
          width: 28,
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFFFFF',
          color: ADMIN_COLORS.textMuted,
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 6,
          cursor: 'pointer',
        }}
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <span style={adminLabel}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: ADMIN_COLORS.textMicro }}>{hint}</span>}
      </div>
      {children}
    </label>
  );
}
