'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, UploadCloud, X } from 'lucide-react';

import {
  ADMIN_COLORS,
  adminButtonGhost,
  adminButtonPrimary,
  adminInput,
} from '@/lib/admin/styles';

export type MediaBucket =
  | 'cms-assets'
  | 'article-covers'
  | 'case-study-images'
  | 'team-photos';

type MediaFile = {
  name: string;
  size: number | null;
  mimetype: string | null;
  created_at: string | null;
  url: string;
};

/**
 * Image field + "choose from library / upload" picker. Returns the public URL
 * of the selected media into `onChange`. Used across every collection editor.
 */
export function MediaPickerButton({
  value,
  onChange,
  bucket = 'cms-assets',
  label = 'Image',
}: {
  value: string;
  onChange: (url: string) => void;
  bucket?: MediaBucket;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 84,
            height: 84,
            flexShrink: 0,
            borderRadius: 8,
            border: `1px solid ${ADMIN_COLORS.border}`,
            background: '#F9FAFB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <ImagePlus size={22} color={ADMIN_COLORS.textMicro} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={value}
            placeholder="Paste a URL or choose from the library"
            onChange={(e) => onChange(e.target.value)}
            style={adminInput}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" style={adminButtonGhost} onClick={() => setOpen(true)}>
              Choose / Upload
            </button>
            {value && (
              <button
                type="button"
                style={{ ...adminButtonGhost, color: ADMIN_COLORS.danger }}
                onClick={() => onChange('')}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {open && (
        <MediaModal
          bucket={bucket}
          label={label}
          onClose={() => setOpen(false)}
          onSelect={(url) => {
            onChange(url);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function MediaModal({
  bucket: initialBucket,
  label,
  onClose,
  onSelect,
}: {
  bucket: MediaBucket;
  label?: string;
  onClose: () => void;
  onSelect: (url: string) => void;
}) {
  const [bucket, setBucket] = useState<MediaBucket>(initialBucket);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [buckets, setBuckets] = useState<MediaBucket[]>([initialBucket]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async (b: MediaBucket) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/media?bucket=${b}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load media');
      setFiles(json.files ?? []);
      if (json.buckets) setBuckets(json.buckets);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(bucket);
  }, [bucket, load]);

  const upload = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append('bucket', bucket);
        Array.from(list).forEach((f) => form.append('file', f));
        const res = await fetch('/api/admin/media', { method: 'POST', body: form });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        await load(bucket);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [bucket, load],
  );

  const remove = useCallback(
    async (name: string) => {
      if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
      try {
        const res = await fetch('/api/admin/media', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket, name }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Delete failed');
        await load(bucket);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      }
    },
    [bucket, load],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(15,37,64,0.5)' }}
      />
      <div
        style={{
          position: 'relative',
          width: 'min(860px, 100%)',
          maxHeight: '86vh',
          background: '#fff',
          borderRadius: 14,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: `1px solid ${ADMIN_COLORS.border}`,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: ADMIN_COLORS.textHeading }}>
              Media Library
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: ADMIN_COLORS.textMuted }}>
              {label ? `Pick an image for ${label}` : 'Choose or upload an image'}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={iconBtn}>
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: '12px 20px',
            borderBottom: `1px solid ${ADMIN_COLORS.borderSoft}`,
            flexWrap: 'wrap',
          }}
        >
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value as MediaBucket)}
            style={{ ...adminInput, width: 'auto', minWidth: 180 }}
          >
            {buckets.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={adminButtonPrimary}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => upload(e.target.files)}
          />
          {error && (
            <span style={{ fontSize: 12, color: ADMIN_COLORS.danger }}>{error}</span>
          )}
        </div>

        <div style={{ padding: 16, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted }}>
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.textMuted, fontSize: 13 }}>
              No files in this bucket yet. Upload one to get started.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              }}
            >
              {files.map((f) => (
                <div
                  key={f.name}
                  style={{
                    border: `1px solid ${ADMIN_COLORS.border}`,
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: '#fff',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(f.url)}
                    style={{
                      display: 'block',
                      width: '100%',
                      height: 100,
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      background: '#F9FAFB',
                    }}
                  >
                    {f.mimetype === 'application/pdf' ? (
                      <span style={{ fontSize: 12, color: ADMIN_COLORS.textMuted }}>PDF</span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.url}
                        alt={f.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </button>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 4,
                      padding: '6px 8px',
                    }}
                  >
                    <span
                      title={f.name}
                      style={{
                        fontSize: 11,
                        color: ADMIN_COLORS.textMuted,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {f.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${f.name}`}
                      onClick={() => remove(f.name)}
                      style={{ ...iconBtn, width: 24, height: 24, color: ADMIN_COLORS.danger }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 6,
  border: `1px solid ${ADMIN_COLORS.border}`,
  background: '#fff',
  color: ADMIN_COLORS.textMuted,
  cursor: 'pointer',
};
