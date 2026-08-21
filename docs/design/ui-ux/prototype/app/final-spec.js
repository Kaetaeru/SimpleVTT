(() => {
  'use strict';

  const F = window.SVTT_FINAL_SPEC_FIXTURES;
  const root = document.getElementById('appRoot');
  const viewport = document.getElementById('demoViewport');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const viewSelect = document.getElementById('viewSelect');
  const modeSelect = document.getElementById('modeSelect');
  const viewportSelect = document.getElementById('viewportSelect');
  const sheetStyleSelect = document.getElementById('sheetStyleSelect');
  const utilitySelect = document.getElementById('utilitySelect');
  const handoutSelect = document.getElementById('handoutSelect');
  const visibilitySelect = document.getElementById('visibilitySelect');
  const connectionSelect = document.getElementById('connectionSelect');
  const reducedMotionToggle = document.getElementById('reducedMotionToggle');
  const scenarioTitle = document.getElementById('scenarioTitle');
  const scenarioMeta = document.getElementById('scenarioMeta');

  const DEFAULT = {
    scenarioId: 'FINAL-SCN-DM-FREEFORM',
    surface: 'play', view: 'dm', mode: 'freeform', viewport: 'normal', sheetStyle: 'official',
    utility: null, handout: 'none', visibility: 'public', connection: 'connected', reducedMotion: false,
    selectedCharacter: 'rowan', hotbarPage: 'Mixed', action: null, selectedTargets: [], focusActor: null,
    resolution: null, playRoll: null, playRollPhase: null, sheetRoll: null, sheetRollPhase: null,
    activityFilter: 'all', notice: null, contextMenu: null, hoverCapability: null,
    mainHandUnavailable: false
  };

  const state = { ...DEFAULT };
  let rollTimerA = null;
  let rollTimerB = null;
  let rollTimerC = null;

  const esc = value => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const byId = (list, id) => list.find(x => x.id === id);
  const currentCharacter = () => byId(F.characters, state.selectedCharacter) || F.characters[0];
  const capability = id => byId(F.capabilities, id);
  const actor = id => byId(F.actors, id);
  const scenario = id => byId(F.scenarios, id);

  function clearRollTimers() {
    [rollTimerA, rollTimerB, rollTimerC].forEach(t => t && clearTimeout(t));
    rollTimerA = rollTimerB = rollTimerC = null;
  }

  function applyScenario(id) {
    clearRollTimers();
    const s = scenario(id) || F.scenarios[2];
    Object.assign(state, DEFAULT, s, {
      scenarioId: s.id,
      selectedTargets: [...(s.selectedTargets || [])],
      utility: s.utility || null,
      handout: s.handout || 'none',
      visibility: s.visibility || 'public',
      connection: s.connection || 'connected',
      sheetRoll: s.sheetRoll || null,
      sheetRollPhase: s.rollPhase || (s.sheetRoll ? 'settled' : null),
      playRoll: s.playRoll || null,
      playRollPhase: s.resolution === 'dice' ? 'rolling' : (s.playRoll ? 'settled' : null)
    });
    syncControls();
    render();
  }

  function syncControls() {
    scenarioSelect.value = state.scenarioId;
    viewSelect.value = state.view;
    modeSelect.value = state.mode || 'freeform';
    viewportSelect.value = state.viewport || 'normal';
    sheetStyleSelect.value = state.sheetStyle || 'official';
    utilitySelect.value = state.utility || 'none';
    handoutSelect.value = state.handout || 'none';
    visibilitySelect.value = state.visibility || 'public';
    connectionSelect.value = state.connection || 'connected';
    reducedMotionToggle.checked = !!state.reducedMotion;
    document.body.classList.toggle('reduced-motion', !!state.reducedMotion);
  }

  function setViewport() {
    viewport.className = `demo-viewport vp-${state.viewport || 'normal'}`;
    viewport.dataset.viewport = state.viewport || 'normal';
  }

  function metaText() {
    const bits = [state.surface, state.view, state.mode || '', state.viewport];
    if (state.utility) bits.push(`utility:${state.utility}`);
    if (state.handout && state.handout !== 'none') bits.push(`handout:${state.handout}`);
    return bits.filter(Boolean).join(' · ');
  }

  function render() {
    setViewport();
    const s = scenario(state.scenarioId);
    scenarioTitle.textContent = s ? s.label : 'Final-Spec Demo';
    scenarioMeta.textContent = metaText();
    root.innerHTML = renderSurface();
    syncControls();
  }

  function renderSurface() {
    switch (state.surface) {
      case 'home': return renderHome();
      case 'characters': return renderLibrary();
      case 'sheet': return renderProductShell('characters', renderSheetSurface());
      case 'components': return renderComponents();
      case 'play': return renderPlay();
      default: return renderPlay();
    }
  }

  function renderProductNav(active) {
    const items = [['home','홈'],['characters','캐릭터'],['session','세션'],['content','콘텐츠'],['rules','룰'],['settings','설정']];
    return `<nav class="product-nav" aria-label="Global navigation">
      <div class="product-brand"><div class="product-brand__mark"></div><strong>SimpleVTT</strong></div>
      ${items.map(([id,label]) => `<button class="nav-item ${active === id ? 'active' : ''}" data-nav="${id}">${label}</button>`).join('')}
      <div class="nav-spacer"></div>
      ${state.view !== 'offline' && state.connection !== 'disconnected' ? '<button class="return-play" data-nav="play">플레이로 돌아가기</button>' : ''}
    </nav>`;
  }

  function renderProductShell(active, content) {
    return `<div class="product-shell">${renderProductNav(active)}${content}</div>`;
  }

  function renderHome() {
    return renderProductShell('home', `<main class="product-page">
      <div class="page-heading"><div><h2>오늘 무엇을 할까요?</h2><p>Standalone Character와 Connected Session은 같은 제품의 동등한 핵심 흐름입니다.</p></div><div><button class="btn primary" data-demo-action="open-play">세션 열기</button></div></div>
      <div class="library-grid">${F.characters.map(renderLibraryCard).join('')}</div>
    </main>`);
  }

  function renderLibraryCard(c) {
    const hpPct = Math.round((c.hp / c.hpMax) * 100);
    return `<button class="character-card" data-open-character="${c.id}">
      <div class="character-portrait">${esc(c.initials)}</div>
      <div class="character-card__body"><h3>${esc(c.name)}</h3><p>${esc(c.classLine)} · HP ${c.hp}/${c.hpMax}${c.tempHp ? ` +${c.tempHp}` : ''}</p><div class="hp-bar"><span style="width:${hpPct}%"></span></div></div>
    </button>`;
  }

  function renderLibrary() {
    return renderProductShell('characters', `<main class="product-page">
      <div class="page-heading"><div><h2>캐릭터 라이브러리</h2><p>시트·편집·레벨업·Import의 관리 허브.</p></div><button class="btn primary">새 캐릭터</button></div>
      <div class="library-grid">${F.characters.map(renderLibraryCard).join('')}</div>
    </main>`);
  }

  function renderSheetSurface() {
    const c = currentCharacter();
    const roll = state.sheetRoll ? F.sheetRolls[state.sheetRoll] : null;
    return `<section class="sheet-surface" data-proto-id="PROTO-SURF-CHAR-SHEET-${state.sheetStyle === 'official' ? 'OFFICIAL' : 'SVTT'}">
      <div class="sheet-toolbar">
        <button class="btn quiet" data-nav="characters">← Library</button>
        <h2>${esc(c.name)} · ${esc(c.classLine)}</h2>
        <span class="grow"></span>
        <button class="btn ${state.sheetStyle === 'official' ? 'primary' : ''}" data-sheet-style="official">Official</button>
        <button class="btn ${state.sheetStyle === 'svtt' ? 'primary' : ''}" data-sheet-style="svtt">SimpleVTT</button>
        <button class="btn">Edit</button><button class="btn">Level Up</button>
      </div>
      <div class="sheet-workspace">
        ${state.sheetStyle === 'official' ? renderOfficialSheet(c) : renderSvttSheet(c)}
        ${roll ? renderSheetRollPlane(roll) : ''}
      </div>
    </section>`;
  }

  function sheetBlock(title, rows) {
    return `<section class="sheet-block"><h3>${esc(title)}</h3>${rows.join('')}</section>`;
  }

  function rollRow(label, value, rollId) {
    return `<div class="sheet-row"><span>${esc(label)}</span><strong>${esc(value)}</strong><button class="roll-link" data-sheet-roll="${rollId}">ROLL</button></div>`;
  }

  function renderOfficialSheet(c) {
    const hpPct = Math.round((c.hp / c.hpMax) * 100);
    return `<div class="sheet-paper official">
      <div class="sheet-identity">
        <div class="sheet-name">${esc(c.initials)}</div>
        <div class="identity-main"><h1>${esc(c.name)}</h1><p>${esc(c.classLine)} · Level ${c.level}</p><div class="hp-bar"><span style="width:${hpPct}%"></span></div><p>HP ${c.hp}/${c.hpMax}${c.tempHp ? ` + ${c.tempHp} Temp` : ''}</p></div>
        <div class="stat-tile"><strong>${c.ac}</strong><span>Armor Class</span></div>
        <div class="stat-tile"><strong>${c.speed}</strong><span>Speed</span></div>
        <div class="stat-tile"><strong>${esc(c.initiative)}</strong><span>Initiative</span></div>
        <div class="stat-tile"><strong>${c.level}</strong><span>Level</span></div>
      </div>
      <div class="sheet-columns">
        <div class="sheet-column">
          ${sheetBlock('ABILITIES', [`<div class="ability-grid">${c.abilities.map(([a,v,m]) => `<div class="ability"><span>${a}</span><strong>${v}</strong><span>${m}</span></div>`).join('')}</div>`])}
          ${sheetBlock('SAVING THROWS', c.saves.map(x => rollRow(x.label,x.mod,x.rollId)))}
          ${sheetBlock('SKILLS', c.skills.map(x => rollRow(x.label,x.mod,x.rollId)))}
        </div>
        <div class="sheet-column">
          ${sheetBlock('ATTACKS & SPELLS', c.attacks.map(x => rollRow(x.label,x.meta,x.rollId)).concat([
            `<div class="sheet-row"><span>Longsword Damage</span><strong>1d8 + 4</strong><button class="roll-link" data-sheet-roll="sheet-damage">ROLL</button></div>`
          ]))}
          ${sheetBlock('FEATURES', [
            '<div class="sheet-row"><span>Second Wind</span><strong>1 / 1</strong></div>',
            '<div class="sheet-row"><span>Action Surge</span><strong>1 / 1</strong></div>',
            '<div class="sheet-row"><span>Battle Master Maneuvers</span><strong>3 known</strong></div>',
            '<div class="sheet-row"><span>Extra Attack</span><strong>Feature</strong></div>'
          ])}
        </div>
        <div class="sheet-column">
          ${sheetBlock('RESOURCES', c.resources.map(r => `<div class="sheet-row"><span>${esc(r.label)}</span><strong>${r.current} / ${r.max}</strong></div>`))}
          ${sheetBlock('NOTES', [
            '<div class="sheet-row"><span>Current context</span><strong>Offline / Standalone</strong></div>',
            '<div class="sheet-row"><span>Dice presentation</span><strong>In-sheet Roll Plane</strong></div>',
            '<div class="sheet-row"><span>Result history</span><strong>Current Sheet context</strong></div>'
          ])}
        </div>
      </div>
    </div>`;
  }

  function renderSvttSheet(c) {
    return `<div class="sheet-paper svtt">
      <aside class="svtt-profile"><div class="svtt-profile__portrait">${esc(c.initials)}</div><h2>${esc(c.name)}</h2><p class="muted">${esc(c.classLine)}</p>
        ${sheetBlock('CORE', [`<div class="sheet-row"><span>HP</span><strong>${c.hp}/${c.hpMax}${c.tempHp ? ` +${c.tempHp}` : ''}</strong></div>`,`<div class="sheet-row"><span>AC</span><strong>${c.ac}</strong></div>`,`<div class="sheet-row"><span>Speed</span><strong>${c.speed}</strong></div>`])}
      </aside>
      <div class="svtt-action-area">
        <div class="panel"><div class="panel__head"><h3>QUICK ROLLS</h3><span class="badge good">Same-surface dice</span></div><div class="panel__body"><div class="svtt-action-grid">
          ${c.skills.map(x => `<button class="btn" data-sheet-roll="${x.rollId}">${esc(x.label)} ${esc(x.mod)}</button>`).join('')}
          ${c.saves.map(x => `<button class="btn" data-sheet-roll="${x.rollId}">${esc(x.label)} ${esc(x.mod)}</button>`).join('')}
          ${c.attacks.map(x => `<button class="btn primary" data-sheet-roll="${x.rollId}">${esc(x.label)}</button>`).join('')}
        </div></div></div>
        <div class="library-grid" style="grid-template-columns:1fr 1fr">${sheetBlock('ACTIONS', [
          '<div class="sheet-row"><span>Main Hand Strike</span><strong>Action</strong></div>',
          '<div class="sheet-row"><span>Second Wind</span><strong>Bonus</strong></div>',
          '<div class="sheet-row"><span>Action Surge</span><strong>Resource</strong></div>'
        ])}${sheetBlock('RESOURCES', c.resources.map(r => `<div class="sheet-row"><span>${esc(r.label)}</span><strong>${r.current}/${r.max}</strong></div>`))}</div>
      </div>
    </div>`;
  }

  function renderSheetRollPlane(roll) {
    const rolling = state.sheetRollPhase !== 'settled';
    return `<div class="sheet-roll-plane" data-proto-id="PROTO-SURF-STANDALONE-ROLL-RESULT" aria-label="Standalone dice presentation inside current Character Sheet">
      <div class="dice-flight ${rolling ? '' : 'settled'}"><div class="die">${roll.faces[0]}</div></div>
      <div class="sheet-roll-context"><strong>${esc(roll.label)} · ${roll.total}</strong><span>${esc(roll.notation)} · ${esc(roll.detail)}</span></div>
    </div>`;
  }

  function renderPlay() {
    const utility = state.utility ? renderUtilityPane() : '';
    return `<section class="play-root" data-proto-id="${state.view === 'dm' ? 'PROTO-SURF-PLAY-DM' : 'PROTO-SURF-PLAY-PLAYER'}-${state.mode === 'initiative' ? 'INITIATIVE' : 'FREEFORM'}">
      ${renderPlayChrome()}
      <div class="play-main">
        <div class="scene-system">
          ${renderActorBoard('opposing')}
          ${renderSceneTable()}
          ${renderActorBoard('allied')}
        </div>
        ${utility}
      </div>
      ${renderCommandCenter()}
      ${renderContextMenu()}
      ${renderRichHover()}
    </section>`;
  }

  function renderPlayChrome() {
    const role = state.view === 'dm' ? 'HOST · DM' : 'CLIENT · PLAYER';
    const connectionBadge = state.connection === 'connected' ? '<span class="badge good">Connected</span>' : state.connection === 'reconnecting' ? '<span class="badge warn">Reconnecting</span>' : '<span class="badge hostile">Disconnected</span>';
    return `<header class="play-chrome">
      <button class="chrome-btn" data-nav="home">← Product</button>
      <div class="play-chrome__title"><strong>Lantern Archive · Live Session</strong><span>${role}</span></div>
      ${connectionBadge}
      <div class="play-chrome__spacer"></div>
      ${state.view === 'dm' ? `<button class="chrome-btn ${state.visibility === 'dm-only' ? 'dm-only' : 'active'}" data-action="toggle-visibility">${state.visibility === 'dm-only' ? '◐ DM Only' : '◉ Public'}</button>` : ''}
      <button class="chrome-btn ${state.utility === 'activity' ? 'active' : ''}" data-utility="activity">Activity</button>
      ${state.view === 'dm' ? `<button class="chrome-btn ${state.utility === 'encounter' ? 'active' : ''}" data-utility="encounter">Encounter</button><button class="chrome-btn ${state.utility === 'participants' ? 'active' : ''}" data-utility="participants">Participants</button><button class="chrome-btn ${state.utility === 'session' ? 'active' : ''}" data-utility="session">Session</button><button class="chrome-btn ${state.utility === 'spatial' ? 'active' : ''}" data-utility="spatial">Advanced</button>` : '<button class="chrome-btn" data-utility="session">Session</button>'}
    </header>`;
  }

  function actorBoardList(kind) {
    return F.actors.filter(a => kind === 'allied' ? a.side === 'allied' : a.side !== 'allied');
  }

  function eligibilityFor(actorId) {
    if (!state.action) return null;
    const map = F.targetEligibility[state.action];
    return map ? map[actorId] || null : null;
  }

  function renderActorBoard(kind) {
    return `<div class="actor-board ${kind}" data-board="${kind}">${actorBoardList(kind).map(renderActorCard).join('')}</div>`;
  }

  function renderActorCard(a) {
    const e = eligibilityFor(a.id);
    const selected = state.selectedTargets.includes(a.id);
    const controlled = state.view === 'player' ? a.id === 'rowan' : state.focusActor === a.id;
    const classes = [a.side, controlled ? 'controlled' : '', state.mode === 'initiative' && a.currentTurn ? 'current-turn' : '', e?.valid ? 'valid-target' : '', e && !e.valid ? 'invalid-target' : '', selected ? 'target-selected' : ''].filter(Boolean).join(' ');
    const hp = a.hp == null ? '—' : `${a.hp}/${a.hpMax}${a.tempHp ? ` +${a.tempHp}` : ''}`;
    const hpPct = a.hp == null ? 0 : Math.max(0,Math.round((a.hp/a.hpMax)*100));
    return `<button class="actor-card ${classes}" data-actor="${a.id}" data-proto-id="PROTO-CMP-ACTOR-CARD" aria-label="${esc(a.name)}">
      <div class="actor-card__portrait">${esc(a.initials)}</div><div class="actor-card__body"><strong>${esc(a.name)}</strong><div class="actor-card__meta"><span>${a.side.toUpperCase()}</span><span>HP ${hp}</span>${a.conditions.map(c => `<span>${esc(c)}</span>`).join('')}</div>${a.hp == null ? '' : `<div class="actor-hp"><span style="width:${hpPct}%"></span></div>`}</div>
    </button>`;
  }

  function renderSceneTable() {
    const initiative = state.mode === 'initiative' ? renderInitiativeTracker() : '';
    const notice = renderNotice();
    const tokens = F.actors.map(renderSceneToken).join('');
    const dice = state.resolution === 'dice' && state.playRoll ? renderSceneDice() : '';
    const result = state.resolution === 'result' && state.playRoll ? renderSceneResult() : '';
    const handout = renderHandout();
    return `<div class="scene-table" data-proto-id="PROTO-SCENE-TABLE">
      <div class="scene-label">SCENE · Lantern Archive Courtyard · ${state.mode === 'initiative' ? 'Initiative' : 'Freeform'}</div>
      ${initiative}${notice}${tokens}${handout}${dice}${result}
    </div>`;
  }

  function renderSceneToken(a) {
    const e = eligibilityFor(a.id);
    const selected = state.selectedTargets.includes(a.id);
    const cls = [a.side, state.mode === 'initiative' && a.currentTurn ? 'current-turn' : '', e?.valid ? 'valid-target' : '', selected ? 'target-selected' : ''].filter(Boolean).join(' ');
    return `<button class="scene-token ${cls}" data-scene-actor="${a.id}" style="left:${a.sceneX}%;top:${a.sceneY}%" aria-label="Scene token ${esc(a.name)}">${esc(a.initials)}</button>`;
  }

  function renderInitiativeTracker() {
    return `<div class="initiative-tracker" data-proto-id="PROTO-CMP-INITIATIVE-TRACKER">${F.initiative.map(([id,num]) => { const a=actor(id); return `<div class="init-entry ${a?.currentTurn ? 'current' : ''}"><span class="init-number">${num}</span><strong>${esc(a?.name || id)}</strong></div>`; }).join('')}</div>`;
  }

  function renderNotice() {
    const notices = [];
    if (state.connection === 'reconnecting') notices.push(['warn','연결을 복구 중입니다. 기존 Play context를 유지합니다.']);
    if (state.connection === 'disconnected') notices.push(['warn','연결이 끊겼습니다. Session utility에서 재접속/나가기를 선택할 수 있습니다.']);
    if (state.notice) notices.push(['',state.notice]);
    if (state.view === 'dm' && state.visibility === 'dm-only') notices.push(['dm','DM Only · 비공개 결과는 Player에게 placeholder도 전달하지 않는 계약을 전제로 표시합니다.']);
    return notices.length ? `<div class="notice-stack">${notices.map(([c,t]) => `<div class="notice ${c}">${esc(t)}</div>`).join('')}</div>` : '';
  }

  function renderSceneDice() {
    const roll = F.playRolls[state.playRoll];
    const settled = state.playRollPhase === 'settled';
    return `<div class="scene-dice-plane" aria-label="Dice rolling on central Scene/Table"><div class="scene-dice-flight ${settled ? 'settled' : ''}">${roll.faces.map(face => `<div class="die">${face}</div>`).join('')}</div></div>`;
  }

  function renderSceneResult() {
    const roll = F.playRolls[state.playRoll];
    return `<div class="scene-result" data-proto-id="PROTO-SURF-PLAY-RESULT"><strong>${esc(roll.label)} · ${esc(roll.resultLabel)}</strong><p>${esc(roll.notation)} · ${esc(roll.detail)} · 상세 기록은 Activity에서 확인</p></div>`;
  }

  function renderHandout() {
    if (!state.handout || state.handout === 'none') return '';
    const art = '<div class="handout-art"></div>';
    if (state.handout === 'overlay') return `<div class="handout-overlay"><div class="handout-toolbar"><button class="btn" data-action="dismiss-handout">로컬 숨기기</button></div>${art}</div>`;
    if (state.handout === 'upper') return `<div class="handout-upper"><div class="handout-toolbar"><span class="badge warn">DM controlled · Upper Scene</span></div>${art}</div>`;
    return `<div class="handout-full"><div class="handout-toolbar"><button class="btn">−</button><button class="btn">+</button><span class="badge warn">DM controlled · Full Scene</span></div>${art}</div>`;
  }

  function renderCommandCenter() {
    const c = currentCharacter();
    const visibleCaps = state.hotbarPage === 'Mixed' ? F.capabilities : F.capabilities.filter(x => x.page === state.hotbarPage || x.page === 'Custom' && state.hotbarPage === 'Custom');
    const cap = capability(state.action);
    const multiReady = cap?.targetMode === 'multi' && state.selectedTargets.length > 0;
    return `<section class="command-center" data-proto-id="PROTO-CMP-COMMAND-CENTER">
      <div class="command-topline">
        <div class="economy"><div class="economy-chip"><span class="economy-dot"></span>Action</div><div class="economy-chip"><span class="economy-dot"></span>Bonus</div><div class="economy-chip ${state.mode === 'initiative' ? '' : 'spent'}"><span class="economy-dot"></span>Reaction</div><div class="economy-chip"><span class="economy-dot"></span>Movement</div></div>
        <div class="resource-rail">${c.resources.map(r => `<div class="resource"><span>${esc(r.label)}</span><strong>${r.current}/${r.max}</strong></div>`).join('')}<div class="resource"><span>Item Charge</span><strong>2/3</strong></div></div>
      </div>
      <div class="command-bottom">
        <div class="controlled-actor"><div class="controlled-portrait">${esc(c.initials)}</div><div class="controlled-body"><strong>${esc(c.name)}</strong><p>${esc(c.classLine)} · Controlled Actor</p><div class="actor-hp"><span style="width:${Math.round((c.hp/c.hpMax)*100)}%"></span></div><p>HP ${c.hp}/${c.hpMax}${c.tempHp ? ` +${c.tempHp} Temp` : ''}${c.conditions.length ? ` · ${esc(c.conditions.join(', '))}` : ''}</p></div></div>
        <div class="hotbar-area"><div class="hotbar-tabs">${['Mixed','Action','Spell','Item','Custom'].map(p => `<button class="hotbar-tab ${state.hotbarPage === p ? 'active' : ''}" data-hotbar-page="${p}">${p}</button>`).join('')}</div><div class="hotbar-slots">${visibleCaps.map(renderHotbarSlot).join('')}</div></div>
        <div class="command-context">
          ${state.action ? `<button class="btn quiet" data-action="cancel-action">취소</button>` : ''}
          ${multiReady ? `<button class="btn execute" data-action="execute-multi">Execute · ${state.selectedTargets.length}</button>` : ''}
          ${state.mode === 'initiative' ? '<button class="btn primary">End Turn</button>' : '<button class="btn">Scene Action</button>'}
        </div>
      </div>
    </section>`;
  }

  function renderHotbarSlot(c) {
    const unavailable = !c.available || (c.id === 'main-hand' && state.mainHandUnavailable);
    const reason = c.id === 'main-hand' && state.mainHandUnavailable ? 'Fixture: canonical Main Hand relation is unavailable. No smart fallback.' : c.unavailableReason;
    return `<button class="hotbar-slot ${state.action === c.id ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}" data-capability="${c.id}" data-unavailable-reason="${esc(reason || '')}">
      <span class="hotbar-cost">${esc(c.cost)}</span><span class="hotbar-icon">${esc(c.icon)}</span><span class="hotbar-label">${esc(c.label)}</span>
    </button>`;
  }

  function renderUtilityPane() {
    const titleMap = { activity:'Activity', encounter:'Encounter', participants:'Participants', session:'Session', spatial:'Advanced Spatial Relation' };
    let body = '';
    if (state.utility === 'activity') body = renderActivity();
    else if (state.utility === 'encounter') body = `<div class="utility-list"><div class="utility-row"><strong>Encounter · East Gate</strong><span>Freeform → Initiative remains in the same Play workspace.</span></div><div class="utility-row"><strong>Combatants</strong><span>${F.actors.length} Actors in fixture</span></div><button class="btn primary" data-action="toggle-mode">${state.mode === 'initiative' ? 'Exit Initiative' : 'Enter Initiative'}</button></div>`;
    else if (state.utility === 'participants') body = `<div class="utility-list"><div class="utility-row"><strong>Mina · Player</strong><span>Connected · controls Mina Vale</span></div><div class="utility-row"><strong>Late Join Example</strong><span>Valid Client may join the already-live session.</span></div></div>`;
    else if (state.utility === 'session') body = `<div class="utility-list"><div class="utility-row"><strong>Session code</strong><span>SVTT-DEMO-42 · fixture only</span></div><div class="utility-row"><strong>Content snapshot</strong><span>Captured when session opened · local library changes apply later.</span></div><div class="utility-row"><strong>Connection</strong><span>${esc(state.connection)}</span></div></div>`;
    else if (state.utility === 'spatial') body = state.view === 'dm' ? `<div class="spatial-grid"><label>Actor A<select><option>Rowan Ash</option><option>Mina Vale</option></select></label><label>Actor B<select><option>Ash Raider</option><option>Iron Hound</option></select></label><label>Distance<input value="25 ft (fixture)"></label><label>Visibility<select><option>Visible</option><option>Obscured</option></select></label><label>Cover<select><option>Half</option><option>None</option></select></label><label>Note<input value="Manual DM relation"></label></div><div class="notice warn" style="margin-top:10px">Advanced contextual tool. These fields do not calculate geometry/rules in the prototype.</div>` : '<div class="notice warn">Player has no DM spatial authoring utility.</div>';
    return `<aside class="utility-pane" data-proto-id="PROTO-SURF-${(state.utility || 'UTILITY').toUpperCase()}"><div class="utility-pane__head"><strong>${esc(titleMap[state.utility] || 'Utility')}</strong><button class="chrome-btn" data-utility="none">Close</button></div><div class="utility-pane__body">${body}</div></aside>`;
  }

  function renderActivity() {
    const items = F.activity.filter(ev => {
      if (state.view === 'player' && ev.visibility === 'dm-only') return false;
      if (state.activityFilter === 'public') return ev.visibility === 'public';
      if (state.activityFilter === 'private') return state.view === 'dm' && ev.visibility === 'dm-only';
      return true;
    });
    return `<div class="utility-tabs"><button class="btn ${state.activityFilter === 'all' ? 'primary' : ''}" data-activity-filter="all">All</button><button class="btn ${state.activityFilter === 'public' ? 'primary' : ''}" data-activity-filter="public">Public</button>${state.view === 'dm' ? `<button class="btn ${state.activityFilter === 'private' ? 'primary' : ''}" data-activity-filter="private">DM Only</button>` : ''}</div>${items.map(ev => `<article class="activity-item ${ev.visibility === 'dm-only' ? 'dm-only' : ''}"><time>${esc(ev.time)}</time><strong>${esc(ev.title)} ${ev.visibility === 'dm-only' ? '· DM Only' : ''}</strong><p>${esc(ev.detail)}</p></article>`).join('')}`;
  }

  function renderRichHover() {
    if (!state.hoverCapability) return '';
    const c = capability(state.hoverCapability);
    if (!c) return '';
    return `<div class="rich-hover" id="richHover" style="left:${state.hoverCapability.x || 0}px;top:${state.hoverCapability.y || 0}px"><strong>${esc(c.label)} · ${esc(c.cost)}</strong><p>${esc(c.description)}${c.unavailableReason ? ` ${esc(c.unavailableReason)}` : ''}</p></div>`;
  }

  function renderContextMenu() {
    if (!state.contextMenu) return '';
    const a = actor(state.contextMenu.actorId);
    if (!a) return '';
    return `<div class="context-menu" style="left:${state.contextMenu.x}px;top:${state.contextMenu.y}px"><button data-context-command="inspect">Inspect ${esc(a.name)}</button><button data-context-command="focus">Focus in Scene</button>${state.view === 'dm' ? '<button data-context-command="control">Set DM control focus</button>' : ''}<button data-context-command="close">Close</button></div>`;
  }

  function renderComponents() {
    return `<div class="component-gallery"><div class="page-heading"><div><h2>Final-Spec Component Gallery</h2><p>Product primitives and states. Prototype Controls are not represented here.</p></div><button class="btn" data-demo-action="open-play">Open Play</button></div><div class="gallery-grid">
      <section class="gallery-section"><h3>Buttons</h3><div class="gallery-row"><button class="btn primary">Primary</button><button class="btn">Secondary</button><button class="btn quiet">Quiet</button><button class="btn danger">Destructive</button><button class="btn" disabled>Disabled</button></div></section>
      <section class="gallery-section"><h3>Badges / status</h3><div class="gallery-row"><span class="badge good">Connected</span><span class="badge dm">DM Only</span><span class="badge ally">Allied</span><span class="badge hostile">Hostile</span><span class="badge warn">Warning</span></div></section>
      <section class="gallery-section"><h3>Hotbar slot</h3><div class="gallery-row">${F.capabilities.slice(0,4).map(renderHotbarSlot).join('')}</div></section>
      <section class="gallery-section"><h3>Actor states</h3><div class="gallery-row" style="width:100%">${renderActorCard(F.actors[0])}${renderActorCard(F.actors[4])}</div></section>
      <section class="gallery-section"><h3>NOTICE / feedback</h3><div class="notice">Persistent current condition</div><div class="notice warn" style="margin-top:5px">Recoverable warning</div></section>
      <section class="gallery-section"><h3>Dice principle</h3><div class="gallery-row"><div class="die">17</div><span class="muted">Physical presentation, fixture-authoritative result.</span></div></section>
    </div></div>`;
  }

  function startSheetRoll(id) {
    const roll = F.sheetRolls[id];
    if (!roll) return;
    clearRollTimers();
    state.sheetRoll = id;
    state.sheetRollPhase = 'rolling';
    render();
    rollTimerA = setTimeout(() => { state.sheetRollPhase = 'settled'; render(); }, state.reducedMotion ? 20 : 1050);
    rollTimerB = setTimeout(() => { state.sheetRoll = null; state.sheetRollPhase = null; render(); }, state.reducedMotion ? 1500 : 2800);
  }

  function startPlayResolution(actionId, targets) {
    clearRollTimers();
    state.action = actionId;
    state.selectedTargets = [...targets];
    state.resolution = 'dice';
    state.playRoll = 'attack';
    state.playRollPhase = 'rolling';
    state.notice = 'Resolution submitted · Command Center and Actor context remain visible.';
    render();
    rollTimerA = setTimeout(() => { state.playRollPhase = 'settled'; render(); }, state.reducedMotion ? 20 : 1120);
    rollTimerB = setTimeout(() => { state.resolution = 'result'; state.notice = null; render(); }, state.reducedMotion ? 350 : 1700);
    rollTimerC = setTimeout(() => { state.resolution = null; state.playRoll = null; state.playRollPhase = null; state.action = null; state.selectedTargets = []; render(); }, state.reducedMotion ? 1900 : 3600);
  }

  function actorClick(actorId) {
    const a = actor(actorId);
    if (!a) return;
    if (state.action) {
      const c = capability(state.action);
      const e = eligibilityFor(actorId);
      if (e && !e.valid) { state.notice = e.reason || 'Fixture: target unavailable.'; render(); return; }
      if (c?.targetMode === 'single' && e?.valid) { startPlayResolution(state.action,[actorId]); return; }
      if (c?.targetMode === 'multi' && e?.valid) {
        state.selectedTargets = state.selectedTargets.includes(actorId) ? state.selectedTargets.filter(x => x !== actorId) : [...state.selectedTargets,actorId];
        state.notice = null; render(); return;
      }
    }
    if (!state.action && a.side === 'hostile') {
      if (state.mainHandUnavailable) { state.notice = 'Fixture: canonical Main Hand default is unavailable. No fallback is chosen.'; render(); return; }
      const e = F.targetEligibility['main-hand']?.[actorId];
      if (e?.valid) { startPlayResolution('main-hand',[actorId]); return; }
    }
    state.focusActor = actorId;
    render();
  }

  function capabilityClick(id, el) {
    const c = capability(id);
    if (!c) return;
    const reason = el?.dataset.unavailableReason;
    if (!c.available || reason) { state.notice = reason || c.unavailableReason || 'Fixture: unavailable.'; render(); return; }
    if (c.targetMode === 'none' || c.targetMode === 'self') {
      state.notice = `${c.label} selected · fixture no-target/self execution example.`;
      state.action = id; state.selectedTargets = []; render(); return;
    }
    state.action = state.action === id ? null : id;
    state.selectedTargets = [];
    state.notice = state.action ? `${c.label} targeting · all Actor Cards remain visible.` : null;
    render();
  }

  root.addEventListener('click', event => {
    const sheetRoll = event.target.closest('[data-sheet-roll]');
    if (sheetRoll) { startSheetRoll(sheetRoll.dataset.sheetRoll); return; }

    const openCharacter = event.target.closest('[data-open-character]');
    if (openCharacter) { state.selectedCharacter = openCharacter.dataset.openCharacter; state.surface='sheet'; state.view='offline'; render(); return; }

    const nav = event.target.closest('[data-nav]');
    if (nav) {
      const dest = nav.dataset.nav;
      if (dest === 'play') { state.surface='play'; if (state.view === 'offline') state.view='player'; }
      else if (dest === 'home') { state.surface='home'; state.view='offline'; }
      else if (dest === 'characters') { state.surface='characters'; state.view='offline'; }
      else if (dest === 'session') { state.surface='play'; state.view='dm'; }
      else state.surface='home';
      state.utility=null; state.action=null; state.selectedTargets=[]; render(); return;
    }

    const style = event.target.closest('[data-sheet-style]');
    if (style) { state.sheetStyle=style.dataset.sheetStyle; render(); return; }

    const actorEl = event.target.closest('[data-actor],[data-scene-actor]');
    if (actorEl) { actorClick(actorEl.dataset.actor || actorEl.dataset.sceneActor); return; }

    const capEl = event.target.closest('[data-capability]');
    if (capEl) { capabilityClick(capEl.dataset.capability,capEl); return; }

    const page = event.target.closest('[data-hotbar-page]');
    if (page) { state.hotbarPage=page.dataset.hotbarPage; render(); return; }

    const util = event.target.closest('[data-utility]');
    if (util) { const u=util.dataset.utility; state.utility = u === 'none' || state.utility === u ? null : u; render(); return; }

    const filter = event.target.closest('[data-activity-filter]');
    if (filter) { state.activityFilter=filter.dataset.activityFilter; render(); return; }

    const action = event.target.closest('[data-action]');
    if (action) {
      switch(action.dataset.action) {
        case 'cancel-action': state.action=null; state.selectedTargets=[]; state.notice=null; render(); break;
        case 'execute-multi': if (state.action && state.selectedTargets.length) startPlayResolution(state.action,state.selectedTargets); break;
        case 'toggle-visibility': state.visibility = state.visibility === 'public' ? 'dm-only' : 'public'; render(); break;
        case 'toggle-mode': state.mode = state.mode === 'initiative' ? 'freeform' : 'initiative'; render(); break;
        case 'dismiss-handout': state.handout='none'; render(); break;
      }
    }

    const ctx = event.target.closest('[data-context-command]');
    if (ctx) {
      const cmd=ctx.dataset.contextCommand;
      if (cmd==='control' && state.contextMenu) state.focusActor=state.contextMenu.actorId;
      if (cmd==='focus' && state.contextMenu) state.focusActor=state.contextMenu.actorId;
      state.contextMenu=null; render();
    }
  });

  root.addEventListener('contextmenu', event => {
    const a = event.target.closest('[data-actor]');
    if (!a) return;
    event.preventDefault();
    state.contextMenu={ actorId:a.dataset.actor, x:Math.min(event.clientX,window.innerWidth-205), y:Math.min(event.clientY,window.innerHeight-150) };
    render();
  });

  root.addEventListener('pointerover', event => {
    const el=event.target.closest('[data-capability]');
    if (!el) return;
    state.hoverCapability={ id:el.dataset.capability, x:Math.min(event.clientX+12,window.innerWidth-300), y:Math.min(event.clientY+12,window.innerHeight-150) };
    const c=capability(el.dataset.capability);
    if (c) state.hoverCapability = Object.assign({},state.hoverCapability,c);
    render();
  });

  root.addEventListener('pointerout', event => {
    if (event.target.closest('[data-capability]')) { state.hoverCapability=null; render(); }
  });

  document.querySelector('.demo-lab').addEventListener('click', event => {
    const action=event.target.closest('[data-demo-action]')?.dataset.demoAction;
    if (!action) return;
    if (action==='open-sheet') { Object.assign(state,DEFAULT,{ surface:'sheet',view:'offline',sheetStyle:sheetStyleSelect.value,viewport:viewportSelect.value }); }
    else if (action==='open-play') { Object.assign(state,DEFAULT,{ surface:'play',view:'dm',mode:'freeform',viewport:viewportSelect.value }); }
    else if (action==='components') { Object.assign(state,DEFAULT,{ surface:'components',view:'offline',viewport:viewportSelect.value }); }
    else if (action==='reset') { applyScenario('FINAL-SCN-DM-FREEFORM'); return; }
    render();
  });

  scenarioSelect.addEventListener('change',() => applyScenario(scenarioSelect.value));
  viewSelect.addEventListener('change',() => { state.view=viewSelect.value; if(state.view==='offline' && state.surface==='play') state.surface='sheet'; render(); });
  modeSelect.addEventListener('change',() => { state.mode=modeSelect.value; render(); });
  viewportSelect.addEventListener('change',() => { state.viewport=viewportSelect.value; render(); });
  sheetStyleSelect.addEventListener('change',() => { state.sheetStyle=sheetStyleSelect.value; if(state.surface!=='sheet') state.surface='sheet'; state.view='offline'; render(); });
  utilitySelect.addEventListener('change',() => { state.utility=utilitySelect.value==='none'?null:utilitySelect.value; if(state.surface!=='play') state.surface='play'; render(); });
  handoutSelect.addEventListener('change',() => { state.handout=handoutSelect.value; if(state.surface!=='play') state.surface='play'; render(); });
  visibilitySelect.addEventListener('change',() => { state.visibility=visibilitySelect.value; render(); });
  connectionSelect.addEventListener('change',() => { state.connection=connectionSelect.value; render(); });
  reducedMotionToggle.addEventListener('change',() => { state.reducedMotion=reducedMotionToggle.checked; render(); });

  F.scenarios.forEach(s => scenarioSelect.insertAdjacentHTML('beforeend',`<option value="${s.id}">${esc(s.label)}</option>`));
  applyScenario(DEFAULT.scenarioId);
})();
