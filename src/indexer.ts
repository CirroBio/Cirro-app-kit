// Discovery (CONTRACT.md section 7): walks the user's projects and completed datasets, asks
// the app's detector what it can open in each, and keeps the results in the session's
// `datasets_indexed` and `file_list` tables.
import { Dataset, Project, Status } from '@cirrobio/api-client';
import type { DatasetIndexedRow, FileListRow } from './conventions';
import { AppPermissionError } from './errors';
import type {
  AppSession, DataIndex, DatasetDetector, IndexedDataset, IndexProgress, IndexRunOptions, LoadableItem,
} from './types';

const DEFAULT_CONCURRENCY = 4;
// As the portal's datasetsQuery.
const DATASETS_PAGE_SIZE = 5000;

const idle = (): IndexProgress => ({
  running: false, projectsTotal: 0, projectsDone: 0, datasetsTotal: 0, datasetsDone: 0, datasetsSkipped: 0, itemsFound: 0, errors: 0,
});

const datasetKey = (projectId: string, datasetId: string) => `${projectId}/${datasetId}`;

/** The app's index of what it can open in the user's projects, kept in `session.store`. */
export function createDataIndex(session: AppSession, detector: DatasetDetector): DataIndex {
  const { datasetsIndexed, fileList } = session.store;
  const listeners = new Set<(progress: IndexProgress) => void>();
  let progress = idle();
  let current: Promise<IndexProgress> | null = null;

  const report = (change: Partial<IndexProgress>) => {
    progress = { ...progress, ...change };
    for (const listener of listeners) listener({ ...progress });
  };

  async function removeItems(projectId: string, datasetId: string): Promise<void> {
    for (const row of await fileList.list()) {
      if (row.project_id === projectId && row.dataset_id === datasetId) await fileList.remove(row);
    }
  }

  async function projectsToIndex(projectIds: string[] | undefined, signal?: AbortSignal): Promise<Project[]> {
    const projects = await session.api.projects.getProjects({ signal });
    if (projectIds) return projectIds.flatMap((id) => projects.filter((project) => project.id === id));
    const launch = session.launch.projectId;
    return [...projects].sort((a, b) => Number(b.id === launch) - Number(a.id === launch));
  }

  async function completedDatasets(projectId: string, signal?: AbortSignal): Promise<Dataset[]> {
    const datasets: Dataset[] = [];
    let nextToken: string | undefined;
    do {
      const page = await session.api.datasets.getDatasets({ projectId, limit: DATASETS_PAGE_SIZE, nextToken }, { signal });
      datasets.push(...page.data);
      nextToken = page.nextToken || undefined;
    } while (nextToken);
    return datasets
      .filter((dataset) => dataset.status === Status.Completed)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async function indexDataset(project: Project, dataset: Dataset, previous: DatasetIndexedRow | undefined, signal?: AbortSignal) {
    if (previous?.status === 'ok' && previous.indexer_version === detector.version) {
      report({
        datasetsDone: progress.datasetsDone + 1,
        datasetsSkipped: progress.datasetsSkipped + 1,
        itemsFound: progress.itemsFound + previous.item_count,
      });
      return;
    }
    const record: IndexedDataset = {
      projectId: project.id,
      projectName: project.name,
      datasetId: dataset.id,
      name: dataset.name,
      processId: dataset.processId,
      createdAt: isoDate(dataset.createdAt),
      createdBy: dataset.createdBy ?? null,
      tags: dataset.tags ?? [],
    };
    const indexedAt = new Date().toISOString();
    let items: LoadableItem[] = [];
    let error: string | null = null;
    try {
      if (detector.accepts?.(record) !== false) items = detector.detect(await session.files.list(project.id, dataset.id), record);
      if (signal?.aborted) return;
      if (previous && previous.item_count > 0) await removeItems(project.id, dataset.id);
      await fileList.upsertMany(items.map((item) => fileListRow(record, item, indexedAt)));
    } catch (e) {
      // Recorded, so the run goes on; an errored dataset has no items and is retried next run.
      if (signal?.aborted) return;
      error = e instanceof Error ? e.message : String(e);
      items = [];
      if (previous && previous.item_count > 0) await removeItems(project.id, dataset.id);
    }
    await datasetsIndexed.upsert({
      project_id: project.id,
      dataset_id: dataset.id,
      dataset_name: dataset.name,
      indexed_at: indexedAt,
      indexer_version: detector.version,
      item_count: items.length,
      status: error === null ? 'ok' : 'error',
      error,
    });
    report({
      datasetsDone: progress.datasetsDone + 1,
      itemsFound: progress.itemsFound + items.length,
      errors: progress.errors + (error === null ? 0 : 1),
    });
  }

  async function indexAll({ projectIds, concurrency = DEFAULT_CONCURRENCY, signal }: IndexRunOptions): Promise<IndexProgress> {
    progress = idle();
    report({ running: true });
    try {
      signal?.throwIfAborted();
      const projects = await projectsToIndex(projectIds, signal);
      report({ projectsTotal: projects.length });
      const indexed = new Map((await datasetsIndexed.list()).map((row) => [datasetKey(row.project_id, row.dataset_id), row]));
      for (const project of projects) {
        let datasets: Dataset[];
        try {
          datasets = await completedDatasets(project.id, signal);
        } catch (e) {
          // One project the user cannot list does not stop the others; it is tried again next run.
          if (signal?.aborted || e instanceof AppPermissionError) throw e;
          report({ projectsDone: progress.projectsDone + 1, errors: progress.errors + 1 });
          continue;
        }
        report({ datasetsTotal: progress.datasetsTotal + datasets.length });
        await eachLimited(datasets, concurrency, async (dataset) => {
          signal?.throwIfAborted();
          await indexDataset(project, dataset, indexed.get(datasetKey(project.id, dataset.id)), signal);
        });
        report({ projectsDone: progress.projectsDone + 1 });
      }
      signal?.throwIfAborted();
      return { ...progress, running: false };
    } finally {
      report({ running: false });
    }
  }

  return {
    run(options = {}) {
      current ??= indexAll(options).finally(() => {
        current = null;
      });
      return current;
    },
    get progress() {
      return { ...progress };
    },
    onProgress(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async items() {
      return (await fileList.list()).sort((a, b) =>
        (b.dataset_created_at ?? '').localeCompare(a.dataset_created_at ?? '') || a.dataset_id.localeCompare(b.dataset_id));
    },
    async forget(projectId, datasetId) {
      await datasetsIndexed.remove({ project_id: projectId, dataset_id: datasetId });
      await removeItems(projectId, datasetId);
    },
  };
}

function fileListRow(dataset: IndexedDataset, item: LoadableItem, indexedAt: string): FileListRow {
  return {
    project_id: dataset.projectId,
    project_name: dataset.projectName,
    dataset_id: dataset.datasetId,
    dataset_name: dataset.name,
    dataset_created_at: dataset.createdAt,
    path: item.path,
    is_folder: item.isFolder,
    kind: item.kind,
    label: item.label,
    size: item.size,
    file_count: item.fileCount,
    metadata: item.metadata ?? null,
    indexed_at: indexedAt,
  };
}

function isoDate(date: Date | undefined): string | null {
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

/** Runs `work` over `items`, at most `limit` at a time; the first failure rejects. */
async function eachLimited<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await work(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
}
