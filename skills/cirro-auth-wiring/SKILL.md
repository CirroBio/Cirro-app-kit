---
name: cirro-auth-wiring
description: Wire Cirro sign-in (OAuth / Cognito) into a browser app so it can call the Cirro API as the signed-in user. Use this whenever someone wants users to log in with their Cirro account, register or configure a Cirro OAuth app (a front-end Public App), pass a client ID to AmplifyAuthProvider, or debug Cirro login errors like redirect mismatch, invalid scope, or 401s after sign-in. Use it even when the user only says "add Cirro login" or "my app needs a Cirro token".
---

# Wiring Cirro sign-in

Read `${CLAUDE_PLUGIN_ROOT}/docs/authentication.md` before writing auth code; it has the flow, the interfaces and the provider setup. Read `${CLAUDE_PLUGIN_ROOT}/docs/app-types-and-registration.md` for the registration side. This skill covers the decisions and checks.

## Decide

1. **Which provider.** The app template's `CirroAuthProvider(clientId)` (`src/auth.ts`, an `AmplifyAuthProvider` subclass): it supports the tenant's SSO, and requests only the `openid` scope, without which sign-in fails with `invalid_scope` (see the authentication doc). If the app wasn't started from the template, copy `src/auth.ts` and the provider setup from it.
2. **Does the registration match the code?** App type matches the architecture; redirect URIs are bare origins for `AmplifyAuthProvider`; permissions cover what the code calls. If you can't see the registration, ask the user for its type, redirect URIs and permissions, or read it with `AppRegistrationsApi.getAppRegistration`.
3. **Where does the client ID come from?** Never hard-coded. One tenant: build-time env (`VITE_CIRRO_CLIENT_ID`). Users in several tenants: a runtime `tenants.json` and a tenant picker, per "Serving more than one tenant" in `${CLAUDE_PLUGIN_ROOT}/docs/connecting-to-tenants.md`.

## Implement

- Create the provider once (module scope or `useMemo`).
- Follow the template's `src/main.tsx` wiring, adapted to the installed library versions; check method signatures against `node_modules/@cirrobio/react-core/dist` if the packages are newer than those in `${CLAUDE_PLUGIN_ROOT}/docs/packages.md`.
- Apply the known-issue workarounds in `${CLAUDE_PLUGIN_ROOT}/docs/packages.md#known-issues` only if the installed versions still need them (try the build first).

## User permissions

Signing in as the user means the app only has the user's access. Most registrations can't read the user's project role (`getUser` is refused without `MANAGE_MEMBERS`), so don't set `fetchUserInfo`. Offer actions, handle 403s, and remember refusals, as described in `${CLAUDE_PLUGIN_ROOT}/docs/permissions.md`, so features degrade instead of failing.

## Verify

Run the four checks in "Checking it works" in the authentication doc. On failure, match the symptom in `${CLAUDE_PLUGIN_ROOT}/docs/troubleshooting.md` before changing code; most failures are registration mismatches.

## Be explicit about what's unconfirmed

If the code depends on anything in `${CLAUDE_PLUGIN_ROOT}/docs/open-questions.md` (for example whether a project bucket allows the production origin), tell the user, rather than presenting it as settled.
