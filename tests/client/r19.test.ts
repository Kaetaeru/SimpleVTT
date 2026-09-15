/**
 * R19 (ROLL20_TABLE_SPEC.md D113): the two things earlier slices left alone because SRD 5.2.1 has no data for them.
 * 주문 두루마리 — the SRD item list carries no magic items at all, so the scroll is authored as a bag item that names
 * its spell; reading it casts the spell with no slot and destroys the scroll, and a reader with no spellcasting uses
 * the scroll's own numbers. NPC 특성 횟수 — SRD traits carry no uses (only actions have Recharge), so the DM sets a
 * per-day count on the sheet and the table counts it down.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { addItem } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { scrollCheckDc, scrollItemId, scrollName, scrollRarity, scrollSpellId, scrollStats } from "../../client/rules/scrolls";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const MAGIC_MISSILE = "dnd.srd521.spell.magic-missile";

test("a scroll is a bag item that names its spell, and reads back as one", () => {
  const id = scrollItemId(MAGIC_MISSILE);
  assert.equal(scrollSpellId(id), MAGIC_MISSILE);
  assert.equal(scrollSpellId("dnd.srd521.item.gear.rations"), undefined);
  assert.equal(scrollSpellId(undefined), undefined);
  assert.equal(scrollName("마법 화살", 1), "주문 두루마리 (마법 화살, 1레벨)");
  assert.equal(scrollName("빛", 0), "주문 두루마리 (빛, 소마법)");
  assert.deepEqual(scrollStats(3), { attackBonus: 5, saveDc: 16 });
  assert.equal(scrollCheckDc(3), 13);
  assert.deepEqual([0, 1, 3, 5, 8, 9].map(scrollRarity), ["흔함", "흔함", "고급", "희귀", "매우 희귀", "전설"]);
});

test("pcSpell: a fighter with no spellcasting can still read a scroll, and it uses the scroll's own numbers", () => {
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 });
  const entry = newJournalCharacter("c", "p", fighter.source, initialRuntime(fighter.derived));
  const runtime = addItem(entry.runtime, { itemId: scrollItemId(MAGIC_MISSILE), name: scrollName("마법 화살", 1) });
  const withScroll = { ...entry, runtime };
  const derived = derivedOf(withScroll, catalog());
  assert.equal(derived.spellcasting.length, 0, "a plain fighter casts nothing of their own");
  const instanceId = derived.inventory.find((item) => scrollSpellId(item.itemId))!.instanceId;
  assert.equal(pcSpell(withScroll, derived, catalog(), MAGIC_MISSILE), null, "without the scroll there is no way to cast it");
  const prepared = pcSpell(withScroll, derived, catalog(), MAGIC_MISSILE, { kind: "scroll", instanceId })!;
  assert.ok(prepared, "the scroll carries the spell");
  assert.deepEqual([prepared.casterStats.attackBonus, prepared.casterStats.saveDc], [5, 14], "the scroll's own numbers");
  assert.equal(prepared.spec.level, 1);
  // Spending destroys the scroll and costs no slot.
  const after = prepared.spend(runtime)!;
  assert.equal(after.slotsUsed[1], undefined);
  const left = derivedOf({ ...withScroll, runtime: after }, catalog()).inventory.find((item) => item.instanceId === instanceId);
  assert.ok(!left || left.quantity === 0, "the scroll is gone");
});

test("a wizard reading a scroll keeps their own save DC and spends no slot", () => {
  const wizard = build({ name: "마법사", classes: "wizard", level: 5 }, { "class.0.spellbook": [MAGIC_MISSILE], "class.0.spells": [MAGIC_MISSILE] });
  const entry = newJournalCharacter("c", "p", wizard.source, initialRuntime(wizard.derived));
  const runtime = addItem(entry.runtime, { itemId: scrollItemId(MAGIC_MISSILE), name: scrollName("마법 화살", 1) });
  const withScroll = { ...entry, runtime };
  const derived = derivedOf(withScroll, catalog());
  const instanceId = derived.inventory.find((item) => scrollSpellId(item.itemId))!.instanceId;
  const prepared = pcSpell(withScroll, derived, catalog(), MAGIC_MISSILE, { kind: "scroll", instanceId })!;
  assert.equal(prepared.casterStats.saveDc, derived.spellcasting[0].saveDc, "their own DC, not the scroll's");
  assert.equal(prepared.spend(runtime)!.slotsUsed[1], undefined, "no slot");
  // A scroll of a spell they do not own cannot be conjured out of nothing.
  assert.equal(pcSpell(withScroll, derived, catalog(), MAGIC_MISSILE, { kind: "scroll", instanceId: "nope" })!.spend(runtime), null);
});

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R19 시험", { userId: "dm", displayName: "DM" }), joinCode: "R19AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.5,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R19AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R19AAA" });
  await tick();
  const scene = newScene(campaign.id, "서고", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 });
  const base = newJournalCharacter(campaign.id, "alice", fighter.source, initialRuntime(fighter.derived));
  const pc = { ...base, runtime: addItem(base.runtime, { itemId: scrollItemId(MAGIC_MISSILE), name: scrollName("마법 화살", 1) }) };
  alice.send({ type: "journal.put", entry: pc });
  // A berserker has exactly one trait (피투성이 광분) and, like every SRD block, no per-day count for it.
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.berserker")!);
  dm.send({ type: "journal.put", entry: goblin });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const goblinToken = tokenForNpc(goblin);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  await tick();
  const ref = (entryId: string, tokenId: string) => ({ entryId, pageId: scene.id, tokenId });
  const refs = { pc: ref(pc.id, pcToken.id), goblin: ref(goblin.id, goblinToken.id) };
  const entryOf = (id: string) => dm.snapshot!.journal.find((item) => item.id === id)!;
  const last = (type: string) => [...dm.snapshot!.chat].reverse().find((message) => message.type === type);
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  dm.onRefused((reason) => refusals.push(reason));
  return { host, dm, alice, scene, pc, goblin, refs, entryOf, last, refusals };
}

test("host: the fighter reads the scroll — the spell resolves at the table, the scroll is spent, and a second read is refused", async () => {
  const { alice, pc, refs, entryOf, last, refusals } = await table();
  const derived = derivedOf(entryOf(pc.id) as never, catalog());
  const instanceId = derived.inventory.find((item) => scrollSpellId(item.itemId))!.instanceId;
  alice.send({ type: "act.cast", caster: refs.pc, spellId: MAGIC_MISSILE, targets: [refs.goblin], method: { kind: "scroll", instanceId } });
  await tick();
  const card = last("spell");
  assert.ok(card, `the scroll cast resolved: ${JSON.stringify(refusals)}`);
  assert.equal(card!.spell!.name, "마법 화살");
  const after = entryOf(pc.id);
  assert.ok(after.kind === "character" && Object.keys(after.runtime.slotsUsed).length === 0, "no slot was spent");
  const left = derivedOf(after as never, catalog()).inventory.find((item) => item.instanceId === instanceId);
  assert.ok(!left || left.quantity === 0, "the scroll burned up");
  alice.send({ type: "act.cast", caster: refs.pc, spellId: MAGIC_MISSILE, targets: [refs.goblin], method: { kind: "scroll", instanceId } });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("슬롯이나 횟수가 없습니다") || reason.includes("시전할 수 없습니다")), JSON.stringify(refusals));
});

test("host: an NPC trait with no per-day count is just narrated; one the DM limited counts down and then refuses", async () => {
  const { dm, goblin, refs, entryOf, last, refusals } = await table();
  const block = (entryOf(goblin.id) as Extract<ReturnType<typeof entryOf>, { kind: "npc" }>).statBlock;
  const trait = block.traits[0];
  assert.ok(trait, "the berserker has a trait");
  dm.send({ type: "act.trait", actor: refs.goblin, name: trait.name });
  await tick();
  assert.ok(last("emote")!.content.includes(trait.name));
  assert.ok(!last("emote")!.content.includes("남음"), "no count yet, so no count shown");
  // The DM gives it two uses a day.
  const live = entryOf(goblin.id) as Extract<ReturnType<typeof entryOf>, { kind: "npc" }>;
  dm.send({ type: "journal.put", entry: { ...live, runtime: { ...live.runtime, traitUses: { [trait.name]: 2 } }, updatedAt: new Date().toISOString() } });
  await tick();
  dm.send({ type: "act.trait", actor: refs.goblin, name: trait.name });
  await tick();
  assert.ok(last("emote")!.content.includes("1/2 남음"), last("emote")!.content);
  dm.send({ type: "act.trait", actor: refs.goblin, name: trait.name });
  await tick();
  assert.ok(last("emote")!.content.includes("0/2 남음"), last("emote")!.content);
  dm.send({ type: "act.trait", actor: refs.goblin, name: trait.name });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("오늘 횟수를 다 썼습니다")), JSON.stringify(refusals));
  const spent = entryOf(goblin.id);
  assert.ok(spent.kind === "npc" && spent.runtime.uses?.[`trait:${trait.name}`] === 2);
});
