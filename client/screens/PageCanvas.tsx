/**
 * The table (ROLL20_TABLE_SPEC.md §1–§3, D95, D109): a Theatre-of-the-Mind scene — a board of actor icons with no
 * positions and no distances. Icons carry HP, AC and condition markers; clicking one selects it, right-click opens
 * its menu, the 벗어남 button provokes an opportunity attack (D96), and the command bar under the board is where
 * the selected creature acts. The grid map, with its cells, drag-and-snap, layers, zoom and ruler, is gone.
 */
import { derivedOf } from "../rules/attackSpec";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useCampaigns } from "../app/campaigns";
import { featureRuleKey, remainingText } from "../rules/activation";
import { characterScope, economyBucketOf, runEntryPoint } from "../rules/contract";
import { useClient } from "../app/context";
import type { JournalCharacter, JournalEntry, Pending } from "../campaign/journal";
import { canEdit, canView, newJournalNpc, pendingFor, pendingValue } from "../campaign/journal";
import { deriveCharacter } from "../character/derive";
import type { RollSpec } from "../character/dice";
import { damageFormula, monsterById } from "../compendium/monsters";
import { useDice } from "../ui/dice/DiceProvider";
import type { Layer, Page, Token, TokenBar, TokenMarker } from "../campaign/page";
import type { TrackerTurn } from "../campaign/tracker";
import { ALL_MARKERS, applyBarInput, controlsToken, isConditionMarker, MARKER_GLYPH, newScene, newToken, playerPageId, tokenForEntry, tokenForNpc } from "../campaign/page";
import type { Advantage, AttackOverrides } from "../rules/resolve";
import { ACTIONS, actionDef, cannotAct, hasFreeHand, npcStats, pcStats, skillBonus, SKILL_ABILITY_OF, SKILL_KO, type ActionDef, type ActionKind } from "../rules/actions";
import { ABILITY_KEYS, ABILITY_KO } from "../catalog/types";
import { activateFeature, usableFeatures } from "../character/activate";
import { applyHealing, noteLog, setItemQuantity } from "../character/play";
import type { CharacterRuntime } from "../character/runtime";
import { resolveRuntime } from "../character/save";
import type { DerivedFeature, DerivedItem } from "../character/types";
import { itemUse } from "../rules/items";
import { castableSpells } from "../rules/spellcast";
import { describeSpellExec, spellExec, sustainedExec, sustainOf, targetCountOf, variantsOf } from "../compendium/spells";
import type { CastMethod } from "../character/play";
import { castOptions } from "./SheetView";
import { ApprovalLayer, ToastLayer } from "./Notify";
import { canOffHand, monsterAuras, npcAttackSpec, weaponRange, weaponSpells } from "../rules/attackSpec";
import { traitRules } from "../compendium/monsterTraits";
import { offeredRiders, type ContractRider } from "../rules/attackRiders";
import { tableOutcome } from "../rules/contractTable";
import { attackScopeFilter } from "../rules/contractEffects";
import { metamagicOptions } from "../rules/contractActivation";
import type { AttackRef, AttackRiders } from "../session/protocol";
import { Modal as RiderModal } from "../ui/components";
import { toggleCondition } from "../character/play";
import { Modal, Notice } from "../ui/components";
import { ART_DRAG_TYPE, ArtImage, ArtPicker } from "./ArtPanel";
import { artRef } from "../campaign/art";
import { BACKGROUND_FIT_KO, type BackgroundFit } from "../campaign/page";
import { scrollCheckDc, scrollSpellId } from "../rules/scrolls";
import { fitOnScreen } from "../ui/place";

export const JOURNAL_DRAG_TYPE = "application/x-simplevtt-journal";
export const COMPENDIUM_DRAG_TYPE = "application/x-simplevtt-monster";
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
  /** Where the GM's next token lands: the shared board, or hidden from players. */
  const [layer, setLayer] = useState<Layer>("objects");
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ tokenId: string; x: number; y: number } | null>(null);
  const [targeting, setTargeting] = useState<TargetingState | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const { catalog } = useClient();
  const live = pages.filter((page) => !page.archived);
  const page = isGm ? (pages.find((item) => item.id === gmPageId) ?? live.find((item) => item.id === snapshot.playerPageId) ?? live[0] ?? null) : (pages.find((item) => item.id === ribbonId) ?? null);
  useEffect(() => { if (isGm && page && page.id !== gmPageId) setGmPageId(page.id); }, [isGm, page, gmPageId]);
  /**
   * R15: while the table is picking targets, the floating windows (the turn tracker above all) sit over the board
   * and swallowed the click — the DM's target landed on the window, not on the icon. They go click-through.
   */
  useEffect(() => {
    document.body.classList.toggle("cl-picking-targets", Boolean(targeting));
    return () => document.body.classList.remove("cl-picking-targets");
  }, [targeting]);
  const journal = snapshot.journal;

  // Keyboard: Delete removes the selection (its controller), Escape clears it or cancels targeting.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (event.key === "Escape") { if (targeting) { targeting.resolve([]); setTargeting(null); } setSelected([]); setMenu(null); return; }
      if (!page || !selected.length) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        for (const id of selected) { const token = page.tokens.find((item) => item.id === id); if (token && controlsToken(token, viewer, journal) && !token.locked) c.removeToken(page.id, id); }
        setSelected([]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** In targeting mode a click picks the icon (Shift toggles in multi mode); returns true when consumed. */
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
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    if (!page) return;
    const journalId = event.dataTransfer.getData(JOURNAL_DRAG_TYPE);
    const artId = event.dataTransfer.getData(ART_DRAG_TYPE);
    const monsterId = event.dataTransfer.getData(COMPENDIUM_DRAG_TYPE);
    if (journalId) placeCharacter(journalId);
    else if (monsterId && isGm) {
      const monster = monsterById(monsterId);
      if (monster) {
        const count = journal.filter((entry) => entry.kind === "npc" && entry.monsterId === monster.id).length;
        const npc = newJournalNpc(snapshot.campaignId, c.userId, monster, count ? { name: `${monster.name} ${count + 1}` } : {});
        c.putJournal(npc);
        placeTokenAt(tokenForNpc(npc));
      }
    // R73 (D208): on a scene an image dropped on the board is its background — from the art tab, or a file from this PC.
    } else if (artId && isGm) c.putPage({ ...page, background: { ...page.background, image: artRef(artId) } });
    else if (isGm) {
      const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
      if (file) void c.uploadArt(file).then((id) => { const current = c.table.snapshot?.pages.find((item) => item.id === page.id) ?? page; c.putPage({ ...current, background: { ...current.background, image: artRef(id) } }); }).catch((error) => alert(`이미지를 올리지 못했습니다: ${error instanceof Error ? error.message : String(error)}`));
    }
  };
  const placeTokenAt = (token: Token) => {
    if (!page) return;
    const placed: Token = { ...token, layer: isGm && layer === "gm" ? "gm" : "objects", z: Math.max(0, ...page.tokens.map((item) => item.z + 1)) };
    c.putToken(page.id, placed);
    setSelected([placed.id]);
  };
  const placeCharacter = (journalId: string) => {
    const entry = journal.find((item) => item.id === journalId);
    const token = entry ? tokenForEntry(entry) : null;
    if (token) placeTokenAt(token);
  };

  // R27 (D141): with no scene this used to return before the toast and approval layers were even mounted, so a
  // player whose bookmark pointed at a deleted scene got no board, no toasts and no prompt card — the ogre asked
  // for an opportunity attack and nothing appeared on their screen. Those layers live above this return now.
  if (!page) {
    return (
      <div className="cl-canvas-empty">
        <ToastLayer boardShowsResults />
        <ApprovalLayer />
        {isGm ? <><p className="cl-quiet">아직 장면이 없습니다. 장면을 만들면 플레이어 리본이 그 장면에 놓입니다. 장면에는 위치와 거리가 없고, 등장한 인물만 아이콘으로 섭니다.</p><button type="button" className="cl-btn primary" onClick={() => addScene()}>+ 장면</button></> : <p className="cl-quiet">DM이 장면을 열면 여기에 보입니다.</p>}
      </div>
    );
  }
  function addScene() {
    const created = newScene(snapshot.campaignId, `장면 ${live.length + 1}`, live.length);
    c.putPage(created);
    if (live.length === 0) c.setRibbon(created.id);
    setGmPageId(created.id);
  }
  // D96: the acting token (the current turn's, else the selection) may "벗어남" from any other icon.
  const currentTurn = snapshot.tracker.turns[snapshot.tracker.current];
  const turnToken = currentTurn?.pageId === page.id ? page.tokens.find((token) => token.id === currentTurn.tokenId) : undefined;
  const acting = (turnToken && controlsToken(turnToken, viewer, journal) ? turnToken : undefined) ?? (selected.length === 1 ? page.tokens.find((token) => token.id === selected[0] && controlsToken(token, viewer, journal)) : undefined);
  // D97: the turn panel — a player's own character's turn; for the DM, the turn of anyone no player controls.
  const players = snapshot.players.filter((player) => player.role !== "gm");
  const myTurn = turnToken && (isGm ? !players.some((player) => controlsToken(turnToken, { userId: player.userId, role: "player" }, journal)) : controlsToken(turnToken, viewer, journal)) ? turnToken : undefined;
  // The command bar's creature: a creature of mine I selected on purpose (the DM runs many), else my turn's, else (a player) my only creature on the scene.
  const mine = page.tokens.filter((token) => token.represents && controlsToken(token, viewer, journal));
  const commandToken = (selected.length === 1 ? page.tokens.find((token) => token.id === selected[0] && token.represents && controlsToken(token, viewer, journal)) : undefined) ?? myTurn ?? (!isGm && mine.length === 1 ? mine[0] : undefined);
  const sortedTokens = [...page.tokens].sort((a, b) => (a.layer === b.layer ? a.z - b.z : a.layer === "objects" ? -1 : 1));
  const menuToken = menu ? page.tokens.find((token) => token.id === menu.tokenId) ?? null : null;
  return (
    <div className={`cl-canvas scene-mode${targeting ? " is-targeting" : ""}${myTurn ? " my-turn" : ""}${snapshot.tracker.turns.length ? " has-tracker" : ""}`} data-page-id={page.id}>
      {isGm ? (
        <div className="cl-page-bar">
          <div className="cl-page-strip" role="tablist" aria-label="장면">
            {(showArchived ? pages : live).map((item) => (
              <button type="button" key={item.id} role="tab" aria-selected={item.id === page.id} className={`cl-page-chip${item.id === page.id ? " active" : ""}${item.archived ? " archived" : ""}`} onClick={() => setGmPageId(item.id)}>
                {item.id === snapshot.playerPageId ? <span className="cl-ribbon" aria-label="플레이어 리본">🎗</span> : null}{item.name}
                {item.id !== snapshot.playerPageId && !item.archived ? <span className="cl-ribbon-move" role="button" tabIndex={-1} title="플레이어 리본을 이 장면으로" aria-label={`리본을 ${item.name}으로`} onClick={(event) => { event.stopPropagation(); c.setRibbon(item.id); }}>🎗</span> : null}
              </button>
            ))}
          </div>
          <div className="cl-row" style={{ gap: 4 }}>
            <button type="button" className="cl-btn small" onClick={() => addScene()}>+ 장면</button>
            <Dropdown label="⋯" items={[
              { key: "settings", label: "장면 설정", hint: "이름·배경 그림·설명", onSelect: () => onOpenPageSettings(page.id) },
              { key: "dup", label: "복제", onSelect: () => { const copy = { ...page, id: newScene(page.campaignId, "", 0).id, name: `${page.name} (복제)`, order: live.length, tokens: page.tokens.map((token) => ({ ...token, id: newToken({ name: token.name }).id })) }; c.putPage(copy); setGmPageId(copy.id); } },
              { key: "archive", label: page.archived ? "보관 해제" : "보관", onSelect: () => c.putPage({ ...page, archived: !page.archived }) },
              // R23 (D120): any scene can be thrown away, the only one included — the board falls back to its empty
              // state with "+ 장면" right there, so there is nothing to protect the DM from.
              { key: "delete", label: "장면 삭제", hint: `${page.name}과(와) 그 위의 아이콘 ${page.tokens.length}개${pages.length === 1 ? " · 마지막 장면입니다" : ""}`, onSelect: () => { if (!confirm(`"${page.name}"을(를) 지울까요? 이 장면 위의 아이콘 ${page.tokens.length}개도 함께 사라지고 되돌릴 수 없습니다.`)) return; const next = pages.find((item) => item.id !== page.id && !item.archived) ?? pages.find((item) => item.id !== page.id); c.removePage(page.id); setGmPageId(next?.id ?? null); } },
              { key: "archived", label: showArchived ? "보관함 숨기기" : "보관함 보기", onSelect: () => setShowArchived((value) => !value) },
              { key: "layer", label: layer === "gm" ? "모두에게 보이게 놓기" : "GM만 보이게 놓기", hint: "새로 놓는 아이콘", onSelect: () => setLayer((value) => (value === "gm" ? "objects" : "gm")) },
            ]} />
            {players.length ? <SplitParty page={page} pages={live} /> : null}
          </div>
        </div>
      ) : null}
      <div className="cl-canvas-body">
        <ToastLayer boardShowsResults />
        <ApprovalLayer />
        {snapshot.tracker.turns.length ? <TurnRibbon page={page} onOpenTracker={onOpenTracker} /> : null}
        <div className={`cl-canvas-viewport scene${targeting ? " targeting" : ""}`} ref={board} onDragOver={(event) => { const types = [...event.dataTransfer.types]; if (types.includes(JOURNAL_DRAG_TYPE) || types.includes(ART_DRAG_TYPE) || types.includes(COMPENDIUM_DRAG_TYPE) || (isGm && types.includes("Files"))) event.preventDefault(); }} onDrop={onDrop}>
          <SceneBoard page={page} tokens={sortedTokens} selected={selected} targeting={targeting} turnTokenId={turnToken?.id} acting={acting} journal={journal} isGm={isGm}
            onPointerDown={onIconPointerDown} onPointerDownBoard={() => { setSelected([]); setMenu(null); }}
            onContextMenu={(event, token) => { event.preventDefault(); event.stopPropagation(); setSelected([token.id]); setMenu({ tokenId: token.id, x: event.clientX, y: event.clientY }); }}
            onDoubleClick={(token) => { if (token.represents && journal.some((entry) => entry.id === token.represents)) onOpenEntry(token.represents); else if (controlsToken(token, viewer, journal)) onOpenToken(page.id, token.id); }}
            onLeave={(token) => { if (acting) c.provoke({ entryId: acting.represents, pageId: page.id, tokenId: acting.id }, { entryId: token.represents, pageId: page.id, tokenId: token.id }); }} />
          {menuToken ? <TokenMenu token={menuToken} page={page} at={menu!} onClose={() => setMenu(null)} onOpenToken={() => onOpenToken(page.id, menuToken.id)} onOpenEntry={onOpenEntry} /> : null}
          {targeting ? (
            <div className="cl-targeting-banner" role="status" data-multi={targeting.multi ? "1" : "0"} data-picked={targeting.picked.length}>
              <span className="cl-targeting-icon" aria-hidden="true">🎯</span>
              <span className="cl-targeting-text"><strong>{targeting.prompt}</strong><small>{targeting.multi ? "여러 대상은 Shift+클릭 · Esc 취소" : "Esc 취소"}</small></span>
              {targeting.multi ? <><span className="cl-quiet cl-small">{targeting.picked.length}개 선택</span><button type="button" className="cl-btn primary" disabled={!targeting.picked.length} onClick={() => { targeting.resolve(targeting.picked); setTargeting(null); }}>확정</button></> : null}
              <button type="button" className="cl-btn quiet" onClick={() => { targeting.resolve([]); setTargeting(null); }}>취소</button>
            </div>
          ) : null}
        </div>
      </div>
      {commandToken ? <CommandBar token={commandToken} page={page} mode={myTurn && commandToken.id === myTurn.id ? "turn" : "free"} onOpenEntry={onOpenEntry} /> : null}
      <AttackAskBridge />
      <ActAskBridge />
      <CastAskBridge />
      <PlaceCharacterBridge onPlace={(id) => placeCharacter(id)} onPlaceToken={(token) => placeTokenAt(token)} onTargets={(request) => { setSelected([]); setMenu(null); setTargeting({ ...request, picked: [] }); }} />
    </div>
  );
}

/** Lets the journal, the compendium and the tracker reach the board without threading props through the table. */
interface TargetingState { prompt: string; multi: boolean; picked: string[]; resolve: (ids: string[]) => void; /** The actor the request is for, so its own icon can be excluded. */ exclude?: string }
const placeListeners = new Set<(id: string) => void>();
const placeTokenListeners = new Set<(token: Token) => void>();
const targetListeners = new Set<(request: Omit<TargetingState, "picked">) => void>();
export const placeCharacterToken = (journalId: string) => { for (const listener of [...placeListeners]) listener(journalId); return placeListeners.size > 0; };
export const placeToken = (token: Token) => { for (const listener of [...placeTokenListeners]) listener(token); return placeTokenListeners.size > 0; };
/** Targeting mode (§12.1): the crosshair banner appears, the promise resolves with the clicked token ids ([] when cancelled). */
export const requestTargets = (prompt: string, options: { multi?: boolean; exclude?: string } = {}) => new Promise<string[]>((resolve) => { if (!targetListeners.size) { resolve([]); return; } for (const listener of [...targetListeners]) listener({ prompt, multi: Boolean(options.multi), resolve, exclude: options.exclude }); });
function PlaceCharacterBridge({ onPlace, onPlaceToken, onTargets }: { onPlace: (id: string) => void; onPlaceToken: (token: Token) => void; onTargets: (request: Omit<TargetingState, "picked">) => void }) {
  useEffect(() => { placeListeners.add(onPlace); placeTokenListeners.add(onPlaceToken); targetListeners.add(onTargets); return () => { placeListeners.delete(onPlace); placeTokenListeners.delete(onPlaceToken); targetListeners.delete(onTargets); }; }, [onPlace, onPlaceToken, onTargets]);
  return null;
}


/** ⚔: pick targets (range dims tokens on a grid, never on a scene), the pre-roll dialog (riders; the DM's 유리/불리·엄폐·반드시 — D95), then the host resolves (§12.2). Shared by the action bar and the turn panel. */
function makeAttackWith({ c, token, page, entry, derived, isGm, readied, journal }: { c: ReturnType<typeof useCampaigns>; token: Token; page: Page; entry: JournalEntry; derived: ReturnType<typeof deriveCharacter> | null; isGm: boolean; journal: JournalEntry[]; /** R9: the attack is the readied action going off (a reaction). */ readied?: boolean }) {
  return async (ref: AttackRef, options: { targets?: string[]; overrides?: AttackOverrides } = {}) => {
    const name = ref.source === "weapon" && derived ? derived.attacks.find((item) => item.id === ref.attackId)!.name : ref.source === "npc" ? ref.actionName : "공격";
    const targets = options.targets ?? await requestTargets(`${name} — 대상을 클릭하세요${readied ? " (준비한 행동)" : ""}`, { multi: true, exclude: token.id });
    if (!targets.length) return;
    // R63 (D198): 암습, 신성한 강타 and 야만적 공격자 are chosen after the hit now, in the window it opens — this dialog
    // keeps only what has to be declared before the dice.
    let offHand = false;
    let weaponSpellIds: string[] = [];
    let contractRiderList: ContractRider[] = [];
    if (ref.source === "weapon" && derived && entry.kind === "character") {
      const attack = derived.attacks.find((item) => item.id === ref.attackId)!;
      // R33 (D168): a Light weapon can be the off-hand swing, which costs it its ability modifier unless 쌍수 전투 pays.
      offHand = canOffHand(attack);
      // H2 (D239): a spell cast through a weapon (진실의 일격) is declared here, before the dice.
      weaponSpellIds = weaponSpells(derived).map((item) => item.spellId);
      // R52 (D187): the riders the sheet's own contracts offer for this weapon, with what is running and what is left.
      const runtime = entry.runtime;
      contractRiderList = offeredRiders(derived, attack, {
        effects: (runtime.effects ?? []).map((effect) => effect.name),
        left: (resourceId) => (derived.resources.find((item) => item.id === resourceId)?.max ?? 0) - (runtime.resourcesUsed[resourceId] ?? 0),
      });
    }
    let answer: AttackAnswer | null | undefined;
    if (options.overrides) answer = { overrides: options.overrides };
    // R31 (D164): 무리 전술, 태양광 과민성 and the like turn on where people are standing, which a scene without
    // positions cannot know. They are not silently dropped any more — the dialog names them where the DM chooses.
    const hit = targets.map((id) => page.tokens.find((item) => item.id === id)?.represents).filter((id): id is string => Boolean(id));
    const situational = situationalTraits(entry, hit.map((id) => journal.find((candidate) => candidate.id === id)).filter((found): found is JournalEntry => Boolean(found)));
    if (options.overrides) answer = { overrides: options.overrides };
    else if (isGm || offHand || weaponSpellIds.length || situational.length || contractRiderList.length) { answer = await requestAttackOptions({ name, offHand, weaponSpells: weaponSpellIds, offHandFeat: derived?.featEffects?.lightOffHandAbilityModifier, gm: isGm, notes: situational, riders: contractRiderList }); if (answer === null) return; }
    c.attack({ entryId: entry.id, pageId: page.id, tokenId: token.id }, targets.map((id) => ({ pageId: page.id, tokenId: id })), ref, answer?.riders, { overrides: answer?.overrides, readied });
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
/**
 * R22 (D119): a floating menu is placed against the WINDOW, not against the board.
 *
 * The board is a clipped box (`overflow:hidden`), so a menu drawn inside it lost everything past the bottom edge —
 * right-clicking a token low on the scene hid the 삭제 button with no way to reach it. These menus go into a portal
 * on `document.body`, sit `position:fixed` at the pointer, and are nudged back on screen: flipped above the point
 * when they would fall off the bottom, pulled left when they would fall off the right, never off the top or left.
 */
function useOnScreen(at: { x: number; y: number }, open = true) {
  const ref = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(at);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !open) return;
    const { width, height } = node.getBoundingClientRect();
    setPlaced(fitOnScreen(at, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [at.x, at.y, open]);
  return { ref, placed };
}

/**
 * The menu itself, on `document.body` so no clipped ancestor can cut it off. `ignore` is the button that opened it:
 * the menu is no longer a DOM child of that button, so without this a press on either would read as "outside" and
 * close the menu before the click could land on the item.
 */
function FloatingMenu({ at, className, label, onClose, ignore, children }: { at: { x: number; y: number }; className: string; label: string; onClose: () => void; ignore?: { current: HTMLElement | null }; children: ReactNode }) {
  const { ref, placed } = useOnScreen(at);
  useEffect(() => {
    const onDown = (event: PointerEvent) => { const target = event.target as Node; if (!ref.current?.contains(target) && !ignore?.current?.contains(target)) onClose(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    // A frame later, so the click that opened the menu does not close it again.
    const timer = window.setTimeout(() => { document.addEventListener("pointerdown", onDown); document.addEventListener("keydown", onKey); }, 0);
    return () => { window.clearTimeout(timer); document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [onClose, ref, ignore]);
  return createPortal(
    <div className={className} style={{ left: placed.x, top: placed.y }} role="menu" aria-label={label} ref={ref} onContextMenu={(event) => event.preventDefault()}>{children}</div>,
    document.body,
  );
}

/** R65 (D200): one thing the turn panel can press — a row button or a menu entry. */
interface PanelItem { key: string; label: string; hint?: string; uses?: string; disabled?: boolean; onSelect: () => void }

function Dropdown({ label, items, disabled, tone, up = false }: { label: string; items: Array<{ key: string; label: string; hint?: string; disabled?: boolean; onSelect: () => void }>; disabled?: boolean; tone?: "primary"; /** Open above the button (menus on the command bar at the bottom of the board). */ up?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // R22 (D119): anchored to the button's place on screen, then nudged to fit — the board clips, the window does not.
  const [at, setAt] = useState({ x: 0, y: 0 });
  const anchor = () => { const rect = box.current?.getBoundingClientRect(); if (rect) setAt({ x: rect.left, y: up ? rect.top : rect.bottom + 2 }); };
  return (
    <div className={`cl-dd${up ? " up" : ""}`} ref={box}>
      <button type="button" className={`cl-btn small${tone === "primary" ? " primary" : ""}${open ? " active" : ""}`} aria-haspopup="menu" aria-expanded={open} disabled={disabled || !items.length} onClick={() => { anchor(); setOpen((value) => !value); }}>{label} ▾</button>
      {open ? (
        <FloatingMenu at={at} className="cl-dd-menu" label={label} onClose={() => setOpen(false)} ignore={box}>
          {items.map((item) => <button type="button" key={item.key} role="menuitem" className="cl-dd-item" disabled={item.disabled} title={item.hint} onClick={() => { setOpen(false); item.onSelect(); }}><span>{item.label}</span>{item.hint ? <small>{item.hint}</small> : null}</button>)}
        </FloatingMenu>
      ) : null}
    </div>
  );
}

interface CastAsk { name: string; title?: string; options: Array<{ label: string; method: CastMethod | string }>; resolve: (method: CastMethod | string | null) => void }
const castAskListeners = new Set<(ask: CastAsk) => void>();
const requestCastMethod = (ask: Omit<CastAsk, "resolve">) => new Promise<CastMethod | string | null>((resolve) => { if (!castAskListeners.size) { resolve(ask.options[0]?.method ?? null); return; } for (const listener of [...castAskListeners]) listener({ ...ask, resolve }); });
/** V4f (D268): ask which variant of a spell to cast; the first one when nobody is there to ask (tests). Undefined when the spell has none, null when cancelled. */
export const requestSpellVariant = async (spellId: string, name: string): Promise<string | undefined | null> => {
  const variants = variantsOf(spellId);
  if (!variants.length) return undefined;
  const answer = await requestCastMethod({ name, title: `${name} — 무엇을 고를까요`, options: variants.map((variant) => ({ label: variant.label, method: variant.id })) });
  return typeof answer === "string" ? answer : null;
};
/** V4k (D273): ask which form a use takes (야생 변신); the first one when nobody is there to ask (tests). */
export const requestForm = async (name: string, options: Array<{ id: string; name: string; crText: string }>): Promise<string | null> => {
  if (!options.length) return null;
  const answer = await requestCastMethod({ name, title: `${name} — 어떤 형태로`, options: options.map((option) => ({ label: `${option.name} (도전 지수 ${option.crText})`, method: option.id })) });
  return typeof answer === "string" ? answer : null;
};
function CastAskBridge() {
  const [ask, setAsk] = useState<CastAsk | null>(null);
  useEffect(() => { castAskListeners.add(setAsk); return () => { castAskListeners.delete(setAsk); }; }, []);
  if (!ask) return null;
  return (
    <RiderModal title={ask.title ?? `${ask.name} — 어떻게 시전할까요`} onClose={() => { ask.resolve(null); setAsk(null); }}>
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
  const latest = useRef<Pending<CharacterRuntime> | null>(null);
  if (!entry || entry.kind === "handout") return null;
  const tracker = snapshot.tracker;
  const turn = tracker.turns[tracker.current];
  const inCombat = tracker.turns.length > 0;
  const me = { entryId: entry.id, pageId: page.id, tokenId: token.id };
  const conditions = new Set([...(entry.runtime.conditions ?? []), ...token.markers.map((marker) => marker.name)]);
  const blocked = cannotAct([...conditions]);
  const myRow = tracker.turns.find((item) => item.tokenId === token.id && item.pageId === page.id);
  // R9: a readied action (⏳) may go off out of turn as the reaction — attacks and spells come back on for that.
  const readiedNow = mode === "free" && inCombat && conditions.has("준비") && !myRow?.reactionUsed && !blocked;
  const attackWith = makeAttackWith({ c, token, page, entry, derived, isGm, readied: readiedNow, journal: snapshot.journal });
  // Out of turn during combat a player may only roll checks and read the sheet; the DM may do anything.
  const off = Boolean(blocked) || (mode === "free" && inCombat && !isGm);
  const offAttack = off && !readiedNow;
  const freeHand = derived ? hasFreeHand(derived.inventory) : true;
  const rollToChat = async (spec: RollSpec) => { const result = await dice.roll(spec); c.sendRoll({ formula: result.formula, total: result.total, dice: result.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: result.modifier, label: `${token.name} · ${result.label}${result.note ? ` (${result.note})` : ""}` }); return result; };
  const d20 = (bonus: number) => `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`;
  // R10: 도움 (Help) on this creature gives advantage to its next ability check — roll twice, keep the better, spend the mark.
  const helped = token.markers.some((marker) => marker.name === "도움");
  const rollCheck = async (spec: RollSpec) => {
    if (!helped) return rollToChat(spec);
    const first = await dice.roll(spec);
    const second = await dice.roll(spec);
    const best = first.total >= second.total ? first : second;
    c.sendRoll({ formula: best.formula, total: best.total, dice: best.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: best.modifier, label: `${token.name} · ${best.label} (도움 유리: ${first.total}·${second.total})` });
    c.putToken(page.id, { ...token, markers: token.markers.filter((marker) => marker.name !== "도움") });
    return best;
  };
  const currentRuntime = () => pendingValue(latest.current, entry.updatedAt, (entry as JournalCharacter).runtime);
  const saveRuntime = (input: (current: CharacterRuntime) => CharacterRuntime) => {
    if (entry.kind !== "character") return;
    const runtime = { ...resolveRuntime(entry.source, catalog, currentRuntime(), input), updatedAt: new Date().toISOString() };
    latest.current = pendingFor(runtime, entry.updatedAt);
    c.putJournal({ ...entry, runtime, updatedAt: runtime.updatedAt });
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
    ...Object.keys(SKILL_KO).map((id) => { const bonus = skillBonus(stats, id); return { key: `skill:${id}`, label: `${ABILITY_KO[SKILL_ABILITY_OF[id]]}(${SKILL_KO[id]})`, hint: `${bonus >= 0 ? "+" : ""}${bonus}${helped ? " · 도움 유리" : ""}`, onSelect: () => void rollCheck({ label: `${ABILITY_KO[SKILL_ABILITY_OF[id]]}(${SKILL_KO[id]})`, formula: d20(bonus), kind: "check" }) }; }),
  ] : [];
  const usable = entry.kind === "character" && derived ? usableFeatures(derived, entry.runtime, catalog) : [];
  /**
   * R23 (D121): a feature is used on the sheet, so the sheet has to tell the table what the turn spent. Without
   * this the 추가 행동 칩 stayed lit all turn after 재기의 바람 or 교활한 행동 — the bonus action looked unused.
   * Only a 추가 행동 is claimed: the activation notes say which features are bonus actions, and nothing in the data
   * separates a feature that costs an action from one that is free, so those are left to the table.
   */
  const useIt = async (feature: DerivedFeature, bonus = false) => {
    if (entry.kind !== "character" || !derived) return;
    let given: { points: number; self: boolean } | undefined;
    const outcome = await activateFeature(feature, { source: entry.source, catalog, derived, runtime: currentRuntime(), rollDice: rollToChat, save: saveRuntime, onChosenPoints: (points, self) => { given = { points, self }; }, askForm: requestForm });
    if (outcome === "refused") alert("남은 횟수가 없습니다.");
    if (outcome !== "done") return;
    c.say(`/em ${token.name}: ${feature.name} 사용`);
    if (bonus) c.spendEconomy(me, "bonus");
    // R58 (D193): the half of the contract that belongs to the board. R42 built it and the host has answered it ever
    // since; nothing called it, so a feature that puts a condition on somebody or hands out temporary hit points did
    // its sheet half and stopped. When it needs people, the targeting mode asks for them first.
    const table = derived ? tableOutcome(derived, catalog, featureRuleKey(feature.id)) : null;
    if (table) {
      // V4c (D265): points spent on somebody else (안수) need that somebody.
      const others = table.party.healPoints && given && !given.self ? given.points : undefined;
      const wantsTargets = others || table.conditionsApplied.length || table.conditionsRemoved.length || table.party.tempHp || table.party.heal || table.party.healPool || table.party.grants.length || table.strikes?.length || table.conditionSaves?.length || table.effects?.length;
      let picked: string[] = [];
      if (wantsTargets) {
        picked = await requestTargets(`${feature.name} — 대상을 클릭하세요${table.party.max ? ` (최대 ${table.party.max}명)` : ""}`, { multi: true });
        if (!picked.length) return;
      }
      if (table.party.healPoints && !others && !(table.conditionsApplied.length || table.conditionsRemoved.length || table.strikes?.length || table.conditionSaves?.length)) return;
      c.runContract(me, featureRuleKey(feature.id), picked.map((id) => ({ pageId: page.id, tokenId: id })), others);
    }
    // R34 (D171): the feature's own contract, when the content ships one. 행동 폭증's `economy.modify` is the first
    // one that reaches the table: the turn gets its 행동 back instead of a sentence telling the player it did.
    const contract = catalog.contractFor(featureRuleKey(feature.id));
    const run = contract ? runEntryPoint(contract, contract.entryPoints[0]?.id ?? "", characterScope(derived)) : null;
    for (const effect of run?.effects ?? []) {
      if (effect.kind !== "economy" || effect.amount <= 0) continue;
      const which = economyBucketOf(effect.bucket);
      if (which === "action" || which === "bonus") c.spendEconomy(me, which, { grant: true, source: feature.name });
    }
  };
  /**
   * R29 (D155): the reaction menu. A player used to have exactly three reactions and all three had to be offered to
   * them by the host — Uncanny Dodge, Absorb Elements, Hellish Rebuke, Protection had no button anywhere. Reaction
   * features come from the activation notes; anything else is declared by name so the table (and the DM's palette)
   * can act on it. The host spends the reaction and posts the card.
   */
  const reactionItems: PanelItem[] = [
    // R30 (D159): a monster's reactions (받아넘기기 …) are on its stat block and had no button anywhere — only the
    // NPC sheet's text. They join the same menu, and the host spends the reaction the same way.
    ...(entry.kind === "npc" ? entry.statBlock.reactions.map((action) => ({
      key: `npc-reaction:${action.name}`,
      label: action.name,
      hint: action.text.slice(0, 80),
      disabled: false,
      onSelect: () => { if (action.kind === "attack" && action.attack) void attackWith({ source: "npc", actionName: action.name }); else c.react(me, action.name, { note: action.text.slice(0, 80) }); },
    })) : []),
    ...usable.filter((item) => item.economy === "reaction" && item.pressable).map((item) => ({
      key: `reaction:${item.feature.id}`,
      label: item.feature.name,
      uses: item.left !== undefined ? `${item.left}/${item.pool!.max}` : undefined,
      hint: `${item.left !== undefined ? `${item.left}/${item.pool!.max} · ` : ""}${item.activation.note ?? ""}`,
      disabled: item.left !== undefined && item.left <= 0,
      onSelect: () => { const formula = item.activation.roll?.(derived!)?.formula; c.react(me, item.feature.name, formula ? { formula } : { note: item.activation.note }); if (item.activation.resourceId) void useIt(item.feature); },
    })),
    { key: "reaction:free", label: "직접 적기…", uses: undefined as string | undefined, disabled: false, hint: "이름 (그리고 원하면 주사위 식)", onSelect: () => {
      const name = window.prompt("어떤 반응입니까? (예: 오싹한 회피, 원소 흡수, 지옥의 응징)")?.trim();
      if (!name) return;
      const formula = window.prompt(`${name} — 굴릴 주사위가 있으면 적으세요 (예: 2d10+3). 없으면 비워 두세요.`)?.trim();
      c.react(me, name, formula ? { formula } : {});
    } },
  ];
  const featureItems: PanelItem[] = entry.kind === "npc"
    // R65 (D200): a stat block's traits are mostly passive text; only the ones with uses to count become buttons.
    ? entry.statBlock.traits.filter((trait) => entry.runtime.traitUses?.[trait.name] !== undefined).map((trait) => { const most = entry.runtime.traitUses?.[trait.name]; const used = entry.runtime.uses?.[`trait:${trait.name}`] ?? 0; return { key: trait.name, label: trait.name, hint: `${most ? `${Math.max(0, most - used)}/${most} 남음 · ` : ""}${trait.text.slice(0, 60)}`, disabled: most !== undefined && used >= most, onSelect: () => c.useTrait(me, trait.name) }; })
    // R65 (D200): only what pressing does something for, and only what is not a bonus action or a reaction (those have rows).
    : usable.filter((item) => item.pressable && (item.economy === "action" || item.economy === "free")).map((item) => ({ key: item.feature.id, label: item.feature.name, uses: item.left !== undefined ? `${item.left}/${item.pool!.max}` : undefined, hint: item.left !== undefined ? `${item.left}/${item.pool!.max}${item.activation.note ? ` · ${item.activation.note}` : ""}` : item.activation.note, disabled: item.left !== undefined && item.left <= 0, onSelect: () => void useIt(item.feature) }));
  const items = entry.kind === "character" && derived ? derived.inventory.filter((item) => item.quantity > 0 && !["weapon", "armor", "shield"].includes(item.kind)) : [];
  const useItem = async (item: DerivedItem) => {
    if (entry.kind !== "character" || !derived) return;
    const use = itemUse(item, catalog);
    // R10: a potion can be poured into anyone's mouth — pick who drinks (yourself included); the host rolls and applies.
    if (use.heal) {
      const picked = await requestTargets(`${item.name} — 마실 대상을 클릭하세요 (자기 자신도)`, { multi: false });
      if (!picked.length) return;
      c.useItem(me, { pageId: page.id, tokenId: picked[0] }, item.instanceId);
      return;
    }
    let healed: number | undefined;
    saveRuntime((current) => { let next = noteLog(current, `${use.text}${healed !== undefined ? ` — ${healed} 회복` : ""}`); if (healed !== undefined) next = applyHealing(next, derived, healed); if (use.consumes) next = setItemQuantity(next, derived, item.instanceId, item.quantity - 1); return next; });
    c.say(`/em ${token.name}: ${use.text}${healed !== undefined ? ` (${healed} 회복)` : ""}`);
  };
  // R19 (D113): a 주문 두루마리 in the bag casts its spell — no slot, and the scroll is gone.
  const itemItems = items.map((item) => {
    const spellId = scrollSpellId(item.itemId);
    const view = spellId ? catalog.spellById(spellId) : undefined;
    const highest = derived ? Math.max(0, ...Object.entries(derived.spellSlots).filter(([, max]) => max > 0).map(([level]) => Number(level))) : 0;
    if (spellId && view && spellExec(spellId)) {
      const overLevel = view.level > highest;
      return { key: item.instanceId, label: `📜 ${item.name}`, hint: `${item.quantity > 1 ? `×${item.quantity} · ` : ""}두루마리로 시전 (슬롯 없음)${overLevel ? ` · 지능(신비학) DC ${scrollCheckDc(view.level)} — DM 판단` : ""}`, onSelect: () => void castIt(spellId, view.name, { kind: "scroll", instanceId: item.instanceId }) };
    }
    return { key: item.instanceId, label: item.name, hint: `${item.quantity > 1 ? `×${item.quantity} · ` : ""}${itemUse(item, catalog).heal ? `회복 ${itemUse(item, catalog).heal}` : itemUse(item, catalog).consumes ? "소모" : "기록"}`, onSelect: () => void useItem(item) };
  });
  const bonusItems: PanelItem[] = [
    ...(entry.kind === "npc" ? entry.statBlock.bonusActions.map((action) => ({ key: action.name, label: `${action.kind === "attack" && action.attack ? "⚔ " : ""}${action.name}`, hint: action.text?.slice(0, 60), onSelect: () => { if (action.kind === "attack" && action.attack) void attackWith({ source: "npc", actionName: action.name }); else c.act(me, "utilize", { note: action.name, bonus: true }); } })) : []),
    ...usable.filter((item) => item.bonus && item.pressable).map((item) => ({ key: item.feature.id, label: item.feature.name, uses: item.left !== undefined ? `${item.left}/${item.pool!.max}` : undefined, hint: item.activation.note, disabled: item.left !== undefined && item.left <= 0, onSelect: () => void useIt(item.feature, true) })),
    // R59 (D194): the official actions a contract moved into this menu (예리한 정신's 빠른 연구, 관찰력's 빠른 수색).
    ...(derived?.bonusActions ?? []).filter((item) => item.kind !== "attack").map((item) => ({ key: `bonus-as:${item.kind}`, label: actionDef(item.kind as ActionKind).name, hint: item.source, onSelect: () => void take(actionDef(item.kind as ActionKind), true) })),
    // R61 (D196): one more swing as a bonus action (쌍수 사용자, 장병기 달인, 대형 무기 달인's 베어 넘기기). The
    // weapons it covers come from the contract's own filter, so a heavy-weapon rule never offers a dagger.
    ...(derived?.bonusActions ?? []).filter((item) => item.kind === "attack").flatMap((item) => {
      const filter = item.attackScope && item.attackScope !== "any" ? attackScopeFilter(item.attackScope) : undefined;
      return (derived?.attacks ?? []).filter((attack) => attack.itemId && (!filter || filter(attack))).map((attack) => ({
        key: `bonus-attack:${item.source}:${attack.id}`, label: `⚔ ${attack.name}`, hint: `${item.source} · ${item.free ? "턴 소모 없음" : "추가 행동"}${item.count ? ` · ${item.count}회` : ""}`,
        // V4p (D278): 무리 파괴자's swing costs nothing of the turn, so nothing is spent for it.
        onSelect: () => { void attackWith({ source: "weapon", attackId: attack.id }); if (!item.free) c.spendEconomy(me, "bonus"); },
      }));
    }),
    { key: "note", label: "기록…", hint: "다른 추가 행동을 쓴 것으로 남김", onSelect: () => void take({ ...actionDef("utilize"), name: "추가 행동", text: "무엇을" }, true) },
  ];
  // 마법 (D102): the sheet's castable spells or the stat block's lists; targets from the board, the slot from a dialog.
  const castIt = async (spellId: string, name: string, forced?: CastMethod) => {
    const base = spellExec(spellId);
    const exec = base && forced?.kind === "sustain" ? sustainedExec(base) : base;
    if (!exec) return;
    const selfOnly = exec.targeting.allowedRelations?.every((relation) => relation === "self");
    let targets: string[] = selfOnly ? [token.id] : [];
    if (!selfOnly) {
      // V4v (D284): a bigger slot may reach more creatures (축복) — the highest slot this sheet could spend decides
      // how many the window lets the player click; the host checks the count against the slot actually spent.
      const highestSlot = entry.kind === "character" && derived ? Math.max(exec.baseLevel, ...Object.entries(derived.spellSlots).filter(([, max]) => max > 0).map(([slot]) => Number(slot))) : exec.baseLevel;
      const mayTake = targetCountOf(exec, highestSlot);
      targets = await requestTargets(`${name} — 대상을 클릭하세요${mayTake > 1 ? ` (최대 ${mayTake >= 64 ? "범위 안 전부" : `${mayTake}명`})` : ""}`, { multi: mayTake > 1, exclude: exec.targeting.allowedRelations?.includes("self") ? undefined : token.id });
      if (!targets.length) return;
      if (targets.length > mayTake) targets = targets.slice(0, mayTake);
    }
    let method: CastMethod | undefined = forced;
    if (!forced && entry.kind === "character" && derived) {
      const view = catalog.spellById(spellId);
      const options = view ? castOptions(view, derived, currentRuntime()) : [];
      if (!options.length) { alert("슬롯이나 횟수가 없습니다."); return; }
      const chosen = options.length === 1 ? options[0].method : await requestCastMethod({ name, options });
      if (!chosen || typeof chosen === "string") return;
      method = chosen;
    }
    let overrides: AttackOverrides | undefined;
    if (isGm && exec.primary.kind === "attack-damage") { const answer = await requestAttackOptions({ name, gm: true }); if (answer === null) return; overrides = answer.overrides; }
    const variant = forced?.kind === "sustain" ? undefined : await requestSpellVariant(spellId, name);
    if (variant === null) return;
    // V4r (D280): the metamagics this sheet knows and can pay for, offered once the method is settled.
    let metamagic: string[] | undefined;
    if (entry.kind === "character" && derived && forced?.kind !== "sustain") {
      const points = derived.resources.find((resource) => resource.id === "resource.sorcerer.sorcery-points");
      const left = points ? points.max - (currentRuntime().resourcesUsed[points.id] ?? 0) : 0;
      // V4w (D285): a metamagic that needs something this cast has not got is not offered (내성 없는 주문에 고양 주문).
      const has = (need: string | undefined) => {
        if (!need) return true;
        if (need === "save") return Boolean("saveAbility" in exec.primary && exec.primary.saveAbility);
        if (need === "damage") return Boolean("damageType" in exec.primary && exec.primary.damageType);
        if (need === "attack") return exec.primary.kind === "attack-damage";
        if (need === "action") return exec.castingEconomy === "action";
        if (need === "duration") return Boolean(exec.concentration) || Boolean("duration" in exec.primary && exec.primary.duration);
        if (need === "range") return Boolean(exec.targeting.rangeFeet);
        return true;
      };
      const known = metamagicOptions(derived, catalog, characterScope(derived)).filter((option) => option.cost <= left && has(option.needs));
      // V5h (D296): 마법 화신 lets two ride on one cast, and 비전의 신격 makes one of them free.
      const limit = derived.metamagicLimit ?? 1;
      const picked: string[] = [];
      for (let round = 0; round < limit; round += 1) {
        const rest = known.filter((option) => !picked.includes(option.key));
        if (!rest.length) break;
        const free = derived.metamagicFree && round === 0 ? " · 첫 하나는 무료" : "";
        const answer = await requestCastMethod({ name, title: `${name} — 메타매직 ${limit > 1 ? `(${round + 1}/${limit}) ` : ""}(마법 점수 ${left})${free}`, options: [{ label: "쓰지 않음", method: "" }, ...rest.map((option) => ({ label: `${option.name} (${option.cost}점)${option.note ? ` · ${option.note}` : ""}`, method: option.key }))] });
        if (answer === null) return;
        const chosenKey = typeof answer === "string" ? answer : "";
        if (!chosenKey) break;
        picked.push(chosenKey);
      }
      if (picked.length) metamagic = picked;
    }
    c.cast(me, spellId, targets.map((id) => ({ pageId: page.id, tokenId: id })), method, overrides, readiedNow || undefined, undefined, variant, metamagic);
  };
  // R77 (D212): a concentration spell that is still going can be used again without a slot — 영적 무기 as a bonus
  // action, 흡혈의 손길 as an action, 달빛 광선's damage when somebody walks in (no economy at all).
  // R80 (D214): a monster's too, from the effects its runtime carries.
  const sustainItems = entry.kind === "character" || entry.kind === "npc" ? ((entry.kind === "character" ? currentRuntime().effects : entry.runtime.effects) ?? []).filter((effect) => effect.source === "spell").flatMap((effect) => {
    const spellId = effect.key.replace(/^spell:/, "");
    const exec = spellExec(spellId);
    const sustain = exec ? sustainOf(exec) : null;
    if (!sustain) return [];
    return [{ key: `sustain:${spellId}`, economy: sustain.economy, label: `↻ ${effect.name}`, hint: `${sustain.note ?? "지속 중인 주문을 다시"} · 슬롯 없음${sustain.economy === "none" ? " · 행동 소모 없음 (범위에 들어온 대상)" : ""}`, onSelect: () => void castIt(spellId, effect.name, { kind: "sustain" }) }];
  }) : [];
  const spellItems = entry.kind === "character" && derived
    ? castableSpells(derived).map((id) => ({ id, view: catalog.spellById(id), exec: spellExec(id)! })).sort((a, b) => (a.view?.level ?? 0) - (b.view?.level ?? 0) || (a.view?.name ?? "").localeCompare(b.view?.name ?? "", "ko")).map(({ id, view, exec }) => ({ key: id, label: `${view?.level ? `${view.level}레벨 ` : "소마법 "}${view?.name ?? id}`, hint: describeSpellExec(exec), onSelect: () => void castIt(id, view?.name ?? id) }))
    : entry.kind === "npc"
      ? (entry.statBlock.actions.find((action) => action.kind === "spellcasting" && action.spellcasting)?.spellcasting?.lists ?? []).flatMap((list) => list.entries.filter((item) => item.spellId && spellExec(item.spellId)).map((item) => ({ key: `${list.frequency}:${item.spellId}`, label: `${item.name}${item.slotLevel ? ` (${item.slotLevel}레벨)` : ""}`, hint: `${list.frequency === "at-will" ? "의지대로" : list.frequency === "per-day" ? `${Math.max(0, (list.uses ?? 1) - (entry.runtime.uses?.[item.spellId!] ?? 0))}/${list.uses ?? 1} 남음 (일)` : list.frequency} · ${describeSpellExec(spellExec(item.spellId!)!)}`, disabled: list.frequency === "per-day" && (entry.runtime.uses?.[item.spellId!] ?? 0) >= (list.uses ?? 1), onSelect: () => void castIt(item.spellId!, item.name) })))
      : [];
  // R77 (D212): a bonus-action spell is found on the bonus-action row too, where the turn says it belongs.
  // R89 (D224): the areas on this page held by some caster (영혼 수호자, 달빛 광선, 가시 성장) — in or out, and moving inside.
  const zones = page.tokens.flatMap((other) => {
    const holder = other.represents ? c.table.snapshot!.journal.find((item) => item.id === other.represents) : undefined;
    if (!holder || holder.kind === "handout") return [];
    return (holder.runtime.effects ?? []).filter((effect) => effect.key.startsWith("spell:")).flatMap((effect) => {
      const spellId = effect.key.slice("spell:".length);
      const exec = spellExec(spellId);
      const sustain = exec ? sustainOf(exec) : null;
      return sustain?.economy === "none" ? [{ casterId: holder.id, spellId, name: effect.name, move: sustain.move, casterName: other.name }] : [];
    });
  }).concat(page.tokens.flatMap((other) => {
    // R103 (D238): a monster aura on the page — marking yourself inside means you take it at the end of its turn.
    const holder = other.represents ? c.table.snapshot!.journal.find((item) => item.id === other.represents) : undefined;
    return holder?.kind === "npc" ? monsterAuras(holder.statBlock).map((aura) => ({ casterId: holder.id, spellId: `aura:${aura.name}`, name: aura.name, move: undefined, casterName: other.name })) : [];
  })).filter((zone, index, all) => all.findIndex((item) => item.casterId === zone.casterId && item.spellId === zone.spellId) === index);
  const zoneButtons = zones.map((zone) => {
    const inside = (entry.runtime.effects ?? []).some((effect) => effect.key === `zone:${zone.casterId}:${zone.spellId}`);
    const title = `${zone.casterName}의 ${zone.name}`;
    return (
      <span key={`${zone.casterId}:${zone.spellId}`} className="cl-row" style={{ gap: 2 }}>
        {inside ? <button type="button" className="cl-btn small" title={title} onClick={() => c.zone(zone.casterId, zone.spellId, me, "leave")}>{zone.name} 빠져나감</button> : <button type="button" className="cl-btn small attack" title={`${title} — 들어가면 바로 판정`} onClick={() => c.zone(zone.casterId, zone.spellId, me, "enter")}>{zone.name} 들어감</button>}
        {inside && zone.move ? <button type="button" className="cl-btn small attack" title={`${title} 안에서 ${zone.move}피트 이동`} onClick={() => c.zone(zone.casterId, zone.spellId, me, "move", zone.move)}>{zone.move}피트 이동함</button> : null}
      </span>
    );
  });
  const bonusSpellItems = spellItems.filter((item) => spellExec(item.key.split(":").pop() ?? "")?.castingEconomy === "bonus-action");
  // R9: the stat block's multiattack routine as one button (each attack its own card, one pre-roll dialog for all), its save
  // actions (breath, gaze) resolved like save spells (D103), and its legendary actions from the per-round pool (D104).
  const block = entry.kind === "npc" ? entry.statBlock : null;
  const routine = block?.actions.find((action) => action.kind === "multiattack" && action.multiattack?.routine?.length)?.multiattack?.routine?.filter((step) => block!.actions.some((action) => action.name === step.name && action.kind === "attack" && action.attack)) ?? [];
  const multiattack = async () => {
    // R13: several targets share the routine in order (찢기 1 → A, 찢기 2 → B, 찢기 3 → A …).
    const picked = await requestTargets(`다중공격 (${routine.map((step) => `${step.name}×${step.count}`).join(", ")}) — 대상을 클릭하세요 (여러 명이면 차례로 배분)`, { multi: true, exclude: token.id });
    if (!picked.length) return;
    let overrides: AttackOverrides | undefined;
    if (isGm) { const answer = await requestAttackOptions({ name: "다중공격", gm: true }); if (answer === null) return; overrides = answer.overrides ?? {}; }
    let at = 0;
    for (const step of routine) for (let n = 0; n < step.count; n += 1) { await attackWith({ source: "npc", actionName: step.name }, { targets: [picked[at % picked.length]], overrides: overrides ?? {} }); at += 1; }
  };
  // R31 (D160): a trait whose save is fully parsed (사체 폭발, 악취, 공포 오라 …) gets the same ☄ button its
  // action-shaped cousins have — the data was complete and nothing could fire it.
  const saveActions = [...(block?.actions ?? []), ...(block?.traits ?? [])].filter((action) => action.kind === "save" && action.save);
  const npcSaveWith = async (actionName: string, legendary = false) => {
    const picked = await requestTargets(`${actionName} — 범위 안의 대상을 클릭하세요 (여러 명)`, { multi: true, exclude: token.id });
    if (!picked.length) return;
    const refs = picked.map((id) => ({ pageId: page.id, tokenId: id }));
    if (legendary) c.legendary(me, actionName, refs); else c.npcSave(me, actionName, refs);
  };
  const legendaryPer = block?.legendaryActionsPerRound ?? 0;
  const legendaryLeft = entry.kind === "npc" ? Math.max(0, legendaryPer - entry.runtime.legendaryUsed) : 0;
  const legendaryItems = (block?.legendaryActions ?? []).map((action) => ({ key: action.name, label: `${action.name}${(action.legendaryCost ?? 1) > 1 ? ` (${action.legendaryCost})` : ""}`, hint: action.text.slice(0, 80), disabled: (action.legendaryCost ?? 1) > legendaryLeft, onSelect: () => { if (action.kind === "save" && action.save) void npcSaveWith(action.name, true); else c.legendary(me, action.name); } }));
  // R72 (D207): from the sheet's contracts, not from feature names (which missed the fighter's fourth attack at 20).
  const extraAttacks = derived?.attackActionAttacks ?? 1;
  const initiativeBonus = derived ? derived.initiative : entry.kind === "npc" ? entry.statBlock.initiativeBonus : 0;
  const inTracker = tracker.turns.some((item) => item.tokenId === token.id && item.pageId === page.id);
  const chip = (label: string, used: boolean | undefined) => <span className={`cl-econ${used ? " used" : ""}`} title={used ? `${label} 사용함` : `${label} 남음`}><i />{label}</span>;
  const status = mode === "turn" ? (isGm ? `${token.name}의 턴` : "당신의 턴") : readiedNow ? "⏳ 준비한 행동 — 지금 발동" : inCombat ? `${turn?.name ?? "…"}의 턴 · 기다리는 중` : "전투 전";
  return (
    <div className={`cl-cmd ${mode}`} role="region" aria-label={mode === "turn" ? `${token.name}의 턴` : `${token.name} 대기`}>
      <div className="cl-cmd-who">
        <span className="cl-cmd-status">{status}</span>
        <span className="cl-cmd-name">{mode === "turn" && !isGm ? token.name : mode === "turn" ? (tracker.turns.length ? `라운드 ${tracker.round}` : "") : token.name}</span>
        {/* R27 (D142): the chips used to appear only on your own turn — exactly when you do not need to ask. Out of
            turn the reaction is the one that matters ("do you still have it?"), so the row is always there. */}
        {blocked ? <span className="cl-pill bad">{blocked}: 행동 불가</span> : null}
      </div>
      {/* R65 (D200): one row per part of the turn, labelled with whether it is still in hand. What can be pressed is a
          button with its uses left, not an entry in a menu that has to be opened to be found. */}
      <div className={`cl-cmd-rows${mode === "turn" || inCombat ? " cl-turn-econ" : ""}`} role="toolbar" aria-label={`${token.name} 액션`}>
        <div className="cl-cmd-row attack">
          <span className="cl-cmd-label">{mode === "turn" || inCombat ? chip(!turn?.actionUsed && (turn?.attacksMade ?? 0) > 0 && extraAttacks > 1 ? `행동 · 공격 ${turn!.attacksMade}/${extraAttacks}` : "행동", turn?.actionUsed) : "행동"}</span>
          {derived ? derived.attacks.map((attack) => <button type="button" key={attack.id} className="cl-btn small attack" disabled={offAttack} title={extraAttacks > 1 ? `추가 공격: 공격 행동 하나로 ${extraAttacks}번 — 버튼을 ${extraAttacks}번 누르세요` : undefined} onClick={() => void attackWith({ source: "weapon", attackId: attack.id })}>⚔ {attack.name} <b>{attack.attackBonus >= 0 ? "+" : ""}{attack.attackBonus}</b>{extraAttacks > 1 ? <small className="cl-extra">×{extraAttacks}</small> : null}{attack.masteryActive && attack.mastery ? <small className="cl-extra" title={`무기 통달: ${attack.mastery}`}>⚒{attack.mastery}</small> : null}</button>) : null}
          {entry.kind === "npc" && routine.length ? <button type="button" className="cl-btn small attack" disabled={offAttack} title={block?.actions.find((action) => action.kind === "multiattack")?.text} onClick={() => void multiattack()}>⚔⚔ 다중공격 <small className="cl-extra">{routine.map((step) => `${step.name}×${step.count}`).join(" ")}</small></button> : null}
          {entry.kind === "npc" ? entry.statBlock.actions.filter((action) => action.kind === "attack" && action.attack).map((action) => <button type="button" key={action.name} className="cl-btn small attack" disabled={offAttack || Boolean(action.timing?.recharge && entry.runtime.spent[action.name])} onClick={() => void attackWith({ source: "npc", actionName: action.name })}>⚔ {action.name} <b>{action.attack!.bonus >= 0 ? "+" : ""}{action.attack!.bonus}</b></button>) : null}
          {ACTIONS.filter((def) => def.kind === "grapple" || def.kind === "shove" || def.kind === "escape").map((def) => { const needsHand = (def.kind === "grapple" || def.kind === "shove") && !freeHand; return <button type="button" key={def.kind} className="cl-btn small" disabled={off || needsHand || (def.kind === "escape" && !conditions.has("붙잡힘"))} title={needsHand ? "빈 손이 없습니다 (보조 손이나 양손 무기를 내려놓으세요)" : def.summary} onClick={() => void take(def)}>{def.name}</button>; })}
          {saveActions.map((action) => { const waiting = Boolean(action.timing?.recharge && entry.kind === "npc" && entry.runtime.spent[action.name]); return <button type="button" key={action.name} className="cl-btn small attack" disabled={off || waiting} title={`${action.text.slice(0, 160)}${waiting ? " — 재충전 대기" : ""}`} onClick={() => void npcSaveWith(action.name)}>☄ {action.name} <b>DC {action.save!.dc}</b>{waiting ? <small className="cl-extra">재충전 대기</small> : null}</button>; })}
          {sustainItems.filter((item) => item.economy !== "bonus-action").map((item) => <button type="button" key={item.key} className="cl-btn small attack" disabled={item.economy === "none" ? Boolean(blocked) : offAttack} title={item.hint} onClick={item.onSelect}>{item.label}{item.economy === "none" ? <small className="cl-extra">무료</small> : null}</button>)}
          <Dropdown up label="✨ 마법" disabled={offAttack || !spellItems.length} items={spellItems} />
          {legendaryPer ? <Dropdown up label={`👑 전설 ${legendaryLeft}/${legendaryPer}`} disabled={off || !inCombat || !legendaryLeft} items={legendaryItems} /> : null}
          <Dropdown up label="공식 행동" disabled={off} items={ACTIONS.filter((def) => !["grapple", "shove", "escape"].includes(def.kind)).map((def) => ({ key: def.kind, label: def.name, hint: def.summary, onSelect: () => void take(def) }))} />
          {featureItems.map((item) => <button type="button" key={item.key} className="cl-btn small feature" disabled={Boolean(blocked) || item.disabled} title={item.hint} onClick={item.onSelect}>{item.label}{item.uses ? <small className="cl-uses">{item.uses}</small> : null}</button>)}
        </div>
        <div className="cl-cmd-row">
          <span className="cl-cmd-label">{mode === "turn" || inCombat ? chip("추가 행동", turn?.bonusUsed) : "추가 행동"}</span>
          {sustainItems.filter((item) => item.economy === "bonus-action").map((item) => <button type="button" key={item.key} className="cl-btn small attack" disabled={off} title={item.hint} onClick={item.onSelect}>{item.label}</button>)}
          {bonusSpellItems.length ? <Dropdown up label="✨ 추가 행동 마법" disabled={off} items={bonusSpellItems} /> : null}
          {bonusItems.map((item) => <button type="button" key={item.key} className={`cl-btn small${item.key === "note" ? " quiet" : " feature"}`} disabled={off || item.disabled} title={item.hint} onClick={item.onSelect}>{item.label}{item.uses ? <small className="cl-uses">{item.uses}</small> : null}</button>)}
        </div>
        {/* R29 (D155): the reaction is the one thing a player needs out of turn, so the row is there in combat. */}
        {inCombat ? (
          <div className="cl-cmd-row">
            <span className="cl-cmd-label">{chip("반응", turn?.reactionUsed)}</span>
            {reactionItems.map((item) => <button type="button" key={item.key} className={`cl-btn small${item.key === "reaction:free" ? " quiet" : " feature"}`} disabled={Boolean(blocked) || Boolean(turn?.reactionUsed) || item.disabled} title={item.hint} onClick={item.onSelect}>{item.label}{item.uses ? <small className="cl-uses">{item.uses}</small> : null}</button>)}
          </div>
        ) : null}
        {zoneButtons.length ? (
          <div className="cl-cmd-row">
            <span className="cl-cmd-label">상황</span>
            {zoneButtons}
          </div>
        ) : null}
        <div className="cl-cmd-row quiet">
          <span className="cl-cmd-label">그 밖</span>
          <Dropdown up label="판정" items={checkItems} />
          <Dropdown up label="아이템" disabled={Boolean(blocked) || !itemItems.length} items={itemItems} />
          {!inTracker ? <button type="button" className="cl-btn small" onClick={() => c.addTurn({ name: token.name, tokenId: token.id, pageId: page.id, entryId: entry.id, image: token.image }, initiativeBonus)} title="1d20 + 이니셔티브 보너스를 굴려 트래커에 넣습니다">이니셔티브 {initiativeBonus >= 0 ? "+" : ""}{initiativeBonus}</button> : null}
          {!inTracker ? <button type="button" className="cl-btn small" onClick={() => c.addTurn({ name: token.name, tokenId: token.id, pageId: page.id, entryId: entry.id, image: token.image }, initiativeBonus, true)} title="기습당함: 이니셔티브를 불리로 굴리고 첫 라운드 추가 턴도 없습니다">기습당함</button> : null}
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
interface AttackAsk { name: string; /** H2 (D239): the weapon spells the attacker knows. */ weaponSpells?: string[]; /** R52 (D187): the riders this sheet's contracts let the player declare on this weapon, before the dice. */ riders?: ContractRider[]; /** R33 (D168): this weapon is Light, so it may be swung as the off-hand attack. */ offHand?: boolean; /** R33 (D168): the feat that keeps the ability modifier on that swing, when the sheet has one. */ offHandFeat?: string; gm: boolean; /** R31 (D164): stat-block lines that could change this roll but depend on where everyone is standing. */ notes?: SituationAsk[]; resolve: (answer: AttackAnswer | null) => void }
export interface AttackAnswer { riders?: AttackRiders; overrides?: AttackOverrides }
const attackAskListeners = new Set<(ask: AttackAsk) => void>();
export const requestAttackOptions = (ask: Omit<AttackAsk, "resolve">) => new Promise<AttackAnswer | null>((resolve) => { if (!attackAskListeners.size) { resolve({}); return; } for (const listener of [...attackAskListeners]) listener({ ...ask, resolve }); });
/**
 * R31 (D164): the stat-block traits that would change this attack roll if the table knew where everyone stood.
 * A scene has no positions (D109), so the app cannot decide them — it names them next to the 유리·불리 buttons
 * instead of pretending they do not exist.
 */
export interface SituationAsk { id: string; label: string; note: string; grants?: "advantage" | "disadvantage" }
/** H1 (D238): the situational trait rules on the attacker (its own) and on the targets (theirs) — checkboxes when they decide a roll, notes otherwise. */
function situationalTraits(attacker: JournalEntry, targets: JournalEntry[]): SituationAsk[] {
  const asks: SituationAsk[] = [];
  const add = (entry: JournalEntry, side: "attacker" | "target") => {
    if (entry.kind !== "npc") return;
    for (const { trait, rule } of traitRules(entry.statBlock)) {
      if (rule.pattern !== "situational" || rule.side !== side) continue;
      const id = `${entry.statBlock.id}:${trait.name}`;
      if (!asks.some((item) => item.id === id)) asks.push({ id, label: rule.button ?? trait.name, note: rule.note, ...(rule.grants ? { grants: rule.grants } : {}) });
    }
  };
  add(attacker, "attacker");
  for (const target of targets) add(target, "target");
  return asks;
}

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
  // R52 (D187): the open half — one checkbox per rider a contract declared, keyed by its rule key.
  const [declared, setDeclared] = useState<string[]>([]);
  // R57 (D192): and one per fact a rider asks about, because the scene cannot see where anyone is standing.
  const [facts, setFacts] = useState<string[]>([]);
  const [offHand, setOffHand] = useState(false);
  const [weaponSpell, setWeaponSpell] = useState("");
  const { catalog } = useClient();
  const [situations, setSituations] = useState<string[]>([]);
  const [advantage, setAdvantage] = useState<"auto" | Advantage>("auto");
  const [cover, setCover] = useState<0 | 2 | 5>(0);
  const [outcome, setOutcome] = useState<"" | "hit" | "crit" | "miss">("");
  const done = () => {
    const overrides: AttackOverrides = {};
    if (advantage !== "auto") overrides.advantage = advantage;
    const confirmed = (ask.notes ?? []).filter((situation) => situation.grants && situations.includes(situation.id)).map((situation) => ({ reason: situation.label, grants: situation.grants! }));
    if (confirmed.length) overrides.situational = confirmed;
    if (ask.gm && cover) overrides.cover = cover;
    if (ask.gm && outcome) overrides.outcome = outcome;
    onDone({ riders: { offHand: Boolean(ask.offHand) && offHand, ...(weaponSpell && ask.weaponSpells?.includes(weaponSpell) ? { weaponSpell } : {}), ...(declared.length ? { contracts: declared } : {}), ...(facts.length ? { facts } : {}) }, overrides: Object.keys(overrides).length ? overrides : undefined });
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
      {/* R33 (D168): the off-hand swing. Without 쌍수 전투 it loses the ability modifier; with it the modifier stays. */}
      {ask.offHand ? <label className="cl-row cl-small" style={{ gap: 6 }}><input type="checkbox" checked={offHand} onChange={(event) => setOffHand(event.target.checked)} /> 보조 손 공격 ({ask.offHandFeat ? `${ask.offHandFeat} — 능력 수정치 유지` : "피해에 능력 수정치 없음"})</label> : null}
      {ask.weaponSpells?.length ? <div className="cl-field"><label htmlFor="cl-attack-weapon-spell">무기로 거는 주문</label><select id="cl-attack-weapon-spell" className="cl-select" value={weaponSpell} onChange={(event) => setWeaponSpell(event.target.value)}><option value="">없음 (보통 공격)</option>{ask.weaponSpells.map((spellId) => <option key={spellId} value={spellId}>{catalog.spellById(spellId)?.name ?? spellId} — 주문 능력치로 명중·피해 · 행동</option>)}</select></div> : null}
      {/* R52 (D187): 광란, 대형 무기 달인의 중량 무기 숙달 and every other "declare it before the roll" rule the
          content ships. The list is the sheet's own, so a rule the character does not have never appears. */}
      {(ask.riders ?? []).map((rider) => (
        <div key={rider.key}>
          <label className="cl-row cl-small" style={{ gap: 6 }}>
            <input type="checkbox" checked={declared.includes(rider.key)} onChange={(event) => setDeclared((current) => (event.target.checked ? [...current, rider.key] : current.filter((key) => key !== rider.key)))} />
            {rider.label}{rider.hint ? ` (${rider.hint})` : ""}
          </label>
          {/* R57 (D192): the facts it turns on. Shown only once the rider itself is ticked, indented under it. */}
          {declared.includes(rider.key) ? rider.facts.map((fact) => (
            <label key={fact.id} className="cl-row cl-small" style={{ gap: 6, paddingLeft: 22 }}>
              <input type="checkbox" checked={facts.includes(fact.id)} onChange={(event) => setFacts((current) => (event.target.checked ? [...current, fact.id] : current.filter((id) => id !== fact.id)))} />
              {fact.question}
            </label>
          )) : null}
        </div>
      ))}
      {ask.notes?.length ? <div className="cl-field"><label>자리에 따라 (앱이 볼 수 없는 사실)</label>{ask.notes.map((situation) => situation.grants ? <label key={situation.id} className="cl-row cl-small" style={{ gap: 6 }} title={situation.note}><input type="checkbox" checked={situations.includes(situation.id)} onChange={(event) => setSituations((list) => (event.target.checked ? [...list, situation.id] : list.filter((id) => id !== situation.id)))} /> {situation.label} <span className="cl-quiet">({situation.grants === "advantage" ? "유리" : "불리"})</span></label> : <div key={situation.id} className="cl-quiet cl-small">DM 판정 — {situation.note}</div>)}</div> : null}
      <p className="cl-quiet cl-small">진행 중인 효과의 추가 주사위(격노·사냥꾼의 표식 등)는 저절로 붙습니다. 암습·신성한 강타처럼 명중했을 때 고르는 것은 명중한 뒤에 묻습니다. 판정 뒤에도 DM 팔레트로 고칠 수 있습니다.</p>
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
/* ---------- R12: a card points at its creature; a ribbon row points at its cards ---------- */

type Highlight = { entryId?: string; tokenId?: string } | null;
const highlightListeners = new Set<(value: Highlight) => void>();
/** Hovering a chat card lights the creature it is about on the board. */
export const setHighlight = (value: Highlight) => { for (const listener of highlightListeners) listener(value); };
function useHighlight() {
  const [value, setValue] = useState<Highlight>(null);
  useEffect(() => { highlightListeners.add(setValue); return () => { highlightListeners.delete(setValue); }; }, []);
  return value;
}
const highlights = (value: Highlight, token: Token) => Boolean(value && ((value.tokenId && value.tokenId === token.id) || (value.entryId && token.represents === value.entryId)));
/** Clicking a ribbon row scrolls the chat to that creature's latest card and flashes it. */
export const flashCardsFor = (name: string) => {
  const cards = [...document.querySelectorAll<HTMLElement>(".cl-chat-list .cl-chat-msg")].filter((element) => (element.textContent ?? "").includes(name));
  const last = cards[cards.length - 1];
  if (!last) return;
  last.scrollIntoView({ block: "center", behavior: "smooth" });
  last.classList.add("cl-flash");
  window.setTimeout(() => last.classList.remove("cl-flash"), 1600);
};

function SceneBoard({ page, tokens, selected, targeting, turnTokenId, acting, journal, isGm, onPointerDown, onPointerDownBoard, onContextMenu, onDoubleClick, onLeave }: {
  page: Page; tokens: Token[]; selected: string[]; targeting: TargetingState | null; turnTokenId?: string; acting?: Token; journal: JournalEntry[]; isGm: boolean;
  onPointerDown: (event: ReactPointerEvent, token: Token) => void; onPointerDownBoard: () => void; onContextMenu: (event: React.MouseEvent, token: Token) => void; onDoubleClick: (token: Token) => void; onLeave: (token: Token) => void;
}) {
  const c = useCampaigns();
  const { catalog } = useClient();
  const snapshot = c.table.snapshot!;
  const floats = useCardFloats(page, journal);
  const highlight = useHighlight();
  const visible = tokens;
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
      candidate={targeting ? targeting.exclude !== token.id : null} turn={turnTokenId === token.id} dimmed={inCombat && !targeting && turnTokenId !== undefined && turnTokenId !== token.id} floats={floats.filter((item) => item.tokenId === token.id)} highlighted={highlights(highlight, token)}
      leave={Boolean(acting && acting.id !== token.id && token.represents && !targeting)} onPointerDown={(event) => onPointerDown(event, token)} onContextMenu={(event) => onContextMenu(event, token)} onDoubleClick={() => onDoubleClick(token)} onLeave={() => onLeave(token)} />
  );
  const row = (label: string, kind: "pc" | "npc", list: Token[], hint: string) => (
    <section className={`cl-scene-row ${kind}`} aria-label={label}>
      <h4>{label}{list.length ? <span className="cl-quiet"> {list.length}</span> : null}</h4>
      <div className="cl-scene-cards">{list.length ? list.map(card(kind)) : <span className="cl-scene-hint cl-quiet cl-small">{hint}</span>}</div>
    </section>
  );
  return (
    <div className={`cl-scene${targeting ? " targeting" : ""}`} data-page-id={page.id} onPointerDown={(event) => { if (!(event.target as HTMLElement).closest(".cl-scene-card")) onPointerDownBoard(); }} onContextMenu={(event) => { if (!(event.target as HTMLElement).closest(".cl-scene-card")) event.preventDefault(); }}>
      {row("NPC", "npc", others, isGm ? "컴펜디움이나 저널의 NPC를 끌어 놓거나 \"놓기\"를 누르면 여기에 섭니다." : "아직 상대가 없습니다.")}
      <div className="cl-scene-stage" aria-label="장면">
        <span className="cl-scene-chip cl-scene-title">{page.name}</span>
        {page.description ? <p className="cl-scene-desc">{page.description}</p> : null}
        {/* R73 (D208): one press takes the background away; the fit comes from the page settings. */}
        {isGm && page.background.image ? <button type="button" className="cl-scene-chip cl-scene-clear" onClick={() => c.putPage({ ...page, background: { ...page.background, image: undefined } })}>배경 지우기 ✕</button> : null}
        {page.background.image ? <ArtImage src={page.background.image} className={`cl-scene-backdrop fit-${page.background.fit ?? "cover"}`} alt={page.name} /> : <span className="cl-scene-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M3.5 18.5 9 13l3.5 3.5L16 13l4.5 5" strokeLinejoin="round" /></svg>{isGm ? <small>이미지를 여기로 끌어 놓으세요 (아트 탭이나 PC의 파일) · 맞춤은 ⋯ → 페이지 설정</small> : null}</span>}
      </div>
      {row("플레이어", "pc", party, "저널의 \"토큰\"이나 끌어 놓기로 캐릭터를 세웁니다.")}
    </div>
  );
}

const SKULL = <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true"><path d="M12 2a8 8 0 0 0-8 8c0 2.6 1.3 4.9 3.3 6.3V19a1 1 0 0 0 1 1h1v1.2a.8.8 0 0 0 .8.8h3.8a.8.8 0 0 0 .8-.8V20h1a1 1 0 0 0 1-1v-2.7A8 8 0 0 0 12 2Zm-3.2 12a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4Zm6.4 0a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4ZM12 17.2l-1.3-2.4h2.6L12 17.2Z" /></svg>;
const PERSON = <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0Z" /></svg>;

function SceneIcon({ token, kind, journal, ac, selected, picked, candidate, turn, dimmed, floats, highlighted = false, leave, onPointerDown, onContextMenu, onDoubleClick, onLeave }: {
  token: Token; kind: "pc" | "npc"; journal: JournalEntry[]; ac?: number; selected: boolean; picked: boolean; /** null: no targeting; true/false: lit or dimmed. */ candidate: boolean | null; turn: boolean; dimmed: boolean; floats: CardFloat[]; leave: boolean;
  onPointerDown: (event: ReactPointerEvent) => void; onContextMenu: (event: React.MouseEvent) => void; onDoubleClick: () => void; onLeave: () => void; highlighted?: boolean;
}) {
  const entry = token.represents ? journal.find((item) => item.id === token.represents) : undefined;
  const character = entry?.kind === "character" ? entry : undefined;
  const markers = useMemo(() => {
    if (!character) return token.markers;
    const conditions: TokenMarker[] = character.runtime.conditions.filter((name) => isConditionMarker(name)).map((name) => ({ name }));
    return [...conditions, ...token.markers.filter((marker) => !isConditionMarker(marker.name))];
  }, [character, token.markers]);
  /**
   * R30 (D158): what a creature is under used to live on its sheet alone, so the DM had to open a window to answer
   * "is the ogre still held?". The running effects sit on its card now, with what is left of each one.
   */
  const running = useMemo(() => (entry && entry.kind !== "handout" ? (entry.runtime.effects ?? []) : []), [entry]);
  const hp = token.bars[0];
  const fraction = hp && hp.max ? Math.max(0, Math.min(1, (hp.value ?? 0) / hp.max)) : null;
  const down = fraction === 0 || markers.some((marker) => marker.name === "사망" || marker.name === "무의식");
  return (
    <div className={`cl-scene-card ${kind}${selected ? " selected" : ""}${picked ? " picked" : ""}${candidate === true ? " candidate" : candidate === false ? " not-candidate" : ""}${turn ? " turn" : ""}${dimmed ? " dimmed" : ""}${token.layer === "gm" ? " layer-gm" : ""}${down ? " down" : ""}${highlighted ? " highlight" : ""}`} data-token-id={token.id} data-token-name={token.name} title={token.name}
      onPointerDown={onPointerDown} onContextMenu={onContextMenu} onDoubleClick={onDoubleClick}>
      {turn ? <span className="cl-scene-now">행동 중</span> : null}
      <div className="cl-scene-portrait">
        {token.image ? <ArtImage src={token.image} className="cl-scene-art" alt={token.name} /> : <span className="cl-scene-glyph">{kind === "npc" ? SKULL : PERSON}</span>}
        {/* R69 (D204): Baldur's Gate style — a translucent red tide over the portrait rises with the hit points lost.
            A creature at full health shows its face clean; the lower it gets, the more of it is under the red. */}
        {fraction !== null ? <span className="cl-scene-gauge" style={{ height: `${Math.round((1 - fraction) * 100)}%` }} aria-hidden="true" /> : null}
        {ac !== undefined ? <span className="cl-scene-ac" title={`AC ${ac}`} aria-label={`AC ${ac}`}><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" fill="#161a21" stroke="#8b93a3" strokeWidth="1.4" /></svg><b>{ac}</b></span> : null}
        {markers.length ? <div className="cl-scene-markers">{markers.slice(0, 6).map((marker) => <span key={marker.name} className="cl-marker" title={marker.name}>{MARKER_GLYPH[marker.name] ?? "•"}{marker.badge !== undefined ? <small>{marker.badge}</small> : null}</span>)}</div> : null}
        <span className="cl-scene-name">{token.name}{hp && (hp.value !== undefined || hp.max !== undefined) ? <small>{hp.value ?? "?"}{hp.max !== undefined ? `/${hp.max}` : ""}</small> : null}</span>
        {running.length ? <div className="cl-scene-effects">{running.slice(0, 3).map((effect) => <span key={effect.key} className="cl-scene-effect" title={`${effect.name} — ${remainingText(effect.rounds, effect.elapsed) ?? effect.duration}${effect.concentration ? " · 집중" : ""}`}>{effect.concentration ? "🎯 " : ""}{effect.name}{effect.rounds !== undefined ? <small>{Math.max(0, effect.rounds - effect.elapsed) <= 10 ? `${Math.max(0, effect.rounds - effect.elapsed)}R` : `${Math.ceil(Math.max(0, effect.rounds - effect.elapsed) / 10)}분`}</small> : null}</span>)}{running.length > 3 ? <span className="cl-scene-effect" title={running.slice(3).map((effect) => effect.name).join(", ")}>+{running.length - 3}</span> : null}</div> : null}
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
  const { snapshot, isGm, viewer } = useViewer();
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
          // R11: inside the current linked group a later member may go first — the DM or either creature's controller.
          const currentToken = tokenOf(tracker.turns[currentIndex]?.tokenId);
          const canSwap = inGroup && !now && !acted && at > 0 && linked.has(0) && groups.some((group) => group.start === 0 && at <= group.end) && (isGm || (token ? controlsToken(token, viewer, snapshot.journal) : false) || (currentToken ? controlsToken(currentToken, viewer, snapshot.journal) : false));
          return (
            <span key={turn.id} role="listitem" className={`cl-turn-ribbon-item ${side}${now ? " now" : ""}${acted ? " acted" : ""}${down ? " down" : ""}${inGroup ? " linked" : ""}${groupStart ? " group-start" : ""}${groupEnd ? " group-end" : ""}`} onClick={() => flashCardsFor(turn.name)} data-turn-name={turn.name} title={`${turn.name} · 이니셔티브 ${turn.initiative}${down ? " · 쓰러짐" : ""}`}>
              <span className="cl-turn-ribbon-frame">
                {tempRing ? <span className="cl-turn-ribbon-temp" style={{ background: `conic-gradient(#7dd3fc ${Math.round(tempRing * 360)}deg, transparent 0)` }} aria-label="임시 HP" /> : null}
                <span className="cl-turn-ribbon-portrait">{token?.image ? <ArtImage src={token.image} alt="" /> : <span className="cl-turn-ribbon-glyph">{side === "npc" ? SKULL : PERSON}</span>}{down ? <span className="cl-turn-ribbon-down">✖</span> : null}</span>
                {fraction !== null ? <span className="cl-turn-ribbon-hp"><i style={{ width: `${Math.round(fraction * 100)}%` }} /></span> : null}
              </span>
              {inGroup ? <span className={`cl-turn-ribbon-arrow${acted || now ? " filled" : ""}`} aria-hidden="true">{acted ? "⌛" : now ? "▲" : "△"}</span> : null}
              {now ? <span className="cl-turn-ribbon-name">{turn.name}</span> : null}
              {canSwap ? <button type="button" className="cl-turn-ribbon-swap" title={`${turn.name}이(가) 먼저 행동 (순서 교대)`} aria-label={`${turn.name} 먼저`} onClick={(event) => { event.stopPropagation(); c.swapTurn(turn.id); }}>↔</button> : null}
            </span>
          );
        })}
      </div>
      {isGm ? <span className="cl-turn-ribbon-tools"><button type="button" className="cl-btn small primary" onClick={() => c.nextTurn()}>▶ 다음 턴</button><button type="button" className="cl-btn small quiet" onClick={() => onOpenTracker?.()} title="이니셔티브 편집·전투 시작">트래커</button></span> : null}
    </div>
  );
}

/* ---------- Token ---------- */

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
  // V4e (D267): the auras of the other characters on this scene — marking a token inside one is a fact the board cannot see.
  const { catalog } = useClient();
  const auraSources = useMemo(() => page.tokens.flatMap((other) => {
    if (other.id === token.id || !other.represents) return [];
    const sheet = journal.find((item) => item.id === other.represents);
    if (sheet?.kind !== "character") return [];
    return (derivedOf(sheet, catalog).auras ?? []).map((aura) => ({ name: aura.name, from: other.id, owner: other.name }));
  }), [page.tokens, token.id, journal, catalog]);
  const toggleAura = (aura: { name: string; from: string }) => {
    const has = token.markers.some((marker) => marker.name === aura.name && marker.from === aura.from);
    put({ ...token, markers: has ? token.markers.filter((marker) => !(marker.name === aura.name && marker.from === aura.from)) : [...token.markers, { name: aura.name, from: aura.from }] });
  };
  const setBadge = (name: string, badge: number | undefined) => put({ ...token, markers: token.markers.map((marker) => (marker.name === name ? { ...marker, badge } : marker)) });
  const reorder = (direction: 1 | -1) => put({ ...token, z: token.z + direction });
  /**
   * R15: a duplicated NPC gets its OWN journal entry. Sharing one entry shared its runtime too, so a recharge roll,
   * the legendary-action pool, legendary resistances and per-day spell uses of one goblin were spent by the other.
   */
  const duplicate = () => {
    const fresh = newToken({ name: "" }).id;
    if (entry?.kind === "npc") {
      const base = entry.name.replace(/\s\d+$/, "");
      const taken = page.tokens.filter((item) => item.name === base || new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\d+$`).test(item.name)).length;
      const copy = { ...newJournalNpc(page.campaignId, c.userId, entry.statBlock, { name: `${base} ${taken + 1}` }), folder: entry.folder, gmNotes: entry.gmNotes, canView: entry.canView, canEdit: entry.canEdit, avatar: entry.avatar, tags: entry.tags };
      c.putJournal(copy);
      const bars = token.bars.map((bar, index) => (index === 0 && !bar.link ? { ...bar, value: entry.statBlock.hp, max: entry.statBlock.hp } : bar)) as Token["bars"];
      put({ ...token, id: fresh, z: token.z + 1, name: copy.name, represents: copy.id, markers: [], bars });
      onClose();
      return;
    }
    put({ ...token, id: fresh, z: token.z + 1 });
    onClose();
  };
  return (
    <FloatingMenu at={at} className="cl-token-menu" label={`토큰 메뉴 ${token.name}`} onClose={onClose}>
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
      {controls && auraSources.length ? (
        <div className="cl-row" style={{ gap: 4, flexWrap: "wrap" }} aria-label="오라 안">
          {auraSources.map((aura) => { const on = token.markers.some((marker) => marker.name === aura.name && marker.from === aura.from); return <button type="button" key={`${aura.from}:${aura.name}`} className={`cl-btn small${on ? " primary" : ""}`} aria-pressed={on} title="이 토큰이 그 오라 안에 있으면 켜세요" onClick={() => toggleAura(aura)}>{on ? "✓ " : ""}{aura.owner}의 {aura.name} 안</button>; })}
        </div>
      ) : null}
      <div className="cl-token-menu-actions">
        {character && canView(character, viewer) ? <button type="button" className="cl-btn small" onClick={() => { onOpenEntry(character.id); onClose(); }}>시트 열기</button> : null}
        {controls ? <button type="button" className="cl-btn small" onClick={() => { onOpenToken(); onClose(); }}>토큰 설정</button> : null}
        {isGm ? <select className="cl-select" style={{ height: 26 }} aria-label="레이어로 이동" value={token.layer} onChange={(event) => put({ ...token, layer: event.target.value as Layer })}>{(["objects", "gm"] as Layer[]).map((item) => <option key={item} value={item}>{item === "gm" ? "GM만 보임" : "모두에게 보임"}</option>)}</select> : null}
        {controls ? <><button type="button" className="cl-btn small" onClick={() => reorder(1)} title="줄에서 오른쪽으로">▶ 오른쪽으로</button><button type="button" className="cl-btn small" onClick={() => reorder(-1)} title="줄에서 왼쪽으로">◀ 왼쪽으로</button></> : null}
        {character && canEdit(character, viewer) ? <button type="button" className="cl-btn small" title="이 토큰의 설정을 캐릭터의 기본 토큰으로 저장" onClick={() => { const { id: _id, z: _z, represents: _r, ...rest } = token; c.putJournal({ ...character, defaultToken: rest, updatedAt: new Date().toISOString() }); onClose(); }}>기본 토큰으로 저장</button> : null}
        {isGm ? <button type="button" className="cl-btn small" title={entry?.kind === "npc" ? "복사본은 자기 저널 항목을 가집니다 (재충전·전설 행동·하루 횟수가 따로)" : undefined} onClick={duplicate}>복제</button> : null}
        {isGm ? <button type="button" className="cl-btn small" onClick={() => put({ ...token, locked: !token.locked })}>{token.locked ? "잠금 해제" : "잠금"}</button> : null}
        {controls ? <button type="button" className="cl-btn small" onClick={() => { c.addTurn({ name: token.name, tokenId: token.id, pageId: page.id, entryId: token.represents, image: token.image }); onClose(); }} title="이니셔티브 0으로 넣습니다 (액션 줄의 '이니셔티브'는 굴려서 넣습니다)">턴 트래커에 추가</button> : null}
        {controls ? <button type="button" className="cl-btn small danger" onClick={() => { c.removeToken(page.id, token.id); onClose(); }}>삭제</button> : null}
      </div>
    </FloatingMenu>
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
      {!isGm ? <p className="cl-quiet cl-small">플레이어는 위치·회전·뒤집기·마커·편집 가능한 바만 바꿀 수 있습니다. 나머지는 GM이 정합니다.</p> : null}
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
          <div className="cl-field"><label htmlFor={`tk-tint-${draft.id}`}>틴트</label><div className="cl-row" style={{ gap: 6 }}><input id={`tk-tint-${draft.id}`} type="color" disabled={!isGm} value={draft.tint ?? "#ffffff"} onChange={(event) => edit({ tint: event.target.value })} />{draft.tint ? <button type="button" className="cl-btn small quiet" disabled={!isGm} onClick={() => edit({ tint: undefined })}>없음</button> : <span className="cl-quiet cl-small">없음</span>}</div></div>
          <div className="cl-field" style={{ gridColumn: "1 / -1" }}><label>상태 마커</label><div className="cl-token-menu-markers">{ALL_MARKERS.map((name) => { const on = draft.markers.some((marker) => marker.name === name); return <button type="button" key={name} className={`cl-marker-btn${on ? " on" : ""}`} title={name} aria-pressed={on} disabled={!controls} onClick={() => edit({ markers: on ? draft.markers.filter((marker) => marker.name !== name) : [...draft.markers, { name }] })}>{MARKER_GLYPH[name]}</button>; })}</div>{draft.represents ? <span className="cl-quiet cl-small">상태 이상 14종은 캐릭터 시트의 상태와 같은 것입니다 (D84). 시트에서 켜면 토큰에 나타납니다.</span> : null}</div>
          {isGm ? <div className="cl-field"><label>기타</label><label className="cl-row cl-small" style={{ gap: 4 }}><input type="checkbox" checked={draft.locked} onChange={(event) => edit({ locked: event.target.checked })} /> 잠금 (움직이거나 고칠 수 없음)</label></div> : null}
          {isGm ? <div className="cl-field" style={{ gridColumn: "1 / -1" }}><label htmlFor={`tk-gm-${draft.id}`}>GM 노트</label><textarea id={`tk-gm-${draft.id}`} className="cl-textarea" rows={3} value={draft.gmNotes} onChange={(event) => edit({ gmNotes: event.target.value })} /></div> : null}
        </div>
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
  if (!page || !draft) return <Notice tone="warn">이 장면은 더 없습니다.</Notice>;
  const edit = (patch: Partial<Page>) => setDraft({ ...draft, ...patch });
  return (
    <div className="cl-journal-window">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="cl-field" style={{ gridColumn: "1 / -1" }}><label htmlFor={`pg-name-${draft.id}`}>이름</label><input id={`pg-name-${draft.id}`} className="cl-input" value={draft.name} onChange={(event) => edit({ name: event.target.value })} /></div>
        <div className="cl-field"><label htmlFor={`pg-bg-${draft.id}`}>배경색</label><input id={`pg-bg-${draft.id}`} type="color" value={draft.background.color} onChange={(event) => edit({ background: { ...draft.background, color: event.target.value } })} /></div>
        <div className="cl-field" style={{ gridColumn: "1 / -1" }}><label htmlFor="cl-scene-desc">장면 설명</label><textarea id="cl-scene-desc" className="cl-input" rows={3} value={draft.description ?? ""} placeholder="비 오는 밤, 여관 뒷마당. 횃불 하나가 흔들린다…" onChange={(event) => edit({ description: event.target.value })} /></div>
        <div className="cl-field"><label>배경 이미지</label><div className="cl-row" style={{ gap: 6 }}><span className="cl-art-thumb" style={{ width: 40, height: 40 }}>{draft.background.image ? <ArtImage src={draft.background.image} /> : null}</span><button type="button" className="cl-btn small" onClick={() => setPicking(true)}>라이브러리에서</button>{draft.background.image ? <button type="button" className="cl-btn small quiet" onClick={() => edit({ background: { ...draft.background, image: undefined } })}>지우기</button> : null}</div></div>
        <div className="cl-field"><label htmlFor={`pg-fit-${draft.id}`}>배경 맞춤</label><select id={`pg-fit-${draft.id}`} className="cl-select" value={draft.background.fit ?? "cover"} onChange={(event) => edit({ background: { ...draft.background, fit: event.target.value as BackgroundFit } })}>{(Object.keys(BACKGROUND_FIT_KO) as BackgroundFit[]).map((fit) => <option key={fit} value={fit}>{BACKGROUND_FIT_KO[fit]}</option>)}</select></div>
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
