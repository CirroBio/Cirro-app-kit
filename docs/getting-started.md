# Getting started

This page gets you from a Cirro account to a running app that signs you in and lists your projects and datasets. It takes minutes if you can register the app yourself; otherwise, allow for a tenant admin to set it up.

If Cirro is new to you, read [Cirro in five minutes](concepts.md) first.

## 1. Start from your Cirro account

This guide assumes you already have an account on a Cirro tenant, and that you'll use it to set up your app connection. If you don't have one yet, get access to a tenant first: use your institution's, or the public Cirro tenant.

Have a project with some data in it to develop against, and make it a test project rather than one holding important data, since your app will be able to do whatever you can do there. If you're not in a suitable project, ask a project owner to add you to one.

## 2. Register the app for local development

Cirro finds an app's registration by its **callback URL**, the address it returns to after sign-in. Each app needs its own callback URL in a tenant, so the template runs under its own path: `http://localhost:5173/cirro-app/` during development. Pick a short slug for your app now (for example `qc-review`); your callback URL is `http://localhost:5173/<slug>/`.

How you register it depends on your role in the tenant (see [app types and registration](app-types-and-registration.md#who-registers-the-app)):

- **If you have the App Developer role,** register it yourself in the Cirro web interface: a **Public App** with that callback URL as its redirect URI, and project permissions `VIEW_PROJECT` and `VIEW_DATASET`, which cover the template. It works for you alone, which is what you want while developing. Note its **client ID**: during local development the app uses it, set in `.env`.
- **Otherwise, ask a tenant admin** to give you the App Developer role, or to register the app for you with that callback URL and **discovery enabled**. With discovery on, the app asks the tenant for its client ID by callback URL, and you leave the client ID out of `.env`. Project admins can't register apps.
- **On the public tenant (app.cirro.bio),** the Cirro support team registers apps.

If a tenant admin is setting it up, send them:

```text
Subject: App registration for local development

I'm developing a Cirro app and need it registered.

Tenant:         <public Cirro tenant, or your tenant's address>
App name:       <name>
App type:       Public App (runs entirely in the browser)
Callback URL:   http://localhost:5173/<slug>/
Discovery:      enabled
Permissions:    VIEW_PROJECT, VIEW_DATASET
Contact:        <your email>
```

When the app is ready to share, a tenant admin registers its production callback URL with discovery enabled, and the deployed app finds its client ID the same way; no client ID is shipped with it. That's [step 5](#5-ship-it).

## 3. Run the app template

You need Node.js 22.12 or later with a recent npm. Vite 8 also runs on Node 20.19, but the npm bundled with Node 20 (10.8) fails to install the template with `Cannot read properties of null (reading 'edgesOut')`; npm 10.9.8 works. Check with `node --version` and `npm --version`.

```bash
git clone https://github.com/CirroBio/Cirro-app-kit.git
cp -r Cirro-app-kit/templates/app my-cirro-app && cd my-cirro-app
cp .env.example .env
```

Edit `.env`:

```bash
VITE_CIRRO_URL=https://<the tenant's web address>
VITE_CIRRO_CLIENT_ID=<your registration's client ID, or empty if a tenant admin enabled discovery>
```

In `vite.config.ts`, change `base` from `/cirro-app/` to `/<slug>/`. The app calls the tenant's API at `VITE_CIRRO_URL` + `/api`, and signs you in through Cirro's authorize page at `VITE_CIRRO_URL` + `/authorize`. Then:

```bash
npm install
npm run dev
```

Open `http://localhost:5173/<slug>/`. Use exactly that address: `127.0.0.1`, another port or a missing trailing slash won't match the registered callback URL. Click **Sign in with Cirro**. Cirro's authorize page names your app and lists the permissions it asks for; sign in there (if you aren't signed in to Cirro yet, Cirro asks you to first). Back in the app, you should see:

- the tenant's name and your name in the header,
- your projects,
- the selected project's datasets, with their IDs.

If the page says **App not configured**, it lists what's missing in `.env`. If sign-in fails, check the first rows of [troubleshooting](troubleshooting.md): "No app is registered in this tenant", an error on the authorize page, or `redirect_mismatch` is nearly always the callback URL, discovery, or the client ID.

## 4. Decide what to build

With the template running, read [building on Cirro](building-on-cirro.md) for what an app can do beyond reading data (running pipelines, launching workspaces, writing sheets, leaving notes) and the patterns that work well. Then:

- List the permissions your app uses in `cirro-permissions.json`, with a reason for each; see [permissions](permissions.md). Ask for any new ones to be added to your registration.
- Look up methods in the [API reference](../reference/api-surface.md), and see [calling the API](calling-the-api.md), [working with files](files.md) and [Sheets](sheets.md).

## 5. Ship it

1. Run `python3 tools/scan.py <your app>` and work through the [security checklist](security-checklist.md).
2. Build and host the app; see [deployment](deployment.md).
3. Request a connection for each tenant whose users should use it: a tenant admin registers the app's production callback URL with discovery enabled and approves it. Build without `VITE_CIRRO_CLIENT_ID`; the app gets its client ID from each tenant. See [connecting to tenants](connecting-to-tenants.md).
