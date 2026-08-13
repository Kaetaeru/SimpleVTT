import { useEffect, useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { AbilityKey, CharacterCreateDraft, CharacterCreationPlan, CharacterCreationSection } from "./app/contracts";
import { creationContextSections, creationPrimarySections, creationPrimaryStatus, levelUpFocusItems, nextCreationPrimaryId, type LevelUpFocusId } from "./app/characterProgressionPresentation";
import { AbilitiesSection } from "./character-create/V09Abilities";
import { ClassChoicesSection, ClassSection, EquipmentSection, IdentitySection, ProficienciesSection, ReviewSection, SourceSection, SpellSection } from "./character-create/V09Sections";

const LABELS: Record<string, string> = { identity: "정체성", species: "종족", class: "클래스", background: "배경", abilities: "능력치", proficiencies: "기술", review: "검토" };
const ABILITY_LABELS: Record<AbilityKey, string> = { str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" };
const ABILITY_KEYS = Object.keys(ABILITY_LABELS) as AbilityKey[];

export function CharacterCreateScreenV09({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  const { snapshot, createCharacterDraft, updateCharacterDraft, finalizeCharacterDraft } = useSimpleVtt();
  const [importText, setImportText] = useState('{\n  "name": "새 캐릭터",\n  "className": "전사",\n  "species": "인간",\n  "background": "병사",\n  "level": 1\n}');
  if (!snapshot?.createDraft) return <div className="focused-create-empty"><div><span>CHARACTER CREATION</span><h1>새 캐릭터</h1><p>큰 선택을 정하고 필요한 선택은 그 자리에서 이어서 처리합니다.</p><button className="primary" onClick={() => createCharacterDraft("guided")}>캐릭터 만들기</button><button onClick={onCancel}>돌아가기</button></div></div>;
  const draft = snapshot.createDraft;
  const plan = snapshot.creationPlan;
  if (!plan) return <div className="loading-screen">캐릭터 선택 준비 중…</div>;
  const primary = creationPrimarySections(plan);
  const activeId = primary.some((section) => section.id === plan.activeSectionId) ? plan.activeSectionId : ["class-choices", "equipment", "spells"].includes(plan.activeSectionId) ? "class" : plan.recommendedSectionId;
  const active = primary.find((section) => section.id === activeId) ?? primary[0];
  const context = creationContextSections(plan, active.id);
  const blocking = plan.validation.some((message) => message.severity === "blocking");
  const importPending = draft.mode === "import" && draft.importStatus !== "valid";
  const go = (id: string) => void updateCharacterDraft({ type: "set-section", value: id });
  const previousId = nextCreationPrimaryId(plan, active.id, -1);
  const nextId = nextCreationPrimaryId(plan, active.id, 1);
  return <div className="focused-create-shell">
    <header className="focused-create-header"><div className="focused-create-title"><span>{draft.editingCharacterId ? "CHARACTER EDIT" : "CHARACTER CREATION"}</span><strong>{draft.name || "이름 없는 캐릭터"}</strong></div><nav className="focused-create-tabs">{primary.map((section) => { const status = creationPrimaryStatus(plan, section); return <button key={section.id} className={`${active.id === section.id ? "active" : ""} status-${status}`} onClick={() => go(section.id)}><i>{status === "complete" ? "✓" : status === "warning" ? "!" : status === "incomplete" || status === "blocked" ? "•" : ""}</i><span>{LABELS[section.id] ?? section.label}</span></button>; })}</nav><div className="focused-create-header-actions"><button className="quiet" onClick={() => createCharacterDraft("import")}>JSON</button><button onClick={onCancel}>닫기</button></div></header>
    <div className="focused-create-body"><main className="focused-create-stage">{importPending ? <ImportPanel draft={draft} value={importText} setValue={setImportText} onPreview={() => updateCharacterDraft({ type: "import-json", value: importText })}/> : <PrimarySection section={active} context={context} plan={plan} draft={draft}/>}</main><CharacterPreview plan={plan} draft={draft} onReview={() => go("review")}/></div>
    <footer className="focused-create-footer"><button disabled={primary[0]?.id === active.id || importPending} onClick={() => go(previousId)}>이전</button><div><span>{LABELS[active.id] ?? active.label}</span><small>{active.id === "class" && context.length ? `${draft.className || "클래스"}에 필요한 선택을 여기서 함께 처리합니다.` : active.description}</small></div>{active.id === "review" ? <button className="primary" disabled={blocking || importPending} onClick={async () => { await finalizeCharacterDraft(); onDone(); }}>{draft.editingCharacterId ? "변경 적용" : "모험 시작"}</button> : <button className="primary" disabled={importPending} onClick={() => go(nextId)}>다음</button>}</footer>
  </div>;
}

function PrimarySection({ section, context, plan, draft }: { section: CharacterCreationSection; context: CharacterCreationSection[]; plan: CharacterCreationPlan; draft: CharacterCreateDraft }) {
  if (section.kind === "identity") return <IdentitySection section={section} draft={draft}/>;
  if (section.kind === "species") return <SourceSection section={section} commandType="set-species"/>;
  if (section.kind === "background") return <SourceSection section={section} commandType="set-background"/>;
  if (section.kind === "class") return <div className="focused-class-flow"><ClassSection section={section} draft={draft}/>{draft.className && context.length > 0 && <div className="focused-context-block"><div className="focused-context-heading"><span>현재 클래스 선택</span><strong>{draft.className}에게 지금 필요한 결정</strong><p>별도 단계로 이동하지 않고 클래스 선택의 결과를 바로 이어서 정합니다.</p></div>{context.map((child) => <ContextSection key={child.id} section={child} draft={draft}/>)}</div>}</div>;
  if (section.kind === "abilities") return <AbilitiesSection section={section} draft={draft}/>;
  if (section.kind === "proficiencies") return <ProficienciesSection section={section} draft={draft}/>;
  return <ReviewSection section={section} plan={plan} draft={draft}/>;
}

function ContextSection({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) { if (section.kind === "class-choices") return <ClassChoicesSection section={section}/>; if (section.kind === "equipment") return <EquipmentSection section={section}/>; if (section.kind === "spells") return <SpellSection section={section} draft={draft}/>; return null; }

function CharacterPreview({ plan, draft, onReview }: { plan: CharacterCreationPlan; draft: CharacterCreateDraft; onReview(): void }) {
  const unresolved = creationPrimarySections(plan).filter((section) => ["incomplete", "blocked"].includes(creationPrimaryStatus(plan, section))).map((section) => LABELS[section.id] ?? section.label);
  return <aside className="focused-character-preview"><div className="focused-character-portrait"><span>{(draft.name || "?").slice(0, 1)}</span></div><div className="focused-character-identity"><h2>{draft.name || "이름 없음"}</h2><p>{draft.className ? `${draft.className} ${draft.level}` : "클래스 미선택"}</p><span>{draft.species || "종족 미선택"} · {draft.background || "배경 미선택"}</span></div><div className="focused-character-vitals"><div><span>HP</span><strong>{draft.derived.hp}</strong></div><div><span>AC</span><strong>{draft.derived.ac}</strong></div><div><span>이동</span><strong>{draft.derived.speed}</strong></div></div><div className="focused-character-abilities">{Object.entries(draft.abilities).map(([key, value]) => <div key={key}><span>{key.toUpperCase()}</span><strong>{value}</strong></div>)}</div><button className="focused-review-button" onClick={onReview}><span>캐릭터 검토</span><strong>{unresolved.length ? `${unresolved.join(" · ")} 확인 필요` : "준비 완료"}</strong></button></aside>;
}

function ImportPanel({ draft, value, setValue, onPreview }: { draft: CharacterCreateDraft; value: string; setValue(value: string): void; onPreview(): void }) { return <section className="focused-import"><span>IMPORT CHARACTER</span><h2>JSON 가져오기</h2><p>가져온 캐릭터도 같은 선택 화면에서 검토합니다.</p><textarea value={value} onChange={(event) => setValue(event.target.value)}/><button className="primary" onClick={onPreview}>가져와서 검토</button>{draft.importStatus && draft.importStatus !== "idle" && <div className={`validation ${draft.importStatus === "valid" ? "info" : "blocking"}`}>{draft.importMessage}</div>}</section>; }

export function LevelUpFocused({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  const { snapshot, startLevelUp, updateLevelUp, commitLevelUp } = useSimpleVtt();
  const character = snapshot?.activeCharacter;
  const draft = snapshot?.levelUpDraft;
  const [focus, setFocus] = useState<LevelUpFocusId>("choice");
  useEffect(() => { if (character && !draft) void startLevelUp(character.id); }, [character, draft, startLevelUp]);
  if (!snapshot || !character || !draft) return <div className="loading-screen">레벨 업 준비 중…</div>;
  const blocking = draft.validation.some((message) => message.severity === "blocking");
  const focusItems = levelUpFocusItems(draft);
  const eligibleFeats = snapshot.catalog.filter((entry) => entry.category === "feat");
  return <div className="focused-level-shell">
    <header className="focused-level-header"><div><span>LEVEL UP</span><h1>{character.name} · {draft.fromLevel} → {draft.toLevel}</h1></div><button onClick={onCancel}>취소</button></header>
    <div className="focused-level-body"><aside className="focused-level-nav"><span>이번 레벨에서 결정할 것</span>{focusItems.map((item, index) => <button key={item.id} className={focus === item.id ? "active" : ""} onClick={() => setFocus(item.id)}><i>{item.needsAttention ? "!" : index + 1}</i><span><strong>{item.label}</strong><small>{item.detail}</small></span></button>)}</aside><main className="focused-level-stage"><div className="focused-level-stage-inner"><AutomaticLevelChanges draft={draft}/>{focus === "hp" ? <HpChoice draft={draft} onChange={(value) => updateLevelUp({ type: "set-hp-method", value })}/> : focus === "choice" ? <AdvancementChoice draft={draft} eligibleFeats={eligibleFeats} onUpdate={updateLevelUp}/> : <LevelReview draft={draft}/>}</div></main><aside className="focused-level-preview"><span>AFTER LEVEL UP</span><h2>{character.name} {draft.toLevel}레벨</h2><div className="diff-list rich">{draft.preview.diffs.map((diff) => <div key={diff.label}><span>{diff.label}<small>{diff.source}</small></span><b>{diff.before}</b><i>→</i><strong>{diff.after}</strong></div>)}</div>{draft.validation.map((message) => <div className={`validation ${message.severity}`} key={message.message}>{message.message}</div>)}</aside></div>
    <footer className="focused-level-footer"><span>자동 획득은 이미 반영되어 있고, 선택만 확인하면 됩니다.</span><button className="primary" disabled={blocking} onClick={async () => { await commitLevelUp(); onDone(); }}>레벨 업 확정</button></footer>
  </div>;
}

function AutomaticLevelChanges({ draft }: { draft: NonNullable<ReturnType<typeof useSimpleVtt>["snapshot"]>["levelUpDraft"] extends infer T ? NonNullable<T> : never }) { return <section className="focused-level-auto"><span>자동 획득</span><h2>{draft.preview.grantedFeatures.join(" · ") || "클래스 진행"}</h2><p>Hit Dice {draft.preview.hitDiceBefore} → {draft.preview.hitDiceAfter}</p>{draft.preview.resourceChanges.map((change) => <p key={change}>{change}</p>)}</section>; }

function HpChoice({ draft, onChange }: { draft: NonNullable<ReturnType<typeof useSimpleVtt>["snapshot"]>["levelUpDraft"] extends infer T ? NonNullable<T> : never; onChange(value: "fixed" | "roll"): void }) { return <section className="focused-level-panel"><span>HIT POINTS</span><h2>생명력 증가</h2><p>이번 레벨에서 사용할 HP 증가 방식을 선택합니다.</p><div className="method-tabs"><button className={draft.hpMethod === "fixed" ? "active" : ""} onClick={() => onChange("fixed")}><strong>고정값</strong><span>최대 HP {draft.preview.maxHpBefore} → {draft.preview.maxHpAfter}</span></button><button className={draft.hpMethod === "roll" ? "active" : ""} onClick={() => onChange("roll")}><strong>Hit Die 굴림</strong><span>굴림 결과를 사용</span></button></div></section>; }

function AdvancementChoice({ draft, eligibleFeats, onUpdate }: { draft: NonNullable<ReturnType<typeof useSimpleVtt>["snapshot"]>["levelUpDraft"] extends infer T ? NonNullable<T> : never; eligibleFeats: Array<{ id: string; nameKo: string; nameEn: string; source: string }>; onUpdate(command: { type: "set-step" | "set-hp-method" | "set-asi-mode" | "set-asi-primary" | "set-asi-secondary" | "set-feat"; value: string | number }): Promise<void> }) { return <section className="focused-level-panel"><span>CHOICE</span><h2>능력치 향상 또는 재주</h2><p>현재 레벨에서 실제로 열린 선택만 처리합니다.</p><div className="method-tabs"><button className={draft.asiMode === "plus-two" ? "active" : ""} onClick={() => onUpdate({ type: "set-asi-mode", value: "plus-two" })}><strong>능력치 +2</strong><span>한 능력치</span></button><button className={draft.asiMode === "split" ? "active" : ""} onClick={() => onUpdate({ type: "set-asi-mode", value: "split" })}><strong>+1 / +1</strong><span>서로 다른 두 능력치</span></button><button className={draft.asiMode === "feat" ? "active" : ""} onClick={() => onUpdate({ type: "set-asi-mode", value: "feat" })}><strong>재주</strong><span>적격 목록에서 선택</span></button></div>{draft.asiMode === "feat" ? <div className="catalog-choice-grid">{eligibleFeats.map((feat) => <button className={draft.featId === feat.id ? "selected" : ""} key={feat.id} onClick={() => onUpdate({ type: "set-feat", value: feat.id })}><strong>{feat.nameKo}</strong><small>{feat.nameEn}</small><span>{feat.source}</span></button>)}</div> : <div className="choice-grid"><label className="field"><span>첫 번째 능력치</span><select value={draft.asiPrimary} onChange={(event) => onUpdate({ type: "set-asi-primary", value: event.target.value })}>{ABILITY_KEYS.map((key) => <option value={key} key={key}>{ABILITY_LABELS[key]}</option>)}</select></label>{draft.asiMode === "split" && <label className="field"><span>두 번째 능력치</span><select value={draft.asiSecondary} onChange={(event) => onUpdate({ type: "set-asi-secondary", value: event.target.value })}>{ABILITY_KEYS.map((key) => <option value={key} key={key}>{ABILITY_LABELS[key]}</option>)}</select></label>}</div>}</section>; }

function LevelReview({ draft }: { draft: NonNullable<ReturnType<typeof useSimpleVtt>["snapshot"]>["levelUpDraft"] extends infer T ? NonNullable<T> : never }) { return <section className="focused-level-panel"><span>REVIEW</span><h2>이번 레벨의 변화</h2><p>자동 획득과 선택 결과를 한 번에 확인합니다.</p><div className="review-rows">{draft.preview.diffs.map((diff) => <div key={diff.label}><span>{diff.label}</span><strong>{diff.before} → {diff.after} · {diff.source}</strong></div>)}</div></section>; }
