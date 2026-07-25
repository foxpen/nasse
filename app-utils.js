(function () {
  function esc(value) {
    return String(value == null ? '' : value).replace(/[<>&"']/g, c => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function jsstr(value) {
    return JSON.stringify(String(value == null ? '' : value));
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch (e) {
      return '';
    }
  }

  function openUrl(value) {
    const url = safeUrl(value);
    if (url) window.open(url, '_blank', 'noopener');
  }

  // české skloňování počtů: plural(1,'vůz','vozy','vozů') → 'vůz'
  function plural(n, one, few, many) {
    n = Math.abs(Number(n) || 0);
    return n === 1 ? one : (n >= 2 && n <= 4 ? few : many);
  }

  // "1000000" -> 1000000 (číslo bez mezer/textu)
  function parseThousands(value) {
    const n = Number(String(value == null ? '' : value).replace(/\D/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  // živé formátování inputu na "1 000 000" při psaní
  function wireThousands(input) {
    if (!input || input.dataset.thousandsWired) return;
    input.dataset.thousandsWired = '1';
    const reformat = () => {
      const raw = input.value.replace(/\D/g, '');
      input.value = raw ? Number(raw).toLocaleString('cs-CZ') : '';
    };
    input.addEventListener('input', reformat);
    reformat();
  }

  // zavolej po vlození modalu do DOM, obslouzi vsechny .fmt-thousands inputy najednou
  function wireThousandsAll(root) {
    (root || document).querySelectorAll('.fmt-thousands').forEach(wireThousands);
  }

  function initThemeToggle() {
    const labels = { system: 'Systém', light: 'Světlý', dark: 'Tmavý' };
    const icons = {
      system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
      light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
      dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 7 7 0 1 0 20.5 14.5Z"/></svg>'
    };
    const apply = mode => {
      if (mode === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.dataset.theme = mode;
      localStorage.setItem('nase.theme', mode);
      document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
        btn.innerHTML = icons[mode] || icons.system;
        btn.title = labels[mode] || labels.system;
        btn.setAttribute('aria-label', 'Motiv: ' + (labels[mode] || labels.system));
      });
    };
    let mode = localStorage.getItem('nase.theme') || 'system';
    apply(mode);
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        mode = mode === 'system' ? 'light' : (mode === 'light' ? 'dark' : 'system');
        apply(mode);
      });
    });
  }

  let toastTimer = null;
  function toast(message, type = 'ok', opts = {}) {
    let t = document.getElementById('app-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'app-toast';
      t.className = 'app-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.innerHTML = '<span id="app-toast-text"></span><button type="button" id="app-toast-action" hidden></button>';
      document.body.appendChild(t);
    }
    t.classList.toggle('err', type === 'err');
    t.querySelector('#app-toast-text').textContent = message;
    const actionBtn = t.querySelector('#app-toast-action');
    if (opts.actionLabel && opts.onAction) {
      actionBtn.hidden = false;
      actionBtn.textContent = opts.actionLabel;
      actionBtn.onclick = () => { opts.onAction(); hideToast(); };
    } else {
      actionBtn.hidden = true;
      actionBtn.onclick = null;
    }
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, opts.duration || (type === 'err' ? 5000 : 3500));
  }
  function hideToast() {
    const t = document.getElementById('app-toast');
    if (t) t.classList.remove('on');
  }

  function confirmModal({ title = 'Opravdu?', message = '', confirmLabel = 'Ano, smazat', cancelLabel = 'Zrušit', danger = true } = {}) {
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-bg';
      wrap.innerHTML = `<div class="modal" style="max-width:440px">
        <button class="modal-x" type="button" id="cf-x" aria-label="Zavřít">×</button>
        <h3>${esc(title)}</h3>
        ${message ? `<p class="hint">${esc(message)}</p>` : ''}
        <div class="actions">
          <button class="btn-ghost" type="button" id="cf-cancel">${esc(cancelLabel)}</button>
          <button class="${danger ? 'btn-add danger-action' : 'btn-add'}" type="button" id="cf-ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;
      document.body.appendChild(wrap);
      const finish = value => { wrap.remove(); resolve(value); };
      wrap.querySelector('#cf-x').onclick = () => finish(false);
      wrap.querySelector('#cf-cancel').onclick = () => finish(false);
      wrap.querySelector('#cf-ok').onclick = () => finish(true);
      wrap.addEventListener('click', e => { if (e.target === wrap) finish(false); });
      wrap.querySelector('#cf-ok').focus();
    });
  }

  window.Nase = { esc, jsstr, safeUrl, openUrl, plural, initThemeToggle, toast, confirmModal, parseThousands, wireThousands, wireThousandsAll };
})();
