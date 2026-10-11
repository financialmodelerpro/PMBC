'use client';

import { MediaField } from '@/components/admin/MediaField';
import { adminFieldHint, adminInput, adminLabel } from '@/lib/admin/styles';
import {
  HERO_FOCAL_OPTIONS,
  HERO_OVERLAY_MAX,
  HERO_OVERLAY_MIN,
  heroFocal,
  heroOverlayPercent,
} from '@/components/public/HeroBackground';

/**
 * The hero background image controls, shared by the `hero` and `founder_hero`
 * editors: the image (Media Library, images only), the navy overlay opacity
 * and the focal point. `onPatch` merges the changed keys into the section.
 */
export function HeroBackgroundFields({
  content,
  onPatch,
}: {
  content: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const overlay = heroOverlayPercent(content.hero_bg_overlay);
  const focal = heroFocal(content.hero_bg_focal);
  const hasImage = typeof content.hero_bg_image === 'string' && content.hero_bg_image.trim() !== '';

  return (
    <div
      style={{
        display: 'grid',
        gap: 14,
        padding: 14,
        border: '1px solid #E5E7EB',
        borderRadius: 6,
        background: '#FAFAF9',
      }}
    >
      <div>
        <MediaField
          content={content}
          urlKey="hero_bg_image"
          bucket="cms-assets"
          label="Background image"
          imagesOnly
          onChange={onPatch}
        />
        <p style={adminFieldHint}>
          Optional. Leave empty for the plain navy hero. Covers the whole hero, cropped to fit,
          under a navy overlay. Recommended 2880 x 1440 px (2:1), JPEG or WebP, under 500 KB, with
          the subject in the middle third: phones show only the centre of the image.
        </p>
      </div>

      <div>
        <label style={adminLabel}>
          Overlay opacity: {overlay}%
        </label>
        <input
          type="range"
          min={HERO_OVERLAY_MIN}
          max={HERO_OVERLAY_MAX}
          step={1}
          value={overlay}
          disabled={!hasImage}
          onChange={(e) => onPatch({ hero_bg_overlay: Number(e.target.value) })}
          style={{ width: '100%' }}
        />
        <p style={adminFieldHint}>
          The navy layer over the image that keeps the text readable. {HERO_OVERLAY_MIN}% is the
          floor; 60% is the default.
        </p>
      </div>

      <div>
        <label style={adminLabel}>Focal point</label>
        <select
          value={focal}
          disabled={!hasImage}
          onChange={(e) => onPatch({ hero_bg_focal: e.target.value })}
          style={adminInput}
        >
          {HERO_FOCAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p style={adminFieldHint}>
          The part of the image kept in view when the hero crops it, as on a phone.
        </p>
      </div>
    </div>
  );
}
