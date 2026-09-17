/**
 * R85 (ROLL20_TABLE_SPEC.md D220): an effect remembers who put it there — it ends with their concentration, and
 * "until the end of your next turn" counts on their turn.
 *
 * A target's effect had no link to its caster. A cleric who lost concentration on 인간형 포박 left the bandit paralysed,
 * and 유도 화살's "until the end of your next turn" ran out on the target's turn instead of the cleric's.
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
const HOLD = "dnd.srd521.spell.hold-person";
const BOLT = "dnd.srd521.spell.guiding-bolt";

async function table(target: "ogre" | "bandit", dice: number) {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R85 시험", { userId: "dm", displayName: "DM" }), joinCode: "R85AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R85AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "신전", 0);
  dm.send({ type: "page.put", page: scene });
  const made = build({ name: "클레릭", classes: "cleric", level: 5 }, { "class.0.spells": [HOLD, BOLT] });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const npc = newJournalNpc(campaign.id, "dm", monsterById(target === "ogre" ? "dnd.srd521.monster.ogre" : "dnd.srd521.monster.bandit")!);
  dm.send({ type: "journal.put", entry: pc });
  dm.send({ type: "journal.put", entry: npc });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const npcToken = tokenForNpc(npc);
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: npcToken });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "클레릭", tokenId: pcToken.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.add", turn: { name: "적", tokenId: npcToken.id, pageId: scene.id, entryId: npc.id, initiative: 1 } });
  dm.send({ type: "tracker.next" });
  await tick();
  const refs = { pc: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, npc: { pageId: scene.id, tokenId: npcToken.id } };
  const cleric = () => host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  const foe = () => host.journal.find((entry) => entry.id === npc.id) as JournalNpc;
  const markers = () => host.pageList.find((page) => page.id === scene.id)!.tokens.find((item) => item.id === npcToken.id)!.markers.map((marker) => marker.name);
  return { dm, refs, cleric, foe, markers };
}

test("R85: the target lets go when the caster stops concentrating (D220)", async () => {
  const t = await table("bandit", 0.01);
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: HOLD, targets: [t.refs.npc], method: { kind: "slot", level: 2 } });
  await tick();
  const held = t.foe().runtime.effects?.find((effect) => effect.key === `spell:${HOLD}`);
  assert.ok(held, JSON.stringify(t.foe().runtime));
  assert.deepEqual([held.from, held.fromConcentration], [t.cleric().id, true]);
  assert.ok(t.markers().includes("마비"), JSON.stringify(t.markers()));

  const sheet = t.cleric();
  t.dm.send({ type: "journal.put", entry: { ...sheet, runtime: { ...sheet.runtime, effects: sheet.runtime.effects.filter((effect) => effect.key !== `spell:${HOLD}`) } } });
  await tick();
  assert.equal(t.foe().runtime.effects?.some((effect) => effect.key === `spell:${HOLD}`), false, "the spell is off the bandit");
  assert.ok(!t.markers().includes("마비"), `and so is the paralysis: ${JSON.stringify(t.markers())}`);
});

test("R85: 유도 화살 lasts until the end of the caster's next turn, not the target's (D220)", async () => {
  const t = await table("ogre", 0.99);
  t.dm.send({ type: "act.cast", caster: t.refs.pc, spellId: BOLT, targets: [t.refs.npc], method: { kind: "slot", level: 1 } });
  await tick();
  const bolt = () => t.foe().runtime.effects?.find((effect) => effect.key === `spell:${BOLT}`);
  assert.equal(bolt()?.anchor?.who, "source", JSON.stringify(t.foe().runtime.effects));
  t.dm.send({ type: "tracker.next" });
  await tick();
  assert.ok(bolt(), "the cleric's turn that cast it does not count");
  t.dm.send({ type: "tracker.next" });
  await tick();
  assert.ok(bolt(), "the ogre's own turn does not count either");
  t.dm.send({ type: "tracker.next" });
  await tick();
  assert.equal(bolt(), undefined, "gone at the end of the cleric's next turn");
});
