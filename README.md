# FindAVessel

Prototype of a whole-ship chartering marketplace for cargo owners, vessel owners and brokers.

**Status: clickable prototype.** It runs entirely in the browser with invented sample data. There is no server, no sign-in, no file upload and no payment processing. Nothing shown is a live offer.

## What it demonstrates

- Three account types (cargo owner, vessel owner, broker) plus the platform desk. Switch between them with "Viewing as" in the header.
- Dark and light themes, following the system setting until the visitor switches.
- Static, indexable guides, ship-size pages and calculators (laytime and demurrage, voyage estimate, class finder).
- Paste an enquiry: free-text cargo orders are parsed into the listing form.
- A world map of 1,591 ports in 185 countries, a page per country, and a guest enquiry form that puts shipments on the board without naming the sender.
- Posting a cargo, with type-specific fields per vessel segment and three visibility modes: open to verified members, shortlist only, sealed tender.
- Listing a vessel, with IMO check-digit validation and a class label suggested from type and size.
- Matching on vessel type, size, steaming time to the load port, age and gear.
- Firm offers with a time limit, counter-offers with changes highlighted, broker mandate and commission disclosure, and an owner's voyage estimate.
- A deal room: generated recap, subjects with deadlines, an escrow-style payment schedule, a shared time log with indicative laytime, documents, messages, disputes and ratings.
- The passport: a per-company verification checklist and level that counterparties can see.

## Running it

Open `index.html`, or serve the folder:

    python3 -m http.server 8000

State is kept in the browser's local storage. "Reset the sample data" in the footer clears it.

## Layout

    index.html          the app (hash-routed, single page)
    data.js             reference data (vessel classes, ports, terms) and sample records
    core.js             state, helpers, shell, router
    market.js           home, cargo board, matching, offers
    account.js          vessel board, listing forms, enquiry parser, sign-up, passport
    deal.js             deals, deal room, payments adapter, desk, in-app guide
    theme.js            dark and light theme, shared by every page
    styles.css          one stylesheet, two themes
    build_map.js        builds ports.js and mapdata.json from the sea-ports and world-atlas npm packages (needs d3-geo, topojson-client, i18n-iso-countries)
    ports.js            generated: port list and world map for the app
    build_pages.py      generates every static page: guides, ship sizes, tools, country port pages and the supplier directory
    mapdata-1.json, mapdata-2.json   country maps and port lists, split in two to stay under the web upload limit
    providers.json      supplier directory data, no contact details
    request.js          supplier request form (prototype: nothing is sent)
    suppliers-data.js   generated: supplier counts per country for the app
    photo-*.jpg         iStock photographs, licensed to the account holder under the standard licence; not for reuse
    *.html (others)     generated: do not edit by hand, edit build_pages.py and re-run it
    sitemap.xml, robots.txt
    geist-latin-wght-normal.woff2   Geist typeface, self-hosted (SIL Open Font License)

Static pages are flat files so GitHub Pages serves them at `/<slug>`. The `barlow-*.woff2` files are left over from the first version and are unused.

## Publishing

`.github/workflows/pages.yml` runs `python3 build_pages.py` on every push to `main` and deploys the result to GitHub Pages. The 19,000 supplier profile pages under `providers/` are generated at that point and are not stored in the repository. Pages source must be set to "GitHub Actions" in the repository settings.

## Supplier directory

`providers.json` holds company name, city, country and suggested service groups for about 19,000 marine suppliers. It contains no email addresses or other contact details, and none must ever be added to this public repository. The mapping from profile to contact address lives outside the repo, for the notification backend. `request.js` records a request in the browser and shows the email that would be sent; nothing is sent.

## Data sources

- Suppliers: a supplier list provided by the site owner. Check the right to republish it before promoting the directory.

- Ports: the `sea-ports` npm package (MIT). Positions are approximate and the list is not complete.
- Country shapes: Natural Earth via `world-atlas` (public domain).

## Known limits

- Distances are great-circle with a routing allowance, not sea routes.
- Vessel class bands are market conventions and vary by source.
- `PaymentProvider` in `deal.js` is a stub marking where a regulated escrow agent or bank would connect.
- Sanctions screening, document checks and verification are simulated.
