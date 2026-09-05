import { useState } from "react";
import { useSimpleVtt } from "./app/AppProvider";
import type { SceneEntity } from "./app/contracts";
import "./app/campaignDmLibraryOrganizationRuntimeAdapter";
import { mockAdapter } from "./app/mockAdapter";
import { SRD_MONSTER_COUNT, searchSrdMonsters } from "./app/srdMonsterCatalog";
import { monsterTimingBadges } from "./app/monsterTimingPresentation";
import "./app/srdMonsterTimingRuntimeAdapter";
import { multiattackRoutineLabel, multiattackRoutineOf } from "./app/srdMonsterMultiattackRuntimeAdapter";
import "./app/engagementRuntimeAdapter";
import "./app/encounterGroupRuntimeAdapter";
import "./app/sceneConditionRuntimeAdapter";
import { CREATURE_BADGE_LABELS, NARRATIVE_CONDITION_LABELS, SCENE_CONDITION_LABELS, type CreatureBadgeKind, type SceneConditionKind } from "./app/sceneConditionContracts";
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
  const [monsterQuery, setMonsterQuery] = useState("");
  const [monsterCount, setMonsterCount] = useState(1);
  if (!snapshot) return null;

  const combatants = snapshot.scene.entities.filter((entity) => entity.kind === "combatant");
  const monsterResults = monsterQuery.trim() ? searchSrdMonsters(monsterQuery, { limit: 12 }) : [];
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
  const addMonster = async (monsterId: string) => {
    if (pendingKey) return;
    setPendingKey(`monster:${monsterId}`);
    try {
      const count = Math.max(1, Math.min(monsterCount, 12));
      if (count > 1) { await mockAdapter.instantiateCombatantGroup(monsterId, count); await refresh(); }
      else await instantiateCombatant(monsterId);
    } finally {
      setPendingKey(null);
    }
  };
  const addLibraryNpc=async(entryId:string)=>{if(pendingKey||!campaignId)return;setPendingKey(`library:${entryId}`);try{await instantiateCampaignDmLibraryNpc(campaignId,entryId);}finally{setPendingKey(null);}};
  const addLibraryPreset=async(entryId:string)=>{if(pendingKey||!campaignId)return;setPendingKey(`preset:${entryId}`);try{await mockAdapter.instantiateCampaignDmLibraryPcPreset(campaignId,entryId);await refresh();}finally{setPendingKey(null);}};

  const [routineFor, setRoutineFor] = useState<string | null>(null);
  const useLegendaryResistance = async (combatantId: string) => {
    if (pendingKey) return;
    setPendingKey(`lr:${combatantId}`);
    try {
      await mockAdapter.useLegendaryResistance(combatantId);
      await refresh();
    } finally {
      setPendingKey(null);
    }
  };
  const run = async (key: string, task: () => Promise<unknown>) => {
    if (pendingKey) return;
    setPendingKey(key);
    try { await task(); await refresh(); } finally { setPendingKey(null); }
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const ungroup = async (groupId: string) => {
    if (pendingKey) return;
    setPendingKey(`ungroup:${groupId}`);
    try {
      await mockAdapter.ungroupCombatants(groupId);
      await refresh();
    } finally {
      setPendingKey(null);
    }
  };
  const clearEngagement = async (leftId: string, rightId: string) => {
    if (pendingKey) return;
    setPendingKey(`engage:${leftId}:${rightId}`);
    try {
      await mockAdapter.setEngagement(leftId, rightId, false);
      await refresh();
    } finally {
      setPendingKey(null);
    }
  };
  const resetTiming = async (combatantId: string) => {
    if (pendingKey) return;
    setPendingKey(`timing:${combatantId}`);
    try {
      await mockAdapter.resetMonsterTiming(combatantId);
      await refresh();
    } finally {
      setPendingKey(null);
    }
  };

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
    <section className="session-dm-scene-conditions" aria-label="장면 조건">
      <span>장면</span>
      {(Object.keys(SCENE_CONDITION_LABELS) as SceneConditionKind[]).map((kind) => {
        const on = snapshot.scene.sceneConditions?.includes(kind) ?? false;
        return <button type="button" key={kind} aria-pressed={on} disabled={Boolean(pendingKey)} title="양쪽 모두 보지 못하면 이점·불리점이 상쇄됩니다. 배지로 예외를 표시하세요." onClick={() => void run(`scene:${kind}`, () => mockAdapter.setSceneCondition(kind, !on))}>{SCENE_CONDITION_LABELS[kind]}</button>;
      })}
    </section>

    <section className="session-dm-section">
      <div className="session-dm-section-title"><strong>Combatant 추가</strong><span>현재 세션을 떠나지 않고 Encounter에 추가합니다.</span></div>
      {campaign&&<><div className="session-dm-section-title compact"><strong>캠페인 DM 라이브러리</strong><span>비공개 NPC 정의와 PC Actor preset</span></div>{libraryNpcs.length||libraryPresets.length?<div className="session-dm-definition-grid campaign-library">{libraryNpcs.map((entry)=><button type="button" key={entry.entryId} disabled={Boolean(pendingKey)} onClick={()=>void addLibraryNpc(entry.entryId)}><div><strong>{entry.favorite?"★ ":""}{entry.label}</strong><small>{entry.tags?.join(" · ")||"Campaign NPC"}</small></div><span>AC {entry.npcDefinition!.ac} · HP {entry.npcDefinition!.maxHp}</span>{pendingKey===`library:${entry.entryId}`&&<em>추가 중…</em>}</button>)}{libraryPresets.map((entry)=><button type="button" key={entry.entryId} disabled={Boolean(pendingKey)} onClick={()=>void addLibraryPreset(entry.entryId)}><div><strong>{entry.favorite?"★ ":""}{entry.label}</strong><small>{entry.tags?.join(" · ")||"Campaign PC preset"}</small></div><span>Lv.{entry.pcPreset!.level} · AC {entry.pcPreset!.ac} · HP {entry.pcPreset!.maxHp}</span>{pendingKey===`preset:${entry.entryId}`&&<em>추가 중…</em>}</button>)}</div>:<p className="session-dm-empty">캠페인에 저장된 NPC/PC Actor가 없습니다.</p>}</>}
      <div className="session-dm-section-title compact"><strong>SRD 몬스터</strong><span>{SRD_MONSTER_COUNT}종 · 이름, 유형, CR로 검색해 바로 추가합니다.</span></div>
      <div className="session-dm-monster-search">
        <input type="search" value={monsterQuery} onChange={(event) => setMonsterQuery(event.target.value)} placeholder="고블린, 드래곤, 언데드…" aria-label="SRD 몬스터 검색" />
        <label title="2 이상이면 한 무리로 추가합니다: 우선권을 한 번만 굴리고 상대 보드에서 한 카드로 접힙니다.">×<input type="number" min={1} max={12} value={monsterCount} onChange={(event) => setMonsterCount(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} aria-label="추가할 마리 수" />{monsterCount > 1 && <small>한 무리</small>}</label>
      </div>
      {monsterQuery.trim() ? (monsterResults.length ? <div className="session-dm-definition-grid session-dm-monster-results">
        {monsterResults.map((monster) => <button type="button" key={monster.id} disabled={Boolean(pendingKey)} onClick={() => void addMonster(monster.id)}>
          <div><strong>{monster.name}</strong><small>{monster.typeText} · CR {monster.crText}</small></div>
          <span>AC {monster.ac} · HP {monster.hp}</span>
          {pendingKey === `monster:${monster.id}` && <em>추가 중…</em>}
        </button>)}
      </div> : <p className="session-dm-empty">일치하는 몬스터가 없습니다.</p>) : null}
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
        {combatants.map((combatant) => {
          const timing = combatant.runtimeMonsterTiming;
          const badges = monsterTimingBadges(combatant);
          const group = combatant.groupId ? snapshot.scene.groups?.[combatant.groupId] : undefined;
          return <div key={combatant.id} className={timing ? "has-timing" : ""}>
            <div>
              <strong>{combatant.name}</strong>
              <small>{entitySummary(combatant)}{group ? ` · ${group.label}` : ""}</small>
              {badges.length > 0 && <span className="session-dm-timing-badges">{badges.map((badge) => <em key={badge.key} title={badge.title}>{badge.text}</em>)}</span>}
              {(combatant.engagedWithIds?.length ?? 0) > 0 && <span className="session-dm-engagements">{combatant.engagedWithIds!.map((otherId) => {
                const other = snapshot.scene.entities.find((entity) => entity.id === otherId);
                return <button type="button" key={otherId} disabled={Boolean(pendingKey)} title="교전 해제 (다음 원거리 공격에 근접 불리점 없음)" onClick={() => void clearEngagement(combatant.id, otherId)}>교전 · {other?.name ?? otherId} ×</button>;
              })}</span>}
            </div>
            {editingId === combatant.id && <div className="session-dm-narrative" aria-label={`${combatant.name} 서술 편집`}>
              <div><span>HP</span>{([5, 10] as const).map((amount) => <button type="button" key={amount} disabled={Boolean(pendingKey)} onClick={() => void run(`hp:${combatant.id}`, () => mockAdapter.applyNarrativeDamage(combatant.id, amount))}>−{amount}</button>)}<button type="button" disabled={Boolean(pendingKey)} onClick={() => void run(`hp:${combatant.id}`, () => mockAdapter.applyNarrativeDamage(combatant.id, "half"))}>절반</button><button type="button" disabled={Boolean(pendingKey)} onClick={() => void run(`hp:${combatant.id}`, () => mockAdapter.applyNarrativeDamage(combatant.id, -5))}>+5</button></div>
              <div><span>배지</span>{(Object.keys(CREATURE_BADGE_LABELS) as CreatureBadgeKind[]).map((badge) => { const label = CREATURE_BADGE_LABELS[badge]; const on = combatant.status.includes(label); return <button type="button" key={badge} aria-pressed={on} disabled={Boolean(pendingKey)} onClick={() => void run(`badge:${combatant.id}`, () => mockAdapter.setCreatureBadge(combatant.id, badge, !on))}>{label}</button>; })}</div>
              <div><span>상태</span>{NARRATIVE_CONDITION_LABELS.map((label) => { const on = combatant.status.includes(label); return <button type="button" key={label} aria-pressed={on} disabled={Boolean(pendingKey)} onClick={() => void run(`status:${combatant.id}`, () => mockAdapter.setCreatureStatus(combatant.id, label, !on))}>{label}</button>; })}</div>
            </div>}
            {routineFor === combatant.id && <div className="session-dm-narrative" aria-label={`${combatant.name} 다중공격 대상`}>
              <div><span>대상</span>{snapshot.scene.entities.filter((entry) => entry.id !== combatant.id && entry.side !== combatant.side && entry.hp > 0).map((entry) => <button type="button" key={entry.id} disabled={Boolean(pendingKey)} onClick={() => { setRoutineFor(null); void run(`routine:${combatant.id}`, () => mockAdapter.resolveMultiattackRoutine(combatant.id, entry.id)); }}>{entry.name}</button>)}</div>
            </div>}
            <span className="session-dm-combatant-actions">
              <button type="button" aria-expanded={editingId === combatant.id} disabled={Boolean(pendingKey)} onClick={() => setEditingId((current) => current === combatant.id ? null : combatant.id)} title="HP·배지·상태를 굴림 없이 바로 편집합니다.">{editingId === combatant.id ? "닫기" : "편집"}</button>
              {(() => { const routine = multiattackRoutineOf(snapshot, combatant.id); return routine && <button type="button" aria-expanded={routineFor === combatant.id} disabled={Boolean(pendingKey)} onClick={() => setRoutineFor((current) => current === combatant.id ? null : combatant.id)} title="다중공격 루틴을 한 대상에게 순서대로 한 번에 판정합니다.">{pendingKey === `routine:${combatant.id}` ? "…" : `다중공격 · ${multiattackRoutineLabel(routine)}`}</button>; })()}
              {timing?.legendaryResistance && timing.legendaryResistance.remaining > 0 && <button type="button" disabled={Boolean(pendingKey)} onClick={() => void useLegendaryResistance(combatant.id)} title="실패한 내성 굴림을 성공으로 바꿉니다. 판정에는 강제 성공을 적용하세요.">{pendingKey === `lr:${combatant.id}` ? "…" : `전설 저항 ${timing.legendaryResistance.remaining}`}</button>}
              {group && group.memberIds[0] === combatant.id && <button type="button" disabled={Boolean(pendingKey)} onClick={() => void ungroup(group.id)} title="무리를 풀어 개별 카드로 보여줍니다.">{pendingKey === `ungroup:${group.id}` ? "…" : "무리 해제"}</button>}
              {timing && <button type="button" disabled={Boolean(pendingKey)} onClick={() => void resetTiming(combatant.id)} title="재충전, 사용 횟수, 전설 행동을 모두 되돌립니다.">{pendingKey === `timing:${combatant.id}` ? "…" : "재정비"}</button>}
              <button type="button" disabled={Boolean(pendingKey || removalBlocked)} onClick={() => void remove(combatant.id)}>{pendingKey === `remove:${combatant.id}` ? "제거 중…" : "제거"}</button>
            </span>
          </div>;
        })}
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
