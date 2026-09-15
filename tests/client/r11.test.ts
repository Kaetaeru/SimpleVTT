/**
 * R11 (ROLL20_TABLE_SPEC.md D106): a hit on a caster who can still cast Shield is held until they answer — the
 * reaction spell raises AC by 5 and the same dice may now miss; declining applies the hit as rolled. The ribbon's
 * linked party group lets a later member go first (tracker.swap).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { newTurn } from "../../client/campaign/tracker";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { castableSpells, cheapestCast, pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SHIELD = "dnd.srd521.spell.shield";

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R11 시험", { userId: "dm", displayName: "DM" }), joinCode: "ABC234" };
  const dice = { value: 0.5 };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value, attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined), pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey, pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders), pcStats: (entry) => pcStats(derivedOf(entry, catalog())), pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method),
    pcReactionSpell: (entry, spellId) => { const derived = derivedOf(entry, catalog()); if (!castableSpells(derived).includes(spellId)) return null; const view = catalog().spellById(spellId); return view ? cheapestCast(derived, entry.runtime, view.level) : null; } });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "ABC234", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "ABC234" });
  await tick();
  const scene = newScene(campaign.id, "탑", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const wizard = build({ name: "마법사 PC", classes: "wizard", level: 3 }, { "class.0.spells": ["dnd.srd521.spell.shield", "dnd.srd521.spell.magic-missile"] });
  const pc = newJournalCharacter(campaign.id, "alice", wizard.source, initialRuntime(wizard.derived));
  const fighter = build({ name: "파이터", classes: "fighter", level: 3 });
  const pc2 = newJournalCharacter(campaign.id, "alice", fighter.source, initialRuntime(fighter.derived));
  alice.send({ type: "journal.put", entry: pc });
  alice.send({ type: "journal.put", entry: pc2 });
  const goblin = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.goblin-warrior")!);
  dm.send({ type: "journal.put", entry: goblin });
  await tick();
  const wizardToken = tokenForCharacter(pc);
  const fighterToken = tokenForCharacter(pc2);
  const goblinToken = tokenForNpc(goblin);
  alice.send({ type: "token.put", pageId: scene.id, token: wizardToken });
  alice.send({ type: "token.put", pageId: scene.id, token: fighterToken });
  dm.send({ type: "token.put", pageId: scene.id, token: goblinToken });
  await tick();
  const ref = (entryId: string, tokenId: string) => ({ entryId, pageId: scene.id, tokenId });
  const refs = { wizard: ref(pc.id, wizardToken.id), fighter: ref(pc2.id, fighterToken.id), goblin: ref(goblin.id, goblinToken.id) };
  // Goblin, wizard, fighter; current = the goblin's turn.
  const turns = [newTurn({ name: "고블린 전사", initiative: 20, tokenId: goblinToken.id, pageId: scene.id, entryId: goblin.id }), newTurn({ name: "마법사 PC", initiative: 15, tokenId: wizardToken.id, pageId: scene.id, entryId: pc.id }), newTurn({ name: "파이터", initiative: 10, tokenId: fighterToken.id, pageId: scene.id, entryId: pc2.id })];
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns } });
  await tick();
  const entryOf = (id: string) => dm.snapshot!.journal.find((item) => item.id === id)!;
  const last = (client: TableClient, type: string) => [...client.snapshot!.chat].reverse().find((message) => message.type === type);
  const count = (client: TableClient, type: string) => client.snapshot!.chat.filter((message) => message.type === type && !message.undone).length;
  return { host, dm, alice, dice, pc, pc2, goblin, refs, turns, entryOf, last, count, wizardAc: wizard.derived.ac.value };
}

test("host: a hit on the wizard is held for Shield — the reaction turns the same roll into a miss, spends a slot and the reaction; the next hit that round is held no more", async () => {
  const { host, dm, alice, pc, refs, entryOf, last, count, wizardAc } = await table();
  assert.equal(wizardAc, 12);
  // Goblin scimitar +1 (this SRD block): d20 11 → 12 vs AC 12: a hit, held.
  dm.send({ type: "act.attack", attacker: refs.goblin, targets: [refs.wizard], attack: { source: "npc", actionName: "시미터" } });
  await tick();
  assert.equal(count(dm, "action"), 0, "no attack card yet");
  const prompt = last(alice, "prompt")!;
  assert.ok(prompt.prompt?.kind === "shield" && prompt.prompt.attack?.total === 12 && prompt.prompt.attack.ac === 12, `a shield prompt with the held numbers: ${JSON.stringify(prompt.prompt)}`);
  // The DM cannot answer for the player; another player neither. The wizard casts Shield as the reaction.
  alice.send({ type: "act.cast", caster: refs.wizard, spellId: SHIELD, targets: [refs.wizard], method: { kind: "slot", level: 1 }, reaction: prompt.id });
  await tick();
  const card = last(dm, "action")!;
  assert.equal(card.action!.outcome, "miss", "12 vs AC 17 misses");
  assert.equal(card.action!.targetAc, 17);
  assert.ok(card.action!.reasons.join(" ").includes("방패"), `the card says why: ${JSON.stringify(card.action!.reasons)}`);
  const wizardEntry = entryOf(pc.id);
  assert.ok(wizardEntry.kind === "character" && wizardEntry.runtime.slotsUsed[1] === 1 && wizardEntry.runtime.effects.some((effect) => effect.key === `spell:${SHIELD}`), `a 1st-level slot and the effect on the sheet: ${wizardEntry.kind === "character" ? JSON.stringify({ slots: wizardEntry.runtime.slotsUsed, effects: wizardEntry.runtime.effects.map((effect) => effect.key) }) : "?"}`);
  assert.equal(host.state.tracker!.turns[1].reactionUsed, true);
  assert.ok(last(dm, "prompt")!.prompt!.outcome?.shielded, "the prompt closed as shielded");
  // A second attack this round: the reaction is spent, so no prompt — but the +5 still applies (12 vs 17 → miss).
  dm.send({ type: "act.attack", attacker: refs.goblin, targets: [refs.wizard], attack: { source: "npc", actionName: "시미터" } });
  await tick();
  assert.equal(count(dm, "prompt"), 2, "no new prompt");
  assert.deepEqual([last(dm, "action")!.action!.outcome, last(dm, "action")!.action!.targetAc], ["miss", 17]);
});

test("host: declining the shield applies the hit as rolled; a player's own out-of-turn cast without a prompt is still refused", async () => {
  const { dm, alice, pc, refs, entryOf, last, count } = await table();
  dm.send({ type: "act.attack", attacker: refs.goblin, targets: [refs.wizard], attack: { source: "npc", actionName: "시미터" } });
  await tick();
  const prompt = last(alice, "prompt")!;
  const before = entryOf(pc.id);
  alice.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  const card = last(dm, "action")!;
  assert.equal(card.action!.outcome, "hit");
  const after = entryOf(pc.id);
  assert.ok(before.kind === "character" && after.kind === "character" && after.runtime.hp.current === before.runtime.hp.current - card.action!.damageTotal, "the damage landed");
  assert.ok(last(dm, "prompt")!.prompt!.outcome?.declined);
  assert.equal(count(dm, "action"), 1);
  // Shield without an open prompt on someone else's turn: the reaction spell path needs the prompt.
  alice.send({ type: "act.cast", caster: refs.wizard, spellId: SHIELD, targets: [refs.wizard], method: { kind: "slot", level: 1 }, reaction: prompt.id });
  await tick();
  assert.equal(count(dm, "spell"), 0, "the answered prompt takes no second answer");
});

test("host: tracker.swap lets a later party member of the linked group go first — a player for their own creatures, never across an enemy", async () => {
  const { host, dm, alice, refs, turns } = await table();
  // Goblin's turn: the fighter cannot cut in front of the goblin (not the same group).
  alice.send({ type: "tracker.swap", turnId: turns[2].id });
  await tick();
  assert.equal(host.state.tracker!.turns[0].name, "고블린 전사");
  dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(host.state.tracker!.turns[host.state.tracker!.current].name, "마법사 PC");
  // Wizard's turn, the fighter is next in the same group: alice swaps them.
  alice.send({ type: "tracker.swap", turnId: turns[2].id });
  await tick();
  assert.deepEqual(host.state.tracker!.turns.map((turn) => turn.name), ["고블린 전사", "파이터", "마법사 PC"]);
  assert.equal(host.state.tracker!.current, 1);
  assert.ok([...dm.snapshot!.chat].reverse().find((message) => message.type === "system")!.content.includes("순서 교대"));
  // The fighter acts, then the wizard's turn comes.
  dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(host.state.tracker!.turns[host.state.tracker!.current].name, "마법사 PC");
  void refs;
});
