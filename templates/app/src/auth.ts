import { UserManager, type User } from "oidc-client-ts";
import type { SystemInfoResponse } from "@cirrobio/api-client";

// Sign-in returns here, and the registration must list it character for character: SAML sign-in
// fails on a trailing-slash difference. An app served under a path (Vite `base`, e.g. a GitHub
// Pages project site) returns to that path.
export const REDIRECT_URI = import.meta.env.BASE_URL === "/"
  ? window.location.origin
  : window.location.origin + import.meta.env.BASE_URL;

// Sign-in goes through Cirro's authorize page, which shows the user this app's name and
// requested permissions and lets them pick their sign-in provider, then hands off to the
// tenant's Cognito user pool. Tokens come straight from Cognito, using PKCE.
export function createSignIn(cirroUrl: string, clientId: string, system: SystemInfoResponse): UserManager {
  const issuer = `https://cognito-idp.${system.region}.amazonaws.com/${system.auth.userPoolId}`;
  const cognito = `https://${system.auth.endpoint}`;
  return new UserManager({
    authority: issuer,
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    post_logout_redirect_uri: REDIRECT_URI,
    response_type: "code",
    // Public Apps allow only the openid scope; asking for more fails with invalid_scope.
    scope: "openid",
    metadata: {
      issuer,
      authorization_endpoint: `${cirroUrl}/authorize`,
      token_endpoint: `${cognito}/oauth2/token`,
      end_session_endpoint: `${cognito}/logout`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
    },
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

// Cognito's logout endpoint takes logout_uri and client_id rather than the OIDC parameters.
export async function signOut(signIn: UserManager, cognitoDomain: string, clientId: string) {
  await signIn.removeUser();
  const query = new URLSearchParams({ client_id: clientId, logout_uri: REDIRECT_URI });
  window.location.assign(`https://${cognitoDomain}/logout?${query}`);
}
