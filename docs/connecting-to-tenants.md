# Connecting your app to Cirro tenants

Deploying your app as a website makes it reachable, but not useful yet. Users can only sign in and work with their data once the app is **connected to a Cirro tenant**: registered in that tenant and approved by the people who run it. This page explains how that works, who does what, and how to request a connection.

## Tenants

A Cirro **tenant** is an independent research environment, usually run by or for one institution, with its own users, projects, data, governance and admins. Each tenant has its own web address, API and sign-in.

There is also a **public Cirro tenant**, run by Cirro, open to researchers who aren't part of an institutional tenant. It's the natural first place to connect an app, and the place to start if you're developing an app without an institutional home.

An app is connected tenant by tenant. Connecting to one tenant gives no access to any other; each tenant reviews and approves the app on its own terms.

## Who's involved

| Role | Responsibilities |
| --- | --- |
| **App developer** (publisher) | Builds and hosts the app; maintains its [permission manifest](permissions.md#layer-1-declare-what-the-app-needs); requests connections; keeps registrations up to date |
| **Tenant admins** | Review connection requests for their tenant; register and approve apps; decide which permissions and projects an app gets |
| **Cirro support** | Handles connection requests for the public tenant, and helps route requests to institutional tenants |
| **Users** | Sign in to a connected app with their tenant account; the app acts within their own access |

## The lifecycle of a connected app

```mermaid
flowchart LR
  dev["1. Develop<br/>against a test project"]
  deploy["2. Deploy<br/>the website"]
  req["3. Request a connection<br/>per tenant"]
  review["4. Tenant review<br/>and approval"]
  use["5. Users<br/>sign in"]
  change["6. Change<br/>(new permissions, origins)"]
  dev --> deploy --> req --> review --> use --> change
  change -- "re-review if permissions change" --> review
```

1. **Develop.** Build against a test project, using a development registration that only you can sign in to until it's approved (see [getting started](getting-started.md)). Keep the [permission manifest](permissions.md) current as you go.
2. **Deploy.** Host the app at its production URL (see [deployment](deployment.md)). The URL is part of the registration, so settle it before requesting connections.
3. **Request a connection** for each tenant whose users should use the app (see below).
4. **Tenant review and approval.** The tenant registers the app (or approves your registration) with the permissions it accepts, scoped to the projects it chooses. Until approval, only the app's creator can sign in.
5. **Users sign in.** Users of that tenant can now use the app. If the tenant enables discovery, they can also find it in Cirro.
6. **Change.** Adding origins or permissions means updating the registration in every connected tenant. Permission changes usually mean another review, so batch them and say what changed and why.

When an app is retired, ask each tenant to archive its registration, so no one can sign in to an app that's no longer maintained.

## Requesting a connection

### The public Cirro tenant

Email **support@cirro.bio** with the details listed below. Cirro support reviews the request, sets up the registration, and sends you the client ID and the tenant's API URL.

### Institutional tenants

Contact that tenant's Cirro admins. If you don't know who they are, the tenant's contact email is in its system info (`tenantInfo.contactEmail` from `/info/system`), or email support@cirro.bio and ask to be put in touch.

### What to include

A complete request is quicker to approve. Include:

- **App:** name, one-paragraph description, who publishes and maintains it, and a contact email. If you developed against a registration in this tenant, include its client ID so it can be updated and approved rather than recreated.
- **Where it runs:** the production URL and any other origins that need to sign in (these become redirect URIs). Note whether it also runs embedded in Cirro.
- **App type:** Public App (browser-only; the only type this kit covers). See [app types](app-types-and-registration.md).
- **Permissions:** your `cirro-permissions.json`, with required and optional permissions and their reasons. Say whether grants can be scoped to specific projects.
- **Data handling:** whether the app sends any Cirro data, or data derived from it, anywhere other than the user's browser and Cirro (your own backend, analytics, third-party APIs). If not, say so.
- **What it creates:** whether it runs pipelines, starts workspaces, or creates datasets, and that it leaves [provenance notes](building-on-cirro.md#provenance-by-default-notes-on-everything-the-app-creates) on what it creates.
- **Review evidence:** the result of `tools/scan.py` and confirmation that you've worked through the [security checklist](security-checklist.md).
- **Intended users:** who in that tenant asked for the app or will use it. Requests backed by a lab or group in the tenant move faster.

## Serving more than one tenant

Each tenant has its own API URL and gives your app its own client ID. You can handle that in two ways:

| Approach | How | Good for |
| --- | --- | --- |
| **One build per tenant** | Build with that tenant's `VITE_CIRRO_API` and `VITE_CIRRO_CLIENT_ID`, and deploy each to its own URL (for example `tenant-a.myapp.org`) | A few tenants; tenants that want the app on their own domain |
| **One build, many tenants** | Ship a `tenants.json` mapping each tenant to its API URL and client ID, and choose the tenant at startup, from the hostname or a picker | Many tenants; a single public URL |

For a single build, register every origin in every tenant that will use it, and pick the tenant before anything calls Cirro:

```typescript
// tenants.json: { "tenant-a": { "name": "...", "api": "https://...", "clientId": "..." }, ... }
import tenants from "./tenants.json";

const fromHost = window.location.hostname.split(".")[0];
const saved = sessionStorage.getItem("cirro-tenant");
const tenant = tenants[fromHost] ?? tenants[saved ?? ""];   // otherwise show a tenant picker

const auth = new AmplifyAuthProvider(tenant.clientId);
// <AppConfigProvider apiBasePath={tenant.api} authProvider={auth}>…
```

After the tenant's config loads, show its name and logo (`tenantInfo.name` and `tenantInfo.tenantLogoUrl`) so users can see which environment they're signed in to. Never mix data between tenants in one session: switching tenant means signing out and starting again.

## Embedded viewers

Viewers that run inside the Cirro UI are connected differently from standalone apps: they're added to a tenant as tools, rather than signing users in through a registration. Ask support@cirro.bio how to make an embedded viewer available in a tenant. If the same viewer also runs standalone, it needs a regular connection request for that use.

## Planning ahead

- **Ask early.** Connection and approval involve people. Request the public-tenant connection when the app is usable, not the day before a demo.
- **Keep one manifest for all tenants.** Tenants may grant less than you ask for; that's what [optional permissions](permissions.md#degrading-gracefully) are for.
- **Track your connections.** Keep a list of connected tenants, their client IDs, contacts and approved permissions in the app's repo (not secrets: client IDs for public apps aren't confidential). You'll need it every time the registration changes.
