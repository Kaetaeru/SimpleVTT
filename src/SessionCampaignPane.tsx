import { useEffect, useState } from "react";
import { formatCampaignCalendarDateTime, GREGORIAN_CALENDAR_MONTHS } from "./app/campaignCalendar";
import { useSimpleVtt } from "./app/AppProvider";
import "./session-campaign-pane.css";

export function SessionCampaignPane({role,onClose}:{role:"dm"|"player";onClose():void}){
  const api=useSimpleVtt();
  const projection=api.snapshot?.campaignSessionSystems??null;
  const anchor=projection?.calendar.displayAnchor;
  const [era,setEra]=useState(anchor?.era??"서력");
  const [year,setYear]=useState(String(anchor?.year??1));
  const [month,setMonth]=useState(anchor?.monthId??"1");
  const [day,setDay]=useState(String(anchor?.day??1));
  const [hour,setHour]=useState(String(anchor?.hour??0));
  const [minute,setMinute]=useState(String(anchor?.minute??0));
  const [note,setNote]=useState(projection?.calendar.currentNote??"");
  const [rationAdjustment,setRationAdjustment]=useState("1");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{if(!anchor)return;setEra(anchor.era??"서력");setYear(String(anchor.year??1));setMonth(anchor.monthId??"1");setDay(String(anchor.day??1));setHour(String(anchor.hour??0));setMinute(String(anchor.minute??0));},[projection?.campaignId,projection?.calendar.providerId,projection?.calendar.absoluteMinute]);
  const perform=async(operation:()=>Promise<void>)=>{setBusy(true);setError(null);try{await operation();}catch(reason){setError(reason instanceof Error?reason.message:"작업을 완료하지 못했습니다.");}finally{setBusy(false);}};

  return <aside className="session-utility-pane session-campaign-pane" aria-label="세션 캠페인 현황">
    <header className="session-utility-pane-head"><div><strong>캠페인 현황</strong><small>{projection?.campaignName??"연결된 캠페인 없음"} · {role==="dm"?"DM 조작":"Player 읽기 전용"}</small></div><button type="button" autoFocus aria-label="캠페인 현황 닫기" onClick={onClose}>×</button></header>
    {!projection?<div className="session-campaign-empty"><strong>세션 캠페인이 없습니다.</strong><p>DM이 캠페인에서 세션을 시작하면 달력과 식량 현황이 여기에 표시됩니다.</p></div>:<div className="session-campaign-scroll">
      {error&&<div className="session-campaign-error" role="alert">{error}</div>}
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
      </section>
      <section className="session-campaign-block" aria-labelledby="session-campaign-calendar">
        <header><div><span>WORLD TIME</span><h2 id="session-campaign-calendar">달력</h2></div>{projection.calendar.enabled&&<strong>{formatCampaignCalendarDateTime(projection.calendar.providerId,projection.calendar.displayAnchor)}</strong>}</header>
        {!projection.calendar.enabled?<p className="session-campaign-muted">이번 세션에서는 달력을 사용하지 않습니다. 저장된 Campaign 시간은 유지됩니다.</p>:<>
          <div className="session-campaign-date"><span>{projection.calendar.displayAnchor.era??"—"}</span><strong>{projection.calendar.providerId==="builtin.gregorian"?`${projection.calendar.displayAnchor.year}년 ${projection.calendar.displayAnchor.monthLabel} ${projection.calendar.displayAnchor.day}일`:`Day ${projection.calendar.displayAnchor.day}`}</strong><em>{String(projection.calendar.displayAnchor.hour??0).padStart(2,"0")}:{String(projection.calendar.displayAnchor.minute??0).padStart(2,"0")}</em></div>
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
