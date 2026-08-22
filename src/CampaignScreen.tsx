import { useEffect, useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { CampaignRecordV1 } from "./app/campaignPersistenceContracts";
import { CampaignSystemsPanel } from "./CampaignSystemsPanel";
import { formatCampaignCalendarDateTime } from "./app/campaignCalendar";
import { deleteCampaign, duplicateCampaign } from "./app/campaignLifecycleCommands";

function campaignId(name:string){
  const slug=name.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-").replace(/^-|-$/g,"").slice(0,32)||"campaign";
  return `campaign.${slug}.${Date.now()}`;
}

function dateLabel(value:string|undefined){
  if(!value) return "아직 열지 않음";
  try{return new Intl.DateTimeFormat("ko-KR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}catch{return value;}
}

function CampaignCard({campaign,active,onOpen,onArchive,onRestore,onDuplicate,onDelete}:{campaign:CampaignRecordV1;active:boolean;onOpen():void;onArchive():void;onRestore():void;onDuplicate():void;onDelete():void}){
  return <article className={active?"campaign-list-card active":"campaign-list-card"}>
    <button className="campaign-card-open" onClick={onOpen}>
      <span className="campaign-card-monogram">{campaign.name.trim().slice(0,1)||"C"}</span>
      <span><small>{campaign.status==="archived"?"보관됨":active?"현재 캠페인":"캠페인"}</small><strong>{campaign.name}</strong><em>{campaign.description||"설명이 없습니다."}</em></span>
    </button>
    <footer>
      <span>최근 열기 · {dateLabel(campaign.lastOpenedAt)}</span>
      <span className="campaign-card-actions"><button onClick={onDuplicate}>복제</button>{campaign.status==="archived"?<button onClick={onRestore}>복원</button>:<button onClick={onArchive}>보관</button>}<button className="danger-action" onClick={onDelete}>삭제</button></span>
    </footer>
  </article>;
}

export function CampaignScreen({onOpenSession}:{onOpenSession():void}){
  const {snapshot,refresh,createCampaign,openCampaign,archiveCampaign,restoreCampaign,configureCampaignSessionDefaults}=useSimpleVtt();
  const [creating,setCreating]=useState(false);
  const [setupOpen,setSetupOpen]=useState(false);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [error,setError]=useState<string|null>(null);
  const [pending,setPending]=useState(false);
  const [archiveTarget,setArchiveTarget]=useState<CampaignRecordV1|null>(null);
  const [duplicateTarget,setDuplicateTarget]=useState<CampaignRecordV1|null>(null);
  const [duplicateName,setDuplicateName]=useState("");
  const [deleteTarget,setDeleteTarget]=useState<CampaignRecordV1|null>(null);
  const campaigns=snapshot?.campaigns??[];
  const activeCampaign=campaigns.find((campaign)=>campaign.campaignId===snapshot?.activeCampaignId)??null;
  const recent=useMemo(()=>campaigns.filter((campaign)=>campaign.status==="active").sort((a,b)=>(b.lastOpenedAt??b.updatedAt).localeCompare(a.lastOpenedAt??a.updatedAt)),[campaigns]);
  const archived=useMemo(()=>campaigns.filter((campaign)=>campaign.status==="archived"),[campaigns]);
  const [sessionName,setSessionName]=useState("");
  const [startingMode,setStartingMode]=useState<"freeform"|"initiative">("freeform");
  const [calendarEnabled,setCalendarEnabled]=useState(false);
  const [rationsEnabled,setRationsEnabled]=useState(false);
  const [rationsVisibleToPlayers,setRationsVisibleToPlayers]=useState(true);

  useEffect(()=>{
    if(!activeCampaign) return;
    setSessionName(activeCampaign.sessionDefaults.sessionNameTemplate||activeCampaign.name);
    setStartingMode(activeCampaign.sessionDefaults.startingMode);
    setCalendarEnabled(activeCampaign.sessionDefaults.calendarEnabled);
    setRationsEnabled(activeCampaign.sessionDefaults.rationsEnabled);
    setRationsVisibleToPlayers(activeCampaign.sessionDefaults.rationsVisibleToPlayers??true);
  },[activeCampaign?.campaignId,activeCampaign?.revision]);

  if(!snapshot) return null;
  const perform=async(operation:()=>Promise<void>)=>{setPending(true);setError(null);try{await operation();}catch(reason){setError(reason instanceof Error?reason.message:"작업을 완료하지 못했습니다.");}finally{setPending(false);}};
  const submitCreate=()=>perform(async()=>{if(!name.trim()) throw new Error("캠페인 이름을 입력하세요.");await createCampaign({campaignId:campaignId(name),name:name.trim(),description:description.trim()||undefined});setName("");setDescription("");setCreating(false);});
  const confirmArchive=()=>{
    if(!archiveTarget) return;
    const targetId=archiveTarget.campaignId;
    void perform(async()=>{await archiveCampaign(targetId);setArchiveTarget(null);});
  };
  const beginDuplicate=(campaign:CampaignRecordV1)=>{setDuplicateTarget(campaign);setDuplicateName(`${campaign.name} 복사본`);setArchiveTarget(null);setDeleteTarget(null);};
  const confirmDuplicate=()=>{
    if(!duplicateTarget) return;
    const newName=duplicateName.trim();
    if(!newName){setError("복제할 캠페인 이름을 입력하세요.");return;}
    const sourceId=duplicateTarget.campaignId;
    void perform(async()=>{await duplicateCampaign(sourceId,{newCampaignId:campaignId(newName),newName});await refresh();setDuplicateTarget(null);setDuplicateName("");});
  };
  const beginDelete=(campaign:CampaignRecordV1)=>{setDeleteTarget(campaign);setArchiveTarget(null);setDuplicateTarget(null);setDuplicateName("");};
  const confirmDelete=()=>{
    if(!deleteTarget) return;
    const targetId=deleteTarget.campaignId;
    void perform(async()=>{await deleteCampaign(targetId);await refresh();setDeleteTarget(null);setSetupOpen(false);});
  };
  const continueToSession=()=>perform(async()=>{
    if(!activeCampaign) throw new Error("세션을 시작할 캠페인을 선택하세요.");
    await configureCampaignSessionDefaults(activeCampaign.campaignId,{sessionNameTemplate:sessionName.trim()||activeCampaign.name,startingMode,calendarEnabled,rationsEnabled,rationsVisibleToPlayers});
    onOpenSession();
  });

  const card=(campaign:CampaignRecordV1,active:boolean)=><CampaignCard key={campaign.campaignId} campaign={campaign} active={active} onOpen={()=>void perform(()=>openCampaign(campaign.campaignId))} onArchive={()=>setArchiveTarget(campaign)} onRestore={()=>void perform(()=>restoreCampaign(campaign.campaignId))} onDuplicate={()=>beginDuplicate(campaign)} onDelete={()=>beginDelete(campaign)}/>;

  return <div className="campaign-screen">
    <header className="campaign-page-head">
      <div><span>CAMPAIGN</span><h1>캠페인</h1><p>파티의 시간, 식량, 보관함과 DM 준비물을 세션 사이에 이어갑니다.</p></div>
      <button className="primary" onClick={()=>setCreating(true)}>새 캠페인</button>
    </header>
    {error&&<div className="campaign-error" role="alert">{error}</div>}

    {creating&&<section className="campaign-create-panel" aria-label="새 캠페인 만들기">
      <header><div><span>NEW CAMPAIGN</span><h2>새 캠페인</h2></div><button onClick={()=>setCreating(false)}>닫기</button></header>
      <label><span>캠페인 이름</span><input autoFocus value={name} onChange={(event)=>setName(event.target.value)} placeholder="예: 잿빛 해안"/></label>
      <label><span>설명</span><textarea value={description} onChange={(event)=>setDescription(event.target.value)} placeholder="파티와 모험에 대한 짧은 메모"/></label>
      <button className="primary" disabled={pending||!name.trim()} onClick={submitCreate}>캠페인 만들기</button>
    </section>}

    {!campaigns.length&&!creating?<section className="campaign-empty"><span>첫 장을 펼칠 준비가 됐습니다.</span><h2>아직 캠페인이 없습니다.</h2><p>캠페인을 만들면 달력·식량·파티 보관함·DM 라이브러리를 하나의 장기 플레이에 묶을 수 있습니다.</p><button className="primary" onClick={()=>setCreating(true)}>새 캠페인 만들기</button></section>:<div className="campaign-layout">
      <aside className="campaign-library">
        <section><h2>최근 캠페인</h2>{recent.length?recent.map((campaign)=>card(campaign,campaign.campaignId===activeCampaign?.campaignId)):<p className="campaign-list-empty">활성 캠페인이 없습니다.</p>}</section>
        {archived.length>0&&<section><h2>보관된 캠페인</h2>{archived.map((campaign)=>card(campaign,false))}</section>}
      </aside>

      <main className="campaign-dashboard">
        {archiveTarget&&<section className="campaign-session-setup" role="dialog" aria-modal="true" aria-label="캠페인 보관 확인">
          <header><div><span>ARCHIVE CAMPAIGN</span><h2>캠페인 보관 확인</h2></div><button disabled={pending} onClick={()=>setArchiveTarget(null)}>닫기</button></header>
          <div className="campaign-identity-lock"><span>캠페인</span><strong>{archiveTarget.name}</strong><small>Campaign ID · {archiveTarget.campaignId}</small></div>
          <div className="campaign-capability-note"><span>보관 동작</span><strong>캠페인 데이터는 삭제하지 않습니다.</strong><p>보관하면 세션 시작이 비활성화되고 보관된 캠페인 목록으로 이동합니다. Character 파일, 설치 콘텐츠, 달력·식량·보관함·DM 라이브러리 기록은 그대로 유지됩니다.</p></div>
          <footer><button disabled={pending} onClick={()=>setArchiveTarget(null)}>취소</button><button className="primary" disabled={pending} onClick={confirmArchive}>{pending?"보관 중…":"캠페인 보관"}</button></footer>
        </section>}
        {duplicateTarget&&<section className="campaign-session-setup" role="dialog" aria-modal="true" aria-label="캠페인 복제 확인">
          <header><div><span>DUPLICATE CAMPAIGN</span><h2>캠페인 복제</h2></div><button disabled={pending} onClick={()=>{setDuplicateTarget(null);setDuplicateName("");}}>닫기</button></header>
          <div className="campaign-identity-lock"><span>원본 캠페인</span><strong>{duplicateTarget.name}</strong><small>Campaign ID · {duplicateTarget.campaignId}</small></div>
          <label><span>새 캠페인 이름</span><input autoFocus value={duplicateName} onChange={(event)=>setDuplicateName(event.target.value)} /></label>
          <div className="campaign-capability-note"><span>복제되는 Campaign-owned continuity</span><strong>현재 준비 상태를 새 Campaign namespace로 복사합니다.</strong><p>파티 명단의 Character 참조, 세션 기본값, 달력과 식량 상태·기록, 파티 보관함, DM 라이브러리, 콘텐츠 loadout을 복제합니다. 새 보관함·DM 라이브러리·loadout ID를 사용합니다.</p></div>
          <div className="campaign-capability-note"><span>복제하지 않는 외부/세션 데이터</span><strong>Player 소유 데이터와 과거 Session은 복사하지 않습니다.</strong><p>Player 소유 Character 파일과 설치 콘텐츠 자체·소유권은 복제하지 않습니다. 파티 명단에는 Character 참조만 유지됩니다. 과거 세션 기록과 실행 중 Session transient state도 새 Campaign으로 복사하지 않습니다.</p></div>
          <footer><button disabled={pending} onClick={()=>{setDuplicateTarget(null);setDuplicateName("");}}>취소</button><button className="primary" disabled={pending||!duplicateName.trim()} onClick={confirmDuplicate}>{pending?"복제 중…":"캠페인 복제"}</button></footer>
        </section>}
        {deleteTarget&&<section className="campaign-session-setup" role="dialog" aria-modal="true" aria-label="캠페인 삭제 확인">
          <header><div><span>DELETE CAMPAIGN</span><h2>캠페인을 정말 삭제할까요?</h2></div><button disabled={pending} onClick={()=>setDeleteTarget(null)}>닫기</button></header>
          <div className="campaign-identity-lock"><span>삭제 대상</span><strong>{deleteTarget.name}</strong><small>Campaign ID · {deleteTarget.campaignId}</small></div>
          <div className="campaign-capability-note"><span>삭제 범위</span><strong>이 Campaign이 소유한 기록만 영구 삭제합니다.</strong><p>캠페인 설정, 파티 참조, 달력·식량, 파티 보관함, DM 라이브러리와 세션 요약이 삭제됩니다. Player 소유 Character 파일과 설치 콘텐츠 자체는 삭제하지 않습니다. 진행 중인 Session이 이 Campaign에 묶여 있으면 삭제를 거부합니다.</p></div>
          <div className="campaign-error" role="alert">이 작업은 되돌릴 수 없습니다.</div>
          <footer><button disabled={pending} onClick={()=>setDeleteTarget(null)}>취소</button><button className="danger-action" disabled={pending} onClick={confirmDelete}>{pending?"삭제 중…":"캠페인 삭제"}</button></footer>
        </section>}
        {activeCampaign?<>
          <header className="campaign-dashboard-head"><div><span>캠페인 대시보드</span><h2>{activeCampaign.name}</h2><p>{activeCampaign.description||"설명 없음"}</p></div><button className="primary" disabled={activeCampaign.status==="archived"} onClick={()=>setSetupOpen(true)}>세션 시작</button></header>
          <div className="campaign-system-grid">
            <article><span>PARTY</span><h3>파티</h3><strong>{activeCampaign.roster.filter((member)=>member.active).length}명</strong><p>식량 계산과 보관함 권한에 사용할 명단입니다.</p></article>
            <article><span>CALENDAR</span><h3>달력</h3><strong>{activeCampaign.calendar.capability.enabled?formatCampaignCalendarDateTime(activeCampaign.calendar.state.providerId,activeCampaign.calendar.state.displayAnchor):"꺼짐"}</strong><p>현재 절대 시간 {activeCampaign.calendar.state.absoluteMinute}분</p></article>
            <article><span>RATIONS</span><h3>식량</h3><strong>{activeCampaign.rations.ledger.balances.ration}식</strong><p>{activeCampaign.rations.capability.enabled?"추적 중":"규칙 꺼짐 · 기록 보존"}</p></article>
            <article><span>STASH</span><h3>파티 보관함</h3><strong>{activeCampaign.partyStash.wallet.gp} GP</strong><p>아이템 {activeCampaign.partyStash.itemReferences.length}개 · {activeCampaign.partyStash.policy}</p></article>
            <article><span>PRIVATE</span><h3>DM 라이브러리</h3><strong>{activeCampaign.dmLibrary.entries.length}개</strong><p>이 캠페인에서만 검색되는 비공개 준비물입니다.</p></article>
            <article><span>HISTORY</span><h3>세션 기록</h3><strong>{activeCampaign.sessionHistory.length}회</strong><p>최근 세션 요약만 보존합니다.</p></article>
          </div>
          <CampaignSystemsPanel campaign={activeCampaign}/>
          {setupOpen&&<section className="campaign-session-setup" aria-label="세션 시작 설정">
            <header><div><span>SESSION SETUP</span><h2>세션 시작</h2></div><button onClick={()=>setSetupOpen(false)}>닫기</button></header>
            <div className="campaign-identity-lock"><span>캠페인</span><strong>{activeCampaign.name}</strong><small>이번 세션은 이 Campaign ID와 revision을 기준으로 시작합니다.</small></div>
            <label><span>세션 이름</span><input value={sessionName} onChange={(event)=>setSessionName(event.target.value)}/></label>
            <fieldset><legend>시작 모드</legend><button className={startingMode==="freeform"?"active":""} onClick={()=>setStartingMode("freeform")}>자유 진행</button><button className={startingMode==="initiative"?"active":""} onClick={()=>setStartingMode("initiative")}>이니셔티브</button></fieldset>
            <div className="campaign-option-list">
              <label><input type="checkbox" checked={calendarEnabled} onChange={(event)=>setCalendarEnabled(event.target.checked)}/><span><strong>세션 달력 사용</strong><small>{calendarEnabled?"현재 Campaign 시간을 세션에서 추적합니다.":"기록은 보존되며 이번 Session에서 UI와 자동 규칙만 비활성화됩니다."}</small></span></label>
              <label><input type="checkbox" checked={rationsEnabled} onChange={(event)=>setRationsEnabled(event.target.checked)}/><span><strong>식량 규칙 사용</strong><small>{rationsEnabled?`현재 ${activeCampaign.rations.ledger.balances.ration}식 · 추적 전용`:"기록은 보존되며 이번 Session에서 UI와 자동 규칙만 비활성화됩니다."}</small></span></label>
              {rationsEnabled&&<label><input type="checkbox" checked={rationsVisibleToPlayers} onChange={(event)=>setRationsVisibleToPlayers(event.target.checked)}/><span><strong>플레이어에게 식량 공개</strong><small>{rationsVisibleToPlayers?"Player가 현재 잔량과 하루 필요량을 확인할 수 있습니다.":"식량 정보는 DM에게만 표시됩니다."}</small></span></label>}
            </div>
            <div className="campaign-capability-note"><span>전투맵/공간</span><strong>감지된 모듈 없음</strong><p>거리·시야·엄폐 판정이 비활성화됩니다. 일반 세션 진행은 막지 않습니다.</p></div>
            <footer><button onClick={()=>setSetupOpen(false)}>취소</button><button className="primary" disabled={pending} onClick={continueToSession}>준비 화면으로</button></footer>
          </section>}
        </>:<section className="campaign-dashboard-empty"><h2>캠페인을 선택하세요.</h2><p>최근 캠페인을 열거나 새 캠페인을 만드세요.</p></section>}
      </main>
    </div>}
  </div>;
}
