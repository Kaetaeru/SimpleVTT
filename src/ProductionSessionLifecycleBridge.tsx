import { useState } from "react";
import type { SessionMode } from "./app/contracts";
import type { RuntimeCover } from "./app/spatialRuntimeContracts";
import "./app/theaterOfMindSpatialAdapter";
import { mockAdapter } from "./app/mockAdapter";
import { useSimpleVtt } from "./app/AppProvider";

export function ProductionSessionLifecycleBridge() {
  const { snapshot, refresh, stopSession, startPreparedSession, instantiateCombatant, removeCombatant } = useSimpleVtt();
  const [mode,setMode]=useState<SessionMode>("freeform");
  const [relationSourceId,setRelationSourceId]=useState("");
  const [relationTargetId,setRelationTargetId]=useState("");
  const [distanceFeet,setDistanceFeet]=useState("5");
  const [visible,setVisible]=useState(true);
  const [cover,setCover]=useState<RuntimeCover>("none");
  const [targetCanSeeAttacker,setTargetCanSeeAttacker]=useState(true);
  if (!snapshot || snapshot.session.role !== "host" || !["preparing","live"].includes(snapshot.session.lifecycle ?? "")) return null;

  const players=snapshot.session.participants.filter((participant)=>participant.id!=="host");
  const preparedCombatants=snapshot.scene.entities.filter((entity)=>
    entity.kind==="combatant"&&snapshot.combatantDefinitions.some((definition)=>entity.id.startsWith(`${definition.id}.instance-`)),
  );
  const canStart=snapshot.session.lifecycle==="preparing"
    &&players.length>0
    &&players.every((participant)=>participant.state==="connected"&&participant.ready===true);
  const parsedDistanceFeet=Number(distanceFeet);
  const canAuthorRelation=snapshot.session.lifecycle==="live"
    &&Boolean(relationSourceId)
    &&Boolean(relationTargetId)
    &&relationSourceId!==relationTargetId
    &&Number.isFinite(parsedDistanceFeet)
    &&parsedDistanceFeet>=0;

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
      aria-label="Host 세션 준비 상태"
      data-testid="production-host-preparation"
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
          : "아래 주소를 공유하고 참가자의 Ready와 준비된 Combatant를 확인한 뒤 플레이를 시작하세요."}
      </p>
      <div className="review-rows">
        <div><span>공유 주소</span><strong>{snapshot.session.address || "주소 확인 중"}</strong></div>
        <div><span>Player</span><strong>{players.length}명</strong></div>
        <div><span>Combatant</span><strong>{preparedCombatants.length}개</strong></div>
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
        <div style={{ marginTop:12 }}>
          <strong>Combatant 준비</strong>
          {snapshot.combatantDefinitions.length===0 && <p style={{ opacity:.72 }}>사용 가능한 Combatant Definition이 없습니다.</p>}
          <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginTop:6 }}>
            {snapshot.combatantDefinitions.map((definition)=>(
              <button key={definition.id} type="button" onClick={()=>void instantiateCombatant(definition.id)}>
                + {definition.name}
              </button>
            ))}
          </div>
          {preparedCombatants.length>0 && (
            <div style={{ marginTop:8 }}>
              {preparedCombatants.map((combatant)=>(
                <div key={combatant.id} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:6 }}>
                  <span>{combatant.name} · AC {combatant.ac} · HP {combatant.hp}/{combatant.maxHp}</span>
                  <button type="button" onClick={()=>void removeCombatant(combatant.id)}>제거</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {snapshot.session.lifecycle==="live" && (
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
      )}
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
      <button type="button" onClick={() => void stopSession()}>
        {snapshot.session.lifecycle==="live" ? "세션 종료" : "Host 중지"}
      </button>
    </aside>
  );
}
