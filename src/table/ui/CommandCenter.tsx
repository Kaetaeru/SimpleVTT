import { useState } from "react";
import type { ActionVm, AppSnapshot, SceneEntity } from "../../app/contracts";
import type { TableCommand } from "../commands";
import { monsterListings, targetingPlan } from "./model";

export interface TargetingState { actionId:string; actorId:string; max:number; eligible:string[]; picked:string[]; slotLevel?:number; amount?:number; formId?:string }

/**
 * The command center (DM_WORKSPACE.md §5): the selected token's hotbar. A tile with one possible target runs at once;
 * otherwise the table enters targeting and token clicks pick targets. Upcast, an amount (Lay on Hands) and a Wild Shape
 * form are asked inline on the tile.
 */
export function CommandCenter({snapshot,actor,role,targeting,onStartTargeting,onCancelTargeting,onConfirmTargeting,dispatch}:{snapshot:AppSnapshot;actor:SceneEntity|null;role:"dm"|"player";targeting:TargetingState|null;onStartTargeting(state:TargetingState):void;onCancelTargeting():void;onConfirmTargeting():void;dispatch(command:TableCommand):Promise<unknown>}) {
  const [slotLevels,setSlotLevels]=useState<Record<string,number>>({});
  const [amounts,setAmounts]=useState<Record<string,number>>({});
  const [formQuery,setFormQuery]=useState("");
  const [formId,setFormId]=useState("");
  if(!actor) return <div className="tw-command"><div className="tw-command-head">{role==="dm"?"토큰을 선택하세요":"캐릭터가 테이블에 없습니다"}</div></div>;
  const actions=snapshot.scene.actionsByActor[actor.id]??[];
  const economy=snapshot.scene.economyByActor[actor.id];
  const run=(action:ActionVm)=>{
    const extra:{slotLevel?:number;amount?:number;formId?:string}={};
    if(action.tableSpell&&slotLevels[action.id]) extra.slotLevel=slotLevels[action.id];
    if(action.tableAmountInput) extra.amount=amounts[action.id]??action.tableAmountInput.min;
    if(action.tableFeature==="wild-shape") extra.formId=formId;
    const plan=targetingPlan(action,actor.id);
    if(plan.kind==="immediate") { void dispatch({type:"act",actorId:actor.id,actionId:action.id,targetIds:plan.targetIds,...extra}); return; }
    onStartTargeting({actionId:action.id,actorId:actor.id,max:plan.max,eligible:plan.eligible,picked:[],...extra});
  };
  const groups:Array<{label:string;filter:(action:ActionVm)=>boolean}>=[
    {label:"공격",filter:(action)=>action.resolutionKind==="attack"&&!action.tableSpell},
    {label:"주문",filter:(action)=>Boolean(action.tableSpell)},
    {label:"기능",filter:(action)=>Boolean(action.tableFeature)&&!action.tableSpell&&action.resolutionKind!=="attack"},
    {label:"행동",filter:(action)=>!action.tableSpell&&!action.tableFeature&&action.resolutionKind!=="attack"},
  ];
  return <div className="tw-command" aria-label="명령 센터">
    <div className="tw-command-head">
      <strong>{actor.name}</strong>
      {economy&&snapshot.sessionMode==="initiative"&&<span className="tw-econ"><span className={economy.action?"on":""}>행동</span><span className={economy.bonusAction?"on":""}>추가</span><span className={economy.reaction?"on":""}>반응</span><span>이동 {economy.movement}/{economy.movementMax}</span></span>}
      {actor.hands&&<span>손: {actor.hands}</span>}
      {targeting&&<span className="tw-targeting">대상 선택 {targeting.picked.length}/{targeting.max} <button type="button" className="primary" disabled={!targeting.picked.length} onClick={onConfirmTargeting}>실행</button><button type="button" className="quiet" onClick={onCancelTargeting}>취소 (Esc)</button></span>}
    </div>
    <div className="tw-hotbar" role="toolbar" aria-label={`${actor.name}의 행동`}>
      {groups.map((group)=>{ const list=actions.filter(group.filter); if(!list.length) return null; return list.map((action)=><ActionTile key={action.id} action={action} active={targeting?.actionId===action.id} slotLevel={slotLevels[action.id]} onSlot={(level)=>setSlotLevels({...slotLevels,[action.id]:level})} amount={amounts[action.id]} onAmount={(value)=>setAmounts({...amounts,[action.id]:value})} onRun={()=>run(action)}/>); })}
      {actions.length===0&&<span style={{color:"var(--quiet)",fontSize:"var(--text-sm)"}}>이 액터의 행동이 없습니다</span>}
    </div>
    {actions.some((action)=>action.tableFeature==="wild-shape")&&<div className="tw-line" style={{display:"flex",gap:6,alignItems:"center",fontSize:"var(--text-sm)"}}>
      <span>야생 변신 형태</span>
      <input type="search" value={formQuery} placeholder="야수 검색 (늑대, 곰…)" aria-label="야생 변신 형태 검색" onChange={(event)=>setFormQuery(event.target.value)}/>
      <select value={formId} aria-label="야생 변신 형태" onChange={(event)=>setFormId(event.target.value)}><option value="">형태…</option>{monsterListings(formQuery,30).filter((monster)=>/야수|beast/i.test(monster.type)).map((monster)=><option key={monster.id} value={monster.id}>{monster.name} · CR {monster.cr}</option>)}</select>
    </div>}
  </div>;
}

function ActionTile({action,active,slotLevel,onSlot,amount,onAmount,onRun}:{action:ActionVm;active:boolean;slotLevel?:number;onSlot(level:number):void;amount?:number;onAmount(value:number):void;onRun():void}) {
  const upcast=action.tableSpell&&action.tableSpell.baseLevel>0&&action.tableSpell.maxSlotLevel>action.tableSpell.baseLevel;
  return <div className={`tw-tile ${action.category==="magic"?"magic":action.category==="weapon"?"weapon":""} ${active?"targeting":""}`} title={action.disabledReason??action.details?.map((entry)=>`${entry.label}: ${entry.value}`).join("\n")}>
    <button type="button" className="quiet" style={{padding:0,textAlign:"left"}} disabled={!action.available} aria-label={`${action.name}${action.available?"":` · ${action.disabledReason??"사용 불가"}`}`} onClick={onRun}>
      <strong>{action.name}</strong>
      <small>{action.economy} · {action.summary}</small>
      {!action.available&&action.disabledReason&&<small style={{color:"var(--bad)"}}>{action.disabledReason}</small>}
    </button>
    {upcast&&<select value={slotLevel??action.tableSpell!.baseLevel} aria-label={`${action.name} 슬롯 레벨`} onChange={(event)=>onSlot(Number(event.target.value))}>{Array.from({length:action.tableSpell!.maxSlotLevel-action.tableSpell!.baseLevel+1},(_,index)=>action.tableSpell!.baseLevel+index).map((level)=><option key={level} value={level}>{level}레벨 슬롯</option>)}</select>}
    {action.tableAmountInput&&<input type="number" min={action.tableAmountInput.min} max={action.tableAmountInput.max} value={amount??action.tableAmountInput.min} aria-label={action.tableAmountInput.label} onChange={(event)=>onAmount(Number(event.target.value))}/>}
  </div>;
}

/** The player's free-action bar (DM_WORKSPACE.md §6): posture, hands, an improvised declaration, a word to the table. */
export function FreeActionBar({snapshot,actor,dispatch}:{snapshot:AppSnapshot;actor:SceneEntity|null;dispatch(command:TableCommand):Promise<unknown>}) {
  const [text,setText]=useState("");
  const [whisper,setWhisper]=useState(false);
  if(!actor) return null;
  const prone=actor.status.some((chip)=>/넘어짐/.test(chip));
  const items=snapshot.activeCharacter.items.filter((item)=>item.kind==="equipment");
  const floor=snapshot.scene.floorItems??[];
  return <div className="tw-freebar" aria-label="자유 행동">
    <button type="button" onClick={()=>void dispatch({type:"posture",actorId:actor.id,posture:prone?"stand":"prone"})}>{prone?"일어나기":"엎드리기"}</button>
    <select aria-label="손에 든 물건" defaultValue="" onChange={(event)=>{ const [op,itemId]=event.target.value.split(":"); if(op&&itemId) void dispatch({type:"object",actorId:actor.id,op:op as "draw"|"stow"|"drop",itemId}); event.target.value=""; }}>
      <option value="">손 · 물건…</option>
      {items.map((item)=><optgroup key={item.id} label={item.name}>{!item.wielded&&<option value={`draw:${item.id}`}>꺼내기</option>}{item.wielded&&<option value={`stow:${item.id}`}>집어넣기</option>}<option value={`drop:${item.id}`}>놓기</option></optgroup>)}
      {floor.map((item)=><option key={item.id} value={`pick-up:${item.id}`}>바닥에서 줍기: {item.name}</option>)}
    </select>
    <button type="button" onClick={()=>void dispatch({type:"declare",actorId:actor.id,movement:"withdraw"})}>물러남</button>
    <input type="text" value={text} placeholder="즉흥 행동이나 한마디…" aria-label="즉흥 행동 또는 서술" onChange={(event)=>setText(event.target.value)} onKeyDown={(event)=>{ if(event.key==="Enter"&&text.trim()) { void dispatch(whisper?{type:"narrate",actorId:actor.id,text,toPeer:"dm"}:{type:"narrate",actorId:actor.id,text}); setText(""); } }}/>
    <button type="button" disabled={!text.trim()} onClick={()=>{ void dispatch({type:"improvise",actorId:actor.id,text}); setText(""); }}>즉흥 행동 (DM 판정)</button>
    <label className="tw-checkrow"><input type="checkbox" checked={whisper} onChange={(event)=>setWhisper(event.target.checked)}/>DM에게만</label>
  </div>;
}
