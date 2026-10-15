# Calling the Cirro API

Create one `DataService` with a base path and a token getter, then call any resource through it.

```typescript
import { DataService, FileService, ApiError } from "@cirrobio/sdk";

export const data = new DataService({
  basePath: import.meta.env.VITE_CIRRO_API,          // see "Base path" below
  tokenGetter: () => authProvider.getAccessToken(),
});
export const files = new FileService(data.file);     // for file access; see "Working with files"

try {
  const projects = await data.projects.getProjects();
  const { data: datasets, nextToken } = await data.datasets.getDatasets({ projectId: projects[0].id, limit: 50 });
} catch (e) {
  if (e instanceof ApiError) console.error(e.message, e.errors);
}
```

The token getter runs before every request, so token renewal stays inside your auth provider. Don't cache token strings yourself.

In a React app using `AppConfigProvider`, as the app template does, use `useAppConfig().dataService` instead of building your own.

## Base path

`basePath` defaults to `/api`, which only works when the app is served from the Cirro origin or behind a dev proxy (the app template includes one). A deployed app must set the tenant's API URL, `https://<tenant>/api`. That form answers browsers from any origin (`Access-Control-Allow-Origin: *`, with `Authorization` allowed in preflights), so a deployed app needs no proxy. `https://api.<tenant>`, which the Python client uses, returns the same data without CORS headers, so a browser can't read it. Both verified on dev.cirro.bio and app.cirro.bio, 2026-10-12.

## Resources

`DataService` has one getter per resource: `audit`, `billing`, `computeEnvironments`, `datasets`, `execution`, `file`, `governance`, `metadata`, `processes`, `projectRequests`, `projects`, `references`, `sharing`, `system`, `tools`, `users`, `workspaces`.

A few API classes aren't on it (for example `AppRegistrationsApi`, `DashboardsApi`, and `SheetsApi`, covered in [Sheets](sheets.md)). Construct those directly:

```typescript
import { DashboardsApi } from "@cirrobio/api-client";
import { generateApiConfig } from "@cirrobio/sdk";
const dashboards = new DashboardsApi(generateApiConfig({ basePath, tokenGetter }));
```

Every method takes a single object argument. Method and field names come from a generated client; look them up in the [API reference](../reference/api-surface.md) and [common models](../reference/models.md) rather than guessing. The reference is a snapshot of 0.13.37; to regenerate it for the version you have installed:

```bash
python3 tools/api_surface.py node_modules > api-surface.md
```

## Pagination

List endpoints that page return `{ data, nextToken }`. Pass `nextToken` back to get the next page, and stop when it's empty. In a UI, fetch pages on demand rather than everything up front.

The exception is a list the user searches or filters, which needs every item. `getDatasets` accepts `limit: 1000`; a project of 1,875 datasets came back in two requests in under a second (dev.cirro.bio, 2026-10-12). A dataset's manifest pages differently: `getDatasetManifest` takes `fileOffset` and `fileLimit` and reports `totalFiles`, so ask again from the count received until it is reached.

## Errors

The sdk turns any non-2xx response into an `ApiError`, with the server's `message` and a list of field `errors`. Show `message` to users and log `errors`.

`ApiError` doesn't include the HTTP status code (a [known issue](packages.md#known-issues)), so code using `DataService` can't tell a 403 from any other failure by status. A refused permission does say so in the message, which names the permission ("Not allowed to VIEW_PROJECT_METADATA on project …", seen on dev.cirro.bio), and that's enough to explain a refusal to the user. Where the app needs to react to a refusal (hiding a feature, explaining who can fix it), make that call through an API class configured without the sdk's error handler. The generated client then throws a `ResponseError` that carries the response:

```typescript
import { Configuration, ResponseError, ExecutionApi } from "@cirrobio/api-client";

// basePath: the tenant API URL (or /api); authProvider: from useAppConfig()
const raw = new Configuration({ basePath, accessToken: () => authProvider.getAccessToken() });
const execution = new ExecutionApi(raw);

try {
  await execution.runAnalysis({ projectId, runAnalysisRequest });
} catch (e) {
  if (e instanceof ResponseError && e.response.status === 403) {
    // refused by the user's role or the app's registration; see "Permissions"
  }
  throw e;
}
```

- **401:** no valid session. Check the auth provider.
- **403:** the user or the registered app lacks a permission. Check the registration and the user's project role.
- Don't retry 4xx responses automatically.

## Without the sdk

If you only need the raw client, pass the same token getter as `accessToken`:

```typescript
import { Configuration, ProjectsApi } from "@cirrobio/api-client";
const config = new Configuration({ basePath, accessToken: () => authProvider.getAccessToken() });
const projects = await new ProjectsApi(config).getProjects();
```

You lose the sdk's error mapping and file utilities.
