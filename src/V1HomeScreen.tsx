import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";

const GUIDE_KEY = "simplevtt.v1.guide.dismissed";

function initialGuideState() {
  try {
    return window.localStorage.getItem(GUIDE_KEY) !== "true";
  } catch {
    return true;
  }
}

export function V1HomeScreen({
  onCharacters,
  onCreateCharacter,
  onSession,
  onContent,
  onRules,
  onPlay,
}: {
  onCharacters(): void;
  onCreateCharacter(): void;
  onSession(): void;
  onContent(): void;
  onRules(): void;
  onPlay(): void;
}) {
  const { snapshot, createCharacterDraft } = useSimpleVtt();
  const [guideOpen, setGuideOpen] = useState(initialGuideState);
  if (!snapshot) return null;

  const connected = snapshot.session.role !== "offline";
  const live = snapshot.session.lifecycle === "live";
  const localContent = snapshot.catalog.filter((entry) => entry.scope === "local");
  const savedCharacters = snapshot.characters.filter((character) => character.saveState === "saved");

  const dismissGuide = () => {
    setGuideOpen(false);
    try {
      window.localStorage.setItem(GUIDE_KEY, "true");
    } catch {
      // UI preference persistence is best-effort; product data uses the canonical stores.
    }
  };

  const startCharacter = async () => {
    await createCharacterDraft("guided");
    onCreateCharacter();
  };

  return (
    <div className="v1-home-screen">
      <header className="v1-hero">
        <div className="v1-hero-copy">
          <span className="v1-kicker">TABLETOP, YOUR WAY</span>
          <h1>SimpleVTT</h1>
          <p>종이 시트처럼 가볍게, 필요할 때는 같은 캐릭터로 바로 연결해서 플레이하세요.</p>
          <div className="v1-hero-actions">
            <button className="primary" onClick={startCharacter}>새 캐릭터 만들기</button>
            <button onClick={onCharacters}>내 캐릭터 열기</button>
          </div>
        </div>
        <div className="v1-hero-status" aria-label="현재 준비 상태">
          <span><b>{savedCharacters.length}</b> 저장된 캐릭터</span>
          <span><b>{localContent.length}</b> 추가 콘텐츠</span>
          <span><b>{connected ? "연결" : "오프라인"}</b> 세션 상태</span>
        </div>
      </header>

      {guideOpen ? (
        <section className="v1-onboarding" aria-labelledby="v1-guide-title">
          <div className="v1-section-heading">
            <div><span className="v1-kicker">처음 시작하기</span><h2 id="v1-guide-title">세 단계면 준비됩니다</h2></div>
            <button className="quiet" onClick={dismissGuide}>가이드 닫기</button>
          </div>
          <div className="v1-guide-steps">
            <button onClick={onCharacters}><b>1</b><span><strong>캐릭터</strong><small>만들거나 저장된 시트를 엽니다.</small></span></button>
            <button onClick={onContent}><b>2</b><span><strong>애드온은 선택</strong><small>필요한 규칙 콘텐츠가 있을 때만 추가합니다.</small></span></button>
            <button onClick={onSession}><b>3</b><span><strong>플레이 방식</strong><small>시트만 사용하거나 Host/Join으로 연결합니다.</small></span></button>
          </div>
        </section>
      ) : (
        <button className="v1-guide-reopen" onClick={() => setGuideOpen(true)}>처음 사용 가이드 다시 보기</button>
      )}

      <section className="v1-start-grid" aria-label="시작할 작업">
        <article className="v1-start-card featured">
          <span className="v1-kicker">CHARACTER</span>
          <h2>캐릭터 시트</h2>
          <p>현실 테이블에서는 시트만 열어 능력, 내성, 기술, 공격, 피해와 주사위를 바로 사용합니다.</p>
          <div className="v1-card-actions">
            <button className="primary" onClick={onCharacters}>캐릭터 보기</button>
            <button onClick={startCharacter}>새로 만들기</button>
          </div>
        </article>

        <article className="v1-start-card">
          <span className="v1-kicker">SESSION</span>
          <h2>{connected ? "현재 세션" : "함께 플레이"}</h2>
          <p>{connected ? "연결된 세션의 준비 상태와 참가자를 확인하고 플레이로 돌아갑니다." : "세션을 만들거나 친구의 Host 주소로 참가합니다."}</p>
          <div className="v1-card-actions">
            {live && <button className="primary" onClick={onPlay}>플레이로 돌아가기</button>}
            <button className={live ? "" : "primary"} onClick={onSession}>{connected ? "세션 보기" : "Host / Join"}</button>
          </div>
        </article>

        <article className="v1-start-card">
          <span className="v1-kicker">ADDONS</span>
          <h2>콘텐츠 · 애드온</h2>
          <p>지원되는 RuleModule JSON을 파일로 선택하고 검증 결과를 확인한 뒤 설치합니다.</p>
          <div className="v1-card-actions"><button onClick={onContent}>애드온 추가</button></div>
        </article>

        <article className="v1-start-card">
          <span className="v1-kicker">REFERENCE</span>
          <h2>규칙 찾기</h2>
          <p>기본 콘텐츠와 설치한 애드온을 한 카탈로그에서 이름과 종류로 검색합니다.</p>
          <div className="v1-card-actions"><button onClick={onRules}>규칙 찾아보기</button></div>
        </article>
      </section>

      <footer className="v1-home-note">
        <span>시트만으로 플레이해도 됩니다.</span>
        <span>VTT 세션은 필요할 때만 연결합니다.</span>
        <span>일반 사용에 Debug Dock은 필요하지 않습니다.</span>
      </footer>
    </div>
  );
}
