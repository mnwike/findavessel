/* Supplier request form. The request is emailed to the FindAVessel desk, which passes it to the supplier. */
(function () {
  var KEY = 'findavessel.requests';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  document.addEventListener('submit', function (ev) {
    var f = ev.target.closest && ev.target.closest('[data-request-form]'); if (!f) return;
    ev.preventDefault();
    var d = {}; new FormData(f).forEach(function (v, k) { d[k] = v; });
    d.slug = f.getAttribute('data-slug'); d.supplier = f.getAttribute('data-name'); d.at = Date.now();
    try { var all = JSON.parse(localStorage.getItem(KEY) || '[]'); all.push(d); localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* storage unavailable */ }
    var claim = 'findavessel.com/#/join?claim=' + d.slug;
    var mail = 'Subject: ' + d.company + ' is asking ' + d.supplier + ' for a quote\n\n' +
      'Hello,\n\n' + d.name + ' at ' + d.company + ' has sent ' + d.supplier + ' a request through FindAVessel.\n\n' +
      'What they need: ' + d.need + '\n' + (d.port ? 'Where: ' + d.port + '\n' : '') + (d.date ? 'Needed by: ' + d.date + '\n' : '') + (d.vessel ? 'Vessel: ' + d.vessel + '\n' : '') +
      '\nReply to them directly at ' + d.email + '.\n\n' +
      'Why you received this: ' + d.supplier + ' has a free listing in the FindAVessel supplier directory, built from public sources. ' +
      'Claim it to confirm your details, list your services and ports, and receive requests in one place: ' + claim + '\n\n' +
      'If you would rather not be listed or contacted, remove the listing here: findavessel.com/remove/' + d.slug + '\n\n' +
      'FindAVessel, [registered company name and postal address]';
    var btn = f.querySelector('button'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    var done = function (ok) {
      f.outerHTML = ok ? '<div class="notice notice-ok"><p><strong>Request received.</strong> We will pass it to ' + esc(d.supplier) + ' and you will hear back by email at ' + esc(d.email) + '.</p></div>'
        : '<div class="notice"><p><strong>That did not send.</strong> Check your connection and try again, or use the enquiry form on any page.</p></div>';
    };
    if (!window.fvNotify) return done(false);
    window.fvNotify('supplier request for ' + d.supplier, { Supplier: d.supplier, 'Supplier profile': 'https://findavessel.com/providers/' + d.slug + '.html', Need: d.need, Port: d.port, 'Needed by': d.date, Vessel: d.vessel,
      Company: d.company, Name: d.name, Email: d.email, 'Email to forward to the supplier': mail }).then(done);
  });
})();
