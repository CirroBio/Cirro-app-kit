# Cirro Apps contract (v1)

An **app** is a Cirro-tools tool that runs as an independent website inside the portal
at `/apps/<appId>`, acting as the signed-in user with the user's own permissions. This
document is the contract between the four parties that make that work. Every party
implements its side against this file; where this file and an implementation disagree,
the implementation is the bug.

| Party | Repo | Owns |
|---|---|---|
| **Host** | Cirro-portal (`src/`) | the app catalog, the `/apps` routes, the host side of the protocol, admin configuration |
| **Kit** | Cirro-portal (`packages/app-kit`, `@cirrobio/app-kit`) | the app side of the protocol, the API client, file access, app data storage, indexing |
| **Packaging** | Cirro-tools (`tools/<toolId>`) | building each app into a static bundle served at `/tools/<toolId>/` |
| **App** | cytoweave, proteoscope, spatial-data-studio | the user experience, built on the kit |

The executable half of this contract is `src/protocol.ts`, `src/permissions.ts`,
`src/conventions.ts` and `src/types.ts`. The host and the kit both import them, so the
two sides of the wire compile against one definition.

---

## 1. Identity

- **App id**: `^[a-z][a-z0-9]*$` (no `_`, no `-`), and equal to the Cirro-tools tool id
  that serves it. It names the route (`/apps/<appId>`), the tool (`/tools/<appId>/`) and
  every storage object the app owns (`app_<appId>_<table>`). The underscore ban keeps
  sheet names parseable.
- **App name**: the display name, e.g. `Spatial Data Studio`. It names the app's dataset
  folder root (`Apps/<App name>/`), so it is limited to the portal's folder-segment
  characters `[A-Za-z0-9 _.-]`.

- **App ids are global and never reused**: an app that is withdrawn keeps its id
  (section 10).

The catalog comes from the app registry (section 10). Its first three apps:

| App id | App name | Tool |
|---|---|---|
| `cytoweave` | CytoWeave | `tools/cytoweave` |
| `proteoscope` | Proteoscope | `tools/proteoscope` |
| `spatialdatastudio` | Spatial Data Studio | `tools/spatialdatastudio` |

## 2. Launching

The user opens `/apps/<appId>`, optionally with a **launch context** in the query string:

```
/apps/<appId>?projectId=<id>&datasetId=<id>&path=<path within the dataset>
```

The host renders the app in an iframe whose `src` is

```
/tools/<appId>/index.html?cirro-app=1
```

- The `cirro-app` parameter tells the app, synchronously at boot, whether it is hosted, so
  it never waits on a handshake when opened standalone. `cirro-app=1` means hosted by the
  portal; `cirro-app=mock` (development only) means the dev mock (section 9). Any other
  value, or none, means not hosted. Apps decide with the kit's `hostedMode()`, which
  reads `1` as hosted only inside a frame.
- `/tools/*` is served from the portal's own origin (CloudFront in deployed tenants, the
  Vite proxy to `VITE_TOOLS_ENDPOINT` locally). **Same origin is a requirement**: the
  host hands the app an access token, and does so only to a same-origin frame.
- The launch context is not put on the iframe URL; it travels in the `init` message.

## 3. Host protocol

All messages go through `window.postMessage` with `targetOrigin = location.origin`. A
receiver ignores any message whose `event.origin` is not its own origin, whose
`event.source` is not the expected window (the host: its iframe's `contentWindow`; the
app: `window.parent`), or that fails the guards in `protocol.ts` (`isAppMessage`,
`isHostMessage`). Unknown `type`s and other `version`s are ignored, not errors.

Envelope: `{ source: 'cirro-app' | 'cirro-app-host', version: 1, type, ... }`.

### App → host

| type | fields | meaning |
|---|---|---|
| `hello` | `appId`, `appVersion`, `kitVersion` | I am loaded and want a session. Re-sent every 250 ms until `init` arrives. `appVersion` is the app's own claim, shown but not trusted; `kitVersion` is null for an app that does not use the kit. |
| `token-request` | `requestId` | My access token expires soon; send a fresh one. |
| `navigate` | `target`, `newTab` | Open a portal page (a project, a dataset, another app). |
| `context` | `context`, `title` | I am now showing this; reflect it in the portal URL and tab title. |

### Host → app

| type | fields | meaning |
|---|---|---|
| `init` | `session` (`AppSessionInit`) | Your session. Sent in reply to every `hello`. |
| `token` | `requestId` (or `null` when pushed), `accessToken`, `accessTokenExpiresAt` | A fresh access token. |
| `token-error` | `requestId`, `message` | No token is available (the user signed out). |

### Sequence

```
app                                   host (/apps/<appId>)
 |-- hello ------------------------------>|  resolve the app, running version, permissions
 |<------------------------------- init --|  token, user, tenant, launch, permissions
 |   ... API calls with the token ...     |
 |-- token-request (60 s before expiry) ->|  authProvider.getAccessToken()
 |<------------------------------ token --|
 |-- context (user opened a dataset) ---->|  setSearchParams(replace), document.title
 |-- navigate (open dataset in portal) -->|  window.open / router navigate
```

- The host answers `hello` only for the app it hosts: `app.id` in `init` is the catalog
  id, and the kit rejects an `init` for another app. The host may delay mounting the
  iframe until it can answer.
- The kit treats a token as expiring 60 s before its `exp`. It asks with
  `token-request`; the host answers with a token valid for at least 2 minutes
  (refreshing its own session first if needed), and may also push a `token` unprompted.
- A `token-request` unanswered for 10 s fails the pending API call with
  `HostConnectionError`.
- If `init` does not arrive within the connect timeout (default 10 s), `connectToCirro`
  rejects with `HostConnectionError`; the app shows that it could not reach Cirro and
  keeps its standalone features.
- A `hello` after a session is established (the app reloaded inside the frame) gets a
  fresh `init`.
- `context` is advisory. The host rewrites only `projectId`, `datasetId` and `path` in
  its own query string (with `replace`, so it does not grow the history), and sets the
  tab title to `<title> · <App name>` when a title is given. Reloading the portal URL
  therefore reopens what the user was looking at. An app reports `context` once it shows
  something; until then the portal URL keeps the launch context.
- Permissions and the launch project are resolved once, when the app loads. A later
  `context` changes the portal URL (and the `launch` of any later `init`) but never
  re-gates or re-scopes the running app.
- A `navigate` to the app that is already open only changes the portal URL; an app moves
  between its own views itself.

## 4. Permissions

An app asks for permissions in its manifest (section 12); the tenant admin reviews and
allows them (section 10); the host sends the **effective** set in `init`.

| Permission | Covers |
|---|---|
| `projects:read` | list the user's projects and read a project |
| `datasets:read` | list datasets; read a dataset, its file listing, samples and sample sheet; query project files; read pipeline definitions |
| `files:read` | read dataset file contents (`PROJECT_DOWNLOAD` and `SHARED_DATASET_DOWNLOAD` S3 tokens); also needs `datasets:read`, since the kit reads the dataset's listing and share status first |
| `datasets:write` | create datasets (upload) and edit a dataset's name, description and tags |
| `sheets:read` | read sheets and query their rows |
| `sheets:write` | create sheets and insert, update and delete rows (also `SHEET_UPLOAD` tokens) |
| `pipelines:run` | launch an analysis |

`permissionForRequest(method, path, body)` in `permissions.ts` maps every API request
the model covers to the one permission it needs, and returns `null` for everything
else. **Unmapped requests are denied**, so adding an endpoint to an app is an explicit
change to this table.

Effective permissions = what the running version requests ∩ what the tenant admin
allowed. An app that is not enabled in its launch project, or (launched without a
project) not enabled in any project the user can see, is not loaded: the host shows why
instead of the iframe (section 10).

**Enforcement in v1 is cooperative.** The kit installs `permissionForRequest` as API
client middleware and throws `AppPermissionError` before an uncovered or ungranted
request leaves the app. The backend still applies the user's own Cirro permissions to
every call, so an app can never do more than its user. But the app holds the user's
token and shares the portal's origin, so a hostile app could bypass the kit. Real
per-app limits need both of these, and are future work:
1. serving apps from an isolated origin (or a sandboxed frame without
   `allow-same-origin`), so they cannot read the portal's session;
2. tokens scoped to the app (e.g. a delegated `AppRegistration` per app), or the host
   proxying API calls and checking each one.

The same holds for project scope: an app is gated by its launch project, but once
loaded it can reach every project its user can, including ones it is not enabled in.

## 5. App data storage

Apps keep their own state (history, bookmarks, settings, discovery indexes) in
**tables**. The kit's `AppDataStore` is the only way apps touch them.

- **One sheet per table**, named `app_<appId>_<table>`, e.g. `app_proteoscope_history`
  or `app_spatialdatastudio_file_list` (`appSheetName` in `conventions.ts`).
  Table names match `^[a-z][a-z0-9_]*$`.
- **Every table is partitioned by user.** Its first column is `user_id` (the user's
  Cirro `username`). The kit writes it on every insert and filters on it on every
  read; app code never sees or sets it, so one user's rows cannot leak into another
  user's app.
- **Column types** are `string`, `number`, `boolean`, `timestamp` (ISO 8601 text) and
  `json` (any JSON value, stored as text). Nullable unless part of the key.
- **Keys**: each table declares the columns that identify a row within one user's
  partition. `upsert` replaces the row with the same key.
- **Subscriptions**: `subscribe` delivers asynchronously, the table's rows first and then
  again after every change.

### Standard tables

Every app gets these five (`STANDARD_TABLES` in `conventions.ts`). Apps may declare
more with `store.table(schema)`.

| Table | Key | Columns (after `user_id`) |
|---|---|---|
| `history` | `id` | `id`, `at`, `action`, `title`, `project_id`, `dataset_id`, `path`, `item_kind`, `state` |
| `bookmarks` | `id` | `id`, `created_at`, `title`, `note`, `project_id`, `dataset_id`, `path`, `item_kind`, `state` |
| `settings` | `key` | `key`, `value`, `updated_at` |
| `datasets_indexed` | `project_id`, `dataset_id` | `project_id`, `dataset_id`, `dataset_name`, `indexed_at`, `indexer_version`, `item_count`, `status`, `error` |
| `file_list` | `project_id`, `dataset_id`, `path` | `project_id`, `project_name`, `dataset_id`, `dataset_name`, `dataset_created_at`, `path`, `is_folder`, `kind`, `label`, `size`, `file_count`, `metadata`, `indexed_at` |

`state` (history, bookmarks) is whatever the app needs to restore a view, e.g. a
camera, a display, a gate selection: references and view parameters, never file
contents, and at most 64 KB of JSON. `path` is relative to the dataset root, as in the
dataset's file listing; folders have no trailing slash, and a folder item whose path is
`''` is the dataset root.

### Backends

- **Browser (v1 default).** Rows live in the page and are written to the browser's
  IndexedDB (database `cirro-apps`, one record per table and user, keyed
  `app_<appId>_<table>/<user id>`), so they survive a reload on the same browser. The
  same semantics as the sheet backend, so app code does not change when the backend does.
  Saved rows are a cache: a row that no longer fits its schema is dropped, and a table
  that cannot be read starts empty.
- **Memory.** The same, without the IndexedDB writes. The dev mock (section 9) uses it,
  since its datasets are made up afresh on every load.
- **Sheets (stub).** The intended home is one Cirro sheet per table, private to each
  user, at the tenant level. Cirro sheets today are project-scoped and visible to the
  project's members, so the backend cannot honor that yet. The kit ships the sheet
  backend's schema mapping (`sheetInputFor`, tested) and a store whose data methods
  throw `SheetStoreUnavailableError`. What it needs from the API: tenant-scoped sheets
  readable and writable only by their owner (or owner-filtered rows), plus
  upsert-by-key.

## 6. Datasets an app creates

Outputs an app saves to Cirro (a workspace, a figure, an exported table) become
ordinary datasets in a project the user picks, and are organized with folders:

- Every dataset an app creates carries a folder tag under the app's root,
  `folder://Apps/<App name>/<subfolder...>` (the portal's folder convention, built by
  `appFolderTag`), and the tag `{ key: 'App', value: '<appId>' }` (`appTag`).
- Each app documents its subfolders. Keep them few and meaningful, by kind of output
  first, e.g. `Apps/CytoWeave/Workspaces`, `Apps/Proteoscope/Figures`.
- Its files are listed under `data/`: a file saved as `workspace.cwz` is read back as
  `data/workspace.cwz`.
- Datasets are immutable once complete, so "saving again" creates a new dataset; the
  app links versions through history, not by overwriting.

## 7. Discovery

Each app shows the user everything in Cirro it can open, without the user knowing
where it is. The kit's `DataIndex` does the walking; the app supplies a
`DatasetDetector` that recognizes its loadable items.

1. List the user's projects (or the ones the app asks for), the launch project first.
2. List each project's datasets, newest first. Only `COMPLETED` datasets are indexed;
   others are skipped without a record, so they are picked up once they complete. A
   project that cannot be listed is skipped and counted in `errors`; an
   `AppPermissionError` fails the run.
3. Skip datasets already in `datasets_indexed` with the detector's current `version`.
   Datasets are immutable, so a dataset is read once per detector version.
4. For the rest (bounded concurrency, default 4): if `detector.accepts(dataset)` is
   false, record it with zero items without listing files; otherwise list its files
   and call `detector.detect(files, dataset)`.
5. Write the detected items to `file_list` and one row to `datasets_indexed`.
6. A dataset that fails is handled by whether it will fail again (`isLastingFailure`):
   - **Lasting** (the API refused it, e.g. 403 or 404; or the detector could not make
     sense of its files): recorded with `status: 'error'`, the message and no items, and
     skipped like any indexed dataset. It is read again only when the detector's
     `version` changes or the app runs with `retryFailed` (the user asked to retry).
   - **Passing** (the network dropped, the session lapsed, the server answered 429 or
     5xx, or the run was aborted): no record, so the next run reads it again.
7. When an app cannot **open** an item it found, it calls `recordFailure(projectId,
   datasetId, error)`. A lasting failure is recorded as in step 6 and the dataset's items
   leave `file_list`, so the gallery stops offering what cannot open.
8. Report progress after every dataset, so the app's gallery fills in as indexing runs.
   `datasetsFailed` counts the failed datasets skipped or found in this run; the gallery
   says how many there are and offers to retry them.

The index lives in the app's store (section 5), so with the browser backend each
dataset is read once per user, browser and detector version, not once per visit.

Items can be files or folders (`is_folder`): a `.zarr` store or a structure-prediction
output folder is one item. `kind` is the app's own vocabulary (`fcs`, `structure`,
`zarr-folder`, ...).

## 8. Packaging (app ↔ Cirro-tools)

- The app is a static bundle that runs from any path prefix: relative asset URLs, no
  server of its own. Cirro-tools serves it at `/tools/<appId>/`.
- **In hosted mode an app makes no requests to a server of its own**, root-absolute or
  relative. Root-absolute same-origin requests belong to the Cirro API (`/api/...` on the
  portal origin is Cirro's backend), and a relative URL resolves under `/tools/<appId>/`,
  i.e. the CDN. The app reaches Cirro only through the kit. Features that need the app's
  own server are hidden or degrade, with a reason the user can read.
- A tool that is also a file viewer (proteoscope) keeps its viewer integration inert
  whenever `hostedMode()` would return a mode.
- Every app shares the portal's origin, and so its browser storage (localStorage,
  IndexedDB, OPFS) across every Cirro user who signs in on that browser. Anything an app
  keeps there while hosted is keyed by `session.user.id`.
- Standalone behavior is unchanged: when not hosted (section 2) the app runs exactly as
  it did before, and the kit is never initialized.
- The kit is vendored, not fetched at runtime: bundled apps install
  `@cirrobio/api-client` and import the kit's ESM build; no-build apps vendor the
  single-file bundle `dist/cirro-app-kit.js` (the kit with the API client inlined).
  Either way the vendored copy records the kit version it came from.
- Every app also vendors `dist/cirro-app-mode.js` (`hostedMode()` alone, no imports),
  checks it at boot, and loads the full kit only when hosted, so a page opened on its own
  never downloads the kit.
- If `/tools/*` is served with a Content-Security-Policy, its `connect-src` must allow
  the S3 hosts the kit presigns for (`*.s3.dualstack.<region>.amazonaws.com`) and any
  public service an app calls directly (Proteoscope: RCSB, AlphaFold DB, UniProt).

## 9. Development

- With `cirro-app=mock`, `connectToCirro({ ..., mock })` returns a session built with
  `createMockSession(appId, fixtures)` from the fixtures the app supplies through
  `ConnectOptions.mock`. The mock answers the API calls the kit makes from the fixtures,
  signs file URLs by returning each fixture file's own URL, and records created datasets
  in memory. It exists so app UIs can be built and checked without a portal or a
  sign-in. Never ship fixtures that point at real data.
- Packaging check: served by Cirro-tools' `pnpm serve:tools`,
  `/tools/<appId>/index.html?cirro-app=mock` makes no requests outside `/tools/<appId>/`
  except fixture files and public CORS services (`serve:tools` logs them).
- Local end-to-end: build the tool in Cirro-tools, serve it at
  `http://localhost:8001/tools/<appId>/`, set `VITE_TOOLS_ENDPOINT=http://localhost:8001`
  in the portal's `.env.local`, and open `http://localhost:8000/apps/<appId>`.

## 10. Registry and enablement

Who may offer an app, to whom, and where it is turned on. This is the design the backend
is to implement; until then the portal mocks it (`src/app/data/services/app-registry.service.ts`,
kept in the browser's localStorage) behind the screens described here.

### Records

| Record | Set by | Fields |
|---|---|---|
| Developer account | itself (email sign-in on the registry site) | email, name |
| Organization | its admins | name, admins, members |
| App | its owner: a user, or any admin or member of the owning organization | id, `toolId`, name, description, logo, provider, license (SPDX id or `commercial`), support contact, visibility (`private` / `public`), state (`active` / `withdrawn`) |
| Version | owner; review by Cirro | version, manifest (section 12), bundle name, size and sha-256, check results, review state (public apps) |
| Tenant grant | owner, private apps only | tenant URL, scope (`all` / `selected` + project ids) |
| Version assignment | owner, any app | tenant URL, version |
| Tenant installation | tenant admin | scope (`all` / `selected` + project ids), `reviewedPermissions`, `allowedPermissions`, `runningVersion` |
| Project opt-out | project admin | project id |

### Releases

- **Private apps** are released to the tenants the owner grants, each for all projects
  or listed ones, without review.
- **Public apps** are released to every tenant, for all projects, once Cirro has
  approved one of their versions; each later version is reviewed too.
- **Version offered to a tenant:** the owner's version assignment for it if any.
  Otherwise the newest approved version (public apps) or the newest version (private
  apps). An assigned version of a public app that Cirro has not approved is labeled
  as not reviewed.

### Installation

A tenant admin adds an app from the catalog of public apps, or by typing a private
app's exact id (no suggestions). An id that is not released to the tenant gets the same
answer as one that does not exist.

- **Scope:** all projects, or selected ones. Either way, only projects the release
  covers.
- **Permissions:**
  - The admin reviews the version's requested permissions and allows some or all of
    them.
  - `reviewedPermissions` records what they have seen; `allowedPermissions` records
    what they allowed.
- **Running version:** the installation runs `runningVersion`.
  - When the offered version changes, the installation moves to it at once if
    everything it requests has been reviewed.
  - Otherwise it keeps the old version, and the admin sees an update waiting for
    review.
- **When a release is withdrawn or narrowed,** the installation remains, shown as no
  longer available or with the projects it lost.

### The rule

```
enabled(app, project) = app active
                    AND released to the tenant, covering the project
                    AND installed, covering the project
                    AND not opted out in the project
                    AND (running version's requested ∩ allowedPermissions) is not empty
launchable(app)       = enabled in at least one project the user can see
```

An app opened from a project needs `enabled(app, project)`; one opened without a project
needs `launchable(app)`. Project admins (and tenant admins, who are project admins
everywhere) may opt an app out of their project; the tenant admin sees opt-outs but
does not override them.

The whole Apps feature is a preview, on by default: users can turn it off in **Account →
Developer Settings** (stored in the browser) until there is a tenant feature flag for it.

## 11. Shared UX vocabulary

The three apps look like themselves, but they speak about Cirro the same way:

- **Start screen** — what a hosted app shows when nothing is open: a full page, not a
  dialog, led by **Open from Cirro**, with **Upload…** beside it. Standalone apps keep
  their own start screens.
- **Open from Cirro** — the data browser: **Recent** (history), **Bookmarks**, and
  **In Cirro** (the discovery gallery, with indexing progress, a project filter, and
  "N could not be read · Retry" when datasets have failed). Reachable from a menu once
  something is open. While indexing adds items, a card stays where it was first shown
  (`createStableOrder`).
- **Upload…** — a hosted app's way to open local files: choosing them opens the save
  dialog (folder prefilled `Apps/<App name>/Uploads`), the files become a dataset, and
  the app then opens the local copy, recording the new dataset in history so Recent
  reopens it from Cirro.
- **Save to Cirro** — the save dialog: project, dataset name, folder (prefilled under
  `Apps/<App name>/`), description; reports the new dataset with a link to it. A button
  in the app's main toolbar whenever something is open, not only in a menu.
- **Bookmark** — a star on whatever is open; restores the view, not just the file.
- **Open in Cirro** — a link from anything loaded to its dataset in the portal.
- Standalone, local files keep working ("Open file…") as before. Hosted, they go
  through **Upload…**, so what the user works on is in Cirro.

## 12. Manifest, versions and packing

Every bundle has `cirro-app.json` at its root (`MANIFEST_FILE`). The kit exports its
type (`AppManifest`) and checker (`checkManifest`), which the registry runs on upload and
the CLI runs before packing.

```json
{
  "id": "cytoweave",
  "name": "CytoWeave",
  "version": "0.9.0",
  "entry": "index.html",
  "permissions": ["projects:read", "datasets:read", "files:read", "datasets:write"],
  "opens": [{ "extension": "fcs", "label": "Flow cytometry" }, { "extension": "cwz" }],
  "description": "Flow cytometry analysis in the browser.",
  "homepage": "https://github.com/robert-mcdermott/cytoweave",
  "license": "Apache-2.0"
}
```

| Field | Rule |
|---|---|
| `id` | the app id (section 1) |
| `name` | the app name (section 1), no spaces at either end |
| `version` | semantic version; each upload must be greater than the app's previous versions (`compareVersions`) |
| `entry` | the page the portal loads, a path inside the bundle |
| `permissions` | what the app asks for (section 4), each once |
| `opens` | file types the portal offers to open with the app: lowercase extension without the dot, optional label; may be empty |
| `description`, `homepage`, `license` | optional strings; `license` is an SPDX id or `commercial` |

Unknown fields are errors, so a misspelled field is caught.

- **`init.session.app.version`** is the version the host runs for the tenant (section
  10); null in the dev mock. In the portal demo it is a label: Cirro-tools serves one
  build per tool, whatever the version.
- **Packing:**
  - `cirro-app init <dir>` starts an app from the kit's template (`templates/vanilla`),
    with the kit's builds vendored and the folder's name as its app ID.
  - `cirro-app validate [dir]` checks the manifest and that `entry` exists.
  - `cirro-app pack [dir] [--out file]` then writes `<id>-<version>.zip` with every
    file but dotfiles, manifest at the root, deterministic bytes.
  - The CLI ships in this package (`bin/cirro-app.mjs`) and needs only Node.
