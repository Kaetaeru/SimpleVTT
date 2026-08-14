import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function characterProgressionRoutes(): Plugin {
  const legacyCharacterRoute = '{snapshot.role === "player" && route === "character" && <CharacterSheetScreen onScene={() => setRoute("scene")} onLevelUp={() => setRoute("levelup")} onEdit={() => setRoute("create")} />}';
  const officialCharacterRoute = '{snapshot.role === "player" && route === "character" && <CharacterSheetV10 onScene={() => setRoute("scene")} onLevelUp={() => setRoute("levelup")} onEdit={() => setRoute("create")} />}';
  const legacyCreateRoute = '{snapshot.role === "player" && route === "create" && <CharacterCreateScreen onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}';
  const focusedCreateRoute = '{snapshot.role === "player" && route === "create" && <CharacterCreateScreenV10 onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}';
  const legacyLevelRoute = '{snapshot.role === "player" && route === "levelup" && <LevelUpScreen onDone={() => setRoute("character")} onCancel={() => setRoute("character")} />}';
  const focusedLevelRoute = '{snapshot.role === "player" && route === "levelup" && <LevelUpFocused onDone={() => setRoute("character")} onCancel={() => setRoute("character")} />}';

  return {
    name: "simplevtt-character-progression-routes",
    enforce: "pre",
    transform(code, id) {
      if (!id.replaceAll("\\", "/").endsWith("/src/App.tsx")) return null;
      if (!code.includes(legacyCharacterRoute)) throw new Error("Expected legacy CharacterSheetScreen route was not found.");
      if (!code.includes(legacyCreateRoute)) throw new Error("Expected legacy CharacterCreateScreen route was not found.");
      if (!code.includes(legacyLevelRoute)) throw new Error("Expected legacy LevelUpScreen route was not found.");
      return {
        code: `import { CharacterSheetV10 } from "./CharacterSheetV10";\nimport { CharacterCreateScreenV10 } from "./CharacterCreateV10";\nimport { LevelUpFocused } from "./CharacterCreateV09";\n${code.replace(legacyCharacterRoute, officialCharacterRoute).replace(legacyCreateRoute, focusedCreateRoute).replace(legacyLevelRoute, focusedLevelRoute)}`,
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [characterProgressionRoutes(), react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
