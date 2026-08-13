import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: {
        profileEngine: resolve(process.cwd(), "src/domain/profileEngine.ts"),
        d20: resolve(process.cwd(), "src/domain/d20.ts"),
        damage: resolve(process.cwd(), "src/domain/damage.ts"),
        damageRoll: resolve(process.cwd(), "src/domain/damageRoll.ts"),
        life: resolve(process.cwd(), "src/domain/life.ts"),
      },
      formats: ["es"],
    },
    outDir: ".rules-build",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
