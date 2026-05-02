'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, type CSSProperties } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Pilcrow,
  Undo2,
  Redo2,
} from 'lucide-react';

import { ADMIN_COLORS } from '@/lib/admin/styles';

type Props = {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  ariaLabel?: string;
};

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 6,
    border: 'none',
    background: active ? ADMIN_COLORS.primary : 'transparent',
    color: active ? '#FFFFFF' : ADMIN_COLORS.primaryDeep,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    transition: 'background 120ms ease',
  };
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      style={style}
      onMouseEnter={(e) => {
        if (!active && !disabled) e.currentTarget.style.background = '#F3F4F6';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, minHeight = 180, ariaLabel }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none',
        'aria-label': ariaLabel ?? 'Rich text editor',
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        style={{
          background: '#F9FAFB',
          border: `1px solid ${ADMIN_COLORS.border}`,
          borderRadius: 8,
          minHeight: minHeight + 48,
        }}
      />
    );
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${ADMIN_COLORS.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
          padding: 6,
          borderBottom: `1px solid ${ADMIN_COLORS.border}`,
          background: ADMIN_COLORS.altBg,
        }}
      >
        <ToolbarButton
          title="Paragraph"
          active={editor.isActive('paragraph')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Heading"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={15} />
        </ToolbarButton>
        <span style={{ width: 1, height: 18, background: ADMIN_COLORS.border, margin: '0 4px' }} />
        <ToolbarButton
          title="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={15} />
        </ToolbarButton>
        <span style={{ width: 1, height: 18, background: ADMIN_COLORS.border, margin: '0 4px' }} />
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={15} />
        </ToolbarButton>
        <span style={{ width: 1, height: 18, background: ADMIN_COLORS.border, margin: '0 4px' }} />
        <ToolbarButton
          title="Undo"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Redo"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={15} />
        </ToolbarButton>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
