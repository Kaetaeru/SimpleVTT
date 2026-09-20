/**
 * V0.9 D340 (SRD_MODULE_PLAN.md §31): the one weapon a spell was cast on.
 *
 * 원소 무기 and its kin touch a single weapon and give it a bonus to hit and extra damage. Every scope the effect
 * grammar knew named a *kind* of weapon (heavy, melee, a named item), so such a spell either buffed every weapon
 * the character held or stayed a line for the DM. `effect-weapon` is the scope for "the weapon this effect was
 * cast on": the effect's own target when the cast named one, otherwise the weapon in hand.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { addItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { ActiveEffect } from "../../client/character/types";
import { applyActiveEffects } from "../../client/rules/effects";
import { EFFECT_WEAPON_SCOPE } from "../../client/rules/contractEffects";
import { derivedOf } from "../../client/rules/attackSpec";
import { sourceOf } from "./support";

const SPELL = "test.d340.spell.elemental-weapon";
const SCALING = "test.d340.spell.scaling-weapon";
const steps = (low: number, mid: number, high: number) => ({ op: "if", args: [
  { op: "gte", args: [{ ref: "spell.slot-level" }, { value: 7 }] }, { value: high },
  { op: "if", args: [{ op: "gte", args: [{ ref: "spell.slot-level" }, { value: 5 }] }, { value: mid }, { value: low }] },
] });

const MODULE = {
  moduleId: "test.d340", moduleVersion: "1",
  content: [
    {
      id: `effect.spell.${SPELL}`, category: "option",
      presentation: { originalName: "Elemental Weapon", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "원소 무기", description: "무기 하나에 명중 +1과 화염 1d4" } } },
      mechanics: [{ kind: "common-play", config: { id: `spell:${SPELL}`, entryPoints: [
        { id: "while-active", invocation: "manual", operations: [
          { kind: "property.modify", property: "attack-roll.bonus", operation: "add", value: 1, scope: EFFECT_WEAPON_SCOPE, note: "원소 무기" },
          { kind: "property.modify", property: "damage.bonus", operation: "add", dice: "1d4", damageTypes: ["fire"], scope: EFFECT_WEAPON_SCOPE, note: "원소 무기" },
        ] },
      ] } }],
    },
    {
      id: `effect.spell.${SCALING}`, category: "option",
      presentation: { originalName: "Scaling Weapon", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "차오르는 무기", description: "슬롯이 클수록 더" } } },
      mechanics: [{ kind: "common-play", config: { id: `spell:${SCALING}`, entryPoints: [
        { id: "while-active", invocation: "manual", operations: [
          { kind: "property.modify", property: "attack-roll.bonus", operation: "add", value: steps(1, 2, 3), scope: EFFECT_WEAPON_SCOPE, note: "차오르는 무기" },
          { kind: "property.modify", property: "damage.bonus", operation: "add", dice: "1d4", diceCount: steps(1, 2, 3), damageTypes: ["fire"], scope: EFFECT_WEAPON_SCOPE, note: "차오르는 무기" },
        ] },
      ] } }],
    },
  ],
} as unknown as RuleModuleJson;

/** A fighter with the greatsword they started with in hand, and a handaxe in the bag. */
function fighter() {
  const cat = createCatalog([MODULE]);
  const made = autofill(sourceOf({ name: "기사", classes: "fighter", level: 4, abilities: { str: 16 } }), cat);
  const runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.handaxe", name: "손도끼" });
  const derived = derivedOf({ source: made.source, runtime } as never, cat);
  return { cat, derived };
}

const effect = (target?: string): ActiveEffect => ({ key: `spell:${SPELL}`, name: "원소 무기", source: "spell", duration: "1시간", concentration: true, elapsed: 0, startedAt: "", ...(target ? { target } : {}) });

test("D340: with no target named, the weapon in hand is the one that gains it", () => {
  const { cat, derived } = fighter();
  assert.equal(derived.equipment?.mainHand, "dnd.srd521.item.weapon.greatsword", JSON.stringify(derived.equipment));
  const after = applyActiveEffects(derived, [effect()], cat);
  const sword = after.attacks.find((attack) => attack.name === "대검")!;
  const axe = after.attacks.find((attack) => attack.name === "손도끼")!;
  const before = derived.attacks.find((attack) => attack.name === "대검")!;
  assert.equal(sword.attackBonus, before.attackBonus + 1, "the greatsword hits better");
  assert.deepEqual(sword.extraDamage?.map((part) => [part.formula, part.type]), [["1d4", "fire"]]);
  assert.equal(axe.attackBonus, derived.attacks.find((attack) => attack.name === "손도끼")!.attackBonus, "the axe in the bag gains nothing");
  assert.equal(axe.extraDamage, undefined);
});

test("D340: an effect that names its weapon gives it to that one", () => {
  const { cat, derived } = fighter();
  const after = applyActiveEffects(derived, [effect("dnd.srd521.item.weapon.handaxe")], cat);
  const axe = after.attacks.find((attack) => attack.name === "손도끼")!;
  const sword = after.attacks.find((attack) => attack.name === "대검")!;
  assert.deepEqual(axe.extraDamage?.map((part) => part.formula), ["1d4"], "the one the cast named");
  assert.equal(sword.extraDamage, undefined, "and not the one in hand");
});

test("D340: how many dice may be the slot's to decide", () => {
  const { cat, derived } = fighter();
  const scaling: ActiveEffect = { ...effect(), key: `spell:${SCALING}` };
  const base = derived.attacks.find((attack) => attack.name === "대검")!;
  for (const [level, dice, hit] of [[3, "1d4", 1], [5, "2d4", 2], [7, "3d4", 3]] as const) {
    const sword = applyActiveEffects(derived, [{ ...scaling, cast: { level, saveDc: 15, modifier: 3 } }], cat).attacks.find((attack) => attack.name === "대검")!;
    assert.deepEqual(sword.extraDamage?.map((part) => part.formula), [dice], `${level}레벨 슬롯`);
    assert.equal(sword.attackBonus - base.attackBonus, hit, `${level}레벨 슬롯의 명중`);
  }
});

test("D340: the effect card says what it did, and nothing is left unknown", () => {
  const { cat, derived } = fighter();
  const after = applyActiveEffects(derived, [effect()], cat, { list: true });
  const card = after.activeEffects.find((item) => item.name === "원소 무기");
  assert.ok(card, JSON.stringify(after.activeEffects.map((item) => item.name)));
  assert.equal(card!.applied, true, card!.notes.join(" · "));
});
