// The memory backend of AppDataStore (CONTRACT.md section 5): rows live in the page and are
// gone when it reloads, with the semantics the sheet backend will have, so app code does not
// change when the backend does.
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

function memoryTable<Row extends object>(appId: string, userId: string, schema: TableSchema<Row>, tables: MemoryTables): AppTable<Row> {
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

  const mine = (): Row[] => [...stored.values()].filter((row) => row[USER_ID_COLUMN] === userId).map(toRow);

  // Listeners run as microtasks, each with its own copy, so a throwing or mutating
  // listener cannot affect the write or the other listeners.
  const deliver = (listener: (rows: Row[]) => void): void => {
    const snapshot = mine();
    queueMicrotask(() => {
      if (listeners.has(listener)) listener(snapshot);
    });
  };
  const changed = (): void => listeners.forEach(deliver);

  return {
    name: schema.name,
    sheetName,
    list: async () => mine(),
    async get(values) {
      const row = stored.get(keyOf(values));
      return row ? toRow(row) : null;
    },
    async upsert(row) {
      stored.set(...toEntry(row));
      changed();
    },
    async upsertMany(many) {
      const entries = many.map(toEntry);
      for (const entry of entries) stored.set(...entry);
      if (entries.length) changed();
    },
    async remove(values) {
      if (stored.delete(keyOf(values))) changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      deliver(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
