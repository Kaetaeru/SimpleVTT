/**
 * Two kinds of on-screen UI besides the chat record (D99): toasts that announce and fade (a turn started, a
 * roll landed, a mark was set) and approvals that wait for an answer from one side (an opportunity attack
 * offered to you, a player's result the DM must apply). Both sit over the board; the chat keeps the record.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useCampaigns } from "../app/campaigns";
import { useClient } from "../app/context";
import { canEdit } from "../campaign/journal";
import type { ChatMessage } from "../campaign/model";
import { controlsToken } from "../campaign/page";
import { deriveCharacter } from "../character/derive";
import { weaponRange } from "../rules/attackSpec";
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
    default: return null;
  }
}

/** Toasts for chat that arrived after mount; each fades after a few seconds, at most three at once. On a scene the board itself shows attack/act results and turns, so those stay off the toasts. */
export function ToastLayer({ boardShowsResults = false }: { boardShowsResults?: boolean }) {
  const c = useCampaigns();
  const chat = c.table.snapshot?.chat ?? [];
  const seen = useRef<Set<string> | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; text: string; tone: "info" | "good" | "bad" }>>([]);
  useEffect(() => {
    if (!seen.current) { seen.current = new Set(chat.map((message) => message.id)); return; }
    const fresh = chat.filter((message) => !seen.current!.has(message.id));
    if (!fresh.length) return;
    for (const message of fresh) seen.current.add(message.id);
    const shownOnBoard = (message: ChatMessage) => boardShowsResults && (message.type === "action" || message.type === "act" || message.type === "prompt" || (message.type === "system" && /의 턴$/.test(message.content)));
    const next = fresh.filter((message) => !shownOnBoard(message)).map((message) => ({ message, toast: toastText(message) })).filter((item): item is { message: ChatMessage; toast: { text: string; tone: "info" | "good" | "bad" } } => Boolean(item.toast)).map((item) => ({ id: item.message.id, ...item.toast }));
    if (!next.length) return;
    setToasts((list) => [...list, ...next].slice(-3));
    for (const toast of next) setTimeout(() => setToasts((list) => list.filter((item) => item.id !== toast.id)), TOAST_MS);
  }, [chat, boardShowsResults]);
  if (!toasts.length) return null;
  return (
    <div className="cl-toasts" aria-live="polite" aria-label="알림">
      {toasts.map((toast) => <div key={toast.id} className={`cl-toast ${toast.tone}`} onClick={() => setToasts((list) => list.filter((item) => item.id !== toast.id))}>{toast.text}</div>)}
    </div>
  );
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
  if (prompt.outcome || !controls) return null;
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
export function ApprovalLayer() {
  const c = useCampaigns();
  const snapshot = c.table.snapshot!;
  const isGm = snapshot.players.find((player) => player.userId === c.userId)?.role === "gm";
  const superseded = useMemo(() => new Set(snapshot.chat.map((message) => message.supersedes).filter((id): id is string => Boolean(id))), [snapshot.chat]);
  const prompts = snapshot.chat.filter((message) => message.type === "prompt" && !message.prompt?.outcome && !superseded.has(message.id));
  const waiting = isGm ? snapshot.chat.filter((message) => message.type === "action" && message.action && !message.action.applied && !message.undone && !superseded.has(message.id)) : [];
  const mine = prompts.filter((message) => promptIsMine(message, snapshot, c.userId));
  const first = mine[0];
  const firstWait = waiting[0];
  if (!first && !firstWait) {
    const theirs = prompts[0];
    return theirs ? <div className="cl-waiting-note" role="status">⏳ {theirs.prompt!.reactor.name}의 기회 공격 선택을 기다리는 중…</div> : null;
  }
  return (
    <div className="cl-approval-overlay" role="dialog" aria-modal="false" aria-label="승인">
      <div className="cl-approval">
        <div className="cl-approval-head">{first ? "당신의 답을 기다립니다" : "DM 확인"}{(mine.length + waiting.length) > 1 ? <small> +{mine.length + waiting.length - 1}</small> : null}</div>
        {first ? (
          <>
            <div className="cl-approval-body">🏃 <strong>{first.prompt!.mover.name}</strong>이(가) <strong>{first.prompt!.reactor.name}</strong>에게서 벗어납니다.<br />기회 공격을 하시겠습니까?</div>
            <PromptChoices message={first} compact />
          </>
        ) : (
          <>
            <div className="cl-approval-body"><strong>{firstWait!.action!.attacker.name}</strong> → <strong>{firstWait!.action!.target.name}</strong>: {firstWait!.action!.attack.name} — {firstWait!.action!.outcome === "crit" ? "치명타" : firstWait!.action!.outcome === "hit" ? "적중" : "빗나감"}{firstWait!.action!.damageTotal ? ` · 피해 ${firstWait!.action!.damageTotal}` : ""}</div>
            <div className="cl-row" style={{ gap: 6 }}><button type="button" className="cl-btn primary" onClick={() => c.confirmAction(firstWait!.id)}>적용</button><button type="button" className="cl-btn" onClick={() => c.adjustAction(firstWait!.id, { outcome: "miss" })}>빗나감으로</button><button type="button" className="cl-btn quiet" onClick={() => c.undoAction(firstWait!.id)}>취소</button></div>
          </>
        )}
      </div>
    </div>
  );
}
