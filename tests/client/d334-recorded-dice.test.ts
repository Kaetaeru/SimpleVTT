/**
 * V0.9 D334 (SRD_MODULE_PLAN.md §25): dice a rest rolls and keeps.
 *
 * Some rules roll dice at the end of a long rest and keep the *numbers*, to be spent later by making one d20 test
 * come out that way (전조). The grammar had no way to say it, so the module left it as a "DM 판정" line. An
 * `effect.apply` template may now name a `recordDie` (and a `count`): the rest rolls it, and each number waits on
 * the sheet as its own effect. Spending one replaces the d20 — whichever way that roll went, because a low number
 * is exactly how a recorded roll spoils somebody else's success.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { longRest } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { pcRescues } from "../../client/rules/contractUse";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const FEAT = "test.d334.feat.omen-keeper";
const KEY = "effect.test.d334.omen";

const MODULE = {
  moduleId: "test.d334", moduleVersion: "1",
  content: [
    {
      id: FEAT, category: "feat",
      presentation: { originalName: "Omen Keeper", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "징조 기록자", description: "긴 휴식에 d20 두 개를 적어 둔다" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: {
          id: "feat:omen-keeper",
          entryPoints: [{ id: "record", invocation: "long-rest", operations: [
            { kind: "effect.apply", target: "self", lifetime: "until-long-rest", template: { key: KEY, name: "징조", recordDie: { value: 20 }, count: { value: 2 } } },
          ] }],
        } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

function keeper() {
  const cat = createCatalog([MODULE]);
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "기록자", classes: "wizard", level: 4, choices: prefer }), cat, { prefer });
  return { cat, made };
}

test("D334: a long-rest contract may say which die to roll and keep", () => {
  const { made } = keeper();
  assert.deepEqual(made.derived.longRestGains?.records, [{ key: KEY, name: "징조", sides: 20, count: 2 }]);
});

test("D334: the rest rolls them, and each number waits on the sheet as its own effect", () => {
  const { made } = keeper();
  const numbers = [19, 3];
  const rested = longRest(initialRuntime(made.derived), made.derived, () => numbers.shift() ?? 1);
  assert.deepEqual(rested.effects.map((effect) => effect.rescue?.value), [19, 3]);
  assert.deepEqual(rested.effects.map((effect) => effect.name), ["징조 (19)", "징조 (3)"], "the number is on the sheet, so the player knows what they are holding");
  assert.equal(new Set(rested.effects.map((effect) => effect.key)).size, 2, "two of the same effect keep separate keys");
  // The next long rest throws the unspent ones away and records two new ones.
  const again = longRest(rested, made.derived, () => 11);
  assert.deepEqual(again.effects.map((effect) => effect.rescue?.value), [11, 11]);
});

test("D334: a recorded number replaces the d20, whichever way the roll went", () => {
  const { cat, made } = keeper();
  const rested = longRest(initialRuntime(made.derived), made.derived, () => 19);
  const entry = { ...newJournalCharacter("c", "dm", made.source, rested), runtime: rested };
  for (const outcome of ["failure", "success"] as const) {
    const offers = pcRescues(entry, made.derived, cat, "ability-check", outcome);
    assert.equal(offers.length, 2, `${outcome}: both recorded numbers are offered`);
    assert.deepEqual(offers[0].interceptor.operations, [{ kind: "roll.modify", mode: "set-die", value: { value: 19 } }]);
    assert.equal(offers[0].payments[0].effectKey, offers[0].ruleKey, "spending it ends that one effect");
  }
});

test("D334: a die somebody lent is still only offered on a failure", () => {
  const { cat, made } = keeper();
  const runtime = initialRuntime(made.derived);
  const lent = { ...runtime, effects: [{ key: "effect.lent", name: "빌린 주사위", source: "feature" as const, duration: "", concentration: false, elapsed: 0, startedAt: "", rescue: { dice: "1d8" } }] };
  const entry = { ...newJournalCharacter("c", "dm", made.source, lent), runtime: lent };
  assert.equal(pcRescues(entry, made.derived, cat, "ability-check", "failure").length, 1);
  assert.equal(pcRescues(entry, made.derived, cat, "ability-check", "success").length, 0, "a die that is added cannot lower anybody's roll");
});

test("D334: at the table the rest writes the numbers down, and one of them lands on a failed check", async () => {
  const { cat, made } = keeper();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D334 시험", { userId: "dm", displayName: "DM" }), joinCode: "D334AA" };
  // The sheet's own roller always shows a 20, so both recorded numbers are known; the host's own dice are low.
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.05, ...pcHostOptions(() => cat, () => 0.95) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D334AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D334AA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "탑", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived), { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  await tick();
  const token = tokenForCharacter(pc);
  alice.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "table.rest", kind: "long" });
  await tick();
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  assert.deepEqual(sheet().runtime.effects.map((effect) => effect.rescue?.value), [20, 20], "the rest rolled and kept them");
  // A check that comes out badly: the window offers the recorded numbers by name.
  alice.send({ type: "act.action", actor: { entryId: pc.id, pageId: scene.id, tokenId: token.id }, kind: "hide" });
  await tick();
  const card = [...host.archive].reverse().find((message) => message.type === "act")!;
  assert.equal(card.act!.check!.success, false);
  const ask = [...host.archive].reverse().find((message) => message.prompt?.kind === "rescue" && !message.prompt.outcome)!;
  assert.deepEqual(ask.prompt!.rescue!.features, ["징조 (20)", "징조 (20)"]);
  alice.send({ type: "act.rescue", messageId: ask.id, feature: "징조 (20)" });
  await tick();
  const again = [...host.archive].reverse().find((message) => message.type === "act")!;
  assert.equal(again.act!.check!.d20, 20, "the recorded number is the d20 now");
  assert.equal(sheet().runtime.effects.length, 1, "and that one is spent");
});
