import { useState, type MouseEvent } from "react";
import type { SceneEntity } from "../../app/contracts";
import { damageLabelKo } from "../../app/srdMonsterCatalog";
import { CONDITION_PALETTE, DURATION_PRESETS, hpFraction, hpLabel, hpTone, rulingFrom, type DiscretionInput, type DurationPreset } from "./model";

export interface TokenCardProps {
  entity:SceneEntity;
  role:"dm"|"player";
  selected:boolean;
  current:boolean;
  eligible:boolean;
  picked:boolean;
  names:Record<string,string>;
  onSelect(event:MouseEvent):void;
  onOpenSheet():void;
  onRule?(input:DiscretionInput):void;
  onCommand?(kind:"hide"|"reveal"|"remove"|"bench"|"engage"|"initiative",value?:string|number):void;
  hudOpen:boolean;
  onToggleHud():void;
}

/** A token card (DM_WORKSPACE.md §4): click selects, Shift+click extends, double-click opens the sheet, ⋯ opens the HUD. */
export function TokenCard(props:TokenCardProps) {
  const {entity,role,selected,current,eligible,picked}=props;
  const tone=hpTone(entity);
  const engaged=(entity as {engagedWithIds?:string[]}).engagedWithIds??[];
  const classes=["tw-token",entity.side,selected?"selected":"",current?"current":"",eligible?"eligible":"",picked?"picked":"",entity.hidden?"hidden":"",tone==="down"?"down":""].filter(Boolean).join(" ");
  return <div className={classes} role="button" tabIndex={0} aria-label={`${entity.name} · HP ${hpLabel(entity)}`} aria-pressed={selected} data-entity-id={entity.id} onClick={props.onSelect} onDoubleClick={(event)=>{ event.stopPropagation(); props.onOpenSheet(); }}>
    {current&&<span className="tw-turn">턴</span>}
    <div className="tw-token-head">
      <span className="tw-avatar" aria-hidden="true">{entity.name.slice(0,1)}</span>
      <span className="tw-name">{entity.name}{entity.hidden?" (숨김)":""}</span>
      {role==="dm"&&<button type="button" className="tw-more" aria-label={`${entity.name} 조작`} onClick={(event)=>{ event.stopPropagation(); props.onToggleHud(); }}>⋯</button>}
    </div>
    <div className={`tw-hpbar ${tone}`}><i style={{width:`${hpFraction(entity)*100}%`}}/></div>
    <div className="tw-meta"><span>{entity.hpStage?entity.hpStage:`HP ${hpLabel(entity)}`}</span><span>{entity.ac?`AC ${entity.ac}`:""}{entity.initiative?` · 이니 ${entity.initiative}`:""}</span></div>
    {entity.status.length>0&&<div className="tw-chips">{entity.status.map((chip)=><span key={chip} className={`tw-chip ${chip.startsWith("✦")?"":"badge"}`}>{chip.replace(/^✦ /,"")}</span>)}</div>}
    {engaged.length>0&&<div className="tw-engaged">⚔ {engaged.map((id)=>props.names[id]??id).join(", ")}</div>}
    {entity.hands&&role==="player"&&<div className="tw-engaged" style={{color:"var(--muted)"}}>손: {entity.hands}</div>}
    {props.hudOpen&&role==="dm"&&<TokenHud entity={entity} names={props.names} onRule={(input)=>props.onRule?.(input)} onCommand={(kind,value)=>props.onCommand?.(kind,value)} onOpenSheet={props.onOpenSheet} onClose={props.onToggleHud}/>}
  </div>;
}

const DAMAGE_TYPES=["slashing","piercing","bludgeoning","fire","cold","lightning","acid","poison","necrotic","radiant","force","psychic","thunder"];

/** The token HUD (FVTT-style): HP, the 14 conditions with a duration, next-roll edges, life state, badges, hide, engage, sheet, bench, remove. Every button is one `ruling`. */
export function TokenHud({entity,names,onRule,onCommand,onOpenSheet,onClose}:{entity:SceneEntity;names:Record<string,string>;onRule(input:DiscretionInput):void;onCommand(kind:"hide"|"reveal"|"remove"|"bench"|"engage"|"initiative",value?:string|number):void;onOpenSheet():void;onClose():void}) {
  const [amount,setAmount]=useState(5);
  const [damageType,setDamageType]=useState("");
  const [preset,setPreset]=useState<DurationPreset>("1min");
  const [engageWith,setEngageWith]=useState("");
  const active=new Set(entity.status.map((chip)=>chip.replace(/^✦ /,"").replace(/ \(.*\)$/,"")));
  return <div className="tw-hud" role="dialog" aria-label={`${entity.name} 토큰 HUD`} onClick={(event)=>event.stopPropagation()} onDoubleClick={(event)=>event.stopPropagation()}>
    <div className="tw-hud-row"><strong>{entity.name}</strong><span style={{flex:1}}/><button type="button" onClick={onOpenSheet}>시트</button><button type="button" className="quiet" aria-label="HUD 닫기" onClick={onClose}>×</button></div>
    <div className="tw-hud-row">
      <input type="number" min={0} value={amount} aria-label="수치" onChange={(event)=>setAmount(Number(event.target.value))}/>
      <select value={damageType} aria-label="피해 유형" onChange={(event)=>setDamageType(event.target.value)}><option value="">유형 없음</option>{DAMAGE_TYPES.map((type)=><option key={type} value={type}>{damageLabelKo(type)}</option>)}</select>
      <button type="button" onClick={()=>onRule({kind:"damage",amount,...(damageType?{damageType}:{})})}>피해 −{amount}</button>
      <button type="button" onClick={()=>onRule({kind:"damage",amount:Math.floor(entity.hp/2)})}>절반</button>
      <button type="button" onClick={()=>onRule({kind:"heal",amount})}>회복 +{amount}</button>
      <button type="button" onClick={()=>onRule({kind:"temp-hp",amount})}>임시 HP</button>
      <button type="button" onClick={()=>onRule({kind:"max-hp",delta:amount})}>최대 +{amount}</button>
      <button type="button" onClick={()=>onRule({kind:"max-hp",delta:-amount})}>최대 −{amount}</button>
    </div>
    <div className="tw-hud-row"><span>상태 지속</span><select value={preset} aria-label="상태 지속" onChange={(event)=>setPreset(event.target.value as DurationPreset)}>{DURATION_PRESETS.map((entry)=><option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></div>
    <div className="tw-grid" role="group" aria-label="상태 14종">
      {CONDITION_PALETTE.map((condition)=>{ const on=active.has(condition.label); return <button type="button" key={condition.id} className={on?"on":""} aria-pressed={on} onClick={()=>onRule({kind:"condition",conditionId:condition.id,on:!on,preset})}>{condition.label}</button>; })}
    </div>
    <div className="tw-hud-row">
      <button type="button" onClick={()=>onRule({kind:"next-roll",state:"advantage"})}>다음 굴림 유리</button>
      <button type="button" onClick={()=>onRule({kind:"next-roll",state:"disadvantage"})}>불리</button>
      <button type="button" onClick={()=>onRule({kind:"inspiration",on:true})}>영감</button>
    </div>
    <div className="tw-hud-row">
      <button type="button" onClick={()=>onRule({kind:"life",state:"down"})}>쓰러짐</button>
      <button type="button" onClick={()=>onRule({kind:"life",state:"stable"})}>안정</button>
      <button type="button" onClick={()=>onRule({kind:"life",state:"dead"})}>사망</button>
      <button type="button" onClick={()=>onRule({kind:"life",state:"revive"})}>부활</button>
    </div>
    <div className="tw-hud-row">
      <button type="button" onClick={()=>onRule({kind:"badge",badge:"hidden",on:!active.has("숨음")})}>숨음 배지</button>
      <button type="button" onClick={()=>onRule({kind:"badge",badge:"cover-half",on:true})}>절반 엄폐</button>
      <button type="button" onClick={()=>onRule({kind:"badge",badge:"cover-three-quarters",on:true})}>3/4 엄폐</button>
    </div>
    <div className="tw-hud-row">
      <select value={engageWith} aria-label="교전 대상" onChange={(event)=>setEngageWith(event.target.value)}><option value="">교전 대상…</option>{Object.entries(names).filter(([id])=>id!==entity.id).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
      <button type="button" disabled={!engageWith} onClick={()=>onCommand("engage",engageWith)}>교전</button>
      <input type="number" aria-label="이니셔티브" placeholder="이니" style={{width:60}} onKeyDown={(event)=>{ if(event.key==="Enter") onCommand("initiative",Number((event.target as HTMLInputElement).value)); }}/>
    </div>
    <div className="tw-hud-row">
      <button type="button" onClick={()=>onCommand(entity.hidden?"reveal":"hide")}>{entity.hidden?"공개":"숨기기"}</button>
      <button type="button" onClick={()=>onCommand("bench")}>대기석</button>
      <button type="button" onClick={()=>{ if(window.confirm(`${entity.name}을(를) 테이블에서 제거할까요?`)) onCommand("remove"); }}>제거</button>
    </div>
  </div>;
}

export { rulingFrom };
