/**
 * R64 (ROLL20_TABLE_SPEC.md D199): each thing a hit offers has a standing answer on the sheet.
 *
 * R63 asked after every landed swing. A fighter with Extra Attack and a feat would answer the same question four
 * times a turn, so the sheet keeps an answer per offer: ask every time (the default), always take it without a
 * window, or never offer it. 신성한 강타 is never "always" — it spends a slot the player has to pick.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import type { ChatMessage } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime, type HitPolicy } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, hitOffers, hitPolicyOf, pcAttackSpec, pcCombatant, pcConcentrationKey, splitHitOffers } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function table(cls: string, hitPolicy: Record<string, HitPolicy>) {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R64 시험", { userId: "dm", displayName: "DM" }), joinCode: "R64AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcHitOffers: (entry, id, riders) => hitOffers(entry, derivedOf(entry, catalog()), id, riders),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R64AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "공격자", classes: cls, level: 5 });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, { ...initialRuntime(made.derived), hitPolicy });
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: pc });
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, ogre: { entryId: ogre.id, pageId: scene.id, tokenId: ogreToken.id } };
  const derived = derivedOf(pc, catalog());
  const prompts = () => host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "on-hit" && !message.supersedes);
  const cards = () => host.archive.filter((message): message is ChatMessage & { action: NonNullable<ChatMessage["action"]> } => message.type === "action" && Boolean(message.action));
  const swing = async (weapon = derived.attacks.find((attack) => attack.properties.includes("finesse")) ?? derived.attacks.find((attack) => attack.itemId)!) => {
    dm.send({ type: "act.attack", attacker: refs.pc, targets: [refs.ogre], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "hit" } });
    await tick();
  };
  return { dm, prompts, cards, swing };
}

test("R64: \"always\" takes an offer without a window (D199)", async () => {
  const t = await table("rogue", { "rogue.sneak-attack": "always", savage: "never" });
  await t.swing();
  assert.equal(t.prompts().length, 0, "nothing to ask");
  const [card] = t.cards();
  assert.ok(card.action.damage.some((part) => part.part.label === "암습"), "암습 landed anyway");
});

test("R64: \"never\" drops an offer, and with nothing left there is no window (D199)", async () => {
  const t = await table("rogue", { "rogue.sneak-attack": "never", savage: "never" });
  await t.swing();
  assert.equal(t.prompts().length, 0);
  const [card] = t.cards();
  assert.equal(card.action.damage.length, 1, "the weapon alone");
});

test("R64: the window asks only what is still \"ask\", says what rides along, and 안 함 keeps it (D199)", async () => {
  const t = await table("rogue", { savage: "always" });
  await t.swing();
  const [prompt] = t.prompts();
  assert.deepEqual(prompt.prompt!.onHit!.offers.map((offer) => offer.key), ["rogue.sneak-attack"]);
  assert.deepEqual(prompt.prompt!.onHit!.auto, ["야만적 공격자"]);
  t.dm.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  const [card] = t.cards();
  assert.equal(card.action.damage.length, 1, "암습 was declined");
  assert.ok(card.action.attack.name.includes("야만적 공격자"), `the "always" offer still landed: ${card.action.attack.name}`);
});

test("R64: 신성한 강타 is never taken unasked (D199)", async () => {
  const t = await table("paladin", { smite: "always" });
  await t.swing();
  const [prompt] = t.prompts();
  assert.ok(prompt, "a slot is the player's to pick");
  const smite = prompt.prompt!.onHit!.offers.find((offer) => offer.key === "smite")!;
  assert.ok(smite);
  const runtime = initialRuntime(build({ classes: "paladin", level: 5 }).derived);
  assert.equal(hitPolicyOf({ ...runtime, hitPolicy: { smite: "always" } }, smite), "ask");
  assert.deepEqual(splitHitOffers({ ...runtime, hitPolicy: { smite: "never" } }, [smite]), { ask: [], auto: [] }, "but it can be switched off");
});
