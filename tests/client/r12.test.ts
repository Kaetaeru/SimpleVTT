/**
 * R12 (ROLL20_TABLE_SPEC.md D107/D108): 2024 weapon mastery on attacks — Graze deals the modifier on a miss, Topple
 * asks for a CON save, Vex/Sap mark the target and change the next attack, Cleave's follow-up has no modifier;
 * Legendary Resistance turns a failed save in a spell card into a success.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { addItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats, type ActorStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { resolveAttack, suggestAdvantage, type AttackSpec, type Combatant } from "../../client/rules/resolve";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const scripted = (...values: number[]) => ({ d: (sides: number) => { const value = values.shift(); if (value === undefined) throw new Error("dice ran out"); return Math.min(sides, value); } });
const combatant = (over: Partial<Combatant> = {}): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 15, hp: { current: 20, max: 20, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 1, effects: [], tokenId: "tok-t", ...over });
const attacker = combatant({ id: "a", name: "전사", kind: "pc", tokenId: "tok-a" });
const spec = (mastery: string, over: Partial<AttackSpec> = {}): AttackSpec => ({ name: "대검", source: "weapon", attackBonus: 5, mode: "melee", damage: [{ formula: "2d6+3", type: "참격" }], mastery, abilityMod: 3, masteryDc: 13, ...over });

test("mastery: graze deals the modifier on a miss; topple rolls the CON save and knocks prone on a failure; vex and sap mark the target; sap/vex change the next attack", () => {
  const graze = resolveAttack(attacker, combatant(), spec("graze"), { dice: scripted(2) });
  assert.deepEqual([graze.outcome, graze.damageTotal, graze.hpAfter, graze.mastery?.kind, graze.mastery?.grazed], ["miss", 3, 17, "graze", 3]);
  const hitGraze = resolveAttack(attacker, combatant(), spec("graze"), { dice: scripted(15, 3, 3) });
  assert.deepEqual([hitGraze.outcome, hitGraze.damageTotal, hitGraze.mastery], ["hit", 9, undefined]);
  // Topple: attack d20 15 (hit), damage 3+3, then the CON save d20 5 + 1 = 6 vs DC 13 → prone.
  const topple = resolveAttack(attacker, combatant(), spec("topple"), { dice: scripted(15, 3, 3, 5) });
  assert.deepEqual([topple.mastery?.kind, topple.mastery?.save?.total, topple.mastery?.save?.success, topple.inflicted], ["topple", 6, false, ["넘어짐"]]);
  const stands = resolveAttack(attacker, combatant(), spec("topple"), { dice: scripted(15, 3, 3, 19) });
  assert.deepEqual([stands.mastery?.save?.success, stands.inflicted], [true, []]);
  const vex = resolveAttack(attacker, combatant(), spec("vex"), { dice: scripted(15, 3, 3) });
  assert.deepEqual(vex.mastery?.marks, ["교란"]);
  const sap = resolveAttack(attacker, combatant(), spec("sap"), { dice: scripted(15, 3, 3) });
  assert.deepEqual(sap.mastery?.marks, ["약화"]);
  // The marks at work: a sapped attacker is at disadvantage; the vexer has advantage against its vexed target.
  assert.equal(suggestAdvantage(combatant({ conditions: ["약화"] }), combatant(), spec("graze")).advantage, "disadvantage");
  assert.equal(suggestAdvantage(attacker, combatant({ vexedBy: "tok-a" }), spec("graze")).advantage, "advantage");
  assert.equal(suggestAdvantage(combatant({ id: "b", tokenId: "tok-b" }), combatant({ vexedBy: "tok-a" }), spec("graze")).advantage, "normal", "only the vexer benefits");
});

test("pcAttackSpec: the active mastery rides the spec; a cleave follow-up drops the ability modifier from the damage", () => {
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 }, { "class.0.weapon-mastery": ["dnd.srd521.item.weapon.greatsword", "dnd.srd521.item.weapon.greataxe", "dnd.srd521.item.weapon.longbow"] });
  const entry = newJournalCharacter("c", "alice", fighter.source, addItem(initialRuntime(fighter.derived), { itemId: "dnd.srd521.item.weapon.greataxe", name: "대도끼" }));
  const derived = derivedOf(entry, catalog());
  const sword = derived.attacks.find((attack) => attack.name === "대검")!;
  const swordSpec = pcAttackSpec(entry, derived, sword.id)!.spec;
  assert.deepEqual([swordSpec.mastery, swordSpec.abilityMod, swordSpec.masteryDc], ["graze", 3, 13]);
  const axe = derived.attacks.find((attack) => attack.masteryKey === "cleave");
  assert.ok(axe, `an axe with cleave: ${derived.attacks.map((attack) => `${attack.name}:${attack.masteryKey}`)}`);
  const plain = pcAttackSpec(entry, derived, axe!.id)!.spec;
  const follow = pcAttackSpec(entry, derived, axe!.id, { cleave: true })!.spec;
  assert.ok(plain.damage[0].formula.includes("+3") && !follow.damage[0].formula.includes("+3"), `${plain.damage[0].formula} → ${follow.damage[0].formula}`);
  assert.ok(follow.name.endsWith("쪼개기") && follow.mastery === undefined);
});

async function table(masteries: string[]) {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R12 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  const dice = { value: 0.5 };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value, attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined), pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey, pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders), pcStats: (entry) => pcStats(derivedOf(entry, catalog())), pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  const scene = newScene(campaign.id, "다리", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 }, { "class.0.weapon-mastery": masteries });
  const pc = newJournalCharacter(campaign.id, "alice", fighter.source, initialRuntime(fighter.derived));
  const cleric = build({ name: "성직자", classes: "cleric", level: 3 }, { "class.0.cantrips": ["dnd.srd521.spell.sacred-flame", "dnd.srd521.spell.light", "dnd.srd521.spell.thaumaturgy"] });
  const pc2 = newJournalCharacter(campaign.id, "alice", cleric.source, initialRuntime(cleric.derived));
  alice.send({ type: "journal.put", entry: pc });
  alice.send({ type: "journal.put", entry: pc2 });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  const dragon = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.adult-brass-dragon")!);
  dm.send({ type: "journal.put", entry: goblin });
  dm.send({ type: "journal.put", entry: dragon });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const clericToken = tokenForCharacter(pc2);
  const goblinToken = tokenForNpc(goblin);
  const dragonToken = tokenForNpc(dragon);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  alice.send({ type: "token.put", pageId: scene.id, token: clericToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  dm.send({ type: "token.put", pageId: scene.id, token: dragonToken });
  await tick();
  const ref = (entryId: string, tokenId: string) => ({ entryId, pageId: scene.id, tokenId });
  const refs = { fighter: ref(pc.id, pcToken.id), cleric: ref(pc2.id, clericToken.id), goblin: ref(goblin.id, goblinToken.id), dragon: ref(dragon.id, dragonToken.id) };
  // Fighter, cleric, goblin, dragon; current = the fighter's turn.
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns: [newTurn({ name: "파이터", initiative: 20, tokenId: pcToken.id, pageId: scene.id, entryId: pc.id }), newTurn({ name: "성직자", initiative: 15, tokenId: clericToken.id, pageId: scene.id, entryId: pc2.id }), newTurn({ name: "고블린 전사", initiative: 10, tokenId: goblinToken.id, pageId: scene.id, entryId: goblin.id }), newTurn({ name: "성인 황동 드래곤", initiative: 5, tokenId: dragonToken.id, pageId: scene.id, entryId: dragon.id })] } });
  await tick();
  const derived = derivedOf(pc, catalog());
  const attackOf = (name: string) => derived.attacks.find((attack) => attack.name === name)!;
  const markersOf = (tokenId: string) => host.pageList[0].tokens.find((token) => token.id === tokenId)!.markers;
  const hpOf = (tokenId: string) => host.pageList[0].tokens.find((token) => token.id === tokenId)!.bars[0].value;
  const last = (client: TableClient, type: string) => [...client.snapshot!.chat].reverse().find((message) => message.type === type)!;
  const entryOf = (id: string) => dm.snapshot!.journal.find((item) => item.id === id)!;
  return { host, dm, alice, dice, pc, goblin, dragon, pcToken, goblinToken, dragonToken, refs, attackOf, markersOf, hpOf, last, entryOf };
}

test("host: graze damages on a miss; vex marks the goblin from the fighter, gives the next attack advantage and is spent; the fighter's next turn clears what is left", async () => {
  const { host, dm, alice, dice, goblin, pcToken, goblinToken, dragonToken, refs, attackOf, markersOf, hpOf, last } = await table(["dnd.srd521.item.weapon.greatsword", "dnd.srd521.item.weapon.shortbow", "dnd.srd521.item.weapon.flail"]);
  dice.value = 0.05; // d20 = 2: a miss
  alice.send({ type: "act.attack", attacker: refs.fighter, targets: [refs.goblin], attack: { source: "weapon", attackId: attackOf("대검").id } });
  await tick();
  const graze = last(dm, "action").action!;
  assert.deepEqual([graze.outcome, graze.mastery?.grazed, hpOf(goblinToken.id)], ["miss", 3, 7]);
  void goblin;
  // Shortbow (vex) hits the dragon (AC 18, plenty of HP): it is marked 교란 from the fighter.
  dice.value = 0.9;
  alice.send({ type: "act.attack", attacker: refs.fighter, targets: [refs.dragon], attack: { source: "weapon", attackId: attackOf("단궁").id } });
  await tick();
  assert.ok(markersOf(dragonToken.id).some((marker) => marker.name === "교란" && marker.from === pcToken.id), `vexed by the fighter: ${JSON.stringify(markersOf(dragonToken.id))}`);
  alice.send({ type: "act.attack", attacker: refs.fighter, targets: [refs.dragon], attack: { source: "weapon", attackId: attackOf("단궁").id } });
  await tick();
  const vexed = last(dm, "action").action!;
  assert.ok(vexed.advantage === "advantage" && vexed.reasons.some((reason) => reason.includes("교란")), `advantage from vex: ${vexed.reasons}`);
  // The attack renewed the mark (hit again) or spent it (miss): either way it is the fighter's; the fighter's next turn start clears it.
  dm.send({ type: "tracker.next" }); await tick();
  dm.send({ type: "tracker.next" }); await tick();
  dm.send({ type: "tracker.next" }); await tick();
  dm.send({ type: "tracker.next" }); await tick();
  assert.equal(host.state.tracker!.turns[host.state.tracker!.current].name, "파이터");
  assert.ok(!markersOf(dragonToken.id).some((marker) => marker.name === "교란"), "cleared at the wielder's next turn");
});

test("host: sap on a hit puts 약화 on the goblin; the goblin's next attack is at disadvantage and spends it", async () => {
  const { dm, alice, dice, goblinToken, refs, attackOf, markersOf, last } = await table(["dnd.srd521.item.weapon.flail", "dnd.srd521.item.weapon.greatsword", "dnd.srd521.item.weapon.shortbow"]);
  dice.value = 0.9;
  alice.send({ type: "act.attack", attacker: refs.fighter, targets: [refs.goblin], attack: { source: "weapon", attackId: attackOf("도리깨").id } });
  await tick();
  assert.ok(markersOf(goblinToken.id).some((marker) => marker.name === "약화"), `sapped: ${markersOf(goblinToken.id).map((marker) => marker.name)}`);
  dm.send({ type: "act.attack", attacker: refs.goblin, targets: [refs.fighter], attack: { source: "npc", actionName: "시미터" } });
  await tick();
  const swing = last(dm, "action").action!;
  assert.ok(swing.advantage === "disadvantage" && swing.reasons.some((reason) => reason.includes("약화")), `disadvantage from sap: ${swing.reasons}`);
  assert.ok(!markersOf(goblinToken.id).some((marker) => marker.name === "약화"), "spent by the attack");
});

test("host: Legendary Resistance — the DM turns the dragon's failed save into a success, the row is re-applied, the pool counts down and runs out", async () => {
  const { dm, alice, dice, dragon, dragonToken, refs, hpOf, last, entryOf } = await table(["dnd.srd521.item.weapon.greatsword", "dnd.srd521.item.weapon.shortbow", "dnd.srd521.item.weapon.flail"]);
  const flame = "dnd.srd521.spell.sacred-flame";
  dm.send({ type: "tracker.next" });
  await tick();
  const full = hpOf(dragonToken.id)!;
  for (let round = 1; round <= 4; round += 1) {
    dice.value = 0.05; // the dragon's DEX save fails (2 + 5 = 7 vs DC 10); damage dice are 1s
    alice.send({ type: "act.cast", caster: refs.cleric, spellId: flame, targets: [refs.dragon] });
    await tick();
    const card = last(dm, "spell");
    assert.equal(card.spell!.targets[0].save!.success, false);
    assert.ok(hpOf(dragonToken.id)! < full, "the flame burned");
    dm.send({ type: "act.resist", messageId: card.id, targetId: dragon.id });
    await tick();
    const after = last(dm, "spell");
    const entry = entryOf(dragon.id);
    if (round <= 3) {
      assert.equal(after.id, card.id, "the same card, re-said");
      assert.deepEqual([after.spell!.targets[0].save!.success, after.spell!.targets[0].save!.legendary, hpOf(dragonToken.id)], [true, true, full]);
      assert.ok(after.spell!.note?.includes("전설 저항"));
      assert.equal(entry.kind === "npc" ? entry.runtime.legendaryResistanceUsed : -1, round);
    } else {
      assert.equal(after.spell!.targets[0].save!.success, false, "no resistance left: the fourth stays failed");
      assert.equal(entry.kind === "npc" ? entry.runtime.legendaryResistanceUsed : -1, 3);
    }
  }
  // A player cannot spend it.
  alice.send({ type: "act.resist", messageId: last(dm, "spell").id, targetId: dragon.id });
  await tick();
  assert.equal(last(dm, "spell").spell!.targets[0].save!.success, false);
});
