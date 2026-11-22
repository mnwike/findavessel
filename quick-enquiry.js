/* Quick enquiry panel. Slides in 15 seconds after a page opens, once per visitor.
   It is a corner panel, not a full-screen overlay, so the page stays readable behind it.
   Submissions are posted to a form-to-email relay that forwards them to the address below. */
(function () {
  var ENDPOINT = 'https://formsubmit.co/ajax/martin@nwike.com';
  var DELAY = 15000, KEY = 'findavessel.quick', SNOOZE_DAYS = 7;
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function blocked() {
    // Not on pages where the visitor is already filling in a form or working on a deal.
    return /^#\/(enquire|join|post|deal|desk|offer|cargo\/[^/]+\/offer)/.test(location.hash) || !!document.querySelector('#rq-form, form[data-form="enquiry"]');
  }
  function due() {
    if (state.sent) return false;
    if (state.closed && Date.now() - state.closed < SNOOZE_DAYS * 864e5) return false;
    return true;
  }
  var panel;
  function T(n, p) { if (window.fvTrack) window.fvTrack(n, p); }
  // A coarse label for what the enquiry is about; the text itself is never sent to analytics.
  function topic(t) { t = t.toLowerCase(); var k = [['tanker', /tanker|crude|diesel|gasoil|oil|bitumen|chemical/], ['bulk', /bulk|grain|wheat|coal|ore|bauxite|cement|clinker|fertili|urea|supramax|panamax|handy|capesize/], ['gas', /lpg|lng|propane|butane|ammonia|gas carrier/], ['container', /container|teu|feeder/], ['project', /project|heavy.?lift|breakbulk|multipurpose|mpp/], ['vehicles', /ro-?ro|car carrier|vehicles?/], ['supplier', /spare|chandler|repair|supply|supplier|provision/]]; var out = []; k.forEach(function (x) { if (x[1].test(t)) out.push(x[0]); }); if (/open |our vessel|my vessel|dwt/.test(t)) out.push('has ship'); return out.join(',') || 'other'; }
  function open(force) {
    if (panel || (!force && (!due() || blocked()))) return;
    if (!force && document.querySelector('.ck')) { setTimeout(open, 4000); return; }
    var busy = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (busy && !force) { setTimeout(open, 5000); return; }
    panel = document.createElement('aside');
    panel.className = 'qe'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-labelledby', 'qe-h');
    panel.innerHTML = '<button class="qe-x" type="button" aria-label="Close">×</button>' +
      '<h2 id="qe-h">Need a ship, or cargo for one?</h2>' +
      '<p class="qe-lede">Tell us in a line or two. A person reads every enquiry and replies as soon as we can, usually within one working day.</p>' +
      '<form class="qe-form" novalidate>' +
      '<div class="field"><label for="qe-msg">What do you need?</label><textarea id="qe-msg" name="enquiry" rows="3" required placeholder="30,000 t wheat, Constanta to Alexandria, early December. Or: 58,000 DWT Supramax open Singapore."></textarea></div>' +
      '<div class="qe-row"><div class="field"><label for="qe-name">Your name</label><input id="qe-name" name="name" autocomplete="name" required></div>' +
      '<div class="field"><label for="qe-phone">Phone <small>with country code</small></label><input id="qe-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="+44 …"></div></div>' +
      '<div class="field"><label for="qe-email">Email</label><input id="qe-email" name="email" type="email" autocomplete="email" required></div>' +
      '<input class="qe-hp" name="_honey" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<p class="qe-err" role="alert" hidden></p>' +
      '<button class="btn btn-primary qe-send" type="submit">Send enquiry</button>' +
      '<p class="fine">We use these details only to answer your enquiry. No mailing list.</p></form>';
    document.body.appendChild(panel);
    requestAnimationFrame(function () { panel.classList.add('qe-in'); });
    T('quick_enquiry_shown', { trigger: force ? 'manual' : 'timer' });
    panel.querySelector('.qe-x').addEventListener('click', function () { close(true); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(true); });
    panel.querySelector('form').addEventListener('submit', send);
  }
  function close(snooze) {
    if (!panel) return;
    if (snooze && !state.sent) { state.closed = Date.now(); save(); T('quick_enquiry_closed', {}); }
    panel.remove(); panel = null;
  }
  function send(e) {
    e.preventDefault();
    var f = e.target, err = f.querySelector('.qe-err'), btn = f.querySelector('.qe-send');
    var v = { name: f.name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), enquiry: f.enquiry.value.trim() };
    function fail(msg, el) { err.textContent = msg; err.hidden = false; if (el) el.focus(); }
    if (!v.enquiry) return fail('Tell us what you need, even in a few words.', f.enquiry);
    if (!v.name) return fail('Add your name so we know who to reply to.', f.name);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return fail('That email address does not look complete.', f.email);
    if (f._honey.value) return close(false);
    err.hidden = true; btn.disabled = true; btn.textContent = 'Sending…';
    var body = { _subject: 'FindAVessel enquiry from ' + v.name, _template: 'table', _replyto: v.email, _captcha: 'false',
      Name: v.name, Email: v.email, Phone: v.phone || 'Not given', Enquiry: v.enquiry, Page: location.href, Sent: new Date().toString() };
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || String(j.success) === 'false') throw new Error(j.message || 'not sent'); }); })
      .then(function () {
        state.sent = Date.now(); save();
        T('quick_enquiry_sent', { has_phone: v.phone ? 'yes' : 'no', words: v.enquiry.split(/\s+/).length, topic: topic(v.enquiry) });
        T('generate_lead', { lead_type: 'quick_enquiry', topic: topic(v.enquiry) });
        panel.innerHTML = '<button class="qe-x" type="button" aria-label="Close">×</button><h2 id="qe-h">Enquiry sent</h2>' +
          '<p class="qe-lede">Thank you, ' + esc(v.name.split(' ')[0]) + '. Your enquiry has reached us and we will reply to ' + esc(v.email) + ' as soon as we can, usually within one working day.</p>' +
          '<p class="fine">To give owners the full picture now, you can also <a href="' + (document.querySelector('#app') ? '' : (/\/providers\//.test(location.pathname) ? '../' : '') + 'index.html') + '#/enquire">add ports, dates and quantities</a>.</p>';
        panel.querySelector('.qe-x').addEventListener('click', function () { close(false); });
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Send enquiry';
        T('quick_enquiry_error', {});
        fail('That did not send. Check your connection and try again. Your text is still here.');
      });
  }
  window.quickEnquiry = function () { open(true); };
  setTimeout(open, DELAY);
})();
