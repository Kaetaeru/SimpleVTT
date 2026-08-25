import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { CatalogEntry, CombatantDefinitionVm } from "./app/contracts";
import type { CampaignDmLibraryEntry, CampaignPartyStashItemTemplate } from "./app/campaignPersistenceContracts";
import "./app/campaignDmLibraryOrganizationContracts";
import { CAMPAIGN_DM_LIBRARY_JSON_EXAMPLE, parseCampaignDmLibraryJson } from "./app/campaignDmLibraryImport";
import { HANDOUT_IMAGE_MAX_BYTES, LOCAL_IMAGE_ACCEPT, readLocalImageFile, type LocalImageAssetV1 } from "./app/localImageAsset";
import "./session-dm-library.css";

type AddMode="search"|"json"|"image";
export type SessionDmLibraryDropPayload={campaignId:string;entryId:string;kind:CampaignDmLibraryEntry["kind"]};
type SourceCandidate=
  | {key:string;kind:"custom-item";label:string;nameEn:string;source:string;scope:CatalogEntry["scope"];definitionId:string;catalog:CatalogEntry}
  | {key:string;kind:"npc-definition";label:string;nameEn:string;source:string;scope:"builtin"|"local";definitionId:string;definition:CombatantDefinitionVm};

function localId(prefix:string){return `${prefix}.${globalThis.crypto?.randomUUID?.()??Date.now()}.${Math.floor(Math.random()*1_000_000).toString(36)}`;}
function kindLabel(kind:CampaignDmLibraryEntry["kind"]){return kind==="custom-item"?"아이템":kind==="image"?"이미지":kind==="npc-definition"?"NPC":kind==="pc-preset"?"PC Actor":"노트";}
function canDrop(entry:CampaignDmLibraryEntry){return entry.kind!=="note";}
function entryMeta(entry:CampaignDmLibraryEntry){
  if(entry.kind==="image"&&entry.imageAsset)return `${(entry.imageAsset.byteLength/1024).toFixed(0)} KiB · 플레이어에게 공개`;
  if(entry.kind==="npc-definition"&&entry.npcDefinition)return `AC ${entry.npcDefinition.ac} · HP ${entry.npcDefinition.maxHp} · 장면에 소환`;
  if(entry.kind==="pc-preset"&&entry.pcPreset)return `Lv.${entry.pcPreset.level} · AC ${entry.pcPreset.ac} · 장면에 소환`;
  if(entry.kind==="custom-item"&&entry.itemTemplate)return `${entry.itemTemplate.kind} · Character에게 지급`;
  if(entry.kind==="note")return "DM 전용 노트 · 드래그 실행 없음";
  return entry.definitionId??entry.kind;
}
function catalogDefinitionId(entry:CatalogEntry){return (entry as CatalogEntry&{contentId?:string}).contentId??entry.id;}
function catalogItemKind(entry:CatalogEntry):CampaignPartyStashItemTemplate["kind"]{
  const text=`${entry.id} ${entry.nameKo} ${entry.nameEn} ${entry.description}`;
  if(/potion|poison|scroll|ammunition|물약|독|두루마리|탄약|소모/i.test(text))return "consumable";
  if(/magic|wand|staff|ring|rod|artifact|마법|완드|지팡이|반지|유물/i.test(text))return "magic";
  return "equipment";
}

export function SessionDmLibraryPane({onClose,onDragStateChange,onDrop}:{onClose():void;onDragStateChange(active:boolean):void;onDrop(payload:SessionDmLibraryDropPayload,clientX:number,clientY:number):void}){
  const api=useSimpleVtt();
  const snapshot=api.snapshot;
  const [query,setQuery]=useState("");
  const [creatorOpen,setCreatorOpen]=useState(false);
  const [addMode,setAddMode]=useState<AddMode>("search");
  const [sourceQuery,setSourceQuery]=useState("");
  const [imageName,setImageName]=useState("");
  const [imageAsset,setImageAsset]=useState<LocalImageAssetV1|null>(null);
  const [jsonPayload,setJsonPayload]=useState(CAMPAIGN_DM_LIBRARY_JSON_EXAMPLE);
  const [jsonPreview,setJsonPreview]=useState<CampaignDmLibraryEntry[]|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const pointerDrag=useRef<{pointerId:number;startX:number;startY:number;payload:SessionDmLibraryDropPayload;active:boolean}|null>(null);
  const ignoreClick=useRef(false);
  if(!snapshot||snapshot.session.role!=="host")return null;
  const campaignId=snapshot.campaignSessionSnapshot?.campaignId??snapshot.activeCampaignId??null;
  const campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===campaignId)??null;
  const recentRank=new Map((campaign?.dmLibrary.recentEntryIds??[]).map((id,index)=>[id,index]));
  const normalized=query.trim().toLocaleLowerCase("ko-KR");
  const entries=[...(campaign?.dmLibrary.entries??[])]
    .filter((entry)=>!normalized||`${entry.label} ${entry.definitionId??""} ${(entry.tags??[]).join(" ")} ${kindLabel(entry.kind)}`.toLocaleLowerCase("ko-KR").includes(normalized))
    .sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||(recentRank.get(a.entryId)??999)-(recentRank.get(b.entryId)??999)||(b.updatedAt??"").localeCompare(a.updatedAt??"")||a.label.localeCompare(b.label,"ko-KR"));
  const existingDefinitions=new Set((campaign?.dmLibrary.entries??[]).map((entry)=>entry.definitionId).filter((value):value is string=>Boolean(value)));
  const sourceNormalized=sourceQuery.trim().toLocaleLowerCase("ko-KR");
  const sourceCandidates:SourceCandidate[]=[
    ...snapshot.catalog.filter((entry)=>entry.category==="item").map((entry)=>({key:`item:${entry.id}`,kind:"custom-item" as const,label:entry.nameKo,nameEn:entry.nameEn,source:entry.source,scope:entry.scope,definitionId:catalogDefinitionId(entry),catalog:entry})),
    ...snapshot.combatantDefinitions.map((definition)=>({key:`npc:${definition.id}`,kind:"npc-definition" as const,label:definition.name,nameEn:definition.nameEn??"",source:definition.source,scope:(/SRD|official|공식/i.test(definition.source)?"builtin":"local") as "builtin"|"local",definitionId:definition.id,definition})),
  ].filter((candidate)=>!sourceNormalized||`${candidate.label} ${candidate.nameEn} ${candidate.source} ${candidate.definitionId} ${candidate.kind}`.toLocaleLowerCase("ko-KR").includes(sourceNormalized))
    .sort((a,b)=>Number(a.scope==="builtin")-Number(b.scope==="builtin")||a.label.localeCompare(b.label,"ko-KR"))
    .slice(0,80);

  const chooseImage=async(file:File|undefined)=>{
    if(!file)return;
    try{const asset=await readLocalImageFile(file,HANDOUT_IMAGE_MAX_BYTES);setImageAsset(asset);setImageName((current)=>current||asset.fileName?.replace(/\.[^.]+$/,"")||"이미지");setError(null);}catch(reason){setImageAsset(null);setError(reason instanceof Error?reason.message:"이미지를 읽지 못했습니다.");}
  };
  const closeCreator=()=>{setCreatorOpen(false);setError(null);setJsonPreview(null);};
  const openCreator=()=>{setCreatorOpen(true);setAddMode("search");setSourceQuery("");setError(null);setJsonPreview(null);};
  const addSource=async(candidate:SourceCandidate)=>{
    if(!campaign||busy||existingDefinitions.has(candidate.definitionId))return;
    setBusy(true);setError(null);
    try{
      if(candidate.kind==="custom-item"){
        const entry=candidate.catalog;
        await api.upsertCampaignDmLibraryEntry(campaign.campaignId,{entryId:localId("dm-library"),kind:"custom-item",label:candidate.label,definitionId:candidate.definitionId,itemTemplate:{definitionId:candidate.definitionId,name:candidate.label,nameEn:candidate.nameEn||undefined,kind:catalogItemKind(entry),passiveEffects:entry.description?[entry.description]:[],grantedActionIds:[],provenance:[`${entry.source} · v${entry.version}`]}});
      }else{
        const definition=candidate.definition;
        await api.upsertCampaignDmLibraryEntry(campaign.campaignId,{entryId:localId("dm-library"),kind:"npc-definition",label:candidate.label,definitionId:candidate.definitionId,npcDefinition:{definitionId:definition.id,name:definition.name,nameEn:definition.nameEn,ac:definition.ac,maxHp:definition.maxHp,actions:[...definition.actions],statusImmunities:[...definition.statusImmunities],source:definition.source,version:definition.version}});
      }
    }catch(reason){setError(reason instanceof Error?reason.message:"검색 항목을 추가하지 못했습니다.");}finally{setBusy(false);}
  };
  const previewJson=()=>{
    if(!campaign)return;
    try{setJsonPreview(parseCampaignDmLibraryJson(jsonPayload,{campaignId:campaign.campaignId,campaignName:campaign.name,createEntryId:()=>localId("dm-library-json")}));setError(null);}catch(reason){setJsonPreview(null);setError(reason instanceof Error?reason.message:"JSON을 검토하지 못했습니다.");}
  };
  const importJson=async()=>{
    if(!campaign||!jsonPreview||busy)return;
    setBusy(true);setError(null);
    try{for(const entry of jsonPreview)await api.upsertCampaignDmLibraryEntry(campaign.campaignId,entry);setJsonPreview(null);setJsonPayload(CAMPAIGN_DM_LIBRARY_JSON_EXAMPLE);setCreatorOpen(false);}catch(reason){setError(reason instanceof Error?reason.message:"JSON 항목을 저장하지 못했습니다.");}finally{setBusy(false);}
  };
  const saveImage=async()=>{
    if(!campaign||!imageAsset||!imageName.trim()||busy)return;
    setBusy(true);setError(null);
    try{await api.upsertCampaignDmLibraryEntry(campaign.campaignId,{entryId:localId("dm-library-image"),kind:"image",label:imageName.trim(),imageAsset});setImageName("");setImageAsset(null);setCreatorOpen(false);}catch(reason){setError(reason instanceof Error?reason.message:"이미지를 저장하지 못했습니다.");}finally{setBusy(false);}
  };
  const beginPointerDrag=(event:PointerEvent<HTMLElement>,entry:CampaignDmLibraryEntry)=>{
    if(event.button!==0||!campaign||!canDrop(entry))return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDrag.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,payload:{campaignId:campaign.campaignId,entryId:entry.entryId,kind:entry.kind},active:false};
  };
  const movePointerDrag=(event:PointerEvent<HTMLElement>)=>{
    const drag=pointerDrag.current;
    if(!drag||drag.pointerId!==event.pointerId)return;
    if(!drag.active&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>=5){drag.active=true;ignoreClick.current=true;onDragStateChange(true);}
    if(drag.active)event.preventDefault();
  };
  const finishPointerDrag=(event:PointerEvent<HTMLElement>)=>{
    const drag=pointerDrag.current;
    if(!drag||drag.pointerId!==event.pointerId)return;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    pointerDrag.current=null;
    onDragStateChange(false);
    if(drag.active)onDrop(drag.payload,event.clientX,event.clientY);
  };
  const cancelPointerDrag=(event:PointerEvent<HTMLElement>)=>{if(pointerDrag.current?.pointerId!==event.pointerId)return;pointerDrag.current=null;onDragStateChange(false);};
  const selectByKeyboard=(event:KeyboardEvent<HTMLElement>,entryId:string)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();setSelectedId((current)=>current===entryId?null:entryId);}};

  return <aside className="session-dm-library-pane" aria-label="DM 라이브러리">
    <header className="session-dm-library-head"><div><span>PRIVATE LIBRARY</span><strong>DM 라이브러리</strong><small>{campaign?.name??"활성 캠페인 없음"} · {campaign?.dmLibrary.entries.length??0}개</small></div><div><button type="button" className="primary" disabled={!campaign} onClick={openCreator}>＋ 추가</button><button type="button" aria-label="DM 라이브러리 닫기" onClick={onClose}>×</button></div></header>
    <p className="session-dm-library-guide">항목을 플레이 공간으로 드래그하세요. Actor는 소환되고, 이미지는 공개되며, 아이템은 놓은 Character에게 지급됩니다.</p>
    <div className="session-dm-library-search"><input autoFocus={!creatorOpen} value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="전체 라이브러리 검색" aria-label="DM 라이브러리 전체 검색"/></div>
    {error&&!creatorOpen&&<p className="session-dm-library-error" role="alert">{error}</p>}
    <div className="session-dm-library-list" role="list" aria-label="분류 없는 DM 라이브러리 목록">
      {entries.map((entry)=>{const selected=selectedId===entry.entryId;return <article key={entry.entryId} role="listitem" tabIndex={0} data-library-entry-id={entry.entryId} data-library-kind={entry.kind} className={`${selected?"selected ":""}${canDrop(entry)?"draggable":"note"}`.trim()} onPointerDown={(event)=>beginPointerDrag(event,entry)} onPointerMove={movePointerDrag} onPointerUp={finishPointerDrag} onPointerCancel={cancelPointerDrag} onClick={()=>{if(ignoreClick.current){ignoreClick.current=false;return;}setSelectedId((current)=>current===entry.entryId?null:entry.entryId);}} onKeyDown={(event)=>selectByKeyboard(event,entry.entryId)}>
        <span className="session-dm-library-thumb">{entry.imageAsset?<img draggable={false} src={entry.imageAsset.dataUrl} alt=""/>:<b>{entry.kind==="npc-definition"||entry.kind==="pc-preset"?"ACT":entry.kind==="custom-item"?"ITM":"TXT"}</b>}</span>
        <div><small>{kindLabel(entry.kind)}{entry.favorite?" · ★":""}</small><strong>{entry.label}</strong><span>{entryMeta(entry)}</span>{selected&&entry.noteText&&<p>{entry.noteText}</p>}{selected&&entry.tags?.length?<em>{entry.tags.join(" · ")}</em>:null}</div>
        {canDrop(entry)&&<i aria-hidden="true">⠿</i>}
      </article>;})}
      {!entries.length&&<p className="session-dm-library-empty">{campaign?"저장된 항목이 없습니다. 추가 버튼에서 공식·커스텀 콘텐츠를 검색하거나 JSON을 붙여 넣으세요.":"세션에 연결된 캠페인이 없습니다."}</p>}
    </div>

    {creatorOpen&&<section className="session-dm-library-add-dialog" role="dialog" aria-modal="true" aria-label="DM 라이브러리에 추가">
      <header><div><span>ADD TO LIBRARY</span><strong>준비물 추가</strong><small>공식·커스텀 콘텐츠 검색 또는 JSON 직접 입력</small></div><button type="button" aria-label="라이브러리 추가 창 닫기" onClick={closeCreator}>×</button></header>
      <nav aria-label="라이브러리 추가 방식"><button type="button" className={addMode==="search"?"active":""} onClick={()=>{setAddMode("search");setError(null);}}>콘텐츠 검색</button><button type="button" className={addMode==="json"?"active":""} onClick={()=>{setAddMode("json");setError(null);}}>커스텀 JSON</button><button type="button" className={addMode==="image"?"active":""} onClick={()=>{setAddMode("image");setError(null);}}>이미지</button></nav>
      {addMode==="search"&&<div className="session-dm-library-source-search">
        <input autoFocus value={sourceQuery} onChange={(event)=>setSourceQuery(event.target.value)} placeholder="공식 아이템·커스텀 아이템·NPC 스탯블럭 검색" aria-label="추가할 콘텐츠 검색"/>
        <small>설치된 공식 콘텐츠와 로컬/세션 커스텀 콘텐츠를 한 목록에서 검색합니다.</small>
        <div role="list" aria-label="추가 가능한 아이템과 NPC">
          {sourceCandidates.map((candidate)=>{const added=existingDefinitions.has(candidate.definitionId);return <article role="listitem" key={candidate.key}><span>{candidate.kind==="custom-item"?"ITM":"NPC"}</span><div><strong>{candidate.label}</strong><small>{candidate.nameEn&&`${candidate.nameEn} · `}{candidate.source}</small>{candidate.kind==="npc-definition"&&<em>AC {candidate.definition.ac} · HP {candidate.definition.maxHp} · {candidate.definition.actions.join(" · ")||"행동 없음"}</em>}{candidate.kind==="custom-item"&&<em>{candidate.catalog.description||candidate.definitionId}</em>}</div><button type="button" disabled={busy||added} onClick={()=>void addSource(candidate)}>{added?"추가됨":"라이브러리에 추가"}</button></article>;})}
          {!sourceCandidates.length&&<p>일치하는 아이템이나 NPC 스탯블럭이 없습니다.</p>}
        </div>
      </div>}
      {addMode==="json"&&<div className="session-dm-library-json-import">
        <p>아이템 또는 NPC 객체 하나, 혹은 최대 100개의 배열을 붙여 넣을 수 있습니다. 특성·충전·조율·행동도 보존합니다.</p>
        <textarea autoFocus aria-label="DM 라이브러리 커스텀 JSON" value={jsonPayload} onChange={(event)=>{setJsonPayload(event.target.value);setJsonPreview(null);setError(null);}} spellCheck={false}/>
        <div className="actions"><button type="button" disabled={busy} onClick={previewJson}>JSON 검토</button><button type="button" className="primary" disabled={busy||!jsonPreview} onClick={()=>void importJson()}>{busy?"저장 중…":"검토한 항목 저장"}</button></div>
        {jsonPreview&&<div className="preview"><strong>{jsonPreview.length}개 항목 검증 완료</strong>{jsonPreview.map((entry)=><span key={entry.entryId}>{kindLabel(entry.kind)} · {entry.label} · {entry.definitionId}</span>)}</div>}
      </div>}
      {addMode==="image"&&<div className="session-dm-library-image-add"><label><span>표시 이름</span><input autoFocus value={imageName} onChange={(event)=>setImageName(event.target.value)} placeholder="예: 고대 유적 지도"/></label><label className="file"><span>PNG / JPEG / WebP · 최대 4 MiB</span><input type="file" accept={LOCAL_IMAGE_ACCEPT} onChange={(event)=>void chooseImage(event.target.files?.[0])}/></label>{imageAsset&&<figure><img src={imageAsset.dataUrl} alt="추가할 이미지 미리보기"/><figcaption>{imageAsset.fileName} · {(imageAsset.byteLength/1024).toFixed(0)} KiB</figcaption></figure>}<button type="button" className="primary" disabled={busy||!imageAsset||!imageName.trim()} onClick={()=>void saveImage()}>{busy?"저장 중…":"이미지 저장"}</button></div>}
      {error&&<p className="session-dm-library-error" role="alert">{error}</p>}
    </section>}
  </aside>;
}
