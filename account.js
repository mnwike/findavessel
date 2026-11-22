/* FindAVessel prototype: vessel board, listing forms, sign-up and the passport. */
'use strict';

/* ---------- Vessel board ---------- */
function vesselRow(v) {
  const o = co(v.owner);
  return `<a class="lrow" href="#/vessel/${v.id}">
    <div class="l-main"><strong>${esc(v.name)}</strong><span>${esc(vclass(v))}, ${sizeStr(v)}</span></div>
    <div class="l-route"><strong>Open ${esc(v.open)}</strong><span>From ${dstr(v.openDate)}</span></div>
    <div class="l-rate"><strong>${esc(v.subtype)}</strong><span>Built ${v.built}, ${esc(v.flag)}</span></div>
    <div class="l-meta">${tag(SEG[v.seg].short)}${exTag(v)}${v.verified === 'verified' ? tag('Vessel verified', 'ok') : tag('In review', 'warn')}<span class="pp-mini">${marks(o.level)}</span></div>
  </a>`;
}
route('vessels', () => {
  const f = S.filters.vessel;
  const list = S.vessels.filter(v => (!f.seg || v.seg === f.seg) && (!f.region || (PORT[v.open] || {}).region === f.region)).sort((a, b) => a.openDate.localeCompare(b.openDate));
  return `<section class="page">
    <div class="page-head"><div><h1>Vessels</h1><p>Ships coming open, listed by their owners or managers. Soonest first.</p></div>${S.role === 'owner' ? '<a class="btn btn-primary" href="#/post/vessel">List a vessel</a>' : ''}</div>
    ${filterBar('vessel', [['seg', 'Vessel type', SEG_OPTS], ['region', 'Open in', REGIONS]])}
    <div class="list">${list.length ? list.map(vesselRow).join('') : empty('No vessels match those filters', 'Clear a filter, or post your cargo so owners can come to you.')}</div>
  </section>`;
});
route('vessel/:id', id => {
  const v = vessel(id); if (!v) return null;
  const s = SEG[v.seg], o = co(v.owner), mine = v.owner === myId();
  const fits = S.cargoes.filter(c => c.status === 'open' && canSee(c)).map(c => [c, match(c, v)]).filter(x => x[1].ok);
  const myCargoes = S.cargoes.filter(c => c.by === myId() && c.status === 'open' && c.seg === v.seg);
  const exp = Math.round((new Date(v.certExpiry) - Date.now()) / DAY);
  return `<section class="page">
    <a class="back" href="#/vessels">All vessels</a>
    <div class="page-head"><div><h1>${esc(v.name)}</h1><p>${esc(vclass(v))} ${esc(v.subtype.toLowerCase())}, ${sizeStr(v)}, built ${v.built}.${isExample(v) ? ' This is an example listing, not a ship on offer.' : ''}</p></div>
      ${S.role === 'charterer' && myCargoes.length ? `<button class="btn btn-primary" data-act="invite" data-c="${myCargoes[0].id}" data-v="${v.id}">Invite to offer on ${esc(myCargoes[0].cargo.toLowerCase())}</button>` : ''}</div>
    <div class="cols">
      <div>
        <section class="block"><h2>Open position</h2>${kv([['Open at', v.open + (PORT[v.open] ? ', ' + PORT[v.open].country : '')], ['Open from', dlong(v.openDate)], ['Preferred trades', v.trades], ['Speed and fuel', v.speed + ' knots on about ' + v.cons + ' t per day'], ['Stores, spares and repairs', supplierLink(v.open), true]])}</section>
        ${(v.photos || []).length ? `<section class="block"><h2>Photographs</h2><div class="gallery">${v.photos.map((p, i) => `<img src="${p}" alt="${esc(v.name)}, photograph ${i + 1}">`).join('')}</div><p class="fine">Supplied by the owner.</p></section>` : ''}
        <section class="block"><h2>Particulars</h2>${kv([['IMO number', v.imo || 'Withheld in sample data'], ['Type', v.subtype], ['Class label', vclass(v) + (s.approx ? ' (platform band)' : '')], [s.metricLong, num(v.size)], ['Built', v.built], ['Flag', v.flag], ['Classification society', v.cls], ['P&I', v.pi],
          ['Length overall', v.loa ? v.loa + ' m' : ''], ['Beam', v.beam ? v.beam + ' m' : ''], ['Summer draught', v.draft ? v.draft + ' m' : ''], ['Gross tonnage', v.gt ? num(v.gt) : ''], ['Technical manager', v.techManager], ['Commercial manager', v.commManager]])}</section>
        <section class="block"><h2>${esc(s.short)} details</h2>${kv(s.fields.map(f => [f.l, f.t === 'date' ? dlong((v.x || {})[f.k]) : (v.x || {})[f.k]]))}</section>
        <section class="block"><h2>Cargoes this ship fits</h2>${fits.length ? fits.map(([c, r]) => `<div class="fit"><a href="#/cargo/${c.id}"><strong>${esc(c.cargo)}, ${num(c.qty)} t</strong></a><span>${esc(c.load)} to ${esc(c.disch)}, laycan ${laycan(c.from, c.to)}</span><ul>${r.why.map(w => `<li>${esc(w)}</li>`).join('')}</ul>${mine ? `<a class="btn btn-sm" href="#/cargo/${c.id}/offer">Make a firm offer</a>` : ''}</div>`).join('') : '<p class="fine">No open cargo fits this ship on type, size, timing and age.</p>'}</section>
      </div>
      <aside>
        <div class="card"><h3>Owner</h3><p><a href="#/company/${o.id}"><strong>${esc(o.name)}</strong></a></p>${passportChip(o)}<p class="fine">${esc(o.about)} ${o.fixtures} completed ${o.fixtures === 1 ? 'fixture' : 'fixtures'} here.</p></div>
        <div class="card"><h3>Vessel checks</h3><ul class="checklist">
          <li class="${v.verified === 'verified' ? 'ok' : 'wait'}">Particulars confirmed against the IMO number</li>
          <li class="${v.verified === 'verified' ? 'ok' : 'wait'}">Title or management authority</li>
          <li class="${exp > 60 ? 'ok' : 'wait'}">Class and P&amp;I certificates, next expiry ${dlong(v.certExpiry)}${exp <= 60 ? ' (' + exp + ' days)' : ''}</li>
          <li class="${v.verified === 'verified' ? 'ok' : 'wait'}">Sanctions and port-state detention history</li></ul>
          ${S.role === 'desk' && v.verified !== 'verified' ? `<button class="btn btn-primary btn-sm" data-act="verifyVessel" data-id="${v.id}">Mark vessel verified</button>` : ''}</div>
      </aside>
    </div></section>`;
});
ACT.verifyVessel = d => { vessel(d.id).verified = 'verified'; save(); render(); toast('Vessel verified'); };

/* ---------- List a vessel ---------- */
LIVE.reseg = el => { const form = el.closest('form'); S.draft[form.dataset.form] = formData(form); save(); render(); };
LIVE.vphotos = (el, evt) => {
  if (evt !== 'change') return;
  const files = [...el.files].slice(0, 4); S.draft.vphotos = [];
  Promise.all(files.map(f => new Promise(res => {
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => { const k = Math.min(1, 640 / img.width), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.7)); };
    img.onerror = () => res(null); img.src = url;
  }))).then(list => { S.draft.vphotos = list.filter(Boolean); save(); const p = $('#photoPrev'); if (p) p.innerHTML = S.draft.vphotos.map(x => `<img src="${x}" alt="Selected photograph">`).join(''); });
};
LIVE.imo = el => {
  const h = $('#f_imo_hint'); if (!h) return;
  const v = el.value.trim();
  h.textContent = !v ? 'Seven digits. The last is a check digit, so a mistyped number is caught here.' : imoValid(v) ? 'Valid IMO number format.' : /^\d{7}$/.test(v) ? 'The check digit does not match. Re-read the number.' : 'An IMO number has exactly seven digits.';
  h.className = 'hint' + (v && !imoValid(v) ? ' hint-bad' : v ? ' hint-ok' : '');
};
LIVE.vclass = () => {
  const out = $('#classOut'); if (!out) return;
  const seg = $('#f_seg').value, s = SEG[seg], label = classify(seg, $('#f_subtype').value, $('#f_size').value);
  out.innerHTML = label ? `<strong>${esc(label)}</strong><span>Suggested from type and ${s.metric}. ${s.approx ? 'This is a platform band, not a market term.' : 'Class names are market shorthand; the measured figure is what counterparties rely on.'}</span>` : `<span>Enter the type and ${s.metric} and the class label is suggested here.</span>`;
};
route('post/vessel', () => {
  const d = S.draft.vessel || {}, x = d.x || {}, seg = d.seg || 'bulk', s = SEG[seg];
  return `<section class="page narrow"><div class="page-head"><div><h1>List a vessel</h1><p>Enter measured facts. The class label is worked out for you, and the desk checks the particulars against the IMO number before the listing goes live.</p></div></div>
    ${needRole(['owner'], 'Listing a vessel') || `<form class="form" data-form="vessel">${portList()}
    <fieldset><legend>1. Identity</legend><div class="grid">
      ${field({ k: 'name', l: 'Vessel name', req: true }, d.name)}
      ${field({ k: 'imo', l: 'IMO number', req: true, live: 'imo', ph: '7 digits', hint: 'Seven digits. The last is a check digit, so a mistyped number is caught here.' }, d.imo)}
      ${field({ k: 'seg', l: 'Vessel type', t: 'select', o: SEG_OPTS, req: true, live: 'reseg' }, seg)}
      ${field({ k: 'subtype', l: 'Sub-type', t: 'select', o: s.subtypes, req: true, live: 'vclass' }, d.subtype)}
      ${field({ k: 'size', l: s.metricLong, t: 'number', req: true, min: 1, live: 'vclass' }, d.size)}
      <div class="field"><span class="lbl">Class label</span><div class="classout" id="classOut" data-init="vclass"></div></div>
      ${field({ k: 'authority', l: 'Your authority over the ship', t: 'select', o: ['Registered owner', 'Disponent owner', 'Commercial manager with written authority'], req: true }, d.authority)}
      ${field({ k: 'techManager', l: 'Technical manager', ph: 'Company that crews and maintains the ship', hint: 'Leave empty if you manage the ship yourself.' }, d.techManager)}
      ${field({ k: 'commManager', l: 'Commercial manager', ph: 'Company that fixes the ship' }, d.commManager)}
    </div></fieldset>
    <fieldset><legend>2. Particulars</legend><div class="grid">
      ${field({ k: 'built', l: 'Year built', t: 'number', req: true, min: 1970 }, d.built)}${field({ k: 'flag', l: 'Flag', t: 'select', o: FLAGS, req: true }, d.flag)}
      ${field({ k: 'cls', l: 'Classification society', t: 'select', o: CLASS_SOCIETIES, req: true }, d.cls)}${field({ k: 'pi', l: 'P&I club or insurer', t: 'select', o: PI_CLUBS, req: true }, d.pi)}
      ${field({ k: 'loa', l: 'Length overall (m)', t: 'number' }, d.loa)}${field({ k: 'beam', l: 'Beam (m)', t: 'number' }, d.beam)}
      ${field({ k: 'draft', l: 'Summer draught (m)', t: 'number' }, d.draft)}${field({ k: 'gt', l: 'Gross tonnage', t: 'number' }, d.gt)}
      ${field({ k: 'speed', l: 'Service speed (knots)', t: 'number' }, d.speed)}${field({ k: 'cons', l: 'Fuel at sea (tonnes per day)', t: 'number' }, d.cons)}
    </div></fieldset>
    <fieldset><legend>3. ${esc(s.short)} details</legend><div class="grid">${s.fields.map(f => field(f, x[f.k], { prefix: 'x_' })).join('')}</div></fieldset>
    <fieldset><legend>4. Where and when she is open</legend><div class="grid">
      ${field({ k: 'open', l: 'Open port', list: 'ports', req: true, ph: 'Start typing a port' }, d.open)}${field({ k: 'openDate', l: 'Open from', t: 'date', req: true }, d.openDate)}
      ${field({ k: 'trades', l: 'Preferred trades or exclusions', wide: true, ph: 'Worldwide, excluding war-risk areas' }, d.trades)}
    </div></fieldset>
    <fieldset><legend>5. Photographs</legend>
      <div class="field"><label for="f_photos">Up to four photographs of the ship <small>optional</small></label><input id="f_photos" type="file" accept="image/*" multiple data-live="vphotos"><p class="hint">Deck, holds or tanks, and a profile shot help most. Images are reduced in size and kept in this browser only.</p></div>
      <div class="gallery" id="photoPrev">${(S.draft.vphotos || []).map(p => `<img src="${p}" alt="Selected photograph">`).join('')}</div>
    </fieldset>
    <fieldset><legend>6. Certificates</legend><div class="grid">
      <div class="field"><label for="f_classcert">Certificate of class <small>optional now, needed before a fixture</small></label><input id="f_classcert" type="file" name="classcert"></div>
      <div class="field"><label for="f_picert">P&amp;I certificate of entry <small>optional now, needed before a fixture</small></label><input id="f_picert" type="file" name="picert"></div>
      ${field({ k: 'certExpiry', l: 'Earliest certificate expiry', t: 'date', hint: 'You are reminded 60 days before, and so is any counterparty in a live deal.' }, d.certExpiry)}
      <p class="fine wide">Files are not uploaded anywhere in this prototype.</p>
    </div></fieldset>
    <div class="form-end"><button class="btn btn-primary btn-lg">Submit for desk review</button></div></form>`}</section>`;
});
FORM.vessel = d => {
  if (!imoValid(d.imo)) return toast('Check the IMO number: the check digit does not match');
  if (!PORT[d.open]) toast('Port not in the prototype list, so matching will skip steaming time');
  const v = { id: nid('v'), owner: myId(), name: d.name, imo: d.imo, seg: d.seg, subtype: d.subtype, size: Number(d.size), built: Number(d.built), flag: d.flag, cls: d.cls, pi: d.pi, loa: d.loa, beam: d.beam, draft: d.draft, gt: Number(d.gt || 0),
    x: d.x, open: d.open, openDate: d.openDate, trades: d.trades, speed: Number(d.speed || 13), cons: Number(d.cons || 25), verified: 'review', certExpiry: d.certExpiry || inDays(365),
    techManager: d.techManager, commManager: d.commManager, photos: S.draft.vphotos || [] };
  S.vessels.push(v); delete S.draft.vessel; delete S.draft.vphotos; save(); go('vessel/' + v.id); toast('Vessel submitted for desk review');
};

/* ---------- Post a cargo ---------- */
route('post/cargo', () => {
  const d = S.draft.cargo || {}, x = d.x || {}, seg = d.seg || 'bulk', s = SEG[seg], type = d.type || 'voyage';
  const invitees = S.companies.filter(c => (c.role === 'owner' || c.role === 'broker') && c.verified === 'verified');
  return `<section class="page narrow"><div class="page-head"><div><h1>Post a cargo</h1><p>Whole shiploads and whole-ship time charters only. An owner should be able to price it from this page without calling you.</p></div></div>
    ${needRole(['charterer'], 'Posting a cargo') || `<details class="paste"${d.qty ? '' : ' open'}><summary>Paste an enquiry and let the form fill itself</summary>
      <label for="pasteBox" class="sub">Paste the cargo order as you would email it to a broker. Quantity, cargo, ports, laycan, rates and freight idea are picked out.</label>
      <textarea id="pasteBox" rows="4" placeholder="30,000 mt wheat in bulk 10 pct moloo, Constanta / Alexandria, laycan 10-15 December, 8000 shinc / 4000 shex, idea usd 24.50 pmt"></textarea>
      <button class="btn" type="button" data-act="parseEnquiry">Fill the form from this text</button></details>
    <form class="form" data-form="cargo">${portList()}
    <fieldset><legend>1. What is moving</legend><div class="grid">
      ${field({ k: 'type', l: 'Charter', t: 'select', o: [['voyage', 'Voyage charter: freight for one voyage'], ['time', 'Time charter: hire the ship by the day']], req: true, live: 'reseg' }, type)}
      ${field({ k: 'seg', l: 'Vessel type needed', t: 'select', o: SEG_OPTS, req: true, live: 'reseg' }, seg)}
      ${field({ k: 'cargo', l: 'Cargo', t: 'select', o: s.cargoes.concat('Other, described below'), req: true }, d.cargo)}
      ${field({ k: 'qty', l: 'Quantity (tonnes)', t: 'number', req: true, min: 1 }, d.qty)}
      ${field({ k: 'tol', l: 'Tolerance, more or less (%)', t: 'select', o: [['0', 'None: minimum and maximum'], ['5', '5%'], ['10', '10%']] }, d.tol || '10')}
      ${type === 'time' ? field({ k: 'duration', l: 'Period', req: true, ph: 'One trip of about 40 days, or 6 to 8 months' }, d.duration) : ''}
      ${s.cargoFields.map(f => field(f, x[f.k], { prefix: 'x_' })).join('')}
    </div></fieldset>
    <fieldset><legend>2. Where and when</legend><div class="grid">
      ${field({ k: 'load', l: type === 'time' ? 'Delivery port or range' : 'Load port', list: 'ports', req: true, ph: 'Start typing a port' }, d.load)}
      ${field({ k: 'disch', l: type === 'time' ? 'Redelivery port or range' : 'Discharge port', list: 'ports', req: true, ph: 'Start typing a port' }, d.disch)}
      ${field({ k: 'from', l: 'Laycan from', t: 'date', req: true }, d.from)}${field({ k: 'to', l: 'Laycan to', t: 'date', req: true, hint: 'The ship must arrive ready to load inside this window.' }, d.to)}
    </div></fieldset>
    <fieldset><legend>3. Commercial terms</legend><div class="grid">
      ${field({ k: 'rateType', l: 'Rate basis', t: 'select', o: type === 'time' ? ['USD per day'] : s.rateTypes, req: true }, d.rateType)}
      ${field({ k: 'idea', l: 'Your freight idea', t: 'number', min: 0, hint: 'Optional, but owners answer cargoes with a number on them first.' }, d.idea)}
      ${type === 'voyage' ? field({ k: 'terms', l: 'Freight terms', t: 'select', o: FREIGHT_TERMS }, d.terms) + field({ k: 'dem', l: 'Demurrage idea (USD per day)', t: 'number', min: 0 }, d.dem) : ''}
      ${field({ k: 'cp', l: 'Charter party form', t: 'select', o: s.cp[type], req: true }, d.cp)}
      ${field({ k: 'maxAge', l: 'Maximum vessel age (years)', t: 'number', min: 1 }, d.maxAge || 20)}
      ${field({ k: 'note', l: 'Anything else an owner must know', t: 'textarea', wide: true, ph: 'Berth restrictions, draught limits, lightering, receivers’ requirements' }, d.note)}
    </div></fieldset>
    <fieldset><legend>4. Who may see it</legend>
      <div class="radios">${Object.keys(VISIBILITY).map(k => `<label><input type="radio" name="vis" value="${k}"${(d.vis || 'open') === k ? ' checked' : ''}><span><strong>${VISIBILITY[k][0]}</strong>${VISIBILITY[k][1]}</span></label>`).join('')}</div>
      <div class="grid"><div class="field wide"><span class="lbl">Shortlist <small>used only for “Shortlist only”</small></span><div class="checks">${invitees.map(c => `<label><input type="checkbox" name="shortlist[]" value="${c.id}"${(d.shortlist || []).includes(c.id) ? ' checked' : ''}> ${esc(c.name)}, ${ROLE_NAME[c.role].toLowerCase()}</label>`).join('')}</div></div>
      ${field({ k: 'deadlineH', l: 'Offers close in', t: 'select', o: [['12', '12 hours'], ['24', '24 hours'], ['48', '2 days'], ['96', '4 days'], ['168', '7 days']], req: true }, d.deadlineH || '48')}</div>
    </fieldset>
    <fieldset><legend>5. Evidence of cargo</legend><div class="grid">
      <div class="field wide"><label for="f_ev">Sales contract, stem confirmation or letter of credit <small>optional now, needed before the listing goes live</small></label><input id="f_ev" type="file" name="evidence"><p class="hint">Only the desk sees this. Owners see “evidence seen by the desk”. Files are not uploaded anywhere in this prototype.</p></div>
      <div class="field wide"><label class="check"><input type="checkbox" name="decl" required> I confirm the cargo, its origin and the parties to the sale are not subject to UK, EU, US or UN sanctions.</label></div>
    </div></fieldset>
    <div class="form-end"><button class="btn btn-primary btn-lg">Submit for desk review</button><p class="fine">The desk reviews every listing before it goes live, usually within the hour.</p></div></form>`}</section>`;
});
FORM.cargo = (d, form) => {
  if (d.to < d.from) return toast('The laycan ends before it starts');
  if (d.vis === 'shortlist' && !(d.shortlist || []).length) return toast('Choose at least one company for the shortlist');
  const hasFile = form.querySelector('[name=evidence]').files.length > 0;
  const c = { id: nid('g'), by: myId(), seg: d.seg, type: d.type, cargo: d.type === 'time' ? 'Time charter: ' + d.cargo.toLowerCase() : d.cargo, qty: Number(d.qty), tol: Number(d.tol || 0), load: d.load, disch: d.disch, from: d.from, to: d.to, x: d.x, duration: d.duration,
    terms: d.terms || 'Not applicable', cp: d.cp, idea: Number(d.idea || 0), rateType: d.rateType, dem: Number(d.dem || 0), maxAge: Number(d.maxAge || 0), vis: d.vis, shortlist: d.shortlist || [], deadline: Date.now() + Number(d.deadlineH) * HOUR,
    evidence: hasFile ? 'Document received, awaiting desk review' : 'Awaiting evidence', posted: Date.now(), status: 'review', note: d.note };
  S.cargoes.push(c); delete S.draft.cargo; save(); go('cargo/' + c.id); toast('Cargo submitted for desk review');
};

/* ---------- Create an account ---------- */
route('join', () => {
  const q = render.q, claim = q.get('claim') || (S.draft.join || {}).claim || '';
  const jd = Object.assign({ name: q.get('name') || '', country: q.get('country') || '' }, S.draft.join || {}), role = jd.role || (claim || q.get('role') === 'supplier' ? 'supplier' : 'charterer');
  const extra = {
    charterer: [{ k: 'commodities', l: 'What you ship', ph: 'Grain, fertiliser', req: true }, { k: 'volume', l: 'Rough annual volume', ph: '4 to 6 shiploads' }, { k: 'side', l: 'Your place in the trade', t: 'select', o: ['Seller', 'Buyer', 'Trader', 'Freight forwarder or logistics'] }],
    owner: [{ k: 'fleet', l: 'Vessels you control', t: 'number', min: 0, req: true }, { k: 'capacity', l: 'Your capacity', t: 'select', o: ['Registered owner', 'Disponent owner', 'Commercial manager'] }, { k: 'manager', l: 'Technical manager, if separate' }],
    supplier: [{ k: 'services', l: 'What you supply or service', ph: 'Deck and engine stores, provisions, safety equipment', req: true }, { k: 'portsServed', l: 'Ports you cover', ph: 'Rotterdam, Antwerp, Amsterdam' }, { k: 'certs', l: 'Certificates and memberships', ph: 'ISO 9001, IMPA, ISSA' }],
    broker: [{ k: 'markets', l: 'Markets you cover', ph: 'Dry cargo, Black Sea and Mediterranean', req: true }, { k: 'pii', l: 'Professional indemnity insurance', t: 'select', o: ['In place', 'Being arranged', 'None'] }, { k: 'member', l: 'Trade body membership', ph: 'Baltic Exchange, ICS, national association' }]
  }[role];
  return `<section class="page narrow"><div class="page-head"><div><h1>Create an account</h1><p>An account starts your passport. You can look around straight away; listing and offering open up once the first checks are done.</p></div></div>
    ${claim ? `<div class="notice notice-ok"><p><strong>Claiming the profile for ${esc(jd.name || 'your company')}.</strong> To confirm you speak for the company, the desk replies to an address at the company’s own domain before the profile is released to you.</p></div>` : ''}
    <form class="form" data-form="join"><input type="hidden" name="claim" value="${esc(claim)}">
    <fieldset><legend>1. What you do</legend><div class="radios">${[['charterer', 'I have cargo to move', 'Post cargoes and receive firm offers.'], ['owner', 'I own or manage vessels', 'List ships, post open positions and bid on cargoes.'], ['broker', 'I am a broker', 'Offer on behalf of owners or charterers, with your mandate and commission on record.'], ['supplier', 'I supply or service ships', 'Claim your directory profile, list services and ports, and receive requests.']].map(r => `<label><input type="radio" name="role" value="${r[0]}" data-live="reseg"${role === r[0] ? ' checked' : ''}><span><strong>${r[1]}</strong>${r[2]}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>2. Your company</legend><div class="grid">
      ${field({ k: 'name', l: 'Registered company name', req: true }, jd.name)}${field({ k: 'country', l: 'Country of registration', req: true }, jd.country)}
      ${field({ k: 'regno', l: 'Registration number', req: true }, jd.regno)}${field({ k: 'website', l: 'Website', t: 'url' }, jd.website)}
      ${extra.map(f => field(f, jd[f.k])).join('')}
    </div></fieldset>
    <fieldset><legend>3. You</legend><div class="grid">
      ${field({ k: 'contact', l: 'Your name', req: true }, jd.contact)}${field({ k: 'title', l: 'Position' }, jd.title)}
      ${field({ k: 'email', l: 'Work email', t: 'email', req: true }, jd.email)}${field({ k: 'phone', l: 'Phone, with country code', t: 'tel' }, jd.phone)}
      <div class="field wide"><label class="check"><input type="checkbox" name="decl" required> I am authorised to act for this company, and neither it nor its owners are subject to sanctions.</label></div>
    </div></fieldset>
    <div class="form-end"><button class="btn btn-primary btn-lg">Create account and open my passport</button><p class="fine">Sign-in is not built in this prototype, so nothing you type leaves your browser.</p></div></form></section>`;
});
FORM.join = d => {
  const id = nid(d.role[0] + '-');
  S.companies.push({ id, name: d.name, role: d.role, country: d.country, since: new Date().getFullYear(), verified: 'unverified', level: 0, fixtures: 0, respH: 0, about: d.commodities || d.markets || d.services || (d.fleet ? d.fleet + ' vessels' : ''), isNew: true, claim: d.claim || '', portsServed: d.portsServed });
  S.me[d.role] = id; S.role = d.role; delete S.draft.join; save(); go('passport'); toast('Account created. Your passport is open.');
};

/* ---------- Passport and company profile ---------- */
function checksFor(c) { return CHECKS.all.concat(CHECKS[c.role] || []); }
function passportOf(c) {
  if (!S.passport[c.id]) {
    const list = checksFor(c), n = Math.round(c.level / 7 * list.length), p = {};
    list.forEach((k, i) => { p[k.k] = i < n ? 'verified' : i === n && c.verified === 'review' ? 'review' : 'missing'; });
    S.passport[c.id] = p;
  }
  return S.passport[c.id];
}
function recalc(c) {
  const p = passportOf(c), list = checksFor(c), done = list.filter(k => p[k.k] === 'verified').length;
  c.level = Math.round(done / list.length * 7);
  const core = ['reg', 'ubo', 'sanc'].every(k => p[k] === 'verified');
  c.verified = core ? 'verified' : list.some(k => p[k.k] !== 'missing') ? 'review' : 'unverified';
}
function companyPage(c, own) {
  const p = passportOf(c), list = checksFor(c), desk = S.role === 'desk';
  const ST = { verified: ['Verified', 'ok'], review: ['In review', 'warn'], missing: ['Not provided', 'muted'] };
  const fleet = S.vessels.filter(v => v.owner === c.id);
  return `<section class="page">
    <div class="page-head"><div><h1>${own ? 'Your passport' : esc(c.name)}</h1><p>${own ? esc(c.name) + '. ' : ''}${ROLE_NAME[c.role] || 'Member'}, ${esc(c.country)}. Member since ${c.since}.</p></div>${own ? `<button class="btn" data-act="sharePassport">Copy a link to share</button>` : ''}</div>
    <div class="cols">
      <div>
        <section class="block"><h2>What has been checked</h2>
          <div class="tbl"><table><thead><tr><th>Check</th><th>Why a counterparty cares</th><th>Status</th>${own || desk ? '<th></th>' : ''}</tr></thead><tbody>
          ${list.map(k => `<tr><td><strong>${esc(k.l)}</strong>${own ? `<span class="sub">${esc(k.doc)}</span>` : ''}</td><td>${esc(k.why)}</td><td>${tag(ST[p[k.k]][0], ST[p[k.k]][1])}</td>
            ${own ? `<td>${p[k.k] === 'missing' ? `<button class="btn btn-sm" data-act="provide" data-k="${k.k}">${k.k === 'sanc' ? 'Request screening' : 'Provide'}</button>` : ''}</td>` : desk ? `<td>${p[k.k] !== 'verified' ? `<button class="btn btn-sm" data-act="verifyCheck" data-c="${c.id}" data-k="${k.k}">Mark verified</button>` : ''}</td>` : ''}</tr>`).join('')}
          </tbody></table></div>
          <p class="fine">${own ? 'Counterparties see the status of each check, never the documents. In this prototype “Provide” simply moves a check into review; switch to the desk view to approve it.' : 'You see the status of each check. Documents stay with the desk.'}</p></section>
        ${fleet.length ? `<section class="block"><h2>Fleet</h2><div class="list">${fleet.map(vesselRow).join('')}</div></section>` : ''}
      </div>
      <aside>
        <div class="card center">${marks(c.level, true)}<h3>Level ${c.level} of 7</h3><p>${c.verified === 'verified' ? 'Verified' : c.verified === 'review' ? 'In review' : 'Not yet verified'}</p>
          <p class="fine">The level counts completed checks. Company, ownership and sanctions checks must all clear before a profile shows as verified.</p></div>
        <div class="card"><h3>Track record</h3>${kv([['Completed fixtures here', String(c.fixtures)], ['Typical response time', c.respH ? c.respH + ' hours' : 'No history yet'], ['Rating', c.rating ? c.rating + ' of 5' : 'No ratings yet']])}
          <p class="fine">Track record is earned on the platform and cannot be bought or imported.</p></div>
      </aside>
    </div></section>`;
}
route('passport', () => S.role === 'guest' ? `<section class="page narrow">${empty('Your passport starts with an account', 'Create an account, or look at the sample market as a cargo owner, vessel owner or broker.', '<a class="btn btn-primary" href="#/join">Create an account</a>')}</section>` : companyPage(me(), true));
route('company/:id', id => { const c = S.companies.find(x => x.id === id); return c ? companyPage(c, c.id === myId()) : null; });
ACT.provide = d => { const c = me(); passportOf(c)[d.k] = 'review'; recalc(c); save(); render(); toast('Sent to the desk for review'); };
ACT.verifyCheck = d => { const c = co(d.c); passportOf(c)[d.k] = 'verified'; recalc(c); save(); render(); toast('Check marked verified'); };
ACT.sharePassport = () => {
  const url = location.origin + location.pathname + '#/company/' + myId();
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link copied'), () => toast(url));
};

/* ---------- Paste an enquiry: pick the main terms out of free text ---------- */
function parseEnquiry(text) {
  const low = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ', out = { x: {} }, found = [];
  let m = low.match(/(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?\s?k|\d{3,6})\s*(?:mts?|tons?|tonnes?|t)\b/);
  if (m) { const q = m[1].replace(/\s/g, ''); out.qty = /k$/.test(q) ? parseFloat(q) * 1000 : Number(q.replace(/[,.]/g, '')); found.push('quantity'); }
  m = low.match(/(\d{1,2})\s*(?:%|pct|pc)\s*(?:moloo|molchopt|mol\b|more or less)/);
  if (m) { out.tol = ['0', '5', '10'].includes(m[1]) ? m[1] : '10'; found.push('tolerance'); }
  const syn = { ulsd: ['tanker', 'Gasoil / diesel'], gasoil: ['tanker', 'Gasoil / diesel'], diesel: ['tanker', 'Gasoil / diesel'], mogas: ['tanker', 'Gasoline'], 'jet a': ['tanker', 'Jet fuel'], crude: ['tanker', 'Crude oil'], 'iron ore': ['bulk', 'Iron ore'], coal: ['bulk', 'Steam coal'], cement: ['bulk', 'Bulk cement'], sugar: ['bulk', 'Raw sugar'], rice: ['bulk', 'Bagged rice'], steel: ['bulk', 'Steel coils'], lpg: ['gas', 'Propane / butane mix'], grain: ['bulk', 'Wheat'], fertiliser: ['bulk', 'Urea'], fertilizer: ['bulk', 'Urea'] };
  let hit = null;
  Object.keys(SEG).forEach(k => SEG[k].cargoes.forEach(c => { if (!hit && low.includes(c.toLowerCase())) hit = [k, c]; }));
  if (!hit) Object.keys(syn).forEach(k => { if (!hit && low.includes(k)) hit = syn[k]; });
  if (hit) { out.seg = hit[0]; out.cargo = hit[1]; found.push('cargo'); }
  const ports = PORTS.map(p => [low.indexOf(p.name.toLowerCase()), p.name]).filter(p => p[0] >= 0).sort((a, b) => a[0] - b[0]);
  if (ports[0]) { out.load = ports[0][1]; found.push('load port'); }
  if (ports[1]) { out.disch = ports[1][1]; found.push('discharge port'); }
  m = low.match(/(\d{1,2})\s*(?:-|–|\/|to)\s*(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (m) {
    const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[3]), now = new Date();
    let y = now.getUTCFullYear(); if (new Date(Date.UTC(y, mon, Number(m[2]))) < now) y++;
    const iso = d => new Date(Date.UTC(y, mon, Number(d))).toISOString().slice(0, 10);
    out.from = iso(m[1]); out.to = iso(m[2]); found.push('laycan');
  }
  const rates = [...low.matchAll(/(\d{1,3}(?:[,.]\d{3})|\d{4,5})\s*(?:mts?|t)?\s*(?:shinc|shex|pwwd|wwd|per day|pd\b)/g)].map(r => Number(r[1].replace(/[,.]/g, '')));
  if (rates[0]) { out.x.loadRate = rates[0]; found.push('load rate'); }
  if (rates[1]) { out.x.dischRate = rates[1]; found.push('discharge rate'); }
  m = low.match(/(?:usd|\$)\s*(\d+(?:\.\d+)?)\s*(?:pmt|per\s*(?:mt|ton|tonne))/);
  if (m) { out.idea = Number(m[1]); out.rateType = 'USD per tonne'; found.push('freight idea'); }
  return { out, found };
}
ACT.parseEnquiry = () => {
  const text = ($('#pasteBox') || {}).value || '';
  if (text.trim().length < 10) return toast('Paste the enquiry text first');
  const { out, found } = parseEnquiry(text);
  if (!found.length) return toast('Nothing recognised. Fill the form by hand.');
  const d = S.draft.cargo || { x: {} };
  S.draft.cargo = Object.assign({}, d, out, { x: Object.assign({}, d.x, out.x), type: d.type || 'voyage' });
  save(); render(); toast('Filled: ' + found.join(', ') + '. Check every field.');
};
