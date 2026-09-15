/**
 * Campaigns (CAMPAIGN_RESOURCES.md §1, §8): the DM's list of campaigns and one campaign's detail — party as last
 * seen, known players, session records with their shared logs, and the button that opens the next session.
 */
import { useState } from "react";
import { useClient } from "../app/context";
import { useSession } from "../app/session";
import { newCampaign, type CampaignDocData, type DocumentBase } from "../campaign/types";
import { Notice, Pill } from "../ui/components";

type CampaignDoc = DocumentBase<"campaign", CampaignDocData>;

export function CampaignsScreen() {
  const { documents, putDocument, deleteDocument, navigate } = useClient();
  const campaigns = documents.filter((doc): doc is CampaignDoc => doc.kind === "campaign").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [title, setTitle] = useState("");
  const create = async () => { const doc = newCampaign(title.trim() || "새 캠페인"); await putDocument(doc); setTitle(""); navigate({ screen: "campaign", id: doc.id }); };
  return (
    <div className="cl-page">
      <div className="cl-page-head"><h1>캠페인</h1><span className="cl-sub">세션은 캠페인 안에서 열립니다. 참가자·파티·세션 기록이 여기에 쌓입니다.</span></div>
      <div className="cl-card" style={{ maxWidth: 560 }}>
        <div className="cl-row" style={{ gap: 6 }}>
          <input className="cl-input" style={{ flex: 1 }} placeholder="캠페인 이름 (예: 잃어버린 광산)" aria-label="캠페인 이름" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void create(); }} />
          <button type="button" className="cl-btn primary" onClick={() => void create()}>캠페인 만들기</button>
        </div>
      </div>
      {campaigns.length === 0 ? <p className="cl-quiet">아직 캠페인이 없습니다.</p> : (
        <div className="cl-cards">
          {campaigns.map((doc) => (
            <div className="cl-card clickable" key={doc.id} onClick={() => navigate({ screen: "campaign", id: doc.id })}>
              <div className="cl-row" style={{ gap: 8 }}><strong>{doc.data.title}</strong><span className="cl-quiet cl-small" style={{ marginLeft: "auto" }}>{new Date(doc.updatedAt).toLocaleDateString("ko-KR")}</span></div>
              <div className="cl-row cl-small" style={{ gap: 6 }}><Pill>파티 {doc.data.party.length}</Pill><Pill>참가자 {doc.data.players.length}</Pill><Pill>세션 {doc.data.sessions.length}</Pill></div>
              <div className="cl-row" style={{ gap: 6 }}>
                <button type="button" className="cl-btn small quiet" onClick={(event) => { event.stopPropagation(); if (confirm(`"${doc.data.title}" 캠페인을 삭제할까요? 세션 기록도 지워집니다.`)) void deleteDocument(doc.id); }}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CampaignScreen({ id }: { id: string }) {
  const { documents, putDocument, navigate } = useClient();
  const session = useSession();
  const doc = documents.find((item): item is CampaignDoc => item.kind === "campaign" && item.id === id);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  if (!doc) return <div className="cl-page"><Notice tone="bad">캠페인을 찾을 수 없습니다.</Notice><button type="button" className="cl-btn" onClick={() => navigate({ screen: "campaigns" })}>캠페인 목록</button></div>;
  const running = session.role === "host" && session.campaignId === doc.id;
  const sessions = [...doc.data.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <div className="cl-page">
      <div className="cl-page-head">
        {title === null ? <h1 onDoubleClick={() => setTitle(doc.data.title)} title="두 번 클릭하면 이름을 바꿉니다">{doc.data.title}</h1>
          : <input className="cl-input" aria-label="캠페인 이름" value={title} autoFocus onChange={(event) => setTitle(event.target.value)} onBlur={() => { if (title.trim()) void putDocument({ ...doc, name: title.trim(), data: { ...doc.data, title: title.trim() } }); setTitle(null); }} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }} />}
        <span className="cl-sub">규칙 {doc.data.ruleset}</span>
        <div className="cl-actions">
          {running ? <button type="button" className="cl-btn primary" onClick={() => navigate({ screen: "session" })}>진행 중인 세션으로</button> : <button type="button" className="cl-btn primary" onClick={() => { void session.openSession(doc.id); navigate({ screen: "session" }); }}>세션 열기</button>}
          <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "campaigns" })}>캠페인 목록</button>
        </div>
      </div>
      <div className="cl-grid-2">
        <div className="cl-card">
          <h3 className="cl-muted">파티 <Pill>{doc.data.party.length}</Pill></h3>
          {doc.data.party.length === 0 ? <p className="cl-quiet cl-small">플레이어가 세션에 캐릭터를 데려오면 여기에 남습니다.</p> : (
            <div className="cl-list" style={{ gap: 6 }}>
              {doc.data.party.map((member) => {
                const owner = doc.data.players.find((player) => player.userId === member.ownerUserId);
                return (
                  <div className="cl-party-card" key={member.characterId}>
                    <div className="cl-row" style={{ gap: 6 }}><span className="cl-name">{member.source.name}</span><span className="cl-quiet cl-small">{owner?.name ?? "DM"}</span><span className="cl-quiet cl-small" style={{ marginLeft: "auto" }}>{new Date(member.savedAt).toLocaleString("ko-KR")}</span></div>
                    <div className="cl-row cl-small" style={{ gap: 6 }}><span>HP {member.runtime.hp.current}/{member.runtime.hp.maxSeen}</span>{member.runtime.conditions.map((condition) => <Pill key={condition} tone="bad">{condition}</Pill>)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="cl-card">
          <h3 className="cl-muted">참가자 <Pill>{doc.data.players.length}</Pill></h3>
          {doc.data.players.length === 0 ? <p className="cl-quiet cl-small">세션에 들어온 사람이 기억됩니다. 같은 PC(브라우저는 같은 탭)에서 다시 오면 같은 참가자로 이어집니다.</p> : (
            <div className="cl-list" style={{ gap: 2 }}>{doc.data.players.map((player) => <div className="cl-row cl-small" key={player.userId} style={{ gap: 6 }}><span>{player.name}</span><span className="cl-quiet">{player.lastSeenAt ? `마지막 ${new Date(player.lastSeenAt).toLocaleString("ko-KR")}` : ""}</span></div>)}</div>
          )}
        </div>
      </div>
      <div className="cl-card">
        <h3 className="cl-muted">세션 기록 <Pill>{sessions.length}</Pill></h3>
        {sessions.length === 0 ? <p className="cl-quiet cl-small">아직 세션이 없습니다.</p> : (
          <div className="cl-list" style={{ gap: 6 }}>
            {sessions.map((record, index) => (
              <div className="cl-feature" key={record.id}>
                <div className="cl-head" style={{ cursor: "pointer" }} onClick={() => setOpenLog(openLog === record.id ? null : record.id)}>
                  <span className="cl-name">세션 {sessions.length - index}</span>
                  <span className="cl-quiet cl-small">{new Date(record.startedAt).toLocaleString("ko-KR")}{record.endedAt ? ` → ${new Date(record.endedAt).toLocaleTimeString("ko-KR")}` : " · 진행 중"}</span>
                  <Pill>라운드 {record.round}</Pill><Pill>기록 {record.log.length}</Pill>
                </div>
                {openLog === record.id ? <div className="cl-log cl-session-log">{[...record.log].reverse().map((entry) => <div key={entry.n} className={`kind-${entry.kind}`}><span className="cl-at">{new Date(entry.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>{entry.text}</div>)}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
