import { ProjectAccessType, Status } from '@cirrobio/api-client';
import { AppPermissionError, CirroApiError } from './errors';
import { createMockSession } from './mock';
import type { MockFixtures } from './types';

const fixtures = (): MockFixtures => ({
  appName: 'Proteoscope',
  user: { id: 'dev', name: 'Dev User' },
  launch: { projectId: 'p1', datasetId: 'd1' },
  projects: [
    {
      id: 'p1',
      name: 'Structures',
      datasets: [
        {
          id: 'd1',
          name: 'AF3 run',
          processId: 'alphafold3',
          createdAt: '2026-09-01T00:00:00.000Z',
          tags: [{ key: 'Target', value: 'KRAS' }],
          files: [
            { path: 'data/model_0.cif', size: 120, url: 'http://localhost:5173/fixtures/model_0.cif' },
            { path: 'data/model_0_confidences.json', url: 'http://localhost:5173/fixtures/conf.json' }
          ],
        }
      ],
    },
    { id: 'p2', name: 'Empty', datasets: [] }
  ],
});

describe('a mock session', () => {
  it('is made from the fixtures', () => {
    const session = createMockSession('proteoscope', fixtures());
    expect(session.mode).toBe('mock');
    expect(session.app).toEqual({ id: 'proteoscope', name: 'Proteoscope' });
    expect(session.user).toEqual({ id: 'dev', email: 'mock.user@example.com', name: 'Dev User' });
    expect(session.tenant).toEqual({ id: 'mock', name: 'Mock tenant' });
    expect(session.launch).toEqual({ projectId: 'p1', datasetId: 'd1' });
    expect([...session.permissions].sort()).toEqual(['datasets:read', 'datasets:write', 'files:read', 'pipelines:run', 'projects:read', 'sheets:read', 'sheets:write']);
    expect(session.portalUrl({ kind: 'project', projectId: 'p1' })).toBe('https://mock.cirro.invalid/project/p1/overview');
  });

  it('never needs a fresh token', async () => {
    jest.useFakeTimers({ now: new Date('2030-01-01T00:00:00Z') });
    await expect(createMockSession('proteoscope', fixtures()).getAccessToken()).resolves.toBe('mock-access-token');
    jest.useRealTimers();
  });

  it('answers the API calls the kit makes', async () => {
    const { api } = createMockSession('proteoscope', fixtures());
    expect((await api.projects.getProjects()).map((p) => [p.id, p.name])).toEqual([['p1', 'Structures'], ['p2', 'Empty']]);
    expect(await api.projects.getProject({ projectId: 'p2' })).toMatchObject({ id: 'p2', name: 'Empty', contacts: [] });
    const { data, nextToken } = await api.datasets.getDatasets({ projectId: 'p1' });
    expect(nextToken).toBeNull();
    expect(data).toEqual([expect.objectContaining({
      id: 'd1', name: 'AF3 run', projectId: 'p1', processId: 'alphafold3', status: Status.Completed,
      tags: [{ key: 'Target', value: 'KRAS' }], createdBy: 'dev', createdAt: new Date('2026-09-01T00:00:00.000Z'),
    })]);
    expect(await api.datasets.getDataset({ projectId: 'p1', datasetId: 'd1' })).toMatchObject({ id: 'd1', share: undefined, fileCount: 2, totalSizeBytes: 120 });
    expect(await api.datasets.getDatasetManifest({ projectId: 'p1', datasetId: 'd1', fileOffset: 1 })).toMatchObject({
      domain: 's3://mock/p1/d1', totalFiles: 2, files: [{ path: 'data/model_0_confidences.json' }],
    });
    expect(await api.files.generateProjectFileAccessToken({ projectId: 'p1', projectFileAccessRequest: { accessType: ProjectAccessType.ProjectDownload } }))
      .toMatchObject({ accessKeyId: 'mock', region: 'us-west-2' });
  });

  it('pages datasets as the API does', async () => {
    const many = fixtures();
    many.projects[1].datasets = Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, name: `D${i}`, files: [] }));
    const { api } = createMockSession('proteoscope', many);
    const first = await api.datasets.getDatasets({ projectId: 'p2', limit: 3 });
    const second = await api.datasets.getDatasets({ projectId: 'p2', limit: 3, nextToken: first.nextToken });
    expect([...first.data, ...second.data].map((d) => d.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4']);
    expect(second.nextToken).toBeNull();
  });

  it('answers 404 for what it does not have', async () => {
    const { api } = createMockSession('proteoscope', fixtures());
    await expect(api.datasets.getDataset({ projectId: 'p1', datasetId: 'nope' })).rejects.toMatchObject({ status: 404, message: 'The mock has no dataset nope in project p1.' });
    await expect(api.processes.getProcesses()).rejects.toThrow(new CirroApiError('The Cirro mock does not answer GET /processes.', 404, []));
  });

  it('still applies the permission guard', async () => {
    const { api } = createMockSession('proteoscope', { ...fixtures(), permissions: ['projects:read'] });
    await expect(api.projects.getProjects()).resolves.toHaveLength(2);
    await expect(api.datasets.getDatasets({ projectId: 'p1' })).rejects.toThrow(AppPermissionError);
  });

  it('lists files and hands out the fixture files\' own URLs', async () => {
    const { files } = createMockSession('proteoscope', fixtures());
    expect(await files.list('p1', 'd1')).toEqual([
      { path: 'data/model_0.cif', size: 120, metadata: {} },
      { path: 'data/model_0_confidences.json', size: null, metadata: {} }
    ]);
    await expect(files.signedUrl({ projectId: 'p1', datasetId: 'd1', path: 'data/model_0.cif' })).resolves.toBe('http://localhost:5173/fixtures/model_0.cif');
    await expect(files.signedUrl({ projectId: 'p1', datasetId: 'd1', path: 'data/missing.cif' })).rejects.toThrow('has no file data/missing.cif');
  });

  it('keeps the datasets the app creates, which complete when their files arrive', async () => {
    const session = createMockSession('proteoscope', fixtures());
    const created = await session.files.createDataset({
      projectId: 'p2', name: 'Figure', folder: ['Figures'], files: [{ path: 'fig.svg', body: '<svg/>', contentType: 'image/svg+xml' }],
    });
    expect(created).toEqual({ projectId: 'p2', datasetId: 'mock-dataset-1', name: 'Figure', portalUrl: 'https://mock.cirro.invalid/project/p2/dataset/mock-dataset-1' });
    const [listed] = (await session.api.datasets.getDatasets({ projectId: 'p2' })).data;
    expect(listed).toMatchObject({
      id: 'mock-dataset-1', status: Status.Completed, processId: 'custom_dataset',
      tags: [{ key: 'App', value: 'proteoscope' }, { key: 'Folder', value: 'folder://Apps/Proteoscope/Figures' }],
    });
    expect(await session.files.list('p2', 'mock-dataset-1')).toEqual([{ path: 'data/fig.svg', size: 6, metadata: {} }]);
    const ref = { projectId: 'p2', datasetId: 'mock-dataset-1', path: 'data/fig.svg' };
    expect(await session.files.signedUrl(ref)).toMatch(/^blob:/);
    await expect(session.files.readText(ref)).resolves.toBe('<svg/>');
  });

  it('leaves a dataset pending until every expected file has arrived', async () => {
    const { api } = createMockSession('proteoscope', fixtures());
    const { id } = await api.datasets.uploadDataset({ projectId: 'p1', uploadDatasetRequest: { name: 'Partial', processId: 'custom_dataset', expectedFiles: ['a', 'b'] } });
    expect((await api.datasets.getDataset({ projectId: 'p1', datasetId: id })).status).toBe(Status.Pending);
  });

  it('does not change the fixtures it was given', async () => {
    const given = fixtures();
    const session = createMockSession('proteoscope', given);
    await session.files.createDataset({ projectId: 'p1', name: 'X', folder: [], files: [{ path: 'x.txt', body: 'x' }] });
    expect(given).toEqual(fixtures());
  });
});
