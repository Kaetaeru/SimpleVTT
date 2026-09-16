/**
 * R63 (ROLL20_TABLE_SPEC.md D198): a hit opens a window for the attacker.
 *
 * 2024 writes 암습, 신성한 강타, 야만적 공격자 and most feat riders as "when you hit". The dialog before the dice made
 * the player tick them blind; now the host holds a landed swing, asks the attacker's controller with the hit and a
 * critical already known, and resolves it again with the same dice plus whatever was chosen. The target's reaction is
 * asked first, so a Shield that turns the hit into a miss never wastes a smite.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, hasSneakAttack, hitOffers, pcAttackSpec, pcCombatant, pcConcentrationKey, withHitChoices } from "../../client/rules/attackSpec";
import { applyDamage, carryDice, type Combatant, type DamageResult } from "../../client/rules/resolve";
import type { GuardOffer } from "../../client/rules/contractReactions";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import type { ChatMessage } from "../../client/campaign/model";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function table(cls: string, level: number, options: { guards?: GuardOffer[]; targetPc?: boolean } = {}) {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R63 시험", { userId: "dm", displayName: "DM" }), joinCode: "R63AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcHitOffers: (entry, id, riders) => hitOffers(entry, derivedOf(entry, catalog()), id, riders),
    pcGuards: (entry) => (entry.name === "방어자" ? options.guards ?? [] : []),
    pcPayContract: (entry) => entry.runtime,
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R63AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "공격자", classes: cls, level });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  dm.send({ type: "journal.put", entry: pc });
  const defender = options.targetPc ? build({ name: "방어자", classes: "fighter", level: 5 }) : null;
  const target = defender ? newJournalCharacter(campaign.id, "dm", { ...defender.source, name: "방어자" }, initialRuntime(defender.derived)) : newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: target });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const targetToken = target.kind === "npc" ? tokenForNpc(target) : tokenForCharacter(target);
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: targetToken });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, target: { entryId: target.id, pageId: scene.id, tokenId: targetToken.id } };
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const derived = derivedOf(sheet(), catalog());
  // The windows opened, not the copies that replace them once answered.
  const prompts = () => host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "on-hit" && !message.supersedes);
  const open = () => { const answered = new Set(host.archive.map((message) => message.supersedes)); return prompts().filter((message) => !message.prompt!.outcome && !answered.has(message.id)); };
  const cards = () => host.archive.filter((message): message is ChatMessage & { action: NonNullable<ChatMessage["action"]> } => message.type === "action" && Boolean(message.action));
  return { host, dm, refs, sheet, derived, prompts, open, cards };
}

test("R63: a rogue's hit opens the window, and 암습 lands on the same dice (D198)", async () => {
  const t = await table("rogue", 5);
  const blade = t.derived.attacks.find((attack) => hasSneakAttack(t.derived, attack))!;
  assert.ok(blade, t.derived.attacks.map((attack) => attack.name).join("/"));
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.target], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "hit" } });
  await tick();
  assert.equal(t.cards().length, 0, "the card is held until the attacker answers");
  const [prompt] = t.open();
  assert.ok(prompt, "an on-hit window");
  // The soldier background brings 야만적 공격자 as well; both are offered, nothing is ticked for the player.
  assert.deepEqual(prompt.prompt!.onHit!.offers.map((offer) => offer.key), ["sneak", "savage"]);
  assert.equal(prompt.prompt!.onHit!.outcome, "hit");

  t.dm.send({ type: "act.onhit", messageId: prompt.id, choices: ["sneak"] });
  await tick();
  const [card] = t.cards();
  assert.ok(card, "answered, the card is posted");
  const sneak = card.action.damage.find((part) => part.part.label === "암습")!;
  assert.equal(sneak.dice.length, 3, "5레벨 로그: 3d6");
  assert.equal(card.action.damage.length, 2, "the weapon and 암습");
  assert.equal(t.open().length, 0);
  assert.ok(t.host.archive.some((message) => message.supersedes === prompt.id && message.prompt?.outcome?.chosen?.includes("암습")));
});

test("R63: on a critical the rider's dice double too (D198)", async () => {
  const t = await table("rogue", 5);
  const blade = t.derived.attacks.find((attack) => hasSneakAttack(t.derived, attack))!;
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.target], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "crit" } });
  await tick();
  const [prompt] = t.open();
  assert.equal(prompt.prompt!.onHit!.outcome, "crit", "the window says it was a critical");
  t.dm.send({ type: "act.onhit", messageId: prompt.id, choices: ["sneak"] });
  await tick();
  const [card] = t.cards();
  assert.equal(card.action.outcome, "crit");
  assert.equal(card.action.damage.find((part) => part.part.label === "암습")!.dice.length, 6, "3d6 doubled on a critical");
  assert.equal(card.action.damage.find((part) => part.part.label !== "암습")!.dice.length, 2, "and the weapon's own die doubled as before");
});

test("R63: 안 함 posts the swing exactly as it was rolled, and a miss never asks (D198)", async () => {
  const t = await table("rogue", 5);
  const blade = t.derived.attacks.find((attack) => hasSneakAttack(t.derived, attack))!;
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.target], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "hit" } });
  await tick();
  const [prompt] = t.open();
  t.dm.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  const [card] = t.cards();
  assert.equal(card.action.damage.length, 1, "no 암습");
  assert.ok(t.host.archive.some((message) => message.supersedes === prompt.id && message.prompt?.outcome?.declined));

  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.target], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "miss" } });
  await tick();
  assert.equal(t.prompts().length, 1, "a miss opens no window");
  assert.equal(t.cards().length, 2);
});

test("R63: 신성한 강타 spends its slot only when it is chosen (D198)", async () => {
  const t = await table("paladin", 5);
  const weapon = t.derived.attacks.find((attack) => attack.itemId)!;
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.target], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "hit" } });
  await tick();
  const [first] = t.open();
  const smite = first.prompt!.onHit!.offers.find((offer) => offer.key === "smite")!;
  assert.ok(smite.slots!.length, "the slots it may spend travel with the offer");
  t.dm.send({ type: "act.decline", messageId: first.id });
  await tick();
  assert.equal(t.sheet().runtime.slotsUsed[1] ?? 0, 0, "declined: no slot");

  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.target], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "hit" } });
  await tick();
  const [second] = t.open();
  t.dm.send({ type: "act.onhit", messageId: second.id, choices: ["smite"], smiteSlot: 1 });
  await tick();
  assert.equal(t.sheet().runtime.slotsUsed[1], 1, "chosen: one 1st-level slot");
  const card = t.cards().at(-1)!;
  const part = card.action.damage.find((item) => item.part.label?.startsWith("신성한 강타"))!;
  assert.equal(part.dice.length, 2, "2d8 from a 1st-level slot");
  assert.equal(part.part.type, "광휘");
});

test("R63: an offer that was not made is ignored rather than trusted (D198)", async () => {
  const t = await table("fighter", 5);
  const weapon = t.derived.attacks.find((attack) => attack.itemId)!;
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.target], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "hit" } });
  await tick();
  // The soldier background's 야만적 공격자 is the fighter's only offer.
  const [prompt] = t.open();
  assert.deepEqual(prompt.prompt!.onHit!.offers.map((offer) => offer.key), ["savage"]);
  t.dm.send({ type: "act.onhit", messageId: prompt.id, choices: ["sneak", "smite"], smiteSlot: 1 });
  await tick();
  const [card] = t.cards();
  assert.equal(card.action.damage.length, 1, "neither 암습 nor a smite the sheet does not have");
});

test("R63: the target's reaction is asked first, then the attacker (D198)", async () => {
  const guard: GuardOffer = { feature: "시험 반응", ruleKey: "test", notes: [], facts: [], payments: [], scope: () => undefined };
  const t = await table("rogue", 5, { targetPc: true, guards: [guard] });
  const blade = t.derived.attacks.find((attack) => hasSneakAttack(t.derived, attack))!;
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.target], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "hit" } });
  await tick();
  const reaction = t.host.archive.find((message) => message.type === "prompt" && message.prompt?.kind === "guard")!;
  assert.ok(reaction, "the defender is asked");
  assert.equal(t.open().length, 0, "the attacker is not asked yet");
  t.dm.send({ type: "act.decline", messageId: reaction.id });
  await tick();
  const [prompt] = t.open();
  assert.ok(prompt, "the swing still landed, so now the attacker is asked");
  t.dm.send({ type: "act.onhit", messageId: prompt.id, choices: ["sneak"] });
  await tick();
  assert.equal(t.cards().length, 1);
});

test("R63: a palette edit keeps what was chosen and does not ask again (D198)", async () => {
  const t = await table("rogue", 5);
  const blade = t.derived.attacks.find((attack) => hasSneakAttack(t.derived, attack))!;
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.target], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "hit" } });
  await tick();
  t.dm.send({ type: "act.onhit", messageId: t.open()[0].id, choices: ["sneak"] });
  await tick();
  const card = t.cards()[0];
  t.dm.send({ type: "act.adjust", messageId: card.id, overrides: { outcome: "crit" } });
  await tick();
  assert.equal(t.prompts().length, 1, "no second window");
  const latest = t.cards().at(-1)!;
  assert.equal(latest.action.outcome, "crit");
  assert.equal(latest.action.damage.find((part) => part.part.label === "암습")!.dice.length, 6, "암습 stays, now doubled");
});

test("R63: the dice a card showed follow their part, wherever new parts land (D198)", () => {
  const previous = [
    { part: { formula: "1d8+3", type: "관통", label: "레이피어" }, dice: [6], rolled: 9, adjusted: 9, adjustment: null },
  ] as DamageResult[];
  const parts = [{ formula: "1d8+3", type: "관통", label: "레이피어" }, { formula: "3d6", type: "관통", label: "암습" }];
  assert.deepEqual(carryDice(previous, parts), [[6], undefined]);
  // 야만적 공격자 chosen after the hit rolls the weapon dice once more against the kept ones and takes the better.
  const target: Combatant = { id: "t", name: "t", kind: "npc", ac: 10, hp: { current: 99, max: 99, temp: 0 }, conditions: [], defenses: { resistances: [], immunities: [], vulnerabilities: [] }, conSave: 0, effects: [] };
  const high = { d: (sides: number) => sides };
  const kept = applyDamage(target, [parts[0]], high, { fixed: [[2]], savage: true });
  assert.deepEqual(kept.damage[0].dice, [2], "a plain re-resolution never rerolls what was shown");
  const chosen = applyDamage(target, [parts[0]], high, { fixed: [[2]], savage: true, rerollOnce: true });
  assert.deepEqual(chosen.damage[0].dice, [8], "chosen now, it rolls once and keeps the better");
});

test("R63: withHitChoices adds the chosen keys to what was already declared (D198)", () => {
  assert.deepEqual(withHitChoices({ offHand: true, contracts: ["feature:frenzy"] }, { choices: ["sneak", "feat:charger"], facts: ["charged"] }), { offHand: true, sneak: true, contracts: ["feature:frenzy", "feat:charger"], facts: ["charged"] });
  assert.deepEqual(withHitChoices({}, { choices: ["smite"] }), {}, "a smite without a slot is nothing");
});
