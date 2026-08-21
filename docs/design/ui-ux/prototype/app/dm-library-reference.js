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
    { id: 'DMLIB-SCN-01', label: 'Offline · Images', surface: 'library', collection: 'images', view: 'offline', liveSession: false },
    { id: 'DMLIB-SCN-02', label: 'Offline · NPC Actor Definitions', surface: 'library', collection: 'npc', view: 'offline', liveSession: false },
    { id: 'DMLIB-SCN-03', label: 'Offline · PC Actor Presets', surface: 'library', collection: 'pc', view: 'offline', liveSession: false },
    { id: 'DMLIB-SCN-04', label: 'Live DM · Encounter Add from Library', surface: 'encounter', collection: 'npc', view: 'dm', liveSession: true },
    { id: 'DMLIB-SCN-05', label: 'Live DM · Handout Reveal from Library', surface: 'handout', collection: 'images', view: 'dm', liveSession: true },
    { id: 'DMLIB-SCN-06', label: 'Live Player · Private Library Non-delivery', surface: 'player', collection: null, view: 'player', liveSession: true }
  ];

  const images = [
    { id: 'sealed-letter', name: '봉인된 편지', folder: 'Handouts', tags: ['문서','단서'], favorite: true, style: 'letter', glyph: 'LETTER', note: '플레이어가 성문 경비대에게서 입수한 뒤에만 공개할 예정.' },
    { id: 'cult-emblem', name: '용신교 문양', folder: 'Symbols', tags: ['문양','교단'], favorite: true, style: 'emblem', glyph: 'SIGIL', note: '아직 등장하지 않은 세력 자료. Session 참가자에게 존재 자체를 노출하지 않음.' },
    { id: 'forest-shrine', name: '숲의 오래된 제단', folder: 'Locations', tags: ['장소','분위기'], favorite: false, style: 'shrine', glyph: 'SHRINE', note: 'Handout용 장소 일러스트. 배틀맵이 아님.' },
    { id: 'suspect', name: '수상한 남자', folder: 'Portraits', tags: ['초상','NPC'], favorite: false, style: 'portrait', glyph: 'NPC', note: '조사 장면에서 필요할 때만 공개.' },
    { id: 'briar-glen', name: '브라이어글렌 전경', folder: 'Locations', tags: ['장소','마을'], favorite: false, style: 'location', glyph: 'PLACE', note: '전경 이미지. 위치/거리/토큰 좌표 의미 없음.' }
  ];

  const npcActors = [
    { id: 'nightcrow-archer', name: 'Nightcrow Archer', initials: 'NA', folder: 'Bandits', tags: ['Bandit','Ranged'], hp: 22, ac: 14, actions: 3, relation: 'Hostile', favorite: true, note: 'Nightcrow 매복용 원거리 병력. 전투 중 HP 변화는 이 원본에 기록하지 않음.' },
    { id: 'nightcrow-bruiser', name: 'Nightcrow Bruiser', initials: 'NB', folder: 'Bandits', tags: ['Bandit','Bruiser'], hp: 38, ac: 15, actions: 2, relation: 'Hostile', favorite: false, note: '좁은 길목을 막는 전위형 NPC.' },
    { id: 'skeleton', name: 'Skeleton', initials: 'SK', folder: 'Undead', tags: ['Undead'], hp: 13, ac: 13, actions: 2, relation: 'Hostile', favorite: false, note: '재사용 가능한 일반 언데드 정의.' },
    { id: 'leonhardt', name: 'Leonhardt', initials: 'LE', folder: 'Named NPC', tags: ['Named','Paladin','Ally'], hp: 44, ac: 18, actions: 5, relation: 'Allied', favorite: true, note: 'DM 개인 메모와 세션에 공개되는 Actor 정보는 별도 projection.' },
    { id: 'legacy-mage', name: 'Legacy Mage', initials: 'LM', folder: 'Named NPC', tags: ['Mage','Needs review'], hp: 31, ac: 12, actions: 4, relation: 'Neutral', favorite: false, warning: 'Disabled content dependency: ember-spell-pack@1.2', note: '정의는 남아 있지만 현재 Content 구성으로는 Session 추가 전 검토 필요.' }
  ];

  const pcActors = [
    { id: 'guest-fighter', name: 'Guest Fighter', initials: 'GF', folder: 'Pregens', tags: ['Pregen','Fighter'], hp: 41, ac: 17, actions: 5, favorite: true, note: 'Host-prepared Actor preset. Player-owned Character가 아님.' },
    { id: 'guest-cleric', name: 'Guest Cleric', initials: 'GC', folder: 'Pregens', tags: ['Pregen','Cleric'], hp: 35, ac: 18, actions: 7, favorite: false, note: '세션에 인스턴스화한 뒤 필요하면 특정 Player에게 control만 배정.' },
    { id: 'temporary-ally', name: 'Temporary Ally', initials: 'TA', folder: 'Companions', tags: ['Ally','Companion'], hp: 28, ac: 15, actions: 4, favorite: false, note: '임시 Player-shaped Actor preset. Character Library 항목이 아님.' }
  ];

  const state = {
    scenarioId: 'DMLIB-SCN-01',
    viewport: 'normal',
    collection: 'images',
    selectedId: 'sealed-letter',
    favoritesOnly: false,
    recentOnly: false,
    folder: 'All',
    search: '',
    quantity: 3,
    sessionAdded: 0,
    revealed: false
  };

  function esc(value) {
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function scenario() {
    return scenarios.find(item => item.id === state.scenarioId) || scenarios[0];
  }

  function collectionItems(kind = state.collection) {
    if (kind === 'images') return images;
    if (kind === 'pc') return pcActors;
    return npcActors;
  }

  function currentItem() {
    return collectionItems().find(item => item.id === state.selectedId) || collectionItems()[0];
  }

  function setScenario(id) {
    const next = scenarios.find(item => item.id === id) || scenarios[0];
    state.scenarioId = next.id;
    state.collection = next.collection || 'images';
    state.selectedId = state.collection === 'images' ? 'sealed-letter' : state.collection === 'pc' ? 'guest-fighter' : 'nightcrow-archer';
    state.favoritesOnly = false;
    state.recentOnly = false;
    state.folder = 'All';
    state.search = '';
    state.quantity = 3;
    state.sessionAdded = 0;
    state.revealed = false;
    render();
  }

  function initControls() {
    scenarioSelect.innerHTML = scenarios.map(item => `<option value="${item.id}">${item.id} · ${item.label}</option>`).join('');
    scenarioSelect.value = state.scenarioId;
    viewportSelect.value = state.viewport;
  }

  function productNav(active = 'session', liveSession = false) {
    const items = [['home','홈'],['characters','캐릭터'],['session','세션'],['content','콘텐츠'],['rules','룰'],['settings','설정']];
    return `<nav class="product-nav" aria-label="Global navigation">
      <div class="product-brand"><div class="product-brand__mark"></div><strong>SimpleVTT</strong></div>
      ${items.map(([id,label]) => `<button class="nav-item ${active === id ? 'active' : ''}" type="button">${label}</button>`).join('')}
      <div class="nav-spacer"></div>
      ${liveSession ? '<button class="nav-return" type="button">플레이로 돌아가기</button>' : ''}
    </nav>`;
  }

  function render() {
    const s = scenario();
    scenarioSelect.value = state.scenarioId;
    viewportSelect.value = state.viewport;
    viewport.className = `review-viewport vp-${state.viewport}`;
    scenarioTitle.textContent = `${s.id} · ${s.label}`;
    scenarioMeta.textContent = `${s.view} · ${state.viewport} · ${s.liveSession ? 'live session' : 'local preparation'}`;

    if (s.surface === 'library') root.innerHTML = renderLibrarySurface(s);
    else if (s.surface === 'encounter') root.innerHTML = renderLivePlay('encounter');
    else if (s.surface === 'handout') root.innerHTML = renderLivePlay('handout');
    else root.innerHTML = renderPlayerProjection();
  }

  function renderLibrarySurface(s) {
    return `<section class="product-shell" data-dmlib-scenario="${s.id}">
      ${productNav('session', false)}
      ${renderLibraryPage()}
    </section>`;
  }

  function renderLibraryPage() {
    const item = currentItem();
    const all = collectionItems();
    const folders = ['All', ...new Set(all.map(entry => entry.folder))];
    const q = state.search.trim().toLowerCase();
    const filtered = all.filter(entry => {
      if (state.favoritesOnly && !entry.favorite) return false;
      if (state.folder !== 'All' && entry.folder !== state.folder) return false;
      if (!q) return true;
      return [entry.name, entry.folder, ...(entry.tags || [])].join(' ').toLowerCase().includes(q);
    });

    return `<main class="dm-library-page" data-proto-id="PROTO-SURF-DM-LIBRARY">
      <div class="dm-library-heading">
        <div>
          <div class="dm-library-breadcrumb">Session / DM Library</div>
          <h2>DM Library</h2>
          <p>세션 전에 준비하고, 필요할 때만 Session에 인스턴스/공개하는 로컬 준비 자료입니다.</p>
        </div>
        <div class="dm-library-heading__actions">
          <span class="dm-local-state">LOCAL · NOT SHARED</span>
          <button class="btn" data-action="new-item" type="button">${state.collection === 'images' ? '이미지 추가' : state.collection === 'npc' ? '새 NPC' : '새 PC Actor Preset'}</button>
          <button class="btn primary" data-action="import-item" type="button">Import</button>
        </div>
      </div>

      <div class="dm-library-toolbar">
        <input id="dmLibrarySearch" class="dm-library-search" value="${esc(state.search)}" placeholder="이름, 태그, 폴더 검색" aria-label="DM Library search" />
        <div class="dm-library-filter-row">
          <button class="dm-filter ${state.favoritesOnly ? 'active' : ''}" data-filter="favorites" type="button">★ 즐겨찾기</button>
          <button class="dm-filter ${state.recentOnly ? 'active' : ''}" data-filter="recent" type="button">최근 사용</button>
          <button class="dm-filter ${state.folder === 'All' && !state.favoritesOnly && !state.recentOnly ? 'active' : ''}" data-filter="reset" type="button">전체</button>
        </div>
      </div>

      <section class="dm-library-layout">
        <aside class="dm-library-rail" aria-label="DM Library collections">
          <div class="dm-rail-title">Collections</div>
          ${renderCollectionButton('images','▧','Images',images.length)}
          ${renderCollectionButton('pc','◇','PC Actors',pcActors.length)}
          ${renderCollectionButton('npc','◆','NPC Actors',npcActors.length)}
          <div class="dm-rail-divider"></div>
          <div class="dm-rail-title">Folders</div>
          ${folders.map(folder => `<button class="dm-folder-btn ${state.folder === folder ? 'active' : ''}" data-folder="${esc(folder)}" type="button">${esc(folder)}<span>${folder === 'All' ? all.length : all.filter(entry => entry.folder === folder).length}</span></button>`).join('')}
        </aside>

        <section class="dm-library-results">
          <div class="dm-results-head"><strong>${collectionLabel(state.collection)}</strong><span>${filtered.length} entries · private local source</span></div>
          <div class="dm-card-grid">
            ${filtered.length ? filtered.map(renderLibraryCard).join('') : '<div class="notice">검색 조건에 맞는 준비 자료가 없습니다.</div>'}
          </div>
        </section>

        ${renderDetail(item)}
      </section>
    </main>`;
  }

  function renderCollectionButton(id, glyph, label, count) {
    return `<button class="dm-collection-btn ${state.collection === id ? 'active' : ''}" data-collection="${id}" type="button"><span class="dm-collection-icon">${glyph}</span><strong>${label}</strong><span>${count}</span></button>`;
  }

  function collectionLabel(kind) {
    if (kind === 'images') return 'Images';
    if (kind === 'pc') return 'PC Actor Presets';
    return 'NPC Actor Definitions';
  }

  function renderLibraryCard(item) {
    if (state.collection === 'images') {
      return `<button class="dm-library-card ${state.selectedId === item.id ? 'selected' : ''}" data-select-item="${item.id}" type="button">
        ${item.favorite ? '<span class="dm-card-favorite">★</span>' : ''}
        <div class="dm-image-thumb ${item.style}"><span class="dm-image-glyph">${esc(item.glyph)}</span></div>
        <div class="dm-card-body"><strong>${esc(item.name)}</strong><p>${esc(item.folder)}</p><div class="dm-card-tags">${item.tags.map(tag => `<span class="dm-card-tag">${esc(tag)}</span>`).join('')}</div></div>
      </button>`;
    }

    return `<button class="dm-library-card ${state.selectedId === item.id ? 'selected' : ''} ${item.warning ? 'problem' : ''}" data-select-item="${item.id}" type="button">
      ${item.favorite ? '<span class="dm-card-favorite">★</span>' : ''}
      <div class="dm-actor-thumb"><div class="dm-actor-avatar">${esc(item.initials)}</div><div class="dm-actor-summary"><strong>${esc(item.name)}</strong><span>${state.collection === 'pc' ? 'PC ACTOR PRESET' : esc(item.relation || 'NPC')}</span><span>HP ${item.hp} · AC ${item.ac}</span></div></div>
      <div class="dm-card-body"><strong>${esc(item.folder)}</strong><p>${item.actions} projected capabilities</p><div class="dm-card-tags">${item.tags.map(tag => `<span class="dm-card-tag">${esc(tag)}</span>`).join('')}</div>${item.warning ? `<div class="dm-card-warning">! ${esc(item.warning)}</div>` : ''}</div>
    </button>`;
  }

  function renderDetail(item) {
    if (!item) return '<aside class="dm-library-detail"></aside>';
    const isImage = state.collection === 'images';
    const preview = isImage
      ? `<div class="dm-image-thumb ${item.style}"><span class="dm-image-glyph">${esc(item.glyph)}</span></div>`
      : `<div class="dm-actor-thumb"><div class="dm-actor-avatar">${esc(item.initials)}</div><div class="dm-actor-summary"><strong>${esc(item.name)}</strong><span>${state.collection === 'pc' ? 'HOST-PREPARED PC ACTOR PRESET' : esc(item.relation)}</span><span>HP ${item.hp} · AC ${item.ac} · ${item.actions} capabilities</span></div></div>`;

    return `<aside class="dm-library-detail" aria-label="Selected library entry detail">
      <div class="dm-detail-head"><strong>Details</strong><span class="badge dm">PRIVATE SOURCE</span></div>
      <div class="dm-detail-body">
        <div class="dm-detail-preview">${preview}</div>
        <h3 class="dm-detail-title">${esc(item.name)}</h3>
        <p class="dm-detail-sub">${isImage ? 'Local image presentation asset' : state.collection === 'pc' ? 'Host-prepared Actor preset · not a Player-owned Character' : 'Reusable NPC Actor source definition'}</p>
        <div class="dm-detail-list">
          <div class="dm-detail-row"><span>Folder</span><strong>${esc(item.folder)}</strong></div>
          <div class="dm-detail-row"><span>Tags</span><strong>${esc((item.tags || []).join(' · '))}</strong></div>
          <div class="dm-detail-row"><span>Sharing</span><strong>Local · Not shared</strong></div>
          ${!isImage ? `<div class="dm-detail-row"><span>Initial projection</span><strong>HP ${item.hp} · AC ${item.ac}</strong></div>` : ''}
          ${item.warning ? `<div class="notice warn"><strong>Validation review required</strong><br>${esc(item.warning)}</div>` : ''}
        </div>
        <div class="dm-private-note"><strong>DM-only note</strong><br>${esc(item.note)}</div>
        ${!isImage ? '<div class="dm-source-note">Reusable source definition. Session HP / resources / effects do not write back to this Library source automatically.</div>' : '<div class="dm-source-note">Selecting or previewing this image does not transmit it. Reveal requires an explicit live Session action.</div>'}
      </div>
      <div class="dm-detail-actions">
        <button class="btn" type="button">Edit</button>
        <button class="btn" type="button">Duplicate</button>
        <button class="btn" type="button">${item.favorite ? '★ Favorite' : '☆ Favorite'}</button>
        <button class="btn danger" type="button">Delete</button>
      </div>
    </aside>`;
  }

  function renderPlayChrome(view) {
    const dm = view === 'dm';
    return `<header class="play-chrome">
      <div class="play-chrome__title"><button class="chrome-btn" type="button">← Product</button><strong>Crosswatch Session</strong><span>${dm ? 'HOST · DM' : 'CLIENT · PLAYER'} · Connected</span></div>
      <div class="play-spacer"></div>
      <button class="chrome-btn" type="button">Sheet</button>
      <button class="chrome-btn" type="button">Rules</button>
      ${dm ? '<button class="chrome-btn dm" type="button">Public</button><button class="chrome-btn" type="button">Activity</button><button class="chrome-btn active" type="button">Encounter</button><button class="chrome-btn" type="button">Participants</button><button class="chrome-btn" type="button">Session</button>' : '<button class="chrome-btn" type="button">Session</button>'}
    </header>`;
  }

  function renderActorCard(name, initials, relation, meta) {
    return `<button class="actor-card ${relation}" type="button"><div class="actor-avatar">${esc(initials)}</div><div class="actor-card__body"><strong>${esc(name)}</strong><div class="actor-meta"><span>${esc(meta)}</span></div><div class="actor-hp"><span style="width:78%"></span></div></div></button>`;
  }

  function renderActorBoards() {
    const added = Array.from({ length: state.sessionAdded }, (_, index) => renderActorCard(`Nightcrow Archer ${index + 1}`,'NA','hostile','Session instance · HP 22'));
    return {
      upper: `<div class="actor-board opposing">${renderActorCard('Bandit Lookout','BL','hostile','Hostile · HP 17')}${renderActorCard('Suspicious Guide','SG','neutral','Neutral · HP 19')}${added.join('')}</div>`,
      lower: `<div class="actor-board allied">${renderActorCard('Rowan','RO','allied controlled','Player · HP 31')}${renderActorCard('Leonhardt','LE','allied','Ally · HP 44')}</div>`
    };
  }

  function renderCommandCenter() {
    return `<footer class="command-center"><div class="dm-command-placeholder">
      <div class="dm-command-placeholder__top"><span class="economy-chip freeform">Freeform · no turn economy</span><span class="resource-pill">HP <strong>31/36</strong></span><span class="resource-pill">Rage <strong>2/3</strong></span></div>
      <div class="dm-command-placeholder__body">
        <div class="dm-command-actor"><div class="dm-command-avatar">RO</div><div class="dm-command-copy"><strong>Rowan</strong><span>Controlled Actor · HP 31/36</span></div></div>
        <div class="dm-command-hotbar"><div class="dm-command-slot"><b>⚔</b>Attack</div><div class="dm-command-slot"><b>◆</b>Shove</div><div class="dm-command-slot"><b>✦</b>Feature</div><div class="dm-command-slot"><b>▣</b>Item</div><div class="dm-command-slot"><b>+</b>Custom</div></div>
        <div class="dm-command-context"><button class="btn" type="button">Context</button></div>
      </div>
    </div></footer>`;
  }

  function renderLivePlay(kind) {
    const boards = renderActorBoards();
    return `<section class="play-root" data-dmlib-scenario="${scenario().id}">
      ${renderPlayChrome('dm')}
      <div class="play-main">
        <div class="play-core">
          ${boards.upper}
          <div class="mapless-stage">
            <div class="stage-label"><strong>MAPLESS PLAY CONTEXT</strong><span>Actor and action context · not a battlemap</span></div>
            <div class="dm-stage-copy"><span>FREEFORM</span><h2>Mapless shared play context</h2><p>DM Library is invoked from the current task without replacing the accepted Play scene.</p></div>
            ${kind === 'handout' && state.revealed ? renderRevealedHandout() : ''}
          </div>
          ${boards.lower}
        </div>
        ${kind === 'encounter' ? renderEncounterUtility() : renderHandoutUtility()}
      </div>
      ${renderCommandCenter()}
    </section>`;
  }

  function renderEncounterUtility() {
    return `<aside class="utility-pane" aria-label="Encounter Manager">
      <div class="utility-pane__head"><strong>Encounter · Add Actor</strong><button class="chrome-btn" type="button">×</button></div>
      <div class="utility-pane__body">
        <div class="notice dm" style="margin-bottom:8px"><strong>From DM Library</strong><br>로컬 원본을 선택한 뒤 명시적으로 Session Actor를 생성합니다.</div>
        <div class="dm-live-picker">
          <div class="dm-live-picker__scope"><button class="btn" type="button">PC Actors</button><button class="btn primary" type="button">NPC Actors</button></div>
          <input class="dm-live-search" value="Nightcrow" aria-label="Search DM Library actors" />
          <button class="dm-live-source selected" type="button"><span class="dm-live-source__avatar">NA</span><span><strong>Nightcrow Archer</strong><span>Bandits · Ranged · source HP 22</span></span><span class="badge dm">LOCAL SOURCE</span></button>
          <button class="dm-live-source" type="button"><span class="dm-live-source__avatar">NB</span><span><strong>Nightcrow Bruiser</strong><span>Bandits · Bruiser · source HP 38</span></span><span class="badge dm">LOCAL SOURCE</span></button>
          <div class="dm-quantity-row"><label for="dmQuantity">Quantity</label><input id="dmQuantity" type="number" min="1" max="20" value="${state.quantity}" /></div>
          <div class="dm-live-summary"><strong>Creates ${state.quantity} independent Session Actors</strong><span>각 Actor는 새 Session identity/HP/runtime state를 가집니다. Library 원본은 변경되지 않습니다.</span></div>
          ${state.sessionAdded ? `<div class="notice"><strong>${state.sessionAdded} Session Actors added.</strong><br>위 Actor Board의 개별 카드가 source 정의와 독립적으로 존재합니다.</div>` : ''}
          <div class="dm-live-actions"><button class="btn" type="button">Cancel</button><button class="btn primary" data-action="add-session-actors" type="button">Add to Session</button></div>
        </div>
      </div>
    </aside>`;
  }

  function renderHandoutUtility() {
    return `<aside class="utility-pane" aria-label="Session Handout">
      <div class="utility-pane__head"><strong>Session · Handout</strong><button class="chrome-btn" type="button">×</button></div>
      <div class="utility-pane__body">
        <div class="dm-live-picker">
          <div class="notice dm"><strong>DM Library / Images</strong><br>선택과 Preview는 로컬입니다. Reveal 전에는 Player에게 전송되지 않습니다.</div>
          <input class="dm-live-search" value="봉인된 편지" aria-label="Search DM Library images" />
          <button class="dm-live-source selected" type="button"><span class="dm-live-source__avatar">▧</span><span><strong>봉인된 편지</strong><span>Handouts · 문서 · 단서</span></span><span class="badge dm">PRIVATE</span></button>
          <div class="dm-private-preview"><div class="dm-private-preview__art">SEALED LETTER</div><strong>PRIVATE PREVIEW · NOT SHARED</strong><p>이 상태는 Host 로컬 미리보기입니다. Session shared Handout 상태가 아닙니다.</p></div>
          <div class="dm-live-actions">${state.revealed ? '<button class="btn danger" data-action="withdraw-handout" type="button">Withdraw</button>' : '<button class="btn primary" data-action="reveal-handout" type="button">Reveal to Players</button>'}</div>
        </div>
      </div>
    </aside>`;
  }

  function renderRevealedHandout() {
    return `<div class="dm-reveal-status"><div class="dm-reveal-art">SEALED LETTER</div><div class="dm-reveal-foot"><strong>REVEALED · Shared Handout</strong><span>Presentation only · no map/token interaction</span></div></div>`;
  }

  function renderPlayerProjection() {
    const boards = renderActorBoards();
    return `<section class="play-root" data-dmlib-scenario="DMLIB-SCN-06">
      ${renderPlayChrome('player')}
      <div class="play-main">
        <div class="play-core">
          ${boards.upper}
          <div class="mapless-stage">
            <div class="stage-label"><strong>MAPLESS PLAY CONTEXT</strong><span>Authorized Session projection only</span></div>
            <div class="dm-stage-copy"><span>PLAYER PROJECTION</span><h2>No DM Library catalog delivered</h2><p>Player는 Session에 실제로 투영된 Actor/Handout 정보만 봅니다. 준비 중인 이미지·NPC·PC preset의 이름/폴더/태그/존재 정보는 표시하지 않습니다.</p></div>
            <div class="dm-player-privacy">✓ No DM Library launcher · no secret placeholders · no unused asset metadata</div>
          </div>
          ${boards.lower}
        </div>
      </div>
      ${renderCommandCenter()}
    </section>`;
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-review-jump],[data-collection],[data-folder],[data-select-item],[data-filter],[data-action]');
    if (!target) return;

    if (target.dataset.reviewJump) {
      setScenario(target.dataset.reviewJump);
      return;
    }

    if (target.dataset.collection) {
      state.collection = target.dataset.collection;
      state.selectedId = state.collection === 'images' ? 'sealed-letter' : state.collection === 'pc' ? 'guest-fighter' : 'nightcrow-archer';
      state.folder = 'All';
      state.search = '';
      state.favoritesOnly = false;
      render();
      return;
    }

    if (target.dataset.folder) {
      state.folder = target.dataset.folder;
      render();
      return;
    }

    if (target.dataset.selectItem) {
      state.selectedId = target.dataset.selectItem;
      render();
      return;
    }

    if (target.dataset.filter === 'favorites') {
      state.favoritesOnly = !state.favoritesOnly;
      render();
      return;
    }

    if (target.dataset.filter === 'recent') {
      state.recentOnly = !state.recentOnly;
      render();
      return;
    }

    if (target.dataset.filter === 'reset') {
      state.favoritesOnly = false;
      state.recentOnly = false;
      state.folder = 'All';
      state.search = '';
      render();
      return;
    }

    if (target.dataset.action === 'add-session-actors') {
      state.sessionAdded += Math.max(1, Math.min(20, Number(state.quantity) || 1));
      render();
      return;
    }

    if (target.dataset.action === 'reveal-handout') {
      state.revealed = true;
      render();
      return;
    }

    if (target.dataset.action === 'withdraw-handout') {
      state.revealed = false;
      render();
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'dmLibrarySearch') {
      state.search = event.target.value;
      render();
      const next = document.getElementById('dmLibrarySearch');
      if (next) {
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
    }
    if (event.target.id === 'dmQuantity') {
      state.quantity = Math.max(1, Math.min(20, Number(event.target.value) || 1));
      const summary = event.target.closest('.utility-pane')?.querySelector('.dm-live-summary strong');
      if (summary) summary.textContent = `Creates ${state.quantity} independent Session Actors`;
    }
  });

  scenarioSelect.addEventListener('change', () => setScenario(scenarioSelect.value));
  viewportSelect.addEventListener('change', () => {
    state.viewport = viewportSelect.value;
    render();
  });

  initControls();
  render();
})();
