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
async function table(pcs: Array<{ classes: string; level: number; choices?: Record<string, string[]>; runtime?: (runtime: CharacterRuntime) => CharacterRuntime; abilities?: Record<string, number> }>, npcs: Array<Record<string, unknown>>, random: () => number = () => 0.5) {
  const cat = catalog();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("V4", { userId: "dm", displayName: "DM" }), joinCode: "V4AAAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "V4AAAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "전장", 0);
  dm.send({ type: "page.put", page: scene });
  const made = pcs.map((pc, index) => build({ name: `PC${index}`, classes: pc.classes, level: pc.level, abilities: { con: 14, ...(pc.abilities ?? {}) } }, pc.choices ?? {}));
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
