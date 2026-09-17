/**
 * V0.9 V3 (ROLL20_TABLE_SPEC.md D256~): the playable gaps the playthrough audit named — each fixed through data and
 * proven at the table where the table is where it matters.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { characterScope, evaluate } from "../../client/rules/contract";
import { featureContract } from "../../client/rules/contractActivation";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("V3b: what the app already applies is not labelled 표에서 판단 (D256)", () => {
  const fighter = build({ name: "투사", classes: "fighter", level: 17 }).derived;
  const subclass = fighter.features.find((feature) => feature.name.startsWith("서브클래스"))!;
  assert.equal(subclass.execution, "derived", JSON.stringify(subclass));
  assert.equal(fighter.features.find((feature) => feature.name === "행동 폭증 2회")?.execution, "derived");
  const sorcerer = build({ name: "소서러", classes: "sorcerer", level: 6 }).derived;
  assert.equal(sorcerer.features.find((feature) => feature.name === "원소의 친화력")?.execution, "derived");
});

test("V3b: the champion asks for a second fighting style at 7, and 섬뜩한 대가 restores every pact slot (D256)", () => {
  const champion = build({ name: "투사", classes: "fighter", level: 7 }, { "class.2.subclass": ["dnd.srd521.subclass.fighter.champion"] });
  assert.ok(champion.derived.choices.some((choice) => choice.id === "class.6.fighting-style"), champion.derived.choices.map((choice) => choice.id).join(", "));
  const restore = (level: number) => {
    const derived = build({ name: "워락", classes: "warlock", level }).derived;
    const contract = featureContract(catalog(), "warlock.magical-cunning")!;
    const operation = contract.entryPoints[0].operations.find((item) => item.kind === "resource.change" && item.resourceId.includes("pact"))!;
    return { amount: evaluate((operation as { amount: Parameters<typeof evaluate>[0] }).amount, characterScope(derived)), slots: derived.pactMagic?.count ?? 0 };
  };
  const five = restore(5);
  assert.equal(five.amount, Math.ceil(five.slots / 2));
  const twenty = restore(20);
  assert.equal(twenty.amount, twenty.slots, "all of them at 20");
});

test("V3b: 공격 흘리기 opens only for bludgeoning, piercing or slashing below monk 13 (D256)", async () => {
  const cat = catalog();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("V3b", { userId: "dm", displayName: "DM" }), joinCode: "V3BAAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "V3BAAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "수련장", 0);
  dm.send({ type: "page.put", page: scene });
  const monk = build({ name: "몽크", classes: "monk", level: 5 });
  const pc = newJournalCharacter(campaign.id, "dm", monk.source, initialRuntime(monk.derived));
  const parsed = parseCustomMonster(JSON.stringify({ name: "불꽃 정령", ac: 12, hp: 30, abilities: { str: 10, dex: 14, con: 12, int: 6, wis: 10, cha: 6 },
    actions: [{ name: "불꽃 손", attack: { mode: "melee", bonus: 20, rangeFeet: 5, damage: [{ formula: "2d6", type: "fire" }] } }, { name: "주먹", attack: { mode: "melee", bonus: 20, rangeFeet: 5, damage: [{ formula: "2d6", type: "bludgeoning" }] } }] }));
  const npc = newJournalNpc(campaign.id, "dm", (parsed as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, npc: { entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id } };
  const guardPrompts = () => host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "guard" && !message.supersedes);
  dm.send({ type: "act.attack", attacker: refs.npc, targets: [refs.pc], attack: { source: "npc", actionName: "불꽃 손" } });
  await tick();
  assert.equal(guardPrompts().length, 0, "fire: no window");
  dm.send({ type: "act.attack", attacker: refs.npc, targets: [refs.pc], attack: { source: "npc", actionName: "주먹" } });
  await tick();
  assert.equal(guardPrompts().length, 1, "bludgeoning: 공격 흘리기 is offered");
});

async function soloTable(cls: string, level: number, choices: Record<string, string[]>, random: () => number, runtimeOf?: (runtime: ReturnType<typeof initialRuntime>) => ReturnType<typeof initialRuntime>) {
  const cat = catalog();
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("V3c", { userId: "dm", displayName: "DM" }), joinCode: "V3CAAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "V3CAAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "막사", 0);
  dm.send({ type: "page.put", page: scene });
  const made = build({ name: "주인공", classes: cls, level, abilities: { con: 14 } }, choices);
  const runtime = initialRuntime(made.derived);
  const pc = newJournalCharacter(campaign.id, "dm", made.source, runtimeOf ? runtimeOf(runtime) : runtime);
  dm.send({ type: "journal.put", entry: pc });
  await tick();
  const token = tokenForCharacter(pc);
  dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const ref = { entryId: pc.id, pageId: scene.id, tokenId: token.id };
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as ReturnType<typeof newJournalCharacter>;
  return { host, dm, ref, sheet, made, scene, token, pc };
}

test("V3c: 생존자 heals at the start of the champion's turn while bloodied, and gives advantage on death saves (D257)", async () => {
  const champion = { "class.2.subclass": ["dnd.srd521.subclass.fighter.champion"] };
  const t = await soloTable("fighter", 18, champion, () => 0.5, (runtime) => ({ ...runtime, hp: { ...runtime.hp, current: 20 } }));
  const max = t.made.derived.hp.max;
  assert.ok(20 * 2 <= max, `bloodied at 20 of ${max}`);
  t.dm.send({ type: "tracker.add", turn: { name: "투사", tokenId: t.token.id, pageId: t.scene.id, entryId: t.pc.id, initiative: 10 } });
  t.dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(t.sheet().runtime.hp.current, 20 + 5 + t.made.derived.abilities.con.modifier, JSON.stringify(t.host.archive.slice(-2).map((message) => message.content)));
  // At 0 HP there is no healing (it needs 1 HP), and the death save rolls two dice and keeps the better: 3 and 19.
  const values = [0.1, 0.9];
  const down = await soloTable("fighter", 18, champion, () => values.shift() ?? 0.5, (runtime) => ({ ...runtime, hp: { ...runtime.hp, current: 0 }, conditions: ["무의식"] }));
  down.dm.send({ type: "tracker.add", turn: { name: "투사", tokenId: down.token.id, pageId: down.scene.id, entryId: down.pc.id, initiative: 10 } });
  down.dm.send({ type: "tracker.next" });
  await tick();
  // V4h (D270): 생존자 also counts an 18 or 19 as a 20, so the kept 19 stands the champion up at 1 HP.
  assert.equal(down.sheet().runtime.hp.current, 1, JSON.stringify(down.host.archive.slice(-2).map((message) => message.content)));
  assert.deepEqual(down.sheet().runtime.deathSaves, { success: 0, failure: 0 });
});

test("V3c: 믿음직한 재능 turns a proficient check's low d20 into 10 at the table (D257)", async () => {
  const t = await soloTable("rogue", 7, { "class.0.skills": ["stealth", "perception", "acrobatics", "insight"] }, () => 0.05);
  t.dm.send({ type: "act.action", actor: t.ref, kind: "hide" });
  await tick();
  const card = t.host.archive.filter((message) => message.type === "act" && message.act).at(-1)!;
  assert.equal(card.act!.check?.d20, 10, JSON.stringify(card.act!.check));
});

test("V3d: 몽크의 기 is three uses, each with its cost, economy and effect; 열린 손 기술 rides a 질풍 연타 hit (D258)", async () => {
  const { featureActivation } = await import("../../client/rules/activation");
  const { hitOffers } = await import("../../client/rules/attackSpec");
  const monk = build({ name: "몽크", classes: "monk", level: 10 }, { "class.2.subclass": ["dnd.srd521.subclass.monk.warrior-of-the-open-hand"] }).derived;
  const use = (name: string) => { const feature = monk.features.find((item) => item.name === name)!; assert.ok(feature, monk.features.map((item) => item.name).join(", ")); return featureActivation(feature, monk)!; };
  const flurry = use("질풍 연타");
  assert.deepEqual([flurry.resourceId, flurry.economy, flurry.duration?.(monk).rounds], ["resource.monk.focus", "bonus-action", 1]);
  assert.ok(flurry.note?.includes("3회"), flurry.note);
  assert.equal(use("인내의 방어").tempHp?.(monk), "2d8");
  assert.equal(use("바람의 걸음").economy, "bonus-action");
  assert.equal(monk.features.find((item) => item.name === "몽크의 기")?.execution, "derived");
  // The open hand riders are offered only while 질풍 연타 runs, on an unarmed strike.
  const fist = monk.attacks.find((attack) => !attack.itemId)!;
  const runtime = initialRuntime(monk);
  const keys = (effects: string[]) => hitOffers({ runtime: { ...runtime, effects: effects.map((name) => ({ key: `x:${name}`, name, source: "feature" as const, duration: "이번 턴", concentration: false, elapsed: 0, startedAt: "" })) } }, monk, fist.id).map((offer) => offer.key);
  assert.ok(!keys([]).some((key) => key.includes("open-hand-technique")), JSON.stringify(keys([])));
  assert.ok(keys(["질풍 연타"]).some((key) => key.endsWith("open-hand-technique#topple")), JSON.stringify(keys(["질풍 연타"])));

  // At the table, 인내의 방어 marks its user with 회피 and 이탈.
  const t = await soloTable("monk", 10, {}, () => 0.5);
  t.dm.send({ type: "act.contract", actor: t.ref, ruleKey: "monk.focus#patient-defense" });
  await tick();
  const token = t.host.pageList.find((page) => page.id === t.scene.id)!.tokens.find((item) => item.id === t.token.id)!;
  assert.deepEqual(token.markers.map((marker) => marker.name).filter((name) => name === "회피" || name === "이탈").sort(), ["이탈", "회피"], JSON.stringify(token.markers));
});

test("V3e: 교활한 일격 takes its dice from 암습 taken with it; 안정된 조준 is spent by the next attack; 교활한 행동 is the bonus action menu (D259)", async () => {
  const { pcAttackSpec } = await import("../../client/rules/attackSpec");
  const rogue = build({ name: "로그", classes: "rogue", level: 5 });
  const entry = newJournalCharacter("c", "p", rogue.source, initialRuntime(rogue.derived));
  const blade = rogue.derived.attacks.find((attack) => attack.properties.includes("finesse"))!;
  const trip = "rogue.cunning-strike#trip";
  const both = pcAttackSpec(entry, rogue.derived, blade.id, { contracts: ["rogue.sneak-attack", trip], facts: ["sneak-advantage"] }, catalog())!.spec;
  assert.equal(both.riders?.find((part) => part.label === "암습")?.formula, "2d6", "3d6 less the die 넘어뜨리기 took");
  assert.ok(both.hitSaves?.some((save) => save.condition === "prone" && save.ability === "dex"), JSON.stringify(both.hitSaves));
  const alone = pcAttackSpec(entry, rogue.derived, blade.id, { contracts: [trip] }, catalog())!.spec;
  assert.ok(!alone.hitSaves?.length, "without 암습 there are no dice to give up, so no effect");
  assert.deepEqual(rogue.derived.bonusActions?.filter((item) => item.source === "교활한 행동").map((item) => item.kind), ["dash", "disengage", "hide"]);

  // 안정된 조준 at the table: the attack is advantaged, and the effect is gone after it.
  const parsed = parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 10, hp: 40, abilities: { str: 10, dex: 10, con: 10, int: 1, wis: 1, cha: 1 }, actions: [] }));
  const t = await soloTable("rogue", 3, {}, () => 0.5, (runtime) => ({ ...runtime, effects: [{ key: "feature:rogue.steady-aim", name: "안정된 조준", source: "feature", duration: "다음 공격까지", concentration: false, rounds: 1, elapsed: 0, startedAt: "", consumeOn: "attack" }] }));
  const npc = newJournalNpc(t.pc.campaignId, "dm", (parsed as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  t.dm.send({ type: "journal.put", entry: npc });
  await tick();
  const npcToken = tokenForNpc(npc);
  t.dm.send({ type: "token.put", pageId: t.scene.id, token: npcToken });
  await tick();
  const weapon = t.made.derived.attacks.find((attack) => attack.itemId)!;
  t.dm.send({ type: "act.attack", attacker: t.ref, targets: [{ entryId: npc.id, pageId: t.scene.id, tokenId: npcToken.id }], attack: { source: "weapon", attackId: weapon.id } });
  await tick();
  for (const prompt of t.host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "on-hit" && !message.supersedes)) t.dm.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  const card = t.host.archive.filter((message) => message.type === "action" && message.action).at(-1)!;
  assert.ok(card.action!.reasons.join(" ").includes("안정된 조준"), JSON.stringify(card.action!.reasons));
  assert.ok(!t.sheet().runtime.effects.some((effect) => effect.key === "feature:rogue.steady-aim"), "spent by the attack");
});

test("V3f: 전술 통달, 전술적 이동, 신성 변환의 사용, 회복의 손길, 기회 공격 회피 (D260)", async () => {
  const { pcAttackSpec, pcCombatant } = await import("../../client/rules/attackSpec");
  const { tableOutcome } = await import("../../client/rules/contractTable");
  const { featureActivation } = await import("../../client/rules/activation");
  const { resolveAttack, diceFrom } = await import("../../client/rules/resolve");
  const cat = catalog();
  // 전술 통달: the swing uses the chosen mastery instead of the weapon's own.
  const fighter = build({ name: "투사", classes: "fighter", level: 9 });
  const entry = newJournalCharacter("c", "p", fighter.source, initialRuntime(fighter.derived));
  const mastered = fighter.derived.attacks.find((attack) => attack.masteryActive && attack.masteryKey && attack.masteryKey !== "sap")!;
  assert.ok(mastered, "a weapon with an active mastery");
  assert.equal(pcAttackSpec(entry, fighter.derived, mastered.id, { contracts: ["fighter.tactical-master#sap"] }, cat)!.spec.mastery, "sap");
  // 전술적 이동: 재기의 바람 marks 이탈 from fighter 5.
  assert.deepEqual(tableOutcome(fighter.derived, cat, "fighter.second-wind")?.selfMarks, ["이탈"]);
  // 신성 변환: 언데드 퇴치 rolls 언데드 소각's radiant d8s.
  const cleric = build({ name: "클레릭", classes: "cleric", level: 5, abilities: { wis: 16 } }).derived;
  const turn = featureActivation(cleric.features.find((feature) => feature.name === "언데드 퇴치")!, cleric)!;
  assert.deepEqual(tableOutcome(cleric, cat, "cleric.channel-divinity#turn-undead")?.strikes?.map((strike) => [strike.formula, strike.save?.ability, strike.save?.success]), [[`${cleric.abilities.wis.modifier}d8`, "wis", "none"]]);
  assert.equal(turn.resourceId, "resource.cleric.channel-divinity");
  // 회복의 손길: 5 points of 안수 take 실명 off the chosen creature.
  const paladin = build({ name: "팔라딘", classes: "paladin", level: 14 }).derived;
  const touch = paladin.features.find((feature) => feature.name === "회복의 손길: 실명")!;
  assert.deepEqual([featureActivation(touch, paladin)?.resourceId, featureActivation(touch, paladin)?.cost], ["resource.paladin.lay-on-hands", 5]);
  assert.deepEqual(tableOutcome(paladin, cat, "paladin.restoring-touch#blinded")?.conditionsRemoved, ["실명"]);
  // 기회 공격 회피: an opportunity attack against the hunter is at disadvantage; an ordinary one is not.
  const hunter = build({ name: "레인저", classes: "ranger", level: 7 }, { "class.2.subclass": ["dnd.srd521.subclass.ranger.hunter"], "class.6.subclass.defensive-tactics": ["escape-the-horde"] });
  const target = pcCombatant(newJournalCharacter("c", "p", hunter.source, initialRuntime(hunter.derived)), hunter.derived);
  assert.ok(target.opportunityDisadvantage?.length, JSON.stringify(hunter.derived.features.map((feature) => feature.name)));
  const attacker = pcCombatant(entry, fighter.derived);
  const spec = { name: "주먹", source: "npc" as const, attackBonus: 5, mode: "melee" as const, damage: [{ formula: "1d4", type: "타격" }] };
  assert.ok(resolveAttack(attacker, target, { ...spec, opportunity: true }, { dice: diceFrom(() => 0.5) }).reasons.some((reason) => reason.includes("기회 공격")));
  assert.ok(!resolveAttack(attacker, target, spec, { dice: diceFrom(() => 0.5) }).reasons.some((reason) => reason.includes("기회 공격")));
});

test("V3g: 주문 숙련 casts at will, 의식 숙련 casts spellbook rituals, 방출술 전문가 adds school picks, 과부하 maximizes the next spell (D261)", async () => {
  const { castSpell } = await import("../../client/character/play");
  const { castableSpells, pcSpell } = await import("../../client/rules/spellcast");
  const { castOptions } = await import("../../client/screens/SheetView");
  const { activateFeature } = await import("../../client/character/activate");
  const { pcAttackSpec } = await import("../../client/rules/attackSpec");
  const cat = catalog();
  // 주문 숙련: the free cast never runs out.
  const sage = build({ name: "위저드", classes: "wizard", level: 18 }).derived;
  const mastery = sage.resources.find((resource) => resource.atWill)!;
  assert.ok(mastery?.freeCastSpellId, JSON.stringify(sage.resources));
  const spell = cat.spellById(mastery.freeCastSpellId!)!;
  let runtime: ReturnType<typeof initialRuntime> | null = initialRuntime(sage);
  for (let cast = 0; cast < 3; cast += 1) runtime = castSpell(runtime!, sage, spell, { kind: "resource", id: mastery.id });
  assert.equal(runtime?.resourcesUsed[mastery.id] ?? 0, 0);
  // 방출술 전문가: an ask for free evocation spells, 2 + 1 for every two levels past 3.
  const savant = sage.choices.find((choice) => choice.id.endsWith(".evocation-savant"))!;
  assert.equal(savant.count, 9);
  assert.ok(savant.options.every((option) => cat.spellById(option.id)?.school === "evocation"));
  // 의식 숙련: a ritual in the book that is not prepared is castable, only as a ritual.
  const wizard = build({ name: "위저드", classes: "wizard", level: 14 });
  const list = wizard.derived.spellcasting.find((entry) => entry.source === "class")!;
  const ritual = list.spellbook!.find((id) => cat.spellById(id)?.ritual && !list.prepared.includes(id))!;
  assert.ok(ritual && castableSpells(wizard.derived).some((item) => item === ritual || (item as { id?: string }).id === ritual));
  const entry = newJournalCharacter("c", "p", wizard.source, initialRuntime(wizard.derived));
  assert.ok(pcSpell(entry, wizard.derived, cat, ritual, { kind: "ritual" }));
  assert.deepEqual(castOptions(cat.spellById(ritual)!, wizard.derived, entry.runtime, true).map((option) => option.method.kind), ["ritual"]);

  // 과부하 at the table: magic missile's darts count as 5 each, and the effect is spent by the cast.
  const t = await soloTable("wizard", 14, {}, () => 0, (base) => ({ ...base, effects: [{ key: "feature:wizard.evoker.overchannel", name: "과부하", source: "feature", duration: "다음 주문까지", concentration: false, elapsed: 0, startedAt: "", consumeOn: "cast" }] }));
  const parsed = parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 10, hp: 60, abilities: { str: 10, dex: 10, con: 10, int: 1, wis: 1, cha: 1 }, actions: [] }));
  const npc = newJournalNpc(t.pc.campaignId, "dm", (parsed as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  t.dm.send({ type: "journal.put", entry: npc });
  await tick();
  const npcToken = tokenForNpc(npc);
  t.dm.send({ type: "token.put", pageId: t.scene.id, token: npcToken });
  await tick();
  t.dm.send({ type: "act.cast", caster: t.ref, spellId: "dnd.srd521.spell.magic-missile", targets: [{ entryId: npc.id, pageId: t.scene.id, tokenId: npcToken.id }], method: { kind: "slot", level: 1 } });
  await tick();
  // At d4 = 1 the darts would deal 6; maximized they deal 15.
  assert.ok(t.host.archive.some((message) => message.content?.includes("피해 15")), JSON.stringify(t.host.archive.slice(-3).map((message) => message.content)));
  assert.ok(!t.sheet().runtime.effects.some((effect) => effect.key === "feature:wizard.evoker.overchannel"), "spent by the cast");

  // 원초의 일격: the chosen element rides a weapon hit, 2d8 at druid 15.
  const druid = build({ name: "드루이드", classes: "druid", level: 15 }, { "class.6.elemental-fury": ["druid.elemental-fury.primal-strike"] });
  const druidEntry = newJournalCharacter("c", "p", druid.source, initialRuntime(druid.derived));
  const staff = druid.derived.attacks.find((attack) => attack.itemId) ?? druid.derived.attacks[0];
  const strike = pcAttackSpec(druidEntry, druid.derived, staff.id, { contracts: ["druid.elemental-fury.primal-strike#fire"] }, cat)!.spec;
  assert.ok(strike.riders?.some((part) => part.formula === "2d8"), JSON.stringify(strike.riders));

  // 마귀의 회복력: a new type replaces the last one.
  const fiend = build({ name: "워락", classes: "warlock", level: 10 }, { "class.2.subclass": ["dnd.srd521.subclass.warlock.fiend-patron"] });
  let sheet = initialRuntime(fiend.derived);
  const deps = { source: fiend.source, catalog: cat, derived: fiend.derived, get runtime() { return sheet; }, rollDice: async (spec: { label: string; formula: string }) => ({ id: "r", at: "", label: spec.label, formula: spec.formula, total: 0, dice: [], modifier: 0 }), save: (update: (current: typeof sheet) => typeof sheet) => { sheet = update(sheet); } };
  for (const name of ["마귀의 회복력: 화염", "마귀의 회복력: 냉기"]) {
    const feature = fiend.derived.features.find((item) => item.name === name)!;
    assert.ok(feature, fiend.derived.features.map((item) => item.name).join(", "));
    assert.equal(await activateFeature(feature, deps as Parameters<typeof activateFeature>[1]), "done");
  }
  assert.deepEqual(sheet.effects.map((effect) => effect.name), ["마귀의 회복력: 냉기"]);
});

test("V3h: 잔혹한 일격 trades advantage for dice, 강화된 타격 deals force, 다중 공격 방어, 도둑의 반사신경, 영웅적 전사, spell grants (D262)", async () => {
  const { pcAttackSpec, pcCombatant } = await import("../../client/rules/attackSpec");
  const { resolveAttack, diceFrom } = await import("../../client/rules/resolve");
  const { deriveCharacter } = await import("../../client/character/derive");
  const cat = catalog();
  // 잔혹한 일격: with 무모한 공격 running, the strike gives up the advantage and adds 1d10 (2d10 at 17); its effects need it.
  const reckless = { key: "feature:barbarian.reckless-attack", name: "무모한 공격", source: "feature" as const, duration: "이 턴", concentration: false, rounds: 1, elapsed: 0, startedAt: "" };
  const swing = (level: number, contracts: string[]) => {
    const made = build({ name: "바바리안", classes: "barbarian", level });
    const derived = deriveCharacter(made.source, cat, { effects: [reckless] });
    const entry = newJournalCharacter("c", "p", made.source, { ...initialRuntime(derived), effects: [reckless] });
    const axe = derived.attacks.find((attack) => attack.itemId && attack.ability === "str")!;
    return { derived, entry, spec: pcAttackSpec(entry, derived, axe.id, { contracts }, cat)!.spec };
  };
  const nine = swing(9, ["barbarian.brutal-strike#strike", "barbarian.brutal-strike#forceful"]);
  assert.ok(nine.spec.riders?.some((part) => part.formula === "1d10"), JSON.stringify(nine.spec.riders));
  assert.ok(nine.spec.name.includes("강타"));
  const monk = build({ name: "몽크", classes: "monk", level: 6 });
  const monkEntry = newJournalCharacter("c", "p", monk.source, initialRuntime(monk.derived));
  const target = pcCombatant(monkEntry, monk.derived);
  const attacker = pcCombatant(nine.entry, nine.derived);
  const forgone = resolveAttack(attacker, target, nine.spec, { dice: diceFrom(() => 0.5) });
  assert.equal(forgone.advantage, "normal", JSON.stringify(forgone.reasons));
  assert.ok(forgone.reasons.some((reason) => reason.includes("유리 포기")));
  assert.equal(resolveAttack(attacker, target, swing(9, []).spec, { dice: diceFrom(() => 0.5) }).advantage, "advantage", "무모한 공격 alone keeps its advantage");
  assert.ok(!swing(9, ["barbarian.brutal-strike#forceful"]).spec.name.includes("강타"), "an effect without the strike is dropped");
  assert.ok(swing(17, ["barbarian.brutal-strike#strike"]).spec.riders?.some((part) => part.formula === "2d10"));
  // 강화된 타격: the unarmed strike deals force.
  const unarmed = monk.derived.attacks.find((attack) => !attack.itemId)!;
  assert.equal(pcAttackSpec(monkEntry, monk.derived, unarmed.id, { contracts: ["monk.empowered-strikes#force"] }, cat)!.spec.damage[0].type, "역장");
  // 마법 물건 사용, 창조의 언어, 마법의 발견.
  assert.equal(build({ name: "도둑", classes: "rogue", level: 13 }, { "class.2.subclass": ["dnd.srd521.subclass.rogue.thief"] }).derived.attunementBonus, 1);
  const bard = build({ name: "바드", classes: "bard", level: 20 }, { "class.2.subclass": ["dnd.srd521.subclass.bard.college-of-lore"] }).derived;
  const bardList = bard.spellcasting.find((entry) => entry.source === "class")!;
  assert.ok(["dnd.srd521.spell.power-word-heal", "dnd.srd521.spell.power-word-kill"].every((id) => bardList.alwaysPrepared.includes(id)), JSON.stringify(bardList.alwaysPrepared));
  const discoveries = bard.choices.find((choice) => choice.id.endsWith(".magical-discoveries"))!;
  assert.equal(discoveries?.count, 2, bard.choices.map((choice) => choice.id).join(", "));

  // 다중 공격 방어 at the table: the second swing of the creature that hit is at disadvantage, until its turn ends.
  const t = await soloTable("ranger", 7, { "class.2.subclass": ["dnd.srd521.subclass.ranger.hunter"], "class.6.subclass.defensive-tactics": ["multiattack-defense"] }, () => 0.5);
  const parsed = parseCustomMonster(JSON.stringify({ name: "오우거", ac: 11, hp: 60, abilities: { str: 18, dex: 8, con: 16, int: 5, wis: 7, cha: 7 }, actions: [{ name: "몽둥이", attack: { mode: "melee", bonus: 20, rangeFeet: 5, damage: [{ formula: "1d4", type: "bludgeoning" }] } }] }));
  const npc = newJournalNpc(t.pc.campaignId, "dm", (parsed as { monster: Parameters<typeof newJournalNpc>[2] }).monster);
  t.dm.send({ type: "journal.put", entry: npc });
  await tick();
  const npcToken = tokenForNpc(npc);
  t.dm.send({ type: "token.put", pageId: t.scene.id, token: npcToken });
  await tick();
  const npcRef = { entryId: npc.id, pageId: t.scene.id, tokenId: npcToken.id };
  const cards = () => t.host.archive.filter((message) => message.type === "action" && message.action);
  t.dm.send({ type: "act.attack", attacker: npcRef, targets: [t.ref], attack: { source: "npc", actionName: "몽둥이" } });
  await tick();
  assert.ok(!cards().at(-1)!.action!.reasons.some((reason) => reason.includes("다중 공격 방어")));
  t.dm.send({ type: "act.attack", attacker: npcRef, targets: [t.ref], attack: { source: "npc", actionName: "몽둥이" } });
  await tick();
  assert.equal(cards().at(-1)!.action!.advantage, "disadvantage", JSON.stringify(cards().at(-1)!.action!.reasons));
  t.dm.send({ type: "tracker.add", turn: { name: "오우거", tokenId: npcToken.id, pageId: t.scene.id, entryId: npc.id, initiative: 20 } });
  t.dm.send({ type: "tracker.add", turn: { name: "레인저", tokenId: t.token.id, pageId: t.scene.id, entryId: t.pc.id, initiative: 10 } });
  t.dm.send({ type: "tracker.next" });
  t.dm.send({ type: "tracker.next" });
  await tick();
  const marks = (t.host as unknown as { pages: Map<string, { tokens: Array<{ id: string; markers: Array<{ name: string }> }> }> }).pages.get(t.scene.id)!.tokens.find((token) => token.id === t.token.id)!.markers;
  assert.ok(!marks.some((marker) => marker.name === "맞힌 뒤 불리"), "gone when the ogre's turn ended");

  // 도둑의 반사신경: a second row at initiative − 10 for the first round only.
  const thief = await soloTable("rogue", 17, { "class.2.subclass": ["dnd.srd521.subclass.rogue.thief"] }, () => 0.5);
  thief.dm.send({ type: "tracker.add", turn: { name: "도둑", tokenId: thief.token.id, pageId: thief.scene.id, entryId: thief.pc.id, initiative: 18 } });
  await tick();
  const tracker = () => (thief.host as unknown as { tracker: { turns: Array<{ initiative: number; extra?: unknown }>; round: number } }).tracker;
  assert.deepEqual(tracker().turns.map((turn) => turn.initiative), [18, 8]);
  for (let step = 0; step < 3; step += 1) thief.dm.send({ type: "tracker.next" });
  await tick();
  assert.deepEqual(tracker().turns.map((turn) => turn.initiative), [18], "the extra row leaves with round 1");

  // 영웅적 전사: the turn starts with Heroic Inspiration.
  const champion = await soloTable("fighter", 10, { "class.2.subclass": ["dnd.srd521.subclass.fighter.champion"] }, () => 0.5);
  champion.dm.send({ type: "tracker.add", turn: { name: "투사", tokenId: champion.token.id, pageId: champion.scene.id, entryId: champion.pc.id, initiative: 10 } });
  champion.dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(champion.sheet().runtime.heroicInspiration, true);
});
