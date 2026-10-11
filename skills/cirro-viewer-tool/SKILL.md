---
name: cirro-viewer-tool
description: Build a Cirro tool or viewer, a React app that shows a Cirro dataset or file, using ViewerProvider from @cirrobio/react-tool. Use this whenever someone wants to visualize or browse Cirro data in a custom web view (genome browsers like JBrowse 2 or igv.js, image viewers, tables, plots, OME-TIFF or Zarr viewers), embed a viewer inside the Cirro UI, run one standalone against a Cirro tenant, or convert an existing static-site viewer that uses baked presigned URLs into one that reads Cirro data live with the user's permissions.
---

# Building a Cirro viewer or tool

Read `${CLAUDE_PLUGIN_ROOT}/docs/viewers.md` first; it covers modes, wiring, state, services and `patchFetch`. New viewers start from `${CLAUDE_PLUGIN_ROOT}/templates/viewer/` (read its README).

## Decide

1. **Embedded, standalone, or both?** Embedded-only viewers use `AmplifyAuthProvider()` without a client ID; standalone needs a registered Public App (see cirro-auth-wiring).
2. **How does the rendering library load data?** If it takes URLs and fetches itself, check whether it uses `fetch` or `XMLHttpRequest`, then follow "Libraries that fetch files themselves" in the viewers doc: `patchFetch` for `fetch` libraries (Zarr, OME-TIFF), an internet account for JBrowse 2, a function-valued track URL for igv.js, a fetch override for `@gmod` readers.
3. **What state should survive sessions?** Persist it through `toolState` / `sendStateUpdate`, not the URL or local storage.

## Build

- Read everything from `useViewerState()`; never parse the URL directly, so the viewer works in both modes.
- Use `useViewerServices()` for API and file calls; see cirro-data-access for method names.
- Run `npm run build` after adding dependencies; apply `${CLAUDE_PLUGIN_ROOT}/docs/packages.md#known-issues` workarounds only if the build needs them.

## Converting an existing static-site viewer

Follow "Converting a static-site viewer" in the viewers doc. Before starting, tell the user what changes: live data under each viewer's own permissions and nothing expiring, in exchange for sign-in (or the Cirro UI) and bucket CORS for standalone origins.

## Test

Standalone with `?projectId=…&datasetId=…&file=…` first, then embedded in Cirro. Check a ranged or indexed file (BAM + BAI) if the viewer uses `patchFetch`.
