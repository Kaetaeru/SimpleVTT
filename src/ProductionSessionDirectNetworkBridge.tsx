import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import { publishExternalAdapterSnapshot } from "./app/adapterSnapshotEvents";
import { productionJoinCharacters } from "./app/productionSessionLifecycleAdapter";
import {
  DEFAULT_SESSION_BIND_ADDRESS,
  DEFAULT_SESSION_PORT,
  composeSessionEndpoint,
  configureNextSessionHostEndpoint,
} from "./app/sessionEndpointPreferences";
import "./production-session-direct-network.css";

export function ProductionSessionDirectNetworkBridge() {
  const { snapshot, hostSession, joinSession }=useSimpleVtt();
  const [target,setTarget]=useState<HTMLElement|null>(null);
  const [sessionName,setSessionName]=useState("새 플레이 세션");
  const [bindAddress,setBindAddress]=useState(DEFAULT_SESSION_BIND_ADDRESS);
  const [hostPort,setHostPort]=useState(String(DEFAULT_SESSION_PORT));
  const [joinAddress,setJoinAddress]=useState("192.168.0.10");
  const [joinPort,setJoinPort]=useState(String(DEFAULT_SESSION_PORT));
  const [formError,setFormError]=useState("");

  useEffect(()=>{
    const findTarget=()=>setTarget(document.querySelector<HTMLElement>(".production-session-workspace"));
    findTarget();
    const observer=new MutationObserver(findTarget);
    observer.observe(document.body,{childList:true,subtree:true});
    return ()=>observer.disconnect();
  },[]);

  const candidates=useMemo(()=>snapshot ? productionJoinCharacters(mockAdapter) : [],[snapshot]);
  if (!snapshot||!target||snapshot.session.role!=="offline") return null;
  const selected=candidates.find((character)=>character.id===snapshot.activeCharacter.id);
  const actionableError=snapshot.session.compatibility==="incompatible" ? snapshot.session.compatibilityMessage : "";

  async function selectCharacter(characterId:string) {
    if (!characterId) return;
    publishExternalAdapterSnapshot(await mockAdapter.selectProductionCharacter(characterId));
  }

  async function openHost() {
    setFormError("");
    const requestedName=sessionName.trim();
    if (!requestedName) { setFormError("세션 이름이 필요합니다."); return; }
    try {
      configureNextSessionHostEndpoint({bindAddress,port:Number(hostPort)});
    } catch(error) {
      setFormError(error instanceof Error?error.message:String(error));
      return;
    }
    await hostSession();
    const current=await mockAdapter.getSnapshot();
    if (current.session.role!=="host"||current.session.lifecycle!=="live") return;
    publishExternalAdapterSnapshot(await mockAdapter.setPreparedSessionName(requestedName));
  }

  async function joinHost() {
    setFormError("");
    let endpoint:string;
    try {
      endpoint=composeSessionEndpoint(joinAddress,joinPort);
    } catch(error) {
      setFormError(error instanceof Error?error.message:String(error));
      return;
    }
    await joinSession(endpoint);
  }

  return createPortal(
    <div className="production-session-entry-grid v09-direct-network-entry" aria-label="직접 네트워크 세션 시작">
      <article className="production-session-card primary-card">
        <div className="production-session-card__title">
          <span className="production-session-step">HOST</span>
          <div><h2>새 세션 만들기</h2><p>이 PC의 지정한 IP/인터페이스와 포트에서 직접 Host를 엽니다.</p></div>
        </div>
        <label className="field">
          <span>세션 이름</span>
          <input maxLength={80} value={sessionName} onChange={(event)=>setSessionName(event.target.value)} placeholder="예: 금요일 저녁 모험" />
        </label>
        <div className="v09-session-endpoint-fields">
          <label className="field">
            <span>Bind / Listen IP</span>
            <input value={bindAddress} onChange={(event)=>setBindAddress(event.target.value)} placeholder="0.0.0.0" inputMode="url" />
          </label>
          <label className="field v09-session-port-field">
            <span>포트</span>
            <input type="number" min={1} max={65535} inputMode="numeric" value={hostPort} onChange={(event)=>setHostPort(event.target.value)} />
          </label>
        </div>
        <small className="production-session-hint">0.0.0.0은 모든 로컬 인터페이스에서 수신합니다. 특정 인터페이스만 쓰려면 해당 IP를 입력하세요.</small>
        <button type="button" className="primary production-session-primary-action" disabled={!sessionName.trim()||!bindAddress.trim()||!hostPort} onClick={()=>void openHost()}>
          세션 열기
        </button>
      </article>

      <article className="production-session-card">
        <div className="production-session-card__title">
          <span className="production-session-step">JOIN</span>
          <div><h2>세션 참가하기</h2><p>저장된 Character로 Host의 IP/주소와 포트에 직접 연결합니다.</p></div>
        </div>
        <label className="field">
          <span>플레이 Character</span>
          <select value={selected?.id??""} onChange={(event)=>void selectCharacter(event.target.value)}>
            <option value="">저장된 Character 선택</option>
            {candidates.map((character)=><option key={character.id} value={character.id}>{character.name}</option>)}
          </select>
        </label>
        {!candidates.length&&<p className="production-session-hint warning">참가하려면 먼저 Character를 생성하고 저장해야 합니다.</p>}
        <div className="v09-session-endpoint-fields">
          <label className="field">
            <span>Host IP / 주소</span>
            <input value={joinAddress} onChange={(event)=>setJoinAddress(event.target.value)} placeholder="192.168.0.10" inputMode="url" />
          </label>
          <label className="field v09-session-port-field">
            <span>포트</span>
            <input type="number" min={1} max={65535} inputMode="numeric" value={joinPort} onChange={(event)=>setJoinPort(event.target.value)} />
          </label>
        </div>
        <button type="button" className="primary production-session-primary-action" disabled={!selected||!joinAddress.trim()||!joinPort} onClick={()=>void joinHost()}>
          참가하기
        </button>
        {(formError||actionableError)&&(
          <div className="production-session-alert error" role="alert">
            <strong>세션 설정을 확인하세요.</strong><span>{formError||actionableError}</span>
          </div>
        )}
      </article>
    </div>,
    target,
  );
}
