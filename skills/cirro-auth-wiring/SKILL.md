---
name: cirro-auth-wiring
description: Wire Cirro sign-in (OAuth / Cognito) into a browser app so it can call the Cirro API as the signed-in user. Use this whenever someone wants users to log in with their Cirro account, register or configure a Cirro OAuth app (a front-end Public App), send users to Cirro's authorize page, or debug Cirro login errors like redirect mismatch, invalid scope, a SAML RedirectUri error, or 401s after sign-in. Use it even when the user only says "add Cirro login" or "my app needs a Cirro token".
---

# Wiring Cirro sign-in

Read `${CLAUDE_PLUGIN_ROOT}/docs/authentication.md` before writing auth code; it has the flow and the template's sign-in. Read `${CLAUDE_PLUGIN_ROOT}/docs/app-types-and-registration.md` for the registration side. This skill covers the decisions and checks.

## Decide

1. **How sign-in works.** Users go to Cirro's authorize page (`<tenant>/authorize`), which shows the app's name and permissions and signs them in; the app exchanges the returned code with PKCE at the token endpoint. Take every endpoint from the tenant's metadata document (`<tenant>/.well-known/oauth-authorization-server`); never hard-code token-server hosts, pools or regions. The app template does this with oidc-client-ts in `src/auth.ts`, configured from the fetched metadata document; for an app not started from the template, copy `src/auth.ts` and the start-up in `src/main.tsx`. Request the `openid` scope only. Never add a client secret: apps in this kit have a client ID alone, and get it from the tenant (next items).
2. **Does the registration match the code?** It's a Public App; its redirect URIs include exactly the callback URL the app sends (origin plus Vite's `base`, trailing slash included), and that URL is unique to the app in the tenant; discovery is enabled for any registration the app finds by callback URL; permissions cover what the code calls. If you can't see the registration, ask the user for its type, redirect URIs and permissions.
3. **Where do the tenant and client ID come from?** The tenant: build-time `VITE_CIRRO_URL`, or a runtime `tenants.json` of tenant addresses and a picker for users in several tenants. The client ID: from the tenant by callback URL (dynamic client registration, `registeredClientId` in the template's `src/auth.ts`); `VITE_CIRRO_CLIENT_ID` only during local development with an App Developer's own registration. Never commit or deploy client IDs. See "Serving more than one tenant" in `${CLAUDE_PLUGIN_ROOT}/docs/connecting-to-tenants.md`.

## Implement

- Create the sign-in (`UserManager`) and the `DataService` once, at start-up, and give `DataService` a token getter that reads the library's current access token.
- Handle the return: finish sign-in when the URL has `code` and `state`, and show the error when it has `error`, rather than redirecting again.
- Keep tokens in the library's storage; never write them to storage, logs or URLs yourself.

## User permissions

Signing in as the user means the app only has the user's access. Most registrations can't read the user's project role (`getUser` is refused without `MANAGE_MEMBERS`), so don't look it up at start-up. Offer actions, handle 403s, and remember refusals, as described in `${CLAUDE_PLUGIN_ROOT}/docs/permissions.md`, so features degrade instead of failing.

## Verify

Run the four checks in "Checking it works" in the authentication doc. On failure, match the symptom in `${CLAUDE_PLUGIN_ROOT}/docs/troubleshooting.md` before changing code; most failures are registration mismatches.
