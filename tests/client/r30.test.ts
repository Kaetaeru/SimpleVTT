/**
 * R30 (ROLL20_TABLE_SPEC.md D156–D159): a duration that really runs out, on anyone, in sight.
 *
 * A duration longer than a hundred rounds lost its counter outright, so an eight-hour effect sat on the sheet for
 * ever and only a person could end it. A monster had nowhere to put a timed effect at all — a Hold Person on an
 * ogre was a marker that never expired. And what a creature was under lived on its sheet, so the DM had to open a
 * window to answer "is it still held?". Plus a monster's reactions, which had a stat-block entry and no button.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { advanceRound, ageEffects, startEffect } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { parseDuration, remainingText } from "../../client/rules/activation";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcCombatant, pcConcentrationKey, npcCombatant } from "../../client/rules/attackSpec";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter, JournalNpc } from "../../client/campaign/journal";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("duration: a long effect is counted, shown as time, and ends when the time passes (D156)", () => {
  assert.equal(parseDuration("8시간").rounds, 4800);
  assert.equal(parseDuration("1분").rounds, 10);
  assert.equal(parseDuration("무효화될 때까지").rounds, undefined);
  assert.equal(remainingText(4800, 0), "8시간 남음");
  assert.equal(remainingText(4800, 4790), "10라운드 남음");
  const made = build({ name: "마법사", classes: "wizard", level: 5 });
  let runtime = startEffect(initialRuntime(made.derived), { key: "spell:x", name: "마법사의 갑옷", source: "spell", duration: "8시간", concentration: false, rounds: 4800 });
  // One round at a time changes nothing for hours…
  runtime = advanceRound(runtime);
  assert.equal(runtime.effects.length, 1);
  assert.equal(runtime.effects[0].elapsed, 1);
  // …and one step of an evening's worth ends it.
  runtime = advanceRound(runtime, 4800);
  assert.equal(runtime.effects.length, 0, "eight hours later it is over");
  assert.ok(runtime.log.some((line) => line.text.includes("지속 시간 끝")), JSON.stringify(runtime.log.slice(-3)));
});

test("duration: the ager is shared, so a monster's effects use the same arithmetic (D157)", () => {
  const ogre = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.ogre")!);
  const held = { ...ogre, runtime: { ...ogre.runtime, effects: [{ key: "spell:hold", name: "인간형 포박", source: "spell" as const, duration: "1분 (10라운드)", concentration: false, rounds: 10, elapsed: 0, startedAt: "" }] } };
  const half = ageEffects(held.runtime, 4);
  assert.deepEqual([half.ended.length, half.running[0].elapsed], [0, 4]);
  const over = ageEffects(held.runtime, 10);
  assert.deepEqual([over.ended.length, over.runtime.effects!.length], [1, 0]);
  // And the resolver is told what the monster is under, as it always has been for a character.
  assert.deepEqual(npcCombatant(held as typeof ogre).effects, ["인간형 포박"]);
  assert.deepEqual(npcCombatant(ogre).effects, []);
});

test("table: the clock ends a long effect, and a monster's effect runs out on its own turn (D156, D157)", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R30 시험", { userId: "dm", displayName: "DM" }), joinCode: "R30AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R30AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "동굴", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "마법사", classes: "wizard", level: 5 });
  const armored = startEffect(initialRuntime(made.derived), { key: "spell:mage-armor", name: "마법사의 갑옷", source: "spell", duration: "8시간", concentration: false, rounds: 4800 });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, armored);
  dm.send({ type: "journal.put", entry: pc });
  const ogreBase = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  const ogre = { ...ogreBase, runtime: { ...ogreBase.runtime, conditions: ["마비"], effects: [{ key: "spell:hold", name: "인간형 포박", source: "spell" as const, duration: "1분 (10라운드)", concentration: false, rounds: 2, elapsed: 0, startedAt: "", endSave: { ability: "wis" as const, dc: 15, conditions: ["마비"] } }] } };
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = { ...tokenForNpc(ogre), markers: [{ name: "마비" }] };
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const sheetOf = <T,>(id: string) => host.journal.find((entry) => entry.id === id) as unknown as T;
  // Combat: two of the ogre's turns end and its own effect runs out, taking the condition and the marker with it.
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns: [newTurn({ name: "오우거", initiative: 20, tokenId: ogreToken.id, pageId: scene.id, entryId: ogre.id }), newTurn({ name: "마법사", initiative: 10, tokenId: pcToken.id, pageId: scene.id, entryId: pc.id })] } });
  await tick();
  for (let at = 0; at < 4; at += 1) { dm.send({ type: "tracker.next" }); await tick(); }
  const heldOgre = sheetOf<JournalNpc>(ogre.id);
  assert.deepEqual(heldOgre.runtime.effects ?? [], [], "the hold ran out by itself");
  assert.ok(!heldOgre.runtime.conditions.includes("마비"), "and took the condition with it");
  assert.ok(!host.pageList[0].tokens.find((token) => token.id === ogreToken.id)!.markers.some((marker) => marker.name === "마비"), "…and the marker on the board");
  assert.ok(host.archive.some((message) => message.content.includes("지속 시간 끝")), "the table is told");
  // The mage armour is still on: a few rounds is not eight hours.
  assert.equal((sheetOf<JournalCharacter>(pc.id).runtime.effects ?? []).length, 1);
  // The DM moves the clock eight hours: now it is over.
  dm.send({ type: "table.clock", minutes: 8 * 60 });
  await tick();
  assert.deepEqual(sheetOf<JournalCharacter>(pc.id).runtime.effects ?? [], [], "the clock ended it");
});

test("table: a spell on a monster starts a timed effect the undo takes back (D157)", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R30 주문", { userId: "dm", displayName: "DM" }), joinCode: "R30BBB" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.05,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R30BBB", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "성직자", classes: "cleric", level: 5 }, { "class.0.spells": ["dnd.srd521.spell.hold-person"], "class.0.prepared": ["dnd.srd521.spell.hold-person"] });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  dm.send({ type: "journal.put", entry: pc });
  const bandit = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.bandit")!);
  dm.send({ type: "journal.put", entry: bandit });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const banditToken = tokenForNpc(bandit);
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: banditToken });
  await tick();
  dm.send({ type: "act.cast", caster: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, spellId: "dnd.srd521.spell.hold-person", targets: [{ entryId: bandit.id, pageId: scene.id, tokenId: banditToken.id }] });
  await tick();
  const held = host.journal.find((entry) => entry.id === bandit.id) as JournalNpc;
  assert.equal((held.runtime.effects ?? []).length, 1, "the monster carries the spell's effect, with its duration");
  assert.ok((held.runtime.effects ?? [])[0].rounds! > 0);
  const card = [...host.archive].reverse().find((message) => message.type === "spell")!;
  dm.send({ type: "act.undo", messageId: card.id });
  await tick();
  assert.deepEqual((host.journal.find((entry) => entry.id === bandit.id) as JournalNpc).runtime.effects ?? [], [], "undoing the cast takes it back off");
});
