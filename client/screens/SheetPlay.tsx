/**
 * A character in play, offline or at the table: HP with damage/heal/temp, short and long rests with hit dice,
 * conditions, death saves, inspiration, effects, the live sheet (slots, resources, gold, bag), an activity log.
 * The owner of the record decides where it is saved (`save`) and where rolls go (`onRolled`).
 */
import { useMemo, useState, type ReactNode } from "react";
import type { ContentCatalog } from "../catalog/catalog";
import { deriveCharacter } from "../character/derive";
import { describeRoll, parseFormula, type RollResult, type RollSpec } from "../character/dice";
import { useDice } from "../ui/dice/DiceProvider";
import { exportCharacterFile, serializeCharacterFile } from "../character/json";
import {
  addItem, adjustGold, advanceRound, applyHpCommand, castSpell, clearTempHp, CONDITIONS, endEffect, grantTempHp, hitDiceAvailable, longRest, noteLog, recordDeathSave, removeItem, resetDeathSaves,
  restorePactSlot, restoreResource, restoreSpellSlot, setCurrentHp, setExhaustion, setGold, setInspiration, setItemQuantity, shortRest, toggleCondition, toggleEquip,
  usePactSlot, useResource, useSpellSlot,
} from "../character/play";
import type { CharacterRuntime } from "../character/runtime";
import type { CharacterSource, DerivedAttack } from "../character/types";
import { castHook, type CastHook } from "../rules/effects";
import { activateFeature as activateFeatureShared, rollTotal as rollTotalShared, withEffectStart as withEffectStartShared } from "../character/activate";
import { copyText, downloadText, Modal, Notice, Pill } from "../ui/components";
import { SheetView, ValidationList, type SheetActions } from "./SheetView";

export interface SheetPlayProps {
  source: CharacterSource;
  runtime: CharacterRuntime;
  catalog: ContentCatalog;
  /** Persist a runtime, or an updater against the stored runtime (safe after an await). */
  save: (runtime: CharacterRuntime | ((current: CharacterRuntime) => CharacterRuntime)) => Promise<unknown> | void;
  /** Every roll made from this sheet (the table posts it to chat). */
  onRolled?: (result: RollResult) => void;
  savedAt?: string;
  title?: string;
  /** Header buttons (export, level up, edit, delete…) — the host screen decides. */
  actions?: ReactNode;
  /** Embedded in a journal window: no page chrome. */
  embedded?: boolean;
  /** At the table: an attack row's ⚔ hands the attack to targeting mode. */
  onAttack?: (attack: DerivedAttack) => void;
}

export function SheetPlay({ source, runtime, catalog, save, onRolled, savedAt, title = "시트", actions: headerActions, embedded = false, onAttack }: SheetPlayProps) {
  const derived = useMemo(() => deriveCharacter(source, catalog, { equipped: runtime.equipped, inventory: runtime.inventory, effects: runtime.effects }), [source, runtime, catalog]);
  const [exporting, setExporting] = useState<string | null>(null);
  const [hpInput, setHpInput] = useState("");
  const [sliderHp, setSliderHp] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [resting, setResting] = useState<{ spends: Record<string, number> } | null>(null);
  const [adding, setAdding] = useState<{ query: string; custom: string; quantity: string } | null>(null);
  const [showLog, setShowLog] = useState(true);
  const [customRoll, setCustomRoll] = useState("");
  const dice = useDice();
  const commit = (next: CharacterRuntime) => { if (next !== runtime) void save(next); };
  const rollDice = async (spec: RollSpec) => { const result = await dice.roll(spec); onRolled?.(result); return result; };
  // Rolls resolve seconds later; anything saved meanwhile (HP box, a pip) must not be overwritten, so the log line is
  // written by an updater against the stored runtime.
  const rollAndLog = async (spec: RollSpec) => { const result = await rollDice(spec); void save((current) => noteLog(current, describeRoll(result))); return result; };
  const hpPreview = applyHpCommand(runtime, derived, hpInput);
  // The slider previews while dragging and writes one log line on release.
  const commitSlider = () => { if (sliderHp !== null) { commit(setCurrentHp(runtime, derived, sliderHp)); setSliderHp(null); } };
  const submitHp = () => { if (hpPreview) { commit(hpPreview); setHpInput(""); } };

  const actions: SheetActions = {
    attack: onAttack,
    useSlot: (level) => commit(useSpellSlot(runtime, derived, level)),
    restoreSlot: (level) => commit(restoreSpellSlot(runtime, level)),
    usePactSlot: () => commit(usePactSlot(runtime, derived)),
    restorePactSlot: () => commit(restorePactSlot(runtime)),
    useResource: (resourceId) => commit(useResource(runtime, derived, resourceId)),
    restoreResource: (resourceId) => commit(restoreResource(runtime, derived, resourceId)),
    adjustGold: (delta) => commit(adjustGold(runtime, delta)),
    setGold: (gold) => commit(setGold(runtime, gold)),
    toggleEquip: (instanceId) => commit(toggleEquip(runtime, derived, instanceId)),
    setQuantity: (instanceId, quantity) => commit(setItemQuantity(runtime, derived, instanceId, quantity)),
    removeItem: (instanceId) => commit(removeItem(runtime, derived, instanceId)),
    openAddItem: () => setAdding({ query: "", custom: "", quantity: "1" }),
    roll: (label, formula, note, kind) => { void rollAndLog({ label, formula, note, kind }); },
    useFeature: (feature) => { void activateFeature(feature); },
    endEffect: (key) => commit(endEffect(runtime, key)),
    castSpell: (spell, method) => {
      const next = castSpell(runtime, derived, { id: spell.id, name: spell.name, level: spell.level, duration: spell.duration, ritual: spell.ritual }, method);
      if (!next) { alert("그 방법으로는 시전할 수 없습니다 (슬롯이나 횟수가 없습니다)."); return; }
      const slotLevel = method.kind === "slot" ? method.level : method.kind === "pact" ? derived.pactMagic?.level ?? spell.level : spell.level;
      const hook = castHook(spell, slotLevel, derived);
      commit(withEffectStart(runtime, next));
      if (hook) void applyCastHook(spell.name, hook);
    },
  };
  /** Rolls a cast's own dice (False Life temp HP, Divine Smite damage) through the overlay and applies/logs them against the stored runtime. */
  const applyCastHook = async (name: string, hook: CastHook) => {
    const lines: string[] = [];
    const logLines = (current: CharacterRuntime) => lines.splice(0).reduce((acc, line) => noteLog(acc, line), current);
    if (hook.tempHp) {
      const total = await rollTotal({ label: `${name} 임시 HP`, formula: hook.tempHp, kind: "custom" }, lines);
      await save((current) => grantTempHp(logLines(current), total));
    }
    if (hook.damage) {
      const total = await rollTotal({ label: `${name} 피해`, formula: hook.damage.formula, note: hook.damage.type, kind: "damage" }, lines);
      await save((current) => noteLog(logLines(current), `${name} 피해 ${total} ${hook.damage!.type}${hook.notes?.length ? ` (${hook.notes.join(" · ")})` : ""}`));
    } else if (hook.notes?.length) await save((current) => noteLog(current, `${name}: ${hook.notes!.join(" · ")}`));
  };
  const rollTotal = (spec: RollSpec, lines?: string[]) => rollTotalShared(rollDice, spec, lines);
  const withEffectStart = (previous: CharacterRuntime, next: CharacterRuntime) => withEffectStartShared(source, catalog, derived, previous, next);
  /** "사용": the shared activation flow (points prompt, heal/temp HP/logged dice through the overlay, applied against the stored runtime). */
  const activateFeature = async (feature: Parameters<SheetActions["useFeature"]>[0]) => {
    const outcome = await activateFeatureShared(feature, { source, catalog, derived, runtime, rollDice, save: (updater) => save(updater) });
    if (outcome === "refused") alert("남은 횟수가 없습니다.");
  };

  const text = () => serializeCharacterFile(exportCharacterFile(source, runtime, derived));
  const hpRatio = derived.hp.max ? runtime.hp.current / derived.hp.max : 0;
  const available = hitDiceAvailable(runtime, derived);
  const doShortRest = async () => {
    const plan = Object.entries(resting?.spends ?? {}).filter(([, count]) => count > 0);
    setResting(null);
    const spends: Array<{ die: string; roll: number }> = [];
    for (const [die, count] of plan) {
      const result = await rollDice({ label: `히트 다이스 ${count}${die}`, formula: `${count}${die}`, note: `건강 ${derived.abilities.con.modifier >= 0 ? "+" : ""}${derived.abilities.con.modifier} ×${count}`, kind: "hit-die" });
      for (const rolled of result.dice) spends.push({ die, roll: rolled.value });
    }
    void save((current) => shortRest(current, derived, spends));
  };
  const submitCustomRoll = () => {
    if (!parseFormula(customRoll)) return;
    void rollAndLog({ label: "주사위", formula: customRoll, kind: "custom" });
    setCustomRoll("");
  };
  const catalogMatches = adding && adding.query.trim() ? catalog.items.filter((item) => item.name.includes(adding.query.trim()) || item.nameEn.toLowerCase().includes(adding.query.trim().toLowerCase())).slice(0, 30) : [];

  return (
    <div className={embedded ? "cl-sheet-embedded" : "cl-page"}>
      <div className="cl-page-head">
        {embedded ? null : <h1>{title}</h1>}
        {savedAt ? <span className="cl-sub">저장 {new Date(savedAt).toLocaleString("ko-KR")}</span> : null}
        <div className="cl-actions">
          <button type="button" className="cl-btn" onClick={() => setExporting(text())}>JSON 내보내기</button>
          {headerActions}
        </div>
      </div>
      {derived.validation.blocking.length || derived.validation.warnings.length ? <div className="cl-card"><ValidationList derived={derived} /></div> : null}

      <div className="cl-play">
        <div className="cl-card">
          <div className="cl-row">
            <span className="cl-hp-big">{runtime.hp.current}<small> / {derived.hp.max}</small></span>
            {runtime.hp.temp ? <Pill tone="accent">임시 HP {runtime.hp.temp} <button type="button" className="cl-btn quiet small" style={{ height: 18, padding: "0 4px" }} onClick={() => commit(clearTempHp(runtime))}>✕</button></Pill> : null}
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
            <button type="button" className="cl-btn" onClick={() => { if (confirm("긴 휴식을 마칠까요? HP·슬롯·자원이 전부 회복되고 히트 다이스 절반이 돌아옵니다.")) commit(longRest(runtime, derived)); }}>긴 휴식</button>
            <span className="cl-quiet cl-small">탈진</span>
            <select className="cl-select" style={{ height: 26 }} value={runtime.exhaustion} aria-label="탈진 단계" onChange={(event) => commit(setExhaustion(runtime, Number(event.target.value)))}>
              {[0, 1, 2, 3, 4, 5, 6].map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
            <label className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" checked={runtime.heroicInspiration} onChange={(event) => commit(setInspiration(runtime, event.target.checked))} /> 영웅적 영감</label>
          </div>
          <div className="cl-row" style={{ gap: 6 }}>
            <input className="cl-input" style={{ width: 120 }} placeholder="주사위 (2d6+3)" aria-label="주사위 식" value={customRoll} onChange={(event) => setCustomRoll(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submitCustomRoll(); }} />
            <button type="button" className="cl-btn" disabled={!parseFormula(customRoll)} onClick={submitCustomRoll}>굴림</button>
            {["1d20", "1d12", "1d10", "1d8", "1d6", "1d4"].map((formula) => <button type="button" key={formula} className="cl-btn small" onClick={() => void rollAndLog({ label: "주사위", formula, kind: "custom" })}>{formula.slice(1)}</button>)}
          </div>
        </div>
        <div className="cl-card">
          <h3 className="cl-muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>진행 중인 효과 <Pill>{runtime.effects?.length ?? 0}</Pill>
            <button type="button" className="cl-btn small" style={{ marginLeft: "auto" }} disabled={!runtime.effects?.length} title="라운드가 지나면 라운드로 세는 효과가 하나씩 줄고, 다 되면 저절로 끝납니다." onClick={() => commit(advanceRound(runtime))}>다음 라운드</button>
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
                      {/* R28 (D153): "표에서 판단" is an effect whose whole rule is the text below it — the engine
                          changes no number for it. "적용됨" means the sheet really carries it. */}
                      {summary && !summary.applied ? <Pill tone="bad">수동</Pill> : summary?.narrative ? <Pill tone="accent">표에서 판단</Pill> : <Pill tone="good">적용됨</Pill>}
                      <span className="cl-quiet cl-small">{effect.rounds !== undefined ? `${effect.elapsed}/${effect.rounds} 라운드 · ` : ""}{effect.duration}</span>
                      <button type="button" className="cl-btn small danger" style={{ marginLeft: "auto" }} onClick={() => commit(endEffect(runtime, effect.key))}>종료</button>
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
            {CONDITIONS.map((condition) => <button type="button" key={condition} className={runtime.conditions.includes(condition) ? "on" : ""} onClick={() => commit(toggleCondition(runtime, condition))}>{condition}</button>)}
          </div>
          {runtime.hp.current === 0 || runtime.deathSaves.success || runtime.deathSaves.failure ? (
            <div className="cl-row" style={{ gap: 6 }}>
              <span className="cl-small">죽음 내성 성공 {runtime.deathSaves.success}/3 · 실패 {runtime.deathSaves.failure}/3</span>
              <button type="button" className="cl-btn small" onClick={() => commit(recordDeathSave(runtime, true))}>성공</button>
              <button type="button" className="cl-btn small danger" onClick={() => commit(recordDeathSave(runtime, false))}>실패</button>
              <button type="button" className="cl-btn small quiet" onClick={() => commit(resetDeathSaves(runtime))}>초기화</button>
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

      {exporting ? (
        <Modal title="JSON 내보내기" onClose={() => { setExporting(null); setCopied(null); }} actions={<>
          <button type="button" className="cl-btn" onClick={async () => setCopied((await copyText(exporting)) ? "클립보드에 복사했습니다." : "복사할 수 없습니다. 아래 텍스트를 직접 선택하세요.")}>복사</button>
          <button type="button" className="cl-btn primary" onClick={() => downloadText(`${source.name || "character"}.simplevtt.json`, exporting)}>파일로 저장</button>
        </>}>
          {copied ? <Notice tone={copied.startsWith("클립보드") ? "good" : "bad"}>{copied}</Notice> : null}
          <pre>{exporting}</pre>
        </Modal>
      ) : null}
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
        <Modal title="아이템 추가" onClose={() => setAdding(null)} actions={<button type="button" className="cl-btn primary" disabled={!adding.custom.trim()} onClick={() => { commit(addItem(runtime, { name: adding.custom.trim(), quantity: Number(adding.quantity) || 1 })); setAdding(null); }}>직접 입력한 이름으로 추가</button>}>
          <div className="cl-row">
            <input className="cl-input" style={{ flex: 1 }} placeholder="목록에서 검색 (예: 장검, potion)" aria-label="아이템 검색" value={adding.query} onChange={(event) => setAdding({ ...adding, query: event.target.value })} autoFocus />
            <input className="cl-input" style={{ width: 70 }} aria-label="수량" value={adding.quantity} onChange={(event) => setAdding({ ...adding, quantity: event.target.value })} />
          </div>
          {catalogMatches.length ? (
            <div className="cl-list" style={{ gap: 2, maxHeight: 260, overflow: "auto" }}>
              {catalogMatches.map((item) => (
                <button type="button" key={item.id} className="cl-option" onClick={() => { commit(addItem(runtime, { itemId: item.id, name: item.name, quantity: Number(adding.quantity) || 1 })); setAdding(null); }}>
                  <span className="cl-name">{item.name}</span><span className="cl-en">{item.nameEn}</span>
                  <span className="cl-summary">{item.kind}{item.weapon ? ` · ${item.weapon.damage} ${item.weapon.damageType}` : ""}{item.armor ? ` · AC ${item.armor.base}` : ""}{item.priceGp !== undefined ? ` · ${item.priceGp} GP` : ""}</span>
                </button>
              ))}
            </div>
          ) : adding.query.trim() ? <p className="cl-quiet cl-small">목록에 없습니다. 아래에 이름을 직접 적어 추가할 수 있습니다.</p> : null}
          <div className="cl-field"><label htmlFor="cl-custom-item">직접 입력</label><input id="cl-custom-item" className="cl-input" placeholder="예: 고대의 열쇠" value={adding.custom} onChange={(event) => setAdding({ ...adding, custom: event.target.value })} /></div>
        </Modal>
      ) : null}
    </div>
  );
}
