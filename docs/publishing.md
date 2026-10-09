# Publishing an app to Cirro

How a built app reaches Cirro users. [`CONTRACT.md`](../CONTRACT.md) sections 10 (registry
and enablement) and 12 (manifest, versions and packing) are the rules; this is the
walkthrough.

## 1. Describe the app: `cirro-app.json`

At the root of your built app (next to `index.html`):

```json
{
  "id": "myviewer",
  "name": "My Viewer",
  "version": "1.0.0",
  "entry": "index.html",
  "permissions": ["projects:read", "datasets:read", "files:read"],
  "opens": [{ "extension": "vcf", "label": "Variants" }],
  "description": "What it does, in one sentence.",
  "homepage": "https://github.com/me/myviewer",
  "license": "MIT"
}
```

- **`id`:** lowercase letters and digits. It's unique across Cirro and never reused,
  even after an app is withdrawn.
- **`permissions`:** ask only for what the app uses. Tenant admins see every permission
  before they add the app, and may decline some.
- **`opens`:** the file types the portal offers to open with your app.

## 2. Check and pack

```bash
npx cirro-app validate dist      # checks the manifest and that "entry" is in the bundle
npx cirro-app pack dist          # writes myviewer-1.0.0.zip
```

`pack` includes every file except dotfiles, with the manifest at the root. The same files
always give the same zip.

## 3. Register

Sign in to the registry (apps.cirro.bio) with your email; organizations with single
sign-on get "Continue with SSO". Register the app from the zip, either as yourself or
for an organization you belong to. The organization's admins and members can then all
manage it.

New apps are **private**: no tenant sees them yet.

## 4. Choose who can add it

- **Private:** list the tenants by URL (e.g. `acme.cirro.bio`), each for all of its
  projects or for named project IDs.
  - There is no review step.
  - Each tenant's admin adds the app by typing its exact ID; nothing suggests it.
  - This suits commercial apps sold to particular customers.
- **Public:** submit a version for review.
  - Once Cirro approves it, the app is in every tenant's catalog, for all projects.
  - Each later version is reviewed too.

## 5. Release new versions at your own pace

Upload each new version as a new zip; its version must be higher than the last.

Each tenant gets:
- the newest approved version (public apps), or the newest version (private apps);
- or, if you pick one for that tenant under **Access → Version for each tenant**, that
  version. This is how a release goes to one pilot tenant first.

If a new version asks for a permission a tenant's admin hasn't seen, that tenant keeps
the older version until the admin approves the update.

## What tenant admins and users see

1. A tenant admin adds the app, from the catalog or by ID, and chooses its projects and
   permissions.
2. Project admins can turn it off in their own projects.
3. Users find it under **Apps** in each project where it's on, and the portal opens it
   at `/apps/<id>` with their session (CONTRACT.md section 3).
