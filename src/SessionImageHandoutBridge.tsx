import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import { HANDOUT_IMAGE_MAX_BYTES, LOCAL_IMAGE_ACCEPT, readLocalImageFile, type LocalImageAssetV1 } from "./app/localImageAsset";
import {
  dismissSessionImageHandout,
  getSessionImageHandoutState,
  reopenSessionImageHandout,
  revealSessionImageHandout,
  subscribeSessionImageHandout,
  withdrawSessionImageHandout,
} from "./app/sessionImageHandoutRuntimeAdapter";

export function SessionImageHandoutBridge() {
  const {snapshot}=useSimpleVtt();
  const [handout,setHandout]=useState(()=>getSessionImageHandoutState(mockAdapter));
  const [open,setOpen]=useState(false);
  const [draft,setDraft]=useState<LocalImageAssetV1|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>subscribeSessionImageHandout(mockAdapter,setHandout),[]);
  if (!snapshot) return null;
  const lifecycle=(snapshot.session as typeof snapshot.session&{lifecycle?:string}).lifecycle;
  const hostLive=snapshot.session.role==="host"&&lifecycle==="live";
  const client=snapshot.session.role==="client";

  const choose=async(file:File|undefined)=>{
    if (!file) return;
    try { setDraft(await readLocalImageFile(file,HANDOUT_IMAGE_MAX_BYTES)); setError(""); }
    catch(reason) { setError(reason instanceof Error?reason.message:String(reason)); }
  };
  const reveal=async()=>{
    if (!draft) return;
    try { await revealSessionImageHandout(mockAdapter,draft); setOpen(false); setError(""); }
    catch(reason) { setError(reason instanceof Error?reason.message:String(reason)); }
  };
  const withdraw=async()=>{ try { await withdrawSessionImageHandout(mockAdapter); setOpen(false); } catch(reason) { setError(reason instanceof Error?reason.message:String(reason)); } };

  return createPortal(<>
    {hostLive&&<div className="handout-host-launcher">
      <button type="button" className={handout.asset?"active":""} onClick={()=>setOpen(true)}>이미지 보여주기{handout.asset?" · 공유 중":""}</button>
      {handout.asset&&<button type="button" onClick={withdraw}>공유 철회</button>}
    </div>}
    {hostLive&&open&&<div className="handout-editor-backdrop" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target)setOpen(false);}}><section className="handout-editor" role="dialog" aria-modal="true" aria-label="플레이어에게 이미지 보여주기">
      <header><div><span>DM PRESENTATION</span><strong>이미지 보여주기</strong><small>로컬 파일을 미리 본 뒤 연결된 플레이어에게 명시적으로 공개합니다.</small></div><button type="button" onClick={()=>setOpen(false)}>×</button></header>
      <label className="handout-file">PNG / JPEG / WebP 선택<input type="file" accept={LOCAL_IMAGE_ACCEPT} onChange={(event)=>void choose(event.target.files?.[0])}/></label>
      {draft&&<div className="handout-preview"><img src={draft.dataUrl} alt="공유 전 이미지 미리보기"/><small>{draft.fileName??"로컬 이미지"} · {(draft.byteLength/1024).toFixed(0)} KiB</small></div>}
      {error&&<p className="handout-error">{error}</p>}
      <footer><button type="button" onClick={()=>setOpen(false)}>취소</button><button type="button" className="primary" disabled={!draft} onClick={reveal}>플레이어에게 공개</button></footer>
    </section></div>}
    {client&&handout.asset&&!handout.dismissed&&<section className="handout-client-overlay" role="dialog" aria-label="DM 공유 이미지">
      <header><div><span>DM IMAGE</span><strong>{handout.asset.fileName??"공유 이미지"}</strong></div><button type="button" onClick={()=>dismissSessionImageHandout(mockAdapter)}>닫기</button></header>
      <img src={handout.asset.dataUrl} alt="DM이 공유한 이미지"/>
    </section>}
    {client&&handout.asset&&handout.dismissed&&<button type="button" className="handout-reopen" onClick={()=>reopenSessionImageHandout(mockAdapter)}>이미지 다시 열기</button>}
    {client&&handout.error&&<div className="handout-client-error" role="status">{handout.error}</div>}
  </>,document.body);
}
