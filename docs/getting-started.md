# Getting started

This page gets you from a Cirro account to a running app that signs you in and lists your projects and datasets, then to a viewer showing one of those datasets. Allow about an hour, most of it waiting for a registration.

If Cirro is new to you, read [Cirro in five minutes](concepts.md) first.

## 1. Start from your Cirro account

This guide assumes you already have an account on a Cirro tenant, and that you'll use it to set up your app connection. If you don't have one yet, get access to a tenant first: use your institution's, or the public Cirro tenant.

Have a project with some data in it to develop against, and make it a test project rather than one holding important data, since your app will be able to do whatever you can do there. If you're not in a suitable project, ask a project owner to add you to one.

## 2. Get a development registration

Your app needs a **client ID** before anyone, including you, can sign in to it. The client ID comes from an app registration, created by an admin. Which admin depends on who the app is for (see [app types and registration](app-types-and-registration.md#who-registers-the-app)):

- **A project tool** is registered by a **project admin**. If you own or administer your test project, that's you — create the registration yourself in the Cirro web interface, scoped to that project, and you won't wait on anyone.
- **A tenant-wide app** is registered by a **tenant admin**.
- **On the public tenant (app.cirro.bio),** the Cirro support team registers it.

If you're creating it yourself, the fields are in [app types and registration](app-types-and-registration.md#registration-fields); register it as a **Public App** with redirect URI `http://localhost:5173` and project permissions `VIEW_PROJECT`, `VIEW_DATASET`, `GENERATE_DOWNLOAD_TOKEN`, which cover both templates.

If you need an admin to do it, send them:

```text
Subject: Development app registration

I'm developing a Cirro app and need a development registration.

Tenant:         <public Cirro tenant, or your tenant's address>
App name:       <name>
App type:       Public App (runs entirely in the browser)
Redirect URI:   http://localhost:5173
Permissions:    VIEW_PROJECT, VIEW_DATASET, GENERATE_DOWNLOAD_TOKEN
Contact:        <your email>
```

You'll get back the **client ID** and the **tenant's web address**.

Until a registration is approved, only the person who created it can sign in to it. That's what you want while developing. When the app is ready to share, the same registration is updated with your production address and approved; that's [step 6](#6-ship-it).

## 3. Run the app template

You need Node.js 20 or later.

```bash
cp -r templates/app my-cirro-app && cd my-cirro-app
cp .env.example .env
```

Edit `.env`:

```bash
VITE_CIRRO_API=/api
CIRRO_PROXY_TARGET=https://<the tenant's web address>
VITE_CIRRO_CLIENT_ID=<your client ID>
```

In development, the template sends API calls through a local proxy to the tenant, which avoids browser cross-origin restrictions. Then:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Use exactly that address: `127.0.0.1` or another port won't match the registered redirect URI. Sign in with your Cirro account, and you should see:

- the tenant's name and your name in the header,
- your projects, each with your role in it,
- the selected project's datasets, with their IDs.

If the page says **App not configured**, it lists what's missing in `.env`. If sign-in fails, check the first rows of [troubleshooting](troubleshooting.md): `redirect_mismatch` and `invalid_client` are nearly always the address or the client ID.

## 4. Open a dataset in the viewer

Copy a project ID and a dataset ID from the app, then stop the app (both templates use port 5173, the one registered).

```bash
cp -r templates/viewer my-cirro-viewer && cd my-cirro-viewer
cp .env.example .env        # same three values as the app
npm install
npm run dev
```

Open `http://localhost:5173/?projectId=<project ID>&datasetId=<dataset ID>`. The viewer lists the dataset's files and previews the one you select. Replace the preview in `src/Viewer.tsx` with your own rendering; see [viewers](viewers.md).

For development, one registration can serve both templates. In production, register each app separately, with only the permissions it uses.

## 5. Decide what to build

With a template running, read [building on Cirro](building-on-cirro.md) for what an app can do beyond reading data (running pipelines, launching workspaces, writing sheets, leaving notes) and the patterns that work well. Then:

- List the permissions your app uses in `cirro-permissions.json`, with a reason for each; see [permissions](permissions.md). Ask for any new ones to be added to your development registration.
- Look up methods in the [API reference](../reference/api-surface.md), and see [calling the API](calling-the-api.md), [working with files](files.md) and [Sheets](sheets.md).
- Keep [`src/capabilities.ts`](../templates/app/src/capabilities.ts) as the one place the app decides what a user's role allows.

## 6. Ship it

1. Run `python3 tools/scan.py <your app>` and work through the [security checklist](security-checklist.md).
2. Build and host the app; see [deployment](deployment.md).
3. Request a connection for each tenant whose users should use it, including approval of your registration with the production address; see [connecting to tenants](connecting-to-tenants.md).
