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

  function showLogin(message) {
    if (document.getElementById('auth-gate')) return;
    const gate = el('div', 'auth-gate');
    gate.id = 'auth-gate';
    gate.innerHTML = `
      <form class="auth-box" autocomplete="on">
        <div class="auth-mark" aria-hidden="true">Naše</div>
        <h2>Soukromý přehled</h2>
        <p>Pro pokračování zadej heslo.</p>
        <label>Heslo</label>
        <input id="auth-password" type="password" autocomplete="current-password" autofocus>
        <label class="auth-check"><input id="auth-remember" type="checkbox"> Zapamatovat na tomto zařízení</label>
        <button type="submit">Odemknout</button>
        <div class="auth-msg" id="auth-msg">${message || ''}</div>
      </form>`;
    document.body.appendChild(gate);

    const form = gate.querySelector('form');
    const msg = gate.querySelector('#auth-msg');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      msg.textContent = '';
      const button = form.querySelector('button');
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
