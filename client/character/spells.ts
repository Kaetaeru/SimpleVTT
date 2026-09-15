/**
 * Class spellcasting: cantrips known, prepared spells, the wizard's spellbook, always-prepared spells (class,
 * subclass, subclass options), spell levels reachable per class (each class as if single-classed, SRD Multiclassing)
 * and the slot tables (single class from the class table, multiclass from the combined caster level).
 */
import type { ClassLevelRow, ClassView } from "../catalog/catalog";
import type { AbilityKey } from "../catalog/types";
import { COLUMN, numericColumn, SPELLCASTING_ABILITY, WIZARD_SPELLBOOK } from "../rules/classes";
import { fullCasterSlots, multiclassCasterLevel, pactMagicSlots } from "../rules/tables";
import { spellOption, spellOptions } from "./choices";
import type { ClassState, Ledger, SpellcastingAccumulator } from "./ledger";

export function classCastingAbility(cls: ClassView): AbilityKey {
  return SPELLCASTING_ABILITY[cls.slug] ?? cls.primaryAbilities.find((key) => key === "int" || key === "wis" || key === "cha") ?? "int";
}

/** Highest spell level the class can prepare at this row (its own slot columns; Pact Magic uses the slot-level column). */
export function maxSpellLevel(cls: ClassView, row: ClassLevelRow): number {
  if (cls.casterKind === "pact") return numericColumn(row.columns[COLUMN.pactSlotLevel]);
  return Math.max(0, ...Object.keys(classSlotTable(cls, row)).map(Number));
}

/** The class's own slot row: the table columns when the generated table carries them, else the SRD caster tables. */
export function classSlotTable(cls: ClassView, row: ClassLevelRow): Record<number, number> {
  const slots: Record<number, number> = {};
  let found = false;
  for (let level = 1; level <= 9; level += 1) {
    if (!(String(level) in row.columns)) continue;
    found = true;
    const count = numericColumn(row.columns[String(level)]);
    if (count > 0) slots[level] = count;
  }
  if (found) return slots;
  if (cls.casterKind === "full") return fullCasterSlots(row.level);
  if (cls.casterKind === "half") return fullCasterSlots(Math.ceil(row.level / 2));
  return slots;
}

export function classSpellEntry(ledger: Ledger, cls: ClassView): SpellcastingAccumulator {
  return ledger.spellcastingEntry(`class:${cls.id}`, () => ({ classId: cls.id, className: cls.name, ability: classCastingAbility(cls), cantripsMax: 0, preparedMax: 0 }));
}

export function isCasterClass(cls: ClassView) {
  return cls.casterKind !== "none" || Boolean(cls.spells);
}

export function applyClassSpellcasting(ledger: Ledger, cls: ClassView, state: ClassState, row: ClassLevelRow) {
  if (!isCasterClass(cls)) return;
  const { catalog } = ledger;
  const entry = classSpellEntry(ledger, cls);
  const first = state.firstTrack;
  const ask = { scope: "class" as const, sourceLabel: `${cls.name} 주문`, trackIndex: first };
  const bonusCantrip = ledger.flags.has(`bonus-cantrip:${cls.id}`) ? 1 : 0;
  entry.cantripsMax = numericColumn(row.columns[COLUMN.cantrips]) + bonusCantrip;
  entry.preparedMax = numericColumn(row.columns[COLUMN.prepared]);
  const top = maxSpellLevel(cls, row);
  const levels = Array.from({ length: top }, (_, index) => index + 1);
  const lists = [cls.id];
  if (ledger.flags.has(`magical-secrets:${cls.id}`)) for (const slug of ["cleric", "druid", "wizard"]) { const other = catalog.classBySlug(slug); if (other && !lists.includes(other.id)) lists.push(other.id); }

  for (const name of cls.spells?.alwaysPrepared ?? []) {
    const spell = catalog.spellByName(name);
    if (spell) entry.alwaysPrepared.add(spell.id); else ledger.warnings.push(`${cls.name}의 항상 준비 주문 "${name}"을(를) 찾을 수 없습니다.`);
  }

  if (entry.cantripsMax > 0) {
    // A cantrip already known from a feat, the species or another class is not worth a pick here.
    const knownElsewhere = new Set<string>();
    for (const other of ledger.spellcasting.values()) { for (const id of other.extraCantrips) knownElsewhere.add(id); if (other.key !== entry.key) for (const id of other.cantrips) knownElsewhere.add(id); }
    const picked = ledger.ask({ ...ask, id: `class.${first}.cantrips`, label: `${cls.name} 소마법`, count: entry.cantripsMax, options: spellOptions(catalog, lists, [0], undefined, (spell) => (knownElsewhere.has(spell.id) ? "이미 앎" : undefined)) });
    for (const id of picked) entry.cantrips.add(id);
  }

  if (cls.spells?.spellbook !== undefined || cls.slug === "wizard") {
    const spellbookMax = WIZARD_SPELLBOOK.atLevel1 + WIZARD_SPELLBOOK.perLevel * (state.level - 1);
    entry.spellbook = new Set();
    const picked = ledger.ask({ ...ask, id: `class.${first}.spellbook`, label: `주문서 (${spellbookMax}개)`, description: "1레벨에 6개, 이후 레벨마다 2개씩 적습니다. 발견한 주문은 별도로 필사합니다.", count: spellbookMax, options: spellOptions(catalog, lists, levels) });
    for (const id of picked) entry.spellbook.add(id);
    if (entry.preparedMax > 0) {
      const options = picked.map((id) => catalog.spellById(id)).filter((spell): spell is NonNullable<typeof spell> => Boolean(spell)).map((spell) => spellOption(spell));
      const prepared = ledger.ask({ ...ask, id: `class.${first}.spells`, label: `준비 주문 (주문서에서 ${entry.preparedMax}개)`, count: entry.preparedMax, minimum: 0, options });
      for (const id of prepared) entry.prepared.add(id);
    }
    return;
  }

  if (entry.preparedMax > 0 && top > 0) {
    const prepared = ledger.ask({ ...ask, id: `class.${first}.spells`, label: `준비 주문 (${entry.preparedMax}개)`, count: entry.preparedMax, minimum: 0, options: spellOptions(catalog, lists, levels, undefined, (spell) => (entry.alwaysPrepared.has(spell.id) ? "항상 준비" : undefined)) });
    for (const id of prepared) entry.prepared.add(id);
  }
}

/** Spell slots of the whole character: one non-pact caster reads its own table, several combine caster levels. */
export function deriveSpellSlots(ledger: Ledger): { slots: Record<number, number>; pact?: { count: number; level: number } } {
  const { catalog } = ledger;
  const casters: Array<{ cls: ClassView; state: ClassState }> = [];
  let pact: { count: number; level: number } | undefined;
  for (const state of ledger.classes.values()) {
    const cls = catalog.classById(state.classId);
    if (!cls) continue;
    if (cls.casterKind === "pact") { pact = pactMagicSlots(state.level) ?? undefined; continue; }
    if (cls.casterKind === "full" || cls.casterKind === "half") casters.push({ cls, state });
  }
  if (casters.length === 0) return { slots: {}, pact };
  if (casters.length === 1) {
    const { cls, state } = casters[0];
    const row = cls.progression[state.level - 1];
    return { slots: row ? classSlotTable(cls, row) : {}, pact };
  }
  const casterLevel = multiclassCasterLevel(casters.map(({ cls, state }) => ({ kind: cls.casterKind, level: state.level })));
  return { slots: fullCasterSlots(casterLevel), pact };
}
