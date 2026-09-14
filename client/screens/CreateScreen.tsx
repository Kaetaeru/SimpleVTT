/**
 * Creation wizard (also level-up and edit): steps on the left, the current step in the middle, the live sheet and
 * validation on the right. Every answer goes through the source; the engine decides what to ask next.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useClient } from "../app/context";
import { ABILITY_KEYS, ABILITY_KO, type AbilityKey } from "../catalog/types";
import { autofill } from "../character/autofill";
import { deriveCharacter } from "../character/derive";
import { addLevel, emptySource, pointBuyTotal, removeLastLevel, setAbility, setAbilityMethod, setChoice, setOrigin, setTrackHp, toggleChoiceValue } from "../character/source";
import type { CharacterSource, ChoiceRequest } from "../character/types";
import { fixedHitPoints, POINT_BUY_BUDGET, pointBuyCost, STANDARD_ARRAY } from "../rules/tables";
import { Notice, Pill, Section, signed } from "../ui/components";
import { ChoicePicker } from "./ChoicePicker";
import { SheetView, ValidationList } from "./SheetView";

type StepId = "basics" | "species" | "background" | "abilities" | "classes" | "equipment" | "review";
const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "basics", label: "기본" }, { id: "species", label: "종족" }, { id: "background", label: "배경" }, { id: "abilities", label: "능력치" },
  { id: "classes", label: "직업·레벨" }, { id: "equipment", label: "언어·장비" }, { id: "review", label: "검토·저장" },
];
const ALIGNMENTS = ["질서 선", "중립 선", "혼돈 선", "질서 중립", "중립", "혼돈 중립", "질서 악", "중립 악", "혼돈 악"];

export function CreateScreen({ existing, initialStep }: { existing?: CharacterSource; initialStep?: StepId }) {
  const { catalog, navigate, saveCharacter, getDraft, putDraft, characters, store } = useClient();
  const [source, setSource] = useState<CharacterSource>(() => existing ?? emptySource());
  const [step, setStep] = useState<StepId>(initialStep ?? "basics");
  const [draftLoaded, setDraftLoaded] = useState(Boolean(existing));
  const [saving, setSaving] = useState(false);
  const derived = useMemo(() => deriveCharacter(source, catalog), [source, catalog]);
  const draftTimer = useRef<number | undefined>(undefined);

  // A new character restores the last unsaved draft once (the store may open after mount); edits never touch the draft.
  const savedIds = useRef(characters.map((record) => record.id));
  savedIds.current = characters.map((record) => record.id);
  const restored = useRef(false);
  useEffect(() => {
    if (existing || restored.current || !store) return;
    restored.current = true;
    let cancelled = false;
    getDraft().then((draft) => {
      if (cancelled) return;
      if (draft && draft.schema === 2 && !savedIds.current.includes(draft.id)) setSource((current) => (current.name || current.tracks.length || current.origin.speciesId ? current : draft));
      setDraftLoaded(true);
    });
    return () => { cancelled = true; };
  }, [existing, getDraft, store]);
  useEffect(() => {
    if (existing || !draftLoaded || typeof window === "undefined") return;
    window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => { void putDraft(source); }, 400);
    return () => window.clearTimeout(draftTimer.current);
  }, [source, existing, draftLoaded, putDraft]);

  const update = (next: CharacterSource) => setSource(next);
  const toggle = (choice: ChoiceRequest, value: string) => update(toggleChoiceValue(source, choice.id, value, choice.count));
  const clear = (choice: ChoiceRequest) => update(setChoice(source, choice.id, []));
  const choicesWhere = (predicate: (choice: ChoiceRequest) => boolean) => derived.choices.filter(predicate);
  const fillRemaining = () => update(autofill(source, catalog).source);

  const stepState = (id: StepId): "done" | "todo" | "" => {
    const open = (choices: ChoiceRequest[]) => choices.some((choice) => !choice.satisfied);
    switch (id) {
      case "basics": return source.name.trim() ? "done" : "todo";
      case "species": return !source.origin.speciesId || open(speciesChoices()) ? "todo" : "done";
      case "background": return !source.origin.backgroundId || open(backgroundChoices()) ? "todo" : "done";
      case "abilities": return derived.validation.blocking.some((line) => line.includes("능력치") || line.includes("포인트") || line.includes("표준 배열")) ? "todo" : "done";
      case "classes": return source.tracks.length === 0 || open(classChoices()) || derived.validation.blocking.some((line) => line.includes("멀티클래스") || line.includes("조건")) ? "todo" : "done";
      case "equipment": return open(equipmentChoices()) ? "todo" : "done";
      case "review": return derived.validation.blocking.length ? "todo" : "done";
    }
  };
  const speciesChoices = () => choicesWhere((choice) => choice.id.startsWith("origin.species") || choice.id.startsWith("feat.species"));
  const backgroundChoices = () => choicesWhere((choice) => choice.id.startsWith("origin.background") || choice.id.startsWith("feat.background"));
  const classChoices = () => choicesWhere((choice) => choice.id.startsWith("class.") || choice.id.startsWith("feat.class.") || choice.id.startsWith("feat.invocation"));
  const equipmentChoices = () => choicesWhere((choice) => choice.id.startsWith("equipment.") || choice.id === "origin.languages");

  const save = async () => {
    if (derived.validation.blocking.length) return;
    setSaving(true);
    try {
      const record = await saveCharacter({ ...source, updatedAt: new Date().toISOString() });
      if (!existing) await putDraft(undefined);
      navigate({ screen: "sheet", id: record.id });
    } finally { setSaving(false); }
  };

  const stepIndex = STEPS.findIndex((item) => item.id === step);
  return (
    <div className="cl-page">
      <div className="cl-page-head">
        <h1>{existing ? "캐릭터 편집" : "새 캐릭터"}</h1>
        <span className="cl-sub">{derived.name || "이름 없음"} · {derived.level}레벨</span>
        <div className="cl-actions">
          <button type="button" className="cl-btn" onClick={fillRemaining} title="남은 선택을 첫 항목으로 채웁니다 (나중에 바꿀 수 있음)">남은 선택 빠르게 채우기</button>
          <button type="button" className="cl-btn quiet" onClick={() => navigate(existing ? { screen: "sheet", id: existing.id } : { screen: "library" })}>닫기</button>
          <button type="button" className="cl-btn primary" disabled={derived.validation.blocking.length > 0 || saving} onClick={save} title={derived.validation.blocking[0]}>저장</button>
        </div>
      </div>
      <div className="cl-wizard">
        <nav className="cl-steps" aria-label="단계">
          {STEPS.map((item, index) => {
            const state = stepState(item.id);
            return (
              <button type="button" key={item.id} className={item.id === step ? "active" : ""} onClick={() => setStep(item.id)}>
                <span className="cl-quiet">{index + 1}</span> {item.label}
                <span className={`cl-step-state ${state}`}>{state === "done" ? "✓" : state === "todo" ? "!" : ""}</span>
              </button>
            );
          })}
        </nav>
        <div className="cl-wizard-body">
          {step === "basics" ? <BasicsStep source={source} update={update} /> : null}
          {step === "species" ? <OriginStep kind="species" source={source} update={update} choices={speciesChoices()} onToggle={toggle} onClear={clear} /> : null}
          {step === "background" ? <OriginStep kind="background" source={source} update={update} choices={backgroundChoices()} onToggle={toggle} onClear={clear} /> : null}
          {step === "abilities" ? <AbilitiesStep source={source} update={update} derived={derived} /> : null}
          {step === "classes" ? <ClassesStep source={source} update={update} derived={derived} choices={classChoices()} onToggle={toggle} onClear={clear} /> : null}
          {step === "equipment" ? <EquipmentStep source={source} update={update} choices={equipmentChoices()} onToggle={toggle} onClear={clear} /> : null}
          {step === "review" ? (
            <Section title="검토">
              <ValidationList derived={derived} />
              <SheetView derived={derived} catalog={catalog} />
            </Section>
          ) : null}
          <div className="cl-row" style={{ justifyContent: "space-between" }}>
            <button type="button" className="cl-btn" disabled={stepIndex === 0} onClick={() => setStep(STEPS[stepIndex - 1].id)}>← 이전</button>
            {stepIndex < STEPS.length - 1 ? <button type="button" className="cl-btn primary" onClick={() => setStep(STEPS[stepIndex + 1].id)}>다음 →</button> : <button type="button" className="cl-btn primary" disabled={derived.validation.blocking.length > 0 || saving} onClick={save}>저장하고 시트 열기</button>}
          </div>
        </div>
        <aside className="cl-preview">
          <div className="cl-card">
            <h3 className="cl-muted" style={{ marginBottom: 8 }}>검증</h3>
            <ValidationList derived={derived} />
          </div>
          <div className="cl-card"><SheetView derived={derived} catalog={catalog} compact /></div>
        </aside>
      </div>
    </div>
  );
}

function BasicsStep({ source, update }: { source: CharacterSource; update: (next: CharacterSource) => void }) {
  return (
    <Section title="기본 정보">
      <div className="cl-grid-2">
        <div className="cl-field"><label htmlFor="cl-name">이름</label><input id="cl-name" className="cl-input" value={source.name} onChange={(event) => update({ ...source, name: event.target.value })} placeholder="캐릭터 이름" /></div>
        <div className="cl-field"><label htmlFor="cl-alignment">성향</label>
          <select id="cl-alignment" className="cl-select" value={source.alignment ?? ""} onChange={(event) => update({ ...source, alignment: event.target.value || undefined })}>
            <option value="">선택 안 함</option>
            {ALIGNMENTS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>
      <div className="cl-grid-3">
        {(["appearance", "personality", "backstory"] as const).map((key) => (
          <div className="cl-field" key={key}>
            <label htmlFor={`cl-note-${key}`}>{key === "appearance" ? "외모" : key === "personality" ? "성격" : "배경 이야기"}</label>
            <textarea id={`cl-note-${key}`} className="cl-textarea" value={source.notes?.[key] ?? ""} onChange={(event) => update({ ...source, notes: { ...source.notes, [key]: event.target.value } })} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function OriginStep({ kind, source, update, choices, onToggle, onClear }: { kind: "species" | "background"; source: CharacterSource; update: (next: CharacterSource) => void; choices: ChoiceRequest[]; onToggle: (choice: ChoiceRequest, value: string) => void; onClear: (choice: ChoiceRequest) => void }) {
  const { catalog } = useClient();
  const selectedId = kind === "species" ? source.origin.speciesId : source.origin.backgroundId;
  const options = kind === "species"
    ? catalog.species.map((species) => ({ id: species.id, name: species.name, nameEn: species.nameEn, summary: species.summary ?? species.traits.map((trait) => trait.name).join(" · "), scope: species.scope, detail: species.description }))
    : catalog.backgrounds.map((background) => ({ id: background.id, name: background.name, nameEn: background.nameEn, summary: `${background.abilityChoices.map((key) => ABILITY_KO[key]).join("·")} · ${background.skills.map((skill) => catalog.skills[skill] ?? skill).join(", ")} · ${catalog.featById(background.originFeat)?.name ?? ""}`, scope: background.scope, detail: background.description }));
  const selected = options.find((option) => option.id === selectedId);
  return (
    <>
      <Section title={kind === "species" ? "종족" : "배경"} hint={kind === "species" ? "종족은 크기·속도·감각과 특성을 정합니다. 혈통·유산·조상 같은 선택은 아래에 나타납니다." : "배경은 능력치 +2/+1(또는 +1/+1/+1), 기술 2개, 도구, 기원 재주, 시작 장비를 줍니다."}>
        <div className="cl-option-grid">
          {options.map((option) => (
            <button type="button" key={option.id} className={`cl-option-card${option.id === selectedId ? " selected" : ""}`} onClick={() => update(setOrigin(source, kind === "species" ? { speciesId: option.id } : { backgroundId: option.id }))}>
              <span className="cl-title">{option.name} {option.scope === "installed" ? <Pill tone="accent">설치</Pill> : null}</span>
              <span className="cl-en">{option.nameEn}</span>
              <span className="cl-summary">{option.summary}</span>
            </button>
          ))}
        </div>
        {selected?.detail ? <Notice>{selected.detail}</Notice> : null}
      </Section>
      {selectedId ? (
        <Section title="선택" badge={<Pill>{choices.filter((choice) => choice.satisfied).length}/{choices.length}</Pill>}>
          {choices.length === 0 ? <p className="cl-quiet">추가 선택이 없습니다.</p> : choices.map((choice) => <ChoicePicker key={choice.id} choice={choice} onToggle={(value) => onToggle(choice, value)} onClear={() => onClear(choice)} />)}
        </Section>
      ) : null}
    </>
  );
}

function AbilitiesStep({ source, update, derived }: { source: CharacterSource; update: (next: CharacterSource) => void; derived: ReturnType<typeof deriveCharacter> }) {
  const method = source.abilities.method;
  const base = source.abilities.base;
  const total = pointBuyTotal(base);
  const set = (key: AbilityKey, value: number) => update(setAbility(source, key, value));
  return (
    <Section title="능력치" hint="배경의 +2/+1과 재주의 증가는 자동으로 더해집니다. 아래 값은 기본 점수입니다.">
      <div className="cl-row">
        {(["point-buy", "standard-array", "manual"] as const).map((item) => (
          <button type="button" key={item} className={`cl-btn${method === item ? " primary" : ""}`} onClick={() => update(setAbilityMethod(source, item))}>{item === "point-buy" ? "포인트 구매" : item === "standard-array" ? "표준 배열" : "직접 입력"}</button>
        ))}
        {method === "point-buy" ? <Pill tone={total > POINT_BUY_BUDGET ? "bad" : total === POINT_BUY_BUDGET ? "good" : undefined}>{Number.isFinite(total) ? total : "?"} / {POINT_BUY_BUDGET}점</Pill> : null}
      </div>
      <div className="cl-ability-grid">
        {ABILITY_KEYS.map((key) => {
          const ability = derived.abilities[key];
          return (
            <div className="cl-ability" key={key}>
              <div className="cl-key">{ABILITY_KO[key]}</div>
              {method === "point-buy" ? (
                <div className="cl-ctl">
                  <button type="button" className="cl-btn small" disabled={base[key] <= 8} onClick={() => set(key, base[key] - 1)}>−</button>
                  <span className="cl-score">{base[key]}</span>
                  <button type="button" className="cl-btn small" disabled={base[key] >= 15 || (pointBuyCost(base[key] + 1) ?? 99) - (pointBuyCost(base[key]) ?? 0) + total > POINT_BUY_BUDGET} onClick={() => set(key, base[key] + 1)}>+</button>
                </div>
              ) : method === "standard-array" ? (
                <select className="cl-select" value={base[key]} onChange={(event) => set(key, Number(event.target.value))}>
                  {STANDARD_ARRAY.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              ) : (
                <input className="cl-input" type="number" min={1} max={20} value={base[key]} onChange={(event) => set(key, Number(event.target.value))} style={{ width: 64, textAlign: "center" }} />
              )}
              <div className="cl-mod">최종 {ability.score} ({signed(ability.modifier)})</div>
              {ability.bonuses.length ? <div className="cl-bonus">{ability.bonuses.map((bonus) => `${signed(bonus.value)} ${bonus.source}`).join(", ")}</div> : null}
            </div>
          );
        })}
      </div>
      {method === "standard-array" ? <p className="cl-quiet cl-small">15, 14, 13, 12, 10, 8을 각 능력치에 한 번씩 배정합니다.</p> : null}
    </Section>
  );
}

function ClassesStep({ source, update, derived, choices, onToggle, onClear }: { source: CharacterSource; update: (next: CharacterSource) => void; derived: ReturnType<typeof deriveCharacter>; choices: ChoiceRequest[]; onToggle: (choice: ChoiceRequest, value: string) => void; onClear: (choice: ChoiceRequest) => void }) {
  const { catalog } = useClient();
  const [nextClass, setNextClass] = useState(source.tracks[source.tracks.length - 1]?.classId ?? catalog.classes[0]?.id ?? "");
  const grouped = new Map<string, ChoiceRequest[]>();
  for (const choice of choices) { const key = choice.trackIndex !== undefined ? String(choice.trackIndex) : "x"; grouped.set(key, [...(grouped.get(key) ?? []), choice]); }
  const classLevelAt = (index: number) => source.tracks.slice(0, index + 1).filter((track) => track.classId === source.tracks[index].classId).length;
  return (
    <>
      <Section title="직업과 레벨" hint="레벨을 얻은 순서대로 기록합니다. 다른 직업을 추가하면 멀티클래스입니다(능력치 13 조건).">
        <div className="cl-list">
          {source.tracks.map((track, index) => {
            const cls = catalog.classById(track.classId);
            const die = cls?.hitDie ?? 8;
            return (
              <div className="cl-track" key={index}>
                <span className="cl-lvl">{index + 1}레벨</span>
                <span>{cls?.name ?? track.classId} {classLevelAt(index)}</span>
                {index === 0 ? <span className="cl-quiet cl-small">HP d{die} 최대값</span> : (
                  <span className="cl-row" style={{ gap: 6 }}>
                    <button type="button" className={`cl-btn small${track.hp.kind === "fixed" ? " primary" : ""}`} onClick={() => update(setTrackHp(source, index, { kind: "fixed" }))}>고정 {fixedHitPoints(die)}</button>
                    <button type="button" className={`cl-btn small${track.hp.kind === "roll" ? " primary" : ""}`} onClick={() => update(setTrackHp(source, index, { kind: "roll", value: track.hp.kind === "roll" ? track.hp.value : Math.ceil(die / 2) }))}>굴림</button>
                    {track.hp.kind === "roll" ? <input className="cl-input" type="number" min={1} max={die} value={track.hp.value} style={{ width: 60 }} onChange={(event) => update(setTrackHp(source, index, { kind: "roll", value: Number(event.target.value) }))} /> : null}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="cl-row">
          <select className="cl-select" value={nextClass} onChange={(event) => setNextClass(event.target.value)} aria-label="추가할 직업">
            {catalog.classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name} (d{cls.hitDie}, {cls.primaryAbilities.map((key) => ABILITY_KO[key]).join("/")})</option>)}
          </select>
          <button type="button" className="cl-btn primary" disabled={source.tracks.length >= 20 || !nextClass} onClick={() => update(addLevel(source, nextClass))}>레벨 추가</button>
          <button type="button" className="cl-btn" disabled={source.tracks.length === 0} onClick={() => update(removeLastLevel(source))}>마지막 레벨 제거</button>
          <Pill>총 {source.tracks.length}레벨</Pill>
        </div>
        {derived.validation.blocking.filter((line) => line.includes("조건")).map((line) => <Notice tone="bad" key={line}>{line}</Notice>)}
      </Section>
      {[...grouped.entries()].sort((a, b) => (a[0] === "x" ? 1 : b[0] === "x" ? -1 : Number(a[0]) - Number(b[0]))).map(([key, list]) => {
        const index = key === "x" ? undefined : Number(key);
        const track = index !== undefined ? source.tracks[index] : undefined;
        const cls = track ? catalog.classById(track.classId) : undefined;
        const title = index === undefined ? "기타 선택" : `${index + 1}레벨 — ${cls?.name ?? ""} ${classLevelAt(index)}`;
        return (
          <Section key={key} title={title} badge={<Pill tone={list.every((choice) => choice.satisfied) ? "good" : undefined}>{list.filter((choice) => choice.satisfied).length}/{list.length}</Pill>}>
            {list.map((choice) => <ChoicePicker key={choice.id} choice={choice} onToggle={(value) => onToggle(choice, value)} onClear={() => onClear(choice)} />)}
          </Section>
        );
      })}
    </>
  );
}

function EquipmentStep({ source, update, choices, onToggle, onClear }: { source: CharacterSource; update: (next: CharacterSource) => void; choices: ChoiceRequest[]; onToggle: (choice: ChoiceRequest, value: string) => void; onClear: (choice: ChoiceRequest) => void }) {
  const languages = choices.filter((choice) => choice.id === "origin.languages");
  const equipment = choices.filter((choice) => choice.id.startsWith("equipment."));
  return (
    <>
      <Section title="언어">
        {languages.map((choice) => <ChoicePicker key={choice.id} choice={choice} onToggle={(value) => onToggle(choice, value)} onClear={() => onClear(choice)} />)}
      </Section>
      <Section title="시작 장비" hint="직업과 배경의 장비 꾸러미를 고르거나, 금화로 받아 직접 삽니다 (M1에서는 금화만 기록).">
        <div className="cl-row">
          <button type="button" className={`cl-btn${source.equipment.mode === "loadout" ? " primary" : ""}`} onClick={() => update({ ...source, equipment: { mode: "loadout" } })}>장비 꾸러미</button>
          <button type="button" className={`cl-btn${source.equipment.mode === "gold" ? " primary" : ""}`} onClick={() => update({ ...source, equipment: { mode: "gold" } })}>금화로 시작</button>
          {source.equipment.mode === "gold" ? <label className="cl-row cl-small">금화 <input className="cl-input" type="number" min={0} style={{ width: 90 }} value={source.equipment.startingGold ?? ""} placeholder="기본값" onChange={(event) => update({ ...source, equipment: { mode: "gold", startingGold: event.target.value === "" ? undefined : Number(event.target.value) } })} /></label> : null}
        </div>
        {equipment.map((choice) => <ChoicePicker key={choice.id} choice={choice} onToggle={(value) => onToggle(choice, value)} onClear={() => onClear(choice)} />)}
      </Section>
    </>
  );
}
