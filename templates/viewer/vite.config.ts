import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// In development, set VITE_CIRRO_API=/api and CIRRO_PROXY_TARGET to the tenant
// (your tenant's web address) to avoid cross-origin calls from localhost.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (mode === "development" && env.VITE_CIRRO_API === "/api" &&
      (!env.CIRRO_PROXY_TARGET || env.CIRRO_PROXY_TARGET.includes("your-tenant.example"))) {
    console.warn("\n  CIRRO_PROXY_TARGET is not set to a real tenant; API calls to /api will fail. See docs/getting-started.md\n");
  }
  return {
    plugins: [react()],
    server: env.CIRRO_PROXY_TARGET
      ? { proxy: { "/api": { target: env.CIRRO_PROXY_TARGET, changeOrigin: true, secure: true } } }
      : undefined,
  };
});
