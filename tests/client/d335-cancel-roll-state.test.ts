/**
 * V0.9 D335 (SRD_MODULE_PLAN.md §26): taking the advantage away.
 *
 * Some reactions do not add or subtract anything — they remove the advantage and the disadvantage from a roll
 * somebody is about to make (균형 회복, 법칙의 보루). There was no `roll.modify` mode for it, so the module said
 * "DM 판정". `cancel-roll-state` is that mode: the window opens after the dice, so the die that was rolled first
 * stands, which is the roll a single die would have given.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseContract, planRollModify, type Scope } from "../../client/rules/contract";
import { resolveAction } from "../../client/rules/actions";
import type { ActorStats } from "../../client/rules/actions";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const LUCKY = "test.d335.feat.lucky-eye";
const BALANCE = "test.d335.feat.balance";

const MODULE = {
  moduleId: "test.d335", moduleVersion: "1",
  content: [
    {
      id: LUCKY, category: "feat",
      presentation: { originalName: "Lucky Eye", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "행운의 눈", description: "능력 판정에 이점" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: { id: "feat:lucky-eye", entryPoints: [{ id: "while-watching", invocation: "manual", operations: [{ kind: "property.modify", property: "ability-check.advantage", operation: "add", note: "행운의 눈" }] }] } },
      ],
    },
    {
      id: BALANCE, category: "feat",
      presentation: { originalName: "Restore Balance", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "균형 되돌리기", description: "그 굴림의 이점과 불리점을 없앤다" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: { id: "feat:balance", entryPoints: [], interceptors: [
          { id: "balance", timing: "d20.outcome-determined", slot: "any", families: [], outcomes: ["success"], interaction: { id: "use", kind: "choice", responder: "actor-owner", mode: "blocking", input: { type: "boolean" } }, factQueries: [{ id: "seen", fact: "table.judgement", unknownPolicy: "ask", question: "60피트 이내에서 볼 수 있는 크리처입니까?" }], operations: [{ kind: "roll.modify", mode: "cancel-roll-state" }] },
        ] } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

const scope: Scope = () => undefined;
const dice = { d: () => 7 };
const stats = (advantage?: { reason: string }): ActorStats => ({
  abilities: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
  saves: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
  skills: { stealth: 4 }, proficiencyBonus: 2,
  ...(advantage ? { advantage: [{ families: ["ability-check"], reason: advantage.reason }] } : {}),
}) as unknown as ActorStats;

test("D335: the mode is part of the grammar, and an unknown one is still refused", () => {
  const parsed = parseContract({ id: "feature:test.balance", interceptors: [
    { id: "balance", timing: "d20.outcome-determined", slot: "any", families: [], outcomes: ["success", "failure"], operations: [{ kind: "roll.modify", mode: "cancel-roll-state" }] },
  ] }, "test.d335.feature.balance");
  assert.deepEqual(parsed.unsupported, []);
  const bad = parseContract({ id: "feature:test.bad", interceptors: [
    { id: "bad", timing: "d20.outcome-determined", slot: "any", families: [], outcomes: ["failure"], operations: [{ kind: "roll.modify", mode: "unbend" }] },
  ] }, "test.d335.feature.bad");
  assert.equal(bad.unsupported.length, 1, bad.unsupported.join(" · "));
});

test("D335: the die that was rolled first is the one that stands", () => {
  const operations = [{ kind: "roll.modify" as const, mode: "cancel-roll-state" }];
  // Advantage kept an 18; the first die was a 4, so cancelling leaves the 4.
  const plan = planRollModify(operations, scope, dice, undefined, 4);
  assert.equal(plan.d20, 4);
  assert.equal(plan.delta, 0, "nothing is added or taken off the total");
  assert.match(plan.parts.join(" "), /이점·불리점 없음/);
  // With no die to read, the rule does nothing rather than guessing one.
  assert.equal(planRollModify(operations, scope, dice).d20, undefined);
});

test("D335: an advantaged check carries its dice in the order they were rolled", () => {
  const rolls = [4, 18];
  const result = resolveAction({ kind: "hide", dc: 15, random: () => (rolls.shift() ?? 1) / 20 - 0.001, actor: { name: "도적", stats: stats({ reason: "시험" }), conditions: [] } });
  assert.equal(result.check!.advantage, 2, JSON.stringify(result.check));
  assert.deepEqual(result.check!.rolls, [4, 18], "both dice, in order");
  assert.equal(result.check!.d20, 18, "the better one was kept");
  // A plain check rolls one die and says nothing about an order.
  const plain = resolveAction({ kind: "hide", dc: 15, random: () => 0.5, actor: { name: "도적", stats: stats(), conditions: [] } });
  assert.equal(plain.check!.rolls, undefined);
});

test("D335: at the table, the reaction takes the advantage off somebody else's check", async () => {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D335 시험", { userId: "dm", displayName: "DM" }), joinCode: "D335AA" };
  // The check rolls a 4 and then a 19: with advantage the 19 stands, and cancelling it leaves the 4.
  const values = [0.15, 0.95];
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => values.shift() ?? 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D335AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D335AA", seat: "a" });
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "D335AA", seat: "b" });
  await tick();
  const scene = newScene(campaign.id, "다리", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const rollerPrefer = { "class.3.asi": [LUCKY] };
  const watcherPrefer = { "class.3.asi": [BALANCE] };
  const roller = autofill(sourceOf({ name: "도적", classes: "rogue", level: 4, abilities: { dex: 16 }, choices: rollerPrefer }), cat, { prefer: rollerPrefer });
  const watcher = autofill(sourceOf({ name: "드루이드", classes: "druid", level: 4, choices: watcherPrefer }), cat, { prefer: watcherPrefer });
  const pc = newJournalCharacter(campaign.id, "alice", roller.source, initialRuntime(roller.derived), { owner: "alice" });
  const helper = newJournalCharacter(campaign.id, "bob", watcher.source, initialRuntime(watcher.derived), { owner: "bob" });
  alice.send({ type: "journal.put", entry: pc });
  bob.send({ type: "journal.put", entry: helper });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), helper: tokenForCharacter(helper) };
  alice.send({ type: "token.put", pageId: scene.id, token: tokens.pc });
  bob.send({ type: "token.put", pageId: scene.id, token: tokens.helper });
  await tick();
  alice.send({ type: "act.action", actor: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, kind: "hide", dc: 15 });
  await tick();
  const first = [...host.archive].reverse().find((message) => message.type === "act")!;
  assert.equal(first.act!.check!.advantage, 2, JSON.stringify(first.act!.check));
  assert.equal(first.act!.check!.success, true, `${first.act!.check!.total} vs DC 15`);
  const ask = [...host.archive].reverse().find((message) => message.prompt?.kind === "rescue" && !message.prompt.outcome)!;
  assert.deepEqual(ask.prompt!.rescue!.features, ["균형 되돌리기"]);
  bob.send({ type: "act.rescue", messageId: ask.id, feature: "균형 되돌리기" });
  await tick();
  const again = [...host.archive].reverse().find((message) => message.type === "act")!;
  assert.equal(again.act!.check!.d20, first.act!.check!.rolls![0], "the die that was rolled first is the one that stands");
  assert.equal(again.act!.check!.success, false, "and the check no longer beats the DC");
});
