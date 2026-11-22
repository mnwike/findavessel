#!/usr/bin/env python3
"""Builds the static guide, ship-size and tool pages for FindAVessel.
Run from the repository root:  python3 build_pages.py
Each page is written next to index.html so it is served at /<slug> on GitHub Pages."""
import collections, glob, html, json, math, os, re
from urllib.parse import quote

SITE = 'https://findavessel.com'
DATE = '2026-11-22'
VER = '20261122j'  # change on each release so browsers fetch fresh styles and scripts
THEME_BTN = ('<button class="theme-btn" data-theme-toggle aria-label="Switch between dark and light theme">'
             '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg>'
             '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg><span>Theme</span></button>')
LOGO = '<svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20h30l-3.5 10h-23zM20 20v10M13 20v-8h14v8M20 12V5"/><path d="M4 36q4-3 8 0t8 0 8 0 8 0"/></svg>'
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


def fig_matrix(cols, rows, label, who=('Owner', 'Charterer'), head='Who pays'):
    """rows: (name, [O|C per column]). O = owner pays, C = charterer pays."""
    out = [txt(40, 40, head, 't-muted', 13)]
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
            out.append(txt(290 + i * cw, y + 4, who[0] if c == 'O' else who[1], 't-on', 12, 'middle', 600))
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
BRAND = 'FindAVessel'
ORG = {'@type': 'Organization', '@id': SITE + '/#org', 'name': BRAND, 'url': SITE + '/',
       'description': 'Whole-ship chartering marketplace for cargo owners, vessel owners and shipbrokers, with a directory of ports and marine suppliers.'}
WEBSITE = {'@type': 'WebSite', '@id': SITE + '/#website', 'url': SITE + '/', 'name': BRAND, 'publisher': {'@id': SITE + '/#org'}, 'inLanguage': 'en'}
HUBS = {'guides': ('Guides', 'guides'), 'tools': ('Calculators', 'tools'), 'ports': ('Ports', 'ports'), 'suppliers': ('Suppliers', 'suppliers')}
ROBOTS = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'


def url(slug):
    """One canonical address per page: the .html address every internal link uses."""
    return SITE + '/' + (slug + '.html' if slug else '')


def clip(text, limit):
    """Shorten to a limit on a word boundary, never mid-word."""
    text = ' '.join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit + 1].rsplit(' ', 1)[0].rstrip(' ,;:-(')
    return cut if len(cut) > limit * .5 else text[:limit]


def fit_title(title):
    """Title tag formula: '<page title> | FindAVessel' when it fits in 60 characters, else the page title alone, clipped."""
    title = ' '.join(title.split())
    if len(title) + len(BRAND) + 3 <= 60:
        return f'{title} | {BRAND}'
    words = clip(title, 60).split(' ') if len(title) > 60 else title.split(' ')
    while len(title) > 60 and words[-1].lower().strip(',:;') in STOP:
        words.pop()
    return ' '.join(words).rstrip(' ,:;-')


STOP = set('a an the and or how to of it its with by from why what who is in on get for as at that which are'.split())


def fit_desc(desc):
    d = clip(desc, 154)
    return d if d.endswith(('.', '?', '!')) or d == ' '.join(desc.split()) else d + '.'


def shell(slug, title, desc, body, kind='Article', extra_head='', scripts='', crumbs=None, ld_extra=None, robots=ROBOTS, name=None):
    cur = lambda s: ' aria-current="page"' if s == kind else ''
    tag_title, desc, page = fit_title(title), fit_desc(desc), url(slug)
    name = name or title.split(':')[0]
    if crumbs is None:
        crumbs = [HUBS[kind]] if kind in HUBS and HUBS[kind][1] != slug else []
    trail = [('Home', '')] + list(crumbs) + [(name, slug)]
    image = PHOTOS[slug][0] if slug in globals().get('PHOTOS', {}) else 'photo-port.jpg'
    node = {'@type': 'Article' if kind == 'guides' and slug != 'guides' else 'WebPage', '@id': page + '#page', 'url': page, 'name': title, 'headline': clip(title, 110),
            'description': desc, 'inLanguage': 'en', 'isPartOf': {'@id': SITE + '/#website'}, 'datePublished': DATE, 'dateModified': DATE,
            'author': {'@id': SITE + '/#org'}, 'publisher': {'@id': SITE + '/#org'}, 'image': f'{SITE}/{image}', 'mainEntityOfPage': page,
            'breadcrumb': {'@id': page + '#crumbs'}}
    crumb_ld = {'@type': 'BreadcrumbList', '@id': page + '#crumbs', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': url(sl)} for i, (n, sl) in enumerate(trail)]}
    ld = {'@context': 'https://schema.org', '@graph': [ORG, WEBSITE, node, crumb_ld] + list(ld_extra or [])}
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(tag_title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="{robots}">
<meta name="theme-color" content="#0A1C2E">
<link rel="canonical" href="{page}">
<meta property="og:site_name" content="{BRAND}">
<meta property="og:title" content="{e(clip(title, 90))}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:type" content="{'article' if node['@type'] == 'Article' else 'website'}">
<meta property="og:url" content="{page}">
<meta property="og:image" content="{SITE}/{image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='7' fill='%230A1C2E'/%3E%3Cg transform='translate(5 5) scale(.75)' fill='none' stroke='%23fff' stroke-width='3.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M5 20h30l-3.5 10h-23zM20 20v10M13 20v-8h14v8M20 12V5'/%3E%3Cpath d='M4 36q4-3 8 0t8 0 8 0 8 0'/%3E%3C/g%3E%3C/svg%3E">
<script src="theme.js?v={VER}"></script>
<script src="analytics.js?v={VER}"></script>
<link rel="stylesheet" href="styles.css?v={VER}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>{extra_head}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="index.html">{LOGO}<span>FindAVessel</span></a>
  <nav class="nav" aria-label="Main"><a href="index.html#/cargoes">Board</a><a href="index.html#/vessels">Vessels</a><a href="index.html#/deals">Deals</a><a href="index.html#/passport">Passport</a><a href="ports.html"{cur('ports')}>Ports</a><a href="suppliers.html"{cur('suppliers')}>Suppliers</a><a href="guides.html"{cur('guides')}>Guides</a><a href="tools.html"{cur('tools')}>Tools</a></nav>
  <div class="top-right">{THEME_BTN}<a class="btn btn-primary" href="index.html#/enquire">Leave an enquiry</a></div>
</header>
<main id="main">{body}</main>
<footer class="foot">
  <div><strong>FindAVessel</strong><p>Whole-ship charters for owners, cargo interests and brokers who are new to each other.</p></div>
  <div><strong>Platform</strong><a href="index.html#/cargoes">Cargoes</a><a href="index.html#/vessels">Vessels</a><a href="index.html#/guide/safeguards">Safeguards</a><a href="index.html#/join">Create an account</a></div>
  <div><strong>Learn</strong><a href="guides.html">Chartering guides</a><a href="ship-sizes.html">Ship sizes</a><a href="tools.html">Calculators</a><a href="ports.html">Ports by country</a><a href="suppliers.html">Supplier directory</a><a href="faq.html">Questions and answers</a><a href="privacy.html">Privacy and cookies</a></div>
  <div><p>Guides are general information, not legal advice. The wording of your charter party governs. FindAVessel is a prototype and offers no regulated service.</p><p>© 2026 FindAVessel. All rights reserved. No part of this site may be copied or reused without written permission.</p></div>
</footer>
<nav class="tabbar" aria-label="Main, mobile"><a href="index.html#/cargoes">Board</a><a href="ports.html"{cur('ports')}>Ports</a><a href="suppliers.html"{cur('suppliers')}>Suppliers</a><a href="guides.html"{cur('guides')}>Guides</a><a href="index.html#/enquire">Enquire</a></nav>
{scripts}
<script src="quick-enquiry.js?v={VER}" defer></script>
</body>
</html>
'''


PAGES = {}  # slug -> (title, blurb, figure) for index tiles and related links
PD = json.load(open('providers.json')) if os.path.exists('providers.json') else None
SUP_CSLUGS = {PD['countries'][p[3]][1] for p in PD['providers']} if PD else set()
SUP_COUNT = collections.Counter(PD['countries'][p[3]][1] for p in PD['providers']) if PD else {}

import os
P_TANKER = ('photo-tanker.jpg', 'Aerial view of an oil and chemical tanker under way near a wooded coast', 'An oil and chemical tanker under way.')
P_BULK = ('photo-bulk-carrier.jpg', 'Aerial view of a bulk carrier with closed hatch covers and a tug alongside', 'A bulk carrier with a tug alongside.')
P_PORT = ('photo-port.jpg', 'A cargo port at dusk with ships alongside under cranes', 'Cargo work at a port terminal.')
P_ANCH = ('photo-anchorage.jpg', 'Many cargo ships lying at anchor off a coast', 'Ships at anchor waiting for a berth.')
P_BRIDGE = ('photo-bridge.jpg', 'Navigation consoles and screens on a ship’s bridge', 'Consoles on a ship’s bridge.')
P_DESK = ('photo-desk.jpg', 'A woman at a desk with several screens showing shipping routes on world maps', 'Following ships and routes from an operations desk.')
P_DOC = ('photo-contract.jpg', 'A hand signing a printed contract with a pen', 'Signing a contract.')
PHOTOS = {'what-is-demurrage': P_ANCH, 'laytime': P_PORT, 'laycan': P_BULK, 'voyage-charter-vs-time-charter': P_BRIDGE, 'charter-party': P_DOC, 'what-does-a-shipbroker-do': P_DESK,
          'how-to-charter-a-ship': P_PORT, 'vlcc': P_TANKER, 'suezmax': P_TANKER, 'aframax': P_TANKER, 'panamax': P_BULK, 'capesize': P_BULK, 'supramax': P_BULK, 'handysize': P_BULK,
          'ship-sizes': P_TANKER, 'laytime-demurrage-calculator': P_ANCH, 'voyage-estimator': P_BRIDGE, 'ports': P_PORT}
PHOTOS.update({'kamsarmax': P_BULK, 'ultramax': P_BULK, 'handymax': P_BULK, 'newcastlemax': P_BULK, 'mr-tanker': P_TANKER, 'lr1': P_TANKER, 'lr2': P_TANKER, 'notice-of-readiness': P_ANCH, 'deadweight-tonnage': P_BULK,
               'worldscale': P_TANKER, 'disponent-owner': P_DESK, 'statement-of-facts': P_PORT, 'bareboat-charter': P_DOC, 'bulk-carrier-chartering': P_BULK, 'tanker-chartering': P_TANKER,
               'gas-carrier-chartering': P_TANKER, 'container-ship-chartering': P_PORT, 'multipurpose-ship-chartering': P_PORT, 'car-carrier-chartering': P_PORT})
PHOTOS.update({'shadow-fleet': P_TANKER, 'know-your-vessel': P_BRIDGE, 'letter-of-indemnity': P_DOC, 'fob-vs-cif': P_PORT, 'shipping-terms': P_DESK, 'despatch': P_PORT, 'p-and-i-club': P_ANCH, 'baltic-exchange': P_DESK, 'baltic-dry-index': P_BULK, 'vlgc': P_TANKER, 'lng-carrier': P_TANKER})
PHOTOS = {k: v for k, v in PHOTOS.items() if os.path.exists(v[0])}


def photo(slug, lazy=False):
    p = PHOTOS.get(slug)
    return f'<figure class="photo"><img src="{p[0]}" alt="{e(p[1])}" width="1200" height="675"{" loading=lazy" if lazy else ""}><figcaption>{e(p[2])} Photo: iStock.</figcaption></figure>' if p else ''



def article(slug, title, desc, h1, standfirst, fig, caption, body, related, kind='guides', crumb='Guides', crumb_href='guides.html', scripts='', cta=True):
    rel = ''.join(f'<li><a href="{r}.html">{e(PAGES[r][0])}</a></li>' for r in related if r in PAGES)
    cta_html = '''<div class="article-cta"><h2>Put it into practice</h2><p>FindAVessel lets cargo owners post a full shipload and receive firm offers from verified vessel owners and brokers, with subjects, payment and the time log in one record.</p>
<div class="row"><a class="btn btn-primary" href="index.html#/join">Create an account</a><a class="btn" href="index.html">See the sample market</a></div></div>''' if cta else ''
    body_html = f'''<article class="article">
<p class="crumbs"><a href="{crumb_href}">{crumb}</a> / {e(h1)}</p>
<h1>{e(h1)}</h1>
<p class="standfirst">{standfirst}</p>
{photo(slug)}
<figure>{fig}<figcaption>{caption}</figcaption></figure>
{body}
{cta_html}
<div class="related"><h2>Keep reading</h2><ul>{rel}</ul></div>
<p class="fine">Published {DATE[8:]} November {DATE[:4]}. General information for people new to chartering, not legal advice.</p>
</article>'''
    extra = [{'@type': 'WebApplication', 'name': h1, 'url': url(slug), 'applicationCategory': 'BusinessApplication', 'operatingSystem': 'Any',
              'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'}, 'publisher': {'@id': SITE + '/#org'}}] if kind == 'tools' else None
    open(f'{slug}.html', 'w').write(shell(slug, title, desc, body_html, kind, scripts=scripts, name=h1, ld_extra=extra))


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


# ---------- Second batch: more classes, more terms ----------
CLASSES.update({
    'kamsarmax': dict(name='Kamsarmax', full='Kamsarmax bulk carrier', bands=BULK, i=6, kw='Kamsarmax',
        stand='A Kamsarmax is a bulk carrier of about 82,000 deadweight tonnes, built to the longest hull that can berth at Port Kamsar in Guinea: 229 metres.',
        facts=[('Deadweight', '80,000 to 87,000 tonnes, typically about 82,000'), ('Length and beam', '229 m by 32.26 m'), ('Holds and gear', 'Seven holds, gearless'), ('Named after', 'Port Kamsar, Guinea, a major bauxite port'), ('Next size down', 'Panamax'), ('Next size up', 'Post-Panamax')],
        body='''<h2>A Panamax, stretched</h2><p>The Kamsarmax keeps the 32.26 m beam of a Panamax, so it still fits the original Panama Canal locks, but uses every metre of length the bauxite berth at Kamsar allows. The result carries several thousand tonnes more than a standard Panamax for much the same voyage costs.</p>
<h2>What Kamsarmaxes carry</h2><p>Bauxite from Guinea, grain from the Americas and the Black Sea, and coal from Indonesia, Australia and Colombia. Because they are gearless they trade between ports with shore loaders and unloaders.</p>
<h2>How they are chartered</h2><p>Voyage charters per tonne on GENCON or a grain or coal form, and time charters on NYPE. Many modern "Panamax" fixtures are in fact Kamsarmaxes.</p>'''),
    'ultramax': dict(name='Ultramax', full='Ultramax bulk carrier', bands=BULK, i=4, kw='Ultramax',
        stand='An Ultramax is a geared bulk carrier of roughly 60,000 to 67,000 deadweight tonnes: the larger, more fuel-efficient successor to the Supramax.',
        facts=[('Deadweight', '60,000 to 67,000 tonnes'), ('Holds and gear', 'Five holds, four cranes of 30 to 36 tonnes, usually with grabs'), ('Typical length and beam', 'About 200 m by 32.26 m'), ('Next size down', 'Supramax'), ('Next size up', 'Panamax')],
        body='''<h2>Why the class appeared</h2><p>Shipyards found they could add several thousand tonnes of capacity to a Supramax design for little extra fuel. Charterers get more cargo per voyage and the ship can still work its own cargo with its cranes.</p>
<h2>What Ultramaxes carry</h2><p>The same wide mix as a Supramax: grain, coal, fertiliser, cement and clinker, bauxite, nickel ore, steel and other minor bulks. The extra capacity matters most on long hauls.</p>
<h2>Chartering one</h2><p>Cargoes of 55,000 to 63,000 tonnes are a natural fit. State whether you need the ship’s cranes and grabs at either port, because a geared ship costs more than a gearless one of the same size and you should not pay for gear you will not use.</p>'''),
    'handymax': dict(name='Handymax', full='Handymax bulk carrier', bands=BULK, i=2, kw='Handymax',
        stand='A Handymax is a geared bulk carrier of roughly 40,000 to 50,000 deadweight tonnes, between the Handysize and the Supramax.',
        facts=[('Deadweight', '40,000 to 50,000 tonnes'), ('Holds and gear', 'Five holds, four cranes of about 30 tonnes'), ('Typical length and beam', 'About 180 to 190 m by 30 to 32 m'), ('Next size down', 'Handysize'), ('Next size up', 'Supramax')],
        body='''<h2>An older name still in use</h2><p>Few ships are built to this size today; Supramax and Ultramax designs replaced it. But many Handymaxes still trade, and the word is often used loosely for any geared bulk carrier from 40,000 to 65,000 tonnes.</p>
<h2>What Handymaxes carry</h2><p>Grain, fertiliser, cement, steel, logs and minor bulks, on the same routes as Supramaxes but with slightly smaller parcels and shallower draught.</p>
<h2>What to check</h2><p>Age. Much of the Handymax fleet is past 15 years old, and many charterers, receivers and insurers set an age limit. Put your limit in the enquiry.</p>'''),
    'newcastlemax': dict(name='Newcastlemax', full='Newcastlemax bulk carrier', bands=BULK, i=9, kw='Newcastlemax',
        stand='A Newcastlemax is a bulk carrier of about 200,000 to 210,000 deadweight tonnes, the largest that can enter the coal port of Newcastle in Australia.',
        facts=[('Deadweight', '200,000 to 210,000 tonnes'), ('Port limits', 'About 300 m long and 50 m beam'), ('Cargoes', 'Coal and iron ore'), ('Named after', 'Port of Newcastle, New South Wales'), ('Next size down', 'Capesize'), ('Next size up', 'Very large ore carrier')],
        body='''<h2>A bigger Capesize</h2><p>The Newcastlemax carries around 15% more than a standard 180,000-tonne Capesize. It trades on the same routes and is usually counted with the Capesize fleet in market reports.</p>
<h2>Where they trade</h2><p>Coal from Newcastle and iron ore from Western Australia and Brazil to China, Japan and Korea. Only a limited number of terminals can take them fully laden.</p>
<h2>How they are chartered</h2><p>Largely on long-term contracts and time charters to miners, steel mills and large operators, with spot voyages priced per tonne.</p>'''),
    'mr-tanker': dict(name='MR tanker', full='medium range product tanker', bands=TANKER, i=3, kw='MR tanker',
        stand='An MR, or medium range, tanker is a product tanker of roughly 35,000 to 55,000 deadweight tonnes. It is the most common ship for moving petrol, diesel and jet fuel by sea.',
        facts=[('Deadweight', 'MR1: 35,000 to 45,000 tonnes. MR2: 45,000 to 55,000 tonnes'), ('Typical cargo', 'About 300,000 to 350,000 barrels of refined products'), ('Typical length and beam', 'About 183 m by 32.2 m'), ('Tanks', 'Coated, often rated IMO 2 or 3 for chemicals and vegetable oils'), ('Next size down', 'Handysize tanker'), ('Next size up', 'LR1')],
        body='''<h2>What MRs carry</h2><p>Clean petroleum products: petrol, diesel, jet fuel and naphtha. Many are also certified to carry vegetable oils and easy chemicals, which lets an owner find a return cargo instead of sailing back empty.</p>
<h2>Where they trade</h2><p>Everywhere refined products move: across the Atlantic, around Europe and the Mediterranean, within Asia, and into West Africa and Latin America. Their size fits most product terminals.</p>
<h2>What a charterer will be asked, and will ask</h2><p>The last three cargoes, the tank coating and whether the ship has passed recent oil company inspections. A ship that last carried a dirty cargo cannot load jet fuel without extensive cleaning.</p>'''),
    'lr1': dict(name='LR1', full='Long Range 1 product tanker', bands=TANKER, i=4, kw='LR1 tanker',
        stand='An LR1, or Long Range 1, is a product tanker of roughly 55,000 to 80,000 deadweight tonnes. It is a Panamax-sized tanker with coated tanks for refined products.',
        facts=[('Deadweight', '55,000 to 80,000 tonnes'), ('Typical cargo', 'Roughly half a million barrels of refined products'), ('Beam', '32.2 m, the original Panama Canal limit'), ('Crude-trading name', 'Panamax tanker'), ('Next size down', 'MR'), ('Next size up', 'LR2')],
        body='''<h2>Where LR1s trade</h2><p>Long hauls of naphtha, jet fuel and diesel from the big export refineries of the Middle East and India to Europe and the Far East, and from the US Gulf to Latin America.</p>
<h2>LR1 or Panamax tanker</h2><p>Same hull. With coated tanks and clean last cargoes it is an LR1. Trading crude or fuel oil it is called a Panamax tanker. Moving a ship from dirty to clean trading takes several cargoes and thorough tank cleaning.</p>'''),
    'lr2': dict(name='LR2', full='Long Range 2 product tanker', bands=TANKER, i=5, kw='LR2 tanker',
        stand='An LR2, or Long Range 2, is a product tanker of roughly 80,000 to 120,000 deadweight tonnes. It is an Aframax-sized tanker with coated tanks for refined products.',
        facts=[('Deadweight', '80,000 to 120,000 tonnes'), ('Typical cargo', '600,000 to 750,000 barrels of refined products'), ('Typical length and beam', 'About 245 m by 44 m'), ('Crude-trading name', 'Aframax'), ('Next size down', 'LR1'), ('Next size up', 'Suezmax')],
        body='''<h2>Where LR2s trade</h2><p>The longest product routes: naphtha from the Middle East to Japan and Korea, and diesel and jet fuel from the Middle East and India to Europe. The economics are the same as for crude: the longer the voyage, the more a large ship saves per barrel.</p>
<h2>LR2 or Aframax</h2><p>Same hull. Owners switch between clean and dirty trading depending on which market pays more, but switching back to clean is slow and costly. See the <a href="aframax.html">Aframax</a> page for the crude side.</p>'''),
})
SLUG_FOR = {'Kamsarmax': 'kamsarmax', 'Ultramax': 'ultramax', 'Handymax': 'handymax', 'Newcastlemax': 'newcastlemax', 'MR1': 'mr-tanker', 'MR2': 'mr-tanker', 'VLCC': 'vlcc', 'Suezmax': 'suezmax',
            'Very large gas carrier': 'vlgc', 'Aframax / LR2': 'aframax', 'Panamax / LR1': 'lr1', 'Panamax': 'panamax', 'Capesize': 'capesize', 'Supramax': 'supramax', 'Handysize': 'handysize'}

GUIDES += [
    dict(slug='notice-of-readiness', title='Notice of readiness (NOR) in shipping: what makes it valid', h1='Notice of readiness',
        desc='Notice of readiness is the master’s notice that a ship has arrived and is ready to load or discharge. When it is valid and why it starts the laytime clock.',
        stand='Notice of readiness, or NOR, is the notice a ship’s master gives the charterer that the ship has arrived and is ready to load or discharge. It is what starts the laytime clock.',
        fig=fig_timeline([('Waiting', .2, 'f-track'), ('Turn time', .15, 'f-track'), ('Laytime counting', .65, 'f-done')], [(0, 'Ship arrives'), (.2, 'NOR tendered'), (.35, 'Laytime starts'), (1, 'Cargo work ends')], 'Timeline from arrival to notice of readiness to the start of laytime'),
        cap='Laytime starts after a valid notice and any turn time in the charter party, not on arrival.',
        body='''<h2>Three conditions for a valid notice</h2><ol><li><strong>The ship has arrived</strong> at the place the charter party names. Under a berth charter that is the berth; under a port charter, the usual waiting area within the port.</li><li><strong>The ship is ready</strong> in every way that matters for the cargo: holds or tanks clean and passed, equipment working, health and customs clearance where required.</li><li><strong>The notice is given as the contract requires:</strong> to the right party, by the agreed method, and within any office hours the charter party sets.</li></ol>
<div class="keyfact"><p>A notice given before the ship is actually ready is generally invalid, and it does not become valid later. A fresh notice is needed.</p></div>
<h2>Why it causes so many disputes</h2><p>Days of <a href="laytime.html">laytime</a> and tens of thousands of dollars of <a href="what-is-demurrage.html">demurrage</a> can turn on whether a notice was valid. Typical arguments: holds failed inspection after the notice was given, the ship was waiting outside port limits, or the notice was sent outside permitted hours.</p>
<h2>Terms that modify the rule</h2><p>Charter parties often let notice be given "whether in berth or not" or "whether in port or not", so the owner is not penalised when the port is congested. Tanker charters usually give six hours after notice before laytime runs.</p>
<h2>Good practice</h2><ul><li>Owners: tender on arrival, and tender again if anything about readiness changes.</li><li>Charterers: if you think a notice is invalid, say so in writing at once.</li><li>Both: make sure the time of the notice is in the <a href="statement-of-facts.html">statement of facts</a>.</li></ul>''',
        rel=['laytime', 'what-is-demurrage', 'statement-of-facts', 'laycan']),
    dict(slug='deadweight-tonnage', title='Deadweight tonnage (DWT) explained, and how it differs from gross tonnage', h1='Deadweight tonnage (DWT)',
        desc='Deadweight tonnage is the weight a ship can carry: cargo, fuel, water and stores. How DWT differs from gross tonnage, displacement and cargo capacity.',
        stand='Deadweight tonnage, or DWT, is the total weight a ship can carry when loaded to its summer load line: cargo plus fuel, fresh water, stores and crew. It is the main measure of size for tankers and bulk carriers.',
        fig=fig_timeline([('Lightweight: the ship itself', .32, 'f-track'), ('Deadweight: everything it carries', .68, 'f-done')], [(0, 'Empty'), (.32, 'Ready for cargo'), (1, 'Loaded to the summer load line')], 'Bar showing displacement split into lightweight and deadweight', 'Displacement is the two added together.'),
        cap='A ship’s loaded displacement is its own weight plus its deadweight.',
        body='''<h2>Deadweight is not cargo capacity</h2><p>Fuel, water and stores come out of the deadweight before cargo does. A 58,000 DWT bulk carrier will typically load about 55,000 to 56,000 tonnes of cargo, less if it bunkers heavily for a long voyage or if a port restricts its draught.</p>
<h2>The measures people confuse</h2>''' + table(['Measure', 'What it is', 'Used for'], [
            ['<strong>Deadweight (DWT)</strong>', 'Weight the ship can carry, in tonnes', 'Size of tankers and bulk carriers; chartering'],
            ['<strong>Gross tonnage (GT)</strong>', 'Internal volume of the whole ship. Not a weight.', 'Port dues, regulations, crew rules'],
            ['<strong>Net tonnage (NT)</strong>', 'Volume of the cargo spaces', 'Canal tolls and some port charges'],
            ['<strong>Displacement</strong>', 'Weight of water the ship displaces: its own weight plus what it carries', 'Naval architecture; warships'],
            ['<strong>Lightweight</strong>', 'Weight of the empty ship', 'Scrap value']]) + '''
<h2>Why "summer" deadweight</h2><p>A ship may load deeper in some seasons and zones than others. The quoted figure is normally the summer deadweight, at the summer load line marked on the hull. In winter zones or fresh water the permitted draught, and so the cargo, changes.</p>
<h2>Volume matters too</h2><p>Light cargoes fill the holds before they reach the weight limit. That is why bulk carrier listings also give grain and bale capacity in cubic metres, and why a cargo enquiry should state the stowage factor. See <a href="ship-sizes.html">ship sizes</a> for the classes built on deadweight.</p>''',
        rel=['ship-sizes', 'supramax', 'how-to-charter-a-ship', 'voyage-estimator']),
    dict(slug='worldscale', title='Worldscale explained: how tanker freight is quoted', h1='Worldscale',
        desc='Worldscale is the reference schedule used to quote tanker freight. What WS100 and the flat rate mean, with a worked example.',
        stand='Worldscale is a published schedule of reference freight rates for tanker voyages. Tanker freight is negotiated as a percentage of that reference, quoted as "WS" points.',
        fig=fig_chain([('Flat rate', 'USD per tonne, by route'), ('WS points', 'Negotiated, e.g. WS 80'), ('Freight', '80% of the flat rate')], ['multiplied by', 'gives'], 'Flat rate multiplied by Worldscale points gives the freight per tonne'),
        cap='WS 100 means the flat rate. WS 80 means 80% of it.',
        body='''<h2>How it works</h2><p>For each pair of loading and discharging ports, Worldscale publishes a <strong>flat rate</strong> in US dollars per tonne. It is calculated for a standard ship on a round voyage and reissued each year to reflect fuel prices and port costs. The flat rate is called WS 100.</p>
<p>Owners and charterers then negotiate only the percentage. If the flat rate for a route is USD 20 per tonne and the fixture is done at WS 80, freight is USD 16 per tonne. On an 80,000-tonne cargo that is USD 1.28 million.</p>
<h2>Why tankers use it</h2><p>Tanker charters often give the charterer a range of loading and discharging ports, decided after the ship is fixed. One WS number covers every permitted combination, because each has its own flat rate. Both sides can also compare very different routes on one scale.</p>
<h2>What moves the WS level</h2><p>Supply and demand for that size of tanker in that region. Larger ships fix at lower WS numbers than smaller ones on the same route, because their cost per tonne is lower.</p>
<h2>Where it is not used</h2><p>Dry bulk freight is quoted directly in dollars per tonne. Some tanker fixtures, especially on short or unusual routes, are done as a lump sum. Time charters are quoted in dollars per day. To compare a WS fixture with a daily rate, convert it with a <a href="voyage-estimator.html">voyage estimate</a>.</p>
<p class="fine">The schedule is published by the Worldscale Association and available by subscription. The figures in the example are illustrative.</p>''',
        rel=['vlcc', 'aframax', 'voyage-estimator', 'voyage-charter-vs-time-charter']),
    dict(slug='disponent-owner', title='Disponent owner: meaning and why it matters to a charterer', h1='Disponent owner',
        desc='A disponent owner controls a ship under a charter and lets it out again as if they owned it. What that means for the charterer and what to check.',
        stand='A disponent owner is a company that does not own a ship but controls it under a time or bareboat charter, and charters it out to someone else. To the next charterer, they stand in the owner’s place.',
        fig=fig_chain([('Registered owner', 'Holds title'), ('Disponent owner', 'Has the ship on charter'), ('Charterer', 'Has the cargo')], ['time charter', 'voyage charter'], 'Chain from registered owner to disponent owner to charterer'),
        cap='Two contracts, back to back. The charterer’s contract is with the disponent owner only.',
        body='''<h2>How it arises</h2><p>An operator takes a ship on time charter for a year at a daily rate, then uses it to carry other companies’ cargoes on voyage terms. In each of those voyage charters the operator signs as "disponent owner". Much of the dry bulk market works this way.</p>
<h2>What it means if you are the charterer</h2><ul><li><strong>Your contract is with the disponent owner,</strong> not the registered owner. Claims for non-performance go to them.</li><li><strong>Their performance depends on a contract you cannot see.</strong> If they stop paying hire, the registered owner can withdraw the ship.</li><li><strong>Bills of lading are often still the registered owner’s,</strong> which can give the cargo owner a direct claim for loss or damage to the goods.</li></ul>
<h2>What to check</h2><ul><li>Who the registered owner is, and that the disponent owner really has the ship on charter for long enough to perform your voyage.</li><li>The disponent owner’s financial standing: they may have few assets of their own.</li><li>That the ship’s P&amp;I cover and class are in order, exactly as you would for an owner.</li></ul>
<p>On FindAVessel a vessel listing states whether it is posted by the registered owner, a disponent owner or a manager, and the authority behind it is checked before the listing goes live.</p>''',
        rel=['voyage-charter-vs-time-charter', 'charter-party', 'what-does-a-shipbroker-do', 'how-to-charter-a-ship']),
    dict(slug='statement-of-facts', title='Statement of facts in shipping: what it records and why it matters', h1='Statement of facts',
        desc='A statement of facts is the port agent’s timed record of a ship’s call: arrival, notice of readiness, cargo work, stoppages and sailing. It is the basis of the laytime calculation.',
        stand='A statement of facts is the timed record of everything that happened during a ship’s port call. The laytime and demurrage calculation is built from it.',
        fig=fig_steps(['Arrival|At the port', 'NOR|Notice tendered', 'Berthed|All fast', 'Start|Cargo work begins', 'Stoppages|Rain, breakdowns', 'Complete|Cargo work ends', 'Sailed|Documents on board'], 'The sequence of events recorded in a statement of facts'),
        cap='Each event is recorded with its date and time. Stoppages are recorded with their cause.',
        body='''<h2>Who prepares it</h2><p>Normally the port agent, from the ship’s log and the terminal’s records. It is signed by the master and the agent, and often by the shipper or receiver as well.</p>
<h2>What it should contain</h2><ul><li>Arrival at the port or anchorage, and when <a href="notice-of-readiness.html">notice of readiness</a> was tendered and accepted</li><li>Time of berthing and of any shifting between berths</li><li>Start and finish of loading or discharging, with every interruption and its cause</li><li>Weather stoppages, holidays and shifts not worked</li><li>Draught surveys, hold or tank inspections, and the quantity loaded or discharged</li><li>Completion, documents on board and sailing</li></ul>
<h2>Why to read it before signing</h2><p>Whether a stoppage counts against <a href="laytime.html">laytime</a> depends on its cause and on who was responsible. "Stopped 4 hours" is useless; "stopped 4 hours, rain" or "shore conveyor breakdown" decides who pays. If you disagree with an entry, sign "under protest" and note why.</p>
<h2>A shared record avoids the argument</h2><p>Disputes start when each side has its own version. On FindAVessel, voyage events go into one time log that the owner and charterer each confirm as they happen, so the laytime statement starts from agreed facts.</p>''',
        rel=['laytime', 'notice-of-readiness', 'what-is-demurrage', 'laytime-demurrage-calculator']),
    dict(slug='bareboat-charter', title='Bareboat charter explained: ships, not yacht holidays', h1='Bareboat charter',
        desc='A bareboat or demise charter hands a ship to the charterer without crew, to operate as if they owned it. How it differs from a time charter and when it is used.',
        stand='Under a bareboat charter, also called a demise charter, the owner hands over the ship with no crew. The charterer mans, maintains, insures and operates it as if it were theirs, usually for several years.',
        fig=fig_matrix(['Voyage', 'Time', 'Bareboat'], [('Crew, maintenance, insurance', 'OOC'), ('Fuel', 'OCC'), ('Port and canal costs', 'OCC'), ('Where the ship trades', 'OCC')], 'Matrix showing the charterer takes on every operating cost under a bareboat charter'),
        cap='Under a bareboat charter the owner supplies only the ship and receives hire.',
        body='''<h2>What each side does</h2><p>The owner provides the vessel and collects hire, typically monthly. The charterer appoints the master and crew, pays for maintenance, dry-docking and insurance, and bears every running cost. The standard form is BIMCO’s BARECON.</p>
<h2>Why it is used</h2><ul><li><strong>Finance.</strong> A bank or leasing company owns the ship and bareboats it to the operator, often with an option or obligation to buy at the end. It is a lease in all but name.</li><li><strong>Flag.</strong> A bareboat charterer can sometimes register the ship under a second flag for the charter period.</li><li><strong>Control.</strong> An operator gets a ship for years without buying it.</li></ul>
<h2>How it differs from a time charter</h2><p>On a <a href="voyage-charter-vs-time-charter.html">time charter</a> the owner still employs the crew and is responsible for the ship’s condition; the charterer only directs where it goes. On a bareboat charter that responsibility moves to the charterer, who becomes a <a href="disponent-owner.html">disponent owner</a> when they charter the ship out again.</p>
<h2>If you were looking for yachts</h2><p>In leisure sailing, "bareboat charter" just means hiring a yacht without a skipper for a holiday. That is a different market, and not what this page or FindAVessel covers.</p>''',
        rel=['voyage-charter-vs-time-charter', 'disponent-owner', 'charter-party', 'how-to-charter-a-ship']),
]


# ---------- Third batch: gas carrier classes, despatch, P&I clubs ----------
CLASSES.update({
    'vlgc': dict(name='VLGC', full='very large gas carrier', bands=LPG, i=5, kw='VLGC', unit='cubic metres',
        stand='A VLGC, or very large gas carrier, is the largest type of LPG carrier. Most hold about 80,000 to 90,000 cubic metres, enough for roughly 45,000 to 50,000 tonnes of propane and butane.',
        facts=[('Tank capacity', 'Above about 60,000 cubic metres; most are 80,000 to 90,000'), ('Typical cargo', 'About 45,000 to 50,000 tonnes of LPG'), ('How the cargo is carried', 'Fully refrigerated, at about minus 42°C for propane'), ('Cargoes', 'Propane, butane and, on some ships, ammonia'), ('Next size down', 'Large gas carrier')],
        body='''<h2>Where VLGCs trade</h2><p>Long hauls from the two big export regions, the US Gulf and the Middle East, to Japan, Korea, China and India, where LPG is used for petrochemicals, heating and cooking. Ships sailing from the US Gulf to Asia choose between the Panama Canal and the longer route round the Cape of Good Hope, depending on canal waiting times and cost.</p>
<h2>How VLGCs are chartered</h2><p>On time charters to traders, producers and importers, and on voyage charters priced in US dollars per tonne. Voyage forms include ASBAGASVOY. Charterers vet ships much as they do oil tankers.</p>
<h2>Where the size bands disagree</h2><p>Sources draw the lower limit of the class anywhere from 50,000 to 75,000 cubic metres. What matters in a charter is the tank capacity in cubic metres and the cargo grades the ship is certified to carry.</p>'''),
    'lng-carrier': dict(name='LNG carrier', full='LNG carrier', bands=LNG, i=3, kw='LNG carrier sizes', unit='cubic metres',
        stand='An LNG carrier moves natural gas as a liquid at about minus 162°C. A conventional ship today holds around 174,000 cubic metres; the largest, the Q-Max, holds about 265,000.',
        facts=[('Conventional size', 'About 125,000 to 180,000 cubic metres; newer ships around 174,000'), ('Q-Flex', 'About 210,000 to 217,000 cubic metres'), ('Q-Max', 'About 263,000 to 266,000 cubic metres'), ('Cargo temperature', 'About minus 162°C'), ('Containment', 'Membrane tanks, or spherical Moss tanks on older ships')],
        body='''<h2>Why size is measured in cubic metres</h2><p>LNG is light, less than half the density of water, so tank volume fills up long before weight becomes the limit. Deadweight is rarely quoted for these ships.</p>
<h2>Q-Flex and Q-Max</h2><p>Both classes were built for Qatar’s export projects. The Q stands for Qatar and "Max" for the largest ship able to berth at the Ras Laffan terminal. Not every import terminal can take them.</p>
<h2>Boil-off</h2><p>A small fraction of the cargo evaporates every day. Most LNG carriers burn that gas as fuel, which is why their engines and their charter terms differ from those of other tankers.</p>
<h2>How LNG carriers are chartered</h2><p>Mostly on long time charters tied to gas supply contracts, with a smaller market for single voyages and short periods. Hire is quoted in US dollars per day. This is not a market a newcomer enters with one ship.</p>'''),
})

GUIDES += [
    dict(slug='despatch', title='Despatch in shipping: meaning, rate and how it is calculated', h1='Despatch',
        desc='Despatch is money the shipowner pays the charterer when loading or discharging finishes before laytime runs out. How it is calculated and when it applies.',
        stand='Despatch is the reverse of demurrage. When the charterer loads or discharges faster than the laytime allowed, the shipowner pays the charterer for the time saved, usually at half the demurrage rate.',
        fig=fig_timeline([('Time used: 5 days', .62, 'f-done'), ('Saved: 3 days', .38, 'f-ok')], [(0, 'Laytime starts'), (.62, 'Cargo work ends'), (1, 'Laytime would have expired')], 'Timeline of 8 days of laytime with cargo work finishing after 5', 'At a despatch rate of USD 6,000 a day, three days saved earns the charterer USD 18,000.'),
        cap='Eight days allowed, five used. The three days saved are paid for at the despatch rate.',
        body='''<div class="keyfact"><p><strong>In one line:</strong> time allowed minus time used, multiplied by the daily despatch rate.</p></div>
<h2>Why owners pay it</h2><p>A ship released early can start earning on its next voyage sooner. Despatch shares part of that gain with the charterer and gives them a reason to work the cargo quickly.</p>
<h2>The rate</h2><p>Most dry cargo charter parties set despatch at half the <a href="what-is-demurrage.html">demurrage</a> rate, often written "DHD": despatch half demurrage. If demurrage is USD 12,000 a day, despatch is USD 6,000. Some charters say "free despatch", meaning none is paid.</p>
<h2>Which time counts as saved</h2><p>Two wordings give different answers:</p><ul><li><strong>All time saved:</strong> every hour from completion until laytime would have expired, including Sundays and holidays that would not have counted as <a href="laytime.html">laytime</a>.</li><li><strong>Working time saved</strong> or <strong>laytime saved:</strong> only the hours that would have counted as laytime.</li></ul><p>On a slow-loading cargo over a holiday period the difference can be several days, so check which your charter party says.</p>
<h2>Where it does not apply</h2><p>Tanker charters normally have no despatch. Neither do time charters, where the charterer is already paying for the ship by the day and benefits directly from any time saved.</p>
<h2>Working it out</h2><p>Use the same record as for demurrage: the <a href="statement-of-facts.html">statement of facts</a>. The <a href="laytime-demurrage-calculator.html">laytime and demurrage calculator</a> shows despatch when time used is less than time allowed.</p>''',
        rel=['what-is-demurrage', 'laytime', 'laytime-demurrage-calculator', 'statement-of-facts']),
    dict(slug='p-and-i-club', title='P&I clubs explained: what protection and indemnity insurance covers', h1='P&I clubs',
        desc='A P&I club is a mutual insurer that covers a shipowner’s liabilities to others: cargo claims, crew injury, pollution and wreck removal. What it covers and why a charterer should check it.',
        stand='A P&I club is a mutual insurance association owned by its shipowner members. It covers the liabilities a ship incurs to other people: cargo owners, crew, ports and coastal states. P&I stands for protection and indemnity.',
        fig=fig_steps(['Member|Pays calls', 'Club|Pays the claim', 'Pool|Clubs share large claims', 'Reinsurance|Above the pool'], 'Four layers that pay a P&I claim, from the member to the reinsurance market'),
        cap='Who pays as a claim grows: the club first, then the pool shared between clubs, then reinsurers.',
        body='''<h2>What P&I covers</h2><ul><li>Loss of or damage to cargo carried on the ship</li><li>Injury, illness and death of crew, passengers and others on board</li><li>Pollution from oil or other substances</li><li>Damage to docks, buoys and other fixed objects</li><li>The part of collision liability that hull insurance leaves out</li><li>Removing the wreck if the ship is lost</li><li>Fines, stowaways and the costs of defending claims</li></ul>
<h2>How a club works</h2><p>Members pay "calls" into a pool that pays their claims. The club is run for its members and not for profit. Very large claims are shared between clubs and then reinsured. Twelve clubs make up the International Group of P&I Clubs, which between them insure the great majority of the world’s ocean-going tonnage. Some smaller ships are insured with commercial "fixed premium" P&I providers instead.</p>
<h2>Why a charterer should check it</h2><p>If cargo is damaged or the ship pollutes, the claim is only worth what the owner can pay. Good P&I cover means there is a solvent insurer behind the owner. Ports and terminals may also refuse a ship without it. Ask for the <strong>certificate of entry</strong>, which names the ship, the club and the period of cover, and check that it runs past the end of your voyage.</p>
<h2>Cover for charterers</h2><p>Charterers carry liabilities too: damage to the ship caused by an unsafe port or by the cargo, for example. Clubs and other insurers sell charterers’ liability cover for this.</p>
<h2>What P&I does not replace</h2><p>It is not cargo insurance. The cargo owner still needs their own policy on the goods, because the carrier’s liability is limited by law and by the contract.</p>
<p>On FindAVessel a vessel listing names the club or insurer, and the certificate of entry is held on file with its expiry date.</p>''',
        rel=['how-to-charter-a-ship', 'charter-party', 'disponent-owner', 'what-is-demurrage']),
]

# Researched notes on well-known groups, shown on every profile that carries the group's name.
# Each is written from the source linked beside it and dated; keep them short and factual.
BRANDS = [
    (r'\balfa laval', 'Alfa Laval', 'Alfa Laval is a Swedish engineering company founded in 1883. Its work centres on heat transfer, separation and fluid handling. For ships it supplies separators for cleaning fuel and lubricating oil, boilers and heaters, cooling and fresh-water equipment and environmental systems.', 'https://www.alfalaval.com/industries/marine-transportation/marine/'),
    (r'w[aä]rtsil[aä]', 'Wärtsilä', 'Wärtsilä is a Finnish company headquartered in Helsinki, with roots going back to 1834. It makes and services engines, propulsion and other equipment for the marine and energy markets.', 'https://en.wikipedia.org/wiki/W%C3%A4rtsil%C3%A4'),
    (r'kongsberg', 'Kongsberg Maritime', 'Kongsberg Maritime is part of the Norwegian technology group Kongsberg Gruppen and is based in Kongsberg, Norway. It supplies automation, navigation, dynamic positioning, propulsion and deck systems for merchant, offshore and naval vessels.', 'https://www.kongsberg.com/maritime/about-us'),
    (r'\bconsilium', 'Consilium Safety Group', 'Consilium Safety Group is a Swedish company that makes fire, flame and gas detection and safety management systems for ships, as well as for rail and buildings. It acquired the Danish oil mist detection specialist Daspos in 2024.', 'https://www.consiliumsafety.com/marine'),
    (r'viking life.?saving', 'VIKING Life-Saving Equipment', 'VIKING Life-Saving Equipment is a privately held Danish company founded in 1960 and headquartered in Esbjerg. It makes and services liferafts, lifeboats, evacuation systems, lifejackets and firefighting equipment for shipping and offshore.', 'https://www.viking-life.com/about/about-viking/'),
    (r'\bjotun', 'Jotun', 'Jotun is a Norwegian paints and coatings company founded in 1926 and headquartered in Sandefjord. Marine coatings for hulls, tanks and decks are one of its four segments, alongside protective, powder and decorative paints.', 'https://www.jotun.com/in-en/about-jotun/our-history'),
    (r'\bdesmi', 'DESMI', 'DESMI is a Danish pump manufacturer founded in 1834, with its head office in Nørresundby. It makes pumps and pumping systems for ships and industry, ballast water management systems and oil spill response equipment.', 'https://www.desmi.com/about-desmi/history/short-version/'),
    (r'\bfuruno', 'Furuno', 'Furuno Electric is a Japanese marine electronics maker headquartered in Nishinomiya. It brought the first practical fish finder to market in 1948 and today makes radar, navigation and communication equipment for commercial and fishing vessels.', 'https://furuno.co.jp/en/corporate/history'),
    (r'survitec', 'Survitec', 'Survitec is a British survival technology group. It makes and services liferafts, marine evacuation systems, lifejackets, immersion suits and fire systems for the maritime, defence, energy and aerospace sectors.', 'https://survitecgroup.com/about-us/'),
    (r'\bdamen\b', 'Damen', 'Damen Shipyards Group is a family-owned Dutch shipbuilder founded in 1927 and headquartered in Gorinchem. It builds workboats, naval and commercial vessels to standard designs and runs ship repair yards in several countries.', 'https://damen.com/about'),
]


# ---------- Fourth batch: the Baltic Exchange and its dry index ----------
SRC = lambda *links: '<p class="fine">Sources, read 22 November 2026: ' + ', '.join(f'<a href="{u}" rel="nofollow noopener">{t}</a>' for t, u in links) + '. FindAVessel is not affiliated with the Baltic Exchange and publishes no Baltic data.</p>'
GUIDES += [
    dict(slug='baltic-exchange', title='The Baltic Exchange explained: what it does and who its members are', h1='The Baltic Exchange',
        desc='The Baltic Exchange is a London membership body that publishes daily freight rate benchmarks and sets a code of conduct for shipbrokers. It is not a place to find a ship.',
        stand='The Baltic Exchange is a London membership organisation for the shipping markets. It publishes daily freight rate benchmarks and holds its members to a code of conduct. It is not a marketplace: you cannot post a cargo or find a ship there.',
        fig=fig_steps(['Panel brokers|Report what they see', 'The Exchange|Checks and averages', 'Benchmarks|Published each day', 'Contracts|Settled against them'], 'How a Baltic benchmark is made: panel brokers report, the Exchange averages, the figure is published and contracts settle on it'),
        cap='How a benchmark is made. The figures come from shipbrokers’ assessments, not from a trading screen.',
        body='''<div class="keyfact"><p><strong>In one line:</strong> the Baltic tells the market what freight costs today and vouches for who its members are. Deals are still made between brokers, by phone and message.</p></div>
<h2>What it does</h2><ul><li><strong>Benchmarks.</strong> Daily assessments of what it costs to hire standard ships on standard routes, for dry bulk, tankers, gas and containers. The best known is the <a href="baltic-dry-index.html">Baltic Dry Index</a>.</li><li><strong>A code of conduct.</strong> Members sign up to the Baltic Code, summed up in the motto "our word our bond". A member who breaks it can be named to the rest of the membership.</li><li><strong>Dispute help.</strong> A free service for members to recover unpaid freight, demurrage and commission.</li><li><strong>Escrow.</strong> Holding money for ship sales and for security payments under a charter.</li><li><strong>Training and events.</strong> Courses, seminars and a great deal of networking.</li></ul>
<h2>Who the members are</h2><p>Mostly companies already established in bulk shipping: <a href="what-does-a-shipbroker-do.html">shipbrokers</a>, freight derivative brokers, shipowners, trading houses and large cargo interests such as oil companies, grain houses and miners. Around them sit lawyers, arbitrators, insurers and financiers. Published counts vary with what is being counted, from about 650 member companies to more than 3,000 members.</p>
<h2>How you join</h2><p>A company applies, names two existing members as referees and pays a yearly subscription set by how many of its staff use the services. Fees are quoted on request. For a newcomer with no track record the referees are the hard part.</p>
<h2>What it does not do</h2><ul><li>It does not list cargoes or open ships.</li><li>It does not match a charterer with an owner.</li><li>It does not fix ships or draw up <a href="charter-party.html">charter parties</a>.</li></ul><p>The trading floor closed long ago. The name survives from the Virginia and Baltick coffee house, where merchants in the Baltic trade once met.</p>
<h2>Why it still matters to a newcomer</h2><p>Some charterers will only take offers from Baltic members, and the benchmarks are the reference point in most freight negotiations. Knowing roughly where the published rate stands tells you whether an offer is reasonable. The Exchange has been owned by Singapore Exchange since 2016.</p>''' + SRC(('Baltic Exchange: who we are', 'https://balticexchange.com/en/who-we-are.html'), ('Baltic Exchange FAQs', 'https://www.balticexchange.com/en/who-we-are/faqs.html'), ('membership services', 'https://www.balticexchange.com/en/membership-services.html')),
        rel=['baltic-dry-index', 'what-does-a-shipbroker-do', 'how-to-charter-a-ship', 'worldscale']),
    dict(slug='baltic-dry-index', title='Baltic Dry Index (BDI) explained: what it measures and how it is calculated', h1='Baltic Dry Index',
        desc='The Baltic Dry Index is a daily number that tracks the cost of hiring dry bulk ships. It is built from Capesize, Panamax and Supramax time charter rates.',
        stand='The Baltic Dry Index, or BDI, is a single daily number that tracks what it costs to hire a dry bulk ship. It combines time charter rates for three ship sizes: 40% Capesize, 30% Panamax and 30% Supramax.',
        fig=fig_timeline([('Capesize 40%', .4, 'f-accent'), ('Panamax 30%', .3, 'f-done'), ('Supramax 30%', .3, 'f-ok')], [(0, ''), (.4, ''), (.7, ''), (1, '')], 'Bar showing the Baltic Dry Index weights: Capesize 40 percent, Panamax 30 percent, Supramax 30 percent', 'Weights in use since 1 March 2018. Handysize ships have their own index and are not part of the BDI.'),
        cap='The three ship sizes that make up the index, and their weights.',
        body='''<h2>What it measures</h2><p>The daily hire, in US dollars, that standard <a href="capesize.html">Capesize</a>, <a href="panamax.html">Panamax</a> and <a href="supramax.html">Supramax</a> bulk carriers are earning on the main routes for iron ore, coal and grain. The three averages are weighted, added together and scaled into an index number.</p>
<h2>Where the numbers come from</h2><p>Each working day a panel of shipbrokers tells the <a href="baltic-exchange.html">Baltic Exchange</a> what they judge the rate to be on each route. The Exchange averages their assessments. These are informed judgements, based on fixtures and negotiations the brokers have seen, and not a record of trades.</p>
<h2>Why people watch it</h2><ul><li><strong>Owners and charterers</strong> use the underlying route rates as the starting point for a negotiation.</li><li><strong>Some contracts</strong> set hire by reference to an index and not at a fixed rate.</li><li><strong>Freight derivatives</strong> are settled against the route averages.</li><li><strong>Economists and investors</strong> read it as a rough signal of demand for raw materials.</li></ul>
<h2>What it does not tell you</h2><ul><li>Nothing about tankers, container ships or gas carriers, which have separate indices.</li><li>Nothing about <a href="handysize.html">Handysize</a> ships, which were taken out of the BDI in 2018.</li><li>Not the price of your voyage. It is an index, and your route, dates and cargo will differ from the standard ones.</li><li>Not demand alone. The index also moves with the supply of ships, port congestion and fuel prices, so a rise is not always good news for trade.</li></ul>
<h2>History in brief</h2><p>The first daily index, the Baltic Freight Index, was published in January 1985. It became the Baltic Dry Index in 1999. From 2009 it weighted four ship sizes equally, and since March 2018 it has used the three shown above.</p>
<h2>Where to see it</h2><p>The data belongs to the Baltic Exchange and is licensed. Members and subscribers get it directly, and financial news services report the headline figure each day. This site does not publish it.</p>
<p>To turn a freight rate into a daily earning you can compare with a time charter rate, use the <a href="voyage-estimator.html">voyage estimator</a>.</p>''' + SRC(('Baltic Exchange dry indices', 'https://balticexchange.com/en/data-services/market-information0/indices.html'), ('Baltic Exchange circular 51/17', 'https://www.balticexchange.com/en/data-services/Circulars/market-announcements-/category-a/2017/circular-51-17-bdi.html'), ('Wikipedia: Baltic Dry Index', 'https://en.wikipedia.org/wiki/Baltic_Dry_Index')),
        rel=['baltic-exchange', 'ship-sizes', 'voyage-estimator', 'voyage-charter-vs-time-charter']),
]

# ---------- Fifth batch: due diligence and trade terms ----------
GUIDES += [
    dict(slug='shadow-fleet', title='Shadow fleet explained: what a dark fleet tanker is and how to avoid one', h1='The shadow fleet',
        desc='The shadow fleet, or dark fleet, is the group of ships that carry sanctioned cargoes while hiding who owns them and where they have been. The warning signs and the checks to make.',
        stand='The shadow fleet, also called the dark fleet, is the loose group of ships, mostly older tankers, that carry sanctioned oil and other restricted cargoes while concealing their ownership, their movements or both.',
        fig=fig_steps(['Identity|IMO number and name history', 'Ownership|Who really controls it', 'Flag and class|Recent changes', 'Insurance|A recognised P&I club', 'Movements|Gaps and transfers at sea'], 'Five things to check on a ship before chartering it'),
        cap='Five checks, in the order they are usually made. A problem at any one is a reason to stop and ask.',
        body='''<div class="keyfact"><p><strong>Why it matters to you:</strong> chartering, loading or supplying one of these ships can breach sanctions, void your insurance and get later cargoes refused, even if you did not know.</p></div>
<h2>How these ships operate</h2><ul><li><strong>Opaque ownership.</strong> Single-ship companies in places that publish little, changed often.</li><li><strong>Flag hopping.</strong> Frequent moves between registries, sometimes to flags that do not exist or did not agree to register the ship.</li><li><strong>Going dark.</strong> Switching off the AIS transponder, or transmitting a false position, around loading.</li><li><strong>Ship-to-ship transfers.</strong> Moving cargo between tankers at sea to blur where it came from.</li><li><strong>Weak insurance and class.</strong> Cover from insurers outside the <a href="p-and-i-club.html">International Group of P&amp;I Clubs</a>, and class from societies outside the main group, or none.</li><li><strong>Age.</strong> Many are well past the age at which major charterers stop accepting a tanker.</li></ul>
<h2>Warning signs on a ship you are offered</h2><ul><li>The name or flag changed in the past year or two, more than once.</li><li>The registered owner was formed weeks before it bought the ship.</li><li>Nobody will send a certificate of entry from a P&amp;I club you can verify with the club.</li><li>Unexplained gaps of days in its position history, especially near sanctioned ports.</li><li>Recent ship-to-ship transfers in known transfer areas with no commercial explanation.</li><li>A freight rate well below the market for the route.</li></ul>
<h2>What to check, and where</h2><ol><li><strong>Identity.</strong> The IMO number stays with a hull for life. Use it, not the name, to trace former names, flags and owners.</li><li><strong>Sanctions lists.</strong> Search the ship, its owner and its manager on the UK, EU, US and UN lists. Ships are listed by IMO number.</li><li><strong>Flag and class.</strong> Confirm both with the registry and the classification society directly.</li><li><strong>Insurance.</strong> Ask for the certificate of entry and confirm it with the club.</li><li><strong>Movements.</strong> Look at the last several months of positions and port calls from a tracking service.</li></ol>
<h2>What it does not mean</h2><p>An old ship, a small owner or an unfamiliar flag is not proof of anything. Most ships with one of these features are trading lawfully. It is the combination, and a refusal to answer plain questions, that should stop a deal. See the wider checklist in <a href="know-your-vessel.html">know your vessel</a>.</p>
<p class="fine">This is general information, not legal advice. Sanctions rules change often and differ between countries. FindAVessel does not screen ships or companies; you are responsible for your own checks.</p>''',
        rel=['know-your-vessel', 'p-and-i-club', 'how-to-charter-a-ship', 'tanker-chartering']),
    dict(slug='know-your-vessel', title='Know your vessel (KYV): the checks to make before you charter a ship', h1='Know your vessel',
        desc='Know your vessel, or KYV, means checking a ship’s identity, ownership, flag, class, insurance and history before you commit. A plain checklist for charterers.',
        stand='Know your vessel, or KYV, is the due diligence a charterer, trader, bank or supplier carries out on a ship before dealing with it. It is the ship’s counterpart to "know your customer".',
        fig=fig_steps(['Ask|Particulars and certificates', 'Verify|With registry, class and club', 'Screen|Sanctions and history', 'Record|Keep what you found'], 'Four stages of checking a ship: ask, verify, screen, record'),
        cap='Ask for the documents, verify them at source, screen the names, and keep a record of what you did.',
        body='''<h2>What you are trying to establish</h2><ul><li>The ship is the ship it claims to be.</li><li>The party offering it has the right to charter it out.</li><li>It is fit to carry your cargo and will be accepted at your ports.</li><li>Dealing with it will not breach sanctions or void your insurance.</li></ul>
<h2>The checklist</h2>''' + table(['Check', 'What to ask for', 'Verify with'], [
            ['<strong>Identity</strong>', 'IMO number, current and former names', 'The IMO number record and the ship’s registry'],
            ['<strong>Ownership</strong>', 'Registered owner, beneficial owner, commercial and technical managers', 'Company registries; the manager’s own website and contacts'],
            ['<strong>Right to charter</strong>', 'Whether the offeror is the owner or a <a href="disponent-owner.html">disponent owner</a>, and the head charter if so', 'The head owner or the broker chain'],
            ['<strong>Flag</strong>', 'Certificate of registry', 'The flag administration'],
            ['<strong>Class</strong>', 'Class certificate and any conditions of class', 'The classification society'],
            ['<strong>Insurance</strong>', '<a href="p-and-i-club.html">P&amp;I</a> certificate of entry and hull cover', 'The club or insurer'],
            ['<strong>Safety record</strong>', 'Port state control inspections and detentions', 'The public port state control databases'],
            ['<strong>Suitability</strong>', 'Ship’s particulars: <a href="deadweight-tonnage.html">deadweight</a>, draught, gear, tank coatings, last cargoes', 'Your terminal’s limits and your cargo’s needs'],
            ['<strong>Sanctions</strong>', 'Names of ship, owner, managers and recent trading pattern', 'UK, EU, US and UN lists; a tracking service for movements']]) + '''
<h2>For tankers</h2><p>Oil majors and large traders also rely on inspection reports under the industry’s ship inspection programme and on their own vetting departments. A newcomer rarely has access to these, which is one reason to use a broker who does.</p>
<h2>How much is enough</h2><p>Scale the effort to the risk: more for an unknown owner, an old ship, a trade near sanctioned countries or a rate that looks too good. Keep copies of what you were sent and notes of what you verified and when. If something later goes wrong, that record is your evidence that you acted carefully.</p>
<h2>When to walk away</h2><p>When documents cannot be verified at source, when names keep changing, or when straightforward questions are not answered. See the specific warning signs for the <a href="shadow-fleet.html">shadow fleet</a>.</p>
<p class="fine">General information, not legal advice. FindAVessel does not carry out these checks for you.</p>''',
        rel=['shadow-fleet', 'p-and-i-club', 'disponent-owner', 'how-to-charter-a-ship']),
    dict(slug='letter-of-indemnity', title='Letter of indemnity (LOI) in shipping: when it is used and the risks', h1='Letter of indemnity',
        desc='A letter of indemnity is a written promise to make good an owner’s loss if they do something the contract does not require, such as delivering cargo without the original bill of lading.',
        stand='A letter of indemnity, or LOI, is a written promise by one party to compensate another for any loss that follows from doing something outside the normal contract. In shipping it is most often given to an owner who is asked to deliver cargo without the original bill of lading.',
        fig=fig_steps(['Ship arrives|Bills still in the bank', 'Receiver asks|Deliver without bills', 'LOI issued|Charterer promises to indemnify', 'Cargo delivered|Owner carries the risk'], 'How a letter of indemnity is used when a ship arrives before the bills of lading'),
        cap='The usual sequence. The cargo moves faster than the paperwork, and the letter bridges the gap.',
        body='''<div class="keyfact"><p><strong>The point to remember:</strong> an LOI does not remove the owner’s risk. It gives the owner someone to claim from afterwards, which is only as good as that party’s ability to pay.</p></div>
<h2>The three common uses</h2><ul><li><strong>Delivery without the original bill of lading.</strong> On short voyages, and when cargo is sold several times afloat, the ship often arrives before the bills. The owner delivers against an LOI from the charterer.</li><li><strong>Delivery at a different port</strong> from the one named in the bill of lading.</li><li><strong>Both together.</strong></li></ul>
<h2>Why owners are cautious</h2><p>An owner who delivers to the wrong person is liable to the true holder of the bill of lading for the full value of the cargo. Standard <a href="p-and-i-club.html">P&amp;I cover</a> does not respond to that claim, so the owner is relying entirely on the letter.</p>
<h2>What a sound LOI looks like</h2><ul><li>It uses the standard wording recommended by the International Group of P&amp;I Clubs.</li><li>It is signed by a company with real assets, with authority to sign.</li><li>For an unknown or thinly capitalised charterer, it is countersigned by a first-class bank.</li><li>It names the cargo, the bill of lading and the party to whom delivery is to be made.</li></ul>
<h2>Agree it in the charter party</h2><p>Many <a href="charter-party.html">charter parties</a>, tanker forms especially, contain a clause saying the owner will deliver against an LOI in the club wording. If yours does not, the owner can refuse. Raise it during negotiation, not when the ship is at the berth.</p>
<h2>The LOI you should not give or accept</h2><p>A letter offered in exchange for issuing a clean bill of lading for damaged cargo, or a bill with a false date. That is a misstatement to whoever buys the cargo, the letter is generally unenforceable, and insurance will not cover it.</p>
<p class="fine">General information, not legal advice. Take advice before giving or accepting a letter of indemnity.</p>''',
        rel=['charter-party', 'p-and-i-club', 'what-is-demurrage', 'shipping-terms']),
    dict(slug='fob-vs-cif', title='FOB vs CIF: who charters the ship, who pays freight and who bears the risk', h1='FOB vs CIF',
        desc='Under FOB the buyer arranges and pays for the ship. Under CIF and CFR the seller does. What each term means for chartering, freight, insurance and risk.',
        stand='FOB and CIF are trade terms that split cost and risk between the seller and the buyer of goods. The practical difference for shipping is who has to find and pay for the ship: the buyer under FOB, the seller under CIF.',
        fig=fig_matrix(['FOB', 'CFR', 'CIF'], [('Charters the ship', 'COO'), ('Pays the freight', 'COO'), ('Insures the cargo', 'CCO'), ('Loading costs', 'OOO'), ('Discharge costs', 'CCC'), ('Risk during the voyage', 'CCC')], 'Matrix showing whether seller or buyer is responsible for each item under FOB, CFR and CIF', who=('Seller', 'Buyer'), head='Who is responsible'),
        cap='Under all three terms the risk passes to the buyer once the goods are on board at the loading port.',
        body='''<div class="keyfact"><p><strong>In one line:</strong> if you sold CIF or CFR, chartering the ship is your job. If you bought FOB, it is yours.</p></div>
<h2>FOB: free on board</h2><p>The seller delivers the goods on board the ship named by the buyer at the loading port. The buyer charters the ship, pays the freight and insures the cargo. The buyer must get a suitable ship to the port inside the agreed shipment period, so the <a href="laycan.html">laycan</a> in the charter has to match the sale contract.</p>
<h2>CFR: cost and freight</h2><p>The seller charters the ship and pays the freight to the named discharge port. The buyer arranges insurance. Risk still passes to the buyer at loading.</p>
<h2>CIF: cost, insurance and freight</h2><p>As CFR, and the seller also buys cargo insurance for the buyer’s benefit. The rule requires only minimum cover unless the contract says more, so buyers often ask for wider cover in the sale contract.</p>
<h2>What this means when you charter</h2><ul><li><strong>Match the two contracts.</strong> The charter party’s dates, ports, quantity tolerance and loading and discharging rates should mirror the sale contract. A mismatch is where <a href="what-is-demurrage.html">demurrage</a> disputes start.</li><li><strong>Demurrage at the other end.</strong> A CIF seller pays the owner demurrage at the discharge port under the charter, and recovers it from the buyer only if the sale contract says so.</li><li><strong>Who the owner looks to.</strong> The owner’s contract is with whoever chartered the ship, whatever the sale terms say.</li></ul>
<h2>Which is better</h2><p>Neither. Whoever controls the shipping carries its cost and its risk of delay, and can also profit from doing it well. Experienced traders often prefer to control freight. A newcomer may prefer to let the other side arrange it until they understand chartering.</p>
<p class="fine">FOB, CFR and CIF are Incoterms rules published by the International Chamber of Commerce, for sea and inland waterway transport. This is a summary, not the rules themselves; read the current edition for the detail.</p>''',
        rel=['how-to-charter-a-ship', 'laycan', 'what-is-demurrage', 'shipping-terms']),
]

TERMS = [
    ('Address commission', 'A commission, usually a percentage of freight or hire, paid back to the charterer by the owner.', ''),
    ('Ballast voyage', 'A voyage with no cargo on board, made to reach the next loading port.', ''),
    ('Bareboat charter', 'Hiring a ship without crew; the charterer runs it as if it were the owner.', 'bareboat-charter'),
    ('Bill of lading', 'The document issued for cargo loaded on a ship: a receipt, evidence of the contract of carriage and a document of title.', ''),
    ('Bunkers', 'The fuel a ship burns.', ''),
    ('Charter party', 'The contract between shipowner and charterer.', 'charter-party'),
    ('Charterer', 'The party that hires the ship, for a voyage or a period.', ''),
    ('Contract of affreightment', 'An agreement to carry a set quantity of cargo over a period in several shipments, without naming one ship.', ''),
    ('Deadfreight', 'Freight paid on cargo that was booked but not loaded.', ''),
    ('Deadweight tonnage (DWT)', 'The weight a ship can carry: cargo plus fuel, water, stores and crew.', 'deadweight-tonnage'),
    ('Demurrage', 'A daily charge the charterer pays when loading or discharging takes longer than the time allowed.', 'what-is-demurrage'),
    ('Despatch', 'Money the owner pays the charterer for finishing cargo work early.', 'despatch'),
    ('Disponent owner', 'A party that controls a ship under a charter and charters it out again, without owning it.', 'disponent-owner'),
    ('Draught', 'How deep a ship sits in the water. It limits which ports and berths it can use.', ''),
    ('Fixture', 'A concluded charter. A ship is "fixed" when all conditions have been lifted.', ''),
    ('FOB, CFR and CIF', 'Trade terms that decide whether the buyer or the seller arranges and pays for the ship.', 'fob-vs-cif'),
    ('Freight', 'The price paid to carry cargo on a voyage charter.', ''),
    ('Free pratique', 'Permission from the port health authority for a ship to enter and work cargo.', ''),
    ('Geared and gearless', 'A geared ship has its own cranes; a gearless ship relies on shore equipment.', ''),
    ('Hire', 'The daily price paid for a ship on a time charter.', 'voyage-charter-vs-time-charter'),
    ('IMO number', 'A seven-digit number that identifies a ship for its whole life, whatever its name or flag.', 'know-your-vessel'),
    ('Laycan', 'The window of dates within which the ship must arrive ready to load, after which the charterer may cancel.', 'laycan'),
    ('Laytime', 'The time the charterer is allowed for loading and discharging.', 'laytime'),
    ('Letter of indemnity (LOI)', 'A written promise to make good a loss, often given so cargo can be delivered without the original bill of lading.', 'letter-of-indemnity'),
    ('Lumpsum freight', 'A fixed sum for the voyage, whatever quantity is loaded.', ''),
    ('Notice of readiness (NOR)', 'The master’s notice that the ship has arrived and is ready to load or discharge.', 'notice-of-readiness'),
    ('Off-hire', 'A period on a time charter when hire stops because the ship cannot perform, for example after a breakdown.', ''),
    ('P&I club', 'A mutual insurer covering a shipowner’s liabilities to others.', 'p-and-i-club'),
    ('Recap', 'The message that sets out all agreed terms once a deal is concluded.', ''),
    ('Reversible laytime', 'Laytime for loading and discharging added together and used as one allowance.', 'laytime'),
    ('Safe port', 'A port a ship can reach, use and leave without danger that good seamanship cannot avoid. Charterers usually promise to name only safe ports.', ''),
    ('SHINC and SHEX', 'Sundays and holidays included, or excepted, when counting laytime.', 'laytime'),
    ('Shipbroker', 'An intermediary who brings owners and charterers together and negotiates the charter.', 'what-does-a-shipbroker-do'),
    ('Statement of facts', 'The timed record of everything that happened to a ship in port.', 'statement-of-facts'),
    ('Stowage factor', 'The space a tonne of a given cargo occupies, in cubic metres or cubic feet.', ''),
    ('Subjects', 'Conditions that must be lifted before a deal becomes binding, such as "subject stem" or "subject charterer’s management approval".', ''),
    ('Time charter', 'Hiring a ship for a period, paying by the day; the charterer directs where it goes and pays for fuel and ports.', 'voyage-charter-vs-time-charter'),
    ('Time charter equivalent (TCE)', 'What a voyage earns the owner per day after voyage costs.', 'voyage-estimator'),
    ('Voyage charter', 'Hiring a ship to carry one cargo between named ports for a freight.', 'voyage-charter-vs-time-charter'),
    ('Weather working day', 'A day on which cargo work is not stopped by weather; only these count as laytime under that wording.', 'laytime'),
    ('Worldscale', 'The index system used to quote tanker freight.', 'worldscale'),
    ('WWWW', 'Short for four "whether or not" phrases in laytime clauses: whether in berth or not, whether in port or not, whether in free pratique or not, whether customs cleared or not. Together they let notice of readiness be given before the ship reaches the berth.', 'notice-of-readiness'),
]
terms_body = '<h2>How to use this list</h2><p>These are the words that come up in almost every chartering negotiation. Each has a one-line meaning; follow the link where there is a full guide.</p><dl class="terms">' + \
    ''.join(f'<dt id="{re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")}">{e(t)}</dt><dd>{e(d)}' + (f' <a href="{l}.html">Full guide</a>' if l else '') + '</dd>' for t, d, l in sorted(TERMS, key=lambda x: x[0].lower())) + '</dl>' + \
    '<p class="fine">Meanings follow common market usage. The wording of your own charter party decides what a term means in your contract.</p>'
GUIDES += [dict(slug='shipping-terms', title='Shipping terms: a chartering glossary in plain English', h1='Shipping terms',
    desc=f'A plain-English glossary of {len(TERMS)} ship chartering terms: demurrage, laytime, laycan, NOR, WWWW, SHINC, TCE, deadfreight, off-hire and more.',
    stand=f'A glossary of {len(TERMS)} terms used when ships are chartered, each explained in a sentence, with links to fuller guides.',
    fig=fig_steps(['Enquiry|Laycan, quantity', 'Negotiation|Subjects, recap', 'In port|NOR, laytime', 'Settlement|Demurrage, despatch'], 'Where the main chartering terms come up, from enquiry to settlement'),
    cap='Where the terms come up as a charter moves from enquiry to settlement.', body=terms_body,
    rel=['how-to-charter-a-ship', 'charter-party', 'laytime', 'what-is-demurrage'])]

# Register titles first so pages can cross-link
for g in GUIDES:
    PAGES[g['slug']] = (g['h1'], g['stand'].split('. ')[0] + '.', g['fig'])
for k, c in CLASSES.items():
    PAGES[k] = (c['name'], c['stand'].split('. ')[0] + '.', fig_ladder(c['bands'], c['i'], 'm3' if c.get('unit') else 'DWT', f'{c["name"]} size compared with other classes'))
PAGES['ship-sizes'] = ('Ship sizes and classes', 'Every size class of tanker, bulk carrier, gas carrier and container ship.', fig_ladder(BULK, -1, 'DWT', 'Bulk carrier size classes'))
PAGES['laytime-demurrage-calculator'] = ('Laytime and demurrage calculator', 'Work out time allowed, time used and what is owed.', fig_timeline([('Allowed', .6, 'f-done'), ('Over', .4, 'f-accent')], [(0, 'Start'), (.6, 'Expires'), (1, 'End')], 'Laytime bar'))
PAGES['voyage-estimator'] = ('Voyage estimator', 'Turn a freight rate into a daily time charter equivalent.', fig_route('Load port', 'Discharge port', 'Days, fuel and port costs'))

for g in GUIDES:
    article(g['slug'], g['title'], g['desc'], g['h1'], g['stand'], g['fig'], g['cap'], g['body'], g['rel'])

for k, c in CLASSES.items():
    unit = 'DWT'
    body = '<h2>Key facts</h2>' + table(['', c['name']], [[f'<strong>{e(a)}</strong>', e(b)] for a, b in c['facts']]) + c['body'] + \
        f'<h2>{c["name"]} among the other classes</h2>' + table(['Class', 'Capacity (cubic metres)' if c.get('unit') else 'Deadweight (tonnes)'], [[f'<strong>{e(n)}</strong>', (f'Under {b + 1:,}' if not a else f'{a:,} and above' if b > 9e8 else f'{a:,} to {b:,}')] for a, b, n in c['bands']], c['i']) + \
        '<p>Class names are market shorthand, not regulation, and sources differ at the edges. When you list or charter a ship, the measured ' + ('tank capacity' if c.get('unit') else 'deadweight') + ' is what counts. See <a href="ship-sizes.html">all ship sizes</a>.</p>'
    others = [x for x in CLASSES if x != k][:3]
    full = c['full'] if any(ch.isupper() for ch in c['full'][1:]) else c['full'].lower()
    full = '' if full.lower().startswith(c['name'].lower()) else full
    ctitle = next(t for t in ((f'{c["name"]} ({full}): size, capacity and trades' if full else 'x' * 99), f'{c["name"]}: size, ' + ('tank capacity' if c.get('unit') else 'deadweight') + ', cargoes and trades', f'{c["name"]}: size, capacity and trades') if len(t) <= 60)
    article(k, ctitle, c['stand'], f'{c["name"]}: size, capacity and trades', c['stand'],
            PAGES[k][2], f'{c["name"]} against the other size classes of its type, on a logarithmic scale.', body, ['ship-sizes'] + others + ['how-to-charter-a-ship'], crumb='Ship sizes', crumb_href='ship-sizes.html')

# Ship sizes hub with class finder
BANDS_JSON = json.dumps({'Oil or chemical tanker': ['DWT', TANKER], 'Bulk carrier': ['DWT', BULK], 'Container ship': ['TEU', CONTAINER], 'LPG carrier': ['cubic metres', LPG], 'LNG carrier': ['cubic metres', LNG]})
finder = '''<div class="calc"><h3>Find the class</h3><div class="grid"><div class="field"><label for="cf-type">Ship type</label><select id="cf-type"></select></div><div class="field"><label for="cf-size">Size <small id="cf-unit"></small></label><input id="cf-size" type="number" min="1" placeholder="e.g. 58000"></div></div><div class="calc-out"><span class="big" id="cf-out">Enter a size</span><span class="sub" id="cf-range"></span></div></div>'''
finder_js = '<script>(function(){var B=' + BANDS_JSON + ''',t=document.getElementById('cf-type'),s=document.getElementById('cf-size'),o=document.getElementById('cf-out'),r=document.getElementById('cf-range'),u=document.getElementById('cf-unit');
Object.keys(B).forEach(function(k){var op=document.createElement('option');op.textContent=k;t.appendChild(op)});
function go(){var d=B[t.value],v=Number(s.value);u.textContent='in '+d[0];if(!v){o.textContent='Enter a size';r.textContent='';return}
var b=d[1].filter(function(x){return v>=x[0]&&v<=x[1]})[0];o.textContent=b?b[2]:'No class';r.textContent=b?(b[1]>9e8?b[0].toLocaleString()+' '+d[0]+' and above':(b[0]?b[0].toLocaleString():'0')+' to '+b[1].toLocaleString()+' '+d[0]):''}
t.onchange=go;s.oninput=go;go()})();</script>'''
rows = lambda bands, unit: [[(f'<a href="{SLUG_FOR[n]}.html"><strong>{e(n)}</strong></a>' if n in SLUG_FOR and (unit == 'DWT' or n == 'Very large gas carrier') else f'<strong>{e(n)}</strong>'), (f'Under {b + 1:,}' if not a else f'{a:,} and above' if b > 9e8 else f'{a:,} to {b:,}')] for a, b, n in bands]
sizes_body = '<h2>Class finder</h2><p>Pick a ship type and enter its size.</p>' + finder + \
    '<h2>What deadweight tonnage means</h2><p>Deadweight tonnage, or DWT, is the weight a ship can carry when loaded to its summer load line: cargo plus fuel, fresh water, stores and crew. It is not the weight of the ship itself. Tankers and bulk carriers are classed by DWT. Container ships are classed by TEU, the number of twenty-foot containers they hold, and gas carriers by tank volume in cubic metres.</p>' + \
    '<h2>Oil tankers</h2>' + table(['Class', 'Deadweight (tonnes)'], rows(TANKER, 'DWT')) + '<p>Panamax and Aframax tankers with coated tanks, carrying refined products, are called LR1 and LR2. MR stands for medium range.</p>' + \
    '<h2>Bulk carriers</h2>' + table(['Class', 'Deadweight (tonnes)'], rows(BULK, 'DWT')) + '<p>Ships up to Ultramax usually carry their own cranes. Panamax and larger are gearless and rely on shore equipment.</p>' + \
    '<h2>Container ships</h2>' + table(['Class', 'Capacity (TEU)'], rows(CONTAINER, 'TEU')) + \
    '<h2>LPG carriers</h2>' + table(['Class', 'Capacity (cubic metres)'], rows(LPG, 'm3')) + '<h2>LNG carriers</h2>' + table(['Class', 'Capacity (cubic metres)'], rows(LNG, 'm3')) + '<p>See the <a href="lng-carrier.html">LNG carrier</a> page for Q-Flex, Q-Max and how these ships are chartered.</p>' + \
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



# ---------- Chartering by vessel type ----------
TYPES = [
    dict(slug='bulk-carrier-chartering', seg='bulk', name='bulk carrier', h1='Bulk carrier chartering', bands=BULK, unit='DWT',
        stand='Bulk carriers move dry cargo loose in their holds: grain, coal, ore, fertiliser, cement and steel. Here is what they carry, the sizes available and what an owner needs to quote.',
        carry='Grain and oilseeds, coal, iron ore, bauxite, fertilisers, cement and clinker, steel products, sugar, salt, sulphur, petcoke and bagged goods.',
        forms='GENCON for voyages, with NORGRAIN or SYNACOMEX for grain and AMWELSH for coal. NYPE for time charters. Freight is quoted in US dollars per tonne, or per day on time charter.',
        need=['Cargo and its stowage factor', 'Quantity and tolerance, for example 30,000 tonnes 10% more or less', 'Load and discharge ports, and any draught limits', 'Laycan', 'Loading and discharging rates per day, and whether Sundays and holidays count', 'Whether the ship’s own cranes and grabs are needed', 'Any hazards under the IMSBC Code, such as cargoes that may liquefy'],
        links=['handysize', 'supramax', 'panamax', 'capesize']),
    dict(slug='tanker-chartering', seg='tanker', name='tanker', h1='Tanker chartering', bands=TANKER, unit='DWT',
        stand='Tankers carry liquids in bulk: crude oil, refined products, chemicals and vegetable oils. Here is what they carry, the sizes available and what an owner needs to quote.',
        carry='Crude oil and fuel oil on "dirty" tankers. Petrol, diesel, jet fuel and naphtha on "clean" product tankers. Chemicals, methanol, caustic soda and vegetable oils on chemical tankers with coated or stainless steel tanks.',
        forms='ASBATANKVOY, SHELLVOY or BPVOY for voyages; SHELLTIME for time charters. Freight is quoted in <a href="worldscale.html">Worldscale</a> points, as a lump sum or in dollars per tonne.',
        need=['Cargo, grade and specification', 'Quantity and tolerance', 'Load and discharge ports or ranges', 'Laycan', 'Heating requirements, if any', 'Restrictions on the ship’s last three cargoes', 'Vetting requirements: recent inspections and terminal acceptance'],
        links=['mr-tanker', 'lr1', 'aframax', 'suezmax', 'vlcc']),
    dict(slug='gas-carrier-chartering', seg='gas', name='gas carrier', h1='Gas carrier chartering', bands=LPG, unit='cubic metres',
        stand='Gas carriers move liquefied gases under pressure, refrigeration or both: LPG, ammonia, petrochemical gases and LNG. Here is what they carry, the sizes available and what an owner needs to quote.',
        carry='Propane and butane (LPG), ammonia, ethylene, ethane, propylene and other petrochemical gases, and LNG on dedicated carriers.',
        forms='ASBAGASVOY or GASVOY for voyages; SHELLTIME and SHELLLNGTIME for time charters. LPG freight is quoted in dollars per tonne; LNG carriers are mostly hired by the day.',
        need=['Cargo grade and specification', 'Quantity in tonnes', 'Load and discharge ports', 'Laycan', 'Required condition of the tanks on arrival, for example under vapours of the same cargo', 'Vetting requirements'],
        links=[]),
    dict(slug='container-ship-chartering', seg='container', name='container ship', h1='Container ship chartering', bands=CONTAINER, unit='TEU',
        stand='Whole container ships are chartered by liner operators and regional carriers, almost always by the day. This is not the same as booking a container on someone else’s service.',
        carry='Containers of every kind, including refrigerated boxes where the ship has reefer plugs. The charterer runs the service and fills the ship.',
        forms='NYPE or BOXTIME time charters, for periods from a few months to several years. Hire is quoted in US dollars per day.',
        need=['Capacity needed in TEU, and at 14 tonnes per container', 'Number of reefer plugs', 'Whether cranes are needed for ports without gantries', 'Speed and fuel consumption required', 'Delivery and redelivery places and dates', 'The intended service or trading area'],
        links=[]),
    dict(slug='multipurpose-ship-chartering', seg='mpp', name='multipurpose ship', h1='Multipurpose and heavy-lift ship chartering', bands=None, unit='DWT',
        stand='Multipurpose and heavy-lift ships carry what does not fit a bulk carrier or a container: project cargo, machinery, wind turbine parts, steel, timber and bagged goods.',
        carry='Project cargo and heavy lifts, steel products and pipes, wind turbine components, timber and logs, bagged cargo, vehicles and small bulk parcels.',
        forms='GENCON for general cargo and HEAVYLIFTVOY for heavy lifts; NYPE or BALTIME for time charters. Freight is usually a lump sum, sometimes per tonne or per cubic metre.',
        need=['A packing list: each piece with its weight and dimensions', 'The heaviest and largest single piece', 'Whether cargo may be carried on deck', 'Lifting gear needed, if the ports have none', 'Load and discharge ports', 'Laycan'],
        links=[]),
    dict(slug='car-carrier-chartering', seg='roro', name='vehicle carrier', h1='Vehicle carrier and ro-ro chartering', bands=None, unit='CEU',
        stand='Vehicle carriers and ro-ro ships load cargo on wheels over a ramp: cars, trucks, trailers and heavy machinery. Whole ships are mostly hired on time charter.',
        carry='New and used cars, trucks, buses, trailers, construction and farm machinery, and other rolling or towable cargo.',
        forms='NYPE or BALTIME time charters, with lump-sum voyage charters for single shipments. Capacity is measured in car equivalent units (CEU) and lane metres.',
        need=['The mix of units: how many cars, how many high and heavy', 'The heaviest and tallest unit, for ramp and deck limits', 'Load and discharge ports', 'Dates or period', 'Whether units are new or used, which affects handling and insurance'],
        links=[]),
]
STEPS7 = ['Enquiry|Define the cargo', 'Market|Circulate it', 'Offers|Firm, time-limited', 'Subjects|Conditional deal', 'Fixture|Subjects lifted', 'Voyage|Load and carry', 'Settle|Freight, demurrage']
for t in TYPES:
    PAGES[t['slug']] = (t['h1'], t['stand'].split('. ')[0] + '.', fig_ladder(t['bands'], -1, t['unit'] if t['unit'] != 'cubic metres' else 'm3', t['h1']) if t['bands'] else fig_steps(STEPS7, 'Seven steps from enquiry to settlement'))
for t in TYPES:
    if t['bands']:
        size_rows = [[(f'<a href="{SLUG_FOR[n]}.html"><strong>{e(n)}</strong></a>' if n in SLUG_FOR and (t['unit'] == 'DWT' or n == 'Very large gas carrier') else f'<strong>{e(n)}</strong>'), (f'Under {b + 1:,}' if not a else f'{a:,} and above' if b > 9e8 else f'{a:,} to {b:,}')] for a, b, n in t['bands']]
        size_tbl = '<h2>Sizes</h2>' + table(['Class', f'Size ({t["unit"]})'], size_rows) + '<p>See <a href="ship-sizes.html">all ship sizes</a> and the class finder.</p>'
        cap = 'Size classes by ' + t['unit'] + ', on a logarithmic scale.'
    else:
        size_tbl = '<h2>Sizes</h2><p>There are no settled class names for these ships. What matters is deadweight, hold and deck dimensions, and above all the lifting or ramp capacity.</p>'
        cap = 'The steps every charter follows.'
    body = f'<h2>What a {t["name"]} carries</h2><p>{t["carry"]}</p>' + size_tbl + f'<h2>How they are chartered</h2><p>{t["forms"]} For the difference between the two, see <a href="voyage-charter-vs-time-charter.html">voyage and time charters</a>.</p>' + \
        '<h2>What an owner needs from you to quote</h2><ul>' + ''.join(f'<li>{e(x)}</li>' for x in t['need']) + '</ul><p>An enquiry with all of this can be priced without a phone call. One without it usually goes unanswered.</p>' + \
        f'<div class="row"><a class="btn btn-primary" href="index.html#/enquire?seg={t["seg"]}">Leave a {t["name"]} enquiry</a><a class="btn" href="index.html#/vessels">See vessels listed</a></div>' + \
        '<div class="upsell"><div><strong>Own, manage or broker ' + t['name'] + 's?</strong><span>Register to be sent enquiries that fit your ships.</span></div><a class="btn" href="index.html#/join">Register a fleet</a></div>'
    article(t['slug'], f'{t["h1"]}: cargoes, sizes and how to get a quote', t['stand'], t['h1'], t['stand'], PAGES[t['slug']][2], cap, body,
            ['how-to-charter-a-ship'] + t['links'][:3] + ['ship-sizes', 'what-does-a-shipbroker-do'], cta=False)

# Index pages
def tile(slug, href=None):
    t = PAGES[slug]
    img = f'<img src="{PHOTOS[slug][0]}" alt="" width="1200" height="675" loading="lazy">' if slug in PHOTOS else t[2]
    return f'<a class="tile" href="{href or slug + ".html"}">{img}<div><h3>{e(t[0])}</h3><p>{e(t[1])}</p></div></a>'


def index(slug, title, desc, h1, lede, sections, kind):
    body = f'<section class="page"><div class="page-head"><div><h1>{e(h1)}</h1><p>{lede}</p></div></div>' + ''.join(f'<div class="sec-head"><h2>{e(h)}</h2></div><div class="tiles">{"".join(t)}</div>' for h, t in sections) + '</section>'
    open(f'{slug}.html', 'w').write(shell(slug, title, desc, body, kind))


index('guides', 'Chartering guides for newcomers', 'Plain-language guides to ship chartering: demurrage, laytime, laycan, charter parties, shipbrokers and ship sizes.', 'Guides',
      'Plain-language explanations for people fixing their first ships. No sign-up needed.',
      [('How chartering works', [tile(g['slug']) for g in GUIDES]), ('Chartering by ship type', [tile(t['slug']) for t in TYPES]), ('Ship sizes', [tile('ship-sizes')] + [tile(k) for k in CLASSES]), ('Calculators', [tile('laytime-demurrage-calculator'), tile('voyage-estimator')])], 'guides')
PAGES['paste'] = ('Paste an enquiry', 'Paste a cargo order as you would email it and the listing form fills itself. Inside the platform.', fig_chain([('Email text', 'Free wording'), ('Parser', 'Picks out terms'), ('Listing form', 'You check it')], ['reads', 'fills'], 'Text to form'))
index('tools', 'Free chartering calculators and tools', 'Free tools for ship chartering: laytime and demurrage calculator, voyage estimator, ship class finder.', 'Tools',
      'Free calculators for the sums that come up on every fixture.',
      [('Calculators', [tile('laytime-demurrage-calculator'), tile('voyage-estimator'), tile('ship-sizes'), tile('paste', 'index.html#/post/cargo')])], 'tools')

# Ports: a hub with the world map and one page per country (data from build_map.js)
port_slugs = []
MD = None
if os.path.exists('mapdata.json'):
    MD = json.load(open('mapdata.json'))
elif os.path.exists('mapdata-1.json'):
    MD = json.load(open('mapdata-1.json'))
    MD['countries'].update(json.load(open('mapdata-2.json'))['countries'])
if MD:
    CS = sorted(MD['countries'].values(), key=lambda c: c['name'])
    RESTRICTED = {'IR': 'Iran', 'KP': 'North Korea', 'SY': 'Syria'}
    CAUTION = {'RU', 'BY', 'CU', 'VE', 'MM', 'SD', 'LY', 'YE'}
    UPSELL = '<div class="upsell"><div><strong>Own, manage or broker ships?</strong><span>Register to be sent enquiries for these ports that fit your vessels.</span></div><a class="btn" href="index.html#/join">Register a fleet</a></div>'
    SOURCE = '<p class="fine">Port names, codes and positions come from the open sea-ports dataset and country shapes from Natural Earth. The list covers commercial seaports and some inland terminals; it is not complete, positions are approximate and none of it is for navigation. Draught limits and berth details are not included yet.</p>'
    pos = lambda p: f'{abs(p["lat"]):.2f}°{"N" if p["lat"] >= 0 else "S"}, {abs(p["lon"]):.2f}°{"E" if p["lon"] >= 0 else "W"}'
    from urllib.parse import quote
    for c in CS:
        n, slug, ports = c['name'], 'ports-' + c['slug'], c['ports']
        blocked = c['cc'] in RESTRICTED
        rows = ''.join(f'<tr><td><strong>{e(p["n"])}</strong></td><td>{e(p["u"])}</td><td>{e(p["prov"])}</td><td>{pos(p)}</td>' + ('' if blocked else f'<td class="acts"><a href="index.html#/enquire?load={quote(p["n"])}">Ship from</a><a href="index.html#/enquire?disch={quote(p["n"])}">Ship to</a></td>') + '</tr>' for p in ports)
        notice = '<div class="notice"><p><strong>Sanctions.</strong> Trade with this country is heavily restricted under UK, EU, US and UN measures. FindAVessel does not accept enquiries for its ports. The list is shown for reference only.</p></div>' if blocked else \
            '<div class="notice"><p><strong>Sanctions.</strong> Some trade with this country is restricted under UK, EU, US or UN measures. Every enquiry is screened and may be declined.</p></div>' if c['cc'] in CAUTION else ''
        count = f'{len(ports)} {"port" if len(ports) == 1 else "ports"}'
        body = f'''<article class="article wide-article">
<p class="crumbs"><a href="ports.html">Ports</a> / {e(n)}</p>
<h1>Ports in {e(n)}</h1>
<p class="standfirst">{count} in {e(n)}, with UN/LOCODE and position. Choose one as the loading or discharging port to start a shipping enquiry.</p>
<figure>{c['svg']}<figcaption>{e(n)} and its listed ports. Hover a marker for the name.</figcaption></figure>
{notice}
<h2>Port list</h2>
<div class="tbl"><table><thead><tr><th>Port</th><th>UN/LOCODE</th><th>Region</th><th>Position</th>{'' if blocked else '<th>Start an enquiry</th>'}</tr></thead><tbody>{rows}</tbody></table></div>
{SOURCE}
{'' if blocked else UPSELL}
{f'<h2>Ship suppliers and services in {e(n)}</h2><p>Need stores, spares or repairs during a port call? See the <a href="suppliers-{c["slug"]}.html">{SUP_COUNT[c["slug"]]:,} marine suppliers listed in {e(n)}</a> and request a quote.</p>' if c['slug'] in SUP_CSLUGS else ''}
<h2>Chartering a ship to or from {e(n)}</h2>
<p>A whole-ship charter needs the cargo, the quantity, both ports and a window of loading dates. With those an owner can price the voyage. If this is your first, read <a href="how-to-charter-a-ship.html">how to charter a ship</a>, check which <a href="ship-sizes.html">size of ship</a> the cargo needs, and look up the terms you will meet: <a href="laycan.html">laycan</a>, <a href="laytime.html">laytime</a> and <a href="what-is-demurrage.html">demurrage</a>.</p>
{'' if blocked else '<div class="row"><a class="btn btn-primary" href="index.html#/enquire">Leave an enquiry</a><a class="btn" href="index.html#/cargoes">See the enquiry board</a></div>'}
<div class="related"><h2>Keep reading</h2><ul><li><a href="ports.html">All countries</a></li><li><a href="how-to-charter-a-ship.html">How to charter a ship</a></li><li><a href="ship-sizes.html">Ship sizes and classes</a></li><li><a href="tools.html">Calculators</a></li></ul></div>
</article>'''
        open(f'{slug}.html', 'w').write(shell(slug, f'Ports in {n}: {count} with UN/LOCODE', f'List of {count} in {n} with UN/LOCODE and position. Start a ship chartering enquiry from or to any of them.', body, 'ports'))
        port_slugs.append(slug)
    clist = ''.join(f'<li><a href="ports-{c["slug"]}.html">{e(c["name"])}</a><span>{len(c["ports"])}</span></li>' for c in CS)
    hub = f'''<section class="page"><div class="page-head"><div><h1>Ports of the world by country</h1><p>{MD["total"]:,} ports in {len(CS)} countries. Choose a country on the map or in the list to see its ports and start an enquiry.</p></div><a class="btn btn-primary" href="index.html#/enquire">Leave an enquiry</a></div>
<figure>{MD["world"]}<figcaption>Each dot is a listed port. Shaded countries have port pages.</figcaption></figure>
{UPSELL}
<div class="sec-head"><h2>Countries A to Z</h2></div><ul class="countries">{clist}</ul>
{photo('ports', True)}
{SOURCE}</section>'''
    open('ports.html', 'w').write(shell('ports', 'Ports of the world by country', f'World map and list of {MD["total"]:,} seaports in {len(CS)} countries, with UN/LOCODE and position. Start a ship chartering enquiry from any port.', hub, 'ports'))
    port_slugs.insert(0, 'ports')
    print('ports pages', len(port_slugs))

if not port_slugs:
    port_slugs = sorted(f[:-5] for f in glob.glob('ports*.html'))
PORT_SLUGS = set(port_slugs)

# ---------- Supplier directory (data from providers.json; no contact details are stored in it) ----------
sup_slugs = []
if PD:
    import re as _re
    CATL = dict(PD['cats'])
    BLOCKED = {'IR', 'KP', 'SY'}
    by_cc, by_cat = {}, {}
    for p in PD['providers']:
        by_cc.setdefault(p[3], []).append(p)
        for c in p[4]:
            by_cat.setdefault(c, []).append(p)
    NPROV = len(PD['providers'])
    rebase = lambda h: _re.sub(r'(href|src)="(?!https?:|#|data:|mailto:|/)', r'\1="../', h)
    SUP_UPSELL = '<div class="upsell"><div><strong>Looking for a ship, not a supplier?</strong><span>Leave a chartering enquiry, or list your own vessels to be matched with cargoes.</span></div><span class="row"><a class="btn" href="index.html#/enquire">Leave an enquiry</a><a class="btn" href="index.html#/post/vessel">List a vessel</a></span></div>'
    SUP_SOURCE = '<p class="fine">Listings are unclaimed unless marked otherwise. Names and locations come from a public supplier list and have not been confirmed by the companies. Service groups are suggested from the company name. FindAVessel is not affiliated with the companies listed. A company can correct or remove its listing by claiming the profile.</p>'
    catlinks = lambda cats: ', '.join(f'<a href="suppliers-cat-{c}.html">{e(CATL[c])}</a>' for c in cats)
    os.makedirs('providers', exist_ok=True)

    def req_form(p, cname):
        return f'''<form class="calc" data-request-form data-slug="{p[0]}" data-name="{e(p[1])}">
<h3>Request a quote from {e(p[1])}</h3>
<div class="grid">
<div class="field wide"><label for="rq-need">What do you need?</label><textarea id="rq-need" name="need" rows="3" required placeholder="Items or service, quantities, part numbers, makes and models"></textarea></div>
<div class="field"><label for="rq-port">Port where it is needed <small>optional</small></label><input id="rq-port" name="port" placeholder="{e(p[2] or cname)}"></div>
<div class="field"><label for="rq-date">Needed by <small>optional</small></label><input id="rq-date" name="date" type="date"></div>
<div class="field"><label for="rq-vessel">Vessel name or IMO number <small>optional</small></label><input id="rq-vessel" name="vessel"></div>
<div class="field"><label for="rq-company">Your company</label><input id="rq-company" name="company" required></div>
<div class="field"><label for="rq-name">Your name</label><input id="rq-name" name="name" required></div>
<div class="field"><label for="rq-email">Work email</label><input id="rq-email" name="email" type="email" required></div>
</div>
<button class="btn btn-primary">Send request</button>
<p class="fine">Your request goes to the supplier by email from FindAVessel. Their address is not shown to you and yours is shared only with them.</p>
</form>'''

    for p in PD['providers']:
        s, name, city, cc, cats = p
        cname, cslug = PD['countries'][cc]
        where = f'{city}, {cname}' if city else cname
        peers = [q for q in by_cc[cc] if q is not p and (not city or q[2] == city)][:8] or [q for q in by_cc[cc] if q is not p][:8]
        peer_html = ''.join(f'<li><a href="providers/{q[0]}.html">{e(q[1])}</a></li>' for q in peers)
        ports_link = f'<a href="ports-{cslug}.html">Ports in {e(cname)}</a>' if f'ports-{cslug}' in PORT_SLUGS else ''
        blocked = cc in BLOCKED
        br = next((b for b in BRANDS if re.search(b[0], name, re.I)), None)
        about = f'<h2>About {e(br[1])}</h2><p>{e(br[2])}</p><p class="fine">This describes the wider group whose name this listing carries. The company listed here may be a branch, a subsidiary or an independent agent. Source: <a href="{br[3]}" rel="nofollow noopener">{e(br[3].split("/")[2])}</a>, read 22 November 2026.</p>' if br else ''
        form = '<div class="notice"><p><strong>Sanctions.</strong> Trade with this country is heavily restricted under UK, EU, US and UN measures. FindAVessel does not pass requests to suppliers there.</p></div>' if blocked else req_form(p, cname)
        body = f'''<article class="article">
<p class="crumbs"><a href="suppliers.html">Suppliers</a> / <a href="suppliers-{cslug}.html">{e(cname)}</a> / {e(name)}</p>
<h1>{e(name)}</h1>
<p class="standfirst">{e(name)} is listed as a marine supplier in {e(where)}. Send a request through FindAVessel and the company is notified by email.</p>
{table(['', ''], [['<strong>Location</strong>', e(where)], ['<strong>Service group</strong>', catlinks(cats) + ' <span class="sub">Suggested from the company name</span>'], ['<strong>Listing</strong>', 'Unclaimed. Not yet confirmed by the company.'], ['<strong>Nearby</strong>', f'<a href="suppliers-{cslug}.html">{len(by_cc[cc]):,} suppliers in {e(cname)}</a>' + (', ' + ports_link if ports_link else '')]])}
{about}
{form}
<div class="article-cta"><h2>Is this your company?</h2><p>Claim this profile to confirm your details, list the services and ports you cover, and answer requests directly. It is free.</p>
<a class="btn" href="index.html#/join?claim={s}&amp;name={quote(name)}&amp;country={quote(cname)}">Claim this profile</a></div>
<h2>Other marine suppliers in {e(city or cname)}</h2><ul>{peer_html}</ul>
{SUP_UPSELL}
<figure class="photo"><img src="photo-port.jpg" alt="A cargo port at dusk with ships alongside under cranes" width="1200" height="675" loading="lazy"><figcaption>Photo: iStock.</figcaption></figure>
{SUP_SOURCE}
</article>'''
        svc = 'Marine supplier' if cats[0] == 'general' or CATL[cats[0]].lower().startswith('general') else CATL[cats[0]]
        # Title formula: company name first, then service and place; fall back to shorter forms until it fits 60 characters.
        short = svc.split(',')[0].split(' and ')[0]
        place = cname if city and (city.lower() in name.lower() or city == cname) else where
        title = next((t for t in (f'{name}: {svc} in {place}', f'{name}: {short} in {place}', f'{name}: {svc}, {cname}', f'{name}: {short}, {cname}',
                                  f'{name}: {short}', f'{name}, {place}', f'{name}, {cname}') if len(t) <= 60), name)
        desc = next((d for d in (
            f'Request a quote from {name}, {svc.lower()} in {where}. Send your requirement through FindAVessel and the company is notified by email.',
            f'Request a quote from {name}, {svc.lower()} in {where}, through FindAVessel. The company is notified by email.',
            f'Request a quote from {name} in {where} through FindAVessel.') if len(d) <= 155), f'Request a quote from {name} through FindAVessel.')
        org = {'@type': 'Organization', '@id': url('providers/' + s) + '#company', 'name': name,
               'address': dict({'@type': 'PostalAddress', 'addressCountry': cname}, **({'addressLocality': city} if city else {})),
               'knowsAbout': [CATL[c] for c in cats]}
        html_out = shell('providers/' + s, title, desc, body, 'suppliers', scripts=f'<script src="request.js?v={VER}"></script>', name=name,
                         crumbs=[('Suppliers', 'suppliers'), (cname, f'suppliers-{cslug}')], ld_extra=[org],
                         robots='noindex, follow' if blocked else ROBOTS)
        open(f'providers/{s}.html', 'w').write(rebase(html_out))

    FILTER_JS = '''<script>(function(){var q=document.getElementById('sf'),c=document.getElementById('sc'),rows=[].slice.call(document.querySelectorAll('#st tbody tr')),n=document.getElementById('sn');
function go(){var t=q.value.toLowerCase(),k=c.value,shown=0;rows.forEach(function(r){var ok=(!t||r.textContent.toLowerCase().indexOf(t)>=0)&&(!k||(' '+r.getAttribute('data-c')+' ').indexOf(' '+k+' ')>=0);r.hidden=!ok;if(ok)shown++});n.textContent=shown.toLocaleString()+' shown'}
if(location.hash.length>1){c.value=location.hash.slice(1)}q.oninput=go;c.onchange=go;go()})();</script>'''
    for cc, plist in sorted(by_cc.items(), key=lambda kv: PD['countries'][kv[0]][0]):
        cname, cslug = PD['countries'][cc]
        plist = sorted(plist, key=lambda p: p[1].lower())
        present = [k for k, _ in PD['cats'] if any(k in p[4] for p in plist)]
        rows_html = ''.join(f'<tr data-c="{" ".join(p[4])}"><td><a href="providers/{p[0]}.html"><strong>{e(p[1])}</strong></a></td><td>{e(p[2])}</td><td>{e(", ".join(CATL[c] for c in p[4]))}</td></tr>' for p in plist)
        ports_link = f' See also <a href="ports-{cslug}.html">ports in {e(cname)}</a>.' if f'ports-{cslug}' in PORT_SLUGS else ''
        n = len(plist)
        body = f'''<section class="page"><p class="crumbs"><a href="suppliers.html">Suppliers</a> / {e(cname)}</p>
<div class="page-head"><div><h1>Marine suppliers in {e(cname)}</h1><p>{n:,} ship {"supplier" if n == 1 else "suppliers"} and service {"company" if n == 1 else "companies"} in {e(cname)}. Open a profile to request a quote.{ports_link}</p></div></div>
<div class="filters"><label><span>Search this list</span><input id="sf" type="search" placeholder="Company or city"></label><label><span>Service group</span><select id="sc"><option value="">All</option>{"".join(f'<option value="{k}">{e(CATL[k])}</option>' for k in present)}</select></label><span class="fine" id="sn"></span></div>
<div class="tbl"><table id="st"><thead><tr><th>Company</th><th>City</th><th>Service group</th></tr></thead><tbody>{rows_html}</tbody></table></div>
{SUP_UPSELL}{SUP_SOURCE}</section>'''
        open(f'suppliers-{cslug}.html', 'w').write(shell(f'suppliers-{cslug}', f'Marine suppliers in {cname}: {n:,} ship suppliers and services', f'Directory of {n:,} marine suppliers and ship service companies in {cname}. Request a quote from any of them.', body, 'suppliers', scripts=FILTER_JS))
        sup_slugs.append(f'suppliers-{cslug}')

    for k, label in PD['cats']:
        plist = by_cat.get(k, [])
        cnt = collections.Counter(p[3] for p in plist)
        rows_c = [[f'<a href="suppliers-{PD["countries"][cc][1]}.html#{k}"><strong>{e(PD["countries"][cc][0])}</strong></a>', f'{n:,}'] for cc, n in cnt.most_common()]
        body = f'''<section class="page narrow"><p class="crumbs"><a href="suppliers.html">Suppliers</a> / {e(label)}</p>
<div class="page-head"><div><h1>{e(label)}</h1><p>{len(plist):,} companies in {len(cnt)} countries. Choose a country to see them.</p></div></div>
{table(['Country', 'Companies'], rows_c)}{SUP_UPSELL}{SUP_SOURCE}</section>'''
        open(f'suppliers-cat-{k}.html', 'w').write(shell(f'suppliers-cat-{k}', f'{label}: marine suppliers by country', f'{len(plist):,} marine suppliers for {label.lower()} in {len(cnt)} countries. Request a quote through FindAVessel.', body, 'suppliers'))
        sup_slugs.append(f'suppliers-cat-{k}')

    json.dump([[p[1], p[0], p[2], PD['countries'][p[3]][0]] for p in PD['providers']], open('suppliers-index.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    open('suppliers-data.js', 'w').write('/* Generated by build_pages.py. Country page slug -> number of suppliers. */\nconst SUPPLIER_COUNTRIES = ' + json.dumps({PD['countries'][cc][1]: len(v) for cc, v in by_cc.items()}) + ';\n')
    clist = ''.join(f'<li><a href="suppliers-{PD["countries"][cc][1]}.html">{e(PD["countries"][cc][0])}</a><span>{len(v):,}</span></li>' for cc, v in sorted(by_cc.items(), key=lambda kv: PD['countries'][kv[0]][0]))
    cat_rows = [[f'<a href="suppliers-cat-{k}.html"><strong>{e(l)}</strong></a>', f'{len(by_cat.get(k, [])):,}'] for k, l in PD['cats']]
    SEARCH_JS = '''<script>(function(){var q=document.getElementById('ss'),o=document.getElementById('so'),D=null,busy=false;
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function show(){var t=q.value.trim().toLowerCase();if(t.length<2){o.innerHTML='';return}if(!D){o.innerHTML='<p class="fine">Loading the directory…</p>';return}
var hits=[],i=0;for(;i<D.length&&hits.length<40;i++){var r=D[i];if((r[0]+' '+r[2]+' '+r[3]).toLowerCase().indexOf(t)>=0)hits.push(r)}
o.innerHTML=hits.length?'<div class="list">'+hits.map(function(r){return '<a class="lrow" href="providers/'+r[1]+'.html"><div class="l-main"><strong>'+esc(r[0])+'</strong></div><div class="l-route"><span>'+esc((r[2]?r[2]+', ':'')+r[3])+'</span></div></a>'}).join('')+'</div>':'<p class="fine">No company or place matches that. Try fewer letters.</p>'}
function load(){if(D||busy)return;busy=true;fetch('suppliers-index.json').then(function(r){return r.json()}).then(function(d){D=d;show()}).catch(function(){o.innerHTML='<p class="fine">The directory could not be loaded. Browse by country below.</p>'})}
q.addEventListener('focus',load);q.addEventListener('input',function(){load();show()})})();</script>'''
    hub = f'''<section class="page"><div class="page-head"><div><h1>Marine supplier directory</h1><p>{NPROV:,} ship suppliers and service companies in {len(by_cc)} countries. Find one, send a request, and the company is notified by email.</p></div></div>
<div class="calc"><label for="ss">Search by company, city or country</label><input id="ss" type="search" placeholder="e.g. chandler Singapore, pump Rotterdam" autocomplete="off"><div id="so" style="margin-top:.75rem"></div></div>
{photo('ports', True)}
<div class="sec-head"><h2>How it works</h2></div>
<ol class="steps" style="grid-template-columns:repeat(3,1fr);margin-bottom:2.5rem"><li><h3>Find a supplier</h3><p>Search, or browse by country and service group.</p></li><li><h3>Send a request</h3><p>Say what you need, where and by when. No account needed.</p></li><li><h3>The supplier is notified</h3><p>They get your request by email and can claim their profile to reply and keep it up to date.</p></li></ol>
<div class="upsell"><div><strong>Do you supply or service ships?</strong><span>Find your company and claim the profile, or register a new one. It is free.</span></div><a class="btn" href="index.html#/join?role=supplier">Register as a supplier</a></div>
<div class="sec-head"><h2>By service group</h2></div>{table(['Service group', 'Companies'], cat_rows)}
<p class="fine">Groups are suggested from company names, so two in three companies sit under general marine supplies until they claim their profile and say what they do.</p>
<div class="sec-head" style="margin-top:2rem"><h2>By country</h2></div><ul class="countries">{clist}</ul>
{SUP_UPSELL}{SUP_SOURCE}</section>'''
    open('suppliers.html', 'w').write(shell('suppliers', 'Marine supplier directory: ship suppliers and services by country', f'Directory of {NPROV:,} marine suppliers and ship service companies in {len(by_cc)} countries. Search, then request a quote.', hub, 'suppliers', scripts=SEARCH_JS))
    sup_slugs.insert(0, 'suppliers')
    sup_slugs += ['providers/' + p[0] for p in PD['providers']]
    print('supplier pages', len(sup_slugs))

# ---------- FAQ ----------
FAQ = [
    ('Using FindAVessel', [
        ('What is FindAVessel?', 'FindAVessel is a marketplace for chartering whole ships. Cargo owners post a full shipload, vessel owners and shipbrokers answer with firm offers, and the deal is recorded step by step in one place. It also has a directory of ports and marine suppliers and a set of plain-language chartering guides.'),
        ('Who is it for?', 'Three groups: cargo owners who need a whole ship, vessel owners and managers who want cargo for their ships, and shipbrokers who arrange deals between them. It is built for people who are new to each other, including companies chartering for the first time.'),
        ('Is the site live?', 'Accounts, cargo enquiries, vessel listings and offers are live: what you post is seen by other registered users. A few listings marked "Example listing" are there to show how the boards work and are not real offers. Payment protection, sanctions screening and document checks are not yet connected, so each party must carry out its own checks before committing.'),
        ('What does it cost?', 'Reading the guides, using the calculators, leaving an enquiry and claiming a supplier profile are free. Charges for completed charters have not been set.'),
        ('Can I ship part of a load or a few containers?', 'No. FindAVessel deals only in whole-ship charters: one cargo, or one charterer, taking the entire vessel. For part loads and containers you need a freight forwarder or a liner service.'),
    ]),
    ('Cargo owners', [
        ('How do I charter a ship?', 'Describe the cargo, the quantity, the load and discharge ports and the dates you can load. Owners and brokers reply with firm offers. You negotiate the main terms, agree any conditions, sign a charter party and the ship is then fixed. Our guide to <a href="how-to-charter-a-ship.html">chartering a ship</a> walks through each step.'),
        ('What information does an owner need to quote?', 'The cargo and how it is packed or stowed, the quantity with a tolerance, the load and discharge ports, the dates the cargo is ready (the <a href="laycan.html">laycan</a>), how fast it can be loaded and discharged, and any restrictions at the ports. An enquiry with all of these can be priced without a phone call.'),
        ('Will my company name be shown on the board?', 'Not unless you choose. An enquiry appears with the cargo, quantity, ports and dates, and without the name of the company that posted it. You decide when to reveal who you are to someone who has made an offer.'),
        ('How much does it cost to charter a ship?', 'It depends on the size of ship, the route, the dates and the state of the market. A voyage charter is priced in US dollars per tonne of cargo or as a lump sum; a time charter in US dollars per day. The <a href="voyage-estimator.html">voyage estimator</a> shows how an owner works out the figure.'),
        ('What is demurrage and will I have to pay it?', 'Demurrage is a daily charge you pay the owner if loading or discharging takes longer than the time allowed in the charter. You avoid it by agreeing realistic loading rates and having the cargo and berth ready. See <a href="what-is-demurrage.html">what demurrage is</a> and the <a href="laytime-demurrage-calculator.html">calculator</a>.'),
    ]),
    ('Vessel owners and brokers', [
        ('How do I list a vessel?', 'Create an owner account, enter the ship’s name and IMO number, its type and size, where and when it comes open, and add photographs and the names of the technical and commercial managers. The site checks the IMO number and suggests the size class.'),
        ('What ship types can be listed?', 'Tankers, bulk carriers, gas carriers, container ships, multipurpose and heavy-lift ships, and vehicle carriers. See <a href="ship-sizes.html">ship sizes and classes</a> for the named size bands.'),
        ('Can a shipbroker use the site?', 'Yes. A broker can offer a ship on behalf of an owner or answer for a charterer. The broker states who they act for and the commission, so both sides can see it.'),
        ('How are companies checked?', 'Each company has a passport showing which checks it has passed, such as company registration, ownership of the ship, class and insurance certificates. These checks are not yet carried out for new accounts, which are labelled as unverified until they are.'),
    ]),
    ('Ports and suppliers', [
        ('How do I find ports in a country?', 'Open the <a href="ports.html">ports page</a>, pick a country on the map or in the list, and you get its seaports with their UN/LOCODE. From any port you can start an enquiry with that port as the loading or discharge port.'),
        ('How do I request a service from a marine supplier?', 'Find the company in the <a href="suppliers.html">supplier directory</a>, open its page and fill in the request form: what you need, where and by when. The request goes to the supplier by email from FindAVessel.'),
        ('Why can I not see a supplier’s email address?', 'Supplier email addresses are not published. Requests are passed on by FindAVessel, which keeps the addresses away from scraping and bulk mail. A supplier is emailed only when someone asks for its services.'),
        ('How do I claim or correct my company’s listing?', 'Open your company’s page and choose "Claim this profile". Claiming is free and lets you confirm your details, list the services and ports you cover, or have the listing removed.'),
    ]),
    ('Trust and payment', [
        ('How is payment protected?', 'The design holds freight with an independent escrow or banking partner and releases it at agreed points in the voyage. No such partner is connected yet, so the payment steps shown in a deal are a record only and no money moves through FindAVessel.'),
        ('Which countries are restricted?', 'Enquiries for ports in Iran, North Korea and Syria are refused, and suppliers there cannot be sent requests. Several other countries carry a sanctions notice. This is a cautious default and not legal advice; you remain responsible for your own sanctions checks.'),
        ('Is FindAVessel connected to the Baltic Exchange?', 'No. FindAVessel is independent and publishes no Baltic Exchange data. Our guide explains <a href="baltic-exchange.html">what the Baltic Exchange does</a>.'),
    ]),
]
_strip = lambda h: re.sub(r'<[^>]+>', '', h)
faq_body = '<article class="article"><p class="crumbs"><a href="index.html">Home</a> / Questions and answers</p><h1>Questions and answers</h1><p class="standfirst">How FindAVessel works for cargo owners, vessel owners, brokers and suppliers, and what is and is not live yet.</p>' + \
    ''.join(f'<h2>{e(sec)}</h2>' + ''.join(f'<h3>{e(q)}</h3><p>{a}</p>' for q, a in qa) for sec, qa in FAQ) + \
    '<div class="article-cta"><h2>Still unsure?</h2><p>Leave an enquiry with what you need to move and we will take it from there.</p><div class="row"><a class="btn btn-primary" href="index.html#/enquire">Leave an enquiry</a><a class="btn" href="guides.html">Read the guides</a></div></div></article>'
faq_ld = {'@type': 'FAQPage', '@id': url('faq') + '#faq', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': _strip(a)}} for _, qa in FAQ for q, a in qa]}
open('faq.html', 'w').write(shell('faq', 'Ship chartering questions and answers', 'Answers on chartering a whole ship, listing a vessel, leaving an enquiry, requesting marine suppliers and what is live on FindAVessel today.', faq_body, 'faq', ld_extra=[faq_ld], name='Questions and answers'))
open('404.html', 'w').write(shell('404', 'Page not found', 'That address does not match a page on FindAVessel.', '<article class="article"><h1>Page not found</h1><p class="standfirst">That address does not match anything here.</p><div class="row"><a class="btn btn-primary" href="/">Go to the start</a><a class="btn" href="/guides.html">Guides</a><a class="btn" href="/suppliers.html">Suppliers</a></div></article>', 'none', robots='noindex, follow').replace('href="styles.css', 'href="/styles.css').replace('src="theme.js', 'src="/theme.js').replace('src="quick-enquiry.js', 'src="/quick-enquiry.js').replace('src="analytics.js', 'src="/analytics.js'))

# ---------- Privacy ----------
priv_body = '''<article class="article"><p class="crumbs"><a href="index.html">Home</a> / Privacy</p><h1>Privacy and cookies</h1>
<p class="standfirst">What FindAVessel collects when you use this site, why, and the choices you have.</p>
<h2>What you send us</h2><p>When you send an enquiry, a supplier request or a sign-up, we receive what you type: your name, email address, phone number if you give one, your company and the details of what you need. We use it to answer you and, for a supplier request, to pass your request to that supplier. We do not add you to a mailing list.</p>
<p>The quick enquiry form is delivered to us by email through a form-to-email service, FormSubmit, which processes the message on its way to our inbox.</p>
<h2>Your account</h2><p>Accounts are held with Google Firebase, with the database in the European Union. We store your email address, your name, your company and role, and what you post: cargo enquiries, vessel listings, offers and deal records. Your password is handled by Firebase and we never see it. Cargo enquiries are shown on the board without your company name. Offers and deals are visible only to the parties to them. Your theme choice is kept in your own browser.</p>
<h2>Analytics</h2><p>We use Google Analytics to understand how the site is used: which pages are read, what people search for in the directories, which tools and buttons are used, and whether forms are completed. We record which form fields were filled in, not what was typed in them. Names, email addresses, phone numbers and messages are never sent to Google Analytics.</p>
<p>Analytics cookies are set only if you choose "Allow". If you decline, Google receives anonymous, cookieless counts only. To change your choice, clear this site's data in your browser and the question will be asked again.</p>
<h2>Suppliers listed in the directory</h2><p>Company names and locations in the supplier directory come from a supplier list. Email addresses are not published. A supplier is contacted only when a visitor asks for its services, and can correct or remove its listing by claiming the profile.</p>
<h2>Your rights</h2><p>You can ask for a copy of the personal data we hold about you, or for it to be corrected or deleted. Send the request through the enquiry form on any page and we will reply by email.</p>
<p class="fine">Last updated 22 November 2026.</p></article>'''
open('privacy.html', 'w').write(shell('privacy', 'Privacy and cookies', 'What FindAVessel collects when you send an enquiry or browse the site, how Google Analytics is used, and the choices you have.', priv_body, 'faq', name='Privacy'))

# Sitemap and robots
slugs = ['', 'faq', 'privacy', 'guides', 'tools', 'ship-sizes', 'laytime-demurrage-calculator', 'voyage-estimator'] + [g['slug'] for g in GUIDES] + list(CLASSES) + [t['slug'] for t in TYPES] + port_slugs + sup_slugs
open('sitemap.xml', 'w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{url(s)}</loc><lastmod>{DATE}</lastmod></url>\n' for s in slugs) + '</urlset>\n')
open('robots.txt', 'w').write(f'User-agent: *\nAllow: /\n\nSitemap: {SITE}/sitemap.xml\n')
print('built', len(slugs) - 1, 'pages')
