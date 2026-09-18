/**
 * V0.9 D300: the grammar an installed module needed and did not have — a subclass's always-prepared spells, a swimming
 * speed, dice an expression decides for healing and temporary hit points, and (dis)advantage imposed after the roll.
 *
 * Everything here is a *synthetic* module, not the SRD and not anyone's supplement: the point is that content the app
 * does not ship works the same way the SRD content does (CLAUDE.md §1.6, §2).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { deriveCharacter } from "../../client/character/derive";
import { emptySource } from "../../client/character/source";
import { featureActivation, featureRuleKey } from "../../client/rules/activation";
import { contractDurations } from "../../client/rules/contractActivation";
import { characterScope, parseContract, planRollModify } from "../../client/rules/contract";
import { promptAnswerer, promptIsMine } from "../../client/screens/Notify";
import type { RuleModuleJson } from "../../client/catalog/types";

const SUBCLASS = "test.d300.subclass.tide";
const FEATURE = `${SUBCLASS}.feature.3-1`;

const MODULE = {
  moduleId: "test.d300", moduleVersion: "1",
  content: [
    {
      id: SUBCLASS, category: "subclass",
      presentation: { originalName: "Tide", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "조수의 권역" } } },
      relationships: [{ kind: "parent", target: "dnd.srd521.class.cleric" }],
      progressionContributions: [{ track: "dnd.srd521.class.cleric", threshold: 3, grants: [FEATURE] }],
      // D300: always-prepared spells by class level — an id or an English name, whichever the module wrote.
      mechanics: [{ kind: "subclass-definition", config: { spells: { "3": ["dnd.srd521.spell.cure-wounds"], "5": ["Fireball"] } } }],
    },
    {
      id: FEATURE, category: "option",
      presentation: { originalName: "Tide Step", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "조수 걸음" } } },
      mechanics: [{
        kind: "common-play",
        config: {
          id: FEATURE,
          payments: [{ kind: "resource", resource: "resource:test.d300.tide", amount: { value: 1 }, consumeAt: "commit" }],
          entryPoints: [
            { id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.resource", operation: "add", value: { value: 2 }, params: { id: "resource.test.d300.tide", label: "조수", recovery: "long-rest" } }] },
            { id: "swim", invocation: "manual", operations: [{ kind: "property.modify", property: "speed.swim-as-walk", operation: "add", value: { value: 0 }, note: "조수 걸음" }] },
            { id: "heal", invocation: "manual", label: "조수 걸음: 회복", operations: [{ kind: "healing.apply", target: "self", diceCount: { value: 2 }, diceSides: { ref: "proficiency.bonus" } }] },
            { id: "ward", invocation: "manual", label: "조수 걸음: 임시 HP", operations: [{ kind: "temp-hp.grant", target: "self", diceCount: { value: 1 }, diceSides: { value: 8 }, amount: { ref: "ability.wis.modifier" } }] },
          ],
        },
      }],
    },
  ],
} as unknown as RuleModuleJson;

/** A cleric of the installed subclass, built with every other choice auto-answered. */
function cleric(level: number) {
  const catalog = createCatalog([MODULE]);
  const source = emptySource({
    name: "조수", origin: { speciesId: "dnd.srd521.species.human", backgroundId: "dnd.srd521.background.soldier" },
    abilities: { method: "manual", base: { str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 12 } },
    tracks: Array.from({ length: level }, () => ({ classId: "dnd.srd521.class.cleric", hp: { kind: "fixed" as const } })),
    choices: { "class.2.subclass": [SUBCLASS] },
    equipment: { mode: "loadout" },
  });
  const filled = autofill(source, catalog, { prefer: { "class.2.subclass": [SUBCLASS] } });
  return { catalog, derived: deriveCharacter(filled.source, catalog) };
}

test("D300: an installed subclass prepares its own spells, by class level", () => {
  const catalog = createCatalog([MODULE]);
  const view = catalog.subclassById(SUBCLASS)!;
  assert.equal(view.classId, "dnd.srd521.class.cleric");
  assert.deepEqual(view.spells[3], ["dnd.srd521.spell.cure-wounds"]);
  // An English name resolves to the same id the catalog knows the spell by.
  assert.deepEqual(view.spells[5], [catalog.spellByName("Fireball")!.id]);

  const third = cleric(3).derived;
  const prepared = third.spellcasting[0]?.alwaysPrepared ?? [];
  assert.ok(prepared.includes("dnd.srd521.spell.cure-wounds"), JSON.stringify(prepared));
  assert.ok(!prepared.includes("dnd.srd521.spell.fireball"), "the 5th-level spell waits for 5th level");

  const fifth = cleric(5).derived;
  const later = fifth.spellcasting[0]?.alwaysPrepared ?? [];
  assert.ok(later.includes("dnd.srd521.spell.fireball"), JSON.stringify(later));
});

test("D300: a module feature may give a swimming speed, and dice its own expressions decide", () => {
  const { catalog, derived } = cleric(3);
  // The passive half of the contract is on the sheet: swimming at the walking speed.
  assert.equal(derived.speed.swim, derived.speed.walk);
  // The uses roll what their expressions say: 2 × the proficiency bonus as a die size, and 1d8 + WIS temporary HP.
  const feature = derived.features.find((item) => item.id === FEATURE)!;
  const durations = contractDurations(catalog, characterScope(derived));
  const heal = featureActivation({ ...feature, id: `${FEATURE}#heal` }, derived, durations);
  assert.equal(heal?.heal?.(derived), `2d${derived.proficiencyBonus}`);
  const ward = featureActivation({ ...feature, id: `${FEATURE}#ward` }, derived, durations);
  assert.equal(ward?.tempHp?.(derived), `1d8+${derived.abilities.wis.modifier}`);
  assert.equal(featureRuleKey(FEATURE), FEATURE);
});

test("D300: disadvantage after the roll keeps the worse die, advantage the better one", () => {
  const contract = parseContract({
    id: "test.d300.flare",
    interceptors: [{
      id: "flare", timing: "d20.outcome-determined", slot: "attack-roll", families: ["attack-roll"], outcomes: ["success"],
      interaction: { id: "use", kind: "choice", responder: "actor-owner", mode: "blocking", input: { type: "boolean" }, revalidate: "if-revision-changed", stalePolicy: "reject" },
      operations: [{ kind: "roll.modify", mode: "reroll-keep-lower", dice: "1d20" }],
    }],
  }, "test.d300.flare");
  assert.deepEqual(contract.unsupported, []);
  const scope = () => undefined;
  const low = planRollModify(contract.interceptors[0].operations, scope, { d: () => 7 }, undefined, 18);
  assert.equal(low.d20, 7, "the new die is worse, so it stands");
  const high = planRollModify(contract.interceptors[0].operations, scope, { d: () => 19 }, undefined, 12);
  assert.equal(high.d20, 12, "the die already rolled was worse, so it stays");
  // With no die to compare against, the new one simply stands — the window still does something.
  assert.equal(planRollModify(contract.interceptors[0].operations, scope, { d: () => 5 }).d20, 5);

  const better = parseContract({
    id: "test.d300.bless", interceptors: [{ id: "bless", timing: "d20.outcome-determined", slot: "saving-throw", families: [], outcomes: ["failure"], operations: [{ kind: "roll.modify", mode: "reroll-keep-higher", dice: "1d20" }] }],
  }, "test.d300.bless");
  assert.equal(planRollModify(better.interceptors[0].operations, scope, { d: () => 3 }, undefined, 11).d20, 11);
});

test("D301: the DM can answer a prompt whose reactor is not in their journal", () => {
  // The window used to be tied to the reactor's journal entry. When the sheet behind the token was not in the DM's
  // list, promptIsMine was false for everyone: chat showed "— 반응?" and no button existed anywhere.
  const message = {
    id: "m1", type: "prompt", who: "", content: "적중 — 반응?",
    prompt: { kind: "guard", mover: { name: "드래곤" }, reactor: { name: "야만", entryId: "gone", pageId: "p1", tokenId: "t1" }, guard: { features: [{ name: "보복" }] } },
  } as never;
  const snapshot = { players: [{ userId: "dm", role: "gm" as const, connected: true }, { userId: "p1", role: "player" as const, connected: true }], journal: [], pages: [] } as never;
  assert.equal(promptIsMine(message, snapshot, "dm"), true, "the DM answers anything at their own table");
  assert.equal(promptIsMine(message, snapshot, "p1"), false, "a player still needs to control the reactor");
  assert.equal(promptAnswerer(message, snapshot), null, "nobody else owns it, so the window falls to the DM");
});
