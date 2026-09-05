import { useSimpleVtt } from "./app/AppProvider";

/** V1.4 U1-02: the home is a "continue" dashboard — the last character, the session, the campaign, then the rest. */
export function V1HomeScreen({
  onCharacters,
  onCreateCharacter,
  onCampaigns,
  onSession,
  onContent,
  onRules,
  onPlay,
}: {
  onCharacters(): void;
  onCreateCharacter(): void;
  onCampaigns(): void;
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
  const recent = savedCharacters.find((character) => character.id === snapshot.activeCharacter.id) ?? savedCharacters[0];
  const campaigns = snapshot.campaigns ?? [];

  const startCharacter = async () => {
    await createCharacterDraft("guided");
    onCreateCharacter();
  };

  return (
    <div className="v1-home-screen">
      <header className="v1-hero">
        <div className="v1-hero-copy">
          <span className="v1-kicker">TABLETOP, YOUR WAY</span>
          <h1>SimpleVTT v1</h1>
          <p>이어서 플레이하거나 새로 시작합니다.</p>
          <div className="v1-hero-actions">
            <button className="primary" onClick={startCharacter}>새 캐릭터 만들기</button>
            <button onClick={onCharacters}>내 캐릭터 열기</button>
          </div>
        </div>
        <div className="v1-hero-status" aria-label="현재 준비 상태">
          <span><b>{savedCharacters.length}</b> 저장된 캐릭터</span>
          <span><b>{campaigns.length}</b> 캠페인</span>
          <span><b>{localContent.length}</b> 추가 콘텐츠</span>
          <span><b>{live ? "플레이 중" : connected ? "연결됨" : "오프라인"}</b> 세션</span>
        </div>
      </header>

      <section className="v1-start-grid" aria-label="시작할 작업">
        <article className="v1-start-card featured">
          <span className="v1-kicker">캐릭터</span>
          {recent ? <>
            <h2>{recent.name}</h2>
            <p>{recent.className} {recent.level} · {recent.species} · {recent.background} · HP {recent.hp}/{recent.maxHp} · AC {recent.ac}</p>
          </> : <>
            <h2>첫 캐릭터 만들기</h2>
            <p>안내에 따라 클래스, 종족, 배경, 능력치를 정하면 시트가 바로 준비됩니다.</p>
          </>}
          {recent && <div className="v1-card-actions">
            <button className="primary" onClick={onCharacters}>시트 열기</button>
            <button onClick={onCharacters}>모든 캐릭터</button>
          </div>}
        </article>

        <article className="v1-start-card">
          <span className="v1-kicker">세션</span>
          <h2>{live ? "플레이 중" : connected ? "연결된 세션" : "함께 플레이"}</h2>
          <p>{connected ? "연결된 세션의 준비 상태와 참가자를 확인하고 플레이로 돌아갑니다." : "세션을 열거나(Host) 진행 중인 세션에 참가합니다(Join)."}</p>
          <div className="v1-card-actions">
            {live && <button className="primary" onClick={onPlay}>플레이로 돌아가기</button>}
            <button className={live ? "" : "primary"} onClick={onSession}>{connected ? "세션 보기" : "Host / Join"}</button>
          </div>
        </article>

        <article className="v1-start-card">
          <span className="v1-kicker">캠페인</span>
          <h2>{campaigns.length ? campaigns[0].name : "캠페인"}</h2>
          <p>{campaigns.length ? `${campaigns.length}개 캠페인 · 달력, 식량, 파티 보관함, DM 라이브러리` : "달력, 식량, 파티 보관함, DM 라이브러리를 세션 사이에 이어갑니다."}</p>
          <div className="v1-card-actions"><button onClick={onCampaigns}>캠페인 열기</button></div>
        </article>

        <article className="v1-start-card">
          <span className="v1-kicker">콘텐츠</span>
          <h2>애드온</h2>
          <p>{localContent.length ? `${localContent.length}개 설치됨` : "애드온 파일을 검증하고 설치합니다."}</p>
          <div className="v1-card-actions"><button onClick={onContent}>콘텐츠 관리</button></div>
        </article>

        <article className="v1-start-card">
          <span className="v1-kicker">규칙</span>
          <h2>규칙 찾기</h2>
          <p>기본 콘텐츠와 애드온을 한 카탈로그에서 검색합니다.</p>
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
