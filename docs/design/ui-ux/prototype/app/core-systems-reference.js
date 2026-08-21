(() => {
  'use strict';

  const root = document.getElementById('appRoot');
  const viewport = document.getElementById('reviewViewport');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const viewportSelect = document.getElementById('viewportSelect');
  const scenarioTitle = document.getElementById('scenarioTitle');
  const scenarioMeta = document.getElementById('scenarioMeta');
  if (!root || !viewport || !scenarioSelect || !viewportSelect) return;

  const scenarios = [
    { id:'SYS-SCN-00', label:'Product placement map', surface:'map', view:'offline' },
    { id:'SYS-SCN-01', label:'Character Inventory management', surface:'inventory', view:'offline' },
    { id:'SYS-SCN-02', label:'Spellbook + Features management', surface:'spells', view:'offline' },
    { id:'SYS-SCN-03', label:'Player live Quick Use', surface:'player', view:'player' },
    { id:'SYS-SCN-04', label:'DM unified Quick Search', surface:'dmquick', view:'dm' },
    { id:'SYS-SCN-05', label:'Party Stash / loot transfer', surface:'party', view:'dm' },
    { id:'SYS-SCN-06', label:'Rest preview / commit', surface:'rest', view:'player' },
    { id:'SYS-SCN-07', label:'Condition / concentration response', surface:'status', view:'player' }
  ];

  const state = {
    scenarioId:'SYS-SCN-00',
    viewport:'normal',
    sheetTab:'inventory',
    hotbarPage:'Mixed',
    quickOpen:false,
    quickQuery:'',
    privatePreview:false,
    revealed:false,
    toast:'',
    addedActors:0,
    inventoryPotion:3,
    partyPotion:4,
    rowanPotion:0,
    transferQty:2,
    restType:'Short',
    restComplete:false,
    rowanPoisoned:true,
    concentration:true,
    statusDetail:true
  };

  const quickEntries = [
    { id:'archer', type:'ACTOR', icon:'NA', name:'Nightcrow Archer', meta:'DM Library · Bandits · Ranged', actions:[['+1','add-actor'],['More','actor-more']] },
    { id:'leonhardt', type:'ACTOR', icon:'LE', name:'Leonhardt', meta:'DM Library · Named NPC · Allied', actions:[['+1','add-leonhardt']] },
    { id:'letter', type:'IMAGE', icon:'IMG', name:'봉인된 편지', meta:'DM Library · Handouts · 문서/단서', actions:[['View','view-image'],['Reveal','reveal-image']] },
    { id:'potion', type:'ITEM', icon:'POT', name:'Potion of Healing', meta:'ContentCatalog · ItemDefinition', actions:[['Give','quick-give'],['Party','quick-party']] },
    { id:'poisoned', type:'CONDITION', icon:'!', name:'Poisoned', meta:'Rules/Profile condition source', actions:[['Apply','apply-poisoned']] },
    { id:'poisoned-rule', type:'RULE', icon:'R', name:'Poisoned', meta:'Rules Browser · authoritative lookup', actions:[['Open','open-rule']] }
  ];

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function currentScenario() {
    return scenarios.find(item => item.id === state.scenarioId) || scenarios[0];
  }

  function resetTransient() {
    state.quickOpen = false;
    state.quickQuery = '';
    state.privatePreview = false;
    state.revealed = false;
    state.toast = '';
    state.restComplete = false;
  }

  function setScenario(id) {
    const next = scenarios.find(item => item.id === id) || scenarios[0];
    state.scenarioId = next.id;
    resetTransient();
    if (next.surface === 'dmquick') state.quickOpen = true;
    if (next.surface === 'status') state.statusDetail = true;
    render();
  }

  function productNav(active, liveSession = false) {
    const items = [['home','홈'],['characters','캐릭터'],['session','세션'],['content','콘텐츠'],['rules','룰'],['settings','설정']];
    return `<nav class="product-nav" aria-label="Global navigation">
      <div class="product-brand"><div class="product-brand__mark"></div><strong>SimpleVTT</strong></div>
      ${items.map(([id,label]) => `<button class="nav-item ${active===id?'active':''}" type="button">${label}</button>`).join('')}
      <div class="nav-spacer"></div>
      ${liveSession ? '<button class="nav-return" type="button">플레이로 돌아가기</button>' : ''}
    </nav>`;
  }

  function render() {
    const s = currentScenario();
    scenarioSelect.value = state.scenarioId;
    viewportSelect.value = state.viewport;
    viewport.className = `review-viewport vp-${state.viewport}`;
    scenarioTitle.textContent = `${s.id} · ${s.label}`;
    scenarioMeta.textContent = `${s.view} · ${state.viewport} · fixture-driven UX review`;

    if (s.surface === 'map') root.innerHTML = renderPlacementMap();
    if (s.surface === 'inventory') root.innerHTML = renderCharacterSystem('inventory');
    if (s.surface === 'spells') root.innerHTML = renderCharacterSystem('spells');
    if (s.surface === 'player') root.innerHTML = renderPlay('player');
    if (s.surface === 'dmquick') root.innerHTML = renderPlay('dm');
    if (s.surface === 'party') root.innerHTML = renderPartyStash();
    if (s.surface === 'rest') root.innerHTML = renderPlay('player', { rest:true });
    if (s.surface === 'status') root.innerHTML = renderPlay('player', { status:true });

    const quickInput = document.getElementById('quickSearchInput');
    if (quickInput && state.quickOpen) {
      setTimeout(() => {
        quickInput.focus();
        quickInput.setSelectionRange(quickInput.value.length, quickInput.value.length);
      }, 0);
    }
  }

  function renderPlacementMap() {
    return `<section class="system-shell" data-system-scenario="SYS-SCN-00">
      ${productNav('home')}
      <main class="system-page">
        <div class="system-page-heading"><div><span class="review-kicker">ONE UX GRAMMAR</span><h2>공식 시스템의 위치를 네 역할로 고정</h2><p>시스템마다 새 UI 철학을 만들지 않고 관리 / 실행 / 상태 / 빠른 검색으로 역할을 분리합니다.</p></div><span class="badge good">CANDIDATE SYSTEM MAP</span></div>
        <div class="system-map">
          ${systemMapCard('M','MANAGE','전체를 보고 정리하는 곳',['Character Sheet: Inventory','Character Sheet: Spells','Character Sheet: Features / Status','Session: DM Library / Party Stash'],'SOURCE / OWNED STATE')}
          ${systemMapCard('U','USE','지금 실행 가능한 것만',['Command Center: Mixed','Command Center: Action','Command Center: Spell','Command Center: Item'],'EXECUTABLE NOW')}
          ${systemMapCard('S','STATUS','잊으면 안 되는 현재 상태',['Actor Card: HP / Conditions','Controlled Actor: Concentration','Resource Rail: Slots / Charges','Stage: current response'],'CURRENT EFFECT')}
          ${systemMapCard('Q','QUICK','Play를 떠나지 않고 찾고 추가',['Ctrl+K / + Quick','Actor +1','Image View / Reveal','Item Give / Party','Condition Apply / Rule Open'],'LIVE RETRIEVAL')}
        </div>
        <div class="system-principle"><strong>예:</strong> Potion 전체 정보와 보관 위치는 Inventory에서 관리하지만, 실제 플레이에서는 Item Hotbar의 `Potion ×3`만 보입니다. Nightcrow Archer는 DM Library에서 편집하지만, 라이브에서는 `Ctrl+K → Nightcrow → +1`만 하면 됩니다.</div>
      </main>
    </section>`;
  }

  function systemMapCard(icon, title, copy, rows, footer) {
    return `<article class="system-map-card"><div class="system-map-icon">${icon}</div><strong>${title}</strong><div><p>${copy}</p><div class="system-map-list" style="margin-top:9px">${rows.map(row=>`<span>${esc(row)}</span>`).join('')}</div></div><div class="system-map-arrow">${footer}</div></article>`;
  }

  function renderCharacterSystem(tab) {
    const inventoryActive = tab === 'inventory';
    return `<section class="system-shell" data-system-scenario="${inventoryActive?'SYS-SCN-01':'SYS-SCN-02'}">
      ${productNav('characters')}
      <div class="system-sheet">
        <div class="system-sheet-toolbar"><button class="btn quiet" type="button">← Library</button><strong>Rowan · Barbarian 4</strong><span class="grow"></span><span class="badge">Official / SimpleVTT same Character</span><button class="btn" type="button">Edit</button></div>
        <div class="system-sheet-body">
          <nav class="system-sheet-nav" aria-label="Character sections">
            <div class="nav-group">Character</div>
            <button type="button">Overview</button>
            <button class="${inventoryActive?'active':''}" data-sheet-tab="inventory" type="button">Inventory</button>
            <button class="${!inventoryActive?'active':''}" data-sheet-tab="spells" type="button">Spells</button>
            <button class="${!inventoryActive?'active':''}" data-sheet-tab="features" type="button">Features</button>
            <button class="${!inventoryActive?'active':''}" data-sheet-tab="status" type="button">Status</button>
            <div class="nav-group">Play shortcuts</div>
            <button type="button">Rolls</button>
            <button type="button">Rest</button>
          </nav>
          <main class="system-sheet-content">${inventoryActive ? renderInventory() : renderSpellFeatures()}</main>
        </div>
      </div>
    </section>`;
  }

  function renderInventory() {
    return `<div class="sheet-section-head"><div><h2>Inventory</h2><p>전체 소유/보관/장착 상태를 관리합니다. 실제 플레이에서 쓸 수 있는 Item Action만 Command Center로 투영됩니다.</p></div><div class="sheet-summary-row"><span class="summary-pill">Carry <strong>74 / 120 lb</strong></span><span class="summary-pill">GP <strong>48</strong></span><span class="summary-pill">Attunement <strong>1 / 3</strong></span></div></div>
      <div class="inventory-groups">
        ${inventoryGroup('EQUIPPED / ACTIVE','2 items',[invRow('⚔','Longsword','Weapon · Wielded','WIELDED','Details','quiet'),invRow('▣','Shield','Armor · Equipped','EQUIPPED','Details','quiet')])}
        ${inventoryGroup('CONSUMABLES','4 stacks',[invRow('◆','Potion of Healing',`Consumable · quantity ${state.inventoryPotion}`,`×${state.inventoryPotion}`,'Use'),invRow('↗','Arrow','Ammunition · Backpack','×18','Move','quiet')])}
        ${inventoryGroup('CONTAINERS','2 containers',[invRow('□','Backpack','Carried container · 9 items','CARRIED','Open','quiet'),containerInvRow('•','Rope','Inside Backpack · 50 ft','×1'),containerInvRow('•','Torch','Inside Backpack','×5')])}
        ${inventoryGroup('MAGIC / OTHER','3 items',[invRow('◇','Ring of Protection','Magic item · Attuned','ATTUNED','Details','quiet'),invRow('○','Mysterious Key','Quest item · no executable Action','—','Details','quiet')])}
        <section class="inventory-group wide"><div class="inventory-group__head"><strong>UX RULE</strong><span>MANAGE != USE</span></div><div style="padding:10px;font-size:9px;line-height:1.6;color:var(--text-2)">Longsword의 장착 상태와 Potion 수량은 여기에서 관리하지만, Play에서는 실행 가능한 capability만 `Item` Hotbar에 나타납니다. Passive item과 단순 기록물은 Hotbar를 차지하지 않습니다.</div></section>
      </div>`;
  }

  function inventoryGroup(title, count, rows) {
    return `<section class="inventory-group"><div class="inventory-group__head"><strong>${title}</strong><span>${count}</span></div><div class="inventory-list">${rows.join('')}</div></section>`;
  }

  function invRow(glyph, name, meta, stateText, action, quiet='') {
    return `<div class="inventory-row"><div class="item-glyph">${glyph}</div><div class="item-main"><strong>${esc(name)}</strong><span>${esc(meta)}</span></div><span class="item-state">${esc(stateText)}</span><button class="item-action ${quiet}" ${action==='Use'?'data-action="inventory-use-potion"':''} type="button">${esc(action)}</button></div>`;
  }

  function containerInvRow(glyph, name, meta, stateText) {
    return `<div class="inventory-row container-row"><div class="item-glyph">${glyph}</div><div class="item-main"><strong>${esc(name)}</strong><span>${esc(meta)}</span></div><span class="item-state">${esc(stateText)}</span><button class="item-action quiet" type="button">Move</button></div>`;
  }

  function renderSpellFeatures() {
    return `<div class="sheet-section-head"><div><h2>Spells & Features</h2><p>전체 기록은 Sheet에 남고, 실행 가능한 것만 Hotbar/Resource Rail로 투영됩니다.</p></div><div class="sheet-summary-row"><span class="summary-pill">Spell Slots L1 <strong>2 / 4</strong></span><span class="summary-pill">Rage <strong>2 / 3</strong></span></div></div>
      <div class="spell-feature-grid">
        <section class="system-panel"><div class="system-panel__head"><strong>Spellbook</strong><span>KNOWN / PREPARED / RESOURCE</span></div><div class="system-panel__body">
          ${spellLevel('CANTRIPS','No slots',[spellRow('Mage Hand','Utility','Available'),spellRow('Fire Bolt','Attack','Available')])}
          ${spellLevel('LEVEL 1','Slots 2 / 4',[spellRow('Sleep','Control','Prepared'),spellRow('Shield','Reaction','Prepared'),spellRow('Magic Missile','Damage','Not prepared')])}
          ${spellLevel('LEVEL 2','Slots 1 / 2',[spellRow('Mirror Image','Defense','Prepared'),spellRow('Misty Step','Mobility','Prepared')])}
        </div></section>
        <section class="system-panel"><div class="system-panel__head"><strong>Features & Traits</strong><span>PASSIVE != EXECUTABLE</span></div><div class="system-panel__body"><div class="feature-list">
          ${featureRow('Rage','Executable · Resource 2/3','HOTBAR','active')}
          ${featureRow('Reckless Attack','Executable Action context','HOTBAR','active')}
          ${featureRow('Danger Sense','Passive rule contribution','PASSIVE','passive')}
          ${featureRow('Darkvision','Passive sense','PASSIVE','passive')}
          ${featureRow('Second Wind','Executable · Short Rest recharge','HOTBAR','active')}
          <div class="status-detail"><strong>UX rule</strong>Sheet는 Character가 가진 모든 것을 설명합니다. Command Center는 그중 현재 실행 가능한 capability만 보여줍니다. 조건부 Reaction은 타이밍이 열릴 때 나타납니다.</div>
        </div></div></section>
      </div>`;
  }

  function spellLevel(title, right, rows) {
    return `<div class="spell-level"><div class="spell-level__head"><strong>${title}</strong><span>${right}</span></div><div class="spell-list">${rows.join('')}</div></div>`;
  }

  function spellRow(name, meta, status) {
    return `<div class="spell-row"><div><strong>${esc(name)}</strong><span>${esc(meta)}</span></div><span class="system-tag ${status==='Prepared'?'active':''}">${esc(status)}</span><button class="item-action quiet" type="button">Details</button></div>`;
  }

  function featureRow(name, meta, status, kind) {
    return `<div class="feature-row"><div><strong>${esc(name)}</strong><span>${esc(meta)}</span></div><span class="system-tag ${kind}">${esc(status)}</span><button class="item-action quiet" type="button">Details</button></div>`;
  }

  function renderPlayChrome(view) {
    const dm = view === 'dm';
    return `<header class="play-chrome"><div class="play-chrome__title"><button class="chrome-btn" type="button">← Product</button><strong>Crosswatch Session</strong><span>${dm?'HOST · DM':'CLIENT · PLAYER'} · Connected</span></div><div class="play-spacer"></div><button class="chrome-btn" type="button">Sheet</button><button class="chrome-btn" type="button">Rules</button>${dm?'<button class="chrome-btn dm" type="button">Public</button><button class="chrome-btn" type="button">Activity</button><button class="chrome-btn" type="button">Encounter</button><button class="chrome-btn" type="button">Participants</button><button class="chrome-btn" type="button">Session</button><button class="chrome-btn quick" data-action="toggle-quick" title="Quick Search · Ctrl+K" type="button">+</button>':'<button class="chrome-btn" type="button">Session</button>'}</header>`;
  }

  function actorCard(name, initials, relation, meta, extras='') {
    return `<button class="actor-card ${relation}" type="button"><div class="actor-avatar">${esc(initials)}</div><div class="actor-card__body"><strong>${esc(name)}</strong><div class="actor-meta"><span>${esc(meta)}</span>${extras}</div><div class="actor-hp"><span style="width:78%"></span></div></div></button>`;
  }

  function renderBoards() {
    const extra = Array.from({length:state.addedActors},(_,i)=>actorCard(`Nightcrow Archer ${i+1}`,'NA','hostile','Session Actor · HP 22')).join('');
    const statusExtra = state.rowanPoisoned ? '<span class="control-status condition">Poisoned</span>' : '';
    return {
      upper:`<div class="actor-board opposing">${actorCard('Bandit Lookout','BL','hostile','Hostile · HP 17')}${actorCard('Suspicious Guide','SG','neutral','Neutral · HP 19')}${extra}</div>`,
      lower:`<div class="actor-board allied">${actorCard('Rowan','RO','allied controlled','Player · HP 31',statusExtra)}${actorCard('Leonhardt','LE','allied','Ally · HP 44')}</div>`
    };
  }

  function renderPlay(view, opts={}) {
    const boards = renderBoards();
    return `<section class="play-root" data-system-scenario="${currentScenario().id}">
      ${renderPlayChrome(view)}
      <div class="play-main"><div class="play-core">${boards.upper}<div class="mapless-stage"><div class="stage-label"><strong>MAPLESS PLAY CONTEXT</strong><span>System status + current task, not full management UI</span></div>${renderStage(view,opts)}</div>${boards.lower}</div></div>
      <footer class="command-center">${renderCommandCenter(view)}</footer>
      ${view==='dm' && state.quickOpen ? renderQuickPalette() : ''}
      ${state.privatePreview ? renderPrivatePreview() : ''}
      ${opts.rest ? renderRestDialog() : ''}
      ${opts.status ? renderStatusLayer() : ''}
      ${state.toast ? `<div class="quick-toast">${esc(state.toast)}</div>` : ''}
    </section>`;
  }

  function renderStage(view, opts) {
    if (state.revealed) return `<div class="handout-overlay"><div class="handout-art"></div></div>`;
    if (opts.status) return `<div class="system-stage-copy"><span>CURRENT RESPONSE</span><h2>상태는 작게 유지하고, 필요할 때만 확장</h2><p>Actor Card와 Command Center에는 Poisoned / Concentration만 압축 표시됩니다. 상세 설명과 response는 현재 Stage 위에만 잠시 열립니다.</p></div>`;
    return `<div class="system-stage-copy"><span>${view==='dm'?'DM FREEFORM':'PLAYER FREEFORM'}</span><h2>Full systems stay out of Play</h2><p>Inventory·Spellbook·Features 전체 목록은 열지 않습니다. 현재 실행 capability와 중요한 상태만 이 화면에 투영됩니다.</p></div>`;
  }

  function renderCommandCenter(view) {
    const page = state.hotbarPage;
    const slots = page === 'Spell' ? [slot('✦','Sleep','L1'),slot('◇','Shield','L1'),slot('◈','Mirror Image','L2'),slot('↯','Misty Step','L2')] : page === 'Item' ? [slot('◆','Potion',`×${state.inventoryPotion}`,'use-potion'),slot('▣','Wand','4/7'),slot('⚔','Longsword','Wielded')] : [slot('⚔','Attack','Action'),slot('◆','Rage','2/3'),slot('✦','Sleep','L1'),slot('◆','Potion',`×${state.inventoryPotion}`,'use-potion'),slot('◇','Shove','Action')];
    return `<div class="system-command"><div class="system-command-top"><span class="economy-chip freeform">Freeform · no turn economy</span><span class="resource-pill">HP <strong>31/36</strong></span><span class="resource-pill">Rage <strong>2/3</strong></span><span class="resource-pill">L1 Slots <strong>2/4</strong></span><span class="resource-pill">Potion <strong>${state.inventoryPotion}</strong></span></div><div class="system-command-body"><div class="system-controlled"><div class="system-controlled__portrait">RO</div><div class="system-controlled__body"><strong>Rowan</strong><p>Controlled Actor · HP 31/36</p><div class="control-statuses">${state.concentration?'<span class="control-status">Concentration · Hold Person</span>':''}${state.rowanPoisoned?'<span class="control-status condition">Poisoned</span>':''}</div></div></div><div class="system-hotbar"><div class="system-hotbar-tabs">${['Mixed','Action','Spell','Item','Custom'].map(tab=>`<button class="system-hotbar-tab ${page===tab?'active':''}" data-hotbar-page="${tab}" type="button">${tab}</button>`).join('')}</div><div class="system-hotbar-slots">${slots.join('')}</div></div><div class="system-context">${view==='dm'?'<button class="btn" data-action="toggle-quick" type="button">+ Quick</button>':'<button class="btn" type="button">Context</button>'}<button class="btn" type="button">Sheet</button></div></div></div>`;
  }

  function slot(glyph, name, sub, action='') {
    return `<button class="system-hotbar-slot" ${action?`data-action="${action}"`:''} type="button"><strong>${glyph}</strong><span>${esc(name)}</span><small>${esc(sub)}</small></button>`;
  }

  function renderQuickPalette() {
    const q = state.quickQuery.trim().toLowerCase();
    const filtered = quickEntries.filter(entry => !q || `${entry.name} ${entry.type} ${entry.meta}`.toLowerCase().includes(q));
    const groups = [];
    if (!q) {
      groups.push(['RECENT / FAVORITES', filtered.slice(0,4)]);
      groups.push(['MORE', filtered.slice(4)]);
    } else {
      const types = [...new Set(filtered.map(entry=>entry.type))];
      types.forEach(type=>groups.push([type,filtered.filter(entry=>entry.type===type)]));
    }
    return `<div class="quick-layer" data-layer="quick-search"><section class="quick-palette" role="dialog" aria-label="DM Quick Search"><div class="quick-search-row"><div class="quick-glyph">⌕</div><input id="quickSearchInput" class="quick-search" value="${esc(state.quickQuery)}" placeholder="Actor, Image, Item, Condition, Rule 검색" /><span class="quick-shortcut">Ctrl+K</span></div><div class="quick-help"><span>↑↓ 이동</span><span>Enter 실행</span><span>Esc 닫기</span><span>빈 검색 = Recent / Favorites</span></div><div class="quick-results">${groups.map(([label,entries])=>entries.length?`<div class="quick-section-label">${label}</div>${entries.map(renderQuickResult).join('')}`:'').join('')}${filtered.length?'':'<div class="notice">일치하는 결과가 없습니다.</div>'}</div></section></div>`;
  }

  function renderQuickResult(entry) {
    return `<div class="quick-result"><div class="quick-result__icon">${esc(entry.icon)}</div><div class="quick-result__copy"><strong>${esc(entry.name)}</strong><span>${esc(entry.meta)}</span><span class="quick-result__type">${esc(entry.type)}</span></div><div class="quick-actions">${entry.actions.map(([label,action],i)=>`<button class="quick-action ${i?'secondary':''}" data-action="${action}" type="button">${esc(label)}</button>`).join('')}</div></div>`;
  }

  function renderPrivatePreview() {
    return `<aside class="private-preview"><div class="private-preview__art">SEALED LETTER</div><strong>PRIVATE PREVIEW · NOT SHARED</strong><p>View는 Host 로컬 미리보기입니다. Reveal을 명시적으로 누르기 전에는 Player에게 공개되지 않습니다.</p><div style="display:flex;gap:5px;margin-top:8px"><button class="btn primary" data-action="reveal-image" type="button">Reveal</button><button class="btn" data-action="close-preview" type="button">Close</button></div></aside>`;
  }

  function renderPartyStash() {
    return `<section class="system-shell" data-system-scenario="SYS-SCN-05">${productNav('session',true)}<main class="system-page"><div class="system-page-heading"><div><span class="review-kicker">SESSION / SHARED OWNERSHIP CANDIDATE</span><h2>Party Stash</h2><p>개인 Character Inventory와 분리된 공동 보관함. 영구 지급/세션 전용 여부는 canonical transfer semantics가 결정합니다.</p></div><div class="system-page-heading__meta"><span class="badge warn">DOMAIN CONTRACT REQUIRED</span></div></div><div class="party-layout"><section class="party-stash"><div class="party-stash__head"><strong>Crosswatch Party Stash</strong><div class="party-currency"><span>GP 482</span><span>SP 31</span></div></div><div class="party-list">${partyRow('◆','Potion of Healing',`Shared stack · ${state.partyPotion} available`,`×${state.partyPotion}`,'select-potion')}${partyRow('⌁','Ancient Key','Quest item · shared','×1')}${partyRow('◇','Dragon Scale','Craft / treasure','×2')}${partyRow('?','Unknown Artifact','Unidentified · DM/source detail protected','×1')}</div></section><aside class="transfer-panel"><div class="transfer-panel__head">Transfer / Give</div><div class="transfer-panel__body"><div class="status-detail"><strong>Potion of Healing</strong>Party Stash의 소유 수량에서 Character durable/session destination으로 이동하는 하나의 검증된 transfer transaction을 가정한 UX입니다.</div><div class="transfer-target"><select aria-label="Transfer target"><option>Rowan</option><option>Leonhardt</option></select><input id="transferQty" type="number" min="1" max="${state.partyPotion}" value="${state.transferQty}" /></div><div class="transfer-preview"><div class="transfer-box"><strong>Party</strong><span>${state.partyPotion} → ${Math.max(0,state.partyPotion-state.transferQty)}</span></div><div class="transfer-arrow">→</div><div class="transfer-box"><strong>Rowan</strong><span>${state.rowanPotion} → ${state.rowanPotion+state.transferQty}</span></div></div><button class="btn primary" data-action="transfer-potion" ${state.partyPotion<=0?'disabled':''} type="button">Give to Rowan</button><div class="notice ${state.toast?'':'dm'}">${state.toast?esc(state.toast):'No implicit permanent grant. Destination lifetime/write-back must be validated before commit.'}</div></div></aside></div></main></section>`;
  }

  function partyRow(glyph,name,meta,count,action='') {
    return `<div class="party-row"><div class="item-glyph">${glyph}</div><div><strong>${esc(name)}</strong><span>${esc(meta)}</span></div><div style="display:flex;align-items:center;gap:5px"><span class="item-state">${esc(count)}</span>${action?`<button class="item-action" data-action="${action}" type="button">Give</button>`:''}</div></div>`;
  }

  function renderRestDialog() {
    const isShort = state.restType === 'Short';
    const changes = isShort ? [
      ['Hit Dice','Choose amount before commit'],['Second Wind','Recharge (fixture projection)'],['Rage','No recovery in this fixture']
    ] : [
      ['HP','31 → 36'],['Spell Slots','L1 2/4 → 4/4'],['Rage','2/3 → 3/3'],['Hit Dice','Profile-provided recovery'],['Exhaustion','Profile-provided change']
    ];
    return `<div class="rest-layer"><section class="rest-dialog" role="dialog" aria-label="Rest preview"><div class="rest-dialog__head"><strong>Rest Activity</strong><div class="rest-tabs"><button class="rest-tab ${isShort?'active':''}" data-rest="Short" type="button">Short Rest</button><button class="rest-tab ${!isShort?'active':''}" data-rest="Long" type="button">Long Rest</button></div></div><div class="rest-dialog__body"><div class="rest-block"><strong>${state.restType} Rest</strong><p>Rest는 즉시 reset 버튼이 아니라, authoritative preview → 실제 선택 → explicit commit 순서의 Activity입니다.</p></div><div class="rest-block"><strong>Current state</strong><div class="status-chip-row"><span class="status-chip good">HP 31/36</span><span class="status-chip">Rage 2/3</span><span class="status-chip">L1 Slots 2/4</span></div></div>${isShort?'<div class="rest-block wide"><div class="rest-choice"><div><strong>Hit Dice to spend</strong><p>실제 선택이 필요한 경우만 묻습니다.</p></div><input value="2" aria-label="Hit dice to spend" /></div></div>':''}<div class="rest-block wide"><strong>Previewed changes</strong><div class="rest-change-list">${changes.map(([left,right])=>`<div class="rest-change"><span>${esc(left)}</span><b>${esc(right)}</b></div>`).join('')}</div></div></div><div class="rest-dialog__actions"><button class="btn" type="button">Cancel</button><button class="btn primary" data-action="complete-rest" type="button">Complete ${state.restType} Rest</button></div></section></div>`;
  }

  function renderStatusLayer() {
    return `<div class="resolution-panel" style="width:min(560px,70%)"><div class="resolution-panel__head"><strong>Current Status / Response</strong><span class="badge warn">CONTEXTUAL</span></div><div class="resolution-panel__body"><div class="status-board"><section class="status-card"><h3>Rowan</h3><div class="status-chip-row">${state.rowanPoisoned?'<span class="status-chip condition">Poisoned</span>':''}${state.concentration?'<span class="status-chip">Concentration · Hold Person</span>':''}</div><div class="status-detail"><strong>Normal Play</strong>Actor Card와 Command Center에는 이름/상태만 압축해서 보입니다. 전체 효과 목록을 상시 열어두지 않습니다.</div></section><section class="status-card"><h3>Concentration response</h3><div class="status-detail"><strong>Damage taken: fixture 14</strong>Save DC / modifier / legality는 UI가 계산하지 않고 authoritative response projection을 사용합니다.</div><button class="btn primary" type="button">Roll Constitution Save</button><button class="btn" data-action="dismiss-status" type="button">Later / Close</button></section></div></div></div>`;
  }

  function showToast(message) {
    state.toast = message;
    render();
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-review-jump],[data-sheet-tab],[data-hotbar-page],[data-action],[data-rest]');
    if (!target) return;

    if (target.dataset.reviewJump) {
      setScenario(target.dataset.reviewJump);
      return;
    }

    if (target.dataset.sheetTab) {
      const tab = target.dataset.sheetTab;
      if (tab === 'inventory') setScenario('SYS-SCN-01');
      else setScenario('SYS-SCN-02');
      return;
    }

    if (target.dataset.hotbarPage) {
      state.hotbarPage = target.dataset.hotbarPage;
      render();
      return;
    }

    if (target.dataset.rest) {
      state.restType = target.dataset.rest;
      render();
      return;
    }

    switch (target.dataset.action) {
      case 'toggle-quick':
        state.quickOpen = !state.quickOpen;
        state.quickQuery = '';
        render();
        break;
      case 'add-actor':
        state.addedActors += 1;
        state.quickOpen = false;
        showToast('Nightcrow Archer added to Session · independent Actor instance');
        break;
      case 'add-leonhardt':
        state.quickOpen = false;
        showToast('Leonhardt added as Session Actor');
        break;
      case 'actor-more':
        showToast('More: +2 · +3 · +5 · Custom · Open in DM Library');
        break;
      case 'view-image':
        state.privatePreview = true;
        state.quickOpen = false;
        render();
        break;
      case 'reveal-image':
        state.privatePreview = false;
        state.quickOpen = false;
        state.revealed = true;
        showToast('Sealed Letter revealed as shared Handout');
        break;
      case 'close-preview':
        state.privatePreview = false;
        render();
        break;
      case 'quick-give':
        showToast('Give requires an explicit authorized destination; no silent grant');
        break;
      case 'quick-party':
        state.partyPotion += 1;
        state.quickOpen = false;
        showToast('Potion routed to Party Stash candidate flow');
        break;
      case 'apply-poisoned':
        state.rowanPoisoned = true;
        state.quickOpen = false;
        showToast('Poisoned selected for authoritative DM apply/adjudication path');
        break;
      case 'open-rule':
        state.quickOpen = false;
        showToast('Rules lookup opens contextually without leaving Play');
        break;
      case 'use-potion':
      case 'inventory-use-potion':
        if (state.inventoryPotion > 0) state.inventoryPotion -= 1;
        showToast(`Fixture resolution: Potion quantity now ${state.inventoryPotion}`);
        break;
      case 'select-potion':
        state.transferQty = Math.min(2,state.partyPotion || 1);
        render();
        break;
      case 'transfer-potion': {
        const amount = Math.max(1,Math.min(state.partyPotion,state.transferQty));
        state.partyPotion -= amount;
        state.rowanPotion += amount;
        state.toast = `Transfer committed in fixture: Party -${amount} / Rowan +${amount}`;
        render();
        break;
      }
      case 'complete-rest':
        state.toast = `${state.restType} Rest preview committed in fixture`; 
        state.scenarioId = 'SYS-SCN-03';
        render();
        break;
      case 'dismiss-status':
        state.scenarioId = 'SYS-SCN-03';
        render();
        break;
      default:
        break;
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'quickSearchInput') {
      state.quickQuery = event.target.value;
      render();
      return;
    }
    if (event.target.id === 'transferQty') {
      state.transferQty = Math.max(1,Math.min(state.partyPotion || 1,Number(event.target.value) || 1));
      render();
    }
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      const s = currentScenario();
      if (s.view !== 'dm') return;
      event.preventDefault();
      state.quickOpen = !state.quickOpen;
      if (state.quickOpen) state.quickQuery = '';
      render();
      return;
    }
    if (event.key === 'Escape' && (state.quickOpen || state.privatePreview)) {
      state.quickOpen = false;
      state.privatePreview = false;
      render();
    }
  });

  scenarioSelect.addEventListener('change', () => setScenario(scenarioSelect.value));
  viewportSelect.addEventListener('change', () => {
    state.viewport = viewportSelect.value;
    render();
  });

  scenarioSelect.innerHTML = scenarios.map(s=>`<option value="${s.id}">${s.id} · ${s.label}</option>`).join('');
  scenarioSelect.value = state.scenarioId;
  viewportSelect.value = state.viewport;
  render();
})();
