'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import {
  ArrowUpRight,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

import { SaveStatus, type SaveState } from '@/components/admin/SaveStatus';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { getSectionMeta } from '@/lib/cms/sectionTypes';
import { sectionFromRow, type LocalSection } from '@/lib/cms/serializers';
import type { Tables } from '@/types/database';

import { SectionEditorPanel } from './SectionEditorPanel';
import { SectionPickerDialog } from './SectionPickerDialog';

type Props = {
  pageSlug: string;
  pageTitle: string;
  pageStatus: string;
  initialSections: LocalSection[];
};

export function PageBuilder({
  pageSlug,
  pageTitle,
  pageStatus,
  initialSections,
}: Props) {
  const router = useRouter();
  const [sections, setSections] = useState<LocalSection[]>(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSections[0]?.id ?? null,
  );
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errMsg, setErrMsg] = useState<string | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  // Warn before navigating away with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ordered = useMemo(
    () => [...sections].sort((a, b) => a.display_order - b.display_order),
    [sections],
  );
  const selected = ordered.find((s) => s.id === selectedId) ?? null;

  const previewHref =
    pageSlug === 'home' ? '/?preview=1' : `/${pageSlug}?preview=1`;

  const updateSection = useCallback(
    (id: string, patch: Partial<LocalSection>) => {
      setSections((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      setDirty(true);
    },
    [],
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ordered.findIndex((s) => s.id === active.id);
    const newIndex = ordered.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ordered, oldIndex, newIndex).map((s, i) => ({
      ...s,
      display_order: i * 10,
    }));
    setSections(reordered);
    setDirty(true);
  };

  const handleAddSection = async (sectionType: string) => {
    setPickerOpen(false);
    try {
      const res = await fetch('/api/admin/page-sections/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ page_slug: pageSlug, section_type: sectionType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Create failed');
      }
      const { section } = (await res.json()) as { section: Tables<'page_sections'> };
      const local = sectionFromRow(section);
      setSections((arr) => [...arr, local]);
      setSelectedId(local.id);
      // Don't mark dirty — section was created on the server already.
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setSaveState('error');
      setErrMsg('Could not add section: ' + (e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/page-sections/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Delete failed');
      }
      setSections((arr) => arr.filter((s) => s.id !== id));
      setSelectedId((cur) => {
        if (cur !== id) return cur;
        const remaining = ordered.filter((s) => s.id !== id);
        return remaining[0]?.id ?? null;
      });
      setPreviewKey((k) => k + 1);
    } catch (e) {
      setSaveState('error');
      setErrMsg('Could not delete: ' + (e as Error).message);
    }
    setPendingDelete(null);
  };

  const handleSave = async () => {
    setSaveState('saving');
    setErrMsg(undefined);
    try {
      const res = await fetch('/api/admin/page-sections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          page_slug: pageSlug,
          sections: ordered.map((s) => ({
            id: s.id,
            page_slug: s.page_slug,
            section_type: s.section_type,
            content: s.content,
            styles: s.styles,
            display_order: s.display_order,
            visible: s.visible,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Save failed');
      }
      setDirty(false);
      setSaveState('saved');
      setPreviewKey((k) => k + 1);
      setTimeout(() => setSaveState('idle'), 2500);
      // Refresh server data on page navigation.
      router.refresh();
    } catch (e) {
      setSaveState('error');
      setErrMsg((e as Error).message);
    }
  };

  return (
    <div className="-mx-4 lg:-mx-8">
      <div className="sticky top-14 z-30 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium tracking-[0.16em] uppercase text-neutral-500">
            Page builder · <span className="font-mono">{pageSlug}</span> · {pageStatus}
          </p>
          <h1 className="mt-0.5 truncate text-base font-semibold text-[#0F1B2D]">
            {pageTitle}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
              Unsaved changes
            </span>
          )}
          <SaveStatus state={saveState} message={errMsg} />
          <Link
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-[#0F2540] hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
          >
            Open preview
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saveState === 'saving'}
            className="rounded-md bg-[#1B3A5F] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0F2540] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[280px_minmax(0,1fr)_minmax(380px,1fr)]">
        {/* Left pane — section list */}
        <div className="border-r border-neutral-200 bg-white px-4 py-4 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          <p className="mb-3 text-[11px] font-medium tracking-[0.16em] uppercase text-neutral-500">
            Sections ({ordered.length})
          </p>
          {ordered.length === 0 ? (
            <p className="text-xs text-neutral-500">No sections yet. Add one below.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={ordered.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-1.5">
                  {ordered.map((s) => (
                    <SortableSectionItem
                      key={s.id}
                      section={s}
                      active={s.id === selectedId}
                      onSelect={() => setSelectedId(s.id)}
                      onToggleVisible={() =>
                        updateSection(s.id, { visible: !s.visible })
                      }
                      onRequestDelete={() => setPendingDelete(s.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 px-3 py-2 text-xs font-medium text-[#0F2540] hover:border-[#1B3A5F] hover:bg-neutral-50 hover:text-[#1B3A5F]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add section
          </button>
        </div>

        {/* Center pane — editor */}
        <div className="border-r border-neutral-200 bg-[#F7F9FC] px-5 py-5 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {selected ? (
            <>
              <div className="mb-4">
                <p className="text-[10px] font-medium tracking-[0.16em] uppercase text-neutral-500">
                  Editing
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#0F1B2D]">
                  {getSectionMeta(selected.section_type)?.label ?? selected.section_type}
                </p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,27,45,0.04)]">
                <SectionEditorPanel
                  sectionType={selected.section_type}
                  content={selected.content}
                  onChange={(next) => updateSection(selected.id, { content: next })}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Select a section to edit.</p>
          )}
        </div>

        {/* Right pane — preview iframe */}
        <div className="flex flex-col bg-neutral-100 lg:max-h-[calc(100vh-7rem)]">
          <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2">
            <p className="text-[10px] font-medium tracking-[0.16em] uppercase text-neutral-500">
              Preview
            </p>
            <button
              type="button"
              onClick={() => setPreviewKey((k) => k + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] text-[#0F2540] hover:border-[#1B3A5F] hover:text-[#1B3A5F]"
              aria-label="Refresh preview"
              title="Refresh preview"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>
          <iframe
            key={previewKey}
            src={previewHref}
            title={`Preview of ${pageSlug}`}
            className="h-full min-h-[60vh] w-full bg-white"
          />
          {dirty && (
            <p className="border-t border-neutral-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
              Preview reflects the last <strong>saved</strong> state. Unsaved edits will appear
              after Save.
            </p>
          )}
        </div>
      </div>

      <SectionPickerDialog
        open={pickerOpen}
        onPick={handleAddSection}
        onClose={() => setPickerOpen(false)}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this section?"
        body="The section row is removed from the database immediately. This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function SortableSectionItem({
  section,
  active,
  onSelect,
  onToggleVisible,
  onRequestDelete,
}: {
  section: LocalSection;
  active: boolean;
  onSelect: () => void;
  onToggleVisible: () => void;
  onRequestDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });
  const meta = getSectionMeta(section.section_type);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={
        'group flex items-center gap-1 rounded-md border bg-white px-2 py-1.5 ' +
        (active ? 'border-[#1B3A5F] ring-1 ring-[#1B3A5F]/20' : 'border-neutral-200')
      }
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="inline-flex h-7 w-5 cursor-grab items-center justify-center text-neutral-400 hover:text-[#0F2540] active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={
            'truncate text-sm font-medium ' + (active ? 'text-[#1B3A5F]' : 'text-[#0F1B2D]')
          }
        >
          {meta?.label ?? section.section_type}
        </p>
        <p className="truncate font-mono text-[10px] text-neutral-500">
          {section.section_type}
        </p>
      </button>
      <button
        type="button"
        onClick={onToggleVisible}
        title={section.visible ? 'Visible' : 'Hidden'}
        aria-label={section.visible ? 'Hide section' : 'Show section'}
        className={
          'inline-flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:text-[#0F2540] ' +
          (section.visible ? '' : 'text-neutral-300')
        }
      >
        {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={onRequestDelete}
        title="Delete section"
        aria-label="Delete section"
        className="inline-flex h-7 w-7 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
