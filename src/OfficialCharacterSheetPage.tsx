import type { AbilityKey, CharacterSheet } from "./app/contracts";
import "./app/creationContracts";
import "./app/progressionContracts";
import { projectOfficialSheet, SHEET_ABILITY_LABELS, signed } from "./app/characterSheetV10Projection";
import { sheetAbilityModifier, sheetSaveBonus } from "./app/sheetRollValues";
import type { SheetDieSides, SheetRollMode } from "./OfficialCharacterSheetPlayScreen";

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
type View = ReturnType<typeof projectOfficialSheet>;

type Props = {
  character: CharacterSheet;
  view: View;
  rollMode: SheetRollMode;
  showRollMode: boolean;
  onRollModeChange(mode: SheetRollMode): void;
  onEdit(): void;
  onLevelUp(): void;
  d20(label: string, modifier: number): void;
  rawDie(sides: SheetDieSides, label?: string): void;
  damage(label: string, expression: string): void;
};

function LineField({ label, value }: { label: string; value: string | number }) {
  return <div className="official-2024-line-field"><strong>{value}</strong><span>{label}</span></div>;
}

export function RollModeControl({ mode, onChange, onEdit, onLevelUp }: { mode: SheetRollMode; onChange(mode: SheetRollMode): void; onEdit?: () => void; onLevelUp?: () => void }) {
  return <div className="official-2024-roll-mode"><span>ROLL MODE</span><div role="group" aria-label="d20 굴림 방식">
    <button className={mode === "advantage" ? "active" : ""} aria-pressed={mode === "advantage"} onClick={() => onChange("advantage")}>유리</button>
    <button className={mode === "normal" ? "active" : ""} aria-pressed={mode === "normal"} onClick={() => onChange("normal")}>보통</button>
    <button className={mode === "disadvantage" ? "active" : ""} aria-pressed={mode === "disadvantage"} onClick={() => onChange("disadvantage")}>불리</button>
  </div>{onEdit && <button className="official-2024-sheet-command" onClick={onEdit}>편집</button>}{onLevelUp && <button className="official-2024-sheet-command" onClick={onLevelUp}>레벨 업</button>}</div>;
}

function AbilityPanel({ ability, character, view, d20 }: { ability: AbilityKey; character: CharacterSheet; view: View; d20(label: string, modifier: number): void }) {
  const modifier = sheetAbilityModifier(character, ability);
  const save = sheetSaveBonus(character, view, ability);
  return <section className={`official-2024-ability official-2024-ability-${ability}`}>
    <h2>{SHEET_ABILITY_LABELS[ability]}</h2>
    <button className="official-2024-ability-score" onClick={() => d20(`${SHEET_ABILITY_LABELS[ability]} 판정`, modifier)}><strong>{signed(modifier)}</strong><b>{character.abilities[ability]}</b><small>MODIFIER&nbsp;&nbsp;&nbsp; SCORE</small></button>
    <button className="official-2024-check-row" onClick={() => d20(`${SHEET_ABILITY_LABELS[ability]} 내성 굴림`, save)}><i>{view.saveProficiencies.has(ability) ? "◆" : "◇"}</i><span>Saving Throw</span><strong>{signed(save)}</strong></button>
    {view.skillsByAbility[ability].map((skill) => <button className="official-2024-check-row" key={skill} onClick={() => d20(skill, view.skillBonus(skill, ability))}><i>{view.skillExpertise(skill) ? "✦" : view.skillProficient(skill) ? "◆" : "◇"}</i><span>{skill}</span><strong>{signed(view.skillBonus(skill, ability))}</strong></button>)}
  </section>;
}

export function OfficialCharacterSheetPage({ character: c, view, rollMode, showRollMode, onRollModeChange, onEdit, onLevelUp, d20, rawDie, damage }: Props) {
  const hitDie = ([4, 6, 8, 10, 12, 20] as number[]).includes(view.hitDie) ? view.hitDie as SheetDieSides : 8;
  const hitDice = c.hitDiceByDie ? Object.entries(c.hitDiceByDie).map(([die, count]) => `${count}${die}`).join(" · ") : `d${view.hitDie}`;
  const hasShield = [...c.equipment, ...c.items.map((item) => item.name)].some((name) => /방패|shield/i.test(name));
  return <section className="official-paper official-character-page official-2024-sheet" aria-label="2024 Official Character Sheet">
    <header className="official-2024-hero">
      <div className="official-2024-identity"><LineField label="Character Name" value={c.name} /><LineField label="Background" value={c.background} /><LineField label="Class" value={c.className} /><LineField label="Species" value={c.species} /><LineField label="Subclass" value={c.subclassName || "—"} /></div>
      <div className="official-2024-level"><span>LEVEL</span><strong>{c.level}</strong><span>XP</span><b>—</b></div>
      <div className="official-2024-ac"><span>ARMOR<br/>CLASS</span><strong>{c.ac}</strong><small>SHIELD&nbsp; {hasShield ? "◆" : "◇"}</small></div>
      <div className="official-2024-hp"><h2>HIT POINTS</h2><div><span>CURRENT</span><strong>{c.hp}</strong></div><div><span>TEMP</span><strong>{c.tempHp || "—"}</strong></div><div><span>MAX</span><strong>{c.maxHp}</strong></div></div>
      <button className="official-2024-hit-dice" onClick={() => rawDie(hitDie, `Hit Die d${hitDie}`)}><span>HIT DICE</span><small>SPENT&nbsp; —</small><strong>{hitDice}</strong></button>
      <div className="official-2024-death"><span>DEATH<br/>SAVES</span><small>◇◇◇ SUCCESSES</small><small>◇◇◇ FAILURES</small></div>
    </header>

    <div className="official-2024-brand-row"><span>DUNGEONS &amp; DRAGONS</span>{showRollMode && <RollModeControl mode={rollMode} onChange={onRollModeChange} onEdit={onEdit} onLevelUp={onLevelUp} />}</div>

    <div className="official-2024-body">
      <aside className="official-2024-stat-grid">
        <div className="official-2024-stat-column"><section className="official-2024-proficiency"><h2>PROFICIENCY BONUS</h2><strong>+{c.proficiencyBonus}</strong></section>{ABILITIES.slice(0, 3).map((ability) => <AbilityPanel key={ability} ability={ability} character={c} view={view} d20={d20} />)}<section className="official-2024-inspiration"><h2>HEROIC<br/>INSPIRATION</h2><strong>✦</strong></section></div>
        <div className="official-2024-stat-column">{ABILITIES.slice(3).map((ability) => <AbilityPanel key={ability} ability={ability} character={c} view={view} d20={d20} />)}</div>
        <section className="official-2024-training"><h2>EQUIPMENT TRAINING &amp; PROFICIENCIES</h2><p>ARMOR TRAINING&nbsp;&nbsp; ◇ Light&nbsp; ◇ Medium&nbsp; ◇ Heavy&nbsp; ◇ Shields</p><p>WEAPONS&nbsp;&nbsp; {c.masteryWeapons?.length ? c.masteryWeapons.join(", ") : "기록 없음"}</p><p>{c.languages?.length ? `언어 · ${c.languages.join(", ")}` : "언어 기록 없음"}</p><p>{c.toolProficiencies?.length ? `도구 · ${c.toolProficiencies.join(", ")}` : "도구 기록 없음"}</p></section>
      </aside>

      <main className="official-2024-main">
        <div className="official-2024-derived"><button onClick={() => d20("우선권", sheetAbilityModifier(c, "dex"))}><span>INITIATIVE</span><strong>{signed(sheetAbilityModifier(c, "dex"))}</strong></button><div><span>SPEED</span><strong>{c.speed} ft</strong></div><div><span>SIZE</span><strong>{c.size || "Medium"}</strong></div><div><span>PASSIVE PERCEPTION</span><strong>{view.passivePerception}</strong></div></div>
        <section className="official-2024-ruled official-2024-attacks"><h2>WEAPONS &amp; DAMAGE CANTRIPS</h2><header><span>Name</span><span>Atk Bonus / DC</span><span>Damage &amp; Type</span><span>Notes</span></header>{c.attacks.map((attack) => <div key={attack.id}><strong>{attack.name}</strong><button onClick={() => d20(`${attack.name} 명중`, attack.bonus)}>+{attack.bonus}</button><button onClick={() => damage(attack.name, attack.damage)}>{attack.damage}</button><span>—</span></div>)}</section>
        <section className="official-2024-ruled official-2024-class-features"><h2>CLASS FEATURES</h2><div>{view.classFeatures.map((trait) => <article key={trait.id}><strong>{trait.name}</strong><small>{trait.description || trait.sourceLabel}</small></article>)}</div></section>
        <div className="official-2024-traits"><section className="official-2024-ruled"><h2>SPECIES TRAITS</h2>{view.speciesTraits.map((trait) => <article key={trait.id}><strong>{trait.name}</strong><small>{trait.description || trait.sourceLabel}</small></article>)}</section><section className="official-2024-ruled"><h2>FEATS</h2>{[...view.feats, ...view.otherTraits].map((trait) => <article key={trait.id}><strong>{trait.name}</strong><small>{trait.description || trait.sourceLabel}</small></article>)}</section></div>
      </main>
    </div>
  </section>;
}
