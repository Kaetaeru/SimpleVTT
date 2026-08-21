import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FirstRunTutorial } from "./FirstRunTutorial";
import { persistFirstRunCompletion, readFirstRunCompletion } from "./app/firstRunPreferences";
import {
  persistSheetLayoutPreference,
  readStoredSheetLayoutPreference,
  type SheetLayoutPreference,
} from "./app/sheetLayoutPreferences";

export function FirstRunTutorialBridge() {
  const [mode, setMode] = useState<"first-run" | "reopen" | null>(() => readFirstRunCompletion() ? null : "first-run");
  const [initialLayout, setInitialLayout] = useState<SheetLayoutPreference | null>(() => readStoredSheetLayoutPreference());
  const [settingsTarget, setSettingsTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const findSettingsTarget = () => setSettingsTarget(document.querySelector<HTMLElement>(".settings-card"));
    findSettingsTarget();
    const observer = new MutationObserver(findSettingsTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".v1-shell");
    if (!shell) return;
    if (mode) {
      shell.setAttribute("inert", "");
      shell.setAttribute("aria-hidden", "true");
    } else {
      shell.removeAttribute("inert");
      shell.removeAttribute("aria-hidden");
    }
    return () => {
      shell.removeAttribute("inert");
      shell.removeAttribute("aria-hidden");
    };
  }, [mode]);

  const openTutorial = () => {
    setInitialLayout(readStoredSheetLayoutPreference());
    setMode("reopen");
  };

  const completeTutorial = (layout: SheetLayoutPreference) => {
    persistSheetLayoutPreference(layout);
    persistFirstRunCompletion();
    setInitialLayout(layout);
    setMode(null);
  };

  return <>
    {mode && createPortal(
      <FirstRunTutorial
        mode={mode}
        initialLayout={initialLayout}
        onComplete={completeTutorial}
        onClose={mode === "reopen" ? () => setMode(null) : undefined}
      />,
      document.body,
    )}
    {settingsTarget && createPortal(
      <section className="first-run-settings-entry" aria-label="처음 사용 안내">
        <div>
          <span className="eyebrow accent">GETTING STARTED</span>
          <h2>처음 사용 안내</h2>
          <p>Standalone, Host, Join의 차이와 캐릭터 시트 표시 방식을 다시 확인할 수 있습니다.</p>
        </div>
        <button type="button" onClick={openTutorial}>튜토리얼 다시 보기</button>
      </section>,
      settingsTarget,
    )}
  </>;
}
