import { useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { CampaignDmLibraryEntry, CampaignRecordV1 } from "./app/campaignPersistenceContracts";
import "./app/campaignDmLibraryOrganizationContracts";

function localId(){return `dm-note.${globalThis.crypto?.randomUUID?.()??`${Date.now()}.${Math.floor(Math.random()*1_000_000)}`}`;}
function csv(value:string){return [...new Set(value.split(",").map((item)=>item.trim()).filter(Boolean))];}

export function CampaignDmLibraryNotePanel({campaign}:{campaign:CampaignRecordV1}){
  const api=useSimpleVtt();
  const folders=campaign.dmLibrary.folders??[];
  const [editingId,setEditingId]=useState<string|null>(null);
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [tags,setTags]=useState("");
  const [folderId,setFolderId]=useState("");
  const [search,setSearch]=useState("");
  const [folderFilter,setFolderFilter]=useState("all");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  const perform=async(operation:()=>Promise<void>)=>{setBusy(true);setError(null);try{await operation();}catch(reason){setError(reason instanceof Error?reason.message:"DM 노트 작업을 완료하지 못했습니다.");}finally{setBusy(false);}};
  const reset=()=>{setEditingId(null);setTitle("");setBody("");setTags("");setFolderId("");};
  const edit=(entry:CampaignDmLibraryEntry)=>{if(entry.kind!=="note"||!entry.noteText)return;setEditingId(entry.entryId);setTitle(entry.label);setBody(entry.noteText);setTags((entry.tags??[]).join(", "));setFolderId(entry.folderId??"");};
  const save=()=>perform(async()=>{
    const label=title.trim(),noteText=body.trim();
    if(!label)throw new Error("노트 제목을 입력하세요.");
    if(!noteText)throw new Error("노트 내용을 입력하세요.");
    const previous=editingId?campaign.dmLibrary.entries.find((entry)=>entry.entryId===editingId&&entry.kind==="note"):undefined;
    await api.upsertCampaignDmLibraryEntry(campaign.campaignId,{entryId:previous?.entryId??localId(),kind:"note",label,noteText,folderId:folderId||undefined,favorite:previous?.favorite??false,tags:csv(tags)});
    reset();
  });
  const remove=(entryId:string)=>perform(async()=>{await api.removeCampaignDmLibraryEntry(campaign.campaignId,entryId);if(editingId===entryId)reset();});
  const toggleFavorite=(entry:CampaignDmLibraryEntry)=>perform(()=>api.upsertCampaignDmLibraryEntry(campaign.campaignId,{...entry,favorite:!entry.favorite}));

  const notes=useMemo(()=>{
    const query=search.trim().toLocaleLowerCase("ko-KR");
    return campaign.dmLibrary.entries.filter((entry)=>entry.kind==="note"&&entry.noteText)
      .filter((entry)=>folderFilter==="all"?true:folderFilter==="root"?!entry.folderId:entry.folderId===folderFilter)
      .filter((entry)=>!query||[entry.label,entry.noteText??"",...(entry.tags??[])].join(" ").toLocaleLowerCase("ko-KR").includes(query))
      .sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||a.label.localeCompare(b.label,"ko-KR"));
  },[campaign.dmLibrary.entries,folderFilter,search]);

  return <section className="campaign-capability-note" aria-label="DM 라이브러리 비공개 노트">
    <span>DM LIBRARY NOTES</span><strong>비공개 DM 노트</strong>
    <p>노트 원문은 Host Campaign에만 저장됩니다. Session Player projection에는 전달하지 않습니다.</p>

    <label><span>노트 검색</span><input value={search} disabled={busy} onChange={(event)=>setSearch(event.target.value)} placeholder="제목 · 내용 · 태그 검색"/></label>
    <label><span>폴더 보기</span><select value={folderFilter} disabled={busy} onChange={(event)=>setFolderFilter(event.target.value)}><option value="all">전체</option><option value="root">최상위</option>{folders.map((folder)=><option key={folder.folderId} value={folder.folderId}>{folder.label}</option>)}</select></label>

    <div className="campaign-identity-lock"><span>NOTE</span><strong>{editingId?"노트 수정":"새 DM 노트"}</strong><small>기존 DM Library 폴더·태그·즐겨찾기 경계를 그대로 사용합니다.</small></div>
    <label><span>제목</span><input value={title} disabled={busy} onChange={(event)=>setTitle(event.target.value)} placeholder="예: 다음 세션 비밀"/></label>
    <label><span>내용</span><textarea value={body} disabled={busy} onChange={(event)=>setBody(event.target.value)} placeholder="플레이어에게 공개되지 않는 DM 메모" rows={5}/></label>
    <label><span>폴더</span><select value={folderId} disabled={busy} onChange={(event)=>setFolderId(event.target.value)}><option value="">최상위</option>{folders.map((folder)=><option key={folder.folderId} value={folder.folderId}>{folder.label}</option>)}</select></label>
    <label><span>태그</span><input value={tags} disabled={busy} onChange={(event)=>setTags(event.target.value)} placeholder="쉼표로 구분"/></label>
    <button type="button" className="primary" disabled={busy||!title.trim()||!body.trim()} onClick={()=>void save()}>{busy?"저장 중…":editingId?"노트 수정 저장":"노트 저장"}</button>
    {editingId&&<button type="button" disabled={busy} onClick={reset}>수정 취소</button>}

    {notes.length?<div className="campaign-option-list">{notes.map((entry)=><div key={entry.entryId}><span><strong>{entry.favorite?"★ ":""}{entry.label}</strong><small>{entry.folderId?folders.find((folder)=>folder.folderId===entry.folderId)?.label??"알 수 없는 폴더":"최상위"}{entry.tags?.length?` · ${entry.tags.join(" · ")}`:""}</small><p>{entry.noteText}</p></span><button type="button" disabled={busy} onClick={()=>void toggleFavorite(entry)}>{entry.favorite?"즐겨찾기 해제":"즐겨찾기"}</button><button type="button" disabled={busy} onClick={()=>edit(entry)}>수정</button><button type="button" disabled={busy} onClick={()=>void remove(entry.entryId)}>삭제</button></div>)}</div>:<p>조건에 맞는 DM 노트가 없습니다.</p>}
    {error&&<div className="campaign-error" role="alert">{error}</div>}
  </section>;
}
