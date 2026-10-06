// The sheet backend of AppDataStore: one Cirro sheet per table (CONTRACT.md section 5).
// A stub: Cirro sheets are project-scoped and visible to the project's members, and app
// tables need tenant-level sheets private to each user (or owner-filtered rows) plus
// upsert-by-key. Until the API has those, this backend knows the sheet each table would be
// (`sheetInputFor`) and every data method fails with SheetStoreUnavailableError.
import { ColumnDataType, SheetCreationMode, TableSheetInput } from '@cirrobio/api-client';
import { appSheetName, ColumnType, TableSchema, USER_ID_COLUMN } from './conventions';
import { SheetStoreUnavailableError } from './errors';
import { tableStore } from './store';
import type { AppDataStore, AppTable } from './types';

/** The portal's sheet namespace (DEFAULT_SHEETS_TABLE_NAMESPACE in src/app/data/services/sheet.service.ts). */
const SHEET_NAMESPACE = 'default';

const COLUMN_DATA_TYPES: Record<ColumnType, ColumnDataType> = {
  string: ColumnDataType.String,
  number: ColumnDataType.Double,
  boolean: ColumnDataType.Boolean,
  timestamp: ColumnDataType.Timestamp,
  // JSON text.
  json: ColumnDataType.String,
};

/** The sheet that would hold a table: `app_<appId>_<table>`, `user_id` first, key columns required. */
export function sheetInputFor<Row extends object>(appId: string, schema: TableSchema<Row>): TableSheetInput {
  const name = appSheetName(appId, schema.name);
  const key: readonly string[] = schema.key;
  const columns = Object.entries(schema.columns) as Array<[string, ColumnType]>;
  return {
    name,
    namespaceName: SHEET_NAMESPACE,
    tableName: name,
    sheetType: 'TABLE',
    sheetCreationMode: SheetCreationMode.Scratch,
    columns: [
      { name: USER_ID_COLUMN, dataType: ColumnDataType.String, required: true },
      ...columns.map(([column, type]) => ({ name: column, dataType: COLUMN_DATA_TYPES[type], required: key.includes(column) })),
    ],
  };
}

const unavailable = (): Promise<never> => Promise.reject(new SheetStoreUnavailableError());

/** The sheet-backed store (stub): its tables reject every data method with SheetStoreUnavailableError. */
export function createSheetStore(appId: string): AppDataStore {
  return tableStore('sheets', <Row extends object>(schema: TableSchema<Row>): AppTable<Row> => ({
    name: schema.name,
    sheetName: appSheetName(appId, schema.name),
    list: unavailable,
    get: unavailable,
    upsert: unavailable,
    upsertMany: unavailable,
    remove: unavailable,
    subscribe() {
      throw new SheetStoreUnavailableError();
    },
  }));
}
