/* FindAVessel prototype: state, helpers, shell and router. */
'use strict';

/* ---------- State (kept in the browser only) ---------- */
const KEY = 'findavessel.prototype.v1';
let S;
function seed() {
  const s = JSON.parse(JSON.stringify(SAMPLE));
  s.role = 'guest';
  s.me = { charterer: 'c-orrin', owner: 'o-brannoch', broker: 'b-calder', desk: 'desk' };
  s.passport = {}; s.filters = { cargo: {}, vessel: {} }; s.draft = {}; s.seq = 100;
  return s;
}
function load() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable: state lives in memory */ } }
S = load() || seed();
const nid = p => p + (++S.seq);

/* ---------- Helpers ---------- */
const $ = (q, el = document) => el.querySelector(q);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 2 });
const usd = n => 'USD ' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dstr(d) { if (!d) return ''; const x = new Date(d); return x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()]; }
function dlong(d) { if (!d) return ''; const x = new Date(d); return x.getUTCDate() + ' ' + MONTHS[x.getUTCMonth()] + ' ' + x.getUTCFullYear(); }
function dtime(t) { const x = new Date(t); return dstr(t) + ', ' + String(x.getUTCHours()).padStart(2, '0') + ':' + String(x.getUTCMinutes()).padStart(2, '0') + ' UTC'; }
const laycan = (a, b) => dstr(a) + ' to ' + dstr(b);
function until(t) {
  const ms = t - Date.now(); if (ms <= 0) return 'expired';
  const h = Math.floor(ms / HOUR), m = Math.floor(ms % HOUR / 6e4);
  return h >= 48 ? Math.round(h / 24) + ' days' : h >= 1 ? h + ' h ' + m + ' min' : m + ' min';
}
function ago(t) { const h = (Date.now() - t) / HOUR; return h < 1 ? 'just now' : h < 24 ? Math.floor(h) + ' h ago' : Math.floor(h / 24) + ' d ago'; }
const co = id => S.companies.find(c => c.id === id) || { name: 'Unknown', country: '', level: 0, role: '' };
const myId = () => S.me[S.role];
const me = () => co(myId());
const vessel = id => S.vessels.find(v => v.id === id);
const cargoById = id => S.cargoes.find(c => c.id === id);
const ROLE_NAME = { guest: 'Visitor', charterer: 'Cargo owner', owner: 'Vessel owner', broker: 'Broker', desk: 'Desk' };
const sizeStr = v => num(v.size) + ' ' + SEG[v.seg].metric;
const vclass = v => classify(v.seg, v.subtype, v.size);
function rateStr(o) {
  if (o.rateType === 'USD per tonne') return 'USD ' + num(o.rate) + ' per tonne';
  if (o.rateType === 'USD per day') return usd(o.rate) + ' per day';
  if (o.rateType === 'Worldscale') return 'WS ' + num(o.rate);
  return usd(o.rate) + ' lumpsum';
}
function grossFreight(t) {
  if (t.rateType === 'USD per tonne') return t.rate * t.qty;
  if (t.rateType === 'Lumpsum USD') return Number(t.rate);
  return null; /* Worldscale and daily hire need more inputs than this prototype holds */
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200);
}
function formData(form) {
  const o = {}, x = {};
  new FormData(form).forEach((v, k) => {
    if (k.startsWith('x_')) x[k.slice(2)] = v;
    else if (k.endsWith('[]')) (o[k.slice(0, -2)] = o[k.slice(0, -2)] || []).push(v);
    else o[k] = v;
  });
  o.x = x; return o;
}

/* IMO numbers carry a check digit: the first six digits weighted 7 to 2, summed; last digit of the sum is digit seven. */
function imoValid(v) {
  if (!/^\d{7}$/.test(v || '')) return false;
  const d = v.split('').map(Number);
  return (d[0] * 7 + d[1] * 6 + d[2] * 5 + d[3] * 4 + d[4] * 3 + d[5] * 2) % 10 === d[6];
}

/* ---------- Small components ---------- */
/* Passport level drawn as hull draught marks: seven rungs, filled to the level reached. */
function marks(level, big) {
  let r = '';
  for (let i = 7; i >= 1; i--) r += `<i class="${i <= level ? 'on' : ''}"></i>`;
  return `<span class="marks${big ? ' marks-big' : ''}" role="img" aria-label="Passport level ${level} of 7">${r}</span>`;
}
function passportChip(c) {
  const st = c.verified === 'verified' ? 'Verified' : c.verified === 'review' ? 'In review' : 'Unverified';
  return `<span class="pp pp-${c.verified}">${marks(c.level)}<span>${st}, level ${c.level}</span></span>`;
}
function tag(text, kind) { return `<span class="tag${kind ? ' tag-' + kind : ''}">${esc(text)}</span>`; }
function plimsoll(size) {
  return `<svg class="plimsoll" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M4 20h32" stroke="currentColor" stroke-width="2.6"/><path d="M20 3v6M20 31v6" stroke="currentColor" stroke-width="2.6"/></svg>`;
}
function field(f, val, opt = {}) {
  const name = (opt.prefix || '') + f.k, id = 'f_' + name;
  const req = f.req ? ' required' : '';
  let ctl;
  if (f.t === 'select') {
    ctl = `<select id="${id}" name="${name}"${req}${f.live ? ` data-live="${f.live}"` : ''}>${f.blank ? `<option value="">${esc(f.blank)}</option>` : ''}${f.o.map(o => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}"${String(val) === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  } else if (f.t === 'textarea') {
    ctl = `<textarea id="${id}" name="${name}" rows="3" placeholder="${esc(f.ph || '')}"${req}>${esc(val)}</textarea>`;
  } else {
    ctl = `<input id="${id}" name="${name}" type="${f.t || 'text'}" value="${esc(val)}" placeholder="${esc(f.ph || '')}"${f.step ? ` step="${f.step}"` : f.t === 'number' ? ' step="any"' : ''}${f.min != null ? ` min="${f.min}"` : ''}${f.list ? ` list="${f.list}"` : ''}${req}${f.live ? ` data-live="${f.live}"` : ''} autocomplete="off">`;
  }
  return `<div class="field${f.wide ? ' wide' : ''}"><label for="${id}">${esc(f.l)}${f.req ? '' : ' <small>optional</small>'}</label>${ctl}${f.hint ? `<p class="hint" id="${id}_hint">${f.hint}</p>` : ''}</div>`;
}
const portList = () => `<datalist id="ports">${PORTS.map(p => `<option value="${esc(p.name)}">${esc(p.country)}</option>`).join('')}</datalist>`;
function kv(rows) { return `<dl class="kv">${rows.filter(r => r && r[1] !== '' && r[1] != null).map(r => `<div><dt>${esc(r[0])}</dt><dd>${r[2] ? r[1] : esc(r[1])}</dd></div>`).join('')}</dl>`; }
function empty(title, text, cta) { return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${cta || ''}</div>`; }
function needRole(roles, what) {
  if (roles.includes(S.role)) return '';
  return `<div class="notice"><p><strong>${esc(what)}</strong> is for ${roles.map(r => ROLE_NAME[r].toLowerCase() + 's').join(' and ')}. You are viewing as ${ROLE_NAME[S.role].toLowerCase()}.</p>
    <div class="row">${roles.map(r => `<button class="btn" data-act="role" data-role="${r}">View as ${ROLE_NAME[r].toLowerCase()}</button>`).join('')}</div></div>`;
}

/* ---------- Shell ---------- */
const NAV = [['cargoes', 'Cargoes'], ['vessels', 'Vessels'], ['deals', 'Deals'], ['passport', 'Passport']];
const THEME_BTN = `<button class="theme-btn" data-theme-toggle aria-label="Switch between dark and light theme"><svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg><svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><span>Theme</span></button>`;
function shell(route) {
  const top = route.split('/')[0];
  const c = S.role === 'guest' ? null : me();
  const postHref = S.role === 'owner' ? '#/post/vessel' : '#/post/cargo';
  const postLabel = S.role === 'owner' ? 'List a vessel' : 'Post a cargo';
  return `
  <div class="demo-bar">Prototype with sample data. The companies, ships, cargoes and payments shown are invented and nothing here is a live offer.</div>
  <header class="top">
    <a class="brand" href="#/">${plimsoll(26)}<span>FindAVessel</span></a>
    <nav class="nav" aria-label="Main">${NAV.map(n => `<a href="#/${n[0]}"${top === n[0] || (n[0] === 'cargoes' && top === 'cargo') || (n[0] === 'vessels' && top === 'vessel') || (n[0] === 'deals' && top === 'deal') ? ' aria-current="page"' : ''}>${n[1]}</a>`).join('')}<a href="guides.html">Guides</a><a href="tools.html">Tools</a>${S.role === 'desk' ? `<a href="#/desk"${top === 'desk' ? ' aria-current="page"' : ''}>Desk</a>` : ''}</nav>
    <div class="top-right">
      ${THEME_BTN}
      <label class="role"><span>Viewing as</span>
        <select data-live="roleSelect" aria-label="Viewing as">${Object.keys(ROLE_NAME).map(r => `<option value="${r}"${S.role === r ? ' selected' : ''}>${ROLE_NAME[r]}</option>`).join('')}</select>
      </label>
      ${S.role === 'guest' ? `<a class="btn btn-primary" href="#/join">Create an account</a>` : S.role === 'desk' ? '' : S.role === 'broker' ? `<a class="btn btn-primary" href="#/cargoes">Find cargoes</a>` : `<a class="btn btn-primary" href="${postHref}">${postLabel}</a>`}
    </div>
  </header>
  ${c ? `<div class="whoami"><span>${esc(c.name)}</span>${passportChip(c)}<span class="who-links"><a href="#/passport">Passport</a> <a href="#/desk">My desk</a></span></div>` : ''}
  <main id="main" tabindex="-1"></main>
  <footer class="foot">
    <div><strong>FindAVessel</strong><p>Whole-ship charters for owners, cargo interests and brokers who are new to each other.</p></div>
    <div><strong>Platform</strong><a href="#/cargoes">Cargoes</a><a href="#/vessels">Vessels</a><a href="#/guide/safeguards">Safeguards</a><a href="#/guide/payments">How payment works</a><a href="#/join">Create an account</a></div>
    <div><strong>Learn</strong><a href="guides.html">Chartering guides</a><a href="ship-sizes.html">Ship sizes</a><a href="tools.html">Calculators</a><a href="what-is-demurrage.html">What is demurrage</a><a href="how-to-charter-a-ship.html">How to charter a ship</a></div>
    <div><p>Prototype build. No regulated service is offered here: payments, sanctions screening and document checks are simulated.</p><button class="link" data-act="reset">Reset the sample data</button></div>
  </footer>
  <nav class="tabbar" aria-label="Main, mobile">${NAV.slice(0, 3).map(n => `<a href="#/${n[0]}"${top === n[0] ? ' aria-current="page"' : ''}>${n[1]}</a>`).join('')}<a href="guides.html">Guides</a><a href="#/desk"${top === 'desk' ? ' aria-current="page"' : ''}>Desk</a></nav>
  <div id="toast" role="status" hidden></div>`;
}

/* ---------- Router ---------- */
const ROUTES = [];
const route = (pattern, fn) => ROUTES.push([new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), fn]);
const ACT = {}, FORM = {}, LIVE = {};
function go(path) { if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; }
function render() {
  const path = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  let html = null;
  for (const [re, fn] of ROUTES) { const m = path.match(re); if (m) { html = fn(...m.slice(1)); break; } }
  if (html == null) html = `<section class="page">${empty('Page not found', 'That address does not match anything here.', '<a class="btn" href="#/">Go to the start</a>')}</section>`;
  document.getElementById('app').innerHTML = shell(path);
  $('#main').innerHTML = html;
  document.title = ($('#main h1') ? $('#main h1').textContent + ' | ' : '') + 'FindAVessel';
  if (render.last !== path) { window.scrollTo(0, 0); render.last = path; }
  document.querySelectorAll('[data-init]').forEach(el => LIVE[el.dataset.init] && LIVE[el.dataset.init](el));
}
window.addEventListener('hashchange', render);
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el.dataset, el); }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-form]'); if (!f) return;
  e.preventDefault(); const fn = FORM[f.dataset.form]; if (fn) fn(formData(f), f);
});
['input', 'change'].forEach(evt => document.addEventListener(evt, e => {
  const el = e.target.closest('[data-live]'); if (!el) return;
  if (evt === 'input' && el.tagName === 'SELECT') return;
  const fn = LIVE[el.dataset.live]; if (fn) fn(el, evt);
}));

ACT.role = d => { S.role = d.role; save(); render(); toast('Viewing as ' + ROLE_NAME[S.role].toLowerCase()); };
LIVE.roleSelect = el => ACT.role({ role: el.value });
ACT.reset = () => { try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ } S = seed(); go(''); toast('Sample data reset'); };
ACT.go = d => go(d.to);
