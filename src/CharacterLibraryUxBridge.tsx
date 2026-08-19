import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import { publishExternalAdapterSnapshot } from "./app/adapterSnapshotEvents";
import "./app/productionAcceptanceRuntimeAdapter";
import {
  persistSheetLayoutPreference,
  readSheetLayoutPreference,
  type SheetLayoutPreference,
} from "./app/sheetLayoutPreferences";

function selectableCards(grid:HTMLElement) {
  return [...grid.querySelectorAll<HTMLButtonElement>("button.character-card:not(.draft-card):not(.utility)")];
}

export function CharacterLibraryUxBridge() {
  const { snapshot }=useSimpleVtt();
  const [actionsTarget,setActionsTarget]=useState<HTMLElement|null>(null);
  const [layout,setLayout]=useState<SheetLayoutPreference>(()=>readSheetLayoutPreference());

  useEffect(()=>{
    const bind=()=>{
      const grid=document.querySelector<HTMLElement>(".character-library-grid");
      const actions=grid?.closest(".screen")?.querySelector<HTMLElement>(".screen-head .screen-actions")??null;
      setActionsTarget(actions);
      return grid;
    };
    let grid=bind();
    const observer=new MutationObserver(()=>{grid=bind();});
    observer.observe(document.body,{childList:true,subtree:true});

    const handleClick=(event:Event)=>{
      if (!snapshot||!grid) return;
      const target=event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button.character-card") : null;
      if (!target||!grid.contains(target)||target.classList.contains("draft-card")||target.classList.contains("utility")) return;
      const index=selectableCards(grid).indexOf(target);
      const character=snapshot.characters[index];
      if (!character) return;
      void mockAdapter.selectProductionCharacter(character.id).then(publishExternalAdapterSnapshot);
    };

    const capture=(event:Event)=>handleClick(event);
    document.addEventListener("click",capture,true);
    return ()=>{
      observer.disconnect();
      document.removeEventListener("click",capture,true);
    };
  },[snapshot]);

  if (!snapshot||!actionsTarget) return null;

  const chooseLayout=(next:SheetLayoutPreference)=>{
    const persisted=persistSheetLayoutPreference(next);
    setLayout(persisted);
  };

  return createPortal(
    <div className="sheet-layout-switch character-library-sheet-switch" role="group" aria-label="캐릭터 시트 스타일">
      <button type="button" className={layout==="simplevtt"?"active":""} aria-pressed={layout==="simplevtt"} onClick={()=>chooseLayout("simplevtt")}>SimpleVTT 시트</button>
      <button type="button" className={layout==="official"?"active":""} aria-pressed={layout==="official"} onClick={()=>chooseLayout("official")}>공식 시트 스타일</button>
    </div>,
    actionsTarget,
  );
}
