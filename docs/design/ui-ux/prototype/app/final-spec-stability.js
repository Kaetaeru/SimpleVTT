(() => {
  'use strict';

  const root = document.getElementById('appRoot');
  const F = window.SVTT_FINAL_SPEC_FIXTURES;
  const scenarioSelect = document.getElementById('scenarioSelect');
  if (!root || !F || !scenarioSelect) return;

  let tooltip = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  function clearTooltip() {
    if (tooltip) tooltip.remove();
    tooltip = null;
  }

  function showTooltip(el, event) {
    const id = el.dataset.capability;
    const cap = F.capabilities.find(x => x.id === id);
    if (!cap) return;
    clearTooltip();
    tooltip = document.createElement('div');
    tooltip.className = 'rich-hover';
    tooltip.setAttribute('role','tooltip');
    tooltip.innerHTML = `<strong>${escapeHtml(cap.label)} · ${escapeHtml(cap.cost)}</strong><p>${escapeHtml(cap.description)}${cap.unavailableReason ? ` ${escapeHtml(cap.unavailableReason)}` : ''}</p>`;
    document.body.appendChild(tooltip);
    moveTooltip(event);
  }

  function moveTooltip(event) {
    if (!tooltip) return;
    const x = Math.min(event.clientX + 14, window.innerWidth - 296);
    const y = Math.min(event.clientY + 14, window.innerHeight - 150);
    tooltip.style.left = `${Math.max(8,x)}px`;
    tooltip.style.top = `${Math.max(8,y)}px`;
  }

  function activateScenario(id) {
    scenarioSelect.value = id;
    scenarioSelect.dispatchEvent(new Event('change',{ bubbles:true }));
  }

  function productNav(active) {
    const items = [['home','홈'],['characters','캐릭터'],['session','세션'],['content','콘텐츠'],['rules','룰'],['settings','설정']];
    return `<nav class="product-nav"><div class="product-brand"><div class="product-brand__mark"></div><strong>SimpleVTT</strong></div>${items.map(([id,label]) => `<button class="nav-item ${active===id?'active':''}" data-nav="${id}">${label}</button>`).join('')}<div class="nav-spacer"></div></nav>`;
  }

  function shell(active,content) {
    return `<div class="product-shell">${productNav(active)}${content}</div>`;
  }

  function renderSessionEntry() {
    root.innerHTML = shell('session',`<main class="product-page"><div class="page-heading"><div><h2>세션</h2><p>Host는 세션을 열면 즉시 Live Freeform으로 들어갑니다. Lobby / Ready / Start gate는 없습니다.</p></div></div>
      <div class="library-grid" style="grid-template-columns:1fr 1fr">
        <section class="panel"><div class="panel__head"><h3>Host Session · DM</h3><span class="badge good">Immediate Live</span></div><div class="panel__body" style="display:grid;gap:10px"><label class="lab-field"><span>Session name</span><input value="Lantern Archive" style="height:36px;border:1px solid var(--line);background:#0f151b;padding:0 9px"></label><div class="notice">Open Session을 누르는 순간 authoritative live session이 열리고 DM은 같은 화면에서 Play와 준비/편집을 함께 합니다.</div><button class="btn primary" data-stability-session="host">Open Live Session</button></div></section>
        <section class="panel"><div class="panel__head"><h3>Join Session · Player</h3><span class="badge ally">Mid-session Join</span></div><div class="panel__body" style="display:grid;gap:10px"><label class="lab-field"><span>Session code</span><input value="SVTT-DEMO-42" style="height:36px;border:1px solid var(--line);background:#0f151b;padding:0 9px"></label><label class="lab-field"><span>Character</span><select style="height:36px;border:1px solid var(--line);background:#0f151b;padding:0 9px"><option>Rowan Ash</option><option>Mina Vale</option></select></label><button class="btn primary" data-stability-session="join">Join Current Live Session</button><button class="btn quiet" data-stability-session="no-character">No Character example</button></div></section>
      </div></main>`);
  }

  function renderNoCharacter() {
    root.innerHTML = shell('session',`<main class="product-page"><div class="page-heading"><div><h2>세션 참가</h2><p>Character가 없으면 Join은 진행되지 않습니다.</p></div></div><section class="panel" style="max-width:720px"><div class="panel__body" style="display:grid;gap:12px"><div class="notice warn">참가할 Character가 없습니다. Character를 생성하거나 Import한 뒤 Join을 다시 시작하세요.</div><div style="display:flex;gap:7px"><button class="btn primary" data-nav="characters">Create Character</button><button class="btn">Import Character</button><button class="btn quiet" data-nav="session">Back</button></div></div></section></main>`);
  }

  function renderContent() {
    root.innerHTML = shell('content',`<main class="product-page"><div class="page-heading"><div><h2>콘텐츠 / Add-ons</h2><p>v1 공식 SimpleVTT package format. Live Session은 open 시점 snapshot을 유지합니다.</p></div><button class="btn primary">Import Package</button></div><div class="library-grid">${F.packages.map(p => `<section class="panel"><div class="panel__head"><h3>${escapeHtml(p.name)}</h3><span class="badge ${p.status==='blocking'?'hostile':p.status==='disabled'?'warn':'good'}">${escapeHtml(p.status)}</span></div><div class="panel__body" style="display:grid;gap:8px"><div class="utility-row"><strong>Version ${escapeHtml(p.version)}</strong><span>${p.update ? `Update ${escapeHtml(p.update)} available` : 'No update fixture'}</span></div>${p.snapshot ? `<div class="notice">Live snapshot: ${escapeHtml(p.snapshot)} · current session remains unchanged by local library update.</div>`:''}${p.reason?`<div class="notice warn">${escapeHtml(p.reason)}</div>`:''}<div style="display:flex;flex-wrap:wrap;gap:5px"><button class="btn">Update</button><button class="btn">Replace</button><button class="btn">${p.status==='disabled'?'Enable':'Disable'}</button><button class="btn danger">Delete</button></div></div></section>`).join('')}</div></main>`);
  }

  function renderRules() {
    root.innerHTML = shell('rules',`<main class="product-page"><div class="page-heading"><div><h2>Rules Browser</h2><p>Global Rules destination + session contextual lookup의 같은 정보원.</p></div></div><div style="display:grid;grid-template-columns:320px 1fr;gap:10px"><section class="panel"><div class="panel__head"><h3>Search</h3></div><div class="panel__body" style="display:grid;gap:7px"><input value="grapple" style="height:36px;border:1px solid var(--line);background:#0f151b;padding:0 9px"><button class="btn primary">Search</button><div class="utility-row"><strong>Grappling</strong><span>Core Rules · fixture result</span></div><div class="utility-row"><strong>Escaping a Grapple</strong><span>Related rule · fixture result</span></div></div></section><section class="panel"><div class="panel__head"><h3>Grappling</h3><span class="badge">Core Rules</span></div><div class="panel__body"><p style="color:var(--text-2);line-height:1.65">Rule text is intentionally placeholder/reference content in this UI prototype. The final product displays authoritative rules content from its domain/content source rather than embedding invented rules in UI code.</p></div></section></div></main>`);
  }

  function renderSettings() {
    root.innerHTML = shell('settings',`<main class="product-page"><div class="page-heading"><div><h2>설정</h2><p>Appearance, accessibility, local presentation preferences.</p></div></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><section class="panel"><div class="panel__head"><h3>Appearance</h3></div><div class="panel__body" style="display:grid;gap:9px"><div class="utility-row"><strong>Theme</strong><span>Dark · prototype default</span></div><div class="utility-row"><strong>Character Sheet</strong><span>Official-style / SimpleVTT selectable</span></div></div></section><section class="panel"><div class="panel__head"><h3>Accessibility</h3></div><div class="panel__body" style="display:grid;gap:9px"><div class="utility-row"><strong>Reduced Motion</strong><span>Presentation changes only; result/order preserved.</span></div><div class="utility-row"><strong>Keyboard focus</strong><span>Visible focus required for common actions.</span></div></div></section></div></main>`);
  }

  root.addEventListener('click', event => {
    const rootDemoAction = event.target.closest('[data-demo-action]');
    if (rootDemoAction?.dataset.demoAction === 'open-play') {
      event.stopImmediatePropagation();
      activateScenario('FINAL-SCN-DM-FREEFORM');
      return;
    }

    const nav = event.target.closest('[data-nav]');
    const dest = nav?.dataset.nav;
    if (['session','content','rules','settings'].includes(dest)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      clearTooltip();
      if (dest==='session') renderSessionEntry();
      if (dest==='content') renderContent();
      if (dest==='rules') renderRules();
      if (dest==='settings') renderSettings();
      return;
    }

    const sessionAction = event.target.closest('[data-stability-session]')?.dataset.stabilitySession;
    if (sessionAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (sessionAction==='host') activateScenario('FINAL-SCN-DM-FREEFORM');
      else if (sessionAction==='join') activateScenario('FINAL-SCN-PLAYER-FREEFORM');
      else renderNoCharacter();
    }
  }, true);

  root.addEventListener('pointerover', event => {
    const el = event.target.closest('[data-capability]');
    if (!el) return;
    event.stopImmediatePropagation();
    showTooltip(el,event);
  }, true);

  root.addEventListener('pointermove', event => {
    if (tooltip) moveTooltip(event);
  }, true);

  root.addEventListener('pointerout', event => {
    const el = event.target.closest('[data-capability]');
    if (!el) return;
    const related = event.relatedTarget;
    if (related && el.contains(related)) return;
    event.stopImmediatePropagation();
    clearTooltip();
  }, true);

  root.addEventListener('focusin', event => {
    const el = event.target.closest('[data-capability]');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    showTooltip(el,{ clientX: rect.right, clientY: rect.top });
  }, true);

  root.addEventListener('focusout', event => {
    if (event.target.closest('[data-capability]')) clearTooltip();
  }, true);

  window.addEventListener('blur',clearTooltip);
})();
