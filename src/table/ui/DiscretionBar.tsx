import { useState } from "react";
import type { ActivityEntry, SceneEntity } from "../../app/contracts";
import { conditionLabelKo, damageLabelKo } from "../../app/srdMonsterCatalog";
import type { TableCommand } from "../commands";
import { CONDITION_PALETTE, DURATION_PRESETS, QUICK_CONDITIONS, rulingFrom, type DiscretionInput, type DurationPreset } from "./model";

const DAMAGE_TYPES=["slashing","piercing","bludgeoning","fire","cold","lightning","acid","poison","necrotic","radiant","force","psychic","thunder"];

/** The DM's discretion bar (DM_WORKSPACE.md §5): always visible, acts on the selection ("3명에게"), one ruling per press, Ctrl+Z undo. */
export function DiscretionBar({selected,lastEntry,dispatch}:{selected:SceneEntity[];lastEntry:ActivityEntry|undefined;dispatch(command:TableCommand):Promise<unknown>}) {
  const [amount,setAmount]=useState(5);
  const [damageType,setDamageType]=useState("");
  const [preset,setPreset]=useState<DurationPreset>("1min");
  const [allConditions,setAllConditions]=useState(false);
  const targetIds=selected.map((entity)=>entity.id);
  const none=targetIds.length===0;
  const prefix=targetIds.length>1?`${targetIds.length}명에게`:selected[0]?.name??"선택 없음";
  const rule=(input:DiscretionInput)=>{ if(none) return; void dispatch({type:"ruling",targetIds,ruling:rulingFrom(input)}); };
  return <div className="tw-discretion" aria-label="DM 재량 바">
    <div className="tw-discretion-head">DM 재량 · {prefix}</div>
    <div className="tw-line">
      <input type="number" min={0} value={amount} aria-label="재량 수치" onChange={(event)=>setAmount(Number(event.target.value))}/>
      <select value={damageType} aria-label="재량 피해 유형" onChange={(event)=>setDamageType(event.target.value)}><option value="">유형 없음</option>{DAMAGE_TYPES.map((type)=><option key={type} value={type}>{damageLabelKo(type)}</option>)}</select>
      <button type="button" disabled={none} onClick={()=>rule({kind:"damage",amount,...(damageType?{damageType}:{})})}>피해</button>
      <button type="button" disabled={none} onClick={()=>rule({kind:"heal",amount})}>회복</button>
      <button type="button" disabled={none} onClick={()=>rule({kind:"temp-hp",amount})}>임시 HP</button>
      <button type="button" disabled={none} onClick={()=>rule({kind:"next-roll",state:"advantage"})}>유리</button>
      <button type="button" disabled={none} onClick={()=>rule({kind:"next-roll",state:"disadvantage"})}>불리</button>
      <button type="button" disabled={none} onClick={()=>rule({kind:"inspiration",on:true})}>영감</button>
    </div>
    <div className="tw-line">
      <select value={preset} aria-label="상태 지속" onChange={(event)=>setPreset(event.target.value as DurationPreset)}>{DURATION_PRESETS.map((entry)=><option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
      {(allConditions?CONDITION_PALETTE.map((entry)=>entry.id):[...QUICK_CONDITIONS]).map((conditionId)=><button type="button" key={conditionId} disabled={none} onClick={()=>rule({kind:"condition",conditionId,on:!selected.every((entity)=>entity.status.some((chip)=>chip.replace(/^✦ /,"").startsWith(conditionLabelKo(conditionId)))),preset})}>{conditionLabelKo(conditionId)}</button>)}
      <button type="button" className="quiet" onClick={()=>setAllConditions(!allConditions)}>{allConditions?"접기":"전체 14종"}</button>
      <button type="button" disabled={!lastEntry} title={lastEntry?`되돌리기: ${lastEntry.title}`:"되돌릴 것이 없습니다"} onClick={()=>void dispatch({type:"undo"})}>↶ 되돌리기{lastEntry?` · ${lastEntry.title.slice(0,18)}`:""}</button>
    </div>
  </div>;
}
