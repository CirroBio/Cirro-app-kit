# Troubleshooting

Check the registration before changing code. Open it in the Cirro UI, or read it with `data.appRegistrations.getAppRegistration({ id })` (fields: `type`, `clientType`, `redirectUris`, `projectPermissions`, `globalPermissions`, `requiresAdminConsent`, `approvedAt`).

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| "No app is registered in this tenant for <callback URL>" | No discoverable registration in this tenant lists the callback URL the app sends | Have a tenant admin register that exact URL, trailing slash included, with discovery enabled; for local development, set your own registration's client ID in `VITE_CIRRO_CLIENT_ID` |
| "More than one app in this tenant is registered for <callback URL>" | Two discoverable registrations list the same callback URL | Give the app its own path (`base` in `vite.config.ts`) and register that, or ask an admin to remove the URL from the other registration |
| Cirro's authorize page shows an error with your client ID | The development client ID in `.env` is from another tenant, or its registration was deleted | Check `VITE_CIRRO_CLIENT_ID` and that `VITE_CIRRO_URL` is the tenant the registration is in |
| Login page shows `redirect_mismatch` | Redirect URI sent doesn't exactly match a registered one | The template sends its origin plus its path (`base` in `vite.config.ts`); register exactly that. Watch for `localhost` vs `127.0.0.1` and trailing slashes |
| `Invalid SAML response received: RedirectUri is not registered with the client` | SAML sign-in compares the redirect URI exactly, trailing slash included | Make the registered URI and the one the app sends identical; see [authentication](authentication.md#the-templates-sign-in) |
| Back at the app with `?error=invalid_scope` | The app asked for a scope other than `openid` | Request `openid` only |
| Works for the creator, fails for colleagues | App not yet approved (`approvedAt` empty) | Admin approves the app |
| Back at the app with `?code=` but still signed out | The code exchange failed: the token request's `redirect_uri` differs from the authorize request's, or the code was already used | Use one redirect URI for both (the template does); reload from the app's root rather than the returned URL |
| App says it can't load sign-in settings | `VITE_CIRRO_URL` isn't the tenant's web address | Set it to the address you use for Cirro in the browser, such as `https://app.cirro.bio` |
| Every request goes to `/api/...` on the app's own host | `DataService` created without `basePath` | Set `basePath` to `${VITE_CIRRO_URL}/api` |
| 401 on API calls after login | Token not attached, or expired without renewal | Check the token getter returns the library's current access token; confirm silent renewal works past 15 minutes |
| 403 on some endpoints only | Registered permissions or the user's project role don't cover them | Compare with `cirro-permissions.json`; add the permission to the registration (and re-approve if required), or check the user's role in that project. See [permissions](permissions.md) |
| File reads refused (the file-credentials request answers 401 "Not allowed to …") while API calls work | Wrong access context, or the app or user lacks the permission for it | Use `ProjectFileAccessContext.datasetDownload(project, datasetDetail)` for shared datasets; reading the project's files needs `GENERATE_DOWNLOAD_TOKEN` (and `VIEW_PROJECT`) in the registration and the user's role |
| File reads fail with CORS while API calls work | The request isn't a signed GET or PUT: project buckets accept those from any origin, but not HEAD or an unsigned URL | Read with GET from a URL signed for the file; take its length from the manifest rather than a HEAD request |
| Signed URLs work, then fail after a few minutes | Presigned URL expired (default 5 minutes) | Re-sign on use instead of storing URLs; raise `timeout` for long reads |
| Page says **App not configured** | `.env` values missing | Follow the message; see [getting started](getting-started.md#3-run-the-app-template) |
