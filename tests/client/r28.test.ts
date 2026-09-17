/**
 * R28 (ROLL20_TABLE_SPEC.md D147–D153): rules the app carried as prose and never actually ran.
 *
 * Exhaustion was stored, set, decremented by a long rest and shown on the sheet, and read by no roll. Resistance
 * was applied before a save halved the damage instead of after. A character healed off 0 HP kept 무의식, which
 * hands every attacker advantage and turns every melee hit into a critical. Condition immunities were built,
 * labelled with their source and read by nothing. Rage ran its hundred rounds whatever the barbarian did. Nine
 * spells the compendium describes exactly still printed "DM이 효과를 적용합니다".
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { applyHealing, setExhaustion, startEffect, wakeUp } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { applyDamage, diceFrom, immuneToCondition, resolveAttack, type AttackSpec, type Combatant } from "../../client/rules/resolve";
import { pcSpell, resolveSpell, type CasterStats } from "../../client/rules/spellcast";
import { spellExec } from "../../client/compendium/spells";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const combatant = (over: Partial<Combatant> = {}): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 40, max: 40, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [], ...over });
const spec: AttackSpec = { name: "장검", source: "weapon", attackBonus: 5, mode: "melee", damage: [{ formula: "1d8+3", type: "참격" }] };
const fixed = (value: number) => diceFrom(() => (value - 0.5) / 20);

test("exhaustion: every level is −2 on the attack roll and on the saving throw (D147)", () => {
  const rested = resolveAttack(combatant({ id: "a", kind: "pc" }), combatant(), spec, { dice: fixed(10) });
  const tired = resolveAttack(combatant({ id: "a", kind: "pc", exhaustion: 3 }), combatant(), spec, { dice: fixed(10) });
  assert.equal(rested.attackTotal - tired.attackTotal, 6, "three levels are −6");
  assert.ok(tired.reasons.some((reason) => reason.includes("탈진 3단계")), JSON.stringify(tired.reasons));
  // The same −2 per level lands on a save against a spell.
  const casterStats: CasterStats = { saveDc: 13, attackBonus: 5, modifier: 3, level: 5 };
  const stats = { abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, saves: { str: 0, dex: 4, con: 0, int: 0, wis: 0, cha: 0 }, skills: {}, proficiencyBonus: 3 } as never;
  const cast = (exhaustion: number) => resolveSpell({
    spec: { spellId: "dnd.srd521.spell.fireball", name: "화염구", level: 3, exec: spellExec("dnd.srd521.spell.fireball")! },
    caster: combatant({ id: "c", kind: "pc" }), casterStats, dice: fixed(10),
    targets: [{ combatant: combatant({ exhaustion }), stats }],
  }).targets[0].save!;
  assert.equal(cast(0).total - cast(2).total, 4, "two levels are −4 on the save");
});

test("damage: a successful save halves before resistance and vulnerability, not after (D148)", () => {
  const target = combatant({ defenses: { resistances: [], immunities: [], vulnerabilities: ["화염"] } });
  // 11 raw: halved first (5), then doubled for vulnerability = 10. The old order doubled to 22 and halved to 11.
  const halved = applyDamage(target, [{ formula: "11", type: "화염" }], fixed(10), { half: true });
  assert.equal(halved.damageTotal, 10);
  const full = applyDamage(target, [{ formula: "11", type: "화염" }], fixed(10), {});
  assert.equal(full.damageTotal, 22, "without a save it is still doubled");
  // Resistance rounds the same way either way, and immunity still beats everything.
  const resistant = combatant({ defenses: { resistances: ["화염"], immunities: [], vulnerabilities: [] } });
  assert.equal(applyDamage(resistant, [{ formula: "11", type: "화염" }], fixed(10), { half: true }).damageTotal, 2);
  const immune = combatant({ defenses: { resistances: [], immunities: ["화염"], vulnerabilities: [] } });
  assert.equal(applyDamage(immune, [{ formula: "11", type: "화염" }], fixed(10), {}).damageTotal, 0);
});

test("conditions: a creature immune to a condition does not get it (D150)", () => {
  const zombie = combatant({ defenses: { resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: ["중독", "매혹 (영웅심)"] } });
  assert.equal(immuneToCondition(zombie.defenses, "중독"), true);
  assert.equal(immuneToCondition(zombie.defenses, "매혹"), true, "the label of where the immunity comes from is not part of the name");
  assert.equal(immuneToCondition(zombie.defenses, "공포"), false);
  const poisoning: AttackSpec = { ...spec, inflicts: ["중독", "공포"] };
  const hit = resolveAttack(combatant({ id: "a", kind: "npc" }), zombie, poisoning, { dice: fixed(19) });
  assert.deepEqual(hit.inflicted, ["공포"], "only what can land, lands");
  // Topple does not knock over something that cannot be knocked over.
  const rooted = combatant({ defenses: { resistances: [], immunities: [], vulnerabilities: [], conditionImmunities: ["넘어짐"] } });
  const topple = resolveAttack(combatant({ id: "a", kind: "pc" }), rooted, { ...spec, mastery: "topple", masteryDc: 20, abilityMod: 3 }, { dice: fixed(19) });
  assert.deepEqual(topple.inflicted, []);
});

test("0 HP: healing takes 무의식 off, not only the death saves (D149)", () => {
  const made = build({ name: "파이터", classes: "fighter", level: 3 });
  const down = { ...initialRuntime(made.derived), hp: { ...initialRuntime(made.derived).hp, current: 0 }, conditions: ["무의식", "넘어짐"], deathSaves: { success: 1, failure: 2 } };
  const healed = applyHealing(down, made.derived, 5);
  assert.equal(healed.hp.current, 5);
  assert.deepEqual(healed.conditions, ["넘어짐"], "up but still on the floor — standing is your own move");
  assert.deepEqual(healed.deathSaves, { success: 0, failure: 0 });
  // The helper is the same one the host uses for the natural 20 and for a healed bar.
  assert.deepEqual(wakeUp(down).conditions, ["넘어짐"]);
  // Healing someone who never fell changes no condition.
  const grazed = { ...initialRuntime(made.derived), hp: { ...initialRuntime(made.derived).hp, current: 4 }, conditions: ["매혹"] };
  assert.deepEqual(applyHealing(grazed, made.derived, 5).conditions, ["매혹"]);
});

test("spells: the last nine 'DM이 적용합니다' spells resolve (D152)", () => {
  const casterStats: CasterStats = { saveDc: 15, attackBonus: 7, modifier: 4, level: 9 };
  const stats = { abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, saves: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, skills: {}, proficiencyBonus: 4 } as never;
  const cast = (slug: string, level: number, target: Combatant) => resolveSpell({
    spec: { spellId: `dnd.srd521.spell.${slug}`, name: slug, level, exec: spellExec(`dnd.srd521.spell.${slug}`)! },
    caster: combatant({ id: "c", kind: "pc" }), casterStats, dice: fixed(10), targets: [{ combatant: target, stats }],
  });
  const hurt = combatant({ hp: { current: 10, max: 40, temp: 0 } });
  const aid = cast("aid", 2, hurt).targets[0];
  assert.deepEqual([aid.mode, aid.healed, aid.hpAfter], ["heal", 5, 15]);
  assert.equal(cast("aid", 4, hurt).targets[0].healed, 15, "two levels above base is +10 more");
  const heal = cast("power-word-heal", 9, hurt).targets[0];
  assert.deepEqual([heal.hpAfter, heal.clears], [40, ["매혹", "공포", "마비", "충격", "무의식", "넘어짐"]]);
  const kill = cast("power-word-kill", 9, hurt).targets[0];
  assert.deepEqual([kill.hpAfter, kill.marks], [0, ["사망"]]);
  const tough = cast("power-word-kill", 9, combatant({ hp: { current: 140, max: 200, temp: 0 } })).targets[0];
  assert.ok(tough.hpAfter > 0 && tough.damage, "over 100 HP it is damage, not death");
  const dead = combatant({ hp: { current: 0, max: 30, temp: 0 } });
  const revivify = cast("revivify", 3, dead).targets[0];
  assert.deepEqual([revivify.hpAfter, revivify.clears], [1, ["사망", "무의식"]]);
  assert.equal(cast("true-resurrection", 9, dead).targets[0].hpAfter, 30, "a full revival comes back whole");
  const dispel = cast("dispel-magic", 3, combatant({ effects: ["축복", "가속"] })).targets[0];
  assert.ok(dispel.note?.includes("축복") && dispel.note.includes("가속"), dispel.note);
  for (const slug of ["aid", "power-word-heal", "power-word-kill", "revivify", "raise-dead", "resurrection", "reincarnate", "true-resurrection", "dispel-magic"]) {
    const resolution = cast(slug, 9, hurt);
    assert.ok(!resolution.note?.includes("DM이 효과를 적용합니다"), `${slug} still falls through`);
  }
});

test("rage: it ends at the end of a turn that did nothing, and survives one that did (D151)", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R28 격노", { userId: "dm", displayName: "DM" }), joinCode: "R28AAA" };
  const dice = { value: 0.95 };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method),
    // V4c (D265): which effects need a deed each turn comes from their contracts.
    pcUpkeepEffects: pcHostOptions(() => catalog()).pcUpkeepEffects });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R28AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R28AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "동굴", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "야만용사", classes: "barbarian", level: 3 });
  const raging = startEffect(initialRuntime(made.derived), { key: "feature:barbarian.rage", name: "격노", source: "feature", duration: "10분 (100라운드)", concentration: false, rounds: 100 });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, raging, { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const rows = [newTurn({ name: "야만용사", initiative: 20, tokenId: pcToken.id, pageId: scene.id, entryId: pc.id }), newTurn({ name: "오우거", initiative: 10, tokenId: ogreToken.id, pageId: scene.id, entryId: ogre.id })];
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns: rows } });
  await tick();
  const rageOf = () => ((host.journal.find((entry) => entry.id === pc.id) as JournalCharacter).runtime.effects ?? []).find((effect) => effect.key === "feature:barbarian.rage");
  assert.ok(rageOf(), "the barbarian is raging");
  // Turn one: she swings at the ogre. The rage is fed and survives her turn ending.
  const weapon = derivedOf(host.journal.find((entry) => entry.id === pc.id) as JournalCharacter, catalog()).attacks[0]!.id;
  alice.send({ type: "act.attack", attacker: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, targets: [{ entryId: ogre.id, pageId: scene.id, tokenId: ogreToken.id }], attack: { source: "weapon", attackId: weapon } });
  await tick();
  dm.send({ type: "tracker.next" });
  await tick();
  assert.ok(rageOf(), "a turn with an attack in it keeps the rage");
  // Round two: she does nothing at all. At the end of that turn the rage is over.
  dm.send({ type: "tracker.next" });
  await tick();
  dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(rageOf(), undefined, "a turn with no attack, no forced save and no damage ends it");
  assert.ok(host.archive.some((message) => message.content.includes("격노 끝남")), JSON.stringify(host.archive.map((message) => message.content).slice(-6)));
  void setExhaustion;
});
