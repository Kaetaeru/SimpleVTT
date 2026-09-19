/**
 * V0.9 V4 (ROLL20_TABLE_SPEC.md D263~): the player-seat re-audit (docs/design/v3/V4_AUDIT.md) — what a player used to
 * be told to do by hand, now done at the table.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { activateFeature } from "../../client/character/activate";
import { deriveCharacter } from "../../client/character/derive";
import { longRest } from "../../client/character/play";
import { initialRuntime, type CharacterRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { featureActivation } from "../../client/rules/activation";
import { contractDurations } from "../../client/rules/contractActivation";
import { characterScope } from "../../client/rules/contract";
import { tableOutcome } from "../../client/rules/contractTable";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A table with the given characters and monsters on one scene; the DM seat does everything. */
async function table(pcs: Array<{ classes: string; level: number; choices?: Record<string, string[]>; runtime?: (runtime: CharacterRuntime) => CharacterRuntime; abilities?: Record<string, number>; species?: string }>, npcs: Array<Record<string, unknown>>, random: () => number = () => 0.5) {
  const cat = catalog();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("V4", { userId: "dm", displayName: "DM" }), joinCode: "V4AAAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "V4AAAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "전장", 0);
  dm.send({ type: "page.put", page: scene });
  const made = pcs.map((pc, index) => build({ name: `PC${index}`, classes: pc.classes, level: pc.level, abilities: { con: 14, ...(pc.abilities ?? {}) }, ...(pc.species ? { species: pc.species } : {}), choices: pc.choices ?? {} }, pc.choices ?? {}));
  const sheets = made.map((one, index) => newJournalCharacter(campaign.id, "dm", one.source, (pcs[index].runtime ?? ((runtime) => runtime))(initialRuntime(one.derived))));
  const monsters = npcs.map((json) => newJournalNpc(campaign.id, "dm", (parseCustomMonster(JSON.stringify(json)) as { monster: Parameters<typeof newJournalNpc>[2] }).monster));
  for (const entry of [...sheets, ...monsters]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = [...sheets.map((entry) => tokenForCharacter(entry)), ...monsters.map((entry) => tokenForNpc(entry))];
  for (const token of tokens) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const ref = (index: number) => ({ entryId: [...sheets, ...monsters][index].id, pageId: scene.id, tokenId: tokens[index].id });
  const entry = (index: number) => host.journal.find((item) => item.id === [...sheets, ...monsters][index].id)!;
  return { host, dm, scene, made, sheets, monsters, ref, entry, cat };
}

const dummy = (name: string, hp: number, extra: Record<string, unknown> = {}) => ({ name, ac: 10, hp, abilities: { str: 10, dex: 10, con: 10, int: 1, wis: 1, cha: 1 }, actions: [], ...extra });

test("V4a: a use's damage lands on its targets with the save, and healing aimed at others no longer heals the user (D263)", async () => {
  // Every die rolls low and the zombie fails its save: 신성한 불꽃 at cleric 5 is 1d8 + WIS radiant.
  const t = await table([{ classes: "cleric", level: 5, abilities: { wis: 16 } }], [dummy("좀비", 60)], () => 0);
  const cleric = t.made[0].derived;
  const outcome = tableOutcome(cleric, t.cat, "cleric.channel-divinity#divine-spark-harm")!;
  assert.deepEqual(outcome.strikes?.map((strike) => [strike.formula, strike.save?.ability, strike.save?.dc]), [[`1d8+${cleric.abilities.wis.modifier}`, "con", 8 + cleric.proficiencyBonus + cleric.abilities.wis.modifier]]);
  t.dm.send({ type: "act.contract", actor: t.ref(0), ruleKey: "cleric.channel-divinity#divine-spark-harm", targets: [t.ref(1)] });
  await tick();
  const zombieHp = t.host.pageList.find((page) => page.id === t.scene.id)!.tokens.find((token) => token.id === t.ref(1).tokenId)!.bars[0].value;
  assert.equal(zombieHp, 60 - (1 + cleric.abilities.wis.modifier), JSON.stringify(t.host.archive.slice(-2).map((message) => message.content)));
  // The healing half is the table's: the sheet's own use has no heal for the user any more.
  const heal = cleric.features.find((feature) => feature.name === "신성한 불꽃 (치유)")!;
  assert.equal(featureActivation(heal, cleric, contractDurations(t.cat, characterScope(cleric)))?.heal, undefined);
});

test("V4a: 생명 보존 shares its hit points out, the most hurt first, nobody past half (D263)", async () => {
  const hurt = (current: number) => (runtime: CharacterRuntime) => ({ ...runtime, hp: { ...runtime.hp, current } });
  const t = await table([
    { classes: "cleric", level: 3, choices: { "class.2.subclass": ["dnd.srd521.subclass.cleric.life-domain"] } },
    { classes: "fighter", level: 3, runtime: hurt(1) },
    { classes: "fighter", level: 3, runtime: hurt(10) },
  ], []);
  const half = (index: number) => Math.floor(t.made[index].derived.hp.max / 2);
  t.dm.send({ type: "act.contract", actor: t.ref(0), ruleKey: "cleric.life-domain.preserve-life", targets: [t.ref(1), t.ref(2)] });
  await tick();
  const hp = (index: number) => (t.entry(index) as { runtime: CharacterRuntime }).runtime.hp.current;
  const first = Math.min(15, half(1) - 1);
  assert.equal(hp(1), 1 + first, JSON.stringify(t.host.archive.slice(-1).map((message) => message.content)));
  assert.equal(hp(2), 10 + Math.max(0, Math.min(15 - first, half(2) - 10)));
});

test("V4a: 영감의 샘 spends the lowest slot for one inspiration; 더 강한 신성 개입 locks the pool for rolled long rests (D263)", async () => {
  const cat = catalog();
  const bard = build({ name: "바드", classes: "bard", level: 5 });
  let sheet: CharacterRuntime = { ...initialRuntime(bard.derived), resourcesUsed: { "resource.bard.bardic-inspiration": 2 } };
  const deps = (made: typeof bard) => ({ source: made.source, catalog: cat, derived: made.derived, get runtime() { return sheet; }, rollDice: async (spec: { label: string; formula: string }) => ({ id: "r", at: "", label: spec.label, formula: spec.formula, total: 3, dice: [], modifier: 0 }), save: (update: (current: CharacterRuntime) => CharacterRuntime) => { sheet = update(sheet); } });
  const font = bard.derived.features.find((feature) => feature.name === "영감의 샘: 슬롯으로 회복")!;
  assert.ok(font, bard.derived.features.map((feature) => feature.name).join(", "));
  assert.equal(await activateFeature(font, deps(bard) as Parameters<typeof activateFeature>[1]), "done");
  assert.equal(sheet.slotsUsed[1], 1);
  assert.equal(sheet.resourcesUsed["resource.bard.bardic-inspiration"], 1);

  const cleric = build({ name: "클레릭", classes: "cleric", level: 20 });
  sheet = initialRuntime(cleric.derived);
  const wish = cleric.derived.features.find((feature) => feature.name === "더 강한 신성 개입: 소원")!;
  assert.equal(await activateFeature(wish, deps(cleric) as Parameters<typeof activateFeature>[1]), "done");
  assert.equal(sheet.resourceLockouts?.["resource.cleric.divine-intervention"], 3);
  for (let rest = 0; rest < 3; rest += 1) {
    sheet = longRest(sheet, cleric.derived);
    assert.ok((sheet.resourcesUsed["resource.cleric.divine-intervention"] ?? 0) > 0, `still locked after rest ${rest + 1}`);
  }
  sheet = longRest(sheet, cleric.derived);
  assert.equal(sheet.resourcesUsed["resource.cleric.divine-intervention"] ?? 0, 0, "free after the fourth");
});

test("V4a: 기습당함 rolls initiative at disadvantage and gives no extra first-round turn (D263)", async () => {
  const rolls = [0.9, 0.1];
  const t = await table([{ classes: "rogue", level: 17, choices: { "class.2.subclass": ["dnd.srd521.subclass.rogue.thief"] } }], [], () => rolls.shift() ?? 0.5);
  t.dm.send({ type: "tracker.add", turn: { name: "도둑", tokenId: t.ref(0).tokenId, pageId: t.scene.id, entryId: t.ref(0).entryId }, rollBonus: 0, surprised: true });
  await tick();
  const turns = (t.host as unknown as { tracker: { turns: Array<{ initiative: number }> } }).tracker.turns;
  assert.deepEqual(turns.map((turn) => turn.initiative), [3], "the lower of 19 and 3, and no second row");
});

test("V4a: 축복받은 치유사, 사냥꾼의 지식, 어둠의 존재의 축복 for somebody else's kill (D263)", async () => {
  const t = await table([
    { classes: "cleric", level: 6, choices: { "class.2.subclass": ["dnd.srd521.subclass.cleric.life-domain"], "class.0.spells": ["dnd.srd521.spell.cure-wounds"] }, runtime: (runtime) => ({ ...runtime, hp: { ...runtime.hp, current: 5 } }) },
    { classes: "fighter", level: 3, runtime: (runtime) => ({ ...runtime, hp: { ...runtime.hp, current: 5 } }) },
    { classes: "ranger", level: 7, choices: { "class.2.subclass": ["dnd.srd521.subclass.ranger.hunter"] } },
    { classes: "warlock", level: 3, choices: { "class.2.subclass": ["dnd.srd521.subclass.warlock.fiend-patron"] } },
  ], [dummy("화염 정령", 1, { resistances: ["fire"] })]);
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.cure-wounds", targets: [t.ref(1)], method: { kind: "slot", level: 1 } });
  await tick();
  assert.equal((t.entry(0) as { runtime: CharacterRuntime }).runtime.hp.current, 5 + 2 + 1, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
  t.dm.send({ type: "act.cast", caster: t.ref(2), spellId: "dnd.srd521.spell.hunter-s-mark", targets: [t.ref(4)] });
  await tick();
  assert.ok(t.host.archive.some((message) => message.type === "system" && message.content?.includes("화염 정령:")), JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
  // The fighter drops the elemental; the warlock is asked, because only they know whether they were close.
  const weapon = t.made[1].derived.attacks.find((attack) => attack.itemId)!;
  t.dm.send({ type: "act.attack", attacker: t.ref(1), targets: [t.ref(4)], attack: { source: "weapon", attackId: weapon.id } });
  await tick();
  for (const prompt of t.host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "on-hit" && !message.supersedes)) t.dm.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  assert.ok(t.host.archive.some((message) => message.type === "prompt" && message.prompt?.kind === "trigger" && message.content?.startsWith("PC3") && message.content.includes("근처에서")), JSON.stringify(t.host.archive.slice(-4).map((message) => message.content)));
});

test("V4a: 몸의 완전함 heals its user by the martial arts die, 느린 낙하 shows its number, 우월한 사냥꾼의 먹잇감 uses the mark's die (D263)", () => {
  const cat = catalog();
  const monk = build({ name: "몽크", classes: "monk", level: 6, abilities: { wis: 16 } }, { "class.2.subclass": ["dnd.srd521.subclass.monk.warrior-of-the-open-hand"] }).derived;
  const durations = contractDurations(cat, characterScope(monk));
  const whole = monk.features.find((feature) => feature.name === "몸의 완전함")!;
  assert.ok(whole, monk.features.map((feature) => feature.name).join(", "));
  const activation = featureActivation(whole, monk, durations)!;
  assert.equal(activation.heal?.(monk), `1d8+${monk.abilities.wis.modifier}`);
  assert.equal(activation.resourceId, "resource.monk.wholeness-of-body");
  const fall = monk.features.find((feature) => feature.name === "느린 낙하")!;
  assert.ok(featureActivation(fall, monk, durations)?.note?.includes("(= 30)"));
  const hunter = build({ name: "레인저", classes: "ranger", level: 20 }, { "class.2.subclass": ["dnd.srd521.subclass.ranger.hunter"] }).derived;
  assert.equal(tableOutcome(hunter, cat, "ranger.hunter.superior-hunters-prey#spread")?.strikes?.[0]?.formula, "1d10");
});

const markers = (t: Awaited<ReturnType<typeof table>>, index: number) => t.host.pageList.find((page) => page.id === t.scene.id)!.tokens.find((token) => token.id === t.ref(index).tokenId)!.markers.map((marker) => marker.name);
const openHits = (t: Awaited<ReturnType<typeof table>>) => { const answered = new Set(t.host.archive.map((message) => message.supersedes)); return t.host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "on-hit" && !message.prompt.outcome && !answered.has(message.id)); };
const lastCard = (t: Awaited<ReturnType<typeof table>>) => t.host.archive.filter((message) => message.type === "action" && message.action).at(-1)!.action!;

test("V4b: 교활한 일격's poison lasts a minute with a repeat save; 무너뜨리는 일격 marks the target for somebody else's +5 (D264)", async () => {
  // Low dice: every save fails.
  const t = await table([
    { classes: "rogue", level: 5 },
    { classes: "barbarian", level: 13, runtime: (runtime) => ({ ...runtime, effects: [{ key: "feature:barbarian.reckless-attack", name: "무모한 공격", source: "feature", duration: "이 턴", concentration: false, rounds: 1, elapsed: 0, startedAt: "" }] }) },
    { classes: "fighter", level: 5 },
  ], [dummy("허수아비", 200)], () => 0.05);
  const blade = t.made[0].derived.attacks.find((attack) => attack.properties.includes("finesse"))!;
  t.dm.send({ type: "act.attack", attacker: t.ref(0), targets: [t.ref(3)], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "hit" } });
  await tick();
  t.dm.send({ type: "act.onhit", messageId: openHits(t)[0].id, choices: ["rogue.sneak-attack", "rogue.cunning-strike#poison"] });
  await tick();
  const poisoned = (t.entry(3) as { runtime: { effects: Array<{ rounds?: number; endSave?: unknown; name: string }> } }).runtime.effects.find((effect) => effect.name === "독");
  assert.ok(poisoned?.rounds === 10 && poisoned.endSave, JSON.stringify((t.entry(3) as { runtime: { effects: unknown[] } }).runtime.effects));
  assert.ok(markers(t, 3).includes("중독"));

  const axe = t.made[1].derived.attacks.find((attack) => attack.itemId && attack.ability === "str" && !attack.range)!;
  t.dm.send({ type: "act.attack", attacker: t.ref(1), targets: [t.ref(3)], attack: { source: "weapon", attackId: axe.id }, riders: { contracts: ["barbarian.brutal-strike#strike", "barbarian.improved-brutal-strike#sundering"] }, overrides: { outcome: "hit" } });
  await tick();
  for (const prompt of openHits(t)) t.dm.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  assert.ok(markers(t, 3).some((name) => name.startsWith("무너뜨림")), JSON.stringify(markers(t, 3)));
  const sword = t.made[2].derived.attacks.find((attack) => attack.itemId && !attack.range)!;
  t.dm.send({ type: "act.attack", attacker: t.ref(2), targets: [t.ref(3)], attack: { source: "weapon", attackId: sword.id } });
  await tick();
  for (const prompt of openHits(t)) t.dm.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  assert.ok(lastCard(t).reasons.some((reason) => reason.startsWith("무너뜨림") && reason.endsWith("+5")), JSON.stringify(lastCard(t).reasons));
  assert.ok(!markers(t, 3).some((name) => name.startsWith("무너뜨림")), "spent by the fighter's attack");
});

test("V4b: 언데드 퇴치 is a Wisdom save per creature; a once-per-turn rider declared twice counts once; 충격의 일격's success still marks (D264)", async () => {
  const t = await table([{ classes: "cleric", level: 2, abilities: { wis: 16 } }, { classes: "barbarian", level: 9, runtime: (runtime) => ({ ...runtime, effects: [{ key: "feature:barbarian.reckless-attack", name: "무모한 공격", source: "feature", duration: "이 턴", concentration: false, rounds: 1, elapsed: 0, startedAt: "" }] }) }], [dummy("좀비", 200), dummy("구울", 200)], () => 0.05);
  t.dm.send({ type: "act.contract", actor: t.ref(0), ruleKey: "cleric.channel-divinity#turn-undead", targets: [t.ref(2)] });
  await tick();
  assert.ok(["공포", "행동불능"].every((name) => markers(t, 2).includes(name)), JSON.stringify(markers(t, 2)));

  t.dm.send({ type: "tracker.add", turn: { name: "바바리안", tokenId: t.ref(1).tokenId, pageId: t.scene.id, entryId: t.ref(1).entryId, initiative: 20 } });
  t.dm.send({ type: "tracker.next" });
  await tick();
  const axe = t.made[1].derived.attacks.find((attack) => attack.itemId && attack.ability === "str" && !attack.range)!;
  for (let swing = 0; swing < 2; swing += 1) {
    t.dm.send({ type: "act.attack", attacker: t.ref(1), targets: [t.ref(3)], attack: { source: "weapon", attackId: axe.id }, riders: { contracts: ["barbarian.brutal-strike#strike"] }, overrides: { outcome: "hit" } });
    await tick();
    for (const prompt of openHits(t)) t.dm.send({ type: "act.decline", messageId: prompt.id });
    await tick();
  }
  const cards = t.host.archive.filter((message) => message.type === "action" && message.action).slice(-2).map((message) => message.action!.attack.name);
  assert.deepEqual(cards.map((name) => name.includes("잔혹한 일격")), [true, false], JSON.stringify(cards));

  // High dice: the save succeeds, and the next attack against the target still has advantage.
  const monk = await table([{ classes: "monk", level: 5 }], [dummy("오우거", 200)], () => 0.95);
  const fist = monk.made[0].derived.attacks.find((attack) => !attack.range)!;
  monk.dm.send({ type: "act.attack", attacker: monk.ref(0), targets: [monk.ref(1)], attack: { source: "weapon", attackId: fist.id }, overrides: { outcome: "hit" } });
  await tick();
  monk.dm.send({ type: "act.onhit", messageId: openHits(monk)[0].id, choices: ["monk.stunning-strike"] });
  await tick();
  assert.ok(markers(monk, 1).some((name) => name.startsWith("충격의 일격")), JSON.stringify(markers(monk, 1)));
  assert.ok(!markers(monk, 1).includes("충격"), "the save succeeded");
});

test("V4c: 지속되는 격노 tops rage up at initiative and waives its upkeep; 완벽한 집중 fills to 4; 지치지 않는 자 sheds exhaustion; 안수 heals someone else (D265)", async () => {
  const { restFeatures, useRestFeature } = await import("../../client/character/rest");
  const cat = catalog();
  const barbarian = build({ name: "바바리안", classes: "barbarian", level: 15 }).derived;
  const rageMax = barbarian.resources.find((resource) => resource.id === "resource.barbarian.rage")!.max;
  const spent: CharacterRuntime = { ...initialRuntime(barbarian), resourcesUsed: { "resource.barbarian.rage": rageMax } };
  const persistent = restFeatures(barbarian, spent, cat, "initiative").find((feature) => feature.name === "지속되는 격노")!;
  assert.ok(persistent && !persistent.unavailable, JSON.stringify(restFeatures(barbarian, spent, cat, "initiative")));
  const topped = useRestFeature(spent, barbarian, persistent)!;
  assert.equal(topped.resourcesUsed["resource.barbarian.rage"], 0);
  assert.equal(topped.resourcesUsed["resource.barbarian.persistent-rage"], 1);
  assert.ok(barbarian.upkeepWaived?.includes("feature:barbarian.rage"));

  const monk = build({ name: "몽크", classes: "monk", level: 15 }).derived;
  const focusMax = monk.resources.find((resource) => resource.id === "resource.monk.focus")!.max;
  const tired: CharacterRuntime = { ...initialRuntime(monk), resourcesUsed: { "resource.monk.focus": focusMax - 1 } };
  const perfect = restFeatures(monk, tired, cat, "initiative").find((feature) => feature.name === "완전한 기")!;
  assert.equal(useRestFeature(tired, monk, perfect)!.resourcesUsed["resource.monk.focus"], focusMax - 4, "one left becomes four");

  const ranger = build({ name: "레인저", classes: "ranger", level: 10 }).derived;
  const worn: CharacterRuntime = { ...initialRuntime(ranger), exhaustion: 2 };
  const tireless = restFeatures(ranger, worn, cat).find((feature) => feature.name === "지치지 않음")!;
  assert.equal(useRestFeature(worn, ranger, tireless)!.exhaustion, 1);

  const t = await table([{ classes: "paladin", level: 5 }, { classes: "fighter", level: 5, runtime: (runtime) => ({ ...runtime, hp: { ...runtime.hp, current: 3 } }) }], []);
  assert.equal(tableOutcome(t.made[0].derived, t.cat, "paladin.lay-on-hands")?.party.healPoints, 25);
  t.dm.send({ type: "act.contract", actor: t.ref(0), ruleKey: "paladin.lay-on-hands", targets: [t.ref(1)], amount: 40 });
  await tick();
  assert.equal((t.entry(1) as { runtime: CharacterRuntime }).runtime.hp.current, Math.min(3 + 25, t.made[1].derived.hp.max), "capped at the pool");
});

test("V4c: 선천 마법 raises the spell save DC, 우월한 방어 resists all but force, 방출학파 학자's spells can be prepared (D265)", () => {
  const cat = catalog();
  const effect = (key: string, name: string) => ({ key, name, source: "feature" as const, duration: "1분", concentration: false, rounds: 10, elapsed: 0, startedAt: "" });
  const sorcerer = build({ name: "소서러", classes: "sorcerer", level: 3 });
  const before = sorcerer.derived.spellcasting.find((entry) => entry.source === "class")!.saveDc;
  const innate = deriveCharacterWith(sorcerer.source, cat, [effect("feature:sorcerer.innate-sorcery#while-active", "선천 마법")]);
  const plain = deriveCharacterWith(sorcerer.source, cat, [effect("feature:sorcerer.innate-sorcery", "선천 마법")]);
  assert.ok([innate, plain].some((derived) => derived.spellcasting.find((entry) => entry.source === "class")!.saveDc === before + 1), "DC +1 while it runs");
  const monk = build({ name: "몽크", classes: "monk", level: 18 });
  const defended = deriveCharacterWith(monk.source, cat, [effect("feature:monk.superior-defense", "우월한 방어")]);
  assert.ok(defended.defenses.resistances.some((line) => line.startsWith("화염")) && !defended.defenses.resistances.some((line) => line.startsWith("역장")), JSON.stringify(defended.defenses.resistances));
  const wizard = build({ name: "위저드", classes: "wizard", level: 3 }).derived;
  const savant = wizard.choices.find((choice) => choice.id.endsWith(".evocation-savant"))!;
  const prepared = wizard.choices.find((choice) => choice.id === "class.0.spells")!;
  assert.ok(savant.options.slice(0, savant.count).every((option) => prepared.options.some((item) => item.id === option.id)), "the free evocation spells are preparable");
});

function deriveCharacterWith(source: ReturnType<typeof build>["source"], cat: ReturnType<typeof catalog>, effects: CharacterRuntime["effects"]) {
  return deriveCharacter(source, cat, { effects });
}

test("V4d: 행운의 일격 and 행운 are rescues; 바드의 영감 is a die the ally spends on a failed test (D266)", async () => {
  const { pcRescues } = await import("../../client/rules/contractUse");
  const { planRollModify } = await import("../../client/rules/contract");
  const cat = catalog();
  const rogue = build({ name: "로그", classes: "rogue", level: 20 });
  const rogueEntry = newJournalCharacter("c", "p", rogue.source, initialRuntime(rogue.derived));
  const luck = pcRescues(rogueEntry, rogue.derived, cat, "ability-check", "failure").find((offer) => offer.feature === "행운의 일격")!;
  assert.ok(luck, JSON.stringify(pcRescues(rogueEntry, rogue.derived, cat, "ability-check", "failure").map((offer) => offer.feature)));
  assert.equal(planRollModify(luck.interceptor.operations, luck.scope, { d: () => 3 }).d20, 20);
  const halfling = build({ name: "하플링", classes: "fighter", level: 1, species: "halfling" });
  const halflingEntry = newJournalCharacter("c", "p", halfling.source, initialRuntime(halfling.derived));
  const named = (d20: number) => pcRescues(halflingEntry, halfling.derived, cat, "saving-throw", "failure", d20).map((offer) => offer.feature);
  assert.ok(named(1).includes("행운"), JSON.stringify(named(1)));
  assert.ok(!named(5).includes("행운"));

  const t = await table([{ classes: "bard", level: 5 }, { classes: "fighter", level: 5 }], []);
  t.dm.send({ type: "act.contract", actor: t.ref(0), ruleKey: "bard.bardic-inspiration", targets: [t.ref(1)] });
  await tick();
  const fighter = t.entry(1) as ReturnType<typeof newJournalCharacter>;
  const gift = fighter.runtime.effects.find((effect) => effect.rescue);
  assert.deepEqual(gift?.rescue, { dice: "1d8" }, JSON.stringify(fighter.runtime.effects));
  const offer = pcRescues(fighter, t.made[1].derived, cat, "saving-throw", "failure").find((item) => item.feature === "바드의 영감")!;
  assert.ok(offer);
  const { payContract } = await import("../../client/rules/contractUse");
  assert.ok(!payContract(fighter.runtime, t.made[1].derived, offer.payments, "success")!.effects.some((effect) => effect.rescue), "spent once used");
});

test("V4d: 불굴의 격노 holds a raging barbarian at twice their level; 끈질긴 인내 holds an orc at 1 (D266)", async () => {
  const hit = (name: string, formula: string) => dummy(name, 50, { actions: [{ name: "강타", attack: { mode: "melee", bonus: 30, rangeFeet: 5, damage: [{ formula, type: "bludgeoning" }] } }] });
  const raging = (runtime: CharacterRuntime) => ({ ...runtime, hp: { ...runtime.hp, current: 30 }, effects: [{ key: "feature:barbarian.rage", name: "격노", source: "feature" as const, duration: "10분", concentration: false, rounds: 100, elapsed: 0, startedAt: "" }] });
  // High dice: the Constitution save against DC 10 succeeds.
  const t = await table([{ classes: "barbarian", level: 11, runtime: raging }, { classes: "fighter", level: 5, runtime: (runtime) => ({ ...runtime, hp: { ...runtime.hp, current: 10 } }) }], [hit("거인", "80")], () => 0.95);
  t.dm.send({ type: "act.attack", attacker: t.ref(2), targets: [t.ref(0)], attack: { source: "npc", actionName: "강타" } });
  await tick();
  const barbarian = t.entry(0) as ReturnType<typeof newJournalCharacter>;
  assert.equal(barbarian.runtime.hp.current, 22, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
  assert.equal(barbarian.runtime.resourcesUsed["resource.barbarian.relentless-rage"], 1, "the next DC is 15");
  assert.ok(!barbarian.runtime.conditions.includes("무의식"));

  const orc = await table([{ classes: "fighter", level: 5, choices: {}, runtime: (runtime) => ({ ...runtime, hp: { ...runtime.hp, current: 10 } }) }], [hit("거인", "20")], () => 0.5);
  orc.made[0] = build({ name: "오크", classes: "fighter", level: 5, species: "orc" });
  const orcSheet = newJournalCharacter(orc.scene.campaignId, "dm", orc.made[0].source, { ...initialRuntime(orc.made[0].derived), hp: { ...initialRuntime(orc.made[0].derived).hp, current: 10 } });
  orc.dm.send({ type: "journal.put", entry: orcSheet });
  await tick();
  const orcToken = tokenForCharacter(orcSheet);
  orc.dm.send({ type: "token.put", pageId: orc.scene.id, token: orcToken });
  await tick();
  orc.dm.send({ type: "act.attack", attacker: orc.ref(1), targets: [{ entryId: orcSheet.id, pageId: orc.scene.id, tokenId: orcToken.id }], attack: { source: "npc", actionName: "강타" } });
  await tick();
  const held = orc.host.journal.find((entry) => entry.id === orcSheet.id) as ReturnType<typeof newJournalCharacter>;
  assert.equal(held.runtime.hp.current, 1, JSON.stringify(orc.host.archive.slice(-3).map((message) => message.content)));
  assert.equal(held.runtime.resourcesUsed["resource.species.relentless-endurance"], 1);
});

test("V4e: 보복 opens an attack back; 보호의 오라 marked on an ally adds the paladin's Charisma to its saves and 용기의 오라 blocks fear (D267)", async () => {
  const swing = dummy("오우거", 200, { actions: [{ name: "몽둥이", attack: { mode: "melee", bonus: 30, rangeFeet: 5, damage: [{ formula: "5", type: "bludgeoning" }] } }] });
  const t = await table([{ classes: "barbarian", level: 10, choices: { "class.2.subclass": ["dnd.srd521.subclass.barbarian.path-of-the-berserker"] } }], [swing]);
  t.dm.send({ type: "act.attack", attacker: t.ref(1), targets: [t.ref(0)], attack: { source: "npc", actionName: "몽둥이" } });
  await tick();
  const guard = t.host.archive.find((message) => message.type === "prompt" && message.prompt?.kind === "guard" && message.prompt.guard?.features.some((feature) => feature.name === "보복"));
  assert.ok(guard, JSON.stringify(t.host.archive.slice(-2).map((message) => message.content)));
  t.dm.send({ type: "act.guard", messageId: guard!.id, feature: "보복" });
  await tick();
  assert.ok(t.host.archive.some((message) => message.type === "prompt" && message.prompt?.kind === "opportunity" && message.prompt.mover.tokenId === t.ref(1).tokenId), JSON.stringify(t.host.archive.slice(-2).map((message) => message.content)));

  // Low dice: every save fails, so the bonus is read off the card and the condition off the token.
  const party = await table([{ classes: "paladin", level: 10, abilities: { cha: 16 } }, { classes: "fighter", level: 5 }, { classes: "cleric", level: 5 }], [], () => 0.05);
  const fighterToken = party.host.pageList.find((page) => page.id === party.scene.id)!.tokens.find((token) => token.id === party.ref(1).tokenId)!;
  party.dm.send({ type: "token.put", pageId: party.scene.id, token: { ...fighterToken, markers: [...fighterToken.markers, { name: "보호의 오라", from: party.ref(0).tokenId }] } });
  await tick();
  party.dm.send({ type: "act.contract", actor: party.ref(2), ruleKey: "cleric.channel-divinity#turn-undead", targets: [party.ref(1)] });
  await tick();
  const saveCard = party.host.archive.filter((message) => message.type === "spell" && message.spell?.targets[0]?.save).at(-1)!.spell!.targets[0];
  const base = party.made[1].derived.saves.wis.bonus;
  assert.equal(saveCard.save!.bonus, base + 3, JSON.stringify(saveCard.save));
  assert.ok(!markers(party, 1).includes("공포"), JSON.stringify(markers(party, 1)));
});

test("V4f: a spell cast with a chosen variant keeps it — 에너지 보호's cold resistance halves cold, 화염 방패 burns a melee attacker, 죽음 방비 holds at 1 (D268)", async () => {
  const { variantsOf } = await import("../../client/compendium/spells");
  const { castSpell: castSpellFromSheet } = await import("../../client/character/play");
  assert.deepEqual(variantsOf("dnd.srd521.spell.protection-from-energy").map((variant) => variant.id), ["acid", "cold", "fire", "lightning", "thunder"]);
  const frost = dummy("서리 거인", 300, { actions: [{ name: "얼음 도끼", attack: { mode: "melee", bonus: 30, rangeFeet: 5, damage: [{ formula: "20", type: "cold" }] } }] });
  const t = await table([{ classes: "wizard", level: 9 }, { classes: "fighter", level: 9 }], [frost]);
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.protection-from-energy", targets: [t.ref(1)], method: { kind: "slot", level: 3 }, variant: "cold" });
  await tick();
  const warded = t.entry(1) as ReturnType<typeof newJournalCharacter>;
  assert.equal(warded.runtime.effects.find((effect) => effect.key === "spell:dnd.srd521.spell.protection-from-energy")?.variant, "cold", JSON.stringify(t.host.archive.slice(-2).map((message) => message.content)));
  const before = warded.runtime.hp.current;
  t.dm.send({ type: "act.attack", attacker: t.ref(2), targets: [t.ref(1)], attack: { source: "npc", actionName: "얼음 도끼" } });
  await tick();
  assert.equal((t.entry(1) as ReturnType<typeof newJournalCharacter>).runtime.hp.current, before - 10, "cold halved");

  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.fire-shield", targets: [t.ref(0)], method: { kind: "slot", level: 4 }, variant: "chill" });
  await tick();
  const giantHp = () => t.host.pageList.find((page) => page.id === t.scene.id)!.tokens.find((token) => token.id === t.ref(2).tokenId)!.bars[0].value ?? 0;
  const giantBefore = giantHp();
  t.dm.send({ type: "act.attack", attacker: t.ref(2), targets: [t.ref(0)], attack: { source: "npc", actionName: "얼음 도끼" } });
  await tick();
  for (const prompt of t.host.archive.filter((message) => message.type === "prompt" && (message.prompt?.kind === "shield" || message.prompt?.kind === "guard") && !message.supersedes)) t.dm.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  assert.ok(giantHp() < giantBefore, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));

  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.death-ward", targets: [t.ref(1)], method: { kind: "slot", level: 4 } });
  await tick();
  const fighter = t.entry(1) as ReturnType<typeof newJournalCharacter>;
  t.dm.send({ type: "journal.put", entry: { ...fighter, runtime: { ...fighter.runtime, hp: { ...fighter.runtime.hp, current: 5 } } } });
  await tick();
  t.dm.send({ type: "act.attack", attacker: t.ref(2), targets: [t.ref(1)], attack: { source: "npc", actionName: "얼음 도끼" } });
  await tick();
  const held = t.entry(1) as ReturnType<typeof newJournalCharacter>;
  assert.equal(held.runtime.hp.current, 1, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
  assert.ok(!held.runtime.effects.some((effect) => effect.key === "spell:dnd.srd521.spell.death-ward"), "the ward is spent");
});

test("V4g: save spells that rolled nothing now deal their damage, a spell that ends a condition ends the chosen one, and index rules count as rules (D269)", async () => {
  const { spellExec } = await import("../../client/compendium/spells");
  const { spellIsJudged } = await import("../../client/rules/spellcast");
  const cat = catalog();
  const wizard = build({ name: "위저드", classes: "wizard", level: 15 }).derived;
  for (const id of ["spike-growth", "find-familiar", "true-strike"]) assert.equal(spellIsJudged(spellExec(`dnd.srd521.spell.${id}`)!, cat, wizard), false, id);
  const t = await table([{ classes: "wizard", level: 15 }, { classes: "cleric", level: 5, runtime: (runtime) => ({ ...runtime, conditions: ["중독", "실명"] }) }], [dummy("허수아비", 300)]);
  const hp = () => t.host.pageList.find((page) => page.id === t.scene.id)!.tokens.find((token) => token.id === t.ref(2).tokenId)!.bars[0].value ?? 0;
  const before = hp();
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.vitriolic-sphere", targets: [t.ref(2)], method: { kind: "slot", level: 4 } });
  await tick();
  assert.ok(hp() < before, JSON.stringify(t.host.archive.slice(-2).map((message) => message.content)));
  // 화염 방패 aside, the sphere spells place first and roll on the repeat.
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.flaming-sphere", targets: [t.ref(2)], method: { kind: "slot", level: 2 } });
  await tick();
  const placed = hp();
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.flaming-sphere", targets: [t.ref(2)], method: { kind: "sustain" } });
  await tick();
  assert.ok(hp() < placed, "the repeat burns it");
  t.dm.send({ type: "act.cast", caster: t.ref(1), spellId: "dnd.srd521.spell.lesser-restoration", targets: [t.ref(1)], method: { kind: "slot", level: 2 }, variant: "poisoned" });
  await tick();
  const cleric = t.entry(1) as ReturnType<typeof newJournalCharacter>;
  assert.deepEqual(cleric.runtime.conditions, ["실명"], JSON.stringify(t.host.archive.slice(-2).map((message) => message.content)));
});

test("V4h: a turn ends one condition, the sneak attack reads its own advantage, and the deflected attack goes back (D270)", async () => {
  const { pcAttackSpec } = await import("../../client/rules/attackSpec");
  // 자기 회복: one of the three goes when the monk's turn ends.
  const t = await table([{ classes: "monk", level: 14, runtime: (runtime) => ({ ...runtime, conditions: ["공포", "중독"] }) }], [dummy("허수아버", 80, { actions: [{ name: "주먹", attack: { mode: "melee", bonus: 20, rangeFeet: 5, damage: [{ formula: "8", type: "bludgeoning" }] } }] })]);
  t.dm.send({ type: "tracker.add", turn: { name: "몭크", tokenId: t.ref(0).tokenId, pageId: t.scene.id, entryId: t.ref(0).entryId, initiative: 20 } });
  t.dm.send({ type: "tracker.next" });
  t.dm.send({ type: "tracker.next" });
  await tick();
  const monk = t.entry(0) as ReturnType<typeof newJournalCharacter>;
  assert.deepEqual(monk.runtime.conditions, ["중독"], JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));

  // 공격 흘리기: the reaction sends the attack back at the ogre.
  const hp = () => t.host.pageList.find((page) => page.id === t.scene.id)!.tokens.find((token) => token.id === t.ref(1).tokenId)!.bars[0].value ?? 0;
  const before = hp();
  t.dm.send({ type: "act.attack", attacker: t.ref(1), targets: [t.ref(0)], attack: { source: "npc", actionName: "주먹" } });
  await tick();
  const guard = t.host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "guard" && !message.supersedes).at(-1)!;
  assert.ok(guard.prompt!.guard!.features.length, JSON.stringify(guard.prompt!.guard!.features.map((feature) => feature.name)));
  t.dm.send({ type: "act.guard", messageId: guard.id, feature: guard.prompt!.guard!.features[0].name });
  await tick();
  assert.ok(hp() < before, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));

  // 암습: the dice ride along without a checkbox when the swing had advantage, and only one 교활한 일격 effect is paid for.
  const rogue = build({ name: "로그", classes: "rogue", level: 5 });
  const entry = newJournalCharacter("c", "p", rogue.source, initialRuntime(rogue.derived));
  const blade = rogue.derived.attacks.find((attack) => attack.properties.includes("finesse"))!;
  const two = pcAttackSpec(entry, rogue.derived, blade.id, { contracts: ["rogue.sneak-attack", "rogue.cunning-strike#trip", "rogue.cunning-strike#poison"], facts: ["sneak-advantage"] }, catalog())!.spec;
  assert.equal(two.riders?.find((part) => part.label === "암습")?.formula, "2d6", "one effect only at level 5");
  assert.equal(two.hitSaves?.length, 1, JSON.stringify(two.hitSaves));
  const eleven = build({ name: "로그", classes: "rogue", level: 11 });
  const better = pcAttackSpec(newJournalCharacter("c", "p", eleven.source, initialRuntime(eleven.derived)), eleven.derived, eleven.derived.attacks.find((attack) => attack.properties.includes("finesse"))!.id, { contracts: ["rogue.sneak-attack", "rogue.cunning-strike#trip", "rogue.cunning-strike#poison"], facts: ["sneak-advantage"] }, catalog())!.spec;
  assert.equal(better.hitSaves?.length, 2, "two from 11");
});

test("V4i: an invocation's free cast never runs out, 마귀의 시야 sees 120 feet, and 마력의 강타 rides a hit for a pact slot (D271)", async () => {
  const { castSpell } = await import("../../client/character/play");
  const picks = ["invocation.pact-of-the-blade", "invocation.armor-of-shadows", "invocation.devils-sight", "invocation.eldritch-smite", "invocation.thirsting-blade"];
  const t = await table([{ classes: "warlock", level: 5, abilities: { cha: 16, dex: 14 }, choices: { "class.0.invocations": picks } }], [dummy("좀비", 60)], () => 0);
  const warlock = t.made[0].derived;

  // 그림자의 갑옷: a pool of one that recovers 무제한, so the same cast can be paid for again and again.
  const shadows = warlock.resources.find((resource) => resource.atWill)!;
  assert.equal(shadows.recovery, "무제한");
  const armor = { id: shadows.freeCastSpellId!, name: "마법사의 갑옷", level: 1 };
  let runtime = initialRuntime(warlock);
  for (let cast = 0; cast < 3; cast += 1) runtime = castSpell(runtime, warlock, armor, { kind: "resource", id: shadows.id })!;
  assert.ok(runtime.log.at(-1)!.text.includes("무제한"), runtime.log.at(-1)!.text);

  // 마귀의 시야, 갈증의 검: darkvision on the sheet and a second swing in the Attack action.
  assert.ok((warlock.senses.darkvision ?? 0) >= 120, String(warlock.senses.darkvision));
  assert.equal(warlock.attackActionAttacks, 2);

  // 마력의 강타: the on-hit window offers it, and taking it spends a pact slot for 2d8 force plus 넘어짐.
  const blade = warlock.attacks[0];
  t.dm.send({ type: "act.attack", attacker: t.ref(0), targets: [t.ref(1)], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "hit" } });
  await tick();
  const window = openHits(t)[0];
  assert.ok(window.prompt!.onHit!.offers.some((offer) => offer.key === "invocation.eldritch-smite#smite"), JSON.stringify(window.prompt!.onHit!.offers.map((offer) => offer.key)));
  const before = t.host.pageList.find((page) => page.id === t.scene.id)!.tokens.find((token) => token.id === t.ref(1).tokenId)!.bars[0].value ?? 0;
  t.dm.send({ type: "act.onhit", messageId: window.id, choices: ["invocation.eldritch-smite#smite"] });
  await tick();
  const after = t.host.pageList.find((page) => page.id === t.scene.id)!.tokens.find((token) => token.id === t.ref(1).tokenId)!.bars[0].value ?? 0;
  assert.ok(after < before, JSON.stringify(lastCard(t).reasons));
  assert.ok(markers(t, 1).includes("넘어짐"), JSON.stringify(markers(t, 1)));
  assert.equal((t.entry(0) as ReturnType<typeof newJournalCharacter>).runtime.pactSlotsUsed, 1);
});

test("V4j: 마력의 샘 turns a slot into sorcery points and points back into a slot; 야생 재발 trades a Wild Shape use for a 1st-level slot (D272)", async () => {
  const cat = catalog();
  const sorcerer = build({ name: "소서러", classes: "sorcerer", level: 5 });
  let sheet: CharacterRuntime = initialRuntime(sorcerer.derived);
  const deps = (made: typeof sorcerer) => ({ source: made.source, catalog: cat, derived: made.derived, get runtime() { return sheet; }, rollDice: async (spec: { label: string; formula: string }) => ({ id: "r", at: "", label: spec.label, formula: spec.formula, total: 3, dice: [], modifier: 0 }), save: (update: (current: CharacterRuntime) => CharacterRuntime) => { sheet = update(sheet); } });
  const useOf = (made: typeof sorcerer, name: string) => made.derived.features.find((feature) => feature.name === name)!;

  // A 2nd-level slot becomes two sorcery points.
  sheet = { ...sheet, resourcesUsed: { "resource.sorcerer.sorcery-points": 4 } };
  assert.equal(await activateFeature(useOf(sorcerer, "마력의 샘: 2레벨 슬롯 → 마법 점수 2"), deps(sorcerer) as Parameters<typeof activateFeature>[1]), "done");
  assert.equal(sheet.slotsUsed[2], 1);
  assert.equal(sheet.resourcesUsed["resource.sorcerer.sorcery-points"], 2, "four spent of five, two points back");

  // Three points buy the 2nd-level slot back.
  assert.equal(await activateFeature(useOf(sorcerer, "마력의 샘: 마법 점수 3 → 2레벨 슬롯"), deps(sorcerer) as Parameters<typeof activateFeature>[1]), "done");
  assert.equal(sheet.slotsUsed[2], 0);
  assert.equal(sheet.resourcesUsed["resource.sorcerer.sorcery-points"], 5, "three of the three points left paid for it");

  // 야생 재발: a Wild Shape use for a 1st-level slot, and only while a slot is spent to give back.
  const druid = build({ name: "드루이드", classes: "druid", level: 5 });
  sheet = { ...initialRuntime(druid.derived), slotsUsed: { 1: 2 } };
  assert.equal(await activateFeature(useOf(druid, "야생 재발: 야생 변신 1회 → 1레벨 슬롯"), deps(druid) as Parameters<typeof activateFeature>[1]), "done");
  assert.equal(sheet.slotsUsed[1], 1);
  assert.equal(sheet.resourcesUsed["resource.druid.wild-shape"], 1);
});

test("V4k: 야생 변신 takes a beast's stat block — AC, speed, senses, Strength and its attacks — and 원초의 일격 rides them (D273)", async () => {
  const { pcAttackSpec, hitOffers } = await import("../../client/rules/attackSpec");
  const cat = catalog();
  const druid = build({ name: "드루이드", classes: "druid", level: 15, abilities: { wis: 16 }, choices: { "class.6.elemental-fury": ["druid.elemental-fury.primal-strike"] } });
  let sheet: CharacterRuntime = initialRuntime(druid.derived);
  const deps = { source: druid.source, catalog: cat, derived: druid.derived, get runtime() { return sheet; }, rollDice: async (spec: { label: string; formula: string }) => ({ id: "r", at: "", label: spec.label, formula: spec.formula, total: 4, dice: [], modifier: 0 }), save: (update: (current: CharacterRuntime) => CharacterRuntime) => { sheet = update(sheet); }, askForm: (_name: string, options: Array<{ id: string; name: string; crText: string }>) => options.find((option) => option.name === "흑곰")?.id ?? null };
  const wild = druid.derived.features.find((feature) => feature.name === "야생 변신")!;

  // 야생 변신 (15레벨): a CR 1 beast is on the list, and the form's numbers replace the druid's own.
  assert.equal(await activateFeature(wild, deps as unknown as Parameters<typeof activateFeature>[1]), "done");
  const bear = sheet.effects!.find((effect) => effect.name === "야생 변신")!;
  assert.equal(bear.form, "dnd.srd521.monster.black-bear");
  assert.equal(sheet.hp.temp, 15, "임시 HP = 드루이드 레벨");
  const inForm = deriveCharacter(druid.source, cat, { effects: sheet.effects });
  const black = (await import("../../client/compendium/monsters")).monsterById("dnd.srd521.monster.black-bear")!;
  assert.equal(inForm.ac.value, black.ac);
  assert.equal(inForm.speed.walk, black.speeds.walk ?? black.speed);
  assert.equal(inForm.abilities.str.score, black.abilities.str);
  assert.ok(inForm.attacks.every((attack) => attack.properties.includes("form")), JSON.stringify(inForm.attacks.map((attack) => attack.name)));
  assert.ok(inForm.attacks.length && inForm.attacks[0].name.startsWith("흑곰: "), inForm.attacks[0]?.name);

  // 원초의 일격 (elemental fury): the form's own claws carry its damage, and the on-hit window offers it.
  const entry = newJournalCharacter("c", "p", druid.source, sheet);
  const claw = inForm.attacks[0];
  const offers = hitOffers(entry, inForm, claw.id, {}, cat).map((offer) => offer.key);
  assert.ok(offers.some((key) => key.startsWith("druid.elemental-fury.primal-strike#")), JSON.stringify(offers));
  const spec = pcAttackSpec(entry, inForm, claw.id, { contracts: [offers.find((key) => key.startsWith("druid.elemental-fury.primal-strike#"))!] }, cat)!.spec;
  assert.ok(spec.riders?.some((rider) => rider.formula === "2d8"), JSON.stringify(spec.riders));
});

test("V4l: 날카로운 말 lowers somebody else's hit with the bard's own inspiration die, and its facts are asked instead of guessed (D274)", async () => {
  // A fighter hits; the bard beside them spoils it. Every die rolls high so the hit is one the die can undo.
  const t = await table([
    { classes: "fighter", level: 5 },
    { classes: "bard", level: 14, choices: { "class.2.subclass": ["dnd.srd521.subclass.bard.college-of-lore"] } },
  ], [dummy("허수아비", 200, { ac: 15 })], () => 0.95);
  const blade = t.made[0].derived.attacks[0];
  t.dm.send({ type: "act.attack", attacker: t.ref(0), targets: [t.ref(2)], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "hit" } });
  await tick();
  for (const prompt of openHits(t)) t.dm.send({ type: "act.decline", messageId: prompt.id });
  await tick();

  // The window goes to the bard, not to the fighter, and it carries the questions the app cannot answer itself.
  const ask = t.host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "rescue" && message.prompt.rescue?.interfere && !message.supersedes).at(-1)!;
  assert.ok(ask, JSON.stringify(t.host.archive.map((message) => [message.type, message.prompt?.kind, message.content?.slice(0, 40)])));
  assert.equal(ask.prompt!.reactor!.entryId, t.ref(1).entryId);
  assert.deepEqual(ask.prompt!.rescue!.features, ["날카로운 말"]);
  assert.deepEqual(ask.prompt!.rescue!.facts?.map((fact) => fact.id), ["same-trigger", "trigger-distance", "source-sees-trigger"]);

  const before = t.host.archive.filter((message) => message.type === "action").at(-1)!;
  t.dm.send({ type: "act.rescue", messageId: ask.id, feature: "날카로운 말" });
  await tick();
  const after = t.host.archive.filter((message) => message.type === "action" && message.supersedes).at(-1)!;
  assert.ok(after, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
  assert.ok(after.content.includes("17 vs AC 15"), after.content);
  const answered = t.host.archive.filter((message) => message.supersedes === ask.id).at(-1)!;
  assert.ok(answered.content.includes("날카로운 말"), answered.content);
  const bard = t.entry(1) as ReturnType<typeof newJournalCharacter>;
  assert.equal(bard.runtime.resourcesUsed["resource.bard.bardic-inspiration"], 1, "한 번 쓰면 영감 하나");
  void before;
});

test("V4m: species traits are rules — 용감함 gives advantage only against fear, 수완 hands inspiration after a long rest, 숨결 무기 asks for a save (D275)", async () => {
  const { pcStats } = await import("../../client/rules/actions");
  const { advantageFor } = await import("../../client/rules/actions");
  const cat = catalog();

  // 용감함: advantage on a save against 공포, and nothing on any other save.
  const halfling = build({ name: "하플링", species: "halfling", classes: "rogue", level: 3 }).derived;
  const stats = pcStats(halfling);
  assert.equal(advantageFor(stats, "saving-throw", { ability: "wis", conditions: ["공포"] })?.reason, "용감함");
  assert.equal(advantageFor(stats, "saving-throw", { ability: "wis", conditions: ["중독"] }), undefined);
  assert.equal(advantageFor(stats, "saving-throw", { ability: "wis" }), undefined, "a save about nothing in particular is not covered");
  // 요정 혈통 and 드워프 강인함 are the same rule about other conditions.
  assert.equal(advantageFor(pcStats(build({ name: "엘프", species: "elf", classes: "wizard", level: 3 }).derived), "saving-throw", { ability: "cha", conditions: ["매혹"] })?.reason, "요정 혈통");
  assert.ok(advantageFor(pcStats(build({ name: "드워프", species: "dwarf", classes: "fighter", level: 3 }).derived), "saving-throw", { ability: "con", conditions: ["중독"] }), "드워프의 독 저항은 중독 내성에도 유리를 준다");

  // 수완: the long rest hands over heroic inspiration; another species' rest does not.
  const human = build({ name: "인간", species: "human", classes: "fighter", level: 3 });
  assert.equal(human.derived.longRestGains?.heroicInspiration, true);
  const rested = longRest(initialRuntime(human.derived), human.derived);
  assert.equal(rested.heroicInspiration, true);
  const elf = build({ name: "엘프", species: "elf", classes: "fighter", level: 3 });
  assert.equal(longRest(initialRuntime(elf.derived), elf.derived).heroicInspiration, false);

  // 숨결 무기: the line of the ancestry's damage type (D308), a Dexterity save for half at the dragonborn's own DC.
  const dragonborn = build({ name: "용인", species: "dragonborn", classes: "paladin", level: 5, abilities: { con: 16 } }, { "origin.species.draconicAncestry": ["red"] });
  const breath = tableOutcome(dragonborn.derived, cat, "species.breath-weapon#fire")!;
  assert.deepEqual(breath.strikes?.map((strike) => [strike.formula, strike.damageType, strike.save?.ability, strike.save?.dc, strike.save?.success]), [["2d10", "화염", "dex", 8 + 3 + dragonborn.derived.proficiencyBonus, "half"]]);
  assert.equal(dragonborn.derived.resources.find((resource) => resource.id === "resource.species.breath-weapon")?.max, dragonborn.derived.proficiencyBonus);

  // 거대한 형태: the +10 feet comes with the effect, not for ever.
  const goliath = build({ name: "골리앗", species: "goliath", classes: "fighter", level: 5 });
  assert.equal(goliath.derived.speed.walk, 35);
  const large = deriveCharacter(goliath.source, cat, { effects: [{ key: "feature:species.large-form", name: "거대한 형태", source: "feature", duration: "10분 (100라운드)", concentration: false, rounds: 100, elapsed: 0, startedAt: "" }] });
  assert.equal(large.speed.walk, 45);
});

test("V4n: feats — 저항할 수 없는 공격 uses the score it raised, 그림자 형상 resists all but radiant, 붙잡기 전문가 grapples on a hit, 주문 회상 pays for any 4th-level spell (D276)", async () => {
  const { pcAttackSpec } = await import("../../client/rules/attackSpec");
  const { castSpell } = await import("../../client/character/play");
  const cat = catalog();

  // 붙잡기 전문가: the unarmed hit offers a grapple with the feat owner's own DC, and a held target is easier to hit.
  const t = await table([{ classes: "monk", level: 8, abilities: { str: 16, dex: 16 }, runtime: (runtime) => runtime }], [dummy("좀비", 60, { abilities: { str: 6, dex: 6, con: 16, int: 3, wis: 6, cha: 5 } })], () => 0);
  const grappler = build({ name: "붙잡기", classes: "fighter", level: 8, abilities: { str: 18 }, choices: { "class.3.asi": ["dnd.srd521.feat.grappler"] } });
  const entry = newJournalCharacter("c", "p", grappler.source, initialRuntime(grappler.derived));
  const fist = grappler.derived.attacks.find((attack) => !attack.itemId)!;
  const offers = (await import("../../client/rules/attackSpec")).hitOffers(entry, grappler.derived, fist.id, {}, cat);
  const grab = offers.find((offer) => offer.key.startsWith("feat:grappler#") || offer.key.startsWith("grappler#"));
  assert.ok(grab, JSON.stringify(offers.map((offer) => offer.key)));
  const spec = pcAttackSpec(entry, grappler.derived, fist.id, { contracts: [grab!.key] }, cat)!.spec;
  assert.deepEqual(spec.hitSaves?.map((save) => [save.ability, save.dc, save.condition]), [["str", 8 + grappler.derived.abilities.str.modifier + grappler.derived.proficiencyBonus, "붙잡힘"]]);
  void t;

  // 밤의 영혼의 은총: the shadowy form resists everything but radiant and doubles the walking speed.
  const night = build({ name: "밤", classes: "rogue", level: 19, choices: { "class.18.epic-boon": ["dnd.srd521.feat.epic.night-spirit"] } });
  const shadowed = deriveCharacter(night.source, cat, { effects: [{ key: "feat:epic.night-spirit", name: "그림자 형상", source: "feature", duration: "빛 속으로 나가거나 공격·시전할 때까지", concentration: false, elapsed: 0, startedAt: "" }] });
  assert.ok(shadowed.defenses.resistances.some((type) => type.startsWith("화염")) && !shadowed.defenses.resistances.some((type) => type.startsWith("광휘")), JSON.stringify(shadowed.defenses.resistances));
  assert.equal(shadowed.speed.walk, night.derived.speed.walk * 2);

  // 주문 회상의 은총: one pool that pays for any spell of 4th level or lower.
  const wizard = build({ name: "위저드", classes: "wizard", level: 19, choices: { "class.18.epic-boon": ["dnd.srd521.feat.epic.spell-recall"] } });
  const pool = wizard.derived.resources.find((resource) => resource.freeCastMaxLevel !== undefined)!;
  assert.equal(pool.freeCastMaxLevel, 4);
  const cast = castSpell(initialRuntime(wizard.derived), wizard.derived, { id: "x", name: "4레벨 주문", level: 4 }, { kind: "resource", id: pool.id });
  assert.ok(cast, "4레벨 주문을 그 풀로 시전할 수 있다");
  assert.equal(cast!.resourcesUsed[pool.id], 1);
});

test("V4o: 불굴의 힘 floors a Strength check, 원초적 지식 rolls five skills with Strength while raging, 생각 없는 격노 is an immunity (D277)", async () => {
  const { pcStats, resolveAction } = await import("../../client/rules/actions");
  const cat = catalog();
  const barbarian = build({ name: "바바리안", classes: "barbarian", level: 18, abilities: { str: 20, dex: 12 } });
  const raging = (source: typeof barbarian.source) => deriveCharacter(source, cat, { effects: [{ key: "feature:barbarian.rage", name: "격노", source: "feature", duration: "10분", concentration: false, rounds: 100, elapsed: 0, startedAt: "" }] });

  // 불굴의 힘: a Strength check never totals less than the Strength score, and a save still does not change.
  const stats = pcStats(barbarian.derived);
  assert.equal(stats.minimumCheckScore?.str, barbarian.derived.abilities.str.score);
  const escape = resolveAction({ kind: "escape", actor: { name: "바바리안", stats, conditions: ["붙잡힘"] }, random: () => 0, dc: 30 });
  assert.ok((escape.check?.total ?? 0) >= barbarian.derived.abilities.str.score, JSON.stringify(escape.check));

  // 원초적 지식: while raging, Stealth is rolled with Strength — and only while raging.
  const quiet = barbarian.derived.skills.find((skill) => skill.id === "stealth")!;
  const loud = raging(barbarian.source).skills.find((skill) => skill.id === "stealth")!;
  assert.equal(loud.bonus - quiet.bonus, barbarian.derived.abilities.str.modifier - barbarian.derived.abilities.dex.modifier, JSON.stringify([quiet.bonus, loud.bonus]));

  // 생각 없는 격노: a raging berserker is immune to 매혹 and 공포 rather than pressing a button to shed them.
  const berserker = build({ name: "광전사", classes: "barbarian", level: 6, choices: { "class.2.subclass": ["dnd.srd521.subclass.barbarian.path-of-the-berserker"] } });
  const mad = raging(berserker.source);
  assert.ok(["매혹", "공포"].every((condition) => mad.defenses.conditionImmunities.some((name) => name.startsWith(condition))), JSON.stringify(mad.defenses.conditionImmunities));
  assert.ok(!berserker.derived.defenses.conditionImmunities.some((name) => name.startsWith("공포")), "격노하지 않으면 면역이 아니다");

  // 광란: the extra dice are offered once the swing has landed, not before it is rolled.
  const { offeredRiders } = await import("../../client/rules/attackRiders");
  const axe = berserker.derived.attacks.find((attack) => attack.ability === "str" && !attack.range)!;
  const effects = ["격노", "무모한 공격"];
  assert.deepEqual(offeredRiders(berserker.derived, axe, { moment: "pre-roll", effects }).map((rider) => rider.key), []);
  assert.deepEqual(offeredRiders(berserker.derived, axe, { moment: "on-hit", effects }).map((rider) => rider.key), ["barbarian.berserker.frenzy"]);
});

test("V4p: 최상급 치유 maximizes a contract's healing, 신성 개입 pays for a 5th-level spell, 무리 파괴자 is a swing that costs nothing (D278)", async () => {
  const { castSpell } = await import("../../client/character/play");
  const cat = catalog();

  // 최상급 치유: the sheet's own healing use rolls its dice at maximum.
  const cleric = build({ name: "클레릭", classes: "cleric", level: 17, abilities: { wis: 18 }, choices: { "class.2.subclass": ["dnd.srd521.subclass.cleric.life-domain"] } });
  assert.equal(cleric.derived.healingMaximized, true);
  const spark = tableOutcome(cleric.derived, cat, "cleric.channel-divinity#divine-spark-heal")!;
  assert.equal(spark.party.healMaximized, true, JSON.stringify(spark.party));
  const younger = build({ name: "16레벨 클레릭", classes: "cleric", level: 16, abilities: { wis: 18 } });
  assert.notEqual(tableOutcome(younger.derived, cat, "cleric.channel-divinity#divine-spark-heal")?.party.healMaximized, true, "17레벨이 되기 전에는 최대값이 아니다");

  // 신성 개입: the class pool pays for any prepared cleric spell of 5th level or lower.
  const pool = cleric.derived.resources.find((resource) => resource.id === "resource.cleric.divine-intervention")!;
  assert.equal(pool.freeCastMaxLevel, 5);
  const cast = castSpell(initialRuntime(cleric.derived), cleric.derived, { id: "x", name: "5레벨 주문", level: 5 }, { kind: "resource", id: pool.id });
  assert.ok(cast && cast.resourcesUsed[pool.id] === 1, "5레벨까지는 그 풀로");
  assert.equal(castSpell(initialRuntime(cleric.derived), cleric.derived, { id: "y", name: "6레벨 주문", level: 6 }, { kind: "resource", id: pool.id }), null, "6레벨은 아니다");

  // 무리 파괴자: the extra swing is offered and costs no part of the turn.
  const ranger = build({ name: "레인저", classes: "ranger", level: 5, choices: { "class.2.subclass": ["dnd.srd521.subclass.ranger.hunter"], "class.2.subclass.hunters-prey": ["horde-breaker"] } });
  const swing = (ranger.derived.bonusActions ?? []).find((item) => item.kind === "attack" && item.free);
  assert.ok(swing, JSON.stringify(ranger.derived.bonusActions));
  assert.equal(swing!.attackScope, "weapon");
});

test("V4q: 야생 동반자 casts Find Familiar from the Wild Shape pool, and 자연 회복 carries its own free cast (D279)", async () => {
  const { castSpell } = await import("../../client/character/play");
  const cat = catalog();
  const druid = build({ name: "드루이드", classes: "druid", level: 6, abilities: { wis: 16 }, choices: { "class.2.subclass": ["dnd.srd521.subclass.druid.circle-of-the-land"] } });

  // 야생 동반자: the pool that turns into a beast also pays for the familiar.
  const shape = druid.derived.resources.find((resource) => resource.id === "resource.druid.wild-shape")!;
  const familiar = cat.spellByName("Find Familiar")!;
  assert.equal(shape.freeCastSpellId, familiar.id);
  const spent = castSpell(initialRuntime(druid.derived), druid.derived, { id: familiar.id, name: familiar.name, level: familiar.level }, { kind: "resource", id: shape.id })!;
  assert.equal(spent.resourcesUsed[shape.id], 1);

  // 자연 회복: one circle spell without a slot, once a long rest, and nothing above 5th level.
  const pool = druid.derived.resources.find((resource) => resource.id === "resource.druid.natural-recovery-cast")!;
  assert.equal(pool.freeCastMaxLevel, 5);
  assert.ok(castSpell(initialRuntime(druid.derived), druid.derived, { id: "x", name: "5레벨", level: 5 }, { kind: "resource", id: pool.id }));
  assert.equal(castSpell(initialRuntime(druid.derived), druid.derived, { id: "y", name: "6레벨", level: 6 }, { kind: "resource", id: pool.id }), null);

  // 자연의 성역: the use spends a Wild Shape use and takes the Magic action.
  const sanctuary = druid.derived.features.find((feature) => feature.name.includes("자연의 성역"));
  if (sanctuary) {
    const activation = featureActivation(sanctuary, druid.derived, contractDurations(cat, characterScope(druid.derived)))!;
    assert.equal(activation.economy, "action");
    assert.equal(activation.resourceId, "resource.druid.wild-shape");
  }
});

test("V4r: a metamagic rides on the cast — 고조된 주문 spends its points and the target saves at disadvantage (D280)", async () => {
  const { metamagicOptions } = await import("../../client/rules/contractActivation");
  const cat = catalog();
  // Every die rolls high so a save at disadvantage is visibly the lower of two.
  const t = await table([{ classes: "sorcerer", level: 5, abilities: { cha: 18 }, choices: { "class.0.metamagic": ["metamagic.heightened-spell", "metamagic.quickened-spell"] } }], [dummy("좀비", 60)], () => 0.9);
  const sorcerer = t.made[0].derived;
  const options = metamagicOptions(sorcerer, cat, characterScope(sorcerer));
  const heightened = options.find((option) => option.key === "metamagic.heightened-spell")!;
  assert.ok(heightened, JSON.stringify(options.map((option) => option.name)));
  assert.equal(heightened.cost, 2);
  assert.equal(heightened.effect, "target-save-disadvantage");
  assert.equal(options.find((option) => option.key === "metamagic.quickened-spell")?.effect, "bonus-action");

  const burning = cat.spellByName("Burning Hands")?.id ?? "dnd.srd521.spell.burning-hands";
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: burning, targets: [t.ref(1)], method: { kind: "slot", level: 1 }, metamagic: [heightened.key] });
  await tick();
  const card = t.host.archive.filter((message) => message.type === "spell").at(-1)!;
  assert.ok(card.content.includes(heightened.name), card.content);
  const row = card.spell!.targets[0];
  assert.equal(row.save?.disadvantage, heightened.name, JSON.stringify(row.save));
  const sheet = t.entry(0) as ReturnType<typeof newJournalCharacter>;
  assert.equal(sheet.runtime.resourcesUsed["resource.sorcerer.sorcery-points"], 2, "마법 점수 2점");
});

test("V4s: 나무 몽둥이 reads its weapons and dice from the spell, 투명화 ends when its bearer attacks, and 마법 무기 has its slot variants (D281)", async () => {
  const { variantsOf } = await import("../../client/compendium/spells");
  const { castSpell: castSpellFromSheet } = await import("../../client/character/play");
  const cat = catalog();

  // 나무 몽둥이: no weapon ids in the code — the spell names the club and the quarterstaff, and the die is its own.
  const druid = build({ name: "드루이드", classes: "druid", level: 11, abilities: { wis: 18 }, equipment: { mode: "loadout" } });
  const armed = deriveCharacter(druid.source, cat, { effects: [{ key: "spell:dnd.srd521.spell.shillelagh", name: "나무 몽둥이", source: "spell", duration: "1분", concentration: false, rounds: 10, elapsed: 0, startedAt: "" }] });
  const staff = armed.attacks.find((attack) => attack.itemId?.endsWith("quarterstaff"));
  if (staff) assert.equal(staff.damage, "1d12", JSON.stringify([staff.name, staff.damage]));

  // 투명화: the spell's own data says the effect ends when its bearer attacks or casts, and a cast carries that.
  const { spellExec } = await import("../../client/compendium/spells");
  const invisibility = cat.spellByName("Invisibility")?.id ?? "dnd.srd521.spell.invisibility";
  assert.equal(spellExec(invisibility)?.effects?.[0].termination?.bearerAttacksOrCasts, true);
  const wizard = build({ name: "위저드", classes: "wizard", level: 5, abilities: { int: 16 } });
  const cast = castSpellFromSheet(initialRuntime(wizard.derived), wizard.derived, { id: invisibility, name: "투명화", level: 2, duration: "집중, 최대 1시간", consumeOn: "attack-or-cast" }, { kind: "slot", level: 2 })!;
  assert.equal((cast.effects ?? []).find((effect) => effect.key === `spell:${invisibility}`)?.consumeOn, "attack-or-cast");

  // …and the table sheds it when that bearer swings.
  const t = await table([{ classes: "wizard", level: 5, abilities: { int: 16 }, runtime: (runtime) => ({ ...runtime, effects: [{ key: `spell:${invisibility}`, name: "투명화", source: "spell", duration: "집중, 최대 1시간", concentration: true, rounds: 600, elapsed: 0, startedAt: "", consumeOn: "attack-or-cast" }] }) }], [dummy("좀비", 40)], () => 0.5);
  const blade = t.made[0].derived.attacks[0];
  t.dm.send({ type: "act.attack", attacker: t.ref(0), targets: [t.ref(1)], attack: { source: "weapon", attackId: blade.id }, overrides: { outcome: "hit" } });
  await tick();
  for (const prompt of openHits(t)) t.dm.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  assert.ok(!((t.entry(0) as ReturnType<typeof newJournalCharacter>).runtime.effects ?? []).some((effect) => effect.key === `spell:${invisibility}`), JSON.stringify((t.entry(0) as ReturnType<typeof newJournalCharacter>).runtime.effects));

  // 마법 무기: the bigger slots are variants the caster picks, not a sentence.
  assert.deepEqual(variantsOf("dnd.srd521.spell.magic-weapon").map((variant) => variant.id), ["plus-two", "plus-three"]);
});

test("V4t: a spell's own turn-start rule runs at the table — 영웅심's temp HP and 작열하는 강타's fire (D282)", async () => {
  // 영웅심 on a paladin: temporary hit points equal to the caster's Charisma, every turn it starts.
  const t = await table([
    { classes: "paladin", level: 5, abilities: { cha: 16 }, runtime: (runtime) => ({ ...runtime, effects: [{ key: "spell:dnd.srd521.spell.heroism", name: "영웅심", source: "spell", duration: "집중, 최대 1분", concentration: true, rounds: 10, elapsed: 0, startedAt: "" }] }) },
    { classes: "fighter", level: 5, runtime: (runtime) => ({ ...runtime, effects: [{ key: "spell:dnd.srd521.spell.searing-smite", name: "작열하는 강타", source: "spell", duration: "집중, 최대 1분", concentration: false, rounds: 10, elapsed: 0, startedAt: "", bearer: true }] }) },
  ], [], () => 0.5);
  for (const [index, name] of [[0, "팔라딘"], [1, "파이터"]] as Array<[number, string]>) {
    t.dm.send({ type: "tracker.add", turn: { name, tokenId: t.ref(index).tokenId, pageId: t.scene.id, entryId: t.ref(index).entryId, initiative: 20 - index } });
  }
  t.dm.send({ type: "tracker.next" });
  await tick();
  const paladin = t.entry(0) as ReturnType<typeof newJournalCharacter>;
  assert.equal(paladin.runtime.hp.temp, 3, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));

  // 작열하는 강타: the creature carrying it takes its fire damage when its own turn starts.
  const before = (t.entry(1) as ReturnType<typeof newJournalCharacter>).runtime.hp.current;
  t.dm.send({ type: "tracker.next" });
  await tick();
  const after = (t.entry(1) as ReturnType<typeof newJournalCharacter>).runtime.hp.current;
  assert.ok(after < before, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
});

test("V4u: 죽음 방비 stops a dying character, 흡혈의 손길 gives its caster half back, 지옥의 응징 is offered as a reaction (D283)", async () => {
  const { reactionSpellIds } = await import("../../client/compendium/spells");
  const cat = catalog();

  // 지옥의 응징: the table offers it in the window an attack that hit the caster opens.
  assert.ok(reactionSpellIds("attack.hit-self").includes("dnd.srd521.spell.hellish-rebuke"));

  // 죽음 방비: the cleric's cantrip stops the fighter's death saves.
  const t = await table([
    { classes: "cleric", level: 3, abilities: { wis: 16 } },
    { classes: "fighter", level: 3, runtime: (runtime) => ({ ...runtime, hp: { ...runtime.hp, current: 0 }, deathSaves: { success: 0, failure: 2 } }) },
  ], [], () => 0.5);
  const outcome = tableOutcome(t.made[0].derived, cat, "spell.dnd.srd521.spell.spare-the-dying") ?? tableOutcome(t.made[0].derived, cat, "dnd.srd521.spell.spare-the-dying");
  void outcome;
  t.dm.send({ type: "act.contract", actor: t.ref(0), ruleKey: "spell:dnd.srd521.spell.spare-the-dying", targets: [t.ref(1)] });
  await tick();
  const fighter = t.entry(1) as ReturnType<typeof newJournalCharacter>;
  assert.equal(fighter.runtime.deathSaves.success, 3, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));

  // 흡혈의 손길: the caster regains half of what it dealt.
  const dark = await table([{ classes: "wizard", level: 5, abilities: { int: 18 }, runtime: (runtime) => ({ ...runtime, hp: { ...runtime.hp, current: 5 } }) }], [dummy("좀비", 80)], () => 0.99);
  dark.dm.send({ type: "act.cast", caster: dark.ref(0), spellId: "dnd.srd521.spell.vampiric-touch", targets: [dark.ref(1)], method: { kind: "slot", level: 3 }, overrides: { outcome: "hit" } });
  await tick();
  const wizard = dark.entry(0) as ReturnType<typeof newJournalCharacter>;
  assert.ok(wizard.runtime.hp.current > 5, JSON.stringify(dark.host.archive.slice(-3).map((message) => message.content)));
});

test("V4v: a bigger slot reaches more creatures — 축복 at 3rd takes five, and the table refuses a sixth (D284)", async () => {
  const { spellExec, targetCountOf } = await import("../../client/compendium/spells");
  const bless = spellExec("dnd.srd521.spell.bless")!;
  assert.equal(bless.targeting.targetsPerSlotAboveBase, 1);
  assert.equal(targetCountOf(bless, 1), 3);
  assert.equal(targetCountOf(bless, 3), 5);

  const t = await table([
    { classes: "cleric", level: 9, abilities: { wis: 18 } },
    { classes: "fighter", level: 5 }, { classes: "rogue", level: 5 }, { classes: "wizard", level: 5 }, { classes: "bard", level: 5 },
  ], [], () => 0.5);
  const party = [1, 2, 3, 4].map((index) => t.ref(index));
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.bless", targets: [t.ref(0), ...party], method: { kind: "slot", level: 3 } });
  await tick();
  const card = t.host.archive.filter((message) => message.type === "spell").at(-1);
  assert.equal(card?.spell?.targets.length, 5, JSON.stringify(t.host.archive.slice(-2).map((message) => message.content)));
});

test("V4y: 잔혹한 일격 allows one effect, two from 17; 질풍 연타 puts its strikes on the menu (D287)", async () => {
  const { pcAttackSpec } = await import("../../client/rules/attackSpec");
  const cat = catalog();
  const keys = ["barbarian.brutal-strike#strike", "barbarian.brutal-strike#hamstring", "barbarian.brutal-strike#staggering"];

  // At 9 only one effect rides along with the strike; at 17 both do.
  for (const [level, effects] of [[9, 1], [17, 2]] as Array<[number, number]>) {
    const barbarian = build({ name: "바바리안", classes: "barbarian", level });
    assert.equal(barbarian.derived.forgoLimit, effects, `level ${level}`);
    const entry = newJournalCharacter("c", "p", barbarian.source, { ...initialRuntime(barbarian.derived), effects: [{ key: "feature:barbarian.reckless-attack", name: "무모한 공격", source: "feature", duration: "이 턴", concentration: false, rounds: 1, elapsed: 0, startedAt: "" }] });
    const axe = barbarian.derived.attacks.find((attack) => attack.ability === "str" && !attack.range)!;
    const spec = pcAttackSpec(entry, barbarian.derived, axe.id, { contracts: keys }, cat)!.spec;
    const named = (spec.riders ?? []).map((rider) => rider.label).filter((label) => label?.includes("일격"));
    assert.ok(named.length >= 1, JSON.stringify(spec.riders));
  }

  // 질풍 연타: the menu's own list carries the swings, and they cost nothing of the turn.
  const monk = build({ name: "몽크", classes: "monk", level: 10 });
  const swings = (monk.derived.bonusActions ?? []).find((item) => item.kind === "attack" && item.free)!;
  assert.deepEqual([swings.attackScope, swings.count, swings.free], ["unarmed", 3, true]);
});

test("V4z: a rule may wait on the option this sheet took — 향상된 축복받은 일격's temp HP only with 강력한 주문 시전 (D288)", async () => {
  const cat = catalog();
  const made = (option: string) => build({ name: "클레릭", classes: "cleric", level: 14, abilities: { wis: 18 }, choices: { "class.6.blessed-strikes": [`cleric.blessed-strikes.${option}`] } }, { "class.6.blessed-strikes": [`cleric.blessed-strikes.${option}`] });
  assert.equal(tableOutcome(made("potent-spellcasting").derived, cat, "cleric.improved-blessed-strikes#potent")?.party.tempHp, "8");
  assert.equal(tableOutcome(made("divine-strike").derived, cat, "cleric.improved-blessed-strikes#potent"), null, "신성한 일격을 골랐으면 임시 HP 줄은 없다");
  // D308: nor a line on the sheet.
  assert.ok(!made("divine-strike").derived.features.some((feature) => feature.id.endsWith("#potent")));
  assert.ok(made("potent-spellcasting").derived.features.some((feature) => feature.id.endsWith("#potent")));

  // 행동 폭증: the payment names a pool that exists, and the once-a-turn limit says whose call it is.
  const fighter = build({ name: "파이터", classes: "fighter", level: 17 });
  const surge = cat.contractFor("fighter.action-surge")!;
  assert.deepEqual(surge.payments.map((payment) => payment.resourceId), ["resource.fighter.action-surge"]);
  assert.ok(fighter.derived.resources.some((resource) => resource.id === "resource.fighter.action-surge"));
});

test("V5a: the spells that ask what they do now have their choices — 명령, 눈초리, 평온, 용의 숨결 (D289)", async () => {
  const { variantsOf, withVariant, spellExec } = await import("../../client/compendium/spells");
  assert.deepEqual(variantsOf("dnd.srd521.spell.command").map((variant) => variant.id), ["grovel", "flee", "halt", "approach", "drop"]);
  assert.deepEqual(variantsOf("dnd.srd521.spell.eyebite").map((variant) => variant.id), ["asleep", "panicked", "sickened"]);
  assert.deepEqual(variantsOf("dnd.srd521.spell.calm-emotions").map((variant) => variant.id), ["suppress-charm-fear", "suppress-hostility"]);

  // 엎드려: the chosen word is what the failed save leaves behind.
  const grovel = withVariant(spellExec("dnd.srd521.spell.command")!, "grovel");
  assert.equal(grovel.label, "엎드려");
  assert.deepEqual(grovel.exec.effects?.map((effect) => effect.conditionId), ["prone"]);

  // 용의 숨결: the damage type is the caster's to choose, and the save halves it.
  const fire = withVariant(spellExec("dnd.srd521.spell.dragon-s-breath")!, "fire");
  assert.equal(fire.exec.primary.kind, "save-damage");
  assert.equal("damageType" in fire.exec.primary ? fire.exec.primary.damageType : undefined, "fire");

  // At the table: the cast carries the variant into the card.
  const t = await table([{ classes: "wizard", level: 5, abilities: { int: 16 } }], [dummy("좀비", 40)], () => 0.5);
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.command", targets: [t.ref(1)], method: { kind: "slot", level: 1 }, variant: "grovel" });
  await tick();
  const card = t.host.archive.filter((message) => message.type === "spell").at(-1)!;
  assert.ok(card.content.includes("엎드려"), card.content);
});

test("V5b: 빛나는 강타 marks what it hit, 신속한 후퇴 puts Dash in the bonus menu, 악취 구름's poison lasts a turn (D290)", async () => {
  const { spellExec, onHitOf } = await import("../../client/compendium/spells");
  const cat = catalog();

  // 빛나는 강타: the glow is a mark, so the next attack against that target has advantage.
  const smite = onHitOf(spellExec("dnd.srd521.spell.shining-smite")!)!;
  assert.deepEqual([smite.mark?.name, smite.mark?.nextAttack?.advantage, smite.mark?.nextAttack?.by], ["빛남 (빛나는 강타)", true, "any"]);

  // 신속한 후퇴: while it runs, Dash is on the bonus-action menu.
  const wizard = build({ name: "위저드", classes: "wizard", level: 5 });
  const hasty = deriveCharacter(wizard.source, cat, { effects: [{ key: "spell:dnd.srd521.spell.expeditious-retreat", name: "신속한 후퇴", source: "spell", duration: "집중, 최대 10분", concentration: true, rounds: 100, elapsed: 0, startedAt: "" }] });
  assert.ok((hasty.bonusActions ?? []).some((item) => item.kind === "dash"), JSON.stringify(hasty.bonusActions));

  // 악취 구름: the poison lasts until that creature's next turn starts, not for the whole spell.
  const cloud = spellExec("dnd.srd521.spell.stinking-cloud")!;
  assert.deepEqual(cloud.effects?.map((effect) => [effect.conditionId, effect.duration?.kind]), [["poisoned", "rounds"]]);
});

test("V5c: 환영 살인마 hurts its victim when that turn ends, with the save that avoids it (D291)", async () => {
  const t = await table([{ classes: "fighter", level: 5, runtime: (runtime) => ({ ...runtime, conditions: ["공포"], effects: [{ key: "spell:dnd.srd521.spell.phantasmal-killer", name: "환영 살인마", source: "spell", duration: "집중, 최대 1분", concentration: false, rounds: 10, elapsed: 0, startedAt: "", bearer: true }] }) }], [], () => 0.99);
  t.dm.send({ type: "tracker.add", turn: { name: "파이터", tokenId: t.ref(0).tokenId, pageId: t.scene.id, entryId: t.ref(0).entryId, initiative: 20 } });
  t.dm.send({ type: "tracker.next" });
  const before = (t.entry(0) as ReturnType<typeof newJournalCharacter>).runtime.hp.current;
  t.dm.send({ type: "tracker.next" });
  await tick();
  const after = (t.entry(0) as ReturnType<typeof newJournalCharacter>).runtime.hp.current;
  assert.ok(after <= before, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
  const card = t.host.archive.filter((message) => message.type === "spell" || message.type === "system").at(-1)!;
  assert.ok(/환영 살인마/.test(card.content ?? ""), card.content);
});

test("V5d: 산성 화살 keeps burning — the hit starts an effect and that creature's next turn opens with 2d4 (D292)", async () => {
  const { spellExec } = await import("../../client/compendium/spells");
  const exec = spellExec("dnd.srd521.spell.acid-arrow")!;
  assert.equal(exec.primary.kind, "attack-damage");
  assert.deepEqual(exec.trackedEffects?.map((effect) => effect.trigger), ["hit"]);

  // The table: a creature carrying the acid takes it again when its turn starts.
  const t = await table([{ classes: "fighter", level: 3, runtime: (runtime) => ({ ...runtime, effects: [{ key: "spell:dnd.srd521.spell.acid-arrow", name: "산성 화살", source: "spell", duration: "1라운드", concentration: false, rounds: 1, elapsed: 0, startedAt: "", bearer: true }] }) }], [], () => 0.5);
  t.dm.send({ type: "tracker.add", turn: { name: "파이터", tokenId: t.ref(0).tokenId, pageId: t.scene.id, entryId: t.ref(0).entryId, initiative: 20 } });
  const before = (t.entry(0) as ReturnType<typeof newJournalCharacter>).runtime.hp.current;
  t.dm.send({ type: "tracker.next" });
  await tick();
  const after = (t.entry(0) as ReturnType<typeof newJournalCharacter>).runtime.hp.current;
  assert.ok(after < before, JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
});

test("V5e: 얼음 칼 rolls its attack, 화염검 is a bonus action and swings again as an action (D293)", async () => {
  const { spellExec, sustainOf } = await import("../../client/compendium/spells");
  const knife = spellExec("dnd.srd521.spell.ice-knife")!;
  assert.equal(knife.primary.kind, "attack-damage");
  assert.equal("damageType" in knife.primary ? knife.primary.damageType : undefined, "piercing");

  const blade = spellExec("dnd.srd521.spell.flame-blade")!;
  assert.equal(blade.castingEconomy, "bonus-action");
  assert.equal(sustainOf(blade)?.economy, "action");

  // At the table the shard is an attack card, not a note.
  const t = await table([{ classes: "druid", level: 5, abilities: { wis: 16 } }], [dummy("좀비", 40)], () => 0.9);
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.ice-knife", targets: [t.ref(1)], method: { kind: "slot", level: 1 }, overrides: { outcome: "hit" } });
  await tick();
  const card = t.host.archive.filter((message) => message.type === "spell").at(-1)!;
  assert.ok(/적중|명중/.test(card.content ?? ""), card.content);
});

test("V5f: 혼란 repeats its save, and the spells the app cannot finish say why on the sheet (D294)", async () => {
  const { spellExec, repeatSaveOf } = await import("../../client/compendium/spells");
  const cat = catalog();
  assert.equal(repeatSaveOf(spellExec("dnd.srd521.spell.confusion")!), "turn-end");

  // 수면 is already what the 2024 rule says: incapacitated until the end of its next turn, and damage ends it.
  const sleep = spellExec("dnd.srd521.spell.sleep")!;
  assert.deepEqual(sleep.effects?.map((effect) => [effect.conditionId, effect.termination?.targetTakesDamage]), [["incapacitated", true]]);

  // What is left to the table carries its reason, spell by spell.
  for (const key of ["divine-word", "prismatic-spray", "blink", "warding-bond", "grease"]) {
    const contract = cat.contractFor(`spell:dnd.srd521.spell.${key}`);
    const questions = (contract?.entryPoints ?? []).flatMap((entry) => entry.operations).flatMap((operation) => (operation.kind === "adjudication.request" ? [operation.question] : []));
    assert.ok(questions.some((question) => question.startsWith("DM 판정 (")), `${key}: ${JSON.stringify(questions)}`);
  }
});

test("V5g: 거인 혈통 gives the power of the ancestry chosen, and the traits the app cannot finish carry their reason (D295, D308)", async () => {
  const cat = catalog();
  // D308: the hill giant's power, and only it — a hit's choice that knocks a Large or smaller target prone, no save (2024).
  const goliath = build({ name: "골리앗", species: "goliath", classes: "fighter", level: 5, abilities: { con: 16 } }, { "origin.species.giantAncestry": ["hill"] });
  const riders = (goliath.derived.attackRiders ?? []).filter((rider) => rider.key.includes("giant-ancestry"));
  assert.equal(riders.length, 1, JSON.stringify(riders.map((rider) => rider.key)));
  assert.equal(riders[0].moment, "on-hit");
  assert.deepEqual(riders[0].conditions, ["넘어짐"]);
  assert.deepEqual(riders[0].saves, []);

  for (const key of ["species.halfling-nimbleness", "species.naturally-stealthy", "species.trance", "spell:dnd.srd521.spell.polymorph"]) {
    const contract = cat.contractFor(key.startsWith("spell:") ? key : `feature:${key}`);
    const questions = (contract?.entryPoints ?? []).flatMap((entry) => entry.operations).flatMap((operation) => (operation.kind === "adjudication.request" ? [operation.question] : []));
    assert.ok(questions.some((question) => question.startsWith("DM 판정 (")), `${key}: ${JSON.stringify(questions)}`);
  }
});

test("V5h: 선천 마법 중에는 메타매직이 둘, 비전의 신격이면 첫 하나는 공짜 (D296)", async () => {
  const cat = catalog();
  const innate = (level: number) => {
    const made = build({ name: "소서러", classes: "sorcerer", level, abilities: { cha: 18 }, choices: { "class.0.metamagic": ["metamagic.quickened-spell", "metamagic.careful-spell"] } }, { "class.0.metamagic": ["metamagic.quickened-spell", "metamagic.careful-spell"] });
    return deriveCharacter(made.source, cat, { effects: [{ key: "feature:sorcerer.innate-sorcery", name: "선천 마법", source: "feature", duration: "1분 (10라운드)", concentration: false, rounds: 10, elapsed: 0, startedAt: "" }] });
  };
  // 7레벨 마력의 현신: two metamagics on one spell while it runs.
  assert.equal(innate(7).metamagicLimit, 2);
  assert.notEqual(build({ name: "소서러", classes: "sorcerer", level: 7 }).derived.metamagicLimit, 2, "선천 마법이 꺼져 있으면 하나");
  // 20레벨 비전의 신격: the first one costs nothing.
  assert.equal(innate(20).metamagicFree, true);
  assert.notEqual(innate(7).metamagicFree, true);
});

test("V5i: 원소 친화 uses the sorcerer's own ability and 과부하 only maximizes wizard spells (D297)", async () => {
  const { pcSpell } = await import("../../client/rules/spellcast");
  const cat = catalog();
  const classes = ["sorcerer", "sorcerer", "sorcerer", "sorcerer", "sorcerer", "sorcerer", "wizard"];
  const made = build({ name: "혼합", classes, abilities: { cha: 18, int: 10 }, choices: { "class.2.subclass": ["dnd.srd521.subclass.sorcerer.draconic-sorcery"] } }, { "class.2.subclass": ["dnd.srd521.subclass.sorcerer.draconic-sorcery"] });
  assert.equal(made.derived.damageTypeModifierClass, "sorcerer", JSON.stringify(made.derived.damageTypeModifier));

  // 과부하: the maximizing names the wizard, so it never reaches a sorcerer spell.
  const evoker = build({ name: "방출학파", classes: ["wizard", "wizard", "wizard", "wizard", "wizard", "wizard", "wizard", "wizard", "wizard", "wizard", "wizard", "wizard", "wizard", "wizard", "sorcerer"], abilities: { int: 18, cha: 12 }, choices: { "class.2.subclass": ["dnd.srd521.subclass.wizard.evoker"] } }, { "class.2.subclass": ["dnd.srd521.subclass.wizard.evoker"] });
  const under = deriveCharacter(evoker.source, cat, { effects: [{ key: "feature:wizard.evoker.overchannel", name: "과부하", source: "feature", duration: "다음 주문까지", concentration: false, elapsed: 0, startedAt: "", consumeOn: "cast" }] });
  assert.equal(under.spellDamageMaximizedClass, "wizard");
  const entry = newJournalCharacter("c", "p", evoker.source, initialRuntime(under));
  const cast = pcSpell(entry, under, cat, "dnd.srd521.spell.magic-missile", { kind: "slot", level: 1 });
  void cast;
});

test("V5j: 반매혹 opens on an ally's failed save and rerolls it (D298)", async () => {
  // A wizard's 공포 against the fighter fails; the bard beside them answers.
  const t = await table([
    { classes: "wizard", level: 5, abilities: { int: 18 } },
    { classes: "fighter", level: 3, abilities: { wis: 6 } },
    { classes: "bard", level: 7, abilities: { cha: 16 } },
  ], [], () => 0.05);
  t.dm.send({ type: "act.cast", caster: t.ref(0), spellId: "dnd.srd521.spell.fear", targets: [t.ref(1)], method: { kind: "slot", level: 3 } });
  await tick();
  const ask = t.host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "rescue" && message.prompt.rescue?.interfere && !message.supersedes).at(-1);
  assert.ok(ask, JSON.stringify(t.host.archive.map((message) => [message.type, message.prompt?.kind, message.content?.slice(0, 40)])));
  assert.equal(ask!.prompt!.reactor!.entryId, t.ref(2).entryId, "창은 바드에게");
  assert.deepEqual(ask!.prompt!.rescue!.features, ["대응의 노래"]);
  assert.ok((ask!.prompt!.rescue!.facts ?? []).length >= 2, JSON.stringify(ask!.prompt!.rescue!.facts));
});

test("V5k: every audit item that stays with the table says why, on the sheet (D299)", async () => {
  const cat = catalog();
  const owners: Array<[string, string]> = [
    ["feature:bard.words-of-creation", "두 번째 대상"],
    ["feature:sorcerer.draconic.dragon-companion", "집중"],
    ["feature:wizard.memorize-spell", "준비 주문"],
    ["feature:rogue.thief.fast-hands", "마법 행동"],
    ["feature:barbarian.rage", "격노 중에는"],
    ["feat:epic.fate", "남의 판정"],
  ];
  for (const [key, needle] of owners) {
    const contract = cat.contractFor(key)!;
    const questions = (contract?.entryPoints ?? []).flatMap((entry) => entry.operations).flatMap((operation) => (operation.kind === "adjudication.request" ? [operation.question] : []));
    assert.ok(questions.some((question) => question.includes(needle)), `${key}: ${JSON.stringify(questions)}`);
  }
});
