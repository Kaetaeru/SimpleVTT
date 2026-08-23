import { useEffect, useMemo, useState } from "react";
import { previewCampaignDailyRations } from "./app/campaignApplicationService";
import { formatCampaignCalendarDateTime, GREGORIAN_CALENDAR_MONTHS } from "./app/campaignCalendar";
import type { CampaignDmLibraryEntry, CampaignPartyStashItemTemplate, CampaignRecordV1, CampaignRosterMember } from "./app/campaignPersistenceContracts";
import { latestCampaignProviderDescriptorsFromCatalog, pinnedCampaignProviderDescriptorFromCatalog } from "./app/campaignProviderProfiles";
import { useSimpleVtt } from "./app/AppProvider";
import { HANDOUT_IMAGE_MAX_BYTES, LOCAL_IMAGE_ACCEPT, readLocalImageFile, type LocalImageAssetV1 } from "./app/localImageAsset";
import { CAMPAIGN_DM_LIBRARY_JSON_EXAMPLE, parseCampaignDmLibraryJson } from "./app/campaignDmLibraryImport";
import type { PartyStashPolicy } from "./app/contracts";
import "./app/campaignPartyStashPolicyRuntimeAdapter";
import { mockAdapter } from "./app/mockAdapter";

function rosterId(){return `roster.${globalThis.crypto?.randomUUID?.()??Date.now()}`;}
function libraryId(){return `dm-item.${globalThis.crypto?.randomUUID?.()??Date.now()}`;}
function moduleCalendarProvider(providerId:string){return providerId.startsWith("module.calendar-profile:");}
function moduleRationProvider(providerId:string){return providerId.startsWith("module.ration-profile:");}
function providerOptionValue(provider:{providerId:string;providerVersion:string}){return `${provider.providerId}@@${provider.providerVersion}`;}
function missingProviderValue(kind:"calendar"|"ration",providerId:string,providerVersion:string){return `missing:${kind}:${providerId}@@${providerVersion}`;}
function stashPolicyLabel(policy:PartyStashPolicy){return policy==="shared"?"공유":policy==="dm-approval"?"DM 승인":"DM 관리";}
type ProviderConfigure=(campaignId:string,input:{enabled:boolean;providerId:string;providerVersion?:string})=>Promise<void>;

export function CampaignSystemsPanel({campaign}:{campaign:CampaignRecordV1}){
  const api=useSimpleVtt();
  const catalog=api.snapshot?.catalog??[];
  const calendarProviders=useMemo(()=>latestCampaignProviderDescriptorsFromCatalog(catalog,"calendar"),[catalog]);
  const rationProviders=useMemo(()=>latestCampaignProviderDescriptorsFromCatalog(catalog,"ration"),[catalog]);
  const selectedCalendarProvider=useMemo(()=>moduleCalendarProvider(campaign.calendar.capability.providerId)?pinnedCampaignProviderDescriptorFromCatalog(catalog,"calendar",campaign.calendar.capability.providerId,campaign.calendar.capability.providerVersion):null,[catalog,campaign.calendar.capability.providerId,campaign.calendar.capability.providerVersion]);
  const selectedRationProvider=useMemo(()=>moduleRationProvider(campaign.rations.capability.providerId)?pinnedCampaignProviderDescriptorFromCatalog(catalog,"ration",campaign.rations.capability.providerId,campaign.rations.capability.providerVersion):null,[catalog,campaign.rations.capability.providerId,campaign.rations.capability.providerVersion]);
  const selectedCalendarProfile=selectedCalendarProvider?.profile.kind==="calendar"?selectedCalendarProvider.profile:undefined;
  const selectedRationProfile=selectedRationProvider?.profile.kind==="ration"?selectedRationProvider.profile:undefined;
  const calendarProviderUnavailable=moduleCalendarProvider(campaign.calendar.capability.providerId)&&!selectedCalendarProvider;
  const rationProviderUnavailable=moduleRationProvider(campaign.rations.capability.providerId)&&!selectedRationProvider;
  const latestMatchingCalendarProvider=calendarProviders.find((provider)=>provider.providerId===campaign.calendar.capability.providerId);
  const latestMatchingRationProvider=rationProviders.find((provider)=>provider.providerId===campaign.rations.capability.providerId);
  const calendarPinnedOlder=Boolean(selectedCalendarProvider&&latestMatchingCalendarProvider&&selectedCalendarProvider.providerVersion!==latestMatchingCalendarProvider.providerVersion);
  const rationPinnedOlder=Boolean(selectedRationProvider&&latestMatchingRationProvider&&selectedRationProvider.providerVersion!==latestMatchingRationProvider.providerVersion);
  const calendarSelectValue=moduleCalendarProvider(campaign.calendar.capability.providerId)
    ? selectedCalendarProvider?providerOptionValue(selectedCalendarProvider):missingProviderValue("calendar",campaign.calendar.capability.providerId,campaign.calendar.capability.providerVersion)
    : campaign.calendar.capability.providerId;
  const rationSelectValue=moduleRationProvider(campaign.rations.capability.providerId)
    ? selectedRationProvider?providerOptionValue(selectedRationProvider):missingProviderValue("ration",campaign.rations.capability.providerId,campaign.rations.capability.providerVersion)
    : campaign.rations.capability.providerId;
  const calendarStructuredDate=campaign.calendar.state.providerId!=="builtin.simple-day";
  const calendarMonths=campaign.calendar.state.providerId==="builtin.gregorian"?GREGORIAN_CALENDAR_MONTHS:selectedCalendarProfile?.months??[];
  const [memberLabel,setMemberLabel]=useState("");
  const [memberKind,setMemberKind]=useState<CampaignRosterMember["kind"]>("player-character-ref");
  const [characterId,setCharacterId]=useState("");
  const [rationUnits,setRationUnits]=useState("1");
  const [calendarNote,setCalendarNote]=useState(campaign.calendar.state.currentNote??"");
  const [calendarEra,setCalendarEra]=useState(campaign.calendar.state.displayAnchor.era??"서력");
  const [calendarYear,setCalendarYear]=useState(String(campaign.calendar.state.displayAnchor.year??1));
  const [calendarMonth,setCalendarMonth]=useState(campaign.calendar.state.displayAnchor.monthId??"1");
  const [calendarDay,setCalendarDay]=useState(String(campaign.calendar.state.displayAnchor.day??1));
  const [calendarHour,setCalendarHour]=useState(String(campaign.calendar.state.displayAnchor.hour??0));
  const [calendarMinute,setCalendarMinute]=useState(String(campaign.calendar.state.displayAnchor.minute??0));
  const [rationAdjustment,setRationAdjustment]=useState("1");
  const [consumeWithDay,setConsumeWithDay]=useState(campaign.rations.capability.enabled);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [libraryQuery,setLibraryQuery]=useState("");
  const [libraryKind,setLibraryKind]=useState<"custom-item"|"image"|"npc-definition">("custom-item");
  const [editingLibraryId,setEditingLibraryId]=useState<string|null>(null);
  const [itemName,setItemName]=useState("");
  const [itemNameEn,setItemNameEn]=useState("");
  const [itemDefinitionId,setItemDefinitionId]=useState("");
  const [itemKind,setItemKind]=useState<CampaignPartyStashItemTemplate["kind"]>("equipment");
  const [itemTags,setItemTags]=useState("");
  const [imageAsset,setImageAsset]=useState<LocalImageAssetV1|null>(null);
  const [npcAc,setNpcAc]=useState("12");
  const [npcHp,setNpcHp]=useState("10");
  const [npcActions,setNpcActions]=useState("기본 공격");
  const [jsonImportOpen,setJsonImportOpen]=useState(false);
  const [jsonPayload,setJsonPayload]=useState(CAMPAIGN_DM_LIBRARY_JSON_EXAMPLE);
  const [jsonPreview,setJsonPreview]=useState<CampaignDmLibraryEntry[]|null>(null);
  const [jsonError,setJsonError]=useState<string|null>(null);
  const rationPreview=useMemo(()=>rationProviderUnavailable?null:previewCampaignDailyRations(campaign,undefined,selectedRationProfile),[campaign,rationProviderUnavailable,selectedRationProfile]);
  const configureCalendarWithVersion=api.configureCampaignCalendar as ProviderConfigure;
  const configureRationsWithVersion=api.configureCampaignRations as ProviderConfigure;
  useEffect(()=>{
    const anchor=campaign.calendar.state.displayAnchor;
    setCalendarEra(anchor.era??"서력");setCalendarYear(String(anchor.year??1));setCalendarMonth(anchor.monthId??"1");setCalendarDay(String(anchor.day??1));setCalendarHour(String(anchor.hour??0));setCalendarMinute(String(anchor.minute??0));
  },[campaign.campaignId,campaign.calendar.state.providerId,campaign.calendar.capability.providerVersion,campaign.calendar.state.absoluteMinute]);
  const perform=async(operation:()=>Promise<void>)=>{setBusy(true);setError(null);try{await operation();}catch(reason){setError(reason instanceof Error?reason.message:"작업을 완료하지 못했습니다.");}finally{setBusy(false);}};
  const selectCalendarProvider=async(value:string)=>{
    if(value==="builtin.simple-day"||value==="builtin.gregorian") return configureCalendarWithVersion(campaign.campaignId,{enabled:campaign.calendar.capability.enabled,providerId:value});
    const provider=calendarProviders.find((candidate)=>providerOptionValue(candidate)===value);
    if(!provider) throw new Error("선택한 달력 공급자를 찾을 수 없습니다.");
    return configureCalendarWithVersion(campaign.campaignId,{enabled:campaign.calendar.capability.enabled,providerId:provider.providerId,providerVersion:provider.providerVersion});
  };
  const selectRationProvider=async(value:string)=>{
    if(value==="builtin.tracking-only") return configureRationsWithVersion(campaign.campaignId,{enabled:campaign.rations.capability.enabled,providerId:value});
    const provider=rationProviders.find((candidate)=>providerOptionValue(candidate)===value);
    if(!provider) throw new Error("선택한 식량 공급자를 찾을 수 없습니다.");
    return configureRationsWithVersion(campaign.campaignId,{enabled:campaign.rations.capability.enabled,providerId:provider.providerId,providerVersion:provider.providerVersion});
  };
  const toggleCalendar=(enabled:boolean)=>configureCalendarWithVersion(campaign.campaignId,{enabled,providerId:campaign.calendar.capability.providerId,...(moduleCalendarProvider(campaign.calendar.capability.providerId)?{providerVersion:campaign.calendar.capability.providerVersion}:{})});
  const toggleRations=(enabled:boolean)=>configureRationsWithVersion(campaign.campaignId,{enabled,providerId:campaign.rations.capability.providerId,...(moduleRationProvider(campaign.rations.capability.providerId)?{providerVersion:campaign.rations.capability.providerVersion}:{})});
  const configurePartyStashPolicy=(policy:PartyStashPolicy)=>perform(async()=>{
    const result=await mockAdapter.setCampaignPartyStashPolicy(campaign.campaignId,policy);
    if(!result) throw new Error("캠페인 화면에서만 Party Stash 정책을 변경할 수 있습니다.");
    await api.refresh();
  });
  const updateMember=(member:CampaignRosterMember,patch:Partial<CampaignRosterMember>)=>perform(()=>api.upsertCampaignRosterMember(campaign.campaignId,{...member,...patch}));
  const addMember=()=>perform(async()=>{
    if(!memberLabel.trim()) throw new Error("구성원 이름을 입력하세요.");
    const units=Number(rationUnits);if(!Number.isInteger(units)||units<0) throw new Error("하루 식량은 0 이상의 정수여야 합니다.");
    if(memberKind==="player-character-ref"&&!characterId.trim()) throw new Error("Character 참조 ID를 입력하세요.");
    await api.upsertCampaignRosterMember(campaign.campaignId,{rosterMemberId:rosterId(),label:memberLabel.trim(),kind:memberKind,characterRef:memberKind==="player-character-ref"?{characterId:characterId.trim()}:undefined,active:true,countsForRations:true,rationUnitsPerDay:units,stashPermission:"request"});
    setMemberLabel("");setCharacterId("");setRationUnits("1");
  });
  const resetLibraryForm=(kind=libraryKind)=>{setLibraryKind(kind);setEditingLibraryId(null);setItemName("");setItemNameEn("");setItemDefinitionId("");setItemKind("equipment");setItemTags("");setImageAsset(null);setNpcAc("12");setNpcHp("10");setNpcActions("기본 공격");};
  const editLibrary=(entry:CampaignDmLibraryEntry)=>{if(entry.kind!=="custom-item"&&entry.kind!=="image"&&entry.kind!=="npc-definition")return;setLibraryKind(entry.kind);setEditingLibraryId(entry.entryId);setItemName(entry.label);setItemNameEn(entry.itemTemplate?.nameEn??entry.npcDefinition?.nameEn??"");setItemDefinitionId(entry.definitionId??"");setItemKind(entry.itemTemplate?.kind??"equipment");setItemTags((entry.tags??[]).join(", "));setImageAsset(entry.imageAsset??null);setNpcAc(String(entry.npcDefinition?.ac??12));setNpcHp(String(entry.npcDefinition?.maxHp??10));setNpcActions(entry.npcDefinition?.actions.join(", ")??"기본 공격");};
  const chooseLibraryImage=async(file:File|undefined)=>{if(!file)return;try{setImageAsset(await readLocalImageFile(file,HANDOUT_IMAGE_MAX_BYTES));setError(null);}catch(reason){setImageAsset(null);setError(reason instanceof Error?reason.message:"이미지를 읽지 못했습니다.");}};
  const saveLibrary=()=>perform(async()=>{
    if(!itemName.trim())throw new Error("이름을 입력하세요.");
    const slug=itemName.trim().toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-");
    const definitionId=itemDefinitionId.trim()||`local.${campaign.campaignId}.${libraryKind}.${slug}`;
    const previous=campaign.dmLibrary.entries.find((entry)=>entry.entryId===editingLibraryId);
    const common={entryId:editingLibraryId??libraryId(),kind:libraryKind,label:itemName.trim(),definitionId,favorite:previous?.favorite??false,tags:itemTags.split(",").map((tag)=>tag.trim()).filter(Boolean)};
    if(libraryKind==="custom-item")await api.upsertCampaignDmLibraryEntry(campaign.campaignId,{...common,kind:"custom-item",itemTemplate:{definitionId,name:itemName.trim(),nameEn:itemNameEn.trim()||undefined,kind:itemKind,passiveEffects:previous?.itemTemplate?.passiveEffects??[],grantedActionIds:previous?.itemTemplate?.grantedActionIds??[],provenance:[`Campaign DM Library · ${campaign.name}`]}});
    else if(libraryKind==="image"){
      if(!imageAsset)throw new Error("이미지 파일을 선택하세요.");
      await api.upsertCampaignDmLibraryEntry(campaign.campaignId,{...common,kind:"image",definitionId:undefined,imageAsset});
    }else{
      const ac=Number(npcAc),maxHp=Number(npcHp);if(!Number.isInteger(ac)||ac<0||!Number.isInteger(maxHp)||maxHp<1)throw new Error("NPC AC와 HP를 확인하세요.");
      await api.upsertCampaignDmLibraryEntry(campaign.campaignId,{...common,kind:"npc-definition",npcDefinition:{definitionId,name:itemName.trim(),nameEn:itemNameEn.trim()||undefined,ac,maxHp,actions:npcActions.split(",").map((action)=>action.trim()).filter(Boolean),statusImmunities:previous?.npcDefinition?.statusImmunities??[],source:`Campaign DM Library · ${campaign.name}`,version:"1"}});
    }
    resetLibraryForm();
  });
  const visibleLibrary=campaign.dmLibrary.entries.filter((entry)=>entry.kind===libraryKind&&(!libraryQuery.trim()||`${entry.label} ${entry.definitionId??""} ${(entry.tags??[]).join(" ")}`.toLocaleLowerCase("ko-KR").includes(libraryQuery.trim().toLocaleLowerCase("ko-KR")))).sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||a.label.localeCompare(b.label,"ko-KR"));
  const duplicateLibrary=(entry:CampaignDmLibraryEntry)=>{const definitionId=entry.definitionId?`${entry.definitionId}.copy.${Date.now()}`:undefined;return api.upsertCampaignDmLibraryEntry(campaign.campaignId,{...entry,entryId:libraryId(),definitionId,npcDefinition:entry.npcDefinition&&definitionId?{...entry.npcDefinition,definitionId}:undefined,label:entry.label+" 복사본",favorite:false});};
  const previewLibraryJson=()=>{try{const entries=parseCampaignDmLibraryJson(jsonPayload,{campaignId:campaign.campaignId,campaignName:campaign.name,createEntryId:libraryId}).map((entry)=>{const existing=campaign.dmLibrary.entries.find((value)=>value.definitionId===entry.definitionId);return existing?{...entry,entryId:existing.entryId,favorite:entry.favorite||existing.favorite}:entry;});setJsonPreview(entries);setJsonError(null);}catch(reason){setJsonPreview(null);setJsonError(reason instanceof Error?reason.message:"JSON을 검증하지 못했습니다.");}};
  const importLibraryJson=()=>perform(async()=>{if(!jsonPreview)throw new Error("먼저 JSON을 검토하세요.");for(const entry of jsonPreview)await api.upsertCampaignDmLibraryEntry(campaign.campaignId,entry);setLibraryKind(jsonPreview[0].kind==="npc-definition"?"npc-definition":"custom-item");setJsonImportOpen(false);setJsonPreview(null);setJsonError(null);});

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
          <select aria-label={`${member.label} 보관함 권한`} value={member.stashPermission??"none"} onChange={(event)=>void updateMember(member,{stashPermission:event.target.value as CampaignRosterMember["stashPermission"])}><option value="none">권한 없음</option><option value="view">조회</option><option value="request">요청</option><option value="manage">관리</option></select>
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
        <header><div><span>WORLD TIME</span><h3 id="campaign-calendar-title">세션 달력</h3></div><strong>{formatCampaignCalendarDateTime(campaign.calendar.state.providerId,campaign.calendar.state.displayAnchor)}</strong></header>
        <div className="campaign-provider-row"><label><input type="checkbox" checked={campaign.calendar.capability.enabled} disabled={busy||(!campaign.calendar.capability.enabled&&calendarProviderUnavailable)} onChange={(event)=>void perform(()=>toggleCalendar(event.target.checked))}/> 사용</label><select aria-label="달력 공급자" value={calendarSelectValue} disabled={busy} onChange={(event)=>void perform(()=>selectCalendarProvider(event.target.value))}><option value="builtin.simple-day">Simple Day</option><option value="builtin.gregorian">Gregorian</option>{calendarProviderUnavailable&&<option value={calendarSelectValue} disabled>현재 고정 · 사용할 수 없음 · v{campaign.calendar.capability.providerVersion}</option>}{calendarPinnedOlder&&selectedCalendarProvider&&<option value={providerOptionValue(selectedCalendarProvider)} disabled>현재 고정 · {selectedCalendarProvider.label} · v{selectedCalendarProvider.providerVersion}</option>}{calendarProviders.map((provider)=><option key={`${provider.providerId}@${provider.providerVersion}`} value={providerOptionValue(provider)}>{provider.label} · v{provider.providerVersion}</option>)}{!calendarProviders.length&&<option value="module.calendar-profile" disabled>모듈 프로필 · 설치 필요</option>}</select></div>
        {calendarProviderUnavailable&&<p className="campaign-off-note">현재 고정 달력 공급자를 찾을 수 없습니다: {campaign.calendar.capability.providerId}@{campaign.calendar.capability.providerVersion}. 공급자 없음은 세션·휴식·행동을 막지 않습니다. Simple Day/Gregorian을 선택하거나 모듈을 다시 설치하세요.</p>}
        {!campaign.calendar.capability.enabled?<p className="campaign-off-note">달력이 꺼져 있습니다. 저장된 {campaign.calendar.state.absoluteMinute}분은 유지되며 세션·휴식·행동을 막지 않습니다.</p>:<>
          <div className="campaign-calendar-facts"><div><span>연호</span><strong>{campaign.calendar.state.displayAnchor.era??"—"}</strong></div><div><span>날짜</span><strong>{calendarStructuredDate?`${campaign.calendar.state.displayAnchor.year}년 ${campaign.calendar.state.displayAnchor.monthLabel??campaign.calendar.state.displayAnchor.monthId} ${campaign.calendar.state.displayAnchor.day}일`:`Day ${campaign.calendar.state.displayAnchor.day}`}</strong></div><div><span>시간</span><strong>{String(campaign.calendar.state.displayAnchor.hour??0).padStart(2,"0")}:{String(campaign.calendar.state.displayAnchor.minute??0).padStart(2,"0")}</strong></div></div>
          <div className="campaign-action-row"><button disabled={busy||calendarProviderUnavailable} onClick={()=>void perform(()=>api.advanceCampaignCalendar(campaign.campaignId,{deltaMinutes:10,note:calendarNote||undefined}))}>+10분</button><button disabled={busy||calendarProviderUnavailable} onClick={()=>void perform(()=>api.advanceCampaignCalendar(campaign.campaignId,{deltaMinutes:30,note:calendarNote||undefined}))}>+30분</button><button disabled={busy||calendarProviderUnavailable} onClick={()=>void perform(()=>api.advanceCampaignCalendar(campaign.campaignId,{deltaMinutes:60,note:calendarNote||undefined}))}>+1시간</button><button disabled={busy||calendarProviderUnavailable} onClick={()=>void perform(()=>api.advanceCampaignCalendar(campaign.campaignId,{deltaMinutes:360,note:calendarNote||undefined}))}>+6시간</button><button disabled={busy||calendarProviderUnavailable} onClick={()=>void perform(()=>api.advanceCampaignCalendar(campaign.campaignId,{deltaMinutes:1440,note:calendarNote||undefined}))}>+1일</button></div>
          <label className="campaign-wide-field"><span>현재 메모</span><input value={calendarNote} onChange={(event)=>setCalendarNote(event.target.value)} placeholder="여행, 야영 등"/><button disabled={busy} onClick={()=>void perform(()=>api.setCampaignCalendarNote(campaign.campaignId,calendarNote))}>메모 저장</button></label>
          <div className="campaign-compound-action"><div><strong>다음 날로 진행</strong><small>시간과 선택한 식량 소비를 하나의 저장으로 처리합니다.</small></div><label><input type="checkbox" checked={consumeWithDay&&campaign.rations.capability.enabled} disabled={!campaign.rations.capability.enabled} onChange={(event)=>setConsumeWithDay(event.target.checked)}/> 식량 {rationPreview?`${rationPreview.requiredUnits}식`:"계산 불가"} 함께 소비</label><button className="primary" disabled={busy||calendarProviderUnavailable||(consumeWithDay&&campaign.rations.capability.enabled&&!rationPreview)} onClick={()=>void perform(()=>api.advanceCampaignDay(campaign.campaignId,{consumeRations:consumeWithDay&&campaign.rations.capability.enabled,note:calendarNote||undefined}))}>미리보기대로 적용</button></div>
          <details className="campaign-date-time-editor"><summary>날짜와 시간 직접 설정</summary><div className="campaign-date-time-fields">
            <label><span>연호</span><input value={calendarEra} onChange={(event)=>setCalendarEra(event.target.value)} placeholder="예: 왕국력"/></label>
            {calendarStructuredDate&&<><label><span>연도</span><input type="number" min={1} step={1} value={calendarYear} disabled={calendarProviderUnavailable} onChange={(event)=>setCalendarYear(event.target.value)}/></label><label><span>월</span><select value={calendarMonth} disabled={calendarProviderUnavailable} onChange={(event)=>setCalendarMonth(event.target.value)}>{calendarMonths.length?calendarMonths.map((month)=><option key={month.id} value={month.id}>{month.label}</option>):<option value={calendarMonth}>{campaign.calendar.state.displayAnchor.monthLabel??calendarMonth}</option>}</select></label></>}
            <label><span>{calendarStructuredDate?"일":"Day"}</span><input type="number" min={1} step={1} value={calendarDay} disabled={calendarProviderUnavailable} onChange={(event)=>setCalendarDay(event.target.value)}/></label>
            <label><span>시</span><input type="number" min={0} max={23} step={1} value={calendarHour} disabled={calendarProviderUnavailable} onChange={(event)=>setCalendarHour(event.target.value)}/></label><label><span>분</span><input type="number" min={0} max={59} step={1} value={calendarMinute} disabled={calendarProviderUnavailable} onChange={(event)=>setCalendarMinute(event.target.value)}/></label>
            <label className="campaign-date-time-note"><span>수정 사유</span><input value={calendarNote} onChange={(event)=>setCalendarNote(event.target.value)} placeholder="필수"/></label>
            <button disabled={busy||calendarProviderUnavailable||!calendarEra.trim()||!calendarNote.trim()} onClick={()=>void perform(()=>api.correctCampaignCalendarDateTime(campaign.campaignId,{dateTime:{era:calendarEra,year:Number(calendarYear),monthId:calendarMonth,day:Number(calendarDay),hour:Number(calendarHour),minute:Number(calendarMinute)},note:calendarNote}))}>날짜·시간 적용</button>
          </div><small>날짜 문자열을 계산에 사용하지 않고 검증된 값을 절대 시간(분)으로 변환해 저장합니다.</small></details>
          {campaign.calendar.state.history.length>0&&<div className="campaign-calendar-history"><strong>최근 변경</strong>{campaign.calendar.state.history.slice(-4).reverse().map((entry)=><span key={entry.transactionId}>{entry.kind} · {entry.deltaMinutes>0?"+":""}{entry.deltaMinutes}분{entry.note?` · ${entry.note}`:""}</span>)}</div>}
          <button disabled={busy||calendarProviderUnavailable||!campaign.calendar.state.history.length} onClick={()=>void perform(()=>api.undoCampaignCalendar(campaign.campaignId))}>최근 시간 변경 되돌리기</button>
        </>}
      </section>

      <section className="campaign-system-panel" aria-labelledby="campaign-rations-title">
        <header><div><span>SUPPLIES</span><h3 id="campaign-rations-title">식량</h3></div><strong>{campaign.rations.ledger.balances.ration}식</strong></header>
        <div className="campaign-provider-row"><label><input type="checkbox" checked={campaign.rations.capability.enabled} disabled={busy||(!campaign.rations.capability.enabled&&rationProviderUnavailable)} onChange={(event)=>void perform(()=>toggleRations(event.target.checked))}/> 사용</label><select aria-label="식량 공급자" value={rationSelectValue} disabled={busy} onChange={(event)=>void perform(()=>selectRationProvider(event.target.value))}><option value="builtin.tracking-only">Tracking only</option>{rationProviderUnavailable&&<option value={rationSelectValue} disabled>현재 고정 · 사용할 수 없음 · v{campaign.rations.capability.providerVersion}</option>}{rationPinnedOlder&&selectedRationProvider&&<option value={providerOptionValue(selectedRationProvider)} disabled>현재 고정 · {selectedRationProvider.label} · v{selectedRationProvider.providerVersion}</option>}{rationProviders.map((provider)=><option key={`${provider.providerId}@${provider.providerVersion}`} value={providerOptionValue(provider)}>{provider.label} · v{provider.providerVersion}</option>)}{!rationProviders.length&&<option value="module.ration-profile" disabled>모듈 프로필 · 설치 필요</option>}</select></div>
        {rationProviderUnavailable&&<p className="campaign-off-note">현재 고정 식량 공급자를 찾을 수 없습니다: {campaign.rations.capability.providerId}@{campaign.rations.capability.providerVersion}. 공급자 없음은 세션·휴식·행동을 막지 않습니다. Tracking only를 선택하거나 모듈을 다시 설치하세요.</p>}
        {!campaign.rations.capability.enabled?<p className="campaign-off-note">식량 규칙이 꺼져 있습니다. 잔량과 기록은 유지되며 아무 행동도 차단하지 않습니다.</p>:<>
          {rationPreview&&<div className="campaign-ration-preview"><div><span>활성 소비자</span><strong>{rationPreview.memberCount}명</strong></div><div><span>하루 필요량</span><strong>{rationPreview.requiredUnits}식</strong></div><div><span>소비 후</span><strong>{rationPreview.availableUnits-rationPreview.consumedUnits}식</strong></div></div>}
          {rationPreview&&rationPreview.shortageUnits>0&&<p className="campaign-shortage" role="status">식량이 {rationPreview.shortageUnits}식 부족합니다. 경고만 기록하며 피해나 소진을 자동 적용하지 않습니다.</p>}
          {rationPreview&&rationPreview.shortageUnits>0&&selectedRationProfile?.shortageConsequences?.length&&<p className="campaign-off-note">DM 판정 제안 · {selectedRationProfile.shortageConsequences.join(" · ")} · 제안만 표시하며 Character 상태에는 자동 적용하지 않습니다.</p>}
          <div className="campaign-adjust-row"><input aria-label="식량 조정 수량" type="number" step={1} value={rationAdjustment} onChange={(event)=>setRationAdjustment(event.target.value)}/><button disabled={busy||Number(rationAdjustment)===0} onClick={()=>void perform(()=>api.adjustCampaignRations(campaign.campaignId,{amount:Number(rationAdjustment),note:"DM 수동 조정"}))}>식량 조정</button><button className="primary" disabled={busy||!rationPreview||rationPreview.requiredUnits===0} onClick={()=>void perform(()=>api.consumeCampaignDailyRations(campaign.campaignId))}>하루치 소비</button></div>
          <button disabled={busy||!campaign.rations.ledger.consumptionHistory.some((entry)=>entry.kind==="consume")} onClick={()=>void perform(()=>api.undoCampaignRationConsumption(campaign.campaignId))}>최근 소비 되돌리기</button>
        </>}
      </section>

      <section className="campaign-system-panel" aria-labelledby="campaign-stash-policy-title">
        <header><div><span>PARTY STASH</span><h3 id="campaign-stash-policy-title">파티 보관함 정책</h3></div><strong>{stashPolicyLabel(campaign.partyStash.policy)}</strong></header>
        <p className="campaign-panel-copy">플레이어의 보관함 입출고 권한을 Campaign 기본값으로 저장하고 다음 Session snapshot에도 동일하게 사용합니다.</p>
        <div className="campaign-provider-row"><label><span>출고 정책</span><select aria-label="Party Stash 정책" value={campaign.partyStash.policy} disabled={busy} onChange={(event)=>void configurePartyStashPolicy(event.target.value as PartyStashPolicy)}><option value="shared">공유 · Player 직접 입출고</option><option value="dm-approval">DM 승인 · 입고 직접 / 출고 승인 요청</option><option value="dm-managed">DM 관리 · Player 입출고 차단</option></select></label></div>
        <p className="campaign-off-note">{campaign.partyStash.policy==="shared"?"Player가 권한 범위 안에서 직접 입고와 출고를 수행합니다.":campaign.partyStash.policy==="dm-approval"?"Player 입고는 즉시 처리하고 출고는 DM 승인 요청으로 전환합니다. 승인 전에는 자산을 이동하지 않습니다.":"Player의 직접 입출고를 막고 DM이 보관함 이동을 관리합니다."}</p>
      </section>
    </div>

    <section className="campaign-system-panel campaign-dm-library-panel" aria-labelledby="campaign-dm-library-title">
      <header><div><span>PRIVATE LIBRARY</span><h3 id="campaign-dm-library-title">DM 라이브러리</h3></div><strong>{campaign.dmLibrary.entries.length}개 · Campaign 전용</strong></header>
      <p className="campaign-panel-copy">플레이어에게 원본이 투영되지 않는 캠페인 전용 준비물입니다. 아이템 지급, 이미지 공개, NPC Encounter 추가에 사용합니다.</p>
      <div className="campaign-dm-library-kinds" role="tablist" aria-label="DM 라이브러리 종류">
        <button role="tab" aria-selected={libraryKind==="custom-item"} className={libraryKind==="custom-item"?"active":""} onClick={()=>resetLibraryForm("custom-item")}>아이템 <b>{campaign.dmLibrary.entries.filter((entry)=>entry.kind==="custom-item").length}</b></button>
        <button role="tab" aria-selected={libraryKind==="image"} className={libraryKind==="image"?"active":""} onClick={()=>resetLibraryForm("image")}>이미지 <b>{campaign.dmLibrary.entries.filter((entry)=>entry.kind==="image").length}</b></button>
        <button role="tab" aria-selected={libraryKind==="npc-definition"} className={libraryKind==="npc-definition"?"active":""} onClick={()=>resetLibraryForm("npc-definition")}>NPC 액터 <b>{campaign.dmLibrary.entries.filter((entry)=>entry.kind==="npc-definition").length}</b></button>
      </div>
      <div className="campaign-dm-library-toolbar"><input value={libraryQuery} onChange={(event)=>setLibraryQuery(event.target.value)} placeholder="이름·태그·Definition 검색" aria-label="DM 라이브러리 검색"/><button onClick={()=>resetLibraryForm()}>{libraryKind==="custom-item"?"새 아이템":libraryKind==="image"?"새 이미지":"새 NPC 액터"}</button><button onClick={()=>{setJsonImportOpen((open)=>!open);setJsonPreview(null);setJsonError(null);}}>JSON 가져오기</button></div>
      {jsonImportOpen&&<section className="campaign-library-json-import" aria-label="DM 라이브러리 JSON 가져오기"><div><strong>JSON 가져오기</strong><small>단일 객체 또는 최대 100개의 배열 · 아이템과 NPC 액터 지원</small></div><textarea aria-label="DM 라이브러리 JSON" value={jsonPayload} onChange={(event)=>{setJsonPayload(event.target.value);setJsonPreview(null);setJsonError(null);}} spellCheck={false}/><div className="campaign-library-json-actions"><button disabled={busy} onClick={previewLibraryJson}>JSON 검토</button><button className="primary" disabled={busy||!jsonPreview} onClick={()=>void importLibraryJson()}>검토한 항목 저장</button></div>{jsonError&&<p className="campaign-library-json-error" role="alert">{jsonError}</p>}{jsonPreview&&<div className="campaign-library-json-preview"><strong>{jsonPreview.length}개 항목 검증 완료</strong>{jsonPreview.map((entry)=><article key={entry.entryId}><span>{entry.kind==="custom-item"?"아이템":"NPC"}</span><div><b>{entry.label}</b><small>{entry.definitionId}</small></div>{entry.itemTemplate&&<small>{entry.itemTemplate.kind}{entry.itemTemplate.attunementRequired?" · 조율 필요":""}{entry.itemTemplate.charges?` · 충전 ${entry.itemTemplate.charges.current}/${entry.itemTemplate.charges.max}`:""}{` · 특성 ${entry.itemTemplate.passiveEffects.length} · 행동 ${entry.itemTemplate.grantedActionIds.length}`}</small>}{entry.npcDefinition&&<small>AC {entry.npcDefinition.ac} · HP {entry.npcDefinition.maxHp} · 행동 {entry.npcDefinition.actions.length}</small>}</article>)}</div>}</section>}
      <div className="campaign-dm-library-form">
        <label><span>이름</span><input value={itemName} onChange={(event)=>setItemName(event.target.value)} placeholder="예: 별빛 부적"/></label>
        {libraryKind!=="image"&&<label><span>영문명</span><input value={itemNameEn} onChange={(event)=>setItemNameEn(event.target.value)} placeholder="선택"/></label>}
        {libraryKind!=="image"&&<label><span>Definition ID</span><input value={itemDefinitionId} onChange={(event)=>setItemDefinitionId(event.target.value)} placeholder="비우면 자동 생성"/></label>}
        {libraryKind==="custom-item"&&<label><span>종류</span><select value={itemKind} onChange={(event)=>setItemKind(event.target.value as CampaignPartyStashItemTemplate["kind"])}><option value="equipment">장비</option><option value="consumable">소모품</option><option value="magic">마법 아이템</option></select></label>}
        {libraryKind==="image"&&<label className="campaign-library-file"><span>PNG / JPEG / WebP · 최대 4 MiB</span><input type="file" accept={LOCAL_IMAGE_ACCEPT} onChange={(event)=>void chooseLibraryImage(event.target.files?.[0])}/></label>}
        {libraryKind==="npc-definition"&&<><label><span>AC</span><input type="number" min={0} step={1} value={npcAc} onChange={(event)=>setNpcAc(event.target.value)}/></label><label><span>최대 HP</span><input type="number" min={1} step={1} value={npcHp} onChange={(event)=>setNpcHp(event.target.value)}/></label><label><span>행동 · 쉼표 구분</span><input value={npcActions} onChange={(event)=>setNpcActions(event.target.value)} placeholder="단검, 숏보우"/></label></>}
        <label><span>태그</span><input value={itemTags} onChange={(event)=>setItemTags(event.target.value)} placeholder="보물, 회복, 퀘스트"/></label>
        <button className="primary" disabled={busy||!itemName.trim()||(libraryKind==="image"&&!imageAsset)} onClick={()=>void saveLibrary()}>{editingLibraryId?"수정 저장":"라이브러리에 추가"}</button>
      </div>
      {libraryKind==="image"&&imageAsset&&<figure className="campaign-library-image-preview"><img src={imageAsset.dataUrl} alt="DM 라이브러리 이미지 미리보기"/><figcaption>{imageAsset.fileName??itemName} · {(imageAsset.byteLength/1024).toFixed(0)} KiB</figcaption></figure>}
      <div className="campaign-dm-library-list">
        {visibleLibrary.map((entry)=><article key={entry.entryId}><span className="campaign-library-thumb">{entry.imageAsset?<img src={entry.imageAsset.dataUrl} alt=""/>:<b>{entry.kind==="npc-definition"?"NPC":"IT"}</b>}</span><button className={entry.favorite?"favorite active":"favorite"} aria-label={`${entry.label} 즐겨찾기`} onClick={()=>void perform(()=>api.upsertCampaignDmLibraryEntry(campaign.campaignId,{...entry,favorite:!entry.favorite}))}>★</button><div><strong>{entry.label}</strong><small>{entry.kind==="npc-definition"?`AC ${entry.npcDefinition?.ac} · HP ${entry.npcDefinition?.maxHp}`:entry.imageAsset?`${(entry.imageAsset.byteLength/1024).toFixed(0)} KiB`:entry.itemTemplate?.kind??entry.kind}{entry.definitionId?` · ${entry.definitionId}`:""}{entry.tags?.length?` · ${entry.tags.join(" · ")}`:""}</small></div><button onClick={()=>editLibrary(entry)}>수정</button><button onClick={()=>void perform(()=>duplicateLibrary(entry))}>복제</button><button className="danger-action" onClick={()=>void perform(()=>api.removeCampaignDmLibraryEntry(campaign.campaignId,entry.entryId))}>삭제</button></article>)}
        {!visibleLibrary.length&&<p className="campaign-inline-empty">이 종류에 저장된 항목이 없습니다.</p>}
      </div>
    </section>

    <section className="campaign-system-panel" aria-labelledby="campaign-history-title">
      <header><div><span>JOURNAL</span><h3 id="campaign-history-title">세션 기록</h3></div><strong>최근 {campaign.sessionHistory.length}회</strong></header>
      {!campaign.sessionHistory.length?<p className="campaign-inline-empty">종료된 세션 요약이 아직 없습니다.</p>:<div className="campaign-history-list">{[...campaign.sessionHistory].reverse().map((summary)=><article key={summary.sessionId}><div><strong>{summary.title??summary.name??"이름 없는 세션"}</strong><small>{(summary.participantLabels??[]).join(" · ")||`${summary.participantCount??0}명`}</small></div><span>{summary.calendarBefore&&summary.calendarAfter?`${summary.calendarBefore} → ${summary.calendarAfter}`:"달력 기록 없음"}</span><span>{summary.rationDelta!==undefined?`식량 ${summary.rationDelta>0?"+":""}${summary.rationDelta}`:"식량 기록 없음"}</span>{(summary.dmNote??summary.summary)&&<p>{summary.dmNote??summary.summary}</p>}</article>)}</div>}
    </section>
  </div>;
}
