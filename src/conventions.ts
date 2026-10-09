// Naming and storage conventions every app shares (CONTRACT.md sections 1, 5 and 6).
import type { Tag } from '@cirrobio/api-client';

const APP_ID = /^[a-z][a-z0-9]*$/;
const TABLE_NAME = /^[a-z][a-z0-9_]*$/;
// The portal's folder-segment characters (packages/ui folder.utils.ts).
const FOLDER_SEGMENT = /^[a-zA-Z0-9 _\-.]+$/;

export const APPS_FOLDER_ROOT = 'Apps';
export const FOLDER_TAG_KEY = 'Folder';
export const APP_TAG_KEY = 'App';
/** The partition column every app table starts with. */
export const USER_ID_COLUMN = 'user_id';

export function isAppId(value: string): boolean {
  return APP_ID.test(value);
}

/** `app_<appId>_<table>`, e.g. `app_proteoscope_history`. */
export function appSheetName(appId: string, table: string): string {
  if (!APP_ID.test(appId)) throw new Error(`Invalid app id "${appId}": use lowercase letters and digits, starting with a letter.`);
  if (!TABLE_NAME.test(table)) throw new Error(`Invalid table name "${table}": use lowercase letters, digits and underscores, starting with a letter.`);
  return `app_${appId}_${table}`;
}

/** Whether `value` can be an app name, which is also a folder name (section 1). */
export function isAppFolderName(value: string): boolean {
  return FOLDER_SEGMENT.test(value.trim());
}

/** `Apps/<App name>/<segments...>`; every segment must be a valid portal folder name. */
export function appFolderPath(appName: string, ...segments: string[]): string {
  const parts = [APPS_FOLDER_ROOT, appName, ...segments].map((s) => s.trim()).filter(Boolean);
  const invalid = parts.find((s) => !isAppFolderName(s));
  if (invalid) throw new Error(`Invalid folder name "${invalid}": use letters, digits, spaces, "_", "-" and ".".`);
  return parts.join('/');
}

export function appFolderTag(appName: string, ...segments: string[]): Tag {
  return { key: FOLDER_TAG_KEY, value: `folder://${appFolderPath(appName, ...segments)}`, editable: true };
}

export function appTag(appId: string): Tag {
  return { key: APP_TAG_KEY, value: appId, editable: true };
}

// ---- Tables ----

export type ColumnType = 'string' | 'number' | 'boolean' | 'timestamp' | 'json';

/**
 * A table's schema. `columns` lists every column except `user_id`, which the store adds
 * first and manages itself; `key` identifies a row within one user's partition.
 */
export interface TableSchema<Row extends object> {
  name: string;
  columns: { [K in keyof Row]-?: ColumnType };
  key: ReadonlyArray<keyof Row & string>;
}

export interface HistoryRow {
  id: string;
  at: string;
  /** What the user did: `open`, `save`, or an app-specific verb. */
  action: string;
  title: string;
  project_id: string | null;
  dataset_id: string | null;
  path: string | null;
  /** The `file_list` kind of what was opened, when it was an indexed item. */
  item_kind: string | null;
  /** App-specific JSON that restores the view. */
  state: unknown;
}

export interface BookmarkRow {
  id: string;
  created_at: string;
  title: string;
  note: string | null;
  project_id: string | null;
  dataset_id: string | null;
  path: string | null;
  item_kind: string | null;
  state: unknown;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface DatasetIndexedRow {
  project_id: string;
  dataset_id: string;
  dataset_name: string;
  indexed_at: string;
  indexer_version: string;
  item_count: number;
  status: 'ok' | 'error';
  error: string | null;
}

export interface FileListRow {
  project_id: string;
  project_name: string;
  dataset_id: string;
  dataset_name: string;
  dataset_created_at: string | null;
  path: string;
  is_folder: boolean;
  kind: string;
  label: string;
  size: number | null;
  /** Files under a folder item; null for files. */
  file_count: number | null;
  metadata: unknown;
  indexed_at: string;
}

export const HISTORY_TABLE: TableSchema<HistoryRow> = {
  name: 'history',
  columns: {
    id: 'string', at: 'timestamp', action: 'string', title: 'string', project_id: 'string',
    dataset_id: 'string', path: 'string', item_kind: 'string', state: 'json',
  },
  key: ['id'],
};

export const BOOKMARKS_TABLE: TableSchema<BookmarkRow> = {
  name: 'bookmarks',
  columns: {
    id: 'string', created_at: 'timestamp', title: 'string', note: 'string', project_id: 'string',
    dataset_id: 'string', path: 'string', item_kind: 'string', state: 'json',
  },
  key: ['id'],
};

export const SETTINGS_TABLE: TableSchema<SettingRow> = {
  name: 'settings',
  columns: { key: 'string', value: 'json', updated_at: 'timestamp' },
  key: ['key'],
};

export const DATASETS_INDEXED_TABLE: TableSchema<DatasetIndexedRow> = {
  name: 'datasets_indexed',
  columns: {
    project_id: 'string', dataset_id: 'string', dataset_name: 'string', indexed_at: 'timestamp',
    indexer_version: 'string', item_count: 'number', status: 'string', error: 'string',
  },
  key: ['project_id', 'dataset_id'],
};

export const FILE_LIST_TABLE: TableSchema<FileListRow> = {
  name: 'file_list',
  columns: {
    project_id: 'string', project_name: 'string', dataset_id: 'string', dataset_name: 'string',
    dataset_created_at: 'timestamp', path: 'string', is_folder: 'boolean', kind: 'string', label: 'string',
    size: 'number', file_count: 'number', metadata: 'json', indexed_at: 'timestamp',
  },
  key: ['project_id', 'dataset_id', 'path'],
};

export const STANDARD_TABLES = [HISTORY_TABLE, BOOKMARKS_TABLE, SETTINGS_TABLE, DATASETS_INDEXED_TABLE, FILE_LIST_TABLE] as const;
