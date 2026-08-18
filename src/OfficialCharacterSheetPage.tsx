import type { ReactNode } from "react";
import type { AbilityKey, CharacterSheet, ItemInstanceVm } from "./app/contracts";
import "./app/creationContracts";
import "./app/progressionContracts";
import { projectOfficialSheet, SHEET_ABILITY_LABELS, SHEET_SKILLS, signed } from "./app/characterSheetV10Projection";
import { sheetAbilityModifier, sheetSaveBonus } from "./app/sheetRollValues";
import type { SheetDieSides } from "./OfficialCharacterSheetPlayScreen";

const ABILITIES: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];
type View = ReturnType<typeof projectOfficialSheet>;

type Props = {
  character: CharacterSheet;
  view: View;
  d20(label: string, modifier: number): void;
  rawDie(sides: SheetDieSides, label?: string): void;
  damage(label: string, expression: string): void;
  toggleItemEquipped(itemId: string): Promise<void>;
  toggleItemAttunement(itemId: string): Promise<void>;
  useItem(itemId: string): Promise<void>;
};

function Field({ label, value }: { label: string; value: string | number }) {
  return <div className="official-field"><strong>{value}</strong><span>{label}</span></div>;
}
function ListBox({ title, children }: { title: string; children: ReactNode }) {
  return <section className="official-list-box"><h2>{title}</h2><div>{children}</div></section>;
}
function TextBox({ title, children, grow = false }: { title: string; children: ReactNode; grow?: boolean }) {
  return <section className={`official-text-box${grow ? " grow" : ""}`}><div>{children}</div><h2>{title}</h2></section>;
}
function itemCanUse(item: ItemInstanceVm) {
  return item.kind === "consumable" ? item.quantity > 0 : Boolean(item.charges && item.charges.current > 0);
}

export function OfficialCharacterSheetPage({ character: c, view, d20, rawDie, damage, toggleItemEquipped, toggleItemAttunement, useItem }: Props) {
  const traits = [...view.classFeatures, ...view.speciesTraits, ...view.feats, ...view.otherTraits];
  const hitDie = ([4, 6, 8, 10, 12, 20] as number[]).includes(view.hitDie) ? view.hitDie as SheetDieSides : 8;
  return <section className="official-paper official-character-page" aria-label="Official Character Sheet">
    <header className="official-identity-grid"><Field label="Character Name" value={c.name} /><Field label="Class & Level" value={`${c.className} ${c.level}`} /><Field label="Background" value={c.background} /><Field label="Player Name" value="미추적" /><Field label="Race / Species" value={c.species} /><Field label="Alignment" value="미추적" /><Field label="Experience Points" value="미추적" /></header>
    <div className="official-character-grid">
      <section className="official-ability-column" aria-label="Abilities">{ABILITIES.map((ability) => { const modifier = sheetAbilityModifier(c, ability); return <button className="official-ability-block" key={ability} onClick={() => d20(`${SHEET_ABILITY_LABELS[ability]} 판정`, modifier)}><span>{SHEET_ABILITY_LABELS[ability]}</span><strong>{signed(modifier)}</strong><b>{c.abilities[ability]}</b><small>ABILITY CHECK</small></button>; })}</section>
      <section className="official-proficiency-column">
        <div className="official-pair-row"><Field label="Inspiration" value="미추적" /><Field label="Proficiency Bonus" value={`+${c.proficiencyBonus}`} /></div>
        <ListBox title="Saving Throws">{ABILITIES.map((ability) => { const bonus = sheetSaveBonus(c, view, ability); return <button key={ability} onClick={() => d20(`${SHEET_ABILITY_LABELS[ability]} 내성 굴림`, bonus)}><span>{view.saveProficiencies.has(ability) ? "●" : "○"} {SHEET_ABILITY_LABELS[ability]}</span><strong>{signed(bonus)}</strong></button>; })}</ListBox>
        <ListBox title="Skills">{SHEET_SKILLS.map((skill) => { const bonus = view.skillBonus(skill.name, skill.ability); return <button key={skill.name} onClick={() => d20(skill.name, bonus)}><span>{view.skillExpertise(skill.name) ? "◆" : view.skillProficient(skill.name) ? "●" : "○"} {skill.name} <small>({skill.ability.toUpperCase()})</small></span><strong>{signed(bonus)}</strong></button>; })}</ListBox>
        <div className="official-passive"><strong>{view.passivePerception}</strong><span>Passive Wisdom (Perception)</span></div>
        <TextBox title="Other Proficiencies & Languages"><p>{c.languages?.length ? `언어: ${c.languages.join(", ")}` : "언어 기록 없음"}</p><p>{c.toolProficiencies?.length ? `도구: ${c.toolProficiencies.join(", ")}` : "도구 숙련 기록 없음"}</p></TextBox>
      </section>
      <section className="official-combat-column">
        <div className="official-combat-trio"><Field label="Armor Class" value={c.ac} /><button className="official-field interactive" onClick={() => d20("우선권", sheetAbilityModifier(c, "dex"))}><strong>{signed(sheetAbilityModifier(c, "dex"))}</strong><span>Initiative</span></button><Field label="Speed" value={`${c.speed} ft`} /></div>
        <div className="official-hp-box"><span>Hit Point Maximum</span><strong>{c.maxHp}</strong><div><b>{c.hp}</b><small>Current Hit Points</small></div><div><b>{c.tempHp || "—"}</b><small>Temporary Hit Points</small></div></div>
        <div className="official-hitdice-death"><button onClick={() => rawDie(hitDie, `Hit Die d${hitDie}`)}><span>Hit Dice</span><strong>{c.hitDiceByDie ? Object.entries(c.hitDiceByDie).map(([die, count]) => `${count}${die}`).join(" · ") : `d${view.hitDie} · 보유량 미추적`}</strong><small>굴리기</small></button><div><span>Death Saves</span><strong aria-label="Death save state not tracked">○ ○ ○ / ○ ○ ○</strong><small>캐릭터 영속 상태에서 미추적</small></div></div>
        <section className="official-attacks"><h2>Attacks & Spellcasting</h2><div className="official-table-head"><span>Name</span><span>Atk Bonus</span><span>Damage / Type</span><span>Roll</span></div>{c.attacks.map((attack) => <div className="official-attack-row" key={attack.id}><strong>{attack.name}</strong><span>+{attack.bonus}</span><span>{attack.damage}</span><span><button onClick={() => d20(`${attack.name} 명중`, attack.bonus)}>명중</button><button onClick={() => damage(attack.name, attack.damage)}>피해</button></span></div>)}{!c.attacks.length && <p>등록된 공격이 없습니다.</p>}</section>
        <section className="official-resource-box"><h2>Resources</h2><div>{c.resources.map((resource) => <div key={resource.id}><strong>{resource.label}</strong><span>{resource.current}/{resource.max}</span><small>{resource.source}</small></div>)}{!c.resources.length && <p>추적 중인 자원이 없습니다.</p>}</div></section>
        <section className="official-inventory"><header><h2>Equipment & Currency</h2>{c.goldGp !== undefined && <strong>{c.goldGp} GP</strong>}</header><div className="sheet-inventory-list">{c.items.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{item.quantity > 1 ? `수량 ${item.quantity}` : item.equipped ? "장착" : "보관"}{item.charges ? ` · 충전 ${item.charges.current}/${item.charges.max}` : ""}</small></div><div><button onClick={() => toggleItemEquipped(item.id)}>{item.equipped ? "해제" : "장착"}</button>{item.attunementRequired && <button onClick={() => toggleItemAttunement(item.id)}>{item.attuned ? "조율 해제" : "조율"}</button>}{(item.kind === "consumable" || item.charges) && <button className="primary" disabled={!itemCanUse(item)} onClick={() => useItem(item.id)}>사용</button>}</div></article>)}{!c.items.length && c.equipment.map((name) => <article key={name}><div><strong>{name}</strong><small>Character 장비 기록</small></div></article>)}{!c.items.length && !c.equipment.length && <p>장비 항목이 없습니다.</p>}</div></section>
      </section>
      <section className="official-roleplay-column"><TextBox title="Personality Traits"><p>{c.notes || "기록 없음"}</p></TextBox><TextBox title="Ideals"><p>기록 없음</p></TextBox><TextBox title="Bonds"><p>기록 없음</p></TextBox><TextBox title="Flaws"><p>기록 없음</p></TextBox><TextBox title="Features & Traits" grow>{traits.length ? traits.map((trait) => <div key={trait.id}><strong>{trait.name}</strong><small>{trait.sourceLabel}</small></div>) : <p>기록 없음</p>}</TextBox></section>
    </div>
  </section>;
}
