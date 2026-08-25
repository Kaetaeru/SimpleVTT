import { useState } from "react";
import { CharacterSheetPlayScreen as SimpleVttCharacterSheetPlayScreen } from "./LegacyCharacterSheetPlayScreen";
import { OfficialCharacterSheetPlayScreen } from "./OfficialCharacterSheetPlayScreen";
import { CharacterInventoryView } from "./CharacterInventoryView";
import { useSimpleVtt } from "./app/AppProvider";
import {
  persistSheetLayoutPreference,
  readSheetLayoutPreference,
  type SheetLayoutPreference,
} from "./app/sheetLayoutPreferences";
import "./character-sheet-layouts.css";
import "./session-full-sheet.css";

export type CharacterSheetHostMode = "standalone" | "session";

type StandaloneProps = { onLevelUp(): void; onEdit(): void };
type WorkspaceProps = {
  hostMode: CharacterSheetHostMode;
  onLevelUp?: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  onOpenRules?: (launcher: HTMLButtonElement) => void;
};

export function CharacterSheetWorkspace({ hostMode, onLevelUp, onEdit, onClose, onOpenRules }: WorkspaceProps) {
  const { snapshot } = useSimpleVtt();
  const [layout, setLayout] = useState<SheetLayoutPreference>(() => readSheetLayoutPreference());
  const [section,setSection]=useState<"sheet"|"inventory">("sheet");

  const selectLayout = (next: SheetLayoutPreference) => {
    setLayout(persistSheetLayoutPreference(next));
  };

  if (!snapshot) return null;
  const character = snapshot.activeCharacter;

  return <div className={`sheet-layout-router sheet-layout-${layout} character-sheet-workspace`} data-sheet-host={hostMode}>
    {hostMode === "session" ? <header className="session-full-sheet-toolbar">
      <div className="session-full-sheet-title">
        <span className="eyebrow accent">CHARACTER SHEET</span>
        <strong>{character.name}</strong>
        <small>{character.className} {character.level} · 세션은 뒤에서 계속 유지됩니다.</small>
      </div>
      <div className="session-full-sheet-toolbar-actions">
        <div className="sheet-layout-switch" role="group" aria-label="캐릭터 시트 레이아웃">
          <button type="button" className={layout === "simplevtt" ? "active" : ""} aria-pressed={layout === "simplevtt"} onClick={() => selectLayout("simplevtt")}>SimpleVTT</button>
          <button type="button" className={layout === "official" ? "active" : ""} aria-pressed={layout === "official"} onClick={() => selectLayout("official")}>공식 시트 스타일</button>
        </div>
        {onOpenRules && <button type="button" onClick={(event) => onOpenRules(event.currentTarget)}>규칙</button>}
        <button type="button" className="primary" onClick={onClose} aria-label="전체 캐릭터 시트 닫기">시트 닫기</button>
      </div>
    </header> : null}

    <nav className="character-sheet-system-tabs" role="tablist" aria-label="캐릭터 관리 섹션">
      <button type="button" role="tab" aria-selected={section==="sheet"} className={section==="sheet"?"active":""} onClick={()=>setSection("sheet")}>개요 / 시트</button>
      <button type="button" role="tab" aria-selected={section==="inventory"} className={section==="inventory"?"active":""} onClick={()=>setSection("inventory")}>인벤토리</button>
    </nav>

    <div className="character-sheet-workspace-content">
      {section==="inventory"?<CharacterInventoryView hostMode={hostMode}/>:layout === "simplevtt"
        ? <SimpleVttCharacterSheetPlayScreen hostMode={hostMode} onLevelUp={onLevelUp} onEdit={onEdit} />
        : <OfficialCharacterSheetPlayScreen hostMode={hostMode} onLevelUp={onLevelUp} onEdit={onEdit} />}
    </div>
  </div>;
}

export function CharacterSheetPlayScreen(props: StandaloneProps) {
  return <CharacterSheetWorkspace hostMode="standalone" {...props} />;
}
