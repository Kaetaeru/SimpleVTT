import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { CharacterCreateDraft, CharacterCreationPlan, CharacterCreationSection } from "./app/contracts";
import { creationContextSections, creationPrimarySections, creationPrimaryStatus, nextCreationPrimaryId } from "./app/characterProgressionPresentation";
import { AbilitiesSection } from "./character-create/V09Abilities";
import { ClassChoicesSection, ClassSection, EquipmentSection, IdentitySection, ProficienciesSection, ReviewSection, SourceSection, SpellSection } from "./character-create/V09Sections";

const LABELS: Record<string, string> = { identity: "정체성", species: "종족", class: "클래스", background: "배경", abilities: "능력치", proficiencies: "기술", review: "검토" };

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
