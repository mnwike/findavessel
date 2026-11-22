/* Live accounts and shared data, on Firebase Authentication and Cloud Firestore.
   Signed-in users get the role they registered with; their cargoes, vessels, offers and deals are stored
   in the database so the other side sees them. Example listings stay in the page only. */
const FB_CONFIG = { apiKey: 'AIzaSyA0uJ60xG28bDYs3ULl-Pd0nCzOfinsGM0', authDomain: 'findavessel-13e8f.firebaseapp.com', projectId: 'findavessel-13e8f',
  storageBucket: 'findavessel-13e8f.firebasestorage.app', messagingSenderId: '136713361799', appId: '1:136713361799:web:52d5ae55d9e1558157db22' };
const NET = { pub: { cargoes: {}, vessels: {}, companies: {} }, uid: null, email: '', profile: null, ready: false, synced: {}, unsub: [], applying: false, timer: 0, stale: false, pending: null };
let fauth = null, fdb = null;
const myCo = () => NET.uid ? 'u-' + NET.uid : null;
const isLive = id => typeof id === 'string' && id.startsWith('u-');
const uidOf = id => id.slice(2);

function stubOf(p, uid) { return { id: 'u-' + uid, name: p.company, role: p.role, country: p.country, since: p.since || new Date().getFullYear(), verified: 'unverified', level: 0, fixtures: 0, respH: 0, about: p.about || '', isNew: true, claim: p.claim || '' }; }
function upsert(list, item) { const i = list.findIndex(x => x.id === item.id); if (i < 0) list.push(item); else list[i] = item; }
const localSave = save;
save = function () { localSave(); if (NET.uid && !NET.applying) { clearTimeout(NET.timer); NET.timer = setTimeout(pushAll, 250); } };

const KINDS = {
  cargoes: { mine: c => c.by === myCo(), pub: true },
  vessels: { mine: v => v.owner === myCo(), pub: true },
  offers: { mine: o => o.by === myCo() || o.recipient === myCo(), parties: o => [o.by, o.recipient] },
  deals: { mine: x => [x.charterer, x.owner, x.broker].includes(myCo()), parties: x => [x.charterer, x.owner, x.broker].filter(Boolean) }
};
function pushAll() {
  if (!NET.uid || !fdb) return;
  const stub = S.companies.find(c => c.id === myCo());
  Object.keys(KINDS).forEach(kind => {
    const K = KINDS[kind];
    (S[kind] || []).filter(K.mine).forEach(item => {
      const j = JSON.stringify(item), key = kind + '/' + item.id;
      if (NET.synced[key] === j) return;
      const doc = { j, updated: firebase.firestore.FieldValue.serverTimestamp() };
      if (K.pub) doc.uid = NET.uid;
      else {
        const ids = K.parties(item);
        if (!ids.every(isLive)) return;                       // the other side is an example company: nothing to send
        doc.parties = ids.map(uidOf);
        if (stub) doc.stubs = { [NET.uid]: JSON.stringify(stub) };
      }
      NET.synced[key] = j;
      fdb.collection(kind).doc(item.id).set(doc, { merge: true }).catch(err => { delete NET.synced[key]; console.warn('Not saved', kind, err.code); if (err.code !== 'permission-denied') toast('That change could not be saved. Check your connection.'); });
    });
  });
  if (stub && stub.role !== 'charterer') {
    const j = JSON.stringify(stub);
    if (NET.synced['companies/' + stub.id] !== j) { NET.synced['companies/' + stub.id] = j; fdb.collection('companies').doc(NET.uid).set({ uid: NET.uid, j }).catch(() => { delete NET.synced['companies/' + stub.id]; }); }
  }
}
function applySnap(kind, snap) {
  let changed = false;
  snap.docChanges().forEach(ch => {
    if (ch.type === 'removed') return;
    const d = ch.doc.data();
    if (d.stubs) Object.keys(d.stubs).forEach(u => { try { const s = JSON.parse(d.stubs[u]); if (s.id !== myCo()) { upsert(S.companies, s); changed = true; } } catch (e) {} });
    let item; try { item = JSON.parse(d.j); } catch (e) { return; }
    if (kind === 'companies' && item.id === myCo()) return;
    const key = kind + '/' + item.id;
    if (NET.pub[kind]) NET.pub[kind][item.id] = item;      // public items are kept so they survive a sign-out reset
    if (NET.synced[key] === d.j) return;
    NET.synced[key] = d.j; upsert(S[kind], item); changed = true;
  });
  if (!changed) return;
  NET.applying = true; localSave(); NET.applying = false;
  const a = document.activeElement;
  if (a && a.closest && a.closest('#main form') && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) NET.stale = true; else render();
}
document.addEventListener('focusout', () => { if (NET.stale) setTimeout(() => { const a = document.activeElement; if (!(a && a.closest && a.closest('#main form'))) { NET.stale = false; render(); } }, 50); });
function resetLocal() { S = seed(); NET.synced = {}; Object.keys(NET.pub).forEach(k => Object.values(NET.pub[k]).forEach(item => { upsert(S[k], JSON.parse(JSON.stringify(item))); NET.synced[k + '/' + item.id] = JSON.stringify(item); })); }
function listen(q, kind) { NET.unsub.push(q.onSnapshot(s => applySnap(kind, s), err => console.warn('Listen failed', kind, err.code))); }

function startLive() {
  if (typeof firebase === 'undefined') { NET.ready = true; return; }
  firebase.initializeApp(FB_CONFIG); fauth = firebase.auth(); fdb = firebase.firestore();
  ['cargoes', 'vessels', 'companies'].forEach(k => fdb.collection(k).onSnapshot(s => applySnap(k, s), err => console.warn('Listen failed', k, err.code)));
  fauth.onAuthStateChanged(async user => {
    NET.unsub.forEach(u => u()); NET.unsub = [];
    if (!user) {
      if (S.liveUid) resetLocal();          // signed out: drop private data held in this browser
      NET.uid = null; NET.profile = null; NET.email = ''; S.role = 'guest'; NET.ready = true; localSave(); render(); return;
    }
    if (S.liveUid && S.liveUid !== user.uid) resetLocal();
    let p = NET.pending;
    try { const snap = await fdb.collection('users').doc(user.uid).get(); if (snap.exists) p = snap.data(); } catch (e) { console.warn('Profile not read', e.code); }
    NET.uid = user.uid; NET.email = user.email || ''; NET.verified = user.emailVerified; S.liveUid = user.uid;
    if (!p) { NET.profile = null; S.role = 'guest'; NET.ready = true; localSave(); return go('join'); }   // signed in but never finished the profile
    NET.profile = p; upsert(S.companies, stubOf(p, user.uid)); S.me[p.role] = myCo(); S.role = p.role;
    listen(fdb.collection('offers').where('parties', 'array-contains', user.uid), 'offers');
    listen(fdb.collection('deals').where('parties', 'array-contains', user.uid), 'deals');
    NET.ready = true; save(); render();
  });
}

/* ---------- Sign in, sign up, sign out ---------- */
const AUTH_MSG = { 'auth/email-already-in-use': 'There is already an account for that email. Sign in instead.', 'auth/invalid-email': 'That email address does not look right.', 'auth/weak-password': 'Choose a longer password: at least 8 characters.',
  'auth/invalid-credential': 'The email or password is not right.', 'auth/wrong-password': 'The email or password is not right.', 'auth/user-not-found': 'The email or password is not right.', 'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.', 'auth/network-request-failed': 'No connection. Check your internet and try again.' };
const authErr = e => toast(AUTH_MSG[e.code] || 'That did not work. Try again in a moment.');
function busy(form, on, label) { const b = form.querySelector('button.btn-primary'); if (!b) return; if (on) { b.dataset.label = b.textContent; b.textContent = label; b.disabled = true; } else { b.textContent = b.dataset.label || b.textContent; b.disabled = false; } }
const nextAfterAuth = () => { const n = S.draft.next; delete S.draft.next; return n || 'desk'; };

route('signin', () => {
  if (NET.uid && NET.profile) return `<section class="page narrow">${empty('You are signed in', NET.email, '<div class="row"><a class="btn btn-primary" href="#/desk">Go to my desk</a><button class="btn" data-act="signOut">Sign out</button></div>')}</section>`;
  return `<section class="page narrow auth"><div class="page-head"><div><h1>Sign in</h1><p>Your desk, listings, offers and deals are behind your account.</p></div></div>
    <form class="form" data-form="signin"><div class="grid">
      <div class="field wide"><label for="si-email">Email</label><input id="si-email" name="email" type="email" autocomplete="username" required></div>
      <div class="field wide"><label for="si-pass">Password</label><input id="si-pass" name="password" type="password" autocomplete="current-password" required></div>
    </div><div class="form-end"><button class="btn btn-primary btn-lg">Sign in</button><p class="fine"><button type="button" class="link" data-act="resetPassword">Forgotten your password?</button> New here? <a href="#/join">Create an account</a>.</p></div></form></section>`;
});
FORM.signin = (d, form) => { busy(form, true, 'Signing in…'); fauth.signInWithEmailAndPassword(d.email.trim(), d.password).then(() => { toast('Signed in'); go(nextAfterAuth()); }).catch(e => { busy(form, false); authErr(e); }); };
ACT.resetPassword = () => { const el = $('#si-email'), email = el && el.value.trim(); if (!email) { toast('Type your email first, then choose this again'); if (el) el.focus(); return; } fauth.sendPasswordResetEmail(email).then(() => toast('If there is an account for that email, a reset link is on its way'), authErr); };
ACT.signOut = () => { fauth.signOut().then(() => { go(''); toast('Signed out'); }); };
ACT.resendVerify = () => { const u = fauth.currentUser; if (u) u.sendEmailVerification().then(() => toast('Confirmation email sent to ' + u.email), authErr); };

FORM.join = (d, form) => {
  if (!fauth) return toast('Accounts are not available right now. Try again shortly.');
  if ((d.password || '').length < 8) return toast('Choose a password of at least 8 characters');
  if (d.password !== d.password2) return toast('The two passwords do not match');
  const profile = { role: d.role, company: d.name.trim(), country: d.country.trim(), regno: d.regno || '', website: d.website || '', contact: d.contact.trim(), title: d.title || '', phone: d.phone || '', email: d.email.trim(),
    about: d.commodities || d.markets || d.services || (d.fleet ? d.fleet + ' vessels' : ''), claim: d.claim || '', portsServed: d.portsServed || '', since: new Date().getFullYear(), created: Date.now() };
  NET.pending = profile; busy(form, true, 'Creating your account…');
  fauth.createUserWithEmailAndPassword(profile.email, d.password)
    .then(cred => fdb.collection('users').doc(cred.user.uid).set(profile).then(() => cred.user.sendEmailVerification().catch(() => {})))
    .then(() => { tell('new account, ' + profile.company + ' (' + ROLE_NAME[profile.role] + ')', { Country: profile.country, 'Registration number': profile.regno, Website: profile.website, Position: profile.title, About: profile.about, 'Claiming supplier profile': profile.claim }); if (window.fvTrack) fvTrack('sign_up', { method: profile.role }); toast('Account created. Check your email to confirm your address.'); go(nextAfterAuth()); })
    .catch(e => { NET.pending = null; busy(form, false); authErr(e); });
};
/* ---------- Everything submitted is emailed to the desk ---------- */
function who() { const p = NET.profile || NET.pending || {}; return { Company: p.company, Name: p.contact, Email: p.email || NET.email, Phone: p.phone, 'Account type': ROLE_NAME[p.role] || '' }; }
function tell(subject, fields) { if (window.fvNotify) window.fvNotify(subject, Object.assign({}, fields, who())); }
function watch(table, name, list, describe) {
  const orig = table[name]; if (!orig) return;
  table[name] = function () { const n = S[list].length; const out = orig.apply(this, arguments); if (S[list].length > n) { try { const x = S[list][S[list].length - 1], d = describe(x); tell(d[0], d[1]); } catch (e) { console.warn('Not notified', e); } } return out; };
}
const cargoMail = c => ['new cargo enquiry, ' + c.cargo + ', ' + c.load + ' to ' + c.disch, { Cargo: c.cargo, Quantity: c.qty ? num(c.qty) + ' t' : '', 'Ship type': SEG[c.seg].label, From: c.load, To: c.disch, Laycan: laycan(c.from, c.to), Charter: c.type, 'Rate idea': c.idea ? rateStr({ rateType: c.rateType, rate: c.idea }) : '', Notes: c.note, Link: 'https://findavessel.com/#/cargo/' + c.id }];
watch(FORM, 'enquiry', 'cargoes', cargoMail);
watch(FORM, 'cargo', 'cargoes', cargoMail);
watch(FORM, 'vessel', 'vessels', v => ['new vessel listed, ' + v.name, { Vessel: v.name, IMO: v.imo, Type: v.subtype, Size: num(v.size) + ' ' + SEG[v.seg].metric, Built: v.built, Flag: v.flag, 'Open at': v.open, 'Open from': dstr(v.openDate), 'Technical manager': v.techManager, 'Commercial manager': v.commManager, Link: 'https://findavessel.com/#/vessel/' + v.id }]);
watch(FORM, 'offer', 'offers', o => { const c = cargoById(o.cargo) || {}; return [(o.round > 1 ? 'counter-offer' : 'new offer') + ' on ' + (c.cargo || 'a cargo') + ', ' + (c.load || '') + ' to ' + (c.disch || ''), { Cargo: c.cargo, Route: (c.load || '') + ' to ' + (c.disch || ''), Vessel: o.vessel ? (vessel(o.vessel) || {}).name : o.vesselName, Rate: rateStr(o), Quantity: o.qty, Laycan: laycan(o.from, o.to), 'Acting for': o.actingFor, 'Valid until': dtime(o.valid), Notes: o.note, 'Sent to': co(o.recipient).name, Link: 'https://findavessel.com/#/cargo/' + o.cargo }]; });
watch(ACT, 'accept', 'deals', x => ['offer accepted, ' + x.title, { Deal: x.title, Charterer: co(x.charterer).name, Owner: x.owner ? co(x.owner).name : '', Broker: x.broker ? co(x.broker).name : '', Vessel: x.vesselName || (x.vessel ? (vessel(x.vessel) || {}).name : ''), Link: 'https://findavessel.com/#/deal/' + x.id }]);
startLive();
