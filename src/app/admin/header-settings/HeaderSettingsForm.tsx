'use client';

import { useState, type CSSProperties } from 'react';
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

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonIcon,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
  adminCard,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';
import type { HeaderConfig, NavItem } from '@/lib/cms/headerSettings';

type LocalNavItem = NavItem & { id: string };

let nextId = 0;
const nid = () => `nav_${++nextId}_${Date.now()}`;

export function HeaderSettingsForm({ initial }: { initial: HeaderConfig }) {
  const [items, setItems] = useState<LocalNavItem[]>(() =>
    initial.nav_items.map((n) => ({ ...n, id: nid() })),
  );
  const [ctaLabel, setCtaLabel] = useState(initial.cta_label);
  const [ctaHref, setCtaHref] = useState(initial.cta_href);
  const [showCta, setShowCta] = useState(initial.show_cta);
  const [mobileMenu, setMobileMenu] = useState(initial.mobile_menu_enabled);

  const [state, setState] = useState<SaveState>('idle');
  const [errMsg, setErrMsg] = useState<string | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((arr) => {
      const oldIndex = arr.findIndex((i) => i.id === active.id);
      const newIndex = arr.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return arr;
      return arrayMove(arr, oldIndex, newIndex);
    });
  };

  const addItem = () => setItems((a) => [...a, { id: nid(), label: '', href: '' }]);
  const removeItem = (id: string) => setItems((a) => a.filter((i) => i.id !== id));
  const updateItem = (id: string, patch: Partial<NavItem>) =>
    setItems((a) => a.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const onSave = async () => {
    for (const i of items) {
      if (!i.label.trim() || !i.href.trim()) {
        setState('error');
        setErrMsg('Every nav item needs a label and href.');
        return;
      }
    }
    setState('saving');
    setErrMsg(undefined);
    try {
      const res = await fetch('/api/admin/header-settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nav_items: items.map(({ label, href }) => ({ label, href })),
          cta_label: ctaLabel,
          cta_href: ctaHref,
          show_cta: showCta,
          mobile_menu_enabled: mobileMenu,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Save failed');
      }
      setState('saved');
      setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      setState('error');
      setErrMsg((e as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section style={adminCard}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: ADMIN_COLORS.textHeading,
            }}
          >
            Navigation items
          </h2>
          <button type="button" onClick={addItem} style={adminButtonGhost}>
            <Plus size={13} /> Add item
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
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
              {items.map((item) => (
                <SortableNavRow
                  key={item.id}
                  item={item}
                  onChange={(patch) => updateItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        {items.length === 0 && (
          <p style={{ fontSize: 13, color: ADMIN_COLORS.textMuted }}>
            No nav items. Add one to get started.
          </p>
        )}
      </section>

      <section style={adminCard}>
        <h2
          style={{
            margin: '0 0 14px',
            fontSize: 14,
            fontWeight: 700,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          Call to action
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label>
            <span style={adminLabel}>CTA label</span>
            <input
              type="text"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              style={adminInput}
            />
          </label>
          <label>
            <span style={adminLabel}>CTA link</span>
            <input
              type="text"
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              style={adminInput}
            />
          </label>
        </div>
        <label
          style={{
            marginTop: 14,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          <input
            type="checkbox"
            checked={showCta}
            onChange={(e) => setShowCta(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          Show CTA in header
        </label>
      </section>

      <section style={adminCard}>
        <h2
          style={{
            margin: '0 0 14px',
            fontSize: 14,
            fontWeight: 700,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          Mobile
        </h2>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: ADMIN_COLORS.textHeading,
          }}
        >
          <input
            type="checkbox"
            checked={mobileMenu}
            onChange={(e) => setMobileMenu(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          Enable hamburger menu on mobile
        </label>
      </section>

      <div
        style={{
          paddingTop: 18,
          borderTop: `1px solid ${ADMIN_COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SaveStatus state={state} message={errMsg} />
        <button
          type="button"
          onClick={onSave}
          disabled={state === 'saving'}
          style={state === 'saving' ? adminButtonPrimaryDisabled : adminButtonPrimary}
        >
          {state === 'saving' ? 'Saving…' : 'Save header settings'}
        </button>
      </div>
    </div>
  );
}

function SortableNavRow({
  item,
  onChange,
  onRemove,
}: {
  item: { id: string; label: string; href: string };
  onChange: (patch: Partial<NavItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    background: '#FFFFFF',
    border: `1px solid ${ADMIN_COLORS.border}`,
    borderRadius: 8,
  };

  const fieldStyle: CSSProperties = { ...adminInput, padding: '7px 10px', fontSize: 12 };

  return (
    <li ref={setNodeRef} style={style}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{
          width: 28,
          height: 32,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 'none',
          color: ADMIN_COLORS.textMicro,
          cursor: 'grab',
        }}
      >
        <GripVertical size={15} />
      </button>
      <input
        type="text"
        value={item.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Label"
        style={{ ...fieldStyle, width: 160, flex: '0 0 160px' }}
      />
      <input
        type="text"
        value={item.href}
        onChange={(e) => onChange({ href: e.target.value })}
        placeholder="/path or https://…"
        style={{ ...fieldStyle, flex: 1 }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove nav item"
        style={adminButtonIcon}
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}
