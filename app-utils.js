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

  window.Nase = { esc, jsstr, safeUrl, openUrl };
})();
