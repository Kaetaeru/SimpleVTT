import { SIZE_LABEL_KO, conditionLabelKo, damageLabelKo, srdMonsterAbilityRows, type SrdMonster, type SrdMonsterEntry } from "./app/srdMonsterCatalog";

const signed=(value:number)=>`${value>=0?"+":""}${value}`;

function EntryList({ title, entries }:{ title:string; entries:SrdMonsterEntry[] }) {
  if (!entries.length) return null;
  return <section className="srd-stat-block-section">
    <h3>{title}</h3>
    {entries.map((entry)=><p key={entry.nameEn||entry.name}><strong>{entry.name}{entry.costText ? ` (${entry.costText})` : ""}.</strong> {entry.text}</p>)}
  </section>;
}

/** Korean SRD stat block rendered from the parsed catalog entry (Rules pane, encounter preview). */
export function SrdMonsterStatBlock({ monster }:{ monster:SrdMonster }) {
  const defenses:Array<[string,string]>=[
    ["방어도",monster.acText||String(monster.ac)],
    ["우선권",`${signed(monster.initiativeBonus)}`],
    ["히트 포인트",monster.hitDice ? `${monster.hp} (${monster.hitDice})` : String(monster.hp)],
    ["이동 속도",monster.speedText],
    ...(monster.damageVulnerabilities.length ? [["피해 취약성",monster.damageVulnerabilities.map(damageLabelKo).join(", ")] as [string,string]] : []),
    ...(monster.damageResistances.length ? [["피해 저항",monster.damageResistances.map(damageLabelKo).join(", ")] as [string,string]] : []),
    ...(monster.damageImmunities.length ? [["피해 면역",monster.damageImmunities.map(damageLabelKo).join(", ")] as [string,string]] : []),
    ...(monster.conditionImmunities.length ? [["상태 면역",monster.conditionImmunities.map(conditionLabelKo).join(", ")] as [string,string]] : []),
    ["감각",monster.sensesText||`상시 감지 ${monster.passivePerception}`],
    ["언어",monster.languagesText||"—"],
    ["도전 등급",`${monster.crText} (XP ${monster.xp.toLocaleString("ko-KR")}, 숙련 보너스 ${signed(monster.proficiencyBonus)})`],
  ];
  return <article className="srd-stat-block" aria-label={`${monster.name} 스탯 블록`}>
    <p className="srd-stat-block-type"><em>{SIZE_LABEL_KO[monster.size]??monster.size} {monster.typeText}, {monster.alignment}</em></p>
    <dl className="srd-stat-block-defenses">
      {defenses.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <table className="srd-stat-block-abilities">
      <thead><tr><th>능력</th><th>수치</th><th>수정치</th><th>내성</th></tr></thead>
      <tbody>
        {srdMonsterAbilityRows(monster).map((row)=><tr key={row.key}><th>{row.label}</th><td>{row.score}</td><td>{signed(row.modifier)}</td><td>{signed(row.save)}</td></tr>)}
      </tbody>
    </table>
    <EntryList title="특성" entries={monster.traits} />
    <EntryList title="행동" entries={monster.actions} />
    <EntryList title="추가 행동" entries={monster.bonusActions} />
    <EntryList title="반응 행동" entries={monster.reactions} />
    {monster.legendaryActions.length>0 && <section className="srd-stat-block-section">
      <h3>전설 행동</h3>
      <p className="srd-stat-block-note">라운드당 {monster.legendaryActionsPerRound}회 사용. 다른 크리처의 턴이 끝날 때 하나씩 사용하며, 자신의 턴이 시작될 때 회복됩니다.</p>
      {monster.legendaryActions.map((entry)=><p key={entry.nameEn||entry.name}><strong>{entry.name}{entry.costText ? ` (${entry.costText})` : ""}.</strong> {entry.text}</p>)}
    </section>}
  </article>;
}
