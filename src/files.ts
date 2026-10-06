// Dataset files (types.ts DatasetFiles): listings from the dataset manifest, reads by
// presigned S3 URLs, and new datasets saved under the app's folder (CONTRACT.md section 6).
import { AWSCredentials, DatasetDetail, ProjectAccessType, ProjectFileAccessRequest } from '@cirrobio/api-client';
import { appFolderTag, appTag } from './conventions';
import { presignS3 } from './presign';
import type { AppIdentity, PortalTarget } from './protocol';
import type { CirroApis, CreateDatasetFile, DatasetFileEntry, DatasetFileRef, DatasetFiles } from './types';

/** Cirro's "Files" ingest type: any collection of files. The default type of a dataset an app saves. */
export const FILES_PROCESS_ID = 'custom_dataset';

// File credentials are renewed this long before they expire, so a URL signed with them
// stays usable for a while.
const CREDENTIAL_MARGIN_MS = 5 * 60_000;
const DEFAULT_URL_SECONDS = 3600;

export interface S3Location {
  bucket: string;
  key: string;
}

/** Where file bytes are read and written: S3 itself, or the dev mock's fixtures. */
export interface ObjectStore {
  getUrl(location: S3Location, credentials: AWSCredentials, expiresInSeconds: number): Promise<string>;
  put(location: S3Location, credentials: AWSCredentials, file: CreateDatasetFile, signal?: AbortSignal): Promise<void>;
}

export const s3Objects: ObjectStore = {
  getUrl: ({ bucket, key }, credentials, expiresInSeconds) => presignS3({ method: 'GET', bucket, key, credentials, expiresInSeconds }),
  async put({ bucket, key }, credentials, file, signal) {
    const url = await presignS3({ method: 'PUT', bucket, key, credentials, expiresInSeconds: secondsLeft(credentials, DEFAULT_URL_SECONDS) });
    const headers = file.contentType ? { 'Content-Type': file.contentType } : undefined;
    const response = await fetch(url, { method: 'PUT', body: file.body, headers, signal });
    if (!response.ok) throw new Error(`${file.path} could not be uploaded (HTTP ${response.status}).`);
  },
};

interface Listing {
  /** The manifest's `domain`, which file paths are relative to. */
  root: { bucket: string; prefix: string };
  files: DatasetFileEntry[];
}

export interface FilesOptions {
  api: CirroApis;
  app: AppIdentity;
  portalUrl: (target: PortalTarget) => string;
  objects: ObjectStore;
}

/** DatasetFiles, plus `clear` for the session's dispose. */
export function createDatasetFiles({ api, app, portalUrl, objects }: FilesOptions): DatasetFiles & { clear(): void } {
  const listings = new Map<string, Promise<Listing>>();
  const details = new Map<string, Promise<DatasetDetail>>();
  const credentialCache = new Map<string, Promise<AWSCredentials>>();

  const listing = (projectId: string, datasetId: string) =>
    shared(listings, `${projectId}/${datasetId}`, () => loadListing(api, projectId, datasetId));

  const detail = (projectId: string, datasetId: string) =>
    shared(details, `${projectId}/${datasetId}`, () => api.datasets.getDataset({ projectId, datasetId }));

  async function credentials(projectId: string, request: ProjectFileAccessRequest): Promise<AWSCredentials> {
    const key = `${projectId}/${request.accessType}/${request.datasetId ?? ''}`;
    const load = () => api.files.generateProjectFileAccessToken({ projectId, projectFileAccessRequest: request });
    const cached = await shared(credentialCache, key, load);
    if (cached.expiration.getTime() - Date.now() > CREDENTIAL_MARGIN_MS) return cached;
    credentialCache.delete(key);
    return shared(credentialCache, key, load);
  }

  async function signedUrl(ref: DatasetFileRef, options: { expiresInSeconds?: number } = {}): Promise<string> {
    const [{ root }, dataset] = await Promise.all([listing(ref.projectId, ref.datasetId), detail(ref.projectId, ref.datasetId)]);
    // As @cirrobio/sdk's ProjectFileAccessContext.datasetDownload: a dataset shared into the
    // project is read with a token for that dataset.
    const request: ProjectFileAccessRequest = dataset.share
      ? { accessType: ProjectAccessType.SharedDatasetDownload, datasetId: ref.datasetId }
      : { accessType: ProjectAccessType.ProjectDownload };
    const fileCredentials = await credentials(ref.projectId, request);
    const key = root.prefix ? `${root.prefix}/${ref.path}` : ref.path;
    return objects.getUrl({ bucket: root.bucket, key }, fileCredentials, secondsLeft(fileCredentials, options.expiresInSeconds ?? DEFAULT_URL_SECONDS));
  }

  async function fetchFile(ref: DatasetFileRef, signal?: AbortSignal): Promise<Response> {
    const response = await fetch(await signedUrl(ref), { signal });
    if (!response.ok) throw new Error(`${ref.path} could not be read (HTTP ${response.status}).`);
    return response;
  }

  const createDataset: DatasetFiles['createDataset'] = async (input, { onProgress, signal } = {}) => {
    const { projectId, files } = input;
    const paths = files.map((file) => file.path);
    checkUploadPaths(paths);
    const created = await api.datasets.uploadDataset({
      projectId,
      uploadDatasetRequest: {
        name: input.name,
        description: input.description,
        processId: input.processId ?? FILES_PROCESS_ID,
        expectedFiles: paths,
        tags: [appTag(app.id), appFolderTag(app.name, ...input.folder), ...(input.tags ?? [])],
      },
    }, { signal });
    const upload: ProjectFileAccessRequest = { accessType: ProjectAccessType.DatasetUpload, datasetId: created.id };
    for (const [filesDone, file] of files.entries()) {
      onProgress?.({ filesDone, filesTotal: files.length, currentFile: file.path });
      const location = { bucket: created.bucket, key: `${created.uploadPath}/${file.path}` };
      await objects.put(location, await credentials(projectId, upload), file, signal);
    }
    onProgress?.({ filesDone: files.length, filesTotal: files.length, currentFile: null });
    return { projectId, datasetId: created.id, name: input.name, portalUrl: portalUrl({ kind: 'dataset', projectId, datasetId: created.id }) };
  };

  return {
    async list(projectId, datasetId) {
      return [...(await listing(projectId, datasetId)).files];
    },
    signedUrl,
    read: async (ref, options = {}) => (await fetchFile(ref, options.signal)).blob(),
    readText: async (ref, options = {}) => (await fetchFile(ref, options.signal)).text(),
    createDataset,
    clear() {
      listings.clear();
      details.clear();
      credentialCache.clear();
    },
  };
}

/** One promise per key, shared by concurrent callers; a rejected one is dropped so the next call retries. */
function shared<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached;
  const promise = load();
  cache.set(key, promise);
  promise.catch(() => {
    if (cache.get(key) === promise) cache.delete(key);
  });
  return promise;
}

// The manifest lists at most `fileLimit` files per call (20 000 by default; dev's largest
// datasets have 18 000), so page by `fileOffset` until `totalFiles`, as the portal's
// datasetFilesQuery and the Python SDK's get_assets_listing do.
async function loadListing(api: CirroApis, projectId: string, datasetId: string): Promise<Listing> {
  const first = await api.datasets.getDatasetManifest({ projectId, datasetId });
  const files = [...(first.files ?? [])];
  while (files.length < (first.totalFiles ?? 0)) {
    const page = await api.datasets.getDatasetManifest({ projectId, datasetId, fileOffset: files.length });
    if (!page.files?.length) break;
    files.push(...page.files);
  }
  const root = /^s3:\/\/([^/]+)\/?(.*?)\/?$/.exec(first.domain ?? '');
  if (!root) throw new Error(`Cirro did not say where the files of dataset ${datasetId} are.`);
  return {
    root: { bucket: root[1], prefix: root[2] },
    files: files.flatMap((f) => (f.path ? [{ path: f.path, size: f.size ?? null, metadata: f.metadata ?? {} }] : [])),
  };
}

/** `wanted` seconds, but never past the credentials' own expiry. */
function secondsLeft(credentials: AWSCredentials, wanted: number): number {
  const remaining = Math.floor((credentials.expiration.getTime() - Date.now()) / 1000);
  return Math.max(1, Math.min(wanted, remaining));
}

function checkUploadPaths(paths: string[]): void {
  if (!paths.length) throw new Error('A dataset needs at least one file.');
  const invalid = paths.find((path) => path.split('/').some((part) => part === '' || part === '.' || part === '..'));
  if (invalid !== undefined) throw new Error(`Invalid file path "${invalid}": use a relative path such as "figures/fig1.png".`);
  const duplicate = paths.find((path, i) => paths.indexOf(path) !== i);
  if (duplicate !== undefined) throw new Error(`"${duplicate}" is listed twice.`);
}
