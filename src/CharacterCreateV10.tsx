import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { AbilityKey, CharacterCreateDraft, CharacterCreationPlan, CharacterCreationSection, CharacterCreationSectionStatus } from "./app/contracts";
import { AbilitiesSection } from "./character-create/V09Abilities";
import { ClassSectionV10, DynamicChoiceSection, EquipmentSectionV10, IdentitySectionV10, ProficienciesSectionV10, ReviewSectionV10, SourceSectionV10 } from "./character-create/V10Sections";

const LABELS: Record<string,string> = { identity:"정체성", species:"종족", class:"클래스", background:"배경", abilities:"능력치", proficiencies:"기술", review:"검토" };
const PRIMARY_IDS = ["identity","species","class","background","abilities","proficiencies","review"] as const;
const ABILITY_LABELS: Record<AbilityKey,string> = { str:"근력", dex:"민첩", con:"건강", int:"지능", wis:"지혜", cha:"매력" };

function primarySections(plan: CharacterCreationPlan) {
  return PRIMARY_IDS.map((id) => plan.sections.find((item) => item.id === id)).filter((item): item is CharacterCreationSection => Boolean(item));
}
function contextSections(plan: CharacterCreationPlan, primaryId: string) {
  return plan.sections.filter((item) => !PRIMARY_IDS.includes(item.id as (typeof PRIMARY_IDS)[number]) && item.id !== "rules" && item.dependsOn.includes(primaryId) && item.status !== "not-applicable");
}
function primaryStatus(plan: CharacterCreationPlan, section: CharacterCreationSection): CharacterCreationSectionStatus {
  const children = contextSections(plan, section.id);
  if (children.some((item) => item.status === "blocked")) return "blocked";
  if (children.some((item) => item.status === "incomplete")) return "incomplete";
  if (children.some((item) => item.status === "warning")) return "warning";
  return section.status;
}
function ownerForSection(plan: CharacterCreationPlan, sectionId: string) {
  if (PRIMARY_IDS.includes(sectionId as (typeof PRIMARY_IDS)[number])) return sectionId;
  return plan.sections.find((item) => item.id === sectionId)?.dependsOn.find((id) => PRIMARY_IDS.includes(id as (typeof PRIMARY_IDS)[number]));
}
function nextPrimary(plan: CharacterCreationPlan, current: string, direction: 1 | -1) {
  const items = primarySections(plan);
  const index = Math.max(0, items.findIndex((item) => item.id === current));
  return items[Math.min(items.length - 1, Math.max(0, index + direction))]?.id ?? "identity";
}

export function CharacterCreateScreenV10({ onDone, onCancel }: { onDone():void; onCancel():void }) {
  const { snapshot, createCharacterDraft, updateCharacterDraft, finalizeCharacterDraft } = useSimpleVtt();
  const [importText, setImportText] = useState('{\n  "name": "새 캐릭터",\n  "className": "파이터",\n  "species": "인간",\n  "background": "군인",\n  "level": 1\n}');
  if (!snapshot?.createDraft) return <div className="focused-create-empty"><div><span>CHARACTER CREATION</span><h1>새 캐릭터</h1><p>큰 선택을 고르면 그 선택 때문에 필요한 결정이 같은 화면에서 이어집니다.</p><div className="focused-empty-actions"><button className="primary" onClick={() => createCharacterDraft("guided")}>캐릭터 만들기</button><button onClick={() => createCharacterDraft("duplicate")}>현재 캐릭터 복제</button><button onClick={onCancel}>돌아가기</button></div></div></div>;
  const draft = snapshot.createDraft;
  const plan = snapshot.creationPlan;
  if (!plan) return <div className="loading-screen">캐릭터 선택 준비 중…</div>;
  const primary = primarySections(plan);
  const owner = ownerForSection(plan, plan.activeSectionId) ?? plan.recommendedSectionId;
  const active = primary.find((item) => item.id === owner) ?? primary[0];
  const context = contextSections(plan, active.id);
  const blocking = plan.validation.some((message) => message.severity === "blocking");
  const importPending = draft.mode === "import" && draft.importStatus !== "valid";
  const go = (id:string) => void updateCharacterDraft({ type:"set-section", value:id });
  return <div className="focused-create-shell">
    <header className="focused-create-header"><div className="focused-create-title"><span>{draft.editingCharacterId ? "CHARACTER EDIT" : "CHARACTER CREATION"}</span><strong>{draft.name || "이름 없는 캐릭터"}</strong></div><nav className="focused-create-tabs">{primary.map((section) => { const state = primaryStatus(plan, section); return <button key={section.id} className={`${active.id === section.id ? "active" : ""} status-${state}`} onClick={() => go(section.id)}><i>{state === "complete" ? "✓" : state === "warning" ? "!" : state === "incomplete" || state === "blocked" ? "•" : ""}</i><span>{LABELS[section.id] ?? section.label}</span></button>; })}</nav><div className="focused-create-header-actions"><button onClick={() => createCharacterDraft("import")}>JSON</button><button onClick={onCancel}>닫기</button></div></header>
    <div className="focused-create-body"><main className="focused-create-stage">{importPending ? <ImportPanel draft={draft} value={importText} setValue={setImportText} onPreview={() => updateCharacterDraft({ type:"import-json", value:importText })}/> : <PrimaryFlow section={active} context={context} plan={plan} draft={draft}/>}</main><CharacterPreview plan={plan} draft={draft} onReview={() => go("review")}/></div>
    <footer className="focused-create-footer"><button disabled={primary[0]?.id === active.id || importPending} onClick={() => go(nextPrimary(plan, active.id, -1))}>이전</button><div><span>{LABELS[active.id] ?? active.label}</span><small>{context.length ? `${active.label}에서 필요한 결정 ${context.length}개를 함께 처리합니다.` : active.description}</small></div>{active.id === "review" ? <button className="primary" disabled={blocking || importPending} onClick={async () => { await finalizeCharacterDraft(); onDone(); }}>{draft.editingCharacterId ? "변경 적용" : "모험 시작"}</button> : <button className="primary" disabled={importPending} onClick={() => go(nextPrimary(plan, active.id, 1))}>다음</button>}</footer>
  </div>;
}

function PrimaryFlow({ section, context, plan, draft }: { section:CharacterCreationSection; context:CharacterCreationSection[]; plan:CharacterCreationPlan; draft:CharacterCreateDraft }) {
  const root = <PrimaryRoot section={section} plan={plan} draft={draft}/>;
  if (!context.length || section.id === "review" || section.id === "abilities" || section.id === "proficiencies") return root;
  return <div className="focused-primary-flow">{root}<div className="focused-context-block"><div className="focused-context-heading"><span>현재 선택에서 이어지는 결정</span><strong>{sourceName(section.id, draft)}에게 지금 필요한 결정</strong><p>별도 체크리스트로 이동하지 않고 현재 선택의 결과를 바로 이어서 정합니다.</p></div>{context.map((child) => <ContextSection key={child.id} section={child}/>)}</div></div>;
}
function PrimaryRoot({ section, plan, draft }: { section:CharacterCreationSection; plan:CharacterCreationPlan; draft:CharacterCreateDraft }) {
  if (section.kind === "identity") return <IdentitySectionV10 section={section} draft={draft}/>;
  if (section.kind === "species") return <SourceSectionV10 section={section} commandType="set-species"/>;
  if (section.kind === "background") return <SourceSectionV10 section={section} commandType="set-background"/>;
  if (section.kind === "class") return <ClassSectionV10 section={section} draft={draft}/>;
  if (section.kind === "abilities") return <AbilitiesSection section={section} draft={draft}/>;
  if (section.kind === "proficiencies") return <ProficienciesSectionV10 section={section} draft={draft}/>;
  return <ReviewSectionV10 section={section} plan={plan} draft={draft}/>;
}
function ContextSection({ section }: { section:CharacterCreationSection }) {
  if (section.kind === "dynamic-choice") return <DynamicChoiceSection section={section}/>;
  if (section.kind === "equipment") return <EquipmentSectionV10 section={section}/>;
  return null;
}
function sourceName(id:string, draft:CharacterCreateDraft) { if (id === "class") return draft.className || "클래스"; if (id === "species") return draft.species || "종족"; if (id === "background") return draft.background || "배경"; return draft.name || "캐릭터"; }
function CharacterPreview({ plan, draft, onReview }: { plan:CharacterCreationPlan; draft:CharacterCreateDraft; onReview():void }) {
  const unresolved = primarySections(plan).filter((section) => ["incomplete","blocked"].includes(primaryStatus(plan, section))).map((section) => LABELS[section.id] ?? section.label);
  const abilities = draft.finalAbilities ?? draft.abilities;
  return <aside className="focused-character-preview"><div className="focused-character-portrait"><span>{(draft.name || "?").slice(0,1)}</span></div><div className="focused-character-identity"><h2>{draft.name || "이름 없음"}</h2><p>{draft.className ? `${draft.className} ${draft.level}` : "클래스 미선택"}</p><span>{draft.species || "종족 미선택"} · {draft.background || "배경 미선택"}</span></div><div className="focused-character-vitals"><div><span>HP</span><strong>{draft.derived.hp}</strong></div><div><span>AC</span><strong>{draft.derived.ac}</strong></div><div><span>이동</span><strong>{draft.derived.speed}</strong></div></div><div className="focused-character-abilities">{Object.entries(abilities).map(([key,value]) => <div key={key}><span>{ABILITY_LABELS[key as AbilityKey]}</span><strong>{value}</strong></div>)}</div><div className="focused-character-gold"><span>시작 GP</span><strong>{draft.goldGp ?? 0}</strong></div><button className="focused-review-button" onClick={onReview}><span>캐릭터 검토</span><strong>{unresolved.length ? `${unresolved.join(" · ")} 확인 필요` : "준비 완료"}</strong></button></aside>;
}
function ImportPanel({ draft, value, setValue, onPreview }: { draft:CharacterCreateDraft; value:string; setValue(value:string):void; onPreview():void }) { return <section className="focused-import"><span>IMPORT CHARACTER</span><h2>JSON 가져오기</h2><p>가져온 기본 source를 같은 생성 화면에서 검토하고 필요한 SRD 선택을 완성합니다.</p><textarea value={value} onChange={(event) => setValue(event.target.value)}/><button className="primary" onClick={onPreview}>가져와서 검토</button>{draft.importStatus && draft.importStatus !== "idle" && <div className={`validation ${draft.importStatus === "valid" ? "info" : "blocking"}`}>{draft.importMessage}</div>}</section>; }
