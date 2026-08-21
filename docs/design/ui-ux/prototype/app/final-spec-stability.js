(() => {
  'use strict';

  const root = document.getElementById('appRoot');
  const F = window.SVTT_FINAL_SPEC_FIXTURES;
  if (!root || !F) return;

  let tooltip = null;

  function clearTooltip() {
    if (tooltip) tooltip.remove();
    tooltip = null;
  }

  function showTooltip(el, event) {
    const id = el.dataset.capability;
    const cap = F.capabilities.find(x => x.id === id);
    if (!cap) return;
    clearTooltip();
    tooltip = document.createElement('div');
    tooltip.className = 'rich-hover';
    tooltip.setAttribute('role','tooltip');
    tooltip.innerHTML = `<strong>${escapeHtml(cap.label)} · ${escapeHtml(cap.cost)}</strong><p>${escapeHtml(cap.description)}${cap.unavailableReason ? ` ${escapeHtml(cap.unavailableReason)}` : ''}</p>`;
    document.body.appendChild(tooltip);
    moveTooltip(event);
  }

  function moveTooltip(event) {
    if (!tooltip) return;
    const x = Math.min(event.clientX + 14, window.innerWidth - 296);
    const y = Math.min(event.clientY + 14, window.innerHeight - 150);
    tooltip.style.left = `${Math.max(8,x)}px`;
    tooltip.style.top = `${Math.max(8,y)}px`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
      .replaceAll('"','&quot;').replaceAll("'",'&#039;');
  }

  root.addEventListener('pointerover', event => {
    const el = event.target.closest('[data-capability]');
    if (!el) return;
    event.stopImmediatePropagation();
    showTooltip(el,event);
  }, true);

  root.addEventListener('pointermove', event => {
    if (tooltip) moveTooltip(event);
  }, true);

  root.addEventListener('pointerout', event => {
    const el = event.target.closest('[data-capability]');
    if (!el) return;
    const related = event.relatedTarget;
    if (related && el.contains(related)) return;
    event.stopImmediatePropagation();
    clearTooltip();
  }, true);

  root.addEventListener('focusin', event => {
    const el = event.target.closest('[data-capability]');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    showTooltip(el,{ clientX: rect.right, clientY: rect.top });
  }, true);

  root.addEventListener('focusout', event => {
    if (event.target.closest('[data-capability]')) clearTooltip();
  }, true);

  window.addEventListener('blur',clearTooltip);
})();
