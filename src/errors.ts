import type { AppPermission } from './permissions';

/** A request the app's permissions do not cover; thrown before the request is sent. */
export class AppPermissionError extends Error {
  constructor(
    readonly method: string,
    readonly path: string,
    /** The permission the request needs, or null when the permission model does not cover it at all. */
    readonly permission: AppPermission | null
  ) {
    super(permission
      ? `This app does not have the "${permission}" permission (${method} ${path}).`
      : `${method} ${path} is not available to apps.`);
    this.name = 'AppPermissionError';
  }
}

/** A Cirro API request that failed; `message` is the API's own. */
export class CirroApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Further messages from the API, e.g. one per invalid field. */
    readonly errors: string[]
  ) {
    super(message);
    this.name = 'CirroApiError';
  }
}

/** The portal host did not answer (no `init`, or no `token` in time), or had no token to give (`token-error`). */
export class HostConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HostConnectionError';
  }
}

/** The sheet store's data methods, until Cirro has tenant-level private sheets (CONTRACT.md section 5). */
export class SheetStoreUnavailableError extends Error {
  constructor() {
    super('Saving app data to Cirro sheets needs tenant-level sheets private to each user, which Cirro does not offer yet.');
    this.name = 'SheetStoreUnavailableError';
  }
}

/**
 * Whether reading a dataset failed in a way that will fail again: the API refused it, or its
 * files are not what the app can read. A dropped connection, a lost session, a throttled or
 * failing server and an abort are passing, so the dataset is tried again (CONTRACT.md section 7).
 */
export function isLastingFailure(error: unknown): boolean {
  if (error instanceof HostConnectionError) return false;
  if (error instanceof CirroApiError) return error.status !== 401 && error.status !== 429 && error.status < 500;
  // fetch rejects with a TypeError when the network fails, and the API client wraps that in a
  // FetchError. An abort is a DOMException, which is not an Error everywhere.
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : null;
  return !['AbortError', 'TypeError', 'FetchError'].includes(String(name));
}
