/* FindAVessel prototype: fixtures, the deal room, payments, the desk and the guide. */
'use strict';

/* Payments adapter. A regulated escrow or banking partner plugs in here; the prototype only simulates the states. */
const PaymentProvider = {
  name: null, /* e.g. an escrow agent or bank once contracted */
  connected: false,
  deposit(deal, milestone) { milestone.st = 'done'; milestone.at = Date.now(); return { simulated: true }; },
  release(deal, milestone) { milestone.st = 'done'; milestone.at = Date.now(); return { simulated: true }; }
};

/* ---------- Accepting an offer creates a deal on subjects ---------- */
ACT.accept = d => {
  const o = S.offers.find(x => x.id === d.id), c = cargoById(o.cargo);
  const root = S.offers.find(x => x.id === threadOf(o)) || o;
  const v = o.vessel ? vessel(o.vessel) : null;
  const broker = root.role === 'broker' ? root.by : null;
  const time = c.type === 'time';
  const deal = { id: nid('d'), cargo: c.id, offer: o.id, seg: c.seg, title: `${c.cargo}, ${time ? 'time charter' : num(o.qty) + ' t'}, ${c.load} to ${c.disch}`,
    charterer: c.by, owner: v ? v.owner : root.role === 'owner' ? root.by : null, broker, vessel: o.vessel, vesselName: o.vesselName, stage: 0,
    terms: { cargo: c.cargo, qty: o.qty, tol: c.tol, load: c.load, disch: c.disch, from: o.from, to: o.to, rateType: o.rateType, rate: o.rate, dem: o.dem, laytime: o.laytime, loadRate: (c.x || {}).loadRate, dischRate: (c.x || {}).dischRate, cp: o.cp, commAddr: o.commAddr, commBrok: o.commBrok, freightTerms: c.terms,
      actingFor: broker ? co(broker).name + ' act for the ' + (root.actingFor || 'owner').toLowerCase() : 'Principals dealing direct. FindAVessel desk acts as intermediary only.' },
    subjects: [...new Set([...(o.subjects || []), 5, 7])].sort().map(i => ({ n: SUBJECTS[i], due: Date.now() + (i === 7 ? 72 : i === 6 ? 48 : 24) * HOUR, st: 'open' })),
    pay: time ? [
      { n: 'First 15 days of hire and value of fuel on delivery', pct: null, trigger: 'Before delivery of the vessel', st: 'pending' },
      { n: 'Hire, every 15 days in advance', pct: null, trigger: 'Each hire due date', st: 'pending' },
      { n: 'Final hire statement', pct: null, trigger: 'Redelivery and fuel reconciliation', st: 'pending' }
    ] : [
      { n: 'Freight deposited with escrow partner', pct: 100, trigger: 'Before notice of readiness at load port', st: 'pending' },
      { n: 'First release to owner', pct: 95, trigger: 'Bills of lading signed, both sides confirm', st: 'pending', needs: 'Bills of lading signed' },
      { n: 'Balance and demurrage or despatch', pct: 5, trigger: 'Discharge completed and laytime statement agreed', st: 'pending', needs: 'Discharge completed' }
    ],
    log: [], docs: [['Fixture recap', 'Generated', Date.now()]], msgs: [], created: Date.now() };
  o.status = 'accepted'; c.status = 'on subjects';
  S.offers.filter(x => x.cargo === c.id && x.id !== o.id && x.status === 'firm').forEach(x => { x.status = 'declined'; });
  S.deals.push(deal); save(); go('deal/' + deal.id + '/subjects'); toast('Agreed on subjects. The clocks are running.');
};

/* ---------- Deals list ---------- */
const inDeal = d => S.role === 'desk' || [d.charterer, d.owner, d.broker].includes(myId());
const stageName = d => d.failed ? 'Failed on subjects' : STAGES[d.stage];
function dealRow(d) {
  const open = d.subjects.filter(s => s.st === 'open');
  return `<a class="lrow" href="#/deal/${d.id}">
    <div class="l-main"><strong>${esc(d.title)}</strong><span>${d.vessel ? esc(vessel(d.vessel).name) : 'Vessel to be nominated'}</span></div>
    <div class="l-route"><strong>${esc(co(d.charterer).name)}</strong><span>with ${esc(d.owner ? co(d.owner).name : 'owner to be named')}</span></div>
    <div class="l-rate"><strong>${rateStr(d.terms)}</strong><span>Laycan ${laycan(d.terms.from, d.terms.to)}</span></div>
    <div class="l-meta">${tag(stageName(d), d.failed ? 'bad' : d.stage ? 'ok' : 'warn')}${!d.failed && open.length ? `<span class="clock">${open.length} ${open.length === 1 ? 'subject' : 'subjects'} open</span>` : ''}</div></a>`;
}
route('deals', () => {
  const list = S.deals.filter(inDeal).sort((a, b) => b.created - a.created);
  return `<section class="page"><div class="page-head"><div><h1>Deals</h1><p>${S.role === 'desk' ? 'Every deal on the platform.' : 'Deals you are a party to, from subjects to settlement.'}</p></div></div>
    <div class="list">${list.length ? list.map(dealRow).join('') : empty('No deals yet', S.role === 'guest' ? 'Choose a role at the top to see the sample deal.' : 'A deal appears here when an offer is accepted on subjects.', '<a class="btn" href="#/cargoes">Go to cargoes</a>')}</div></section>`;
});

/* ---------- Deal room ---------- */
const TABS = [['recap', 'Recap'], ['subjects', 'Subjects'], ['payments', 'Payments'], ['log', 'Time log'], ['files', 'Documents and messages'], ['dispute', 'Dispute']];
function recapText(d) {
  const t = d.terms, v = d.vessel ? vessel(d.vessel) : null, gf = grossFreight(t);
  return [
    'FIXTURE RECAP' + (d.stage === 0 && !d.failed ? ' (ON SUBJECTS)' : d.failed ? ' (FAILED ON SUBJECTS)' : ' (CLEAN)'),
    'Date: ' + dlong(d.created), '',
    'Charterer: ' + co(d.charterer).name, 'Owner: ' + (d.owner ? co(d.owner).name : 'To be named with the performing vessel'),
    d.broker ? 'Broker: ' + co(d.broker).name : null, t.actingFor, '',
    'Vessel: ' + (v ? `MV ${v.name}, ${v.subtype}, ${num(v.size)} ${SEG[v.seg].metric}, built ${v.built}, ${v.flag} flag, class ${v.cls}, P&I ${v.pi}` : d.vesselName || 'To be nominated'),
    'Cargo: ' + num(t.qty) + ' tonnes ' + t.cargo + (t.tol ? ', ' + t.tol + '% more or less in owner’s option' : ''),
    'Load: one safe port, one safe berth ' + t.load, 'Discharge: one safe port, one safe berth ' + t.disch,
    'Laycan: ' + dlong(t.from) + ' to ' + dlong(t.to),
    'Freight: ' + rateStr(t) + (t.freightTerms && t.freightTerms !== 'Not applicable' ? ', ' + t.freightTerms : '') + (gf ? ' (about ' + usd(gf) + ')' : ''),
    'Payment: freight held by the escrow partner before notice of readiness; 95% released on signing bills of lading, balance with demurrage or despatch after discharge',
    t.laytime ? 'Laytime: ' + t.laytime : null, t.dem ? 'Demurrage: ' + usd(t.dem) + ' per day pro rata; despatch at half demurrage on laytime saved' : null,
    'Commission: ' + t.commAddr + '% address, ' + t.commBrok + '% brokerage, deducted from freight on release',
    'Charter party: ' + t.cp + ', logically amended to these terms', 'Law and arbitration: English law, London arbitration, LMAA terms',
    'Sanctions: each party warrants it is not a sanctioned party; either may terminate if that changes', '',
    'Subjects:', ...d.subjects.map(s => '  ' + (s.st === 'lifted' ? '[lifted] ' : s.st === 'failed' ? '[failed] ' : '[open]   ') + s.n + (s.st === 'open' ? ', by ' + dtime(s.due) : ''))
  ].filter(x => x != null).join('\n');
}
function laytimeBox(d) {
  const t = d.terms; if (!t.loadRate) return '';
  const allowedL = t.qty / t.loadRate, allowedD = t.dischRate ? t.qty / t.dischRate : 0;
  const ev = n => d.log.find(e => e.e === n && e.o && e.c);
  const nor = ev(VOYAGE_EVENTS[1]), done = ev(VOYAGE_EVENTS[3]);
  const used = nor ? ((done ? done.t : Date.now()) - nor.t) / DAY : 0, over = Math.max(0, used - allowedL);
  return `<div class="card"><h3>Laytime, indicative</h3>${kv([['Allowed at load port', num(Math.round(allowedL * 100) / 100) + ' days'], ['Allowed at discharge port', allowedD ? num(Math.round(allowedD * 100) / 100) + ' days' : ''],
    ['Elapsed since notice of readiness', nor ? num(Math.round(used * 100) / 100) + ' days' + (done ? '' : ', still counting') : 'Not started: notice of readiness not confirmed by both sides'], ['Demurrage on that basis', over && t.dem ? usd(over * t.dem) : 'None so far']])}
    <p class="fine">Counts confirmed events only and ignores turn time, weather and other exceptions in the charter party. It is a prompt for the laytime statement, not a substitute.</p></div>`;
}
route('deal/:id', id => dealRoom(id, 'recap'));
route('deal/:id/:tab', (id, tab) => dealRoom(id, tab));
function dealRoom(id, tab) {
  const d = S.deals.find(x => x.id === id);
  if (!d) return null;
  if (!inDeal(d)) return `<section class="page narrow"><div class="notice"><p><strong>This deal is private to its parties.</strong> View as the cargo owner, the vessel owner or the desk to open the sample deal.</p><div class="row"><button class="btn" data-act="role" data-role="charterer">View as cargo owner</button><button class="btn" data-act="role" data-role="owner">View as vessel owner</button></div></div></section>`;
  const t = d.terms, side = myId() === d.owner ? 'o' : myId() === d.charterer ? 'c' : null, desk = S.role === 'desk';
  let body = '';
  if (tab === 'recap') {
    body = `<div class="cols"><div><section class="block"><h2>Recap</h2><pre class="recap">${esc(recapText(d))}</pre><div class="row"><button class="btn btn-sm" data-act="copyRecap" data-id="${d.id}">Copy recap</button></div>
      <p class="fine">Generated from the accepted offer. It is the contract until the charter party is signed.</p></section></div>
      <aside><div class="card"><h3>Parties</h3>${[['Charterer', d.charterer], ['Owner', d.owner], ['Broker', d.broker]].filter(x => x[1]).map(x => `<p><span class="sub">${x[0]}</span><a href="#/company/${x[1]}"><strong>${esc(co(x[1]).name)}</strong></a><br>${passportChip(co(x[1]))}</p>`).join('')}<p class="fine">${esc(t.actingFor)}</p></div>
      ${d.stage >= 5 ? rateBox(d) : ''}</aside></div>`;
  } else if (tab === 'subjects') {
    body = `<section class="block"><h2>Subjects</h2><p>The deal is conditional until every subject is lifted. If one is not lifted by its deadline, either side may walk away with nothing owed.</p>
      <div class="tbl"><table><thead><tr><th>Subject</th><th>Deadline</th><th>Status</th><th></th></tr></thead><tbody>${d.subjects.map((s, i) => {
        const auto = s.n === SUBJECTS[7], deskOnly = s.n === SUBJECTS[5];
        return `<tr><td><strong>${esc(s.n)}</strong>${s.by ? `<span class="sub">Lifted by ${esc(s.by)}</span>` : auto ? '<span class="sub">Lifts when the deposit is confirmed under Payments</span>' : deskOnly ? '<span class="sub">Lifted by the desk after screening both parties, the vessel and the cargo origin</span>' : ''}</td>
          <td>${dtime(s.due)}${s.st === 'open' ? `<span class="sub clock">${until(s.due) === 'expired' ? 'Deadline passed' : until(s.due) + ' left'}</span>` : ''}</td><td>${tag(s.st === 'lifted' ? 'Lifted' : s.st === 'failed' ? 'Failed' : 'Open', s.st === 'lifted' ? 'ok' : s.st === 'failed' ? 'bad' : 'warn')}</td>
          <td>${s.st === 'open' && !d.failed ? (auto ? `<a class="btn btn-sm" href="#/deal/${d.id}/payments">Go to payments</a>` : deskOnly && !desk ? '' : `<button class="btn btn-sm" data-act="lift" data-id="${d.id}" data-i="${i}">Lift</button> <button class="btn btn-ghost btn-sm" data-act="failSubject" data-id="${d.id}" data-i="${i}">Fail</button>`) : ''}</td></tr>`;
      }).join('')}</tbody></table></div>
      ${d.failed ? '<div class="notice"><p><strong>Failed on subjects.</strong> Both sides are released and the cargo is back on the board.</p></div>' : d.stage > 0 ? '<div class="notice notice-ok"><p><strong>Clean fixed.</strong> All subjects lifted.</p></div>' : ''}</section>`;
  } else if (tab === 'payments') {
    const gf = grossFreight(t), addr = gf * t.commAddr / 100, brok = gf * t.commBrok / 100;
    body = `<div class="cols"><div><section class="block"><h2>Payment schedule</h2>
      <div class="tbl"><table><thead><tr><th>Step</th><th>Released when</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${d.pay.map((m, i) => {
        const amt = gf && m.pct ? (i === 0 ? gf : (gf - addr - brok) * m.pct / 100) : null;
        const ready = !m.needs || d.log.some(e => e.e === m.needs && e.o && e.c);
        const prevDone = i === 0 || d.pay[i - 1].st === 'done';
        return `<tr><td><strong>${esc(m.n)}</strong></td><td>${esc(m.trigger)}</td><td>${amt ? usd(amt) : 'Per hire statement'}</td><td>${tag(m.st === 'done' ? 'Done' : 'Pending', m.st === 'done' ? 'ok' : 'warn')}${m.at ? `<span class="sub">${dtime(m.at)}</span>` : ''}</td>
          <td>${m.st !== 'done' && !d.failed && (side === 'c' || desk) ? (prevDone && ready ? `<button class="btn btn-sm" data-act="pay" data-id="${d.id}" data-i="${i}">${i === 0 ? 'Simulate deposit' : 'Simulate release'}</button>` : `<span class="sub">${!prevDone ? 'Waits for the step above' : 'Waits for “' + esc(m.needs) + '” confirmed by both sides in the time log'}</span>`) : ''}</td></tr>`;
      }).join('')}</tbody></table></div>
      <p class="fine">Commission is deducted on release: the owner never has to chase a charterer for it and the broker never has to chase the owner.</p></section></div>
      <aside><div class="card"><h3>Payment partner</h3><p><strong>${PaymentProvider.connected ? esc(PaymentProvider.name) : 'Not connected'}</strong></p><p class="fine">No money moves in this prototype. Holding client funds is a regulated activity, so this step is designed for a licensed escrow agent or bank to plug into. The states and release rules are already modelled.</p></div>
      ${gf ? `<div class="card"><h3>Freight account</h3>${kv([['Gross freight', usd(gf)], ['Address commission, ' + t.commAddr + '%', usd(addr)], ['Brokerage, ' + t.commBrok + '%', usd(brok)], ['Net to owner', usd(gf - addr - brok)]])}<p class="fine">On ${num(t.qty)} t. Final freight follows the bill of lading quantity.</p></div>` : ''}</aside></div>`;
  } else if (tab === 'log') {
    body = `<div class="cols"><div><section class="block"><h2>Time log</h2><p>Each event is entered by one side and confirmed by the other. Confirmed events drive laytime and payment releases.</p>
      ${d.log.length ? `<div class="tbl"><table><thead><tr><th>Event</th><th>Time</th><th>Owner</th><th>Charterer</th><th></th></tr></thead><tbody>${d.log.slice().sort((a, b) => a.t - b.t).map(e => {
        const i = d.log.indexOf(e);
        return `<tr><td><strong>${esc(e.e)}</strong>${e.note ? `<span class="sub">${esc(e.note)}</span>` : ''}</td><td>${dtime(e.t)}</td><td>${e.o ? tag('Confirmed', 'ok') : tag('Waiting', 'warn')}</td><td>${e.c ? tag('Confirmed', 'ok') : tag('Waiting', 'warn')}</td>
          <td>${(side === 'o' && !e.o) || (side === 'c' && !e.c) ? `<button class="btn btn-sm" data-act="confirmEvent" data-id="${d.id}" data-i="${i}">Confirm</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="fine">No events yet. The first is usually the vessel’s arrival at the load port.</p>'}
      ${d.stage >= 1 && !d.failed ? `<form class="form inline" data-form="event" data-id="${d.id}"><div class="grid">
        ${field({ k: 'e', l: 'Event', t: 'select', o: VOYAGE_EVENTS, req: true }, '')}${field({ k: 't', l: 'Time (UTC)', t: 'datetime-local', req: true }, new Date().toISOString().slice(0, 16))}${field({ k: 'note', l: 'Note', wide: true }, '')}
        </div><button class="btn">Add event</button></form>` : '<p class="fine">Events can be logged once the deal is clean fixed.</p>'}</section></div>
      <aside>${laytimeBox(d)}</aside></div>`;
  } else if (tab === 'files') {
    body = `<div class="cols"><div><section class="block"><h2>Messages</h2><div class="msgs">${d.msgs.slice().sort((a, b) => a[2] - b[2]).map(m => `<div class="msg${m[0] === myId() ? ' msg-me' : ''}"><span class="sub">${esc(co(m[0]).name)}, ${ago(m[2])}</span><p>${esc(m[1])}</p></div>`).join('') || '<p class="fine">No messages yet. Everything said here stays on the deal record.</p>'}</div>
      <form class="form inline" data-form="msg" data-id="${d.id}">${field({ k: 'text', l: 'Message', t: 'textarea', req: true }, '')}<button class="btn">Send message</button></form></section></div>
      <aside><div class="card"><h3>Documents</h3><ul class="doclist">${d.docs.map(x => `<li><strong>${esc(x[0])}</strong><span class="sub">${esc(x[1])}, ${dstr(x[2])}</span></li>`).join('')}</ul>
      <form data-form="doc" data-id="${d.id}">${field({ k: 'name', l: 'Add a document', t: 'select', o: ['Signed charter party', 'Bill of lading', 'Statement of facts', 'Notice of readiness', 'Laytime statement', 'Freight invoice', 'Survey report', 'Other'], req: true }, '')}<button class="btn btn-sm">Add to the record</button></form><p class="fine">Files are not uploaded anywhere in this prototype.</p></div></aside></div>`;
  } else if (tab === 'dispute') {
    const x = d.dispute;
    body = `<section class="block narrow"><h2>Dispute</h2>${x ? `
      ${kv([['Raised by', co(x.by).name], ['About', x.cat], ['Amount in dispute', x.amount ? usd(x.amount) : 'Not stated'], ['Raised', dtime(x.at)], ['Status', x.status]])}<p class="note">${esc(x.text)}</p>
      <ol class="steps steps-v"><li><h3>Raised</h3><p>Both sides and the desk are notified. Any undisbursed funds linked to the amount stay with the payment partner.</p></li><li><h3>Desk mediation</h3><p>Five working days, working from the recap, the offers, the messages and the confirmed time log.</p></li><li><h3>Arbitration</h3><p>If still open, the charter party clause applies: London arbitration on LMAA terms, with the small claims procedure for lower amounts.</p></li></ol>
      ${desk && x.status !== 'Resolved' ? `<button class="btn" data-act="resolveDispute" data-id="${d.id}">Mark resolved</button>` : ''}` : `
      <p>Most disputes in chartering are about time: when laytime started, what interrupted it and what demurrage follows. Raise it here and the whole deal record goes with it.</p>
      ${side ? `<form class="form" data-form="dispute" data-id="${d.id}"><div class="grid">${field({ k: 'cat', l: 'About', t: 'select', o: ['Demurrage or laytime', 'Cargo quantity or condition', 'Vessel description or performance', 'Payment', 'Cancellation or failure to perform', 'Other'], req: true }, '')}${field({ k: 'amount', l: 'Amount in dispute (USD)', t: 'number', min: 0 }, '')}${field({ k: 'text', l: 'What happened', t: 'textarea', wide: true, req: true }, '')}</div><button class="btn">Raise dispute</button></form>` : '<p class="fine">Only the charterer or the owner can raise a dispute.</p>'}`}</section>`;
  }
  return `<section class="page">
    <a class="back" href="#/deals">All deals</a>
    <div class="page-head"><div><h1>${esc(d.title)}</h1><p>${d.vessel ? esc(vessel(d.vessel).name) : esc(d.vesselName || 'Vessel to be nominated')}. ${rateStr(t)}. Laycan ${laycan(t.from, t.to)}.</p></div>${tag(stageName(d), d.failed ? 'bad' : d.stage ? 'ok' : 'warn')}</div>
    <ol class="track" aria-label="Deal stage">${STAGES.map((s, i) => `<li class="${d.failed ? '' : i < d.stage ? 'done' : i === d.stage ? 'now' : ''}"${i === d.stage && !d.failed ? ' aria-current="step"' : ''}>${s}</li>`).join('')}</ol>
    <nav class="tabs" aria-label="Deal sections">${TABS.map(x => `<a href="#/deal/${d.id}/${x[0]}"${tab === x[0] ? ' aria-current="page"' : ''}>${x[1]}${x[0] === 'subjects' && d.subjects.some(s => s.st === 'open') && !d.failed ? ` <b>${d.subjects.filter(s => s.st === 'open').length}</b>` : ''}</a>`).join('')}</nav>
    ${body}</section>`;
}
function rateBox(d) {
  const mine = (d.ratings || {})[myId()];
  if (S.role === 'desk' || S.role === 'broker') return '';
  return `<div class="card"><h3>Rate the other side</h3>${mine ? `<p>You rated this deal ${mine} of 5.</p>` : `<form data-form="rate" data-id="${d.id}">${field({ k: 'score', l: 'How did they perform?', t: 'select', o: [['5', '5: would fix again without hesitation'], ['4', '4: good'], ['3', '3: acceptable'], ['2', '2: problems'], ['1', '1: would not deal again']], req: true }, '5')}<button class="btn btn-sm">Submit rating</button></form>`}<p class="fine">Ratings only come from completed fixtures, one per side.</p></div>`;
}
const dealBy = id => S.deals.find(x => x.id === id);
function checkFixed(d) {
  if (d.stage === 0 && d.subjects.every(s => s.st === 'lifted')) {
    d.stage = 1; const c = cargoById(d.cargo); if (c) c.status = 'fixed';
    d.docs.push(['Charter party, ' + d.terms.cp, 'Draft for signature', Date.now()]); toast('Clean fixed. All subjects lifted.');
  }
}
ACT.lift = d => { const x = dealBy(d.id), s = x.subjects[d.i]; s.st = 'lifted'; s.by = me().name; checkFixed(x); save(); render(); };
ACT.failSubject = d => { const x = dealBy(d.id); x.subjects[d.i].st = 'failed'; x.failed = true; const c = cargoById(x.cargo); if (c) c.status = 'open'; save(); render(); toast('Failed on subjects. Both sides are released.'); };
ACT.pay = d => {
  const x = dealBy(d.id), m = x.pay[d.i];
  if (Number(d.i) === 0) { PaymentProvider.deposit(x, m); const s = x.subjects.find(s => s.n === SUBJECTS[7]); if (s && s.st === 'open') { s.st = 'lifted'; s.by = 'Escrow partner (simulated)'; } checkFixed(x); toast('Deposit simulated'); }
  else { PaymentProvider.release(x, m); toast('Release simulated'); }
  if (x.pay.every(p => p.st === 'done')) { x.stage = Math.max(x.stage, 5); }
  save(); render();
};
const EVENT_STAGE = { 'Loading commenced': 2, 'Vessel sailed load port': 3, 'Discharge commenced': 4 };
FORM.event = (f, form) => {
  const x = dealBy(form.dataset.id), side = myId() === x.owner ? 'o' : myId() === x.charterer ? 'c' : null;
  x.log.push({ e: f.e, t: new Date(f.t + 'Z').getTime(), o: side === 'o', c: side === 'c', note: f.note });
  if (EVENT_STAGE[f.e]) x.stage = Math.max(x.stage, EVENT_STAGE[f.e]);
  save(); render(); toast('Event added. The other side is asked to confirm.');
};
ACT.confirmEvent = d => { const x = dealBy(d.id), e = x.log[d.i]; if (myId() === x.owner) e.o = true; if (myId() === x.charterer) e.c = true; save(); render(); toast('Event confirmed'); };
FORM.msg = (f, form) => { dealBy(form.dataset.id).msgs.push([myId(), f.text, Date.now()]); save(); render(); };
FORM.doc = (f, form) => { dealBy(form.dataset.id).docs.push([f.name, 'Added by ' + me().name, Date.now()]); save(); render(); toast('Added to the record'); };
FORM.dispute = (f, form) => { dealBy(form.dataset.id).dispute = { by: myId(), cat: f.cat, amount: Number(f.amount || 0), text: f.text, at: Date.now(), status: 'Desk mediation' }; save(); render(); toast('Dispute raised'); };
ACT.resolveDispute = d => { dealBy(d.id).dispute.status = 'Resolved'; save(); render(); };
FORM.rate = (f, form) => {
  const x = dealBy(form.dataset.id); x.ratings = x.ratings || {}; x.ratings[myId()] = Number(f.score);
  if (x.ratings[x.owner] && x.ratings[x.charterer]) { x.stage = 6; [x.owner, x.charterer, x.broker].filter(Boolean).forEach(id => { co(id).fixtures++; }); }
  save(); render(); toast('Rating submitted');
};
ACT.copyRecap = d => { const txt = recapText(dealBy(d.id)); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Recap copied'), () => toast('Select the text to copy it')); };

/* ---------- Desk ---------- */
route('desk', () => {
  if (S.role === 'guest') return `<section class="page narrow">${empty('Choose who you are', 'Your desk shows your listings, offers and deals. Pick a role to see the sample data from that side.', `<div class="row"><button class="btn" data-act="role" data-role="charterer">Cargo owner</button><button class="btn" data-act="role" data-role="owner">Vessel owner</button><button class="btn" data-act="role" data-role="broker">Broker</button></div>`)}</section>`;
  const id = myId(), deals = S.deals.filter(inDeal);
  if (S.role === 'desk') {
    const review = S.cargoes.filter(c => c.status === 'review'), vrev = S.vessels.filter(v => v.verified !== 'verified'), crev = S.companies.filter(c => c.verified !== 'verified' && c.role !== 'desk');
    const fixed = S.deals.filter(d => d.stage >= 1 && !d.failed).length;
    return `<section class="page"><div class="page-head"><div><h1>Desk</h1><p>Review listings, clear passports and keep deals moving. Fixtures closed is the number that matters.</p></div></div>
      <div class="stats"><div><strong>${fixed}</strong><span>Fixtures closed</span></div><div><strong>${S.deals.filter(d => d.stage === 0 && !d.failed).length}</strong><span>On subjects</span></div><div><strong>${review.length}</strong><span>Listings to review</span></div><div><strong>${vrev.length + crev.length}</strong><span>Passports to clear</span></div></div>
      <section class="block"><h2>Listings awaiting review</h2><div class="list">${review.map(cargoRow).join('') || '<p class="fine">Nothing waiting.</p>'}</div></section>
      <section class="block"><h2>Passports to clear</h2><div class="list">${crev.map(c => `<a class="lrow" href="#/company/${c.id}"><div class="l-main"><strong>${esc(c.name)}</strong><span>${ROLE_NAME[c.role]}, ${esc(c.country)}</span></div><div class="l-meta">${passportChip(c)}</div></a>`).join('')}${vrev.map(vesselRow).join('') || ''}${!crev.length && !vrev.length ? '<p class="fine">Nothing waiting.</p>' : ''}</div></section>
      <section class="block"><h2>Deal pipeline</h2><div class="list">${S.deals.map(dealRow).join('') || '<p class="fine">No deals yet.</p>'}</div></section></section>`;
  }
  const toAnswer = S.offers.filter(o => offerTo(o) === id && offerLive(o));
  const mineOut = S.offers.filter(o => o.by === id && o.status === 'firm');
  const myCargo = S.cargoes.filter(c => c.by === id), myShips = S.vessels.filter(v => v.owner === id);
  const fits = S.role === 'owner' ? S.cargoes.filter(c => c.status === 'open' && canSee(c) && myShips.some(v => match(c, v).ok)) : S.role === 'broker' ? S.cargoes.filter(c => c.status === 'open' && canSee(c)) : [];
  const offerLine = o => { const c = cargoById(o.cargo); return `<a class="lrow" href="#/cargo/${c.id}"><div class="l-main"><strong>${esc(c.cargo)}, ${esc(c.load)} to ${esc(c.disch)}</strong><span>${o.by === id ? 'Your offer' : 'From ' + esc(co(o.by).name)}</span></div><div class="l-rate"><strong>${rateStr(o)}</strong><span>${o.vessel ? esc(vessel(o.vessel).name) : 'Vessel to be nominated'}</span></div><div class="l-meta">${offerLive(o) ? `<span class="clock">Valid for ${until(o.valid)}</span>` : tag('Expired', 'muted')}</div></a>`; };
  return `<section class="page"><div class="page-head"><div><h1>My desk</h1><p>${esc(me().name)}. What needs you, then everything you have live.</p></div></div>
    <section class="block"><h2>Waiting for your answer</h2><div class="list">${toAnswer.map(offerLine).join('') || '<p class="fine">No offers are waiting on you.</p>'}</div></section>
    ${deals.length ? `<section class="block"><h2>Your deals</h2><div class="list">${deals.map(dealRow).join('')}</div></section>` : ''}
    ${S.role === 'charterer' ? `<section class="block"><div class="sec-head"><h2>Your cargoes</h2><a href="#/post/cargo">Post a cargo</a></div><div class="list">${myCargo.map(cargoRow).join('') || empty('No cargoes posted', 'Post what has to move and verified owners and brokers can offer on it.', '<a class="btn btn-primary" href="#/post/cargo">Post a cargo</a>')}</div></section>` : ''}
    ${S.role === 'owner' ? `<section class="block"><div class="sec-head"><h2>Your vessels</h2><a href="#/post/vessel">List a vessel</a></div><div class="list">${myShips.map(vesselRow).join('') || empty('No vessels listed', 'List a ship and its open position to be matched with cargoes.', '<a class="btn btn-primary" href="#/post/vessel">List a vessel</a>')}</div></section>` : ''}
    ${mineOut.length ? `<section class="block"><h2>Your live offers</h2><div class="list">${mineOut.map(offerLine).join('')}</div></section>` : ''}
    ${fits.length ? `<section class="block"><h2>${S.role === 'owner' ? 'Cargoes your ships fit' : 'Cargoes open to you'}</h2><div class="list">${fits.map(cargoRow).join('')}</div></section>` : ''}</section>`;
});

/* ---------- Guide ---------- */
function classTable(k) {
  const s = SEG[k], t = (rows, cap) => `<div class="tbl"><table><caption>${cap}</caption><thead><tr><th>Class label</th><th>${s.metric}</th></tr></thead><tbody>${rows.map(b => `<tr><td><strong>${esc(b[2])}${b[3] ? ' / ' + esc(b[3]) : ''}</strong></td><td>${b[0] ? num(b[0]) : 'Under ' + num(b[1] + 1)}${b[0] ? (b[1] > 1e8 ? ' and above' : ' to ' + num(b[1])) : ''}</td></tr>`).join('')}</tbody></table></div>`;
  return `<section class="block"><h2>${s.label}</h2>${k === 'gas' ? t(s.classes, 'LPG and petrochemical gases') + t(s.lngClasses, 'LNG') : t(s.classes, s.approx ? 'Platform bands. The market has no settled names here.' : 'Market labels by ' + s.metricLong.toLowerCase())}
    ${k === 'tanker' ? '<p class="fine">Panamax and Aframax tankers with coated tanks trading clean products are called LR1 and LR2.</p>' : ''}<p class="fine">Sub-types: ${s.subtypes.map(esc).join(', ')}.</p></section>`;
}
route('guide', () => guide('terms'));
route('guide/:sec', sec => guide(sec));
function guide(sec) {
  const secs = [['terms', 'Chartering terms'], ['safeguards', 'Safeguards'], ['classes', 'Vessel classes'], ['payments', 'How payment works']];
  let body;
  if (sec === 'safeguards') body = `<section class="block"><h2>What goes wrong, and what is built for it</h2>${safeguardTable(SAFEGUARDS)}</section>`;
  else if (sec === 'classes') body = `<p class="lead">Class names are trade shorthand, not regulation, and sources disagree at the edges. Listings store the measured figure and suggest the label.</p>` + Object.keys(SEG).map(classTable).join('');
  else if (sec === 'payments') body = `<section class="block"><h2>Voyage charters</h2><ol class="steps steps-v"><li><h3>Freight security is a subject</h3><p>The fixture is not clean until the charterer’s freight sits with the payment partner.</p></li><li><h3>95% on bills of lading</h3><p>Released when both sides confirm “Bills of lading signed” in the time log. Commission is deducted and paid at the same moment.</p></li><li><h3>Balance after discharge</h3><p>The last 5% is settled with demurrage or despatch once the laytime statement is agreed.</p></li><li><h3>If there is a dispute</h3><p>Only the disputed amount stays held. The rest is released.</p></li></ol></section>
    <section class="block"><h2>Time charters</h2><p>Hire is paid every 15 days in advance, with the value of fuel on board settled on delivery and redelivery. The same partner holds each instalment until its due date.</p></section>
    <section class="block"><h2>What is real today</h2><p>Nothing moves money in this prototype. Holding client funds needs a licence, so the plan is to connect a regulated escrow agent or bank. The release rules, states and audit trail above are what that partner would plug into.</p></section>`;
  else body = `<section class="block"><h2>Terms you will meet</h2><dl class="gloss">${GLOSSARY.map(g => `<div><dt>${esc(g[0])}</dt><dd>${esc(g[1])}</dd></div>`).join('')}</dl></section>`;
  return `<section class="page"><div class="page-head"><div><h1>Guide</h1><p>Plain-language notes for people fixing their first ships.</p></div></div>
    <nav class="tabs" aria-label="Guide sections">${secs.map(x => `<a href="#/guide/${x[0]}"${sec === x[0] ? ' aria-current="page"' : ''}>${x[1]}</a>`).join('')}</nav>${body}</section>`;
}

render();
