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
import {
  DICE_VISUAL_PRESET_ORDER,
  getDiceVisualPreset,
  type DiceVisualPresetId,
} from "./app/diceVisualPresets";

type SwatchStyle = CSSProperties & { "--appearance-swatch": string };
type DiceThemeStyle = CSSProperties & {
  "--dice-theme-body": string;
  "--dice-theme-edge": string;
};

function hexColor(value: number) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function sameAppearance(left: AppearancePreference, right: AppearancePreference) {
  return left.mode === right.mode
    && left.accent.toLowerCase() === right.accent.toLowerCase()
    && left.diceTheme === right.diceTheme;
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
        diceTheme: (root.dataset.diceTheme as DiceVisualPresetId | undefined) ?? appearance.diceTheme,
      };
      if (!sameAppearance(applied, appearance)) applyAppearancePreference(appearance, root);
    };
    reconcile();
    const observer = new MutationObserver(reconcile);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-dice-theme", "style"] });
    return () => observer.disconnect();
  }, [appearance]);

  if (!target) return null;

  const setMode = (mode: AppearanceMode) => setAppearance((current) => ({ ...current, mode }));
  const setAccent = (accent: string) => setAppearance((current) => ({ ...current, accent }));
  const setDiceTheme = (diceTheme: DiceVisualPresetId) => setAppearance((current) => ({ ...current, diceTheme }));

  return createPortal(
    <section className="appearance-v09-panel" aria-label="외형 설정">
      <div className="appearance-v09-heading">
        <div>
          <span className="eyebrow accent">APPEARANCE</span>
          <h2>외형</h2>
        </div>
        <p>화면과 주사위 표현은 이 기기에 개인 설정으로 저장됩니다.</p>
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

      <div className="appearance-v09-group">
        <h3>주사위 테마</h3>
        <div className="appearance-v09-dice-themes" role="group" aria-label="주사위 테마">
          {DICE_VISUAL_PRESET_ORDER.map((presetId) => {
            const preset = getDiceVisualPreset(presetId);
            const active = appearance.diceTheme === presetId;
            const style = {
              "--dice-theme-body": hexColor(preset.body.color),
              "--dice-theme-edge": hexColor(preset.edge.color),
            } as DiceThemeStyle;
            return (
              <button
                type="button"
                key={presetId}
                className={active ? "appearance-v09-dice-theme active" : "appearance-v09-dice-theme"}
                aria-pressed={active}
                onClick={() => setDiceTheme(presetId)}
                style={style}
              >
                <span className="appearance-v09-dice-theme-swatch" aria-hidden="true" />
                <span className="appearance-v09-dice-theme-copy">
                  <strong>{preset.label}</strong>
                  <small>{preset.description}</small>
                </span>
              </button>
            );
          })}
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
