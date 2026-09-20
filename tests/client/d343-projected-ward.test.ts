/**
 * V0.9 D343 (SRD_MODULE_PLAN.md §34): a ward that takes the blow for somebody else.
 *
 * 투사 방호막 is a reaction: when a creature you can see takes damage, your own ward absorbs it, and whatever the
 * ward cannot hold reaches that creature. The reaction window on "somebody else was hit" existed, but every
 * operation it knew acted on the creature that was hit. `reaction.absorb` is the one that acts on the reactor:
 * their temporary hit points pay for what comes off the card.
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
import { pcGuards } from "../../client/rules/contractReactions";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const FEAT = "test.d343.feat.projected-ward";

const MODULE = {
  moduleId: "test.d343", moduleVersion: "1",
  content: [
    {
      id: FEAT, category: "feat",
      presentation: { originalName: "Projected Ward", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "투사 방호", description: "남이 받는 피해를 내 방호막이 받는다" } } },
      mechanics: [
        { kind: "feat-definition", config: { tier: "general", minimumLevel: 4 } },
        { kind: "common-play", config: { id: "feat:projected-ward", entryPoints: [], interceptors: [
          { id: "project", timing: "reaction.window", trigger: "attack.hit-ally", operations: [
            { kind: "property.modify", property: "reaction.absorb", operation: "add", note: "30피트 이내에서 볼 수 있는 크리처 — 거리는 표에서" },
          ] },
        ] } },
      ],
    },
  ],
} as unknown as RuleModuleJson;

test("D343: the window offers a reaction that absorbs", () => {
  const cat = createCatalog([MODULE]);
  const prefer = { "class.3.asi": [FEAT] };
  const made = autofill(sourceOf({ name: "위자드", classes: "wizard", level: 4, abilities: { int: 16 }, choices: prefer }), cat, { prefer });
  const offers = pcGuards({ runtime: initialRuntime(made.derived) }, made.derived, cat, "attack.hit-ally");
  assert.deepEqual(offers.map((offer) => [offer.feature, offer.absorb]), [["투사 방호", true]], JSON.stringify(offers.map((offer) => offer.feature)));
});

test("D343: at the table the ward takes the damage, and what it cannot hold reaches the target", async () => {
  const cat = createCatalog([MODULE]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D343 시험", { userId: "dm", displayName: "DM" }), joinCode: "D343AA" };
  // High d20s: the ogre hits. Damage dice come out at their maximum.
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.99, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D343AA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "D343AA", seat: "a" });
  const bob = new TableClient(hub.connect("p2"), { userId: "bob", displayName: "밥", joinCode: "D343AA", seat: "b" });
  await tick();
  const scene = newScene(campaign.id, "성문", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const prefer = { "class.3.asi": [FEAT] };
  const warden = autofill(sourceOf({ name: "위자드", classes: "wizard", level: 4, abilities: { int: 16 }, choices: prefer }), cat, { prefer });
  const victim = autofill(sourceOf({ name: "도적", classes: "rogue", level: 4, abilities: { dex: 16 } }), cat);
  // The ward is 5 points of temporary hit points the wizard is already carrying.
  const base = initialRuntime(warden.derived);
  const wizard = newJournalCharacter(campaign.id, "bob", warden.source, { ...base, hp: { ...base.hp, temp: 5 } }, { owner: "bob" });
  const rogue = newJournalCharacter(campaign.id, "alice", victim.source, initialRuntime(victim.derived), { owner: "alice" });
  const monster = (parseCustomMonster(JSON.stringify({ name: "오우거", ac: 11, hp: 59, creatureType: "giant", abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 }, actions: [{ name: "곤봉", attack: { bonus: 6, damage: [{ formula: "2d8+4", type: "타격" }] } }] })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster;
  const npc = newJournalNpc(campaign.id, "dm", monster);
  bob.send({ type: "journal.put", entry: wizard });
  alice.send({ type: "journal.put", entry: rogue });
  dm.send({ type: "journal.put", entry: npc });
  await tick();
  const tokens = { wizard: tokenForCharacter(wizard), rogue: tokenForCharacter(rogue), npc: tokenForNpc(npc) };
  bob.send({ type: "token.put", pageId: scene.id, token: tokens.wizard });
  alice.send({ type: "token.put", pageId: scene.id, token: tokens.rogue });
  dm.send({ type: "token.put", pageId: scene.id, token: tokens.npc });
  await tick();
  const sheet = (id: string) => host.journal.find((entry) => entry.id === id) as JournalCharacter;
  const hpBefore = sheet(rogue.id).runtime.hp.current;
  dm.send({ type: "act.attack", attacker: { entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id }, targets: [{ entryId: rogue.id, pageId: scene.id, tokenId: tokens.rogue.id }], attack: { source: "npc", actionName: "곤봉" } });
  await tick();
  const ask = [...host.archive].reverse().find((message) => message.prompt?.kind === "guard" && !message.prompt.outcome)!;
  assert.ok(ask, `the bystander with the ward is asked: ${host.archive.slice(-4).map((m) => `${m.type}/${m.prompt?.kind ?? ""}: ${m.content}`).join(" | ")}`);
  assert.equal(ask.prompt!.reactor.entryId, wizard.id);
  assert.deepEqual(ask.prompt!.guard!.features.map((feature) => feature.name), ["투사 방호"]);
  bob.send({ type: "act.guard", messageId: ask.id, feature: "투사 방호" });
  await tick();
  assert.equal(sheet(wizard.id).runtime.hp.temp, 0, "the ward is spent");
  const card = [...host.archive].reverse().find((message) => message.type === "action")!;
  assert.equal(card.action!.damageTotal, 36 - 5, "the card carries the damage with the ward's 5 taken off");
  const lost = hpBefore - sheet(rogue.id).runtime.hp.current;
  assert.ok(lost > 0, "and the rest still reached the rogue");
  assert.ok(([...host.archive].reverse().find((message) => message.prompt?.outcome)?.content ?? "").includes("방호막이 5 흡수"), "the card says what the ward held");
});
