import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  // Proxy the gh-bridge API to the Bun server during dev.
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_SERVER_ORIGIN ?? "http://localhost:8788",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@offlinear/shared": fileURLToPath(
        new URL("../../packages/shared/src", import.meta.url)
      ),
    },
  },
});
