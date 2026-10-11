# Open questions

Parts of this kit depend on platform behavior that hasn't been confirmed for external apps. Each item says where it matters. When the Cirro platform team confirms one, update the affected docs and remove it here.

| Question | Affects |
| --- | --- |
| Does a registered Public App's client ID belong to the same Cognito user pool `/info/system` reports, so `AmplifyAuthProvider(clientId)` works with it? | Both templates; [authentication](authentication.md) |
| What is the API base URL for standalone apps: `https://<tenant>/api` (React packages) or `https://api.<tenant>` (Python client)? | [Calling the API](calling-the-api.md); deploy config |
| Do the Cirro API and `/info/system` accept CORS requests from registered external origins? | Standalone apps without a proxy |
| Do project buckets allow CORS from a registered app's production origin, or does each origin need an admin change? (On dev.cirro.bio, `http://localhost` dev origins work for signed GETs, ranged reads and uploads.) | [Files](files.md); standalone viewers |
| What `principalType` does the UI set for a Public App? | Scripted registration in [app types and registration](app-types-and-registration.md) |
| Which permissions do file reads need, and is `GENERATE_DOWNLOAD_TOKEN` among them? | Registration guidance |
| Access-token lifetime and refresh-token rotation for Public Apps | Session behavior |
| Is the image viewer in `Cirro-client-ts` the recommended starting point, and are more examples planned? | [Viewers](viewers.md) |
| Which permissions gate each capability in the [capability map](building-on-cirro.md#capability-map)? The mapping is inferred from permission names | Registration guidance |
| Do discussions of type `NOTES` created through the API appear as notes in the Cirro UI? (They are created and read back through the API on dev.cirro.bio.) | [Provenance notes](building-on-cirro.md#provenance-by-default-notes-on-everything-the-app-creates) |
| Can a delegated user token register custom pipelines, or is that limited to admins and maintainers? | [Apps that ship their own pipeline](building-on-cirro.md#an-app-that-ships-its-own-pipeline) |
| Which OAuth scopes can a Public App registration allow, and who sets them? (On dev.cirro.bio: only `openid`, and the registration API has no scopes field.) | [Authentication](authentication.md#amplifyauthprovider) |
| Which registration permission lets an app read the signed-in user's own role? (`getUser` on self is refused with "Not allowed to MANAGE_MEMBERS" for a project-scoped app.) | [Permissions](permissions.md#checking-before-offering-an-action) |
| Why does `calculatePipelineCost` return `totalCost: null` ("Cost not available") for every pipeline on dev.cirro.bio? | [Building on Cirro](building-on-cirro.md#capability-map) |
| Can Cirro add registered app origins to workspace servers' `frame-ancestors`, so apps can embed workspaces? (Today: `'self'`, the portal and `http://localhost:8000` only.) | [Workspaces](workspaces.md#handing-the-user-into-the-workspace) |
| What is Cirro's role-to-permission mapping (`OWNER`, `ADMIN`, `CONTRIBUTOR`, `COLLABORATOR`)? Apps need it to gate features before calling | [Permissions](permissions.md#checking-before-offering-an-action) |
| Is an app's effective access the intersection of its registered permissions and the user's role? | [Permissions](permissions.md) |
| Can a 403 response tell the app whether the registration or the user's role refused the action? | [Permissions](permissions.md#the-server-has-the-final-word) |
| What is the public Cirro tenant's address, and can developers self-register a test app there before requesting approval? | [Connecting to tenants](connecting-to-tenants.md) |
| How is an embedded viewer added to a tenant as a tool, and who does it? | [Connecting to tenants](connecting-to-tenants.md#embedded-viewers) |
| Can one registration be offered to many tenants (for example through registration templates or `OFFICIAL` publisher status), or must each tenant register separately? | [Serving more than one tenant](connecting-to-tenants.md#serving-more-than-one-tenant) |
| Do sheet writes validate `required`, `unique`, `allowedValues` and foreign keys, and what error comes back when they fail? (A `CIRRO_DATASET` column does validate its reference format: 400 on a bare ID.) | [Sheets](sheets.md) |
| Are there transactions, optimistic concurrency or rate limits for sheet writes? | [Sheets](sheets.md#patterns) |
| Where must a file be uploaded for `triggerIngest` (`stagingUploadPath`, `SHEET_UPLOAD` credentials), and which file types are accepted? | [Sheets](sheets.md#bulk-loads) |
| Which permission gates each `SheetsApi` method, and what does `auditReadAccess` do? | [Sheets](sheets.md#permissions) |
| What do sheet mappings to a target entity do once saved? | [Sheets](sheets.md#concepts) |
| Will the sdk's `ApiError` carry the HTTP status code? | [Known issues](packages.md#known-issues) |
| Does the magic-link handler's `CALLBACK_URLS` include registered Public App origins, so emailed sign-in links can return to an external app? | [Authentication](authentication.md#amplifyauthprovider) |
