import { useEffect, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import "./app/connectedPartyStashApprovalRuntimeAdapter";
import { mockAdapter } from "./app/mockAdapter";
import type { PartyStashApprovalOutcomeNotice } from "./app/connectedPartyStashApprovalRuntimeAdapter";
import "./party-stash-approval-outcome.css";

export function PartyStashApprovalOutcomeBridge(){
  const {snapshot}=useSimpleVtt();
  const [notice,setNotice]=useState<PartyStashApprovalOutcomeNotice|null>(null);

  useEffect(()=>{
    if(!snapshot||snapshot.session.role!=="client"){
      setNotice(null);
      return;
    }
    const next=mockAdapter.takeLatestPartyStashApprovalOutcome();
    if(next)setNotice(next);
  },[snapshot]);

  if(!snapshot||snapshot.session.role!=="client"||!notice)return null;
  const tone=notice.status==="committed"?"success":notice.status==="rejected"?"error":"warning";
  const title=notice.status==="committed"?"보관함 출고 승인":notice.status==="rejected"?"보관함 출고 거절":"보관함 출고 취소";
  return <div className={`party-stash-approval-outcome ${tone}`} role="status" aria-live="polite">
    <div><strong>{title}</strong><span>{notice.message}</span></div>
    <button type="button" onClick={()=>setNotice(null)} aria-label="Party Stash 승인 결과 닫기">확인</button>
  </div>;
}
