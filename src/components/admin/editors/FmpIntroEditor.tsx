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
  adminButtonIcon,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';

import type { SectionEditorProps } from './types';

type Point = { id: string; text: string };

let nextId = 0;
const nid = () => `point_${++nextId}_${Date.now()}`;

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickPoints(c: Record<string, unknown>): Point[] {
  const raw =
    (Array.isArray(c.feature_points) && (c.feature_points as unknown[])) ||
    (Array.isArray(c.features) && (c.features as unknown[])) ||
    [];
  return raw
    .map((p) => (typeof p === 'string' ? p : null))
    .filter((p): p is string => p !== null)
    .map((text) => ({ id: nid(), text }));
}

export function FmpIntroEditor({ content, onChange }: SectionEditorProps) {
  const heading = s(content.heading);
  const description_html = s(content.description_html) || s(content.description);
  const cta_label = s(content.cta_label) || 'Visit Financial Modeler Pro';
  const cta_href = s(content.cta_href) || 'https://www.financialmodelerpro.com';
  const logo_url = s(content.logo_url);
  const points = pickPoints(content);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const writeBack = (next: {
    heading?: string;
    description_html?: string;
    cta_label?: string;
    cta_href?: string;
    logo_url?: string;
    points?: Point[];
  }) => {
    const finalPoints = (next.points ?? points).map((p) => p.text);
    const { description: _legacy, features: _legacyFeatures, ...rest } = content;
    void _legacy;
    void _legacyFeatures;
    onChange({
      ...rest,
      heading: next.heading ?? heading,
      description_html: next.description_html ?? description_html,
      cta_label: next.cta_label ?? cta_label,
      cta_href: next.cta_href ?? cta_href,
      logo_url: next.logo_url ?? logo_url,
      feature_points: finalPoints,
    });
  };

  const updatePoint = (id: string, text: string) =>
    writeBack({ points: points.map((p) => (p.id === id ? { ...p, text } : p)) });

  const addPoint = () =>
    writeBack({ points: [...points, { id: nid(), text: '' }] });

  const removePoint = (id: string) =>
    writeBack({ points: points.filter((p) => p.id !== id) });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = points.findIndex((p) => p.id === active.id);
    const newIndex = points.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    writeBack({ points: arrayMove(points, oldIndex, newIndex) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Field label="Heading">
        <input
          type="text"
          value={heading}
          onChange={(e) => writeBack({ heading: e.target.value })}
          placeholder="The platform powered by PaceMakers"
          style={adminInput}
        />
      </Field>

      <Field label="Logo URL (optional)">
        <input
          type="text"
          value={logo_url}
          onChange={(e) => writeBack({ logo_url: e.target.value })}
          placeholder="https://…/fmp-logo.svg"
          style={adminInput}
        />
      </Field>

      <div>
        <p style={adminLabel}>Description</p>
        <RichTextEditor
          value={description_html}
          onChange={(html) => writeBack({ description_html: html })}
          ariaLabel="FMP description editor"
          minHeight={180}
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
          <p style={{ ...adminLabel, marginBottom: 0 }}>Feature points</p>
          <button type="button" onClick={addPoint} style={adminButtonGhost}>
            <Plus size={13} /> Add point
          </button>
        </div>
        {points.length === 0 ? (
          <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>No points yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={points.map((p) => p.id)}
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
                {points.map((p) => (
                  <SortablePoint
                    key={p.id}
                    point={p}
                    onUpdate={(text) => updatePoint(p.id, text)}
                    onRemove={() => removePoint(p.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Fieldset legend="CTA">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Label">
            <input
              type="text"
              value={cta_label}
              onChange={(e) => writeBack({ cta_label: e.target.value })}
              style={adminInput}
            />
          </Field>
          <Field label="Link">
            <input
              type="text"
              value={cta_href}
              onChange={(e) => writeBack({ cta_href: e.target.value })}
              style={adminInput}
            />
          </Field>
        </div>
      </Fieldset>
    </div>
  );
}

function SortablePoint({
  point,
  onUpdate,
  onRemove,
}: {
  point: Point;
  onUpdate: (text: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: point.id });

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
        value={point.text}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder="Feature point"
        style={{ ...adminInput, padding: '6px 10px' }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove point"
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

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset
      style={{
        border: `1px solid ${ADMIN_COLORS.border}`,
        borderRadius: 10,
        padding: 14,
        margin: 0,
      }}
    >
      <legend
        style={{
          padding: '0 6px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: ADMIN_COLORS.textBody,
        }}
      >
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={adminLabel}>{label}</span>
      {children}
    </label>
  );
}
