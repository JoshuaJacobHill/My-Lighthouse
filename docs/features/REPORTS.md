# Sales and marketing reports

`/dashboard/business` — store takings and marketing performance in one place,
because at Lighthouse they are the same conversation: the shops fund the
mission, so ad spend and till revenue answer to each other.

Gated on **`business.reports`**, which is a per-person switch rather than a role.

## What the page answers

The question the two halves exist for: **did takings and reach move together?**
No single figure answers it, which is why the `SalesVsViews` chart leads the
page rather than trailing the detail it summarises. It sits *above* the period
tabs deliberately — it carries its own Days/Weeks/Months control and the tabs
do not affect it.

Below the tabs: sales by store and channel against the previous period, top
organic posts by platform, top paid ads with ROAS, views by source, and feed
health.

## Where the numbers come from

| Table | Grain | Source |
|---|---|---|
| `SalesFact` | One row per day, store, channel and source — unique on all four, so two feeds cannot silently overwrite each other | Gap Solutions / EMC |
| `GapSale` | Individual sales, recent only, for the Meta bridge | Gap Solutions / EMC |
| `SocialPost` | One row per organic post, ad, or Mailchimp campaign | Meta, TikTok, Mailchimp |
| `AdDayStat` | One row per ad per day | Meta ads |
| `IngestRun` | Every ingestion attempt | all feeds |

**`AdDayStat` is day-grain for a reason.** An organic post belongs to the day it
went up; an ad does not — one created in July can be September's biggest
spender. Filtering paid by publish date answers the wrong question.

## Four things that will mislead you

1. **Check `IngestRun` before calling a number low.** A failed pull and a
   genuinely quiet week render identically. That table exists so they don't.
2. **Paid and organic views overlap.** A boosted post is counted by both its own
   insights and the ad's, and Meta gives no way to net it off. The *change*
   between periods is meaningful; the absolute total is not a headcount.
3. **Mailchimp "views" are opens, not sends.** A campaign addressed to 40,000
   and opened by 2,000 reached 2,000.
4. **Like-for-like comparisons.** `periodRange()` clamps the previous window to
   the same number of *elapsed* days, so a Tuesday does not compare against a
   full week and report a collapse.

## Sub-pages

- **`/dashboard/business/bridge`** — the Gap → Meta Conversions API bridge:
  status, diagnostics, backfill. In-store purchases sent to Meta as
  `physical_store` events so offline sales attribute to the ads that caused
  them.
- **`/dashboard/business/tiktok`** — TikTok connection and video stats.
- **`/admin/ig-backfill`** — reads the Instagram back-catalogue in resumable
  slices, because each post needs two insight requests and the platform kills a
  function at sixty seconds.
- **`/admin/meta-scopes`** — what the live Meta token can actually do.

## The marketing assistant

Claude, on the same page, reading these figures. Three files, and the split
between them is the safety model:

- **`src/lib/marketing-tools.ts`** — everything it may know. Every query reads
  aggregates; none can select a person. **This file is the list of what we are
  willing to send to a third-party API.**
- **`src/lib/marketing-assistant.ts`** — the prompt and the streaming tool loop.
  Every `propose_*` tool ends at a `MarketingProposal` DRAFT row.
- **`src/lib/integrations/meta-write.ts`** — the only code that publishes or
  spends. Imported by `marketing.actions.ts` and nowhere else. **If you find it
  imported from the chat path, that is the bug.**

`/admin/marketing` is the approval queue: approve and execute are one action,
each button says what it will do rather than "Approve", and an ad's own Meta
preview is embedded on the card — because approving an advertisement you cannot
see is a guess, not an approval. Budget ceiling `MAX_DAILY_BUDGET_CENTS`
($500/day) is enforced in `meta-write.ts`, not in the form.

## Who sees it

`business.reports`: Josh, plus Dan, Nathan and Bridget (`CARE_MANAGER`s with
the switch on). Granted from `/admin/users/<id>` by a `SUPER_ADMIN`.

**The same capability currently gates approving a public post and an ad spend
change.** Worth an explicit decision rather than a default — see
`marketing.actions.ts` `guard()`.
