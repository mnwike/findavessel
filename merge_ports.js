// Merges the World Port Index (US NGA, public domain) with the sea-ports list (MIT) into one port list per country.
const fs = require('fs'), iso = require('i18n-iso-countries');
iso.registerLocale(require('i18n-iso-countries/langs/en.json'));
const sp = require('sea-ports').JSON || require('sea-ports');
const d3 = require('d3-geo'), topo = require('topojson-client');
const land = topo.feature(require('world-atlas/land-110m.json'), require('world-atlas/land-110m.json').objects.land);
// A place counts as coastal if open water lies within about 40 km of it on the coarse world outline.
const coastal = p => { for (const [dx, dy] of [[0, 0], [.36, 0], [-.36, 0], [0, .36], [0, -.36], [.26, .26], [-.26, .26], [.26, -.26], [-.26, -.26]]) if (!d3.geoContains(land, [p.lon + dx / Math.max(.2, Math.cos(p.lat * Math.PI / 180)), p.lat + dy])) return true; return false; };
// Known corrections to positions in the trade list, checked by hand.
const FIX = { GBSOW: [53.28, -2.86] };
const wpi = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const R = 6371, rad = x => x * Math.PI / 180;
const km = (a, b) => { const dl = rad(b.lat - a.lat), dn = rad(b.lon - a.lon), s = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(port|porto|puerto|harbou?r|gang|ko|bay|of|de|el|al|the|saint|st|san|terminal|haven)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const ALIAS = { 'Burma': 'MM', 'Russia': 'RU', 'South Korea': 'KR', 'North Korea': 'KP', 'Iran': 'IR', 'Syria': 'SY', 'Vietnam': 'VN', 'Tanzania': 'TZ', 'Venezuela': 'VE', 'Bolivia': 'BO', 'Brunei': 'BN', 'Taiwan': 'TW', 'Laos': 'LA', 'Moldova': 'MD',
  'Ivory Coast': 'CI', "Cote d'Ivoire": 'CI', "Côte d'Ivoire": 'CI', 'Congo': 'CG', 'Congo (Brazzaville)': 'CG', 'Congo (Kinshasa)': 'CD', 'Democratic Republic of the Congo': 'CD', 'Republic of the Congo': 'CG', 'The Bahamas': 'BS', 'Bahamas, The': 'BS', 'The Gambia': 'GM', 'Gambia, The': 'GM',
  'Cape Verde': 'CV', 'Cabo Verde': 'CV', 'East Timor': 'TL', 'Timor-Leste': 'TL', 'Micronesia': 'FM', 'Federated States of Micronesia': 'FM', 'Macau': 'MO', 'Hong Kong': 'HK', 'Reunion': 'RE', 'Sao Tome and Principe': 'ST', 'Saint Helena': 'SH', 'Falkland Islands': 'FK', 'Falkland Islands (Islas Malvinas)': 'FK',
  'Virgin Islands': 'VI', 'U.S. Virgin Islands': 'VI', 'British Virgin Islands': 'VG', 'Netherlands Antilles': 'CW', 'Curacao': 'CW', 'Sint Maarten': 'SX', 'Saint Martin': 'MF', 'Turkey': 'TR', 'Turkiye': 'TR', 'Czechia': 'CZ', 'Swaziland': 'SZ', 'Eswatini': 'SZ', 'Macedonia': 'MK', 'Palestine': 'PS', 'Gaza Strip': 'PS', 'West Bank': 'PS',
  'Wake Island': 'UM', 'Midway Islands': 'UM', 'Johnston Atoll': 'UM', 'Svalbard': 'SJ', 'Jan Mayen': 'SJ', 'Pitcairn Islands': 'PN', 'Saint Kitts and Nevis': 'KN', 'Saint Lucia': 'LC', 'Saint Vincent and the Grenadines': 'VC', 'Antigua and Barbuda': 'AG', 'Trinidad and Tobago': 'TT', 'Bosnia and Herzegovina': 'BA',
  'Saint Helena, Ascension, and Tristan da Cunha': 'SH', 'South Georgia and South Sandwich Islands': 'GS', 'Caribbean Netherlands': 'BQ', 'Johnson Atoll': 'UM', 'Saint Vincent and the Grenadines (Windward Islands)': 'VC', 'United States': 'US', 'United Kingdom': 'GB', 'Kosovo': 'XK', 'Western Sahara': 'EH', 'Guernsey': 'GG', 'Jersey': 'JE', 'Isle of Man': 'IM', 'Gibraltar': 'GI', 'Faroe Islands': 'FO', 'Greenland': 'GL', 'Guam': 'GU', 'Puerto Rico': 'PR', 'American Samoa': 'AS', 'Northern Mariana Islands': 'MP' };
const ccOf = n => ALIAS[n] || iso.getAlpha2Code(n, 'en') || null;
const C = {}, unmapped = {};
const get = cc => (C[cc] = C[cc] || { w: [], s: [] });
wpi.forEach(p => { const cc = ccOf(p.c.trim()); if (!cc) { unmapped[p.c] = (unmapped[p.c] || 0) + 1; return; } if (!p.n || (!p.la && !p.lo)) return; get(cc).w.push(p); });
Object.values(sp).forEach(p => { if (!p.coordinates || !p.unlocs || !p.unlocs[0] || !p.name) return; const cc = p.unlocs[0].slice(0, 2).toUpperCase(); const fx = FIX[p.unlocs[0]]; get(cc).s.push({ n: p.name.trim(), lon: fx ? fx[1] : +p.coordinates[0], lat: fx ? fx[0] : +p.coordinates[1], fixed: !!fx, u: p.unlocs[0], prov: (p.province || p.city || '').replace(/\s*\[.*?\]/g, ''), country: p.country }); });
const title = s => s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : s;
const FAC = [['fct', 'Container'], ['fsb', 'Dry bulk'], ['flb', 'Liquid bulk'], ['fot', 'Oil terminal'], ['fln', 'LNG terminal'], ['fbk', 'Breakbulk'], ['fr', 'Ro-ro']];
const out = {}, stats = { both: 0, wpiOnly: 0, spOnly: 0, dropped: [] };
Object.keys(C).forEach(cc => {
  const { w, s } = C[cc], used = new Set(), ports = [];
  const pairs = [];
  s.forEach((a, i) => w.forEach((b, j) => { const d = km(a, { lat: b.la, lon: b.lo }), na = norm(a.n), nb = norm(b.n), exact = na && na === nb; if (d > 30 && !exact) return; const part = na && nb && (na.includes(nb) || nb.includes(na) || na.split(' ')[0] === nb.split(' ')[0]); if (exact) pairs.push([Math.min(d, 9000) - 20000, i, j]); else if (part) pairs.push([d - 100, i, j]); else if (d < 6) pairs.push([d, i, j]); }));
  pairs.sort((x, y) => x[0] - y[0]);
  const sm = {}, wm = {};
  pairs.forEach(([d, i, j]) => { if (sm[i] === undefined && wm[j] === undefined) { sm[i] = j; wm[j] = i; } });
  const attrs = b => ({ hs: (b.hs || '').trim(), ht: (b.ht || '').trim(), sh: (b.sh || '').trim(), pi: b.pi ? 1 : 0, tg: b.tg ? 1 : 0, fac: FAC.filter(f => b[f[0]] === 1).map(f => f[1]) });
  w.forEach((b, j) => {
    const a = wm[j] !== undefined ? s[wm[j]] : null;
    // Position: the World Port Index is the reference. Name and UN/LOCODE come from the trade list when the two agree on the port.
    ports.push(Object.assign({ n: a ? a.n : title(b.n.trim()), aka: a && norm(a.n) !== norm(b.n) ? title(b.n.trim()) : '', lat: b.la, lon: b.lo, u: a ? a.u : '', prov: a ? a.prov : (b.rg || '').trim(), src: a ? 'both' : 'wpi' }, attrs(b)));
    a ? stats.both++ : stats.wpiOnly++;
  });
  s.forEach((a, i) => {
    if (sm[i] !== undefined) return;
    // A port only in the trade list is kept if it sits near other known ports of the same country (or the country has none in the index).
    const near = Math.min(...wpi.map(b => km(a, { lat: b.la, lon: b.lo })));
    if (!a.fixed && near > 40 && !coastal(a)) { stats.dropped.push(a.n + ' (' + cc + ')'); return; }
    ports.push({ n: a.n, aka: '', lat: a.lat, lon: a.lon, u: a.u, prov: a.prov, src: 'sp', hs: '', ht: '', sh: '', pi: 0, tg: 0, fac: [] }); stats.spOnly++;
  });
  // same name twice in one country: keep the indexed one
  const seen = {}; out[cc] = ports.filter(p => { const k = p.n.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; }).sort((a, b) => a.n.localeCompare(b.n));
});
fs.writeFileSync(process.argv[3], JSON.stringify(out));
console.log('countries', Object.keys(out).length, 'ports', Object.values(out).reduce((n, l) => n + l.length, 0), JSON.stringify({ both: stats.both, wpiOnly: stats.wpiOnly, spOnly: stats.spOnly, dropped: stats.dropped.length }));
console.log('unmapped countries', JSON.stringify(unmapped));
console.log('dropped', stats.dropped.length, stats.dropped.slice(0, 70).join(' | '));
const find = n => Object.entries(out).flatMap(([cc, l]) => l.filter(p => p.n.toLowerCase().includes(n) || (p.aka || '').toLowerCase().includes(n)).map(p => `${p.n}${p.aka ? ' [' + p.aka + ']' : ''} ${cc} ${p.lat.toFixed(2)},${p.lon.toFixed(2)} ${p.u} ${p.src} ${p.hs}`));
['stanlow', 'milford', 'rotterdam', 'singapore', 'qingdao', 'kamsar', 'apapa', 'lagos'].forEach(n => console.log(n, '=>', find(n).slice(0, 4).join(' ; ')));
