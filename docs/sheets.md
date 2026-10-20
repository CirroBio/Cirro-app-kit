# Sheets: a relational database in the user's project

Cirro **Sheets** are relational tables that live inside a project: typed columns, keys and relationships between tables, views that join them, and read-only SQL across all of them. People can browse and edit them in the Cirro UI, and pipelines and apps can read and write them through the API.

For an app, that means a database you don't have to run. A browser-only app gets durable, structured, queryable storage with no backend, and the data stays in the user's research environment, under the project's access controls, next to the datasets it describes.

## When an app should use a sheet

| Use a sheet for | Rather than |
| --- | --- |
| Structured records the app creates or curates: sample registries, annotations, review decisions, QC calls, inventories | Your own database, which takes the data out of the user's environment and needs a backend |
| Tabular results people will filter, sort, join and come back to | A CSV inside a dataset, which has to be downloaded and parsed to be used |
| Lookup tables that tie Cirro objects together (sample → dataset → file) | Encoding links in file names or dataset descriptions |
| State that should outlive the app: if the app is replaced, the records stay readable in Cirro | Browser storage, which is per device and invisible to everyone else |

Don't use a sheet for secrets or tokens, per-user UI preferences (every project member with access can see the rows), large binary data (use datasets), or high-frequency writes such as telemetry.

Before offering a feature built on sheets, check that the tenant has them turned on: `tenantInfo.features.sheetsEnabled` from `/info/system`.

## Concepts

| Concept | What it is |
| --- | --- |
| **Sheet** | A table (`sheetType: TABLE`) or a view (`VIEW`) in one project. Identified by an `id`, and also by `namespaceName` + `tableName`, which is how SQL refers to it. |
| **Columns** | Each `ColumnDef` has a `name`, a `dataType` (`STRING`, `INTEGER`, `BIGINT`, `FLOAT`, `DOUBLE`, `BOOLEAN`, `DATE`, `TIMESTAMP`), and optional `required`, `unique`, `allowedValues`, `description`, `displayName` and `hidden`. |
| **Semantic types** | `semanticType` tells Cirro what a column means: `ENUM_SINGLE`/`ENUM_MULTI` (with `allowedValues`), `URL`, `CIRRO_FILE`, `CIRRO_FOLDER`, `CIRRO_DATASET` (links to Cirro objects), and `FOREIGN_KEY`. A `CIRRO_DATASET` value is a Cirro reference, not a bare ID: `cirro:<tenantId>:<projectId>:dataset:<datasetId>`, where `tenantId` is `tenantInfo.id` from `/info/system` (for example `portal`). A bare dataset ID is refused with 400. |
| **Relationships** | A column's `foreignKey: { sheetId, columnName }` points at a column in another sheet, so tables can reference each other. |
| **`_row_id`** | Every row has one. It's the first column of every data response and the key for updates and deletes. |
| **Views** | A `STRUCTURED` view names sheets, joins (`INNER`, `LEFT`, `RIGHT`, `FULL`), columns and a filter; a `RAW` view is a SQL query. Views are materialized: `refreshView` rebuilds one from its source tables. |
| **Ingest** | `triggerIngest` loads a file into a sheet as an asynchronous job, mapping file columns to sheet columns, with `onConflict` set to `ERROR`, `SKIP` or `OVERWRITE` against a `conflictColumn`. `getJobs` reports progress and errors. |
| **Mappings** | Saved column mappings (with optional value translations) from a sheet to a pipeline's inputs, managed with `saveSheetMapping` and `getSheetMappings`. The Cirro web app's pipeline launch form uses them to offer and fill in sheets; nothing else applies them. |

## Using sheets from an app

Sheets are `data.sheets` on the app's `DataService`.

```typescript
import {
  ColumnDataType, SemanticColumnType, SheetCreationMode, SqlSortOrder, FilterOperator,
} from "@cirrobio/api-client";

const sheets = data.sheets;   // data: the app's DataService
```

### Find or create the app's table

Look sheets up by namespace and table name rather than storing IDs: IDs differ between projects and tenants, names don't.

```typescript
const APP_ID = "my-app";
const NAMESPACE = "my_app";
const TABLE = "qc_review";

async function ensureReviewSheet(projectId: string): Promise<string> {
  const existing = (await sheets.getSheets({ projectId }))
    .find((s) => s.namespaceName === NAMESPACE && s.tableName === TABLE);
  if (existing) return existing.id;

  const { id } = await sheets.createSheet({
    projectId,
    sheetInput: {
      sheetType: "TABLE",
      name: "QC review",
      description: "Per-sample QC decisions recorded by My App",
      namespaceName: NAMESPACE,
      tableName: TABLE,
      sheetCreationMode: SheetCreationMode.Scratch,
      tags: [{ key: "cirro-app", value: APP_ID }],
      columns: [
        { name: "sample_id", dataType: ColumnDataType.String, required: true, unique: true },
        { name: "dataset", dataType: ColumnDataType.String, semanticType: SemanticColumnType.CirroDataset },
        { name: "decision", dataType: ColumnDataType.String, semanticType: SemanticColumnType.EnumSingle,
          allowedValues: ["pass", "fail", "rerun"], required: true },
        { name: "reviewed_at", dataType: ColumnDataType.Timestamp },
      ],
    },
  });
  return id;
}
```

### Read, write and query

```typescript
// Page through rows with a filter. Defaults: page 1, limit 1000, ascending.
const failed = await sheets.querySheetData({
  projectId, sheetId,
  sheetDataRequest: {
    limit: 200, page: 1,
    sort: { orderBy: "reviewed_at", order: SqlSortOrder.Desc },
    filter: { column: "decision", operator: FilterOperator.Equals, values: ["fail"] },
  },
});
// failed.columns[0].name === "_row_id"; failed.rows is an array of arrays.

await sheets.insertSheetData({ projectId, sheetId,
  insertRowsRequest: { inserts: [{ values: { sample_id: "S12", decision: "rerun",
                                            dataset: `cirro:${tenantId}:${projectId}:dataset:${datasetId}` } }] } });

// Partial update: only the listed columns change.
await sheets.updateSheetData({ projectId, sheetId,
  updateRowsRequest: { updates: [{ rowId: 42, values: { decision: "pass" } }] } });

await sheets.deleteSheetData({ projectId, sheetId, deleteRowsRequest: { rowIds: [42] } });

// Read-only SQL across the project's sheets.
const summary = await sheets.queryData({ projectId, sheetQueryRequest: {
  query: "SELECT decision, count(*) AS n FROM my_app.qc_review GROUP BY decision",
} });
```

Writes are checked against the column definitions: a missing `required` value, a duplicate in a `unique` column, a value outside `allowedValues`, or a malformed Cirro reference is refused with 400 and a message naming the column, and the whole insert or update is rolled back. Foreign keys aren't checked on writes, so check them in the app if they matter.

Prefer `querySheetData` with a structured `filter` for anything built from user input. If you must use `queryData` with user input, validate it against an allow-list (column names, enum values) rather than interpolating it into the SQL string. Queries are read-only and stay inside the project, but a crafted query can still read any sheet in it the user can see, which may be more than your app means to show.

### Bulk loads

For more than a few hundred rows, write a file and ingest it rather than inserting in a loop:

1. Upload the file under the sheet's `stagingUploadPath` (from `getSheet`), with file credentials for the sheet (`ProjectAccessType.SHEET_UPLOAD` with the sheet's ID; see [working with files](files.md)). Parquet, CSV, JSON and XLSX are accepted; from an XLSX file only the first worksheet is read.
2. Start the job with `triggerIngest`: a `fileDef` with the file's type and its `s3://` URI under the staging path, optional `sourceColumns` mapping file columns to sheet columns, and an `onConflict` rule (`ERROR`, `SKIP` or `OVERWRITE` against a `conflictColumn`). A request that's wrong (a path outside the staging folder, a missing required column) is refused straight away with 400.
3. Poll `getJobs`. A job that fails reports `FAILED` with an `errorMessage`; show it. Each ingest runs as a single transaction, so a failed one leaves the sheet unchanged.

### Changing the schema

`updateSheet` is idempotent: send the complete target definition and the server applies the difference (renames, column changes, view definitions). Pass `dryRun: true` first; for tables it returns the `ALTER` statements that would run, which you can show to the user before applying. Treat the schema like an API other people depend on: add columns rather than renaming them, because people's views and queries refer to them by name.

## Patterns

- **Give the app its own namespace.** Put every sheet the app owns under one `namespaceName` (for example `my_app`), so its tables are easy to find and never collide with people's own sheets.
- **Link, don't copy.** Store references to Cirro objects in `CIRRO_DATASET`, `CIRRO_FILE` and `CIRRO_FOLDER` columns rather than copying data or paths into the sheet.
- **Leave provenance.** Tag sheets the app creates with the [app tag](building-on-cirro.md#tag-everything-the-app-creates) and attach a note, as for any other object the app creates (see [provenance by default](building-on-cirro.md#provenance-by-default-notes-on-everything-the-app-creates)). For row-level history, add `created_by` and `updated_at` columns and fill them in.
- **Let pipelines and the app share tables.** A pipeline can write results into a sheet that the app then filters and annotates, and a view can join them with the app's own tables. Pin the schema to the same release as the pipeline (see [an app that ships its own pipeline](building-on-cirro.md#an-app-that-ships-its-own-pipeline)).
- **Assume other writers.** People can edit sheets in the Cirro UI while your app is open. Rows have no version numbers, and when two writes to a sheet collide the later one fails with a 500; re-read before acting on a row, write partial updates, retry a failed write once after re-reading, and show what changed.
- **Expect sheets you didn't make.** If the app reads sheets people created, read `columns` from `getSheet` and adapt rather than hard-coding a layout.

## Permissions

Declare what you need in the app's [permission manifest](permissions.md):

| Permission | Lets the app |
| --- | --- |
| `VIEW_SHEET` | List sheets, read their definitions, mappings and ingest jobs |
| `VIEW_SHEET_DATA` | Read rows (`getSheetData`, `querySheetData`) |
| `SHEET_RAW_QUERY` | Run SQL with `queryData` |
| `CREATE_SHEET` | Create tables and views (plus `SHEET_RAW_QUERY` for a view defined by SQL) |
| `EDIT_SHEET` | Change schemas, views and mappings; refresh views; trigger ingest and upload its files |
| `EDIT_SHEET_DATA` | Insert, update and delete rows |
| `DELETE_SHEET` | Delete sheets |

An app that only reads should ask for the first two, plus `SHEET_RAW_QUERY` if it runs SQL. As with the rest of the platform, which roles can do these things is the user's project role, so a COLLABORATOR may be able to read a sheet but not write to it; handle the 403 and offer a read-only mode ([degrading gracefully](permissions.md#degrading-gracefully)). Collaborators can read sheets and run SQL; contributors can also create sheets and edit them and their rows; deleting a sheet takes an admin.
