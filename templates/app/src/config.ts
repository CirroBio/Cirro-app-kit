// Reads build-time config and reports problems before anything tries to sign in.

export const config = {
  // The tenant's web address. Cirro's sign-in page is at /authorize under it, and the API at /api.
  url: (import.meta.env.VITE_CIRRO_URL ?? "").trim().replace(/\/+$/, ""),
  // Optional: only for local development with your own App Developer registration. Without it,
  // the app gets its client ID from the tenant by its callback URL.
  devClientId: (import.meta.env.VITE_CIRRO_CLIENT_ID ?? "").trim(),
};

export const configProblems: string[] = [];
if (!/^https:\/\/[^/]+$/.test(config.url) || config.url.includes("your-tenant.example")) {
  configProblems.push(
    "VITE_CIRRO_URL is not set to your Cirro tenant's web address, such as https://app.cirro.bio."
  );
}
