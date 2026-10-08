import { CirroApiError, HostConnectionError } from './errors';
import { createDataIndex } from './indexer';
import { createMockSession } from './mock';
import type {
  AppSession, DatasetDetector, DatasetFileEntry, IndexedDataset, IndexProgress, LoadableItem, MockDataset, MockFile, MockFixtures
} from './types';

const fcs = (path: string): MockFile => ({ path, size: 100, url: `http://localhost/${path}` });

function fixtures(): MockFixtures {
  return {
    appName: 'CytoWeave',
    launch: { projectId: 'p2' },
    projects: [
      {
        id: 'p1',
        name: 'Alpha',
        datasets: [
          { id: 'd1', name: 'Plate 1', createdAt: '2026-01-01T00:00:00.000Z', files: [fcs('data/a.fcs'), fcs('data/notes.txt')] },
          { id: 'd2', name: 'Plate 2', createdAt: '2026-03-01T00:00:00.000Z', files: [fcs('data/b.fcs')] }
        ],
      },
      {
        id: 'p2',
        name: 'Beta',
        datasets: [{ id: 'd3', name: 'Plate 3', createdAt: '2026-02-01T00:00:00.000Z', files: [fcs('data/c.fcs'), fcs('data/nested/d.fcs')] }],
      }
    ],
  };
}

function fcsDetector(version = '1', overrides: Partial<DatasetDetector> = {}): DatasetDetector {
  return {
    version,
    detect: (files) => files
      .filter((f) => f.path.endsWith('.fcs'))
      .map((f): LoadableItem => ({ path: f.path, isFolder: false, kind: 'fcs', label: f.path.split('/').pop()!, size: f.size, fileCount: null, metadata: { v: version } })),
    ...overrides,
  };
}

const manyDatasets = (count: number): MockDataset[] =>
  Array.from({ length: count }, (_, i) => ({ id: `m${i}`, name: `M${i}`, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(), files: [fcs(`data/m${i}.fcs`)] }));

interface ListingStats {
  calls: string[];
  inFlight: number;
  maxInFlight: number;
}

/** Spies on the session's file listings, optionally slowing each down. */
function watchListings(session: AppSession, delayMs = 0): ListingStats {
  const list = session.files.list.bind(session.files);
  const stats: ListingStats = { calls: [], inFlight: 0, maxInFlight: 0 };
  jest.spyOn(session.files, 'list').mockImplementation(async (projectId, datasetId) => {
    stats.calls.push(datasetId);
    stats.inFlight += 1;
    stats.maxInFlight = Math.max(stats.maxInFlight, stats.inFlight);
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    stats.inFlight -= 1;
    return list(projectId, datasetId);
  });
  return stats;
}

describe('the data index', () => {
  it('indexes every completed dataset, the launch project first and newest first, reporting each one', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const listings = watchListings(session);
    const index = createDataIndex(session, fcsDetector());
    const reports: IndexProgress[] = [];
    index.onProgress((progress) => reports.push(progress));

    const result = await index.run({ concurrency: 1 });

    expect(listings.calls).toEqual(['d3', 'd2', 'd1']);
    expect(result).toEqual({
      running: false, projectsTotal: 2, projectsDone: 2, datasetsTotal: 3, datasetsDone: 3, datasetsSkipped: 0, datasetsFailed: 0, itemsFound: 4,
      errors: 0,
    });
    expect(index.progress).toEqual(result);
    expect(reports[0].running).toBe(true);
    expect(reports.map((p) => p.datasetsDone).filter((n, i, all) => all.indexOf(n) === i)).toEqual([0, 1, 2, 3]);
    expect(reports[reports.length - 1].running).toBe(false);

    const items = await index.items();
    expect(items.map((r) => `${r.dataset_id}:${r.path}`)).toEqual(['d2:data/b.fcs', 'd3:data/c.fcs', 'd3:data/nested/d.fcs', 'd1:data/a.fcs']);
    expect(items[2]).toEqual({
      project_id: 'p2', project_name: 'Beta', dataset_id: 'd3', dataset_name: 'Plate 3', dataset_created_at: '2026-02-01T00:00:00.000Z',
      path: 'data/nested/d.fcs', is_folder: false, kind: 'fcs', label: 'd.fcs', size: 100, file_count: null, metadata: { v: '1' },
      indexed_at: expect.any(String),
    });
    expect((await session.store.datasetsIndexed.list()).map((r) => [r.dataset_id, r.status, r.item_count, r.indexer_version])).toEqual([
      ['d3', 'ok', 2, '1'], ['d2', 'ok', 1, '1'], ['d1', 'ok', 1, '1']
    ]);
  });

  it('skips datasets indexed under the same detector version, and re-reads them under another', async () => {
    const session = createMockSession('cytoweave', fixtures());
    await createDataIndex(session, fcsDetector('1')).run();
    const listings = watchListings(session);

    const again = await createDataIndex(session, fcsDetector('1')).run();
    expect(listings.calls).toEqual([]);
    expect(again).toMatchObject({ datasetsDone: 3, datasetsSkipped: 3, itemsFound: 4 });

    const onlyB = fcsDetector('2', { detect: (files) => files.filter((f) => f.path.endsWith('b.fcs')).map((f) => ({ path: f.path, isFolder: false, kind: 'fcs', label: 'b', size: null, fileCount: null })) });
    const index = createDataIndex(session, onlyB);
    expect(await index.run()).toMatchObject({ datasetsSkipped: 0, itemsFound: 1 });
    expect(listings.calls).toHaveLength(3);
    expect((await index.items()).map((r) => r.path)).toEqual(['data/b.fcs']);
    expect((await session.store.datasetsIndexed.list()).every((r) => r.indexer_version === '2')).toBe(true);
  });

  it('records datasets the detector does not accept without listing their files', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const listings = watchListings(session);
    const index = createDataIndex(session, fcsDetector('1', { accepts: (dataset) => dataset.projectId === 'p1' }));
    expect(await index.run()).toMatchObject({ datasetsDone: 3, itemsFound: 2 });
    expect(listings.calls.sort()).toEqual(['d1', 'd2']);
    expect(await session.store.datasetsIndexed.get({ project_id: 'p2', dataset_id: 'd3' })).toMatchObject({ status: 'ok', item_count: 0 });
  });

  it('gives the detector what it knows of the dataset', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const seen: unknown[] = [];
    await createDataIndex(session, fcsDetector('1', { accepts: (dataset) => { seen.push(dataset); return false; } })).run({ projectIds: ['p2'] });
    expect(seen).toEqual([{
      projectId: 'p2', projectName: 'Beta', datasetId: 'd3', name: 'Plate 3', processId: 'custom_dataset', createdAt: '2026-02-01T00:00:00.000Z',
      createdBy: 'mock-user', tags: [],
    }]);
  });

  it('remembers a dataset that will fail again, and skips it until the detector changes or a retry', async () => {
    const session = createMockSession('cytoweave', fixtures());
    let broken = true;
    const detect = (files: DatasetFileEntry[], dataset: IndexedDataset): LoadableItem[] => {
      if (broken && dataset.datasetId === 'd1') throw new Error('Unreadable FCS header');
      return fcsDetector().detect(files, dataset);
    };
    const stats = watchListings(session);

    const first = await createDataIndex(session, fcsDetector('1', { detect })).run({ concurrency: 1 });
    expect(first).toMatchObject({ datasetsDone: 3, datasetsFailed: 1, errors: 0, itemsFound: 3 });
    expect(await session.store.datasetsIndexed.get({ project_id: 'p1', dataset_id: 'd1' }))
      .toMatchObject({ status: 'error', error: 'Unreadable FCS header', item_count: 0 });

    broken = false;
    stats.calls.length = 0;
    const second = await createDataIndex(session, fcsDetector('1', { detect })).run();
    expect(second).toMatchObject({ datasetsDone: 3, datasetsSkipped: 3, datasetsFailed: 1, itemsFound: 3 });
    expect(stats.calls).toEqual([]);

    const retried = await createDataIndex(session, fcsDetector('1', { detect })).run({ retryFailed: true });
    expect(retried).toMatchObject({ datasetsSkipped: 2, datasetsFailed: 0, itemsFound: 4 });
    expect(stats.calls).toEqual(['d1']);

    await createDataIndex(session, fcsDetector('1', { detect })).recordFailure('p1', 'd1', new Error('Unreadable FCS header'));
    stats.calls.length = 0;
    expect(await createDataIndex(session, fcsDetector('2', { detect })).run()).toMatchObject({ datasetsSkipped: 0, datasetsFailed: 0, itemsFound: 4 });
    expect(stats.calls).toHaveLength(3);
  });

  it('leaves no record of a dataset that failed for a passing reason, so the next run reads it again', async () => {
    const session = createMockSession('cytoweave', fixtures());
    jest.spyOn(session.files, 'list')
      .mockRejectedValueOnce(new CirroApiError('Manifest unavailable', 503, []))
      .mockRejectedValueOnce(new HostConnectionError('Cirro did not send a fresh access token in time.'));

    expect(await createDataIndex(session, fcsDetector()).run({ concurrency: 1 })).toMatchObject({ datasetsDone: 3, errors: 2, datasetsFailed: 0 });
    expect((await session.store.datasetsIndexed.list()).map((r) => r.dataset_id)).toEqual(['d1']);
    expect(await createDataIndex(session, fcsDetector()).run()).toMatchObject({ datasetsSkipped: 1, errors: 0, itemsFound: 4 });
  });

  it('records a dataset the app could not open, dropping its items, when the failure will happen again', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const index = createDataIndex(session, fcsDetector());
    await index.run();

    expect(await index.recordFailure('p2', 'd3', new TypeError('Failed to fetch'))).toBe(false);
    expect((await index.items()).filter((row) => row.dataset_id === 'd3')).toHaveLength(2);

    expect(await index.recordFailure('p2', 'd3', new Error('Not an FCS file'))).toBe(true);
    expect((await index.items()).map((row) => row.dataset_id)).toEqual(['d2', 'd1']);
    expect(await session.store.datasetsIndexed.get({ project_id: 'p2', dataset_id: 'd3' }))
      .toMatchObject({ dataset_name: 'Plate 3', status: 'error', error: 'Not an FCS file', item_count: 0 });
    expect(await index.run()).toMatchObject({ datasetsSkipped: 3, datasetsFailed: 1, itemsFound: 2 });
  });

  it('records a detector that returns items the store cannot hold as an error', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const index = createDataIndex(session, fcsDetector('1', { detect: () => [{ path: 'x', isFolder: false, kind: 'fcs', label: 'x', size: '1kB' as unknown as number, fileCount: null }] }));
    expect(await index.run()).toMatchObject({ datasetsFailed: 3, errors: 0, itemsFound: 0 });
    expect((await session.store.datasetsIndexed.list())[0].error).toBe('file_list.size must be a number, not "1kB".');
  });

  it('leaves datasets that are not complete for a later run, without a record', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const { id } = await session.api.datasets.uploadDataset({ projectId: 'p1', uploadDatasetRequest: { name: 'Uploading', processId: 'fcs', expectedFiles: ['x.fcs'] } });
    expect(await createDataIndex(session, fcsDetector()).run()).toMatchObject({ datasetsTotal: 3 });
    expect(await session.store.datasetsIndexed.get({ project_id: 'p1', dataset_id: id })).toBeNull();
  });

  it('reads at most `concurrency` datasets at once, 4 by default', async () => {
    const many = fixtures();
    many.projects[0].datasets = manyDatasets(12);
    const session = createMockSession('cytoweave', many);
    const listings = watchListings(session, 5);
    await createDataIndex(session, fcsDetector()).run();
    expect(listings.maxInFlight).toBe(4);

    const other = createMockSession('cytoweave', many);
    const limited = watchListings(other, 5);
    await createDataIndex(other, fcsDetector()).run({ concurrency: 2 });
    expect(limited.maxInFlight).toBe(2);
    expect(limited.calls).toHaveLength(13);
  });

  it('stops when aborted, recording only the datasets it finished', async () => {
    const many = fixtures();
    many.projects[1].datasets = manyDatasets(10);
    const session = createMockSession('cytoweave', many);
    const listings = watchListings(session, 5);
    const index = createDataIndex(session, fcsDetector());
    const controller = new AbortController();
    index.onProgress((progress) => {
      if (progress.datasetsDone === 1) controller.abort();
    });

    await expect(index.run({ concurrency: 2, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(listings.calls).toHaveLength(2);
    expect(await session.store.datasetsIndexed.list()).toHaveLength(1);
    expect(index.progress.running).toBe(false);
  });

  it('does nothing with a signal already aborted', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const getProjects = jest.spyOn(session.api.projects, 'getProjects');
    await expect(createDataIndex(session, fcsDetector()).run({ signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' });
    expect(getProjects).not.toHaveBeenCalled();
  });

  it('shares a run in flight', async () => {
    const index = createDataIndex(createMockSession('cytoweave', fixtures()), fcsDetector());
    const first = index.run();
    expect(index.run({ concurrency: 1 })).toBe(first);
    await first;
    const second = index.run();
    expect(second).not.toBe(first);
    await second;
  });

  it('indexes only the projects asked for, in that order', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const listings = watchListings(session);
    const result = await createDataIndex(session, fcsDetector()).run({ projectIds: ['p1', 'unknown'], concurrency: 1 });
    expect(result).toMatchObject({ projectsTotal: 1, datasetsTotal: 2 });
    expect(listings.calls).toEqual(['d2', 'd1']);
  });

  it('pages through a project\'s datasets', async () => {
    const many = fixtures();
    many.projects[1].datasets = manyDatasets(5001);
    const session = createMockSession('cytoweave', many);
    const getDatasets = jest.spyOn(session.api.datasets, 'getDatasets');
    const result = await createDataIndex(session, fcsDetector('1', { accepts: () => false })).run({ projectIds: ['p2'] });
    expect(result.datasetsTotal).toBe(5001);
    expect(getDatasets).toHaveBeenCalledTimes(2);
  });

  it('counts a project it cannot list as an error and goes on', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const getDatasets = session.api.datasets.getDatasets.bind(session.api.datasets);
    jest.spyOn(session.api.datasets, 'getDatasets').mockImplementation(async (request, init) => {
      if (request.projectId === 'p2') throw new CirroApiError('Project is archived', 409, []);
      return getDatasets(request, init);
    });
    expect(await createDataIndex(session, fcsDetector()).run()).toMatchObject({ projectsDone: 2, datasetsDone: 2, errors: 1 });
  });

  it('fails when the app may not list datasets at all', async () => {
    const session = createMockSession('cytoweave', { ...fixtures(), permissions: ['projects:read'] });
    await expect(createDataIndex(session, fcsDetector()).run()).rejects.toMatchObject({ name: 'AppPermissionError', permission: 'datasets:read' });
  });

  it('forgets a dataset so the next run reads it again', async () => {
    const session = createMockSession('cytoweave', fixtures());
    const index = createDataIndex(session, fcsDetector());
    await index.run();
    await index.forget('p2', 'd3');
    expect((await index.items()).map((r) => r.dataset_id)).toEqual(['d2', 'd1']);
    expect(await session.store.datasetsIndexed.get({ project_id: 'p2', dataset_id: 'd3' })).toBeNull();
    const listings = watchListings(session);
    await index.run();
    expect(listings.calls).toEqual(['d3']);
  });

  it('stops reporting to a listener that unsubscribed', async () => {
    const index = createDataIndex(createMockSession('cytoweave', fixtures()), fcsDetector());
    const listener = jest.fn();
    index.onProgress(listener)();
    await index.run();
    expect(listener).not.toHaveBeenCalled();
  });
});
