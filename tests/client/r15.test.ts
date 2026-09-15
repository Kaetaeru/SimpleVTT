/**
 * R15 (ROLL20_TABLE_SPEC.md D110): the defects the full-project review turned up.
 * 행동불능 no longer hands attackers advantage; damage on a PC already at 0 HP writes death-save failures (two from
 * a critical hit, instant death at the HP maximum); a creature that cannot act cannot attack either; the optimistic
 * sheet value is held against the host's own `updatedAt` instead of two machines' clocks; Legendary Resistance
 * names the token, so two copies of one stat block are told apart; Divine Smite scales past a 4th-level slot and
 * adds its d8 against a Fiend or an Undead.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc, pendingFor, pendingValue } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey, smiteFiendBonus } from "../../client/rules/attackSpec";
import { applyDamage, diceFrom, suggestAdvantage, type AttackSpec, type Combatant } from "../../client/rules/resolve";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const combatant = (over: Partial<Combatant> = {}): Combatant => ({
  id: "t", name: "대상", kind: "pc", ac: 13, hp: { current: 10, max: 10, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [], ...over,
});
const spec: AttackSpec = { name: "장검", source: "weapon", attackBonus: 5, mode: "melee", damage: [{ formula: "1d8+3", type: "참격" }] };
const fixedDice = (value: number) => diceFrom(() => (value - 0.5) / 20);

test("2024 conditions: 행동불능 alone gives an attacker nothing; 마비·충격·포박·석화·무의식 still do", () => {
  const attacker = combatant({ id: "a", name: "공격자", kind: "npc" });
  const alone = suggestAdvantage(attacker, combatant({ conditions: ["행동불능"] }), spec);
  assert.deepEqual([alone.advantage, alone.reasons], ["normal", []], "Incapacitated only bars actions, reactions and concentration");
  for (const name of ["마비", "석화", "포박", "충격", "무의식"]) {
    const result = suggestAdvantage(attacker, combatant({ conditions: [name] }), spec);
    assert.equal(result.advantage, "advantage", `${name} still gives advantage`);
  }
});

test("damage on a PC already at 0 HP: one death-save failure, two from a critical hit, instant death at the HP maximum", () => {
  const down = combatant({ hp: { current: 0, max: 10, temp: 0 } });
  const one = applyDamage(down, [{ formula: "4", type: "참격" }], fixedDice(1));
  assert.deepEqual([one.deathFailures, one.downed, one.hpAfter], [1, undefined, 0]);
  const crit = applyDamage(down, [{ formula: "4", type: "참격" }], fixedDice(1), { crit: true });
  assert.equal(crit.deathFailures, 2, "a critical hit is two failures");
  const massive = applyDamage(down, [{ formula: "10", type: "참격" }], fixedDice(1));
  assert.deepEqual([massive.downed, massive.deathFailures], ["instant-death", undefined], "damage at the HP maximum kills outright");
  // Temp HP absorbs first, so nothing reaches the dying character.
  const temped = applyDamage(combatant({ hp: { current: 0, max: 10, temp: 5 } }), [{ formula: "4", type: "참격" }], fixedDice(1));
  assert.equal(temped.deathFailures, undefined);
  // An NPC at 0 HP rolls no death saves.
  assert.equal(applyDamage(combatant({ kind: "npc", hp: { current: 0, max: 10, temp: 0 } }), [{ formula: "4", type: "참격" }], fixedDice(1)).deathFailures, undefined);
});

test("Divine Smite (2024): 2d8 from a 1st-level slot, +1d8 per level above with no cap, +1d8 against a Fiend or an Undead", () => {
  const paladin = build({ name: "팔라딘", classes: "paladin", level: 17 });
  const entry = newJournalCharacter("c", "p", paladin.source, initialRuntime(paladin.derived));
  const weapon = paladin.derived.attacks[0];
  const formulaFor = (level: number) => pcAttackSpec(entry, paladin.derived, weapon.id, { smiteSlot: level })!.spec.riders!.find((part) => part.label?.startsWith("신성한 강타"))!.formula;
  assert.deepEqual([1, 2, 3, 4, 5].map(formulaFor), ["2d8", "3d8", "4d8", "5d8", "6d8"], "a 5th-level slot is 6d8, not the old 5d8 cap");
  const smiting = pcAttackSpec(entry, paladin.derived, weapon.id, { smiteSlot: 2 })!.spec;
  assert.equal(smiteFiendBonus(smiting, "undead")!.formula, "1d8");
  assert.equal(smiteFiendBonus(smiting, "fiend")!.type, "광휘");
  assert.equal(smiteFiendBonus(smiting, "beast"), null, "only Fiends and Undead");
  assert.equal(smiteFiendBonus(pcAttackSpec(entry, paladin.derived, weapon.id)!.spec, "undead"), null, "no smite, no bonus");
});

test("the optimistic sheet value stands only while the host's entry is unchanged (no clock comparison)", () => {
  const pending = pendingFor({ hp: 7 }, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(pendingValue(pending, "2026-01-01T00:00:00.000Z", { hp: 3 }), { hp: 7 }, "not echoed yet: our value");
  assert.deepEqual(pendingValue(pending, "2026-01-01T00:00:01.000Z", { hp: 3 }), { hp: 3 }, "the host wrote since: its value");
  // The old rule compared our clock with the host's: a client running ahead never gave the host's writes back.
  assert.deepEqual(pendingValue(pending, "1999-01-01T00:00:00.000Z", { hp: 3 }), { hp: 3 }, "an older host stamp is still a change");
  assert.deepEqual(pendingValue(null, "2026-01-01T00:00:00.000Z", { hp: 3 }), { hp: 3 });
});

async function table(random?: () => number) {
  const dice = { value: 0.5 };
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R15 시험", { userId: "dm", displayName: "DM" }), joinCode: "R15AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: random ?? (() => dice.value),
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R15AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R15AAA" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 });
  const pc = newJournalCharacter(campaign.id, "alice", fighter.source, initialRuntime(fighter.derived));
  alice.send({ type: "journal.put", entry: pc });
  const casterBuild = build({ name: "마법사", classes: "wizard", level: 5 }, { "class.0.spells": ["dnd.srd521.spell.fireball", "dnd.srd521.spell.magic-missile"] });
  const caster = newJournalCharacter(campaign.id, "alice", casterBuild.source, initialRuntime(casterBuild.derived));
  alice.send({ type: "journal.put", entry: caster });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  dm.send({ type: "journal.put", entry: goblin });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const casterToken = tokenForCharacter(caster);
  const goblinToken = tokenForNpc(goblin);
  alice.send({ type: "token.put", pageId: scene.id, token: casterToken });
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  await tick();
  const ref = (entryId: string, tokenId: string) => ({ entryId, pageId: scene.id, tokenId });
  const refs = { pc: ref(pc.id, pcToken.id), caster: ref(caster.id, casterToken.id), goblin: ref(goblin.id, goblinToken.id) };
  const entryOf = (id: string) => dm.snapshot!.journal.find((item) => item.id === id)!;
  const last = (type: string) => [...dm.snapshot!.chat].reverse().find((message) => message.type === type);
  return { host, dm, alice, dice, scene, pc, caster, goblin, pcToken, goblinToken, refs, entryOf, last };
}

test("host: a creature that cannot act cannot attack either — the refusal names the condition", async () => {
  const { dm, alice, pc, goblin, refs } = await table();
  const stunned = { ...pc, runtime: { ...pc.runtime, conditions: ["충격"] }, updatedAt: new Date().toISOString() };
  alice.send({ type: "journal.put", entry: stunned });
  await tick();
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "act.attack", attacker: refs.pc, targets: [refs.goblin], attack: { source: "weapon", attackId: "x" } });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("충격") && reason.includes("공격할 수 없습니다")), `the refusal says why: ${JSON.stringify(refusals)}`);
  assert.equal(dm.snapshot!.chat.filter((message) => message.type === "action").length, 0, "no card was posted");
  void goblin;
});

test("host: a hit on a PC already at 0 HP writes death-save failures on the sheet and says so at the table", async () => {
  const { dm, pc, goblin, refs, entryOf, last } = await table(() => 0.9);
  const down = { ...pc, runtime: { ...pc.runtime, hp: { ...pc.runtime.hp, current: 0 }, conditions: ["무의식", "넘어짐"] }, updatedAt: new Date().toISOString() };
  dm.send({ type: "journal.put", entry: down });
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns: [newTurn({ name: goblin.name, initiative: 20, tokenId: refs.goblin.tokenId, pageId: refs.goblin.pageId, entryId: goblin.id })] } });
  await tick();
  // An unconscious target is hit automatically and a melee hit on it is a critical hit: two failures.
  dm.send({ type: "act.attack", attacker: refs.goblin, targets: [refs.pc], attack: { source: "npc", actionName: "시미터" } });
  await tick();
  const card = last("action")!;
  assert.equal(card.action!.outcome, "crit", "a melee hit on an unconscious creature is a critical hit");
  assert.equal(card.action!.deathFailures, 2);
  const after = entryOf(pc.id);
  assert.ok(after.kind === "character" && after.runtime.deathSaves.failure === 2, `two failures on the sheet: ${after.kind === "character" ? JSON.stringify(after.runtime.deathSaves) : "?"}`);
  assert.ok(last("system")!.content.includes("죽음 내성 실패 2회"), last("system")!.content);
  // Undo puts the death saves back.
  dm.send({ type: "act.undo", messageId: card.id });
  await tick();
  const undone = entryOf(pc.id);
  assert.ok(undone.kind === "character" && undone.runtime.deathSaves.failure === 0, "undo restores the death saves");
});

test("host: Legendary Resistance names the token, so one copy of a stat block does not spend the other's", async () => {
  const { dm, alice, scene, dice, refs, last, entryOf } = await table();
  // One journal entry, two tokens (the DM dropped the same dragon twice): only the token tells the rows apart.
  const dragon = newJournalNpc(scene.campaignId, "dm", monsterById("dnd.srd521.monster.adult-red-dragon")!);
  dm.send({ type: "journal.put", entry: dragon });
  await tick();
  const one = tokenForNpc(dragon);
  const two = { ...tokenForNpc(dragon), id: `${one.id}-b`, name: `${dragon.name} 2` };
  dm.send({ type: "token.put", pageId: scene.id, token: one });
  dm.send({ type: "token.put", pageId: scene.id, token: two });
  await tick();
  const at = (tokenId: string) => ({ entryId: dragon.id, pageId: scene.id, tokenId });
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  dice.value = 0.05; // both DEX saves fail
  alice.send({ type: "act.cast", caster: refs.caster, spellId: "dnd.srd521.spell.fireball", targets: [at(one.id), at(two.id)], method: { kind: "slot", level: 3 } });
  await tick();
  const card = last("spell")!;
  assert.ok(card, `no spell card: ${JSON.stringify(refusals)}`);
  assert.deepEqual(card.spell!.targets.map((row) => row.save!.success), [false, false], "both failed");
  assert.deepEqual(card.spell!.targets.map((row) => row.target.id), [dragon.id, dragon.id], "one entry behind both rows");
  // The DM spends a resistance for the SECOND token.
  dm.send({ type: "act.resist", messageId: card.id, targetId: dragon.id, tokenId: two.id });
  await tick();
  const after = last("spell")!;
  assert.deepEqual(after.spell!.targets.map((row) => row.save!.success), [false, true], "only the named token resisted");
  assert.equal(after.spell!.targets[1].save!.legendary, true);
  const live = entryOf(dragon.id);
  assert.ok(live.kind === "npc" && live.runtime.legendaryResistanceUsed === 1, "one resistance spent");
});
