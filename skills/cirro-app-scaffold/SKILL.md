---
name: cirro-app-scaffold
description: Start a new browser app, portal, dashboard or viewer that runs on Cirro data, with sign-in, API access and deployment config set up correctly from the first commit. Use this whenever someone wants to create, bootstrap or set up a new Cirro frontend, React app, data portal, or external tool that signs users in with Cirro, or asks how to structure such a project, which Cirro packages to install, or what to register before building. Use it even for a quick prototype; the registration and config choices are hard to change later.
---

# Scaffolding a Cirro app

Facts live in the repo's docs; this skill is the order of work and the decisions. Read the docs named at each step rather than relying on memory.

## 1. Settle five questions

If the app's purpose is still open (what it creates, whether it needs compute, a workspace hand-off, sharing), read `${CLAUDE_PLUGIN_ROOT}/docs/building-on-cirro.md` and use its design questions before choosing a template.

Ask only for what the conversation hasn't answered:

1. Do they have a Cirro account and a client ID yet? If not, start with `${CLAUDE_PLUGIN_ROOT}/docs/getting-started.md` steps 1 and 2, and draft the registration request for them.
2. Viewer for datasets or files, or a general app (portal, dashboard, workflow tool)?
3. Which Cirro tenant(s): the public Cirro tenant, an institution's tenant, or several? See `${CLAUDE_PLUGIN_ROOT}/docs/connecting-to-tenants.md`.
4. Embedded in Cirro only, standalone, or both? Production origin(s)?
5. Does the idea actually need a back-end (its own credentials, a permission scope distinct from the user's, or non-browser/scheduled access)? If so, it's out of scope for this kit — explain why (see `${CLAUDE_PLUGIN_ROOT}/docs/architecture.md#beyond-this-kit-apps-with-a-back-end`) and point them to the Cirro docs rather than scaffolding here.

## 2. Copy the right template

| Answer | Start from |
| --- | --- |
| Viewer | `${CLAUDE_PLUGIN_ROOT}/templates/viewer/` |
| General app with Cirro's login UI | `${CLAUDE_PLUGIN_ROOT}/templates/app/` |
| Can't use MUI/Amplify, or another framework | `@cirrobio/sdk` + a custom provider from `${CLAUDE_PLUGIN_ROOT}/docs/authentication.md`; no template |

Then:

1. Check for newer versions: `npm view @cirrobio/sdk version` (and `api-client`, `react-core`, `react-auth`, `react-tool`). If newer than the template's pins, bump them and re-check the workarounds in `${CLAUDE_PLUGIN_ROOT}/docs/packages.md#known-issues`.
2. `npm install`, copy `.env.example` to `.env`, fill in values.
3. `npm run build` must pass before continuing.

## 3. Permissions and registration

Update the template's `cirro-permissions.json` for what the app will do: required permissions with a reason each, optional ones tied to a feature. Follow `${CLAUDE_PLUGIN_ROOT}/docs/permissions.md`; aim for the smallest required set, project-scoped.

Standalone apps need a registration before sign-in works. Walk the user through `${CLAUDE_PLUGIN_ROOT}/docs/app-types-and-registration.md`. Embedded-only viewers can skip it. If the user wants registration scripted, show them the `AppRegistrationInput` and get a yes before running it.

## 4. First run

`npm run dev` with the template's dev proxy, sign in, confirm projects load (viewer: add `?projectId=…&datasetId=…`). On failure, use `${CLAUDE_PLUGIN_ROOT}/docs/troubleshooting.md` before changing code.

## 5. Deployment config

Set up what `${CLAUDE_PLUGIN_ROOT}/docs/deployment.md` lists before the first deploy: production API URL, production origin in the registration, CSP. Tell the user that direct file reads need bucket CORS for the production origin, which is a Cirro admin request.

## Connection request

A deployed app only works for users once a tenant connects it. When the app is ready, draft the connection request from "What to include" in `${CLAUDE_PLUGIN_ROOT}/docs/connecting-to-tenants.md` (using the manifest, origins and scan result) for the user to send: to support@cirro.bio for the public tenant, or to their tenant's admins.

## Hand-off

Tell the user briefly what was created, which registration details are still needed, and which parts depend on items in `${CLAUDE_PLUGIN_ROOT}/docs/open-questions.md`. For feature work, use cirro-data-access or cirro-viewer-tool; run cirro-app-review before the first production deploy.
