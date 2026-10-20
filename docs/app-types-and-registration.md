# App types and registration

Before writing login code, register your app with Cirro. Registration fixes the app's permissions and its redirect URIs, and your code cannot change either at runtime.

## The only model this kit covers

This kit is for **front-end-only apps**: all the code runs in the browser, with no backend of your own. For those, the only integration that makes sense is one where the **user logs in with their own Cirro credentials and acts within their own permission scope**. The app is registered as a **Public App**, holds no secret, and carries no access of its own: every call is made as the signed-in user, further limited by the permissions on the registration. A 403 is simply that user's own permissions talking.

Registrations that come with a client secret are out of scope for this kit: the apps it covers have only a client ID, and every user signs in with their own identity.

## Who registers the app

A registration ties the app's **callback URL** (the address it returns to after sign-in) to its permissions. The app never needs to be given a client ID: a tenant admin registers the callback URL with **discovery enabled**, and the app asks the tenant for the client ID that goes with it ([dynamic client registration](authentication.md#the-flow)). Apps are registered in each tenant, by people with one of two roles:

- **Tenant admins** create registrations, enable discovery, and approve them. Approval is what lets anyone other than the registration's creator sign in.
- **App Developers** create registrations for local development. The App Developer role, which a tenant admin assigns, lets you register a `localhost` callback URL yourself; the registration works for you alone and isn't discoverable, so during development the app uses its client ID from `.env`. When the app is ready to share, a tenant admin registers its production callback URL with discovery enabled and approves it.

Project admins can't register apps. On the public tenant (app.cirro.bio), the Cirro support team acts as tenant admin and registers apps there.

[Getting started](getting-started.md#2-register-the-app-for-local-development) walks through registering for local development; [connecting to tenants](connecting-to-tenants.md) covers production.

## Registration fields

Whoever creates the registration (a tenant admin, or you with the App Developer role) fills in these fields, which map to the API's `AppRegistrationInput` model:

- **name, description, logoUrl, appUrl, publisher.** Shown to users and admins on approval and discovery screens.
- **redirectUris.** The app's callback URL for each place it runs, exactly as the app sends it: scheme, host, port and path, trailing slash included. The template returns to its origin plus its own path (Vite's `base`; see [authentication](authentication.md#the-templates-sign-in)), for example `http://localhost:5173/qc-review/` and `https://apps.example.org/qc-review/`. Each callback URL must belong to one app in the tenant: the tenant finds the registration by it, and refuses when two discoverable registrations list the same one. Remove preview or staging URLs you don't control.
- **globalPermissions** and **projectPermissions** (`{ projectId, permissions: [...] }`). Cirro permission names such as `VIEW_PROJECT`, `VIEW_DATASET` and `CREATE_DATASET`. Register only what the app calls; apps that read the project's files also need `GENERATE_DOWNLOAD_TOKEN`, and apps that list pipelines need `VIEW_PROCESS` as a global permission. The full list is the `Permission` enum in `@cirrobio/api-client`. Take these from the app's [permission manifest](permissions.md#layer-1-declare-what-the-app-needs). Prefer `projectPermissions` for specific projects: most front-end apps need nothing wider, and a narrow grant is quicker to approve. `globalPermissions` reach the whole tenant.
- **allowedIps.** Leave empty for browser apps; users connect from anywhere.
- **discoveryEnabled.** Lets the app get its client ID from the tenant by callback URL. Production registrations need it; only a tenant admin can set it.

## Approval

Registrations that require admin consent (`requiresAdminConsent`) must be approved before anyone other than the creator can sign in. Ask for approval once permissions are final; changing permissions may require approval again.

## Tenants

Registration happens separately in each Cirro tenant; each tenant's registration has its own client ID, which the app gets from that tenant by its callback URL. How to request a connection to the public Cirro tenant or an institution's tenant, what tenant admins review, and how one app can serve several tenants are covered in [connecting to tenants](connecting-to-tenants.md).
