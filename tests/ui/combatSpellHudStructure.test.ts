import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { SRD_521_SPELL_MECHANICS } from "../../src/domain/spellMechanics";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

test("Phase 06 mechanics registry exposes executable attack, save, healing, area, and projectile spell primitives without prose parsing", () => {
  const entries = Object.values(SRD_521_SPELL_MECHANICS);
  assert.ok(entries.some((spell) => spell.runtimeSupport === "combat-executable" && spell.primary.kind === "attack-damage"));
  assert.ok(entries.some((spell) => spell.runtimeSupport === "combat-executable" && spell.primary.kind === "save-damage"));
  assert.ok(entries.some((spell) => spell.runtimeSupport === "combat-executable" && spell.primary.kind === "healing"));
  assert.ok(entries.some((spell) => spell.runtimeSupport === "combat-executable" && spell.primary.kind === "automatic-projectiles"));
  assert.equal(SRD_521_SPELL_MECHANICS["dnd.srd521.spell.vicious-mockery"].runtimeSupport, "partial");
  assert.equal(SRD_521_SPELL_MECHANICS["dnd.srd521.spell.thunderwave"].runtimeSupport, "partial");
});

test("combat spell HUD reuses canonical SpellTile UI, shows slots separately, and preserves the existing target-selection buttons", () => {
  const hud = source("src/CombatSpellHud.tsx");
  const runtime = source("src/app/spellcastingRuntimeAdapter.ts");
  const main = source("src/main.tsx");
  const offlineRuntime = source("src/app/offlineRuntimeAdapters.ts");
  const css = source("src/combat-spell-hud.css");

  assert.match(hud, /SpellTile/);
  assert.match(hud, /combat-spell-slot-rail/);
  assert.match(hud, /button\[data-action-id/);
  assert.match(hud, /setSelectedCombatSpellSlot/);
  assert.match(runtime, /resolveSpellCast/);
  assert.match(runtime, /spell-slot-1/);
  assert.match(runtime, /runtimeSupport === "partial"/);
  assert.match(main, /CombatSpellHudBridge/);
  assert.match(main, /offlineRuntimeAdapters/);
  assert.match(offlineRuntime, /spellcastingRuntimeAdapter/);
  assert.match(offlineRuntime, /phase09SpellcastingRuntimeRouter/);
  assert.match(css, /phase06-magic-active/);
});
