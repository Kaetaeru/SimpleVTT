import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import type { ManualMovementReactionKind } from "./app/manualMovementReactionContracts";
import type { RuntimeCover } from "./app/spatialRuntimeContracts";

const COVER_OPTIONS:Array<{ value:RuntimeCover;label:string }> = [
  { value:"none",label:"엄폐 없음" },
  { value:"half",label:"절반 엄폐" },
  { value:"three-quarters",label:"3/4 엄폐" },
  { value:"total",label:"전체 엄폐" },
];

export function MovementReactionBridge() {
  const { snapshot,declareManualMovementReaction }=useSimpleVtt();
  const [host,setHost]=useState<HTMLElement|null>(null);
  const [open,setOpen]=useState(false);
  const [kind,setKind]=useState<ManualMovementReactionKind>("opportunity-attack");
  const [otherLabel,setOtherLabel]=useState("");
  const [reactorId,setReactorId]=useState("");
  const [attackActionId,setAttackActionId]=useState("");
  const [distanceFeet,setDistanceFeet]=useState(5);
  const [visible,setVisible]=useState(true);
  const [targetCanSeeReactor,setTargetCanSeeReactor]=useState(true);
  const [cover,setCover]=useState<RuntimeCover>("none");

  const currentActor=useMemo(
    ()=>snapshot?.scene.entities.find((entity)=>entity.id===snapshot.scene.currentActorId),
    [snapshot],
  );
  const controlsCurrentTurn=Boolean(
    snapshot
    && currentActor
    && snapshot.sessionMode==="initiative"
    && (snapshot.role==="player"
      ? currentActor.id===snapshot.activeCharacter.id
      : currentActor.kind==="combatant"),
  );

  const reactors=useMemo(() => {
    if (!snapshot || !currentActor) return [];
    return snapshot.scene.entities.filter((entity) => {
      if (entity.id===currentActor.id || entity.side===currentActor.side || entity.hp<=0) return false;
      if (!snapshot.scene.economyByActor[entity.id]?.reaction) return false;
      return (snapshot.scene.actionsByActor[entity.id] ?? []).some((action)=>
        action.resolutionKind==="attack" && !action.itemCost && !action.resourceCost,
      );
    });
  },[snapshot,currentActor]);

  const selectedReactor=reactors.find((entity)=>entity.id===reactorId) ?? reactors[0];
  const attacks=useMemo(() => {
    if (!snapshot || !selectedReactor) return [];
    return (snapshot.scene.actionsByActor[selectedReactor.id] ?? []).filter((action)=>
      action.resolutionKind==="attack" && !action.itemCost && !action.resourceCost,
    );
  },[snapshot,selectedReactor]);
  const selectedAttack=attacks.find((action)=>action.id===attackActionId) ?? attacks[0];

  useEffect(() => {
    if (!selectedReactor) {
      setReactorId("");
      return;
    }
    if (reactorId!==selectedReactor.id) setReactorId(selectedReactor.id);
  },[selectedReactor,reactorId]);

  useEffect(() => {
    if (!selectedAttack) {
      setAttackActionId("");
      return;
    }
    if (attackActionId!==selectedAttack.id) setAttackActionId(selectedAttack.id);
  },[selectedAttack,attackActionId]);

  useEffect(() => {
    if (!controlsCurrentTurn) {
      setHost(null);
      setOpen(false);
      return;
    }
    let frame=0;
    const connect=()=>{
      const next=document.querySelector<HTMLElement>(".scene-screen .screen-actions");
      if (!next) {
        frame=requestAnimationFrame(connect);
        return;
      }
      setHost(next);
    };
    frame=requestAnimationFrame(connect);
    return ()=>{
      cancelAnimationFrame(frame);
      setHost(null);
    };
  },[controlsCurrentTurn,snapshot?.scene.currentActorId]);

  useEffect(() => {
    if (snapshot?.resolution) setOpen(false);
  },[snapshot?.resolution?.id]);

  if (!snapshot || !currentActor || !controlsCurrentTurn || !host) return null;

  const button=createPortal(
    <button
      type="button"
      className="movement-reaction-trigger"
      onClick={()=>setOpen((value)=>!value)}
      disabled={Boolean(snapshot.resolution)}
      title="Core가 감지하지 않는 이동 유발 반응을 현재 턴 조종자가 수동 입력합니다."
    >이동 반응 입력</button>,
    host,
  );

  if (!open) return button;

  const submit=async () => {
    if (!selectedReactor || !selectedAttack) return;
    await declareManualMovementReaction({
      kind,
      provokerId:currentActor.id,
      reactorId:selectedReactor.id,
      attackActionId:selectedAttack.id,
      distanceFeet,
      visibleAtTrigger:visible,
      coverAtTrigger:cover,
      targetCanSeeReactorAtTrigger:targetCanSeeReactor,
      triggerLabel:kind==="other-reaction-attack" ? otherLabel : undefined,
    });
    setOpen(false);
  };

  const panel=createPortal(
    <div className="movement-reaction-backdrop" role="presentation" onMouseDown={(event)=>{
      if (event.currentTarget===event.target) setOpen(false);
    }}>
      <section className="movement-reaction-panel" role="dialog" aria-modal="true" aria-label="이동 반응 수동 입력">
        <header>
          <div><small>현재 턴 조종자 입력</small><h2>이동 반응 공격</h2></div>
          <button type="button" onClick={()=>setOpen(false)} aria-label="닫기">×</button>
        </header>
        <p className="movement-reaction-policy">SimpleVTT Core는 이동이나 기회공격 트리거를 자동 감지하지 않습니다. 아래 값은 현재 턴 조종자가 트리거 순간의 authoritative fact로 직접 입력합니다.</p>
        <div className="movement-reaction-grid">
          <label><span>이동 Actor</span><strong>{currentActor.name}</strong></label>
          <label><span>트리거 유형</span><select value={kind} onChange={(event)=>setKind(event.target.value as ManualMovementReactionKind)}><option value="opportunity-attack">기회공격</option><option value="other-reaction-attack">기타 이동 반응 공격</option></select></label>
          {kind==="other-reaction-attack" && <label className="wide"><span>트리거 설명</span><input value={otherLabel} onChange={(event)=>setOtherLabel(event.target.value)} placeholder="예: 적이 내 사거리 안으로 이동" /></label>}
          <label><span>반응자</span><select value={selectedReactor?.id ?? ""} onChange={(event)=>{setReactorId(event.target.value);setAttackActionId("");}}>{reactors.map((entity)=><option value={entity.id} key={entity.id}>{entity.name}</option>)}</select></label>
          <label><span>반응 공격</span><select value={selectedAttack?.id ?? ""} onChange={(event)=>setAttackActionId(event.target.value)}>{attacks.map((action)=><option value={action.id} key={action.id}>{action.name} · {action.summary}</option>)}</select></label>
          <label><span>트리거 순간 거리</span><div className="distance-input"><input type="number" min="0" step="1" value={distanceFeet} onChange={(event)=>setDistanceFeet(Number(event.target.value))}/><b>ft</b></div></label>
          <label><span>엄폐</span><select value={cover} onChange={(event)=>setCover(event.target.value as RuntimeCover)}>{COVER_OPTIONS.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        </div>
        <div className="movement-reaction-checks">
          <label><input type="checkbox" checked={visible} onChange={(event)=>setVisible(event.target.checked)}/> 반응자가 이동 Actor를 볼 수 있었음</label>
          <label><input type="checkbox" checked={targetCanSeeReactor} onChange={(event)=>setTargetCanSeeReactor(event.target.checked)}/> 이동 Actor가 반응자를 볼 수 있었음</label>
        </div>
        {reactors.length===0 && <p className="movement-reaction-empty">현재 Reaction이 남아 있고 공격 Action을 가진 상대가 없습니다.</p>}
        <footer>
          <button type="button" onClick={()=>setOpen(false)}>취소</button>
          <button type="button" className="primary" disabled={!selectedReactor || !selectedAttack || distanceFeet<0 || !Number.isFinite(distanceFeet) || (kind==="other-reaction-attack" && !otherLabel.trim())} onClick={submit}>반응 공격 선언</button>
        </footer>
      </section>
    </div>,
    document.body,
  );

  return <>{button}{panel}</>;
}
