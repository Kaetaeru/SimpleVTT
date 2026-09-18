/**
 * R57 (ROLL20_TABLE_SPEC.md D192): the facts a person answers so the app can do the rest.
 *
 * Twenty clauses across the SRD and PHB feats were blocked on one thing: a scene has no positions (D109), so the app
 * cannot see whether anyone is within five feet or moved ten in a straight line. Those clauses were prose.
 *
 * A declared fact is the way through. `adjudication.request` with a `fact` stops being a sentence and becomes a
 * checkbox at a named moment; operations written `when: {ref: "fact:<id>"}` wait for the tick. The app still does
 * every number — the person answers the one thing it cannot see. Two moments are open: the pre-roll dialog, and the
 * reaction prompt, which R57 also opens for a *bystander* when the swing landed on somebody else.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { emptySource } from "../../client/character/source";
import { deriveCharacter } from "../../client/character/derive";
import { initialRuntime } from "../../client/character/runtime";
import { addItem } from "../../client/character/play";
import { monsterById } from "../../client/compendium/monsters";
import { parseContract } from "../../client/rules/contract";
import { offeredRiders } from "../../client/rules/attackRiders";
import { pcGuards } from "../../client/rules/contractReactions";
import { payContract } from "../../client/rules/contractUse";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, npcAttackSpec, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { ids } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const CONTRACTS = JSON.parse(readFileSync("content/supplements/phb-2024.feat-common-play/module.json", "utf8")) as { content: Array<{ id: string; mechanics: Array<{ config: Record<string, unknown> }> }> };

const featEntry = (slug: string, name: string) => ({
  id: `phb2024.feat.${slug}`, category: "feat",
  presentation: { defaultLocale: "ko-KR", originalName: name, locales: { "ko-KR": { name } } },
  mechanics: [{ kind: "feat-definition", config: { tier: "general", minimumLevel: 4, abilityIncrease: { any: ["str"], amount: 1, maximum: 20 } } }],
});
const supplement = (slugs: Array<[string, string]>) => ({
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json", schemaVersion: "0.1-draft",
  moduleId: "phb-2024-supplement", moduleVersion: "1", rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
  defaultLocale: "ko-KR", dependencies: [], conflicts: [], capabilities: [], extensionPoints: [], content: slugs.map(([slug, name]) => featEntry(slug, name)),
});

function fighterWith(slugs: Array<[string, string]>, weapon = "greatsword", name = "전사") {
  const catalog = createCatalog([supplement(slugs), CONTRACTS as never] as never);
  const base = emptySource({
    name, origin: { speciesId: ids.species("human"), backgroundId: ids.background("criminal") },
    abilities: { method: "manual", base: { str: 17, dex: 12, con: 14, int: 10, wis: 10, cha: 8 } },
    tracks: Array.from({ length: 8 }, () => ({ classId: ids.cls("fighter"), hp: { kind: "fixed" as const } })),
    equipment: { mode: "loadout" },
  });
  const made = autofill(base, catalog, { prefer: { "class.3.asi": [`phb2024.feat.${slugs[0][0]}`] } });
  const runtime = addItem(initialRuntime(made.derived), { itemId: `dnd.srd521.item.weapon.${weapon}`, name: weapon });
  const derived = deriveCharacter(made.source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory });
  return { catalog, made, runtime, derived };
}

test("R57: a declared fact is a checkbox, and what depends on it waits for the tick (D192)", () => {
  const { catalog, runtime, derived } = fighterWith([["charger", "돌격자"]]);
  const sword = derived.attacks.find((attack) => attack.itemId?.endsWith(".greatsword"))!;
  // R63 (D198): 돌격자 is asked once the swing has landed.
  const [rider] = offeredRiders(derived, sword, { moment: "on-hit" });
  assert.ok(rider, JSON.stringify(derived.attackRiders));
  assert.deepEqual(rider.facts, [{ id: "charged", question: "대상을 향해 직선으로 10피트 이상 이동했다" }]);
  assert.deepEqual(rider.damage, [{ formula: "1d8", type: "weapon", factId: "charged" }]);

  // Ticked the rider but not the fact: the app claims nothing.
  const withoutFact = pcAttackSpec({ runtime } as never, derived, sword.id, { contracts: ["feat:charger"] }, catalog)!.spec;
  assert.deepEqual(withoutFact.riders, [], "no ten feet declared, no 1d8");
  // Ticked both: the damage lands.
  const withFact = pcAttackSpec({ runtime } as never, derived, sword.id, { contracts: ["feat:charger"], facts: ["charged"] }, catalog)!.spec;
  assert.deepEqual(withFact.riders!.map((part) => [part.label, part.formula]), [["돌격자", "1d8"]]);
});

test("R57: 대형 무기 달인 asks whether it was the Attack action (D192)", () => {
  const { catalog, runtime, derived } = fighterWith([["great-weapon-master", "대형 무기 달인"]]);
  const sword = derived.attacks.find((attack) => attack.itemId?.endsWith(".greatsword"))!;
  const [rider] = offeredRiders(derived, sword, { moment: "on-hit" });
  assert.deepEqual(rider.facts.map((fact) => fact.id), ["attack-action"]);
  const bare = pcAttackSpec({ runtime } as never, derived, sword.id, { contracts: ["feat:great-weapon-master"] }, catalog)!.spec;
  assert.deepEqual(bare.riders, []);
  const declared = pcAttackSpec({ runtime } as never, derived, sword.id, { contracts: ["feat:great-weapon-master"], facts: ["attack-action"] }, catalog)!.spec;
  assert.equal(declared.riders![0].formula, String(derived.proficiencyBonus));
});

test("R57: a reaction's number waits on its fact too (D192)", () => {
  const { catalog, runtime, derived } = fighterWith([["defensive-duelist", "방어적 결투가"]]);
  const [offer] = pcGuards({ runtime }, derived, catalog, "attack.hit-self");
  assert.equal(offer.acBonus, derived.proficiencyBonus);
  assert.equal(offer.acBonusFact, "finesse-in-hand", "the AC is gated, not unconditional");
  assert.deepEqual(offer.facts.map((fact) => fact.question), ["기교 무기를 들고 있고, 맞은 것이 근접 공격이다"]);
});

test("R57: every fact names a moment this engine can ask at (D192)", () => {
  const moments = new Set<string>();
  for (const entry of CONTRACTS.content) {
    const contract = parseContract(entry.mechanics[0].config, entry.id);
    assert.deepEqual(contract.unsupported, [], contract.id);
    for (const operation of [...contract.entryPoints.flatMap((point) => point.operations), ...contract.interceptors.flatMap((item) => item.operations)]) {
      if (operation.kind === "adjudication.request" && operation.fact) moments.add(operation.fact.at);
    }
  }
  // R63 (D198): the feats' own facts moved from the dialog before the dice to the window a hit opens.
  assert.deepEqual([...moments].sort(), ["on-hit", "reaction"]);
});

test("R57: an ally being hit opens a window for the bystander who declared one (D192)", async () => {
  const hub = new MemoryHub();
  const base = newCampaign("R57 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R57AAA" };
  const guardian = fighterWith([["interception", "가로막기"]], "greatsword", "수호자");
  const cat = guardian.catalog;
  const dice = { value: 0.9 };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcAttackSpec: (entry, attackId, riders) => pcAttackSpec(entry, derivedOf(entry, cat), attackId, riders, cat),
    pcGuards: (entry, trigger) => pcGuards(entry, derivedOf(entry, cat), cat, trigger),
    pcPayContract: (entry, payments, outcome) => payContract(entry.runtime, derivedOf(entry, cat), payments, outcome),
    pcStats: (entry) => pcStats(derivedOf(entry, cat)) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R57AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R57AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  // The victim has no reaction of their own; the guardian beside them does.
  const victim = fighterWith([["actor", "배우"]], "greatsword", "피해자");
  const victimEntry = newJournalCharacter(campaign.id, "alice", victim.made.source, victim.runtime, { owner: "alice" });
  const guardianEntry = newJournalCharacter(campaign.id, "alice", guardian.made.source, guardian.runtime, { owner: "alice" });
  alice.send({ type: "journal.put", entry: victimEntry });
  alice.send({ type: "journal.put", entry: guardianEntry });
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const victimToken = tokenForCharacter(victimEntry);
  const guardianToken = tokenForCharacter(guardianEntry);
  const ogreToken = tokenForNpc(ogre);
  alice.send({ type: "token.put", pageId: scene.id, token: victimToken });
  alice.send({ type: "token.put", pageId: scene.id, token: guardianToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const ogreRef = { entryId: ogre.id, pageId: scene.id, tokenId: ogreToken.id };
  const swing = ogre.statBlock.actions.find((action) => action.kind === "attack")!.name;
  assert.ok(npcAttackSpec(ogre, swing));
  dm.send({ type: "act.attack", actor: ogreRef, attacker: ogreRef, targets: [{ entryId: victimEntry.id, pageId: scene.id, tokenId: victimToken.id }], attack: { source: "npc", actionName: swing } } as never);
  await tick();
  const ask = [...host.archive].reverse().find((message) => message.type === "prompt" && !message.prompt?.outcome);
  assert.ok(ask, [...host.archive].slice(-2).map((message) => message.content).join(" | "));
  assert.equal(ask!.prompt!.reactor.entryId, guardianEntry.id, "the bystander is asked, not the victim");
  assert.equal(ask!.prompt!.guard!.trigger, "attack.hit-ally");
  assert.deepEqual(ask!.prompt!.guard!.features.map((feature) => feature.name), ["가로막기"]);

  // Taking it without confirming the five feet claims nothing; confirming it takes the damage off.
  const before = (host.journal.find((entry) => entry.id === victimEntry.id) as JournalCharacter).runtime.hp.current;
  dice.value = 0.99;
  alice.send({ type: "act.guard", messageId: ask!.id, feature: "가로막기", facts: ["within-5ft"] });
  await tick();
  const card = [...host.archive].reverse().find((message) => message.action)!.action!;
  const raw = card.damage.reduce((sum, part) => sum + part.adjusted, 0);
  assert.ok(before - card.hpAfter < raw, `${before - card.hpAfter} taken of ${raw} rolled`);
  assert.ok([...host.archive].some((message) => message.content.includes("가로막기")), "and the log says who stepped in");
});

test("D305: the bystander's window never goes to the attacker — 가로막기 does not blunt its own swing", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D305 시험", { userId: "dm", displayName: "DM" }), joinCode: "D305AA" };
  const guardian = fighterWith([["interception", "가로막기"]], "greatsword", "수호자");
  const cat = guardian.catalog;
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.9,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcAttackSpec: (entry, attackId, riders) => pcAttackSpec(entry, derivedOf(entry, cat), attackId, riders, cat),
    pcGuards: (entry, trigger) => pcGuards(entry, derivedOf(entry, cat), cat, trigger),
    pcPayContract: (entry, payments, outcome) => payContract(entry.runtime, derivedOf(entry, cat), payments, outcome),
    pcStats: (entry) => pcStats(derivedOf(entry, cat)) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D305AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const guardianEntry = newJournalCharacter(campaign.id, "dm", guardian.made.source, guardian.runtime);
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  for (const entry of [guardianEntry, ogre]) dm.send({ type: "journal.put", entry });
  await tick();
  const guardianToken = tokenForCharacter(guardianEntry);
  const ogreToken = tokenForNpc(ogre);
  dm.send({ type: "token.put", pageId: scene.id, token: guardianToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const sword = guardian.derived.attacks.find((attack) => attack.name.includes("대검")) ?? guardian.derived.attacks[0];
  dm.send({ type: "act.attack", attacker: { entryId: guardianEntry.id, pageId: scene.id, tokenId: guardianToken.id }, targets: [{ entryId: ogre.id, pageId: scene.id, tokenId: ogreToken.id }], attack: { source: "weapon", attackId: sword.id }, overrides: { outcome: "hit" } });
  await tick();
  const guardAsks = host.archive.filter((message) => message.type === "prompt" && message.prompt?.guard?.trigger === "attack.hit-ally");
  assert.deepEqual(guardAsks.map((message) => message.content), [], "no window asks the attacker to guard its own target");
});
