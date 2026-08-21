window.SVTT_FINAL_SPEC_FIXTURES = (() => {
  'use strict';

  const characters = [
    {
      id: 'rowan', name: 'Rowan Ash', initials: 'RA', classLine: 'Fighter 5', level: 5,
      hp: 38, hpMax: 44, tempHp: 4, ac: 17, speed: 30, initiative: '+3',
      conditions: [], sheetStyle: 'official',
      abilities: [
        ['STR', '16', '+3'], ['DEX', '14', '+2'], ['CON', '15', '+2'],
        ['INT', '10', '+0'], ['WIS', '12', '+1'], ['CHA', '11', '+0']
      ],
      skills: [
        { id: 'athletics', label: 'Athletics', mod: '+6', rollId: 'sheet-athletics' },
        { id: 'perception', label: 'Perception', mod: '+4', rollId: 'sheet-perception' },
        { id: 'stealth', label: 'Stealth', mod: '+2', rollId: 'sheet-stealth' },
        { id: 'survival', label: 'Survival', mod: '+4', rollId: 'sheet-survival' }
      ],
      attacks: [
        { id: 'longsword', label: 'Longsword', meta: '+7 · 1d8+4', rollId: 'sheet-longsword' },
        { id: 'crossbow', label: 'Light Crossbow', meta: '+5 · 1d8+2', rollId: 'sheet-crossbow' }
      ],
      saves: [
        { id: 'str-save', label: 'STR Save', mod: '+6', rollId: 'sheet-str-save' },
        { id: 'con-save', label: 'CON Save', mod: '+5', rollId: 'sheet-con-save' }
      ],
      resources: [
        { label: 'Second Wind', current: 1, max: 1 },
        { label: 'Action Surge', current: 1, max: 1 },
        { label: 'Superiority', current: 3, max: 4 }
      ]
    },
    {
      id: 'mina', name: 'Mina Vale', initials: 'MV', classLine: 'Wizard 5', level: 5,
      hp: 21, hpMax: 28, tempHp: 0, ac: 13, speed: 30, initiative: '+2',
      conditions: ['Concentrating'], sheetStyle: 'svtt', resources: [
        { label: 'Spell 1', current: 4, max: 4 }, { label: 'Spell 2', current: 3, max: 3 },
        { label: 'Spell 3', current: 2, max: 2 }, { label: 'Arcane Recovery', current: 1, max: 1 }
      ]
    }
  ];

  const sheetRolls = {
    'sheet-athletics': { id: 'sheet-athletics', label: 'Athletics', notation: '1d20 + 6', faces: [15], total: 21, detail: 'Fixture total · no rules calculation in prototype' },
    'sheet-perception': { id: 'sheet-perception', label: 'Perception', notation: '1d20 + 4', faces: [12], total: 16, detail: 'Fixture total · no rules calculation in prototype' },
    'sheet-stealth': { id: 'sheet-stealth', label: 'Stealth', notation: '1d20 + 2', faces: [18], total: 20, detail: 'Fixture total · no rules calculation in prototype' },
    'sheet-survival': { id: 'sheet-survival', label: 'Survival', notation: '1d20 + 4', faces: [8], total: 12, detail: 'Fixture total · no rules calculation in prototype' },
    'sheet-longsword': { id: 'sheet-longsword', label: 'Longsword Attack', notation: '1d20 + 7', faces: [17], total: 24, detail: 'Fixture attack total · outcome intentionally not inferred' },
    'sheet-crossbow': { id: 'sheet-crossbow', label: 'Light Crossbow Attack', notation: '1d20 + 5', faces: [11], total: 16, detail: 'Fixture attack total · outcome intentionally not inferred' },
    'sheet-str-save': { id: 'sheet-str-save', label: 'STR Save', notation: '1d20 + 6', faces: [14], total: 20, detail: 'Fixture save total' },
    'sheet-con-save': { id: 'sheet-con-save', label: 'CON Save', notation: '1d20 + 5', faces: [9], total: 14, detail: 'Fixture save total' },
    'sheet-damage': { id: 'sheet-damage', label: 'Longsword Damage', notation: '1d8 + 4', faces: [6], total: 10, detail: 'Fixture damage total' }
  };

  const actors = [
    { id: 'rowan', name: 'Rowan Ash', initials: 'RA', side: 'allied', hp: 38, hpMax: 44, tempHp: 4, controlledBy: 'player', currentTurn: true, initiative: 18, conditions: [], sceneX: 46, sceneY: 66 },
    { id: 'mina', name: 'Mina Vale', initials: 'MV', side: 'allied', hp: 21, hpMax: 28, tempHp: 0, controlledBy: 'player2', currentTurn: false, initiative: 14, conditions: ['Concentrating'], sceneX: 36, sceneY: 61 },
    { id: 'guard', name: 'Lantern Guard', initials: 'LG', side: 'allied', hp: 24, hpMax: 24, tempHp: 0, controlledBy: 'dm', currentTurn: false, initiative: 10, conditions: [], sceneX: 55, sceneY: 58 },
    { id: 'nera', name: 'Archivist Nera', initials: 'AN', side: 'neutral', hp: null, hpMax: null, tempHp: 0, controlledBy: 'dm', currentTurn: false, initiative: 8, conditions: [], sceneX: 63, sceneY: 42 },
    { id: 'raider', name: 'Ash Raider', initials: 'AR', side: 'hostile', hp: 18, hpMax: 27, tempHp: 0, controlledBy: 'dm', currentTurn: false, initiative: 16, conditions: ['Marked'], sceneX: 50, sceneY: 32 },
    { id: 'hound', name: 'Iron Hound', initials: 'IH', side: 'hostile', hp: 30, hpMax: 30, tempHp: 0, controlledBy: 'dm', currentTurn: false, initiative: 12, conditions: [], sceneX: 68, sceneY: 28 },
    { id: 'captain', name: 'Long-Name Hostile Captain of the Eastern Gate', initials: 'CG', side: 'hostile', hp: 42, hpMax: 52, tempHp: 0, controlledBy: 'dm', currentTurn: false, initiative: 9, conditions: ['Guarded'], sceneX: 32, sceneY: 24 },
    { id: 'scout', name: 'Ash Raider Scout', initials: 'AS', side: 'hostile', hp: 11, hpMax: 20, tempHp: 0, controlledBy: 'dm', currentTurn: false, initiative: 7, conditions: [], sceneX: 76, sceneY: 37 }
  ];

  const capabilities = [
    { id: 'main-hand', label: 'Main Hand Strike', icon: '⚔', page: 'Mixed', cost: 'Action', available: true, targetMode: 'single', description: 'Canonical Main Hand action supplied by fixture. Prototype does not derive equipment/rules relation.' },
    { id: 'arc-bolt', label: 'Arc Bolt', icon: '✦', page: 'Spell', cost: 'Action · Spell 1', available: true, targetMode: 'single', description: 'Fixture spell action for target-state and roll presentation.' },
    { id: 'sweep', label: 'Sweeping Arc', icon: '↗', page: 'Action', cost: 'Action', available: true, targetMode: 'multi', description: 'Fixture multi-target action. Explicit Execute is required.' },
    { id: 'quick-step', label: 'Quick Step', icon: '»', page: 'Action', cost: 'Bonus', available: true, targetMode: 'self', description: 'Fixture self action.' },
    { id: 'guard', label: 'Guard', icon: '◆', page: 'Action', cost: 'Reaction', available: false, unavailableReason: 'Fixture authority: Reaction already spent.', targetMode: 'self', description: 'Unavailable fixture action with explicit supplied reason.' },
    { id: 'ward', label: 'Ward', icon: '◈', page: 'Spell', cost: 'Spell 2', available: true, targetMode: 'single', description: 'Fixture spell.' },
    { id: 'draught', label: 'Healing Draught', icon: '✚', page: 'Item', cost: 'Item ×2', available: true, targetMode: 'single', description: 'Fixture item.' },
    { id: 'dash', label: 'Dash', icon: '➜', page: 'Mixed', cost: 'Action', available: true, targetMode: 'self', description: 'Fixture action.' },
    { id: 'interact', label: 'Interact', icon: '◎', page: 'Mixed', cost: 'Context', available: true, targetMode: 'none', description: 'Fixture no-target action.' },
    { id: 'smoke-lens', label: 'Smoke Lens', icon: '◉', page: 'Item', cost: 'Charge 2/3', available: true, targetMode: 'none', description: 'Fixture item resource example.' },
    { id: 'signal-flare', label: 'Signal Flare', icon: '✹', page: 'Item', cost: 'Charge 1/2', available: true, targetMode: 'single', description: 'Fixture item target example.' },
    { id: 'long-capability', label: 'Long Capability Name For Density Stress', icon: '◇', page: 'Custom', cost: 'Mock Resource', available: true, targetMode: 'multi', description: 'Stress-test label and custom page behavior.' }
  ];

  const targetEligibility = {
    'main-hand': {
      rowan: { valid: false, reason: 'Fixture: self is not a valid hostile target.' },
      mina: { valid: false, reason: 'Fixture: allied Actor is not eligible.' },
      guard: { valid: false, reason: 'Fixture: allied Actor is not eligible.' },
      nera: { valid: false, reason: 'Fixture: neutral Actor is not eligible.' },
      raider: { valid: true }, hound: { valid: true }, captain: { valid: true }, scout: { valid: true }
    },
    'arc-bolt': {
      rowan: { valid: false, reason: 'Fixture: self not eligible.' },
      mina: { valid: true }, guard: { valid: true }, nera: { valid: false, reason: 'Fixture: neutral unavailable.' },
      raider: { valid: true }, hound: { valid: false, reason: 'Fixture authority: target unavailable.' }, captain: { valid: true }, scout: { valid: true }
    },
    'sweep': {
      rowan: { valid: false, reason: 'Fixture: self not eligible.' },
      mina: { valid: false, reason: 'Fixture: allied Actor not eligible.' }, guard: { valid: false, reason: 'Fixture: allied Actor not eligible.' },
      nera: { valid: false, reason: 'Fixture: neutral Actor not eligible.' }, raider: { valid: true }, hound: { valid: true }, captain: { valid: true }, scout: { valid: true }
    }
  };

  const playRolls = {
    attack: { id: 'play-attack', label: 'Arc Bolt', notation: '1d20 + 6', faces: [16], total: 22, resultLabel: '22 total', detail: 'Fixture-authoritative roll result' },
    damage: { id: 'play-damage', label: 'Arc Bolt Damage', notation: '2d6', faces: [5, 3], total: 8, resultLabel: '8 damage fixture', detail: 'Damage semantics are fixture text only' },
    save: { id: 'play-save', label: 'Concentration Save', notation: '1d20 + 5', faces: [13], total: 18, resultLabel: '18 total', detail: 'Fixture-authoritative save result' }
  };

  const initiative = [
    ['rowan', 18], ['raider', 16], ['mina', 14], ['hound', 12], ['guard', 10], ['captain', 9], ['nera', 8], ['scout', 7]
  ];

  const activity = [
    { id: 'ev1', visibility: 'public', time: '20:14', title: 'Rowan · Main Hand Strike', detail: 'Fixture public result · 21 total' },
    { id: 'ev2', visibility: 'dm-only', time: '20:15', title: 'DM · Hidden adjudication', detail: 'Private fixture event. Player receives no placeholder.' },
    { id: 'ev3', visibility: 'public', time: '20:16', title: 'Initiative started', detail: 'Round 1' },
    { id: 'ev4', visibility: 'public', time: '20:17', title: 'Correction applied', detail: 'Corrects ev1 · prior event remains visible', correctionOf: 'ev1' },
    { id: 'ev5', visibility: 'public', time: '20:18', title: 'Result disclosed', detail: 'Authorized public projection of prior hidden result', disclosureOf: 'ev2' }
  ];

  const packages = [
    { id: 'ember', name: 'Ember Toolkit', version: '1.2.0', update: '1.3.0', status: 'installed', snapshot: '1.2.0' },
    { id: 'atlas', name: 'Atlas Rules Pack', version: '2.0.1', status: 'disabled' },
    { id: 'broken', name: 'Broken Demo Package', version: '0.0.1', status: 'blocking', reason: 'Fixture validation: required manifest field missing.' }
  ];

  const scenarios = [
    { id: 'FINAL-SCN-SHEET', label: 'Standalone · Sheet baseline', surface: 'sheet', view: 'offline', sheetStyle: 'official' },
    { id: 'FINAL-SCN-SHEET-ROLL', label: 'Standalone · In-sheet dice roll', surface: 'sheet', view: 'offline', sheetStyle: 'official', sheetRoll: 'sheet-athletics', rollPhase: 'settled' },
    { id: 'FINAL-SCN-DM-FREEFORM', label: 'Session · DM Freeform', surface: 'play', view: 'dm', mode: 'freeform' },
    { id: 'FINAL-SCN-PLAYER-FREEFORM', label: 'Session · Player Freeform', surface: 'play', view: 'player', mode: 'freeform' },
    { id: 'FINAL-SCN-PLAYER-TARGET', label: 'Session · Player targeting', surface: 'play', view: 'player', mode: 'initiative', action: 'arc-bolt' },
    { id: 'FINAL-SCN-MULTI', label: 'Session · Multi-target', surface: 'play', view: 'player', mode: 'initiative', action: 'sweep', selectedTargets: ['raider', 'captain'] },
    { id: 'FINAL-SCN-RESOLVE', label: 'Session · Resolving + dice', surface: 'play', view: 'player', mode: 'initiative', action: 'arc-bolt', resolution: 'dice', playRoll: 'attack' },
    { id: 'FINAL-SCN-RESULT', label: 'Session · Scene-integrated result', surface: 'play', view: 'player', mode: 'initiative', action: 'arc-bolt', resolution: 'result', playRoll: 'attack' },
    { id: 'FINAL-SCN-DM-ACTIVITY', label: 'Session · DM Activity', surface: 'play', view: 'dm', mode: 'freeform', utility: 'activity', visibility: 'dm-only' },
    { id: 'FINAL-SCN-PLAYER-ACTIVITY', label: 'Session · Player Activity privacy', surface: 'play', view: 'player', mode: 'freeform', utility: 'activity' },
    { id: 'FINAL-SCN-DM-SPATIAL', label: 'Session · Advanced DM spatial', surface: 'play', view: 'dm', mode: 'freeform', utility: 'spatial' },
    { id: 'FINAL-SCN-HANDOUT-OVERLAY', label: 'Session · Handout Overlay', surface: 'play', view: 'player', mode: 'freeform', handout: 'overlay' },
    { id: 'FINAL-SCN-HANDOUT-UPPER', label: 'Session · Handout Upper Scene', surface: 'play', view: 'player', mode: 'freeform', handout: 'upper' },
    { id: 'FINAL-SCN-HANDOUT-FULL', label: 'Session · Handout Full Scene', surface: 'play', view: 'player', mode: 'freeform', handout: 'full' },
    { id: 'FINAL-SCN-NARROW', label: 'Session · Narrow desktop stress', surface: 'play', view: 'player', mode: 'initiative', viewport: 'narrow', utility: 'activity' },
    { id: 'FINAL-SCN-COMPONENTS', label: 'Reference · Component Gallery', surface: 'components', view: 'offline' }
  ];

  return {
    characters, sheetRolls, actors, capabilities, targetEligibility, playRolls, initiative, activity, packages, scenarios
  };
})();
