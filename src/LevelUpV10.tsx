import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSimpleVtt } from "./app/AppProvider";
import { mockAdapter } from "./app/mockAdapter";
import "./app/progressionContracts";
import type { Phase07AdapterCommands } from "./app/progressionRuntimeAdapter";
import type { ChoiceDefinition, ChoiceSelectionValue } from "./domain/choiceDefinition";
import { PROGRESSION_CATALOG, multiclassEligibility } from "./domain/progressionCatalog";

const ABILITIES = [
  ["str", "근력"], ["dex", "민첩"], ["con", "건강"], ["int", "지능"], ["wis", "지혜"], ["cha", "매력"],
] as const;

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

function ChoicePanel({ choice, onSelect, selection }: { choice: ChoiceDefinition; selection?: ChoiceSelectionValue; onSelect(value: ChoiceSelectionValue): void }) {
  if (choice.status === "catalog-pending") return <section className="levelup-choice pending">
    <header><div><b>{choice.label}</b><small>{choice.source}</small></div><span>Phase 08 필요</span></header>
    <p>{choice.description}</p><div className="levelup-pending">{choice.pendingReason}</div>
  </section>;

  if (choice.kind === "asi-or-feat") {
    const asi = selection?.kind === "asi" ? selection : undefined;
    const set = (patch: Partial<Extract<ChoiceSelectionValue, { kind:"asi" }>>) => onSelect({ kind:"asi", mode:asi?.mode ?? "plus-two", primary:asi?.primary, secondary:asi?.secondary, featId:asi?.featId, ...patch });
    const featOptions = choice.options.filter((option) => option.id.startsWith("feat:"));
    return <section className="levelup-choice">
      <header><div><b>{choice.label}</b><small>{choice.source}</small></div><span>선택 필요</span></header>
      <div className="levelup-segmented">
        <button className={asi?.mode === "plus-two" ? "active" : ""} onClick={() => set({ mode:"plus-two", secondary:undefined, featId:undefined })}>+2</button>
        <button className={asi?.mode === "split" ? "active" : ""} onClick={() => set({ mode:"split", featId:undefined })}>+1 / +1</button>
        <button className={asi?.mode === "feat" ? "active" : ""} onClick={() => set({ mode:"feat", primary:undefined, secondary:undefined })}>재주</button>
      </div>
      {asi?.mode !== "feat" && <div className="levelup-ability-pickers">
        <label><span>{asi?.mode === "split" ? "첫 능력치" : "능력치"}</span><select value={asi?.primary ?? ""} onChange={(event) => set({ primary:(event.target.value || undefined) as typeof ABILITIES[number][0] | undefined })}><option value="">선택</option>{ABILITIES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        {asi?.mode === "split" && <label><span>둘째 능력치</span><select value={asi.secondary ?? ""} onChange={(event) => set({ secondary:(event.target.value || undefined) as typeof ABILITIES[number][0] | undefined })}><option value="">선택</option>{ABILITIES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
      </div>}
      {asi?.mode === "feat" && <div className="levelup-option-grid">{featOptions.length ? featOptions.map((option) => {
        const featId = option.id.slice("feat:".length);
        return <button key={option.id} className={asi.featId === featId ? "active" : ""} onClick={() => set({ featId })}><b>{option.label}</b>{option.description && <small>{option.description}</small>}</button>;
      }) : <div className="levelup-pending">현재 catalog에 선택 가능한 재주가 없습니다.</div>}</div>}
    </section>;
  }

  const selected = selection?.kind === "options" ? selection.optionIds : [];
  return <section className="levelup-choice">
    <header><div><b>{choice.label}</b><small>{choice.source}</small></div><span>{selected.length}/{choice.count}</span></header>
    <p>{choice.description}</p>
    <div className="levelup-option-grid">{choice.options.map((option) => <button key={option.id} disabled={Boolean(option.disabledReason)} className={selected.includes(option.id) ? "active" : ""} onClick={() => {
      const next = selected.includes(option.id) ? selected.filter((id) => id !== option.id) : [...selected, option.id].slice(-choice.count);
      onSelect({ kind:"options", optionIds:next });
    }}><b>{option.label}</b>{option.description && <small>{option.description}</small>}</button>)}</div>
  </section>;
}

export function LevelUpV10Bridge() {
  const host = useLevelUpHost();
  const { snapshot, refresh } = useSimpleVtt();
  const adapter = mockAdapter as unknown as Phase07AdapterCommands;
  const plan = snapshot?.progressionPlan;
  const draft = snapshot?.levelUpDraft;
  const character = snapshot?.activeCharacter;
  const [busy, setBusy] = useState(false);
  const tracks = character?.classLevels ?? [];
  const classOptions = useMemo(() => {
    if (!character) return [];
    return PROGRESSION_CATALOG.classes.map((entry) => {
      const existing = tracks.some((track) => track.classId === entry.id);
      const eligibility = existing ? { eligible:true, reason:"" } : multiclassEligibility(character.abilities, tracks, entry.id);
      return { entry, existing, eligible:eligibility.eligible, reason:eligibility.reason };
    });
  }, [character, tracks]);

  if (!host || !snapshot || !plan || !draft || !character) return null;

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try { await operation(); await refresh(); } finally { setBusy(false); }
  };
  const chooseClass = (classId: string) => run(() => adapter.setProgressionTargetClass(classId));
  const choose = (choiceId: string, value: ChoiceSelectionValue) => run(() => adapter.setProgressionChoice(choiceId, value));
  const setHp = (method: "fixed" | "roll", roll?: number) => run(() => adapter.setProgressionHp(method, roll));
  const legacyCancel = () => host.querySelector<HTMLButtonElement>(".builder-screen .builder-top > button:last-child")?.click();
  const legacyCommit = () => host.querySelector<HTMLButtonElement>(".builder-screen .builder-footer button.primary")?.click();

  const existingOptions = classOptions.filter((option) => option.existing);
  const addOptions = classOptions.filter((option) => !option.existing);
  const fixedGain = Math.floor(plan.hp.hitDie / 2) + 1 + plan.hp.constitutionModifier;

  return createPortal(<div className="levelup-v10">
    <header className="levelup-v10-head">
      <div><span className="eyebrow accent">Phase 07 · 레벨 업</span><h1>{character.name}</h1><p>총 레벨 {plan.fromTotalLevel} → {plan.toTotalLevel}</p></div>
      <div className="levelup-track-summary">{plan.classTracksBefore.map((track) => <span key={track.classId}>{track.className} {track.level}</span>)}<b>→</b>{plan.classTracksAfter.map((track) => <span key={`${track.classId}.after`}>{track.className} {track.level}</span>)}</div>
    </header>

    <div className="levelup-v10-layout">
      <aside className="levelup-class-picker">
        <span className="eyebrow">클래스 레벨</span>
        <h2>계속할 클래스</h2>
        <div className="levelup-class-list">{existingOptions.map(({ entry }) => <button key={entry.id} className={plan.targetClassId === entry.id ? "active" : ""} onClick={() => chooseClass(entry.id)} disabled={busy}><b>{entry.nameKo}</b><small>{tracks.find((track) => track.classId === entry.id)?.level ?? 0} → {(tracks.find((track) => track.classId === entry.id)?.level ?? 0) + 1}</small></button>)}</div>
        <h2>+ 클래스 추가</h2>
        <div className="levelup-class-list add">{addOptions.map(({ entry, eligible, reason }) => <button key={entry.id} className={plan.targetClassId === entry.id ? "active" : ""} disabled={busy || !eligible} title={reason} onClick={() => chooseClass(entry.id)}><b>{entry.nameKo}</b><small>{eligible ? `${entry.nameEn} · 1레벨` : reason || "선행 조건 미충족"}</small></button>)}</div>
      </aside>

      <main className="levelup-v10-main">
        <section className="levelup-auto">
          <header><div><span className="eyebrow accent">자동 획득</span><h2>{plan.targetClassName} {plan.targetClassLevel}레벨</h2></div>{plan.isMulticlass && <strong>멀티클래스</strong>}</header>
          <div className="levelup-auto-grid">
            <article><small>히트 다이스</small><b>+1d{plan.hp.hitDie}</b></article>
            <article><small>숙련 보너스</small><b>+{plan.proficiencyBefore} → +{plan.proficiencyAfter}</b></article>
            <article><small>최대 HP</small><b>+{plan.hp.totalGain}</b></article>
            <article><small>주문 시전자 레벨</small><b>{plan.spellcastingBefore.casterLevel} → {plan.spellcastingAfter.casterLevel}</b></article>
          </div>
          {plan.automaticGrants.length > 0 && <div className="levelup-grants">{plan.automaticGrants.map((grant) => <span key={grant}>{grant}</span>)}</div>}
          {plan.isMulticlass && plan.multiclassGrants.length > 0 && <details><summary>멀티클래스로 얻는 숙련/특성</summary><ul>{plan.multiclassGrants.map((grant) => <li key={grant}>{grant}</li>)}</ul></details>}
        </section>

        <section className="levelup-hp-choice">
          <header><div><span className="eyebrow">HP</span><h2>히트 포인트 증가</h2></div><small>d{plan.hp.hitDie} + 건강 수정치 {plan.hp.constitutionModifier >= 0 ? "+" : ""}{plan.hp.constitutionModifier}</small></header>
          <div className="levelup-segmented"><button className={draft.hpMethod === "fixed" ? "active" : ""} onClick={() => setHp("fixed")} disabled={busy}>고정값 · {Math.max(1, fixedGain)} HP</button><button className={draft.hpMethod === "roll" ? "active" : ""} onClick={() => setHp("roll", draft.hpRoll ?? 1)} disabled={busy}>d{plan.hp.hitDie} 굴림</button></div>
          {draft.hpMethod === "roll" && <label className="levelup-roll"><span>d{plan.hp.hitDie} 결과</span><input type="number" min={1} max={plan.hp.hitDie} value={draft.hpRoll ?? ""} onChange={(event) => setHp("roll", Number(event.target.value))}/></label>}
          {plan.hp.retroactiveConstitutionGain !== 0 && <p className="levelup-con-retro">건강 수정치 변화의 소급 HP: {plan.hp.retroactiveConstitutionGain > 0 ? "+" : ""}{plan.hp.retroactiveConstitutionGain}</p>}
        </section>

        <section className="levelup-required"><header><span className="eyebrow accent">선택 필요</span><h2>{plan.choices.length ? `${plan.choices.length}개 결정` : "추가 선택 없음"}</h2></header>
          {plan.choices.length === 0 ? <div className="levelup-empty">이 레벨은 자동 획득 항목만 확인하고 바로 적용할 수 있습니다.</div> : plan.choices.map((choice) => <ChoicePanel key={choice.id} choice={choice} selection={currentSelection(snapshot, choice.id)} onSelect={(value) => { void choose(choice.id, value); }}/>) }
        </section>
      </main>

      <aside className="levelup-v10-preview">
        <span className="eyebrow accent">Before → After</span><h2>변경 요약</h2>
        <div className="levelup-diffs">{plan.diffs.map((diff) => <div key={diff.label}><span>{diff.label}<small>{diff.source}</small></span><b>{diff.before}</b><i>→</i><strong>{diff.after}</strong></div>)}</div>
        <h3>검증</h3>
        {plan.blocking.length === 0 && <div className="validation info">Blocking 없음</div>}
        {plan.blocking.map((message) => <div className="validation blocking" key={message}>{message}</div>)}
        {plan.warnings.map((message) => <div className="validation warning" key={message}>{message}</div>)}
      </aside>
    </div>

    <footer className="levelup-v10-footer"><button onClick={legacyCancel}>취소</button><span>{plan.blocking.length ? `${plan.blocking.length}개 Blocking` : "적용 준비 완료"}</span><button className="primary" disabled={busy || plan.blocking.length > 0} onClick={legacyCommit}>레벨 업</button></footer>
  </div>, host);
}
