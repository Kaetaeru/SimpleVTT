import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

const read=(path:string)=>readFileSync(new URL(`../../${path}`,import.meta.url),"utf8");
const gone=(path:string)=>existsSync(new URL(`../../${path}`,import.meta.url))===false;

test("T1-09: the live session is the only play screen", () => {
  const app=read("src/App.tsx");
  const productRoot=read("src/ProductRoot.tsx");
  const main=read("src/main.tsx");
  assert.doesNotMatch(app,/ProductionPlayScreen/);
  assert.doesNotMatch(app,/route === "scene"/);
  assert.doesNotMatch(app,/setRoute\("scene"\)/);
  assert.match(productRoot,/<SessionModeRoot onOpenProduct=/);
  assert.match(productRoot,/return label === "플레이로 돌아가기"/);
  assert.doesNotMatch(main,/PlaySessionDock|ProductionPlayerLobbyBridge|play-session-dock\.css|production-player-lobby\.css/);
});

test("T1-09: the product-shell play screen and the orphaned session components are deleted", () => {
  for (const path of [
    "src/ProductionPlayScreen.tsx",
    "src/playerExperienceModel.ts",
    "src/PlaySessionDock.tsx",
    "src/play-session-dock.css",
    "src/ProductionPlayerLobbyBridge.tsx",
    "src/production-player-lobby.css",
    "src/CharacterCreateV09.tsx",
    "src/MovementReactionBridge.tsx",
    "src/ProductionSessionLifecycleBridge.tsx",
  ]) assert.ok(gone(path),`${path} should be deleted`);
});
