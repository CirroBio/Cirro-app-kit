# Open questions

Parts of this kit depend on platform behavior that hasn't been confirmed for external apps. Each item says where it matters. When the Cirro platform team confirms one, update the affected docs and remove it here.

| Question | Affects |
| --- | --- |
| Does a registered Public App's client ID belong to the same Cognito user pool `/info/system` reports, so `AmplifyAuthProvider(clientId)` works with it? | Both templates; [authentication](authentication.md) |
| Does a Public App allow every scope `AmplifyAuthProvider` requests, including `aws.cognito.signin.user.admin`? | [Authentication](authentication.md) |
| What is the API base URL for standalone apps: `https://<tenant>/api` (React packages) or `https://api.<tenant>` (Python client)? | [Calling the API](calling-the-api.md); deploy config |
| Do the Cirro API and `/info/system` accept CORS requests from registered external origins? | Standalone apps without a proxy |
| Do project buckets allow CORS from registered app origins, or does each origin need an admin change? | [Files](files.md); standalone viewers |
| What `principalType` does the UI set for a Public App? | Scripted registration in [app types and registration](app-types-and-registration.md) |
| Which permissions do file reads need, and is `GENERATE_DOWNLOAD_TOKEN` among them? | Registration guidance |
| Access-token lifetime and refresh-token rotation for Public Apps | Session behavior |
| Is the image viewer in `Cirro-client-ts` the recommended starting point, and are more examples planned? | [Viewers](viewers.md) |
| Which permissions gate each capability in the [capability map](building-on-cirro.md#capability-map)? The mapping is inferred from permission names | Registration guidance |
| Do discussions of type `NOTES` created through the API appear as notes in the Cirro UI? | [Provenance notes](building-on-cirro.md#provenance-by-default-notes-on-everything-the-app-creates) |
| Can a delegated user token register custom pipelines, or is that limited to admins and maintainers? | [Apps that ship their own pipeline](building-on-cirro.md#an-app-that-ships-its-own-pipeline) |
| What is Cirro's role-to-permission mapping (`OWNER`, `ADMIN`, `CONTRIBUTOR`, `COLLABORATOR`)? Apps need it to gate features before calling | [Permissions](permissions.md#checking-before-offering-an-action) |
| Is an app's effective access the intersection of its registered permissions and the user's role? | [Permissions](permissions.md) |
| Can a 403 response tell the app whether the registration or the user's role refused the action? | [Permissions](permissions.md#the-server-has-the-final-word) |
| Is a user always allowed to read their own `UserDetail` (`getUser` on themselves)? | [Permissions](permissions.md#checking-before-offering-an-action) |
| What is the public Cirro tenant's address, and can developers self-register a test app there before requesting approval? | [Connecting to tenants](connecting-to-tenants.md) |
| How is an embedded viewer added to a tenant as a tool, and who does it? | [Connecting to tenants](connecting-to-tenants.md#embedded-viewers) |
| Can one registration be offered to many tenants (for example through registration templates or `OFFICIAL` publisher status), or must each tenant register separately? | [Serving more than one tenant](connecting-to-tenants.md#serving-more-than-one-tenant) |
| Do sheet writes validate `required`, `unique`, `allowedValues` and foreign keys, and what error comes back when they fail? | [Sheets](sheets.md) |
| Are there transactions, optimistic concurrency or rate limits for sheet writes? | [Sheets](sheets.md#patterns) |
| Where must a file be uploaded for `triggerIngest` (`stagingUploadPath`, `SHEET_UPLOAD` credentials), and which file types are accepted? | [Sheets](sheets.md#bulk-loads) |
| Which permission gates each `SheetsApi` method, and what does `auditReadAccess` do? | [Sheets](sheets.md#permissions) |
| What do sheet mappings to a target entity do once saved? | [Sheets](sheets.md#concepts) |
| Will the sdk's `ApiError` carry the HTTP status code? | [Known issues](packages.md#known-issues) |
