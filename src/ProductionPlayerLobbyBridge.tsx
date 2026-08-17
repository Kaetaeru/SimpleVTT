import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import { publishExternalAdapterSnapshot } from "./app/adapterSnapshotEvents";
import { productionJoinCharacters } from "./app/productionSessionLifecycleAdapter";
import "./production-player-lobby.css";

function lifecycleLabel(lifecycle:string|undefined) {
  switch (lifecycle) {
    case "connecting": return "호환성 확인 중";
    case "lobby": return "로비 참가 완료";
    case "live": return "플레이 중";
    default: return "오프라인";
  }
}

export function ProductionPlayerLobbyBridge() {
  const { snapshot, joinSession, setSessionReady }=useSimpleVtt();
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [address,setAddress]=useState("192.168.0.10:3210");

  useEffect(()=>{
    const findTarget=()=>setTarget(document.querySelector<HTMLElement>(".session-grid"));
    findTarget();
    const observer=new MutationObserver(findTarget);
    observer.observe(document.body,{childList:true,subtree:true});
    return ()=>observer.disconnect();
  },[]);

  const candidates=useMemo(()=>snapshot ? productionJoinCharacters(mockAdapter) : [],[snapshot]);
  if (!snapshot||snapshot.role!=="player"||snapshot.session.role==="host"||!target) return null;
  const selected=candidates.find((character)=>character.id===snapshot.activeCharacter.id);
  const lifecycle=snapshot.session.lifecycle;
  const joining=lifecycle==="connecting";
  const joined=lifecycle==="lobby"||lifecycle==="live";
  const reconnecting=snapshot.session.role==="client"&&snapshot.connectionState==="reconnecting";
  const disconnected=snapshot.session.role==="client"&&snapshot.connectionState==="disconnected";
  const localParticipant=snapshot.session.participants.find((participant)=>participant.id===`client:${snapshot.activeCharacter.id}`);
  const ready=Boolean(localParticipant?.ready);
  const canReady=lifecycle==="lobby"&&snapshot.connectionState==="connected"&&snapshot.session.compatibility!=="incompatible";

  async function selectCharacter(characterId:string) {
    if (!characterId) return;
    publishExternalAdapterSnapshot(await mockAdapter.selectProductionCharacter(characterId));
  }

  return createPortal(
    <article className="panel-card production-player-lobby" aria-label="Production player lobby">
      <div className="production-player-lobby__head">
        <div>
          <span className="eyebrow accent">Player Entry</span>
          <h2>저장 Character로 참가</h2>
        </div>
        <span className={`status-text ${snapshot.connectionState}`}>{reconnecting?"재연결 중":lifecycleLabel(lifecycle)}</span>
      </div>
      {reconnecting&&<p className="production-player-lobby__warning" role="status" aria-live="polite">Host와 재연결 중입니다. 마지막 승인 상태를 유지하며 연결 복구를 기다립니다.</p>}
      {disconnected&&<p className="production-player-lobby__warning" role="status" aria-live="polite">Host 연결이 끊겼습니다. {snapshot.session.compatibilityMessage||"네트워크 상태를 확인하고 연결 복구를 기다리세요."}</p>}
      <label className="field">
        <span>플레이 Character</span>
        <select value={selected?.id ?? ""} onChange={(event)=>void selectCharacter(event.target.value)} disabled={joining||joined}>
          <option value="">저장된 Character 선택</option>
          {candidates.map((character)=><option key={character.id} value={character.id}>{character.name}</option>)}
        </select>
      </label>
      {!candidates.length && <p className="production-player-lobby__warning">저장한 production Character가 없습니다. Character를 생성·저장한 뒤 참가하세요.</p>}
      <label className="field">
        <span>Host 주소</span>
        <input value={address} onChange={(event)=>setAddress(event.target.value)} placeholder="192.168.0.10:3210" disabled={joining||joined}/>
      </label>
      <button className="primary" disabled={!selected || joining || joined || !address.trim()} onClick={()=>void joinSession(address)}>
        {joining ? "Host 호환성 확인 중…" : joined ? "로비 참가 완료" : "선택 Character로 참가"}
      </button>
      {lifecycle==="lobby" && (
        <button className={ready ? "secondary" : "primary"} disabled={!canReady} onClick={()=>void setSessionReady(!ready)}>
          {ready ? "Ready 취소" : "Ready"}
        </button>
      )}
      <div className={`compatibility ${snapshot.session.compatibility}`}>
        <strong>{snapshot.session.compatibility}</strong>
        <span>{snapshot.session.compatibilityMessage}</span>
      </div>
      {localParticipant && lifecycle==="lobby" && <small>Host 확인 상태 · {ready ? "Ready" : "대기 중"}</small>}
      {selected && <small>선택됨 · {selected.name} · {selected.id}</small>}
    </article>,
    target,
  );
}
