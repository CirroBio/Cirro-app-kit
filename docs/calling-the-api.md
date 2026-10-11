# Calling the Cirro API

Create one `DataService` with a base path and a token getter, then call any resource through it.

```typescript
import { DataService, FileService, ApiError } from "@cirrobio/sdk";

export const data = new DataService({
  basePath: import.meta.env.VITE_CIRRO_API,          // see "Base path" below
  tokenGetter: () => authProvider.getAccessToken(),
});
export const files = new FileService(data.file);     // for file access; see files.md

try {
  const projects = await data.projects.getProjects();
  const { data: datasets, nextToken } = await data.datasets.getDatasets({ projectId: projects[0].id, limit: 50 });
} catch (e) {
  if (e instanceof ApiError) console.error(e.message, e.errors);
}
```

The token getter runs before every request, so token renewal stays inside your auth provider. Don't cache token strings yourself.

Inside a `ViewerProvider` tool, use the `dataService` from `useViewerServices()` instead of building your own. In a React app using `AppConfigProvider`, use `useAppConfig().dataService`.

## Base path

`basePath` defaults to `/api`, which only works when the app is served from the Cirro origin, embedded in the Cirro UI, or behind a dev proxy (both templates include one). A standalone app must set the tenant's API URL. Which form is correct for external apps, `https://<tenant>/api` or `https://api.<tenant>`, is [not yet confirmed](open-questions.md).

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

## Errors

The sdk turns any non-2xx response into an `ApiError`, with the server's `message` and a list of field `errors`. Show `message` to users and log `errors`.

`ApiError` doesn't include the HTTP status code (a [known issue](packages.md#known-issues)), so code using `DataService` can't tell a 403 from any other failure. Where the app needs to react to a refusal (hiding a feature, explaining who can fix it), make that call through an API class configured without the sdk's error handler. The generated client then throws a `ResponseError` that carries the response:

```typescript
import { Configuration, ResponseError, ExecutionApi } from "@cirrobio/api-client";

// basePath: the tenant API URL (or /api); authProvider: from useAppConfig()
const raw = new Configuration({ basePath, accessToken: () => authProvider.getAccessToken() });
const execution = new ExecutionApi(raw);

try {
  await execution.runAnalysis({ projectId, runAnalysisRequest });
} catch (e) {
  if (e instanceof ResponseError && e.response.status === 403) {
    // refused by the user's role or the app's registration; see permissions.md
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
