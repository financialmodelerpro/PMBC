'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { useEffect, useState, type CSSProperties } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Pilcrow,
  Redo2,
  Undo2,
} from 'lucide-react';

import { ADMIN_COLORS } from '@/lib/admin/styles';
import { MediaModal } from '@/components/admin/MediaPicker';

type Props = {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  ariaLabel?: string;
};

/** Sizes offered in the font-size dropdown. Blank means "inherit". */
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

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

function Divider() {
  return (
    <span
      style={{ width: 1, height: 18, background: ADMIN_COLORS.border, margin: '0 4px' }}
    />
  );
}

/**
 * Full rich text editor for long-form HTML: article bodies, founder bio,
 * service write-ups, paragraph sections.
 *
 * Parity Phase 6 added colour, font size, link, image, alignment and H1/H3 to
 * match FMP's editor. Link and underline come from StarterKit in Tiptap 3, so
 * they are configured there rather than added as separate extensions, which
 * would register a duplicate and throw.
 *
 * For short single-line fields use RichTextarea instead. This one is
 * deliberately heavy.
 */
export function RichTextEditor({ value, onChange, minHeight = 180, ariaLabel }: Props) {
  const [mediaOpen, setMediaOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: true,
          // Operator-supplied hrefs. Restricting the scheme set here stops a
          // "javascript:" link ever reaching the stored HTML.
          protocols: ['http', 'https', 'mailto'],
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ImageExt.configure({ inline: false, allowBase64: false }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'pmbc-prose max-w-none focus:outline-none',
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

  const currentColor =
    (editor.getAttributes('textStyle').color as string | undefined) ?? '#0F1B2D';
  const currentSize =
    (editor.getAttributes('textStyle').fontSize as string | undefined) ?? '';

  const setLink = () => {
    const existing = (editor.getAttributes('link').href as string | undefined) ?? '';
    const input = window.prompt('Link URL', existing || 'https://');
    if (input === null) return;
    const url = input.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    // Belt and braces alongside the protocol allowlist above.
    if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) {
      window.alert('Use a link starting with http://, https://, mailto: or /');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

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
          title="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={15} />
        </ToolbarButton>

        <Divider />

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

        <Divider />

        <ToolbarButton
          title="Align left"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Align center"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Align right"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight size={15} />
        </ToolbarButton>
        {/* Justified copy is hyphenated by the .pmbc-prose rule that matches an
            inline text-align: justify, so a paragraph justified from here gets
            the same treatment as a whole block set to justified in the section
            editor. Without hyphenation, justification opens rivers of
            whitespace at the 780px measure. */}
        <ToolbarButton
          title="Justify"
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          <AlignJustify size={15} />
        </ToolbarButton>

        <Divider />

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

        <Divider />

        <ToolbarButton
          title={editor.isActive('link') ? 'Edit link' : 'Add link'}
          active={editor.isActive('link')}
          onClick={setLink}
        >
          <Link2 size={15} />
        </ToolbarButton>
        <ToolbarButton
          title="Remove link"
          disabled={!editor.isActive('link')}
          onClick={() => editor.chain().focus().unsetLink().run()}
        >
          <Link2Off size={15} />
        </ToolbarButton>
        <ToolbarButton title="Insert image" onClick={() => setMediaOpen(true)}>
          <ImagePlus size={15} />
        </ToolbarButton>

        <Divider />

        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(currentColor) ? currentColor : '#0F1B2D'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          title="Text colour"
          aria-label="Text colour"
          style={{
            width: 28,
            height: 26,
            padding: 1,
            border: `1px solid ${ADMIN_COLORS.borderInput}`,
            borderRadius: 5,
            background: '#FFFFFF',
            cursor: 'pointer',
          }}
        />
        <button
          type="button"
          title="Clear text colour"
          aria-label="Clear text colour"
          onClick={() => editor.chain().focus().unsetColor().run()}
          style={{
            height: 26,
            padding: '0 8px',
            border: `1px solid ${ADMIN_COLORS.borderInput}`,
            borderRadius: 5,
            background: '#FFFFFF',
            color: ADMIN_COLORS.textMuted,
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Reset
        </button>

        <select
          value={currentSize}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) editor.chain().focus().unsetFontSize().run();
            else editor.chain().focus().setFontSize(v).run();
          }}
          title="Font size"
          aria-label="Font size"
          style={{
            height: 26,
            border: `1px solid ${ADMIN_COLORS.borderInput}`,
            borderRadius: 5,
            background: '#FFFFFF',
            color: ADMIN_COLORS.textBody,
            fontSize: 11,
            padding: '0 4px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <option value="">Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>
              {s.replace('px', '')}
            </option>
          ))}
        </select>

        <Divider />

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

      {mediaOpen && (
        <MediaModal
          bucket="cms-assets"
          onClose={() => setMediaOpen(false)}
          onSelect={(url) => {
            editor.chain().focus().setImage({ src: url }).run();
            setMediaOpen(false);
          }}
        />
      )}
    </div>
  );
}
