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
