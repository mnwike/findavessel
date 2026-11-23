/* FindAVessel prototype: public site, cargo and vessel boards, matching and offers. */
'use strict';

/* ---------- Visibility and matching ---------- */
function canSee(c) {
  if (S.role === 'desk' || c.by === myId()) return true;
  if (c.status === 'review') return false;
  if (c.vis === 'shortlist') return S.role !== 'guest' && (c.shortlist || []).includes(myId());
  return true;
}
function posterLabel(c) {
  const p = co(c.by);
  if (c.unverified && S.role !== 'desk') return 'Unverified enquiry';
  if (S.role === 'desk' || c.by === myId()) return esc(p.name);
  return (p.verified === 'verified' ? 'Verified cargo owner' : 'Cargo owner, in review') + ', ' + esc(p.country);
}
function match(c, v) {
  const why = [], bad = [];
  if (c.seg !== v.seg) return { ok: false, score: 0, why, bad: ['Wrong vessel type'] };
  const s = SEG[v.seg];
  if (s.metric === 'DWT' && c.type === 'voyage') {
    const min = c.qty * (1 - (c.tol || 0) / 100);
    if (min > v.size * 0.96) bad.push('Minimum cargo of ' + num(min) + ' t is too large for ' + num(v.size) + ' DWT');
    else if (c.qty < v.size * 0.55) bad.push('Ship is much larger than the cargo');
    else why.push('Size fits: ' + num(c.qty) + ' t on ' + num(v.size) + ' DWT');
  } else if (v.seg === 'gas') {
    if (c.qty > v.size * 0.58) bad.push('Cargo is too large for ' + num(v.size) + ' m³');
    else if (c.qty < v.size * 0.3) bad.push('Ship is much larger than the cargo');
    else why.push('Size fits the tank capacity');
  }
  const nm = roughMiles(v.open, c.load);
  let eta = null;
  if (nm != null) {
    const days = nm / ((v.speed || 13) * 24);
    eta = new Date(new Date(v.openDate).getTime() + days * DAY);
    if (eta > new Date(c.to).getTime() + DAY) bad.push('Cannot reach ' + c.load + ' before the laycan closes (about ' + dstr(eta) + ')');
    else why.push(nm ? 'Reaches ' + c.load + ' about ' + dstr(eta) + ', roughly ' + num(nm) + ' miles in ballast' : 'Already at ' + c.load + ', open ' + dstr(v.openDate));
  }
  const age = new Date().getFullYear() - v.built;
  if (c.maxAge && age > c.maxAge) bad.push('Built ' + v.built + ', older than the ' + c.maxAge + '-year limit');
  else if (c.maxAge) why.push('Age ' + age + ', inside the ' + c.maxAge + '-year limit');
  if (/geared/i.test((c.x || {}).gearReq || '') && /gearless/i.test((v.x || {}).gear || v.subtype) && !/preferred/i.test(c.x.gearReq)) bad.push('Cargo needs a geared ship');
  if (v.verified !== 'verified') why.push('Vessel passport still in review');
  const score = Math.max(0, 100 - bad.length * 40 - Math.min(30, Math.round((nm || 0) / 200)));
  return { ok: !bad.length, score, why, bad, eta, nm };
}

/* ---------- Home ---------- */
route('', () => {
  const live = S.cargoes.filter(c => c.status === 'open' && c.vis !== 'shortlist').slice(0, 4);
  const ships = S.vessels.filter(v => v.verified === 'verified').slice(0, 4);
  return `
  <section class="hero">
    <div class="hero-text">
      <h1>Find a ship for your cargo. Or cargo for your ship.</h1>
      <p class="lede">Whole shiploads meet the ships that can carry them. Say what you need in under a minute, and keep your company name private until you choose to share it.</p>
      <ul class="hero-facts">
        <li><strong>6</strong> ship types, tankers to vehicle carriers</li>
        <li><strong>${Object.values(WORLD).reduce((n, c) => n + c[2].length, 0).toLocaleString('en-GB')}</strong> ports in ${Object.keys(WORLD).length} countries</li>
        <li><strong>${Object.values(SUPPLIER_COUNTRIES).reduce((n, c) => n + c, 0).toLocaleString('en-GB')}</strong> marine suppliers to call on</li>
      </ul>
    </div>
    <div class="hero-card hero-start">
      <div class="hs-tabs" role="tablist" aria-label="What do you have?">
        <button type="button" role="tab" id="hs-tab-cargo" aria-selected="true" aria-controls="hs-cargo" data-act="heroTab" data-tab="cargo">I have cargo</button>
        <button type="button" role="tab" id="hs-tab-ship" aria-selected="false" aria-controls="hs-ship" data-act="heroTab" data-tab="ship">I have a ship</button>
      </div>
      <form id="hs-cargo" role="tabpanel" aria-labelledby="hs-tab-cargo" class="hs-panel" data-form="heroCargo">${portList()}
        <div class="field"><label for="hs-what">What are you shipping?</label><input id="hs-what" name="cargo" required placeholder="Wheat in bulk, steel coils, diesel"></div>
        <div class="hs-row">
          <div class="field"><label for="hs-from">From</label><input id="hs-from" name="load" list="ports" placeholder="Loading port"></div>
          <div class="field"><label for="hs-to">To</label><input id="hs-to" name="disch" list="ports" placeholder="Discharge port"></div>
        </div>
        <button class="btn btn-primary btn-lg">Find a ship</button>
        <p class="fine">Next: quantity and dates, then a free account so owners can answer you.</p>
      </form>
      <div id="hs-ship" role="tabpanel" aria-labelledby="hs-tab-ship" class="hs-panel" hidden>
        <p>List your vessel once with its type, size and where it comes open. You are matched with cargo enquiries that fit, and you can answer any enquiry on the board with a firm offer.</p>
        <div class="row"><a class="btn btn-primary btn-lg" href="#/join?role=owner">List a vessel</a><a class="btn btn-lg" href="#/cargoes">See cargo enquiries</a></div>
        <p class="fine">Brokers can offer ships on an owner’s behalf.</p>
      </div>
    </div>
  </section>

  <section class="band">
    <div class="sec-head"><h2>Start from a port</h2><a href="ports.html">All countries and ports</a></div>
    <p>Pick the country you are shipping from or to. ${Object.keys(WORLD).length} countries and ${Object.values(WORLD).reduce((n, c) => n + c[2].length, 0).toLocaleString('en-GB')} ports are listed.</p>
    <div class="mapwrap">${WORLD_MAP}<div class="map-panel" id="mapPanel">${countryPanel(null)}</div></div>
  </section>

  <section class="band">
    <div class="split">
      <div><div class="sec-head"><h2>Cargoes open for offers</h2><a href="#/cargoes">See all cargoes</a></div>${live.map(cargoRow).join('')}</div>
      <div><div class="sec-head"><h2>Vessels coming open</h2><a href="#/vessels">See all vessels</a></div>${ships.map(vesselRow).join('')}</div>
    </div>
  </section>

  <section class="band band-tint">
    <h2>Three ways in</h2>
    <div class="three">
      <article><h3>You have cargo to move</h3><p>Describe it once: grade, quantity, ports, laycan, the ship you need. Choose who may see it. Compare firm offers side by side, each with a time limit and the offeror’s passport.</p><a class="btn" href="#/post/cargo">Post a cargo</a></article>
      <article><h3>You own or manage a vessel</h3><p>Enter the IMO number and particulars. The class is suggested from type and size. Post where and when the ship comes open, then bid on cargoes that fit.</p><a class="btn" href="#/post/vessel">List a vessel</a></article>
      <article><h3>You are a broker</h3><p>Offer on behalf of a principal. State who you act for and your commission, and it is written into the recap and paid when freight is released.</p><a class="btn" href="#/cargoes">Find cargoes</a></article>
    </div>
  </section>

  <section class="band">
    <h2>How a fixture runs here</h2>
    <ol class="steps">
      <li><h3>Passport</h3><p>Company, owners, sanctions, bank account and references are checked once, then reused on every deal.</p></li>
      <li><h3>Listing</h3><p>A cargo or an open vessel is posted. The desk reviews it before it goes live.</p></li>
      <li><h3>Firm offers</h3><p>Structured offers with a time limit. Counter until main terms agree.</p></li>
      <li><h3>On subjects</h3><p>The deal is conditional. Each subject has a deadline and a clock.</p></li>
      <li><h3>Fixed</h3><p>Subjects lifted, recap issued, charter party signed, freight secured.</p></li>
      <li><h3>Voyage</h3><p>Both sides confirm events in one time log. Laytime is worked from it.</p></li>
      <li><h3>Settlement</h3><p>Freight released against the agreed events. Commission paid. Both sides rate each other.</p></li>
    </ol>
  </section>

  <section class="band band-tint">
    <div class="sec-head"><h2>What goes wrong in chartering, and what is built for it</h2><a href="#/guide/safeguards">All safeguards</a></div>
    ${safeguardTable(SAFEGUARDS.slice(0, 6))}
  </section>

  <section class="band">
    <div class="sec-head"><h2>Learn the trade before you fix</h2><a href="guides.html">All guides and tools</a></div>
    <div class="tiles">
      <a class="tile" href="how-to-charter-a-ship.html"><div><h3>How to charter a ship</h3><p>The seven steps from enquiry to settlement, and what each side must have ready.</p></div></a>
      <a class="tile" href="what-is-demurrage.html"><div><h3>What is demurrage</h3><p>How it is calculated, who pays it, and how it differs from container demurrage.</p></div></a>
      <a class="tile" href="laytime-demurrage-calculator.html"><div><h3>Laytime and demurrage calculator</h3><p>Work out time allowed, time used and what is owed.</p></div></a>
    </div>
  </section>

  <section class="band band-tint">
    <div class="sec-head"><h2>Suppliers and services for the port call</h2><a href="suppliers.html">Open the supplier directory</a></div>
    <p>Chandlers, spares, repairs, safety equipment and agents in ${typeof SUPPLIER_COUNTRIES !== 'undefined' ? Object.keys(SUPPLIER_COUNTRIES).length : 'many'} countries. Send a request and the supplier is notified by email.</p>
    <div class="row"><a class="btn" href="suppliers.html">Find a supplier</a><a class="btn btn-ghost" href="#/join?role=supplier">Register as a supplier</a></div>
  </section>

  <section class="band cta">
    <h2>Start with the passport.</h2>
    <p>It is useful on its own: one verified profile you can show any broker or counterparty, on this platform or off it.</p>
    <a class="btn btn-primary btn-lg" href="#/join">Create an account</a>
  </section>`;
});
function upsell() {
  return `<div class="upsell"><div><strong>Own, manage or broker ships?</strong><span>Register to be sent enquiries that fit your vessels, and to offer on them.</span></div><a class="btn" href="#/join">Register a fleet</a></div>`;
}
function countryPanel(cc) {
  const opts = Object.keys(WORLD).sort((a, b) => WORLD[a][0].localeCompare(WORLD[b][0])).map(k => `<option value="${k}"${k === cc ? ' selected' : ''}>${esc(WORLD[k][0])} (${WORLD[k][2].length})</option>`).join('');
  const pick = `<label class="sub" for="countryPick">Country</label><select id="countryPick" data-live="countryPick"><option value="">Choose a country</option>${opts}</select>`;
  if (!cc || !WORLD[cc]) return `<h3>Where is the cargo?</h3><p class="fine">Select a country on the map or from the list. You will see its ports and can start an enquiry from any of them.</p>${pick}${upsell()}`;
  const [name, slug, ports] = WORLD[cc], blocked = RESTRICTED.includes(name);
  return `<h3>${esc(name)}</h3><p class="fine">${ports.length} ${ports.length === 1 ? 'port' : 'ports'} listed. Choose one as your loading or discharging port.</p>${pick}
    ${blocked ? '<p class="note">Trade with this country is heavily restricted by sanctions. Enquiries are not accepted for its ports.</p>' : `<ul class="portlist">${ports.slice(0, 8).map(p => `<li><span>${esc(p[0])}</span><span><a href="#/enquire?load=${encodeURIComponent(p[0])}">Ship from</a><a href="#/enquire?disch=${encodeURIComponent(p[0])}">Ship to</a></span></li>`).join('')}</ul>`}
    <a class="btn btn-sm" href="ports-${slug}.html">${ports.length > 8 ? 'All ' + ports.length + ' ports in ' + esc(name) : 'Port details for ' + esc(name)}</a>`;
}
ACT.country = d => { const p = $('#mapPanel'); if (!p) return; p.innerHTML = countryPanel(d.cc); document.querySelectorAll('.map a.sel').forEach(a => a.classList.remove('sel')); const a = document.querySelector('.map a[data-cc="' + d.cc + '"]'); if (a) a.classList.add('sel'); };
LIVE.countryPick = el => ACT.country({ cc: el.value });

/* ---------- Leave an enquiry: no account needed, shown on the board without a name ---------- */
route('enquire', () => {
  const q = render.q, d = S.draft.enq || {};
  const v = k => q.get(k) || d[k] || '';
  if (S.role === 'guest') {   // carry what was typed through sign-up
    const keep = {}; ['cargo', 'qty', 'seg', 'load', 'disch', 'from', 'to'].forEach(k => { if (v(k)) keep[k] = v(k); });
    if (Object.keys(keep).length) { S.draft.enq = keep; } S.draft.next = 'enquire'; save();
    const what = keep.cargo ? esc(keep.cargo) + (keep.load ? ', ' + esc(keep.load) : '') + (keep.disch ? ' to ' + esc(keep.disch) : '') : '';
    return `<section class="page narrow"><div class="page-head"><div><h1>Create an account to post your enquiry</h1><p>${what ? 'We have kept what you entered: ' + what + '. ' : ''}An account lets owners and brokers answer you, and keeps your company name private until you choose to share it.</p></div></div>
      <div class="row"><a class="btn btn-primary btn-lg" href="#/join?role=charterer">Create an account</a><a class="btn btn-lg" href="#/signin">Sign in</a></div>
      <p class="fine">Not ready to register? <button class="link" onclick="quickEnquiry()">Send us a quick message</button> and we will reply by email.</p></section>`;
  }
  if (S.role !== 'charterer') return `<section class="page narrow">${needRole(['charterer'], 'Posting a cargo enquiry')}</section>`;
  return `<section class="page narrow"><div class="page-head"><div><h1>Leave an enquiry</h1><p>Say what has to move. It goes on the board without your name, and owners and brokers with a ship that fits can respond.</p></div></div>
    <div class="cols cols-even"><form class="form" data-form="enquiry">${portList()}
    <fieldset><legend>The shipment</legend><div class="grid">
      ${field({ k: 'cargo', l: 'What are you shipping?', req: true, ph: 'Wheat in bulk, steel coils, diesel', wide: true, live: 'enq' }, v('cargo'))}
      ${field({ k: 'qty', l: 'Quantity (tonnes)', t: 'number', req: true, min: 1, live: 'enq' }, v('qty'))}
      ${field({ k: 'seg', l: 'Ship type', t: 'select', o: [['', 'Not sure: suggest one']].concat(SEG_OPTS), live: 'enq' }, v('seg'))}
      ${field({ k: 'load', l: 'From (loading port)', list: 'ports', req: true, ph: 'Start typing a port', live: 'enq' }, v('load'))}
      ${field({ k: 'disch', l: 'To (discharging port)', list: 'ports', req: true, ph: 'Start typing a port', live: 'enq' }, v('disch'))}
      ${field({ k: 'from', l: 'Earliest loading date', t: 'date', req: true }, v('from'))}${field({ k: 'to', l: 'Latest loading date', t: 'date', req: true }, v('to'))}
      ${field({ k: 'note', l: 'Anything else', t: 'textarea', wide: true, ph: 'Packing, loading rates, restrictions at either port' }, v('note'))}
    </div></fieldset>
    <fieldset><legend>Before it goes on the board</legend><div class="grid">
      <div class="field wide"><label class="check"><input type="checkbox" name="decl" required> The cargo and the parties to the sale are not subject to UK, EU, US or UN sanctions.</label></div>
    </div></fieldset>
    <div class="form-end"><button class="btn btn-primary btn-lg">Put it on the board</button><p class="fine">Your company name is not shown on the board. Owners and brokers see the cargo, ports and dates.</p></div></form>
    <aside><div class="card" id="enqOut" data-init="enq"></div>${upsell()}</aside></div></section>`;
});
LIVE.enq = () => {
  const out = $('#enqOut'); if (!out) return;
  const g = k => ($('#f_' + k) || {}).value || '', qty = Number(g('qty')), load = g('load'), disch = g('disch');
  let seg = g('seg') || guessSeg(g('cargo'), qty);
  const rows = [];
  if (qty && SEG[seg] && SEG[seg].metric === 'DWT') { const cls = classify(seg, seg === 'tanker' ? 'Clean product tanker' : '', Math.round(qty / 0.92)); rows.push(['Likely ship', (cls && !/bulker|tanker/i.test(cls) ? cls + ' ' + SEG[seg].short.toLowerCase() : cls || SEG[seg].short) + ', about ' + num(Math.round(qty / 0.92 / 500) * 500) + ' DWT']); }
  else if (seg) rows.push(['Likely ship type', SEG[seg].label]);
  const nm = roughMiles(load, disch);
  if (nm) { rows.push(['Rough distance', num(nm) + ' nautical miles']); rows.push(['Sea passage', 'About ' + Math.max(1, Math.round(nm / (13 * 24))) + ' days at 13 knots']); }
  if (PORT[load] && PORT[disch]) rows.push(['Route', PORT[load].country + ' to ' + PORT[disch].country]);
  const fits = S.vessels.filter(x => x.seg === seg).length;
  if (seg) rows.push(['Ships of this type listed', fits + ' in the sample data']);
  const missing = [['cargo', 'the cargo'], ['qty', 'a quantity'], ['load', 'a loading port'], ['disch', 'a discharging port'], ['from', 'dates']].filter(x => !g(x[0])).map(x => x[1]);
  out.innerHTML = `<h3>What this needs</h3>${rows.length ? kv(rows) : '<p class="fine">Fill in the shipment and this panel works out the likely ship, the distance and the time at sea.</p>'}
    <p class="fine">${missing.length ? 'Still needed for an owner to price it: ' + missing.join(', ') + '.' : 'An owner can price this as it stands.'} Distances are rough estimates.</p>`;
};
function guessSeg(cargo, qty) {
  const t = (cargo || '').toLowerCase(); if (!t) return '';
  let hit = '';
  Object.keys(SEG).forEach(k => SEG[k].cargoes.forEach(c => { if (!hit && t.includes(c.toLowerCase().split(' ')[0])) hit = k; }));
  if (hit) return hit;
  if (/oil|diesel|fuel|petrol|gasoline|chemical|liquid|bitumen/.test(t)) return 'tanker';
  if (/lpg|lng|propane|butane|ammonia|gas\b/.test(t)) return 'gas';
  if (/car|vehicle|truck|trailer/.test(t)) return 'roro';
  if (/container/.test(t)) return 'container';
  if (/project|machinery|turbine|heavy|steel|pipe|timber|bag/.test(t)) return qty > 15000 ? 'bulk' : 'mpp';
  return qty && qty < 8000 ? 'mpp' : 'bulk';
}
FORM.enquiry = d => {
  if (d.to < d.from) return toast('The latest date is before the earliest');
  const bad = [d.load, d.disch].find(p => PORT[p] && RESTRICTED.includes(PORT[p].country));
  if (bad) return toast('Enquiries are not accepted for ports in ' + PORT[bad].country);
  const seg = d.seg || guessSeg(d.cargo, Number(d.qty)) || 'bulk', gid = myId();
  if (S.role !== 'charterer' || !gid) return toast('Sign in with a cargo owner account to post an enquiry');
  const c = { id: nid('g'), by: gid, seg, type: 'voyage', cargo: d.cargo, qty: Number(d.qty), tol: 0, load: d.load, disch: d.disch, from: d.from, to: d.to, x: {}, terms: 'To be agreed', cp: SEG[seg].cp.voyage[0], idea: 0, rateType: SEG[seg].rateTypes[0], dem: 0, maxAge: 0,
    vis: 'open', deadline: Date.now() + 7 * DAY, evidence: 'None: account not yet verified', posted: Date.now(), status: 'open', note: d.note, unverified: true };
  S.cargoes.push(c); delete S.draft.enq; save(); go('enquiry/' + c.id);
};
route('enquiry/:id', id => {
  const c = cargoById(id); if (!c) return null;
  return `<section class="page narrow"><div class="page-head"><div><h1>Your enquiry is on the board</h1><p>This is what owners and brokers see. Your name, company and email are not shown.</p></div></div>
    <div class="list">${cargoRow(c)}</div>
    <section class="block" style="margin-top:2rem"><h2>What happens next</h2><ol class="steps steps-v">
      <li><h3>It is marked unverified</h3><p>Owners can see it and express interest, but most will wait until they know the cargo is real.</p></li>
      <li><h3>Verify to get firm offers</h3><p>Create an account and start your passport. A verified enquiry with evidence of cargo is what owners price seriously.</p></li>
      <li><h3>Compare and fix</h3><p>Offers arrive with a time limit, the ship and the offeror’s passport. Counter until terms agree.</p></li></ol>
      <div class="row"><a class="btn btn-primary" href="#/join">Create an account and verify</a><a class="btn" href="#/cargoes">See the board</a><a class="btn btn-ghost" href="#/enquire">Leave another</a></div></section>
    ${upsell()}</section>`;
});

function safeguardTable(rows) {
  return `<div class="tbl"><table><thead><tr><th>The problem</th><th>The safeguard</th><th>Where</th></tr></thead><tbody>${rows.map(r => `<tr><td><strong>${esc(r[0])}</strong></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- Cargo board ---------- */
function cargoRow(c) {
  const p = co(c.by);
  return `<a class="lrow" href="#/cargo/${c.id}">
    <div class="l-main"><strong>${esc(c.cargo)}</strong><span>${c.type === 'time' ? esc(c.duration || 'Time charter') : num(c.qty) + ' t' + (c.tol ? ', ' + c.tol + '% more or less' : '')}</span></div>
    <div class="l-route"><strong>${esc(c.load)} to ${esc(c.disch)}</strong><span>Laycan ${laycan(c.from, c.to)}</span></div>
    <div class="l-rate"><strong>${c.idea ? rateStr({ rateType: c.rateType, rate: c.idea }) : 'No rate idea given'}</strong><span>${c.idea ? 'Charterer’s idea' : ''}</span></div>
    <div class="l-meta">${tag(SEG[c.seg].short)}${exTag(c)}${c.unverified ? tag('Unverified enquiry', 'warn') : ''}${c.status === 'review' ? tag('Awaiting desk review', 'warn') : c.status !== 'open' ? tag(c.status[0].toUpperCase() + c.status.slice(1), 'ok') : tag(VISIBILITY[c.vis][0], c.vis === 'open' ? '' : 'accent')}<span class="pp-mini">${marks(p.level)}</span>${c.status === 'open' ? `<span class="clock">Closes in ${until(c.deadline)}</span>` : ''}</div>
  </a>`;
}
function filterBar(kind, fields) {
  const f = S.filters[kind];
  return `<form class="filters" data-form="filter" data-kind="${kind}">${fields.map(x => `<label><span>${x[1]}</span><select name="${x[0]}" data-live="filter">${`<option value="">All</option>` + x[2].map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}"${f[x[0]] === v ? ' selected' : ''}>${esc(l)}</option>`; }).join('')}</select></label>`).join('')}</form>`;
}
LIVE.filter = el => { const form = el.closest('form'); S.filters[form.dataset.kind][el.name] = el.value; save(); render(); };
const SEG_OPTS = Object.keys(SEG).map(k => [k, SEG[k].label]);
route('cargoes', () => {
  const f = S.filters.cargo;
  let list = S.cargoes.filter(canSee).filter(c => (!f.seg || c.seg === f.seg) && (!f.region || (PORT[c.load] || {}).region === f.region) && (!f.type || c.type === f.type));
  if (f.sort === 'laycan') list.sort((a, b) => a.from.localeCompare(b.from)); else list.sort((a, b) => b.posted - a.posted);
  const hidden = S.cargoes.filter(c => !canSee(c)).length;
  return `<section class="page">
    <div class="page-head"><div><h1>Cargoes</h1><p>Whole shiploads and whole-ship time charters open for offers.</p></div>${S.role === 'charterer' ? '<a class="btn btn-primary" href="#/post/cargo">Post a cargo</a>' : S.role === 'guest' ? '<a class="btn btn-primary" href="#/enquire">Leave an enquiry</a>' : ''}</div>
    ${filterBar('cargo', [['seg', 'Vessel type', SEG_OPTS], ['region', 'Loading region', REGIONS], ['type', 'Charter', [['voyage', 'Voyage'], ['time', 'Time charter']]], ['sort', 'Sort', [['laycan', 'Earliest laycan']]]])}
    ${S.role === 'guest' ? upsell() : ''}
    <div class="list">${list.length ? list.map(cargoRow).join('') : empty('No cargoes match those filters', 'Clear a filter, or post where your ship opens so cargo owners can find you.')}</div>
    ${typeof deskSection === 'function' && !f.region && !f.type && !f.seg ? deskSection() : ''}
    ${hidden ? `<p class="fine">${hidden} more ${hidden === 1 ? 'listing is' : 'listings are'} restricted to a shortlist or awaiting desk review.</p>` : ''}
  </section>`;
});

/* ---------- Cargo detail ---------- */
const offerTo = o => o.recipient || cargoById(o.cargo).by;
const threadOf = o => o.thread || o.id;
function offersFor(c) { return S.offers.filter(o => o.cargo === c.id); }
function offerLive(o) { return o.status === 'firm' && o.valid > Date.now(); }
route('cargo/:id', id => {
  const c = cargoById(id);
  if (!c || !canSee(c)) return `<section class="page">${empty('This cargo is not available to you', 'It may be restricted to a shortlist, still in review, or withdrawn.', '<a class="btn" href="#/cargoes">Back to cargoes</a>')}</section>`;
  const p = co(c.by), mine = c.by === myId(), s = SEG[c.seg];
  const all = offersFor(c);
  const sealedNow = c.vis === 'sealed' && c.deadline > Date.now() && !c.opened;
  let offersHtml;
  if (mine || S.role === 'desk') {
    if (sealedNow && all.length) offersHtml = `<div class="notice"><p><strong>Sealed until the deadline.</strong> Offers stay closed to everyone, including you, until ${dtime(c.deadline)}.</p><button class="btn" data-act="openTender" data-id="${c.id}">Open the tender now (prototype shortcut)</button></div>`;
    else if (sealedNow) offersHtml = `<p class="fine">Sealed tender. Offers will appear here when the deadline passes.</p>`;
    else offersHtml = threadsHtml(c, all) || empty('No offers yet', 'Verified owners and brokers who can see this cargo have until the deadline to offer.');
  } else {
    const myOffers = all.filter(o => o.by === myId() || offerTo(o) === myId());
    offersHtml = (myOffers.length ? threadsHtml(c, myOffers) : '') +
      `<p class="fine">${c.vis === 'sealed' ? 'Sealed tender: rival offers and their number stay hidden.' : all.filter(o => o.by !== myId() && offerLive(o)).length + ' other live offers. Their terms are private to the cargo owner.'}</p>`;
  }
  const canOffer = (S.role === 'owner' || S.role === 'broker') && c.status === 'open' && c.deadline > Date.now();
  let fit = '';
  if (mine || S.role === 'desk') {
    const m = S.vessels.map(v => [v, match(c, v)]).filter(x => x[1].ok).sort((a, b) => b[1].score - a[1].score);
    fit = `<section class="block"><h2>Vessels that fit</h2>${m.length ? m.map(([v, r]) => `<div class="fit"><a href="#/vessel/${v.id}"><strong>${esc(v.name)}</strong></a><span>${esc(vclass(v))}, ${sizeStr(v)}, open ${esc(v.open)} ${dstr(v.openDate)}</span><ul>${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul><button class="btn btn-sm" data-act="invite" data-c="${c.id}" data-v="${v.id}">Invite to offer</button></div>`).join('') : '<p class="fine">No listed vessel fits yet. The desk will look for one and co-broke if needed.</p>'}<p class="fine">Matching checks type, size, steaming time to the load port, age and gear. Steaming times use rough distances.</p></section>`;
  } else if (S.role === 'owner') {
    const fleet = S.vessels.filter(v => v.owner === myId());
    fit = `<section class="block"><h2>Your fleet against this cargo</h2>${fleet.map(v => { const r = match(c, v); return `<div class="fit ${r.ok ? '' : 'fit-no'}"><strong>${esc(v.name)}</strong><span>${r.ok ? 'Fits' : 'Does not fit'}</span><ul>${r.bad.concat(r.why).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`; }).join('') || '<p class="fine">You have no vessels listed yet.</p>'}</section>`;
  }
  return `<section class="page">
    <a class="back" href="#/cargoes">All cargoes</a>
    <div class="page-head"><div><h1>${esc(c.cargo)}, ${c.type === 'time' ? 'time charter' : num(c.qty) + ' t'}</h1><p>${esc(c.load)} to ${esc(c.disch)}. Laycan ${laycan(c.from, c.to)}.${isExample(c) ? ' This is an example listing, not a live cargo.' : ''}</p></div>
      ${canOffer ? `<a class="btn btn-primary" href="#/cargo/${c.id}/offer">Make a firm offer</a>` : ''}</div>
    <div class="cols">
      <div>
        <section class="block"><h2>Main terms</h2>${kv([
          ['Charter', c.type === 'time' ? 'Time charter' : 'Voyage charter'], ['Cargo', c.cargo],
          ['Quantity', c.type === 'time' ? '' : num(c.qty) + ' tonnes' + (c.tol ? ', ' + c.tol + '% more or less in owner’s option' : '')], ['Duration', c.duration],
          ['Loading', c.load + (PORT[c.load] ? ', ' + PORT[c.load].country : '')], ['Discharging', c.disch + (PORT[c.disch] ? ', ' + PORT[c.disch].country : '')],
          ['Laycan', dlong(c.from) + ' to ' + dlong(c.to)], ['Freight idea', c.idea ? rateStr({ rateType: c.rateType, rate: c.idea }) : 'Not given'],
          ['Freight terms', c.terms], ['Demurrage idea', c.dem ? usd(c.dem) + ' per day' : ''], ['Charter party form', c.cp],
          ['Vessel type', s.label], ['Maximum age', c.maxAge ? c.maxAge + ' years' : ''], ['Services at the load port', supplierLink(c.load), true], ['Services at the discharge port', c.disch !== c.load ? supplierLink(c.disch) : '', true], ['Rough distance', roughMiles(c.load, c.disch) ? num(roughMiles(c.load, c.disch)) + ' nautical miles (estimate)' : '']
        ])}</section>
        <section class="block"><h2>Cargo details</h2>${kv(s.cargoFields.map(f => [f.l, (c.x || {})[f.k]]))}${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}</section>
        <section class="block"><h2>Offers</h2>${offersHtml}</section>
        ${fit}
      </div>
      <aside>
        <div class="card"><h3>Posted by</h3><p><strong>${posterLabel(c)}</strong></p>${passportChip(p)}
          <p class="fine">${p.fixtures} completed ${p.fixtures === 1 ? 'fixture' : 'fixtures'} here. Usually replies within ${p.respH} h.${mine || S.role === 'desk' ? '' : ' The name is shared once a deal goes on subjects.'}</p></div>
        <div class="card"><h3>Listing</h3>${kv([['Visibility', VISIBILITY[c.vis][0]], ['Offers close', c.status === 'open' ? dtime(c.deadline) + ' (' + until(c.deadline) + ')' : 'Closed'], ['Evidence of cargo', c.evidence], ['Posted', ago(c.posted)], ['Status', c.status === 'review' ? 'Awaiting desk review' : c.status[0].toUpperCase() + c.status.slice(1)]])}
          <p class="fine">${esc(VISIBILITY[c.vis][1])}</p>
          ${mine && c.status === 'open' ? `<button class="btn btn-sm" data-act="withdrawCargo" data-id="${c.id}">Withdraw listing</button>` : ''}
          ${S.role === 'desk' && c.status === 'review' ? `<button class="btn btn-primary btn-sm" data-act="approveCargo" data-id="${c.id}">Approve and publish</button>` : ''}</div>
      </aside>
    </div></section>`;
});
ACT.openTender = d => { cargoById(d.id).opened = true; save(); render(); toast('Tender opened'); };
ACT.withdrawCargo = d => { cargoById(d.id).status = 'withdrawn'; save(); render(); toast('Listing withdrawn'); };
ACT.approveCargo = d => { const c = cargoById(d.id); c.status = 'open'; c.evidence = 'Evidence seen by the desk'; save(); render(); toast('Listing published'); };
ACT.invite = d => { const c = cargoById(d.c), v = vessel(d.v); c.shortlist = [...new Set([...(c.shortlist || []), v.owner])]; save(); toast(co(v.owner).name + ' invited to offer ' + v.name); };

const DIFF_KEYS = [['rate', 'Rate', o => rateStr(o)], ['qty', 'Quantity', o => num(o.qty) + ' t'], ['from', 'Laycan', o => laycan(o.from, o.to)], ['to', 'Laycan', o => laycan(o.from, o.to)], ['dem', 'Demurrage', o => usd(o.dem)], ['laytime', 'Laytime', o => o.laytime], ['cp', 'Charter party', o => o.cp], ['commBrok', 'Brokerage', o => o.commBrok + '%'], ['commAddr', 'Address commission', o => o.commAddr + '%']];
function threadsHtml(c, offers) {
  const threads = {};
  offers.forEach(o => (threads[threadOf(o)] = threads[threadOf(o)] || []).push(o));
  return Object.values(threads).map(t => {
    t.sort((a, b) => a.at - b.at);
    return `<div class="thread">${t.map((o, i) => offerCard(c, o, t[i - 1], i === t.length - 1)).join('')}</div>`;
  }).join('');
}
function offerCard(c, o, prev, latest) {
  const by = co(o.by), v = o.vessel ? vessel(o.vessel) : null;
  const live = offerLive(o), status = o.status === 'firm' ? (live ? 'Firm' : 'Expired') : o.status[0].toUpperCase() + o.status.slice(1);
  const gf = grossFreight(o);
  const vs = c.idea && o.rateType === c.rateType ? Math.round((o.rate - c.idea) / c.idea * 1000) / 10 : null;
  const changes = prev ? [...new Set(DIFF_KEYS.filter(k => String(prev[k[0]]) !== String(o[k[0]])).map(k => `${k[1]}: ${k[2](prev)} changed to ${k[2](o)}`))] : [];
  const canAct = latest && live && offerTo(o) === myId();
  return `<article class="offer${latest ? '' : ' offer-old'}">
    <header><div><strong>${esc(by.name)}</strong> ${passportChip(by)}<p>${o.role === 'broker' ? 'Broker acting for the ' + esc((o.actingFor || '').toLowerCase()) + (o.chain ? ', ' + o.chain + (o.chain == 1 ? ' intermediary' : ' intermediaries') + ' to the principal' : ', direct mandate') : esc(o.actingFor || 'Principal')}. Round ${o.round}, sent ${ago(o.at)}.</p></div>
      <div class="offer-status">${tag(status, status === 'Firm' ? 'ok' : status === 'Accepted' ? 'ok' : 'muted')}${live ? `<span class="clock">Valid for ${until(o.valid)}</span>` : ''}</div></header>
    ${changes.length ? `<ul class="changes">${changes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <div class="offer-rate"><strong>${rateStr(o)}</strong>${vs != null ? `<span>${vs > 0 ? vs + '% above' : vs < 0 ? Math.abs(vs) + '% below' : 'equal to'} the freight idea</span>` : ''}${gf ? `<span>Gross freight about ${usd(gf)}</span>` : ''}</div>
    ${kv([['Vessel', v ? `<a href="#/vessel/${v.id}">${esc(v.name)}</a>, ${esc(vclass(v))}, ${sizeStr(v)}, built ${v.built}` : esc(o.vesselName || 'To be nominated'), true], ['Quantity', num(o.qty) + ' t'], ['Laycan', laycan(o.from, o.to)], ['Demurrage', o.dem ? usd(o.dem) + ' per day' : ''], ['Laytime', o.laytime], ['Charter party', o.cp],
      ['Commission', (Number(o.commAddr) + Number(o.commBrok)) + '% in total (' + o.commAddr + '% address, ' + o.commBrok + '% brokerage)'], ['Subjects', (o.subjects || []).map(i => SUBJECTS[i]).join('; ')], ['Note', o.note]])}
    ${canAct ? `<div class="row"><button class="btn btn-primary" data-act="accept" data-id="${o.id}">Accept on subjects</button><a class="btn" href="#/offer/${o.id}/counter">Counter</a><button class="btn btn-ghost" data-act="decline" data-id="${o.id}">Decline</button></div>` : ''}
    ${latest && live && o.by === myId() ? `<div class="row"><button class="btn btn-ghost btn-sm" data-act="withdrawOffer" data-id="${o.id}">Withdraw offer</button></div>` : ''}
  </article>`;
}
ACT.decline = d => { S.offers.find(o => o.id === d.id).status = 'declined'; save(); render(); toast('Offer declined'); };
ACT.withdrawOffer = d => { S.offers.find(o => o.id === d.id).status = 'withdrawn'; save(); render(); toast('Offer withdrawn'); };

/* ---------- Offer and counter-offer form ---------- */
function offerForm(c, base, counterOf) {
  const s = SEG[c.seg], fleet = S.vessels.filter(v => v.owner === myId() && v.seg === c.seg);
  const isBroker = S.role === 'broker', isOwner = S.role === 'owner';
  const b = base || { rateType: c.rateType, rate: '', qty: c.qty, from: c.from, to: c.to, dem: c.dem, laytime: c.x && c.x.loadRate ? num(c.x.loadRate) + ' load / ' + num(c.x.dischRate) + ' discharge, weather working days' : '', cp: c.cp, commAddr: 0, commBrok: 1.25, subjects: [0, 2, 5, 7], vessel: fleet[0] ? fleet[0].id : '' };
  const v0 = b.vessel ? vessel(b.vessel) : null;
  return `<form class="form" data-form="offer" data-cargo="${c.id}" data-counter="${counterOf || ''}">
    ${portList()}
    <fieldset><legend>Who is offering</legend><div class="grid">
      ${counterOf ? `<p class="fine wide">You are countering as ${esc(me().name)}. Unchanged terms carry over.</p><input type="hidden" name="vessel" value="${esc(b.vessel || '')}"><input type="hidden" name="vesselName" value="${esc(b.vesselName || '')}">` :
      isOwner ? field({ k: 'vessel', l: 'Vessel offered', t: 'select', o: fleet.map(v => [v.id, v.name + ', ' + vclass(v) + ', ' + sizeStr(v)]), req: true, live: 'offerVessel', hint: fleet.length ? '' : 'You have no ' + s.short.toLowerCase() + ' listed. <a href="#/post/vessel">List a vessel</a> first.' }, b.vessel) :
      field({ k: 'vessel', l: 'Named vessel', t: 'select', blank: 'To be nominated', o: S.vessels.filter(v => v.seg === c.seg).map(v => [v.id, v.name + ', ' + sizeStr(v)]) }, b.vessel) + field({ k: 'vesselName', l: 'If to be nominated, describe the ship', ph: 'Handysize, 32,000 to 38,000 DWT, built 2010 or later' }, b.vesselName)}
      ${isBroker && !counterOf ? field({ k: 'actingFor', l: 'You act for', t: 'select', o: ['Owner', 'Disponent owner', 'Another broker'], req: true }, 'Owner') + field({ k: 'chain', l: 'Intermediaries between you and the principal', t: 'select', o: [['0', 'None: direct mandate'], ['1', 'One'], ['2', 'Two'], ['3', 'Three or more']], req: true, hint: 'Shown to the cargo owner. Long chains are the most common complaint about brokered offers.' }, '0') : ''}
    </div>${isOwner && !counterOf ? `<div id="fitbox" data-init="offerVessel" data-cargo="${c.id}"></div>` : ''}</fieldset>
    <fieldset><legend>Rate and quantity</legend><div class="grid">
      ${field({ k: 'rateType', l: 'Rate basis', t: 'select', o: c.type === 'time' ? ['USD per day'] : s.rateTypes, req: true, live: 'est' }, b.rateType)}
      ${field({ k: 'rate', l: 'Rate', t: 'number', req: true, min: 0, live: 'est', hint: c.idea ? 'Charterer’s idea: ' + rateStr({ rateType: c.rateType, rate: c.idea }) : '' }, b.rate)}
      ${field({ k: 'qty', l: 'Quantity (tonnes)', t: 'number', req: true, min: 1, live: 'est' }, b.qty)}
      ${field({ k: 'dem', l: 'Demurrage (USD per day)', t: 'number', min: 0 }, b.dem)}
      ${field({ k: 'from', l: 'Laycan from', t: 'date', req: true }, b.from)}${field({ k: 'to', l: 'Laycan to', t: 'date', req: true }, b.to)}
      ${field({ k: 'laytime', l: 'Laytime terms', wide: true, ph: '8,000 load / 4,000 discharge, weather working days' }, b.laytime)}
    </div></fieldset>
    <fieldset><legend>Contract</legend><div class="grid">
      ${field({ k: 'cp', l: 'Charter party form', t: 'select', o: s.cp[c.type === 'time' ? 'time' : 'voyage'], req: true }, b.cp)}
      ${field({ k: 'commAddr', l: 'Address commission (%)', t: 'number', step: '0.25', min: 0, live: 'est' }, b.commAddr)}
      ${field({ k: 'commBrok', l: 'Brokerage (%)', t: 'number', step: '0.25', min: 0, live: 'est', hint: 'Deducted from freight on release and paid to the broker or the desk.' }, b.commBrok)}
      ${field({ k: 'validH', l: 'Offer stays firm for', t: 'select', o: [['1', '1 hour'], ['2', '2 hours'], ['4', '4 hours'], ['8', '8 hours'], ['24', '24 hours']], req: true }, '4')}
      <div class="field wide"><span class="lbl">Subjects</span><div class="checks">${SUBJECTS.map((x, i) => `<label><input type="checkbox" name="subjects[]" value="${i}"${(b.subjects || []).includes(i) ? ' checked' : ''}> ${esc(x)}</label>`).join('')}</div><p class="hint">Each subject gets a deadline when the offer is accepted. “Sanctions and counterparty checks” and “Freight security” cannot be removed on a first deal between two parties.</p></div>
      ${field({ k: 'note', l: 'Note to the other side', t: 'textarea', wide: true }, counterOf ? '' : b.note)}
    </div></fieldset>
    ${isOwner && c.type !== 'time' ? `<details class="est"><summary>Voyage estimate</summary><div class="grid" data-init="est">
      ${field({ k: 'e_ballast', l: 'Ballast distance (miles)', t: 'number', live: 'est' }, v0 ? roughMiles(v0.open, c.load) : '')}${field({ k: 'e_laden', l: 'Laden distance (miles)', t: 'number', live: 'est' }, roughMiles(c.load, c.disch) || '')}
      ${field({ k: 'e_speed', l: 'Speed (knots)', t: 'number', live: 'est' }, v0 ? v0.speed : 13)}${field({ k: 'e_cons', l: 'Fuel at sea (tonnes per day)', t: 'number', live: 'est' }, v0 ? v0.cons : 25)}
      ${field({ k: 'e_portdays', l: 'Days in port', t: 'number', live: 'est' }, c.x && c.x.loadRate ? Math.round((c.qty / c.x.loadRate + c.qty / c.x.dischRate + 2) * 10) / 10 : 6)}${field({ k: 'e_portcons', l: 'Fuel in port (tonnes per day)', t: 'number', live: 'est' }, 4)}
      ${field({ k: 'e_bunker', l: 'Fuel price (USD per tonne)', t: 'number', live: 'est' }, 600)}${field({ k: 'e_da', l: 'Port costs, both ends (USD)', t: 'number', live: 'est' }, 90000)}
      <div class="wide" id="estOut"></div></div><p class="fine">Distances are rough estimates, not routed sea distances. Enter your own figures before relying on the result.</p></details>` : ''}
    <div class="form-end"><button class="btn btn-primary btn-lg">${counterOf ? 'Send counter-offer' : 'Send firm offer'}</button><a class="btn btn-ghost" href="#/cargo/${c.id}">Cancel</a>
      <p class="fine">A firm offer binds you if it is accepted before the time limit, on the subjects listed.</p></div>
  </form>`;
}
LIVE.offerVessel = el => {
  const box = $('#fitbox'); if (!box) return;
  const sel = $('#f_vessel'), v = sel && vessel(sel.value), c = cargoById(box.dataset.cargo);
  if (!v) { box.innerHTML = ''; return; }
  const r = match(c, v);
  box.innerHTML = `<div class="fit ${r.ok ? '' : 'fit-no'}"><strong>${esc(v.name)} ${r.ok ? 'fits this cargo' : 'does not fit as listed'}</strong><ul>${r.bad.concat(r.why).map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
  if (el !== box) { const bd = $('#f_e_ballast'); if (bd) { bd.value = roughMiles(v.open, c.load) || ''; $('#f_e_speed').value = v.speed; $('#f_e_cons').value = v.cons; LIVE.est(); } }
};
LIVE.est = () => {
  const out = $('#estOut'); if (!out) return;
  const g = k => Number(($('#f_' + k) || {}).value || 0);
  const rt = $('#f_rateType').value, gross = rt === 'USD per tonne' ? g('rate') * g('qty') : rt === 'Lumpsum USD' ? g('rate') : 0;
  const seaDays = g('e_speed') ? (g('e_ballast') + g('e_laden')) / (g('e_speed') * 24) : 0, days = seaDays + g('e_portdays');
  const fuel = (seaDays * g('e_cons') + g('e_portdays') * g('e_portcons')) * g('e_bunker');
  const comm = gross * (g('commAddr') + g('commBrok')) / 100, net = gross - comm - fuel - g('e_da');
  out.innerHTML = gross ? kv([['Voyage length', num(Math.round(days * 10) / 10) + ' days (' + num(Math.round(seaDays * 10) / 10) + ' at sea)'], ['Gross freight', usd(gross)], ['Commissions', usd(comm)], ['Fuel', usd(fuel)], ['Port costs', usd(g('e_da'))], ['Net voyage result', usd(net)], ['Time charter equivalent', days ? usd(net / days) + ' per day' : '']]) : '<p class="fine">Enter a rate per tonne or a lumpsum to see the estimate.</p>';
};
route('cargo/:id/offer', id => {
  const c = cargoById(id); if (!c) return null;
  return `<section class="page narrow"><a class="back" href="#/cargo/${c.id}">Back to the cargo</a><div class="page-head"><div><h1>Firm offer</h1><p>${esc(c.cargo)}, ${num(c.qty)} t, ${esc(c.load)} to ${esc(c.disch)}, laycan ${laycan(c.from, c.to)}.</p></div></div>
    ${needRole(['owner', 'broker'], 'Offering on a cargo') || offerForm(c)}</section>`;
});
route('offer/:id/counter', id => {
  const o = S.offers.find(x => x.id === id); if (!o) return null;
  const c = cargoById(o.cargo);
  return `<section class="page narrow"><a class="back" href="#/cargo/${c.id}">Back to the cargo</a><div class="page-head"><div><h1>Counter-offer</h1><p>To ${esc(co(o.by).name)}, against ${rateStr(o)}.</p></div></div>
    ${offerTo(o) !== myId() ? `<div class="notice"><p>Only ${esc(co(offerTo(o)).name)} can counter this offer.</p></div>` : offerForm(c, o, o.id)}</section>`;
});
FORM.offer = (d, form) => {
  if (isExample(cargoById(form.dataset.cargo))) return toast('This is an example listing. Offers cannot be sent on it.');
  const c = cargoById(form.dataset.cargo), prev = form.dataset.counter ? S.offers.find(o => o.id === form.dataset.counter) : null;
  if (d.to < d.from) return toast('The laycan ends before it starts');
  if (!d.vessel && !d.vesselName && !prev) return toast('Name a vessel or describe the ship to be nominated');
  const o = { id: nid('f'), cargo: c.id, vessel: d.vessel || null, vesselName: d.vesselName || (prev && prev.vesselName) || '', by: myId(), recipient: prev ? prev.by : c.by,
    role: prev ? (myId() === c.by ? 'charterer' : prev.role) : S.role, actingFor: prev ? (myId() === c.by ? 'Charterer, as principal' : prev.actingFor) : S.role === 'owner' ? 'Owner, as principal' : d.actingFor, chain: prev ? (myId() === c.by ? 0 : prev.chain) : Number(d.chain || 0),
    rateType: d.rateType, rate: Number(d.rate), qty: Number(d.qty), from: d.from, to: d.to, dem: Number(d.dem || 0), laytime: d.laytime, cp: d.cp, commAddr: Number(d.commAddr || 0), commBrok: Number(d.commBrok || 0),
    subjects: (d.subjects || []).map(Number), valid: Date.now() + Number(d.validH) * HOUR, note: d.note, status: 'firm', round: prev ? prev.round + 1 : 1, thread: prev ? threadOf(prev) : null, at: Date.now() };
  if (prev) prev.status = 'countered';
  S.offers.push(o); save(); go('cargo/' + c.id); toast(prev ? 'Counter-offer sent' : 'Firm offer sent');
};

/* Hero quick start: carry what was typed into the full enquiry form. */
ACT.heroTab = d => { ['cargo', 'ship'].forEach(t => { $('#hs-' + t).hidden = t !== d.tab; $('#hs-tab-' + t).setAttribute('aria-selected', String(t === d.tab)); }); };
FORM.heroCargo = d => { const q = new URLSearchParams(); ['cargo', 'load', 'disch'].forEach(k => { if (d[k]) q.set(k, d[k]); }); location.hash = '#/enquire?' + q.toString(); };
