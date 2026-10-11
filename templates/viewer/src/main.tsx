import React from "react";
import ReactDOM from "react-dom/client";
import { ViewerProvider } from "@cirrobio/react-tool";
import { CirroAuthProvider } from "./auth";
import { Viewer } from "./Viewer";

const api = (import.meta.env.VITE_CIRRO_API ?? "").trim();
const clientId = (import.meta.env.VITE_CIRRO_CLIENT_ID ?? "").trim();

// Embedded in the Cirro UI, the viewer gets everything from the host page.
// Standalone, it needs its own client ID and the project and dataset in the URL.
const embedded = window.self !== window.top;
const params = new URLSearchParams(window.location.search);
const problems: string[] = [];
if (!embedded) {
  if (!api) problems.push("VITE_CIRRO_API is not set. Use /api in development (with CIRRO_PROXY_TARGET), or your tenant's API URL.");
  if (!clientId) problems.push("VITE_CIRRO_CLIENT_ID is not set. Standalone viewers need a registered app; see docs/getting-started.md.");
  if (!params.get("projectId") || !params.get("datasetId")) {
    problems.push("Open the viewer with ?projectId=<id>&datasetId=<id> in the URL. The app template shows the IDs of your projects and datasets; see docs/getting-started.md.");
  }
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
if (problems.length) {
  root.render(
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 640 }}>
      <h1>Viewer not ready</h1>
      <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
    </main>
  );
} else {
  // Created once. Embedded viewers use the Cirro session, so an empty client ID is fine there.
  const auth = new CirroAuthProvider(clientId || undefined);
  root.render(
    <React.StrictMode>
      <ViewerProvider apiBasePath={api || "/api"} authProvider={auth} patchFetch>
        <Viewer />
      </ViewerProvider>
    </React.StrictMode>
  );
}
