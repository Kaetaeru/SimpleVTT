/**
 * R35 (ROLL20_TABLE_SPEC.md D174–D175): the `d20.roll` slot is open.
 *
 * R34 could find the four rescue contracts (불굴, 전술적 사고, 탁월한 기술, 어둠의 존재의 행운) but nothing could
 * fire them: the host rolled a save, applied the damage and moved on. Now a player character whose save fails is
 * asked, and pressing the button runs the contract's own `roll.modify` — the die it names is rerolled, the dice it
 * adds are rolled, and the whole target row is resolved again from the new total, damage and all.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { characterScope, planRollModify } from "../../client/rules/contract";
import { payContract, pcRescues } from "../../client/rules/contractUse";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A table with one fiend-hunting wizard and one fighter who can be breathed on. */
async function table(level = 9) {
  const hub = new MemoryHub();
  const base = newCampaign("R35 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R35AAA" };
  const dice = { value: 0.05 };
  const cat = catalog();
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, cat)),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, cat), cat, spellId, method),
    pcRescues: (entry, family, outcome) => pcRescues(entry, derivedOf(entry, cat), cat, family, outcome),
    pcPayContract: (entry, payments, outcome) => payContract(entry.runtime, derivedOf(entry, cat), payments, outcome) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R35AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R35AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "전사", classes: "fighter", level, abilities: { con: 10, dex: 8 } });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived), { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  const dragon = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.adult-red-dragon")!);
  dm.send({ type: "journal.put", entry: dragon });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const dragonToken = tokenForNpc(dragon);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: dragonToken });
  await tick();
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const breathe = () => dm.send({ type: "act.npcSave", actor: { entryId: dragon.id, pageId: scene.id, tokenId: dragonToken.id }, actionName: "화염 브레스", targets: [{ pageId: scene.id, tokenId: pcToken.id }] });
  const prompt = () => [...host.archive].reverse().find((message) => message.prompt?.kind === "rescue" && !message.prompt.outcome);
  const spellCard = () => [...host.archive].reverse().find((message) => message.type === "spell" && message.spell?.targets.some((row) => row.target.id === pc.id));
  return { host, dm, alice, pc, made, sheet, breathe, prompt, spellCard, dice, cat };
}

test("rescue: a failed save asks the player, and 불굴 rerolls it from the contract (D174)", async () => {
  const { host, alice, sheet, breathe, prompt, spellCard, dice } = await table(9);
  assert.ok(sheet().runtime.hp.current > 0);
  const before = sheet().runtime.hp.current;
  breathe();
  await tick();
  const card = spellCard()!;
  const row = card.spell!.targets.find((item) => item.target.id === sheet().id)!;
  assert.equal(row.save?.success, false, "a d20 of 1 fails");
  assert.ok(sheet().runtime.hp.current < before, "and the breath lands");
  const hurt = sheet().runtime.hp.current;
  const ask = prompt()!;
  assert.ok(ask, host.archive.map((message) => message.content).join("\n"));
  assert.equal(ask.prompt!.rescue!.features.length, 1, JSON.stringify(ask.prompt!.rescue));
  const feature = ask.prompt!.rescue!.features[0];
  assert.ok(feature.startsWith("불굴"), feature);
  // The reroll rolls high; the save now succeeds and half the damage comes back.
  dice.value = 0.95;
  alice.send({ type: "act.rescue", messageId: ask.id, feature });
  await tick();
  const redone = [...host.archive].reverse().find((message) => message.type === "spell" && message.supersedes === undefined && message.id === card.id) ?? spellCard()!;
  const after = redone.spell!.targets.find((item) => item.target.id === sheet().id)!;
  assert.equal(after.save?.success, true, `${after.save?.total} vs DC ${after.save?.dc}`);
  assert.equal(after.save?.rescue, feature);
  assert.ok(sheet().runtime.hp.current > hurt, `${hurt} → ${sheet().runtime.hp.current}: the failed save's damage is taken back and half applied`);
  // The pool was spent, and the same prompt cannot be pressed twice.
  assert.equal(sheet().runtime.resourcesUsed["resource.fighter.indomitable"], 1);
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "act.rescue", messageId: ask.id, feature });
  await tick();
  assert.ok(refusals.length, "a spent prompt is refused");
});

test("rescue: a feature you do not have is refused, and no contract means no question (D174)", async () => {
  const { alice, breathe, prompt } = await table(9);
  breathe();
  await tick();
  const ask = prompt()!;
  assert.ok(ask);
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  alice.send({ type: "act.rescue", messageId: ask.id, feature: "없는 특성" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("특성")), refusals.join("|"));
  // A level-1 fighter has no 불굴, so their failed save is never interrupted by a question.
  const low = await table(1);
  low.breathe();
  await tick();
  assert.equal(low.prompt(), undefined, "no contract, no question");
});

test("rescue: planRollModify runs the contract's own operations (D175)", () => {
  const cat = catalog();
  const fighter = build({ name: "f", classes: "fighter", level: 9 }).derived;
  const indomitable = cat.contractFor("fighter.indomitable")!.interceptors[0];
  // 1d20 reroll → 17, then + the fighter's class level (9).
  const scripted = (...values: number[]) => ({ d: () => values.shift() ?? 1 });
  const plan = planRollModify(indomitable.operations, characterScope(fighter), scripted(17));
  assert.equal(plan.d20, 17);
  assert.equal(plan.delta, 9, "the flat add is the class level, read from the character");
  assert.deepEqual(plan.parts, ["1d20 재굴림 → 17", "+9"]);
  // 전술적 사고 adds a d10 and never replaces the die.
  const tactical = cat.contractFor("fighter.tactical-mind")!.interceptors[0];
  const added = planRollModify(tactical.operations, characterScope(fighter), scripted(6));
  assert.equal(added.d20, undefined);
  assert.equal(added.delta, 6);
  // V4l (D274): 날카로운 말 takes the bard's own inspiration die off the roll — the die size is an expression, so a
  // 14th-level bard's is a d10.
  const cutting = cat.contractFor("bard.college-of-lore.cutting-words")!.interceptors[0];
  const lore = build({ name: "b", classes: "bard", level: 14 }, { "class.2.subclass": ["dnd.srd521.subclass.bard.college-of-lore"] }).derived;
  assert.deepEqual(planRollModify(cutting.operations, characterScope(lore), scripted(5)), { delta: -5, parts: ["−1d10 = 5"] });
});

test("rescue: a rescue that fails costs nothing when the contract says so (D175)", () => {
  const bard = build({ name: "b", classes: "bard", level: 14 }, { "class.2.subclass": ["dnd.srd521.subclass.bard.college-of-lore"] });
  const pool = "resource.bard.bardic-inspiration";
  const payments = catalog().contractFor("bard.college-of-lore.peerless-skill")!.payments;
  assert.equal(payments[0].onlyOn, "success");
  const runtime = initialRuntime(bard.derived);
  assert.equal(payContract(runtime, bard.derived, payments, "failure")!.resourcesUsed[pool] ?? 0, 0, "탁월한 기술 charges nothing for a rescue that did not work");
  assert.equal(payContract(runtime, bard.derived, payments, "success")!.resourcesUsed[pool], 1);
  // 불굴 charges either way.
  const fighter = build({ name: "f", classes: "fighter", level: 9 });
  const always = catalog().contractFor("fighter.indomitable")!.payments;
  assert.equal(always[0].onlyOn, undefined);
  assert.equal(payContract(initialRuntime(fighter.derived), fighter.derived, always, "failure")!.resourcesUsed["resource.fighter.indomitable"], 1);
});

test("rescue: an empty pool is never offered (D174)", async () => {
  const { host, alice, sheet, breathe, prompt } = await table(9);
  const live = sheet();
  alice.send({ type: "journal.put", entry: { ...live, runtime: { ...live.runtime, resourcesUsed: { ...live.runtime.resourcesUsed, "resource.fighter.indomitable": 1 }, updatedAt: new Date(Date.now() + 5000).toISOString() } } });
  await tick();
  assert.equal(sheet().runtime.resourcesUsed["resource.fighter.indomitable"], 1);
  breathe();
  await tick();
  assert.equal(prompt(), undefined, "a button that would be refused is never shown");
  void host;
});
