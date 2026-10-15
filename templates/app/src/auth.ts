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

export class CirroAuthProvider extends AmplifyAuthProvider {
  configure(config: AppConfig): void {
    super.configure(config);
    // As react-auth's configureAmplify, with SCOPES.
    Amplify.configure({
      Auth: {
        Cognito: {
          userPoolId: config.auth.userPoolId,
          userPoolClientId: this.clientId ?? config.auth.uiAppId,
          loginWith: {
            oauth: {
              domain: config.auth.endpoint,
              scopes: SCOPES,
              redirectSignIn: [window.location.origin],
              redirectSignOut: [window.location.origin],
              responseType: "code",
            },
          },
        },
      },
      API: { GraphQL: { endpoint: config.liveEndpoint, region: config.region, defaultAuthMode: "userPool" } },
    });
  }

  getLoginProviders(): LoginProvider[] {
    return super.getLoginProviders().filter((p) => p.id !== EMAIL_LINK_PROVIDER);
  }
}
