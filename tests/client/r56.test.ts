/**
 * R56 (ROLL20_TABLE_SPEC.md D191): the PHB 2024 supplement's 58 feats, written against the seams.
 *
 * The supplement ships them all as `execution.status: "descriptive"` — an ability increase, a prerequisite, and
 * prose. `content/supplements/phb-2024.feat-common-play` is the other half: one contract per feat, in the grammar the
 * SRD content already uses, authored by `scripts/author-phb-feat-contracts.mjs`. It is not built into the app,
 * because it carries PHB rules rather than SRD ones; it installs next to the supplement it belongs to.
 *
 * The feat definitions in this test are the minimum the engine needs to grant a feat (tier and an ability increase);
 * the supplement's own prose is not copied here.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createCatalog } from "../../client/catalog";
import { deriveCharacter } from "../../client/character/derive";
import { initialRuntime } from "../../client/character/runtime";
import { addItem } from "../../client/character/play";
import { parseContract } from "../../client/rules/contract";
import { attackAftermath } from "../../client/rules/attackAftermath";
import { offeredRiders } from "../../client/rules/attackRiders";
import { pcGuards } from "../../client/rules/contractReactions";
import { pcAttackSpec, pcCombatant } from "../../client/rules/attackSpec";
import { applyDamage, diceFrom, type Combatant } from "../../client/rules/resolve";
import { emptySource } from "../../client/character/source";
import { autofill } from "../../client/character/autofill";
import { ids } from "./support";

const CONTRACTS = JSON.parse(readFileSync("content/supplements/phb-2024.feat-common-play/module.json", "utf8")) as { content: Array<{ id: string; mechanics: Array<{ config: Record<string, unknown> }> }> };
const slugOf = (entry: (typeof CONTRACTS)["content"][number]) => String(entry.mechanics[0].config.id).split(":")[1];

/** The 58 slugs the supplement ships, kept here so this test does not depend on a file outside the repository. */
const SUPPLEMENT_FEATS = [
  "actor", "athlete", "blind-fighting", "boon-of-energy-resistance", "boon-of-fortitude", "boon-of-recovery",
  "boon-of-skill", "boon-of-speed", "charger", "chef", "crafter", "crossbow-expert", "crusher", "defensive-duelist",
  "dual-wielder", "dueling", "durable", "elemental-adept", "fey-touched", "great-weapon-master", "healer",
  "heavily-armored", "heavy-armor-master", "inspiring-leader", "interception", "keen-mind", "lightly-armored",
  "lucky", "mage-slayer", "martial-weapon-training", "medium-armor-master", "moderately-armored",
  "mounted-combatant", "musician", "observant", "piercer", "poisoner", "polearm-master", "protection", "resilient",
  "ritual-caster", "sentinel", "shadow-touched", "sharpshooter", "shield-master", "skill-expert", "skulker",
  "slasher", "speedy", "spell-sniper", "tavern-brawler", "telekinetic", "telepathic", "thrown-weapon-fighting",
  "tough", "unarmed-fighting", "war-caster", "weapon-master",
];

/** A minimal feat definition, so a character can be given a supplement feat without the supplement's own text. */
const featEntry = (slug: string, name: string) => ({
  id: `phb2024.feat.${slug}`, category: "feat",
  presentation: { defaultLocale: "ko-KR", originalName: name, locales: { "ko-KR": { name } } },
  mechanics: [{ kind: "feat-definition", config: { tier: "general", minimumLevel: 4, abilityIncrease: { any: ["str"], amount: 1, maximum: 20 } } }],
});

const supplement = (slugs: Array<[string, string]>) => ({
  $schema: "https://simplevtt.local/schemas/rule-module.schema.json", schemaVersion: "0.1-draft",
  moduleId: "phb-2024-supplement", moduleVersion: "1", rulesProfile: { id: "dnd.srd-5.2.1", version: "0.1-draft" },
  defaultLocale: "ko-KR", dependencies: [], conflicts: [], capabilities: [], extensionPoints: [],
  content: slugs.map(([slug, name]) => featEntry(slug, name)),
});

/** A fighter holding a greatsword, with one supplement feat and the contract module installed. */
function withFeat(slug: string, name: string) {
  const catalog = createCatalog([supplement([[slug, name]]), CONTRACTS as never] as never);
  const base = emptySource({
    name: "전사", origin: { speciesId: ids.species("human"), backgroundId: ids.background("criminal") },
    abilities: { method: "manual", base: { str: 17, dex: 12, con: 14, int: 10, wis: 10, cha: 8 } },
    tracks: Array.from({ length: 8 }, () => ({ classId: ids.cls("fighter"), hp: { kind: "fixed" as const } })),
    equipment: { mode: "loadout" },
  });
  const made = autofill(base, catalog, { prefer: { "class.3.asi": [`phb2024.feat.${slug}`] } });
  const runtime = addItem(initialRuntime(made.derived), { itemId: "dnd.srd521.item.weapon.greatsword", name: "대검" });
  const derived = deriveCharacter(made.source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory });
  return { catalog, made, runtime, derived };
}

test("R56: every supplement feat has a contract, and every contract parses (D191)", () => {
  const authored = CONTRACTS.content.map(slugOf).sort();
  assert.deepEqual(authored, [...SUPPLEMENT_FEATS].sort(), "one contract per feat, no more and no fewer");
  const gaps: string[] = [];
  let mechanical = 0;
  for (const entry of CONTRACTS.content) {
    const contract = parseContract(entry.mechanics[0].config, entry.id);
    if (contract.unsupported.length) gaps.push(`${contract.id}: ${contract.unsupported.join(", ")}`);
    const operations = [...contract.entryPoints.flatMap((point) => point.operations), ...contract.interceptors.flatMap((item) => item.operations)];
    assert.ok(operations.length, `${contract.id}: 계약이 비어 있으면 아무것도 말하지 않은 것입니다`);
    if (operations.some((operation) => operation.kind !== "adjudication.request")) mechanical += 1;
  }
  assert.deepEqual(gaps, [], "this executor can run every part of every contract it ships");
  // The rest are prose the table judges — a mount, a kitchen, or five feet the scene cannot measure (D109).
  assert.equal(mechanical, 24, "feats carrying at least one mechanical operation");
});

test("R56: 대형 무기 달인 is a checkbox on a heavy weapon and a bonus action on a critical (D191)", () => {
  const { catalog, runtime, derived } = withFeat("great-weapon-master", "대형 무기 달인");
  const sword = derived.attacks.find((attack) => attack.name === "대검")!;
  assert.ok(sword.properties.includes("heavy"), sword.properties.join("/"));

  // The pre-roll seam (R52): offered on a Heavy weapon, adding the proficiency bonus.
  const offered = offeredRiders(derived, sword);
  assert.deepEqual(offered.map((rider) => rider.key), ["feat:great-weapon-master"], JSON.stringify(derived.attackRiders));
  assert.deepEqual(offered[0].damage, [{ formula: String(derived.proficiencyBonus), type: "weapon" }]);
  assert.equal(offered[0].oncePerTurn, true);
  const light = derived.attacks.find((attack) => !attack.properties.includes("heavy") && attack.itemId);
  if (light) assert.deepEqual(offeredRiders(derived, light).map((rider) => rider.key), [], light.name);

  // Declared, it reaches the spec as a damage part of the weapon's own type.
  const spec = pcAttackSpec({ runtime } as never, derived, sword.id, { contracts: ["feat:great-weapon-master"] }, catalog)!.spec;
  const rider = spec.riders!.find((part) => part.label === "대형 무기 달인")!;
  assert.ok(rider, JSON.stringify(spec.riders));
  assert.equal(rider.formula, String(derived.proficiencyBonus));
  assert.equal(rider.type, sword.damageType);
  assert.equal(rider.critDoubles, false, "a flat rider is not doubled by a critical hit");

  // The aftermath seam (R53): a critical or a kill hands back a bonus action.
  assert.deepEqual(attackAftermath(derived, catalog, sword, ["hit"]).economy, [], "a plain hit gives nothing back");
  const cleaved = attackAftermath(derived, catalog, sword, ["hit", "crit"]);
  assert.deepEqual(cleaved.economy, [{ bucket: "bonus-action.extra", amount: 1, source: "대형 무기 달인" }]);
  assert.deepEqual(attackAftermath(derived, catalog, sword, ["hit", "downed"]).economy, cleaved.economy, "and so does dropping them");
});

test("R56: 중갑 달인 only reduces damage while the heavy armour is on (D191)", () => {
  const { catalog, made, derived, runtime } = withFeat("heavy-armor-master", "중갑 달인");
  // The fighter's loadout puts chain mail on, so the contract's `when` clause is true and the sheet carries it.
  assert.equal(derived.armor?.training, "heavy", JSON.stringify(derived.armor));
  assert.deepEqual(derived.damageReduction, [{ types: ["타격", "관통", "참격"], amount: derived.proficiencyBonus, source: "중갑 달인" }]);
  const armoured: Combatant = pcCombatant({ id: "pc", name: "전사", runtime } as never, derived);
  const hit = applyDamage(armoured, [{ formula: "2d6+4", type: "참격", label: "대검" }], diceFrom(() => 0.999), {});
  assert.equal(hit.damageTotal, 16 - derived.proficiencyBonus, "the proficiency bonus comes off the swing");
  assert.equal(applyDamage(armoured, [{ formula: "2d6", type: "화염", label: "불" }], diceFrom(() => 0.999), {}).damageTotal, 12, "fire is none of the three");

  // Take the armour off and the clause is false, so the sheet carries nothing — the rule is the armour's, not the feat's.
  const bare = deriveCharacter(made.source, catalog, { equipped: {}, inventory: runtime.inventory });
  assert.equal(bare.armor?.training, "none", JSON.stringify(bare.armor));
  assert.equal(bare.damageReduction, undefined, JSON.stringify(bare.damageReduction));
  assert.equal(pcCombatant({ id: "pc", name: "전사", runtime } as never, bare).reduction, undefined);
});

test("R56: 방어적 결투가 opens a reaction window, and 명사수 ignores cover (D191)", () => {
  const duellist = withFeat("defensive-duelist", "방어적 결투가");
  const offers = pcGuards({ runtime: duellist.runtime }, duellist.derived, duellist.catalog, "attack.hit-self");
  assert.deepEqual(offers.map((offer) => offer.feature), ["방어적 결투가"]);
  assert.equal(offers[0].acBonus, duellist.derived.proficiencyBonus);
  assert.ok(offers[0].notes.some((note) => note.includes("기교 무기")), JSON.stringify(offers[0].notes));

  const shooter = withFeat("sharpshooter", "명사수");
  assert.equal(shooter.derived.ignoresCover, true, JSON.stringify(shooter.derived.activeEffects));
  const sword = shooter.derived.attacks.find((attack) => attack.name === "대검")!;
  assert.equal(pcAttackSpec({ runtime: shooter.runtime } as never, shooter.derived, sword.id, {}, shooter.catalog)!.spec.ignoresCover, true);
});

test("R56: the training and the numbers a feat hands out land on the sheet (D191)", () => {
  const heavy = withFeat("heavily-armored", "중갑 훈련").derived;
  assert.ok(heavy.proficiencies.armor.includes("중갑"), heavy.proficiencies.armor.join(", "));
  const tough = withFeat("tough", "강인함");
  const plain = withFeat("actor", "배우");
  assert.equal(tough.derived.hp.max - plain.derived.hp.max, 2 * tough.derived.level, "캐릭터 레벨 × 2");
  const speedy = withFeat("speedy", "쾌속").derived;
  assert.equal(speedy.speed.walk - plain.derived.speed.walk, 10);
  const skulker = withFeat("skulker", "잠행자").derived;
  assert.equal(skulker.senses.blindsight, 10);
});
