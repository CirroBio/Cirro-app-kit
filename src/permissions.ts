// The app permission model (CONTRACT.md section 4): what an app may ask for, and which
// permission each Cirro API request needs. Requests not listed here are denied.

export const APP_PERMISSIONS = {
  'projects:read': 'See your projects',
  'datasets:read': 'List datasets, their files and sample metadata',
  'files:read': 'Read the contents of dataset files',
  'datasets:write': 'Create datasets and edit their name, description and tags',
  'sheets:read': 'Read sheets',
  'sheets:write': 'Create sheets and change their rows',
  'pipelines:run': 'Run pipelines',
} as const;

export type AppPermission = keyof typeof APP_PERMISSIONS;

export const ALL_APP_PERMISSIONS = Object.keys(APP_PERMISSIONS) as AppPermission[];

export function isAppPermission(value: unknown): value is AppPermission {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(APP_PERMISSIONS, value);
}

// The S3 token types (ProjectAccessType) each permission may mint.
const TOKEN_PERMISSIONS: Record<string, AppPermission> = {
  PROJECT_DOWNLOAD: 'files:read',
  SHARED_DATASET_DOWNLOAD: 'files:read',
  DATASET_UPLOAD: 'datasets:write',
  SHEET_UPLOAD: 'sheets:write',
};

const ID = '[^/]+';

interface Route {
  method: string;
  pattern: RegExp;
  permission: AppPermission | ((body: unknown) => AppPermission | null);
}

const route = (method: string, path: string, permission: Route['permission']): Route => ({
  method,
  pattern: new RegExp(`^${path.replace(/\{\w+\}/g, ID)}$`),
  permission,
});

function tokenPermission(body: unknown): AppPermission | null {
  const accessType = typeof body === 'object' && body !== null ? (body as { accessType?: unknown }).accessType : undefined;
  return typeof accessType === 'string' ? TOKEN_PERMISSIONS[accessType] ?? null : null;
}

const ROUTES: Route[] = [
  route('GET', '/projects', 'projects:read'),
  route('GET', '/projects/{projectId}', 'projects:read'),

  route('GET', '/processes', 'datasets:read'),
  route('GET', '/processes/{processId}', 'datasets:read'),
  route('GET', '/projects/{projectId}/datasets', 'datasets:read'),
  route('GET', '/projects/{projectId}/datasets/{datasetId}', 'datasets:read'),
  route('GET', '/projects/{projectId}/datasets/{datasetId}/files', 'datasets:read'),
  route('GET', '/projects/{projectId}/datasets/{datasetId}/samples', 'datasets:read'),
  route('GET', '/projects/{projectId}/datasets/{datasetId}/samplesheet', 'datasets:read'),
  route('GET', '/projects/{projectId}/samples', 'datasets:read'),
  route('GET', '/projects/{projectId}/schema', 'datasets:read'),
  route('GET', '/projects/{projectId}/files', 'datasets:read'),
  route('GET', '/projects/{projectId}/files/{datasetId}/path', 'datasets:read'),

  route('POST', '/projects/{projectId}/s3-token', tokenPermission),

  route('POST', '/projects/{projectId}/datasets/upload', 'datasets:write'),
  route('PUT', '/projects/{projectId}/datasets/{datasetId}', 'datasets:write'),

  route('GET', '/projects/{projectId}/sheets', 'sheets:read'),
  route('GET', '/projects/{projectId}/sheets/{sheetId}', 'sheets:read'),
  route('GET', '/projects/{projectId}/sheets/{sheetId}/data', 'sheets:read'),
  route('POST', '/projects/{projectId}/sheets/{sheetId}/data/query', 'sheets:read'),
  route('POST', '/projects/{projectId}/sheets/raw-query', 'sheets:read'),
  route('POST', '/projects/{projectId}/sheets', 'sheets:write'),
  route('POST', '/projects/{projectId}/sheets/{sheetId}/data', 'sheets:write'),
  route('PATCH', '/projects/{projectId}/sheets/{sheetId}/data', 'sheets:write'),
  route('DELETE', '/projects/{projectId}/sheets/{sheetId}/data', 'sheets:write'),

  route('POST', '/projects/{projectId}/execution', 'pipelines:run')
];

/**
 * The permission a Cirro API request needs, or null when the app permission model does
 * not cover it (and it is therefore denied). `path` is relative to the API base path and
 * has no query string; `body` is the parsed JSON body, if any.
 */
export function permissionForRequest(method: string, path: string, body?: unknown): AppPermission | null {
  const verb = method.toUpperCase();
  const match = ROUTES.find((r) => r.method === verb && r.pattern.test(path));
  if (!match) return null;
  return typeof match.permission === 'function' ? match.permission(body) : match.permission;
}

/** Requested ∩ every allowance given (CONTRACT.md section 4), in the canonical order. */
export function effectivePermissions(requested: readonly AppPermission[], ...allowances: ReadonlyArray<readonly AppPermission[]>): AppPermission[] {
  return ALL_APP_PERMISSIONS.filter((p) => requested.includes(p) && allowances.every((allowed) => allowed.includes(p)));
}
