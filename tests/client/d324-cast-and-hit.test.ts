/**
 * V0.9 D324 (SRD_MODULE_PLAN.md §8): what a use spends and gets back, at the moment it happens.
 *
 * - 생명 흡수자 spends one Hit Point Die on a hit and heals by what it rolls (the card used to say "DM 판정").
 * - 주문 회상의 은총 rolls a d4 as a 1st–4th level spell is cast; matching the slot level keeps the slot.
 * - 지옥으로 내던지기 deals its 8d10 only when the Charisma save fails.
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { JournalCharacter } from "../../client/campaign/journal";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import { autofill } from "../../client/character/autofill";
import { initialRuntime } from "../../client/character/runtime";
import { parseCustomMonster } from "../../client/compendium/customMonster";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { pcHostOptions } from "../../client/session/pcHost";
import { MemoryHub } from "../../client/session/transport";
import { sourceOf } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const dummy = () => (parseCustomMonster(JSON.stringify({ name: "허수아비", ac: 5, hp: 60, creatureType: "construct", abilities: { str: 10, dex: 6, con: 14, int: 1, wis: 6, cha: 1 } })) as { monster: Parameters<typeof newJournalNpc>[2] }).monster;

async function table(make: Record<string, unknown>, random = () => 0.5) {
  const cat = createCatalog([]);
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("D324 시험", { userId: "dm", displayName: "DM" }), joinCode: "D324AA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random, ...pcHostOptions(() => cat) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "D324AA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "안뜰", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = autofill(sourceOf(make as never), cat, { prefer: (make.choices ?? {}) as Record<string, string[]> });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const npc = newJournalNpc(campaign.id, "dm", dummy());
  for (const entry of [pc, npc]) dm.send({ type: "journal.put", entry });
  await tick();
  const tokens = { pc: tokenForCharacter(pc), npc: tokenForNpc(npc) };
  for (const token of Object.values(tokens)) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  return { cat, host, dm, made, scene,
    refs: { pc: { entryId: pc.id, pageId: scene.id, tokenId: tokens.pc.id }, npc: { entryId: npc.id, pageId: scene.id, tokenId: tokens.npc.id } },
    pcEntry: () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter };
}

test("D324: 생명 흡수자 spends a Hit Point Die on the hit and heals by it", async () => {
  const choices = { "class.0.invocations": ["invocation.pact-of-the-blade", "invocation.lifedrinker"] };
  const t = await table({ name: "워락", classes: "warlock", level: 12, abilities: { cha: 18 }, choices });
  const rider = t.made.derived.attackRiders?.find((item) => item.heal?.hitDice);
  assert.ok(rider, `the rider spends a die: ${JSON.stringify(t.made.derived.attackRiders?.map((item) => item.label))}`);
  const hurt = { ...t.pcEntry().runtime.hp, current: 10 };
  t.dm.send({ type: "journal.put", entry: { ...t.pcEntry(), runtime: { ...t.pcEntry().runtime, hp: hurt, updatedAt: new Date().toISOString() } } });
  await tick();
  const attack = t.made.derived.attacks[0];
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.npc], attack: { source: "weapon", attackId: attack.id }, overrides: { outcome: "hit" } });
  await tick();
  // The invocation is offered in the window the hit opens; taking it spends the die.
  const prompt = t.host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "on-hit" && !message.prompt.outcome).pop();
  assert.ok(prompt, t.host.archive.slice(-3).map((message) => message.content).join(" | "));
  t.dm.send({ type: "act.onhit", messageId: prompt!.id, choices: [rider!.key] });
  await tick();
  const after = t.pcEntry();
  assert.ok(Object.values(after.runtime.hitDiceSpent).some((count) => count > 0), `a die was spent: ${JSON.stringify(after.runtime.hitDiceSpent)} · ${t.host.archive.slice(-3).map((message) => message.content).join(" | ")}`);
  assert.ok(after.runtime.hp.current > 10, `and the warlock healed (${after.runtime.hp.current})`);
});

test("D324: 주문 회상의 은총 keeps the slot when its d4 matches the slot level", async () => {
  // The host's roller is fixed: half of a d4 is a 3, so a 3rd-level slot comes straight back.
  const t = await table({ name: "마법사", classes: "wizard", level: 20, abilities: { int: 20 }, choices: { "class.18.epic-boon": ["dnd.srd521.feat.epic.spell-recall"] } }, () => 0.5);
  assert.ok(t.made.derived.features.some((feature) => feature.name.includes("주문 회상")), t.made.derived.features.slice(-4).map((feature) => feature.name).join(", "));
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: "dnd.srd521.spell.fireball", targets: [t.refs.npc], method: { kind: "slot", level: 3 } });
  await tick();
  assert.equal(t.pcEntry().runtime.slotsUsed[3] ?? 0, 0, `the 3rd-level slot came back: ${t.host.archive.slice(-3).map((message) => message.content).join(" | ")}`);
  assert.ok(t.host.archive.some((message) => message.content.includes("슬롯이 소모되지 않습니다")));
});

test("D324: 지옥으로 내던지기 deals nothing when the save is made", async () => {
  const t = await table({ name: "워락", classes: "warlock", level: 14, abilities: { cha: 18 }, choices: { "class.0.subclass": ["dnd.srd521.subclass.warlock.fiend"] } }, () => 0.99);
  const rider = t.made.derived.attackRiders?.find((item) => item.label.includes("지옥"));
  assert.ok(rider, `it is offered in the window a hit opens: ${JSON.stringify(t.made.derived.attackRiders?.map((item) => item.label))}`);
  const attack = t.made.derived.attacks[0];
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.npc], attack: { source: "weapon", attackId: attack.id }, overrides: { outcome: "hit" } });
  await tick();
  const prompt = t.host.archive.filter((message) => message.type === "prompt" && message.prompt?.kind === "on-hit" && !message.prompt.outcome).pop();
  assert.ok(prompt, "the window opened");
  t.dm.send({ type: "act.onhit", messageId: prompt!.id, choices: [rider!.key] });
  await tick();
  // The dummy saves (a 20 on the host's fixed roller), so the psychic damage never lands.
  const damage = t.host.archive.filter((message) => message.content.includes("정신")).map((message) => message.content).join(" | ");
  assert.ok(!/피해 [1-9]/.test(damage), damage || "(정신 피해 줄 없음)");
});
