import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(process.cwd(), "tests/ui/characterCreationV09Smoke.ts"),
      formats: ["es"],
      fileName: () => "characterCreationV09Smoke.js",
    },
    outDir: ".ui-smoke-build",
    emptyOutDir: true,
    minify: false,
  },
});
