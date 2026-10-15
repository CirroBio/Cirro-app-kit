// Reads build-time config and reports problems before anything tries to sign in.

export const config = {
  // The tenant's web address. Cirro's sign-in page is at /authorize under it, and the API at /api.
  url: (import.meta.env.VITE_CIRRO_URL ?? "").trim().replace(/\/+$/, ""),
  clientId: (import.meta.env.VITE_CIRRO_CLIENT_ID ?? "").trim(),
};

export const configProblems: string[] = [];
if (!/^https:\/\/[^/]+$/.test(config.url) || config.url.includes("your-tenant.example")) {
  configProblems.push(
    "VITE_CIRRO_URL is not set to your Cirro tenant's web address, such as https://app.cirro.bio."
  );
}
if (!config.clientId) {
  configProblems.push(
    "VITE_CIRRO_CLIENT_ID is not set. You need a development registration for your app; see docs/getting-started.md."
  );
}
