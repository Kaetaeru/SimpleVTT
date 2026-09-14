import type { CharacterSheet, SceneEntity } from "../../app/contracts";
import { srdMonsterById } from "../../app/srdMonsterCatalog";
import { SrdMonsterStatBlock } from "../../SrdMonsterStatBlock";
import type { Actor } from "../state";

/** Double-click on a token: a read-only sheet for a character (level, HP, resources, items, spells) or the stat block for a monster. */
export function SheetDrawer({entity,actor,onClose}:{entity:SceneEntity;actor:Actor|null;onClose():void}) {
  const sheet=actor?.source.kind==="character"?actor.source.sheet as CharacterSheet&{cantrips?:string[];preparedSpells?:string[]}:null;
  const monster=actor?.source.kind==="monster"?srdMonsterById(actor.source.definitionId):undefined;
  return <aside className="tw-drawer" role="dialog" aria-label={`${entity.name} 시트`}>
    <header><h2>{entity.name}</h2><button type="button" aria-label="시트 닫기" onClick={onClose}>×</button></header>
    {sheet&&<div className="tw-sheet">
      <div className="tw-kv"><span>{sheet.className} {sheet.subclassName?`· ${sheet.subclassName}`:""} <strong>{sheet.level}레벨</strong></span><span>{sheet.species} · {sheet.background}</span></div>
      <dl>
        <dt>HP</dt><dd>{entity.hp}{entity.tempHp?` (+${entity.tempHp})`:""} / {entity.maxHp}</dd>
        <dt>AC</dt><dd>{entity.ac}</dd>
        <dt>속도</dt><dd>{sheet.speed}피트</dd>
        <dt>숙련</dt><dd>+{sheet.proficiencyBonus}</dd>
        <dt>능력치</dt><dd>{Object.entries(sheet.abilities).map(([key,score])=>`${key.toUpperCase()} ${score}`).join(" · ")}</dd>
        {sheet.saves.length>0&&<><dt>내성</dt><dd>{sheet.saves.join(", ")}</dd></>}
        {sheet.skills.length>0&&<><dt>기술</dt><dd>{sheet.skills.join(", ")}</dd></>}
        {entity.resources&&entity.resources.length>0&&<><dt>자원</dt><dd>{entity.resources.map((pool)=>`${pool.label} ${pool.current}/${pool.maximum}`).join(" · ")}</dd></>}
        {sheet.features.length>0&&<><dt>기능</dt><dd>{sheet.features.join(", ")}</dd></>}
        {sheet.items.length>0&&<><dt>장비</dt><dd>{sheet.items.map((item)=>`${item.name}${item.quantity>1?` ×${item.quantity}`:""}${item.wielded?" (손)":item.equipped?" (착용)":""}`).join(", ")}</dd></>}
        {sheet.cantrips&&sheet.cantrips.length>0&&<><dt>소마법</dt><dd>{sheet.cantrips.map((id)=>id.split(".").pop()).join(", ")}</dd></>}
        {sheet.preparedSpells&&sheet.preparedSpells.length>0&&<><dt>준비 주문</dt><dd>{sheet.preparedSpells.map((id)=>id.split(".").pop()).join(", ")}</dd></>}
      </dl>
    </div>}
    {monster&&<SrdMonsterStatBlock monster={monster}/>}
    {!sheet&&!monster&&<div className="tw-kv"><span>AC <strong>{entity.ac}</strong></span><span>HP <strong>{entity.hp}/{entity.maxHp}</strong></span>{entity.status.length>0&&<span>{entity.status.join(", ")}</span>}</div>}
  </aside>;
}
