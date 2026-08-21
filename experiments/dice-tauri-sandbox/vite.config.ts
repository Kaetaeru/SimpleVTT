import { defineConfig } from "vite";

export default defineConfig({
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1431,
    strictPort: true,
    watch: {
      // Tauri/Cargo watches Rust sources separately. Vite must not watch
      // src-tauri/target on Windows because freshly linked .exe files are
      // temporarily locked and Node's FSWatcher reports EBUSY.
      ignored: ["**/src-tauri/**", "**/target/**"],
    },
  },
});
