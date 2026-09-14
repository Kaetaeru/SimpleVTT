import type { MouseEvent } from "react";
import type { SceneEntity } from "../../app/contracts";
import { TokenCard } from "./TokenCard";
import { groupEntities, type DiscretionInput } from "./model";

export interface TableStageProps {
  entities:SceneEntity[];
  role:"dm"|"player";
  selectedIds:string[];
  currentActorId:string;
  targeting:{eligible:string[];picked:string[]}|null;
  hudId:string|null;
  onSelect(id:string,event:MouseEvent):void;
  onOpenSheet(id:string):void;
  onRule(id:string,input:DiscretionInput):void;
  onCommand(id:string,kind:"hide"|"reveal"|"remove"|"bench"|"engage"|"initiative",value?:string|number):void;
  onToggleHud(id:string):void;
  focus:React.ReactNode;
  onBackgroundClick():void;
}

/** The table (DM_WORKSPACE.md §2): enemies above, the focus in the middle, allies below; neutrals and objects on the side row. */
export function TableStage(props:TableStageProps) {
  const groups=groupEntities(props.entities);
  const names=Object.fromEntries(props.entities.map((entity)=>[entity.id,entity.name]));
  const row=(label:string,side:"enemy"|"ally"|"neutral",list:SceneEntity[],empty:string)=><div className={`tw-row ${side} ${list.length?"":"empty"}`} data-row={side}>
    <span className="tw-row-label">{label}</span>
    {list.length===0&&<span>{empty}</span>}
    {list.map((entity)=><TokenCard key={entity.id} entity={entity} role={props.role} names={names}
      selected={props.selectedIds.includes(entity.id)} current={props.currentActorId===entity.id}
      eligible={Boolean(props.targeting?.eligible.includes(entity.id))} picked={Boolean(props.targeting?.picked.includes(entity.id))}
      hudOpen={props.hudId===entity.id} onToggleHud={()=>props.onToggleHud(entity.id)}
      onSelect={(event)=>{ event.stopPropagation(); props.onSelect(entity.id,event); }} onOpenSheet={()=>props.onOpenSheet(entity.id)}
      onRule={(input)=>props.onRule(entity.id,input)} onCommand={(kind,value)=>props.onCommand(entity.id,kind,value)}/>)}
  </div>;
  return <section className="tw-stage" aria-label="테이블" onClick={props.onBackgroundClick}>
    {row("상대","enemy",groups.enemies,props.role==="dm"?"액터 탭에서 소환하거나 Ctrl+K로 검색":"아직 상대가 없습니다")}
    <div className="tw-focus" onClick={(event)=>event.stopPropagation()}>{props.focus}</div>
    {row("아군","ally",groups.allies,"참가자가 들어오면 여기에 섭니다")}
    {groups.neutrals.length>0&&row("중립 · 물체","neutral",groups.neutrals,"")}
  </section>;
}
