/**
 * The official actions on a turn (ROLL20_TABLE_SPEC.md D97): the pure rules table (checks, unarmed-strike DC,
 * marks), then the host — a player's own turn only, 회피 turns the next attack against them to disadvantage,
 * 이탈 skips the 벗어남 prompt, 원조 gives the ally advantage once, 은신 rolls a stealth check, 붙잡기 makes the
 * target save, the action economy is noted and reset, turn-scoped marks fall off, and 턴 마침 passes the turn.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { ACTIONS, describeAct, npcStats, pcStats, resolveAction, skillBonus, unarmedDc, type ActorStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const tick = async (times = 6) => { for (let index = 0; index < times; index += 1) await settle(); };
const stats = (over: Partial<ActorStats> = {}): ActorStats => ({ abilities: { str: 3, dex: 1, con: 2, int: 0, wis: 0, cha: -1 }, saves: { str: 5, dex: 1, con: 4, int: 0, wis: 0, cha: -1 }, skills: { athletics: 5, stealth: 3 }, proficiencyBonus: 2, ...over });
const scripted = (...values: number[]) => { let at = 0; return () => (values[at++ % values.length] - 1) / 20; };

test("rules table: every official action resolves; grapple DC = 8 + STR + PB and the target takes its better save; checks show the die", () => {
  const goblin = npcStats(monsterById("dnd.srd521.monster.goblin-warrior")!);
  assert.deepEqual([goblin.abilities.dex, goblin.saves.dex, goblin.skills.stealth, goblin.proficiencyBonus], [2, 2, 6, 2]);
  const { derived } = build({ name: "x", classes: "fighter", level: 3 });
  const fighter = pcStats(derived);
  assert.equal(unarmedDc(fighter), 8 + derived.abilities.str.modifier + derived.proficiencyBonus);
  assert.equal(skillBonus(goblin, "arcana"), 0, "an unlisted skill is the ability modifier");
  const me = { name: "나", stats: stats(), conditions: [] };
  const foe = { name: "적", stats: goblin, conditions: [] };
  for (const def of ACTIONS) {
    const result = resolveAction({ kind: def.kind, actor: me, target: def.target ? foe : undefined, random: scripted(10) });
    assert.equal(result.name, def.name);
    assert.ok(result.text.length > 0 && describeAct(result).includes(def.name));
  }
  // Grapple: DC 13; the goblin's better save is DEX +2; a 10 fails → 붙잡힘.
  const grapple = resolveAction({ kind: "grapple", actor: me, target: foe, random: scripted(10) });
  assert.deepEqual([grapple.check!.dc, grapple.check!.label, grapple.check!.total, grapple.check!.success, grapple.targetMarks], [13, "적 · 민첩 내성", 12, false, ["붙잡힘"]]);
  const held = resolveAction({ kind: "grapple", actor: me, target: foe, random: scripted(20) });
  assert.deepEqual([held.check!.success, held.targetMarks], [true, []]);
  // Shove: prone or push.
  assert.deepEqual(resolveAction({ kind: "shove", actor: me, target: foe, choice: "prone", random: scripted(2) }).targetMarks, ["넘어짐"]);
  assert.deepEqual(resolveAction({ kind: "shove", actor: me, target: foe, choice: "push", random: scripted(2) }).targetMarks, []);
  // Escape uses the better of athletics/acrobatics against the grappler's DC.
  const escape = resolveAction({ kind: "escape", actor: me, target: { name: "적", stats: stats({ abilities: { ...stats().abilities, str: 4 } }), conditions: [] }, random: scripted(9) });
  assert.deepEqual([escape.check!.dc, escape.check!.bonus, escape.check!.success, escape.actorUnmarks], [14, 5, true, ["붙잡힘"]]);
  // Hide vs DC 15 with the die shown; influence lets the actor pick a listed skill.
  const hide = resolveAction({ kind: "hide", actor: me, random: scripted(12) });
  assert.deepEqual([hide.check!.d20, hide.check!.total, hide.check!.success, hide.actorMarks], [12, 15, true, ["은신"]]);
  const influence = resolveAction({ kind: "influence", actor: me, skill: "intimidation", random: scripted(5) });
  assert.ok(influence.check!.label.includes("위협") && influence.check!.success === false);
  assert.deepEqual([resolveAction({ kind: "dodge", actor: me, random: scripted(1) }).actorMarks, resolveAction({ kind: "disengage", actor: me, random: scripted(1) }).actorMarks, resolveAction({ kind: "help", actor: me, target: foe, random: scripted(1) }).targetMarks], [["회피"], ["이탈"], ["도움"]]);
});

async function table(random: () => number) {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("턴 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random, attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined), pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey, pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders), pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
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
  const pcToken = tokenForCharacter(pc, { x: 0, y: 0 });
  const goblinToken = tokenForNpc(goblin, { x: 2, y: 0 });
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  await tick();
  const pcRef = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  const goblinRef = { entryId: goblin.id, pageId: scene.id, tokenId: goblinToken.id };
  // Goblin first, then the fighter; current = the fighter's turn.
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 1, sorted: true, turns: [newTurn({ name: "고블린 전사", initiative: 20, tokenId: goblinToken.id, pageId: scene.id, entryId: goblin.id }), newTurn({ name: "앨리스의 파이터", initiative: 10, tokenId: pcToken.id, pageId: scene.id, entryId: pc.id })] } });
  await tick();
  const sword = derived.attacks.find((attack) => attack.name === "대검")!;
  const markersOf = (tokenId: string) => host.pageList[0].tokens.find((token) => token.id === tokenId)!.markers.map((marker) => marker.name);
  const lastAct = (client: TableClient) => [...client.snapshot!.chat].reverse().find((message) => message.type === "act")!;
  const lastAction = (client: TableClient) => [...client.snapshot!.chat].reverse().find((message) => message.type === "action")!;
  return { host, dm, alice, scene, pc, goblin, pcToken, goblinToken, pcRef, goblinRef, sword, markersOf, lastAct, lastAction };
}

test("host: your own turn only; 회피 → disadvantage against you; 이탈 skips the prompt; 원조 once; 은신 check; economy and marks reset with the turns; 턴 마침", async () => {
  const { host, dm, alice, pcToken, goblinToken, pcRef, goblinRef, sword, markersOf, lastAct, lastAction } = await table(() => 0.5);
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  // The goblin is not alice's; the DM acts for it only on its turn (the DM may act any time).
  alice.send({ type: "act.action", actor: goblinRef, kind: "dodge" });
  await tick();
  assert.equal(refusals.length, 1);
  // 회피 on the fighter's turn: marked on the token, the action noted, and the goblin's next attack is at disadvantage.
  alice.send({ type: "act.action", actor: pcRef, kind: "dodge" });
  await tick();
  assert.deepEqual([lastAct(dm).act!.kind, markersOf(pcToken.id), host.state.tracker!.turns[1].actionUsed], ["dodge", ["회피"], true]);
  dm.send({ type: "act.attack", attacker: goblinRef, targets: [pcRef], attack: { source: "npc", actionName: "시미터" } });
  await tick();
  assert.deepEqual([lastAction(alice).action!.advantage, lastAction(alice).action!.reasons], ["disadvantage", ["대상 회피"]]);
  // 이탈: the 벗어남 prompt is replaced by a note.
  alice.send({ type: "act.action", actor: pcRef, kind: "disengage" });
  alice.send({ type: "act.provoke", mover: pcRef, from: goblinRef });
  await tick();
  assert.ok(markersOf(pcToken.id).includes("이탈"));
  assert.equal(alice.snapshot!.chat.filter((message) => message.type === "prompt").length, 0, "no opportunity prompt while 이탈");
  assert.ok(alice.snapshot!.chat.some((message) => message.type === "system" && message.content.includes("기회 공격 없이")));
  // 은신 (stealth +? vs DC 15 with a constant 11) and 준비 leave marks; a check card carries the die.
  alice.send({ type: "act.action", actor: pcRef, kind: "hide" });
  await tick();
  const hide = lastAct(alice).act!;
  assert.equal(hide.check!.d20, 11);
  assert.equal(markersOf(pcToken.id).includes("은신"), hide.check!.success);
  alice.send({ type: "act.action", actor: pcRef, kind: "ready", note: "문이 열리면 → 공격" });
  await tick();
  assert.ok(lastAct(dm).act!.text.includes("문이 열리면") && markersOf(pcToken.id).includes("준비"));
  // 턴 마침 by the player: 이탈 falls off at the turn's end; the goblin's turn starts with its economy fresh.
  alice.send({ type: "tracker.next" });
  await tick();
  assert.equal(host.state.tracker!.current, 0);
  assert.ok(!markersOf(pcToken.id).includes("이탈") && markersOf(pcToken.id).includes("회피"), "회피 lasts until the fighter's next turn");
  assert.deepEqual([host.state.tracker!.turns[0].actionUsed, host.state.tracker!.turns[0].reactionUsed], [false, false]);
  // Not alice's turn now.
  alice.send({ type: "act.action", actor: pcRef, kind: "dash" });
  await tick();
  assert.equal(refusals.length, 2);
  // The DM's goblin helps (원조) the fighter — a target is needed — then the fighter's attack has advantage once.
  dm.send({ type: "act.action", actor: goblinRef, kind: "help", target: pcRef });
  await tick();
  assert.ok(markersOf(pcToken.id).includes("도움"));
  dm.send({ type: "tracker.next" });
  await tick();
  assert.ok(!markersOf(pcToken.id).includes("회피"), "회피 ended at the fighter's turn start");
  alice.send({ type: "act.attack", attacker: pcRef, targets: [goblinRef], attack: { source: "weapon", attackId: sword.id } });
  await tick();
  assert.equal(lastAction(dm).action!.advantage, "advantage");
  assert.ok(!markersOf(pcToken.id).includes("도움") && !markersOf(pcToken.id).includes("은신"), "attacking spends 도움 and ends 은신");
  assert.equal(host.state.tracker!.turns[1].actionUsed, true);
  // Grapple: the goblin (DEX save +2 vs DC 13 with an 11 → 13 succeeds? 11 + 2 = 13 ≥ 13) holds; a lower die fails.
  alice.send({ type: "act.action", actor: pcRef, kind: "grapple", target: goblinRef });
  await tick();
  const grapple = lastAct(dm).act!;
  assert.deepEqual([grapple.check!.dc, grapple.check!.success], [8 + 3 + 2, true]);
  assert.ok(!markersOf(goblinToken.id).includes("붙잡힘"));
});

test("host: a failed save marks the target — 붙잡힘 on the goblin's token, 넘어짐 on the fighter's sheet; 벗어나기 clears it; DM may set a DC", async () => {
  const { host, dm, alice, pcToken, goblinToken, pcRef, goblinRef, markersOf, lastAct } = await table(scripted(3, 3, 3, 3, 3, 3, 3, 3, 20));
  alice.send({ type: "act.action", actor: pcRef, kind: "grapple", target: goblinRef });
  await tick();
  assert.deepEqual([lastAct(dm).act!.check!.success, markersOf(goblinToken.id)], [false, ["붙잡힘"]]);
  dm.send({ type: "act.action", actor: goblinRef, kind: "shove", target: pcRef, choice: "prone" });
  await tick();
  const sheet = host.journal.find((entry) => entry.id === pcRef.entryId);
  assert.ok(sheet?.kind === "character" && sheet.runtime.conditions.includes("넘어짐"), "a real condition lands on the PC sheet (D84 mirrors it to the token)");
  // The goblin escapes (DM sets DC 5 so a 3 + 6 passes) — the mark comes off.
  dm.send({ type: "act.action", actor: goblinRef, kind: "escape", target: pcRef, dc: 5 });
  await tick();
  assert.deepEqual([lastAct(alice).act!.check!.dc, lastAct(alice).act!.check!.success, markersOf(goblinToken.id)], [5, true, []]);
  // A player cannot set the DC: it is ignored.
  alice.send({ type: "act.action", actor: pcRef, kind: "hide", dc: 1 });
  await tick();
  assert.equal(lastAct(dm).act!.check!.dc, 15);
  assert.equal(markersOf(pcToken.id).includes("은신"), lastAct(dm).act!.check!.success);
});
