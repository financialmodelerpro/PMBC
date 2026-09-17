'use client';

import { useEffect } from 'react';

import { attributionCookie, attributionFromSearch, hasTrackingQuery, TRACKING_QUERY_KEYS } from '@/lib/tools/bookingLinks';

/**
 * Keeps the /book address bar clean. When the page is reached with UTM or other
 * tracking parameters, from any source, it stores the attribution in the same
 * first-party cookie the booking links set, then removes those parameters from
 * the address bar with `history.replaceState`, without reloading. The server
 * has already used them to prefill the calendar on this render. Parameters that
 * are not tracking parameters (such as `preview=1`) are left alone.
 */
export function BookingUrlCleaner() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = Object.fromEntries(params.entries());
    if (!hasTrackingQuery(search)) return;
    const attribution = attributionFromSearch(search);
    if (attribution) document.cookie = attributionCookie(attribution, window.location.protocol === 'https:');
    for (const key of TRACKING_QUERY_KEYS) params.delete(key);
    const rest = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  }, []);
  return null;
}
