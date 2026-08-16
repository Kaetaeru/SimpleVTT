import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./app/creationContracts";
import { useSimpleVtt } from "./app/AppProvider";
import type { CharacterCreationOptionVm, CharacterCreationSection, CharacterCreationSectionStatus } from "./app/contracts";
import {
  LEVEL_UP_ABILITIES,
  projectLevelUpClassOptions,
  projectLevelUpFixedHpGain,
  projectLevelUpSubclassPresentation,
  rollLevelUpHitDie,
} from "./app/levelUpV10Presentation";
import { mockAdapter } from "./app/mockAdapter";
import type { ChoiceDefinition, ChoiceSelectionValue } from "./app/progressionContracts";
import type { Phase07AdapterCommands } from "./app/progressionRuntimeAdapter";
import { spellMatchesFilter, spellPresentationById, spellSearchText, type SpellUiFilter } from "./app/spellPresentation";
import { OptionCard, SectionShell } from "./character-create/v09Ui";
import { SpellTile } from "./SpellUi";
import { VisualDiceTray } from "./VisualDiceBridge";

const SPELL_FILTERS: Array<{ id:SpellUiFilter; label:string }> = [
  { id:"all", label:"전체" },
  { id:"concentration", label:"집중" },
  { id:"ritual", label:"의식" },
  { id:"action", label:"행동" },
  { id:"bonus", label:"보너스 행동" },
  { id:"reaction", label:"반응" },
];

type LevelUpStageId = "class" | "automatic" | "hp" | "choices" | "review";

const LEVEL_UP_STAGES: Array<{ id:LevelUpStageId; label:string }> = [
  { id:"class", label:"클래스" },
  { id:"automatic", label:"자동 획득" },
  { id:"hp", label:"HP" },
  { id:"choices", label:"선택" },
  { id:"review", label:"검토" },
];

function useLevelUpHost() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    let current: HTMLElement | null = null;
    const inspect = () => {
      if (cancelled) return;
      const builder = document.querySelector<HTMLElement>(".content > .builder-screen");
      const isLevelUp = builder?.querySelector(".builder-top .eyebrow")?.textContent?.trim() === "레벨 업";
      const next = isLevelUp ? builder?.parentElement as HTMLElement | null : null;
      if (current !== next) {
        current?.classList.remove("phase07-levelup-active");
        current = next;
        current?.classList.add("phase07-levelup-active");
        setHost(current);
      }
      requestAnimationFrame(inspect);
    };
    inspect();
    return () => {
      cancelled = true;
      current?.classList.remove("phase07-levelup-active");
    };
  }, []);
  return host;
}

function currentSelection(snapshot: NonNullable<ReturnType<typeof useSimpleVtt>["snapshot"]>, choiceId: string) {
  return snapshot.levelUpDraft?.progressionSelections?.[choiceId];
}

function selectionCount(selection: ChoiceSelectionValue | undefined) {
  if (!selection) return 0;
  if (selection.kind === "options") return selection.optionIds.length;
  return 1;
}

function choiceComplete(choice:ChoiceDefinition, selection:ChoiceSelectionValue|undefined) {
  if (!choice.required) return true;
  if (choice.status !== "ready") return false;
  if (choice.kind === "asi-or-feat") {
    if (selection?.kind !== "asi") return false;
    if (selection.mode === "feat") return Boolean(selection.featId);
    if (selection.mode === "plus-two") return Boolean(selection.primary);
    return Boolean(selection.primary && selection.secondary && selection.primary !== selection.secondary);
  }
  return selectionCount(selection) >= choice.count;
}

function sectionForChoice(choice: ChoiceDefinition, selection: ChoiceSelectionValue | undefined): CharacterCreationSection {
  const complete = choiceComplete(choice,selection);
  return {
    id:choice.id,
    kind:"dynamic-choice",
    label:choice.label,
    description:choice.description,
    status:choice.status === "catalog-pending" ? "blocked" : complete ? "complete" : "incomplete",
    required:choice.required,
    dependsOn:[],
    options:[],
    automaticGrants:[],
    validation:[],
  };
}

function optionVm(choice: ChoiceDefinition, option: ChoiceDefinition["options"][number], selected: boolean, id = option.id): CharacterCreationOptionVm {
  const subclass = choice.kind === "subclass" ? projectLevelUpSubclassPresentation(option.label, choice.source) : undefined;
  const summary = subclass?.summary ?? option.description ?? choice.description;
  const detailLines = subclass?.detailLines ?? [
    ...(option.description && option.description !== choice.description ? [option.description] : []),
    ...(option.disabledReason ? [`사용 불가 · ${option.disabledReason}`] : []),
    `선택 출처 · ${choice.source}`,
  ];
  return {
    id,
    name:option.label,
    nameEn:subclass?.nameEn ?? "",
    summary,
    description:summary,
    detailLines,
    source:choice.source,
    selected,
    recommended:false,
    grants:[],
    choices:[],
  };
}

function LevelUpSpellChoice({ choice, selection, onSelect }: { choice:ChoiceDefinition; selection?:ChoiceSelectionValue; onSelect(value:ChoiceSelectionValue):void }) {
  const section = sectionForChoice(choice, selection);
  const selectedIds = selection?.kind === "options" ? selection.optionIds : [];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SpellUiFilter>("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const selectedOptions = choice.options.filter((option) => selectedIds.includes(option.id));
  const visible = useMemo(() => choice.options.filter((option) => {
    const spell = spellPresentationById(option.id);
    if (!spell) return false;
    if (!spellMatchesFilter(spell, filter)) return false;
    return !normalizedQuery || spellSearchText(spell).includes(normalizedQuery);
  }), [choice.options, filter, normalizedQuery]);
  const unresolved = useMemo(() => choice.options.filter((option) => !spellPresentationById(option.id)), [choice.options]);
  const levels = useMemo(() => Array.from(new Set(visible.map((option) => spellPresentationById(option.id)?.level).filter((level): level is number => level !== undefined))).sort((a,b) => a - b), [visible]);
  const toggle = (id:string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((entry) => entry !== id) : [...selectedIds,id];
    onSelect({ kind:"options", optionIds:next });
  };

  return <SectionShell section={section}>
    <div className="spell-choice-panel levelup-spell-choice-panel">
      <div className="spell-choice-topline"><div><span>SELECTED SPELLS</span><strong>{choice.label}</strong><small>{choice.description}</small></div><b>{selectedIds.length} / {choice.count}</b></div>
      <div className="spell-selected-strip">
        {selectedOptions.length ? selectedOptions.map((option) => spellPresentationById(option.id)
          ? <SpellTile key={option.id} spellId={option.id} selected status="선택됨" compact onClick={() => toggle(option.id)}/>
          : <OptionCard key={option.id} option={optionVm(choice,option,true)} onClick={() => toggle(option.id)}/>)
          : <span className="spell-selected-empty">아래 목록에서 주문을 선택하면 여기에 고정됩니다.</span>}
      </div>
      <div className="spell-library-toolbar">
        <div className="spell-filter-chips">{SPELL_FILTERS.map((item) => <button key={item.id} type="button" className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
        <label className="spell-search"><span>주문 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="한국어 / English / 학파 / 속성"/></label>
      </div>
      <div className="spell-level-groups">
        {levels.map((level) => {
          const options = visible.filter((option) => spellPresentationById(option.id)?.level === level);
          return <section className="spell-level-group" key={level}><header><strong>{level === 0 ? "소마법" : `${level}레벨`}</strong><span>{options.length}개</span></header><div className="spell-choice-grid">{options.map((option) => {
            const full = selectedIds.length >= choice.count && !selectedIds.includes(option.id);
            const disabled = Boolean(option.disabledReason) || full;
            return <SpellTile key={option.id} spellId={option.id} selected={selectedIds.includes(option.id)} disabled={disabled} status={option.disabledReason} onClick={disabled ? undefined : () => toggle(option.id)}/>;
          })}</div></section>;
        })}
        {!visible.length && !unresolved.length && <div className="spell-library-empty">조건에 맞는 주문이 없습니다.</div>}
        {unresolved.length > 0 && <section className="spell-level-group"><header><strong>표시 정보 미연결</strong><span>{unresolved.length}개</span></header><div className="create-option-grid dynamic-choice-grid">{unresolved.map((option) => {
          const selected = selectedIds.includes(option.id);
          const full = selectedIds.length >= choice.count && !selected;
          return <OptionCard key={option.id} option={optionVm(choice,option,selected)} onClick={option.disabledReason || full ? undefined : () => toggle(option.id)}/>;
        })}</div></section>}
      </div>
    </div>
  </SectionShell>;
}

function ChoicePanel({ choice, onSelect, selection }: { choice: ChoiceDefinition; selection?: ChoiceSelectionValue; onSelect(value: ChoiceSelectionValue): void }) {
  const section = sectionForChoice(choice, selection);
  if (choice.status === "catalog-pending") return <SectionShell section={section}><div className="create-principle-callout"><strong>아직 선택 데이터를 연결할 수 없습니다.</strong><span>{choice.pendingReason ?? "이 선택의 canonical catalog relationship이 필요합니다."}</span><small>Phase 08 필요 · {choice.source}</small></div></SectionShell>;

  if (choice.kind === "spell") return <LevelUpSpellChoice choice={choice} selection={selection} onSelect={onSelect}/>;

  if (choice.kind === "asi-or-feat") {
    const asi = selection?.kind === "asi" ? selection : undefined;
    const set = (patch: Partial<Extract<ChoiceSelectionValue, { kind:"asi" }>>) => onSelect({ kind:"asi", mode:asi?.mode ?? "plus-two", primary:asi?.primary, secondary:asi?.secondary, featId:asi?.featId, ...patch });
    const featOptions = choice.options.filter((option) => option.id.startsWith("feat:"));
    return <SectionShell section={section}>
      <div className="choice-prompt"><strong>능력치 향상 또는 재주</strong><span>{choiceComplete(choice,selection) ? "완료" : "선택 필요"}</span></div>
      <div className="levelup-segmented">
        <button type="button" className={asi?.mode === "plus-two" ? "active" : ""} onClick={() => set({ mode:"plus-two", secondary:undefined, featId:undefined })}>능력치 +2</button>
        <button type="button" className={asi?.mode === "split" ? "active" : ""} onClick={() => set({ mode:"split", featId:undefined })}>능력치 +1 / +1</button>
        <button type="button" className={asi?.mode === "feat" ? "active" : ""} onClick={() => set({ mode:"feat", primary:undefined, secondary:undefined })}>재주 선택</button>
      </div>
      {asi?.mode !== "feat" && <div className="levelup-ability-pickers">
        <label><span>{asi?.mode === "split" ? "첫 능력치" : "능력치"}</span><select value={asi?.primary ?? ""} onChange={(event) => set({ primary:(event.target.value || undefined) as typeof LEVEL_UP_ABILITIES[number][0] | undefined })}><option value="">선택</option>{LEVEL_UP_ABILITIES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        {asi?.mode === "split" && <label><span>둘째 능력치</span><select value={asi.secondary ?? ""} onChange={(event) => set({ secondary:(event.target.value || undefined) as typeof LEVEL_UP_ABILITIES[number][0] | undefined })}><option value="">선택</option>{LEVEL_UP_ABILITIES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
      </div>}
      {asi?.mode === "feat" && <div className="create-option-grid dynamic-choice-grid levelup-feat-grid">{featOptions.length ? featOptions.map((option) => {
        const featId = option.id.slice("feat:".length);
        return <OptionCard key={option.id} option={optionVm(choice,option,asi.featId === featId,featId)} onClick={() => set({ featId })}/>;
      }) : <div className="create-principle-callout"><strong>선택 가능한 재주가 없습니다.</strong><span>현재 catalog에서 이 레벨에 사용할 재주를 찾지 못했습니다.</span></div>}</div>}
    </SectionShell>;
  }

  const selected = selection?.kind === "options" ? selection.optionIds : [];
  return <SectionShell section={section}>
    <div className="choice-prompt"><strong>{choice.count}개 선택</strong><span>{selected.length}/{choice.count} 선택됨</span></div>
    <div className={`create-option-grid dynamic-choice-grid ${choice.kind === "subclass" ? "levelup-subclass-grid" : ""}`}>{choice.options.map((option) => {
      const isSelected = selected.includes(option.id);
      const full = selected.length >= choice.count && !isSelected;
      const disabled = Boolean(option.disabledReason) || full;
      return <OptionCard key={option.id} option={optionVm(choice,option,isSelected)} onClick={disabled ? undefined : () => {
        const next = isSelected ? selected.filter((id) => id !== option.id) : [...selected, option.id];
        onSelect({ kind:"options", optionIds:next });
      }}/>;
    })}</div>
  </SectionShell>;
}

function LevelUpPreview({ character, plan, draft }: { character:NonNullable<ReturnType<typeof useSimpleVtt>["snapshot"]>["activeCharacter"]; plan:NonNullable<NonNullable<ReturnType<typeof useSimpleVtt>["snapshot"]>["progressionPlan"]>; draft:NonNullable<NonNullable<ReturnType<typeof useSimpleVtt>["snapshot"]>["levelUpDraft"]> }) {
  const classLine = plan.classTracksAfter.map((track) => `${track.className} ${track.level}`).join(" / ");
  return <aside className="focused-character-preview levelup-v10-preview">
    <div className="focused-character-portrait"><span>{character.name.trim().slice(0,1) || "?"}</span></div>
    <div className="focused-character-identity"><h2>{character.name}</h2><p>{classLine}</p><span>총 레벨 {plan.fromTotalLevel} → {plan.toTotalLevel}</span></div>
    <div className="focused-character-vitals"><div><span>AC</span><strong>{character.ac}</strong></div><div><span>MAX HP</span><strong>{draft.preview.maxHpAfter}</strong></div><div><span>PROF</span><strong>+{plan.proficiencyAfter}</strong></div></div>
    <div className="focused-character-abilities">{LEVEL_UP_ABILITIES.map(([id,label]) => <div key={id}><span>{label}</span><strong>{draft.preview.abilityAfter[id]}</strong></div>)}</div>
    <div className="levelup-preview-heading"><span className="eyebrow accent">Before → After</span><h3>변경 요약</h3></div>
    <div className="levelup-diffs">{plan.diffs.map((diff,index) => <div key={`${diff.label}-${index}`}><span>{diff.label}<small>{diff.source}</small></span><b>{diff.before}</b><i>→</i><strong>{diff.after}</strong></div>)}</div>
    <div className="levelup-preview-heading"><span className="eyebrow">VALIDATION</span><h3>검증</h3></div>
    {plan.blocking.length === 0 && <div className="validation info">Blocking 없음</div>}
    {plan.blocking.map((message) => <div className="validation blocking" key={message}>{message}</div>)}
    {plan.warnings.map((message) => <div className="validation warning" key={message}>{message}</div>)}
  </aside>;
}

export function LevelUpV10Bridge() {
  const host = useLevelUpHost();
  const { snapshot, refresh } = useSimpleVtt();
  const adapter = mockAdapter as unknown as Phase07AdapterCommands;
  const plan = snapshot?.progressionPlan;
  const draft = snapshot?.levelUpDraft;
  const character = snapshot?.activeCharacter;
  const [busy, setBusy] = useState(false);
  const [activeStage,setActiveStage] = useState<LevelUpStageId>("class");
  const [hpRollReplay,setHpRollReplay] = useState(0);
  const classOptions = useMemo(() => character ? projectLevelUpClassOptions(character) : [], [character]);

  if (!host || !snapshot || !plan || !draft || !character) return null;

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try { await operation(); await refresh(); } finally { setBusy(false); }
  };
  const chooseClass = (classId: string) => run(() => adapter.setProgressionTargetClass(classId));
  const choose = (choiceId: string, value: ChoiceSelectionValue) => run(() => adapter.setProgressionChoice(choiceId, value));
  const setHp = (method: "fixed" | "roll", roll?: number) => run(() => adapter.setProgressionHp(method, roll));
  const rollHp = () => {
    const face = rollLevelUpHitDie(plan.hp.hitDie);
    setHpRollReplay((value) => value + 1);
    void setHp("roll",face);
  };
  const legacyCancel = () => host.querySelector<HTMLButtonElement>(".builder-screen .builder-top > button:last-child")?.click();
  const legacyCommit = () => host.querySelector<HTMLButtonElement>(".builder-screen .builder-footer button.primary")?.click();
  const fixedGain = projectLevelUpFixedHpGain(plan);
  const hpComplete = draft.hpMethod === "fixed" || (Number.isInteger(draft.hpRoll) && Number(draft.hpRoll) >= 1 && Number(draft.hpRoll) <= plan.hp.hitDie);
  const choicesComplete = plan.choices.every((choice) => choiceComplete(choice,currentSelection(snapshot,choice.id)));
  const choicesBlocked = plan.choices.some((choice) => choice.status === "catalog-pending");
  const ready = hpComplete && choicesComplete && plan.blocking.length === 0;
  const hitDieSides = plan.hp.hitDie as 4|6|8|10|12|20;

  const classSection:CharacterCreationSection = {
    id:"levelup-class",
    kind:"class",
    label:"레벨업할 클래스",
    description:"기존 클래스의 다음 레벨을 올리거나, 조건을 충족하면 새 클래스를 1레벨로 추가합니다. 카드에 마우스를 올리면 클래스 정보를 확인할 수 있습니다.",
    status:"complete",
    required:true,
    dependsOn:[],
    options:[],
    automaticGrants:[],
    validation:[],
  };
  const automaticSection:CharacterCreationSection = {
    id:"levelup-automatic",
    kind:"review",
    label:"자동 획득",
    description:`${plan.targetClassName} ${plan.targetClassLevel}레벨에서 선택 없이 적용되는 변화입니다.`,
    status:"complete",
    required:false,
    dependsOn:[],
    options:[],
    automaticGrants:plan.automaticGrants,
    validation:[],
  };
  const hpSection:CharacterCreationSection = {
    id:"levelup-hp",
    kind:"dynamic-choice",
    label:"히트 포인트 증가",
    description:`d${plan.hp.hitDie} + 건강 수정치 ${plan.hp.constitutionModifier >= 0 ? "+" : ""}${plan.hp.constitutionModifier}. 고정값 또는 실제 히트 다이스 굴림을 선택합니다.`,
    status:hpComplete ? "complete" : "incomplete",
    required:true,
    dependsOn:[],
    options:[],
    automaticGrants:[],
    validation:[],
  };
  const reviewSection:CharacterCreationSection = {
    id:"levelup-review",
    kind:"review",
    label:"변경 검토",
    description:"적용 전에 이번 레벨업으로 바뀌는 Character source와 파생 결과를 확인합니다.",
    status:ready ? "complete" : "incomplete",
    required:true,
    dependsOn:[],
    options:[],
    automaticGrants:[],
    validation:[
      ...plan.blocking.map((message) => ({ severity:"blocking" as const, message })),
      ...plan.warnings.map((message) => ({ severity:"warning" as const, message })),
    ],
  };

  const stageStatus = (id:LevelUpStageId):CharacterCreationSectionStatus => {
    if (id === "class" || id === "automatic") return "complete";
    if (id === "hp") return hpComplete ? "complete" : "incomplete";
    if (id === "choices") return choicesBlocked ? "blocked" : choicesComplete ? "complete" : "incomplete";
    return ready ? "complete" : "incomplete";
  };
  const currentIndex = LEVEL_UP_STAGES.findIndex((item) => item.id === activeStage);
  const previous = LEVEL_UP_STAGES[Math.max(0,currentIndex - 1)];
  const next = LEVEL_UP_STAGES[Math.min(LEVEL_UP_STAGES.length - 1,currentIndex + 1)];
  const activeLabel = LEVEL_UP_STAGES[currentIndex]?.label ?? "레벨 업";

  const classStage = <SectionShell section={classSection}>
    <div className="choice-prompt"><strong>현재 클래스 / 멀티클래스</strong><span>선택 · {plan.targetClassName} {plan.targetClassLevel}레벨</span></div>
    <div className="create-option-grid levelup-class-option-grid">{classOptions.map(({ entry,existing,eligible,reason,currentLevel }) => {
      const selected = plan.targetClassId === entry.id;
      const summary = existing ? `현재 ${currentLevel}레벨 → ${currentLevel + 1}레벨` : eligible ? "+ 클래스 추가 · 1레벨" : `선행 조건 미충족 · ${reason || "멀티클래스 요구 조건"}`;
      const option:CharacterCreationOptionVm = {
        id:entry.id,
        name:entry.nameKo,
        nameEn:entry.nameEn,
        summary,
        description:`주요 능력치 · ${entry.primaryAbilitiesText}. 내성 굴림 · ${entry.savingThrowsText}. 히트 다이스 · d${entry.hitDie}.`,
        detailLines:[existing ? `현재 ${currentLevel}레벨에서 계속 진행` : "새 멀티클래스 트랙 1레벨", ...(entry.multiclassGrants.length ? [`멀티클래스 획득 · ${entry.multiclassGrants.join(", ")}`] : []), ...(!eligible && reason ? [`사용 불가 · ${reason}`] : [])],
        source:"SRD 5.2.1 클래스 진행",
        selected,
        recommended:existing,
        grants:[],
        choices:[],
      };
      return <OptionCard key={entry.id} option={option} onClick={busy || !eligible ? undefined : () => { void chooseClass(entry.id); }}/>;
    })}</div>
  </SectionShell>;

  const automaticStage = <SectionShell section={automaticSection}>
    <div className="levelup-auto-grid">
      <article><small>히트 다이스</small><b>+1d{plan.hp.hitDie}</b></article>
      <article><small>숙련 보너스</small><b>+{plan.proficiencyBefore} → +{plan.proficiencyAfter}</b></article>
      <article><small>최대 HP</small><b>+{plan.hp.totalGain}</b></article>
      <article><small>주문 시전자 레벨</small><b>{plan.spellcastingBefore.casterLevel} → {plan.spellcastingAfter.casterLevel}</b></article>
    </div>
    {plan.isMulticlass && plan.multiclassGrants.length > 0 && <div className="create-principle-callout levelup-multiclass-grants"><strong>멀티클래스로 얻는 숙련 / 특성</strong><span>{plan.multiclassGrants.join(" · ")}</span></div>}
  </SectionShell>;

  const hpStage = <SectionShell section={hpSection}>
    <div className="levelup-segmented"><button type="button" className={draft.hpMethod === "fixed" ? "active" : ""} onClick={() => { void setHp("fixed"); }} disabled={busy}>고정값 · {fixedGain} HP</button><button type="button" className={draft.hpMethod === "roll" ? "active" : ""} onClick={() => { void setHp("roll",draft.hpRoll); }} disabled={busy}>d{plan.hp.hitDie} 굴림</button></div>
    {draft.hpMethod === "roll" && <div className="levelup-hit-die-panel">
      {draft.hpRoll ? <VisualDiceTray key={`levelup-hp:${hpRollReplay}:${draft.hpRoll}`} label={`히트 다이스 d${plan.hp.hitDie}`} dice={[{ value:draft.hpRoll, sides:hitDieSides }]} caption={`굴림 결과 ${draft.hpRoll} · 건강 수정치 ${plan.hp.constitutionModifier >= 0 ? "+" : ""}${plan.hp.constitutionModifier}`} compact/> : <div className="create-principle-callout"><strong>히트 다이스를 굴리세요.</strong><span>굴림 결과가 나온 뒤 최대 HP Preview가 확정됩니다.</span></div>}
      <button type="button" className="primary levelup-roll-button" disabled={busy} onClick={rollHp}>{draft.hpRoll ? `d${plan.hp.hitDie} 다시 굴리기` : `d${plan.hp.hitDie} 굴리기`}</button>
    </div>}
    {plan.hp.retroactiveConstitutionGain !== 0 && <div className="create-principle-callout levelup-con-retro"><strong>건강 수정치 소급</strong><span>기존 레벨에도 적용되는 최대 HP 변화 · {plan.hp.retroactiveConstitutionGain > 0 ? "+" : ""}{plan.hp.retroactiveConstitutionGain}</span></div>}
  </SectionShell>;

  const choicesStage = <div className="levelup-choice-stage">
    {plan.choices.length === 0 ? <SectionShell section={{ id:"levelup-choices", kind:"review", label:"추가 선택 없음", description:"이 레벨은 자동 획득 항목만 확인하고 검토로 이동할 수 있습니다.", status:"complete", required:false, dependsOn:[], options:[], automaticGrants:[], validation:[] }}><div className="create-principle-callout"><strong>선택 완료</strong><span>이번 레벨에는 추가로 결정할 항목이 없습니다.</span></div></SectionShell> : plan.choices.map((choice) => <ChoicePanel key={choice.id} choice={choice} selection={currentSelection(snapshot,choice.id)} onSelect={(value) => { void choose(choice.id,value); }}/>) }
  </div>;

  const reviewStage = <SectionShell section={reviewSection}>
    <div className="create-review-grid levelup-review-grid">
      <section className="create-review-group"><h3>진행</h3><div className="create-review-row"><span>총 레벨</span><strong>{plan.fromTotalLevel} → {plan.toTotalLevel}</strong></div><div className="create-review-row"><span>클래스</span><strong>{plan.targetClassName} {plan.targetClassLevel}레벨</strong></div><div className="create-review-row"><span>HP 방식</span><strong>{draft.hpMethod === "fixed" ? `고정값 ${fixedGain}` : `d${plan.hp.hitDie} · ${draft.hpRoll ?? "미굴림"}`}</strong></div></section>
      <section className="create-review-group"><h3>변경 사항</h3>{plan.diffs.map((diff,index) => <div className="create-review-row" key={`${diff.label}-${index}`}><span>{diff.label}</span><strong>{diff.before} → {diff.after}</strong></div>)}</section>
      <section className="create-review-group"><h3>선택 상태</h3>{plan.choices.length ? plan.choices.map((choice) => <div className="create-review-row" key={choice.id}><span>{choice.label}</span><strong>{choiceComplete(choice,currentSelection(snapshot,choice.id)) ? "완료" : "확인 필요"}</strong></div>) : <span className="review-line">추가 선택 없음</span>}</section>
    </div>
  </SectionShell>;

  const stageContent = activeStage === "class" ? classStage : activeStage === "automatic" ? automaticStage : activeStage === "hp" ? hpStage : activeStage === "choices" ? choicesStage : reviewStage;
  const footerDescription = activeStage === "class" ? classSection.description : activeStage === "automatic" ? automaticSection.description : activeStage === "hp" ? hpSection.description : activeStage === "choices" ? (plan.choices.length ? `${plan.choices.length}개 선택을 생성 화면과 같은 카드/주문 라이브러리에서 처리합니다.` : "추가 선택이 없습니다.") : reviewSection.description;

  return createPortal(<div className="levelup-v10 focused-create-shell">
    <header className="focused-create-header levelup-create-header">
      <div className="focused-create-title"><span>LEVEL UP</span><strong>{character.name}</strong></div>
      <nav className="focused-create-tabs levelup-create-tabs" aria-label="레벨업 단계">
        {LEVEL_UP_STAGES.map((item) => { const status = stageStatus(item.id); return <button type="button" key={item.id} className={`${activeStage === item.id ? "active " : ""}status-${status}`} onClick={() => setActiveStage(item.id)}><i>{status === "complete" ? "✓" : status === "warning" ? "!" : "•"}</i><span>{item.label}</span></button>; })}
      </nav>
      <div className="focused-create-header-actions levelup-create-header-actions"><span>{plan.targetClassName} {plan.targetClassLevel} Lv</span><button type="button" onClick={legacyCancel}>닫기</button></div>
    </header>

    <div className="focused-create-body levelup-create-body">
      <main className="focused-create-stage levelup-v10-main"><div className="focused-primary-flow levelup-flow">{stageContent}</div></main>
      <LevelUpPreview character={character} plan={plan} draft={draft}/>
    </div>

    <footer className="focused-create-footer levelup-v10-footer">
      <button type="button" disabled={currentIndex === 0} onClick={() => setActiveStage(previous.id)}>이전</button>
      <div><span>{activeLabel}</span><small>{footerDescription}</small></div>
      {activeStage === "review" ? <button type="button" className="primary" disabled={busy || !ready} onClick={legacyCommit}>레벨 업</button> : <button type="button" className="primary" onClick={() => setActiveStage(next.id)}>다음</button>}
    </footer>
  </div>, host);
}
