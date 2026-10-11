# Viewers and tools

A Cirro viewer (or tool) is a React app that shows a dataset or file. Wrap its root component in `ViewerProvider` from `@cirrobio/react-tool`, and it gets tenant config, sign-in, the selected project, dataset and file, the dataset's file list, and ready-made API and file services. Your code only renders.

Start from the [viewer template](../templates/viewer).

## Embedded and standalone modes

The mode is detected automatically:

| | Embedded | Standalone |
| --- | --- | --- |
| Detected by | Running in an iframe | Top-level window |
| Where state comes from | The Cirro UI posts project, dataset, manifest, selected file and S3 credentials | URL query params `projectId`, `datasetId`, `file` |
| API base | Forced to `/api` (same origin as Cirro) | The `apiBasePath` prop: the tenant URL |
| Sign-in | The user's Cirro session | The `authProvider` you pass |

Write viewers to work in both: read everything from `useViewerState()`, never from the URL directly.

## Wiring

```tsx
import { ViewerProvider } from "@cirrobio/react-tool";
import { AmplifyAuthProvider } from "@cirrobio/react-auth";

const auth = new AmplifyAuthProvider(import.meta.env.VITE_CIRRO_CLIENT_ID);  // module scope

export default function Root() {
  return (
    <ViewerProvider apiBasePath={import.meta.env.VITE_CIRRO_API} authProvider={auth} patchFetch>
      <Viewer />
    </ViewerProvider>
  );
}
```

Pass a client ID only if the viewer will run standalone as a registered Public App. Without one, `AmplifyAuthProvider` uses Cirro's own UI client, which is right for viewers that only run embedded.

## Inside the viewer

```tsx
const { project, dataset, files, selectedFile, fileAccessContext, toolState, sendStateUpdate } = useViewerState();
const { dataService, fileService } = useViewerServices();

const res = await fileService.getProjectFile(selectedFile);
const url = await fileService.getSignedUrlFromProjectPath(fileAccessContext, "data/sample1.bam");
```

- `files` is the dataset's file list. Use it for pickers, or to find companion files such as an index next to a BAM.
- `selectedFile` is the file the user opened the viewer on, if any.
- Save UI state (zoom, selected track, filters) as a string with `sendStateUpdate(JSON.stringify(state))`, and restore it from `toolState` on load. The Cirro UI persists it across sessions when the viewer is embedded.

## Libraries that fetch files themselves

Viewers like Zarr, OME-TIFF and genome browsers take a URL and make their own requests, often ranged or relative, so you can't sign each request yourself. How to sign them depends on how the library makes requests.

**Libraries that use `fetch`** (zarrita, geotiff.js): set `patchFetch` on `ViewerProvider` and give the library `getPatchedSignUrl(s3Url)`:

```tsx
import { getPatchedSignUrl } from "@cirrobio/react-tool";
const store = new FetchStore(getPatchedSignUrl(zarr.url));
```

`getPatchedSignUrl` prefixes the S3 URL with `https://sign/`. The patched global `fetch` recognizes the prefix, signs the request with project credentials, and forwards it with its headers, so range requests keep working.

**Genome browsers.** JBrowse 2 (`@jbrowse/react-linear-genome-view2`, verified with 4.3.0) reads every file through an *internet account* when one claims the file's location. Register one in a small runtime plugin that claims `s3://` URIs and signs each request just before it's made. Signing is local once the sdk has project credentials, so it adds no network round trip, and long sessions never meet an expired URL:

```ts
const stateModel = InternetAccount.named("CirroProjectFilesAccount")
  .props({ type: types.literal("CirroProjectFilesAccount"), configuration: ConfigurationReference(configSchema) })
  .views(() => ({ handlesLocation: (loc: UriLocation) => loc.uri.startsWith("s3://") }))
  .actions(() => ({
    async getToken() { return "signed-per-request"; },   // the signed URL is the credential
    getFetcher(loc: UriLocation) {
      return async (_input: RequestInfo | URL, init?: RequestInit) => fetch(await signUrl(loc.uri), init);
    },
  }));
```

Give tracks locations like `{ uri: file.url, locationType: "UriLocation", internetAccountId: "cirro-project-files" }`, where `file.url` is the manifest file's `s3://` URL. Pass the account in `internetAccounts`, the plugin in `plugins`, and create the view **without** a web-worker RPC (the default for `createViewState`): the account's fetcher calls back into the app, which a worker can't do. `signUrl(s3Url)` is `fileService.getSignedUrlFromProjectFile(file)`. A file outside the dataset's manifest (another dataset in the project, or `s3://pubweb-references/…`) signs the same way with `{ url, fileAccessContext: ProjectFileAccessContext.projectDownload({ id: projectId }) }`.

Gotchas:
- **Don't close tracks you'll keep.** Closing a track aborts its reads, and an unindexed file (BED, small VCF) aborted mid-download stays stuck in its adapter. Hide only the tracks that leave; reorder the rest with `view.moveTrackToBottom(track.id)`, which takes the open track's instance `id`, not the configuration's `trackId`.
- **Layout callbacks:** the view measures its width with a resize observer, which doesn't run in a hidden or background tab. `view.initialized` stays false there; that's expected.
- **Whole-file formats** (BedAdapter, VcfAdapter) download the entire file into memory. Prefer indexed files (bigBed, tabix) above a few tens of MB.
- **Figures:** `renderToSvg(view, { rasterizeLayers: false })` from `@jbrowse/plugin-linear-genome-view` returns the view as SVG for the figure builder. Its `viewBox` is wider than its `width`; scale by the viewBox. View highlights (`view.setHighlight`) are not in the SVG (checked in 4.3.0).
- **CSP:** `connect-src` for the project bucket plus the assemblies' hosts (`https://hgdownload.soe.ucsc.edu` for UCSC `.2bit` and contig aliases, `https://jbrowse.org` for the hosted human gene tracks and search indexes). No `worker-src` without the worker RPC.

igv.js (3.8.9) loads through its own `XMLHttpRequest` wrapper, which `patchFetch` never reaches. Instead, give each track's `url` as a function, `() => fileService.getSignedUrlFromProjectFile(file)`; igv calls it before every request. Sign `indexURL` once with a longer `timeout`.

**Libraries with a pluggable fetch.** `@gmod/tabix`, `@gmod/bam` and `@gmod/bbi` read through `generic-filehandle2`'s `RemoteFile`, which takes a `fetch` override, so you can sign each read without patching the global:

```ts
new RemoteFile(file.url, { fetch: async (_url, init) => fetch(await fileService.getSignedUrlFromProjectFile(file), init) });
```

Check which a library uses before promising it works: search its bundle for `XMLHttpRequest` and `fetch(`.

## Converting a static-site viewer

For viewers that ship with presigned URLs or data baked in at build time:

1. Keep the rendering code and remove the build-time data step.
2. Wrap the app in `ViewerProvider` and replace each hard-coded URL with a lookup in `files`, passed through `getPatchedSignUrl` or `fileService.getSignedUrlFromProjectFile`.
3. Replace baked config (which samples, which tracks) with `toolState` plus a picker built from `files`.
4. Test standalone with `?projectId=…&datasetId=…&file=…`, then embedded in Cirro.

The result reads live data under each viewer's own permissions, and nothing expires. In exchange, viewers need sign-in (or the Cirro UI), and standalone viewers need the project bucket's CORS to allow their origin.

## Local development

Run the dev server, then open `http://localhost:5173/?projectId=<id>&datasetId=<id>&file=<path>`, where `file` is relative to the manifest's domain. If the tenant API rejects cross-origin calls from localhost, use the template's dev proxy (`CIRRO_PROXY_TARGET`) with `VITE_CIRRO_API=/api`. Cirro's `Cirro-client-ts` repo includes an image viewer example (`examples/image-viewer`).

## API: ViewerProvider props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `children` | ReactNode | | The viewer |
| `apiBasePath` | string | `/api` | Ignored when embedded (always `/api`) |
| `authProvider` | `InteractiveAuthenticationProvider` | `new AmplifyAuthProvider()` (Cirro UI client) | Pass `new AmplifyAuthProvider(clientId)` for a registered app |
| `patchFetch` | boolean | `false` | Patch global `fetch` to sign `getPatchedSignUrl(...)` URLs |

Internally it nests: viewer state (mode detection, query params or postMessage) → `AppConfigProvider` (loads `/info/system`, configures auth, builds `DataService`) → loader → `AuthenticationContextProvider` → `LoginWrapper` (shows login if signed out) → viewer context (loads project, dataset, manifest; builds `FileService`; patches fetch).

## API: useViewerState(): ViewerState

| Field | Type | Meaning |
| --- | --- | --- |
| `project` | `ProjectDetail \| null` | Current project |
| `dataset` | `DatasetDetail \| null` | Current dataset |
| `basePath` | string | Base path for the dataset's files |
| `selectedFile` | `DownloadableFile?` | File the viewer was opened on |
| `files` | `Assets \| null` | Dataset files (array of `FileSystemObject`; `.totalSize`, `.totalSizeBytes`) |
| `viz` | `DatasetViz[] \| null` | Visualizations declared in the manifest |
| `tables` | `Table[] \| null` | Tables declared in the manifest |
| `artifacts` | `Artifact[] \| null` | Artifacts declared in the manifest |
| `fileAccessContext` | `ProjectFileAccessContext` | Use with `fileService` for arbitrary project paths |
| `toolState` | string? | Opaque state the Cirro UI persisted for this tool |
| `sendStateUpdate` | `(state: string) => void` | Ask the Cirro UI to persist new state (embedded only) |

`FileSystemObject` fields: `id`, `url` (s3://), `path`, `displayPath`, `relativePath`, `name`, `size`, `kind`, `type` (`file` or `folder`), `metadata?`, `fileAccessContext`.

## API: useViewerServices(): ViewerServices

- `dataService`: `DataService` (see [calling the API](calling-the-api.md))
- `fileService`: `FileService` (`getProjectFile`, `getSignedUrlFromProjectFile`, `getSignedUrlFromProjectPath`, `getProjectAccessCredentials`)

When embedded, `fileService` uses the S3 credentials the Cirro UI posted; standalone, it requests them from the API.

## API: Embedded messaging (for reference)

On load in an iframe the tool posts `{ source: 'cirro-tool', payload: { status: 'READY' } }` to the parent and waits for a message `{ credentials, config: { project, dataset, manifest?, file?, state? } }`. `sendStateUpdate` posts `{ source: 'cirro-tool', payload: { type: 'STATE_UPDATE', state } }`. You never handle these directly; they explain what the Cirro UI supplies.

See [known issues](packages.md#known-issues) for an origin-check gap in the message handler.
