import { createApis } from './api';
import { CirroApiError } from './errors';
import { createDatasetFiles, s3Objects } from './files';
import { ALL_APP_PERMISSIONS } from './permissions';

const MINUTE = 60_000;
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Answer = (query: URLSearchParams, body: unknown) => Response | unknown;

interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}

/** Files over a fake Cirro API: `answers` maps `METHOD /path` to a response body (or a Response). */
function setup(answers: Record<string, Answer>): { files: ReturnType<typeof createDatasetFiles>; calls: Call[]; called: (method: string, path: string) => Call[] } {
  const calls: Call[] = [];
  const fetchApi = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(String(input));
    const call = { method: init.method ?? 'GET', path: url.pathname.replace(/^\/api/, ''), query: url.searchParams, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined };
    calls.push(call);
    const answer = answers[`${call.method} ${call.path}`];
    if (!answer) return json(404, { message: `No answer for ${call.method} ${call.path}` });
    const result = answer(call.query, call.body);
    return result instanceof Response ? result : json(200, result);
  };
  const api = createApis({ basePath: 'https://tenant.example/api', accessToken: async () => 'token', permissions: new Set(ALL_APP_PERMISSIONS), fetchApi });
  const files = createDatasetFiles({
    api,
    app: { id: 'cytoweave', name: 'CytoWeave', version: '1.0.0' },
    portalUrl: (target) => `https://tenant.example/${JSON.stringify(target)}`,
    objects: s3Objects,
  });
  const called = (method: string, path: string): Call[] => calls.filter((c) => c.method === method && c.path === path);
  return { files, calls, called };
}

const credentials = (lifetimeMs: number): Record<string, string> => ({
  accessKeyId: 'ASIA', secretAccessKey: 'secret', sessionToken: 'session', region: 'us-west-2',
  expiration: new Date(Date.now() + lifetimeMs).toISOString(),
});

const manifest = (paths: string[]) => () => ({
  domain: 's3://project-p1/datasets/d1',
  files: paths.map((path) => ({ path, size: 10, metadata: { sample: 's1' } })),
  totalFiles: paths.length,
});

const dataset = (share: unknown = null) => () => ({
  id: 'd1', name: 'D1', s3: 's3://project-p1/datasets/d1', processId: 'fcs', projectId: 'p1', sourceDatasetIds: [], sourceDatasets: [],
  sourceSampleIds: [], sourceSampleFilesMap: {}, status: 'COMPLETED', statusMessage: '', tags: [], params: {}, info: {}, share,
  isViewRestricted: false, createdBy: 'u1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
});

const ref = { projectId: 'p1', datasetId: 'd1', path: 'data/a b.fcs' };

let fetchMock: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-06T12:00:00Z'), doNotFake: ['queueMicrotask', 'nextTick', 'setImmediate'] });
  fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('file contents'));
});

afterEach(() => {
  fetchMock.mockRestore();
  jest.useRealTimers();
});

describe('list', () => {
  it('pages the manifest until it has every file, and keeps the listing', async () => {
    const pages: Record<string, string[]> = { 0: ['data/a.fcs', 'data/b.fcs'], 2: ['data/c.fcs', 'data/d.fcs'], 4: ['data/e.fcs'] };
    const { files, called } = setup({
      'GET /projects/p1/datasets/d1/files': (query) => ({
        domain: 's3://project-p1/datasets/d1',
        files: pages[query.get('fileOffset') ?? '0'].map((path) => ({ path })),
        totalFiles: 5,
      }),
    });
    const listed = await files.list('p1', 'd1');
    expect(listed.map((f) => f.path)).toEqual(['data/a.fcs', 'data/b.fcs', 'data/c.fcs', 'data/d.fcs', 'data/e.fcs']);
    expect(listed[0]).toEqual({ path: 'data/a.fcs', size: null, metadata: {} });
    expect(called('GET', '/projects/p1/datasets/d1/files').map((c) => c.query.get('fileOffset'))).toEqual([null, '2', '4']);
    listed.pop();
    expect(await files.list('p1', 'd1')).toHaveLength(5);
    expect(called('GET', '/projects/p1/datasets/d1/files')).toHaveLength(3);
  });

  it('stops at a short manifest rather than asking forever', async () => {
    const { files, called } = setup({
      'GET /projects/p1/datasets/d1/files': (query) => ({ domain: 's3://b/p', files: query.get('fileOffset') ? [] : [{ path: 'a' }], totalFiles: 3 }),
    });
    expect(await files.list('p1', 'd1')).toHaveLength(1);
    expect(called('GET', '/projects/p1/datasets/d1/files')).toHaveLength(2);
  });

  it('does not keep a failure', async () => {
    let fail = true;
    const { files } = setup({
      'GET /projects/p1/datasets/d1/files': () => (fail ? json(500, { message: 'Try again' }) : manifest(['data/a.fcs'])()),
    });
    await expect(files.list('p1', 'd1')).rejects.toThrow(new CirroApiError('Try again', 500, []));
    fail = false;
    expect(await files.list('p1', 'd1')).toHaveLength(1);
  });
});

describe('signedUrl', () => {
  it('presigns a GET in the dataset\'s bucket with a project download token', async () => {
    const { files, called } = setup({
      'GET /projects/p1/datasets/d1/files': manifest(['data/a b.fcs']),
      'GET /projects/p1/datasets/d1': dataset(),
      'POST /projects/p1/s3-token': () => credentials(120 * MINUTE),
    });
    const url = new URL(await files.signedUrl(ref));
    expect(url.origin).toBe('https://project-p1.s3.dualstack.us-west-2.amazonaws.com');
    expect(url.pathname).toBe('/datasets/d1/data/a%20b.fcs');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(url.searchParams.get('X-Amz-Security-Token')).toBe('session');
    expect(called('POST', '/projects/p1/s3-token').map((c) => c.body)).toEqual([{ accessType: 'PROJECT_DOWNLOAD' }]);
  });

  it('reads a dataset shared into the project with a token for that dataset', async () => {
    const { files, called } = setup({
      'GET /projects/p1/datasets/d1/files': manifest(['data/a b.fcs']),
      'GET /projects/p1/datasets/d1': dataset({ id: 'share-1', name: 'From the core' }),
      'POST /projects/p1/s3-token': () => credentials(120 * MINUTE),
    });
    await files.signedUrl(ref);
    expect(called('POST', '/projects/p1/s3-token').map((c) => c.body)).toEqual([{ accessType: 'SHARED_DATASET_DOWNLOAD', datasetId: 'd1' }]);
  });

  it('never outlives its credentials, and honors a shorter lifetime', async () => {
    const { files } = setup({
      'GET /projects/p1/datasets/d1/files': manifest(['data/a b.fcs']),
      'GET /projects/p1/datasets/d1': dataset(),
      'POST /projects/p1/s3-token': () => credentials(30 * MINUTE),
    });
    expect(new URL(await files.signedUrl(ref)).searchParams.get('X-Amz-Expires')).toBe('1800');
    expect(new URL(await files.signedUrl(ref, { expiresInSeconds: 600 })).searchParams.get('X-Amz-Expires')).toBe('600');
  });

  it('shares credentials until 5 minutes before they expire', async () => {
    const { files, called } = setup({
      'GET /projects/p1/datasets/d1/files': manifest(['data/a b.fcs']),
      'GET /projects/p1/datasets/d1': dataset(),
      'POST /projects/p1/s3-token': () => credentials(10 * MINUTE),
    });
    await Promise.all([files.signedUrl(ref), files.signedUrl(ref)]);
    await files.signedUrl(ref);
    expect(called('POST', '/projects/p1/s3-token')).toHaveLength(1);
    expect(called('GET', '/projects/p1/datasets/d1/files')).toHaveLength(1);
    expect(called('GET', '/projects/p1/datasets/d1')).toHaveLength(1);
    jest.setSystemTime(Date.now() + 5 * MINUTE + 1);
    await files.signedUrl(ref);
    expect(called('POST', '/projects/p1/s3-token')).toHaveLength(2);
  });

  it('forgets everything on clear', async () => {
    const { files, called } = setup({
      'GET /projects/p1/datasets/d1/files': manifest(['data/a b.fcs']),
      'GET /projects/p1/datasets/d1': dataset(),
      'POST /projects/p1/s3-token': () => credentials(120 * MINUTE),
    });
    await files.signedUrl(ref);
    files.clear();
    await files.signedUrl(ref);
    expect(called('POST', '/projects/p1/s3-token')).toHaveLength(2);
    expect(called('GET', '/projects/p1/datasets/d1/files')).toHaveLength(2);
  });
});

describe('read', () => {
  const answers = {
    'GET /projects/p1/datasets/d1/files': manifest(['data/a b.fcs']),
    'GET /projects/p1/datasets/d1': dataset(),
    'POST /projects/p1/s3-token': () => credentials(120 * MINUTE),
  };

  it('fetches the signed URL', async () => {
    const { files } = setup(answers);
    const controller = new AbortController();
    await expect(files.readText(ref, { signal: controller.signal })).resolves.toBe('file contents');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).hostname).toBe('project-p1.s3.dualstack.us-west-2.amazonaws.com');
    expect(init.signal).toBe(controller.signal);
    expect(await (await files.read(ref)).text()).toBe('file contents');
  });

  it('says which file could not be read', async () => {
    const { files } = setup(answers);
    fetchMock.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    await expect(files.read(ref)).rejects.toThrow('data/a b.fcs could not be read (HTTP 403).');
  });
});

describe('createDataset', () => {
  const created = { id: 'new1', message: 'ok', uploadPath: 'datasets/new1/data', bucket: 'project-p1' };

  it('creates the dataset under the app\'s folder and uploads its files', async () => {
    const { files, called } = setup({
      'POST /projects/p1/datasets/upload': () => created,
      'POST /projects/p1/s3-token': () => credentials(120 * MINUTE),
    });
    const progress: unknown[] = [];
    const controller = new AbortController();
    const result = await files.createDataset({
      projectId: 'p1',
      name: 'Gating',
      description: 'Lymphocyte gates',
      folder: ['Workspaces'],
      files: [
        { path: 'workspace.cwz', body: '{"gates":[]}', contentType: 'application/json' },
        { path: 'figures/fig 1.png', body: new Uint8Array([137, 80, 78, 71]) }
      ],
      tags: [{ key: 'Panel', value: 'T cells' }],
    }, { onProgress: (p) => progress.push(p), signal: controller.signal });

    expect(called('POST', '/projects/p1/datasets/upload').map((c) => c.body)).toEqual([{
      name: 'Gating',
      description: 'Lymphocyte gates',
      processId: 'custom_dataset',
      expectedFiles: ['workspace.cwz', 'figures/fig 1.png'],
      tags: [
        { key: 'App', value: 'cytoweave', editable: true },
        { key: 'Folder', value: 'folder://Apps/CytoWeave/Workspaces', editable: true },
        { key: 'Panel', value: 'T cells' }
      ],
    }]);
    expect(called('POST', '/projects/p1/s3-token').map((c) => c.body)).toEqual([{ accessType: 'DATASET_UPLOAD', datasetId: 'new1' }]);
    const puts = fetchMock.mock.calls.map(([url, init]) => [new URL(String(url)), init as RequestInit] as const);
    expect(puts.map(([url, init]) => [url.origin + url.pathname, init.method])).toEqual([
      ['https://project-p1.s3.dualstack.us-west-2.amazonaws.com/datasets/new1/data/workspace.cwz', 'PUT'],
      ['https://project-p1.s3.dualstack.us-west-2.amazonaws.com/datasets/new1/data/figures/fig%201.png', 'PUT']
    ]);
    expect(puts[0][1]).toMatchObject({ body: '{"gates":[]}', headers: { 'Content-Type': 'application/json' }, signal: controller.signal });
    expect(puts[1][1].headers).toBeUndefined();
    expect(progress).toEqual([
      { filesDone: 0, filesTotal: 2, currentFile: 'workspace.cwz' },
      { filesDone: 1, filesTotal: 2, currentFile: 'figures/fig 1.png' },
      { filesDone: 2, filesTotal: 2, currentFile: null }
    ]);
    expect(result).toEqual({ projectId: 'p1', datasetId: 'new1', name: 'Gating', portalUrl: 'https://tenant.example/{"kind":"dataset","projectId":"p1","datasetId":"new1"}' });
  });

  it('uses the ingest type the app names', async () => {
    const { files, called } = setup({
      'POST /projects/p1/datasets/upload': () => created,
      'POST /projects/p1/s3-token': () => credentials(120 * MINUTE),
    });
    await files.createDataset({ projectId: 'p1', name: 'Plate', folder: [], files: [{ path: 'a.fcs', body: 'x' }], processId: 'fcs' });
    expect(called('POST', '/projects/p1/datasets/upload')[0].body).toMatchObject({ processId: 'fcs', tags: [{ key: 'App' }, { value: 'folder://Apps/CytoWeave' }] });
  });

  it.each([
    [[], 'at least one file'],
    [['/abs.txt'], 'Invalid file path "/abs.txt"'],
    [['a/../b.txt'], 'Invalid file path'],
    [['dir/'], 'Invalid file path'],
    [['a.txt', 'a.txt'], '"a.txt" is listed twice']
  ])('refuses the files %j before creating anything', async (paths, message) => {
    const { files, calls } = setup({});
    await expect(files.createDataset({ projectId: 'p1', name: 'X', folder: [], files: paths.map((path) => ({ path, body: '' })) }))
      .rejects.toThrow(message);
    expect(calls).toHaveLength(0);
  });

  it('refuses a folder the portal could not show', async () => {
    const { files, calls } = setup({});
    await expect(files.createDataset({ projectId: 'p1', name: 'X', folder: ['a:b'], files: [{ path: 'a', body: '' }] })).rejects.toThrow('Invalid folder name');
    expect(calls).toHaveLength(0);
  });

  it('says which file could not be uploaded', async () => {
    const { files } = setup({
      'POST /projects/p1/datasets/upload': () => created,
      'POST /projects/p1/s3-token': () => credentials(120 * MINUTE),
    });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 403 }));
    await expect(files.createDataset({ projectId: 'p1', name: 'X', folder: [], files: [{ path: 'a.txt', body: 'a' }] }))
      .rejects.toThrow('a.txt could not be uploaded (HTTP 403).');
  });
});
