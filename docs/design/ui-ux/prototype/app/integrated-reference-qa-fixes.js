(() => {
  'use strict';

  const root = document.getElementById('appRoot');
  const viewSelect = document.getElementById('viewSelect');
  const scenarioSelect = document.getElementById('scenarioSelect');
  const F = window.SVTT_INTEGRATED_FIXTURES;
  if (!root || !viewSelect || !scenarioSelect || !F) return;

  let lastSessionRole = 'player';
  let patchScheduled = false;

  function rememberSessionRole() {
    if (viewSelect.value === 'dm' || viewSelect.value === 'player') {
      lastSessionRole = viewSelect.value;
    }
  }

  function assignText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function setText(selector, text) {
    assignText(root.querySelector(selector), text);
  }

  function cleanProductCopy() {
    setText('.mapless-stage .stage-label strong', 'PLAY CONTEXT');
    setText('.mapless-stage .stage-label span', 'shared action · dice · result · handout');

    const focusTitle = root.querySelector('.stage-focus h2');
    if (focusTitle?.textContent.includes('Mapless shared play context')) {
      assignText(focusTitle, 'Shared play context');
    }
    if (focusTitle?.textContent.includes('not a battlemap')) {
      assignText(focusTitle, 'Actor and action context');
    }

    const focusBody = root.querySelector('.stage-focus p');
    if (focusBody?.textContent.includes('tactical tokens')) {
      assignText(focusBody, '현재 상호작용, 알림, 주사위, 결과와 Handout을 같은 플레이 맥락에서 보여줍니다.');
    }
    if (focusBody?.textContent.includes('Actor identity and targets remain in the boards')) {
      assignText(focusBody, 'Initiative 순서와 행동 자원이 활성화되고, Actor와 대상은 위·아래 Actor Board에서 계속 확인합니다.');
    }

    assignText(
      root.querySelector('.tutorial-top p'),
      'SimpleVTT는 캐릭터 시트와 판정 자동화를 중심으로, 필요할 때 같은 플레이 맥락을 연결 세션으로 공유하는 tabletop companion입니다.'
    );
    const tutorialModes = root.querySelectorAll('.tutorial-mode p');
    assignText(
      tutorialModes[1],
      'Host는 DM, Client는 Player입니다. Actor, 행동, 판정, 주사위, 기록과 Handout을 같은 세션에서 공유합니다.'
    );
    assignText(
      root.querySelector('.home-hero .hero-card p'),
      'Character Sheet를 단독으로 사용하거나, DM이 Session을 열고 Player가 자신의 Character로 참가할 수 있습니다. Connected Play에서는 Actor, 행동, 판정, 주사위와 Handout을 하나의 맥락에서 이어갑니다.'
    );

    root.querySelectorAll('.utility-row').forEach(row => {
      const strong = row.querySelector('strong');
      const span = row.querySelector('span');
      if (!strong || !span) return;
      if (strong.textContent === 'Core map') {
        assignText(strong, 'Scene presentation');
        assignText(span, 'Actor · action · result context');
      }
      if (span.textContent.includes('no map positions')) {
        assignText(span, span.textContent.replace(' · Actor facts only, no map positions.', ' · Actor encounter facts.'));
      }
    });

    // Advanced spatial facts remain contextual, not routine top-level Play chrome.
    const spatialLauncher = root.querySelector('.play-chrome [data-utility="spatial"]');
    if (spatialLauncher) spatialLauncher.hidden = true;
  }

  function replaceResourceRailForMockActor(resourceRail, actorId, hp, conditions) {
    if (!resourceRail || actorId === 'rowan') return;
    if (resourceRail.dataset.qaActorId === actorId) return;

    resourceRail.dataset.qaActorId = actorId;
    resourceRail.replaceChildren();

    const context = document.createElement('div');
    context.className = 'resource-pill';
    context.innerHTML = '<span>Actor context</span><strong>fixture projection</strong>';
    resourceRail.appendChild(context);

    const hpPill = document.createElement('div');
    hpPill.className = 'resource-pill';
    hpPill.innerHTML = `<span>Current HP</span><strong>${hp.replace(/^HP\s*/, '')}</strong>`;
    resourceRail.appendChild(hpPill);

    const resourceState = document.createElement('div');
    resourceState.className = 'resource-pill';
    resourceState.innerHTML = `<span>Actor resources</span><strong>${conditions.length ? conditions.join(' · ') : 'not supplied by fixture'}</strong>`;
    resourceRail.appendChild(resourceState);
  }

  function syncControlledActorPanel() {
    if (viewSelect.value !== 'dm') return;
    const controlledCard = root.querySelector('.actor-card.controlled');
    const panel = root.querySelector('.controlled-actor');
    if (!controlledCard || !panel) return;

    const actorId = controlledCard.dataset.actor || '';
    const avatar = controlledCard.querySelector('.actor-avatar')?.textContent?.trim();
    const name = controlledCard.querySelector('.actor-card__body > strong')?.textContent?.trim();
    const meta = [...controlledCard.querySelectorAll('.actor-meta span')].map(el => el.textContent.trim());
    const relation = meta[0] || 'ACTOR';
    const hp = meta.find(text => text.startsWith('HP ')) || 'HP —';
    const conditions = meta.slice(2).filter(Boolean);
    const sourceBar = controlledCard.querySelector('.actor-hp span');

    const portrait = panel.querySelector('.controlled-portrait');
    const title = panel.querySelector('.controlled-info > strong');
    const lines = panel.querySelectorAll('.controlled-info > p');
    const targetBar = panel.querySelector('.actor-hp span');

    assignText(portrait, avatar || '');
    assignText(title, name || 'Actor');
    assignText(lines[0], `${relation} · DM Controlled Actor`);
    assignText(lines[1], `${hp}${conditions.length ? ` · ${conditions.join(' · ')}` : ''}`);
    if (targetBar && sourceBar && targetBar.style.width !== sourceBar.style.width) {
      targetBar.style.width = sourceBar.style.width;
    }

    replaceResourceRailForMockActor(root.querySelector('.resource-rail'), actorId, hp, conditions);
  }

  function applyResolutionSafetyFixture() {
    if (scenarioSelect.value !== 'PROTO-SCN-16') return;
    const safety = F.resolutionSafety;
    if (!safety) return;

    root.querySelectorAll('[data-capability]').forEach(button => {
      const id = button.dataset.capability;
      if (safety.conflictingControlIds.includes(id)) {
        button.disabled = true;
        button.classList.add('unavailable');
        button.dataset.qaConflictLocked = 'true';
        button.title = 'Fixture: locked because this control conflicts with the active resolution.';
      } else if (safety.safeControlIds.includes(id)) {
        button.dataset.qaSafeDuringResolution = 'true';
        button.title = 'Fixture: remains available during this resolution.';
      }
    });

    const focus = root.querySelector('.stage-focus');
    if (focus && !focus.querySelector('[data-qa-resolution-safety]')) {
      const note = document.createElement('div');
      note.dataset.qaResolutionSafety = 'true';
      note.className = 'stage-chip';
      note.style.margin = '10px auto 0';
      note.style.width = 'fit-content';
      note.textContent = 'Fixture: only declared conflicting controls are locked';
      focus.appendChild(note);
    }
  }

  function patchRenderedUi() {
    patchScheduled = false;
    rememberSessionRole();
    cleanProductCopy();
    syncControlledActorPanel();
    applyResolutionSafetyFixture();
  }

  function schedulePatch() {
    if (patchScheduled) return;
    patchScheduled = true;
    queueMicrotask(patchRenderedUi);
  }

  // Preserve connected Host/DM or Client/Player role across safe Product pages.
  root.addEventListener('click', event => {
    const nav = event.target.closest('[data-nav]');
    if (!nav) return;

    if (nav.dataset.nav !== 'play') {
      rememberSessionRole();
      return;
    }

    if (viewSelect.value === 'offline') {
      viewSelect.value = lastSessionRole;
      viewSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, true);

  // Explicit DM control mode outranks the hostile-card Main Hand shortcut.
  root.addEventListener('click', event => {
    const actorCard = event.target.closest('[data-actor]');
    if (!actorCard) return;
    if (scenarioSelect.value !== 'PROTO-SCN-22' || viewSelect.value !== 'dm') return;
    if (root.querySelector('.hotbar-slot.selected')) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const rect = actorCard.getBoundingClientRect();
    actorCard.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + Math.min(24, rect.width / 2),
      clientY: rect.top + Math.min(24, rect.height / 2)
    }));
    setTimeout(() => root.querySelector('[data-context="control"]')?.click(), 0);
  }, true);

  const observer = new MutationObserver(schedulePatch);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  viewSelect.addEventListener('change', schedulePatch, true);
  scenarioSelect.addEventListener('change', schedulePatch, true);

  patchRenderedUi();
})();
