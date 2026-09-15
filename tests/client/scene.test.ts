/**
 * Theatre of the Mind (ROLL20_TABLE_SPEC.md D95–D96): scene pages carry no positions, so the host never decides
 * range; players may declare 유리/불리 but cover and forced outcomes ("반드시 적중/치명타/빗나감") are the DM's,
 * before the roll or with the palette; the 벗어남 button posts an opportunity prompt that the reactor's controller
 * answers with a melee attack (the reaction, tracked on the tracker row until their next turn) or declines.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign, repairCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 6) => { for (let index = 0; index < times; index += 1) await settle(); };

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("장면 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  // A constant die: every d20 is 11, every d6 is 4 — hits land (11 + 5 vs AC 15) without a crit.
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined), pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey, pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  const scene = newScene(campaign.id, "여관", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const { source, derived } = build({ name: "앨리스의 파이터", classes: "fighter", level: 3 });
  const pc = newJournalCharacter(campaign.id, "alice", source, initialRuntime(derived));
  alice.send({ type: "journal.put", entry: pc });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  dm.send({ type: "journal.put", entry: goblin });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const goblinToken = tokenForNpc(goblin);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  await tick();
  const sword = derived.attacks.find((attack) => attack.name === "대검")!;
  const pcRef = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  const goblinRef = { entryId: goblin.id, pageId: scene.id, tokenId: goblinToken.id };
  const lastAction = (client: TableClient) => [...client.snapshot!.chat].reverse().find((message) => message.type === "action")!;
  return { host, dm, alice, scene, pc, goblin, pcToken, goblinToken, sword, pcRef, goblinRef, lastAction };
}

test("scenes: the table is always Theatre of the Mind; nothing is decided by range; players declare 유리/불리 only; the DM forces outcomes before the roll", async () => {
  const { dm, alice, sword, pcRef, goblinRef, lastAction } = await table();
  // There are no positions at all: reach and range are never the host's business.
  alice.send({ type: "act.attack", attacker: pcRef, targets: [goblinRef], attack: { source: "weapon", attackId: sword.id }, overrides: { advantage: "advantage", outcome: "crit", cover: 5 } });
  await tick();
  const card = lastAction(dm);
  assert.equal(card.action!.outcome, "hit", "a player's 반드시 치명타 is ignored");
  assert.equal(card.action!.cover, 0, "a player's cover is ignored");
  assert.deepEqual([card.action!.advantage, card.action!.d20s.length], ["advantage", 2], "a player's declared advantage is honoured");
  assert.ok(!card.action!.reasons.some((reason) => reason.includes("사거리")), "no range reasons on a scene");
  // The DM's pre-roll choices apply: 반드시 빗나감, 반드시 치명타, cover.
  dm.send({ type: "act.attack", attacker: goblinRef, targets: [pcRef], attack: { source: "npc", actionName: "시미터" }, overrides: { outcome: "miss" } });
  await tick();
  assert.equal(lastAction(alice).action!.outcome, "miss");
  dm.send({ type: "act.attack", attacker: goblinRef, targets: [pcRef], attack: { source: "npc", actionName: "시미터" }, overrides: { outcome: "crit", cover: 2 } });
  await tick();
  const crit = lastAction(alice);
  assert.deepEqual([crit.action!.outcome, crit.action!.cover, crit.action!.damage[0].dice.length], ["crit", 2, 2], "forced crit doubles the dice; cover shows on the card");
});

test("벗어남: the prompt reaches everyone; the reactor's controller attacks as a reaction (once until their turn) or declines; outsiders are refused", async () => {
  const { host, dm, alice, scene, pcToken, goblinToken, pcRef, goblinRef, lastAction } = await table();
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 1, sorted: true, turns: [newTurn({ name: "고블린 전사", initiative: 20, tokenId: goblinToken.id, pageId: scene.id, entryId: goblinRef.entryId }), newTurn({ name: "앨리스의 파이터", initiative: 10, tokenId: pcToken.id, pageId: scene.id, entryId: pcRef.entryId })] } });
  await tick();
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  // A player can only move their own character away.
  alice.send({ type: "act.provoke", mover: goblinRef, from: pcRef });
  await tick();
  assert.equal(refusals.length, 1);
  alice.send({ type: "act.provoke", mover: pcRef, from: goblinRef });
  await tick();
  const prompt = [...alice.snapshot!.chat].reverse().find((message) => message.type === "prompt")!;
  assert.ok(prompt && dm.snapshot!.chat.some((message) => message.id === prompt.id), "the prompt is a chat message on both sides");
  assert.deepEqual([prompt.prompt!.kind, prompt.prompt!.mover.name, prompt.prompt!.reactor.name, prompt.prompt!.outcome], ["opportunity", "앨리스의 파이터", "고블린 전사", undefined]);
  // The mover cannot answer for the goblin.
  alice.send({ type: "act.attack", attacker: goblinRef, targets: [pcRef], attack: { source: "npc", actionName: "시미터" }, reaction: prompt.id });
  alice.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  assert.equal(refusals.length, 3);
  // A ranged weapon is not an opportunity attack.
  const dmRefusals: string[] = [];
  dm.onRefused((reason) => dmRefusals.push(reason));
  dm.send({ type: "act.attack", attacker: goblinRef, targets: [pcRef], attack: { source: "npc", actionName: "단궁" }, reaction: prompt.id });
  await tick();
  assert.equal(dmRefusals.length, 1);
  // The DM takes the opportunity attack: a card named 기회 공격, the prompt resolved, the goblin's reaction spent.
  dm.send({ type: "act.attack", attacker: goblinRef, targets: [pcRef], attack: { source: "npc", actionName: "시미터" }, reaction: prompt.id });
  await tick();
  const card = lastAction(alice);
  assert.ok(card.action!.attack.name.includes("기회 공격"));
  assert.equal(card.action!.target.name, "앨리스의 파이터");
  const answered = alice.snapshot!.chat.find((message) => message.supersedes === prompt.id)!;
  assert.equal(answered.prompt!.outcome?.attacked, card.id);
  assert.equal(host.state.tracker!.turns[0].reactionUsed, true);
  // A second 벗어남 this round: the reaction is spent, so the goblin can only decline.
  alice.send({ type: "act.provoke", mover: pcRef, from: goblinRef });
  await tick();
  const second = [...alice.snapshot!.chat].reverse().find((message) => message.type === "prompt" && !message.supersedes)!;
  dm.send({ type: "act.attack", attacker: goblinRef, targets: [pcRef], attack: { source: "npc", actionName: "시미터" }, reaction: second.id });
  await tick();
  assert.equal(dmRefusals.length, 2, "no second reaction this round");
  dm.send({ type: "act.decline", messageId: second.id });
  await tick();
  assert.equal(alice.snapshot!.chat.find((message) => message.supersedes === second.id)!.prompt!.outcome?.declined, true);
  dm.send({ type: "act.decline", messageId: second.id });
  await tick();
  assert.equal(dmRefusals.length, 3, "an answered prompt cannot be answered again");
  // 다음 턴 wraps to the goblin's turn: its reaction comes back.
  dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(host.state.tracker!.current, 0);
  assert.equal(host.state.tracker!.turns[0].reactionUsed, false);
});
