/**
 * R42 (ROLL20_TABLE_SPEC.md D182): the table-level entry point.
 *
 * Eleven operation kinds computed their value and had nowhere to put it: a condition belongs on somebody else's
 * token, a summoned creature belongs on the board, and a DM question belongs in the log. `act.contract` is that
 * place. With it every kind the grammar defines reaches the table.
 *
 * The slot count is retired here, and the reason is worth keeping: nine of the ten interceptor slots have no
 * contract asking for them, and the one that does (예리한 언변's `primary.damage`) is blocked on facts a scene
 * without positions cannot answer. Opening them would be speculation, and a plan that counts speculation lies.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { APPLIED_OPERATIONS, COMPUTED_OPERATIONS, parseContract } from "../../client/rules/contract";
import { tableOutcome } from "../../client/rules/contractTable";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("table: every operation kind the grammar defines now reaches the table (D182)", () => {
  assert.equal(COMPUTED_OPERATIONS.length, 27);
  assert.equal(APPLIED_OPERATIONS.length, 27);
  assert.deepEqual([...COMPUTED_OPERATIONS].sort(), [...APPLIED_OPERATIONS].sort());
});

test("table: a contract's table half is what the sheet cannot answer alone (D182)", () => {
  const cat = catalog();
  const derived = build({ name: "b", classes: "barbarian", level: 11 }).derived;
  // 불굴의 격노 stabilises (a sheet answer) and asks the DM for the save DC (a table answer).
  const relentless = tableOutcome(derived, cat, "barbarian.relentless-rage")!;
  assert.ok(relentless.notes.some((note) => note.includes("건강 내성 DC 10")), JSON.stringify(relentless));
  assert.equal(relentless.deathSave, false);
  // 자기 회복 is entirely a sheet answer, so the table is asked for nothing.
  assert.equal(tableOutcome(build({ name: "m", classes: "monk", level: 14 }).derived, cat, "monk.self-restoration"), null);
  assert.equal(tableOutcome(derived, cat, "없는.특성"), null);
});

test("table: act.contract puts the conditions on the target and the summons on the board (D182)", async () => {
  const hub = new MemoryHub();
  const base = newCampaign("R42 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R42AAA" };
  const cat = catalog();
  // A made-up feature contract, so the test covers the operations rather than one SRD feature's wording.
  const contract = parseContract({
    id: "feature:test.table", schemaVersion: "0.2-draft",
    entryPoints: [{ id: "use", invocation: "manual", operations: [
      { kind: "condition.apply", condition: "공포", target: "target" },
      { kind: "artifact.spawn", template: { monsterId: "dnd.srd521.monster.wolf", count: 2 } },
      { kind: "adjudication.request", question: "30피트 안의 적만" },
    ] }],
  }, "test");
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, cat)),
    pcContractOutcome: (entry, ruleKey) => (ruleKey === "test.table" ? {
      label: "시험 특성", conditionsApplied: ["공포"], conditionsRemoved: [], deathSave: false,
      notes: ["30피트 안의 적만"], artifacts: [{ kind: "artifact.spawn", monsterId: "dnd.srd521.monster.wolf", count: 2 }], party: { grants: [] },
    } : null) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R42AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R42AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "전사", classes: "fighter", level: 5 });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived), { owner: "alice" });
  const foe = newJournalCharacter(campaign.id, "dm", build({ name: "적", classes: "rogue", level: 3 }).source, initialRuntime(build({ name: "적", classes: "rogue", level: 3 }).derived), { owner: "dm" });
  alice.send({ type: "journal.put", entry: pc });
  dm.send({ type: "journal.put", entry: foe });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const foeToken = tokenForCharacter(foe);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: foeToken });
  await tick();
  const before = host.journal.length;
  alice.send({ type: "act.contract", actor: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, ruleKey: "test.table", targets: [{ entryId: foe.id, pageId: scene.id, tokenId: foeToken.id }] });
  await tick();
  // The condition landed on the target's sheet, two wolves are on the board, and the DM's question is in the log.
  assert.ok(((host.journal.find((entry) => entry.id === foe.id) as JournalCharacter).runtime.conditions ?? []).includes("공포"));
  const summoned = host.journal.filter((entry) => entry.kind === "npc" && entry.summonedBy?.entryId === pc.id);
  assert.equal(summoned.length, 2, host.journal.map((entry) => entry.name).join(","));
  assert.equal(host.journal.length, before + 2);
  const card = [...host.archive].reverse().find((message) => message.type === "act")!;
  assert.ok(card.content.includes("시험 특성"), card.content);
  assert.ok(card.content.includes("30피트 안의 적만"), card.content);
  assert.ok(card.content.includes("소환"), card.content);
  // Somebody else's feature is not theirs to run.
  const refusals: string[] = [];
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "R42AAA", seat: "b" });
  bob.onRefused((reason) => refusals.push(reason));
  await tick();
  bob.send({ type: "act.contract", actor: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, ruleKey: "test.table" });
  await tick();
  assert.ok(refusals.length, "another seat cannot run your contract");
  void contract;
});
