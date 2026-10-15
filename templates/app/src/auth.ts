import { UserManager, type OidcMetadata, type User } from "oidc-client-ts";

// Sign-in returns here, and the registration must list it character for character: SAML sign-in
// fails on a trailing-slash difference. An app served under a path (Vite `base`, e.g. a GitHub
// Pages project site) returns to that path.
export const REDIRECT_URI = import.meta.env.BASE_URL === "/"
  ? window.location.origin
  : window.location.origin + import.meta.env.BASE_URL;

// Sign-in goes through Cirro's authorize page, which shows the user this app's name and
// requested permissions and lets them pick their sign-in provider. The tenant publishes its
// endpoints (authorize, token, revocation) in its OAuth metadata document; tokens use PKCE.
export async function createSignIn(cirroUrl: string, clientId: string): Promise<UserManager> {
  // Fetched here rather than through the library's metadataUrl: the document is served as
  // text/json, and oidc-client-ts refuses any Content-Type but application/json.
  const url = `${cirroUrl}/.well-known/oauth-authorization-server`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load sign-in settings: ${url} answered HTTP ${res.status}`);
  const metadata: Partial<OidcMetadata> = await res.json();
  return new UserManager({
    authority: cirroUrl,
    metadata,
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    // Public Apps allow only the openid scope; asking for more fails with invalid_scope.
    scope: "openid",
    // The ID token carries the username; skip the extra userinfo request.
    loadUserInfo: false,
    automaticSilentRenew: true,
  });
}

// Finishes a sign-in redirect if this page load is one, then returns the signed-in user, if any.
export async function currentUser(signIn: UserManager): Promise<User | null> {
  const params = new URLSearchParams(window.location.search);
  if (params.has("code") && params.has("state")) {
    const user = await signIn.signinRedirectCallback();
    window.history.replaceState({}, "", window.location.pathname);
    return user;
  }
  const user = await signIn.getUser();
  return user && !user.expired ? user : null;
}

// Ends the app's session: revokes the refresh token (the only kind the token server revokes)
// and forgets the user. The user stays signed in to Cirro itself.
export async function signOut(signIn: UserManager) {
  await signIn.revokeTokens(["refresh_token"]);
  await signIn.removeUser();
  window.location.assign(REDIRECT_URI);
}
