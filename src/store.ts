// The memory and browser backends of AppDataStore (CONTRACT.md section 5). Both keep rows in
// the page, with the semantics the sheet backend will have, so app code does not change when
// the backend does; the browser backend also writes each table to IndexedDB and reads it back
// when the app loads again.
import {
  appSheetName, BOOKMARKS_TABLE, ColumnType, DATASETS_INDEXED_TABLE, FILE_LIST_TABLE, HISTORY_TABLE, SETTINGS_TABLE, TableSchema,
  USER_ID_COLUMN
} from './conventions';
import type { AppDataStore, AppTable, StoreBackend } from './types';

type StoredRow = Record<string, unknown>;

/** Every table's rows, by sheet name, then by user and key. Stores share one in tests of user partitioning. */
export type MemoryTables = Map<string, Map<string, StoredRow>>;

export function createMemoryStore(appId: string, userId: string, tables: MemoryTables = new Map()): AppDataStore {
  return tableStore('memory', (schema) => memoryTable(appId, userId, schema, tables));
}

/** Where the browser backend keeps one user's rows of each table, by a key naming app, user and table. */
export interface TableStorage {
  load(key: string): Promise<StoredRow[] | undefined>;
  save(key: string, rows: StoredRow[]): Promise<void>;
}

// Writes are batched: indexing upserts a row per dataset, and each save writes the whole table.
const SAVE_DELAY_MS = 500;

/**
 * A store whose tables outlive the page, in `storage` (IndexedDB by default). The app's
 * browser storage is shared by every Cirro user who signs in on this browser (CONTRACT.md
 * section 8), so each table is kept under its user's id.
 */
export function createBrowserStore(appId: string, userId: string, storage: TableStorage = indexedDbStorage()): AppDataStore {
  return tableStore('browser', (schema) => {
    const key = `${appSheetName(appId, schema.name)}/${userId}`;
    return memoryTable(appId, userId, schema, new Map(), {
      load: storage.load(key),
      save: (rows) => storage.save(key, rows),
    });
  });
}

/** A store whose tables `open` makes, once per table name. */
export function tableStore(backend: StoreBackend, open: <Row extends object>(schema: TableSchema<Row>) => AppTable<Row>): AppDataStore {
  const opened = new Map<string, AppTable<object>>();
  const table = <Row extends object>(schema: TableSchema<Row>): AppTable<Row> => {
    let existing = opened.get(schema.name);
    if (!existing) {
      existing = open(schema) as AppTable<object>;
      opened.set(schema.name, existing);
    }
    return existing as AppTable<Row>;
  };
  return {
    backend,
    history: table(HISTORY_TABLE),
    bookmarks: table(BOOKMARKS_TABLE),
    settings: table(SETTINGS_TABLE),
    datasetsIndexed: table(DATASETS_INDEXED_TABLE),
    fileList: table(FILE_LIST_TABLE),
    table,
  };
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;

const VALUE_CHECKS: Record<Exclude<ColumnType, 'json'>, (value: unknown) => boolean> = {
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  boolean: (value) => typeof value === 'boolean',
  timestamp: (value) => typeof value === 'string' && ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value)),
};

interface Persistence {
  /** The rows saved before, read once when the table opens. */
  load: Promise<StoredRow[] | undefined>;
  save(rows: StoredRow[]): Promise<void>;
}

function memoryTable<Row extends object>(
  appId: string, userId: string, schema: TableSchema<Row>, tables: MemoryTables, persistence?: Persistence
): AppTable<Row> {
  const sheetName = appSheetName(appId, schema.name);
  const columns = Object.entries(schema.columns) as Array<[string, ColumnType]>;
  const key: readonly string[] = schema.key;
  if (USER_ID_COLUMN in schema.columns) throw new Error(`${schema.name}: "${USER_ID_COLUMN}" is the store's own column; leave it out of the schema.`);
  if (!key.length || key.some((column) => !(column in schema.columns))) throw new Error(`${schema.name}: every key column must be a column.`);

  const stored = tables.get(sheetName) ?? new Map<string, StoredRow>();
  tables.set(sheetName, stored);
  const listeners = new Set<(rows: Row[]) => void>();

  const keyOf = (values: object): string => JSON.stringify([userId, ...key.map((column) => {
    const value = (values as StoredRow)[column];
    if (value === undefined || value === null) throw new Error(`${schema.name}: the key column "${column}" is not set.`);
    return value;
  })]);

  /** The row as stored, under its key; throws before anything is written when the row does not fit the schema. */
  const toEntry = (row: Row): [string, StoredRow] => {
    const out: StoredRow = { [USER_ID_COLUMN]: userId };
    for (const [column, type] of columns) {
      const value = (row as StoredRow)[column];
      if (value === undefined || value === null) out[column] = null;
      else if (type === 'json') out[column] = structuredClone(value);
      else if (VALUE_CHECKS[type](value)) out[column] = value;
      else throw new Error(`${schema.name}.${column} must be a ${type}, not ${JSON.stringify(value)}.`);
    }
    return [keyOf(out), out];
  };

  const toRow = (row: StoredRow): Row => {
    const out: StoredRow = {};
    for (const [column, type] of columns) out[column] = type === 'json' ? structuredClone(row[column]) : row[column];
    return out as Row;
  };

  const mineStored = (): StoredRow[] => [...stored.values()].filter((row) => row[USER_ID_COLUMN] === userId);
  const mine = (): Row[] => mineStored().map(toRow);

  // Rows saved before are put back as they were written; a column the schema has since
  // dropped is left out, one it has added reads as null, and a row that no longer fits is
  // dropped. Saved rows are a cache of what the app can find again, so a table that cannot
  // be read starts empty.
  const restore = (rows: StoredRow[] | undefined): void => {
    for (const row of rows ?? []) {
      try {
        stored.set(...toEntry(toRow(row)));
      } catch {
        // A column changed type since the row was saved.
      }
    }
  };
  const ready: Promise<void> = persistence
    ? persistence.load.then(restore, (error: unknown) => console.warn(`${sheetName} could not be read from this browser.`, error))
    : Promise.resolve();

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleSave = (): void => {
    if (!persistence || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      // The rows stay in the page either way; a failed write costs only reading them again next load.
      persistence.save(mineStored()).catch((error: unknown) => console.warn(`${sheetName} could not be saved in this browser.`, error));
    }, SAVE_DELAY_MS);
  };

  // Listeners run as microtasks, each with its own copy, so a throwing or mutating
  // listener cannot affect the write or the other listeners.
  const deliver = (listener: (rows: Row[]) => void): void => {
    const snapshot = mine();
    queueMicrotask(() => {
      if (listeners.has(listener)) listener(snapshot);
    });
  };
  const changed = (): void => {
    listeners.forEach(deliver);
    scheduleSave();
  };

  return {
    name: schema.name,
    sheetName,
    async list() {
      await ready;
      return mine();
    },
    async get(values) {
      await ready;
      const row = stored.get(keyOf(values));
      return row ? toRow(row) : null;
    },
    async upsert(row) {
      await ready;
      stored.set(...toEntry(row));
      changed();
    },
    async upsertMany(many) {
      await ready;
      const entries = many.map(toEntry);
      for (const entry of entries) stored.set(...entry);
      if (entries.length) changed();
    },
    async remove(values) {
      await ready;
      if (stored.delete(keyOf(values))) changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      void ready.then(() => deliver(listener));
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const DATABASE = 'cirro-apps';
const OBJECT_STORE = 'tables';

/** One IndexedDB database for every app on the origin, one record per table and user. */
export function indexedDbStorage(): TableStorage {
  let database: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => {
    database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(OBJECT_STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database;
  };
  const run = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const store = (await open()).transaction(OBJECT_STORE, mode).objectStore(OBJECT_STORE);
    return new Promise((resolve, reject) => {
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };
  return {
    load: (key) => run('readonly', (store) => store.get(key) as IDBRequest<StoredRow[] | undefined>),
    save: async (key, rows) => {
      await run('readwrite', (store) => store.put(rows, key));
    },
  };
}
