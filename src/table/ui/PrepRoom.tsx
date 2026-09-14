import { useState } from "react";
import { useSimpleVtt } from "../../app/AppProvider";
import { ItemLibrary, MaterialsLibrary, NpcLibrary } from "./LibraryPanels";
import "./workspace.css";

/**
 * 준비실 (DM_WORKSPACE.md §3): the session sidebar's 액터·아이템·자료 unfolded to full width, outside a session. What is
 * registered here is what the session's 액터 tab summons; what the session saves as a bundle appears here.
 */
export function PrepRoom({onClose}:{onClose():void}) {
  const {snapshot}=useSimpleVtt();
  const [toast,setToast]=useState<string|null>(null);
  const feedback=(message:string)=>{ setToast(message); window.setTimeout(()=>setToast((current)=>current===message?null:current),2400); };
  return <div className="tw-prep tw-root" role="dialog" aria-label="준비실">
    <header className="tw-topbar"><button type="button" className="quiet" onClick={onClose}>← 캠페인</button><div className="tw-title"><strong>준비실</strong><small>세션 안팎에서 같은 라이브러리 · 등록한 것은 세션의 액터·아이템 탭에 그대로 보입니다</small></div><div className="tw-spacer"/><span className="tw-pill">호스트 라이브러리 · 캠페인 없이도 유지</span></header>
    <div className="tw-prep-body">
      <section className="tw-prep-col" aria-label="액터"><span className="tw-eyebrow">액터 · 내 NPC · 장면 묶음</span><NpcLibrary mode="prep" snapshot={snapshot??undefined} onFeedback={feedback}/></section>
      <section className="tw-prep-col" aria-label="아이템"><span className="tw-eyebrow">아이템</span><ItemLibrary mode="prep" snapshot={snapshot??undefined} onFeedback={feedback}/></section>
      <section className="tw-prep-col" aria-label="자료"><span className="tw-eyebrow">자료 · 이미지 · 노트</span><MaterialsLibrary mode="prep" snapshot={snapshot??undefined} onFeedback={feedback}/></section>
    </div>
    {toast&&<div className="tw-toast" role="status">{toast}</div>}
  </div>;
}
