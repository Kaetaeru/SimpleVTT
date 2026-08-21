(function () {
  'use strict';

  var root = document.getElementById('appRoot');
  var viewport = document.getElementById('reviewViewport');
  var scenarioSelect = document.getElementById('scenarioSelect');
  var viewportSelect = document.getElementById('viewportSelect');
  var scenarioTitle = document.getElementById('scenarioTitle');
  var scenarioMeta = document.getElementById('scenarioMeta');
  if (!root || !viewport || !scenarioSelect || !viewportSelect) return;

  var locale = 'ko-KR';

  var scenarios = [
    { id: 'SYS-SCN-00', label: '전체 시스템 위치', view: '오프라인', renderer: renderPlacementMap },
    { id: 'SYS-SCN-01', label: '캐릭터 인벤토리 관리', view: '오프라인', renderer: renderInventory },
    { id: 'SYS-SCN-02', label: '주문과 특성 관리', view: '오프라인', renderer: renderSpellsFeatures },
    { id: 'SYS-SCN-03', label: '플레이어 실시간 사용', view: '플레이어', renderer: function () { return renderPlay(false, 'normal'); } },
    { id: 'SYS-SCN-04', label: 'DM 빠른 검색', view: 'DM', renderer: function () { return renderPlay(true, 'quick'); } },
    { id: 'SYS-SCN-05', label: '파티 보관함과 분배', view: 'DM', renderer: renderPartyStash },
    { id: 'SYS-SCN-06', label: '휴식 미리보기와 적용', view: '플레이어', renderer: function () { return renderPlay(false, 'rest'); } },
    { id: 'SYS-SCN-07', label: '상태와 집중 대응', view: '플레이어', renderer: function () { return renderPlay(false, 'status'); } }
  ];

  var navRegistry = [
    { id: 'home', label: '홈' },
    { id: 'characters', label: '캐릭터' },
    { id: 'session', label: '세션' },
    { id: 'content', label: '콘텐츠' },
    { id: 'rules', label: '규칙' },
    { id: 'settings', label: '설정' }
  ];

  var sheetSectionRegistry = [
    { id: 'overview', label: '개요' },
    { id: 'inventory', label: '인벤토리', scenario: 'SYS-SCN-01' },
    { id: 'spells', label: '주문', scenario: 'SYS-SCN-02' },
    { id: 'features', label: '특성', scenario: 'SYS-SCN-02' },
    { id: 'status', label: '상태', scenario: 'SYS-SCN-07' }
  ];

  var hotbarPageRegistry = [
    { id: 'mixed', label: '혼합' },
    { id: 'action', label: '행동' },
    { id: 'spell', label: '주문' },
    { id: 'item', label: '아이템' },
    { id: 'custom', label: '사용자 지정' }
  ];

  var partyPolicyRegistry = [
    {
      id: 'shared',
      label: '공유 관리',
      summary: '플레이어가 직접 입고와 출고를 할 수 있고 DM은 전체 관리 권한을 가집니다.',
      permissions: ['플레이어 열람', '플레이어 입고', '플레이어 출고', 'DM 전체 관리']
    },
    {
      id: 'approval',
      label: 'DM 승인형',
      summary: '플레이어는 보관함을 보고 입고할 수 있지만 출고는 요청 후 DM 승인을 받습니다.',
      permissions: ['플레이어 열람', '플레이어 입고', '출고 요청', 'DM 승인/거절']
    },
    {
      id: 'managed',
      label: 'DM 관리형',
      summary: '플레이어는 공동 보관 상태를 확인하고 실제 입고·출고·지급은 DM이 처리합니다.',
      permissions: ['플레이어 열람', 'DM 입고', 'DM 출고', 'DM 지급']
    }
  ];

  var quickProviderRegistry = [
    {
      providerId: 'actor', typeLabel: '액터', icon: '액', name: '나이트크로우 궁수',
      meta: 'DM 라이브러리 · 산적 · 원거리',
      actions: [
        { label: '+1 추가', action: 'add-actor' },
        { label: '더 보기', action: 'more-actor', secondary: true }
      ]
    },
    {
      providerId: 'image', typeLabel: '이미지', icon: '그', name: '봉인된 편지',
      meta: 'DM 라이브러리 · 핸드아웃 · 단서',
      actions: [
        { label: '미리보기', action: 'preview-image' },
        { label: '공개', action: 'reveal-image', secondary: true }
      ]
    },
    {
      providerId: 'item', typeLabel: '아이템', icon: '물', name: '회복 물약',
      meta: '콘텐츠 카탈로그 · 아이템 정의',
      actions: [
        { label: '지급', action: 'quick-give' },
        { label: '파티 보관함', action: 'quick-party', secondary: true }
      ]
    },
    {
      providerId: 'condition', typeLabel: '상태', icon: '상', name: '중독',
      meta: '규칙 프로필 · 상태 정의',
      actions: [
        { label: '적용', action: 'apply-condition' }
      ]
    },
    {
      providerId: 'rule', typeLabel: '규칙', icon: '규', name: '중독',
      meta: '규칙 브라우저 · 권위 있는 규칙 조회',
      actions: [
        { label: '열기', action: 'open-rule' }
      ]
    }
  ];

  var state = {
    scenarioId: 'SYS-SCN-00',
    viewport: 'normal',
    hotbarPage: 'mixed',
    quickOpen: false,
    query: '',
    actorsAdded: 0,
    potionCount: 3,
    partyPotions: 4,
    rowanPotions: 0,
    transferQty: 2,
    previewImage: false,
    revealedImage: false,
    restType: 'short',
    partyPolicy: 'shared',
    toast: ''
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function currentScenario() {
    var i;
    for (i = 0; i < scenarios.length; i += 1) {
      if (scenarios[i].id === state.scenarioId) return scenarios[i];
    }
    return scenarios[0];
  }

  function setScenario(id) {
    var i;
    var found = false;
    for (i = 0; i < scenarios.length; i += 1) {
      if (scenarios[i].id === id) found = true;
    }
    state.scenarioId = found ? id : scenarios[0].id;
    state.quickOpen = state.scenarioId === 'SYS-SCN-04';
    state.query = '';
    state.previewImage = false;
    state.revealedImage = false;
    state.toast = '';
    render();
  }

  function productNav(active, live) {
    var buttons = navRegistry.map(function (item) {
      return '<button class="nav-item ' + (active === item.id ? 'active' : '') + '" type="button">' + esc(item.label) + '</button>';
    }).join('');
    return '<nav class="product-nav" aria-label="전역 내비게이션">' +
      '<div class="product-brand"><div class="product-brand__mark"></div><strong>SimpleVTT</strong></div>' +
      buttons + '<div class="nav-spacer"></div>' +
      (live ? '<button class="nav-return" type="button">플레이로 돌아가기</button>' : '') +
      '</nav>';
  }

  function renderPlacementMap() {
    var cards = [
      ['관', '관리', '전체 소유·설정 상태를 보고 정리', '캐릭터 시트 · DM 라이브러리 · 파티 보관함'],
      ['사', '사용', '지금 바로 실행 가능한 것만 표시', '커맨드 센터 · 행동 · 주문 · 아이템'],
      ['상', '상태', '잊으면 안 되는 현재 영향', '액터 카드 · 자원 표시줄 · 집중 · 현재 대응'],
      ['빠', '빠른 검색', '플레이를 떠나지 않고 찾고 추가', 'Ctrl+K · 액터 · 이미지 · 아이템 · 상태 · 규칙']
    ];
    var cardHtml = cards.map(function (card) {
      return '<article class="system-map-card"><div class="system-map-icon">' + card[0] + '</div><strong>' + card[1] + '</strong><div><p>' + card[2] + '</p><div class="system-map-list"><span>' + card[3] + '</span></div></div><div class="system-map-arrow">하나의 공통 UX 문법</div></article>';
    }).join('');

    return '<section class="system-shell">' + productNav('home', false) +
      '<main class="system-page"><div class="system-page-heading"><div><span class="review-kicker">한국어 우선 · 등록형 확장</span><h2>공식 시스템의 위치</h2><p>관리 화면은 깊게, 라이브 실행은 즉시. 새 시스템은 기존 화면을 갈아엎지 않고 등록형으로 추가합니다.</p></div><span class="badge good">후보안</span></div>' +
      '<div class="system-map">' + cardHtml + '</div>' +
      '<div class="system-principle"><strong>예시:</strong> 회복 물약의 수량과 보관 위치는 인벤토리에서 관리하지만, 플레이 중에는 아이템 단축바의 회복 물약 x3만 사용합니다. NPC는 DM 라이브러리에서 편집하지만 세션 중에는 Ctrl+K로 찾아 +1 추가만 하면 됩니다.</div></main></section>';
  }

  function sheetNav(active) {
    return '<nav class="system-sheet-nav" aria-label="캐릭터 시트 섹션"><div class="nav-group">캐릭터</div>' +
      sheetSectionRegistry.map(function (item) {
        var jump = item.scenario ? ' data-review-jump="' + item.scenario + '"' : '';
        return '<button class="' + (item.id === active ? 'active' : '') + '"' + jump + ' type="button">' + esc(item.label) + '</button>';
      }).join('') +
      '<div class="nav-group">플레이 도구</div><button type="button">주사위</button><button data-review-jump="SYS-SCN-06" type="button">휴식</button></nav>';
  }

  function inventoryRow(icon, name, meta, tag, actionLabel, action) {
    return '<div class="inventory-row"><div class="item-glyph">' + icon + '</div><div class="item-main"><strong>' + esc(name) + '</strong><span>' + esc(meta) + '</span></div><span class="item-state">' + esc(tag) + '</span>' +
      '<button class="item-action ' + (action ? '' : 'quiet') + '" ' + (action ? 'data-action="' + action + '"' : '') + ' type="button">' + esc(actionLabel || '상세') + '</button></div>';
  }

  function inventoryGroup(title, meta, rows) {
    return '<section class="inventory-group"><div class="inventory-group__head"><strong>' + esc(title) + '</strong><span>' + esc(meta) + '</span></div><div class="inventory-list">' + rows + '</div></section>';
  }

  function renderInventory() {
    var groups = '';
    groups += inventoryGroup('장착 / 활성', '2개',
      inventoryRow('검', '롱소드', '무기 · 주무기 사용 중', '사용 중', '상세', '') +
      inventoryRow('방', '방패', '방어구 · 장착됨', '장착', '상세', ''));
    groups += inventoryGroup('소모품', '플레이 관련',
      inventoryRow('물', '회복 물약', '소모품 · 수량 ' + state.potionCount, 'x' + state.potionCount, '사용', 'use-potion') +
      inventoryRow('화', '화살', '배낭 안', 'x18', '상세', ''));
    groups += inventoryGroup('보관함', '2개',
      inventoryRow('배', '배낭', '휴대 중인 보관함', '9개 보관', '열기', '') +
      inventoryRow('줄', '밧줄', '배낭 안 · 50피트', 'x1', '상세', ''));
    groups += inventoryGroup('마법 / 기타', '3개',
      inventoryRow('반', '보호의 반지', '마법 아이템 · 조율됨', '조율', '상세', '') +
      inventoryRow('열', '수수께끼의 열쇠', '퀘스트 아이템 · 수동 효과 없음', '-', '상세', ''));

    return '<section class="system-shell">' + productNav('characters', false) +
      '<div class="system-sheet"><div class="system-sheet-toolbar"><strong>로완 · 캐릭터 시트</strong><span class="grow"></span><span class="badge">관리</span></div>' +
      '<div class="system-sheet-body">' + sheetNav('inventory') +
      '<main class="system-sheet-content"><div class="sheet-section-head"><div><h2>인벤토리</h2><p>소유 상태, 장착, 보관함, 수량, 충전량과 전달을 관리합니다. 실제로 실행 가능한 기능만 플레이 화면에 투영됩니다.</p></div><div class="sheet-summary-row"><span class="summary-pill">휴대 <strong>74 / 120 lb</strong></span><span class="summary-pill">금화 <strong>48</strong></span><span class="summary-pill">조율 <strong>1 / 3</strong></span></div></div>' +
      '<div class="inventory-groups">' + groups + '</div></main></div></div></section>';
  }

  function renderSpellsFeatures() {
    var spells = [
      ['마법사의 손', '소마법 · 유틸리티', '사용 가능'],
      ['화염 화살', '소마법 · 공격', '사용 가능'],
      ['수면', '1레벨 · 제어', '준비됨'],
      ['방패', '1레벨 · 반응행동', '준비됨'],
      ['거울상', '2레벨 · 방어', '준비됨']
    ].map(function (item) {
      return '<div class="spell-row"><div><strong>' + esc(item[0]) + '</strong><span>' + esc(item[1]) + '</span></div><span class="system-tag active">' + esc(item[2]) + '</span><button class="item-action quiet" type="button">상세</button></div>';
    }).join('');

    var features = [
      ['격노', '실행 가능 · 자원 2/3', '단축바', 'active'],
      ['무모한 공격', '실행 가능', '단축바', 'active'],
      ['위험 감지', '지속 효과', '지속', 'passive'],
      ['암시야', '감각 지속 효과', '지속', 'passive']
    ].map(function (item) {
      return '<div class="feature-row"><div><strong>' + esc(item[0]) + '</strong><span>' + esc(item[1]) + '</span></div><span class="system-tag ' + item[3] + '">' + esc(item[2]) + '</span><button class="item-action quiet" type="button">상세</button></div>';
    }).join('');

    return '<section class="system-shell">' + productNav('characters', false) +
      '<div class="system-sheet"><div class="system-sheet-toolbar"><strong>로완 · 캐릭터 시트</strong><span class="grow"></span><span class="badge">관리</span></div>' +
      '<div class="system-sheet-body">' + sheetNav('spells') +
      '<main class="system-sheet-content"><div class="sheet-section-head"><div><h2>주문과 특성</h2><p>알고 있거나 소유한 전체 기록은 시트에 남고, 현재 실행 가능한 것만 커맨드 센터에 표시됩니다.</p></div><div class="sheet-summary-row"><span class="summary-pill">1레벨 슬롯 <strong>2 / 4</strong></span><span class="summary-pill">격노 <strong>2 / 3</strong></span></div></div>' +
      '<div class="spell-feature-grid"><section class="system-panel"><div class="system-panel__head"><strong>주문책</strong><span>알고 있음 / 준비 / 자원</span></div><div class="system-panel__body"><div class="spell-list">' + spells + '</div></div></section>' +
      '<section class="system-panel"><div class="system-panel__head"><strong>특성</strong><span>지속 효과와 실행 기능 분리</span></div><div class="system-panel__body"><div class="feature-list">' + features + '</div></div></section></div></main></div></div></section>';
  }

  function actorCard(name, initials, relation, meta, extra) {
    return '<button class="actor-card ' + relation + '" type="button"><div class="actor-avatar">' + esc(initials) + '</div><div class="actor-card__body"><strong>' + esc(name) + '</strong><div class="actor-meta"><span>' + esc(meta) + '</span>' + (extra || '') + '</div><div class="actor-hp"><span style="width:78%"></span></div></div></button>';
  }

  function boards() {
    var extra = '';
    var i;
    for (i = 0; i < state.actorsAdded; i += 1) {
      extra += actorCard('나이트크로우 궁수 ' + (i + 1), 'N', 'hostile', '세션 액터 · HP 22', '');
    }
    return {
      upper: '<div class="actor-board opposing">' + actorCard('산적 감시병', '산', 'hostile', '적대 · HP 17', '') + actorCard('수상한 안내인', '안', 'neutral', '중립 · HP 19', '') + extra + '</div>',
      lower: '<div class="actor-board allied">' + actorCard('로완', '로', 'allied controlled', '플레이어 · HP 31', '<span class="control-status condition">중독</span>') + actorCard('레온하르트', '레', 'allied', '아군 · HP 44', '') + '</div>'
    };
  }

  function renderPlayChrome(dm) {
    return '<header class="play-chrome"><div class="play-chrome__title"><button class="chrome-btn" type="button">← 제품</button><strong>크로스워치 세션</strong><span>' + (dm ? '호스트 · DM' : '클라이언트 · 플레이어') + ' · 연결됨</span></div><div class="play-spacer"></div>' +
      '<button class="chrome-btn" type="button">시트</button><button class="chrome-btn" type="button">규칙</button>' +
      (dm ? '<button class="chrome-btn dm" type="button">공개</button><button class="chrome-btn" type="button">활동</button><button class="chrome-btn" type="button">인카운터</button><button class="chrome-btn" type="button">참가자</button><button class="chrome-btn" type="button">세션</button><button class="chrome-btn quick" data-action="toggle-quick" title="빠른 검색 · Ctrl+K" type="button">+</button>' : '<button class="chrome-btn" type="button">세션</button>') +
      '</header>';
  }

  function hotbarSlots() {
    if (state.hotbarPage === 'spell') {
      return hotbarSlot('수', '수면', '1레벨', '') + hotbarSlot('거', '거울상', '2레벨', '') + hotbarSlot('방', '방패', '1레벨', '');
    }
    if (state.hotbarPage === 'item') {
      return hotbarSlot('물', '회복 물약', 'x' + state.potionCount, 'use-potion') + hotbarSlot('완', '마법봉', '4/7', '') + hotbarSlot('검', '롱소드', '사용 중', '');
    }
    if (state.hotbarPage === 'action') {
      return hotbarSlot('공', '공격', '행동', '') + hotbarSlot('격', '격노', '2/3', '') + hotbarSlot('밀', '밀치기', '행동', '');
    }
    return hotbarSlot('공', '공격', '행동', '') + hotbarSlot('격', '격노', '2/3', '') + hotbarSlot('수', '수면', '1레벨', '') + hotbarSlot('물', '회복 물약', 'x' + state.potionCount, 'use-potion');
  }

  function hotbarSlot(icon, name, sub, action) {
    return '<button class="system-hotbar-slot" ' + (action ? 'data-action="' + action + '"' : '') + ' type="button"><strong>' + esc(icon) + '</strong><span>' + esc(name) + '</span><small>' + esc(sub) + '</small></button>';
  }

  function commandCenter(dm) {
    var tabs = hotbarPageRegistry.map(function (item) {
      return '<button class="system-hotbar-tab ' + (state.hotbarPage === item.id ? 'active' : '') + '" data-hotbar-page="' + item.id + '" type="button">' + esc(item.label) + '</button>';
    }).join('');

    return '<div class="system-command"><div class="system-command-top"><span class="economy-chip freeform">자유 진행 · 턴 자원 없음</span><span class="resource-pill">HP <strong>31/36</strong></span><span class="resource-pill">격노 <strong>2/3</strong></span><span class="resource-pill">1레벨 슬롯 <strong>2/4</strong></span></div>' +
      '<div class="system-command-body"><div class="system-controlled"><div class="system-controlled__portrait">로</div><div class="system-controlled__body"><strong>로완</strong><p>조작 중 · HP 31/36</p><div class="control-statuses"><span class="control-status">집중 · 인간형 포박</span><span class="control-status condition">중독</span></div></div></div>' +
      '<div class="system-hotbar"><div class="system-hotbar-tabs">' + tabs + '</div><div class="system-hotbar-slots">' + hotbarSlots() + '</div></div>' +
      '<div class="system-context">' + (dm ? '<button class="btn" data-action="toggle-quick" type="button">+ 빠른 검색</button>' : '<button class="btn" type="button">상황</button>') + '<button class="btn" type="button">시트</button></div></div></div>';
  }

  function quickResult(entry) {
    var actions = entry.actions.map(function (action) {
      return '<button class="quick-action ' + (action.secondary ? 'secondary' : '') + '" data-action="' + esc(action.action) + '" type="button">' + esc(action.label) + '</button>';
    }).join('');
    return '<div class="quick-result"><div class="quick-result__icon">' + esc(entry.icon) + '</div><div class="quick-result__copy"><strong>' + esc(entry.name) + '</strong><span>' + esc(entry.meta) + '</span><span class="quick-result__type">' + esc(entry.typeLabel) + '</span></div><div class="quick-actions">' + actions + '</div></div>';
  }

  function quickPalette() {
    var q = state.query.toLowerCase();
    var results = quickProviderRegistry.filter(function (entry) {
      var haystack = (entry.name + ' ' + entry.typeLabel + ' ' + entry.meta).toLowerCase();
      return !q || haystack.indexOf(q) !== -1;
    });

    return '<div class="quick-layer"><section class="quick-palette" role="dialog" aria-label="DM 빠른 검색"><div class="quick-search-row"><div class="quick-glyph">⌕</div><input id="quickSearchInput" class="quick-search" value="' + esc(state.query) + '" placeholder="액터, 이미지, 아이템, 상태, 규칙 검색" /><span class="quick-shortcut">Ctrl+K</span></div>' +
      '<div class="quick-help"><span>검색하지 않으면 최근 사용 항목</span><span>Esc 닫기</span><span>결과 종류는 프로바이더로 확장 가능</span></div><div class="quick-results"><div class="quick-section-label">' + (q ? '검색 결과' : '최근 / 즐겨찾기') + '</div>' +
      (results.length ? results.map(quickResult).join('') : '<div class="notice">일치하는 결과가 없습니다.</div>') + '</div></section></div>';
  }

  function privatePreview() {
    return '<aside class="private-preview"><div class="private-preview__art">봉인된 편지</div><strong>비공개 미리보기 · 공유되지 않음</strong><p>미리보기는 DM 로컬 화면에만 나타납니다. 공개를 명시적으로 누르기 전에는 플레이어에게 전달되지 않습니다.</p><div style="display:flex;gap:5px;margin-top:8px"><button class="btn primary" data-action="reveal-image" type="button">플레이어에게 공개</button><button class="btn" data-action="close-preview" type="button">닫기</button></div></aside>';
  }

  function renderPlay(dm, mode) {
    var b = boards();
    var stage = '<div class="system-stage-copy"><span>' + (dm ? 'DM 자유 진행' : '플레이어 자유 진행') + '</span><h2>전체 관리 화면은 플레이 영역 밖에 둡니다</h2><p>현재 실행 가능한 기능과 중요한 상태만 플레이 화면에 투영됩니다.</p></div>';
    if (state.revealedImage) stage = '<div class="handout-overlay"><div class="handout-art"></div></div>';
    if (mode === 'status') stage = '<div class="system-stage-copy"><span>현재 대응</span><h2>상태는 작게 유지하고 필요할 때만 확장</h2><p>액터 카드와 커맨드 센터에는 중독과 집중만 압축 표시하고 상세 대응은 현재 작업 위에 잠시 엽니다.</p></div>';

    var overlays = '';
    if (dm && state.quickOpen) overlays += quickPalette();
    if (state.previewImage) overlays += privatePreview();
    if (mode === 'rest') overlays += restDialog();
    if (mode === 'status') overlays += statusDialog();
    if (state.toast) overlays += '<div class="quick-toast">' + esc(state.toast) + '</div>';

    return '<section class="play-root">' + renderPlayChrome(dm) + '<div class="play-main"><div class="play-core">' + b.upper + '<div class="mapless-stage"><div class="stage-label"><strong>맵리스 플레이 컨텍스트</strong><span>현재 작업 · 주사위 · 결과 · 핸드아웃</span></div>' + stage + '</div>' + b.lower + '</div></div><footer class="command-center">' + commandCenter(dm) + '</footer>' + overlays + '</section>';
  }

  function currentPartyPolicy() {
    var i;
    for (i = 0; i < partyPolicyRegistry.length; i += 1) {
      if (partyPolicyRegistry[i].id === state.partyPolicy) return partyPolicyRegistry[i];
    }
    return partyPolicyRegistry[0];
  }

  function partyItemRow(icon, name, meta, count, action) {
    return '<div class="party-row"><div class="item-glyph">' + icon + '</div><div><strong>' + esc(name) + '</strong><span>' + esc(meta) + '</span></div><div style="display:flex;align-items:center;gap:5px"><span class="item-state">' + esc(count) + '</span>' + (action ? '<button class="item-action" data-action="' + action + '" type="button">분배</button>' : '') + '</div></div>';
  }

  function renderPartyStash() {
    var policy = currentPartyPolicy();
    var policyOptions = partyPolicyRegistry.map(function (item) {
      return '<option value="' + item.id + '" ' + (item.id === state.partyPolicy ? 'selected' : '') + '>' + esc(item.label) + '</option>';
    }).join('');
    var permissionHtml = policy.permissions.map(function (item) {
      return '<span class="status-chip">' + esc(item) + '</span>';
    }).join('');

    return '<section class="system-shell">' + productNav('session', true) + '<main class="system-page"><div class="system-page-heading"><div><span class="review-kicker">세션 · 공동 소유 후보</span><h2>파티 보관함</h2><p>아이템 데이터는 공동 소유 상태로 유지하고, 누가 무엇을 할 수 있는지는 별도 정책으로 바꿉니다.</p></div><span class="badge warn">도메인 계약 필요</span></div>' +
      '<div class="party-layout"><section class="party-stash"><div class="party-stash__head"><strong>크로스워치 파티 보관함</strong><div class="party-currency"><span>금화 482</span><span>은화 31</span></div></div><div class="party-list">' +
      partyItemRow('물', '회복 물약', '공동 보관 · 사용 가능 ' + state.partyPotions + '개', 'x' + state.partyPotions, 'select-potion') +
      partyItemRow('열', '고대의 열쇠', '퀘스트 아이템 · 공동 소유', 'x1', '') +
      partyItemRow('비', '용의 비늘', '재료 / 전리품', 'x2', '') + '</div></section>' +
      '<aside class="transfer-panel"><div class="transfer-panel__head">보관 정책과 분배</div><div class="transfer-panel__body"><label class="control-field"><span>파티 보관함 운영 방식</span><select id="partyPolicySelect">' + policyOptions + '</select></label>' +
      '<div class="status-detail"><strong>' + esc(policy.label) + '</strong>' + esc(policy.summary) + '</div><div class="status-chip-row">' + permissionHtml + '</div>' +
      '<div class="status-detail"><strong>설계 원칙</strong>이 세 가지는 초기 프리셋일 뿐입니다. 실제 저장 모델은 권한 capability 집합으로 확장할 수 있게 설계합니다.</div>' +
      '<div class="transfer-target"><select aria-label="분배 대상"><option>로완</option><option>레온하르트</option></select><input id="transferQty" type="number" min="1" max="' + state.partyPotions + '" value="' + state.transferQty + '" /></div>' +
      '<div class="transfer-preview"><div class="transfer-box"><strong>파티</strong><span>' + state.partyPotions + ' → ' + Math.max(0, state.partyPotions - state.transferQty) + '</span></div><div class="transfer-arrow">→</div><div class="transfer-box"><strong>로완</strong><span>' + state.rowanPotions + ' → ' + (state.rowanPotions + state.transferQty) + '</span></div></div>' +
      '<button class="btn primary" data-action="transfer-potion" type="button">로완에게 지급</button></div></aside></div></main></section>';
  }

  function restDialog() {
    var shortRest = state.restType === 'short';
    return '<div class="rest-layer"><section class="rest-dialog" role="dialog" aria-label="휴식 미리보기"><div class="rest-dialog__head"><strong>휴식</strong><div class="rest-tabs"><button class="rest-tab ' + (shortRest ? 'active' : '') + '" data-rest="short" type="button">짧은 휴식</button><button class="rest-tab ' + (!shortRest ? 'active' : '') + '" data-rest="long" type="button">긴 휴식</button></div></div>' +
      '<div class="rest-dialog__body"><div class="rest-block"><strong>' + (shortRest ? '짧은 휴식' : '긴 휴식') + '</strong><p>휴식 종류별 결과를 UI가 직접 계산하지 않고 규칙 프로필이 제공한 미리보기를 보여줍니다.</p></div><div class="rest-block"><strong>현재 상태</strong><div class="status-chip-row"><span class="status-chip good">HP 31/36</span><span class="status-chip">격노 2/3</span><span class="status-chip">1레벨 슬롯 2/4</span></div></div>' +
      '<div class="rest-block wide"><strong>변경 미리보기</strong><div class="rest-change-list">' +
      (shortRest ? '<div class="rest-change"><span>히트 다이스</span><b>사용 수 선택</b></div><div class="rest-change"><span>짧은 휴식 회복 자원</span><b>규칙 프로필 제공</b></div>' : '<div class="rest-change"><span>HP / 주문 슬롯 / 자원</span><b>규칙 프로필 제공</b></div><div class="rest-change"><span>상태 변화</span><b>규칙 프로필 제공</b></div>') +
      '</div></div></div><div class="rest-dialog__actions"><button class="btn" data-review-jump="SYS-SCN-03" type="button">취소</button><button class="btn primary" data-action="complete-rest" type="button">휴식 적용</button></div></section></div>';
  }

  function statusDialog() {
    return '<div class="resolution-panel" style="width:min(560px,70%)"><div class="resolution-panel__head"><strong>현재 상태 / 대응</strong><span class="badge warn">상황형</span></div><div class="resolution-panel__body"><div class="status-board"><section class="status-card"><h3>로완</h3><div class="status-chip-row"><span class="status-chip condition">중독</span><span class="status-chip">집중 · 인간형 포박</span></div><div class="status-detail"><strong>평상시</strong>액터 카드와 커맨드 센터에는 중요한 상태만 압축해서 보여줍니다.</div></section><section class="status-card"><h3>집중 대응</h3><div class="status-detail"><strong>피해를 받음</strong>DC, 수정치, 가능 여부는 UI가 계산하지 않고 권위 있는 대응 상태를 사용합니다.</div><button class="btn primary" type="button">건강 내성 굴림</button><button class="btn" data-review-jump="SYS-SCN-03" type="button">닫기</button></section></div></div></div>';
  }

  function showToast(message) {
    state.toast = message;
    render();
  }

  function render() {
    var scenario = currentScenario();
    scenarioSelect.value = state.scenarioId;
    viewportSelect.value = state.viewport;
    viewport.className = 'review-viewport vp-' + state.viewport;
    scenarioTitle.textContent = scenario.id + ' · ' + scenario.label;
    scenarioMeta.textContent = scenario.view + ' · ' + state.viewport + ' · ' + locale;
    root.innerHTML = scenario.renderer();

    var quickInput = document.getElementById('quickSearchInput');
    if (quickInput && state.quickOpen) {
      setTimeout(function () { quickInput.focus(); }, 0);
    }
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-review-jump],[data-hotbar-page],[data-action],[data-rest]');
    if (!target) return;

    if (target.getAttribute('data-review-jump')) {
      setScenario(target.getAttribute('data-review-jump'));
      return;
    }

    if (target.getAttribute('data-hotbar-page')) {
      state.hotbarPage = target.getAttribute('data-hotbar-page');
      render();
      return;
    }

    if (target.getAttribute('data-rest')) {
      state.restType = target.getAttribute('data-rest');
      render();
      return;
    }

    var action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'toggle-quick') {
      state.quickOpen = !state.quickOpen;
      state.query = '';
      render();
      return;
    }
    if (action === 'add-actor') {
      state.actorsAdded += 1;
      state.quickOpen = false;
      showToast('나이트크로우 궁수 1명을 독립 세션 액터로 추가했습니다.');
      return;
    }
    if (action === 'more-actor') {
      showToast('추가 수량과 상세 옵션은 확장 가능한 액션 목록으로 제공합니다.');
      return;
    }
    if (action === 'preview-image') {
      state.previewImage = true;
      state.quickOpen = false;
      render();
      return;
    }
    if (action === 'reveal-image') {
      state.previewImage = false;
      state.quickOpen = false;
      state.revealedImage = true;
      showToast('봉인된 편지를 플레이어에게 공개했습니다.');
      return;
    }
    if (action === 'close-preview') {
      state.previewImage = false;
      render();
      return;
    }
    if (action === 'quick-party') {
      state.partyPotions += 1;
      state.quickOpen = false;
      showToast('회복 물약을 파티 보관함 후보 흐름으로 보냈습니다.');
      return;
    }
    if (action === 'quick-give') {
      showToast('지급 대상과 lifetime 검증이 필요한 흐름입니다.');
      return;
    }
    if (action === 'apply-condition') {
      state.quickOpen = false;
      showToast('중독 적용을 권위 있는 상태 적용 흐름으로 전달합니다.');
      return;
    }
    if (action === 'open-rule') {
      state.quickOpen = false;
      showToast('현재 플레이를 유지한 채 규칙 조회를 엽니다.');
      return;
    }
    if (action === 'use-potion') {
      if (state.potionCount > 0) state.potionCount -= 1;
      showToast('데모: 회복 물약 수량이 ' + state.potionCount + '개로 변경되었습니다.');
      return;
    }
    if (action === 'select-potion') {
      state.transferQty = Math.min(2, state.partyPotions || 1);
      render();
      return;
    }
    if (action === 'transfer-potion') {
      var amount = Math.max(1, Math.min(state.partyPotions, state.transferQty));
      state.partyPotions -= amount;
      state.rowanPotions += amount;
      showToast('데모: 파티 보관함에서 로완에게 ' + amount + '개를 지급했습니다.');
      return;
    }
    if (action === 'complete-rest') {
      state.scenarioId = 'SYS-SCN-03';
      state.toast = '데모: 휴식 미리보기를 적용했습니다.';
      render();
    }
  });

  document.addEventListener('input', function (event) {
    if (event.target.id === 'quickSearchInput') {
      state.query = event.target.value;
      render();
      return;
    }
    if (event.target.id === 'transferQty') {
      state.transferQty = Math.max(1, Math.min(state.partyPotions || 1, Number(event.target.value) || 1));
      render();
    }
  });

  document.addEventListener('change', function (event) {
    if (event.target.id === 'partyPolicySelect') {
      state.partyPolicy = event.target.value;
      render();
    }
  });

  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
      if (state.scenarioId !== 'SYS-SCN-04') return;
      event.preventDefault();
      state.quickOpen = !state.quickOpen;
      state.query = '';
      render();
      return;
    }
    if (event.key === 'Escape' && (state.quickOpen || state.previewImage)) {
      state.quickOpen = false;
      state.previewImage = false;
      render();
    }
  });

  scenarioSelect.innerHTML = scenarios.map(function (scenario) {
    return '<option value="' + scenario.id + '">' + scenario.id + ' · ' + esc(scenario.label) + '</option>';
  }).join('');

  scenarioSelect.addEventListener('change', function () {
    setScenario(scenarioSelect.value);
  });

  viewportSelect.addEventListener('change', function () {
    state.viewport = viewportSelect.value;
    render();
  });

  render();
})();
