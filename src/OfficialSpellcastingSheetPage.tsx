import type { ActionVm, CharacterSheet } from "./app/contracts";
import type { SpellcastingHudVm } from "./app/spellcastingRuntimeContracts";
import { projectOfficialSheet, signed } from "./app/characterSheetV10Projection";

type View = ReturnType<typeof projectOfficialSheet>;
type Props = {
  character: CharacterSheet;
  view: View;
  spellcasting: SpellcastingHudVm | undefined;
  actions: ActionVm[];
  d20(label: string, modifier: number): void;
  damage(label: string, expression: string): void;
};

function Field({ label, value }: { label: string; value: string | number }) {
  return <div className="official-field"><strong>{value}</strong><span>{label}</span></div>;
}

export function OfficialSpellcastingSheetPage({ character: c, view, spellcasting, actions, d20, damage }: Props) {
  const levels = Array.from({ length: 10 }, (_, level) => ({ level, spells: view.spells.filter((spell) => spell.level === level) }));
  const slotByLevel = new Map(spellcasting?.slots.map((slot) => [slot.level, slot]) ?? []);
  return <section className="official-paper official-spell-page" aria-label="Official Spellcasting Sheet">
    <header className="official-spell-summary"><Field label="Character Name" value={c.name} /><Field label="Spellcasting Class" value={c.className} /><Field label="Spellcasting Ability" value={spellcasting ? `수정치 ${signed(spellcasting.spellcastingAbilityModifier)}` : "미추적"} /><Field label="Spell Save DC" value={spellcasting?.spellSaveDc ?? "—"} /><button className="official-field interactive" disabled={!spellcasting} onClick={() => spellcasting && d20("주문 공격", spellcasting.spellAttackModifier)}><strong>{spellcasting ? signed(spellcasting.spellAttackModifier) : "—"}</strong><span>Spell Attack Bonus</span></button></header>
    <div className="official-spell-levels">{levels.map(({ level, spells }) => { const slot = slotByLevel.get(level); const maximum = view.spellSlots.find((entry) => entry.level === level)?.total; return <section className="official-spell-level" key={level} data-spell-level={level}><header><div><strong>{level}</strong><span>{level === 0 ? "Cantrips" : `Level ${level}`}</span></div>{level > 0 && <div className="official-slot-state"><span>Slots</span><b>{slot ? `${slot.current}/${slot.max}` : maximum ? `${maximum}/${maximum}` : "—"}</b></div>}</header><div className="official-spell-rows">{spells.map((spell) => { const action = actions.find((candidate) => candidate.spellCast?.spellId === spell.id); const canAttack = typeof action?.attackBonus === "number"; const component = action?.damage?.[0]; const canDamage = Boolean(component?.dice); const expression = component?.dice ? `${component.dice}${component.flat ? `${component.flat > 0 ? "+" : ""}${component.flat}` : ""}` : ""; return <article key={spell.id}><span className="official-prepared-mark" aria-label={spell.prepared ? "prepared" : "known"}>{spell.alwaysPrepared ? "◆" : spell.prepared ? "●" : "○"}</span><div><strong>{spell.name}</strong><small>{spell.alwaysPrepared ? "항상 준비" : spell.prepared ? "준비됨" : "알려짐"}</small></div><div className="official-spell-actions">{canAttack && <button onClick={() => d20(`${spell.name} 주문 공격`, action!.attackBonus!)}>주문 공격</button>}{canDamage && <button onClick={() => damage(spell.name, expression)}>피해 굴림</button>}{!canAttack && !canDamage && <button disabled>직접 굴림 없음</button>}</div></article>; })}{!spells.length && <p>—</p>}</div></section>; })}</div>
  </section>;
}
