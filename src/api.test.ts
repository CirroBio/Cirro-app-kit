import { ProjectAccessType } from '@cirrobio/api-client';
import { createApis } from './api';
import { AppPermissionError, CirroApiError } from './errors';
import type { AppPermission } from './permissions';
import type { CirroApis } from './types';

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function apis(permissions: AppPermission[], answer: Response = json(200, [])): { api: CirroApis; fetchApi: jest.Mock<Promise<Response>, [string, RequestInit]> } {
  const fetchApi = jest.fn(async (_url: string, _init: RequestInit) => answer.clone());
  const api = createApis({
    basePath: 'https://tenant.example/api',
    accessToken: async () => 'token-1',
    permissions: new Set(permissions),
    fetchApi,
  });
  return { api, fetchApi };
}

describe('the permission guard', () => {
  it('sends a granted request with the session\'s bearer token', async () => {
    const { api, fetchApi } = apis(['projects:read']);
    await api.projects.getProjects();
    expect(fetchApi).toHaveBeenCalledTimes(1);
    const [url, init] = fetchApi.mock.calls[0];
    expect(url).toBe('https://tenant.example/api/projects');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('stops an ungranted request before it is sent', async () => {
    const { api, fetchApi } = apis(['projects:read']);
    const request = api.datasets.getDatasets({ projectId: 'p1', limit: 10 });
    await expect(request).rejects.toThrow(AppPermissionError);
    await expect(request).rejects.toMatchObject({ method: 'GET', path: '/projects/p1/datasets', permission: 'datasets:read' });
    expect(fetchApi).not.toHaveBeenCalled();
  });

  it('denies a request the permission model does not cover, whatever is granted', async () => {
    const { api, fetchApi } = apis(['projects:read', 'datasets:read', 'datasets:write', 'files:read']);
    await expect(api.datasets.deleteDataset({ projectId: 'p1', datasetId: 'd1' }))
      .rejects.toMatchObject({ name: 'AppPermissionError', permission: null, path: '/projects/p1/datasets/d1' });
    expect(fetchApi).not.toHaveBeenCalled();
  });

  it('reads the S3 token type from the request body', async () => {
    const { api, fetchApi } = apis(['files:read'], json(200, { accessKeyId: 'a', secretAccessKey: 's', sessionToken: 't', expiration: '2030-01-01T00:00:00Z' }));
    await api.files.generateProjectFileAccessToken({ projectId: 'p1', projectFileAccessRequest: { accessType: ProjectAccessType.ProjectDownload } });
    expect(fetchApi).toHaveBeenCalledTimes(1);
    await expect(api.files.generateProjectFileAccessToken({ projectId: 'p1', projectFileAccessRequest: { accessType: ProjectAccessType.DatasetUpload, datasetId: 'd1' } }))
      .rejects.toMatchObject({ permission: 'datasets:write' });
    expect(fetchApi).toHaveBeenCalledTimes(1);
  });

  it('matches paths relative to the base path, without the query string', async () => {
    const { api, fetchApi } = apis(['datasets:read'], json(200, { files: [], totalFiles: 0 }));
    await api.datasets.getDatasetManifest({ projectId: 'p1', datasetId: 'd1', fileOffset: 20000 });
    expect(fetchApi.mock.calls[0][0]).toBe('https://tenant.example/api/projects/p1/datasets/d1/files?fileOffset=20000');
  });
});

describe('API errors', () => {
  it('carry the API\'s message and status', async () => {
    const { api } = apis(['projects:read'], json(404, { message: 'Project not found' }));
    const request = api.projects.getProject({ projectId: 'p1' });
    await expect(request).rejects.toThrow(CirroApiError);
    await expect(request).rejects.toMatchObject({ message: 'Project not found', status: 404, errors: [] });
  });

  it('prefer errorDetail, and keep the field messages', async () => {
    const { api } = apis(['projects:read'], json(400, { errorDetail: 'Invalid request', errors: [{ message: 'name is required' }, {}] }));
    await expect(api.projects.getProjects()).rejects.toMatchObject({ message: 'Invalid request', status: 400, errors: ['name is required'] });
  });

  it('say what the API answered when its body is not JSON', async () => {
    const { api } = apis(['projects:read'], new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }));
    await expect(api.projects.getProjects()).rejects.toMatchObject({ name: 'CirroApiError', message: 'The Cirro API answered 502 Bad Gateway', status: 502 });
  });
});
