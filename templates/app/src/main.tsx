import React from "react";
import ReactDOM from "react-dom/client";
import { DataService } from "@cirrobio/sdk";
import { config, configProblems } from "./config";
import { ConfigError } from "./ConfigError";
import { REDIRECT_URI, activeUser, createSignIn, currentUser, signOut } from "./auth";
import { App } from "./App";

const root = ReactDOM.createRoot(document.getElementById("root")!);
const style = { padding: 24, fontFamily: "system-ui, sans-serif" };

function showError(e: unknown) {
  root.render(
    <main style={style} role="alert">
      <p>{e instanceof Error ? e.message : String(e)}</p>
      <button onClick={() => window.location.assign(REDIRECT_URI)}>Try again</button>
    </main>
  );
}

async function start() {
  // A failed return from sign-in, usually a registration that doesn't match. Show it rather
  // than offering to sign in again, which would fail the same way.
  const returned = new URLSearchParams(window.location.search);
  if (returned.has("error")) {
    throw new Error(`Sign-in failed: ${returned.get("error_description") ?? returned.get("error")}`);
  }

  const userManager = await createSignIn(config.url, config.devClientId);
  const user = await currentUser(userManager);
  if (!user) {
    root.render(
      <main style={style}>
        <h1>Cirro app</h1>
        <p>Sign in with your Cirro account to continue.</p>
        <button onClick={() => userManager.signinRedirect().catch(showError)}>Sign in with Cirro</button>
      </main>
    );
    return;
  }

  const dataService = new DataService({
    basePath: `${config.url}/api`,
    tokenGetter: async () => {
      const current = await activeUser(userManager);
      if (!current) throw new Error("Signed out");
      return current.access_token;
    },
  });
  // The tenant's name, shown so users can see which Cirro they're working in.
  const system = await dataService.system.info();
  root.render(
    <React.StrictMode>
      <App
        dataService={dataService}
        tenantName={system.tenantInfo.name}
        username={String(user.profile["cognito:username"] ?? user.profile.sub)}
        onSignOut={() => signOut(userManager).catch(showError)}
      />
    </React.StrictMode>
  );
}

if (configProblems.length) {
  root.render(<ConfigError problems={configProblems} />);
} else {
  start().catch(showError);
}
