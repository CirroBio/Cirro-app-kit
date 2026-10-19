---
name: cirro-app-scaffold
description: Start a new browser app, portal or dashboard that runs on Cirro data, with sign-in, API access and deployment config set up correctly from the first commit. Use this whenever someone wants to create, bootstrap or set up a new Cirro frontend, React app, data portal, or external tool that signs users in with Cirro, or asks how to structure such a project, which Cirro packages to install, or what to register before building. Use it even for a quick prototype; the registration and config choices are hard to change later.
---

# Scaffolding a Cirro app

Facts live in the repo's docs; this skill is the order of work and the decisions. Read the docs named at each step rather than relying on memory.

## 1. Settle four questions

If the app's purpose is still open (what it creates, whether it needs compute, a workspace hand-off, sharing), read `${CLAUDE_PLUGIN_ROOT}/docs/building-on-cirro.md` and use its design questions before choosing a template.

Ask only for what the conversation hasn't answered:

1. Do they have a Cirro account and a client ID yet? If not, start with `${CLAUDE_PLUGIN_ROOT}/docs/getting-started.md` steps 1 and 2: with the App Developer role they create a development registration themselves, pointing to `http://localhost:5173` and working only for them; otherwise draft the request to a tenant admin for them. Project admins can't register apps.
2. Which Cirro tenant(s): the public Cirro tenant, an institution's tenant, or several? See `${CLAUDE_PLUGIN_ROOT}/docs/connecting-to-tenants.md`.
3. Production origin(s)?
4. Would the app need a client secret, for example to act as itself rather than as the signed-in user, or to run with no user present? That's out of scope for this kit: say so, and don't scaffold it here.

## 2. Copy the template

Start from `${CLAUDE_PLUGIN_ROOT}/templates/app/` (React, Vite, Cirro's login UI). Then:

1. Check for newer versions: `npm view @cirrobio/sdk version` (and `@cirrobio/api-client`). If newer than the template's pins, bump them and read the release notes for anything that replaces hand-written code.
2. `npm install`, copy `.env.example` to `.env`, and set `VITE_CIRRO_URL` and `VITE_CIRRO_CLIENT_ID`.
3. `npm run build` must pass before continuing.

## 3. Permissions and registration

Update the template's `cirro-permissions.json` for what the app will do: required permissions with a reason each, optional ones tied to a feature. Follow `${CLAUDE_PLUGIN_ROOT}/docs/permissions.md` (cirro-permissions has the steps); aim for the smallest required set, project-scoped.

The app needs a registration before sign-in works. Walk the user through `${CLAUDE_PLUGIN_ROOT}/docs/app-types-and-registration.md`. If the user wants registration scripted, show them the `AppRegistrationInput` and get a yes before running it.

## 4. First run

`npm run dev`, open `http://localhost:5173`, sign in through Cirro's authorize page, confirm projects load. On failure, use `${CLAUDE_PLUGIN_ROOT}/docs/troubleshooting.md` before changing code.

## 5. Deployment config

Set up what `${CLAUDE_PLUGIN_ROOT}/docs/deployment.md` lists before the first deploy: production API URL, production origin in the registration, CSP. Tell the user that direct file reads need bucket CORS for the production origin, which is a Cirro admin request.

## Connection request

A deployed app only works for users once a tenant connects it. When the app is ready to ship, use cirro-app-deploy: it covers production config, hosting and the connection request for each tenant.

## Hand-off

Tell the user briefly what was created, which registration details are still needed, and which parts depend on items in `${CLAUDE_PLUGIN_ROOT}/docs/open-questions.md`. For feature work, use cirro-data-access, cirro-sheets or cirro-compute; run cirro-app-review before the first production deploy, and cirro-app-deploy to ship.
