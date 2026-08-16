import { useState } from "react";
import type { SessionMode } from "./app/contracts";
import { useSimpleVtt } from "./app/AppProvider";

export function ProductionSessionLifecycleBridge() {
  const { snapshot, stopSession, startPreparedSession } = useSimpleVtt();
  const [mode,setMode]=useState<SessionMode>("freeform");
  if (!snapshot || snapshot.session.role !== "host" || !["preparing","live"].includes(snapshot.session.lifecycle ?? "")) return null;

  const players=snapshot.session.participants.filter((participant)=>participant.id!=="host");
  const canStart=snapshot.session.lifecycle==="preparing"
    &&players.length>0
    &&players.every((participant)=>participant.state==="connected"&&participant.ready===true);

  return (
    <aside
      aria-live="polite"
      aria-label="Host 세션 준비 상태"
      data-testid="production-host-preparation"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 70,
        width: "min(390px, calc(100vw - 36px))",
        padding: 16,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.18)",
        background: "rgba(18,20,28,.96)",
        boxShadow: "0 18px 48px rgba(0,0,0,.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <span className="eyebrow accent">{snapshot.session.lifecycle==="live" ? "Host 플레이 중" : "Host 준비 중"}</span>
          <strong style={{ display: "block", marginTop: 4 }}>{snapshot.session.name}</strong>
        </div>
        <span className={`status-text ${snapshot.connectionState}`}>● 서버 열림</span>
      </div>
      <p style={{ margin: "10px 0 12px" }}>
        {snapshot.session.lifecycle==="live"
          ? `Host 권위로 ${snapshot.sessionMode} 플레이가 시작되었습니다.`
          : "아래 주소를 공유하고 참가자의 Ready를 확인한 뒤 플레이를 시작하세요."}
      </p>
      <div className="review-rows">
        <div><span>공유 주소</span><strong>{snapshot.session.address || "주소 확인 중"}</strong></div>
        <div><span>Player</span><strong>{players.length}명</strong></div>
        <div><span>호환성</span><strong>{snapshot.session.compatibility}</strong></div>
      </div>
      <div style={{ marginTop: 12 }}>
        <strong>참가자 준비 상태</strong>
        {players.length===0 && <p style={{ opacity: .72 }}>아직 연결된 Player가 없습니다.</p>}
        {players.map((participant)=>(
          <div key={participant.id} style={{ display:"flex",justifyContent:"space-between",gap:12,marginTop:6 }}>
            <span>{participant.name}{participant.characterName ? ` · ${participant.characterName}` : ""}</span>
            <strong>{participant.state!=="connected" ? participant.state : participant.ready ? "Ready" : "대기"}</strong>
          </div>
        ))}
      </div>
      {snapshot.session.lifecycle==="preparing" && (
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12 }}>
          <select aria-label="시작 모드" value={mode} onChange={(event)=>setMode(event.target.value as SessionMode)}>
            <option value="freeform">Freeform</option>
            <option value="initiative">Initiative</option>
          </select>
          <button type="button" className="primary" disabled={!canStart} onClick={()=>void startPreparedSession(mode)}>플레이 시작</button>
        </div>
      )}
      {!canStart && snapshot.session.lifecycle==="preparing" && <small>연결된 모든 Player가 Ready여야 시작할 수 있습니다.</small>}
      <p style={{ margin: "10px 0 12px", opacity: .78 }}>{snapshot.session.compatibilityMessage}</p>
      <button type="button" onClick={() => void stopSession()}>Host 중지</button>
    </aside>
  );
}
