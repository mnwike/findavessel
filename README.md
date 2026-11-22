# FindAVessel

Prototype of a whole-ship chartering marketplace for cargo owners, vessel owners and brokers.

**Status: clickable prototype.** It runs entirely in the browser with invented sample data. There is no server, no sign-in, no file upload and no payment processing. Nothing shown is a live offer.

## What it demonstrates

- Three account types (cargo owner, vessel owner, broker) plus the platform desk. Switch between them with "Viewing as" in the header.
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

    index.html
    data.js      reference data (vessel classes, ports, terms) and sample records
    core.js      state, helpers, shell, router
    market.js    home, cargo board, matching, offers
    account.js   vessel board, listing forms, sign-up, passport
    deal.js      deals, deal room, payments adapter, desk, guide
    styles.css
    *.woff2      Barlow typeface, self-hosted (SIL Open Font License)

## Known limits

- Distances are great-circle with a routing allowance, not sea routes.
- Vessel class bands are market conventions and vary by source.
- `PaymentProvider` in `deal.js` is a stub marking where a regulated escrow agent or bank would connect.
- Sanctions screening, document checks and verification are simulated.
