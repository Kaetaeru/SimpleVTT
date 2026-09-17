/**
 * R80 (ROLL20_TABLE_SPEC.md D214): a monster's concentration spell is used again, and a monster can lose it.
 *
 * R77 gave characters the repeat. A monster that cast 달빛 광선 had only a 집중 marker: it could not repeat the
 * spell without spending another daily use, and it never made a concentration save when hurt.
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
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const MOONBEAM = "dnd.srd521.spell.moonbeam";

test("R80: the druid repeats 달빛 광선 without a daily use, and loses it when hurt (D214)", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R80 시험", { userId: "dm", displayName: "DM" }), joinCode: "R80AAA" };
  const dice = { value: 0.5 };
  new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => dice.value,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R80AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "숲", 0);
  dm.send({ type: "page.put", page: scene });
  const druid = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.druid")!);
  const made = build({ name: "파이터", classes: "fighter", level: 3 });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  dm.send({ type: "journal.put", entry: druid });
  dm.send({ type: "journal.put", entry: pc });
  await tick();
  const druidToken = tokenForNpc(druid);
  const pcToken = tokenForCharacter(pc);
  dm.send({ type: "token.put", pageId: scene.id, token: druidToken });
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  await tick();
  const caster = { entryId: druid.id, pageId: scene.id, tokenId: druidToken.id };
  const target = [{ pageId: scene.id, tokenId: pcToken.id }];
  const npc = () => dm.snapshot!.journal.find((entry) => entry.id === druid.id)! as typeof druid;
  const spells = () => dm.snapshot!.chat.filter((message) => message.type === "spell").length;

  dm.send({ type: "act.cast", caster, spellId: MOONBEAM, targets: target });
  await tick();
  assert.equal(spells(), 1, JSON.stringify(dm.snapshot!.chat.slice(-1)));
  assert.equal(npc().runtime.uses?.[MOONBEAM], 1, "the daily use is spent");
  assert.equal(npc().runtime.effects?.find((effect) => effect.concentration)?.key, `spell:${MOONBEAM}`);

  dm.send({ type: "act.cast", caster, spellId: MOONBEAM, targets: target });
  await tick();
  assert.equal(spells(), 1, "a second casting is refused: no uses left");
  dm.send({ type: "act.cast", caster, spellId: MOONBEAM, targets: target, method: { kind: "sustain" } });
  await tick();
  assert.equal(spells(), 2, "but the repeat goes off");
  assert.equal(npc().runtime.uses?.[MOONBEAM], 1, "and spends nothing");

  dice.value = 0.01;
  const weapon = made.derived.attacks.find((attack) => attack.itemId)!;
  dm.send({ type: "act.attack", attacker: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, targets: [{ pageId: scene.id, tokenId: druidToken.id }], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "hit" } });
  await tick();
  const card = [...dm.snapshot!.chat].reverse().find((message) => message.type === "action")!;
  assert.equal(card.action?.concentration?.success, false, JSON.stringify(card.action));
  assert.equal(npc().runtime.effects?.some((effect) => effect.concentration), false, "the druid let go of the spell");
});
