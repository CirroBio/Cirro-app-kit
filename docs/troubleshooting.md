# Troubleshooting

Check the registration before changing code. Open it in the Cirro UI, or read it with `data.appRegistrations.getAppRegistration({ id })` ([the release after 0.13.38](packages.md#coming-in-the-next-release); fields: `type`, `clientType`, `redirectUris`, `projectPermissions`, `globalPermissions`, `requiresAdminConsent`, `approvedAt`).

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Cirro's authorize page shows an error with your client ID | Client ID from another tenant, or not a registration in this tenant | Check `VITE_CIRRO_CLIENT_ID` and that `VITE_CIRRO_URL` is the tenant the registration is in |
| Login page shows `redirect_mismatch` | Redirect URI sent doesn't exactly match a registered one | The template sends `window.location.origin` (plus Vite's `base` under a path); register exactly that. Watch for `localhost` vs `127.0.0.1` and trailing slashes |
| `Invalid SAML response received: RedirectUri is not registered with the client` | SAML sign-in compares the redirect URI exactly, trailing slash included | Make the registered URI and the one the app sends identical; see [authentication](authentication.md#the-templates-sign-in) |
| Back at the app with `?error=invalid_scope` | The app asked for a scope other than `openid` | Request `openid` only |
| Works for the creator, fails for colleagues | App not yet approved (`approvedAt` empty) | Admin approves the app |
| Back at the app with `?code=` but still signed out | The code exchange failed: the token request's `redirect_uri` differs from the authorize request's, or the code was already used | Use one redirect URI for both (the template does); reload from the app's root rather than the returned URL |
| `/info/system` fails before any login | `VITE_CIRRO_URL` isn't the tenant's web address | Set it to the address you use for Cirro in the browser, such as `https://app.cirro.bio` |
| Every request goes to `/api/...` on the app's own host | `DataService` created without `basePath` | Set `basePath` to `${VITE_CIRRO_URL}/api` |
| 401 on API calls after login | Token not attached, or expired without renewal | Check the token getter returns the library's current access token; confirm silent renewal works past 15 minutes |
| 403 on some endpoints only | Registered permissions or the user's project role don't cover them | Compare with `cirro-permissions.json`; add the permission to the registration (and re-approve if required), or check the user's role in that project. See [permissions](permissions.md) |
| File reads 403 while API calls work | Wrong access context, or app lacks the download permission | Use `ProjectFileAccessContext.datasetDownload(project, datasetDetail)` for shared datasets; check permissions |
| File reads fail with CORS while API calls work | Project bucket's CORS doesn't allow this origin | Admin task; not fixable in app code |
| Signed URLs work, then fail after a few minutes | Presigned URL expired (default 5 minutes) | Re-sign on use instead of storing URLs; raise `timeout` for long reads |
| Page says **App not configured** | `.env` values missing | Follow the message; see [getting started](getting-started.md#3-run-the-app-template) |
| Can't tell a 403 from other errors | `ApiError` in 0.13.38 has no status code | Match the message ("Not allowed to …"), or use `errorCode` from the next release; see [calling the API](calling-the-api.md#errors) |
