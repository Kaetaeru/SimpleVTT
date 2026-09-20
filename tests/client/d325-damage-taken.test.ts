/**
 * V0.9 D325 (SRD_MODULE_PLAN.md §8): the moment a creature is hurt.
 *
 * Damage arrives by many roads — a swing, a spell, a contract strike, an aura — and the rule that watches for it
 * was declared and never read. Every road now passes one gate:
 * - 수면 and the charm spells end when their target takes damage (`termination.targetTakesDamage`).
 * - 지배 계열 and 끔찍한 웃음 do not end: their save comes round again (`repeatSaveOnDamage`), and a success ends it.
 * - 보복 is a reaction button on the barbarian's own row (the scene has no positions, D109).
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
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const brute = () => (parseCustomMonster(JSON.stringify({ name: "오우거", ac: 11, hp: 59, creatureType: "giant", abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster;

async function table(classes = "wizard", random = () => 0.5) {
  const cat = createCatalog([]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D325 시험", { userId: "dm", displayName: "DM" }), joinCode: "D325AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D325AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "폐허", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = autofill(sourceOf({ name: "주인공", classes, level: 9, abilities: { int: 18 } }), cat);
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const npc = newJournalNpc(campaign.id, "dm", brute());
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const npcEntry = () => host.journal.find((entry) => entry.id === npc.id) as Extract<ReturnType<typeof newJournalNpc>, { kind: "npc" }>;
  return { cat, host, dm, made, scene,
    refs: { pc: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, npc: { entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id } },
    pcEntry: () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter,
    npcEntry };
}

test("D325: 수면 ends when its sleeper is hurt, whatever hurt them", async () => {
  const t = await table();
  const now = new Date().toISOString();
  const npc = t.npcEntry();
  t.dm.send({ type: "journal.put", entry: { ...npc, runtime: { ...npc.runtime, conditions: ["행동불능"], effects: [
    { key: "spell:dnd.srd521.spell.sleep", name: "수면", source: "spell" as const, duration: "1분", concentration: false, elapsed: 0, startedAt: now, bearer: true, conditions: ["행동불능"], cast: { level: 1, saveDc: 15, modifier: 4 } },
  ], updatedAt: now } } });
  await tick();
  assert.equal(t.npcEntry().runtime.effects?.length, 1);
  // A cantrip is enough: the effect ends on the damage, not on a save.
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: "dnd.srd521.spell.fire-bolt", targets: [t.refs.npc], method: { kind: "cantrip" }, overrides: { outcome: "hit" } });
  await tick();
  assert.deepEqual(t.npcEntry().runtime.effects ?? [], [], t.host.archive.slice(-3).map((message) => message.content).join(" | "));
  assert.ok(t.host.archive.some((message) => message.content.includes("피해를 받음")), "and the table is told why");
});

test("D325: 지배 계열 brings the save round again instead of ending", async () => {
  assert.equal(spellExec("dnd.srd521.spell.dominate-person")!.repeatSaveOnDamage, true);
  assert.equal((spellExec("dnd.srd521.spell.dominate-person")!.effects ?? []).some((effect) => effect.termination?.targetTakesDamage), false);
  // At the table: the save is rolled when the damage lands, and this 20 ends the spell.
  const t = await table("wizard", () => 0.99);
  const now = new Date().toISOString();
  const npc = t.npcEntry();
  t.dm.send({ type: "journal.put", entry: { ...npc, runtime: { ...npc.runtime, conditions: ["매혹"], effects: [
    { key: "spell:dnd.srd521.spell.dominate-person", name: "인간형 지배", source: "spell" as const, duration: "집중", concentration: false, elapsed: 0, startedAt: now, bearer: true, conditions: ["매혹"], endSave: { ability: "wis" as const, dc: 16, conditions: ["매혹"] }, cast: { level: 5, saveDc: 16, modifier: 4 } },
  ], updatedAt: now } } });
  await tick();
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: "dnd.srd521.spell.fire-bolt", targets: [t.refs.npc], method: { kind: "cantrip" }, overrides: { outcome: "hit" } });
  await tick();
  const line = t.host.archive.map((message) => message.content).filter((content) => content.includes("인간형 지배")).join(" | ");
  assert.match(line, /피해를 받아/, line || "(내성 줄 없음)");
  assert.deepEqual(t.npcEntry().runtime.effects ?? [], [], "a 20 ends it");
});

test("D325: 보복 answers a hit by itself, and damage that is no hit is a button", () => {
  const cat = createCatalog([]);
  const prefer = { "class.2.subclass": ["dnd.srd521.subclass.barbarian.berserker"] };
  const made = autofill(sourceOf({ name: "광전사", classes: "barbarian", level: 14, abilities: { str: 18 }, choices: prefer }), cat, { prefer });
  const use = made.derived.features.find((feature) => feature.name === "보복");
  assert.ok(use, made.derived.features.map((feature) => feature.name).join(", "));
  const rules = use!.rules ?? [];
  // The reaction window a hit opens was already there; the button is for damage that no attack roll caused
  // (a spell, an aura), which the window cannot see.
  assert.ok(rules.some((rule) => rule.includes("reaction.strike-back")), rules.join(" · "));
  assert.ok(rules.some((rule) => rule.includes("보복 (근접 공격)")), rules.join(" · "));
  assert.ok(rules.some((rule) => rule.includes("5피트")), rules.join(" · "));
});
