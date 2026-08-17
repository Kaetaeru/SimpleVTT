import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { SessionMode } from "./app/contracts";
import type { RuntimeCover } from "./app/spatialRuntimeContracts";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import { publishExternalAdapterSnapshot } from "./app/adapterSnapshotEvents";
import { productionJoinCharacters } from "./app/productionSessionLifecycleAdapter";
import "./app/theaterOfMindSpatialAdapter";
import "./production-session-workspace.css";

function connectionLabel(state:"connected"|"reconnecting"|"disconnected") {
  if (state==="connected") return "연결됨";
  if (state==="reconnecting") return "재연결 중";
  return "연결 끊김";
}

function lifecycleLabel(role:string,lifecycle:string|undefined) {
  if (role==="offline") return "오프라인";
  if (lifecycle==="preparing") return "세션 준비 중";
  if (lifecycle==="connecting") return "Host 확인 중";
  if (lifecycle==="lobby") return "로비";
  if (lifecycle==="live") return "플레이 중";
  return "세션";
}

export function ProductionSessionWorkspaceBridge() {
  const {
    snapshot,
    hostSession,
    joinSession,
    stopSession,
    setSessionReady,
    startPreparedSession,
    instantiateCombatant,
    removeCombatant,
    refresh,
  }=useSimpleVtt();
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [sessionName,setSessionName]=useState("새 플레이 세션");
  const [address,setAddress]=useState("192.168.0.10:3210");
  const [mode,setMode]=useState<SessionMode>("freeform");
  const [relationSourceId,setRelationSourceId]=useState("");
  const [relationTargetId,setRelationTargetId]=useState("");
  const [distanceFeet,setDistanceFeet]=useState("5");
  const [visible,setVisible]=useState(true);
  const [cover,setCover]=useState<RuntimeCover>("none");
  const [targetCanSeeAttacker,setTargetCanSeeAttacker]=useState(true);

  useEffect(()=>{
    const findTarget=()=>setTarget(document.getElementById("production-session-workspace-root"));
    findTarget();
    const observer=new MutationObserver(findTarget);
    observer.observe(document.body,{childList:true,subtree:true});
    return ()=>observer.disconnect();
  },[]);

  useEffect(()=>{
    if (!snapshot) return;
    if (snapshot.session.role==="host"&&snapshot.session.name.trim()) setSessionName(snapshot.session.name);
    if (snapshot.session.role==="client"&&snapshot.session.address.trim()) setAddress(snapshot.session.address);
  },[snapshot?.session.role,snapshot?.session.name,snapshot?.session.address]);

  const candidates=useMemo(()=>snapshot ? productionJoinCharacters(mockAdapter) : [],[snapshot]);
  if (!snapshot||!target) return null;

  const offline=snapshot.session.role==="offline";
  const host=snapshot.session.role==="host";
  const client=snapshot.session.role==="client";
  const preparing=host&&snapshot.session.lifecycle==="preparing";
  const live=snapshot.session.lifecycle==="live";
  const lobby=client&&snapshot.session.lifecycle==="lobby";
  const connecting=client&&snapshot.session.lifecycle==="connecting";
  const reconnecting=client&&snapshot.connectionState==="reconnecting";
  const disconnected=client&&snapshot.connectionState==="disconnected";
  const selected=candidates.find((character)=>character.id===snapshot.activeCharacter.id);
  const localParticipant=snapshot.session.participants.find((participant)=>participant.id===`client:${snapshot.activeCharacter.id}`);
  const ready=Boolean(localParticipant?.ready);
  const players=snapshot.session.participants.filter((participant)=>participant.id!=="host");
  const preparedCombatants=snapshot.scene.entities.filter((entity)=>
    entity.kind==="combatant"&&snapshot.combatantDefinitions.some((definition)=>entity.id.startsWith(`${definition.id}.instance-`)),
  );
  const canStart=preparing&&players.length>0&&players.every((participant)=>participant.state==="connected"&&participant.ready===true);
  const normalizedSessionName=sessionName.trim();
  const canSaveSessionName=preparing&&normalizedSessionName.length>0&&normalizedSessionName.length<=80&&normalizedSessionName!==snapshot.session.name;
  const hasActionableError=snapshot.session.compatibility==="incompatible";
  const hostStartFailed=offline&&hasActionableError&&snapshot.session.compatibilityMessage.startsWith("Host start failed:");
  const parsedDistanceFeet=Number(distanceFeet);
  const canAuthorRelation=host&&live&&Boolean(relationSourceId)&&Boolean(relationTargetId)
    &&relationSourceId!==relationTargetId&&Number.isFinite(parsedDistanceFeet)&&parsedDistanceFeet>=0;

  async function selectCharacter(characterId:string) {
    if (!characterId) return;
    publishExternalAdapterSnapshot(await mockAdapter.selectProductionCharacter(characterId));
  }

  async function openHost() {
    const requestedName=sessionName.trim()||"새 플레이 세션";
    await hostSession();
    const current=await mockAdapter.getSnapshot();
    if (current.session.role!=="host"||current.session.lifecycle!=="preparing") return;
    publishExternalAdapterSnapshot(await mockAdapter.setPreparedSessionName(requestedName));
  }

  async function saveSessionName() {
    if (!canSaveSessionName) return;
    publishExternalAdapterSnapshot(await mockAdapter.setPreparedSessionName(normalizedSessionName));
  }

  async function retryJoin() {
    await stopSession();
    if (address.trim()) await joinSession(address.trim());
  }

  async function authorSpatialRelation() {
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
  }

  const content=(
    <section className="production-session-workspace" aria-label="세션 관리">
      <header className="production-session-workspace__header">
        <div>
          <span className="eyebrow accent">SESSION</span>
          <h1>{offline ? "세션 시작" : snapshot.session.name}</h1>
          <p>{offline
            ? "새 세션을 열거나 다른 Host의 세션에 참가하세요."
            : host
              ? "주소를 공유하고 참가자 준비 상태를 확인하세요."
              : "Host와의 연결 상태와 Ready 상태를 확인하세요."}</p>
        </div>
        <span className={`production-session-state ${snapshot.connectionState}`}>
          {lifecycleLabel(snapshot.session.role,snapshot.session.lifecycle)}
        </span>
      </header>

      {hostStartFailed&&(
        <div className="production-session-alert error" role="alert" aria-live="assertive">
          <strong>Host를 시작하지 못했습니다.</strong>
          <span>{snapshot.session.compatibilityMessage}</span>
          <small>포트 충돌이나 네트워크 상태를 확인한 뒤 아래에서 다시 세션을 열 수 있습니다.</small>
        </div>
      )}

      {offline&&(
        <div className="production-session-entry-grid">
          <article className="production-session-card primary-card">
            <div className="production-session-card__title">
              <span className="production-session-step">HOST</span>
              <div><h2>새 세션 만들기</h2><p>이 PC를 Host로 열고 플레이어를 초대합니다.</p></div>
            </div>
            <label className="field">
              <span>세션 이름</span>
              <input maxLength={80} value={sessionName} onChange={(event)=>setSessionName(event.target.value)} placeholder="예: 금요일 저녁 모험" />
            </label>
            <button type="button" className="primary production-session-primary-action" disabled={!sessionName.trim()} onClick={()=>void openHost()}>
              세션 열기
            </button>
          </article>

          <article className="production-session-card">
            <div className="production-session-card__title">
              <span className="production-session-step">JOIN</span>
              <div><h2>세션 참가하기</h2><p>저장된 Character로 Host 주소에 연결합니다.</p></div>
            </div>
            <label className="field">
              <span>플레이 Character</span>
              <select value={selected?.id??""} onChange={(event)=>void selectCharacter(event.target.value)}>
                <option value="">저장된 Character 선택</option>
                {candidates.map((character)=><option key={character.id} value={character.id}>{character.name}</option>)}
              </select>
            </label>
            {!candidates.length&&<p className="production-session-hint warning">참가하려면 먼저 Character를 생성하고 저장해야 합니다.</p>}
            <label className="field">
              <span>Host 주소</span>
              <input value={address} onChange={(event)=>setAddress(event.target.value)} placeholder="192.168.0.10:3210" inputMode="url" />
            </label>
            <button type="button" className="primary production-session-primary-action" disabled={!selected||!address.trim()} onClick={()=>void joinSession(address.trim())}>
              참가하기
            </button>
            {hasActionableError&&!hostStartFailed&&(
              <div className="production-session-alert error" role="alert">
                <strong>참가할 수 없습니다.</strong><span>{snapshot.session.compatibilityMessage}</span>
              </div>
            )}
          </article>
        </div>
      )}

      {preparing&&(
        <div className="production-session-host-layout">
          <article className="production-session-card production-session-card--wide">
            <div className="production-session-section-head">
              <div><span className="eyebrow accent">HOST 준비</span><h2>세션 정보</h2></div>
              <span className={`status-text ${snapshot.connectionState}`}>{connectionLabel(snapshot.connectionState)}</span>
            </div>
            <div className="production-session-name-row">
              <label className="field"><span>세션 이름</span><input maxLength={80} value={sessionName} onChange={(event)=>setSessionName(event.target.value)} /></label>
              <button type="button" disabled={!canSaveSessionName} onClick={()=>void saveSessionName()}>이름 저장</button>
            </div>
            <div className="production-session-address">
              <span>공유할 Host 주소</span>
              <strong>{snapshot.session.address||"주소 확인 중"}</strong>
              <small>같은 네트워크의 플레이어에게 이 주소를 알려주세요.</small>
            </div>
          </article>

          <article className="production-session-card">
            <div className="production-session-section-head"><div><span className="eyebrow accent">PLAYERS</span><h2>참가자</h2></div><strong>{players.length}명</strong></div>
            {players.length===0&&<p className="production-session-empty">아직 참가한 플레이어가 없습니다.</p>}
            <div className="production-session-roster">
              {players.map((participant)=><div key={participant.id} className="production-session-roster-row"><div><span className={participant.state==="connected"?"ok-dot":"warn-dot"}/><strong>{participant.characterName??participant.name}</strong></div><span>{participant.state!=="connected"?"연결 끊김":participant.ready?"Ready":"대기 중"}</span></div>)}
            </div>
          </article>

          <article className="production-session-card production-session-card--wide">
            <div className="production-session-section-head"><div><span className="eyebrow accent">ENCOUNTER</span><h2>Encounter 준비</h2></div><strong>{preparedCombatants.length}개</strong></div>
            {preparedCombatants.length===0&&<p className="production-session-empty">기본 몬스터는 배치되지 않습니다. 필요할 때 아래에서 Combatant를 추가하세요.</p>}
            {preparedCombatants.length>0&&<div className="production-session-combatants">{preparedCombatants.map((combatant)=><div key={combatant.id} className="production-session-combatant"><div><strong>{combatant.name}</strong><span>AC {combatant.ac} · HP {combatant.hp}/{combatant.maxHp}</span></div><button type="button" onClick={()=>void removeCombatant(combatant.id)}>제거</button></div>)}</div>}
            <div className="production-session-add-row">
              {snapshot.combatantDefinitions.map((definition)=><button type="button" key={definition.id} onClick={()=>void instantiateCombatant(definition.id)}>+ {definition.name}</button>)}
            </div>
          </article>

          <article className="production-session-card production-session-start-card">
            <div><span className="eyebrow accent">START</span><h2>플레이 시작</h2><p>{canStart?"모든 플레이어가 준비되었습니다.":"연결된 모든 플레이어가 Ready가 되면 시작할 수 있습니다."}</p></div>
            <label className="field"><span>진행 방식</span><select value={mode} onChange={(event)=>setMode(event.target.value as SessionMode)}><option value="freeform">자유 진행</option><option value="initiative">이니셔티브</option></select></label>
            <button type="button" className="primary" disabled={!canStart} onClick={()=>void startPreparedSession(mode)}>플레이 시작</button>
            <button type="button" onClick={()=>void stopSession()}>Host 중지</button>
          </article>
        </div>
      )}

      {client&&!offline&&(
        <div className="production-session-client-layout">
          {(reconnecting||disconnected)&&(
            <div className={`production-session-alert ${disconnected?"error":"warning"}`} role="status" aria-live="polite">
              <strong>{reconnecting?"Host와 재연결 중입니다.":"Host 연결이 끊겼습니다."}</strong>
              <span>{snapshot.session.compatibilityMessage||"네트워크 상태를 확인하세요."}</span>
              {disconnected&&<button type="button" onClick={()=>void retryJoin()}>다시 참가</button>}
            </div>
          )}
          <article className="production-session-card production-session-card--wide">
            <div className="production-session-section-head">
              <div><span className="eyebrow accent">{live?"PLAY":"LOBBY"}</span><h2>{live?"세션에 연결됨":"플레이 준비"}</h2></div>
              <span className={`status-text ${snapshot.connectionState}`}>{connecting?"Host 확인 중":connectionLabel(snapshot.connectionState)}</span>
            </div>
            <div className="production-session-summary-grid">
              <div><span>세션</span><strong>{snapshot.session.name}</strong></div>
              <div><span>Host 주소</span><strong>{snapshot.session.address||address}</strong></div>
              <div><span>Character</span><strong>{snapshot.activeCharacter.name}</strong></div>
              {live&&<div><span>진행</span><strong>{snapshot.sessionMode==="initiative"?`이니셔티브 · ${snapshot.scene.round}라운드`:"자유 진행"}</strong></div>}
            </div>
            {lobby&&<div className="production-session-ready-row"><div><strong>{ready?"Ready 상태입니다.":"준비가 되면 Ready를 눌러주세요."}</strong><small>Host가 모든 플레이어의 Ready를 확인한 뒤 플레이를 시작합니다.</small></div><button type="button" className={ready?"secondary":"primary"} disabled={snapshot.connectionState!=="connected"||snapshot.session.compatibility==="incompatible"} onClick={()=>void setSessionReady(!ready)}>{ready?"Ready 취소":"Ready"}</button></div>}
            {connecting&&<p className="production-session-hint">Host와 버전을 확인하고 로비 참가를 준비하고 있습니다.</p>}
            <button type="button" onClick={()=>void stopSession()}>{live?"세션 나가기":"참가 취소"}</button>
          </article>
        </div>
      )}

      {host&&live&&(
        <div className="production-session-live-layout">
          <article className="production-session-card production-session-card--wide">
            <div className="production-session-section-head"><div><span className="eyebrow accent">LIVE HOST</span><h2>{snapshot.session.name}</h2></div><span className={`status-text ${snapshot.connectionState}`}>{connectionLabel(snapshot.connectionState)}</span></div>
            <div className="production-session-summary-grid">
              <div><span>Host 주소</span><strong>{snapshot.session.address}</strong></div>
              <div><span>진행</span><strong>{snapshot.sessionMode==="initiative"?`이니셔티브 · ${snapshot.scene.round}라운드`:"자유 진행"}</strong></div>
              <div><span>참가자</span><strong>{players.length}명</strong></div>
              <div><span>Encounter</span><strong>{preparedCombatants.length} Combatant</strong></div>
            </div>
            <div className="production-session-roster">{players.map((participant)=><div key={participant.id} className="production-session-roster-row"><strong>{participant.characterName??participant.name}</strong><span>{participant.state==="connected"?"연결됨":"연결 끊김"}</span></div>)}</div>
            <details className="production-session-advanced">
              <summary>고급 DM 도구 · 거리 관계</summary>
              <p>필요할 때만 Actor 쌍의 거리, 가시성, 엄폐를 명시합니다.</p>
              <div className="production-session-relation-grid">
                <select aria-label="거리 기준 Actor" value={relationSourceId} onChange={(event)=>setRelationSourceId(event.target.value)}><option value="">기준 Actor</option>{snapshot.scene.entities.map((entity)=><option key={entity.id} value={entity.id}>{entity.name}</option>)}</select>
                <select aria-label="거리 대상 Actor" value={relationTargetId} onChange={(event)=>setRelationTargetId(event.target.value)}><option value="">대상 Actor</option>{snapshot.scene.entities.map((entity)=><option key={entity.id} value={entity.id}>{entity.name}</option>)}</select>
                <input aria-label="거리(피트)" type="number" min={0} step={1} value={distanceFeet} onChange={(event)=>setDistanceFeet(event.target.value)} />
                <select aria-label="엄폐" value={cover} onChange={(event)=>setCover(event.target.value as RuntimeCover)}><option value="none">엄폐 없음</option><option value="half">절반 엄폐</option><option value="three-quarters">3/4 엄폐</option><option value="total">완전 엄폐</option></select>
              </div>
              <div className="production-session-relation-checks"><label><input type="checkbox" checked={visible} onChange={(event)=>setVisible(event.target.checked)} /> 공격자가 대상을 볼 수 있음</label><label><input type="checkbox" checked={targetCanSeeAttacker} onChange={(event)=>setTargetCanSeeAttacker(event.target.checked)} /> 대상이 공격자를 볼 수 있음</label></div>
              <button type="button" disabled={!canAuthorRelation} onClick={()=>void authorSpatialRelation()}>거리 관계 적용</button>
            </details>
            <button type="button" className="danger-action" onClick={()=>void stopSession()}>세션 종료</button>
          </article>
        </div>
      )}
    </section>
  );

  return createPortal(content,target);
}
