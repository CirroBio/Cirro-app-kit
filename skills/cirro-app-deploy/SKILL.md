---
name: cirro-app-deploy
description: Deploy a Cirro browser app or viewer to production and get it connected to Cirro tenants so users can sign in. Use this whenever someone wants to deploy, host, publish, ship or "go live" with a Cirro app, set production env vars or a Content Security Policy for one, request approval or a connection from a tenant (including the public tenant via support@cirro.bio), serve one app to several tenants with a tenants.json registry, add a new tenant or origin, or asks why a deployed app works for them but not for other users.
---

# Deploying a Cirro app and connecting it to tenants

Facts live in `${CLAUDE_PLUGIN_ROOT}/docs/deployment.md` and `${CLAUDE_PLUGIN_ROOT}/docs/connecting-to-tenants.md`; read both before changing config. This skill is the order of work. A deployed app is only reachable; it is useful once each tenant has connected and approved it, so plan both halves.

## 1. Settle the production shape

Ask only for what the conversation and repo haven't answered:

1. Production origin(s), exactly (scheme, host, port). They become redirect URIs, so settle them before requesting any connection.
2. Which tenants, now and later. One tenant: one build with env vars. Several, or tenants that come and go: a runtime `tenants.json` registry ("Serving more than one tenant" in the tenants doc).
3. Where it is hosted, and whether the host config (headers, rewrites) lives in the repo.
4. Embedded in Cirro, standalone, or both. Embedded viewers are added to a tenant as tools, by Cirro support, not through a registration.

## 2. Build config

- One tenant: set `VITE_CIRRO_API` to the full tenant API URL (`https://<tenant>/api`, never `https://api.<tenant>`) and `VITE_CIRRO_CLIENT_ID` to that tenant's client ID for this app. `/api` only works if the host proxies it or the app runs embedded.
- Several tenants: add `public/tenants.json` and the startup picker from the tenants doc, creating the auth provider (`CirroAuthProvider` from the template's `src/auth.ts`) for the chosen tenant. Client IDs of Public Apps aren't secrets, so the file can be committed.
- `npm run build` must pass.

## 3. Host config

Apply what the deployment doc lists: HTTPS on a registered origin, rewrite unknown paths to `index.html` if the app routes client-side, `frame-ancestors` for embedded viewers, and a CSP started from the doc's template and tightened to the hosts seen in the network tab. Fill the region and Cognito domain from the tenant's `/info/system` (`region`, `auth.endpoint`). Add `'wasm-unsafe-eval'` and `worker-src` only if the app uses WebAssembly readers.

## 4. Pre-flight

Run cirro-app-review (scanner plus security checklist). Don't request connections with HIGH findings open.

## 5. Request connections

For each tenant, draft the request from "What to include" in the tenants doc, filled in from the repo: `cirro-permissions.json`, production origins, the dev registration's client ID if there is one, the scan result, what the app creates and whether data leaves the browser. Address it to support@cirro.bio for the public tenant, or to the tenant's admins (`tenantInfo.contactEmail` from `/info/system`). Give the draft to the user to send; never send it yourself.

Also list the admin-side items only Cirro can do: project bucket CORS for the production origin if the app reads files directly (and the `Range` header for range reads), and, for embedded viewers, adding the tool to the tenant.

## 6. After approval

- Add each tenant's client ID to the build or `tenants.json`.
- Sign in as a second user who isn't the registration's creator; before approval only the creator can sign in, so this is the real test.
- Suggest a connections list in the repo (tenant, client ID, contact, approved permissions); every registration change needs it.

## Changes later

New origins or permissions mean updating the registration in every connected tenant, and permission changes usually mean another review. Batch them, and draft one update per tenant saying what changed and why. When the app is retired, draft requests to archive each registration.

If users other than the creator can't sign in, or file reads fail with CORS while API calls work, check `${CLAUDE_PLUGIN_ROOT}/docs/troubleshooting.md` before changing code: these are nearly always registration or bucket settings.
