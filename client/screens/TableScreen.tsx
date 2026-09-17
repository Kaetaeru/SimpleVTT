/**
 * The launched table (ROLL20_MODEL.md §3): header with the campaign, presence and the invite; the page area
 * (pages and tokens come in R5); the sidebar with the Chat tab — Roll20 commands, roll cards, whispers, GM rolls.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCampaigns } from "../app/campaigns";
import { controlsToken } from "../campaign/page";
import { audienceIncludes } from "../campaign/journal";
import type { SpellResolution, SpellTargetResult } from "../rules/spellcast";
import { monsterById } from "../compendium/monsters";
import { spellExec } from "../compendium/spells";
import { summonRule, summonsNothing } from "../rules/summons";
import { useClient } from "../app/context";
import type { ChatMessage, Macro, RollTable } from "../campaign/model";
import { clockText } from "../campaign/model";
import { PromptChoices } from "./Notify";
import { ABILITY_KO } from "../catalog/types";
import type { AttackResolution } from "../rules/resolve";
import { damageTypeKo } from "../rules/resolve";
import { parseFormula } from "../character/dice";
import { describeChatRoll, expandMacros, parseChatInput } from "../session/chat";
import { copyText, Notice, Pill } from "../ui/components";
import { useDice } from "../ui/dice/DiceProvider";
import { ArtTab } from "./ArtPanel";
import { JournalTab, JournalWindows, type JournalWindow } from "./JournalPanel";
import { CompendiumTab } from "./CompendiumPanel";
import { PageCanvas, requestTargets, setHighlight } from "./PageCanvas";

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
  const [copied, setCopied] = useState<boolean | string>(false);
  const [noteClosed, setNoteClosed] = useState(false);
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
  useEffect(() => { setWindows((list) => { const has = list.some((item) => item.kind === "tracker"); // R27 (D143): "the GM opens it for everyone" now means everyone — a player could see the order in the ribbon but
      // never the initiative numbers, and had no way to fix a row the DM typo'd.
      if (trackerOpen && !has) return [...list, { key: "tracker", kind: "tracker" }]; if (!trackerOpen && has) return list.filter((item) => item.kind !== "tracker"); return list; }); }, [trackerOpen, isGm]);
  const openTracker = useCallback(() => { if (isGm) c.setTracker({ ...snapshot.tracker, open: true }); setWindows((list) => (list.some((item) => item.kind === "tracker") ? list : [...list, { key: "tracker", kind: "tracker" }])); }, [c, snapshot.tracker, isGm]);
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
          // R70 (D205): in the exe the way in is an address — Hamachi first, each with its own copy button.
          c.table.invites.some((invite) => invite.startsWith("tcp:")) ? (
            <span className="cl-row cl-small cl-invite" style={{ gap: 6 }}>
              {c.table.invites.filter((invite) => invite.startsWith("tcp:")).slice(0, 2).map((invite) => { const address = invite.slice("tcp:".length).replace(/-[A-Z0-9]{6}$/, ""); return (
                <span key={address} className="cl-row" style={{ gap: 4 }}>
                  <span className="cl-quiet">{address.startsWith("25.") ? "하마치" : "LAN"}</span>
                  <code className="cl-code" title={`${address} — IP와 포트`}>{address}</code>
                  <button type="button" className="cl-btn small" onClick={async () => { setCopied((await copyText(address)) ? address : false); window.setTimeout(() => setCopied(false), 2000); }}>{copied === address ? "복사됨" : "복사"}</button>
                </span>
              ); })}
            </span>
          ) :
          <span className="cl-row cl-small cl-invite" style={{ gap: 4 }}>
            {/* R68 (D203): the code is long and only ever copied; it shows as much as fits and the button says what it is. */}
            <code className="cl-code" title={`참가 코드: ${c.table.invite ?? ""}`}>{c.table.invite}</code>
            <button type="button" className="cl-btn small" title="참가 코드를 복사합니다" onClick={async () => { setCopied((await copyText(c.table.invite ?? "")) ? true : false); window.setTimeout(() => setCopied(false), 2000); }}>{copied === true ? "복사됨" : "참가 코드 복사"}</button>
          </span>
        ) : null}
        <ClockStrip isGm={isGm} />
        <div className="cl-actions">
          {isGm ? <button type="button" className={`cl-btn${trackerOpen ? " primary" : ""}`} onClick={() => c.setTracker({ ...snapshot.tracker, open: !trackerOpen })} title="열면 모든 참가자에게 뜹니다">턴 트래커{snapshot.tracker.turns.length ? ` · 라운드 ${snapshot.tracker.round}` : ""}</button>
            : trackerOpen ? <button type="button" className="cl-btn" onClick={openTracker} title="순서와 이니셔티브 (내 행만 고칠 수 있습니다)">턴 트래커{snapshot.tracker.turns.length ? ` · 라운드 ${snapshot.tracker.round}` : ""}</button> : null}
          {c.table.role === "host" ? <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "campaign", id: snapshot.campaignId })}>캠페인 설정</button> : null}
          <button type="button" className="cl-btn danger" onClick={() => { c.leave(); navigate({ screen: "campaigns" }); }}>{c.table.role === "host" ? "게임 닫기" : "나가기"}</button>
        </div>
      </div>
      {/* R27 (D145): the table says plainly when it is no longer live, instead of looking exactly like a live one. */}
      {c.table.status === "disconnected" ? <Notice tone="bad">연결이 끊겼습니다. 여기 보이는 것은 마지막으로 받은 상태이고, 지금 누르는 것은 테이블에 전해지지 않습니다 — 다시 연결되면 이어집니다.</Notice> : null}
      {c.table.status === "closed" ? <Notice tone="bad">테이블이 닫혔습니다. 이 화면은 마지막 상태이며 더는 바뀌지 않습니다.</Notice> : null}
      {/* R68 (D203): a note the host reads once; it can be closed for the rest of the session. */}
      {c.table.role === "host" && c.table.transportNote && !noteClosed ? <Notice tone="warn"><span className="cl-row" style={{ gap: 8 }}>{c.table.transportNote}<button type="button" className="cl-btn small quiet" style={{ marginLeft: "auto" }} aria-label="안내 닫기" onClick={() => setNoteClosed(true)}>✕</button></span></Notice> : null}
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
  // R17: `#이름` runs a macro — the campaign's shared ones plus the macros on sheets this viewer controls.
  const myMacros = useMemo(() => {
    // R27: `canEdit` is an Audience — "all" or a list. `"all".includes(userId)` is a substring test that is always
    // false, so a sheet shared with 모든 플레이어 lost its macros for everyone (D138).
    const mine = snapshot.journal.filter((entry) => isGm || audienceIncludes(entry.canEdit, c.userId)).flatMap((entry) => (entry.macros ?? []).map((macro) => ({ ...macro, from: entry.name })));
    return [...snapshot.macros.map((macro) => ({ ...macro, from: "캠페인" })), ...mine];
  }, [snapshot.journal, snapshot.macros, c.userId, isGm]);
  const submit = async (typed?: string) => {
    const raw = expandMacros(typed ?? text, myMacros);
    if (typed === undefined) setText("");
    const input = parseChatInput(raw);
    if (input.kind === "empty") return;
    if (input.kind === "table") { c.rollTable(input.name, input.count, input.mode); return; }
    // Rolls typed here go through the 3D dice: the roller sees them tumble, then the result reaches the table.
    if (input.kind === "roll" && parseFormula(input.formula)) {
      const result = await dice.roll({ label: input.label ?? "굴림", formula: input.formula, kind: "custom" });
      c.sendRoll({ formula: input.formula, total: result.total, dice: result.dice.map((die) => ({ sides: die.sides, value: die.value, ...(die.dropped ? { dropped: true } : {}), ...(die.exploded ? { exploded: true } : {}), ...(die.success ? { success: true } : {}) })), modifier: result.modifier, label: input.label, ...(result.successes !== undefined ? { successes: result.successes } : {}) }, input.mode);
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
        <MacroBar macros={myMacros} tables={snapshot.tables} isGm={isGm} onRun={(macro) => void submit(macro)} onTable={(name) => c.rollTable(name)} />
        <textarea className="cl-input" rows={2} placeholder="말하기… (/roll 4d6kh3, #매크로, /roll 1t[표], [[1d6]])" aria-label="채팅 입력" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} />
        <div className="cl-row" style={{ gap: 4 }}>
          {["1d20", "1d12", "1d10", "1d8", "1d6", "1d4"].map((formula) => <button type="button" key={formula} className="cl-btn small" onClick={() => { setText(`/roll ${formula}`); }} title={`/roll ${formula}`}>{formula.slice(1)}</button>)}
          <button type="button" className="cl-btn small primary" style={{ marginLeft: "auto" }} disabled={!text.trim()} onClick={() => void submit()}>보내기</button>
        </div>
      </div>
    </div>
  );
}

/**
 * R18 (D115): the in-world clock. Everyone reads the time; the DM moves it and starts the table's rests. A player
 * can only ask — the ask goes to the chat so the whole table sees it, and the DM decides.
 */
function ClockStrip({ isGm }: { isGm: boolean }) {
  const c = useCampaigns();
  const clock = c.table.snapshot!.clock;
  // R68 (D203): the clock is one chip; what moves it (and the rests) opens under it instead of lining the header.
  const [open, setOpen] = useState(false);
  return (
    <span className="cl-clock cl-small" style={{ position: "relative" }}>
      <button type="button" className={`cl-btn small cl-clock-now${open ? " active" : ""}`} title="게임 속 시간 — 시간 넘기기와 휴식" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((value) => !value)}>🕒 {clockText(clock)} ▾</button>
      {!open ? null : <span className="cl-clock-menu" onClick={() => setOpen(false)}>
      {isGm ? (
        <>
          {[{ label: "+10분", minutes: 10 }, { label: "+1시간", minutes: 60 }].map((step) => <button type="button" key={step.label} className="cl-btn small quiet" onClick={() => c.advanceTime(step.minutes)}>{step.label}</button>)}
          <button type="button" className="cl-btn small" title="1시간이 지나고 모든 캐릭터가 짧은 휴식을 합니다" onClick={() => c.tableRest("short")}>짧은 휴식</button>
          <button type="button" className="cl-btn small" title="8시간이 지나고 모든 캐릭터와 NPC의 하루가 돌아옵니다" onClick={() => { if (confirm("긴 휴식: 모든 캐릭터의 HP·슬롯·횟수와 NPC의 하루 횟수가 돌아옵니다. 진행할까요?")) c.tableRest("long"); }}>긴 휴식</button>
        </>
      ) : (
        <>
          <button type="button" className="cl-btn small quiet" onClick={() => c.askRest("short")}>짧은 휴식 제안</button>
          <button type="button" className="cl-btn small quiet" onClick={() => c.askRest("long")}>긴 휴식 제안</button>
        </>
      )}
      </span>}
    </span>
  );
}

/**
 * R17 (D114): the macro bar over the chat box — one button per macro this viewer may run and per rollable table,
 * with the GM's editor for the campaign's own behind ✎. A character's macros live on its sheet (저널 → 매크로).
 */
function MacroBar({ macros, tables, isGm, onRun, onTable }: { macros: Array<Macro & { from: string }>; tables: RollTable[]; isGm: boolean; onRun: (text: string) => void; onTable: (name: string) => void }) {
  const c = useCampaigns();
  const [editing, setEditing] = useState(false);
  const campaign = c.table.snapshot!.macros;
  const set = (next: Macro[]) => c.saveMacros(next);
  const setTables = (next: RollTable[]) => c.saveTables(next);
  const newId = () => `m_${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div className="cl-macro-bar">
      <div className="cl-row cl-small" style={{ gap: 4, flexWrap: "wrap" }}>
        {macros.map((macro) => <button type="button" key={`${macro.from}:${macro.id}`} className="cl-btn small" title={`${macro.from} · ${macro.text}`} onClick={() => onRun(macro.text)}>#{macro.name}</button>)}
        {tables.map((table) => <button type="button" key={table.id} className="cl-btn small" title={`굴림표 ${table.name} — /roll 2t[${table.name}]로 여러 번`} onClick={() => onTable(table.name)}>🎲 {table.name}</button>)}
        {isGm ? <button type="button" className="cl-btn small quiet" aria-label="매크로·굴림표 편집" onClick={() => setEditing((value) => !value)}>{editing ? "닫기" : "✎ 매크로·굴림표"}</button> : null}
        {!macros.length && !tables.length && !isGm ? <span className="cl-quiet">매크로는 시트의 "매크로"에서, 굴림표는 DM이 만듭니다.</span> : null}
      </div>
      {editing && isGm ? (
        <div className="cl-card cl-small" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          <strong>캠페인 매크로</strong>
          {campaign.map((macro, index) => (
            <div className="cl-row" style={{ gap: 4 }} key={macro.id}>
              <input className="cl-input" style={{ width: 110, height: 24 }} aria-label={`매크로 ${index + 1} 이름`} value={macro.name} onChange={(event) => set(campaign.map((item, at) => (at === index ? { ...item, name: event.target.value.replace(/\s/g, "") } : item)))} />
              <input className="cl-input" style={{ flex: 1, height: 24 }} aria-label={`매크로 ${index + 1} 내용`} placeholder="/roll 1d20+5 #공격" value={macro.text} onChange={(event) => set(campaign.map((item, at) => (at === index ? { ...item, text: event.target.value } : item)))} />
              <label className="cl-row cl-small" style={{ gap: 2 }}><input type="checkbox" checked={Boolean(macro.shared)} onChange={(event) => set(campaign.map((item, at) => (at === index ? { ...item, shared: event.target.checked } : item)))} aria-label={`${macro.name} 플레이어에게도`} />공유</label>
              <button type="button" className="cl-btn small danger" onClick={() => set(campaign.filter((_, at) => at !== index))}>✕</button>
            </div>
          ))}
          <button type="button" className="cl-btn small" onClick={() => set([...campaign, { id: newId(), name: `매크로${campaign.length + 1}`, text: "/roll 1d20" }])}>+ 매크로</button>
          <strong>굴림표</strong>
          {tables.map((table, index) => (
            <div key={table.id} style={{ display: "flex", flexDirection: "column", gap: 3, borderTop: "1px solid var(--line)", paddingTop: 4 }}>
              <div className="cl-row" style={{ gap: 4 }}>
                <input className="cl-input" style={{ width: 130, height: 24 }} aria-label={`굴림표 ${index + 1} 이름`} value={table.name} onChange={(event) => setTables(tables.map((item, at) => (at === index ? { ...item, name: event.target.value } : item)))} />
                <span className="cl-quiet">{table.rows.length}개 항목 · <code>/roll 1t[{table.name}]</code></span>
                {/* R25 (D134): a table a player may draw from is shared on purpose, like a macro; the rows stay the GM's. */}
                <label className="cl-row cl-small" style={{ gap: 2 }} title="플레이어도 이 표를 굴릴 수 있습니다 (항목은 여전히 보이지 않습니다)"><input type="checkbox" checked={Boolean(table.shared)} onChange={(event) => setTables(tables.map((item, at) => (at === index ? { ...item, shared: event.target.checked } : item)))} aria-label={`${table.name} 플레이어에게도`} />공유</label>
                <button type="button" className="cl-btn small danger" style={{ marginLeft: "auto" }} onClick={() => setTables(tables.filter((_, at) => at !== index))}>표 삭제</button>
              </div>
              {table.rows.map((row, rowAt) => (
                <div className="cl-row" style={{ gap: 4 }} key={rowAt}>
                  <input className="cl-input" style={{ flex: 1, height: 24 }} aria-label={`${table.name} ${rowAt + 1}번 항목`} value={row.text} onChange={(event) => setTables(tables.map((item, at) => (at === index ? { ...item, rows: item.rows.map((candidate, where) => (where === rowAt ? { ...candidate, text: event.target.value } : candidate)) } : item)))} />
                  <input className="cl-input" type="number" min={1} max={999} style={{ width: 56, height: 24 }} aria-label={`${table.name} ${rowAt + 1}번 가중치`} value={row.weight} onChange={(event) => setTables(tables.map((item, at) => (at === index ? { ...item, rows: item.rows.map((candidate, where) => (where === rowAt ? { ...candidate, weight: Math.max(1, Number(event.target.value) || 1) } : candidate)) } : item)))} />
                  <button type="button" className="cl-btn small danger" onClick={() => setTables(tables.map((item, at) => (at === index ? { ...item, rows: item.rows.filter((_, where) => where !== rowAt) } : item)))}>✕</button>
                </div>
              ))}
              <button type="button" className="cl-btn small" onClick={() => setTables(tables.map((item, at) => (at === index ? { ...item, rows: [...item.rows, { text: "", weight: 1 }] } : item)))}>+ 항목</button>
            </div>
          ))}
          <button type="button" className="cl-btn small" onClick={() => setTables([...tables, { id: newId(), name: `굴림표${tables.length + 1}`, rows: [{ text: "", weight: 1 }] }])}>+ 굴림표</button>
        </div>
      ) : null}
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
    case "spell": return <SpellCard message={message} time={time} color={color} />;
    case "system": return <div className="cl-chat-msg system"><span className="cl-at">{time}</span>{message.content}</div>;
    case "desc": return <div className="cl-chat-msg desc"><span className="cl-at">{time}</span>{message.content}</div>;
    case "emote": return <div className="cl-chat-msg emote"><span className="cl-at">{time}</span><span className="cl-swatch" style={{ background: color }} /><em>{message.who} {message.content}</em></div>;
    case "whisper": return <div className="cl-chat-msg whisper"><span className="cl-at">{time}</span><span className="cl-who" style={{ color }}>{message.who}</span><span className="cl-quiet cl-small"> → {targetName ?? "?"} (귓속말)</span><div>{message.content}</div></div>;
    case "rollresult":
    case "gmroll": {
      const roll = message.roll;
      // R17: a rollable table draws rows, not dice — its card is the drawn text, with no die block.
      if (!roll || roll.drawn?.length) {
        return (
          <div className={`cl-chat-msg roll${message.type === "gmroll" ? " gm" : ""}`}>
            <span className="cl-at">{time}</span><span className="cl-who" style={{ color }}>{message.who}</span>{message.type === "gmroll" ? <Pill tone="accent">GM 굴림</Pill> : null}
            <div className="cl-roll-card">
              <div className="cl-roll-head">🎲 {roll?.label || "굴림표"}</div>
              {(roll?.drawn ?? [message.content]).map((row, index) => <div key={index} className="cl-roll-drawn">{row}</div>)}
            </div>
          </div>
        );
      }
      return (
        <div className={`cl-chat-msg roll${message.type === "gmroll" ? " gm" : ""}`}>
          <span className="cl-at">{time}</span><span className="cl-who" style={{ color }}>{message.who}</span>{message.type === "gmroll" ? <Pill tone="accent">GM 굴림</Pill> : null}{message.target ? <Pill>나만</Pill> : null}
          <div className="cl-roll-card">
            <div className="cl-roll-head">{roll.label || "굴림"} <span className="cl-quiet cl-small">{roll.formula}</span></div>
            <div className="cl-roll-dice">{roll.dice.map((die, index) => <span key={index} className={`cl-die d${die.sides}${die.dropped ? " dropped" : ""}${die.success ? " success" : ""}${die.sides === 20 && die.value === 20 ? " crit" : die.sides === 20 && die.value === 1 ? " fumble" : ""}`} title={die.dropped ? `d${die.sides} · 버림` : die.exploded ? `d${die.sides} · 폭발` : `d${die.sides}`}>{die.value}{die.exploded ? "!" : ""}</span>)}{roll.modifier && roll.successes === undefined ? <span className="cl-mod">{roll.modifier > 0 ? "+" : "−"}{Math.abs(roll.modifier)}</span> : null}<span className="cl-eq">=</span><strong className="cl-total">{roll.successes !== undefined ? `성공 ${roll.successes}` : roll.total}</strong></div>
            <div className="cl-quiet cl-small" hidden>{describeChatRoll(roll)}</div>
          </div>
        </div>
      );
    }
    default: return <div className={`cl-chat-msg${mine ? " mine" : ""}`}><span className="cl-at">{time}</span><span className="cl-who" style={{ color }}>{message.who}</span><div>{message.content}</div></div>;
  }
}

/**
 * R16 (D112): a spell that puts a creature on the board offers it right on the card — the summoner's controller (or
 * the DM) picks one of the forms the SRD names and the host makes its journal entry and token. The 2024 conjure
 * spells that summon nothing say so instead of offering a button that would be wrong.
 */
function SummonRow({ spell }: { spell: SpellResolution }) {
  const c = useCampaigns();
  const snapshot = c.table.snapshot!;
  const isGm = snapshot.players.find((player) => player.userId === c.userId)?.role === "gm";
  const rule = summonRule(spell.spellId);
  const nothing = summonsNothing(spell.spellId);
  const casterEntry = snapshot.journal.find((item) => item.id === spell.caster.id);
  const seat = useMemo(() => {
    for (const page of snapshot.pages) { const token = page.tokens.find((item) => item.represents === spell.caster.id); if (token) return { entryId: spell.caster.id, pageId: page.id, tokenId: token.id }; }
    return null;
  }, [snapshot.pages, spell.caster.id]);
  const mine = isGm || Boolean(casterEntry && audienceIncludes(casterEntry.canEdit, c.userId));
  const [pick, setPick] = useState("");
  const placed = snapshot.journal.some((item) => item.kind === "npc" && item.summonedBy?.entryId === spell.caster.id && item.summonedBy.spellId === spell.spellId);
  // R84 (D219): a spell that brings its own creature offers its forms; the host fills in the numbers for this cast.
  const template = spellExec(spell.spellId)?.summon;
  if (template && mine) {
    if (!seat) return <div className="cl-small cl-quiet">🌀 시전자의 토큰이 장면에 없어 소환물을 놓을 수 없습니다.</div>;
    return (
      <div className="cl-row cl-small" style={{ gap: 4, flexWrap: "wrap" }}>
        {template.note ? <span className="cl-quiet">🌀 {template.note}</span> : null}
        {template.forms.length > 1 ? <select className="cl-select" style={{ height: 26 }} aria-label="소환 형태" value={pick || "0"} onChange={(event) => setPick(event.target.value)}>{template.forms.map((form, index) => <option key={form.name} value={index}>{form.name}</option>)}</select> : null}
        {!placed ? <button type="button" className="cl-btn small primary" onClick={() => c.summon(seat, "", { spellId: spell.spellId, form: Number(pick || 0) })}>소환</button> : <button type="button" className="cl-btn small" onClick={() => c.dismissSummons(seat, spell.spellId)}>소환물 돌려보내기</button>}
      </div>
    );
  }
  if (nothing) return <div className="cl-small cl-quiet">🌀 {nothing}</div>;
  if (!rule || !mine) return null;
  if (!seat) return <div className="cl-small cl-quiet">🌀 시전자의 토큰이 장면에 없어 소환물을 놓을 수 없습니다.</div>;
  const options = rule.choices.map((id) => monsterById(id)).filter((monster): monster is NonNullable<typeof monster> => Boolean(monster));
  return (
    <div className="cl-row cl-small" style={{ gap: 4, flexWrap: "wrap" }}>
      <span className="cl-quiet">🌀 {rule.note}</span>
      {options.length ? (
        <>
          <select className="cl-select" style={{ height: 26 }} aria-label="소환할 크리처" value={pick || options[0].id} onChange={(event) => setPick(event.target.value)}>
            {options.map((monster) => <option key={monster.id} value={monster.id}>{monster.name}</option>)}
          </select>
          <button type="button" className="cl-btn small primary" onClick={() => c.summon(seat, pick || options[0].id, { count: rule.count, spellId: spell.spellId })}>소환{rule.count > 1 ? ` ×${rule.count}` : ""}</button>
        </>
      ) : <span className="cl-quiet">컴펜디움에서 괴물을 골라 캔버스에 놓으세요.</span>}
      {placed ? <button type="button" className="cl-btn small" onClick={() => c.dismissSummons(seat, spell.spellId)}>소환물 돌려보내기</button> : null}
    </div>
  );
}

/** D102: a spell's card — one row per target: the spell attack's dice, the save vs DC, damage after resistances, healing, the effect started. */
function SpellCard({ message, time, color }: { message: ChatMessage; time: string; color?: string }) {
  const c = useCampaigns();
  const snapshot = c.table.snapshot!;
  const isGm = snapshot.players.find((player) => player.userId === c.userId)?.role === "gm";
  const spell = message.spell!;
  // R12: a monster with Legendary Resistance left may turn a failed save into a success (DM).
  const resistLeft = (row: SpellTargetResult) => { const entry = snapshot.journal.find((item) => item.id === row.target.id); return entry?.kind === "npc" ? Math.max(0, (entry.statBlock.legendaryResistance ?? 0) - (entry.runtime.legendaryResistanceUsed ?? 0)) : 0; };
  return (
    <div className={`cl-chat-msg spell${message.undone ? " undone" : ""}`} data-spell-id={message.id}>
      <span className="cl-at">{time}</span>{message.who ? <span className="cl-who" style={{ color }}>{message.who}</span> : null}{message.undone ? <Pill tone="bad">되돌림</Pill> : !spell.applied ? <Pill tone="accent">DM 확인 대기</Pill> : null}
      <div className="cl-act-card">
        <div className="cl-roll-head">{spell.source === "action" ? "☄" : "✨"} <strong>{spell.name}</strong>{spell.source === "action" ? <span className="cl-quiet cl-small"> NPC 행동</span> : spell.level ? <span className="cl-quiet cl-small"> {spell.level}레벨</span> : <span className="cl-quiet cl-small"> 소마법</span>} · {spell.caster.name}{spell.concentration ? <Pill tone="accent">집중</Pill> : null}{spell.economy === "bonus-action" ? <Pill>추가 행동</Pill> : spell.economy === "reaction" ? <Pill>반응</Pill> : null}</div>
        {spell.targets.map((row) => (
          <div className="cl-small cl-spell-row" key={row.target.id} onMouseEnter={() => setHighlight({ entryId: row.target.id, tokenId: row.target.tokenId })} onMouseLeave={() => setHighlight(null)}>
            <strong>{row.target.name}</strong>{row.save?.legendary ? <Pill tone="accent">전설 저항</Pill> : null}{resistLeft(row) > 0 && isGm && spell.applied && !message.undone && row.save && !row.save.success ? <button type="button" className="cl-btn small" onClick={() => c.resist(message.id, row.target.id, row.target.tokenId)} title="전설 저항: 실패한 내성을 성공으로">전설 저항 ({resistLeft(row)})</button> : null}
            {row.attack ? <> <span className={`cl-die d20${row.attack.kept === 20 ? " crit" : row.attack.kept === 1 ? " fumble" : ""}`}>{row.attack.kept}</span><span className="cl-mod">{row.attack.attack.bonus >= 0 ? "+" : "−"}{Math.abs(row.attack.attack.bonus)}</span><span className="cl-eq">=</span><strong>{row.attack.attackTotal}</strong> <span className="cl-quiet">vs AC {row.attack.targetAc}</span> <Pill tone={row.attack.outcome === "hit" || row.attack.outcome === "crit" ? "good" : "bad"}>{row.attack.outcome === "crit" ? "치명타" : row.attack.outcome === "hit" ? "적중" : row.attack.outcome === "fumble" ? "자동 실패" : "빗나감"}</Pill>{row.attack.damage.length ? <> {row.attack.damage.flatMap((part) => part.dice).map((die, at) => <span key={at} className="cl-die small">{die}</span>)} = 피해 {row.attack.damageTotal}{row.attack.damage.some((part) => part.adjustment) ? ` (${row.attack.damage.filter((part) => part.adjustment).map((part) => part.adjustment).join(", ")})` : ""}</> : null}</> : null}
            {row.save ? <> {ABILITY_KO[row.save.ability]} 내성 <span className={`cl-die d20${row.save.d20 === 20 ? " crit" : row.save.d20 === 1 ? " fumble" : ""}`}>{row.save.d20}</span><span className="cl-mod">{row.save.bonus >= 0 ? "+" : "−"}{Math.abs(row.save.bonus)}</span><span className="cl-eq">=</span><strong>{row.save.total}</strong> <span className="cl-quiet">vs DC {row.save.dc}</span> <Pill tone={row.save.success ? "good" : "bad"}>{row.save.success ? "성공" : "실패"}</Pill>{row.save.advantage ? <span className="cl-quiet cl-small"> ({row.save.advantage} 유리, {row.save.dropped} 버림)</span> : null}</> : null}
            <span className="cl-spell-then">
            {row.damage && row.damage.damage.length ? <> {row.damage.damage.flatMap((part) => part.dice).map((die, at) => <span key={at} className="cl-die small">{die}</span>)} = 피해 {row.damage.damageTotal}{row.save?.success ? " (절반)" : ""}{row.damage.damage.some((part) => part.adjustment) ? ` (${row.damage.damage.filter((part) => part.adjustment).map((part) => part.adjustment).join(", ")})` : ""}{row.projectiles ? ` · 화살 ${row.projectiles}` : ""}</> : row.damage && row.save?.success ? " 피해 없음" : null}
            {row.healed !== undefined ? <> 회복 <strong>{row.healed}</strong> <span className="cl-quiet">({row.note})</span></> : null}
            {row.tempHp !== undefined ? <> 임시 HP <strong>{row.tempHp}</strong> <span className="cl-quiet">({row.note})</span></> : null}
            {row.hpAfter !== row.hpBefore ? <span className="cl-quiet"> · HP {row.hpBefore} → {row.hpAfter}</span> : null}
            {row.marks.length ? <span> · 부여: {row.marks.join(", ")}</span> : null}
            {row.effect ? <span> · {row.effect.name} ({row.effect.duration})</span> : null}
            {(row.attack?.concentration ?? row.damage?.concentration) ? <span> · 집중 {(row.attack?.concentration ?? row.damage?.concentration)!.success ? "유지" : "실패"}</span> : null}
            {(row.attack?.downed ?? row.damage?.downed) ? <span style={{ color: "var(--bad)" }}> · {(row.attack?.downed ?? row.damage?.downed) === "dead" ? "사망" : "쓰러짐"}</span> : null}
            {row.note && row.mode === "effect" ? <span className="cl-quiet"> · {row.note}</span> : null}
            </span>
          </div>
        ))}
        {spell.note ? <div className="cl-small cl-quiet">{spell.note}</div> : null}
        <SummonRow spell={spell} />
        {isGm && !message.undone && spell.applied ? <div className="cl-row" style={{ gap: 4 }}><button type="button" className="cl-btn small danger" onClick={() => c.undoAction(message.id)}>되돌리기</button></div> : null}
        {isGm && !message.undone && !spell.applied ? <div className="cl-row" style={{ gap: 4 }}><button type="button" className="cl-btn small primary" onClick={() => c.confirmAction(message.id)}>적용</button><button type="button" className="cl-btn small quiet" onClick={() => c.undoAction(message.id)}>취소</button></div> : null}
      </div>
    </div>
  );
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
        {prompt.kind === "counterspell" ? <div>🚫 {prompt.mover.name}이(가) {prompt.spell?.name}{prompt.spell ? ` (${prompt.spell.level}레벨)` : ""} 시전 — <strong>{prompt.reactor.name}</strong>의 주문 차단?</div>
          : prompt.kind === "shield" || prompt.kind === "guard" ? <div>🛡 {prompt.mover.name}의 {prompt.attack?.name}이(가) <strong>{prompt.reactor.name}</strong>에게 적중 ({prompt.attack?.total} vs AC {prompt.attack?.ac}) — 반응?</div>
          // R63 (D198): the attacker's own window once the swing landed.
          : prompt.kind === "on-hit" ? <div>⚔ <strong>{prompt.reactor.name}</strong>의 {prompt.attack?.name}이(가) {prompt.mover.name}에게 {prompt.onHit?.outcome === "crit" ? "치명타" : "명중"} — 명중 후 선택</div>
          : prompt.kind === "rescue" || prompt.kind === "death-save" ? <div>{message.content}</div>
          : <div>🏃 {prompt.mover.name}이(가) <strong>{prompt.reactor.name}</strong>에게서 벗어납니다</div>}
        {prompt.outcome ? <Pill tone={prompt.outcome.attacked || prompt.outcome.shielded || prompt.outcome.countered || prompt.outcome.chosen?.length ? "bad" : "accent"}>{prompt.kind === "on-hit" ? (prompt.outcome.chosen?.length ? prompt.outcome.chosen.join(" · ") : "안 함") : prompt.kind === "counterspell" ? (prompt.outcome.countered ? "주문 차단" : prompt.outcome.declined ? "차단 안 함" : "차단 실패") : prompt.kind === "shield" ? (prompt.outcome.shielded ? "방패 시전" : "방패 안 씀") : prompt.outcome.attacked ? "기회 공격" : "기회 공격 안 함"}</Pill> : <PromptChoices message={message} />}
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
  // R12: the Cleave follow-up belongs to whoever controls the attacker; the card offers it once the hit landed.
  const attackerToken = result.attackerRef?.tokenId ? snapshot.pages.flatMap((page) => page.tokens).find((token) => token.id === result.attackerRef!.tokenId) : undefined;
  const cleaveMine = isGm || (attackerToken ? controlsToken(attackerToken, { userId: c.userId, role: "player" }, snapshot.journal) : false);
  const cleave = async () => {
    if (!result.attackRef || !result.attackerRef) return;
    const picked = await requestTargets("쪼개기 — 5 ft 안의 다른 대상을 클릭하세요", { multi: false, exclude: result.attackerRef.tokenId });
    if (!picked.length) return;
    c.attack(result.attackerRef, [{ pageId: result.attackerRef.pageId, tokenId: picked[0] }], result.attackRef, { cleave: true });
  };
  return (
    <div className={`cl-chat-msg action${message.undone ? " undone" : ""}`} data-action-id={message.id} onMouseEnter={() => setHighlight({ entryId: result.target.id })} onMouseLeave={() => setHighlight(null)}>
      <span className="cl-at">{time}</span>{message.who ? <span className="cl-who" style={{ color }}>{message.who}</span> : null}{message.undone ? <Pill tone="bad">되돌림</Pill> : !result.applied ? <Pill tone="accent">DM 확인 대기</Pill> : null}
      <div className="cl-action-card">
        <div className="cl-roll-head"><Pill tone={tone}>{outcome}{result.damage.length && (result.outcome === "hit" || result.outcome === "crit") ? ` · 피해 ${result.damageTotal}` : ""}</Pill> {result.attacker.name} → {result.target.name}: {result.attack.name}</div>
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
        {result.mastery ? (
          <div className="cl-small cl-mastery">⚒ 통달 · <strong>{result.mastery.label}</strong>
            {result.mastery.save ? <> — 건강 내성 <span className={`cl-die d20${result.mastery.save.d20 === 20 ? " crit" : result.mastery.save.d20 === 1 ? " fumble" : ""}`}>{result.mastery.save.d20}</span><span className="cl-mod">{result.mastery.save.bonus >= 0 ? "+" : "−"}{Math.abs(result.mastery.save.bonus)}</span><span className="cl-eq">=</span><strong>{result.mastery.save.total}</strong> <span className="cl-quiet">vs DC {result.mastery.save.dc}</span> <Pill tone={result.mastery.save.success ? "good" : "bad"}>{result.mastery.save.success ? "성공" : "실패"}</Pill></> : null}
            {result.mastery.note ? <span className="cl-quiet"> — {result.mastery.note}</span> : null}
            {result.mastery.kind === "cleave" && (result.outcome === "hit" || result.outcome === "crit") && result.attackRef && result.attackerRef && !message.undone && result.applied && cleaveMine ? <button type="button" className="cl-btn small attack" onClick={() => void cleave()}>쪼개기 → 다른 대상</button> : null}
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