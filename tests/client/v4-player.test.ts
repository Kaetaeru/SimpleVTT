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

test("V4c: 선천 마법 raises the spell save DC, 우월한 방어 resists all but force, 방출술 전문가's spells can be prepared (D265)", () => {
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
