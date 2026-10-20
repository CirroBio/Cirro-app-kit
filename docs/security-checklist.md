# Security checklist

In a browser app, any script running on your page can use the signed-in user's Cirro token and project file credentials. Most of this checklist is about keeping that set of scripts small and the app's reach narrow. Go through it before the first production deploy, before requesting admin approval, and after changing auth, permissions or file-access code.

## Start with the scanner

```bash
python3 tools/scan.py path/to/your-app
```

It flags likely problems: secrets in code or env files, tokens in web storage or logs, raw HTML rendering, unpinned Cirro packages, and the default API base. Treat each finding as a lead, not a verdict; confirm it in the code. It exits non-zero on any high-severity finding, so it can run in CI.

## Registration

- [ ] Registered as a Public App (the only type this kit uses); the app holds no secret and acts as the signed-in user
- [ ] `cirro-permissions.json` exists, lists every permission the code uses with a reason, and nothing more
- [ ] Optional permissions really are optional: the app works with only the required ones
- [ ] Redirect URIs list only callback URLs you control, each unique to this app; no stale preview URLs or wildcards

## Tokens and credentials

- [ ] No client secret or app credentials of any kind anywhere in the bundle or repo
- [ ] Tokens come from the sign-in library on each call (`tokenGetter`), not cached in app state
- [ ] Tokens and AWS file credentials kept in memory or the sign-in library's storage; never written to storage by your own code, logged, or put in URLs
- [ ] The sign-in library's user is in `sessionStorage` if the app shares its origin with other sites (for example a `github.io` Pages site); only an app on an origin of its own (its own domain or subdomain) keeps it in `localStorage`, which shares the login across tabs and keeps it after the browser closes
- [ ] With the user in `localStorage`, the tenant's Cirro admins have shortened the refresh-token lifetime on the app's client (for example one day rather than Cognito's default 30), since the login now persists on disk; the registration has no field for it
- [ ] Sign-out revokes the refresh token, removes the user from the sign-in library, and clears cached file credentials

## User permissions

- [ ] Every action handles a 403 with a message saying who can fix it, and the UI updates to match
- [ ] Any role checks live in one place, not scattered through the UI
- [ ] Walked through the app as a `COLLABORATOR`-only test user

## Rendering

- [ ] Dataset names, descriptions, metadata and file contents rendered as text; any HTML rendering (for example a dataset's markdown README) goes through a sanitizer

## Third-party code

- [ ] Every third-party script loaded at runtime (analytics, widgets, CDN libraries) reviewed or removed; each one can read tokens
- [ ] Dependencies pinned, Cirro packages to exact versions; `npm audit --omit=dev` has no unaddressed high-severity issues

## Deployment

- [ ] Content Security Policy set at the host, with `connect-src` limited to the Cirro tenant, its token server and S3 (see [deployment](deployment.md#content-security-policy))
- [ ] The host sends `frame-ancestors 'none'`, so other sites can't frame the app
- [ ] Production builds set only `VITE_CIRRO_URL` (the tenant's web address); no client ID is built in, since the app gets it from the tenant
