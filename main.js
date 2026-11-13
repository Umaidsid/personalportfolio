(() => {
  'use strict';

  /* The four planted defects, in page order. Each one knows how to
     describe itself as a ticket and how to repair its own element. */
  const DEFECTS = [
    {
      key: 'token',
      id: 'D-1',
      type: 'Rendering',
      severity: 'Medium',
      where: 'About',
      title: 'Team size shows a raw template token',
      steps: ['Open the About section.', 'Read the first paragraph.'],
      expected: 'teams of up to 10–11 QA engineers',
      actual: 'teams of up to {{team_size}} QA engineers',
      fix: (el) => replaceWith(el, 'span', '10–11'),
    },
    {
      key: 'date',
      id: 'D-2',
      type: 'Data',
      severity: 'High',
      where: 'Experience',
      title: 'Role ends before it starts',
      steps: ['Open the Experience section.', 'Read the dates on the TechBom role.'],
      expected: 'Aug 2021 – Dec 2022',
      actual: 'Aug 2021 – Dec 2020',
      fix: (el) => replaceWith(el, 'span', 'Dec 2022'),
    },
    {
      key: 'flip',
      id: 'D-3',
      type: 'Layout',
      severity: 'Low',
      where: 'Coverage',
      title: 'Claims stage renders upside down',
      steps: ['Open the Coverage section.', 'Compare the five stages in the row.'],
      expected: 'Claims sits upright like the other four',
      actual: 'Claims is rotated 180 degrees',
      fix: (el) => {
        const next = replaceWith(el, 'div');
        next.classList.remove('is-flipped');
        next.classList.add('was-flipped');
        return next;
      },
    },
    {
      key: 'sum',
      id: 'D-4',
      type: 'Calculation',
      severity: 'Medium',
      where: 'Toolkit',
      title: 'Total doesn’t match the rows above it',
      steps: ['Open the Toolkit section.', 'Add up the Count column.'],
      expected: '8 + 3 + 5 + 2 + 4 + 4 = 26',
      actual: 'Total shows 25',
      fix: (el) => replaceWith(el, 'span', '26'),
    },
  ];

  const STORE_KEY = 'umaid-defect-hunt';
  const WORDS = ['No', 'One', 'Two', 'Three', 'Four'];
  const byKey = Object.fromEntries(DEFECTS.map((d) => [d.key, d]));
  const fixed = new Set();
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const ticket = $('[data-ticket]');
  const dock = $('[data-dock]');
  const toast = $('[data-toast]');
  let pending = null; // defect waiting to be fixed when the ticket closes
  let toastTimer;

  /* ---------- storage (optional; the page works without it) ---------- */
  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter((k) => byKey[k]) : [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify([...fixed]));
    } catch {
      /* private mode or blocked storage: progress just won't persist */
    }
  }

  /* ---------- fixing ---------- */
  function replaceWith(el, tag, text) {
    const next = document.createElement(tag);
    for (const cls of el.classList) {
      if (!cls.startsWith('defect')) next.classList.add(cls);
    }
    if (text === undefined) next.append(...el.childNodes);
    else next.textContent = text;
    next.classList.add('fixed');
    next.dataset.fixed = el.dataset.defect;
    el.replaceWith(next);
    return next;
  }

  function applyFix(key, { fresh = true } = {}) {
    if (fixed.has(key)) return;
    const el = $(`[data-defect="${key}"]`);
    if (!el) return;
    const next = byKey[key].fix(el);
    if (fresh) next.classList.add('is-fresh');
    else next.classList.remove('was-flipped');
    fixed.add(key);
  }

  /* ---------- rendering ---------- */
  function render({ celebrate = false } = {}) {
    const done = fixed.size;
    const total = DEFECTS.length;
    const left = total - done;
    const ready = left === 0;
    const countText = `${done} of ${total} fixed`;

    for (const list of $$('[data-log]')) {
      list.replaceChildren(
        ...DEFECTS.map((d) => {
          const li = document.createElement('li');
          const isFixed = fixed.has(d.key);
          const row = document.createElement(isFixed ? 'button' : 'div');
          row.className = 'log-row';
          if (isFixed) {
            row.type = 'button';
            row.dataset.view = d.key;
            row.setAttribute('aria-label', `${d.id}, ${d.title}, fixed. View report`);
          }
          row.innerHTML = `
            <span class="log-id">${d.id}</span>
            <span class="log-what"></span>
            <span class="log-status ${isFixed ? 'is-fixed' : 'is-open'}">${isFixed ? 'Fixed' : 'Open'}</span>`;
          $('.log-what', row).textContent = isFixed ? d.title : `${d.type} defect`;
          li.append(row);
          return li;
        })
      );
    }

    for (const el of $$('[data-count]')) el.textContent = countText;

    const build = $('[data-build]');
    build.classList.toggle('is-ready', ready);
    $('[data-build-text]').textContent = ready
      ? 'Ready for release'
      : `${left} open ${left === 1 ? 'defect' : 'defects'}`;

    const heroStamp = $('[data-hero-stamp]');
    heroStamp.textContent = ready ? 'Released' : 'Under test';
    heroStamp.classList.toggle('is-pass', ready);

    $('[data-slip-note]').textContent = ready
      ? 'All four found, fixed and verified.'
      : 'One defect is hiding in each of the four sections below.';

    $('[data-verdict]').textContent = ready
      ? 'Ready. Every defect is fixed and verified.'
      : `Not ready. ${WORDS[left]} ${left === 1 ? 'defect is' : 'defects are'} still open.`;

    $('[data-reset]').hidden = done === 0;
    for (const btn of $$('[data-hint]')) btn.hidden = ready;
    $('[data-fix-all]').hidden = ready;

    $('[data-dock-count]').textContent = countText;
    if (ready) dock.hidden = true;

    const releaseStamp = $('[data-release-stamp]');
    releaseStamp.hidden = !ready;
    if (ready && celebrate) {
      for (const stamp of [releaseStamp, heroStamp]) {
        stamp.classList.remove('is-struck');
        void stamp.offsetWidth; // restart the strike animation
        stamp.classList.add('is-struck');
      }
    }
  }

  /* ---------- ticket ---------- */
  function openTicket(key, { view = false } = {}) {
    const d = byKey[key];
    pending = view ? null : key;

    $('[data-t-id]').textContent = `Defect ${d.id}`;
    $('[data-t-title]').textContent = d.title;
    $('[data-t-type]').textContent = d.type;
    $('[data-t-severity]').textContent = d.severity;
    $('[data-t-where]').textContent = d.where;
    $('[data-t-expected]').textContent = d.expected;
    $('[data-t-actual]').textContent = d.actual;
    $('[data-t-steps]').replaceChildren(
      ...d.steps.map((step) => Object.assign(document.createElement('li'), { textContent: step }))
    );

    const stamp = $('[data-t-stamp]');
    stamp.textContent = view ? 'Fixed' : 'Logged';
    stamp.classList.toggle('is-pass', view);
    $('[data-t-close]').textContent = view ? 'Close report' : 'Verify fix and close';

    ticket.showModal();
  }

  ticket.addEventListener('close', () => {
    if (!pending) return;
    const key = pending;
    pending = null;
    applyFix(key);
    save();
    render({ celebrate: true });
    const el = $(`[data-fixed="${key}"]`);
    if (el) {
      el.tabIndex = -1;
      el.focus({ preventScroll: true });
    }
    if (fixed.size === DEFECTS.length) {
      say('All four fixed. This build is ready for release.');
    }
  });

  // Clicking the backdrop closes the ticket, same as Esc.
  ticket.addEventListener('click', (e) => {
    if (e.target === ticket) ticket.close();
  });

  /* ---------- hint ---------- */
  function hint() {
    const next = DEFECTS.find((d) => !fixed.has(d.key));
    if (!next) return;
    const el = $(`[data-defect="${next.key}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' });
    el.classList.add('hinted');
    setTimeout(() => el.classList.remove('hinted'), 3200);
  }

  /* ---------- toast ---------- */
  function say(message) {
    toast.textContent = message;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2600);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', async (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    const defect = target.closest('[data-defect]');
    if (defect) {
      openTicket(defect.dataset.defect);
      return;
    }

    const view = target.closest('[data-view]');
    if (view) {
      openTicket(view.dataset.view, { view: true });
      return;
    }

    if (target.closest('[data-hint]')) {
      hint();
      return;
    }

    if (target.closest('[data-fix-all]')) {
      for (const d of DEFECTS) applyFix(d.key);
      save();
      render({ celebrate: true });
      say('All four defects fixed.');
      return;
    }

    if (target.closest('[data-reset]')) {
      try {
        localStorage.removeItem(STORE_KEY);
      } catch {
        /* nothing stored */
      }
      window.scrollTo(0, 0);
      location.reload();
      return;
    }

    const copy = target.closest('[data-copy]');
    if (copy) {
      try {
        await navigator.clipboard.writeText(copy.dataset.copy);
        say('Email address copied');
      } catch {
        say(`Copy didn’t work. The address is ${copy.dataset.copy}`);
      }
    }
  });

  /* ---------- dock: show progress once the hero slip scrolls away ---------- */
  // Hidden while the hero slip is on screen, over the contact block, and once
  // the hunt is finished (the top bar already carries the status).
  const onScreen = new Set();
  function syncDock() {
    dock.hidden = onScreen.size > 0 || fixed.size === DEFECTS.length;
  }
  if ('IntersectionObserver' in window) {
    const watcher = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      syncDock();
    });
    watcher.observe($('[data-hero-slip]'));
    watcher.observe($('#contact'));
  }

  /* ---------- start ---------- */
  for (const key of load()) applyFix(key, { fresh: false });
  render();
})();
