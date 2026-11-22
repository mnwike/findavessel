/* Sets the theme before first paint and handles the switch. Shared by the app and the static pages.
   Theme test: a first-time visitor is given light or dark at random (half each) and keeps it on later visits.
   A visitor who uses the switch gets what they chose; the original assignment is still remembered for the comparison. */
(function () {
  var KEY = 'findavessel.theme', AB = 'findavessel.ab.theme', t = null, variant = null, switched = false;
  try { t = localStorage.getItem(KEY); variant = localStorage.getItem(AB); } catch (e) { /* storage unavailable */ }
  if (variant !== 'dark' && variant !== 'light') {
    if (t === 'dark' || t === 'light') variant = 'preset';          // chose a theme before the test began: not part of it
    else { variant = Math.random() < .5 ? 'dark' : 'light'; }
    try { localStorage.setItem(AB, variant); } catch (e) { /* assignment lasts for this page only */ }
  }
  if (t === 'dark' || t === 'light') switched = variant !== 'preset' && t !== variant;
  else t = variant;
  var root = document.documentElement;
  function apply() { root.setAttribute('data-theme', t); var m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#040B13' : '#0A1C2E'; }
  function publish() { window.fvTheme = { variant: variant, shown: t, switched: switched }; }
  apply(); publish();
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-theme-toggle]'); if (!b) return;
    var from = t;
    t = t === 'dark' ? 'light' : 'dark'; switched = variant !== 'preset' && t !== variant; apply(); publish();
    try { localStorage.setItem(KEY, t); } catch (err) { /* stays for this visit only */ }
    if (window.fvThemeChanged) window.fvThemeChanged(from, t);
  });
})();
