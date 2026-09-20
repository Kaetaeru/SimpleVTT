/**
 * V0.9 D323 (SRD_MODULE_PLAN.md §8): what an effect does *only sometimes*.
 *
 * - 독으로부터의 보호 gives advantage on saves against being poisoned, not on every save.
 * - 선악 보호 and 성스러운 오라 hinder only aberrations, fiends, undead and their kin.
 * - 희망의 봉화 maximizes the healing its target receives (and rolls its death saves with advantage).
 * - 육신 석화 counts its repeated save: three successes end it, three failures turn the target to stone.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { JournalCharacter } from "../../client/campaign/journal";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { spellExec } from "../../client/compendium/spells";
import type { ActorStats } from "../../client/rules/actions";
import { bearerRolls } from "../../client/rules/attackSpec";
import type { Combatant } from "../../client/rules/resolve";
import { resolveSpell, type CasterStats } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const scripted = (...values: number[]) => ({ d: (sides: number) => { const value = values.shift(); if (value === undefined) throw new Error("dice ran out"); return Math.min(sides, value); } });
const stats: ActorStats = { abilities: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, saves: { str: 0, dex: 2, con: 1, int: 0, wis: 1, cha: 0 }, skills: {}, proficiencyBonus: 2 };
const combatant = (over: Partial<Combatant> = {}): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 20, max: 40, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 1, effects: [], ...over });
const caster = combatant({ id: "c", name: "시전자", kind: "pc" });
const casterStats: CasterStats = { attackBonus: 5, saveDc: 13, modifier: 3, level: 9 };
const spec = (id: string, level: number, name = id) => ({ spellId: `dnd.srd521.spell.${id}`, name, level, exec: spellExec(`dnd.srd521.spell.${id}`)! });
const effectOf = (spellId: string, name: string) => ({ key: `spell:dnd.srd521.spell.${spellId}`, name, source: "spell" as const, duration: "집중", concentration: false, elapsed: 0, startedAt: "", bearer: true, cast: { level: 3, saveDc: 15, modifier: 4 } });

test("D323: 독으로부터의 보호 helps against poison only", () => {
  const guarded = combatant({ rollStates: bearerRolls([effectOf("protection-from-poison", "독으로부터의 보호")], false).rollStates });
  assert.deepEqual(guarded.rollStates?.map((state) => state.conditions), [["poisoned"]]);
  // 악취 구름 tries to poison: the save is rolled twice and the better kept.
  const poisoned = resolveSpell({ caster, casterStats, spec: spec("stinking-cloud", 3, "악취 구름"), targets: [{ combatant: guarded, stats }], dice: scripted(3, 17) });
  assert.equal(poisoned.targets[0].save?.advantage, "독으로부터의 보호");
  // 화염구 is not poison: one die only.
  const burnt = resolveSpell({ caster, casterStats, spec: spec("fireball", 3, "화염구"), targets: [{ combatant: guarded, stats }], dice: scripted(1, 1, 1, 1, 1, 1, 1, 1, 3) });
  assert.equal(burnt.targets[0].save?.advantage, undefined);
  assert.equal(burnt.targets[0].save?.success, false);
});

test("D323: 선악 보호 hinders only the creature types the spell names", () => {
  const rolls = bearerRolls([effectOf("protection-from-evil-and-good", "선악 보호")], false);
  assert.deepEqual(rolls.grantsDisadvantageFrom?.map((item) => item.creatureTypes.includes("fiend")), [true]);
  assert.equal(rolls.grantsDisadvantage, undefined, "everyone else swings normally");
});

test("D323: 희망의 봉화 maximizes the healing its target receives", () => {
  const blessed = combatant({ healingMaximized: "희망의 봉화" });
  const healed = resolveSpell({ caster, casterStats, spec: spec("cure-wounds", 1, "상처 치료"), targets: [{ combatant: blessed, stats }], dice: scripted(1) });
  assert.equal(healed.targets[0].healed, 16 + 3, "two maximized d8 plus the caster's modifier");
  assert.match(healed.targets[0].note ?? "", /최대값/);
});

test("D323: 육신 석화 counts three failures into stone, at the table", async () => {
  const cat = createCatalog([]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D323 시험", { userId: "dm", displayName: "DM" }), joinCode: "D323AA" };
  // Every d20 is a 1: the counted save fails three times.
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D323AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "동굴", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = autofill(sourceOf({ name: "도적", classes: "rogue", level: 5 }), cat);
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const npc = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "구경꾼", ac: 10, hp: 20, creatureType: "aberration", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const entry = () => host.journal.find((item) => item.id === pc.id) as JournalCharacter;
  const now = new Date().toISOString();
  dm.send({ type: "journal.put", entry: { ...entry(), runtime: { ...entry().runtime, conditions: ["포박"], effects: [
    { key: "spell:dnd.srd521.spell.flesh-to-stone", name: "육신 석화", source: "spell" as const, duration: "집중", concentration: false, elapsed: 0, startedAt: now, bearer: true, cast: { level: 6, saveDc: 16, modifier: 4 }, endSave: { ability: "con" as const, dc: 16, conditions: ["포박"] } },
  ], updatedAt: now } } });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "도적", tokenId: tokens.pc.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.add", turn: { name: "구경꾼", tokenId: tokens.npc.id, pageId: scene.id, entryId: npc.id, initiative: 10 } });
  for (let turn = 0; turn < 6; turn += 1) { dm.send({ type: "tracker.next" }); await tick(); }
  assert.ok(entry().runtime.conditions.includes("석화"), `three failures turn it to stone: ${entry().runtime.conditions.join(", ")} · ${JSON.stringify(entry().runtime.effects?.[0]?.tally)}`);
});
