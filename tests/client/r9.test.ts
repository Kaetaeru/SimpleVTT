/**
 * R9 combat leftovers (ROLL20_TABLE_SPEC.md D103/D104): an NPC's save action (a breath weapon) resolves like a save
 * spell and spends its recharge; legendary actions come out of the per-round pool; a readied action (준비) goes off
 * out of turn as the reaction and is spent.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, npcSaveExec, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("npcSaveExec: a breath weapon becomes a save-damage execution with the block's DC; a sleep breath a save-effect with its condition", () => {
  const dragon = newJournalNpc("c", "dm", monsterById("dnd.srd521.monster.adult-brass-dragon")!);
  const fire = npcSaveExec(dragon, "화염 브레스")!;
  assert.equal(fire.spec.name, "화염 브레스");
  assert.equal(fire.casterStats.saveDc, 18);
  assert.equal(fire.spec.exec.primary.kind, "save-damage");
  const primary = fire.spec.exec.primary as { saveAbility: string; dice: { count: number; sides: number }; successDamage: string };
  assert.deepEqual([primary.saveAbility, primary.dice.count, primary.dice.sides, primary.successDamage], ["dex", 10, 8, "half"]);
  assert.ok(fire.action.timing?.recharge, "the breath recharges");
  const sleep = npcSaveExec(dragon, "수면 브레스")!;
  assert.equal(sleep.spec.exec.primary.kind, "save-effect");
  assert.deepEqual(sleep.spec.exec.effects?.map((effect) => effect.conditionId), ["incapacitated"]);
  assert.equal(npcSaveExec(dragon, "찢기"), null, "an attack is not a save action");
});

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R9 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  // Every d20 is 11, every d8 5.
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined), pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey, pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders), pcStats: (entry) => pcStats(derivedOf(entry, catalog())), pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  const scene = newScene(campaign.id, "동굴", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const { source, derived } = build({ name: "앨리스의 파이터", classes: "fighter", level: 3 });
  const pc = newJournalCharacter(campaign.id, "alice", source, initialRuntime(derived));
  alice.send({ type: "journal.put", entry: pc });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  const dragon = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.adult-brass-dragon")!);
  dm.send({ type: "journal.put", entry: goblin });
  dm.send({ type: "journal.put", entry: dragon });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const goblinToken = tokenForNpc(goblin);
  const dragonToken = tokenForNpc(dragon);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  dm.send({ type: "token.put", pageId: scene.id, token: dragonToken });
  await tick();
  const pcRef = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  const goblinRef = { entryId: goblin.id, pageId: scene.id, tokenId: goblinToken.id };
  const dragonRef = { entryId: dragon.id, pageId: scene.id, tokenId: dragonToken.id };
  // Dragon, goblin, then the fighter; current = the fighter's turn.
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 2, sorted: true, turns: [newTurn({ name: "성인 황동 드래곤", initiative: 22, tokenId: dragonToken.id, pageId: scene.id, entryId: dragon.id }), newTurn({ name: "고블린 전사", initiative: 15, tokenId: goblinToken.id, pageId: scene.id, entryId: goblin.id }), newTurn({ name: "앨리스의 파이터", initiative: 10, tokenId: pcToken.id, pageId: scene.id, entryId: pc.id })] } });
  await tick();
  const sword = derived.attacks.find((attack) => attack.name === "대검")!;
  const markersOf = (tokenId: string) => host.pageList[0].tokens.find((token) => token.id === tokenId)!.markers.map((marker) => marker.name);
  const last = (client: TableClient, type: string) => [...client.snapshot!.chat].reverse().find((message) => message.type === type)!;
  const npcOf = (id: string) => { const entry = dm.snapshot!.journal.find((item) => item.id === id); return entry?.kind === "npc" ? entry : undefined; };
  return { host, dm, alice, scene, pc, goblin, dragon, pcToken, goblinToken, dragonToken, pcRef, goblinRef, dragonRef, sword, markersOf, last, npcOf };
}

test("host: the dragon's fire breath rolls every target's save against DC 18, halves on a success, spends the recharge; undo gives it back", async () => {
  const { dm, alice, goblin, dragon, pcRef, goblinRef, dragonRef, last, npcOf } = await table();
  dm.send({ type: "act.npcSave", actor: dragonRef, actionName: "화염 브레스", targets: [pcRef, goblinRef] });
  await tick();
  const card = last(alice, "spell");
  assert.ok(card, "a card for the breath");
  const spell = card.spell!;
  assert.deepEqual([spell.source, spell.name, spell.targets.length], ["action", "화염 브레스", 2]);
  for (const row of spell.targets) { assert.equal(row.save!.dc, 18); assert.equal(row.save!.d20, 11); assert.equal(row.damage!.damage[0].dice.length, 10); }
  // The goblin (DEX save +2 → 13) fails: full 10d8 of 5s = 50 ≥ its 10 HP → dead.
  const goblinRow = spell.targets.find((row) => row.target.id === goblin.id)!;
  assert.deepEqual([goblinRow.save!.success, goblinRow.damage!.damageTotal, goblinRow.hpAfter, goblinRow.damage!.downed], [false, 50, 0, "dead"]);
  assert.equal(npcOf(dragon.id)!.runtime.spent["화염 브레스"], true, "the breath waits for its recharge");
  dm.send({ type: "act.npcSave", actor: dragonRef, actionName: "화염 브레스", targets: [pcRef] });
  await tick();
  assert.ok(last(dm, "system")?.content.includes("재충전") || [...dm.snapshot!.chat].filter((message) => message.type === "spell").length === 1, "a second breath is refused while it recharges");
  dm.send({ type: "act.undo", messageId: card.id });
  await tick();
  assert.equal(npcOf(dragon.id)!.runtime.spent["화염 브레스"], false, "undo restores the recharge");
  assert.equal(npcOf(goblin.id)!.runtime.hp.current, 10, "undo restores the goblin");
  // A player cannot run the DM's dragon.
  alice.send({ type: "act.npcSave", actor: dragonRef, actionName: "화염 브레스", targets: [goblinRef] });
  await tick();
  assert.equal([...alice.snapshot!.chat].filter((message) => message.type === "spell" && !message.undone).length, 1, "the undone card is re-said as undone; no new breath by the player");
});

test("host: legendary actions come out of the per-round pool — a text action is a card, a save action rolls targets, the fourth is refused, the pool resets on the dragon's turn", async () => {
  const { dm, alice, dragon, goblinRef, dragonRef, last, npcOf } = await table();
  dm.send({ type: "act.legendary", actor: dragonRef, name: "급습" });
  await tick();
  assert.deepEqual([last(alice, "act").act!.kind, last(alice, "act").act!.name, npcOf(dragon.id)!.runtime.legendaryUsed], ["legendary", "전설 행동 · 급습", 1]);
  assert.ok(last(alice, "act").act!.text.includes("1/3"));
  dm.send({ type: "act.legendary", actor: dragonRef, name: "작열하는 모래", targets: [goblinRef] });
  await tick();
  const sand = last(alice, "spell").spell!;
  assert.ok(sand.name.startsWith("작열하는 모래") && sand.name.includes("전설 행동 2/3") && sand.source === "action");
  assert.equal(sand.targets[0].save!.dc, dragon.statBlock.legendaryActions.find((action) => action.name === "작열하는 모래")!.save!.dc);
  assert.equal(npcOf(dragon.id)!.runtime.legendaryUsed, 2);
  dm.send({ type: "act.legendary", actor: dragonRef, name: "타오르는 빛" });
  await tick();
  assert.equal(npcOf(dragon.id)!.runtime.legendaryUsed, 3);
  dm.send({ type: "act.legendary", actor: dragonRef, name: "급습" });
  await tick();
  assert.equal(npcOf(dragon.id)!.runtime.legendaryUsed, 3, "no fourth legendary action this round");
  assert.equal([...dm.snapshot!.chat].filter((message) => message.type === "act").length, 2);
  // Fighter's turn ends → dragon's turn starts: the pool comes back.
  dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(npcOf(dragon.id)!.runtime.legendaryUsed, 0);
});

test("host: a readied action goes off out of turn as the reaction — the card says so, 준비 and the reaction are spent, a second one is refused", async () => {
  const { host, dm, alice, pcToken, pcRef, goblinRef, sword, markersOf, last } = await table();
  alice.send({ type: "act.action", actor: pcRef, kind: "ready", note: "고블린이 다가오면 → 대검" });
  await tick();
  assert.ok(markersOf(pcToken.id).includes("준비"));
  // Without the mark nothing is readied: the goblin cannot claim a readied attack.
  dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(host.state.tracker!.turns[host.state.tracker!.current].name, "성인 황동 드래곤");
  alice.send({ type: "act.attack", attacker: pcRef, targets: [goblinRef], attack: { source: "weapon", attackId: sword.id }, readied: true });
  await tick();
  const card = last(dm, "action");
  assert.ok(card.action!.attack.name.endsWith("· 준비한 행동"), `the card carries the readied tag: ${card.action!.attack.name}`);
  const fighterRow = host.state.tracker!.turns.find((turn) => turn.tokenId === pcToken.id)!;
  assert.equal(fighterRow.reactionUsed, true);
  assert.ok(!markersOf(pcToken.id).includes("준비"), "the mark is spent");
  alice.send({ type: "act.attack", attacker: pcRef, targets: [goblinRef], attack: { source: "weapon", attackId: sword.id }, readied: true });
  await tick();
  assert.equal([...dm.snapshot!.chat].filter((message) => message.type === "action").length, 1, "no readied action left");
  // A plain out-of-turn attack by a player is still refused (the readied path was the only door).
  alice.send({ type: "act.attack", attacker: pcRef, targets: [goblinRef], attack: { source: "weapon", attackId: sword.id } });
  await tick();
  assert.equal([...dm.snapshot!.chat].filter((message) => message.type === "action").length, 1);
});
