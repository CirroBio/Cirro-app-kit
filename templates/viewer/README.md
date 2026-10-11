# Viewer template

A React + Vite starter for a Cirro viewer built on `ViewerProvider`. It runs embedded in the Cirro UI or standalone, lists the dataset's files, previews the selected one, and saves the selection as tool state.

```bash
cp .env.example .env      # set CIRRO_PROXY_TARGET; VITE_CIRRO_CLIENT_ID for standalone use
npm install
npm run dev
# open http://localhost:5173/?projectId=<id>&datasetId=<id>
```

- Standalone, the viewer needs a client ID and `?projectId=&datasetId=` in the URL; it says what's missing if either is absent. The [app template](../app) shows your project and dataset IDs. See [getting started](../../docs/getting-started.md#4-open-a-dataset-in-the-viewer).
- Leave `VITE_CIRRO_CLIENT_ID` empty for embedded-only viewers.
- Replace the preview in `src/Viewer.tsx` with your rendering. For libraries that fetch files themselves (igv.js, Zarr), see [viewers](../../docs/viewers.md#libraries-that-fetch-files-themselves).
- For embedded use, the host must allow framing by the Cirro origin; see [deployment](../../docs/deployment.md).

`cirro-permissions.json` lists the permissions the template uses. Update it whenever you add API calls, and give it to the admin who registers the app; see [permissions](../../docs/permissions.md).

Two deliberate workarounds for [known package issues](../../docs/packages.md#known-issues): `@aws-amplify/auth` is a direct dependency, and `tsconfig.json` sets `strictFunctionTypes: false`. When bumping versions, run `npm install && npm run build` and drop them if they're no longer needed.
