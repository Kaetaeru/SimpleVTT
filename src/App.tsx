import { useEffect, useState, type ReactNode } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import { CharacterSheetPlayScreen } from "./CharacterSheetPlayScreen";
import { ProductionPlayScreen } from "./ProductionPlayScreen";
import { V1HomeScreen } from "./V1HomeScreen";
import { V1ContentScreen } from "./V1ContentScreen";
import { CharacterCreateScreenV10 } from "./CharacterCreateV10";
import { CampaignScreen } from "./CampaignScreen";
import { AppearanceSettingsPanel } from "./AppearanceSettingsBridge";
import { applyMotionPreference, isReducedMotionPreferred, persistMotionPreference, readMotionPreference, type MotionPreference } from "./app/motionPreferences";
import type {
  AbilityKey,
  AdjudicationScope,
  AppRoute,
  CatalogEntry,
  DamageComponentView,
} from "./app/contracts";

const ABILITY_LABELS: Record<AbilityKey, string> = { str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" };
const ABILITY_KEYS = Object.keys(ABILITY_LABELS) as AbilityKey[];
const CREATE_STEPS = ["규칙 프로필", "정체성", "핵심 빌드", "능력치", "숙련·내성", "HP·방어·이동", "기능·주문·장비", "검토", "완료"];
const LEVEL_STEPS = ["진행 확인", "HP · 히트 다이스", "새 클래스 기능", "능력치 · 재주", "변경 검토"];

function categoryLabel(category: CatalogEntry["category"]) {
  return ({ class: "클래스", subclass: "서브클래스", species: "종족", background: "배경", feat: "재주", spell: "주문", item: "장비", condition: "상태", combatant: "몬스터", option: "옵션" } as const)[category];
}

function connectionLabel(state: "connected" | "reconnecting" | "disconnected") {
  if (state === "connected") return "● 연결됨";
  if (state === "reconnecting") return "◌ 재연결 중";
  return "○ 연결 끊김";
}

export function App({ onOpenSessionPreview }: { onOpenSessionPreview?(role: "dm" | "player"): void } = {}) {
  const { snapshot, loading } = useSimpleVtt();
  const [route, setRoute] = useState<AppRoute>("home");
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

  const nav: Array<[AppRoute, string, string]> = [
    ["home", "홈", "⌂"],
    ["characters", "캐릭터", "◉"],
    ["campaigns", "캠페인", "◇"],
    ["session", "세션", "⌁"],
    ["content", "콘텐츠", "＋"],
    ["catalog", "규칙", "▤"],
    ["settings", "설정", "⚙"],
  ];
  const connectedSession=snapshot.session.role!=="offline";
  const liveSession=snapshot.session.lifecycle==="live";

  return (
    <div className="app-shell v1-shell">
      <aside className="v1-sidebar">
        <button className="v1-brand" onClick={() => setRoute("home")} aria-label="SimpleVTT 홈">
          <span className="v1-brand-mark">S</span>
          <span className="v1-brand-copy"><strong>SimpleVTT</strong><small>TABLETOP PLAY</small></span>
        </button>
        <nav className="v1-nav" aria-label="주요 메뉴">
          {nav.map(([id, label, icon]) => (
            <button key={id} className={route === id || (id === "characters" && ["character", "create", "levelup"].includes(route)) ? "active" : ""} onClick={() => setRoute(id)}>
              <span className="v1-nav-icon">{icon}</span><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="v1-sidebar-spacer" />
        <div className="v1-sidebar-context">
          {liveSession && <button className="primary" onClick={() => setRoute("scene")}>플레이로 돌아가기</button>}
          {connectedSession && <div className={`v1-sidebar-status ${snapshot.connectionState}`}><i/><span>{connectionLabel(snapshot.connectionState)}</span></div>}
        </div>
      </aside>

      <section className="workspace">
        <header className="v1-topbar">
          <div className="v1-topbar-title"><span>SimpleVTT</span><strong>{topTitle(route, productionRole)}</strong></div>
          <div className="v1-topbar-actions">
            {liveSession && route !== "scene" && <button className="primary" onClick={() => setRoute("scene")}>플레이로 돌아가기</button>}
            {liveSession && <small>{snapshot.sessionMode === "initiative" ? `이니셔티브 · ${snapshot.scene.round}라운드` : "자유 진행"}</small>}
          </div>
        </header>
        <main className="content">
          {snapshot.edgeState !== "normal" && <EdgeBanner />}
          {route === "home" && <V1HomeScreen onCharacters={() => setRoute("characters")} onCreateCharacter={() => setRoute("create")} onCampaigns={() => setRoute("campaigns")} onSession={() => setRoute("session")} onContent={() => setRoute("content")} onRules={() => setRoute("catalog")} onPlay={() => setRoute("scene")} />}
          {route === "campaigns" && <CampaignScreen onOpenSession={() => setRoute("session")} />}
          {snapshot.role === "player" && route === "characters" && <CharacterLibraryScreen onOpen={() => setRoute("character")} onCreate={() => setRoute("create")} />}
          {snapshot.role === "player" && route === "character" && <CharacterSheetPlayScreen onScene={() => setRoute("scene")} onLevelUp={() => setRoute("levelup")} onEdit={() => setRoute("create")} />}
          {snapshot.role === "player" && route === "create" && <CharacterCreateScreenV10 onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}
          {snapshot.role === "player" && route === "levelup" && <LevelUpScreen onDone={() => setRoute("character")} onCancel={() => setRoute("character")} />}
          {route === "scene" && <ProductionPlayScreen role={productionRole} />}
          {route === "combatants" && productionRole === "dm" && <CombatantsScreen />}
          {route === "content" && <V1ContentScreen />}
          {route === "catalog" && <CatalogScreen />}
          {route === "activity" && <ActivityScreen />}
          {route === "session" && <SessionScreen onOpenSessionPreview={onOpenSessionPreview} />}
          {route === "settings" && <SettingsScreen />}
        </main>
      </section>

      {snapshot.resolution && <ResolutionDrawer />}
      {debugOpen && <DebugPanel onClose={() => setDebugOpen(false)} />}
    </div>
  );
}

function topTitle(route: AppRoute, role: "player" | "dm") {
  if (route === "home") return "홈";
  if (route === "characters") return "캐릭터";
  if (route === "campaigns") return "캠페인";
  if (route === "character") return "캐릭터 시트";
  if (route === "create") return "캐릭터 생성 / 편집";
  if (route === "levelup") return "레벨 업";
  if (route === "scene") return role === "player" ? "플레이" : "DM 플레이";
  if (route === "combatants") return "Encounter";
  if (route === "catalog") return "규칙";
  if (route === "activity") return "플레이 기록";
  if (route === "session") return "세션";
  if (route === "content") return "콘텐츠 · 애드온";
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

export function LevelUpScreen({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
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

function ResolutionDrawer() {
  const { snapshot, advanceResolution, respondToInterrupt, dismissResolution, undoLastResolution } = useSimpleVtt();
  const r = snapshot!.resolution!;
  const animated = ["roll-animation", "save-animation", "damage-animation"].includes(r.stage);
  useEffect(() => {
    if (!animated || !r.canAdvance) return;
    const reduced = isReducedMotionPreferred();
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

function SessionScreen({ onOpenSessionPreview }: { onOpenSessionPreview?(role: "dm" | "player"): void }) {
  return <div className="screen page-dark production-session-screen">
    {onOpenSessionPreview && <section className="browser-session-preview-card" aria-label="브라우저 세션 UI 미리보기">
      <div><strong>연결 없이 세션 화면 확인</strong><span>실제 Host나 저장 상태를 건드리지 않고 DM·Player 화면을 브라우저에서 확인합니다.</span></div>
      <div className="browser-session-preview-actions">
        <button type="button" onClick={() => onOpenSessionPreview("dm")}>DM 화면 미리보기</button>
        <button type="button" onClick={() => onOpenSessionPreview("player")}>Player 화면 미리보기</button>
      </div>
    </section>}
    <div id="production-session-workspace-root" className="session-grid production-session-mount" />
  </div>;
}

function SettingsScreen() {
  const [motion, setMotion] = useState<MotionPreference>(()=>readMotionPreference());
  useEffect(() => { applyMotionPreference(motion); persistMotionPreference(motion); }, [motion]);
  return <div className="screen page-dark">
    <ScreenHead kicker="SETTINGS" title="환경 설정" description="표시 방식과 움직임을 내 환경에 맞게 조정합니다."/>
    <div className="settings-card">
      <AppearanceSettingsPanel />
      <SectionTitle>접근성 · 움직임</SectionTitle>
      <div className="method-tabs">
        <button className={motion === "system" ? "active" : ""} onClick={() => setMotion("system")}><strong>시스템 설정</strong><span>운영체제의 움직임 설정을 따릅니다</span></button>
        <button className={motion === "full" ? "active" : ""} onClick={() => setMotion("full")}><strong>전체 움직임</strong><span>투척과 전환 애니메이션을 모두 사용</span></button>
        <button className={motion === "reduced" ? "active" : ""} onClick={() => setMotion("reduced")}><strong>움직임 줄이기</strong><span>결과는 유지하고 애니메이션만 최소화</span></button>
      </div>
    </div>
  </div>;
}

function DebugPanel({ onClose }: { onClose(): void }) {
  const { snapshot, uiDebug, debug } = useSimpleVtt();
  if (!snapshot) return null;
  return <aside className="debug-panel"><header><div><span>SIMPLEVTT // DEBUG</span><strong>Reference State Controller</strong></div><button onClick={onClose}>닫기</button></header><section><DebugTitle>REFERENCE VIEW</DebugTitle><div className="debug-buttons"><button className={snapshot.role === "player" ? "active" : ""} onClick={() => debug.setRole("player")}>플레이어</button><button className={snapshot.role === "dm" ? "active" : ""} onClick={() => debug.setRole("dm")}>DM</button></div><DebugTitle>SCENARIOS</DebugTitle><div className="debug-buttons wrap">{(["attack", "critical", "reaction", "multi-save", "typed-damage"] as const).map((scenario) => <button key={scenario} onClick={() => debug.loadScenario(scenario)}>{scenario}</button>)}</div><DebugTitle>SESSION MODE</DebugTitle><div className="debug-buttons"><button className={snapshot.sessionMode === "initiative" ? "active" : ""} onClick={() => debug.setMode("initiative")}>이니셔티브</button><button className={snapshot.sessionMode === "freeform" ? "active" : ""} onClick={() => debug.setMode("freeform")}>자유 진행</button></div><DebugTitle>CURRENT TURN</DebugTitle><div className="debug-buttons wrap">{snapshot.scene.entities.map((entity) => <button key={entity.id} className={snapshot.scene.currentActorId === entity.id ? "active" : ""} onClick={() => debug.setCurrentActor(entity.id)}>{entity.name}</button>)}</div><DebugTitle>NEXT D20</DebugTitle><div className="debug-buttons"><button className={snapshot.queuedD20 === 20 ? "active" : ""} onClick={() => debug.setQueuedD20(20)}>20</button><button className={snapshot.queuedD20 === 11 ? "active" : ""} onClick={() => debug.setQueuedD20(11)}>11</button><button className={snapshot.queuedD20 === 1 ? "active" : ""} onClick={() => debug.setQueuedD20(1)}>1</button><button className={snapshot.queuedD20 === null ? "active" : ""} onClick={() => debug.setQueuedD20(null)}>자동</button></div><DebugTitle>CONNECTION</DebugTitle><div className="debug-buttons wrap">{(["connected", "reconnecting", "disconnected"] as const).map((state) => <button key={state} className={snapshot.connectionState === state ? "active" : ""} onClick={() => debug.setConnectionState(state)}>{state}</button>)}</div><DebugTitle>EDGE STATES</DebugTitle><div className="debug-buttons wrap">{(["normal", "save-error", "unsupported"] as const).map((state) => <button key={state} className={snapshot.edgeState === state ? "active" : ""} onClick={() => debug.setEdgeState(state)}>{state}</button>)}</div><DebugTitle>TARGETING</DebugTitle><pre>{JSON.stringify(uiDebug, null, 2)}</pre><DebugTitle>RESOLUTION</DebugTitle><pre>{JSON.stringify(snapshot.resolution ? { id: snapshot.resolution.id, step: snapshot.resolution.stage, authoritativeDice: snapshot.resolution.authoritativeDice, interruptWindow: snapshot.resolution.interrupt ?? null, stateChanges: snapshot.resolution.stateChanges } : null, null, 2)}</pre><DebugTitle>STATE</DebugTitle><pre>{JSON.stringify({ role: snapshot.role, sessionMode: snapshot.sessionMode, currentActorId: snapshot.scene.currentActorId, selectedActorId: snapshot.scene.selectedActorId, queuedD20: snapshot.queuedD20, connection: snapshot.connectionState, edgeState: snapshot.edgeState }, null, 2)}</pre></section></aside>;
}
function DebugTitle({ children }: { children: ReactNode }) { return <h3 className="debug-title">{children}</h3>; }
