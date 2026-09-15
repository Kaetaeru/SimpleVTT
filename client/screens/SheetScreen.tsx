/**
 * A saved character as an offline session: HP with damage/heal/temp, short and long rests with hit dice, conditions,
 * death saves, inspiration, the live sheet (slots, resources, gold, bag), an activity log; plus export, edit, delete.
 */
import { useMemo, useState } from "react";
import { useClient } from "../app/context";
import { deriveCharacter } from "../character/derive";
import { exportCharacterFile, serializeCharacterFile } from "../character/json";
import {
  addItem, adjustGold, applyDamage, applyHealing, clearTempHp, CONDITIONS, grantTempHp, hitDiceAvailable, longRest, recordDeathSave, removeItem, resetDeathSaves,
  restorePactSlot, restoreResource, restoreSpellSlot, rollDie, setCurrentHp, setExhaustion, setGold, setInspiration, setItemQuantity, shortRest, toggleCondition, toggleEquip,
  usePactSlot, useResource, useSpellSlot,
} from "../character/play";
import type { CharacterRuntime } from "../character/runtime";
import { copyText, downloadText, Modal, Notice, Pill } from "../ui/components";
import { SheetView, ValidationList, type SheetActions } from "./SheetView";

export function SheetScreen({ id }: { id: string }) {
  const { catalog, characters, navigate, saveCharacter, deleteCharacter } = useClient();
  const record = characters.find((item) => item.id === id);
  const derived = useMemo(() => (record ? deriveCharacter(record.source, catalog, { equipped: record.runtime.equipped, inventory: record.runtime.inventory }) : null), [record, catalog]);
  const [exporting, setExporting] = useState<string | null>(null);
  const [hpInput, setHpInput] = useState("");
  const [tempInput, setTempInput] = useState("");
  const [resting, setResting] = useState<{ spends: Record<string, number> } | null>(null);
  const [adding, setAdding] = useState<{ query: string; custom: string; quantity: string } | null>(null);
  const [showLog, setShowLog] = useState(true);
  if (!record || !derived) return <div className="cl-page"><Notice tone="bad">캐릭터를 찾을 수 없습니다.</Notice><button type="button" className="cl-btn" onClick={() => navigate({ screen: "library" })}>라이브러리로</button></div>;
  const runtime = record.runtime;
  const commit = (next: CharacterRuntime) => { if (next !== runtime) void saveCharacter(record.source, next); };
  const hpNumber = () => { const value = Number(hpInput); return Number.isFinite(value) && hpInput.trim() ? Math.abs(Math.floor(value)) : null; };

  const actions: SheetActions = {
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
  };

  const remove = async () => {
    if (!confirm(`"${record.source.name}"을(를) 삭제할까요?`)) return;
    await deleteCharacter(record.id);
    navigate({ screen: "library" });
  };
  const text = () => serializeCharacterFile(exportCharacterFile(record.source, runtime, derived));
  const hpRatio = derived.hp.max ? runtime.hp.current / derived.hp.max : 0;
  const available = hitDiceAvailable(runtime, derived);
  const doShortRest = () => {
    const spends: Array<{ die: string; roll: number }> = [];
    for (const [die, count] of Object.entries(resting?.spends ?? {})) for (let index = 0; index < count; index += 1) spends.push({ die, roll: rollDie(die) });
    commit(shortRest(runtime, derived, spends));
    setResting(null);
  };
  const catalogMatches = adding && adding.query.trim() ? catalog.items.filter((item) => item.name.includes(adding.query.trim()) || item.nameEn.toLowerCase().includes(adding.query.trim().toLowerCase())).slice(0, 30) : [];

  return (
    <div className="cl-page">
      <div className="cl-page-head">
        <h1>시트</h1>
        <span className="cl-sub">저장 {new Date(record.savedAt).toLocaleString("ko-KR")}</span>
        <div className="cl-actions">
          <button type="button" className="cl-btn" onClick={() => setExporting(text())}>JSON 내보내기</button>
          <button type="button" className="cl-btn" onClick={() => navigate({ screen: "edit", id: record.id })}>편집 · 레벨 업</button>
          <button type="button" className="cl-btn danger" onClick={remove}>삭제</button>
          <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "library" })}>라이브러리</button>
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
          <div className="cl-row" style={{ gap: 6 }}>
            <input className="cl-input" style={{ width: 80 }} placeholder="양" aria-label="HP 양" value={hpInput} onChange={(event) => setHpInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && hpNumber() !== null) { commit(applyDamage(runtime, derived, hpNumber()!)); setHpInput(""); } }} />
            <button type="button" className="cl-btn danger" disabled={hpNumber() === null} onClick={() => { commit(applyDamage(runtime, derived, hpNumber()!)); setHpInput(""); }}>피해</button>
            <button type="button" className="cl-btn" disabled={hpNumber() === null} onClick={() => { commit(applyHealing(runtime, derived, hpNumber()!)); setHpInput(""); }}>회복</button>
            <button type="button" className="cl-btn" disabled={hpNumber() === null} onClick={() => { commit(setCurrentHp(runtime, derived, hpNumber()!)); setHpInput(""); }}>설정</button>
            <input className="cl-input" style={{ width: 70 }} placeholder="임시" aria-label="임시 HP" value={tempInput} onChange={(event) => setTempInput(event.target.value)} />
            <button type="button" className="cl-btn" disabled={!tempInput.trim() || Number.isNaN(Number(tempInput))} onClick={() => { commit(grantTempHp(runtime, Number(tempInput))); setTempInput(""); }}>임시 HP</button>
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
        <Modal title="JSON 내보내기" onClose={() => setExporting(null)} actions={<>
          <button type="button" className="cl-btn" onClick={() => void copyText(exporting)}>복사</button>
          <button type="button" className="cl-btn primary" onClick={() => downloadText(`${record.source.name || "character"}.simplevtt.json`, exporting)}>파일로 저장</button>
        </>}>
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
