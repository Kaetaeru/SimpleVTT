import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type {
  AbilityKey,
  AbilityMethod,
  ActionVm,
  AdjudicationScope,
  AppRoute,
  CatalogEntry,
  CharacterCreateDraft,
  DamageComponentView,
  ItemInstanceVm,
  SceneEntity,
} from "./app/contracts";

const ABILITY_LABELS: Record<AbilityKey, string> = { str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" };
const ABILITY_KEYS = Object.keys(ABILITY_LABELS) as AbilityKey[];
const CREATE_STEPS = ["규칙 프로필", "정체성", "핵심 빌드", "능력치", "숙련·내성", "HP·방어·이동", "기능·주문·장비", "검토", "완료"];
const LEVEL_STEPS = ["진행 확인", "HP · 히트 다이스", "새 클래스 기능", "능력치 · 재주", "변경 검토"];
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

function modifier(score: number) {
  const value = Math.floor((score - 10) / 2);
  return value >= 0 ? `+${value}` : `${value}`;
}

function categoryLabel(category: CatalogEntry["category"]) {
  return ({ class: "클래스", subclass: "서브클래스", species: "종족", background: "배경", feat: "재주", spell: "주문", item: "장비", condition: "상태", combatant: "몬스터", option: "옵션" } as const)[category];
}

function connectionLabel(state: "connected" | "reconnecting" | "disconnected") {
  if (state === "connected") return "● 연결됨";
  if (state === "reconnecting") return "◌ 재연결 중";
  return "○ 연결 끊김";
}

export function App() {
  const { snapshot, loading } = useSimpleVtt();
  const [route, setRoute] = useState<AppRoute>("characters");
  const [debugOpen, setDebugOpen] = useState(false);
  const productionRole: "player" | "dm" = snapshot?.session.role === "host" ? "dm" : snapshot?.session.role === "client" ? "player" : snapshot?.role ?? "player";

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
    if (snapshot.session.role === "host" && ["characters", "character", "create", "levelup"].includes(route)) {
      setRoute("session");
      return;
    }
    if (productionRole === "dm" && ["characters", "character", "create", "levelup"].includes(route)) setRoute("scene");
  }, [snapshot, productionRole, route]);

  if (loading || !snapshot) return <div className="loading-screen">SimpleVTT 불러오는 중…</div>;

  const playerNav: Array<[AppRoute, string, string]> = [
    ["characters", "캐릭터", "◉"], ["scene", "플레이", "◆"], ["catalog", "규칙", "▤"], ["activity", "기록", "≡"], ["session", "세션", "⌁"], ["settings", "설정", "⚙"],
  ];
  const dmNav: Array<[AppRoute, string, string]> = [
    ["scene", "플레이", "◆"], ["combatants", "컴배턴트", "♜"], ["catalog", "규칙", "▤"], ["activity", "기록", "≡"], ["session", "세션", "⌁"], ["settings", "설정", "⚙"],
  ];
  const nav = productionRole === "player" ? playerNav : dmNav;
  const connectedSession=snapshot.session.role!=="offline";
  const liveSession=snapshot.session.lifecycle==="live";

  return (
    <div className="app-shell">
      <aside className="rail">
        <button className="brand" onClick={() => setRoute(productionRole === "player" ? "characters" : "scene")}>S</button>
        <nav className="rail-nav">
          {nav.map(([id, label, icon]) => (
            <button key={id} className={route === id || (id === "characters" && ["character", "create", "levelup"].includes(route)) ? "rail-button active" : "rail-button"} onClick={() => setRoute(id)} title={label}>
              <span className="rail-icon">{icon}</span><span className="rail-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-spacer" />
        {connectedSession && <div className={`connection-dot ${snapshot.connectionState}`} title={connectionLabel(snapshot.connectionState)} />}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">SimpleVTT</span><strong>{topTitle(route, productionRole)}</strong></div>
          <div className="topbar-meta">
            {liveSession && <span>{snapshot.sessionMode === "initiative" ? `이니셔티브 · ${snapshot.scene.round}라운드` : "자유 진행"}</span>}
            {connectedSession && <span className={`status-text ${snapshot.connectionState}`}>{connectionLabel(snapshot.connectionState)}</span>}
          </div>
        </header>
        <main className="content">
          {snapshot.edgeState !== "normal" && <EdgeBanner />}
          {snapshot.role === "player" && route === "characters" && <CharacterLibraryScreen onOpen={() => setRoute("character")} onCreate={() => setRoute("create")} />}
          {snapshot.role === "player" && route === "character" && <CharacterSheetScreen onScene={() => setRoute("scene")} onLevelUp={() => setRoute("levelup")} onEdit={() => setRoute("create")} />}
          {snapshot.role === "player" && route === "create" && <CharacterCreateScreen onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}
          {snapshot.role === "player" && route === "levelup" && <LevelUpScreen onDone={() => setRoute("character")} onCancel={() => setRoute("character")} />}
          {route === "scene" && (productionRole === "player" ? <PlayerSceneScreen /> : <DmSceneScreen />)}
          {route === "combatants" && productionRole === "dm" && <CombatantsScreen />}
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
  if (route === "characters") return "캐릭터";
  if (route === "character") return "캐릭터 시트";
  if (route === "create") return "캐릭터 생성 / 편집";
  if (route === "levelup") return "레벨 업";
  if (route === "scene") return role === "player" ? "플레이" : "DM 플레이";
  if (route === "combatants") return "Encounter";
  if (route === "catalog") return "규칙";
  if (route === "activity") return "플레이 기록";
  if (route === "session") return "세션";
  return "설정";
}

function EdgeBanner() {
  const { snapshot } = useSimpleVtt();
  if (!snapshot || snapshot.edgeState === "normal") return null;
  return <div className={`edge-banner ${snapshot.edgeState}`}><strong>{snapshot.edgeState === "save-error" ? "저장하지 못했습니다" : "이 콘텐츠는 현재 사용할 수 없습니다"}</strong><span>{snapshot.edgeState === "save-error" ? "변경 내용을 보존한 채 다시 저장해 주세요." : "다른 콘텐츠를 선택하거나 설정을 확인해 주세요."}</span></div>;
}

function ScreenHead({ kicker, title, description, actions }: { kicker: string; title: string; description?: string; actions?: ReactNode }) {
  return <div className="screen-head"><div><span className="eyebrow accent">{kicker}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="screen-actions">{actions}</div>}</div>;
}
function SectionTitle({ children }: { children: ReactNode }) { return <h3 className="section-title">{children}</h3>; }
function Metric({ label, value, provenance }: { label: string; value: ReactNode; provenance?: string[] }) {
  return <div className={provenance ? "metric provenance-host" : "metric"}><small>{label}</small><strong>{value}</strong>{provenance && <HoverCard lines={provenance} />}</div>;
}
function HoverCard({ lines }: { lines: string[] }) { return <div className="hover-card">{lines.map((line) => <span key={line}>{line}</span>)}</div>; }
function PanelTitle({ children }: { children: ReactNode }) { return <div className="panel-title"><strong>{children}</strong></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function BuilderSection({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <div className="builder-section"><span className="eyebrow accent">현재 단계</span><h2>{title}</h2><p className="lead">{description}</p><div className="builder-section-body">{children}</div></div>; }
function ChoiceCard({ active, title, meta, body, onClick }: { active?: boolean; title: string; meta: string; body: string; onClick?: () => void }) { return <button type="button" className={active ? "choice-card active" : "choice-card"} onClick={onClick}><span className="badge">{active ? "선택됨" : "선택"}</span><h3>{title}</h3><small>{meta}</small><p>{body}</p></button>; }
function SelectField({ label, value, options, labels, onChange }: { label: string; value: string; options: string[]; labels?: Record<string, string>; onChange(value: string): void }) { return <Field label={label}><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option} key={option}>{labels?.[option] ?? option}</option>)}</select></Field>; }

function CharacterLibraryScreen({ onOpen, onCreate }: { onOpen(): void; onCreate(): void }) {
  const { snapshot, createCharacterDraft } = useSimpleVtt();
  if (!snapshot) return null;
  return <div className="screen page-dark">
    <ScreenHead kicker="캐릭터" title="내 캐릭터" description="로컬 캐릭터와 작성 중인 초안을 관리합니다." actions={<button className="primary" onClick={async () => { await createCharacterDraft("guided"); onCreate(); }}>새 캐릭터</button>} />
    <div className="character-library-grid">
      {snapshot.createDraft && <button className="character-card draft-card" onClick={onCreate}><div className="character-card-portrait">…</div><div><span className="badge warning">작성 중</span><h2>{snapshot.createDraft.name || "이름 없는 초안"}</h2><p>{snapshot.createDraft.mode} · {snapshot.createDraft.step + 1}/{CREATE_STEPS.length} 단계</p><strong>초안 계속 작성</strong></div></button>}
      {snapshot.characters.map((character) => <button key={character.id} className="character-card" onClick={onOpen}><div className="character-card-portrait">{character.name.slice(0, 1)}</div><div><span className="badge">{character.saveState === "saved" ? "저장됨" : "초안"}</span><h2>{character.name}</h2><p>{character.className} {character.level} · {character.species} · {character.background}</p><div className="metric-strip"><span>HP <b>{character.hp}/{character.maxHp}</b></span><span>AC <b>{character.ac}</b></span></div></div></button>)}
      <button className="character-card utility" onClick={async () => { await createCharacterDraft("import"); onCreate(); }}><div className="utility-icon">{ }</div><h3>JSON 가져오기</h3><p>검증 → Preview → 승인</p></button>
    </div>
  </div>;
}

function CharacterSheetScreen({ onScene, onLevelUp, onEdit }: { onScene(): void; onLevelUp(): void; onEdit(): void }) {
  const { snapshot, startLevelUp, editCharacterDraft } = useSimpleVtt();
  if (!snapshot) return null;
  const c = snapshot.activeCharacter;
  return <div className="screen sheet-bg">
    <ScreenHead kicker="캐릭터 시트" title={c.name} description={`${c.className} ${c.level} · ${c.subclassName ?? "서브클래스 없음"} · ${c.species} · ${c.background}`} actions={<><button onClick={async () => { await editCharacterDraft(c.id); onEdit(); }}>편집</button><button onClick={onScene}>현재 장면</button><button className="primary" onClick={async () => { await startLevelUp(c.id); onLevelUp(); }}>레벨 업</button></>} />
    <div className="paper-sheet">
      <div className="sheet-identity"><div><small>캐릭터 이름</small><strong>{c.name}</strong></div><div><small>클래스 / 레벨</small><strong>{c.className} {c.level}</strong></div><div><small>종족</small><strong>{c.species}</strong></div><div><small>배경</small><strong>{c.background}</strong></div></div>
      <div className="sheet-columns">
        <section><SectionTitle>능력치 · 내성 · 기술</SectionTitle><div className="abilities">{ABILITY_KEYS.map((key) => <div className="ability provenance-host" key={key}><div><small>{ABILITY_LABELS[key]}</small><strong>{c.abilities[key]}</strong><b>{modifier(c.abilities[key])}</b></div><HoverCard lines={[`${ABILITY_LABELS[key]} 원본 능력치 ${c.abilities[key]}`, `수정치 ${modifier(c.abilities[key])}`, "Character source → derived modifier"]} /></div>)}</div><SectionTitle>내성</SectionTitle><div className="plain-list">{c.saves.map((item) => <span key={item}>{item}</span>)}</div><SectionTitle>기술</SectionTitle><div className="plain-list">{c.skills.map((item) => <span key={item}>{item}</span>)}</div></section>
        <section><SectionTitle>전투 핵심 수치</SectionTitle><div className="combat-metrics"><Metric label="방어도" value={c.ac} provenance={["체인 메일 16", "방패 +2", "최종 AC 18"]}/><Metric label="우선권" value={modifier(c.abilities.dex)} provenance={[`민첩 수정치 ${modifier(c.abilities.dex)}`, "우선권 계산에 적용"]}/><Metric label="이동" value={`${c.speed} ft`} provenance={["종족/효과/장비 contributions 합성"]}/></div><div className="hp-block"><div className="provenance-host"><small>현재 HP</small><strong>{c.hp} / {c.maxHp}</strong><HoverCard lines={[`최대 HP ${c.maxHp}`, `현재 HP ${c.hp}`, "StateChange로만 현재 HP 변경"]}/></div><div><small>임시 HP</small><strong>{c.tempHp}</strong></div></div><SectionTitle>공격 · 행동</SectionTitle><div className="rows">{c.attacks.map((attack) => <div className="row provenance-host" key={attack.id}><strong>{attack.name}</strong><span>+{attack.bonus}</span><span>{attack.damage}</span><HoverCard lines={[`명중 보너스 +${attack.bonus}`, `피해 ${attack.damage}`, "Action Registry projection"]}/></div>)}</div><SectionTitle>자원</SectionTitle><div className="rows">{c.resources.map((resource) => <div className="row provenance-host" key={resource.id}><strong>{resource.label}</strong><span>{resource.current} / {resource.max}</span><HoverCard lines={[resource.source, `현재 ${resource.current}/${resource.max}`]}/></div>)}</div></section>
        <section><SectionTitle>기능 · 재주</SectionTitle><div className="feature-list">{c.features.map((feature) => <article className="provenance-host" key={feature}><strong>{feature}</strong><p>Hover에서 출처와 기여를 확인합니다.</p><HoverCard lines={[`RuleSource: ${feature}`, "현재 Character Revision에서 활성"]}/></article>)}</div><SectionTitle>장비 · 소지품</SectionTitle><InventoryPanel /></section>
      </div>
    </div>
  </div>;
}

function InventoryPanel() {
  const { snapshot, toggleItemEquipped, toggleItemAttunement, useItem } = useSimpleVtt();
  if (!snapshot) return null;
  return <div className="inventory-list">{snapshot.activeCharacter.items.map((item) => <InventoryItem key={item.id} item={item} onEquip={() => toggleItemEquipped(item.id)} onAttune={() => toggleItemAttunement(item.id)} onUse={() => useItem(item.id)} />)}</div>;
}
function InventoryItem({ item, onEquip, onAttune, onUse }: { item: ItemInstanceVm; onEquip(): void; onAttune(): void; onUse(): void }) {
  const canUse = item.kind === "consumable" ? item.quantity > 0 : Boolean(item.charges && item.charges.current > 0);
  return <article className="inventory-item"><div><strong>{item.name}</strong><small>{item.nameEn}</small></div><div className="item-state"><span>{item.quantity > 1 ? `수량 ${item.quantity}` : item.equipped ? "장착" : "보관"}</span>{item.charges && <span>충전 {item.charges.current}/{item.charges.max}</span>}{item.attunementRequired && <span>{item.attuned ? "조율됨" : "미조율"}</span>}</div><div className="item-actions"><button onClick={onEquip}>{item.equipped ? "해제" : "장착"}</button>{item.attunementRequired && <button onClick={onAttune}>{item.attuned ? "조율 해제" : "조율"}</button>}{(item.kind === "consumable" || item.charges) && <button className="primary" disabled={!canUse} onClick={onUse}>빠른 사용</button>}</div><details><summary>왜 영향을 주나요?</summary>{item.passiveEffects.map((line) => <p key={line}>{line}</p>)}{item.provenance.map((line) => <p key={line}>{line}</p>)}{item.grantedActionIds.length > 0 && <p>제공 Action: {item.grantedActionIds.join(", ")}</p>}</details></article>;
}

function CharacterCreateScreen({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  const { snapshot, createCharacterDraft, updateCharacterDraft, finalizeCharacterDraft } = useSimpleVtt();
  const [importText, setImportText] = useState('{\n  "name": "새 캐릭터",\n  "className": "전사",\n  "subclassName": "챔피언",\n  "species": "인간",\n  "background": "병사"\n}');
  if (!snapshot?.createDraft) return <div className="screen"><ScreenHead kicker="캐릭터 생성" title="새 캐릭터"/><button className="primary" onClick={() => createCharacterDraft("guided")}>생성 시작</button></div>;
  const d = snapshot.createDraft;
  const blocking = d.validation.some((item) => item.severity === "blocking");
  return <div className="builder-screen">
    <div className="builder-top"><div><span className="eyebrow accent">{d.editingCharacterId ? "캐릭터 편집" : "캐릭터 생성"}</span><h1>{d.editingCharacterId ? d.name : "새 캐릭터"}</h1></div><div className="mode-tabs">{(["guided", "quick", "import", "duplicate"] as const).map((mode) => <button key={mode} className={d.mode === mode ? "active" : ""} onClick={() => createCharacterDraft(mode)}>{({ guided: "가이드 생성", quick: "빠른 생성", import: "JSON 가져오기", duplicate: "복제" } as const)[mode]}</button>)}</div><button onClick={onCancel}>닫기</button></div>
    <div className="builder-layout"><aside className="builder-steps">{CREATE_STEPS.map((label, index) => <button key={label} disabled={d.mode !== "guided"} className={d.step === index ? "active" : ""} onClick={() => updateCharacterDraft({ type: "set-step", value: index })}><b>{index + 1}</b><span>{label}</span></button>)}</aside><section className="builder-main">{d.mode === "guided" ? <GuidedCreateStep draft={d} /> : d.mode === "quick" ? <QuickCreate draft={d} onReview={() => updateCharacterDraft({ type: "set-mode", value: "guided" }).then(() => updateCharacterDraft({ type: "set-step", value: 7 }))}/> : d.mode === "import" ? <ImportCreate draft={d} value={importText} onChange={setImportText} onPreview={() => updateCharacterDraft({ type: "import-json", value: importText })}/> : <DuplicateCreate draft={d}/>}</section><aside className="builder-preview"><span className="eyebrow accent">실시간 Preview</span><h2>{d.name || "이름 없음"}</h2><p>{d.className} {d.level} · {d.subclassName || "서브클래스 미선택"} · {d.species} · {d.background}</p><div className="preview-metrics"><Metric label="HP" value={d.derived.hp}/><Metric label="AC" value={d.derived.ac}/><Metric label="이동" value={d.derived.speed}/><Metric label="숙련" value={`+${d.derived.proficiencyBonus}`}/></div><SectionTitle>능력치</SectionTitle><div className="ability-mini">{ABILITY_KEYS.map((key) => <span key={key}>{ABILITY_LABELS[key]} <b>{d.abilities[key]}</b></span>)}</div><SectionTitle>검증</SectionTitle><div className="validation-list">{d.validation.length === 0 && <div className="validation info">현재 Blocking 없음</div>}{d.validation.map((item, index) => <div key={`${item.message}-${index}`} className={`validation ${item.severity}`}>{item.severity.toUpperCase()} · {item.message}</div>)}</div><div className="builder-save">초안 자동 저장 · 취소 시 원본 Character 유지</div></aside></div>
    <footer className="builder-footer"><button disabled={d.step === 0 || d.mode !== "guided"} onClick={() => updateCharacterDraft({ type: "set-step", value: Math.max(0, d.step - 1) })}>이전</button><span>{d.mode === "guided" ? `${d.step + 1} / ${CREATE_STEPS.length}` : "대체 생성 경로"}</span>{d.mode === "guided" && d.step < CREATE_STEPS.length - 1 ? <button className="primary" onClick={() => updateCharacterDraft({ type: "set-step", value: d.step + 1 })}>다음</button> : <button className="primary" disabled={blocking} onClick={async () => { await finalizeCharacterDraft(); onDone(); }}>{d.editingCharacterId ? "변경 Revision 저장" : "캐릭터 생성"}</button>}</footer>
  </div>;
}

function GuidedCreateStep({ draft }: { draft: CharacterCreateDraft }) {
  const { snapshot, updateCharacterDraft } = useSimpleVtt();
  const [search, setSearch] = useState("");
  if (!snapshot) return null;
  if (draft.step === 0) return <BuilderSection title="규칙 프로필" description="캐릭터의 규칙 의미와 호환 콘텐츠 범위를 결정합니다."><ChoiceCard active title="D&D SRD 5.2.1" meta="dnd.srd-5.2.1 · ko-KR" body="기본 RulesProfile과 호환 RuleModule을 사용합니다."/></BuilderSection>;
  if (draft.step === 1) return <BuilderSection title="정체성" description="서술 정보는 규칙 계산과 분리해 저장합니다."><Field label="캐릭터 이름"><input value={draft.name} onChange={(event) => updateCharacterDraft({ type: "set-name", value: event.target.value })} placeholder="이름 입력" /></Field><Field label="메모"><textarea value={draft.notes} onChange={(event) => updateCharacterDraft({ type: "set-notes", value: event.target.value })} placeholder="외형, 성격, 플레이 메모" /></Field></BuilderSection>;
  if (draft.step === 2) {
    const choices = snapshot.catalog.filter((entry) => ["class", "subclass", "species", "background"].includes(entry.category) && `${entry.nameKo} ${entry.nameEn}`.toLowerCase().includes(search.toLowerCase()));
    return <BuilderSection title="핵심 빌드" description="한국어 이름과 영문 원문명으로 검색하고 RuleSource를 선택합니다."><Field label="콘텐츠 검색"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="전사 / Fighter / 챔피언 / Champion" /></Field><div className="catalog-choice-grid">{choices.map((entry) => <button key={entry.id} onClick={() => { if (entry.category === "class") void updateCharacterDraft({ type: "set-class", value: entry.nameKo }); if (entry.category === "subclass") void updateCharacterDraft({ type: "set-subclass", value: entry.nameKo }); if (entry.category === "species") void updateCharacterDraft({ type: "set-species", value: entry.nameKo }); if (entry.category === "background") void updateCharacterDraft({ type: "set-background", value: entry.nameKo }); }}><strong>{entry.nameKo}</strong><small>{entry.nameEn} · {entry.source}</small>{entry.relationships.map((relationship) => <span key={relationship.targetId}>{relationship.label}: {relationship.targetName}</span>)}</button>)}</div><div className="derived-callout"><b>현재 빌드</b><span>{draft.className} · {draft.subclassName} · {draft.species} · {draft.background}</span></div></BuilderSection>;
  }
  if (draft.step === 3) return <AbilityBuilder draft={draft}/>;
  if (draft.step === 4) return <BuilderSection title="숙련 · 내성" description="AutomaticGrant와 아직 해결되지 않은 Choice를 분리합니다."><div className="derived-callout"><b>자동 부여</b><span>근력 내성 · 건강 내성 · 모든 방어구 · 방패 · 단순/군용 무기</span></div><SectionTitle>기술 숙련 2개</SectionTitle><div className="chip-grid">{["운동", "곡예", "지각", "통찰", "생존", "위협"].map((skill) => <button key={skill} className={draft.selectedSkills.includes(skill) ? "chip selected" : "chip"} onClick={() => updateCharacterDraft({ type: "toggle-skill", value: skill })}>{skill}</button>)}</div><div className="choice-prompt"><strong>미해결 ChoiceDefinition</strong><span>{draft.selectedSkills.length}/2 선택 · 필요한 선택만 사용자에게 남깁니다.</span></div></BuilderSection>;
  if (draft.step === 5) return <DerivedStep draft={draft}/>;
  if (draft.step === 6) {
    const spells = snapshot.catalog.filter((entry) => entry.category === "spell");
    return <BuilderSection title="기능 · 주문 · 장비" description="장비/아이템이 제공하는 Action도 같은 Action 모델로 연결됩니다."><SelectField label="시작 장비" value={draft.equipmentPreset} options={["chain-shield", "leather-kit"]} labels={{ "chain-shield": "체인 메일 + 방패 + 롱소드", "leather-kit": "가죽 갑옷 + 롱소드" }} onChange={(value) => updateCharacterDraft({ type: "set-equipment", value })}/><SectionTitle>주문 / 기능 선택 예시</SectionTitle><div className="catalog-choice-grid">{spells.map((spell) => <button className={draft.selectedSpells.includes(spell.id) ? "selected" : ""} key={spell.id} onClick={() => updateCharacterDraft({ type: "toggle-spell", value: spell.id })}><strong>{spell.nameKo}</strong><small>{spell.nameEn}</small><span>{spell.source}</span></button>)}</div><div className="feature-list"><article><strong>세컨드 윈드</strong><p>AutomaticGrant · Resource + Action</p></article><article><strong>장착 아이템 Action</strong><p>ItemInstance → Action Registry → 현재 장면 콘솔</p></article></div></BuilderSection>;
  }
  if (draft.step === 7) return <BuilderSection title="검토" description="저장할 source choices, 파생값, override를 분리해 확인합니다."><ReviewRows draft={draft}/></BuilderSection>;
  return <BuilderSection title="완료" description="Blocking 항목이 없으면 새 Character Revision을 원자적으로 적용합니다."><div className="completion-card"><strong>{draft.name || "이름 없음"}</strong><p>{draft.className} {draft.level} · {draft.species} · {draft.background}</p><span>취소하면 현재 Character는 변경되지 않습니다.</span></div></BuilderSection>;
}

function DerivedStep({ draft }: { draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const [showOverride, setShowOverride] = useState(Object.keys(draft.overrides).length > 0);
  return <BuilderSection title="HP · 방어 · 이동" description="기본값은 RuleSource에서 파생하며, 필요한 경우에만 명시적 Override를 엽니다."><div className="derived-grid"><Metric label="최대 HP" value={draft.derived.hp} provenance={["전사 Hit Die 최대값 10", `건강 수정치 ${modifier(draft.abilities.con)}`, draft.overrides.hp !== undefined ? "수동 Override 적용" : "자동 계산"]}/><Metric label="방어도" value={draft.derived.ac} provenance={[draft.equipmentPreset === "chain-shield" ? "체인 메일 16 + 방패 2" : "장비 + 민첩 제한", draft.overrides.ac !== undefined ? "수동 Override 적용" : "자동 계산"]}/><Metric label="이동 속도" value={`${draft.derived.speed} ft`} provenance={[draft.overrides.speed !== undefined ? "수동 Override 적용" : "종족 기본값"]}/></div><button onClick={() => setShowOverride((value) => !value)}>{showOverride ? "수동 Override 닫기" : "수동 Override 열기"}</button>{showOverride && <div className="override-panel"><p>Override는 계산을 숨기지 않고 별도 provenance로 저장합니다.</p><div className="choice-grid">{(["hp", "ac", "speed"] as const).map((field) => <Field key={field} label={field.toUpperCase()}><input type="number" value={draft.overrides[field] ?? draft.derived[field]} onChange={(event) => updateCharacterDraft({ type: "set-override", field, value: Number(event.target.value) })}/></Field>)}</div><button onClick={() => updateCharacterDraft({ type: "clear-overrides" })}>Override 모두 제거</button></div>}</BuilderSection>;
}

function AbilityBuilder({ draft }: { draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const methods: Array<[AbilityMethod, string, string]> = [["standard", "표준 배열", "15 / 14 / 13 / 12 / 10 / 8"], ["rolled", "무작위 생성", "4d6 중 가장 낮은 1개 제외 × 6"], ["point-buy", "포인트 구매", "27점 · 능력치 8~15"], ["custom", "커스텀", "직접 숫자 입력"]];
  const pointUsed = ABILITY_KEYS.reduce((sum, key) => sum + (POINT_COST[draft.abilities[key]] ?? 99), 0);
  const usedStandard = ABILITY_KEYS.map((key) => draft.abilities[key]);
  return <BuilderSection title="능력치" description="공식 생성 방식과 커스텀을 분리하고 각 Roll Slot의 identity를 보존합니다."><div className="method-tabs">{methods.map(([id, title, subtitle]) => <button key={id} className={draft.abilityMethod === id ? "active" : ""} onClick={() => updateCharacterDraft({ type: "set-ability-method", value: id })}><strong>{title}</strong><span>{subtitle}</span></button>)}</div>{draft.abilityMethod === "standard" && <div className="roll-pool"><div><b>사용 현황</b><span>{STANDARD_ARRAY.map((value) => `${value}${usedStandard.includes(value) ? " ✓" : ""}`).join(" · ")}</span></div><button onClick={() => updateCharacterDraft({ type: "apply-recommended-array" })}>전사 추천 배치</button></div>}{draft.abilityMethod === "rolled" && <div className="roll-slot-pool">{draft.rolledPool.map((slot) => <div key={slot.id}><strong>{slot.total}</strong><span>{slot.dice.join(" + ")} · {slot.dropped} 제외</span><small>{slot.id}</small></div>)}<button onClick={() => updateCharacterDraft({ type: "roll-abilities" })}>4d6 × 6 다시 굴리기</button></div>}{draft.abilityMethod === "point-buy" && <div className="point-budget"><strong>{pointUsed} / 27</strong><span>사용 포인트 · 남은 {Math.max(0, 27 - pointUsed)}</span><i style={{ width: `${Math.min(100, pointUsed / 27 * 100)}%` }}/></div>}<div className="ability-builder-grid">{ABILITY_KEYS.map((key) => <AbilityEditor key={key} ability={key} draft={draft} pointUsed={pointUsed} />)}</div>{draft.abilityMethod === "point-buy" && <div className="point-table">{Object.entries(POINT_COST).map(([score, cost]) => <span key={score}><b>{score}</b> = {cost}점</span>)}</div>}</BuilderSection>;
}
function AbilityEditor({ ability, draft, pointUsed }: { ability: AbilityKey; draft: CharacterCreateDraft; pointUsed: number }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const score = draft.abilities[ability];
  if (draft.abilityMethod === "rolled") {
    const assignedElsewhere = new Set(ABILITY_KEYS.filter((key) => key !== ability).map((key) => draft.rolledAssignments[key]).filter(Boolean));
    return <div className="ability-editor"><span>{ABILITY_LABELS[ability]}</span><strong>{score}</strong><b>{modifier(score)}</b><select value={draft.rolledAssignments[ability] ?? ""} onChange={(event) => updateCharacterDraft({ type: "assign-roll", ability, value: event.target.value })}><option value="">Roll Slot 선택</option>{draft.rolledPool.map((slot) => <option value={slot.id} key={slot.id} disabled={assignedElsewhere.has(slot.id)}>{slot.total} · [{slot.dice.join(",")}]</option>)}</select></div>;
  }
  if (draft.abilityMethod === "standard") {
    const usedElsewhere = ABILITY_KEYS.filter((key) => key !== ability).map((key) => draft.abilities[key]);
    return <div className="ability-editor"><span>{ABILITY_LABELS[ability]}</span><strong>{score}</strong><b>{modifier(score)}</b><select value={score} onChange={(event) => updateCharacterDraft({ type: "set-ability", ability, value: Number(event.target.value) })}>{STANDARD_ARRAY.map((value) => <option value={value} key={value} disabled={usedElsewhere.includes(value)}>{value}</option>)}</select></div>;
  }
  const min = draft.abilityMethod === "point-buy" ? 8 : 1;
  const max = draft.abilityMethod === "point-buy" ? 15 : 30;
  const nextCost = draft.abilityMethod === "point-buy" && score < 15 ? pointUsed - (POINT_COST[score] ?? 0) + (POINT_COST[score + 1] ?? 99) : pointUsed;
  return <div className="ability-editor"><span>{ABILITY_LABELS[ability]}</span><strong>{score}</strong><b>{modifier(score)}</b><div className="score-controls"><button disabled={score <= min} onClick={() => updateCharacterDraft({ type: "set-ability", ability, value: score - 1 })}>−</button><input type="number" value={score} min={min} max={max} onChange={(event) => updateCharacterDraft({ type: "set-ability", ability, value: Number(event.target.value) })}/><button disabled={score >= max || (draft.abilityMethod === "point-buy" && nextCost > 27)} onClick={() => updateCharacterDraft({ type: "set-ability", ability, value: score + 1 })}>+</button></div></div>;
}

function QuickCreate({ draft, onReview }: { draft: CharacterCreateDraft; onReview(): void }) {
  const { updateCharacterDraft } = useSimpleVtt();
  return <BuilderSection title="빠른 생성" description="핵심 선택과 능력치 방식을 정하고 추천값을 채운 뒤 같은 검토 단계로 합류합니다."><Field label="이름"><input value={draft.name} onChange={(event) => updateCharacterDraft({ type: "set-name", value: event.target.value })}/></Field><div className="choice-grid"><SelectField label="클래스" value={draft.className} options={["전사", "도적", "마법사", "성직자"]} onChange={(value) => updateCharacterDraft({ type: "set-class", value })}/><SelectField label="종족" value={draft.species} options={["인간", "엘프", "드워프", "하플링"]} onChange={(value) => updateCharacterDraft({ type: "set-species", value })}/><SelectField label="배경" value={draft.background} options={["병사", "현자", "범죄자", "연예인"]} onChange={(value) => updateCharacterDraft({ type: "set-background", value })}/><SelectField label="능력치 방식" value={draft.abilityMethod} options={["standard", "rolled", "point-buy", "custom"]} labels={{ standard: "표준 배열", rolled: "무작위 생성", "point-buy": "포인트 구매", custom: "커스텀" }} onChange={(value) => updateCharacterDraft({ type: "set-ability-method", value })}/></div><button className="primary" onClick={onReview}>추천값 채우고 검토</button></BuilderSection>;
}
function ImportCreate({ draft, value, onChange, onPreview }: { draft: CharacterCreateDraft; value: string; onChange(value: string): void; onPreview(): void }) { return <BuilderSection title="JSON 가져오기" description="구조 검증 → 의미 검증 → 사람이 읽는 Preview → 승인 순서입니다."><textarea className="json-box" value={value} onChange={(event) => onChange(event.target.value)}/><button className="primary" onClick={onPreview}>검증하고 Preview</button>{draft.importStatus && draft.importStatus !== "idle" && <div className={`validation ${draft.importStatus === "valid" ? "info" : "blocking"}`}>{draft.importMessage}</div>}</BuilderSection>; }
function DuplicateCreate({ draft }: { draft: CharacterCreateDraft }) { const { updateCharacterDraft } = useSimpleVtt(); return <BuilderSection title="복제" description="원본 source choices를 복사하고 새 Character identity를 만듭니다."><ChoiceCard active title="Aelar" meta="전사 5 · 인간 · 병사" body="빌드/능력치/기본 장비 선택을 복제한 초안입니다."/><Field label="새 캐릭터 이름"><input value={draft.name} onChange={(event) => updateCharacterDraft({ type: "set-name", value: event.target.value })}/></Field></BuilderSection>; }
function ReviewRows({ draft }: { draft: CharacterCreateDraft }) { return <div className="review-rows"><div><span>RulesProfile</span><strong>{draft.rulesProfileId}</strong></div><div><span>빌드</span><strong>{draft.className} · {draft.subclassName} · {draft.species} · {draft.background}</strong></div><div><span>능력치 방식</span><strong>{draft.abilityMethod}</strong></div><div><span>HP / AC / 이동</span><strong>{draft.derived.hp} / {draft.derived.ac} / {draft.derived.speed}</strong></div><div><span>숙련</span><strong>{draft.selectedSkills.join(", ")}</strong></div><div><span>주문 선택</span><strong>{draft.selectedSpells.join(", ") || "없음"}</strong></div><div><span>Override</span><strong>{Object.keys(draft.overrides).length ? JSON.stringify(draft.overrides) : "없음"}</strong></div></div>; }

function LevelUpScreen({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  const { snapshot, startLevelUp, updateLevelUp, commitLevelUp } = useSimpleVtt();
  const c = snapshot?.activeCharacter;
  const d = snapshot?.levelUpDraft;
  useEffect(() => { if (c && !d) void startLevelUp(c.id); }, [c, d, startLevelUp]);
  if (!c || !d) return <div className="loading-screen">ProgressionDraft 준비 중…</div>;
  const blocking = d.validation.some((item) => item.severity === "blocking");
  return <div className="builder-screen"><div className="builder-top"><div><span className="eyebrow accent">레벨 업</span><h1>{c.name} · {d.fromLevel} → {d.toLevel}</h1></div><button onClick={onCancel}>취소</button></div><div className="builder-layout level-layout"><aside className="builder-steps">{LEVEL_STEPS.map((label, index) => <button key={label} className={d.step === index ? "active" : ""} onClick={() => updateLevelUp({ type: "set-step", value: index })}><b>{index + 1}</b><span>{label}</span></button>)}</aside><section className="builder-main"><LevelStep/></section><aside className="builder-preview"><span className="eyebrow accent">Before → After</span><h2>{c.name} {d.toLevel}레벨</h2><div className="diff-list rich">{d.preview.diffs.map((diff) => <div key={diff.label}><span>{diff.label}<small>{diff.source}</small></span><b>{diff.before}</b><i>→</i><strong>{diff.after}</strong></div>)}</div><SectionTitle>검증</SectionTitle>{d.validation.length === 0 && <div className="validation info">Blocking 없음</div>}{d.validation.map((item) => <div className={`validation ${item.severity}`} key={item.message}>{item.message}</div>)}</aside></div><footer className="builder-footer"><button disabled={d.step === 0} onClick={() => updateLevelUp({ type: "set-step", value: d.step - 1 })}>이전</button><span>{d.step + 1} / {LEVEL_STEPS.length}</span>{d.step < LEVEL_STEPS.length - 1 ? <button className="primary" onClick={() => updateLevelUp({ type: "set-step", value: d.step + 1 })}>다음</button> : <button className="primary" disabled={blocking} onClick={async () => { await commitLevelUp(); onDone(); }}>새 Revision 적용</button>}</footer></div>;
}
function LevelStep() {
  const { snapshot, updateLevelUp } = useSimpleVtt();
  const c = snapshot!.activeCharacter;
  const d = snapshot!.levelUpDraft!;
  const eligibleFeats = snapshot!.catalog.filter((entry) => entry.category === "feat");
  if (d.step === 0) return <BuilderSection title="진행 확인" description="현재 Character를 직접 바꾸지 않고 ProgressionDraft에서 grants와 choices를 계산합니다."><ChoiceCard active title={`${c.className} ${d.fromLevel} → ${d.toLevel}`} meta={`숙련 +${d.preview.proficiencyBefore} → +${d.preview.proficiencyAfter}`} body={`Hit Dice ${d.preview.hitDiceBefore} → ${d.preview.hitDiceAfter} · 새 기능 ${d.preview.grantedFeatures.join(", ")}`}/></BuilderSection>;
  if (d.step === 1) return <BuilderSection title="HP · 히트 다이스" description="고정값 또는 Hit Die 굴림을 선택하고 Max HP 변화를 Preview합니다."><div className="method-tabs"><button className={d.hpMethod === "fixed" ? "active" : ""} onClick={() => updateLevelUp({ type: "set-hp-method", value: "fixed" })}><strong>고정값</strong><span>6 + 건강 수정치 = +9 HP</span></button><button className={d.hpMethod === "roll" ? "active" : ""} onClick={() => updateLevelUp({ type: "set-hp-method", value: "roll" })}><strong>Hit Die 굴림</strong><span>Reference d10 8 + 건강 수정치 = +11 HP</span></button></div><div className="derived-callout"><b>Preview</b><span>최대 HP {d.preview.maxHpBefore} → {d.preview.maxHpAfter} · Hit Dice {d.preview.hitDiceBefore} → {d.preview.hitDiceAfter}</span></div></BuilderSection>;
  if (d.step === 2) return <BuilderSection title="새 클래스 기능" description="AutomaticGrant는 자동으로, 선택이 필요한 항목만 다음 단계로 보냅니다."><div className="feature-list"><article><strong>Ability Score Improvement</strong><p>전사 6레벨 Progression Grant</p></article>{d.preview.resourceChanges.map((change) => <article key={change}><strong>Resource Capacity</strong><p>{change}</p></article>)}</div></BuilderSection>;
  if (d.step === 3) return <BuilderSection title="능력치 · 재주" description="RulesProfile/ContentCatalog가 제공하는 실제 Choice 후보에서 선택합니다."><div className="method-tabs"><button className={d.asiMode === "plus-two" ? "active" : ""} onClick={() => updateLevelUp({ type: "set-asi-mode", value: "plus-two" })}><strong>한 능력치 +2</strong><span>최대 20</span></button><button className={d.asiMode === "split" ? "active" : ""} onClick={() => updateLevelUp({ type: "set-asi-mode", value: "split" })}><strong>두 능력치 +1 / +1</strong><span>서로 다른 능력치</span></button><button className={d.asiMode === "feat" ? "active" : ""} onClick={() => updateLevelUp({ type: "set-asi-mode", value: "feat" })}><strong>적격 재주</strong><span>ContentCatalog</span></button></div>{d.asiMode !== "feat" ? <div className="choice-grid"><SelectField label="첫 번째 능력치" value={d.asiPrimary} options={ABILITY_KEYS} labels={ABILITY_LABELS} onChange={(value) => updateLevelUp({ type: "set-asi-primary", value })}/>{d.asiMode === "split" && <SelectField label="두 번째 능력치" value={d.asiSecondary} options={ABILITY_KEYS} labels={ABILITY_LABELS} onChange={(value) => updateLevelUp({ type: "set-asi-secondary", value })}/>}</div> : <div className="catalog-choice-grid">{eligibleFeats.map((feat) => <button className={d.featId === feat.id ? "selected" : ""} key={feat.id} onClick={() => updateLevelUp({ type: "set-feat", value: feat.id })}><strong>{feat.nameKo}</strong><small>{feat.nameEn}</small><span>{feat.source}</span></button>)}</div>}</BuilderSection>;
  return <BuilderSection title="변경 검토" description="Level, HP, Hit Dice, Ability, Proficiency, Feature, Resource, Action, Spell, 장비 파생값을 한 화면에서 확인합니다."><div className="review-rows">{d.preview.diffs.map((diff) => <div key={diff.label}><span>{diff.label}</span><strong>{diff.before} → {diff.after} · {diff.source}</strong></div>)}</div></BuilderSection>;
}

function useTargeting(actorId: string, actions: ActionVm[]) {
  const { resolveAction, setUiDebug } = useSimpleVtt();
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const selectedAction = actions.find((action) => action.id === selectedActionId) ?? null;

  useEffect(() => {
    setUiDebug({ selectedActionId, eligibleTargetIds: selectedAction?.eligibleTargetIds ?? [], selectedTargetIds });
  }, [selectedActionId, selectedAction, selectedTargetIds, setUiDebug]);

  const chooseAction = async (action: ActionVm) => {
    if (!action.available) return;
    if (action.target === "none") { setSelectedActionId(null); setSelectedTargetIds([]); await resolveAction(action.id, []); return; }
    if (action.target === "self") { setSelectedActionId(null); setSelectedTargetIds([]); await resolveAction(action.id, [actorId]); return; }
    setSelectedActionId((current) => current === action.id ? null : action.id);
    setSelectedTargetIds([]);
  };

  const chooseTarget = async (entity: SceneEntity) => {
    if (!selectedAction || !selectedAction.eligibleTargetIds.includes(entity.id)) return;
    if (selectedAction.target === "multi-enemy") {
      setSelectedTargetIds((current) => current.includes(entity.id) ? current.filter((id) => id !== entity.id) : current.length >= (selectedAction.maxTargets ?? 99) ? current : [...current, entity.id]);
      return;
    }
    await resolveAction(selectedAction.id, [entity.id]);
    setSelectedActionId(null);
    setSelectedTargetIds([]);
  };

  const completeMulti = async () => {
    if (!selectedAction || selectedTargetIds.length === 0) return;
    await resolveAction(selectedAction.id, selectedTargetIds);
    setSelectedActionId(null);
    setSelectedTargetIds([]);
  };
  const cancel = () => { setSelectedActionId(null); setSelectedTargetIds([]); };
  return { selectedAction, selectedActionId, selectedTargetIds, chooseAction, chooseTarget, completeMulti, cancel };
}

function PlayerSceneScreen() {
  const { snapshot, endTurn, setUiDebug } = useSimpleVtt();
  const [filter, setFilter] = useState<"all" | "basic" | "weapon" | "magic">("all");
  if (!snapshot) return null;
  const scene = snapshot.scene;
  const actorId = snapshot.sessionMode === "initiative" ? scene.currentActorId : snapshot.activeCharacter.id;
  const actor = scene.entities.find((entity) => entity.id === actorId) ?? scene.entities.find((entity) => entity.id === snapshot.activeCharacter.id);
  const actions = actor ? scene.actionsByActor[actor.id] ?? [] : [];
  const targeting = useTargeting(actor?.id ?? "", actions);
  if (!actor) return <div className="screen scene-screen"><ScreenHead kicker="PLAY" title={snapshot.session.name || scene.name} description="플레이할 캐릭터가 아직 장면에 없습니다."/><section className="play-empty-state"><h2>장면 참가를 기다리는 중입니다</h2><p>세션 연결 상태를 확인하거나 Host가 플레이를 시작할 때까지 기다려 주세요.</p></section></div>;
  const enemies = scene.entities.filter((entity) => entity.side === "enemy");
  const allies = scene.entities.filter((entity) => entity.side === "ally");
  const currentTarget = targeting.selectedTargetIds[0] ? scene.entities.find((entity) => entity.id === targeting.selectedTargetIds[0]) : snapshot.resolution?.targetIds[0] ? scene.entities.find((entity) => entity.id === snapshot.resolution?.targetIds[0]) : undefined;
  const canEndTurn = snapshot.sessionMode === "initiative" && scene.currentActorId === snapshot.activeCharacter.id;
  return <div className="screen scene-screen"><ScreenHead kicker="PLAY" title={snapshot.session.role === "client" ? snapshot.session.name : scene.name} description={snapshot.sessionMode === "initiative" ? `${scene.round}라운드 · ${scene.entities.find((entity) => entity.id === scene.currentActorId)?.name ?? "다음 참가자"}의 턴` : "자유 진행"} actions={canEndTurn ? <button className="primary" onClick={() => endTurn()}>턴 종료</button> : undefined}/><div className="scene-layout focused-scene-layout"><aside className="scene-side"><PanelTitle>{snapshot.sessionMode === "initiative" ? "이니셔티브" : "참가자"}</PanelTitle><EntityList entities={scene.entities} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onHover={(id) => setUiDebug({ hoverTargetId: id })}/></aside><section className="scene-center"><div className="scene-stage"><div className="formation enemies">{enemies.map((entity) => <EntityPortrait key={entity.id} entity={entity} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onHover={(id) => setUiDebug({ hoverTargetId: id })}/>)}</div><div className="scene-context"><strong>{targeting.selectedAction ? targeting.selectedAction.name : scene.name}</strong><span>{targeting.selectedAction ? "유효한 대상을 선택하세요." : "행동을 선택하고 필요한 대상을 지정하세요."}</span></div><div className="formation allies">{allies.map((entity) => <EntityPortrait key={entity.id} entity={entity} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onHover={(id) => setUiDebug({ hoverTargetId: id })}/>)}</div></div><ActionConsole actor={actor} actions={actions} economy={scene.economyByActor[actor.id]} resources={snapshot.activeCharacter.resources.map((resource) => `${resource.label} ${resource.current}/${resource.max}`)} filter={filter} setFilter={setFilter} selectedActionId={targeting.selectedActionId} selectedTargetIds={targeting.selectedTargetIds} onAction={targeting.chooseAction} onCancel={targeting.cancel} onCompleteMulti={targeting.completeMulti} sessionMode={snapshot.sessionMode}/></section><aside className="scene-side"><PanelTitle>{currentTarget ? "현재 대상" : "내 캐릭터"}</PanelTitle><Inspector entity={currentTarget ?? actor}/>{snapshot.session.role !== "offline" && <><PanelTitle>세션</PanelTitle><div className="session-mini"><span className={snapshot.connectionState === "connected" ? "ok-dot" : "warn-dot"}/>{connectionLabel(snapshot.connectionState)}</div></>}</aside></div>{targeting.selectedAction && <TargetingOverlay />}</div>;
}

function DmSceneScreen() {
  const { snapshot, selectDmActor, startInitiative, endInitiative, endTurn, setUiDebug } = useSimpleVtt();
  const [filter, setFilter] = useState<"all" | "basic" | "weapon" | "magic">("all");
  if (!snapshot) return null;
  const scene = snapshot.scene;
  const selectedActor = scene.entities.find((entity) => entity.id === scene.selectedActorId) ?? scene.entities[0];
  const currentActor = scene.entities.find((entity) => entity.id === scene.currentActorId) ?? scene.entities[0];
  const actions = selectedActor ? scene.actionsByActor[selectedActor.id] ?? [] : [];
  const targeting = useTargeting(selectedActor?.id ?? "", actions);
  if (!selectedActor||!currentActor) return <div className="screen scene-screen dm-screen"><ScreenHead kicker="DM PLAY" title={snapshot.session.name || scene.name} description="아직 플레이 참가자가 없습니다."/><section className="play-empty-state"><span className="eyebrow accent">ENCOUNTER</span><h2>Encounter가 비어 있습니다</h2><p>세션 화면에서 플레이어 참가를 기다리거나 Combatant 화면에서 필요한 전투원을 추가하세요. 기본 몬스터는 자동으로 배치되지 않습니다.</p></section></div>;
  const controls = snapshot.sessionMode === "freeform" ? <button className="primary" onClick={() => startInitiative()}>이니셔티브 시작</button> : <><button className="primary" onClick={() => endTurn()}>다음 턴</button><button onClick={() => endInitiative()}>이니셔티브 종료</button></>;
  const connectedPlayers=snapshot.session.participants.filter((participant)=>participant.id!=="host");
  return <div className="screen scene-screen dm-screen"><ScreenHead kicker="DM PLAY" title={snapshot.session.name || scene.name} description={snapshot.sessionMode === "initiative" ? `${scene.round}라운드 · 현재 턴 ${currentActor.name}` : `자유 진행 · ${selectedActor.name} 선택됨`} actions={controls}/><div className="scene-layout dm-layout focused-scene-layout"><aside className="scene-side"><PanelTitle>{snapshot.sessionMode === "initiative" ? "이니셔티브" : "Encounter"}</PanelTitle><div className="actor-select-list">{[...scene.entities].sort((a, b) => b.initiative - a.initiative).map((entity) => <button key={entity.id} className={`${entity.id === selectedActor.id ? "selected" : ""} ${entity.id === currentActor.id ? "current" : ""}`} onClick={() => selectDmActor(entity.id)}><span>{snapshot.sessionMode === "initiative" ? entity.initiative : "·"}</span><div><strong>{entity.name}</strong><small>HP {entity.hp}/{entity.maxHp} · AC {entity.ac}</small></div></button>)}</div>{connectedPlayers.length>0&&<><PanelTitle>플레이어</PanelTitle>{connectedPlayers.map((participant) => <div className="session-mini" key={participant.id}><span className={participant.state === "connected" ? "ok-dot" : "warn-dot"}/>{participant.characterName ?? participant.name}</div>)}</>}</aside><section className="scene-center"><div className="scene-stage"><div className="formation enemies">{scene.entities.filter((entity) => entity.side === "enemy").map((entity) => <EntityPortrait key={entity.id} entity={entity} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onIdle={() => selectDmActor(entity.id)} onHover={(id) => setUiDebug({ hoverTargetId: id })}/>)}</div><div className="scene-context"><strong>{targeting.selectedAction ? targeting.selectedAction.name : selectedActor.name}</strong><span>{targeting.selectedAction ? "판정할 대상을 선택하세요." : "행동할 전투원을 선택한 뒤 행동을 고르세요."}</span></div><div className="formation allies">{scene.entities.filter((entity) => entity.side === "ally").map((entity) => <EntityPortrait key={entity.id} entity={entity} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onIdle={() => selectDmActor(entity.id)} onHover={(id) => setUiDebug({ hoverTargetId: id })}/>)}</div></div><ActionConsole actor={selectedActor} actions={actions} economy={scene.economyByActor[selectedActor.id]} resources={selectedActor.id === snapshot.activeCharacter.id ? snapshot.activeCharacter.resources.map((resource) => `${resource.label} ${resource.current}/${resource.max}`) : []} filter={filter} setFilter={setFilter} selectedActionId={targeting.selectedActionId} selectedTargetIds={targeting.selectedTargetIds} onAction={targeting.chooseAction} onCancel={targeting.cancel} onCompleteMulti={targeting.completeMulti} sessionMode={snapshot.sessionMode}/></section><aside className="scene-side"><PanelTitle>선택한 전투원</PanelTitle><Inspector entity={selectedActor}/><PanelTitle>최근 결과</PanelTitle><div className="activity-mini">{snapshot.activity.slice(0, 3).map((entry) => <div key={entry.id}><strong>{entry.title}</strong><span>{entry.summary}</span></div>)}</div></aside></div>{targeting.selectedAction && <TargetingOverlay />}</div>;
}

function ActionConsole({ actor, actions, economy, resources, filter, setFilter, selectedActionId, selectedTargetIds, onAction, onCancel, onCompleteMulti, sessionMode }: { actor: SceneEntity; actions: ActionVm[]; economy: { action: boolean; bonusAction: boolean; reaction: boolean; movement: number; movementMax: number } | undefined; resources: string[]; filter: "all" | "basic" | "weapon" | "magic"; setFilter(value: "all" | "basic" | "weapon" | "magic"): void; selectedActionId: string | null; selectedTargetIds: string[]; onAction(action: ActionVm): void; onCancel(): void; onCompleteMulti(): void; sessionMode: "freeform" | "initiative" }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const visible = actions.filter((action) => filter === "all" || action.category === filter);
  const selected = actions.find((action) => action.id === selectedActionId);
  const hoveredAction = actions.find((action) => action.id === hovered);
  return <div className="action-console">{sessionMode === "initiative" && economy && <div className="economy-rail"><span className={economy.action ? "available" : "spent"}><i/>행동 {economy.action ? "사용 가능" : "사용함"}</span><span className={economy.bonusAction ? "available" : "spent"}><i/>추가 행동 {economy.bonusAction ? "사용 가능" : "사용함"}</span><span className={economy.reaction ? "available" : "spent"}><i/>반응 {economy.reaction ? "사용 가능" : "사용함"}</span><span>이동 <b>{economy.movement}/{economy.movementMax}</b></span>{resources.map((resource) => <span key={resource}>{resource}</span>)}</div>}{sessionMode === "freeform" && resources.length > 0 && <div className="economy-rail persistent-only">{resources.map((resource) => <span key={resource}>{resource}</span>)}</div>}<div className="console-body"><div className="console-actor"><div className="avatar">{actor.name[0]}</div><div><strong>{actor.name}</strong><span>HP {actor.hp}/{actor.maxHp} · AC {actor.ac}</span></div></div><div className="console-actions"><div className="action-tabs">{(["all", "basic", "weapon", "magic"] as const).map((id) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{({ all: "전체", basic: "기본 행동", weapon: "무기", magic: "마법" } as const)[id]}</button>)}</div><div className="action-grid">{visible.map((action) => <button key={action.id} data-action-id={action.id} data-selected-action-anchor={selectedActionId === action.id ? "true" : undefined} disabled={!action.available} className={selectedActionId === action.id ? "selected provenance-host" : "provenance-host"} onMouseEnter={() => setHovered(action.id)} onMouseLeave={() => setHovered(null)} onClick={() => onAction(action)}><b>{action.name.slice(0, 2)}</b><span>{action.name}</span><small>{action.economy}</small>{!action.available && <em>사용 불가</em>}</button>)}</div>{hoveredAction && <div className="action-hover-detail"><strong>{hoveredAction.name}</strong>{hoveredAction.details.map((detail) => <div key={`${detail.label}-${detail.value}`}><span>{detail.label}</span><b>{detail.value}</b>{detail.source && <small>{detail.source}</small>}</div>)}{!hoveredAction.available && <p>{hoveredAction.disabledReason}</p>}</div>}</div><div className="console-help">{selected ? <><strong>대상 선택</strong><span>{selected.target === "multi-enemy" ? `${selectedTargetIds.length}/${selected.maxTargets ?? "?"} 선택` : "유효한 대상을 선택"}</span>{selected.target === "multi-enemy" && <button className="primary" disabled={selectedTargetIds.length === 0} onClick={onCompleteMulti}>대상 선택 완료</button>}<button onClick={onCancel}>취소</button></> : <><strong>행동</strong><span>행동을 선택하거나 포커스를 옮겨 세부 정보를 확인하세요.</span></>}</div></div></div>;
}

function EntityList({ entities, selectedAction, selectedTargetIds, onTarget, onHover, compact }: { entities: SceneEntity[]; selectedAction: ActionVm | null; selectedTargetIds: string[]; onTarget(entity: SceneEntity): void; onHover(id: string | null): void; compact?: boolean }) {
  return <div className={compact ? "entity-list compact" : "entity-list"}>{entities.map((entity) => { const valid = selectedAction?.eligibleTargetIds.includes(entity.id) ?? false; const selectedIndex = selectedTargetIds.indexOf(entity.id); return <button key={entity.id} className={selectedAction ? valid ? "valid-target" : "invalid-target" : ""} onClick={() => onTarget(entity)} onMouseEnter={() => onHover(entity.id)} onMouseLeave={() => onHover(null)}><span className="initiative-number">{entity.initiative}</span><div><strong>{entity.name}</strong><small>{entity.status.join(" · ") || "정상"}</small></div><b>{entity.hp}/{entity.maxHp}</b>{selectedIndex >= 0 && <i className="target-order">{selectedIndex + 1}</i>}</button>; })}</div>;
}
function EntityPortrait({ entity, selectedAction, selectedTargetIds, onTarget, onIdle, onHover }: { entity: SceneEntity; selectedAction: ActionVm | null; selectedTargetIds: string[]; onTarget(entity: SceneEntity): void; onIdle?: () => void; onHover(id: string | null): void }) {
  const valid = selectedAction?.eligibleTargetIds.includes(entity.id) ?? false;
  const selectedIndex = selectedTargetIds.indexOf(entity.id);
  return <button className={`entity-portrait ${entity.side} ${selectedAction ? valid ? "valid-target" : "invalid-target" : ""}`} onClick={() => selectedAction ? onTarget(entity) : onIdle?.()} onMouseEnter={() => onHover(entity.id)} onMouseLeave={() => onHover(null)}><div className="portrait-art"><span>{entity.name[0]}</span>{selectedIndex >= 0 && <i className="target-order">{selectedIndex + 1}</i>}</div><div><strong>{entity.name}</strong><small>{entity.distance ?? `${entity.hp}/${entity.maxHp} HP`} · {entity.status.join(" · ") || "정상"}</small></div></button>;
}
function Inspector({ entity }: { entity: SceneEntity }) { return <div className="inspector"><h2>{entity.name}</h2><div className="inspector-metrics"><Metric label="HP" value={`${entity.hp}/${entity.maxHp}`}/><Metric label="임시 HP" value={entity.tempHp}/><Metric label="AC" value={entity.ac}/></div><div className="status-chips">{entity.status.length ? entity.status.map((status) => <span key={status}>{status}</span>) : <span>정상</span>}</div>{entity.resistances.length + entity.immunities.length + entity.vulnerabilities.length > 0 && <details><summary>Typed Defense</summary><p>저항: {entity.resistances.join(", ") || "없음"}</p><p>면역: {entity.immunities.join(", ") || "없음"}</p><p>취약: {entity.vulnerabilities.join(", ") || "없음"}</p></details>}<small>{entity.kind === "character" ? "캐릭터" : "Encounter 전투원"}</small></div>; }
function TargetingOverlay() {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const updateOrigin = () => { const anchor = document.querySelector<HTMLElement>('[data-selected-action-anchor="true"]'); if (anchor) { const rect = anchor.getBoundingClientRect(); setOrigin({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); } };
    const move = (event: MouseEvent) => { setPointer({ x: event.clientX, y: event.clientY }); updateOrigin(); };
    updateOrigin();
    window.addEventListener("mousemove", move);
    window.addEventListener("resize", updateOrigin);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("resize", updateOrigin); };
  }, []);
  return <svg className="target-overlay"><defs><marker id="target-arrow-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" /></marker></defs><line x1={origin.x} y1={origin.y} x2={pointer.x} y2={pointer.y} markerEnd="url(#target-arrow-head)" /></svg>;
}

function ResolutionDrawer() {
  const { snapshot, advanceResolution, respondToInterrupt, dismissResolution, undoLastResolution } = useSimpleVtt();
  const r = snapshot!.resolution!;
  const animated = ["roll-animation", "save-animation", "damage-animation"].includes(r.stage);
  useEffect(() => {
    if (!animated || !r.canAdvance) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced";
    const timer = window.setTimeout(() => { void advanceResolution(); }, reduced ? 80 : 850);
    return () => window.clearTimeout(timer);
  }, [r.id, r.stage, r.canAdvance, animated, advanceResolution]);
  return <aside className="resolution-drawer"><div className="drawer-head"><div><span className="eyebrow accent">판정</span><h2>{r.actionName}</h2></div><span className={r.adjudicated ? "badge warning" : "badge"}>{r.adjudicated ? "DM 수정됨" : stageLabel(r.stage)}</span></div>{animated && <DiceAnimation values={r.authoritativeDice} onSkip={() => advanceResolution()} />}{r.interrupt && <InterruptPrompt onUse={() => respondToInterrupt(true)} onDecline={() => respondToInterrupt(false)} />}{!animated && !r.interrupt && <><div className="resolution-compact">{r.compact}</div><div className="review-rows"><div><span>계산 결과</span><strong>{r.calculatedOutcome}</strong></div><div><span>최종 결과</span><strong>{r.finalOutcome}</strong></div></div>{r.saveResults.length > 0 && <div className="save-results">{r.saveResults.map((save) => <div key={save.targetId}><strong>{save.targetName}</strong><span>{save.total} vs DC {save.dc}</span><b className={save.outcome === "성공" ? "good-text" : "bad-text"}>{save.outcome}</b>{save.finalDamage !== undefined && <em>{save.finalDamage} 피해</em>}</div>)}</div>}{r.damageComponents.length > 0 && <DamageWaterfall components={r.damageComponents} />}</>}<details open={!animated}><summary>판정 상세</summary>{r.detail.map((line) => <p key={line}>{line}</p>)}{r.provenance.map((line) => <p key={line}>출처 · {line}</p>)}</details>{r.stateChanges.length > 0 && <details><summary>상태 변화</summary>{r.stateChanges.map((line) => <p key={line}>{line}</p>)}</details>}{r.canAdvance && !animated && !r.interrupt && <button className="primary wide" onClick={() => advanceResolution()}>{r.nextLabel ?? "계속"}</button>}{snapshot!.role === "dm" && <DmAdjudicationPanel />}{r.stage === "complete" && <div className="drawer-actions"><button className="primary" onClick={() => dismissResolution()}>결과 닫기</button><button onClick={() => undoLastResolution()}>안전하게 되돌리기</button></div>}</aside>;
}
function stageLabel(stage: string) { return ({ "roll-animation": "주사위", "attack-result": "명중 결과", interrupt: "반응 대기", "save-animation": "내성 굴림", "save-result": "내성 결과", "damage-animation": "피해 굴림", "effect-preview": "적용 Preview", complete: "완료" } as Record<string, string>)[stage] ?? stage; }
function DiceAnimation({ values, onSkip }: { values: number[]; onSkip(): void }) { return <div className="dice-animation"><div className="dice-row">{values.map((value, index) => <div className="die" key={`${value}-${index}`}><span>{value}</span></div>)}</div><span>권위 주사위 결과 → Animation</span><button onClick={onSkip}>Animation 건너뛰기</button></div>; }
function InterruptPrompt({ onUse, onDecline }: { onUse(): void; onDecline(): void }) { const { snapshot } = useSimpleVtt(); const interrupt = snapshot!.resolution!.interrupt!; return <div className="interrupt-prompt"><span className="badge warning">Interrupt</span><h3>{interrupt.responderName} · {interrupt.optionName}</h3><div className="review-rows"><div><span>트리거</span><strong>{interrupt.trigger}</strong></div><div><span>비용</span><strong>{interrupt.cost}</strong></div><div><span>사용 시</span><strong>{interrupt.effect}</strong></div><div><span>출처</span><strong>{interrupt.source}</strong></div></div><div className="drawer-actions"><button className="primary" onClick={onUse}>사용</button><button onClick={onDecline}>넘기기</button></div></div>; }
function DamageWaterfall({ components }: { components: DamageComponentView[] }) { return <div className="damage-waterfall"><SectionTitle>피해 계산</SectionTitle>{components.map((component, index) => <div key={`${component.type}-${index}`}><span>{component.type}</span><b>{component.raw}</b><i>→</i><strong>{component.adjusted}</strong><small>{component.adjustment ?? "조정 없음"} · {component.roll}</small></div>)}</div>; }
function DmAdjudicationPanel() {
  const { snapshot, applyDmAdjudication } = useSimpleVtt();
  const [type, setType] = useState("modifier");
  const [value, setValue] = useState("1");
  const [scope, setScope] = useState<AdjudicationScope>("resolution");
  const [reason, setReason] = useState("");
  const [targetId, setTargetId] = useState(snapshot!.resolution!.targetIds[0] ?? "");
  const numeric = ["modifier", "ac-dc-adjustment", "damage-correction", "healing-correction", "resource-correction"].includes(type);
  const needsText = ["condition-add", "condition-remove"].includes(type);
  const submit = () => applyDmAdjudication({ type: type as Parameters<typeof applyDmAdjudication>[0]["type"], value: numeric ? Number(value) : needsText ? value : undefined, targetId: targetId || undefined, scope, reason });
  return <details className="dm-adjudication"><summary>상황 / 판정 수정</summary><div className="adjudication-grid"><Field label="작업"><select value={type} onChange={(event) => setType(event.target.value)}>{[["modifier", "+/- 보정"], ["advantage", "유리점"], ["disadvantage", "불리점"], ["force-success", "강제 성공"], ["force-failure", "강제 실패"], ["ac-dc-adjustment", "임시 AC/DC"], ["damage-correction", "피해 정정"], ["healing-correction", "회복 정정"], ["condition-add", "상태 추가"], ["condition-remove", "상태 제거"], ["resource-correction", "자원 정정"], ["target-correction", "대상 정정"]].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>{(numeric || needsText) && <Field label={needsText ? "상태" : "값"}><input value={value} onChange={(event) => setValue(event.target.value)} /></Field>}<Field label="대상"><select value={targetId} onChange={(event) => setTargetId(event.target.value)}>{snapshot!.scene.entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}</select></Field><Field label="범위"><select value={scope} onChange={(event) => setScope(event.target.value as AdjudicationScope)}>{["resolution", "target", "turn", "scene", "until-cleared"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="사유"><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="선택 사항" /></Field></div><button className="primary wide" onClick={submit}>원래 계산을 보존하고 수정 적용</button></details>;
}

function CombatantsScreen() {
  const { snapshot, previewCombatantImport, activateCombatantImport, clearCombatantImport, instantiateCombatant, removeCombatant } = useSimpleVtt();
  const [showImport, setShowImport] = useState(false);
  const [query,setQuery]=useState("");
  const [payload, setPayload] = useState('{\n  "id": "combatant.local-bandit",\n  "name": "로컬 산적",\n  "nameEn": "Local Bandit",\n  "ac": 14,\n  "maxHp": 18,\n  "actions": ["단검", "라이트 크로스보우"],\n  "source": "My Encounter Pack",\n  "version": "0.1"\n}');
  if (!snapshot) return null;
  const definitions=snapshot.combatantDefinitions.filter((definition)=>`${definition.name} ${definition.nameEn} ${definition.actions.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const current=snapshot.scene.entities.filter((entity)=>entity.kind==="combatant");
  const canRemove=snapshot.session.role==="host"&&snapshot.session.lifecycle==="preparing";
  return <div className="screen page-dark"><ScreenHead kicker="ENCOUNTER" title="Combatant" description="필요한 전투원만 골라 현재 Encounter에 추가합니다." actions={<button onClick={() => setShowImport((value) => !value)}>Combatant 가져오기</button>}/>{showImport && <ImportPanel title="Combatant JSON" payload={payload} setPayload={setPayload} preview={snapshot.combatantImport?.validation} onPreview={() => previewCombatantImport(payload)} onActivate={() => activateCombatantImport()} onCancel={() => { setShowImport(false); void clearCombatantImport(); }} canActivate={Boolean(snapshot.combatantImport?.definition && !snapshot.combatantImport.validation.some((item) => item.severity === "blocking"))}>{snapshot.combatantImport?.definition && <div className="review-rows"><div><span>Combatant</span><strong>{snapshot.combatantImport.definition.name}</strong></div><div><span>AC / HP</span><strong>{snapshot.combatantImport.definition.ac} / {snapshot.combatantImport.definition.maxHp}</strong></div><div><span>행동</span><strong>{snapshot.combatantImport.definition.actions.join(", ")}</strong></div></div>}</ImportPanel>}<div className="combatant-toolbar"><input placeholder="Combatant 검색" value={query} onChange={(event)=>setQuery(event.target.value)} /></div><SectionTitle>라이브러리</SectionTitle><div className="combatant-grid">{definitions.map((definition) => <article className="panel-card combatant-library-card" key={definition.id}><h2>{definition.name}</h2><p>AC {definition.ac} · HP {definition.maxHp}</p><details><summary>행동 / 출처</summary><div className="status-chips">{definition.actions.map((action) => <span key={action}>{action}</span>)}</div><small>{definition.nameEn} · {definition.source} · v{definition.version}</small></details><button className="primary" onClick={() => instantiateCombatant(definition.id)}>Encounter에 추가</button></article>)}</div><SectionTitle>현재 Encounter</SectionTitle>{current.length===0?<div className="surface-empty"><strong>추가된 Combatant가 없습니다.</strong><span>라이브러리에서 필요한 전투원만 추가하세요.</span></div>:<div className="combatant-grid compact-cards">{current.map((entity) => <article className="panel-card" key={entity.id}><h3>{entity.name}</h3><p>HP {entity.hp}/{entity.maxHp} · AC {entity.ac}</p><div className="status-chips">{entity.status.map((status) => <span key={status}>{status}</span>)}</div>{canRemove&&<button onClick={()=>removeCombatant(entity.id)}>Encounter에서 제거</button>}</article>)}</div>}</div>;
}

function CatalogScreen() {
  const { snapshot, previewContentImport, activateContentImport, clearContentImport } = useSimpleVtt();
  const [category, setCategory] = useState<"all" | CatalogEntry["category"]>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [payload, setPayload] = useState('{\n  "id": "subclass.local-stoneguard",\n  "category": "subclass",\n  "nameKo": "석벽 수호자",\n  "nameEn": "Stoneguard",\n  "baseClassId": "class.fighter",\n  "source": "My Homebrew",\n  "version": "0.1",\n  "description": "전사와 관계를 맺는 홈브루 서브클래스"\n}');
  if (!snapshot) return null;
  const filtered = snapshot.catalog.filter((entry) => (category === "all" || entry.category === category) && `${entry.nameKo} ${entry.nameEn}`.toLowerCase().includes(query.toLowerCase()));
  const selected = snapshot.catalog.find((entry) => entry.id === (selectedId ?? filtered[0]?.id));
  const categories: Array<"all" | CatalogEntry["category"]> = ["all", "feat", "spell", "class", "subclass", "species", "background", "item", "condition", "combatant", "option"];
  return <div className="screen page-dark"><ScreenHead kicker="RULES" title="규칙" description="이름과 종류로 찾고, 필요한 규칙만 상세에서 확인합니다." actions={<button onClick={() => setShowImport((value) => !value)}>콘텐츠 가져오기</button>}/>{showImport && <ImportPanel title="Content JSON" payload={payload} setPayload={setPayload} preview={snapshot.contentImport?.validation} onPreview={() => previewContentImport(payload)} onActivate={() => activateContentImport()} onCancel={() => { setShowImport(false); void clearContentImport(); }} canActivate={Boolean(snapshot.contentImport?.entry && !snapshot.contentImport.validation.some((item) => item.severity === "blocking"))}>{snapshot.contentImport?.entry && <div className="review-rows"><div><span>콘텐츠</span><strong>{snapshot.contentImport.entry.nameKo} / {snapshot.contentImport.entry.nameEn}</strong></div><div><span>적용 범위</span><strong>{snapshot.contentImport.entry.scope}</strong></div><div><span>연결된 규칙</span><strong>{snapshot.contentImport.entry.relationships.map((relationship) => `${relationship.label} → ${relationship.targetName}`).join(", ") || "없음"}</strong></div></div>}</ImportPanel>}<div className="catalog-layout"><aside className="catalog-categories">{categories.map((id) => <button key={id} className={category === id ? "active" : ""} onClick={() => setCategory(id)}>{id === "all" ? "전체" : categoryLabel(id)}</button>)}</aside><section className="catalog-list"><input placeholder="규칙 검색" value={query} onChange={(event) => setQuery(event.target.value)}/>{filtered.map((entry) => <button key={entry.id} className={selected?.id === entry.id ? "selected" : ""} onClick={() => setSelectedId(entry.id)}><span className="catalog-glyph">{entry.nameKo[0]}</span><div><strong>{entry.nameKo}</strong><small>{entry.nameEn} · {categoryLabel(entry.category)}</small></div></button>)}</section><aside className="catalog-detail">{selected ? <><span className="eyebrow accent">{categoryLabel(selected.category)}</span><h2>{selected.nameKo}</h2><small>{selected.nameEn}</small><p>{selected.description}</p>{selected.relationships.length > 0 && <><SectionTitle>연결된 규칙</SectionTitle>{selected.relationships.map((relationship) => <div className="relationship-card" key={relationship.targetId}><span>{relationship.label}</span><strong>{relationship.targetName}</strong></div>)}</>}<details className="catalog-technical"><summary>기술 정보</summary><div className="review-rows"><div><span>출처</span><strong>{selected.source} · v{selected.version}</strong></div><div><span>적용 범위</span><strong>{selected.scope}</strong></div><div><span>콘텐츠 ID</span><strong>{selected.id}</strong></div><div><span>기능</span><strong>{selected.capabilities.join(", ") || "없음"}</strong></div></div></details></>:<div className="surface-empty"><strong>일치하는 규칙이 없습니다.</strong><span>검색어 또는 종류 필터를 바꿔 보세요.</span></div>}</aside></div></div>;
}

function ImportPanel({ title, payload, setPayload, preview, onPreview, onActivate, onCancel, canActivate, extraActions, children }: { title: string; payload: string; setPayload(value: string): void; preview?: Array<{ severity: string; message: string }>; onPreview(): void; onActivate(): void; onCancel(): void; canActivate: boolean; extraActions?: ReactNode; children?: ReactNode }) {
  return <section className="import-panel"><div className="import-panel-head"><h2>{title}</h2><div>{extraActions}<button onClick={onCancel}>닫기</button></div></div><textarea className="json-box" value={payload} onChange={(event) => setPayload(event.target.value)}/><div className="import-status">{preview?.map((item, index) => <span className={item.severity} key={`${item.message}-${index}`}>{item.severity.toUpperCase()} · {item.message}</span>)}</div>{children}<div className="drawer-actions"><button onClick={onPreview}>구조/의미 검증</button><button className="primary" disabled={!canActivate} onClick={onActivate}>검토 완료 · 활성화</button></div></section>;
}

function ActivityScreen() {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;
  return <div className="screen page-dark"><ScreenHead kicker="ACTIVITY" title="플레이 기록" description="누가 무엇을 했고 결과가 어떻게 바뀌었는지 시간순으로 확인합니다."/>{snapshot.activity.length===0?<div className="surface-empty"><strong>아직 기록이 없습니다.</strong><span>플레이를 시작하면 행동과 결과가 여기에 쌓입니다.</span></div>:<div className="activity-list">{snapshot.activity.map((entry) => <article key={entry.id} className={`${entry.correction ? "activity-entry correction" : "activity-entry"} ${entry.reversed ? "reversed" : ""}`}><time>{entry.time}</time><div><span className="badge">{entry.actor}</span>{entry.correction && <span className="badge warning">DM 수정</span>}{entry.reversed && <span className="badge warning">되돌림</span>}<h3>{entry.title}</h3><p>{entry.summary}</p>{entry.ruling && <p>DM 판단 · {entry.ruling}</p>}<details><summary>기술 정보</summary>{entry.detail.map((line) => <div key={line}>{line}</div>)}{entry.stateChanges.map((line) => <div key={line}>상태 변화 · {line}</div>)}<small>기록 ID · {entry.id}</small></details></div></article>)}</div>}</div>;
}

function SessionScreen() {
  return <div className="screen page-dark production-session-screen"><div id="production-session-workspace-root" className="session-grid production-session-mount" /></div>;
}

function SettingsScreen() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState<"gold" | "blue" | "green">("gold");
  const [motion, setMotion] = useState<"normal" | "reduced">("normal");
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.dataset.accent = accent; }, [accent]);
  useEffect(() => { document.documentElement.dataset.motion = motion; }, [motion]);
  return <div className="screen page-dark"><ScreenHead kicker="SETTINGS" title="환경 설정" description="표시 방식과 움직임을 내 환경에 맞게 조정합니다."/><div className="settings-card"><SectionTitle>화면 테마</SectionTitle><div className="method-tabs"><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><strong>다크</strong><span>어두운 배경</span></button><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><strong>라이트</strong><span>밝은 배경</span></button></div><SectionTitle>강조 색상</SectionTitle><div className="accent-options">{(["gold", "blue", "green"] as const).map((value) => <button key={value} className={accent === value ? `accent-swatch ${value} active` : `accent-swatch ${value}`} onClick={() => setAccent(value)} aria-label={`${value} 강조 색상`}/>)}</div><SectionTitle>접근성 · 움직임</SectionTitle><div className="method-tabs"><button className={motion === "normal" ? "active" : ""} onClick={() => setMotion("normal")}><strong>기본 움직임</strong><span>전환과 주사위 애니메이션 사용</span></button><button className={motion === "reduced" ? "active" : ""} onClick={() => setMotion("reduced")}><strong>움직임 줄이기</strong><span>결과는 유지하고 애니메이션만 최소화</span></button></div></div></div>;
}

function DebugPanel({ onClose }: { onClose(): void }) {
  const { snapshot, uiDebug, debug } = useSimpleVtt();
  if (!snapshot) return null;
  return <aside className="debug-panel"><header><div><span>SIMPLEVTT // DEBUG</span><strong>Reference State Controller</strong></div><button onClick={onClose}>닫기</button></header><section><DebugTitle>REFERENCE VIEW</DebugTitle><div className="debug-buttons"><button className={snapshot.role === "player" ? "active" : ""} onClick={() => debug.setRole("player")}>플레이어</button><button className={snapshot.role === "dm" ? "active" : ""} onClick={() => debug.setRole("dm")}>DM</button></div><DebugTitle>SCENARIOS</DebugTitle><div className="debug-buttons wrap">{(["attack", "critical", "reaction", "multi-save", "typed-damage"] as const).map((scenario) => <button key={scenario} onClick={() => debug.loadScenario(scenario)}>{scenario}</button>)}</div><DebugTitle>SESSION MODE</DebugTitle><div className="debug-buttons"><button className={snapshot.sessionMode === "initiative" ? "active" : ""} onClick={() => debug.setMode("initiative")}>이니셔티브</button><button className={snapshot.sessionMode === "freeform" ? "active" : ""} onClick={() => debug.setMode("freeform")}>자유 진행</button></div><DebugTitle>CURRENT TURN</DebugTitle><div className="debug-buttons wrap">{snapshot.scene.entities.map((entity) => <button key={entity.id} className={snapshot.scene.currentActorId === entity.id ? "active" : ""} onClick={() => debug.setCurrentActor(entity.id)}>{entity.name}</button>)}</div><DebugTitle>NEXT D20</DebugTitle><div className="debug-buttons"><button className={snapshot.queuedD20 === 20 ? "active" : ""} onClick={() => debug.setQueuedD20(20)}>20</button><button className={snapshot.queuedD20 === 11 ? "active" : ""} onClick={() => debug.setQueuedD20(11)}>11</button><button className={snapshot.queuedD20 === 1 ? "active" : ""} onClick={() => debug.setQueuedD20(1)}>1</button><button className={snapshot.queuedD20 === null ? "active" : ""} onClick={() => debug.setQueuedD20(null)}>자동</button></div><DebugTitle>CONNECTION</DebugTitle><div className="debug-buttons wrap">{(["connected", "reconnecting", "disconnected"] as const).map((state) => <button key={state} className={snapshot.connectionState === state ? "active" : ""} onClick={() => debug.setConnectionState(state)}>{state}</button>)}</div><DebugTitle>EDGE STATES</DebugTitle><div className="debug-buttons wrap">{(["normal", "save-error", "unsupported"] as const).map((state) => <button key={state} className={snapshot.edgeState === state ? "active" : ""} onClick={() => debug.setEdgeState(state)}>{state}</button>)}</div><DebugTitle>TARGETING</DebugTitle><pre>{JSON.stringify(uiDebug, null, 2)}</pre><DebugTitle>RESOLUTION</DebugTitle><pre>{JSON.stringify(snapshot.resolution ? { id: snapshot.resolution.id, step: snapshot.resolution.stage, authoritativeDice: snapshot.resolution.authoritativeDice, interruptWindow: snapshot.resolution.interrupt ?? null, stateChanges: snapshot.resolution.stateChanges } : null, null, 2)}</pre><DebugTitle>STATE</DebugTitle><pre>{JSON.stringify({ role: snapshot.role, sessionMode: snapshot.sessionMode, currentActorId: snapshot.scene.currentActorId, selectedActorId: snapshot.scene.selectedActorId, queuedD20: snapshot.queuedD20, connection: snapshot.connectionState, edgeState: snapshot.edgeState }, null, 2)}</pre></section></aside>;
}
function DebugTitle({ children }: { children: ReactNode }) { return <h3 className="debug-title">{children}</h3>; }
