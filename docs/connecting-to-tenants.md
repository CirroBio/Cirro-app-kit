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
- **Where it runs:** the production URL and any other origins that need to sign in (these become redirect URIs).
- **App type:** Public App (browser-only; the only type this kit covers). See [app types](app-types-and-registration.md).
- **Permissions:** your `cirro-permissions.json`, with required and optional permissions and their reasons. Say whether grants can be scoped to specific projects.
- **Data handling:** whether the app sends any Cirro data, or data derived from it, anywhere other than the user's browser and Cirro (your own backend, analytics, third-party APIs). If not, say so.
- **What it creates:** whether it runs pipelines, starts workspaces, or creates datasets, and that it leaves [provenance notes](building-on-cirro.md#provenance-by-default-notes-on-everything-the-app-creates) on what it creates.
- **Review evidence:** the result of `tools/scan.py` and confirmation that you've worked through the [security checklist](security-checklist.md).
- **Intended users:** who in that tenant asked for the app or will use it. Requests backed by a lab or group in the tenant move faster.

## Serving more than one tenant

Each tenant registers the app separately and gives it its own client ID. Users of one deployed app may belong to different tenants, and tenants come and go as admins approve or withdraw the app. Rather than storing client IDs, the app asks each tenant for its client ID at runtime with dynamic client registration ([RFC 7591](https://www.rfc-editor.org/rfc/rfc7591)): it sends the tenant its redirect URI, and the tenant answers with the client ID of the registration that lists it. No client ID is committed or deployed with the app, and a tenant that approves the app later works without a rebuild.

Each tenant's registration needs:

- **Discovery enabled** (`discoveryEnabled`). The tenant only looks among discoverable registrations.
- **The app's redirect URI, and one unique to the app.** The tenant matches on redirect URI, so two apps served from one origin need different paths (see [authentication](authentication.md#the-templates-sign-in)).

### The tenant list

A `tenants.json` next to the app lists the tenants it offers. It's fetched at runtime, not imported, so adding or removing a tenant is a file edit on the host:

```json
{
  "tenants": [
    { "id": "dev", "name": "Cirro (dev)", "url": "https://dev.cirro.bio" }
  ]
}
```

- `id`: a short slug, stable for the life of the entry; the app remembers the user's choice by it.
- `name`: shown in the picker.
- `url`: the tenant's web address. The app reads the tenant's endpoints from `url` + `/.well-known/oauth-authorization-server`, calls the API at `url` + `/api`, and links to items in Cirro under it: `/project/{projectId}`, `/project/{projectId}/dataset/{datasetId}`, `/project/{projectId}/dataset/{datasetId}/pipeline/{processId}` (Cirro's own form for running a pipeline on that dataset), `/project/{projectId}/workspace/{workspaceId}`, `/project/{projectId}/sheets`.

Adding a tenant: the tenant's admins register the app with your production redirect URI and discovery enabled, and you add the tenant's entry. Removing one: delete the entry; a tenant that archives the app's registration stops answering with a client ID.

### Getting the client ID

Ask the tenant's `registration_endpoint`, from its metadata document, for the client ID that matches the app's redirect URI:

```typescript
type Tenant = { id: string; name: string; url: string };

export async function clientIdFor(tenant: Tenant, redirectUri: string): Promise<string> {
  const metadata = await (await fetch(`${tenant.url}/.well-known/oauth-authorization-server`)).json();
  const res = await fetch(metadata.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "My Cirro app",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  // 401 means no discoverable registration in this tenant lists redirectUri.
  if (!res.ok) throw new Error(`${tenant.name} has no registration for ${redirectUri} (HTTP ${res.status})`);
  return (await res.json()).client_id;
}
```

### Choosing the tenant at startup

Pick the tenant before anything calls Cirro, and create the sign-in for it:

```typescript
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

// main.tsx: render a picker until savedTenant() returns one, then start as the template does:
// await createSignIn(tenant.url, await clientIdFor(tenant, REDIRECT_URI)),
// then a DataService on `${tenant.url}/api`, …
```

- With a single entry, skip the picker.
- After the tenant's config loads, show its name and logo (`tenantInfo.name` and `tenantInfo.tenantLogoUrl`) so users can see which environment they're signed in to.
- Never mix data between tenants in one session: switching tenant means signing out, clearing the saved choice, and starting again.
- If the saved tenant is no longer in the file, or no longer answers with a client ID, clear the choice and show the picker.

Register every origin the app is served from in every tenant that uses it.

## Planning ahead

- **Ask early.** Connection and approval involve people. Request the public-tenant connection when the app is usable, not the day before a demo.
- **Keep one manifest for all tenants.** Tenants may grant less than you ask for; that's what [optional permissions](permissions.md#degrading-gracefully) are for.
- **Track your connections.** Keep a list of connected tenants, their contacts and approved permissions in the app's repo. You'll need it every time the registration changes.
