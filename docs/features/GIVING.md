# Giving — appeals, fundraisers and donations

## The distinction that matters

**A `Fund` is an appeal. A `Fundraiser` is a campaign pointing at a Fund.**
Confusing them is the most common mistake in this area.

| | `Fund` | `Fundraiser` |
|---|---|---|
| What it is | Where money goes and which Stripe account it lands in | A campaign somebody runs to raise for a Fund |
| Lives forever? | Yes — "General", "$25 Trolley", "Christmas Appeal" | No — has a story, a goal, a beginning and an end |
| Public URL | `/donate?fund=<slug>` | `/fundraisers/<slug>` |
| Key fields | `depositAccount` (CARE\|CHURCH), `goalAmount`, `imageUrl`, `tagline`, preset amounts, `showOnDashboard` | `title`, `story`, `contentBlocks`, `goalAmount`, `organiserName`, `fundId` |

Every `Fundraiser` has a `fundId`. **Which fund it pays into is ours to set**,
never the fundraiser's owner — that is the account the money reaches.

A `Donation` can carry `fundId`, `fundraiserId` and `sponsorshipId`. A gift to a
fundraiser uses that fundraiser's fund and is tagged to both.

## Two Stripe accounts

`src/lib/stripe-accounts.ts`. **CARE** and **CHURCH** are separate Stripe
accounts, because tithes and charity donations must not land in one ledger.
Each Fund names its `depositAccount`; `resolveAccount()` picks the keys.

- Pin `apiVersion: '2024-06-20'` for subscription calls.
- `NEXT_PUBLIC_STRIPE_*_PUBLISHABLE_KEY` must be **non-Sensitive** in Vercel —
  they are inlined at build time, and marked Sensitive they arrive `undefined`
  and the payment form silently fails to mount.

## Money representation

`Donation.amount`, `Fundraiser.goalAmount`, `TicketType.price` are
**`Decimal(10,2)` dollars** — Stripe's representation. The reporting tables
(`SalesFact`, `AdDayStat`) are **integer cents**. `Number(d)` before arithmetic
and never mix the two in one expression. See `docs/DATA.md`.

## A gift, end to end

1. `/donate` — optionally `?fund=<slug>` or `?fundraiser=<slug>`. Behind
   `DONOR_PORTAL_ENABLED`.
2. Stripe takes the payment.
3. `src/app/api/webhooks/stripe/route.ts` records the `Donation`. **Stripe
   retries**, so everything here is idempotent on `providerTransactionId`.
4. A receipt goes out (`DONATION_RECEIPT`, admin-editable).
5. If the giver has no account, `sendAccountSetupEmail` invites them to make
   one — token keyed to the email, `/account/setup?token=`. **No account is
   created until they choose a password.**

`Donation.userId` is null until matched to an account. Matching is **by
verified email only** — `claimDonationsForUser` runs on the dashboard, so a
donor who later signs up finds their history waiting.

## Recurring

`Donation.isRecurring` plus `frequency` ("One-off | Weekly | Fortnightly |
Monthly"). Managed at `/dashboard/recurring`. `MigrationIntent` exists for the
Shout for Good migration: a tokenised link pre-filling name, amount and
frequency so an existing recurring donor re-confirms their card rather than
setting it up from scratch.

## Tithes are kept apart

`Donation.isTithe` deposits to CHURCH, is **excluded from the dashboard giving
total**, and is managed in its own `/dashboard/tithes` area. The tithe receipt
comes from Lighthouse Family Church with no Lighthouse Care branding and none
of the "families doing it tough" language — it is a different organisation
speaking to a different relationship.

## Offline gifts

`provider: 'OFFLINE'`, no gateway transaction, `source: 'OFFLINE'`. Added,
edited and removed through `OfflineDonationsManager` — and **only OFFLINE gifts
can be edited or deleted**, because a gateway gift has a counterpart in Stripe
and editing one here would put the two out of step.

## Who sees what

| | |
|---|---|
| **Donors** | Their own giving at `/dashboard/giving`, receipts, recurring management. Appeals with `showOnDashboard`. |
| **The public** | `/donate`, `/fundraisers/<slug>`, `/funds`, and the embeddable `/embed/donate/<slug>`. |
| **Admins** | `care.giving` — and for a plain `ADMIN`, only with `canViewDonations` ticked. The whole `admin/(finance)` route group. |
| **Church managers** | `church.giving` — tithes, not Care donations. |

**Do not leak donation data to volunteer-only admins.** A `CARE_MANAGER` has
`care.people` and `care.tasks` and deliberately *no* giving capability.

## Public share previews

`/fundraisers/<slug>` and `/donate?fund=` use the record's own `imageUrl` for
`og:image` via `shareMetadata()` in `src/lib/share-metadata.ts`. Facebook caches
a preview per URL for a long time — a link already shared keeps its old image
until refreshed in Meta's Sharing Debugger.
