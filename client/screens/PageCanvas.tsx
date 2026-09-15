/**
 * The tabletop (ROLL20_TABLE_SPEC.md §1–§3): the current page as a grid with a background, tokens on layers that
 * drag with snapping — or, on a Theatre-of-the-Mind scene (D95, the default), a board of actor icons with no
 * positions: targeting, action bars and the 벗어남 button (D96, opportunity attacks) work the same on both.
 * Grid mode as it was:
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
import type { TrackerTurn } from "../campaign/tracker";
import { ALL_MARKERS, applyBarInput, cellDistance, clampToPage, controlsToken, isConditionMarker, isScene, MARKER_GLYPH, newPage, newScene, newToken, playerPageId, snap, tokenForEntry, tokenForNpc } from "../campaign/page";
import type { Advantage, AttackOverrides } from "../rules/resolve";
import { ACTIONS, actionDef, cannotAct, hasFreeHand, npcStats, pcStats, skillBonus, SKILL_ABILITY_OF, SKILL_KO, type ActionDef } from "../rules/actions";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import { activateFeature, usableFeatures } from "../character/activate";
import { applyHealing, noteLog, setItemQuantity } from "../character/play";
import type { CharacterRuntime } from "../character/runtime";
import { resolveRuntime } from "../character/save";
import type { DerivedFeature, DerivedItem } from "../character/types";
import { itemUse } from "../rules/items";
import { castableSpells } from "../rules/spellcast";
import { describeSpellExec, spellExec } from "../compendium/spells";
import type { CastMethod } from "../character/play";
import { castOptions } from "./SheetView";
import { ApprovalLayer, ToastLayer } from "./Notify";
import { hasSmite, hasSneakAttack, npcAttackSpec, smiteSlots, weaponRange } from "../rules/attackSpec";
import type { AttackRef, AttackRiders } from "../session/protocol";
import { Modal as RiderModal } from "../ui/components";
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
  /** The DM's editable tracker window (players read the ribbon instead). */
  onOpenTracker?: () => void;
}

/* ---------- Canvas ---------- */

export function PageCanvas({ onOpenEntry, onOpenToken, onOpenPageSettings, onOpenTracker }: CanvasHandlers) {
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
  const totm = snapshot.settings.tableMode !== "grid";
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
  /** In targeting mode a click picks the token (Shift toggles in multi mode); returns true when consumed. */
  const pickTarget = (event: ReactPointerEvent, token: Token) => {
    if (!targeting) return false;
    event.stopPropagation();
    if (targeting.multi && event.shiftKey) { setTargeting({ ...targeting, picked: targeting.picked.includes(token.id) ? targeting.picked.filter((id) => id !== token.id) : [...targeting.picked, token.id] }); return true; }
    if (targeting.multi) { setTargeting({ ...targeting, picked: targeting.picked.includes(token.id) ? targeting.picked : [...targeting.picked, token.id] }); return true; }
    targeting.resolve([token.id]);
    setTargeting(null);
    return true;
  };
  const onIconPointerDown = (event: ReactPointerEvent, token: Token) => {
    if (!page || event.button !== 0) return;
    if (pickTarget(event, token)) return;
    event.stopPropagation();
    setMenu(null);
    setSelected((list) => (event.ctrlKey || event.metaKey ? (list.includes(token.id) ? list.filter((id) => id !== token.id) : [...list, token.id]) : [token.id]));
  };
  const onTokenPointerDown = (event: ReactPointerEvent, token: Token) => {
    if (!page || event.button !== 0) return;
    if (pickTarget(event, token)) return;
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
        {isGm ? <><p className="cl-quiet">{totm ? "아직 장면이 없습니다. 장면을 만들면 플레이어 리본이 그 장면에 놓입니다. 장면에는 위치와 거리가 없고, 등장하는 인물과 괴물의 아이콘만 있습니다." : "아직 페이지가 없습니다. 페이지를 만들면 플레이어 리본이 그 페이지에 놓입니다."}</p><button type="button" className="cl-btn primary" onClick={() => addPage(totm ? "scene" : "grid")}>{totm ? "+ 장면" : "+ 페이지"}</button></> : <p className="cl-quiet">GM이 아직 {totm ? "장면을" : "페이지를"} 열지 않았습니다. 리본이 놓이면 여기에 나타납니다.</p>}
      </div>
    );
  }
  function addPage(layout: "grid" | "scene" = totm ? "scene" : "grid") {
    const created = layout === "scene" ? newScene(snapshot.campaignId, `장면 ${live.length + 1}`, live.length) : newPage(snapshot.campaignId, `페이지 ${live.length + 1}`, live.length);
    c.putPage(created);
    if (live.length === 0) c.setRibbon(created.id);
    setGmPageId(created.id);
  }
  const scene = isScene(page);
  // D96: the acting token (the current turn's, else the selection) may "벗어남" from any other icon.
  const currentTurn = snapshot.tracker.turns[snapshot.tracker.current];
  const turnToken = currentTurn?.pageId === page.id ? page.tokens.find((token) => token.id === currentTurn.tokenId) : undefined;
  const acting = (turnToken && controlsToken(turnToken, viewer, journal) ? turnToken : undefined) ?? (selected.length === 1 ? page.tokens.find((token) => token.id === selected[0] && controlsToken(token, viewer, journal)) : undefined);
  // D97: the turn panel — a player's own character's turn; for the DM, the turn of anyone no player controls.
  const players = snapshot.players.filter((player) => player.role !== "gm");
  const myTurn = turnToken && (isGm ? !players.some((player) => controlsToken(turnToken, { userId: player.userId, role: "player" }, journal)) : controlsToken(turnToken, viewer, journal)) ? turnToken : undefined;
  // The command bar's creature: a creature of mine I selected on purpose (the DM runs many), else my turn's, else (a player) my only creature on the scene.
  const mine = page.tokens.filter((token) => token.represents && token.layer !== "map" && controlsToken(token, viewer, journal));
  const commandToken = (selected.length === 1 ? page.tokens.find((token) => token.id === selected[0] && token.represents && controlsToken(token, viewer, journal)) : undefined) ?? myTurn ?? (!isGm && mine.length === 1 ? mine[0] : undefined);
  const sortedTokens = [...page.tokens].sort((a, b) => layerOrder(a.layer) - layerOrder(b.layer) || a.z - b.z);
  const rangeOf = (token: Token): "in" | "long" | "out" | null => {
    if (!targeting?.from || isScene(page)) return null;
    const from = page.tokens.find((item) => item.id === targeting.from!.tokenId);
    if (!from || from.id === token.id) return null;
    const feet = Math.max(0, cellDistance({ x: from.x + from.w / 2, y: from.y + from.h / 2 }, { x: token.x + token.w / 2, y: token.y + token.h / 2 }) - (from.w + token.w) / 2 + 1) * page.scale;
    return feet <= targeting.from.rangeFeet ? "in" : targeting.from.longRangeFeet !== undefined && feet <= targeting.from.longRangeFeet ? "long" : "out";
  };
  const menuToken = menu ? page.tokens.find((token) => token.id === menu.tokenId) ?? null : null;
  const pageStyle = { width: page.width * cell, height: page.height * cell, background: page.background.color, backgroundImage: page.grid.enabled ? gridCss(page) : undefined, backgroundSize: page.grid.enabled ? `${cell}px ${cell}px` : undefined } as React.CSSProperties;
  return (
    <div className={`cl-canvas${scene ? " scene-mode" : ""}${targeting ? " is-targeting" : ""}${myTurn ? " my-turn" : ""}${snapshot.tracker.turns.length ? " has-tracker" : ""}`} data-page-id={page.id}>
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
            <button type="button" className="cl-btn small" onClick={() => addPage(totm ? "scene" : "grid")}>{totm ? "+ 장면" : "+ 페이지"}</button>
            <Dropdown label="⋯" items={[
              { key: "other", label: totm ? "+ 격자 페이지" : "+ 장면", hint: totm ? "위치·거리를 추적하는 지도" : "위치 없는 장면", onSelect: () => addPage(totm ? "grid" : "scene") },
              { key: "settings", label: "페이지 설정", hint: "이름·배경 그림·격자", onSelect: () => onOpenPageSettings(page.id) },
              { key: "dup", label: "복제", onSelect: () => { const copy = { ...page, id: newPage(page.campaignId, "", 0).id, name: `${page.name} (복제)`, order: live.length, tokens: page.tokens.map((token) => ({ ...token, id: newToken({ name: "" }).id })), createdAt: new Date().toISOString() }; c.putPage({ ...copy, tokens: [] }); for (const token of copy.tokens) c.putToken(copy.id, token); setGmPageId(copy.id); } },
              { key: "archive", label: page.archived ? "보관 해제" : "보관", onSelect: () => c.putPage({ ...page, archived: !page.archived }) },
              { key: "archived", label: showArchived ? "보관함 숨기기" : "보관함 보기", onSelect: () => setShowArchived((value) => !value) },
              ...(scene ? [{ key: "layer", label: layer === "gm" ? "토큰 레이어에 놓기" : "GM 레이어에 놓기 (플레이어에게 숨김)", hint: "새로 놓는 토큰의 레이어", onSelect: () => setLayer(layer === "gm" ? "objects" : "gm") }] : []),
            ]} />
            {snapshot.players.filter((player) => player.role !== "gm").length ? <SplitParty page={page} pages={live} /> : null}
          </div>
        </div>
      ) : scene ? null : <div className="cl-page-bar"><span className="cl-small"><strong>{page.name}</strong> <span className="cl-quiet">{page.width}×{page.height} · 1칸 = {page.scale} {page.unit}</span></span></div>}
      {!scene && myTurn ? <TurnPanel token={myTurn} page={page} onOpenEntry={onOpenEntry} /> : null}
      <div className="cl-canvas-body">
        <ToastLayer boardShowsResults={scene} />
        <ApprovalLayer />
        {snapshot.tracker.turns.length ? <TurnRibbon page={page} onOpenTracker={onOpenTracker} /> : null}
        {scene ? null : (
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
        )}
        <div className={`cl-canvas-viewport${targeting ? " targeting" : ""}${scene ? " scene" : ""}`} ref={viewport} onWheel={scene ? undefined : onWheel} onDragOver={(event) => { const types = [...event.dataTransfer.types]; if (types.includes(JOURNAL_DRAG_TYPE) || types.includes(ART_DRAG_TYPE) || types.includes(COMPENDIUM_DRAG_TYPE)) event.preventDefault(); }} onDrop={onDrop}>
          {scene ? (
            <SceneBoard page={page} tokens={sortedTokens} selected={selected} targeting={targeting} turnTokenId={turnToken?.id} acting={acting} journal={journal} isGm={isGm}
              onPointerDown={onIconPointerDown} onPointerDownBoard={() => { setSelected([]); setMenu(null); }}
              onContextMenu={(event, token) => { event.preventDefault(); event.stopPropagation(); setSelected([token.id]); const box = viewport.current!.getBoundingClientRect(); setMenu({ tokenId: token.id, x: event.clientX - box.left + viewport.current!.scrollLeft, y: event.clientY - box.top + viewport.current!.scrollTop }); }}
              onDoubleClick={(token) => { if (token.represents && journal.some((entry) => entry.id === token.represents)) onOpenEntry(token.represents); else if (controlsToken(token, viewer, journal)) onOpenToken(page.id, token.id); }}
              onLeave={(token) => { if (acting) c.provoke({ entryId: acting.represents, pageId: page.id, tokenId: acting.id }, { entryId: token.represents, pageId: page.id, tokenId: token.id }); }} />
          ) : (
          <div className="cl-canvas-scaler" style={{ width: page.width * cell * zoom, height: page.height * cell * zoom }}>
            <div className="cl-canvas-page" style={{ ...pageStyle, transform: `scale(${zoom})` }} onPointerDown={onPagePointerDown} onContextMenu={(event) => { if (!(event.target as HTMLElement).closest(".cl-token")) event.preventDefault(); }}>
              {page.background.image ? <ArtImage src={page.background.image} className="cl-canvas-bg" /> : null}
              {sortedTokens.map((token) => (
                <TokenView key={token.id} token={token} page={page} cell={cell} selected={selected.includes(token.id)} picked={targeting?.picked.includes(token.id) ?? false} range={rangeOf(token)} turn={snapshot.tracker.turns[snapshot.tracker.current]?.tokenId === token.id} dragging={drag?.tokenId === token.id ? drag : null} movable={mayMove(token)} journal={journal}
                  onPointerDown={(event) => onTokenPointerDown(event, token)} onPointerMove={onTokenPointerMove} onPointerUp={onTokenPointerUp}
                  onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setSelected([token.id]); const box = viewport.current!.getBoundingClientRect(); setMenu({ tokenId: token.id, x: event.clientX - box.left + viewport.current!.scrollLeft, y: event.clientY - box.top + viewport.current!.scrollTop }); }}
                  onDoubleClick={() => { if (token.represents && journal.some((entry) => entry.id === token.represents)) onOpenEntry(token.represents); else if (controlsToken(token, viewer, journal)) onOpenToken(page.id, token.id); }} />
              ))}
              {c.table.pings.filter((ping) => ping.pageId === page.id).map((ping) => <span key={ping.id} className="cl-ping" style={{ left: ping.x * cell, top: ping.y * cell, borderColor: ping.color }} aria-label="핑" />)}
            </div>
          </div>
          )}
          {menuToken ? <TokenMenu token={menuToken} page={page} at={menu!} onClose={() => setMenu(null)} onOpenToken={() => onOpenToken(page.id, menuToken.id)} onOpenEntry={onOpenEntry} /> : null}
          {targeting ? (
            <div className="cl-targeting-banner" role="status" data-multi={targeting.multi ? "1" : "0"} data-picked={targeting.picked.length}>
              <span className="cl-targeting-icon" aria-hidden="true">🎯</span>
              <span className="cl-targeting-text"><strong>{targeting.prompt}</strong><small>{targeting.multi ? "여러 대상은 Shift+클릭 · Esc 취소" : "Esc 취소"}</small></span>
              {targeting.multi ? <><span className="cl-quiet cl-small">{targeting.picked.length}개 선택</span><button type="button" className="cl-btn primary" disabled={!targeting.picked.length} onClick={() => { targeting.resolve(targeting.picked); setTargeting(null); }}>확정</button></> : null}
              <button type="button" className="cl-btn quiet" onClick={() => { targeting.resolve([]); setTargeting(null); }}>취소</button>
            </div>
          ) : null}
          {!scene && !targeting && selected.length === 1 && page.tokens.some((token) => token.id === selected[0]) ? <ActionBar token={page.tokens.find((token) => token.id === selected[0])!} page={page} onOpenEntry={onOpenEntry} /> : null}
        </div>
      </div>
      {scene && commandToken ? <CommandBar token={commandToken} page={page} mode={myTurn && commandToken.id === myTurn.id ? "turn" : "free"} onOpenEntry={onOpenEntry} /> : null}
      <AttackAskBridge />
      <ActAskBridge />
      <CastAskBridge />
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
interface TargetingState { prompt: string; multi: boolean; picked: string[]; resolve: (ids: string[]) => void; /** Attacker token and range (ft): tokens beyond are dimmed. */ from?: { tokenId: string; rangeFeet: number; longRangeFeet?: number }; /** The actor: never a candidate. */ exclude?: string }
const placeListeners = new Set<(id: string) => void>();
const placeTokenListeners = new Set<(token: Token) => void>();
const targetListeners = new Set<(request: Omit<TargetingState, "picked">) => void>();
export const placeCharacterToken = (journalId: string) => { for (const listener of [...placeListeners]) listener(journalId); return placeListeners.size > 0; };
export const placeToken = (token: Token) => { for (const listener of [...placeTokenListeners]) listener(token); return placeTokenListeners.size > 0; };
/** Targeting mode (§12.1): the crosshair banner appears, the promise resolves with the clicked token ids ([] when cancelled). */
export const requestTargets = (prompt: string, options: { multi?: boolean; from?: TargetingState["from"]; exclude?: string } = {}) => new Promise<string[]>((resolve) => { if (!targetListeners.size) { resolve([]); return; } for (const listener of [...targetListeners]) listener({ prompt, multi: Boolean(options.multi), resolve, from: options.from, exclude: options.exclude }); });
function PlaceCharacterBridge({ onPlace, onPlaceToken, onTargets }: { onPlace: (id: string) => void; onPlaceToken: (token: Token) => void; onTargets: (request: Omit<TargetingState, "picked">) => void }) {
  useEffect(() => { placeListeners.add(onPlace); placeTokenListeners.add(onPlaceToken); targetListeners.add(onTargets); return () => { placeListeners.delete(onPlace); placeTokenListeners.delete(onPlaceToken); targetListeners.delete(onTargets); }; }, [onPlace, onPlaceToken, onTargets]);
  return null;
}


/** ⚔: pick targets (range dims tokens on a grid, never on a scene), the pre-roll dialog (riders; the DM's 유리/불리·엄폐·반드시 — D95), then the host resolves (§12.2). Shared by the action bar and the turn panel. */
function makeAttackWith({ c, token, page, entry, derived, isGm }: { c: ReturnType<typeof useCampaigns>; token: Token; page: Page; entry: JournalEntry; derived: ReturnType<typeof deriveCharacter> | null; isGm: boolean }) {
  return async (ref: AttackRef) => {
    const range = ref.source === "weapon" && derived ? weaponRange(derived.attacks.find((item) => item.id === ref.attackId)!) : ref.source === "npc" && entry.kind === "npc" ? (() => { const spec = npcAttackSpec(entry, ref.actionName); return spec ? { rangeFeet: spec.rangeFeet ?? 5, longRangeFeet: spec.longRangeFeet } : null; })() : null;
    const name = ref.source === "weapon" && derived ? derived.attacks.find((item) => item.id === ref.attackId)!.name : ref.source === "npc" ? ref.actionName : "공격";
    const targets = await requestTargets(`${name} — 대상을 클릭하세요`, { multi: true, exclude: token.id, from: range && !isScene(page) ? { tokenId: token.id, rangeFeet: range.rangeFeet, longRangeFeet: range.longRangeFeet } : undefined });
    if (!targets.length) return;
    let sneak = false;
    let slots: Array<{ level: number; free: number }> = [];
    if (ref.source === "weapon" && derived && entry.kind === "character") {
      const attack = derived.attacks.find((item) => item.id === ref.attackId)!;
      sneak = hasSneakAttack(derived, attack);
      slots = hasSmite(derived) ? smiteSlots(derived, entry.runtime) : [];
    }
    let answer: AttackAnswer | null | undefined;
    if (isGm || sneak || slots.length) { answer = await requestAttackOptions({ name, sneak, slots, gm: isGm }); if (answer === null) return; }
    c.attack({ entryId: entry.id, pageId: page.id, tokenId: token.id }, targets.map((id) => ({ pageId: page.id, tokenId: id })), ref, answer?.riders, { overrides: answer?.overrides });
  };
}

/* ---------- Turn panel (D97): the official actions on your turn ---------- */

interface ActAsk { def: ActionDef; gm: boolean; resolve: (answer: ActAnswer | null) => void }
interface ActAnswer { skill?: string; dc?: number; note?: string; choice?: string }
const actAskListeners = new Set<(ask: ActAsk) => void>();
const requestActOptions = (ask: Omit<ActAsk, "resolve">) => new Promise<ActAnswer | null>((resolve) => { if (!actAskListeners.size) { resolve({}); return; } for (const listener of [...actAskListeners]) listener({ ...ask, resolve }); });
function ActAskBridge() {
  const [ask, setAsk] = useState<ActAsk | null>(null);
  useEffect(() => { actAskListeners.add(setAsk); return () => { actAskListeners.delete(setAsk); }; }, []);
  return ask ? <ActDialog ask={ask} onDone={(answer) => { ask.resolve(answer); setAsk(null); }} /> : null;
}

/** Skill, DC (DM), free text or the 밀치기 choice for an action that needs one. */
function ActDialog({ ask, onDone }: { ask: ActAsk; onDone: (answer: ActAnswer | null) => void }) {
  const [skill, setSkill] = useState(ask.def.skills?.[0] ?? "");
  const [dc, setDc] = useState("");
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState(ask.def.choice?.[0]?.value ?? "");
  return (
    <RiderModal title={`${ask.def.name} (${ask.def.en})`} onClose={() => onDone(null)} actions={<button type="button" className="cl-btn primary" onClick={() => onDone({ skill: skill || undefined, dc: dc.trim() ? Number(dc) : undefined, note: note.trim() || undefined, choice: choice || undefined })}>{ask.def.name}</button>}>
      <p className="cl-quiet cl-small">{ask.def.summary}</p>
      {ask.def.skills && ask.def.skills.length > 1 ? <div className="cl-field"><label htmlFor="cl-act-skill">기술</label><select id="cl-act-skill" className="cl-select" value={skill} onChange={(event) => setSkill(event.target.value)}>{ask.def.skills.map((id) => <option key={id} value={id}>{ABILITY_KO[SKILL_ABILITY_OF[id]]}({SKILL_KO[id]})</option>)}</select></div> : null}
      {ask.def.choice ? <div className="cl-field"><label htmlFor="cl-act-choice">방식</label><select id="cl-act-choice" className="cl-select" value={choice} onChange={(event) => setChoice(event.target.value)}>{ask.def.choice.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div> : null}
      {ask.def.text ? <div className="cl-field"><label htmlFor="cl-act-note">{ask.def.text}</label><input id="cl-act-note" className="cl-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder={ask.def.kind === "ready" ? "예: 문이 열리면 → 활을 쏜다" : ""} /></div> : null}
      {ask.gm && (ask.def.skills || ask.def.kind === "escape") ? <div className="cl-field"><label htmlFor="cl-act-dc">DC (비우면 기본)</label><input id="cl-act-dc" className="cl-input" style={{ width: 90 }} value={dc} onChange={(event) => setDc(event.target.value)} placeholder={ask.def.kind === "hide" || ask.def.kind === "influence" ? "15" : "—"} /></div> : null}
    </RiderModal>
  );
}

/** A small popover menu: one button, a list of choices with hints; closes on choice, Esc or a click outside. */
function Dropdown({ label, items, disabled, tone, up = false }: { label: string; items: Array<{ key: string; label: string; hint?: string; disabled?: boolean; onSelect: () => void }>; disabled?: boolean; tone?: "primary"; /** Open above the button (menus on the command bar at the bottom of the board). */ up?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className={`cl-dd${up ? " up" : ""}`} ref={box}>
      <button type="button" className={`cl-btn small${tone === "primary" ? " primary" : ""}${open ? " active" : ""}`} aria-haspopup="menu" aria-expanded={open} disabled={disabled || !items.length} onClick={() => setOpen((value) => !value)}>{label} ▾</button>
      {open ? (
        <div className="cl-dd-menu" role="menu" aria-label={label}>
          {items.map((item) => <button type="button" key={item.key} role="menuitem" className="cl-dd-item" disabled={item.disabled} title={item.hint} onClick={() => { setOpen(false); item.onSelect(); }}><span>{item.label}</span>{item.hint ? <small>{item.hint}</small> : null}</button>)}
        </div>
      ) : null}
    </div>
  );
}

interface CastAsk { name: string; options: Array<{ label: string; method: CastMethod }>; resolve: (method: CastMethod | null) => void }
const castAskListeners = new Set<(ask: CastAsk) => void>();
const requestCastMethod = (ask: Omit<CastAsk, "resolve">) => new Promise<CastMethod | null>((resolve) => { if (!castAskListeners.size) { resolve(ask.options[0]?.method ?? null); return; } for (const listener of [...castAskListeners]) listener({ ...ask, resolve }); });
function CastAskBridge() {
  const [ask, setAsk] = useState<CastAsk | null>(null);
  useEffect(() => { castAskListeners.add(setAsk); return () => { castAskListeners.delete(setAsk); }; }, []);
  if (!ask) return null;
  return (
    <RiderModal title={`${ask.name} — 어떻게 시전할까요`} onClose={() => { ask.resolve(null); setAsk(null); }}>
      <div className="cl-list" style={{ gap: 6 }}>{ask.options.map((option) => <button type="button" key={option.label} className="cl-btn primary" onClick={() => { ask.resolve(option.method); setAsk(null); }}>{option.label}</button>)}</div>
    </RiderModal>
  );
}

/**
 * The command bar (D100): the one place to act on a scene. In "turn" mode it is the loudest thing on screen —
 * "당신의 턴", the attacks in red, the action list, the sheet menus and a big 턴 마침. In "free" mode (someone else's
 * turn, or no combat) it is quiet and only what the rules allow out of turn stays enabled.
 */
function CommandBar({ token, page, mode, onOpenEntry }: { token: Token; page: Page; mode: "turn" | "free"; onOpenEntry: (id: string) => void }) {
  const c = useCampaigns();
  const dice = useDice();
  const { catalog } = useClient();
  const { snapshot, isGm } = useViewer();
  const entry = token.represents ? snapshot.journal.find((item) => item.id === token.represents) : undefined;
  const derived = useMemo(() => (entry?.kind === "character" ? deriveCharacter(entry.source, catalog, { equipped: entry.runtime.equipped, inventory: entry.runtime.inventory, effects: entry.runtime.effects }) : null), [entry, catalog]);
  const latest = useRef<{ runtime: CharacterRuntime; sentAt: string } | null>(null);
  if (!entry || entry.kind === "handout") return null;
  const tracker = snapshot.tracker;
  const turn = tracker.turns[tracker.current];
  const inCombat = tracker.turns.length > 0;
  const attackWith = makeAttackWith({ c, token, page, entry, derived, isGm });
  const me = { entryId: entry.id, pageId: page.id, tokenId: token.id };
  const conditions = new Set([...(entry.runtime.conditions ?? []), ...token.markers.map((marker) => marker.name)]);
  const blocked = cannotAct([...conditions]);
  // Out of turn during combat a player may only roll checks and read the sheet; the DM may do anything.
  const off = Boolean(blocked) || (mode === "free" && inCombat && !isGm);
  const freeHand = derived ? hasFreeHand(derived.inventory) : true;
  const rollToChat = async (spec: RollSpec) => { const result = await dice.roll(spec); c.sendRoll({ formula: result.formula, total: result.total, dice: result.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: result.modifier, label: `${token.name} · ${result.label}${result.note ? ` (${result.note})` : ""}` }); return result; };
  const d20 = (bonus: number) => `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`;
  const currentRuntime = () => (entry.kind === "character" && latest.current && latest.current.sentAt > entry.updatedAt ? latest.current.runtime : (entry as JournalCharacter).runtime);
  const saveRuntime = (input: (current: CharacterRuntime) => CharacterRuntime) => {
    if (entry.kind !== "character") return;
    const runtime = { ...resolveRuntime(entry.source, catalog, currentRuntime(), input), updatedAt: new Date().toISOString() };
    const sentAt = new Date().toISOString();
    latest.current = { runtime, sentAt };
    c.putJournal({ ...entry, runtime, updatedAt: sentAt });
  };
  const take = async (def: ActionDef, bonus = false) => {
    let target: string | undefined;
    if (def.target) {
      const picked = await requestTargets(`${def.name} — ${def.target === "ally" ? "도울 아군" : def.kind === "escape" ? "붙잡은 상대" : "대상"}을 클릭하세요`, { multi: false, exclude: token.id });
      if (!picked.length) return;
      target = picked[0];
    }
    let answer: ActAnswer | null | undefined = {};
    if ((def.skills && def.skills.length > 1) || def.text || def.choice || (isGm && (def.skills || def.kind === "escape"))) { answer = await requestActOptions({ def, gm: isGm }); if (answer === null) return; }
    c.act(me, def.kind, { target: target ? { pageId: page.id, tokenId: target } : undefined, skill: answer?.skill ?? def.skills?.[0], dc: answer?.dc, note: answer?.note, choice: answer?.choice, bonus });
  };
  const stats = entry.kind === "npc" ? npcStats(entry.statBlock) : derived ? pcStats(derived) : null;
  const checkItems = stats ? [
    ...ABILITY_KEYS.map((key) => ({ key: `save:${key}`, label: `${ABILITY_KO[key]} 내성`, hint: `${stats.saves[key] >= 0 ? "+" : ""}${stats.saves[key]}`, onSelect: () => void rollToChat({ label: `${ABILITY_KO[key]} 내성`, formula: d20(stats.saves[key]), kind: "save" }) })),
    ...Object.keys(SKILL_KO).map((id) => { const bonus = skillBonus(stats, id); return { key: `skill:${id}`, label: `${ABILITY_KO[SKILL_ABILITY_OF[id]]}(${SKILL_KO[id]})`, hint: `${bonus >= 0 ? "+" : ""}${bonus}`, onSelect: () => void rollToChat({ label: `${ABILITY_KO[SKILL_ABILITY_OF[id]]}(${SKILL_KO[id]})`, formula: d20(bonus), kind: "check" }) }; }),
  ] : [];
  const usable = entry.kind === "character" && derived ? usableFeatures(derived, entry.runtime) : [];
  const useIt = async (feature: DerivedFeature) => {
    if (entry.kind !== "character" || !derived) return;
    const outcome = await activateFeature(feature, { source: entry.source, catalog, derived, runtime: currentRuntime(), rollDice: rollToChat, save: saveRuntime });
    if (outcome === "refused") alert("남은 횟수가 없습니다.");
    if (outcome === "done") c.say(`/em ${token.name}: ${feature.name} 사용`);
  };
  const featureItems = entry.kind === "npc"
    ? entry.statBlock.traits.map((trait) => ({ key: trait.name, label: trait.name, hint: trait.text.slice(0, 60), onSelect: () => c.say(`/em ${token.name}: ${trait.name}`) }))
    : usable.filter((item) => !item.bonus).map((item) => ({ key: item.feature.id, label: item.feature.name, hint: item.left !== undefined ? `${item.left}/${item.pool!.max}${item.activation.note ? ` · ${item.activation.note}` : ""}` : item.activation.note, disabled: item.left !== undefined && item.left <= 0, onSelect: () => void useIt(item.feature) }));
  const items = entry.kind === "character" && derived ? derived.inventory.filter((item) => item.quantity > 0 && !["weapon", "armor", "shield"].includes(item.kind)) : [];
  const useItem = async (item: DerivedItem) => {
    if (entry.kind !== "character" || !derived) return;
    const use = itemUse(item);
    let healed: number | undefined;
    if (use.heal) healed = (await rollToChat({ label: use.text, formula: use.heal, note: "회복", kind: "custom" })).total;
    saveRuntime((current) => { let next = noteLog(current, `${use.text}${healed !== undefined ? ` — ${healed} 회복` : ""}`); if (healed !== undefined) next = applyHealing(next, derived, healed); if (use.consumes) next = setItemQuantity(next, derived, item.instanceId, item.quantity - 1); return next; });
    c.say(`/em ${token.name}: ${use.text}${healed !== undefined ? ` (${healed} 회복)` : ""}`);
  };
  const itemItems = items.map((item) => ({ key: item.instanceId, label: item.name, hint: `${item.quantity > 1 ? `×${item.quantity} · ` : ""}${itemUse(item).heal ? `회복 ${itemUse(item).heal}` : itemUse(item).consumes ? "소모" : "기록"}`, onSelect: () => void useItem(item) }));
  const bonusItems = [
    ...(entry.kind === "npc" ? entry.statBlock.bonusActions.map((action) => ({ key: action.name, label: `${action.kind === "attack" && action.attack ? "⚔ " : ""}${action.name}`, hint: action.text?.slice(0, 60), onSelect: () => { if (action.kind === "attack" && action.attack) void attackWith({ source: "npc", actionName: action.name }); else c.act(me, "utilize", { note: action.name, bonus: true }); } })) : []),
    ...usable.filter((item) => item.bonus).map((item) => ({ key: item.feature.id, label: item.feature.name, hint: item.left !== undefined ? `${item.left}/${item.pool!.max}` : undefined, disabled: item.left !== undefined && item.left <= 0, onSelect: () => void useIt(item.feature) })),
    { key: "note", label: "기록…", hint: "다른 추가 행동을 쓴 것으로 남김", onSelect: () => void take({ ...actionDef("utilize"), name: "추가 행동", text: "무엇을" }, true) },
  ];
  // 마법 (D102): the sheet's castable spells or the stat block's lists; targets from the board, the slot from a dialog.
  const castIt = async (spellId: string, name: string) => {
    const exec = spellExec(spellId);
    if (!exec) return;
    const selfOnly = exec.targeting.allowedRelations?.every((relation) => relation === "self");
    let targets: string[] = selfOnly ? [token.id] : [];
    if (!selfOnly) {
      targets = await requestTargets(`${name} — 대상을 클릭하세요${exec.targeting.maxTargets > 1 ? ` (최대 ${exec.targeting.maxTargets >= 64 ? "범위 안 전부" : `${exec.targeting.maxTargets}명`})` : ""}`, { multi: exec.targeting.maxTargets > 1, exclude: exec.targeting.allowedRelations?.includes("self") ? undefined : token.id });
      if (!targets.length) return;
      if (targets.length > exec.targeting.maxTargets) targets = targets.slice(0, exec.targeting.maxTargets);
    }
    let method: CastMethod | undefined;
    if (entry.kind === "character" && derived) {
      const view = catalog.spellById(spellId);
      const options = view ? castOptions(view, derived, currentRuntime()) : [];
      if (!options.length) { alert("슬롯이나 횟수가 없습니다."); return; }
      const chosen = options.length === 1 ? options[0].method : await requestCastMethod({ name, options });
      if (!chosen) return;
      method = chosen;
    }
    let overrides: AttackOverrides | undefined;
    if (isGm && exec.primary.kind === "attack-damage") { const answer = await requestAttackOptions({ name, sneak: false, slots: [], gm: true }); if (answer === null) return; overrides = answer.overrides; }
    c.cast(me, spellId, targets.map((id) => ({ pageId: page.id, tokenId: id })), method, overrides);
  };
  const spellItems = entry.kind === "character" && derived
    ? castableSpells(derived).map((id) => ({ id, view: catalog.spellById(id), exec: spellExec(id)! })).sort((a, b) => (a.view?.level ?? 0) - (b.view?.level ?? 0) || (a.view?.name ?? "").localeCompare(b.view?.name ?? "", "ko")).map(({ id, view, exec }) => ({ key: id, label: `${view?.level ? `${view.level}레벨 ` : "소마법 "}${view?.name ?? id}`, hint: describeSpellExec(exec), onSelect: () => void castIt(id, view?.name ?? id) }))
    : entry.kind === "npc"
      ? (entry.statBlock.actions.find((action) => action.kind === "spellcasting" && action.spellcasting)?.spellcasting?.lists ?? []).flatMap((list) => list.entries.filter((item) => item.spellId && spellExec(item.spellId)).map((item) => ({ key: `${list.frequency}:${item.spellId}`, label: `${item.name}${item.slotLevel ? ` (${item.slotLevel}레벨)` : ""}`, hint: `${list.frequency === "at-will" ? "의지대로" : list.frequency === "per-day" ? `${list.uses ?? 1}/일` : list.frequency} · ${describeSpellExec(spellExec(item.spellId!)!)}`, onSelect: () => void castIt(item.spellId!, item.name) })))
      : [];
  const initiativeBonus = derived ? derived.initiative : entry.kind === "npc" ? entry.statBlock.initiativeBonus : 0;
  const inTracker = tracker.turns.some((item) => item.tokenId === token.id && item.pageId === page.id);
  const chip = (label: string, used: boolean | undefined) => <span className={`cl-econ${used ? " used" : ""}`} title={used ? `${label} 사용함` : `${label} 남음`}><i />{label}</span>;
  const status = mode === "turn" ? (isGm ? `${token.name}의 턴` : "당신의 턴") : inCombat ? `${turn?.name ?? "…"}의 턴 · 기다리는 중` : "전투 전";
  return (
    <div className={`cl-cmd ${mode}`} role="region" aria-label={mode === "turn" ? `${token.name}의 턴` : `${token.name} 대기`}>
      <div className="cl-cmd-who">
        <span className="cl-cmd-status">{status}</span>
        <span className="cl-cmd-name">{mode === "turn" && !isGm ? token.name : mode === "turn" ? (tracker.turns.length ? `라운드 ${tracker.round}` : "") : token.name}</span>
        {mode === "turn" ? <span className="cl-turn-econ">{chip("행동", turn?.actionUsed)}{chip("추가 행동", turn?.bonusUsed)}{chip("반응", turn?.reactionUsed)}</span> : null}
        {blocked ? <span className="cl-pill bad">{blocked}: 행동 불가</span> : null}
      </div>
      <div className="cl-cmd-groups" role="toolbar" aria-label={`${token.name} 액션`}>
        <div className="cl-cmd-group attack">
          <span className="cl-cmd-label">공격</span>
          {derived ? derived.attacks.map((attack) => <button type="button" key={attack.id} className="cl-btn small attack" disabled={off} onClick={() => void attackWith({ source: "weapon", attackId: attack.id })}>⚔ {attack.name} <b>{attack.attackBonus >= 0 ? "+" : ""}{attack.attackBonus}</b></button>) : null}
          {entry.kind === "npc" ? entry.statBlock.actions.filter((action) => action.kind === "attack" && action.attack).map((action) => <button type="button" key={action.name} className="cl-btn small attack" disabled={off || Boolean(action.timing?.recharge && entry.runtime.spent[action.name])} onClick={() => void attackWith({ source: "npc", actionName: action.name })}>⚔ {action.name} <b>{action.attack!.bonus >= 0 ? "+" : ""}{action.attack!.bonus}</b></button>) : null}
          {ACTIONS.filter((def) => def.kind === "grapple" || def.kind === "shove" || def.kind === "escape").map((def) => { const needsHand = (def.kind === "grapple" || def.kind === "shove") && !freeHand; return <button type="button" key={def.kind} className="cl-btn small" disabled={off || needsHand || (def.kind === "escape" && !conditions.has("붙잡힘"))} title={needsHand ? "빈 손이 없습니다 (보조 손이나 양손 무기를 내려놓으세요)" : def.summary} onClick={() => void take(def)}>{def.name}</button>; })}
          <Dropdown up label="✨ 마법" disabled={off || !spellItems.length} items={spellItems} />
        </div>
        <div className="cl-cmd-group">
          <span className="cl-cmd-label">행동</span>
          <Dropdown up label="행동" disabled={off} items={ACTIONS.filter((def) => !["grapple", "shove", "escape"].includes(def.kind)).map((def) => ({ key: def.kind, label: def.name, hint: def.summary, onSelect: () => void take(def) }))} />
          <Dropdown up label="추가 행동" disabled={off} items={bonusItems} />
        </div>
        <div className="cl-cmd-group">
          <span className="cl-cmd-label">시트</span>
          <Dropdown up label="판정" items={checkItems} />
          <Dropdown up label="특성" disabled={Boolean(blocked)} items={featureItems} />
          <Dropdown up label="아이템" disabled={Boolean(blocked)} items={itemItems} />
          {!inTracker ? <button type="button" className="cl-btn small" onClick={() => c.addTurn({ name: token.name, tokenId: token.id, pageId: page.id, entryId: entry.id, image: token.image }, initiativeBonus)} title="1d20 + 이니셔티브 보너스를 굴려 트래커에 넣습니다">이니셔티브 {initiativeBonus >= 0 ? "+" : ""}{initiativeBonus}</button> : null}
          <button type="button" className="cl-btn small quiet" onClick={() => onOpenEntry(entry.id)}>시트 열기</button>
        </div>
      </div>
      {mode === "turn" ? <button type="button" className="cl-btn cl-cmd-end" onClick={() => c.nextTurn()} title="턴을 마치고 다음 차례로">턴 마침 ▶</button> : null}
    </div>
  );
}

/**
 * The turn panel: shown when the current turn is yours — a player's own character, or for the DM any creature no
 * player controls. One row: the sheet's attacks and unarmed options, then menus for the 2024 action list, checks,
 * features, items and bonus actions (D97, D98). The economy chips only inform.
 */
function TurnPanel({ token, page, onOpenEntry }: { token: Token; page: Page; onOpenEntry: (id: string) => void }) {
  const c = useCampaigns();
  const dice = useDice();
  const { catalog } = useClient();
  const { snapshot, isGm } = useViewer();
  const entry = token.represents ? snapshot.journal.find((item) => item.id === token.represents) : undefined;
  const derived = useMemo(() => (entry?.kind === "character" ? deriveCharacter(entry.source, catalog, { equipped: entry.runtime.equipped, inventory: entry.runtime.inventory, effects: entry.runtime.effects }) : null), [entry, catalog]);
  const latest = useRef<{ runtime: CharacterRuntime; sentAt: string } | null>(null);
  if (!entry || entry.kind === "handout") return null;
  const turn = snapshot.tracker.turns[snapshot.tracker.current];
  const attackWith = makeAttackWith({ c, token, page, entry, derived, isGm });
  const me = { entryId: entry.id, pageId: page.id, tokenId: token.id };
  const conditions = new Set([...(entry.runtime.conditions ?? []), ...token.markers.map((marker) => marker.name)]);
  const blocked = cannotAct([...conditions]);
  const off = Boolean(blocked);
  const rollToChat = async (spec: RollSpec) => { const result = await dice.roll(spec); c.sendRoll({ formula: result.formula, total: result.total, dice: result.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: result.modifier, label: `${token.name} · ${result.label}${result.note ? ` (${result.note})` : ""}` }); return result; };
  const d20 = (bonus: number) => `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`;
  // The sheet's runtime is saved against the newest we know (the host's echo or what we sent since).
  const currentRuntime = () => (entry.kind === "character" && latest.current && latest.current.sentAt > entry.updatedAt ? latest.current.runtime : (entry as JournalCharacter).runtime);
  const saveRuntime = (input: (current: CharacterRuntime) => CharacterRuntime) => {
    if (entry.kind !== "character") return;
    const runtime = { ...resolveRuntime(entry.source, catalog, currentRuntime(), input), updatedAt: new Date().toISOString() };
    const sentAt = new Date().toISOString();
    latest.current = { runtime, sentAt };
    c.putJournal({ ...entry, runtime, updatedAt: sentAt });
  };
  const take = async (def: ActionDef, bonus = false) => {
    let target: string | undefined;
    if (def.target) {
      const picked = await requestTargets(`${def.name}: ${def.target === "ally" ? "도울 아군" : def.kind === "escape" ? "붙잡은 상대" : "대상"}을 클릭하세요 (Esc 취소)`, { multi: false });
      if (!picked.length) return;
      target = picked[0];
    }
    let answer: ActAnswer | null | undefined = {};
    if ((def.skills && def.skills.length > 1) || def.text || def.choice || (isGm && (def.skills || def.kind === "escape"))) { answer = await requestActOptions({ def, gm: isGm }); if (answer === null) return; }
    c.act(me, def.kind, { target: target ? { pageId: page.id, tokenId: target } : undefined, skill: answer?.skill ?? def.skills?.[0], dc: answer?.dc, note: answer?.note, choice: answer?.choice, bonus });
  };
  // 판정: saves and skills from the sheet or the stat block (untrained skills use the ability modifier).
  const stats = entry.kind === "npc" ? npcStats(entry.statBlock) : derived ? pcStats(derived) : null;
  const checkItems = stats ? [
    ...ABILITY_KEYS.map((key) => ({ key: `save:${key}`, label: `${ABILITY_KO[key]} 내성`, hint: `${stats.saves[key] >= 0 ? "+" : ""}${stats.saves[key]}`, onSelect: () => void rollToChat({ label: `${ABILITY_KO[key]} 내성`, formula: d20(stats.saves[key]), kind: "save" }) })),
    ...Object.keys(SKILL_KO).map((id) => { const bonus = skillBonus(stats, id); return { key: `skill:${id}`, label: `${ABILITY_KO[SKILL_ABILITY_OF[id]]}(${SKILL_KO[id]})`, hint: `${bonus >= 0 ? "+" : ""}${bonus}`, onSelect: () => void rollToChat({ label: `${ABILITY_KO[SKILL_ABILITY_OF[id]]}(${SKILL_KO[id]})`, formula: d20(bonus), kind: "check" }) }; }),
  ] : [];
  // 특성: the sheet's usable features (class, species, feats) with their remaining uses; NPC traits are reminders.
  const usable = entry.kind === "character" && derived ? usableFeatures(derived, entry.runtime) : [];
  const useIt = async (feature: DerivedFeature) => {
    if (entry.kind !== "character" || !derived) return;
    const outcome = await activateFeature(feature, { source: entry.source, catalog, derived, runtime: currentRuntime(), rollDice: rollToChat, save: saveRuntime });
    if (outcome === "refused") alert("남은 횟수가 없습니다.");
    if (outcome === "done") c.say(`/em ${token.name}: ${feature.name} 사용`);
  };
  const featureItems = entry.kind === "npc"
    ? entry.statBlock.traits.map((trait) => ({ key: trait.name, label: trait.name, hint: trait.text.slice(0, 60), onSelect: () => c.say(`/em ${token.name}: ${trait.name}`) }))
    : usable.filter((item) => !item.bonus).map((item) => ({ key: item.feature.id, label: item.feature.name, hint: item.left !== undefined ? `${item.left}/${item.pool!.max}${item.activation.note ? ` · ${item.activation.note}` : ""}` : item.activation.note, disabled: item.left !== undefined && item.left <= 0, onSelect: () => void useIt(item.feature) }));
  // 아이템: the bag; potions heal, consumables are spent, the rest is logged.
  const items = entry.kind === "character" && derived ? derived.inventory.filter((item) => item.quantity > 0 && !["weapon", "armor", "shield"].includes(item.kind)) : [];
  const useItem = async (item: DerivedItem) => {
    if (entry.kind !== "character" || !derived) return;
    const use = itemUse(item);
    let healed: number | undefined;
    if (use.heal) healed = (await rollToChat({ label: use.text, formula: use.heal, note: "회복", kind: "custom" })).total;
    saveRuntime((current) => { let next = noteLog(current, `${use.text}${healed !== undefined ? ` — ${healed} 회복` : ""}`); if (healed !== undefined) next = applyHealing(next, derived, healed); if (use.consumes) next = setItemQuantity(next, derived, item.instanceId, item.quantity - 1); return next; });
    c.say(`/em ${token.name}: ${use.text}${healed !== undefined ? ` (${healed} 회복)` : ""}`);
  };
  const itemItems = items.map((item) => ({ key: item.instanceId, label: item.name, hint: `${item.quantity > 1 ? `×${item.quantity} · ` : ""}${itemUse(item).heal ? `회복 ${itemUse(item).heal}` : itemUse(item).consumes ? "소모" : "기록"}`, onSelect: () => void useItem(item) }));
  const bonusItems = [
    ...(entry.kind === "npc" ? entry.statBlock.bonusActions.map((action) => ({ key: action.name, label: `${action.kind === "attack" && action.attack ? "⚔ " : ""}${action.name}`, hint: action.text?.slice(0, 60), onSelect: () => { if (action.kind === "attack" && action.attack) void attackWith({ source: "npc", actionName: action.name }); else c.act(me, "utilize", { note: action.name, bonus: true }); } })) : []),
    ...usable.filter((item) => item.bonus).map((item) => ({ key: item.feature.id, label: item.feature.name, hint: item.left !== undefined ? `${item.left}/${item.pool!.max}` : undefined, disabled: item.left !== undefined && item.left <= 0, onSelect: () => void useIt(item.feature) })),
    { key: "note", label: "기록…", hint: "다른 추가 행동을 쓴 것으로 남김", onSelect: () => void take({ ...actionDef("utilize"), name: "추가 행동", text: "무엇을" }, true) },
  ];
  const chip = (label: string, used: boolean | undefined) => <span className={`cl-econ${used ? " used" : ""}`} title={used ? `${label} 사용함` : `${label} 남음`}><i />{label}</span>;
  return (
    <div className="cl-turn-panel" role="region" aria-label={`${token.name}의 턴`}>
      <div className="cl-turn-head">
        <strong>{token.name}의 턴</strong>{snapshot.tracker.turns.length ? <span className="cl-quiet cl-small"> · 라운드 {snapshot.tracker.round}</span> : null}
        <span className="cl-turn-econ">{chip("행동", turn?.actionUsed)}{chip("추가 행동", turn?.bonusUsed)}{chip("반응", turn?.reactionUsed)}</span>
        {blocked ? <span className="cl-pill bad">{blocked}: 행동 불가</span> : null}
        <span style={{ flex: 1 }} />
        <button type="button" className="cl-btn small quiet" onClick={() => onOpenEntry(entry.id)}>시트</button>
        <button type="button" className="cl-btn small primary" onClick={() => c.nextTurn()} title="턴을 마치고 다음 차례로">턴 마침 ▶</button>
      </div>
      <div className="cl-turn-row">
        {derived ? derived.attacks.map((attack) => <button type="button" key={attack.id} className="cl-btn small primary" disabled={off} onClick={() => void attackWith({ source: "weapon", attackId: attack.id })}>⚔ {attack.name} {attack.attackBonus >= 0 ? "+" : ""}{attack.attackBonus}</button>) : null}
        {entry.kind === "npc" ? entry.statBlock.actions.filter((action) => action.kind === "attack" && action.attack).map((action) => <button type="button" key={action.name} className="cl-btn small primary" disabled={off || Boolean(action.timing?.recharge && entry.runtime.spent[action.name])} onClick={() => void attackWith({ source: "npc", actionName: action.name })}>⚔ {action.name} {action.attack!.bonus >= 0 ? "+" : ""}{action.attack!.bonus}</button>) : null}
        {ACTIONS.filter((def) => def.kind === "grapple" || def.kind === "shove" || def.kind === "escape").map((def) => <button type="button" key={def.kind} className="cl-btn small" disabled={off || (def.kind === "escape" && !conditions.has("붙잡힘"))} title={def.summary} onClick={() => void take(def)}>{def.name}</button>)}
        <span className="cl-turn-sep" />
        <Dropdown label="행동" disabled={off} items={ACTIONS.filter((def) => !["grapple", "shove", "escape"].includes(def.kind)).map((def) => ({ key: def.kind, label: def.name, hint: def.summary, onSelect: () => void take(def) }))} />
        <Dropdown label="판정" items={checkItems} />
        <Dropdown label="특성" disabled={off} items={featureItems} />
        <Dropdown label="아이템" disabled={off} items={itemItems} />
        <Dropdown label="추가 행동" disabled={off} items={bonusItems} />
        <button type="button" className="cl-btn small" disabled title="주문은 장면 방식의 커맨드 바에서 시전합니다 (격자는 보류)">✨ 마법</button>
      </div>
    </div>
  );
}

/* ---------- Token action bar (D88): the sheet's buttons above the canvas for the selected token ---------- */

function ActionBar({ token, page, onOpenEntry }: { token: Token; page: Page; onOpenEntry: (id: string) => void }) {
  const c = useCampaigns();
  const dice = useDice();
  const { catalog } = useClient();
  const { viewer, snapshot, isGm } = useViewer();
  const entry = token.represents ? snapshot.journal.find((item) => item.id === token.represents) : undefined;
  const controls = controlsToken(token, viewer, snapshot.journal);
  const derived = useMemo(() => (entry?.kind === "character" ? deriveCharacter(entry.source, catalog, { equipped: entry.runtime.equipped, inventory: entry.runtime.inventory, effects: entry.runtime.effects }) : null), [entry, catalog]);
  if (!controls || !entry || entry.kind === "handout") return null;
  const roll = async (spec: RollSpec) => { const result = await dice.roll(spec); c.sendRoll({ formula: result.formula, total: result.total, dice: result.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: result.modifier, label: `${token.name} · ${result.label}${result.note ? ` (${result.note})` : ""}` }); };
  const d20 = (bonus: number) => `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`;
  const initiativeBonus = derived ? derived.initiative : entry.kind === "npc" ? entry.statBlock.initiativeBonus : 0;
  const inTracker = snapshot.tracker.turns.some((turn) => turn.tokenId === token.id && turn.pageId === page.id);
  const attackWith = makeAttackWith({ c, token, page, entry, derived, isGm });
  return (
    <div className="cl-action-bar" role="toolbar" aria-label={`${token.name} 액션`}>
      <strong className="cl-small">{token.name}</strong>
      <button type="button" className="cl-btn small" onClick={() => c.addTurn({ name: token.name, tokenId: token.id, pageId: page.id, entryId: entry.id, image: token.image }, initiativeBonus)} title="1d20 + 이니셔티브 보너스를 굴려 트래커에 넣습니다">이니셔티브 {initiativeBonus >= 0 ? "+" : ""}{initiativeBonus}{inTracker ? " ↻" : ""}</button>
      {derived ? derived.attacks.map((attack) => (
        <span key={attack.id} className="cl-action-group">
          <button type="button" className="cl-btn small primary" onClick={() => void attackWith({ source: "weapon", attackId: attack.id })} title="대상을 클릭하면 명중·피해가 규칙대로 판정됩니다">⚔ {attack.name} {attack.attackBonus >= 0 ? "+" : ""}{attack.attackBonus}</button>
          <button type="button" className="cl-btn small quiet" title="판정 없이 명중만 굴림" onClick={() => void roll({ label: `${attack.name} 명중`, formula: d20(attack.attackBonus), kind: "attack" })}>굴림</button>
        </span>
      )) : null}
      {entry.kind === "npc" ? entry.statBlock.actions.filter((action) => action.kind === "attack" || action.kind === "save").map((action) => (
        <span key={action.name} className="cl-action-group">
          {action.kind === "attack" && action.attack ? <button type="button" className="cl-btn small primary" onClick={() => void attackWith({ source: "npc", actionName: action.name })} disabled={Boolean(action.timing?.recharge && entry.runtime.spent[action.name])} title="대상을 클릭하면 명중·피해가 규칙대로 판정됩니다">⚔ {action.name} {action.attack.bonus >= 0 ? "+" : ""}{action.attack.bonus}</button> : null}
          {action.kind === "save" && action.save ? <button type="button" className="cl-btn small" disabled={Boolean(action.timing?.recharge && entry.runtime.spent[action.name])} onClick={() => { const damage = action.save!.failDamage?.[0]; if (damage) void roll({ label: `${action.name} 피해`, formula: damageFormula(damage), note: `${damage.type} · DC ${action.save!.dc}`, kind: "damage" }); if (action.timing?.recharge) c.putJournal({ ...entry, runtime: { ...entry.runtime, spent: { ...entry.runtime.spent, [action.name]: true } } }); }}>{action.name} DC {action.save.dc}{action.timing?.recharge && entry.runtime.spent[action.name] ? " (재충전 대기)" : ""}</button> : null}
          {action.kind === "attack" && action.attack ? action.attack.damage.map((damage, index) => <button type="button" key={index} className="cl-btn small quiet" onClick={() => void roll({ label: `${action.name} 피해`, formula: damageFormula(damage), note: damage.type, kind: "damage" })}>피해</button>) : null}
        </span>
      )) : null}
      <button type="button" className="cl-btn small quiet" onClick={() => onOpenEntry(entry.id)}>시트</button>
    </div>
  );
}

interface AttackAsk { name: string; sneak: boolean; slots: Array<{ level: number; free: number }>; gm: boolean; resolve: (answer: AttackAnswer | null) => void }
export interface AttackAnswer { riders?: AttackRiders; overrides?: AttackOverrides }

// The action bar unmounts while targeting (the selection clears), so the dialog lives in the canvas: the bar's
// async flow asks through this bridge and continues when the dialog answers.
const attackAskListeners = new Set<(ask: AttackAsk) => void>();
export const requestAttackOptions = (ask: Omit<AttackAsk, "resolve">) => new Promise<AttackAnswer | null>((resolve) => { if (!attackAskListeners.size) { resolve({}); return; } for (const listener of [...attackAskListeners]) listener({ ...ask, resolve }); });
function AttackAskBridge() {
  const [ask, setAsk] = useState<AttackAsk | null>(null);
  useEffect(() => { attackAskListeners.add(setAsk); return () => { attackAskListeners.delete(setAsk); }; }, []);
  return ask ? <AttackDialog ask={ask} onDone={(answer) => { ask.resolve(answer); setAsk(null); }} /> : null;
}

/**
 * The pre-roll dialog (§12.2 라이더 프롬프트 + D95 반자동): riders such as 암습 and 신성한 강타, the attacker's
 * 유리/불리 declaration, and for the DM cover and "반드시 적중/치명타/빗나감". Everything else stays automatic.
 */
function AttackDialog({ ask, onDone }: { ask: AttackAsk; onDone: (answer: AttackAnswer | null) => void }) {
  const [sneak, setSneak] = useState(ask.sneak);
  const [slot, setSlot] = useState<number>(0);
  const [advantage, setAdvantage] = useState<"auto" | Advantage>("auto");
  const [cover, setCover] = useState<0 | 2 | 5>(0);
  const [outcome, setOutcome] = useState<"" | "hit" | "crit" | "miss">("");
  const done = () => {
    const overrides: AttackOverrides = {};
    if (advantage !== "auto") overrides.advantage = advantage;
    if (ask.gm && cover) overrides.cover = cover;
    if (ask.gm && outcome) overrides.outcome = outcome;
    onDone({ riders: { sneak: ask.sneak && sneak, smiteSlot: slot || undefined }, overrides: Object.keys(overrides).length ? overrides : undefined });
  };
  return (
    <RiderModal title={`${ask.name} — 판정 전 조정`} onClose={() => onDone(null)} actions={<button type="button" className="cl-btn primary" onClick={done}>공격</button>}>
      <div className="cl-field"><label>유리·불리</label>
        <div className="cl-row" role="radiogroup" aria-label="유리·불리" style={{ gap: 4, flexWrap: "wrap" }}>
          {([["auto", "자동 (상태로 판단)"], ["normal", "보통"], ["advantage", "유리"], ["disadvantage", "불리"]] as Array<["auto" | Advantage, string]>).map(([value, label]) => <button type="button" key={value} role="radio" aria-checked={advantage === value} className={`cl-btn small${advantage === value ? " primary" : ""}`} onClick={() => setAdvantage(value)}>{label}</button>)}
        </div>
      </div>
      {ask.gm ? (
        <>
          <div className="cl-field"><label htmlFor="cl-attack-cover">엄폐</label><select id="cl-attack-cover" className="cl-select" value={cover} onChange={(event) => setCover(Number(event.target.value) as 0 | 2 | 5)}><option value={0}>없음</option><option value={2}>절반 엄폐 (AC +2)</option><option value={5}>3/4 엄폐 (AC +5)</option></select></div>
          <div className="cl-field"><label htmlFor="cl-attack-force">반드시</label><select id="cl-attack-force" className="cl-select" value={outcome} onChange={(event) => setOutcome(event.target.value as "" | "hit" | "crit" | "miss")}><option value="">주사위대로</option><option value="hit">반드시 적중</option><option value="crit">반드시 치명타</option><option value="miss">반드시 빗나감</option></select></div>
        </>
      ) : null}
      {ask.sneak ? <label className="cl-row cl-small" style={{ gap: 6 }}><input type="checkbox" checked={sneak} onChange={(event) => setSneak(event.target.checked)} /> 암습 (유리하거나 아군이 대상 옆에 있을 때, 턴당 한 번)</label> : null}
      {ask.slots.length ? <div className="cl-field"><label>신성한 강타 (적중 시 슬롯 소비, 2d8 + 슬롯 레벨당 1d8 광휘)</label><select className="cl-select" aria-label="강타 슬롯" value={slot} onChange={(event) => setSlot(Number(event.target.value))}><option value={0}>안 씀</option>{ask.slots.map((item) => <option key={item.level} value={item.level}>{item.level}레벨 슬롯 ({item.free} 남음)</option>)}</select></div> : null}
      <p className="cl-quiet cl-small">진행 중인 효과의 추가 주사위(격노·사냥꾼의 표식 등)는 저절로 붙습니다. 판정 뒤에도 DM 팔레트로 고칠 수 있습니다.</p>
    </RiderModal>
  );
}

/* ---------- Scene board (D95: Theatre of the Mind) ---------- */

/** Results that just landed, shown on the cards themselves (D100): damage, misses, checks — then gone. */
interface CardFloat { id: string; tokenId: string; text: string; tone: "hit" | "crit" | "miss" | "good" | "bad" | "info" }
function useCardFloats(page: Page, journal: JournalEntry[]) {
  const c = useCampaigns();
  const chat = c.table.snapshot?.chat ?? [];
  const seen = useRef<Set<string> | null>(null);
  const [floats, setFloats] = useState<CardFloat[]>([]);
  useEffect(() => {
    if (!seen.current) { seen.current = new Set(chat.map((message) => message.id)); return; }
    const fresh = chat.filter((message) => !seen.current!.has(message.id));
    if (!fresh.length) return;
    for (const message of fresh) seen.current.add(message.id);
    const byEntry = (entryId: string) => page.tokens.find((token) => token.represents === entryId)?.id;
    const byName = (name: string) => page.tokens.find((token) => token.name === name)?.id ?? page.tokens.find((token) => journal.find((entry) => entry.id === token.represents)?.name === name)?.id;
    const next: CardFloat[] = [];
    for (const message of fresh) {
      if (message.type === "action" && message.action && !message.undone && !message.supersedes) {
        const result = message.action;
        const tokenId = byEntry(result.target.id) ?? byName(result.target.name);
        if (!tokenId) continue;
        const hit = result.outcome === "hit" || result.outcome === "crit";
        next.push({ id: message.id, tokenId, text: !result.applied ? "DM 확인 대기" : result.outcome === "crit" ? `치명타 −${result.damageTotal}` : hit ? `−${result.damageTotal}` : result.outcome === "fumble" ? "자동 실패" : "빗나감", tone: !result.applied ? "info" : result.outcome === "crit" ? "crit" : hit ? "hit" : "miss" });
        if (result.downed) next.push({ id: `${message.id}:down`, tokenId, text: result.downed === "dead" ? "사망" : result.downed === "instant-death" ? "즉사" : "쓰러짐", tone: "bad" });
      } else if (message.type === "spell" && message.spell && !message.undone && !message.supersedes) {
        for (const row of message.spell.targets) {
          const tokenId = row.target.tokenId ?? byEntry(row.target.id) ?? byName(row.target.name);
          if (!tokenId) continue;
          const dmg = row.attack ? (row.attack.outcome === "hit" || row.attack.outcome === "crit" ? row.attack.damageTotal : -1) : row.damage ? row.damage.damageTotal : undefined;
          const text = !message.spell.applied ? "DM 확인 대기" : row.healed !== undefined ? `+${row.healed}` : row.tempHp !== undefined ? `임시 +${row.tempHp}` : row.attack && dmg === -1 ? "빗나감" : row.save && dmg !== undefined ? `${dmg ? `−${dmg} ` : ""}${row.save.success ? "내성 ✓" : "내성 ✗"}` : dmg !== undefined ? `−${dmg}` : row.effect ? row.effect.name : row.marks.join(" · ") || message.spell.name;
          const tone: CardFloat["tone"] = !message.spell.applied ? "info" : row.healed !== undefined || row.tempHp !== undefined ? "good" : row.attack?.outcome === "crit" ? "crit" : dmg && dmg > 0 ? "hit" : row.marks.length ? "bad" : "info";
          next.push({ id: `${message.id}:${row.target.id}`, tokenId, text, tone });
          const downed = row.attack?.downed ?? row.damage?.downed;
          if (downed) next.push({ id: `${message.id}:${row.target.id}:down`, tokenId, text: downed === "dead" ? "사망" : "쓰러짐", tone: "bad" });
        }
      } else if (message.type === "act" && message.act) {
        const act = message.act;
        const tokenId = byName(act.actor.name);
        if (tokenId) next.push({ id: message.id, tokenId, text: act.check ? `${act.name} ${act.check.success === undefined ? act.check.total : act.check.success ? "성공" : "실패"}` : act.name, tone: act.check?.success === false ? "bad" : act.check?.success ? "good" : "info" });
        const targetId = act.target ? byName(act.target.name) : undefined;
        if (targetId && act.targetMarks.length) next.push({ id: `${message.id}:t`, tokenId: targetId, text: act.targetMarks.join(" · "), tone: "bad" });
      }
    }
    if (!next.length) return;
    setFloats((list) => [...list, ...next]);
    for (const item of next) setTimeout(() => setFloats((list) => list.filter((entry) => entry.id !== item.id)), 2600);
  }, [chat, page.tokens, journal]);
  return floats;
}

/**
 * The scene as a stage: NPC cards along the top, the scene card (name, backdrop, round/turn) in the middle, the
 * players' cards along the bottom. What matters most is what stands out (D100): the acting card is larger with a
 * gold ring; in targeting mode only candidates stay lit; results float over the card they happened to.
 */
function SceneBoard({ page, tokens, selected, targeting, turnTokenId, acting, journal, isGm, onPointerDown, onPointerDownBoard, onContextMenu, onDoubleClick, onLeave }: {
  page: Page; tokens: Token[]; selected: string[]; targeting: TargetingState | null; turnTokenId?: string; acting?: Token; journal: JournalEntry[]; isGm: boolean;
  onPointerDown: (event: ReactPointerEvent, token: Token) => void; onPointerDownBoard: () => void; onContextMenu: (event: React.MouseEvent, token: Token) => void; onDoubleClick: (token: Token) => void; onLeave: (token: Token) => void;
}) {
  const c = useCampaigns();
  const { catalog } = useClient();
  const snapshot = c.table.snapshot!;
  const floats = useCardFloats(page, journal);
  const visible = tokens.filter((token) => token.layer !== "map");
  const party = visible.filter((token) => journal.find((entry) => entry.id === token.represents)?.kind === "character");
  const others = visible.filter((token) => !party.includes(token));
  const acOf = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of journal) {
      if (entry.kind === "npc") map.set(entry.id, entry.statBlock.ac);
      else if (entry.kind === "character") { try { map.set(entry.id, deriveCharacter(entry.source, catalog, { equipped: entry.runtime.equipped, inventory: entry.runtime.inventory, effects: entry.runtime.effects }).ac.value); } catch { /* an unreadable sheet has no badge */ } }
    }
    return map;
  }, [journal, catalog]);
  const inCombat = snapshot.tracker.turns.length > 0;
  const card = (kind: "pc" | "npc") => (token: Token) => (
    <SceneIcon key={token.id} token={token} kind={kind} journal={journal} ac={token.represents ? acOf.get(token.represents) : undefined} selected={selected.includes(token.id)} picked={targeting?.picked.includes(token.id) ?? false}
      candidate={targeting ? targeting.exclude !== token.id : null} turn={turnTokenId === token.id} dimmed={inCombat && !targeting && turnTokenId !== undefined && turnTokenId !== token.id} floats={floats.filter((item) => item.tokenId === token.id)}
      leave={Boolean(acting && acting.id !== token.id && token.represents && !targeting)} onPointerDown={(event) => onPointerDown(event, token)} onContextMenu={(event) => onContextMenu(event, token)} onDoubleClick={() => onDoubleClick(token)} onLeave={() => onLeave(token)} />
  );
  const row = (label: string, kind: "pc" | "npc", list: Token[], hint: string) => (
    <section className="cl-scene-row" aria-label={label}>
      <h4>{label}{list.length ? <span className="cl-quiet"> {list.length}</span> : null}</h4>
      <div className="cl-scene-cards">{list.length ? list.map(card(kind)) : <span className="cl-scene-hint cl-quiet cl-small">{hint}</span>}</div>
    </section>
  );
  return (
    <div className={`cl-scene${targeting ? " targeting" : ""}`} data-page-id={page.id} onPointerDown={(event) => { if (!(event.target as HTMLElement).closest(".cl-scene-card")) onPointerDownBoard(); }} onContextMenu={(event) => { if (!(event.target as HTMLElement).closest(".cl-scene-card")) event.preventDefault(); }}>
      {row("NPC", "npc", others, isGm ? "컴펜디움이나 저널의 NPC를 끌어 놓거나 \"놓기\"를 누르면 여기에 섭니다." : "아직 상대가 없습니다.")}
      <div className="cl-scene-stage" aria-label="장면">
        <span className="cl-scene-chip cl-scene-title">{page.name}</span>
        {page.background.image ? <ArtImage src={page.background.image} className="cl-scene-backdrop" alt={page.name} /> : <span className="cl-scene-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M3.5 18.5 9 13l3.5 3.5L16 13l4.5 5" strokeLinejoin="round" /></svg>{isGm ? <small>⋯ → 페이지 설정 → 배경 이미지</small> : null}</span>}
      </div>
      {row("플레이어", "pc", party, "저널의 \"토큰\"이나 끌어 놓기로 캐릭터를 세웁니다.")}
    </div>
  );
}

const SKULL = <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 2.6 1.3 4.9 3.3 6.3V19a1 1 0 0 0 1 1h1v1.2a.8.8 0 0 0 .8.8h3.8a.8.8 0 0 0 .8-.8V20h1a1 1 0 0 0 1-1v-2.7A8 8 0 0 0 12 2Zm-3.2 12a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Zm6.4 0a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4ZM12 17.2l-1.3-2.4h2.6L12 17.2Z" /></svg>;
const PERSON = <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0Z" /></svg>;

function SceneIcon({ token, kind, journal, ac, selected, picked, candidate, turn, dimmed, floats, leave, onPointerDown, onContextMenu, onDoubleClick, onLeave }: {
  token: Token; kind: "pc" | "npc"; journal: JournalEntry[]; ac?: number; selected: boolean; picked: boolean; /** null: no targeting; true/false: lit or dimmed. */ candidate: boolean | null; turn: boolean; dimmed: boolean; floats: CardFloat[]; leave: boolean;
  onPointerDown: (event: ReactPointerEvent) => void; onContextMenu: (event: React.MouseEvent) => void; onDoubleClick: () => void; onLeave: () => void;
}) {
  const entry = token.represents ? journal.find((item) => item.id === token.represents) : undefined;
  const character = entry?.kind === "character" ? entry : undefined;
  const markers = useMemo(() => {
    if (!character) return token.markers;
    const conditions: TokenMarker[] = character.runtime.conditions.filter((name) => isConditionMarker(name)).map((name) => ({ name }));
    return [...conditions, ...token.markers.filter((marker) => !isConditionMarker(marker.name))];
  }, [character, token.markers]);
  const hp = token.bars[0];
  const fraction = hp && hp.max ? Math.max(0, Math.min(1, (hp.value ?? 0) / hp.max)) : null;
  const down = fraction === 0 || markers.some((marker) => marker.name === "사망" || marker.name === "무의식");
  return (
    <div className={`cl-scene-card ${kind}${selected ? " selected" : ""}${picked ? " picked" : ""}${candidate === true ? " candidate" : candidate === false ? " not-candidate" : ""}${turn ? " turn" : ""}${dimmed ? " dimmed" : ""}${token.layer === "gm" ? " layer-gm" : ""}${down ? " down" : ""}`} data-token-id={token.id} data-token-name={token.name} title={token.name}
      onPointerDown={onPointerDown} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick}>
      {turn ? <span className="cl-scene-now">행동 중</span> : null}
      <div className="cl-scene-portrait">
        {fraction !== null ? <span className="cl-scene-gauge" style={{ height: `${Math.round(fraction * 100)}%` }} aria-hidden="true" /> : null}
        {token.image ? <ArtImage src={token.image} className="cl-scene-art" alt={token.name} /> : <span className="cl-scene-glyph">{kind === "npc" ? SKULL : PERSON}</span>}
        {ac !== undefined ? <span className="cl-scene-ac" title={`AC ${ac}`} aria-label={`AC ${ac}`}><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" fill="#161a21" stroke="#8b93a3" strokeWidth="1.4" /></svg><b>{ac}</b></span> : null}
        {markers.length ? <div className="cl-scene-markers">{markers.slice(0, 6).map((marker) => <span key={marker.name} className="cl-marker" title={marker.name}>{MARKER_GLYPH[marker.name] ?? "•"}{marker.badge !== undefined ? <small>{marker.badge}</small> : null}</span>)}</div> : null}
        <span className="cl-scene-name">{token.name}{hp && (hp.value !== undefined || hp.max !== undefined) ? <small>{hp.value ?? "?"}{hp.max !== undefined ? `/${hp.max}` : ""}</small> : null}</span>
        {floats.map((item, index) => <span key={item.id} className={`cl-float ${item.tone}`} style={{ animationDelay: `${index * 120}ms` }}>{item.text}</span>)}
      </div>
      {leave ? <button type="button" className="cl-scene-leave" aria-label={`${token.name}에게서 벗어남`} title="이동으로 이 상대의 사정거리를 벗어납니다 — 상대에게 기회 공격을 물어봅니다 (D96)" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onLeave(); }}>🏃 벗어남</button> : null}
    </div>
  );
}

/**
 * The turn order bar, Baldur's Gate 3 style (D101): the acting creature first and large in a gold frame, the rest
 * following left to right in smaller square portraits — red frames for enemies, blue for the party — each with a
 * thin health bar and a temp-HP ring; consecutive party members are linked into a group with hollow/filled turn
 * arrows; the fallen go grey. The DM's editable window opens from the end of the bar.
 */
function TurnRibbon({ page, onOpenTracker }: { page: Page; onOpenTracker?: () => void }) {
  const c = useCampaigns();
  const { snapshot, isGm } = useViewer();
  const tracker = snapshot.tracker;
  const rows = tracker.turns.map((turn, index) => ({ turn, index })).filter(({ turn }) => !turn.custom);
  const currentIndex = tracker.current;
  const rotated = rows.length ? [...rows.filter(({ index }) => index >= currentIndex), ...rows.filter(({ index }) => index < currentIndex)] : [];
  const tokenOf = (tokenId?: string) => page.tokens.find((token) => token.id === tokenId);
  const sideOf = (turn: TrackerTurn): "pc" | "npc" => (snapshot.journal.find((entry) => entry.id === turn.entryId)?.kind === "character" || tokenOf(turn.tokenId)?.represents && snapshot.journal.find((entry) => entry.id === tokenOf(turn.tokenId)?.represents)?.kind === "character" ? "pc" : "npc");
  // Consecutive party members share a group (BG3's linked initiative): the bracket spans them.
  const groups: Array<{ start: number; end: number }> = [];
  rotated.forEach(({ turn }, at) => { const side = sideOf(turn); const last = groups[groups.length - 1]; if (side === "pc" && last && last.end === at - 1 && sideOf(rotated[last.end].turn) === "pc") last.end = at; else if (side === "pc") groups.push({ start: at, end: at }); });
  const linked = new Set<number>(); for (const group of groups) if (group.end > group.start) for (let at = group.start; at <= group.end; at += 1) linked.add(at);
  return (
    <div className="cl-turn-ribbon" role="list" aria-label="이니셔티브 순서">
      <span className="cl-turn-ribbon-round" title={`라운드 ${tracker.round}`}>{tracker.round}<small>라운드</small></span>
      <div className="cl-turn-ribbon-track">
        {rotated.map(({ turn, index }, at) => {
          const token = tokenOf(turn.tokenId);
          const side = sideOf(turn);
          const hp = token?.bars[0];
          const fraction = hp && hp.max ? Math.max(0, Math.min(1, (hp.value ?? 0) / hp.max)) : null;
          const temp = token?.bars.find((bar) => bar.link === "temp");
          const tempRing = temp && temp.value && hp?.max ? Math.min(1, temp.value / hp.max) : 0;
          const down = fraction === 0 || token?.markers.some((marker) => marker.name === "사망" || marker.name === "무의식");
          const now = index === currentIndex;
          const acted = index < currentIndex;
          const inGroup = linked.has(at);
          const groupStart = groups.some((group) => group.start === at && group.end > group.start);
          const groupEnd = groups.some((group) => group.end === at && group.end > group.start);
          return (
            <span key={turn.id} role="listitem" className={`cl-turn-ribbon-item ${side}${now ? " now" : ""}${acted ? " acted" : ""}${down ? " down" : ""}${inGroup ? " linked" : ""}${groupStart ? " group-start" : ""}${groupEnd ? " group-end" : ""}`} data-turn-name={turn.name} title={`${turn.name} · 이니셔티브 ${turn.initiative}${down ? " · 쓰러짐" : ""}`}>
              <span className="cl-turn-ribbon-frame">
                {tempRing ? <span className="cl-turn-ribbon-temp" style={{ background: `conic-gradient(#7dd3fc ${Math.round(tempRing * 360)}deg, transparent 0)` }} aria-label="임시 HP" /> : null}
                <span className="cl-turn-ribbon-portrait">{token?.image ? <ArtImage src={token.image} alt="" /> : <span className="cl-turn-ribbon-glyph">{side === "npc" ? SKULL : PERSON}</span>}{down ? <span className="cl-turn-ribbon-down">✖</span> : null}</span>
                {fraction !== null ? <span className="cl-turn-ribbon-hp"><i style={{ width: `${Math.round(fraction * 100)}%` }} /></span> : null}
              </span>
              {inGroup ? <span className={`cl-turn-ribbon-arrow${acted || now ? " filled" : ""}`} aria-hidden="true">{acted ? "⌛" : now ? "▲" : "△"}</span> : null}
              {now ? <span className="cl-turn-ribbon-name">{turn.name}</span> : null}
            </span>
          );
        })}
      </div>
      {isGm ? <span className="cl-turn-ribbon-tools"><button type="button" className="cl-btn small primary" onClick={() => c.nextTurn()}>▶ 다음 턴</button><button type="button" className="cl-btn small quiet" onClick={() => onOpenTracker?.()} title="이니셔티브 편집·전투 시작">트래커</button></span> : null}
    </div>
  );
}

/* ---------- Token ---------- */

function TokenView({ token, page, cell, selected, picked, range, turn, dragging, movable, journal, onPointerDown, onPointerMove, onPointerUp, onContextMenu, onDoubleClick }: {
  token: Token; page: Page; cell: number; selected: boolean; picked: boolean; range: "in" | "long" | "out" | null; turn: boolean; dragging: { x: number; y: number; originX: number; originY: number } | null; movable: boolean; journal: JournalEntry[];
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
    <div className={`cl-token layer-${token.layer}${selected ? " selected" : ""}${picked ? " picked" : ""}${range ? ` range-${range}` : ""}${turn ? " turn" : ""}${movable ? " movable" : ""}${token.locked ? " locked" : ""}`} data-token-id={token.id} data-token-name={token.name}
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
