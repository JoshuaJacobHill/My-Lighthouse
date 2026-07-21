# Donor & Fundraising Portal — Design Blueprint

**Status:** In build on the `donor-portal` branch (uncommitted). Foundation, Funds/designations, and the embeddable progress widget are built; Stripe payment integration not yet started.
**Last updated:** July 2026
**Author:** Lighthouse Care digital platform team

---

## 1. Purpose

Build a **Donor & Fundraising Portal** as the second application on the Lighthouse Care platform (`my.lighthousecare.org.au`), alongside the existing Volunteer Portal.

It serves two jobs:

**A. Donor-facing portal** — donors can see their own giving history and totals, download tax statements/receipts, manage recurring giving and sponsorships, and discover appeals.

**B. Replace ShoutForGood** — Lighthouse Care has used ShoutForGood as its main donation platform for years, and it is **closing down**. This portal must replace its core functionality:
1. **Event ticketing** — registration + payment, multiple ticket types
2. **Fundraisers** — GoFundMe-style fundraising pages, for our own appeals or for partners raising money on our behalf
3. **Donation designations** — different donation buttons/links so we can track what each gift is for (e.g. general donation page, Christmas Appeal, Good Food Hampers)

It uses the **same login** as the Volunteer Portal — a person can be a volunteer, a donor, or both, behind one account. Donations and payments are powered by **Stripe** (see §4), captured automatically via webhooks, and matched to donor accounts by verified email.

> ⏰ **Time-sensitive:** because ShoutForGood is closing, confirm its **shutdown date** and whether **historical data** (past donations, event records, recurring donors) can be exported before it goes. See §12.

---

## 2. The most important rule: do not disrupt the live Volunteer Portal

The Volunteer Portal is **live and in daily use**. Every part of this plan is **purely additive**:

- ✅ **New** database tables only
- ✅ **New** routes only (`/donor` front end; new sections inside the existing `/admin`)
- ✅ The **only** shared component is the existing `User` / auth layer, which is **extended, never rewritten**
- ❌ **No** changes to existing volunteer tables, volunteer routes, kiosk, or attendance logic
- ❌ **No** changes to the volunteer login or session behaviour

**Build process:** all work happens on a separate branch, tested before merge, and stays hidden from volunteers and the public until launch (see §5).

### Explicitly NOT touched
- `volunteerProfile` and all its relations (availability, shifts, attendance)
- `/volunteer`, `/admin/volunteers`, `/admin/attendance`, `/kiosk` and their actions
- The kiosk sign-in/out flow
- Existing email templates and flows

---

## 3. Architecture: every portal has two sides

This mirrors the Volunteer Portal you already have.

| Side | Who it's for | Where it lives | Gate |
|---|---|---|---|
| **Donor front end** | A donor, seeing *their own* giving | `/donor` (new) | Logged-in donor (see §5) |
| **Fundraising backend** | Staff, managing funds, fundraisers, events, and all transactions | inside `/admin` (new sections) | `ADMIN` / `SUPER_ADMIN` (existing gate) |

**Event ticketing, fundraisers, and donation designations are all managed from the admin backend.** The public interacts with them through donate buttons, fundraiser pages, and event registration pages — but creation and management is staff-only.

---

## 4. Payment provider: Stripe (PayPal as an optional wallet later)

> **Decision (July 2026):** the primary gateway is **Stripe**. CommBank was considered but ruled out — its online gateways (CommWeb/PowerBoard/BPOINT) are closed to new customers while CBA transitions to a new platform with no firm date, and Lighthouse Care holds CommBank EFTPOS in-store only. Stripe is the engine most modern donation suites (Zeffy, Raisely, GiveWP) are built on, and it powers the Zeffy-style feature set we want. The data model stays **provider-neutral** (`provider`, `providerTransactionId`, `providerSubscriptionRef`), now defaulting to `STRIPE`, so **PayPal can be added later as an optional "Pay with PayPal" wallet** at checkout without a migration.

### Why Stripe for a Zeffy-style suite
- **Flexible recurring** — Stripe Billing does weekly / monthly / quarterly / annual, not PayPal's monthly-only.
- **Apple Pay & Google Pay** built in — one-tap for mobile donors.
- **BECS Direct Debit** (bank-to-bank) — cheap recurring giving, well suited to Australian donors.
- **Rich webhooks + metadata** — tag every gift by fund / appeal / fundraiser, the core of our reporting.
- **Clean APIs** — faster to build a custom suite on.

### Integration method: Stripe Checkout (hosted) first, Elements later
- **Stripe Checkout (hosted)** — Stripe hosts the payment fields; card data never touches our servers (minimal PCI burden). Fastest to launch, embeds cleanly on lighthousecare.org.au. **Start here.**
- **Stripe Elements / Payment Element** — our own fully custom form with Stripe-hosted fields. More control; a later refinement.
- **PayPal button** — added as an alternative wallet at checkout in a later phase, for donors who prefer it.

### One pipeline for all money in
Every inbound payment — a donation, a fundraiser gift, or an event ticket order — flows through **Stripe** and is confirmed by the **same webhook handler**, recorded in our database, tagged with its **source** and **fund**, and matched to a donor account by verified email. Each callback is stored in `WebhookEvent` for idempotency + audit. Because we capture everything ourselves, **reporting and receipting are ours** regardless of provider.

### Notes to confirm / action
- **Stripe account + test keys:** create the Stripe account and grab test keys (publishable + secret) and a webhook signing secret — free and instant, so this does **not** block the build the way CommBank did.
- **Nonprofit rate:** apply for Stripe's nonprofit discount with ACNC/DGR details (confirm the exact current AU rate on application). Grab PayPal's confirmed-charity rate too when the PayPal button is added.
- **Recurring giving:** use **Stripe Billing** subscriptions (native) — no stored-card scheduler of our own needed.
- **PCI/security:** hosted Checkout / Elements keeps card data off our servers.
- **Tax deductibility differs by type** (see §10): genuine donations to a DGR are deductible; **event tickets are generally NOT** (the payer receives a benefit). Receipting logic must distinguish them.

### Model the product on Zeffy — not its pricing
Zeffy is our reference for the *feature suite and UX* (funds/designations, fundraisers, events + ticketing, donor accounts, receipting) — and the blueprint already mirrors it. The one thing **not** to copy is Zeffy's "free" pricing: that works only because Zeffy funds itself via donor tips. In a custom build there is no tip prompt; we simply pay Stripe/PayPal processing. Model the product, not the pricing.

---

## 5. Permissions & rollout

### No new "donor" role
Access to the donor front end is **not** a role — it's based on being **logged in** (and, at launch, having giving history / a donor profile). The `UserRole` enum stays unchanged: `VOLUNTEER`, `ADMIN`, `SUPER_ADMIN`, `KIOSK`.

### Two switches gate the donor front end during the build
1. **Feature flag** — `DONOR_PORTAL_ENABLED` (off by default). While off: all donor-portal links are hidden and the `/donor` route shows nothing to the public.
2. **Early-access allow-list** — a small list of accounts (initially just the project lead's email) who can reach `/donor` while the flag is off, to experience the real donor front end as a donor would.

### The fundraising backend during the build
Lives inside `/admin`, behind the **existing** `ADMIN` / `SUPER_ADMIN` gate. Safe by default.

### Public-facing pages (donate buttons, fundraiser pages, event registration)
These are necessarily public at launch. **During the build they stay behind the feature flag** — links unpublished, routes hidden — so nothing is reachable until you're ready. They become live when the flag flips.

### Launch day
- Flip `DONOR_PORTAL_ENABLED` to **on** (a single switch).
- Remove the early-access allow-list.

---

## 6. Data model (new tables only)

All new tables follow existing conventions (`cuid()` IDs, etc.). The shared `User` model is **extended with new relations only** — no existing fields changed.

> ⚠️ Draft for discussion, not final schema.

### Core donor tables

**`DonorProfile`** (one per donor, created on first gift or opt-in)
`id`, `userId` (→ User), `displayName`, `phone?`, `address?`, `consentEmailUpdates`, `createdAt`, `updatedAt`

**`Fund`** (a designation — "where the money goes") — *covers feature #3*
`id`, `name`, `slug`, `description?`, `isActive`, `goalAmount?`, `startsAt?`, `endsAt?`, `sortOrder`, `createdAt`
- Examples: General, Christmas Appeal, Good Food Hampers.
- Each fund yields a donate button/link (e.g. `/donate?fund=good-food-hampers`).
- Reporting rolls up total raised per fund.

**`Fund`** also carries `showPublicProgress` (bool) — gates the embeddable raised/goal widget (see §9).

**`Donation`** (one row per completed gift, from any source)
`id`, `userId?` (null until matched), `donorEmail`, `donorName?`, `amount`, `currency` (default AUD), `provider` (default `STRIPE`), `providerTransactionId` (unique), `fundId` (→ Fund), `fundraiserId?` (→ Fundraiser), `isRecurring`, `sponsorshipId?`, `source` (`DONATE_PAGE` / `FUNDRAISER` / `WORDPRESS_FORM` / `APPEAL_LINK` / `EVENT`), `taxReceiptEligible` (bool), `taxReceiptIssued` (bool), `createdAt`

**`Sponsorship`** (recurring commitment)
`id`, `userId` (→ User), `amount`, `frequency` (`MONTHLY`), `fundId?`, `provider` (default `STRIPE`), `providerSubscriptionRef` (Stripe Billing subscription id), `status` (`ACTIVE`/`CANCELLED`/`PAUSED`), `startedAt`, `cancelledAt?`

### Fundraiser tables — *covers feature #2*

**`Fundraiser`** (a GoFundMe-style page)
`id`, `title`, `slug`, `story` (rich text), `imageUrl?`, `goalAmount?`, `raisedAmount` (cached), `organiserName` (Lighthouse or a partner), `organiserEmail?`, `fundId` (→ Fund the proceeds are allocated to), `startsAt?`, `endsAt?`, `isActive`, `createdAt`, `updatedAt`
- Created and managed by staff in the admin backend (including on behalf of partners).
- Public page shows the story, a progress bar (sum of linked donations), and a donate button.
- Donations carry `fundraiserId` and roll up to both the fundraiser's progress and the fund's total.

### Event ticketing tables — *covers feature #1*

**`Event`**
`id`, `title`, `slug`, `description`, `imageUrl?`, `venue?`, `startsAt`, `endsAt?`, `fundId?` (proceeds allocation), `isPublished`, `capacity?`, `createdAt`, `updatedAt`

**`TicketType`** (one or more per event)
`id`, `eventId` (→ Event), `name` (e.g. "General", "Family", "Free/RSVP"), `price` (0 allowed for free), `quantityAvailable?`, `maxPerOrder?`, `salesStartAt?`, `salesEndAt?`, `sortOrder`

**`TicketOrder`** (one per registration/purchase)
`id`, `userId?` (matched by email), `purchaserName`, `purchaserEmail`, `eventId`, `amountTotal`, `provider` (default `STRIPE`), `providerTransactionId?` (null for free orders), `status` (`CONFIRMED`/`CANCELLED`/`REFUNDED`), `createdAt`

**`Ticket`** (one per individual ticket/attendee)
`id`, `orderId` (→ TicketOrder), `ticketTypeId` (→ TicketType), `attendeeName?`, `reference` (unique code for check-in), `checkedInAt?`

### Plumbing

**`WebhookEvent`** (audit + idempotency)
`id`, `provider` (default `STRIPE`), `eventType`, `providerEventId` (unique), `payload` (json), `processedAt?`, `error?`, `createdAt`
- Prevents double-processing; gives an audit trail for every gateway callback.

---

## 7. Feature detail

### 7.1 Donation designations (feature #3)
- Admin creates **Funds** (designations). No appeal content needs to pre-exist — the *capability* is what's built.
- Each fund produces a **donate button/link** that can be embedded on the WordPress site or shared directly. The button opens a donate page pre-set to that fund.
- Every donation is tagged with its `fundId`, so the admin backend can report **how much has been raised for what** (general, Christmas Appeal, Good Food Hampers, etc.) over any period.

### 7.2 Fundraisers (feature #2)
- Admin creates a **Fundraiser** page: title, story, image, goal, and which **Fund** the proceeds go to. Can be for a Lighthouse appeal **or** set up on behalf of a partner who wants to raise money for us.
- The fundraiser has a **public page** with a progress bar and donate button; the admin shares the link with the partner, who shares it onward.
- Donations to the page are tagged with `fundraiserId`, update the progress bar live, and roll up into the fund's total. They match to donor accounts by email like any other gift.
- **v1 keeps creation admin-only.** Partner self-serve (partners log in and create their own pages) is a possible later enhancement — noted, not built now.

### 7.3 Event ticketing (feature #1)
- Admin creates an **Event** with one or more **TicketTypes** (name, price, quantity, per-order limit). Free/RSVP tickets supported (price 0).
- Public **registration page**: choose ticket types and quantities → Stripe Checkout (skipped for free tickets) → webhook → `TicketOrder` + `Ticket` rows created → **confirmation email** with a reference code per ticket.
- **Capacity is enforced by our app** (don't oversell) using `quantityAvailable` and event `capacity`.
- Admin backend shows the **attendee list** per event, with totals and CSV export.
- **Check-in** (scanning/marking `checkedInAt`) is supported in the data model and is a natural later addition — the kiosk pattern could even be reused. Not required for v1.

---

## 8. Donation-to-account matching flow

The thread tying anonymous transactions to accounts is the **verified email address**.

```
Anonymous gift / ticket purchase (WordPress, fundraiser page, event page)
   → Stripe processes payment
   → Webhook fires → recorded against payer email (userId: null)
   → Follow-up email: "thanks — create an account to track your giving"

Payer creates an account / logs in with that email
   → Email is VERIFIED (existing signup pattern)
   → App links all rows where email matches (sets userId)
   → They now see full history, including pre-account activity
```

**Security:** email verification is non-negotiable — giving history is matched by email, so signup must verify before linking. The Volunteer Portal already does this.

**Edge case:** different emails (gave with one, signed up with another) stay unlinked; the admin backend can manually link a record to a user.

---

## 9. WordPress & post-payment email

**WordPress:** the donate experience is delivered to lighthousecare.org.au as an **embeddable iframe widget** served from this app (`/embed/donate/<fund-slug>`), so donors stay on the main site. The widget shows the live **raised / goal progress bar** and a Donate button, and is toggled per fund by the **"Show public progress"** flag (`Fund.showPublicProgress`) — staff can switch the public total on or off without affecting whether the fund accepts gifts. A small JSON endpoint (`/api/public/funds/<slug>`) is also available for a script-based widget. Framing is restricted (CSP `frame-ancestors`) to the Lighthouse Care domains. Every donate button / fundraiser link / event link still routes through the **same Stripe account and webhook**, so all activity lands in one place.

**Emails:** reuse the **existing Resend integration** and mirror the **guest-volunteer "create an account" nudge** pattern already built. Confirmation emails (donation receipt, ticket confirmation with reference code) and the account-creation nudge all run through Resend in the Lighthouse Care voice.

---

## 10. Tax & receipting

- **Donations** to a DGR are tax-deductible (gift, no material benefit) → `taxReceiptEligible = true`.
- **Event tickets** generally are **NOT** deductible (the payer receives a benefit — attendance) → `taxReceiptEligible = false`. Some events have a deductible component above ticket value; handle case-by-case.
- **Fundraiser donations** are gifts → deductible (to a DGR).
- The portal can issue per-gift receipts and **annual giving statements** for eligible donations — a strong reason for donors to log in.
- **Decision needed:** confirm Lighthouse Care's **DGR status** (determines all of the above).

---

## 11. Analytics & ad tracking

For paid advertising (Google Ads, Meta Ads) and traffic measurement, the public-facing pages get analytics and conversion tracking.

- **Google Analytics 4 (GA4)** and **Meta (Facebook) Pixel** load on the **public** donor/fundraiser/event/donate pages only — **not** on the volunteer portal, and **not** inside the logged-in donor account area (that's a private space, kept free of ad pixels).
- **Conversion events** fire on the thank-you/confirmation page so ad platforms can measure and optimise:
  - GA4: a `purchase` / `donate` event with `value` + `currency`
  - Meta Pixel: a `Purchase` / `Donate` event with `value` + `currency`
  - This is what lets you see return on ad spend (ROAS) for a Christmas Appeal campaign, an event, etc.
- **IDs in env vars** — `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID` — never hard-coded, absent in dev so nothing tracks locally.
- **Server-side conversions (phase 2, recommended):** client-side pixels miss a chunk of conversions (ad blockers, iOS). Firing conversions **from the donation webhook** via GA4 Measurement Protocol and the Meta Conversions API gives far more accurate ad attribution. Phase 1 = client pixels; phase 2 = add server-side from the webhook.
- **Consent:** non-essential tracking respects a consent choice (Australian Privacy Act + good practice). The main WordPress site likely already has a consent/cookie banner — we coordinate so the two don't clash.
- **Scoped:** none of this touches the volunteer portal.

## 12. Suggested build order (phased, low-risk)

1. **Schema (additive):** add new tables + new relations on `User`. `prisma db push` to local **and** production (production via session pooler, port 5432). No existing tables touched.
2. **Feature flag + early-access allow-list:** everything built next is invisible to volunteers/public.
3. **Stripe test mode + webhook + `WebhookEvent`:** one pipeline, idempotent, tested end-to-end with Stripe test keys (free/instant — not blocked like CommBank was).
4. **Funds + donate buttons** (feature #3) — simplest, highest-value first; gives working designated giving.
5. **Donor front end (`/donor`):** giving history, totals, receipts, via early-access account.
6. **Fundraisers** (feature #2): admin create/manage + public page + progress bar.
7. **Event ticketing** (feature #1): events, ticket types, registration, capacity, attendee list, confirmation emails.
8. **Account-matching flow** on email verification + admin manual-link tool.
9. **WordPress embed** — the iframe donate/progress widget dropped into lighthousecare.org.au, all pointed at the same Stripe account + webhook.
10. **Analytics:** GA4 + Meta Pixel on public pages with conversion events; server-side conversions from the webhook (phase 2).
11. **Switch Stripe to live keys, final test, flip the feature flag.**

---

## 13. Open decisions for the team

- [ ] **ShoutForGood shutdown date** — when exactly does it close? This sets our deadline.
- [ ] **Historical data export** — can we export past donations, recurring donors, and event/attendee records from ShoutForGood before it closes? Do we need to import them? **(Time-critical.)**
- [ ] **Recurring donors on ShoutForGood** — how are existing monthly donors migrated to Stripe subscriptions without interruption? (Will almost certainly require asking them to re-enter card details / re-subscribe.)
- [ ] **DGR status** — confirm, for receipting (§10).
- [ ] **Stripe account** — create it and grab **test keys** (publishable + secret + webhook signing secret; free/instant); apply for the nonprofit rate with ACNC/DGR details.
- [ ] **PayPal (optional wallet, later)** — apply for the confirmed-charity rate when the "Pay with PayPal" button is added.
- [ ] **WordPress integration** — confirmed: an **iframe embed** of our own widget (built). Decide which WordPress page(s) host it.
- [ ] **Sponsorship meaning** — what does a "sponsorship" represent (e.g. sponsor a family's weekly trolley)?
- [ ] **Event check-in** — needed for v1, or a later enhancement?
- [ ] **Partner self-serve fundraisers** — admin-created only for v1; partner logins later?
- [ ] **Analytics IDs & access** — GA4 property ID, Meta Pixel ID, and Meta/Google Ads account access; confirm the consent-banner approach with the WordPress site.

---

## 14. Summary

- **Safe:** additive only — the live Volunteer Portal is untouched.
- **Replaces ShoutForGood:** event ticketing, fundraisers, and donation designations, all admin-managed.
- **Familiar:** reuses shared login, Resend emails, email verification, and the two-sided (front end + admin backend) structure proven in the Volunteer Portal.
- **One money pipeline:** Stripe (hosted Checkout), every transaction tagged by source and fund, captured via one webhook; data model kept provider-neutral so PayPal can be added later as an optional wallet.
- **Safe rollout:** built behind a feature flag + early-access allow-list; launched by flipping one switch.
- **No new role:** donor access is based on being logged in / having giving history.
- **Watch the clock:** confirm ShoutForGood's closure date and export historical data before it's gone.
