import { useState } from "react";
import { CharacterSheetPlayScreen as SimpleVttCharacterSheetPlayScreen } from "./LegacyCharacterSheetPlayScreen";
import { OfficialCharacterSheetPlayScreen } from "./OfficialCharacterSheetPlayScreen";
import { useSimpleVtt } from "./app/AppProvider";
import {
  persistSheetLayoutPreference,
  readSheetLayoutPreference,
  type SheetLayoutPreference,
} from "./app/sheetLayoutPreferences";
import "./character-sheet-layouts.css";
import "./session-full-sheet.css";

export type CharacterSheetHostMode = "standalone" | "session";

type StandaloneProps = { onScene(): void; onLevelUp(): void; onEdit(): void };
type WorkspaceProps = {
  hostMode: CharacterSheetHostMode;
  onScene?: () => void;
  onLevelUp?: () => void;
  onEdit?: () => void;
  onClose?: () => void;
  onOpenRules?: (launcher: HTMLButtonElement) => void;
};

export function CharacterSheetWorkspace({ hostMode, onScene, onLevelUp, onEdit, onClose, onOpenRules }: WorkspaceProps) {
  const { snapshot } = useSimpleVtt();
  const [layout, setLayout] = useState<SheetLayoutPreference>(() => readSheetLayoutPreference());

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
    </header> : <div className="sheet-layout-choice-bar">
      <div>
        <span className="eyebrow accent">SHEET LAYOUT</span>
        <strong>기본 시트 레이아웃</strong>
        <small>선택은 캐릭터 데이터와 분리되어 다음 실행에도 유지됩니다.</small>
      </div>
      <div className="sheet-layout-switch" role="group" aria-label="기본 캐릭터 시트 레이아웃">
        <button type="button" className={layout === "simplevtt" ? "active" : ""} aria-pressed={layout === "simplevtt"} onClick={() => selectLayout("simplevtt")}>SimpleVTT Sheet</button>
        <button type="button" className={layout === "official" ? "active" : ""} aria-pressed={layout === "official"} onClick={() => selectLayout("official")}>Official sheet layout</button>
      </div>
    </div>}

    <div className="character-sheet-workspace-content">
      {layout === "simplevtt"
        ? <SimpleVttCharacterSheetPlayScreen hostMode={hostMode} onScene={onScene} onLevelUp={onLevelUp} onEdit={onEdit} />
        : <OfficialCharacterSheetPlayScreen hostMode={hostMode} onScene={onScene} onLevelUp={onLevelUp} onEdit={onEdit} />}
    </div>
  </div>;
}

export function CharacterSheetPlayScreen(props: StandaloneProps) {
  return <CharacterSheetWorkspace hostMode="standalone" {...props} />;
}
