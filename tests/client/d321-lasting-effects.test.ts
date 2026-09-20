/**
 * V0.9 D321 (SRD_MODULE_PLAN.md §8): what a lasting effect does to its bearer, with the cast's own numbers.
 *
 * An effect now remembers the cast that started it — the slot, the caster's save DC and their spellcasting
 * modifier — so what it does later belongs to the caster and not to whoever carries it:
 * - 속박 강타 deals 1d6 piercing at the start of the bearer's turns, one more d6 per slot above the first, and it
 *   reaches a monster too (a spell effect's turn rules used to run for characters only).
 * - 영웅심 gives the caster's modifier as temporary hit points, not the bearer's.
 * - 서리 손길 stops its bearer regaining hit points while it lasts.
 * - 가속 leaves 행동불능 behind when it ends.
 * - 하급 원소 소환 adds its dice to the caster's own hits, 2d8 more per slot above the fourth.
 * - 이계 접촉's incapacity lasts until a long rest, which ends it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { JournalCharacter, JournalNpc } from "../../client/campaign/journal";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { spellExec } from "../../client/compendium/spells";
import { bearerRolls } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const wolf = () => (parseCustomMonster(JSON.stringify({ name: "늑대", ac: 13, hp: 30, creatureType: "beast", abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster;

/** A character, a wolf and a turn tracker on one scene. */
async function table(level = 5, classes = "ranger", abilities: Record<string, number> = { wis: 16 }) {
  const cat = createCatalog([]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D321 시험", { userId: "dm", displayName: "DM" }), joinCode: "D321AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D321AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "숲", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = autofill(sourceOf({ name: "순찰자", classes, level, abilities }), cat);
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const npc = newJournalNpc(campaign.id, "dm", wolf());
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "순찰자", tokenId: tokens.pc.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.add", turn: { name: "늑대", tokenId: tokens.npc.id, pageId: scene.id, entryId: npc.id, initiative: 10 } });
  dm.send({ type: "tracker.next" });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, npc: { entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id } };
  return { cat, host, dm, refs, scene, pcId: pc.id, npcId: npc.id, made,
    pcEntry: () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter,
    npcEntry: () => host.journal.find((entry) => entry.id === npc.id) as JournalNpc };
}

test("D321: 속박 강타 hurts the monster it caught at the start of its turn, one d6 more per slot", async () => {
  const t = await table();
  // The effect sits on the wolf as a 2nd-level cast: 2d6 when its turn starts.
  t.dm.send({ type: "journal.put", entry: { ...t.npcEntry(), runtime: { ...t.npcEntry().runtime, effects: [{ key: "spell:dnd.srd521.spell.ensnaring-strike", name: "속박의 강타", source: "spell", duration: "집중", concentration: false, elapsed: 0, startedAt: new Date().toISOString(), bearer: true, from: t.pcId, cast: { level: 2, saveDc: 15, modifier: 4 } }], updatedAt: new Date().toISOString() } } });
  await tick();
  const before = t.npcEntry().runtime.hp.current;
  t.dm.send({ type: "tracker.next" });
  await tick();
  const card = t.host.archive.filter((message) => message.content.includes("속박")).pop();
  assert.ok(card, t.host.archive.slice(-4).map((message) => message.content).join(" | "));
  // Two dice, not one: at this host's fixed roller each d6 is a 4, so a 1st-level cast would have taken 4.
  assert.ok(before - t.npcEntry().runtime.hp.current >= 6, `2d6 at a 2nd-level slot (${before} → ${t.npcEntry().runtime.hp.current}): ${card!.content}`);
});

test("D321: 영웅심 gives the caster's modifier, and 서리 손길 keeps its bearer from being healed", async () => {
  const t = await table(5, "cleric", { wis: 18, cha: 8 });
  const hurt = { ...t.pcEntry().runtime.hp, current: 5 };
  const now = new Date().toISOString();
  // Heroism cast by an ally with a +5 modifier: the bearer's own Charisma (−1) never comes into it.
  t.dm.send({ type: "journal.put", entry: { ...t.pcEntry(), runtime: { ...t.pcEntry().runtime, hp: hurt, effects: [
    { key: "spell:dnd.srd521.spell.heroism", name: "영웅심", source: "spell" as const, duration: "집중", concentration: false, elapsed: 0, startedAt: now, bearer: true, from: t.npcId, cast: { level: 1, saveDc: 15, modifier: 5 } },
    { key: "spell:dnd.srd521.spell.chill-touch", name: "서리 손길", source: "spell" as const, duration: "1라운드", concentration: false, elapsed: 0, startedAt: now, bearer: true, from: t.npcId, cast: { level: 0, saveDc: 13, modifier: 3 } },
  ], updatedAt: now } } });
  await tick();
  t.dm.send({ type: "tracker.next" });
  await tick();
  t.dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(t.pcEntry().runtime.hp.temp, 5, "the caster's +5, not the bearer's −1");
  // A healing spell on a creature under 서리 손길 heals nothing.
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: "dnd.srd521.spell.cure-wounds", targets: [t.refs.pc], method: { kind: "slot", level: 1 } });
  await tick();
  assert.equal(t.pcEntry().runtime.hp.current, 5, t.host.archive.slice(-2).map((message) => message.content).join(" | "));
  const healing = t.host.archive.filter((message) => message.type === "spell").pop();
  assert.match(healing?.spell?.targets[0]?.note ?? "", /회복 불가/, JSON.stringify(healing?.spell?.targets[0]));
});

test("D321: 가속 leaves 행동불능 when it ends, and 이계 접촉 lasts until a long rest", async () => {
  const t = await table(5, "wizard", { int: 18 });
  const now = new Date().toISOString();
  t.dm.send({ type: "journal.put", entry: { ...t.pcEntry(), runtime: { ...t.pcEntry().runtime, effects: [
    { key: "spell:dnd.srd521.spell.haste", name: "가속", source: "spell" as const, duration: "1라운드", rounds: 1, concentration: false, elapsed: 0, startedAt: now, bearer: true, cast: { level: 3, saveDc: 15, modifier: 4 }, endConditions: ["incapacitated"], endDuration: "다음 턴이 끝날 때까지" },
    { key: "spell:dnd.srd521.spell.contact-other-plane", name: "이계 접촉", source: "spell" as const, duration: "특수", concentration: false, elapsed: 0, startedAt: now, bearer: true, conditions: ["행동불능"] },
  ], updatedAt: now } } });
  await tick();
  t.dm.send({ type: "tracker.next" });
  await tick();
  t.dm.send({ type: "tracker.next" });
  await tick();
  assert.ok(t.pcEntry().runtime.conditions.includes("행동불능"), `가속's lethargy: ${t.pcEntry().runtime.conditions.join(", ")}`);
  // A long rest ends what lasts until one.
  t.dm.send({ type: "table.rest", kind: "long" });
  await tick();
  assert.deepEqual(t.pcEntry().runtime.effects ?? [], [], "the rest ends both");
  assert.equal(spellExec("dnd.srd521.spell.contact-other-plane")!.trackedEffects?.[0].summary.includes("수동 처리 필요"), false);
});

test("D321: 하급 원소 소환 adds 2d8 on a hit, and 2d8 more per slot above the fourth", () => {
  const effect = (level: number) => ({ key: "spell:dnd.srd521.spell.conjure-minor-elementals", name: "하급 원소 소환", source: "spell" as const, duration: "집중", concentration: true, elapsed: 0, startedAt: "", bearer: true, cast: { level, saveDc: 15, modifier: 4 } });
  assert.deepEqual(bearerRolls([effect(4)], false).bearerDamage?.map((part) => part.formula), ["2d8"]);
  assert.deepEqual(bearerRolls([effect(6)], false).bearerDamage?.map((part) => part.formula), ["6d8"]);
});
