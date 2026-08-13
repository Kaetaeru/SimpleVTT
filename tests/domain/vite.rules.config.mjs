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
        temporaryHp: resolve(process.cwd(), "src/domain/temporaryHp.ts"),
        lifeTransitions: resolve(process.cwd(), "src/domain/lifeTransitions.ts"),
        turnEconomy: resolve(process.cwd(), "src/domain/turnEconomy.ts"),
        initiative: resolve(process.cwd(), "src/domain/initiative.ts"),
        reactionWindow: resolve(process.cwd(), "src/domain/reactionWindow.ts"),
        stateChange: resolve(process.cwd(), "src/domain/stateChange.ts"),
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
