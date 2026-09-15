/**
 * Campaign home as Roll20 has it (ROLL20_MODEL.md §1–§2): the list of campaigns I run and campaigns I joined,
 * "새 캠페인", joining by code, and the campaign details page (게임 시작, 참가 코드, 참가자, 설정, 삭제).
 */
import { useState } from "react";
import { useCampaigns } from "../app/campaigns";
import { useClient } from "../app/context";
import type { Campaign } from "../campaign/model";
import { copyText, Notice, Pill } from "../ui/components";

export function CampaignsScreen() {
  const { navigate } = useClient();
  const c = useCampaigns();
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [display, setDisplay] = useState(c.displayName);
  const commitName = () => { if (display.trim() && display.trim() !== c.displayName) c.setDisplayName(display.trim()); };
  const create = async () => { commitName(); const campaign = await c.createCampaign(title); setTitle(""); navigate({ screen: "campaign", id: campaign.id }); };
  const join = async () => { commitName(); setBusy(true); const result = await c.join(code); setBusy(false); setError(result); if (!result) navigate({ screen: "table" }); };
  const mine = c.campaigns;
  return (
    <div className="cl-page">
      <div className="cl-page-head"><h1>캠페인</h1><span className="cl-sub">캠페인 하나가 테이블입니다. DM이 "게임 시작"을 누르면 열리고, 플레이어는 캠페인의 참가 코드로 언제든 들어옵니다.</span></div>
      <div className="cl-grid-2">
        <div className="cl-card">
          <div className="cl-field"><label htmlFor="cl-display-name">내 이름 (테이블에서 보이는 이름)</label><input id="cl-display-name" className="cl-input" value={display} placeholder="예: 민수" onChange={(event) => setDisplay(event.target.value)} onBlur={commitName} /></div>
        </div>
        <div className="cl-card">
          <h3>참가 코드로 입장</h3>
          <div className="cl-row" style={{ gap: 6 }}>
            <input className="cl-input" style={{ flex: 1 }} placeholder="tab:camp_x1-K7QX3M 또는 25.1.2.3:41230-K7QX3M" aria-label="참가 코드" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void join(); }} />
            <button type="button" className="cl-btn primary" disabled={!code.trim() || busy} onClick={() => void join()}>{busy ? "연결 중…" : "입장"}</button>
          </div>
          {error ? <Notice tone="bad">{error}</Notice> : null}
        </div>
      </div>

      <section className="cl-section">
        <h2>내가 여는 캠페인 <Pill>{mine.length}</Pill></h2>
        <div className="cl-row" style={{ gap: 6, marginBottom: 8 }}>
          <input className="cl-input" style={{ flex: 1, maxWidth: 420 }} placeholder="새 캠페인 이름 (예: 잃어버린 광산)" aria-label="새 캠페인 이름" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void create(); }} />
          <button type="button" className="cl-btn primary" onClick={() => void create()}>새 캠페인</button>
        </div>
        {mine.length === 0 ? <p className="cl-quiet">아직 캠페인이 없습니다.</p> : (
          <div className="cl-cards">
            {mine.map((campaign) => (
              <div className="cl-card clickable" key={campaign.id} onClick={() => navigate({ screen: "campaign", id: campaign.id })} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") navigate({ screen: "campaign", id: campaign.id }); }}>
                <div className="cl-row" style={{ gap: 8 }}><strong>{campaign.name}</strong>{c.table.role === "host" && c.table.campaignId === campaign.id ? <Pill tone="good">진행 중</Pill> : null}<span className="cl-quiet cl-small" style={{ marginLeft: "auto" }}>{campaign.lastLaunchedAt ? `마지막 플레이 ${new Date(campaign.lastLaunchedAt).toLocaleDateString("ko-KR")}` : "아직 시작 전"}</span></div>
                <div className="cl-row cl-small" style={{ gap: 6 }}><Pill>참가자 {campaign.players.filter((player) => !player.kicked).length}</Pill><span className="cl-quiet">코드 <code className="cl-code">{campaign.joinCode}</code></span></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="cl-section">
        <h2>참가한 캠페인 <Pill>{c.joined.length}</Pill></h2>
        {c.joined.length === 0 ? <p className="cl-quiet cl-small">참가 코드로 들어간 캠페인이 여기에 남습니다. 호스트가 켜져 있으면 클릭 한 번으로 다시 들어갑니다.</p> : (
          <div className="cl-cards">
            {c.joined.map((entry) => (
              <div className="cl-card" key={entry.campaignId}>
                <div className="cl-row" style={{ gap: 8 }}><strong>{entry.name}</strong><span className="cl-quiet cl-small">DM {entry.hostName}</span><span className="cl-quiet cl-small" style={{ marginLeft: "auto" }}>{new Date(entry.lastSeenAt).toLocaleDateString("ko-KR")}</span></div>
                <div className="cl-row" style={{ gap: 6 }}>
                  <button type="button" className="cl-btn small primary" onClick={async () => { commitName(); const result = await c.join(entry.invite); setError(result); if (!result) navigate({ screen: "table" }); }}>다시 입장</button>
                  <button type="button" className="cl-btn small quiet" onClick={() => void c.forgetJoined(entry.campaignId)}>목록에서 지우기</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function CampaignDetailScreen({ id }: { id: string }) {
  const { navigate } = useClient();
  const c = useCampaigns();
  const campaign = c.campaigns.find((item) => item.id === id);
  const [copied, setCopied] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  if (!campaign) return <div className="cl-page"><Notice tone="bad">캠페인을 찾을 수 없습니다.</Notice><button type="button" className="cl-btn" onClick={() => navigate({ screen: "campaigns" })}>캠페인 목록</button></div>;
  const running = c.table.role === "host" && c.table.campaignId === campaign.id;
  const invite = running ? c.table.invite ?? "" : `tab:${campaign.id}-${campaign.joinCode}`;
  const update = (patch: Partial<Campaign>) => void c.updateCampaign({ ...campaign, ...patch });
  const players = campaign.players;
  return (
    <div className="cl-page">
      <div className="cl-page-head">
        {title === null ? <h1 onDoubleClick={() => setTitle(campaign.name)} title="두 번 클릭하면 이름을 바꿉니다">{campaign.name}</h1>
          : <input className="cl-input" aria-label="캠페인 이름" value={title} autoFocus onChange={(event) => setTitle(event.target.value)} onBlur={() => { if (title.trim()) update({ name: title.trim() }); setTitle(null); }} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }} />}
        <span className="cl-sub">{campaign.ruleset}{campaign.lastLaunchedAt ? ` · 마지막 플레이 ${new Date(campaign.lastLaunchedAt).toLocaleString("ko-KR")}` : ""}</span>
        <div className="cl-actions">
          {running ? <button type="button" className="cl-btn primary" onClick={() => navigate({ screen: "table" })}>테이블로</button> : <button type="button" className="cl-btn primary" onClick={() => { void c.launch(campaign.id); navigate({ screen: "table" }); }}>게임 시작</button>}
          <button type="button" className="cl-btn quiet" onClick={() => navigate({ screen: "campaigns" })}>캠페인 목록</button>
        </div>
      </div>
      <div className="cl-grid-2">
        <div className="cl-card">
          <h3 className="cl-muted">플레이어 초대</h3>
          <p className="cl-muted cl-small">참가 코드는 이 캠페인에 하나뿐이고 바뀌지 않습니다. 코드를 아는 사람이 "게임 시작" 중인 호스트에 들어옵니다.</p>
          <div className="cl-row" style={{ gap: 6 }}>
            <code className="cl-code">{invite}</code>
            <button type="button" className="cl-btn small" onClick={async () => { setCopied(await copyText(invite)); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? "복사됨" : "복사"}</button>
            <button type="button" className="cl-btn small quiet" onClick={() => { if (confirm("참가 코드를 새로 만들까요? 기존 코드로는 더 못 들어옵니다.")) void c.regenerateJoinCode(campaign.id); }}>코드 다시 만들기</button>
          </div>
          {running && c.table.invites.length > 1 ? <div className="cl-list" style={{ gap: 2, marginTop: 6 }}>{c.table.invites.filter((item) => item !== c.table.invite).map((item) => <div key={item} className="cl-row cl-small" style={{ gap: 4 }}><code className="cl-code">{item}</code><button type="button" className="cl-btn small" onClick={() => void copyText(item)}>복사</button></div>)}</div> : null}
          {!running ? <p className="cl-quiet cl-small">exe에서 게임을 시작하면 LAN·하마치 주소가 붙은 코드(`IP:41230-코드`)가 여기에 나타납니다.</p> : null}
        </div>
        <div className="cl-card">
          <h3 className="cl-muted">참가자 <Pill>{players.filter((player) => !player.kicked).length}</Pill></h3>
          <div className="cl-list" style={{ gap: 4 }}>
            {players.map((player) => (
              <div className="cl-row cl-small" key={player.userId} style={{ gap: 6 }}>
                <span className="cl-swatch" style={{ background: player.color }} />
                <span style={{ textDecoration: player.kicked ? "line-through" : undefined }}>{player.displayName}</span>
                <Pill tone={player.role === "gm" ? "accent" : undefined}>{player.role === "gm" ? "GM" : "플레이어"}</Pill>
                {player.userId === c.userId ? <span className="cl-quiet">(나)</span> : null}
                <span className="cl-quiet" style={{ marginLeft: "auto" }}>{player.lastSeenAt ? new Date(player.lastSeenAt).toLocaleDateString("ko-KR") : ""}</span>
                {player.userId !== c.userId ? (
                  <span className="cl-inline-btns" style={{ gap: 4 }}>
                    <button type="button" className="cl-btn small" style={{ width: "auto", padding: "0 6px" }} onClick={() => update({ players: players.map((item) => (item.userId === player.userId ? { ...item, role: item.role === "gm" ? "player" : "gm" } : item)) })}>{player.role === "gm" ? "플레이어로" : "GM으로"}</button>
                    <button type="button" className={`cl-btn small ${player.kicked ? "" : "danger"}`} style={{ width: "auto", padding: "0 6px" }} onClick={() => update({ players: players.map((item) => (item.userId === player.userId ? { ...item, kicked: !item.kicked } : item)) })}>{player.kicked ? "다시 허용" : "내보내기"}</button>
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="cl-grid-2">
        <div className="cl-card">
          <h3 className="cl-muted">설정</h3>
          <label className="cl-row cl-small" style={{ gap: 6 }}><input type="checkbox" checked={campaign.settings.playersCanCreateCharacters} onChange={(event) => update({ settings: { ...campaign.settings, playersCanCreateCharacters: event.target.checked } })} /> 플레이어가 테이블에서 새 캐릭터를 만들 수 있음</label>
          <label className="cl-row cl-small" style={{ gap: 6 }}><input type="checkbox" checked={campaign.settings.playersCanExportToVault} onChange={(event) => update({ settings: { ...campaign.settings, playersCanExportToVault: event.target.checked } })} /> 플레이어가 캐릭터를 자기 라이브러리로 내보낼 수 있음</label>
          <label className="cl-row cl-small" style={{ gap: 6 }}><input type="checkbox" checked={Boolean(campaign.settings.dmConfirmsResults)} onChange={(event) => update({ settings: { ...campaign.settings, dmConfirmsResults: event.target.checked } })} /> 플레이어의 판정 결과를 DM이 확인한 뒤 적용 (기본: 바로 적용, DM은 사후 수정)</label>
          <div className="cl-row cl-small" style={{ gap: 8, flexWrap: "wrap" }}><label htmlFor="cl-toast-seconds">알림 표시 시간(초)</label><input id="cl-toast-seconds" className="cl-input" style={{ width: 64 }} type="number" min={1} max={30} value={campaign.settings.toastSeconds ?? 4} onChange={(event) => update({ settings: { ...campaign.settings, toastSeconds: Math.max(1, Number(event.target.value) || 4) } })} /><label htmlFor="cl-toast-count">동시 알림 개수</label><input id="cl-toast-count" className="cl-input" style={{ width: 64 }} type="number" min={1} max={8} value={campaign.settings.toastCount ?? 3} onChange={(event) => update({ settings: { ...campaign.settings, toastCount: Math.max(1, Number(event.target.value) || 3) } })} /></div>
          <label className="cl-row cl-small" style={{ gap: 6 }}><input type="checkbox" checked={campaign.settings.chatAvatars} onChange={(event) => update({ settings: { ...campaign.settings, chatAvatars: event.target.checked } })} /> 채팅에 아바타 표시</label>
          <div className="cl-field" style={{ marginTop: 8 }}><label htmlFor="cl-campaign-desc">소개</label><textarea id="cl-campaign-desc" className="cl-input" rows={4} value={campaign.description} onChange={(event) => update({ description: event.target.value })} placeholder="캠페인 소개, 하우스룰, 일정…" /></div>
        </div>
        <div className="cl-card">
          <h3 className="cl-muted">채팅 보관함</h3>
          <p className="cl-muted cl-small">{c.archives[campaign.id]?.messages.length ?? 0}개의 메시지가 저장돼 있습니다. 테이블의 채팅 탭에서 지난 기록을 그대로 봅니다.</p>
          <h3 className="cl-muted" style={{ marginTop: 12 }}>저널</h3>
          <p className="cl-muted cl-small">저널 항목 {(c.journals[campaign.id] ?? []).length}개 (핸드아웃 {(c.journals[campaign.id] ?? []).filter((entry) => entry.kind === "handout").length} · 캐릭터 {(c.journals[campaign.id] ?? []).filter((entry) => entry.kind === "character").length}). 테이블의 저널 탭에서 다룹니다.</p>
          <h3 className="cl-muted" style={{ marginTop: 12 }}>위험</h3>
          <button type="button" className="cl-btn danger" onClick={() => { if (confirm(`"${campaign.name}" 캠페인을 삭제할까요? 채팅 보관함도 지워집니다.`)) { if (running) c.leave(); void c.deleteCampaign(campaign.id); navigate({ screen: "campaigns" }); } }}>캠페인 삭제</button>
        </div>
      </div>
    </div>
  );
}
