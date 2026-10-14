# cirro-app-kit

Documentation, project templates and tools for building browser apps, viewers and tools on the [Cirro](https://cirro.bio) platform: apps that sign users in with their Cirro account and work with their projects, datasets and files.

## Quick start

New to Cirro? Read [Cirro in five minutes](docs/concepts.md), then follow [getting started](docs/getting-started.md), which takes you from no account to a running app and viewer.

1. **Start from your Cirro account and get a development registration.** Use the account you already have on a tenant; create a registration yourself if your account allows it, or ask your tenant's Cirro admins (support@cirro.bio for the public tenant). You'll get a client ID.
2. **Run a template.** [`templates/app`](templates/app) for portals and dashboards, [`templates/viewer`](templates/viewer) for dataset and file viewers. Set three values in `.env`, then `npm install && npm run dev`.
3. **Decide what to build.** Cirro gives an app storage, pipelines, workspaces, sharing and a database, not just an API; see [building on Cirro](docs/building-on-cirro.md). List the permissions you use in `cirro-permissions.json` ([permissions](docs/permissions.md)).
4. **Before deploying,** run `python3 tools/scan.py <your app>` and work through the [security checklist](docs/security-checklist.md).
5. **Connect to tenants.** A deployed app works for users once each tenant approves it; see [connecting to tenants](docs/connecting-to-tenants.md).

## What's here

| Path | Contents |
| --- | --- |
| [`docs/`](docs) | The developer guide |
| [`templates/`](templates) | Buildable starters: `app` (sign-in, projects, datasets) and `viewer` (a dataset's files, embedded or standalone) |
| [`tools/scan.py`](tools/scan.py) | Pre-deploy scanner for common security and configuration mistakes |
| [`tools/api_surface.py`](tools/api_surface.py) | Regenerates the API reference for any installed version of the packages |
| [`reference/`](reference) | Generated API method list and common response models |
| [`skills/`](skills) | Optional Claude skills that use these docs; see [Using with Claude](#using-with-claude) |

## Developer guide

- [Cirro in five minutes](docs/concepts.md): what tenants, projects, datasets, pipelines and the rest are
- [Getting started](docs/getting-started.md): from no account to a running app and viewer
- [Building on Cirro](docs/building-on-cirro.md): why build on Cirro, what an app can do with each part of the platform, architectural patterns, trust boundaries
- [Connecting to tenants](docs/connecting-to-tenants.md): how a deployed app gets connected to and approved in Cirro tenants, including the public tenant; serving several tenants
- [Permissions](docs/permissions.md): the app's permission manifest, checking user roles, and degrading gracefully when users can't do everything
- [App types and registration](docs/app-types-and-registration.md): the front-end-only Public App model, who registers an app, redirect URIs, permissions, approval
- [Architecture](docs/architecture.md): the front-end-only model, and why back-end apps are out of scope
- [Cirro TypeScript packages](docs/packages.md): which `@cirrobio` package does what, and known issues
- [Authentication](docs/authentication.md): the sign-in flow and auth providers, including a custom OIDC example
- [Apps without a build step](docs/no-build.md): signing in, calling the API and reading and writing files with `fetch` alone, for plain-JavaScript and desktop apps
- [Calling the API](docs/calling-the-api.md): `DataService`, pagination, errors
- [Sheets](docs/sheets.md): relational tables in the project as the app's database; schemas, views, SQL, ingest
- [Working with files](docs/files.md): file credentials, signed URLs, uploads
- [Workspaces](docs/workspaces.md): interactive containers launched by the app; boot time, the per-user limit, handing off in a new tab, auto-stop
- [Viewers and tools](docs/viewers.md): `ViewerProvider`, embedded and standalone modes, converting static-site viewers
- [Deployment](docs/deployment.md): build config, hosting, Content Security Policy
- [Security checklist](docs/security-checklist.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Open questions](docs/open-questions.md): platform behavior not yet confirmed for external apps

## Verified against

`@cirrobio/api-client` and `@cirrobio/sdk` 0.13.37, `@cirrobio/react-core` 0.0.4, `@cirrobio/react-auth` 0.0.8, `@cirrobio/react-tool` 0.0.10. Both templates were clean-installed and built on 2026-10-10. CI rebuilds them on every push and weekly against the latest published packages.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), including how to update the kit when the Cirro packages publish a new version.

## Using with Claude

The repo is also a Claude Code plugin. Its skills hold the workflow steps for an agent (which questions to ask, which path to choose, when to verify against installed versions) and read the facts from `docs/`, so the guide stays the single source of truth. Install it from your plugin marketplace, or point a marketplace entry at this repo.

| Skill | Use it to |
| --- | --- |
| `cirro-app-scaffold` | Start a new app or viewer |
| `cirro-auth-wiring` | Add or debug Cirro sign-in |
| `cirro-data-access` | Call the API and read or upload files |
| `cirro-viewer-tool` | Build or convert a viewer |
| `cirro-app-review` | Review an app before deploying |
