/**
 * The component each live tool renders, keyed by its registry slug.
 *
 * Kept beside the registry rather than inside it so `src/config/tools.ts` stays
 * plain data that the sitemap and metadata can import without pulling a client
 * bundle into a server-only path. A registry entry marked `live` with no
 * component here would be listed on the hub while its page returned 404, so
 * `npm run verify-valuation-engine` asserts every live entry has one.
 */

import type { ComponentType } from 'react';

import { BusinessValuationTool } from './valuation/BusinessValuationTool';

/** Per-request values every tool can rely on. */
export type ToolComponentProps = {
  /** `site_settings.booking_url`. Empty is a supported state. */
  bookingUrl: string;
};

export const TOOL_COMPONENTS: Record<string, ComponentType<ToolComponentProps>> = {
  'business-valuation': BusinessValuationTool,
};
