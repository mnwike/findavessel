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
const ROLE_NAME = { guest: 'Visitor', charterer: 'Cargo owner', owner: 'Vessel owner', broker: 'Broker', supplier: 'Supplier', desk: 'Desk' };
/* Supplier accounts were added after the first release: give older saved states the sample one. */
if (!S.me.supplier) {
  S.me.supplier = 's-larkhill';
  if (!S.companies.find(c => c.id === 's-larkhill')) S.companies.push({ id: 's-larkhill', name: 'Larkhill Marine Supply', role: 'supplier', country: 'United Kingdom', since: 2026, verified: 'review', level: 2, fixtures: 0, respH: 4, about: 'Sample ship chandler and deck stores supplier.', claim: 'sample' });
}
const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function supplierLink(port) {
  const c = PORT[port] && PORT[port].country, sl = slugify(c);
  return c && typeof SUPPLIER_COUNTRIES !== 'undefined' && SUPPLIER_COUNTRIES[sl] ? `<a href="suppliers-${sl}.html">${SUPPLIER_COUNTRIES[sl].toLocaleString('en-GB')} marine suppliers in ${esc(c)}</a>` : '';
}
function requests() { try { return JSON.parse(localStorage.getItem('findavessel.requests') || '[]'); } catch (e) { return []; } }
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
  return `<svg class="plimsoll" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20h30l-3.5 10h-23zM20 20v10M13 20v-8h14v8M20 12V5"/><path d="M4 36q4-3 8 0t8 0 8 0 8 0"/></svg>`;
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
const NAV = [['cargoes', 'Board'], ['vessels', 'Vessels'], ['deals', 'Deals'], ['passport', 'Passport']];
const THEME_BTN = `<button class="theme-btn" data-theme-toggle aria-label="Switch between dark and light theme"><svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg><svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><span>Theme</span></button>`;
function shell(route) {
  const top = route.split('/')[0];
  const c = S.role === 'guest' ? null : me();
  const postHref = S.role === 'owner' ? '#/post/vessel' : '#/post/cargo';
  const postLabel = S.role === 'owner' ? 'List a vessel' : 'Post a cargo';
  return `
  <div class="demo-bar">Prototype with sample data. The companies, ships, cargoes and payments shown are invented and nothing here is a live offer.</div>
  <header class="top">
    <a class="brand" href="#/">${plimsoll(28)}<span>FindAVessel</span></a>
    <nav class="nav" aria-label="Main">${NAV.map(n => `<a href="#/${n[0]}"${top === n[0] || (n[0] === 'cargoes' && top === 'cargo') || (n[0] === 'vessels' && top === 'vessel') || (n[0] === 'deals' && top === 'deal') ? ' aria-current="page"' : ''}>${n[1]}</a>`).join('')}<a href="ports.html">Ports</a><a href="suppliers.html">Suppliers</a><a href="guides.html">Guides</a><a href="tools.html">Tools</a>${S.role === 'desk' ? `<a href="#/desk"${top === 'desk' ? ' aria-current="page"' : ''}>Desk</a>` : ''}</nav>
    <div class="top-right">
      ${THEME_BTN}
      <label class="role"><span>Viewing as</span>
        <select data-live="roleSelect" aria-label="Viewing as">${Object.keys(ROLE_NAME).map(r => `<option value="${r}"${S.role === r ? ' selected' : ''}>${ROLE_NAME[r]}</option>`).join('')}</select>
      </label>
      ${S.role === 'guest' ? `<a class="btn btn-primary" href="#/enquire">Leave an enquiry</a>` : S.role === 'desk' ? '' : S.role === 'supplier' ? `<a class="btn btn-primary" href="#/desk">Requests</a>` : S.role === 'broker' ? `<a class="btn btn-primary" href="#/cargoes">Find cargoes</a>` : `<a class="btn btn-primary" href="${postHref}">${postLabel}</a>`}
    </div>
  </header>
  ${c ? `<div class="whoami"><span>${esc(c.name)}</span>${passportChip(c)}<span class="who-links"><a href="#/passport">Passport</a> <a href="#/desk">My desk</a></span></div>` : ''}
  <main id="main" tabindex="-1"></main>
  <footer class="foot">
    <div><strong>FindAVessel</strong><p>Whole-ship charters for owners, cargo interests and brokers who are new to each other.</p></div>
    <div><strong>Platform</strong><a href="#/enquire">Leave an enquiry</a><a href="#/cargoes">Enquiry board</a><a href="#/vessels">Vessels</a><a href="ports.html">Ports by country</a><a href="suppliers.html">Supplier directory</a><a href="#/guide/safeguards">Safeguards</a><a href="#/guide/payments">How payment works</a><a href="#/join">Create an account</a></div>
    <div><strong>Learn</strong><a href="guides.html">Chartering guides</a><a href="ship-sizes.html">Ship sizes</a><a href="tools.html">Calculators</a><a href="what-is-demurrage.html">What is demurrage</a><a href="how-to-charter-a-ship.html">How to charter a ship</a><a href="faq.html">Questions and answers</a></div>
    <div><p>Prototype build. No regulated service is offered here: payments, sanctions screening and document checks are simulated.</p><p>© 2026 FindAVessel. All rights reserved.</p><button class="link" data-act="reset">Reset the sample data</button></div>
  </footer>
  <nav class="tabbar" aria-label="Main, mobile">${NAV.slice(0, 3).map(n => `<a href="#/${n[0]}"${top === n[0] ? ' aria-current="page"' : ''}>${n[1]}</a>`).join('')}<a href="guides.html">Guides</a><a href="#/desk"${top === 'desk' ? ' aria-current="page"' : ''}>Desk</a></nav>
  <div id="toast" role="status" hidden></div>`;
}

/* ---------- Router ---------- */
const ROUTES = [];
const route = (pattern, fn) => ROUTES.push([new RegExp('^' + pattern.replace(/:\w+/g, '([^/]+)') + '$'), fn]);
const ACT = {}, FORM = {}, LIVE = {};
function go(path) { if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; }

/* Title and description formulas. Every view gets a title of at most 60 characters and a description of at most 155,
   built from the listing itself: vessel name, type, size and open port; or cargo, quantity and route. */
const HOME_TITLE = 'FindAVessel: charter a whole ship, or find cargo for yours';
const HOME_DESC = 'Charter a whole ship or find cargo for your vessel. Post a shipload, get firm offers from owners and brokers, and find ports and marine suppliers.';
const STATIC_META = {
  cargoes: ['Cargo enquiries: shiploads looking for a vessel', 'Open whole-ship cargo enquiries by commodity, quantity, route and loading dates. Vessel owners and brokers can answer with a firm offer.'],
  vessels: ['Vessels for charter: tankers, bulk carriers and more', 'Ships open for charter, with type, deadweight, year built, open port and date. Tankers, bulk carriers, gas carriers, container and multipurpose ships.'],
  enquire: ['Leave a ship chartering enquiry', 'Tell us the cargo, quantity, ports and dates. Your enquiry goes on the board without your company name, for owners and brokers to answer.'],
  join: ['Create an account: owner, charterer, broker or supplier', 'Register to post cargoes, list vessels, make offers or receive supplier requests on FindAVessel.'],
  'post/vessel': ['List a vessel for charter', 'List your ship with its IMO number, type, size, open port and date, photographs and manager details, and be matched with cargo enquiries.'],
  'post/cargo': ['Post a cargo for a whole-ship charter', 'Describe the cargo, quantity, ports and laycan, choose who can see it and receive firm offers from vessel owners and brokers.'],
};
function fitText(t, n) {
  t = String(t).replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n + 1).replace(/\s+\S*$/, '').replace(/[\s,;:(-]+$/, '');
  return cut.length > n / 2 ? cut : t.slice(0, n);
}
function fitTitle(...options) {
  // Prefer the most detailed option that fits; add the brand only when there is room for it.
  for (const t of options) { if (t.length + 14 <= 60) return t + ' | FindAVessel'; if (t.length <= 60) return t; }
  return fitText(options[options.length - 1], 60);
}
const lc = s => /[A-Z]{2}/.test(s) ? s : s.toLowerCase();
function metaFor(path) {
  const [a, id] = path.split('/');
  if (!path) return [HOME_TITLE, HOME_DESC];
  if (a === 'vessel' && id) {
    const v = S.vessels.find(x => x.id === id);
    if (v) {
      const cls = classify(v.seg, v.subtype, v.size), unit = SEG[v.seg].metric || 'DWT', kind = (cls && !/carrier|ship/i.test(cls) ? cls + ' ' : '') + lc(v.subtype);
      return [fitTitle(`${v.name}: ${num(v.size)} ${unit} ${kind} for charter`, `${v.name}: ${num(v.size)} ${unit} ${lc(v.subtype)} for charter`, `${v.name}: ${lc(v.subtype)} for charter`, `${v.name} for charter`),
        fitText(`${v.name} is a ${num(v.size)} ${unit} ${kind} built ${v.built}, ${v.flag} flag, open ${v.open} ${dstr(v.openDate)}. See particulars and make an offer on FindAVessel.`, 155)];
    }
  }
  if ((a === 'cargo' || a === 'enquiry') && id) {
    const g = cargoById(id);
    if (g) {
      const q = g.qty && g.seg !== 'container' && g.seg !== 'roro' ? num(g.qty) + ' t ' : '';
      return [fitTitle(`${q}${g.cargo}, ${g.load} to ${g.disch}: ship wanted`, `${g.cargo}, ${g.load} to ${g.disch}: ship wanted`, `${g.cargo}: ship wanted for a full cargo`),
        fitText(`Whole-ship ${g.type === 'time' ? 'time' : 'voyage'} charter wanted: ${q}${g.cargo} from ${g.load} to ${g.disch}, laycan ${laycan(g.from, g.to)}. Owners and brokers can send a firm offer on FindAVessel.`, 155)];
    }
  }
  if (STATIC_META[path]) return STATIC_META[path];
  const h1 = $('#main h1');
  return [fitTitle(h1 ? h1.textContent : 'FindAVessel'), HOME_DESC];
}
function setMeta(path) {
  let title = HOME_TITLE, desc = HOME_DESC;
  try { [title, desc] = metaFor(path); } catch (e) { /* keep the defaults */ }
  document.title = title;
  const set = (sel, v) => { const el = document.querySelector(sel); if (el) el.setAttribute('content', v); };
  set('meta[name="description"]', desc); set('meta[property="og:title"]', title); set('meta[property="og:description"]', desc);
  // Private and transactional views should not be indexed; public listings and boards may be.
  const priv = /^(deal|deals|desk|passport|offer|join|post|company)\b/.test(path) || /\/offer$/.test(path);
  set('meta[name="robots"]', priv ? 'noindex, follow' : 'index, follow, max-snippet:-1, max-image-preview:large');
}

function render() {
  const rawHash = location.hash.replace(/^#\/?/, ''), qi = rawHash.indexOf('?');
  const path = decodeURIComponent(qi < 0 ? rawHash : rawHash.slice(0, qi));
  render.q = new URLSearchParams(qi < 0 ? '' : rawHash.slice(qi + 1));
  let html = null;
  for (const [re, fn] of ROUTES) { const m = path.match(re); if (m) { html = fn(...m.slice(1)); break; } }
  if (html == null) html = `<section class="page">${empty('Page not found', 'That address does not match anything here.', '<a class="btn" href="#/">Go to the start</a>')}</section>`;
  document.getElementById('app').innerHTML = shell(path);
  $('#main').innerHTML = html;
  setMeta(path);
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
