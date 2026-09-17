/**
 * R82 (ROLL20_TABLE_SPEC.md D218): smite spells are chosen in the on-hit window, and the supplement's spells get rules.
 *
 * 작열하는 강타, 휘감는 일격 and the PHB supplement's 분노의 강타 are cast right after a weapon hit. The table only knew
 * 신성한 강타 there; the others were cast from the spell menu as a record, their dice rolled by hand. Now they are offers
 * beside 신성한 강타 with a slot to pick: the dice join the swing, the slot and the bonus action are spent, and a save
 * they ask for is rolled and posted as a spell card.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { JournalCharacter } from "../../client/campaign/journal";
import { newJournalCharacter, newJournalNpc } from "../../client/campaign/journal";
import { newCampaign, type ChatMessage } from "../../client/campaign/model";
import { newScene, tokenForCharacter, tokenForNpc } from "../../client/campaign/page";
import { createCatalog } from "../../client/catalog";
import type { RuleModuleJson } from "../../client/catalog/types";
import { initialRuntime } from "../../client/character/runtime";
import { monsterById } from "../../client/compendium/monsters";
import { onHitOf, spellExec, sustainOf } from "../../client/compendium/spells";
import { pcStats } from "../../client/rules/actions";
import { derivedOf, hitOffers, pcAttackSpec, pcCombatant, pcConcentrationKey } from "../../client/rules/attackSpec";
import { pcSpell } from "../../client/rules/spellcast";
import { TableClient } from "../../client/session/client";
import { TableHost } from "../../client/session/host";
import { MemoryHub } from "../../client/session/transport";
import { build, catalog } from "./support";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const SEARING = "dnd.srd521.spell.searing-smite";
const ENSNARING = "dnd.srd521.spell.ensnaring-strike";

test("R82: 작열하는 강타 is an offer with slots, and its dice grow with the slot (D218)", () => {
  const made = build({ name: "팔라딘", classes: "paladin", level: 5 }, { "class.0.spells": [SEARING] });
  const runtime = initialRuntime(made.derived);
  const entry = { runtime } as JournalCharacter;
  const weapon = made.derived.attacks.find((attack) => attack.itemId)!;
  const offer = hitOffers(entry, made.derived, weapon.id, {}, catalog()).find((item) => item.key === `spell:${SEARING}`);
  assert.ok(offer, JSON.stringify(hitOffers(entry, made.derived, weapon.id, {}, catalog()).map((item) => item.key)));
  assert.deepEqual(offer.slots?.map((slot) => slot.level), [1, 2]);
  const prepared = pcAttackSpec({ ...entry, id: "p", name: "p" } as JournalCharacter, made.derived, weapon.id, { spellSmite: { spellId: SEARING, slot: 2 } }, catalog())!;
  const part = prepared.spec.riders!.find((item) => item.label?.startsWith("작열하는 강타"))!;
  assert.deepEqual([part.formula, part.type], ["2d6", "화염"]);
  const spent = prepared.spend(runtime);
  assert.equal(spent.slotsUsed[2], 1, "the 2nd-level slot");
  assert.equal(pcAttackSpec({ ...entry, id: "p", name: "p" } as JournalCharacter, made.derived, weapon.id, { spellSmite: { spellId: SEARING, slot: 3 } }, catalog())!.spec.riders!.length, 0, "a slot the sheet does not have adds nothing");
});

test("R82: 휘감는 일격 at the table — bonus action, slot, and a 근력 save card that restrains (D218)", async () => {
  const hub = new MemoryHub();
  const campaign = { ...newCampaign("R82 시험", { userId: "dm", displayName: "DM" }), joinCode: "R82AAA" };
  const host = new TableHost(hub.hostEndpoint(), { campaign, hostUserId: "dm", hostSecret: "s", random: () => 0.01,
    attributeOf: (entry, link) => (link === "hp" ? { value: entry.runtime.hp.current, max: entry.runtime.hp.maxSeen } : undefined),
    pcCombatant: (entry) => pcCombatant(entry, derivedOf(entry, catalog())), pcConcentrationKey,
    pcAttackSpec: (entry, id, riders) => pcAttackSpec(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcHitOffers: (entry, id, riders) => hitOffers(entry, derivedOf(entry, catalog()), id, riders, catalog()),
    pcSpell: (entry, spellId, method) => pcSpell(entry, derivedOf(entry, catalog()), catalog(), spellId, method),
    pcStats: (entry) => pcStats(derivedOf(entry, catalog())) });
  const dm = new TableClient(hub.connect("dm-seat"), { userId: "dm", displayName: "DM", joinCode: "R82AAA", hostSecret: "s" });
  await tick();
  const scene = newScene(campaign.id, "숲", 0);
  dm.send({ type: "page.put", page: scene });
  const made = build({ name: "레인저", classes: "ranger", level: 5 }, { "class.0.spells": [ENSNARING] });
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
  dm.send({ type: "tracker.add", turn: { name: "레인저", tokenId: pcToken.id, pageId: scene.id, entryId: pc.id, initiative: 20 } });
  dm.send({ type: "tracker.next" });
  await tick();
  const weapon = made.derived.attacks.find((attack) => attack.itemId)!;
  dm.send({ type: "act.attack", attacker: { entryId: pc.id, pageId: scene.id, tokenId: pcToken.id }, targets: [{ pageId: scene.id, tokenId: ogreToken.id }], attack: { source: "weapon", attackId: weapon.id }, overrides: { outcome: "hit" } });
  await tick();
  const answered = new Set(host.archive.map((message) => message.supersedes));
  const prompt = host.archive.find((message) => message.prompt?.kind === "on-hit" && !answered.has(message.id))!;
  assert.ok(prompt.prompt!.onHit!.offers.some((offer) => offer.key === `spell:${ENSNARING}`), JSON.stringify(prompt.prompt!.onHit!.offers.map((offer) => offer.key)));
  dm.send({ type: "act.onhit", messageId: prompt.id, choices: [`spell:${ENSNARING}`], spellSmite: { spellId: ENSNARING, slot: 1 } });
  await tick();
  const spellCard = host.archive.find((message): message is ChatMessage & { spell: NonNullable<ChatMessage["spell"]> } => message.type === "spell" && Boolean(message.spell))!;
  assert.ok(spellCard, "a card for the save");
  assert.equal(spellCard.spell.targets[0].save?.ability, "str");
  assert.equal(spellCard.spell.targets[0].save?.success, false, "a 1 on the die");
  const token = host.pageList.find((page) => page.id === scene.id)!.tokens.find((item) => item.id === ogreToken.id)!;
  assert.ok(token.markers.some((marker) => marker.name === "포박"), JSON.stringify(token.markers));
  const sheet = host.journal.find((entry) => entry.id === pc.id) as JournalCharacter;
  assert.equal(sheet.runtime.slotsUsed[1], 1, "one 1st-level slot");
  assert.equal(host.tracker.turns[0].bonusUsed, true, "cast as the bonus action");
});

test("R82: the PHB patch gives the supplement's smites, auras and buffs their rules (D218)", () => {
  const patch = JSON.parse(readFileSync("content/supplements/phb-2024.spell-mechanics-patch/module.json", "utf8")) as RuleModuleJson;
  const spell = (slug: string, name: string, level: number, castingTimeText: string, durationText: string) => ({ id: `phb2024.spell.${slug}`, category: "spell", presentation: { originalName: name, defaultLocale: "ko-KR", locales: { "ko-KR": { name } } }, mechanics: [{ kind: "spell-definition", config: { level, castingTimeText, rangeText: "자신", durationText } }] });
  const supplement = { moduleId: "phb-2024-supplement", moduleVersion: "1", content: [spell("wrathful-smite", "Wrathful Smite", 1, "추가 행동", "1분"), spell("aura-of-vitality", "Aura of Vitality", 3, "행동", "집중, 최대 1분"), spell("elemental-weapon", "Elemental Weapon", 3, "행동", "집중, 최대 1시간")] } as unknown as RuleModuleJson;
  build({ name: "x", classes: "paladin", level: 1 });
  const cat = createCatalog([supplement, patch]);
  const wrathful = onHitOf(spellExec("phb2024.spell.wrathful-smite"));
  assert.deepEqual([wrathful?.damage?.type, wrathful?.save?.ability, wrathful?.save?.conditions], ["necrotic", "wis", ["frightened"]]);
  const vitality = sustainOf(spellExec("phb2024.spell.aura-of-vitality")!);
  assert.deepEqual([vitality?.economy, vitality?.primary?.kind], ["bonus-action", "healing"]);
  assert.ok(cat.contractFor("spell:elemental-weapon"), "the buff is a sheet effect");
});
