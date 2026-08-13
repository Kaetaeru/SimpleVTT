import { useEffect, useMemo, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type {
  AbilityKey,
  AbilityMethod,
  ActionVm,
  AppRoute,
  CatalogEntry,
  CharacterCreateDraft,
  SceneEntity,
} from "./app/contracts";

const ABILITY_LABELS: Record<AbilityKey, string> = {
  str: "근력",
  dex: "민첩",
  con: "건강",
  int: "지능",
  wis: "지혜",
  cha: "매력",
};
const ABILITY_KEYS = Object.keys(ABILITY_LABELS) as AbilityKey[];
const CREATE_STEPS = ["규칙 프로필", "정체성", "핵심 빌드", "능력치", "숙련·내성", "HP·방어·이동", "기능·주문·장비", "검토", "완료"];
const LEVEL_STEPS = ["진행 확인", "HP · 히트 다이스", "새 기능", "능력치 · 재주", "변경 검토"];
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

function modifier(score: number) {
  const value = Math.floor((score - 10) / 2);
  return value >= 0 ? `+${value}` : `${value}`;
}

function categoryLabel(category: CatalogEntry["category"]) {
  return ({ class: "클래스", subclass: "서브클래스", species: "종족", background: "배경", feat: "재주", spell: "주문", item: "장비", condition: "상태", combatant: "몬스터" } as const)[category];
}

export function App() {
  const { snapshot, loading } = useSimpleVtt();
  const [route, setRoute] = useState<AppRoute>("characters");
  const [debugOpen, setDebugOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDebugOpen((value) => !value);
      }
      if (event.key === "Escape" && debugOpen) setDebugOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [debugOpen]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.role === "dm" && ["characters", "character", "create", "levelup"].includes(route)) setRoute("scene");
  }, [snapshot, route]);

  if (loading || !snapshot) return <div className="loading-screen">SimpleVTT 불러오는 중…</div>;

  const playerNav: Array<[AppRoute, string, string]> = [
    ["characters", "내 캐릭터", "◉"],
    ["scene", "현재 장면", "◆"],
    ["catalog", "규칙 카탈로그", "▤"],
    ["activity", "활동 기록", "≡"],
    ["session", "세션", "⌁"],
    ["settings", "설정", "⚙"],
  ];
  const dmNav: Array<[AppRoute, string, string]> = [
    ["scene", "세션", "◆"],
    ["combatants", "컴배턴트", "♜"],
    ["catalog", "규칙 카탈로그", "▤"],
    ["activity", "활동 기록", "≡"],
    ["session", "연결", "⌁"],
    ["settings", "설정", "⚙"],
  ];
  const nav = snapshot.role === "player" ? playerNav : dmNav;

  return (
    <div className="app-shell">
      <aside className="rail">
        <button className="brand" onClick={() => setRoute(snapshot.role === "player" ? "characters" : "scene")}>S</button>
        <nav className="rail-nav">
          {nav.map(([id, label, icon]) => (
            <button key={id} className={route === id || (id === "characters" && ["character", "create", "levelup"].includes(route)) ? "rail-button active" : "rail-button"} onClick={() => setRoute(id)} title={label}>
              <span className="rail-icon">{icon}</span><span className="rail-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-spacer" />
        <div className={`connection-dot ${snapshot.connectionState}`} title={snapshot.connectionState} />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{snapshot.role === "player" ? "PLAYER" : "DUNGEON MASTER"}</span>
            <strong>{topTitle(route, snapshot.role)}</strong>
          </div>
          <div className="topbar-meta">
            <span>{snapshot.sessionMode === "initiative" ? `이니셔티브 · ${snapshot.scene.round}라운드` : "자유 진행"}</span>
            <span className={`status-text ${snapshot.connectionState}`}>{connectionLabel(snapshot.connectionState)}</span>
          </div>
        </header>

        <main className="content">
          {snapshot.role === "player" && route === "characters" && <CharacterLibraryScreen onOpen={() => setRoute("character")} onCreate={() => setRoute("create")} />}
          {snapshot.role === "player" && route === "character" && <CharacterSheetScreen onScene={() => setRoute("scene")} onLevelUp={() => setRoute("levelup")} />}
          {snapshot.role === "player" && route === "create" && <CharacterCreateScreen onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}
          {snapshot.role === "player" && route === "levelup" && <LevelUpScreen onDone={() => setRoute("character")} onCancel={() => setRoute("character")} />}
          {route === "scene" && (snapshot.role === "player" ? <PlayerSceneScreen /> : <DmSceneScreen />)}
          {route === "combatants" && snapshot.role === "dm" && <CombatantsScreen />}
          {route === "catalog" && <CatalogScreen />}
          {route === "activity" && <ActivityScreen />}
          {route === "session" && <SessionScreen />}
          {route === "settings" && <SettingsScreen />}
        </main>
      </section>

      {snapshot.resolution && <ResolutionDrawer />}
      {debugOpen && <DebugPanel onClose={() => setDebugOpen(false)} />}
    </div>
  );
}

function topTitle(route: AppRoute, role: "player" | "dm") {
  if (route === "characters") return "내 캐릭터";
  if (route === "character") return "Aelar · 전사 5레벨";
  if (route === "create") return "새 캐릭터";
  if (route === "levelup") return "레벨 업";
  if (route === "scene") return role === "player" ? "폐허가 된 성문" : "DM 세션 · 폐허가 된 성문";
  if (route === "combatants") return "컴배턴트";
  if (route === "catalog") return "규칙 카탈로그";
  if (route === "activity") return "활동 기록";
  if (route === "session") return "세션 연결";
  return "설정";
}

function connectionLabel(state: "connected" | "reconnecting" | "disconnected") {
  if (state === "connected") return "● 연결됨";
  if (state === "reconnecting") return "◌ 재연결 중";
  return "○ 연결 끊김";
}

function ScreenHead({ kicker, title, description, actions }: { kicker: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="screen-head"><div><span className="eyebrow accent">{kicker}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="screen-actions">{actions}</div>}</div>;
}

function CharacterLibraryScreen({ onOpen, onCreate }: { onOpen(): void; onCreate(): void }) {
  const { snapshot, createCharacterDraft } = useSimpleVtt();
  if (!snapshot) return null;
  return <div className="screen page-dark">
    <ScreenHead kicker="CHARACTERS" title="내 캐릭터" description="로컬에 저장된 캐릭터와 진행 중인 초안을 관리합니다." actions={<button className="primary" onClick={async () => { await createCharacterDraft("guided"); onCreate(); }}>새 캐릭터</button>} />
    <div className="character-library-grid">
      {snapshot.characters.map((character) => <button key={character.id} className="character-card" onClick={onOpen}>
        <div className="character-card-portrait">{character.name.slice(0, 1)}</div>
        <div><span className="badge">{character.saveState === "saved" ? "저장됨" : "초안"}</span><h2>{character.name}</h2><p>{character.className} {character.level} · {character.species} · {character.background}</p><div className="metric-strip"><span>HP <b>{character.hp}/{character.maxHp}</b></span><span>AC <b>{character.ac}</b></span></div></div>
      </button>)}
      <button className="character-card utility" onClick={async () => { await createCharacterDraft("import"); onCreate(); }}><div className="utility-icon">{ }</div><h3>JSON 가져오기</h3><p>.dndchar 및 JSON 가져오기 흐름</p></button>
    </div>
  </div>;
}

function CharacterSheetScreen({ onScene, onLevelUp }: { onScene(): void; onLevelUp(): void }) {
  const { snapshot, startLevelUp } = useSimpleVtt();
  if (!snapshot) return null;
  const c = snapshot.activeCharacter;
  return <div className="screen sheet-bg">
    <ScreenHead kicker="CHARACTER SHEET" title={c.name} description={`${c.className} ${c.level} · ${c.species} · ${c.background}`} actions={<><button onClick={onScene}>현재 장면</button><button className="primary" onClick={async () => { await startLevelUp(c.id); onLevelUp(); }}>레벨 업</button></>} />
    <div className="paper-sheet">
      <div className="sheet-identity"><div><small>캐릭터 이름</small><strong>{c.name}</strong></div><div><small>클래스 / 레벨</small><strong>{c.className} {c.level}</strong></div><div><small>종족</small><strong>{c.species}</strong></div><div><small>배경</small><strong>{c.background}</strong></div></div>
      <div className="sheet-columns">
        <section><SectionTitle>능력치 · 내성 · 기술</SectionTitle><div className="abilities">{ABILITY_KEYS.map((key) => <div className="ability" key={key}><div><small>{ABILITY_LABELS[key]}</small><strong>{c.abilities[key]}</strong><b>{modifier(c.abilities[key])}</b></div></div>)}</div><SectionTitle>내성</SectionTitle><div className="plain-list">{c.saves.map((item) => <span key={item}>{item}</span>)}</div><SectionTitle>기술</SectionTitle><div className="plain-list">{c.skills.map((item) => <span key={item}>{item}</span>)}</div></section>
        <section><SectionTitle>전투 핵심 수치</SectionTitle><div className="combat-metrics"><Metric label="방어도" value={c.ac}/><Metric label="우선권" value={modifier(c.abilities.dex)}/><Metric label="이동" value={`${c.speed} ft`}/></div><div className="hp-block"><div><small>현재 HP</small><strong>{c.hp} / {c.maxHp}</strong></div><div><small>임시 HP</small><strong>{c.tempHp}</strong></div></div><SectionTitle>공격 · 행동</SectionTitle><div className="rows">{c.attacks.map((attack) => <div className="row" key={attack.id}><strong>{attack.name}</strong><span>+{attack.bonus}</span><span>{attack.damage}</span></div>)}</div><SectionTitle>자원</SectionTitle><div className="rows">{c.resources.map((resource) => <div className="row" key={resource.label}><strong>{resource.label}</strong><span>{resource.current} / {resource.max}</span></div>)}</div></section>
        <section><SectionTitle>기능 · 재주</SectionTitle><div className="feature-list">{c.features.map((feature) => <article key={feature}><strong>{feature}</strong><p>출처와 계산 기여도는 상세 보기에서 확인합니다.</p></article>)}</div><SectionTitle>장비 · 인벤토리</SectionTitle><div className="rows">{c.equipment.map((item) => <div className="row" key={item}><strong>{item}</strong><span>보유</span></div>)}</div></section>
      </div>
    </div>
  </div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) { return <h3 className="section-title">{children}</h3>; }
function Metric({ label, value }: { label: string; value: React.ReactNode }) { return <div className="metric"><small>{label}</small><strong>{value}</strong></div>; }

function CharacterCreateScreen({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  const { snapshot, createCharacterDraft, updateCharacterDraft, finalizeCharacterDraft } = useSimpleVtt();
  const [importText, setImportText] = useState('{\n  "name": "새 캐릭터"\n}');
  if (!snapshot?.createDraft) return <div className="screen"><ScreenHead kicker="CHARACTER BUILDER" title="새 캐릭터"/><button className="primary" onClick={() => createCharacterDraft("guided")}>생성 시작</button></div>;
  const d = snapshot.createDraft;
  const blocking = d.validation.some((item) => item.severity === "blocking");
  return <div className="builder-screen">
    <div className="builder-top"><div><span className="eyebrow accent">CHARACTER BUILDER</span><h1>새 캐릭터</h1></div><div className="mode-tabs">{(["guided", "quick", "import", "duplicate"] as const).map((mode) => <button key={mode} className={d.mode === mode ? "active" : ""} onClick={() => createCharacterDraft(mode)}>{({ guided: "가이드 생성", quick: "빠른 생성", import: "JSON 가져오기", duplicate: "복제" } as const)[mode]}</button>)}</div><button onClick={onCancel}>닫기</button></div>
    <div className="builder-layout">
      <aside className="builder-steps">{CREATE_STEPS.map((label, index) => <button key={label} disabled={d.mode !== "guided"} className={d.step === index ? "active" : ""} onClick={() => updateCharacterDraft({ type: "set-step", value: index })}><b>{index + 1}</b><span>{label}</span></button>)}</aside>
      <section className="builder-main">{d.mode === "guided" ? <GuidedCreateStep draft={d} /> : d.mode === "quick" ? <QuickCreate draft={d} onReview={() => updateCharacterDraft({ type: "set-mode", value: "guided" }).then(() => updateCharacterDraft({ type: "set-step", value: 7 }))}/> : d.mode === "import" ? <ImportCreate value={importText} onChange={setImportText} onPreview={() => updateCharacterDraft({ type: "set-name", value: "가져온 캐릭터" })}/> : <DuplicateCreate draft={d}/>}</section>
      <aside className="builder-preview"><span className="eyebrow accent">LIVE PREVIEW</span><h2>{d.name || "이름 없음"}</h2><p>{d.className} {d.level} · {d.species} · {d.background}</p><div className="preview-metrics"><Metric label="HP" value={d.derived.hp}/><Metric label="AC" value={d.derived.ac}/><Metric label="이동" value={d.derived.speed}/><Metric label="숙련" value={`+${d.derived.proficiencyBonus}`}/></div><SectionTitle>능력치</SectionTitle><div className="ability-mini">{ABILITY_KEYS.map((key) => <span key={key}>{ABILITY_LABELS[key]} <b>{d.abilities[key]}</b></span>)}</div><SectionTitle>검증</SectionTitle><div className="validation-list">{d.validation.length === 0 && <div className="validation info">현재 Blocking 없음</div>}{d.validation.map((item, index) => <div key={`${item.message}-${index}`} className={`validation ${item.severity}`}>{item.severity.toUpperCase()} · {item.message}</div>)}</div><div className="builder-save">초안 자동 저장됨</div></aside>
    </div>
    <footer className="builder-footer"><button disabled={d.step === 0 || d.mode !== "guided"} onClick={() => updateCharacterDraft({ type: "set-step", value: Math.max(0, d.step - 1) })}>이전</button><span>{d.mode === "guided" ? `${d.step + 1} / ${CREATE_STEPS.length}` : "대체 생성 경로"}</span>{d.mode === "guided" && d.step < CREATE_STEPS.length - 1 ? <button className="primary" onClick={() => updateCharacterDraft({ type: "set-step", value: d.step + 1 })}>다음</button> : <button className="primary" disabled={blocking} onClick={async () => { await finalizeCharacterDraft(); onDone(); }}>캐릭터 생성</button>}</footer>
  </div>;
}

function GuidedCreateStep({ draft }: { draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  if (draft.step === 0) return <BuilderSection title="규칙 프로필" description="캐릭터의 규칙 의미와 사용할 콘텐츠 카탈로그를 결정합니다."><ChoiceCard active title="D&D SRD 5.2.1" meta="dnd.srd-5.2.1 · ko-KR" body="기본 RulesProfile 및 호환 RuleModule을 사용합니다."/></BuilderSection>;
  if (draft.step === 1) return <BuilderSection title="정체성" description="서술적 정보는 계산 규칙과 분리하여 저장합니다."><Field label="캐릭터 이름"><input value={draft.name} onChange={(e) => updateCharacterDraft({ type: "set-name", value: e.target.value })} placeholder="이름 입력" /></Field><Field label="메모"><textarea value={draft.notes} onChange={(e) => updateCharacterDraft({ type: "set-notes", value: e.target.value })} placeholder="외형, 성격, 플레이 메모" /></Field></BuilderSection>;
  if (draft.step === 2) return <BuilderSection title="핵심 빌드" description="클래스·종족·배경 선택의 기계적 결과는 RuleSource에서 파생됩니다."><div className="choice-grid"><SelectField label="클래스" value={draft.className} options={["전사", "도적", "마법사", "성직자"]} onChange={(value) => updateCharacterDraft({ type: "set-class", value })}/><SelectField label="종족" value={draft.species} options={["인간", "엘프", "드워프", "하플링"]} onChange={(value) => updateCharacterDraft({ type: "set-species", value })}/><SelectField label="배경" value={draft.background} options={["병사", "현자", "범죄자", "연예인"]} onChange={(value) => updateCharacterDraft({ type: "set-background", value })}/></div><div className="derived-callout"><b>자동 적용</b><span>선택한 콘텐츠의 AutomaticGrant는 즉시 Preview에 반영되고, ChoiceGrant만 다음 단계에서 질문합니다.</span></div></BuilderSection>;
  if (draft.step === 3) return <AbilityBuilder draft={draft}/>;
  if (draft.step === 4) return <BuilderSection title="숙련 · 내성" description="클래스 자동 숙련과 사용자가 골라야 하는 기술을 구분합니다."><div className="derived-callout"><b>자동 부여</b><span>근력 내성 · 건강 내성 · 모든 방어구 · 방패 · 단순/군용 무기</span></div><SectionTitle>기술 숙련 2개</SectionTitle><div className="chip-grid">{["운동", "곡예", "지각", "통찰", "생존", "위협"].map((skill) => <button key={skill} className={draft.selectedSkills.includes(skill) ? "chip selected" : "chip"} onClick={() => updateCharacterDraft({ type: "toggle-skill", value: skill })}>{skill}</button>)}</div></BuilderSection>;
  if (draft.step === 5) return <BuilderSection title="HP · 방어 · 이동" description="파생값은 기본적으로 직접 편집하지 않습니다."><div className="derived-grid"><Metric label="최대 HP" value={draft.derived.hp}/><Metric label="방어도" value={draft.derived.ac}/><Metric label="이동 속도" value={`${draft.derived.speed} ft`}/><Metric label="숙련 보너스" value={`+${draft.derived.proficiencyBonus}`}/></div><div className="calculation"><b>HP 계산</b><span>전사 1레벨 Hit Die 최대값 + 건강 수정치</span></div><div className="calculation"><b>AC 계산</b><span>선택한 방어구 + 방패 + 적용 가능한 RuleSource</span></div></BuilderSection>;
  if (draft.step === 6) return <BuilderSection title="기능 · 주문 · 장비" description="아이템과 기능이 부여하는 Action도 동일한 Action 모델로 들어갑니다."><SelectField label="시작 장비" value={draft.equipmentPreset} options={["chain-shield", "leather-kit"]} labels={{ "chain-shield": "체인 메일 + 방패 + 롱소드", "leather-kit": "가죽 갑옷 + 롱소드" }} onChange={(value) => updateCharacterDraft({ type: "set-equipment", value })}/><div className="feature-list"><article><strong>세컨드 윈드</strong><p>클래스 기능 · 자원 1/1 · 추가 행동</p></article><article><strong>무기 행동</strong><p>장착 아이템에서 Action Console로 연결</p></article></div></BuilderSection>;
  if (draft.step === 7) return <BuilderSection title="검토" description="저장할 source choice와 파생 결과를 분리해서 검토합니다."><ReviewRows draft={draft}/></BuilderSection>;
  return <BuilderSection title="완료" description="Blocking 항목이 없으면 Character Revision을 생성합니다."><div className="completion-card"><strong>{draft.name || "이름 없음"}</strong><p>{draft.className} 1 · {draft.species} · {draft.background}</p><span>생성 버튼을 누르면 로컬 Character source가 생성됩니다.</span></div></BuilderSection>;
}

function AbilityBuilder({ draft }: { draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const methods: Array<[AbilityMethod, string, string]> = [
    ["standard", "표준 배열", "15 / 14 / 13 / 12 / 10 / 8"],
    ["rolled", "무작위 생성", "4d6 중 가장 낮은 1개 제외 × 6"],
    ["point-buy", "포인트 구매", "27점 · 능력치 8~15"],
    ["custom", "커스텀", "직접 숫자 입력"],
  ];
  const pointUsed = ABILITY_KEYS.reduce((sum, key) => sum + (POINT_COST[draft.abilities[key]] ?? 99), 0);
  return <BuilderSection title="능력치" description="RulesProfile이 제공하는 공식 생성 방식과 명시적 커스텀 입력을 지원합니다."><div className="method-tabs">{methods.map(([id, title, subtitle]) => <button key={id} className={draft.abilityMethod === id ? "active" : ""} onClick={() => updateCharacterDraft({ type: "set-ability-method", value: id })}><strong>{title}</strong><span>{subtitle}</span></button>)}</div>{draft.abilityMethod === "rolled" && <div className="roll-pool"><div><b>현재 결과</b><span>{draft.rolledPool.join(" · ")}</span></div><button onClick={() => updateCharacterDraft({ type: "roll-abilities" })}>다시 굴리기</button></div>}{draft.abilityMethod === "point-buy" && <div className="point-budget"><strong>{pointUsed} / 27</strong><span>사용 포인트</span><i style={{ width: `${Math.min(100, pointUsed / 27 * 100)}%` }}/></div>}<div className="ability-builder-grid">{ABILITY_KEYS.map((key) => <div className="ability-editor" key={key}><span>{ABILITY_LABELS[key]}</span><strong>{draft.abilities[key]}</strong><b>{modifier(draft.abilities[key])}</b>{draft.abilityMethod === "standard" || draft.abilityMethod === "rolled" ? <select value={draft.abilities[key]} onChange={(e) => updateCharacterDraft({ type: "set-ability", ability: key, value: Number(e.target.value) })}>{(draft.abilityMethod === "standard" ? [15,14,13,12,10,8] : draft.rolledPool).map((value, index) => <option value={value} key={`${value}-${index}`}>{value}</option>)}</select> : <div className="score-controls"><button onClick={() => updateCharacterDraft({ type: "set-ability", ability: key, value: draft.abilities[key] - 1 })}>−</button><input type="number" value={draft.abilities[key]} min={draft.abilityMethod === "point-buy" ? 8 : 1} max={draft.abilityMethod === "point-buy" ? 15 : 30} onChange={(e) => updateCharacterDraft({ type: "set-ability", ability: key, value: Number(e.target.value) })}/><button onClick={() => updateCharacterDraft({ type: "set-ability", ability: key, value: draft.abilities[key] + 1 })}>+</button></div>}</div>)}</div>{draft.abilityMethod === "point-buy" && <div className="point-table">{Object.entries(POINT_COST).map(([score, cost]) => <span key={score}><b>{score}</b> = {cost}점</span>)}</div>}</BuilderSection>;
}

function QuickCreate({ draft, onReview }: { draft: CharacterCreateDraft; onReview(): void }) {
  const { updateCharacterDraft } = useSimpleVtt();
  return <BuilderSection title="빠른 생성" description="핵심 선택만 입력하고 나머지는 추천값으로 채운 뒤 검토합니다."><Field label="이름"><input value={draft.name} onChange={(e) => updateCharacterDraft({ type: "set-name", value: e.target.value })}/></Field><div className="choice-grid"><SelectField label="클래스" value={draft.className} options={["전사", "도적", "마법사"]} onChange={(value) => updateCharacterDraft({ type: "set-class", value })}/><SelectField label="종족" value={draft.species} options={["인간", "엘프", "드워프"]} onChange={(value) => updateCharacterDraft({ type: "set-species", value })}/><SelectField label="배경" value={draft.background} options={["병사", "현자", "범죄자"]} onChange={(value) => updateCharacterDraft({ type: "set-background", value })}/></div><button className="primary" onClick={onReview}>추천값 채우고 검토</button></BuilderSection>;
}
function ImportCreate({ value, onChange, onPreview }: { value: string; onChange(value: string): void; onPreview(): void }) { return <BuilderSection title="JSON 가져오기" description="구조 검증 → 의미 검증 → 사람이 읽는 Preview → 승인 순서입니다."><textarea className="json-box" value={value} onChange={(e) => onChange(e.target.value)}/><div className="import-status"><span className="ok">STRUCTURAL · 통과</span><span className="ok">SEMANTIC · Mock 통과</span></div><button className="primary" onClick={onPreview}>Preview에 반영</button></BuilderSection>; }
function DuplicateCreate({ draft }: { draft: CharacterCreateDraft }) { const { updateCharacterDraft } = useSimpleVtt(); return <BuilderSection title="복제" description="원본의 source choices를 복사하고 새 Character identity를 생성합니다."><ChoiceCard active title="Aelar" meta="전사 5 · 인간 · 병사" body="기존 캐릭터의 빌드와 장비 선택을 복제합니다."/><Field label="새 캐릭터 이름"><input value={draft.name} onChange={(e) => updateCharacterDraft({ type: "set-name", value: e.target.value })}/></Field></BuilderSection>; }

function BuilderSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="builder-section"><span className="eyebrow accent">STEP</span><h2>{title}</h2><p className="lead">{description}</p><div className="builder-section-body">{children}</div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function SelectField({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string,string>; onChange(value: string): void }) { return <Field label={label}><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option value={option} key={option}>{labels?.[option] ?? option}</option>)}</select></Field>; }
function ChoiceCard({ active, title, meta, body }: { active?: boolean; title: string; meta: string; body: string }) { return <div className={active ? "choice-card active" : "choice-card"}><span className="badge">{active ? "선택됨" : "선택"}</span><h3>{title}</h3><small>{meta}</small><p>{body}</p></div>; }
function ReviewRows({ draft }: { draft: CharacterCreateDraft }) { return <div className="review-rows"><div><span>RulesProfile</span><strong>{draft.rulesProfileId}</strong></div><div><span>빌드</span><strong>{draft.className} · {draft.species} · {draft.background}</strong></div><div><span>능력치 방식</span><strong>{draft.abilityMethod}</strong></div><div><span>HP / AC</span><strong>{draft.derived.hp} / {draft.derived.ac}</strong></div><div><span>기술 숙련</span><strong>{draft.selectedSkills.join(", ")}</strong></div></div>; }

function LevelUpScreen({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  const { snapshot, startLevelUp, updateLevelUp, commitLevelUp } = useSimpleVtt();
  const c = snapshot?.activeCharacter;
  const d = snapshot?.levelUpDraft;
  useEffect(() => { if (c && !d) void startLevelUp(c.id); }, [c, d, startLevelUp]);
  if (!c || !d) return <div className="loading-screen">ProgressionDraft 준비 중…</div>;
  const blocking = d.validation.some((item) => item.severity === "blocking");
  return <div className="builder-screen"><div className="builder-top"><div><span className="eyebrow accent">LEVEL UP</span><h1>{c.name} · {d.fromLevel} → {d.toLevel}</h1></div><button onClick={onCancel}>취소</button></div><div className="builder-layout level-layout"><aside className="builder-steps">{LEVEL_STEPS.map((label,index) => <button key={label} className={d.step === index ? "active" : ""} onClick={() => updateLevelUp({ type: "set-step", value: index })}><b>{index+1}</b><span>{label}</span></button>)}</aside><section className="builder-main"><LevelStep/></section><aside className="builder-preview"><span className="eyebrow accent">CHANGE PREVIEW</span><h2>{c.name} {d.toLevel}레벨</h2><SectionTitle>주요 변경</SectionTitle><div className="diff-list"><div><span>최대 HP</span><b>{d.preview.maxHpBefore}</b><i>→</i><strong>{d.preview.maxHpAfter}</strong></div>{ABILITY_KEYS.map((key) => d.preview.abilityBefore[key] !== d.preview.abilityAfter[key] && <div key={key}><span>{ABILITY_LABELS[key]}</span><b>{d.preview.abilityBefore[key]}</b><i>→</i><strong>{d.preview.abilityAfter[key]}</strong></div>)}</div><SectionTitle>자동 Grant</SectionTitle>{d.preview.grantedFeatures.map((item) => <div className="validation info" key={item}>{item}</div>)}{d.validation.map((item) => <div className={`validation ${item.severity}`} key={item.message}>{item.message}</div>)}</aside></div><footer className="builder-footer"><button disabled={d.step===0} onClick={() => updateLevelUp({ type: "set-step", value: d.step-1 })}>이전</button><span>{d.step+1} / {LEVEL_STEPS.length}</span>{d.step<LEVEL_STEPS.length-1 ? <button className="primary" onClick={() => updateLevelUp({ type: "set-step", value: d.step+1 })}>다음</button> : <button className="primary" disabled={blocking} onClick={async () => { await commitLevelUp(); onDone(); }}>레벨 업 적용</button>}</footer></div>;
}

function LevelStep() {
  const { snapshot, updateLevelUp } = useSimpleVtt();
  const c = snapshot!.activeCharacter;
  const d = snapshot!.levelUpDraft!;
  if (d.step===0) return <BuilderSection title="진행 확인" description="레벨 업은 현재 Character를 직접 바꾸지 않고 ProgressionDraft에서 먼저 계산합니다."><ChoiceCard active title={`${c.className} ${d.fromLevel} → ${d.toLevel}`} meta="진행 트랙: 전사" body="기존 source choices와 모듈 호환성을 기준으로 다음 레벨의 grants와 choices를 계산합니다."/></BuilderSection>;
  if (d.step===1) return <BuilderSection title="HP · 히트 다이스" description="전사 d10: 굴림 또는 규칙이 제공하는 고정값을 선택합니다."><div className="method-tabs"><button className={d.hpMethod==="fixed"?"active":""} onClick={() => updateLevelUp({type:"set-hp-method",value:"fixed"})}><strong>고정값</strong><span>6 + 건강 수정치 = +9 HP</span></button><button className={d.hpMethod==="roll"?"active":""} onClick={() => updateLevelUp({type:"set-hp-method",value:"roll"})}><strong>Hit Die 굴림</strong><span>Mock d10 8 + 건강 수정치 = +11 HP</span></button></div><div className="derived-callout"><b>Preview</b><span>최대 HP {d.preview.maxHpBefore} → {d.preview.maxHpAfter}</span></div></BuilderSection>;
  if (d.step===2) return <BuilderSection title="새 클래스 기능" description="결정적인 Grant는 자동 적용하고, 실제 선택만 사용자에게 질문합니다."><div className="feature-list"><article><strong>Ability Score Improvement</strong><p>6레벨 전사 progression grant · 다음 단계에서 능력치 향상 또는 적격 재주를 선택합니다.</p></article></div></BuilderSection>;
  if (d.step===3) return <BuilderSection title="능력치 · 재주" description="현재 ProgressionDraft가 요구하는 선택을 완료합니다."><div className="method-tabs"><button className={d.asiMode==="plus-two"?"active":""} onClick={() => updateLevelUp({type:"set-asi-mode",value:"plus-two"})}><strong>한 능력치 +2</strong><span>최대 20</span></button><button className={d.asiMode==="split"?"active":""} onClick={() => updateLevelUp({type:"set-asi-mode",value:"split"})}><strong>두 능력치 +1 / +1</strong><span>서로 다른 능력치</span></button><button className={d.asiMode==="feat"?"active":""} onClick={() => updateLevelUp({type:"set-asi-mode",value:"feat"})}><strong>적격 일반 재주</strong><span>카탈로그에서 선택</span></button></div>{d.asiMode!=="feat" ? <div className="choice-grid"><SelectField label="첫 번째 능력치" value={d.asiPrimary} options={ABILITY_KEYS} labels={ABILITY_LABELS} onChange={(value)=>updateLevelUp({type:"set-asi-primary",value})}/>{d.asiMode==="split"&&<SelectField label="두 번째 능력치" value={d.asiSecondary} options={ABILITY_KEYS} labels={ABILITY_LABELS} onChange={(value)=>updateLevelUp({type:"set-asi-secondary",value})}/>}</div> : <ChoiceCard active title="적격 일반 재주 선택" meta="ContentCatalog" body="실제 구현에서는 활성 RulesProfile/RuleModule의 적격 재주가 이 위치에 합성됩니다."/>}</BuilderSection>;
  return <BuilderSection title="변경 검토" description="현재 Character와 새 Revision의 차이를 검토한 뒤 한 번에 커밋합니다."><div className="review-rows"><div><span>레벨</span><strong>{d.fromLevel} → {d.toLevel}</strong></div><div><span>최대 HP</span><strong>{d.preview.maxHpBefore} → {d.preview.maxHpAfter}</strong></div><div><span>선택</span><strong>{d.asiMode}</strong></div><div><span>원본 유지</span><strong>현재 Character는 적용 버튼 전까지 변경되지 않음</strong></div></div></BuilderSection>;
}

function PlayerSceneScreen() {
  const { snapshot, resolveAction } = useSimpleVtt();
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all"|"basic"|"weapon"|"magic">("all");
  if (!snapshot) return null;
  const scene = snapshot.scene;
  const actorId = scene.currentActorId;
  const actor = scene.entities.find((entity) => entity.id===actorId)!;
  const actions = scene.actionsByActor[actorId] ?? [];
  const selectedAction = actions.find((action)=>action.id===selectedActionId) ?? null;
  const enemies = scene.entities.filter((entity)=>entity.side==="enemy");
  const allies = scene.entities.filter((entity)=>entity.side==="ally");
  const chooseTarget = async (entity: SceneEntity) => {
    if (!selectedAction || !isValidTarget(selectedAction, entity, actorId)) return;
    await resolveAction(selectedAction.id, entity.id);
    setSelectedActionId(null);
  };
  return <div className="screen scene-screen"><ScreenHead kicker="CURRENT SCENE" title={scene.name} description={snapshot.sessionMode==="initiative"?`${scene.round}라운드 · ${actor.name}의 턴`:"자유 진행 · 참가자와 장면 상태"} actions={snapshot.sessionMode==="initiative"?<button className="primary">턴 종료</button>:undefined}/><div className="scene-layout"><aside className="scene-side"><PanelTitle>{snapshot.sessionMode==="initiative"?"이니셔티브":"참가자"}</PanelTitle><EntityList entities={scene.entities} selectedAction={selectedAction} actorId={actorId} onTarget={chooseTarget}/><PanelTitle>파티</PanelTitle><EntityList entities={allies} selectedAction={selectedAction} actorId={actorId} onTarget={chooseTarget} compact/></aside><section className="scene-center"><div className="scene-stage"><div className="formation enemies">{enemies.map((entity)=><EntityPortrait key={entity.id} entity={entity} selectedAction={selectedAction} actorId={actorId} onTarget={chooseTarget}/>)}</div><div className="scene-context"><strong>{scene.name}</strong><span>장면 일러스트 영역 · 전술 격자 아님</span>{selectedAction&&<em>{selectedAction.name} · 대상을 클릭하세요</em>}</div><div className="formation allies">{allies.map((entity)=><EntityPortrait key={entity.id} entity={entity} selectedAction={selectedAction} actorId={actorId} onTarget={chooseTarget}/>)}</div></div><ActionConsole actor={actor} actions={actions} filter={filter} setFilter={setFilter} selectedActionId={selectedActionId} setSelectedActionId={setSelectedActionId} sessionMode={snapshot.sessionMode}/></section><aside className="scene-side"><PanelTitle>적</PanelTitle><EntityList entities={enemies} selectedAction={selectedAction} actorId={actorId} onTarget={chooseTarget} compact/><PanelTitle>현재 행동 주체</PanelTitle><Inspector entity={actor}/></aside></div></div>;
}

function DmSceneScreen() {
  const { snapshot, selectDmActor, resolveAction } = useSimpleVtt();
  const [selectedActionId, setSelectedActionId] = useState<string|null>(null);
  if (!snapshot) return null;
  const scene=snapshot.scene;
  const selectedActor=scene.entities.find((entity)=>entity.id===scene.selectedActorId) ?? scene.entities[0];
  const currentActor=scene.entities.find((entity)=>entity.id===scene.currentActorId)!;
  const actions=scene.actionsByActor[selectedActor.id]??[];
  const selectedAction=actions.find((action)=>action.id===selectedActionId)??null;
  const chooseTarget=async(entity:SceneEntity)=>{if(!selectedAction||!isValidTarget(selectedAction,entity,selectedActor.id))return;await resolveAction(selectedAction.id,entity.id);setSelectedActionId(null);};
  return <div className="screen scene-screen dm-screen"><ScreenHead kicker="DM SESSION" title={scene.name} description={`${snapshot.sessionMode==="initiative"?`${scene.round}라운드 · 현재 턴 ${currentActor.name}`:"자유 진행"} · 선택한 전투원 ${selectedActor.name}`}/><div className="scene-layout dm-layout"><aside className="scene-side"><PanelTitle>{snapshot.sessionMode==="initiative"?"전체 이니셔티브":"전체 참가자"}</PanelTitle><div className="actor-select-list">{scene.entities.map((entity)=><button key={entity.id} className={`${entity.id===selectedActor.id?"selected":""} ${entity.id===currentActor.id?"current":""}`} onClick={()=>selectDmActor(entity.id)}><span>{entity.initiative}</span><div><strong>{entity.name}</strong><small>{entity.kind} · HP {entity.hp}/{entity.maxHp}</small></div></button>)}</div><PanelTitle>연결 참가자</PanelTitle><div className="session-mini"><span className="ok-dot"/>Aelar · 연결됨</div><div className="session-mini"><span className="ok-dot"/>Mira · 연결됨</div></aside><section className="scene-center"><div className="scene-stage"><div className="formation enemies">{scene.entities.filter((e)=>e.side==="enemy").map((entity)=><EntityPortrait key={entity.id} entity={entity} selectedAction={selectedAction} actorId={selectedActor.id} onTarget={chooseTarget}/>)}</div><div className="scene-context"><strong>{scene.name}</strong><span>DM은 장면/목록 어디서든 같은 entityId를 선택합니다.</span>{selectedAction&&<em>{selectedAction.name} · 대상 선택</em>}</div><div className="formation allies">{scene.entities.filter((e)=>e.side==="ally").map((entity)=><EntityPortrait key={entity.id} entity={entity} selectedAction={selectedAction} actorId={selectedActor.id} onTarget={chooseTarget}/>)}</div></div><ActionConsole actor={selectedActor} actions={actions} filter="all" setFilter={()=>{}} selectedActionId={selectedActionId} setSelectedActionId={setSelectedActionId} sessionMode={snapshot.sessionMode}/></section><aside className="scene-side"><PanelTitle>전투원 Inspector</PanelTitle><Inspector entity={selectedActor}/><PanelTitle>세션 정보</PanelTitle><div className="session-data"><span>RulesProfile <b>dnd.srd-5.2.1</b></span><span>호환 상태 <b>정상</b></span><span>세션 콘텐츠 <b>1 module</b></span></div><PanelTitle>최근 판정</PanelTitle><div className="activity-mini">{snapshot.activity.slice(0,3).map((entry)=><div key={entry.id}><strong>{entry.title}</strong><span>{entry.summary}</span></div>)}</div></aside></div></div>;
}

function ActionConsole({actor,actions,filter,setFilter,selectedActionId,setSelectedActionId,sessionMode}:{actor:SceneEntity;actions:ActionVm[];filter:"all"|"basic"|"weapon"|"magic";setFilter(value:"all"|"basic"|"weapon"|"magic"):void;selectedActionId:string|null;setSelectedActionId(value:string|null):void;sessionMode:"freeform"|"initiative"}) {
  const visible=actions.filter((action)=>filter==="all"||action.category===filter);
  return <div className="action-console">{sessionMode==="initiative"&&<div className="economy-rail"><span><i/>행동</span><span><i/>추가 행동</span><span><i/>반응</span><span>이동 <b>30/30</b></span><span>세컨드 윈드 <b>1/1</b></span></div>}<div className="console-body"><div className="console-actor"><div className="avatar">{actor.name[0]}</div><div><strong>{actor.name}</strong><span>HP {actor.hp}/{actor.maxHp} · AC {actor.ac}</span></div></div><div className="console-actions"><div className="action-tabs">{(["all","basic","weapon","magic"] as const).map((id)=><button key={id} className={filter===id?"active":""} onClick={()=>setFilter(id)}>{({all:"전체",basic:"기본 행동",weapon:"무기",magic:"마법"} as const)[id]}</button>)}</div><div className="action-grid">{visible.map((action)=><button key={action.id} title={`${action.economy} · ${action.summary}`} disabled={!action.available} className={selectedActionId===action.id?"selected":""} onClick={()=>action.target==="self"?setSelectedActionId(action.id):setSelectedActionId(selectedActionId===action.id?null:action.id)}><b>{action.name.slice(0,2)}</b><span>{action.name}</span><small>{action.economy}</small></button>)}</div></div><div className="console-help">{selectedActionId?<><strong>Targeting</strong><span>유효한 Entity를 클릭</span><button onClick={()=>setSelectedActionId(null)}>취소</button></>:<><strong>Action</strong><span>행동을 선택하세요</span></>}</div></div></div>;
}

function isValidTarget(action:ActionVm,entity:SceneEntity,actorId:string){if(action.target==="self")return entity.id===actorId;if(action.target==="enemy"){const actorSide=actorId.startsWith("combatant")?"enemy":"ally";return entity.side!==actorSide;}if(action.target==="ally"){const actorSide=actorId.startsWith("combatant")?"enemy":"ally";return entity.side===actorSide;}return true;}
function EntityList({entities,selectedAction,actorId,onTarget,compact}:{entities:SceneEntity[];selectedAction:ActionVm|null;actorId:string;onTarget(entity:SceneEntity):void;compact?:boolean}){return <div className={compact?"entity-list compact":"entity-list"}>{entities.map((entity)=><button key={entity.id} className={selectedAction?(isValidTarget(selectedAction,entity,actorId)?"valid-target":"invalid-target"):""} onClick={()=>onTarget(entity)}><span className="initiative-number">{entity.initiative}</span><div><strong>{entity.name}</strong><small>{entity.status.join(" · ")||"정상"}</small></div><b>{entity.hp}/{entity.maxHp}</b></button>)}</div>}
function EntityPortrait({entity,selectedAction,actorId,onTarget}:{entity:SceneEntity;selectedAction:ActionVm|null;actorId:string;onTarget(entity:SceneEntity):void}){const valid=selectedAction?isValidTarget(selectedAction,entity,actorId):false;return <button className={`entity-portrait ${entity.side} ${selectedAction?(valid?"valid-target":"invalid-target"):""}`} onClick={()=>onTarget(entity)}><div className="portrait-art"><span>{entity.name[0]}</span></div><div><strong>{entity.name}</strong><small>{entity.distance??`${entity.hp}/${entity.maxHp} HP`} · {entity.status.join(" · ")||"정상"}</small></div></button>}
function PanelTitle({children}:{children:React.ReactNode}){return <div className="panel-title"><strong>{children}</strong></div>}
function Inspector({entity}:{entity:SceneEntity}){return <div className="inspector"><h2>{entity.name}</h2><div className="inspector-metrics"><Metric label="HP" value={`${entity.hp}/${entity.maxHp}`}/><Metric label="AC" value={entity.ac}/></div><div className="status-chips">{entity.status.length?entity.status.map((status)=><span key={status}>{status}</span>):<span>정상</span>}</div><p>{entity.kind==="character"?"Player Character projection":"Combatant encounter instance"}</p></div>}

function CombatantsScreen(){const {snapshot}=useSimpleVtt();if(!snapshot)return null;const enemies=snapshot.scene.entities.filter((entity)=>entity.kind==="combatant");return <div className="screen page-dark"><ScreenHead kicker="COMBATANTS" title="컴배턴트 라이브러리" description="재사용 Definition과 현재 세션 Instance를 분리합니다." actions={<button className="primary">JSON 가져오기</button>}/><div className="combatant-grid">{enemies.map((entity)=><article className="panel-card" key={entity.id}><span className="badge">Definition + Instance</span><h2>{entity.name}</h2><p>AC {entity.ac} · HP {entity.hp}/{entity.maxHp}</p><div className="status-chips">{entity.status.map((status)=><span key={status}>{status}</span>)}</div><button>세션에 인스턴스 추가</button></article>)}</div></div>}

function CatalogScreen(){const {snapshot}=useSimpleVtt();const [category,setCategory]=useState<"all"|CatalogEntry["category"]>("all");const [query,setQuery]=useState("");const [selectedId,setSelectedId]=useState<string|null>(null);if(!snapshot)return null;const filtered=snapshot.catalog.filter((entry)=>(category==="all"||entry.category===category)&&(`${entry.nameKo} ${entry.nameEn}`.toLowerCase().includes(query.toLowerCase())));const selected=snapshot.catalog.find((entry)=>entry.id===(selectedId??filtered[0]?.id));return <div className="screen page-dark"><ScreenHead kicker="RULES CONTENT" title="규칙 카탈로그" description="활성 호환 RuleModule의 콘텐츠를 한 카탈로그로 합성합니다." actions={<button className="primary">JSON 가져오기</button>}/><div className="catalog-layout"><aside className="catalog-categories">{(["all","feat","spell","class","subclass","species","background","item","condition","combatant"] as const).map((id)=><button key={id} className={category===id?"active":""} onClick={()=>setCategory(id)}>{id==="all"?"전체":categoryLabel(id)}</button>)}</aside><section className="catalog-list"><input placeholder="한국어 / English 검색" value={query} onChange={(e)=>setQuery(e.target.value)}/>{filtered.map((entry)=><button key={entry.id} className={(selected?.id===entry.id)?"selected":""} onClick={()=>setSelectedId(entry.id)}><span className="catalog-glyph">{entry.nameKo[0]}</span><div><strong>{entry.nameKo}</strong><small>{entry.nameEn} · {categoryLabel(entry.category)}</small></div><span className={`scope ${entry.scope}`}>{entry.scope}</span></button>)}</section><aside className="catalog-detail">{selected&&<><span className="eyebrow accent">{selected.source}</span><h2>{selected.nameKo}</h2><small>{selected.nameEn}</small><p>{selected.description}</p><div className="review-rows"><div><span>Scope</span><strong>{selected.scope}</strong></div><div><span>Identity</span><strong>{selected.id}</strong></div><div><span>Presentation</span><strong>ko-KR primary</strong></div></div></>}</aside></div></div>}

function ActivityScreen(){const {snapshot,undoLastResolution}=useSimpleVtt();if(!snapshot)return null;return <div className="screen page-dark"><ScreenHead kicker="ACTIVITY" title="활동 기록" description="판정, 상태 변화, DM 수정과 되돌림을 시간 순서로 확인합니다." actions={snapshot.resolution?<button onClick={()=>undoLastResolution()}>최근 판정 되돌림</button>:undefined}/><div className="activity-list">{snapshot.activity.map((entry)=><article key={entry.id} className={entry.correction?"activity-entry correction":"activity-entry"}><time>{entry.time}</time><div><span className="badge">{entry.actor}</span><h3>{entry.title}</h3><p>{entry.summary}</p><details><summary>상세 계산 / provenance</summary>{entry.detail.map((line)=><div key={line}>{line}</div>)}</details></div></article>)}</div></div>}

function SessionScreen(){const {snapshot}=useSimpleVtt();if(!snapshot)return null;return <div className="screen page-dark"><ScreenHead kicker="SESSION" title="금요일 세션" description="실제 네트워크는 후속 단계에서 같은 Adapter 계약 뒤에 연결합니다."/><div className="session-grid"><article className="panel-card"><span className={`status-text ${snapshot.connectionState}`}>{connectionLabel(snapshot.connectionState)}</span><h2>192.168.0.10:3210</h2><p>같은 Wi-Fi 또는 Hamachi 주소로 참가</p><div className="review-rows"><div><span>RulesProfile</span><strong>dnd.srd-5.2.1</strong></div><div><span>모듈 호환</span><strong>정상</strong></div></div></article><article className="panel-card"><h2>참가자</h2><div className="session-participant"><span className="ok-dot"/><strong>Aelar</strong><small>동기화됨</small></div><div className="session-participant"><span className="ok-dot"/><strong>Mira</strong><small>동기화됨</small></div></article></div></div>}

function SettingsScreen(){const [theme,setTheme]=useState<"dark"|"light">("dark");useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);return <div className="screen page-dark"><ScreenHead kicker="SETTINGS" title="환경 설정" description="디버그 상태 조작은 이 화면이 아니라 Ctrl+Shift+D 개발자 Dock에만 존재합니다."/><div className="settings-card"><SectionTitle>화면</SectionTitle><div className="method-tabs"><button className={theme==="dark"?"active":""} onClick={()=>setTheme("dark")}><strong>다크</strong><span>현재 장면 기본</span></button><button className={theme==="light"?"active":""} onClick={()=>setTheme("light")}><strong>라이트</strong><span>캐릭터 시트 친화</span></button></div><SectionTitle>언어</SectionTitle><div className="derived-callout"><b>한국어 우선</b><span>영문 원문 이름은 검색/출처 메타데이터로 유지합니다.</span></div></div></div>}

function ResolutionDrawer(){const {snapshot,applyDmAdjudication,undoLastResolution}=useSimpleVtt();const r=snapshot!.resolution!;return <aside className="resolution-drawer"><div className="drawer-head"><div><span className="eyebrow accent">RESOLUTION</span><h2>{r.actionName}</h2></div><span className={r.adjudicated?"badge warning":"badge"}>{r.adjudicated?"DM 수정됨":"계산 결과"}</span></div><div className="resolution-compact">{r.compact}</div><div className="review-rows"><div><span>계산 결과</span><strong>{r.calculatedOutcome}</strong></div><div><span>최종 결과</span><strong>{r.finalOutcome}</strong></div></div><details open><summary>상세 계산</summary>{r.detail.map((line)=><p key={line}>{line}</p>)}</details>{r.stateChanges.length>0&&<details><summary>StateChanges</summary>{r.stateChanges.map((line)=><p key={line}>{line}</p>)}</details>}<div className="drawer-actions">{snapshot!.role==="dm"&&<><button onClick={()=>applyDmAdjudication("failure")}>강제 실패</button><button onClick={()=>applyDmAdjudication("success")}>강제 성공</button></>}<button onClick={()=>undoLastResolution()}>Undo</button></div></aside>}

function DebugPanel({onClose}:{onClose():void}){const {snapshot,debug}=useSimpleVtt();if(!snapshot)return null;return <aside className="debug-panel"><header><div><span>SIMPLEVTT // DEBUG</span><strong>Reference State Controller</strong></div><button onClick={onClose}>닫기</button></header><section><DebugTitle>REFERENCE VIEW</DebugTitle><div className="debug-buttons"><button className={snapshot.role==="player"?"active":""} onClick={()=>debug.setRole("player")}>플레이어</button><button className={snapshot.role==="dm"?"active":""} onClick={()=>debug.setRole("dm")}>DM</button></div><DebugTitle>SESSION MODE</DebugTitle><div className="debug-buttons"><button className={snapshot.sessionMode==="initiative"?"active":""} onClick={()=>debug.setMode("initiative")}>이니셔티브</button><button className={snapshot.sessionMode==="freeform"?"active":""} onClick={()=>debug.setMode("freeform")}>자유 진행</button></div><DebugTitle>CURRENT TURN</DebugTitle><div className="debug-buttons wrap">{snapshot.scene.entities.map((entity)=><button key={entity.id} className={snapshot.scene.currentActorId===entity.id?"active":""} onClick={()=>debug.setCurrentActor(entity.id)}>{entity.name}</button>)}</div><DebugTitle>NEXT D20</DebugTitle><div className="debug-buttons"><button className={snapshot.queuedD20===20?"active":""} onClick={()=>debug.setQueuedD20(20)}>20</button><button className={snapshot.queuedD20===11?"active":""} onClick={()=>debug.setQueuedD20(11)}>11</button><button className={snapshot.queuedD20===1?"active":""} onClick={()=>debug.setQueuedD20(1)}>1</button><button className={snapshot.queuedD20===null?"active":""} onClick={()=>debug.setQueuedD20(null)}>자동</button></div><DebugTitle>CONNECTION</DebugTitle><div className="debug-buttons wrap">{(["connected","reconnecting","disconnected"] as const).map((state)=><button key={state} className={snapshot.connectionState===state?"active":""} onClick={()=>debug.setConnectionState(state)}>{state}</button>)}</div><DebugTitle>STATE</DebugTitle><pre>{JSON.stringify({role:snapshot.role,sessionMode:snapshot.sessionMode,currentActorId:snapshot.scene.currentActorId,selectedActorId:snapshot.scene.selectedActorId,queuedD20:snapshot.queuedD20,connection:snapshot.connectionState},null,2)}</pre></section></aside>}
function DebugTitle({children}:{children:React.ReactNode}){return <h3 className="debug-title">{children}</h3>}
