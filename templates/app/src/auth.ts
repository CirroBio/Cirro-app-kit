import { UserManager, type OidcMetadata, type User } from "oidc-client-ts";

// The app's callback URL. The tenant finds the app's registration by it, so it must be unique to
// the app in each tenant (vite.config.ts gives the app its own path), and the registration must
// list it character for character: SAML sign-in fails on a trailing-slash difference.
export const REDIRECT_URI = import.meta.env.BASE_URL === "/"
  ? window.location.origin
  : window.location.origin + import.meta.env.BASE_URL;

// Sign-in goes through Cirro's authorize page, which shows the user this app's name and
// requested permissions and lets them pick their sign-in provider. The tenant publishes its
// endpoints (authorize, token, revocation, registration) in its OAuth metadata document; tokens
// use PKCE. devClientId is for local development with your own App Developer registration;
// otherwise the client ID comes from the tenant, by callback URL.
export async function createSignIn(cirroUrl: string, devClientId: string): Promise<UserManager> {
  const metadataUrl = `${cirroUrl}/.well-known/oauth-authorization-server`;
  const res = await fetch(metadataUrl);
  if (!res.ok) throw new Error(`Could not load sign-in settings: ${metadataUrl} answered HTTP ${res.status}`);
  const metadata: Partial<OidcMetadata> = await res.json();
  return new UserManager({
    authority: cirroUrl,
    metadata,
    client_id: devClientId || await registeredClientId(metadata.registration_endpoint!),
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    // Public Apps allow only the openid scope; asking for more fails with invalid_scope.
    scope: "openid",
    // The ID token carries the username; skip the extra userinfo request.
    loadUserInfo: false,
    automaticSilentRenew: true,
  });
}

// Asks the tenant for the client ID of the registration that lists this app's callback URL
// (dynamic client registration, RFC 7591). A tenant admin sets that registration up, with
// discovery enabled; the app never stores or ships a client ID.
async function registeredClientId(registrationEndpoint: string): Promise<string> {
  const res = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (res.status === 401) {
    throw new Error(`No app is registered in this tenant for ${REDIRECT_URI}. A tenant admin registers it, with discovery enabled.`);
  }
  if (res.status === 409) {
    throw new Error(`More than one app in this tenant is registered for ${REDIRECT_URI}; each app needs its own callback URL.`);
  }
  if (!res.ok) throw new Error(`Could not get this app's client ID: ${registrationEndpoint} answered HTTP ${res.status}`);
  return (await res.json()).client_id;
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
