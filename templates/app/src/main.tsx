import React from "react";
import ReactDOM from "react-dom/client";
import { AppConfigProvider } from "@cirrobio/react-core";
import { AmplifyAuthProvider, AuthenticationContextProvider, LoginWrapper } from "@cirrobio/react-auth";
import { config, configProblems } from "./config";
import { ConfigError } from "./ConfigError";
import { ConfigGate } from "./ConfigGate";
import { App } from "./App";

const root = ReactDOM.createRoot(document.getElementById("root")!);

if (configProblems.length) {
  root.render(<ConfigError problems={configProblems} />);
} else {
  // Created once, at module scope, with the registered Public App's client ID.
  const auth = new AmplifyAuthProvider(config.clientId);
  root.render(
    <React.StrictMode>
      <AppConfigProvider apiBasePath={config.api} authProvider={auth}>
        <ConfigGate>
          <AuthenticationContextProvider fetchUserInfo>
            <LoginWrapper>
              <App />
            </LoginWrapper>
          </AuthenticationContextProvider>
        </ConfigGate>
      </AppConfigProvider>
    </React.StrictMode>
  );
}
