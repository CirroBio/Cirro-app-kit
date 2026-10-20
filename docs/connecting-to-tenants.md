# Connecting your app to Cirro tenants

Deploying your app as a website makes it reachable, but not useful yet. Users can only sign in and work with their data once the app is **connected to a Cirro tenant**: registered in that tenant and approved by the people who run it. This page explains how that works, who does what, and how to request a connection.

## Tenants

A Cirro **tenant** is an independent research environment, usually run by or for one institution, with its own users, projects, data, governance and admins. Each tenant has its own web address, API and sign-in.

There is also a **public Cirro tenant** (app.cirro.bio), run by Cirro, open to researchers who aren't part of an institutional tenant. It's the natural first place to connect an app, and the place to start if you're developing an app without an institutional home.

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

1. **Develop.** Build against a test project, running the app on `localhost` with a development registration that only you can sign in to; with the App Developer role you create it yourself (see [getting started](getting-started.md)). Keep the [permission manifest](permissions.md) current as you go.
2. **Deploy.** Host the app at its production address (see [deployment](deployment.md)). Its callback URL, that address plus the app's path, is what each tenant registers, so settle it before requesting connections.
3. **Request a connection** for each tenant whose users should use the app (see below).
4. **Tenant review and approval.** A tenant admin registers the app's production callback URL with discovery enabled (or adds it to your development registration), with the permissions the tenant accepts, scoped to the projects it chooses, and approves it. Until approval, only the registration's creator can sign in.
5. **Users sign in.** Users of that tenant can now use the app. It gets its client ID from the tenant, so nothing in the deployed app changes.
6. **Change.** Adding origins or permissions means updating the registration in every connected tenant. Permission changes usually mean another review, so batch them and say what changed and why.

When an app is retired, ask each tenant to archive its registration, so no one can sign in to an app that's no longer maintained.

## Requesting a connection

### The public Cirro tenant

Email **support@cirro.bio** with the details listed below. Cirro support reviews the request and registers your app's callback URL with discovery enabled. Nothing comes back for you to configure: the app gets its client ID from the tenant by callback URL.

### Institutional tenants

Contact that tenant's Cirro admins. If you don't know who they are, the tenant's contact email is in its system info (`tenantInfo.contactEmail` from `/info/system`), or email support@cirro.bio and ask to be put in touch.

### What to include

A complete request is quicker to approve. Include:

- **App:** name, one-paragraph description, who publishes and maintains it, and a contact email. If you developed against a registration in this tenant, include its client ID, so an admin can add the production callback URL to it, enable discovery and approve it rather than recreating it.
- **Where it runs:** the production callback URL, exactly as the app sends it (its address plus the app's path, trailing slash included), and any other callback URLs that need to sign in. Ask for discovery to be enabled.
- **App type:** Public App (browser-only; the only type this kit covers). See [app types](app-types-and-registration.md).
- **Permissions:** your `cirro-permissions.json`, with required and optional permissions and their reasons. Say whether grants can be scoped to specific projects.
- **Data handling:** whether the app sends any Cirro data, or data derived from it, anywhere other than the user's browser and Cirro (your own backend, analytics, third-party APIs). If not, say so.
- **What it creates:** whether it runs pipelines, starts workspaces, or creates datasets, and that it leaves [provenance notes](building-on-cirro.md#provenance-by-default-notes-on-everything-the-app-creates) on what it creates.
- **Review evidence:** the result of `tools/scan.py` and confirmation that you've worked through the [security checklist](security-checklist.md).
- **Intended users:** who in that tenant asked for the app or will use it. Requests backed by a lab or group in the tenant move faster.

## Serving more than one tenant

An app gets its client ID from a tenant by its callback URL, so one build can serve any number of tenants: each tenant's admins register the same callback URL, with discovery enabled, and the app asks whichever tenant the user picks. No client ID is committed or deployed, and a tenant that approves the app later works without a rebuild. Users of one deployed app may belong to different tenants, and tenants come and go as admins approve or withdraw the app, so the app lets the user choose.

### The tenant list

A `tenants.json` next to the app lists the tenants it offers. It's fetched at runtime, not imported, so adding or removing a tenant is a file edit on the host:

```json
{
  "tenants": [
    { "id": "example", "name": "Example Institute", "url": "https://cirro.example.org" }
  ]
}
```

- `id`: a short slug, stable for the life of the entry; the app remembers the user's choice by it.
- `name`: shown in the picker.
- `url`: the tenant's web address. The app reads the tenant's endpoints from `url` + `/.well-known/oauth-authorization-server`, calls the API at `url` + `/api`, and links to items in Cirro under it: `/project/{projectId}`, `/project/{projectId}/dataset/{datasetId}`, `/project/{projectId}/dataset/{datasetId}/pipeline/{processId}` (Cirro's own form for running a pipeline on that dataset), `/project/{projectId}/workspace/{workspaceId}`, `/project/{projectId}/sheets`.

Adding a tenant: the tenant's admins register the app's production callback URL with discovery enabled, and you add the tenant's entry. Removing one: delete the entry; a tenant that archives the app's registration stops answering with a client ID.

### Choosing the tenant at startup

Pick the tenant before anything calls Cirro, and create the sign-in for it:

```typescript
type Tenant = { id: string; name: string; url: string };
const TENANT_KEY = "cirro-tenant";   // the tenant's id is not sensitive

export async function loadTenants(): Promise<Tenant[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}tenants.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load tenants.json (HTTP ${res.status})`);
  const { tenants } = await res.json();
  if (!Array.isArray(tenants) || !tenants.length) throw new Error("tenants.json lists no tenants");
  return tenants;
}

export const savedTenant = (tenants: Tenant[]) =>
  tenants.find((t) => t.id === localStorage.getItem(TENANT_KEY));

export function chooseTenant(t: Tenant) {
  localStorage.setItem(TENANT_KEY, t.id);
  window.location.reload();          // sign-in and DataService are created once, for one tenant
}

// main.tsx: render a picker until savedTenant() returns one, then start as the template does with
// tenant.url in place of config.url: await createSignIn(tenant.url, ""), which asks that tenant
// for the client ID, then a DataService on `${tenant.url}/api`, …
```

- With a single entry, skip the picker.
- After the tenant's config loads, show its name and logo (`tenantInfo.name` and `tenantInfo.tenantLogoUrl`) so users can see which environment they're signed in to.
- Never mix data between tenants in one session: switching tenant means signing out, clearing the saved choice, and starting again.
- If the saved tenant is no longer in the file, or no longer has the app registered (`createSignIn` fails with "No app is registered"), clear the choice and show the picker.

Every tenant that uses the app registers each callback URL it's served from, with discovery enabled.

## Planning ahead

- **Ask early.** Connection and approval involve people. Request the public-tenant connection when the app is usable, not the day before a demo.
- **Keep one manifest for all tenants.** Tenants may grant less than you ask for; that's what [optional permissions](permissions.md#degrading-gracefully) are for.
- **Track your connections.** Keep a list of connected tenants, their contacts and approved permissions in the app's repo. You'll need it every time the registration changes.
