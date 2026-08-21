(() => {
  'use strict';

  const F = window.SVTT_INTEGRATED_FIXTURES;
  if (!F) return;

  // Presentation-only answers for scenarios whose production semantics are
  // still blocked by Domain/Architecture gaps. UI must consume these values;
  // it must not derive them from game rules or visual layout.
  F.resolutionSafety = {
    scenarioId: 'PROTO-SCN-16',
    conflictingControlIds: ['arc-bolt', 'main-hand'],
    safeControlIds: ['dash', 'interact', 'quick-step'],
    note: 'Fixture only: conflicting vs safe interaction classification is supplied, not calculated.'
  };
})();
