import { useEffect, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import { campaignHydrationIssue, subscribeCampaignHydrationIssue, type CampaignHydrationIssue } from "./app/campaignHydrationIssueAdapter";

export function CampaignStartupRecoveryBridge(){
  const {refresh}=useSimpleVtt();
  const [issue,setIssue]=useState<CampaignHydrationIssue|null>(()=>campaignHydrationIssue());
  const [retrying,setRetrying]=useState(false);

  useEffect(()=>subscribeCampaignHydrationIssue(setIssue),[]);

  if(!issue) return null;

  const retry=async()=>{
    setRetrying(true);
    try{await refresh();}catch{/* guard keeps the explicit Campaign issue visible */}finally{setRetrying(false);}
  };

  return <div className="loading-screen campaign-startup-recovery" role="alertdialog" aria-modal="true" aria-label="캠페인 저장소 오류">
    <section className="campaign-empty">
      <span>CAMPAIGN STORAGE</span>
      <h2>캠페인 데이터를 열 수 없습니다.</h2>
      <p><strong>{issue.title}</strong></p>
      <p>{issue.message}</p>
      <button className="primary" disabled={retrying} onClick={()=>void retry()}>{retrying?"다시 확인하는 중…":"다시 시도"}</button>
    </section>
  </div>;
}
