import { Amplify } from "aws-amplify";
import { AmplifyAuthProvider } from "@cirrobio/react-auth";
import type { AppConfig } from "@cirrobio/react-core";
import type { LoginProvider } from "@cirrobio/api-client";

// react-auth 0.0.8 hard-codes five OAuth scopes, and Cognito refuses the whole sign-in
// (invalid_scope) if the registration allows fewer. Public Apps on dev.cirro.bio allow only
// openid, and the API accepts tokens issued with it (verified 2026-10-11).
const SCOPES = ["openid"];
// Cirro's emailed sign-in can't work for a registered app: its client doesn't allow Cognito's
// custom-auth flow, and the link can't return to an external app; see docs/authentication.md.
const EMAIL_LINK_PROVIDER = "COGNITO";

// Sign-in returns here, and the registration must list it exactly. An app served under a path
// (e.g. https://<org>.github.io/<repo>/) uses origin + import.meta.env.BASE_URL instead.
const REDIRECT_URI = window.location.origin;

// Configures Amplify itself instead of calling super.configure(). react-auth's configure sets
// window.location.origin and its own scopes, and Amplify finishes a returning sign-in with the
// first configuration it sees; where that differs from what the sign-in started with (an app
// under a path), the token request fails and the one-provider login dialog redirects again,
// in a loop.
export class CirroAuthProvider extends AmplifyAuthProvider {
  private providers: LoginProvider[] = [];

  configure(config: AppConfig): void {
    this.providers = config.tenantInfo.loginProviders;
    // As react-auth's configureAmplify, with SCOPES and REDIRECT_URI.
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: config.auth.userPoolId,
          userPoolClientId: this.clientId ?? config.auth.uiAppId,
          loginWith: {
            oauth: {
              domain: config.auth.endpoint,
              scopes: SCOPES,
              redirectSignIn: [REDIRECT_URI],
              redirectSignOut: [REDIRECT_URI],
              responseType: "code",
            },
          },
        },
      },
      API: { GraphQL: { endpoint: config.liveEndpoint, region: config.region, defaultAuthMode: "userPool" } },
    });
  }

  getLoginProviders(): LoginProvider[] {
    return this.providers.filter((p) => p.id !== EMAIL_LINK_PROVIDER);
  }
}
