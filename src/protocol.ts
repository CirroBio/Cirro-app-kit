// The host protocol between the portal page at /apps/<appId> and the app in its iframe.
// CONTRACT.md section 3 is the normative description; both sides import this file.
import { AppPermission, isAppPermission } from './permissions';

export const PROTOCOL_VERSION = 1;
export const APP_SOURCE = 'cirro-app';
export const HOST_SOURCE = 'cirro-app-host';

/** The query parameter the host puts on the app's URL: `1` when hosted, `mock` for a dev mock session. */
export const HOSTED_APP_PARAM = 'cirro-app';
export type HostedMode = 'portal' | 'mock';

/** Launch-context query parameters on the portal's /apps/<appId> URL. */
export const LAUNCH_PARAMS = { projectId: 'projectId', datasetId: 'datasetId', path: 'path' } as const;

export interface AppUser {
  /** The partition key of every app table: the user's Cirro username. */
  id: string;
  email: string | null;
  name: string | null;
}

export interface AppTenant {
  id: string;
  name: string;
}

export interface AppIdentity {
  id: string;
  name: string;
}

/** What the app should show first; every field is optional. */
export interface LaunchContext {
  projectId?: string;
  datasetId?: string;
  /** A file or folder path relative to the dataset root. */
  path?: string;
}

export interface AppSessionInit {
  app: AppIdentity;
  user: AppUser;
  tenant: AppTenant;
  /** Absolute base URL of the Cirro API, e.g. `https://tenant.cirro.bio/api`. */
  apiBasePath: string;
  /** Origin of the portal, for links back into it. */
  portalOrigin: string;
  accessToken: string;
  /** Epoch milliseconds. */
  accessTokenExpiresAt: number;
  permissions: AppPermission[];
  launch: LaunchContext;
}

export type PortalTarget =
  | { kind: 'project'; projectId: string }
  | { kind: 'dataset'; projectId: string; datasetId: string }
  | { kind: 'app'; appId: string; launch?: LaunchContext };

interface AppEnvelope { source: typeof APP_SOURCE; version: typeof PROTOCOL_VERSION }
interface HostEnvelope { source: typeof HOST_SOURCE; version: typeof PROTOCOL_VERSION }

export type HelloMessage = AppEnvelope & { type: 'hello'; appId: string; appVersion: string | null; kitVersion: string };
export type TokenRequestMessage = AppEnvelope & { type: 'token-request'; requestId: string };
export type NavigateMessage = AppEnvelope & { type: 'navigate'; target: PortalTarget; newTab: boolean };
export type ContextMessage = AppEnvelope & { type: 'context'; context: LaunchContext; title: string | null };
export type AppMessage = HelloMessage | TokenRequestMessage | NavigateMessage | ContextMessage;

export type InitMessage = HostEnvelope & { type: 'init'; session: AppSessionInit };
export type TokenMessage = HostEnvelope & { type: 'token'; requestId: string | null; accessToken: string; accessTokenExpiresAt: number };
export type TokenErrorMessage = HostEnvelope & { type: 'token-error'; requestId: string; message: string };
export type HostMessage = InitMessage | TokenMessage | TokenErrorMessage;

type Body<M> = Omit<M, 'source' | 'version'>;

export function appMessage<M extends AppMessage>(body: Body<M>): M {
  return { source: APP_SOURCE, version: PROTOCOL_VERSION, ...body } as M;
}

export function hostMessage<M extends HostMessage>(body: Body<M>): M {
  return { source: HOST_SOURCE, version: PROTOCOL_VERSION, ...body } as M;
}

// ---- Guards: every received message goes through these before it is trusted ----

type Fields = Record<string, unknown>;

const isObject = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;
const isOptionalString = (value: unknown): boolean => value === undefined || isString(value);
const isNullableString = (value: unknown): boolean => value === null || isString(value);
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function isLaunchContext(value: unknown): value is LaunchContext {
  return isObject(value)
    && isOptionalString(value.projectId)
    && isOptionalString(value.datasetId)
    && isOptionalString(value.path);
}

export function isPortalTarget(value: unknown): value is PortalTarget {
  if (!isObject(value)) return false;
  switch (value.kind) {
    case 'project': return isNonEmptyString(value.projectId);
    case 'dataset': return isNonEmptyString(value.projectId) && isNonEmptyString(value.datasetId);
    case 'app': return isNonEmptyString(value.appId) && (value.launch === undefined || isLaunchContext(value.launch));
    default: return false;
  }
}

function isAppSessionInit(value: unknown): value is AppSessionInit {
  if (!isObject(value)) return false;
  const { app, user, tenant, permissions } = value;
  return isObject(app) && isNonEmptyString(app.id) && isNonEmptyString(app.name)
    && isObject(user) && isNonEmptyString(user.id) && isNullableString(user.email) && isNullableString(user.name)
    && isObject(tenant) && isString(tenant.id) && isString(tenant.name)
    && isNonEmptyString(value.apiBasePath)
    && isNonEmptyString(value.portalOrigin)
    && isNonEmptyString(value.accessToken)
    && isFiniteNumber(value.accessTokenExpiresAt)
    && Array.isArray(permissions) && permissions.every(isAppPermission)
    && isLaunchContext(value.launch);
}

export function isAppMessage(data: unknown): data is AppMessage {
  if (!isObject(data) || data.source !== APP_SOURCE || data.version !== PROTOCOL_VERSION) return false;
  switch (data.type) {
    case 'hello': return isNonEmptyString(data.appId) && isNullableString(data.appVersion) && isString(data.kitVersion);
    case 'token-request': return isNonEmptyString(data.requestId);
    case 'navigate': return isPortalTarget(data.target) && typeof data.newTab === 'boolean';
    case 'context': return isLaunchContext(data.context) && isNullableString(data.title);
    default: return false;
  }
}

export function isHostMessage(data: unknown): data is HostMessage {
  if (!isObject(data) || data.source !== HOST_SOURCE || data.version !== PROTOCOL_VERSION) return false;
  switch (data.type) {
    case 'init': return isAppSessionInit(data.session);
    case 'token': return isNullableString(data.requestId) && isNonEmptyString(data.accessToken) && isFiniteNumber(data.accessTokenExpiresAt);
    case 'token-error': return isNonEmptyString(data.requestId) && isString(data.message);
    default: return false;
  }
}

// ---- Launch context <-> portal query string ----

export function launchContextFromSearch(params: URLSearchParams): LaunchContext {
  const context: LaunchContext = {};
  for (const key of Object.keys(LAUNCH_PARAMS) as Array<keyof LaunchContext>) {
    const value = params.get(LAUNCH_PARAMS[key]);
    if (value) context[key] = value;
  }
  return context;
}

/** Writes the context into `params` (a copy), removing launch keys the context does not set. */
export function launchContextToSearch(context: LaunchContext, params: URLSearchParams = new URLSearchParams()): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of Object.keys(LAUNCH_PARAMS) as Array<keyof LaunchContext>) {
    const value = context[key];
    if (value) next.set(LAUNCH_PARAMS[key], value);
    else next.delete(LAUNCH_PARAMS[key]);
  }
  return next;
}

/** The URL the host loads in its iframe for a tool. */
export function hostedAppUrl(toolId: string): string {
  return `/tools/${toolId}/index.html?${HOSTED_APP_PARAM}=1`;
}

/** Reads `cirro-app` from a location's query string: whether, and how, the page is hosted. */
export function hostedModeFromSearch(search: string): HostedMode | null {
  const value = new URLSearchParams(search).get(HOSTED_APP_PARAM);
  if (value === '1') return 'portal';
  if (value === 'mock') return 'mock';
  return null;
}
