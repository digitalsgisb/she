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
  let pressedAt = 0;
  document.addEventListener('pointerdown', () => { pressedAt = Date.now(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Enter') pressedAt = Date.now(); }, true);
  // Mark the control that triggered a write as busy; pulse on success, shake on failure.
  function begin() {
    const el = lastPressed && document.contains(lastPressed) && Date.now() - pressedAt < 3000 ? lastPressed : null;
    if (!el || el.classList.contains('ds-pending')) return null;
    el.classList.add('ds-busy');
    el.setAttribute('aria-busy', 'true');
    return ok => {
      el.classList.remove('ds-busy');
      el.removeAttribute('aria-busy');
      if (ok) pulse(el);
      else if (!reduceMotion()) { el.classList.add('ds-rollback'); el.addEventListener('animationend', () => el.classList.remove('ds-rollback'), { once: true }); }
    };
  }
  function confirm() {
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

  // Route change: only content that mounts within this short window animates in,
  // so background refreshes never replay entrances (that was the flicker).
  let routeKey = (location.hash.split('?')[0].split('/')[1] || '');
  let routingTimer;
  window.addEventListener('hashchange', () => {
    const next = location.hash.split('?')[0].split('/')[1] || '';
    if (next === routeKey) return;
    routeKey = next;
    document.body.classList.add('ds-routing');
    clearTimeout(routingTimer);
    routingTimer = setTimeout(() => document.body.classList.remove('ds-routing'), 600);
  });


  // Sidebar: one moving highlight box that glides between items. It is driven by CSS transitions,
  // so it can be interrupted at any point. Hover retargeting uses a "safe triangle" (as in
  // Amazon's mega menu): while the pointer travels diagonally toward the open sub menu, items it
  // crosses on the way do not steal the box.
  function initNavBox() {
    const nav = document.getElementById('nav');
    if (!nav || nav.dataset.dsBox) return;
    nav.dataset.dsBox = '1';
    const box = document.createElement('span');
    box.className = 'ds-nav-box';
    box.setAttribute('aria-hidden', 'true');
    let target = null, hovering = null, raf = 0, retarget = 0, prev = null;
    const itemSel = '.nav-link,.subnav-link';
    const activeItem = () => nav.querySelector('.subnav.expanded .subnav-link.active') || nav.querySelector('.nav-link.active');
    function place(el, animate = true) {
      if (!el || !el.isConnected) { box.style.opacity = '0'; return; }
      const n = nav.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (!r.width || !r.height) { box.style.opacity = '0'; return; }
      box.style.transition = animate ? '' : 'none';
      box.style.opacity = '1';
      box.style.width = r.width + 'px';
      box.style.height = r.height + 'px';
      box.style.transform = `translate(${r.left - n.left + nav.scrollLeft}px, ${r.top - n.top + nav.scrollTop}px)`;
    }
    // Menus resize while animating; follow the target for the duration.
    function track(ms = 450) {
      cancelAnimationFrame(raf);
      const end = performance.now() + ms;
      const step = () => { place(target || activeItem()); if (performance.now() < end) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    }
    function setTarget(el) { target = el; track(); }
    function mount() {
      if (box.parentNode !== nav) {
        const had = box.style.transform;
        nav.prepend(box);
        if (had) { void box.offsetWidth; }
      }
      if (hovering && !hovering.isConnected) {
        const href = hovering.getAttribute('href');
        hovering = href ? nav.querySelector(`${itemSel.split(',').map(x => x + '[href="' + href + '"]').join(',')}`) : null;
      }
      target = hovering;
      track();
    }
    new MutationObserver(() => { if (box.parentNode !== nav || !nav.contains(box)) mount(); else track(); })
      .observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    nav.addEventListener('click', e => { if (e.target.closest('.nav-toggle')) track(500); });
    nav.addEventListener('transitionend', e => { if (e.target.classList?.contains('subnav')) track(60); });
    window.addEventListener('resize', () => place(target || activeItem(), false));

    function inTriangle(p, a, b, c) {
      const s = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
      const d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    }
    function safe(from, to) {
      const sub = nav.querySelector('.subnav.expanded');
      if (!from || !sub || !hovering) return false;
      const r = sub.getBoundingClientRect();
      if (to.y > r.bottom || to.y < r.top - 60) return false;
      return inTriangle(to, from, { x: r.right, y: r.top }, { x: r.right, y: r.bottom });
    }
    nav.addEventListener('pointermove', e => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const el = e.target.closest(itemSel);
      const p = { x: e.clientX, y: e.clientY };
      const from = prev; prev = p;
      if (!el || el === hovering) return;
      clearTimeout(retarget);
      if (safe(from, p)) { retarget = setTimeout(() => { hovering = el; setTarget(el); }, 140); return; }
      hovering = el; setTarget(el);
    });
    nav.addEventListener('pointerleave', () => { clearTimeout(retarget); hovering = null; prev = null; setTarget(null); });
    mount();
  }
  const navReady = () => { initNavBox(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', navReady); else navReady();

  window.SHEUI = { skeleton, pulse, optimistic, confirm, begin, stagger };
})();
