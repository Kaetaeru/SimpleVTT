import { defineConfig } from "vite";

/**
 * V0.9 D349: the offline sheet printer (client/print), built on its own. One script, no code splitting, so
 * `scripts/build-sheet-tool.mjs` can fold it into a single HTML file that opens from disk with no server.
 */
export default defineConfig({
  root: "client/print",
  base: "./",
  clearScreen: false,
  publicDir: false,
  build: {
    outDir: "../../dist-sheet",
    emptyOutDir: true,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 8000,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
