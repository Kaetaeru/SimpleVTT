import { useState } from "react";
import type { RuntimeCover } from "./app/spatialRuntimeContracts";
import "./app/productionSessionLifecycleAdapter";
import "./app/theaterOfMindSpatialAdapter";
import { mockAdapter } from "./app/mockAdapter";
import { useSimpleVtt } from "./app/AppProvider";

export function ProductionSessionLifecycleBridge() {
  const { snapshot, refresh, stopSession } = useSimpleVtt();
  const [relationSourceId,setRelationSourceId]=useState("");
  const [relationTargetId,setRelationTargetId]=useState("");
  const [distanceFeet,setDistanceFeet]=useState("5");
  const [visible,setVisible]=useState(true);
  const [cover,setCover]=useState<RuntimeCover>("none");
  const [targetCanSeeAttacker,setTargetCanSeeAttacker]=useState(true);

  if (!snapshot) return null;
  const hostStartFailed=snapshot.session.role==="offline"
    &&snapshot.session.compatibility==="incompatible"
    &&snapshot.session.compatibilityMessage.startsWith("Host start failed:");

  if (hostStartFailed) return (
    <aside
      aria-live="assertive"
      aria-label="Host 시작 실패"
      style={{
        position:"fixed",
        right:18,
        bottom:18,
        zIndex:70,
        width:"min(390px, calc(100vw - 36px))",
        padding:16,
        borderRadius:14,
        border:"1px solid rgba(217,120,120,.55)",
        background:"rgba(18,20,28,.96)",
        boxShadow:"0 18px 48px rgba(0,0,0,.35)",
      }}
    >
      <span className="eyebrow accent">HOST RECOVERY</span>
      <strong style={{display:"block",marginTop:4}}>Host 시작에 실패했습니다.</strong>
      <p style={{margin:"10px 0"}}>{snapshot.session.compatibilityMessage}</p>
      <small>주소·포트·네트워크 상태를 확인한 뒤 세션 연결 화면의 `세션 열기`를 다시 선택하세요.</small>
    </aside>
  );

  if (snapshot.session.role !== "host" || snapshot.session.lifecycle !== "live") return null;

  const players=snapshot.session.participants.filter((participant)=>participant.id!=="host");
  const combatants=snapshot.scene.entities.filter((entity)=>entity.kind==="combatant");
  const parsedDistanceFeet=Number(distanceFeet);
  const canAuthorRelation=Boolean(relationSourceId)
    &&Boolean(relationTargetId)
    &&relationSourceId!==relationTargetId
    &&Number.isFinite(parsedDistanceFeet)
    &&parsedDistanceFeet>=0;
  const hostConnectionLabel=snapshot.connectionState==="connected"
    ? "● 서버 열림"
    : snapshot.connectionState==="reconnecting"
      ? "◌ 연결 확인 중"
      : "○ 서버 연결 끊김";

  const authorSpatialRelation=async()=>{
    if (!canAuthorRelation) return;
    await mockAdapter.setTheaterOfMindSpatialRelation({
      sourceId:relationSourceId,
      targetId:relationTargetId,
      distanceFeet:parsedDistanceFeet,
      visible,
      cover,
      targetCanSeeAttacker,
    });
    await refresh();
  };

  return (
    <aside
      aria-live="polite"
      aria-label="Host 라이브 세션 상태"
      data-testid="production-host-live-status"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 70,
        width: "min(390px, calc(100vw - 36px))",
        maxHeight:"calc(100vh - 36px)",
        overflowY:"auto",
        padding: 16,
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,.18)",
        background: "rgba(18,20,28,.96)",
        boxShadow: "0 18px 48px rgba(0,0,0,.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex:1 }}>
          <span className="eyebrow accent">Host 플레이 중</span>
          <strong style={{ display: "block", marginTop: 4 }}>{snapshot.session.name}</strong>
        </div>
        <span className={`status-text ${snapshot.connectionState}`}>{hostConnectionLabel}</span>
      </div>
      <p style={{ margin: "10px 0 12px" }}>
        Host 권위로 {snapshot.sessionMode} 플레이가 진행 중입니다. Player는 지금 참가해도 현재 세션 상태로 동기화됩니다.
      </p>
      <div className="review-rows">
        <div><span>공유 주소</span><strong>{snapshot.session.address || "주소 확인 중"}</strong></div>
        <div><span>Player</span><strong>{players.length}명</strong></div>
        <div><span>Combatant</span><strong>{combatants.length}개</strong></div>
        <div><span>호환성</span><strong>{snapshot.session.compatibility}</strong></div>
        <div><span>RulesProfile</span><strong>{snapshot.session.rulesProfileId || "확인 중"}</strong></div>
      </div>
      <div style={{ marginTop:12 }}>
        <strong>활성 콘텐츠</strong>
        {snapshot.session.sessionContent.length===0 ? (
          <p style={{ margin:"6px 0",opacity:.72 }}>추가 활성 콘텐츠 없음 · 현재 RulesProfile만 사용합니다.</p>
        ) : (
          <ul style={{ margin:"6px 0 0",paddingLeft:20 }}>
            {snapshot.session.sessionContent.map((entry)=><li key={entry}>{entry}</li>)}
          </ul>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <strong>참가자 연결 상태</strong>
        {players.length===0 && <p style={{ opacity: .72 }}>현재 Player 0명 · Host 혼자서도 플레이할 수 있습니다.</p>}
        {players.map((participant)=>(
          <div key={participant.id} style={{ display:"flex",justifyContent:"space-between",gap:12,marginTop:6 }}>
            <span>{participant.name}{participant.characterName ? ` · ${participant.characterName}` : ""}</span>
            <strong>{participant.state==="connected" ? "연결됨" : participant.state}</strong>
          </div>
        ))}
      </div>
      <div style={{ marginTop:12 }}>
        <strong>거리 관계</strong>
        <p style={{ margin:"6px 0",opacity:.72 }}>그리드 없이 실제 Actor 쌍의 거리·가시성·엄폐를 명시합니다.</p>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6 }}>
          <select aria-label="거리 기준 Actor" value={relationSourceId} onChange={(event)=>setRelationSourceId(event.target.value)}>
            <option value="">기준 Actor</option>
            {snapshot.scene.entities.map((entity)=><option key={entity.id} value={entity.id}>{entity.name}</option>)}
          </select>
          <select aria-label="거리 대상 Actor" value={relationTargetId} onChange={(event)=>setRelationTargetId(event.target.value)}>
            <option value="">대상 Actor</option>
            {snapshot.scene.entities.map((entity)=><option key={entity.id} value={entity.id}>{entity.name}</option>)}
          </select>
          <input aria-label="거리(피트)" type="number" min={0} step={1} value={distanceFeet} onChange={(event)=>setDistanceFeet(event.target.value)} />
          <select aria-label="엄폐" value={cover} onChange={(event)=>setCover(event.target.value as RuntimeCover)}>
            <option value="none">엄폐 없음</option>
            <option value="half">절반 엄폐</option>
            <option value="three-quarters">3/4 엄폐</option>
            <option value="total">완전 엄폐</option>
          </select>
        </div>
        <div style={{ display:"flex",flexWrap:"wrap",gap:10,marginTop:6 }}>
          <label><input type="checkbox" checked={visible} onChange={(event)=>setVisible(event.target.checked)} /> visible · 공격자가 대상을 봄</label>
          <label><input type="checkbox" checked={targetCanSeeAttacker} onChange={(event)=>setTargetCanSeeAttacker(event.target.checked)} /> targetCanSeeAttacker · 대상이 공격자를 봄</label>
        </div>
        <button type="button" disabled={!canAuthorRelation} onClick={()=>void authorSpatialRelation()} style={{ marginTop:8 }}>거리 관계 적용</button>
      </div>
      <p style={{ margin: "10px 0 12px", opacity: .78 }}>{snapshot.session.compatibilityMessage}</p>
      <button type="button" onClick={() => void stopSession()}>세션 종료</button>
    </aside>
  );
}
