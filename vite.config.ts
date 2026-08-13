import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function characterCreationV09Route(): Plugin {
  const legacyRoute = '{snapshot.role === "player" && route === "create" && <CharacterCreateScreen onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}';
  const v09Route = '{snapshot.role === "player" && route === "create" && <CharacterCreateScreenV09 onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}';

  return {
    name: "simplevtt-character-creation-v09-route",
    enforce: "pre",
    transform(code, id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/App.tsx")) return null;
      if (!code.includes(legacyRoute)) throw new Error("Expected legacy CharacterCreateScreen route was not found.");
      return {
        code: `import { CharacterCreateScreenV09 } from "./CharacterCreateV09";\n${code.replace(legacyRoute, v09Route)}`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [characterCreationV09Route(), react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
