(() => {
  'use strict';

  const root = document.getElementById('appRoot');
  const viewSelect = document.getElementById('viewSelect');
  const scenarioSelect = document.getElementById('scenarioSelect');
  if (!root || !viewSelect || !scenarioSelect) return;

  let lastSessionRole = 'player';
  let patching = false;

  function rememberSessionRole() {
    if (viewSelect.value === 'dm' || viewSelect.value === 'player') {
      lastSessionRole = viewSelect.value;
    }
  }

  function setText(selector, text) {
    const el = root.querySelector(selector);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function cleanProductCopy() {
    setText('.mapless-stage .stage-label strong', 'PLAY CONTEXT');
    setText('.mapless-stage .stage-label span', 'shared action · dice · result · handout');

    const focusTitle = root.querySelector('.stage-focus h2');
    if (focusTitle?.textContent.includes('Mapless shared play context')) {
      focusTitle.textContent = 'Shared play context';
    }
    if (focusTitle?.textContent.includes('not a battlemap')) {
      focusTitle.textContent = 'Actor and action context';
    }

    const focusBody = root.querySelector('.stage-focus p');
    if (focusBody?.textContent.includes('tactical tokens')) {
      focusBody.textContent = '현재 상호작용, 알림, 주사위, 결과와 Handout을 같은 플레이 맥락에서 보여줍니다.';
    }
    if (focusBody?.textContent.includes('Actor identity and targets remain in the boards')) {
      focusBody.textContent = 'Initiative 순서와 행동 자원이 활성화되고, Actor와 대상은 위·아래 Actor Board에서 계속 확인합니다.';
    }

    const tutorialIntro = root.querySelector('.tutorial-top p');
    if (tutorialIntro) {
      tutorialIntro.textContent = 'SimpleVTT는 캐릭터 시트와 판정 자동화를 중심으로, 필요할 때 같은 플레이 맥락을 연결 세션으로 공유하는 tabletop companion입니다.';
    }
    const tutorialModes = root.querySelectorAll('.tutorial-mode p');
    if (tutorialModes[1]) {
      tutorialModes[1].textContent = 'Host는 DM, Client는 Player입니다. Actor, 행동, 판정, 주사위, 기록과 Handout을 같은 세션에서 공유합니다.';
    }

    const heroCopy = root.querySelector('.home-hero .hero-card p');
    if (heroCopy) {
      heroCopy.textContent = 'Character Sheet를 단독으로 사용하거나, DM이 Session을 열고 Player가 자신의 Character로 참가할 수 있습니다. Connected Play에서는 Actor, 행동, 판정, 주사위와 Handout을 하나의 맥락에서 이어갑니다.';
    }

    root.querySelectorAll('.utility-row').forEach(row => {
      const strong = row.querySelector('strong');
      const span = row.querySelector('span');
      if (!strong || !span) return;
      if (strong.textContent === 'Core map') {
        strong.textContent = 'Scene presentation';
        span.textContent = 'Actor · action · result context';
      }
      if (span.textContent.includes('no map positions')) {
        span.textContent = span.textContent.replace(' · Actor facts only, no map positions.', ' · Actor encounter facts.');
      }
    });
  }

  function syncControlledActorPanel() {
    if (viewSelect.value !== 'dm') return;
    const controlledCard = root.querySelector('.actor-card.controlled');
    const panel = root.querySelector('.controlled-actor');
    if (!controlledCard || !panel) return;

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

    if (portrait && avatar) portrait.textContent = avatar;
    if (title && name) title.textContent = name;
    if (lines[0]) lines[0].textContent = `${relation} · DM Controlled Actor`;
    if (lines[1]) lines[1].textContent = `${hp}${conditions.length ? ` · ${conditions.join(' · ')}` : ''}`;
    if (targetBar && sourceBar) targetBar.style.width = sourceBar.style.width;
  }

  function patchRenderedUi() {
    if (patching) return;
    patching = true;
    try {
      rememberSessionRole();
      cleanProductCopy();
      syncControlledActorPanel();
    } finally {
      patching = false;
    }
  }

  // Preserve the connected Host/DM or Client/Player role while the user visits
  // Product Shell pages during a live session. The Product page itself may be
  // role-neutral; Return to Play must restore the previous connected role.
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

  // UX click precedence: an explicit DM control mode outranks the normal
  // hostile-card Main Hand shortcut when no action is already targeting.
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

  const observer = new MutationObserver(() => queueMicrotask(patchRenderedUi));
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  viewSelect.addEventListener('change', () => queueMicrotask(patchRenderedUi), true);
  scenarioSelect.addEventListener('change', () => queueMicrotask(patchRenderedUi), true);

  patchRenderedUi();
})();
