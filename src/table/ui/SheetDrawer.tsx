import type { CharacterSheet, CombatantDefinitionVm, SceneEntity } from "../../app/contracts";
import { srdMonsterById } from "../../app/srdMonsterCatalog";
import { abilityScoreLabel } from "../actors";
import { SrdMonsterStatBlock } from "../../SrdMonsterStatBlock";
import type { Actor } from "../state";

/** Double-click on a token: a read-only sheet for a character (level, HP, resources, items, spells) or the stat block for a monster. */
/** A library NPC (no SRD stat block): the numbers the definition carries, in the same shape a DM reads a stat block. */
function LibraryStatBlock({entity,definition}:{entity:SceneEntity;definition?:CombatantDefinitionVm}) {
  const stats=definition?.runtimeStats;
  const attacks=definition?.runtimeActions??[];
  const saves=definition?.runtimeSaveActions??[];
  return <div className="tw-sheet">
    <div className="tw-kv"><span>AC <strong>{entity.ac}</strong></span><span>HP <strong>{entity.hp}/{entity.maxHp}</strong></span>{stats&&<span>속도 <strong>{stats.speed}피트</strong></span>}{definition?.tags&&definition.tags.length>0&&<span>{definition.tags.join(" · ")}</span>}</div>
    {stats&&<dl><dt>능력치</dt><dd>{(["str","dex","con","int","wis","cha"] as const).map((key)=>`${key.toUpperCase()} ${abilityScoreLabel(stats.abilities[key])}`).join(" · ")}</dd>
      {stats.resistances.length>0&&<><dt>저항</dt><dd>{stats.resistances.join(", ")}</dd></>}
      {stats.immunities.length>0&&<><dt>면역</dt><dd>{stats.immunities.join(", ")}</dd></>}
      {attacks.length>0&&<><dt>공격</dt><dd>{attacks.map((attack)=>`${attack.name} ${attack.attackBonus>=0?"+":""}${attack.attackBonus} · ${attack.damage.dice}${attack.damage.flat?` + ${attack.damage.flat}`:""} ${attack.damage.type}${attack.attacksPerAction&&attack.attacksPerAction>1?` ×${attack.attacksPerAction}`:""}`).join(" · ")}</dd></>}
      {saves.length>0&&<><dt>내성 행동</dt><dd>{saves.map((save)=>`${save.name} DC ${save.saveDc}`).join(" · ")}</dd></>}
      {entity.status.length>0&&<><dt>상태</dt><dd>{entity.status.map((chip)=>chip.replace(/^✦ /,"")).join(", ")}</dd></>}
    </dl>}
    {!stats&&entity.status.length>0&&<div className="tw-kv"><span>{entity.status.join(", ")}</span></div>}
  </div>;
}

export function SheetDrawer({entity,actor,role="dm",onClose}:{entity:SceneEntity;actor:Actor|null;role?:"dm"|"player";onClose():void}) {
  const sheet=actor?.source.kind==="character"?actor.source.sheet as CharacterSheet&{cantrips?:string[];preparedSpells?:string[]}:null;
  const monster=actor?.source.kind==="monster"?srdMonsterById(actor.source.definitionId):undefined;
  return <aside className="tw-drawer" role="dialog" aria-label={`${entity.name} 시트`}>
    <header><h2>{entity.name}</h2><button type="button" aria-label="시트 닫기" onClick={onClose}>×</button></header>
    {(entity.portrait||entity.description)&&<div className="tw-sheet-intro">{entity.portrait&&<img className="tw-portrait" src={entity.portrait.dataUrl} alt="" style={{objectPosition:`${entity.portrait.focalX*100}% ${entity.portrait.focalY*100}%`}}/>}{entity.description&&<p>{entity.description}</p>}</div>}
    {role==="dm"&&entity.dmNotes&&<div className="tw-dm-notes"><span className="tw-eyebrow">DM 메모</span><p>{entity.dmNotes}</p></div>}
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
    {!sheet&&!monster&&<LibraryStatBlock entity={entity} definition={actor?.source.kind==="monster"?actor.source.definition:undefined}/>}
  </aside>;
}
