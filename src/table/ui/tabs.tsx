import { useState } from "react";
import type { AppSnapshot, SceneEntity } from "../../app/contracts";
import { conditionLabelKo } from "../../app/srdMonsterCatalog";
import { SessionRulesPane } from "../../SessionUtilityPanes";
import type { TableCommand } from "../commands";
import { CONDITION_PALETTE, filterActivity, formatClock, isInitiative, type DiscretionInput, type LogFilter, rulingFrom } from "./model";
import { ItemLibrary, MaterialsLibrary, NpcLibrary } from "./LibraryPanels";

interface TabProps { snapshot:AppSnapshot; role:"dm"|"player"; selectedIds:string[]; dispatch(command:TableCommand):Promise<unknown>; onSelect(id:string):void; onOpenCard(resolutionId:string):void; onOpenSheet(id:string):void; onSave?():void; onLeave():void; onStop():void; onFeedback?(message:string):void }

/** 기록: rolls, results, refusals, whispers, system lines; Public/DM filter; a line reopens its card; DM Only → Public. */
export function LogTab({snapshot,role,onOpenCard}:TabProps) {
  const [filter,setFilter]=useState<LogFilter>("all");
  const [query,setQuery]=useState("");
  const entries=filterActivity(snapshot.activity,filter).filter((entry)=>!query.trim()||`${entry.actor} ${entry.title} ${entry.summary}`.includes(query.trim()));
  return <>
    <div className="tw-tabhead">
      <input type="search" value={query} placeholder="기록 검색" aria-label="기록 검색" onChange={(event)=>setQuery(event.target.value)}/>
      {role==="dm"&&<span className="tw-seg" style={{display:"inline-flex"}}>{(["all","public","dm"] as LogFilter[]).map((entry)=><button type="button" key={entry} className={filter===entry?"active":""} onClick={()=>setFilter(entry)}>{entry==="all"?"전체":entry==="public"?"Public":"DM Only"}</button>)}</span>}
    </div>
    <div className="tw-tabbody" role="list" aria-label="기록">
      {entries.length===0&&<div className="tw-empty">아직 기록이 없습니다.</div>}
      {entries.map((entry)=><div key={entry.id} role="listitem" className={`tw-log-item ${entry.visibility&&entry.visibility!=="public"?"dm":""} ${entry.reversed?"reversed":""}`} onClick={()=>entry.resolutionId&&onOpenCard(entry.resolutionId)}>
        <strong>{entry.title}</strong>
        <small>{entry.actor} · {entry.summary}</small>
        {entry.stateChanges.length>0&&<small>{entry.stateChanges.slice(0,3).join(" · ")}</small>}
      </div>)}
    </div>
  </>;
}

/** 전투: the initiative order, round, current turn, per-row HP and chips; start/end, next turn, jump, remove; initiative editable. */
export function CombatTab({snapshot,role,selectedIds,dispatch,onSelect}:TabProps) {
  const scene=snapshot.scene;
  const initiative=isInitiative(snapshot);
  const byId=Object.fromEntries(scene.entities.map((entity)=>[entity.id,entity]));
  const order=(scene.order??[]).map((id)=>byId[id]).filter((entity):entity is SceneEntity=>Boolean(entity));
  const rest=scene.entities.filter((entity)=>!(scene.order??[]).includes(entity.id));
  const row=(entity:SceneEntity,index?:number)=><div key={entity.id} className={`tw-list-item ${scene.currentActorId===entity.id?"current":""} ${selectedIds.includes(entity.id)?"selected":""}`} role="listitem" onClick={()=>onSelect(entity.id)}>
    <span className="tw-idx">{index!==undefined?index+1:""}</span>
    <div className="tw-grow"><strong>{entity.name}{entity.hidden?" (숨김)":""}</strong><small>HP {entity.hpStage??`${entity.hp}/${entity.maxHp}`}{entity.ac?` · AC ${entity.ac}`:""}{entity.status.length?` · ${entity.status.map((chip)=>chip.replace(/^✦ /,"")).join(", ")}`:""}</small></div>
    {role==="dm"&&initiative&&<input type="number" aria-label={`${entity.name} 이니셔티브`} defaultValue={entity.initiative} onClick={(event)=>event.stopPropagation()} onKeyDown={(event)=>{ if(event.key==="Enter") void dispatch({type:"set-actor",actorId:entity.id,patch:{initiative:Number((event.target as HTMLInputElement).value)}}); }}/>}
    {role==="dm"&&<span className="tw-verbs">{initiative&&scene.currentActorId!==entity.id&&<button type="button" onClick={(event)=>{ event.stopPropagation(); void dispatch({type:"set-current-actor",actorId:entity.id}); }}>턴으로</button>}<button type="button" onClick={(event)=>{ event.stopPropagation(); if(window.confirm(`${entity.name} 제거?`)) void dispatch({type:"remove-actor",actorId:entity.id}); }}>제거</button></span>}
  </div>;
  return <>
    <div className="tw-tabhead" style={{alignItems:"center"}}>
      <strong style={{flex:1}}>{initiative?`${scene.round}라운드 · ${byId[scene.currentActorId]?.name??""}의 턴`:"자유 진행"}</strong>
      {role==="dm"&&(initiative?<><button type="button" className="primary" onClick={()=>void dispatch({type:"end-turn"})}>다음 턴 <kbd>N</kbd></button><button type="button" className="quiet" onClick={()=>void dispatch({type:"end-initiative"})}>종료</button></>:<button type="button" className="primary" onClick={()=>void dispatch({type:"start-initiative"})}>이니셔티브 시작</button>)}
    </div>
    <div className="tw-tabbody">
      {initiative&&<div className="tw-order" role="list" aria-label="이니셔티브 순서">{order.map((entity,index)=>row(entity,index))}</div>}
      {rest.length>0&&<><div className="tw-section">{initiative?"순서 밖":"테이블"}</div><div role="list">{rest.map((entity)=>row(entity))}</div></>}
      {scene.benched&&scene.benched.length>0&&<><div className="tw-section">대기석</div>{scene.benched.map((entry)=><div key={entry.id} className="tw-list-item"><div className="tw-grow"><strong>{entry.name}</strong></div><span className="tw-verbs"><button type="button" onClick={()=>void dispatch({type:"bench",actorId:entry.id,present:true})}>복귀</button></span></div>)}</>}
      {scene.entities.length===0&&<div className="tw-empty">테이블이 비어 있습니다.{role==="dm"&&<><br/>액터 탭에서 소환하세요.</>}</div>}
    </div>
  </>;
}

/** 액터 (DM): the party, then the host library (내 NPC·프리셋·장면 묶음) and the SRD catalog; 파티 (player): the party's characters. */
export function ActorsTab({snapshot,role,dispatch,onSelect,onOpenSheet,onFeedback}:TabProps) {
  const [query,setQuery]=useState("");
  const [objectName,setObjectName]=useState("나무 문");
  const [material,setMaterial]=useState<"cloth"|"wood"|"stone"|"iron"|"mithral"|"adamantine">("wood");
  const [size,setSize]=useState<"tiny"|"small"|"medium"|"large">("medium");
  const party=snapshot.scene.entities.filter((entity)=>entity.tableKind==="character");
  const partyList=<>
    <div className="tw-section">파티 {party.length>0&&<span>{party.length}</span>}</div>
    {party.length===0&&<div className="tw-empty">아직 참가한 캐릭터가 없습니다.</div>}
    {party.filter((entity)=>!query.trim()||entity.name.includes(query.trim())).map((entity)=><div key={entity.id} className="tw-list-item" role="listitem"><div className="tw-grow" onClick={()=>onSelect(entity.id)}><strong>{entity.name}</strong><small>HP {entity.hp}/{entity.maxHp} · AC {entity.ac}{entity.hands?` · ${entity.hands}`:""}</small></div><span className="tw-verbs"><button type="button" onClick={()=>onOpenSheet(entity.id)}>시트</button></span></div>)}
  </>;
  if(role==="player") return <>
    <div className="tw-tabhead"><input type="search" value={query} placeholder="파티 검색" aria-label="액터 검색" onChange={(event)=>setQuery(event.target.value)}/></div>
    <div className="tw-tabbody">{partyList}</div>
  </>;
  return <div className="tw-tabstack">
    <NpcLibrary mode="session" snapshot={snapshot} dispatch={dispatch} onFeedback={onFeedback}/>
    <div className="tw-tabbody tw-tabbody-extra">
      {partyList}
      <div className="tw-section">물체</div>
      <div className="tw-form">
        <div className="tw-line"><input type="text" value={objectName} aria-label="물체 이름" onChange={(event)=>setObjectName(event.target.value)}/>
          <select value={material} aria-label="재질" onChange={(event)=>setMaterial(event.target.value as typeof material)}><option value="cloth">천</option><option value="wood">나무</option><option value="stone">돌</option><option value="iron">철</option><option value="mithral">미스랄</option><option value="adamantine">아다만틴</option></select>
          <select value={size} aria-label="크기" onChange={(event)=>setSize(event.target.value as typeof size)}><option value="tiny">초소형</option><option value="small">소형</option><option value="medium">중형</option><option value="large">대형</option></select>
          <button type="button" disabled={!objectName.trim()} onClick={()=>void dispatch({type:"add-actors",specs:[{kind:"object",name:objectName.trim(),material,size}]})}>놓기</button></div>
      </div>
    </div>
  </div>;
}

/** 아이템: the selected character's hands and bag, the scene floor. Granting from the library stays on the campaign screen for now. */
export function ItemsTab({snapshot,role,selectedIds,dispatch,onFeedback}:TabProps) {
  const selected=snapshot.scene.entities.find((entity)=>entity.id===selectedIds[0]);
  const own=role==="player"?snapshot.activeCharacter:selected&&selected.id===snapshot.activeCharacter.id?snapshot.activeCharacter:null;
  const floor=snapshot.scene.floorItems??[];
  if(role==="dm") return <div className="tw-tabstack">
    <ItemLibrary mode="session" snapshot={snapshot} dispatch={dispatch} onFeedback={onFeedback} targetId={selectedIds[0]??null}/>
    <div className="tw-tabbody tw-tabbody-extra">
      <div className="tw-section">{selected?selected.name:"선택한 토큰"}</div>
      {selected?.hands&&<div className="tw-kv"><span>손 <strong>{selected.hands}</strong></span></div>}
      {selected&&selected.tableKind==="character"&&selected.id!==snapshot.activeCharacter.id&&<div className="tw-empty">다른 플레이어의 가방은 그 플레이어가 관리합니다. 시트에서 확인하세요.</div>}
      {own&&own.items.map((item)=><div key={item.id} className="tw-list-item"><div className="tw-grow"><strong>{item.name}{item.quantity>1?` ×${item.quantity}`:""}</strong><small>{item.kind}{item.wielded?" · 손에 듦":item.equipped?" · 장착":""}</small></div></div>)}
      <div className="tw-section">바닥</div>
      {floor.length===0&&<div className="tw-empty">바닥에 놓인 물건이 없습니다.</div>}
      {floor.map((item)=><div key={item.id} className="tw-list-item"><div className="tw-grow"><strong>{item.name}{item.quantity>1?` ×${item.quantity}`:""}</strong><small>{item.droppedByName}이(가) 놓음{item.recoverable?"":" · 회수 불가"}</small></div>{selected&&selected.tableKind==="character"&&<span className="tw-verbs"><button type="button" onClick={()=>void dispatch({type:"object",actorId:selected.id,op:"pick-up",itemId:item.id})}>줍기</button></span>}</div>)}
    </div>
  </div>;
  return <>
    <div className="tw-tabhead"><strong style={{flex:1}}>{selected?`${selected.name}`:"토큰을 선택하세요"}</strong></div>
    <div className="tw-tabbody">
      {selected?.hands&&<div className="tw-kv"><span>손 <strong>{selected.hands}</strong></span></div>}
      {own&&<><div className="tw-section">가방</div>{own.items.map((item)=><div key={item.id} className="tw-list-item"><div className="tw-grow"><strong>{item.name}{item.quantity>1?` ×${item.quantity}`:""}</strong><small>{item.kind}{item.wielded?" · 손에 듦":item.equipped?" · 장착":""}</small></div><span className="tw-verbs">{item.kind==="equipment"&&!item.wielded&&<button type="button" onClick={()=>void dispatch({type:"object",actorId:own.id,op:"draw",itemId:item.id})}>꺼내기</button>}{item.wielded&&<button type="button" onClick={()=>void dispatch({type:"object",actorId:own.id,op:"stow",itemId:item.id})}>집어넣기</button>}<button type="button" onClick={()=>void dispatch({type:"object",actorId:own.id,op:"drop",itemId:item.id})}>놓기</button></span></div>)}</>}
      {selected&&!own&&<div className="tw-empty">{selected.tableKind==="character"?"다른 플레이어의 가방은 그 플레이어가 관리합니다. 시트에서 확인하세요.":"몬스터와 물체는 가방이 없습니다."}</div>}
      <div className="tw-section">바닥</div>
      {floor.length===0&&<div className="tw-empty">바닥에 놓인 물건이 없습니다.</div>}
      {floor.map((item)=><div key={item.id} className="tw-list-item"><div className="tw-grow"><strong>{item.name}{item.quantity>1?` ×${item.quantity}`:""}</strong><small>{item.droppedByName}이(가) 놓음{item.recoverable?"":" · 회수 불가"}</small></div>{selected&&selected.tableKind==="character"&&<span className="tw-verbs"><button type="button" onClick={()=>void dispatch({type:"object",actorId:selected.id,op:"pick-up",itemId:item.id})}>줍기</button></span>}</div>)}
    </div>
  </>;
}

/** 자료 (DM): host-owned images and notes; (player): the image the DM is showing this viewer. */
export function MaterialsTab({snapshot,role,dispatch,onFeedback}:TabProps) {
  if(role==="dm") return <MaterialsLibrary mode="session" snapshot={snapshot} dispatch={dispatch} onFeedback={onFeedback}/>;
  const handout=snapshot.scene.handout;
  return <div className="tw-tabbody">{handout?<div className="tw-preview"><img src={handout.dataUrl} alt={handout.name}/><small>{handout.name}{handout.toPeer?" · 당신에게만":""}</small></div>:<div className="tw-empty">DM이 공개한 자료가 여기에 보입니다.</div>}</div>;
}

/** 규칙: the 14 conditions (apply to the selection) and the rules search. */
export function RulesTab({role,selectedIds,dispatch,onLeave}:TabProps) {
  const [search,setSearch]=useState(false);
  const apply=(input:DiscretionInput)=>{ if(selectedIds.length) void dispatch({type:"ruling",targetIds:selectedIds,ruling:rulingFrom(input)}); };
  if(search) return <div className="tw-tabbody" style={{padding:0}}><SessionRulesPane onClose={()=>setSearch(false)}/></div>;
  return <>
    <div className="tw-tabhead"><strong style={{flex:1}}>상태 14종 (2024)</strong><button type="button" onClick={()=>setSearch(true)}>규칙 검색</button></div>
    <div className="tw-tabbody">
      {CONDITION_PALETTE.map((condition)=><div key={condition.id} className="tw-list-item"><div className="tw-grow"><strong>{conditionLabelKo(condition.id)}</strong><small>{condition.id}</small></div>{role==="dm"&&<span className="tw-verbs"><button type="button" disabled={!selectedIds.length} onClick={()=>apply({kind:"condition",conditionId:condition.id,on:true,preset:"1min"})}>적용 1분</button><button type="button" disabled={!selectedIds.length} onClick={()=>apply({kind:"condition",conditionId:condition.id,on:false})}>해제</button></span>}</div>)}
      <button type="button" className="quiet" onClick={onLeave}>기록으로</button>
    </div>
  </>;
}

/** 세션: address and participants, the clock (rests, time, timers), settings, save and leave. */
export function SessionTab({snapshot,role,dispatch,onSave,onLeave,onStop}:TabProps) {
  const [restKind,setRestKind]=useState<"short"|"long">("short");
  const [timerLabel,setTimerLabel]=useState("");
  const [timerMinutes,setTimerMinutes]=useState(10);
  const scene=snapshot.scene;
  const characters=scene.entities.filter((entity)=>entity.tableKind==="character").map((entity)=>entity.id);
  return <>
    <div className="tw-tabhead"><strong style={{flex:1}}>{snapshot.session.name||"테이블"}</strong>{role==="dm"&&onSave&&<button type="button" onClick={onSave}>저장</button>}<button type="button" onClick={onLeave}>{role==="dm"?"캠페인으로":"제품 화면"}</button><button type="button" onClick={()=>{ if(window.confirm(role==="dm"?"세션을 종료할까요? 저장된 스냅샷은 남습니다.":"세션에서 나갈까요?")) onStop(); }}>{role==="dm"?"세션 종료":"나가기"}</button></div>
    <div className="tw-tabbody">
      <div className="tw-kv"><span>주소 <strong>{snapshot.session.address||"로컬"}</strong></span><span>{snapshot.session.compatibilityMessage}</span></div>
      <div className="tw-section">참가자</div>
      {snapshot.session.participants.map((participant)=><div key={participant.id} className="tw-list-item"><span style={{width:8,height:8,borderRadius:4,background:participant.state==="connected"?"var(--good)":participant.state==="reconnecting"?"var(--warn)":"var(--bad)"}}/><div className="tw-grow"><strong>{participant.name}</strong><small>{participant.characterName??""} · {participant.state}</small></div></div>)}
      <div className="tw-section">시계</div>
      <div className="tw-kv"><span>경과 <strong>{formatClock(scene.clock?.elapsedSeconds??0)}</strong></span><span>시각 <strong>{scene.clock?.timeOfDay??""}</strong></span></div>
      {role==="dm"&&<div className="tw-form">
        <div className="tw-line">{(["1min","10min","1h","8h","to-dawn"] as const).map((preset)=><button type="button" key={preset} onClick={()=>void dispatch({type:"advance-time",preset})}>{preset==="to-dawn"?"새벽까지":preset==="1min"?"+1분":preset==="10min"?"+10분":preset==="1h"?"+1시간":"+8시간"}</button>)}</div>
        <div className="tw-line">
          {scene.resting?<><span>{scene.resting.kind==="short"?"짧은":"긴"} 휴식 진행 중 · 답한 {scene.resting.answered.length}/{scene.resting.actorIds.length}{scene.resting.interrupted?" · 중단됨":""}</span><button type="button" className="primary" onClick={()=>void dispatch({type:"rest-complete"})}>완료</button>{scene.resting.interrupted&&<button type="button" onClick={()=>void dispatch({type:"rest-complete",force:true})}>그래도 완료</button>}</>
          :<><select value={restKind} aria-label="휴식 종류" onChange={(event)=>setRestKind(event.target.value as "short"|"long")}><option value="short">짧은 휴식 (1시간)</option><option value="long">긴 휴식 (8시간)</option></select><button type="button" disabled={!characters.length||isInitiative(snapshot)} onClick={()=>void dispatch({type:"rest",kind:restKind,actorIds:characters})}>휴식 제안</button></>}
        </div>
        <div className="tw-line"><input type="text" value={timerLabel} placeholder="알림 (횃불 꺼짐…)" aria-label="타이머 이름" onChange={(event)=>setTimerLabel(event.target.value)}/><input type="number" min={1} value={timerMinutes} aria-label="타이머 분" onChange={(event)=>setTimerMinutes(Number(event.target.value))}/><button type="button" disabled={!timerLabel.trim()} onClick={()=>{ void dispatch({type:"set-timer",label:timerLabel.trim(),inSeconds:timerMinutes*60}); setTimerLabel(""); }}>타이머</button></div>
        {scene.timers?.map((timer)=><div key={timer.id} className="tw-list-item"><div className="tw-grow"><strong>{timer.label}</strong><small>{formatClock(timer.inSeconds)} 뒤</small></div><span className="tw-verbs"><button type="button" onClick={()=>void dispatch({type:"clear-timer",timerId:timer.id})}>지움</button></span></div>)}
      </div>}
      {role==="dm"&&<>
        <div className="tw-section">설정</div>
        <label className="tw-checkrow"><input type="checkbox" checked={Boolean(scene.tableSettings?.holdAttacks)} onChange={(event)=>void dispatch({type:"set-setting",settings:{holdAttacks:event.target.checked}})}/>공격을 사전 개입으로 잡아둔다 (D42)</label>
        <label className="tw-checkrow"><input type="checkbox" checked={scene.rollVisibility==="dm"} onChange={(event)=>void dispatch({type:"set-roll-visibility",visibility:event.target.checked?"dm":"public"})}/>굴림 기본값 DM Only</label>
      </>}
    </div>
  </>;
}
