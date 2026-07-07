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

  window.Nase = { esc, jsstr, safeUrl, openUrl, initThemeToggle };
})();
