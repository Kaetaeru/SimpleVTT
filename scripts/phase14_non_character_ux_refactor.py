from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def replace_block(text:str,start:str,end:str,replacement:str)->str:
    i=text.index(start)
    j=text.index(end,i+len(start))
    return text[:i]+replacement.rstrip()+"\n\n"+text[j:]


def replace_once(text:str,old:str,new:str)->str:
    count=text.count(old)
    if count!=1:
        raise RuntimeError(f"expected exactly one match, found {count}: {old[:120]!r}")
    return text.replace(old,new,1)

app_path=ROOT/"src/App.tsx"
app=app_path.read_text()

app=replace_block(app,"export function App()","function topTitle",r'''export function App() {
  const { snapshot, loading } = useSimpleVtt();
  const [route, setRoute] = useState<AppRoute>("characters");
  const [debugOpen, setDebugOpen] = useState(false);
  const productionRole: "player" | "dm" = snapshot?.session.role === "host" ? "dm" : snapshot?.session.role === "client" ? "player" : snapshot?.role ?? "player";

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "d") {
        event.preventDefault();
        setDebugOpen((value) => !value);
      }
      if (event.key === "Escape" && debugOpen) setDebugOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [debugOpen]);

  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.session.role === "host" && ["characters", "character", "create", "levelup"].includes(route)) {
      setRoute("session");
      return;
    }
    if (productionRole === "dm" && ["characters", "character", "create", "levelup"].includes(route)) setRoute("scene");
  }, [snapshot, productionRole, route]);

  if (loading || !snapshot) return <div className="loading-screen">SimpleVTT 불러오는 중…</div>;

  const playerNav: Array<[AppRoute, string, string]> = [
    ["characters", "캐릭터", "◉"], ["scene", "플레이", "◆"], ["catalog", "규칙", "▤"], ["activity", "기록", "≡"], ["session", "세션", "⌁"], ["settings", "설정", "⚙"],
  ];
  const dmNav: Array<[AppRoute, string, string]> = [
    ["scene", "플레이", "◆"], ["combatants", "컴배턴트", "♜"], ["catalog", "규칙", "▤"], ["activity", "기록", "≡"], ["session", "세션", "⌁"], ["settings", "설정", "⚙"],
  ];
  const nav = productionRole === "player" ? playerNav : dmNav;
  const connectedSession=snapshot.session.role!=="offline";
  const liveSession=snapshot.session.lifecycle==="live";

  return (
    <div className="app-shell">
      <aside className="rail">
        <button className="brand" onClick={() => setRoute(productionRole === "player" ? "characters" : "scene")}>S</button>
        <nav className="rail-nav">
          {nav.map(([id, label, icon]) => (
            <button key={id} className={route === id || (id === "characters" && ["character", "create", "levelup"].includes(route)) ? "rail-button active" : "rail-button"} onClick={() => setRoute(id)} title={label}>
              <span className="rail-icon">{icon}</span><span className="rail-label">{label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-spacer" />
        {connectedSession && <div className={`connection-dot ${snapshot.connectionState}`} title={connectionLabel(snapshot.connectionState)} />}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">SimpleVTT</span><strong>{topTitle(route, productionRole)}</strong></div>
          <div className="topbar-meta">
            {liveSession && <span>{snapshot.sessionMode === "initiative" ? `이니셔티브 · ${snapshot.scene.round}라운드` : "자유 진행"}</span>}
            {connectedSession && <span className={`status-text ${snapshot.connectionState}`}>{connectionLabel(snapshot.connectionState)}</span>}
          </div>
        </header>
        <main className="content">
          {snapshot.edgeState !== "normal" && <EdgeBanner />}
          {snapshot.role === "player" && route === "characters" && <CharacterLibraryScreen onOpen={() => setRoute("character")} onCreate={() => setRoute("create")} />}
          {snapshot.role === "player" && route === "character" && <CharacterSheetScreen onScene={() => setRoute("scene")} onLevelUp={() => setRoute("levelup")} onEdit={() => setRoute("create")} />}
          {snapshot.role === "player" && route === "create" && <CharacterCreateScreen onDone={() => setRoute("character")} onCancel={() => setRoute("characters")} />}
          {snapshot.role === "player" && route === "levelup" && <LevelUpScreen onDone={() => setRoute("character")} onCancel={() => setRoute("character")} />}
          {route === "scene" && (productionRole === "player" ? <PlayerSceneScreen /> : <DmSceneScreen />)}
          {route === "combatants" && productionRole === "dm" && <CombatantsScreen />}
          {route === "catalog" && <CatalogScreen />}
          {route === "activity" && <ActivityScreen />}
          {route === "session" && <SessionScreen />}
          {route === "settings" && <SettingsScreen />}
        </main>
      </section>

      {snapshot.resolution && <ResolutionDrawer />}
      {debugOpen && <DebugPanel onClose={() => setDebugOpen(false)} />}
    </div>
  );
}''')

app=replace_block(app,'function topTitle(route: AppRoute, role: "player" | "dm") {','function EdgeBanner',r'''function topTitle(route: AppRoute, role: "player" | "dm") {
  if (route === "characters") return "캐릭터";
  if (route === "character") return "캐릭터 시트";
  if (route === "create") return "캐릭터 생성 / 편집";
  if (route === "levelup") return "레벨 업";
  if (route === "scene") return role === "player" ? "플레이" : "DM 플레이";
  if (route === "combatants") return "Encounter";
  if (route === "catalog") return "규칙";
  if (route === "activity") return "플레이 기록";
  if (route === "session") return "세션";
  return "설정";
}''')

app=replace_block(app,"function EdgeBanner() {","function ScreenHead",r'''function EdgeBanner() {
  const { snapshot } = useSimpleVtt();
  if (!snapshot || snapshot.edgeState === "normal") return null;
  return <div className={`edge-banner ${snapshot.edgeState}`}><strong>{snapshot.edgeState === "save-error" ? "저장하지 못했습니다" : "이 콘텐츠는 현재 사용할 수 없습니다"}</strong><span>{snapshot.edgeState === "save-error" ? "변경 내용을 보존한 채 다시 저장해 주세요." : "다른 콘텐츠를 선택하거나 설정을 확인해 주세요."}</span></div>;
}''')

app=replace_block(app,"function PlayerSceneScreen() {","function DmSceneScreen()",r'''function PlayerSceneScreen() {
  const { snapshot, endTurn, setUiDebug } = useSimpleVtt();
  const [filter, setFilter] = useState<"all" | "basic" | "weapon" | "magic">("all");
  if (!snapshot) return null;
  const scene = snapshot.scene;
  const actorId = snapshot.sessionMode === "initiative" ? scene.currentActorId : snapshot.activeCharacter.id;
  const actor = scene.entities.find((entity) => entity.id === actorId) ?? scene.entities.find((entity) => entity.id === snapshot.activeCharacter.id);
  const actions = actor ? scene.actionsByActor[actor.id] ?? [] : [];
  const targeting = useTargeting(actor?.id ?? "", actions);
  if (!actor) return <div className="screen scene-screen"><ScreenHead kicker="PLAY" title={snapshot.session.name || scene.name} description="플레이할 캐릭터가 아직 장면에 없습니다."/><section className="play-empty-state"><h2>장면 참가를 기다리는 중입니다</h2><p>세션 연결 상태를 확인하거나 Host가 플레이를 시작할 때까지 기다려 주세요.</p></section></div>;
  const enemies = scene.entities.filter((entity) => entity.side === "enemy");
  const allies = scene.entities.filter((entity) => entity.side === "ally");
  const currentTarget = targeting.selectedTargetIds[0] ? scene.entities.find((entity) => entity.id === targeting.selectedTargetIds[0]) : snapshot.resolution?.targetIds[0] ? scene.entities.find((entity) => entity.id === snapshot.resolution?.targetIds[0]) : undefined;
  const canEndTurn = snapshot.sessionMode === "initiative" && scene.currentActorId === snapshot.activeCharacter.id;
  return <div className="screen scene-screen"><ScreenHead kicker="PLAY" title={snapshot.session.role === "client" ? snapshot.session.name : scene.name} description={snapshot.sessionMode === "initiative" ? `${scene.round}라운드 · ${scene.entities.find((entity) => entity.id === scene.currentActorId)?.name ?? "다음 참가자"}의 턴` : "자유 진행"} actions={canEndTurn ? <button className="primary" onClick={() => endTurn()}>턴 종료</button> : undefined}/><div className="scene-layout focused-scene-layout"><aside className="scene-side"><PanelTitle>{snapshot.sessionMode === "initiative" ? "이니셔티브" : "참가자"}</PanelTitle><EntityList entities={scene.entities} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onHover={(id) => setUiDebug({ hoverTargetId: id })}/></aside><section className="scene-center"><div className="scene-stage"><div className="formation enemies">{enemies.map((entity) => <EntityPortrait key={entity.id} entity={entity} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onHover={(id) => setUiDebug({ hoverTargetId: id })}/>)}</div><div className="scene-context"><strong>{targeting.selectedAction ? targeting.selectedAction.name : scene.name}</strong><span>{targeting.selectedAction ? "유효한 대상을 선택하세요." : "행동을 선택하고 필요한 대상을 지정하세요."}</span></div><div className="formation allies">{allies.map((entity) => <EntityPortrait key={entity.id} entity={entity} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onHover={(id) => setUiDebug({ hoverTargetId: id })}/>)}</div></div><ActionConsole actor={actor} actions={actions} economy={scene.economyByActor[actor.id]} resources={snapshot.activeCharacter.resources.map((resource) => `${resource.label} ${resource.current}/${resource.max}`)} filter={filter} setFilter={setFilter} selectedActionId={targeting.selectedActionId} selectedTargetIds={targeting.selectedTargetIds} onAction={targeting.chooseAction} onCancel={targeting.cancel} onCompleteMulti={targeting.completeMulti} sessionMode={snapshot.sessionMode}/></section><aside className="scene-side"><PanelTitle>{currentTarget ? "현재 대상" : "내 캐릭터"}</PanelTitle><Inspector entity={currentTarget ?? actor}/>{snapshot.session.role !== "offline" && <><PanelTitle>세션</PanelTitle><div className="session-mini"><span className={snapshot.connectionState === "connected" ? "ok-dot" : "warn-dot"}/>{connectionLabel(snapshot.connectionState)}</div></>}</aside></div>{targeting.selectedAction && <TargetingOverlay />}</div>;
}''')

app=replace_block(app,"function DmSceneScreen() {","function ActionConsole(",r'''function DmSceneScreen() {
  const { snapshot, selectDmActor, startInitiative, endInitiative, endTurn, setUiDebug } = useSimpleVtt();
  const [filter, setFilter] = useState<"all" | "basic" | "weapon" | "magic">("all");
  if (!snapshot) return null;
  const scene = snapshot.scene;
  const selectedActor = scene.entities.find((entity) => entity.id === scene.selectedActorId) ?? scene.entities[0];
  const currentActor = scene.entities.find((entity) => entity.id === scene.currentActorId) ?? scene.entities[0];
  const actions = selectedActor ? scene.actionsByActor[selectedActor.id] ?? [] : [];
  const targeting = useTargeting(selectedActor?.id ?? "", actions);
  if (!selectedActor||!currentActor) return <div className="screen scene-screen dm-screen"><ScreenHead kicker="DM PLAY" title={snapshot.session.name || scene.name} description="아직 플레이 참가자가 없습니다."/><section className="play-empty-state"><span className="eyebrow accent">ENCOUNTER</span><h2>Encounter가 비어 있습니다</h2><p>세션 화면에서 플레이어 참가를 기다리거나 Combatant 화면에서 필요한 전투원을 추가하세요. 기본 몬스터는 자동으로 배치되지 않습니다.</p></section></div>;
  const controls = snapshot.sessionMode === "freeform" ? <button className="primary" onClick={() => startInitiative()}>이니셔티브 시작</button> : <><button className="primary" onClick={() => endTurn()}>다음 턴</button><button onClick={() => endInitiative()}>이니셔티브 종료</button></>;
  const connectedPlayers=snapshot.session.participants.filter((participant)=>participant.id!=="host");
  return <div className="screen scene-screen dm-screen"><ScreenHead kicker="DM PLAY" title={snapshot.session.name || scene.name} description={snapshot.sessionMode === "initiative" ? `${scene.round}라운드 · 현재 턴 ${currentActor.name}` : `자유 진행 · ${selectedActor.name} 선택됨`} actions={controls}/><div className="scene-layout dm-layout focused-scene-layout"><aside className="scene-side"><PanelTitle>{snapshot.sessionMode === "initiative" ? "이니셔티브" : "Encounter"}</PanelTitle><div className="actor-select-list">{[...scene.entities].sort((a, b) => b.initiative - a.initiative).map((entity) => <button key={entity.id} className={`${entity.id === selectedActor.id ? "selected" : ""} ${entity.id === currentActor.id ? "current" : ""}`} onClick={() => selectDmActor(entity.id)}><span>{snapshot.sessionMode === "initiative" ? entity.initiative : "·"}</span><div><strong>{entity.name}</strong><small>HP {entity.hp}/{entity.maxHp} · AC {entity.ac}</small></div></button>)}</div>{connectedPlayers.length>0&&<><PanelTitle>플레이어</PanelTitle>{connectedPlayers.map((participant) => <div className="session-mini" key={participant.id}><span className={participant.state === "connected" ? "ok-dot" : "warn-dot"}/>{participant.characterName ?? participant.name}</div>)}</>}</aside><section className="scene-center"><div className="scene-stage"><div className="formation enemies">{scene.entities.filter((entity) => entity.side === "enemy").map((entity) => <EntityPortrait key={entity.id} entity={entity} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onIdle={() => selectDmActor(entity.id)} onHover={(id) => setUiDebug({ hoverTargetId: id })}/>)}</div><div className="scene-context"><strong>{targeting.selectedAction ? targeting.selectedAction.name : selectedActor.name}</strong><span>{targeting.selectedAction ? "판정할 대상을 선택하세요." : "행동할 전투원을 선택한 뒤 행동을 고르세요."}</span></div><div className="formation allies">{scene.entities.filter((entity) => entity.side === "ally").map((entity) => <EntityPortrait key={entity.id} entity={entity} selectedAction={targeting.selectedAction} selectedTargetIds={targeting.selectedTargetIds} onTarget={targeting.chooseTarget} onIdle={() => selectDmActor(entity.id)} onHover={(id) => setUiDebug({ hoverTargetId: id })}/>)}</div></div><ActionConsole actor={selectedActor} actions={actions} economy={scene.economyByActor[selectedActor.id]} resources={selectedActor.id === snapshot.activeCharacter.id ? snapshot.activeCharacter.resources.map((resource) => `${resource.label} ${resource.current}/${resource.max}`) : []} filter={filter} setFilter={setFilter} selectedActionId={targeting.selectedActionId} selectedTargetIds={targeting.selectedTargetIds} onAction={targeting.chooseAction} onCancel={targeting.cancel} onCompleteMulti={targeting.completeMulti} sessionMode={snapshot.sessionMode}/></section><aside className="scene-side"><PanelTitle>선택한 전투원</PanelTitle><Inspector entity={selectedActor}/><PanelTitle>최근 결과</PanelTitle><div className="activity-mini">{snapshot.activity.slice(0, 3).map((entry) => <div key={entry.id}><strong>{entry.title}</strong><span>{entry.summary}</span></div>)}</div></aside></div>{targeting.selectedAction && <TargetingOverlay />}</div>;
}''')

app=replace_block(app,"function CombatantsScreen() {","function CatalogScreen()",r'''function CombatantsScreen() {
  const { snapshot, previewCombatantImport, activateCombatantImport, clearCombatantImport, instantiateCombatant, removeCombatant } = useSimpleVtt();
  const [showImport, setShowImport] = useState(false);
  const [query,setQuery]=useState("");
  const [payload, setPayload] = useState('{\n  "id": "combatant.local-bandit",\n  "name": "로컬 산적",\n  "nameEn": "Local Bandit",\n  "ac": 14,\n  "maxHp": 18,\n  "actions": ["단검", "라이트 크로스보우"],\n  "source": "My Encounter Pack",\n  "version": "0.1"\n}');
  if (!snapshot) return null;
  const definitions=snapshot.combatantDefinitions.filter((definition)=>`${definition.name} ${definition.nameEn} ${definition.actions.join(" ")}`.toLowerCase().includes(query.toLowerCase()));
  const current=snapshot.scene.entities.filter((entity)=>entity.kind==="combatant");
  const canRemove=snapshot.session.role==="host"&&snapshot.session.lifecycle==="preparing";
  return <div className="screen page-dark"><ScreenHead kicker="ENCOUNTER" title="Combatant" description="필요한 전투원만 골라 현재 Encounter에 추가합니다." actions={<button onClick={() => setShowImport((value) => !value)}>Combatant 가져오기</button>}/>{showImport && <ImportPanel title="Combatant JSON" payload={payload} setPayload={setPayload} preview={snapshot.combatantImport?.validation} onPreview={() => previewCombatantImport(payload)} onActivate={() => activateCombatantImport()} onCancel={() => { setShowImport(false); void clearCombatantImport(); }} canActivate={Boolean(snapshot.combatantImport?.definition && !snapshot.combatantImport.validation.some((item) => item.severity === "blocking"))}>{snapshot.combatantImport?.definition && <div className="review-rows"><div><span>Combatant</span><strong>{snapshot.combatantImport.definition.name}</strong></div><div><span>AC / HP</span><strong>{snapshot.combatantImport.definition.ac} / {snapshot.combatantImport.definition.maxHp}</strong></div><div><span>행동</span><strong>{snapshot.combatantImport.definition.actions.join(", ")}</strong></div></div>}</ImportPanel>}<div className="combatant-toolbar"><input placeholder="Combatant 검색" value={query} onChange={(event)=>setQuery(event.target.value)} /></div><SectionTitle>라이브러리</SectionTitle><div className="combatant-grid">{definitions.map((definition) => <article className="panel-card combatant-library-card" key={definition.id}><h2>{definition.name}</h2><p>AC {definition.ac} · HP {definition.maxHp}</p><details><summary>행동 / 출처</summary><div className="status-chips">{definition.actions.map((action) => <span key={action}>{action}</span>)}</div><small>{definition.nameEn} · {definition.source} · v{definition.version}</small></details><button className="primary" onClick={() => instantiateCombatant(definition.id)}>Encounter에 추가</button></article>)}</div><SectionTitle>현재 Encounter</SectionTitle>{current.length===0?<div className="surface-empty"><strong>추가된 Combatant가 없습니다.</strong><span>라이브러리에서 필요한 전투원만 추가하세요.</span></div>:<div className="combatant-grid compact-cards">{current.map((entity) => <article className="panel-card" key={entity.id}><h3>{entity.name}</h3><p>HP {entity.hp}/{entity.maxHp} · AC {entity.ac}</p><div className="status-chips">{entity.status.map((status) => <span key={status}>{status}</span>)}</div>{canRemove&&<button onClick={()=>removeCombatant(entity.id)}>Encounter에서 제거</button>}</article>)}</div>}</div>;
}''')

app=replace_block(app,"function CatalogScreen() {","function ImportPanel(",r'''function CatalogScreen() {
  const { snapshot, previewContentImport, activateContentImport, clearContentImport } = useSimpleVtt();
  const [category, setCategory] = useState<"all" | CatalogEntry["category"]>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [payload, setPayload] = useState('{\n  "id": "subclass.local-stoneguard",\n  "category": "subclass",\n  "nameKo": "석벽 수호자",\n  "nameEn": "Stoneguard",\n  "baseClassId": "class.fighter",\n  "source": "My Homebrew",\n  "version": "0.1",\n  "description": "전사와 관계를 맺는 홈브루 서브클래스"\n}');
  if (!snapshot) return null;
  const filtered = snapshot.catalog.filter((entry) => (category === "all" || entry.category === category) && `${entry.nameKo} ${entry.nameEn}`.toLowerCase().includes(query.toLowerCase()));
  const selected = snapshot.catalog.find((entry) => entry.id === (selectedId ?? filtered[0]?.id));
  const categories: Array<"all" | CatalogEntry["category"]> = ["all", "feat", "spell", "class", "subclass", "species", "background", "item", "condition", "combatant", "option"];
  return <div className="screen page-dark"><ScreenHead kicker="RULES" title="규칙" description="이름과 종류로 찾고, 필요한 규칙만 상세에서 확인합니다." actions={<button onClick={() => setShowImport((value) => !value)}>콘텐츠 가져오기</button>}/>{showImport && <ImportPanel title="Content JSON" payload={payload} setPayload={setPayload} preview={snapshot.contentImport?.validation} onPreview={() => previewContentImport(payload)} onActivate={() => activateContentImport()} onCancel={() => { setShowImport(false); void clearContentImport(); }} canActivate={Boolean(snapshot.contentImport?.entry && !snapshot.contentImport.validation.some((item) => item.severity === "blocking"))}>{snapshot.contentImport?.entry && <div className="review-rows"><div><span>콘텐츠</span><strong>{snapshot.contentImport.entry.nameKo} / {snapshot.contentImport.entry.nameEn}</strong></div><div><span>적용 범위</span><strong>{snapshot.contentImport.entry.scope}</strong></div><div><span>연결된 규칙</span><strong>{snapshot.contentImport.entry.relationships.map((relationship) => `${relationship.label} → ${relationship.targetName}`).join(", ") || "없음"}</strong></div></div>}</ImportPanel>}<div className="catalog-layout"><aside className="catalog-categories">{categories.map((id) => <button key={id} className={category === id ? "active" : ""} onClick={() => setCategory(id)}>{id === "all" ? "전체" : categoryLabel(id)}</button>)}</aside><section className="catalog-list"><input placeholder="규칙 검색" value={query} onChange={(event) => setQuery(event.target.value)}/>{filtered.map((entry) => <button key={entry.id} className={selected?.id === entry.id ? "selected" : ""} onClick={() => setSelectedId(entry.id)}><span className="catalog-glyph">{entry.nameKo[0]}</span><div><strong>{entry.nameKo}</strong><small>{entry.nameEn} · {categoryLabel(entry.category)}</small></div></button>)}</section><aside className="catalog-detail">{selected ? <><span className="eyebrow accent">{categoryLabel(selected.category)}</span><h2>{selected.nameKo}</h2><small>{selected.nameEn}</small><p>{selected.description}</p>{selected.relationships.length > 0 && <><SectionTitle>연결된 규칙</SectionTitle>{selected.relationships.map((relationship) => <div className="relationship-card" key={relationship.targetId}><span>{relationship.label}</span><strong>{relationship.targetName}</strong></div>)}</>}<details className="catalog-technical"><summary>기술 정보</summary><div className="review-rows"><div><span>출처</span><strong>{selected.source} · v{selected.version}</strong></div><div><span>적용 범위</span><strong>{selected.scope}</strong></div><div><span>콘텐츠 ID</span><strong>{selected.id}</strong></div><div><span>기능</span><strong>{selected.capabilities.join(", ") || "없음"}</strong></div></div></details></>:<div className="surface-empty"><strong>일치하는 규칙이 없습니다.</strong><span>검색어 또는 종류 필터를 바꿔 보세요.</span></div>}</aside></div></div>;
}''')

app=replace_block(app,"function ActivityScreen() {","function SessionScreen()",r'''function ActivityScreen() {
  const { snapshot } = useSimpleVtt();
  if (!snapshot) return null;
  return <div className="screen page-dark"><ScreenHead kicker="ACTIVITY" title="플레이 기록" description="누가 무엇을 했고 결과가 어떻게 바뀌었는지 시간순으로 확인합니다."/>{snapshot.activity.length===0?<div className="surface-empty"><strong>아직 기록이 없습니다.</strong><span>플레이를 시작하면 행동과 결과가 여기에 쌓입니다.</span></div>:<div className="activity-list">{snapshot.activity.map((entry) => <article key={entry.id} className={`${entry.correction ? "activity-entry correction" : "activity-entry"} ${entry.reversed ? "reversed" : ""}`}><time>{entry.time}</time><div><span className="badge">{entry.actor}</span>{entry.correction && <span className="badge warning">DM 수정</span>}{entry.reversed && <span className="badge warning">되돌림</span>}<h3>{entry.title}</h3><p>{entry.summary}</p>{entry.ruling && <p>DM 판단 · {entry.ruling}</p>}<details><summary>기술 정보</summary>{entry.detail.map((line) => <div key={line}>{line}</div>)}{entry.stateChanges.map((line) => <div key={line}>상태 변화 · {line}</div>)}<small>기록 ID · {entry.id}</small></details></div></article>)}</div>}</div>;
}''')

app=replace_block(app,"function SessionScreen() {","function SettingsScreen()",r'''function SessionScreen() {
  return <div className="screen page-dark production-session-screen"><div id="production-session-workspace-root" className="session-grid production-session-mount" /></div>;
}''')

app=replace_block(app,"function SettingsScreen() {","function DebugPanel(",r'''function SettingsScreen() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [accent, setAccent] = useState<"gold" | "blue" | "green">("gold");
  const [motion, setMotion] = useState<"normal" | "reduced">("normal");
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.dataset.accent = accent; }, [accent]);
  useEffect(() => { document.documentElement.dataset.motion = motion; }, [motion]);
  return <div className="screen page-dark"><ScreenHead kicker="SETTINGS" title="환경 설정" description="표시 방식과 움직임을 내 환경에 맞게 조정합니다."/><div className="settings-card"><SectionTitle>화면 테마</SectionTitle><div className="method-tabs"><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><strong>다크</strong><span>어두운 배경</span></button><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><strong>라이트</strong><span>밝은 배경</span></button></div><SectionTitle>강조 색상</SectionTitle><div className="accent-options">{(["gold", "blue", "green"] as const).map((value) => <button key={value} className={accent === value ? `accent-swatch ${value} active` : `accent-swatch ${value}`} onClick={() => setAccent(value)} aria-label={`${value} 강조 색상`}/>)}</div><SectionTitle>접근성 · 움직임</SectionTitle><div className="method-tabs"><button className={motion === "normal" ? "active" : ""} onClick={() => setMotion("normal")}><strong>기본 움직임</strong><span>전환과 주사위 애니메이션 사용</span></button><button className={motion === "reduced" ? "active" : ""} onClick={() => setMotion("reduced")}><strong>움직임 줄이기</strong><span>결과는 유지하고 애니메이션만 최소화</span></button></div></div></div>;
}''')

app=replace_once(app,'<p>{entity.kind === "character" ? "Player Character projection" : "Combatant encounter instance"}</p>','<small>{entity.kind === "character" ? "캐릭터" : "Encounter 전투원"}</small>')
app=app.replace('유효한 Entity를 클릭','유효한 대상을 선택')
app=app.replace('Action을 선택하거나 Hover로 계산을 확인하세요.','행동을 선택하거나 포커스를 옮겨 세부 정보를 확인하세요.')
app=app.replace('상세 계산 / provenance','판정 상세')
app=app.replace('StateChanges','상태 변화')
app_path.write_text(app)

wire_path=ROOT/"src/app/connectedSessionWire.ts"
wire=wire_path.read_text()
wire=replace_once(wire,'      sessionId:string;\n      compatibility:SessionCompatibilityResult;','      sessionId:string;\n      sessionName?:string;\n      compatibility:SessionCompatibilityResult;')
wire=replace_once(wire,'    if (!isString(value.sessionId)||!isCompatibility(value.compatibility)||!isCursor(value.hostCursor)||!Array.isArray(value.events)||!value.events.every(isConnectedEvent)) return "invalid hello-ack message";','    if (!isString(value.sessionId)||(value.sessionName!==undefined&&!isString(value.sessionName))||!isCompatibility(value.compatibility)||!isCursor(value.hostCursor)||!Array.isArray(value.events)||!value.events.every(isConnectedEvent)) return "invalid hello-ack message";')
wire_path.write_text(wire)

runtime_path=ROOT/"src/app/connectedSessionRuntimeAdapter.ts"
runtime=runtime_path.read_text()
runtime=replace_once(runtime,'async function rejectLiveHello(adapter:MockAdapter,peer:string,message:string) {\n  const state=connectedStateFor(adapter);','async function rejectLiveHello(adapter:MockAdapter,peer:string,message:string) {\n  const state=connectedStateFor(adapter);\n  const app=connectedInternal(adapter);')
runtime=replace_once(runtime,'    sessionId:ledger.sessionId,\n    compatibility:{status:"incompatible",message},','    sessionId:ledger.sessionId,\n    sessionName:app.session.name,\n    compatibility:{status:"incompatible",message},')
runtime=replace_once(runtime,'    await sendConnectedWireTo(message.peer,{type:"hello-ack",sessionId:ledger.sessionId,compatibility,hostCursor:ledger.cursor,events});','    await sendConnectedWireTo(message.peer,{type:"hello-ack",sessionId:ledger.sessionId,sessionName:app.session.name,compatibility,hostCursor:ledger.cursor,events});')
runtime=replace_once(runtime,'  if (wire.type==="hello-ack") {\n    state.sessionId=wire.sessionId;','  if (wire.type==="hello-ack") {\n    state.sessionId=wire.sessionId;\n    if (wire.sessionName) app.session.name=wire.sessionName;')
runtime_path.write_text(runtime)

session_path=ROOT/"src/ProductionSessionWorkspaceBridge.tsx"
session=session_path.read_text()
session=replace_once(session,'const findTarget=()=>setTarget(document.querySelector<HTMLElement>(".session-grid"));','const findTarget=()=>setTarget(document.getElementById("production-session-workspace-root"));')
session_path.write_text(session)

css_path=ROOT/"src/production-session-workspace.css"
css=css_path.read_text()
prefix='''.screen.page-dark:has(.production-session-workspace) > .screen-head {\n  display: none;\n}\n\n.session-grid:has(.production-session-workspace) {\n  display: block;\n}\n\n.session-grid > :not(.production-session-workspace) {\n  display: none;\n}\n\n'''
if not css.startswith(prefix):
    raise RuntimeError("unexpected production session css prefix")
css='''.production-session-mount {\n  display: block;\n}\n\n'''+css[len(prefix):]
css_path.write_text(css)

print("Phase 14 non-Character UX refactor applied")
