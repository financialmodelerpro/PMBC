'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState, type CSSProperties } from 'react';
import { Bold, Italic, Link2, Link2Off } from 'lucide-react';

import { ADMIN_COLORS, ADMIN_LAYOUT } from '@/lib/admin/styles';

/**
 * Compact rich text input for SHORT fields: subtitles, quotes, card blurbs,
 * step descriptions, deliverable items.
 *
 * Deliberately minimal. Bold, italic and link only. No headings, images,
 * colour, alignment or lists, because those belong in long-form body copy and
 * would let a one-line card blurb carry an H1. Reach for RichTextEditor when a
 * field genuinely needs them.
 *
 * Styled to match a normal admin text input (same border, radius, font size and
 * amber tint) so a form does not visibly change shape when a plain textarea is
 * swapped for one of these.
 *
 * Backwards compatible with plain text. A field that currently holds
 * "Advisory from structure to exit" is loaded by Tiptap as a paragraph and
 * round-trips as "<p>Advisory from structure to exit</p>". Public renderers for
 * these fields already output through dangerouslySetInnerHTML or accept a
 * string, so an upgraded value renders correctly either way.
 */
export function RichTextarea({
  value,
  onChange,
  placeholder,
  minHeight = 44,
  ariaLabel,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  ariaLabel?: string;
}) {
  const [focused, setFocused] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Block-level structure is not wanted in a short field.
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          autolink: true,
          protocols: ['http', 'https', 'mailto'],
          HTMLAttributes: { rel: 'noopener noreferrer' },
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'pmbc-richtextarea focus:outline-none',
        'aria-label': ariaLabel ?? 'Rich text field',
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      // An empty editor serialises to "<p></p>". Report that as a true empty
      // string so "is this field set" checks downstream keep working.
      const html = ed.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    const current = editor.getHTML();
    // Compare against the normalised empty form too, otherwise clearing the
    // field would fight with this effect on every keystroke.
    if (current !== incoming && !(incoming === '' && current === '<p></p>')) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  const shell: CSSProperties = {
    border: `1px solid ${focused ? ADMIN_COLORS.primary : ADMIN_COLORS.borderInput}`,
    borderRadius: ADMIN_LAYOUT.inputRadius,
    background: ADMIN_COLORS.inputBg,
    boxShadow: focused ? `0 0 0 2px rgba(27,58,95,0.12)` : 'none',
    overflow: 'hidden',
  };

  if (!editor) {
    return <div style={{ ...shell, minHeight: minHeight + 30 }} />;
  }

  const setLink = () => {
    const existing = (editor.getAttributes('link').href as string | undefined) ?? '';
    const input = window.prompt('Link URL', existing || 'https://');
    if (input === null) return;
    const url = input.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) {
      window.alert('Use a link starting with http://, https://, mailto: or /');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const btn = (active: boolean, disabled?: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: 4,
    border: 'none',
    background: active ? ADMIN_COLORS.primary : 'transparent',
    color: active ? '#FFFFFF' : ADMIN_COLORS.textMuted,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  });

  return (
    <div style={shell}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '3px 5px',
          borderBottom: `1px solid ${ADMIN_COLORS.border}`,
          background: '#FFFFFF',
        }}
      >
        <button
          type="button"
          title="Bold"
          aria-label="Bold"
          aria-pressed={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          style={btn(editor.isActive('bold'))}
        >
          <Bold size={13} />
        </button>
        <button
          type="button"
          title="Italic"
          aria-label="Italic"
          aria-pressed={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          style={btn(editor.isActive('italic'))}
        >
          <Italic size={13} />
        </button>
        <button
          type="button"
          title={editor.isActive('link') ? 'Edit link' : 'Add link'}
          aria-label="Add link"
          aria-pressed={editor.isActive('link')}
          onClick={setLink}
          style={btn(editor.isActive('link'))}
        >
          <Link2 size={13} />
        </button>
        <button
          type="button"
          title="Remove link"
          aria-label="Remove link"
          disabled={!editor.isActive('link')}
          onClick={() => editor.chain().focus().unsetLink().run()}
          style={btn(false, !editor.isActive('link'))}
        >
          <Link2Off size={13} />
        </button>
        {placeholder && (
          <span
            style={{
              marginLeft: 'auto',
              paddingRight: 4,
              fontSize: 10,
              color: ADMIN_COLORS.textMicro,
            }}
          >
            {placeholder}
          </span>
        )}
      </div>
      <div
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ padding: '7px 11px', fontSize: 13, color: ADMIN_COLORS.textHeading }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
