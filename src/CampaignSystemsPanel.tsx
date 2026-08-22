import { useMemo, useState } from "react";
import { previewCampaignDailyRations } from "./app/campaignApplicationService";
import type { CampaignRecordV1, CampaignRosterMember } from "./app/campaignPersistenceContracts";
import { useSimpleVtt } from "./app/AppProvider";

function rosterId(){return `roster.${globalThis.crypto?.randomUUID?.()??Date.now()}`;}
function timeLabel(absoluteMinute:number){const day=Math.floor(absoluteMinute/1440)+1;const minute=absoluteMinute%1440;return `Day ${day} · ${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`;}

export function CampaignSystemsPanel({campaign}:{campaign:CampaignRecordV1}){
  const api=useSimpleVtt();
  const [memberLabel,setMemberLabel]=useState("");
  const [memberKind,setMemberKind]=useState<CampaignRosterMember["kind"]>("player-character-ref");
  const [characterId,setCharacterId]=useState("");
  const [rationUnits,setRationUnits]=useState("1");
  const [calendarNote,setCalendarNote]=useState(campaign.calendar.state.currentNote??"");
  const [correctionMinute,setCorrectionMinute]=useState(String(campaign.calendar.state.absoluteMinute));
  const [rationAdjustment,setRationAdjustment]=useState("1");
  const [consumeWithDay,setConsumeWithDay]=useState(campaign.rations.capability.enabled);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const rationPreview=useMemo(()=>previewCampaignDailyRations(campaign),[campaign]);
  const perform=async(operation:()=>Promise<void>)=>{setBusy(true);setError(null);try{await operation();}catch(reason){setError(reason instanceof Error?reason.message:"작업을 완료하지 못했습니다.");}finally{setBusy(false);}};
  const updateMember=(member:CampaignRosterMember,patch:Partial<CampaignRosterMember>)=>perform(()=>api.upsertCampaignRosterMember(campaign.campaignId,{...member,...patch}));
  const addMember=()=>perform(async()=>{
    if(!memberLabel.trim()) throw new Error("구성원 이름을 입력하세요.");
    const units=Number(rationUnits);if(!Number.isInteger(units)||units<0) throw new Error("하루 식량은 0 이상의 정수여야 합니다.");
    if(memberKind==="player-character-ref"&&!characterId.trim()) throw new Error("Character 참조 ID를 입력하세요.");
    await api.upsertCampaignRosterMember(campaign.campaignId,{rosterMemberId:rosterId(),label:memberLabel.trim(),kind:memberKind,characterRef:memberKind==="player-character-ref"?{characterId:characterId.trim()}:undefined,active:true,countsForRations:true,rationUnitsPerDay:units,stashPermission:"request"});
    setMemberLabel("");setCharacterId("");setRationUnits("1");
  });

  return <div className="campaign-system-workspace">
    {error&&<div className="campaign-error" role="alert">{error}</div>}
    <section className="campaign-system-panel" aria-labelledby="campaign-roster-title">
      <header><div><span>ROSTER</span><h3 id="campaign-roster-title">파티 명단</h3></div><strong>{campaign.roster.filter((member)=>member.active).length}명 활성</strong></header>
      <p className="campaign-panel-copy">세션 참가자와 별개인 참조 명단입니다. Character 파일이나 소유권은 캠페인으로 복사하지 않습니다.</p>
      <div className="campaign-roster-list">
        {campaign.roster.map((member)=><article key={member.rosterMemberId}>
          <div><strong>{member.label}</strong><small>{member.kind}{member.characterRef?` · ${member.characterRef.characterId}`:""}</small></div>
          <label><input type="checkbox" checked={member.active} onChange={(event)=>void updateMember(member,{active:event.target.checked})}/> 활성</label>
          <label><input type="checkbox" checked={member.countsForRations} onChange={(event)=>void updateMember(member,{countsForRations:event.target.checked})}/> 식량 계산</label>
          <label className="compact-field"><span>하루</span><input aria-label={`${member.label} 하루 식량`} type="number" min={0} step={1} value={member.rationUnitsPerDay??1} onChange={(event)=>void updateMember(member,{rationUnitsPerDay:Number(event.target.value)})}/></label>
          <select aria-label={`${member.label} 보관함 권한`} value={member.stashPermission??"none"} onChange={(event)=>void updateMember(member,{stashPermission:event.target.value as CampaignRosterMember["stashPermission"]})}><option value="none">권한 없음</option><option value="view">조회</option><option value="request">요청</option><option value="manage">관리</option></select>
          <button className="danger-action" disabled={busy} onClick={()=>void perform(()=>api.removeCampaignRosterMember(campaign.campaignId,member.rosterMemberId))}>제거</button>
        </article>)}
        {!campaign.roster.length&&<p className="campaign-inline-empty">아직 파티 구성원이 없습니다.</p>}
      </div>
      <div className="campaign-roster-add">
        <label><span>이름</span><input value={memberLabel} onChange={(event)=>setMemberLabel(event.target.value)} placeholder="예: 리아"/></label>
        <label><span>종류</span><select value={memberKind} onChange={(event)=>setMemberKind(event.target.value as CampaignRosterMember["kind"])}><option value="player-character-ref">Player Character 참조</option><option value="host-preset">Host 프리셋</option><option value="companion">동료/탈것</option></select></label>
        {memberKind==="player-character-ref"&&<label><span>Character 참조 ID</span><input value={characterId} onChange={(event)=>setCharacterId(event.target.value)} placeholder="character.id"/></label>}
        <label><span>하루 식량</span><input type="number" min={0} step={1} value={rationUnits} onChange={(event)=>setRationUnits(event.target.value)}/></label>
        <button className="primary" disabled={busy||!memberLabel.trim()} onClick={()=>void addMember()}>명단에 추가</button>
      </div>
    </section>

    <div className="campaign-system-columns">
      <section className="campaign-system-panel" aria-labelledby="campaign-calendar-title">
        <header><div><span>WORLD TIME</span><h3 id="campaign-calendar-title">세션 달력</h3></div><strong>{timeLabel(campaign.calendar.state.absoluteMinute)}</strong></header>
        <div className="campaign-provider-row"><label><input type="checkbox" checked={campaign.calendar.capability.enabled} onChange={(event)=>void perform(()=>api.configureCampaignCalendar(campaign.campaignId,{enabled:event.target.checked,providerId:campaign.calendar.capability.providerId}))}/> 사용</label><select aria-label="달력 공급자" value={campaign.calendar.capability.providerId} onChange={(event)=>void perform(()=>api.configureCampaignCalendar(campaign.campaignId,{enabled:campaign.calendar.capability.enabled,providerId:event.target.value}))}><option value="builtin.simple-day">Simple Day</option><option value="builtin.gregorian">Gregorian</option><option value="module.calendar-profile" disabled>모듈 프로필 · 설치 필요</option></select></div>
        {!campaign.calendar.capability.enabled?<p className="campaign-off-note">달력이 꺼져 있습니다. 저장된 {campaign.calendar.state.absoluteMinute}분은 유지되며 세션·휴식·행동을 막지 않습니다.</p>:<>
          <div className="campaign-action-row"><button disabled={busy} onClick={()=>void perform(()=>api.advanceCampaignCalendar(campaign.campaignId,{deltaMinutes:10,note:calendarNote||undefined}))}>+10분</button><button disabled={busy} onClick={()=>void perform(()=>api.advanceCampaignCalendar(campaign.campaignId,{deltaMinutes:60,note:calendarNote||undefined}))}>+1시간</button><button disabled={busy} onClick={()=>void perform(()=>api.advanceCampaignCalendar(campaign.campaignId,{deltaMinutes:1440,note:calendarNote||undefined}))}>+1일</button></div>
          <label className="campaign-wide-field"><span>현재 메모</span><input value={calendarNote} onChange={(event)=>setCalendarNote(event.target.value)} placeholder="여행, 야영 등"/><button disabled={busy} onClick={()=>void perform(()=>api.setCampaignCalendarNote(campaign.campaignId,calendarNote))}>메모 저장</button></label>
          <div className="campaign-compound-action"><div><strong>다음 날로 진행</strong><small>시간과 선택한 식량 소비를 하나의 저장으로 처리합니다.</small></div><label><input type="checkbox" checked={consumeWithDay&&campaign.rations.capability.enabled} disabled={!campaign.rations.capability.enabled} onChange={(event)=>setConsumeWithDay(event.target.checked)}/> 식량 {rationPreview.requiredUnits}식 함께 소비</label><button className="primary" disabled={busy} onClick={()=>void perform(()=>api.advanceCampaignDay(campaign.campaignId,{consumeRations:consumeWithDay&&campaign.rations.capability.enabled,note:calendarNote||undefined}))}>미리보기대로 적용</button></div>
          <details><summary>DM 시간 수정</summary><div className="campaign-correction-row"><label><span>절대 시간(분)</span><input type="number" min={0} step={1} value={correctionMinute} onChange={(event)=>setCorrectionMinute(event.target.value)}/></label><label><span>수정 사유</span><input value={calendarNote} onChange={(event)=>setCalendarNote(event.target.value)} placeholder="필수"/></label><button disabled={busy||!calendarNote.trim()} onClick={()=>void perform(()=>api.correctCampaignCalendar(campaign.campaignId,{absoluteMinute:Number(correctionMinute),note:calendarNote}))}>수정 적용</button></div></details>
          <button disabled={busy||!campaign.calendar.state.history.length} onClick={()=>void perform(()=>api.undoCampaignCalendar(campaign.campaignId))}>최근 시간 변경 되돌리기</button>
        </>}
      </section>

      <section className="campaign-system-panel" aria-labelledby="campaign-rations-title">
        <header><div><span>SUPPLIES</span><h3 id="campaign-rations-title">식량</h3></div><strong>{campaign.rations.ledger.balances.ration}식</strong></header>
        <div className="campaign-provider-row"><label><input type="checkbox" checked={campaign.rations.capability.enabled} onChange={(event)=>void perform(()=>api.configureCampaignRations(campaign.campaignId,{enabled:event.target.checked,providerId:campaign.rations.capability.providerId}))}/> 사용</label><select aria-label="식량 공급자" value={campaign.rations.capability.providerId} onChange={(event)=>void perform(()=>api.configureCampaignRations(campaign.campaignId,{enabled:campaign.rations.capability.enabled,providerId:event.target.value}))}><option value="builtin.tracking-only">Tracking only</option><option value="module.ration-profile" disabled>모듈 프로필 · 설치 필요</option></select></div>
        {!campaign.rations.capability.enabled?<p className="campaign-off-note">식량 규칙이 꺼져 있습니다. 잔량과 기록은 유지되며 아무 행동도 차단하지 않습니다.</p>:<>
          <div className="campaign-ration-preview"><div><span>활성 소비자</span><strong>{rationPreview.memberCount}명</strong></div><div><span>하루 필요량</span><strong>{rationPreview.requiredUnits}식</strong></div><div><span>소비 후</span><strong>{rationPreview.availableUnits-rationPreview.consumedUnits}식</strong></div></div>
          {rationPreview.shortageUnits>0&&<p className="campaign-shortage" role="status">식량이 {rationPreview.shortageUnits}식 부족합니다. 경고만 기록하며 피해나 소진을 자동 적용하지 않습니다.</p>}
          <div className="campaign-adjust-row"><input aria-label="식량 조정 수량" type="number" step={1} value={rationAdjustment} onChange={(event)=>setRationAdjustment(event.target.value)}/><button disabled={busy||Number(rationAdjustment)===0} onClick={()=>void perform(()=>api.adjustCampaignRations(campaign.campaignId,{amount:Number(rationAdjustment),note:"DM 수동 조정"}))}>식량 조정</button><button className="primary" disabled={busy||rationPreview.requiredUnits===0} onClick={()=>void perform(()=>api.consumeCampaignDailyRations(campaign.campaignId))}>하루치 소비</button></div>
          <button disabled={busy||!campaign.rations.ledger.consumptionHistory.some((entry)=>entry.kind==="consume")} onClick={()=>void perform(()=>api.undoCampaignRationConsumption(campaign.campaignId))}>최근 소비 되돌리기</button>
        </>}
      </section>
    </div>

    <section className="campaign-system-panel" aria-labelledby="campaign-history-title">
      <header><div><span>JOURNAL</span><h3 id="campaign-history-title">세션 기록</h3></div><strong>최근 {campaign.sessionHistory.length}회</strong></header>
      {!campaign.sessionHistory.length?<p className="campaign-inline-empty">종료된 세션 요약이 아직 없습니다.</p>:<div className="campaign-history-list">{[...campaign.sessionHistory].reverse().map((summary)=><article key={summary.sessionId}><div><strong>{summary.title??summary.name??"이름 없는 세션"}</strong><small>{(summary.participantLabels??[]).join(" · ")||`${summary.participantCount??0}명`}</small></div><span>{summary.calendarBefore&&summary.calendarAfter?`${summary.calendarBefore} → ${summary.calendarAfter}`:"달력 기록 없음"}</span><span>{summary.rationDelta!==undefined?`식량 ${summary.rationDelta>0?"+":""}${summary.rationDelta}`:"식량 기록 없음"}</span>{(summary.dmNote??summary.summary)&&<p>{summary.dmNote??summary.summary}</p>}</article>)}</div>}
    </section>
  </div>;
}
