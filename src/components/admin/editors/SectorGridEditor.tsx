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
import { SECTOR_ICONS, resolveSectorIcon } from '@/lib/cms/sectorIcons';

import type { SectionEditorProps } from './types';

type Sector = {
  id: string;
  icon_name: string;
  title: string;
  description: string;
};

let nextId = 0;
const nid = () => `sector_${++nextId}_${Date.now()}`;

function s(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function pickSectors(c: Record<string, unknown>): Sector[] {
  const raw =
    (Array.isArray(c.sectors) && (c.sectors as unknown[])) ||
    (Array.isArray(c.items) && (c.items as unknown[])) ||
    [];
  return raw.map((row) => {
    if (!row || typeof row !== 'object') {
      return { id: nid(), icon_name: 'building2', title: '', description: '' };
    }
    const o = row as Record<string, unknown>;
    return {
      id: typeof o.id === 'string' ? o.id : nid(),
      icon_name: s(o.icon_name) || 'building2',
      title: s(o.title),
      description: s(o.description),
    };
  });
}

export function SectorGridEditor({ content, onChange }: SectionEditorProps) {
  const heading = s(content.heading);
  const intro = s(content.intro);
  const sectors = pickSectors(content);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const writeBack = (next: { heading?: string; intro?: string; sectors?: Sector[] }) => {
    const finalHeading = next.heading ?? heading;
    const finalIntro = next.intro ?? intro;
    const finalSectors = (next.sectors ?? sectors).map(({ id: _id, ...rest }) => {
      void _id;
      return rest;
    });
    onChange({ ...content, heading: finalHeading, intro: finalIntro, sectors: finalSectors });
  };

  const update = (id: string, patch: Partial<Sector>) =>
    writeBack({ sectors: sectors.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const addSector = () =>
    writeBack({
      sectors: [
        ...sectors,
        { id: nid(), icon_name: 'building2', title: '', description: '' },
      ],
    });

  const removeSector = (id: string) =>
    writeBack({ sectors: sectors.filter((c) => c.id !== id) });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectors.findIndex((c) => c.id === active.id);
    const newIndex = sectors.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    writeBack({ sectors: arrayMove(sectors, oldIndex, newIndex) });
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
          <p style={{ ...adminLabel, marginBottom: 0 }}>Sectors</p>
          <button type="button" onClick={addSector} style={adminButtonGhost}>
            <Plus size={13} /> Add sector
          </button>
        </div>

        {sectors.length === 0 ? (
          <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>No sectors yet.</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={sectors.map((c) => c.id)}
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
                {sectors.map((sector) => (
                  <SortableSector
                    key={sector.id}
                    sector={sector}
                    onUpdate={(patch) => update(sector.id, patch)}
                    onRemove={() => removeSector(sector.id)}
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

function SortableSector({
  sector,
  onUpdate,
  onRemove,
}: {
  sector: Sector;
  onUpdate: (patch: Partial<Sector>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sector.id });
  const Icon = resolveSectorIcon(sector.icon_name);

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
            gridTemplateColumns: '180px 1fr',
            gap: 8,
            alignItems: 'start',
          }}
        >
          <div>
            <select
              value={sector.icon_name}
              onChange={(e) => onUpdate({ icon_name: e.target.value })}
              style={{ ...adminInput, height: 36 }}
            >
              {SECTOR_ICONS.map(({ key, label }) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <div
              style={{
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                color: ADMIN_COLORS.textMuted,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(27,58,95,0.06)',
                  color: ADMIN_COLORS.primary,
                  borderRadius: 6,
                }}
              >
                <Icon size={16} strokeWidth={1.75} />
              </span>
              preview
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              value={sector.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Sector name"
              style={adminInput}
            />
            <textarea
              value={sector.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              rows={2}
              placeholder="Two-line description"
              style={adminTextarea}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove sector"
          style={adminButtonIcon}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </li>
  );
}
