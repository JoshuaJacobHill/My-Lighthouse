# The POS bridge — Gap Solutions → Meta

Sales at the Loganholme counter go into Gap Solutions. This bridge reads them
on a schedule and does two things with each one:

1. **Feeds the sales report.** In-store revenue and order counts land in
   `SalesFact`, which is what `/dashboard/business` already reads. This is the
   half of that report that was blank until now.
2. **Tells Meta about the purchase**, so money spent on ads can be measured
   against money taken over the counter — as a `physical_store` Purchase event
   in the existing Lighthouse Care dataset.

    Gap Solutions EMC                     our database                Meta
    ─────────────────                     ────────────                ────
    GET /api/store/1/sales      ──▶  GapSale (one row per sale)
       for the last hour                     │
                                             │ only sales that qualify
    GET /api/storesale/{id}     ──▶          │
       customer, if attached                 │
                                             ▼
                                    hash email/phone/name in memory
                                    raw values discarded immediately
                                             │
                                             ▼
                                                            POST .../{dataset}/events
                                                                     │
                                    GapSale.status = SENT  ◀──────────┘
                                    (only once Meta acknowledges it)
                                             │
                                             ▼
                                    SalesFact → the sales report

## Where it lives

Inside this app, not as a separate service. It uses the Postgres database we
already run, the Vercel cron scheduler we already use, and the same admin
permissions as the sales report. There is no Docker container to deploy and no
second set of secrets to keep in step — and because the ledger is in the same
database as the report, one feed serves both.

| Piece | File |
| --- | --- |
| EMC client (auth, retries, the three endpoints) | `src/lib/integrations/gap.ts` |
| Meta CAPI (normalising, hashing, payload, sending) | `src/lib/integrations/meta-capi.ts` |
| The bridge itself (`runOnce`, `processSale`, rollup) | `src/lib/gap-bridge.ts` |
| Scheduled cron | `src/app/api/cron/gap-sales/route.ts` |
| Admin console — status, manual run, single-sale test | `/dashboard/business/bridge` |
| Tests | `src/lib/**/*.test.ts` |

## What you need in the environment

Add these in **Vercel → Settings → Environment Variables** (Production). The
full list with comments is in `.env.example`.

| Variable | Value | Notes |
| --- | --- | --- |
| `EMC_BASE_URL` | `https://gap4.ezimanager.cloud` | |
| `EMC_EMAIL` | the integration account's email | the restricted read-only account, never a person's login |
| `EMC_PASSWORD` | its password | |
| `EMC_LOGANHOLME_STORE_ID` | `1` | one variable per store — see below |
| `META_DATASET_ID` | `326811303390692` | the existing dataset — do not make another |
| `META_CAPI_ACCESS_TOKEN` | the Conversions API token | falls back to `META_ACCESS_TOKEN` if unset |
| `META_TEST_EVENT_CODE` | `TEST94037` | **remove this to go live** |
| `DRY_RUN` | `true` | `true` builds the payload and sends nothing |
| `SEND_CUSTOMER_IDENTIFIERS` | `false` | see Privacy below |

`META_GRAPH_VERSION` defaults to `v26.0` and is a variable on purpose — when
Meta retires a version, that is a settings change, not a code change.

### Adding another shop

Stores are discovered from the environment, one variable each:

```
EMC_LOGANHOLME_STORE_ID=1
EMC_HILLCREST_STORE_ID=2
```

The name in the middle becomes the store's label in the sales report, so it has
to match how the report already spells it (`MOUNT_WARREN` → `Mount Warren`).
Every configured store is polled in the same run, sharing one token and one
window, and each is rolled up separately — `SalesFact` is keyed by store, so
Hillcrest's takings can never land in Loganholme's column.

A sale belonging to a store that is *not* configured is recorded and skipped
with the reason `other_store`, rather than being quietly counted somewhere.

## How often it runs

Once a day, at 21:30 Brisbane, looking back twenty-five hours.

It was designed to poll every ten minutes, and the code still supports that —
but **the Vercel plan is Hobby, which allows only daily cron jobs**. A
`*/10 * * * *` schedule does not merely get ignored: it makes the whole
deployment invalid and nothing ships at all.

A daily run is still correct rather than a compromise. Deduplication makes the
wide overlap free, and Meta accepts in-store events up to seven days old, so
attribution is unaffected. It is only less timely — a purchase reaches Meta the
evening it happened rather than within the hour.

Two ways to get back to ten minutes:

1. **Upgrade to Vercel Pro.** Then set the schedule in `vercel.json` to
   `*/10 * * * *` and `POLL_LOOKBACK_MINUTES=60`. No code change.
2. **Schedule it from outside Vercel** — GitHub Actions, or a free service like
   cron-job.org — calling the endpoint with the `CRON_SECRET` bearer token.

Either way, **Run now** on the bridge page works at any time, so nothing has to
wait for a schedule.

## Turning it on, in order

The two switches are separate deliberately, so you can prove each step without
risking the next one.

**Step 1 — prove the Gap Solutions side, sending nothing anywhere.**
With `DRY_RUN=true`, open `/dashboard/business/bridge` and press **Run now**. It
will authenticate, read the last hour of sales, fetch the detail for the ones
that qualify, build the Meta payload and stop. You should see sales inspected
and "Dry run — nothing was sent to Meta."

From a terminal, the same thing:

```bash
curl -s "https://my.lighthousecare.org.au/api/cron/gap-sales?lookback=1440" -H "Authorization: Bearer $CRON_SECRET" | jq
```

**Step 2 — record sales without sending anything to Meta.** Leave both
switches as they are. Sales are recorded and the sales report fills in, but no
customer detail goes anywhere. Every customer-linked sale shows as "Held —
matching switched off". This is a perfectly good place to sit for a while.

**Step 3 — send test events.** In Vercel → Settings → Environment Variables,
change **both**:

```
DRY_RUN=false
SEND_CUSTOMER_IDENTIFIERS=true
```

Both are needed. With identifiers off, `DRY_RUN=false` sends nothing, because a
Purchase event with no identifier cannot match anyone and the bridge holds it
rather than sending an empty one.

**Environment variables only take effect on a new deployment.** After saving,
go to **Deployments**, open the most recent one, and choose **Redeploy**. Until
you do, the running app still has the old values — which looks exactly like the
change not working.

Then press **Run now** on the bridge page. Sales held at step 2 are picked up
automatically, so the first run should send several at once.

**Step 4 — check they arrived.** In [Events Manager](https://business.facebook.com/events_manager):

1. Choose the Lighthouse Care dataset (`326811303390692`).
2. Open the **Test Events** tab. With `META_TEST_EVENT_CODE` set, events appear
   here within a few seconds of a run, and nowhere else.
3. Each one should read: **Purchase**, Received from **Server**, Action source
   **physical_store**, Currency **AUD**, with a value and an Order ID matching
   the sale identifier on the bridge page.

Test events deliberately do not count towards reporting or ad optimisation.
They prove the payload is right and nothing else.

**Step 5 — go live.** Delete `META_TEST_EVENT_CODE` (or clear its value) and
redeploy. The bridge page's "Meta test events" row should then read "Live
events".

Two things to expect:

- **The sales already sent as test events will not reappear.** They are marked
  SENT and are never sent twice, so the first live events are new sales. That is
  the deduplication working, not a fault.
- **Event Match Quality takes a day or two.** It is calculated on real events,
  so it does not appear for test events at all. Once live, open the **Overview**
  tab, click the Purchase event, and it shows a score plus which parameters
  Meta received. That score — not anything measurable from our side — is the
  real verdict on how well the matching works.

**To stop at any point**, set `DRY_RUN=true` and redeploy. Sales keep being
recorded and the report keeps working; nothing further goes to Meta.

## Privacy

**Nothing personal is stored.** A customer's email, phone, name and postcode are
read from the EMC detail response, normalised, SHA-256 hashed and dropped inside
a single function. What survives in the database is the sale identifier, the
time, the value, the store and a yes/no on whether a customer was attached.

**Nothing personal is logged.** Logging is allow-listed rather than redacted —
only named fields can reach a log line, so a new field appearing in EMC's
response cannot leak by being forgotten.

**Payment data never enters the application.** The EMC detail response can carry
card, EFTPOS, terminal and operator information, along with basket contents and
staff notes. None of it is read, stored, logged or sent.

**On `SEND_CUSTOMER_IDENTIFIERS`.** Turning it on means hashed customer
identifiers are shared with Meta for advertising measurement. That is a decision
about our privacy notice and legal basis, not a technical setting — and a
customer's marketing tick-box in the POS is *not* the same question. That box is
about whether we may email them. Leave the switch off until the privacy notice
covers this use.

## Why it cannot double-count

Three layers, because double-counted revenue would quietly corrupt ad
optimisation rather than fail visibly:

1. `GapSale.saleIdentifier` is **unique** in Postgres.
2. A sale marked `SENT` is never offered again, and the ten-minute poll with a
   sixty-minute lookback relies on exactly that.
3. Meta's `event_id` **is** the sale identifier, so even a duplicate send is
   deduplicated at their end.

A sale is only marked `SENT` when Meta answers with success *and*
`events_received >= 1`. Meta will answer HTTP 200 with `events_received: 0`
when it has dropped everything, and treating that as sent would lose the sale
for good.

## Token handling

EMC tokens go stale without warning. Any request that comes back 401 refreshes
the token once, retries once, and stops. Nobody ever has to paste a token in.

A 403 is different — that is the integration account missing a permission, and
retrying only fills their logs and ours. It fails immediately and says so. If
you see 403s, the account's permissions have changed at the Gap Solutions end.

## Checking on it

`/dashboard/business/bridge` shows how it is configured, when it last ran, how
many sales are in each state, today's in-store total, and the last few failures
with Meta's error text. It also has the two manual controls:

- **Run now**, with an adjustable lookback for catching up after an outage.
  Re-running is safe; already-handled sales are skipped.
- **Test one sale**, given a sale header ID. It runs the real path — persistence
  included, so a tested sale will not be sent again by the next cycle — and
  shows which fields were hashed, never what they were.

The **Feeds** list at the bottom of the sales report shows `gap-meta-bridge`
alongside the Meta and Mailchimp feeds.

## Troubleshooting

| What you see | What it means |
| --- | --- |
| `EMC CreateToken failed (401)` | the integration account's email or password is wrong |
| `EMC ... refused (403)` | the account has lost a permission at the Gap Solutions end |
| Meta `400` | payload or token problem — the error text names the field |
| Meta `401` / `403` | the CAPI token or dataset permissions |
| `events_received: 1` | accepted |
| Sales inspected but 0 sent | expected while `DRY_RUN=true` or matching is off |
| "No customer attached" for most sales | normal — walk-in sales have no customer in the POS |

## What is deliberately not built

**Refunds and unusual transaction types.** Only `tranType = 0` is processed.
Everything else is recorded as `SKIPPED_TRAN_TYPE` with a reason. Refunds need
their own thinking — Meta has a separate treatment for them — and inventing
rules here would be guessing.

**`/api/customer/{guid}/sales`.** The integration account is refused it, and
the bridge does not need it.

**Post-purchase automations.** The idea of a Zapier-style layer — subscribing a
customer to Mailchimp, or triggering an email when someone buys in store — plugs
in at the `SaleOutcome` returned by `processSale`, which is the point where we
know a real sale happened and who it belonged to. It is not wired up, on
purpose: sending marketing email to customers off the back of a purchase is a
consent decision, and the same privacy question as above applies with more force
because it reaches the customer directly.
