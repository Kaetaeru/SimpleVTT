import type { AbilityKey, AbilityMethod, CharacterCreateDraft, CharacterCreationSection } from "../app/contracts";
import { useSimpleVtt } from "../app/AppProvider";
import { SectionShell } from "./v09Ui";

const LABELS: Record<AbilityKey, string> = { str: "근력", dex: "민첩", con: "건강", int: "지능", wis: "지혜", cha: "매력" };
const KEYS = Object.keys(LABELS) as AbilityKey[];
const STANDARD = [15, 14, 13, 12, 10, 8];
const COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const mod = (score: number) => { const value = Math.floor((score - 10) / 2); return value >= 0 ? `+${value}` : String(value); };

export function AbilitiesSection({ section, draft }: { section: CharacterCreationSection; draft: CharacterCreateDraft }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const methods: Array<[AbilityMethod, string, string]> = [["standard", "표준 배열", "15 / 14 / 13 / 12 / 10 / 8"], ["rolled", "무작위 생성", "4d6 중 가장 낮은 1개 제외 × 6"], ["point-buy", "포인트 구매", "27점 · 8~15"], ["custom", "커스텀", "이전/홈브루용 직접 입력"]];
  const pointUsed = KEYS.reduce((sum, key) => sum + (COST[draft.abilities[key]] ?? 99), 0);
  const usedStandard = KEYS.map((key) => draft.abilities[key]);
  return <SectionShell section={section} aside={<button onClick={() => updateCharacterDraft({ type: "apply-recommended-array" })}>{draft.className || "클래스"} 추천 배치</button>}>
    <div className="method-tabs create-method-tabs">{methods.map(([id, title, subtitle]) => <button key={id} className={draft.abilityMethod === id ? "active" : ""} onClick={() => updateCharacterDraft({ type: "set-ability-method", value: id })}><strong>{title}</strong><span>{subtitle}</span></button>)}</div>
    {draft.abilityMethod === "standard" && <div className="roll-pool"><div><b>표준 배열 사용 현황</b><span>{STANDARD.map((value) => `${value}${usedStandard.includes(value) ? " ✓" : ""}`).join(" · ")}</span></div></div>}
    {draft.abilityMethod === "rolled" && <div className="roll-slot-pool">{draft.rolledPool.map((slot) => <div key={slot.id}><strong>{slot.total}</strong><span>{slot.dice.join(" + ")} · {slot.dropped} 제외</span><small>{slot.id}</small></div>)}<button onClick={() => updateCharacterDraft({ type: "roll-abilities" })}>4d6 × 6 다시 굴리기</button></div>}
    {draft.abilityMethod === "point-buy" && <div className="point-budget"><strong>{pointUsed} / 27</strong><span>사용 포인트 · 남은 {Math.max(0, 27 - pointUsed)}</span><i style={{ width: `${Math.min(100, pointUsed / 27 * 100)}%` }}/></div>}
    <div className="ability-builder-grid">{KEYS.map((ability) => <AbilityEditor key={ability} ability={ability} draft={draft} pointUsed={pointUsed}/>)}</div>
  </SectionShell>;
}

function AbilityEditor({ ability, draft, pointUsed }: { ability: AbilityKey; draft: CharacterCreateDraft; pointUsed: number }) {
  const { updateCharacterDraft } = useSimpleVtt();
  const score = draft.abilities[ability];
  if (draft.abilityMethod === "rolled") {
    const elsewhere = new Set(KEYS.filter((key) => key !== ability).map((key) => draft.rolledAssignments[key]).filter(Boolean));
    return <div className="ability-editor"><span>{LABELS[ability]}</span><strong>{score}</strong><b>{mod(score)}</b><select value={draft.rolledAssignments[ability] ?? ""} onChange={(event) => updateCharacterDraft({ type: "assign-roll", ability, value: event.target.value })}><option value="">Roll Slot 선택</option>{draft.rolledPool.map((slot) => <option value={slot.id} key={slot.id} disabled={elsewhere.has(slot.id)}>{slot.total} · [{slot.dice.join(",")}]</option>)}</select></div>;
  }
  if (draft.abilityMethod === "standard") {
    const usedElsewhere = KEYS.filter((key) => key !== ability).map((key) => draft.abilities[key]);
    return <div className="ability-editor"><span>{LABELS[ability]}</span><strong>{score}</strong><b>{mod(score)}</b><select value={score} onChange={(event) => updateCharacterDraft({ type: "set-ability", ability, value: Number(event.target.value) })}>{STANDARD.map((value) => <option value={value} key={value} disabled={usedElsewhere.includes(value)}>{value}</option>)}</select></div>;
  }
  const min = draft.abilityMethod === "point-buy" ? 8 : 1;
  const max = draft.abilityMethod === "point-buy" ? 15 : 30;
  const nextCost = draft.abilityMethod === "point-buy" && score < 15 ? pointUsed - (COST[score] ?? 0) + (COST[score + 1] ?? 99) : pointUsed;
  return <div className="ability-editor"><span>{LABELS[ability]}</span><strong>{score}</strong><b>{mod(score)}</b><div className="score-controls"><button disabled={score <= min} onClick={() => updateCharacterDraft({ type: "set-ability", ability, value: score - 1 })}>−</button><input type="number" value={score} min={min} max={max} onChange={(event) => updateCharacterDraft({ type: "set-ability", ability, value: Number(event.target.value) })}/><button disabled={score >= max || (draft.abilityMethod === "point-buy" && nextCost > 27)} onClick={() => updateCharacterDraft({ type: "set-ability", ability, value: score + 1 })}>+</button></div></div>;
}
