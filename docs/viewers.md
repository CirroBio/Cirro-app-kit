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

Viewers like Zarr, OME-TIFF and genome-track readers take a URL and make their own requests, often ranged or relative, so you can't sign each request yourself. How to sign them depends on how the library makes requests.

**Libraries that use `fetch`** (zarrita, geotiff.js): set `patchFetch` on `ViewerProvider` and give the library `getPatchedSignUrl(s3Url)`:

```tsx
import { getPatchedSignUrl } from "@cirrobio/react-tool";
const store = new FetchStore(getPatchedSignUrl(zarr.url));
```

`getPatchedSignUrl` prefixes the S3 URL with `https://sign/`. The patched global `fetch` recognizes the prefix, signs the request with project credentials, and forwards it with its headers, so range requests keep working.

**Libraries that use `XMLHttpRequest`** never pass through the patched `fetch`. igv.js is one (3.8.9 loads through its own `XMLHttpRequest` wrapper), but it accepts a function as a track's `url` and calls it before every request, so each ranged read gets a freshly signed URL:

```tsx
const sign = (file: FileSystemObject) => () => fileService.getSignedUrlFromProjectFile(file);
igv.createBrowser(div, {
  genome: "hg38",
  tracks: [{
    type: "alignment", format: "bam", name: bam.name,
    url: sign(bam),
    // Indexes are read once per track, so one signed URL with a longer timeout (minutes) is enough.
    indexURL: await fileService.getSignedUrlFromProjectFile(bai, { timeout: 60 }),
  }],
});
```

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
