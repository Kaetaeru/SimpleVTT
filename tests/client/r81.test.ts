/**
 * R81 (ROLL20_TABLE_SPEC.md D215) and R79 (D216): a moment a character's features wait for opens a window.
 *
 * 경이로운 신진대사 happens when the monk rolls initiative; 비전 회복 when a short rest ends. After R78 the second was
 * offered only by the sheet's own rest window, so the DM's party rest skipped it, and the first was still a button.
 * Now the host asks the character's owner at that moment — or takes it, or skips it, as the sheet is set to.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { monsterById } from "../../client/compendium/monsters";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { longRest, shortRest, useResource, useSpellSlot } from "../../client/character/play";
import { restFeatures, spentSlots, useRestFeature } from "../../client/character/rest";
import { initialRuntime, type CharacterRuntime } from "../../client/character/runtime";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function table(classes: string, runtimeOf: (runtime: CharacterRuntime, derived: ReturnType<typeof build>["derived"]) => CharacterRuntime, setTimer?: (ms: number, run: () => void) => void, prefer: Record<string, string[]> = {}) {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R81 시험", { userId: "dm", displayName: "DM" }), joinCode: "R81AAA" };
  new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5, setTimer,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey, pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()), pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcRest: (entry, kind) => { const derived = derivedOf(entry, catalog()); return kind === "long" ? longRest(entry.runtime, derived) : shortRest(entry.runtime, derived); },
    pcTriggers: (entry, event) => { const derived = derivedOf(entry, catalog()); return restFeatures(derived, entry.runtime, catalog(), event).filter((feature) => !feature.unavailable).map((feature) => ({ featureId: feature.featureId, name: feature.name, ...(feature.heal ? { heal: feature.heal } : {}), ...(feature.slotLevels ? { slotLevels: feature.slotLevels, spent: spentSlots(derived, entry.runtime) } : {}) })); },
    pcTriggerApply: (entry, event, choice, roll) => { const derived = derivedOf(entry, catalog()); const feature = restFeatures(derived, entry.runtime, catalog(), event).find((item) => item.featureId === choice.featureId); return feature ? useRestFeature(entry.runtime, derived, feature, feature.slotLevels ? choice.slots : undefined, feature.heal ? roll(feature.heal) : undefined) : null; } });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R81AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "길", 0);
  dm.send({ type: "page.put", page: scene });
  const made = build({ name: classes, classes, level: 5 }, prefer);
  const pc = newJournalCharacter(campaign.id, "dm", made.source, runtimeOf(initialRuntime(made.derived), made.derived));
  dm.send({ type: "journal.put", entry: pc });
  await tick();
  const token = tokenForCharacter(pc);
  dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  const sheet = () => (dm.snapshot!.journal.find((entry) => entry.id === pc.id)! as typeof pc).runtime;
  const prompts = () => dm.snapshot!.chat.filter((message) => message.type === "prompt" && message.prompt?.kind === "trigger" && !message.prompt.outcome && !dm.snapshot!.chat.some((other) => other.supersedes === message.id));
  return { dm, pc, scene, token, made, sheet, prompts };
}

test("R81: rolling initiative asks the monk about 경이로운 신진대사, and the answer restores (D215)", async () => {
  const { dm, pc, scene, token, made, sheet, prompts } = await table("monk", (runtime, derived) => {
    let next = runtime;
    for (let n = 0; n < 4; n += 1) next = useResource(next, derived, "resource.monk.focus");
    return { ...next, hp: { ...next.hp, current: 5 } };
  });
  dm.send({ type: "tracker.add", turn: { name: "몽크", tokenId: token.id, pageId: scene.id, entryId: pc.id }, rollBonus: made.derived.initiative });
  await tick();
  const [prompt] = prompts();
  assert.equal(prompt?.prompt?.trigger?.event, "initiative", JSON.stringify(dm.snapshot!.chat.slice(-2)));
  const offer = prompt.prompt!.trigger!.offers[0];
  assert.deepEqual([offer.name, offer.heal], ["경이로운 신진대사", "1d8+5"]);
  dm.send({ type: "act.trigger", messageId: prompt.id, choices: [{ featureId: offer.featureId }] });
  await tick();
  assert.equal(prompts().length, 0, "answered");
  assert.equal(sheet().resourcesUsed["resource.monk.focus"] ?? 0, 0, "every focus point back");
  assert.equal(sheet().hp.current, 5 + 5 + 5, "1d8 at the middle roll (5) + monk level 5");
  assert.equal(sheet().resourcesUsed["resource.monk.uncanny-metabolism"], 1);
});

test("R79: the DM's short rest asks the wizard about 비전 회복, with the slots chosen (D216)", async () => {
  const { dm, sheet, prompts } = await table("wizard", (runtime, derived) => useSpellSlot(useSpellSlot(useSpellSlot(runtime, derived, 3), derived, 2), derived, 1));
  dm.send({ type: "table.rest", kind: "short" });
  await tick();
  const [prompt] = prompts();
  const offer = prompt?.prompt?.trigger?.offers[0];
  assert.deepEqual([prompt?.prompt?.trigger?.event, offer?.slotLevels, offer?.spent], ["short-rest", 3, [3, 2, 1]], JSON.stringify(dm.snapshot!.chat.slice(-2)));
  dm.send({ type: "act.trigger", messageId: prompt.id, choices: [{ featureId: offer!.featureId, slots: [2, 1] }] });
  await tick();
  assert.deepEqual(sheet().slotsUsed, { 3: 1 });
});

test("R79: a sheet set to always takes it without a window, and never skips it (D216)", async () => {
  const always = await table("wizard", (runtime, derived) => ({ ...useSpellSlot(runtime, derived, 3), hitPolicy: { "trigger:wizard.arcane-recovery": "always" } }));
  always.dm.send({ type: "table.rest", kind: "short" });
  await tick();
  assert.equal(always.prompts().length, 0);
  assert.deepEqual(always.sheet().slotsUsed, {}, "the 3rd-level slot came back at once");

  const never = await table("wizard", (runtime, derived) => ({ ...useSpellSlot(runtime, derived, 3), hitPolicy: { "trigger:wizard.arcane-recovery": "never" } }));
  never.dm.send({ type: "table.rest", kind: "short" });
  await tick();
  assert.equal(never.prompts().length, 0);
  assert.deepEqual(never.sheet().slotsUsed, { 3: 1 });
});

test("R87: a window nobody answers takes its default answer after the table timeout (D222)", async () => {
  const timers: Array<{ ms: number; run: () => void }> = [];
  const { dm, sheet, prompts } = await table("wizard", (runtime, derived) => useSpellSlot(runtime, derived, 3), (ms, run) => timers.push({ ms, run }));
  dm.send({ type: "table.rest", kind: "short" });
  await tick();
  assert.equal(prompts().length, 1);
  const timer = timers.at(-1)!;
  assert.equal(timer.ms, 90_000, "90 seconds unless the campaign says otherwise");
  timer.run();
  await tick();
  assert.equal(prompts().length, 0, "declined for the absent player");
  assert.deepEqual(sheet().slotsUsed, { 3: 1 }, "declining uses nothing");
});

test("R99: a fiend warlock who drops a monster is offered the temporary hit points of 어둠의 존재의 축복 (D234)", async () => {
  const { dm, pc, scene, token, made, sheet, prompts } = await table("warlock", (runtime) => runtime, undefined, { "class.0.subclass": ["dnd.srd521.subclass.warlock.fiend-patron"] });
  const goblin = newJournalNpc(pc.campaignId, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  dm.send({ type: "journal.put", entry: goblin });
  await tick();
  const goblinToken = tokenForNpc(goblin);
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  await tick();
  const weapon = made.derived.attacks.find((attack) => attack.itemId)!;
  dm.send({ type: "act.attack", attacker: { entryId: pc.id, pageId: scene.id, tokenId: token.id }, targets: [{ pageId: scene.id, tokenId: goblinToken.id }], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "hit", damageDelta: 50 } });
  await tick();
  const [prompt] = prompts();
  assert.equal(prompt?.prompt?.trigger?.event, "kill", JSON.stringify(dm.snapshot!.chat.slice(-3).map((message) => message.content)));
  dm.send({ type: "act.trigger", messageId: prompt.id, choices: [{ featureId: prompt.prompt!.trigger!.offers[0].featureId }] });
  await tick();
  assert.equal(sheet().hp.temp, Math.max(1, made.derived.abilities.cha.modifier + 5));
});
