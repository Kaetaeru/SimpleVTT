/**
 * R72 (ROLL20_TABLE_SPEC.md D207): Extra Attack is content, and the Attack action is spent on its last attack.
 *
 * The turn panel decided how many attacks an Attack action makes by comparing feature names ("Extra Attack", "Two
 * Extra Attacks"), which missed the fighter's fourth attack at 20 and any feature named otherwise. And the host marked
 * the action spent on the first swing, so a barbarian with Extra Attack looked out of actions with an attack left.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("R72: attacks per Attack action come from the contracts (D207)", () => {
  const attacks = (cls: string, level: number) => build({ classes: cls, level }).derived.attackActionAttacks ?? 1;
  assert.equal(attacks("barbarian", 4), 1, "before Extra Attack");
  assert.equal(attacks("barbarian", 5), 2);
  assert.equal(attacks("paladin", 5), 2);
  assert.equal(attacks("fighter", 11), 3);
  assert.equal(attacks("fighter", 20), 4, "the fourth attack the name comparison never knew");
  assert.equal(attacks("wizard", 20), 1);
});

test("R72: the Attack action is spent on its last attack, and a new turn starts the count again (D207)", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R72 시험", { userId: "dm", displayName: "DM" }), joinCode: "R72AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcAttackActionAttacks: (entry) => derivedOf(entry, catalog()).attackActionAttacks ?? 1,
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R72AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "바바리안", classes: "barbarian", level: 5 });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: pc });
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "바바리안", tokenId: pcToken.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.add", turn: { name: "오우거", tokenId: ogreToken.id, pageId: scene.id, entryId: ogre.id, initiative: 1 } });
  await tick();
  dm.send({ type: "tracker.next" });
  await tick();
  const me = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  const weapon = made.derived.attacks.find((attack) => attack.itemId)!;
  const myTurn = () => host.tracker.turns.find((turn) => turn.tokenId === pcToken.id)!;
  assert.equal(host.tracker.turns[host.tracker.current]?.tokenId, pcToken.id, `the barbarian acts first: ${JSON.stringify(host.tracker)}`);

  dm.send({ type: "act.attack", attacker: me, targets: [{ pageId: scene.id, tokenId: ogreToken.id }], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "miss" } });
  await tick();
  assert.equal(myTurn().attacksMade, 1);
  assert.notEqual(myTurn().actionUsed, true, "one attack of two: the action is still in hand");
  dm.send({ type: "act.attack", attacker: me, targets: [{ pageId: scene.id, tokenId: ogreToken.id }], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "miss" } });
  await tick();
  assert.equal(myTurn().attacksMade, 2);
  assert.equal(myTurn().actionUsed, true, "the second attack spends it");

  dm.send({ type: "tracker.next" });
  dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(host.tracker.turns[host.tracker.current].tokenId, pcToken.id, "round two, the barbarian again");
  assert.equal(myTurn().attacksMade, 0, "the count starts over");
  assert.notEqual(myTurn().actionUsed, true);
});
