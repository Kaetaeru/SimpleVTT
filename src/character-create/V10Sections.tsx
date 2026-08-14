import { useMemo, useState, type ReactNode } from "react";
import { useSimpleVtt } from "../app/AppProvider";
import type { CharacterCreateDraft, CharacterCreationPlan, CharacterCreationSection } from "../app/contracts";
import { classIdFromName, classMeta } from "../app/characterCreationV10Data";
import { classAndBackgroundLoadout, finalCantrips, finalLanguageNames, finalMasteryWeapons, finalPreparedSpells, finalSkillNames, finalSpellbook, finalToolProficiencies, selectedChoiceLabels } from "../app/characterCreationV10Choices";
import { spellMatchesFilter, spellNameKo, spellPresentationById, spellSearchText, type SpellUiFilter } from "../app/spellPresentation";
import { SpellTile } from "../SpellUi";
import { OptionCard, SectionShell } from "./v09Ui";

const SPELL_FILTERS: Array<{ id:SpellUiFilter; label:string }> = [
  { id:"all", label:"전체" },
  { id:"concentration", label:"집중" },
  { id:"ritual", label:"의식" },
  { id:"action", label:"행동" },
  { id:"bonus", label:"보너스 행동" },
  { id:"reaction", label:"반응" },
];

export function IdentitySectionV10({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  return <SectionShell section={section}><div className="create-identity-form"><label><span>캐릭터 이름</span><input value={draft.name} onChange={(event) => updateCharacterDraft({ type:"set-name", value:event.target.value })} placeholder="이름 입력"/></label><label><span>서술 메모</span><textarea value={draft.notes} onChange={(event) => updateCharacterDraft({ type:"set-notes", value:event.target.value })} placeholder="외형, 성격, 플레이 메모"/></label></div></SectionShell>;
}

export function SourceSectionV10({ section, commandType }: { section: CharacterCreationSection; commandType:"set-species" | "set-background" }) {
  return <SectionShell section={section}><SourceGrid section={section} commandType={commandType}/></SectionShell>;
}

export function ClassSectionV10({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) {
  return <SectionShell section={section} aside={<div className="future-choice-note"><strong>현재 레벨만 표시</strong><span>서브클래스와 이후 레벨 재주는 레벨업에서 실제로 열릴 때 선택합니다.</span></div>}><SourceGrid section={section} commandType="set-class"/>{draft.editingCharacterId && draft.subclassName && <div className="progression-owned"><span>현재 서브클래스</span><strong>{draft.subclassName}</strong><small>기존 진행 상태는 캐릭터 생성에서 다시 선택하지 않습니다.</small></div>}</SectionShell>;
}

function SourceGrid({ section, commandType }: { section: CharacterCreationSection; commandType:"set-species" | "set-background" | "set-class" }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => section.options.filter((option) => `${option.name} ${option.nameEn}`.toLowerCase().includes(query.toLowerCase())), [section.options, query]);
  return <><label className="create-search"><span>검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="한국어 / English"/></label><div className="create-option-grid">{filtered.map((option) => <OptionCard key={option.id} option={option} onClick={() => updateCharacterDraft({ type:commandType, value:option.name })}/>)}</div></>;
}

export function ProficienciesSectionV10({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const count = draft.className ? classMeta(classIdFromName(draft.className)).semantics.skills.count : 0;
  return <SectionShell section={section}>{draft.className ? <><div className="choice-prompt"><strong>클래스 기술 숙련 {count}개</strong><span>{draft.selectedSkills.length}/{count} 선택됨 · 배경과 종족에서 받는 숙련은 최종 시트에 별도로 합쳐집니다.</span></div><div className="proficiency-grid">{section.options.map((option) => { const full = draft.selectedSkills.length >= count && !option.selected; return <button key={option.id} disabled={full} className={option.selected ? "selected" : ""} onClick={() => updateCharacterDraft({ type:"toggle-skill", value:option.name })}><span>{option.name}</span><small>{option.source}</small></button>; })}</div></> : <div className="create-principle-callout"><strong>클래스를 먼저 선택하세요.</strong><span>클래스를 고르면 그 클래스가 허용하는 기술 후보만 표시됩니다.</span></div>}</SectionShell>;
}

function isSpellChoiceSection(section: CharacterCreationSection) {
  return Boolean(section.selection && section.options.length > 0 && section.options.every((option) => option.id.startsWith("dnd.srd521.spell.")));
}

function SpellChoiceSection({ section }: { section: CharacterCreationSection }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const selection = section.selection!;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SpellUiFilter>("all");
  const selected = section.options.filter((option) => option.selected);
  const blocked = section.status === "blocked";
  const selectedCount = selected.length;
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visible = useMemo(() => section.options.filter((option) => {
    const spell = spellPresentationById(option.id);
    if (!spell) return false;
    if (!spellMatchesFilter(spell, filter)) return false;
    return !normalizedQuery || spellSearchText(spell).includes(normalizedQuery);
  }), [filter, normalizedQuery, section.options]);
  const levels = useMemo(() => Array.from(new Set(visible.map((option) => spellPresentationById(option.id)?.level).filter((level): level is number => level !== undefined))).sort((a,b) => a - b), [visible]);
  const toggle = (id:string) => updateCharacterDraft({ type:"toggle-class-choice", choiceId:selection.choiceId, value:id });

  return <SectionShell section={section}>
    {blocked && <div className="create-principle-callout"><strong>앞선 선택이 필요합니다.</strong><span>필요한 상위 선택을 마치면 주문 목록이 자동으로 열립니다.</span></div>}
    <div className="spell-choice-panel">
      <div className="spell-choice-topline"><div><span>SELECTED SPELLS</span><strong>{section.label}</strong><small>{section.description}</small></div><b>{selectedCount} / {selection.count}</b></div>
      <div className="spell-selected-strip">
        {selected.length ? selected.map((option) => <SpellTile key={option.id} spellId={option.id} selected status="선택됨" compact onClick={blocked ? undefined : () => toggle(option.id)}/>) : <span className="spell-selected-empty">아래 목록에서 주문을 선택하면 여기에 고정됩니다.</span>}
      </div>
      <div className="spell-library-toolbar">
        <div className="spell-filter-chips">{SPELL_FILTERS.map((item) => <button key={item.id} type="button" className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
        <label className="spell-search"><span>주문 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="한국어 / English / 학파 / 속성"/></label>
      </div>
      <div className="spell-level-groups">
        {levels.map((level) => {
          const options = visible.filter((option) => spellPresentationById(option.id)?.level === level);
          return <section className="spell-level-group" key={level}><header><strong>{level === 0 ? "소마법" : `${level}레벨`}</strong><span>{options.length}개</span></header><div className="spell-choice-grid">{options.map((option) => { const full = selectedCount >= selection.count && !option.selected; return <SpellTile key={option.id} spellId={option.id} selected={option.selected} disabled={blocked || full} onClick={blocked || full ? undefined : () => toggle(option.id)}/>; })}</div></section>;
        })}
        {!visible.length && <div className="spell-library-empty">조건에 맞는 주문이 없습니다.</div>}
      </div>
    </div>
  </SectionShell>;
}

export function DynamicChoiceSection({ section }: { section: CharacterCreationSection }) {
  if (isSpellChoiceSection(section)) return <SpellChoiceSection section={section}/>;
  const { updateCharacterDraft } = useSimpleVtt();
  const selection = section.selection;
  if (!selection) return null;
  const selectedCount = section.options.filter((option) => option.selected).length;
  const blocked = section.status === "blocked";
  return <SectionShell section={section}>{blocked && <div className="create-principle-callout"><strong>앞선 선택이 필요합니다.</strong><span>필요한 상위 선택을 마치면 이 선택지가 자동으로 열립니다.</span></div>}<div className="choice-prompt"><strong>{selection.count}개 선택</strong><span>{selectedCount}/{selection.count} 선택됨</span></div><div className="create-option-grid dynamic-choice-grid">{section.options.map((option) => { const full = selectedCount >= selection.count && !option.selected; return <OptionCard key={option.id} option={option} onClick={blocked || full ? undefined : () => updateCharacterDraft({ type:"toggle-class-choice", choiceId:selection.choiceId, value:option.id })}/>; })}</div></SectionShell>;
}

export function EquipmentSectionV10({ section }: { section: CharacterCreationSection }) {
  const { updateCharacterDraft } = useSimpleVtt();
  return <SectionShell section={section}><div className="create-option-grid equipment-options">{section.options.map((option) => <OptionCard key={option.id} option={option} onClick={() => updateCharacterDraft({ type:"set-equipment", value:option.id })}/>)}</div></SectionShell>;
}

export function ReviewSectionV10({ section, plan, draft }: { section: CharacterCreationSection; plan: CharacterCreationPlan; draft: CharacterCreateDraft }) {
  const labels = selectedChoiceLabels(draft);
  const loadout = classAndBackgroundLoadout(draft);
  const final = draft.finalAbilities ?? draft.abilities;
  const grants = plan.sections.flatMap((item) => item.automaticGrants.map((grant) => `${item.label} · ${grant}`));
  const choiceRows = Object.entries(labels).filter(([, values]) => values.length > 0);
  return <SectionShell section={section}><div className="create-review-grid"><ReviewGroup title="캐릭터"><ReviewRow label="종족" value={draft.species || "미선택"}/><ReviewRow label="배경" value={draft.background || "미선택"}/><ReviewRow label="클래스" value={`${draft.className || "미선택"} ${draft.level}`}/><ReviewRow label="능력치" value={Object.entries(final).map(([key,value]) => `${key.toUpperCase()} ${value}`).join(" · ")}/><ReviewRow label="기술" value={finalSkillNames(draft).join(", ") || "없음"}/><ReviewRow label="언어" value={finalLanguageNames(draft).join(", ")}/><ReviewRow label="도구" value={finalToolProficiencies(draft).join(", ") || "없음"}/></ReviewGroup><ReviewGroup title="선택 결과">{choiceRows.length ? choiceRows.map(([id, values]) => <ReviewRow key={id} label={shortChoiceLabel(id)} value={values.join(", ")}/>) : <span className="review-line">아직 선택 없음</span>}</ReviewGroup><ReviewGroup title="주문 / 통달"><ReviewRow label="무기 통달" value={finalMasteryWeapons(draft).join(", ") || "없음"}/><ReviewRow label="소마법" value={displaySpellIds(finalCantrips(draft)).join(", ") || "없음"}/><ReviewRow label="준비 주문" value={displaySpellIds(finalPreparedSpells(draft)).join(", ") || "없음"}/><ReviewRow label="주문서" value={displaySpellIds(finalSpellbook(draft)).join(", ") || "없음"}/></ReviewGroup><ReviewGroup title="장비 / 파생"><ReviewRow label="장비" value={loadout.items.map((item) => item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name).join(", ") || "시작 금화"}/><ReviewRow label="GP" value={`${draft.goldGp ?? loadout.gp} GP`}/><ReviewRow label="최대 HP" value={String(draft.derived.hp)}/><ReviewRow label="AC" value={String(draft.derived.ac)}/><ReviewRow label="이동" value={`${draft.derived.speed} ft`}/></ReviewGroup><ReviewGroup title="자동 획득">{grants.length ? grants.map((grant) => <span className="review-line" key={grant}>{grant}</span>) : <span className="review-line">클래스/종족/배경 source에서 자동 적용</span>}</ReviewGroup><ReviewGroup title="검증">{plan.validation.length ? plan.validation.map((message, index) => <div className={`validation ${message.severity}`} key={`${message.message}-${index}`}>{message.severity.toUpperCase()} · {message.message}</div>) : <div className="validation info">필수 선택 완료</div>}</ReviewGroup></div></SectionShell>;
}

function displaySpellIds(ids: string[]) { return ids.map((id) => { const always = id.startsWith("always:"); const raw = always ? id.slice("always:".length) : id; const name = spellNameKo(raw, raw.replace(/^dnd\.srd521\.spell\./, "").replaceAll("-", " ")); return always ? `항상 준비 · ${name}` : name; }); }
function shortChoiceLabel(id: string) { return id.replace(/^identity\./, "").replace(/^species\./, "").replace(/^background\./, "").replace(/^class\./, "").replaceAll("-", " "); }
function ReviewGroup({ title, children }: { title:string; children:ReactNode }) { return <section className="create-review-group"><h3>{title}</h3>{children}</section>; }
function ReviewRow({ label, value }: { label:string; value:string }) { return <div className="create-review-row"><span>{label}</span><strong>{value}</strong></div>; }
