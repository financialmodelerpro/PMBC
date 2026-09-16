/**
 * The component each tool renders, keyed by its registry slug.
 *
 * Kept beside the registry rather than inside it so `src/config/tools.ts` stays
 * plain data that the sitemap and metadata can import without pulling a client
 * bundle into a server-only path. A `ready` registry entry with no component
 * here would 404 even when switched Live, so `npm run verify-tools-visibility`
 * asserts every ready entry has one.
 */

import type { ComponentType } from 'react';

import type { PartnerCard } from '@/lib/tools/brand/partner';

import { BusinessValuationTool } from './valuation/BusinessValuationTool';

/** Per-request values every tool can rely on. */
export type ToolComponentProps = {
  /** `site_settings.booking_url`. Empty is a supported state. */
  bookingUrl: string;
  /** True when staff are viewing a Hidden tool. Submissions are saved as test leads. */
  preview: boolean;
  /** The partner the visitor would work with, from the founder profile. Null hides the card. */
  partner: PartnerCard | null;
};

export const TOOL_COMPONENTS: Record<string, ComponentType<ToolComponentProps>> = {
  'business-valuation': BusinessValuationTool,
};
