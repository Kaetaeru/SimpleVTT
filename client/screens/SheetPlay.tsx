/**
 * The playable sheet: HP, rests, conditions, effects, dice, the live sheet view. Every change is a SheetOp handed to
 * `dispatch`, so the same component runs the offline sheet (ops applied locally and saved) and a session seat
 * (ops sent to the host). Dice are rolled here, before dispatch, and travel inside the op.
 */
import { useState, type ReactNode } from "react";
import type { ContentCatalog } from "../catalog/catalog";
import { describeRoll, parseFormula, type RollSpec } from "../character/dice";
import type { SheetOp } from "../character/ops";
import { applyHpCommand, CONDITIONS, hitDiceAvailable, type FeatureUseExtras } from "../character/play";
import type { CharacterRuntime } from "../character/runtime";
import type { CharacterSource, DerivedCharacter } from "../character/types";
import { featureActivation } from "../rules/activation";
import { castHook } from "../rules/effects";
import { Modal, Pill } from "../ui/components";
import { useDice } from "../ui/dice/DiceProvider";
import { SheetView, ValidationList, type SheetActions } from "./SheetView";

export type Dispatch = (op: SheetOp) => Promise<string | null> | void;

export interface SheetPlayProps {
  source: CharacterSource;
  runtime: CharacterRuntime;
  derived: DerivedCharacter;
  catalog: ContentCatalog;
  dispatch: Dispatch;
  /** Only look: no buttons that change anything (a party member's sheet). */
  readOnly?: boolean;
  /** Cards rendered before the play cards (a session banner, the DM's controls). */
  lead?: ReactNode;
  /** Who is acting when it is not the character's owner ("DM"); logged by the host. */
  actorLabel?: string;
}

export function SheetPlay({ source, runtime, derived, catalog, dispatch, readOnly = false, lead, actorLabel }: SheetPlayProps) {
  const dice = useDice();
  const [hpInput, setHpInput] = useState("");
  const [sliderHp, setSliderHp] = useState<number | null>(null);
  const [resting, setResting] = useState<{ spends: Record<string, number> } | null>(null);
  const [adding, setAdding] = useState<{ query: string; custom: string; quantity: string } | null>(null);
  const [showLog, setShowLog] = useState(true);
  const [customRoll, setCustomRoll] = useState("");
  const run = async (op: SheetOp) => { const refused = await dispatch(op); if (refused) alert(refused); };
  const hpPreview = applyHpCommand(runtime, derived, hpInput);
  const commitSlider = () => { if (sliderHp !== null) { void run({ type: "hp.set", value: sliderHp }); setSliderHp(null); } };
  const submitHp = () => { if (hpPreview) { void run({ type: "hp.command", text: hpInput }); setHpInput(""); } };
  /** A formula with dice goes through the overlay; a plain number is applied at once. */
  const rollTotal = async (spec: RollSpec, lines?: string[]) => { const parsed = parseFormula(spec.formula); if (parsed && parsed.dice.length === 0) return parsed.modifier; const result = await dice.roll(spec); lines?.push(describeRoll(result)); return result.total; };
  const rollAndLog = async (spec: RollSpec) => { const result = await dice.roll(spec); void run({ type: "log.note", text: describeRoll(result) }); return result; };

  const activateFeature = async (feature: DerivedCharacter["features"][number]) => {
    const activation = featureActivation(feature, derived);
    if (!activation) return;
    const extras: FeatureUseExtras = {};
    if (activation.points && activation.resourceId) {
      const pool = derived.resources.find((resource) => resource.id === activation.resourceId);
      const left = pool ? pool.max - (runtime.resourcesUsed[pool.id] ?? 0) : 0;
      const answer = prompt(`${feature.name}: 몇 점을 쓸까요? (남은 ${left})`, String(Math.min(left, 5)));
      if (answer === null) return;
      const points = Number(answer);
      if (!Number.isInteger(points) || points < 1 || points > left) { alert("1 이상, 남은 점수 이하의 정수를 넣어 주세요."); return; }
      extras.points = points;
      if (confirm(`${points}점을 자신에게 써서 HP를 ${points} 회복할까요? (취소: 다른 대상)`)) extras.healRoll = points;
    }
    const lines: string[] = [];
    if (activation.heal) extras.healRoll = await rollTotal({ label: feature.name, formula: activation.heal(derived), note: "회복", kind: "custom" }, lines);
    if (activation.tempHp) extras.tempRoll = await rollTotal({ label: feature.name, formula: activation.tempHp(derived), note: "임시 HP", kind: "custom" }, lines);
    if (activation.roll) { const roll = activation.roll(derived); extras.rolled = { label: roll.label, total: await rollTotal({ label: roll.label, formula: roll.formula, kind: "custom" }, lines) }; }
    await run({ type: "feature.use", featureId: feature.id, extras, lines });
  };

  const actions: SheetActions = {
    useSlot: (level) => void run({ type: "slot.use", level }),
    restoreSlot: (level) => void run({ type: "slot.restore", level }),
    usePactSlot: () => void run({ type: "pact.use" }),
    restorePactSlot: () => void run({ type: "pact.restore" }),
    useResource: (id) => void run({ type: "resource.use", id }),
    restoreResource: (id) => void run({ type: "resource.restore", id }),
    adjustGold: (delta) => void run({ type: "gold.adjust", delta }),
    setGold: (gold) => void run({ type: "gold.set", gold }),
    toggleEquip: (instanceId) => void run({ type: "item.equip", instanceId }),
    setQuantity: (instanceId, quantity) => void run({ type: "item.quantity", instanceId, quantity }),
    removeItem: (instanceId) => void run({ type: "item.remove", instanceId }),
    openAddItem: () => setAdding({ query: "", custom: "", quantity: "1" }),
    roll: (label, formula, note, kind) => { void rollAndLog({ label, formula, note, kind }); },
    useFeature: (feature) => { void activateFeature(feature); },
    endEffect: (key) => void run({ type: "effect.end", key }),
    castSpell: async (spell, method) => {
      const slotLevel = method.kind === "slot" ? method.level : method.kind === "pact" ? derived.pactMagic?.level ?? spell.level : spell.level;
      const hook = castHook(spell, slotLevel, derived);
      const lines: string[] = [];
      let tempHp: number | undefined;
      if (hook?.tempHp) tempHp = await rollTotal({ label: `${spell.name} 임시 HP`, formula: hook.tempHp, kind: "custom" }, lines);
      if (hook?.damage) { const total = await rollTotal({ label: `${spell.name} 피해`, formula: hook.damage.formula, note: hook.damage.type, kind: "damage" }, lines); lines.push(`${spell.name} 피해 ${total} ${hook.damage.type}${hook.notes?.length ? ` (${hook.notes.join(" · ")})` : ""}`); }
      else if (hook?.notes?.length) lines.push(`${spell.name}: ${hook.notes.join(" · ")}`);
      await run({ type: "spell.cast", spellId: spell.id, method, tempHp, lines });
    },
  };

  const hpRatio = derived.hp.max ? runtime.hp.current / derived.hp.max : 0;
  const available = hitDiceAvailable(runtime, derived);
  const doShortRest = async () => {
    const plan = Object.entries(resting?.spends ?? {}).filter(([, count]) => count > 0);
    setResting(null);
    const spends: Array<{ die: string; roll: number }> = [];
    const lines: string[] = [];
    for (const [die, count] of plan) {
      const result = await dice.roll({ label: `히트 다이스 ${count}${die}`, formula: `${count}${die}`, note: `건강 ${derived.abilities.con.modifier >= 0 ? "+" : ""}${derived.abilities.con.modifier} ×${count}`, kind: "hit-die" });
      lines.push(describeRoll(result));
      for (const rolled of result.dice) spends.push({ die, roll: rolled.value });
    }
    await run({ type: "rest.short", spends, lines });
  };
  const submitCustomRoll = () => { if (!parseFormula(customRoll)) return; void rollAndLog({ label: "주사위", formula: customRoll, kind: "custom" }); setCustomRoll(""); };
  const catalogMatches = adding && adding.query.trim() ? catalog.items.filter((item) => item.name.includes(adding.query.trim()) || item.nameEn.toLowerCase().includes(adding.query.trim().toLowerCase())).slice(0, 30) : [];

  if (readOnly) {
    return (
      <div className="cl-sheet-play">
        {lead}
        <div className="cl-play">
          <div className="cl-card">
            <div className="cl-row"><span className="cl-hp-big">{runtime.hp.current}<small> / {derived.hp.max}</small></span>{runtime.hp.temp ? <Pill tone="accent">임시 HP {runtime.hp.temp}</Pill> : null}</div>
            <div className={`cl-hpbar${hpRatio <= 0.25 ? " bad" : hpRatio <= 0.5 ? " warn" : ""}`}><span style={{ width: `${Math.round(hpRatio * 100)}%` }} /></div>
            {runtime.conditions.length ? <div className="cl-row" style={{ gap: 4 }}>{runtime.conditions.map((condition) => <Pill key={condition} tone="bad">{condition}</Pill>)}</div> : null}
            {runtime.effects?.length ? <div className="cl-row" style={{ gap: 4 }}>{runtime.effects.map((effect) => <Pill key={effect.key} tone="accent">{effect.name}</Pill>)}</div> : null}
          </div>
        </div>
        <SheetView derived={derived} catalog={catalog} runtime={runtime} />
      </div>
    );
  }

  return (
    <div className="cl-sheet-play">
      {lead}
      {derived.validation.blocking.length || derived.validation.warnings.length ? <div className="cl-card"><ValidationList derived={derived} /></div> : null}
      <div className="cl-play">
        <div className="cl-card">
          <div className="cl-row">
            <span className="cl-hp-big">{runtime.hp.current}<small> / {derived.hp.max}</small></span>
            {runtime.hp.temp ? <Pill tone="accent">임시 HP {runtime.hp.temp} <button type="button" className="cl-btn quiet small" style={{ height: 18, padding: "0 4px" }} onClick={() => void run({ type: "hp.clearTemp" })}>✕</button></Pill> : null}
            {actorLabel ? <Pill tone="bad">{actorLabel}로 조작 중</Pill> : null}
            <span className="cl-quiet cl-small" style={{ marginLeft: "auto" }}>히트 다이스 {Object.entries(available).map(([die, count]) => `${count}/${derived.hitDice[die]} ${die}`).join(" · ")}</span>
          </div>
          <div className={`cl-hpbar${hpRatio <= 0.25 ? " bad" : hpRatio <= 0.5 ? " warn" : ""}`}><span style={{ width: `${Math.round(hpRatio * 100)}%` }} /></div>
          <input type="range" className="cl-hp-slider" min={0} max={derived.hp.max} value={sliderHp ?? runtime.hp.current} aria-label="현재 HP 슬라이더" title={`${sliderHp ?? runtime.hp.current} / ${derived.hp.max}`}
            onChange={(event) => setSliderHp(Number(event.target.value))}
            onMouseUp={() => commitSlider()} onTouchEnd={() => commitSlider()} onKeyUp={() => commitSlider()} onBlur={() => commitSlider()} />
          <div className="cl-row" style={{ gap: 6 }}>
            <input className="cl-input" style={{ width: 110 }} placeholder="12 · -4 · +4 · ++4" aria-label="HP 입력" title="숫자: 현재 HP 설정 · -4: 피해 · +4: 회복 · ++4: 임시 HP" value={hpInput} onChange={(event) => setHpInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitHp(); }} />
            <button type="button" className="cl-btn primary" disabled={!hpPreview} onClick={submitHp}>적용</button>
            <span className="cl-quiet cl-small">{hpInput.trim() ? (hpPreview ? `→ HP ${hpPreview.hp.current}/${derived.hp.max}${hpPreview.hp.temp !== runtime.hp.temp ? ` · 임시 ${hpPreview.hp.temp}` : ""}` : "형식: 12 / -4 / +4 / ++4") : "숫자 = 설정 · −4 피해 · +4 회복 · ++4 임시 HP"}</span>
          </div>
          <div className="cl-row" style={{ gap: 6 }}>
            <button type="button" className="cl-btn" onClick={() => setResting({ spends: {} })}>짧은 휴식</button>
            <button type="button" className="cl-btn" onClick={() => { if (confirm("긴 휴식을 마칠까요? HP·슬롯·자원이 전부 회복되고 히트 다이스 절반이 돌아옵니다.")) void run({ type: "rest.long" }); }}>긴 휴식</button>
            <span className="cl-quiet cl-small">탈진</span>
            <select className="cl-select" style={{ height: 26 }} value={runtime.exhaustion} aria-label="탈진 단계" onChange={(event) => void run({ type: "exhaustion.set", level: Number(event.target.value) })}>
              {[0, 1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
            <label className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" checked={runtime.heroicInspiration} onChange={(event) => void run({ type: "inspiration.set", value: event.target.checked })} /> 영웅적 영감</label>
          </div>
          <div className="cl-row" style={{ gap: 6 }}>
            <input className="cl-input" style={{ width: 120 }} placeholder="주사위 (2d6+3)" aria-label="주사위 식" value={customRoll} onChange={(event) => setCustomRoll(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitCustomRoll(); }} />
            <button type="button" className="cl-btn" disabled={!parseFormula(customRoll)} onClick={submitCustomRoll}>굴림</button>
            {["1d20", "1d12", "1d10", "1d8", "1d6", "1d4"].map((formula) => <button type="button" key={formula} className="cl-btn small" onClick={() => void rollAndLog({ label: "주사위", formula, kind: "custom" })}>{formula.slice(1)}</button>)}
          </div>
        </div>
        <div className="cl-card">
          <h3 className="cl-muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>진행 중인 효과 <Pill>{runtime.effects?.length ?? 0}</Pill>
            <button type="button" className="cl-btn small" style={{ marginLeft: "auto" }} disabled={!runtime.effects?.length} title="라운드가 지나면 라운드로 세는 효과가 하나씩 줄고, 다 되면 저절로 끝납니다." onClick={() => void run({ type: "round.advance" })}>다음 라운드</button>
          </h3>
          {runtime.effects?.length ? (
            <div className="cl-effects">
              {runtime.effects.map((effect) => {
                const summary = derived.activeEffects.find((item) => item.key === effect.key);
                return (
                  <div className={`cl-effect${summary && !summary.applied ? " manual" : ""}`} key={effect.key}>
                    <div className="cl-row" style={{ gap: 8 }}>
                      <span className="cl-name">{effect.name}</span>
                      {effect.concentration ? <Pill tone="accent">집중</Pill> : null}
                      {summary && !summary.applied ? <Pill tone="bad">수동</Pill> : <Pill tone="good">적용됨</Pill>}
                      <span className="cl-quiet cl-small">{effect.rounds !== undefined ? `${effect.elapsed}/${effect.rounds} 라운드 · ` : ""}{effect.duration}</span>
                      <button type="button" className="cl-btn small danger" style={{ marginLeft: "auto" }} onClick={() => void run({ type: "effect.end", key: effect.key })}>종료</button>
                    </div>
                    {summary?.notes.length ? <div className="cl-effect-notes">{summary.notes.map((note) => <span key={note}>{note}</span>)}</div> : null}
                  </div>
                );
              })}
            </div>
          ) : <p className="cl-quiet cl-small">격노·주문처럼 지속되는 것을 사용하면 여기에 나타나고, 종료 버튼이나 라운드 진행으로 끝냅니다.</p>}
        </div>
        <div className="cl-card">
          <h3 className="cl-muted">상태</h3>
          <div className="cl-cond">
            {CONDITIONS.map((condition) => <button type="button" key={condition} className={runtime.conditions.includes(condition) ? "on" : ""} onClick={() => void run({ type: "condition.toggle", condition })}>{condition}</button>)}
          </div>
          {runtime.hp.current === 0 || runtime.deathSaves.success || runtime.deathSaves.failure ? (
            <div className="cl-row" style={{ gap: 6 }}>
              <span className="cl-small">죽음 내성 성공 {runtime.deathSaves.success}/3 · 실패 {runtime.deathSaves.failure}/3</span>
              <button type="button" className="cl-btn small" onClick={() => void run({ type: "deathSave", success: true })}>성공</button>
              <button type="button" className="cl-btn small danger" onClick={() => void run({ type: "deathSave", success: false })}>실패</button>
              <button type="button" className="cl-btn small quiet" onClick={() => void run({ type: "deathSave.reset" })}>초기화</button>
            </div>
          ) : null}
        </div>
        <div className="cl-card">
          <h3 className="cl-muted" style={{ display: "flex", gap: 8 }}>기록 <button type="button" className="cl-btn quiet small" onClick={() => setShowLog((value) => !value)}>{showLog ? "접기" : "펼치기"}</button></h3>
          {showLog ? (
            <div className="cl-log">
              {(runtime.log ?? []).length === 0 ? <span className="cl-quiet">아직 기록이 없습니다.</span> : [...(runtime.log ?? [])].reverse().map((entry, index) => <div key={`${entry.at}-${index}`}><span className="cl-at">{new Date(entry.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>{entry.text}</div>)}
            </div>
          ) : null}
        </div>
      </div>

      <SheetView derived={derived} catalog={catalog} runtime={runtime} actions={actions} />

      {resting ? (
        <Modal title="짧은 휴식" onClose={() => setResting(null)} actions={<button type="button" className="cl-btn primary" onClick={doShortRest}>휴식 마치기</button>}>
          <p className="cl-muted cl-small">쓸 히트 다이스를 고르세요. 주사위마다 굴림 + 건강 수정치({derived.abilities.con.modifier >= 0 ? "+" : ""}{derived.abilities.con.modifier})만큼 회복합니다. 짧은 휴식마다 회복하는 자원과 계약 마법 슬롯도 돌아옵니다.</p>
          {Object.entries(available).map(([die, count]) => (
            <div className="cl-row" key={die}>
              <span style={{ width: 60 }}>{die}</span>
              <button type="button" className="cl-btn small" disabled={(resting.spends[die] ?? 0) <= 0} onClick={() => setResting({ spends: { ...resting.spends, [die]: (resting.spends[die] ?? 0) - 1 } })}>−</button>
              <span style={{ width: 48, textAlign: "center" }}>{resting.spends[die] ?? 0} / {count}</span>
              <button type="button" className="cl-btn small" disabled={(resting.spends[die] ?? 0) >= count} onClick={() => setResting({ spends: { ...resting.spends, [die]: (resting.spends[die] ?? 0) + 1 } })}>+</button>
            </div>
          ))}
        </Modal>
      ) : null}
      {adding ? (
        <Modal title="아이템 추가" onClose={() => setAdding(null)} actions={<button type="button" className="cl-btn primary" disabled={!adding.custom.trim()} onClick={() => { void run({ type: "item.add", item: { name: adding.custom.trim(), quantity: Number(adding.quantity) || 1 } }); setAdding(null); }}>직접 입력한 이름으로 추가</button>}>
          <div className="cl-row">
            <input className="cl-input" style={{ flex: 1 }} placeholder="목록에서 검색 (예: 장검, potion)" aria-label="아이템 검색" value={adding.query} onChange={(event) => setAdding({ ...adding, query: event.target.value })} autoFocus />
            <input className="cl-input" style={{ width: 70 }} aria-label="수량" value={adding.quantity} onChange={(event) => setAdding({ ...adding, quantity: event.target.value })} />
          </div>
          {catalogMatches.length ? (
            <div className="cl-list" style={{ gap: 2, maxHeight: 260, overflow: "auto" }}>
              {catalogMatches.map((item) => (
                <button type="button" key={item.id} className="cl-option" onClick={() => { void run({ type: "item.add", item: { itemId: item.id, name: item.name, quantity: Number(adding.quantity) || 1 } }); setAdding(null); }}>
                  <span className="cl-name">{item.name}</span><span className="cl-en">{item.nameEn}</span>
                  <span className="cl-summary">{item.kind}{item.weapon ? ` · ${item.weapon.damage} ${item.weapon.damageType}` : ""}{item.armor ? ` · AC ${item.armor.base}` : ""}{item.priceGp !== undefined ? ` · ${item.priceGp} GP` : ""}</span>
                </button>
              ))}
            </div>
          ) : adding.query.trim() ? <p className="cl-quiet cl-small">목록에 없습니다. 아래에 이름을 직접 적어 추가할 수 있습니다.</p> : null}
          <div className="cl-field"><label htmlFor="cl-custom-item">직접 입력</label><input id="cl-custom-item" className="cl-input" placeholder="예: 고대의 열쇠" value={adding.custom} onChange={(event) => setAdding({ ...adding, custom: event.target.value })} /></div>
        </Modal>
      ) : null}
      <span hidden data-source-name={source.name} />
    </div>
  );
}
