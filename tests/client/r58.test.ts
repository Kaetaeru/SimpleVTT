/**
 * R58 (ROLL20_TABLE_SPEC.md D193): what a use does to other people.
 *
 * R42 built the table-level half of a contract — `act.contract` — and the host has answered it ever since. Nothing
 * in the app ever called it: `runContract` sat in the facade with no caller, so a feature that puts a condition on
 * somebody or hands out temporary hit points did its own sheet's half and stopped there. R58 connects it, and opens
 * the operations that need a target: `temp-hp.grant`, `healing.apply` and `content.grant` aimed at `allies`.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { newCampaign } from "../../client/campaign/model";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { emptySource } from "../../client/character/source";
import { initialRuntime } from "../../client/character/runtime";
import { tableOutcome } from "../../client/rules/contractTable";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { ids } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const CONTRACTS = JSON.parse(readFileSync("content/supplements/phb-2024.feat-common-play/module.json", "utf8"));

const featEntry = (slug: string, name: string) => ({
  id: `phb2024.feat.${slug}`, category: "feat",
  presentation: { defaultLocale: "ko-KR", originalName: name, locales: { "ko-KR": { name } } },
  mechanics: [{ kind: "feat-definition", config: { tier: "general", minimumLevel: 4, abilityIncrease: { any: ["cha"], amount: 1, maximum: 20 } } }],
});
const supplement = (slugs: Array<[string, string]>) => ({
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json", schemaVersion: "0.1-draft",
  moduleId: "phb-2024-supplement", moduleVersion: "1", rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
  defaultLocale: "ko-KR", dependencies: [], conflicts: [], capabilities: [], extensionPoints: [], content: slugs.map(([slug, name]) => featEntry(slug, name)),
});

function bardWith(slug: string, name: string, who = "음유시인") {
  const catalog = createCatalog([supplement([[slug, name]]), CONTRACTS] as never);
  const base = emptySource({
    name: who, origin: { speciesId: ids.species("human"), backgroundId: ids.background("criminal") },
    abilities: { method: "manual", base: { str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 17 } },
    tracks: Array.from({ length: 8 }, () => ({ classId: ids.cls("bard"), hp: { kind: "fixed" as const } })),
    equipment: { mode: "loadout" },
  });
  const made = autofill(base, catalog, { prefer: { "class.3.asi": [`phb2024.feat.${slug}`] } });
  return { catalog, made, runtime: initialRuntime(made.derived), derived: made.derived };
}

test("R58: 고무적인 지도자's temporary hit points are aimed at people, with a cap (D193)", () => {
  const { catalog, derived } = bardWith("inspiring-leader", "고무적인 지도자");
  const outcome = tableOutcome(derived, catalog, "feat:inspiring-leader")!;
  assert.ok(outcome, "the use asks the table for something");
  assert.equal(outcome.party.tempHp, String(derived.level + derived.abilities.cha.modifier));
  assert.equal(outcome.party.max, 6, "최대 여섯");
  assert.ok(outcome.notes.some((note) => note.includes("30피트")), JSON.stringify(outcome.notes));
});

test("R58: 요리사 and 독 제조자 put an item in somebody's bag (D193)", () => {
  const cook = bardWith("chef", "요리사");
  const outcome = tableOutcome(cook.derived, cook.catalog, "feat:chef")!;
  assert.deepEqual(outcome.party.grants, ["phb2024.item.chef-treat"]);
  const poisoner = bardWith("poisoner", "독 제조자");
  assert.deepEqual(tableOutcome(poisoner.derived, poisoner.catalog, "feat:poisoner")!.party.grants, ["phb2024.item.poisoner-dose"]);
  // 치유사 heals somebody else instead, one at a time.
  const healer = bardWith("healer", "치유사");
  const heal = tableOutcome(healer.derived, healer.catalog, "feat:healer")!;
  assert.equal(heal.party.heal, `1d6+${healer.derived.proficiencyBonus}`);
  assert.equal(heal.party.max, 1);
});

test("R58: a feature aimed at nobody in particular still asks nothing of the table (D193)", () => {
  const { catalog, derived } = bardWith("tough", "강인함");
  assert.equal(tableOutcome(derived, catalog, "feat:tough"), null, "hit points on your own sheet need no board");
});

test("R58: the table applies it — temp HP, healing and the item all land on the chosen people (D193)", async () => {
  const hub = new MemoryHub();
  const base = newCampaign("R58 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R58AAA" };
  const leader = bardWith("inspiring-leader", "고무적인 지도자", "지휘관");
  const cat = leader.catalog;
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, cat)),
    pcContractOutcome: (entry, ruleKey) => tableOutcome(derivedOf(entry, cat), cat, ruleKey),
    contentName: (contentId) => cat.itemById(contentId)?.name ?? cat.entry(contentId)?.name });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R58AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R58AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "야영지", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const friend = bardWith("tough", "강인함", "동료");
  const leaderEntry = newJournalCharacter(campaign.id, "alice", leader.made.source, leader.runtime, { owner: "alice" });
  const friendEntry = newJournalCharacter(campaign.id, "alice", friend.made.source, { ...friend.runtime, hp: { ...friend.runtime.hp, current: 5 } }, { owner: "alice" });
  alice.send({ type: "journal.put", entry: leaderEntry });
  alice.send({ type: "journal.put", entry: friendEntry });
  await tick();
  const leaderToken = tokenForCharacter(leaderEntry);
  const friendToken = tokenForCharacter(friendEntry);
  alice.send({ type: "token.put", pageId: scene.id, token: leaderToken });
  alice.send({ type: "token.put", pageId: scene.id, token: friendToken });
  await tick();
  const me = { entryId: leaderEntry.id, pageId: scene.id, tokenId: leaderToken.id };
  alice.send({ type: "act.contract", actor: me, ruleKey: "feat:inspiring-leader", targets: [{ entryId: friendEntry.id, pageId: scene.id, tokenId: friendToken.id }] });
  await tick();
  const sheet = host.journal.find((entry) => entry.id === friendEntry.id) as JournalCharacter;
  const expected = leader.derived.level + leader.derived.abilities.cha.modifier;
  assert.equal(sheet.runtime.hp.temp, expected, "the friend really has the temporary hit points");
  assert.ok([...host.archive].some((message) => message.content.includes(`임시 HP ${expected}`)), [...host.archive].slice(-2).map((message) => message.content).join(" | "));
});

test("R58: aiming at nobody claims nothing, and the log says so (D193)", async () => {
  const hub = new MemoryHub();
  const base = newCampaign("R58 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R58BBB" };
  const leader = bardWith("inspiring-leader", "고무적인 지도자", "지휘관");
  const cat = leader.catalog;
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: () => undefined,
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, cat)),
    pcContractOutcome: (entry, ruleKey) => tableOutcome(derivedOf(entry, cat), cat, ruleKey) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R58BBB", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R58BBB", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "야영지", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const entry = newJournalCharacter(campaign.id, "alice", leader.made.source, leader.runtime, { owner: "alice" });
  alice.send({ type: "journal.put", entry });
  await tick();
  const token = tokenForCharacter(entry);
  alice.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  alice.send({ type: "act.contract", actor: { entryId: entry.id, pageId: scene.id, tokenId: token.id }, ruleKey: "feat:inspiring-leader", targets: [] });
  await tick();
  assert.ok([...host.archive].some((message) => message.content.includes("대상을 고르지 않았습니다")), [...host.archive].slice(-2).map((message) => message.content).join(" | "));
});
