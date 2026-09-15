/**
 * The tabletop (ROLL20_TABLE_SPEC.md §1–§3): the current page as a grid with a background, tokens on layers that
 * drag with snapping, select, ping (Shift+click), a right-click radial menu (bars, markers, layer, order, default
 * token, settings, duplicate, delete, lock), the page toolbar (pages strip, player ribbon, add/duplicate/settings/
 * archive/delete) and the left toolbar (layer, zoom). Players see their ribbon page and move what they control.
 */
import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useCampaigns } from "../app/campaigns";
import { useClient } from "../app/context";
import type { JournalCharacter, JournalEntry } from "../campaign/journal";
import { canEdit, canView, newJournalNpc } from "../campaign/journal";
import { deriveCharacter } from "../character/derive";
import type { RollSpec } from "../character/dice";
import { damageFormula, monsterById } from "../compendium/monsters";
import { useDice } from "../ui/dice/DiceProvider";
import type { Layer, Page, Token, TokenBar, TokenMarker } from "../campaign/page";
import { ALL_MARKERS, applyBarInput, cellDistance, clampToPage, controlsToken, isConditionMarker, MARKER_GLYPH, newPage, newToken, playerPageId, snap, tokenForEntry, tokenForNpc } from "../campaign/page";
import { toggleCondition } from "../character/play";
import { Modal, Notice } from "../ui/components";
import { ART_DRAG_TYPE, ArtImage, ArtPicker } from "./ArtPanel";

export const JOURNAL_DRAG_TYPE = "application/x-simplevtt-journal";
export const COMPENDIUM_DRAG_TYPE = "application/x-simplevtt-monster";
const ZOOMS = [0.25, 0.4, 0.5, 0.65, 0.8, 1, 1.25, 1.5, 2, 2.5];
const LAYER_KO: Record<Layer, string> = { map: "지도", objects: "토큰", gm: "GM" };
const BAR_COLORS = ["#3fb950", "#58a6ff", "#f85149"];
const LINKS: Array<[string, string]> = [["", "연결 없음"], ["hp", "hp (현재/최대 HP)"], ["temp", "temp (임시 HP)"], ["ac", "ac (AC)"], ["exhaustion", "exhaustion (탈진)"]];

function useViewer() {
  const c = useCampaigns();
  const snapshot = c.table.snapshot!;
  const role = snapshot.players.find((player) => player.userId === c.userId)?.role ?? "player";
  return { userId: c.userId, role, isGm: role === "gm", snapshot, viewer: { userId: c.userId, role } };
}

export interface CanvasHandlers {
  onOpenEntry: (id: string) => void;
  onOpenToken: (pageId: string, tokenId: string) => void;
  onOpenPageSettings: (pageId: string) => void;
}

/* ---------- Canvas ---------- */

export function PageCanvas({ onOpenEntry, onOpenToken, onOpenPageSettings }: CanvasHandlers) {
  const c = useCampaigns();
  const { isGm, snapshot, viewer } = useViewer();
  const pages = useMemo(() => [...snapshot.pages].sort((a, b) => a.order - b.order), [snapshot.pages]);
  const ribbonId = playerPageId({ playerPageId: snapshot.playerPageId, pageBookmarks: snapshot.pageBookmarks }, viewer);
  const [gmPageId, setGmPageId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [layer, setLayer] = useState<Layer>("objects");
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ tokenId: string; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ tokenId: string; startX: number; startY: number; originX: number; originY: number; x: number; y: number; snap: boolean } | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [reveal, setReveal] = useState<string | null>(null);
  const [targeting, setTargeting] = useState<TargetingState | null>(null);
  const { catalog } = useClient();
  // A token placed from the journal scrolls into view (the page centre is usually off-screen).
  useEffect(() => {
    if (!reveal) return;
    const view = viewport.current;
    const element = view?.querySelector<HTMLElement>(`[data-token-id="${reveal}"]`);
    if (!view || !element) return;
    // Scroll only the canvas viewport (not the page around it) so the toolbars stay put.
    const scaler = view.querySelector<HTMLElement>(".cl-canvas-scaler");
    const left = (scaler?.offsetLeft ?? 0) + element.offsetLeft * zoom + (element.offsetWidth * zoom) / 2 - view.clientWidth / 2;
    const top = (scaler?.offsetTop ?? 0) + element.offsetTop * zoom + (element.offsetHeight * zoom) / 2 - view.clientHeight / 2;
    view.scrollTo({ left: Math.max(0, left), top: Math.max(0, top) });
    setReveal(null);
  }, [reveal, snapshot.pages, zoom]);
  const live = pages.filter((page) => !page.archived);
  const page = isGm ? (pages.find((item) => item.id === gmPageId) ?? live.find((item) => item.id === snapshot.playerPageId) ?? live[0] ?? null) : (pages.find((item) => item.id === ribbonId) ?? null);
  useEffect(() => { if (isGm && page && page.id !== gmPageId) setGmPageId(page.id); }, [isGm, page, gmPageId]);
  const cell = page?.grid.cell ?? 70;
  const journal = snapshot.journal;
  const mayMove = (token: Token) => controlsToken(token, viewer, journal) && !token.locked && (isGm ? token.layer === layer : token.layer === "objects");

  // Keyboard: arrows move the selection one cell, Delete removes, Escape clears.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!page || !selected.length) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const delta = event.key === "ArrowLeft" ? [-1, 0] : event.key === "ArrowRight" ? [1, 0] : event.key === "ArrowUp" ? [0, -1] : event.key === "ArrowDown" ? [0, 1] : null;
      if (delta) { event.preventDefault(); for (const id of selected) { const token = page.tokens.find((item) => item.id === id); if (token && mayMove(token)) c.putToken(page.id, { ...token, ...clampToPage(page, { ...token, x: token.x + delta[0], y: token.y + delta[1] }) }); } }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); for (const id of selected) { const token = page.tokens.find((item) => item.id === id); if (token && controlsToken(token, viewer, journal)) c.removeToken(page.id, id); } setSelected([]); }
      else if (event.key === "Escape") { setSelected([]); setMenu(null); }
    };
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && targeting) { targeting.resolve([]); setTargeting(null); } };
    window.addEventListener("keydown", onEscape);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keydown", onEscape); };
  });

  const cellAt = (event: { clientX: number; clientY: number }) => {
    const box = viewport.current?.querySelector<HTMLElement>(".cl-canvas-page")?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return { x: (event.clientX - box.left) / (cell * zoom), y: (event.clientY - box.top) / (cell * zoom) };
  };
  const onPagePointerDown = (event: ReactPointerEvent) => {
    if (!page) return;
    if (event.shiftKey) { const at = cellAt(event); c.ping(page.id, at.x, at.y); return; }
    if ((event.target as HTMLElement).closest(".cl-token")) return;
    setSelected([]);
    setMenu(null);
  };
  const onTokenPointerDown = (event: ReactPointerEvent, token: Token) => {
    if (!page || event.button !== 0) return;
    if (targeting) {
      event.stopPropagation();
      if (targeting.multi && event.shiftKey) { setTargeting({ ...targeting, picked: targeting.picked.includes(token.id) ? targeting.picked.filter((id) => id !== token.id) : [...targeting.picked, token.id] }); return; }
      if (targeting.multi) { setTargeting({ ...targeting, picked: targeting.picked.includes(token.id) ? targeting.picked : [...targeting.picked, token.id] }); return; }
      targeting.resolve([token.id]);
      setTargeting(null);
      return;
    }
    if (event.shiftKey) { const at = cellAt(event); c.ping(page.id, at.x, at.y); return; }
    event.stopPropagation();
    setMenu(null);
    setSelected((list) => (event.ctrlKey || event.metaKey ? (list.includes(token.id) ? list.filter((id) => id !== token.id) : [...list, token.id]) : [token.id]));
    if (!mayMove(token)) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({ tokenId: token.id, startX: event.clientX, startY: event.clientY, originX: token.x, originY: token.y, x: token.x, y: token.y, snap: !event.altKey && page.grid.snap });
  };
  const onTokenPointerMove = (event: ReactPointerEvent) => {
    if (!drag || !page) return;
    const token = page.tokens.find((item) => item.id === drag.tokenId);
    if (!token) return;
    let x = drag.originX + (event.clientX - drag.startX) / (cell * zoom);
    let y = drag.originY + (event.clientY - drag.startY) / (cell * zoom);
    const useSnap = drag.snap && !event.altKey;
    if (useSnap) { x = snap(x, token.w); y = snap(y, token.h); }
    ({ x, y } = clampToPage(page, { ...token, x, y }));
    setDrag({ ...drag, x, y, snap: useSnap });
  };
  const onTokenPointerUp = () => {
    if (!drag || !page) return;
    const token = page.tokens.find((item) => item.id === drag.tokenId);
    if (token && (token.x !== drag.x || token.y !== drag.y)) c.putToken(page.id, { ...token, x: drag.x, y: drag.y });
    setDrag(null);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    if (!page) return;
    const at = cellAt(event);
    const journalId = event.dataTransfer.getData(JOURNAL_DRAG_TYPE);
    const artId = event.dataTransfer.getData(ART_DRAG_TYPE);
    const monsterId = event.dataTransfer.getData(COMPENDIUM_DRAG_TYPE);
    if (journalId) placeCharacter(journalId, at);
    else if (monsterId && isGm) { const monster = monsterById(monsterId); if (monster) { const count = journal.filter((entry) => entry.kind === "npc" && entry.monsterId === monster.id).length; const npc = newJournalNpc(snapshot.campaignId, viewer.userId, monster, { name: count ? `${monster.name} ${count + 1}` : monster.name }); c.putJournal(npc); placeTokenAt(tokenForNpc(npc, { x: 0, y: 0 }), at); } }
    else if (artId && isGm) { const token = newToken({ name: snapshot.art.find((asset) => asset.id === artId)?.name ?? "이미지", image: `art:${artId}`, layer, x: snap(at.x - 0.5), y: snap(at.y - 0.5) }); c.putToken(page.id, { ...token, ...clampToPage(page, token) }); }
  };
  const placeTokenAt = (token: Token, at?: { x: number; y: number }) => {
    if (!page) return;
    const spot = at ?? { x: page.width / 2, y: page.height / 2 };
    const positioned = { ...token, x: snap(spot.x - token.w / 2), y: snap(spot.y - token.h / 2) };
    const placed = { ...positioned, ...clampToPage(page, positioned), layer: isGm ? (layer === "gm" ? "gm" : "objects") : "objects", z: Math.max(0, ...page.tokens.map((item) => item.z + 1)) } as Token;
    c.putToken(page.id, placed);
    setSelected([placed.id]);
    setReveal(placed.id);
  };
  const placeCharacter = (journalId: string, at?: { x: number; y: number }) => {
    const entry = journal.find((item) => item.id === journalId);
    const token = entry ? tokenForEntry(entry, { x: 0, y: 0 }) : null;
    if (token) placeTokenAt(token, at);
  };
  const zoomBy = (direction: 1 | -1) => setZoom((current) => { const index = ZOOMS.indexOf(current); const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (index < 0 ? ZOOMS.indexOf(1) : index) + direction))]; return next; });
  const onWheel = (event: React.WheelEvent) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); zoomBy(event.deltaY < 0 ? 1 : -1); } };

  if (!page) {
    return (
      <div className="cl-canvas-empty">
        {isGm ? <><p className="cl-quiet">아직 페이지가 없습니다. 페이지를 만들면 플레이어 리본이 그 페이지에 놓입니다.</p><button type="button" className="cl-btn primary" onClick={() => addPage()}>+ 페이지</button></> : <p className="cl-quiet">GM이 아직 페이지를 열지 않았습니다. 리본이 놓이면 여기에 지도가 나타납니다.</p>}
      </div>
    );
  }
  function addPage() {
    const created = newPage(snapshot.campaignId, `페이지 ${live.length + 1}`, live.length);
    c.putPage(created);
    if (live.length === 0) c.setRibbon(created.id);
    setGmPageId(created.id);
  }
  const sortedTokens = [...page.tokens].sort((a, b) => layerOrder(a.layer) - layerOrder(b.layer) || a.z - b.z);
  const menuToken = menu ? page.tokens.find((token) => token.id === menu.tokenId) ?? null : null;
  const pageStyle = { width: page.width * cell, height: page.height * cell, background: page.background.color, backgroundImage: page.grid.enabled ? gridCss(page) : undefined, backgroundSize: page.grid.enabled ? `${cell}px ${cell}px` : undefined } as React.CSSProperties;
  return (
    <div className="cl-canvas" data-page-id={page.id}>
      {isGm ? (
        <div className="cl-page-bar">
          <div className="cl-page-strip" role="tablist" aria-label="페이지">
            {(showArchived ? pages : live).map((item) => (
              <button type="button" key={item.id} role="tab" aria-selected={item.id === page.id} className={`cl-page-chip${item.id === page.id ? " active" : ""}${item.archived ? " archived" : ""}`} onClick={() => setGmPageId(item.id)} title={item.archived ? "보관됨" : item.id === snapshot.playerPageId ? "플레이어 리본이 여기에" : undefined}>
                {item.id === snapshot.playerPageId ? <span className="cl-ribbon" aria-label="플레이어 리본">🎗</span> : null}{item.name}
                {item.id !== snapshot.playerPageId && !item.archived ? <span className="cl-ribbon-move" role="button" tabIndex={-1} title="플레이어 리본을 이 페이지로" aria-label={`리본을 ${item.name}로`} onClick={(event) => { event.stopPropagation(); c.setRibbon(item.id); }}>리본</span> : null}
              </button>
            ))}
          </div>
          <div className="cl-row" style={{ gap: 4 }}>
            <button type="button" className="cl-btn small" onClick={() => addPage()}>+ 페이지</button>
            <button type="button" className="cl-btn small" onClick={() => { const copy = { ...page, id: newPage(page.campaignId, "", 0).id, name: `${page.name} (복제)`, order: live.length, tokens: page.tokens.map((token) => ({ ...token, id: newToken({ name: "" }).id })), createdAt: new Date().toISOString() }; c.putPage({ ...copy, tokens: [] }); for (const token of copy.tokens) c.putToken(copy.id, token); setGmPageId(copy.id); }}>복제</button>
            <button type="button" className="cl-btn small" onClick={() => onOpenPageSettings(page.id)}>페이지 설정</button>
            <button type="button" className="cl-btn small" onClick={() => c.putPage({ ...page, archived: !page.archived })}>{page.archived ? "보관 해제" : "보관"}</button>
            <button type="button" className={`cl-btn small quiet${showArchived ? " active" : ""}`} onClick={() => setShowArchived((value) => !value)}>보관함</button>
            {snapshot.players.filter((player) => player.role !== "gm").length ? <SplitParty page={page} pages={live} /> : null}
          </div>
        </div>
      ) : <div className="cl-page-bar"><span className="cl-small"><strong>{page.name}</strong> <span className="cl-quiet">{page.width}×{page.height} · 1칸 = {page.scale} {page.unit}</span></span></div>}
      <div className="cl-canvas-body">
        <div className="cl-toolbar" role="toolbar" aria-label="도구">
          <button type="button" className="cl-tool active" title="선택·이동">⬚</button>
          {isGm ? (["map", "objects", "gm"] as Layer[]).map((item) => <button type="button" key={item} className={`cl-tool${layer === item ? " active" : ""}`} title={`${LAYER_KO[item]} 레이어`} aria-label={`${LAYER_KO[item]} 레이어`} aria-pressed={layer === item} onClick={() => { setLayer(item); setSelected([]); }}>{item === "map" ? "🗺" : item === "objects" ? "♟" : "👁"}</button>) : null}
          <span className="cl-tool-gap" />
          <button type="button" className="cl-tool" title="확대 (Ctrl+휠)" onClick={() => zoomBy(1)}>+</button>
          <button type="button" className="cl-tool small" title="100%" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" className="cl-tool" title="축소" onClick={() => zoomBy(-1)}>−</button>
          <button type="button" className="cl-tool" title="그리기 (R9)" disabled>✎</button>
          <button type="button" className="cl-tool" title="안개 (R9)" disabled>☁</button>
          <button type="button" className="cl-tool" title="자 (R9)" disabled>📏</button>
        </div>
        <div className={`cl-canvas-viewport${targeting ? " targeting" : ""}`} ref={viewport} onWheel={onWheel} onDragOver={(event) => { const types = [...event.dataTransfer.types]; if (types.includes(JOURNAL_DRAG_TYPE) || types.includes(ART_DRAG_TYPE)) event.preventDefault(); }} onDrop={onDrop}>
          <div className="cl-canvas-scaler" style={{ width: page.width * cell * zoom, height: page.height * cell * zoom }}>
            <div className="cl-canvas-page" style={{ ...pageStyle, transform: `scale(${zoom})` }} onPointerDown={onPagePointerDown} onContextMenu={(event) => { if (!(event.target as HTMLElement).closest(".cl-token")) event.preventDefault(); }}>
              {page.background.image ? <ArtImage src={page.background.image} className="cl-canvas-bg" /> : null}
              {sortedTokens.map((token) => (
                <TokenView key={token.id} token={token} page={page} cell={cell} selected={selected.includes(token.id)} picked={targeting?.picked.includes(token.id) ?? false} turn={snapshot.tracker.turns[snapshot.tracker.current]?.tokenId === token.id} dragging={drag?.tokenId === token.id ? drag : null} movable={mayMove(token)} journal={journal}
                  onPointerDown={(event) => onTokenPointerDown(event, token)} onPointerMove={onTokenPointerMove} onPointerUp={onTokenPointerUp}
                  onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setSelected([token.id]); const box = viewport.current!.getBoundingClientRect(); setMenu({ tokenId: token.id, x: event.clientX - box.left + viewport.current!.scrollLeft, y: event.clientY - box.top + viewport.current!.scrollTop }); }}
                  onDoubleClick={() => { if (token.represents && journal.some((entry) => entry.id === token.represents)) onOpenEntry(token.represents); else if (controlsToken(token, viewer, journal)) onOpenToken(page.id, token.id); }} />
              ))}
              {c.table.pings.filter((ping) => ping.pageId === page.id).map((ping) => <span key={ping.id} className="cl-ping" style={{ left: ping.x * cell, top: ping.y * cell, borderColor: ping.color }} aria-label="핑" />)}
            </div>
          </div>
          {menuToken ? <TokenMenu token={menuToken} page={page} at={menu!} onClose={() => setMenu(null)} onOpenToken={() => onOpenToken(page.id, menuToken.id)} onOpenEntry={onOpenEntry} /> : null}
          {targeting ? (
            <div className="cl-targeting-banner" role="status" data-multi={targeting.multi ? "1" : "0"} data-picked={targeting.picked.length}>
              <span>🎯 {targeting.prompt}</span>
              {targeting.multi ? <><span className="cl-quiet cl-small">{targeting.picked.length}개 선택</span><button type="button" className="cl-btn small primary" disabled={!targeting.picked.length} onClick={() => { targeting.resolve(targeting.picked); setTargeting(null); }}>확정</button></> : null}
              <button type="button" className="cl-btn small quiet" onClick={() => { targeting.resolve([]); setTargeting(null); }}>취소 (Esc)</button>
            </div>
          ) : null}
          {!targeting && selected.length === 1 && page.tokens.some((token) => token.id === selected[0]) ? <ActionBar token={page.tokens.find((token) => token.id === selected[0])!} page={page} onOpenEntry={onOpenEntry} /> : null}
        </div>
      </div>
      <PlaceCharacterBridge onPlace={(id) => placeCharacter(id)} onPlaceToken={(token) => placeTokenAt(token)} onTargets={(request) => { setSelected([]); setMenu(null); setTargeting({ ...request, picked: [] }); }} />
    </div>
  );
}

const layerOrder = (layer: Layer) => (layer === "map" ? 0 : layer === "objects" ? 1 : 2);

function gridCss(page: Page) {
  const color = hexWithAlpha(page.grid.color, page.grid.opacity);
  return `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`;
}
function hexWithAlpha(hex: string, alpha: number) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** Lets the journal, the compendium and the tracker reach the canvas without threading props through the table. */
interface TargetingState { prompt: string; multi: boolean; picked: string[]; resolve: (ids: string[]) => void }
const placeListeners = new Set<(id: string) => void>();
const placeTokenListeners = new Set<(token: Token) => void>();
const targetListeners = new Set<(request: Omit<TargetingState, "picked">) => void>();
export const placeCharacterToken = (journalId: string) => { for (const listener of [...placeListeners]) listener(journalId); return placeListeners.size > 0; };
export const placeToken = (token: Token) => { for (const listener of [...placeTokenListeners]) listener(token); return placeTokenListeners.size > 0; };
/** Targeting mode (§12.1): the crosshair banner appears, the promise resolves with the clicked token ids ([] when cancelled). */
export const requestTargets = (prompt: string, options: { multi?: boolean } = {}) => new Promise<string[]>((resolve) => { if (!targetListeners.size) { resolve([]); return; } for (const listener of [...targetListeners]) listener({ prompt, multi: Boolean(options.multi), resolve }); });
function PlaceCharacterBridge({ onPlace, onPlaceToken, onTargets }: { onPlace: (id: string) => void; onPlaceToken: (token: Token) => void; onTargets: (request: Omit<TargetingState, "picked">) => void }) {
  useEffect(() => { placeListeners.add(onPlace); placeTokenListeners.add(onPlaceToken); targetListeners.add(onTargets); return () => { placeListeners.delete(onPlace); placeTokenListeners.delete(onPlaceToken); targetListeners.delete(onTargets); }; }, [onPlace, onPlaceToken, onTargets]);
  return null;
}

/* ---------- Token action bar (D88): the sheet's buttons above the canvas for the selected token ---------- */

function ActionBar({ token, page, onOpenEntry }: { token: Token; page: Page; onOpenEntry: (id: string) => void }) {
  const c = useCampaigns();
  const dice = useDice();
  const { catalog } = useClient();
  const { viewer, snapshot } = useViewer();
  const entry = token.represents ? snapshot.journal.find((item) => item.id === token.represents) : undefined;
  const controls = controlsToken(token, viewer, snapshot.journal);
  const derived = useMemo(() => (entry?.kind === "character" ? deriveCharacter(entry.source, catalog, { equipped: entry.runtime.equipped, inventory: entry.runtime.inventory, effects: entry.runtime.effects }) : null), [entry, catalog]);
  if (!controls || !entry || entry.kind === "handout") return null;
  const roll = async (spec: RollSpec) => { const result = await dice.roll(spec); c.sendRoll({ formula: result.formula, total: result.total, dice: result.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: result.modifier, label: `${token.name} · ${result.label}${result.note ? ` (${result.note})` : ""}` }); };
  const d20 = (bonus: number) => `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`;
  const initiativeBonus = derived ? derived.initiative : entry.kind === "npc" ? entry.statBlock.initiativeBonus : 0;
  const inTracker = snapshot.tracker.turns.some((turn) => turn.tokenId === token.id && turn.pageId === page.id);
  return (
    <div className="cl-action-bar" role="toolbar" aria-label={`${token.name} 액션`}>
      <strong className="cl-small">{token.name}</strong>
      <button type="button" className="cl-btn small" onClick={() => c.addTurn({ name: token.name, tokenId: token.id, pageId: page.id, entryId: entry.id, image: token.image }, initiativeBonus)} title="1d20 + 이니셔티브 보너스를 굴려 트래커에 넣습니다">이니셔티브 {initiativeBonus >= 0 ? "+" : ""}{initiativeBonus}{inTracker ? " ↻" : ""}</button>
      {derived ? derived.attacks.map((attack) => (
        <span key={attack.id} className="cl-action-group">
          <button type="button" className="cl-btn small" onClick={() => void roll({ label: `${attack.name} 명중`, formula: d20(attack.attackBonus), kind: "attack" })} title="R7에서 대상 지정과 판정으로 이어집니다">{attack.name} {attack.attackBonus >= 0 ? "+" : ""}{attack.attackBonus}</button>
          <button type="button" className="cl-btn small quiet" onClick={() => void roll({ label: `${attack.name} 피해`, formula: `${attack.damage.split(" ")[0]}${attack.damageBonus ? `${attack.damageBonus > 0 ? "+" : "-"}${Math.abs(attack.damageBonus)}` : ""}`, note: attack.damageType, kind: "damage" })}>피해</button>
        </span>
      )) : null}
      {entry.kind === "npc" ? entry.statBlock.actions.filter((action) => action.kind === "attack" || action.kind === "save").map((action) => (
        <span key={action.name} className="cl-action-group">
          {action.kind === "attack" && action.attack ? <button type="button" className="cl-btn small" onClick={() => void roll({ label: `${action.name} 명중`, formula: d20(action.attack!.bonus), kind: "attack" })} disabled={Boolean(action.timing?.recharge && entry.runtime.spent[action.name])}>{action.name} {action.attack.bonus >= 0 ? "+" : ""}{action.attack.bonus}</button> : null}
          {action.kind === "save" && action.save ? <button type="button" className="cl-btn small" disabled={Boolean(action.timing?.recharge && entry.runtime.spent[action.name])} onClick={() => { const damage = action.save!.failDamage?.[0]; if (damage) void roll({ label: `${action.name} 피해`, formula: damageFormula(damage), note: `${damage.type} · DC ${action.save!.dc}`, kind: "damage" }); if (action.timing?.recharge) c.putJournal({ ...entry, runtime: { ...entry.runtime, spent: { ...entry.runtime.spent, [action.name]: true } } }); }}>{action.name} DC {action.save.dc}{action.timing?.recharge && entry.runtime.spent[action.name] ? " (재충전 대기)" : ""}</button> : null}
          {action.kind === "attack" && action.attack ? action.attack.damage.map((damage, index) => <button type="button" key={index} className="cl-btn small quiet" onClick={() => void roll({ label: `${action.name} 피해`, formula: damageFormula(damage), note: damage.type, kind: "damage" })}>피해</button>) : null}
        </span>
      )) : null}
      <button type="button" className="cl-btn small quiet" onClick={() => onOpenEntry(entry.id)}>시트</button>
    </div>
  );
}

/* ---------- Token ---------- */

function TokenView({ token, page, cell, selected, picked, turn, dragging, movable, journal, onPointerDown, onPointerMove, onPointerUp, onContextMenu, onDoubleClick }: {
  token: Token; page: Page; cell: number; selected: boolean; picked: boolean; turn: boolean; dragging: { x: number; y: number; originX: number; originY: number } | null; movable: boolean; journal: JournalEntry[];
  onPointerDown: (event: ReactPointerEvent) => void; onPointerMove: (event: ReactPointerEvent) => void; onPointerUp: () => void; onContextMenu: (event: React.MouseEvent) => void; onDoubleClick: () => void;
}) {
  const x = dragging ? dragging.x : token.x;
  const y = dragging ? dragging.y : token.y;
  const entry = token.represents ? journal.find((item) => item.id === token.represents) : undefined;
  const character = entry?.kind === "character" ? entry : undefined;
  const markers = useMemo(() => {
    // Condition markers mirror the sheet when the token represents a character we can see (D84).
    if (!character) return token.markers;
    const conditions: TokenMarker[] = character.runtime.conditions.filter((name) => isConditionMarker(name)).map((name) => ({ name }));
    return [...conditions, ...token.markers.filter((marker) => !isConditionMarker(marker.name))];
  }, [character, token.markers]);
  const bars = token.bars.map((bar, index) => ({ ...bar, color: BAR_COLORS[index] }));
  const distance = dragging ? cellDistance({ x: dragging.originX, y: dragging.originY }, { x, y }) * page.scale : 0;
  const aura = (index: 0 | 1) => { const item = token.auras[index]; if (!item || item.radius <= 0) return null; const radiusCells = item.radius / page.scale; const size = (token.w + radiusCells * 2) * cell; return <span key={index} className={`cl-aura${item.square ? " square" : ""}`} style={{ width: size, height: size, left: -radiusCells * cell, top: -radiusCells * cell, background: hexWithAlpha(item.color, 0.22), borderColor: item.color }} />; };
  return (
    <div className={`cl-token layer-${token.layer}${selected ? " selected" : ""}${picked ? " picked" : ""}${turn ? " turn" : ""}${movable ? " movable" : ""}${token.locked ? " locked" : ""}`} data-token-id={token.id} data-token-name={token.name}
      style={{ left: x * cell, top: y * cell, width: token.w * cell, height: token.h * cell, zIndex: 10 + layerOrder(token.layer) * 1000 + token.z }}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick} title={token.showName ? token.name : undefined}>
      {aura(0)}{aura(1)}
      <div className="cl-token-body" style={{ transform: `rotate(${token.rotation}deg) scaleX(${token.flipH ? -1 : 1}) scaleY(${token.flipV ? -1 : 1})` }}>
        {token.image ? <ArtImage src={token.image} className="cl-token-img" alt={token.name} /> : <span className="cl-token-initial">{(token.name || "?").slice(0, 1)}</span>}
        {token.tint ? <span className="cl-token-tint" style={{ background: token.tint }} /> : null}
      </div>
      {token.locked ? <span className="cl-token-lock" aria-label="잠김">🔒</span> : null}
      {markers.length ? <div className="cl-token-markers">{markers.slice(0, 8).map((marker) => <span key={marker.name} className="cl-marker" title={marker.name}>{MARKER_GLYPH[marker.name] ?? "•"}{marker.badge !== undefined ? <small>{marker.badge}</small> : null}</span>)}</div> : null}
      {bars.some((bar) => bar.value !== undefined || bar.max !== undefined) ? (
        <div className={`cl-token-bars ${token.barStyle.position}`}>
          {bars.map((bar, index) => (bar.value === undefined && bar.max === undefined ? null : <span key={index} className="cl-token-bar" style={{ borderColor: bar.color }} title={`바 ${index + 1}${bar.link ? ` (${bar.link})` : ""}: ${bar.value ?? "?"}${bar.max !== undefined ? ` / ${bar.max}` : ""}`}><span style={{ width: bar.max ? `${Math.max(0, Math.min(100, ((bar.value ?? 0) / bar.max) * 100))}%` : "100%", background: bar.color }} />{token.barStyle.showNumbers ? <small>{bar.value ?? "?"}{bar.max !== undefined ? `/${bar.max}` : ""}</small> : null}</span>))}
        </div>
      ) : null}
      {token.showName ? <div className="cl-token-name">{token.name}</div> : null}
      {dragging && distance > 0 ? <div className="cl-token-distance">{distance} {page.unit}</div> : null}
    </div>
  );
}

/* ---------- Radial (context) menu ---------- */

function TokenMenu({ token, page, at, onClose, onOpenToken, onOpenEntry }: { token: Token; page: Page; at: { x: number; y: number }; onClose: () => void; onOpenToken: () => void; onOpenEntry: (id: string) => void }) {
  const c = useCampaigns();
  const { isGm, viewer, snapshot } = useViewer();
  const journal = snapshot.journal;
  const controls = controlsToken(token, viewer, journal);
  const entry = token.represents ? journal.find((item) => item.id === token.represents) : undefined;
  const character = entry?.kind === "character" ? entry : undefined;
  const [barInputs, setBarInputs] = useState(["", "", ""]);
  const put = (next: Token) => c.putToken(page.id, next);
  const applyBar = (index: number) => {
    const bar = applyBarInput(token.bars[index], barInputs[index]);
    if (!bar) return;
    const bars = token.bars.map((item, at) => (at === index ? bar : item)) as Token["bars"];
    put({ ...token, bars });
    setBarInputs(["", "", ""]);
  };
  const toggleMarker = (name: string) => {
    if (character && isConditionMarker(name) && canEdit(character, viewer)) { c.putJournal({ ...character, runtime: toggleCondition(character.runtime, name), updatedAt: new Date().toISOString() }); return; }
    const has = token.markers.some((marker) => marker.name === name);
    put({ ...token, markers: has ? token.markers.filter((marker) => marker.name !== name) : [...token.markers, { name }] });
  };
  const activeMarkers = new Set([...token.markers.map((marker) => marker.name), ...(character ? character.runtime.conditions : [])]);
  const setBadge = (name: string, badge: number | undefined) => put({ ...token, markers: token.markers.map((marker) => (marker.name === name ? { ...marker, badge } : marker)) });
  const reorder = (direction: 1 | -1) => put({ ...token, z: token.z + direction });
  return (
    <div className="cl-token-menu" style={{ left: at.x, top: at.y }} role="menu" aria-label={`토큰 메뉴 ${token.name}`} onPointerDown={(event) => event.stopPropagation()}>
      <div className="cl-token-menu-head"><strong>{token.name}</strong><button type="button" className="cl-btn quiet small" aria-label="메뉴 닫기" onClick={onClose}>✕</button></div>
      {controls ? (
        <div className="cl-token-menu-bars">
          {token.bars.map((bar, index) => (bar.editable || isGm ? (
            <label key={index} className="cl-row cl-small" style={{ gap: 4 }}>
              <span className="cl-swatch" style={{ background: BAR_COLORS[index] }} /><span style={{ width: 54 }}>{bar.link ? bar.link : `바 ${index + 1}`} {bar.value ?? "–"}{bar.max !== undefined ? `/${bar.max}` : ""}</span>
              <input className="cl-input" style={{ width: 64, height: 24 }} placeholder="-5 · +3 · 12" aria-label={`바 ${index + 1} 값`} value={barInputs[index]} onChange={(event) => setBarInputs(barInputs.map((value, at) => (at === index ? event.target.value : value)))} onKeyDown={(event) => { if (event.key === "Enter") applyBar(index); }} />
              <button type="button" className="cl-btn small" onClick={() => applyBar(index)}>적용</button>
            </label>
          ) : null))}
        </div>
      ) : null}
      {controls ? (
        <div className="cl-token-menu-markers" aria-label="상태 마커">
          {ALL_MARKERS.map((name) => { const on = activeMarkers.has(name); const marker = token.markers.find((item) => item.name === name); return (
            <button type="button" key={name} className={`cl-marker-btn${on ? " on" : ""}`} title={name} aria-label={`마커 ${name}`} aria-pressed={on} onClick={() => toggleMarker(name)} onContextMenu={(event) => { event.preventDefault(); if (!on || isConditionMarker(name)) return; const answer = prompt(`${name} 뱃지 숫자 (0–9, 비우면 없음)`, marker?.badge?.toString() ?? ""); if (answer === null) return; setBadge(name, answer.trim() === "" ? undefined : Math.max(0, Math.min(9, Number(answer)))); }}>
              {MARKER_GLYPH[name]}{marker?.badge !== undefined ? <small>{marker.badge}</small> : null}
            </button>
          ); })}
        </div>
      ) : null}
      <div className="cl-token-menu-actions">
        {character && canView(character, viewer) ? <button type="button" className="cl-btn small" onClick={() => { onOpenEntry(character.id); onClose(); }}>시트 열기</button> : null}
        {controls ? <button type="button" className="cl-btn small" onClick={() => { onOpenToken(); onClose(); }}>토큰 설정</button> : null}
        {isGm ? <select className="cl-select" style={{ height: 26 }} aria-label="레이어로 이동" value={token.layer} onChange={(event) => put({ ...token, layer: event.target.value as Layer })}>{(["map", "objects", "gm"] as Layer[]).map((item) => <option key={item} value={item}>{LAYER_KO[item]} 레이어</option>)}</select> : null}
        {controls ? <><button type="button" className="cl-btn small" onClick={() => reorder(1)}>앞으로</button><button type="button" className="cl-btn small" onClick={() => reorder(-1)}>뒤로</button></> : null}
        {character && canEdit(character, viewer) ? <button type="button" className="cl-btn small" title="이 토큰의 설정을 캐릭터의 기본 토큰으로 저장" onClick={() => { const { id: _id, x: _x, y: _y, z: _z, represents: _r, ...rest } = token; c.putJournal({ ...character, defaultToken: rest, updatedAt: new Date().toISOString() }); onClose(); }}>기본 토큰으로 저장</button> : null}
        {isGm ? <button type="button" className="cl-btn small" onClick={() => { const copy = { ...token, id: newToken({ name: "" }).id, x: Math.min(page.width - token.w, token.x + 1), z: token.z + 1 }; put(copy); onClose(); }}>복제</button> : null}
        {isGm ? <button type="button" className="cl-btn small" onClick={() => put({ ...token, locked: !token.locked })}>{token.locked ? "잠금 해제" : "잠금"}</button> : null}
        {controls ? <button type="button" className="cl-btn small" onClick={() => { c.addTurn({ name: token.name, tokenId: token.id, pageId: page.id, entryId: token.represents, image: token.image }); onClose(); }} title="이니셔티브 0으로 넣습니다 (액션 줄의 '이니셔티브'는 굴려서 넣습니다)">턴 트래커에 추가</button> : null}
        {controls ? <button type="button" className="cl-btn small danger" onClick={() => { c.removeToken(page.id, token.id); onClose(); }}>삭제</button> : null}
      </div>
    </div>
  );
}

/* ---------- Split the party ---------- */

function SplitParty({ page, pages }: { page: Page; pages: Page[] }) {
  const c = useCampaigns();
  const { snapshot } = useViewer();
  const [open, setOpen] = useState(false);
  const players = snapshot.players.filter((player) => player.role !== "gm");
  return (
    <>
      <button type="button" className="cl-btn small quiet" onClick={() => setOpen(true)} title="플레이어마다 다른 페이지로 보냅니다 (Roll20 Split the Party)">파티 나누기</button>
      {open ? (
        <Modal title="파티 나누기" onClose={() => setOpen(false)}>
          <p className="cl-muted cl-small">리본은 모든 플레이어의 기본 페이지입니다. 여기서 한 사람을 다른 페이지로 보내면 그 사람만 그 페이지를 봅니다. "리본 따라가기"로 되돌립니다.</p>
          <div className="cl-list" style={{ gap: 6 }}>
            {players.map((player) => (
              <div className="cl-row cl-small" key={player.userId} style={{ gap: 6 }}>
                <span className="cl-swatch" style={{ background: player.color }} />{player.displayName}
                <select className="cl-select" style={{ height: 28, marginLeft: "auto" }} aria-label={`${player.displayName}의 페이지`} value={snapshot.pageBookmarks[player.userId] ?? ""} onChange={(event) => c.setBookmark(player.userId, event.target.value || null)}>
                  <option value="">리본 따라가기 ({pages.find((item) => item.id === snapshot.playerPageId)?.name ?? "없음"})</option>
                  {pages.map((item) => <option key={item.id} value={item.id}>{item.name}{item.id === page.id ? " (지금 보는 페이지)" : ""}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/* ---------- Token settings window ---------- */

export function TokenWindow({ pageId, tokenId, onClose }: { pageId: string; tokenId: string; onClose: () => void }) {
  const c = useCampaigns();
  const { isGm, viewer, snapshot } = useViewer();
  const page = snapshot.pages.find((item) => item.id === pageId);
  const token = page?.tokens.find((item) => item.id === tokenId);
  const [tab, setTab] = useState<"basic" | "advanced">("basic");
  const [draft, setDraft] = useState<Token | null>(token ?? null);
  const [picking, setPicking] = useState(false);
  useEffect(() => { if (token && (!draft || draft.id !== token.id)) setDraft(token); }, [token, draft]);
  if (!page || !token || !draft) return <Notice tone="warn">이 토큰은 더 없습니다.</Notice>;
  const controls = controlsToken(token, viewer, snapshot.journal);
  const characters = snapshot.journal.filter((entry): entry is JournalCharacter => entry.kind === "character");
  const players = snapshot.players.filter((player) => player.role !== "gm");
  const edit = (patch: Partial<Token>) => setDraft({ ...draft, ...patch });
  const editBar = (index: number, patch: Partial<TokenBar>) => edit({ bars: draft.bars.map((bar, at) => (at === index ? { ...bar, ...patch } : bar)) as Token["bars"] });
  const save = () => { c.putToken(page.id, draft); onClose(); };
  const controlledMode = draft.controlledBy === "inherit" ? "inherit" : draft.controlledBy === "all" ? "all" : draft.controlledBy.length === 0 ? "none" : "some";
  return (
    <div className="cl-journal-window">
      <div className="cl-sidebar-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "basic"} className={tab === "basic" ? "active" : ""} onClick={() => setTab("basic")}>기본</button>
        <button type="button" role="tab" aria-selected={tab === "advanced"} className={tab === "advanced" ? "active" : ""} onClick={() => setTab("advanced")}>고급</button>
      </div>
      {!isGm ? <p className="cl-quiet cl-small">플레이어는 위치·회전·뒤집기·마커·편집 가능한 바만 바꿀 수 있습니다. 나머지는 GM이 정합니다.</p> : null}
      {tab === "basic" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="cl-field"><label htmlFor={`tk-name-${draft.id}`}>이름</label><input id={`tk-name-${draft.id}`} className="cl-input" value={draft.name} disabled={!isGm} onChange={(event) => edit({ name: event.target.value })} /></div>
          <div className="cl-field"><label htmlFor={`tk-rep-${draft.id}`}>캐릭터 (Represents)</label><select id={`tk-rep-${draft.id}`} className="cl-select" value={draft.represents ?? ""} disabled={!isGm} onChange={(event) => edit({ represents: event.target.value || undefined, controlledBy: event.target.value ? "inherit" : [], bars: event.target.value ? [{ ...draft.bars[0], link: draft.bars[0].link ?? "hp" }, draft.bars[1], draft.bars[2]] : draft.bars })}><option value="">없음</option>{characters.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></div>
          <div className="cl-field" style={{ gridColumn: "1 / -1" }}>
            <label>고칠 수 있는 사람 (Controlled By)</label>
            <div className="cl-row" style={{ gap: 6 }}>
              <select className="cl-select" aria-label="고칠 수 있는 사람" value={controlledMode} disabled={!isGm} onChange={(event) => edit({ controlledBy: event.target.value === "inherit" ? "inherit" : event.target.value === "all" ? "all" : event.target.value === "none" ? [] : players.slice(0, 1).map((player) => player.userId) })}>
                {draft.represents ? <option value="inherit">캐릭터에서 상속</option> : null}<option value="none">없음 (GM만)</option><option value="all">모든 플레이어</option><option value="some">선택한 플레이어</option>
              </select>
              {controlledMode === "some" ? players.map((player) => <label key={player.userId} className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={Array.isArray(draft.controlledBy) && draft.controlledBy.includes(player.userId)} onChange={(event) => { const list = Array.isArray(draft.controlledBy) ? draft.controlledBy : []; edit({ controlledBy: event.target.checked ? [...list, player.userId] : list.filter((id) => id !== player.userId) }); }} /><span className="cl-swatch" style={{ background: player.color }} />{player.displayName}</label>) : null}
            </div>
          </div>
          <div className="cl-field"><label>이름표</label><label className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={draft.showName} onChange={(event) => edit({ showName: event.target.checked })} /> 이름 표시</label><label className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={draft.nameVisibleToPlayers} onChange={(event) => edit({ nameVisibleToPlayers: event.target.checked })} /> 플레이어에게 보임</label></div>
          <div className="cl-field"><label>이미지</label><div className="cl-row" style={{ gap: 6 }}><span className="cl-art-thumb" style={{ width: 40, height: 40 }}>{draft.image ? <ArtImage src={draft.image} /> : null}</span>{isGm ? <><button type="button" className="cl-btn small" onClick={() => setPicking(true)}>라이브러리에서</button>{draft.image ? <button type="button" className="cl-btn small quiet" onClick={() => edit({ image: undefined })}>지우기</button> : null}</> : null}</div></div>
          {[0, 1, 2].map((index) => { const bar = draft.bars[index]; return (
            <div className="cl-field" key={index} style={{ gridColumn: "1 / -1" }}>
              <label><span className="cl-swatch" style={{ background: BAR_COLORS[index], marginRight: 4 }} />바 {index + 1}</label>
              <div className="cl-row" style={{ gap: 6 }}>
                <input className="cl-input" style={{ width: 80 }} aria-label={`바 ${index + 1} 값`} placeholder="값" disabled={!isGm && !bar.editable} value={bar.value ?? ""} onChange={(event) => editBar(index, { value: event.target.value === "" ? undefined : Number(event.target.value) })} />
                <input className="cl-input" style={{ width: 80 }} aria-label={`바 ${index + 1} 최대`} placeholder="최대" disabled={!isGm || Boolean(bar.link)} value={bar.max ?? ""} onChange={(event) => editBar(index, { max: event.target.value === "" ? undefined : Number(event.target.value) })} />
                <select className="cl-select" aria-label={`바 ${index + 1} 연결`} disabled={!isGm || !draft.represents} value={bar.link ?? ""} onChange={(event) => editBar(index, { link: event.target.value || undefined })}>{LINKS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <label className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={bar.visible} onChange={(event) => editBar(index, { visible: event.target.checked })} /> 플레이어에게 보임</label>
                <label className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={bar.editable} onChange={(event) => editBar(index, { editable: event.target.checked })} /> 편집 가능</label>
              </div>
            </div>
          ); })}
          <div className="cl-field"><label>바 스타일</label><div className="cl-row cl-small" style={{ gap: 6 }}><select className="cl-select" aria-label="바 위치" disabled={!isGm} value={draft.barStyle.position} onChange={(event) => edit({ barStyle: { ...draft.barStyle, position: event.target.value as "above" | "below" } })}><option value="above">위</option><option value="below">아래</option></select><label className="cl-row" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={draft.barStyle.showNumbers} onChange={(event) => edit({ barStyle: { ...draft.barStyle, showNumbers: event.target.checked } })} /> 숫자 표시</label></div></div>
          <div className="cl-field"><label htmlFor={`tk-tint-${draft.id}`}>틴트</label><div className="cl-row" style={{ gap: 6 }}><input id={`tk-tint-${draft.id}`} type="color" disabled={!isGm} value={draft.tint ?? "#ffffff"} onChange={(event) => edit({ tint: event.target.value })} />{draft.tint ? <button type="button" className="cl-btn small quiet" disabled={!isGm} onClick={() => edit({ tint: undefined })}>없음</button> : <span className="cl-quiet cl-small">없음</span>}</div></div>
          {[0, 1].map((index) => { const aura = draft.auras[index]; return (
            <div className="cl-field" key={index}><label>오라 {index + 1}</label><div className="cl-row cl-small" style={{ gap: 6 }}><input className="cl-input" style={{ width: 70 }} aria-label={`오라 ${index + 1} 반지름`} disabled={!isGm} value={aura.radius || ""} placeholder={`0 ${page.unit}`} onChange={(event) => edit({ auras: draft.auras.map((item, at) => (at === index ? { ...item, radius: Number(event.target.value) || 0 } : item)) as Token["auras"] })} /><input type="color" aria-label={`오라 ${index + 1} 색`} disabled={!isGm} value={aura.color} onChange={(event) => edit({ auras: draft.auras.map((item, at) => (at === index ? { ...item, color: event.target.value } : item)) as Token["auras"] })} /><label className="cl-row" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={aura.square} onChange={(event) => edit({ auras: draft.auras.map((item, at) => (at === index ? { ...item, square: event.target.checked } : item)) as Token["auras"] })} /> 정사각</label><label className="cl-row" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={aura.visible} onChange={(event) => edit({ auras: draft.auras.map((item, at) => (at === index ? { ...item, visible: event.target.checked } : item)) as Token["auras"] })} /> 플레이어에게 보임</label></div></div>
          ); })}
          <div className="cl-field" style={{ gridColumn: "1 / -1" }}><label>상태 마커</label><div className="cl-token-menu-markers">{ALL_MARKERS.map((name) => { const on = draft.markers.some((marker) => marker.name === name); return <button type="button" key={name} className={`cl-marker-btn${on ? " on" : ""}`} title={name} aria-pressed={on} disabled={!controls} onClick={() => edit({ markers: on ? draft.markers.filter((marker) => marker.name !== name) : [...draft.markers, { name }] })}>{MARKER_GLYPH[name]}</button>; })}</div>{draft.represents ? <span className="cl-quiet cl-small">상태 이상 14종은 캐릭터 시트의 상태와 같은 것입니다 (D84). 시트에서 켜면 토큰에 나타납니다.</span> : null}</div>
          {isGm ? <div className="cl-field" style={{ gridColumn: "1 / -1" }}><label htmlFor={`tk-gm-${draft.id}`}>GM 노트</label><textarea id={`tk-gm-${draft.id}`} className="cl-textarea" rows={3} value={draft.gmNotes} onChange={(event) => edit({ gmNotes: event.target.value })} /></div> : null}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="cl-field"><label>크기 (칸)</label><div className="cl-row" style={{ gap: 6 }}><input className="cl-input" style={{ width: 70 }} aria-label="가로 칸" disabled={!isGm} value={draft.w} onChange={(event) => edit({ w: Math.max(0.25, Number(event.target.value) || 1) })} /><span className="cl-quiet">×</span><input className="cl-input" style={{ width: 70 }} aria-label="세로 칸" disabled={!isGm} value={draft.h} onChange={(event) => edit({ h: Math.max(0.25, Number(event.target.value) || 1) })} /></div></div>
          <div className="cl-field"><label htmlFor={`tk-rot-${draft.id}`}>회전 (°)</label><input id={`tk-rot-${draft.id}`} className="cl-input" style={{ width: 90 }} value={draft.rotation} onChange={(event) => edit({ rotation: Number(event.target.value) || 0 })} /></div>
          <div className="cl-field"><label>뒤집기</label><div className="cl-row cl-small" style={{ gap: 8 }}><label className="cl-row" style={{ gap: 4 }}><input type="checkbox" checked={draft.flipH} onChange={(event) => edit({ flipH: event.target.checked })} /> 가로</label><label className="cl-row" style={{ gap: 4 }}><input type="checkbox" checked={draft.flipV} onChange={(event) => edit({ flipV: event.target.checked })} /> 세로</label></div></div>
          <div className="cl-field"><label>시야 (Vision)</label><div className="cl-row cl-small" style={{ gap: 8 }}><label className="cl-row" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={draft.vision.sight} onChange={(event) => edit({ vision: { ...draft.vision, sight: event.target.checked } })} /> 시야 있음</label><input className="cl-input" style={{ width: 80 }} aria-label="시야 거리" placeholder={`거리 ${page.unit}`} disabled={!isGm} value={draft.vision.range ?? ""} onChange={(event) => edit({ vision: { ...draft.vision, range: event.target.value === "" ? undefined : Number(event.target.value) } })} /><input className="cl-input" style={{ width: 80 }} aria-label="야간 시야" placeholder="야간 시야" disabled={!isGm} value={draft.vision.nightVision ?? ""} onChange={(event) => edit({ vision: { ...draft.vision, nightVision: event.target.value === "" ? undefined : Number(event.target.value) } })} /></div><span className="cl-quiet cl-small">동적 조명(R9 이후)이 이 값을 씁니다.</span></div>
          <div className="cl-field"><label>빛 (Light)</label><div className="cl-row cl-small" style={{ gap: 8 }}><input className="cl-input" style={{ width: 80 }} aria-label="밝은 빛" placeholder="밝은 빛" disabled={!isGm} value={draft.light.bright || ""} onChange={(event) => edit({ light: { ...draft.light, bright: Number(event.target.value) || 0 } })} /><input className="cl-input" style={{ width: 80 }} aria-label="희미한 빛" placeholder="희미한 빛" disabled={!isGm} value={draft.light.dim || ""} onChange={(event) => edit({ light: { ...draft.light, dim: Number(event.target.value) || 0 } })} /><label className="cl-row" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={draft.light.visibleToPlayers} onChange={(event) => edit({ light: { ...draft.light, visibleToPlayers: event.target.checked } })} /> 플레이어에게 보임</label></div></div>
          <div className="cl-field"><label>기타</label><div className="cl-row cl-small" style={{ gap: 8 }}><label className="cl-row" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={draft.isDrawing} onChange={(event) => edit({ isDrawing: event.target.checked })} /> 그림으로 취급</label><label className="cl-row" style={{ gap: 4 }}><input type="checkbox" disabled={!isGm} checked={draft.locked} onChange={(event) => edit({ locked: event.target.checked })} /> 잠금</label></div></div>
        </div>
      )}
      <div className="cl-row" style={{ gap: 6, justifyContent: "flex-end" }}><button type="button" className="cl-btn quiet" onClick={onClose}>취소</button><button type="button" className="cl-btn primary" onClick={save}>저장</button></div>
      {picking ? <ArtPicker title="토큰 이미지" onPick={(ref) => { edit({ image: ref }); setPicking(false); }} onClose={() => setPicking(false)} /> : null}
    </div>
  );
}

/* ---------- Page settings window ---------- */

export function PageSettingsWindow({ pageId, onClose }: { pageId: string; onClose: () => void }) {
  const c = useCampaigns();
  const { snapshot } = useViewer();
  const page = snapshot.pages.find((item) => item.id === pageId);
  const [draft, setDraft] = useState<Page | null>(page ?? null);
  const [picking, setPicking] = useState(false);
  useEffect(() => { if (page && (!draft || draft.id !== page.id)) setDraft(page); }, [page, draft]);
  if (!page || !draft) return <Notice tone="warn">이 페이지는 더 없습니다.</Notice>;
  const edit = (patch: Partial<Page>) => setDraft({ ...draft, ...patch });
  const grid = (patch: Partial<Page["grid"]>) => edit({ grid: { ...draft.grid, ...patch } });
  return (
    <div className="cl-journal-window">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="cl-field" style={{ gridColumn: "1 / -1" }}><label htmlFor={`pg-name-${draft.id}`}>이름</label><input id={`pg-name-${draft.id}`} className="cl-input" value={draft.name} onChange={(event) => edit({ name: event.target.value })} /></div>
        <div className="cl-field"><label>크기 (칸)</label><div className="cl-row" style={{ gap: 6 }}><input className="cl-input" style={{ width: 80 }} aria-label="너비 칸" value={draft.width} onChange={(event) => edit({ width: Math.max(1, Math.min(200, Number(event.target.value) || 1)) })} /><span className="cl-quiet">×</span><input className="cl-input" style={{ width: 80 }} aria-label="높이 칸" value={draft.height} onChange={(event) => edit({ height: Math.max(1, Math.min(200, Number(event.target.value) || 1)) })} /></div></div>
        <div className="cl-field"><label>축척 (1칸 =)</label><div className="cl-row" style={{ gap: 6 }}><input className="cl-input" style={{ width: 80 }} aria-label="축척" value={draft.scale} onChange={(event) => edit({ scale: Math.max(0.1, Number(event.target.value) || 5) })} /><select className="cl-select" aria-label="단위" value={draft.unit} onChange={(event) => edit({ unit: event.target.value })}>{["ft", "m", "km", "mi", "칸"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></div></div>
        <div className="cl-field" style={{ gridColumn: "1 / -1" }}>
          <label>격자</label>
          <div className="cl-row cl-small" style={{ gap: 8 }}>
            <label className="cl-row" style={{ gap: 4 }}><input type="checkbox" checked={draft.grid.enabled} onChange={(event) => grid({ enabled: event.target.checked })} /> 격자 표시</label>
            <select className="cl-select" aria-label="격자 종류" value={draft.grid.type} onChange={(event) => grid({ type: event.target.value as Page["grid"]["type"] })}><option value="square">정사각</option><option value="hex-h">육각 (가로)</option><option value="hex-v">육각 (세로)</option></select>
            <input className="cl-input" style={{ width: 80 }} aria-label="칸 크기 px" value={draft.grid.cell} onChange={(event) => grid({ cell: Math.max(20, Math.min(300, Number(event.target.value) || 70)) })} /><span className="cl-quiet">px</span>
            <input type="color" aria-label="격자 색" value={draft.grid.color} onChange={(event) => grid({ color: event.target.value })} />
            <input className="cl-input" style={{ width: 70 }} aria-label="격자 불투명도" value={draft.grid.opacity} onChange={(event) => grid({ opacity: Math.max(0, Math.min(1, Number(event.target.value) || 0)) })} />
            <label className="cl-row" style={{ gap: 4 }}><input type="checkbox" checked={draft.grid.snap} onChange={(event) => grid({ snap: event.target.checked })} /> 격자에 맞춤</label>
            <label className="cl-row" style={{ gap: 4 }}><input type="checkbox" checked={draft.grid.labels} onChange={(event) => grid({ labels: event.target.checked })} /> 라벨 (A1…)</label>
          </div>
          {draft.grid.type !== "square" ? <span className="cl-quiet cl-small">육각 격자는 정사각 칸으로 그려지고 맞춤만 됩니다 (그리기 R9에서).</span> : null}
        </div>
        <div className="cl-field"><label htmlFor={`pg-bg-${draft.id}`}>배경색</label><input id={`pg-bg-${draft.id}`} type="color" value={draft.background.color} onChange={(event) => edit({ background: { ...draft.background, color: event.target.value } })} /></div>
        <div className="cl-field"><label>배경 이미지</label><div className="cl-row" style={{ gap: 6 }}><span className="cl-art-thumb" style={{ width: 40, height: 40 }}>{draft.background.image ? <ArtImage src={draft.background.image} /> : null}</span><button type="button" className="cl-btn small" onClick={() => setPicking(true)}>라이브러리에서</button>{draft.background.image ? <button type="button" className="cl-btn small quiet" onClick={() => edit({ background: { ...draft.background, image: undefined } })}>지우기</button> : null}</div></div>
        <div className="cl-field"><label>안개 (Fog of War)</label><label className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" checked={draft.fog.enabled} onChange={(event) => edit({ fog: { enabled: event.target.checked } })} /> 켜기 (R9에서 그려집니다)</label></div>
        <div className="cl-field"><label>동적 조명</label><span className="cl-quiet cl-small">이후 단계.</span></div>
      </div>
      <div className="cl-row" style={{ gap: 6 }}>
        <button type="button" className="cl-btn small danger" onClick={() => { if (confirm(`"${page.name}" 페이지를 지울까요? 토큰도 함께 사라집니다.`)) { c.removePage(page.id); onClose(); } }}>페이지 삭제</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="cl-btn quiet" onClick={onClose}>취소</button>
        <button type="button" className="cl-btn primary" onClick={() => { c.putPage(draft); onClose(); }}>저장</button>
      </div>
      {picking ? <ArtPicker title="배경 이미지" onPick={(ref) => { edit({ background: { ...draft.background, image: ref } }); setPicking(false); }} onClose={() => setPicking(false)} /> : null}
    </div>
  );
}

/** Where the journal row's drag starts: the character id travels as a journal reference. */
export function journalDragProps(entry: JournalEntry): { draggable: boolean; onDragStart?: (event: DragEvent) => void } {
  if (entry.kind !== "character") return { draggable: false };
  return { draggable: true, onDragStart: (event) => { event.dataTransfer.setData(JOURNAL_DRAG_TYPE, entry.id); event.dataTransfer.effectAllowed = "copy"; } };
}
