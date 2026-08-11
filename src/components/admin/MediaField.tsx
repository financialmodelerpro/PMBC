'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Film,
  ImagePlus,
  Link2,
  Loader2,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminInput,
  adminLabel,
} from '@/lib/admin/styles';
import {
  IMAGE_ONLY_ACCEPT,
  MEDIA_ACCEPT,
  MEDIA_LIMIT_HINT,
  detectMediaType,
  mediaValuePatch,
  readMediaValue,
  type MediaType,
  type MediaValue,
} from '@/lib/media';
import { uploadMedia } from '@/lib/admin/uploadMedia';

import { MediaModal, type MediaBucket } from './MediaPicker';

/**
 * A media slot in a section editor: preview, drag and drop, upload, library
 * picker, and a collapsed URL box for external assets.
 *
 * Replaces the bare text inputs the section editors used to carry. Those
 * required the operator to upload through /admin/media in another tab, copy the
 * public URL, come back and paste it, which is four steps to set one image.
 *
 * The field owns the whole media slot, not just the URL: type, poster and the
 * three playback toggles travel together, because a video URL without its
 * playback settings is not a complete value. `onChange` receives the patch to
 * merge into section content.
 */
export function MediaField({
  content,
  urlKey,
  onChange,
  label = 'Media',
  hint,
  bucket = 'cms-assets',
  /** Slots that genuinely cannot show motion, such as a CSS background image. */
  imagesOnly = false,
}: {
  content: Record<string, unknown>;
  urlKey: string;
  onChange: (patch: Record<string, unknown>) => void;
  label?: string;
  hint?: string;
  bucket?: MediaBucket;
  imagesOnly?: boolean;
}) {
  const value = readMediaValue(content, urlKey);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [showUrlBox, setShowUrlBox] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** 0 to 1 while a file is in flight, null otherwise. */
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const posterRef = useRef<HTMLInputElement | null>(null);

  const commit = useCallback(
    (next: Partial<MediaValue>) => {
      const merged = { ...value, ...next };
      // An images-only slot writes the URL and nothing else. Those slots are
      // backed by allowlisted stores (the StyleEditor's `styles` blob drops
      // anything it does not recognise), so the companion keys would be dead
      // weight in the database that never reaches a renderer.
      onChange(
        imagesOnly ? { [urlKey]: merged.url } : mediaValuePatch(urlKey, merged),
      );
    },
    [imagesOnly, onChange, urlKey, value],
  );

  /** Sets the URL and re-sniffs the type, so dropping an mp4 onto an image slot works. */
  const setUrl = useCallback(
    (url: string) => {
      commit({ url, mediaType: url ? detectMediaType(url) : 'image' });
    },
    [commit],
  );

  const upload = useCallback(
    async (files: FileList | File[] | null, target: 'media' | 'poster') => {
      const list = files ? Array.from(files) : [];
      if (list.length === 0) return;
      const file = list[0];

      setUploading(true);
      setProgress(0);
      setError(null);
      try {
        // Straight to storage through a signed URL. Every failure mode,
        // including one that never reaches the app and answers with plain
        // text, comes back from here as a readable Error.
        const { url } = await uploadMedia(file, bucket, setProgress);
        if (!url) throw new Error('Upload succeeded but returned no URL');

        if (target === 'poster') commit({ posterUrl: url });
        else setUrl(url);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
        setProgress(null);
      }
    },
    [bucket, commit, setUrl],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (uploading) return;
      const dropped = e.dataTransfer?.files;
      if (dropped && dropped.length > 0) {
        void upload(dropped, 'media');
        return;
      }
      // Dragging an image out of another browser tab hands over a URL, not a
      // file. Accepting it costs nothing and is what an operator expects.
      const text = e.dataTransfer?.getData('text/uri-list') || e.dataTransfer?.getData('text/plain');
      if (text && /^https?:\/\//i.test(text.trim())) setUrl(text.trim());
    },
    [setUrl, upload, uploading],
  );

  const isVideo = value.mediaType === 'video';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={adminLabel}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: ADMIN_COLORS.textMicro }}>{hint}</span>}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          marginTop: 6,
          display: 'flex',
          gap: 12,
          alignItems: 'flex-start',
          padding: 12,
          borderRadius: 10,
          border: `1px ${dragging ? 'solid' : 'dashed'} ${
            dragging ? ADMIN_COLORS.primary : ADMIN_COLORS.borderInput
          }`,
          background: dragging ? 'rgba(27,58,95,0.04)' : '#FCFDFE',
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        <Preview value={value} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              style={adminButtonGhost}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
              {uploading
                ? progress !== null && progress < 1
                  ? `Uploading ${Math.round(progress * 100)}%`
                  : 'Uploading…'
                : 'Upload'}
            </button>
            <button type="button" style={adminButtonGhost} onClick={() => setLibraryOpen(true)}>
              Choose from library
            </button>
            <button
              type="button"
              style={adminButtonGhost}
              onClick={() => setShowUrlBox((v) => !v)}
              aria-expanded={showUrlBox}
            >
              <Link2 size={13} />
              Paste URL
            </button>
            {value.url && (
              <button
                type="button"
                style={{ ...adminButtonGhost, color: ADMIN_COLORS.danger }}
                onClick={() =>
                  commit({
                    url: '',
                    mediaType: 'image',
                    posterUrl: '',
                    autoplay: true,
                    loop: true,
                    controls: false,
                  })
                }
              >
                <Trash2 size={13} />
                Clear
              </button>
            )}
          </div>

          <p style={{ margin: '8px 0 0', fontSize: 11.5, color: ADMIN_COLORS.textMicro }}>
            {dragging
              ? 'Drop to upload'
              : imagesOnly
                ? `Drag and drop an image here, or use the buttons above. ${MEDIA_LIMIT_HINT}.`
                : `Drag and drop an image, GIF or video here, or use the buttons above. ${MEDIA_LIMIT_HINT}.`}
          </p>

          {uploading && progress !== null && (
            <div
              aria-hidden
              style={{
                marginTop: 8,
                height: 4,
                borderRadius: 999,
                background: ADMIN_COLORS.borderInput,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(progress * 100)}%`,
                  height: '100%',
                  background: ADMIN_COLORS.primary,
                  transition: 'width 120ms linear',
                }}
              />
            </div>
          )}

          {showUrlBox && (
            <div style={{ marginTop: 10 }}>
              <input
                type="text"
                value={value.url}
                placeholder="https://…"
                onChange={(e) => setUrl(e.target.value)}
                style={adminInput}
              />
              <p style={{ margin: '4px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
                External URLs work, but the host must be allowed in next.config.ts
                images.remotePatterns or the image will not render.
              </p>
            </div>
          )}

          {error && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: ADMIN_COLORS.danger }}>{error}</p>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept={imagesOnly ? IMAGE_ONLY_ACCEPT : MEDIA_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => {
            void upload(e.target.files, 'media');
            e.target.value = '';
          }}
        />
      </div>

      {/* Type override. The extension settles it for mp4 and gif, but an
          animated WebP is indistinguishable from a still one by URL, so the
          operator needs a way to say so. */}
      {value.url && !imagesOnly && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: ADMIN_COLORS.textMicro }}>Treat as</span>
          {(['image', 'gif', 'video'] as const).map((t) => (
            <TypeChip
              key={t}
              type={t}
              active={value.mediaType === t}
              onClick={() => commit({ mediaType: t })}
            />
          ))}
        </div>
      )}

      {/* Playback controls, only meaningful for video. */}
      {value.url && isVideo && !imagesOnly && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${ADMIN_COLORS.border}`,
            background: '#FFFFFF',
          }}
        >
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ADMIN_COLORS.textBody }}>
            Video playback
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Toggle
              label="Autoplay"
              checked={value.autoplay}
              onChange={(v) => commit({ autoplay: v })}
            />
            <Toggle label="Loop" checked={value.loop} onChange={(v) => commit({ loop: v })} />
            <Toggle
              label="Show controls"
              checked={value.controls}
              onChange={(v) => commit({ controls: v })}
            />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: ADMIN_COLORS.textMicro }}>
            Video is always muted, because browsers refuse to autoplay sound. A
            visitor who has asked for reduced motion sees the poster frame with
            controls instead of autoplay.
          </p>

          <div style={{ marginTop: 12 }}>
            <span style={adminLabel}>Poster frame</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              {value.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={value.posterUrl}
                  alt=""
                  style={{
                    width: 64,
                    height: 44,
                    objectFit: 'cover',
                    borderRadius: 6,
                    border: `1px solid ${ADMIN_COLORS.border}`,
                  }}
                />
              ) : null}
              <button
                type="button"
                style={adminButtonGhost}
                disabled={uploading}
                onClick={() => posterRef.current?.click()}
              >
                <ImagePlus size={13} />
                {value.posterUrl ? 'Replace' : 'Upload poster'}
              </button>
              {value.posterUrl && (
                <button
                  type="button"
                  style={{ ...adminButtonGhost, color: ADMIN_COLORS.danger }}
                  onClick={() => commit({ posterUrl: '' })}
                >
                  Remove
                </button>
              )}
              <input
                ref={posterRef}
                type="file"
                accept={IMAGE_ONLY_ACCEPT}
                style={{ display: 'none' }}
                onChange={(e) => {
                  void upload(e.target.files, 'poster');
                  e.target.value = '';
                }}
              />
            </div>
          </div>
        </div>
      )}

      {libraryOpen && (
        <MediaModal
          bucket={bucket}
          label={label}
          onClose={() => setLibraryOpen(false)}
          onSelect={(url) => {
            setUrl(url);
            setLibraryOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Preview({ value }: { value: MediaValue }) {
  const box: React.CSSProperties = {
    width: 92,
    height: 92,
    flexShrink: 0,
    borderRadius: 8,
    border: `1px solid ${ADMIN_COLORS.border}`,
    background: '#F9FAFB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  };

  if (!value.url) {
    return (
      <div style={box}>
        <ImagePlus size={22} color={ADMIN_COLORS.textMicro} />
      </div>
    );
  }

  if (value.mediaType === 'video') {
    return (
      <div style={box}>
        <video
          src={value.url}
          poster={value.posterUrl || undefined}
          muted
          loop
          playsInline
          autoPlay
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <span
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 5px',
            borderRadius: 4,
            background: 'rgba(15,37,64,0.75)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          <Film size={9} />
          VIDEO
        </span>
      </div>
    );
  }

  return (
    <div style={box}>
      {/* Plain <img>, not next/image: this is an admin thumbnail of an
          arbitrary URL, including hosts not in remotePatterns, and the
          optimizer would reject those outright. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={value.url}
        alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      {value.mediaType === 'gif' && (
        <span
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            padding: '2px 5px',
            borderRadius: 4,
            background: 'rgba(15,37,64,0.75)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
          }}
        >
          GIF
        </span>
      )}
    </div>
  );
}

function TypeChip({
  type,
  active,
  onClick,
}: {
  type: MediaType;
  active: boolean;
  onClick: () => void;
}) {
  const copy: Record<MediaType, string> = {
    image: 'Image',
    gif: 'Animated',
    video: 'Video',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        border: `1px solid ${active ? ADMIN_COLORS.primary : ADMIN_COLORS.borderInput}`,
        background: active ? ADMIN_COLORS.primary : '#FFFFFF',
        color: active ? '#FFFFFF' : ADMIN_COLORS.primaryDeep,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {copy[type]}
    </button>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: ADMIN_COLORS.textBody, cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 15, height: 15, accentColor: ADMIN_COLORS.primary, cursor: 'pointer' }}
      />
      {label}
    </label>
  );
}
