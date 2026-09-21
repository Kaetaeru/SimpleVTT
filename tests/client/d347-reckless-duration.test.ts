/**
 * V0.9 D347: "until the start of your next turn" is not "until this turn ends".
 *
 * 무모한 공격 buys advantage on the barbarian's own Strength melee attacks and hands it to everyone attacking them
 * back — until the start of their next turn. The effect counted its one round on the bearer's clock, which ticks at
 * the end of their turn, so the dangerous half vanished the moment the barbarian stopped acting: the monsters that
 * swung at them afterwards did so without the advantage the rule gives them.
 *
 * An `effect.apply` template may now name the turn boundary its rounds count on, and the barbarian's does: the
 * bearer's *start*. The host already ticks anchored effects at that moment (R85/D220).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { ageEffects, startEffect } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import type { ActiveEffect } from "../../client/character/types";
import { featureActivation } from "../../client/rules/activation";
import { characterScope, parseContract } from "../../client/rules/contract";
import { contractDurations } from "../../client/rules/contractActivation";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const FEATURE = "test.d347.feature.reckless";

const MODULE = {
  moduleId: "test.d347", moduleVersion: "1",
  content: [
    {
      id: "test.d347.subclass.reckless", category: "subclass",
      presentation: { originalName: "Reckless", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "무모한 길" } } },
      relationships: [{ kind: "parent", target: "dnd.srd521.class.barbarian" }],
      progressionContributions: [{ track: "dnd.srd521.class.barbarian", threshold: 3, grants: [FEATURE] }],
      mechanics: [{ kind: "subclass-definition", config: {} }],
    },
    {
      id: FEATURE, category: "option",
      presentation: { originalName: "Reckless", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "무모하게", description: "다음 턴 시작까지" } } },
      mechanics: [{ kind: "common-play", config: { id: FEATURE, entryPoints: [
        { id: "while-active", invocation: "manual", operations: [
          { kind: "effect.apply", target: "self", lifetime: "until-duration", template: { name: "무모하게", duration: "이 턴 (다음 턴 시작까지)", concentration: false, rounds: 1, anchor: { who: "bearer", boundary: "start" } } },
          { kind: "property.modify", property: "attack-roll.against-me.advantage", operation: "add", note: "다음 턴 시작까지" },
        ] },
      ] } }],
    },
  ],
} as unknown as RuleModuleJson;

test("D347: a template may name the turn boundary its rounds count on", () => {
  const parsed = parseContract({ id: "feature:test.d347", entryPoints: [
    { id: "use", invocation: "manual", operations: [{ kind: "effect.apply", target: "self", lifetime: "until-duration", template: { name: "무모하게", rounds: 1, anchor: { who: "bearer", boundary: "start" } } }] },
  ] }, FEATURE);
  assert.deepEqual(parsed.unsupported, []);
  const operation = parsed.entryPoints[0].operations[0];
  assert.deepEqual(operation.kind === "effect.apply" ? operation.template.anchor : undefined, { who: "bearer", boundary: "start" });
  // Nothing written about a boundary still counts on the bearer's own clock, as it always did.
  const plain = parseContract({ id: "feature:test.d347.plain", entryPoints: [
    { id: "use", invocation: "manual", operations: [{ kind: "effect.apply", target: "self", lifetime: "until-duration", template: { name: "한 라운드", rounds: 1 } }] },
  ] }, `${FEATURE}.plain`);
  const plainOperation = plain.entryPoints[0].operations[0];
  assert.equal(plainOperation.kind === "effect.apply" ? plainOperation.template.anchor : "x", undefined);
});

test("D347: the sheet starts the effect anchored, and the end of its own turn does not age it", () => {
  const cat = createCatalog([MODULE]);
  const prefer = { "class.2.subclass": ["test.d347.subclass.reckless"] };
  const made = autofill(sourceOf({ name: "야만용사", classes: "barbarian", level: 3, abilities: { str: 16 }, choices: prefer }), cat, { prefer });
  const feature = made.derived.features.find((item) => item.name === "무모하게")!;
  const activation = featureActivation(feature, made.derived, contractDurations(cat, characterScope(made.derived)))!;
  const duration = activation.duration!(made.derived);
  assert.deepEqual(duration.anchor, { who: "bearer", boundary: "start" }, JSON.stringify(duration));
  assert.equal(duration.rounds, 1);
  const effect: Omit<ActiveEffect, "elapsed" | "startedAt"> = { key: "feature:test", name: "무모하게", source: "feature", duration: duration.text, concentration: false, rounds: duration.rounds, anchor: duration.anchor };
  const running = startEffect(initialRuntime(made.derived), effect);
  // The bearer's own clock is what ends a turn; an anchored effect ignores it and waits for the host's tick.
  const after = ageEffects(running, 1);
  assert.deepEqual(after.ended, [], "it is still there when the barbarian's turn ends");
  assert.equal(after.runtime.effects[0].elapsed, 0, "and it has not aged a round");
});

test("D347: at the table it survives the barbarian's own turn and ends when their next one starts", async () => {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D347 시험", { userId: "dm", displayName: "DM" }), joinCode: "D347AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D347AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "들판", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const prefer = { "class.2.subclass": ["test.d347.subclass.reckless"] };
  const made = autofill(sourceOf({ name: "야만용사", classes: "barbarian", level: 3, abilities: { str: 16 }, choices: prefer }), cat, { prefer });
  const base = initialRuntime(made.derived);
  // The barbarian has just used it on their own turn: the effect is on the sheet, anchored to their next start.
  const reckless: ActiveEffect = { key: "feature:test.d347", name: "무모하게", source: "feature", duration: "이 턴 (다음 턴 시작까지)", concentration: false, rounds: 1, anchor: { who: "bearer", boundary: "start" }, elapsed: 0, startedAt: "" };
  const pc = newJournalCharacter(campaign.id, "dm", made.source, base);
  const monster = (parseCustomMonster(JSON.stringify({ name: "늑대", ac: 13, hp: 11, creatureType: "beast", abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster;
  const npc = newJournalNpc(campaign.id, "dm", monster);
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "야만용사", tokenId: tokens.pc.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.add", turn: { name: "늑대", tokenId: tokens.npc.id, pageId: scene.id, entryId: npc.id, initiative: 5 } });
  dm.send({ type: "tracker.next" });
  await tick();
  const running = () => ((host.journal.find((entry) => entry.id === pc.id) as JournalCharacter).runtime.effects ?? []).map((effect) => effect.name);
  // The barbarian's turn has begun; they attack recklessly now, which is when the sheet starts the effect.
  const live = host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  dm.send({ type: "journal.put", entry: { ...live, runtime: { ...live.runtime, effects: [reckless] } } });
  await tick();
  assert.deepEqual(running(), ["무모하게"], "the barbarian's turn is running and so is the effect");
  dm.send({ type: "tracker.next" });
  await tick();
  assert.deepEqual(running(), ["무모하게"], "their turn ended — the wolf swings at a barbarian who is still reckless");
  dm.send({ type: "tracker.next" });
  await tick();
  assert.deepEqual(running(), [], "and it ends when the barbarian's own next turn starts");
});
