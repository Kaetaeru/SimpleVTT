/**
 * R54 (ROLL20_TABLE_SPEC.md D189): the reaction windows the content declares for itself.
 *
 * `ReactionPrompt.kind` was a closed list, so the only reactions a player was ever offered were the ones the host
 * knew by name. 공격 흘리기 — a monk's whole defence — had to be declared out loud and worked out by hand, even
 * though the app knew the attack had hit, knew the monk's level, and had already held the card once for the Shield
 * spell. An interceptor timed `reaction.window` opens that same window for whatever the content wrote.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { guardHint, pcGuards, rollGuard } from "../../client/rules/contractReactions";
import { payContract } from "../../client/rules/contractUse";
import { derivedOf, npcAttackSpec, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { pcStats } from "../../client/rules/actions";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("R54: 공격 흘리기 offers itself when an attack lands, with its own number (D189)", () => {
  const made = build({ name: "몽크", classes: "monk", level: 5, abilities: { dex: 16 } });
  const entry = { runtime: initialRuntime(made.derived) };
  const offers = pcGuards(entry, made.derived, catalog(), "attack.hit-self");
  assert.deepEqual(offers.map((offer) => offer.feature), ["공격 흘리기"]);
  // 1d10 + 민첩 수정치 + 몽크 레벨.
  const expected = made.derived.abilities.dex.modifier + 5;
  assert.equal(offers[0].reduce, `1d10+${expected}`);
  assert.equal(offers[0].acBonus, undefined, "this one soaks damage rather than raising AC");
  assert.ok(guardHint(offers[0]).startsWith(`피해 −1d10+${expected}`), guardHint(offers[0]));
  assert.ok(guardHint(offers[0]).includes("타격·관통·참격"), guardHint(offers[0]));
  // A fighter has no such contract, so no window opens for them.
  const fighter = build({ name: "전사", classes: "fighter", level: 5 });
  assert.deepEqual(pcGuards({ runtime: initialRuntime(fighter.derived) }, fighter.derived, catalog(), "attack.hit-self"), []);
});

test("R54: the formula is rolled with the host's own roller and never goes negative (D189)", () => {
  assert.equal(rollGuard("1d10+8", () => 0.999), 18);
  assert.equal(rollGuard("1d10+8", () => 0), 9);
  assert.equal(rollGuard("2d6", () => 0.999), 12);
  assert.equal(rollGuard("1d4-10", () => 0), 0, "a reaction cannot heal by soaking");
});

/** A monk under attack from an ogre, with the reaction window wired exactly as the app wires it. */
async function table(level = 5, classes = "monk") {
  const hub = new MemoryHub();
  const base = newCampaign("R54 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R54AAA" };
  const cat = catalog();
  const rolls: number[] = [];
  const dice = { value: 0.9 };
  const random = () => { rolls.push(dice.value); return dice.value; };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcAttackSpec: (entry, attackId, riders) => pcAttackSpec(entry, derivedOf(entry, cat), attackId, riders, cat),
    pcGuards: (entry, trigger) => pcGuards(entry, derivedOf(entry, cat), cat, trigger),
    pcPayContract: (entry, payments, outcome) => payContract(entry.runtime, derivedOf(entry, cat), payments, outcome),
    pcStats: (entry) => pcStats(derivedOf(entry, cat)) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R54AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R54AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "몽크", classes, level, abilities: { dex: 16, wis: 14 } });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived), { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const swing = npcAttackSpec(ogre, ogre.statBlock.actions.find((action) => action.kind === "attack")!.name)!;
  const me = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  const ogreRef = { entryId: ogre.id, pageId: scene.id, tokenId: ogreToken.id };
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const prompt = () => [...host.archive].reverse().find((message) => message.type === "prompt" && !message.prompt?.outcome);
  const card = () => [...host.archive].reverse().find((message) => message.action)?.action;
  return { host, dm, alice, me, ogreRef, sheet, prompt, card, dice, swing, ogre };
}

test("R54: an attack that lands on the monk opens the window, not a sentence (D189)", async () => {
  const { dm, me, ogreRef, prompt, card, ogre } = await table();
  dm.send({ type: "act.attack", actor: ogreRef, attacker: ogreRef, targets: [me], attack: { source: "npc", actionName: ogre.statBlock.actions.find((action) => action.kind === "attack")!.name } } as never);
  await tick();
  const ask = prompt();
  assert.ok(ask, "the card is held until the monk answers");
  assert.equal(ask!.prompt!.kind, "guard");
  assert.deepEqual(ask!.prompt!.guard!.features.map((feature) => feature.name), ["공격 흘리기"]);
  assert.equal(ask!.prompt!.guard!.shield, false, "a monk has no Shield spell, so only their own reaction is offered");
  assert.equal(card(), undefined, "and nothing has been applied yet");
});

test("R54: taking the reaction takes the damage off the card and spends the reaction (D189)", async () => {
  const { alice, dm, me, ogreRef, prompt, card, sheet, ogre, dice } = await table();
  const before = sheet().runtime.hp.current;
  dm.send({ type: "act.attack", actor: ogreRef, attacker: ogreRef, targets: [me], attack: { source: "npc", actionName: ogre.statBlock.actions.find((action) => action.kind === "attack")!.name } } as never);
  await tick();
  const ask = prompt()!;
  dice.value = 0.99;
  alice.send({ type: "act.guard", messageId: ask.id, feature: "공격 흘리기" });
  await tick();
  const applied = card();
  assert.ok(applied, "the held card is released");
  const soaked = before - applied!.hpAfter;
  const raw = applied!.damage.reduce((sum, part) => sum + part.adjusted, 0);
  assert.ok(soaked < raw, `${soaked} taken of ${raw} rolled`);
  assert.equal(sheet().runtime.hp.current, applied!.hpAfter, "and the sheet agrees with the card");
});

test("R54: declining leaves the attack exactly as it was rolled (D189)", async () => {
  const { alice, dm, me, ogreRef, prompt, card, sheet, ogre } = await table();
  const before = sheet().runtime.hp.current;
  dm.send({ type: "act.attack", actor: ogreRef, attacker: ogreRef, targets: [me], attack: { source: "npc", actionName: ogre.statBlock.actions.find((action) => action.kind === "attack")!.name } } as never);
  await tick();
  alice.send({ type: "act.decline", messageId: prompt()!.id });
  await tick();
  const applied = card()!;
  assert.equal(before - applied.hpAfter, applied.damage.reduce((sum, part) => sum + part.adjusted, 0), "every point lands");
});

test("R95: 기묘한 회피 halves the damage of the hit that landed on the rogue (D230)", async () => {
  const { alice, dm, me, ogreRef, prompt, card, ogre } = await table(5, "rogue");
  dm.send({ type: "act.attack", actor: ogreRef, attacker: ogreRef, targets: [me], attack: { source: "npc", actionName: ogre.statBlock.actions.find((action) => action.kind === "attack")!.name }, overrides: { outcome: "hit" } } as never);
  await tick();
  const ask = prompt()!;
  assert.deepEqual(ask.prompt!.guard!.features.map((feature) => [feature.name, feature.hint]), [["기묘한 회피", "피해 절반"]]);
  alice.send({ type: "act.guard", messageId: ask.id, feature: "기묘한 회피" });
  await tick();
  const applied = card()!;
  const raw = applied.damage.reduce((sum, part) => sum + part.adjusted, 0);
  assert.equal(applied.damageTotal, Math.floor(raw / 2), JSON.stringify([applied.damageTotal, raw]));
});

test("R95: 회피술 — a Dexterity save for half damage takes nothing on a success and half on a failure (D230)", async () => {
  const { pcSpell, resolveSpell } = await import("../../client/rules/spellcast");
  const { diceFrom } = await import("../../client/rules/resolve");
  const rogue = build({ name: "로그", classes: "rogue", level: 7, abilities: { dex: 16 } });
  assert.equal(rogue.derived.evasion, true);
  const wizard = build({ name: "위저드", classes: "wizard", level: 5 }, { "class.0.spells": ["dnd.srd521.spell.fireball"] });
  const wizardEntry = { runtime: initialRuntime(wizard.derived) } as never;
  const cast = pcSpell(wizardEntry, wizard.derived, catalog(), "dnd.srd521.spell.fireball", { kind: "slot", level: 3 })!;
  const rogueEntry = { id: "r", name: "로그", runtime: initialRuntime(rogue.derived) } as never;
  const target = { combatant: pcCombatant(rogueEntry, rogue.derived), stats: pcStats(rogue.derived) };
  const roll = (value: number) => resolveSpell({ caster: pcCombatant(wizardEntry, wizard.derived), casterStats: cast.casterStats, spec: cast.spec, targets: [target], dice: diceFrom(() => value), fixedDamage: [[6, 6, 6, 6, 6, 6, 6, 6]] }).targets[0];
  const saved = roll(0.99);
  assert.equal(saved.save?.success, true);
  assert.equal(saved.damage?.damageTotal, 0, "success: nothing");
  const failed = roll(0.01);
  assert.equal(failed.save?.success, false);
  assert.equal(failed.damage?.damageTotal, 24, "failure: half of 48");
});
