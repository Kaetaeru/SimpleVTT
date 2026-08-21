window.SVTT_INTEGRATED_FIXTURES = (() => {
  'use strict';

  const characters = [
    {
      id: 'rowan',
      name: 'Rowan Ash',
      initials: 'RA',
      classLine: 'Fighter 5',
      species: 'Human',
      background: 'Soldier',
      hp: 38,
      hpMax: 44,
      tempHp: 4,
      ac: 17,
      speed: '30 ft',
      initiative: '+3',
      proficiency: '+3',
      passivePerception: 14,
      abilities: [
        ['STR', '16', '+3'], ['DEX', '14', '+2'], ['CON', '15', '+2'],
        ['INT', '10', '+0'], ['WIS', '12', '+1'], ['CHA', '11', '+0']
      ],
      rolls: [
        { id: 'athletics', label: 'Athletics', value: '+6', type: 'skill' },
        { id: 'perception', label: 'Perception', value: '+4', type: 'skill' },
        { id: 'str-save', label: 'STR Save', value: '+6', type: 'save' },
        { id: 'con-save', label: 'CON Save', value: '+5', type: 'save' },
        { id: 'initiative', label: 'Initiative', value: '+3', type: 'initiative' },
        { id: 'longsword', label: 'Longsword Attack', value: '+7', type: 'attack' },
        { id: 'longsword-damage', label: 'Longsword Damage', value: '1d8 + 4', type: 'damage' },
        { id: 'common-d20', label: 'd20', value: 'd20', type: 'common' }
      ],
      resources: [
        { label: 'Second Wind', current: 1, max: 1 },
        { label: 'Action Surge', current: 1, max: 1 },
        { label: 'Superiority', current: 3, max: 4 }
      ],
      conditions: []
    },
    {
      id: 'mina',
      name: 'Mina Vale',
      initials: 'MV',
      classLine: 'Wizard 5',
      species: 'Elf',
      background: 'Sage',
      hp: 21,
      hpMax: 28,
      tempHp: 0,
      ac: 13,
      speed: '30 ft',
      initiative: '+2',
      proficiency: '+3',
      passivePerception: 12,
      resources: [
        { label: 'Spell 1', current: 4, max: 4 },
        { label: 'Spell 2', current: 3, max: 3 },
        { label: 'Spell 3', current: 2, max: 2 },
        { label: 'Arcane Recovery', current: 1, max: 1 }
      ],
      conditions: ['Concentrating']
    },
    {
      id: 'long-name',
      name: 'A Very Long Character Name For Truncation Review',
      initials: 'LN',
      classLine: 'Paladin 5',
      hp: 32,
      hpMax: 40,
      tempHp: 0,
      ac: 18,
      speed: '30 ft',
      initiative: '+1',
      resources: []
    }
  ];

  const standaloneRolls = {
    athletics: { id: 'athletics', label: 'Athletics', notation: '1d20 + 6', die: 'd20', finalFaces: [15], total: 21, result: '21', detail: 'Local prototype result · Sheet remains mounted' },
    perception: { id: 'perception', label: 'Perception', notation: '1d20 + 4', die: 'd20', finalFaces: [12], total: 16, result: '16', detail: 'Local prototype result · Sheet remains mounted' },
    'str-save': { id: 'str-save', label: 'STR Save', notation: '1d20 + 6', die: 'd20', finalFaces: [14], total: 20, result: '20', detail: 'Local prototype result' },
    'con-save': { id: 'con-save', label: 'CON Save', notation: '1d20 + 5', die: 'd20', finalFaces: [9], total: 14, result: '14', detail: 'Local prototype result' },
    initiative: { id: 'initiative', label: 'Initiative', notation: '1d20 + 3', die: 'd20', finalFaces: [18], total: 21, result: '21', detail: 'Local prototype Initiative result' },
    longsword: { id: 'longsword', label: 'Longsword Attack', notation: '1d20 + 7', die: 'd20', finalFaces: [17], total: 24, result: '24', detail: 'Prototype attack total · outcome not inferred' },
    'longsword-damage': { id: 'longsword-damage', label: 'Longsword Damage', notation: '1d8 + 4', die: 'd8', finalFaces: [6], total: 10, result: '10', detail: 'Prototype damage total' },
    'common-d20': { id: 'common-d20', label: 'd20', notation: '1d20', die: 'd20', finalFaces: [13], total: 13, result: '13', detail: 'Common local die' }
  };

  const actors = [
    { id: 'rowan', name: 'Rowan Ash', initials: 'RA', relation: 'allied', hp: 38, hpMax: 44, tempHp: 4, controller: 'player', initiative: 18, conditions: [] },
    { id: 'mina', name: 'Mina Vale', initials: 'MV', relation: 'allied', hp: 21, hpMax: 28, tempHp: 0, controller: 'player-2', initiative: 14, conditions: ['Concentrating'] },
    { id: 'guard', name: 'Lantern Guard', initials: 'LG', relation: 'allied', hp: 24, hpMax: 24, tempHp: 0, controller: 'dm', initiative: 10, conditions: [] },
    { id: 'nera', name: 'Archivist Nera', initials: 'AN', relation: 'neutral', hp: null, hpMax: null, tempHp: 0, controller: 'dm', initiative: 8, conditions: [] },
    { id: 'raider', name: 'Ash Raider', initials: 'AR', relation: 'hostile', hp: 18, hpMax: 27, tempHp: 0, controller: 'dm', initiative: 16, conditions: ['Marked'] },
    { id: 'hound', name: 'Iron Hound', initials: 'IH', relation: 'hostile', hp: 30, hpMax: 30, tempHp: 0, controller: 'dm', initiative: 12, conditions: [] },
    { id: 'captain', name: 'Long-Name Hostile Captain of the Eastern Gate', initials: 'CG', relation: 'hostile', hp: 42, hpMax: 52, tempHp: 0, controller: 'dm', initiative: 9, conditions: ['Guarded'] },
    { id: 'scout', name: 'Ash Raider Scout', initials: 'AS', relation: 'hostile', hp: 11, hpMax: 20, tempHp: 0, controller: 'dm', initiative: 7, conditions: [] }
  ];

  const capabilities = [
    { id: 'main-hand', label: 'Main Hand Strike', glyph: '⚔', page: 'Mixed', category: 'Action', cost: ['Action'], targetMode: 'single', available: true, summary: 'Fixture-provided canonical Main Hand executable relation.' },
    { id: 'arc-bolt', label: 'Arc Bolt', glyph: '✦', page: 'Spell', category: 'Spell', cost: ['Action', 'Spell 1'], targetMode: 'single', available: true, summary: 'Prototype spell capability; target legality is fixture data.' },
    { id: 'sweeping-arc', label: 'Sweeping Arc', glyph: '↗', page: 'Action', category: 'Action', cost: ['Action'], targetMode: 'multi', available: true, summary: 'Manual multi-target Actor-card selection. No AoE map template.' },
    { id: 'quick-step', label: 'Quick Step', glyph: '»', page: 'Action', category: 'Bonus', cost: ['Bonus'], targetMode: 'self', available: true, summary: 'Self-target prototype capability.' },
    { id: 'guard-reaction', label: 'Guard', glyph: '◆', page: 'Action', category: 'Reaction', cost: ['Reaction'], targetMode: 'self', available: false, unavailableReason: 'Fixture authority: Reaction currently unavailable.', summary: 'Unavailable reason is supplied by fixture.' },
    { id: 'ward', label: 'Ward', glyph: '◈', page: 'Spell', category: 'Spell', cost: ['Spell 2'], targetMode: 'single', available: true, summary: 'Prototype protective capability.' },
    { id: 'healing-draught', label: 'Healing Draught', glyph: '✚', page: 'Item', category: 'Item', cost: ['Item ×2'], targetMode: 'single', available: true, summary: 'Prototype item capability.' },
    { id: 'dash', label: 'Dash', glyph: '➜', page: 'Mixed', category: 'Action', cost: ['Action'], targetMode: 'self', available: true, summary: 'Prototype action.' },
    { id: 'interact', label: 'Interact', glyph: '◎', page: 'Mixed', category: 'Action', cost: ['Context'], targetMode: 'none', available: true, summary: 'Prototype no-target capability.' },
    { id: 'smoke-lens', label: 'Smoke Lens', glyph: '◉', page: 'Item', category: 'Item', cost: ['Charge 2/3'], targetMode: 'none', available: true, summary: 'Prototype item resource example.' },
    { id: 'signal-flare', label: 'Signal Flare', glyph: '✹', page: 'Item', category: 'Item', cost: ['Charge 1/2'], targetMode: 'single', available: true, summary: 'Prototype targetable item.' },
    { id: 'long-capability', label: 'Long Capability Name For Density Stress', glyph: '◇', page: 'Custom', category: 'Custom', cost: ['Mock Resource'], targetMode: 'multi', available: true, summary: 'Long-label/custom-page stress fixture.' }
  ];

  const targetEligibility = {
    'main-hand': {
      rowan: { valid: false, reason: 'Fixture: self is not a hostile target.' },
      mina: { valid: false, reason: 'Fixture: allied Actor is not eligible.' },
      guard: { valid: false, reason: 'Fixture: allied Actor is not eligible.' },
      nera: { valid: false, reason: 'Fixture: neutral Actor is not eligible.' },
      raider: { valid: true }, hound: { valid: true }, captain: { valid: true }, scout: { valid: true }
    },
    'arc-bolt': {
      rowan: { valid: false, reason: 'Fixture: self is not eligible.' },
      mina: { valid: true },
      guard: { valid: true },
      nera: { valid: false, reason: 'Fixture: neutral Actor unavailable.' },
      raider: { valid: true },
      hound: { valid: false, reason: 'Fixture authority: target unavailable.' },
      captain: { valid: true },
      scout: { valid: true }
    },
    'sweeping-arc': {
      rowan: { valid: false, reason: 'Fixture: self is not eligible.' },
      mina: { valid: false, reason: 'Fixture: allied Actor is not eligible.' },
      guard: { valid: false, reason: 'Fixture: allied Actor is not eligible.' },
      nera: { valid: false, reason: 'Fixture: neutral Actor is not eligible.' },
      raider: { valid: true }, hound: { valid: true }, captain: { valid: true }, scout: { valid: true }
    }
  };

  const connectedRolls = {
    attack: { id: 'attack', label: 'Arc Bolt', notation: '1d20 + 6', dice: [{ type: 'd20', face: 16 }], total: '22', detail: 'Fixture-authoritative connected result' },
    damage: { id: 'damage', label: 'Arc Bolt Damage', notation: '2d6', dice: [{ type: 'd6', face: 5 }, { type: 'd6', face: 3 }], total: '8', detail: 'Fixture-authoritative damage presentation' },
    concentration: { id: 'concentration', label: 'Concentration Save', notation: '1d20 + 5', dice: [{ type: 'd20', face: 13 }], total: '18', detail: 'Fixture-authoritative response result' }
  };

  const initiativeOrder = [
    ['rowan', 18], ['raider', 16], ['mina', 14], ['hound', 12], ['guard', 10], ['captain', 9], ['nera', 8], ['scout', 7]
  ];

  const activityDM = [
    { id: 'ev-01', visibility: 'public', time: '20:14', title: 'Rowan · Main Hand Strike', detail: 'Fixture public result · 21 total' },
    { id: 'ev-02', visibility: 'dm-only', time: '20:15', title: 'Hidden adjudication', detail: 'DM-only fixture event.' },
    { id: 'ev-03', visibility: 'public', time: '20:16', title: 'Initiative started', detail: 'Round 1' },
    { id: 'ev-04', visibility: 'public', time: '20:17', title: 'Correction applied', detail: 'Corrects ev-01; original remains visible.', correctionOf: 'ev-01' },
    { id: 'ev-05', visibility: 'public', time: '20:18', title: 'Result disclosed', detail: 'Authorized public projection related to prior private event.', disclosureOf: 'ev-02' }
  ];

  const activityPlayer = activityDM.filter(item => item.visibility === 'public');

  const handout = {
    id: 'handout-01',
    title: 'Archivist Nera’s Letter',
    caption: 'A weathered letter recovered from the archive. Presentation only; not a tactical map.',
    sharedMode: 'overlay',
    playerLocalDismissed: false
  };

  const spatialFacts = {
    actorAId: 'rowan',
    actorBId: 'raider',
    distanceDisplay: '25 ft',
    visibilityState: 'Visible',
    coverState: 'Half cover',
    manualFactNote: 'Mock DM-entered relationship fact. No coordinates or geometry.'
  };

  const packages = [
    { id: 'ember', name: 'Ember Toolkit', version: '1.2.0', nextVersion: '1.3.0', status: 'installed', sessionSnapshotVersion: '1.2.0' },
    { id: 'atlas', name: 'Atlas Rules Pack', version: '2.0.1', status: 'disabled' },
    { id: 'broken', name: 'Broken Demo Package', version: '0.0.1', status: 'blocking', reason: 'Mock validation: required package field missing.' },
    { id: 'unsupported', name: 'Unsupported Archive', version: '—', status: 'unsupported', reason: 'Prototype fixture: unsupported package format.' }
  ];

  const scenarios = [
    { id: 'PROTO-SCN-01', label: '01 · First launch Tutorial', surface: 'tutorial', view: 'offline', firstRun: true },
    { id: 'PROTO-SCN-02', label: '02 · Returning Home', surface: 'home', view: 'offline' },
    { id: 'PROTO-SCN-03', label: '03 · Character Library', surface: 'characters', view: 'offline' },
    { id: 'PROTO-SCN-04', label: '04 · Standalone same-Sheet roll', surface: 'sheet', view: 'offline', sheetStyle: 'official', previewRoll: 'athletics' },
    { id: 'PROTO-SCN-05', label: '05 · Host opens live Session', surface: 'host', view: 'dm' },
    { id: 'PROTO-SCN-06', label: '06 · Join blocked — no Character', surface: 'join', view: 'player', noCharacter: true },
    { id: 'PROTO-SCN-07', label: '07 · Player joins live Session', surface: 'join', view: 'player', noCharacter: false },
    { id: 'PROTO-SCN-08', label: '08 · DM Freeform mapless', surface: 'play', view: 'dm', mode: 'freeform' },
    { id: 'PROTO-SCN-09', label: '09 · Player Freeform mapless', surface: 'play', view: 'player', mode: 'freeform' },
    { id: 'PROTO-SCN-10', label: '10 · DM Activity + DM Only', surface: 'play', view: 'dm', mode: 'freeform', utility: 'activity', visibility: 'dm-only' },
    { id: 'PROTO-SCN-11', label: '11 · Player privacy projection', surface: 'play', view: 'player', mode: 'freeform', utility: 'activity' },
    { id: 'PROTO-SCN-12', label: '12 · Target validity', surface: 'play', view: 'player', mode: 'initiative', action: 'arc-bolt' },
    { id: 'PROTO-SCN-13', label: '13 · Single-target immediate submit', surface: 'play', view: 'player', mode: 'initiative', action: 'arc-bolt', selectedTargets: ['raider'] },
    { id: 'PROTO-SCN-14', label: '14 · Manual multi-target Execute', surface: 'play', view: 'player', mode: 'initiative', action: 'sweeping-arc', selectedTargets: ['raider', 'captain'] },
    { id: 'PROTO-SCN-15', label: '15 · Main Hand unavailable', surface: 'play', view: 'player', mode: 'initiative', mainHandUnavailable: true },
    { id: 'PROTO-SCN-16', label: '16 · Resolving selective lock', surface: 'play', view: 'player', mode: 'initiative', resolution: 'resolving', action: 'arc-bolt' },
    { id: 'PROTO-SCN-17', label: '17 · Reaction / Interrupt', surface: 'play', view: 'player', mode: 'initiative', resolution: 'interrupt' },
    { id: 'PROTO-SCN-18', label: '18 · Concentration response', surface: 'play', view: 'player', mode: 'initiative', resolution: 'concentration' },
    { id: 'PROTO-SCN-19', label: '19 · Connected dice + result', surface: 'play', view: 'player', mode: 'initiative', resolution: 'dice', connectedRoll: 'attack' },
    { id: 'PROTO-SCN-20', label: '20 · Player own turn', surface: 'play', view: 'player', mode: 'initiative' },
    { id: 'PROTO-SCN-21', label: '21 · Player off turn', surface: 'play', view: 'player', mode: 'initiative', currentTurnActorId: 'raider' },
    { id: 'PROTO-SCN-22', label: '22 · DM Initiative control mode', surface: 'play', view: 'dm', mode: 'initiative', controlMode: true },
    { id: 'PROTO-SCN-23', label: '23 · Handout Overlay', surface: 'play', view: 'player', mode: 'freeform', handout: 'overlay' },
    { id: 'PROTO-SCN-24', label: '24 · Handout Upper', surface: 'play', view: 'player', mode: 'freeform', handout: 'upper' },
    { id: 'PROTO-SCN-25', label: '25 · Handout Full', surface: 'play', view: 'player', mode: 'freeform', handout: 'full' },
    { id: 'PROTO-SCN-26', label: '26 · Encounter + spatial facts', surface: 'play', view: 'dm', mode: 'freeform', utility: 'spatial' },
    { id: 'PROTO-SCN-27', label: '27 · Correction / reversal history', surface: 'play', view: 'dm', mode: 'freeform', utility: 'activity', showCorrection: true },
    { id: 'PROTO-SCN-28', label: '28 · Package import validation', surface: 'content-import', view: 'offline' },
    { id: 'PROTO-SCN-29', label: '29 · Add-on lifecycle', surface: 'content', view: 'offline' },
    { id: 'PROTO-SCN-30', label: '30 · Live content snapshot', surface: 'play', view: 'dm', mode: 'freeform', utility: 'session', snapshotNotice: true },
    { id: 'PROTO-SCN-31', label: '31 · Reconnecting + Full Sheet', surface: 'play', view: 'player', mode: 'freeform', fullSheet: true, connection: 'reconnecting' },
    { id: 'PROTO-SCN-32', label: '32 · Narrow Desktop stress', surface: 'play', view: 'player', mode: 'initiative', utility: 'activity', viewport: 'narrow' },
    { id: 'PROTO-SCN-33', label: '33 · Utility resize stress', surface: 'play', view: 'dm', mode: 'freeform', utility: 'activity', resizable: true },
    { id: 'PROTO-SCN-34', label: '34 · Component / state gallery', surface: 'components', view: 'offline' }
  ];

  return {
    characters,
    standaloneRolls,
    actors,
    capabilities,
    targetEligibility,
    connectedRolls,
    initiativeOrder,
    activityDM,
    activityPlayer,
    handout,
    spatialFacts,
    packages,
    scenarios
  };
})();
