(() => {
  'use strict';

  const F = window.SVTT_FINAL_SPEC_FIXTURES;
  const root = document.getElementById('appRoot');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const scenarioTitle = document.getElementById('scenarioTitle');
  const scenarioMeta = document.getElementById('scenarioMeta');
  const sheetStyleSelect = document.getElementById('sheetStyleSelect');
  if (!F || !root || !scenarioSelect) return;

  const extraScenarios = [
    { id:'FINAL-SCN-FIRST-RUN', label:'Product · First Run', surface:'coverage-first-run', view:'offline' },
    { id:'FINAL-SCN-BUILDER', label:'Character · Builder reference', surface:'coverage-builder', view:'offline' },
    { id:'FINAL-SCN-LEVEL-UP', label:'Character · Level Up reference', surface:'coverage-level-up', view:'offline' },
    { id:'FINAL-SCN-CONTENT-IMPORT', label:'Content · Package Import Review', surface:'coverage-content-import', view:'offline' },
    { id:'FINAL-SCN-MAIN-HAND-UNAVAILABLE', label:'Session · Main Hand unavailable', surface:'play', view:'player', mode:'initiative', mainHandUnavailable:true },
    { id:'FINAL-SCN-INTERRUPT', label:'Session · Reaction / Interrupt', surface:'play', view:'player', mode:'initiative', resolution:'interrupt' },
    { id:'FINAL-SCN-CONCENTRATION', label:'Session · Concentration response', surface:'play', view:'player', mode:'initiative', resolution:'concentration' },
    { id:'FINAL-SCN-QUICK-SHEET', label:'Session · Quick Sheet layer', surface:'play', view:'player', mode:'freeform' },
    { id:'FINAL-SCN-FULL-SHEET', label:'Session · Full Character Sheet layer', surface:'play', view:'player', mode:'freeform' },
    { id:'FINAL-SCN-RECONNECT', label:'Session · Reconnecting', surface:'play', view:'player', mode:'freeform', connection:'reconnecting' },
    { id:'FINAL-SCN-PANEL-RESIZE', label:'Session · Utility panel resize', surface:'play', view:'dm', mode:'freeform', utility:'activity' },
    { id:'FINAL-SCN-CONFIRM', label:'Session · Confirmation layer priority', surface:'play', view:'dm', mode:'freeform' }
  ];

  extraScenarios.forEach(s => {
    if (!F.scenarios.some(x => x.id === s.id)) F.scenarios.push(s);
    if (![...scenarioSelect.options].some(o => o.value === s.id)) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.label;
      scenarioSelect.appendChild(opt);
    }
  });

  const esc = value => String(value ?? '')
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');

  function productNav(active) {
    const items = [['home','홈'],['characters','캐릭터'],['session','세션'],['content','콘텐츠'],['rules','룰'],['settings','설정']];
    return `<nav class="product-nav"><div class="product-brand"><div class="product-brand__mark"></div><strong>SimpleVTT</strong></div>${items.map(([id,label]) => `<button class="nav-item ${active===id?'active':''}" data-nav="${id}">${label}</button>`).join('')}<div class="nav-spacer"></div></nav>`;
  }

  function shell(active, content) {
    return `<div class="product-shell">${productNav(active)}${content}</div>`;
  }

  function setMeta(label, meta) {
    scenarioTitle.textContent = label;
    scenarioMeta.textContent = meta;
  }

  function renderFirstRun() {
    setMeta('Product · First Run','offline · onboarding');
    root.innerHTML = `<div class="final-first-run"><section class="final-first-run__card"><div class="demo-kicker">WELCOME TO SIMPLEVTT</div><h1>처음 사용할 Character Sheet 방식을 고르세요.</h1><p>두 Sheet는 같은 Character 정보를 사용합니다. 기본 표현 방식을 고르는 것이며 Settings에서 언제든 바꿀 수 있습니다.</p><div class="final-choice-grid"><button class="final-choice" data-coverage-sheet="official"><h3>Official-style Sheet</h3><p>종이 Character Sheet처럼 전체 기록을 밀도 있게 읽는 구성. 모든 Standalone roll은 이 Sheet 안에서 그대로 굴러갑니다.</p></button><button class="final-choice" data-coverage-sheet="svtt"><h3>SimpleVTT Sheet</h3><p>자주 쓰는 행동과 현재 상태를 빠르게 찾는 구성. Roll behavior는 Official-style과 동일하게 same-surface입니다.</p></button></div><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn quiet" data-nav="home">나중에</button><button class="btn primary" data-coverage-sheet="official">시작</button></div></section></div>`;
  }

  function builderStep(index,label,active=false) {
    return `<button class="builder-step ${active?'active':''}">${index}. ${esc(label)}</button>`;
  }

  function renderBuilder(levelUp=false) {
    setMeta(levelUp?'Character · Level Up reference':'Character · Builder reference','offline · accepted workflow shell');
    root.innerHTML = shell('characters',`<main class="product-page"><div class="page-heading"><div><h2>${levelUp?'Level Up':'Character Builder'}</h2><p>기존 승인된 Builder / Level Up 흐름을 유지하면서 Final-Spec visual grammar만 적용합니다.</p></div><button class="btn quiet" data-nav="characters">취소</button></div><div class="builder-layout"><aside class="builder-steps">${builderStep(1,levelUp?'Level preview':'Identity',true)}${builderStep(2,levelUp?'Choices':'Class & Background')}${builderStep(3,levelUp?'Feature review':'Abilities')}${builderStep(4,levelUp?'Commit':'Equipment')}${!levelUp?builderStep(5,'Review'):''}</aside><section class="builder-form"><h3>${levelUp?'다음 레벨 선택':'기본 정보'}</h3><div class="builder-form-grid"><label class="builder-field">Character<input value="Rowan Ash"></label><label class="builder-field">${levelUp?'Target Level':'Creation Mode'}<select><option>${levelUp?'Fighter 6':'Guided'}</option><option>${levelUp?'Keep current':'Quick'}</option></select></label><label class="builder-field">Source<select><option>Core Fixture</option></select></label><label class="builder-field">Status<input value="Valid fixture"></label></div><div class="notice" style="margin-top:12px">Rules-dependent choices and validation are authoritative inputs in production. This prototype does not calculate them.</div><div style="display:flex;justify-content:flex-end;gap:7px;margin-top:14px"><button class="btn">Back</button><button class="btn primary">${levelUp?'Review Level Up':'Next'}</button></div></section><aside class="builder-preview"><div class="character-portrait" style="height:160px">RA</div><h3>Rowan Ash</h3><p class="muted">Fighter 5 · preview fixture</p><div class="utility-row"><strong>HP</strong><span>38 / 44 +4 Temp</span></div><div class="utility-row"><strong>AC</strong><span>17</span></div></aside></div></main>`);
  }

  function renderContentImport() {
    setMeta('Content · Package Import Review','offline · official SimpleVTT package');
    root.innerHTML = shell('content',`<main class="product-page"><div class="page-heading"><div><h2>Package Import Review</h2><p>Preview → validation → install. Unsupported/blocked state is explicit rather than guessed.</p></div><button class="btn quiet" data-nav="content">Cancel</button></div><div class="import-review"><section class="import-summary"><h3>Ember Toolkit 1.3.0</h3><p class="muted">simplevtt-package · fixture metadata</p><div class="import-check good"><div class="import-check__icon">✓</div><div><strong>Manifest valid</strong><p>Required fixture fields are present.</p></div></div><div class="import-check good"><div class="import-check__icon">✓</div><div><strong>Content preview ready</strong><p>12 rules records · 4 action definitions · fixture only.</p></div></div><div class="import-check warn"><div class="import-check__icon">!</div><div><strong>Existing package detected</strong><p>Installing will update/replace future-session library content. Current live session snapshot remains unchanged.</p></div></div><div class="import-check block"><div class="import-check__icon">×</div><div><strong>Blocking example</strong><p>A real unsupported mechanic would block activation rather than being approximated by UI.</p></div></div></section><aside class="panel"><div class="panel__head"><h3>Install summary</h3></div><div class="panel__body" style="display:grid;gap:9px"><div class="utility-row"><strong>Current</strong><span>1.2.0</span></div><div class="utility-row"><strong>Incoming</strong><span>1.3.0</span></div><div class="notice">Live session uses captured 1.2.0 snapshot until a later session.</div><button class="btn primary">Install / Update</button></div></aside></div></main>`);
  }

  function renderQuickSheet() {
    const play = root.querySelector('.play-root');
    if (!play || play.querySelector('.quick-sheet-layer')) return;
    play.insertAdjacentHTML('beforeend',`<section class="quick-sheet-layer"><div class="quick-sheet-layer__head"><strong>Quick Sheet · Rowan Ash</strong><button class="chrome-btn" data-coverage-close-layer>Close</button></div><div class="quick-sheet-layer__body"><div class="utility-row"><strong>HP</strong><span>38 / 44 +4 Temp</span></div><div class="utility-row"><strong>AC</strong><span>17</span></div><div class="utility-row"><strong>Conditions</strong><span>—</span></div><div class="utility-row"><strong>Main Hand</strong><span>Longsword · fixture</span></div><button class="btn" data-coverage-full-sheet style="margin-top:8px">Open Full Sheet</button></div></section>`);
  }

  function renderFullSheet() {
    const play = root.querySelector('.play-root');
    if (!play || play.querySelector('.full-sheet-layer')) return;
    play.insertAdjacentHTML('beforeend',`<section class="full-sheet-layer"><div class="full-sheet-layer__head"><strong>Full Character Sheet · Live Session continues behind this layer</strong><button class="chrome-btn" data-coverage-close-layer>Return to Play</button></div><div class="full-sheet-layer__body"><div class="full-sheet-mini"><section class="panel"><div class="panel__head"><h3>Rowan Ash</h3></div><div class="panel__body"><div class="character-portrait" style="height:120px">RA</div><p>Fighter 5</p><div class="utility-row"><strong>HP</strong><span>38/44 +4</span></div></div></section><section class="panel"><div class="panel__head"><h3>Actions & Features</h3></div><div class="panel__body"><div class="utility-row"><strong>Main Hand Strike</strong><span>fixture action</span></div><div class="utility-row"><strong>Second Wind</strong><span>1/1</span></div><div class="utility-row"><strong>Action Surge</strong><span>1/1</span></div></div></section><section class="panel"><div class="panel__head"><h3>Resources</h3></div><div class="panel__body"><div class="utility-row"><strong>Superiority</strong><span>3/4</span></div><div class="notice">This is a presentation layer. Live session/game state is preserved.</div></div></section></div></div></section>`);
  }

  function renderResolutionPrompt(kind) {
    const scene = root.querySelector('.scene-table');
    if (!scene || scene.querySelector('.resolution-prompt')) return;
    if (kind==='interrupt') {
      scene.insertAdjacentHTML('beforeend',`<section class="resolution-prompt"><div class="resolution-prompt__head"><span class="badge warn">Reaction / Interrupt</span><strong>Fixture response requested</strong></div><div class="resolution-prompt__body"><div class="notice">Scene, Actor Boards and Command Center remain visible. No timeout is invented by prototype.</div><div class="resolution-options"><button class="resolution-option"><strong>Use Reaction</strong><span>Explicit fixture response path</span></button><button class="resolution-option"><strong>Decline</strong><span>Return to current resolution context</span></button></div></div></section>`);
    } else {
      scene.insertAdjacentHTML('beforeend',`<section class="resolution-prompt"><div class="resolution-prompt__head"><span class="badge warn">Concentration</span><strong>Save response fixture</strong></div><div class="resolution-prompt__body"><div class="notice">The prototype does not calculate DC, modifier or legality.</div><div style="display:flex;gap:7px"><input value="13" style="height:36px;flex:1;border:1px solid var(--line);background:#0f151b;padding:0 9px"><button class="btn primary">Submit fixture d20</button></div></div></section>`);
    }
  }

  function renderConfirm() {
    const play = root.querySelector('.play-root');
    if (!play || play.querySelector('.resolution-prompt')) return;
    play.insertAdjacentHTML('beforeend',`<section class="resolution-prompt" style="z-index:25"><div class="resolution-prompt__head"><span class="badge hostile">Confirmation</span><strong>End live session?</strong></div><div class="resolution-prompt__body"><p class="muted" style="margin:0">This destructive example outranks contextual panes. Ordinary targeting never uses this extra confirmation.</p><div style="display:flex;justify-content:flex-end;gap:7px"><button class="btn">Cancel</button><button class="btn danger">End Session</button></div></div></section>`);
  }

  function ensureResizeHandle() {
    const pane = root.querySelector('.utility-pane');
    if (!pane || pane.querySelector('.utility-resize-handle')) return;
    pane.insertAdjacentHTML('afterbegin','<div class="utility-resize-handle" data-coverage-resize aria-hidden="true"></div>');
  }

  function applyScenarioOverlay() {
    const id = scenarioSelect.value;
    if (id==='FINAL-SCN-INTERRUPT') renderResolutionPrompt('interrupt');
    if (id==='FINAL-SCN-CONCENTRATION') renderResolutionPrompt('concentration');
    if (id==='FINAL-SCN-QUICK-SHEET') renderQuickSheet();
    if (id==='FINAL-SCN-FULL-SHEET') renderFullSheet();
    if (id==='FINAL-SCN-CONFIRM') renderConfirm();
    if (root.querySelector('.utility-pane')) ensureResizeHandle();
  }

  const customRenderers = {
    'FINAL-SCN-FIRST-RUN': renderFirstRun,
    'FINAL-SCN-BUILDER': () => renderBuilder(false),
    'FINAL-SCN-LEVEL-UP': () => renderBuilder(true),
    'FINAL-SCN-CONTENT-IMPORT': renderContentImport
  };

  scenarioSelect.addEventListener('change', event => {
    const renderer = customRenderers[scenarioSelect.value];
    if (!renderer) {
      setTimeout(applyScenarioOverlay,0);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    renderer();
  }, true);

  root.addEventListener('click', event => {
    const sheet = event.target.closest('[data-coverage-sheet]');
    if (sheet) {
      const value = sheet.dataset.coverageSheet;
      sheetStyleSelect.value = value;
      sheetStyleSelect.dispatchEvent(new Event('change',{ bubbles:true }));
      return;
    }
    if (event.target.closest('[data-coverage-close-layer]')) {
      scenarioSelect.value='FINAL-SCN-PLAYER-FREEFORM';
      scenarioSelect.dispatchEvent(new Event('change',{ bubbles:true }));
      return;
    }
    if (event.target.closest('[data-coverage-full-sheet]')) {
      scenarioSelect.value='FINAL-SCN-FULL-SHEET';
      scenarioSelect.dispatchEvent(new Event('change',{ bubbles:true }));
    }
  }, true);

  let resizeStart = null;
  root.addEventListener('pointerdown', event => {
    const handle = event.target.closest('[data-coverage-resize]');
    if (!handle) return;
    const pane = handle.closest('.utility-pane');
    if (!pane) return;
    resizeStart = { pane, startX:event.clientX, startW:pane.getBoundingClientRect().width };
    handle.classList.add('dragging');
    handle.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  window.addEventListener('pointermove', event => {
    if (!resizeStart) return;
    const next = Math.max(292,Math.min(460,resizeStart.startW + (resizeStart.startX - event.clientX)));
    resizeStart.pane.style.width=`${next}px`;
  });

  window.addEventListener('pointerup', () => {
    root.querySelector('.utility-resize-handle.dragging')?.classList.remove('dragging');
    resizeStart=null;
  });

  const observer = new MutationObserver(() => queueMicrotask(applyScenarioOverlay));
  observer.observe(root,{ childList:true,subtree:true });
  setTimeout(applyScenarioOverlay,0);
})();
