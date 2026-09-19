/**
 * R37 (ROLL20_TABLE_SPEC.md D177): the `d20.roll` slot, finished.
 *
 * R35 opened it on saving throws, which gave 불굴 and 어둠의 존재의 행운 a seam. 전술적 사고 and 비할 데 없는 기량 read
 * `families: ["ability-check"]`, and the app rolled ability checks with nowhere for a contract to reach them. Now an
 * official action's failed check asks its roller — the actor for their own check, the *target* for the saving throw
 * 붙잡기 and 밀치기 force — and the contract's `roll.modify` resolves the whole action again, marks and all.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { addItem } from "../../client/character/play";
import { payContract, pcRescues } from "../../client/rules/contractUse";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function table(spec: { classes?: string; level?: number } = {}) {
  const hub = new MemoryHub();
  const base = newCampaign("R37 시험", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R37AAA" };
  const dice = { value: 0.02 };
  const cat = catalog();
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, cat)),
    pcRescues: (entry, family, outcome) => pcRescues(entry, derivedOf(entry, cat), cat, family, outcome),
    pcPayContract: (entry, payments, outcome) => payContract(entry.runtime, derivedOf(entry, cat), payments, outcome) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R37AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R37AAA", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "전사", classes: spec.classes ?? "fighter", level: spec.level ?? 4, abilities: { dex: 8, str: 8 } });
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
  const me = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  const ogreRef = { entryId: ogre.id, pageId: scene.id, tokenId: ogreToken.id };
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const prompt = () => [...host.archive].reverse().find((message) => message.prompt?.kind === "rescue" && !message.prompt.outcome);
  const actCard = () => [...host.archive].reverse().find((message) => message.type === "act");
  return { host, dm, alice, me, ogreRef, pcToken, sheet, prompt, actCard, dice };
}

test("rescue: a failed ability check asks its roller, and 전술적 사고 adds its d10 (D177)", async () => {
  const { alice, me, sheet, prompt, actCard, dice } = await table();
  alice.send({ type: "act.action", actor: me, kind: "hide" });
  await tick();
  const first = actCard()!;
  assert.equal(first.act!.check!.success, false, `${first.act!.check!.total} vs DC ${first.act!.check!.dc}`);
  const ask = prompt()!;
  assert.ok(ask, "the check's own roller is asked");
  assert.deepEqual(ask.prompt!.rescue!.features, ["전술적 사고"]);
  dice.value = 0.95;
  alice.send({ type: "act.rescue", messageId: ask.id, feature: "전술적 사고" });
  await tick();
  const again = actCard()!;
  assert.equal(again.id, first.id, "the same card is superseded, not a second one posted");
  assert.equal(again.act!.check!.rescue, "전술적 사고");
  assert.ok(again.act!.check!.total > first.act!.check!.total, `${first.act!.check!.total} → ${again.act!.check!.total}`);
  assert.equal(again.act!.check!.success, true);
  // The contract's payment is `onlyOn: success`, and it worked, so the pool is spent.
  assert.equal(sheet().runtime.resourcesUsed["resource.fighter.second-wind"], 1);
});

test("rescue: a rescue that still fails costs nothing, because the contract says so (D177)", async () => {
  const { alice, me, sheet, prompt, actCard, dice } = await table();
  alice.send({ type: "act.action", actor: me, kind: "hide" });
  await tick();
  const ask = prompt()!;
  dice.value = 0.02;
  alice.send({ type: "act.rescue", messageId: ask.id, feature: "전술적 사고" });
  await tick();
  assert.equal(actCard()!.act!.check!.success, false, "still short of DC 15");
  assert.equal(sheet().runtime.resourcesUsed["resource.fighter.second-wind"] ?? 0, 0, "전술적 사고 charges nothing for a rescue that did not work");
});

test("rescue: 붙잡기's roll is the target's save, so the target is asked — and 붙잡힘 comes off (D177)", async () => {
  const { dm, alice, me, ogreRef, pcToken, sheet, prompt, actCard, dice } = await table({ level: 9 });
  // The ogre grapples the character: the save is the character's, and it fails.
  dm.send({ type: "act.action", actor: ogreRef, kind: "grapple", target: me });
  await tick();
  const first = actCard()!;
  assert.equal(first.act!.check!.success, false);
  assert.ok(first.act!.targetMarks.includes("붙잡힘"), JSON.stringify(first.act!.targetMarks));
  const held = () => (sheet().runtime.conditions ?? []).includes("붙잡힘");
  assert.equal(held(), true, JSON.stringify(sheet().runtime.conditions));
  const ask = prompt()!;
  assert.ok(ask, "the question goes to whoever rolled the save");
  assert.equal(ask.prompt!.reactor.entryId, sheet().id);
  const feature = ask.prompt!.rescue!.features.find((name) => name.startsWith("불굴"))!;
  assert.ok(feature, JSON.stringify(ask.prompt!.rescue!.features));
  dice.value = 0.95;
  alice.send({ type: "act.rescue", messageId: ask.id, feature });
  await tick();
  assert.equal(actCard()!.act!.check!.success, true);
  assert.equal(held(), false, "the grapple that no longer lands leaves nothing behind");
  assert.equal(sheet().runtime.resourcesUsed["resource.fighter.indomitable"], 1, "불굴 charges either way");
  void pcToken;
});

test("rescue: no contract, no question (D177)", async () => {
  const { alice, me, prompt, actCard } = await table({ classes: "wizard", level: 4 });
  alice.send({ type: "act.action", actor: me, kind: "hide" });
  await tick();
  assert.equal(actCard()!.act!.check!.success, false);
  assert.equal(prompt(), undefined, "a wizard has no d20 rescue contract");
});

test("rescue: a missed attack is a failed d20 too, and 비할 데 없는 기량 adds its d12 (D177)", async () => {
  const hub = new MemoryHub();
  const base = newCampaign("R37 명중", { userId: "dm", displayName: "DM" });
  const campaign = { ...base, joinCode: "R37BBB" };
  // A d20 of 5: a miss, but not the natural 1 that no contract can rescue.
  const dice = { value: 0.2 };
  const cat = catalog();
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, cat)), pcConcentrationKey,
    pcAttackSpec: (entry, attackId, riders) => pcAttackSpec(entry, derivedOf(entry, cat), attackId, riders),
    pcStats: (entry) => pcStats(derivedOf(entry, cat)),
    pcRescues: (entry, family, outcome) => pcRescues(entry, derivedOf(entry, cat), cat, family, outcome),
    pcPayContract: (entry, payments, outcome) => payContract(entry.runtime, derivedOf(entry, cat), payments, outcome) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R37BBB", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R37BBB", seat: "a" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "바드", classes: "bard", level: 14, abilities: { dex: 14, cha: 18 } }, { "class.2.subclass": ["dnd.srd521.subclass.bard.college-of-lore"] });
  let runtime = initialRuntime(made.derived);
  runtime = addItem(runtime, { itemId: "dnd.srd521.item.weapon.shortsword", name: "소검" });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, runtime, { owner: "alice" });
  alice.send({ type: "journal.put", entry: pc });
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  const derived = derivedOf(host.journal.find((entry) => entry.id === pc.id) as JournalCharacter, cat);
  const sword = derived.attacks.find((attack) => attack.name === "소검")!;
  const card = () => [...host.archive].reverse().find((message) => message.type === "action");
  const prompt = () => [...host.archive].reverse().find((message) => message.prompt?.kind === "rescue" && !message.prompt.outcome);
  alice.send({ type: "act.attack", attacker: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, targets: [{ pageId: scene.id, tokenId: ogreToken.id }], attack: { source: "weapon", attackId: sword.id } });
  await tick();
  const missed = card()!;
  assert.equal(missed.action!.outcome, "miss", `${missed.action!.attackTotal} vs AC ${missed.action!.targetAc}`);
  // An NPC's hit points live on its token's first bar, not on a sheet.
  const ogreHp = () => dm.snapshot!.pages.find((page) => page.id === scene.id)!.tokens.find((token) => token.id === ogreToken.id)!.bars[0].value;
  const before = ogreHp();
  const ask = prompt()!;
  assert.ok(ask, host.archive.map((message) => message.content).join("\n"));
  assert.deepEqual(ask.prompt!.rescue!.features, ["비할 데 없는 기량"]);
  dice.value = 0.95;
  alice.send({ type: "act.rescue", messageId: ask.id, feature: "비할 데 없는 기량" });
  await tick();
  const landed = card()!;
  assert.equal(landed.supersedes, missed.id, "the new card replaces the old one, as the DM palette's edits do");
  assert.ok(landed.action!.attackTotal > missed.action!.attackTotal, `${missed.action!.attackTotal} → ${landed.action!.attackTotal}`);
  assert.equal(landed.action!.outcome, "hit");
  assert.ok(landed.action!.damageTotal > 0, "the attack that now lands rolls its damage");
  assert.ok(ogreHp()! < before!, `and it is applied: ${before} → ${ogreHp()}`);
  const sheet = host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  assert.equal(sheet.runtime.resourcesUsed["resource.bard.bardic-inspiration"], 1, "it worked, so the inspiration die is spent");
});

test("rescue: all four rescue contracts can now fire (R37's end criterion)", () => {
  const cat = catalog();
  const owners = {
    "fighter.indomitable": { made: build({ name: "f", classes: "fighter", level: 9 }), family: "saving-throw" as const },
    "fighter.tactical-mind": { made: build({ name: "f", classes: "fighter", level: 9 }), family: "ability-check" as const },
    "bard.college-of-lore.peerless-skill": { made: build({ name: "b", classes: "bard", level: 14 }, { "class.2.subclass": ["dnd.srd521.subclass.bard.college-of-lore"] }), family: "attack-roll" as const },
    "warlock.fiend.dark-ones-own-luck": { made: build({ name: "w", classes: "warlock", level: 6 }, { "class.2.subclass": ["dnd.srd521.subclass.warlock.fiend-patron"] }), family: "saving-throw" as const },
  };
  for (const [key, { made, family }] of Object.entries(owners)) {
    const offers = pcRescues({ runtime: initialRuntime(made.derived) } as never as JournalCharacter, made.derived, cat, family, "failure");
    assert.ok(offers.some((offer) => offer.ruleKey === key), `${key} (${family}): ${offers.map((offer) => offer.ruleKey).join(",") || "없음"}`);
  }
  // Every family the four contracts name is one the host now opens the slot for.
  const named = new Set([...cat.contracts.values()].flatMap((contract) => contract.interceptors.filter((item) => item.slot === "d20.roll").flatMap((item) => item.families)));
  assert.deepEqual([...named].sort(), ["ability-check", "attack-roll", "saving-throw"]);
});
