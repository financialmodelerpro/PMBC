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

type Step = { id: string; number: string; title: string; description: string };

let nextId = 0;
const nid = () => `step_${++nextId}_${Date.now()}`;

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickSteps(c: Record<string, unknown>): Step[] {
  const raw = Array.isArray(c.steps) ? (c.steps as unknown[]) : [];
  return raw.map((row, idx) => {
    if (!row || typeof row !== 'object') {
      return { id: nid(), number: String(idx + 1).padStart(2, '0'), title: '', description: '' };
    }
    const o = row as Record<string, unknown>;
    return {
      id: typeof o.id === 'string' ? o.id : nid(),
      number: s(o.number) || String(idx + 1).padStart(2, '0'),
      title: s(o.title),
      description: s(o.description),
    };
  });
}

export function ProcessStepsEditor({ content, onChange }: SectionEditorProps) {
  const heading = s(content.heading);
  const intro = s(content.intro);
  const steps = pickSteps(content);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const writeBack = (next: { heading?: string; intro?: string; steps?: Step[] }) => {
    const finalHeading = next.heading ?? heading;
    const finalIntro = next.intro ?? intro;
    const finalSteps = (next.steps ?? steps).map(({ id: _id, ...rest }) => {
      void _id;
      return rest;
    });
    onChange({ ...content, heading: finalHeading, intro: finalIntro, steps: finalSteps });
  };

  const update = (id: string, patch: Partial<Step>) =>
    writeBack({ steps: steps.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const addStep = () =>
    writeBack({
      steps: [
        ...steps,
        {
          id: nid(),
          number: String(steps.length + 1).padStart(2, '0'),
          title: '',
          description: '',
        },
      ],
    });

  const removeStep = (id: string) =>
    writeBack({ steps: steps.filter((c) => c.id !== id) });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((c) => c.id === active.id);
    const newIndex = steps.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    writeBack({ steps: arrayMove(steps, oldIndex, newIndex) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <label style={{ display: 'block' }}>
        <span style={adminLabel}>Heading (optional)</span>
        <input
          type="text"
          value={heading}
          onChange={(e) => writeBack({ heading: e.target.value })}
          style={adminInput}
        />
      </label>

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
          <p style={{ ...adminLabel, marginBottom: 0 }}>Steps</p>
          <button type="button" onClick={addStep} style={adminButtonGhost}>
            <Plus size={13} /> Add step
          </button>
        </div>

        {steps.length === 0 ? (
          <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>No steps yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={steps.map((c) => c.id)}
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
                {steps.map((step) => (
                  <SortableStep
                    key={step.id}
                    step={step}
                    onUpdate={(patch) => update(step.id, patch)}
                    onRemove={() => removeStep(step.id)}
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

function SortableStep({
  step,
  onUpdate,
  onRemove,
}: {
  step: Step;
  onUpdate: (patch: Partial<Step>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id });

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
            value={step.number}
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
            value={step.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Step title (e.g., Understand)"
            style={adminInput}
          />
          <div />
          <textarea
            value={step.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            rows={2}
            placeholder="Step description"
            style={adminTextarea}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove step"
          style={adminButtonIcon}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}
