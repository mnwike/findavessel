/* FindAVessel: ship-wanted enquiries held by the desk.
   These came to us as enquiries, not as listings posted by an account. They carry no personal
   details. Offers go to the desk by email and the desk passes them on. */
'use strict';

const DESK_ENQ = [
  { id: 'w23', rec: '2026-11', kind: 'Offshore', title: 'Survey or support vessel for hire', route: 'Nigeria', terms: 'Hire period to be agreed' },
  { id: 'w01', rec: '2026-09', kind: 'Tanker', title: 'Chemical tanker for sulphuric acid', route: 'Lagos area (Ejirin or Badagry) to Tema, Ghana', terms: 'Voyage. Corrosive cargo, IMDG Class 8. Quantity to be confirmed' },
  { id: 'w02', rec: '2026-05', kind: 'Offshore', title: 'Jack-up barge, construction vessel and platform supply vessel', route: 'Ghana', terms: 'Charter. Self-propelled jack-up barge, class 250 to 300; construction vessel of 400 t or more; platform supply vessel, DP2' },
  { id: 'w03', rec: '2026-04', kind: 'Tanker', title: 'Tanker of 13,000 to 15,000 t for oil or crude', route: 'Nigeria', terms: 'Time charter, 90 days or longer' },
  { id: 'w18', rec: '2026-03', kind: 'Barge', title: 'Barge of 10,000 t', route: 'Nigeria', terms: 'Five-year lease' },
  { id: 'w04', rec: '2025-12', kind: 'Bulk', title: 'Chrome concentrate, 10,000 t', route: 'Beira, Mozambique to Turkey', terms: 'Voyage. Discharge port to be named' },
  { id: 'w19', rec: '2025-12', kind: 'General', title: 'Vessel of 2,500 t capacity', route: 'Eket, Nigeria to Ghana', terms: 'Voyage. Cargo to be confirmed' },
  { id: 'w20', rec: '2025-11', kind: 'Tanker', title: 'Shuttle tanker of 25,000 t', route: 'Nigeria', terms: 'Terms to be agreed' },
  { id: 'w21', rec: '2025-10', kind: 'Barge', title: 'Two crude oil barges, 20,000 and 40,000 barrels', route: 'Nigeria', terms: 'Transport and storage of crude oil. Period to be agreed' },
  { id: 'w05', rec: '2025-07', kind: 'Bulk', title: 'Vessel of 50,000 or 110,000 t', route: 'Nigeria', terms: 'Two-year contract. Cargo to be confirmed' },
  { id: 'w06', rec: '2025-06', kind: 'Bulk', title: 'Fertiliser in bulk, 10,000 t', route: 'Lagos, Nigeria to Lomé, Togo', terms: 'Voyage' },
  { id: 'w07', rec: '2025-05', kind: 'Tanker', title: 'Crude oil tanker', route: 'Nigeria', terms: 'Lease of up to one year. Size to be confirmed' },
  { id: 'w08', rec: '2025-04', kind: 'Port agency', title: 'Port agent to discharge pine logs, about 2,500 t', route: 'Oran, Algeria', terms: 'Agency for a bulk carrier discharging logs' },
  { id: 'w09', rec: '2025-02', kind: 'Bulk', title: 'Cement clinker, 50,000 t each month', route: 'Salalah, Oman to Dakar, Senegal', terms: 'Monthly shipments' },
  { id: 'w10', rec: '2025-02', kind: 'Bulk', title: 'Bamboo wood, 3,000 t', route: 'Apapa, Nigeria to Rotterdam, Netherlands', terms: 'Voyage' },
  { id: 'w22', rec: '2024-08', kind: 'Fishing', title: 'Fishing trawlers', route: 'Angolan waters', terms: 'Two-year period' },
  { id: 'w11', rec: '2024-05', kind: 'Bulk', title: 'Dry bulk carrier for iron ore', route: 'Nigeria', terms: 'Quantity and ports to be confirmed' },
  { id: 'w12', rec: '2024-04', kind: 'Bulk', title: 'Urea in bulk', route: 'Nigeria to Namibia', terms: 'Voyage. Quantity to be confirmed' },
  { id: 'w13', rec: '2024-01', kind: 'Bulk', title: 'Palm kernel shells, 120,000 t over one year', route: 'Nigeria to Gdansk, Poland', terms: 'One-year programme' },
  { id: 'w14', rec: '2023-10', kind: 'Bulk', title: 'Vessel for lifts of 10,000 t', route: 'Ports to be confirmed', terms: 'One-year contract' },
  { id: 'w15', rec: '2023-09', kind: 'Bulk', title: 'Dry bulk charter', route: 'Italy to Matadi, DR Congo', terms: 'Cargo and quantity to be confirmed' },
  { id: 'w16', rec: '2023-06', kind: 'Bulk', title: 'Natural rubber, 35,000 to 50,000 t', route: 'San Pedro, Côte d’Ivoire to Port Klang, Malaysia', terms: 'Voyage' },
  { id: 'w17', rec: '2023-06', kind: 'Tanker', title: 'Vessel of 300,000 t', route: 'Ports to be confirmed', terms: 'Three-year hire, through an intermediary' }
];

const deskMonth = r => { const [y, m] = r.split('-'); return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+m - 1] + ' ' + y; };
const deskOld = r => { const [y, m] = r.split('-'), n = new Date(); return (n.getFullYear() - y) * 12 + (n.getMonth() + 1 - m) > 12; };

function deskRow(e) {
  return `<a class="lrow" href="#/wanted/${e.id}">
    <div class="l-main"><strong>${esc(e.title)}</strong><span>${esc(e.terms)}</span></div>
    <div class="l-route"><strong>${esc(e.route)}</strong><span>Dates to be agreed</span></div>
    <div class="l-rate"><strong>No rate idea given</strong><span></span></div>
    <div class="l-meta">${tag(e.kind)}${tag('Held by the desk', 'accent')}${deskOld(e.rec) ? tag('Older enquiry', 'warn') : ''}<span class="clock">Received ${deskMonth(e.rec)}</span></div>
  </a>`;
}
function deskSection() {
  return `<section class="block"><h2>Ship wanted: enquiries held by the desk</h2>
    <p class="fine">These reached us as enquiries. We have not yet confirmed each one with the person who sent it, so every row shows the month it arrived. Send an offer and the desk will pass it on and tell you whether the requirement is still open.</p>
    <div class="list">${DESK_ENQ.map(deskRow).join('')}</div></section>`;
}

route('wanted/:id', id => {
  const e = DESK_ENQ.find(x => x.id === id);
  if (!e) return `<section class="page">${empty('This enquiry is no longer listed', 'It may have been fixed or withdrawn.', '<a class="btn" href="#/cargoes">Back to cargoes</a>')}</section>`;
  const sent = (S.draft.wantedSent || []).includes(id);
  return `<section class="page narrow">
    <a class="back" href="#/cargoes">All cargoes</a>
    <div class="page-head"><div><h1>${esc(e.title)}</h1><p>${esc(e.route)}. Enquiry received ${deskMonth(e.rec)}.</p></div></div>
    <section class="block"><h2>What was asked for</h2>${kv([['Requirement', e.title], ['Route or area', e.route], ['Terms', e.terms], ['Type', e.kind], ['Dates', 'To be agreed'], ['Received', deskMonth(e.rec)], ['Status', 'Held by the desk. Not yet confirmed with the sender']])}
      <p class="note">${deskOld(e.rec) ? 'This enquiry is more than a year old. Treat it as a lead to check, not a firm requirement.' : 'This is an enquiry, not a firm cargo. The desk confirms it with the sender before passing on any offer.'}</p></section>
    <section class="block"><h2>Offer a ship</h2>
      ${sent ? '<div class="notice"><p><strong>Offer sent to the desk.</strong> We will check that the requirement is still open and reply by email.</p></div>' : `<form class="form" data-form="wantedOffer" data-id="${e.id}">
        <label class="field"><span class="lbl">Your name</span><input name="name" required autocomplete="name"></label>
        <label class="field"><span class="lbl">Company</span><input name="company" autocomplete="organization"></label>
        <label class="field"><span class="lbl">Email</span><input name="email" type="email" required autocomplete="email"></label>
        <label class="field"><span class="lbl">Phone or WhatsApp</span><input name="phone" type="tel" autocomplete="tel"></label>
        <label class="field wide"><span class="lbl">Ship and offer</span><textarea name="offer" rows="5" required placeholder="Ship name or type, size, where and when it is open, and your rate idea"></textarea></label>
        <button class="btn btn-primary">Send offer to the desk</button>
        <p class="fine">Your offer goes to the FindAVessel desk, not straight to the sender.</p></form>`}</section>
  </section>`;
});

FORM.wantedOffer = (d, form) => {
  const e = DESK_ENQ.find(x => x.id === form.dataset.id);
  if (!e || !window.fvNotify) return toast('That did not send. Please try again in a moment.');
  const btn = form.querySelector('button'); if (btn) btn.disabled = true;
  window.fvNotify('offer on desk enquiry ' + e.id + ': ' + e.title, { Enquiry: e.id + ' ' + e.title, Route: e.route, Received: e.rec, Name: d.name, Company: d.company, Email: d.email, Phone: d.phone, Offer: d.offer }).then(ok => {
    if (!ok) { if (btn) btn.disabled = false; return toast('That did not send. Check your connection and try again.'); }
    (S.draft.wantedSent = S.draft.wantedSent || []).push(e.id); save(); render(); toast('Offer sent to the desk');
    if (window.fvTrack) window.fvTrack('generate_lead', { lead_type: 'desk_enquiry_offer', enquiry_id: e.id, enquiry_kind: e.kind });
  });
};
