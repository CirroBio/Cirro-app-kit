// The generated Cirro API clients as an app uses them: the session's access token, the
// app permission guard (CONTRACT.md section 4), and errors that carry the API's message
// (as @cirrobio/sdk's generateApiConfig and PortalErrorHandler do for the portal).
import {
  Configuration, DatasetsApi, ExecutionApi, FetchAPI, FileApi, MetadataApi, Middleware, ProcessesApi, ProjectsApi, SheetsApi,
} from '@cirrobio/api-client';
import { AppPermissionError, CirroApiError } from './errors';
import { AppPermission, permissionForRequest } from './permissions';
import type { CirroApis } from './types';

export interface ApiOptions {
  /** Absolute, e.g. `https://tenant.cirro.bio/api`. */
  basePath: string;
  accessToken: () => Promise<string>;
  permissions: ReadonlySet<AppPermission>;
  /** The dev mock answers requests itself. */
  fetchApi?: FetchAPI;
}

export function createApis({ basePath, accessToken, permissions, fetchApi }: ApiOptions): CirroApis {
  const configuration = new Configuration({
    basePath,
    accessToken,
    fetchApi,
    middleware: [permissionGuard(basePath, permissions), apiErrors],
  });
  return {
    configuration,
    projects: new ProjectsApi(configuration),
    datasets: new DatasetsApi(configuration),
    files: new FileApi(configuration),
    metadata: new MetadataApi(configuration),
    processes: new ProcessesApi(configuration),
    sheets: new SheetsApi(configuration),
    execution: new ExecutionApi(configuration),
  };
}

function permissionGuard(basePath: string, permissions: ReadonlySet<AppPermission>): Middleware {
  const basePathname = new URL(basePath).pathname.replace(/\/$/, '');
  return {
    async pre({ url, init }) {
      const method = init.method ?? 'GET';
      const { pathname } = new URL(url);
      const path = pathname.startsWith(basePathname) ? pathname.slice(basePathname.length) : pathname;
      // The generated client sends every request body as JSON text.
      const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
      const permission = permissionForRequest(method, path, body);
      if (!permission || !permissions.has(permission)) throw new AppPermissionError(method, path, permission);
    },
  };
}

interface ApiErrorBody {
  errorDetail?: string;
  message?: string;
  errors?: Array<{ message?: string }>;
}

const apiErrors: Middleware = {
  async post({ response }) {
    if (response.ok) return;
    const body = await response.json().catch(() => null) as ApiErrorBody | null;
    const message = body?.errorDetail ?? body?.message ?? `The Cirro API answered ${response.status} ${response.statusText}`.trim();
    const errors = (body?.errors ?? []).flatMap((e) => (e.message ? [e.message] : []));
    throw new CirroApiError(message, response.status, errors);
  },
};
