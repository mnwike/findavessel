/* FindAVessel prototype: reference data and sample records.
   Every company, vessel, cargo and deal below is invented for the prototype. */
'use strict';

const DAY = 864e5, HOUR = 36e5;
const NOW = Date.now();
const inDays = d => new Date(NOW + d * DAY).toISOString().slice(0, 10);

/* ---------- Vessel segments, size classes and type-specific fields ---------- */
const SEG = {
  tanker: {
    label: 'Oil and chemical tankers', short: 'Tanker', metric: 'DWT', metricLong: 'Deadweight (tonnes)',
    subtypes: ['Crude tanker', 'Dirty product tanker', 'Clean product tanker', 'Chemical tanker', 'Bitumen tanker', 'Vegetable oil tanker', 'Bunker tanker'],
    classes: [[0, 9999, 'Coastal tanker'], [10000, 34999, 'Handysize'], [35000, 44999, 'MR1'], [45000, 54999, 'MR2'],
      [55000, 84999, 'Panamax', 'LR1'], [85000, 119999, 'Aframax', 'LR2'], [120000, 199999, 'Suezmax'], [200000, 319999, 'VLCC'], [320000, 1e9, 'ULCC']],
    cleanSubtypes: ['Clean product tanker', 'Chemical tanker', 'Vegetable oil tanker'],
    fields: [
      { k: 'cubic', l: 'Cargo tank capacity at 98% (m³)', t: 'number' },
      { k: 'coating', l: 'Tank coating', t: 'select', o: ['Uncoated', 'Epoxy', 'Phenolic epoxy', 'Zinc silicate', 'Stainless steel', 'Marineline'] },
      { k: 'heating', l: 'Heating coils', t: 'select', o: ['None', 'Steam coils', 'Thermal oil', 'Deck heaters'] },
      { k: 'segregations', l: 'Segregations', t: 'number' },
      { k: 'imoType', l: 'IMO chemical type', t: 'select', o: ['Not applicable', 'Type 1', 'Type 2', 'Type 3', 'Type 2/3'] },
      { k: 'igs', l: 'Inert gas system', t: 'select', o: ['Yes', 'No', 'Nitrogen generator'] },
      { k: 'last3', l: 'Last three cargoes', t: 'text', ph: 'ULSD / jet A-1 / ULSD' },
      { k: 'sire', l: 'Last SIRE or CDI inspection', t: 'date' },
      { k: 'approvals', l: 'Oil major approvals held', t: 'text', ph: 'List, or none' }
    ],
    cargoes: ['Crude oil', 'Fuel oil', 'Vacuum gasoil', 'Gasoil / diesel', 'Gasoline', 'Jet fuel', 'Naphtha', 'Bitumen', 'Palm oil', 'Methanol', 'Caustic soda', 'Base oils'],
    cargoFields: [
      { k: 'grade', l: 'Grade and specification', t: 'text', ph: 'ULSD 10 ppm, EN 590' },
      { k: 'heat', l: 'Heating required', t: 'text', ph: 'None, or maintain 60°C' },
      { k: 'lastCargoReq', l: 'Last-cargo restrictions', t: 'text', ph: 'Last three clean, unleaded' },
      { k: 'vetting', l: 'Vetting required', t: 'text', ph: 'SIRE within 6 months, terminal acceptance' }
    ],
    cp: { voyage: ['ASBATANKVOY', 'SHELLVOY 6', 'BPVOY 5'], time: ['SHELLTIME 4', 'BPTIME 3'] },
    rateTypes: ['USD per tonne', 'Lumpsum USD', 'Worldscale']
  },
  bulk: {
    label: 'Bulk carriers', short: 'Bulker', metric: 'DWT', metricLong: 'Deadweight (tonnes)',
    subtypes: ['Geared bulk carrier', 'Gearless bulk carrier', 'Open-hatch carrier', 'Self-unloader', 'Cement carrier', 'Wood chip carrier', 'Ore carrier'],
    classes: [[0, 9999, 'Mini bulker'], [10000, 39999, 'Handysize'], [40000, 49999, 'Handymax'], [50000, 59999, 'Supramax'], [60000, 66999, 'Ultramax'],
      [67000, 79999, 'Panamax'], [80000, 86999, 'Kamsarmax'], [87000, 119999, 'Post-Panamax'], [120000, 199999, 'Capesize'], [200000, 219999, 'Newcastlemax'], [220000, 1e9, 'Very large ore carrier']],
    fields: [
      { k: 'gear', l: 'Cargo gear', t: 'text', ph: '4 x 30 t cranes, or gearless' },
      { k: 'grabs', l: 'Grabs', t: 'text', ph: '4 x 12 m³, or none' },
      { k: 'holds', l: 'Holds / hatches', t: 'text', ph: '5 / 5' },
      { k: 'grain', l: 'Grain capacity (m³)', t: 'number' },
      { k: 'bale', l: 'Bale capacity (m³)', t: 'number' },
      { k: 'features', l: 'Features', t: 'text', ph: 'Box holds, log fitted, strengthened for heavy cargoes' },
      { k: 'last3', l: 'Last three cargoes', t: 'text', ph: 'Wheat / steel coils / urea' },
      { k: 'rightship', l: 'RightShip safety score', t: 'select', o: ['Not rated', '1', '2', '3', '4', '5'] }
    ],
    cargoes: ['Iron ore', 'Steam coal', 'Coking coal', 'Wheat', 'Corn', 'Soybeans', 'Bauxite', 'Urea', 'Bulk cement', 'Clinker', 'Steel coils', 'Raw sugar', 'Petcoke', 'Salt', 'Sulphur', 'Bagged rice'],
    cargoFields: [
      { k: 'stowage', l: 'Stowage factor (m³ per tonne)', t: 'text', ph: '1.30' },
      { k: 'loadRate', l: 'Load rate (tonnes per day)', t: 'number', ph: '8000' },
      { k: 'dischRate', l: 'Discharge rate (tonnes per day)', t: 'number', ph: '5000' },
      { k: 'gearReq', l: 'Gear required', t: 'text', ph: 'Geared with grabs at discharge port' },
      { k: 'imsbc', l: 'IMSBC group or hazards', t: 'text', ph: 'Group C, or Group A (may liquefy)' }
    ],
    cp: { voyage: ['GENCON 2022', 'GENCON 1994', 'NORGRAIN 89', 'AMWELSH 93', 'SYNACOMEX 2000'], time: ['NYPE 2015', 'NYPE 1993', 'BALTIME 1939 (rev. 2001)'] },
    rateTypes: ['USD per tonne', 'Lumpsum USD']
  },
  gas: {
    label: 'Gas carriers', short: 'Gas carrier', metric: 'm³', metricLong: 'Cargo capacity (cubic metres)',
    subtypes: ['LPG carrier, fully pressurised', 'LPG carrier, semi-refrigerated', 'LPG carrier, fully refrigerated', 'Ethylene carrier', 'LNG carrier, membrane', 'LNG carrier, Moss'],
    classes: [[0, 4999, 'Small gas carrier (pressurised)'], [5000, 14999, 'Small gas carrier'], [15000, 24999, 'Handysize gas carrier'], [25000, 39999, 'Medium gas carrier'], [40000, 59999, 'Large gas carrier'], [60000, 1e9, 'Very large gas carrier']],
    lngClasses: [[0, 35999, 'Small-scale LNG'], [36000, 89999, 'Med Max'], [90000, 144999, 'Lower conventional'], [145000, 208999, 'Upper conventional'], [209000, 219999, 'Q-Flex'], [220000, 1e9, 'Q-Max']],
    fields: [
      { k: 'dwt', l: 'Deadweight (tonnes)', t: 'number' },
      { k: 'containment', l: 'Containment system', t: 'text', ph: 'Type C tanks, or GTT Mark III' },
      { k: 'grades', l: 'Cargo grades permitted', t: 'text', ph: 'Propane, butane, ammonia' },
      { k: 'minTemp', l: 'Minimum cargo temperature (°C)', t: 'number' },
      { k: 'reliq', l: 'Reliquefaction plant', t: 'select', o: ['Yes', 'No', 'Partial'] },
      { k: 'last3', l: 'Last three cargoes', t: 'text' },
      { k: 'sire', l: 'Last SIRE inspection', t: 'date' }
    ],
    cargoes: ['Propane', 'Butane', 'Propane / butane mix', 'Ammonia', 'Ethylene', 'Ethane', 'LNG'],
    cargoFields: [
      { k: 'grade', l: 'Grade and specification', t: 'text' },
      { k: 'tankCond', l: 'Tank condition on arrival', t: 'text', ph: 'Under vapours of last cargo, or gas-free' },
      { k: 'vetting', l: 'Vetting required', t: 'text' }
    ],
    cp: { voyage: ['ASBAGASVOY', 'GASVOY 2005'], time: ['SHELLTIME 4', 'SHELLLNGTIME 1'] },
    rateTypes: ['USD per tonne', 'Lumpsum USD']
  },
  container: {
    label: 'Container ships', short: 'Container ship', metric: 'TEU', metricLong: 'Nominal capacity (TEU)',
    subtypes: ['Gearless container ship', 'Geared container ship'],
    classes: [[0, 999, 'Small feeder'], [1000, 2999, 'Feeder'], [3000, 5199, 'Panamax'], [5200, 9999, 'Post-Panamax'], [10000, 14499, 'Neopanamax'], [14500, 17999, 'Very large container ship'], [18000, 1e9, 'Ultra large container ship']],
    fields: [
      { k: 'dwt', l: 'Deadweight (tonnes)', t: 'number' },
      { k: 'teu14', l: 'Capacity at 14 t homogeneous (TEU)', t: 'number' },
      { k: 'reefer', l: 'Reefer plugs', t: 'number' },
      { k: 'gear', l: 'Cranes', t: 'text', ph: '2 x 40 t, or gearless' },
      { k: 'speed', l: 'Service speed and consumption', t: 'text', ph: '18 kn on 42 t' }
    ],
    cargoes: ['Whole-ship charter for a liner service'],
    cargoFields: [
      { k: 'service', l: 'Intended service or rotation', t: 'text', ph: 'Intra-Med feeder loop' },
      { k: 'reeferReq', l: 'Reefer plugs needed', t: 'number' }
    ],
    cp: { voyage: ['NYPE 2015'], time: ['NYPE 2015', 'BOXTIME 2004'] },
    rateTypes: ['USD per day']
  },
  mpp: {
    label: 'General cargo and multipurpose', short: 'Multipurpose', metric: 'DWT', metricLong: 'Deadweight (tonnes)',
    subtypes: ['Multipurpose ship', 'Tweendecker', 'Heavy-lift ship', 'Coaster', 'Refrigerated cargo ship', 'Livestock carrier'],
    classes: [[0, 4999, 'Coaster'], [5000, 11999, 'Small multipurpose'], [12000, 19999, 'Medium multipurpose'], [20000, 1e9, 'Large multipurpose']],
    approx: true,
    fields: [
      { k: 'gear', l: 'Cranes and combined lift', t: 'text', ph: '2 x 150 t, combinable to 300 t' },
      { k: 'holds', l: 'Holds / hatches', t: 'text' },
      { k: 'tween', l: 'Tweendecks', t: 'select', o: ['None', 'Fixed', 'Adjustable', 'Pontoon'] },
      { k: 'bale', l: 'Bale capacity (m³)', t: 'number' },
      { k: 'deck', l: 'Weather deck strength and clear area', t: 'text' },
      { k: 'last3', l: 'Last three cargoes', t: 'text' }
    ],
    cargoes: ['Project cargo', 'Steel products', 'Wind turbine components', 'Bagged cargo', 'Timber and logs', 'Heavy-lift units', 'Refrigerated cargo', 'Livestock'],
    cargoFields: [
      { k: 'pieces', l: 'Largest piece (weight and dimensions)', t: 'text', ph: '180 t, 22 x 6 x 5 m' },
      { k: 'gearReq', l: 'Lifting gear required', t: 'text' },
      { k: 'stowReq', l: 'Stowage requirements', t: 'text', ph: 'Under deck only' }
    ],
    cp: { voyage: ['GENCON 2022', 'HEAVYLIFTVOY'], time: ['NYPE 2015', 'BALTIME 1939 (rev. 2001)'] },
    rateTypes: ['Lumpsum USD', 'USD per tonne']
  },
  roro: {
    label: 'Vehicle carriers and ro-ro', short: 'Vehicle carrier', metric: 'CEU', metricLong: 'Car capacity (CEU)',
    subtypes: ['Pure car and truck carrier', 'Pure car carrier', 'Ro-ro cargo ship'],
    classes: [[0, 1999, 'Short-sea car carrier'], [2000, 3999, 'Mid-size car carrier'], [4000, 6499, 'Car and truck carrier'], [6500, 7999, 'Large car and truck carrier'], [8000, 1e9, 'Post-Panamax car and truck carrier']],
    approx: true,
    fields: [
      { k: 'dwt', l: 'Deadweight (tonnes)', t: 'number' },
      { k: 'lane', l: 'Lane metres', t: 'number' },
      { k: 'ramp', l: 'Stern ramp capacity (tonnes)', t: 'number' },
      { k: 'deckHeight', l: 'Maximum deck height (m)', t: 'number' },
      { k: 'hoistable', l: 'Hoistable decks', t: 'number' }
    ],
    cargoes: ['Cars', 'High and heavy vehicles', 'Trucks and trailers'],
    cargoFields: [
      { k: 'units', l: 'Unit mix', t: 'text', ph: '3,200 cars, 140 high and heavy' },
      { k: 'maxUnit', l: 'Heaviest and tallest unit', t: 'text' }
    ],
    cp: { voyage: ['GENCON 2022'], time: ['NYPE 2015', 'BALTIME 1939 (rev. 2001)'] },
    rateTypes: ['USD per day', 'Lumpsum USD']
  }
};

function classify(seg, subtype, size) {
  const s = SEG[seg]; size = Number(size);
  if (!s || !size) return '';
  let bands = s.classes;
  if (seg === 'gas' && /LNG/.test(subtype || '')) bands = s.lngClasses;
  const b = bands.find(b => size >= b[0] && size <= b[1]);
  if (!b) return '';
  if (seg === 'tanker' && b[3] && s.cleanSubtypes.includes(subtype)) return b[3];
  return b[2];
}

/* ---------- Ports (positions approximate, for rough steaming-time estimates only) ---------- */
const PORTS = [
  ['Rotterdam', 'Netherlands', 'North-west Europe', 51.95, 4.14], ['Antwerp', 'Belgium', 'North-west Europe', 51.27, 4.34],
  ['Hamburg', 'Germany', 'North-west Europe', 53.54, 9.93], ['Immingham', 'United Kingdom', 'North-west Europe', 53.63, -0.19],
  ['Le Havre', 'France', 'North-west Europe', 49.48, 0.11], ['Gdansk', 'Poland', 'Baltic', 54.4, 18.67], ['Klaipeda', 'Lithuania', 'Baltic', 55.72, 21.1],
  ['Sines', 'Portugal', 'Iberia', 37.95, -8.87], ['Algeciras', 'Spain', 'Mediterranean', 36.13, -5.44], ['Genoa', 'Italy', 'Mediterranean', 44.4, 8.92],
  ['Augusta', 'Italy', 'Mediterranean', 37.21, 15.22], ['Piraeus', 'Greece', 'Mediterranean', 37.94, 23.63], ['Skikda', 'Algeria', 'Mediterranean', 36.88, 6.9],
  ['Alexandria', 'Egypt', 'Mediterranean', 31.19, 29.87], ['Constanta', 'Romania', 'Black Sea', 44.17, 28.66], ['Istanbul', 'Türkiye', 'Black Sea', 41.0, 28.97],
  ['Jeddah', 'Saudi Arabia', 'Red Sea', 21.48, 39.17], ['Yanbu', 'Saudi Arabia', 'Red Sea', 24.09, 38.05],
  ['Ras Tanura', 'Saudi Arabia', 'Arabian Gulf', 26.64, 50.16], ['Ras Laffan', 'Qatar', 'Arabian Gulf', 25.91, 51.6], ['Jebel Ali', 'UAE', 'Arabian Gulf', 25.01, 55.06],
  ['Fujairah', 'UAE', 'Arabian Gulf', 25.17, 56.36], ['Sohar', 'Oman', 'Arabian Gulf', 24.5, 56.63],
  ['Mundra', 'India', 'Indian subcontinent', 22.74, 69.7], ['Sikka', 'India', 'Indian subcontinent', 22.43, 69.83], ['Mumbai', 'India', 'Indian subcontinent', 18.95, 72.84],
  ['Chittagong', 'Bangladesh', 'Indian subcontinent', 22.31, 91.8],
  ['Singapore', 'Singapore', 'South-east Asia', 1.26, 103.82], ['Port Klang', 'Malaysia', 'South-east Asia', 3.0, 101.36], ['Map Ta Phut', 'Thailand', 'South-east Asia', 12.67, 101.15],
  ['Ho Chi Minh City', 'Vietnam', 'South-east Asia', 10.77, 106.7],
  ['Hong Kong', 'China', 'Far East', 22.3, 114.17], ['Ningbo', 'China', 'Far East', 29.87, 121.55], ['Qingdao', 'China', 'Far East', 36.07, 120.32],
  ['Kaohsiung', 'Taiwan', 'Far East', 22.61, 120.28], ['Ulsan', 'South Korea', 'Far East', 35.5, 129.38], ['Chiba', 'Japan', 'Far East', 35.6, 140.1],
  ['Port Hedland', 'Australia', 'Australia', -20.31, 118.58], ['Dampier', 'Australia', 'Australia', -20.66, 116.71], ['Gladstone', 'Australia', 'Australia', -23.83, 151.25],
  ['Newcastle', 'Australia', 'Australia', -32.92, 151.79],
  ['Richards Bay', 'South Africa', 'Southern Africa', -28.8, 32.04], ['Durban', 'South Africa', 'Southern Africa', -29.87, 31.03], ['Mombasa', 'Kenya', 'East Africa', -4.06, 39.67],
  ['Lagos', 'Nigeria', 'West Africa', 6.44, 3.4], ['Bonny', 'Nigeria', 'West Africa', 4.42, 7.15], ['Abidjan', 'Côte d’Ivoire', 'West Africa', 5.27, -4.02],
  ['Kamsar', 'Guinea', 'West Africa', 10.65, -14.61], ['Dakar', 'Senegal', 'West Africa', 14.68, -17.43],
  ['Santos', 'Brazil', 'East coast South America', -23.96, -46.3], ['Tubarão', 'Brazil', 'East coast South America', -20.29, -40.24], ['Paranaguá', 'Brazil', 'East coast South America', -25.5, -48.51],
  ['Rosario', 'Argentina', 'East coast South America', -32.95, -60.64], ['Bahía Blanca', 'Argentina', 'East coast South America', -38.78, -62.27],
  ['Cartagena', 'Colombia', 'Caribbean', 10.4, -75.53], ['Callao', 'Peru', 'West coast South America', -12.05, -77.15],
  ['Houston', 'United States', 'US Gulf', 29.73, -95.27], ['Corpus Christi', 'United States', 'US Gulf', 27.81, -97.4], ['New Orleans', 'United States', 'US Gulf', 29.95, -90.06],
  ['New York', 'United States', 'US Atlantic', 40.67, -74.04], ['Long Beach', 'United States', 'US Pacific', 33.75, -118.21], ['Vancouver', 'Canada', 'North Pacific', 49.29, -123.11]
].map(p => ({ name: p[0], country: p[1], region: p[2], lat: p[3], lon: p[4] }));
const PORT = Object.fromEntries(PORTS.map(p => [p.name, p]));
const REGIONS = [...new Set(PORTS.map(p => p.region))];
/* The wider port list (ports.js) feeds port pickers and rough distances. Curated ports above keep their regions. */
if (typeof WORLD !== 'undefined') Object.keys(WORLD).forEach(cc => WORLD[cc][2].forEach(p => {
  if (!PORT[p[0]]) { const o = { name: p[0], country: WORLD[cc][0], region: '', lat: p[1], lon: p[2], cc }; PORTS.push(o); PORT[p[0]] = o; }
}));
const RESTRICTED = ['Iran', 'North Korea', 'Syria'];

/* Great-circle distance with a routing allowance. A placeholder for a proper sea-distance table. */
function roughMiles(a, b) {
  const A = PORT[a], B = PORT[b];
  if (!A || !B) return null;
  if (a === b) return 0;
  const r = x => x * Math.PI / 180;
  const h = Math.sin(r(B.lat - A.lat) / 2) ** 2 + Math.cos(r(A.lat)) * Math.cos(r(B.lat)) * Math.sin(r(B.lon - A.lon) / 2) ** 2;
  return Math.round(2 * 3440 * Math.asin(Math.sqrt(h)) * 1.3 / 10) * 10;
}

/* ---------- Standard terms ---------- */
const FLAGS = ['Bahamas', 'Cyprus', 'Greece', 'Hong Kong', 'Isle of Man', 'Liberia', 'Malta', 'Marshall Islands', 'Norway', 'Panama', 'Portugal (Madeira)', 'Singapore', 'United Kingdom', 'Other'];
const CLASS_SOCIETIES = ['ABS', 'Bureau Veritas', 'China Classification Society', 'ClassNK', 'DNV', 'Indian Register', 'Korean Register', "Lloyd's Register", 'RINA', 'Other IACS member', 'Non-IACS'];
const PI_CLUBS = ['American Club', 'Britannia', 'Gard', 'Japan P&I', 'London P&I', 'NorthStandard', 'Shipowners Club', 'Skuld', 'Steamship Mutual', 'Swedish Club', 'UK P&I', 'West of England', 'Fixed-premium insurer', 'Other'];
const FREIGHT_TERMS = ['FIOST (free in, out, stowed and trimmed)', 'FIO (free in and out)', 'Liner terms', 'FILO (free in, liner out)', 'Not applicable'];
const SUBJECTS = [
  'Charterer’s management approval', 'Owner’s management approval', 'Stem (cargo availability confirmed)',
  'Shipper’s and receiver’s approval of the vessel', 'Vetting and terminal acceptance', 'Sanctions and counterparty checks cleared',
  'Charter party details agreed', 'Freight security in place'
];
const VISIBILITY = {
  open: ['Open to verified members', 'Any verified owner or broker can see the cargo and offer. Your company name stays hidden until you engage.'],
  shortlist: ['Shortlist only', 'Only companies you invite can see it or offer.'],
  sealed: ['Sealed tender', 'Verified members can offer, but nobody sees a rival offer or how many there are. Offers open at the deadline.']
};
const STAGES = ['On subjects', 'Fixed', 'Loading', 'On passage', 'Discharging', 'Freight settled', 'Closed'];
const VOYAGE_EVENTS = ['Vessel arrived at load port', 'Notice of readiness tendered (load)', 'Loading commenced', 'Loading completed', 'Bills of lading signed', 'Vessel sailed load port',
  'Vessel arrived at discharge port', 'Notice of readiness tendered (discharge)', 'Discharge commenced', 'Discharge completed', 'Weather or other stoppage', 'Shifting between berths'];

/* The passport: what each role has to evidence, and why a counterparty cares. */
const CHECKS = {
  all: [
    { k: 'reg', l: 'Company registration', why: 'Confirms the company exists and matches the name on the contract.', doc: 'Certificate of incorporation or registry extract' },
    { k: 'ubo', l: 'Directors and beneficial owners', why: 'Shows who ultimately controls the counterparty.', doc: 'Register of members or ownership declaration' },
    { k: 'sanc', l: 'Sanctions screening', why: 'Company, owners and directors screened against UK, EU, US and UN lists.', doc: 'Run by the desk; nothing to upload' },
    { k: 'bank', l: 'Bank account in the company name', why: 'Stops payments being diverted to a third party.', doc: 'Bank confirmation letter' },
    { k: 'refs', l: 'Two trade references', why: 'A newcomer’s substitute for a track record.', doc: 'Names and contacts; the desk calls them' }
  ],
  charterer: [
    { k: 'funds', l: 'Financial standing', why: 'Owners want to know freight and demurrage will be paid.', doc: 'Audited accounts, bank reference or parent guarantee' },
    { k: 'cargoEv', l: 'Evidence of cargo, per listing', why: 'Filters out enquiries with no real cargo behind them.', doc: 'Sales contract, stem confirmation or letter of credit' }
  ],
  owner: [
    { k: 'title', l: 'Title or authority over each vessel', why: 'Proves you are the registered owner, or the manager with written authority.', doc: 'Ship registry transcript or management agreement' },
    { k: 'class', l: 'Class certificate, per vessel', why: 'Vessel is in class with a recognised society.', doc: 'Certificate of class with survey status' },
    { k: 'pi', l: 'P&I certificate of entry, per vessel', why: 'Liability cover is in force for the voyage.', doc: 'Certificate of entry' },
    { k: 'hm', l: 'Hull and machinery insurance', why: 'The ship itself is insured.', doc: 'Cover note' },
    { k: 'ism', l: 'Safety and security certificates', why: 'Document of compliance, safety management and ship security certificates are valid.', doc: 'DOC, SMC and ISSC' }
  ],
  broker: [
    { k: 'pii', l: 'Professional indemnity insurance', why: 'Covers the broker’s errors and omissions.', doc: 'Insurance certificate' },
    { k: 'mandate', l: 'Mandate, per deal', why: 'Shows who the broker acts for and how many intermediaries sit between them and the principal.', doc: 'Declared on every offer' },
    { k: 'member', l: 'Trade body membership (optional)', why: 'Baltic Exchange, FONASBA member association or Institute of Chartered Shipbrokers.', doc: 'Membership confirmation' }
  ]
};

/* Known failure modes in chartering and the safeguard built for each. */
const SAFEGUARDS = [
  ['Freight or hire is not paid', 'Freight security is a condition of the fixture. Funds sit with a regulated escrow or banking partner and release against agreed voyage events.', 'Payments'],
  ['The cargo does not exist', 'Each listing carries evidence of cargo, checked by the desk before it goes live. Unverified charterers cannot list.', 'Passport'],
  ['The ship is not as described', 'Particulars are tied to the IMO number. Class, P&I and safety certificates are held on file with expiry dates.', 'Passport'],
  ['Sanctions exposure', 'Companies, owners, vessels and cargo origin are screened before a fixture can become firm, and again before loading.', 'Subjects'],
  ['Chains of intermediaries', 'A broker must state who they act for and how many parties sit between them and the principal. Commission is written into every offer.', 'Offers'],
  ['Advertising a cargo moves the rate', 'List to a shortlist, or run a sealed tender. Company names stay hidden until both sides engage.', 'Listings'],
  ['Subjects drag on', 'Every subject has a deadline and a clock. If it is not lifted in time the fixture fails cleanly and both sides are released.', 'Subjects'],
  ['Demurrage disputes', 'Voyage events go into a shared time log that both sides confirm as they happen. Laytime is calculated from that record.', 'Time log'],
  ['Nobody answers', 'Every verified enquiry gets a named contact and a response clock. Response times are shown on each profile.', 'Desk'],
  ['Commission goes unpaid', 'Commission is deducted and paid to the broker when freight is released.', 'Payments'],
  ['A dispute after the voyage', 'The recap, every offer, every message and the time log form one record. Contracts carry an agreed arbitration clause.', 'Deal record']
];

const GLOSSARY = [
  ['Laycan', 'The window of dates in which the ship must arrive ready to load. Arrive after it and the charterer may cancel.'],
  ['Firm offer', 'An offer that binds the sender if accepted before its time limit.'],
  ['On subjects', 'Main terms are agreed but the deal is conditional on listed items, each with a deadline.'],
  ['Fixture', 'A concluded charter. A ship is “fixed” once all subjects are lifted.'],
  ['Recap', 'The written summary of agreed terms. It is the contract until the charter party is signed.'],
  ['Charter party', 'The full contract, usually a standard form with agreed amendments.'],
  ['Laytime', 'Time allowed for loading and discharging without extra payment.'],
  ['Demurrage', 'Daily compensation paid to the owner when laytime is exceeded.'],
  ['Despatch', 'Payment to the charterer when the ship is turned around faster than laytime allows.'],
  ['Notice of readiness', 'The master’s notice that the ship has arrived and is ready. It starts the laytime clock.'],
  ['Deadweight', 'The weight a ship can carry: cargo, fuel, stores and water.'],
  ['Worldscale', 'A reference rate schedule for tanker voyages. Freight is quoted as a percentage of it.'],
  ['Time charter', 'Hiring the whole ship by the day. The charterer pays fuel and port costs.'],
  ['Voyage charter', 'Paying freight for one voyage. The owner pays fuel and port costs.'],
  ['Address commission', 'A percentage of freight returned to the charterer.'],
  ['P&I', 'Protection and indemnity insurance: the owner’s third-party liability cover.'],
  ['Stem', 'Confirmation from the supplier that the cargo is available on the dates.']
];

/* ---------- Sample records ---------- */
const SAMPLE = {
  companies: [
    { id: 'c-orrin', name: 'Orrin Vale Trading', role: 'charterer', country: 'United Kingdom', since: 2025, verified: 'verified', level: 5, fixtures: 2, respH: 3, about: 'Grain and fertiliser trader.' },
    { id: 'c-halvard', name: 'Halvard Fuels', role: 'charterer', country: 'Netherlands', since: 2024, verified: 'verified', level: 6, fixtures: 4, respH: 2, about: 'Regional distributor of middle distillates.' },
    { id: 'c-mossgiel', name: 'Mossgiel Minerals', role: 'charterer', country: 'Singapore', since: 2026, verified: 'review', level: 3, fixtures: 0, respH: 9, about: 'Bauxite and coal buyer.' },
    { id: 'c-quillon', name: 'Quillon Cement Supply', role: 'charterer', country: 'UAE', since: 2025, verified: 'verified', level: 5, fixtures: 1, respH: 5, about: 'Clinker and bulk cement importer.' },
    { id: 'o-brannoch', name: 'Brannoch Shipping', role: 'owner', country: 'Greece', since: 2025, verified: 'verified', level: 6, fixtures: 3, respH: 2, about: 'Two geared bulk carriers and one product tanker.' },
    { id: 'o-tessaly', name: 'Tessaly Tankers', role: 'owner', country: 'Cyprus', since: 2024, verified: 'verified', level: 6, fixtures: 5, respH: 1, about: 'Product and chemical tankers.' },
    { id: 'o-wendover', name: 'Wendover Bulk', role: 'owner', country: 'Singapore', since: 2026, verified: 'verified', level: 4, fixtures: 0, respH: 4, about: 'First vessel acquired this year.' },
    { id: 'o-skerry', name: 'Skerry Gas Carriers', role: 'owner', country: 'Norway', since: 2023, verified: 'verified', level: 7, fixtures: 6, respH: 2, about: 'Pressurised and semi-refrigerated LPG carriers.' },
    { id: 'b-calder', name: 'Calder & Finch Shipbrokers', role: 'broker', country: 'United Kingdom', since: 2025, verified: 'verified', level: 5, fixtures: 4, respH: 1, about: 'Dry cargo and small tanker broking.' },
    { id: 'b-pelham', name: 'Pelham Roe Chartering', role: 'broker', country: 'Türkiye', since: 2026, verified: 'review', level: 2, fixtures: 0, respH: 6, about: 'Black Sea and Mediterranean dry cargo.' },
    { id: 'desk', name: 'FindAVessel desk', role: 'desk', country: 'United Kingdom', since: 2026, verified: 'verified', level: 7, fixtures: 0, respH: 1, about: 'Verification, matching and deal support.' }
  ],
  vessels: [
    { id: 'v1', owner: 'o-brannoch', name: 'Brannoch Dawn', seg: 'bulk', subtype: 'Geared bulk carrier', size: 37200, built: 2012, flag: 'Marshall Islands', cls: 'ClassNK', pi: 'Gard', loa: 180, beam: 30, draft: 10.4, gt: 23300,
      x: { gear: '4 x 30 t cranes', grabs: '4 x 12 m³', holds: '5 / 5', grain: 47100, bale: 45300, features: 'Box holds, log fitted', last3: 'Wheat / urea / steel coils', rightship: '4' },
      open: 'Constanta', openDate: inDays(6), trades: 'Black Sea, Mediterranean, West Africa', speed: 13, cons: 24, verified: 'verified', certExpiry: inDays(210) },
    { id: 'v2', owner: 'o-brannoch', name: 'Brannoch Tide', seg: 'bulk', subtype: 'Geared bulk carrier', size: 58100, built: 2014, flag: 'Liberia', cls: 'Bureau Veritas', pi: 'Skuld', loa: 190, beam: 32.3, draft: 12.9, gt: 33000,
      x: { gear: '4 x 30 t cranes', grabs: '4 x 12 m³', holds: '5 / 5', grain: 72300, bale: 70200, features: 'Strengthened for heavy cargoes', last3: 'Bauxite / clinker / coal', rightship: '4' },
      open: 'Singapore', openDate: inDays(11), trades: 'South-east Asia, Indian Ocean, Australia', speed: 13.5, cons: 29, verified: 'verified', certExpiry: inDays(95) },
    { id: 'v3', owner: 'o-brannoch', name: 'Brannoch Firth', seg: 'tanker', subtype: 'Clean product tanker', size: 13100, built: 2015, flag: 'Malta', cls: 'DNV', pi: 'Britannia', loa: 128, beam: 20.4, draft: 8.7, gt: 8500,
      x: { cubic: 14200, coating: 'Phenolic epoxy', heating: 'None', segregations: 6, imoType: 'Type 2/3', igs: 'Nitrogen generator', last3: 'ULSD / gasoline / ULSD', sire: inDays(-70), approvals: 'None yet' },
      open: 'Rotterdam', openDate: inDays(4), trades: 'North-west Europe, Baltic, Mediterranean', speed: 12.5, cons: 14, verified: 'verified', certExpiry: inDays(300) },
    { id: 'v4', owner: 'o-tessaly', name: 'Tessaly Grace', seg: 'tanker', subtype: 'Clean product tanker', size: 49800, built: 2016, flag: 'Cyprus', cls: "Lloyd's Register", pi: 'UK P&I', loa: 183, beam: 32.2, draft: 13.2, gt: 29700,
      x: { cubic: 53900, coating: 'Epoxy', heating: 'None', segregations: 6, imoType: 'Type 3', igs: 'Yes', last3: 'Jet fuel / ULSD / naphtha', sire: inDays(-40), approvals: 'Three oil majors' },
      open: 'Sikka', openDate: inDays(9), trades: 'Worldwide', speed: 13, cons: 26, verified: 'verified', certExpiry: inDays(160) },
    { id: 'v5', owner: 'o-tessaly', name: 'Tessaly Anchor', seg: 'tanker', subtype: 'Chemical tanker', size: 19900, built: 2011, flag: 'Marshall Islands', cls: 'ABS', pi: 'Steamship Mutual', loa: 146, beam: 24, draft: 9.6, gt: 12100,
      x: { cubic: 22400, coating: 'Stainless steel', heating: 'Steam coils', segregations: 20, imoType: 'Type 2', igs: 'Nitrogen generator', last3: 'Palm oil / methanol / caustic soda', sire: inDays(-110), approvals: 'CDI inspected' },
      open: 'Port Klang', openDate: inDays(14), trades: 'Asia, Middle East, Mediterranean', speed: 13, cons: 18, verified: 'verified', certExpiry: inDays(40) },
    { id: 'v6', owner: 'o-wendover', name: 'Wendover Pride', seg: 'bulk', subtype: 'Gearless bulk carrier', size: 81600, built: 2013, flag: 'Panama', cls: 'Korean Register', pi: 'West of England', loa: 229, beam: 32.3, draft: 14.5, gt: 43500,
      x: { gear: 'Gearless', grabs: 'None', holds: '7 / 7', grain: 97000, bale: 0, features: '', last3: 'Coal / soybeans / coal', rightship: '3' },
      open: 'Qingdao', openDate: inDays(8), trades: 'Pacific, Australia, East coast South America', speed: 13.5, cons: 32, verified: 'review', certExpiry: inDays(260) },
    { id: 'v7', owner: 'o-skerry', name: 'Skerry Bjorn', seg: 'gas', subtype: 'LPG carrier, semi-refrigerated', size: 9000, built: 2018, flag: 'Norway', cls: 'DNV', pi: 'Gard', loa: 120, beam: 19.8, draft: 8.2, gt: 8800,
      x: { dwt: 9800, containment: 'Type C bilobe tanks', grades: 'Propane, butane, ammonia, propylene', minTemp: -48, reliq: 'Yes', last3: 'Propane / butane / propane', sire: inDays(-55) },
      open: 'Skikda', openDate: inDays(5), trades: 'Mediterranean, North-west Europe, West Africa', speed: 14, cons: 16, verified: 'verified', certExpiry: inDays(330) },
    { id: 'v8', owner: 'o-skerry', name: 'Skerry Halden', seg: 'mpp', subtype: 'Heavy-lift ship', size: 12700, built: 2010, flag: 'Portugal (Madeira)', cls: 'Bureau Veritas', pi: 'Skuld', loa: 138, beam: 21, draft: 8, gt: 9600,
      x: { gear: '2 x 150 t, combinable to 300 t', holds: '2 / 2', tween: 'Adjustable', bale: 15900, deck: '15 t/m² on hatch covers', last3: 'Transformers / steel pipes / wind blades' },
      open: 'Hamburg', openDate: inDays(12), trades: 'Worldwide', speed: 14, cons: 17, verified: 'verified', certExpiry: inDays(120) }
  ],
  cargoes: [
    { id: 'g1', by: 'c-orrin', seg: 'bulk', type: 'voyage', cargo: 'Wheat', qty: 30000, tol: 10, load: 'Constanta', disch: 'Alexandria', from: inDays(9), to: inDays(15),
      x: { stowage: '1.30', loadRate: 8000, dischRate: 4000, gearReq: 'Geared preferred for discharge', imsbc: 'Grain, not hazardous' },
      terms: FREIGHT_TERMS[0], cp: 'GENCON 2022', idea: 24.5, rateType: 'USD per tonne', dem: 12000, maxAge: 20, vis: 'open', deadline: NOW + 30 * HOUR, evidence: 'Sales contract seen by the desk', posted: NOW - 20 * HOUR, status: 'open', note: 'One safe berth each end. Shore cranes available at Alexandria but slow.' },
    { id: 'g2', by: 'c-halvard', seg: 'tanker', type: 'voyage', cargo: 'Gasoil / diesel', qty: 12000, tol: 5, load: 'Rotterdam', disch: 'Gdansk', from: inDays(5), to: inDays(8),
      x: { grade: 'ULSD 10 ppm, EN 590', heat: 'None', lastCargoReq: 'Last three clean, unleaded', vetting: 'SIRE within 6 months and terminal acceptance' },
      terms: 'Not applicable', cp: 'ASBATANKVOY', idea: 265000, rateType: 'Lumpsum USD', dem: 14000, maxAge: 15, vis: 'sealed', deadline: NOW + 9 * HOUR, evidence: 'Stem confirmation seen by the desk', posted: NOW - 6 * HOUR, status: 'open', note: '72 hours laytime in total, Sundays and holidays included.' },
    { id: 'g3', by: 'c-mossgiel', seg: 'bulk', type: 'voyage', cargo: 'Bauxite', qty: 55000, tol: 10, load: 'Kamsar', disch: 'Qingdao', from: inDays(18), to: inDays(26),
      x: { stowage: '0.85', loadRate: 15000, dischRate: 10000, gearReq: 'Geared with grabs', imsbc: 'Group A if fines content is high' },
      terms: FREIGHT_TERMS[0], cp: 'GENCON 2022', idea: 31, rateType: 'USD per tonne', dem: 16000, maxAge: 18, vis: 'open', deadline: NOW + 70 * HOUR, evidence: 'Awaiting evidence', posted: NOW - 3 * HOUR, status: 'review', note: 'Transshipment loading at anchorage by floating crane.' },
    { id: 'g4', by: 'c-quillon', seg: 'bulk', type: 'voyage', cargo: 'Clinker', qty: 52000, tol: 10, load: 'Ho Chi Minh City', disch: 'Chittagong', from: inDays(12), to: inDays(19),
      x: { stowage: '0.70', loadRate: 10000, dischRate: 6000, gearReq: 'Geared with grabs', imsbc: 'Group C' },
      terms: FREIGHT_TERMS[0], cp: 'GENCON 1994', idea: 15.75, rateType: 'USD per tonne', dem: 13500, maxAge: 22, vis: 'shortlist', shortlist: ['o-brannoch', 'b-calder'], deadline: NOW + 48 * HOUR, evidence: 'Letter of credit seen by the desk', posted: NOW - 28 * HOUR, status: 'open', note: 'Discharge at anchorage into lighters.' },
    { id: 'g5', by: 'c-halvard', seg: 'gas', type: 'voyage', cargo: 'Propane', qty: 4200, tol: 5, load: 'Skikda', disch: 'Sines', from: inDays(6), to: inDays(10),
      x: { grade: 'Commercial propane', tankCond: 'Under propane vapours', vetting: 'SIRE within 6 months' },
      terms: 'Not applicable', cp: 'ASBAGASVOY', idea: 78, rateType: 'USD per tonne', dem: 15000, maxAge: 20, vis: 'open', deadline: NOW + 22 * HOUR, evidence: 'Stem confirmation seen by the desk', posted: NOW - 11 * HOUR, status: 'open', note: '' },
    { id: 'g6', by: 'c-orrin', seg: 'bulk', type: 'time', cargo: 'Trip time charter: fertiliser', qty: 35000, tol: 0, load: 'Klaipeda', disch: 'Santos', from: inDays(20), to: inDays(30),
      x: { stowage: '1.15', gearReq: 'Geared', imsbc: 'Group C' }, duration: 'One trip, about 40 days',
      terms: 'Not applicable', cp: 'NYPE 2015', idea: 14500, rateType: 'USD per day', dem: 0, maxAge: 20, vis: 'open', deadline: NOW + 96 * HOUR, evidence: 'Sales contract seen by the desk', posted: NOW - 2 * HOUR, status: 'open', note: 'Delivery on dropping last outward pilot Klaipeda, redelivery Santos.' },
    { id: 'g7', by: 'c-quillon', seg: 'mpp', type: 'voyage', cargo: 'Project cargo', qty: 3800, tol: 0, load: 'Hamburg', disch: 'Jebel Ali', from: inDays(14), to: inDays(22),
      x: { pieces: '2 kiln sections, 140 t each, 24 x 5.2 x 5.2 m', gearReq: 'Combined lift of 280 t or more', stowReq: 'Under deck preferred' },
      terms: 'Liner terms', cp: 'HEAVYLIFTVOY', idea: 890000, rateType: 'Lumpsum USD', dem: 18000, maxAge: 25, vis: 'open', deadline: NOW + 120 * HOUR, evidence: 'Purchase order seen by the desk', posted: NOW - 40 * HOUR, status: 'open', note: 'Full packing list in documents.' }
  ],
  offers: [
    { id: 'f1', cargo: 'g1', vessel: 'v1', by: 'o-brannoch', role: 'owner', actingFor: 'Owner, as principal', chain: 0, rateType: 'USD per tonne', rate: 26.25, qty: 30000, from: inDays(10), to: inDays(14), dem: 12500, laytime: '8,000 load / 4,000 discharge, weather working days', cp: 'GENCON 2022', commAddr: 0, commBrok: 1.25,
      subjects: [0, 2, 3, 5, 7], valid: NOW + 5 * HOUR, note: 'Vessel has just discharged wheat at Constanta. Holds grain clean.', status: 'firm', round: 1, at: NOW - 4 * HOUR },
    { id: 'f2', cargo: 'g1', vessel: null, vesselName: 'Handysize to be nominated, 32,000 to 38,000 DWT, built 2010 or later', by: 'b-pelham', role: 'broker', actingFor: 'Owner', chain: 1, rateType: 'USD per tonne', rate: 25.4, qty: 30000, from: inDays(11), to: inDays(15), dem: 12000, laytime: '8,000 load / 4,000 discharge, weather working days', cp: 'GENCON 2022', commAddr: 0, commBrok: 2.5,
      subjects: [0, 1, 2, 5], valid: NOW + 2 * HOUR, note: 'Performing vessel named 3 days before laycan.', status: 'firm', round: 1, at: NOW - 7 * HOUR },
    { id: 'f3', cargo: 'g5', vessel: 'v7', by: 'o-skerry', role: 'owner', actingFor: 'Owner, as principal', chain: 0, rateType: 'USD per tonne', rate: 82, qty: 4200, from: inDays(6), to: inDays(9), dem: 15500, laytime: '48 hours in total', cp: 'ASBAGASVOY', commAddr: 1.25, commBrok: 1.25,
      subjects: [0, 2, 4, 5], valid: NOW + 6 * HOUR, note: '', status: 'firm', round: 1, at: NOW - 2 * HOUR }
  ],
  deals: [
    { id: 'd1', cargo: 'g4x', title: 'Urea, 28,000 t, Sohar to Mombasa', seg: 'bulk', charterer: 'c-orrin', owner: 'o-brannoch', broker: 'b-calder', vessel: 'v1', stage: 2,
      terms: { cargo: 'Urea in bulk', qty: 28000, tol: 10, load: 'Sohar', disch: 'Mombasa', from: inDays(-6), to: inDays(-1), rateType: 'USD per tonne', rate: 22, dem: 11500, laytime: '6,000 load / 3,500 discharge, weather working days', loadRate: 6000, dischRate: 3500, cp: 'GENCON 2022', commAddr: 0, commBrok: 1.25, freightTerms: FREIGHT_TERMS[0], actingFor: 'Calder & Finch act for the charterer' },
      subjects: [
        { n: SUBJECTS[0], due: NOW - 9 * DAY, st: 'lifted', by: 'Orrin Vale Trading' }, { n: SUBJECTS[2], due: NOW - 9 * DAY, st: 'lifted', by: 'Orrin Vale Trading' },
        { n: SUBJECTS[3], due: NOW - 8 * DAY, st: 'lifted', by: 'Orrin Vale Trading' }, { n: SUBJECTS[5], due: NOW - 8 * DAY, st: 'lifted', by: 'FindAVessel desk' },
        { n: SUBJECTS[7], due: NOW - 7 * DAY, st: 'lifted', by: 'Escrow partner (simulated)' }
      ],
      pay: [
        { n: 'Freight deposited with escrow partner', pct: 100, trigger: 'Before notice of readiness at load port', st: 'done', at: NOW - 7 * DAY },
        { n: 'First release to owner', pct: 95, trigger: 'Bills of lading signed, both sides confirm', st: 'pending', needs: 'Bills of lading signed' },
        { n: 'Balance and demurrage or despatch', pct: 5, trigger: 'Discharge completed and laytime statement agreed', st: 'pending', needs: 'Discharge completed' }
      ],
      log: [
        { e: VOYAGE_EVENTS[0], t: NOW - 3.2 * DAY, o: true, c: true }, { e: VOYAGE_EVENTS[1], t: NOW - 3.1 * DAY, o: true, c: true },
        { e: VOYAGE_EVENTS[2], t: NOW - 2.4 * DAY, o: true, c: true }, { e: VOYAGE_EVENTS[10], t: NOW - 1.5 * DAY, o: true, c: false, note: 'Rain, 5 hours' }
      ],
      docs: [['Fixture recap', 'Generated', NOW - 8 * DAY], ['Charter party, GENCON 2022', 'Signed by both', NOW - 6 * DAY], ['Certificate of class', 'On file', NOW - 30 * DAY], ['P&I certificate of entry', 'On file', NOW - 30 * DAY]],
      msgs: [['b-calder', 'Master reports loading at about 5,800 t a day. Expect completion the day after tomorrow.', NOW - 20 * HOUR], ['o-brannoch', 'Rain stoppage logged. Please confirm it on your side.', NOW - 30 * HOUR]],
      created: NOW - 10 * DAY }
  ]
};
