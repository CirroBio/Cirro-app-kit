import type { ReactNode } from "react";
import { useAppConfig } from "@cirrobio/react-core";

// AppConfigProvider renders its children before /info/system has loaded. Mounted
// that early, AuthenticationContextProvider checks the session before the auth
// provider is configured, and LoginWrapper's login modal throws reading the
// tenant's login providers (react-auth 0.0.8). See docs/packages.md#known-issues.
export function ConfigGate({ children }: { children: ReactNode }) {
  const { loadState, refresh } = useAppConfig();
  const style = { padding: 24, fontFamily: "system-ui, sans-serif" };
  if (loadState === "LOADING") return <p style={style} aria-busy="true">Connecting to Cirro…</p>;
  if (loadState === "MAINTENANCE_MODE") return <p style={style} role="alert">Cirro is down for maintenance. Try again later.</p>;
  if (loadState === "ERROR") {
    return (
      <div style={style} role="alert">
        <p>Could not reach Cirro. Check your connection and the API address the app is configured with.</p>
        <button onClick={refresh}>Try again</button>
      </div>
    );
  }
  return <>{children}</>;
}
