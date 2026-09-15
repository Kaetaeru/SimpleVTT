/**
 * The launched table (ROLL20_MODEL.md §3): header with the campaign, presence and the invite; the page area
 * (pages and tokens come in R5); the sidebar with the Chat tab — Roll20 commands, roll cards, whispers, GM rolls.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCampaigns } from "../app/campaigns";
import { useClient } from "../app/context";
import type { ChatMessage } from "../campaign/model";
import { PromptChoices } from "./Notify";
import type { AttackResolution } from "../rules/resolve";
import { damageTypeKo } from "../rules/resolve";
import { parseFormula } from "../character/dice";
import { describeChatRoll, parseChatInput } from "../session/chat";
import { copyText, Notice, Pill } from "../ui/components";
import { useDice } from "../ui/dice/DiceProvider";
import { ArtTab } from "./ArtPanel";
import { JournalTab, JournalWindows, type JournalWindow } from "./JournalPanel";
import { CompendiumTab } from "./CompendiumPanel";
import { PageCanvas } from "./PageCanvas";

export function TableScreen() {
  const { navigate } = useClient();
  const c = useCampaigns();
  const { table } = c;
  if (!table.role || table.status === "idle") return <div className="cl-page"><Notice tone="warn">열린 테이블이 없습니다. 캠페인에서 "게임 시작"을 누르거나 참가 코드로 입장하세요.</Notice><button type="button" className="cl-btn" onClick={() => navigate({ screen: "campaigns" })}>캠페인</button></div>;
  if (table.status === "refused") return <div className="cl-page"><Notice tone="bad">입장이 거절됐습니다: {table.reason}</Notice><button type="button" className="cl-btn" onClick={() => { c.leave(); navigate({ screen: "campaigns" }); }}>돌아가기</button></div>;
  if (table.status === "connecting" || !table.snapshot) return <div className="cl-page"><p className="cl-quiet">호스트에 연결하는 중… 호스트가 "게임 시작" 중인지 확인하세요.</p><button type="button" className="cl-btn" onClick={() => { c.leave(); navigate({ screen: "campaigns" }); }}>취소</button></div>;
  return <Table />;
}

function Table() {
  const { navigate } = useClient();
  const c = useCampaigns();
  const snapshot = c.table.snapshot!;
  const isGm = snapshot.players.find((player) => player.userId === c.userId)?.role === "gm";
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"chat" | "journal" | "art" | "compendium">("chat");
  const [windows, setWindows] = useState<JournalWindow[]>([]);
  const openEntry = useCallback((id: string) => setWindows((list) => { const existing = list.find((item) => item.kind === "entry" && item.id === id); const rest = existing ? list.filter((item) => item !== existing) : list; return [...rest, existing ?? { key: `entry:${id}`, kind: "entry", id }]; }), []);
  const openToken = useCallback((pageId: string, tokenId: string) => setWindows((list) => { const key = `token:${pageId}:${tokenId}`; const existing = list.find((item) => item.key === key); return [...list.filter((item) => item.key !== key), existing ?? { key, kind: "token", pageId, tokenId }]; }), []);
  const openPageSettings = useCallback((pageId: string) => setWindows((list) => { const key = `page:${pageId}`; const existing = list.find((item) => item.key === key); return [...list.filter((item) => item.key !== key), existing ?? { key, kind: "page-settings", pageId }]; }), []);
  const openNewCharacter = useCallback(() => setWindows((list) => (list.some((item) => item.kind === "new-character") ? list : [...list, { key: `new:${Date.now()}`, kind: "new-character" }])), []);
  const closeWindow = useCallback((key: string) => setWindows((list) => list.filter((item) => item.key !== key)), []);
  const focusWindow = useCallback((key: string) => setWindows((list) => { const item = list.find((entry) => entry.key === key); return item && list[list.length - 1] !== item ? [...list.filter((entry) => entry !== item), item] : list; }), []);
  // The tracker window follows the tracker's open flag (the GM opens it for everyone, §6.1).
  const trackerOpen = snapshot.tracker.open;
  useEffect(() => { setWindows((list) => { const has = list.some((item) => item.kind === "tracker"); if (trackerOpen && isGm && !has) return [...list, { key: "tracker", kind: "tracker" }]; if (!trackerOpen && has) return list.filter((item) => item.kind !== "tracker"); return list; }); }, [trackerOpen, isGm]);
  const openTracker = useCallback(() => { c.setTracker({ ...snapshot.tracker, open: true }); setWindows((list) => (list.some((item) => item.kind === "tracker") ? list : [...list, { key: "tracker", kind: "tracker" }])); }, [c, snapshot.tracker]);
  // "플레이어에게 보여주기": the GM's request opens the entry here.
  const shows = c.table.shows;
  useEffect(() => { for (const id of shows) { openEntry(id); c.dismissShow(id); } }, [shows, openEntry, c]);
  return (
    <div className="cl-page cl-table">
      <div className="cl-page-head">
        <h1>{snapshot.name}</h1>
        <Pill tone={c.table.status === "joined" ? "good" : "bad"}>{c.table.status === "joined" ? (c.table.role === "host" ? "호스트" : "연결됨") : c.table.status === "disconnected" ? "연결 끊김" : "닫힘"}</Pill>
        <span className="cl-presence">
          {snapshot.players.map((player) => <span key={player.userId} className={`cl-avatar-chip${player.connected ? "" : " off"}`} style={{ borderColor: player.color }} title={`${player.displayName}${player.role === "gm" ? " (GM)" : ""}${player.connected ? "" : " · 오프라인"}`}><span className="cl-swatch" style={{ background: player.color }} />{player.displayName}{player.role === "gm" ? <small>GM</small> : null}</span>)}
        </span>
        {c.table.role === "host" ? (
          <span className="cl-row cl-small" style={{ gap: 4 }}>
            <span className="cl-quiet">참가 코드</span>
            <code className="cl-code">{c.table.invite}</code>
            <button type="button" className="cl-btn small" onClick={async () => { setCopied(await copyText(c.table.invite ?? "")); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? "복사됨" : "복사"}</button>
          </span>
        ) : null}
        <div className="cl-actions">
          {isGm ? <button type="button" className={`cl-btn${trackerOpen ? " primary" : ""}`} onClick={() => c.setTracker({ ...snapshot.tracker, open: !trackerOpen })} title="열면 모든 참가자에게 뜹니다">턴 트래커{snapshot.tracker.turns.length ? ` · 라운드 ${snapshot.tracker.round}` : ""}</button> : null}
          {c.table.role === "host" ? <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "campaign", id: snapshot.campaignId })}>캠페인 설정</button> : null}
          <button type="button" className="cl-btn danger" onClick={() => { c.leave(); navigate({ screen: "campaigns" }); }}>{c.table.role === "host" ? "게임 닫기" : "나가기"}</button>
        </div>
      </div>
      {c.table.role === "host" && c.table.transportNote ? <Notice tone="warn">{c.table.transportNote}</Notice> : null}
      {c.table.refusals.length ? <div className="cl-toasts">{c.table.refusals.map((reason, index) => <Notice tone="bad" key={`${reason}-${index}`}>{reason}</Notice>)}</div> : null}
      <JournalWindows windows={windows} onClose={closeWindow} onFocus={focusWindow} onOpen={openEntry} />
      <div className="cl-table-grid">
        <section className="cl-table-main">
          <PageCanvas onOpenEntry={openEntry} onOpenToken={openToken} onOpenPageSettings={openPageSettings} onOpenTracker={openTracker} />
        </section>
        <aside className="cl-sidebar">
          <div className="cl-sidebar-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>채팅</button>
            <button type="button" role="tab" aria-selected={tab === "journal"} className={tab === "journal" ? "active" : ""} onClick={() => setTab("journal")}>저널{snapshot.journal.length ? <small className="cl-quiet"> {snapshot.journal.filter((entry) => !entry.archived).length}</small> : null}</button>
            <button type="button" role="tab" aria-selected={tab === "art"} className={tab === "art" ? "active" : ""} onClick={() => setTab("art")}>아트{snapshot.art.length ? <small className="cl-quiet"> {snapshot.art.length}</small> : null}</button>
            <button type="button" role="tab" aria-selected={tab === "compendium"} className={tab === "compendium" ? "active" : ""} onClick={() => setTab("compendium")}>컴펜디움</button>
          </div>
          {tab === "chat" ? <ChatTab isGm={isGm} /> : tab === "journal" ? <JournalTab onOpen={openEntry} onNewCharacter={openNewCharacter} /> : tab === "art" ? <ArtTab /> : <CompendiumTab onOpenEntry={openEntry} />}
        </aside>
      </div>
    </div>
  );
}

function ChatTab({ isGm }: { isGm: boolean }) {
  const c = useCampaigns();
  const dice = useDice();
  const snapshot = c.table.snapshot!;
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const superseded = useMemo(() => new Set(snapshot.chat.map((message) => message.supersedes).filter((id): id is string => Boolean(id))), [snapshot.chat]);
  const messages = useMemo(() => snapshot.chat.filter((message) => !superseded.has(message.id)), [snapshot.chat, superseded]);
  useEffect(() => { const list = listRef.current; if (list) list.scrollTop = list.scrollHeight; }, [messages.length]);
  const names = useMemo(() => Object.fromEntries(snapshot.players.map((player) => [player.userId, player])), [snapshot.players]);
  const submit = async () => {
    const raw = text;
    setText("");
    const input = parseChatInput(raw);
    if (input.kind === "empty") return;
    // Rolls typed here go through the 3D dice: the roller sees them tumble, then the result reaches the table.
    if (input.kind === "roll" && parseFormula(input.formula)) {
      const result = await dice.roll({ label: input.label ?? "굴림", formula: input.formula, kind: "custom" });
      c.sendRoll({ formula: input.formula, total: result.total, dice: result.dice.map((die) => ({ sides: die.sides, value: die.value })), modifier: result.modifier, label: input.label }, input.mode);
      return;
    }
    c.say(raw);
  };
  return (
    <div className="cl-chat">
      <div className="cl-chat-list" ref={listRef} aria-live="polite">
        {messages.length === 0 ? <p className="cl-quiet cl-small">아직 채팅이 없습니다. <code>/roll 1d20+5</code>, <code>/w 이름 귓속말</code>, <code>/gmroll</code>, <code>/em</code>{isGm ? ", /desc" : ""}, 인라인 <code>[[2d6]]</code></p> : messages.map((message) => <ChatLine key={message.id} message={message} me={c.userId} color={message.playerId ? names[message.playerId]?.color : undefined} targetName={message.target === "gm" ? "GM" : message.target ? names[message.target]?.displayName : undefined} />)}
      </div>
      <div className="cl-chat-input">
        <textarea className="cl-input" rows={2} placeholder="말하기… (/roll, /w, /em, [[1d6]])" aria-label="채팅 입력" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} />
        <div className="cl-row" style={{ gap: 4 }}>
          {["1d20", "1d12", "1d10", "1d8", "1d6", "1d4"].map((formula) => <button type="button" key={formula} className="cl-btn small" onClick={() => { setText(`/roll ${formula}`); }} title={`/roll ${formula}`}>{formula.slice(1)}</button>)}
          <button type="button" className="cl-btn small primary" style={{ marginLeft: "auto" }} disabled={!text.trim()} onClick={() => void submit()}>보내기</button>
        </div>
      </div>
    </div>
  );
}

function ChatLine({ message, me, color, targetName }: { message: ChatMessage; me: string; color?: string; targetName?: string }) {
  const time = new Date(message.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const mine = message.playerId === me;
  switch (message.type) {
    case "action": return <ActionCard message={message} time={time} color={color} />;
    case "prompt": return <PromptCard message={message} time={time} color={color} />;
    case "act": return <ActCard message={message} time={time} color={color} />;
    case "system": return <div className="cl-chat-msg system"><span className="cl-at">{time}</span>{message.content}</div>;
    case "desc": return <div className="cl-chat-msg desc"><span className="cl-at">{time}</span>{message.content}</div>;
    case "emote": return <div className="cl-chat-msg emote"><span className="cl-at">{time}</span><span className="cl-swatch" style={{ background: color }} /><em>{message.who} {message.content}</em></div>;
    case "whisper": return <div className="cl-chat-msg whisper"><span className="cl-at">{time}</span><span className="cl-who" style={{ color }}>{message.who}</span><span className="cl-quiet cl-small"> → {targetName ?? "?"} (귓속말)</span><div>{message.content}</div></div>;
    case "rollresult":
    case "gmroll": {
      const roll = message.roll!;
      return (
        <div className={`cl-chat-msg roll${message.type === "gmroll" ? " gm" : ""}`}>
          <span className="cl-at">{time}</span><span className="cl-who" style={{ color }}>{message.who}</span>{message.type === "gmroll" ? <Pill tone="accent">GM 굴림</Pill> : null}{message.target ? <Pill>나만</Pill> : null}
          <div className="cl-roll-card">
            <div className="cl-roll-head">{roll.label || "굴림"} <span className="cl-quiet cl-small">{roll.formula}</span></div>
            <div className="cl-roll-dice">{roll.dice.map((die, index) => <span key={index} className={`cl-die d${die.sides}${die.sides === 20 && die.value === 20 ? " crit" : die.sides === 20 && die.value === 1 ? " fumble" : ""}`} title={`d${die.sides}`}>{die.value}</span>)}{roll.modifier ? <span className="cl-mod">{roll.modifier > 0 ? "+" : "−"}{Math.abs(roll.modifier)}</span> : null}<span className="cl-eq">=</span><strong className="cl-total">{roll.total}</strong></div>
            <div className="cl-quiet cl-small" hidden>{describeChatRoll(roll)}</div>
          </div>
        </div>
      );
    }
    default: return <div className={`cl-chat-msg${mine ? " mine" : ""}`}><span className="cl-at">{time}</span><span className="cl-who" style={{ color }}>{message.who}</span><div>{message.content}</div></div>;
  }
}

/** D97: an official action's card — the check with its die, what happened, what was marked. */
function ActCard({ message, time, color }: { message: ChatMessage; time: string; color?: string }) {
  const act = message.act!;
  const marks = [...act.actorMarks.map((name) => `${act.actor.name}: ${name}`), ...act.targetMarks.map((name) => `${act.target?.name ?? "대상"}: ${name}`), ...act.actorUnmarks.map((name) => `${act.actor.name}: ${name} 해제`)];
  return (
    <div className="cl-chat-msg act" data-act-kind={act.kind}>
      <span className="cl-at">{time}</span>{message.who ? <span className="cl-who" style={{ color }}>{message.who}</span> : null}
      <div className="cl-act-card">
        <div className="cl-roll-head">{act.actor.name}{act.target ? ` → ${act.target.name}` : ""}: <strong>{act.name}</strong>{act.bonus ? <Pill tone="accent">추가 행동</Pill> : null}</div>
        {act.check ? <div className="cl-roll-dice"><span className="cl-quiet cl-small">{act.check.label}</span><span className={`cl-die d20${act.check.d20 === 20 ? " crit" : act.check.d20 === 1 ? " fumble" : ""}`}>{act.check.d20}</span>{act.check.bonus ? <span className="cl-mod">{act.check.bonus > 0 ? "+" : "−"}{Math.abs(act.check.bonus)}</span> : null}<span className="cl-eq">=</span><strong className="cl-total">{act.check.total}</strong>{act.check.dc !== undefined ? <span className="cl-quiet cl-small">vs DC {act.check.dc}</span> : null}{act.check.success !== undefined ? <Pill tone={act.check.success ? "good" : "bad"}>{act.check.success ? "성공" : "실패"}</Pill> : null}</div> : null}
        <div className="cl-small">{act.text}</div>
        {marks.length ? <div className="cl-quiet cl-small">표시: {marks.join(" · ")}</div> : null}
      </div>
    </div>
  );
}

/** D96: "○○이(가) △△에게서 벗어납니다" — the record in chat; the choices also sit in the approval dock over the board (D99). */
function PromptCard({ message, time, color }: { message: ChatMessage; time: string; color?: string }) {
  const prompt = message.prompt!;
  return (
    <div className="cl-chat-msg prompt" data-prompt-id={message.id}>
      <span className="cl-at">{time}</span>{message.who ? <span className="cl-who" style={{ color }}>{message.who}</span> : null}
      <div className="cl-prompt-card">
        <div>🏃 {prompt.mover.name}이(가) <strong>{prompt.reactor.name}</strong>에게서 벗어납니다</div>
        {prompt.outcome ? <Pill tone={prompt.outcome.attacked ? "bad" : "accent"}>{prompt.outcome.attacked ? "기회 공격" : "기회 공격 안 함"}</Pill> : <PromptChoices message={message} />}
      </div>
    </div>
  );
}

/** The 판정 card (§12.2 ⑥): every die, the comparison, what was applied, follow-ups, and the GM's palette. */
function ActionCard({ message, time, color }: { message: ChatMessage; time: string; color?: string }) {
  const c = useCampaigns();
  const snapshot = c.table.snapshot!;
  const isGm = snapshot.players.find((player) => player.userId === c.userId)?.role === "gm";
  const result = message.action as AttackResolution;
  const [delta, setDelta] = useState("");
  const [palette, setPalette] = useState(false);
  const outcome = result.outcome === "crit" ? "치명타" : result.outcome === "hit" ? "적중" : result.outcome === "fumble" ? "자동 실패" : "빗나감";
  const tone = result.outcome === "crit" || result.outcome === "hit" ? "good" : "bad";
  return (
    <div className={`cl-chat-msg action${message.undone ? " undone" : ""}`} data-action-id={message.id}>
      <span className="cl-at">{time}</span>{message.who ? <span className="cl-who" style={{ color }}>{message.who}</span> : null}{message.undone ? <Pill tone="bad">되돌림</Pill> : !result.applied ? <Pill tone="accent">DM 확인 대기</Pill> : null}
      <div className="cl-action-card">
        <div className="cl-roll-head"><Pill tone={tone}>{outcome}{result.damage.length && (result.outcome === "hit" || result.outcome === "crit") ? ` · 피해 ${result.damageTotal}` : ""}</Pill> {result.attacker.name} → {result.target.name}: {result.attack.name}{result.distanceFeet !== undefined ? <span className="cl-quiet cl-small"> · {result.distanceFeet} ft</span> : null}</div>
        <div className="cl-roll-dice">
          {result.d20s.map((die, index) => <span key={index} className={`cl-die d20${die === result.kept ? "" : " dropped"}${die === 20 ? " crit" : die === 1 ? " fumble" : ""}`}>{die}</span>)}
          {result.attack.bonus ? <span className="cl-mod">{result.attack.bonus > 0 ? "+" : "−"}{Math.abs(result.attack.bonus)}</span> : null}
          <span className="cl-eq">=</span><strong className="cl-total">{result.attackTotal}</strong>
          <span className="cl-quiet cl-small">vs AC {result.targetAc}{result.cover ? ` (엄폐 +${result.cover})` : ""}</span>
          <Pill tone={tone}>{outcome}</Pill>
          {result.advantage !== "normal" ? <Pill tone="accent">{result.advantage === "advantage" ? "유리" : "불리"}</Pill> : null}
        </div>
        {result.reasons.length ? <div className="cl-quiet cl-small">{result.reasons.join(" · ")}</div> : null}
        {result.damage.length ? (
          <div className="cl-action-damage">
            {result.damage.map((part, index) => <div key={index} className="cl-row cl-small" style={{ gap: 4 }}><span>{part.part.label ?? "피해"}</span>{part.dice.map((die, at) => <span key={at} className="cl-die small">{die}</span>)}<span>= {part.rolled} {damageTypeKo(part.part.type)}</span>{part.adjustment ? <Pill tone={part.adjustment === "취약" ? "bad" : "accent"}>{part.adjustment} → {part.adjusted}</Pill> : null}</div>)}
            <div className="cl-small"><strong>피해 {result.damageTotal}</strong>{result.overrides?.damageScale !== undefined || result.overrides?.damageDelta ? <span className="cl-quiet"> (DM 수정)</span> : null}{result.absorbed ? ` · 임시 HP ${result.absorbed} 흡수` : ""} · HP {result.hpBefore} → {result.hpAfter}{result.tempAfter ? ` (임시 ${result.tempAfter})` : ""}</div>
            {result.concentration ? <div className="cl-small">집중({result.concentration.effect}) 내성 DC {result.concentration.dc}: d20 {result.concentration.d20} {result.concentration.total >= 0 ? "+" : ""}{result.concentration.total - result.concentration.d20} = {result.concentration.total} → {result.concentration.success ? "유지" : "실패 (효과 종료)"}</div> : null}
            {result.inflicted.length ? <div className="cl-small">부여: {result.inflicted.join(", ")}</div> : null}
            {result.downed ? <div className="cl-small" style={{ color: "var(--bad)" }}>{result.downed === "dead" ? "HP 0 — 사망" : result.downed === "instant-death" ? "대량 피해 — 즉사" : "HP 0 — 무의식·넘어짐, 죽음 내성 시작"}</div> : null}
          </div>
        ) : null}
        {result.overrides?.note ? <div className="cl-small cl-quiet">DM 메모: {result.overrides.note}</div> : null}
        {isGm && !message.undone ? <button type="button" className="cl-btn small quiet cl-palette-toggle" aria-expanded={palette} onClick={() => setPalette((value) => !value)}>{palette ? "조정 닫기" : "조정 ▾"}</button> : null}
        {isGm && !message.undone && palette ? (
          <div className="cl-palette" aria-label="DM 팔레트">
            {!result.applied ? <button type="button" className="cl-btn small primary" onClick={() => c.confirmAction(message.id)}>적용</button> : null}
            <button type="button" className="cl-btn small" onClick={() => c.adjustAction(message.id, { outcome: "hit" })}>강제 적중</button>
            <button type="button" className="cl-btn small" onClick={() => c.adjustAction(message.id, { outcome: "miss" })}>빗나감</button>
            <button type="button" className="cl-btn small" onClick={() => c.adjustAction(message.id, { outcome: "crit" })}>치명타</button>
            <button type="button" className="cl-btn small" onClick={() => c.adjustAction(message.id, { cover: result.cover === 2 ? 0 : 2 })}>엄폐 +2</button>
            <button type="button" className="cl-btn small" onClick={() => c.adjustAction(message.id, { cover: result.cover === 5 ? 0 : 5 })}>엄폐 +5</button>
            <button type="button" className="cl-btn small" onClick={() => c.adjustAction(message.id, { advantage: "advantage" }, true)}>유리 재굴림</button>
            <button type="button" className="cl-btn small" onClick={() => c.adjustAction(message.id, { advantage: "disadvantage" }, true)}>불리 재굴림</button>
            <button type="button" className="cl-btn small" onClick={() => c.adjustAction(message.id, { damageScale: 0.5 })}>피해 절반</button>
            <button type="button" className="cl-btn small" onClick={() => c.adjustAction(message.id, { damageScale: 0 })}>피해 0</button>
            <input className="cl-input" style={{ width: 56, height: 26 }} placeholder="±N" aria-label="피해 수정" value={delta} onChange={(event) => setDelta(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && /^[+-]?\d+$/.test(delta.trim())) { c.adjustAction(message.id, { damageDelta: Number(delta) }); setDelta(""); } }} />
            <button type="button" className="cl-btn small danger" onClick={() => c.undoAction(message.id)}>되돌리기</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}