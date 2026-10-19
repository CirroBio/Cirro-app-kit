# Known limitations

Things Cirro doesn't support yet that affect how you build an app, and what to do about each.

## Users should be signed in to Cirro before your app's sign-in

When your app sends a user to Cirro's authorize page and they aren't signed in to Cirro, Cirro asks them to sign in and then shows an error ("Invalid authorize link") instead of returning to your app's consent screen. Signing in from your app a second time then works. Until this is fixed, tell users in your app's sign-in screen to sign in to Cirro first, or that they may need to click **Sign in with Cirro** twice. See [authentication](authentication.md).

## Apps serving several tenants can't get client IDs from the browser yet

[Dynamic client registration](connecting-to-tenants.md#serving-more-than-one-tenant), which an app uses to get each tenant's client ID at runtime, doesn't accept requests from browsers yet. Until it does, a browser app can serve only the tenant it was built for.

## Fetch the OAuth metadata document yourself

The tenant's metadata document (`/.well-known/oauth-authorization-server`) is served with the content type `text/json` rather than `application/json`. OAuth libraries that load it themselves, including oidc-client-ts, refuse it. Fetch it with `fetch` and pass the result to the library, as the [app template](authentication.md#the-templates-sign-in) does.

## Workspaces open in a new tab

A workspace can't be shown inside your app: workspace servers only allow themselves and the Cirro web app to frame them. Open the workspace in a new tab, and keep its status in your app. See [workspaces](workspaces.md#handing-the-user-into-the-workspace).

## Sheets aren't available on every tenant

Some tenants, including the public tenant (app.cirro.bio), don't have Sheets. Check `tenantInfo.features.sheetsEnabled` before offering a feature built on them, and fall back to tagged datasets where it's off. See [Sheets](sheets.md).

## An app usually can't read the user's project role

A typical app registration can't read the signed-in user's role in a project, so an app can't tell in advance which actions the user may take. Offer actions and let a refusal (403) decide. See [permissions](permissions.md#checking-before-offering-an-action).

## No emailed sign-in links

Cirro's authorize page offers the tenant's single sign-on options, not the emailed sign-in links available in the Cirro web app.
