'use client';

import { useState } from 'react';
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
    <div className="space-y-6">
      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0F1B2D]">Navigation items</h2>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#0F2540] hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add item
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
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
          <p className="text-sm text-neutral-500">No nav items. Add one to get started.</p>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-[#0F1B2D]">Call to action</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#0F2540]">CTA label</span>
            <input
              type="text"
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#0F2540]">CTA link</span>
            <input
              type="text"
              value={ctaHref}
              onChange={(e) => setCtaHref(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <label className="mt-4 inline-flex items-center gap-2 text-sm text-[#0F1B2D]">
          <input
            type="checkbox"
            checked={showCta}
            onChange={(e) => setShowCta(e.target.checked)}
            className="h-4 w-4"
          />
          Show CTA in header
        </label>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
        <h2 className="mb-4 text-sm font-semibold text-[#0F1B2D]">Mobile</h2>
        <label className="inline-flex items-center gap-2 text-sm text-[#0F1B2D]">
          <input
            type="checkbox"
            checked={mobileMenu}
            onChange={(e) => setMobileMenu(e.target.checked)}
            className="h-4 w-4"
          />
          Enable hamburger menu on mobile
        </label>
      </section>

      <div className="flex items-center justify-between border-t border-neutral-200 pt-5">
        <SaveStatus state={state} message={errMsg} />
        <button
          type="button"
          onClick={onSave}
          disabled={state === 'saving'}
          className="rounded-md bg-[#1B3A5F] px-4 py-2 text-sm font-medium text-white hover:bg-[#0F2540] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === 'saving' ? 'Saving…' : 'Save header settings'}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  'block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[14px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15';

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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="inline-flex h-9 w-7 cursor-grab items-center justify-center text-neutral-400 hover:text-[#0F2540] active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        type="text"
        value={item.label}
        onChange={(e) => onChange({ label: e.target.value })}
        placeholder="Label"
        className="block w-40 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15"
      />
      <input
        type="text"
        value={item.href}
        onChange={(e) => onChange({ href: e.target.value })}
        placeholder="/path or https://…"
        className="block flex-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px] text-[#0F1B2D] outline-none focus:border-[#1B3A5F] focus:ring-2 focus:ring-[#1B3A5F]/15"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove nav item"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
