import { useState } from "react";
import type { SheetLayoutPreference } from "./app/sheetLayoutPreferences";

export function FirstRunTutorial({
  mode,
  initialLayout,
  onComplete,
  onClose,
}: {
  mode: "first-run" | "reopen";
  initialLayout: SheetLayoutPreference | null;
  onComplete(layout: SheetLayoutPreference): void;
  onClose?(): void;
}) {
  const [layout, setLayout] = useState<SheetLayoutPreference | null>(initialLayout);
  const isFirstRun = mode === "first-run";

  return (
    <div className="first-run-overlay" role="dialog" aria-modal="true" aria-labelledby="first-run-title">
      <section className="first-run-panel">
        <header className="first-run-heading">
          <div>
            <span className="v1-kicker">WELCOME TO SIMPLEVTT</span>
            <h1 id="first-run-title">SimpleVTT를 어떻게 사용할지 먼저 정리해 볼게요.</h1>
            <p>SimpleVTT는 캐릭터 시트만 단독으로 써도 되고, 필요할 때 Host/Join으로 같은 캐릭터를 연결해서 플레이할 수도 있습니다.</p>
          </div>
          {!isFirstRun && onClose && <button className="quiet" type="button" onClick={onClose}>닫기</button>}
        </header>

        <div className="first-run-orientation" aria-label="SimpleVTT 사용 방식">
          <article>
            <span className="first-run-index">1</span>
            <div><strong>Standalone Character</strong><p>현실 테이블에서는 캐릭터 시트만 열고 능력, 내성, 기술, 공격, 피해와 주사위를 바로 사용합니다.</p></div>
          </article>
          <article>
            <span className="first-run-index">2</span>
            <div><strong>Host Session</strong><p>세션을 여는 사용자는 Host이자 DM입니다. 세션을 열면 준비 대기실 없이 바로 라이브 플레이 컨텍스트가 시작됩니다.</p></div>
          </article>
          <article>
            <span className="first-run-index">3</span>
            <div><strong>Join Session</strong><p>참가자는 Client이자 Player입니다. 참가할 캐릭터를 선택한 뒤 이미 진행 중인 세션에도 들어갈 수 있습니다.</p></div>
          </article>
        </div>

        <section className="first-run-sheet-choice" aria-labelledby="first-run-sheet-title">
          <div className="first-run-section-copy">
            <span className="v1-kicker">CHARACTER SHEET</span>
            <h2 id="first-run-sheet-title">처음 사용할 시트 표시 방식을 고르세요.</h2>
            <p>두 화면은 같은 캐릭터 데이터를 사용합니다. 이 선택은 표시 방식일 뿐이며 캐릭터 자체를 바꾸지 않습니다. 나중에 시트나 설정에서 언제든 바꿀 수 있습니다.</p>
          </div>
          <div className="first-run-sheet-options" role="group" aria-label="초기 캐릭터 시트 표시 방식">
            <button
              type="button"
              className={layout === "official" ? "first-run-sheet-option active" : "first-run-sheet-option"}
              aria-pressed={layout === "official"}
              onClick={() => setLayout("official")}
            >
              <span className="badge">Official-style</span>
              <strong>공식 시트 스타일</strong>
              <small>종이 캐릭터 시트처럼 전체 기록을 익숙한 구조로 읽습니다.</small>
            </button>
            <button
              type="button"
              className={layout === "simplevtt" ? "first-run-sheet-option active" : "first-run-sheet-option"}
              aria-pressed={layout === "simplevtt"}
              onClick={() => setLayout("simplevtt")}
            >
              <span className="badge">SimpleVTT</span>
              <strong>SimpleVTT 최적화</strong>
              <small>현재 상태와 자주 쓰는 행동을 더 빠르게 찾도록 정리한 화면입니다.</small>
            </button>
          </div>
        </section>

        <footer className="first-run-actions">
          <div>
            <strong>{layout ? "시트 표시 방식이 선택되었습니다." : "계속하려면 시트 표시 방식을 하나 선택하세요."}</strong>
            <span>튜토리얼을 완료해도 캐릭터 생성이나 세션 연결은 자동으로 시작하지 않습니다.</span>
          </div>
          <button className="primary" type="button" disabled={!layout} onClick={() => layout && onComplete(layout)}>
            {isFirstRun ? "선택 저장 · Home으로" : "선택 저장 · 튜토리얼 닫기"}
          </button>
        </footer>
      </section>
    </div>
  );
}
