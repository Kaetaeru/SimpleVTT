(() => {
  'use strict';

  const F = window.PROTOTYPE_FIXTURES;
  const root = document.getElementById('productRoot');
  const viewport = document.getElementById('prototypeViewport');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const viewSelect = document.getElementById('viewSelect');
  const modeSelect = document.getElementById('modeSelect');
  const viewportSelect = document.getElementById('viewportSelect');
  const connectionSelect = document.getElementById('connectionSelect');
  const handoutSelect = document.getElementById('handoutSelect');
  const visibilitySelect = document.getElementById('visibilitySelect');
  const reducedMotionToggle = document.getElementById('reducedMotionToggle');
  const errorToggle = document.getElementById('errorToggle');
  const loadingToggle = document.getElementById('loadingToggle');
  const scenarioTitle = document.getElementById('scenarioTitle');
  const scenarioMeta = document.getElementById('scenarioMeta');

  const DEFAULT = {
    scenarioId: 'PROTO-SCN-08', surface: 'play', view: 'dm', mode: 'freeform', viewport: 'normal',
    connection: 'connected', handout: 'none', visibility: 'public', utility: null, action: null,
    targeting: null, selectedTargets: [], resolution: null, dice: false, result: false,
    ownTurn: true, noCharacter: false, lateJoin: false, mainHandUnavailable: false,
    contentSnapshotNotice: false, error: false, loading: false, reducedMotion: false,
    contextActor: null, contextX: 0, contextY: 0, hoverCapability: null,
    activityFilter: 'all', handoutDismissed: false, selectedCharacter: 'rowan', selectedSheet: 'official',
    showConfirm: false, confirmKind: 'normal'
  };

  const state = { ...DEFAULT };

  const navItems = [
    ['home', '홈'], ['characters', '캐릭터'], ['session', '세션'], ['content', '콘텐츠'], ['rules', '룰'], ['settings', '설정']
  ];

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function byId(list, id) { return list.find(x => x.id === id); }

  function scenarioById(id) { return F.scenarios.find(s => s.id === id); }

  function applyScenario(id) {
    const s = scenarioById(id) || F.scenarios[7];
    Object.assign(state, DEFAULT, s, { scenarioId: s.id, selectedTargets: [...(s.selectedTargets || [])] });
    syncControls();
    render();
  }

  function syncControls() {
    scenarioSelect.value = state.scenarioId;
    viewSelect.value = state.view;
    modeSelect.value = state.mode;
    viewportSelect.value = state.viewport || 'normal';
    connectionSelect.value = state.connection || 'connected';
    handoutSelect.value = state.handout || 'none';
    visibilitySelect.value = state.visibility || 'public';
    reducedMotionToggle.checked = !!state.reducedMotion;
    errorToggle.checked = !!state.error;
    loadingToggle.checked = !!state.loading;
    document.body.classList.toggle('reduced-motion', !!state.reducedMotion);
  }

  function nav(active, live = true) {
    const links = navItems.map(([id, label]) => `
      <button class="nav-link ${active === id ? 'active' : ''}" data-nav="${id}">${label}</button>
    `).join('');
    return `
      <nav class="global-nav" data-proto-id="PROTO-CMP-GLOBAL-NAV">
        <div class="brand"><div class="brand-mark"></div><strong>SimpleVTT</strong></div>
        ${links}
        <div class="global-nav__spacer"></div>
        ${live ? `<button class="svtt-btn svtt-btn--quiet return-play" data-nav="play" data-proto-id="PROTO-CMP-RETURN-PLAY">플레이로 돌아가기</button>` : ''}
      </nav>`;
  }

  function shell(active, content, live = true) {
    return `<div class="product-shell">${nav(active, live)}${content}</div>`;
  }

  function pageTitle(title, sub, action = '') {
    return `<div class="page-title-row"><div class="page-title"><h2>${title}</h2><p>${sub}</p></div>${action}</div>`;
  }

  function avatar(initials, small = false) {
    return `<div class="avatar ${small ? 'small-avatar' : ''}">${esc(initials)}</div>`;
  }

  function renderFirstRun() {
    return `<div class="first-run" data-proto-id="PROTO-SURF-FIRST-RUN">
      <section class="first-run-card">
        <div class="proto-kicker">WELCOME TO SIMPLEVTT</div>
        <h1>처음 사용할 화면 방식을 정해볼게요.</h1>
        <p>이 선택은 언제든 설정에서 바꿀 수 있습니다. 캐릭터 시트의 정보는 같고, 보여주는 방식만 다릅니다.</p>
        <div class="sheet-choice">
          <button class="sheet-choice-card ${state.selectedSheet === 'official' ? 'selected' : ''}" data-action="choose-sheet" data-value="official">
            <h3>Official-style Sheet</h3><p>종이 시트처럼 전체 기록을 한눈에 읽는 데 익숙한 구성.</p>
          </button>
          <button class="sheet-choice-card ${state.selectedSheet === 'svtt' ? 'selected' : ''}" data-action="choose-sheet" data-value="svtt">
            <h3>SimpleVTT Sheet</h3><p>자주 쓰는 행동과 현재 상태를 빠르게 찾는 데 최적화된 구성.</p>
          </button>
        </div>
        <div class="form-actions"><button class="svtt-btn svtt-btn--primary" data-action="finish-first-run">SimpleVTT 시작</button><button class="svtt-btn svtt-btn--quiet" data-nav="home">나중에 정하기</button></div>
      </section>
    </div>`;
  }

  function renderHome() {
    const returnNotice = state.connection === 'reconnecting' ? `<div class="inline-alert">이전 세션 연결을 복구 중입니다. Home은 유지되고 세션 상태가 준비되면 돌아갈 수 있습니다.</div>` : '';
    const cards = F.characters.slice(0, 3).map(c => `
      <div class="quick-card" data-open-character="${c.id}"><strong>${esc(c.name)}</strong><span>${esc(c.summary)} · HP ${c.hp}/${c.hpMax}</span></div>`).join('');
    return shell('home', `<main class="product-page" data-proto-id="PROTO-SURF-HOME">
      ${returnNotice}
      <div class="hero">
        <section class="hero-main"><div class="proto-kicker">TABLETOP & CONNECTED PLAY</div><h2>오늘 무엇을 할까요?</h2><p>Standalone Character Sheet와 Connected VTT를 같은 제품 안에서 바로 시작합니다. 세션은 캐릭터 관리의 하위 메뉴가 아닙니다.</p>
          <div class="hero-actions"><button class="svtt-btn svtt-btn--primary" data-nav="host-setup">세션 열기</button><button class="svtt-btn svtt-btn--secondary" data-nav="join">세션 참가</button><button class="svtt-btn svtt-btn--quiet" data-nav="characters">내 캐릭터</button></div>
        </section>
        <div class="hero-side">${cards}</div>
      </div>
      <div class="grid-3">
        <section class="panel"><div class="panel-header"><h3>캐릭터</h3><span class="badge">${F.characters.length} saved</span></div><div class="panel-body small muted">Library에서 시트, 편집, 레벨업을 관리합니다.</div></section>
        <section class="panel"><div class="panel-header"><h3>콘텐츠</h3><span class="badge badge--success">Snapshot-safe</span></div><div class="panel-body small muted">SimpleVTT package를 설치하고 다음 세션부터 적용합니다.</div></section>
        <section class="panel"><div class="panel-header"><h3>도움말</h3><button class="svtt-btn svtt-btn--quiet" data-nav="first-run">처음 안내 다시 보기</button></div><div class="panel-body small muted">핵심 조작을 다시 확인할 수 있습니다.</div></section>
      </div>
    </main>`, state.connection !== 'disconnected');
  }

  function characterCard(c, selected = false) {
    const pct = Math.max(0, Math.min(100, (c.hp / c.hpMax) * 100));
    return `<article class="character-card ${selected ? 'selected' : ''}" data-proto-id="PROTO-CMP-CHARACTER-CARD" data-open-character="${c.id}">
      <div class="character-card__top">${avatar(c.initials)}</div><div class="character-card__body"><h4>${esc(c.name)}</h4><p>${esc(c.summary)} · HP ${c.hp}/${c.hpMax}${c.tempHp ? ` +${c.tempHp}` : ''}</p><div class="hp-line"><span style="width:${pct}%"></span></div></div>
    </article>`;
  }

  function renderCharacters() {
    const cards = F.characters.map(c => characterCard(c, state.selectedCharacter === c.id)).join('');
    return shell('characters', `<main class="product-page" data-proto-id="PROTO-SURF-CHAR-LIBRARY">
      ${pageTitle('캐릭터 라이브러리', '캐릭터 관리의 중심. 시트·편집·레벨업·Import를 여기서 시작합니다.', `<button class="svtt-btn svtt-btn--primary" data-nav="builder">새 캐릭터</button>`)}
      <div class="panel" style="margin-bottom:12px"><div class="panel-body" style="display:flex;gap:8px"><input aria-label="캐릭터 검색" placeholder="캐릭터 검색" style="flex:1;height:36px;border:1px solid var(--border-subtle);background:#11171d;border-radius:6px;padding:0 10px"><button class="svtt-btn svtt-btn--secondary">필터</button><button class="svtt-btn svtt-btn--quiet" data-nav="builder">Import</button></div></div>
      <div class="character-grid">${cards}</div>
    </main>`);
  }

  function sheetStatBlock(title, rows) {
    return `<section class="stat-block"><h3>${title}</h3>${rows.map(([a,b]) => `<div class="stat-row"><span>${a}</span><strong>${b}</strong></div>`).join('')}</section>`;
  }

  function renderSheet(style = 'official', inline = false) {
    const c = byId(F.characters, state.selectedCharacter) || F.characters[0];
    const klass = style === 'official' ? 'sheet-official' : 'sheet-svtt';
    const content = `<div class="sheet ${klass}" data-proto-id="${style === 'official' ? 'PROTO-SURF-CHAR-SHEET-OFFICIAL' : 'PROTO-SURF-CHAR-SHEET-SVTT'}">
      <div class="sheet-toolbar"><button class="svtt-btn svtt-btn--quiet" data-nav="characters">← Library</button><h2>${esc(c.name)} · ${esc(c.summary)}</h2><button class="svtt-btn ${style === 'official' ? 'svtt-btn--primary' : 'svtt-btn--quiet'}" data-action="switch-sheet" data-value="official">Official</button><button class="svtt-btn ${style === 'svtt' ? 'svtt-btn--primary' : 'svtt-btn--quiet'}" data-action="switch-sheet" data-value="svtt">SimpleVTT</button><button class="svtt-btn svtt-btn--secondary" data-nav="level-up">Level Up</button></div>
      <div class="sheet-content"><div class="sheet-layout">
        <div class="sheet-column">${sheetStatBlock('IDENTITY', [['HP', `${c.hp}/${c.hpMax}${c.tempHp ? ` +${c.tempHp}` : ''}`], ['Armor', 'Mock 17'], ['Speed', 'Mock 30'], ['Initiative', '+3']])}${sheetStatBlock('ABILITIES', [['STR','16'],['DEX','14'],['CON','15'],['INT','10'],['WIS','12'],['CHA','11']])}</div>
        <div class="sheet-column">${sheetStatBlock(style === 'official' ? 'ATTACKS & SPELLS' : 'QUICK ACTIONS', [['Main Hand Strike','Mock +7'],['Arc Bolt','Mock +6'],['Quick Step','Bonus'],['Guard','Reaction']])}${sheetStatBlock('FEATURES', [['Second Wind','1/1'],['Action Surge','1/1'],['Condition', c.conditions[0] || '—']])}</div>
        <div class="sheet-column">${sheetStatBlock('RESOURCES', (c.resources || []).map(x => [x.split(' ')[0], x.substring(x.indexOf(' ')+1)]))}${sheetStatBlock('NOTES', [['Session link', state.view === 'offline' ? 'Offline' : 'Live'],['Layout', style === 'official' ? 'Official' : 'SimpleVTT']])}<button class="svtt-btn svtt-btn--primary" data-action="sheet-roll">Mock Roll</button></div>
      </div></div>
    </div>`;
    return inline ? content : shell('characters', content);
  }

  function renderBuilder(levelUp = false) {
    return shell('characters', `<main class="product-page" data-proto-id="${levelUp ? 'PROTO-SURF-LEVEL-UP' : 'PROTO-SURF-CHAR-BUILDER'}">
      ${pageTitle(levelUp ? 'Level Up' : 'Character Builder', levelUp ? '기존 Level Up 흐름을 유지하는 reference shell입니다.' : '기존 생성/Edit/Import UX를 유지하는 reference shell입니다.')}
      <div class="grid-2"><section class="panel"><div class="panel-header"><h3>${levelUp ? '1 · 선택' : '1 · 기본 정보'}</h3><span class="badge badge--accent">Accepted baseline</span></div><div class="panel-body form-stack">
        <label class="field"><span>이름</span><input value="Rowan Ash"></label><label class="field"><span>${levelUp ? '다음 단계' : '방식'}</span><select><option>${levelUp ? 'Mock Fighter 6' : 'Guided'}</option><option>${levelUp ? 'Keep current' : 'Quick'}</option><option>${levelUp ? '—' : 'Import'}</option></select></label>
        <div class="inline-alert">프로토타입은 기존 Builder/Level Up 작업 흐름을 재설계하지 않고 시각 시스템만 맞춥니다.</div><div class="form-actions"><button class="svtt-btn svtt-btn--quiet" data-nav="characters">취소</button><button class="svtt-btn svtt-btn--primary">${levelUp ? 'Review' : '다음'}</button></div>
      </div></section><section class="panel"><div class="panel-header"><h3>미리보기</h3></div><div class="panel-body">${characterCard(F.characters[0], true)}</div></section></div>
    </main>`);
  }

  function renderHostSetup() {
    return shell('session', `<main class="product-page" data-proto-id="PROTO-SURF-HOST-SETUP">
      ${pageTitle('세션 열기', '별도 Lobby/Ready 단계 없이 열면 즉시 Live Freeform이 됩니다.')}
      <section class="panel" style="max-width:760px"><div class="panel-body form-stack"><label class="field"><span>세션 이름</span><input value="Glass Lantern Demo"></label><label class="field"><span>연결 방식</span><select><option>Direct Host · Mock</option></select></label><div class="inline-alert">Open Session 시 현재 Content 구성을 snapshot으로 고정합니다. 이후 local library 변경은 다음 세션에 적용됩니다.</div>${state.error ? '<div class="inline-alert error">Mock validation error: 세션 주소를 열 수 없습니다.</div>' : ''}<div class="form-actions"><button class="svtt-btn svtt-btn--quiet" data-nav="home">취소</button><button class="svtt-btn svtt-btn--primary" data-action="open-session">Open Session → Live Play</button></div></div></section>
    </main>`, false);
  }

  function renderJoin() {
    const noChar = !!state.noCharacter;
    const charOptions = F.characters.map(c => `<option value="${c.id}">${esc(c.name)} · ${esc(c.summary)}</option>`).join('');
    return shell('session', `<main class="product-page" data-proto-id="PROTO-SURF-JOIN-SETUP">
      ${pageTitle('세션 참가', state.lateJoin ? '이미 진행 중인 Live Session에 중간 참가합니다.' : 'Join Setup 후 Character를 선택합니다.')}
      <section class="panel" style="max-width:780px"><div class="panel-body form-stack"><label class="field"><span>세션 주소</span><input value="192.168.0.42:4877"></label>
      ${noChar ? `<div class="inline-alert error"><strong>참가할 캐릭터가 없습니다.</strong><br>Character 없이 세션에 들어가지 않습니다. 먼저 만들거나 Import한 뒤 Join을 다시 시작하세요.</div><div class="form-actions"><button class="svtt-btn svtt-btn--primary" data-nav="builder">캐릭터 만들기</button><button class="svtt-btn svtt-btn--secondary" data-nav="builder">Import Character</button></div>` : `<label class="field"><span>참가 캐릭터</span><select>${charOptions}</select></label><div class="inline-alert">Host가 이미 세션을 플레이/편집 중일 수 있습니다. 유효한 연결이 완료되면 현재 Live 상태로 진입합니다.</div><div class="form-actions"><button class="svtt-btn svtt-btn--quiet" data-nav="home">취소</button><button class="svtt-btn svtt-btn--primary" data-action="join-live">Join Live Session</button></div>`}
      </div></section>
    </main>`, false);
  }

  function renderContent(importMode = false) {
    if (importMode) {
      return shell('content', `<main class="product-page" data-proto-id="PROTO-SURF-CONTENT-IMPORT">${pageTitle('Package Import Review', 'SimpleVTT 공식 package format만 제품화합니다.')}
        <section class="panel"><div class="panel-body"><div class="validation-row">✓ Manifest · mock valid</div><div class="validation-row warn" style="margin-top:8px">! Warning · 기존 capability ID 하나가 바뀝니다. Mock warning.</div><div class="validation-row block" style="margin-top:8px">× Blocking example · required manifest field missing.</div><div class="form-actions"><button class="svtt-btn svtt-btn--quiet" data-nav="content">취소</button><button class="svtt-btn svtt-btn--primary">Install Valid Fixture</button></div></div></section></main>`);
    }
    const rows = F.content.map(p => `<div class="content-row"><div><h4>${esc(p.name)} <span class="badge ${p.status === 'disabled' ? '' : p.status === 'blocking' ? 'badge--danger' : 'badge--success'}">${esc(p.status)}</span></h4><p>v${esc(p.version)} ${p.update ? `· update ${esc(p.update)} available` : ''} ${p.snapshot ? `· live snapshot ${esc(p.snapshot)}` : ''}</p></div><div class="content-row__actions"><button class="svtt-btn svtt-btn--quiet">${p.status === 'disabled' ? 'Enable' : 'Disable'}</button><button class="svtt-btn svtt-btn--secondary">${p.update ? 'Update' : 'Replace'}</button><button class="svtt-btn svtt-btn--danger" data-action="open-confirm" data-kind="content">Delete</button></div></div>`).join('');
    return shell('content', `<main class="product-page" data-proto-id="PROTO-SURF-CONTENT">${pageTitle('콘텐츠 / Add-ons', 'Install · update · replace · disable · delete. Live Session은 열릴 때의 snapshot을 유지합니다.', `<button class="svtt-btn svtt-btn--primary" data-nav="content-import">Package Import</button>`)}<div class="content-list">${rows}</div></main>`);
  }

  function renderRules() {
    return shell('rules', `<main class="product-page" data-proto-id="PROTO-SURF-RULES">${pageTitle('룰 브라우저', '룰 검색은 Product destination이면서 세션 안에서는 contextual lookup으로도 열립니다.')}
      <section class="panel"><div class="panel-body"><div style="display:flex;gap:8px"><input value="grapple" aria-label="룰 검색" style="flex:1;height:38px;border:1px solid var(--border-subtle);background:#11171d;border-radius:6px;padding:0 10px"><button class="svtt-btn svtt-btn--primary">검색</button></div></div></section><div class="grid-2" style="margin-top:12px"><section class="panel"><div class="panel-header"><h3>검색 결과</h3><span class="badge">3 mock</span></div><div class="panel-body"><button class="svtt-btn svtt-btn--quiet" style="width:100%;justify-content:flex-start">Grapple · Core Rules</button><button class="svtt-btn svtt-btn--quiet" style="width:100%;justify-content:flex-start">Escape · Related</button></div></section><section class="panel"><div class="panel-header"><h3>Grapple</h3></div><div class="panel-body small muted">Prototype placeholder rules detail. 실제 룰 텍스트/계산을 정의하지 않습니다.</div></section></div>
    </main>`);
  }

  function renderSettings() {
    return shell('settings', `<main class="product-page" data-proto-id="PROTO-SURF-SETTINGS">${pageTitle('설정', '표현·접근성·도움말·레이아웃 reset 같은 로컬 환경 설정입니다.')}
      <div class="grid-2"><section class="panel"><div class="panel-header"><h3>Appearance</h3></div><div class="panel-body form-stack"><label class="field"><span>Theme</span><select><option>Dark Reference</option><option>System</option></select></label><label class="field"><span>Accent</span><select><option>Warm Gold</option><option>Blue</option></select></label><label><input type="checkbox" ${state.reducedMotion ? 'checked' : ''} data-action="toggle-reduced"> Reduced Motion</label></div></section><section class="panel"><div class="panel-header"><h3>Help & Layout</h3></div><div class="panel-body form-stack"><button class="svtt-btn svtt-btn--secondary" data-nav="first-run">처음 안내 다시 보기</button><button class="svtt-btn svtt-btn--quiet" data-action="reset-layout">패널 크기 초기화</button></div></section></div>
    </main>`);
  }

  function actorCard(a) {
    const targeting = !!state.targeting;
    const targetClass = targeting ? (a.valid ? 'target-valid' : 'target-invalid') : '';
    const selected = state.selectedTargets.includes(a.id) ? 'target-selected' : '';
    return `<article tabindex="0" class="actor-card relation-${a.relation} ${a.controlled ? 'is-controlled' : ''} ${state.mode === 'initiative' && a.currentTurn ? 'is-current' : ''} ${targetClass} ${selected}" data-proto-id="PROTO-CMP-ACTOR-CARD" data-actor="${a.id}" title="${a.valid ? 'Mock valid target' : esc(a.invalidReason || '')}">
      <div class="actor-card__name">${esc(a.name)}</div><div class="actor-card__meta"><span>${esc(a.hp)}</span><span>${a.relation}</span></div><div class="actor-card__conditions">${a.conditions.map(c => `<span class="condition-dot">${esc(c)}</span>`).join('')}</div>
    </article>`;
  }

  function actorBoard(kind) {
    const list = kind === 'opposing' ? F.actors.filter(a => a.relation !== 'allied') : F.actors.filter(a => a.relation === 'allied');
    return `<div class="actor-board ${kind === 'allied' ? 'actor-board--allied' : ''}" data-proto-id="PROTO-CMP-ACTOR-BOARD">${list.map(actorCard).join('')}</div>`;
  }

  function initiativeTracker() {
    if (state.mode !== 'initiative') return '';
    const list = [...F.actors].sort((a,b) => b.initiative - a.initiative).slice(0, 7);
    return `<div class="initiative-tracker" data-proto-id="PROTO-CMP-INITIATIVE-TRACKER">${list.map(a => `<div class="initiative-entry ${a.currentTurn ? 'current' : ''}" title="${esc(a.name)}"><span>${esc(a.name.slice(0,2).toUpperCase())}</span><span class="initiative-number">${a.initiative}</span></div>`).join('')}</div>`;
  }

  function sceneTokens() {
    const pos = [[27,64],[40,70],[48,60],[52,42],[63,38],[70,50],[76,33],[60,66]];
    return F.actors.map((a,i) => `<div class="token ${a.relation}" style="left:${pos[i][0]}%;top:${pos[i][1]}%" title="${esc(a.name)}">${esc(a.name.slice(0,2).toUpperCase())}</div>`).join('');
  }

  function renderScene() {
    return `<section class="scene" data-proto-id="PROTO-SURF-PLAY-${state.view === 'dm' ? 'DM' : 'PLAYER'}-${state.mode === 'initiative' ? 'INITIATIVE' : 'FREEFORM'}">
      <div class="scene-label"><span class="badge">Glass Lantern Demo</span><span class="badge ${state.mode === 'initiative' ? 'badge--accent' : ''}">${state.mode === 'initiative' ? 'Initiative · Round 1' : 'Freeform'}</span></div>
      ${initiativeTracker()}<div class="scene-table"></div>${sceneTokens()}${renderHandout()}${renderResolution()}${renderFullSheetLayer()}
    </section>`;
  }

  function notices() {
    const items = [];
    if (state.connection === 'reconnecting') items.push(`<div class="notice info"><strong>Reconnecting</strong><span>기존 세션 화면을 유지한 채 연결을 복구 중입니다.</span><span class="notice-spacer"></span><button class="svtt-btn svtt-btn--quiet">연결 정보</button></div>`);
    if (state.connection === 'disconnected') items.push(`<div class="notice danger"><strong>Disconnected</strong><span>세션 연결이 끊겼습니다.</span><span class="notice-spacer"></span><button class="svtt-btn svtt-btn--secondary">Rejoin</button></div>`);
    if (state.view === 'dm' && state.visibility === 'dm-only') items.push(`<div class="notice dm"><strong>DM ONLY</strong><span>새 DM 판정은 현재 DM에게만 보이는 mock visibility입니다.</span></div>`);
    if (state.contentSnapshotNotice) items.push(`<div class="notice"><strong>SESSION SNAPSHOT</strong><span>현재 세션: Ember Toolkit 1.2.0 · Local library: 1.3.0. 변경은 다음 세션에 적용됩니다.</span></div>`);
    if (state.error) items.push(`<div class="notice danger"><strong>Mock Error</strong><span>복구 가능한 예시 오류입니다. 실제 저장/네트워크 동작은 없습니다.</span></div>`);
    return items.length ? `<div class="notice-stack" data-proto-id="PROTO-CMP-NOTICE">${items.join('')}</div>` : '';
  }

  function commandCenter() {
    const c = F.characters[0];
    const caps = F.capabilities.map(cap => {
      let available = cap.available;
      let reason = cap.unavailableReason || '';
      if (cap.id === 'main-hand' && state.mainHandUnavailable) { available = false; reason = 'Mock authoritative state: Main Hand action is unavailable. No fallback selected.'; }
      const selected = state.action === cap.id;
      const resolving = state.resolution === 'resolving' && selected;
      return `<button class="hotbar-slot ${selected ? 'selected' : ''} ${!available ? 'unavailable' : ''} ${resolving ? 'resolving' : ''}" data-proto-id="PROTO-CMP-HOTBAR-SLOT" data-capability="${cap.id}" ${!available ? 'aria-disabled="true"' : ''} data-reason="${esc(reason)}"><span class="hotbar-slot__key">${esc(cap.shortcut)}</span><span class="hotbar-slot__label">${esc(cap.label)}</span><span class="hotbar-slot__cost">${esc(reason || cap.cost)}</span></button>`;
    }).join('');
    const execute = state.targeting === 'multi' ? `<button class="svtt-btn svtt-btn--primary" data-action="execute-multi" ${state.selectedTargets.length ? '' : 'disabled'}>Execute (${state.selectedTargets.length})</button>` : '';
    const cancel = state.action ? `<button class="svtt-btn svtt-btn--quiet" data-action="cancel-action">취소</button>` : '';
    return `<section class="command-center" data-proto-id="PROTO-CMP-COMMAND-CENTER">
      <div class="cc-actor">${avatar(c.initials)}<div><h3>${esc(c.name)}</h3><p>${state.view === 'dm' ? 'DM controlled context' : 'Player controlled Actor'}</p><div style="margin-top:6px"><span class="badge badge--success">HP ${c.hp}/${c.hpMax} +${c.tempHp}</span></div></div></div>
      <div class="cc-main"><div class="hotbar-tabs" data-proto-id="PROTO-CMP-HOTBAR-PAGE-TABS"><button class="hotbar-tab active">Mixed</button><button class="hotbar-tab">Action</button><button class="hotbar-tab">Spell</button><button class="hotbar-tab">Item</button><button class="hotbar-tab">Custom 1</button><span style="flex:1"></span>${cancel}${execute}</div><div class="hotbar">${caps}</div><div class="resource-line" data-proto-id="PROTO-CMP-RESOURCE-RAIL"><span class="resource-chip">Spell 1 · 4/4</span><span class="resource-chip">Spell 2 · 3/3</span><span class="resource-chip">Second Wind · 1/1</span><span class="resource-chip">Charge · 2/3</span><span class="resource-chip">Potion · 2</span></div></div>
      <div class="cc-side"><div class="economy-grid" data-proto-id="PROTO-CMP-ECONOMY"><div class="economy"><span>Action</span><strong>●</strong></div><div class="economy"><span>Bonus</span><strong>●</strong></div><div class="economy ${state.resolution ? 'spent' : ''}"><span>Reaction</span><strong>●</strong></div><div class="economy"><span>Move</span><strong>22 ft</strong></div></div><div class="cc-actions">${state.mode === 'initiative' ? '<button class="svtt-btn svtt-btn--primary">End Turn</button>' : '<button class="svtt-btn svtt-btn--secondary">Ping Scene</button>'}</div>${state.view === 'dm' ? `<div style="display:flex;gap:5px"><button class="svtt-btn ${state.visibility === 'public' ? 'svtt-btn--primary' : 'svtt-btn--quiet'}" data-action="set-visibility" data-value="public">Public</button><button class="svtt-btn ${state.visibility === 'dm-only' ? 'svtt-btn--primary' : 'svtt-btn--quiet'}" data-action="set-visibility" data-value="dm-only">DM Only</button></div>` : ''}</div>
    </section>`;
  }

  function activityPane() {
    let rows = F.activity;
    if (state.view === 'player') rows = rows.filter(x => x.visibility === 'public');
    if (state.view === 'dm' && state.activityFilter !== 'all') rows = rows.filter(x => x.visibility === state.activityFilter);
    return `<div class="activity-filter">${state.view === 'dm' ? `<button class="svtt-btn ${state.activityFilter === 'all' ? 'svtt-btn--primary' : 'svtt-btn--quiet'}" data-filter="all">All</button><button class="svtt-btn ${state.activityFilter === 'public' ? 'svtt-btn--primary' : 'svtt-btn--quiet'}" data-filter="public">Public</button><button class="svtt-btn ${state.activityFilter === 'dm-only' ? 'svtt-btn--primary' : 'svtt-btn--quiet'}" data-filter="dm-only">DM Only</button>` : '<span class="badge">Authorized history only</span>'}</div>${rows.map(x => `<article class="activity-item ${x.visibility === 'dm-only' ? 'private' : ''} ${x.correctionOf ? 'corrected' : ''}" data-proto-id="PROTO-CMP-ACTIVITY-ITEM"><span class="activity-time">${x.time}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.detail)}</p></div><span class="badge ${x.visibility === 'dm-only' ? 'badge--dm' : ''}">${x.visibility === 'dm-only' ? 'DM Only' : 'Public'}</span></article>`).join('')}`;
  }

  function encounterPane() {
    return `<div class="panel" style="box-shadow:none"><div class="panel-header"><h3>Encounter · Mock</h3><span class="badge badge--accent">${state.mode}</span></div><div class="panel-body small"><p class="muted">현재 Actor와 Initiative를 관리하는 contextual DM 도구 예시.</p>${F.actors.slice(0,5).map(a => `<div class="stat-row"><span>${esc(a.name)}</span><strong>${a.initiative}</strong></div>`).join('')}<button class="svtt-btn svtt-btn--secondary" style="width:100%;margin-top:10px" data-action="open-utility" data-value="spatial">고급 거리/시야/엄폐</button></div></div>`;
  }

  function spatialPane() {
    return `<div class="inline-alert">고급 DM 도구 · 기본 Play에는 항상 열려 있지 않습니다.</div><div class="form-stack" style="margin-top:10px"><label class="field"><span>Actor A</span><select><option>Rowan Ash</option><option>Mina Vale</option></select></label><label class="field"><span>Actor B</span><select><option>Ash Raider</option><option>Iron Hound</option></select></label><label class="field"><span>Distance</span><input value="Mock 25 ft"></label><label class="field"><span>Visibility</span><select><option>Visible</option><option>Obscured</option></select></label><label class="field"><span>Cover</span><select><option>None</option><option>Half</option><option>Three Quarters</option></select></label><button class="svtt-btn svtt-btn--primary">Apply Mock Relation</button></div>`;
  }

  function sessionSharePane() {
    return `<div class="form-stack"><div class="stat-block"><h3>SESSION</h3><div class="stat-row"><span>Address</span><strong>192.168.0.42:4877</strong></div><div class="stat-row"><span>State</span><strong>Live</strong></div><div class="stat-row"><span>Content Snapshot</span><strong>demo-snapshot-A</strong></div></div><div class="inline-alert">Local Ember Toolkit 1.3.0이 있어도 현재 live session은 1.2.0 snapshot을 유지합니다.</div><button class="svtt-btn svtt-btn--danger" data-action="open-confirm" data-kind="session">End Session</button></div>`;
  }

  function utilityPane() {
    if (!state.utility || state.utility === 'full-sheet') return '';
    const map = {
      activity: ['Activity', activityPane()], encounter: ['Encounter', encounterPane()], spatial: ['Advanced Spatial Relation', spatialPane()],
      'session-share': ['Session Share', sessionSharePane()], rules: ['Rules', '<div class="small muted">Contextual rules lookup. Product route와 같은 데이터지만 Play를 벗어나지 않습니다.</div>'],
      participants: ['Participants', '<div class="stat-row"><span>Demo DM</span><strong>Host · DM</strong></div><div class="stat-row"><span>Rowan</span><strong>Client · Player</strong></div><div class="stat-row"><span>Mina</span><strong>Client · Player</strong></div>'],
      'player-session': ['Session', '<div class="small muted">Connected · Client / Player</div><div class="form-actions"><button class="svtt-btn svtt-btn--secondary">Rejoin</button><button class="svtt-btn svtt-btn--danger">Leave</button></div>']
    };
    const [title, body] = map[state.utility] || ['Utility', '<span class="muted small">Mock utility</span>'];
    return `<aside class="utility-pane" data-proto-id="PROTO-CMP-UTILITY-PANE"><div class="resize-gutter" title="Resize panel"></div><div class="utility-content"><div class="utility-header"><h3>${title}</h3><div class="spacer"></div><button class="svtt-btn svtt-btn--quiet" data-action="reset-layout">Reset</button><button class="svtt-btn svtt-btn--icon svtt-btn--quiet" data-action="close-utility" aria-label="닫기">×</button></div><div class="utility-body">${body}</div></div></aside>`;
  }

  function renderHandout() {
    if (!state.handout || state.handout === 'none') return '';
    if (state.handout === 'overlay' && state.handoutDismissed) {
      return `<div class="layer"><div style="position:absolute;right:12px;top:52px;pointer-events:auto"><button class="svtt-btn svtt-btn--secondary" data-action="reopen-handout">Handout 다시 열기</button></div></div>`;
    }
    const cls = state.handout === 'overlay' ? 'handout-overlay' : state.handout === 'upper' ? 'handout-upper' : 'handout-full';
    const canDismiss = state.handout === 'overlay';
    return `<div class="layer" data-proto-id="PROTO-CMP-HANDOUT-VIEW"><section class="${cls}"><div class="handout-toolbar"><strong>Old Observatory</strong><span class="badge">${state.handout.toUpperCase()}</span><div class="spacer"></div><button class="svtt-btn svtt-btn--quiet">−</button><span class="small">100%</span><button class="svtt-btn svtt-btn--quiet">+</button>${canDismiss ? '<button class="svtt-btn svtt-btn--secondary" data-action="dismiss-handout">최소화</button>' : '<span class="badge">DM controlled</span>'}</div><div class="handout-art"></div></section></div>`;
  }

  function renderResolution() {
    const parts = [];
    if (state.resolution === 'resolving') parts.push(`<div class="resolution-card"><div class="resolution-card__header"><span>Resolving</span><span class="badge badge--info">Mock conflict flags</span></div><div class="resolution-card__body"><h3>Arc Bolt · Ash Raider</h3><p>Command Center skeleton은 유지됩니다. fixture가 conflicting으로 지정한 제어만 잠긴 예시입니다.</p></div></div>`);
    if (state.resolution === 'interrupt') parts.push(`<div class="resolution-card"><div class="resolution-card__header"><span>Reaction / Interrupt</span><span class="badge badge--accent">Response required</span></div><div class="resolution-card__body"><h3>Rowan에게 반응 기회가 있습니다.</h3><p>Timeout은 정의하지 않습니다. 실제 반응 가능 여부/시간은 authoritative contract가 제공합니다.</p><div class="reaction-actions"><button class="svtt-btn svtt-btn--primary">Use Reaction</button><button class="svtt-btn svtt-btn--secondary">Pass</button></div></div></div>`);
    if (state.resolution === 'concentration') parts.push(`<div class="resolution-card"><div class="resolution-card__header"><span>Concentration Save</span><span class="badge badge--info">Mock response</span></div><div class="resolution-card__body"><h3>집중 내성 입력</h3><p>실제 DC/성공 판정은 계산하지 않습니다.</p><label class="field" style="margin-top:10px"><span>d20 result fixture</span><input value="14"></label><div class="reaction-actions"><button class="svtt-btn svtt-btn--primary">Submit Mock Result</button></div></div></div>`);
    if (state.dice || state.resolution === 'result') parts.push(`<div class="dice-stage"><div class="dice">17</div></div>`);
    if (state.result || state.resolution === 'result') parts.push(`<div class="result-strip" data-proto-id="PROTO-CMP-RESULT-STRIP"><strong>Mock Hit · 21 total</strong><span>final d20: 17</span><span style="flex:1"></span><button class="svtt-btn svtt-btn--quiet" data-action="open-utility" data-value="activity">Activity 상세</button></div>`);
    return parts.join('');
  }

  function renderFullSheetLayer() {
    if (state.utility !== 'full-sheet') return '';
    const c = F.characters[0];
    return `<div class="layer" style="z-index:30;pointer-events:auto"><section style="position:absolute;inset:3%;border:1px solid #56626d;border-radius:8px;background:#11161b;box-shadow:var(--shadow);overflow:hidden"><div class="sheet-toolbar"><h2>${esc(c.name)} · Full Sheet</h2><span class="badge badge--info">Live session preserved</span><button class="svtt-btn svtt-btn--quiet" style="margin-left:auto" data-action="close-utility">닫기</button></div><div class="sheet-content"><div class="grid-3">${sheetStatBlock('IDENTITY', [['HP','38/44 +4'],['State','Live'],['Control','Player']])}${sheetStatBlock('ACTIONS', [['Main Hand','Available'],['Arc Bolt','Available'],['Guard','Reaction']])}${sheetStatBlock('NOTES', [['Connection',state.connection],['Sheet','Official-style']])}</div></div></section></div>`;
  }

  function contextMenu() {
    if (!state.contextActor) return '';
    const a = byId(F.actors, state.contextActor);
    return `<div class="context-menu" data-proto-id="PROTO-CMP-ACTOR-CONTEXT-MENU" style="left:${state.contextX}px;top:${state.contextY}px"><button data-action="inspect-actor">Details / Inspect · ${esc(a?.name || '')}</button><button data-action="open-utility" data-value="full-sheet">Open detail</button>${state.view === 'dm' ? '<button data-action="open-utility" data-value="spatial">DM context relation</button>' : ''}<button data-action="close-context">Close</button></div>`;
  }

  function hoverFrame() {
    if (!state.hoverCapability) return '';
    const cap = byId(F.capabilities, state.hoverCapability.id);
    if (!cap) return '';
    const reason = state.hoverCapability.reason || cap.unavailableReason;
    return `<div class="hover-frame" data-proto-id="PROTO-CMP-HOVER-FRAME" style="left:${state.hoverCapability.x}px;top:${state.hoverCapability.y}px"><h4>${esc(cap.label)}</h4><p>${esc(cap.category)} · ${esc(cap.cost)}</p><p>Prototype explanation frame. 실제 규칙 텍스트/계산은 포함하지 않습니다.</p>${reason ? `<p class="reason">${esc(reason)}</p>` : ''}</div>`;
  }

  function confirmLayer() {
    if (!state.showConfirm) return '';
    const isSession = state.confirmKind === 'session';
    return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><h3>${isSession ? '세션을 종료할까요?' : '콘텐츠를 삭제할까요?'}</h3><div class="modal-body">${isSession ? 'Live session을 끝내는 destructive action 예시입니다.' : '설치된 package 제거 예시입니다. 실제 dependency semantics는 fixture/contract에서 제공됩니다.'}</div><div class="modal-actions"><button class="svtt-btn svtt-btn--quiet" data-action="close-confirm">취소</button><button class="svtt-btn svtt-btn--danger" data-action="close-confirm">${isSession ? 'End Session' : 'Delete'}</button></div></section></div>`;
  }

  function renderPlay() {
    const dm = state.view === 'dm';
    const launchers = `<div class="utility-launchers">${dm ? '<button class="svtt-btn svtt-btn--quiet" data-action="open-utility" data-value="activity">Activity</button><button class="svtt-btn svtt-btn--quiet" data-action="open-utility" data-value="encounter">Encounter</button><button class="svtt-btn svtt-btn--quiet" data-action="open-utility" data-value="participants">Participants</button><button class="svtt-btn svtt-btn--quiet" data-action="open-utility" data-value="session-share">Session</button>' : '<button class="svtt-btn svtt-btn--quiet" data-action="open-utility" data-value="activity">Activity</button><button class="svtt-btn svtt-btn--quiet" data-action="open-utility" data-value="rules">Rules</button><button class="svtt-btn svtt-btn--quiet" data-action="open-utility" data-value="player-session">Session</button>'}<button class="svtt-btn svtt-btn--quiet" data-action="open-utility" data-value="full-sheet">Full Sheet</button></div>`;
    return `<div class="play-shell"><header class="play-topbar"><button class="svtt-btn svtt-btn--quiet" data-nav="home">SimpleVTT</button><span class="session-title">Glass Lantern Demo</span><span class="badge ${dm ? 'badge--accent' : 'badge--info'}">${dm ? 'Host · DM' : 'Client · Player'}</span><span class="badge ${state.connection === 'connected' ? 'badge--success' : 'badge--danger'}">${state.connection}</span><div class="spacer"></div>${launchers}</header><div class="play-body"><section class="play-main">${actorBoard('opposing')}${renderScene()}${actorBoard('allied')}${commandCenter()}${notices()}${contextMenu()}${hoverFrame()}${confirmLayer()}${state.loading ? '<div class="proto-loading-overlay"><div><div class="spinner"></div><div class="small muted" style="margin-top:10px">Mock pending…</div></div></div>' : ''}${state.error ? '<div class="toast-stack"><div class="toast error">Mock recoverable error · 이 메시지는 실제 네트워크/저장 오류가 아닙니다.</div></div>' : ''}</section>${utilityPane()}</div></div>`;
  }

  function renderComponentGallery() {
    const a = F.actors[4];
    const activityRows = F.activity.slice(0,3).map(x => `<article class="activity-item ${x.visibility === 'dm-only' ? 'private' : ''}"><span class="activity-time">${x.time}</span><div><strong>${esc(x.title)}</strong><p>${esc(x.detail)}</p></div><span class="badge ${x.visibility === 'dm-only' ? 'badge--dm' : ''}">${x.visibility}</span></article>`).join('');
    return `<div class="component-gallery" data-proto-id="PROTO-SURF-COMPONENT-GALLERY"><div class="proto-kicker">COMPONENT GALLERY · NOT PRODUCT ROUTE</div><h2>SimpleVTT reference components</h2><p>같은 상태/색/밀도를 한 화면에서 비교하기 위한 prototype-only scene.</p>
      <section class="gallery-section"><h3>Buttons</h3><div class="gallery-row"><button class="svtt-btn svtt-btn--primary">Primary</button><button class="svtt-btn svtt-btn--secondary">Secondary</button><button class="svtt-btn svtt-btn--quiet">Quiet</button><button class="svtt-btn svtt-btn--danger">Destructive</button><button class="svtt-btn" disabled>Disabled</button></div></section>
      <section class="gallery-section"><h3>Status / Notice</h3><div class="gallery-row"><span class="badge badge--success">Connected</span><span class="badge badge--accent">Current Turn</span><span class="badge badge--dm">DM Only</span><span class="badge badge--danger">Error</span></div><div class="notice dm" style="margin-top:10px"><strong>DM ONLY</strong><span>Persistent state example</span></div></section>
      <section class="gallery-section"><h3>Actor Card states</h3><div class="gallery-actor-row">${actorCard({...a, valid:true})}${actorCard({...a,id:'x2',name:'Invalid Target',valid:false,invalidReason:'Mock invalid'})}${actorCard({...F.actors[0],id:'x3'})}</div></section>
      <section class="gallery-section"><h3>Activity visibility</h3>${activityRows}</section>
      <section class="gallery-section"><h3>Inputs</h3><div class="grid-3"><label class="field"><span>Normal</span><input value="Mock value"></label><label class="field"><span>Warning</span><input value="Needs review"><small class="field-error" style="color:var(--warning)">Mock warning</small></label><label class="field"><span>Error</span><input value="Invalid"><small class="field-error">Mock blocking error</small></label></div></section>
      <section class="gallery-section"><h3>Layer examples</h3><div class="gallery-row"><button class="svtt-btn svtt-btn--secondary" data-action="open-confirm" data-kind="content">Open Modal</button><button class="svtt-btn svtt-btn--secondary" data-action="set-demo-handout">Show Handout</button></div></section>${confirmLayer()}</div>`;
  }

  function renderSurface() {
    switch (state.surface) {
      case 'first-run': return renderFirstRun();
      case 'home': return renderHome();
      case 'characters': return renderCharacters();
      case 'sheet-official': return renderSheet('official');
      case 'sheet-svtt': return renderSheet('svtt');
      case 'builder': return renderBuilder(false);
      case 'level-up': return renderBuilder(true);
      case 'host-setup': return renderHostSetup();
      case 'join': return renderJoin();
      case 'content': return renderContent(false);
      case 'content-import': return renderContent(true);
      case 'rules': return renderRules();
      case 'settings': return renderSettings();
      case 'components': return renderComponentGallery();
      case 'play': default: return renderPlay();
    }
  }

  function render() {
    viewport.className = `prototype-viewport vp-${state.viewport || 'normal'}`;
    viewport.dataset.protoViewport = state.viewport || 'normal';
    document.body.classList.toggle('reduced-motion', !!state.reducedMotion);
    const s = scenarioById(state.scenarioId);
    scenarioTitle.textContent = s ? `${s.id} · ${s.label.replace(/^\d+ · /, '')}` : 'Custom Prototype State';
    scenarioMeta.textContent = `${state.view.toUpperCase()} · ${state.mode.toUpperCase()} · ${(state.viewport || 'normal').toUpperCase()} · HTML MOCK`;
    root.innerHTML = renderSurface();
    attachHoverFrames();
  }

  function attachHoverFrames() {
    root.querySelectorAll('[data-capability]').forEach(el => {
      el.addEventListener('pointerenter', () => {
        const r = el.getBoundingClientRect();
        const vr = viewport.getBoundingClientRect();
        state.hoverCapability = {
          id: el.dataset.capability,
          reason: el.dataset.reason || '',
          x: Math.max(8, Math.min(viewport.clientWidth - 270, r.left - vr.left)),
          y: Math.max(48, Math.min(viewport.clientHeight - 190, r.top - vr.top - 126))
        };
        render();
      }, { once: true });
    });
  }

  function setSurface(surface) {
    if (surface === 'session') surface = 'host-setup';
    if (surface === 'play') surface = 'play';
    state.surface = surface;
    state.contextActor = null;
    state.hoverCapability = null;
    render();
  }

  scenarioSelect.innerHTML = F.scenarios.map(s => `<option value="${s.id}">${esc(s.label)}</option>`).join('');

  scenarioSelect.addEventListener('change', e => applyScenario(e.target.value));
  viewSelect.addEventListener('change', e => { state.view = e.target.value; render(); });
  modeSelect.addEventListener('change', e => { state.mode = e.target.value; render(); });
  viewportSelect.addEventListener('change', e => { state.viewport = e.target.value; render(); });
  connectionSelect.addEventListener('change', e => { state.connection = e.target.value; render(); });
  handoutSelect.addEventListener('change', e => { state.handout = e.target.value; state.handoutDismissed = false; render(); });
  visibilitySelect.addEventListener('change', e => { state.visibility = e.target.value; render(); });
  reducedMotionToggle.addEventListener('change', e => { state.reducedMotion = e.target.checked; render(); });
  errorToggle.addEventListener('change', e => { state.error = e.target.checked; render(); });
  loadingToggle.addEventListener('change', e => { state.loading = e.target.checked; render(); });

  document.addEventListener('click', e => {
    const protoCommand = e.target.closest('[data-proto-command]');
    if (protoCommand) {
      if (protoCommand.dataset.protoCommand === 'components') { state.surface = 'components'; state.scenarioId = 'PROTO-SCN-34'; syncControls(); render(); }
      if (protoCommand.dataset.protoCommand === 'reset') { viewport.style.setProperty('--utility-w', '330px'); applyScenario(state.scenarioId); }
      return;
    }

    if (!root.contains(e.target)) return;
    const navEl = e.target.closest('[data-nav]');
    if (navEl) { setSurface(navEl.dataset.nav); return; }

    const openChar = e.target.closest('[data-open-character]');
    if (openChar) { state.selectedCharacter = openChar.dataset.openCharacter; state.surface = state.selectedSheet === 'svtt' ? 'sheet-svtt' : 'sheet-official'; render(); return; }

    const action = e.target.closest('[data-action]');
    if (!action) {
      if (state.contextActor) { state.contextActor = null; render(); }
      return;
    }
    const type = action.dataset.action;
    const value = action.dataset.value;
    if (type === 'choose-sheet') { state.selectedSheet = value; render(); }
    if (type === 'finish-first-run') { state.surface = 'home'; render(); }
    if (type === 'switch-sheet') { state.selectedSheet = value; state.surface = value === 'svtt' ? 'sheet-svtt' : 'sheet-official'; render(); }
    if (type === 'sheet-roll') { state.result = true; state.dice = true; state.surface = 'sheet-official'; render(); }
    if (type === 'open-session') { Object.assign(state, { surface:'play', view:'dm', mode:'freeform', connection:'connected', utility:null, contentSnapshotNotice:true }); syncControls(); render(); }
    if (type === 'join-live') { Object.assign(state, { surface:'play', view:'player', mode:'freeform', connection:'connected', utility:null }); syncControls(); render(); }
    if (type === 'open-utility') { state.utility = value; state.contextActor = null; render(); }
    if (type === 'close-utility') { state.utility = null; render(); }
    if (type === 'reset-layout') { viewport.style.setProperty('--utility-w', '330px'); render(); }
    if (type === 'set-visibility') { state.visibility = value; visibilitySelect.value = value; render(); }
    if (type === 'cancel-action') { state.action = null; state.targeting = null; state.selectedTargets = []; render(); }
    if (type === 'execute-multi') { state.resolution = 'resolving'; render(); }
    if (type === 'dismiss-handout') { state.handoutDismissed = true; render(); }
    if (type === 'reopen-handout') { state.handoutDismissed = false; render(); }
    if (type === 'close-context') { state.contextActor = null; render(); }
    if (type === 'open-confirm') { state.showConfirm = true; state.confirmKind = action.dataset.kind || 'normal'; render(); }
    if (type === 'close-confirm') { state.showConfirm = false; render(); }
    if (type === 'set-demo-handout') { state.surface = 'play'; state.view = 'player'; state.handout = 'overlay'; handoutSelect.value = 'overlay'; render(); }
    if (type === 'toggle-reduced') { state.reducedMotion = !state.reducedMotion; reducedMotionToggle.checked = state.reducedMotion; render(); }
  });

  root.addEventListener('click', e => {
    const cap = e.target.closest('[data-capability]');
    if (cap) {
      const c = byId(F.capabilities, cap.dataset.capability);
      const mainBlocked = c.id === 'main-hand' && state.mainHandUnavailable;
      if (!c.available || mainBlocked) return;
      state.action = c.id;
      state.targeting = c.targetMode === 'single' || c.targetMode === 'multi' ? c.targetMode : null;
      state.selectedTargets = [];
      state.hoverCapability = null;
      render();
      return;
    }
    const actor = e.target.closest('[data-actor]');
    if (actor && state.targeting) {
      const a = byId(F.actors, actor.dataset.actor);
      if (!a?.valid) return;
      if (state.targeting === 'single') {
        state.selectedTargets = [a.id];
        state.resolution = 'resolving';
      } else {
        state.selectedTargets = state.selectedTargets.includes(a.id) ? state.selectedTargets.filter(x => x !== a.id) : [...state.selectedTargets, a.id];
      }
      render();
      return;
    }
    const filter = e.target.closest('[data-filter]');
    if (filter) { state.activityFilter = filter.dataset.filter; render(); }
  });

  root.addEventListener('contextmenu', e => {
    const actor = e.target.closest('[data-actor]');
    if (!actor) return;
    e.preventDefault();
    const vr = viewport.getBoundingClientRect();
    state.contextActor = actor.dataset.actor;
    state.contextX = Math.max(8, Math.min(viewport.clientWidth - 180, e.clientX - vr.left));
    state.contextY = Math.max(48, Math.min(viewport.clientHeight - 170, e.clientY - vr.top));
    render();
  });

  let resize = null;
  root.addEventListener('pointerdown', e => {
    const gutter = e.target.closest('.resize-gutter');
    if (!gutter) return;
    const pane = gutter.closest('.utility-pane');
    resize = { startX: e.clientX, startWidth: pane.getBoundingClientRect().width };
    gutter.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('pointermove', e => {
    if (!resize) return;
    const next = Math.max(260, Math.min(520, resize.startWidth + (resize.startX - e.clientX)));
    viewport.style.setProperty('--utility-w', `${next}px`);
  });
  document.addEventListener('pointerup', () => { resize = null; root.querySelector('.resize-gutter')?.classList.remove('dragging'); });

  applyScenario('PROTO-SCN-08');
})();
