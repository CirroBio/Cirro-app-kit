---
name: cirro-sheets
description: Use Cirro Sheets as a browser app's database, storing structured records in relational tables inside the user's Cirro project with SheetsApi from @cirrobio/api-client. Use this whenever a Cirro app needs to save, curate or query structured data (sample registries, annotations, QC or review decisions, inventories, result tables), design a sheet schema, create views or joins, run SQL over project tables, bulk-load a file into a sheet, change a sheet's columns, or when someone asks where a front-end-only Cirro app should keep its data, even if they say "database", "table" or "store records" rather than "sheets".
---

# Cirro Sheets as an app's database

Read `${CLAUDE_PLUGIN_ROOT}/docs/sheets.md` before writing Sheets code; it has the concepts, complete examples and patterns. Look up method and field names in `${CLAUDE_PLUGIN_ROOT}/reference/api-surface.md` (`SheetsApi`), checking the installed version first as cirro-data-access describes.

## 1. Is a sheet the right store?

Use the doc's "When an app should use a sheet" table. Not for secrets, per-user UI preferences (every project member can see rows), large binary data (datasets), or high-frequency writes.

Not every tenant has sheets: read `tenantInfo.features.sheetsEnabled` from `/info/system` and gate the feature on it. If the target tenant lacks them (the public tenant did as of 2026-10-12), say so and offer the doc's fallback of tagged dataset snapshots.

## 2. Design the schema with the user

Propose, and get agreement on, before writing code:

- One namespace for everything the app owns (`my_app`), and table names. Look sheets up by `namespaceName` + `tableName` at runtime; never store sheet IDs, which differ per project and tenant.
- Columns with types, `required`/`unique`, and `allowedValues` for enums. Link Cirro objects with `CIRRO_DATASET`/`CIRRO_FILE`/`CIRRO_FOLDER` columns rather than copying paths; a `CIRRO_DATASET` value is `cirro:<tenantId>:<projectId>:dataset:<datasetId>`, not a bare ID.
- Relationships (`foreignKey`) and any views the UI needs.
- `created_by` and `updated_at` columns if row history matters, plus the app tag on every sheet.

## 3. Write the code

- Call Sheets as `data.sheets` on the app's `DataService`, never by constructing `SheetsApi`. Tell the user that browsers can't call the Sheets routes from another origin until Cirro fixes their CORS preflight (see the Sheets doc), and make sheet features degrade when a call fails with a network error.
- Write a find-or-create function like the doc's `ensureReviewSheet`, run once per project.
- Read with `querySheetData` and a structured `filter`. Use `queryData` (raw SQL) only for aggregates; never interpolate user input into SQL, and validate any user-chosen column or value against an allow-list.
- Update with partial `updateSheetData` keyed by `_row_id`; re-read before acting on a row, since people edit sheets in the Cirro UI too.
- More than a few hundred rows: ingest a file (`triggerIngest`, then poll `getJobs` and show `errorMessage`) rather than inserting in a loop. The upload location for ingest is an open question; say so if the user needs it.

## 4. Schema changes

Send the complete target definition to `updateSheet` with `dryRun: true` first and show the user the returned changes before applying. Add columns rather than renaming them: people's views and queries depend on names.

## 5. Permissions

Add what the code uses to `cirro-permissions.json` from the doc's permissions table: read-only apps need `VIEW_SHEET` and `VIEW_SHEET_DATA` (plus `SHEET_RAW_QUERY` for SQL). Handle a 403 on writes by switching to a read-only mode, since a user's project role may allow reading but not writing. See cirro-permissions.
