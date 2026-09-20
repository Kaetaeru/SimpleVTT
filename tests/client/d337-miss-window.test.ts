/**
 * V0.9 D337 (SRD_MODULE_PLAN.md §28): the window a miss opens.
 *
 * A reaction may answer a swing that *missed* (응수: when a creature misses you with a melee attack, strike back).
 * `reaction.window` knew two moments — the attack hit me, the attack hit somebody else — so the rule stayed a line
 * for the DM. `attack.miss-self` is the third. Nothing about the card changes, so the window is a message of its
 * own rather than a hold: the miss is posted as usual while the reactor decides.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { REACTION_TRIGGERS } from "../../client/rules/contractReactions";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const FEAT = "test.d337.feat.riposte";
const POOL = "resource.test.d337.riposte";

const MODULE = {
  moduleId: "test.d337", moduleVersion: "1",
  content: [
    {
      id: FEAT, category: "feat",
      presentation: { originalName: "Riposte", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "받아치기", description: "빗나간 공격에 반격한다" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: {
          id: "feat:riposte",
          payments: [{ kind: "resource", resource: "resource:test.d337.riposte", amount: { value: 1 }, consumeAt: "commit" }],
          entryPoints: [{ id: "gain", invocation: "gain", operations: [{ kind: "property.modify", property: "grant.resource", operation: "add", value: { value: 2 }, params: { id: POOL, label: "받아치기", recovery: "short-rest" } }] }],
          interceptors: [{ id: "riposte", timing: "reaction.window", trigger: "attack.miss-self", operations: [
            { kind: "property.modify", property: "reaction.strike-back", operation: "add", note: "빗나간 상대에게 근접 공격" },
          ] }],
        } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

test("D337: the grammar knows the moment an attack missed", () => {
  assert.ok(REACTION_TRIGGERS.includes("attack.miss-self"), REACTION_TRIGGERS.join(" · "));
  assert.ok(REACTION_TRIGGERS.includes("attack.hit-self"), "the two it already knew are still there");
  assert.ok(REACTION_TRIGGERS.includes("attack.hit-ally"));
});

test("D337: a miss opens the window, and taking it opens the strike back", async () => {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D337 시험", { userId: "dm", displayName: "DM" }), joinCode: "D337AA" };
  // Every d20 is low: the goblin misses.
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.05, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D337AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D337AA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "골목", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "검객", classes: "fighter", level: 4, abilities: { dex: 16 }, choices: prefer }), cat, { prefer });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived), { owner: "alice" });
  const monster = (parseCustomMonster(JSON.stringify({ name: "고블린", ac: 12, hp: 12, creatureType: "humanoid", abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }, actions: [{ name: "단검", attack: { bonus: 4, damage: [{ dice: "1d4", flat: 2, type: "piercing" }] } }] })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster;
  const npc = newJournalNpc(campaign.id, "dm", monster);
  alice.send({ type: "journal.put", entry: pc });
  dm.send({ type: "journal.put", entry: npc });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  alice.send({ type: "token.put", pageId: scene.id, token: tokens.pc });
  dm.send({ type: "token.put", pageId: scene.id, token: tokens.npc });
  await tick();
  const me = { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id };
  const goblin = { entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id };
  dm.send({ type: "act.attack", attacker: goblin, targets: [me], attack: { source: "npc", actionName: "단검" } });
  await tick();
  const card = [...host.archive].reverse().find((message) => message.type === "action");
  assert.equal(card?.action?.outcome, "miss", JSON.stringify(card?.action?.attackTotal));
  const ask = [...host.archive].reverse().find((message) => message.prompt?.kind === "guard" && !message.prompt.outcome)!;
  assert.ok(ask, "the window opened on the miss");
  assert.equal(ask.prompt!.guard!.trigger, "attack.miss-self");
  assert.deepEqual(ask.prompt!.guard!.features.map((feature) => feature.name), ["받아치기"]);
  alice.send({ type: "act.guard", messageId: ask.id, feature: "받아치기" });
  await tick();
  const back = [...host.archive].reverse().find((message) => message.prompt?.kind === "opportunity" && !message.prompt.outcome);
  assert.ok(back, "taking it opens the attack back at whoever missed");
  const sheet = host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  assert.equal(sheet.runtime.resourcesUsed[POOL], 1, "and the pool it names paid for it");
});
