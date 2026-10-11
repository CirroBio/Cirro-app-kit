// Reads build-time config and reports problems before anything tries to sign in.
// A missing client ID otherwise falls back to Cirro's own UI client, which fails
// later with a confusing redirect_mismatch or invalid_client error.

export const config = {
  api: (import.meta.env.VITE_CIRRO_API ?? "").trim(),
  clientId: (import.meta.env.VITE_CIRRO_CLIENT_ID ?? "").trim(),
};

export const configProblems: string[] = [];
if (!config.api) {
  configProblems.push(
    "VITE_CIRRO_API is not set. Use /api in development (with CIRRO_PROXY_TARGET), or your tenant's API URL in production."
  );
}
if (!config.clientId) {
  configProblems.push(
    "VITE_CIRRO_CLIENT_ID is not set. You need a development registration for your app; see docs/getting-started.md."
  );
}
