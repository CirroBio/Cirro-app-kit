# Authentication

An app signs users in by sending them to Cirro's authorize page. Cirro shows the user which app is asking and what it may do, the user signs in with their own account, and the app gets back a token that acts as them. The app holds a client ID and no secret.

## The flow

A Public App uses the authorization code flow with PKCE. Each tenant publishes its endpoints in an OAuth metadata document at `<tenant>/.well-known/oauth-authorization-server` ([RFC 8414](https://www.rfc-editor.org/rfc/rfc8414)): the authorize step goes to Cirro's web address, and the token step to the tenant's token server. An OAuth library runs steps 2 to 7; your own code starts at step 8.

```mermaid
sequenceDiagram
  participant App as Your app
  participant Cirro as Cirro authorize page
  participant Login as Token server
  participant API as Cirro API
  App->>Cirro: 1. GET /.well-known/oauth-authorization-server (no token)
  App->>Cirro: 2. Redirect to /authorize with client ID + PKCE challenge
  Note over Cirro: 3. Shows the app's name, publisher and permissions,<br/>and the user picks how to sign in
  Cirro->>Login: 4. Hands off to the tenant's sign-in
  Login-->>App: 5. Redirect back to your redirect URI with a code
  App->>Login: 6. Exchange code + PKCE verifier at the token endpoint
  Login-->>App: 7. Access, ID and refresh tokens
  App->>API: 8. API calls with Authorization: Bearer
```

- **Step 1 needs no token.** The metadata document lists `authorization_endpoint` (Cirro's authorize page), `token_endpoint`, `revocation_endpoint` and `issuer`, and answers browsers from any origin. Read endpoints from it rather than building them. It's served as `text/json`, which some OAuth libraries refuse, so fetch it yourself and pass the result to the library, as the template does. Once the user is signed in, the template reads the tenant's display name with `data.system.info()` (`tenantInfo.name`).
- **Step 3 is Cirro's consent screen.** It shows the registration's name, logo, publisher and requested permissions, and an "Official" badge for apps Cirro publishes, and lists the tenant's sign-in providers. The user must be signed in to Cirro to see it; a signed-out user is taken to Cirro's sign-in first.
- **PKCE replaces the client secret.** The library sends only a hash of a random verifier in step 2 and proves possession in step 6, so a stolen code is useless on its own.
- **Only `openid`.** Public Apps allow the `openid` scope and no other.
- **Renewal is silent.** The library uses the refresh token from step 7 to get new access tokens before they expire (they last 15 minutes).
- **No emailed sign-in links.** The authorize page offers the tenant's SSO providers only.

## The template's sign-in

The [app template](../templates/app) implements the flow with [oidc-client-ts](https://github.com/authts/oidc-client-ts), in `src/auth.ts`, configured from the tenant's metadata document:

```typescript
import { UserManager } from "oidc-client-ts";

const res = await fetch(`${cirroUrl}/.well-known/oauth-authorization-server`);
const userManager = new UserManager({
  authority: cirroUrl,
  metadata: await res.json(),     // authorize, token and revocation endpoints
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: "openid",
  loadUserInfo: false,
  automaticSilentRenew: true,
});
```

`src/main.tsx` finishes a returning sign-in (`signinRedirectCallback()` when the URL has `code` and `state`), shows a **Sign in with Cirro** button otherwise (`signinRedirect()`), and gives `DataService` a token getter that reads the current access token from the library, renewing it with the refresh token first if it has expired (a tab that slept past automatic renewal). A user whose token can't be renewed is treated as signed out. The username is the ID token's `cognito:username` claim.

What to know about it:

- **The redirect URI must match the registration exactly.** The template returns to `window.location.origin`, or to the origin plus Vite's `base` for an app served under a path (a GitHub Pages project site such as `https://<org>.github.io/<repo>/`). Register that exact URL, trailing slash included: Cognito's authorize step treats `https://host/app` and `https://host/app/` alike, but the end of a SAML sign-in (a Microsoft or other SAML identity provider) compares exactly and fails with `Invalid SAML response received: RedirectUri is not registered with the client`.
- **Show a failed return.** A page load with `?error=` is a failed sign-in, usually a registration mismatch. The template shows the error instead of offering to sign in again, so a broken registration can't loop.
- **Tokens live in the library's session storage** (oidc-client-ts's default), so a reload keeps the user signed in without another trip through the consent screen. Your own code never stores them. Browser storage is per origin, so an app served from an origin of its own (its own domain or subdomain) can keep the login across tabs and browser restarts by passing `userStore: new WebStorageStateStore({ store: window.localStorage })`; ask the tenant's Cirro admins to shorten the app client's refresh-token lifetime when you do, since the login then persists on disk. Keep the default on an origin shared with other sites, such as a `github.io` Pages site, where every site on it could read the tokens.
- **Signing out** revokes the refresh token at the `revocation_endpoint` (the token server revokes refresh tokens only) and removes the user from the library, which it does even when revocation fails; the app then shows the revocation error instead of reloading. That ends the app's session; the user stays signed in to Cirro itself, so signing in again goes straight through.

## Checking it works

1. Load the app signed out and click **Sign in with Cirro**: Cirro's authorize page should name your app and list its permissions.
2. After sign-in, call `data.projects.getProjects()` and confirm the list matches what the user sees in Cirro.
3. Once the app is approved, sign in as a second user.
4. Leave the tab past the access-token lifetime and confirm calls still succeed.

If something fails, check [troubleshooting](troubleshooting.md) before changing code; most failures are registration mismatches.
