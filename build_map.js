// Builds the world map, per-country locator maps and the port list from open data.
// Sources: World Port Index (US NGA, public domain) and sea-ports (MIT) for ports, world-atlas / Natural Earth (public domain) for country shapes.
const fs = require('fs'), topo = require('topojson-client'), d3 = require('d3-geo');
const iso = require('i18n-iso-countries');
iso.registerLocale(require('i18n-iso-countries/langs/en.json'));
const world = require('world-atlas/countries-110m.json');
const out = process.argv[2] || '.';
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const r1 = v => Math.round(v * 10) / 10;

// Ports per ISO country code, from ports-source.json (built by merge_ports.js from the World Port Index and the sea-ports list)
const SRC = JSON.parse(fs.readFileSync(__dirname + '/ports-source.json', 'utf8'));
const C = {};
Object.keys(SRC).forEach(cc => { C[cc] = { names: {}, ports: {} }; SRC[cc].forEach(p => { C[cc].ports[p.n] = Object.assign({}, p, { prov: (p.prov || '').replace(/^(.*), The$/, 'The $1') }); }); });
const countries = {};
const NAMES = { CD: 'DR Congo', CG: 'Republic of the Congo', CN: 'China', IR: 'Iran', GM: 'Gambia', MD: 'Moldova', FK: 'Falkland Islands', RU: 'Russia', TZ: 'Tanzania', VE: 'Venezuela', SY: 'Syria', VN: 'Vietnam', BN: 'Brunei', TW: 'Taiwan', FM: 'Micronesia', BO: 'Bolivia', MK: 'North Macedonia', CI: 'Côte d’Ivoire', TR: 'Türkiye', US: 'United States', GB: 'United Kingdom', KP: 'North Korea', KR: 'South Korea', LA: 'Laos', AE: 'UAE', CV: 'Cabo Verde', VG: 'British Virgin Islands', VI: 'US Virgin Islands', MF: 'Saint Martin', SX: 'Sint Maarten', ST: 'São Tomé and Príncipe', PS: 'Palestine', RE: 'Réunion', CW: 'Curaçao' };
Object.keys(C).forEach(cc => {
  const name = NAMES[cc] ? NAMES[cc] : (iso.getName(cc, 'en') || cc).split(',')[0].replace(/ \(.*\)$/, '');
  countries[cc] = { cc, name, slug: slug(name), ports: Object.values(C[cc].ports).sort((a, b) => a.n.localeCompare(b.n)) };
});

const feats = topo.feature(world, world.objects.countries).features.filter(f => f.properties.name !== 'Antarctica');
feats.forEach(f => { f.cc = f.id ? iso.numericToAlpha2(String(f.id).padStart(3, '0')) : null; });
const fc = { type: 'FeatureCollection', features: feats };

// World map
const W = 960, H = 480;
const proj = d3.geoNaturalEarth1().fitExtent([[4, 4], [W - 4, H - 4]], fc);
const path = d3.geoPath(proj).digits(1);
let land = '', links = '';
const drawn = new Set();
feats.forEach(f => {
  const c = f.cc && countries[f.cc], d = path(f); if (!d) return;
  if (c) { drawn.add(f.cc); links += `<a href="ports-${c.slug}.html" data-act="country" data-cc="${f.cc}"><title>${c.name}: ${c.ports.length} ${c.ports.length === 1 ? 'port' : 'ports'}</title><path d="${d}"/></a>`; }
  else land += d;
});
let isl = '';
Object.values(countries).forEach(c => {
  if (drawn.has(c.cc)) return;
  const lon = c.ports.reduce((s, p) => s + p.lon, 0) / c.ports.length, lat = c.ports.reduce((s, p) => s + p.lat, 0) / c.ports.length;
  const xy = proj([lon, lat]); if (!xy) return;
  isl += `<a href="ports-${c.slug}.html" data-act="country" data-cc="${c.cc}"><title>${c.name}: ${c.ports.length} ${c.ports.length === 1 ? 'port' : 'ports'}</title><circle cx="${r1(xy[0])}" cy="${r1(xy[1])}" r="3.6"/></a>`;
});
let dots = '';
Object.values(countries).forEach(c => c.ports.forEach(p => { const xy = proj([p.lon, p.lat]); if (xy) dots += `M${r1(xy[0])} ${r1(xy[1])}h.01`; }));
const total = Object.values(countries).reduce((s, c) => s + c.ports.length, 0);
const worldSvg = `<svg class="map" viewBox="0 0 ${W} ${H}" role="img" aria-label="World map of ${total} seaports in ${Object.keys(countries).length} countries. Choose a country to see its ports."><path class="land" d="${land}"/><g class="has">${links}</g><path class="dots" d="${dots}"/><g class="isl">${isl}</g></svg>`;

// Locator map per country
const byCc = {}; feats.forEach(f => { if (f.cc) byCc[f.cc] = f; });
Object.values(countries).forEach(c => {
  const pts = { type: 'MultiPoint', coordinates: c.ports.map(p => [p.lon, p.lat]) };
  const f = byCc[c.cc];
  const fit = f ? { type: 'GeometryCollection', geometries: [f.geometry, pts] } : pts;
  const cen = d3.geoCentroid(fit);
  const p = d3.geoMercator().rotate([-cen[0], 0]);
  c.ports.length === 1 && !f ? p.scale(900).translate([360, 160]).center([0, cen[1]]) : p.fitExtent([[40, 30], [680, 290]], fit);
  if (p.scale() > 9000) p.scale(9000).translate([360, 160]).center([0, cen[1]]);
  const gp = d3.geoPath(p).digits(1);
  const near = feats.filter(g => g !== f).filter(g => { const b = gp.bounds(g); return b[1][0] > -200 && b[0][0] < 920 && b[1][1] > -200 && b[0][1] < 520 && (b[1][0] - b[0][0]) < 6000; }).map(g => gp(g)).filter(Boolean).join('');
  const marks = c.ports.map(x => { const xy = p([x.lon, x.lat]); return `<circle cx="${r1(xy[0])}" cy="${r1(xy[1])}" r="4"><title>${x.n}</title></circle>`; }).join('');
  c.svg = `<svg class="map map-c" viewBox="0 0 720 320" role="img" aria-label="Map of ${c.name} showing ${c.ports.length} ${c.ports.length === 1 ? 'port' : 'ports'}"><clipPath id="clip"><rect width="720" height="320"/></clipPath><g clip-path="url(#clip)"><path class="land" d="${near}"/>${f ? `<path class="home" d="${gp(f)}"/>` : ''}<g class="pins">${marks}</g></g></svg>`;
});

fs.writeFileSync(out + '/mapdata.json', JSON.stringify({ world: worldSvg, total, countries }));
// Compact list for the app: code -> [name, slug, [[port, lat, lon], ...]]
const app = {}; Object.values(countries).forEach(c => { app[c.cc] = [c.name, c.slug, c.ports.map(p => [p.n, Math.round(p.lat * 100) / 100, Math.round(p.lon * 100) / 100])]; });
fs.writeFileSync(out + '/ports.js', '/* Generated by build_map.js from the World Port Index (US NGA), the sea-ports dataset (MIT) and Natural Earth shapes. Do not edit by hand. */\n' +
  'const WORLD = ' + JSON.stringify(app) + ';\nconst WORLD_MAP = ' + JSON.stringify(worldSvg) + ';\n');
console.log(Object.keys(countries).length, 'countries', total, 'ports', 'map', Math.round(worldSvg.length / 1024) + 'KB', 'on-map', drawn.size);
