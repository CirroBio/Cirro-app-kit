# Known limitations

Things Cirro doesn't support yet that affect how you build an app, and what to do about each.

## Users should be signed in to Cirro before your app's sign-in

When your app sends a user to Cirro's authorize page and they aren't signed in to Cirro, Cirro asks them to sign in and then shows an error ("Invalid authorize link") instead of returning to your app's consent screen. Signing in from your app a second time then works. Until this is fixed, tell users in your app's sign-in screen to sign in to Cirro first, or that they may need to click **Sign in with Cirro** twice. See [authentication](authentication.md).

## Workspaces open in a new tab

A workspace can't be shown inside your app: workspace servers only allow themselves and the Cirro web app to frame them. Open the workspace in a new tab, and keep its status in your app. See [workspaces](workspaces.md#handing-the-user-into-the-workspace).

## Sheets aren't available on every tenant

Some tenants, including the public tenant (app.cirro.bio), don't have Sheets. Check `tenantInfo.features.sheetsEnabled` before offering a feature built on them, and fall back to tagged datasets where it's off. See [Sheets](sheets.md).

## An app usually can't read the user's project role

A typical app registration can't read the signed-in user's role in a project, so an app can't tell in advance which actions the user may take. Offer actions and let a refusal (403) decide. See [permissions](permissions.md#checking-before-offering-an-action).

## No emailed sign-in links

Cirro's authorize page offers the tenant's single sign-on options, not the emailed sign-in links available in the Cirro web app.

## Strict OAuth libraries reject the metadata document

The metadata document's `issuer` is the tenant's Cognito user pool (`https://cognito-idp.<region>.amazonaws.com/<pool>`), not the Cirro address the document is published at, and the ID tokens carry the same issuer. Libraries that require the two addresses to match, such as [oauth4webapi](https://github.com/panva/oauth4webapi), refuse the document in their discovery step. [oidc-client-ts](https://github.com/authts/oidc-client-ts), which the app template uses, doesn't check. With a strict library, fetch the document yourself and pass it to the library as the server's settings instead of using its discovery step. See [authentication](authentication.md).
