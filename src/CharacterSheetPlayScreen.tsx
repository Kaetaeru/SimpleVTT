import { useState } from "react";
import { CharacterSheetPlayScreen as SimpleVttCharacterSheetPlayScreen } from "./LegacyCharacterSheetPlayScreen";
import { OfficialCharacterSheetPlayScreen } from "./OfficialCharacterSheetPlayScreen";
import {
  persistSheetLayoutPreference,
  readSheetLayoutPreference,
  type SheetLayoutPreference,
} from "./app/sheetLayoutPreferences";
import "./character-sheet-layouts.css";

type Props = { onScene(): void; onLevelUp(): void; onEdit(): void };

export function CharacterSheetPlayScreen(props: Props) {
  const [layout, setLayout] = useState<SheetLayoutPreference>(() => readSheetLayoutPreference());

  const selectLayout = (next: SheetLayoutPreference) => {
    setLayout(persistSheetLayoutPreference(next));
  };

  return <div className={`sheet-layout-router sheet-layout-${layout}`}>
    <div className="sheet-layout-choice-bar">
      <div>
        <span className="eyebrow accent">SHEET LAYOUT</span>
        <strong>기본 시트 레이아웃</strong>
        <small>선택은 캐릭터 데이터와 분리되어 다음 실행에도 유지됩니다.</small>
      </div>
      <div className="sheet-layout-switch" role="group" aria-label="기본 캐릭터 시트 레이아웃">
        <button type="button" className={layout === "simplevtt" ? "active" : ""} aria-pressed={layout === "simplevtt"} onClick={() => selectLayout("simplevtt")}>SimpleVTT Sheet</button>
        <button type="button" className={layout === "official" ? "active" : ""} aria-pressed={layout === "official"} onClick={() => selectLayout("official")}>Official sheet layout</button>
      </div>
    </div>
    {layout === "simplevtt" ? <SimpleVttCharacterSheetPlayScreen {...props} /> : <OfficialCharacterSheetPlayScreen {...props} />}
  </div>;
}
