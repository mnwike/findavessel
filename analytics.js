/* FindAVessel analytics: Google Analytics 4 with consent mode.
   What is recorded: pages and app views, searches, filters, map and port choices, calculator use, listing views,
   form progress by field name, enquiries and supplier requests by type and route, scroll depth, clicks on main buttons.
   What is never sent: names, email addresses, phone numbers, company names or free-text messages. */
(function () {
  var ID = 'G-CMC1PH7DLF', CKEY = 'findavessel.consent';
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = gtag;
  var choice = null;
  try { choice = localStorage.getItem(CKEY); } catch (e) {}
  // Until the visitor agrees, no analytics cookies are set; Google receives cookieless pings only.
  gtag('consent', 'default', { analytics_storage: choice === 'yes' ? 'granted' : 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('js', new Date());
  var path = location.pathname.replace(/\/index\.html$/, '/');
  var app = /\/$/.test(path);  // the marketplace app is the home document
  function group() {
    if (app) return 'App';
    if (/\/providers\//.test(path)) return 'Supplier profile';
    if (/suppliers/.test(path)) return 'Supplier directory';
    if (/ports/.test(path)) return 'Ports';
    if (/calculator|estimator|tools/.test(path)) return 'Tools';
    if (/faq|privacy/.test(path)) return 'Help';
    return 'Guides';
  }
  gtag('config', ID, { send_page_view: !app, content_group: group(), anonymize_ip: true });
  var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID; document.head.appendChild(s);

  // Strip anything that looks like personal data before a typed value is sent.
  function clean(v) {
    v = String(v == null ? '' : v).trim().slice(0, 80);
    if (/@|\d[\d\s().+-]{6,}\d/.test(v)) return '[removed]';
    return v;
  }
  function track(name, params) {
    var p = params || {}, out = {};
    for (var k in p) if (p[k] !== '' && p[k] != null) out[k] = typeof p[k] === 'string' ? clean(p[k]) : p[k];
    gtag('event', name, out);
  }
  window.fvTrack = track;
  function band(n) { n = Number(n); if (!n) return ''; var b = [1000, 5000, 10000, 25000, 40000, 60000, 85000, 120000, 200000]; for (var i = 0; i < b.length; i++) if (n < b[i]) return 'under ' + b[i]; return '200000 or more'; }

  // App views: each hash route counts as a page.
  function appView() {
    var route = location.hash.replace(/^#\/?/, '').split('?')[0] || 'home';
    var generic = route.replace(/\/(?:[a-z]-?[\w-]*\d[\w-]*|\d+)(?=\/|$)/g, '/:id');
    gtag('event', 'page_view', { page_title: document.title, page_location: location.origin + '/app/' + route, page_path: '/app/' + route, content_group: 'App', app_view: generic });
    var m = route.match(/^(vessel|cargo|enquiry)\/([\w-]+)$/);
    if (m && typeof S !== 'undefined') {
      try {
        if (m[1] === 'vessel') { var v = S.vessels.find(function (x) { return x.id === m[2]; }); if (v) track('view_item', { item_type: 'vessel', vessel_type: v.subtype, segment: v.seg, size_band: band(v.size), open_port: v.open, example: isExample(v) }); }
        else { var c = S.cargoes.find(function (x) { return x.id === m[2]; }); if (c) track('view_item', { item_type: 'cargo', cargo: c.cargo, segment: c.seg, quantity_band: band(c.qty), load_port: c.load, discharge_port: c.disch, example: isExample(c) }); }
      } catch (e) {}
    }
  }
  if (app) { window.addEventListener('hashchange', function () { setTimeout(appView, 60); }); window.addEventListener('load', function () { setTimeout(appView, 200); }); }
  else if (/\/providers\//.test(path)) {
    var crumbs = document.querySelectorAll('.crumbs a');
    track('view_item', { item_type: 'supplier', supplier: path.split('/').pop().replace('.html', ''), country: crumbs[1] ? crumbs[1].textContent : '' });
  }
  if (document.title.indexOf('Page not found') === 0) track('page_not_found', { missing: location.pathname });

  // Searches and filters. A search box is any search input, or a text input that is not part of a form.
  var timers = {};
  document.addEventListener('input', function (e) {
    var el = e.target; if (!el.matches) return;
    var isSearch = el.matches('input[type=search]') || (el.matches('input[type=text], input:not([type])') && !el.closest('form'));
    if (isSearch) {
      clearTimeout(timers[el.id]);
      timers[el.id] = setTimeout(function () { if (el.value.trim().length >= 3) track('search', { search_term: el.value.toLowerCase(), search_box: el.id || el.name || 'search', results: document.querySelectorAll('.lrow:not([hidden]), tbody tr:not([hidden])').length }); }, 1500);
      return;
    }
    var form = el.closest('form'); if (!form || form.getAttribute('data-form') === 'filter') return;
    var fname = form.getAttribute('data-form') || (form.hasAttribute('data-request-form') ? 'supplier_request' : '') || form.id || form.className.split(' ')[0] || 'form', field = el.name || el.id;
    if (!form._started) { form._started = {}; track('form_start', { form_name: fname, first_field: field }); }
    if (field && !form._started[field]) { form._started[field] = 1; track('form_field', { form_name: fname, field_name: field, fields_touched: Object.keys(form._started).length }); }
  }, true);
  document.addEventListener('change', function (e) {
    var el = e.target; if (!el.matches || !el.matches('select')) return;
    var form = el.closest('form'), label = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value;
    if (el.id === 'countryPick') return track('country_select', { country: label, method: 'list' });
    if (form && form.getAttribute('data-form') === 'filter') return track('filter_change', { board: form.getAttribute('data-kind'), filter_name: el.name, filter_value: label });
    if (!form || el.id === 'sc' || /^cf-/.test(el.id)) track('filter_change', { board: path.split('/').pop() || 'home', filter_name: el.id || el.name, filter_value: label });
  }, true);

  // Form results. Only non-personal fields are read.
  document.addEventListener('submit', function (e) {
    var f = e.target, fname = f.getAttribute('data-form') || f.id || (f.className || 'form').split(' ')[0], val = function (n) { return f.elements[n] ? f.elements[n].value : ''; };
    if (fname === 'filter') return;
    var p = { form_name: fname, fields_touched: f._started ? Object.keys(f._started).length : 0 };
    if (fname === 'enquiry') { p.segment = val('seg'); p.cargo = val('cargo'); p.quantity_band = band(val('qty')); p.load_port = val('load'); p.discharge_port = val('disch'); p.laycan_month = (val('from') || '').slice(0, 7); }
    var isReq = f.hasAttribute('data-request-form');
    if (isReq) { p.form_name = 'supplier_request'; p.supplier = f.getAttribute('data-slug'); p.port = val('port'); p.has_vessel = val('vessel') ? 'yes' : 'no'; p.need_length = val('need').length; }
    track('form_submit', p);
    if (fname === 'enquiry' || isReq) track('generate_lead', { lead_type: isReq ? 'supplier_request' : 'chartering_enquiry', segment: p.segment, load_port: p.load_port, discharge_port: p.discharge_port, supplier: p.supplier });
    if (fname === 'join') track('sign_up', { method: val('role') || 'account' });
  }, true);

  // Clicks: main buttons, role switch, map, ports, calculators, outbound and claim links.
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a, button, [data-act], path[data-cc], [data-country]') : null; if (!a) return;
    var text = (a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60), href = a.getAttribute('href') || '', act = a.getAttribute('data-act') || '';
    if (a.matches('path[data-cc], [data-country]')) return track('country_select', { country: a.getAttribute('data-name') || a.getAttribute('data-country') || a.getAttribute('data-cc'), method: 'map' });
    if (/claim=/.test(href)) return track('claim_profile_click', { supplier: (href.match(/claim=([^&]+)/) || [])[1] });
    if (/#\/enquire/.test(href)) return track('enquiry_cta_click', { label: text, from_page: path, load_port: (href.match(/load=([^&]+)/) || [])[1], discharge_port: (href.match(/disch=([^&]+)/) || [])[1] });
    if (/#\/(join|post)/.test(href)) return track('register_cta_click', { label: text, from_page: path });
    if (act) return track('app_action', { action: act, label: text, value: a.getAttribute('data-cc') || a.getAttribute('data-id') || a.getAttribute('data-role') || a.value || '' });
    if (a.matches('.btn')) return track('button_click', { label: text, destination: href, from_page: path });
    if (a.matches('.lrow')) return track('listing_click', { destination: href });
    if (a.closest('.related, .tiles, .tile')) track('related_click', { label: text, destination: href });
  }, true);
  document.addEventListener('change', function (e) { if (e.target.closest && e.target.closest('.calc') && /calculator|estimator|ship-sizes/.test(path) && !e.target.closest('.calc')._used) { e.target.closest('.calc')._used = 1; track('calculator_use', { tool: path.split('/').pop().replace('.html', '') || 'class finder', first_field: e.target.id }); } }, true);
  document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('.calc') && /calculator|estimator|ship-sizes/.test(path) && !e.target.closest('.calc')._used) { e.target.closest('.calc')._used = 1; track('calculator_use', { tool: path.split('/').pop().replace('.html', '') || 'class finder', first_field: e.target.id }); } }, true);
  document.addEventListener('copy', function () { var t = String(getSelection()).length; if (t > 20) track('text_copied', { length: t, from_page: path }); });

  // Reading depth and time on page.
  var marks = [25, 50, 75, 100], t0 = Date.now();
  window.addEventListener('scroll', function () {
    var h = document.documentElement, pct = (h.scrollTop + innerHeight) / h.scrollHeight * 100;
    while (marks.length && pct >= marks[0]) track('scroll_depth', { percent: marks.shift(), seconds: Math.round((Date.now() - t0) / 1000) });
  }, { passive: true });
  [30, 60, 180].forEach(function (sec) { setTimeout(function () { if (!document.hidden) track('time_on_page', { seconds: sec }); }, sec * 1000); });

  // Consent bar.
  if (!choice) {
    var bar = document.createElement('div');
    bar.className = 'ck'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Cookies');
    bar.innerHTML = '<p>We use Google Analytics to see which pages and tools are useful. May we set analytics cookies? <a href="' + (/\/providers\//.test(path) ? '../' : '') + 'privacy.html">Privacy</a></p><div><button class="btn btn-sm" data-ck="no" type="button">No thanks</button><button class="btn btn-sm btn-primary" data-ck="yes" type="button">Allow</button></div>';
    var add = function () { document.body.appendChild(bar); };
    if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
    bar.addEventListener('click', function (e) {
      var v = e.target.getAttribute('data-ck'); if (!v) return;
      try { localStorage.setItem(CKEY, v); } catch (err) {}
      if (v === 'yes') gtag('consent', 'update', { analytics_storage: 'granted' });
      track('consent_choice', { choice: v });
      bar.remove();
    });
  }
})();
