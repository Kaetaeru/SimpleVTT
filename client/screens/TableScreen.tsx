/**
 * The launched table (ROLL20_MODEL.md §3): header with the campaign, presence and the invite; the page area
 * (pages and tokens come in R5); the sidebar with the Chat tab — Roll20 commands, roll cards, whispers, GM rolls.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCampaigns } from "../app/campaigns";
import { useClient } from "../app/context";
import type { ChatMessage } from "../campaign/model";
import { parseFormula } from "../character/dice";
import { describeChatRoll, parseChatInput } from "../session/chat";
import { copyText, Notice, Pill } from "../ui/components";
import { useDice } from "../ui/dice/DiceProvider";
import { ArtTab } from "./ArtPanel";
import { JournalTab, JournalWindows, type JournalWindow } from "./JournalPanel";

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
  const [tab, setTab] = useState<"chat" | "journal" | "art">("chat");
  const [windows, setWindows] = useState<JournalWindow[]>([]);
  const openEntry = useCallback((id: string) => setWindows((list) => { const existing = list.find((item) => item.kind === "entry" && item.id === id); const rest = existing ? list.filter((item) => item !== existing) : list; return [...rest, existing ?? { key: `entry:${id}`, kind: "entry", id }]; }), []);
  const openNewCharacter = useCallback(() => setWindows((list) => (list.some((item) => item.kind === "new-character") ? list : [...list, { key: `new:${Date.now()}`, kind: "new-character" }])), []);
  const closeWindow = useCallback((key: string) => setWindows((list) => list.filter((item) => item.key !== key)), []);
  const focusWindow = useCallback((key: string) => setWindows((list) => { const item = list.find((entry) => entry.key === key); return item && list[list.length - 1] !== item ? [...list.filter((entry) => entry !== item), item] : list; }), []);
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
          {c.table.role === "host" ? <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "campaign", id: snapshot.campaignId })}>캠페인 설정</button> : null}
          <button type="button" className="cl-btn danger" onClick={() => { c.leave(); navigate({ screen: "campaigns" }); }}>{c.table.role === "host" ? "게임 닫기" : "나가기"}</button>
        </div>
      </div>
      {c.table.role === "host" && c.table.transportNote ? <Notice tone="warn">{c.table.transportNote}</Notice> : null}
      {c.table.refusals.length ? <div className="cl-toasts">{c.table.refusals.map((reason, index) => <Notice tone="bad" key={`${reason}-${index}`}>{reason}</Notice>)}</div> : null}
      <JournalWindows windows={windows} onClose={closeWindow} onFocus={focusWindow} onOpen={openEntry} />
      <div className="cl-table-grid">
        <section className="cl-table-main">
          <div className="cl-page-canvas">
            <p className="cl-quiet">페이지(지도)와 토큰은 다음 단계(R5)에서 이 자리에 옵니다. 지금은 저널의 캐릭터 시트로 운용하고, 채팅으로 굴리고 말합니다.</p>
          </div>
        </section>
        <aside className="cl-sidebar">
          <div className="cl-sidebar-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>채팅</button>
            <button type="button" role="tab" aria-selected={tab === "journal"} className={tab === "journal" ? "active" : ""} onClick={() => setTab("journal")}>저널{snapshot.journal.length ? <small className="cl-quiet"> {snapshot.journal.filter((entry) => !entry.archived).length}</small> : null}</button>
            <button type="button" role="tab" aria-selected={tab === "art"} className={tab === "art" ? "active" : ""} onClick={() => setTab("art")}>아트{snapshot.art.length ? <small className="cl-quiet"> {snapshot.art.length}</small> : null}</button>
            <button type="button" role="tab" disabled title="R6">컴펜디움</button>
          </div>
          {tab === "chat" ? <ChatTab isGm={isGm} /> : tab === "journal" ? <JournalTab onOpen={openEntry} onNewCharacter={openNewCharacter} /> : <ArtTab />}
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
  const messages = snapshot.chat;
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
