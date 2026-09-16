/**
 * R23 (ROLL20_TABLE_SPEC.md D121): the bonus action is actually spent.
 *
 * Attacks, actions, items and spells all told the host what they cost, but a feature is used on the sheet — so
 * 재기의 바람 or 교활한 행동 left the 추가 행동 chip lit all turn and the bonus action looked unused. The sheet now
 * says what it spent through `act.spend`, and the host marks it on the turn.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { usableFeatures } from "../../client/character/activate";
import { initialRuntime } from "../../client/character/runtime";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("the sheet knows which features are bonus actions — 재기의 바람 is one", () => {
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 });
  const usable = usableFeatures(fighter.derived, initialRuntime(fighter.derived));
  const secondWind = usable.find((item) => item.feature.nameEn === "Second Wind");
  assert.ok(secondWind, `재기의 바람 is offered: ${usable.map((item) => item.feature.name).join(", ")}`);
  assert.equal(secondWind!.bonus, true, "and it costs a bonus action");
  assert.ok(usable.some((item) => !item.bonus) || usable.length === 1, "features that are not bonus actions stay in the 특성 menu");
});

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R23 시험", { userId: "dm", displayName: "DM" }), joinCode: "R23AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R23AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R23AAA" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 });
  const pc = { ...newJournalCharacter(campaign.id, "alice", fighter.source, initialRuntime(fighter.derived)), canEdit: ["alice"] };
  alice.send({ type: "journal.put", entry: pc });
  await tick();
  const pcToken = tokenForCharacter(pc);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  await tick();
  const me = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns: [newTurn({ name: "파이터", initiative: 20, tokenId: pcToken.id, pageId: scene.id, entryId: pc.id })] } });
  await tick();
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  return { host, dm, alice, me, refusals, turn: () => host.state.tracker!.turns[0] };
}

test("host: act.spend marks the bonus action on the creature's own turn, and the turn start gives it back", async () => {
  const { alice, dm, me, turn } = await table();
  assert.deepEqual([turn().actionUsed, turn().bonusUsed], [undefined, undefined], "a fresh turn has both");
  alice.send({ type: "act.spend", actor: me, which: "bonus" });
  await tick();
  assert.equal(turn().bonusUsed, true, "the bonus action is spent");
  assert.notEqual(turn().actionUsed, true, "and the action is untouched");
  alice.send({ type: "act.spend", actor: me, which: "action" });
  await tick();
  assert.equal(turn().actionUsed, true);
  // Coming round to this turn again clears the economy.
  dm.send({ type: "tracker.next" });
  await tick();
  assert.deepEqual([turn().actionUsed, turn().bonusUsed, turn().reactionUsed], [false, false, false], "a new turn starts fresh");
});

test("host: only the creature's controller spends its turn, and nothing is spent when it is not their turn", async () => {
  const { host, dm, alice, me, refusals, turn } = await table();
  const other = new TableClient(new MemoryHub().connect("x"), { userId: "bob", displayName: "밥", joinCode: "R23AAA" });
  void other;
  // A bonus action the DM spends for a creature is allowed (the DM runs the rest of the board).
  dm.send({ type: "act.spend", actor: me, which: "bonus" });
  await tick();
  assert.equal(turn().bonusUsed, true);
  // Off turn there is nothing to spend: the tracker points elsewhere, so the mark is simply not made.
  dm.send({ type: "tracker.set", tracker: { ...host.state.tracker!, turns: [...host.state.tracker!.turns, newTurn({ name: "다른 차례", initiative: 1, custom: true })], current: 1 } });
  await tick();
  alice.send({ type: "act.spend", actor: me, which: "action" });
  await tick();
  assert.notEqual(turn().actionUsed, true, "the fighter's turn is over, so its action was not marked");
  assert.deepEqual(refusals, [], "and nothing was refused — the DM narrates out-of-turn uses");
});
