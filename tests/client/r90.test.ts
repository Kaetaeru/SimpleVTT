/**
 * R90 (ROLL20_TABLE_SPEC.md D225): the spells a creature is under change the dice at the table — 액운's −1d4 on its
 * attack rolls, 유도 화살's advantage for the next attack against it (then gone), and 사냥꾼의 표식's 1d6 only when
 * the ranger who marked it hits it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newJournalCharacter, newJournalNpc, type JournalCharacter, type JournalNpc } from "../../client/campaign/journal";
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
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const BANE = "dnd.srd521.spell.bane";
const BOLT = "dnd.srd521.spell.guiding-bolt";
const MARK = "dnd.srd521.spell.hunter-s-mark";

async function table(classes: string, spells: string[], level = 5, prefer: Record<string, string[]> = {}) {
  const hub = new MemoryHub();
  const dice = { value: 0.01 };
  const campaign = { ...newCampaign("R90 시험", { userId: "dm", displayName: "DM" }), joinCode: "R90AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R90AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "숲", 0);
  dm.send({ type: "page.put", page: scene });
  const made = build({ name: "영웅", classes, level }, { "class.0.spells": spells, ...prefer });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  const other = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!, { name: "둘째 오우거" });
  for (const entry of [pc, ogre, other]) dm.send({ type: "journal.put", entry });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  const otherToken = tokenForNpc(other);
  for (const token of [pcToken, ogreToken, otherToken]) dm.send({ type: "token.put", pageId: scene.id, token });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "영웅", tokenId: pcToken.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.next" });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, ogre: { pageId: scene.id, tokenId: ogreToken.id }, other: { pageId: scene.id, tokenId: otherToken.id } };
  const weapon = made.derived.attacks.find((attack) => attack.itemId)!;
  const lastCard = () => [...host.archive].reverse().find((message) => message.type === "action" && message.action)!.action!;
  const foe = () => host.journal.find((entry) => entry.id === ogre.id) as JournalNpc;
  return { dm, dice, refs, weapon, lastCard, foe };
}

test("R90: 액운 takes its d4 off the ogre's attack roll (D225)", async () => {
  const t = await table("cleric", [BANE]);
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: BANE, targets: [t.refs.ogre], method: { kind: "slot", level: 1 } });
  await tick();
  assert.ok(t.foe().runtime.effects?.some((effect) => effect.key === `spell:${BANE}`), "the ogre failed its save");
  t.dm.send({ type: "act.attack", attacker: t.refs.ogre, targets: [t.refs.pc], attack: { source: "npc", actionName: t.foe().statBlock.actions.find((action) => action.kind === "attack")!.name } });
  await tick();
  assert.deepEqual(t.lastCard().bonusDice?.map((item) => [item.dice, item.total]), [["-1d4", -1]]);
});

test("R90: 유도 화살 gives the next attack against the ogre advantage, then ends (D225)", async () => {
  const t = await table("cleric", [BOLT]);
  t.dice.value = 0.99;
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: BOLT, targets: [t.refs.ogre], method: { kind: "slot", level: 1 } });
  await tick();
  const bolt = t.foe().runtime.effects?.find((effect) => effect.key === `spell:${BOLT}`);
  assert.ok(bolt, JSON.stringify(t.foe().runtime.effects));
  t.dice.value = 0.01;
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.ogre], attack: { source: "weapon", attackId: t.weapon.id } });
  await tick();
  assert.equal(t.lastCard().advantage, "advantage", JSON.stringify(t.lastCard().reasons));
  assert.equal(t.foe().runtime.effects?.some((effect) => effect.key === `spell:${BOLT}`), false, "used up");
});

test("R90: 사냥꾼의 표식 adds its d6 only to the marking ranger's hits on the marked ogre (D225)", async () => {
  const t = await table("ranger", [MARK]);
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: MARK, targets: [t.refs.ogre], method: { kind: "slot", level: 1 } });
  await tick();
  const labels = () => t.lastCard().damage.map((part) => part.part.label);
  const name = t.foe().runtime.effects?.find((effect) => effect.key === `spell:${MARK}`)?.name;
  assert.ok(name, JSON.stringify(t.foe().runtime.effects));
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.ogre], attack: { source: "weapon", attackId: t.weapon.id }, overrides: { outcome: "hit" } });
  await tick();
  assert.ok(labels().includes(name), JSON.stringify(labels()));
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.other], attack: { source: "weapon", attackId: t.weapon.id }, overrides: { outcome: "hit" } });
  await tick();
  assert.deepEqual(labels(), [t.weapon.name], "not on another creature, and not on every swing");
});

test("R98: a level-20 hunter marks with a d10, attacks the mark with advantage, and does not lose it to damage (D233)", async () => {
  const t = await table("ranger", [MARK], 20, { "class.0.subclass": ["dnd.srd521.subclass.ranger.hunter"] });
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: MARK, targets: [t.refs.ogre], method: { kind: "slot", level: 1 } });
  await tick();
  t.dm.send({ type: "act.attack", attacker: t.refs.pc, targets: [t.refs.ogre], attack: { source: "weapon", attackId: t.weapon.id }, overrides: { outcome: "hit" } });
  await tick();
  const card = t.lastCard();
  const name = t.foe().runtime.effects?.find((effect) => effect.key === `spell:${MARK}`)?.name;
  assert.ok(card.damage.some((part) => part.part.label === name && part.part.formula === "1d10"), JSON.stringify(card.damage.map((part) => [part.part.label, part.part.formula])));
  assert.ok(card.reasons.includes("정밀한 사냥꾼"), JSON.stringify(card.reasons));
  const ranger = t.dm.snapshot!.journal.find((entry) => entry.id === t.refs.pc.entryId) as JournalCharacter;
  assert.equal(pcCombatant(ranger, derivedOf(ranger, catalog())).concentration, undefined, "끈질긴 사냥꾼: no concentration save for the mark");
});
