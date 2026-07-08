(function () {
  const API = '/.netlify/functions/auth';
  let done;
  let fail;
  const ready = new Promise((resolve, reject) => { done = resolve; fail = reject; });
  window.naseAuthReady = ready;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  const SECTIONS = [
    { id: 'byd', tab: 'Bydleníčko', name: 'Naše Bydleníčko', color: '#0F766E',
      desc: 'Nemovitosti, které spolu zvažujeme — vedle sebe, bez rozkopírovaných odkazů a Excelu.',
      feats: ['Cena, m², dispozice a mapa', 'Dojezd na Pankrác u každého domu', 'Splátka hypotéky spočítaná rovnou', 'Štítky: favorit, prohlídka, zamítnuto'],
      icon: '<path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/><path d="M9.5 20v-6h5v6"/>' },
    { id: 'aut', tab: 'Autíčko', name: 'Naše Autíčko', color: '#0284C7',
      desc: 'Auta z Česka i dovoz z EU v jednom přehledu, ceny přepočítané do korun.',
      feats: ['Cena, rok, najeto, výkon', 'Import inzerátu: sauto, mobile.de, bazoš', 'Měsíční náklady na provoz', 'Domluvená a dovozní cena'],
      icon: '<path d="M5 11l1.6-4A2 2 0 0 1 8.5 6h7a2 2 0 0 1 1.9 1.3L19 11"/><rect x="3" y="11" width="18" height="6" rx="1.5"/><path d="M7 17v1.5M17 17v1.5"/>' },
    { id: 'fin', tab: 'Hospodařeníčko', name: 'Naše Hospodařeníčko', color: '#D97706',
      desc: 'Rodinný rozpočet: příjmy, výdaje, mzdy a volné peníze každý měsíc.',
      feats: ['Příjmy a výdaje po členech domácnosti', 'Kalkulačka čisté mzdy', 'Import splátky a provozu auta', 'Scénáře rozpočtu chráněné PINem'],
      icon: '<path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="11" width="3" height="5" rx="1"/><rect x="12" y="8" width="3" height="8" rx="1"/><rect x="17" y="4" width="3" height="12" rx="1"/>' }
  ];
  const icon = (p, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w || 1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const HANDS = '<path d="M4.5 11 C3.8 15 6 18.5 10 20 C9.2 18.3 9.1 17.2 9.9 16.3 C8.2 15.6 6.3 14.2 5.7 12"/><path d="M19.5 11 C20.2 15 18 18.5 14 20 C14.8 18.3 14.9 17.2 14.1 16.3 C15.8 15.6 17.7 14.2 18.3 12"/>';
  const DOTS_MONO = '<circle cx="7.6" cy="7" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="5.2" r="1.7" fill="currentColor" stroke="none"/><circle cx="16.4" cy="7" r="1.7" fill="currentColor" stroke="none"/>';
  const DOTS_COLOR = '<circle cx="7.6" cy="7" r="1.7" fill="#2DD4BF" stroke="none"/><circle cx="12" cy="5.2" r="1.7" fill="#38BDF8" stroke="none"/><circle cx="16.4" cy="7" r="1.7" fill="#FBBF24" stroke="none"/>';
  const CHECK = '<path d="M20 6 9 17l-5-5"/>';

  function showLogin(message) {
    if (document.getElementById('auth-gate')) return;
    const gate = el('div', 'auth-gate');
    gate.id = 'auth-gate';
    gate.innerHTML = `
      <svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>
        <clipPath id="ag-wave-v" clipPathUnits="objectBoundingBox"><path d="M0 0 H0.94 C1 0.14 0.88 0.32 0.94 0.5 C0.99 0.64 0.87 0.82 0.95 1 H0 Z"/></clipPath>
        <clipPath id="ag-wave-h" clipPathUnits="objectBoundingBox"><path d="M0 0 H1 V0.9 C0.78 1 0.58 0.88 0.38 0.95 C0.22 1 0.1 0.92 0 0.96 Z"/></clipPath>
      </defs></svg>
      <div class="ag-pitch">
        <span class="ag-lava" aria-hidden="true">${SECTIONS.map((s, i) => `<i class="ag-blob ${s.id}${i === 0 ? ' on' : ''}"></i>`).join('')}</span>
        <div class="ag-head"><span class="ag-mark" aria-hidden="true">${icon(HANDS + DOTS_COLOR, 1.9)}</span><span class="ag-wm">Naše</span></div>
        <div class="ag-tabs" role="tablist" aria-label="Sekce">
          ${SECTIONS.map((s, i) => `<button type="button" role="tab" aria-selected="${i === 0}" class="ag-tab${i === 0 ? ' on' : ''}" data-i="${i}" style="--sec:${s.color}">${icon(s.icon)}${s.tab}</button>`).join('')}
        </div>
        <div class="ag-body" id="ag-body" aria-live="polite"></div>
        <p class="ag-foot">Soukromý přehled · jen pro nás</p>
      </div>
      <div class="ag-pane">
        <form class="auth-box" autocomplete="on">
          <div class="auth-mark" aria-hidden="true">${icon(HANDS + DOTS_MONO, 1.9)}</div>
          <h2>Vítej zpět</h2>
          <p>Pro pokračování zadej rodinné heslo.</p>
          <label for="auth-password">Heslo</label>
          <input id="auth-password" type="password" autocomplete="current-password" autofocus>
          <label class="auth-check"><input id="auth-remember" type="checkbox"> Zapamatovat na tomto zařízení</label>
          <button type="submit">Odemknout</button>
          <div class="auth-msg" id="auth-msg">${message || ''}</div>
        </form>
      </div>`;
    document.body.appendChild(gate);

    const body = gate.querySelector('#ag-body');
    const tabs = gate.querySelectorAll('.ag-tab');
    const bgs = gate.querySelectorAll('.ag-blob');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let idx = 0;
    let timer = 0;
    function fill(s) {
      body.innerHTML = `
        <span class="ag-ic">${icon(s.icon)}</span>
        <h2>${s.name}</h2>
        <p>${s.desc}</p>
        <ul>${s.feats.map(f => `<li><span class="ag-dot">${icon(CHECK, 2.4)}</span>${f}</li>`).join('')}</ul>`;
    }
    function show(i) {
      if (i === idx) return;
      idx = i;
      tabs.forEach((t, j) => { t.classList.toggle('on', j === i); t.setAttribute('aria-selected', String(j === i)); });
      bgs.forEach((b, j) => b.classList.toggle('on', j === i));
      gate.style.setProperty('--gp', SECTIONS[i].color);
      if (reduced) { fill(SECTIONS[i]); return; }
      body.classList.add('ag-out');
      setTimeout(() => {
        fill(SECTIONS[i]);
        body.classList.remove('ag-out');
        body.classList.add('ag-enter');
        requestAnimationFrame(() => requestAnimationFrame(() => body.classList.remove('ag-enter')));
      }, 240);
    }
    function arm() {
      if (reduced) return;
      clearInterval(timer);
      timer = setInterval(() => show((idx + 1) % SECTIONS.length), 5200);
    }
    tabs.forEach(t => t.addEventListener('click', () => { show(Number(t.dataset.i)); arm(); }));
    fill(SECTIONS[0]);
    arm();

    const form = gate.querySelector('form');
    const msg = gate.querySelector('#auth-msg');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      msg.textContent = '';
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      button.textContent = 'Ověřuji...';
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            password: gate.querySelector('#auth-password').value,
            remember: gate.querySelector('#auth-remember').checked
          })
        });
        if (!res.ok) throw new Error(res.status === 401 ? 'Heslo nesedí.' : 'Přihlášení selhalo.');
        clearInterval(timer);
        gate.remove();
        done();
      } catch (e) {
        msg.textContent = e.message || 'Přihlášení selhalo.';
      } finally {
        button.disabled = false;
        button.textContent = 'Odemknout';
      }
    });
  }

  async function check() {
    try {
      const res = await fetch(API);
      const data = res.ok ? await res.json() : null;
      if (data?.authenticated) return done();
      showLogin();
    } catch (e) {
      fail(e);
      showLogin('Nepodařilo se ověřit přístup.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check, { once: true });
  } else {
    check();
  }
})();
