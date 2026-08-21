(() => {
  'use strict';

  const F = window.SVTT_INTEGRATED_FIXTURES;
  const root = document.getElementById('appRoot');
  const viewport = document.getElementById('reviewViewport');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const viewportSelect = document.getElementById('viewportSelect');
  const viewSelect = document.getElementById('viewSelect');
  const modeSelect = document.getElementById('modeSelect');
  const sheetStyleSelect = document.getElementById('sheetStyleSelect');
  const reducedMotionToggle = document.getElementById('reducedMotionToggle');
  const scenarioTitle = document.getElementById('scenarioTitle');
  const scenarioMeta = document.getElementById('scenarioMeta');

  if (!F || !root) return;

  const BASE = {
    scenarioId: 'PROTO-SCN-01',
    surface: 'tutorial',
    view: 'offline',
    mode: 'freeform',
    viewport: 'normal',
    sheetStyle: 'official',
    selectedCharacterId: 'rowan',
    tutorialChoice: 'official',
    liveSession: false,
    utility: null,
    visibility: 'public',
    connection: 'connected',
    action: null,
    selectedTargets: [],
    currentTurnActorId: 'rowan',
    controlActorId: 'rowan',
    mainHandUnavailable: false,
    resolution: null,
    connectedRoll: null,
    handout: null,
    handoutLocalDismissed: false,
    fullSheet: false,
    hotbarPage: 'Mixed',
    activityFilter: 'all',
    notice: null,
    resizable: false,
    reducedMotion: false,
    contextMenu: null
  };

  const state = { ...BASE };
  let tooltip = null;
  let sheetDiceLayer = null;
  let sheetSettleTimer = null;
  let sheetClearTimer = null;
  let connectedTimerA = null;
  let connectedTimerB = null;
  let connectedTimerC = null;
  let resizeState = null;

  const esc = value => String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');

  const byId = (list,id) => list.find(item => item.id === id);
  const scenario = id => byId(F.scenarios,id);
  const character = id => byId(F.characters,id);
  const currentCharacter = () => character(state.selectedCharacterId) || F.characters[0];
  const actor = id => byId(F.actors,id);
  const capability = id => byId(F.capabilities,id);

  function clearTimers() {
    [sheetSettleTimer,sheetClearTimer,connectedTimerA,connectedTimerB,connectedTimerC].forEach(t => t && clearTimeout(t));
    sheetSettleTimer = sheetClearTimer = connectedTimerA = connectedTimerB = connectedTimerC = null;
  }

  function removeSheetDice() {
    if (sheetSettleTimer) clearTimeout(sheetSettleTimer);
    if (sheetClearTimer) clearTimeout(sheetClearTimer);
    sheetSettleTimer = sheetClearTimer = null;
    sheetDiceLayer?.remove();
    sheetDiceLayer = null;
  }

  function clearTooltip() {
    tooltip?.remove();
    tooltip = null;
  }

  function resetTransient() {
    clearTimers();
    removeSheetDice();
    clearTooltip();
    state.contextMenu = null;
  }

  function applyScenario(id) {
    resetTransient();
    const s = scenario(id) || F.scenarios[0];
    Object.assign(state, BASE, s, {
      scenarioId: s.id,
      selectedTargets: [...(s.selectedTargets || [])],
      viewport: s.viewport || state.viewport || 'normal',
      utility: s.utility || null,
      handout: s.handout || null,
      visibility: s.visibility || 'public',
      connection: s.connection || 'connected',
      currentTurnActorId: s.currentTurnActorId || 'rowan',
      mainHandUnavailable: !!s.mainHandUnavailable,
      fullSheet: !!s.fullSheet,
      resizable: !!s.resizable
    });
    if (s.surface === 'play' || s.surface === 'host' || s.surface === 'join') {
      state.liveSession = s.surface === 'play';
    }
    syncControls();
    render();
    if (s.previewRoll && s.surface === 'sheet') {
      setTimeout(() => runStandaloneRoll(s.previewRoll), 80);
    }
  }

  function syncControls() {
    scenarioSelect.value = state.scenarioId;
    viewportSelect.value = state.viewport;
    viewSelect.value = state.view;
    modeSelect.value = state.mode;
    sheetStyleSelect.value = state.sheetStyle;
    reducedMotionToggle.checked = !!state.reducedMotion;
    document.body.classList.toggle('reduced-motion', !!state.reducedMotion);
    viewport.className = `review-viewport vp-${state.viewport}`;
  }

  function updateHeader() {
    const s = scenario(state.scenarioId);
    scenarioTitle.textContent = s?.label || 'Integrated Reference';
    const bits = [state.surface,state.view];
    if (state.surface === 'play') bits.push(state.mode);
    bits.push(state.viewport);
    scenarioMeta.textContent = bits.filter(Boolean).join(' · ');
  }

  function render() {
    updateHeader();
    syncControls();
    root.innerHTML = renderSurface();
  }

  function productNav(active,{disabled=false}={}) {
    const items = [['home','홈'],['characters','캐릭터'],['session','세션'],['content','콘텐츠'],['rules','룰'],['settings','설정']];
    return `<nav class="product-nav" aria-label="Global navigation">
      <div class="product-brand"><div class="product-brand__mark"></div><strong>SimpleVTT</strong></div>
      ${items.map(([id,label]) => `<button class="nav-item ${active===id?'active':''}" data-nav="${id}" ${disabled?'disabled':''}>${label}</button>`).join('')}
      <div class="nav-spacer"></div>
      ${state.liveSession && !disabled ? '<button class="nav-return" data-nav="play">플레이로 돌아가기</button>' : ''}
    </nav>`;
  }

  function shell(active,content,options={}) {
    return `<div class="product-shell">${productNav(active,options)}${content}</div>`;
  }

  function renderSurface() {
    switch (state.surface) {
      case 'tutorial': return renderTutorial();
      case 'home': return renderHome();
      case 'characters': return renderCharacters();
      case 'sheet': return shell('characters',renderSheet());
      case 'builder': return renderBuilder(false);
      case 'levelup': return renderBuilder(true);
      case 'host': return renderHost();
      case 'join': return renderJoin();
      case 'content': return renderContent();
      case 'content-import': return renderContentImport();
      case 'rules': return renderRules();
      case 'settings': return renderSettings();
      case 'components': return renderComponents();
      case 'play': return renderPlay();
      default: return renderHome();
    }
  }

  function renderTutorial() {
    return shell('home',`<main class="tutorial-page" data-proto-id="PROTO-SURF-FIRST-RUN">
      <div class="tutorial-underlay"><div class="tutorial-underlay__cards"><div></div><div></div><div></div></div></div>
      <section class="tutorial-window" role="dialog" aria-modal="true" aria-label="SimpleVTT Tutorial">
        <div class="tutorial-top">
          <span class="review-kicker">WELCOME TO SIMPLEVTT</span>
          <h1>테이블 위 D&D를 더 빠르고 명확하게.</h1>
          <p>SimpleVTT는 배틀맵 VTT가 아닙니다. 캐릭터 시트와 판정 자동화에 집중한 Standalone 도구이면서, 필요할 때 Host/Join으로 같은 정보를 공유하는 Connected Session 도구입니다.</p>
        </div>
        <div class="tutorial-body">
          <div class="tutorial-mode-row">
            <article class="tutorial-mode"><strong>Standalone Character</strong><p>실제 테이블에서 노트북 하나로 Character Sheet, 능력·공격·피해·일반 주사위, 자원과 상태를 빠르게 사용합니다.</p></article>
            <article class="tutorial-mode"><strong>Connected Session</strong><p>Host는 DM, Client는 Player입니다. Actor·행동·판정·주사위·기록을 공유하지만 Core에는 battlemap이나 token position이 없습니다.</p></article>
          </div>
          <div class="tutorial-section-title">처음 사용할 Character Sheet 스타일</div>
          <div class="sheet-choice-grid">
            <button class="sheet-choice ${state.tutorialChoice==='official'?'selected':''}" data-tutorial-sheet="official"><span class="choice-check">${state.tutorialChoice==='official'?'SELECTED':''}</span><strong>Official-style Sheet</strong><p>종이 Character Sheet의 정보 구조를 따라 전체 기록을 밀도 있게 읽는 방식. SimpleVTT 전용 렌더링으로 제공합니다.</p></button>
            <button class="sheet-choice ${state.tutorialChoice==='simplevtt'?'selected':''}" data-tutorial-sheet="simplevtt"><span class="choice-check">${state.tutorialChoice==='simplevtt'?'SELECTED':''}</span><strong>SimpleVTT Sheet</strong><p>현재 상태와 직접 사용할 Roll/Action을 빠르게 찾도록 재배치한 디지털 최적화 방식입니다.</p></button>
          </div>
          <div class="tutorial-section-title">어디서 시작할까요?</div>
          <div class="tutorial-orientation">
            <div class="orientation-card"><strong>캐릭터</strong><span>Create / Import / Library / Edit / Level Up</span></div>
            <div class="orientation-card"><strong>Host Session</strong><span>열면 바로 live DM Freeform으로 들어갑니다.</span></div>
            <div class="orientation-card"><strong>Join Session</strong><span>로컬 Character를 선택해 이미 진행 중인 Session에 참가합니다.</span></div>
          </div>
          <div class="tutorial-actions"><small>Sheet 스타일과 Tutorial은 Settings에서 다시 변경/열 수 있습니다.</small><button class="btn primary" data-action="complete-tutorial">선택하고 시작</button></div>
        </div>
      </section>
    </main>`,{disabled:true});
  }

  function renderHome() {
    const c = currentCharacter();
    return shell('home',`<main class="product-page" data-proto-id="PROTO-SURF-HOME">
      <div class="home-hero">
        <section class="hero-card"><span class="review-kicker">TABLETOP COMPANION</span><h2>오늘의 플레이를 시작하세요.</h2><p>Character Sheet를 단독으로 사용하거나, DM이 Session을 열고 Player가 자신의 Character로 참가할 수 있습니다. Core Play는 Actor와 판정 중심이며 battlemap을 요구하지 않습니다.</p><div class="hero-actions"><button class="btn primary" data-nav="characters">캐릭터 열기</button><button class="btn" data-action="new-character">새 캐릭터</button><button class="btn quiet" data-action="open-tutorial">Tutorial 다시 보기</button></div></section>
        <div class="session-choice">
          <section class="session-entry-card"><div><span class="badge dm">HOST = DM</span><h3>Host Session</h3><p>Session을 열면 Lobby/Ready 없이 즉시 live Freeform Play가 시작됩니다. Player 0명도 정상입니다.</p></div><button class="btn primary" data-nav="host">Host Session</button></section>
          <section class="session-entry-card"><div><span class="badge ally">CLIENT = PLAYER</span><h3>Join Session</h3><p>Host 연결 정보와 자신의 로컬 Character를 선택해 진행 중인 Session에 참가합니다.</p></div><button class="btn primary" data-nav="join">Join Session</button></section>
        </div>
      </div>
      <div class="page-heading"><div><h2>최근 Character</h2><p>마지막으로 사용한 Character를 바로 열 수 있습니다.</p></div><button class="btn quiet" data-nav="characters">전체 보기</button></div>
      <div class="library-grid">${renderCharacterCard(c)}${renderCharacterCard(F.characters[1])}${renderCharacterCard(F.characters[2])}</div>
    </main>`);
  }

  function renderCharacterCard(c) {
    const pct = c.hpMax ? Math.round((c.hp/c.hpMax)*100) : 0;
    return `<button class="character-card" data-open-character="${esc(c.id)}"><div class="character-portrait">${esc(c.initials)}</div><div class="character-card__body"><h3>${esc(c.name)}</h3><p>${esc(c.classLine)} · HP ${c.hp}/${c.hpMax}${c.tempHp?` +${c.tempHp} Temp`:''}</p><div class="hp-bar"><span style="width:${pct}%"></span></div></div></button>`;
  }

  function renderCharacters() {
    return shell('characters',`<main class="product-page" data-proto-id="PROTO-SURF-CHAR-LIBRARY"><div class="page-heading"><div><h2>캐릭터 라이브러리</h2><p>같은 canonical Character를 Official-style / SimpleVTT 두 표현으로 사용할 수 있습니다.</p></div><div><button class="btn" data-action="import-character">Import</button> <button class="btn primary" data-action="new-character">새 캐릭터</button></div></div><div class="library-grid">${F.characters.map(renderCharacterCard).join('')}</div></main>`);
  }

  function sheetBlock(title,rows) {
    return `<section class="sheet-block"><h3>${esc(title)}</h3>${rows.join('')}</section>`;
  }

  function sheetRollRow(item) {
    return `<div class="sheet-row"><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong><button class="roll-btn" data-sheet-roll="${esc(item.id)}">ROLL</button></div>`;
  }

  function renderSheet() {
    const c = currentCharacter();
    return `<section class="sheet-root" data-proto-id="${state.sheetStyle==='official'?'PROTO-SURF-CHAR-SHEET-OFFICIAL':'PROTO-SURF-CHAR-SHEET-SVTT'}">
      <div class="sheet-toolbar"><button class="btn quiet" data-nav="characters">← Library</button><strong>${esc(c.name)} · ${esc(c.classLine)}</strong><span class="grow"></span><button class="btn ${state.sheetStyle==='official'?'primary':''}" data-sheet-style="official">Official</button><button class="btn ${state.sheetStyle==='simplevtt'?'primary':''}" data-sheet-style="simplevtt">SimpleVTT</button><button class="btn" data-action="edit-character">Edit</button><button class="btn" data-action="level-up">Level Up</button></div>
      <div class="sheet-workspace">${state.sheetStyle==='official'?renderOfficialSheet(c):renderSimpleSheet(c)}</div>
    </section>`;
  }

  function renderOfficialSheet(c) {
    const rolls = c.rolls || F.characters[0].rolls;
    const abilities = c.abilities || F.characters[0].abilities;
    const resources = c.resources || [];
    return `<div class="sheet-paper official"><div class="sheet-identity"><div class="sheet-emblem">${esc(c.initials)}</div><div class="identity-main"><h1>${esc(c.name)}</h1><p>${esc(c.species||'Human')} · ${esc(c.classLine)} · ${esc(c.background||'—')}</p><div class="hp-bar"><span style="width:${Math.round((c.hp/c.hpMax)*100)}%"></span></div><p>HP ${c.hp}/${c.hpMax}${c.tempHp?` · Temp ${c.tempHp}`:''}</p></div><div class="stat-tile"><strong>${c.ac}</strong><span>Armor Class</span></div><div class="stat-tile"><strong>${esc(c.speed)}</strong><span>Speed</span></div><div class="stat-tile"><strong>${esc(c.initiative)}</strong><span>Initiative</span></div><div class="stat-tile"><strong>${esc(c.proficiency||'+3')}</strong><span>Proficiency</span></div></div>
      <div class="sheet-columns"><div class="sheet-column">${sheetBlock('ABILITIES',[`<div class="ability-grid">${abilities.map(([a,v,m])=>`<div class="ability"><span>${a}</span><strong>${v}</strong><span>${m}</span></div>`).join('')}</div>`])}${sheetBlock('CHECKS / SAVES',rolls.filter(r=>['skill','save','initiative'].includes(r.type)).map(sheetRollRow))}</div><div class="sheet-column">${sheetBlock('ATTACKS & DAMAGE',rolls.filter(r=>['attack','damage'].includes(r.type)).map(sheetRollRow))}${sheetBlock('FEATURES',['<div class="sheet-row"><span>Second Wind</span><strong>1 / 1</strong></div>','<div class="sheet-row"><span>Action Surge</span><strong>1 / 1</strong></div>','<div class="sheet-row"><span>Extra Attack</span><strong>Feature</strong></div>'])}${sheetBlock('COMMON DICE',rolls.filter(r=>r.type==='common').map(sheetRollRow))}</div><div class="sheet-column">${sheetBlock('RESOURCES',resources.map(r=>`<div class="sheet-row"><span>${esc(r.label)}</span><strong>${r.current}/${r.max}</strong></div>`))}${sheetBlock('TABLETOP STATUS',[`<div class="sheet-row"><span>Mode</span><strong>Offline / Standalone</strong></div>`,`<div class="sheet-row"><span>Dice</span><strong>Same-Sheet cinematic</strong></div>`,`<div class="sheet-row"><span>Role</span><strong>No DM / Player role</strong></div>`])}</div></div></div>`;
  }

  function renderSimpleSheet(c) {
    const rolls = c.rolls || F.characters[0].rolls;
    const resources = c.resources || [];
    return `<div class="sheet-paper simplevtt"><aside class="svtt-profile"><div class="svtt-profile__portrait">${esc(c.initials)}</div><h2>${esc(c.name)}</h2><p>${esc(c.classLine)} · ${esc(c.species||'Human')}</p><div class="utility-row"><strong>HP</strong><span>${c.hp}/${c.hpMax}${c.tempHp?` +${c.tempHp} Temp`:''}</span></div><div class="utility-row"><strong>AC / Speed</strong><span>${c.ac} · ${esc(c.speed)}</span></div><div class="utility-row"><strong>Conditions</strong><span>${(c.conditions||[]).join(', ')||'None'}</span></div></aside><div class="svtt-main"><section class="panel"><div class="panel__head"><h3>QUICK ROLLS</h3><span class="badge good">Same Sheet</span></div><div class="panel__body"><div class="quick-rolls">${rolls.map(r=>`<button class="btn ${['attack','damage'].includes(r.type)?'primary':''}" data-sheet-roll="${esc(r.id)}">${esc(r.label)} · ${esc(r.value)}</button>`).join('')}</div></div></section><div class="resource-cards">${resources.map(r=>`<div class="resource-card">${esc(r.label)}<strong>${r.current} / ${r.max}</strong></div>`).join('')}<div class="resource-card">Passive Perception<strong>${esc(c.passivePerception||14)}</strong></div></div><section class="panel"><div class="panel__head"><h3>ACTIONS / NOTES</h3></div><div class="panel__body"><div class="utility-list"><div class="utility-row"><strong>Main Hand</strong><span>Longsword fixture relation</span></div><div class="utility-row"><strong>Tabletop use</strong><span>Rolls, resources and current Character state remain directly reachable without Session.</span></div></div></div></section></div></div>`;
  }

  function renderBuilder(levelUp) {
    return shell('characters',`<main class="product-page"><div class="page-heading"><div><h2>${levelUp?'Level Up':'Character Create / Edit'}</h2><p>기존 canonical Character authoring flow를 visual reference로 유지합니다. UI가 rules wizard를 새로 정의하지 않습니다.</p></div><button class="btn quiet" data-nav="characters">닫기</button></div><div style="display:grid;grid-template-columns:220px minmax(0,1fr) 280px;gap:10px"><aside class="panel"><div class="panel__head"><h3>${levelUp?'PROGRESSION':'CREATION PLAN'}</h3></div><div class="panel__body"><div class="utility-list"><div class="utility-row"><strong>1 · ${levelUp?'Level Preview':'Identity'}</strong><span>authoritative plan/draft</span></div><div class="utility-row"><strong>2 · ${levelUp?'Choices':'Species / Background / Class'}</strong><span>only actual choices requested</span></div><div class="utility-row"><strong>3 · ${levelUp?'Validation':'Abilities / Proficiencies'}</strong><span>visible/recoverable validation</span></div><div class="utility-row"><strong>4 · ${levelUp?'Commit':'Equipment / Conditional choices'}</strong><span>deterministic grants automatic</span></div></div></div></aside><section class="panel"><div class="panel__head"><h3>${levelUp?'Fighter 5 → 6':'Current draft'}</h3><span class="badge good">Autosaved fixture</span></div><div class="panel__body"><div class="settings-grid"><label class="form-field">Character<input value="Rowan Ash"></label><label class="form-field">Source<select><option>Core fixture</option></select></label><label class="form-field">Choice A<select><option>Fixture choice</option></select></label><label class="form-field">Validation<input value="Valid fixture"></label></div><div class="notice" style="margin-top:10px">Prototype shows the accepted authoring structure only. Rules legality and grants remain domain-owned.</div><div style="display:flex;justify-content:flex-end;gap:6px;margin-top:12px"><button class="btn">Back</button><button class="btn primary">${levelUp?'Review & Commit':'Next'}</button></div></div></section><aside class="panel"><div class="panel__head"><h3>PREVIEW</h3></div><div class="panel__body"><div class="character-portrait" style="height:130px">RA</div><h3>Rowan Ash</h3><p class="muted" style="font-size:9px">Fighter 5 · exact draft projection</p></div></aside></div></main>`);
  }

  function renderHost() {
    return shell('session',`<main class="product-page" data-proto-id="PROTO-SURF-HOST-SETUP"><div class="page-heading"><div><h2>Host Session</h2><p>Open과 동시에 Host/DM의 live Freeform Session이 시작됩니다.</p></div></div><div class="entry-layout"><section class="entry-card"><div><span class="badge dm">HOST = DM</span><h3>새 live Session 열기</h3><p>Lobby/Ready/Start gate가 없습니다. Player가 아직 없어도 DM은 바로 준비·플레이를 시작합니다.</p></div><label class="form-field">Session name<input value="Glass Lantern Demo"></label><label class="form-field">Listen / connection info<input value="Local host fixture"></label><button class="btn primary" data-action="open-live-session">Open Session · 바로 Live</button></section><section class="panel"><div class="panel__head"><h3>Open 시점</h3></div><div class="panel__body"><div class="utility-list"><div class="utility-row"><strong>Content snapshot</strong><span>현재 구성 캡처 · live 중 local library 변경으로 변하지 않음</span></div><div class="utility-row"><strong>Players</strong><span>0명도 정상 live state</span></div><div class="utility-row"><strong>Initial mode</strong><span>Freeform</span></div></div></div></section></div></main>`);
  }

  function renderJoin() {
    const blocked = !!state.noCharacter;
    return shell('session',`<main class="product-page" data-proto-id="PROTO-SURF-JOIN-SETUP"><div class="page-heading"><div><h2>Join Session</h2><p>Host 연결 정보와 자신의 local Character를 선택해 이미 live인 Session에 참가합니다.</p></div></div><div class="entry-layout"><section class="entry-card"><div><span class="badge ally">CLIENT = PLAYER</span><h3>진행 중인 Session 참가</h3><p>Ready Lobby 없이 현재 live mode로 들어갑니다.</p></div><label class="form-field">Host address<input value="192.168.0.24:7777"></label><label class="form-field">Character<select ${blocked?'disabled':''}><option>${blocked?'No valid Character':'Rowan Ash'}</option></select></label>${blocked?'<div class="notice warn">참가할 Character가 없습니다. Create 또는 Import 후 Join을 다시 시도하세요.</div>':'<div class="notice">Content / Character synchronization 상태가 필요하면 이 단계 안에서 짧게 표시됩니다.</div>'}<div style="display:flex;gap:6px">${blocked?'<button class="btn primary" data-action="new-character">Create Character</button><button class="btn" data-action="import-character">Import Character</button>':'<button class="btn primary" data-action="join-live-session">Join Current Live Session</button>'}</div></section><section class="panel"><div class="panel__head"><h3>Join contract</h3></div><div class="panel__body"><div class="utility-list"><div class="utility-row"><strong>Connection role</strong><span>Client</span></div><div class="utility-row"><strong>Play role</strong><span>Player</span></div><div class="utility-row"><strong>Target</strong><span>current authoritative live state</span></div></div></div></section></div></main>`);
  }

  function actorEligibility(id) {
    if (!state.action) return null;
    return F.targetEligibility[state.action]?.[id] || null;
  }

  function renderActorCard(a) {
    const eligibility = actorEligibility(a.id);
    const targetSelected = state.selectedTargets.includes(a.id);
    const controlled = state.view === 'player' ? a.id === 'rowan' : state.controlActorId === a.id;
    const current = state.mode === 'initiative' && state.currentTurnActorId === a.id;
    const classes = [a.relation,controlled?'controlled':'',current?'current':'',eligibility?.valid?'valid':'',eligibility && !eligibility.valid?'invalid':'',targetSelected?'target-selected':''].filter(Boolean).join(' ');
    const hpDisplay = a.hp == null ? '—' : `${a.hp}/${a.hpMax}${a.tempHp?` +${a.tempHp}`:''}`;
    const pct = a.hp == null ? 0 : Math.round((a.hp/a.hpMax)*100);
    return `<button class="actor-card ${classes}" data-actor="${esc(a.id)}" aria-label="${esc(a.name)}"><div class="actor-avatar">${esc(a.initials)}</div><div class="actor-card__body"><strong>${esc(a.name)}</strong><div class="actor-meta"><span>${esc(a.relation.toUpperCase())}</span><span>HP ${esc(hpDisplay)}</span>${a.conditions.map(c=>`<span>${esc(c)}</span>`).join('')}</div>${a.hp==null?'':`<div class="actor-hp"><span style="width:${pct}%"></span></div>`}</div></button>`;
  }

  function renderActorBoard(kind) {
    const list = F.actors.filter(a => kind === 'allied' ? a.relation === 'allied' : a.relation !== 'allied');
    return `<div class="actor-board ${kind}" data-proto-id="PROTO-SURF-ACTOR-BOARDS">${list.map(renderActorCard).join('')}</div>`;
  }

  function renderInitiative() {
    if (state.mode !== 'initiative') return '';
    return `<div class="initiative-strip">${F.initiativeOrder.map(([id,num])=>{const a=actor(id);return `<div class="init-entry ${state.currentTurnActorId===id?'current':''}"><span>${num}</span><strong>${esc(a?.name||id)}</strong></div>`}).join('')}</div>`;
  }

  function stageFocusContent() {
    const cap = capability(state.action);
    if (state.resolution === 'resolving') return { eyebrow:'RESOLVING', title:cap?.label||'Action submitted', body:'Authoritative resolution is active. Only fixture-declared conflicting controls are unavailable; the Play skeleton remains.' };
    if (state.resolution === 'interrupt') return { eyebrow:'RESPONSE REQUIRED', title:'Reaction / Interrupt', body:'Required response is focused here without replacing Actor Boards or the Command Center.' };
    if (state.resolution === 'concentration') return { eyebrow:'RESPONSE REQUIRED', title:'Concentration Save', body:'The prototype presents a fixture response only. DC, modifier and legality are not calculated by UI.' };
    if (state.action) return { eyebrow:'TARGETING', title:cap?.label||'Selected capability', body:cap?.targetMode==='multi'?'Select eligible Actor Cards, then Execute. No AoE map template is used.':'Choose an eligible Actor Card. Invalid reasons come from fixture authority.' };
    if (state.mode === 'initiative') return { eyebrow:'INITIATIVE', title:'Actor and action context, not a battlemap', body:'The compact tracker and authoritative turn economy are active. Actor identity and targets remain in the boards above and below.' };
    return { eyebrow:'FREEFORM', title:'Mapless shared play context', body:'Current interaction, notices, dice, result and Handout presentation use this space. Actors are never placed here as tactical tokens.' };
  }

  function renderStageNotices() {
    const notices = [];
    if (state.connection === 'reconnecting') notices.push(['warn','연결을 복구 중입니다. 현재 Session context와 열린 Sheet를 유지합니다.']);
    if (state.visibility === 'dm-only' && state.view === 'dm') notices.push(['dm','DM Only 활성 · Player projection에는 private event 존재 자체가 포함되지 않습니다.']);
    if (state.snapshotNotice) notices.push(['warn','Live Session은 snapshot 1.2.0을 유지합니다. Local update 1.3.0은 다음 Session부터 적용됩니다.']);
    if (state.notice) notices.push(['',state.notice]);
    return notices.length?`<div class="stage-notices">${notices.map(([c,t])=>`<div class="notice ${c}">${esc(t)}</div>`).join('')}</div>`:'';
  }

  function renderResolutionOverlay() {
    if (state.resolution === 'interrupt') return `<section class="resolution-panel"><div class="resolution-panel__head"><span class="badge warn">Reaction / Interrupt</span><strong>Fixture response requested</strong></div><div class="resolution-panel__body"><div class="notice">현재 Play context를 유지한 채 필요한 응답만 강조합니다. Timeout은 UI가 임의로 만들지 않습니다.</div><div class="resolution-options"><button class="resolution-option" data-action="resolve-response"><strong>Use Reaction</strong><span>fixture response path</span></button><button class="resolution-option" data-action="resolve-response"><strong>Decline</strong><span>return to current resolution</span></button></div></div></section>`;
    if (state.resolution === 'concentration') return `<section class="resolution-panel"><div class="resolution-panel__head"><span class="badge warn">Concentration</span><strong>Save response fixture</strong></div><div class="resolution-panel__body"><div class="notice">UI는 DC나 modifier를 계산하지 않습니다. 이 입력과 결과는 review fixture입니다.</div><div style="display:flex;gap:6px"><input value="13" aria-label="Fixture d20 result" style="height:34px;flex:1;border:1px solid var(--line);background:#0f151a;padding:0 8px"><button class="btn primary" data-action="resolve-response">Submit</button></div></div></section>`;
    return '';
  }

  function renderConnectedDice() {
    if (state.resolution !== 'dice' || !state.connectedRoll) return '';
    const r = F.connectedRolls[state.connectedRoll];
    if (!r) return '';
    return `<div class="stage-dice-layer"><div class="stage-dice-flight">${r.dice.map(d=>`<div class="die">${d.face}</div>`).join('')}</div></div>`;
  }

  function renderResult() {
    if (state.resolution !== 'result' || !state.connectedRoll) return '';
    const r = F.connectedRolls[state.connectedRoll];
    return `<div class="stage-result"><strong>${esc(r.label)} · ${esc(r.total)}</strong><span>${esc(r.notation)} · ${esc(r.detail)} · Activity에서 detail 확인</span></div>`;
  }

  function renderHandout() {
    if (!state.handout || state.handoutLocalDismissed) return '';
    const art = `<div class="handout-art" aria-label="Synthetic letter handout"></div>`;
    if (state.handout === 'overlay') return `<div class="handout-overlay"><div class="handout-toolbar"><button class="btn" data-action="dismiss-handout">로컬 숨기기</button></div>${art}</div>`;
    if (state.handout === 'upper') return `<div class="handout-upper"><div class="handout-toolbar"><span class="badge warn">DM controlled · Upper</span></div>${art}</div>`;
    return `<div class="handout-full"><div class="handout-toolbar"><button class="btn">−</button><button class="btn">+</button><span class="badge warn">DM controlled · Full</span></div>${art}</div>`;
  }

  function renderMaplessStage() {
    const focus = stageFocusContent();
    const cap = capability(state.action);
    const chips = [];
    if (cap) chips.push(`<span class="stage-chip">Capability <strong>${esc(cap.label)}</strong></span>`);
    if (state.selectedTargets.length) chips.push(`<span class="stage-chip">Targets <strong>${state.selectedTargets.length}</strong></span>`);
    if (!cap && state.mode==='freeform') chips.push('<span class="stage-chip">Actor context <strong>Boards</strong></span>','<span class="stage-chip">Dice / Result <strong>Center Stage</strong></span>','<span class="stage-chip">Spatial facts <strong>DM pane only</strong></span>');
    const execute = cap?.targetMode==='multi' && state.selectedTargets.length ? `<div class="target-banner">${state.selectedTargets.length} Actor 선택됨 · 아래 Command Center의 Execute로 제출</div>` : state.action ? `<div class="target-banner">Actor Card를 선택하세요 · map position은 사용하지 않습니다.</div>` : '';
    return `<section class="mapless-stage" data-proto-id="PROTO-SURF-MAPLESS-PLAY-CONTEXT"><div class="stage-label"><strong>MAPLESS PLAY CONTEXT</strong><span>no grid · no map token · no Actor coordinates</span></div>${renderInitiative()}${renderStageNotices()}${execute}<div class="stage-focus"><div class="stage-focus__eyebrow">${esc(focus.eyebrow)}</div><h2>${esc(focus.title)}</h2><p>${esc(focus.body)}</p><div class="stage-focus__chips">${chips.join('')}</div></div>${renderHandout()}${renderResolutionOverlay()}${renderConnectedDice()}${renderResult()}</section>`;
  }

  function visibleCapabilities() {
    if (state.hotbarPage === 'Mixed') return F.capabilities;
    return F.capabilities.filter(c => c.page === state.hotbarPage || (state.hotbarPage === 'Custom' && c.page === 'Custom'));
  }

  function renderHotbarSlot(c) {
    const unavailable = !c.available || (c.id==='main-hand' && state.mainHandUnavailable);
    const reason = c.id==='main-hand' && state.mainHandUnavailable ? 'Fixture: canonical Main Hand action unavailable. No smart fallback.' : c.unavailableReason || '';
    return `<button class="hotbar-slot ${state.action===c.id?'selected':''} ${unavailable?'unavailable':''} ${state.resolution&&state.action===c.id?'resolving':''}" data-capability="${esc(c.id)}" data-unavailable-reason="${esc(reason)}"><span class="slot-cost">${esc(c.cost.join(' · '))}</span><span class="slot-glyph">${esc(c.glyph)}</span><span class="slot-label">${esc(c.label)}</span></button>`;
  }

  function renderCommandCenter() {
    const c = currentCharacter();
    const cap = capability(state.action);
    const multiReady = cap?.targetMode === 'multi' && state.selectedTargets.length > 0;
    const economy = state.mode==='initiative' ? `<div class="economy-row"><div class="economy-chip"><span class="economy-gem"></span>Action</div><div class="economy-chip"><span class="economy-gem"></span>Bonus</div><div class="economy-chip"><span class="economy-gem"></span>Reaction</div><div class="economy-chip"><span class="economy-gem"></span>Movement</div></div>` : `<div class="economy-row"><div class="economy-chip freeform">FREEFORM · no turn economy</div></div>`;
    return `<section class="command-center" data-proto-id="PROTO-SURF-COMMAND-CENTER"><div class="command-top">${economy}<div class="resource-rail">${(c.resources||[]).map(r=>`<div class="resource-pill"><span>${esc(r.label)}</span><strong>${r.current}/${r.max}</strong></div>`).join('')}<div class="resource-pill"><span>Item Charge</span><strong>2/3</strong></div></div></div><div class="command-body"><div class="controlled-actor"><div class="controlled-portrait">${esc(c.initials)}</div><div class="controlled-info"><strong>${esc(c.name)}</strong><p>${esc(c.classLine)} · Controlled Actor</p><div class="actor-hp"><span style="width:${Math.round((c.hp/c.hpMax)*100)}%"></span></div><p>HP ${c.hp}/${c.hpMax}${c.tempHp?` +${c.tempHp} Temp`:''}${(c.conditions||[]).length?` · ${esc(c.conditions.join(', '))}`:''}</p></div></div><div class="hotbar"><div class="hotbar-tabs">${['Mixed','Action','Spell','Item','Custom'].map(p=>`<button class="hotbar-tab ${state.hotbarPage===p?'active':''}" data-hotbar-page="${p}">${p}</button>`).join('')}</div><div class="hotbar-slots">${visibleCapabilities().map(renderHotbarSlot).join('')}</div></div><div class="command-context">${state.action?'<button class="btn quiet" data-action="cancel-action">취소</button>':''}${multiReady?`<button class="btn primary" data-action="execute-multi">Execute · ${state.selectedTargets.length}</button>`:''}${state.mode==='initiative'?'<button class="btn primary" data-action="end-turn">End Turn</button>':'<button class="btn">Context</button>'}</div></div></section>`;
  }

  function renderPlayChrome() {
    const role = state.view==='dm'?'HOST · DM':'CLIENT · PLAYER';
    const conn = state.connection==='reconnecting'?'<span class="badge warn">Reconnecting</span>':'<span class="badge good">Connected</span>';
    return `<header class="play-chrome"><button class="chrome-btn" data-nav="home">← Product</button><div class="play-chrome__title"><strong>Glass Lantern Demo</strong><span>${role}</span></div>${conn}<div class="play-spacer"></div>${state.view==='dm'?`<button class="chrome-btn ${state.visibility==='dm-only'?'dm':'active'}" data-action="toggle-visibility">${state.visibility==='dm-only'?'◐ DM Only':'◉ Public'}</button>`:''}<button class="chrome-btn ${state.utility==='activity'?'active':''}" data-utility="activity">Activity</button>${state.view==='dm'?`<button class="chrome-btn ${state.utility==='encounter'?'active':''}" data-utility="encounter">Encounter</button><button class="chrome-btn ${state.utility==='participants'?'active':''}" data-utility="participants">Participants</button><button class="chrome-btn ${state.utility==='session'?'active':''}" data-utility="session">Session</button><button class="chrome-btn ${state.utility==='spatial'?'active':''}" data-utility="spatial">Spatial Facts</button>`:`<button class="chrome-btn ${state.utility==='session'?'active':''}" data-utility="session">Session</button>`}</header>`;
  }

  function renderActivity() {
    const list = state.view==='dm' ? F.activityDM : F.activityPlayer;
    const filtered = list.filter(item => state.activityFilter==='all' || state.activityFilter==='public'&&item.visibility==='public' || state.activityFilter==='private'&&item.visibility==='dm-only');
    return `<div class="utility-tabs"><button class="btn ${state.activityFilter==='all'?'primary':''}" data-activity-filter="all">All</button><button class="btn ${state.activityFilter==='public'?'primary':''}" data-activity-filter="public">Public</button>${state.view==='dm'?`<button class="btn ${state.activityFilter==='private'?'primary':''}" data-activity-filter="private">DM Only</button>`:''}</div>${filtered.map(item=>`<article class="activity-item ${item.visibility==='dm-only'?'dm-only':''}"><time>${esc(item.time)}</time><strong>${esc(item.title)}${item.visibility==='dm-only'?' · DM Only':''}</strong><p>${esc(item.detail)}</p></article>`).join('')}`;
  }

  function renderUtility() {
    if (!state.utility) return '';
    let title = 'Utility';
    let body = '';
    if (state.utility==='activity') { title='Activity'; body=renderActivity(); }
    if (state.utility==='encounter') { title='Encounter / Combatants'; body=`<div class="utility-list"><div class="utility-row"><strong>Current encounter</strong><span>8 Actor fixtures · Actor facts only, no map positions.</span></div><div class="utility-row"><strong>Mode</strong><span>${esc(state.mode)}</span></div><button class="btn primary" data-action="toggle-mode">${state.mode==='initiative'?'End Initiative':'Start Initiative'}</button></div>`; }
    if (state.utility==='participants') { title='Participants'; body=`<div class="utility-list"><div class="utility-row"><strong>Demo DM</strong><span>Host · DM · connected</span></div><div class="utility-row"><strong>Mina</strong><span>Client · Player · controls Mina Vale</span></div><div class="utility-row"><strong>Late join</strong><span>Allowed into current live state.</span></div></div>`; }
    if (state.utility==='session') { title=state.view==='dm'?'Session Share':'Player Session'; body=`<div class="utility-list"><div class="utility-row"><strong>Connection</strong><span>${esc(state.connection)}</span></div><div class="utility-row"><strong>Content snapshot</strong><span>1.2.0 · fixed for this live Session</span></div><div class="utility-row"><strong>Core map</strong><span>None · mapless Session</span></div>${state.view==='player'?'<button class="btn">Leave Session</button>':'<button class="btn">Copy connection info</button>'}</div>`; }
    if (state.utility==='spatial') { title='Advanced Spatial Facts'; const s=F.spatialFacts; body=`<div class="spatial-form"><label>Actor A<select><option>${esc(actor(s.actorAId)?.name)}</option></select></label><label>Actor B<select><option>${esc(actor(s.actorBId)?.name)}</option></select></label><label>Distance<input value="${esc(s.distanceDisplay)}"></label><label>Visibility<select><option>${esc(s.visibilityState)}</option></select></label><label>Cover<select><option>${esc(s.coverState)}</option></select></label><label>Fact source<input value="Manual DM fact"></label></div><div class="notice warn" style="margin-top:9px">${esc(s.manualFactNote)}</div>`; }
    return `<aside class="utility-pane"><div class="utility-resize" data-resize-handle></div><div class="utility-pane__head"><strong>${esc(title)}</strong><button class="chrome-btn" data-utility="none">Close</button></div><div class="utility-pane__body">${body}</div></aside>`;
  }

  function renderFullSheetLayer() {
    if (!state.fullSheet) return '';
    return `<section class="full-sheet-layer"><div class="full-sheet-layer__head"><strong>Full Character Sheet · live Session remains active behind this layer</strong><button class="chrome-btn" data-action="close-full-sheet">Return to Play</button></div><div class="full-sheet-layer__body"><div class="full-sheet-content"><section class="panel"><div class="panel__head"><h3>Rowan Ash</h3></div><div class="panel__body"><div class="character-portrait" style="height:120px">RA</div><div class="utility-row" style="margin-top:8px"><strong>HP</strong><span>38/44 +4 Temp</span></div></div></section><section class="panel"><div class="panel__head"><h3>Actions / Features</h3></div><div class="panel__body"><div class="utility-list"><div class="utility-row"><strong>Main Hand Strike</strong><span>fixture relation</span></div><div class="utility-row"><strong>Second Wind</strong><span>1/1</span></div><div class="utility-row"><strong>Action Surge</strong><span>1/1</span></div></div></div></section><section class="panel"><div class="panel__head"><h3>Session continuity</h3></div><div class="panel__body"><div class="notice ${state.connection==='reconnecting'?'warn':''}">${state.connection==='reconnecting'?'Reconnecting · Full Sheet remains visible.':'Connected · live state preserved.'}</div></div></section></div></div></section>`;
  }

  function renderContextMenu() {
    const cm = state.contextMenu;
    if (!cm) return '';
    const a = actor(cm.actorId);
    if (!a) return '';
    return `<div class="context-menu" style="left:${cm.x}px;top:${cm.y}px"><button data-context="inspect">Inspect ${esc(a.name)}</button><button data-context="focus">Set context focus</button>${state.view==='dm'?'<button data-context="control">Set DM control focus</button>':''}<button data-context="close">Close</button></div>`;
  }

  function renderPlay() {
    state.liveSession = true;
    return `<section class="play-root" data-proto-id="${state.view==='dm'?'PROTO-SURF-PLAY-DM':'PROTO-SURF-PLAY-PLAYER'}-${state.mode.toUpperCase()}">${renderPlayChrome()}<div class="play-main"><div class="play-core">${renderActorBoard('opposing')}${renderMaplessStage()}${renderActorBoard('allied')}</div>${renderUtility()}</div>${renderCommandCenter()}${renderFullSheetLayer()}${renderContextMenu()}</section>`;
  }

  function renderContent() {
    return shell('content',`<main class="product-page" data-proto-id="PROTO-SURF-CONTENT"><div class="page-heading"><div><h2>콘텐츠 / Add-ons</h2><p>지원되는 declarative SimpleVTT package를 관리합니다. Runtime executable plugin을 암시하지 않습니다.</p></div><button class="btn primary" data-nav="content-import">Add / Import</button></div><div class="content-grid">${F.packages.map(p=>`<article class="content-card"><div style="display:flex;justify-content:space-between;gap:8px"><h3>${esc(p.name)}</h3><span class="badge ${p.status==='installed'?'good':p.status==='disabled'?'warn':'hostile'}">${esc(p.status)}</span></div><p>Version ${esc(p.version)}${p.nextVersion?` · update ${esc(p.nextVersion)} available`:''}</p>${p.sessionSnapshotVersion?`<div class="notice">Live snapshot ${esc(p.sessionSnapshotVersion)} remains stable.</div>`:''}${p.reason?`<div class="notice warn">${esc(p.reason)}</div>`:''}<div class="content-actions"><button class="btn">Update</button><button class="btn">Replace</button><button class="btn">${p.status==='disabled'?'Enable':'Disable'}</button><button class="btn danger">Delete</button></div></article>`).join('')}</div></main>`);
  }

  function renderContentImport() {
    return shell('content',`<main class="product-page" data-proto-id="PROTO-SURF-CONTENT-IMPORT"><div class="page-heading"><div><h2>Package Import Review</h2><p>Preview → validation → explicit install. Validation truth is fixture-provided.</p></div><button class="btn quiet" data-nav="content">Cancel</button></div><div class="import-layout"><section class="panel"><div class="panel__head"><h3>Ember Toolkit 1.3.0</h3><span class="badge good">Supported format</span></div><div class="panel__body"><div class="validation-item good"><div class="validation-icon">✓</div><div><strong>Structure valid</strong><p>Required fixture fields present.</p></div></div><div class="validation-item good"><div class="validation-icon">✓</div><div><strong>Preview ready</strong><p>Declarative records can be reviewed before install.</p></div></div><div class="validation-item warn"><div class="validation-icon">!</div><div><strong>Existing package detected</strong><p>Update changes local library for future Sessions; current live snapshot remains unchanged.</p></div></div><div class="validation-item block"><div class="validation-icon">×</div><div><strong>Blocking example</strong><p>Unsupported executable mechanic would block instead of being approximated.</p></div></div></div></section><aside class="panel"><div class="panel__head"><h3>Install summary</h3></div><div class="panel__body"><div class="utility-list"><div class="utility-row"><strong>Current</strong><span>1.2.0</span></div><div class="utility-row"><strong>Incoming</strong><span>1.3.0</span></div><div class="utility-row"><strong>Live Session</strong><span>still 1.2.0 snapshot</span></div></div><button class="btn primary" style="margin-top:9px">Install / Update</button></div></aside></div></main>`);
  }

  function renderRules() {
    return shell('rules',`<main class="product-page" data-proto-id="PROTO-SURF-RULES"><div class="page-heading"><div><h2>Rules Browser</h2><p>Composed authoritative catalog를 검색/열람하는 UI입니다.</p></div></div><div class="rules-layout"><section class="panel"><div class="panel__head"><h3>Search</h3></div><div class="panel__body"><label class="form-field">Query<input value="grapple"></label><button class="btn primary" style="margin-top:7px">Search</button><div class="utility-list" style="margin-top:9px"><div class="utility-row"><strong>Grappling</strong><span>Core Rules · fixture result</span></div><div class="utility-row"><strong>Escaping a Grapple</strong><span>Related rule · fixture result</span></div></div></div></section><section class="panel"><div class="panel__head"><h3>Grappling</h3><span class="badge">Core Rules</span></div><div class="panel__body"><p style="font-size:10px;line-height:1.7;color:var(--text-2);margin:0">Prototype text only. Final UI presents authoritative composed rule content and never derives rules from layout or display order.</p></div></section></div></main>`);
  }

  function renderSettings() {
    return shell('settings',`<main class="product-page" data-proto-id="PROTO-SURF-SETTINGS"><div class="page-heading"><div><h2>설정</h2><p>Appearance, Sheet presentation, accessibility와 Tutorial 재열기.</p></div></div><div class="settings-grid"><section class="panel"><div class="panel__head"><h3>Appearance</h3></div><div class="panel__body"><div class="utility-list"><div class="utility-row"><strong>Theme</strong><span>Dark prototype default</span></div><div class="utility-row"><strong>Default Character Sheet</strong><span>${state.sheetStyle==='official'?'Official-style':'SimpleVTT'} · presentation only</span></div></div></div></section><section class="panel"><div class="panel__head"><h3>Accessibility / Help</h3></div><div class="panel__body"><label class="control-check"><input type="checkbox" ${state.reducedMotion?'checked':''} data-action="settings-reduced-motion"> <span>Reduced Motion</span></label><button class="btn" data-action="open-tutorial">Tutorial 다시 보기</button></div></section></div></main>`);
  }

  function renderComponents() {
    const sample = F.actors[4];
    return `<main class="gallery" data-proto-id="PROTO-SCN-34"><div class="page-heading"><div><h2>Component / State Gallery</h2><p>Mapless product primitives. Prototype Controls are excluded.</p></div><button class="btn" data-review-jump="PROTO-SCN-08">Open Play</button></div><div class="gallery-grid"><section class="gallery-section"><h3>Buttons</h3><div class="gallery-row"><button class="btn primary">Primary</button><button class="btn">Secondary</button><button class="btn quiet">Quiet</button><button class="btn danger">Destructive</button></div></section><section class="gallery-section"><h3>Badges</h3><div class="gallery-row"><span class="badge good">Connected</span><span class="badge dm">DM Only</span><span class="badge ally">Allied</span><span class="badge hostile">Hostile</span></div></section><section class="gallery-section"><h3>Actor Card · list object</h3><div class="gallery-row" style="width:100%">${renderActorCard(sample)}</div></section><section class="gallery-section"><h3>Hotbar</h3><div class="gallery-row">${F.capabilities.slice(0,3).map(renderHotbarSlot).join('')}</div></section><section class="gallery-section"><h3>Dice primitive</h3><div class="gallery-row"><div class="die">17</div><span class="muted" style="font-size:9px">presentation only</span></div></section><section class="gallery-section"><h3>Mapless guard</h3><div class="notice">Actor coordinates / map tokens / tactical grid are not product components.</div></section></div></main>`;
  }

  function runStandaloneRoll(id) {
    const r = F.standaloneRolls[id];
    const workspace = root.querySelector('.sheet-workspace');
    if (!r || !workspace) return;
    removeSheetDice();
    sheetDiceLayer = document.createElement('div');
    sheetDiceLayer.className = 'sheet-dice-layer';
    sheetDiceLayer.setAttribute('aria-label','Standalone dice rolling over the current Character Sheet');
    sheetDiceLayer.innerHTML = `<div class="dice-flight"><div class="die">${esc(r.finalFaces[0])}</div></div><div class="sheet-roll-result"><strong>${esc(r.label)}</strong><span>${esc(r.notation)} · 같은 Sheet 안에서 굴리는 중</span></div>`;
    workspace.appendChild(sheetDiceLayer);
    const reduced = state.reducedMotion;
    sheetSettleTimer = setTimeout(()=>{
      const flight = sheetDiceLayer?.querySelector('.dice-flight');
      flight?.classList.add('settled');
      const result = sheetDiceLayer?.querySelector('.sheet-roll-result');
      if (result) result.innerHTML = `<strong>${esc(r.label)} · ${esc(r.result)}</strong><span>${esc(r.notation)} · ${esc(r.detail)}</span>`;
    },reduced?20:1020);
    sheetClearTimer = setTimeout(()=>removeSheetDice(),reduced?1800:3000);
  }

  function showTooltipFor(el,event) {
    const c = capability(el.dataset.capability);
    if (!c) return;
    clearTooltip();
    tooltip = document.createElement('div');
    tooltip.className = 'rich-tooltip';
    const unavailable = el.dataset.unavailableReason;
    tooltip.innerHTML = `<strong>${esc(c.label)} · ${esc(c.cost.join(' · '))}</strong><p>${esc(c.summary)}${unavailable?` ${esc(unavailable)}`:''}</p>`;
    document.body.appendChild(tooltip);
    moveTooltip(event);
  }

  function moveTooltip(event) {
    if (!tooltip) return;
    const x = Math.min(event.clientX+13,window.innerWidth-300);
    const y = Math.min(event.clientY+13,window.innerHeight-145);
    tooltip.style.left = `${Math.max(8,x)}px`;
    tooltip.style.top = `${Math.max(8,y)}px`;
  }

  function actorClick(id) {
    const a = actor(id);
    if (!a) return;
    if (state.action) {
      const c = capability(state.action);
      const e = actorEligibility(id);
      if (e && !e.valid) { state.notice = e.reason || 'Fixture: target unavailable.'; render(); return; }
      if (c?.targetMode === 'single' && e?.valid) { startConnectedResolution(state.action,[id]); return; }
      if (c?.targetMode === 'multi' && e?.valid) {
        state.selectedTargets = state.selectedTargets.includes(id) ? state.selectedTargets.filter(x=>x!==id) : [...state.selectedTargets,id];
        state.notice = null;
        render();
        return;
      }
    }
    if (!state.action && a.relation === 'hostile') {
      if (state.mainHandUnavailable) { state.notice = 'Fixture: canonical Main Hand action is unavailable. No smart fallback.'; render(); return; }
      const e = F.targetEligibility['main-hand']?.[id];
      if (e?.valid) { startConnectedResolution('main-hand',[id]); return; }
    }
    state.controlActorId = state.view==='dm' ? id : state.controlActorId;
    state.notice = `Context focus: ${a.name}`;
    render();
  }

  function capabilityClick(id,el) {
    const c = capability(id);
    if (!c) return;
    const reason = el?.dataset.unavailableReason;
    if (!c.available || reason) { state.notice = reason || c.unavailableReason || 'Fixture unavailable.'; render(); return; }
    if (c.targetMode === 'self' || c.targetMode === 'none') {
      state.action = id;
      state.selectedTargets = [];
      state.notice = `${c.label} · fixture ${c.targetMode} capability selected.`;
      render();
      return;
    }
    state.action = state.action===id?null:id;
    state.selectedTargets = [];
    state.notice = null;
    render();
  }

  function startConnectedResolution(actionId,targetIds) {
    [connectedTimerA,connectedTimerB,connectedTimerC].forEach(t=>t&&clearTimeout(t));
    state.action = actionId;
    state.selectedTargets = [...targetIds];
    state.resolution = 'resolving';
    state.notice = 'Action submitted · Play skeleton remains visible.';
    render();
    connectedTimerA = setTimeout(()=>{
      state.resolution = 'dice';
      state.connectedRoll = 'attack';
      state.notice = null;
      render();
    },state.reducedMotion?120:650);
    connectedTimerB = setTimeout(()=>{
      state.resolution = 'result';
      render();
    },state.reducedMotion?500:1850);
    connectedTimerC = setTimeout(()=>{
      state.resolution = null;
      state.connectedRoll = null;
      state.action = null;
      state.selectedTargets = [];
      render();
    },state.reducedMotion?2200:3900);
  }

  function handleNav(dest) {
    resetTransient();
    if (dest==='play') { state.surface='play'; if(state.view==='offline')state.view='player'; state.liveSession=true; }
    else if (dest==='home') { state.surface='home'; state.view='offline'; }
    else if (dest==='characters') { state.surface='characters'; state.view='offline'; }
    else if (dest==='session') { state.surface='host'; state.view='offline'; }
    else if (dest==='content') { state.surface='content'; state.view='offline'; }
    else if (dest==='content-import') { state.surface='content-import'; state.view='offline'; }
    else if (dest==='rules') { state.surface='rules'; state.view='offline'; }
    else if (dest==='settings') { state.surface='settings'; state.view='offline'; }
    render();
  }

  root.addEventListener('click',event=>{
    const sheetRoll = event.target.closest('[data-sheet-roll]');
    if (sheetRoll) { event.preventDefault(); event.stopImmediatePropagation(); runStandaloneRoll(sheetRoll.dataset.sheetRoll); return; }

    const nav = event.target.closest('[data-nav]');
    if (nav) { handleNav(nav.dataset.nav); return; }

    const openCharacter = event.target.closest('[data-open-character]');
    if (openCharacter) { state.selectedCharacterId=openCharacter.dataset.openCharacter; state.surface='sheet'; state.view='offline'; render(); return; }

    const sheetStyle = event.target.closest('[data-sheet-style]');
    if (sheetStyle) { state.sheetStyle=sheetStyle.dataset.sheetStyle; render(); return; }

    const tutorialSheet = event.target.closest('[data-tutorial-sheet]');
    if (tutorialSheet) { state.tutorialChoice=tutorialSheet.dataset.tutorialSheet; render(); return; }

    const actorEl = event.target.closest('[data-actor]');
    if (actorEl) { actorClick(actorEl.dataset.actor); return; }

    const capEl = event.target.closest('[data-capability]');
    if (capEl) { capabilityClick(capEl.dataset.capability,capEl); return; }

    const page = event.target.closest('[data-hotbar-page]');
    if (page) { state.hotbarPage=page.dataset.hotbarPage; render(); return; }

    const util = event.target.closest('[data-utility]');
    if (util) { const u=util.dataset.utility; state.utility = u==='none'||state.utility===u?null:u; render(); return; }

    const filter = event.target.closest('[data-activity-filter]');
    if (filter) { state.activityFilter=filter.dataset.activityFilter; render(); return; }

    const jump = event.target.closest('[data-review-jump]');
    if (jump) { applyScenario(jump.dataset.reviewJump); return; }

    const context = event.target.closest('[data-context]');
    if (context) {
      if (context.dataset.context==='control' && state.contextMenu) state.controlActorId=state.contextMenu.actorId;
      state.contextMenu=null;
      render();
      return;
    }

    const action = event.target.closest('[data-action]');
    if (!action) return;
    switch(action.dataset.action) {
      case 'complete-tutorial': state.sheetStyle=state.tutorialChoice; state.surface='home'; state.view='offline'; state.scenarioId='PROTO-SCN-02'; render(); break;
      case 'open-tutorial': state.surface='tutorial'; state.view='offline'; state.scenarioId='PROTO-SCN-01'; state.tutorialChoice=state.sheetStyle; render(); break;
      case 'new-character': state.surface='builder'; state.view='offline'; render(); break;
      case 'import-character': state.surface='builder'; state.view='offline'; render(); break;
      case 'edit-character': state.surface='builder'; render(); break;
      case 'level-up': state.surface='levelup'; render(); break;
      case 'open-live-session': state.surface='play'; state.view='dm'; state.mode='freeform'; state.liveSession=true; state.scenarioId='PROTO-SCN-08'; render(); break;
      case 'join-live-session': state.surface='play'; state.view='player'; state.mode='freeform'; state.liveSession=true; state.scenarioId='PROTO-SCN-09'; render(); break;
      case 'toggle-visibility': state.visibility=state.visibility==='public'?'dm-only':'public'; render(); break;
      case 'toggle-mode': state.mode=state.mode==='initiative'?'freeform':'initiative'; state.currentTurnActorId='rowan'; render(); break;
      case 'cancel-action': state.action=null; state.selectedTargets=[]; state.notice=null; render(); break;
      case 'execute-multi': if(state.action&&state.selectedTargets.length)startConnectedResolution(state.action,state.selectedTargets); break;
      case 'end-turn': state.currentTurnActorId=state.currentTurnActorId==='rowan'?'raider':'rowan'; render(); break;
      case 'resolve-response': state.resolution='dice'; state.connectedRoll=state.resolution==='concentration'?'concentration':'attack'; render(); break;
      case 'dismiss-handout': state.handoutLocalDismissed=true; render(); break;
      case 'close-full-sheet': state.fullSheet=false; render(); break;
      case 'settings-reduced-motion': state.reducedMotion=!state.reducedMotion; render(); break;
    }
  });

  root.addEventListener('contextmenu',event=>{
    const a = event.target.closest('[data-actor]');
    if (!a) return;
    event.preventDefault();
    state.contextMenu={actorId:a.dataset.actor,x:Math.min(event.clientX,window.innerWidth-200),y:Math.min(event.clientY,window.innerHeight-140)};
    render();
  });

  root.addEventListener('pointerover',event=>{
    const el = event.target.closest('[data-capability]');
    if (!el) return;
    showTooltipFor(el,event);
  });

  root.addEventListener('pointermove',event=>{ if(tooltip)moveTooltip(event); });
  root.addEventListener('pointerout',event=>{
    const el = event.target.closest('[data-capability]');
    if (!el) return;
    if (event.relatedTarget && el.contains(event.relatedTarget)) return;
    clearTooltip();
  });

  root.addEventListener('focusin',event=>{
    const el = event.target.closest('[data-capability]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    showTooltipFor(el,{clientX:r.right,clientY:r.top});
  });
  root.addEventListener('focusout',event=>{ if(event.target.closest('[data-capability]'))clearTooltip(); });

  root.addEventListener('pointerdown',event=>{
    const handle = event.target.closest('[data-resize-handle]');
    if (!handle) return;
    const pane = handle.closest('.utility-pane');
    if (!pane) return;
    resizeState={pane,startX:event.clientX,startW:pane.getBoundingClientRect().width};
    handle.classList.add('dragging');
    event.preventDefault();
  });

  window.addEventListener('pointermove',event=>{
    if (!resizeState) return;
    const width=Math.max(288,Math.min(455,resizeState.startW+(resizeState.startX-event.clientX)));
    resizeState.pane.style.width=`${width}px`;
  });
  window.addEventListener('pointerup',()=>{
    root.querySelector('.utility-resize.dragging')?.classList.remove('dragging');
    resizeState=null;
  });

  document.querySelector('.review-controls').addEventListener('click',event=>{
    const jump=event.target.closest('[data-review-jump]');
    if (jump)applyScenario(jump.dataset.reviewJump);
  });

  scenarioSelect.addEventListener('change',()=>applyScenario(scenarioSelect.value));
  viewportSelect.addEventListener('change',()=>{state.viewport=viewportSelect.value;render();});
  viewSelect.addEventListener('change',()=>{state.view=viewSelect.value;if(state.view==='offline'&&state.surface==='play')state.surface='home';render();});
  modeSelect.addEventListener('change',()=>{state.mode=modeSelect.value;render();});
  sheetStyleSelect.addEventListener('change',()=>{state.sheetStyle=sheetStyleSelect.value;if(state.surface!=='sheet'){state.surface='sheet';state.view='offline';}render();});
  reducedMotionToggle.addEventListener('change',()=>{state.reducedMotion=reducedMotionToggle.checked;render();});

  document.addEventListener('keydown',event=>{
    if (event.key!=='Escape') return;
    if (tooltip) { clearTooltip(); return; }
    if (state.contextMenu) { state.contextMenu=null; render(); return; }
    if (state.action) { state.action=null; state.selectedTargets=[]; state.notice=null; render(); return; }
    if (state.utility) { state.utility=null; render(); return; }
    if (state.fullSheet) { state.fullSheet=false; render(); }
  });

  F.scenarios.forEach(s=>{
    const option=document.createElement('option');
    option.value=s.id;
    option.textContent=s.label;
    scenarioSelect.appendChild(option);
  });

  applyScenario('PROTO-SCN-01');
})();
