import type { ActionVm, CharacterSheet, ItemInstanceVm } from "./app/contracts";
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
  toggleItemEquipped(itemId: string): Promise<void>;
  toggleItemAttunement(itemId: string): Promise<void>;
  useItem(itemId: string): Promise<void>;
};

function itemCanUse(item: ItemInstanceVm) {
  return item.kind === "consumable" ? item.quantity > 0 : Boolean(item.charges && item.charges.current > 0);
}

export function OfficialSpellcastingSheetPage({ character: c, view, spellcasting, actions, d20, damage, toggleItemEquipped, toggleItemAttunement, useItem }: Props) {
  const slotByLevel = new Map(spellcasting?.slots.map((slot) => [slot.level, slot]) ?? []);
  return <section className="official-paper official-spell-page official-2024-sheet official-2024-page-two" aria-label="2024 Official Spellcasting Sheet">
    <header className="official-2024-spell-top">
      <section className="official-2024-spellcasting-card"><h2>SPELLCASTING ABILITY</h2><strong>{spellcasting ? signed(spellcasting.spellcastingAbilityModifier) : "—"}</strong><div><span>SPELLCASTING MODIFIER</span><b>{spellcasting ? signed(spellcasting.spellcastingAbilityModifier) : "—"}</b></div><div><span>SPELL SAVE DC</span><b>{spellcasting?.spellSaveDc ?? "—"}</b></div><button disabled={!spellcasting} onClick={() => spellcasting && d20("주문 공격", spellcasting.spellAttackModifier)}><span>SPELL ATTACK BONUS</span><b>{spellcasting ? signed(spellcasting.spellAttackModifier) : "—"}</b></button></section>
      <div className="official-2024-page2-brand"><strong>D&amp;D</strong></div>
      <section className="official-2024-slots"><h2>SPELL SLOTS</h2>{Array.from({ length: 9 }, (_, index) => index + 1).map((level) => { const slot = slotByLevel.get(level); const maximum = view.spellSlots.find((entry) => entry.level === level)?.total; const max = slot?.max ?? maximum; const current = slot?.current ?? max; return <div key={level}><span>LEVEL {level}</span><b>{max ? `${current}/${max}` : "—"}</b></div>; })}</section>
    </header>

    <div className="official-2024-page2-body">
      <section className="official-2024-spell-table"><h2>CANTRIPS &amp; PREPARED SPELLS</h2><header><span>Level</span><span>Name</span><span>Casting Time</span><span>Range</span><span>Concentration, Ritual &amp; Required Material</span><span>Notes</span></header><div>{view.spells.map((spell) => { const action = actions.find((candidate) => candidate.spellCast?.spellId === spell.id); const component = action?.damage?.[0]; const expression = component?.dice ? `${component.dice}${component.flat ? `${component.flat > 0 ? "+" : ""}${component.flat}` : ""}` : ""; return <article key={spell.id}><span>{spell.level}</span><strong>{spell.name}</strong><span>—</span><span>—</span><span>{spell.alwaysPrepared ? "◆ 항상 준비" : spell.prepared ? "● 준비" : "○ 알려짐"}</span><span>{typeof action?.attackBonus === "number" && <button onClick={() => d20(`${spell.name} 주문 공격`, action.attackBonus!)}>공격</button>}{expression && <button onClick={() => damage(spell.name, expression)}>피해</button>}</span></article>; })}</div></section>

      <aside className="official-2024-page2-side">
        <section className="official-2024-ruled official-2024-appearance"><h2>APPEARANCE</h2></section>
        <section className="official-2024-ruled official-2024-backstory"><h2>BACKSTORY &amp; PERSONALITY</h2><p>{c.notes || "기록 없음"}</p><small>Alignment&nbsp;&nbsp; —</small></section>
        <section className="official-2024-ruled official-2024-languages"><h2>LANGUAGES</h2><p>{c.languages?.join(" · ") || "기록 없음"}</p></section>
        <section className="official-2024-ruled official-2024-equipment"><h2>EQUIPMENT</h2><div>{c.items.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{item.quantity > 1 ? `수량 ${item.quantity}` : item.equipped ? "장착" : "보관"}{item.charges ? ` · ${item.charges.current}/${item.charges.max}` : ""}</small></div><span><button onClick={() => toggleItemEquipped(item.id)}>{item.equipped ? "해제" : "장착"}</button>{item.attunementRequired && <button onClick={() => toggleItemAttunement(item.id)}>{item.attuned ? "조율 해제" : "조율"}</button>}{(item.kind === "consumable" || item.charges) && <button disabled={!itemCanUse(item)} onClick={() => useItem(item.id)}>사용</button>}</span></article>)}</div><small>Magic Item Attunement&nbsp;&nbsp; ◇&nbsp;&nbsp; ◇&nbsp;&nbsp; ◇</small></section>
        <section className="official-2024-coins"><h2>COINS</h2><div><span>CP<b>0</b></span><span>SP<b>0</b></span><span>EP<b>0</b></span><span>GP<b>{c.goldGp ?? 0}</b></span><span>PP<b>0</b></span></div></section>
      </aside>
    </div>
  </section>;
}
