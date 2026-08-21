window.PROTOTYPE_FIXTURES = (() => {
  const characters = [
    {
      id: 'rowan', name: 'Rowan Ash', summary: 'Fighter 5', hp: 38, hpMax: 44, tempHp: 4,
      initials: 'RA', conditions: [], sheet: 'official', resources: ['Second Wind 1/1', 'Action Surge 1/1']
    },
    {
      id: 'mina', name: 'Mina Vale', summary: 'Wizard 5', hp: 21, hpMax: 28, tempHp: 0,
      initials: 'MV', conditions: ['Concentrating'], sheet: 'svtt', resources: ['Spell 1 4/4', 'Spell 2 3/3', 'Spell 3 2/2', 'Arcane 1/1']
    },
    {
      id: 'long', name: 'A Very Long Character Name For Truncation Review', summary: 'Ranger 5', hp: 31, hpMax: 36, tempHp: 0,
      initials: 'LR', conditions: ['Hidden'], sheet: 'svtt', resources: ['Focus 2/3']
    }
  ];

  const actors = [
    { id: 'rowan', name: 'Rowan Ash', relation: 'allied', hp: '38/44 +4', controlled: true, currentTurn: true, initiative: 18, conditions: [], valid: false, invalidReason: 'Self is not a valid target for this mock action.' },
    { id: 'mina', name: 'Mina Vale', relation: 'allied', hp: '21/28', controlled: false, currentTurn: false, initiative: 14, conditions: ['Concentrating'], valid: true },
    { id: 'guard', name: 'Lantern Guard', relation: 'allied', hp: '24/24', controlled: false, currentTurn: false, initiative: 10, conditions: [], valid: true },
    { id: 'nera', name: 'Archivist Nera', relation: 'neutral', hp: '—', controlled: false, currentTurn: false, initiative: 8, conditions: [], valid: false, invalidReason: 'Mock authoritative state: neutral Actor is not eligible.' },
    { id: 'raider', name: 'Ash Raider', relation: 'hostile', hp: '18/27', controlled: false, currentTurn: false, initiative: 16, conditions: ['Marked'], valid: true },
    { id: 'hound', name: 'Iron Hound', relation: 'hostile', hp: '30/30', controlled: false, currentTurn: false, initiative: 12, conditions: [], valid: false, invalidReason: 'Mock authoritative state: target unavailable.' },
    { id: 'captain', name: 'Long-Name Hostile Captain of the Eastern Gate', relation: 'hostile', hp: '42/52', controlled: false, currentTurn: false, initiative: 9, conditions: ['Guarded'], valid: true },
    { id: 'raider2', name: 'Ash Raider Scout', relation: 'hostile', hp: '11/20', controlled: false, currentTurn: false, initiative: 7, conditions: [], valid: true }
  ];

  const capabilities = [
    { id: 'main-hand', label: 'Main Hand Strike', category: 'Action', shortcut: '1', cost: 'Action', available: true, targetMode: 'single' },
    { id: 'arc-bolt', label: 'Arc Bolt', category: 'Spell', shortcut: '2', cost: 'Action · Spell 1', available: true, targetMode: 'single' },
    { id: 'quick-step', label: 'Quick Step', category: 'Action', shortcut: '3', cost: 'Bonus', available: true, targetMode: 'self' },
    { id: 'guard', label: 'Guard', category: 'Action', shortcut: '4', cost: 'Reaction', available: false, unavailableReason: 'Mock authoritative state: Reaction already spent.', targetMode: 'self' },
    { id: 'ward', label: 'Ward', category: 'Spell', shortcut: '5', cost: 'Spell 2', available: true, targetMode: 'single' },
    { id: 'draught', label: 'Healing Draught', category: 'Item', shortcut: '6', cost: 'Item ×2', available: true, targetMode: 'single' },
    { id: 'dash', label: 'Dash', category: 'Action', shortcut: '7', cost: 'Action', available: true, targetMode: 'self' },
    { id: 'interact', label: 'Interact', category: 'Action', shortcut: '8', cost: 'Context', available: true, targetMode: 'none' },
    { id: 'mock-extra-1', label: 'Smoke Lens', category: 'Item', shortcut: '9', cost: 'Charge 2/3', available: true, targetMode: 'none' },
    { id: 'mock-extra-2', label: 'Signal Flare', category: 'Item', shortcut: '0', cost: 'Charge 1/2', available: true, targetMode: 'single' },
    { id: 'mock-extra-3', label: 'Long Capability Name For Density Stress', category: 'Custom', shortcut: '-', cost: 'Mock Resource', available: true, targetMode: 'multi' },
    { id: 'mock-extra-4', label: 'Unavailable Capability', category: 'Custom', shortcut: '-', cost: '—', available: false, unavailableReason: 'Mock authoritative reason supplied by fixture.', targetMode: 'single' }
  ];

  const activity = [
    { id: 'ev1', visibility: 'public', title: 'Rowan · Main Hand Strike', detail: 'Mock public result · 21 total', time: '20:14' },
    { id: 'ev2', visibility: 'dm-only', title: 'DM · Hidden adjudication', detail: 'Mock private event. Player receives no placeholder.', time: '20:15' },
    { id: 'ev3', visibility: 'public', title: 'Initiative started', detail: 'Round 1', time: '20:16' },
    { id: 'ev4', visibility: 'public', title: 'Correction applied', detail: 'Corrects ev1 · prior record remains inspectable', time: '20:17', correctionOf: 'ev1' },
    { id: 'ev5', visibility: 'public', title: 'Result disclosed', detail: 'Authorized public projection of a prior hidden result', time: '20:18', disclosureOf: 'ev2' }
  ];

  const content = [
    { id: 'ember', name: 'Ember Toolkit', version: '1.2.0', status: 'installed', update: '1.3.0', snapshot: '1.2.0' },
    { id: 'atlas', name: 'Atlas Rules Pack', version: '2.0.1', status: 'disabled' },
    { id: 'broken', name: 'Broken Demo Package', version: '0.0.1', status: 'blocking', reason: 'Mock validation: required manifest field missing.' }
  ];

  const scenarios = [
    { id: 'PROTO-SCN-01', label: '01 · First launch', surface: 'first-run', view: 'offline', mode: 'freeform' },
    { id: 'PROTO-SCN-02', label: '02 · Home with saved Characters', surface: 'home', view: 'offline', mode: 'freeform' },
    { id: 'PROTO-SCN-03', label: '03 · Character Library + Sheet styles', surface: 'characters', view: 'offline', mode: 'freeform' },
    { id: 'PROTO-SCN-04', label: '04 · Standalone Character roll', surface: 'sheet-official', view: 'offline', mode: 'freeform', result: true, dice: true },
    { id: 'PROTO-SCN-05', label: '05 · Host opens live session', surface: 'host-setup', view: 'dm', mode: 'freeform', transitionHint: true },
    { id: 'PROTO-SCN-06', label: '06 · Join blocked: no Character', surface: 'join', view: 'player', mode: 'freeform', noCharacter: true },
    { id: 'PROTO-SCN-07', label: '07 · Mid-session Join', surface: 'join', view: 'player', mode: 'freeform', lateJoin: true },
    { id: 'PROTO-SCN-08', label: '08 · DM Freeform baseline', surface: 'play', view: 'dm', mode: 'freeform' },
    { id: 'PROTO-SCN-09', label: '09 · Player Freeform baseline', surface: 'play', view: 'player', mode: 'freeform' },
    { id: 'PROTO-SCN-10', label: '10 · DM Activity + DM Only', surface: 'play', view: 'dm', mode: 'freeform', utility: 'activity', visibility: 'dm-only' },
    { id: 'PROTO-SCN-11', label: '11 · Player view of same private history', surface: 'play', view: 'player', mode: 'freeform', utility: 'activity', visibility: 'public' },
    { id: 'PROTO-SCN-12', label: '12 · Valid / invalid targets', surface: 'play', view: 'player', mode: 'initiative', action: 'arc-bolt', targeting: 'single' },
    { id: 'PROTO-SCN-13', label: '13 · Single-target execute', surface: 'play', view: 'player', mode: 'initiative', action: 'arc-bolt', targeting: 'single', selectedTargets: ['raider'] },
    { id: 'PROTO-SCN-14', label: '14 · Multi-target execute', surface: 'play', view: 'player', mode: 'initiative', action: 'mock-extra-3', targeting: 'multi', selectedTargets: ['raider', 'captain'] },
    { id: 'PROTO-SCN-15', label: '15 · Main Hand unavailable', surface: 'play', view: 'player', mode: 'initiative', mainHandUnavailable: true },
    { id: 'PROTO-SCN-16', label: '16 · Resolving + selective lock', surface: 'play', view: 'player', mode: 'initiative', resolution: 'resolving', action: 'arc-bolt' },
    { id: 'PROTO-SCN-17', label: '17 · Reaction / Interrupt', surface: 'play', view: 'player', mode: 'initiative', resolution: 'interrupt' },
    { id: 'PROTO-SCN-18', label: '18 · Concentration response', surface: 'play', view: 'player', mode: 'initiative', resolution: 'concentration' },
    { id: 'PROTO-SCN-19', label: '19 · Dice + result', surface: 'play', view: 'player', mode: 'initiative', resolution: 'result', dice: true, result: true },
    { id: 'PROTO-SCN-20', label: '20 · Player own turn', surface: 'play', view: 'player', mode: 'initiative', ownTurn: true },
    { id: 'PROTO-SCN-21', label: '21 · Player off turn', surface: 'play', view: 'player', mode: 'initiative', ownTurn: false },
    { id: 'PROTO-SCN-22', label: '22 · DM Initiative / Actor control', surface: 'play', view: 'dm', mode: 'initiative', utility: 'encounter' },
    { id: 'PROTO-SCN-23', label: '23 · Handout Overlay', surface: 'play', view: 'player', mode: 'freeform', handout: 'overlay' },
    { id: 'PROTO-SCN-24', label: '24 · Handout Upper Scene', surface: 'play', view: 'player', mode: 'freeform', handout: 'upper' },
    { id: 'PROTO-SCN-25', label: '25 · Handout Full Scene', surface: 'play', view: 'player', mode: 'freeform', handout: 'full' },
    { id: 'PROTO-SCN-26', label: '26 · Encounter + spatial relation', surface: 'play', view: 'dm', mode: 'freeform', utility: 'spatial' },
    { id: 'PROTO-SCN-27', label: '27 · Correction / reversal history', surface: 'play', view: 'dm', mode: 'freeform', utility: 'activity', showCorrections: true },
    { id: 'PROTO-SCN-28', label: '28 · Package import validation', surface: 'content-import', view: 'offline', mode: 'freeform' },
    { id: 'PROTO-SCN-29', label: '29 · Full add-on lifecycle', surface: 'content', view: 'offline', mode: 'freeform' },
    { id: 'PROTO-SCN-30', label: '30 · Live content snapshot', surface: 'play', view: 'dm', mode: 'freeform', utility: 'session-share', contentSnapshotNotice: true },
    { id: 'PROTO-SCN-31', label: '31 · Reconnecting + Full Sheet', surface: 'play', view: 'player', mode: 'freeform', utility: 'full-sheet', connection: 'reconnecting' },
    { id: 'PROTO-SCN-32', label: '32 · Narrow desktop stress', surface: 'play', view: 'player', mode: 'initiative', viewport: 'narrow', utility: 'activity', manyActors: true },
    { id: 'PROTO-SCN-33', label: '33 · Panel resize stress', surface: 'play', view: 'dm', mode: 'freeform', utility: 'activity', resizeDemo: true },
    { id: 'PROTO-SCN-34', label: '34 · Component Gallery', surface: 'components', view: 'offline', mode: 'freeform' }
  ];

  return { characters, actors, capabilities, activity, content, scenarios };
})();
