# Troubleshooting

Check the registration before changing code. Get the app's registration with `new AppRegistrationsApi(config).getAppRegistration({ id })` (fields: `type`, `clientType`, `redirectUris`, `projectPermissions`, `globalPermissions`, `requiresAdminConsent`, `approvedAt`) or open it in the Cirro UI.

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Login page shows `redirect_mismatch` | Redirect URI sent doesn't exactly match a registered one | `AmplifyAuthProvider` uses `window.location.origin`; register the bare origin (scheme, host, port). Watch for `localhost` vs `127.0.0.1` and trailing slashes |
| `invalid_scope` | Library requests a scope the app client doesn't allow | Align scopes in the custom provider, or ask for the registration's allowed scopes to be updated |
| `invalid_client` or "client does not exist" | Client ID from another tenant, or Amplify falling back to Cirro's UI client | Check the env var is set at build time; check the tenant in `VITE_CIRRO_API` matches the registration |
| Works for the creator, fails for colleagues | App not yet approved (`approvedAt` empty) | Admin approves the app |
| Login loop: redirects back and immediately to login again | Callback not processed, or tokens in storage the app can't read | Make sure the redirect handler runs before the first `getAccessToken()`; with custom providers, wait on the callback promise |
| `/info/system` fails before any login | Wrong `apiBasePath`, or CORS on the API for this origin | Use the full tenant API URL; locally, use a dev-server proxy to the tenant |
| Every request goes to `/api/...` on the app's own host | `basePath`/`apiBasePath` left at default `/api` | Set it explicitly in standalone mode |
| 401 on API calls after login | Token not attached, expired without renewal, or wrong pool | Log `await auth.getAccessToken()` length (never the token) and expiry; confirm `forceRefresh()` works |
| 403 on some endpoints only | Registered permissions or the user's project role don't cover them | Compare with `cirro-permissions.json`; add the permission to the registration (and re-approve if required), or check the user's role in that project. See [permissions](permissions.md) |
| File reads 403 while API calls work | Wrong access context, or app lacks the download permission | Use `ProjectFileAccessContext.datasetDownload(project, datasetDetail)` for shared datasets; check permissions |
| File reads fail with CORS while API calls work | Project bucket's CORS doesn't allow this origin | Admin task; not fixable in app code |
| Signed-in user shows no groups | `getCurrentUser()` reads ID-token claims; groups come from `cognito:groups` | Call `forceRefresh()` after group changes |
| Signed URLs work, then fail after a few minutes | Presigned URL expired (default 5 minutes) | Re-sign on use instead of storing URLs; raise `timeout` for long reads |
| Page says **App not configured** or **Viewer not ready** | `.env` values missing, or the viewer opened without `projectId` and `datasetId` | Follow the message; see [getting started](getting-started.md#3-run-the-app-template) |
| Can't tell a 403 from other errors | The sdk's `ApiError` has no status code | Use an API class with a plain `Configuration`; see [calling the API](calling-the-api.md#errors) |
| Vite: "failed to resolve import @aws-amplify/auth" | Known `react-auth` packaging issue | Add `@aws-amplify/auth` as a direct dependency; see [known issues](packages.md#known-issues) |
| TypeScript: `AmplifyAuthProvider` not assignable to `InteractiveAuthenticationProvider` | Known signature mismatch under `strict` | Set `strictFunctionTypes: false`; see [known issues](packages.md#known-issues) |
