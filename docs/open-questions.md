| Will the API answer the CORS preflight for `/projects/<id>/sheets` routes? It returns 401 there (dev and demo, 2026-10-15), so browser apps can't use sheets. Needs a backend fix. | [Calling the API](calling-the-api.md) |
# Open questions

Parts of this kit depend on platform behavior that hasn't been confirmed for external apps. Each item says where it matters. When the Cirro platform team confirms one, update the affected docs and remove it here.

| Question | Affects |
| --- | --- |
| Will the dynamic client registration endpoint (`/api/auth/register`) answer browsers? Today its CORS preflight returns 404 and its responses carry no `Access-Control-Allow-Origin` (app, demo and dev.cirro.bio, 2026-10-19), so a browser app can't read the client ID it returns | [Serving more than one tenant](connecting-to-tenants.md#serving-more-than-one-tenant) |
| Do project buckets allow CORS from a registered app's production origin on every tenant, or does each origin need an admin change? (On dev.cirro.bio a project bucket answers preflights for any origin, `https://example.org` included, with `Access-Control-Allow-Origin: *` for GET and PUT with `Range`, 2026-10-12; other tenants not checked.) | [Files](files.md) |
| Which permissions do file reads need, and is `GENERATE_DOWNLOAD_TOKEN` among them? | Registration guidance |
| Refresh-token lifetime and rotation for Public Apps (access tokens last 15 minutes: `expires_in` 900 on dev.cirro.bio, 2026-10-12) | Session behavior |
| After a signed-out user signs in to Cirro from the authorize page, are they returned to the consent screen, or must they start the app's sign-in again? (Signed out, `/authorize` sends the user to Cirro's home page to sign in, dev.cirro.bio, 2026-10-15.) | [Authentication](authentication.md#the-flow) |
| Has a full sign-in through the authorize page (consent, Cognito, code exchange in the browser, silent renewal) been run end to end with the app template? The redirect to `/authorize` and browser access to Cognito's token endpoint were checked on dev.cirro.bio, 2026-10-15; the rest wasn't | [Authentication](authentication.md) |
| Can the OAuth metadata document (`/.well-known/oauth-authorization-server`) be served as `application/json`, as RFC 8414 requires? It's `text/json` today (dev.cirro.bio and app.cirro.bio, 2026-10-15), so libraries that load it themselves refuse it and the template fetches it by hand | [Authentication](authentication.md#the-flow) |
| Which permissions gate each capability in the [capability map](building-on-cirro.md#capability-map)? The mapping is inferred from permission names | Registration guidance |
| Do discussions of type `NOTES` created through the API appear as notes in the Cirro UI? (They are created and read back through the API on dev.cirro.bio.) | [Provenance notes](building-on-cirro.md#provenance-by-default-notes-on-everything-the-app-creates) |
| Can a delegated user token register custom pipelines, or is that limited to admins and maintainers? | [Apps that ship their own pipeline](building-on-cirro.md#an-app-that-ships-its-own-pipeline) |
| Which OAuth scopes can a Public App registration allow, and who sets them? (On dev.cirro.bio: only `openid`, and the registration API has no scopes field.) | [Authentication](authentication.md#the-flow) |
| Which registration permission lets an app read the signed-in user's own role? (`getUser` on self is refused with "Not allowed to MANAGE_MEMBERS" for a project-scoped app.) | [Permissions](permissions.md#checking-before-offering-an-action) |
| Can Cirro add registered app origins to workspace servers' `frame-ancestors`, so apps can embed workspaces? (Today: `'self'`, the portal and `http://localhost:8000` only.) | [Workspaces](workspaces.md#handing-the-user-into-the-workspace) |
| What is Cirro's role-to-permission mapping (`OWNER`, `ADMIN`, `CONTRIBUTOR`, `COLLABORATOR`)? Apps need it to gate features before calling | [Permissions](permissions.md#checking-before-offering-an-action) |
| Is an app's effective access the intersection of its registered permissions and the user's role? | [Permissions](permissions.md) |
| Can a 403 response tell the app whether the registration or the user's role refused the action? | [Permissions](permissions.md#the-server-has-the-final-word) |
| Will the public tenant (app.cirro.bio) let developers self-register a test app? (Its `/info/system` reports `appRegistrationsEnabled: false`, 2026-10-12, so today Cirro support registers apps there.) | [Connecting to tenants](connecting-to-tenants.md) |
| Can one registration be offered to many tenants (for example through registration templates or `OFFICIAL` publisher status), or must each tenant register separately? | [Serving more than one tenant](connecting-to-tenants.md#serving-more-than-one-tenant) |
| Do sheet writes validate `required`, `unique`, `allowedValues` and foreign keys, and what error comes back when they fail? (A `CIRRO_DATASET` column does validate its reference format: 400 on a bare ID.) | [Sheets](sheets.md) |
| Are there transactions, optimistic concurrency or rate limits for sheet writes? | [Sheets](sheets.md#patterns) |
| Where must a file be uploaded for `triggerIngest` (`stagingUploadPath`, `SHEET_UPLOAD` credentials), and which file types are accepted? | [Sheets](sheets.md#bulk-loads) |
| Which permission gates each Sheets method? | [Sheets](sheets.md#permissions) |
| What do sheet mappings to a target entity do once saved? | [Sheets](sheets.md#concepts) |
