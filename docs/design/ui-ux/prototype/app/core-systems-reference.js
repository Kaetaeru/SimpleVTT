(function () {
  'use strict';

  var root = document.getElementById('appRoot');
  var viewport = document.getElementById('reviewViewport');
  var scenarioSelect = document.getElementById('scenarioSelect');
  var viewportSelect = document.getElementById('viewportSelect');
  var scenarioTitle = document.getElementById('scenarioTitle');
  var scenarioMeta = document.getElementById('scenarioMeta');
  if (!root || !viewport || !scenarioSelect || !viewportSelect) return;

  var scenarios = {
    'SYS-SCN-00': { label: 'Product placement map', view: 'offline' },
    'SYS-SCN-01': { label: 'Character Inventory management', view: 'offline' },
    'SYS-SCN-02': { label: 'Spellbook + Features management', view: 'offline' },
    'SYS-SCN-03': { label: 'Player live Quick Use', view: 'player' },
    'SYS-SCN-04': { label: 'DM unified Quick Search', view: 'dm' },
    'SYS-SCN-05': { label: 'Party Stash / loot transfer', view: 'dm' },
    'SYS-SCN-06': { label: 'Rest preview / commit', view: 'player' },
    'SYS-SCN-07': { label: 'Condition / concentration response', view: 'player' }
  };

  var state = {
    scenarioId: 'SYS-SCN-00',
    viewport: 'normal',
    hotbarPage: 'Mixed',
    quickOpen: false,
    query: '',
    actorsAdded: 0,
    potionCount: 3,
    partyPotions: 4,
    rowanPotions: 0,
    previewImage: false,
    revealedImage: false,
    restType: 'Short'
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setScenario(id) {
    if (!scenarios[id]) id = 'SYS-SCN-00';
    state.scenarioId = id;
    state.quickOpen = id === 'SYS-SCN-04';
    state.query = '';
    state.previewImage = false;
    state.revealedImage = false;
    render();
  }

  function productNav(active, live) {
    var items = [
      ['home', 'Home'], ['characters', 'Characters'], ['session', 'Session'],
      ['content', 'Content'], ['rules', 'Rules'], ['settings', 'Settings']
    ];
    var buttons = items.map(function (item) {
      return '<button class="nav-item ' + (active === item[0] ? 'active' : '') + '" type="button">' + item[1] + '</button>';
    }).join('');
    return '<nav class="product-nav">' +
      '<div class="product-brand"><div class="product-brand__mark"></div><strong>SimpleVTT</strong></div>' +
      buttons + '<div class="nav-spacer"></div>' +
      (live ? '<button class="nav-return" type="button">Return to Play</button>' : '') +
      '</nav>';
  }

  function placementMap() {
    var cards = [
      ['M', 'MANAGE', 'Full owned/source state', 'Character Sheet: Inventory / Spells / Features / Status; Session: DM Library / Party Stash'],
      ['U', 'USE', 'Executable right now', 'Command Center: Mixed / Action / Spell / Item'],
      ['S', 'STATUS', 'Current effects that must stay visible', 'Actor Cards / Resource Rail / Concentration / current response'],
      ['Q', 'QUICK', 'Find and add without leaving Play', 'Ctrl+K: Actor / Image / Item / Condition / Rule']
    ].map(function (card) {
      return '<article class="system-map-card"><div class="system-map-icon">' + card[0] + '</div><strong>' + card[1] + '</strong><div><p>' + card[2] + '</p><div class="system-map-list"><span>' + card[3] + '</span></div></div><div class="system-map-arrow">ONE UX GRAMMAR</div></article>';
    }).join('');
    return '<section class="system-shell">' + productNav('home', false) +
      '<main class="system-page"><div class="system-page-heading"><div><span class="review-kicker">ONE UX GRAMMAR</span><h2>Core systems placement</h2><p>Management stays deep; live execution stays immediate.</p></div><span class="badge good">CANDIDATE</span></div>' +
      '<div class="system-map">' + cards + '</div>' +
      '<div class="system-principle"><strong>Example:</strong> Manage Potion quantity in Inventory, but use Potion x3 from the Item Hotbar. Prepare an NPC in DM Library, but add it live with Ctrl+K and +1.</div></main></section>';
  }

  function inventoryRow(icon, name, meta, tag, action) {
    return '<div class="inventory-row"><div class="item-glyph">' + icon + '</div><div class="item-main"><strong>' + name + '</strong><span>' + meta + '</span></div><span class="item-state">' + tag + '</span>' +
      '<button class="item-action' + (action ? '' : ' quiet') + '" ' + (action ? 'data-action="' + action + '"' : '') + ' type="button">' + (action ? 'Use' : 'Details') + '</button></div>';
  }

  function inventory() {
    return '<section class="system-shell">' + productNav('characters', false) +
      '<div class="system-sheet"><div class="system-sheet-toolbar"><strong>Rowan - Character Sheet</strong><span class="grow"></span><span class="badge">MANAGE</span></div>' +
      '<div class="system-sheet-body"><nav class="system-sheet-nav"><div class="nav-group">Character</div><button>Overview</button><button class="active" data-review-jump="SYS-SCN-01">Inventory</button><button data-review-jump="SYS-SCN-02">Spells</button><button data-review-jump="SYS-SCN-02">Features</button><button data-review-jump="SYS-SCN-07">Status</button></nav>' +
      '<main class="system-sheet-content"><div class="sheet-section-head"><div><h2>Inventory</h2><p>Owned state, equipment, containers, quantity, charges and transfer live here.</p></div><div class="sheet-summary-row"><span class="summary-pill">Carry <strong>74 / 120 lb</strong></span><span class="summary-pill">GP <strong>48</strong></span></div></div>' +
      '<div class="inventory-groups"><section class="inventory-group"><div class="inventory-group__head"><strong>EQUIPPED / ACTIVE</strong><span>2 items</span></div><div class="inventory-list">' +
      inventoryRow('W', 'Longsword', 'Weapon - wielded', 'WIELDED', '') + inventoryRow('S', 'Shield', 'Armor - equipped', 'EQUIPPED', '') + '</div></section>' +
      '<section class="inventory-group"><div class="inventory-group__head"><strong>CONSUMABLES</strong><span>play relevant</span></div><div class="inventory-list">' +
      inventoryRow('P', 'Potion of Healing', 'Consumable - quantity ' + state.potionCount, 'x' + state.potionCount, 'use-potion') + inventoryRow('A', 'Arrows', 'Inside Backpack', 'x18', '') + '</div></section>' +
      '<section class="inventory-group"><div class="inventory-group__head"><strong>CONTAINERS</strong><span>2</span></div><div class="inventory-list">' +
      inventoryRow('B', 'Backpack', 'Carried container', '9 items', '') + inventoryRow('R', 'Rope', 'Inside Backpack', 'x1', '') + '</div></section>' +
      '<section class="inventory-group"><div class="inventory-group__head"><strong>MAGIC / OTHER</strong><span>3</span></div><div class="inventory-list">' +
      inventoryRow('R', 'Ring of Protection', 'Magic item - attuned', 'ATTUNED', '') + inventoryRow('K', 'Mysterious Key', 'Quest item - passive', '-', '') + '</div></section></div></main></div></div></section>';
  }

  function spellsFeatures() {
    var spells = [
      ['Mage Hand', 'Cantrip - Utility', 'AVAILABLE'], ['Fire Bolt', 'Cantrip - Attack', 'AVAILABLE'],
      ['Sleep', 'Level 1 - Control', 'PREPARED'], ['Shield', 'Level 1 - Reaction', 'PREPARED'],
      ['Mirror Image', 'Level 2 - Defense', 'PREPARED']
    ].map(function (s) {
      return '<div class="spell-row"><div><strong>' + s[0] + '</strong><span>' + s[1] + '</span></div><span class="system-tag active">' + s[2] + '</span><button class="item-action quiet">Details</button></div>';
    }).join('');
    var features = [
      ['Rage', 'Executable - resource 2/3', 'HOTBAR', 'active'],
      ['Reckless Attack', 'Executable', 'HOTBAR', 'active'],
      ['Danger Sense', 'Passive rule contribution', 'PASSIVE', 'passive'],
      ['Darkvision', 'Passive sense', 'PASSIVE', 'passive']
    ].map(function (f) {
      return '<div class="feature-row"><div><strong>' + f[0] + '</strong><span>' + f[1] + '</span></div><span class="system-tag ' + f[3] + '">' + f[2] + '</span><button class="item-action quiet">Details</button></div>';
    }).join('');
    return '<section class="system-shell">' + productNav('characters', false) +
      '<div class="system-sheet"><div class="system-sheet-toolbar"><strong>Rowan - Character Sheet</strong><span class="grow"></span><span class="badge">MANAGE</span></div>' +
      '<div class="system-sheet-body"><nav class="system-sheet-nav"><div class="nav-group">Character</div><button>Overview</button><button data-review-jump="SYS-SCN-01">Inventory</button><button class="active">Spells</button><button class="active">Features</button><button data-review-jump="SYS-SCN-07">Status</button></nav>' +
      '<main class="system-sheet-content"><div class="sheet-section-head"><div><h2>Spells & Features</h2><p>Known/owned records stay here. Only executable capabilities project to Play.</p></div><div class="sheet-summary-row"><span class="summary-pill">L1 Slots <strong>2 / 4</strong></span><span class="summary-pill">Rage <strong>2 / 3</strong></span></div></div>' +
      '<div class="spell-feature-grid"><section class="system-panel"><div class="system-panel__head"><strong>Spellbook</strong><span>KNOWN / PREPARED</span></div><div class="system-panel__body"><div class="spell-list">' + spells + '</div></div></section>' +
      '<section class="system-panel"><div class="system-panel__head"><strong>Features & Traits</strong><span>PASSIVE != EXECUTABLE</span></div><div class="system-panel__body"><div class="feature-list">' + features + '</div></div></section></div></main></div></div></section>';
  }

  function actorCard(name, initials, relation, meta, extra) {
    return '<button class="actor-card ' + relation + '"><div class="actor-avatar">' + initials + '</div><div class="actor-card__body"><strong>' + name + '</strong><div class="actor-meta"><span>' + meta + '</span>' + (extra || '') + '</div><div class="actor-hp"><span style="width:78%"></span></div></div></button>';
  }

  function boards() {
    var extra = '';
    var i;
    for (i = 0; i < state.actorsAdded; i += 1) extra += actorCard('Nightcrow Archer ' + (i + 1), 'NA', 'hostile', 'Session Actor - HP 22', '');
    return {
      upper: '<div class="actor-board opposing">' + actorCard('Bandit Lookout', 'BL', 'hostile', 'Hostile - HP 17', '') + actorCard('Suspicious Guide', 'SG', 'neutral', 'Neutral - HP 19', '') + extra + '</div>',
      lower: '<div class="actor-board allied">' + actorCard('Rowan', 'RO', 'allied controlled', 'Player - HP 31', '<span class="control-status condition">Poisoned</span>') + actorCard('Leonhardt', 'LE', 'allied', 'Ally - HP 44', '') + '</div>'
    };
  }

  function hotbarSlot(icon, name, sub, action) {
    return '<button class="system-hotbar-slot" ' + (action ? 'data-action="' + action + '"' : '') + '><strong>' + icon + '</strong><span>' + name + '</span><small>' + sub + '</small></button>';
  }

  function commandCenter(dm) {
    var page = state.hotbarPage;
    var slots;
    if (page === 'Spell') slots = hotbarSlot('S', 'Sleep', 'L1', '') + hotbarSlot('M', 'Mirror Image', 'L2', '') + hotbarSlot('B', 'Shield', 'L1', '');
    else if (page === 'Item') slots = hotbarSlot('P', 'Potion', 'x' + state.potionCount, 'use-potion') + hotbarSlot('W', 'Wand', '4/7', '') + hotbarSlot('L', 'Longsword', 'Wielded', '');
    else slots = hotbarSlot('A', 'Attack', 'Action', '') + hotbarSlot('R', 'Rage', '2/3', '') + hotbarSlot('S', 'Sleep', 'L1', '') + hotbarSlot('P', 'Potion', 'x' + state.potionCount, 'use-potion');
    var tabs = ['Mixed', 'Action', 'Spell', 'Item', 'Custom'].map(function (tab) {
      return '<button class="system-hotbar-tab ' + (page === tab ? 'active' : '') + '" data-hotbar-page="' + tab + '">' + tab + '</button>';
    }).join('');
    return '<div class="system-command"><div class="system-command-top"><span class="economy-chip freeform">Freeform - no turn economy</span><span class="resource-pill">HP <strong>31/36</strong></span><span class="resource-pill">Rage <strong>2/3</strong></span><span class="resource-pill">L1 Slots <strong>2/4</strong></span></div>' +
      '<div class="system-command-body"><div class="system-controlled"><div class="system-controlled__portrait">RO</div><div class="system-controlled__body"><strong>Rowan</strong><p>Controlled Actor - HP 31/36</p><div class="control-statuses"><span class="control-status">Concentration - Hold Person</span><span class="control-status condition">Poisoned</span></div></div></div>' +
      '<div class="system-hotbar"><div class="system-hotbar-tabs">' + tabs + '</div><div class="system-hotbar-slots">' + slots + '</div></div>' +
      '<div class="system-context">' + (dm ? '<button class="btn" data-action="toggle-quick">+ Quick</button>' : '<button class="btn">Context</button>') + '<button class="btn">Sheet</button></div></div></div>';
  }

  function quickPalette() {
    var entries = [
      ['ACTOR', 'NA', 'Nightcrow Archer', 'DM Library - Bandits - Ranged', '<button class="quick-action" data-action="add-actor">+1</button><button class="quick-action secondary" data-action="more-actor">More</button>'],
      ['IMAGE', 'IMG', 'Sealed Letter', 'DM Library - Handouts', '<button class="quick-action secondary" data-action="view-image">View</button><button class="quick-action" data-action="reveal-image">Reveal</button>'],
      ['ITEM', 'POT', 'Potion of Healing', 'ContentCatalog - ItemDefinition', '<button class="quick-action" data-action="party-item">Party</button>'],
      ['CONDITION', '!', 'Poisoned', 'Rules/Profile condition source', '<button class="quick-action" data-action="apply-condition">Apply</button>'],
      ['RULE', 'R', 'Poisoned', 'Rules Browser', '<button class="quick-action secondary" data-action="open-rule">Open</button>']
    ];
    var q = state.query.toLowerCase();
    var rows = entries.filter(function (e) { return !q || (e[0] + ' ' + e[2] + ' ' + e[3]).toLowerCase().indexOf(q) >= 0; }).map(function (e) {
      return '<div class="quick-result"><div class="quick-result__icon">' + e[1] + '</div><div class="quick-result__copy"><strong>' + e[2] + '</strong><span>' + e[3] + '</span><span class="quick-result__type">' + e[0] + '</span></div><div class="quick-actions">' + e[4] + '</div></div>';
    }).join('');
    return '<div class="quick-layer"><section class="quick-palette"><div class="quick-search-row"><div class="quick-glyph">Q</div><input id="quickSearchInput" class="quick-search" value="' + esc(state.query) + '" placeholder="Actor, Image, Item, Condition, Rule" /><span class="quick-shortcut">Ctrl+K</span></div><div class="quick-help"><span>Esc close</span><span>Empty query = Recent / Favorites</span></div><div class="quick-results">' + rows + '</div></section></div>';
  }

  function play(dm, mode) {
    var b = boards();
    var chrome = '<header class="play-chrome"><div class="play-chrome__title"><button class="chrome-btn">Back</button><strong>Crosswatch Session</strong><span>' + (dm ? 'HOST - DM' : 'CLIENT - PLAYER') + ' - Connected</span></div><div class="play-spacer"></div><button class="chrome-btn">Sheet</button><button class="chrome-btn">Rules</button>' + (dm ? '<button class="chrome-btn">Activity</button><button class="chrome-btn">Encounter</button><button class="chrome-btn quick" data-action="toggle-quick">+</button>' : '<button class="chrome-btn">Session</button>') + '</header>';
    var stage = '<div class="system-stage-copy"><span>' + (dm ? 'DM FREEFORM' : 'PLAYER FREEFORM') + '</span><h2>Full systems stay out of Play</h2><p>Only executable capabilities and important current status are projected here.</p></div>';
    if (mode === 'status') stage = '<div class="system-stage-copy"><span>CURRENT RESPONSE</span><h2>Status stays compact until response is needed</h2><p>Poisoned and Concentration remain visible without opening a permanent management panel.</p></div>';
    if (state.revealedImage) stage = '<div class="handout-overlay"><div class="handout-art"></div></div>';
    var overlays = '';
    if (dm && state.quickOpen) overlays += quickPalette();
    if (state.previewImage) overlays += '<aside class="private-preview"><div class="private-preview__art">SEALED LETTER</div><strong>PRIVATE PREVIEW - NOT SHARED</strong><p>Preview does not reveal this image.</p><div><button class="btn primary" data-action="reveal-image">Reveal</button><button class="btn" data-action="close-preview">Close</button></div></aside>';
    if (mode === 'rest') overlays += restDialog();
    if (mode === 'status') overlays += statusDialog();
    return '<section class="play-root">' + chrome + '<div class="play-main"><div class="play-core">' + b.upper + '<div class="mapless-stage"><div class="stage-label"><strong>MAPLESS PLAY CONTEXT</strong><span>Current task, not full management UI</span></div>' + stage + '</div>' + b.lower + '</div></div><footer class="command-center">' + commandCenter(dm) + '</footer>' + overlays + '</section>';
  }

  function partyStash() {
    return '<section class="system-shell">' + productNav('session', true) + '<main class="system-page"><div class="system-page-heading"><div><span class="review-kicker">SHARED INVENTORY CANDIDATE</span><h2>Party Stash</h2><p>Shared loot is separate from one Character inventory.</p></div></div><div class="party-layout"><section class="party-stash"><div class="party-stash__head"><strong>Crosswatch Party Stash</strong><div class="party-currency"><span>GP 482</span></div></div><div class="party-list"><div class="party-row"><div class="item-glyph">P</div><div><strong>Potion of Healing</strong><span>Shared stack</span></div><div><span class="item-state">x' + state.partyPotions + '</span></div></div><div class="party-row"><div class="item-glyph">K</div><div><strong>Ancient Key</strong><span>Quest item</span></div><span class="item-state">x1</span></div></div></section><aside class="transfer-panel"><div class="transfer-panel__head">Transfer</div><div class="transfer-panel__body"><div class="transfer-preview"><div class="transfer-box"><strong>Party</strong><span>' + state.partyPotions + ' -> ' + Math.max(0, state.partyPotions - 2) + '</span></div><div class="transfer-arrow">-></div><div class="transfer-box"><strong>Rowan</strong><span>' + state.rowanPotions + ' -> ' + (state.rowanPotions + 2) + '</span></div></div><button class="btn primary" data-action="transfer-party">Give 2 to Rowan</button></div></aside></div></main></section>';
  }

  function restDialog() {
    return '<div class="rest-layer"><section class="rest-dialog"><div class="rest-dialog__head"><strong>Rest Activity</strong><div class="rest-tabs"><button class="rest-tab ' + (state.restType === 'Short' ? 'active' : '') + '" data-rest="Short">Short Rest</button><button class="rest-tab ' + (state.restType === 'Long' ? 'active' : '') + '" data-rest="Long">Long Rest</button></div></div><div class="rest-dialog__body"><div class="rest-block"><strong>' + state.restType + ' Rest</strong><p>Preview changes first, ask only real choices, then commit explicitly.</p></div><div class="rest-block wide"><strong>Previewed changes</strong><div class="rest-change-list"><div class="rest-change"><span>HP / resources / features</span><b>Authoritative preview</b></div></div></div></div><div class="rest-dialog__actions"><button class="btn">Cancel</button><button class="btn primary">Complete ' + state.restType + ' Rest</button></div></section></div>';
  }

  function statusDialog() {
    return '<div class="resolution-panel" style="width:min(560px,70%)"><div class="resolution-panel__head"><strong>Current Status / Response</strong><span class="badge warn">CONTEXTUAL</span></div><div class="resolution-panel__body"><div class="status-board"><section class="status-card"><h3>Rowan</h3><div class="status-chip-row"><span class="status-chip condition">Poisoned</span><span class="status-chip">Concentration - Hold Person</span></div><div class="status-detail"><strong>Normal Play</strong>Only compact status stays persistent.</div></section><section class="status-card"><h3>Concentration response</h3><div class="status-detail"><strong>Damage taken: fixture 14</strong>Save DC and legality come from authoritative projection.</div><button class="btn primary">Roll Constitution Save</button></section></div></div></div>';
  }

  function render() {
    var current = scenarios[state.scenarioId];
    scenarioSelect.value = state.scenarioId;
    viewportSelect.value = state.viewport;
    viewport.className = 'review-viewport vp-' + state.viewport;
    scenarioTitle.textContent = state.scenarioId + ' - ' + current.label;
    scenarioMeta.textContent = current.view + ' - ' + state.viewport;
    if (state.scenarioId === 'SYS-SCN-00') root.innerHTML = placementMap();
    else if (state.scenarioId === 'SYS-SCN-01') root.innerHTML = inventory();
    else if (state.scenarioId === 'SYS-SCN-02') root.innerHTML = spellsFeatures();
    else if (state.scenarioId === 'SYS-SCN-03') root.innerHTML = play(false, 'normal');
    else if (state.scenarioId === 'SYS-SCN-04') root.innerHTML = play(true, 'normal');
    else if (state.scenarioId === 'SYS-SCN-05') root.innerHTML = partyStash();
    else if (state.scenarioId === 'SYS-SCN-06') root.innerHTML = play(false, 'rest');
    else root.innerHTML = play(false, 'status');
    var input = document.getElementById('quickSearchInput');
    if (input && state.quickOpen) input.focus();
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
    if (action === 'toggle-quick') { state.quickOpen = !state.quickOpen; state.query = ''; render(); }
    else if (action === 'add-actor') { state.actorsAdded += 1; state.quickOpen = false; render(); }
    else if (action === 'view-image') { state.previewImage = true; state.quickOpen = false; render(); }
    else if (action === 'reveal-image') { state.previewImage = false; state.revealedImage = true; state.quickOpen = false; render(); }
    else if (action === 'close-preview') { state.previewImage = false; render(); }
    else if (action === 'use-potion') { if (state.potionCount > 0) state.potionCount -= 1; render(); }
    else if (action === 'party-item') { state.partyPotions += 1; state.quickOpen = false; render(); }
    else if (action === 'transfer-party') { var n = Math.min(2, state.partyPotions); state.partyPotions -= n; state.rowanPotions += n; render(); }
  });

  document.addEventListener('input', function (event) {
    if (event.target.id === 'quickSearchInput') { state.query = event.target.value; render(); }
  });

  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k' && scenarios[state.scenarioId].view === 'dm') {
      event.preventDefault(); state.quickOpen = !state.quickOpen; state.query = ''; render();
    } else if (event.key === 'Escape' && (state.quickOpen || state.previewImage)) {
      state.quickOpen = false; state.previewImage = false; render();
    }
  });

  scenarioSelect.addEventListener('change', function () { setScenario(scenarioSelect.value); });
  viewportSelect.addEventListener('change', function () { state.viewport = viewportSelect.value; render(); });
  render();
})();
