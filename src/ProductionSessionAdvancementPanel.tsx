import { useEffect, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";

type AdvancementKind="xp"|"level-up-credit";

export function ProductionSessionAdvancementPanel(){
  const {snapshot,grantCampaignAdvancement}=useSimpleVtt();
  const [selectedIds,setSelectedIds]=useState<string[]>([]);
  const [kind,setKind]=useState<AdvancementKind>("xp");
  const [xpAmount,setXpAmount]=useState("100");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const activeCampaign=(snapshot?.campaigns??[]).find((campaign)=>campaign.campaignId===snapshot?.activeCampaignId)??null;
  const projection=snapshot?.campaignSessionSystems;
  const members=(projection?.roster??[]).filter((member)=>member.active&&Boolean(member.characterId));
  const validSelectedIds=selectedIds.filter((id)=>members.some((member)=>member.rosterMemberId===id));

  useEffect(()=>{
    setSelectedIds((current)=>current.filter((id)=>members.some((member)=>member.rosterMemberId===id)));
  },[projection?.campaignRevision]);

  if(!snapshot||snapshot.session.role!=="host"||snapshot.session.lifecycle!=="live"||!activeCampaign||projection?.campaignId!==activeCampaign.campaignId)return null;

  const toggle=(rosterMemberId:string)=>setSelectedIds((current)=>current.includes(rosterMemberId)?current.filter((id)=>id!==rosterMemberId):[...current,rosterMemberId]);
  const grant=async()=>{
    const amount=kind==="level-up-credit"?1:Number(xpAmount);
    if(!validSelectedIds.length){setError("지급할 Character를 선택하세요.");return;}
    if(!Number.isInteger(amount)||amount<1){setError("XP는 1 이상의 정수여야 합니다.");return;}
    setBusy(true);setError(null);
    try{
      await grantCampaignAdvancement(activeCampaign.campaignId,{rosterMemberIds:validSelectedIds,kind,amount});
    }catch(reason){
      setError(reason instanceof Error?reason.message:"진행도 지급에 실패했습니다.");
    }finally{
      setBusy(false);
    }
  };

  return <article className="production-session-card" aria-label="진행도 지급">
    <div className="production-session-section-head"><div><span className="eyebrow accent">ADVANCEMENT</span><h2>XP · 레벨업</h2></div></div>
    {!members.length?<p className="production-session-empty">현재 Campaign에 연결된 Character가 없습니다.</p>:<>
      <div className="production-session-roster">
        {members.map((member)=><label key={member.rosterMemberId} className="production-session-roster-row">
          <span><input type="checkbox" checked={validSelectedIds.includes(member.rosterMemberId)} onChange={()=>toggle(member.rosterMemberId)}/><strong>{member.label}</strong></span>
          <span>Lv {member.level??"?"} · XP {member.advancement.xp} · 크레딧 {member.advancement.levelUpCredits}</span>
        </label>)}
      </div>
      <label className="field"><span>지급 종류</span><select value={kind} onChange={(event)=>setKind(event.target.value as AdvancementKind)}><option value="xp">XP</option><option value="level-up-credit">레벨업 크레딧</option></select></label>
      {kind==="xp"&&<label className="field"><span>XP</span><input type="number" min={1} step={1} value={xpAmount} onChange={(event)=>setXpAmount(event.target.value)}/></label>}
      {error&&<div className="production-session-alert error" role="alert">{error}</div>}
      <button type="button" className="primary" disabled={busy||!validSelectedIds.length} onClick={()=>void grant()}>{busy?"지급 중…":kind==="xp"?"XP 지급":"레벨업 크레딧 1 지급"}</button>
    </>}
  </article>;
}
