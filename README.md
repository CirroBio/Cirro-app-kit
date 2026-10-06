# @cirrobio/app-kit

The app side of Cirro Apps: what a Cirro-tools app uses to talk to Cirro when the
portal hosts it at `/apps/<appId>`. It receives the user's session from the portal,
calls the Cirro API with `@cirrobio/api-client`, reads and writes dataset files, keeps
the app's own data in per-user tables, and indexes what the user can open.

[`CONTRACT.md`](CONTRACT.md) is the specification shared by the portal (the host), this
kit, Cirro-tools (packaging) and the apps. The portal imports this package for the
protocol types and guards, so both sides of the wire compile against one definition.

## Vendoring the kit

Apps vendor a build of the kit rather than fetching it at runtime (CONTRACT.md section 8).
Build it with `yarn build` in this package, copy the files below into the app, and record
the kit version you copied (`KIT_VERSION`, also in the first line of the single-file
build) next to them.

- **Bundled apps** (Vite, webpack, ...): add `@cirrobio/api-client` (`^0.13`) as a
  dependency and vendor the ESM build, `dist/index.esm.js`, with its declarations,
  `dist/types/`. The simplest way is to copy this package's `package.json` and `dist/`
  into e.g. `vendor/cirro-app-kit/` and install that folder
  (`npm install ./vendor/cirro-app-kit`): `import { ... } from '@cirrobio/app-kit'` then
  resolves to the ESM build and its types.
- **No-build apps**: vendor `dist/cirro-app-kit.js`, one ES module with the API client
  inlined and no other imports, and load it with
  `import { ... } from './vendor/cirro-app-kit.js'`.
- **Every app** also vendors `dist/cirro-app-mode.js` (1 KB, no imports): `hostedMode()`
  alone. The app imports it at boot and loads the full kit only when the page is hosted,
  so a page opened on its own never downloads or parses the kit.

The kit needs a secure context (`https://` or `localhost`) for WebCrypto, which the
portal's origin always is.

## Connecting

Whether the page is hosted is known synchronously from its URL, so an app opened on its
own never waits for a handshake and never loads the kit.

```js
import { hostedMode } from './vendor/cirro-app-mode.js';

const mode = hostedMode(); // 'portal' (in the portal's iframe), 'mock', or null
let session = null;
if (mode) {
  const { connectToCirro, HostConnectionError } = await import('./vendor/cirro-app-kit.js');
  try {
    session = await connectToCirro({
      appId: 'proteoscope',
      appVersion: '0.7.0',
      // Only used with ?cirro-app=mock (see "Development mock" below).
      mock: () => import('./dev/fixtures.js').then((m) => m.default),
    });
  } catch (error) {
    if (!(error instanceof HostConnectionError)) throw error;
    showNotice('Could not reach Cirro; local files still work.');
  }
}
```

`connectToCirro` says hello to the portal until it answers with the session, and rejects
with `HostConnectionError` after `timeoutMs` (10 s by default). On a page that is not
hosted (`hostedMode()` is null) it throws: check `hostedMode()` first.

The session (`AppSession` in [`src/types.ts`](src/types.ts)) has:

- `user`, `tenant`, `app`, and `launch`, what the portal asked the app to show first
  (`projectId`, `datasetId`, `path`; every field optional).
- `permissions` and `can(permission)`: what the app may do here (CONTRACT.md section 4).
- `api`: the generated clients (`projects`, `datasets`, `files`, `metadata`, `processes`,
  `sheets`, `execution`) with the user's token. A request the app's permissions do not
  cover throws `AppPermissionError` before it is sent; a failed request throws
  `CirroApiError` with the API's own message and `status`.
- `files`, `store` and links back into the portal, below.
- `getAccessToken()` for anything else that needs the token; it is refreshed through the
  portal 60 s before it expires.
- `dispose()` stops listening to the portal and drops cached credentials.

```js
const projects = await session.api.projects.getProjects();
const { data } = await session.api.datasets.getDatasets({ projectId: projects[0].id });
```

### Links into the portal

```js
session.portalUrl({ kind: 'dataset', projectId, datasetId }); // an absolute portal URL
session.openInPortal({ kind: 'dataset', projectId, datasetId }); // a new tab by default
session.openInPortal({ kind: 'app', appId: 'cytoweave', launch: { projectId } }, { newTab: false });
session.reportContext({ projectId, datasetId, path }, 'model_0.cif'); // portal URL and tab title follow
```

`reportContext` is advisory: the portal rewrites its own query string so that reloading
it reopens what the user is looking at. Outside the portal it does nothing.

### Signing in without the portal

An app that signs the user in itself (outside the portal) can still use the kit:

```js
import { createAppSession } from './vendor/cirro-app-kit.js';

const session = createAppSession({
  init: {
    app: { id: 'cytoweave', name: 'CytoWeave' },
    user: { id: username, email, name },
    tenant: { id: tenantId, name: tenantName },
    apiBasePath: 'https://tenant.cirro.bio/api',
    portalOrigin: 'https://tenant.cirro.bio',
    accessToken,
    accessTokenExpiresAt, // epoch ms
    permissions: ['projects:read', 'datasets:read', 'files:read', 'datasets:write'],
    launch: {},
  },
  // Called when the token is within 60 s of expiring; concurrent callers share one call.
  refreshToken: async () => ({ accessToken: next.accessToken, accessTokenExpiresAt: next.expiresAt }),
});
```

Its `mode` is `standalone`; portal links open with `window.open`.

## Files

Paths are relative to the dataset root, as in its file listing (Cirro keeps uploaded
files under `data/`).

```js
const files = await session.files.list(projectId, datasetId); // [{ path, size, metadata }]
const url = await session.files.signedUrl({ projectId, datasetId, path }); // presigned GET; Range requests work
const text = await session.files.readText({ projectId, datasetId, path });
const blob = await session.files.read({ projectId, datasetId, path }, { signal });
```

- `list` reads the dataset manifest once per dataset and session. The manifest returns at
  most 20 000 files per call (the API's default `fileLimit`), so the kit pages it by
  `fileOffset` until it has `totalFiles`, as the portal does. On dev, the largest
  datasets checked (18 050 and 15 954 files) come back whole in one page.
- `signedUrl` presigns an S3 GET with a short-lived token: `PROJECT_DOWNLOAD`, or
  `SHARED_DATASET_DOWNLOAD` for a dataset shared into the project. Tokens are reused
  until 5 minutes before they expire. A URL lasts `expiresInSeconds` (default 3600), and
  never past its token. After a dataset's first URL, signing is local (WebCrypto), so
  signing many URLs (e.g. zarr chunks) is cheap.

### Saving to Cirro

```js
const created = await session.files.createDataset({
  projectId,
  name: 'Lymphocyte gating',
  description: 'Gates for panel 3',
  folder: ['Workspaces'], // under Apps/<App name>/
  files: [{ path: 'gating.cwz', body: blob, contentType: 'application/zip' }],
}, { onProgress: ({ filesDone, filesTotal, currentFile }) => {}, signal });
// { projectId, datasetId, name, portalUrl }
```

The dataset is tagged `App: <appId>` and filed under `Apps/<App name>/<folder...>`
(CONTRACT.md section 6); `tags` adds more. Its ingest type is Cirro's "Files"
(`FILES_PROCESS_ID`, `custom_dataset`) unless `processId` names another. Files upload one
at a time with presigned PUTs; Cirro completes the dataset when all of them have
arrived, and lists them under `data/` (`gating.cwz` above is read back as
`data/gating.cwz`). Datasets are immutable once complete, so saving again creates a new
dataset. Aborting after the dataset is created leaves it incomplete in Cirro.

## App data

`session.store` holds the app's tables, each partitioned by user (CONTRACT.md section 5):
the kit writes `user_id` on every row and reads only the user's rows, and app code never
sees it.

```js
await session.store.bookmarks.upsert({ id, created_at: new Date().toISOString(), title, note: null,
  project_id, dataset_id, path, item_kind: 'structure', state: { camera } });
const recent = await session.store.history.list();
const unsubscribe = session.store.bookmarks.subscribe((rows) => render(rows));
```

- Standard tables: `history`, `bookmarks`, `settings`, `datasetsIndexed`, `fileList`
  (schemas in [`src/conventions.ts`](src/conventions.ts)). Declare more with
  `store.table({ name, columns, key })`; the same name always returns the same table.
- `upsert` replaces the whole row with the same key; `get` and `remove` need every key
  column. Values are checked against the column types (`timestamp` is ISO 8601 text);
  unset columns are `null`. `json` values are copied on the way in and out.
- `subscribe` calls the listener with all rows (asynchronously) and again after every
  change, until you call the function it returns.
- In v1 the store keeps rows in memory: they are gone when the app reloads. The sheet
  backend (`createSheetStore`, `sheetInputFor`) is a stub whose data methods throw
  `SheetStoreUnavailableError` until Cirro has tenant-level sheets private to each user.

## Discovery

`createDataIndex` walks the user's projects and finds everything the app can open, so
users never dig through projects themselves (CONTRACT.md section 7). The app supplies a
detector:

```js
import { createDataIndex } from './vendor/cirro-app-kit.js';

const index = createDataIndex(session, {
  version: '1', // change it to re-index every dataset
  accepts: (dataset) => dataset.processId !== 'paired_dnaseq', // optional; false skips listing files
  detect: (files, dataset) => files
    .filter((f) => /\.(cif|pdb)(\.gz)?$/i.test(f.path))
    .map((f) => ({ path: f.path, isFolder: false, kind: 'structure', label: f.path.split('/').pop(), size: f.size, fileCount: null })),
});
index.onProgress((p) => showProgress(p.datasetsDone, p.datasetsTotal));
session.store.fileList.subscribe((rows) => renderGallery(rows));
await index.run(); // { projectsTotal, datasetsDone, datasetsSkipped, itemsFound, errors, ... }
const items = await index.items(); // file_list rows, newest dataset first
```

- The launch project is indexed first; within a project, the newest datasets first. Only
  completed datasets are indexed; others are picked up once they complete.
- A dataset already indexed under the detector's `version` is skipped (datasets are
  immutable). One that failed is recorded with `status: 'error'` and retried next run.
- At most `concurrency` datasets (default 4) are read at once. `run({ signal })` stops on
  abort and rejects with the abort reason; `run()` during a run returns that run.
  `run({ projectIds })` indexes only those projects.
- Progress is reported after every dataset, and the rows land in
  `session.store.fileList` as they are found, so a gallery subscribed to it fills in
  while indexing runs. `datasetsDone` and `itemsFound` include skipped datasets.
- `index.forget(projectId, datasetId)` drops a dataset so the next run reads it again.

## Development mock

Open the app with `?cirro-app=mock` to get a session over fixtures the app supplies through
`ConnectOptions.mock`, with no portal and no sign-in:

```js
export default {
  appName: 'Proteoscope',
  launch: { projectId: 'p1', datasetId: 'd1' },
  permissions: ['projects:read', 'datasets:read', 'files:read'], // default: all of them
  projects: [{
    id: 'p1',
    name: 'Structures',
    datasets: [{
      id: 'd1',
      name: 'AF3 run',
      processId: 'custom_dataset',
      createdAt: '2026-09-01T00:00:00Z',
      files: [{ path: 'data/model_0.cif', size: 120000, url: '/dev/fixtures/model_0.cif' }],
    }],
  }],
};
```

The mock answers the API calls the kit makes (projects, a project, dataset listings, a
dataset, its manifest, S3 tokens, uploads) and 404s everything else; the permission guard
still applies. `signedUrl` returns each fixture file's own `url`. Datasets the app creates
are kept in memory, with their files as object URLs, so they show up in later listings
and indexing. `createMockSession(appId, fixtures)` makes the same session directly, e.g.
in an app's own tests. Fixture ids must not contain `/`. Never point fixtures at real
data.

## Development

```bash
yarn build       # dist/: index.js (cjs), index.esm.js, types/, cirro-app-kit.js (single file), cirro-app-mode.js
yarn test
yarn type-check
```
