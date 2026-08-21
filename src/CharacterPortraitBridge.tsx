import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import { updateActiveCharacterPortrait } from "./app/characterLibraryRuntimeAdapter";
import { sanitizeCharacterPortrait, type CharacterPortraitV1 } from "./app/characterPortraitContracts";
import { LOCAL_IMAGE_ACCEPT, PORTRAIT_IMAGE_MAX_BYTES, readLocalImageFile } from "./app/localImageAsset";

function usePortraitTarget() {
  const [target,setTarget]=useState<Element|null>(null);
  useEffect(()=>{
    const resolve=()=>setTarget(document.querySelector(".sheet-play-toolbar, .official-identity-grid"));
    resolve();
    const observer=new MutationObserver(resolve);
    observer.observe(document.body,{childList:true,subtree:true});
    return ()=>observer.disconnect();
  },[]);
  return target;
}

export function CharacterPortraitBridge() {
  const {snapshot,refresh}=useSimpleVtt();
  const target=usePortraitTarget();
  const character=snapshot?.activeCharacter;
  const persisted=useMemo(()=>sanitizeCharacterPortrait(character?.portrait),[character?.portrait]);
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState<CharacterPortraitV1|undefined>(persisted);
  const [error,setError]=useState("");

  useEffect(()=>{ setDraft(persisted); setEditing(false); setError(""); },[character?.id,persisted?.asset.dataUrl,persisted?.focalX,persisted?.focalY]);
  if (!target||!character) return null;
  const shown=editing?draft:persisted;
  const initials=character.name.trim().slice(0,2)||"PC";

  const choose=async(file:File|undefined)=>{
    if (!file) return;
    try {
      const asset=await readLocalImageFile(file,PORTRAIT_IMAGE_MAX_BYTES);
      setDraft({asset,focalX:persisted?.focalX??.5,focalY:persisted?.focalY??.5});
      setError("");
      setEditing(true);
    } catch(reason) { setError(reason instanceof Error?reason.message:String(reason)); }
  };
  const save=async()=>{
    if (!draft) return;
    try { await updateActiveCharacterPortrait(mockAdapter,draft); await refresh(); setEditing(false); setError(""); }
    catch(reason) { setError(reason instanceof Error?reason.message:String(reason)); }
  };
  const remove=async()=>{
    try { await updateActiveCharacterPortrait(mockAdapter,null); await refresh(); setDraft(undefined); setEditing(false); setError(""); }
    catch(reason) { setError(reason instanceof Error?reason.message:String(reason)); }
  };

  return createPortal(<section className="character-portrait-card" aria-label="캐릭터 초상화">
    <div className="character-portrait-frame">{shown?<img src={shown.asset.dataUrl} alt={`${character.name} 초상화`} style={{objectPosition:`${shown.focalX*100}% ${shown.focalY*100}%`}}/>:<span>{initials}</span>}</div>
    <div className="character-portrait-actions">
      <button type="button" onClick={()=>setEditing((value)=>!value)}>{persisted?"사진 조정":"사진 추가"}</button>
      {persisted&&<button type="button" onClick={remove}>제거</button>}
    </div>
    {editing&&<div className="character-portrait-editor">
      <strong>Character Portrait</strong>
      <label className="portrait-file">사진 선택 / 교체<input type="file" accept={LOCAL_IMAGE_ACCEPT} onChange={(event)=>void choose(event.target.files?.[0])}/></label>
      {draft&&<>
        <label>가로 초점 <input type="range" min="0" max="100" value={Math.round(draft.focalX*100)} onChange={(event)=>setDraft({...draft,focalX:Number(event.target.value)/100})}/></label>
        <label>세로 초점 <input type="range" min="0" max="100" value={Math.round(draft.focalY*100)} onChange={(event)=>setDraft({...draft,focalY:Number(event.target.value)/100})}/></label>
        <small>프레임 안에서 보일 위치만 조정합니다. 원본 이미지는 다시 인코딩하지 않습니다.</small>
      </>}
      {error&&<p className="portrait-error">{error}</p>}
      <div><button type="button" onClick={()=>{setDraft(persisted);setEditing(false);setError("");}}>취소</button><button type="button" className="primary" disabled={!draft} onClick={save}>저장</button></div>
    </div>}
  </section>,target);
}
