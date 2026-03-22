(() => {
  function byId(id) {
    return document.getElementById(id);
  }

  function uniqueOrigins(origins) {
    const seen = new Set();
    return origins.filter((origin) => {
      if (!origin || seen.has(origin)) return false;
      seen.add(origin);
      return true;
    });
  }

  function configuredRuntimeOrigin() {
    const meta = document.querySelector('meta[name="sven-runtime-origin"]')?.getAttribute('content')?.trim();
    if (meta) return meta.replace(/\/$/, '');
    const globalOrigin = typeof window.SVEN_RUNTIME_ORIGIN === 'string' ? window.SVEN_RUNTIME_ORIGIN.trim() : '';
    return globalOrigin ? globalOrigin.replace(/\/$/, '') : '';
  }

  function runtimeOriginCandidates() {
    const protocol = window.location.protocol || 'https:';
    const hostname = window.location.hostname || '';
    const port = window.location.port ? `:${window.location.port}` : '';
    const configured = configuredRuntimeOrigin();

    if (configured) return [configured];
    if (!hostname) return [];
    if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      return [`${protocol}//${hostname}${port}`];
    }
    if (hostname.startsWith('app.')) {
      return [`${protocol}//${hostname}${port}`];
    }
    if (hostname.startsWith('admin.')) {
      return uniqueOrigins([
        `${protocol}//${hostname.replace(/^admin\./, 'app.')}${port}`,
        `${protocol}//${hostname}${port}`,
      ]);
    }
    if (hostname === 'sven.systems') {
      return [`${protocol}//app.sven.systems${port}`];
    }
    if (hostname === 'sven.example.com') {
      return [`${protocol}//app.sven.example.com${port}`];
    }
    if (hostname === 'sven.47matrix.online') {
      return uniqueOrigins([
        `${protocol}//sven.glyph.47matrix.online${port}`,
        `${protocol}//app.47matrix.online${port}`,
        `${protocol}//${hostname}${port}`,
      ]);
    }
    if (hostname.startsWith('sven.')) {
      const suffix = hostname.replace(/^sven\./, '');
      return uniqueOrigins([
        `${protocol}//app.${suffix}${port}`,
        `${protocol}//sven.glyph.${suffix}${port}`,
        `${protocol}//${hostname}${port}`,
      ]);
    }
    return uniqueOrigins([
      `${protocol}//app.${hostname}${port}`,
      `${protocol}//${hostname}${port}`,
    ]);
  }

  let runtimeOriginPromise = null;

  async function isRuntimeOriginReachable(origin) {
    const checks = ['/readyz', '/'];
    for (const path of checks) {
      try {
        await fetch(`${origin}${path}`, {
          credentials: 'omit',
          cache: 'no-store',
          mode: 'no-cors',
        });
        return true;
      } catch {
        // Try the next lightweight probe.
      }
    }
    return false;
  }

  async function runtimeOrigin() {
    if (!runtimeOriginPromise) {
      runtimeOriginPromise = (async () => {
        const candidates = runtimeOriginCandidates();
        for (const candidate of candidates) {
          if (await isRuntimeOriginReachable(candidate)) {
            window.__SVEN_DEBUG_RUNTIME_ORIGIN = candidate;
            return candidate;
          }
        }
        const fallback = candidates[0] || window.location.origin;
        window.__SVEN_DEBUG_RUNTIME_ORIGIN = fallback;
        return fallback;
      })();
    }
    return runtimeOriginPromise;
  }

  function set(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function statusText(v) {
    return String(v || 'unknown').toLowerCase();
  }

  function animateCounter(id, from, to, formatter, duration = 900) {
    const el = byId(id);
    if (!el) return;
    const startAt = performance.now();
    const start = Number.isFinite(from) ? from : 0;
    const end = Number.isFinite(to) ? to : start;
    const delta = end - start;

    function step(now) {
      const progress = Math.min((now - startAt) / duration, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      const value = start + delta * eased;
      el.textContent = formatter(Math.round(value));
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  async function getJson(path) {
    try {
      const attempt = async (url) => {
        const response = await fetch(url, { credentials: 'omit' });
        if (!response.ok) return null;
        return response.json();
      };

      if (!path.startsWith('/v1/')) {
        return await attempt(path);
      }

      const sameOrigin = await attempt(path);
      if (sameOrigin) return sameOrigin;

      const base = await runtimeOrigin();
      if (!base || base === window.location.origin) return null;
      return await attempt(`${base}${path}`);
    } catch {
      return null;
    }
  }

  async function wireRuntimeLinks() {
    const base = await runtimeOrigin();
    if (!base) return;
    document.querySelectorAll('[data-runtime-path]').forEach((link) => {
      const path = link.getAttribute('data-runtime-path');
      if (!path) return;
      link.setAttribute('href', `${base}${path}`);
    });
  }

  function setActiveNav() {
    const path = (window.location.pathname || '').replace(/\/$/, '') || '/suite';
    const cleanPath = path.split('#')[0].split('?')[0];
    const links = document.querySelectorAll('.nav a[href]');
    links.forEach((link) => {
      const href = (link.getAttribute('href') || '').replace(/\/$/, '');
      if (!href.startsWith('/suite')) return;
      if (href === cleanPath) {
        link.classList.add('active');
      } else if (href === '/suite' && cleanPath === '/suite') {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  function wireLogoPanelTilt() {
    const panel = document.querySelector('.logo-panel');
    if (!panel) return;

    panel.addEventListener('mousemove', (ev) => {
      const rect = panel.getBoundingClientRect();
      const x = (ev.clientX - rect.left) / rect.width;
      const y = (ev.clientY - rect.top) / rect.height;
      const rx = (0.5 - y) * 7;
      const ry = (x - 0.5) * 9;
      panel.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    });

    panel.addEventListener('mouseleave', () => {
      panel.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
    });
  }

  function wireDepthHover() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const targets = document.querySelectorAll('.card, .hero-panel, .topology-node, .control-card, .journey-step, .threat-card, .milestone-track');
    targets.forEach((el) => {
      el.addEventListener('mousemove', (ev) => {
        const rect = el.getBoundingClientRect();
        const x = (ev.clientX - rect.left) / rect.width;
        const y = (ev.clientY - rect.top) / rect.height;
        const rx = (0.5 - y) * 4.4;
        const ry = (x - 0.5) * 5.6;
        el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  function wireRevealMotion() {
    const targets = document.querySelectorAll('.hero, .section, .card, .table-wrap, .logo-panel');
    targets.forEach((el, idx) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-delay', `${Math.min(idx * 28, 420)}ms`);
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );

    targets.forEach((el) => io.observe(el));
  }

  function wireScrollProgress() {
    if (document.querySelector('.scroll-progress')) return;
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    document.body.appendChild(bar);

    const update = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const height = (document.documentElement.scrollHeight - window.innerHeight);
      const ratio = height > 0 ? (scrollTop / height) : 0;
      bar.style.width = `${Math.max(0, Math.min(100, ratio * 100)).toFixed(2)}%`;
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function wireSegmentControls() {
    const groups = document.querySelectorAll('[data-segment-group]');
    groups.forEach((group) => {
      const buttons = group.querySelectorAll('[data-segment-target]');
      if (!buttons.length) return;
      group.setAttribute('role', 'tablist');

      const panelMap = new Map();
      buttons.forEach((btn) => {
        const target = btn.getAttribute('data-segment-target');
        if (!target) return;
        const panel = document.getElementById(target);
        if (panel) {
          panelMap.set(target, panel);
          panel.setAttribute('role', 'tabpanel');
        }
        btn.setAttribute('role', 'tab');
      });

      const activate = (target) => {
        buttons.forEach((btn, index) => {
          const isActive = btn.getAttribute('data-segment-target') === target;
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-selected', String(isActive));
          btn.setAttribute('tabindex', isActive ? '0' : '-1');
          if (isActive && document.activeElement === document.body) {
            // Preserve keyboard flow for tablists after page load.
            buttons[index].focus({ preventScroll: true });
          }
        });
        panelMap.forEach((panel, key) => {
          panel.classList.toggle('active', key === target);
          panel.setAttribute('aria-hidden', String(key !== target));
        });
      };

      buttons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
          const target = btn.getAttribute('data-segment-target');
          if (target) activate(target);
        });

        btn.addEventListener('keydown', (ev) => {
          if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(ev.key)) return;
          ev.preventDefault();
          let nextIndex = index;
          if (ev.key === 'ArrowRight') nextIndex = (index + 1) % buttons.length;
          if (ev.key === 'ArrowLeft') nextIndex = (index - 1 + buttons.length) % buttons.length;
          if (ev.key === 'Home') nextIndex = 0;
          if (ev.key === 'End') nextIndex = buttons.length - 1;
          const next = buttons[nextIndex];
          const target = next.getAttribute('data-segment-target');
          if (target) activate(target);
          next.focus();
        });
      });

      const initial = [...buttons].find((btn) => btn.classList.contains('active'))?.getAttribute('data-segment-target')
        || buttons[0].getAttribute('data-segment-target');
      if (initial) activate(initial);
    });
  }

  async function loadEvidence() {
    const capRes = await getJson('/v1/public/community/capability-proof');
    const feedRes = await getJson('/v1/public/community/feed');
    const stRes = await getJson('/v1/public/community/status');

    const cap = capRes && capRes.data ? capRes.data : null;
    const feed = feedRes && feedRes.data ? feedRes.data : null;
    const st = stRes && stRes.data ? stRes.data : null;

    if (cap && cap.summary && cap.summary.total_rows) {
      set('ev-capability', `${cap.summary.proven_pass_rows}/${cap.summary.total_rows} proven (${cap.summary.coverage_percent || 0}%)`);
      const waves = Array.isArray(cap.waves) ? cap.waves : [];
      const passWaves = waves.filter((w) => statusText(w.status) === 'pass').length;
      animateCounter('ev-waves', 0, passWaves, (v) => `${v}/${waves.length} wave lanes pass`);
    } else {
      set('ev-capability', 'Unavailable');
      set('ev-waves', 'Unavailable');
    }

    if (feed && feed.telemetry) {
      set('ev-feed', `doc_agents=${statusText(feed.telemetry.doc_agents_status)} | ecosystem=${statusText(feed.telemetry.ecosystem_status)}`);
      animateCounter('ev-readiness', 0, feed.telemetry.readiness_percent || 0, (v) => `${v}% readiness`);
    } else {
      set('ev-feed', 'Unavailable');
      set('ev-readiness', 'Unavailable');
    }

    if (st) {
      set('ev-community', `${st.completed || 0}/${st.total || 0} configured`);
    } else {
      set('ev-community', 'Unavailable');
    }
  }

  async function init() {
    const year = new Date().getFullYear();
    set('suite-year', String(year));
    setActiveNav();
    await wireRuntimeLinks();
    wireRevealMotion();
    wireScrollProgress();
    wireLogoPanelTilt();
    wireDepthHover();
    wireSegmentControls();
    await loadEvidence();
  }

  init();
})();
