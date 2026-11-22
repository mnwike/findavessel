#!/usr/bin/env python3
"""Builds the static guide, ship-size and tool pages for FindAVessel.
Run from the repository root:  python3 build_pages.py
Each page is written next to index.html so it is served at /<slug> on GitHub Pages."""
import html, json, math

SITE = 'https://findavessel.com'
DATE = '2026-11-22'
THEME_BTN = ('<button class="theme-btn" data-theme-toggle aria-label="Switch between dark and light theme">'
             '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>'
             '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><span>Theme</span></button>')
LOGO = '<svg width="24" height="24" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M4 20h32M20 3v6M20 31v6" stroke="currentColor" stroke-width="2.6"/></svg>'
e = html.escape


# ---------- Figures: small inline SVG diagrams that follow the theme ----------
def svg(h, body, label):
    return f'<svg class="fig" viewBox="0 0 720 {h}" role="img" aria-label="{e(label)}" xmlns="http://www.w3.org/2000/svg">{body}</svg>'


def txt(x, y, s, cls='', size=14, anchor='start', weight=400):
    return f'<text x="{x}" y="{y}" font-size="{size}" text-anchor="{anchor}" font-weight="{weight}" class="{cls}">{e(s)}</text>'


def fig_timeline(segs, marks, label, note=''):
    """segs: (text, fraction, fill class). marks: (fraction, text above)."""
    x0, w, y = 40, 640, 96
    out, x = [], x0
    for t, f, cls in segs:
        sw = w * f
        out.append(f'<rect x="{x:.0f}" y="{y}" width="{sw:.0f}" height="46" class="{cls}"/>')
        out.append(txt(x + sw / 2, y + 28, t, 't-on', 14, 'middle', 600))
        x += sw
    for i, (f, t) in enumerate(marks):
        mx = x0 + w * f
        up = 44 if i % 2 == 0 else 70
        out.append(f'<path d="M{mx:.0f} {up + 6}V{y + 46}" class="s-rule" stroke-width="1.5"/>')
        anchor = 'start' if f < .15 else 'end' if f > .85 else 'middle'
        out.append(txt(mx, up, t, '', 13, anchor, 500))
    if note:
        out.append(txt(x0, y + 82, note, 't-muted', 13))
    return svg(200, ''.join(out), label)


def fig_matrix(cols, rows, label):
    """rows: (name, [O|C per column]). O = owner pays, C = charterer pays."""
    out = [txt(40, 40, 'Who pays', 't-muted', 13)]
    cw = 150
    for i, c in enumerate(cols):
        out.append(txt(290 + i * cw, 40, c, '', 14, 'middle', 600))
    for r, (name, cells) in enumerate(rows):
        y = 78 + r * 40
        out.append(f'<path d="M40 {y - 22}H680" class="s-line"/>')
        out.append(txt(40, y + 4, name, '', 14))
        for i, c in enumerate(cells):
            cls = 'f-done' if c == 'O' else 'f-accent'
            out.append(f'<rect x="{290 + i * cw - 46}" y="{y - 14}" width="92" height="26" rx="13" class="{cls}"/>')
            out.append(txt(290 + i * cw, y + 4, 'Owner' if c == 'O' else 'Charterer', 't-on', 12, 'middle', 600))
    return svg(78 + len(rows) * 40, ''.join(out), label)


def fig_chain(nodes, links, label):
    n, out = len(nodes), []
    bw = 150
    gap = (640 - n * bw) / (n - 1)
    for i, (a, b) in enumerate(nodes):
        x = 40 + i * (bw + gap)
        out.append(f'<rect x="{x:.0f}" y="60" width="{bw}" height="64" rx="8" class="f-surface s-line"/>')
        out.append(txt(x + bw / 2, 88, a, '', 14, 'middle', 600))
        out.append(txt(x + bw / 2, 108, b, 't-muted', 12, 'middle'))
        if i < n - 1:
            out.append(f'<path d="M{x + bw:.0f} 92H{x + bw + gap:.0f}" class="s-accent" stroke-width="2"/>')
            out.append(txt(x + bw + gap / 2, 150, links[i], 't-accent', 12, 'middle', 600))
    return svg(180, ''.join(out), label)


def fig_steps(steps, label):
    out, n = [], len(steps)
    gap = 640 / (n - 1)
    out.append('<path d="M40 60H680" class="s-line" stroke-width="2"/>')
    for i, s in enumerate(steps):
        x = 40 + i * gap
        out.append(f'<circle cx="{x:.0f}" cy="60" r="16" class="{"f-accent" if i in (3, 4) else "f-done"}"/>')
        out.append(txt(x, 65, str(i + 1), 't-on', 14, 'middle', 600))
        anchor = 'start' if i == 0 else 'end' if i == n - 1 else 'middle'
        tx = x - 16 if i == 0 else x + 16 if i == n - 1 else x
        for j, line in enumerate(s.split('|')):
            out.append(txt(tx, 104 + j * 17, line, '' if j == 0 else 't-muted', 12.5, anchor, 600 if j == 0 else 400))
    return svg(150, ''.join(out), label)


def fig_ladder(bands, hi, unit, label):
    """Horizontal size bars on a log scale; hi = index to highlight."""
    lo = math.log10(max(bands[0][1] / 3, 1))
    top = math.log10(bands[-1][0] * 1.35)
    sx = lambda v: 190 + (math.log10(max(v, 10 ** lo)) - lo) / (top - lo) * 490
    out = []
    for i, (a, b, name) in enumerate(bands):
        y = 24 + i * 30
        x1, x2 = sx(a if a else 10 ** lo), sx(min(b, bands[-1][0] * 1.35))
        cls = 'f-accent' if i == hi else 'f-done'
        out.append(txt(180, y + 14, name, '' if i == hi else 't-muted', 13, 'end', 600 if i == hi else 400))
        out.append(f'<rect x="{x1:.0f}" y="{y}" width="{max(x2 - x1, 6):.0f}" height="20" rx="3" class="{cls}"/>')
        rng = (f'under {b + 1:,}' if not a else f'{a:,}+' if b > 9e8 else f'{a:,} to {b:,}') + ' ' + unit
        if x2 + 8 + len(rng) * 6.4 < 716:
            out.append(txt(x2 + 8, y + 14, rng, 't-muted', 11.5))
        else:
            out.append(txt(x1 - 8 if x1 - 8 - len(rng) * 6.4 > 186 else x1 + 8, y + 14, rng, 't-muted' if x1 - 8 - len(rng) * 6.4 > 186 else 't-on', 11.5, 'end' if x1 - 8 - len(rng) * 6.4 > 186 else 'start'))
    return svg(34 + len(bands) * 30, ''.join(out), label)


def fig_laycan():
    out = [txt(40, 34, 'Laycan 10 to 15 December', '', 15, 'start', 600)]
    for i in range(14):
        d, x = 6 + i, 40 + i * 46
        inside = 10 <= d <= 15
        out.append(f'<rect x="{x}" y="56" width="42" height="46" rx="4" class="{"f-accent" if inside else "f-track"}"/>')
        out.append(txt(x + 21, 85, str(d), 't-on' if inside else 't-muted', 15, 'middle', 600))
    out.append(txt(40, 130, 'Arrives early: waits.', 't-muted', 13))
    out.append(txt(40, 148, 'Laytime starts on the 10th.', 't-muted', 13))
    out.append(txt(362, 130, 'Arrives ready in the window:', '', 13, 'middle', 600))
    out.append(txt(362, 148, 'charter proceeds.', '', 13, 'middle'))
    out.append(txt(680, 130, 'Arrives after the 15th:', 't-muted', 13, 'end'))
    out.append(txt(680, 148, 'charterer may cancel.', 't-muted', 13, 'end'))
    return svg(170, ''.join(out), 'Calendar strip showing a laycan window from 10 to 15 December')


def fig_stack():
    rows = [('Recap', 'Main terms as negotiated. Binding once subjects are lifted.', 'f-accent'),
            ('Standard form', 'GENCON, NYPE, ASBATANKVOY: the printed clauses deals start from.', 'f-done'),
            ('Rider clauses', 'Clauses the two sides add or amend. These override the form.', 'f-done')]
    out = []
    for i, (a, b, cls) in enumerate(rows):
        y = 20 + i * 62
        out.append(f'<rect x="40" y="{y}" width="170" height="50" rx="6" class="{cls}"/>')
        out.append(txt(125, y + 30, a, 't-on', 15, 'middle', 600))
        out.append(txt(228, y + 30, b, '', 13))
    return svg(210, ''.join(out), 'The three layers of a charter party: recap, standard form and rider clauses')


def fig_route(a, b, label):
    out = ['<path d="M70 150C220 30 500 30 650 150" class="s-accent" stroke-width="2.5" stroke-dasharray="2 9" stroke-linecap="round"/>']
    for x, name in ((70, a), (650, b)):
        out.append(f'<circle cx="{x}" cy="150" r="9" class="f-done"/>')
        out.append(txt(x, 184, name, '', 14, 'middle', 600))
    out.append('<path d="M330 58h60l-10 14h-40z" class="f-done"/><rect x="368" y="46" width="12" height="12" class="f-accent"/>')
    out.append(txt(360, 104, label, 't-muted', 13, 'middle'))
    return svg(200, ''.join(out), f'Route from {a} to {b}')


# ---------- Page shell ----------
def shell(slug, title, desc, body, kind='Article', extra_head='', scripts=''):
    cur = lambda s: ' aria-current="page"' if s == kind else ''
    ld = {'@context': 'https://schema.org', '@type': 'Article' if kind == 'guides' else 'WebPage', 'headline': title, 'description': desc,
          'datePublished': DATE, 'dateModified': DATE, 'author': {'@type': 'Organization', 'name': 'FindAVessel'},
          'publisher': {'@type': 'Organization', 'name': 'FindAVessel'}, 'mainEntityOfPage': f'{SITE}/{slug}'}
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} | FindAVessel</title>
<meta name="description" content="{e(desc)}">
<meta name="theme-color" content="#0A1C2E">
<link rel="canonical" href="{SITE}/{slug}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{SITE}/{slug}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='6' fill='%230A1C2E'/%3E%3Ccircle cx='20' cy='20' r='10' fill='none' stroke='%23fff' stroke-width='3'/%3E%3Cpath d='M5 20h30' stroke='%23fff' stroke-width='3'/%3E%3C/svg%3E">
<script src="theme.js"></script>
<link rel="stylesheet" href="styles.css">
<script type="application/ld+json">{json.dumps(ld)}</script>{extra_head}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="index.html">{LOGO}<span>FindAVessel</span></a>
  <nav class="nav" aria-label="Main"><a href="index.html#/cargoes">Cargoes</a><a href="index.html#/vessels">Vessels</a><a href="index.html#/deals">Deals</a><a href="index.html#/passport">Passport</a><a href="guides.html"{cur('guides')}>Guides</a><a href="tools.html"{cur('tools')}>Tools</a></nav>
  <div class="top-right">{THEME_BTN}<a class="btn btn-primary" href="index.html#/join">Create an account</a></div>
</header>
<main id="main">{body}</main>
<footer class="foot">
  <div><strong>FindAVessel</strong><p>Whole-ship charters for owners, cargo interests and brokers who are new to each other.</p></div>
  <div><strong>Platform</strong><a href="index.html#/cargoes">Cargoes</a><a href="index.html#/vessels">Vessels</a><a href="index.html#/guide/safeguards">Safeguards</a><a href="index.html#/join">Create an account</a></div>
  <div><strong>Learn</strong><a href="guides.html">Chartering guides</a><a href="ship-sizes.html">Ship sizes</a><a href="tools.html">Calculators</a></div>
  <div><p>Guides are general information, not legal advice. The wording of your charter party governs. FindAVessel is a prototype and offers no regulated service.</p></div>
</footer>
<nav class="tabbar" aria-label="Main, mobile"><a href="index.html#/cargoes">Cargoes</a><a href="index.html#/vessels">Vessels</a><a href="guides.html"{cur('guides')}>Guides</a><a href="tools.html"{cur('tools')}>Tools</a><a href="index.html#/join">Join</a></nav>
{scripts}
</body>
</html>
'''


PAGES = {}  # slug -> (title, blurb, figure) for index tiles and related links


def article(slug, title, desc, h1, standfirst, fig, caption, body, related, kind='guides', crumb='Guides', crumb_href='guides.html', scripts='', cta=True):
    rel = ''.join(f'<li><a href="{r}.html">{e(PAGES[r][0])}</a></li>' for r in related if r in PAGES)
    cta_html = '''<div class="article-cta"><h2>Put it into practice</h2><p>FindAVessel lets cargo owners post a full shipload and receive firm offers from verified vessel owners and brokers, with subjects, payment and the time log in one record.</p>
<div class="row"><a class="btn btn-primary" href="index.html#/join">Create an account</a><a class="btn" href="index.html">See the sample market</a></div></div>''' if cta else ''
    body_html = f'''<article class="article">
<p class="crumbs"><a href="{crumb_href}">{crumb}</a> / {e(h1)}</p>
<h1>{e(h1)}</h1>
<p class="standfirst">{standfirst}</p>
<figure>{fig}<figcaption>{caption}</figcaption></figure>
{body}
{cta_html}
<div class="related"><h2>Keep reading</h2><ul>{rel}</ul></div>
<p class="fine">Published {DATE[8:]} November {DATE[:4]}. General information for people new to chartering, not legal advice.</p>
</article>'''
    open(f'{slug}.html', 'w').write(shell(slug, title, desc, body_html, kind, scripts=scripts))


def table(head, rows, hl=None):
    return '<div class="tbl"><table><thead><tr>' + ''.join(f'<th>{e(h)}</th>' for h in head) + '</tr></thead><tbody>' + ''.join(
        f'<tr{" class=hl" if i == hl else ""}>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for i, r in enumerate(rows)) + '</tbody></table></div>'


# ---------- Size bands (kept in step with data.js) ----------
TANKER = [(0, 9999, 'Coastal tanker'), (10000, 34999, 'Handysize'), (35000, 44999, 'MR1'), (45000, 54999, 'MR2'), (55000, 84999, 'Panamax / LR1'),
          (85000, 119999, 'Aframax / LR2'), (120000, 199999, 'Suezmax'), (200000, 319999, 'VLCC'), (320000, 10 ** 9, 'ULCC')]
BULK = [(0, 9999, 'Mini bulker'), (10000, 39999, 'Handysize'), (40000, 49999, 'Handymax'), (50000, 59999, 'Supramax'), (60000, 66999, 'Ultramax'),
        (67000, 79999, 'Panamax'), (80000, 86999, 'Kamsarmax'), (87000, 119999, 'Post-Panamax'), (120000, 199999, 'Capesize'), (200000, 219999, 'Newcastlemax'), (220000, 10 ** 9, 'Very large ore carrier')]
CONTAINER = [(0, 999, 'Small feeder'), (1000, 2999, 'Feeder'), (3000, 5199, 'Panamax'), (5200, 9999, 'Post-Panamax'), (10000, 14499, 'Neopanamax'), (14500, 17999, 'Very large container ship'), (18000, 10 ** 9, 'Ultra large container ship')]
LPG = [(0, 4999, 'Small gas carrier (pressurised)'), (5000, 14999, 'Small gas carrier'), (15000, 24999, 'Handysize gas carrier'), (25000, 39999, 'Medium gas carrier'), (40000, 59999, 'Large gas carrier'), (60000, 10 ** 9, 'Very large gas carrier')]
LNG = [(0, 35999, 'Small-scale LNG'), (36000, 89999, 'Med Max'), (90000, 144999, 'Lower conventional'), (145000, 208999, 'Upper conventional'), (209000, 219999, 'Q-Flex'), (220000, 10 ** 9, 'Q-Max')]

CLASSES = {
    'vlcc': dict(name='VLCC', full='Very large crude carrier', bands=TANKER, i=7, kw='VLCC',
        stand='A VLCC, or very large crude carrier, is an oil tanker of roughly 200,000 to 320,000 deadweight tonnes. One cargo is about two million barrels of crude oil.',
        facts=[('Deadweight', '200,000 to 320,000 tonnes'), ('Typical cargo', 'About 2 million barrels of crude oil'), ('Typical length and beam', 'About 330 m by 60 m'), ('Laden draught', 'About 20 to 22 m'), ('Next size down', 'Suezmax'), ('Next size up', 'ULCC, above 320,000 tonnes')],
        body='''<h2>Where VLCCs trade</h2><p>VLCCs carry crude on the long hauls where scale pays: the Arabian Gulf to China, Japan, Korea and India, West Africa to Asia, and the US Gulf to Asia. The cost per barrel falls as the ship gets bigger, which is why the longest routes use the largest ships.</p>
<h2>What limits them</h2><p>Draught. A laden VLCC sits too deep for most ports, so cargo is loaded and discharged at offshore terminals and single-point moorings, or transferred to smaller tankers at sea. A fully laden VLCC is too deep for the Suez Canal and too wide for the Panama Canal, so routing is part of every freight calculation.</p>
<h2>How VLCCs are chartered</h2><p>Mostly on voyage charters with freight quoted in Worldscale points, on forms such as ASBATANKVOY or SHELLVOY. Charterers are oil majors, national oil companies and large traders, and every ship is vetted before it is accepted. This is the hardest corner of the tanker market for a newcomer to enter.</p>'''),
    'suezmax': dict(name='Suezmax', full='Suezmax tanker', bands=TANKER, i=6, kw='Suezmax',
        stand='A Suezmax is the largest tanker that can pass through the Suez Canal fully laden: roughly 120,000 to 200,000 deadweight tonnes, carrying about one million barrels.',
        facts=[('Deadweight', '120,000 to 200,000 tonnes'), ('Typical cargo', 'About 1 million barrels of crude oil'), ('Typical length and beam', 'About 275 m by 48 m'), ('What sets the limit', 'Suez Canal draught, about 20.1 m'), ('Next size down', 'Aframax'), ('Next size up', 'VLCC')],
        body='''<h2>Why the canal defines the class</h2><p>The Suez Canal Authority limits how deep a ship may sit, and the allowed beam narrows as draught increases. A Suezmax is designed to the largest hull that passes with a full cargo. The limits have been raised as the canal has been deepened, so the class has grown over time.</p>
<h2>Where Suezmaxes trade</h2><p>West Africa to Europe and the Americas, the Black Sea and Mediterranean, and the Middle East to Europe through the canal. A million-barrel parcel is a common size for crude sales, which keeps the class busy.</p>
<h2>How they are chartered</h2><p>Voyage charters priced in Worldscale are the norm, with time charters to oil companies and traders for longer cover. Vetting requirements are close to those for VLCCs.</p>'''),
    'aframax': dict(name='Aframax', full='Aframax tanker', bands=TANKER, i=5, kw='Aframax',
        stand='An Aframax is a mid-sized oil tanker of roughly 80,000 to 120,000 deadweight tonnes, carrying 600,000 to 750,000 barrels. With coated tanks for refined products it is called an LR2.',
        facts=[('Deadweight', '80,000 to 120,000 tonnes'), ('Typical cargo', '600,000 to 750,000 barrels'), ('Typical length and beam', 'About 245 m by 44 m'), ('Clean-trading name', 'LR2 (Long Range 2)'), ('Next size down', 'Panamax or LR1'), ('Next size up', 'Suezmax')],
        body='''<h2>Where the name comes from</h2><p>AFRA stands for Average Freight Rate Assessment, a scale Shell introduced in 1954 to standardise freight terms between tanker sizes. The top of one band of that scale gave the class its name. Unlike Panamax or Suezmax, it has nothing to do with a canal.</p>
<h2>Where Aframaxes trade</h2><p>Short and medium hauls where ports cannot take larger ships: the North Sea, the Mediterranean, the Caribbean and US Gulf, and South-east Asia. They also lighter cargo from VLCCs that cannot reach the berth.</p>
<h2>Aframax or LR2</h2><p>The hull is the same. A ship with uncoated tanks carries crude and fuel oil and is called an Aframax. One with coated tanks that carries naphtha, jet fuel or diesel is called an LR2. A listing should state the tank coating and the last three cargoes, because that decides what the ship can load next.</p>'''),
    'panamax': dict(name='Panamax', full='Panamax ship', bands=BULK, i=5, kw='Panamax',
        stand='A Panamax is a ship built to the largest dimensions that fit the original locks of the Panama Canal: 32.3 m beam, about 294 m long and 12 m draught. In dry bulk that means roughly 65,000 to 80,000 deadweight tonnes.',
        facts=[('Lock limits, original canal', '294.1 m long, 32.3 m beam, 12.04 m draught'), ('Bulk carrier', '65,000 to 80,000 DWT'), ('Tanker', '55,000 to 80,000 DWT, called LR1 when coated'), ('Container ship', '3,000 to 5,100 TEU'), ('Neopanamax locks, since 2016', '366 m long, 51.25 m beam, 15.2 m draught'), ('Close relative', 'Kamsarmax, about 82,000 DWT at 229 m long')],
        body='''<h2>One name, three ship types</h2><p>Panamax describes a set of dimensions, so it applies to bulk carriers, tankers and container ships alike. The 32.3 m beam is the giveaway: many ships were built exactly that wide for decades.</p>
<h2>Panamax bulk carriers</h2><p>Usually seven holds and no cranes. They carry coal and grain on long hauls, for example grain from the US Gulf or East coast South America to Asia, and coal from Indonesia and Australia. Because they are gearless they need ports with shore equipment.</p>
<h2>What the new locks changed</h2><p>The wider locks opened in 2016 created the Neopanamax class and made the old limit matter less. Bulk carriers have since grown into the Kamsarmax and Post-Panamax sizes. The name Panamax has stuck to the old dimensions.</p>'''),
    'capesize': dict(name='Capesize', full='Capesize bulk carrier', bands=BULK, i=8, kw='Capesize',
        stand='A Capesize is a large bulk carrier of roughly 120,000 to 200,000 deadweight tonnes, most often around 180,000. It carries iron ore and coal and is too big for the original Panama Canal locks.',
        facts=[('Deadweight', '120,000 to 200,000 tonnes, typically about 180,000'), ('Cargoes', 'Iron ore and coal'), ('Holds and gear', 'Nine holds, gearless'), ('Typical length and beam', 'About 290 m by 45 m'), ('Next size down', 'Post-Panamax'), ('Next sizes up', 'Newcastlemax, then very large ore carriers of up to 400,000 tonnes')],
        body='''<h2>Why "Cape"</h2><p>Ships this size could not use the Panama Canal and, in earlier decades, could not pass Suez laden. They had to sail round the Cape of Good Hope or Cape Horn. The name stayed after the canals were enlarged.</p>
<h2>Where Capesizes trade</h2><p>Two flows dominate: iron ore from Brazil and Western Australia to China, and coal from Australia, South Africa and Colombia. Few ports are deep enough, so the same terminals appear in fixture after fixture.</p>
<h2>How they are chartered</h2><p>Voyage charters in dollars per tonne and time charters at a daily rate, usually on GENCON or NYPE forms. Charterers are miners, steel mills, utilities and large operators. Capesize rates swing harder than any other dry bulk class because the cargo base is so narrow.</p>'''),
    'supramax': dict(name='Supramax', full='Supramax bulk carrier', bands=BULK, i=3, kw='Supramax',
        stand='A Supramax is a geared bulk carrier of roughly 50,000 to 60,000 deadweight tonnes, with five holds and four cranes. It can load and discharge almost anywhere without shore equipment.',
        facts=[('Deadweight', '50,000 to 60,000 tonnes'), ('Holds and gear', 'Five holds, four cranes of about 30 tonnes, usually with grabs'), ('Typical length and beam', 'About 190 to 200 m by 32 m'), ('Larger sister', 'Ultramax, 60,000 to 66,000 tonnes'), ('Next size down', 'Handymax'), ('Next size up', 'Panamax')],
        body='''<h2>Why cranes matter</h2><p>Many ports that handle fertiliser, cement, steel or bagged cargo have no shore cranes. A geared ship brings its own. That opens hundreds of smaller ports and makes the Supramax one of the most flexible ships to trade.</p>
<h2>What Supramaxes carry</h2><p>Grain, coal, fertiliser, cement and clinker, bauxite, steel products and other minor bulks. A typical year mixes several of these, so the last three cargoes and hold cleanliness matter on every fixture.</p>
<h2>A good class for newcomers to understand</h2><p>Cargo sizes of 45,000 to 55,000 tonnes are common among mid-sized traders, and the charterers are far more varied than in the Capesize or VLCC markets. Deals are done on GENCON for voyages and NYPE for time charters.</p>'''),
    'handysize': dict(name='Handysize', full='Handysize bulk carrier', bands=BULK, i=1, kw='Handysize',
        stand='A Handysize is a small geared bulk carrier of roughly 10,000 to 40,000 deadweight tonnes. It reaches ports and berths that larger ships cannot.',
        facts=[('Deadweight', '10,000 to 40,000 tonnes'), ('Holds and gear', 'Four or five holds, cranes of 25 to 35 tonnes'), ('Typical length and beam', 'About 150 to 180 m by 24 to 30 m'), ('Tanker equivalent', 'Handysize tankers, 10,000 to 35,000 tonnes'), ('Next size up', 'Handymax')],
        body='''<h2>What Handysizes carry</h2><p>Minor bulks and parcels that do not fill a larger ship: steel, logs and timber, fertiliser, grain, cement, sugar, scrap and bagged goods. Many have box-shaped holds or log fittings for specific trades.</p>
<h2>Where they trade</h2><p>Everywhere, and especially on regional routes: within the Mediterranean and Black Sea, around South-east Asia, across the Caribbean and along the coasts of Africa and South America. Shallow draught and their own cranes let them use small ports.</p>
<h2>Why the class suits first-time owners and charterers</h2><p>Ships cost less, cargoes are smaller and counterparties are often small and mid-sized companies. That also means more unknown names on both sides, which is where checking the counterparty and securing freight matter most.</p>'''),
}

GUIDES = [
    dict(slug='what-is-demurrage', title='What is demurrage? Meaning, calculation and who pays', h1='What is demurrage?',
        desc='Demurrage is the daily sum a charterer pays a shipowner when loading or discharging takes longer than the laytime agreed. How it is calculated, with an example.',
        stand='Demurrage is money the charterer pays the shipowner when loading or discharging takes longer than the time the contract allows. It compensates the owner for a ship held up in port.',
        fig=fig_timeline([('Laytime allowed: 7 days', .58, 'f-done'), ('Demurrage: 5 days', .42, 'f-accent')], [(0, 'Laytime starts'), (.58, 'Laytime expires'), (1, 'Cargo operations end')], 'Timeline of 12 days in port: 7 days of laytime followed by 5 days on demurrage', 'At USD 12,000 a day, five days over costs the charterer USD 60,000.'),
        cap='Twelve days in port against seven allowed. The five days over are paid for at the demurrage rate.',
        body='''<div class="keyfact"><p><strong>In one line:</strong> time used minus time allowed, multiplied by the daily demurrage rate.</p></div>
<h2>How demurrage works in a ship charter</h2><p>A voyage charter gives the charterer a fixed amount of time to load and discharge, called <a href="laytime.html">laytime</a>. The owner has priced the freight on that basis. If the ship is kept longer, the owner loses days it could have spent earning on the next voyage, so the charter party sets a daily rate for the overrun. That rate is demurrage.</p>
<p>The rate is agreed in the negotiation, alongside freight. It usually sits near what the ship could earn per day on the open market.</p>
<h2>How to calculate demurrage</h2><ol><li>Work out the laytime allowed. Either a fixed period, or the cargo quantity divided by the agreed daily rates.</li><li>Establish when laytime started, from the notice of readiness and the charter party terms.</li><li>Count the time used, leaving out any periods the charter party excludes, such as bad weather or holidays.</li><li>Subtract the time allowed from the time used. Multiply any excess by the demurrage rate, pro rata for part days.</li></ol>
<p><strong>Example.</strong> 28,000 tonnes loading at 4,000 tonnes a day gives 7 days of laytime. Loading takes 12 days with no excluded time. The ship is on demurrage for 5 days. At USD 12,000 a day the charterer owes USD 60,000. You can run your own figures in the <a href="laytime-demurrage-calculator.html">laytime and demurrage calculator</a>.</p>
<h2>"Once on demurrage, always on demurrage"</h2><p>Under most charter parties the exceptions that pause laytime stop applying once laytime has expired. Rain that would not have counted during laytime does count once the ship is on demurrage, unless the contract says otherwise.</p>
<h2>Despatch: the reverse case</h2><p>If the charterer finishes early, many dry cargo charters pay them despatch for the time saved, usually at half the demurrage rate. Tanker charters normally do not.</p>
<h2>Charter demurrage and container demurrage are different things</h2>''' + table(['', 'Ship charter', 'Container shipping'], [
            ['<strong>Who pays whom</strong>', 'Charterer pays the shipowner', 'Importer or exporter pays the shipping line or terminal'],
            ['<strong>What triggers it</strong>', 'Laytime runs out before cargo work finishes', 'A container stays in the terminal past its free days'],
            ['<strong>Typical amount</strong>', 'Thousands to tens of thousands of dollars a day', 'Tens to hundreds of dollars per container per day'],
            ['<strong>Related charge</strong>', 'Detention, if the ship is held for other reasons', 'Detention, for keeping the box outside the terminal']]) + '''
<h2>How to avoid disputes</h2><ul><li>Agree the laytime terms precisely: the rates, what counts and what does not.</li><li>Record events as they happen in a statement of facts both sides sign.</li><li>Present the claim with supporting documents inside the time bar in the charter party, often 90 days or less.</li></ul>''',
        rel=['laytime', 'laycan', 'laytime-demurrage-calculator', 'charter-party']),
    dict(slug='laytime', title='Laytime explained: how it starts, counts and ends', h1='Laytime explained',
        desc='Laytime is the time a charterer is allowed for loading and discharging under a voyage charter. When it starts, what interrupts it and the terms you will meet.',
        stand='Laytime is the time a voyage charter allows the charterer to load and discharge the cargo without paying extra. When it runs out, demurrage begins.',
        fig=fig_timeline([('Waiting', .14, 'f-track'), ('Turn time', .12, 'f-track'), ('Laytime counting', .5, 'f-done'), ('Demurrage', .24, 'f-accent')], [(0, 'Ship arrives'), (.14, 'Notice of readiness'), (.26, 'Laytime starts'), (.76, 'Laytime expires'), (1, 'Loading ends')], 'Timeline from arrival through notice of readiness, laytime and demurrage'),
        cap='Laytime does not start on arrival. It starts after a valid notice of readiness and any turn time the contract gives.',
        body='''<h2>When laytime starts</h2><p>Three things normally have to happen. The ship must reach the place named in the charter party, which may be a berth or the port. It must be ready in every respect to load or discharge. And the master must give <strong>notice of readiness</strong> to the charterer or its agent. Most contracts then add a short turn time, for example six hours, before the clock starts.</p>
<p>A notice given before the ship is truly ready is invalid, and a great many laytime disputes begin there.</p>
<h2>How much time is allowed</h2><p>Either a fixed period, such as 72 running hours, or a rate: for example 8,000 tonnes per day loading and 4,000 discharging. With rates, laytime is the cargo quantity divided by the rate. Time at the two ports is either counted separately or pooled, depending on whether the charter says "reversible".</p>
<h2>What counts and what does not</h2>''' + table(['Term', 'Meaning'], [
            ['<strong>SHINC</strong>', 'Sundays and holidays included. Every day counts.'], ['<strong>SHEX</strong>', 'Sundays and holidays excepted. Those days do not count.'],
            ['<strong>Weather working day</strong>', 'A working day on which weather does not stop cargo work. Time lost to weather is not counted.'],
            ['<strong>Running hours</strong>', 'Consecutive hours with no exceptions, common in tanker charters.'],
            ['<strong>WIBON</strong>', 'Whether in berth or not. Notice may be given while waiting for a berth.'],
            ['<strong>Reversible</strong>', 'Loading and discharging time are added together and used as one allowance.']]) + '''
<h2>When laytime ends</h2><p>When cargo work is complete, or when the allowed time is used up, whichever comes first. If time runs out first the ship goes on <a href="what-is-demurrage.html">demurrage</a>. If work finishes first, a dry cargo charterer may earn despatch.</p>
<h2>The statement of facts</h2><p>The port agent records each event with its time: arrival, notice, berthing, start and stop of cargo work, weather stoppages, completion. Both sides rely on this record for the laytime calculation, so read it before signing. On FindAVessel the same events go into a shared time log that both parties confirm as they happen.</p>''',
        rel=['what-is-demurrage', 'laycan', 'laytime-demurrage-calculator', 'voyage-charter-vs-time-charter']),
    dict(slug='laycan', title='Laycan meaning: laydays and cancelling date explained', h1='Laycan: laydays and cancelling',
        desc='Laycan is the window of dates in which a chartered ship must arrive ready to load. What happens if it is early or late, and how to set the window.',
        stand='Laycan is short for laydays and cancelling. It is the window of dates in which the ship must arrive at the load port, ready to load. Arrive after it and the charterer may cancel.',
        fig=fig_laycan(), cap='The first date is the earliest laytime can start. The second is the cancelling date.',
        body='''<h2>The two dates</h2><p><strong>The first layday</strong> is the earliest date the charterer has to accept the ship. If she arrives sooner she waits, and laytime does not start until that date unless the charterer agrees.</p>
<p><strong>The cancelling date</strong> is the latest. If the ship has not arrived and given a valid notice of readiness by then, the charterer has the option to cancel the charter. It is an option, not an automatic end: the charterer can also keep the ship, often after renegotiating.</p>
<h2>Why the window matters to each side</h2><ul><li><strong>The charterer</strong> has a cargo that is ready on certain dates, storage that costs money and a sale contract with a shipment period. A late ship can put them in breach with their buyer.</li><li><strong>The owner</strong> has a ship finishing a previous voyage somewhere else. The window has to be reachable allowing for weather, port delays and bunkering.</li></ul>
<h2>How wide should a laycan be?</h2><p>Five to ten days is common for dry bulk, narrower for tankers. A tight window gives the charterer certainty and costs the owner flexibility, which shows up in the freight rate. A cargo posted with a realistic window attracts more offers.</p>
<h2>If the ship is going to be late</h2><p>Many charter parties have an interpellation clause. The owner tells the charterer the new expected date and the charterer must say, within a set time, whether they will cancel. This stops the ship steaming for days towards a cargo that has already gone elsewhere.</p>
<h2>Laycan in an offer</h2><p>An owner can offer a narrower window inside the one the charterer posted, for example 12 to 14 December against 10 to 15. Check that the offered dates still fit your cargo before accepting.</p>''',
        rel=['laytime', 'what-is-demurrage', 'how-to-charter-a-ship', 'charter-party']),
    dict(slug='voyage-charter-vs-time-charter', title='Voyage charter vs time charter vs bareboat charter', h1='Voyage, time and bareboat charters',
        desc='The three ways to charter a whole ship, compared: who pays for fuel, ports and crew, how each is priced, and when to use which.',
        stand='There are three ways to charter a whole ship. They differ in who runs the ship and who pays for what. Most first deals are voyage charters.',
        fig=fig_matrix(['Voyage', 'Time', 'Bareboat'], [('Crew, maintenance, insurance', 'OOC'), ('Fuel', 'OCC'), ('Port and canal costs', 'OCC'), ('Delay in port', 'CCC'), ('Delay at sea', 'OCC')], 'Matrix showing whether owner or charterer pays each cost under voyage, time and bareboat charters'),
        cap='Risk moves from owner to charterer as you go from voyage to time to bareboat. Under a voyage charter the charterer pays for port delay through demurrage.',
        body='''<h2>Voyage charter</h2><p>The charterer pays freight to move a cargo from A to B, quoted per tonne or as a lump sum. The owner pays for fuel, ports and crew and carries the risk of the voyage taking longer at sea. The charterer's main exposure is time in port: exceed the <a href="laytime.html">laytime</a> and <a href="what-is-demurrage.html">demurrage</a> is due.</p><p>Use it when you have a specific cargo and want a known cost per tonne.</p>
<h2>Time charter</h2><p>The charterer hires the ship by the day for a period, from one trip to several years, and directs where it goes. The owner still supplies crew and maintains the ship. The charterer pays hire plus fuel, port costs and canal tolls. If the ship breaks down it goes "off-hire" and the charterer stops paying.</p><p>Use it when you have a programme of cargoes, or want control over the ship's schedule.</p>
<h2>Bareboat charter</h2><p>Also called a demise charter. The charterer takes the ship without crew and operates it as if they owned it, usually for years. It is closer to a lease than a transport contract, and is often used to finance ships. Most web searches for "bareboat charter" are about yachts, where the word simply means hiring a boat without a skipper.</p>
<h2>The people involved</h2>''' + table(['Term', 'Meaning'], [
            ['<strong>Charterer</strong>', 'The party hiring the ship: a cargo owner, a trader or an operator.'],
            ['<strong>Shipowner</strong>', 'The registered owner of the vessel.'],
            ['<strong>Disponent owner</strong>', 'A company that controls the ship under a time or bareboat charter and charters it out again. To the next charterer they stand in the owner’s place.'],
            ['<strong>Operator</strong>', 'A company that takes ships on time charter and carries other people’s cargoes on voyage terms.']]) + '''
<h2>Comparing a voyage with a time charter</h2><p>Owners compare the two by converting a voyage into a <strong>time charter equivalent</strong>: voyage revenue minus fuel, port costs and commissions, divided by the days the voyage takes. The <a href="voyage-estimator.html">voyage estimator</a> does this sum.</p>''',
        rel=['charter-party', 'voyage-estimator', 'how-to-charter-a-ship', 'laytime']),
    dict(slug='charter-party', title='Charter party explained: GENCON, NYPE, ASBATANKVOY', h1='What is a charter party?',
        desc='A charter party is the contract between a shipowner and a charterer. The standard forms, what the main clauses cover and how the recap fits in.',
        stand='A charter party is the contract between a shipowner and a charterer for the use of a ship. Nearly all are built on a standard printed form with agreed changes.',
        fig=fig_stack(), cap='Three layers. Where they conflict, the recap and the rider clauses normally override the printed form.',
        body='''<h2>The standard forms</h2>''' + table(['Form', 'Used for', 'Notes'], [
            ['<strong>GENCON</strong>', 'Dry cargo voyage charters', 'Published by BIMCO. The 1994 and 2022 editions are both in use.'],
            ['<strong>NYPE</strong>', 'Dry cargo time charters', 'New York Produce Exchange form. The 1946, 1993 and 2015 editions all appear.'],
            ['<strong>ASBATANKVOY</strong>', 'Tanker voyage charters', 'The most widely used tanker voyage form.'],
            ['<strong>SHELLVOY, BPVOY</strong>', 'Tanker voyage charters', 'Oil company forms, used when that company charters.'],
            ['<strong>SHELLTIME</strong>', 'Tanker and gas time charters', 'Sets detailed speed and consumption warranties.'],
            ['<strong>NORGRAIN, SYNACOMEX</strong>', 'Grain voyage charters', 'Trade-specific forms.']]) + '''
<h2>Recap first, charter party after</h2><p>Deals are agreed in a negotiation, not by signing a document. When the last term is agreed and the subjects are lifted, the broker issues a <strong>recap</strong>: a message setting out every agreed term. The contract exists from that moment. The full charter party is drawn up afterwards and sometimes never signed at all, which is why an accurate recap matters so much.</p>
<h2>What the main clauses cover</h2><ul><li><strong>The ship:</strong> name, size, flag, class, and for time charters its speed and fuel consumption.</li><li><strong>The cargo and ports:</strong> what, how much, where, and that berths must be safe.</li><li><strong>Laycan:</strong> the arrival window and the right to cancel.</li><li><strong>Freight or hire:</strong> the rate, when it is earned and when it is paid.</li><li><strong>Laytime and demurrage:</strong> voyage charters only.</li><li><strong>Commission:</strong> who is paid what, and by whom.</li><li><strong>Law and arbitration:</strong> most often English law with arbitration in London, or US law in New York.</li><li><strong>Sanctions, war risks and piracy:</strong> who bears those risks.</li></ul>
<h2>"Subject details"</h2><p>Main terms are often agreed "subject to details", meaning the remaining charter party wording still has to be settled. Under English law there is usually no binding contract until that subject is lifted. US practice can treat main terms as binding earlier. Know which law your charter is under.</p>''',
        rel=['voyage-charter-vs-time-charter', 'what-does-a-shipbroker-do', 'laycan', 'how-to-charter-a-ship']),
    dict(slug='what-does-a-shipbroker-do', title='What does a shipbroker do? Role, commission and how to use one', h1='What does a shipbroker do?',
        desc='A shipbroker is the intermediary who matches ships with cargoes and negotiates the charter. What they do, how commission works and what to ask before you appoint one.',
        stand='A shipbroker is an intermediary who finds a ship for a cargo, or a cargo for a ship, negotiates the terms between the two sides and follows the deal through. They are paid commission on the freight.',
        fig=fig_chain([('Cargo owner', 'Charterer'), ('Charterer’s broker', 'Finds ships'), ('Owner’s broker', 'Finds cargoes'), ('Shipowner', 'Supplies the ship')], ['instructs', '1.25% each', 'instructs'], 'Chain from cargo owner through two brokers to the shipowner'),
        cap='A typical chain. Each broker normally earns 1.25% of the freight, paid by the owner out of what the charterer pays.',
        body='''<h2>What a broker actually does</h2><ul><li><strong>Knows the market.</strong> Which ships are open where, which cargoes are quoting, and what rates were done yesterday.</li><li><strong>Circulates the enquiry</strong> to owners or charterers who might fit, without exposing more than the principal wants.</li><li><strong>Negotiates</strong> offers and counter-offers, and advises on what is reasonable.</li><li><strong>Draws up the recap and charter party.</strong></li><li><strong>Follows the voyage:</strong> passes on notices, chases freight, handles the laytime calculation and helps settle disagreements.</li></ul>
<h2>How commission works</h2><p>The usual brokerage is 1.25% of gross freight or hire for each broker in the chain. The owner pays it, deducted from freight. Some charterers also take an <strong>address commission</strong> for themselves, often 1.25% to 3.75%. Total commissions of 2.5% to 5% are common, and the owner prices them into the freight rate.</p>
<h2>Types of shipbroker</h2><p>Chartering brokers arrange charters and usually specialise by ship type: dry cargo, tanker or gas. Sale and purchase brokers handle buying and selling ships. A competitive broker works one deal for both sides; exclusive brokers act for one principal only.</p>
<h2>The problem newcomers run into</h2><p>Brokers are paid on completed deals, so they give their time to enquiries likely to fix. An unknown name with a first cargo often gets no reply. The fix is to remove the doubt: show who you are, that the cargo or ship is real and that you can pay or perform. That is what a FindAVessel passport is for.</p>
<h2>What to ask a broker before you instruct them</h2><ul><li>Who do you act for in this deal: me, the other side, or both?</li><li>How many intermediaries are between you and the principal?</li><li>What is the total commission, and who receives each part?</li><li>Do you carry professional indemnity insurance?</li></ul>
<p>Long chains of brokers who have never spoken to the principal are the most common complaint in this market. On FindAVessel every brokered offer has to state the mandate and the commission.</p>''',
        rel=['how-to-charter-a-ship', 'charter-party', 'voyage-charter-vs-time-charter', 'what-is-demurrage']),
    dict(slug='how-to-charter-a-ship', title='How to charter a cargo ship: a step-by-step guide', h1='How to charter a ship',
        desc='How vessel chartering works from first enquiry to final payment, in seven steps, with what the cargo owner and shipowner each need to have ready.',
        stand='Chartering a ship means hiring the whole vessel, for one voyage or for a period. The process is the same whether the cargo is 5,000 tonnes of steel or two million barrels of crude.',
        fig=fig_steps(['Enquiry|Define the cargo', 'Market|Circulate it', 'Offers|Firm, time-limited', 'Subjects|Conditional deal', 'Fixture|Subjects lifted', 'Voyage|Load and carry', 'Settle|Freight, demurrage'], 'Seven steps from enquiry to settlement'),
        cap='Steps four and five are where a deal becomes binding. Before the subjects are lifted, either side can still walk away.',
        body='''<h2>1. Define the enquiry</h2><p>An owner can only price what is described. A complete cargo order states the cargo and grade, quantity with tolerance, load and discharge ports, the <a href="laycan.html">laycan</a>, loading and discharging rates, any limits on the ship such as age or gear, and the <a href="charter-party.html">charter party</a> form.</p>
<h2>2. Put it to the market</h2><p>Traditionally the enquiry goes to one or more <a href="what-does-a-shipbroker-do.html">shipbrokers</a>, who pass it to owners. On a platform you post it and choose who may see it. Advertising a cargo widely can push rates up, so sensitive cargoes go to a shortlist.</p>
<h2>3. Receive firm offers</h2><p>An owner's firm offer names the ship, the freight rate, demurrage, laycan and other terms, and is valid for a set time, often a few hours. You accept, decline or counter. Each counter is a new firm offer that replaces the last.</p>
<h2>4. Agree main terms "on subjects"</h2><p>Once the terms match, the deal is agreed subject to listed conditions: management approval, confirmation that the cargo is available (the stem), the shippers' and receivers' approval of the ship, and details of the charter party. Each subject has a deadline.</p>
<h2>5. Lift subjects: the ship is fixed</h2><p>When every subject is lifted the deal is "clean" and binding. The broker issues the recap. From here, walking away is a breach of contract.</p>
<h2>6. Perform the voyage</h2><p>The ship arrives within the laycan and gives notice of readiness. <a href="laytime.html">Laytime</a> starts. Cargo is loaded, bills of lading are issued, the ship sails, and the process repeats at the discharge port.</p>
<h2>7. Settle</h2><p>Freight is usually paid within a few banking days of loading, often 95% first with the balance after discharge. <a href="what-is-demurrage.html">Demurrage</a> or despatch is calculated from the statement of facts and settled last.</p>
<h2>What each side should have ready</h2>''' + table(['Cargo owner', 'Shipowner'], [
            ['Company documents and proof of who owns the business', 'Proof of ownership or authority to charter the ship out'],
            ['Evidence the cargo exists: sales contract or supplier confirmation', 'Class certificate and P&amp;I insurance certificate'],
            ['Evidence that freight can be paid', 'Ship particulars, last cargoes and inspection history'],
            ['Trade references', 'Trade references']]) + '''
<p>Unknown counterparties get checked on reputation, finances, sanctions exposure and insurance before a deal becomes binding. Having this ready is the difference between getting an answer and being ignored.</p>
<h2>What does it cost?</h2><p>There is no price list. Freight is set by supply and demand for that size of ship in that region that week. The owner works back from fuel, port costs and what the ship could earn elsewhere. The <a href="voyage-estimator.html">voyage estimator</a> shows how the sum is built.</p>''',
        rel=['what-does-a-shipbroker-do', 'voyage-charter-vs-time-charter', 'laycan', 'ship-sizes']),
]

# Register titles first so pages can cross-link
for g in GUIDES:
    PAGES[g['slug']] = (g['h1'], g['stand'].split('. ')[0] + '.', g['fig'])
for k, c in CLASSES.items():
    PAGES[k] = (c['name'], c['stand'].split('. ')[0] + '.', fig_ladder(c['bands'], c['i'], 'DWT', f'{c["name"]} size compared with other classes'))
PAGES['ship-sizes'] = ('Ship sizes and classes', 'Every size class of tanker, bulk carrier, gas carrier and container ship.', fig_ladder(BULK, -1, 'DWT', 'Bulk carrier size classes'))
PAGES['laytime-demurrage-calculator'] = ('Laytime and demurrage calculator', 'Work out time allowed, time used and what is owed.', fig_timeline([('Allowed', .6, 'f-done'), ('Over', .4, 'f-accent')], [(0, 'Start'), (.6, 'Expires'), (1, 'End')], 'Laytime bar'))
PAGES['voyage-estimator'] = ('Voyage estimator', 'Turn a freight rate into a daily time charter equivalent.', fig_route('Load port', 'Discharge port', 'Days, fuel and port costs'))

for g in GUIDES:
    article(g['slug'], g['title'], g['desc'], g['h1'], g['stand'], g['fig'], g['cap'], g['body'], g['rel'])

for k, c in CLASSES.items():
    unit = 'DWT'
    body = '<h2>Key facts</h2>' + table(['', c['name']], [[f'<strong>{e(a)}</strong>', e(b)] for a, b in c['facts']]) + c['body'] + \
        f'<h2>{c["name"]} among the other classes</h2>' + table(['Class', 'Deadweight (tonnes)'], [[f'<strong>{e(n)}</strong>', (f'Under {b + 1:,}' if not a else f'{a:,} and above' if b > 9e8 else f'{a:,} to {b:,}')] for a, b, n in c['bands']], c['i']) + \
        '<p>Class names are market shorthand, not regulation, and sources differ at the edges. When you list or charter a ship, the measured deadweight is what counts. See <a href="ship-sizes.html">all ship sizes</a>.</p>'
    others = [x for x in CLASSES if x != k][:3]
    article(k, f'{c["kw"]}: size, capacity and trades of a {c["full"]}', c['stand'][:155], f'{c["name"]}: size, capacity and trades', c['stand'],
            PAGES[k][2], f'{c["name"]} against the other size classes of its type, on a logarithmic scale.', body, ['ship-sizes'] + others + ['how-to-charter-a-ship'], crumb='Ship sizes', crumb_href='ship-sizes.html')

# Ship sizes hub with class finder
BANDS_JSON = json.dumps({'Oil or chemical tanker': ['DWT', TANKER], 'Bulk carrier': ['DWT', BULK], 'Container ship': ['TEU', CONTAINER], 'LPG carrier': ['cubic metres', LPG], 'LNG carrier': ['cubic metres', LNG]})
finder = '''<div class="calc"><h3>Find the class</h3><div class="grid"><div class="field"><label for="cf-type">Ship type</label><select id="cf-type"></select></div><div class="field"><label for="cf-size">Size <small id="cf-unit"></small></label><input id="cf-size" type="number" min="1" placeholder="e.g. 58000"></div></div><div class="calc-out"><span class="big" id="cf-out">Enter a size</span><span class="sub" id="cf-range"></span></div></div>'''
finder_js = '<script>(function(){var B=' + BANDS_JSON + ''',t=document.getElementById('cf-type'),s=document.getElementById('cf-size'),o=document.getElementById('cf-out'),r=document.getElementById('cf-range'),u=document.getElementById('cf-unit');
Object.keys(B).forEach(function(k){var op=document.createElement('option');op.textContent=k;t.appendChild(op)});
function go(){var d=B[t.value],v=Number(s.value);u.textContent='in '+d[0];if(!v){o.textContent='Enter a size';r.textContent='';return}
var b=d[1].filter(function(x){return v>=x[0]&&v<=x[1]})[0];o.textContent=b?b[2]:'No class';r.textContent=b?(b[1]>9e8?b[0].toLocaleString()+' '+d[0]+' and above':(b[0]?b[0].toLocaleString():'0')+' to '+b[1].toLocaleString()+' '+d[0]):''}
t.onchange=go;s.oninput=go;go()})();</script>'''
rows = lambda bands, unit: [[(f'<a href="{n.split(" / ")[0].lower()}.html"><strong>{e(n)}</strong></a>' if n.split(' / ')[0].lower() in CLASSES else f'<strong>{e(n)}</strong>'), (f'Under {b + 1:,}' if not a else f'{a:,} and above' if b > 9e8 else f'{a:,} to {b:,}')] for a, b, n in bands]
sizes_body = '<h2>Class finder</h2><p>Pick a ship type and enter its size.</p>' + finder + \
    '<h2>What deadweight tonnage means</h2><p>Deadweight tonnage, or DWT, is the weight a ship can carry when loaded to its summer load line: cargo plus fuel, fresh water, stores and crew. It is not the weight of the ship itself. Tankers and bulk carriers are classed by DWT. Container ships are classed by TEU, the number of twenty-foot containers they hold, and gas carriers by tank volume in cubic metres.</p>' + \
    '<h2>Oil tankers</h2>' + table(['Class', 'Deadweight (tonnes)'], rows(TANKER, 'DWT')) + '<p>Panamax and Aframax tankers with coated tanks, carrying refined products, are called LR1 and LR2. MR stands for medium range.</p>' + \
    '<h2>Bulk carriers</h2>' + table(['Class', 'Deadweight (tonnes)'], rows(BULK, 'DWT')) + '<p>Ships up to Ultramax usually carry their own cranes. Panamax and larger are gearless and rely on shore equipment.</p>' + \
    '<h2>Container ships</h2>' + table(['Class', 'Capacity (TEU)'], rows(CONTAINER, 'TEU')) + \
    '<h2>LPG carriers</h2>' + table(['Class', 'Capacity (cubic metres)'], rows(LPG, 'm3')) + '<h2>LNG carriers</h2>' + table(['Class', 'Capacity (cubic metres)'], rows(LNG, 'm3')) + \
    '<h2>Why the bands are not exact</h2><p>These names grew out of trade practice. Some come from canals (Panamax, Suezmax), some from ports (Kamsarmax, Newcastlemax), one from a freight scale (Aframax). Brokers, exchanges and shipyards draw the lines in slightly different places. A contract should state the actual deadweight, not just the class name.</p>'
article('ship-sizes', 'Ship sizes and classes: Handysize to VLCC, with a class finder', 'Size classes for tankers, bulk carriers, container ships and gas carriers, with deadweight ranges and a tool that tells you the class from the size.',
        'Ship sizes and classes', 'Ships are grouped into named size classes: Handysize, Supramax, Panamax, Aframax, Suezmax, VLCC and more. Here is every band, and a finder that names the class from the size.',
        PAGES['ship-sizes'][2], 'Bulk carrier classes by deadweight, on a logarithmic scale.', sizes_body, list(CLASSES)[:6], crumb='Guides', scripts=finder_js)

# Tools
num = lambda i, label, val, hint='': f'<div class="field"><label for="{i}">{label}</label><input id="{i}" type="number" step="any" value="{val}">{f"<p class=hint>{hint}</p>" if hint else ""}</div>'
lay_calc = '<div class="calc"><div class="grid">' + num('q', 'Cargo quantity (tonnes)', 28000) + num('r', 'Rate (tonnes per day)', 4000, 'Laytime allowed is quantity divided by rate. Or enter days directly below.') + num('a', 'Or laytime allowed (days)', '', 'Leave empty to use quantity and rate.') + num('d', 'Demurrage rate (USD per day)', 12000) + \
    '<div class="field"><label for="s">Laytime started</label><input id="s" type="datetime-local" value="2026-12-01T08:00"></div><div class="field"><label for="f">Cargo work completed</label><input id="f" type="datetime-local" value="2026-12-13T08:00"></div>' + \
    num('x', 'Excluded time (hours)', 0, 'Weather, holidays or other periods your charter party does not count.') + '<div class="field"><label for="h">Despatch</label><select id="h"><option value="0.5">Half demurrage</option><option value="1">Same as demurrage</option><option value="0">None</option></select></div></div>' + \
    '<div class="calc-out"><span class="big" id="res"></span><span class="sub" id="det"></span></div></div>'
lay_js = '''<script>(function(){function g(i){return document.getElementById(i)}function n(i){return Number(g(i).value)||0}
function fmt(v){return 'USD '+Math.round(v).toLocaleString('en-GB')}
function go(){var allowed=n('a')||(n('r')?n('q')/n('r'):0),used=(new Date(g('s').value)-new Date(g('f').value))/-864e5-n('x')/24;
if(!allowed||!(used>0)){g('res').textContent='Enter the figures above';g('det').textContent='';return}
var diff=used-allowed;g('res').textContent=diff>0?'Demurrage due: '+fmt(diff*n('d')):diff<0&&Number(g('h').value)?'Despatch due: '+fmt(-diff*n('d')*Number(g('h').value)):'Nothing due';
g('det').textContent='Allowed '+allowed.toFixed(2)+' days. Used '+used.toFixed(2)+' days. '+(diff>0?diff.toFixed(2)+' days on demurrage.':(-diff).toFixed(2)+' days saved.')}
['q','r','a','d','s','f','x','h'].forEach(function(i){g(i).addEventListener('input',go)});go()})();</script>'''
article('laytime-demurrage-calculator', 'Laytime and demurrage calculator', 'Free laytime and demurrage calculator. Enter cargo quantity, loading rate, start and finish times and the demurrage rate to see what is owed.',
        'Laytime and demurrage calculator', 'Enter the cargo, the rate and the times. The calculator shows the laytime allowed, the time used and the demurrage or despatch that follows.',
        fig_timeline([('Laytime allowed', .58, 'f-done'), ('Demurrage', .42, 'f-accent')], [(0, 'Laytime starts'), (.58, 'Laytime expires'), (1, 'Cargo work ends')], 'Laytime bar followed by demurrage'), 'Time used beyond the allowance is charged at the demurrage rate.',
        lay_calc + '''<h2>How the sum is done</h2><ol><li>Laytime allowed is the quantity divided by the daily rate, unless a fixed number of days is agreed.</li><li>Time used runs from the start of laytime to completion of cargo work, less any excluded time.</li><li>If time used is greater, the difference multiplied by the demurrage rate is owed to the owner.</li><li>If it is less, despatch may be owed to the charterer, usually at half the demurrage rate.</li></ol>
<h2>What this calculator does not do</h2><p>It treats one port at a time and takes your word for the start time and the excluded hours. Real laytime statements turn on the charter party wording: when notice of readiness was valid, turn time, whether Sundays and holidays count, and whether time is reversible between ports. Read <a href="laytime.html">laytime explained</a> for those terms, and use the statement of facts as your source.</p>''',
        ['what-is-demurrage', 'laytime', 'laycan', 'voyage-estimator'], kind='tools', crumb='Tools', crumb_href='tools.html', scripts=lay_js)

voy_calc = '<div class="calc"><div class="grid">' + num('q', 'Cargo (tonnes)', 30000) + num('fr', 'Freight (USD per tonne)', 26) + num('c', 'Total commission (%)', 2.5) + num('bd', 'Ballast distance (nautical miles)', 400, 'From where the ship is open to the load port.') + num('ld', 'Laden distance (nautical miles)', 1020) + num('sp', 'Speed (knots)', 13) + \
    num('fs', 'Fuel at sea (tonnes per day)', 24) + num('pd', 'Days in port, both ends', 13) + num('fp', 'Fuel in port (tonnes per day)', 4) + num('bp', 'Fuel price (USD per tonne)', 600) + num('pc', 'Port costs, both ends (USD)', 90000) + num('oc', 'Other costs (USD)', 0, 'Canal tolls, extra insurance, hold cleaning.') + \
    '</div><div class="calc-out"><span class="big" id="res"></span><span class="sub" id="det"></span></div></div>'
voy_js = '''<script>(function(){function g(i){return document.getElementById(i)}function n(i){return Number(g(i).value)||0}
function fmt(v){return 'USD '+Math.round(v).toLocaleString('en-GB')}
function go(){var gross=n('q')*n('fr'),sea=n('sp')?(n('bd')+n('ld'))/(n('sp')*24):0,days=sea+n('pd'),fuel=(sea*n('fs')+n('pd')*n('fp'))*n('bp'),comm=gross*n('c')/100,net=gross-comm-fuel-n('pc')-n('oc');
if(!days){g('res').textContent='Enter the figures above';return}
g('res').textContent='Time charter equivalent: '+fmt(net/days)+' per day';
g('det').textContent='Voyage '+days.toFixed(1)+' days ('+sea.toFixed(1)+' at sea). Gross freight '+fmt(gross)+', commission '+fmt(comm)+', fuel '+fmt(fuel)+', net '+fmt(net)+'.'}
['q','fr','c','bd','ld','sp','fs','pd','fp','bp','pc','oc'].forEach(function(i){g(i).addEventListener('input',go)});go()})();</script>'''
article('voyage-estimator', 'Voyage estimator: time charter equivalent (TCE) calculator', 'Free voyage estimate calculator. Turn a freight rate into a daily time charter equivalent after fuel, port costs and commission.',
        'Voyage estimator', 'A voyage estimate tells an owner what a cargo is worth per day. Enter the freight, distances and costs to get the time charter equivalent.',
        PAGES['voyage-estimator'][2], 'Revenue less voyage costs, divided by the days the voyage takes.',
        voy_calc + '''<h2>What time charter equivalent means</h2><p>Time charter equivalent, or TCE, is the daily earning of a voyage after the costs the owner pays on a voyage charter: fuel, port charges, canal tolls and commissions. It lets an owner compare a voyage at USD 26 a tonne with a time charter at USD 14,000 a day, or one cargo with another.</p>
<div class="keyfact"><p><strong>TCE</strong> = (freight − commission − fuel − port and other voyage costs) ÷ voyage days</p></div>
<h2>Why charterers should care</h2><p>If you know roughly what an owner's sum looks like, you know whether your freight idea is realistic. A cargo that works out below the daily rate ships are earning elsewhere will not attract offers.</p>
<h2>Limits</h2><p>You need to supply the distances: this page does not hold a sea distance table. Use a routed distance, not a straight line, and allow for weather and waiting. Daily running costs such as crew and insurance are not deducted, because TCE is measured before them.</p>''',
        ['voyage-charter-vs-time-charter', 'laytime-demurrage-calculator', 'how-to-charter-a-ship', 'ship-sizes'], kind='tools', crumb='Tools', crumb_href='tools.html', scripts=voy_js)


# Index pages
def tile(slug, href=None):
    t = PAGES[slug]
    return f'<a class="tile" href="{href or slug + ".html"}">{t[2]}<div><h3>{e(t[0])}</h3><p>{e(t[1])}</p></div></a>'


def index(slug, title, desc, h1, lede, sections, kind):
    body = f'<section class="page"><div class="page-head"><div><h1>{e(h1)}</h1><p>{lede}</p></div></div>' + ''.join(f'<div class="sec-head"><h2>{e(h)}</h2></div><div class="tiles">{"".join(t)}</div>' for h, t in sections) + '</section>'
    open(f'{slug}.html', 'w').write(shell(slug, title, desc, body, kind))


index('guides', 'Chartering guides for newcomers', 'Plain-language guides to ship chartering: demurrage, laytime, laycan, charter parties, shipbrokers and ship sizes.', 'Guides',
      'Plain-language explanations for people fixing their first ships. No sign-up needed.',
      [('How chartering works', [tile(g['slug']) for g in GUIDES]), ('Ship sizes', [tile('ship-sizes')] + [tile(k) for k in CLASSES]), ('Calculators', [tile('laytime-demurrage-calculator'), tile('voyage-estimator')])], 'guides')
PAGES['paste'] = ('Paste an enquiry', 'Paste a cargo order as you would email it and the listing form fills itself. Inside the platform.', fig_chain([('Email text', 'Free wording'), ('Parser', 'Picks out terms'), ('Listing form', 'You check it')], ['reads', 'fills'], 'Text to form'))
index('tools', 'Free chartering calculators and tools', 'Free tools for ship chartering: laytime and demurrage calculator, voyage estimator, ship class finder.', 'Tools',
      'Free calculators for the sums that come up on every fixture.',
      [('Calculators', [tile('laytime-demurrage-calculator'), tile('voyage-estimator'), tile('ship-sizes'), tile('paste', 'index.html#/post/cargo')])], 'tools')

# Sitemap and robots
slugs = ['', 'guides', 'tools', 'ship-sizes', 'laytime-demurrage-calculator', 'voyage-estimator'] + [g['slug'] for g in GUIDES] + list(CLASSES)
open('sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{SITE}/{s}</loc><lastmod>{DATE}</lastmod></url>\n' for s in slugs) + '</urlset>\n')
open('robots.txt', 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n')
print('built', len(slugs) - 1, 'pages')
