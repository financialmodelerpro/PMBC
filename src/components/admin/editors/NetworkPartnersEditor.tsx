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

type Partner = {
  id: string;
  logo_url: string;
  name: string;
  location: string;
  description: string;
  role_tag: string;
  link: string;
};

let nextId = 0;
const nid = () => `partner_${++nextId}_${Date.now()}`;

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickPartners(c: Record<string, unknown>): Partner[] {
  const raw = Array.isArray(c.partners) ? (c.partners as unknown[]) : [];
  return raw.map((row) => {
    if (!row || typeof row !== 'object') {
      return {
        id: nid(),
        logo_url: '',
        name: '',
        location: '',
        description: '',
        role_tag: '',
        link: '',
      };
    }
    const o = row as Record<string, unknown>;
    return {
      id: typeof o.id === 'string' ? o.id : nid(),
      logo_url: s(o.logo_url),
      name: s(o.name),
      location: s(o.location),
      description: s(o.description),
      role_tag: s(o.role_tag),
      link: s(o.link),
    };
  });
}

export function NetworkPartnersEditor({ content, onChange }: SectionEditorProps) {
  const heading = s(content.heading);
  const intro = s(content.intro);
  const partners = pickPartners(content);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const writeBack = (next: { heading?: string; intro?: string; partners?: Partner[] }) => {
    const finalHeading = next.heading ?? heading;
    const finalIntro = next.intro ?? intro;
    const finalPartners = (next.partners ?? partners).map(({ id: _id, ...rest }) => {
      void _id;
      return rest;
    });
    onChange({ ...content, heading: finalHeading, intro: finalIntro, partners: finalPartners });
  };

  const update = (id: string, patch: Partial<Partner>) =>
    writeBack({ partners: partners.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const addPartner = () =>
    writeBack({
      partners: [
        ...partners,
        { id: nid(), logo_url: '', name: '', location: '', description: '', role_tag: '', link: '' },
      ],
    });

  const removePartner = (id: string) =>
    writeBack({ partners: partners.filter((c) => c.id !== id) });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = partners.findIndex((c) => c.id === active.id);
    const newIndex = partners.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    writeBack({ partners: arrayMove(partners, oldIndex, newIndex) });
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
          <p style={{ ...adminLabel, marginBottom: 0 }}>Partners</p>
          <button type="button" onClick={addPartner} style={adminButtonGhost}>
            <Plus size={13} /> Add partner
          </button>
        </div>

        {partners.length === 0 ? (
          <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>No partners yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={partners.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {partners.map((partner) => (
                  <SortablePartner
                    key={partner.id}
                    partner={partner}
                    onUpdate={(patch) => update(partner.id, patch)}
                    onRemove={() => removePartner(partner.id)}
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

function SortablePartner({
  partner,
  onUpdate,
  onRemove,
}: {
  partner: Partner;
  onUpdate: (patch: Partial<Partner>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: partner.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    background: '#FFFFFF',
    border: `1px solid ${ADMIN_COLORS.border}`,
    borderRadius: 10,
    padding: 14,
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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <FieldShell label="Name">
              <input
                type="text"
                value={partner.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="Sky Gulf"
                style={adminInput}
              />
            </FieldShell>
            <FieldShell label="Location">
              <input
                type="text"
                value={partner.location}
                onChange={(e) => onUpdate({ location: e.target.value })}
                placeholder="Dubai, UAE"
                style={adminInput}
              />
            </FieldShell>
            <FieldShell label="Logo URL">
              <input
                type="text"
                value={partner.logo_url}
                onChange={(e) => onUpdate({ logo_url: e.target.value })}
                placeholder="https://…/logo.png"
                style={adminInput}
              />
            </FieldShell>
            <FieldShell label="Role tag">
              <input
                type="text"
                value={partner.role_tag}
                onChange={(e) => onUpdate({ role_tag: e.target.value })}
                placeholder="Strategic Partner"
                style={adminInput}
              />
            </FieldShell>
          </div>
          <FieldShell label="Description">
            <textarea
              value={partner.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              rows={3}
              placeholder="Short description of the partnership"
              style={adminTextarea}
            />
          </FieldShell>
          <FieldShell label="Link (optional)">
            <input
              type="text"
              value={partner.link}
              onChange={(e) => onUpdate({ link: e.target.value })}
              placeholder="https://…"
              style={adminInput}
            />
          </FieldShell>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove partner"
          style={adminButtonIcon}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}

function FieldShell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span
        style={{
          display: 'block',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: ADMIN_COLORS.textMuted,
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
