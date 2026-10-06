// The kit's public API: what an app builds on. CONTRACT.md describes the behavior.
import type {
  Configuration, DatasetsApi, ExecutionApi, FileApi, MetadataApi, ProcessesApi, ProjectsApi, SheetsApi, Tag,
} from '@cirrobio/api-client';
import type { AppPermission } from './permissions';
import type { AppIdentity, AppSessionInit, AppTenant, AppUser, LaunchContext, PortalTarget } from './protocol';
import type {
  BookmarkRow, DatasetIndexedRow, FileListRow, HistoryRow, SettingRow, TableSchema,
} from './conventions';

// ---- Session ----

/** How the session was made: by the portal host, by the dev mock, or by an app's own sign-in. */
export type SessionMode = 'portal' | 'mock' | 'standalone';

/** The generated Cirro API clients, configured with the session's token and the permission guard. */
export interface CirroApis {
  configuration: Configuration;
  projects: ProjectsApi;
  datasets: DatasetsApi;
  files: FileApi;
  metadata: MetadataApi;
  processes: ProcessesApi;
  sheets: SheetsApi;
  execution: ExecutionApi;
}

export interface AppSession {
  readonly mode: SessionMode;
  readonly app: AppIdentity;
  readonly user: AppUser;
  readonly tenant: AppTenant;
  readonly permissions: ReadonlySet<AppPermission>;
  /** What the portal asked the app to show first. */
  readonly launch: LaunchContext;
  readonly api: CirroApis;
  readonly files: DatasetFiles;
  readonly store: AppDataStore;
  can(permission: AppPermission): boolean;
  /** A token valid for at least 60 s, refreshed through the host when needed. */
  getAccessToken(): Promise<string>;
  /** An absolute portal URL for a target. */
  portalUrl(target: PortalTarget): string;
  /** Asks the portal to open a target; a new browser tab by default. */
  openInPortal(target: PortalTarget, options?: { newTab?: boolean }): void;
  /** Tells the portal what the app is showing (its URL and tab title follow). */
  reportContext(context: LaunchContext, title?: string): void;
  /** Stops listening to the host and drops cached credentials. */
  dispose(): void;
}

export interface ConnectOptions {
  appId: string;
  appVersion?: string;
  /** How long to wait for the host's `init`; default 10 000 ms. */
  timeoutMs?: number;
  /** Fixtures for `?cirro-app=mock`. Mock mode is unavailable without them. */
  mock?: () => MockFixtures | Promise<MockFixtures>;
}

/** For an app that signed the user in itself (no portal host). */
export interface StandaloneSessionOptions {
  init: AppSessionInit;
  refreshToken: () => Promise<{ accessToken: string; accessTokenExpiresAt: number }>;
}

// ---- Files and datasets ----

/** A file or folder in a dataset; `path` is relative to the dataset root, as in its file listing. */
export interface DatasetFileRef {
  projectId: string;
  datasetId: string;
  path: string;
}

export interface DatasetFileEntry {
  path: string;
  size: number | null;
  metadata: Record<string, string>;
}

export interface UploadProgress {
  filesDone: number;
  filesTotal: number;
  currentFile: string | null;
}

export interface CreateDatasetFile {
  /** Relative path inside the new dataset, e.g. `workspace.cwz` or `figures/fig1.png`. */
  path: string;
  body: Blob | ArrayBuffer | Uint8Array | string;
  contentType?: string;
}

export interface CreateDatasetInput {
  projectId: string;
  name: string;
  description?: string;
  /** Subfolder under `Apps/<App name>/`, e.g. `['Workspaces']`. */
  folder: string[];
  files: CreateDatasetFile[];
  /** Extra tags; the App and Folder tags are always added. */
  tags?: Tag[];
}

export interface CreatedDataset {
  projectId: string;
  datasetId: string;
  name: string;
  portalUrl: string;
}

export interface DatasetFiles {
  /** The dataset's files (cached: completed datasets are immutable). */
  list(projectId: string, datasetId: string): Promise<DatasetFileEntry[]>;
  /** A presigned GET URL (range requests work), valid for at most `expiresInSeconds` (default 3600) and never past its credentials. */
  signedUrl(ref: DatasetFileRef, options?: { expiresInSeconds?: number }): Promise<string>;
  read(ref: DatasetFileRef, options?: { signal?: AbortSignal }): Promise<Blob>;
  readText(ref: DatasetFileRef, options?: { signal?: AbortSignal }): Promise<string>;
  /** Creates a dataset from these files under the app's folder and uploads them. */
  createDataset(input: CreateDatasetInput, options?: { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal }): Promise<CreatedDataset>;
}

// ---- App data storage ----

export type StoreBackend = 'memory' | 'sheets';

/** One table, already narrowed to the current user's rows (`user_id` is never visible). */
export interface AppTable<Row extends object> {
  readonly name: string;
  /** `app_<appId>_<table>` */
  readonly sheetName: string;
  list(): Promise<Row[]>;
  /** `key` must set every key column. */
  get(key: Partial<Row>): Promise<Row | null>;
  upsert(row: Row): Promise<void>;
  upsertMany(rows: readonly Row[]): Promise<void>;
  /** `key` must set every key column. */
  remove(key: Partial<Row>): Promise<void>;
  /** Called with all rows once on subscribe, then after every change. */
  subscribe(listener: (rows: Row[]) => void): () => void;
}

export interface AppDataStore {
  readonly backend: StoreBackend;
  readonly history: AppTable<HistoryRow>;
  readonly bookmarks: AppTable<BookmarkRow>;
  readonly settings: AppTable<SettingRow>;
  readonly datasetsIndexed: AppTable<DatasetIndexedRow>;
  readonly fileList: AppTable<FileListRow>;
  /** An app-specific table; the same schema name always returns the same table. */
  table<Row extends object>(schema: TableSchema<Row>): AppTable<Row>;
}

// ---- Discovery ----

export interface IndexedDataset {
  projectId: string;
  projectName: string;
  datasetId: string;
  name: string;
  processId: string;
  createdAt: string | null;
  createdBy: string | null;
  tags: Tag[];
}

/** One thing the app can open: a file, or a folder that opens as a unit. */
export interface LoadableItem {
  path: string;
  isFolder: boolean;
  /** The app's own vocabulary, e.g. `fcs`, `structure`, `zarr-folder`. */
  kind: string;
  label: string;
  size: number | null;
  fileCount: number | null;
  metadata?: Record<string, unknown>;
}

export interface DatasetDetector {
  /** Changing it re-indexes every dataset indexed under another version. */
  version: string;
  /** A check on the dataset record alone; false records the dataset with no items and lists no files. */
  accepts?(dataset: IndexedDataset): boolean;
  detect(files: DatasetFileEntry[], dataset: IndexedDataset): LoadableItem[];
}

export interface IndexProgress {
  running: boolean;
  projectsTotal: number;
  projectsDone: number;
  datasetsTotal: number;
  datasetsDone: number;
  /** Already indexed under this detector version. */
  datasetsSkipped: number;
  itemsFound: number;
  errors: number;
}

export interface IndexRunOptions {
  /** Default: all the user's projects, the launch project first. */
  projectIds?: string[];
  /** Datasets read at once; default 4. */
  concurrency?: number;
  signal?: AbortSignal;
}

export interface DataIndex {
  /** Indexes what is not yet indexed. A call while a run is in flight returns that run. */
  run(options?: IndexRunOptions): Promise<IndexProgress>;
  readonly progress: IndexProgress;
  onProgress(listener: (progress: IndexProgress) => void): () => void;
  /** Everything found so far, newest dataset first. */
  items(): Promise<FileListRow[]>;
  /** Drops a dataset's rows so the next run reads it again. */
  forget(projectId: string, datasetId: string): Promise<void>;
}

// ---- Development mock ----

export interface MockFile {
  path: string;
  size?: number;
  /** Where the bytes really are (a local dev-server URL); returned as the "signed" URL. */
  url: string;
}

export interface MockDataset {
  id: string;
  name: string;
  processId?: string;
  createdAt?: string;
  tags?: Tag[];
  files: MockFile[];
}

export interface MockProject {
  id: string;
  name: string;
  datasets: MockDataset[];
}

export interface MockFixtures {
  appName: string;
  user?: Partial<AppUser>;
  tenant?: Partial<AppTenant>;
  /** Default: every permission. */
  permissions?: AppPermission[];
  launch?: LaunchContext;
  projects: MockProject[];
}
