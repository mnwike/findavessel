/* Supplier request form. Prototype: the request is kept in this browser and the notification email is shown, not sent. */
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
    f.outerHTML = '<div class="notice notice-ok"><p><strong>Request recorded.</strong> This is a prototype, so nothing has been sent. In the live service ' + esc(d.supplier) + ' would now receive this email:</p></div><pre class="recap">' + esc(mail) + '</pre>';
  });
})();
