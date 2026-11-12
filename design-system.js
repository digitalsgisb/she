/* SHE Digital design-system helpers: skeletons, success pulse, optimistic updates, stagger. */
(function () {
  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const idx = (n, html) => Array.from({ length: n }, (_, i) => html(i)).join('');
  const bar = (cls, i, extra = '') => `<span class="ds-skel ${cls}" style="--i:${i};${extra}"></span>`;

  const kinds = {
    cards: n => idx(n, i => `<div class="ds-skel-card" style="--i:${i}">${bar('ds-skel-title', 0)}${bar('ds-skel-line', 0)}${bar('ds-skel-line short', 0)}</div>`),
    list: n => idx(n, i => `<div class="ds-skel-row" style="--i:${i}">${bar('ds-skel-avatar', 0)}<span style="display:grid;gap:8px">${bar('ds-skel-line', 0, 'width:70%')}${bar('ds-skel-line short', 0)}</span>${bar('ds-skel-line', 0)}</div>`),
    chart: () => `<div class="ds-skel-chart">${[55, 80, 40, 95, 65, 75].map((h, i) => bar('', i, `height:${h}%`)).join('')}</div>`,
    block: () => bar('ds-skel-block', 0),
    text: n => idx(n, i => bar(i === n - 1 ? 'ds-skel-line short' : 'ds-skel-line', i))
  };

  // SHEUI.skeleton('list', 4, 'Loading patrols') -> accessible skeleton markup.
  function skeleton(kind = 'text', count = 3, label = 'Loading') {
    const body = (kinds[kind] || kinds.text)(count);
    return `<div class="ds-skeleton" data-kind="${kind}" role="status" aria-busy="true"><span class="ds-sr-only">${label}…</span>${body}</div>`;
  }

  // Success pulse: a brief green ring to confirm an action landed.
  function pulse(el) {
    if (!el || reduceMotion()) return;
    el.classList.remove('ds-pulse');
    void el.offsetWidth;
    el.classList.add('ds-pulse');
    el.addEventListener('animationend', () => el.classList.remove('ds-pulse'), { once: true });
  }

  // Optimistic update: apply() runs immediately and may return an undo function.
  // commit() is the real request. On success the element pulses; on failure we undo and shake.
  async function optimistic(el, { apply, commit, onError }) {
    const undo = apply ? apply() : null;
    el && el.classList.add('ds-pending');
    try {
      const result = await commit();
      el && el.classList.remove('ds-pending');
      pulse(el);
      return result;
    } catch (error) {
      el && el.classList.remove('ds-pending');
      if (typeof undo === 'function') undo();
      if (el && !reduceMotion()) { el.classList.add('ds-rollback'); el.addEventListener('animationend', () => el.classList.remove('ds-rollback'), { once: true }); }
      if (onError) onError(error);
      throw error;
    }
  }

  // Track the last control the user pressed so a success toast can pulse it.
  let lastPressed = null;
  document.addEventListener('pointerdown', e => { lastPressed = e.target.closest && e.target.closest('button,.primary-button,.secondary-button,summary'); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter') lastPressed = document.activeElement; }, true);
  function confirm() {
    const target = lastPressed && document.contains(lastPressed) ? lastPressed : null;
    pulse(target);
    const toast = document.getElementById('toast');
    if (toast) pulse(toast);
  }

  // Stagger: tag direct children of known collection containers with an index.
  const STAGGER = '.section-grid,.module-grid,.genba-grid,.she-record-list,.she-overview-grid,.topic-grid,.patrol-list,.patrol-card-grid,.user-list';
  function stagger(root) {
    (root || document).querySelectorAll(STAGGER).forEach(container => {
      if (container.dataset.dsStagger) return;
      container.dataset.dsStagger = '1';
      Array.from(container.children).slice(0, 12).forEach((child, i) => child.style.setProperty('--i', i));
    });
  }
  function watchStagger() {
    const content = document.getElementById('content');
    if (!content) return;
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; stagger(content); });
    }).observe(content, { childList: true, subtree: true });
    stagger(content);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchStagger); else watchStagger();

  window.SHEUI = { skeleton, pulse, optimistic, confirm, stagger };
})();
