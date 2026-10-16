# Calling the Cirro API

Create one `DataService` with the tenant's API URL and a token getter, then call everything through it. Don't construct API classes from `@cirrobio/api-client` yourself.

```typescript
import { DataService, FileService, ApiError } from "@cirrobio/sdk";

export const data = new DataService({
  basePath: `${import.meta.env.VITE_CIRRO_URL}/api`,   // see "Base path" below
  tokenGetter: async () => (await signIn.getUser())!.access_token,  // signIn: the template's oidc-client-ts UserManager
});
export const files = new FileService(data.file);       // for file access; see "Working with files"

try {
  const projects = await data.projects.getProjects();
  const { data: datasets, nextToken } = await data.datasets.getDatasets({ projectId: projects[0].id, limit: 50 });
} catch (e) {
  if (e instanceof ApiError) console.error(e.message, e.errors);
}
```

The token getter runs before every request, so token renewal stays inside the sign-in library. Don't cache token strings yourself. The app template creates its `DataService` this way in `src/main.tsx` and passes it to its components.

## Base path

Use the tenant's web address followed by `/api`: `https://<tenant>/api`. It answers browsers from any origin (`Access-Control-Allow-Origin: *`, with `Authorization` allowed in preflights), so the app calls it directly from `localhost` and in production alike. `https://api.<tenant>`, which the Python client uses, returns the same data without CORS headers, so a browser can't read it. Both verified on dev.cirro.bio and app.cirro.bio, 2026-10-12. `basePath` defaults to `/api`, which only works on the Cirro origin itself, so always set it.

Exception, 2026-10-15: the preflight for `/api/projects/<id>/sheets` and its sub-routes returns 401 on dev.cirro.bio and demo.cirro.bio, so browsers can't call the sheets API from another origin, while `/projects` and `/projects/<id>/datasets` pass. A same-origin dev proxy hides this; test sheet calls from the deployed origin, and have the app degrade when they fail with a network error.

## Resources

`DataService` has one getter per area of the API. The ones an app uses: `projects`, `datasets`, `file`, `processes`, `execution`, `metadata`, `references`, `sharing`, `workspaces` and `system`. Not yet on it, and coming in the release after 0.13.38 ([packages](packages.md#coming-in-the-next-release)): `sheets`, `feed` (notes and discussions), `dashboards` and `appRegistrations`.

Every method takes a single object argument. Method and field names come from a generated client; look them up in the [API reference](../reference/api-surface.md) and [common models](../reference/models.md) rather than guessing. The reference is a snapshot of 0.13.38; to regenerate it for the version you have installed:

```bash
python3 tools/api_surface.py node_modules > api-surface.md
```

## Pagination

List endpoints that page return `{ data, nextToken }`. Pass `nextToken` back to get the next page, and stop when it's empty. In a UI, fetch pages on demand rather than everything up front.

The exception is a list the user searches or filters, which needs every item. `getDatasets` accepts `limit: 1000`; a project of 1,875 datasets came back in two requests in under a second (dev.cirro.bio, 2026-10-12). A dataset's manifest pages differently: `getDatasetManifest` takes `fileOffset` and `fileLimit` and reports `totalFiles`, so ask again from the count received until it is reached.

## Errors

The sdk turns any non-2xx response into an `ApiError`, with the server's `message` and a list of field `errors`. Show `message` to users and log `errors`.

A refused permission says so in the message, which names the permission ("Not allowed to VIEW_PROJECT_METADATA on project …", seen on dev.cirro.bio). That's enough to explain a refusal to the user, and to recognise one:

```typescript
const refused = (e: unknown) => e instanceof ApiError && e.message.startsWith("Not allowed to");
```

The release after 0.13.38 adds the HTTP status to `ApiError` as `errorCode` ([packages](packages.md#coming-in-the-next-release)); check `e.errorCode === 403` once you're on it.

- **401:** no valid session. Check the sign-in.
- **403:** the user or the registered app lacks a permission. Check the registration and the user's project role.
- Don't retry 4xx responses automatically.
