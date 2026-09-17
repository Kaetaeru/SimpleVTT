/**
 * R77 (ROLL20_TABLE_SPEC.md D212): a concentration spell that is still going is used again without a slot.
 *
 * 영적 무기, 흡혈의 손길, 달빛 광선 and 마녀 화살 are cast once and then used turn after turn. The table only knew how
 * to cast them, so every later swing was either a new casting (a slot gone, concentration restarted) or done by hand.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { castSpell } from "../../client/character/play";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { spellExec, sustainOf } from "../../client/compendium/spells";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SPIRITUAL_WEAPON = "dnd.srd521.spell.spiritual-weapon";
const sustain = (id: string) => sustainOf(spellExec(id)!);

test("R77: which spells repeat, and with what (D212)", () => {
  assert.equal(sustain(SPIRITUAL_WEAPON)?.economy, "bonus-action", "cast as a bonus action, swung as one");
  assert.equal(sustain("dnd.srd521.spell.vampiric-touch")?.economy, "action");
  assert.equal(sustain("dnd.srd521.spell.moonbeam")?.economy, "none", "an area: the roll when somebody walks in costs nothing");
  assert.equal(sustain("dnd.srd521.spell.arcane-sword")?.economy, "bonus-action", "the content index overrides the default");
  assert.equal(sustain("dnd.srd521.spell.mind-spike"), null, "and can say a spell has no repeat");
  assert.equal(sustain("dnd.srd521.spell.fire-bolt"), null, "no concentration, nothing to repeat");
});

test("R77: the PHB patch gives 마녀 화살 its bonus-action 1d12 (D212)", () => {
  build({ name: "워락", classes: "warlock", level: 1 });
  const bolt = { id: "phb2024.spell.witch-bolt", category: "spell", presentation: { originalName: "Witch Bolt", defaultLocale: "ko-KR", locales: { "ko-KR": { name: "마녀 화살" } } },
    mechanics: [{ kind: "spell-definition", config: { level: 1, castingTimeText: "행동", rangeText: "60피트", durationText: "집중, 최대 1분" } },
      { kind: "spell-mechanic", config: { baseLevel: 1, castingEconomy: "action", targeting: { kind: "creature", rangeFeet: 60, minTargets: 1, maxTargets: 1 }, primary: { kind: "attack-damage", damageType: "lightning", dice: { count: 2, sides: 12 } }, concentration: true } }] };
  const supplement = { moduleId: "phb-2024-supplement", moduleVersion: "1", content: [bolt] } as unknown as RuleModuleJson;
  const patch = JSON.parse(readFileSync("content/supplements/phb-2024.spell-mechanics-patch/module.json", "utf8")) as RuleModuleJson;
  createCatalog([supplement, patch]);
  const exec = spellExec("phb2024.spell.witch-bolt")!;
  assert.equal(exec.primary.kind, "attack-damage", "the patch keeps the casting as it was");
  const repeat = sustainOf(exec)!;
  assert.deepEqual([repeat.economy, repeat.primary?.kind], ["bonus-action", "automatic-projectiles"]);
});

test("R77: a repeat pays nothing, keeps the slot level, and needs the spell to be going (D212)", () => {
  const made = build({ name: "클레릭", classes: "cleric", level: 5 }, { "class.0.spells": [SPIRITUAL_WEAPON] });
  const spell = catalog().spellById(SPIRITUAL_WEAPON)!;
  const summary = { id: spell.id, name: spell.name, level: spell.level, duration: spell.duration, ritual: spell.ritual };
  const fresh = initialRuntime(made.derived);
  assert.equal(castSpell(fresh, made.derived, summary, { kind: "sustain" }), null, "not in effect: nothing to repeat");
  const cast = castSpell(fresh, made.derived, summary, { kind: "slot", level: 3 })!;
  assert.equal(cast.effects.find((effect) => effect.key === `spell:${SPIRITUAL_WEAPON}`)?.level, 3);
  const again = castSpell(cast, made.derived, summary, { kind: "sustain" })!;
  assert.deepEqual(again.slotsUsed, cast.slotsUsed, "no slot");
  const prepared = pcSpell({ runtime: cast }, made.derived, catalog(), SPIRITUAL_WEAPON, { kind: "sustain" })!;
  assert.deepEqual([prepared.spec.level, prepared.spec.exec.repeat?.economy], [3, "bonus-action"]);
});

test("R77: at the table the repeat is a bonus action with a card, and the slot stays (D212)", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R77 시험", { userId: "dm", displayName: "DM" }), joinCode: "R77AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.9,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R77AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "신전", 0);
  dm.send({ type: "page.put", page: scene });
  const made = build({ name: "클레릭", classes: "cleric", level: 5 }, { "class.0.spells": [SPIRITUAL_WEAPON] });
  const pc = newJournalCharacter(campaign.id, "dm", made.source, initialRuntime(made.derived));
  const ogre = newJournalNpc(campaign.id, "dm", monsterById("dnd.srd521.monster.ogre")!);
  dm.send({ type: "journal.put", entry: pc });
  dm.send({ type: "journal.put", entry: ogre });
  await tick();
  const pcToken = tokenForCharacter(pc);
  const ogreToken = tokenForNpc(ogre);
  dm.send({ type: "token.put", pageId: scene.id, token: pcToken });
  dm.send({ type: "token.put", pageId: scene.id, token: ogreToken });
  await tick();
  dm.send({ type: "tracker.add", turn: { name: "클레릭", tokenId: pcToken.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.add", turn: { name: "오우거", tokenId: ogreToken.id, pageId: scene.id, entryId: ogre.id, initiative: 1 } });
  dm.send({ type: "tracker.next" });
  await tick();
  const me = { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id };
  const target = [{ pageId: scene.id, tokenId: ogreToken.id }];
  const sheet = () => dm.snapshot!.journal.find((entry) => entry.id === pc.id)! as typeof pc;
  const spells = () => dm.snapshot!.chat.filter((message) => message.type === "spell");

  dm.send({ type: "act.cast", caster: me, spellId: SPIRITUAL_WEAPON, targets: target, method: { kind: "slot", level: 2 } });
  await tick();
  assert.equal(spells().length, 1, JSON.stringify(dm.snapshot!.chat.slice(-2)));
  const slots = sheet().runtime.slotsUsed;
  assert.equal(slots[2], 1);

  dm.send({ type: "tracker.next" });
  dm.send({ type: "tracker.next" });
  await tick();
  dm.send({ type: "act.cast", caster: me, spellId: SPIRITUAL_WEAPON, targets: target, method: { kind: "sustain" } });
  await tick();
  assert.equal(spells().length, 2, `a second card: ${JSON.stringify(dm.snapshot!.chat.slice(-1))}`);
  assert.deepEqual(sheet().runtime.slotsUsed, slots, "and no second slot");
  const turn = host.tracker.turns.find((item) => item.tokenId === pcToken.id)!;
  assert.deepEqual([turn.bonusUsed, turn.actionUsed ?? false], [true, false], "the bonus action is spent, the action is not");
});
