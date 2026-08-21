import { useSimpleVtt } from "./app/AppProvider";

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
  if (!snapshot) return null;

  const connected = snapshot.session.role !== "offline";
  const live = snapshot.session.lifecycle === "live";
  const localContent = snapshot.catalog.filter((entry) => entry.scope === "local");
  const savedCharacters = snapshot.characters.filter((character) => character.saveState === "saved");

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
          <p>{connected ? "연결된 세션의 준비 상태와 참가자를 확인하고 플레이로 돌아갑니다." : "세션을 열거나 이미 진행 중인 Host 세션에 참가합니다."}</p>
          <div className="v1-card-actions">
            {live && <button className="primary" onClick={onPlay}>플레이로 돌아가기</button>}
            <button className={live ? "" : "primary"} onClick={onSession}>{connected ? "세션 보기" : "Host / Join"}</button>
          </div>
        </article>

        <article className="v1-start-card">
          <span className="v1-kicker">ADDONS</span>
          <h2>콘텐츠 · 애드온</h2>
          <p>지원되는 애드온 파일을 선택하고 검증 결과를 확인한 뒤 설치합니다.</p>
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
        <span>처음 사용 안내는 설정에서 언제든 다시 열 수 있습니다.</span>
      </footer>
    </div>
  );
}
