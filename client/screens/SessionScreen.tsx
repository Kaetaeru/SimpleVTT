/**
 * The session screen. Out of a session: open one (this tab hosts) or join with an invite code. In a session: the
 * party on the left (every sheet at a glance, DM quick actions), the selected sheet in the middle (own: playable;
 * a friend's: read-only; the DM: playable as DM), the shared log and chat on the right.
 */
import { useEffect, useMemo, useState } from "react";
import { useClient } from "../app/context";
import { useSession } from "../app/session";
import { newCampaign, type CampaignDocData, type DocumentBase } from "../campaign/types";
import { deriveLive } from "../character/ops";
import type { SessionCharacter } from "../session/protocol";
import { copyText, Notice, Pill } from "../ui/components";
import { SheetPlay } from "./SheetPlay";

export function SessionScreen() {
  const session = useSession();
  if (!session.role || session.status === "idle") return <Lobby />;
  return <Table />;
}

function Lobby() {
  const session = useSession();
  const { documents, putDocument, navigate } = useClient();
  const campaigns = documents.filter((doc): doc is DocumentBase<"campaign", CampaignDocData> => doc.kind === "campaign");
  const [campaignId, setCampaignId] = useState<string>(campaigns[0]?.id ?? "");
  const [newTitle, setNewTitle] = useState("");
  const chosen = campaigns.find((doc) => doc.id === campaignId) ?? campaigns[0];
  const createAndOpen = async () => { const doc = newCampaign(newTitle.trim() || "새 캠페인"); await putDocument(doc); setCampaignId(doc.id); setNewTitle(""); };
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [display, setDisplay] = useState(session.displayName);
  const commitName = () => { if (display.trim() && display.trim() !== session.displayName) session.setDisplayName(display.trim()); };
  const join = async () => { commitName(); setBusy(true); setError(await session.joinSession(code)); setBusy(false); };
  return (
    <div className="cl-page">
      <div className="cl-page-head"><h1>세션</h1><span className="cl-sub">exe에서는 같은 네트워크(LAN)와 하마치로, 브라우저에서는 같은 PC의 다른 탭으로 연결합니다.</span></div>
      <div className="cl-card" style={{ maxWidth: 520 }}>
        <div className="cl-field"><label htmlFor="cl-display-name">내 이름 (참가자 표시)</label><input id="cl-display-name" className="cl-input" value={display} placeholder="예: 민수" onChange={(event) => setDisplay(event.target.value)} onBlur={commitName} /></div>
      </div>
      <div className="cl-grid-2">
        <div className="cl-card">
          <h3>세션 열기 (DM)</h3>
          <p className="cl-muted cl-small">세션은 캠페인에 속합니다. 참가자·파티·세션 기록이 그 캠페인에 남고, 다음 세션에서 그대로 이어집니다.</p>
          {campaigns.length ? (
            <div className="cl-field"><label htmlFor="cl-campaign-pick">캠페인</label>
              <select id="cl-campaign-pick" className="cl-select" value={chosen?.id ?? ""} onChange={(event) => setCampaignId(event.target.value)}>
                {campaigns.map((doc) => <option key={doc.id} value={doc.id}>{doc.data.title} · 파티 {doc.data.party.length} · 세션 {doc.data.sessions.length}</option>)}
              </select>
            </div>
          ) : <p className="cl-quiet cl-small">아직 캠페인이 없습니다. 아래에서 하나 만드세요.</p>}
          {chosen ? <p className="cl-muted cl-small">{chosen.data.players.length ? `지난 참가자: ${chosen.data.players.map((player) => player.name).join(", ")}` : "아직 참가자가 없습니다."}{chosen.data.party.length ? ` · 파티: ${chosen.data.party.map((member) => member.source.name).join(", ")}` : ""}</p> : null}
          <div className="cl-row" style={{ gap: 6 }}>
            <button type="button" className="cl-btn primary" disabled={!chosen} onClick={() => { commitName(); if (chosen) void session.openSession(chosen.id); }}>세션 열기</button>
            {chosen ? <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "campaign", id: chosen.id })}>캠페인 보기</button> : null}
          </div>
          <div className="cl-row" style={{ gap: 6, marginTop: 8 }}>
            <input className="cl-input" style={{ flex: 1 }} placeholder="새 캠페인 이름" aria-label="새 캠페인 이름" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createAndOpen(); }} />
            <button type="button" className="cl-btn" onClick={() => void createAndOpen()}>새 캠페인</button>
          </div>
        </div>
        <div className="cl-card">
          <h3>세션 참가 (플레이어)</h3>
          <p className="cl-muted cl-small">DM에게 받은 초대 코드를 붙여넣으세요. 들어간 뒤 라이브러리의 캐릭터를 데려옵니다.</p>
          <div className="cl-field"><label htmlFor="cl-invite">초대 코드</label><input id="cl-invite" className="cl-input" placeholder="tab:sess_x1-K7QX3M" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void join(); }} /></div>
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <button type="button" className="cl-btn primary" disabled={!code.trim() || busy} onClick={() => void join()}>{busy ? "연결 중…" : "참가"}</button>
        </div>
      </div>
    </div>
  );
}

function Table() {
  const session = useSession();
  const { catalog, characters } = useClient();
  const snapshot = session.snapshot;
  const [selected, setSelected] = useState<string | null>(null);
  const [chat, setChat] = useState("");
  const [copied, setCopied] = useState(false);
  const [dmAmount, setDmAmount] = useState("");
  const isHost = session.role === "host";
  const mine = useMemo(() => (snapshot?.characters ?? []).filter((item) => item.ownerUserId === session.userId), [snapshot, session.userId]);
  const current = (snapshot?.characters ?? []).find((item) => item.characterId === selected) ?? mine[0] ?? null;
  useEffect(() => { if (!selected && mine[0]) setSelected(mine[0].characterId); }, [mine, selected]);
  const derived = useMemo(() => (current ? deriveLive(current.source, catalog, current.runtime) : null), [current, catalog]);
  const availableToBring = characters.filter((record) => !(snapshot?.characters ?? []).some((item) => item.characterId === record.id));
  const canEdit = Boolean(current && (current.ownerUserId === session.userId || isHost));

  if (session.status === "refused") return <div className="cl-page"><Notice tone="bad">입장이 거절됐습니다: {session.reason}</Notice><button type="button" className="cl-btn" onClick={session.leaveSession}>돌아가기</button></div>;
  if (session.status === "connecting" || !snapshot) return <div className="cl-page"><p className="cl-quiet">호스트에 연결하는 중… 초대 코드의 세션이 열려 있는지 확인하세요.</p><button type="button" className="cl-btn" onClick={session.leaveSession}>취소</button></div>;

  return (
    <div className="cl-page cl-session">
      <div className="cl-page-head">
        <h1>{snapshot.name}</h1>
        <Pill tone={session.status === "joined" ? "good" : "bad"}>{session.status === "joined" ? (isHost ? "호스트" : "연결됨") : session.status === "disconnected" ? "연결 끊김" : "닫힘"}</Pill>
        <Pill>라운드 {snapshot.round}</Pill>
        {isHost ? <button type="button" className="cl-btn small" onClick={session.advanceRound} title="모든 시트의 라운드 효과를 한 칸 진행">다음 라운드</button> : null}
        <span className="cl-row cl-small" style={{ gap: 4 }}>
          <span className="cl-quiet">초대 코드</span>
          <code className="cl-code">{session.invite}</code>
          <button type="button" className="cl-btn small" onClick={async () => { setCopied(await copyText(session.invite ?? "")); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? "복사됨" : "복사"}</button>
          {session.invites.length > 1 ? <details className="cl-invites"><summary className="cl-quiet">다른 주소 {session.invites.length - 1}</summary>{session.invites.filter((item) => item !== session.invite).map((item) => <div key={item} className="cl-row" style={{ gap: 4 }}><code className="cl-code">{item}</code><button type="button" className="cl-btn small" onClick={() => void copyText(item)}>복사</button></div>)}</details> : null}
        </span>
        <div className="cl-actions"><button type="button" className="cl-btn danger" onClick={session.leaveSession}>{isHost ? "세션 닫기" : "나가기"}</button></div>
      </div>
      {isHost && session.transportNote ? <Notice tone="warn">{session.transportNote}</Notice> : null}
      {session.refusals.length ? <div className="cl-toasts">{session.refusals.map((reason, index) => <Notice tone="bad" key={`${reason}-${index}`}>{reason}</Notice>)}</div> : null}

      <div className="cl-session-grid">
        <aside className="cl-session-side">
          <div className="cl-card">
            <h3 className="cl-muted" style={{ display: "flex", gap: 8, alignItems: "center" }}>파티 <Pill>{snapshot.characters.length}</Pill></h3>
            {availableToBring.length ? (
              <div className="cl-row" style={{ gap: 4 }}>
                <select className="cl-select" aria-label="데려올 캐릭터" defaultValue="" onChange={(event) => { const record = characters.find((item) => item.id === event.target.value); if (record) { session.bringCharacter(record); setSelected(record.id); } event.target.value = ""; }}>
                  <option value="" disabled>캐릭터 데려오기…</option>
                  {availableToBring.map((record) => <option key={record.id} value={record.id}>{record.source.name || "(이름 없음)"}</option>)}
                </select>
              </div>
            ) : null}
            {snapshot.characters.length === 0 ? <p className="cl-quiet cl-small">아직 아무도 캐릭터를 데려오지 않았습니다.</p> : null}
            <div className="cl-list" style={{ gap: 6 }}>
              {snapshot.characters.map((item) => <PartyCard key={item.characterId} item={item} selected={item.characterId === current?.characterId} owner={snapshot.participants.find((participant) => participant.userId === item.ownerUserId)?.name ?? "?"} mine={item.ownerUserId === session.userId} onSelect={() => setSelected(item.characterId)} onLeave={item.ownerUserId === session.userId || isHost ? () => session.removeCharacter(item.characterId) : undefined} />)}
            </div>
            {isHost && current ? (
              <div className="cl-dm-quick">
                <span className="cl-quiet cl-small">DM 빠른 조작 — {current.source.name}</span>
                <div className="cl-row" style={{ gap: 4 }}>
                  <input className="cl-input" style={{ width: 70 }} placeholder="수치" aria-label="DM 수치" value={dmAmount} onChange={(event) => setDmAmount(event.target.value)} />
                  <button type="button" className="cl-btn small danger" disabled={!Number(dmAmount)} onClick={() => { void session.dispatchOp(current.characterId, { type: "hp.damage", amount: Math.abs(Number(dmAmount)) }); setDmAmount(""); }}>피해</button>
                  <button type="button" className="cl-btn small" disabled={!Number(dmAmount)} onClick={() => { void session.dispatchOp(current.characterId, { type: "hp.heal", amount: Math.abs(Number(dmAmount)) }); setDmAmount(""); }}>회복</button>
                  <button type="button" className="cl-btn small" disabled={!Number(dmAmount)} onClick={() => { void session.dispatchOp(current.characterId, { type: "hp.temp", amount: Math.abs(Number(dmAmount)) }); setDmAmount(""); }}>임시 HP</button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="cl-card">
            <h3 className="cl-muted">참가자</h3>
            <div className="cl-list" style={{ gap: 2 }}>
              {snapshot.participants.map((participant) => <div className="cl-row cl-small" key={participant.userId} style={{ gap: 6 }}><span className={`cl-dot${participant.connected ? " on" : ""}`} /> {participant.name}{participant.role === "host" ? <Pill>DM</Pill> : null}{participant.userId === session.userId ? <span className="cl-quiet">(나)</span> : null}</div>)}
            </div>
          </div>
        </aside>

        <section className="cl-session-main">
          {current && derived ? (
            <SheetPlay key={current.characterId} source={current.source} runtime={current.runtime} derived={derived} catalog={catalog} readOnly={!canEdit} actorLabel={isHost && current.ownerUserId !== session.userId ? "DM" : undefined}
              dispatch={(op) => session.dispatchOp(current.characterId, op)}
              lead={<div className="cl-row cl-small" style={{ gap: 6 }}><span className="cl-quiet">{canEdit ? (current.ownerUserId === session.userId ? "내 시트 — 조작이 모두에게 공유됩니다" : "DM으로 조작 중 — 플레이어 기록에 DM 표시가 남습니다") : "파티원의 시트 (보기만)"}</span></div>} />
          ) : <div className="cl-card"><p className="cl-quiet">왼쪽에서 캐릭터를 데려오거나 골라 보세요.</p></div>}
        </section>

        <aside className="cl-session-side">
          <div className="cl-card cl-session-logcard">
            <h3 className="cl-muted">공용 기록</h3>
            <div className="cl-log cl-session-log" aria-live="polite">
              {snapshot.log.length === 0 ? <span className="cl-quiet">아직 기록이 없습니다.</span> : [...snapshot.log].reverse().map((entry) => <div key={entry.n} className={`kind-${entry.kind}`}><span className="cl-at">{new Date(entry.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>{entry.text}</div>)}
            </div>
            <div className="cl-row" style={{ gap: 4 }}>
              <input className="cl-input" style={{ flex: 1 }} placeholder="말하기…" aria-label="채팅" value={chat} onChange={(event) => setChat(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { session.say(chat); setChat(""); } }} />
              <button type="button" className="cl-btn small" disabled={!chat.trim()} onClick={() => { session.say(chat); setChat(""); }}>보내기</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function PartyCard({ item, selected, owner, mine, onSelect, onLeave }: { item: SessionCharacter; selected: boolean; owner: string; mine: boolean; onSelect: () => void; onLeave?: () => void }) {
  const max = item.runtime.hp.maxSeen || 1;
  const ratio = Math.max(0, Math.min(1, item.runtime.hp.current / max));
  return (
    <div className={`cl-party-card${selected ? " selected" : ""}`} onClick={onSelect} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") onSelect(); }} aria-label={`${item.source.name} 시트 보기`}>
      <div className="cl-row" style={{ gap: 6 }}>
        <span className="cl-name">{item.source.name || "(이름 없음)"}</span>
        {mine ? <Pill tone="accent">나</Pill> : <span className="cl-quiet cl-small">{owner}</span>}
        {onLeave ? <button type="button" className="cl-btn quiet small" style={{ marginLeft: "auto" }} title="세션에서 내보내기" onClick={(event) => { event.stopPropagation(); onLeave(); }}>✕</button> : null}
      </div>
      <div className="cl-row cl-small" style={{ gap: 6 }}>
        <span>{item.runtime.hp.current}/{item.runtime.hp.maxSeen}{item.runtime.hp.temp ? ` (+${item.runtime.hp.temp})` : ""}</span>
        <div className={`cl-hpbar${ratio <= 0.25 ? " bad" : ratio <= 0.5 ? " warn" : ""}`} style={{ flex: 1 }}><span style={{ width: `${Math.round(ratio * 100)}%` }} /></div>
      </div>
      {item.runtime.conditions.length || item.runtime.effects?.length ? <div className="cl-row" style={{ gap: 3, flexWrap: "wrap" }}>{item.runtime.conditions.map((condition) => <Pill key={condition} tone="bad">{condition}</Pill>)}{(item.runtime.effects ?? []).map((effect) => <Pill key={effect.key} tone="accent">{effect.name}</Pill>)}</div> : null}
    </div>
  );
}
