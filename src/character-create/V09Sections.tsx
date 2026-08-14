import { useMemo, useState, type ReactNode } from "react";
import { useSimpleVtt } from "../app/AppProvider";
import type { CharacterCreateDraft, CharacterCreationPlan, CharacterCreationSection } from "../app/contracts";
import { meta } from "../app/characterCreationV09Meta";
import { OptionCard, SectionShell } from "./v09Ui";

export function IdentitySection({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  return <SectionShell section={section}><div className="create-identity-form"><label><span>캐릭터 이름</span><input value={draft.name} onChange={(event) => updateCharacterDraft({ type: "set-name", value: event.target.value })} placeholder="이름 입력"/></label><label><span>서술 메모</span><textarea value={draft.notes} onChange={(event) => updateCharacterDraft({ type: "set-notes", value: event.target.value })} placeholder="외형, 성격, 플레이 메모"/></label></div><div className="create-principle-callout"><strong>규칙 선택과 분리</strong><span>이름과 서술 정보는 클래스·종족·배경의 규칙 source가 아닙니다.</span></div></SectionShell>;
}

export function SourceSection({ section, commandType }: { section: CharacterCreationSection; commandType: "set-species" | "set-background" }) {
  return <SectionShell section={section}><OptionGrid section={section} commandType={commandType}/></SectionShell>;
}

export function ClassSection({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) {
  return <SectionShell section={section} aside={<div className="future-choice-note"><strong>미래 선택은 여기서 하지 않음</strong><span>서브클래스·재주·ASI는 실제 ProgressionDraft에서 해금될 때 나타납니다.</span></div>}><OptionGrid section={section} commandType="set-class"/>{draft.editingCharacterId && draft.subclassName && <div className="progression-owned"><span>현재 서브클래스</span><strong>{draft.subclassName}</strong><small>기존 Progression source · 여기서는 재선택하지 않음</small></div>}</SectionShell>;
}

function OptionGrid({ section, commandType }: { section: CharacterCreationSection; commandType: "set-species" | "set-background" | "set-class" }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => section.options.filter((option) => `${option.name} ${option.nameEn}`.toLowerCase().includes(query.toLowerCase())), [section.options, query]);
  return <><label className="create-search"><span>검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="한국어 / English"/></label><div className="create-option-grid">{filtered.map((option) => <OptionCard key={option.id} option={option} onClick={() => updateCharacterDraft({ type: commandType, value: option.name })}/>)}</div></>;
}

export function ProficienciesSection({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const m = meta(draft);
  return <SectionShell section={section}>{!m.skillsMapped ? <div className="create-principle-callout"><strong>카탈로그 semantic map 대기</strong><span>{draft.className || "이 클래스"}의 기술 숙련 개수는 class-definition에 있지만 후보 목록은 아직 reviewed semantic map에 없습니다. 잘못된 후보를 추론하지 않고 데모에서는 이 선택을 건너뜁니다.</span></div> : <><div className="choice-prompt"><strong>기술 숙련 {m.skillCount}개</strong><span>검토된 SRD semantic map이 후보를 제공합니다. {draft.selectedSkills.length}/{m.skillCount}</span></div><div className="proficiency-grid">{section.options.map((option) => <button key={option.id} className={option.selected ? "selected" : ""} onClick={() => updateCharacterDraft({ type: "toggle-skill", value: option.name })}><span>{option.name}</span><small>{option.source}</small></button>)}</div></>}</SectionShell>;
}

export function ClassChoicesSection({ section }: { section: CharacterCreationSection }) {
  const { updateCharacterDraft } = useSimpleVtt();
  if (section.status === "not-applicable") return <SectionShell section={section}><div className="create-principle-callout"><strong>현재 연결된 추가 선택이 없습니다.</strong><span>결정적 grants는 catalog metadata에서 확인합니다.</span></div></SectionShell>;
  if (!section.options.length) return <SectionShell section={section}><div className="create-principle-callout"><strong>카탈로그 ChoiceDefinition 연결 대기</strong><span>레벨 1에 선택이 존재하지만 아직 이 integration UI의 generic ChoiceDefinition으로 연결되지 않았습니다. 데모가 임의의 값을 고르지 않습니다.</span></div></SectionShell>;
  return <SectionShell section={section}><div className="create-option-grid">{section.options.map((option) => <OptionCard key={option.id} option={option} onClick={() => updateCharacterDraft({ type: "toggle-class-choice", value: option.id })}/>)}</div></SectionShell>;
}

export function EquipmentSection({ section }: { section: CharacterCreationSection }) {
  const { updateCharacterDraft } = useSimpleVtt();
  return <SectionShell section={section}><div className="create-option-grid equipment-options">{section.options.map((option) => <OptionCard key={option.id} option={option} onClick={() => updateCharacterDraft({ type: "set-equipment", value: option.id })}/>)}</div></SectionShell>;
}

export function SpellSection({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  return <SectionShell section={section}><div className="create-principle-callout"><strong>DEMO fallback</strong><span>PR #38에 주문 catalog 항목은 들어오고 있지만 class spell-list와 prepared/known Choice mapping은 아직 완성 전입니다. 아래 항목은 사용감 확인용이며 규칙 완성으로 세지 않습니다.</span></div><div className="choice-prompt"><strong>주문 선택 UI 미리보기</strong><span>{draft.selectedSpells.length}개 선택됨 · 현재는 완료 조건에 포함하지 않습니다.</span></div><div className="create-option-grid">{section.options.map((option) => <OptionCard key={option.id} option={option} onClick={() => updateCharacterDraft({ type: "toggle-spell", value: option.id })}/>)}</div></SectionShell>;
}

export function ReviewSection({ section, plan, draft }: { section: CharacterCreationSection; plan: CharacterCreationPlan; draft: CharacterCreateDraft }) {
  const grants = plan.sections.flatMap((item) => item.automaticGrants.map((grant) => `${item.label} · ${grant}`));
  return <SectionShell section={section}><div className="create-review-grid"><ReviewGroup title="Source choices"><ReviewRow label="RulesProfile" value={draft.rulesProfileId}/><ReviewRow label="종족" value={draft.species || "미선택"}/><ReviewRow label="배경" value={draft.background || "미선택"}/><ReviewRow label="클래스" value={`${draft.className || "미선택"} ${draft.level}`}/><ReviewRow label="서브클래스" value={draft.subclassName || "현재 레벨에서는 선택하지 않음"}/><ReviewRow label="능력치 방식" value={draft.abilityMethod}/><ReviewRow label="클래스 Choice" value={draft.selectedClassChoices?.join(", ") || "없음"}/><ReviewRow label="기술 숙련" value={draft.selectedSkills.join(", ") || "미선택/semantic pending"}/><ReviewRow label="주문 Choice" value={draft.selectedSpells.join(", ") || "미선택/데모"}/><ReviewRow label="시작 장비" value={draft.equipmentPreset || "미선택"}/></ReviewGroup><ReviewGroup title="Automatic grants">{grants.length ? grants.map((grant) => <span className="review-line" key={grant}>{grant}</span>) : <span className="review-line">없음</span>}</ReviewGroup><ReviewGroup title="Derived"><ReviewRow label="최대 HP" value={String(draft.derived.hp)}/><ReviewRow label="AC" value={String(draft.derived.ac)}/><ReviewRow label="이동" value={`${draft.derived.speed} ft`}/><ReviewRow label="숙련 보너스" value={`+${draft.derived.proficiencyBonus}`}/></ReviewGroup><ReviewGroup title="Validation">{plan.validation.length ? plan.validation.map((message, index) => <div className={`validation ${message.severity}`} key={`${message.message}-${index}`}>{message.severity.toUpperCase()} · {message.message}</div>) : <div className="validation info">Blocking 없음</div>}</ReviewGroup></div><div className="create-principle-callout"><strong>Catalog integration boundary</strong><span>클래스·종족·배경·시작 장비는 PR #38 RuleModule catalog가 source입니다. 아직 semantic coverage가 없는 선택은 warning으로 노출하며 추론하지 않습니다.</span></div></SectionShell>;
}

function ReviewGroup({ title, children }: { title: string; children: ReactNode }) { return <section className="create-review-group"><h3>{title}</h3>{children}</section>; }
function ReviewRow({ label, value }: { label: string; value: string }) { return <div className="create-review-row"><span>{label}</span><strong>{value}</strong></div>; }
