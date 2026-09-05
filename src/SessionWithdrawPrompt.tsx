import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import "./app/movementDeclarationRuntimeAdapter";
import "./session-withdraw-prompt.css";

/** T1-05: the one question 물러남 can raise — which engaged enemy takes the opportunity attack, if any. */
export function SessionWithdrawPrompt({ role }:{ role:"player"|"dm" }) {
  const { snapshot, refresh }=useSimpleVtt();
  const [pending,setPending]=useState<string|null>(null);
  const prompt=snapshot?.scene.pendingWithdrawal;
  if (!snapshot || !prompt) return null;
  const answer=async(reactorId:string|null)=>{
    if (pending) return;
    setPending(reactorId ?? "none");
    try { await mockAdapter.answerWithdrawalPrompt(reactorId); await refresh(); } finally { setPending(null); }
  };
  if (role!=="dm") {
    return <aside className="session-withdraw-prompt waiting" role="status" aria-label="물러남 확인 대기">
      <strong>{prompt.actorName} 물러남</strong><span>DM이 기회공격 여부를 정하는 중…</span>
    </aside>;
  }
  return <aside className="session-withdraw-prompt" role="dialog" aria-label="기회공격 확인">
    <div className="session-withdraw-prompt-head"><span>물러남</span><strong>{prompt.actorName}이(가) 물러납니다. 기회공격?</strong></div>
    <div className="session-withdraw-prompt-options">
      {prompt.candidates.map((candidate)=><button type="button" key={candidate.reactorId} className="primary" disabled={Boolean(pending)} onClick={()=>void answer(candidate.reactorId)}>
        <strong>{candidate.reactorName}</strong><small>{candidate.actionName} · 반응 사용</small>{pending===candidate.reactorId&&<em>…</em>}
      </button>)}
      <button type="button" disabled={Boolean(pending)} onClick={()=>void answer(null)}><strong>없음</strong><small>그냥 물러납니다</small></button>
    </div>
  </aside>;
}
