/**
 * The turn tracker window (ROLL20_TABLE_SPEC.md §6): rows with avatar, name and an editable initiative, the current
 * turn highlighted, ▶ 다음 턴, sort, custom rows (a "+1" formula makes a counter), clear, delete, move up/down;
 * 전투 시작 picks tokens on the canvas (targeting mode) and rolls their initiative on the host. The GM opening it
 * opens it on every screen (R27, D143); a player sees the order read-only, except their own row's initiative — the
 * one thing they used to be able to see was wrong and not touch.
 */
import { useState } from "react";
import { useCampaigns } from "../app/campaigns";
import { controlsToken } from "../campaign/page";
import { newTurn, roundCounterTurn, sortTurns, withoutTurn } from "../campaign/tracker";
import type { Tracker, TrackerTurn } from "../campaign/tracker";
import { deriveCharacter } from "../character/derive";
import { useClient } from "../app/context";
import { ArtImage } from "./ArtPanel";
import { requestTargets } from "./PageCanvas";

export function TrackerWindow({ onClose }: { onClose: () => void }) {
  const c = useCampaigns();
  const { catalog } = useClient();
  const snapshot = c.table.snapshot!;
  const isGm = snapshot.players.find((player) => player.userId === c.userId)?.role === "gm";
  const tracker = snapshot.tracker;
  const [custom, setCustom] = useState({ name: "", value: "0", formula: "" });
  const [busy, setBusy] = useState(false);
  const set = (next: Tracker) => c.setTracker(next);
  // R27 (D143): a player may fix the initiative of a row they control — the host rebuilds the row from their token.
  const controls = (turn: TrackerTurn) => {
    if (isGm) return true;
    if (turn.custom || !turn.tokenId) return false;
    const token = snapshot.pages.find((page) => page.id === turn.pageId)?.tokens.find((item) => item.id === turn.tokenId);
    return Boolean(token && controlsToken(token, { userId: c.userId, role: "player" }, snapshot.journal));
  };
  const setInitiative = (turn: TrackerTurn, initiative: number) => {
    if (isGm) { set({ ...tracker, turns: tracker.turns.map((item) => (item.id === turn.id ? { ...item, initiative } : item)) }); return; }
    c.addTurn({ name: turn.name, tokenId: turn.tokenId, pageId: turn.pageId, entryId: turn.entryId, image: turn.image, initiative });
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= tracker.turns.length) return;
    const turns = [...tracker.turns];
    [turns[index], turns[target]] = [turns[target], turns[index]];
    const currentId = tracker.turns[tracker.current]?.id;
    set({ ...tracker, turns, sorted: false, current: currentId ? turns.findIndex((item) => item.id === currentId) : tracker.current });
  };
  /** R20: drop a row onto another — the dragged turn lands at that place and the current turn follows its creature. */
  const moveTo = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= tracker.turns.length || to >= tracker.turns.length) return;
    const turns = [...tracker.turns];
    const [moved] = turns.splice(from, 1);
    turns.splice(to, 0, moved);
    const currentId = tracker.turns[tracker.current]?.id;
    set({ ...tracker, turns, sorted: false, current: currentId ? turns.findIndex((item) => item.id === currentId) : tracker.current });
  };
  const [dragging, setDragging] = useState<number | null>(null);
  /** 전투 시작: choose tokens on the canvas, roll initiative for each on the host (PC: sheet bonus; NPC: stat block). */
  const startCombat = async () => {
    setBusy(true);
    try {
      const picked = await requestTargets("전투에 넣을 토큰을 클릭하세요 (Shift로 여러 개, 확정으로 마침)", { multi: true });
      const page = snapshot.pages.find((item) => item.tokens.some((token) => picked.includes(token.id)));
      if (!page) return;
      if (!tracker.turns.some((turn) => turn.id === "turn_round")) set({ ...tracker, open: true, turns: [...tracker.turns, roundCounterTurn(tracker.round)] });
      for (const id of picked) {
        const token = page.tokens.find((item) => item.id === id);
        if (!token) continue;
        const entry = token.represents ? snapshot.journal.find((item) => item.id === token.represents) : undefined;
        const bonus = entry?.kind === "character" ? deriveCharacter(entry.source, catalog, { equipped: entry.runtime.equipped, inventory: entry.runtime.inventory, effects: entry.runtime.effects }).initiative : entry?.kind === "npc" ? entry.statBlock.initiativeBonus : 0;
        c.addTurn({ name: token.name, tokenId: token.id, pageId: page.id, entryId: entry?.id, image: token.image }, bonus);
      }
    } finally { setBusy(false); }
  };
  return (
    <div className="cl-tracker">
      <div className="cl-row" style={{ gap: 6 }}>
        <strong>라운드 {tracker.round}</strong>
        {isGm ? <>
          <button type="button" className="cl-btn small primary" disabled={!tracker.turns.length} onClick={() => c.nextTurn()} title="턴 끝 처리 → 다음 액터의 턴 시작 처리 (효과 라운드, 재충전, 죽음 내성)">▶ 다음 턴</button>
          <button type="button" className="cl-btn small" disabled={busy} onClick={() => void startCombat()}>전투 시작</button>
          <button type="button" className="cl-btn small" onClick={() => set({ ...tracker, turns: sortTurns(tracker.turns), sorted: true, current: tracker.current >= 0 ? sortTurns(tracker.turns).findIndex((item) => item.id === tracker.turns[tracker.current]?.id) : -1 })} title="이니셔티브 순 정렬">정렬 ▼</button>
          <button type="button" className="cl-btn small quiet" onClick={() => { if (!tracker.turns.length || confirm("트래커를 비울까요?")) set({ ...tracker, turns: [], current: -1, round: 1 }); }}>비우기</button>
          <button type="button" className="cl-btn small quiet" style={{ marginLeft: "auto" }} onClick={() => { set({ ...tracker, open: false }); onClose(); }}>닫기 (모두)</button>
        </> : <button type="button" className="cl-btn small quiet" style={{ marginLeft: "auto" }} onClick={onClose}>닫기</button>}
      </div>
      {tracker.turns.length === 0 ? <p className="cl-quiet cl-small">{isGm ? "토큰을 우클릭해 \"턴 트래커에 추가\"하거나, \"전투 시작\"으로 토큰을 골라 이니셔티브를 굴리세요. 다음 턴이 규칙 처리를 합니다 (효과 라운드·재충전·죽음 내성)." : "GM이 전투를 시작하면 순서가 여기에 나타납니다."}</p> : (
        <ol className="cl-tracker-list">
          {tracker.turns.map((turn, index) => (
            <li key={turn.id} className={`cl-tracker-row${index === tracker.current ? " current" : ""}${turn.custom ? " custom" : ""}${dragging === index ? " dragging" : ""}`} data-turn-name={turn.name}
              draggable={isGm} onDragStart={(event) => { setDragging(index); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(index)); }}
              onDragEnd={() => setDragging(null)}
              onDragOver={(event) => { if (isGm && dragging !== null) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } }}
              onDrop={(event) => { if (!isGm) return; event.preventDefault(); const from = dragging ?? Number(event.dataTransfer.getData("text/plain")); setDragging(null); moveTo(from, index); }}>
              <span className="cl-tracker-avatar">{turn.image ? <ArtImage src={turn.image} /> : turn.custom ? "⏱" : (turn.name || "?").slice(0, 1)}</span>
              <span className="cl-tracker-name">{turn.name}{turn.custom && turn.formula ? <span className="cl-quiet cl-small"> ({turn.formula})</span> : null}</span>
              {controls(turn) ? <input className="cl-input cl-tracker-init" aria-label={`${turn.name} 이니셔티브`} value={turn.initiative} onChange={(event) => setInitiative(turn, Number(event.target.value) || 0)} /> : <span className="cl-tracker-init">{turn.initiative}</span>}
              {isGm ? <span className="cl-row" style={{ gap: 2 }}><button type="button" className="cl-btn small quiet" aria-label="위로" onClick={() => move(index, -1)}>▲</button><button type="button" className="cl-btn small quiet" aria-label="아래로" onClick={() => move(index, 1)}>▼</button><button type="button" className="cl-btn small quiet" aria-label={`${turn.name} 삭제`} onClick={() => set(withoutTurn(tracker, turn.id))}>✕</button></span> : null}
            </li>
          ))}
        </ol>
      )}
      {isGm ? (
        <div className="cl-row cl-small" style={{ gap: 4 }}>
          <input className="cl-input" style={{ flex: 1 }} placeholder="항목 이름 (예: 용암 흐름)" aria-label="항목 이름" value={custom.name} onChange={(event) => setCustom({ ...custom, name: event.target.value })} />
          <input className="cl-input" style={{ width: 60 }} placeholder="값" aria-label="항목 값" value={custom.value} onChange={(event) => setCustom({ ...custom, value: event.target.value })} />
          <input className="cl-input" style={{ width: 60 }} placeholder="+1" aria-label="항목 공식" title="한 바퀴 돌 때마다 값에 더함 (예: +1)" value={custom.formula} onChange={(event) => setCustom({ ...custom, formula: event.target.value })} />
          <button type="button" className="cl-btn small" disabled={!custom.name.trim()} onClick={() => { set({ ...tracker, turns: [...tracker.turns, newTurn({ name: custom.name.trim(), initiative: Number(custom.value) || 0, custom: true, formula: custom.formula.trim() || undefined })] }); setCustom({ name: "", value: "0", formula: "" }); }}>+ 항목</button>
        </div>
      ) : null}
    </div>
  );
}
