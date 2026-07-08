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
  const LOGO_IMG = '<img src="img/logo-mark.png" alt="">';
  const CHECK = '<path d="M20 6 9 17l-5-5"/>';

  function showLogin(message) {
    if (document.getElementById('auth-gate')) return;
    const gate = el('div', 'auth-gate');
    gate.id = 'auth-gate';
    gate.innerHTML = `
      <svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>
        <clipPath id="agl-blob" clipPathUnits="objectBoundingBox">
          <path d="M0.22 0 C0.14 0.08 0.18 0.16 0.26 0.23 C0.34 0.31 0.35 0.42 0.29 0.52 C0.24 0.61 0.16 0.66 0.13 0.76 C0.1 0.86 0.12 0.94 0.18 1 L1 1 L1 0 Z"/>
        </clipPath>
      </defs></svg>
      <div class="agl-fold">
        <div class="agl-visual">
          <span class="ag-lava" aria-hidden="true">${SECTIONS.map((s, i) => `<i class="ag-blob ${s.id}${i === 0 ? ' on' : ''}"></i>`).join('')}</span>
          <form class="auth-box" autocomplete="on">
            <div class="auth-mark" aria-hidden="true">${LOGO_IMG}</div>
            <h2>Vítej zpět</h2>
            <p>Pro pokračování zadej rodinné heslo.</p>
            <label for="auth-password">Heslo</label>
            <input id="auth-password" type="password" autocomplete="current-password">
            <label class="auth-check"><input id="auth-remember" type="checkbox"> Zapamatovat na tomto zařízení</label>
            <button type="submit">Odemknout</button>
            <div class="auth-msg" id="auth-msg">${message || ''}</div>
          </form>
          <div class="agl-how" aria-hidden="true">
            ${['fin', 'aut', 'byd'].map(id => { const s = SECTIONS.find(x => x.id === id); return `
            <button type="button" class="agh-bub ${s.id}" data-go-auth>
              <strong>${s.name}</strong>
              <p>${s.desc}</p>
            </button>`; }).join('')}
          </div>
        </div>
        <header class="agl-top">
          <span class="ag-mark" aria-hidden="true">${LOGO_IMG}</span><span class="agl-wm">Naše</span>
          <button type="button" class="agl-mini" data-go-auth>Můj plán</button>
        </header>
        <section class="agl-hero">
          <div class="agl-copy">
            <h1>Plánujeme náš společný život.</h1>
            <p class="agl-lead">Vše na jednom místě — bydlení, auto i rozpočet. Přehledně. Společně. S klidem.</p>
            <div class="agl-actions">
              <button type="button" class="agl-cta" data-go-auth>Otevřít můj plán</button>
              <button type="button" class="agl-ghost" data-go-how>Jak to funguje ${icon('<path d="M5 12h14M13 6l6 6-6 6"/>', 2)}</button>
            </div>
            <p class="agl-note">${icon('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', 2)} Vytvořeno pro nás · soukromý přehled</p>
          </div>
        </section>
      </div>
      `;
    document.body.appendChild(gate);

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const blobs = gate.querySelectorAll('.ag-blob');
    let idx = 0;
    let timer = 0;
    if (!reduced) {
      timer = setInterval(() => {
        idx = (idx + 1) % blobs.length;
        blobs.forEach((b, j) => b.classList.toggle('on', j === idx));
        gate.style.setProperty('--gp', SECTIONS[idx].color);
      }, 5200);
    }
    const how = gate.querySelector('.agl-how');
    const openAuth = () => {
      gate.classList.remove('how-open');
      how.setAttribute('aria-hidden', 'true');
      gate.classList.add('auth-open');
      sessionStorage.setItem('nase.gate.auth', '1');
      setTimeout(() => { const p = gate.querySelector('#auth-password'); if (p) p.focus(); }, 460);
    };
    const openHow = () => {
      gate.classList.remove('auth-open');
      gate.classList.add('how-open');
      how.setAttribute('aria-hidden', 'false');
      sessionStorage.removeItem('nase.gate.auth');
    };
    gate.querySelectorAll('[data-go-auth]').forEach(b => b.addEventListener('click', openAuth));
    gate.querySelectorAll('[data-go-how]').forEach(b => b.addEventListener('click', openHow));
    if (message || sessionStorage.getItem('nase.gate.auth') === '1') gate.classList.add('auth-open');

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
