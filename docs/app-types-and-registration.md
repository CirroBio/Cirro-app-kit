# App types and registration

Before writing login code, register your app with Cirro. Registration fixes the app's permissions and its redirect URIs, and your code cannot change either at runtime.

## The only model this kit covers

This kit is for **front-end-only apps**: all the code runs in the browser, with no backend of your own. For those, the only integration that makes sense is one where the **user logs in with their own Cirro credentials and acts within their own permission scope**. The app is registered as a **Public App**, holds no secret, and carries no access of its own: every call is made as the signed-in user, further limited by the permissions on the registration. A 403 is simply that user's own permissions talking.

Registrations that come with a client secret are out of scope for this kit: the apps it covers have only a client ID, and every user signs in with their own identity.

## Who registers the app

Apps are registered in each tenant, by people with one of two roles:

- **Tenant admins** create registrations and approve them. Approval is what lets anyone other than the registration's creator sign in.
- **App Developers** create development registrations. The App Developer role, which a tenant admin assigns, lets you register an app yourself that points to `localhost` (for example `http://localhost:5173`) and works for you alone. That's how you build and test the app before asking a tenant admin to approve it, with its production address, for other users.

Project admins can't register apps. On the public tenant (app.cirro.bio), the Cirro support team acts as tenant admin and registers apps there.

For development you want a registration that points to `localhost` and only you can sign in to: create it yourself if you have the App Developer role, or ask a tenant admin. [Getting started](getting-started.md#2-get-a-development-registration) walks through obtaining one. To ship, the same registration is updated with the production address and approved; see [connecting to tenants](connecting-to-tenants.md).

## Registration fields

Whoever creates the registration (a tenant admin, or you with the App Developer role) fills in these fields, which map to the API's `AppRegistrationInput` model:

- **name, description, logoUrl, appUrl, publisher.** Shown to users and admins on approval and discovery screens.
- **redirectUris.** Every origin the app runs on, exactly: scheme, host and port. The app template returns to the bare origin (see [authentication](authentication.md#the-templates-sign-in)), so register `http://localhost:5173` and `https://app.example.org`, not a `/callback` path, exactly as the app sends them. Remove preview or staging URLs you don't control.
- **globalPermissions** and **projectPermissions** (`{ projectId, permissions: [...] }`). Cirro permission names such as `VIEW_PROJECT`, `VIEW_DATASET` and `CREATE_DATASET`. Register only what the app calls; apps that read files most likely also need `GENERATE_DOWNLOAD_TOKEN`. The full list is the `Permission` enum in `@cirrobio/api-client`. Take these from the app's [permission manifest](permissions.md#layer-1-declare-what-the-app-needs). Prefer `projectPermissions` for specific projects: most front-end apps need nothing wider, and a narrow grant is quicker to approve. `globalPermissions` reach the whole tenant.
- **allowedIps.** Leave empty for browser apps; users connect from anywhere.
- **discoveryEnabled.** Whether other users can find the app.

## Approval

Registrations that require admin consent (`requiresAdminConsent`) must be approved before anyone other than the creator can sign in. Ask for approval once permissions are final; changing permissions may require approval again.

## Tenants

Registration happens separately in each Cirro tenant, and each tenant gives the app its own client ID and API URL. How to request a connection to the public Cirro tenant or an institution's tenant, what tenant admins review, and how one app can serve several tenants are covered in [connecting to tenants](connecting-to-tenants.md).
