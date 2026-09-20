# Integrations, and what each one lies about

Every integration here was wrong at least once in a way the documentation did
not predict. The fix each time came from building something that printed what
the API *actually* returned. **Probe before you build.**

The gotchas below are the expensive ones. They are not in anybody's docs.

---

## Stripe — two accounts

`src/lib/stripe-accounts.ts`. Two separate Stripe accounts, **CARE** and
**CHURCH**, because tithes and charity donations must not land in one ledger.
Each `Fund` carries a `depositAccount` naming which one it belongs to.

- Pin `apiVersion: '2024-06-20'` for subscription calls.
- `NEXT_PUBLIC_STRIPE_*_PUBLISHABLE_KEY` must be **non-Sensitive** in Vercel.
  They are inlined at build time; marked Sensitive they arrive as `undefined`
  and the payment form silently fails to mount.
- Webhooks: `src/app/api/webhooks/stripe/route.ts`. Handles donations, ticket
  orders and subscriptions. **Stripe retries**, so everything downstream must
  be idempotent — `createOrderWithTickets` keys on `providerTransactionId`.

## Gap Solutions / EMC — the till and online store

`src/lib/integrations/gap.ts`, bridge in `src/lib/gap-bridge.ts`.
Env: `EMC_BASE_URL`, `EMC_EMAIL`, `EMC_PASSWORD`, `EMC_PERSISTENT`,
`EMC_<STORE>_STORE_ID` (one per store — Loganholme 1, Hillcrest 2, warehouse 10).

**Three things that cost real time:**

1. **`/sales` returns `{ list: [...] }`**, not a bare array and not `data` or
   `items`. `findRows()` takes whichever key holds an array. A client that only
   unwrapped the obvious shapes reported zero sales for days while the feed was
   fine.
2. **Web orders arrive with an empty `saleIdentifier`** — the unique key. Every
   online order upserted onto one blank-keyed row, so a year of web trade
   showed as a single order. `saleIdentity()` falls back to `emc-<saleHeaderID>`.
   Fixing it took online from 1 order to 10,546.
3. **A request that comes back full has been truncated.** There is no flag
   saying so. `getAllStoreSales()` bisects the time window and recurses.

`occurredAt` is a naive timestamp holding **UTC**, not Brisbane. Brisbane is
UTC+10 year-round. Getting this backwards makes a 9–5 shop look like it trades
1pm–9pm. The `day` column is the Brisbane calendar day and is correct.

## Meta — reporting, Conversions API, publishing, ads

`meta.ts` (read), `meta-write.ts` (publish and spend), `meta-capi.ts`
(offline conversions), `meta-scopes.ts` (what the token can do).

**Check `/admin/meta-scopes` before debugging anything.** It separates the
three failures that look identical: scope not granted, token not redeployed,
or the system user has the permission but no access to the asset.

| Gotcha | |
|---|---|
| `META_AD_ACCOUNT_ID` needs the **`act_` prefix**. Without it Graph says "Tried accessing nonexisting field (insights)", which reads like a permissions problem and is not. Cost five days of ad data. `metaConfig()` now adds it. |
| Instagram view counts: use **`total_views`**, asked for in its own request. The reels are crossposted to Facebook, so plain `views` is one surface and reads ~8k against a real 84.7k. There is **no plays metric** — `plays`, `video_views`, `ig_reels_aggregated_all_plays_count` and `clips_replays_count` are all rejected. |
| Ask for insight metrics **one at a time** where availability varies. Meta fails the whole request if any single metric is unavailable for that media type, and the error does not say which. |
| Read `effective_status`, not `status`. An ad Meta rejected still reads `ACTIVE`. `issues_info` carries the reason. |
| **Ad creatives are immutable.** You cannot change an ad's image. Repointing a live ad at a new creative sends it back through review and back into the learning phase. A new offer means a **new ad plus pausing the old one**. |
| Publishing needs the page token from `me/accounts`, not the system user token. Instagram needs a **public image URL** — it fetches the image itself and will not take an upload. |
| Read scopes: `ads_read`, `pages_read_engagement`, `pages_show_list`, `instagram_basic`, `instagram_manage_insights`. Write scopes: `ads_management`, `pages_manage_posts`, `instagram_content_publish`. `business_management` is **not** needed — nothing calls a Business Manager endpoint. |
| The token-generation screen starts with **nothing ticked**. A new token carrying only the new scopes silently breaks the nightly reports. |

## Mailchimp

`src/lib/integrations/mailchimp.ts`. `MAILCHIMP_API_KEY`, `MAILCHIMP_AUDIENCE_ID`.

**`SocialPost.views` for a Mailchimp row is opens, not sends.** A campaign
addressed to 40,000 people and opened by 2,000 reached 2,000. Counting sends
inflates "reach" by an order of magnitude and makes email look like the biggest
channel we have.

## TikTok

`src/lib/integrations/tiktok.ts`. `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`.
Display API v2 (`video.list`), OAuth with **rotating refresh tokens** — store
the new one each time or the connection dies silently.

**The app is still in sandbox.** Posting to TikTok needs the Content Posting
API and an app audit, so it is not built and should not be promised.

## Anthropic — the marketing assistant

`ANTHROPIC_API_KEY` (already set). SDK already installed. House pattern, follow
it: model `claude-opus-5`, `max_tokens: 16000`, structured outputs via
`zodOutputFormat` where a shape is needed.

Existing uses: `src/lib/digest-narrative.ts`, `src/lib/step-screenshot.ts`,
`src/lib/marketing-assistant.ts`.

Two rules carried in every prompt, both from real failures:

- **Never state a figure a tool did not return.** A confidently wrong number in
  a report gets repeated in a meeting.
- **The tool surface decides what leaves the building, not the prompt.** A
  prompt is a request; a query is a fact. Nothing in `marketing-tools.ts` can
  select a person.

## Vercel Blob — images

**One upload path: `uploadImageAction` in `src/lib/actions/upload.actions.ts`.**
It sniffs magic bytes rather than trusting the browser's content type, and
refuses SVG because SVG can carry script. Do not write a second uploader.

One library: `src/lib/media-library.ts`, shown at `/admin/media`. Folders:
`media`, `uploads`, `events`, `fundraisers`, `funds`, `sponsors`, `stories`,
`marketing-assets`. **`avatars/` and `partner-logos/` are deliberately outside
it** — a volunteer's own face is not stock for an advertisement.

## Email

`src/lib/email.ts` — Resend or SMTP by `EMAIL_PROVIDER`. Templates are
**admin-editable** rows rendered by `renderTemplate()`; don't hard-code copy
that belongs in one. `EmailLog` records every send and doubles as the rate
limiter for the public contact form.
