// An AppSession (types.ts) over an AppSessionInit, in every mode: the access token cache, the
// API clients, file access, the app's tables, and links back into the portal.
import type { FetchAPI } from '@cirrobio/api-client';
import { createApis } from './api';
import { createDatasetFiles, ObjectStore, s3Objects } from './files';
import {
  AppMessage, AppSessionInit, appMessage, ContextMessage, LaunchContext, launchContextToSearch, NavigateMessage, PortalTarget
} from './protocol';
import { createMemoryStore } from './store';
import type { AppSession, SessionMode, StandaloneSessionOptions } from './types';

/** A token counts as expiring this long before it expires (CONTRACT.md section 3). */
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

export interface TokenGrant {
  accessToken: string;
  /** Epoch milliseconds. */
  accessTokenExpiresAt: number;
}

export const isExpiring = (grant: TokenGrant): boolean => Date.now() >= grant.accessTokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS;

export interface SessionOptions {
  mode: SessionMode;
  init: AppSessionInit;
  /** A fresh token, when the cached one is expiring; concurrent callers share one call. */
  refreshToken: () => Promise<TokenGrant>;
  /** Portal mode: sends a message to the host. Without it, links open with `window.open`. */
  post?: (message: AppMessage) => void;
  /** The dev mock's: answers API requests and file reads and writes from fixtures. */
  fetchApi?: FetchAPI;
  objects?: ObjectStore;
  onDispose?: () => void;
}

export interface SessionWithTokens extends AppSession {
  /** Keeps a token the host sent, if it outlives the cached one. */
  acceptToken(grant: TokenGrant): void;
}

export function createSession({ mode, init, refreshToken, post, fetchApi, objects = s3Objects, onDispose }: SessionOptions): SessionWithTokens {
  let token: TokenGrant = { accessToken: init.accessToken, accessTokenExpiresAt: init.accessTokenExpiresAt };
  let refreshing: Promise<string> | null = null;
  let disposed = false;
  const permissions = new Set(init.permissions);

  const acceptToken = (grant: TokenGrant): void => {
    if (grant.accessTokenExpiresAt > token.accessTokenExpiresAt) token = grant;
  };

  const getAccessToken = (): Promise<string> => {
    if (disposed) return Promise.reject(new Error('This Cirro session has been disposed.'));
    if (!isExpiring(token)) return Promise.resolve(token.accessToken);
    refreshing ??= refreshToken()
      .then((grant) => {
        acceptToken(grant);
        return grant.accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  };

  const portalUrl = (target: PortalTarget): string => `${init.portalOrigin}${portalPath(target)}`;
  const api = createApis({ basePath: init.apiBasePath, accessToken: getAccessToken, permissions, fetchApi });
  const files = createDatasetFiles({ api, app: init.app, portalUrl, objects });

  return {
    mode,
    app: init.app,
    user: init.user,
    tenant: init.tenant,
    permissions,
    launch: init.launch,
    api,
    files,
    store: createMemoryStore(init.app.id, init.user.id),
    can: (permission) => permissions.has(permission),
    getAccessToken,
    portalUrl,
    openInPortal(target, { newTab = true } = {}) {
      if (post) {
        post(appMessage<NavigateMessage>({ type: 'navigate', target, newTab }));
      } else if (newTab) {
        window.open(portalUrl(target), '_blank', 'noopener');
      } else {
        window.location.assign(portalUrl(target));
      }
    },
    reportContext(context, title) {
      post?.(appMessage<ContextMessage>({ type: 'context', context: setFields(context), title: title ?? null }));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      files.clear();
      onDispose?.();
    },
    acceptToken,
  };
}

/** The context's set fields: plain-JS apps pass nulls and empty strings, and the host's guard drops a context that has them. */
function setFields(context: LaunchContext): LaunchContext {
  return Object.fromEntries(Object.entries(context).filter(([, value]) => value !== null && value !== undefined && value !== ''));
}

function portalPath(target: PortalTarget): string {
  switch (target.kind) {
    case 'project':
      return `/project/${encodeURIComponent(target.projectId)}/overview`;
    case 'dataset':
      return `/project/${encodeURIComponent(target.projectId)}/dataset/${encodeURIComponent(target.datasetId)}`;
    case 'app': {
      const search = launchContextToSearch(target.launch ?? {}).toString();
      return `/apps/${encodeURIComponent(target.appId)}${search ? `?${search}` : ''}`;
    }
  }
}

/**
 * A session for an app that signed the user in itself, outside the portal (mode
 * `standalone`). `refreshToken` is called when the token is within 60 s of expiring.
 */
export function createAppSession({ init, refreshToken }: StandaloneSessionOptions): AppSession {
  return createSession({ mode: 'standalone', init, refreshToken });
}
