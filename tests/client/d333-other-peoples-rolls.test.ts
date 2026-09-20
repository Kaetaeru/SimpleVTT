/**
 * V0.9 D333 (SRD_MODULE_PLAN.md §24): a window on somebody else's d20.
 *
 * A contract may answer a roll that is not its owner's — those interceptors are written with `slot: "any"` and a
 * fact query that asks "is this a creature you can see?". Two things stopped them working: the sheet only offered
 * interceptors whose slot was literally `d20.roll`, and the host only opened a bystander window for a saving throw
 * against a spell. An ability check or a missed attack now opens the same window, and the sheet that answers a roll
 * that went *well* is read for its success interceptor.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { pcRescues } from "../../client/rules/contractUse";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const FEAT = "test.d333.feat.fate-twist";
const POOL = "resource.test.d333.twist";

const ASK = [{ id: "seen", fact: "table.judgement", unknownPolicy: "ask", question: "자신이 볼 수 있는 다른 크리처의 d20 시험입니까?" }];
const MODULE = {
  moduleId: "test.d333", moduleVersion: "1",
  content: [
    {
      id: FEAT, category: "feat",
      presentation: { originalName: "Fate Twist", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "운명 비틀기", description: "남의 d20을 비튼다" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: {
          id: "feat:fate-twist",
          payments: [{ kind: "resource", resource: "resource:test.d333.twist", amount: { value: 1 }, consumeAt: "commit" }],
          entryPoints: [{ id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.resource", operation: "add", value: { value: 3 }, params: { id: POOL, label: "운명 비틀기", recovery: "long-rest" } }] }],
          interceptors: [
            { id: "help", timing: "d20.outcome-determined", slot: "any", families: [], outcomes: ["failure"], interaction: { id: "use", kind: "choice", responder: "actor-owner", mode: "blocking", input: { type: "boolean" } }, factQueries: ASK, operations: [{ kind: "roll.modify", mode: "add-die", dice: "1d4" }] },
            { id: "spoil", timing: "d20.outcome-determined", slot: "any", families: [], outcomes: ["success"], interaction: { id: "use", kind: "choice", responder: "actor-owner", mode: "blocking", input: { type: "boolean" } }, factQueries: ASK, operations: [{ kind: "roll.modify", mode: "subtract-die", dice: "1d4" }] },
          ],
        } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

/** A wizard who rolls, and a fighter beside them who took the feat. */
async function table(dice: { value: number }) {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D333 시험", { userId: "dm", displayName: "DM" }), joinCode: "D333AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D333AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D333AA", seat: "a" });
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "D333AA", seat: "b" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const roller = autofill(sourceOf({ name: "마법사", classes: "wizard", level: 4, abilities: { dex: 8 } }), cat);
  const prefer = { "class.3.asi": [FEAT] };
  const twister = autofill(sourceOf({ name: "전사", classes: "fighter", level: 4, choices: prefer }), cat, { prefer });
  const pc = newJournalCharacter(campaign.id, "alice", roller.source, initialRuntime(roller.derived), { owner: "alice" });
  const helper = newJournalCharacter(campaign.id, "bob", twister.source, initialRuntime(twister.derived), { owner: "bob" });
  alice.send({ type: "journal.put", entry: pc });
  bob.send({ type: "journal.put", entry: helper });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), helper: tokenForCharacter(helper) };
  alice.send({ type: "token.put", pageId: scene.id, token: tokens.pc });
  bob.send({ type: "token.put", pageId: scene.id, token: tokens.helper });
  await tick();
  const me = { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id };
  const sheetOf = (id: string) => host.journal.find((entry) => entry.id === id) as JournalCharacter;
  const prompt = () => [...host.archive].reverse().find((message) => message.prompt?.kind === "rescue" && !message.prompt.outcome);
  const actCard = () => [...host.archive].reverse().find((message) => message.type === "act");
  return { host, alice, bob, me, pc, helper, sheetOf, prompt, actCard, cat };
}

test("D333: a contract whose slot is `any` is offered on another creature's d20", () => {
  const cat = createCatalog([MODULE]);
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "전사", classes: "fighter", level: 4, choices: prefer }), cat, { prefer });
  const entry = newJournalCharacter("c", "dm", made.source, initialRuntime(made.derived));
  const failure = pcRescues(entry, made.derived, cat, "ability-check", "failure");
  const twist = failure.find((offer) => offer.feature === "운명 비틀기");
  assert.ok(twist, `the sheet no longer insists on the \`d20.roll\` slot: ${failure.map((offer) => offer.feature).join(", ")}`);
  assert.ok(twist!.interceptor.asksFacts?.length, "and the window carries the fact the contract asks about");
  const success = pcRescues(entry, made.derived, cat, "ability-check", "success");
  assert.deepEqual(success.map((offer) => offer.feature), ["운명 비틀기"], "the other half answers a roll that went well; the fighter's own rescue only answers a failure");
});

test("D333: somebody else's failed ability check opens the window, and the die lands on their card", async () => {
  const dice = { value: 0.2 };
  const { alice, bob, me, helper, sheetOf, prompt, actCard } = await table(dice);
  alice.send({ type: "act.action", actor: me, kind: "hide" });
  await tick();
  const first = actCard()!;
  assert.equal(first.act!.check!.success, false, `${first.act!.check!.total} vs DC ${first.act!.check!.dc}`);
  const ask = prompt()!;
  assert.ok(ask, "the bystander is asked, though the roll was not theirs");
  assert.equal(ask.prompt!.reactor.entryId, helper.id);
  assert.deepEqual(ask.prompt!.rescue!.features, ["운명 비틀기"]);
  assert.ok(ask.prompt!.rescue!.facts?.length, "with the question the contract asks");
  dice.value = 0.95;
  bob.send({ type: "act.rescue", messageId: ask.id, feature: "운명 비틀기" });
  await tick();
  const again = actCard()!;
  assert.equal(again.id, first.id, "the same card is superseded");
  assert.ok(again.act!.check!.total > first.act!.check!.total, `${first.act!.check!.total} → ${again.act!.check!.total}`);
  assert.equal(sheetOf(helper.id).runtime.resourcesUsed[POOL], 1, "the bystander's own pool paid for it");
});

test("D333: a check that went well is read as a success, and the die comes off", async () => {
  const dice = { value: 0.95 };
  const { alice, bob, me, helper, prompt, actCard } = await table(dice);
  alice.send({ type: "act.action", actor: me, kind: "hide" });
  await tick();
  const first = actCard()!;
  assert.equal(first.act!.check!.success, true, `${first.act!.check!.total} vs DC ${first.act!.check!.dc}`);
  const ask = prompt()!;
  assert.ok(ask, "a successful roll opens the spoiling window");
  assert.equal(ask.prompt!.rescue!.interfere, true);
  assert.equal(ask.prompt!.reactor.entryId, helper.id);
  dice.value = 0.95;
  bob.send({ type: "act.rescue", messageId: ask.id, feature: "운명 비틀기" });
  await tick();
  const again = actCard()!;
  assert.ok(again.act!.check!.total < first.act!.check!.total, `${first.act!.check!.total} → ${again.act!.check!.total}`);
});
