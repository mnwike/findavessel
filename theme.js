/* Sets the theme before first paint and handles the switch. Shared by the app and the static pages. */
(function () {
  var KEY = 'findavessel.theme', t = null;
  try { t = localStorage.getItem(KEY); } catch (e) { /* storage unavailable */ }
  if (t !== 'dark' && t !== 'light') t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var root = document.documentElement;
  function apply() { root.setAttribute('data-theme', t); var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#040B13' : '#0A1C2E'; }
  apply();
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]'); if (!b) return;
    t = t === 'dark' ? 'light' : 'dark'; apply();
    try { localStorage.setItem(KEY, t); } catch (err) { /* stays for this visit only */ }
  });
})();
