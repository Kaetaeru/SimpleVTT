(() => {
  'use strict';

  const scenarioSelect = document.getElementById('scenarioSelect');
  const surfaceSelect = document.getElementById('surfaceSelect');
  const viewSelect = document.getElementById('viewSelect');
  const root = document.getElementById('productRoot');

  if (!scenarioSelect || !surfaceSelect || !viewSelect || !root) return;

  const surfaces = [
    ['play', 'Play Workspace', 'PROTO-SCN-08'],
    ['home', 'Home', 'PROTO-SCN-02'],
    ['first-run', 'First Run', 'PROTO-SCN-01'],
    ['characters', 'Character Library', 'PROTO-SCN-03'],
    ['sheet-official', 'Official-style Sheet', 'PROTO-SCN-04'],
    ['sheet-svtt', 'SimpleVTT Sheet', 'PROTO-SCN-03'],
    ['builder', 'Character Builder', 'PROTO-SCN-06'],
    ['level-up', 'Level Up', 'PROTO-SCN-03'],
    ['host-setup', 'Host Setup', 'PROTO-SCN-05'],
    ['join', 'Join + Character Select', 'PROTO-SCN-07'],
    ['content', 'Content / Add-ons', 'PROTO-SCN-29'],
    ['content-import', 'Package Import Review', 'PROTO-SCN-28'],
    ['rules', 'Rules Browser', 'PROTO-SCN-02'],
    ['settings', 'Settings', 'PROTO-SCN-02'],
    ['components', 'Component Gallery', 'PROTO-SCN-34']
  ];

  surfaceSelect.innerHTML = surfaces.map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
  surfaceSelect.insertAdjacentHTML('afterend', '<div class="surface-direct-note">화면을 바로 볼 때는 대표 시나리오를 불러온 뒤 해당 화면으로 이동합니다.</div>');

  let standaloneRollActive = scenarioSelect.value === 'PROTO-SCN-04';
  let directSurface = null;

  function dispatchChange(el) {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickSelector(selector) {
    const el = root.querySelector(selector);
    if (el) el.click();
    return !!el;
  }

  function syncReviewClasses() {
    document.body.classList.toggle('proto-view-offline', viewSelect.value === 'offline');
    document.body.classList.toggle('proto-entry-setup', ['PROTO-SCN-05', 'PROTO-SCN-06', 'PROTO-SCN-07'].includes(scenarioSelect.value));
  }

  function injectStandaloneRoll() {
    if (!standaloneRollActive) return;
    const sheet = root.querySelector('.sheet');
    if (!sheet || sheet.querySelector('.standalone-roll-layer')) return;
    sheet.style.position = 'relative';
    sheet.insertAdjacentHTML('beforeend', `
      <div class="standalone-roll-layer" data-proto-id="PROTO-SURF-STANDALONE-ROLL-RESULT">
        <section class="standalone-roll-card">
          <div class="standalone-roll-die">17</div>
          <strong>Standalone Mock Roll · 21 total</strong>
          <p>Offline/Standalone 결과 예시입니다. 실제 RNG·수정치·성공 판정은 계산하지 않고 fixture 결과만 표시합니다.</p>
          <button class="svtt-btn svtt-btn--secondary" data-review-close-roll>시트로 돌아가기</button>
        </section>
      </div>`);
  }

  function inferSurfaceFromDom() {
    if (root.querySelector('[data-proto-id="PROTO-SURF-FIRST-RUN"]')) return 'first-run';
    if (root.querySelector('[data-proto-id="PROTO-SURF-HOME"]')) return 'home';
    if (root.querySelector('[data-proto-id="PROTO-SURF-CHAR-LIBRARY"]')) return 'characters';
    if (root.querySelector('[data-proto-id="PROTO-SURF-CHAR-SHEET-OFFICIAL"]')) return 'sheet-official';
    if (root.querySelector('[data-proto-id="PROTO-SURF-CHAR-SHEET-SVTT"]')) return 'sheet-svtt';
    if (root.querySelector('[data-proto-id="PROTO-SURF-CHAR-BUILDER"]')) return 'builder';
    if (root.querySelector('[data-proto-id="PROTO-SURF-LEVEL-UP"]')) return 'level-up';
    if (root.querySelector('[data-proto-id="PROTO-SURF-HOST-SETUP"]')) return 'host-setup';
    if (root.querySelector('[data-proto-id="PROTO-SURF-JOIN-SETUP"]')) return 'join';
    if (root.querySelector('[data-proto-id="PROTO-SURF-CONTENT-IMPORT"]')) return 'content-import';
    if (root.querySelector('[data-proto-id="PROTO-SURF-CONTENT"]')) return 'content';
    if (root.querySelector('[data-proto-id="PROTO-SURF-RULES"]')) return 'rules';
    if (root.querySelector('[data-proto-id="PROTO-SURF-SETTINGS"]')) return 'settings';
    if (root.querySelector('[data-proto-id="PROTO-SURF-COMPONENT-GALLERY"]')) return 'components';
    if (root.querySelector('.play-shell')) return 'play';
    return directSurface || 'play';
  }

  function syncSurfaceSelect() {
    const detected = inferSurfaceFromDom();
    if ([...surfaceSelect.options].some(o => o.value === detected)) surfaceSelect.value = detected;
  }

  function afterRender() {
    syncReviewClasses();
    syncSurfaceSelect();
    injectStandaloneRoll();
  }

  function runSteps(surface) {
    const steps = {
      'sheet-svtt': [
        '[data-open-character="rowan"]',
        '[data-action="switch-sheet"][data-value="svtt"]'
      ],
      'builder': ['[data-nav="builder"]'],
      'level-up': [
        '[data-open-character="rowan"]',
        '[data-nav="level-up"]'
      ],
      'rules': ['[data-nav="rules"]'],
      'settings': ['[data-nav="settings"]']
    }[surface] || [];

    let delay = 0;
    steps.forEach(selector => {
      delay += 35;
      setTimeout(() => clickSelector(selector), delay);
    });
  }

  surfaceSelect.addEventListener('change', () => {
    const surface = surfaceSelect.value;
    const spec = surfaces.find(([id]) => id === surface);
    if (!spec) return;
    directSurface = surface;
    standaloneRollActive = surface === 'sheet-official';
    scenarioSelect.value = spec[2];
    dispatchChange(scenarioSelect);
    runSteps(surface);
  });

  scenarioSelect.addEventListener('change', () => {
    directSurface = null;
    standaloneRollActive = scenarioSelect.value === 'PROTO-SCN-04';
    setTimeout(afterRender, 0);
  });

  viewSelect.addEventListener('change', () => setTimeout(syncReviewClasses, 0));

  document.addEventListener('click', event => {
    const roll = event.target.closest('[data-action="sheet-roll"]');
    if (roll) {
      standaloneRollActive = true;
      setTimeout(injectStandaloneRoll, 0);
    }
    if (event.target.closest('[data-review-close-roll]')) {
      standaloneRollActive = false;
      root.querySelector('.standalone-roll-layer')?.remove();
    }
  });

  const observer = new MutationObserver(() => {
    queueMicrotask(afterRender);
  });
  observer.observe(root, { childList: true, subtree: true });

  setTimeout(afterRender, 0);
})();
