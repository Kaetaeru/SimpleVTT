/**
 * R52 (ROLL20_TABLE_SPEC.md D187): the pre-roll dialog, opened to the content.
 *
 * The dialog offered exactly five riders because `AttackRiders` named five. Everything the content wrote as "declare
 * it before the roll" — 광란 first, and every PHB feat that works the same way — could be described and then had
 * nowhere to appear. A contract entry point invoked `pre-roll-attack` is a checkbox now, and the damage it names
 * reaches the card.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { addItem, useFeature } from "../../client/character/play";
import { deriveCharacter } from "../../client/character/derive";
import { monsterById } from "../../client/compendium/monsters";
import { featureActivation } from "../../client/rules/activation";
import { characterRiders, offeredRiders, riderFitsAttack, contractRiders } from "../../client/rules/attackRiders";
import { characterScope, parseContract } from "../../client/rules/contract";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { pcStats } from "../../client/rules/actions";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import type { DerivedAttack } from "../../client/character/types";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const FRENZY = "barbarian.berserker.frenzy";

/** A raging, recklessly attacking berserker with a greataxe. */
function berserker(level = 5) {
  const made = build({ name: "야만", classes: "barbarian", level, abilities: { str: 18, dex: 12, con: 16 } }, { "class.2.subclass": ["dnd.srd521.subclass.barbarian.path-of-the-berserker"] });
  let runtime = initialRuntime(made.derived);
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.weapon.greataxe", name: "대도끼" });
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.weapon.shortbow", name: "단궁" });
  const start = (name: string) => {
    const feature = made.derived.features.find((item) => item.name === name)!;
    runtime = useFeature(runtime, made.derived, feature, featureActivation(feature, made.derived)!)!;
  };
  start("격노");
  start("무모한 공격");
  const derived = deriveCharacter(made.source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects });
  return { made, runtime, derived };
}

test("R52: 광란 is offered on the swing it belongs to, and nowhere else (D187)", () => {
  const { derived } = berserker();
  const rider = (derived.attackRiders ?? []).find((item) => item.key === FRENZY);
  assert.ok(rider, JSON.stringify((derived.attackRiders ?? []).map((item) => item.key)));
  assert.deepEqual(rider!.damage, [{ formula: "2d6", type: "weapon" }], "격노 피해 보너스만큼의 d6 — +2 at level 5");
  assert.equal(rider!.oncePerTurn, true);
  assert.deepEqual(rider!.requiresEffects, ["격노", "무모한 공격"]);

  const axe = derived.attacks.find((attack) => attack.name.includes("도끼"))!;
  const bow = derived.attacks.find((attack) => attack.name.includes("단궁"))!;
  assert.equal(riderFitsAttack(rider!, axe), true, "a Strength melee weapon");
  assert.equal(riderFitsAttack(rider!, bow), false, "a bow is not");
  assert.deepEqual(offeredRiders(derived, axe).map((item) => item.key), [FRENZY]);
  assert.deepEqual(offeredRiders(derived, bow).map((item) => item.key), []);
});

test("R52: without 격노 and 무모한 공격 running, 광란 is not offered at all (D187)", () => {
  const made = build({ name: "야만", classes: "barbarian", level: 5 }, { "class.2.subclass": ["dnd.srd521.subclass.barbarian.path-of-the-berserker"] });
  const runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.greataxe", name: "대도끼" });
  const derived = deriveCharacter(made.source, catalog(), { equipped: runtime.equipped, inventory: runtime.inventory });
  const axe = derived.attacks.find((attack) => attack.name.includes("도끼"))!;
  assert.ok((derived.attackRiders ?? []).some((item) => item.key === FRENZY), "the sheet still carries it");
  assert.deepEqual(offeredRiders(derived, axe).map((item) => item.key), [], "but the dialog will not offer it");
  // Rage alone is not enough — the 2024 rule needs Reckless Attack too.
  assert.deepEqual(offeredRiders(derived, axe, { effects: ["격노"] }).map((item) => item.key), []);
  assert.deepEqual(offeredRiders(derived, axe, { effects: ["격노", "무모한 공격"] }).map((item) => item.key), [FRENZY]);
});

test("R52: the dice scale with the level table, and the damage type follows the weapon (D187)", () => {
  for (const [level, dice] of [[5, "2d6"], [9, "3d6"], [16, "4d6"]] as Array<[number, string]>) {
    const { derived } = berserker(level);
    assert.equal((derived.attackRiders ?? []).find((item) => item.key === FRENZY)!.damage[0].formula, dice, `level ${level}`);
  }
  const { made, runtime, derived } = berserker();
  const axe = derived.attacks.find((attack) => attack.name.includes("도끼"))!;
  const spec = pcAttackSpec({ runtime } as never, derived, axe.id, { contracts: [FRENZY] })!.spec;
  const frenzy = spec.riders!.find((part) => part.label === "광란")!;
  assert.ok(frenzy, JSON.stringify(spec.riders));
  assert.equal(frenzy.formula, "2d6");
  assert.equal(frenzy.type, axe.damageType, "weapon means this weapon's own type");
  assert.equal(frenzy.critDoubles, true, "its dice double on a critical hit, like any weapon dice");
  assert.ok(spec.name.includes("광란"), spec.name);
  void made;
});

test("R52: a rider the sheet does not offer is dropped rather than trusted (D187)", () => {
  const { runtime, derived } = berserker();
  const axe = derived.attacks.find((attack) => attack.name.includes("도끼"))!;
  const bow = derived.attacks.find((attack) => attack.name.includes("단궁"))!;
  assert.equal(pcAttackSpec({ runtime } as never, derived, axe.id, { contracts: ["feat:great-weapon-master"] })!.spec.riders!.length, 0, "a key this sheet has no contract for");
  assert.equal(pcAttackSpec({ runtime } as never, derived, bow.id, { contracts: [FRENZY] })!.spec.riders!.length, 0, "a rider whose weapon filter does not match");
});

test("R52: a contract's pre-roll entry point is not a button on the sheet (D187)", () => {
  const { derived } = berserker();
  const frenzy = derived.features.find((feature) => feature.name === "광란")!;
  assert.ok(frenzy.rules?.some((line) => line.includes("판정 전 창에서 선언") && line.includes("2d6")), JSON.stringify(frenzy.rules));
  // Its damage must not leak into the sheet as a standing bonus, and it must not offer a 사용 button that rolls it.
  const axe = derived.attacks.find((attack) => attack.name.includes("도끼"))!;
  assert.equal(axe.damageTerms.some((term) => term.label === "광란"), false, JSON.stringify(axe.damageTerms));
  assert.equal(featureActivation(frenzy, derived)?.roll, undefined);
});

test("R52: a pre-roll rider may cost a pool, and the swing spends it (D187)", () => {
  const contract = parseContract({
    id: "feature:test.rider", entryPoints: [{
      id: "declare", invocation: "pre-roll-attack", attack: { scope: "heavy", oncePerTurn: true },
      operations: [
        { kind: "damage.apply", dice: "1d8", damageType: "화염", target: "attack-target" },
        { kind: "resource.change", resource: "resource:barbarian.rage", amount: -1, target: "self" },
      ],
    }],
  }, "test");
  assert.deepEqual(contract.unsupported, []);
  const { derived } = berserker();
  const [rider] = contractRiders(contract, "test.rider", "시험 라이더", characterScope(derived));
  assert.equal(rider.resourceId, "resource.barbarian.rage");
  assert.equal(rider.cost, 1);
  assert.equal(rider.hint, "피해 +1d8 · 턴당 한 번");

  // A pool with nothing left is not offered.
  const axe = derived.attacks.find((attack) => attack.name.includes("도끼"))!;
  const withRider = { ...derived, attackRiders: [rider] };
  assert.deepEqual(offeredRiders(withRider, axe, { left: () => 1 }).map((item) => item.key), ["test.rider"]);
  assert.deepEqual(offeredRiders(withRider, axe, { left: () => 0 }).map((item) => item.key), []);
});

test("R52: a declared rider travels the wire and lands on the table's card (D187)", async () => {
  const hub = new MemoryHub();
  const base = newCampaign("R52 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R52AAA" };
  const cat = catalog();
  // R55 (D190): 무모한 공격 is advantage now, so the swing rolls two d20s; both are scripted, and every damage die
  // after them rolls its maximum, so the arithmetic is exact.
  let taken = 0;
  const d20s = [12, 9];
  const random = () => { const at = taken; taken += 1; return at < d20s.length ? (d20s[at] - 0.5) / 20 : 0.999; };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcAttackSpec: (entry, attackId, riders) => pcAttackSpec(entry, derivedOf(entry, cat), attackId, riders),
    pcStats: (entry) => pcStats(derivedOf(entry, cat)) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R52AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R52AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const { made, runtime } = berserker();
  const pc = newJournalCharacter(campaign.id, "alice", made.source, runtime, { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const live = host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const axe: DerivedAttack = derivedOf(live, cat).attacks.find((attack) => attack.name.includes("도끼"))!;
  const me = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  alice.send({ type: "act.attack", actor: me, attacker: me, targets: [{ entryId: ogre.id, pageId: scene.id, tokenId: ogreToken.id }], attack: { source: "weapon", attackId: axe.id }, riders: { contracts: [FRENZY] } } as never);
  await tick();
  await tick();
  const message = [...host.archive].reverse().find((item) => item.action);
  assert.ok(message, [...host.archive].slice(-3).map((item) => item.content).join(" | "));
  const card = message!.action!;
  assert.equal(card.outcome, "hit");
  const frenzy = card.damage.find((part) => part.part.label === "광란")!;
  assert.ok(frenzy, JSON.stringify(card.damage.map((part) => part.part.label)));
  assert.deepEqual(frenzy.dice, [6, 6], "2d6, both maximal");
  // The axe's own part is 1d12 plus the sheet's damage bonus (Strength + 격노); 광란's 2d6 is added on top of it.
  const weapon = card.damage.find((part) => part.part.label !== "광란")!;
  assert.equal(card.damageTotal, weapon.adjusted + 12, JSON.stringify(card.damage.map((part) => ({ f: part.part.formula, dice: part.dice, adjusted: part.adjusted }))));
  assert.equal(weapon.adjusted, 12 + axe.damageBonus, "1d12 at its maximum plus 근력 + 격노");
});
