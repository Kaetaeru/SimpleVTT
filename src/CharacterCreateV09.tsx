import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { CharacterCreateDraft, CharacterCreationPlan, CharacterCreationSection } from "./app/contracts";
import { AbilitiesSection } from "./character-create/V09Abilities";
import { ClassChoicesSection, ClassSection, EquipmentSection, IdentitySection, ProficienciesSection, ReviewSection, SourceSection, SpellSection } from "./character-create/V09Sections";
import { OptionCard, SectionShell, STATUS_LABEL } from "./character-create/v09Ui";

export function CharacterCreateScreenV09({ onDone, onCancel }: { onDone(): void; onCancel(): void }) {
  const { snapshot, createCharacterDraft, updateCharacterDraft, finalizeCharacterDraft } = useSimpleVtt();
  const [importText, setImportText] = useState('{\n  "name": "새 캐릭터",\n  "className": "전사",\n  "species": "인간",\n  "background": "병사",\n  "level": 1\n}');
  if (!snapshot?.createDraft) return <div className="screen page-dark create-v09-empty"><div><span className="eyebrow accent">CHARACTER CREATION v0.9</span><h1>새 캐릭터</h1><p>큰 선택을 하나씩 고르고, 그 선택 때문에 생긴 질문만 해결합니다.</p><button className="primary" onClick={() => createCharacterDraft("guided")}>가이드 생성 시작</button></div></div>;
  const draft = snapshot.createDraft;
  const plan = snapshot.creationPlan;
  if (!plan) return <div className="loading-screen">CharacterCreationPlan 계산 중…</div>;
  const active = plan.sections.find((section) => section.id === plan.activeSectionId) ?? plan.sections[0];
  const blocking = plan.validation.some((message) => message.severity === "blocking");
  const importPending = draft.mode === "import" && draft.importStatus !== "valid";
  const openSection = (section: CharacterCreationSection) => { if (section.status !== "blocked" && section.status !== "not-applicable") void updateCharacterDraft({ type: "set-section", value: section.id }); };
  const nav = plan.sections.filter((section) => section.status !== "blocked" && section.status !== "not-applicable");
  const index = nav.findIndex((section) => section.id === active.id);
  const previous = index > 0 ? nav[index - 1] : undefined;
  const next = index >= 0 ? nav[index + 1] : nav[0];
  const canCommit = active.id === "review" && !blocking && !importPending;
  return <div className="builder-screen create-v09">
    <header className="builder-top create-v09-top"><div><span className="eyebrow accent">{draft.editingCharacterId ? "캐릭터 편집 · v0.9" : "캐릭터 생성 · v0.9"}</span><h1>{draft.name || "이름 없는 캐릭터"}</h1></div><div className="mode-tabs create-v09-modes"><button className={draft.mode === "guided" ? "active" : ""} onClick={() => updateCharacterDraft({ type: "set-mode", value: "guided" })}>가이드</button><button className={draft.mode === "quick" ? "active" : ""} onClick={() => updateCharacterDraft({ type: "set-mode", value: "quick" })}>빠른 편집</button><button className={draft.mode === "import" ? "active" : ""} onClick={() => createCharacterDraft("import")}>JSON 가져오기</button><button className={draft.mode === "duplicate" ? "active" : ""} onClick={() => createCharacterDraft("duplicate")}>Aelar 복제</button></div><button onClick={onCancel}>닫기</button></header>
    <div className="create-v09-layout"><CreationRail plan={plan} onOpen={openSection}/><main className="create-v09-main">{importPending ? <ImportEntry draft={draft} value={importText} setValue={setImportText} onPreview={() => updateCharacterDraft({ type: "import-json", value: importText })}/> : draft.mode === "quick" ? <QuickPlan plan={plan} draft={draft} onOpen={(section) => { void updateCharacterDraft({ type: "set-mode", value: "guided" }).then(() => updateCharacterDraft({ type: "set-section", value: section.id })); }}/> : <SectionView section={active} plan={plan} draft={draft}/>}</main><CreationSummary plan={plan}/></div>
    <footer className="builder-footer create-v09-footer"><button disabled={!previous || draft.mode === "quick" || importPending} onClick={() => previous && openSection(previous)}>이전</button><div className="create-v09-progress"><span>{plan.sections.filter((section) => section.status === "complete").length} 완료</span><span>·</span><span>{plan.summary.unresolvedCount} 미해결</span><span>·</span><span>{plan.summary.blockingCount} Blocking</span></div>{draft.mode === "quick" ? <button className="primary" onClick={() => { void updateCharacterDraft({ type: "set-mode", value: "guided" }).then(() => updateCharacterDraft({ type: "set-section", value: plan.recommendedSectionId })); }}>추천 다음 항목 열기</button> : canCommit ? <button className="primary" onClick={async () => { await finalizeCharacterDraft(); onDone(); }}>{draft.editingCharacterId ? "변경 Revision 저장" : "캐릭터 생성"}</button> : <button className="primary" disabled={!next || importPending} onClick={() => next && openSection(next)}>다음</button>}</footer>
  </div>;
}

function CreationRail({ plan, onOpen }: { plan: CharacterCreationPlan; onOpen(section: CharacterCreationSection): void }) {
  return <aside className="builder-steps create-v09-rail"><div className="create-v09-rail-title"><span className="eyebrow">BUILD SECTIONS</span><strong>캐릭터 생성</strong></div>{plan.sections.map((section, index) => <button key={section.id} disabled={section.status === "blocked" || section.status === "not-applicable"} className={`${plan.activeSectionId === section.id ? "active" : ""} status-${section.status}`} onClick={() => onOpen(section)}><b>{section.status === "complete" ? "✓" : section.status === "warning" ? "!" : section.status === "not-applicable" ? "—" : String(index + 1).padStart(2, "0")}</b><span><strong>{section.label}</strong><small>{STATUS_LABEL[section.status]}</small></span></button>)}</aside>;
}

function CreationSummary({ plan }: { plan: CharacterCreationPlan }) {
  const s = plan.summary;
  return <aside className="builder-preview create-v09-summary"><span className="eyebrow accent">현재 캐릭터</span><h2>{s.name || "이름 없음"}</h2><div className="create-summary-sources"><Summary label="종족" value={s.species || "미선택"}/><Summary label="배경" value={s.background || "미선택"}/><Summary label="클래스" value={s.className ? `${s.className} ${s.level}` : "미선택"}/><Summary label="서브클래스" value={s.subclassName || (s.level === 1 ? "레벨업에서 해금 시 선택" : "미선택")}/></div><h3 className="section-title">능력치</h3><div className="ability-mini">{Object.entries(s.abilities).map(([key, value]) => <span key={key}>{key.toUpperCase()} <b>{value}</b></span>)}</div><h3 className="section-title">진행 상태</h3><div className="create-summary-counts"><span><b>{s.unresolvedCount}</b> 미해결</span><span className={s.blockingCount ? "bad-text" : "good-text"}><b>{s.blockingCount}</b> Blocking</span><span><b>{s.warningCount}</b> Warning</span></div><div className="builder-save">하나의 초안 · 자동 저장 · Guided/Quick 공유</div></aside>;
}
function Summary({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }

function SectionView({ section, plan, draft }: { section: CharacterCreationSection; plan: CharacterCreationPlan; draft: CharacterCreateDraft }) {
  if (section.kind === "rules-profile") return <SectionShell section={section}><div className="create-option-grid">{section.options.map((option) => <OptionCard key={option.id} option={option}/>)}</div></SectionShell>;
  if (section.kind === "identity") return <IdentitySection section={section} draft={draft}/>;
  if (section.kind === "species") return <SourceSection section={section} commandType="set-species"/>;
  if (section.kind === "background") return <SourceSection section={section} commandType="set-background"/>;
  if (section.kind === "class") return <ClassSection section={section} draft={draft}/>;
  if (section.kind === "abilities") return <AbilitiesSection section={section} draft={draft}/>;
  if (section.kind === "proficiencies") return <ProficienciesSection section={section} draft={draft}/>;
  if (section.kind === "class-choices") return <ClassChoicesSection section={section}/>;
  if (section.kind === "equipment") return <EquipmentSection section={section}/>;
  if (section.kind === "spells") return <SpellSection section={section} draft={draft}/>;
  return <ReviewSection section={section} plan={plan} draft={draft}/>;
}

function QuickPlan({ plan, draft, onOpen }: { plan: CharacterCreationPlan; draft: CharacterCreateDraft; onOpen(section: CharacterCreationSection): void }) {
  return <section className="create-v09-section quick-plan"><header><div><span className="create-status-pill complete">동일 초안</span><h2>빠른 편집</h2><p>별도 간소화 모델이 아니라 같은 CharacterCreationPlan을 밀도 높게 봅니다.</p></div></header><div className="quick-plan-grid">{plan.sections.filter((section) => section.status !== "not-applicable").map((section) => <button key={section.id} disabled={section.status === "blocked"} className={`quick-section-card status-${section.status}`} onClick={() => onOpen(section)}><div><span>{STATUS_LABEL[section.status]}</span><strong>{section.label}</strong></div><p>{section.description}</p><small>{section.options.filter((option) => option.selected).map((option) => option.name).join(" · ") || section.automaticGrants.slice(0, 2).join(" · ") || "열어서 확인"}</small></button>)}</div><div className="create-principle-callout"><strong>현재 source</strong><span>{draft.species || "종족 미선택"} · {draft.background || "배경 미선택"} · {draft.className || "클래스 미선택"}</span></div></section>;
}

function ImportEntry({ draft, value, setValue, onPreview }: { draft: CharacterCreateDraft; value: string; setValue(value: string): void; onPreview(): void }) {
  return <section className="create-v09-section"><header><div><span className="create-status-pill incomplete">Import</span><h2>JSON 가져오기</h2><p>가져오기는 생성기를 우회하지 않습니다. 읽은 뒤 같은 Plan에서 미해결 선택을 검토합니다.</p></div></header><textarea className="json-box create-import-json" value={value} onChange={(event) => setValue(event.target.value)}/><button className="primary" onClick={onPreview}>검증하고 Plan으로 가져오기</button>{draft.importStatus && draft.importStatus !== "idle" && <div className={`validation ${draft.importStatus === "valid" ? "info" : "blocking"}`}>{draft.importMessage}</div>}</section>;
}
