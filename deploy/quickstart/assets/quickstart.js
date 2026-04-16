(() => {
  const active = { h: 'hl', i: 'il' };
  let siteConfig = null;

  function byId(id) {
    return document.getElementById(id);
  }

  async function loadSiteConfig() {
    const injected = typeof window.SVEN_SITE_CONFIG === 'object' && window.SVEN_SITE_CONFIG ? window.SVEN_SITE_CONFIG : null;
    if (injected) {
      siteConfig = injected;
      return siteConfig;
    }

    try {
      const response = await fetch('/assets/quickstart-config.json', { credentials: 'omit', cache: 'no-store' });
      if (!response.ok) return null;
      siteConfig = await response.json();
      window.__SVEN_SITE_CONFIG = siteConfig;
      return siteConfig;
    } catch {
      return null;
    }
  }

  function installOrigin() {
    const configured = typeof siteConfig?.install_origin === 'string' ? siteConfig.install_origin.trim() : '';
    if (configured) return configured.replace(/\/$/, '');
    const fallback = 'https://sven.systems';
    try {
      if (window.location && /^https?:$/i.test(window.location.protocol)) {
        return window.location.origin || fallback;
      }
    } catch {
      return fallback;
    }
    return fallback;
  }

  function configuredRuntimeOrigin() {
    const configured = typeof siteConfig?.runtime_origin === 'string' ? siteConfig.runtime_origin.trim() : '';
    if (configured) return configured.replace(/\/$/, '');
    const meta = document.querySelector('meta[name="sven-runtime-origin"]')?.getAttribute('content')?.trim();
    if (meta) return meta.replace(/\/$/, '');
    const globalOrigin = typeof window.SVEN_RUNTIME_ORIGIN === 'string' ? window.SVEN_RUNTIME_ORIGIN.trim() : '';
    return globalOrigin ? globalOrigin.replace(/\/$/, '') : '';
  }

  function proofOrigin() {
    const configured = typeof siteConfig?.proof_origin === 'string' ? siteConfig.proof_origin.trim() : '';
    if (configured) return configured.replace(/\/$/, '');
    return runtimeOrigin();
  }

  function runtimeOrigin() {
    const configured = configuredRuntimeOrigin();
    if (configured) return configured;
    try {
      const protocol = window.location.protocol || 'https:';
      const hostname = window.location.hostname || '';
      const port = window.location.port ? `:${window.location.port}` : '';
      if (!hostname) return 'https://app.sven.systems';
      if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return `${protocol}//${hostname}${port}`;
      if (hostname.startsWith('app.')) return `${protocol}//${hostname}${port}`;
      if (hostname.startsWith('admin.')) return `${protocol}//${hostname.replace(/^admin\./, 'app.')}${port}`;
      if (hostname === 'sven.systems') return `${protocol}//app.sven.systems${port}`;
      if (hostname === 'example.com') return `${protocol}//app.example.com${port}`;
      if (hostname === 'sven.example.com') return `${protocol}//app.sven.example.com${port}`;
      if (hostname.startsWith('sven.')) return `${protocol}//app.${hostname.replace(/^sven\./, '')}${port}`;
      return `${protocol}//app.${hostname}${port}`;
    } catch {
      return 'https://app.sven.systems';
    }
  }

  function wireRuntimeLinks() {
    const base = runtimeOrigin();
    document.querySelectorAll('[data-runtime-path]').forEach((link) => {
      const path = link.getAttribute('data-runtime-path');
      if (!path) return;
      const href = `${base}${path}`;
      try { const u = new URL(href); if (u.protocol !== 'http:' && u.protocol !== 'https:') return; } catch { return; }
      link.setAttribute('href', href);
    });
  }

  function applyInstallCommands() {
    const base = installOrigin().replace(/\/+$/, '');
    const sh = `curl -fsSL ${base}/install.sh | sh`;
    const ps = `iwr -useb ${base}/install.ps1 | iex`;
    const docker = `SVEN_REPO_URL=https://<your-source-mirror>/thesven.git \\
SVEN_INSTALL_BOOTSTRAP=1 \\
curl -fsSL ${base}/install.sh | sh`;

    ['h-hl', 'i-il'].forEach((id) => {
      const el = byId(id);
      if (el) el.textContent = sh;
    });
    ['h-hp', 'i-ip'].forEach((id) => {
      const el = byId(id);
      if (el) el.textContent = ps;
    });
    ['h-hd', 'i-id'].forEach((id) => {
      const el = byId(id);
      if (el) el.textContent = docker;
    });
  }

  function switchSegment(group, id, button) {
    const prev = active[group];
    if (prev) byId(`${group}-${prev}`)?.classList.remove('on');
    byId(`${group}-${id}`)?.classList.add('on');
    active[group] = id;
    button.closest('.itabs')?.querySelectorAll('.itab').forEach((el) => el.classList.remove('on'));
    button.classList.add('on');
  }

  function copyActive(group) {
    const id = active[group];
    const text = byId(`${group}-${id}`)?.textContent?.trim();
    if (text) navigator.clipboard?.writeText(text).catch(() => {});
  }

  function wireSegmentControls() {
    document.querySelectorAll('[data-segment-group][data-segment-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const group = button.getAttribute('data-segment-group');
        const id = button.getAttribute('data-segment-id');
        if (!group || !id) return;
        switchSegment(group, id, button);
      });
    });

    document.querySelectorAll('[data-copy-group]').forEach((button) => {
      button.addEventListener('click', () => {
        const group = button.getAttribute('data-copy-group');
        if (!group) return;
        copyActive(group);
      });
    });
  }

  function wireScrollProgress() {
    const bar = byId('scroll-progress');
    if (!bar) return;
    const update = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const pct = height > 0 ? (scrollTop / height) * 100 : 0;
      bar.style.width = `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`;
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function wireReveal() {
    const targets = document.querySelectorAll('.hero, .sb, section, .fc, .pc, .surface, .layer, .docc, .sc, .capc');
    targets.forEach((el, idx) => {
      el.classList.add('rv');
      el.style.setProperty('--rvd', `${Math.min(idx * 22, 420)}ms`);
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    targets.forEach((el) => io.observe(el));
  }

  async function fetchJson(path) {
    try {
      const attempt = async (url) => {
        const response = await fetch(url, { credentials: 'omit' });
        if (!response.ok) return null;
        return response.json();
      };

      const sameOrigin = await attempt(path);
      if (sameOrigin) return sameOrigin;

      if (path.startsWith('/v1/')) {
        const base = proofOrigin();
        if (base && base !== window.location.origin) {
          return await attempt(`${base}${path}`);
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  function setText(id, value) {
    const el = byId(id);
    if (el) el.textContent = value;
  }

  function displayOrigin(value) {
    if (!value) return 'Unavailable';
    return String(value).replace(/^https?:\/\//, '');
  }

  function applyConfigDisclosure() {
    setText('cfg-deployment', siteConfig?.deployment_label || 'Auto');
    setText('cfg-install', displayOrigin(installOrigin()));
    setText('cfg-runtime', displayOrigin(runtimeOrigin()));
    setText('cfg-proof', displayOrigin(proofOrigin()));
  }

  async function loadEvidence() {
    const capability = await fetchJson('/v1/public/community/capability-proof');
    const status = await fetchJson('/v1/public/community/status');
    const feed = await fetchJson('/v1/public/community/feed');
    const cap = capability?.data;
    const st = status?.data;
    const fd = feed?.data;

    if (cap?.summary?.total_rows) {
      setText('ev-parity', `${cap.summary.proven_pass_rows}/${cap.summary.total_rows} proven`);
      const waves = Array.isArray(cap.waves) ? cap.waves : [];
      const pass = waves.filter((wave) => String(wave.status || '').toLowerCase() === 'pass').length;
      setText('ev-waves', `${pass}/${waves.length} verification lanes pass`);
      setText('ev2-capability', `${cap.status || 'unknown'} · ${cap.summary.coverage_percent || 0}% coverage`);
      setText('ev2-capability-hero', `${cap.summary.coverage_percent || 0}% coverage`);
    } else {
      setText('ev-parity', 'Capability proof unavailable');
      setText('ev-waves', 'Verification status unavailable');
      setText('ev2-capability', 'Unavailable');
      setText('ev2-capability-hero', 'Unavailable');
    }

    if (fd?.telemetry) {
      setText('ev-feed', `Public proof: ${fd.telemetry.doc_agents_status || 'unknown'}`);
      setText('ev-ready', `${fd.telemetry.readiness_percent || 0}% readiness`);
      setText('ev2-feed', `${fd.status || 'unknown'} · proof=${fd.telemetry.doc_agents_status || 'unknown'}`);
      setText('ev2-feed-hero', `${fd.telemetry.readiness_percent || 0}% readiness`);
    } else {
      setText('ev-feed', 'Feed unavailable');
      setText('ev-ready', 'Readiness unavailable');
      setText('ev2-feed', 'Unavailable');
      setText('ev2-feed-hero', 'Unavailable');
    }

    if (st) {
      setText('ev2-community', `${st.completed || 0}/${st.total || 0} configured`);
      setText('ev2-community-hero', `${st.completed || 0}/${st.total || 0} configured`);
    } else {
      setText('ev2-community', 'Unavailable');
      setText('ev2-community-hero', 'Unavailable');
    }
  }

  function loadWebchatWidget() {
    const endpoint = typeof siteConfig?.webchat_widget_endpoint === 'string' ? siteConfig.webchat_widget_endpoint.trim() : '';
    const apiKey = typeof siteConfig?.webchat_widget_api_key === 'string' ? siteConfig.webchat_widget_api_key.trim() : '';
    if (!endpoint || !apiKey) return;

    window.SvenWidgetConfig = {
      endpoint: endpoint.replace(/\/+$/, ''),
      apiKey,
      title: 'Ask Sven',
      position: 'bottom-right',
      primaryColor: '#4ed7ff',
      backgroundColor: '#050814',
      welcomeText: 'Hi! I can help you learn about Sven, get started with deployment, or answer questions about the platform.',
    };

    const script = document.createElement('script');
    script.src = endpoint.replace(/\/+$/, '') + '/widget.js';
    script.async = true;
    document.body.appendChild(script);
  }

  async function init() {
    await loadSiteConfig();
    wireRuntimeLinks();
    applyInstallCommands();
    applyConfigDisclosure();
    wireSegmentControls();
    wireScrollProgress();
    wireReveal();
    loadWebchatWidget();
    await loadEvidence();
  }

  init();
})();
