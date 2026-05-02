'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
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
import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonPrimary,
  adminButtonPrimaryDisabled,
} from '@/lib/admin/styles';
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
      router.refresh();
    } catch (e) {
      setSaveState('error');
      setErrMsg((e as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 24px',
          background: '#FFFFFF',
          borderBottom: `1px solid ${ADMIN_COLORS.border}`,
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: ADMIN_COLORS.textMuted,
            }}
          >
            Page builder ·{' '}
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                textTransform: 'none',
              }}
            >
              {pageSlug}
            </span>{' '}
            · {pageStatus}
          </p>
          <h1
            style={{
              margin: '2px 0 0',
              fontSize: 16,
              fontWeight: 700,
              color: ADMIN_COLORS.textHeading,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pageTitle}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {dirty && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 999,
                background: ADMIN_COLORS.warningBg,
                color: ADMIN_COLORS.warning,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Unsaved changes
            </span>
          )}
          <SaveStatus state={saveState} message={errMsg} />
          <Link
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            style={{
              ...adminButtonGhost,
              textDecoration: 'none',
            }}
          >
            Open preview
            <ArrowUpRight size={13} />
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saveState === 'saving'}
            style={
              !dirty || saveState === 'saving'
                ? adminButtonPrimaryDisabled
                : adminButtonPrimary
            }
          >
            {saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px minmax(0, 1fr) minmax(380px, 1fr)',
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRight: `1px solid ${ADMIN_COLORS.border}`,
            padding: 14,
            maxHeight: 'calc(100vh - 64px)',
            overflowY: 'auto',
          }}
        >
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: ADMIN_COLORS.textMuted,
            }}
          >
            Sections ({ordered.length})
          </p>
          {ordered.length === 0 ? (
            <p style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>
              No sections yet. Add one below.
            </p>
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
                  {ordered.map((s) => (
                    <SortableSectionItem
                      key={s.id}
                      section={s}
                      active={s.id === selectedId}
                      onSelect={() => setSelectedId(s.id)}
                      onToggleVisible={() => updateSection(s.id, { visible: !s.visible })}
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
            style={{
              marginTop: 12,
              width: '100%',
              padding: '8px 12px',
              border: `1px dashed ${ADMIN_COLORS.borderInput}`,
              borderRadius: 8,
              background: '#FFFFFF',
              color: ADMIN_COLORS.primaryDeep,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              fontFamily: 'inherit',
            }}
          >
            <Plus size={13} />
            Add section
          </button>
        </div>

        <div
          style={{
            background: ADMIN_COLORS.pageBg,
            borderRight: `1px solid ${ADMIN_COLORS.border}`,
            padding: 20,
            maxHeight: 'calc(100vh - 64px)',
            overflowY: 'auto',
          }}
        >
          {selected ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: ADMIN_COLORS.textMuted,
                  }}
                >
                  Editing
                </p>
                <p
                  style={{
                    margin: '2px 0 0',
                    fontSize: 13,
                    fontWeight: 700,
                    color: ADMIN_COLORS.textHeading,
                  }}
                >
                  {getSectionMeta(selected.section_type)?.label ?? selected.section_type}
                </p>
              </div>
              <div
                style={{
                  background: '#FFFFFF',
                  border: `1px solid ${ADMIN_COLORS.border}`,
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <SectionEditorPanel
                  sectionType={selected.section_type}
                  content={selected.content}
                  onChange={(next) => updateSection(selected.id, { content: next })}
                />
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: ADMIN_COLORS.textMuted }}>
              Select a section to edit.
            </p>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#F3F4F6',
            maxHeight: 'calc(100vh - 64px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: '#FFFFFF',
              borderBottom: `1px solid ${ADMIN_COLORS.border}`,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: ADMIN_COLORS.textMuted,
              }}
            >
              Preview
            </p>
            <button
              type="button"
              onClick={() => setPreviewKey((k) => k + 1)}
              style={{
                ...adminButtonGhost,
                padding: '4px 10px',
                fontSize: 11,
              }}
              aria-label="Refresh preview"
              title="Refresh preview"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          <iframe
            key={previewKey}
            src={previewHref}
            title={`Preview of ${pageSlug}`}
            style={{
              flex: 1,
              minHeight: '60vh',
              width: '100%',
              background: '#FFFFFF',
              border: 'none',
            }}
          />
          {dirty && (
            <p
              style={{
                margin: 0,
                padding: '8px 12px',
                background: ADMIN_COLORS.warningBg,
                color: ADMIN_COLORS.warning,
                fontSize: 11,
                borderTop: `1px solid ${ADMIN_COLORS.border}`,
              }}
            >
              Preview reflects the last <strong>saved</strong> state. Unsaved edits will appear after Save.
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

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px',
    background: '#FFFFFF',
    border: `1px solid ${active ? ADMIN_COLORS.primary : ADMIN_COLORS.border}`,
    borderRadius: 8,
    boxShadow: active ? `0 0 0 2px rgba(27,58,95,0.18)` : 'none',
  };

  const iconBtn: CSSProperties = {
    width: 26,
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: ADMIN_COLORS.textMicro,
    cursor: 'pointer',
    borderRadius: 4,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        style={{ ...iconBtn, cursor: 'grab' }}
      >
        <GripVertical size={13} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        style={{
          minWidth: 0,
          flex: 1,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: active ? ADMIN_COLORS.primary : ADMIN_COLORS.textHeading,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta?.label ?? section.section_type}
        </p>
        <p
          style={{
            margin: '1px 0 0',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 10,
            color: ADMIN_COLORS.textMuted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {section.section_type}
        </p>
      </button>
      <button
        type="button"
        onClick={onToggleVisible}
        title={section.visible ? 'Visible' : 'Hidden'}
        aria-label={section.visible ? 'Hide section' : 'Show section'}
        style={iconBtn}
      >
        {section.visible ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      <button
        type="button"
        onClick={onRequestDelete}
        title="Delete section"
        aria-label="Delete section"
        style={iconBtn}
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}
