// Whether the page is hosted, decided from its URL alone (CONTRACT.md section 2). This
// module imports nothing, so dist/cirro-app-mode.js is just this file: a no-build app
// checks it at boot and loads the full kit only when it is hosted.

/** The query parameter the host puts on the app's URL: `1` when hosted, `mock` for a dev mock session. */
export const HOSTED_APP_PARAM = 'cirro-app';
export type HostedMode = 'portal' | 'mock';

/** Reads `cirro-app` from a location's query string: whether, and how, the page is hosted. */
export function hostedModeFromSearch(search: string): HostedMode | null {
  const value = new URLSearchParams(search).get(HOSTED_APP_PARAM);
  if (value === '1') return 'portal';
  if (value === 'mock') return 'mock';
  return null;
}

/** How the page is hosted, from its URL: `portal` only inside a frame. Null when standalone. */
export function hostedMode(): HostedMode | null {
  const mode = hostedModeFromSearch(window.location.search);
  return mode === 'portal' && window.parent === window ? null : mode;
}
