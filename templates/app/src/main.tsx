import React from "react";
import ReactDOM from "react-dom/client";
import { DataService } from "@cirrobio/sdk";
import type { SystemInfoResponse } from "@cirrobio/api-client";
import { config, configProblems } from "./config";
import { ConfigError } from "./ConfigError";
import { REDIRECT_URI, createSignIn, currentUser, signOut } from "./auth";
import { App } from "./App";

const root = ReactDOM.createRoot(document.getElementById("root")!);
const style = { padding: 24, fontFamily: "system-ui, sans-serif" };

async function start() {
  // Public: the tenant's name, shown so users can see where they're signing in.
  const res = await fetch(`${config.url}/api/info/system`);
  if (!res.ok) throw new Error(`Could not reach Cirro: ${config.url}/api/info/system answered HTTP ${res.status}`);
  const system: SystemInfoResponse = await res.json();

  // A failed return from sign-in, usually a registration that doesn't match. Show it rather
  // than offering to sign in again, which would fail the same way.
  const returned = new URLSearchParams(window.location.search);
  if (returned.has("error")) {
    throw new Error(`Sign-in failed: ${returned.get("error_description") ?? returned.get("error")}`);
  }

  const signIn = await createSignIn(config.url, config.clientId);
  const user = await currentUser(signIn);
  if (!user) {
    root.render(
      <main style={style}>
        <h1>Cirro app</h1>
        <p>Sign in with your {system.tenantInfo.name} account to continue.</p>
        <button onClick={() => signIn.signinRedirect()}>Sign in with Cirro</button>
      </main>
    );
    return;
  }

  const dataService = new DataService({
    basePath: `${config.url}/api`,
    tokenGetter: async () => {
      const current = await signIn.getUser();
      if (!current) throw new Error("Signed out");
      return current.access_token;
    },
  });
  root.render(
    <React.StrictMode>
      <App
        dataService={dataService}
        tenantName={system.tenantInfo.name}
        username={String(user.profile["cognito:username"] ?? user.profile.sub)}
        onSignOut={() => signOut(signIn)}
      />
    </React.StrictMode>
  );
}

if (configProblems.length) {
  root.render(<ConfigError problems={configProblems} />);
} else {
  start().catch((e) => {
    root.render(
      <main style={style} role="alert">
        <p>{e instanceof Error ? e.message : String(e)}</p>
        <button onClick={() => window.location.assign(REDIRECT_URI)}>Try again</button>
      </main>
    );
  });
}
