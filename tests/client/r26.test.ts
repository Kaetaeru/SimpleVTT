/**
 * R26 (ROLL20_TABLE_SPEC.md D136–D137): undo reverses a card, it does not restore a photograph.
 *
 * Every restore closure captured the value from before its card and wrote it back absolutely. Undoing an older card
 * therefore wrote a stale world over a newer one — a goblin hit twice came back at full HP with the second hit's
 * damage gone, and undoing the second card then killed it again. And `act.adjust` reverted and discarded the record
 * *before* checking the creatures were still there, so a refusal left the card applied and un-undoable.
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
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import type { JournalCharacter } from "../../client/campaign/journal";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function table() {
  const dice = { value: 0.95 };
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R26 시험", { userId: "dm", displayName: "DM" }), joinCode: "R26AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R26AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R26AAA" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "파이터", classes: "fighter", level: 3 });
  const pc = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived));
  alice.send({ type: "journal.put", entry: pc });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: goblin });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const goblinToken = tokenForNpc(goblin);
  alice.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  await tick();
  const ref = (entryId: string, tokenId: string) => ({ entryId, pageId: scene.id, tokenId });
  const refs = { pc: ref(pc.id, pcToken.id), goblin: ref(goblin.id, goblinToken.id) };
  const derived = derivedOf(host.journal.find((entry) => entry.id === pc.id) as JournalCharacter, catalog());
  const weapon = derived.attacks[0]!.id;
  const bar = () => host.pageList[0].tokens.find((token) => token.id === goblinToken.id)!.bars[0].value;
  const cards = () => host.archive.filter((message) => message.type === "action" && !message.undone);
  return { host, dm, alice, dice, scene, pc, goblin, pcToken, goblinToken, refs, bar, cards, weapon };
}

test("undo: two hits on one creature undo independently, in any order (D136)", async () => {
  const { dm, alice, refs, bar, host, weapon } = await table();
  const start = bar()!;
  alice.send({ type: "act.attack", attacker: refs.pc, targets: [refs.goblin], attack: { source: "weapon", attackId: weapon } });
  await tick();
  const afterFirst = bar()!;
  assert.ok(afterFirst < start, `the first hit landed: ${start} → ${afterFirst}`);
  const first = host.archive.find((message) => message.type === "action")!.id;
  alice.send({ type: "act.attack", attacker: refs.pc, targets: [refs.goblin], attack: { source: "weapon", attackId: weapon } });
  await tick();
  const afterSecond = bar()!;
  assert.ok(afterSecond < afterFirst, "and so did the second");
  const second = host.archive.filter((message) => message.type === "action").at(-1)!.id;
  assert.notEqual(first, second);
  // Undo the OLDER card. Only its own damage comes back; the newer hit stands.
  dm.send({ type: "act.undo", messageId: first });
  await tick();
  assert.equal(bar(), afterSecond + (start - afterFirst), "the first hit's damage came back and nothing else did");
  // Undo the newer one too: the creature is now exactly where it started.
  dm.send({ type: "act.undo", messageId: second });
  await tick();
  assert.equal(bar(), start, "both undone means untouched — it does not drop dead again");
});

test("undo: a hit on a PC gives back its own damage, its own conditions and its own death saves (D136)", async () => {
  const { dm, alice, pc, refs, host } = await table();
  const sheet = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const full = sheet().runtime.hp.current;
  dm.send({ type: "act.attack", attacker: refs.goblin, targets: [refs.pc], attack: { source: "npc", actionName: "그레이트클럽" } });
  await tick();
  const hurt = sheet().runtime.hp.current;
  assert.ok(hurt < full, `${full} → ${hurt}`);
  const card = host.archive.filter((message) => message.type === "action").at(-1)!.id;
  // Meanwhile something else takes three more HP off the sheet and the DM marks them: the undo must touch neither.
  const live = sheet();
  alice.send({ type: "journal.put", entry: { ...live, runtime: { ...live.runtime, hp: { ...live.runtime.hp, current: hurt - 3 }, conditions: ["매혹"], updatedAt: new Date(Date.now() + 5000).toISOString() } } });
  await tick();
  assert.equal(sheet().runtime.hp.current, hurt - 3);
  dm.send({ type: "act.undo", messageId: card });
  await tick();
  assert.equal(sheet().runtime.hp.current, hurt - 3 + (full - hurt), "the card's own damage came back, and the later three HP are still gone");
  assert.deepEqual(sheet().runtime.conditions, ["매혹"], "a condition nobody's card inflicted is left alone");
});

test("adjust: a card whose target is gone stays exactly as it was (D137)", async () => {
  const { dm, alice, goblin, refs, bar, host, weapon } = await table();
  const start = bar()!;
  alice.send({ type: "act.attack", attacker: refs.pc, targets: [refs.goblin], attack: { source: "weapon", attackId: weapon } });
  await tick();
  const hurt = bar()!;
  assert.ok(hurt < start);
  const card = host.archive.filter((message) => message.type === "action").at(-1)!.id;
  // The DM deletes the goblin's journal entry, then reaches for the palette on the old card.
  const refusals: string[] = [];
  dm.onRefused((reason) => refusals.push(reason));
  dm.send({ type: "journal.remove", id: goblin.id });
  await tick();
  dm.send({ type: "act.adjust", messageId: card, overrides: { outcome: "crit" as const } });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("대상이 더 없습니다")), JSON.stringify(refusals));
  // Nothing was silently reverted, and the card can still be undone properly.
  const before = refusals.length;
  dm.send({ type: "act.undo", messageId: card });
  await tick();
  assert.equal(refusals.length, before, "undo is still available — the record was not thrown away by the refused adjust");
  assert.equal(bar(), start, "and it gives the damage back");
});

test("undo: an old cast refunds its own slot, not every slot spent since (D136)", async () => {
  const dice = { value: 0.95 };
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R26 주문", { userId: "dm", displayName: "DM" }), joinCode: "R26BBB" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R26BBB", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R26BBB" });
  await tick();
  const scene = newScene(campaign.id, "복도", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const made = build({ name: "마법사", classes: "wizard", level: 5 }, { "class.0.spells": ["dnd.srd521.spell.magic-missile"], "class.0.spellbook": ["dnd.srd521.spell.magic-missile"] });
  const caster = newJournalCharacter(campaign.id, "alice", made.source, initialRuntime(made.derived));
  alice.send({ type: "journal.put", entry: caster });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  dm.send({ type: "journal.put", entry: goblin });
  await tick();
  const casterToken = tokenForCharacter(caster);
  const goblinToken = tokenForNpc(goblin);
  alice.send({ type: "token.put", pageId: scene.id, token: casterToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  await tick();
  const casterRef = { entryId: caster.id, pageId: scene.id, tokenId: casterToken.id };
  const goblinRef = { entryId: goblin.id, pageId: scene.id, tokenId: goblinToken.id };
  const slots = () => (host.journal.find((entry) => entry.id === caster.id) as JournalCharacter).runtime.slotsUsed;
  alice.send({ type: "act.cast", caster: casterRef, spellId: "dnd.srd521.spell.magic-missile", targets: [goblinRef] });
  await tick();
  const firstCard = host.archive.filter((message) => message.type === "spell").at(-1)!.id;
  assert.equal(slots()[1], 1, "one first-level slot is spent");
  alice.send({ type: "act.cast", caster: casterRef, spellId: "dnd.srd521.spell.magic-missile", targets: [goblinRef] });
  await tick();
  assert.equal(slots()[1], 2, "and then another");
  // Undoing the first cast used to write the whole pre-cast ledger back, refunding both.
  dm.send({ type: "act.undo", messageId: firstCard });
  await tick();
  assert.equal(slots()[1], 1, "exactly one slot came back");
});
