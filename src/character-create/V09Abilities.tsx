import type { AbilityKey, AbilityMethod, CharacterCreateDraft, CharacterCreationSection } from "../app/contracts";
import { useSimpleVtt } from "../app/AppProvider";
import {
  STANDARD_ABILITY_ARRAY,
  abilityEditorFacts,
  pointBuyPresentation,
} from "../app/characterCreationAbilityPresentation";
import { SectionShell } from "./v09Ui";

const LABELS: Record<AbilityKey, string> = { str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" };
const KEYS = Object.keys(LABELS) as AbilityKey[];

export function AbilitiesSection({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const methods: Array<[AbilityMethod, string, string]> = [["standard", "표준 배열", "15 / 14 / 13 / 12 / 10 / 8"], ["rolled", "무작위 생성", "4d6 중 가장 낮은 1개 제외 × 6"], ["point-buy", "포인트 구매", "27점 · 8~15"], ["custom", "커스텀", "이전/홈브루용 직접 입력"]];
  const pointBuy = pointBuyPresentation(draft.abilities);
  const usedStandard = KEYS.map((key) => draft.abilities[key]);
  return <SectionShell section={section} aside={<button onClick={() => updateCharacterDraft({ type: "apply-recommended-array" })}>{draft.className || "클래스"} 추천 배치</button>}>
    <div className="method-tabs create-method-tabs">{methods.map(([id, title, subtitle]) => <button key={id} className={draft.abilityMethod === id ? "active" : ""} onClick={() => updateCharacterDraft({ type: "set-ability-method", value: id })}><strong>{title}</strong><span>{subtitle}</span></button>)}</div>
    {draft.abilityMethod === "standard" && <div className="roll-pool"><div><b>표준 배열 사용 현황</b><span>{STANDARD_ABILITY_ARRAY.map((value) => `${value}${usedStandard.includes(value) ? " ✓" : ""}`).join(" · ")}</span></div></div>}
    {draft.abilityMethod === "rolled" && <div className="roll-slot-pool">{draft.rolledPool.map((slot) => <div key={slot.id}><strong>{slot.total}</strong><span>{slot.dice.join(" + ")} · {slot.dropped} 제외</span><small>{slot.id}</small></div>)}<button onClick={() => updateCharacterDraft({ type: "roll-abilities" })}>4d6 × 6 다시 굴리기</button></div>}
    {draft.abilityMethod === "point-buy" && <div className="point-budget"><strong>{pointBuy.used} / {pointBuy.budget}</strong><span>사용 포인트 · 남은 {pointBuy.remaining}</span><i style={{ width: `${pointBuy.usedPercent}%` }}/></div>}
    <div className="ability-builder-grid">{KEYS.map((ability) => <AbilityEditor key={ability} ability={ability} draft={draft}/>)}</div>
  </SectionShell>;
}

function AbilityEditor({ ability, draft }: { ability: AbilityKey; draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const facts = abilityEditorFacts(draft,ability);
  if (draft.abilityMethod === "rolled") {
    const elsewhere = new Set(KEYS.filter((key) => key !== ability).map((key) => draft.rolledAssignments[key]).filter(Boolean));
    return <div className="ability-editor"><span>{LABELS[ability]}</span><strong>{facts.score}</strong><b>{facts.modifierText}</b><select value={draft.rolledAssignments[ability] ?? ""} onChange={(event) => updateCharacterDraft({ type: "assign-roll", ability, value: event.target.value })}><option value="">Roll Slot 선택</option>{draft.rolledPool.map((slot) => <option value={slot.id} key={slot.id} disabled={elsewhere.has(slot.id)}>{slot.total} · [{slot.dice.join(",")}]</option>)}</select></div>;
  }
  if (draft.abilityMethod === "standard") {
    const usedElsewhere = KEYS.filter((key) => key !== ability).map((key) => draft.abilities[key]);
    return <div className="ability-editor"><span>{LABELS[ability]}</span><strong>{facts.score}</strong><b>{facts.modifierText}</b><select value={facts.score} onChange={(event) => updateCharacterDraft({ type: "set-ability", ability, value: Number(event.target.value) })}>{STANDARD_ABILITY_ARRAY.map((value) => <option value={value} key={value} disabled={usedElsewhere.includes(value)}>{value}</option>)}</select></div>;
  }
  return <div className="ability-editor"><span>{LABELS[ability]}</span><strong>{facts.score}</strong><b>{facts.modifierText}</b><div className="score-controls"><button disabled={!facts.canDecrease} onClick={() => updateCharacterDraft({ type: "set-ability", ability, value: facts.score - 1 })}>−</button><input type="number" value={facts.score} min={facts.minimum} max={facts.maximum} onChange={(event) => updateCharacterDraft({ type: "set-ability", ability, value: Number(event.target.value) })}/><button disabled={!facts.canIncrease} onClick={() => updateCharacterDraft({ type: "set-ability", ability, value: facts.score + 1 })}>+</button></div></div>;
}
