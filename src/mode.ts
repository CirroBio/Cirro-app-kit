// Whether the page is hosted, decided from its URL alone. Kept apart from connect.ts so that
// dist/cirro-app-mode.js can carry it without the API client: a no-build app checks this
// first and loads the full kit only when it is hosted.
import { HostedMode, hostedModeFromSearch } from './protocol';

/** How the page is hosted, from its URL: `portal` only inside a frame. Null when standalone. */
export function hostedMode(): HostedMode | null {
  const mode = hostedModeFromSearch(window.location.search);
  return mode === 'portal' && window.parent === window ? null : mode;
}
