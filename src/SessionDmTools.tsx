import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { SceneEntity } from "./app/contracts";
import "./app/campaignDmLibraryOrganizationRuntimeAdapter";
import { mockAdapter } from "./app/mockAdapter";
import "./session-dm-tools.css";

function entitySummary(entity: SceneEntity) {
  const state = entity.status.length ? ` · ${entity.status.join(" · ")}` : "";
  return `HP ${entity.hp}/${entity.maxHp} · AC ${entity.ac}${state}`;
}

function connectionLabel(state: "connected" | "reconnecting" | "disconnected") {
  if (state === "connected") return "연결됨";
  if (state === "reconnecting") return "다시 연결하는 중";
  return "연결 끊김";
}

function PaneHeader({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose(): void }) {
  return <header className="session-dm-pane-head">
    <div><span>{eyebrow}</span><strong>{title}</strong></div>
    <button type="button" autoFocus aria-label={`${title} 닫기`} onClick={onClose}>×</button>
  </header>;
}

export function SessionDmActorPane({ onClose }: { onClose(): void }) {
  const { snapshot, selectDmActor } = useSimpleVtt();
  const [pendingActorId, setPendingActorId] = useState<string | null>(null);
  if (!snapshot) return null;

  const selected = snapshot.scene.entities.find((entity) => entity.id === snapshot.scene.selectedActorId)
    ?? snapshot.scene.entities[0]
    ?? null;

  const chooseActor = async (actorId: string) => {
    if (pendingActorId || actorId === selected?.id) return;
    setPendingActorId(actorId);
    try {
      await selectDmActor(actorId);
    } finally {
      setPendingActorId(null);
    }
  };

  return <aside className="session-dm-pane" aria-label="DM Actor 도구">
    <PaneHeader eyebrow="ACTOR" title="행동할 Actor" onClose={onClose} />
    {selected ? <section className="session-dm-current-actor">
      <div className="session-dm-actor-avatar">{selected.name.trim().slice(0, 2) || "DM"}</div>
      <div><strong>{selected.name}</strong><span>{selected.kind === "character" ? "Character" : "Combatant"}</span><small>{entitySummary(selected)}</small></div>
    </section> : <p className="session-dm-empty">Encounter에 Actor가 없습니다. Encounter 도구에서 Combatant를 추가할 수 있습니다.</p>}

    <section className="session-dm-section">
      <div className="session-dm-section-title"><strong>Actor 전환</strong><span>행동 주체만 바꿉니다. 턴 순서는 변경하지 않습니다.</span></div>
      <div className="session-dm-actor-list" role="list">
        {snapshot.scene.entities.map((entity) => {
          const active = entity.id === selected?.id;
          return <button type="button" role="listitem" key={entity.id} className={active ? "active" : ""} aria-pressed={active} disabled={Boolean(pendingActorId)} onClick={() => void chooseActor(entity.id)}>
            <div><strong>{entity.name}</strong><small>{entity.kind === "character" ? "Character" : "Combatant"}</small></div>
            <span>{entitySummary(entity)}</span>
            {pendingActorId === entity.id && <em>전환 중…</em>}
          </button>;
        })}
      </div>
    </section>
  </aside>;
}

export function SessionDmEncounterPane({ onClose }: { onClose(): void }) {
  const { snapshot, refresh, instantiateCombatant, instantiateCampaignDmLibraryNpc, removeCombatant, startInitiative, endInitiative } = useSimpleVtt();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  if (!snapshot) return null;

  const combatants = snapshot.scene.entities.filter((entity) => entity.kind === "combatant");
  const initiative = snapshot.sessionMode === "initiative";
  const removalBlocked = initiative || Boolean(snapshot.resolution);
  const campaignId=snapshot.campaignSessionSnapshot?.campaignId??snapshot.activeCampaignId??null;
  const campaign=snapshot.campaigns?.find((entry)=>entry.campaignId===campaignId);
  const libraryNpcs=(campaign?.dmLibrary.entries??[]).filter((entry)=>entry.kind==="npc-definition"&&entry.npcDefinition).sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||a.label.localeCompare(b.label,"ko-KR"));
  const libraryPresets=(campaign?.dmLibrary.entries??[]).filter((entry)=>entry.kind==="pc-preset"&&entry.pcPreset).sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite))||a.label.localeCompare(b.label,"ko-KR"));

  const addCombatant = async (definitionId: string) => {
    if (pendingKey) return;
    setPendingKey(`add:${definitionId}`);
    try {
      await instantiateCombatant(definitionId);
    } finally {
      setPendingKey(null);
    }
  };
  const addLibraryNpc=async(entryId:string)=>{if(pendingKey||!campaignId)return;setPendingKey(`library:${entryId}`);try{await instantiateCampaignDmLibraryNpc(campaignId,entryId);}finally{setPendingKey(null);}};
  const addLibraryPreset=async(entryId:string)=>{if(pendingKey||!campaignId)return;setPendingKey(`preset:${entryId}`);try{await mockAdapter.instantiateCampaignDmLibraryPcPreset(campaignId,entryId);await refresh();}finally{setPendingKey(null);}};

  const remove = async (combatantId: string) => {
    if (pendingKey || removalBlocked) return;
    setPendingKey(`remove:${combatantId}`);
    try {
      await removeCombatant(combatantId);
    } finally {
      setPendingKey(null);
    }
  };

  const changeInitiative = async () => {
    if (pendingKey || snapshot.resolution) return;
    setPendingKey("initiative");
    try {
      if (initiative) await endInitiative();
      else await startInitiative();
    } finally {
      setPendingKey(null);
    }
  };

  return <aside className="session-dm-pane" aria-label="DM Encounter 도구">
    <PaneHeader eyebrow="ENCOUNTER" title="Encounter" onClose={onClose} />
    <section className="session-dm-encounter-summary">
      <div><span>Combatant</span><strong>{combatants.length}</strong></div>
      <div><span>모드</span><strong>{initiative ? `이니셔티브 · ${snapshot.scene.round}R` : "자유 진행"}</strong></div>
      <button type="button" className={initiative ? "" : "primary"} disabled={Boolean(pendingKey || snapshot.resolution)} onClick={() => void changeInitiative()}>{initiative ? "이니셔티브 종료" : "이니셔티브 시작"}</button>
    </section>

    <section className="session-dm-section">
      <div className="session-dm-section-title"><strong>Combatant 추가</strong><span>현재 세션을 떠나지 않고 Encounter에 추가합니다.</span></div>
      {campaign&&<><div className="session-dm-section-title compact"><strong>캠페인 DM 라이브러리</strong><span>비공개 NPC 정의와 PC Actor preset</span></div>{libraryNpcs.length||libraryPresets.length?<div className="session-dm-definition-grid campaign-library">{libraryNpcs.map((entry)=><button type="button" key={entry.entryId} disabled={Boolean(pendingKey)} onClick={()=>void addLibraryNpc(entry.entryId)}><div><strong>{entry.favorite?"★ ":""}{entry.label}</strong><small>{entry.tags?.join(" · ")||"Campaign NPC"}</small></div><span>AC {entry.npcDefinition!.ac} · HP {entry.npcDefinition!.maxHp}</span>{pendingKey===`library:${entry.entryId}`&&<em>추가 중…</em>}</button>)}{libraryPresets.map((entry)=><button type="button" key={entry.entryId} disabled={Boolean(pendingKey)} onClick={()=>void addLibraryPreset(entry.entryId)}><div><strong>{entry.favorite?"★ ":""}{entry.label}</strong><small>{entry.tags?.join(" · ")||"Campaign PC preset"}</small></div><span>Lv.{entry.pcPreset!.level} · AC {entry.pcPreset!.ac} · HP {entry.pcPreset!.maxHp}</span>{pendingKey===`preset:${entry.entryId}`&&<em>추가 중…</em>}</button>)}</div>:<p className="session-dm-empty">캠페인에 저장된 NPC/PC Actor가 없습니다.</p>}</>}
      {snapshot.combatantDefinitions.length ? <div className="session-dm-definition-grid">
        {snapshot.combatantDefinitions.map((definition) => <button type="button" key={definition.id} disabled={Boolean(pendingKey)} onClick={() => void addCombatant(definition.id)}>
          <div><strong>{definition.name}</strong><small>{definition.source}</small></div>
          <span>AC {definition.ac} · HP {definition.maxHp}</span>
          {pendingKey === `add:${definition.id}` && <em>추가 중…</em>}
        </button>)}
      </div> : <p className="session-dm-empty">사용 가능한 Combatant가 없습니다. 세션 밖 Content에서 먼저 추가할 수 있습니다.</p>}
    </section>

    <section className="session-dm-section">
      <div className="session-dm-section-title"><strong>현재 Combatant</strong><span>{removalBlocked ? "이니셔티브 또는 진행 중 판정을 마치면 제거할 수 있습니다." : "Freeform에서는 안전하게 Encounter에서 제거할 수 있습니다."}</span></div>
      {combatants.length ? <div className="session-dm-combatant-list">
        {combatants.map((combatant) => <div key={combatant.id}>
          <div><strong>{combatant.name}</strong><small>{entitySummary(combatant)}</small></div>
          <button type="button" disabled={Boolean(pendingKey || removalBlocked)} onClick={() => void remove(combatant.id)}>{pendingKey === `remove:${combatant.id}` ? "제거 중…" : "제거"}</button>
        </div>)}
      </div> : <p className="session-dm-empty">현재 Combatant가 없습니다. 0 Combatant도 정상적인 활성 세션 상태입니다.</p>}
    </section>
  </aside>;
}

export function SessionParticipantsPane({ onClose }: { onClose(): void }) {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;
  const participants = snapshot.session.participants.filter((participant) => participant.id !== "host");

  return <aside className="session-dm-pane" aria-label="세션 참가자">
    <PaneHeader eyebrow="PARTICIPANTS" title="참가자" onClose={onClose} />
    <section className="session-dm-section">
      <div className="session-dm-section-title"><strong>Player {participants.length}명</strong><span>참가자는 열려 있는 세션에 바로 합류합니다.</span></div>
      {participants.length ? <div className="session-participant-list">
        {participants.map((participant) => <div key={participant.id}>
          <span className={`session-participant-state ${participant.state}`} aria-hidden="true" />
          <div><strong>{participant.name}</strong><small>{participant.characterName || "Character 확인 중"}</small></div>
          <span>{connectionLabel(participant.state)}</span>
        </div>)}
      </div> : <p className="session-dm-empty">아직 Player가 없습니다. DM은 이 상태에서도 Encounter를 준비하고 세션을 계속 진행할 수 있습니다.</p>}
    </section>
  </aside>;
}

export function SessionSharePane({ onClose, onOpenHandout }: { onClose(): void; onOpenHandout(): void }) {
  const { snapshot, stopSession } = useSimpleVtt();
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  if (!snapshot) return null;

  const copyAddress = async () => {
    if (!snapshot.session.address || !navigator.clipboard) return;
    await navigator.clipboard.writeText(snapshot.session.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const endSession = async () => {
    if (ending) return;
    setEnding(true);
    try {
      await stopSession();
    } finally {
      setEnding(false);
    }
  };

  const compatibilityProblem = snapshot.session.compatibility !== "compatible";

  return <aside className="session-dm-pane" aria-label="세션 공유 및 설정">
    <PaneHeader eyebrow="SESSION" title="세션 공유" onClose={onClose} />
    <section className="session-dm-share-card">
      <span>세션</span><strong>{snapshot.session.name || snapshot.scene.name}</strong>
      <span>접속 주소</span><div><code>{snapshot.session.address || "주소 확인 중"}</code><button type="button" disabled={!snapshot.session.address} onClick={() => void copyAddress()}>{copied ? "복사됨" : "복사"}</button></div>
      <span>연결</span><strong>{connectionLabel(snapshot.connectionState)}</strong>
    </section>
    {compatibilityProblem && <p className="session-dm-warning" role="status">{snapshot.session.compatibilityMessage}</p>}
    <section className="session-dm-section">
      <div className="session-dm-section-title"><strong>Handout</strong><span>승인된 Play chrome을 유지하면서 이미지 공유 도구는 Session pane에서 엽니다.</span></div>
      <button type="button" onClick={onOpenHandout}>이미지 보여주기</button>
    </section>
    <section className="session-dm-section">
      <div className="session-dm-section-title"><strong>활성 콘텐츠</strong><span>현재 세션에서 사용하는 추가 콘텐츠입니다.</span></div>
      {snapshot.session.sessionContent.length ? <ul className="session-dm-content-list">{snapshot.session.sessionContent.map((entry) => <li key={entry}>{entry}</li>)}</ul> : <p className="session-dm-empty">추가 활성 콘텐츠가 없습니다.</p>}
    </section>
    <section className="session-dm-section session-dm-end-session">
      <div className="session-dm-section-title"><strong>세션 종료</strong><span>좁은 화면에서도 이 Session 도구에서 세션 종료에 접근할 수 있습니다.</span></div>
      <button type="button" disabled={ending} onClick={() => void endSession()}>{ending ? "종료 중…" : "세션 종료"}</button>
    </section>
  </aside>;
}
