/**
 * V0.9 D326 (SRD_MODULE_PLAN.md §8): tables the dice read, and what a spell keeps charging.
 *
 * - 무지개 분사 rolls a d8 for every creature in the cone and the ray it lands on decides the damage type; the
 *   three rays that are not damage say what the table has to judge instead (`rayTable`).
 * - 순간이동 rolls the d100 its table asks for and writes the row on the card (`outcomeTable`).
 * - 소원 leaves its price behind: every spell the caster casts afterwards costs 1d10 necrotic per slot level,
 *   through the same "cast" entry point 주문 회상의 은총 uses.
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
const combatant = (over: Partial<Combatant> = {}): Combatant => ({ id: "t", name: "대상", kind: "npc", ac: 13, hp: { current: 80, max: 80, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 1, effects: [], ...over });
const caster = combatant({ id: "c", name: "시전자", kind: "pc" });
const casterStats: CasterStats = { attackBonus: 9, saveDc: 19, modifier: 5, level: 17 };
const spec = (id: string, level: number, name = id) => ({ spellId: `dnd.srd521.spell.${id}`, name, level, exec: spellExec(`dnd.srd521.spell.${id}`)! });

test("D326: 무지개 분사 rolls a ray for every creature in the cone", () => {
  const a = combatant({ id: "a", name: "가" });
  const b = combatant({ id: "b", name: "나" });
  // 12d6 for the area, then per target a ray and a save: 2 = orange (acid), then 6 = indigo, which is the table's.
  const result = resolveSpell({ caster, casterStats, spec: spec("prismatic-spray", 7, "무지개 분사"), targets: [{ combatant: a, stats }, { combatant: b, stats }], dice: scripted(...Array(12).fill(1), 2, 3, 6, 3) });
  assert.match(result.targets[0].note ?? "", /주황/);
  assert.equal(result.targets[0].damage?.damage[0].part.type, "acid");
  assert.match(result.targets[1].note ?? "", /남색/, "the indigo ray is the table's to judge");
  assert.equal(result.targets[1].damage, undefined);
});

test("D326: 순간이동 rolls its d100 and writes the row", () => {
  const result = resolveSpell({ caster, casterStats, spec: spec("teleport", 7, "순간이동"), targets: [{ combatant: combatant(), stats }], dice: scripted(3) });
  assert.match(result.note ?? "", /d100 = 3/);
  assert.match(result.note ?? "", /사고/);
});

test("D326: 소원 charges its price on every later cast, at the table", async () => {
  const cat = createCatalog([]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D326 시험", { userId: "dm", displayName: "DM" }), joinCode: "D326AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D326AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "탑", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = autofill(sourceOf({ name: "마법사", classes: "wizard", level: 17, abilities: { int: 20 } }), cat);
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const npc = newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 5, hp: 40, creatureType: "construct", abilities: { str: 10, dex: 6, con: 14, int: 1, wis: 6, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, npc: { entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id } };
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const now = new Date().toISOString();
  dm.send({ type: "journal.put", entry: { ...sheet(), runtime: { ...sheet().runtime, effects: [
    { key: "spell:dnd.srd521.spell.wish", name: "소원", source: "spell" as const, duration: "특수", concentration: false, elapsed: 0, startedAt: now, bearer: true, cast: { level: 9, saveDc: 19, modifier: 5 } },
  ], updatedAt: now } } });
  await tick();
  const before = sheet().runtime.hp.current;
  dm.send({ type: "act.cast", caster: refs.pc, spellId: "dnd.srd521.spell.fireball", targets: [refs.npc], method: { kind: "slot", level: 3 } });
  await tick();
  assert.ok(sheet().runtime.hp.current < before, `the price is paid (${before} → ${sheet().runtime.hp.current}): ${host.archive.slice(-3).map((message) => message.content).join(" | ")}`);
  assert.ok(host.archive.some((message) => message.content.includes("소원")), "and the card names it");
});
