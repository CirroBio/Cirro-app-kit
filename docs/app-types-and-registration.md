# App types and registration

Before writing login code, register your app with Cirro. Registration fixes the app's permissions and its redirect URIs, and your code cannot change either at runtime.

## The only model this kit covers

This kit is for **front-end-only apps**: all the code runs in the browser, with no backend of your own. For those, the only integration that makes sense is one where the **user logs in with their own Cirro credentials and acts within their own permission scope**. The app is registered as a **Public App**, holds no secret, and carries no access of its own: every call is made as the signed-in user, further limited by the permissions on the registration. A 403 is simply that user's own permissions talking.

Cirro also has app types that carry their own credentials and act as themselves rather than as a user — for backends, scripts, instruments and scheduled jobs. Those are out of scope here, because a credential shipped to a browser is readable by anyone who opens dev tools. If you need one, that's a backend concern, not a front-end one.

## Who registers the app

An app is registered by an admin, and there are three paths depending on who the app is for:

- **A project admin** registers an app scoped to a single project, granting it permissions within that project. Because the developer often owns or administers the project themselves, this is usually self-serve — no waiting on anyone else.
- **A tenant admin** registers an app at the tenant level, able to grant permissions across the tenant, for an app that serves a whole institution.
- **On the public tenant (app.cirro.bio),** the central Cirro support team registers the app.

Pick the narrowest path that fits: an app for one project goes to that project's admin; something for the whole institution goes to a tenant admin; something on the public tenant goes through Cirro support.

For development you want a registration that only you can sign in to until it's approved. [Getting started](getting-started.md#2-get-a-development-registration) walks through obtaining one. To ship, the same registration is updated with the production address and approved; see [connecting to tenants](connecting-to-tenants.md).

## Registration fields

The admin who creates the registration fills in these fields, which map to the API's `AppRegistrationInput` model:

- **name, description, logoUrl, appUrl, publisher.** Shown to users and admins on approval and discovery screens.
- **redirectUris.** Every origin the app runs on, exactly: scheme, host and port. If you use `AmplifyAuthProvider` (see [authentication](authentication.md)), it redirects to the bare origin, so register `http://localhost:5173` and `https://app.example.org`, not a `/callback` path. Remove preview or staging URLs you don't control.
- **globalPermissions** and **projectPermissions** (`{ projectId, permissions: [...] }`). Cirro permission names such as `VIEW_PROJECT`, `VIEW_DATASET` and `CREATE_DATASET`. Register only what the app calls; apps that read files most likely also need `GENERATE_DOWNLOAD_TOKEN`. The full list is the `Permission` enum in `@cirrobio/api-client`. Take these from the app's [permission manifest](permissions.md#layer-1-declare-what-the-app-needs). Prefer `projectPermissions`: a project admin can only grant those, and most front-end apps need nothing wider. `globalPermissions` are a tenant-admin, whole-institution concern.
- **allowedIps.** Leave empty for browser apps; users connect from anywhere.
- **discoveryEnabled.** Whether other users can find the app.

## Approval

Registrations that require admin consent (`requiresAdminConsent`) must be approved before anyone other than the creator can sign in. Ask for approval once permissions are final; changing permissions may require approval again.

## Tenants

Registration happens separately in each Cirro tenant, and each tenant gives the app its own client ID and API URL. How to request a connection to the public Cirro tenant or an institution's tenant, what tenant admins review, and how one app can serve several tenants are covered in [connecting to tenants](connecting-to-tenants.md).

## Scripted registration

For automated setups, `AppRegistrationsApi` can create registrations. It needs a token with `MANAGE_OWN_APP_REGISTRATIONS`.

```typescript
import { AppRegistrationsApi, AppClientType, PrincipalType } from "@cirrobio/api-client";
import { generateApiConfig } from "@cirrobio/sdk";

const apps = new AppRegistrationsApi(generateApiConfig({ basePath: API, tokenGetter }));
const templates = await apps.listAppRegistrationTemplates();   // check for a matching template first
const created = await apps.createAppRegistration({ appRegistrationInput: {
  name, description, appUrl,
  clientType: AppClientType.PublicClient,
  principalType: PrincipalType.Delegated,   // confirm against what the UI sets for Public Apps
  redirectUris: ["http://localhost:5173", "https://app.example.org"],
  allowedIps: [],
  globalPermissions: [],
  projectPermissions: [{ projectId, permissions: ["VIEW_PROJECT", "VIEW_DATASET"] }],
}});
// created.clientId is your client ID; public clients ignore created.clientSecret
```
