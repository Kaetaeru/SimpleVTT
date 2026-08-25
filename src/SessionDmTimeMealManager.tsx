import { useEffect, useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import { campaignDayPeriod, formatCampaignCalendarDateTime, gregorianMonthDays } from "./app/campaignCalendar";
import type { CampaignCalendarDateTime, CampaignMealCommand, CampaignSupplyTransactionSummary } from "./app/campaignPersistenceContracts";
import "./session-dm-time-meal.css";

const MEALS_PER_DAY=2;
const sourceCopy:Record<NonNullable<CampaignSupplyTransactionSummary["mealSource"]>,string>={tavern:"식당 식사",camp:"캠프 식사",ration:"일일 식량 사용",manual:"DM 직접 체크"};
const pad=(value:number)=>String(value).padStart(2,"0");

export function SessionDmTimeMealManager({onClose}:{onClose():void}){
  const api=useSimpleVtt();
  const projection=api.snapshot?.campaignSessionSystems;
  const [selected,setSelected]=useState<string[]>([]);
  const [costSp,setCostSp]=useState(5);
  const [dateOpen,setDateOpen]=useState(false);
  const [shortageOpen,setShortageOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [penalties,setPenalties]=useState<Record<string,string>>({});
  const roster=useMemo(()=>projection?.roster.filter((member)=>member.active&&member.countsForRations&&member.presentInSession!==false)??[],[projection]);
  const rations=projection?.rations;
  const calendar=projection?.calendar;
  const anchor=calendar?.displayAnchor;

  useEffect(()=>setSelected((current)=>{
    const eligible=new Set(roster.map((member)=>member.rosterMemberId));
    const kept=current.filter((id)=>eligible.has(id));
    return kept.length?kept:roster.map((member)=>member.rosterMemberId);
  }),[roster.map((member)=>member.rosterMemberId).join("|")]);

  if(!projection||!calendar||!anchor)return <div className="session-dm-time-meal-shell"><section className="session-dm-time-meal empty"><button onClick={onClose}>×</button><p>연결된 캠페인 시간 정보를 찾지 못했습니다.</p></section></div>;

  const mealsByMember=rations?.mealsByRosterMember??{};
  const deficient=roster.filter((member)=>(mealsByMember[member.rosterMemberId]??0)<MEALS_PER_DAY);
  const mealTotal=rations?.mealsRequired??roster.length*MEALS_PER_DAY;
  const mealSatisfied=rations?.mealsSatisfied??0;
  const mealShortage=Math.max(0,mealTotal-mealSatisfied);
  const currentPeriod=campaignDayPeriod(anchor.hour??0);
  const run=async(operation:()=>Promise<void>)=>{setBusy(true);setError(null);try{await operation();}catch(reason){setError(reason instanceof Error?reason.message:"요청을 처리하지 못했습니다.");}finally{setBusy(false);}};
  const serve=(input:Omit<CampaignMealCommand,"rosterMemberIds">)=>run(()=>api.serveCampaignMeals(projection.campaignId,{...input,rosterMemberIds:selected}));
  const requestNextDay=()=>{if(deficient.length){setPenalties(Object.fromEntries(deficient.map((member)=>[member.rosterMemberId,"none"])));setShortageOpen(true);return;}void advanceDay();};
  const advanceDay=()=>run(()=>api.advanceCampaignDay(projection.campaignId,{consumeRations:false,note:deficient.length?`식사 부족 진행 · ${deficient.map((member)=>`${member.label}:${penalties[member.rosterMemberId]??"none"}`).join(", ")}`:"식사 완료 후 다음 날 진행"})).then(()=>setShortageOpen(false));
  const nextAnchor={...anchor,day:(anchor.day??1)+1};
  const recent=(rations?.recentTransactions??[]).slice().reverse();

  return <div className="session-dm-time-meal-shell" role="dialog" aria-modal="true" aria-label="DM 시간 식사 관리">
    <section className="session-dm-time-meal">
      <header><div className="session-dm-time-meal-title"><span aria-hidden="true">🍴</span><h2>시간 · 식사 관리</h2><b>DM 전용</b><button type="button" className="help" title="시간과 식사 관리는 DM만 변경할 수 있습니다.">?</button></div><button type="button" className="close" aria-label="닫기" onClick={onClose}>×</button></header>

      <div className="session-dm-time-meal-top">
        <section className="time-card">
          <div className="section-label"><span>현재 날짜 및 시간</span><span>시간 진행</span></div>
          <div className="time-controls">
            <button type="button" className="current-date" onClick={()=>setDateOpen(true)}><span>▣ {anchor.era?.trim()||"서력"} {anchor.year??1}-{pad(Number(anchor.monthId)||1)}-{pad(anchor.day??1)}</span><span>◷ {pad(anchor.hour??0)}:{pad(anchor.minute??0)}</span></button>
            <span className={`period ${currentPeriod.id}`}>{currentPeriod.label}</span>
            <button disabled={busy} onClick={()=>void run(()=>api.advanceCampaignCalendar(projection.campaignId,{deltaMinutes:60,note:"세션 +1시간"}))}>+1시간</button>
            <button disabled={busy} onClick={()=>void run(()=>api.advanceCampaignCalendar(projection.campaignId,{deltaMinutes:480,note:"세션 +8시간"}))}>+8시간</button>
            <button disabled={busy} onClick={requestNextDay}>+1일</button>
            <button className="primary" disabled={busy} onClick={requestNextDay}>다음 날 진행 »</button>
          </div>
          <small>※ 시간 및 식사 관리는 DM만 조작할 수 있습니다.</small>
        </section>
        <section className="meal-summary">
          <div className="section-label"><span>오늘 식사 진행 상황</span><span>자세히 보기 ›</span></div>
          <strong>🍴 오늘 {mealTotal}식 필요 / <em>{mealSatisfied}식 충족</em> / <i>{mealShortage}식 부족</i></strong>
          <small>1인당 {MEALS_PER_DAY}식 필요</small>
          <div><span>🥖 오늘 일일 식량</span><b>{rations?.balance??0}개</b></div>
        </section>
      </div>

      <div className="session-dm-time-meal-main">
        <section className="party-meals">
          <h3>파티 식사 상태 <small>(오늘)</small></h3>
          <div className="meal-table" role="table">
            <div className="meal-row head" role="row"><span><input type="checkbox" aria-label="모두 선택" checked={selected.length===roster.length&&roster.length>0} onChange={(event)=>setSelected(event.target.checked?roster.map((member)=>member.rosterMemberId):[])}/></span><span>캐릭터</span><span>오늘 식사 현황 (최대 2식)</span><span>상태</span></div>
            {roster.map((member)=>{const count=Math.min(2,mealsByMember[member.rosterMemberId]??0);const setCount=(mealCount:number)=>void run(()=>api.setCampaignMemberMeals(projection.campaignId,{rosterMemberId:member.rosterMemberId,mealCount}));return <div className="meal-row" role="row" key={member.rosterMemberId}><span><input type="checkbox" aria-label={`${member.label} 선택`} checked={selected.includes(member.rosterMemberId)} onChange={()=>setSelected((current)=>current.includes(member.rosterMemberId)?current.filter((id)=>id!==member.rosterMemberId):[...current,member.rosterMemberId])}/></span><strong>♟ {member.label}</strong><span className="meal-dots"><button type="button" className={count>0?"filled":""} aria-label={`${member.label} 첫 번째 식사 ${count>0?"완료":"미완료"}`} aria-pressed={count>0} disabled={busy} onClick={()=>setCount(count===1?0:1)}/><button type="button" className={count>1?"filled":""} aria-label={`${member.label} 두 번째 식사 ${count>1?"완료":"미완료"}`} aria-pressed={count>1} disabled={busy} onClick={()=>setCount(count===2?1:2)}/><b>{count} / 2</b></span><span className={`meal-status ${count===2?"ok":count===1?"warn":"bad"}`}>{count===2?"충족":`부족 ${2-count}식`}</span></div>;})}
          </div>
          <footer>선택된 캐릭터: <b>{selected.length}명</b></footer>
        </section>

        <section className="meal-actions">
          <h3>👥 선택된 캐릭터에 적용 <small>{selected.length}명 선택됨</small></h3>
          <button type="button" className="meal-action selected" disabled={busy||!selected.length} onClick={()=>void serve({source:"tavern",mealUnits:1,costSpPerPerson:costSp})}><span className="meal-icon">⌂</span><span><b>식당 식사</b><small>+1식</small></span><label onClick={(event)=>event.stopPropagation()}>비용 입력<input type="number" min={0} step={1} value={costSp} onChange={(event)=>setCostSp(Math.max(0,Number(event.target.value)))} aria-label="식당 식사 1인당 비용"/><small>sp / 1인</small></label></button>
          <button type="button" className="meal-action" disabled={busy||!selected.length} onClick={()=>void serve({source:"camp",mealUnits:1})}><span className="meal-icon">⛺</span><span><b>캠프 식사</b><small>+1식</small></span><em>※ 비용 없음</em></button>
          <button type="button" className="meal-action" disabled={busy||!selected.length||selected.length>(rations?.balance??0)} onClick={()=>void serve({source:"ration",mealUnits:2})}><span className="meal-icon">🥖</span><span><b>일일 식량 사용</b><small>+2식</small></span><em>※ 식량 {selected.length}개 사용</em></button>
          <footer>체크된 캐릭터에게만 적용됩니다.</footer>
        </section>
      </div>

      <section className="next-day"><strong>◷ 다음 날 진행 시</strong><span>오늘의 식사 현황이 기록되며, 날짜가 다음 날로 넘어갑니다.</span><small>다음 날짜 미리보기</small><b>{formatCampaignCalendarDateTime(calendar.providerId,nextAnchor).split("·")[0]}</b></section>

      <section className="meal-history"><h3>최근 기록 <small>(최근 20건)</small></h3><div className="history-table"><div className="history-row head"><span>시간</span><span>유형</span><span>적용 대상</span><span>효과</span><span>비용</span><span>처리</span></div>{recent.length?recent.map((entry,index)=><HistoryRow key={entry.transactionId} entry={entry} roster={roster} undo={index===0&&entry.kind==="meal"?()=>void run(()=>api.undoCampaignMeal(projection.campaignId)):undefined}/>):<p>아직 식사 기록이 없습니다.</p>}</div><small>※ 기록은 최대 20건까지 표시됩니다.</small></section>
      {error&&<div className="time-meal-error" role="alert">{error}</div>}
    </section>
    {shortageOpen&&<ShortageDialog deficient={deficient} meals={mealsByMember} penalties={penalties} setPenalties={setPenalties} busy={busy} onCancel={()=>setShortageOpen(false)} onAdvance={()=>void advanceDay()}/>}
    {dateOpen&&<DateTimeDialog initial={{era:anchor.era??"서력",year:anchor.year??1,monthId:anchor.monthId??"1",day:anchor.day??1,hour:anchor.hour??0,minute:anchor.minute??0}} providerId={calendar.providerId} busy={busy} onCancel={()=>setDateOpen(false)} onApply={(dateTime)=>void run(()=>api.correctCampaignCalendarDateTime(projection.campaignId,{dateTime,note:"DM 날짜 및 시간 설정"})).then(()=>setDateOpen(false))}/>}
  </div>;
}

function HistoryRow({entry,roster,undo}:{entry:CampaignSupplyTransactionSummary;roster:Array<{rosterMemberId:string;label:string}>;undo?:()=>void}){
  const label=entry.kind==="meal"&&entry.mealSource?sourceCopy[entry.mealSource]:entry.kind==="undo"?"식사 처리 되돌리기":entry.kind==="consume"?"하루치 식량 소비":entry.kind==="adjust"?"식량 조정":"식량 전환";
  const targets=entry.rosterMemberIds?.map((id)=>roster.find((member)=>member.rosterMemberId===id)?.label??id).join(", ")||"파티 전체";
  const effect=entry.kind==="meal"?`${(entry.mealUnits??1)>0?"+":""}${entry.mealUnits??1}식 × ${entry.rosterMemberIds?.length??0}명`:entry.amount?`식량 ${entry.amount>0?"+":""}${entry.amount}`:"—";
  const time=entry.campaignAbsoluteMinute!=null?`${pad(Math.floor(entry.campaignAbsoluteMinute%1440/60))}:${pad(entry.campaignAbsoluteMinute%60)}`:"—";
  return <div className="history-row"><span>{time}</span><span>{label}</span><span>{targets}</span><span>{effect}</span><span>{entry.costSp?`${entry.costSp} sp`:entry.amount<0?`식량 ${Math.abs(entry.amount)}개`:"—"}</span><span>{undo&&<button type="button" onClick={undo} aria-label="최근 식사 되돌리기">↶</button>}</span></div>;
}

function ShortageDialog({deficient,meals,penalties,setPenalties,busy,onCancel,onAdvance}:{deficient:Array<{rosterMemberId:string;label:string}>;meals:Record<string,number>;penalties:Record<string,string>;setPenalties(value:Record<string,string>):void;busy:boolean;onCancel():void;onAdvance():void}){
  return <div className="time-meal-modal-backdrop"><section className="time-meal-modal shortage" role="alertdialog" aria-modal="true"><h2>⚠ 식사가 부족합니다</h2><p>일부 캐릭터가 오늘 필요한 식사를 완료하지 못했습니다.<br/>그대로 다음 날로 진행하시겠습니까?</p><div className="shortage-list"><div><b>캐릭터</b><b>식사 현황 (오늘)</b><b>부족 식사</b></div>{deficient.map((member)=>{const count=meals[member.rosterMemberId]??0;return <div key={member.rosterMemberId}><span>♟ {member.label}</span><span>{count} / 2식</span><strong>{2-count}식 부족</strong></div>;})}</div><div className="penalty-list"><h3>적용 패널티 <small>식사 부족 시 적용할 패널티를 선택할 수 있습니다.</small></h3>{deficient.map((member)=><label key={member.rosterMemberId}><span>♟ {member.label}</span><select value={penalties[member.rosterMemberId]??"none"} onChange={(event)=>setPenalties({...penalties,[member.rosterMemberId]:event.target.value})}><option value="none">패널티 없음</option><option value="fatigue+1">피로도 +1</option><option value="disadvantage">다음 내성굴림 불리</option></select></label>)}<small>※ 선택 내용은 다음 날 진행 기록에 남습니다.</small></div><footer><button disabled={busy} onClick={onCancel}>돌아가서 식사 처리</button><button className="danger" disabled={busy} onClick={onAdvance}>그대로 다음 날 진행</button></footer></section></div>;
}

function DateTimeDialog({initial,providerId,busy,onCancel,onApply}:{initial:CampaignCalendarDateTime;providerId:string;busy:boolean;onCancel():void;onApply(value:CampaignCalendarDateTime):void}){
  const [draft,setDraft]=useState(initial);
  const month=Math.max(1,Math.min(12,Number(draft.monthId)||1));
  const maxDay=providerId==="builtin.gregorian"?gregorianMonthDays(draft.year,month):31;
  const firstWeekday=providerId==="builtin.gregorian"?new Date(Date.UTC(draft.year,month-1,1)).getUTCDay():0;
  const cells=[...Array(firstWeekday).fill(null),...Array.from({length:maxDay},(_,index)=>index+1)];
  const update=(patch:Partial<CampaignCalendarDateTime>)=>setDraft((current)=>({...current,...patch}));
  const shiftMonth=(delta:number)=>{const next=month+delta;const year=draft.year+(next<1?-1:next>12?1:0);const normalized=next<1?12:next>12?1:next;update({year,monthId:String(normalized),day:Math.min(draft.day,gregorianMonthDays(year,normalized))});};
  return <div className="time-meal-modal-backdrop"><section className="time-meal-modal datetime" role="dialog" aria-modal="true" aria-label="날짜 및 시간 설정"><header><h2>날짜 및 시간 설정</h2><button onClick={onCancel} aria-label="닫기">×</button></header><div className="datetime-grid"><section><h3>1. 날짜 설정</h3><label className="era">연호<input value={draft.era} onChange={(event)=>update({era:event.target.value})}/></label><div className="date-fields"><label><input type="number" min={1} value={draft.year} onChange={(event)=>update({year:Math.max(1,Number(event.target.value))})}/>년</label><label><input type="number" min={1} max={12} value={month} onChange={(event)=>update({monthId:String(Math.max(1,Math.min(12,Number(event.target.value))))})}/>월</label><label><input type="number" min={1} max={maxDay} value={draft.day} onChange={(event)=>update({day:Math.max(1,Math.min(maxDay,Number(event.target.value)))})}/>일</label></div><div className="calendar-nav"><button onClick={()=>shiftMonth(-1)}>‹</button><b>{draft.year}년 {month}월</b><button onClick={()=>shiftMonth(1)}>›</button></div><div className="calendar-grid"><b>일</b><b>월</b><b>화</b><b>수</b><b>목</b><b>금</b><b>토</b>{cells.map((day,index)=>day?<button key={day} className={draft.day===day?"active":""} onClick={()=>update({day})}>{day}</button>:<span key={`blank-${index}`}/>)}</div></section><section><h3>2. 시간 설정 (24시간)</h3><div className="time-fields"><input type="number" min={0} max={23} value={draft.hour} onChange={(event)=>update({hour:Math.max(0,Math.min(23,Number(event.target.value)))})}/><b>:</b><input type="number" min={0} max={59} value={draft.minute} onChange={(event)=>update({minute:Math.max(0,Math.min(59,Number(event.target.value)))})}/></div><div className="period-preview">현재 시간대: <b>{campaignDayPeriod(draft.hour).label}</b></div><div className="quick-times"><h3>3. 빠른 시간 이동</h3>{[[4,"새벽"],[8,"아침"],[12,"낮"],[18,"저녁"],[22,"밤"]].map(([hour,label])=><button key={hour} onClick={()=>update({hour:Number(hour),minute:0})}><b>{label}</b><span>{pad(Number(hour))}:00</span></button>)}</div></section></div><footer><button disabled={busy} onClick={onCancel}>취소</button><button className="primary" disabled={busy||!draft.era.trim()} onClick={()=>onApply(draft)}>적용</button></footer></section></div>;
}
