/**
 * V0.9 D349: the offline sheet printer.
 *
 * The printer reads a character file, works it out with the app's own engine and lays it out as two pages. These
 * check the round trip the page performs — export, parse, derive, render — and that what is printed is what the
 * engine derived: the armour class, the hit points, a skill bonus, a spell's name, a module's feature.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { deriveCharacter } from "../../client/character/derive";
import { exportCharacterFile, parseCharacterFile, serializeCharacterFile } from "../../client/character/json";
import { initialRuntime } from "../../client/character/runtime";
import { sheetHtml } from "../../client/print/sheetHtml";
import { sourceOf } from "./support";

/** What the printer's page does with a file, without the page. */
function print(text: string, modules: RuleModuleJson[] = []) {
  const parsed = parseCharacterFile(text);
  assert.ok(parsed.source, parsed.errors.join(" · "));
  const catalog = createCatalog(modules);
  const runtime = parsed.runtime;
  const derived = deriveCharacter(parsed.source!, catalog, { equipped: runtime?.equipped, inventory: runtime?.inventory, effects: runtime?.effects });
  return { html: sheetHtml({ derived, runtime, catalog, notes: parsed.source!.notes }), derived };
}

const escapeLike = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

test("D349: a character file prints what the engine works out", () => {
  const catalog = createCatalog([]);
  const made = autofill(sourceOf({ name: "라엘", classes: "wizard", level: 5, abilities: { int: 16, dex: 14 } }), catalog);
  const base = initialRuntime(made.derived);
  const runtime = { ...base, hp: { ...base.hp, current: 17 } };
  const file = serializeCharacterFile(exportCharacterFile(made.source, runtime, made.derived));
  const { html, derived } = print(file);
  assert.equal((html.match(/class="page"/g) ?? []).length, 2, "two pages");
  assert.ok(html.includes("라엘"));
  assert.ok(html.includes(`<div class="value">${derived.ac.value}</div><div class="label">방어도</div>`), "the armour class the engine derived");
  assert.ok(html.includes(`<div class="value">${derived.hp.max}</div><div class="label">최대 HP</div>`));
  assert.ok(html.includes(`<div class="value">17</div><div class="label">현재 HP</div>`), "the current hit points come from the runtime");
  const skill = derived.skills.find((item) => item.ability === "int")!;
  assert.ok(html.includes(escapeLike(skill.name)), "a skill is listed under its ability");
  const casting = derived.spellcasting[0];
  assert.ok(casting, "a wizard casts spells");
  assert.ok(html.includes(`<div class="value">${casting.saveDc}</div><div class="label">주문 내성 DC</div>`));
  const spell = catalog.spellById(casting.cantrips[0] ?? casting.prepared[0]);
  assert.ok(spell && html.includes(spell.name), "spells are printed by name, not by id");
});

test("D349: text from the file is printed as text, never as markup", () => {
  const catalog = createCatalog([]);
  const made = autofill(sourceOf({ name: "<img src=x onerror=alert(1)>", classes: "fighter", level: 1 }), catalog);
  const { html } = print(serializeCharacterFile(exportCharacterFile(made.source, initialRuntime(made.derived), made.derived)));
  assert.equal(html.includes("<img"), false);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
});

test("D349: a character built with a module prints that module's features", () => {
  const FEAT = "test.d349.feat.lamplighter";
  const module = { moduleId: "test.d349", moduleVersion: "1", content: [{
    id: FEAT, category: "feat",
    presentation: { originalName: "Lamplighter", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "등불지기", description: "등불을 밝힌다" } } },
    mechanics: [{ kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } }],
  }] } as unknown as RuleModuleJson;
  const catalog = createCatalog([module]);
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "등지기", classes: "fighter", level: 4, choices: prefer }), catalog, { prefer });
  const text = serializeCharacterFile(exportCharacterFile(made.source, initialRuntime(made.derived), made.derived));
  assert.ok(print(text, [module]).html.includes("등불지기"), "with the module, its feat is on the sheet");
});
