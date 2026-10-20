import { UserManager, type User } from "oidc-client-ts";

// Sign-in returns here, and the registration must list it character for character: SAML sign-in
// fails on a trailing-slash difference. An app served under a path (Vite `base`, e.g. a GitHub
// Pages project site) returns to that path.
export const REDIRECT_URI = import.meta.env.BASE_URL === "/"
  ? window.location.origin
  : window.location.origin + import.meta.env.BASE_URL;

// Sign-in goes through Cirro's authorize page, which shows the user this app's name and
// requested permissions and lets them pick their sign-in provider. The tenant publishes its
// endpoints (authorize, token, revocation) in its OAuth metadata document; tokens use PKCE.
export function createSignIn(cirroUrl: string, clientId: string): UserManager {
  return new UserManager({
    authority: cirroUrl,
    metadataUrl: `${cirroUrl}/.well-known/oauth-authorization-server`,
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
export async function currentUser(userManager: UserManager): Promise<User | null> {
  const params = new URLSearchParams(window.location.search);
  if (params.has("code") && params.has("state")) {
    const user = await userManager.signinRedirectCallback();
    window.history.replaceState({}, "", window.location.pathname);
    return user;
  }
  return activeUser(userManager);
}

// The stored user, renewed with the refresh token if its access token has expired (a tab that
// slept past automatic renewal); null when renewal fails, which means the user is signed out.
export async function activeUser(userManager: UserManager): Promise<User | null> {
  const user = await userManager.getUser();
  if (!user?.expired) return user;
  return userManager.signinSilent().catch(() => null);
}

// Ends the app's session: revokes the refresh token (the only kind the token server revokes)
// and forgets the user. The user stays signed in to Cirro itself.
export async function signOut(userManager: UserManager) {
  try {
    await userManager.revokeTokens(["refresh_token"]);
  } catch (e) {
    throw new Error(`Signed out of this app, but the refresh token was not revoked: ${e instanceof Error ? e.message : e}`);
  } finally {
    // Forget the user even when revocation fails, so a failed sign-out can't leave them signed in.
    await userManager.removeUser();
  }
  window.location.assign(REDIRECT_URI);
}
