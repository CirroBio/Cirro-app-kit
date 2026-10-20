import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // The app's own path, which makes its callback URL (origin + base) unique in each tenant.
  // Rename it to your app's slug, and keep the trailing slash.
  base: "/cirro-app/",
  plugins: [react()],
});
