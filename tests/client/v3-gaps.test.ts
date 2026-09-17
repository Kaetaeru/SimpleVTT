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
  assert.equal(down.sheet().runtime.hp.current, 0, "no healing at 0 HP");
  assert.equal(down.sheet().runtime.deathSaves.success, 1, `19 kept: ${JSON.stringify(down.host.archive.slice(-2).map((message) => message.content))}`);
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
  const both = pcAttackSpec(entry, rogue.derived, blade.id, { contracts: ["rogue.sneak-attack", trip] }, catalog())!.spec;
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
