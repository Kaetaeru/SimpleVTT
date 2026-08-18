import { useEffect, useLayoutEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  APPEARANCE_SWATCHES,
  applyAppearancePreference,
  persistAppearancePreference,
  readAppearancePreference,
  type AppearanceMode,
  type AppearancePreference,
} from "./app/appearancePreferences";

type SwatchStyle = CSSProperties & { "--appearance-swatch": string };

function sameAppearance(left: AppearancePreference, right: AppearancePreference) {
  return left.mode === right.mode && left.accent.toLowerCase() === right.accent.toLowerCase();
}

export function AppearanceSettingsBridge() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [appearance, setAppearance] = useState<AppearancePreference>(() => readAppearancePreference());

  useEffect(() => {
    const findTarget = () => setTarget(document.querySelector<HTMLElement>(".settings-card"));
    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    applyAppearancePreference(appearance);
    persistAppearancePreference(appearance);
  }, [appearance]);

  useEffect(() => {
    const root = document.documentElement;
    const reconcile = () => {
      const applied: AppearancePreference = {
        mode: root.dataset.theme === "light" ? "light" : "dark",
        accent: root.style.getPropertyValue("--accent-base").trim() || appearance.accent,
      };
      if (!sameAppearance(applied, appearance)) applyAppearancePreference(appearance, root);
    };
    reconcile();
    const observer = new MutationObserver(reconcile);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "style"] });
    return () => observer.disconnect();
  }, [appearance]);

  if (!target) return null;

  const setMode = (mode: AppearanceMode) => setAppearance((current) => ({ ...current, mode }));
  const setAccent = (accent: string) => setAppearance((current) => ({ ...current, accent }));

  return createPortal(
    <section className="appearance-v09-panel" aria-label="외형 설정">
      <div className="appearance-v09-heading">
        <div>
          <span className="eyebrow accent">APPEARANCE</span>
          <h2>외형</h2>
        </div>
        <p>밝기 모드와 강조 색상은 서로 독립적으로 저장됩니다.</p>
      </div>

      <div className="appearance-v09-group">
        <h3>밝기 모드</h3>
        <div className="appearance-v09-mode" role="group" aria-label="밝기 모드">
          {(["dark", "light"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              className={appearance.mode === mode ? "active" : ""}
              aria-pressed={appearance.mode === mode}
              onClick={() => setMode(mode)}
            >
              <strong>{mode === "dark" ? "다크" : "라이트"}</strong>
              <span>{mode === "dark" ? "어두운 테이블 환경" : "밝은 테이블 환경"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="appearance-v09-group">
        <h3>강조 색상</h3>
        <div className="appearance-v09-swatches" role="group" aria-label="강조 색상 프리셋">
          {APPEARANCE_SWATCHES.map((swatch) => {
            const active = appearance.accent.toLowerCase() === swatch.value.toLowerCase();
            return (
              <button
                type="button"
                key={swatch.id}
                className={active ? "appearance-v09-swatch active" : "appearance-v09-swatch"}
                aria-label={`${swatch.label} 강조 색상`}
                aria-pressed={active}
                style={{ "--appearance-swatch": swatch.value } as SwatchStyle}
                onClick={() => setAccent(swatch.value)}
              >
                <span />
              </button>
            );
          })}
          <label className="appearance-v09-custom">
            <span>직접 선택</span>
            <input
              type="color"
              value={appearance.accent}
              aria-label="사용자 지정 강조 색상"
              onChange={(event) => setAccent(event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="appearance-v09-preview" aria-label="강조 색상 미리보기">
        <span>선택 / 포커스</span>
        <button type="button" className="primary">주요 행동</button>
        <i aria-hidden="true" />
      </div>
    </section>,
    target,
  );
}
