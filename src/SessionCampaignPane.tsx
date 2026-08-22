import { useEffect, useState } from "react";
import { campaignXpThresholdForLevel } from "./app/campaignApplicationService";
import { campaignDayPeriod, formatCampaignCalendarDateTime, GREGORIAN_CALENDAR_MONTHS } from "./app/campaignCalendar";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import { performProductionLongRest, previewProductionLongRest, type ProductionLongRestPreview } from "./app/longRestCompoundRuntimeAdapter";
import { ConnectedLongRestDmControls, ConnectedLongRestPlayerControls } from "./ConnectedLongRestCampaignControls";
import "./session-campaign-pane.css";

function xpProgress(level:number|undefined,xp:number){
  const currentLevel=Math.max(1,Math.min(20,level??1));
  const next=currentLevel<20?campaignXpThresholdForLevel(currentLevel+1):undefined;
  return {currentLevel,next,ready:next!==undefined&&xp>=next,remaining:next===undefined?0:Math.max(0,next-xp)};
}

export function SessionCampaignPane({role,onClose,onOpenLevelUp}:{role:"dm"|"player";onClose():void;onOpenLevelUp?(rosterMemberId:string):void}){
  const api=useSimpleVtt();
  const projection=api.snapshot?.campaignSessionSystems??null;
  const anchor=projection?.calendar.displayAnchor;
  const dayPeriod=projection?.calendar.enabled&&anchor?campaignDayPeriod(anchor.hour??0):null;
  const [era,setEra]=useState(anchor?.era??"서력");
  const [year,setYear]=useState(String(anchor?.year??1));
  const [month,setMonth]=useState(anchor?.monthId??"1");
  const [day,setDay]=useState(String(anchor?.day??1));
  const [hour,setHour]=useState(String(anchor?.hour??0));
  const [minute,setMinute]=useState(String(anchor?.minute??0));
  const [note,setNote]=useState(projection?.calendar.currentNote??"");
  const [rationAdjustment,setRationAdjustment]=useState("1");
  const [xpAmount,setXpAmount]=useState("100");
  const [selectedRosterIds,setSelectedRosterIds]=useState<string[]>([]);
  const [restAdvanceTime,setRestAdvanceTime]=useState(false);
  const [restConsumeRations,setRestConsumeRations]=useState(false);
  const [restPreview,setRestPreview]=useState<ProductionLongRestPreview|null>(null);
  const [restPreviewError,setRestPreviewError]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [feedback,setFeedback]=useState<string|null>(null);
  useEffect(()=>{if(!anchor)return;setEra(anchor.era??"서력");setYear(String(anchor.year??1));setMonth(anchor.monthId??"1");setDay(String(anchor.day??1));setHour(String(anchor.hour??0));setMinute(String(anchor.minute??0));},[projection?.campaignId,projection?.calendar.providerId,projection?.calendar.absoluteMinute]);
  useEffect(()=>{setSelectedRosterIds(projection?.roster.filter((member)=>member.active).map((member)=>member.rosterMemberId)??[]);setRestAdvanceTime(false);setRestConsumeRations(false);},[projection?.campaignId]);
  useEffect(()=>{if(!projection)return;setSelectedRosterIds((current)=>current.filter((id)=>projection.roster.some((member)=>member.rosterMemberId===id)));if(!projection.calendar.enabled)setRestAdvanceTime(false);if(!projection.rations.enabled)setRestConsumeRations(false);},[projection?.campaignRevision]);
  useEffect(()=>{
    if(role!=="dm"||!projection||!api.snapshot?.activeCharacter){setRestPreview(null);setRestPreviewError(null);return;}
    let cancelled=false;
    setRestPreview(null);setRestPreviewError(null);
    void previewProductionLongRest(mockAdapter,{
      advanceMinutes:restAdvanceTime?480:undefined,
      consumeRations:restConsumeRations,
      note:"장기 휴식",
    }).then((preview)=>{if(!cancelled)setRestPreview(preview);}).catch((reason)=>{if(!cancelled)setRestPreviewError(reason instanceof Error?reason.message:"장기 휴식 미리보기를 계산하지 못했습니다.");});
    return ()=>{cancelled=true;};
  },[role,projection?.campaignId,projection?.campaignRevision,restAdvanceTime,restConsumeRations,api.snapshot?.activeCharacter.id,api.snapshot?.activeCharacter.hp,api.snapshot?.activeCharacter.tempHp,api.snapshot?.activeCharacter.maxHp]);
  const perform=async(operation:()=>Promise<void>,success?:string)=>{setBusy(true);setError(null);setFeedback(null);try{await operation();if(success)setFeedback(success);}catch(reason){setError(reason instanceof Error?reason.message:"작업을 완료하지 못했습니다.");}finally{setBusy(false);}};
  const performLongRest=async()=>{
    setBusy(true);setError(null);setFeedback(null);
    try{
      const result=await performProductionLongRest(mockAdapter,{
        advanceMinutes:restAdvanceTime?480:undefined,
        consumeRations:restConsumeRations,
        note:"장기 휴식",
      });
      const applied=[result.applied.calendar?"시간 +8시간":null,result.applied.rations?"식량 소비":null].filter(Boolean).join(" · ");
      const warning=result.warnings.length?` · ${result.warnings.join(" ")}`:"";
      setFeedback(`장기 휴식을 적용했습니다${applied?` · ${applied}`:""}${warning}`);
    }catch(reason){
      setError(reason instanceof Error?reason.message:"장기 휴식을 완료하지 못했습니다.");
    }finally{setBusy(false);}
  };
  const restPreviewCampaign=restPreview?.campaignDocument.campaigns.find((campaign)=>campaign.campaignId===projection?.campaignId);

  return <aside className="session-utility-pane session-campaign-pane" aria-label="세션 캠페인 현황">
    <header className="session-utility-pane-head"><div><strong>캠페인 현황</strong><small>{projection?.campaignName??"연결된 캠페인 없음"} · {role==="dm"?"DM 조작":"Player 읽기 전용"}</small></div><button type="button" autoFocus aria-label="캠페인 현황 닫기" onClick={onClose}>×</button></header>
    {!projection?<div className="session-campaign-empty"><strong>세션 캠페인이 없습니다.</strong><p>DM이 캠페인에서 세션을 시작하면 달력과 식량 현황이 여기에 표시됩니다.</p></div>:<div className="session-campaign-scroll">
      {error&&<div className="session-campaign-error" role="alert">{error}</div>}
      {feedback&&<div className="session-campaign-feedback" role="status">{feedback}</div>}
      <section className="session-campaign-block" aria-labelledby="session-campaign-roster">
        <header><div><span>PARTY</span><h2 id="session-campaign-roster">파티 명단</h2></div><strong>{projection.roster.filter((member)=>member.active).length}명 활성</strong></header>
        {!projection.roster.length?<p className="session-campaign-muted">Campaign 파티에 등록된 구성원이 없습니다.</p>:<div className="session-campaign-roster">
          {projection.roster.map((member)=><article key={member.rosterMemberId} className={member.active?"":"inactive"}>
            <span className="session-campaign-avatar">{member.label.trim().slice(0,1)||"?"}</span>
            <div><strong>{member.label}</strong><small>{member.kind==="player-character-ref"?"Player Character 참조":member.kind==="host-preset"?"Host 프리셋":"동료"}</small></div>
            <span className={`session-campaign-connection ${member.connectionState??"saved"}`}>{member.connectionState==="connected"?"접속 중":member.connectionState==="reconnecting"?"재연결":member.connectionState==="disconnected"?"연결 끊김":"저장됨"}</span>
            {role==="dm"&&<small className="session-campaign-roster-policy">{member.countsForRations?`식량 ${member.rationUnitsPerDay??1}/일`:"식량 계산 제외"} · 보관함 {member.stashPermission==="manage"?"관리":member.stashPermission==="request"?"요청":member.stashPermission==="view"?"보기":"없음"}</small>}
          </article>)}
        </div>}
        {projection.roster.length>0&&<section className="session-campaign-advancement" aria-label="파티 경험치">
          <header><div><span>ADVANCEMENT</span><h3>경험치 · 레벨업</h3></div>{role==="dm"&&<button type="button" onClick={()=>setSelectedRosterIds(selectedRosterIds.length===projection.roster.length?[]:projection.roster.map((member)=>member.rosterMemberId))}>{selectedRosterIds.length===projection.roster.length?"선택 해제":"전체 선택"}</button>}</header>
          <div className="session-campaign-xp-list">
            {projection.roster.map((member)=>{
              const advancement=member.advancement??{xp:0,levelUpCredits:0};
              const progress=xpProgress(member.level,advancement.xp);
              const ready=advancement.levelUpCredits>0||progress.ready;
              const canOpenLevelUp=ready&&member.characterId===api.snapshot?.activeCharacter.id&&Boolean(onOpenLevelUp);
              return <div className="session-campaign-xp-member" key={member.rosterMemberId} data-ready={ready}>
                {role==="dm"&&<input type="checkbox" aria-label={member.label+" 경험치 지급 대상"} checked={selectedRosterIds.includes(member.rosterMemberId)} onChange={(event)=>setSelectedRosterIds((current)=>event.target.checked?[...current,member.rosterMemberId]:current.filter((id)=>id!==member.rosterMemberId))}/>}
                <span><strong>{member.label}</strong><small>{"Lv."+progress.currentLevel+" · "+advancement.xp.toLocaleString()+" XP"+(progress.next!==undefined?" / "+progress.next.toLocaleString():"")}</small></span>
                <b>{advancement.levelUpCredits>0?"레벨업 가능 ×"+advancement.levelUpCredits:progress.ready?"XP 달성":"다음까지 "+progress.remaining.toLocaleString()}</b>
                {canOpenLevelUp&&<button type="button" className="session-campaign-levelup-open" onClick={()=>onOpenLevelUp?.(member.rosterMemberId)}>세션에서 레벨업</button>}
              </div>;
            })}
          </div>
          {role==="dm"&&<div className="session-campaign-xp-actions">
            <label className="session-campaign-xp-entry"><span>지급할 XP</span><div><input aria-label="지급할 경험치" type="number" min={1} step={1} inputMode="numeric" value={xpAmount} onChange={(event)=>setXpAmount(event.target.value)} placeholder="예: 300"/><em>XP</em></div></label>
            <div className="session-campaign-xp-presets" aria-label="경험치 빠른 입력">{[50,100,250,500].map((value)=><button type="button" key={value} onClick={()=>setXpAmount(String(value))}>+{value}</button>)}</div>
            <div className="session-campaign-xp-commit">
              <button type="button" disabled={busy||!selectedRosterIds.length||!Number.isInteger(Number(xpAmount))||Number(xpAmount)<=0} onClick={()=>void perform(()=>api.grantCampaignAdvancement(projection.campaignId,{rosterMemberIds:selectedRosterIds,kind:"xp",amount:Number(xpAmount),levels:Object.fromEntries(projection.roster.map((member)=>[member.rosterMemberId,member.level??1]))}),selectedRosterIds.length+"명에게 "+Number(xpAmount).toLocaleString()+" XP를 지급했습니다.")}>선택 캐릭터에 XP 지급</button>
              <button type="button" className="primary" disabled={busy||!selectedRosterIds.length} onClick={()=>void perform(()=>api.grantCampaignAdvancement(projection.campaignId,{rosterMemberIds:selectedRosterIds,kind:"level-up-credit",amount:1}),selectedRosterIds.length+"명에게 레벨업 권한을 부여했습니다.")}>바로 레벨업 가능</button>
            </div>
          </div>}
        </section>}
      </section>

      {role==="dm"&&<section className="session-campaign-block" aria-labelledby="session-campaign-long-rest">
        <header><div><span>REST</span><h2 id="session-campaign-long-rest">장기 휴식</h2></div><strong>{api.snapshot?.activeCharacter.name??"활성 캐릭터"}</strong></header>
        <p className="session-campaign-muted">활성 캐릭터의 장기 휴식 회복을 적용합니다. 캠페인 시간과 식량은 아래에서 선택한 경우에만 같은 transaction에 포함됩니다.</p>
        {restPreview?.character&&restPreviewCampaign?<p className="session-campaign-note">미리보기 · HP {api.snapshot?.activeCharacter.hp??0} → {restPreview.character.sheet.hp} · 임시 HP {api.snapshot?.activeCharacter.tempHp??0} → {restPreview.character.sheet.tempHp}{restPreview.applied.calendar?` · 시간 → ${formatCampaignCalendarDateTime(restPreviewCampaign.calendar.state.providerId,restPreviewCampaign.calendar.state.displayAnchor)}`:""}{restPreview.applied.rations?` · 식량 ${projection.rations.balance??0} → ${restPreviewCampaign.rations.ledger.balances.ration}`:""}</p>:restPreviewError?<p className="session-campaign-warning">{restPreviewError}</p>:<p className="session-campaign-muted">휴식 결과 미리보기를 계산하고 있습니다.</p>}
        {restPreview&&restPreview.warnings.length>0&&<p className="session-campaign-warning">{restPreview.warnings.join(" ")}</p>}
        <div className="session-campaign-editor">
          <div>
            <label><span>캠페인 시간 +8시간</span><input aria-label="장기 휴식과 함께 캠페인 시간 8시간 진행" type="checkbox" checked={restAdvanceTime} disabled={busy||!projection.calendar.enabled} onChange={(event)=>setRestAdvanceTime(event.target.checked)}/></label>
            <label><span>하루치 식량 소비</span><input aria-label="장기 휴식과 함께 하루치 식량 소비" type="checkbox" checked={restConsumeRations} disabled={busy||!projection.rations.enabled} onChange={(event)=>setRestConsumeRations(event.target.checked)}/></label>
            <button type="button" className="primary" disabled={busy||(api.snapshot?.activeCharacter.hp??0)<=0||Boolean(restPreviewError)} onClick={()=>void performLongRest()}>장기 휴식 적용</button>
          </div>
          <small>{!projection.calendar.enabled?"달력 OFF · 시간 진행 선택 불가":restAdvanceTime?"시간 진행 포함":"시간 진행 안 함"} · {!projection.rations.enabled?"식량 OFF · 소비 선택 불가":restConsumeRations?"식량 소비 포함":"식량 소비 안 함"}</small>
        </div>
        <ConnectedLongRestDmControls advanceTime={restAdvanceTime} consumeRations={restConsumeRations} disabled={busy}/>
      </section>}

      {role==="player"&&<ConnectedLongRestPlayerControls/>}

      <section className="session-campaign-block" aria-labelledby="session-campaign-calendar">
        <header><div><span>WORLD TIME</span><h2 id="session-campaign-calendar">달력</h2></div>{projection.calendar.enabled&&<strong>{formatCampaignCalendarDateTime(projection.calendar.providerId,projection.calendar.displayAnchor)}</strong>}</header>
        {!projection.calendar.enabled?<p className="session-campaign-muted">이번 세션에서는 달력을 사용하지 않습니다. 저장된 Campaign 시간은 유지됩니다.</p>:<>
          <div className="session-campaign-date"><span>{projection.calendar.displayAnchor.era??"—"}</span><strong>{projection.calendar.providerId==="builtin.gregorian"?`${projection.calendar.displayAnchor.year}년 ${projection.calendar.displayAnchor.monthLabel} ${projection.calendar.displayAnchor.day}일`:`Day ${projection.calendar.displayAnchor.day}`}</strong><em><small>{dayPeriod?.label}</small>{String(projection.calendar.displayAnchor.hour??0).padStart(2,"0")}:{String(projection.calendar.displayAnchor.minute??0).padStart(2,"0")}</em></div>
          {projection.calendar.currentNote&&<p className="session-campaign-note">{projection.calendar.currentNote}</p>}
          {role==="dm"&&<>
            <div className="session-campaign-actions"><button disabled={busy} onClick={()=>void perform(()=>api.advanceCampaignCalendar(projection.campaignId,{deltaMinutes:10,note:note||undefined}))}>+10분</button><button disabled={busy} onClick={()=>void perform(()=>api.advanceCampaignCalendar(projection.campaignId,{deltaMinutes:30,note:note||undefined}))}>+30분</button><button disabled={busy} onClick={()=>void perform(()=>api.advanceCampaignCalendar(projection.campaignId,{deltaMinutes:60,note:note||undefined}))}>+1시간</button><button disabled={busy} onClick={()=>void perform(()=>api.advanceCampaignCalendar(projection.campaignId,{deltaMinutes:360,note:note||undefined}))}>+6시간</button><button disabled={busy} onClick={()=>void perform(()=>api.advanceCampaignCalendar(projection.campaignId,{deltaMinutes:1440,note:note||undefined}))}>+1일</button></div>
            <label className="session-campaign-note-input"><span>시간 메모</span><input value={note} onChange={(event)=>setNote(event.target.value)} placeholder="여행, 휴식, 야영 등"/><button disabled={busy} onClick={()=>void perform(()=>api.setCampaignCalendarNote(projection.campaignId,note))}>저장</button></label>
            <details className="session-campaign-editor"><summary>날짜·시간 직접 설정</summary><div>
              <label><span>연호</span><input value={era} onChange={(event)=>setEra(event.target.value)}/></label>
              {projection.calendar.providerId==="builtin.gregorian"&&<><label><span>연도</span><input type="number" min={1} value={year} onChange={(event)=>setYear(event.target.value)}/></label><label><span>월</span><select value={month} onChange={(event)=>setMonth(event.target.value)}>{GREGORIAN_CALENDAR_MONTHS.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label></>}
              <label><span>일</span><input type="number" min={1} value={day} onChange={(event)=>setDay(event.target.value)}/></label><label><span>시</span><input type="number" min={0} max={23} value={hour} onChange={(event)=>setHour(event.target.value)}/></label><label><span>분</span><input type="number" min={0} max={59} value={minute} onChange={(event)=>setMinute(event.target.value)}/></label>
              <button disabled={busy||!note.trim()} onClick={()=>void perform(()=>api.correctCampaignCalendarDateTime(projection.campaignId,{dateTime:{era,year:Number(year),monthId:month,day:Number(day),hour:Number(hour),minute:Number(minute)},note}))}>적용</button>
            </div><small>직접 수정에는 위 시간 메모가 사유로 기록됩니다.</small></details>
            <button disabled={busy} onClick={()=>void perform(()=>api.undoCampaignCalendar(projection.campaignId))}>최근 시간 변경 되돌리기</button>
          </>}
        </>}
      </section>

      <section className="session-campaign-block" aria-labelledby="session-campaign-rations">
        <header><div><span>SUPPLIES</span><h2 id="session-campaign-rations">식량</h2></div>{projection.rations.enabled&&role==="dm"&&<strong>{projection.rations.balance??0}식</strong>}</header>
        {!projection.rations.enabled?<p className="session-campaign-muted">이번 세션에서는 식량 규칙을 사용하지 않습니다.</p>:role==="player"&&!projection.rations.visibleToPlayers?<p className="session-campaign-muted">식량 현황은 DM에게만 공개됩니다.</p>:<>
          <div className="session-campaign-ration-facts"><div><span>현재 잔량</span><strong>{projection.rations.balance??0}식</strong></div><div><span>하루 필요량</span><strong>{projection.rations.dailyRequired??0}식</strong></div><div><span>부족</span><strong>{projection.rations.shortage??0}식</strong></div></div>
          {(projection.rations.shortage??0)>0&&<p className="session-campaign-warning">식량이 {projection.rations.shortage}식 부족합니다. 피해나 소진은 자동 적용하지 않습니다.</p>}
          {role==="dm"&&<><div className="session-campaign-ration-actions"><input aria-label="세션 식량 조정 수량" type="number" step={1} value={rationAdjustment} onChange={(event)=>setRationAdjustment(event.target.value)}/><button disabled={busy||!Number(rationAdjustment)} onClick={()=>void perform(()=>api.adjustCampaignRations(projection.campaignId,{amount:Number(rationAdjustment),note:"세션 DM 조정"}))}>조정</button><button className="primary" disabled={busy||!(projection.rations.dailyRequired??0)} onClick={()=>void perform(()=>api.consumeCampaignDailyRations(projection.campaignId,{note:"세션 하루치 소비"}))}>하루치 소비</button></div><button disabled={busy} onClick={()=>void perform(()=>api.undoCampaignRationConsumption(projection.campaignId))}>최근 소비 되돌리기</button></>}
        </>}
      </section>
    </div>}
  </aside>;
}
