import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import "./app/connectedLongRestSessionAdapter";

function phaseLabel(phase:"offered"|"declined"|"accepted"|"prepared"|"committed"|"complete"|"aborted") {
  if(phase==="offered") return "결정 대기";
  if(phase==="declined") return "거절됨";
  if(phase==="accepted") return "승인됨";
  if(phase==="prepared") return "저장 준비됨";
  if(phase==="committed") return "캠페인 커밋됨";
  if(phase==="complete") return "완료";
  return "복구 필요";
}

function optionSummary(advanceMinutes:number,consumeRations:boolean) {
  const values=[
    advanceMinutes>0?`시간 +${advanceMinutes}분`:"시간 진행 없음",
    consumeRations?"하루치 식량 소비":"식량 소비 없음",
  ];
  return values.join(" · ");
}

export function ConnectedLongRestDmControls({
  advanceTime,
  consumeRations,
  disabled=false,
}:{advanceTime:boolean;consumeRations:boolean;disabled?:boolean}) {
  const api=useSimpleVtt();
  const [busyCharacterId,setBusyCharacterId]=useState<string|null>(null);
  const [message,setMessage]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const snapshot=api.snapshot;
  const projection=snapshot?.campaignSessionSystems;
  const isLiveHost=snapshot?.session.role==="host"
    &&snapshot.connectionState==="connected"
    &&Boolean(snapshot.session.address)
    &&!snapshot.session.address.startsWith("debug://");
  const remoteMembers=projection?.roster.filter((member)=>
    member.kind==="player-character-ref"
    &&member.active
    &&member.connectionState==="connected"
    &&Boolean(member.characterId)
    &&member.characterId!==snapshot?.activeCharacter.id,
  )??[];

  if(!isLiveHost) return null;

  const offer=async(characterId:string,label:string)=>{
    setBusyCharacterId(characterId);setMessage(null);setError(null);
    try{
      await mockAdapter.startConnectedLongRest({
        characterId,
        advanceMinutes:advanceTime?480:0,
        consumeRations,
      });
      await api.refresh();
      setMessage(`${label}에게 장기 휴식 제안을 보냈습니다.`);
    }catch(reason){
      setError(reason instanceof Error?reason.message:"원격 장기 휴식 제안을 보내지 못했습니다.");
    }finally{
      setBusyCharacterId(null);
    }
  };

  return <section className="session-campaign-advancement" aria-label="연결된 플레이어 장기 휴식">
    <header><div><span>CONNECTED REST</span><h3>연결된 Player</h3></div><small>{remoteMembers.length}명</small></header>
    {!remoteMembers.length?<p className="session-campaign-muted">현재 장기 휴식을 제안할 연결된 Player Character가 없습니다.</p>:<div className="session-campaign-xp-list">
      {remoteMembers.map((member)=><div className="session-campaign-xp-member" key={member.rosterMemberId}>
        <span><strong>{member.label}</strong><small>{optionSummary(advanceTime?480:0,consumeRations)}</small></span>
        <b>접속 중</b>
        <button type="button" className="primary" disabled={disabled||Boolean(busyCharacterId)} onClick={()=>void offer(member.characterId!,member.label)}>장기 휴식 제안</button>
      </div>)}
    </div>}
    {message&&<p className="session-campaign-note" role="status">{message}</p>}
    {error&&<p className="session-campaign-warning" role="alert">{error}</p>}
  </section>;
}

export function ConnectedLongRestPlayerControls() {
  const api=useSimpleVtt();
  const [busyTransactionId,setBusyTransactionId]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const prompts=api.snapshot?.connectedLongRest?.ownerPrompts??[];
  if(!prompts.length) return null;

  const respond=async(transactionId:string,accepted:boolean)=>{
    setBusyTransactionId(transactionId);setError(null);
    try{
      await mockAdapter.respondConnectedLongRest(transactionId,accepted);
      await api.refresh();
    }catch(reason){
      setError(reason instanceof Error?reason.message:"장기 휴식 응답을 보내지 못했습니다.");
    }finally{
      setBusyTransactionId(null);
    }
  };

  return <section className="session-campaign-block" aria-labelledby="session-campaign-connected-long-rest">
    <header><div><span>REST REQUEST</span><h2 id="session-campaign-connected-long-rest">장기 휴식 요청</h2></div><strong>{prompts.length}건</strong></header>
    <p className="session-campaign-muted">DM이 제안한 정확한 회복 결과와 캠페인 옵션을 확인한 뒤 결정합니다. 응답한 결정은 이 transaction에서 변경할 수 없습니다.</p>
    {error&&<p className="session-campaign-warning" role="alert">{error}</p>}
    <div className="session-campaign-xp-list">
      {prompts.map((prompt)=><div className="session-campaign-xp-member" key={prompt.offer.transactionId} data-ready={prompt.phase==="complete"}>
        <span>
          <strong>HP {prompt.hp.before} → {prompt.hp.after} · 임시 HP {prompt.tempHp.before} → {prompt.tempHp.after}</strong>
          <small>{optionSummary(prompt.offer.options.advanceMinutes,prompt.offer.options.consumeRations)}</small>
          {prompt.error&&<small>{prompt.error}</small>}
        </span>
        <b>{phaseLabel(prompt.phase)}</b>
        {prompt.phase==="offered"&&<>
          <button type="button" disabled={Boolean(busyTransactionId)} onClick={()=>void respond(prompt.offer.transactionId,false)}>거절</button>
          <button type="button" className="primary" disabled={Boolean(busyTransactionId)} onClick={()=>void respond(prompt.offer.transactionId,true)}>승인</button>
        </>}
      </div>)}
    </div>
  </section>;
}
