import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** The new client (docs/design/v3/NEW_CLIENT.md): a browser-first app rooted at `client/`, built to `dist-client/`. */
export default defineConfig({
  root: "client",
  plugins: [react()],
  clearScreen: false,
  publicDir: false,
  build: { outDir: "../dist-client", emptyOutDir: true },
  server: { port: 1430, strictPort: true, watch: { ignored: ["**/src-tauri/**", "**/.live-dev/**"] } },
});
