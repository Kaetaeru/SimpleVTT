/**
 * Builds the resolver's inputs from sheets: a PC's Combatant and AttackSpec (with riders such as 암습 and 신성한
 * 강타) from the derived character, an NPC's from its stat block and token. Used by the host app (with its
 * catalog) and mirrored in the UI to show what a button will do.
 */
import type { JournalCharacter, JournalNpc } from "../campaign/journal";
import type { Token } from "../campaign/page";
import type { ContentCatalog } from "../catalog/catalog";
import { deriveCharacter } from "../character/derive";
import type { CharacterRuntime, HitPolicy } from "../character/runtime";
import { castSpell, spendResource, useSpellSlot } from "../character/play";
import { CONDITION_KO, onHitOf, spellExec, type SpellOnHit } from "../compendium/spells";
import { damageTypeKo } from "./resolve";
import { bearerPartsOf } from "../compendium/spells";
import { offeredRiders, riderFitsAttack } from "./attackRiders";
import type { HitOffer } from "../campaign/model";
import { critRiders } from "./attackAftermath";
import { attackScopeFilter } from "./contractEffects";
import type { ActiveEffect, DerivedAttack, DerivedCharacter } from "../character/types";
import type { MonsterAction, MonsterView } from "../compendium/monsters";
import { damageFormula } from "../compendium/monsters";
import type { AttackRiders } from "../session/protocol";
import type { AttackSpec, Combatant, DamagePart } from "./resolve";
import type { SpellDuration, SpellExec, SpellPrimary } from "../compendium/spells";
import type { CasterStats, SpellCastSpec } from "./spellcast";

const diceOf = (terms: Array<{ dice?: string }>) => terms.filter((term) => term.dice).map((term) => `+${term.dice}`).join("");

type BearerRolls = Pick<Combatant, "d20Dice" | "rollStates" | "grantsAdvantage" | "grantsDisadvantage" | "consumable" | "markedBy">;
/**
 * R90 (D225): the spell effects a creature is under, as what they do at the table — 축복·액운's d4 on its attack rolls
 * and saves, 요정 불꽃·유도 화살's advantage for whoever attacks it, 사냥꾼의 표식·주술's dice for the caster who marked
 * it, and which effects end once used. Only effects it is under count (`bearer`, or put there by someone else), not a
 * caster merely concentrating on 액운. `flat` is false for a character: the sheet already adds flat bonuses through the
 * effect contracts, while dice never reached a table roll, so the dice come from here for everyone.
 */
export function bearerRolls(effects: ActiveEffect[] = [], flat: boolean): BearerRolls {
  const out: Required<BearerRolls> = { d20Dice: [], rollStates: [], grantsAdvantage: [], grantsDisadvantage: [], consumable: [], markedBy: [] };
  for (const effect of effects) {
    if (!effect.key.startsWith("spell:") || !(effect.bearer || effect.from)) continue;
    for (const part of bearerPartsOf(effect.key.slice("spell:".length))) {
      const modifier = part.modifier;
      const on = modifier?.family === "attack-roll" ? "attack" : modifier?.family === "saving-throw" ? "save" : null;
      if (modifier && on && modifier.scope === "target") {
        if (on === "attack" && modifier.rollState) (modifier.rollState === "advantage" ? out.grantsAdvantage : out.grantsDisadvantage).push(`대상 ${effect.name}`);
        if (on === "attack" && modifier.consumeOnUse) out.consumable.push({ key: effect.key, on: "attacked" });
      } else if (modifier && on) {
        const sign = (modifier.bonus?.sign ?? 1) < 0 ? "-" : "";
        const dice = modifier.bonus?.dice ? `${sign}${modifier.bonus.dice.count}d${modifier.bonus.dice.sides}` : flat && modifier.bonus?.flat ? `${sign}${modifier.bonus.flat}` : "";
        if (dice) out.d20Dice.push({ on, dice, label: effect.name });
        if (modifier.rollState) out.rollStates.push({ on, state: modifier.rollState, label: effect.name, ...(modifier.ability ? { ability: modifier.ability } : {}) });
        if (on === "attack" && modifier.consumeOnUse) out.consumable.push({ key: effect.key, on: "attack" });
      }
      const damage = part.attackDamage;
      if (damage?.againstTargetOnly && effect.from && (damage.dice || damage.flat)) out.markedBy.push({ from: effect.from, formula: damage.dice ? `${damage.dice.count}d${damage.dice.sides}` : String(damage.flat), type: damageTypeKo(damage.damageType), label: effect.name });
    }
  }
  return Object.fromEntries(Object.entries(out).filter(([, list]) => list.length)) as BearerRolls;
}

export function pcCombatant(entry: JournalCharacter, derived: DerivedCharacter): Combatant {
  const runtime = entry.runtime;
  const bearer = bearerRolls(runtime.effects, false);
  const concentration = (runtime.effects ?? []).find((effect) => effect.concentration);
  return {
    // (R11: the Shield spell's +5 AC already comes through the sheet's active effects → derived.ac.)
    id: entry.id, name: entry.name, kind: "pc", ac: derived.ac.value, hp: { current: runtime.hp.current, max: derived.hp.max, temp: runtime.hp.temp },
    conditions: runtime.conditions, defenses: derived.defenses, conSave: derived.saves.con.bonus, concentration: concentration?.name, effects: (runtime.effects ?? []).map((effect) => effect.name),
    // R28 (D147): exhaustion reaches the dice at last.
    exhaustion: runtime.exhaustion,
    // R51 (D186): 중갑 달인 — flat reduction per damage type, from whatever effect or feat contract granted it.
    ...(derived.damageReduction?.length ? { reduction: derived.damageReduction } : {}),
    // R55 (D190): what this character gives away by attacking recklessly — anyone swinging at them gets advantage.
    ...bearer,
    ...(derived.grantsAdvantage?.length ? { grantsAdvantage: [...derived.grantsAdvantage, ...(bearer.grantsAdvantage ?? [])] } : {}),
  };
}

export const pcConcentrationKey = (entry: JournalCharacter) => (entry.runtime.effects ?? []).find((effect) => effect.concentration)?.key;

/**
 * R31 (D162): 재생 — "regains N hit points at the start of its turn". The number is in the trait's own text, so the
 * host can heal it at the turn start and say so; the clause that switches it off (fire, acid …) is the table's.
 */
export function regenerationOf(block: MonsterView): { amount: number; note: string } | undefined {
  const trait = block.traits.find((item) => /재생|Regeneration/i.test(item.nameEn ?? item.name));
  if (!trait) return undefined;
  const match = /(\d+)\s*(?:\(|점|히트|hit)/.exec(trait.text) ?? /(\d+)/.exec(trait.text);
  const amount = match ? Number(match[1]) : 0;
  return amount > 0 ? { amount, note: trait.text } : undefined;
}

/** An NPC through its token (unlinked bar = the token's own HP, D78) or its sheet. */
export function npcCombatant(entry: JournalNpc, token?: Token): Combatant {
  const block = entry.statBlock;
  const bar = token?.bars[0];
  const useToken = Boolean(token && !bar?.link && bar?.value !== undefined);
  const hp = useToken ? { current: bar!.value ?? 0, max: bar!.max ?? block.hp, temp: 0 } : { current: entry.runtime.hp.current, max: entry.runtime.hp.max, temp: entry.runtime.hp.temp };
  const markers = token?.markers.map((marker) => marker.name) ?? [];
  return {
    id: entry.id, name: token?.name ?? entry.name, kind: "npc", ac: block.ac, hp,
    // R31 (D161): 마법 저항 is on 34 stat blocks and nothing read it — the resolver knows now.
    magicResistance: block.traits.some((trait) => /마법 저항|Magic Resistance/i.test(trait.nameEn ?? trait.name)),
    regeneration: regenerationOf(block),
    conditions: [...new Set([...entry.runtime.conditions, ...markers])], defenses: { resistances: block.damageResistances, immunities: block.damageImmunities, vulnerabilities: block.damageVulnerabilities, conditionImmunities: block.conditionImmunities },
    // R30 (D157): what the monster is under reaches the resolver, the way a character's effects always have.
    conSave: block.saves.con, effects: (entry.runtime.effects ?? []).map((effect) => effect.name),
    ...bearerRolls(entry.runtime.effects, true),
    // R80 (D214): a monster concentrating makes the same save a character does when it is hurt.
    ...((entry.runtime.effects ?? []).some((effect) => effect.concentration) || markers.includes("집중") ? { concentration: (entry.runtime.effects ?? []).find((effect) => effect.concentration)?.name ?? "집중" } : {}),
  };
}

/** Whether a sheet attack is thrown/shot or swung (D109: the table tracks no distances, so only the mode matters — opportunity attacks are melee). */
export function weaponRange(attack: DerivedAttack): { mode: "melee" | "ranged" } {
  const ranged = attack.properties.includes("ammunition") || (attack.ability === "dex" && Boolean(attack.range) && !attack.properties.includes("finesse"));
  return { mode: ranged ? "ranged" : "melee" };
}

const sneakDice = (derived: DerivedCharacter) => { const rogue = derived.classes.find((cls) => cls.classId.endsWith(".rogue")); return rogue ? Math.ceil(rogue.level / 2) : 0; };
export const hasSneakAttack = (derived: DerivedCharacter, attack: DerivedAttack) => sneakDice(derived) > 0 && (attack.properties.includes("finesse") || weaponRange(attack).mode === "ranged");
export const SMITE_LABEL = "신성한 강타";
/** 2024 Divine Smite deals +1d8 against a Fiend or an Undead; the host adds it per target, since one attack may hit several. */
export function smiteFiendBonus(spec: AttackSpec, creatureType?: string): DamagePart | null {
  if (!creatureType || !["fiend", "undead"].includes(creatureType.toLowerCase())) return null;
  if (!(spec.riders ?? []).some((part) => part.label?.startsWith(SMITE_LABEL))) return null;
  return { formula: "1d8", type: "광휘", label: `${SMITE_LABEL} (악마·언데드 +1d8)` };
}
export const hasSmite = (derived: DerivedCharacter) => derived.features.some((feature) => feature.id.includes("paladin") && feature.id.endsWith(".smite"));
export const smiteSlots = (derived: DerivedCharacter, runtime: CharacterRuntime) => Object.entries(derived.spellSlots).map(([level, max]) => ({ level: Number(level), free: max - (runtime.slotsUsed[Number(level)] ?? 0) })).filter((slot) => slot.free > 0);

/** The attack spec for a sheet attack row, with the chosen riders; `spend` applies their cost to the attacker's runtime. */
/**
 * R33 (D168): the feat that rerolls weapon damage once a turn, by name, or nothing. R32 matched the feat's name with
 * a regex; it is the catalog's `oncePerTurn` key now, so a supplement feat with the same key is offered too.
 */
export const savageAttackerFeat = (derived: DerivedCharacter) => derived.featEffects?.rerollWeaponDamage;
export const hasSavageAttacker = (derived: DerivedCharacter) => Boolean(savageAttackerFeat(derived));
/** R33 (D168): the feat that keeps the ability modifier on a Light weapon's off-hand swing (쌍수 전투), or nothing. */
export const offHandFeat = (derived: DerivedCharacter) => derived.featEffects?.lightOffHandAbilityModifier;
/** R33 (D168): a Light weapon can be swung as the off-hand attack, which normally drops its ability modifier. */
export const canOffHand = (attack: { properties: string[] }) => attack.properties.includes("light");

export function pcAttackSpec(entry: JournalCharacter, derived: DerivedCharacter, attackId: string, riders: AttackRiders = {}, catalog?: ContentCatalog): { spec: AttackSpec; spend: (runtime: CharacterRuntime) => CharacterRuntime } | null {
  const attack = derived.attacks.find((item) => item.id === attackId);
  if (!attack) return null;
  const range = weaponRange(attack);
  // R12: a Cleave follow-up adds no ability modifier to its damage.
  const cleave = Boolean(riders.cleave && attack.masteryActive && attack.masteryKey === "cleave");
  // R33 (D168): the off-hand swing of a two-weapon set drops its ability modifier — unless a feat carrying
  // `lightExtraAttackAbilityModifier` puts it back, and "nonnegative" only puts back a modifier that helps.
  const offHand = Boolean(riders.offHand && canOffHand(attack));
  const offHandKeeps = offHand && Boolean(offHandFeat(derived)) && attack.damageBonus >= 0;
  const dropsAbilityMod = cleave || (offHand && !offHandKeeps);
  const bonusText = attack.damageBonus && !dropsAbilityMod ? `${attack.damageBonus > 0 ? "+" : "-"}${Math.abs(attack.damageBonus)}` : "";
  // R32 (D165): 대형 무기 전투 travels with the weapon's own damage part.
  // R51 (D186): 독 제조자 and its kin — a damage type this sheet's own damage is never resisted for.
  const ignores = (type: string) => (derived.ignoresResistance ?? []).includes(type);
  const damage: DamagePart[] = [{ formula: `${attack.damage.split(" ")[0]}${bonusText}${diceOf(attack.damageTerms)}`, type: attack.damageType, label: cleave ? `${attack.name} (쪼개기)` : offHand ? `${attack.name} (보조 손)` : attack.name, ...(attack.dieMinimum ? { dieMinimum: attack.dieMinimum } : {}), ...(ignores(attack.damageType) ? { ignoresResistance: true } : {}) }];
  const extra: DamagePart[] = [];
  const spenders: Array<(runtime: CharacterRuntime) => CharacterRuntime> = [];
  if (riders.sneak && hasSneakAttack(derived, attack)) extra.push({ formula: `${sneakDice(derived)}d6`, type: attack.damageType, label: "암습" });
  if (riders.smiteSlot && hasSmite(derived) && (derived.spellSlots[riders.smiteSlot] ?? 0) > 0) {
    const level = riders.smiteSlot;
    // 2024 Divine Smite: 2d8 from a 1st-level slot, +1d8 per slot level above that, with no cap.
    extra.push({ formula: `${1 + level}d8`, type: "광휘", label: `${SMITE_LABEL} (${level}레벨 슬롯)` });
    spenders.push((runtime) => useSpellSlot(runtime, derived, level));
  }
  // R82 (D218): a smite spell chosen in the on-hit window — its dice join the swing, its slot is spent by casting it
  // (so a lasting one starts its effect), and what it inflicts outright lands with the hit.
  const inflicts: string[] = [];
  const smite = riders.spellSmite ? smiteSpells(derived, entry.runtime, attack).find((item) => item.spellId === riders.spellSmite!.spellId && item.slots.some((slot) => slot.level === riders.spellSmite!.slot)) : undefined;
  if (smite) {
    const slot = riders.spellSmite!.slot;
    const view = catalog?.spellById(smite.spellId);
    const name = view?.name ?? smite.spellId;
    const rolled = smite.rule.damage;
    if (rolled) extra.push({ formula: `${rolled.count + (rolled.perSlot ?? 0) * (slot - smite.exec.baseLevel)}d${rolled.sides}`, type: damageTypeKo(rolled.type), label: `${name} (${slot}레벨 슬롯)` });
    inflicts.push(...(smite.rule.inflicts ?? []).map((id) => CONDITION_KO[id] ?? id));
    spenders.push((runtime) => (view ? castSpell(runtime, derived, { id: view.id, name: view.name, level: view.level, duration: view.duration, ritual: view.ritual }, { kind: "slot", level: slot }) : null) ?? useSpellSlot(runtime, derived, slot));
  }
  // R52 (D187): the open half of the riders — whatever the player ticked in the dialog, matched against the riders
  // this sheet actually offers. A key the sheet does not carry is dropped, so the wire cannot invent damage.
  for (const key of riders.contracts ?? []) {
    const rider = (derived.attackRiders ?? []).find((item) => item.key === key);
    if (!rider || !riderFitsAttack(rider, attack)) continue;
    // R57 (D192): a part gated on a declared fact lands only if the player ticked it in the dialog.
    for (const part of rider.damage) {
      if (part.factId && !(riders.facts ?? []).includes(part.factId)) continue;
      extra.push({ formula: part.formula, type: part.type === "weapon" ? attack.damageType : part.type, label: rider.label, critDoubles: /d\d/.test(part.formula) });
    }
    if (rider.resourceId && rider.cost) { const { resourceId, cost, label } = rider; spenders.push((runtime) => spendResource(runtime, derived, resourceId, cost, label)); }
  }
  // R55 (D190): the advantage a contract declared for *this* weapon — 무모한 공격 is Strength melee only.
  const advantageOn = (derived.advantageOn ?? []).filter((item) => { if (!item.scope) return true; const filter = attackScopeFilter(item.scope); return filter ? filter(attack) : false; }).map((item) => item.reason);
  const abilityMod = derived.abilities[attack.ability].modifier;
  const mastery = attack.masteryActive && attack.masteryKey && !cleave ? attack.masteryKey : undefined;
  // R32 (D166): 야만적 공격자 — the player asked for the reroll in the pre-roll dialog and has the feat.
  const savageFeat = riders.savage ? savageAttackerFeat(derived) : undefined;
  const savage = Boolean(savageFeat);
  // R53 (D188): what a critical hit adds, from whatever contract said so. Empty for a sheet with no such rule.
  const crits = catalog ? critRiders(derived, catalog, attack) : { parts: [], dice: [] };
  // R60 (D195): the rules that touch this swing's own dice — declared riders first, then whatever a critical adds.
  const diceRules = [
    ...(riders.contracts ?? []).flatMap((key) => { const rider = (derived.attackRiders ?? []).find((item) => item.key === key); return rider && riderFitsAttack(rider, attack) ? rider.dice : []; }),
    ...crits.dice,
  ];
  const hitSaves = (riders.contracts ?? []).flatMap((key) => { const rider = (derived.attackRiders ?? []).find((item) => item.key === key); return rider && riderFitsAttack(rider, attack) ? rider.saves.map((save) => ({ label: rider.label, ...save })) : []; });
  const declared = (riders.contracts ?? []).map((key) => (derived.attackRiders ?? []).find((item) => item.key === key)).filter((item) => item && riderFitsAttack(item, attack)).map((item) => item!.label);
  return { spec: { name: `${cleave ? `${attack.name} · 쪼개기` : offHand ? `${attack.name} · 보조 손` : attack.name}${savageFeat ? ` · ${savageFeat}` : ""}${declared.length ? ` · ${declared.join(" · ")}` : ""}`, source: "weapon", attackBonus: attack.attackBonus, mode: range.mode, damage, riders: extra, ...(inflicts.length ? { inflicts } : {}), ...(derived.critRange ? { critRange: derived.critRange } : {}), ...(crits.parts.length ? { critRiders: crits.parts } : {}), ...(diceRules.length ? { diceRules } : {}), ...(hitSaves.length ? { hitSaves } : {}), ...(derived.ignoresCover ? { ignoresCover: true } : {}), ...(advantageOn.length ? { advantageOn } : {}), ...(savage ? { savage } : {}), ...(mastery ? { mastery, abilityMod, masteryDc: 8 + abilityMod + derived.proficiencyBonus } : {}) }, spend: (runtime) => spenders.reduce((acc, spend) => spend(acc), runtime) };
}

/**
 * R63 (D198): what the attacker may still add once the swing has landed. 2024 writes 암습, 신성한 강타, 야만적 공격자
 * and most feat riders as "when you hit", so they are offered here, where a hit and a critical are already known,
 * instead of being ticked blind before the dice. `already` is what the attack was declared with, so nothing is offered
 * twice.
 */
/** R82 (D218): the smite spells this sheet can cast on a hit with this weapon, with the slots each may spend. */
export function smiteSpells(derived: DerivedCharacter, runtime: CharacterRuntime, attack: DerivedAttack): Array<{ spellId: string; exec: SpellExec; rule: SpellOnHit; slots: Array<{ level: number; free: number }> }> {
  const ids = new Set(derived.spellcasting.flatMap((list) => [...list.cantrips, ...list.prepared, ...list.alwaysPrepared]));
  const ranged = weaponRange(attack).mode === "ranged";
  return [...ids].flatMap((spellId) => {
    const exec = spellExec(spellId);
    const rule = onHitOf(exec);
    if (!exec || !rule) return [];
    const weapon = rule.weapon ?? "melee";
    if (weapon !== "any" && (weapon === "ranged") !== ranged) return [];
    const slots = smiteSlots(derived, runtime).filter((slot) => slot.level >= exec.baseLevel);
    return slots.length ? [{ spellId, exec, rule, slots }] : [];
  });
}

const ABILITY_SHORT: Record<string, string> = { str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" };

export function hitOffers(entry: Pick<JournalCharacter, "runtime">, derived: DerivedCharacter, attackId: string, already: AttackRiders = {}, catalog?: ContentCatalog): HitOffer[] {
  const attack = derived.attacks.find((item) => item.id === attackId);
  if (!attack) return [];
  const offers: HitOffer[] = [];
  if (!already.sneak && hasSneakAttack(derived, attack)) offers.push({ key: "sneak", label: "암습", oncePerTurn: true, hint: `+${sneakDice(derived)}d6 · 유리하거나 아군이 대상 곁에 있을 때 · 턴당 한 번` });
  const slots = !already.smiteSlot && hasSmite(derived) ? smiteSlots(derived, entry.runtime) : [];
  if (slots.length) offers.push({ key: "smite", label: SMITE_LABEL, hint: "슬롯 소비 · 2d8 + 슬롯 레벨당 1d8 광휘", slots });
  // R82 (D218): the smite spells (분노의 강타, 작열하는 강타 …) — cast on this hit with a slot, as a bonus action.
  for (const smite of smiteSpells(derived, entry.runtime, attack)) {
    if (already.spellSmite?.spellId === smite.spellId) continue;
    const damage = smite.rule.damage ? `+${smite.rule.damage.count}d${smite.rule.damage.sides} ${damageTypeKo(smite.rule.damage.type)}${smite.rule.damage.perSlot ? " (슬롯 레벨당 +1주사위)" : ""}` : "";
    const save = smite.rule.save ? `${ABILITY_SHORT[smite.rule.save.ability] ?? smite.rule.save.ability} 내성${smite.rule.save.conditions?.length ? ` 실패 시 ${smite.rule.save.conditions.map((id) => CONDITION_KO[id] ?? id).join("·")}` : ""}` : "";
    offers.push({ key: `spell:${smite.spellId}`, label: catalog?.spellById(smite.spellId)?.name ?? smite.spellId, hint: [damage, save, smite.rule.inflicts?.length ? smite.rule.inflicts.map((id) => CONDITION_KO[id] ?? id).join("·") : "", "슬롯 · 추가 행동", smite.rule.note ?? ""].filter(Boolean).join(" · "), slots: smite.slots });
  }
  const savage = !already.savage ? savageAttackerFeat(derived) : undefined;
  if (savage) offers.push({ key: "savage", label: savage, oncePerTurn: true, hint: "무기 피해 주사위를 한 번 더 굴려 높은 쪽 · 턴당 한 번" });
  const runtime = entry.runtime;
  const riders = offeredRiders(derived, attack, { moment: "on-hit", effects: (runtime.effects ?? []).map((effect) => effect.name), left: (resourceId) => (derived.resources.find((item) => item.id === resourceId)?.max ?? 0) - (runtime.resourcesUsed[resourceId] ?? 0) });
  for (const rider of riders) if (!(already.contracts ?? []).includes(rider.key)) offers.push({ key: rider.key, label: rider.label, hint: rider.hint, ...(rider.oncePerTurn ? { oncePerTurn: true } : {}), ...(rider.facts.length ? { facts: rider.facts } : {}) });
  return offers;
}

/** R63 (D198): the riders an attack carries once the attacker answered the on-hit window. Built-in keys are named; the rest are contract rule keys. */
export function withHitChoices(riders: AttackRiders, answer: { choices: string[]; facts?: string[]; smiteSlot?: number; spellSmite?: { spellId: string; slot: number } }): AttackRiders {
  const picked = new Set(answer.choices);
  const contracts = [...(riders.contracts ?? []), ...answer.choices.filter((key) => !HIT_BUILT_INS.has(key) && !key.startsWith("spell:"))];
  const facts = [...(riders.facts ?? []), ...(answer.facts ?? [])];
  return {
    ...riders,
    ...(picked.has("sneak") ? { sneak: true } : {}),
    ...(picked.has("savage") ? { savage: true } : {}),
    ...(picked.has("smite") && answer.smiteSlot ? { smiteSlot: answer.smiteSlot } : {}),
    ...(answer.spellSmite && picked.has(`spell:${answer.spellSmite.spellId}`) ? { spellSmite: answer.spellSmite } : {}),
    ...(contracts.length ? { contracts: [...new Set(contracts)] } : {}),
    ...(facts.length ? { facts: [...new Set(facts)] } : {}),
  };
}
const HIT_BUILT_INS = new Set(["sneak", "smite", "savage"]);

/**
 * R64 (D199): the player's standing answer for one offer. 신성한 강타 is never "always" — it spends a slot the player
 * has to pick, so taking it unasked would choose for them.
 */
export const hitPolicyOf = (runtime: CharacterRuntime, offer: HitOffer): HitPolicy => {
  const policy = runtime.hitPolicy?.[offer.key] ?? "ask";
  return policy === "always" && offer.slots ? "ask" : policy;
};
/** R64 (D199): the offers to put in the window, and the ones taken without asking (their facts taken as confirmed). */
export function splitHitOffers(runtime: CharacterRuntime, offers: HitOffer[]): { ask: HitOffer[]; auto: HitOffer[] } {
  return { ask: offers.filter((offer) => hitPolicyOf(runtime, offer) === "ask"), auto: offers.filter((offer) => hitPolicyOf(runtime, offer) === "always") };
}
/** R64 (D199): every offer this sheet can make on any of its attacks, once each — what the sheet lists for its settings. */
export function allHitOffers(entry: Pick<JournalCharacter, "runtime">, derived: DerivedCharacter, catalog?: ContentCatalog): HitOffer[] {
  const seen = new Map<string, HitOffer>();
  for (const attack of derived.attacks) for (const offer of hitOffers(entry, derived, attack.id, {}, catalog)) if (!seen.has(offer.key)) seen.set(offer.key, offer);
  return [...seen.values()];
}

export function npcAttackSpec(entry: JournalNpc, actionName: string): AttackSpec | null {
  const action: MonsterAction | undefined = [...entry.statBlock.actions, ...entry.statBlock.bonusActions, ...entry.statBlock.legendaryActions, ...entry.statBlock.reactions, ...entry.statBlock.traits].find((item) => item.name === actionName);
  if (!action || action.kind !== "attack" || !action.attack) return null;
  const attack = action.attack;
  return { name: action.name, source: "npc", attackBonus: attack.bonus, mode: attack.mode === "ranged" ? "ranged" : "melee", damage: attack.damage.map((part) => ({ formula: damageFormula(part), type: part.type, label: action.name })), inflicts: attack.riderConditions ?? [] };
}

export const derivedOf = (entry: JournalCharacter, catalog: ContentCatalog) => deriveCharacter(entry.source, catalog, { equipped: entry.runtime.equipped, inventory: entry.runtime.inventory, effects: entry.runtime.effects });

/**
 * R9 (D103): an NPC's save action — a breath weapon, a gaze, a legendary sweep — as a spell execution, so the table
 * resolves it like a save spell: every target rolls the save against the block's DC, one damage roll for all (half
 * or nothing on a success), the block's fail conditions land as marks. `level` 0, `spellId` "npc:<name>".
 */
export function npcSaveExec(entry: JournalNpc, actionName: string): { spec: SpellCastSpec; casterStats: CasterStats; action: MonsterAction } | null {
  const block = entry.statBlock;
  // R31 (D160): traits were left out of this lookup, so eleven stat-block traits whose save is fully parsed —
  // 사체 폭발, 악취, 공포 오라, 끔찍한 모습, 죽음의 고통, 횡설수설 — had a DC, an ability, damage and conditions that
  // no code could ever fire. They resolve like any other save action now.
  const action = [...block.actions, ...block.legendaryActions, ...block.bonusActions, ...block.reactions, ...block.traits].find((item) => item.name === actionName);
  if (!action || action.kind !== "save" || !action.save) return null;
  const save = action.save;
  const parts = (save.failDamage ?? []).map((part) => ({ damageType: part.type, dice: { count: part.count, sides: part.sides, ...(part.flat ? { flat: part.flat } : {}) } }));
  const duration: SpellDuration = { kind: "special" };
  const successDamage = save.successDamage === "none" ? "none" : "half";
  const primary: SpellPrimary = parts.length === 1
    ? { kind: "save-damage", saveAbility: save.ability, damageType: parts[0].damageType, dice: parts[0].dice, successDamage }
    : parts.length > 1
      ? { kind: "save-compound-damage", saveAbility: save.ability, components: parts, successDamage }
      : { kind: "save-effect", saveAbility: save.ability, summary: save.failText, duration };
  const exec: SpellExec = {
    spellId: `npc:${action.name}`, baseLevel: 0, castingEconomy: "action",
    targeting: { kind: "creature", minTargets: 1, maxTargets: 64, ...(save.areaFeet ? { rangeFeet: save.areaFeet } : {}) },
    primary, effects: (save.failConditions ?? []).map((conditionId) => ({ conditionId, trigger: "failed-save" as const, duration })),
  };
  return { spec: { spellId: exec.spellId, name: action.name, level: 0, exec }, casterStats: { attackBonus: 0, saveDc: save.dc, modifier: 0, level: 1 }, action };
}
