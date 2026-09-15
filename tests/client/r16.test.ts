/**
 * R16 (ROLL20_TABLE_SPEC.md D111): 주문 차단 — casting an action spell is held while the other side decides.
 * 2024: the caster of the held spell rolls a Constitution save against the counterspeller's save DC; on a failure
 * the spell fades with no effect, the action is wasted and the slot is NOT spent. Declining lets it go off.
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
import { summonRule, summonsNothing } from "../../client/rules/summons";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const COUNTERSPELL = "dnd.srd521.spell.counterspell";
const DRAGON = "dnd.srd521.monster.adult-black-dragon";
/** The dragon's at-will 산성 화살 (Acid Arrow) — an action spell, so it can be countered. */
const ACID_ARROW = "dnd.srd521.spell.acid-arrow";

async function table() {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R16 시험", { userId: "dm", displayName: "DM" }), joinCode: "R16AAA" };
  const dice = { value: 0.5 };
  const hub2 = hub;
  const host = new TableHost(hub2.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method),
    pcReactionSpell: (entry, spellId) => { const derived = derivedOf(entry, catalog()); if (!castableSpells(derived).includes(spellId)) return null; const view = catalog().spellById(spellId); return view ? cheapestCast(derived, entry.runtime, view.level) : null; } });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R16AAA", hostSecret: "s" });
  const alice = new TableClient(hub.connect("p1"), { userId: "alice", displayName: "앨리스", joinCode: "R16AAA" });
  await tick();
  const scene = newScene(campaign.id, "둥지", 0);
  dm.send({ type: "page.put", page: scene });
  dm.send({ type: "page.ribbon", pageId: scene.id });
  const wizardBuild = build({ name: "마법사", classes: "wizard", level: 9 }, { "class.0.spellbook": [COUNTERSPELL], "class.0.spells": [COUNTERSPELL, "dnd.srd521.spell.magic-missile"] });
  const wizard = newJournalCharacter(campaign.id, "alice", wizardBuild.source, initialRuntime(wizardBuild.derived));
  alice.send({ type: "journal.put", entry: wizard });
  const dragon = newJournalNpc(campaign.id, "dm", monsterById(DRAGON)!);
  dm.send({ type: "journal.put", entry: dragon });
  await tick();
  const wizardToken = tokenForCharacter(wizard);
  const dragonToken = tokenForNpc(dragon);
  alice.send({ type: "token.put", pageId: scene.id, token: wizardToken });
  dm.send({ type: "token.put", pageId: scene.id, token: dragonToken });
  await tick();
  const ref = (entryId: string, tokenId: string) => ({ entryId, pageId: scene.id, tokenId });
  const refs = { wizard: ref(wizard.id, wizardToken.id), dragon: ref(dragon.id, dragonToken.id) };
  dm.send({ type: "tracker.set", tracker: { open: true, round: 1, current: 0, sorted: true, turns: [newTurn({ name: "드래곤", initiative: 20, tokenId: dragonToken.id, pageId: scene.id, entryId: dragon.id }), newTurn({ name: "마법사", initiative: 10, tokenId: wizardToken.id, pageId: scene.id, entryId: wizard.id })] } });
  await tick();
  const entryOf = (id: string) => dm.snapshot!.journal.find((item) => item.id === id)!;
  const last = (type: string) => [...dm.snapshot!.chat].reverse().find((message) => message.type === type);
  const count = (type: string) => dm.snapshot!.chat.filter((message) => message.type === type && !message.undone).length;
  const refusals: string[] = [];
  alice.onRefused((reason) => refusals.push(reason));
  dm.onRefused((reason) => refusals.push(reason));
  return { host, dm, alice, dice, scene, wizard, dragon, refs, entryOf, last, count, refusals, wizardAc: wizardBuild.derived.ac.value };
}

test("host: the dragon's action spell is held for the wizard's 주문 차단; a failed Constitution save makes it fade with the slot intact", async () => {
  const { dm, alice, dice, wizard, refs, entryOf, last, count, refusals } = await table();
  dm.send({ type: "act.cast", caster: refs.dragon, spellId: ACID_ARROW, targets: [refs.wizard] });
  await tick();
  assert.equal(count("spell"), 0, `nothing resolved yet: ${JSON.stringify(refusals)}`);
  const prompt = last("prompt")!;
  assert.equal(prompt.prompt!.kind, "counterspell");
  assert.equal(prompt.prompt!.reactor.entryId, wizard.id, "the wizard is asked, not the dragon");
  assert.ok(prompt.prompt!.spell?.name, "the prompt names the held spell");
  const before = entryOf(wizard.id);
  // The dragon's CON save (+11 here) fails against the wizard's DC: d20 1.
  dice.value = 0.01;
  alice.send({ type: "act.cast", caster: refs.wizard, spellId: COUNTERSPELL, targets: [refs.dragon], method: { kind: "slot", level: 3 }, reaction: prompt.id });
  await tick();
  const counter = last("spell")!;
  assert.equal(counter.spell!.targets[0].save!.success, false, "the dragon failed the save");
  assert.ok(last("prompt")!.prompt!.outcome?.countered, "the prompt closed as countered");
  assert.ok(last("system")!.content.includes("주문 차단으로 사라집니다"), last("system")!.content);
  // Only the counterspell resolved; the acid arrow never did, and the wizard paid its 3rd-level slot.
  assert.equal(count("spell"), 1);
  const after = entryOf(wizard.id);
  assert.ok(before.kind === "character" && after.kind === "character" && after.runtime.hp.current === before.runtime.hp.current, "the acid arrow did nothing");
  assert.ok(after.kind === "character" && after.runtime.slotsUsed[3] === 1, "the counterspell cost a 3rd-level slot");
});

test("host: a successful Constitution save lets the held spell go off; declining does too, and neither asks the same creature twice", async () => {
  const { dm, alice, dice, refs, last, count } = await table();
  dm.send({ type: "act.cast", caster: refs.dragon, spellId: ACID_ARROW, targets: [refs.wizard] });
  await tick();
  const prompt = last("prompt")!;
  dice.value = 0.99; // the dragon's CON save succeeds
  alice.send({ type: "act.cast", caster: refs.wizard, spellId: COUNTERSPELL, targets: [refs.dragon], method: { kind: "slot", level: 3 }, reaction: prompt.id });
  await tick();
  assert.equal(count("spell"), 2, "the counterspell and the acid arrow it failed to stop");
  assert.ok(last("spell")!.spell!.name.includes("산성") || last("spell")!.spell!.targets.length === 1, "the held spell resolved");
  // The wizard's reaction is gone, so the next cast is not held at all.
  dm.send({ type: "act.cast", caster: refs.dragon, spellId: ACID_ARROW, targets: [refs.wizard] });
  await tick();
  assert.equal(count("spell"), 3, "no second prompt once the reaction is spent");
  void dice;
});

test("host: declining the 주문 차단 lets the spell through and does not spend the reaction", async () => {
  const { dm, alice, refs, entryOf, wizard, last, count } = await table();
  dm.send({ type: "act.cast", caster: refs.dragon, spellId: ACID_ARROW, targets: [refs.wizard] });
  await tick();
  const prompt = last("prompt")!;
  alice.send({ type: "act.decline", messageId: prompt.id });
  await tick();
  assert.ok(last("prompt")!.prompt!.outcome?.declined);
  assert.equal(count("spell"), 1, "the held spell went off");
  const after = entryOf(wizard.id);
  assert.ok(after.kind === "character" && after.runtime.slotsUsed[3] === undefined, "declining costs nothing");
});

test("summon rules: only the SRD spells that really place a creature offer one; the 2024 conjures say they summon nothing", () => {
  assert.equal(summonRule("dnd.srd521.spell.conjure-animals"), undefined);
  assert.ok(summonsNothing("dnd.srd521.spell.conjure-animals")?.includes("오라"));
  assert.ok(summonsNothing("dnd.srd521.spell.conjure-minor-elementals"));
  const animate = summonRule("dnd.srd521.spell.animate-dead")!;
  assert.deepEqual(animate.choices, ["dnd.srd521.monster.skeleton", "dnd.srd521.monster.zombie"]);
  assert.equal(summonRule("dnd.srd521.spell.create-undead")!.count, 3, "up to three corpses");
  const familiar = summonRule("dnd.srd521.spell.find-familiar")!;
  assert.ok(familiar.choices.length > 10 && familiar.choices.includes("dnd.srd521.monster.owl"), "every CR 0 beast is a familiar form");
  assert.ok(summonRule("dnd.srd521.spell.summon-dragon")!.needsOwnBlock, "the Draconic Spirit block is not in the compendium");
});

test("host: 소환 gives the summoned creature its own journal entry and a token the summoner's player controls; 돌려보내기 takes both away", async () => {
  const { dm, alice, scene, wizard, refs, refusals } = await table();
  const journal = () => dm.snapshot!.journal.filter((entry): entry is Extract<typeof entry, { kind: "npc" }> => entry.kind === "npc");
  const tokens = () => dm.snapshot!.pages.find((page) => page.id === scene.id)!.tokens;
  const before = tokens().length;
  alice.send({ type: "act.summon", summoner: refs.wizard, monsterId: "dnd.srd521.monster.zombie", spellId: "dnd.srd521.spell.animate-dead" });
  await tick();
  const summoned = journal().filter((entry) => entry.summonedBy?.entryId === wizard.id);
  assert.equal(summoned.length, 1, `one entry of its own: ${JSON.stringify(refusals)}`);
  assert.ok(summoned[0].canEdit.includes("alice"), "the summoner's player controls it");
  assert.equal(tokens().length, before + 1);
  assert.ok(tokens().some((token) => token.represents === summoned[0].id));
  // The spell's own list is enforced.
  alice.send({ type: "act.summon", summoner: refs.wizard, monsterId: "dnd.srd521.monster.ghoul", spellId: "dnd.srd521.spell.animate-dead" });
  await tick();
  assert.ok(refusals.some((reason) => reason.includes("소환하지 않습니다")), JSON.stringify(refusals));
  // 언데드 창조 places three at once.
  alice.send({ type: "act.summon", summoner: refs.wizard, monsterId: "dnd.srd521.monster.ghoul", count: 3, spellId: "dnd.srd521.spell.create-undead" });
  await tick();
  assert.equal(journal().filter((entry) => entry.summonedBy?.entryId === wizard.id).length, 4);
  // Sending one spell's summons away leaves the other spell's alone.
  alice.send({ type: "act.dismiss", summoner: refs.wizard, spellId: "dnd.srd521.spell.create-undead" });
  await tick();
  const left = journal().filter((entry) => entry.summonedBy?.entryId === wizard.id);
  assert.deepEqual(left.map((entry) => entry.summonedBy!.spellId), ["dnd.srd521.spell.animate-dead"]);
  assert.equal(tokens().length, before + 1, "their tokens went with them");
  void dm;
});
