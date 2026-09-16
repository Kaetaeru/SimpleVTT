/**
 * Two kinds of on-screen UI besides the chat record (D99): toasts that announce and fade (a turn started, a
 * roll landed, a mark was set) and approvals that wait for an answer from one side (an opportunity attack
 * offered to you, a player's result the DM must apply). Both sit over the board; the chat keeps the record.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCampaigns } from "../app/campaigns";
import { useClient } from "../app/context";
import { canEdit } from "../campaign/journal";
import type { ChatMessage, ReactionPrompt } from "../campaign/model";
import { controlsToken } from "../campaign/page";
import { deriveCharacter } from "../character/derive";
import { weaponRange } from "../rules/attackSpec";
import { cheapestCast } from "../rules/spellcast";
import type { ActorRef, AttackRef } from "../session/protocol";
import { Pill } from "../ui/components";

const TOAST_MS = 4200;

/** One line for a message that deserves a toast; null for chat that stays in the log only. */
export function toastText(message: ChatMessage): { text: string; tone: "info" | "good" | "bad" } | null {
  switch (message.type) {
    case "system": return { text: message.content, tone: "info" };
    case "emote": return { text: `${message.who} ${message.content}`, tone: "info" };
    case "rollresult": return message.roll ? { text: `${message.roll.label ?? message.content} = ${message.roll.total}`, tone: "info" } : null;
    case "act": { const act = message.act!; return { text: `${act.actor.name}: ${act.name}${act.check ? ` ${act.check.total}${act.check.dc !== undefined ? ` vs DC ${act.check.dc}` : ""}${act.check.success === undefined ? "" : act.check.success ? " 성공" : " 실패"}` : ""}`, tone: act.check?.success === false ? "bad" : "good" }; }
    case "action": {
      const result = message.action!;
      if (message.undone) return { text: `되돌림: ${result.attacker.name} → ${result.target.name}`, tone: "info" };
      const hit = result.outcome === "hit" || result.outcome === "crit";
      return { text: `${result.attacker.name} → ${result.target.name}: ${result.attack.name} ${result.outcome === "crit" ? "치명타" : hit ? "적중" : "빗나감"}${hit ? ` · 피해 ${result.damageTotal} (HP ${result.hpAfter})` : ""}${result.applied ? "" : " · DM 확인 대기"}`, tone: hit ? "bad" : "info" };
    }
    case "prompt": return message.prompt?.outcome ? null : { text: message.content, tone: "info" };
    case "spell": { const spell = message.spell!; if (message.undone) return { text: `되돌림: ${spell.caster.name}의 ${spell.name}`, tone: "info" }; return { text: `${spell.caster.name}: ${spell.name} → ${spell.targets.map((row) => row.target.name).join(", ")}${spell.applied ? "" : " · DM 확인 대기"}`, tone: "info" }; }
    default: return null;
  }
}

/** Toasts for chat that arrived after mount; each fades after a few seconds, at most three at once. On a scene the board itself shows attack/act results and turns, so those stay off the toasts. */
export function ToastLayer({ boardShowsResults = false }: { boardShowsResults?: boolean }) {
  const c = useCampaigns();
  const chat = c.table.snapshot?.chat ?? [];
  const toastMs = Math.max(1, c.table.snapshot?.settings.toastSeconds ?? TOAST_MS / 1000) * 1000;
  const toastCount = Math.max(1, c.table.snapshot?.settings.toastCount ?? 3);
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; text: string; tone: "info" | "good" | "bad" }>>([]);
  useEffect(() => {
    if (!seen.current) { seen.current = new Set(chat.map((message) => message.id)); return; }
    const fresh = chat.filter((message) => !seen.current!.has(message.id));
    if (!fresh.length) return;
    for (const message of fresh) seen.current.add(message.id);
    const shownOnBoard = (message: ChatMessage) => boardShowsResults && (message.type === "action" || message.type === "act" || message.type === "spell" || message.type === "prompt" || (message.type === "system" && /의 턴$/.test(message.content)));
    const next = fresh.filter((message) => !shownOnBoard(message)).map((message) => ({ message, toast: toastText(message) })).filter((item): item is { message: ChatMessage; toast: { text: string; tone: "info" | "good" | "bad" } } => Boolean(item.toast)).map((item) => ({ id: item.message.id, ...item.toast }));
    if (!next.length) return;
    setToasts((list) => [...list, ...next].slice(-toastCount));
    for (const toast of next) setTimeout(() => setToasts((list) => list.filter((item) => item.id !== toast.id)), toastMs);
  }, [chat, boardShowsResults, toastMs, toastCount]);
  if (!toasts.length) return null;
  return (
    <div className="cl-toasts" aria-live="polite" aria-label="알림">
      {toasts.map((toast) => <div key={toast.id} className={`cl-toast ${toast.tone}`} onClick={() => setToasts((list) => list.filter((item) => item.id !== toast.id))}>{toast.text}</div>)}
    </div>
  );
}

/**
 * R27 (D140): who the prompt is *for*. `controlsToken`/`canEdit` are true for the GM about everyone, so every
 * player prompt used to open as a modal on the DM's screen as well — with Enter bound to its primary button, the
 * DM typing a chat line with focus outside the box could spend a player's slot on Shield. The prompt goes to the
 * connected player who controls the reactor; the DM may take it over, but only on purpose.
 */
export function promptAnswerer(message: ChatMessage, snapshot: { players: Array<{ userId: string; role: "gm" | "player"; connected?: boolean }>; journal: Parameters<typeof canEdit>[0][]; pages: Array<{ id: string; tokens: Parameters<typeof controlsToken>[0][] }> }) {
  return snapshot.players.find((player) => player.role !== "gm" && player.connected !== false && promptIsMine(message, snapshot, player.userId))?.userId ?? null;
}

/** Whether this viewer answers the prompt: they control the reactor (the DM for an NPC). */
export function promptIsMine(message: ChatMessage, snapshot: { players: Array<{ userId: string; role: "gm" | "player" }>; journal: Parameters<typeof canEdit>[0][]; pages: Array<{ id: string; tokens: Parameters<typeof controlsToken>[0][] }> }, userId: string) {
  const prompt = message.prompt;
  if (!prompt || prompt.outcome) return false;
  const role = snapshot.players.find((player) => player.userId === userId)?.role ?? "player";
  const viewer = { userId, role };
  const reactorEntry = snapshot.journal.find((entry) => entry.id === prompt.reactor.entryId);
  const reactorToken = snapshot.pages.find((page) => page.id === prompt.reactor.pageId)?.tokens.find((token) => token.id === prompt.reactor.tokenId);
  return Boolean(reactorEntry && (reactorToken ? controlsToken(reactorToken, viewer, snapshot.journal) : canEdit(reactorEntry, viewer)));
}

/** Buttons for the side a prompt is addressed to: the reactor's melee attacks as the reaction, or 안 함. Null when it is not yours or already answered. */
const COUNTERSPELL_ID = "dnd.srd521.spell.counterspell";
/** What a prompt is asking for, in one word. */
export const promptLabel = (kind: ReactionPrompt["kind"]) => (kind === "shield" ? "방패 반응" : kind === "counterspell" ? "주문 차단" : kind === "death-save" ? "죽음 내성" : kind === "rescue" ? "판정 다시 굴리기" : "기회 공격");

export function PromptChoices({ message, compact = false }: { message: ChatMessage; compact?: boolean }) {
  const c = useCampaigns();
  const { catalog } = useClient();
  const snapshot = c.table.snapshot!;
  const prompt = message.prompt!;
  const reactorEntry = snapshot.journal.find((entry) => entry.id === prompt.reactor.entryId);
  const controls = promptIsMine(message, snapshot, c.userId);
  const reactionUsed = snapshot.tracker.turns.some((turn) => (prompt.reactor.tokenId ? turn.tokenId === prompt.reactor.tokenId && turn.pageId === prompt.reactor.pageId : turn.entryId === prompt.reactor.entryId) && turn.reactionUsed);
  const attacks = useMemo<Array<{ name: string; ref: AttackRef }>>(() => {
    if (!reactorEntry) return [];
    if (reactorEntry.kind === "npc") return reactorEntry.statBlock.actions.filter((action) => action.kind === "attack" && action.attack && action.attack.mode !== "ranged").map((action) => ({ name: action.name, ref: { source: "npc", actionName: action.name } }));
    if (reactorEntry.kind === "character") { const derived = deriveCharacter(reactorEntry.source, catalog, { equipped: reactorEntry.runtime.equipped, inventory: reactorEntry.runtime.inventory, effects: reactorEntry.runtime.effects }); return derived.attacks.filter((attack) => weaponRange(attack).mode === "melee").map((attack) => ({ name: attack.name, ref: { source: "weapon", attackId: attack.id } })); }
    return [];
  }, [reactorEntry, catalog]);
  const ref = (actor: typeof prompt.reactor): ActorRef => ({ entryId: actor.entryId, pageId: actor.pageId, tokenId: actor.tokenId });
  // R11: a shield prompt offers the reaction spell with its cheapest slot. R16: a counterspell prompt does the same at level 3.
  const reaction = useMemo(() => {
    if (reactorEntry?.kind !== "character") return null;
    const level = prompt.kind === "shield" ? 1 : prompt.kind === "counterspell" ? 3 : 0;
    if (!level) return null;
    const derived = deriveCharacter(reactorEntry.source, catalog, { equipped: reactorEntry.runtime.equipped, inventory: reactorEntry.runtime.inventory, effects: reactorEntry.runtime.effects });
    return cheapestCast(derived, reactorEntry.runtime, level);
  }, [prompt.kind, reactorEntry, catalog]);
  const shield = prompt.kind === "shield" ? reaction : null;
  if (prompt.outcome || !controls) return null;
  // R29 (D154): the one roll that decides whether the character lives is the player's to make. The host still
  // rolls the die — pressing the button is what belongs to them, and it used to be an anonymous line in the log.
  if (prompt.kind === "death-save") {
    return (
      <div className="cl-row" style={{ gap: 4, flexWrap: "wrap" }}>
        <button type="button" className="cl-btn small primary" onClick={() => c.rollDeathSave(message.id)}>💀 죽음 내성 굴리기 (1d20 · 10 이상 성공)</button>
      </div>
    );
  }
  // R35 (D174): the failed save a contract may redo. One button per feature that could pay for it — the host
  // already checked the pool, so a button that is shown is a button that works.
  if (prompt.kind === "rescue") {
    return (
      <div className="cl-row" style={{ gap: 4, flexWrap: "wrap" }}>
        {(prompt.rescue?.features ?? []).map((feature) => <button type="button" key={feature} className="cl-btn small primary" onClick={() => c.rescueRoll(message.id, feature)}>🎲 {feature}로 다시 굴리기</button>)}
        <button type="button" className="cl-btn small" onClick={() => c.declineReaction(message.id)}>그대로 두기</button>
      </div>
    );
  }
  if (prompt.kind === "counterspell") {
    const slot = reactorEntry?.kind === "npc" ? { kind: "slot" as const, level: 3 } : reaction;
    return (
      <div className="cl-row" style={{ gap: 4, flexWrap: "wrap" }}>
        {reactionUsed ? <span className="cl-quiet cl-small">이번 라운드의 반응을 이미 썼습니다</span> : slot ? <button type="button" className="cl-btn small primary" onClick={() => c.cast(ref(prompt.reactor), COUNTERSPELL_ID, [ref(prompt.mover)], slot, undefined, undefined, message.id)}>🚫 주문 차단 시전{slot.kind === "slot" ? ` (${slot.level}레벨 슬롯)` : " (계약 슬롯)"} — {prompt.mover.name}이(가) 건강 내성</button> : <span className="cl-quiet cl-small">슬롯이 없습니다</span>}
        <button type="button" className="cl-btn small" onClick={() => c.declineReaction(message.id)}>안 함</button>
      </div>
    );
  }
  if (prompt.kind === "shield") {
    return (
      <div className="cl-row" style={{ gap: 4, flexWrap: "wrap" }}>
        {reactionUsed ? <span className="cl-quiet cl-small">이번 라운드의 반응을 이미 썼습니다</span> : shield ? <button type="button" className="cl-btn small primary" onClick={() => c.cast(ref(prompt.reactor), "dnd.srd521.spell.shield", [ref(prompt.reactor)], shield, undefined, undefined, message.id)}>🛡 방패 시전 ({shield.kind === "slot" ? `${shield.level}레벨 슬롯` : "계약 슬롯"}) — AC +5{prompt.attack && prompt.attack.total < prompt.attack.ac + 5 ? " → 빗나감" : " (그래도 적중)"}</button> : <span className="cl-quiet cl-small">슬롯이 없습니다</span>}
        <button type="button" className="cl-btn small" onClick={() => c.declineReaction(message.id)}>안 함</button>
      </div>
    );
  }
  return (
    <div className="cl-row" style={{ gap: 4, flexWrap: "wrap" }}>
      {reactionUsed ? <span className="cl-quiet cl-small">이번 라운드의 반응을 이미 썼습니다</span> : attacks.map((attack) => <button type="button" key={attack.name} className="cl-btn small primary" onClick={() => c.attack(ref(prompt.reactor), [ref(prompt.mover)], attack.ref, undefined, { reaction: message.id })}>⚔ {attack.name}{compact ? "" : " (기회 공격)"}</button>)}
      <button type="button" className="cl-btn small" onClick={() => c.declineReaction(message.id)}>안 함</button>
    </div>
  );
}

/**
 * What waits for this viewer's answer (D99/D100): the first opportunity prompt addressed to them, or (DM) the
 * first result waiting for 적용 — one at a time, centred over a dimmed board, because someone is waiting. When the
 * other side is choosing, a quiet note says so instead.
 */
/** R13: Enter takes the first (primary) choice of the approval, Escape the last ("안 함"/"취소"); typing in an input is left alone. */
function approvalKeys(element: HTMLDivElement | null) {
  if (!element) return;
  // R27 (D140): a keystroke already on its way when the card opens must not answer it.
  const openedAt = Date.now();
  const onKey = (event: KeyboardEvent) => {
    if (Date.now() - openedAt < 600) return;
    if ((event.target as HTMLElement | null)?.closest("input, textarea, select")) return;
    const buttons = [...element.querySelectorAll<HTMLButtonElement>(".cl-approval button:not(:disabled)")];
    if (!buttons.length) return;
    if (event.key === "Enter") { event.preventDefault(); (buttons.find((button) => button.classList.contains("primary")) ?? buttons[0]).click(); }
    if (event.key === "Escape") { event.preventDefault(); buttons[buttons.length - 1].click(); }
  };
  document.addEventListener("keydown", onKey);
  // React calls a ref callback with null on unmount: remove the listener then.
  approvalNodes.set(element, () => document.removeEventListener("keydown", onKey));
}
const approvalNodes = new Map<HTMLDivElement, () => void>();

export function ApprovalLayer() {
  const c = useCampaigns();
  const approvalRef = useCallback((element: HTMLDivElement | null) => { if (element) approvalKeys(element); else for (const [node, cleanup] of approvalNodes) { cleanup(); approvalNodes.delete(node); } }, []);
  const snapshot = c.table.snapshot!;
  const [taken, setTaken] = useState<string[]>([]);
  const isGm = snapshot.players.find((player) => player.userId === c.userId)?.role === "gm";
  const superseded = useMemo(() => new Set(snapshot.chat.map((message) => message.supersedes).filter((id): id is string => Boolean(id))), [snapshot.chat]);
  const prompts = snapshot.chat.filter((message) => message.type === "prompt" && !message.prompt?.outcome && !superseded.has(message.id));
  const waiting = isGm ? snapshot.chat.filter((message) => ((message.type === "action" && message.action && !message.action.applied) || (message.type === "spell" && message.spell && !message.spell.applied)) && !message.undone && !superseded.has(message.id)) : [];
  // R27 (D140): a prompt a connected player owns is theirs to answer; the DM's screen says so and offers a takeover.
  const mine = prompts.filter((message) => promptIsMine(message, snapshot, c.userId) && (!isGm || taken.includes(message.id) || promptAnswerer(message, snapshot) === null));
  const first = mine[0];
  const firstWait = waiting[0];
  if (!first && !firstWait) {
    const theirs = prompts[0];
    if (!theirs) return null;
    const owner = promptAnswerer(theirs, snapshot);
    const who = snapshot.players.find((player) => player.userId === owner)?.displayName;
    return (
      <div className="cl-waiting-note" role="status">
        ⏳ {theirs.prompt!.reactor.name}의 {promptLabel(theirs.prompt!.kind)} 선택을 기다리는 중{who ? ` (${who})` : ""}…
        {isGm && promptIsMine(theirs, snapshot, c.userId) ? <button type="button" className="cl-btn small quiet" style={{ marginLeft: 8 }} onClick={() => setTaken((list) => [...list, theirs.id])}>대신 답하기</button> : null}
      </div>
    );
  }
  return (
    <div className="cl-approval-overlay" role="dialog" aria-modal="false" aria-label="승인" ref={approvalRef}>
      <div className="cl-approval">
        <div className="cl-approval-head">{first ? "당신의 답을 기다립니다" : "DM 확인"}{(mine.length + waiting.length) > 1 ? <small> +{mine.length + waiting.length - 1}</small> : null}</div>
        {first ? (
          <>
            {first.prompt!.kind === "counterspell" ? <div className="cl-approval-body">🚫 <strong>{first.prompt!.mover.name}</strong>이(가) {first.prompt!.spell?.name}{first.prompt!.spell ? ` (${first.prompt!.spell.level}레벨)` : ""}을(를) 시전하려 합니다.<br />주문 차단을 하시겠습니까?</div>
              : first.prompt!.kind === "shield" ? <div className="cl-approval-body">🛡 <strong>{first.prompt!.mover.name}</strong>의 {first.prompt!.attack?.name}이(가) <strong>{first.prompt!.reactor.name}</strong>에게 적중했습니다 (명중 {first.prompt!.attack?.total} vs AC {first.prompt!.attack?.ac}).<br />방패를 시전하시겠습니까?</div>
              : first.prompt!.kind === "rescue" ? <div className="cl-approval-body">🎲 <strong>{first.prompt!.reactor.name}</strong>의 내성이 실패했습니다 ({first.prompt!.rescue?.roll}).<br />특성을 써서 다시 굴릴 수 있습니다.</div>
              : first.prompt!.kind === "death-save" ? <div className="cl-approval-body">💀 <strong>{first.prompt!.reactor.name}</strong>은(는) 쓰러져 있습니다.<br />죽음 내성을 굴리세요 (성공 3번이면 안정, 실패 3번이면 사망).</div>
              : <div className="cl-approval-body">🏃 <strong>{first.prompt!.mover.name}</strong>이(가) <strong>{first.prompt!.reactor.name}</strong>에게서 벗어납니다.<br />기회 공격을 하시겠습니까?</div>}
            <PromptChoices message={first} compact />
          </>
        ) : (
          <>
            {firstWait!.action ? <div className="cl-approval-body"><strong>{firstWait!.action.attacker.name}</strong> → <strong>{firstWait!.action.target.name}</strong>: {firstWait!.action.attack.name} — {firstWait!.action.outcome === "crit" ? "치명타" : firstWait!.action.outcome === "hit" ? "적중" : "빗나감"}{firstWait!.action.damageTotal ? ` · 피해 ${firstWait!.action.damageTotal}` : ""}</div>
              : <div className="cl-approval-body"><strong>{firstWait!.spell!.caster.name}</strong>: {firstWait!.spell!.name} → {firstWait!.spell!.targets.map((row) => row.target.name).join(", ")}</div>}
            <div className="cl-row" style={{ gap: 6 }}><button type="button" className="cl-btn primary" onClick={() => c.confirmAction(firstWait!.id)}>적용</button>{firstWait!.action ? <button type="button" className="cl-btn" onClick={() => c.adjustAction(firstWait!.id, { outcome: "miss" })}>빗나감으로</button> : null}<button type="button" className="cl-btn quiet" onClick={() => c.undoAction(firstWait!.id)}>취소</button></div>
          </>
        )}
      </div>
    </div>
  );
}
